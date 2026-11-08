'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),crypto=require('node:crypto');
const {PNG}=require('pngjs');
const gate=require('./strict-software-gate.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function fixture(hooks={}) {
 let time=1000,copyGeneration=0,pixel=[0,0,0,255],pending=0,maxPending=0;
 const calls=[],phases=[],proofs=[],texts={d:'pinned decoder JS',c:'pinned compositor JS'};
 const wasm=Buffer.from([0,97,115,109,1,0,0,0]);new WebAssembly.Module(wasm);
 const memory={buffer:new SharedArrayBuffer(128)},instance={exports:{}},canvas={width:1,height:1};
 const layer={canvas,ctx:{canvas}},win={hwnd:7,processId:1000,wasm:instance,wasmMemory:memory,_dxFrameLayer:layer};
 const surface={slot:2,dibWa:16,w:1,h:1,pitch:2,bpp:16};
 const observation={copy:null,current:()=>({...surface,memory:memory.buffer,allocationGeneration:1})};
 const decoder=()=>{},compositor=()=>{};
 const screen={toDataURL(){const png=new PNG({width:1,height:1});png.data.set(pixel);return 'data:image/png;base64,'+PNG.sync.write(png).toString('base64');}};
 const renderer={windows:{7:win},_repaintOnce:compositor,canvas:screen};
 const gdi={fallbackObservation:observation,presentBestDxOffscreen:decoder};
 const ctx={instance,exports:instance.exports,renderer,sharedGdi:gdi};
 const w={running:true,processId:1000,hostCtx:ctx,renderer,instance,memory,
  guestWorker:{link:{endpointIdentity:1,slot:0,worker:{},module:{}}}};
 const clock={now:()=>time};
 const realm=vm.createContext({w,crypto:crypto.webcrypto,Date:clock,crossOriginIsolated:true});
 const guestRealm=vm.createContext({endpointIdentity:1,workerSlot:0,instance:{exports:{}},crypto:crypto.webcrypto});
 const scripts=new Map([['d',{url:'decoder.js',scriptLanguage:'JavaScript',executionContextId:1}],['c',{url:'compositor.js',scriptLanguage:'JavaScript',executionContextId:1}]]);
 const worker={url:'guest-worker.js',sessionId:'guest',targetId:'target-1',closed:false,scripts:[{scriptId:'w',sha256:hash(wasm),bytecodeAvailable:true}]};
 const workers=new Map([['guest',worker]]);
 const expected={guestSha256:hash(wasm),decoder:{url:'decoder.js',sha256:hash(texts.d)},compositor:{url:'compositor.js',sha256:hash(texts.c)}};
 const f={w,ctx,renderer,layer,surface,observation,scripts,texts,worker,workers,guestRealm,realm,wasm,calls,phases,proofs,expected,
  advance:ms=>{time+=ms;},setPixel:p=>{pixel=p;},get pending(){return pending;},get maxPending(){return maxPending;}};
 async function send(method,args,session){
  calls.push({method,args,session});hooks.call?.(f,method,args,session);
  if(method==='Runtime.evaluate'){
   try{
    const result=vm.runInContext(args.expression,session==='guest'?guestRealm:realm);
    return {result:args.returnByValue?{value:structuredClone(result)}:{type:'function',objectId:result===decoder?'d':'c'}};
   }catch(e){return {exceptionDetails:{text:e.message,exception:{description:e.message}}};}
  }
  if(method==='Runtime.getProperties')return {internalProperties:[{name:'[[FunctionLocation]]',value:{value:{scriptId:args.objectId}}}]};
  if(method==='Runtime.releaseObject')return {};
  if(method==='Debugger.getScriptSource'){
   pending++;maxPending=Math.max(maxPending,pending);
   try{
    await new Promise(r=>setImmediate(r));await hooks.source?.(f,args.scriptId);
    return args.scriptId==='w'?{bytecode:f.wasm.toString('base64')}:{scriptSource:texts[args.scriptId]};
   }finally{pending--;}
  }
  throw Error(method);
 }
 f.send=send;
 f.copy=()=>observation.copy({source:'selected-fallback',copied:true,copyGeneration:++copyGeneration,
  allocationGeneration:1,surface:{...surface},memory:memory.buffer,hwnd:7,window:win,layer,destination:canvas});
 f.options={send,pageSession:'page',workers,scripts,expected,sameHostClock:true,deadline:10000,now:()=>time,monotonic:()=>time,
  async inspect(bytes){const png=PNG.sync.read(bytes);return {living:png.data[0]===255,timerSha256:hash(png.data.subarray(1,2))};},
  async save(row,bytes){phases.push({row,bytes});await hooks.save?.(f,row,bytes);},
  async record(proof){proofs.push(proof);await hooks.record?.(f,proof);}};
 f.start=async()=>{await gate.install({send,pageSession:'page',ownerExpression:'w'});f.copy();f.guard=gate.createSoftwareGate(f.options);return f.guard;};
 return f;
}
(async()=>{
 const f=fixture(),g=await f.start();
 const baseline=await g.probe({phase:'beforeResume'});assert(!baseline.qualified);
 f.setPixel([255,1,0,255]);f.copy();assert(!(await g.probe()).qualified);
 f.setPixel([255,2,0,255]);f.copy();const qualified=await g.probe();assert(qualified.qualified);
 assert.equal(qualified.contract,gate.CONTRACT);assert.equal(qualified.hardwareGateEligible,false);
 assert.equal(f.calls.filter(c=>c.method==='Debugger.getScriptSource').length,18);
 assert.equal(f.proofs.filter(p=>p.kind==='WebAssembly').length,6);
 assert.equal(f.proofs.filter(p=>p.kind==='JavaScript').length,12);
 assert.equal(f.maxPending,3);assert.equal(f.pending,0);
 assert.deepEqual(f.phases.map(p=>p.row.phase),Array(3).fill(['entry','owner','owner','pixels','return']).flat());
 await assert.rejects(()=>gate.install({send:f.send,pageSession:'page',ownerExpression:'w'}),/no replay/);
 // Identical timer pixels cannot form the changed pair; nonliving pixels reset it.
 const pair=fixture(),pg=await pair.start();await pg.probe({phase:'beforeResume'});
 for(const [pixel,want] of [[[255,3,0,255],false],[[255,3,0,255],false],[[0,0,0,255],false],[[255,4,0,255],false],[[255,5,0,255],true]]) {
  pair.setPixel(pixel);pair.copy();assert.equal((await pg.probe()).qualified,want);
 }
 let negatives=0;
 const sourceMutations=[
  f=>{f.w.hostCtx={...f.ctx};},f=>{f.w.guestWorker.link.worker={};},f=>{f.w.guestWorker.link.module={};},
  f=>{f.w.guestWorker.link.endpointIdentity=2;},f=>{f.w.guestWorker.link.slot=1;},
  f=>{f.worker.closed=true;},f=>{f.worker.targetId='replacement';},
  f=>{vm.runInContext('instance={exports:{}}',f.guestRealm);},
  f=>{f.worker.scripts=[];},f=>{f.worker.scripts[0].sha256='0'.repeat(64);},
  f=>{f.wasm=Buffer.from('not WASM');},
  f=>{f.workers.set('duplicate',{...f.worker,sessionId:'other'});},
  f=>{f.texts.d='changed JS';},f=>{f.scripts.delete('c');},
  f=>{f.scripts.get('c').executionContextId=2;},f=>{f.scripts.get('d').url='wrong.js';},
  f=>{f.scripts.get('d').scriptLanguage='WebAssembly';},
  f=>{f.observation.current=()=>null;},f=>{f.w._renderWorkerManager={ports:new Map([[1,{closed:false}]])};},
  f=>{f.renderer._repaintOnce=()=>{};},f=>{f.layer.ctx={canvas:{}};},
 ];
 for(const mutation of sourceMutations) {
  let enabled=false;
  const n=fixture({source(f){if(enabled){enabled=false;mutation(f);}}}),guard=await n.start();
  await guard.probe({phase:'beforeResume'});n.setPixel([255,1,0,255]);n.copy();enabled=true;
  await assert.rejects(()=>guard.probe(),undefined,String(mutation));assert(guard.closed);assert.equal(n.pending,0,'all lanes drain on failure');
  const count=n.calls.length;await assert.rejects(()=>guard.probe(),/no replay/);assert.equal(n.calls.length,count);negatives++;
 }
 for(const phase of ['entry','owner','pixels','return']) {
  let enabled=false;
  const n=fixture({save(f,row){if(enabled&&row.phase===phase)throw Error('sink failure');}}),guard=await n.start();await guard.probe({phase:'beforeResume'});enabled=true;
  await assert.rejects(()=>guard.probe(),/sink failure/);assert(guard.closed);assert.equal(n.pending,0);negatives++;
 }
 for(const phase of ['owner','pixels','return']) {
  let enabled=false;
  const n=fixture({save(f,row){if(enabled&&row.phase===phase){enabled=false;f.advance(251);}}}),guard=await n.start();await guard.probe({phase:'beforeResume'});enabled=true;
  await assert.rejects(()=>guard.probe(),/expired|stale/);assert(guard.closed);negatives++;
 }
 for(const mode of ['missingBaseline','replayBaseline','livingBaseline','clock','unverifiedClock','badPin','missingSinks','staleCopy','negativeAge','finalContextRetirement','concurrent','mutatingSink','missingDeadline','expiredTransition','lateScriptRetirement','lateGuestRetirement','lateOwnerReplacement','lateGuestInstanceReplacement']) {
  let enabled=false;
  const n=fixture({save(f,row){
   if(!enabled)return;
   if(mode==='finalContextRetirement'&&row.phase==='owner')f.scripts.delete('c');
   if(mode==='mutatingSink'&&row.phase==='return')row.result.qualified=true;
   if(row.phase==='return'){
    if(mode==='lateScriptRetirement')f.scripts.delete('c');
    if(mode==='lateGuestRetirement')f.worker.closed=true;
    if(mode==='lateOwnerReplacement')f.w.hostCtx={...f.ctx};
    if(mode==='lateGuestInstanceReplacement')vm.runInContext('instance={exports:{}}',f.guestRealm);
   }
  },call(f,method,args){if(enabled&&mode==='clock'&&method==='Runtime.evaluate'&&args.expression==='Date.now()')f.advance(10);}});
  if(mode==='unverifiedClock'){assert.throws(()=>gate.createSoftwareGate({...n.options,sameHostClock:false}),/clock/);negatives++;continue;}
  if(mode==='missingDeadline'){assert.throws(()=>gate.createSoftwareGate({...n.options,deadline:null}),/deadline/);negatives++;continue;}
  if(mode==='badPin'){assert.throws(()=>gate.createSoftwareGate({...n.options,expected:{}}),/pin/);negatives++;continue;}
  if(mode==='missingSinks'){assert.throws(()=>gate.createSoftwareGate({...n.options,save:null}),/sinks/);negatives++;continue;}
  const guard=await n.start();
  if(mode==='livingBaseline')n.setPixel([255,1,0,255]);
  if(mode==='livingBaseline'||mode==='missingBaseline'){
   await assert.rejects(()=>guard.probe({phase:mode==='livingBaseline'?'beforeResume':'afterResume'}));assert(guard.closed);negatives++;continue;
  }
  await guard.probe({phase:'beforeResume'});enabled=true;
  if(mode==='staleCopy')n.advance(251);
  if(mode==='expiredTransition'){n.advance(5000);n.copy();}
  if(mode==='negativeAge')n.advance(-1);
  if(mode==='clock'){
   // Target wall time from a different OS host must fail the bracket.
   n.options.send=null;vm.runInContext('Date={now:()=>999999}',n.realm);
  }
  if(mode==='mutatingSink'){assert.equal((await guard.probe()).qualified,false);negatives++;continue;}
  if(mode==='concurrent'){
   const a=guard.probe();const b=guard.probe();await Promise.all([assert.rejects(()=>a),assert.rejects(()=>b)]);assert(guard.closed);negatives++;continue;
  }
  await assert.rejects(()=>guard.probe({phase:mode==='replayBaseline'?'beforeResume':'afterResume'}));assert(guard.closed);assert.equal(n.pending,0);negatives++;
 }
 console.log(JSON.stringify({passed:true,contract:gate.CONTRACT,mockCDP:true,actualPNGDecode:true,uncachedResponsesPerProbe:6,guestWASMResponses:2,actualJSOwnerResponses:4,parallelLanes:f.maxPending,changedTimerPair:true,phases:true,negatives,stickyUnknown:true,noReplay:true,hardwareGateUnchanged:true}));
})().catch(e=>{console.error(e);process.exitCode=1;});
