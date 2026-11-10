'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createServiceClock, createBatchClock } = require('../lib/batch-clock');
const { createHostImports } = require('../lib/host-imports');
const { ThreadManager } = require('../lib/thread-manager');
const { WorkerLink } = require('../lib/guest-thread-host');
const RPC = require('../lib/guest-rpc');
const sigs = require('../lib/host-import-sigs.generated.json').sigs;
const module_ = new WebAssembly.Module(fs.readFileSync('build/wine-assembly.wasm'));
const legacy = process.env.SERVICE_CLOCK_BASELINE === '1';
function setup(shared, onEip) {
  const clock = legacy ? createBatchClock(200) : createServiceClock(5000, shared);
  const memory = new WebAssembly.Memory({ initial:8192, maximum:8192, shared:true });
  const ctx = { getMemory:()=>memory.buffer, audioClockMs:()=>clock.batchTicks() };
  const imports = createHostImports(ctx); imports.host.memory=memory;
  let observedExports;
  if (onEip) imports.host.log_eip=() => onEip(observedExports, clock);
  if (!legacy) clock.wrapImports(imports.host);
  const raw = new WebAssembly.Instance(module_, imports);
  const instance = legacy ? raw : clock.wrapInstance(raw);
  ctx.exports = instance.exports;
  const e=instance.exports;observedExports=e;
  e.guest_write32(0x401000,0x00fdeb40);e.set_eip(0x401000);
  return {clock,memory,ctx,imports,instance,e};
}
function evaluate(parts, total=4000, idle=0) {
  const {clock,ctx,imports,e}=setup(); const h=imports.host;
  const voice=h.wave_out_open(22050,2,16,0);
  h.wave_out_write(voice,4096,22048);h.wave_out_schedule_done(voice,128,0x400080,22048);
  let retired=0;
  for(let b=1;b<=parts;b++) {
    clock.state.batch=b;clock.state.callsInBatch=0;
    ctx.pumpAudioCompletions();e.run(total/parts);retired+=e.get_last_run_blocks()>>>0;
  }
  if(idle) clock.advanceIdle(idle);
  ctx.pumpAudioCompletions();
  return {retired,deviceMs:clock.batchTicks(),cursor:h.wave_out_get_pos(voice),pending:ctx.waveDoneQueue.length,eip:e.get_eip()>>>0,eax:e.get_eax()>>>0};
}
(async()=>{
  if (process.env.SERVICE_CLOCK_CASE === 'nested') {
    let nested=false, outerAtEntry=0, lowestInside=Infinity;
    const f=setup(null,(e,clock)=>{
      const blocks=e.get_blocks_now()>>>0;
      if (nested) {lowestInside=Math.min(lowestInside,blocks);return;}
      if (blocks<10) return;
      nested=true;outerAtEntry=blocks;
      e.run(7);
      // The outer counter must stay visible while the inner run is active.
      assert(lowestInside>=outerAtEntry,`nested counter reversed ${outerAtEntry} -> ${lowestInside}`);
    });
    f.e.set_trace_eip_range(1,0x401000,0x401001);
    f.e.run(1000);
    assert(nested);assert.equal(f.e.get_blocks_now(),1007);
    assert.equal(f.clock.retiredBlocks(),1007n,'nested execution must not mint a uint32 wrap');
    assert.equal(f.clock.batchTicks(),201);
    console.log('PASS actual WASM nested run cumulative counter and service time');return;
  }
  if (process.env.SERVICE_CLOCK_CASE === 'idle') {
    const f=setup(),peer=setup();
    const tm=new ThreadManager(module_,f.memory,f.instance,()=>({host:{}}),
      {now:()=>f.clock.batchTicks(),strictServiceTime:true});
    tm._mainSleepUntil=100;
    tm.threads.set(1,{tid:1,state:'active',suspendCount:0,sleepUntil:20,
      waitPolls:0,instance:peer.instance});
    f.ctx.sharedAudio={waveDoneQueue:[]};
    const source=process.env.IDLE_CLOCK_BASELINE === '1'
      ? require('node:child_process').execFileSync('git',['show','HEAD:test/run.js'],{encoding:'utf8'})
      : fs.readFileSync(path.join(__dirname,'run.js'),'utf8');
    const start=source.indexOf('    // Advance only after every admitted sibling');
    const snippet=start < 0 ? '' : source.slice(start,source.indexOf('    // Check if main thread is waiting',start));
    const sandbox={serviceClock:true,serviceAtBatchStart:f.clock.retiredBlocks(),threadManager:tm,batchClock:f.clock,ctx:f.ctx,instance:f.instance};
    require('node:vm').runInNewContext(snippet,sandbox);
    assert.equal(f.clock.batchTicks(),20,'actual CLI all-blocked main/sibling advances to earliest deadline');
    assert.equal(peer.e.get_blocks_now(),0,'idle advancement never executes the parked sibling');
    // A runnable main/sibling may have signalled an earlier-polled waiter.
    // That process needs another ordinary poll before any idle advance.
    f.e.run(1000);const before=f.clock.batchTicks();
    require('node:vm').runInNewContext(snippet,sandbox);
    assert.equal(f.clock.batchTicks(),before,'guest work since the pass start forbids speculative idle time');
    console.log('PASS actual CLI idle boundary, actual WASM parked frames');return;
  }
  // Actual x86/WASM, same header and final CPU state. This equality fails on
  // the original batch policy, rather than blessing the known discrepancy.
  if (process.env.SERVICE_CLOCK_CASE !== 'worker') for(const n of [1000,4000]) {
    const one=evaluate(1,n);for(const parts of [2,10,40]) assert.deepEqual(evaluate(parts,n),one);
    assert.equal(one.deviceMs,n/5);assert.equal(one.pending,n===1000?1:0);
  }
  if (process.env.SERVICE_CLOCK_CASE !== 'worker') {
    assert.deepEqual(evaluate(1,1000,51),evaluate(10,1000,51));
    assert.equal(evaluate(10,1000,51).pending,0);
  }
  const f=setup();
  // Shared aggregate service across actual production guest-worker transport.
  const broker=RPC.createMainBroker(f.memory,f.imports.host,sigs);
  const link=new WorkerLink({slot:1,memory:f.memory,module:module_,sigs,broker,
    cpuService:f.clock.service,workerUrl:path.resolve(__dirname,'../lib/guest-worker.js')});
  try {
    await link.start();
    await link.callExport('guest_write32',0x402000,0x00fdeb40);
    await link.callExport('set_eip',0x402000);
    if (legacy) f.clock.state.batch=1;
    f.e.run(1000);assert.equal(f.clock.batchTicks(),200);
    let receipt;for(let n=0;n<10;n++) receipt=await link.slice(100);
    assert.equal(receipt.serviceRunEndMs,400,'Worker stamps execution time before reply delivery');
    assert.equal(f.clock.batchTicks(),400,'main plus sibling share one CPU service total');
    assert.equal(await link.callExport('get_tick_count'),400,'Worker guest reads the shared ledger');
    f.e.run(500);await link.callExport('next_timer_due_ms');
    assert.equal(await link.callExport('get_service_run_end_ms'),400,
      'later main work and Worker diagnostics do not move the Worker wait origin');
    assert.equal(await link.callExport('get_tick_count'),500);
  } finally { await link.stop(); }
  // Idle discovery reads already observed state, never waitSingle/grants.
  const e=f.e;
  const tm=new ThreadManager(module_,f.memory,f.instance,()=>({host:{}}),
    {now:()=>f.clock.batchTicks(),strictServiceTime:true});
  const waitSingle=tm.waitSingle;
  tm.waitSingle=()=>{throw Error('idle probe consumed semaphore');};
  tm._mainSleepUntil=f.clock.batchTicks()+100;
  const peer=setup();
  const t={tid:1,state:'active',suspendCount:0,sleepUntil:0,instance:peer.instance,waitPolls:1};
  tm.threads.set(1,t);
  assert.equal(tm.serviceIdleDelay(),0,'a runnable sibling forbids idle advance');
  t.sleepUntil=f.clock.batchTicks()+20;
  assert.equal(tm.serviceIdleDelay(),20,'earliest blocked sibling deadline wins');
  f.clock.advanceIdle(20);assert.equal(tm.serviceIdleDelay(),0,'due sibling must receive service');
  t.sleepUntil=f.clock.batchTicks()+200;
  assert.equal(tm.serviceIdleDelay(),80,'main deadline wins after identical idle time');
  tm._pendingThreads.push({suspendCount:0});assert.equal(tm.serviceIdleDelay(),0);
  tm._pendingThreads.length=0;
  t.grantedWait=0xe001;assert.equal(tm.serviceIdleDelay(),0,'a reserved semaphore grant is runnable');
  t.grantedWait=0;
  tm.waitSingle=waitSingle;
  const sem=tm.createSemaphore(0,1), waitState={waitStartedAt:0,waitPolls:0};
  const request={waitHandle:sem,waitTimeout:255,waitStackBytes:12};
  assert.equal(tm.resolveWait(request,waitState,{main:true}),null);
  f.clock.advanceIdle(254);assert.equal(tm.resolveWait(request,waitState,{main:true}),null);
  f.clock.advanceIdle(1);
  assert.equal(tm.resolveWait(request,waitState,{main:true}).result,0x102,
    'service deadline expires with no batch poll floor even with a live sibling');
  const entry=f.clock.batchTicks();f.clock.advanceIdle(300);
  assert.equal(tm.resolveWait({...request,serviceRunEndMs:entry},
    {waitStartedAt:0,waitPolls:0},{main:true}).result,0x102,
    'delayed Worker observation retains the actual execution-boundary wait origin');
  const siblingState={waitStartedAt:0,waitPolls:0};
  assert.equal(tm.resolveWait(request,siblingState,{}),null);
  assert.equal(tm.releaseSemaphore(sem,1,0),1);
  assert.equal(tm.resolveWait(request,siblingState,{}).result,0,'signal wins immediately');
  assert.equal(tm.waitSingle(sem,0,1),0x102,'idle and deadline probes did not duplicate a grant');
  // Non-consuming reads cannot mint time; fractional work survives partitions.
  const before=f.clock.batchTicks();for(let n=0;n<1000;n++)assert.equal(f.clock.getTicks(),before);
  if (!process.env.SERVICE_CLOCK_CASE) {
    for (const case_ of ['nested', 'idle']) require('node:child_process').execFileSync(
      process.execPath, [__filename], {
        env: { ...process.env, SERVICE_CLOCK_CASE: case_ }, stdio: 'inherit',
      });
  }
  console.log(JSON.stringify({passed:true,one:evaluate(1),ten:evaluate(10),worker:true,idle:true}));
})().catch(e=>{console.error(e);process.exitCode=1;});
