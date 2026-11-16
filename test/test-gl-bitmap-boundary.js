'use strict';
const assert = require('assert');
const { GdiSurface } = require('../lib/gdi-surface');
const { OpenGLHostBridge } = require('../lib/gl-compat');

const glOptions = { preserveAlpha: true, preserveUnusedBits: true };
// Literal storage and pixels, including byte-unaligned views, bottom-up rows,
// clipping, RGB565 (where bit15 belongs to red), and ordinary opaque GDI.
for (const topDown of [false, true]) for (const offset of [0, 1]) {
  for (const format of ['bgra32', 'rgba32', '555', '565']) {
    const bpp = format.endsWith('32') ? 32 : 16, stride = bpp === 32 ? 12 : 8;
    const storage = new Uint8Array(offset + stride * 2 + 3).fill(0x6d);
    const surface = new GdiSurface({ width: 2, height: 2, bpp, stride, topDown,
      storage, storageOffset: offset, format,
      ...(format === '565' ? { masks: [0xf800, 0x7e0, 0x1f] } : {}) });
    const row = y => offset + (topDown ? y : 1 - y) * stride;
    const view = new DataView(storage.buffer);
    const words = bpp === 32 ? [0x3c283848, 0x0096aa55] : [0xa8c7, 0x28c7];
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++)
      view[bpp === 32 ? 'setUint32' : 'setUint16'](row(y) + x * (bpp / 8), words[x], true);
    const before = Array.from(storage);
    const rgba = surface.rgbaRect(0, 0, 2, 2, undefined, glOptions);
    if (bpp === 32) {
      const literal = format === 'bgra32' ? [40, 56, 72, 60, 150, 170, 85, 0] : [72, 56, 40, 60, 85, 170, 150, 0];
      assert.deepStrictEqual(Array.from(rgba), [...literal, ...literal]);
      assert.strictEqual(surface.rgbaRect(0, 0, 2, 2)[3], 255, 'GDI reads stay opaque');
    }
    surface.writeRgbaRect(0, 0, 2, 2, rgba, glOptions);
    assert.deepStrictEqual(Array.from(storage), before, format + ' exact round trip');
    surface.writeRgbaRect(1, 1, 1, 1, new Uint8Array([0, 255, 0, 17]), glOptions);
    const at = row(1) + bpp / 8;
    assert.strictEqual(view[bpp === 32 ? 'getUint32' : 'getUint16'](at, true),
      bpp === 32 ? 0x1100ff00 : format === '555' ? 0x03e0 : 0x07e0);
    // Bit15 must survive only where it is unexposed padding, not in RGB565.
    surface.writeRgbaRect(0, 0, 1, 1, new Uint8Array([0, 0, 0, 17]), glOptions);
    assert.strictEqual(view[bpp === 32 ? 'getUint32' : 'getUint16'](row(0), true),
      bpp === 32 ? 0x11000000 : format === '555' ? 0x8000 : 0);
    surface.writeRgbaRect(0, 0, 1, 1, new Uint8Array([0, 0, 0, 17]));
    assert.strictEqual(view[bpp === 32 ? 'getUint32' : 'getUint16'](row(0), true), bpp === 32 ? 0xff000000 : 0,
      'ordinary GDI stores retain their previous contract');
    for (let y = 0; y < 2; y++) for (let i = 2 * bpp / 8; i < stride; i++)
      assert.strictEqual(storage[row(y) + i], 0x6d, 'row padding');
    assert(storage.slice(offset + stride * 2).every(x => x === 0x6d), 'tail guard');
  }
}

// The attachment, including alpha-zero RGB, is authoritative; an opaque 2D
// presentation cannot be used to reconstruct it. Exercise the real publisher.
const storage = new Uint8Array(16), surface = new GdiSurface({ width: 1, height: 2, bpp: 32, stride: 8, storage });
const bridge = new OpenGLHostBridge({ getGdiSurface: () => ({ surface }) });
const canvas = { width: 1, height: 2, getContext() { throw Error('presentation read forbidden'); } };
const context = { surfaceId: 5, backend: { canvas, readPixels(x, y, w, h, format, type, out) {
  assert.deepStrictEqual([x, y, w, h, format, type], [0, 0, 1, 2, 0x1908, 0x1401]);
  out.set([150, 170, 85, 0, 40, 56, 72, 60]);
} }, layer: { canvas } };
assert.strictEqual(bridge._publishToBitmap(context), 1);
assert.deepStrictEqual(Array.from(storage), [72, 56, 40, 60, 0, 0, 0, 0, 85, 170, 150, 0, 0, 0, 0, 0]);
console.log('PASS GL bitmap literal storage, orientation, alpha, unused bits, RGB565 and opaque GDI controls');
