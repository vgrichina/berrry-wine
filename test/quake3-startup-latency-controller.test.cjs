'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {hash}=require('../tools/quake3-startup-observer.cjs');
const {SNAPSHOT,BINDING,timingEvent,instrumentation,attribute,historical}=require('../tools/quake3-startup-latency-controller.cjs');
function pair(queue=3400,body=2,wrapper=body){
  const request={type:'request',id:1574,sequence:1,sessionId:'s',targetId:'w',startedAt:10000,expression:{sha256:hash(SNAPSHOT)}};
  const response={type:'response',id:1574,sequence:9,sessionId:'s',targetId:'w',sessionMatches:true,expressionException:false,protocolErrorCode:null,resultType:'object',at:10000+queue+wrapper+3,elapsedMs:queue+wrapper+3,afterTerminal:queue+wrapper>3000};
  const event=(phase,ms)=>({phase,seq:1,sessionId:'s',ms,epochMs:10000+ms});
  return {request,response,events:[event('entry',queue),event('body-entry',queue+wrapper-body),event('body-complete',queue+wrapper),event('complete',queue+wrapper)]};
}
test('queue, real body, fixture wrapper and return transport stay separate',()=>{
  const q=attribute(pair());assert.equal(q.queueMs,3400);assert.equal(q.bodyMs,2);assert.equal(q.completionToResponseMs,3);
  const b=attribute(pair(2,3400));assert.equal(b.queueMs,2);assert.equal(b.bodyMs,3400);
  const injected=attribute(pair(2,1,3401));assert.equal(injected.injectedWrapperMs,3400);assert.equal(injected.bodyMs,1);
});
test('missing historical entry cannot be supplied by controlled reproduction',()=>{
  const p=pair();p.events=[];const r=attribute(p);assert.equal(r.attribution,'unproved');assert.equal(r.bodyMs,null);assert.equal(r.queueMs,null);
});
test('identity/error/ambiguous sequence/clock negatives cannot qualify as body or queue',()=>{
  for(const patch of [{sessionId:'new'},{targetId:'new'},{sessionMatches:false},{expressionException:true},{protocolErrorCode:-32000},{resultType:'undefined'}]){
    const p=pair();Object.assign(p.response,patch);assert.throws(()=>attribute(p));
  }
  for(const method of ['Target.detachedFromTarget','Runtime.executionContextsCleared','Target.targetCrashed']){
    const p=pair();p.lifecycle=[{sequence:5,sessionId:'s',targetId:'w',method}];assert.throws(()=>attribute(p),/invalidated/);
  }
  let p=pair();p.events.push(p.events[0]);assert.throws(()=>attribute(p),/ambiguous/);
  p=pair();p.events[0].epochMs=1;assert.throws(()=>attribute(p),/clock-domain/);
  p=pair();p.events[2].ms=1;assert.throws(()=>attribute(p),/nonmonotonic/);
});
test('historical 4445ms is from send; terminal-relative time is separate; no replay allowed',()=>{
  const p=pair();p.response.elapsedMs=4445.490118;p.response.monotonicMs=4545.490118;
  const terminal={type:'terminal',sequence:5,terminal:{trigger:{id:1574},monotonicMs:3112.087712}};
  const r=historical([p.request,terminal,p.response]);assert.equal(r.elapsedFromSendMs,4445.490118);assert(Math.abs(r.elapsedAfterTerminalMs-1433.402406)<1e-7);assert.equal(r.attribution,'unproved');
  assert.throws(()=>historical([p.request,terminal,p.response,{...p.request,sequence:10}]),/after UNKNOWN/);
});
test('instrumentation calls original exactly once, preserves this/args/result/throw, logs no payload',()=>{
  const rows=[],payload={private:'SECRET'},owner={snapshot(...args){assert.equal(this,owner);assert.deepEqual(args,[7]);return payload;}};
  const ctx=vm.createContext({performance,__gltronObserver:owner,[BINDING]:s=>rows.push(JSON.parse(s))});
  assert.equal(vm.runInContext(instrumentation(),ctx),true);assert.equal(owner.snapshot(7),payload);
  assert.deepEqual(rows.map(r=>r.phase),['entry','body-entry','body-complete','complete']);assert(!JSON.stringify(rows).includes('SECRET'));
  const error=Error('SECRET'),bad={snapshot(){throw error;}};const failed=[];
  const c=vm.createContext({performance,__gltronObserver:bad,[BINDING]:s=>failed.push(JSON.parse(s))});vm.runInContext(instrumentation(),c);assert.throws(()=>bad.snapshot(),e=>e===error);assert.equal(failed.at(-1).phase,'exception');assert(!JSON.stringify(failed).includes('SECRET'));
  const sinkFailure={snapshot(){return payload;}};
  const broken=vm.createContext({performance,__gltronObserver:sinkFailure,[BINDING]:()=>{throw Error('sink');}});
  vm.runInContext(instrumentation(),broken);assert.equal(sinkFailure.snapshot(),payload);
});
test('timing bindings strip unknown/private fields and reject invalid phases and clocks',()=>{
  const v={phase:'entry',seq:1,ms:1,epochMs:10001,payload:'SECRET'};assert(!JSON.stringify(timingEvent(v)).includes('SECRET'));
  for(const patch of [{phase:'memory'},{seq:-1},{ms:NaN},{epochMs:Infinity}])assert.throws(()=>timingEvent({...v,...patch}));
  assert.throws(()=>instrumentation({bodyDelayMs:99999}));assert.equal(Buffer.byteLength(SNAPSHOT),47);assert.equal(hash(SNAPSHOT),'000ba5e8856b8d2a95512815f84b8ee419cdcb73dbe015ee87dc832cc883f31c');
});
test('WebGL timing observes ordinary calls only and preserves native returns and exceptions',()=>{
  const rows=[],calls=[],failure=Error('private driver text');
  const gl={drawArrays(...args){assert.equal(this,gl);calls.push(args);return 73;},compileShader(){throw failure;}};
  class Canvas {getContext(type){return type==='webgl2'?gl:null;}}
  const c=vm.createContext({performance,OffscreenCanvas:Canvas,__gltronObserver:{snapshot:()=>null},[BINDING]:s=>rows.push(JSON.parse(s))});
  vm.runInContext(instrumentation(),c);assert.equal(rows.length,0);assert.equal(calls.length,0);
  const canvas=new Canvas();assert.equal(canvas.getContext('2d'),null);assert.equal(canvas.getContext('webgl2'),gl);canvas.getContext('webgl2');
  assert.equal(gl.drawArrays(4,0,3),73);assert.deepEqual(calls,[[4,0,3]]);assert.deepEqual(rows.map(r=>r.phase),['gl-drawArrays-entry','gl-drawArrays-complete']);
  assert.throws(()=>gl.compileShader(),e=>e===failure);assert.equal(rows.at(-1).phase,'gl-compileShader-exception');assert(!JSON.stringify(rows).includes('private driver text'));
});
