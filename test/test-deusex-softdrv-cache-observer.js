'use strict';
// Original SoftDrv instructions in the shipped queued Worker; no Engine/Draw.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {Worker,MessageChannel,isMainThread,parentPort,workerData}=require('node:worker_threads');
const {SOFTDRV_SHA256,CUTS,PINS,RELEASES,SoftDrvCacheObserver}=require('../lib/deusex-softdrv-cache-observer');
const ROOT=path.resolve(__dirname,'..'),H=b=>crypto.createHash('sha256').update(b).digest('hex');
const media='test/binaries/candidates/deus-ex-demo/installed/system/softdrv.dll';
const core=fs.readFileSync(path.join(ROOT,media));assert.equal(H(core),SOFTDRV_SHA256);
const pe=core.readUInt32LE(60),sections=pe+24+core.readUInt16LE(pe+20);
function original(rva,n) {
  for(let i=0;i<core.readUInt16LE(pe+6);i++) {
    const s=sections+i*40,va=core.readUInt32LE(s+12),len=core.readUInt32LE(s+16);
    if(rva>=va&&rva+n<=va+len)return core.subarray(core.readUInt32LE(s+20)+rva-va,core.readUInt32LE(s+20)+rva-va+n);
  }
  throw Error('unmapped original bytes');
}
for(const p of [...PINS,...RELEASES])assert.equal(original(p.rva,p.hex.length/2).toString('hex'),p.hex);
assert.equal(0x3877e+original(0x38778,6).readInt32LE(2),0x38919);
assert.equal(original(0x38770,5).readUInt32LE(1),0x10daf3f0);
assert.equal(original(0x47538,6).toString('hex'),'ff1558f3da10');
assert.equal(0x4596d+original(0x45967,6).readInt32LE(2),0x47541);
assert.equal(0x27249+original(0x27243,6).readInt32LE(2),0x38766);
assert.equal(0x421d2+original(0x421d0,2).readInt8(1),0x421db);
for(const rva of [0x45c4a,0x46139,0x46606,0x46b04,0x46fb9,0x474e6])assert.equal(original(rva-2,2)[0],0x7f);
assert.equal(0x2652e+original(0x2652c,2).readInt8(1),CUTS.joined);
assert.equal(0x2658d+original(0x2658b,2).readInt8(1),CUTS.joined);
assert.equal(0x26552+original(0x26550,2).readInt8(1),CUTS.miss);
const le=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24&255];

async function physical() {
  const {e,memory}=globalThis.nativeFixtureAccess.get(),bytes=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer);
  const wa=a=>{const w=e.guest_to_wasm(a)>>>0;assert.notEqual(w,0xf0);return w;};
  const put=(a,b)=>bytes.set(b,wa(a)),u32=(a,v)=>dv.setUint32(wa(a),v>>>0,true),get=a=>e.guest_read32(a)>>>0;
  const exe=fs.readFileSync(path.join(ROOT,'test/binaries/notepad.exe'));
  bytes.set(exe,e.get_staging());assert(e.load_pe(exe.length));e.set_api_log(0);
  const options={workerSlot:0,softdrvSha256:SOFTDRV_SHA256,maxBoundaries:10000,maxRecords:128,maxMs:10000};
  const observer=new SoftDrvCacheObserver(e,options);observer.observe();assert.equal(observer.identity,null);
  bytes.set(core,e.get_staging());e.load_dll(core.length,workerData.relocated?0x1100000:0x900000);
  const idx=e.get_last_loaded_dll_index(),table=e.get_dll_table(),life=e.get_dll_lifecycle_table(),stride=e.get_dll_lifecycle_stride();
  const base=dv.getUint32(table+idx*32,true);assert.equal(dv.getUint32(life+idx*stride,true),1);
  const cache=0x1800000,item=cache+0x11000,sentinel=item+32,payload=item+0x1003,frame=cache+0x14000,caller=0x401800;
  // Synthetic cache, metadata, stack and caller are explicit fixture inputs.
  // No Core routine or original SoftDrv instruction is modified in parity arms.
  u32(cache,1);u32(cache+4,17);u32(cache+8,0x11223344);u32(cache+12,0x55667788);u32(cache+16,item);
  u32(item,0x11223344);u32(item+4,0x55667788);u32(item+8,payload);u32(item+12,0x80000003);
  u32(item+16,64);u32(item+20,sentinel);u32(sentinel+8,payload+2048);u32(sentinel+24,item);
  put(caller,[0xeb,0xfe]);put(caller+16,[0x0f,0x0b]);e.invalidate_code_range(caller,18);
  globalThis.nativeFixtureAccess.setOwner(workerData.observed?observer:null);
  let release;
  const slice=()=>new Promise((resolve,reject)=>{release={resolve,reject};parentPort.postMessage({t:'fixtureSliceRequest'});});
  workerData.port.on('message',m=>{if(m.t==='slice'){const r=release;release=null;m.message.trapped?r.reject(Error(m.message.trapped)):r.resolve(m.message.blocks);}});
  const state=()=>Object.fromEntries(['eip','esp','ebp','eax','ebx','ecx','edx','esi','edi','flag_op','flag_a','flag_b','flag_res','flag_sign_shift','yield_reason','last_run_blocks','last_run_halt'].map(n=>[n,e['get_'+n]()>>>0]));
  const traceDigest=crypto.createHash('sha256'),segments=[];let traceCount=0;
  async function execute(name,start,stop) {
    e.set_eip(start);let slices=0;const pcs=[];
    while(e.get_eip()>>>0!==stop&&slices<1000) {
      pcs.push((e.get_eip()>>>0)-base);
      let returned;try{returned=await slice();}catch(error){throw Error(JSON.stringify({name,pcs,state:state(),error:String(error)}));}
      traceDigest.update(JSON.stringify({returned,...state()})+'\n');slices++;traceCount++;
    }
    assert.equal(e.get_eip()>>>0,stop,JSON.stringify({name,state:state(),report:observer.report}));
    segments.push({name,slices,pcs,cost:get(item+16),memoryHash:H(bytes),state:state()});
  }
  function acquire() {e.set_ebp(frame);e.set_esp(frame-64);e.set_ecx(cache);e.set_edx(0x11223344);e.set_edi(0x55667788);e.set_ebx(8);e.set_eax(item);}
  acquire();await execute('hash-hit',base+0x2654e,base+CUTS.joined);assert.equal(get(item+16),0x1000040);assert.equal(get(item+12),0x80000011);
  acquire();e.set_eax(0x11223344);await execute('fast-hit',base+0x26506,base+CUTS.joined);assert.equal(get(item+16),0x2000040);
  function releaseFrame() {
    e.set_ebp(frame);e.set_esp(frame-32);u32(frame-20,item);u32(frame-12,0);u32(frame,0x123456);u32(frame+4,caller);
    for(const [offset,n] of [[-32,0x1111],[-28,0x2222],[-24,0x3333]])u32(frame+offset,n);
  }
  releaseFrame();await execute('release-still-locked',base+CUTS.release,caller);assert.equal(get(item+16),0x1000040);
  releaseFrame();await execute('release-unlocked',base+CUTS.release,caller);assert.equal(get(item+16),64);
  for(const c of RELEASES.slice(1))for(const branch of c.posts?[false,true]:[false]) {
    releaseFrame();e.set_esp(frame-32-(c.stackAdjust??0));u32(frame+c.itemOffset,item);u32(item+16,0x1000040);
    // The continuation block reads a relocated import data slot, not the item.
    if(c.posts){u32(base+0xaf3f0,cache+128);u32(cache+128,branch?0:1);}
    if(c.stackAdjust){
      // Original indirect CALL plus synthetic external RET establishes the
      // actual decoder return landing before the interior release at 47541.
      put(caller+32,[0xc3]);e.invalidate_code_range(caller+32,1);u32(base+0xaf358,caller+32);
      await execute('release-call-return-boundary',base+0x47538,base+c.rva);
    }
    const stop=c.posts?base+c.posts[branch?1:0]:caller;
    await execute('release-'+c.rva.toString(16)+(c.posts?'-'+branch:''),base+c.rva,stop);
    assert.deepEqual(segments.at(-1).pcs,c.stackAdjust?[0x4753e,0x47541]:[c.rva]);
    assert.equal(get(item+16),64);
    assert.equal(e.get_esp()>>>0,c.posts?frame-32:frame+8+c.pop);
    assert.equal(e.get_ebp()>>>0,c.posts?frame:0x123456);
  }
  assert.equal(get(item),0x11223344);assert.equal(get(item+4),0x55667788);assert.equal(get(item+20),sentinel);
  e.set_ebp(frame);e.set_esp(frame-64);e.set_eax(0);
  await execute('failed-lookup',base+0x2654e,base+CUTS.missed);assert.equal(e.get_eax()>>>0,0);assert.equal(get(frame-20),item);
  const before=H(bytes),beforeState=state();observer.observe();observer.observe();assert.equal(H(bytes),before);assert.deepEqual(state(),beforeState);
  const observation=observer.finish('fixture-end');
  if(workerData.observed) {
    assert.equal(observation.status,'fixture-end',JSON.stringify(observation));assert.equal(observation.inlinePending,null);
    assert.deepEqual(Object.fromEntries(Object.entries(observation.coverage).filter(([k])=>k!=='duplicates')),{acquisitions:2,releases:13,misses:1});
    const locks=observation.records.filter(r=>r.type==='inline-lock-acquired'||r.type==='inline-lock-released');
    assert.deepEqual(locks.map(r=>r.item.cost),[0x1000040,0x2000040,0x1000040,64,...Array(11).fill(64)]);
    assert(locks.filter(r=>r.kind==='release').every(r=>r.object===null&&r.history.includes('unknown')));
    assert(locks.every(r=>r.item.id64==='5566778811223344'&&r.item.metadata===item&&r.item.data===payload&&r.beforeSequence<r.sequence));
    assert(observation.records.every(r=>!r.type.includes('retir')&&!r.type.includes('invalid')));
    assert.equal(observation.records.find(r=>r.type==='inline-cache-miss').selectedItem,null);
  }
  // Negative fixture mutations are separate from all native parity snapshots.
  const negatives={},start=o=>new SoftDrvCacheObserver(e,{...options,...o});
  function unsupported(name,setup,pattern) {const h=start();setup(h);h.observe();assert.match(h.report.error,pattern);negatives[name]=h.report.error;return h;}
  for(const c of RELEASES) {
    const key=c.rva.toString(16),post=c.posts?base+c.posts[0]:caller;
    function pre() {releaseFrame();e.set_esp(frame-32-(c.stackAdjust??0));u32(frame+c.itemOffset,item);u32(item+16,0x1000040);e.set_eip(base+c.rva);}
    function postState() {e.set_eip(post);if(!c.posts){e.set_ebp(0x123456);e.set_esp(frame+8+c.pop);e.set_edi(0x1111);e.set_esi(0x2222);e.set_ebx(0x3333);e.set_ecx(0);e.set_eax(item);}}
    pre();unsupported(key+'-interior',()=>e.set_eip(base+c.rva+(c.stackAdjust?6:3)),/prior history/);
    pre();let n=start();n.observe();postState();n.observe();assert.match(n.report.error,/postcondition/);negatives[key+'-skipped']=n.report.error;
    for(const mode of ['frame','item','cost','bytes','caller',...(!c.posts?['savedEbp','epilogue']:[])]) {
      pre();n=start();n.observe();u32(item+16,64);postState();
      const saved=get(base+c.rva);
      if(mode==='frame')e.set_esp(e.get_esp()+4);
      if(mode==='item')u32(frame+c.itemOffset,sentinel);
      if(mode==='cost')u32(item+16,65);
      if(mode==='bytes')u32(base+c.rva,0);
      if(mode==='caller')e.set_eip(caller+32);
      if(mode==='savedEbp')e.set_ebp(0x123457);
      if(mode==='epilogue')e.set_edi(0x9999);
      n.observe();assert.equal(n.result?.status,'unsupported-or-unobservable',key+' '+mode);assert(n.result.inlinePending);
      negatives[key+'-'+mode]=n.report.error;u32(base+c.rva,saved);
    }
    pre();unsupported(key+'-unlocked',()=>u32(item+16,64),/positive lock/);
    pre();const saved=get(base+c.rva);unsupported(key+'-entryBytes',()=>u32(base+c.rva,0),/bytes changed/);u32(base+c.rva,saved);
    pre();unsupported(key+'-unmappedItem',()=>u32(frame+c.itemOffset,0xfffffff0),/unmapped|invalid read/);
    if(c.stackAdjust)for(const mode of ['stack','item','cost']){
      pre();n=start();n.observe();e.set_eip(base+0x47541);e.set_esp(frame-32);
      if(mode==='stack')e.set_esp(frame-36);
      if(mode==='item')u32(frame+24,sentinel);
      if(mode==='cost')u32(item+16,64);
      n.observe();assert.match(n.report.error,/cleanup postcondition/);negatives[key+'-cleanup-'+mode]=n.report.error;
    }
    if(!c.posts){pre();unsupported(key+'-internal',()=>u32(frame+4,base+0x1000),/internal release/);}
    pre();n=start();e.set_eip(post);n.observe();assert.equal(n.report.coverage.releases,0);negatives[key+'-missing']='no release event';
  }
  u32(item+16,64);
  e.set_eip(caller);let h=start();h.observe();assert(e.complete_dll_initialize(idx,dv.getUint32(life+idx*stride+4,true),3));h.observe();assert.equal(h.result,null);negatives.initializingToLive=true;
  h=start();h.observe();dv.setUint32(life+idx*stride+4,777,true);h.observe();assert.match(h.report.error,/reloaded/);negatives.reload=h.report.error;
  h=start();h.observe();dv.setUint32(life+idx*stride,0,true);h.observe();assert.match(h.report.error,/unloaded/);negatives.unload=h.report.error;dv.setUint32(life+idx*stride,2,true);
  const preferred=base+get(base+60)+52;
  unsupported('foreign',()=>u32(preferred,0x12340000),/foreign SoftDrv/);u32(preferred,0x10d00000);
  unsupported('thread',()=>e.set_current_thread_id(2),/foreign thread/);e.set_current_thread_id(1);
  h=start();assert.throws(()=>h.run({...e},1),/foreign instance/);negatives.instance=h.result.status;
  unsupported('missingHistory',()=>e.set_eip(base+CUTS.joined),/prior history missing/);
  unsupported('unlockedRelease',()=>{releaseFrame();e.set_eip(base+CUTS.release);},/positive lock/);
  acquire();e.set_edx(0x123456);unsupported('wrongId',()=>e.set_eip(base+CUTS.hit),/ID mismatch/);
  acquire();h=start();e.set_eip(base+CUTS.hit);h.observe();const postSaved=get(base+CUTS.hit);u32(base+CUTS.hit,0);
  e.set_eip(base+CUTS.joined);h.observe();assert.match(h.report.error,/bytes changed/);u32(base+CUTS.hit,postSaved);negatives.postBytes=h.report.error;
  acquire();h=start();e.set_eip(base+CUTS.hit);h.observe();assert(h.pending);e.set_eip(base+CUTS.joined);h.observe();assert.match(h.report.error,/postcondition/);negatives.skippedBlock=h.report.error;
  acquire();h=start();e.set_eip(base+CUTS.hit);h.observe();e.set_esp(frame-60);e.set_eip(base+CUTS.joined);h.observe();assert.match(h.report.error,/frame\/stack/);negatives.frame=h.report.error;
  acquire();const saved=get(base+CUTS.hit);u32(base+CUTS.hit,0);unsupported('bytes',()=>e.set_eip(base+CUTS.hit),/bytes changed/);u32(base+CUTS.hit,saved);
  acquire();e.set_eax(0xfffffff0);unsupported('unmapped',()=>e.set_eip(base+CUTS.hit),/unmapped|invalid read/);
  acquire();h=start();e.set_eip(base+CUTS.hit);h.observe();e.set_eip(caller);h.observe();assert.match(h.report.error,/mandatory post-boundary/);assert(h.result.inlinePending);negatives.abandoned=h.report.error;
  e.set_eip(caller);h=start();h.observe();assert.equal(h.report.coverage.releases,0);assert.equal(h.report.records.length,0);negatives.missingReleaseEntry='no release event';
  acquire();e.set_eip(caller);let clock=0;h=start({now:()=>clock,maxMs:1});clock=1;h.observe();assert.equal(h.result.status,'time-limit');negatives.time=h.result.status;
  h=start({maxBoundaries:1});h.observe();h.observe();assert.equal(h.result.status,'boundary-limit');negatives.boundaries=h.result.status;
  assert.throws(()=>start({softdrvSha256:'0'.repeat(64)}),/pin/);assert.throws(()=>start({maxRecords:1025}),/maxRecords/);
  acquire();h=start({maxRecords:1});e.set_eip(base+CUTS.hit);h.observe();u32(item+16,0x1000040);u32(item+12,0x80000011);e.set_eax((payload+7)&~7);e.set_eip(base+CUTS.joined);h.observe();assert.equal(h.result.status,'record-limit');assert.equal(h.report.coverage.acquisitions,0);assert(h.result.inlinePending);negatives.records=h.result.status;
  // Trap parity uses identical post-negative fixture state in both arms.
  const trapObserver=start();globalThis.nativeFixtureAccess.setOwner(workerData.observed?trapObserver:null);e.set_eip(caller+16);
  let trapped=false,trap;try{await slice();}catch(error){trapped=true;trap=String(error);}assert(trapped);
  if(workerData.observed)assert.equal(trapObserver.result.status,'guest-trap');
  const afterTrap={hash:H(bytes),state:state(),trap};
  parentPort.postMessage({pass:true,base,variant:workerData.variant,traceHash:traceDigest.digest('hex'),traceCount,segments,memoryHash:before,state:beforeState,afterTrap,observation,negatives,media:{path:media,sha256:SOFTDRV_SHA256},wasm:H(fs.readFileSync(path.join(ROOT,'build',workerData.variant)))});
}
if(!isMainThread) {
  const filename=path.join(ROOT,'lib/guest-worker.js'),Module=require('node:module'),entry=new Module(filename,module);
  entry.filename=filename;entry.paths=module.paths;
  entry._compile(fs.readFileSync(filename,'utf8')+'\n;globalThis.nativeFixtureAccess={get:()=>({e:instance.exports,memory}),setOwner:o=>{drawObserver=o;}};',filename);
  workerData.port.once('message',()=>physical().catch(error=>parentPort.postMessage({t:'fixtureFailure',error:error.stack})));
} else {
  async function one(observed,mode,relocated,variant) {
    const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),{port1,port2}=new MessageChannel();
    const sigs=require('../lib/host-import-sigs.generated.json').sigs;
    const broker=require('../lib/guest-rpc').createMainBroker(memory,Object.fromEntries(Object.keys(sigs).map(n=>[n,()=>{
      if(!['log','log_i32','beep_process_begin','beep_thread_begin'].includes(n))throw Error('unexpected broker '+n);return 0;
    }])),sigs);
    const wasm=await WebAssembly.compile(fs.readFileSync(path.join(ROOT,'build',variant)));
    const w=new Worker(__filename,{workerData:{port:port2,observed,mode,relocated,variant},transferList:[port2]});
    return new Promise((resolve,reject)=>{
      let seq=0;const commands=[];
      const finish=async(error,value)=>{clearTimeout(timer);await w.terminate();port1.close();error?reject(error):resolve(value);};
      const timer=setTimeout(()=>finish(Error('native transport timeout')),45000);
      w.on('error',error=>finish(error));
      w.on('message',m=>{
        if(m.t==='ready')port1.postMessage({t:'start'});
        else if(m.t==='rpc')broker.serveRpc(m.slot,m.waitEntry);
        else if(m.t==='call')broker.serveCall(m);
        else if(m.t==='calls')broker.serveCalls(m);
        else if(m.t==='fixtureSliceRequest') {const c={t:'slice',seq:++seq,steps:1};commands.push(c);w.postMessage(c);}
        else if(m.t==='sliceDone')port1.postMessage({t:'slice',message:m});
        else if(m.t==='fixtureFailure'||m.t==='error')finish(Error(JSON.stringify(m)));
        else if(m.pass)finish(null,{...m,commands:{count:commands.length,sha256:H(JSON.stringify(commands))}});
      });
      w.postMessage({t:'init',seq:0,module:wasm,memory,sigs,slot:0,endpointIdentity:1});
    });
  }
  (async()=>{
    const results=[];
    for(const variant of ['wine-assembly.wasm','wine-assembly.compat.wasm'])for(const relocated of [false,true]) {
      const control=await one(false,'block',relocated,variant),observed=await one(true,'block',relocated,variant);
      for(const key of ['traceHash','traceCount','memoryHash','state','afterTrap','commands','segments'])assert.deepEqual(observed[key],control[key],key);
      results.push({control,observed});console.log('PASS original SoftDrv blocks ordinary queued Worker whole-memory/register/flags/commands/trap parity',variant,observed.base.toString(16));
    }
    if(process.env.DEUSEX_SOFTDRV_RESULT)fs.writeFileSync(process.env.DEUSEX_SOFTDRV_RESULT,JSON.stringify({pass:true,fixtureOnly:true,results},null,2));
  })().catch(error=>{console.error(error);process.exitCode=1;});
}
