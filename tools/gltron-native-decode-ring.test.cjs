'use strict';
// Actual current CPU and queued production Node Worker. Only initialized data,
// caller and explicitly replaced dependencies are synthetic. No game startup.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {Worker,MessageChannel,isMainThread,parentPort,workerData}=require('node:worker_threads');
const api=require('./gltron-native-decode-ring.cjs');
const ROOT=path.resolve(__dirname,'..'),files=api.MEDIA.map(m=>fs.readFileSync(path.join(ROOT,m.path)));
api.pinMedia(files);
const le=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24&255];
async function physical() {
  const {e,memory}=globalThis.gltronFixtureAccess(),mem=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer);
  const wa=a=>{const w=e.guest_to_wasm(a)>>>0;assert.notEqual(w,0xf0);return w;};
  const put=(a,b)=>{mem.set(b,wa(a));e.invalidate_code_range(a,b.length);},u=(a,v)=>dv.setUint32(wa(a),v>>>0,true);
  mem.set(files[0],e.get_staging());assert(e.load_pe(files[0].length));e.set_api_log(0);
  mem.set(files[1],e.get_staging());e.load_dll(files[1].length,workerData.base);
  const idx=e.get_last_loaded_dll_index(),base=dv.getUint32(e.get_dll_table()+idx*32,true);
  assert.equal(base,workerData.base);
  // DllMain is deliberately not executed. Synthetic initialized sample state
  // and decoder dependency stand in for SDL initialization and real media.
  const object=0x1800000,sample=object+0x100,internal=object+0x200,vtable=object+0x400;
  const source=object+0x500,ring=object+0x600,stack=0x7408000,stop=0x401400;
  const backend=0x401500,copy=0x401600;
  u(object+0x20,sample);u(object+0x24,4);u(object+0x28,ring);u(object+0x2c,16);u(object+0x30,workerData.mode==='wrap'?8:0);u(object+0x34,workerData.mode==='wrap'?12:0);
  u(sample,internal);u(sample+0x18,source);u(sample+0x20,0);u(internal+0xc,vtable);u(internal+0x10,0);
  u(base+0x532f4,1);u(0x4243b4,base+0x1b6b);u(0x4241a4,copy);
  u(vtable+0x20,workerData.mode==='zero'?backend:base+0x492a);
  // Adapter's genuine direct CALL targets its dependency at RVA 2a470. Replace
  // ONLY that dependency entry in this synthetic loaded image, openly; all
  // pinned refill, decode, thunk and adapter bodies remain exact originals.
  put(base+0x2a470,[0xe9,...le(backend-(base+0x2a470)-5)]);
  put(backend,workerData.mode==='pending'?[0xeb,0xfe]:workerData.mode==='chasing'?
    [0xa1,...le(object+0x30),0x83,0xc0,4,0x83,0xe0,15,0xa3,...le(object+0x30),0xb8,...le(4),0xc3]:
    [0xb8,...le(workerData.mode==='zero'?0:workerData.mode==='wrap'?8:4),0xc3]);
  // cdecl memcpy with actual REP MOVSB and preserved callee-save registers.
  put(copy,[0x56,0x57,0x8b,0x7c,0x24,0x0c,0x8b,0x74,0x24,0x10,0x8b,0x4c,0x24,0x14,0x8b,0xc7,0xf3,0xa4,0x5f,0x5e,0xc3]);
  put(stop,[0x0f,0x0b]);put(source,[1,2,3,4,5,6,7,8]);u(stack,stop);
  e.set_eip(0x413258);e.set_ecx(object);e.set_esp(stack);
  // Existing debugger primitive invalidates fused blocks and publishes exactly
  // one x86 instruction per block. It is controller setup, not observer code.
  e.set_instruction_watchpoint(object+0x80);
  const read=api.reader(e),verify=api.loadedPins(files,base,read.read);
  const owner={},epoch={},lifetime={},events=[],trace=[];
  const make=extra=>api.createValidator({owner,epoch,lifetime,verify,soundBase:base,maxRecords:256,...extra});
  const observer=workerData.observed?make():null;
  let pending;const slice=()=>new Promise((resolve,reject)=>{pending={resolve,reject};parentPort.postMessage({t:'fixtureSlice'});});
  workerData.port.on('message',m=>{if(m.t==='slice'){const p=pending;pending=null;m.value.trapped?p.reject(Error(m.value.trapped)):p.resolve(m.value.blocks);}});
  const fullState=()=>Object.fromEntries(['eip','esp','ebp','eax','ebx','ecx','edx','esi','edi','flag_op','flag_a','flag_b','flag_res','yield_reason'].map(k=>[k,e['get_'+k]()>>>0]));
  for(let i=0;i<800&&(e.get_eip()>>>0)!==stop;i++) {
    const before=read.cpu(),r=read.ring(object),opcode=read.read(before.pc,1).toString('hex');
    const target=before.pc===base+0x1bff?read.u32(before.eax+0x20):undefined;
    const ran=await slice();const after=read.cpu();
    const event={owner,epoch,lifetime,sequence:i+1,missed:0,granularity:'instruction',before,after,object,ring:r,ringAfter:read.ring(object),target,opcode,argument:before.saved,writeAfter:read.u32(object+0x34)};
    events.push(event);trace.push({ran,...fullState()});
    if(observer){const state=fullState(),ringBefore=read.ring(object);observer.step(event);assert.deepEqual(fullState(),state,'observer leaves CPU untouched');assert.deepEqual(read.ring(object),ringBefore,'observer leaves ring untouched');}
  }
  const result=observer?.finish();
  const final={state:fullState(),ring:read.ring(object),payload:[...read.read(ring,16)],memoryHash:api.hash(mem)};
  if(result){assert.notEqual(result.status,'INVALID',JSON.stringify(result));
    const expected={progress:'REFILL_RETURNED',wrap:'REFILL_RETURNED',chasing:'RETURNED_DECODE_REFILL_CONTINUES',zero:'RETURNED_DECODE_REFILL_CONTINUES',pending:'DECODE_PENDING_AT_BOUND'}[workerData.mode];
    assert.equal(result.classification,expected,JSON.stringify(result));
    if(workerData.mode==='progress'){assert.equal(result.decodeCalls,3);assert.equal(result.decodeReturns,3);assert.equal(result.writes,3);assert.equal(result.loops,3);assert.equal(result.exits,1);assert.equal(final.ring.write,12);assert.deepEqual(final.payload.slice(0,12),[1,2,3,4,1,2,3,4,1,2,3,4]);}
    if(workerData.mode==='pending'){assert.equal(result.decodeCalls,1);assert.equal(result.decodeReturns,0);assert.equal(result.writes,0);assert.equal(result.pending.length,3);}
    if(workerData.mode==='wrap'){assert.equal(result.decodeCalls,1);assert.equal(result.decodeReturns,1);assert.equal(final.ring.write,4);assert.deepEqual(final.payload,[5,6,7,8,0,0,0,0,0,0,0,0,1,2,3,4]);}
    if(workerData.mode==='chasing'){assert(result.decodeReturns>=3);assert(result.readChanges>=3);assert(result.writes>=3);assert.equal(result.exits,0);}
  }
  const negatives={};
  if(observer&&workerData.mode==='progress') {
    // Replay only immutable snapshots captured from actual x86 execution.
    const reject=(name,alter,options={})=>{const x=make(options);for(let i=0;i<events.length;i++){const event={...events[i]};alter(event,i);x.step(event);}const r=x.finish();assert.equal(r.status,'INVALID',name);assert.equal(r.classification,'UNKNOWN');negatives[name]=r.error;};
    reject('owner',x=>{x.owner={};});reject('epoch',x=>{x.epoch={};});reject('lifetime',x=>{x.lifetime={};});
    reject('missed', (x,i)=>{if(i===4)x.missed=1;});reject('sequence',(x,i)=>{if(i===4)x.sequence++;});
    reject('block-feed',x=>{x.granularity='block';});reject('sample-reuse',(x,i)=>{if(i===4)x.ring={...x.ring,sample:sample+4};});
    reject('wrong-return-token',x=>{if(x.after.pc===0x4132ac)x.before={...x.before,saved:0x4132ad};});
    reject('wrong-call-token',x=>{if(x.before.pc===0x4132a7)x.after={...x.after,saved:0x4132ad};});
    reject('wrong-ret-target',x=>{if(x.before.pc===base+0x1c38)x.after={...x.after,pc:0x4132ad};});
    reject('wrong-sample-argument',x=>{if(x.before.pc===0x4132a7)x.argument++;});
    reject('bounded-instructions',()=>{},{maxInstructions:1});reject('bounded-records',()=>{},{maxRecords:1});
    reject('write-mismatch',x=>{if(x.before.pc===0x413358)x.writeAfter++;});
    reject('condition-mismatch',x=>{if(x.before.pc===0x41329b)x.after={...x.after,pc:0x4132a1};});
    const x=make();mem[wa(0x413258)]^=1;x.step(events[0]);assert.equal(x.finish().status,'INVALID');negatives.code='loaded original bytes changed';mem[wa(0x413258)]^=1;
    const bad=Buffer.from(files[0]);bad[0x100]^=1;assert.throws(()=>api.pinMedia([bad,files[1]]),/PATHHASH/);negatives.module='PATHHASH rejected';
  }
  parentPort.postMessage({pass:true,mode:workerData.mode,base,result,final,trace,negatives,events:events.length});
}
if(!isMainThread) {
  const filename=path.join(ROOT,'lib/guest-worker.js'),Module=require('node:module'),m=new Module(filename,module);
  m.filename=filename;m.paths=module.paths;
  // Existing native tests use this exact test-only owning-export seam. The
  // production source and Worker queue are unchanged; no alternate run loop.
  m._compile(fs.readFileSync(filename,'utf8')+'\n;globalThis.gltronFixtureAccess=()=>({e:instance.exports,memory});',filename);
  workerData.port.once('message',()=>physical().catch(e=>parentPort.postMessage({failure:e.stack})));
} else {
  const bytes=fs.readFileSync(path.join(ROOT,'build/wine-assembly.wasm'));
  async function one(mode,observed,base) {
    const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),{port1,port2}=new MessageChannel();
    const sigs=require('../lib/host-import-sigs.generated.json').sigs;
    const broker=require('../lib/guest-rpc').createMainBroker(memory,new Proxy({}, {get:(_,name)=>()=>{if(!['log','log_i32','beep_process_begin','beep_thread_begin','resolve_ordinal'].includes(name))throw Error('unexpected fixture import '+name);return 0;}}),sigs);
    const module=await WebAssembly.compile(bytes),w=new Worker(__filename,{workerData:{port:port2,observed,mode,base},transferList:[port2]});
    return new Promise((resolve,reject)=>{
      let seq=0,settled=false;
      const finish=async(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);await w.terminate();port1.close();error?reject(error):resolve(value);};
      // Independent parent watchdog is armed before the Worker gets its init.
      const timer=setTimeout(()=>finish(Error('independent native fixture deadline')),60000);
      w.on('error',e=>finish(e));w.on('message',m=>{
        if(m.t==='ready')port1.postMessage({t:'start'});
        else if(m.t==='rpc')broker.serveRpc(m.slot,m.waitEntry);
        else if(m.t==='call')broker.serveCall(m);
        else if(m.t==='calls')broker.serveCalls(m);
        else if(m.t==='fixtureSlice')w.postMessage({t:'slice',seq:++seq,steps:1});
        else if(m.t==='sliceDone')port1.postMessage({t:'slice',value:m});
        else if(m.failure||m.t==='error')finish(Error(m.failure||JSON.stringify(m)));
        else if(m.pass)finish(null,m);
      });
      w.postMessage({t:'init',seq:0,module,memory,sigs,slot:0,endpointIdentity:2215});
    });
  }
  (async()=>{
    const results=[];
    for(const base of [0x765000,0x965000])for(const mode of ['progress','wrap','chasing','zero','pending']) {
      const off=await one(mode,false,base),on=await one(mode,true,base);
      assert.deepEqual(on.trace,off.trace,'every actual queued CPU state/return matches');
      assert.deepEqual(on.final,off.final,'whole-memory, payload and final CPU parity');
      results.push({mode,base,result:on.result,negatives:on.negatives,instructions:on.events,final:on.final});
      console.log('PASS actual x86 '+mode+' base='+base.toString(16)+' '+on.result.classification+' instructions='+on.events);
    }
    console.log(JSON.stringify({pass:true,fixtureOnly:true,wasm:{path:'build/wine-assembly.wasm',sha256:api.hash(bytes),size:bytes.length},media:api.MEDIA,results}));
  })().catch(e=>{console.error(e);process.exitCode=1;});
}
