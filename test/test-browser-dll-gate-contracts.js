'use strict';
// Browser admission forwarding and exclusion contracts. The interpreted PE
// regression is in test-browser-dll-gate-admission.js.
const assert = require('node:assert/strict');
const { browserClass } = require('./test-browser-dll-gate-admission.js');
const { ThreadManager } = require('../lib/thread-manager');
const loader = require('../lib/dll-loader');
async function main() {
  const captured = [];
  const fakeBoot = {
    async handleLoadLibraryYield(opts) { captured.push(opts); },
    async handleComDllYield(opts) { captured.push(opts); },
  };
  const Host = browserClass(fakeBoot), host = Object.create(Host.prototype);
  const memory = new WebAssembly.Memory({ initial: 2, maximum: 2, shared: true });
  const gate = new Int32Array(memory.buffer, 64, 2);
  const ex = owner => ({ memory, get_dll_callback_lock: () => 64, get_dll_callback_owner: () => owner });
  const caller = ex(1), owner = ex(2), third = ex(3);
  caller.get_sync_table = () => 0;
  const thread = { instance: { exports: third } };
  const manager = {
    backend: 'cooperative', calls: [],
    runDllCallbackOwnerSlice(owner, budget) { this.calls.push({ owner, budget }); return this.result; },
    threadsAwaitingLoadLibrary: () => [thread], threadsAwaitingComDll: () => [thread],
    cooperativeCallbackExports: () => third, adoptMainGlobals() {}, publishWorkerGlobals() {},
  };
  Object.assign(host, { instance: { exports: caller }, memory, threadManager: manager, running: true, stepsPerSlice: 100000 });
  await host.handleLoadLibrary(); await host.handleComDllLoad(); await host.handleCooperativeThreadLoadLibraries();
  assert.equal(captured.length, 4);
  for (const opts of captured) assert.equal(typeof opts.onDllCallbackGateWait, 'function', 'all main/thread LoadLibrary/COM paths forward admission callback');
  const wait = captured[0].onDllCallbackGateWait;
  let eventLoop = false;
  setTimeout(() => { eventLoop = true; }, 0);
  manager.result = { threadsRun: 1, steps: 1000, blocks: 321 };
  assert.equal(await wait(2), true); assert(eventLoop, 'admission yields a real browser host turn');
  assert.deepEqual(manager.calls, [{ owner: 2, budget: 100000 }]);
  manager.result = { threadsRun: 0, steps: 0, blocks: 0 };
  const held = loader.tryDllCallbackGate(owner);
  assert.equal(await wait(2), false, 'true wait returns to ordinary asynchronous gate wait');
  assert.deepEqual([...gate], [2, 1]);
  manager.backend = 'worker'; manager.result = { threadsRun: 1 };
  const count = manager.calls.length;
  assert.equal(await wait(2), false); assert.equal(manager.calls.length, count, 'Worker backend cannot be scheduled from browser callback');
  manager.backend = 'cooperative';
  const failure = new Error('owner scheduling failure');
  manager.runDllCallbackOwnerSlice = () => { throw failure; };
  await assert.rejects(loader.acquireDllCallbackGate(caller, wait), error => error === failure);
  assert.deepEqual([...gate], [2, 1], 'failure cannot release held gate');
  const bound = loader.bindDllCallbackOwner(third, {});
  await assert.rejects(loader.acquireDllCallbackGate(third, async () => { bound.cancel(); return true; }), /endpoint retired/);
  assert.equal(bound.receipt().dllCallbacksRetired, true);
  assert.deepEqual([...gate], [2, 1]);
  host.running = false;
  await assert.rejects(wait(2), /stopped/i); assert.deepEqual([...gate], [2, 1]);
  held.release(); // Only the owning test callback releases its own synthetic gate.
  assert.deepEqual([...gate], [0, 0]);

  // Actual scheduler exclusion: no fake runSlice should be called for these.
  const tm = new ThreadManager({}, memory, { exports: caller }, () => ({ host: {} }));
  const hold2 = loader.tryDllCallbackGate(owner);
  let ran = 0;
  tm.runSlice = () => { ran++; return { threadsRun: 1 }; };
  assert.equal(tm.runDllCallbackOwnerSlice(9, 100000), null);
  assert.equal(tm.runDllCallbackOwnerSlice(2, 100000), null, 'host-I/O owner has no runnable notification');
  tm.workerBackend = {}; assert.equal(tm.runDllCallbackOwnerSlice(2, 100000), null); tm.workerBackend = null;
  tm._runningThreadHandle = 1; assert.equal(tm.runDllCallbackOwnerSlice(2, 100000), null); tm._runningThreadHandle = 0;
  tm.threads.set(40, { state: 'active', _dllAttachOperation: {}, instance: { exports: third } });
  assert.equal(tm.runDllCallbackOwnerSlice(2, 100000), null, 'unrelated runnable callback is excluded');
  assert.equal(ran, 0);
  tm.threads.set(41, { state: 'active', _dllAttachOperation: {}, instance: { exports: owner } });
  tm._lastCooperativeRunHadWork = 'preserved'; tm._audioPriorityNextHotFirst = 'preserved';
  tm.runSlice = (quantum, options) => {
    assert.equal(quantum, 10000, 'admission caps each owner quantum');
    assert.equal(options.onlyThreadHandle, 41, 'only the gate holder can run');
    assert.equal(options.quantumSteps, 10000);
    tm._lastCooperativeRunHadWork = false; tm._audioPriorityNextHotFirst = false;
    return { threadsRun: 1 };
  };
  assert.deepEqual(tm.runDllCallbackOwnerSlice(2, 100000), { threadsRun: 1 });
  assert.equal(tm._lastCooperativeRunHadWork, 'preserved'); assert.equal(tm._audioPriorityNextHotFirst, 'preserved');
  assert.deepEqual([...gate], [2, 1]); hold2.release();
  console.log('PASS browser all admission paths, host turn, real wait, stop/error/retirement and scheduler Worker/host-I/O/reentry exclusion');
}
main().catch(error => { console.error(error); process.exit(1); });
