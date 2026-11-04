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
