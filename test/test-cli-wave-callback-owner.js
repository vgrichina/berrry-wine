'use strict';
const assert = require('assert/strict'), fs = require('fs'), path = require('path');
const { createHostImports } = require('../lib/host-imports');
const { createCliWaveCallbackRouting } = require('./cli-wave-callback-owner');
const { WorkerLink } = require('../lib/guest-thread-host');
const RPC = require('../lib/guest-rpc');
const sigs = require('../lib/host-import-sigs.generated.json').sigs;
const { BASE } = require('../lib/region-map.generated');
const baseline = process.env.CLI_WAVE_BASELINE === '1';
// Verify the production CLI uses this tested routing at both registration sites
// and drains the asynchronous worker queue at the existing audio boundary.
const cli = fs.readFileSync(path.join(__dirname, 'run.js'), 'utf8');
assert.match(cli, /get: \(\) => waveCallbackRouting.owner\(ctx.exports\)/);
assert.match(cli, /get: \(\) => waveCallbackRouting.owner\(workerInstance\?\.exports, tid, WORKER_THREADS\)/);
assert.match(cli, /pumpAudioCompletions\(\);\n    if \(ctx.pumpWaveCallbacks\) await ctx.pumpWaveCallbacks\(\);/);
const extra = `
 (export "test_waveOutOpen" (func $handle_waveOutOpen))
 (func (export "test_wait")
   (global.set $yield_reason (i32.const 1)) (global.set $yield_flag (i32.const 1))
   (global.set $wait_handle (i32.const 123)) (global.set $wait_timeout (i32.const -1))
   (global.set $wait_stack_bytes (i32.const 12)))`;
async function main(workerBackend) {
  let now = 3000, admitted = 0, busy = true, active = false;
  const memory = new ArrayBuffer(512*1024), dv = new DataView(memory);
  const e = {get_eip:()=>0x401000,get_yield_reason:()=>1,is_mm_timer_callback_active:()=>active,
    fire_wave_out_callback_bound:(...args)=>{assert.deepEqual(args,[hwo,0x405000,0xa3e990,123]);if(busy)return 0;admitted++;active=true;return 1;}};
  const tm = {workerBackend,threads:new Map(),_mainWaitStartedAt:55,_mainWaitPolls:3};
  const routing = createCliWaveCallbackRouting({getMainExports:()=>e,getThreadManager:()=>tm,getBackend:()=>workerBackend});
  const ctx = {getMemory:()=>memory,sharedAudio:{audioClockMs:()=>now},exports:e,threadManager:tm};
  if (!baseline) {Object.defineProperty(ctx,'waveCallbackOwner',{get:()=>routing.owner(e)});ctx.offerWaveCallback=routing.offer;}
  const h=createHostImports(ctx).host,hwo=h.wave_out_open(22050,2,16,3,0xa3e990,123);
  dv.setUint32(BASE.WAVE_OUT_SHARED+4,0xa3e990,true);dv.setUint32(BASE.WAVE_OUT_SHARED+12,3,true);
  dv.setUint32(0x24010,0x12,true);h.wave_out_write(hwo,0x1000,22048);h.wave_out_schedule_done(hwo,0x24000,0x405000,22048);
  ctx.pumpAudioCompletions();assert.equal(ctx.sharedAudio.waveFunctionDoneQueue.length,0);
  now=3400;assert.equal(ctx.pumpAudioCompletions(),1);await ctx.pumpWaveCallbacks();
  assert.equal(admitted,0);busy=false;ctx.pumpAudioCompletions();await ctx.pumpWaveCallbacks();
  const stranded=baseline && !!workerBackend;
  assert.equal(admitted,stranded?0:1);assert.equal(ctx.sharedAudio.waveFunctionDoneQueue.length,stranded?1:0);
  if (!baseline) {
    assert.equal(tm._mainWaitStartedAt,0);routing.restoreMainWait();assert.equal(tm._mainWaitStartedAt,0);
    active=false;routing.restoreMainWait();assert.equal(tm._mainWaitStartedAt,55);assert.equal(tm._mainWaitPolls,3);
  }
  console.log('PASS main registration/delivery', {workerBackend:!!workerBackend,baseline,stranded});
}
async function worker() {
  const bytes=require('./compile-src').compileSrcWasm((file,s)=>file==='13-exports.wat'?s+extra:s);
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});let now=3000,mainCalls=0;
  const backend={audioRpcSlot:null,threadLinks:new Map()},tm={threads:new Map(),workerBackend:backend};
  const mainExports=new Proxy({}, {get:()=>{mainCalls++;throw Error('RPC callback touched main');}});
  const routing=createCliWaveCallbackRouting({getMainExports:()=>mainExports,getThreadManager:()=>tm,getBackend:()=>backend});
  // makeWorkerImports builds a per-thread table from processSharedCtx;
  // threadManager is not inherited. Before explicit routing its fallback
  // therefore binds the shadow exports proxy, which resolves to main for RPC.
  const ctx={getMemory:()=>memory.buffer,sharedAudio:{audioClockMs:()=>now},exports:mainExports};
  if(!baseline){Object.defineProperty(ctx,'waveCallbackOwner',{get:()=>routing.owner(mainExports,1,true)});ctx.offerWaveCallback=routing.offer;}
  const host=createHostImports(ctx).host,broker=RPC.createMainBroker(memory,host,sigs);
  const link=new WorkerLink({slot:1,memory,module:new WebAssembly.Module(bytes),sigs,broker,
    workerUrl:path.resolve(__dirname,'../lib/guest-worker.js'),onRpc:s=>{backend.audioRpcSlot=s;},onRpcEnd:()=>{backend.audioRpcSlot=null;}});
  backend.threadLinks.set(1,link);
  const thread={link,state:'active',suspendCount:0,waitStartedAt:77,waitPolls:5,parkedWait:{original:true}};
  tm.threads.set(1,thread);const call=(n,...a)=>link.callExport(n,...a);
  try {
    await link.start();const exe=fs.readFileSync(path.join(__dirname,'binaries/notepad.exe'));
    new Uint8Array(memory.buffer).set(exe,await call('get_staging'));assert(await call('load_pe',exe.length));
    const metadata=await Promise.all(['get_image_base','get_code_start','get_code_end','get_thunk_base','get_thunk_end','get_num_thunks','get_rsrc_rva'].map(n=>call(n)));
    await call('init_thread',1,...metadata);
    const alloc=async n=>(await call('guest_alloc',n))>>>0,write=(p,v)=>call('guest_write32',p,v),read=async p=>(await call('guest_read32',p))>>>0;
    const stack=(await alloc(8192))+4096,ph=await alloc(4),fmt=await alloc(32),hdr=await alloc(32),cb=await alloc(32),resume=await alloc(16),count=await alloc(4);
    const u32=n=>[n&255,(n>>>8)&255,(n>>>16)&255,n>>>24];
    new Uint8Array(memory.buffer).set([0xff,0x05,...u32(count),0xc2,20,0],await call('guest_to_wasm',cb));
    new Uint8Array(memory.buffer).set([0xeb,0xfe],await call('guest_to_wasm',resume));
    await write(fmt,0x20001);await write(fmt+4,22050);await write(fmt+8,88200);await write(fmt+12,0x100004);
    await write(stack+24,0x30000);await call('set_esp',stack);await call('set_eip',resume);
    await call('test_waveOutOpen',ph,-1,fmt,cb,123,0);assert.equal(await call('get_eax'),0);
    const hwo=await read(ph),r=ctx.sharedAudio.waveRegistrations.get(hwo);
    assert.equal(backend.audioRpcSlot,null);assert.equal(r.owner?.kind??null,baseline?'cooperative':'worker');
    await write(hdr+16,0x12);host.wave_out_write(hwo,0x1000,22048);host.wave_out_schedule_done(hwo,await call('guest_to_wasm',hdr),hdr,22048);
    await call('set_esp',stack);await call('set_eax',0x12345678);await call('test_wait');
    ctx.pumpAudioCompletions();assert.equal(ctx.sharedAudio.waveFunctionDoneQueue.length,0);
    now=3400;
    if (baseline) assert.throws(()=>ctx.pumpAudioCompletions(),/RPC callback touched main/,
      'old worker table falls back to shadow main exports');
    else ctx.pumpAudioCompletions();
    assert.equal(await read(hdr+16),3);
    thread.suspendCount=1;await ctx.pumpWaveCallbacks();assert.equal(await call('get_eip'),resume);thread.suspendCount=0;
    thread.inFlight=true;await ctx.pumpWaveCallbacks();assert.equal(await call('get_eip'),resume);thread.inFlight=false;
    await ctx.pumpWaveCallbacks();assert.equal(mainCalls,baseline?1:0);
    if(baseline){assert.equal(ctx.sharedAudio.waveFunctionDoneQueue.length,1);assert.equal(await call('get_eip'),resume);}
    else {
      assert.equal(r.owner.slot,1);assert.equal(r.owner.link,link);assert.equal(await call('get_eip'),cb);
      const sp=await call('get_esp');assert.deepEqual(await Promise.all([4,8,12,16,20].map(n=>read(sp+n))),[hwo,0x3bd,123,hdr,0]);
      await call('run',10000);assert.equal(await read(count),1);assert.equal(await call('get_eip'),resume);assert.equal(await call('get_esp'),stack);
      assert.equal(await call('get_eax'),0x12345678);assert.equal(await call('get_wait_handle'),123);assert.equal(await call('get_wait_stack_bytes'),12);
      assert.equal(thread.waveWaitSaved.waitStartedAt,77);assert.equal(thread.parkedWait,null);
      await ctx.pumpWaveCallbacks();assert.equal(await read(count),1);
      const item={registration:r,waveHdrGA:hdr};backend.threadLinks.set(1,{worker:{}});
      assert.equal((await routing.offer(item)).status,'retired','recycled worker never inherits callback');
    }
    console.log('PASS actual worker RPC registration and callback execution/return', {baseline,stranded:baseline,mainCalls});
  } finally {await link.stop();}
}
(async()=>{await main(null);await main({});await worker();})().catch(e=>{console.error(e);process.exitCode=1;});
