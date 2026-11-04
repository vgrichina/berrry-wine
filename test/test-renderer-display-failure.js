#!/usr/bin/env node
'use strict';

// Actual renderer/filter methods with small headless canvases. GPU primitives
// below are fixture seams: they test dispatch, never real WebGL/readback.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Win98Renderer } = require('../lib/renderer');
const { PresentationFilter } = require('../lib/presentation-filter');
const { createCanvas } = require('../lib/raster-canvas');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture() {
  const r = new Win98Renderer(createCanvas(8, 8));
  r.canvas.style = {};
  r.presentationCanvas = createCanvas(16, 16);
  r.presentationCanvas.style = {};
  r.presentationFilter = new PresentationFilter(r.presentationCanvas, { createCanvas: () => null });
  r.presentationScaleMode = 'integer'; // Require the filtered display path.
  return r;
}

function clean(r) {
  assert.equal(r._repainting, false);
  assert.equal(r._repaintPending, false);
}

test('actual false-return filter cannot complete display or repaint; later repaint recovers', () => {
  const r = fixture(), ctx = r.presentationFilter.ctx;
  r.presentationFilter.ctx = null;
  assert.equal(r.presentationFilter.present(r.canvas, 'integer'), false);
  assert.throws(() => r._presentDisplayCanvas(), /PresentationFilter\.present returned false/);
  assert.throws(() => r.repaint(), /PresentationFilter\.present returned false/);
  clean(r);
  r.presentationFilter.ctx = ctx;
  assert.equal(r.repaint(), undefined);
  assert.equal(r.presentationFilter.lastBackend, 'canvas-nearest');
  clean(r);
});

test('zero-sized filtered output fails; restoration recovers', () => {
  const r = fixture();
  // RasterCanvas clamps dimensions to one; model a DOM canvas's zero here.
  r.presentationCanvas = r.presentationFilter.canvas = { width: 0, height: 16 };
  assert.throws(() => r.repaint(), /PresentationFilter\.present returned false/);
  clean(r);
  r.presentationCanvas.width = 16;
  assert.doesNotThrow(() => r.repaint());
});

test('Canvas exception propagates unchanged and restores repaint and filter state', () => {
  const r = fixture(), ctx = r.presentationFilter.ctx;
  const draw = ctx.drawImage, error = new Error('draw failed');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'low';
  ctx.drawImage = () => { r.scheduleRepaint(); throw error; };
  assert.throws(() => r.repaint(), e => e === error);
  clean(r);
  assert.equal(ctx.imageSmoothingEnabled, true);
  assert.equal(ctx.imageSmoothingQuality, 'low');
  ctx.drawImage = draw;
  assert.doesNotThrow(() => r.repaint());
  clean(r);
});

test('flush callers propagate failure and recover on a new ordinary scheduled repaint', () => {
  for (const browser of [false, true]) {
    const r = fixture(), ctx = r.presentationFilter.ctx;
    r._isNode = !browser;
    r._workerLastCompositeAt = -Infinity;
    r._repaintScheduled = true;
    r.presentationFilter.ctx = null;
    assert.throws(() => r.flushRepaint(browser), /PresentationFilter\.present returned false/);
    clean(r);
    assert.equal(r._repaintScheduled, false);
    r.presentationFilter.ctx = ctx;
    r._repaintScheduled = true;
    r._workerLastCompositeAt = -Infinity;
    assert.doesNotThrow(() => r.flushRepaint(browser));
    clean(r);
  }
});

test('rAF caller propagates failure, clears callback and permits later scheduling', () => {
  const old = global.requestAnimationFrame, frames = [];
  global.requestAnimationFrame = fn => { frames.push(fn); return frames.length; };
  try {
    const r = fixture(), ctx = r.presentationFilter.ctx;
    r._isNode = false;
    r.presentationFilter.ctx = null;
    r.scheduleRepaint();
    assert.throws(() => frames.shift()(), /PresentationFilter\.present returned false/);
    assert.equal(r._repaintRaf, null);
    clean(r);
    r.presentationFilter.ctx = ctx;
    r.scheduleRepaint();
    assert.doesNotThrow(() => frames.shift()());
    assert.equal(r._repaintRaf, null);
  } finally { global.requestAnimationFrame = old; }
});

test('actual host publication caller cannot return uploaded or count a failed display', () => {
  const uploads = [];
  const context = { URLSearchParams, console, setTimeout, clearTimeout,
    performance: { now: () => 100 }, requestAnimationFrame() {},
    window: { WinePerf: { enabled: true, frameUpload: (...args) => uploads.push(args) } } };
  const source = fs.readFileSync(path.join(__dirname, '..', 'host.js'), 'utf8');
  vm.runInNewContext(source + '\n;globalThis.WineAssembly = WineAssembly;', context);
  const r = fixture(), ctx = r.presentationFilter.ctx;
  r._isNode = false;
  const host = Object.create(context.WineAssembly.prototype);
  Object.assign(host, { renderer: r, _cancelPresentFrame() {}, _dropRendererFrame() {},
    _presentDxIfDirty: () => 1 });
  for (const failure of ['false', 'throw']) {
    const draw = ctx.drawImage, error = new Error('host display failure');
    if (failure === 'false') r.presentationFilter.ctx = null;
    else ctx.drawImage = () => { throw error; };
    r._repaintScheduled = true;
    assert.throws(() => host._presentNow(), e => failure === 'false'
      ? /PresentationFilter\.present returned false/.test(e.message) : e === error);
    assert.equal(uploads.length, 0);
    clean(r);
    ctx.drawImage = draw;
    r.presentationFilter.ctx = ctx;
  }
  r._repaintScheduled = true;
  assert.equal(host._presentNow(), 1);
  assert.deepEqual(uploads, [[0, 1]]);
  clean(r);
});

test('caret display failure escapes callback without rearming; later request recovers', () => {
  const old = global.setTimeout, timers = [];
  global.setTimeout = fn => { timers.push(fn); return { unref() {} }; };
  try {
    const r = fixture(), ctx = r.presentationFilter.ctx;
    r._caretBlinkActiveStates.add({ phase: false,
      rect: { x: 0, y: 0, w: 1, h: 2, clipX: 0, clipY: 0, clipW: 8, clipH: 8 } });
    r.presentationFilter.ctx = null;
    r._scheduleCaretBlink(true);
    assert.throws(() => timers.shift()(), /PresentationFilter\.present returned false/);
    assert.equal(r._caretBlinkTimer, null);
    assert.equal(timers.length, 0);
    r.presentationFilter.ctx = ctx;
    r._scheduleCaretBlink(true);
    assert.doesNotThrow(() => timers.shift()());
    assert.equal(timers.length, 1);
  } finally { global.setTimeout = old; }
});

test('direct CSS display and headless display need no functioning filter', () => {
  for (const mode of ['nearest', 'browser-hq']) {
    const r = fixture();
    r.presentationScaleMode = mode;
    r.presentationFilter.present = () => { throw Error('direct mode must bypass filter'); };
    assert.doesNotThrow(() => r.repaint());
    assert.equal(r.canvas.style.opacity, '1');
    assert.equal(r.presentationCanvas.style.display, 'none');
    clean(r);
  }
  const r = new Win98Renderer(createCanvas(8, 8));
  assert.doesNotThrow(() => r.repaint());
  clean(r);
});

test('exclusive source cannot bypass filter; Canvas2D recovery selects that source', () => {
  const r = fixture(), source = createCanvas(4, 4), ctx = r.presentationFilter.ctx;
  r.presentationScaleMode = 'nearest';
  r._syncDirectPresentation(true);
  r._exclusivePresentationSource = source;
  r.presentationFilter.ctx = null;
  assert.throws(() => r._presentDisplayCanvas(), /PresentationFilter\.present returned false/);
  r.presentationFilter.ctx = ctx;
  let selected;
  const draw = ctx.drawImage;
  ctx.drawImage = function(s, ...args) { selected = s; return draw.call(this, s, ...args); };
  assert.doesNotThrow(() => r._presentDisplayCanvas());
  assert.equal(selected, source);
  assert.equal(r.canvas.style.opacity, '0');
  assert.equal(r.presentationCanvas.style.display, '');
});

test('Worker hold and nested repaint still defer without attempting display', () => {
  const r = fixture();
  r.presentationFilter.ctx = null;
  r.beginWorkerGuestSlice();
  assert.doesNotThrow(() => r.repaint());
  assert.equal(r._repaintScheduled, true);
  assert.equal(r._workerRepaintDeferred, true);
  r.endWorkerGuestSlice();
  assert.throws(() => r.repaint(), /PresentationFilter\.present returned false/);
  clean(r);
  r._repainting = true;
  assert.doesNotThrow(() => r.repaint());
  assert.equal(r._repaintPending, true);
});

test('successful Canvas2D and GPU dispatch/fallback still complete actual repaint', () => {
  for (const mode of ['integer', 'sharp-hq', 'scale-auto', 'fsr1']) {
    const r = fixture();
    r.presentationScaleMode = mode;
    assert.doesNotThrow(() => r.repaint());
    assert.match(r.presentationFilter.lastBackend, /^canvas-/);
    clean(r);
  }
  for (const mode of ['scale-auto', 'fsr1']) {
    const r = fixture(), f = r.presentationFilter, draws = [];
    r.presentationScaleMode = mode;
    const gpu = { canvas: createCanvas(16, 16) };
    f._ensureGpu = () => gpu;
    f._program = (_gpu, name) => ({ name });
    f._uploadSource = () => ({});
    f._ensureIntermediate = () => ({ texture: {}, framebuffer: {} });
    f._draw = (_gpu, program) => draws.push(program.name);
    assert.doesNotThrow(() => r.repaint());
    assert.match(f.lastBackend, /^webgl-/);
    assert.deepEqual(draws, mode === 'fsr1' ? ['fsrEasu', 'post'] : ['scale2x']);
    clean(r);
  }
});
