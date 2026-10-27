'use strict';
// Focused source-only acceptance. Production scanner CLI runs first separately.
const fs=require('fs'),assert=require('assert');
const {check,checkNonlocalAPIs}=require('../tools/callback-ownership-census');
const census=JSON.parse(fs.readFileSync('tools/callback-ownership-census.json'));
assert.equal(census.entries.length,407);
assert.deepEqual(check(census.entries,census),[]);
for(const file of ['lib/renderer-input.js','lib/thread-manager.js']) {
 const altered=structuredClone(census.entries);
 altered.find(e=>e.file===file).sha256='0'.repeat(64);
 assert(check(altered,census).some(e=>e.includes('changed producer '+file)));
 const claim=structuredClone(census);
 claim.entries.find(e=>e.file===file).ownership='covered';
 assert(check(census.entries,claim).some(e=>e.includes('unsupported ownership assertion')));
}
assert(checkNonlocalAPIs([], [{name:'longjmp'}]).length);
assert(checkNonlocalAPIs([{file:'src/reject.wat',src:'(func $handle_longjmp)'}],[]).length);
// Evaluate precisely the observed method, with the production class source pinned
// by the separate identity check. This supplements, not replaces, the CLI gate.
const src=fs.readFileSync('lib/thread-manager.js','utf8');
const method=src.slice(src.indexOf('  isMainSleeping(observe) {'),src.indexOf('\n  // Guest ms left',src.indexOf('  isMainSleeping(observe) {')));
const subject=Function('return class {'+method+'}')();
const obj=new subject();let reads=0;
obj._waitNow=()=>{reads++;return 5};obj._mainSleepUntil=10;
assert.equal(obj.isMainSleeping(),true);assert.equal(reads,1);
reads=0;let snapshot;
assert.equal(obj.isMainSleeping(s=>{snapshot=s;obj._mainSleepUntil=0}),true);
assert.deepEqual(snapshot,{now:5,deadline:10,sleeping:true});assert.equal(reads,1);
reads=0;
assert.equal(obj.isMainSleeping(s=>snapshot=s),false);
assert.deepEqual(snapshot,{now:null,deadline:0,sleeping:false});assert.equal(reads,0);
const failure=new Error('observer rejection');
assert.throws(()=>obj.isMainSleeping(()=>{throw failure}),e=>e===failure);
obj._mainSleepUntil=10;
assert.equal(obj.isMainSleeping(()=>assert.equal(obj.isMainSleeping(),true)),true);
assert(!Object.values(obj).includes(snapshot));
console.log('PASS: two producer hash controls, ownership rejection, independent nonlocal rejection, observer default/single-read/short-circuit/captured-result/exception/nesting');
