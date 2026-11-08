'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),crypto=require('node:crypto');
const api=require('./strict-software-owner.cjs');
function fixture(mutate=()=>{}){
 const memory={buffer:new SharedArrayBuffer(128)},instance={exports:{}},canvas={width:2,height:2},layer={canvas,ctx:{canvas}},win={hwnd:7,processId:1000,wasm:instance,wasmMemory:memory,_dxFrameLayer:layer};
 const surface={slot:2,dibWa:16,w:2,h:2,pitch:4,bpp:16};
 const observation={copy:null,current:()=>({...surface,memory:memory.buffer,allocationGeneration:1})};
 const decoder=function decoder(){},compositor=function compositor(){},renderer={windows:{7:win},_repaintOnce:compositor};
 const gdi={fallbackObservation:observation,presentBestDxOffscreen:decoder},ctx={instance,exports:instance.exports,renderer,sharedGdi:gdi};
 const w={running:true,processId:1000,hostCtx:ctx,renderer,instance,memory};
 const realm=vm.createContext({w,crypto:crypto.webcrypto,Date});
 const scripts=new Map([['1',{url:'decoder.js',scriptLanguage:'JavaScript',executionContextId:1}],['2',{url:'renderer.js',scriptLanguage:'JavaScript',executionContextId:1}]]);
 const texts={'1':'real decoder module','2':'real renderer module'},hash=s=>crypto.createHash('sha256').update(s).digest('hex');
 const expected={decoder:{url:'decoder.js',sha256:hash(texts['1'])},compositor:{url:'renderer.js',sha256:hash(texts['2'])}};
 let calls=[],pending=0,maxPending=0;
 async function send(method,args){calls.push({method,args});
  if(method==='Runtime.evaluate'){
   try{const result=vm.runInContext(args.expression,realm);return {result:args.returnByValue?{value:structuredClone(result)}:{type:'function',objectId:result===decoder?'1':'2'}};}catch(e){return {exceptionDetails:{text:e.message}};}
  }
  if(method==='Runtime.getProperties')return {internalProperties:[{name:'[[FunctionLocation]]',value:{value:{scriptId:args.objectId}}}]};
  if(method==='Debugger.getScriptSource'){pending++;maxPending=Math.max(maxPending,pending);await new Promise(r=>setImmediate(r));pending--;mutate({w,ctx,renderer,observation,win,surface,layer,scripts,texts,args});return {scriptSource:texts[args.scriptId]};}
  if(method==='Runtime.releaseObject')return {};
  throw Error(method);
 }
 const options={send,session:'page',scripts,expected,sameHostClock:true};
 const copy=()=>observation.copy({source:'selected-fallback',copied:true,copyGeneration:1,allocationGeneration:1,surface:{...surface},memory:memory.buffer,hwnd:7,window:win,layer,destination:canvas});
 return {options,send,copy,realm,w,observation,get calls(){return calls;},get maxPending(){return maxPending;}};
}
(async()=>{
 const f=fixture();await api.install({...f.options,ownerExpression:'w'});f.copy();
 const attestor=api.createAttestor(f.options),a=await attestor.read(),b=await attestor.read();
 assert.equal(a.gateEligible,false);assert.equal(b.gateEligible,false);
 assert.equal(f.calls.filter(c=>c.method==='Debugger.getScriptSource').length,4);assert.equal(f.maxPending,2);
 assert(a.responses.every(r=>r.uncached&&r.kind==='JavaScript'));
 await assert.rejects(()=>api.install({...f.options,ownerExpression:'w'}),/identity reuse/);
 let negatives=0;
 const variants=[
  x=>{x.w.running=false;},x=>{x.w._stopped=true;},x=>{x.w.hostCtx={...x.ctx};},
  x=>{x.ctx.instance={exports:{}};},x=>{x.ctx.exports={};},x=>{x.w.memory={buffer:x.w.memory.buffer};},
  x=>{x.win.wasm={};},x=>{x.win.processId=99;},x=>{x.win.wasmMemory={};},
  x=>{x.win._dxFrameLayer={...x.layer};},x=>{x.layer.canvas={};},x=>{x.layer.ctx={canvas:{}};},
  x=>{x.observation.current=()=>null;},x=>{const old=x.observation.current;x.observation.current=()=>({...old(),allocationGeneration:2});},
  x=>{x.surface.dibWa++;},x=>{x.surface.pitch++;},x=>{x.surface.w++;},x=>{x.renderer._repaintOnce=()=>{};},
  x=>{x.w._renderWorkerManager={ports:new Map([[1,{closed:false}]])};},
  x=>{x.texts['1']='wrong bytes';},x=>{x.scripts.get('2').executionContextId=9;},x=>{x.scripts.get('1').url='impostor.js';},
  x=>{x.scripts.get('1').scriptLanguage='WebAssembly';},x=>{delete x.texts['2'];},
 ];
 for(const mutate of variants){const n=fixture(mutate);await api.install({...n.options,ownerExpression:'w'});n.copy();const guard=api.createAttestor(n.options);await assert.rejects(()=>guard.read(),undefined,"negative "+negatives+" "+mutate);assert(guard.closed);const count=n.calls.length;await assert.rejects(()=>guard.read(),/no replay/);assert.equal(n.calls.length,count);negatives++;}
 const absent=fixture();await api.install({...absent.options,ownerExpression:'w'});await assert.rejects(()=>api.createAttestor(absent.options).read(),/no observed/);negatives++;
 const stale=fixture();await api.install({...stale.options,ownerExpression:'w'});stale.copy();await assert.rejects(()=>api.createAttestor({...stale.options,now:()=>Date.now()+300}).read(),/stale/);negatives++;
 const clipped=fixture();await api.install({...clipped.options,ownerExpression:'w'});clipped.observation.copy({copied:false});clipped.copy();await assert.rejects(()=>api.createAttestor(clipped.options).read(),/UNKNOWN/);negatives++;
 const clock=fixture(),clockGuard=api.createAttestor({...clock.options,sameHostClock:false});await assert.rejects(()=>clockGuard.read(),/same-host clock/);assert.equal(clock.calls.length,0);assert(clockGuard.closed);negatives++;
 console.log(JSON.stringify({passed:true,independentUncachedResponses:4,parallelLanes:f.maxPending,negatives,stickyUnknown:true,existingGateEligible:false}));
})().catch(e=>{console.error(e);process.exitCode=1;});
