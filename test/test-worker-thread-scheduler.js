#!/usr/bin/env node

'use strict';

// ThreadManager's WORKER backend: one Worker per guest thread, all running at
// once (docs/design-real-threads.md phase 2).
//
// The guest threads here are fakes, and that is the point. What needs testing is
// the scheduler's decisions — who gets a slice, when a wait is satisfied, who is
// told to resume, what happens on exit — and those are decided on this thread
// from data in shared memory. Driving real x86 through real Workers would test
// the same logic behind two layers of chance; test-worker-guest.js covers the
// real path end to end in a browser.
// Fixtures await spawnPending explicitly before slicing ready Workers. The
// asynchronous creator/bootstrap dependency has its own focused regression in
// test-worker-bootstrap-progress.js; scheduler assertions below stay unchanged.
//
// Each fake link records what it was asked to do, so the assertions are about
// the protocol: "this thread was given a slice", "that one was told to complete
// its wait with 0", "the exited one was dropped".

const assert = require('assert');
const { ThreadManager } = require('../lib/thread-manager');
const fs = require('fs');
const vm = require('vm');
const { WorkerLink } = require('../lib/guest-thread-host');

let passed = 0, failed = 0;
function check(ok, label, detail) {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? `  ${detail}` : ''}`);
  ok ? passed++ : failed++;
}

// A fake WorkerLink. `script` is the list of slice results to hand back, in
// order; the last one repeats, so a thread that stays parked keeps parking.
class FakeLink {
  constructor(slot, script) {
    this.slot = slot;
    this.script = script.slice();
    this.calls = [];
    this.retryFlags = [];
    this.completed = [];
    this.completedSends = [];
    this.exports = [];
    this.stopped = false;
    this.concurrentPeak = 0;
  }

  async slice(steps, sync, localSleep, retryYield9) {
    this.calls.push(steps);
    this.retryFlags.push(retryYield9 === true);
    FakeLink.inFlight++;
    FakeLink.peak = Math.max(FakeLink.peak, FakeLink.inFlight);
    // Yield to the event loop so a scheduler that awaited each thread in turn
    // instead of together would show a peak of 1 and fail the parallelism check.
    await new Promise(resolve => setImmediate(resolve));
    FakeLink.inFlight--;
    const r = this.script.length > 1 ? this.script.shift() : this.script[0];
    return Object.assign({ eip: 0x401000, yield: 0, ms: 1 }, r);
  }

  async completeWait(result, waitStackBytes) {
    this.completed.push({ result, waitStackBytes });
    return { eip: 0x401000 };
  }
  async completeThreadSend(result) { this.completedSends.push(result | 0); }

  async callExport(name) { this.exports.push(name); return 0; }
  async syncThunks() { return {}; }
  stop() { this.stopped = true; }
}
FakeLink.inFlight = 0;
FakeLink.peak = 0;

// Exercise the shipped slice sender and browser Worker handler together.
// Guest exports are deterministic fakes so races change the live yield at
// admission without depending on OS scheduling or compiling another module.
async function retrySliceProtocol(){
  let yieldReason=9,clears=0,runs=0,sleepReads=0;
  const replies=[],messages=[];
  const sandbox={URL,importScripts(){},location:{href:'https://example.invalid/guest-worker.js'},
    performance,setTimeout,clearTimeout,ThreadSendWaits:require('../lib/thread-send-waits'),
    GuestRpc:{readInputPending:()=>false},
    postMessage:message=>replies.push(message),
    fixture:{exports:{get_yield_reason:()=>yieldReason,get_eip:()=>0x401000,
      clear_yield(){clears++;yieldReason=0;},run(){runs++;},get_last_run_blocks:()=>1,
      get_sleep_yielded(){sleepReads++;return 0;}}}};
  sandbox.self=sandbox;
  const context=vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(require.resolve('../lib/guest-worker'),'utf8'),context);
  vm.runInContext('instance=fixture;',context);
  const link=Object.create(WorkerLink.prototype);
  link.sliceStats={slices:0,guestMs:0,ends:{}};
  link._ask=async message=>{
    messages.push(message);const seq=messages.length;
    await sandbox.onmessage({data:{...message,seq}});
    const reply=replies.find(r=>r.seq===seq);
    assert(reply, 'slice handler responds');assert.notStrictEqual(reply.t,'error',reply.error);
    return reply;
  };
  await link.slice(100,null,null,true);
  assert.strictEqual(clears,1);assert.strictEqual(runs,1);
  assert.strictEqual(messages[0].retryYield9,true,'retry flag shares the slice message');
  yieldReason=0;
  await link.slice(100,null,null,true);
  assert.strictEqual(runs,2,'already cleared live yield still executes the admitted slice');
  for(const reason of [1,2,3,7,10,15,16,17]){
    yieldReason=reason;
    const before=runs,beforeSleep=sleepReads;
    const r=await link.slice(100,{vblank:true},{preWaitMs:10},true);
    assert.strictEqual(clears,1,`retry must not clear changed live yield ${reason}`);
    assert.strictEqual(r.yield,reason);
    assert.strictEqual(runs,before,`retry must not execute changed live wait ${reason}`);
    assert.strictEqual(sleepReads,beforeSleep,'changed wait must not consume the sleep flag');
    assert.strictEqual(r.blocks,0);
  }
  yieldReason=9;await link.slice(100);
  assert.strictEqual(clears,1,'unflagged slices do not clear yield9');
  assert(!('retryYield9' in messages[messages.length-1]),'ordinary slice protocol remains unchanged');
  for(const guard of ['threadSendFrames.push({})','threadSendWaits.rootSend={}']){
    vm.runInContext(guard,context);
    const before=runs,r=await link.slice(100,null,null,true);
    assert(r.threadSendPending,'incoming callback/root-send skips retry slice');
    assert.strictEqual(clears,1);assert.strictEqual(runs,before);
    vm.runInContext('threadSendFrames.length=0;threadSendWaits.rootSend=null;',context);
  }
  await link.slice(100,null,null,true);assert.strictEqual(clears,2);
}

// Enough of GuestThreadHost for the scheduler: PE metadata comes from slot 0,
// and every spawn hands back a link.
function makeBackend(scripts) {
  let slot = 0;
  const links = [];
  return {
    links,
    specs: [],
    dropped: [],
    resolvedSends: [],
    async readExports() {
      return {
        get_image_base: 0x400000, get_code_start: 0x401000, get_code_end: 0x420000,
        get_thunk_base: 0x7500000, get_thunk_end: 0x7502818, get_num_thunks: 1283,
        get_dll_count: 3, get_vlan_local_ip: 0x0A4D0001, get_tls_next_index: 2,
      };
    },
    async spawnThread(spec) {
      this.specs.push(spec);
      const link = new FakeLink(++slot, scripts[links.length] || [{}]);
      links.push(link);
      return link;
    },
    dropThread(link) { this.dropped.push(link.slot); },
    async resolveThreadSend(link, request) {
      this.resolvedSends.push(request);
      await link.completeThreadSend(0x76543210);
      return 0x76543210;
    },
  };
}

function makeManager(backend, extraOpts) {
  const memory = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true });
  const mainInstance = {
    exports: {
      get_sync_table: () => 0,
      get_num_thunks: () => 1283,
      sync_thunk_state: () => {},
      get_bp_addr: () => 0,
      get_watch_addr: () => 0,
    },
  };
  const tm = new ThreadManager({}, memory, mainInstance, () => ({ host: {} }),
    Object.assign({ workerBackend: backend, threadsRequested: true }, extraOpts || {}));
  tm._log = () => {};
  return tm;
}

(async () => {
  console.log('ThreadManager worker backend\n');
  await retrySliceProtocol();
  check(true,'retry clear rides slice, checks live yield, and follows incoming-send guards');

  // A contended CS must not produce an unbounded free-run RPC chain. Polling
  // ownership is only a hint; a racing acquisition must park the waiter again.
  {
    const backend = makeBackend([[]]);
    const tm = makeManager(backend);
    tm.createThread(0x401500, 0, 0, 0);
    await tm._spawnPendingWorkers();
    const [handle, thread] = [...tm.threads.entries()][0];
    const addr = 0x400;
    const owner = new Int32Array(tm.memory.buffer, addr + 12, 1);
    Atomics.store(owner, 0, 7);
    const blocked = { yield: 9, csWaitAddr: addr, csWaitOwner: 7, csParkEip: 0x401000, blocks: 2 };
    thread.link.script = [blocked];
    await tm.runWorkerSlices(1000);
    for (let i = 0; i < 100; i++) await tm.runWorkerSlices(1000);
    await tm._runWorkerThread(handle, thread, 1000); // nested send pump path
    assert.strictEqual(thread.link.calls.length, 1, 'unchanged owner gets no retry slices');
    assert.deepStrictEqual(thread.link.exports, [], 'parking sends no clear_yield RPC');
    tm.workerFreeRun = true;
    assert.strictEqual(tm.freeRunParkBound(50), 50, 'held CS permits host parking');
    tm._freeRunSliceSize = 1000;
    tm._freeRunStepAt = tm._waitNow();
    assert.strictEqual(tm.offerSatisfiedWaiters(), 0, 'held CS is not offered');
    Atomics.store(owner, 0, 0);
    assert.strictEqual(tm.freeRunParkBound(50), 0, 'released CS wakes the scheduler');
    const offered = [];
    tm._freeRunDispatch = (...args) => offered.push(args);
    assert.strictEqual(tm.offerSatisfiedWaiters(), 1, 'release offers a prompt retry');
    assert.strictEqual(offered[0][0], handle);
    tm.workerFreeRun = false;
    // Another owner won before the slice; WAT reports contention again.
    thread.link.script = [{ ...blocked, csWaitOwner: 8 }];
    Atomics.store(owner, 0, 8);
    await tm.runWorkerSlices(1000);
    assert.strictEqual(thread.link.calls.length, 2, 'changed owner permits an acquire recheck');
    assert.deepStrictEqual(thread.link.exports, [], 'eligible CS retry needs no export rendezvous');
    assert.strictEqual(thread.link.retryFlags[thread.link.retryFlags.length-1], true);
    await tm.runWorkerSlices(1000);
    assert.strictEqual(thread.link.calls.length, 2, 'new contention remains parked');
    Atomics.store(owner, 0, 0);
    thread.link.script = [{ yield: 0, blocks: 100 }];
    await tm.runWorkerSlices(1000);
    assert.strictEqual(thread.parkedCriticalSection, null, 'successful retry clears parking');
    assert.strictEqual(thread.link.calls.length, 3);
    assert.strictEqual(tm.lastWorkerSliceBlocks, 100);
    // Missing, packed, sentinel and out-of-bounds diagnostic addresses must
    // fall back to actual guest execution, not read arbitrary memory or hang.
    for (const bad of [0, 0xF0, addr + 1, tm.memory.buffer.byteLength - 12, 0xFFFFFFFC]) {
      thread.parkedCriticalSection = { addr: bad, owner: 7 };
      assert.strictEqual(tm._criticalSectionBlocked(thread), false);
      await tm._runWorkerThread(handle, thread, 1000);
      assert.strictEqual(thread.parkedCriticalSection, null);
    }
    Atomics.store(owner, 0, 7);
    let retryNow = 1000;
    tm._waitNow = () => 0; // frozen guest time must not strand a host retry
    tm._now = () => retryNow;
    for (const csParkEip of [0, 0x402000]) {
      thread.link.script = [{ ...blocked, csParkEip }];
      const before = thread.link.calls.length;
      await tm.runWorkerSlices(1000);
      for (let i = 0; i < 100; i++) await tm.runWorkerSlices(1000);
      assert.strictEqual(thread.link.calls.length, before + 1,
        'generic yield 9 cannot immediately chain empty slices');
      tm.workerFreeRun = true;
      assert.strictEqual(tm.freeRunParkBound(50), 1, 'generic import retry has a bounded deadline');
      tm.workerFreeRun = false;
      retryNow++;
      await tm.runWorkerSlices(1000);
      assert.strictEqual(thread.link.calls.length, before + 2,
        'non-CS yield 9 ignores stale lock diagnostics');
      assert(!thread.parkedCriticalSection);
      retryNow++;
    }
    // A nested callback pump arriving during the retry slice cannot dispatch
    // that parked frame twice. A Worker-side send guard keeps the retry due.
    let releaseSlice;
    const clears = thread.link.exports.length;
    const beforeSlices=thread.link.calls.length;
    thread.link.slice = async (steps,sync,localSleep,retry) => {
      thread.link.calls.push(steps);assert.strictEqual(retry,true);
      return new Promise(resolve=>{releaseSlice=resolve;});
    };
    const retryAt=thread.importRetryAt;
    const resuming = tm._runWorkerThread(handle, thread, 1000);
    await tm._runWorkerThread(handle, thread, 1000);
    assert.strictEqual(thread.link.exports.length, clears);
    assert.strictEqual(thread.link.calls.length,beforeSlices+1);
    assert.strictEqual(tm._workerSkipReason(thread, retryNow, true), 'inflight');
    releaseSlice({threadSendPending:true,blocks:0});
    await resuming;
    assert.strictEqual(thread.importRetryPreparing, false);
    assert.strictEqual(thread.importRetryAt,retryAt,'skipped retry keeps original due deadline');
    const retry=tm._runWorkerThread(handle,thread,1000);
    releaseSlice({yield:0,eip:0x401000,blocks:10});await retry;
    assert.strictEqual(thread.importRetryAt,0,'admitted retry consumes old parking metadata');
    const parked={addr,owner:7};thread.parkedCriticalSection=parked;
    Atomics.store(owner,0,0);
    const csSkipped=tm._runWorkerThread(handle,thread,1000);
    releaseSlice({threadSendPending:true,blocks:0});await csSkipped;
    assert.strictEqual(thread.parkedCriticalSection,parked,'incoming send preserves qualified CS retry metadata');
    const csRetry=tm._runWorkerThread(handle,thread,1000);
    releaseSlice({yield:0,eip:0x401000,blocks:10});await csRetry;
    assert.strictEqual(thread.parkedCriticalSection,null);
    thread.importRetryAt=retryNow;
    thread.link.slice=async()=>{throw new Error('retry transport lost');};
    await tm._runWorkerThread(handle,thread,1000);
    assert.strictEqual(thread.importRetryPreparing,false,'failed retry releases preparation guard');
    assert.strictEqual(thread.inFlight,false,'failed retry releases in-flight guard');
    assert(backend.dropped.includes(thread.link.slot),'transport failure retires thread instead of retrying stale state');
    check(true, 'CS waiters park without RPC churn, wake on release, and recheck acquisition races');
  }

  // A parked helper must not force the host's idle GetMessage worker to spin.
  // Exercise real wait bookkeeping, including consuming an auto-reset event
  // exactly once between the parking decision and dispatch.
  {
    const backend = makeBackend([[]]);
    const tm = makeManager(backend);
    let now = 1000;
    tm._waitNow = () => now;
    const event = tm.createEvent(false, false);
    const wait = { yield: 1, eip: 0x401000, waitHandle: event,
      waitTimeout: 30, waitStackBytes: 12 };
    // Spawn normally before enabling free-run; no uncontrolled async chain.
    tm.createThread(0x401500, 0, 0, 0);
    await tm._spawnPendingWorkers();
    const thread = [...tm.threads.values()][0];
    thread.link.script = [wait, { yield: 0 }];
    await tm.runWorkerSlices(1000);
    tm.workerFreeRun = true;
    assert.strictEqual(tm.freeRunParkBound(50), 30);
    now += 17;
    assert.strictEqual(tm.freeRunParkBound(50), 13,
      'a blocked helper bounds parking by its remaining timeout');
    tm.setEvent(event);
    await Promise.resolve();
    assert.strictEqual(tm.freeRunParkBound(50), 0,
      'a signaled helper needs a slice immediately');
    assert.strictEqual(tm.freeRunParkBound(50), 0,
      'rechecking the bound retains an already consumed signal');
    assert.strictEqual(tm.waitSingle(event, 0), 0x102,
      'the auto-reset signal was consumed exactly once');
    tm.workerFreeRun = false;
    await tm.runWorkerSlices(1000);
    assert.deepStrictEqual(thread.link.completed, [{ result: 0, waitStackBytes: 12 }]);

    thread.link.script = [wait];
    await tm.runWorkerSlices(1000);
    tm.workerFreeRun = true;
    now += 30;
    assert.strictEqual(tm.freeRunParkBound(50), 0,
      'an expired helper timeout is immediately runnable');
    tm.workerFreeRun = false;
    thread.link.script = [{ yield: 0 }];
    await tm.runWorkerSlices(1000);
    assert.strictEqual(thread.link.completed[1].result, 0x102);

    thread.link.script = [{ ...wait, waitTimeout: 0xFFFFFFFF }];
    await tm.runWorkerSlices(1000);
    tm.workerFreeRun = true;
    assert.strictEqual(tm.freeRunParkBound(50), 50,
      'an infinite unsatisfied wait permits the full park bound');
    tm._freeRunStepAt = now;
    tm._freeRunSliceSize = 1000;
    let offered = 0;
    tm._freeRunDispatch = (_handle, target) => {
      assert.strictEqual(target, thread);
      offered++;
      target.inFlight = true;
    };
    tm.setEvent(event);
    await Promise.resolve();
    assert.strictEqual(offered, 1,
      'a signal dispatches its parked worker without waiting for the host timer');
    thread.inFlight = true;
    assert.strictEqual(tm.freeRunParkBound(50), 50,
      'an independently running sibling does not need a host step');
    thread.inFlight = false;
    thread.parkedWait = null;
    assert.strictEqual(tm.freeRunParkBound(50), 0,
      'an idle runnable sibling still prevents parking');
    thread.sleepUntil = now + 8;
    assert.strictEqual(tm.freeRunParkBound(50), 8);
    tm.serialSlices = true;
    assert.strictEqual(tm.freeRunParkBound(50), 0,
      'serial scheduling keeps its existing no-park behavior');
    check(true, 'free-run host parking respects event signals, finite deadlines and runnable siblings');
  }

  // A sibling's signal tells the host (onSignal), which may end a step parked
  // on the main thread's behalf: Jardinains' main thread spins on PeekMessage
  // until its winmm timer thread SetEvents. One call per microtask burst, and
  // none outside free-run, where the drive loop polls every step anyway.
  {
    const tm = makeManager(makeBackend([[]]));
    const event = tm.createEvent(false, false);
    let signals = 0;
    tm.onSignal = () => { signals++; };
    tm.setEvent(event);
    await Promise.resolve();
    assert.strictEqual(signals, 0, 'no signal wake outside free-run');
    tm.workerFreeRun = true;
    tm.setEvent(event);
    tm.setEvent(event);
    await Promise.resolve();
    assert.strictEqual(signals, 1, 'a burst of signals wakes the host once');
    tm.setEvent(event);
    await Promise.resolve();
    assert.strictEqual(signals, 2, 'each later signal wakes it again');
    tm.workerFreeRun = false;
    check(true, 'free-run signals reach the host through onSignal');
  }

  // I/O selection belongs to the yielding thread in both scheduling modes.
  for (const workerMode of [true, false]) {
    const { VirtualFS } = require('../lib/filesystem');
    const vfs = new VirtualFS(), fills = [];
    for (const tid of [1, 2]) {
      const name = `c:\\thread-${tid}.bin`;
      vfs.setProviderFile(name, { provider: { size: 8, tryRead: () => null,
        fill: async () => { fills.push(tid); },
      } });
      const h = vfs.createFile(name, 0x80000000, 3);
      const pending = vfs.readFile(h, new Uint8Array(8), 8, tid + 1).pending;
      vfs.getIoState(tid + 1).pendingRead = pending;
    }
    const backend = workerMode ? makeBackend([[{ yield: 12 }], [{ yield: 12 }]]) : null;
    const tm = makeManager(backend, { getVfs: () => vfs });
    if (workerMode) {
      tm.createThread(0x401500, 0, 0, 0);
      tm.createThread(0x401600, 0, 0, 0);
      await tm.spawnPending();
      await tm.runWorkerSlices(50000);
      assert(backend.links.every(link => link.exports.includes('clear_yield')));
    } else {
      for (const tid of [1, 2]) tm.threads.set(tid, { tid, state: 'active', waitPolls: 0,
        instance: { exports: { get_yield_reason: () => 12 } } });
      tm.runSlice(2000);
      await Promise.all([...tm.threads.values()].map(thread => thread.ioFill));
      assert([...tm.threads.values()].every(thread => thread.ioFillDone));
    }
    assert.deepStrictEqual(fills.sort(), [1, 2]);
    assert.strictEqual(vfs.getPendingRead(2), null);
    assert.strictEqual(vfs.getPendingRead(3), null);
    const [handle, thread] = tm.threads.entries().next().value;
    tm._markThreadExited(handle, thread, 0, 'io-test');
    assert(!vfs._threadIo.has(thread.tid + 1));
    check(true, `${workerMode ? 'Worker' : 'cooperative'} scheduler fills each thread's own request and retires exit state`);
  }

  // --- the backend is what decides the mode, and it says so ------------------
  {
    const tm = makeManager(makeBackend([]));
    check(tm.backend === 'worker', 'a worker backend switches the reported scheduler', tm.backend);
    const coop = makeManager(null);
    check(coop.backend === 'cooperative', 'without one it stays cooperative', coop.backend);
    let threw = false;
    try { tm.runSlice(1000); } catch (_) { threw = true; }
    check(threw, 'runSlice refuses to walk worker-backed threads');
  }

  // --- spawn ----------------------------------------------------------------
  {
    const backend = makeBackend([[{}], [{}]]);
    const tm = makeManager(backend);
    const h1 = tm.createThread(0x401500, 0xdead, 0x20000, 0);
    const h2 = tm.createThread(0x401600, 0xbeef, 0, 0);
    check(tm.setThreadPriority(h1, 2, 1) === 1,
      'a pending real Worker accepts THREAD_PRIORITY_HIGHEST');
    check(tm.setThreadLocale(0x0419, 1) === 1,
      'the creating main thread can select a concrete locale');
    const inherited = tm.createThread(0x401700, 0xcafe, 0, 0, 0, 1);
    check(tm.initializeComApartment(0, 2, 2) === 0 &&
      tm.initializeComApartment(0, 2, 2) === 1,
      'a pending real Worker owns a nested STA apartment');
    const h1Duplicate = tm.duplicateCurrentThread(2);
    check(!!h1Duplicate, 'a pending real Worker can materialize a durable duplicate');
    await tm.spawnPending();
    await tm.runWorkerSlices(50000);
    check(backend.specs.length === 3, 'each CreateThread became a Worker', `${backend.specs.length}`);
    const s = backend.specs[0];
    check(s.imageBase === 0x400000 && s.codeStart === 0x401000,
      'PE metadata came from the guest main thread, not the idle main instance',
      `imageBase=0x${(s.imageBase >>> 0).toString(16)}`);
    check(s.hwndBase === tm.workerHwndBase(1) &&
      backend.specs[1].hwndBase === tm.workerHwndBase(2),
      'each real Worker gets the same in-app hwnd partition as the cooperative backend',
      `${s.hwndBase.toString(16)}, ${backend.specs[1].hwndBase.toString(16)}`);
    // A nonzero dwStackSize is a commit size inside the EXE's reserve (1MB
    // when the header gives none), as Windows sizes it.
    check(s.stackSize === 0x100000 && backend.specs[1].stackSize === 0x100000,
      'thread stacks get the Windows reserve, whether or not a commit size is given',
      `${s.stackSize}, ${backend.specs[1].stackSize}`);
    check(s.dllCount === 3 && s.vlanIp === 0x0A4D0001 && s.tlsNextIndex === 2,
      'process-wide state a new instance cannot infer is passed in');
    check(tm.threads.get(h1).state === 'active' && tm.threads.get(h2).state === 'active',
      'both threads are live in the same handle map the waits read');
    check(tm.getThreadPriority(h1, 1) === 2 && tm.getThreadPriority(h1Duplicate, 1) === 2,
      'priority and duplicated identity survive pending-to-Worker record replacement');
    check(tm.getThreadLocale(4) === 0x0419 && tm.threads.get(inherited).locale === 0x0419,
      'creator locale survives pending-to-Worker record replacement');
    check(tm.setThreadPriority(h1Duplicate, -1, 1) === 1 && tm.getThreadPriority(h1, 1) === -1,
      'a real Worker handle and its duplicate keep one priority state');
    check((tm.initializeComApartment(0, 0, 2) >>> 0) === 0x80010106,
      'the STA model survives pending-to-Worker record replacement');
    tm.uninitializeComApartment(2);
    tm.uninitializeComApartment(2);
    check(tm.initializeComApartment(0, 0, 2) === 0,
      'balanced teardown after replacement permits MTA reinitialization');
    tm.uninitializeComApartment(2);
  }

  // --- real concurrency ------------------------------------------------------
  {
    const backend = makeBackend([[{}], [{}], [{}]]);
    const tm = makeManager(backend);
    for (let i = 0; i < 3; i++) tm.createThread(0x401500 + i, 0, 0, 0);
    FakeLink.peak = 0; FakeLink.inFlight = 0;
    await tm.spawnPending();
    await tm.runWorkerSlices(50000);
    check(FakeLink.peak === 3, 'all three threads are in a slice at the same time',
      `peak in flight = ${FakeLink.peak}`);
    check(backend.links.every(l => l.calls.length === 1), 'each got exactly one slice',
      backend.links.map(l => l.calls.length).join(','));
  }

  // --- waits ----------------------------------------------------------------
  {
    // The thread parks on WaitForSingleObject. Nothing signals the event, so the
    // scheduler must re-poll rather than resume it.
    // The first slice runs normally: a wait on handle 0 would be resolved
    // immediately, because Win32 treats an unknown handle as signaled and so do
    // we — which is worth knowing before writing "it parks" into a test.
    const backend = makeBackend([[{}]]);
    const tm = makeManager(backend);
    tm.createThread(0x401500, 0, 0, 0);
    await tm.spawnPending();
    await tm.runWorkerSlices(1000);           // ready Worker + first slice
    const ev = tm.createEvent(false, false);  // auto-reset, unsignaled
    backend.links[0].script = [{ yield: 1, waitHandle: ev, waitStackBytes: 12, waitTimeout: 0xFFFFFFFF }];
    await tm.runWorkerSlices(1000);
    check(backend.links[0].completed.length === 0, 'an unsignaled wait is not resumed');
    check(tm.threads.get([...tm.threads.keys()][0]).waitPolls > 0, 'and it is recorded as still waiting');

    tm.setEvent(ev);
    await tm.runWorkerSlices(1000);
    const done = backend.links[0].completed;
    check(done.length === 1 && done[0].result === 0 && done[0].waitStackBytes === 12,
      'a signaled wait resumes with WAIT_OBJECT_0 and the right frame size',
      JSON.stringify(done));
  }

  {
    // A finite timeout must eventually expire into WAIT_TIMEOUT instead of
    // parking forever.
    const backend = makeBackend([[{ yield: 1, waitHandle: 0xE0001, waitStackBytes: 12, waitTimeout: 5 }]]);
    const tm = makeManager(backend);
    let clock = 1000;
    tm._now = () => clock;
    tm.createThread(0x401500, 0, 0, 0);
    tm.createEvent(false, false);            // idx 0 → handle 0xE0000
    tm.createEvent(false, false);            // idx 1 → handle 0xE0001, unsignaled
    await tm.spawnPending();
    await tm.runWorkerSlices(1000);
    check(backend.links[0].completed.length === 0, 'inside the timeout it keeps waiting');
    clock += 50;
    await tm.runWorkerSlices(1000);
    const done = backend.links[0].completed;
    check(done.length === 1 && done[0].result === 0x102, 'past the timeout it resumes with WAIT_TIMEOUT',
      JSON.stringify(done));
  }

  {
    // WaitMessage leaves its stdcall frame live while yield reason 7 is set.
    // The Worker itself checks its USER queue and the shared browser-input bit
    // before each slice; clearing here would make it re-enter WaitMessage once
    // per scheduler turn even while both queues are empty.
    const backend = makeBackend([[{ yield: 7 }]]);
    const tm = makeManager(backend);
    const h = tm.createThread(0x401500, 0, 0, 0);
    await tm.spawnPending();
    await tm.runWorkerSlices(1000);
    await tm.runWorkerSlices(1000);
    check(!backend.links[0].exports.includes('clear_yield'),
      'an idle Worker WaitMessage remains parked instead of being re-entered',
      backend.links[0].exports.join(','));
    check(tm.threads.get(h).lastYield === 7,
      'the parked message-wait state remains visible to scheduler diagnostics',
      `${tm.threads.get(h).lastYield}`);
  }

  {
    // Browser input is a wake source for MsgWaitForMultipleObjects, not for
    // ordinary WaitForMultipleObjects. Diablo waits for two Storm MPQ jobs
    // here; returning nCount because a paint is queued lets it consume the
    // half-filled buffers and report a Data File Error.
    const tm = makeManager(makeBackend([]), { hasMessage: () => true });
    const first = tm.createEvent(false, false);
    const second = tm.createEvent(false, false);
    const handles = 0x100;
    const words = new Int32Array(tm.memory.buffer);
    words[handles >>> 2] = first;
    words[(handles >>> 2) + 1] = second;
    const wait = {
      waitHandle: 2,
      waitHandlesPtr: handles,
      waitAll: true,
      waitTimeout: 0xFFFFFFFF,
      waitStackBytes: 20,
    };
    check(tm.resolveMainWorkerWait(wait) === null,
      'queued input does not satisfy ordinary worker-mode WaitForMultipleObjects');
    tm.setEvent(first);
    tm.setEvent(second);
    const done = tm.resolveMainWorkerWait(wait);
    check(done && done.result === 0 && done.waitStackBytes === 20,
      'the same wait completes only after all requested objects are signaled',
      JSON.stringify(done));
  }

  // --- exit -----------------------------------------------------------------
  {
    const backend = makeBackend([[{ yield: 2 }]]);
    const tm = makeManager(backend);
    const h = tm.createThread(0x401500, 0, 0, 0);
    await tm.spawnPending();
    await tm.runWorkerSlices(1000);
    check(tm.threads.get(h).state === 'exited', 'yield 2 marks the thread exited');
    check(backend.dropped.length === 1, 'and its Worker is dropped', `${backend.dropped}`);
    check(tm.waitSingle(h, 0) === 0, 'a wait on the thread handle is now signaled');
    check(tm.getExitCodeThread(h) !== 0x103, 'and GetExitCodeThread stops saying STILL_ACTIVE');
    const before = backend.links[0].calls.length;
    await tm.runWorkerSlices(1000);
    check(backend.links[0].calls.length === before, 'an exited thread is never given another slice');
  }

  {
    // EIP 0 is the other way a thread ends: its threadproc returned into the
    // zero return address the spawn pushed.
    const backend = makeBackend([[{ eip: 0 }]]);
    const tm = makeManager(backend);
    const h = tm.createThread(0x401500, 0, 0, 0);
    await tm.spawnPending();
    await tm.runWorkerSlices(1000);
    check(tm.threads.get(h).state === 'exited', 'returning from the threadproc (EIP=0) also exits');
  }

  {
    // A trap inside the worker must not take the page down with it.
    const backend = makeBackend([[{ trapped: 'unreachable', eip: 0x401234 }]]);
    const tm = makeManager(backend);
    const h = tm.createThread(0x401500, 0, 0, 0);
    await tm.spawnPending();
    await tm.runWorkerSlices(1000);
    check(tm.threads.get(h).state === 'exited', 'a trapped thread is exited, not left active');
    check(backend.dropped.length === 1, 'and its Worker is dropped too');
  }

  // --- Sleep and Suspend ----------------------------------------------------
  {
    const backend = makeBackend([[{ sleepYielded: true, sleepMs: 100 }, {}]]);
    const tm = makeManager(backend);
    let clock = 5000;
    tm._now = () => clock;
    tm.createThread(0x401500, 0, 0, 0);
    await tm.spawnPending();
    await tm.runWorkerSlices(1000);
    const after = backend.links[0].calls.length;
    await tm.runWorkerSlices(1000);
    check(backend.links[0].calls.length === after, 'a sleeping thread is skipped while it sleeps');
    clock += 200;
    await tm.runWorkerSlices(1000);
    check(backend.links[0].calls.length === after + 1, 'and runs again once the sleep is up');
  }

  {
    const backend = makeBackend([[{}]]);
    const tm = makeManager(backend);
    const h = tm.createThread(0x401500, 0, 0, 0x4);   // CREATE_SUSPENDED
    await tm.spawnPending();
    await tm.runWorkerSlices(1000);
    check(backend.links.length === 1, 'a CREATE_SUSPENDED thread still gets its Worker');
    check(backend.links[0].calls.length === 0, 'but is given no slice while suspended');
    tm.resumeThread(h);
    await tm.runWorkerSlices(1000);
    check(backend.links[0].calls.length === 1, 'and runs after ResumeThread');
  }

  // --- ExitThread from inside a host call -----------------------------------
  {
    // ExitThread takes no handle. The cooperative backend knows the caller
    // because it just called run() on that instance; this backend has to learn
    // it from the RPC slot, or ExitThread silently exits nobody.
    const backend = makeBackend([[{}]]);
    const tm = makeManager(backend);
    const h = tm.createThread(0x401500, 0, 0, 0);
    await tm.spawnPending();
    await tm.runWorkerSlices(1000);
    backend.onRpcSlot(backend.links[0].slot);
    tm.exitThread(7);
    backend.onRpcSlotEnd();
    check(tm.threads.get(h)._exitRequested && tm.threads.get(h).state !== 'exited',
      'ExitThread records intent until the owning Worker finishes detach');
    check(tm.getExitCodeThread(h) === 259, 'thread handle remains pending during detach');
    backend.links[0].script = [{ yield: 2, exitCode: 7 }];
    await tm.runWorkerSlices(1000);
    check(tm.threads.get(h).state === 'exited', 'ExitThread on a worker slot exits that thread');
    check(tm.getExitCodeThread(h) === 7, 'with its exit code', `${tm.getExitCodeThread(h)}`);
  }

  // --- net_wait -------------------------------------------------------------
  {
    const backend = makeBackend([[{ yield: 8 }]]);
    const tm = makeManager(backend);
    tm.createThread(0x401500, 0, 0, 0);
    await tm.spawnPending();
    await tm.runWorkerSlices(1000);
    check(backend.links[0].exports.includes('clear_yield')
      && backend.links[0].exports.includes('vlan_pump'),
      'net_wait clears the yield and pumps the wire',
      backend.links[0].exports.join(','));
    check(tm.netWaitPending === true,
      'and asks the caller for an event-loop turn, or the frames it waits for never arrive');
  }

  // --- cross-thread SendMessage --------------------------------------------
  {
    const backend = makeBackend([[{
      yield: 10, sendTargetTid: 1, sendHwnd: 0x1234,
      sendMsg: 0x500, sendWparam: 7, sendLparam: 9, sendPostKind: 2,
    }]]);
    const tm = makeManager(backend);
    tm.createThread(0x401500, 0, 0, 0);
    await tm.spawnPending();
    await tm.runWorkerSlices(1000);
    check(backend.resolvedSends.length === 1
      && backend.resolvedSends[0].targetTid === 1
      && backend.resolvedSends[0].postKind === 2
      && backend.links[0].completedSends[0] === 0x76543210,
      'yield 10 routes SendMessage to the HWND owner and resumes with its LRESULT');
  }

  {
    const external = [];
    const tm = makeManager(makeBackend([]), {
      hasMessage: () => true,
      resolveThreadSendExternalYield: async (_link, r) => {
        external.push(r.yield);
        return { bytes: null };
      },
    });
    const calls = [];
    const link = {
      scopedThreadSendLoader: async (_token, request) => ({ ready: true, completed: !!request,
        loaderState: { dllCount: 0, thunkEnd: 0, numThunks: 0 } }),
      scopedThreadSendYield: async (token, finish) => {
        calls.push(['scoped', token, finish]);
        return { ready: true, completed: !!finish };
      },
      reserveThreadSendWait: async () => ({ reserved: true }),
      cancelThreadSendWait: async () => ({ cancelled: true }),
      completeWait: async (result, bytes) => { calls.push(['wait', result, bytes]); return { delivered: true }; },
      resumeThreadSendMessageWait: async hostInput => {
        calls.push(['message', hostInput]);
        return { resumed: true };
      },
      callExport: async name => { calls.push(['export', name]); return 0; },
    };
    const state = { waitPolls: 0, waitStartedAt: 0 };
    tm.workerBackend.link = link;
    const ev = tm.createEvent(false, true);
    const actions = [];
    actions.push(await tm.resolveThreadSendYield(link, {
      yield: 1, frameToken: 1, waitEpoch: 1, waitHandle: ev, waitTimeout: 0xFFFFFFFF, waitStackBytes: 12,
    }, state, new Set([link])));
    for (const yieldReason of [7, 8, 9, 6, 3, 5]) {
      actions.push(await tm.resolveThreadSendYield(link, { yield: yieldReason, frameToken: 1, waitEpoch: yieldReason }, state, new Set([link])));
    }
    check(actions.every(action => action === 'resume')
      && calls.some(c => c[0] === 'wait' && c[1] === 0 && c[2] === 12)
      && calls.some(c => c[0] === 'message' && c[1] === true)
      && calls.some(c => c[0] === 'scoped' && c[1].waitEpoch === 8 && c[2] === true)
      && external.join(',') === '3,5',
    'a target WndProc keeps its SendMessage frame across event/message/net/modal/DLL yields',
    `actions=${actions.join(',')} external=${external.join(',')}`);
  }

  // Worker boots are slow and runWorkerSlices spawns whenever the pending
  // list is non-empty, so a second spawn pass can start while the first is
  // still booting. It must not walk the list again and start a thread twice.
  {
    const backend = makeBackend([]);
    const slowSpawn = backend.spawnThread.bind(backend);
    backend.spawnThread = async spec => {
      for (let i = 0; i < 3; i++) await new Promise(resolve => setImmediate(resolve));
      return slowSpawn(spec);
    };
    const tm = makeManager(backend);
    tm.createThread(0x401500, 0, 0, 0);
    const first = tm._spawnPendingWorkers();
    await new Promise(resolve => setImmediate(resolve));
    tm.createThread(0x401600, 0, 0, 0);
    tm.createThread(0x401700, 0, 0, 0);
    const second = tm.runWorkerSlices(1000);
    const third = tm._spawnPendingWorkers();
    await Promise.all([first, second, third]);
    const tids = backend.specs.map(spec => spec.tid);
    check(tids.length === 3 && new Set(tids).size === 3 && tm._pendingThreads.length === 0
      && tm.threads.size === 3,
    'overlapping spawn passes start each pending thread exactly once',
    `tids=${tids.join(',')} pending=${tm._pendingThreads.length} threads=${tm.threads.size}`);
  }

  // ExitThread marks the record during the slice. The slice result must still
  // retire that Worker, or its stack range stays registered with the host and
  // the next thread on the same tid and freed stack reports a STACK OVERLAP
  // (Collapse! Crunch, Threads on).
  {
    const backend = makeBackend([[{}]]);
    const tm = makeManager(backend);
    tm.createThread(0x401500, 0, 0, 0);
    await tm._spawnPendingWorkers();
    const [handle, thread] = [...tm.threads.entries()][0];
    thread.link.slice = async () => {
      tm._markThreadExited(handle, thread, 0, 'ExitThread');
      return { eip: 0x401000, yield: 0, ms: 1 };
    };
    await tm.runWorkerSlices(1000);
    check(backend.dropped.includes(thread.link.slot),
      'a worker that called ExitThread during its slice is retired',
      `dropped=${backend.dropped.join(',')}`);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(err => { console.error('test-worker-thread-scheduler failed:', err); process.exit(1); });
