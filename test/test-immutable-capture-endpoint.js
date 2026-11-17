#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const { Win98Renderer } = require('../lib/renderer');
const { PresentationFilter } = require('../lib/presentation-filter');
const { createCanvas } = require('../lib/raster-canvas');

function fixture(mode = 'integer') {
  const r = new Win98Renderer(createCanvas(8, 8));
  r.canvas.style = {};
  r.presentationCanvas = createCanvas(16, 16);
  r.presentationCanvas.style = {};
  r.presentationFilter = new PresentationFilter(r.presentationCanvas, { createCanvas: () => null });
  r.presentationScaleMode = mode;
  return r;
}
function host(r) {
  const context = { URLSearchParams, console, setTimeout, clearTimeout,
    performance: { now: () => 0 }, requestAnimationFrame() {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('../host.js'), 'utf8') +
    '\n;globalThis.Host = WineAssembly;', context);
  return Object.assign(Object.create(context.Host.prototype), { renderer: r,
    _cancelPresentFrame() {}, _dropRendererFrame() {}, _presentDxIfDirty: () => 0 });
}
function window(r, color = '#ff0000') {
  const canvas = createCanvas(8, 8), ctx = canvas.getContext('2d');
  ctx.fillStyle = color; ctx.fillRect(0, 0, 8, 8);
  const win = { hwnd: 123, x: 0, y: 0, w: 8, h: 8, z: 1, visible: true,
    isChild: false, style: 0x80000000, _backCanvas: canvas, _gdiWriteSeq: 5 };
  r.windows[win.hwnd] = win;
  return win;
}
function pixels(canvas) {
  return Array.from(canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data);
}

test('actual host natural publication retains selected source and filtered output, never stale bytes', () => {
  const r = fixture(), h = host(r), win = window(r);
  const ticket = h.requestImmutableCapture();
  assert.equal(ticket.status, 'pending');
  assert.equal(ticket.read(), null);
  assert.equal(r._repaintScheduled, false, 'request does not schedule repaint');
  assert.throws(() => h.requestImmutableCapture(), /already pending/);
  r._isNode = false; r._repaintScheduled = true;
  h._presentNow();
  assert.equal(ticket.status, 'complete');
  const first = ticket.read(), m = first.metadata;
  assert.equal(m.publication, 1);
  assert.equal(m.completion, 'canvas2d-readback');
  assert.equal(m.engineRender, null); assert.equal(m.viewportPlayer, null);
  assert.equal(m.workerSlice, null);
  assert.deepEqual(m.composition.windows.map(w => w.hwnd), [123]);
  assert.match(m.backend, /^canvas-/);
  const selected = r._exclusivePresentationSource || r.canvas;
  assert.deepEqual(Array.from(first.sourceRGBA), pixels(selected));
  assert.deepEqual(Array.from(first.outputRGBA), pixels(r.presentationCanvas));
  assert.equal(first.outputRGBA.length, 16 * 16 * 4);
  first.outputRGBA.fill(99); first.sourceRGBA.fill(99);
  win._backCanvas.getContext('2d').fillStyle = '#0000ff';
  win._backCanvas.getContext('2d').fillRect(0, 0, 8, 8);
  win.hwnd = 456;
  const next = h.requestImmutableCapture();
  assert.equal(next.read(), null, 'old publication is unavailable to a new request');
  r._repaintScheduled = true; h._presentNow();
  assert.equal(next.read().metadata.publication, 2);
  assert.deepEqual(ticket.read().metadata.composition.windows.map(w => w.hwnd), [123]);
  assert.notDeepEqual(Array.from(ticket.read().outputRGBA), Array.from(next.read().outputRGBA));
  assert.notEqual(ticket.read().outputRGBA[0], 99);
  assert.throws(() => { m.source.width = 90; }, TypeError);
});

test('held/nested/display-only calls cannot fulfill or cross a request', () => {
  const r = fixture(), t = r.requestImmutableCapture();
  r.beginWorkerGuestSlice(); r.repaint();
  assert.equal(t.status, 'pending'); assert.equal(r._workerGuestSliceDepth, 1);
  r._presentDisplayCanvas();
  assert.equal(t.status, 'pending');
  r.endWorkerGuestSlice();
  r._repainting = true; r.repaint(); r._repainting = false;
  assert.equal(t.status, 'pending');
  r.repaint(); assert.equal(t.status, 'complete');
  const next = r.requestImmutableCapture();
  r._presentDisplayCanvas(); assert.equal(next.status, 'pending');
  assert.equal(next.cancel(), true); assert.equal(next.read(), null);
  r.repaint(); assert.equal(next.status, 'cancelled');
});

test('failed display never promotes a candidate, including later display-only and recovery', () => {
  for (const kind of ['false', 'throw']) {
    const r = fixture(), ctx = r.presentationFilter.ctx, draw = ctx.drawImage;
    r.repaint();
    const t = r.requestImmutableCapture();
    if (kind === 'false') r.presentationFilter.ctx = null;
    else ctx.drawImage = () => { throw Error('display threw'); };
    assert.throws(() => r.repaint(), /returned false|display threw/);
    assert.equal(t.status, 'failed'); assert.equal(t.read(), null);
    assert.equal(r._immutablePublicationSequence, 1);
    r.presentationFilter.ctx = ctx; ctx.drawImage = draw;
    r._presentDisplayCanvas(); assert.equal(t.read(), null);
    const next = r.requestImmutableCapture(); r.repaint();
    assert.equal(next.read().metadata.publication, 2);
    assert.equal(t.status, 'failed');
  }
});

test('tainted and oversized readbacks fail independently of successful publication', () => {
  for (const kind of ['tainted', 'oversized']) {
    const r = fixture('nearest'), ctx = r.ctx, read = ctx.getImageData;
    if (kind === 'tainted') ctx.getImageData = () => { throw Error('tainted canvas'); };
    if (kind === 'oversized') {
      const display = r._presentDisplayCanvas.bind(r);
      r._presentDisplayCanvas = () => ({ ...display(),
        output: { width: 16777217, height: 1, getContext() { throw Error('must bound before allocation'); } } });
    }
    const t = r.requestImmutableCapture();
    assert.doesNotThrow(() => r.repaint());
    assert.equal(t.status, 'failed'); assert.equal(t.read(), null);
    assert.match(t.error, /tainted|limit/);
    assert.equal(r._immutablePublicationSequence, 1);
    ctx.getImageData = read;
  }
});

test('direct and headless paths identify the logical output without calling the filter', () => {
  for (const mode of ['nearest', 'browser-hq', 'headless']) {
    const r = fixture(mode);
    if (mode === 'headless') r.presentationFilter = null;
    else r.presentationFilter.present = () => { throw Error('must bypass'); };
    const t = r.requestImmutableCapture(); r.repaint();
    const record = t.read();
    assert.equal(record.metadata.backend, mode === 'headless' ? 'logical-canvas' : 'direct-canvas');
    assert.deepEqual(Array.from(record.sourceRGBA), Array.from(record.outputRGBA));
  }
});

test('actual exclusive selection copies its separate source and presentation viewport together', () => {
  const r = fixture(), win = window(r);
  win.wasm = { exports: { get_dx_exclusive_hwnd: () => 123 } };
  const t = r.requestImmutableCapture(); r.repaint();
  const record = t.read(), source = r._exclusivePresentationSource;
  assert(source && source !== r.canvas);
  assert.equal(record.metadata.source.kind, 'exclusive');
  assert.equal(record.metadata.composition.exclusive, true);
  assert.deepEqual(Array.from(record.sourceRGBA), pixels(source));
  assert.deepEqual(Array.from(record.outputRGBA), pixels(r.presentationCanvas));
  assert.deepEqual(record.metadata.presentationViewport, r._exclusivePresentationViewport);
  const crop = record.metadata.presentationViewport.cropBase.x;
  r._exclusivePresentationViewport.cropBase.x = 987;
  assert.equal(record.metadata.presentationViewport.cropBase.x, crop);
  assert.throws(() => { record.metadata.presentationViewport.cropBase.x = 99; }, TypeError);
  // Changing the selected window/source for a subsequent publication cannot
  // silently relabel the earlier bytes or approve an uncompleted request.
  delete r.windows[123];
  const next = r.requestImmutableCapture();
  assert.equal(next.read(), null);
  r.repaint();
  assert.equal(next.read().metadata.source.kind, 'logical');
  assert.deepEqual(record.metadata.composition.windows.map(w => w.hwnd), [123]);
});

function ownedFixture() {
  const r = fixture(), h = host(r), win = window(r);
  h.processId = win.processId = 1000;
  h.instance = win.wasm = { exports: {} };
  return { r, h, win };
}

test('scoped host capture binds actual selected window/process, ignoring caller owner labels', () => {
  const { r, h, win } = ownedFixture();
  const options = { hwnd: win.hwnd, processId: 2000, instance: {} };
  const t = h.requestImmutableCapture(options);
  options.hwnd = 999; // Admission owns a copy; changing caller data cannot retarget it.
  assert.equal(r._repaintScheduled, false);
  r.repaint();
  assert.equal(t.status, 'complete');
  const record = t.read();
  assert.deepEqual(record.metadata.captureOwner, { hwnd: 123, processId: 1000 });
  assert.equal(record.metadata.composition.windows[0].processId, 1000);
  assert.deepEqual(Array.from(record.outputRGBA), pixels(r.presentationCanvas));
  assert.equal(record.metadata.engineRender, null);
  assert.equal(record.metadata.viewportPlayer, null);
  assert.equal(record.metadata.workerSlice, null);
  win.processId = 3000;
  assert.equal(t.read().metadata.captureOwner.processId, 1000);
  assert.throws(() => { record.metadata.captureOwner.processId = 1; }, TypeError);
  assert.equal(Object.values(record.metadata.captureOwner).includes(h.instance), false);
});

test('scoped admission rejects foreign or unmeasured owners without occupying the request slot', () => {
  for (const change of [({ win }) => { win.processId++; },
    ({ win }) => { win.wasm = { exports: {} }; },
    ({ h }) => { h.instance = null; },
    ({ h }) => { h.processId = undefined; },
    ({ r }) => { delete r.windows[123]; }]) {
    const f = ownedFixture(); change(f);
    assert.throws(() => f.h.requestImmutableCapture({ hwnd: 123 }), /owner/);
    assert.equal(f.r._immutableCaptureRequest, undefined);
    assert.equal(f.r._repaintScheduled, false);
    const unscoped = f.h.requestImmutableCapture(); f.r.repaint();
    assert.equal(unscoped.status, 'complete');
    assert.equal(unscoped.read().metadata.captureOwner, null);
  }
});

test('scoped capture rejects stale HWND reuse, changed owner and absent selection without repaint retries', () => {
  const changes = {
    reuse: ({ r, win }) => { r.windows[123] = { ...win }; },
    process: ({ win }) => { win.processId++; },
    instance: ({ win }) => { win.wasm = { exports: {} }; },
    hidden: ({ win }) => { win.visible = false; },
    removed: ({ r }) => { delete r.windows[123]; },
    exclusive: ({ r, win }) => {
      const covering = { ...win, hwnd: 456, z: 2 };
      win.wasm.exports.get_dx_exclusive_hwnd = () => 456;
      r.windows[456] = covering;
    },
  };
  for (const [kind, change] of Object.entries(changes)) {
    const f = ownedFixture(), t = f.h.requestImmutableCapture({ hwnd: 123 });
    change(f); f.r.repaint();
    assert.equal(t.status, 'failed', kind); assert.match(t.error, /owner/, kind);
    assert.equal(t.read(), null); assert.equal(f.r._immutablePublicationSequence, 1);
    f.r._presentDisplayCanvas(); assert.equal(t.read(), null);
    const next = f.h.requestImmutableCapture(); f.r.repaint();
    assert.equal(next.read().metadata.publication, 2);
    assert.equal(t.status, 'failed');
  }
});

test('owner is checked at selection and after display; holds and failed display cannot bless it', () => {
  for (const kind of ['selection', 'after-display', 'false', 'throw']) {
    const { r, h, win } = ownedFixture();
    const t = h.requestImmutableCapture({ hwnd: 123 });
    r.beginWorkerGuestSlice(); r.repaint(); assert.equal(t.status, 'pending');
    r.endWorkerGuestSlice();
    const present = r._presentDisplayCanvas.bind(r);
    if (kind === 'selection') {
      r.windows[123] = { ...win };
      r._presentDisplayCanvas = () => {
        const display = present(); r.windows[123] = win; return display;
      };
    } else if (kind === 'after-display') {
      r._presentDisplayCanvas = () => {
        const display = present(); win.processId++; return display;
      };
    } else if (kind === 'false') r.presentationFilter.ctx = null;
    else r.presentationFilter.ctx.drawImage = () => { throw Error('scoped display threw'); };
    if (kind === 'false' || kind === 'throw') assert.throws(() => r.repaint(), /returned false|scoped display threw/);
    else r.repaint();
    assert.equal(t.status, 'failed', kind); assert.equal(t.read(), null);
    assert.match(t.error, kind === 'false' ? /returned false/ : kind === 'throw' ? /scoped display threw/ : /owner/);
  }
});

test('current display is a request-local read of an unchanged ordinary publication, not a new frame', () => {
  const { r, h } = ownedFixture(); r.repaint();
  const pub = r._immutablePublicationSequence, displayedAt = r._currentDisplayRecord.displayedAt;
  const next = h.requestImmutableCapture({ hwnd: 123 });
  assert.equal(next.status, 'pending'); next.cancel();
  const a = h.requestCurrentDisplayCapture({ hwnd: 123 }), first = a.read();
  assert.equal(a.status, 'complete');
  assert.equal(first.metadata.publication, pub);
  assert.equal(first.metadata.displayedAt, displayedAt);
  assert.equal(first.metadata.observation, 'current-display');
  assert.equal(first.metadata.content, 'already-displayed');
  assert.equal(first.metadata.engineRender, null);
  assert(first.metadata.requestedAt <= first.metadata.readbackStartedAt);
  assert(first.metadata.readbackStartedAt <= first.metadata.readbackCompletedAt);
  assert.deepEqual(Array.from(first.outputRGBA), pixels(r.presentationCanvas));
  first.outputRGBA.fill(99);
  const b = h.requestCurrentDisplayCapture({ hwnd: 123 });
  assert.deepEqual(b.read().outputRGBA, a.read().outputRGBA);
  assert.equal(r._immutablePublicationSequence, pub);
  assert.equal(r._repaintScheduled, false);
});

test('current display preserves pending damage and cancellation without scheduling or forcing publication', () => {
  const { r, h, win } = ownedFixture(); r.repaint();
  const old = h.requestCurrentDisplayCapture({ hwnd: 123 }).read();
  win._backCanvas.getContext('2d').fillStyle = '#0000ff';
  win._backCanvas.getContext('2d').fillRect(0, 0, 8, 8);
  r.scheduleRepaint();
  const cancelled = h.requestCurrentDisplayCapture({ hwnd: 123 });
  assert.equal(cancelled.status, 'pending'); assert.equal(cancelled.read(), null);
  assert(cancelled.cancel());
  const t = h.requestCurrentDisplayCapture({ hwnd: 123 });
  assert.equal(t.status, 'pending'); assert.equal(r._repaintScheduled, true);
  r.flushRepaint();
  const now = t.read(); assert.equal(t.status, 'complete');
  assert.equal(now.metadata.content, 'ordinary-publication-after-request');
  assert.equal(now.metadata.publication, old.metadata.publication + 1);
  assert.notDeepEqual(now.outputRGBA, old.outputRGBA);
  assert.deepEqual(Array.from(now.outputRGBA), pixels(r.presentationCanvas));
  assert.equal(cancelled.status, 'cancelled'); assert.equal(cancelled.read(), null);
});

test('current display refuses replacement, hidden/clipped owner and unreceipted display', () => {
  for (const [name, change] of Object.entries({
    replacement: ({ r, win }) => { r.windows[123] = { ...win }; },
    hidden: ({ win }) => { win.visible = false; },
    clipped: ({ win }) => { win.x = -1; },
    changedProcess: ({ win }) => { win.processId++; },
    changedInstance: ({ win }) => { win.wasm = {}; },
    output: ({ r }) => { r.presentationCanvas = createCanvas(16, 16); },
    resizedOutput: ({ r }) => { r.presentationCanvas.width++; },
    transparent: ({ r }) => { r.transparentDesktop = true; },
    displayOnly: ({ r }) => r._presentDisplayCanvas(),
    failedDisplay: ({ r }) => { r.presentationFilter.ctx = null; assert.throws(() => r.repaint()); },
  })) {
    const f = ownedFixture(); f.r.repaint(); change(f);
    let t;
    try { t = f.h.requestCurrentDisplayCapture({ hwnd: 123 }); }
    catch (e) { assert.match(e.message, /owner/, name); continue; }
    assert.equal(t.status, 'failed', name); assert.equal(t.read(), null, name);
    assert.equal(f.r._immutableCaptureRequest, null, name);
  }
});

test('renderer-only writer queues without host flags, reads or scheduling until natural complete publication', () => {
  for (const kind of ['slice', 'render-writer', 'paint', 'nested']) {
    const { r, h, win } = ownedFixture(); r.repaint();
    const old = h.requestCurrentDisplayCapture({ hwnd: 123 }).read();
    const words = new Int32Array(new SharedArrayBuffer(16));
    if (kind === 'slice') r.beginWorkerGuestSlice();
    if (kind === 'render-writer') {
      Atomics.store(words, 0, 1);
      r._d3dimPublicationJoins = [{ live: true, epoch: { words }, startComposition() {}, publication() {}, transfer() {} }];
    }
    if (kind === 'paint') r.beginWorkerGdiPaint(123);
    if (kind === 'nested') r._repainting = true;
    const scheduled = r._repaintScheduled;
    const t = h.requestCurrentDisplayCapture({ hwnd: 123 });
    assert.equal(t.status, 'pending', kind); assert.equal(t.read(), null);
    assert.equal(r._repaintScheduled, scheduled, 'request must not schedule');
    assert.equal(r._immutablePublicationSequence, old.metadata.publication);
    win._backCanvas.getContext('2d').fillStyle = '#0000ff';
    win._backCanvas.getContext('2d').fillRect(0, 0, 8, 8);
    if (kind === 'slice' || kind === 'render-writer') {
      r.repaint(); assert.equal(t.status, 'pending');
    }
    if (kind === 'slice') r.endWorkerGuestSlice();
    if (kind === 'render-writer') Atomics.store(words, 0, 0);
    if (kind === 'paint') r.endWorkerGdiPaint(123);
    if (kind === 'nested') r._repainting = false;
    assert.equal(t.status, 'pending', 'hold release alone cannot complete');
    r.repaint(); assert.equal(t.status, 'complete', t.error);
    const now = t.read();
    assert.equal(now.metadata.content, 'ordinary-publication-after-request');
    assert(Object.values(now.metadata.rendererWorkAtRequest).some(Boolean));
    assert(Object.values(now.metadata.pendingHostPublicationAtRequest).every(v => !v));
    assert.deepEqual(Array.from(now.outputRGBA), pixels(r.presentationCanvas));
    assert.notDeepEqual(now.outputRGBA, old.outputRGBA);
    const retained = now.outputRGBA.slice(); now.outputRGBA.fill(99); r.repaint();
    assert.deepEqual(t.read().outputRGBA, retained);
  }
});

test('renderer-only pending capture preserves cancellation, owner identity, display/read failure and partial paint refusal', () => {
  for (const fault of ['cancel', 'owner', 'process', 'instance', 'display', 'readback', 'paint']) {
    const { r, h, win } = ownedFixture(); r.repaint(); r.beginWorkerGuestSlice();
    const t = h.requestCurrentDisplayCapture({ hwnd: 123 });
    assert.equal(t.status, 'pending');
    if (fault === 'cancel') t.cancel();
    if (fault === 'owner') r.windows[123] = { ...win };
    if (fault === 'process') win.processId++;
    if (fault === 'instance') win.wasm = {};
    if (fault === 'display') r._presentDisplayCanvas = () => { throw Error('lost display'); };
    if (fault === 'readback') r.presentationCanvas.getContext('2d').getImageData = () => { throw Error('failed readback'); };
    if (fault === 'paint') r.beginWorkerGdiPaint(123);
    r.endWorkerGuestSlice();
    if (fault === 'display') assert.throws(() => r.repaint(), /lost display/);
    else r.repaint();
    assert.equal(t.status, fault === 'cancel' ? 'cancelled' : 'failed', fault);
    assert.equal(t.read(), null); assert.equal(r._immutableCaptureRequest, null);
  }
});

test('pending current display cannot cross owner replacement', () => {
  const { r, h, win } = ownedFixture(); r.repaint(); r.scheduleRepaint();
  const t = h.requestCurrentDisplayCapture({ hwnd: 123 });
  r.windows[123] = { ...win }; r.flushRepaint();
  assert.equal(t.status, 'failed'); assert.equal(t.read(), null);
});

test('queued host capture waits for actual unheld publication without uploading, scheduling or completing a writer', () => {
  for (const field of ['_dxDirty', '_dxLockDeferred', '_presentFrameDue']) {
    const { r, h, win } = ownedFixture(); r.repaint();
    const old = h.requestCurrentDisplayCapture({ hwnd: 123 });
    const seq = r._immutablePublicationSequence;
    win._backCanvas.getContext('2d').fillStyle = '#0000ff';
    win._backCanvas.getContext('2d').fillRect(0, 0, 8, 8);
    h[field] = true;
    r.beginWorkerGuestSlice();
    const t = h.requestCurrentDisplayCapture({ hwnd: 123 });
    assert.equal(t.status, 'pending'); assert.equal(t.read(), null);
    assert.equal(r._repaintScheduled, false);
    assert.equal(r._immutablePublicationSequence, seq);
    assert.equal(h[field], true);
    r.repaint(); assert.equal(t.status, 'pending', 'active writer cannot publish');
    r.endWorkerGuestSlice();
    h[field] = false;
    r.repaint();
    assert.equal(t.status, 'complete', t.error);
    const now = t.read();
    assert.equal(now.metadata.publication, seq + 1);
    assert.equal(now.metadata.content, 'ordinary-publication-after-request');
    const key = {_dxDirty:'dirty',_dxLockDeferred:'lockDeferred',_presentFrameDue:'presentDue'}[field];
    assert.equal(now.metadata.pendingHostPublicationAtRequest[key], true);
    assert.notDeepEqual(now.outputRGBA, old.read().outputRGBA);
    assert.deepEqual(Array.from(now.outputRGBA), pixels(r.presentationCanvas));
    assert.equal(old.read().metadata.publication, seq);
    const retained = now.outputRGBA.slice(); now.outputRGBA.fill(99); r.repaint();
    assert.deepEqual(t.read().outputRGBA, retained, 'completed ticket remains detached');
  }
});

test('queued host request retains cancellation, owner replacement and failed readback refusal', () => {
  for (const fault of ['cancel', 'owner', 'readback']) {
    const { r, h, win } = ownedFixture(); r.repaint(); h._dxDirty = true;
    const t = h.requestCurrentDisplayCapture({ hwnd: 123 });
    assert.equal(t.status, 'pending');
    if (fault === 'cancel') assert(t.cancel());
    if (fault === 'owner') r.windows[123] = { ...win };
    if (fault === 'readback') r.presentationCanvas.getContext('2d').getImageData = () => { throw Error('failed readback'); };
    h._dxDirty = false; r.repaint();
    assert.equal(t.status, fault === 'cancel' ? 'cancelled' : 'failed');
    assert.equal(t.read(), null);
  }
});

test('current readback fails closed on identity change during read and never substitutes prior bytes', () => {
  for (const kind of ['owner', 'output', 'tainted', 'alpha']) {
    const { r, h, win } = ownedFixture(); r.repaint();
    const old = h.requestCurrentDisplayCapture({ hwnd: 123 }).read();
    const ctx = r.presentationCanvas.getContext('2d'), read = ctx.getImageData;
    ctx.getImageData = function (...args) {
      const data = read.apply(this, args);
      if (kind === 'owner') r.windows[123] = { ...win };
      if (kind === 'output') r.presentationCanvas = createCanvas(16, 16);
      if (kind === 'tainted') throw Error('readback tainted');
      if (kind === 'alpha') data.data[3] = 0;
      return data;
    };
    const t = h.requestCurrentDisplayCapture({ hwnd: 123 });
    assert.equal(t.status, 'failed', kind); assert.equal(t.read(), null);
    assert.equal(r._immutableCaptureRequest, null);
    assert.equal(old.metadata.publication, 1);
  }
});

test('current exclusive display proves complete one-owner source crop and contained output from the production viewport', () => {
  const { r, h, win } = ownedFixture();
  win.wasm.exports.get_dx_exclusive_hwnd = () => win.hwnd;
  r.repaint();
  const t = h.requestCurrentDisplayCapture({ hwnd: 123 });
  assert.equal(t.status, 'complete', t.error);
  assert.equal(t.read().metadata.composition.exclusive, true);
  assert.deepEqual(Array.from(t.read().outputRGBA), pixels(r.presentationCanvas));
  assert.equal(t.read().metadata.content, 'already-displayed');
  for (const change of [v => { v.cropX++; }, v => { v.cropW--; },
    v => { v.dstX = -1; }, v => { v.dstH = v.outputH + 1; },
    v => { v.cropBase.w--; }]) {
    const f = ownedFixture(); f.win.wasm.exports.get_dx_exclusive_hwnd = () => 123;
    f.r.repaint(); change(f.r._exclusivePresentationViewport);
    const refused = f.h.requestCurrentDisplayCapture({ hwnd: 123 });
    assert.equal(refused.status, 'failed'); assert.equal(refused.read(), null);
  }
});
