#!/usr/bin/env node
'use strict';

// glTexImage2D / glTexSubImage2D / gluBuild2DMipmaps read the client image the
// way GL does: rows of width*components bytes padded to GL_UNPACK_ALIGNMENT
// (default 4), the last row unpadded. The bridge used to slice
// width*height*components, which is short whenever a row is not a multiple of
// the alignment, and WebGL refused those uploads with "ArrayBufferView not big
// enough for request": Anachronox's ref_gl (RGB and LUMINANCE mip levels down
// to 2x2, alignment left at 4) drew a black page on the WebGL renderer.

const assert = require('assert');
const { OpenGLHostBridge, CALL_INDEX, constants: GL } = require('../lib/gl-compat');

const memory = new ArrayBuffer(8192);
const view = new DataView(memory);
const stack = 0x100;
const image = 0x400;
new Uint8Array(memory, image, 64).forEach((_, i, a) => { a[i] = i; });

const uploads = [];
const frontend = {
  unpackAlignment: 4,
  pixelStore: { 0x0CF5: 4 },
  texImage(level, internal, width, height, border, format, type, pixels) {
    uploads.push({ kind: 'image', width, height, format, alignment: this.unpackAlignment, pixels });
  },
  texSubImage(level, x, y, width, height, format, type, pixels) {
    uploads.push({ kind: 'sub', width, height, format, alignment: this.unpackAlignment, pixels });
  },
  build2DMipmaps(internal, width, height, format, type, pixels) {
    uploads.push({ kind: 'mipmaps', width, height, format, alignment: this.unpackAlignment, pixels });
  },
};
const bridge = new OpenGLHostBridge({
  getMemory: () => memory,
  exports: { guest_to_wasm: pointer => pointer },
});
bridge.current = 1;
bridge.contexts.set(1, { frontend, backend: { present() {} }, layer: { writeSeq: 0 } });

const args = (...words) => words.forEach((w, i) => view.setUint32(stack + 4 + i * 4, w >>> 0, true));
const texImage = (w, h, format) => {
  args(GL.TEXTURE_2D, 0, 3, w, h, 0, format, GL.UNSIGNED_BYTE, image);
  bridge.call(CALL_INDEX.glTexImage2D, stack, 0);
  return uploads.pop();
};
const pixelStore = (value) => { args(0x0CF5, value); bridge.call(CALL_INDEX.glPixelStorei, stack, 0); };

// Default alignment 4.
let u = texImage(2, 2, GL.RGB);
assert.strictEqual(u.pixels.length, 8 + 6, 'RGB 2x2: one padded 8-byte row plus a 6-byte last row');
assert.strictEqual(u.alignment, 4);
assert.strictEqual(u.pixels[8], 8, 'second row starts at the padded stride');
u = texImage(2, 2, GL.LUMINANCE);
assert.strictEqual(u.pixels.length, 4 + 2, 'LUMINANCE 2x2: padded row of 4, last row of 2');
u = texImage(1, 1, GL.RGB);
assert.strictEqual(u.pixels.length, 3, 'a single row is never padded');
u = texImage(4, 4, GL.RGBA);
assert.strictEqual(u.pixels.length, 64, 'RGBA rows are already 4-aligned');
u = texImage(3, 2, GL.RGB);
assert.strictEqual(u.pixels.length, 12 + 9, 'RGB 3-wide rows pad 9 -> 12');

// glPixelStorei(GL_UNPACK_ALIGNMENT, 1) means tight rows.
pixelStore(1);
u = texImage(2, 2, GL.RGB);
assert.strictEqual(u.pixels.length, 12, 'alignment 1: tight 2x2 RGB');
assert.strictEqual(u.alignment, 1);
pixelStore(8);
u = texImage(2, 2, GL.RGB);
assert.strictEqual(u.pixels.length, 8 + 6, 'alignment 8 pads the 6-byte row to 8');
pixelStore(4);

// glTexSubImage2D(target, level, x, y, w, h, format, type, pixels)
args(GL.TEXTURE_2D, 0, 0, 0, 2, 2, GL.LUMINANCE, GL.UNSIGNED_BYTE, image);
bridge.call(CALL_INDEX.glTexSubImage2D, stack, 0);
u = uploads.pop();
assert.strictEqual(u.kind, 'sub');
assert.strictEqual(u.pixels.length, 6, 'sub-image rows follow the same alignment');

// gluBuild2DMipmaps(target, components, w, h, format, type, data)
args(GL.TEXTURE_2D, 3, 2, 2, GL.RGB, GL.UNSIGNED_BYTE, image);
assert.strictEqual(bridge.call(CALL_INDEX.gluBuild2DMipmaps, stack, 0), 0);
u = uploads.pop();
assert.strictEqual(u.kind, 'mipmaps');
assert.strictEqual(u.pixels.length, 14, 'GLU reads its source with the unpack alignment too');

console.log('PASS  OpenGL client images honour GL_UNPACK_ALIGNMENT (1/4/8): TexImage2D, TexSubImage2D, gluBuild2DMipmaps');
