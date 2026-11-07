'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {NeLoadError} = require('../lib/ne-load-error');
const {readNeGuestString} = require('../lib/ne-guest-bridge');
const memory = new Uint8Array(1024);
memory.set([65,66,0], 400);
assert.equal(readNeGuestString({guest_to_wasm:p=>p-0x10000+400},memory.buffer,0x10000,2),'AB');
assert.throws(()=>readNeGuestString({guest_to_wasm:()=>0xf0},memory.buffer,0x10000,10),/Unmapped/);
assert.throws(()=>readNeGuestString({guest_to_wasm:()=>400},memory.buffer,0x10000,2),/Unterminated/);
assert.throws(()=>readNeGuestString({},memory.buffer,0xffffffff,2),/pointer/);
const sparse = {guest_to_wasm:p=>p===0x10000?400:p===0x10001?900:901};
memory[900]=67;memory[901]=0;
assert.equal(readNeGuestString(sparse,memory.buffer,0x10000,2),'AC');

// Host protocol controls only; the separate candidate test runs real PE/NE.
function serviceFixture(operation, behavior = {}) {
  let valid=true, settled=[], trace=[];
  const e={get_yield_reason:()=>18,win16_guest_request_token:()=>7n,
    win16_guest_request_valid:t=>valid&&t===7n,
    win16_guest_request_field:(_t,f)=>[operation,0x10000,2][f],
    win16_guest_request_settle:(t,v)=>{assert.equal(t,7n);settled.push(v);valid=false;return 1;},
    guest_to_wasm:p=>p-0x10000+400};
  const lifecycle={retainGuest:()=>0,loadGuest:()=>257,lookupGuest:()=>0x170010,
    releaseGuest:()=>{},retryTermination:id=>trace.push(['retry',id]),...behavior};
  const browser=vm.createContext({Uint8Array,NeLoadErrorApi:{NeLoadError},
    NeSources:{canonicalNeName:n=>n,prepareNeSources:()=>({name:'AB',sources:[]})},
    NeLifecycle:{createNeLifecycle:()=>lifecycle}});
  vm.runInContext(fs.readFileSync(require.resolve('../lib/ne-guest-bridge'),'utf8'),browser);
  return {run:opts=>browser.NeGuestBridge.serviceNeGuestYieldSync({exports:e,memoryBuffer:memory.buffer,...opts}),
    settled,trace,e,invalidate(){valid=false;}};
}
let f=serviceFixture(1);assert.equal(f.run(),true);assert.deepEqual(f.settled,[257]);
assert.throws(()=>f.run(),/Stale/);assert.equal(f.settled.length,1);
f=serviceFixture(2);f.run();assert.deepEqual(f.settled,[0]);
f=serviceFixture(3);f.run();assert.deepEqual(f.settled,[0x170010]);
f=serviceFixture(1,{loadGuest:()=>{throw new NeLoadError(0,'AX zero');}});f.run();assert.deepEqual(f.settled,[0]);
const trap=Error('guest trap');
f=serviceFixture(1,{loadGuest:()=>{throw trap;}});assert.throws(()=>f.run(),e=>e===trap);assert.deepEqual(f.settled,[]);
f=serviceFixture(1,{loadGuest:()=>{f.invalidate();return 257;}});assert.throws(()=>f.run(),/settlement rejected/);assert.deepEqual(f.settled,[]);
const retained=Object.assign(Error('WEP trap'),{pendingTerminations:[13]});
f=serviceFixture(2,{releaseGuest:()=>{throw retained;}});assert.throws(()=>f.run(),e=>e===retained);
assert.deepEqual(f.settled,[]);assert.deepEqual(f.trace,[]);retained.neRecovery.retry(13);assert.deepEqual(f.trace,[['retry',13]]);
assert.throws(()=>retained.neRecovery.retry(14),/Unowned/);
f=serviceFixture(1);assert.equal(f.run({neBackend:'worker'}),true);assert.deepEqual(f.settled,[257]);
console.log('PASS NE host request service: sparse strings, exactly-once settlement, stale completion, typed errors, explicit WEP retry and prepared Worker service');

// Execute the production browser entry methods with a captured ProcessBoot
// boundary. No browser, WASM or guest execution: this checks the options that
// nested DLL initialization actually inherits, including both COM routes.
async function browserLoaderOptions(omitSyncIn) {
  const source=fs.readFileSync(require.resolve('../host.js'),'utf8');
  const method=(name,next)=>{
    const start=source.indexOf('  async '+name+'() {');
    const end=source.indexOf(next,start);
    assert(start>=0&&end>start,'production method boundaries');
    const body=source.slice(start,end);
    return name===omitSyncIn ? body.replace(/^.*findDllSync:.*\n(?![\s\S]*findDllSync:)/m,'') : body;
  };
  const calls=[],syncBytes=new Uint8Array([77,90]),asyncBytes=new Uint8Array([80,69]);
  const capture=kind=>async opts=>{
    assert.equal(typeof opts.findDllSync,'function',kind+' nested NE resolver');
    assert.equal(opts.findDllSync('demo.dll','C:\\Outlaws\\DEMO.DLL'),syncBytes);
    assert.equal(await opts.findDll('demo.dll','C:\\Outlaws\\DEMO.DLL'),asyncBytes);
    calls.push({kind,exports:opts.exports});
  };
  const context=vm.createContext({console,ProcessBoot:{
    handleComDllYield:capture('COM'),handleLoadLibraryYield:capture('PE')}});
  const Host=vm.runInContext('(class {'+
    method('handleComDllLoad','  _registerDllBitmapResources(')+
    method('handleLoadLibrary','  // A cooperative CreateThread')+
    method('handleCooperativeThreadLoadLibraries','  // Finish (or cancel)')+'})',context);
  const host=new Host(),main={},pe={},com={};
  Object.assign(host,{instance:{exports:main},memory:{buffer:new ArrayBuffer(8)},
    _findDllBytes:async()=>asyncBytes,
    _findDllBytesSync:(file,full)=>{assert.equal(file,'demo.dll');assert.equal(full,'C:\\Outlaws\\DEMO.DLL');return syncBytes;},
    threadManager:{backend:'cooperative',
      threadsAwaitingLoadLibrary:()=>[{instance:{exports:pe}}],
      threadsAwaitingComDll:()=>[{instance:{exports:com}}],
      cooperativeCallbackExports:t=>t.instance.exports,
      adoptMainGlobals:()=>{},publishWorkerGlobals:()=>{}}});
  await host.handleComDllLoad();await host.handleLoadLibrary();
  assert.equal(await host.handleCooperativeThreadLoadLibraries(),2);
  assert.deepEqual(calls,[{kind:'COM',exports:main},{kind:'PE',exports:main},
    {kind:'PE',exports:pe},{kind:'COM',exports:com}]);
  if(!omitSyncIn)console.log('PASS production browser main/cooperative PE and COM options preserve synchronous nested NE lookup');
}
(async()=>{
  await browserLoaderOptions();
  await assert.rejects(browserLoaderOptions('handleComDllLoad'),/COM nested NE resolver/);
  await assert.rejects(browserLoaderOptions('handleCooperativeThreadLoadLibraries'),/COM nested NE resolver/);
})().catch(error=>{console.error(error);process.exitCode=1;});
