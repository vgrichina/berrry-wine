#!/usr/bin/env node
'use strict';

// GL_UNPACK_ALIGNMENT, row length, skips and byte swapping are applied in WAT
// ($gl_2d_upload / $gl_1d_store and, for GLU, $gl_g2_unpack_image in
// src/09a8t-gl-texture.wat), together with pixel transfer and the base
// internal format. The JS executor receives only finished, tightly packed
// RGBA8 rows (GPU stream v2 G2). The original bug this file guarded -- a
// client image sliced as width*height*components and short for any row that
// is not a multiple of the alignment (Anachronox's ref_gl RGB/LUMINANCE 2x2
// mips drew a black page on WebGL) -- cannot recur on the JS side, because JS
// no longer reads client images at all: this checks that contract.

const assert = require('assert');
const { OpenGLHostBridge, CALL_INDEX, constants: GL } = require('../lib/gl-compat');

const memory = new ArrayBuffer(8192);
const view = new DataView(memory);
const stack = 0x100;
const image = 0x400;
new Uint8Array(memory, image, 256).forEach((_, i, a) => { a[i] = i; });

const uploads = [];
const frontend = {
  pixelStore: {},
  _finishedRGBA8: require('../lib/gl-compat').FixedFunctionGL.prototype._finishedRGBA8,
  texImage(level, internal, width, height, border, format, type, pixels) {
    uploads.push({ kind: 'image', width, height, format, type, pixels: this._finishedRGBA8(format, type, pixels, width * height) });
  },
  texSubImage(level, x, y, width, height, format, type, pixels) {
    uploads.push({ kind: 'sub', width, height, format, type, pixels: this._finishedRGBA8(format, type, pixels, width * height) });
  },
  build2DMipmaps(internal, width, height, format, type, pixels) {
    uploads.push({ kind: 'mipmaps', width, height, format, type, pixels: this._finishedRGBA8(format, type, pixels, width * height) });
  },
};
const bridge = new OpenGLHostBridge({
  getMemory: () => memory,
  exports: { guest_to_wasm: pointer => pointer },
});
bridge.current = 1;
bridge.contexts.set(1, { frontend, backend: { present() {} }, layer: { writeSeq: 0 } });

const args = (...words) => words.forEach((w, i) => view.setUint32(stack + 4 + i * 4, w >>> 0, true));

// Canonical _glTexImage2D: exactly width*height*4 bytes, row padding never read.
for (const [w, h] of [[2, 2], [1, 1], [3, 2], [4, 4]]) {
  args(GL.TEXTURE_2D, 0, 3, w, h, 0, GL.RGBA, GL.UNSIGNED_BYTE, image);
  bridge.call(CALL_INDEX._glTexImage2D, stack, 0);
  const u = uploads.pop();
  assert.strictEqual(u.pixels.length, w * h * 4, `${w}x${h}: tight RGBA8`);
  assert.deepStrictEqual(Array.from(u.pixels.subarray(0, 8)), [0, 1, 2, 3, 4, 5, 6, 7].slice(0, Math.min(8, w * h * 4)));
}
args(GL.TEXTURE_2D, 0, 1, 0, 2, 2, GL.RGBA, GL.UNSIGNED_BYTE, image);
bridge.call(CALL_INDEX._glTexSubImage2D, stack, 0);
assert.strictEqual(uploads.pop().pixels.length, 16, 'sub-image is tight RGBA8 too');

// gluBuild2DMipmaps(target, components, w, h, format, type, data): WAT unpacked it.
args(GL.TEXTURE_2D, 3, 3, 2, GL.RGBA, GL.UNSIGNED_BYTE, image);
assert.strictEqual(bridge.call(CALL_INDEX.gluBuild2DMipmaps, stack, 0), 0);
let u = uploads.pop();
assert.strictEqual(u.kind, 'mipmaps');
assert.strictEqual(u.pixels.length, 24, 'GLU source arrives as tight RGBA8');

// The finished bytes are copied: later guest writes do not alias the level.
new Uint8Array(memory, image, 4).fill(99);
assert.deepStrictEqual(Array.from(u.pixels.subarray(0, 4)), [0, 1, 2, 3], 'finished bytes own their storage');

// Fail fast for anything WAT did not convert.
const converted = require('../lib/gl-compat').FixedFunctionGL.prototype._finishedRGBA8;
assert.throws(() => converted.call({}, GL.RGB, GL.UNSIGNED_BYTE, new Uint8Array(12), 4), /must be converted to RGBA8 in WAT/);
assert.throws(() => converted.call({}, GL.RGBA, 0x1406, new Uint8Array(64), 4), /must be converted to RGBA8 in WAT/);
assert.throws(() => converted.call({}, GL.RGBA, GL.UNSIGNED_BYTE, new Uint8Array(7), 2), RangeError, 'short input is not silently padded');
assert.deepStrictEqual(Array.from(converted.call({}, GL.RGBA, GL.UNSIGNED_BYTE, null, 2)), Array(8).fill(0), 'NULL data allocates zeroed storage');
args(GL.TEXTURE_2D, 0, 3, 2, 2, 0, GL.RGB, GL.UNSIGNED_BYTE, image);
assert.throws(() => bridge.call(CALL_INDEX.glTexImage2D, stack, 0), /canonical _glTexImage2D/, 'raw glTexImage2D never reaches JS');
args(GL.TEXTURE_2D, 0, 0, 0, 2, 2, GL.RGB, GL.UNSIGNED_BYTE, image);
assert.throws(() => bridge.call(CALL_INDEX.glTexSubImage2D, stack, 0), /canonical _glTexImage2D/);
console.log('PASS OpenGL texel contract: JS receives only tight finished RGBA8; unpack/transfer/base format are WAT\'s');
