#!/usr/bin/env node
'use strict';

// The browser run loop used to upload the DirectDraw frame and composite the
// desktop at the end of every scheduler step. Steps outnumber display frames
// (Moorhuhn 3: ~90 guest presents/s on a 60 Hz page), so every upload past
// one per frame was overwritten unseen. host.js now only notes a waiting
// frame at the step boundary and uploads from requestAnimationFrame.
//
// This drives host.js's real Worker run loop in a vm context with a fake rAF
// and checks the contract:
//   - N presents inside one display frame produce ONE upload, of the newest
//   - no upload happens before the rAF (the boundary only arms it)
//   - a rAF that fires while a Worker slice holds publication makes the
//     frame due, and the slice's own boundary publishes it
//   - stop() flushes a pending frame and drops the rAF
//   - an idle loop arms no rAF at all
//   - with no rAF (a non-DOM host) the boundary presents synchronously
// plus the perf HUD's upload counter, which is what keeps "PRESENT/s" (guest
// presents) and "upload/s" (canvas uploads) apart.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { ThreadManager } = require('../lib/thread-manager');
const { createRequire } = require('module');
const { PresentationFilter } = require('../lib/presentation-filter');
const { createCanvas } = require('../lib/raster-canvas');

const hostSource = fs.readFileSync(path.join(__dirname, '..', 'host.js'), 'utf8');

function makeHost({ withRaf, actualRenderer = false }) {
  const rafQueue = new Map();
  let rafSeq = 0;
  const metrics = [];
  const errors = [];
  const context = { URLSearchParams, console: { ...console, error: (...args) => errors.push(args) }, setTimeout, clearTimeout,
    performance: { now: () => 100 },
    window: { WinePerf: { enabled: true, stepBegin() {}, stepEnd() {}, mark() {}, countBlocks() {},
      frameUpload: (ms, uploaded) => metrics.push(uploaded) } } };
  if (!actualRenderer) delete context.window;
  if (withRaf) {
    context.requestAnimationFrame = cb => { rafQueue.set(++rafSeq, cb); return rafSeq; };
    context.cancelAnimationFrame = id => { rafQueue.delete(id); };
  }
  vm.runInNewContext(hostSource + '\n;globalThis.WineAssembly = WineAssembly;', context);
  const wine = new context.WineAssembly();
  wine.logToUI = message => { throw new Error(message); };
  wine._releaseGuestMemory = () => {}; // No runtime/memory owner in this fixture.
  if (withRaf) wine.__rafForTest = context.requestAnimationFrame;
  const log = { uploads: [], composites: 0, pacedCalls: 0, unpacedCalls: 0,
    sliceSync: [], publications: [] };
  // The guest's frame counter: each slice "presents" a new frame by bumping
  // it and marking the surface dirty, exactly what dx_trace kind 5 does.
  let guestFrame = 0;
  wine._presentDxIfDirty = paced => {
    if (paced) log.pacedCalls++; else log.unpacedCalls++;
    if (!wine._dxDirty) return 0;
    wine._dxDirty = false;
    log.uploads.push(guestFrame);
    return 1;
  };
  let held = false;
  wine.renderer = {
    inputQueue: [], _inputPendingPublishers: new Set(),
    _repaintScheduled: false, _repaintPending: false, _workerRepaintDeferred: false,
    beginWorkerGuestSlice() { held = true; },
    endWorkerGuestSlice() { held = false; },
    _workerPublicationHeld() { return held; },
    flushRepaint(force) {
      if (this._repaintScheduled || force) { this._repaintScheduled = false; log.composites++; }
    },
  };
  if (actualRenderer) {
    const rendererPath = require.resolve('../lib/renderer');
    const rendererContext = { ...context, require: createRequire(rendererPath), module: { exports: {} } };
    vm.runInNewContext(fs.readFileSync(rendererPath, 'utf8'), rendererContext);
    const { Win98Renderer } = rendererContext.module.exports;
    const r = new Win98Renderer(createCanvas(8, 8));
    r._isNode = false;
    r.canvas.style = {};
    r.presentationCanvas = createCanvas(16, 16);
    r.presentationCanvas.style = {};
    r.presentationFilter = new PresentationFilter(r.presentationCanvas, { createCanvas: () => null });
    r.presentationScaleMode = 'integer';
    // Real renderer and host share the browser frame queue through their VM
    // globals; no scheduling or publication method is replaced.
    wine.renderer = r;
  }
  const present = () => { guestFrame++; wine._dxDirty = true; };
  const fireRaf = () => {
    const cbs = [...rafQueue.values()];
    rafQueue.clear();
    for (const cb of cbs) cb();
    return cbs.length;
  };
  return { wine, log, metrics, errors, present, fireRaf, rafQueue, isHeld: () => held };
}

// Drive host.js's own Worker loop (_runThreaded) with a controllable slice.
function driveWorkerLoop(h) {
  const { wine } = h;
  const scheduled = [];
  const resolvers = [];
  wine._scheduleStep = step => scheduled.push(step);
  wine._beginGuestTickBatch = wine._beginGuestTickBatchForTest || (() => {});
  wine._guestTickMs = () => 0;
  wine.instance = wine.instance || { exports: {} };
  wine.guestWorker = {
    broker: { publish(state) { h.log.publications.push(state); } },
    // runMain reads the main link's send depth and wave offer first
    // (28a104092, f2367f0c5); an idle link has neither.
    link: { threadSendDepth: 0, _waveOffer: null },
    slice(steps, sync) { h.log.sliceSync.push(sync); return new Promise(resolve => resolvers.push(resolve)); },
  };
  wine.running = true;
  wine._runThreaded(1000);
  const tick = () => new Promise(resolve => setImmediate(resolve));
  // The step awaits its boundary work (the wave-callback pump, f2367f0c5)
  // before it asks for the slice; wait until it has.
  const inFlight = async () => {
    for (let i = 0; i < 20 && !resolvers.length; i++) await tick();
  };
  // Finish the in-flight slice (optionally presenting inside it), let the
  // boundary run, and start the next slice.
  const finishSlice = async ({ presents = 0, next = true, result = {} } = {}) => {
    for (let i = 0; i < presents; i++) h.present();
    await inFlight();
    assert.strictEqual(resolvers.length, 1, 'the step has asked for its slice');
    resolvers.shift()({ eip: 1, yield: 0, focusHwnd: 0, blocks: 1000, ms: 1, ...result });
    await tick();
    if (next) {
      assert.strictEqual(scheduled.length, 1, 'a completed slice schedules its successor');
      scheduled.shift()();
      // Return with the next slice in flight, so a caller's rAF or present
      // lands inside it rather than in the step's boundary await.
      await inFlight();
    }
  };
  return { finishSlice, inFlight, resolvers, scheduled };
}

(async () => {
  // A completed main slice is not a completed observed command/render
  // writer. Neither the renderer rAF nor the native decoder may consume
  // damage until those independent writers have all released it.
  {
    const { WriterEpoch } = require('../lib/render-worker');
    const h = makeHost({ withRaf: true, actualRenderer: true });
    const epoch = new WriterEpoch();
    const join = { live: true, epoch };
    h.wine.renderer._d3dimPublicationJoins = new Set([join]);
    h.present();
    const first = epoch.begin(), second = epoch.begin();
    h.wine._presentAtBoundary();
    h.fireRaf();
    assert.deepStrictEqual(h.log.uploads, []);
    assert.strictEqual(h.wine._presentFrameDue, true);
    h.wine._presentAtBoundary();
    assert.deepStrictEqual(h.log.uploads, [], 'due boundary checks observed writers BEFORE native decode');
    assert.strictEqual(h.wine._dxDirty, true, 'damage is retained');
    assert.strictEqual(h.rafQueue.size, 1, 'retry survives an otherwise completed main slice');
    epoch.end(first);
    h.fireRaf();h.wine._presentAtBoundary();
    assert.deepStrictEqual(h.log.uploads, [], 'one remaining writer still excludes the decode');
    epoch.end(second);
    assert.strictEqual(h.wine.renderer._workerPublicationHeld(), false, 'all writers drained at the same main boundary');
    // This test's join supplies only the actual writer epoch; publication
    // correctness is covered by the WAT/native-layer integration fixture.
    h.wine.renderer._d3dimPublicationJoins.clear();
    h.fireRaf();
    assert.deepStrictEqual(h.log.uploads, [1], 'original pending damage uploads after ALL writers drain');
    h.wine.renderer._d3dimPublicationJoins.add(join);
    const stale = epoch.begin();
    join.live = false;
    assert.strictEqual(h.wine.renderer._workerPublicationHeld(), false, 'retired observation cannot hold ordinary display');
    join.live = true;epoch.invalidate();
    assert.strictEqual(h.wine.renderer._workerPublicationHeld(), false, 'poison does not deadlock ordinary display');
    epoch.end(stale);
  }
  {
    const h = makeHost({ withRaf: false });
    h.present();h.wine.renderer.beginWorkerGuestSlice();
    h.wine._presentAtBoundary();
    assert.deepStrictEqual(h.log.uploads, [], 'non-DOM boundary also defers BEFORE decode');
    assert.strictEqual(h.wine._dxLockDeferred, true);
    h.wine.renderer.endWorkerGuestSlice();h.wine._presentAtBoundary();
    assert.deepStrictEqual(h.log.uploads, [1]);
  }
  // ---- many presents in one display frame -> one upload -------------------
  {
    const h = makeHost({ withRaf: true });
    const loop = driveWorkerLoop(h);
    // The first slice is in flight: presents land inside it.
    await loop.finishSlice({ presents: 2 });
    await loop.finishSlice({ presents: 1 });
    await loop.finishSlice({ presents: 3 });
    assert.deepStrictEqual(h.log.uploads, [],
      'a step boundary must not upload; it only arms the display frame');
    assert.strictEqual(h.rafQueue.size, 1, 'three dirty boundaries share one pending rAF');
    // The rAF fires between slices (publication not held).
    h.wine.renderer.endWorkerGuestSlice();
    assert.strictEqual(h.fireRaf(), 1);
    assert.deepStrictEqual(h.log.uploads, [6],
      'six guest presents inside one frame produce exactly one upload, of the newest frame');
    assert.strictEqual(h.log.pacedCalls, 1, 'the rAF upload bypasses the wall-clock frame bucket');
    assert.strictEqual(h.log.unpacedCalls, 0);

    // ---- a rAF during a held Worker slice -> published at the boundary ----
    h.wine.renderer.beginWorkerGuestSlice();
    await loop.finishSlice({ presents: 1 });          // arms a rAF
    h.wine.renderer.beginWorkerGuestSlice();          // next slice in flight
    assert.strictEqual(h.fireRaf(), 1);
    assert.deepStrictEqual(h.log.uploads, [6],
      'nothing is published while the Worker slice holds publication');
    assert.strictEqual(h.wine._presentFrameDue, true, 'the missed frame is remembered as due');
    await loop.finishSlice({ presents: 1 });
    assert.deepStrictEqual(h.log.uploads, [6, 8],
      'the due frame is published at the very next slice boundary, newest pixels');
    assert.strictEqual(h.rafQueue.size, 1,
      'a boundary that published re-arms at once: the next frame lands inside the next slice');

    // ---- slices longer than a display frame: an upload at EVERY boundary ---
    // Each rAF fires mid-slice. Re-arming only at the following boundary
    // would publish every other slice (measured: dx_donuts 26.7 -> 13.8/s).
    for (let i = 0; i < 4; i++) {
      h.fireRaf();                                     // mid-slice: marks due
      await loop.finishSlice({ presents: 1 });
    }
    assert.deepStrictEqual(h.log.uploads, [6, 8, 9, 10, 11, 12],
      'one upload per slice when every slice spans a display frame');

    // ---- a due frame held back by a locked surface keeps the chain ----------
    {
      const upload = h.wine._presentDxIfDirty;
      h.wine._presentDxIfDirty = paced => { h.wine._dxLockDeferred = true; return 0; };
      h.present();
      h.fireRaf();
      await loop.finishSlice({ presents: 0 });
      assert.strictEqual(h.rafQueue.size, 1, 'a lock-deferred due frame re-arms for the next slice');
      h.wine._presentDxIfDirty = upload;
      h.fireRaf();
      await loop.finishSlice({ presents: 0 });
      assert.deepStrictEqual(h.log.uploads.slice(-1), [13], 'and is published one slice later');
    }

    // ---- idle: the chain stops -----------------------------------------------
    h.fireRaf();
    await loop.finishSlice({ presents: 0 });
    assert.strictEqual(h.rafQueue.size, 0, 'a due frame that moved nothing does not re-arm');
    await loop.finishSlice({ presents: 0 });
    assert.strictEqual(h.rafQueue.size, 0, 'an idle boundary must not arm a rAF');

    // ---- stop flushes the pending frame -----------------------------------
    await loop.finishSlice({ presents: 1, next: false });
    assert.strictEqual(h.rafQueue.size, 1, 'a dirty boundary armed a rAF');
    h.wine.renderer.endWorkerGuestSlice();
    try { h.wine.stop({ repaint: false }); } catch (_) {}
    assert.deepStrictEqual(h.log.uploads, [6, 8, 9, 10, 11, 12, 13, 14], 'stop() puts the final frame on the canvas');
    assert.strictEqual(h.rafQueue.size, 0, 'stop() drops the pending rAF (it would hold the host alive)');
  }

  // ---- a trap stops the loop before its boundary: stop still flushes -------
  {
    const h = makeHost({ withRaf: true });
    const loop = driveWorkerLoop(h);
    h.wine.logToUI = () => {};
    h.present();
    h.wine.renderer.endWorkerGuestSlice();
    await loop.inFlight();
    loop.resolvers.shift()({ eip: 1, yield: 0, focusHwnd: 0, blocks: 1000, ms: 1,
      trapped: 'unreachable', regs: {} });
    await new Promise(resolve => setImmediate(resolve));
    assert.strictEqual(h.rafQueue.size, 0, 'a trapped slice never reached its boundary');
    assert.deepStrictEqual(h.log.uploads, [1],
      'stop() uploads a dirty frame even when no rAF was armed for it');
  }

  // ---- GDI-only composite is paced the same way ---------------------------
  {
    const h = makeHost({ withRaf: true });
    const loop = driveWorkerLoop(h);
    h.wine.renderer._repaintScheduled = true;
    await loop.finishSlice();
    h.wine.renderer._repaintScheduled = true;
    await loop.finishSlice();
    assert.strictEqual(h.log.composites, 0, 'no composite at a step boundary');
    h.wine.renderer.endWorkerGuestSlice();
    h.fireRaf();
    assert.strictEqual(h.log.composites, 1, 'one composite per display frame');
    h.wine.running = false;
  }

  // ---- the renderer's own rAF does not composite the frame a second time ---
  // Its scheduleRepaint() arms a rAF during the step, i.e. before the present
  // rAF, so left alone it composites first (without the new DX frame) and the
  // present composites again: two composites per display frame.
  {
    const h = makeHost({ withRaf: true });
    const loop = driveWorkerLoop(h);
    const r = h.wine.renderer;
    r._repaintRaf = null;
    r.scheduleRepaint = function () {
      if (this._repaintScheduled) return;
      this._repaintScheduled = true;
      if (this._repaintRaf !== null) return;
      this._repaintRaf = h.wine.__rafForTest(() => {
        this._repaintRaf = null;
        if (this._repaintScheduled) { this._repaintScheduled = false; h.log.composites++; }
      });
    };
    // Like host-imports' _presentDxSurfaceToMainWindow: an upload schedules
    // the composite that will show it.
    const upload = h.wine._presentDxIfDirty;
    h.wine._presentDxIfDirty = paced => {
      const n = upload(paced);
      if (n) r.scheduleRepaint();
      return n;
    };
    for (let frame = 1; frame <= 3; frame++) {
      h.present(); r.scheduleRepaint();          // guest draws inside the slice
      await loop.finishSlice();
      h.present(); r.scheduleRepaint();
      await loop.finishSlice();
      r.endWorkerGuestSlice();
      h.fireRaf();
      r.beginWorkerGuestSlice();
      assert.strictEqual(h.log.composites, frame, `one composite per display frame (frame ${frame})`);
      assert.strictEqual(h.log.uploads.length, frame, `one upload per display frame (frame ${frame})`);
    }
    h.wine.running = false;
  }

  // ---- no requestAnimationFrame: synchronous, as before --------------------
  {
    const h = makeHost({ withRaf: false });
    const loop = driveWorkerLoop(h);
    await loop.finishSlice({ presents: 1 });
    assert.deepStrictEqual(h.log.uploads, [1], 'without rAF the boundary uploads synchronously');
    assert.strictEqual(h.log.unpacedCalls >= 1, true, 'and keeps the wall-clock throttle');
    assert.strictEqual(h.log.composites >= 1, true, 'and composites with flushRepaint(true)');
    h.wine.running = false;
  }

  // Bootstrap starts without joining: DLL_THREAD_ATTACH may need the creator
  // to release a lock. Real manager methods own singleflight, readiness and
  // runnable selection; only metadata/interpreter exports and transport fake.
  for (const stopBeforeReady of [false, true]) {
    const h = makeHost({ withRaf: false });
    let ready;
    let starts = 0;
    let childSlices = 0, ticks = 0, waves = 0, audio = 0;
    const memory = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true });
    let numThunks = 3, thunkEnd = 0x1234;
    const main = { exports: { get_sync_table: () => 0, get_num_thunks: () => numThunks,
      get_thunk_end: () => thunkEnd, get_dll_count: () => 2,
      sync_thunk_state(end, count) { thunkEnd = end; numThunks = count; } } };
    const backend = {
      readExports: async () => ({ get_image_base: 0x400000 }),
      async spawnThread() {
        starts++;
        await new Promise(resolve => { ready = resolve; });
        return { async slice() { childSlices++; return { eip: 1, yield: 0, blocks: 1 }; } };
      },
    };
    const tm = new ThreadManager({}, memory, main, () => ({ host: {} }),
      { workerBackend: backend, threadsRequested: true });
    tm._log = () => {};
    const handle = tm.createThread(0x401000, 0, 0, 0);
    h.wine.threadManager = tm;
    h.wine.instance = main;
    h.wine._beginGuestTickBatchForTest = () => { ticks++; };
    h.wine.hostCtx = { pumpAudioCompletions() { audio++; },
      async pumpWaveCallbacks() { waves++; } };
    const loop = driveWorkerLoop(h);
    await loop.inFlight();
    assert.strictEqual(starts, 1);
    assert.strictEqual(ticks, 1, 'first guest tick does not join bootstrap');
    assert.strictEqual(loop.resolvers.length, 1, 'creator runs during child bootstrap');
    assert.strictEqual(childSlices, 0, 'pending child cannot enter user code');
    assert.strictEqual(h.log.sliceSync[0].numThunks, 3, 'main receives actual manager sync');
    assert.strictEqual(h.log.sliceSync[0].dllCount, 2);
    assert.strictEqual(tm.waitSingle(handle, 0), 0x102, 'pending handle is unsignaled');
    const publications = h.log.publications.length;
    await loop.finishSlice({ result: { numThunks: 7, thunkEnd: 0x5678 } });
    assert.strictEqual(numThunks, 7, 'host publishes completed main thunk high-water state');
    assert.strictEqual(h.log.sliceSync[1].thunkEnd, 0x5678, 'next main slice receives merged state');
    assert.strictEqual(h.log.publications.length, publications + 1, 'broker service continues next boundary');
    assert.strictEqual(starts, 1, 'successive boundaries share the real bootstrap flight');
    assert.strictEqual(ticks, 2, 'next guest tick continues during bootstrap');
    assert.strictEqual(waves, 2, 'wave callbacks continue during bootstrap');
    assert.strictEqual(audio, 2, 'audio completions continue during bootstrap');
    assert.strictEqual(childSlices, 0);
    const flight = tm.spawnPending(); // Explicit readiness join remains available.
    if (stopBeforeReady) h.wine.running = false;
    ready();
    await flight;
    await loop.finishSlice({ next: !stopBeforeReady });
    assert.strictEqual(tm._pendingThreads.length, 0);
    assert.strictEqual(childSlices, stopBeforeReady ? 0 : 1,
      'ready child gets a real scheduler turn unless host stopped');
    assert.strictEqual(loop.scheduled.length, 0, 'stopped case has no successor');
    h.wine.running = false;
  }

  // ---- actual host + renderer/filter, through ordinary frame scheduling ---
  for (const heldFailure of [false, true]) for (const failure of ['false', 'throw']) {
    const h = makeHost({ withRaf: true, actualRenderer: true });
    const r = h.wine.renderer, ctx = r.presentationFilter.ctx;
    const messages = [];
    h.wine.logToUI = message => messages.push(message);
    let services = 0;
    h.wine.hostCtx = { async pumpWaveCallbacks() { services++; } };
    const loop = driveWorkerLoop(h);
    await loop.inFlight();
    r.scheduleRepaint();
    await loop.finishSlice({ next: false });
    assert.strictEqual(h.rafQueue.size, 1, 'ordinary GDI damage arms host rAF');
    assert.deepStrictEqual(h.metrics, [], 'arming a frame is not publication');
    if (heldFailure) {
      loop.scheduled.shift()();
      await loop.inFlight();
      assert.strictEqual(r._workerPublicationHeld(), true);
      assert.strictEqual(h.fireRaf(), 1);
      assert.strictEqual(h.wine._presentFrameDue, true);
      assert.deepStrictEqual(h.metrics, [], 'held frame cannot count an upload');
      assert.strictEqual(r._repaintScheduled, true, 'held queue retains damage');
    }
    const draw = ctx.drawImage, displayError = new Error('display draw failed');
    if (failure === 'false') r.presentationFilter.ctx = null;
    else ctx.drawImage = () => { throw displayError; };
    if (heldFailure) await loop.finishSlice({ next: false });
    else assert.throws(() => h.fireRaf(), error => failure === 'false'
      ? /PresentationFilter\.present returned false/.test(error.message) : error === displayError);
    assert.deepStrictEqual(h.metrics, [], 'failed display never counts an upload');
    assert.strictEqual(r._repainting, false, 'failed repaint unwinds');
    assert.strictEqual(r._workerPublicationHeld(), false, 'slice hold unwinds');
    assert.strictEqual(h.wine._presentRaf, 0, 'failed callback is consumed');
    assert.strictEqual(h.wine._presentFrameDue, false);
    assert.strictEqual(h.wine.running, true, 'display failure must not stop guest services');
    assert.strictEqual(loop.scheduled.length, 1, 'next ordinary slice remains scheduled');
    r.presentationFilter.ctx = ctx;
    ctx.drawImage = draw;
    loop.scheduled.shift()();
    await loop.inFlight();
    r.scheduleRepaint();
    await loop.finishSlice({ next: false });
    assert.strictEqual(h.rafQueue.size, 1);
    assert.strictEqual(h.fireRaf(), 1);
    assert.deepStrictEqual(h.metrics, [1], 'next ordinary frame publishes exactly once');
    assert.strictEqual(r.presentationFilter.lastBackend, 'canvas-nearest');
    assert.strictEqual(r._repaintScheduled, false);
    assert.strictEqual(r._repaintRaf, null, 'host cancels redundant renderer rAF');
    assert.strictEqual(services, heldFailure ? 3 : 2, 'service pump survives failed display');
    assert.deepStrictEqual(messages, [], 'display failures do not enter fatal guest-loop handler');
    assert.strictEqual(h.errors.length, heldFailure ? 1 : 0);
    if (heldFailure) {
      assert.strictEqual(h.errors[0][0], '[present] deferred frame failed:');
      if (failure === 'throw') assert.strictEqual(h.errors[0][1], displayError);
    }
    h.wine.running = false;
  }

  // ---- perf HUD: uploads counted apart from guest presents ----------------
  {
    let time = 1000;
    const sandbox = { performance: { now: () => time } };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'lib', 'perf-hud.js'), 'utf8'), sandbox);
    const hud = sandbox.WinePerf;
    hud.frameUpload(1, 1);
    assert.strictEqual(hud.uploads.length, 0, 'a disabled HUD records nothing');
    hud.enabled = true;
    hud._startedAt = time;
    for (let i = 0; i < 60; i++) {
      time += 16.7;
      hud.guestFrame(); hud.guestFrame();         // guest presents twice a frame
      hud.frameUpload(2, 1);                        // page uploads once
    }
    const s = hud.snapshot();
    assert(Math.abs(s.uploadsPerSec - s.guestFps / 2) < 2,
      `uploads/s (${s.uploadsPerSec}) is half of PRESENT/s (${s.guestFps})`);
    assert.strictEqual(s.uploadsTotal, 60);
    assert.strictEqual(s.steps, 0, 'out-of-step flushes are not counted as steps');
    assert(Math.abs(s.phaseMs.present - 120) < 1e-6, 'but their time is present-phase time');
    assert(s.presentMsPerSec > 100 && s.presentMsPerSec < 140,
      `present ms/s is absolute (${s.presentMsPerSec})`);
    hud.stepBegin();
    hud.frameUpload(3, 0);
    hud.stepEnd();
    assert.strictEqual(hud.snapshot().uploadsTotal, 60, 'a flush that moved no pixels is not an upload');
  }

  console.log('PASS host rAF coalescing, real Worker bootstrap/service contract and actual display failure/recovery boundaries');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
