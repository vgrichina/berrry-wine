'use strict';
const assert = require('node:assert/strict');
const { createGuestMainOwner } = require('../lib/guest-main-owner');
const { createMainSchedulerObserver } = require('./main-scheduler-observer');

(async () => {
  let register = 0;
  const local = createGuestMainOwner({localExports: {
    run: n => { register += n; }, set: n => { register = n; }, get: () => register,
  }});
  local.run(7);
  assert.equal(register, 7, 'local host effects remain synchronous');
  await local.call('set', -1);
  assert.equal(local.supports('set'),true);
  assert.equal(local.supports('absent'),false);
  assert.equal(await local.optionalCall('absent',9),undefined);
  assert.equal(register,-1);
  assert.deepEqual(await local.read(['get','absent']), {get:0xffffffff,absent:null});
  assert.throws(() => local.call('absent'), /missing guest export/);
  assert.throws(() => createGuestMainOwner({}), /exactly one/);
  assert.throws(() => createGuestMainOwner({localExports:{},worker:{}}), /exactly one/);

  let release, reject, calls = [];
  // Valid compiled module exporting set(i32), used as the endpoint's exact
  // capability source. The transport below deliberately fails present calls.
  const module=new WebAssembly.Module(Uint8Array.from([
    0,97,115,109,1,0,0,0,1,5,1,96,1,127,0,3,2,1,0,
    7,7,1,3,115,101,116,0,0,10,4,1,2,0,11,
  ]));
  const remote = createGuestMainOwner({worker:{
    module,
    callExport: async (name,...args) => { calls.push([name,...args]); throw new Error('owner retired'); },
    readExports: async names => { calls.push(names); return {get:12}; },
    slice: (steps,sync) => { calls.push([steps,sync]); return new Promise((r,j)=>{release=r;reject=j;}); },
  }});
  await assert.rejects(remote.call('set',9), /owner retired/);
  assert.equal(remote.supports('set'),true);
  assert.equal(remote.supports('absent'),false);
  assert.equal(await remote.optionalCall('absent',8),undefined);
  await assert.rejects(remote.optionalCall('set',7), /owner retired/,'optional does not swallow present-export failure');
  assert.equal(register,-1,'failed remote invocation never falls back to shadow registers');
  assert.throws(()=>remote.loadDlls(new Uint8Array(),[],null,{}),/missing Worker DLL loader/);
  assert.deepEqual(await remote.read(['get']),{get:12});

  for(const fail of [false,true]) {
    const logs=[],observer=createMainSchedulerObserver({logs});
    observer.begin('ordinary',5).finish(false,'runnable');
    const pending=observer.run('ordinary',()=>remote.run(100,{tickMs:20}));
    observer.hostInput();
    const during=JSON.parse(logs.at(-1).slice('[main-scheduler] '.length));
    assert.equal(during.scope,'admitted-main-run');assert.equal(during.decisionId,1);
    if(fail){reject(new Error('guest trap'));await assert.rejects(pending,/guest trap/);}
    else {release({yield:0});assert.deepEqual(await pending,{yield:0});}
    observer.hostInput();
    assert.equal(JSON.parse(logs.at(-1).slice('[main-scheduler] '.length)).scope,'outside-observed-main-run');
  }
  assert.deepEqual(calls,[['set',9],['set',7],['get'],[100,{tickMs:20}],[100,{tickMs:20}]]);
  const configs=[{name:'owned.dll',bytes:new Uint8Array([1])}],exeBytes=new Uint8Array([2]);
  const options={registerDllResources(){}};let failed=false;
  const dllOwner=createGuestMainOwner({worker:{module,callExport(){},readExports(){},slice(){},
    async loadDlls(actualConfigs,actualExe,actualOptions){
      assert.equal(actualConfigs,configs);assert.equal(actualExe,exeBytes);assert.equal(actualOptions,options);
      if(failed)throw new Error('DLL startup failed');
      return [{name:'owned.dll',loadAddr:123,dllMain:456,index:2,generation:3}];
    }}});
  assert.deepEqual(await dllOwner.loadDlls(exeBytes,configs,null,options),
    [{name:'owned.dll',loadAddr:123,dllMain:456,index:2,generation:3}]);
  failed=true;
  await assert.rejects(dllOwner.loadDlls(exeBytes,configs,null,options),/DLL startup failed/);
  const {serviceMainTimingWait}=require('./main-timing-waits');
  for(const [reason,step,base,deadline,expected] of [
    [13,1,100,117,18],[13,1,120,117,0],[14,1,100,101,0],
    [14,0,100,101,2],[14,0,105,101,0],[15,0,100,101,0],[12,0,100,101,0],
    [13,1,0xfffffff0,1,18],
  ]){
    let clears=0;
    const timing={batchClock:{batchTicks:()=>base,getTickMsPerBatch:()=>step},
      tickState:{pausedMs:0,lastTick:base},vblank:{waits:0,guestMsAdded:0},
      spin:{clockWaits:0,peekWaits:0,guestMsAdded:0}};
    const selected={read:async()=>({get_yield_reason:reason,get_vblank_deadline_ms:deadline,get_spin_deadline_ms:deadline}),
      call:async name=>{assert.equal(name,'clear_yield');clears++;}};
    assert.equal(await serviceMainTimingWait(selected,timing),reason!==12);
    assert.equal(clears,reason===12?0:1);
    assert.equal(timing.tickState.pausedMs,expected);
    assert.equal(timing.vblank.waits,reason===13?1:0);
    assert.equal(timing.spin.clockWaits,reason===14?1:0);
    assert.equal(timing.spin.peekWaits,reason===15?1:0);
    if(reason!==12){
      selected.call=async()=>{throw new Error('owner retired');};
      await assert.rejects(serviceMainTimingWait(selected,timing),/owner retired/);
    }
  }
  console.log('PASS guest main ownership: local ordering, remote failure isolation and asynchronous slice diagnostics');
})().catch(error=>{console.error(error);process.exitCode=1;});
