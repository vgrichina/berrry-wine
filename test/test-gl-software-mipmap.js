#!/usr/bin/env node
'use strict';

// src/09a8g-gl-raster.wat -- mip levels on the software GL path.
//
// glTexImage2D with level > 0 used to return early, so a minified face
// sampled level 0 and a distant surface shimmered where WebGL showed the
// app's own filtered level. Levels 1..12 are now kept per name and one level
// is chosen per face from its texel-to-pixel area ratio, as MIN_FILTER asks.
//
// A 64x64 texture whose levels are solid colours (0 red, 1 green, 2 blue)
// drawn over a 32x32 view: s,t over 0..1 is rho = 2 (level 1), over 0..2 is
// rho = 4 (level 2), over 0..0.5 is magnification (level 0).

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const { CALL_INDEX } = require('../lib/gl-command-stream');

const MODELVIEW = 0x1700, PROJECTION = 0x1701;
const VERT_BYTES = 60, VERT_FLOATS = 15;  // w is the 15th float
const VP = 32;
const GL_TEXTURE_2D = 0x0DE1;
const RED = 0xFFFF0000, GREEN = 0xFF00FF00, BLUE = 0xFF0000FF;

async function main() {
  const { exports: e, memory } = await bootRenderHarness();
  const guestBase = e.get_guest_base() >>> 0, imageBase = e.get_image_base() >>> 0;
  const toWasm = guest => guestBase + (guest >>> 0) - imageBase;
  const verts = toWasm(e.guest_alloc(VERT_BYTES * 3));
  const stack = toWasm(e.guest_alloc(64));

  const glCall = (op, ...args) => {
    const words = new Int32Array(memory.buffer, stack, 16);
    words.fill(0);
    args.forEach((v, i) => { words[1 + i] = v; });
    e.gl_sw_observe(op, stack);
  };

  const words = new Int32Array(memory.buffer, stack, 16);
  words.fill(0);
  words.set([0, 0, 0, VP, VP], 0);
  e.gl_mtx_observe(CALL_INDEX.glViewport, stack);
  e.gl_mtx_set_mode(MODELVIEW);
  e.gl_mtx_load_identity();
  e.gl_mtx_set_mode(PROJECTION);
  e.gl_mtx_load_identity();
  e.gl_mtx_ortho(-1, 1, -1, 1, -1, 1);
  e.gl_sw_set_enabled(1);

  const quad = span => {
    const tri = pts => {
      pts.forEach(([x, y], i) => {
        const f = new Float32Array(memory.buffer, verts + i * VERT_BYTES, VERT_FLOATS);
        f.fill(0);
        f[14] = 1;
        f.set([x, y, 0, 1, 1, 1, 1, (x + 1) / 2 * span, (y + 1) / 2 * span, 0, 0, 1, 0, 0]);
      });
      e.gl_sw_emit_triangles(verts, 3);
    };
    tri([[-1, -1], [1, -1], [1, 1]]);
    tri([[-1, -1], [1, 1], [-1, 1]]);
  };

  const level = (lvl, size, rgb) => {
    const bytes = size * size * 3;
    const texels = e.guest_alloc(bytes) >>> 0;
    const view = new Uint8Array(memory.buffer, toWasm(texels), bytes);
    for (let i = 0; i < size * size; i++) view.set(rgb, i * 3);
    glCall(CALL_INDEX.glTexImage2D, GL_TEXTURE_2D, lvl, 0x1907, size, size, 0, 0x1907, 0x1401, texels);
  };
  const minFilter = f => glCall(CALL_INDEX.glTexParameteri, GL_TEXTURE_2D, 0x2801, f);

  glCall(CALL_INDEX.glBindTexture, GL_TEXTURE_2D, 5);
  glCall(CALL_INDEX.glPixelStorei, 0x0CF5, 1);
  glCall(CALL_INDEX.glTexParameteri, GL_TEXTURE_2D, 0x2800, 0x2600);  // MAG_FILTER NEAREST
  level(0, 64, [255, 0, 0]);
  glCall(CALL_INDEX.glEnable, GL_TEXTURE_2D);

  const pixel = () => {
    const entry = e.gl_sw_entry() >>> 0;
    const u16 = o => new Uint16Array(memory.buffer.slice(entry + o, entry + o + 2))[0];
    const dib = new Int32Array(memory.buffer.slice(entry + 20, entry + 24))[0] >>> 0;
    return new Uint32Array(memory.buffer.slice(dib, dib + u16(18) * u16(14)))[
      (VP / 2) * (u16(18) / 4) + VP / 2] >>> 0;
  };
  const hex = v => `0x${v.toString(16)}`;
  const expect = (span, want, what) => {
    quad(span);
    assert.strictEqual(pixel(), want, `${what}: got ${hex(pixel())}`);
  };

  // Only level 0 uploaded: the default NEAREST_MIPMAP_LINEAR falls back to it.
  expect(1, RED, 'no levels above 0');

  level(1, 32, [0, 255, 0]);
  level(2, 16, [0, 0, 255]);
  expect(0.5, RED, 'magnified face takes level 0');
  expect(1, GREEN, 'rho 2 takes level 1');
  expect(2, BLUE, 'rho 4 takes level 2');

  // A non-mipmap MIN_FILTER samples level 0 however small the face.
  minFilter(0x2601);
  expect(2, RED, 'MIN_FILTER LINEAR ignores the chain');
  minFilter(0x2700);
  expect(2, BLUE, 'NEAREST_MIPMAP_NEAREST uses it again');

  // Re-specifying level 0 keeps the other levels, as GL does.
  level(0, 64, [255, 0, 0]);
  expect(1, GREEN, 'level 0 re-upload keeps level 1');

  // A level with no upload falls back to the deepest one below it.
  glCall(CALL_INDEX.glBindTexture, GL_TEXTURE_2D, 6);
  level(0, 64, [255, 0, 0]);
  level(1, 32, [0, 255, 0]);
  expect(2, GREEN, 'missing level 2 falls back to level 1');

  console.log('PASS software GL mipmaps: per-face level, MIN_FILTER modes, level 0 re-upload, missing-level fallback');
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
