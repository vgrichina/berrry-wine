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
  assert.deepEqual(await local.read(['get','absent']), {get:0xffffffff,absent:null});
  assert.throws(() => local.call('absent'), /missing guest export/);
  assert.throws(() => createGuestMainOwner({}), /exactly one/);
  assert.throws(() => createGuestMainOwner({localExports:{},worker:{}}), /exactly one/);

  let release, reject, calls = [];
  const remote = createGuestMainOwner({worker:{
    callExport: async (name,...args) => { calls.push([name,...args]); throw new Error('owner retired'); },
    readExports: async names => { calls.push(names); return {get:12}; },
    slice: (steps,sync) => { calls.push([steps,sync]); return new Promise((r,j)=>{release=r;reject=j;}); },
  }});
  await assert.rejects(remote.call('set',9), /owner retired/);
  assert.equal(register,-1,'failed remote invocation never falls back to shadow registers');
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
  assert.deepEqual(calls,[['set',9],['get'],[100,{tickMs:20}],[100,{tickMs:20}]]);
  console.log('PASS guest main ownership: local ordering, remote failure isolation and asynchronous slice diagnostics');
})().catch(error=>{console.error(error);process.exitCode=1;});
