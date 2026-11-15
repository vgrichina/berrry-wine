'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const task=require('../tools/quake3-startup-task-controller.cjs'),helper=require('../tools/quake3-browser-controller.cjs');
function context(snapshot=()=>null,sink=()=>{}){
  return vm.createContext({performance,WebAssembly:{compile:()=>Promise.resolve(7)},__gltronObserver:{snapshot},[task.BINDING]:sink});
}
test('snapshot preserves identity, arguments, receiver, return and exceptions; body is isolated',()=>{
  const rows=[],payload={private:'SECRET'},owner={snapshot(...args){assert.equal(this,owner);assert.deepEqual(args,[7]);return payload;}};
  const c=context(null,s=>rows.push(JSON.parse(s)));c.__gltronObserver=owner;
  vm.runInContext(task.instrumentation(),c);assert.equal(owner.snapshot(7),payload);
  assert.deepEqual(rows.map(r=>r.phase),['entry','body-entry','body-complete','begin','end','stats']);
  assert(!JSON.stringify(rows).includes('SECRET'));
  const error=Error('SECRET'),d=context(()=>{throw error;});vm.runInContext(task.instrumentation(),d);
  assert.throws(()=>d.__gltronObserver.snapshot(),e=>e===error);
  const broken=context(()=>payload,()=>{throw error;});vm.runInContext(task.instrumentation(),broken);assert.equal(broken.__gltronObserver.snapshot(),payload);
});
test('ordinary native GL is called once with unchanged receiver/args/return/exception; no extra calls',()=>{
  const rows=[],args=[],failure=Error('private'),gl={drawArrays(...a){assert.equal(this,gl);args.push(a);return 73;},finish(){throw failure;}};
  class Canvas {getContext(type){return type==='webgl2'?gl:null;}}
  const c=context(()=>null,s=>rows.push(JSON.parse(s)));c.OffscreenCanvas=Canvas;vm.runInContext(task.instrumentation(),c);
  const canvas=new Canvas();assert.equal(canvas.getContext('webgl2'),gl);assert.equal(args.length,0);
  assert.equal(gl.drawArrays(4,0,3),73);assert.deepEqual(args,[[4,0,3]]);assert.throws(()=>gl.finish(),e=>e===failure);
  assert(!JSON.stringify(rows).includes('private'));assert(rows.some(r=>r.kind==='gl-finish'&&r.exception));
});
test('WASM async return promise identity and rejection are preserved',async()=>{
  const promise=Promise.resolve(91),rows=[],c=context(()=>null,s=>rows.push(JSON.parse(s)));
  c.WebAssembly.compile=function(arg){assert.equal(arg,promise);return promise;};
  vm.runInContext(task.instrumentation(),c);assert.equal(c.WebAssembly.compile(promise),promise);await promise;await Promise.resolve();
  assert(rows.some(r=>r.kind==='wasm-dispatch-compile'&&r.phase==='end'));
  const error=Error('private'),rejection=Promise.reject(error);c.WebAssembly.instantiate=()=>rejection;
  const d=context(()=>null,s=>rows.push(JSON.parse(s)));d.WebAssembly.instantiate=()=>rejection;
  vm.runInContext(task.instrumentation(),d);assert.equal(d.WebAssembly.instantiate(),rejection);
  await assert.rejects(rejection,e=>e===error);await Promise.resolve();
  // No settlement handler may be attached: that would alter the platform's
  // unhandled-rejection behavior for a caller that does not await the promise.
  let handlers=0;const untouched=Promise.resolve(11);untouched.then=()=>{handlers++;throw Error('observer attached handler');};
  const e=context();e.WebAssembly.compile=()=>untouched;vm.runInContext(task.instrumentation(),e);
  assert.equal(e.WebAssembly.compile(),untouched);assert.equal(handlers,0);
});
test('hard event cap reports drops and never prevents ordinary results',()=>{
  let emitted=0,calls=0,last;const c=context(()=>{calls++;return 71;},s=>{emitted++;last=JSON.parse(s);});
  vm.runInContext(task.instrumentation(),c);
  for(let i=0;i<6100;i++)assert.equal(c.__gltronObserver.snapshot(),71);
  assert.equal(calls,6100);assert.equal(emitted,task.LIMIT);assert(c.__q3Task.stats().dropped>0);
  assert.equal(last.phase,'overflow');assert.equal(task.metadata(last).totalLaterDrops,null);
});
test('metadata is bounded, strips payload, rejects malformed clocks and identity',()=>{
  const base={kind:'snapshot',seq:1,phase:'entry',ms:1,epochMs:10001,endpoint:null,owner:null,payload:'SECRET'};
  assert(!JSON.stringify(task.metadata(base)).includes('SECRET'));
  for(const patch of [{phase:'memory'},{seq:0},{ms:NaN},{kind:'private'},{endpoint:'wrong'}])assert.throws(()=>task.metadata({...base,...patch}));
});
test('source composition retains original control/query/terminal rules; anchors fail closed',()=>{
  const source=fs.readFileSync('tools/quake3-browser-controller.cjs','utf8'),composed=task.compose(source);
  assert(composed.includes('},3000)')||composed.includes('),3000)')||composed.includes('}),3000)'));
  assert(composed.includes("evaluate('globalThis.__gltronObserver?.snapshot?.()??null',w.sessionId)"));
  assert.equal(typeof task.controller().browser,'function');
  const worker=fs.readFileSync('lib/d3d-render-worker.js','utf8'),changed=task.workerSource(worker);
  assert(changed.includes('await processMessage(msg)'));assert(changed.includes('instance?.exports.d3d_render_reset_transients?.()'));
  assert.throws(()=>task.workerSource(worker.replace('messageChain = messageChain.then','messageChain = something.then')),/anchor/);
  assert.throws(()=>task.compose(source.replace('c.event=v=>{','c.event = v => {')),/anchor/);
  const host=fs.readFileSync('host.js','utf8'),changedHost=task.hostSource(host);new vm.Script(changedHost);
  assert.equal((changedHost.match(/await WebAssembly.compile\(/g)||[]).length,(host.match(/await WebAssembly.compile\(/g)||[]).length);
  assert.equal(Buffer.byteLength('globalThis.__gltronObserver?.snapshot?.()??null'),47);
  assert.equal(helper.gameplayCutoff({at:0,deadline:1800}),1620000);
});
test('task attribution never infers missing body, identity, or an asynchronous native cause',()=>{
  const request={id:1,sequence:1,sessionId:'s',targetId:'t',startedAt:10000,expression:{sha256:helper.sha(latencySnapshot())}};
  const response={id:1,sequence:8,sessionId:'s',targetId:'t',sessionMatches:true,expressionException:false,protocolErrorCode:null,resultType:'object',at:13404,elapsedMs:3404,afterTerminal:true};
  const e=(phase,ms,kind='snapshot',seq=2)=>({phase,ms,epochMs:10000+ms,kind,seq,endpoint:1,owner:0,sessionId:'s',targetId:'t'});
  const events=[e('entry',3400),e('body-entry',3401),e('body-complete',3402),e('end',3403),e('begin',-10,'message',1),e('end',3400,'message',1)];
  const r=task.attribute({request,response,events});assert.equal(r.queueMs,3400);assert.equal(r.bodyMs,1);assert(r.enclosingSendSpans[0].asynchronousEnvelope);assert.equal(r.inspectorDispatchMs,null);
  assert.equal(task.attribute({request,response,events:[]}).bodyMs,null);
  assert.equal(task.attribute({request,response:{...response,sessionMatches:false},events}).bodyMs,null);
  assert.equal(task.attribute({request,response,events:events.map(v=>({...v,targetId:'other'}))}).bodyMs,null);
});
function latencySnapshot(){return 'globalThis.__gltronObserver?.snapshot?.()??null';}
