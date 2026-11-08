'use strict';
// Reuse the retained full loader driver's verified media/module inputs. Only
// its explicit cvar/file I/O hooks become small native fixture stubs, so the
// shipped NodeWorker can execute the original loader without register edits.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {Worker}=require('node:worker_threads');
const {hash}=require('./quake2-owning-load-witness.cjs');
const ROOT=path.resolve(__dirname,'..');
const driver='scratch/runs/20261108-quake2-native-cmodel-binding-2205/native-load-use.cjs';
const original=fs.readFileSync(path.join(ROOT,driver),'utf8');
assert.equal(hash(original),'e6fde32e696e4b544eb188fef2380372f5884a3f68a07754a7e6fe7e0446c186');
const Module=require('node:module'),inputModule=new Module(path.join(ROOT,driver),module);
inputModule.filename=path.join(ROOT,driver);inputModule.paths=module.paths;
inputModule._compile(original.slice(0,original.indexOf('const memory='))+'\nmodule.exports={exe,bsp};',inputModule.filename);
const {exe,bsp}=inputModule.exports;
const cpu=fs.readFileSync(path.join(ROOT,'build/wine-assembly.wasm'));
const sigs=require('../lib/host-import-sigs.generated.json').sigs;
const u32=n=>{const b=Buffer.alloc(4);b.writeUInt32LE(n>>>0);return [...b];};
async function fixture(enabled,scenario) {
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const mem=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer),wa=a=>a-0x400000+0x12000;
  const put=(a,v)=>dv.setUint32(wa(a),v>>>0,true),get=a=>dv.getUint32(wa(a),true);
  const copy=(a,b)=>mem.set(b,wa(a));
  for(const s of exe.sections)copy(s.va,exe.buf.subarray(s.rawOff,s.rawOff+s.rawSize));
  const sp=0x7408000,source=0xc00000,name=0x1000000,out=0x1000100,cv=0x1000200;
  const reads=0x1000300,frees=reads+4,freedPointer=reads+8,caller=0x1004000,stop=0x1100000,wrong=0x1100010;
  assert(source+bsp.length<name);copy(source,bsp);copy(name,Buffer.from('maps/demo1.bsp\0'));
  if(scenario==='nativeFailure')put(source+4,0); // original version check calls Com_Error
  if(scenario==='postFree')copy(0x411b90,[0xeb,0xfe]);
  copy(0x4137a0,[0x0f,0x0b]); // explicit failing error boundary; original error branch executes
  // Same authored cvar/get/load/free boundaries as the accepted driver.
  copy(0x416310,scenario==='reset'||scenario==='wrongOwner'||scenario==='failed'||scenario==='unrelatedReturn'?[0xeb,0xfe]:[0xb8,...u32(cv),0xc3]);
  copy(0x4161b0,[0x6a,0,0xd9,0x04,0x24,0x83,0xc4,4,0xc3]); // genuine x87 zero
  copy(0x416e70,[0xff,0x05,...u32(reads),0x8b,0x44,0x24,8,0xc7,0,...u32(source),
    ...(scenario==='wrongTarget'?[0xc7,0x84,0x24,...u32(0xbc),...u32(wrong)]:[]),
    0xb8,...u32(bsp.length),0xc3]);
  copy(0x416ef0,scenario==='interrupted'?[0xeb,0xfe]:[0xff,0x05,...u32(frees),0x8b,0x44,0x24,4,0xa3,...u32(freedPointer),0xc3]);
  copy(stop,[0xeb,0xfe]);copy(wrong,[0xeb,0xfe]);
  let code=[],targets=[];
  const emit=(...v)=>code.push(...v);
  const call=target=>{const at=caller+code.length;emit(0xe8,...u32(target-at-5));};
  call(0x423350); // unchanged original endian initialization
  function load(client=0){emit(0x68,...u32(out),0x6a,client,0x68,...u32(name));call(0x4117b0);targets.push(caller+code.length);emit(0x83,0xc4,12);}
  load();if(scenario==='freshCache'||scenario==='cacheClient')load(scenario==='cacheClient'?1:0);
  emit(0xe9,...u32(stop-(caller+code.length+5)));copy(caller,code);
  const w=new Worker(path.join(ROOT,'lib/guest-worker.js'));
  let seq=0,pending,failure;
  const lifecycle={deadlineArmedBeforeInit:true};
  const deadline=setTimeout(()=>{failure=Error('native loader Worker deadline');pending?.reject(failure);void w.terminate();},60000);
  const broker=require('../lib/guest-rpc').createMainBroker(memory,new Proxy({}, {get:(_,name)=>()=>{if(String(name).startsWith('beep_'))return 0;throw Error('unexpected fixture broker import '+String(name));}}),sigs);
  w.on('message',m=>{
    if(m.t==='rpc')return broker.serveRpc(m.slot,m.waitEntry);
    if(m.t==='call')return broker.serveCall(m);
    if(m.t==='calls')return broker.serveCalls(m);
    if(pending&&(m.seq===pending.seq||m.t==='ready')){const p=pending;pending=null;m.t==='error'?p.reject(Error(JSON.stringify(m))):p.resolve(m);}
  });
  w.on('error',e=>{failure=e;pending?.reject(e);});
  const command=m=>new Promise((resolve,reject)=>{if(failure)return reject(failure);assert(!pending);pending={resolve,reject,seq:++seq};w.postMessage({...m,seq});});
  const exported=(name,...args)=>command({t:'callExport',name,args});
  const state=async(final=false)=>(await command({t:'readExports',names:['get_eip','get_esp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_ebp','get_yield_reason',...(final?['get_flag_op','get_flag_a','get_flag_b','get_flag_res']:[])]})).values;
  const snapshot=async()=>(await command({t:'quake2LoadObservation'}));
  let result;
  try {
    const mod=await WebAssembly.compile(cpu);
    await command({t:'init',module:mod,memory,sigs,slot:0,endpointIdentity:2320,quake2LoadObservation:enabled});
    await exported('init_thread',0,0x400000,caller,caller+code.length,0,0,0,0);
    await exported('set_esp',sp);await exported('set_eip',caller);put(sp,stop);
    await exported('set_trace_esp',1,0x4117b0,scenario==='missingBoundary'?0x42f0f5:stop-1);
    let current,iterations=0,runError=null;
    const pause=['reset','wrongOwner','failed','unrelatedReturn'].includes(scenario)?0x416310:scenario==='interrupted'?0x416ef0:scenario==='postFree'?0x411b90:scenario==='wrongTarget'?wrong:stop;
    do {
      try {await exported('run',scenario==='runBoundary'?(iterations<14?100000:iterations<94?1000:1):100000);} catch(error) {if(scenario!=='nativeFailure')throw error;runError=error.message;break;}
      current=await state();
      assert(++iterations<10000,JSON.stringify(current));
    } while(current.get_eip!==pause);
    if(scenario==='nativeFailure')assert(runError,'original version-error path must fail execution');
    const before=await snapshot();
    if(scenario==='reset')await exported('init_thread',0,0x400000,caller,caller+code.length,0,0,0,0);
    if(scenario==='wrongOwner')await command({t:'init',module:await WebAssembly.compile(cpu),memory,sigs,slot:0,endpointIdentity:2321,quake2LoadObservation:enabled});
    if(scenario==='failed')await assert.rejects(exported('run',1n),/BigInt/);
    if(scenario==='unrelatedReturn') {await exported('run',100);assert.equal((await state()).get_eip,0x416310);}
    const status=await snapshot(),observation=scenario==='wrongOwner'?status.retiredObservation:status.observation;
    const returns=observation?.records.filter(r=>r.kind==='NATIVE_LOAD_RETURN');
    if(enabled) {
      assert.equal(observation.exactIdentity,'UNKNOWN');
      assert.equal(observation.coverage.allWriters,'UNKNOWN');assert.equal(observation.coverage.completedLoad,'UNKNOWN');
      assert.equal(returns.length,['freshCache','cacheClient'].includes(scenario)?2:scenario==='runBoundary'?1:0,JSON.stringify(observation));
      if(['freshCache','cacheClient','runBoundary'].includes(scenario)) {
        assert.equal(observation.validPointObservations,true);
        assert.deepEqual(returns.map(r=>r.path),scenario==='runBoundary'?['FRESH']:['FRESH','CACHE_NO_READ']);
        assert.deepEqual(returns.map(r=>r.returnTarget),targets);
        assert(returns.every(r=>r.sp===r.entrySp+4));
        assert.deepEqual(returns.map(r=>r.epilogue),scenario==='runBoundary'?[0x411a26]:[0x411a26,scenario==='cacheClient'?0x411a83:0x41185b]);
        if(scenario!=='runBoundary')assert.equal(returns[1].acquisitionRecord,null);
        else assert.equal(returns[0].boundary,'owning run boundary');
        assert.equal(observation.records[returns[0].acquisitionRecord].sha256,hash(bsp));
        assert.equal(observation.records.filter(r=>r.kind==='ACQUIRED_SOURCE').length,1);
      } else if(scenario==='reset'||scenario==='wrongOwner'||scenario==='failed'||scenario==='nativeFailure') {
        assert.equal(observation.validPointObservations,false);
        assert.match(observation.nativeCompletion.reason,/interrupted/);
        if(scenario==='nativeFailure'){assert.equal(observation.execution.failures,1);assert.equal(get(frees),0);}
      } else if(scenario==='wrongTarget')assert.match(observation.nativeCompletion.reason,/boundary missing/);
      else if(scenario==='missingBoundary')assert.match(observation.nativeCompletion.reason,/outside known/);
      else assert.equal(observation.nativeCompletion.pending,true);
      if(scenario==='postFree'){assert.equal(get(frees),1);assert.equal(get(freedPointer),source);}
    } else assert.equal(observation,null);
    if(['freshCache','cacheClient','runBoundary','missingBoundary','wrongTarget'].includes(scenario)) {
      assert.equal(get(reads),1);assert.equal(get(frees),1);assert.equal(get(freedPointer),source);
      assert.equal(get(out),0xbfd75753);assert.equal(get(0xa23f8c),35);
      // Retained original loader's complete independent cmodel conversion check.
      const bytes=mem,rd=get,count=get(0xa23f8c),mo=bsp.readUInt32LE(8+13*8);
      const begin=original.indexOf('for(let i=0;i<count;i++)'),end=original.indexOf('const pins=');
      eval(original.slice(begin,end));
    }
    result={scenario,before:before.observation,observation,state:await state(true),parityReadsAfterObservation:true,fileReads:get(reads),frees:get(frees),
      runError,guestHash:hash(mem.subarray(0x12000,0x8000000)),iterations,lifecycle};
    return result;
  } finally {
    clearTimeout(deadline);lifecycle.deadlineCleared=true;
    lifecycle.terminationCode=await w.terminate();lifecycle.terminationAwaited=true;lifecycle.threadIdAfter=w.threadId;
  }
}
(async()=>{
  const results=[];
  for(const scenario of (process.argv.slice(2).length?process.argv.slice(2):['cacheClient','postFree','runBoundary','nativeFailure','freshCache','interrupted','wrongTarget','missingBoundary','reset','wrongOwner','failed','unrelatedReturn'])) {
    const off=await fixture(false,scenario),on=await fixture(true,scenario);
    assert.deepEqual(on.state,off.state);assert.equal(on.guestHash,off.guestHash);
    assert.equal(!!on.runError,!!off.runError);assert.equal(on.fileReads,off.fileReads);assert.equal(on.frees,off.frees);
    results.push({scenario,off,on});
  }
  console.log(JSON.stringify({pass:true,driver:{path:driver,sha256:hash(original)},cpu:{path:'build/wine-assembly.wasm',sha256:hash(cpu)},results}));
})().catch(e=>{console.error(e);process.exitCode=1;});
