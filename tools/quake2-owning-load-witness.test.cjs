'use strict';
// Reuse accepted original-native controls, adding the real production import
// attachment. No game startup or copied media/module. All I/O/cvar/link fixture
// boundaries and init_thread resets remain visible in the referenced script.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {Worker,isMainThread,parentPort,workerData}=require('node:worker_threads');
const api=require('./quake2-owning-load-witness.cjs');
const ROOT=path.resolve(__dirname,'..');
const ORIGINAL=path.join(ROOT,'scratch/runs/20261108-quake2-native-cmodel-binding-2205/native-load-use.cjs');
const original=fs.readFileSync(ORIGINAL,'utf8');
const originalSHA=api.hash(original);
assert.equal(originalSHA,'e6fde32e696e4b544eb188fef2380372f5884a3f68a07754a7e6fe7e0446c186');
async function fixture(mode,enabled) {
  const Module=require('node:module'),m=new Module(ORIGINAL,module);
  m.filename=ORIGINAL;m.paths=module.paths;
  let source=original.replace("const e=new WebAssembly.Instance(mod,imports).exports;",`
    const enabled=${enabled};
    let observation=null;
    let e;
    const ctx={getMemory:()=>memory.buffer,quake2LoadObservation:enabled};
    const built=${mode==='host'?`require('../../../lib/host-imports').createHostImports(ctx)`:
      `require('../../../lib/guest-rpc').createWorkerImports(memory,require('../../../lib/host-import-sigs.generated.json').sigs,
        ()=>{throw Error('unexpected broker call');},{quake2LoadObservation:enabled,getExports:()=>e,
        onQuake2LoadObservation:s=>observation=s})`};
    let activeBlock=${mode==='host'?'built.host.log_block':'built.imports.host.log_block'};
    imports.host.log_block=(...args)=>activeBlock(...args);
    e=new WebAssembly.Instance(mod,imports).exports;ctx.exports=e;
    ${mode==='host'?'observation=ctx.quake2LoadObservationSnapshot;':''}
    e.set_trace_esp(1,0x4117b0,0x42f0f5);
  `);
  assert.notEqual(source,original);
  // Preserve the accepted native assertions and return a bounded result only.
  source+=`
    const result=observation?.()||null;
    const state=Object.fromEntries(['eip','esp','ebp','eax','ebx','ecx','edx','esi','edi','flag_op','flag_a','flag_b','flag_res','yield_reason']
      .map(k=>[k,e['get_'+k]()>>>0]));
    globalThis.quake2FixtureResult={result,state,guestHash:sha(bytes.subarray(0x12000,0x8000000)),fileReads,frees};
    if(enabled){
      assert.equal(result.exactIdentity,'UNKNOWN');assert.equal(result.validPointObservations,true,JSON.stringify(result));
      const acquisitions=result.records.filter(r=>r.kind==='ACQUIRED_SOURCE');
      assert.deepEqual(acquisitions.map(r=>r.sha256),[sha(bsp),sha(altered)]);
      assert.deepEqual(acquisitions.map(r=>r.length),[bsp.length,bsp.length]);
      const uses=result.records.filter(r=>r.kind==='HEADNODE_USE_ENTRY');
      assert.deepEqual(uses.map(r=>r.candidateHeadnode),[4948,4942,4942]);
      assert.deepEqual(result.records.filter(r=>r.kind==='HEADNODE_READ_BLOCK').map(r=>r.candidateHeadnode),[4948,4942,4942]);
      assert.equal(result.records.filter(r=>r.kind==='LOAD_ENTRY').length,3);
      // Missing observation coverage, init_thread resets, cache and fresh
      // reloads never produce a later exact-source certificate.
      e.set_trace_esp(0,0,0);call(0x42f0b0,[ent]);
      assert.equal(observation().exactIdentity,'UNKNOWN');
      const before=observation().records.length;
      e.init_thread(0,0x400000,0x42f0b0,0x42f0b1,0,0,0,0);
      assert.equal(observation().exactIdentity,'UNKNOWN');assert.equal(observation().records.length,before);
      // Actual code replacement and actual memory/owner loss reject points.
      e.set_trace_esp(1,0x4117b0,0x42f0f5);
      bytes[wa(0x42f0b0)]^=1;
      // Detect before decoding the replaced instruction; other pinned body
      // is used as an actual safe execution entry.
      call(0x4117b0,[name,0,out]);
      assert.equal(observation().validPointObservations,false);
      assert.match(observation().reason,/body replaced/);
      const negatives={code:observation().reason};
      bytes[wa(0x42f0b0)]^=1;
      const {attach}=require('../../../tools/quake2-owning-load-witness.cjs');
      let ownerRef=e,bufferRef=memory.buffer;
      const fresh=()=>{
        const x=attach({getExports:()=>ownerRef,getMemory:()=>bufferRef});activeBlock=x.block;return x;
      };
      const point=(pc=0x4117b0)=>{
        e.init_thread(0,0x400000,pc,pc+1,0,0,0,0);e.set_trace_esp(1,0,0);
        e.set_esp(stack);e.set_eip(pc);e.run(1);
      };
      const rejected=(key,x,pattern)=>{
        const r=x.snapshot();assert.equal(r.exactIdentity,'UNKNOWN');assert.equal(r.validPointObservations,false);
        assert.match(r.reason,pattern);negatives[key]=r.reason;
      };
      let x=fresh();point();
      const exposed=x.snapshot();exposed.pins[0].sha256='forged';exposed.records[0].kind='forged';
      assert.notEqual(x.snapshot().pins[0].sha256,'forged');assert.notEqual(x.snapshot().records[0].kind,'forged');
      ownerRef=null;point();rejected('missing-owner',x,/missing owning/);ownerRef=e;
      x=fresh();point();ownerRef=new WebAssembly.Instance(mod,imports).exports;
      point();rejected('replaced-owner',x,/instance.*replaced/);ownerRef=e;
      x=fresh();point();bufferRef=new WebAssembly.Memory({initial:1}).buffer;
      point();rejected('replaced-memory',x,/memory replaced/);bufferRef=memory.buffer;
      x=fresh();point();bufferRef=null;point();rejected('missing-memory',x,/missing owning/);bufferRef=memory.buffer;
      x=fresh();
      e.init_thread(0,0x500000,0x5117b0,0x5117b1,0,0,0,0);e.set_trace_esp(1,0,0);
      e.set_esp(stack+0x100000);e.set_eip(0x5117b0);e.run(1);
      rejected('different-base',x,/different module base/);
      e.init_thread(0,0x400000,0x4118d9,0x4118da,0,0,0,0);
      for(const [key,pointer,length,pattern] of [
        ['unmapped-source',0x70000000,160,/unmapped/],
        ['overflow-source',0xfffffff0,160,/bounded/],
        ['oversized-source',source,4194305,/bounded/],
        ['short-source',source,0,/invalid BSP/],
      ]){
        x=fresh();wr(stack+12,pointer);e.set_esi(length);point(0x4118d9);rejected(key,x,pattern);
      }
      x=fresh();for(let i=0;i<33;i++)point();rejected('record-bound',x,/bounded observation/);
      globalThis.quake2FixtureResult.negatives=negatives;
    }
  `;
  const log=console.log;console.log=()=>{};
  const start=process.hrtime.bigint();
  try{m._compile(source,ORIGINAL);}finally{console.log=log;}
  return {...globalThis.quake2FixtureResult,wallNs:(process.hrtime.bigint()-start).toString()};
}
async function queuedWorker(enabled) {
  // Unmodified shipped Worker, real command queue and local log_block import.
  // Small point fixture: native branch after mocked acquisition, then genuine
  // edict/table/headnode instructions. Full native loads above are reused.
  const {readPE}=require('../lib/pe');
  const pe=readPE(path.join(ROOT,api.EXE));
  const bytes=fs.readFileSync(path.join(ROOT,'build/wine-assembly.wasm'));
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const mem=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer),wa=a=>a-0x400000+0x12000;
  const put=(a,v)=>dv.setUint32(wa(a),v>>>0,true);
  for(const s of pe.sections)mem.set(pe.buf.subarray(s.rawOff,s.rawOff+s.rawSize),wa(s.va));
  const sp=0x7408000,source=0xc00000,edict=0x1001000,pointer=0x6d80c0;
  mem.fill(0x65,wa(source),wa(source)+160);put(sp+12,source);
  put(sp+4,edict);put(edict+0x28,21);put(edict+0xf8,3);put(0x47b554+21*4,pointer);put(pointer+36,4948);
  const sigs=require('../lib/host-import-sigs.generated.json').sigs;
  const broker=require('../lib/guest-rpc').createMainBroker(memory,new Proxy({}, {get:()=>()=>0}),sigs);
  const module=await WebAssembly.compile(bytes);
  const w=new Worker(path.join(ROOT,'lib/guest-worker.js'));
  let sequence=0,pending,failed;
  const watchdog=setTimeout(()=>{failed=Error('queued production fixture deadline');pending?.reject(failed);void w.terminate();},60000);
  w.on('message',m=>{
    if(m.t==='rpc')return broker.serveRpc(m.slot,m.waitEntry);
    if(m.t==='call')return broker.serveCall(m);
    if(m.t==='calls')return broker.serveCalls(m);
    if(pending&&(m.seq===pending.seq||m.t==='ready')){
      const p=pending;pending=null;m.t==='error'?p.reject(Error(JSON.stringify(m))):p.resolve(m);
    }
  });
  w.on('error',e=>{failed=e;pending?.reject(e);});
  const command=msg=>new Promise((resolve,reject)=>{if(failed)return reject(failed);assert(!pending);pending={resolve,reject,seq:++sequence};w.postMessage({...msg,seq:sequence});});
  const call=(name,...args)=>command({t:'callExport',name,args});
  try{
    await command({t:'init',module,memory,sigs,slot:0,endpointIdentity:2244,quake2LoadObservation:enabled});
    await call('init_thread',0,0x400000,0x401000,0x440000,0,0,0,0);
    await call('set_trace_esp',1,0x4117b0,0x42f0f5);
    await call('set_esp',sp);await call('set_esi',160);await call('set_eax',source);await call('set_ebx',0);
    // Native CMP/JNE actually chooses the post-read acquisition path.
    await call('set_eip',0x4118c5);await call('run',1);await call('run',1);
    const acquired=(await command({t:'quake2LoadObservation'})).observation;
    if(enabled){assert.equal(acquired.records.length,1);assert.equal(acquired.records[0].sha256,api.hash(Buffer.alloc(160,0x65)));}
    else assert.equal(acquired,null);
    await call('set_eip',0x42f0b0);await call('set_esp',sp);
    // Original use completes to the synthetic return sentinel through real RET.
    put(sp,0x1100000);
    for(let i=0;i<3;i++)await call('run',1);
    const state=(await command({t:'readExports',names:['get_eip','get_eax','get_esp']})).values;
    assert.equal(state.get_eax,4948);assert.equal(state.get_eip,0x1100000);
    const observation=(await command({t:'quake2LoadObservation'})).observation;
    if(enabled){assert.equal(observation.records[1].candidateHeadnode,4948);
      assert.equal(observation.records[2].kind,'HEADNODE_READ_BLOCK');assert.equal(observation.records[2].pointer,pointer);
      assert.equal(observation.exactIdentity,'UNKNOWN');}
    // Disarm trace, reset same instance, reinit Worker: all later identity is
    // UNKNOWN or absent, never inferred from old source records.
    await call('set_trace_esp',0,0,0);await call('init_thread',0,0x400000,0x401000,0x440000,0,0,0,0);
    if(enabled)assert.equal((await command({t:'quake2LoadObservation'})).observation.exactIdentity,'UNKNOWN');
    await command({t:'init',module,memory,sigs,slot:0,endpointIdentity:2245});
    assert.equal((await command({t:'quake2LoadObservation'})).observation,null);
    return {state,observation,module:{path:'build/wine-assembly.wasm',sha256:api.hash(bytes),size:bytes.length}};
  }finally{clearTimeout(watchdog);await w.terminate();}
}
if(!isMainThread) parentPort.once('message',()=>fixture('rpc',workerData.enabled).then(r=>parentPort.postMessage(r)).catch(e=>{throw e;}));
else {
  async function worker(enabled){
    const w=new Worker(__filename,{workerData:{enabled}});
    return new Promise((resolve,reject)=>{
      let settled=false;
      const finish=async(err,value)=>{if(settled)return;settled=true;clearTimeout(deadline);const termination=await w.terminate();
        err?reject(err):resolve({...value,termination});};
      // Independent owning-parent deadline, armed before fixture execution.
      const deadline=setTimeout(()=>finish(Error('fixture deadline')),60000);
      w.once('error',e=>finish(e));w.once('message',r=>finish(null,r));
      w.postMessage({start:true});
    });
  }
  (async()=>{
    const results=[];
    for(const mode of ['host','rpc']){
      const off=mode==='host'?await fixture(mode,false):await worker(false);
      const on=mode==='host'?await fixture(mode,true):await worker(true);
      assert.deepEqual(on.state,off.state);assert.equal(on.guestHash,off.guestHash);
      assert.equal(on.fileReads,off.fileReads);assert.equal(on.frees,off.frees);
      assert.equal(off.result,null);
      results.push({mode,off,on});
    }
    const queuedOff=await queuedWorker(false),queuedOn=await queuedWorker(true);
    assert.deepEqual(queuedOff.state,queuedOn.state);
    console.log(JSON.stringify({pass:true,original:{path:ORIGINAL,sha256:originalSHA},results,queuedOff,queuedOn}));
  })().catch(e=>{console.error(e);process.exitCode=1;});
}
