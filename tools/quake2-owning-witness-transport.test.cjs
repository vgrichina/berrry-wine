'use strict';
// OFFLINE actual Node Worker, production transport, shipped CPU and serialized
// reader. Scheduling below is authored; no original/native gameplay claim.
// Test-only completion signal observes the real Worker's reply. This lets the
// authored schedule finish an OFF run without reading guest bytes or awaiting
// an RPC inside the serialized reader. Production imports/CPU stay unchanged.
const wt=require('node:worker_threads');
if(!wt.isMainThread){
 const base=require('../lib/region-map.generated').BASE.NATIVE_STORE_SHARED+124;
 let memory;const runs=new Set(),post=wt.parentPort.postMessage.bind(wt.parentPort);
 wt.parentPort.on('message',m=>{if(m.t==='init')memory=m.memory;if(m.t==='callExport'&&m.name==='run')runs.add(m.seq);});
 wt.parentPort.postMessage=(m,...args)=>{post(m,...args);if(runs.delete(m.seq)&&memory)Atomics.store(new Int32Array(memory.buffer,base,1),0,m.seq);};
 require('../lib/guest-worker');
 return;
}
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {GuestThreadHost}=require('../lib/guest-thread-host');
const {fixture}=require('./quake2-passive-attack.test.cjs');
const passive=require('./quake2-passive-attack.cjs'),writer=require('./quake2-frame-writer-witness.cjs');
const shared=require('./quake2-shared-writer-witness.cjs');
const {hash}=require('./quake2-owning-load-witness.cjs');
const bytes=fs.readFileSync(process.env.Q2_WITNESS_CPU||'build/wine-assembly.wasm'),moduleCPU=new WebAssembly.Module(bytes),exe=writer.binary();
const offset=a=>a-0x400000+0x12000,FRAME=writer.FRAME,RING=writer.RING,slot=RING+240;
// Execute the actual host API method against the retained process object.
const hostSource=fs.readFileSync('host.js','utf8');
const start=hostSource.indexOf('  async armQuake2WriterObservation('),end=hostSource.indexOf('  async armD3dimPublicationObservation',start);
assert(start>0&&end>start);
const hostArm=vm.runInNewContext('(class { '+hostSource.slice(start,end)+' }).prototype.armQuake2WriterObservation');
const priorReader=require('node:child_process').execFileSync('git',['show','43ec0e8cd:tools/quake2-passive-attack.cjs']);
assert.equal(hash(priorReader),hash(fs.readFileSync('tools/quake2-passive-attack.cjs')),'actual baseline43 serialized reader unchanged');
const strip=r=>{r=JSON.parse(JSON.stringify(r));delete r.at;delete r.frameWriterWitness;if(r.identity)r.identity.endpoint=0;return r;};
async function run(scenario,enabled){
 const f=fixture(true),host=new GuestThreadHost({module:moduleCPU,memory:f.memory,
  sigs:require('../lib/host-import-sigs.generated.json').sigs,
  hostImports:new Proxy({}, {get:(_,name)=>()=>{if(!String(name).startsWith('beep_'))throw Error('unexpected host import '+String(name));return 0;}}),
  workerUrl:__filename,clockIntervalMs:0,tickMs:()=>0});
 let worker;
 try{
  await host.start();const link=host.link;worker=link.worker;
  f.wine.guestWorker=host;
  for(const [key,obj] of Object.entries({endpointObject:link,workerObject:worker,moduleObject:link.module}))f.s.ids.set(obj,f.identity[key]);
  f.identity.endpoint=link.endpointIdentity;
  const call=(n,...a)=>link.callExport(n,...a);
  await call('init_thread',0,0x400000,0x402a9f,0x7409000,0,0,0,0);
  await call('set_esp',0x7408000);
  // Actual page instance remains idle and never armed.
  const shadow=new WebAssembly.Instance(moduleCPU,{host:new Proxy({memory:f.memory},{get:(o,k)=>k in o?o[k]:()=>0})}).exports;
  assert.equal(shadow.native_store_get(0),0);
  f.view.setInt16(offset(FRAME)+0xaa,100,true);f.put(FRAME+0xe8,5);
  new Uint8Array(f.memory.buffer,offset(slot),240).set(new Uint8Array(f.memory.buffer,offset(FRAME),240));
  const pc=['publication','overflow','healthLoss','healthDeath','healthUnknown'].includes(scenario)?0x403527:scenario==='frameClear'?0x403342:scenario==='clientClear'?0x409221:0x402a9f;
  const ins=exe.instruction(pc,32);new Uint8Array(f.memory.buffer,offset(pc),32).set(ins);
  await call('invalidate_code_range',pc,32);await call('set_eip',pc);await call('set_instruction_watchpoint',pc+((pc===0x402a9f)?6:2));
  const regs=['publication','overflow','healthLoss','healthDeath','healthUnknown'].includes(scenario)?{esi:FRAME,edi:slot,ecx:60}:scenario==='frameClear'?{eax:0,edi:FRAME,ecx:60}:scenario==='clientClear'?{eax:0,edi:0xa9c7c0,ecx:0x92d6}:{eax:FRAME,esi:5};
  for(const [k,v] of Object.entries(regs))await call('set_'+k,v);
  if(scenario==='healthLoss'||scenario==='healthDeath'){
   f.view.setInt16(offset(FRAME)+0xaa,scenario==='healthLoss'?98:-1,true);
   new Uint8Array(f.memory.buffer,offset(slot),240).set(new Uint8Array(f.memory.buffer,offset(FRAME),240));
  }
  if(scenario==='healthUnknown')f.put(0xa86a60,3);
  let binding,evidence;
  if(enabled&&scenario==='pageStable'){
   f.context.structuredClone=structuredClone;
   f.wine.armQuake2WriterObservation=async options=>(binding=await hostArm.call(f.wine,options));
   const installed=await vm.runInContext(shared.pageSource({globalName:'q2TransportWitness',identity:f.identity}),f.context);
   assert.equal(installed.status,'ARMED');assert.equal(installed.nativeQualification,false);
   evidence=f.context.q2TransportWitness;
  }else{
   binding=enabled?await hostArm.call(f.wine,{limit:scenario==='overflow'?1:0}):null;
   evidence=enabled?shared.attach(binding):null;
  }
  if(!enabled)assert.equal(Atomics.load(new Int32Array(f.memory.buffer,require('../lib/region-map.generated').BASE.NATIVE_STORE_SHARED,1),0),0,'default OFF never binds a mirror');
  if(enabled){assert.equal(binding.snapshot()[0],1);assert.equal(shadow.native_store_get(0),0,'idle page must remain OFF');}
  let pending,scheduled=false;
  // Test-only synchronization for a deterministic interleaving: post the real
  // CPU command, then wait on shared metadata/guest end PC outside boundaries.
  // No Promise is awaited, no guest bytes are read by the production witness.
  const schedule=()=>{
   if(scheduled||scenario==='stable')return 0;scheduled=true;
   if(['sameByte','publication','frameClear','clientClear','overflow','healthLoss','healthDeath','healthUnknown','duringCopy'].includes(scenario)){
    pending=call('run',1);
    const deadline=Date.now()+10000;
    const base=require('../lib/region-map.generated').BASE.NATIVE_STORE_SHARED+124;
    const signal=new Int32Array(f.memory.buffer,base,1),seq=link._seq;
    while(Atomics.load(signal,0)!==seq){
     if(Date.now()>deadline)throw Error('authored worker schedule deadline');
    }
   }
   return 0;
  };
  f.renderer.peekKeyDownState=()=>scenario==='duringCopy'?0:schedule();
  f.context.__duringCopy=()=>{if(scenario==='duringCopy')schedule();};
  // Record exactly the existing guest reads; atomic metadata is separate.
  vm.runInContext(`globalThis.__trace=[];
   globalThis.DataView=class extends DataView{
    getUint8(...a){if(this.buffer instanceof SharedArrayBuffer)__trace.push(['u8',...a]);return super.getUint8(...a);}
    getUint32(...a){if(this.buffer instanceof SharedArrayBuffer)__trace.push(['u32',...a]);return super.getUint32(...a);}
   };
   globalThis.Uint8Array=class extends Uint8Array{
    *[Symbol.iterator](){for(let i=0;i<this.length;i++){if(this.buffer instanceof SharedArrayBuffer){__trace.push(['byte',this.byteOffset+i]);if(this.byteOffset===7007896&&i===100)__duringCopy();}yield this[i];}}
   };`,f.context);
  f.context.__w=evidence;
  const row=JSON.parse(JSON.stringify(vm.runInContext('('+passive.readPage.toString()+')('+JSON.stringify(f.identity)+','+JSON.stringify(passive.signatures())+',null,__w)',f.context)));
  if(pending)await pending;
  const trace=JSON.parse(JSON.stringify(f.context.__trace));
  const state={};for(const k of ['eip','esp','eax','ebx','ecx','edx','esi','edi','ebp','flag_op','flag_a','flag_b','flag_res','yield_reason'])state[k]=await call('get_'+k);
  const result={scenario,row,trace,state,guestSHA:hash(new Uint8Array(f.memory.buffer,offset(FRAME),240+3840))};
  if(enabled){
   const direct=[];for(let i=0;i<21;i++)direct.push((await call('native_store_get',i))>>>0);
   assert.deepEqual(binding.snapshot(),direct,'all 21 raw owning CPU fields mirrored exactly');
   assert.equal(row.frameWriterWitness.nativeQualification,false);
   assert.equal(row.frameWriterWitness.points.length,scenario==='overflow'?6:12);
   if(scenario==='overflow')assert.equal(row.frameWriterWitness.status,'INVALID');
   else assert.equal(row.frameWriterWitness.status,'BOUNDED',JSON.stringify(row.frameWriterWitness));
   if(['sameByte','duringCopy','publication','frameClear','clientClear'].includes(scenario)){
    const range=scenario==='publication'?'publishedRing':'current';
    const found=row.frameWriterWitness.intervals.find(x=>x.ranges[range].delta>0).ranges[range];
    assert.equal(found.last.pc,pc);assert.equal(found.last.width,4);
    assert.equal(found.delta,['sameByte','duringCopy'].includes(scenario)?1:60);
    assert.equal(found.last.address,scenario==='publication'?slot+236:['sameByte','duringCopy'].includes(scenario)?FRAME+0xe8:FRAME+236);
   }
   if(scenario==='stable'){
    // Concrete old transport gap: actual export is a Promise, whereas every
    // new boundary synchronously reads the owning CPU's metadata.
    assert(call('native_store_get',0) instanceof Promise);
    const old={boundary:()=>call('native_store_get',0),snapshot:()=>({status:'BOUNDED'})};
    f.context.__w=old;
    const oldRow=vm.runInContext('('+passive.readPage.toString()+')('+JSON.stringify(f.identity)+','+JSON.stringify(passive.signatures())+',null,__w)',f.context);
    assert.equal(oldRow.frameWriterWitness.status,'INVALID','old async bridge FAIL');
    assert.deepEqual(strip(oldRow),strip(row));
    const words=new Int32Array(f.memory.buffer,binding.receipt.pointer,22);
    // Metadata fault injection is test-only and never touches guest state.
    for(const [name,index,value] of [['busy',0,1],['sequenceExhausted',0,2147483644],['unsettled',2,123],['invalid',4,1],['overflow',9,1]]){
     const old=Atomics.load(words,index);Atomics.store(words,index,value);
     const w=shared.attach(binding);w.boundary(writer.COPIES[0],'before');assert.equal(w.snapshot().status,'INVALID',name);
     Atomics.store(words,index,old);w.boundary(writer.COPIES[0],'before');assert.equal(w.snapshot().status,'INVALID',name+' sticky');
    }
    const load=Atomics.load;let loads=0;
    Atomics.load=(array,index)=>{const value=load(array,index);if(array.buffer===words.buffer&&index===0&&++loads===2)return value+2;return value;};
    try{assert.throws(()=>binding.snapshot(),/torn/);}finally{Atomics.load=load;}
    for(const [name,obj,key,value] of [
     ['process owner',f.wine,'processId',-1],['guest owner',f.wine,'guestWorker',{}],
     ['worker owner',link,'worker',{}],['module owner',link,'module',{}],['endpoint owner',link,'endpointIdentity',-1],['memory owner',link,'memory',{}],
     ['transport error',link,'_transportFailure',Error('unavailable')],
     ['ambiguous command',link,'_writerAmbiguous',true],['retirement',link,'_stopping',true]
    ]){
     const w=shared.attach(binding),old=obj[key];obj[key]=value;assert.throws(()=>binding.snapshot(),/owner|writer/,name);w.boundary(writer.COPIES[0],'before');obj[key]=old;w.boundary(writer.COPIES[0],'before');assert.equal(w.snapshot().status,'INVALID',name+' sticky');
    }
    for(const [kind,change] of [
     ['reset',()=>call('init_thread',0,0x400000,pc,0x7409000,0,0,0,0)],
    ]){
     const w=shared.attach(binding);await change();w.boundary(writer.COPIES[0],'before');assert.equal(w.snapshot().status,'INVALID',kind);
    }
    assert.equal(binding.snapshot()[3],1,'reset invalid bit retained');
    await call('native_store_arm',FRAME,FRAME+240,RING,RING+3840,0);
    assert.throws(()=>binding.snapshot(),/rearmed/);
    assert.equal((await binding.close()).owned,false,'stale close cannot disarm later arm');
    assert.equal(await call('native_store_get',0),1);
   }
  }
  if(scenario==='pageStable'){
   const bound={createChain:()=>({closed:false,capture:async()=>({capture:{identity:f.identity},after:{}}),progress:async()=>({})})};
   const chain=passive.createChain(bound,{evaluate:source=>vm.runInContext(source,f.context),writerWitnessGlobal:'q2TransportWitness'});
   const capture=await chain.capture('authored');assert.equal(capture.after.attackInput.frameWriterWitness.points.length,24);
   const progress=await chain.progress(f.identity);assert.equal(progress.attackInput.frameWriterWitness.points.length,36);
   assert.equal(progress.attackInput.frameWriterWitness.nativeQualification,false);
  }
  if(enabled&&scenario!=='stable'){await evidence.close();assert.equal(await call('native_store_get',0),0);assert.throws(()=>binding.snapshot(),/closed/);}
  return result;
 }finally{await host.stop();assert(!worker||worker.threadId===-1,'actual worker joined');}
}
async function main(){
 const off=await run('stable',false),on=await run('stable',true);
 assert.deepEqual(strip(on.row),strip(off.row));assert.deepEqual(on.trace,off.trace);assert.deepEqual(on.state,off.state);assert.equal(on.guestSHA,off.guestSHA);
 const page=await run('pageStable',true);assert.equal(page.row.frameWriterWitness.points.length,12);
 const results=[];for(const name of ['sameByte','duringCopy','publication','frameClear','clientClear','overflow']){
  const off=await run(name,false),on=await run(name,true);
  assert.deepEqual(strip(on.row),strip(off.row),name+' actual worker acceptance parity');
  assert.deepEqual(on.trace,off.trace,name+' exact guest read order');
  assert.deepEqual(on.state,off.state,name+' architecture/lazy flags');
  assert.equal(on.guestSHA,off.guestSHA,name+' frame/ring bytes');results.push(on);
 }
 const Module=require('node:module'),file=path.resolve('tools/quake2-rejected-frame-values.test.cjs'),healthModule=new Module(file,module);
 healthModule.filename=file;healthModule.paths=module.paths;
 // Isolate the retained health consumer from a concurrently edited custody
 // provider. Exact Git fixture only for OFFLINE composition; production still
 // refuses drift. No custody implementation is executed by consumer().
 const read=fs.readFileSync,custodyFixture=require('node:child_process').execFileSync('git',['show','c443739b5:tools/native_kernel_custody.py']);
 assert.equal(hash(custodyFixture),'05b7fe42cf7ac09df5f12f0ea073ea066892efb598b64b05fae19a3492c9f32c');
 const fixtureRead=(p,...args)=>String(p)===path.resolve('tools/native_kernel_custody.py')
  ? (args[0]==='utf8'?custodyFixture.toString('utf8'):custodyFixture):read(p,...args);
 fs.readFileSync=fixtureRead;
 try{healthModule._compile(read(file,'utf8')+'\nmodule.exports={consumer};',file);}
 finally{fs.readFileSync=read;}
 const consumer=()=>{fs.readFileSync=fixtureRead;try{return healthModule.exports.consumer();}finally{fs.readFileSync=read;}};
 const writerHealth=[];
 for(const terminal of ['healthLoss','healthDeath','healthUnknown'])for(const upFailure of [false,true]){
  const sample=await run(terminal,true),h=consumer(),events=[];
  h.control.retainHealth({attackInput:off.row},'capture-after');
  let caught,first,reads=0;
  try{await require('./quake2-native-input.cjs').hold({keys:['ArrowRight'],holdMs:50,session:'authored',
   send:async(m,p)=>{events.push(p.type);if(upFailure&&p.type==='keyUp')throw Error('later UP failure');},
   sample:async()=>{reads++;return {attackInput:sample.row};},
   checkSample:r=>{try{h.control.retainHealth(r,'during-action');}catch(e){first=e;throw e;}},
   saveSample:()=>{throw Error('later sink must not run');}});}catch(e){caught=e;}
  assert.equal(caught,first);assert.equal(caught,h.control.failure());assert.equal(reads,1);
  assert.deepEqual(events,['keyDown','keyUp']);assert.equal(caught.holdReceipt.physicalRelease,upFailure?'UNKNOWN':'ACK');
  const retained=h.logs.at(-1).row.attackInput.frameWriterWitness;
  assert.equal(retained.status,'BOUNDED');assert.equal(retained.nativeQualification,false);
  assert(retained.intervals.some(i=>i.ranges.publishedRing.delta===60));
  let later=0;h.control.setup({progress:async()=>{later++;return {};}});await h.control.passiveHealthTick();assert.equal(later,0);
  writerHealth.push({terminal,upFailure,reason:String(caught),physicalRelease:caught.holdReceipt.physicalRelease,laterReads:later});
 }
 console.log(JSON.stringify({pass:true,cpuSHA:hash(bytes),writerHealth,stableGuestReads:on.trace.length,baselineReaderCommit:'43ec0e8cd',baselineReaderSHA:hash(priorReader),pageRealmInstallCaptureProgress:true,oldAsyncFAIL:true,newSharedPASS:true,
  results:results.map(r=>({scenario:r.scenario,state:r.state,guestSHA:r.guestSHA,frameWriterWitness:r.row.frameWriterWitness}))}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
