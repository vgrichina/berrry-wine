#!/usr/bin/env node
'use strict';

// Threads mode holds browser repaint publication to the end of a guest slice
// so a WM_PAINT erase cannot become visible before its text draw. Input that
// arrives during a long slice must therefore create an early *complete-block*
// boundary, or edit text can sit invisibly until the remaining budget expires.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RPC = require('../lib/guest-rpc');
const { installInputHandlers } = require('../lib/renderer-input');
const { bootRenderHarness } = require('./render-helper');
const { createRequire } = require('module');
const { createHostImports } = require('../lib/host-imports');
const { inputEventHwnd } = require('../lib/host-window');

// Await named protocol events, never a number of event-loop turns. The timer
// below only diagnoses a missing event; it cannot advance a passing test.
function mailbox() {
  const items = [], readers = [];
  return {
    put(value) { if (readers.length) readers.shift()(value); else items.push(value); },
    next() { return items.length ? Promise.resolve(items.shift())
      : new Promise(resolve => readers.push(resolve)); },
  };
}

const hostSource = fs.readFileSync(path.join(__dirname, '..', 'host.js'), 'utf8');
function driveHost(memory, configured = 100000) {
  const pumps = mailbox(), slices = mailbox(), schedules = mailbox();
  const tasks = [], timers = new Map(), frames = new Map();
  const calls = [], publications = [], displays = [], stepRuns = [];
  let seq = 0, active = 0, ticks = 0, completions = 0;
  const context = { URLSearchParams, console, createHostImports, inputEventHwnd,
    performance: { now: () => 100 },
    setTimeout(fn, ms) { const id = ++seq; timers.set(id, { fn, ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
    requestAnimationFrame(fn) { const id = ++seq; frames.set(id, fn); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    MessageChannel: class {
      constructor() {
        this.port1 = {};
        this.port2 = { postMessage: () => tasks.push(() => this.port1.onmessage()) };
      }
    },
  };
  vm.runInNewContext(hostSource + '\n;globalThis.WineAssembly = WineAssembly;', context);
  const wine = new context.WineAssembly();
  const rendererPath = require.resolve('../lib/renderer');
  const rendererContext = { ...context, require: createRequire(rendererPath), module: { exports: {} } };
  vm.runInNewContext(fs.readFileSync(rendererPath, 'utf8'), rendererContext);
  const { Win98Renderer } = rendererContext.module.exports;
  const r = new Win98Renderer({ getContext: () => ({}) });
  r._isNode = false;
  // Observe the compositor leaf; all repaint/hold/rAF scheduling is shipped code.
  r.repaint = () => {
    assert.strictEqual(r._workerPublicationHeld(), false, 'display never exposes an active slice');
    displays.push(r.inputQueue.length);
  };
  wine.renderer = r;
  wine.memory = memory;
  wine.instance = { exports: {} };
  r.wasm = r.mainWasm = wine.instance;
  r._guestWorkerWasms = new WeakSet([wine.instance]);
  wine.processId = 17;
  r.windows[0x10005] = { hwnd: 0x10005, wasm: wine.instance, processId: 17 };
  r.windows[0x20005] = { hwnd: 0x20005, wasm: {}, processId: 18 };
  wine.logToUI = message => {
    if (message.startsWith('[threads]')) throw new Error(message);
  };
  wine._beginGuestTickBatch = () => { ticks++; };
  wine._guestTickMs = () => 0;
  wine._presentDxIfDirty = () => 0;
  const h = wine.getImports().host;
  wine.hostCtx.pumpAudioCompletions = () => { completions++; };
  wine.hostCtx.pumpWaveCallbacks = () => new Promise(resolve => pumps.put({ resolve }));
  const sigs = {
    check_input: { params: [], results: ['i32'] },
    check_input_lparam: { params: [], results: ['i32'] },
    check_input_wparam: { params: [], results: ['i32'] },
    check_input_hwnd: { params: ['i32'], results: ['i32'] },
  };
  const broker = RPC.createMainBroker(memory, h, sigs);
  const imports = slot => RPC.createWorkerImports(memory, sigs, message => {
    if (message.t === 'rpc') broker.serveRpc(message.slot);
  }, { slot }).imports.host;
  const publish = broker.publish;
  broker.publish = state => { publications.push(state); publish(state); };
  wine.guestWorker = {
    broker, link: { threadSendDepth: 0, _waveOffer: null },
    slice(steps, sync) {
      assert.strictEqual(++active, 1, 'at most one main slice executes');
      const call = { steps, sync };
      calls.push(call);
      return new Promise(resolve => slices.put({ ...call, finish(result = {}) {
        assert.strictEqual(active--, 1, 'a slice completes exactly once');
        resolve({ eip: 1, yield: 0, focusHwnd: 0, blocks: steps, ms: 1, ...result });
      } }));
    },
  };
  const schedule = wine._scheduleStep;
  const post = wine._postStep;
  wine._postStep = function(step) {
    post.call(this, () => { const done = step(); stepRuns.push(done); return done; });
  };
  wine._scheduleStep = function(step, delay = 0) {
    schedule.call(this, step, delay);
    schedules.put({ delay });
  };
  wine._runThreaded(configured);
  return { wine, r, calls, publications, displays, timers, tasks, frames,
    pumps, slices, schedules, main: imports(0), sibling: imports(1),
    serviceCounts: () => [ticks, completions],
    dispatch() { assert.strictEqual(tasks.length, 1, 'exactly one successor task'); tasks.shift()(); },
    frame() { const due = [...frames.values()]; frames.clear(); due.forEach(fn => fn()); },
    async stopAtPump() {
      const count = calls.length;
      this.dispatch();
      const pump = await pumps.next();
      wine.running = false;
      // Stopping while the real boundary pump is awaited must prevent slice admission.
      pump.resolve();
      await stepRuns[stepRuns.length - 1];
      assert.strictEqual(calls.length, count);
      assert.strictEqual(tasks.length, 0, 'stopped boundary posts no successor');
      assert.strictEqual(timers.size, 0, 'stopped boundary arms no timer');
      wine._cancelPresentFrame();
    },
  };
}

class RendererProbe {
  constructor() {
    this.inputQueue = [];
    this.windows = {};
    this.wasm = null;
    this.mainWasm = null;
    this._exited = false;
    this._inputPendingPublishers = new Set();
  }
}
installInputHandlers(RendererProbe);

const watchdog = setTimeout(() => { console.error('FAIL missing protocol event'); process.exit(1); }, 30000);
(async () => {
  assert.strictEqual(RPC.SLOT.INPUT_WAKE, 9, 'JS and WAT reserve RPC slot 9 for input wake');

  const publishedMemory = new WebAssembly.Memory({
    initial: 8192, maximum: 8192, shared: true,
  });
  const broker = RPC.createMainBroker(publishedMemory, {}, {});
  const publishedRpc = new Int32Array(
    publishedMemory.buffer, RPC.RPC_BASE, RPC.CTRL_INTS);
  broker.publish({ inputPending: 3, inputWake: true });
  assert.strictEqual(Atomics.load(publishedRpc, RPC.SLOT.INPUT_PENDING), 3,
    'main broker publishes the live input queue depth');
  assert.strictEqual(Atomics.load(publishedRpc, RPC.SLOT.INPUT_WAKE), 1,
    'main broker publishes the one-shot wake independently of queue depth');

  const renderer = new RendererProbe();
  renderer._keyboardOwnerRunsInGuestWorker = () => true;
  const published = [];
  renderer._inputPendingPublishers.add((depth, wake) => published.push({ depth, wake }));
  renderer.handleKeyDown(0x43, { code: 'KeyC' });
  renderer.handleKeyPress(0x43);
  renderer.handleKeyUp(0x43, { code: 'KeyC' });
  assert.deepStrictEqual(published, [
    { depth: 1, wake: true },
    { depth: 2, wake: true },
    { depth: 3, wake: true },
  ], 'each Worker keyboard message publishes queue depth and a wake pulse');
  renderer.takeInput();
  assert.deepStrictEqual(published[published.length - 1], { depth: 2, wake: false },
    'dequeue republishes depth without creating another wake pulse');

  const { exports: e, memory } = await bootRenderHarness({ fonts: 'none' });
  const code = 0x00030000;
  e.guest_write8(code, 0xeb); // jmp $-2: one stable block per dispatch
  e.guest_write8(code + 1, 0xfe);
  e.set_eip(code);
  const rpc = new Int32Array(memory.buffer, RPC.RPC_BASE, RPC.CTRL_INTS);

  e.set_current_thread_id(2);
  Atomics.store(rpc, RPC.SLOT.INPUT_WAKE, 1);
  e.run(5);
  assert.strictEqual(e.get_last_run_blocks(), 5,
    'a guest-created thread keeps its slice budget');
  assert.strictEqual(Atomics.load(rpc, RPC.SLOT.INPUT_WAKE), 1,
    'a guest-created thread cannot consume slot 0 input wake');

  e.set_current_thread_id(1);
  e.run(100000);
  assert.strictEqual(e.get_last_run_blocks(), 0,
    'guest main returns before starting another block after the wake');
  assert.strictEqual(e.get_last_run_halt(), 3,
    'input wake reports an ordinary cooperative boundary');
  assert.strictEqual(Atomics.load(rpc, RPC.SLOT.INPUT_WAKE), 0,
    'input wake is consumed once so the next slice runs normally');

  e.run(5);
  assert.strictEqual(e.get_last_run_blocks(), 5,
    'the slice after the one-shot wake receives its normal budget');

  // Ending the slice that was already running is only half the latency fix.
  // The following slice dequeues and paints the key; if it receives the normal
  // 100k budget, that completed paint is still held from the browser for the
  // duration of a second long slice. Exercise the actual browser drive loop
  // with a controllable Worker to keep the post-input slices short.
  const loop = driveHost(memory);
  const pump = await loop.pumps.next();
  assert.deepStrictEqual(loop.calls, [], 'no slice before the awaited service pump completes');
  pump.resolve();
  let slice = await loop.slices.next();
  assert.strictEqual(slice.steps, 100000, 'idle Worker begins with its configured slice');
  slice.finish({ ms: 200 });
  assert.strictEqual((await loop.schedules.next()).delay, 0);
  loop.dispatch();
  (await loop.pumps.next()).resolve();
  slice = await loop.slices.next();
  assert.strictEqual(slice.steps, 6000,
    'a 200ms full slice adapts to a presentation-sized 12ms block budget');

  // Use real keyboard enqueue/publish/wake, not calls to subscriber callbacks.
  loop.r.handleKeyDown(0x43, { code: 'KeyC' });
  loop.r.handleKeyPress(0x43);
  loop.r.handleKeyUp(0x43, { code: 'KeyC' });
  for (const publish of loop.r._guestWorkerFocusPublishers) {
    publish({}, 0x20005); // unrelated app cannot change this guest's focus
    publish(loop.wine.instance, 0x10005);
  }
  assert.strictEqual(Atomics.load(rpc, RPC.SLOT.INPUT_WAKE), 1,
    'actual keyboard enqueue reaches the shared wake slot');
  assert.strictEqual(loop.tasks.length, 0, 'input cannot duplicate an active slice');
  loop.r.scheduleRepaint();
  slice.finish({ blocks: 0, ms: 200 });
  await loop.schedules.next();
  assert.strictEqual(loop.wine._workerAdaptiveSteps, 6000,
    'early input wake does not poison the throughput sample');
  loop.dispatch();
  const inputPump = await loop.pumps.next();
  assert.strictEqual(loop.calls.length, 2, 'successor still waits for services');
  inputPump.resolve();
  slice = await loop.slices.next();
  assert.strictEqual(slice.steps, 1000,
    'the slice that dequeues and paints keyboard input is capped at 1k blocks');
  assert.strictEqual(slice.sync.focusHwnd, 0x10005,
    'the short input slice carries renderer focus to the live guest instance');

  // A sibling's poll between dequeue and argument reads must not steal the
  // active event. Queued foreign input must stay queued across await and rAF.
  const foreign = { type: 'key', hwnd: 0x20005, msg: 0x0102, wParam: 0x58, lParam: 99 };
  loop.r.inputQueue.unshift(foreign);
  loop.r._publishInputQueueDepth();
  const delivered = [];
  for (const msg of [0x100, 0x102, 0x101]) {
    assert.strictEqual(loop.main.check_input() & 0xffff, msg, 'owned keys stay FIFO');
    delivered.push(loop.wine._lastInputEvent);
    const lparam = loop.wine._lastInputEvent.lParam | 0;
    // No matching event for this host after the last key; its foreign event
    // stays on the queue, preserving the outer active event.
    if (msg === 0x101) {
      assert.strictEqual(loop.sibling.check_input(), 0);
      assert.strictEqual(loop.r._activeInputEvent, delivered[2]);
      assert.strictEqual(loop.main.check_input_lparam(), lparam);
      assert.strictEqual(loop.main.check_input_wparam(), 0x43);
      assert.strictEqual(loop.main.check_input_hwnd(0x10005), 0x10005);
    }
  }
  assert.strictEqual(new Set(delivered).size, 3, 'each enqueued key executes exactly once');
  assert.strictEqual(loop.r.inputQueue.length, 1);
  assert.strictEqual(loop.r.inputQueue[0], foreign, 'another app retains its event');
  loop.r.scheduleRepaint();
  loop.frame();
  assert.strictEqual(loop.displays.length, 0, 'input drawing is hidden during its slice');
  assert.strictEqual(loop.wine._presentFrameDue, true,
    'an already armed display frame defers until the input slice completes');
  slice.finish({ ms: 2 });
  await loop.schedules.next();
  assert.strictEqual(loop.r._workerPublicationHeld(), false);
  loop.frame();
  assert.deepStrictEqual(loop.displays, [1], 'completed input paint publishes once');
  assert.strictEqual(loop.main.check_input_lparam(), delivered[2].lParam | 0,
    'active RPC event arguments survive the slice await and repaint');
  assert.strictEqual(loop.main.check_input(), 0, 'repaint cannot redeliver consumed input');
  assert.strictEqual(loop.r._activeInputEvent, delivered[2],
    'an unowned queued event leaves active event ownership intact');

  // Burst tails must expire even if an unrelated app keeps input queued.
  const burst = loop.wine._workerInputBurstSlices;
  for (let i = 0; i <= burst; i++) {
    loop.dispatch();
    (await loop.pumps.next()).resolve();
    slice = await loop.slices.next();
    assert.strictEqual(slice.steps, i < burst ? 1000 : 6000,
      'short burst expires back to the measured configured budget');
    slice.finish({ ms: i < burst ? 2 : 12 });
    await loop.schedules.next();
  }
  assert.strictEqual(loop.r.takeInput(event => event === foreign), foreign,
    'the owning app can still dequeue its exact event after burst expiry');
  // A zero published depth takes the Worker's local fast path. Force the
  // adverse stale-depth ordering to exercise a real empty RPC and scope clear.
  loop.wine.guestWorker.broker.publish({ inputPending: 1 });
  assert.strictEqual(loop.main.check_input(), 0, 'empty queue ends this caller pump');
  assert.strictEqual(loop.main.check_input_lparam(), 0, 'own empty poll clears its RPC event');
  assert.deepStrictEqual(loop.serviceCounts(), [loop.calls.length, loop.calls.length],
    'ticks and audio completion services continue once per slice');
  await loop.stopAtPump();

  // A runtime configuration change is read AFTER boundary services, and a
  // key arriving during that await must affect the very next admitted slice.
  const changed = driveHost(memory, 42000);
  const heldPump = await changed.pumps.next();
  changed.wine.stepsPerSlice = 23000;
  changed.r.handleKeyDown(0x44, { code: 'KeyD' });
  assert.strictEqual(changed.calls.length, 0);
  heldPump.resolve();
  slice = await changed.slices.next();
  assert.strictEqual(slice.steps, 1000, 'input during service await selects short quantum');
  assert.strictEqual(changed.wine._workerAdaptiveCeiling, 23000,
    'latest configured quantum is observed after services');
  slice.finish({ blocks: 0, ms: 300 });
  await changed.schedules.next();
  assert.strictEqual(changed.wine._workerAdaptiveSteps, 23000);
  const tail = changed.wine._workerInputBurstSlices;
  for (let i = 0; i <= tail; i++) {
    changed.dispatch();
    (await changed.pumps.next()).resolve();
    slice = await changed.slices.next();
    assert.strictEqual(slice.steps, i < tail ? 1000 : 23000,
      'configured quantum is selected when the input burst expires');
    slice.finish({ blocks: 0 });
    await changed.schedules.next();
  }
  changed.wine.stepsPerSlice = 500;
  changed.dispatch();
  (await changed.pumps.next()).resolve();
  slice = await changed.slices.next();
  assert.strictEqual(slice.steps, 1000, 'configured quantum retains its 1k minimum');
  slice.finish();
  await changed.schedules.next();
  await changed.stopAtPump();

  // Adverse result ordering: the guest already returned GetMessage wait when
  // a browser key arrives. The reply is still in flight, so no park exists
  // for the wake hook to cancel yet. It must not arm a stale sleep afterwards.
  const raced = driveHost(memory);
  (await raced.pumps.next()).resolve();
  slice = await raced.slices.next();
  raced.r.handleKeyDown(0x45, { code: 'KeyE' });
  slice.finish({ yield: 7, blocks: 0, timerDue: 50 });
  assert.strictEqual((await raced.schedules.next()).delay, 0,
    'input preceding a message-wait reply prevents stale host parking');
  assert.strictEqual(raced.timers.size, 0, 'no lost input wake until a polling timer');
  raced.dispatch();
  (await raced.pumps.next()).resolve();
  slice = await raced.slices.next();
  assert.strictEqual(slice.steps, 1000);
  assert.strictEqual(raced.main.check_input() & 0xffff, 0x100);
  assert.strictEqual(raced.main.check_input(), 0);
  slice.finish({ yield: 7, blocks: 0, timerDue: 50 });
  assert.strictEqual((await raced.schedules.next()).delay, 50,
    'drained input permits the ordinary message-wait park');
  assert.strictEqual(raced.timers.size, 1);
  raced.r.handleKeyUp(0x45, { code: 'KeyE' });
  assert.strictEqual((await raced.schedules.next()).delay, 0,
    'actual input wake cancels an already armed park');
  assert.strictEqual(raced.timers.size, 0);
  raced.r.handleKeyPress(0x45);
  assert.strictEqual(raced.tasks.length, 1, 'repeated wakes coalesce into one successor');
  raced.dispatch();
  (await raced.pumps.next()).resolve();
  slice = await raced.slices.next();
  assert.strictEqual(slice.steps, 1000);
  assert.strictEqual(raced.main.check_input() & 0xffff, 0x101);
  assert.strictEqual(raced.main.check_input() & 0xffff, 0x102);
  assert.strictEqual(raced.main.check_input(), 0);
  slice.finish();
  await raced.schedules.next();
  await raced.stopAtPump();

  // A nonempty shared queue alone cannot defeat parking: these events belong
  // to a different process, and the admitted slice has already seen its wake.
  const unowned = driveHost(memory);
  const foreignPump = await unowned.pumps.next();
  unowned.r.inputQueue.push(foreign);
  unowned.r._wakeMessageWait(true);
  foreignPump.resolve();
  slice = await unowned.slices.next();
  assert.strictEqual(unowned.main.check_input(), 0);
  slice.finish({ yield: 7, blocks: 0, timerDue: 50 });
  assert.strictEqual((await unowned.schedules.next()).delay, 50,
    'unowned queued input cannot cause hot message-wait polling');
  assert.strictEqual(unowned.r.inputQueue[0], foreign);
  unowned.r.handleKeyDown(0x46, { code: 'KeyF' });
  await unowned.schedules.next();
  await unowned.stopAtPump();

  console.log('PASS Worker keyboard input creates complete-block and short presentation boundaries');
})().then(() => clearTimeout(watchdog)).catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
