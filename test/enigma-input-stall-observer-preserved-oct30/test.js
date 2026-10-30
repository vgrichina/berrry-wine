'use strict';
const assert = require('assert/strict'), fs = require('fs');
const fixture = fs.readFileSync(__dirname + '/exact-boundary.js.inc', 'utf8');
const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
async function exercise(body, observerModule = null) {
  const code = `
    let state = {pc: 0x401000, api: 22, yr: 0, yf: 0}, callbacks = 0;
    const memory = new Uint8Array([1,2,3,4]);
    const exports = {get_eip:()=>state.pc, get_api_calls:()=>state.api,
      get_yield_reason:()=>state.yr, get_yield_flag:()=>state.yf,
      get_current_thread_id:()=>1, run:()=>{state.pc+=4; return 17;}};
    const WebAssembly = {instantiate:async()=>({exports})}, wasmModule={}, imports={};
    const batchClock={state:{batch:94150}}, hasFlag=()=>true, logs=[];
    let inputEvent=null, lastInputEvent=null;
    const crossThreadMsgs=[], inputQueue=[], renderer={inputQueue:[{msg:256},{msg:257}]};
    const h={check_input:()=>{callbacks++;return 0;}}, ctx={};
    const BATCH_SIZE=10, mainExecutionSuspended=()=>state.yr!==0;
    ${body}
    threadManager={threads:new Map([[2,{tid:2,state:'active',suspendCount:0,instance:{exports}}]])};
    const sample=()=>handleControlCommand({action:'input-stall'});
    // Keep the real retained wrapper active and verify sampling never calls it.
    h.check_input(); guestPollTrace.entries=18569;
    const before=JSON.stringify({memory:[...memory],crossThreadMsgs,inputQueue,renderer,callbacks});
    const first=sample(); assert.equal(first.polls,18569);assert.equal(first.main.pc,0x401000);
    assert.equal(first.threads[0].tid,2); assert.equal(first.main.apiCalls,22);
    dispatch(); tickState.batch++; const busy=sample();
    assert.equal(busy.evidence,'main-slices-completed-without-input-poll');
    assert.equal(busy.delta.completed,1);assert.equal(busy.main.pc,0x401004);
    state.yr=7;state.yf=1;tickState.batch++;dispatch();const wait=sample();
    assert.equal(wait.evidence,'yield-or-wait-observed');assert.equal(wait.delta.completed,0);
    state.yr=0;tickState.batch++;const absent=sample();
    assert.equal(absent.evidence,'main-not-dispatched-between-samples');
    assert.equal(absent.schedulerStarvation.available,false);
    assert.equal(absent.apiName.available,false);
    h.check_input(); const progressing=sample();assert.equal(progressing.evidence,'input-poll-progress');
    assert.equal(callbacks,2);callbacks--;
    assert.equal(JSON.stringify({memory:[...memory],crossThreadMsgs,inputQueue,renderer,callbacks}),before);
    delete exports.get_eip;threadManager=null;const missing=sample();
    assert.equal(missing.main.pc.available,false);assert.equal(missing.threads.available,false);
    assert.equal(missing.uninterruptedExecution.available,false);
    exports.get_eip=()=>{throw Error('unavailable reader')};
    assert.equal(sample().main.pc.available,false);
    // A JS state accessor must never be invoked as an observation callback.
    let invoked=0; threadManager={};Object.defineProperty(threadManager,'threads',{get(){invoked++;throw Error();}});
    sample();assert.equal(invoked,0);
    return true;
  `;
  return new AsyncFunction('require','assert',code)(observerModule ? name => name === './enigma-stall-observer.js' ? observerModule : require(name) : require,assert);
}
(async()=>{
  // Behavioral production boundary first, before helper-only negative cases.
  await exercise(fixture);
  let killed=false;
  try {await exercise(fixture.replace('({ instance, threadManager, tickState, guestPollTrace,','({ instance: ctx.instance, threadManager: ctx.threadManager, tickState, guestPollTrace,'));}
  catch (e) {assert.equal(e.code,'ERR_ASSERTION');killed=true;}
  assert.equal(killed,true,'broken lexical-binding mutant survived');
  let stateMutantKilled=false;
  const source=fs.readFileSync(__dirname+'/enigma-stall-observer.js','utf8');
  const mutantModule={exports:{}};
  new Function('module',source.replace("global(e, 'get_eip')","global(e, 'get_api_calls')"))(mutantModule);
  try {await exercise(fixture, mutantModule.exports);}
  catch (e) {assert.equal(e.code,'ERR_ASSERTION');stateMutantKilled=true;}
  assert.equal(stateMutantKilled,true,'wrong PC reader mutant survived');
  const {createObserver}=require('./enigma-stall-observer.js');
  assert.equal(createObserver({enabled:false,read:()=>{throw Error();}}).sample().available,false);
  assert.equal(createObserver({enabled:true,read:()=>{throw Error();}}).sample().available,false);
  console.log(JSON.stringify({PASS:true,exactDeclarations:true,busy:true,wait:true,dispatchAbsence:true,
    unavailable:true,noninterference:true,bindingMutantKilled:true,stateMutantKilled:true,runtime:false}));
})().catch(e=>{console.error(e);process.exitCode=1;});
