'use strict';
const assert=require('node:assert/strict'),{test}=require('node:test');
const {attach}={attach:require('../tools/warcraft3-current-controller.cjs').createPassiveNativeTrace};
test('circular, throwing getter, proxy and huge objects are never inspected or retained',()=>{
 let accesses=0,calls=0;
 const circular={};circular.self=circular;
 const getter=Object.defineProperty({},'x',{get(){accesses++;throw Error('getter');}});
 const proxy=new Proxy({}, {get(){accesses++;throw Error('proxy');},ownKeys(){accesses++;throw Error('keys');}});
 const huge={text:'x'.repeat(1000000),circular,getter,proxy};
 for(const value of [circular,getter,proxy,huge]){
  const api=attach({dequeued(v){calls++;assert.equal(v,value);assert.equal(this,api);return value;}});
  for(let i=0;i<1000;i++)assert.equal(api.dequeued(value),value);
  const s=api.traceSnapshot();assert.equal(s.rows.length,256*8);assert.equal(s.count,2000);
  assert(s.rows.every(Number.isFinite));assert(JSON.stringify(s).length<40000);
 }
 assert.equal(calls,4000);assert.equal(accesses,0);
});
test('exact returns and exception identity survive nesting and ring wrap',()=>{
 for(const value of [0,1,false,true,null,undefined,NaN,Infinity,1n,Symbol('s'),()=>0]){
  const api=attach({observe(){return value;}});assert(Object.is(api.observe(),value));
 }
 for(const sentinel of [Error('native'),{},null,undefined,42]){
  const api=attach({dequeued(){throw sentinel;}});let caught=false;
  try{api.dequeued();}catch(e){caught=true;assert.equal(e,sentinel);}assert(caught);
  assert.equal(api.traceSnapshot().rows[8+3],2);
 }
 const api=attach({withActor(slot,name,fn){return fn();},observe(){return 7;}});
 assert.equal(api.withActor(0,'check_input',()=>api.observe()),7);
});
test('method accessors are skipped, no timer/log sink or renderer dependency',()=>{
 let calls=0;const api={};Object.defineProperty(api,'status',{get(){calls++;throw Error('accessor');}});
 attach(api);assert.equal(calls,0);assert.equal(api.traceSnapshot().count,0);
 const source=attach.toString();
 assert(!/JSON\.stringify|console\.|setInterval|setTimeout/.test(source));
});
test('browser bootstrap preserves factory/callback semantics even if diagnostic clock throws',()=>{
 const vm=require('node:vm'),{passiveNativeTraceBootstrap}=require('../tools/warcraft3-current-controller.cjs');
 const sentinel=Error('real callback failure'),factoryError=Error('real factory failure');let calls=0;
 const api={dequeued(v){calls++;if(v===sentinel)throw v;return v;}};
 const context=vm.createContext({performance:{now(){throw Error('diagnostic clock failure');}},
  createBrowserNativeInput:function(...args){assert.equal(this,contextReceiver);assert.equal(args[0],1);if(args[1])throw factoryError;return api;}});
 const contextReceiver={};vm.runInContext(passiveNativeTraceBootstrap(),context);
 assert.equal(context.createBrowserNativeInput.call(contextReceiver,1),api);
 const circular={};circular.self=circular;
 assert.equal(api.dequeued(circular),circular);
 assert.throws(()=>api.dequeued(sentinel),e=>e===sentinel);
 assert.throws(()=>context.createBrowserNativeInput.call(contextReceiver,1,true),e=>e===factoryError);
 assert.equal(calls,2);
});
