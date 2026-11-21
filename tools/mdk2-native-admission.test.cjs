'use strict';
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {admission}=require('./mdk2-native-admission.cjs');

function control({ready=true,refuse=false,prepared='PREPARED'}={}){
 const calls=[],scene=[1,1000,65537,65537,0,0,1,0,1,0];
 const g={snapshot(){calls.push('snapshot');return {scene,slot:0,ready,readiness:{predicates:{fresh:ready}}};},
  bind(){calls.push('bind');if(refuse)throw Error('browser native owner unavailable or already bound');return {owner:'owned',scene,slot:0};},
  prepare(i){calls.push('prepare');assert.equal(i.owner,'owned');return {state:prepared};}};
 const w={processId:1000,running:true,_browserNativeInput:g,renderer:{windows:{}},guestWorker:{link:{slot:0}}};
 const sandbox={window:{fixtureWine:w},document:{hasFocus:()=>true,visibilityState:'visible'}};
 const run=arg=>vm.runInNewContext('('+admission.toString()+')(arg)',{...sandbox,arg});
 return {calls,run};
}
// An expired observation is not a bind attempt, and cannot manufacture input.
let c=control({ready:false}),v=c.run();
assert.equal(v.state,'WAIT');assert.deepEqual(c.calls,['snapshot']);
// The exact pre-bind diagnostic survives a refusal in the same invocation.
c=control({refuse:true});v=c.run({intent:{nonce:'one'}});
assert.equal(v.state,'UNKNOWN');assert.equal(v.stage,'bind');
assert(v.before.ready);assert.equal(v.identity.native.main,65537);
assert.match(v.error,/owner unavailable/);assert.deepEqual(c.calls,['snapshot','bind']);
// Preparing is part of that same invocation; preserve its actual result.
c=control();v=c.run({intent:{nonce:'one'}});
assert.equal(v.state,'PREPARED');assert.deepEqual(c.calls,['snapshot','bind','prepare']);
c=control({prepared:'CANCELLED'});v=c.run({intent:{nonce:'one'}});
assert.equal(v.state,'CANCELLED');assert.deepEqual(c.calls,['snapshot','bind','prepare']);
console.log('PASS expired readiness grants no bind; refusal retains pre-bind diagnostics with zero later reads; prepare result preserved');
