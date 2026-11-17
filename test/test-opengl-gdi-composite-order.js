#!/usr/bin/env node
'use strict';

// A single-buffered OpenGL context shares the window's device context: the GL
// front buffer and the GDI the app draws afterwards compose in *time* order.
// Publishing the GL canvas as a separate layer the compositor always paints
// last buried SimGolf's whole interface — club header, money strip, control
// pod, dialogs, tutorial text — under the terrain.
//
// DirectDraw/Direct3D is the opposite case and must keep the layer on top: a
// present is a whole-surface flip, so whatever GDI wrote is gone there too.

const assert = require('assert');
const { createCanvas } = require('../lib/canvas-compat');
const { Win98Renderer } = require('../lib/renderer');

const hwnd = 0x10010;
const screen = createCanvas(16, 16);
const renderer = new Win98Renderer(screen);
const wasm = { exports: {
  get_dx_exclusive_hwnd: () => 0,
  gl_window_set_gpu_owned: () => 1,
  wnd_window_screen_x: () => 0,
  wnd_window_screen_y: () => 0,
} };
const win = renderer.windows[hwnd] = {
  hwnd, x: 0, y: 0, w: 16, h: 16, visible: true, isChild: false, zOrder: 1, wasm,
};

const fill = (canvas, color, x, y, w, h) => {
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};

// The GL front buffer: red terrain over the whole client area.
const front = createCanvas(16, 16);
fill(front, '#ff0000', 0, 0, 16, 16);
const layer = { canvas: front, backend: null, writeSeq: 0, kind: 'gpu' };
win._gpuFrameLayer = layer;
win._dxFrameLayer = layer;

// glFlush: the frame is published into the window's own surface.
assert.strictEqual(renderer.mergeGpuLayerIntoBackCanvas(hwnd), true,
  'a flushed GL front buffer publishes into the window surface');
const back = renderer.getWindowCanvas(hwnd).canvas;
const backPixel = (x, y) =>
  Array.from(back.getContext('2d').getImageData(x, y, 1, 1).data);
assert.deepStrictEqual(backPixel(1, 1), [255, 0, 0, 255],
  'the GL frame lands in the window back canvas, not only in its own layer');
assert.strictEqual(renderer._overlayFrameLayer(win), null,
  'a merged GL layer must not be composited over the surface a second time');

// The guest now draws its interface with GDI, after the flush.
fill(back, '#00ff00', 2, 2, 4, 4);

renderer.repaint();
const pixel = (x, y) =>
  Array.from(screen.getContext('2d').getImageData(x, y, 1, 1).data);
assert.deepStrictEqual(pixel(3, 3), [0, 255, 0, 255],
  'GDI drawn after glFlush composites over the GL frame');
assert.deepStrictEqual(pixel(9, 9), [255, 0, 0, 255],
  'the GL frame still covers the client area the interface does not');

// A DirectDraw present keeps its layer on top: it is a full-surface flip.
const dxFront = createCanvas(16, 16);
fill(dxFront, '#0000ff', 0, 0, 16, 16);
const dxLayer = { canvas: dxFront, backend: null, writeSeq: 1 };
win._gpuFrameLayer = null;
win._dxFrameLayer = dxLayer;
assert.strictEqual(renderer._overlayFrameLayer(win), dxLayer,
  'a DirectDraw layer is always composited over the window surface');
renderer.repaint();
assert.deepStrictEqual(pixel(3, 3), [0, 0, 255, 255],
  'a DirectDraw present covers GDI that predates it');

// A GL layer that has not been merged yet — a context created but never
// flushed — must still composite, or the first frame would never appear.
const pending = { canvas: front, backend: null, writeSeq: 0, kind: 'gpu' };
win._gpuFrameLayer = pending;
win._dxFrameLayer = pending;
assert.strictEqual(renderer._overlayFrameLayer(win), pending,
  'an unmerged GL layer still composites over the window surface');

console.log('PASS test-opengl-gdi-composite-order');

// The back canvas is only a derived cache of WAT-owned canonical bits, and
// every canonical flush re-uploads those bits over it. A GL frame drawn onto
// the canvas therefore survived only until the guest's next GDI paint — the
// course went black again while the layer still held the picture. The merge
// must land in the canonical storage.
const { GdiSurface } = require('../lib/gdi-surface');
const canonicalBack = createCanvas(16, 16);
const storage = new Uint8Array(16 * 16 * 4);
const surface = new GdiSurface({
  width: 16, height: 16, bpp: 32, stride: 64, topDown: true,
  storage, storageOffset: 0, palette: [], format: 'bgra32',
});
canonicalBack._waCanonicalPresentation = { surface, canvas: canonicalBack };
canonicalBack._waFlushCanonicalSurface = () => {
  const dirty = surface.takeDirtyRect();
  if (!dirty) return 1;
  const ctx = canonicalBack.getContext('2d');
  const image = ctx.createImageData(dirty.w, dirty.h);
  image.data.set(surface.rgbaRect(dirty.x, dirty.y, dirty.w, dirty.h));
  ctx.putImageData(image, dirty.x, dirty.y);
  return 1;
};
win._backCanvas = canonicalBack;
win._backCtx = canonicalBack.getContext('2d');
win._backW = 16;
win._backH = 16;
win._gpuFrameLayer = { canvas: front, backend: null, writeSeq: 2, kind: 'gpu' };
win._dxFrameLayer = win._gpuFrameLayer;
assert.strictEqual(renderer.mergeGpuLayerIntoBackCanvas(hwnd), true,
  'the merge succeeds on a canonically backed window surface');
assert.deepStrictEqual(Array.from(storage.slice(0, 4)), [0, 0, 255, 255],
  'the GL frame is written into the canonical bits as BGRA, not only the cache');
canonicalBack._waFlushCanonicalSurface(true);
assert.deepStrictEqual(
  Array.from(canonicalBack.getContext('2d').getImageData(9, 9, 1, 1).data),
  [255, 0, 0, 255],
  'a canonical flush after the merge reproduces the GL frame instead of erasing it');

console.log('PASS test-opengl-gdi-composite-order canonical surface');

// A pure GL frame stays GPU-owned until the pre-GDI barrier. Repainting must
// show it without touching CPU pixels; a later GDI write must retain the rest.
const ctxFront = front.getContext('2d');
const originalRead = ctxFront.getImageData.bind(ctxFront);
let reads = 0;
ctxFront.getImageData = (...args) => { reads++; return originalRead(...args); };
fill(front, '#0000ff', 0, 0, 16, 16);
assert(renderer.deferGpuWindowReadback(hwnd));
renderer.repaint();
assert.strictEqual(reads, 0, 'present/repaint do not read the GPU front into CPU storage');
assert.deepStrictEqual(pixel(9, 9), [0, 0, 255, 255], 'GPU-owned front is visible');
assert.deepStrictEqual(Array.from(storage.slice(0, 4)), [0, 0, 255, 255],
  'canonical storage still holds the previous red frame');
assert(renderer.resolveGpuWindowReadback(hwnd));
assert.strictEqual(reads, 1, 'first guest pixel access materializes exactly once');
assert(renderer.resolveGpuWindowReadback(hwnd));
assert.strictEqual(reads, 1, 'repeated GDI access does not repeat the readback');
surface.writeRgbaRect(2, 2, 1, 1, new Uint8ClampedArray([0, 255, 0, 255]));
renderer.repaint();
assert.deepStrictEqual(pixel(2, 2), [0, 255, 0, 255], 'new GDI pixels cover the GL frame');
assert.deepStrictEqual(pixel(9, 9), [0, 0, 255, 255], 'untouched GL pixels survive GDI');
fill(front, '#ff0000', 0, 0, 16, 16);
assert(renderer.deferGpuWindowReadback(hwnd));
renderer.repaint();
assert.strictEqual(reads, 1, 'next GL frame reclaims ownership without readback');
assert.deepStrictEqual(pixel(2, 2), [255, 0, 0, 255], 'new GL frame replaces old GDI');
const merge = renderer.mergeGpuLayerIntoBackCanvas;
renderer.mergeGpuLayerIntoBackCanvas = () => false;
assert.strictEqual(renderer.resolveGpuWindowReadback(hwnd), false);
assert(win._gpuFrameLayer.pendingWindowReadback, 'failed synchronization retains pending ownership');
renderer.mergeGpuLayerIntoBackCanvas = merge;
assert(renderer.resolveGpuWindowReadback(hwnd));
win.isChild = true;
assert.strictEqual(renderer.deferGpuWindowReadback(hwnd), false,
  'shared parent storage keeps child GL windows on the eager path');
win.isChild = false;
ctxFront.getImageData = originalRead;
console.log('PASS deferred GL ownership, GDI barrier, ordering and retry');

