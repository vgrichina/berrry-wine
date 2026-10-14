#!/usr/bin/env node

'use strict';

const assert = require('assert');
const { createHostImports } = require('../lib/host-imports');
const { Win98Renderer } = require('../lib/renderer');
// A small drawable mock keeps this accounting test independent of native
// rendering and PNG dependencies. Production owns every canonical operation.
class TestCanvas {
  constructor(width, height) {
    this.width = width; this.height = height;
    let pixels = new Uint8ClampedArray(width * height * 4);
    this.context = {
      createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: image => { pixels = image.data.slice(); },
      getImageData: () => ({ data: pixels.slice() }),
    };
  }
  getContext() { return this.context; }
}
const createCanvas = (w, h) => new TestCanvas(w, h);

const memory = new ArrayBuffer(128 * 1024 * 1024);
const frames = [];
const oldPerf = globalThis.WinePerf;
const oldCanvas = globalThis.OffscreenCanvas;
globalThis.OffscreenCanvas = TestCanvas;
globalThis.WinePerf = { guestFrame: () => frames.push('frame') };

(async () => { try {
  const { host, gdi } = createHostImports({
    getMemory: () => memory,
    exports: {},
    renderer: null,
  });

  const makeAndFlush = (id, bits) => {
    assert.strictEqual(host.gdi_surface_create(
      id, 4, 4, 32, bits, 16, 1, 0, 0, 0), 1);
    assert.strictEqual(host.gdi_surface_upload(id, 0, 0, 4, 4), 1);
    assert.strictEqual(gdi.flushSurfacePresentation(id), 1);
  };

  makeAndFlush(0x1234, 0x1000);
  assert.strictEqual(frames.length, 1,
    'a GDI-only canonical surface flush is one guest frame');

  makeAndFlush(0x200003, 0x2000);
  assert.strictEqual(frames.length, 1,
    'a DirectDraw render-target/cache flush is not a presentation');

  host.dx_trace(6, 3);
  assert.strictEqual(frames.length, 1,
    'Flip bookkeeping is followed by Present and must not double-count');
  host.dx_trace(5, 3);
  assert.strictEqual(frames.length, 2,
    'the explicit DirectDraw Present is one presentation');

  assert.strictEqual(host.gdi_surface_upload(0x1234, 0, 0, 4, 4), 1);
  assert.strictEqual(gdi.flushSurfacePresentation(0x1234), 1);
  assert.strictEqual(frames.length, 2,
    'surface-cache flushes stay suppressed after DirectDraw presentation starts');

  // Exercise the real GL worker-frame listener and canonical renderer merge.
  // Only the transport and drawable are headless; neither presentation
  // callback nor the canonical write/flush path is replaced with a counter.
  let listener, seq = 0, canonical;
  const kinds = [], startup = [];
  const renderer = {
    windows: { 7: { hwnd: 7 }, 8: { hwnd: 8 } },
    getWindowCanvas: () => ({ canvas: canonical.canvas, ctx: canonical.canvasContext }),
    nextSurfaceWriteSeq: () => ++seq,
    scheduleRepaint() {},
    mergeGpuLayerIntoBackCanvas: Win98Renderer.prototype.mergeGpuLayerIntoBackCanvas,
  };
  const context = {
    getMemory: () => memory, exports: {}, renderer, createCanvas,
    sharedRenderWorkerEnabled: true,
    onGuestFrame: frame => kinds.push(frame.kind),
    startupClockEvent: event => startup.push(event),
    createRenderEndpoint: () => ({
      ready: Promise.resolve(),
      addEventListener: (type, callback) => { listener = callback; },
      request: async () => ({ value: 1, contexts: 1 }),
      terminate: async () => {},
    }),
  };
  const gl = createHostImports(context);
  for (const id of [7, 8]) {
    assert.strictEqual(gl.host.gdi_surface_create(id, 4, 4, 32,
      0x3000 + id * 64, 16, 1, 0, 0, 0), 1);
  }
  canonical = gl.gdi.surfacePresentations.get(7);
  await gl.host.gpu_gl_batch({ memoryOffset: 0, bytes: 0 });
  const present = () => listener({ data: { t: 'frame', frame: {
    hwnd: 7, width: 4, height: 4, pixels: new Uint8Array(64),
  } } });
  const flush = id => assert.strictEqual(gl.gdi.flushSurfacePresentation(id), 1);
  const upload = id => assert.strictEqual(gl.host.gdi_surface_upload(id, 0, 0, 4, 4), 1);
  const before = frames.length;
  for (let i = 0; i < 64; i++) { present(); flush(7); }
  assert.strictEqual(frames.length - before, 64,
    '64 GL presents and their canonical readbacks are 64 guest frames');
  assert.deepStrictEqual(kinds, Array(64).fill('gpu'));
  assert.deepStrictEqual(startup, Array(64).fill('firstPresent:gpu'));
  upload(7); flush(7); flush(7);
  upload(8); flush(8);
  assert.deepStrictEqual(kinds.slice(64), ['gdi', 'gdi'],
    'later GDI on the GL window and another window still counts once');
  upload(7); present(); flush(7);
  present(); upload(7); flush(7);
  assert.deepStrictEqual(kinds.slice(66), ['gpu', 'gdi', 'gpu', 'gdi'],
    'coalescing GL and guest uploads in either order retains GDI work');
  const count = kinds.length;
  assert.strictEqual(gl.host.gdi_surface_upload(7, 0, 0, 0, 4), 1);
  present(); flush(7);
  assert.strictEqual(kinds.length, count + 1, 'empty GDI upload does not label a GPU readback');
  const put = canonical.canvasContext.putImageData;
  canonical.canvasContext.putImageData = () => { throw new Error('temporary canvas failure'); };
  upload(7);
  assert.strictEqual(gl.gdi.flushSurfacePresentation(7), 0);
  assert.strictEqual(kinds.length, count + 1, 'failed cache upload is not a frame');
  canonical.canvasContext.putImageData = put;
  flush(7); flush(7);
  assert.strictEqual(kinds.length, count + 2, 'successful retry retains exactly one pending GDI frame');
  assert.strictEqual(kinds.at(-1), 'gdi');
  assert.deepStrictEqual(startup.slice(64), kinds.slice(64).map(kind => 'firstPresent:' + kind));
  await context.closeGLRender();
  console.log('PASS perf HUD counts GL and DirectDraw presents without canonical-readback duplicates');
} finally {
  globalThis.WinePerf = oldPerf;
  if (oldCanvas === undefined) delete globalThis.OffscreenCanvas;
  else globalThis.OffscreenCanvas = oldCanvas;
} })().catch(error => { console.error(error); process.exitCode = 1; });
