#!/usr/bin/env node
'use strict';

// PFD_DRAW_TO_BITMAP: a GL context created on a *memory* DC does not draw into
// any window. Its drawable is the DIB section selected into that DC, and the
// application blits those bits somewhere else with ordinary GDI afterwards.
//
// SimGolf renders its entire course that way. The WGL bridge used to fall back
// to $main_hwnd whenever a DC had no owning window, so the frame was published
// as a window layer while the DIB the game actually blits from stayed black:
// the course was missing and the interface drawn over it was perfect. The WAT
// side now hands the host the selected bitmap's surface id with the high bit
// set, and the bridge publishes into that surface's canonical bits.

const assert = require('assert');
const { createCanvas } = require('../lib/canvas-compat');
const { GdiSurface } = require('../lib/gdi-surface');
const { OpenGLHostBridge } = require('../lib/gl-compat');

const SURFACE_ID = 0x2a;
const storage = new Uint8Array(8 * 8 * 4);
const surface = new GdiSurface({
  width: 8, height: 8, bpp: 32, stride: 32, topDown: true,
  storage, storageOffset: 0, palette: [], format: 'bgra32',
});
const presentations = new Map([[SURFACE_ID, { id: SURFACE_ID, surface }]]);

const bridge = new OpenGLHostBridge({
  getMemory: () => new ArrayBuffer(0),
  exports: () => ({}),
  renderer: () => null,
  getGdiSurface: id => presentations.get(id >>> 0) || null,
});

// The high bit is the tag that tells a bitmap surface id from an HWND, and the
// window path must never see one: it would look up window 0x2a and draw there.
assert.strictEqual(bridge._gdiSurface(0x80000000 | SURFACE_ID).surface, surface,
  'the tag is masked off before the surface id is looked up');
assert.strictEqual(bridge._gdiSurface(0x80000000 | 0x99), null,
  'an unknown surface id resolves to no target rather than to a window');

// The GL front buffer for that context: red everywhere.
const front = createCanvas(8, 8);
const fctx = front.getContext('2d');
fctx.fillStyle = '#ff0000';
fctx.fillRect(0, 0, 8, 8);
const context = { handle: 1, hwnd: 0, win: null, surfaceId: SURFACE_ID,
  layer: { canvas: front, backend: null, writeSeq: 0, kind: 'gpu' } };

assert.strictEqual(bridge._publishToBitmap(context), 1,
  'a present on a bitmap-target context reports that it published');
assert.deepStrictEqual(Array.from(storage.slice(0, 4)), [0, 0, 255, 255],
  'the GL frame lands in the DIB the app will blit from, as BGRA');
const dirty = surface.takeDirtyRect();
assert.deepStrictEqual([dirty.x, dirty.y, dirty.w, dirty.h], [0, 0, 8, 8],
  'the whole drawable is marked dirty so a canonical flush carries it');

// No target left: publishing is refused rather than falling back to a window.
presentations.delete(SURFACE_ID);
assert.strictEqual(bridge._publishToBitmap(context), 0,
  'a bitmap context whose DIB is gone publishes nowhere');


// The drawable is the bitmap, so the bitmap's pixels are the colour buffer the
// guest's next primitive draws on top of. Without that read-back the publish
// below would write a full black frame over everything the application drew on
// the same DIB with GDI. Seeding is deferred to the first primitive after a
// present, and happens once per frame however many batches the frame holds.
presentations.set(SURFACE_ID, { id: SURFACE_ID, surface });
storage.fill(0);
storage[0] = 0x11; storage[1] = 0x22; storage[2] = 0x33; storage[3] = 0xff;
const seeds = [];
const seeded = {
  handle: 2, hwnd: 0, win: null, surfaceId: SURFACE_ID,
  frontend: { drawBuffer: 0x404 }, needsSeed: true,
  layer: { canvas: front, backend: null, writeSeq: 0, kind: 'gpu' },
  backend: {
    canvas: { width: 8, height: 8 },
    seedColorBuffer: (pixels, w, h) => seeds.push({ head: Array.from(pixels.slice(0, 4)), w, h }),
  },
};
bridge._seedFromBitmap(seeded);
bridge._seedFromBitmap(seeded);
assert.strictEqual(seeds.length, 1, 'one seed per frame, not one per batch');
assert.deepStrictEqual(seeds[0], { head: [0x33, 0x22, 0x11, 0xff], w: 8, h: 8 },
  'the seed is the DIB as it stands right now, in RGBA');

seeded.frontend = { flushPendingDraw() {} };
bridge.contexts.set(seeded.handle, seeded);
seeded.backend.present = () => null;
bridge._publishContext(seeded, false);
assert.strictEqual(seeded.needsSeed, true,
  'a present re-arms the read-back: the app draws GDI on the DIB between frames');

console.log('PASS test-opengl-bitmap-target');
