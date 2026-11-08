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
async function queuedWorker(enabled, scenario='use') {
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
  const lifecycle={deadlineArmedBeforeInit:true,deadlineFired:false};
  const watchdog=setTimeout(()=>{lifecycle.deadlineFired=true;failed=Error('queued production fixture deadline');pending?.reject(failed);void w.terminate();},60000);
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
    const staging=(await call('get_staging')).value;
    mem.set(pe.buf,staging);
    if(scenario==='import')await call('set_trace_eip_range',1,0x4118d9,0x4118d9);
    await call('set_trace_esp',scenario==='noTrace'?0:1,0x4117b0,0x42f0f5);
    await call('set_esp',sp);await call('set_esi',160);await call('set_eax',source);await call('set_ebx',0);
    // Native CMP/JNE actually chooses the post-read acquisition path.
    await call('set_eip',0x4118c5);await call('run',1);await call('run',1);
    const acquired=(await command({t:'quake2LoadObservation'})).observation;
    if(enabled){assert.equal(acquired.records.length,scenario==='noTrace'?0:1);
      if(scenario!=='noTrace')assert.equal(acquired.records[0].sha256,api.hash(Buffer.alloc(160,0x65)));}
    else assert.equal(acquired,null);
    if(scenario!=='use') {
      let outcome=null,activeMemory=memory;
      const expect={reset:/export: init_thread/,reload:/export: load_pe/,disarm:/export: set_trace_esp/,
        rearm:/export: set_trace_esp/,readExportMutation:/export: set_eax/,import:/import: log_eip/,
        code:/native body replaced/,module:/lifecycle: worker reinit/,memory:/lifecycle: worker reinit/,
        missingModule:/lifecycle: worker reinit/,missingMemory:/lifecycle: worker reinit/,
        executionError:/execution: run threw/};
      if(scenario==='reset')outcome=(await call('init_thread',0,0x400000,0x401000,0x440000,0,0,0,0)).value;
      else if(scenario==='reload')outcome=(await call('load_pe',pe.buf.length)).value;
      else if(scenario==='disarm'||scenario==='rearm') {
        await call('set_trace_esp',0,0,0);
        if(scenario==='rearm')for(let i=0;i<40;i++)await call('set_trace_esp',1,0x4117b0,0x42f0f5);
      } else if(scenario==='readExportMutation')outcome=(await command({t:'readExports',names:['set_eax']})).values;
      else if(scenario==='code')mem[wa(0x410e50)]^=1;
      else if(scenario==='writerGap')mem[wa(source)]^=1;
      else if(scenario==='executionError') {
        await assert.rejects(call('run',1n),/BigInt/);outcome='expected export argument error';
      } else if(['module','memory','missingModule','missingMemory'].includes(scenario)) {
        if(scenario==='memory')activeMemory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
        try {
          await command({t:'init',module:scenario==='missingModule'?null:await WebAssembly.compile(bytes),
            memory:scenario==='missingMemory'?null:activeMemory,sigs,slot:0,endpointIdentity:2258,quake2LoadObservation:enabled});
        } catch(error) {
          assert(['missingModule','missingMemory'].includes(scenario));outcome='expected init error';
        }
      } else assert(['positive','missingCoverage','import','noTrace'].includes(scenario),scenario);
      const status=await command({t:'quake2LoadObservation'});
      const observation=['module','memory','missingModule','missingMemory'].includes(scenario)?status.retiredObservation:status.observation;
      if(enabled) {
        assert.equal(observation.exactIdentity,'UNKNOWN');
        assert.deepEqual(observation.coverage,{completedLoad:'UNKNOWN',instructions:'UNKNOWN',allWriters:'UNKNOWN',exclusiveOwner:'UNKNOWN'});
        assert.equal(observation.validPointObservations,!expect[scenario] && scenario!=='noTrace',JSON.stringify(observation));
        if(expect[scenario])assert.match(observation.reason,expect[scenario]);
        assert(observation.events.length<=32);
        if(scenario==='rearm') {
          assert.equal(observation.events.length,32);
          assert(observation.eventCount>32);
          assert.equal(observation.events.at(-1).sequence,observation.eventCount);
        }
        if(scenario==='executionError')assert.deepEqual(observation.execution,{entries:3,returns:2,failures:1});
        if(['module','memory','missingModule','missingMemory'].includes(scenario)) {
          assert.equal(observation.events.at(-1).kind,'lifecycle');
          if(status.observation) {
            assert.equal(status.observation.records.length,0);
            assert.equal(status.observation.validPointObservations,false);
          }
        }
        if(scenario==='writerGap')assert.notEqual(observation.records[0].sha256,api.hash(mem.subarray(wa(source),wa(source)+160)));
        if(scenario==='missingCoverage') {
          // Caller booleans are ignored by the actual queued status path.
          const claimed=await command({t:'quake2LoadObservation',exclusiveOwner:true,allWriters:true,continuous:true,completedLoad:true});
          assert.deepEqual(claimed.observation,status.observation);
          assert.deepEqual(claimed.retiredObservation,status.retiredObservation);
        }
        // Sticky invalidation, including trace rearming; no later block may
        // append to old evidence even when genuine execution resumes.
      } else assert.equal(observation,null);
      if(['reset','disarm','rearm','code','readExportMutation'].includes(scenario)) {
        const count=observation?.records.length;
        await call('set_eip',0x42f0b0);await call('set_esp',sp);await call('run',1);
        if(enabled)assert.equal((await command({t:'quake2LoadObservation'})).observation.records.length,count);
      }
      const state=(await command({t:'readExports',names:['get_eip','get_eax','get_esp']})).values;
      return {scenario,state,outcome,acquired,observation,status,lifecycle,
        guestHash:api.hash(new Uint8Array(activeMemory.buffer,0x12000,0x8000000-0x12000)),
        module:{path:'build/wine-assembly.wasm',sha256:api.hash(bytes),size:bytes.length}};
    }
    await call('set_eip',0x42f0b0);await call('set_esp',sp);
    // Original use completes to the synthetic return sentinel through real RET.
    put(sp,0x1100000);
    for(let i=0;i<3;i++)await call('run',1);
    const state=(await command({t:'readExports',names:['get_eip','get_eax','get_esp']})).values;
    assert.equal(state.get_eax,4948);assert.equal(state.get_eip,0x1100000);
    const observation=(await command({t:'quake2LoadObservation'})).observation;
    if(enabled){assert.equal(observation.records.length,1);
      assert.equal(observation.validPointObservations,false);
      assert.match(observation.reason,/export: set_eip/);
      assert.equal(observation.exactIdentity,'UNKNOWN');}
    // Disarm trace, reset same instance, reinit Worker: all later identity is
    // UNKNOWN or absent, never inferred from old source records.
    await call('set_trace_esp',0,0,0);await call('init_thread',0,0x400000,0x401000,0x440000,0,0,0,0);
    if(enabled)assert.equal((await command({t:'quake2LoadObservation'})).observation.exactIdentity,'UNKNOWN');
    await command({t:'init',module,memory,sigs,slot:0,endpointIdentity:2245});
    assert.equal((await command({t:'quake2LoadObservation'})).observation,null);
    return {state,observation,lifecycle,guestHash:api.hash(mem.subarray(0x12000,0x8000000)),
      module:{path:'build/wine-assembly.wasm',sha256:api.hash(bytes),size:bytes.length}};
  }finally{
    clearTimeout(watchdog);lifecycle.deadlineCleared=true;
    lifecycle.terminationCode=await w.terminate();lifecycle.terminationAwaited=true;
    lifecycle.threadIdAfter=w.threadId;
  }
}
if(!isMainThread) parentPort.once('message',()=>fixture('rpc',workerData.enabled).then(r=>parentPort.postMessage(r)).catch(e=>{throw e;}));
else if(require.main===module) {
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
module.exports={queuedWorker};
