'use strict';
// Adapter identities and request closure only; native qualification is separate.
const assert=require('node:assert/strict'),{startObserved,POLICY}=require('../tools/hexen2-native-user-causal.cjs');
const {compile}=require('../tools/watx');
const {ABI}=require('../lib/native-user-causal-observer');
const fields=ABI.map(n=>`(func $${n} (export "${n}") (result i32) (i32.const 1))`).join('\n');
const result=compile(fields,new Map(),{mode:'production',standardWat:true,runtimeBuiltins:false});
assert(result.success,result.error);
const module_=new WebAssembly.Module(result.wasmBinary),memory={buffer:new SharedArrayBuffer(64)};
let sends=0,arms=0;const receiver={};
const proto={postMessage:function(message){assert.equal(this,receiver);sends++;assert(message.nativeUserCausal);}};
const original=proto.postMessage;
const link={slot:0,module:module_,memory,endpointIdentity:7,worker:null,
  start(){this.worker=receiver;proto.postMessage.call(receiver,{t:'init',slot:0,module:module_,memory,endpointIdentity:7});return Promise.resolve();},
  async _ask(message){arms++;assert.equal(message.nonce,'0123456789abcdef');return {armed:true,endpointIdentity:7,imports:['check_input']};}};
(async()=>{
  const options={workerPrototype:proto,module:module_,memory,workerSHA256:'a'.repeat(64),verifiedWorkerSHA256:'a'.repeat(64)};
  assert.throws(()=>startObserved({...link},{...options,verifiedWorkerSHA256:'b'.repeat(64)}),/qualified/);
  const adapter=startObserved(link,options);assert.equal(proto.postMessage,original);assert.equal(sends,1);
  assert.deepEqual(POLICY,{nativeMs:500,sourceMs:30000,reviewMs:15000,freshFrameMs:5000,maxHoldMs:1500,completeFrame:true,privateIdentity:true,physicalUp:true});
  await adapter.prearm('0123456789abcdef');assert.equal(arms,1);
  assert.equal(adapter.firstUnknown('actual first UNKNOWN').laterRequests,0);
  for(let i=0;i<4;i++)adapter.retained();
  await assert.rejects(adapter.prearm('0123456789abcdef'),/closed/);
  assert.equal(arms,1);assert.equal(sends,1);
  console.log('PASS exact owner/init, Worker hash equality, prearm once, first UNKNOWN local retained reads and zero later requests; fixed policy');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
