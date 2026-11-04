'use strict';
// Original Core instructions in the shipped queued Worker; no Engine/Draw.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {Worker,MessageChannel,isMainThread,parentPort,workerData}=require('node:worker_threads');
const {CORE_SHA256,METHODS,CUTS,StartupCacheObserver}=require('../lib/deusex-startup-cache-observer');
const ROOT=path.resolve(__dirname,'..'),H=b=>crypto.createHash('sha256').update(b).digest('hex');
const media='test/binaries/candidates/deus-ex-demo/installed/system/core.dll';
const core=fs.readFileSync(path.join(ROOT,media));assert.equal(H(core),CORE_SHA256);
const pe=core.readUInt32LE(60),sections=pe+24+core.readUInt16LE(pe+20);
function original(rva,n) {
  for(let i=0;i<core.readUInt16LE(pe+6);i++) {
    const s=sections+i*40,va=core.readUInt32LE(s+12),len=core.readUInt32LE(s+16);
    if(rva>=va&&rva+n<=va+len)return core.subarray(core.readUInt32LE(s+20)+rva-va,core.readUInt32LE(s+20)+rva-va+n);
  }
  throw Error('unmapped original bytes');
}
// JGE +0x7b at 24ca1 reaches locked 24d1e. Fallthrough 24ca3
// executes all three clear stores before JE reaches 24cdc or falls to 24cb2.
const clearBlock='8b4610897dfc3d000000017d7b8b4618893e3bc7897e04897e10742a';
assert.equal(original(CUTS.decision,clearBlock.length/2).toString('hex'),clearBlock);
assert.equal(CUTS.decision+11+2+0x7b,CUTS.locked);
assert.equal(CUTS.decision+clearBlock.length/2,CUTS.afterClearPrevious);
assert.equal(CUTS.afterClearPrevious+0x2a,CUTS.afterClearNext);
const le=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24&255];
async function physical() {
  const {e,memory}=globalThis.nativeFixtureAccess.get(),bytes=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer);
  const wa=a=>{const w=e.guest_to_wasm(a)>>>0;assert.notEqual(w,0xf0);return w;};
  const put=(a,b)=>bytes.set(b,wa(a)),u32=(a,v)=>dv.setUint32(wa(a),v>>>0,true),get=a=>e.guest_read32(a)>>>0;
  const exe=fs.readFileSync(path.join(ROOT,'test/binaries/notepad.exe'));
  bytes.set(exe,e.get_staging());assert(e.load_pe(exe.length));e.set_api_log(0);
  // Attach with Core absent, then observe its INITIALIZING state. No fake Engine.
  const options={workerSlot:0,coreSha256:CORE_SHA256,maxBoundaries:1000000,maxRecords:256,maxMs:10000};
  const observer=new StartupCacheObserver(e,options);
  observer.observe();assert.equal(observer.identity,null);
  bytes.set(core,e.get_staging());e.load_dll(core.length,workerData.relocated?0x1100000:0x900000);
  const idx=e.get_last_loaded_dll_index(),table=e.get_dll_table(),life=e.get_dll_lifecycle_table(),stride=e.get_dll_lifecycle_stride();
  const base=dv.getUint32(table+idx*32,true);assert.equal(dv.getUint32(life+idx*stride,true),1);
  assert.equal(e.get_dll_count(),1);
  const cache=0x1800000,item=cache+0x11000,payload=item+0x1000,out=cache+0x13000,stack=cache+0x14000;
  // Synthetic allocator dependency returns existing metadata storage. Original
  // Init owns all cache/physical/free-list initialization. Core code untouched.
  const allocator=cache+0x15000,vtable=allocator+32,stub=0x401900;
  u32(base+0xa7c44,allocator);u32(allocator,vtable);u32(vtable,stub);
  put(stub,[0xb8,...le(item),0xc2,8,0]);
  u32(out+12,item); // native failed Get must leave this stale reference intact.
  const callerStart=0x401100,caller=0x401800,route=[];
  const contracts=[...METHODS,{name:'Unlock',rva:0x168a0,args:0},{name:'Flush',rva:0x25290,args:4},{name:'Get',rva:0x16a70,args:4}];
  function call(name,thisPointer,args) {
    for(const a of args.slice().reverse())route.push(0x68,...le(a));
    route.push(0xb9,...le(thisPointer),0xb8,...le(base+contracts.find(c=>c.name===name).rva),0xff,0xd0);
  }
  call('Init',cache,[256,8,payload,0]);
  call('Create',cache,[0x11223344,0x55667788,out,64,1,0]);
  // Locked FlushItem flag=1 must neither clear nor coalesce.
  call('FlushItem',cache,[item,1]);
  call('Create',cache,[0xabcdef01,0x12345678,out+4,64,1,0]);
  call('Unlock',item,[]);call('Unlock',item+64,[]);
  call('Flush',cache,[0x11223344,0x55667788,0xffffffff,0]);
  call('Flush',cache,[0xabcdef01,0x12345678,0xffffffff,0]);
  // Both neighboring free spans coalesce, metadata then splits/recycles.
  call('Create',cache,[0x11223344,0x55667788,out+8,64,1,0]);
  call('Get',cache,[0xdeadbeef,0x76543210,out+12,1]); // failed lookup
  route.push(0xa3,...le(out+16)); // preserve real native return, no callbacks
  route.push(0xe9,...le(caller-(callerStart+route.length)-5));
  assert(route.length<0x700);put(callerStart,route);put(caller,[0xeb,0xfe]);put(caller+16,[0x0f,0x0b]);
  e.invalidate_code_range(callerStart,0x810);e.set_esp(stack);e.set_eip(callerStart);
  // Control uses the shipped Worker's ordinary ex.run(1) path with no adapter.
  // Only the observed arm installs the library in the local slice seam.
  globalThis.nativeFixtureAccess.setOwner(workerData.observed?observer:null);
  let release;
  const slice=()=>new Promise((resolve,reject)=>{release={resolve,reject};parentPort.postMessage({t:'fixtureSliceRequest'});});
  workerData.port.on('message',m=>{if(m.t==='slice'){const r=release;release=null;m.message.trapped?r.reject(Error(m.message.trapped)):r.resolve(m.message.blocks);}});
  const state=()=>Object.fromEntries(['eip','esp','ebp','eax','ebx','ecx','edx','esi','edi','flag_op','flag_a','flag_b','flag_res','flag_sign_shift','yield_reason','last_run_blocks','last_run_halt'].map(n=>[n,e['get_'+n]()>>>0]));
  const trace=[],traceDigest=crypto.createHash('sha256');let traceCount=0;
  for(let i=0;i<200000&&e.get_eip()>>>0!==caller;i++) {const returned=await slice(),row={returned,...state()};traceDigest.update(JSON.stringify(row)+'\n');traceCount++;trace.push(row);if(trace.length>16)trace.shift();if(!e.get_eip())break;}
  assert.equal(e.get_eip()>>>0,caller,JSON.stringify({state:state(),report:observer.report,tail:trace.slice(-10)}));
  assert.equal(get(cache),1);assert.equal(get(out),item);assert.equal(get(out+4),item+64);assert.equal(get(out+8),item);
  assert.equal(get(out+12),item);assert.equal(get(out+16),0);
  const before=H(bytes),beforeState=state();observer.observe();observer.observe();assert.equal(H(bytes),before);assert.deepEqual(state(),beforeState);
  const observation=observer.finish('fixture-end');
  if(workerData.observed) {
    assert.equal(observation.status,'fixture-end',JSON.stringify(observation));assert.equal(observation.pending.length,0);
    assert.equal(observation.coverage.initEntries,1);assert.equal(observation.coverage.initReturns,1);
    assert.equal(observation.coverage.clears,2);assert.equal(observation.coverage.locked,1);
    assert.equal(observation.records.find(r=>r.type==='method-entry'&&r.name==='Init').initializedBefore,0);
    const clears=observation.records.filter(r=>r.type==='id-cleared-before-coalesce');
    assert.deepEqual(clears.map(r=>r.before.id64),['5566778811223344','12345678abcdef01']);
    assert(clears.every(r=>r.beforeSequence<r.sequence&&r.item.id64==='0000000000000000'&&r.item.range));
    for(const r of clears) {
      const pre=observation.records.find(p=>p.sequence===r.beforeSequence);
      assert.equal(pre.pc,base+CUTS.beforeClear);
      assert([base+CUTS.afterClearPrevious,base+CUTS.afterClearNext].includes(r.pc));
      assert.equal(pre.esp,r.esp);assert.equal(pre.object,cache);assert.equal(r.object,cache);
    }
    const creates=observation.records.filter(r=>r.type==='method-return'&&r.name==='Create');
    assert.deepEqual(creates.map(r=>r.cache.items.length),[3,4,3]);
    const flushes=observation.records.filter(r=>r.type==='method-return'&&r.name==='FlushItem');
    assert.deepEqual(flushes.map(r=>r.cache.items.length),[3,4,2]);
    assert.equal(creates[2].cache.items[1].metadata,item+96); // recycled split record
    assert.equal(creates[0].cache.items[0].id64,creates[2].cache.items[0].id64); // same ID/address reuse
    assert(observation.records.some(r=>r.name==='CreateNewFreeSpace'));
  }
  // Transition INITIALIZING -> LIVE is permitted, generation reuse is not.
  const negatives={};
  const start=o=>new StartupCacheObserver(e,{...options,...o});
  let h=start();h.observe();assert(e.complete_dll_initialize(idx,dv.getUint32(life+idx*stride+4,true),3));h.observe();assert.equal(h.result,null);negatives.initializingToLive=true;
  dv.setUint32(life+idx*stride+4,777,true);h.observe();assert.equal(h.result.status,'unsupported-or-unobservable');negatives.reload=h.report.error;
  h=start();e.set_current_thread_id(2);h.observe();e.set_current_thread_id(1);assert.match(h.report.error,/foreign thread/);negatives.thread=h.report.error;
  h=start();assert.throws(()=>h.run({...e},1),/foreign instance/);negatives.instance=h.result.status;
  const preferred=base+get(base+60)+52;
  h=start();u32(preferred,0x12340000);h.observe();assert.match(h.report.error,/foreign Core/);u32(preferred,0x10100000);negatives.foreign=h.report.error;
  let clock=0;h=start({now:()=>clock,maxMs:1});clock=1;h.observe();assert.equal(h.result.status,'time-limit');negatives.time=h.result.status;
  h=start({maxBoundaries:1});h.observe();h.observe();assert.equal(h.result.status,'boundary-limit');negatives.boundaries=h.result.status;
  assert.throws(()=>start({coreSha256:'0'.repeat(64)}),/pin/);assert.throws(()=>start({maxRecords:1025}),/maxRecords/);
  e.set_eip(base+METHODS[0].rva);e.set_ecx(cache);e.set_esp(stack);u32(stack,caller);
  h=start({maxRecords:1});h.observe();e.set_eip(caller);e.set_esp(stack+20);h.observe();assert.equal(h.result.status,'record-limit');negatives.records=h.result.status;
  e.set_eip(base+METHODS[0].rva);e.set_esp(stack);
  h=start();h.observe();e.set_eip(caller);e.set_esp(stack+16);h.observe();assert.match(h.report.error,/return stack mismatch/);negatives.stack=h.report.error;
  e.set_eip(base+CUTS.beforeClear);h=start();h.observe();assert.equal(h.report.coverage.clears,0);assert.equal(h.report.records.length,0);negatives.missingEntry='no clear event';
  e.set_eip(base+0x24c70);e.set_ecx(cache);e.set_esp(stack);u32(stack+4,item);u32(stack+8,1);
  h=start();h.observe();e.set_eip(base+CUTS.afterClearPrevious);e.set_ebp(stack-4);h.observe();assert.match(h.report.error,/pre-boundary missing/);negatives.missingPre=h.report.error;
  e.set_eip(caller);e.set_esp(stack);
  h=start();h.observe();dv.setUint32(life+idx*stride,0,true);h.observe();assert.match(h.report.error,/unloaded/);dv.setUint32(life+idx*stride,2,true);negatives.unload=h.report.error;
  // Original exception propagates through an active library run adapter.
  const trapObserver=start();globalThis.nativeFixtureAccess.setOwner(workerData.observed?trapObserver:null);
  e.set_eip(caller+16);
  let trapped=false;try{await slice();}catch(_){trapped=true;}assert(trapped);
  if(workerData.observed)assert.equal(trapObserver.result.status,'guest-trap');
  const afterTrap={hash:H(bytes),state:state()};
  parentPort.postMessage({pass:true,mode:workerData.mode,base,trace,traceHash:traceDigest.digest('hex'),traceCount,memoryHash:before,state:beforeState,afterTrap,observation,negatives,media:{path:media,sha256:CORE_SHA256},wasm:H(fs.readFileSync(path.join(ROOT,'build/wine-assembly.wasm')))});
}
if(!isMainThread) {
  const filename=path.join(ROOT,'lib/guest-worker.js'),Module=require('node:module'),entry=new Module(filename,module);
  entry.filename=filename;entry.paths=module.paths;
  entry._compile(fs.readFileSync(filename,'utf8')+'\n;globalThis.nativeFixtureAccess={get:()=>({e:instance.exports,memory}),setOwner:o=>{drawObserver=o;}};',filename);
  workerData.port.once('message',()=>physical().catch(error=>parentPort.postMessage({t:'fixtureFailure',error:error.stack})));
} else {
  async function one(observed,mode,relocated) {
    const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),{port1,port2}=new MessageChannel();
    const sigs=require('../lib/host-import-sigs.generated.json').sigs;
    const broker=require('../lib/guest-rpc').createMainBroker(memory,Object.fromEntries(Object.keys(sigs).map(n=>[n,()=>{
      if(!['log','log_i32','beep_process_begin','beep_thread_begin'].includes(n))throw Error('unexpected broker '+n);return 0;
    }])),sigs);
    const wasm=await WebAssembly.compile(fs.readFileSync(path.join(ROOT,'build/wine-assembly.wasm')));
    const w=new Worker(__filename,{workerData:{port:port2,observed,mode,relocated},transferList:[port2]});
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
    for(const mode of ['block'])for(const relocated of [false,true]) {
      const control=await one(false,mode,relocated),observed=await one(true,mode,relocated);
      assert.deepEqual(observed.trace,control.trace);assert.equal(observed.traceHash,control.traceHash);assert.equal(observed.traceCount,control.traceCount);assert.equal(observed.memoryHash,control.memoryHash);
      assert.deepEqual(observed.state,control.state);assert.deepEqual(observed.afterTrap,control.afterTrap);
      assert.deepEqual(observed.commands,control.commands);
      results.push({control,observed});console.log('PASS original Init and FlushItem clear CFG, queued shipped Worker, whole-memory/state/return/trap parity',mode,observed.base.toString(16));
    }
    if(process.env.DEUSEX_STARTUP_RESULT)fs.writeFileSync(process.env.DEUSEX_STARTUP_RESULT,JSON.stringify({pass:true,fixtureOnly:true,results},null,2));
  })().catch(error=>{console.error(error);process.exitCode=1;});
}
