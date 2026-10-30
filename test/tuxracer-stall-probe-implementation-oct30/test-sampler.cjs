'use strict';
const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto');
const {code,compare}=require('./stall-sampler.cjs');
const runner=fs.readFileSync('test/run.js','utf8');
assert.equal(Buffer.byteLength(runner),692809);
assert.equal(crypto.createHash('sha256').update(runner).digest('hex'),'f96e9bb924700ee571e2904e097f80742ff55638399898ae1dc32454af05b02d');
// Execute the EXACT adapter declaration, including its parameter list, argument
// order and serialization. Only surrounding runtime state is a controlled fixture.
const start=runner.indexOf('  const controlSafeValue = (value) => {');
const end=runner.indexOf('  const controlPng = ',start);
assert(start>0&&end>start);
const adapter=runner.slice(start,end);
const make=(source=adapter)=>new Function('instance','renderer','memory','g2w','tickState','ctx','resolveAddr','moduleBases',source+'\nreturn controlEval;');
function suite(adapterSource=adapter,probe=code) {
 const buffer=new ArrayBuffer(4096), bytes=new Uint8Array(buffer);bytes.fill(0x5a);
 const state={batch:100,callsInBatch:2,lastTick:77,pausedMs:0};
 const renderer={inputQueue:[{msg:257}]};
 let calls=0;
 const exports={get_eip:()=>512,get_esp:()=>1024,get_yield_reason:()=>0,
  get_current_thread_id:()=>1,get_api_calls:()=>42,get_last_run_blocks:()=>1000,
  get_wait_handle:()=>0};
 const instance={exports},ctx={forbiddenCallback:()=>{calls++;throw Error('callback');}};
 let translate=x=>x;
 const invoke=()=>make(adapterSource)(instance,renderer,{buffer},x=>translate(x),state,ctx,()=>{throw Error('va must not be called');},{sdl:{loadAddr:0xa47000,origBase:0x10000000}})(probe);
 const before=Buffer.from(buffer), queue=JSON.stringify(renderer), ctxKeys=Object.keys(ctx);
 const a=invoke();assert.equal(a.status,'sampled');
 assert.equal(a.values.get_dbg_prev_eip.status,'unavailable');
 assert.equal(a.values.get_yield_reason.value,0);assert.equal(a.stack.bytes.length,32);
 assert.equal(a.modules[0].loadAddr.value,0xa47000);assert.equal(a.queue.length,1);
 state.batch=120;const b=invoke();assert(compare(a,b,[18569,18569]).externalPollFlat);
 assert(compare(a,b,[18569,18569]).batchAdvancing);
 assert(!compare(a,b,[18569,18570]).externalPollFlat);
 assert(!compare(a,a,[1,1]).batchAdvancing);
 translate=x=>0xf0+(x%512);assert.equal(invoke().ip.status,'unavailable');
 translate=()=>4096;assert.equal(invoke().stack.status,'unavailable');
 translate=x=>x===513?900:x;assert.equal(invoke().ip.status,'unavailable');
 translate=()=>{throw Error('bad page');};assert.equal(invoke().ip.status,'unavailable');
 translate=x=>x;exports.get_esp=()=>-1;assert.equal(invoke().stack.status,'unavailable');
 exports.get_eip=()=>{throw Error('no getter');};assert.equal(invoke().values.get_eip.status,'unavailable');
 assert.equal(calls,0);assert.deepEqual(Buffer.from(buffer),before);
 assert.equal(JSON.stringify(renderer),queue);assert.deepEqual(Object.keys(ctx),ctxKeys);
 return true;
}
suite();
function killed(fn){let caught=false;try{fn();}catch(_){caught=true;}assert(caught,'mutant survived');}
killed(()=>suite(adapter.replace("'tickState', 'ctx'","'brokenTickState', 'ctx'")));
killed(()=>suite(adapter,code.replace('offset<0x100','offset<0')));
console.log(JSON.stringify({PASS:true,adapterSHA256:crypto.createHash('sha256').update(adapter).digest('hex'),normal:true,missingGetter:true,invalidMemory:true,progressingBatchFlatExternalPoll:true,bindingMutantKilled:true,memoryMutantKilled:true,guestRuntime:false}));
