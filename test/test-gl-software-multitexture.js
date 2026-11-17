#!/usr/bin/env node
'use strict';

// src/09a8g-gl-raster.wat -- ARB_multitexture unit 1 on the software GL path.
//
// The frontend advertises ARB_multitexture (Warcraft III's menu text needs
// it), and the WebGL backend combines unit 1 after unit 0 with MODULATE or
// REPLACE. The software path tracked unit 1's binding and otherwise dropped
// it, so a lightmapped surface drew fullbright. Unit 1 now samples at its own
// coordinates (vertex +48, perspective-divided per pixel) and combines after
// unit 0, before fog.
//
// A quad over the whole view: unit 0 is one pink texel, unit 1 is white|blue
// with s running 0..1 left to right, so the left half samples white and the
// right half blue.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const { CALL_INDEX } = require('../lib/gl-command-stream');

const MODELVIEW = 0x1700, PROJECTION = 0x1701;
const VERT_BYTES = 60, VERT_FLOATS = 15;  // w is the 15th float
const VP = 32;
const GL_TEXTURE_2D = 0x0DE1, TEXTURE0 = 0x84C0, TEXTURE1 = 0x84C1;
const PINK = 0xFFFF8080, DARK_BLUE = 0xFF000080, BLUE = 0xFF0000FF;

async function main() {
  let captureDraws = false;
  const queued = [];
  const { exports: e, memory } = await bootRenderHarness({extraWat: `
    (export "border_set_test" (func $gl_sw_border_set))
    (export "border_ptr_test" (func $gl_sw_border_ptr))
    (export "tex_slot_test" (func $gl_sw_tex_slot))
    (func (export "queue_enable_test") (global.set $gl_sw_worker_ok (i32.const 0)))
  `, extraHostOverrides: {gpu_gl_call(op, descriptor) {
    if (op !== 0x20005 || !captureDraws) return 0;
    const d = new Uint32Array(memory.buffer, descriptor, 4);
    queued.push({state: new Uint8Array(memory.buffer.slice(d[0], d[0] + d[1])),
      record: new Uint8Array(memory.buffer.slice(d[2], d[2] + d[3]))});
    return 1;
  }}});
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

  let unit1Coords = null;
  const quad = () => {
    const tri = pts => {
      pts.forEach(([x, y], i) => {
        const f = new Float32Array(memory.buffer, verts + i * VERT_BYTES, VERT_FLOATS);
        f.fill(0);
        f[14] = 1;
        // position, white colour, unit 0 st, normal, unit 1 st
        f.set([x, y, 0, 1, 1, 1, 1, 0.5, 0.5, 0, 0, 1, (x + 1) / 2, 0.5]);
        if (unit1Coords) f.set(unit1Coords, 12);
      });
      e.gl_sw_emit_triangles(verts, 3);
    };
    tri([[-1, -1], [1, -1], [1, 1]]);
    tri([[-1, -1], [1, 1], [-1, 1]]);
  };

  const texture = (name, rgb, width) => {
    const texels = e.guest_alloc(16) >>> 0;
    new Uint8Array(memory.buffer, toWasm(texels), rgb.length).set(rgb);
    glCall(CALL_INDEX.glBindTexture, GL_TEXTURE_2D, name);
    glCall(CALL_INDEX.glPixelStorei, 0x0CF5, 1);
    glCall(CALL_INDEX.glTexImage2D, GL_TEXTURE_2D, 0, 0x1907, width, 1, 0, 0x1907, 0x1401, texels);
    glCall(CALL_INDEX.glTexParameteri, GL_TEXTURE_2D, 0x2800, 0x2600);  // MAG_FILTER NEAREST
    glCall(CALL_INDEX.glTexParameteri, GL_TEXTURE_2D, 0x2801, 0x2600);  // MIN_FILTER NEAREST
  };

  // Unit 0: pink, MODULATE (the default) by white vertices.
  texture(3, [255, 128, 128], 1);
  glCall(CALL_INDEX.glEnable, GL_TEXTURE_2D);
  // Unit 1: white | blue, left disabled for now.
  glCall(CALL_INDEX.glActiveTextureARB, TEXTURE1);
  texture(4, [255, 255, 255, 0, 0, 255], 2);
  glCall(CALL_INDEX.glActiveTextureARB, TEXTURE0);

  const pixel = x => {
    const entry = e.gl_sw_entry() >>> 0;
    const u16 = o => new Uint16Array(memory.buffer.slice(entry + o, entry + o + 2))[0];
    const dib = new Int32Array(memory.buffer.slice(entry + 20, entry + 24))[0] >>> 0;
    return new Uint32Array(memory.buffer.slice(dib, dib + u16(18) * u16(14)))[
      (VP / 2) * (u16(18) / 4) + x] >>> 0;
  };
  const hex = v => `0x${v.toString(16)}`;
  const LEFT = VP / 4, RIGHT = (3 * VP) / 4;
  const expect = (left, right, what) => {
    quad();
    assert.strictEqual(pixel(LEFT), left, `${what}: left half ${hex(pixel(LEFT))}`);
    assert.strictEqual(pixel(RIGHT), right, `${what}: right half ${hex(pixel(RIGHT))}`);
  };

  expect(PINK, PINK, 'unit 1 disabled');

  glCall(CALL_INDEX.glActiveTextureARB, TEXTURE1);
  glCall(CALL_INDEX.glEnable, GL_TEXTURE_2D);
  glCall(CALL_INDEX.glActiveTextureARB, TEXTURE0);
  expect(PINK, DARK_BLUE, 'unit 1 MODULATE (white keeps unit 0, blue darkens it)');

  // REPLACE on unit 1 takes its texel whole. Unit 0's env must not change.
  glCall(CALL_INDEX.glActiveTextureARB, TEXTURE1);
  glCall(CALL_INDEX.glTexEnvi, 0x2300, 0x2200, 0x1E01);
  glCall(CALL_INDEX.glActiveTextureARB, TEXTURE0);
  expect(0xFFFFFFFF, BLUE, 'unit 1 REPLACE');

  // glPushAttrib(GL_ENABLE_BIT) saves unit 1's enable; the pop restores it.
  glCall(CALL_INDEX.glPushAttrib, 0x2000);
  glCall(CALL_INDEX.glActiveTextureARB, TEXTURE1);
  glCall(CALL_INDEX.glDisable, GL_TEXTURE_2D);
  glCall(CALL_INDEX.glActiveTextureARB, TEXTURE0);
  expect(PINK, PINK, 'unit 1 disabled inside the push');
  glCall(CALL_INDEX.glPopAttrib);
  expect(0xFFFFFFFF, BLUE, 'glPopAttrib restores unit 1');

  // Disabling unit 1 does not disable unit 0.
  glCall(CALL_INDEX.glActiveTextureARB, TEXTURE1);
  glCall(CALL_INDEX.glDisable, GL_TEXTURE_2D);
  glCall(CALL_INDEX.glActiveTextureARB, TEXTURE0);
  expect(PINK, PINK, 'unit 1 off again, unit 0 still textured');

  // Alpha test sees the fragment after unit 1. Unit 1 is RGBA: opaque white
  // on the left, alpha 0 on the right; MODULATE carries that alpha through.
  // Unit 0 alone is opaque, so testing its output would pass everywhere and
  // paint the right half dark blue.
  const rgba = e.guest_alloc(16) >>> 0;
  new Uint8Array(memory.buffer, toWasm(rgba), 8).set([255, 255, 255, 255, 0, 0, 255, 0]);
  glCall(CALL_INDEX.glActiveTextureARB, TEXTURE1);
  glCall(CALL_INDEX.glBindTexture, GL_TEXTURE_2D, 5);
  glCall(CALL_INDEX.glTexImage2D, GL_TEXTURE_2D, 0, 0x1908, 2, 1, 0, 0x1908, 0x1401, rgba);
  glCall(CALL_INDEX.glTexParameteri, GL_TEXTURE_2D, 0x2800, 0x2600);
  glCall(CALL_INDEX.glTexParameteri, GL_TEXTURE_2D, 0x2801, 0x2600);
  glCall(CALL_INDEX.glTexEnvi, 0x2300, 0x2200, 0x2100);            // MODULATE
  glCall(CALL_INDEX.glEnable, GL_TEXTURE_2D);
  glCall(CALL_INDEX.glActiveTextureARB, TEXTURE0);
  const half = new Int32Array(new Float32Array([0.5]).buffer)[0];
  glCall(CALL_INDEX.glAlphaFunc, 0x0204, half);                     // GREATER 0.5
  glCall(CALL_INDEX.glEnable, 0x0BC0);                              // ALPHA_TEST
  expect(PINK, PINK, 'alpha test after unit 1 rejects the transparent half');
  glCall(CALL_INDEX.glDisable, 0x0BC0);
  expect(PINK, DARK_BLUE & 0x00FFFFFF, 'alpha test off: the right half draws with alpha 0');

  // Unit 1 must preserve GL_CLAMP's border taps, independently of unit 0.
  // RGBA's default border is transparent black, so both color and alpha
  // must halve at an edge and quarter at a corner under linear filtering.
  glCall(CALL_INDEX.glActiveTextureARB, TEXTURE1);
  glCall(CALL_INDEX.glTexEnvi, 0x2300, 0x2200, 0x1E01); // REPLACE
  glCall(CALL_INDEX.glTexParameteri, GL_TEXTURE_2D, 0x2800, 0x2601);
  glCall(CALL_INDEX.glTexParameteri, GL_TEXTURE_2D, 0x2801, 0x2601);
  glCall(CALL_INDEX.glTexParameteri, GL_TEXTURE_2D, 0x2802, 0x2900);
  glCall(CALL_INDEX.glTexParameteri, GL_TEXTURE_2D, 0x2803, 0x2900);
  glCall(CALL_INDEX.glActiveTextureARB, TEXTURE0);
  for (const [coords, lo, hi, label] of [
    [[0, 0.5], 127, 128, 'edge'], [[0, 0], 63, 64, 'corner'],
  ]) {
    unit1Coords = coords;
    quad();
    for (const x of [LEFT, RIGHT]) {
      const value = pixel(x);
      for (const shift of [0, 8, 16, 24]) {
        const channel = (value >>> shift) & 255;
        assert(channel >= lo && channel <= hi,
          `unit 1 GL_CLAMP ${label}, channel ${shift}: ${hex(value)}`);
      }
    }
  }
  // Switching to CLAMP_TO_EDGE must clear the border mode on both axes.
  glCall(CALL_INDEX.glActiveTextureARB, TEXTURE1);
  glCall(CALL_INDEX.glTexParameteri, GL_TEXTURE_2D, 0x2802, 0x812F);
  glCall(CALL_INDEX.glTexParameteri, GL_TEXTURE_2D, 0x2803, 0x812F);
  glCall(CALL_INDEX.glActiveTextureARB, TEXTURE0);
  expect(0xFFFFFFFF, 0xFFFFFFFF, 'unit 1 CLAMP_TO_EDGE restores full white');

  const borderValues = toWasm(e.guest_alloc(16));
  const setBorder = (name, values) => {
    new Float32Array(memory.buffer, borderValues, 4).set(values);
    assert.strictEqual(e.border_set_test(e.tex_slot_test(name), borderValues), 1);
  };
  setBorder(5, [-1, 0.25, 2, 0.5]);
  assert.deepStrictEqual(Array.from(new Float32Array(memory.buffer,
    e.border_ptr_test(e.tex_slot_test(5)), 4)), [0, 0.25, 1, 0.5],
  'border queries retain clamped floats without 8-bit quantization');
  setBorder(5, [0, 1, 0, 0]);
  // The production vector observer must gather the caller's RGBA as well.
  new Float32Array(memory.buffer,borderValues,4).set([0,1,0,0]);
  glCall(CALL_INDEX.glActiveTextureARB,TEXTURE1);
  glCall(CALL_INDEX.glTexParameterfv,GL_TEXTURE_2D,0x1004,
    borderValues-guestBase+imageBase);
  new Float32Array(memory.buffer,borderValues,4).fill(1);
  glCall(CALL_INDEX.glActiveTextureARB,TEXTURE0);
  setBorder(3, [1, 0, 0, 1]); // independent unit 0 object must not leak into unit 1
  glCall(CALL_INDEX.glActiveTextureARB, TEXTURE1);
  glCall(CALL_INDEX.glTexParameteri, GL_TEXTURE_2D, 0x2802, 0x2900);
  glCall(CALL_INDEX.glTexParameteri, GL_TEXTURE_2D, 0x2803, 0x2900);
  glCall(CALL_INDEX.glActiveTextureARB, TEXTURE0);
  unit1Coords = [0, 0.5];
  expect(0x7F7FFF7F, 0x7F7FFF7F, 'per-texture green border blends with white RGBA');
  glCall(CALL_INDEX.glActiveTextureARB, TEXTURE1);
  glCall(CALL_INDEX.glTexParameteri, GL_TEXTURE_2D, 0x2800, 0x2703); // invalid MAG
  glCall(CALL_INDEX.glTexParameteri, GL_TEXTURE_2D, 0x2801, 123); // invalid MIN
  glCall(CALL_INDEX.glTexParameteri, GL_TEXTURE_2D, 0x2802, 123); // invalid wrap
  glCall(CALL_INDEX.glActiveTextureARB, TEXTURE0);
  expect(0x7F7FFF7F, 0x7F7FFF7F, 'invalid sampler values preserve software draw state');
  // Delete/reuse must restore the default color, even when storage was allocated.
  const deleted = e.guest_alloc(4) >>> 0;
  new Uint32Array(memory.buffer, toWasm(deleted), 1)[0] = 5;
  glCall(CALL_INDEX.glDeleteTextures, 1, deleted);
  assert.deepStrictEqual(Array.from(new Float32Array(memory.buffer,
    e.border_ptr_test(e.tex_slot_test(5)), 4)), [0, 0, 0, 0]);

  // Queue real packed draws, change the same texture's border, then replay
  // through the native Worker entry point. No concurrent Worker is required
  // to reproduce the stale-state bug: the delay is deliberate and deterministic.
  glCall(CALL_INDEX.glActiveTextureARB, TEXTURE1);
  glCall(CALL_INDEX.glBindTexture, GL_TEXTURE_2D, 5);
  glCall(CALL_INDEX.glTexImage2D, GL_TEXTURE_2D, 0, 0x1908, 2, 1, 0, 0x1908, 0x1401, rgba);
  glCall(CALL_INDEX.glTexParameteri, GL_TEXTURE_2D, 0x2800, 0x2601);
  glCall(CALL_INDEX.glTexParameteri, GL_TEXTURE_2D, 0x2801, 0x2601);
  glCall(CALL_INDEX.glTexParameteri, GL_TEXTURE_2D, 0x2802, 0x2900);
  glCall(CALL_INDEX.glTexParameteri, GL_TEXTURE_2D, 0x2803, 0x2900);
  glCall(CALL_INDEX.glActiveTextureARB, TEXTURE0);
  e.queue_enable_test();
  captureDraws = true;
  setBorder(5, [1, 0, 0, 0]);
  quad();
  setBorder(5, [0, 0, 1, 0]);
  quad();
  setBorder(5, [0, 1, 0, 1]); // a third value must not affect either queued draw
  captureDraws = false;
  assert.strictEqual(queued.length, 4, 'two triangles per queued quad');
  const replayState = toWasm(e.guest_alloc(queued[0].state.length));
  const replayRecord = toWasm(e.guest_alloc(queued[0].record.length));
  for (let i = 0; i < queued.length; i++) {
    new Uint8Array(memory.buffer, replayState, queued[i].state.length).set(queued[i].state);
    new Uint8Array(memory.buffer, replayRecord, queued[i].record.length).set(queued[i].record);
    assert.strictEqual(e.gl_sw_worker_draw(replayState, replayRecord), 1);
    if (i % 2 === 1) {
      const expected = i === 1 ? 0x7FFF7F7F : 0x7F7F7FFF;
      assert.strictEqual(pixel(LEFT), expected, 'queued border color survives subsequent setters');
      assert.strictEqual(pixel(RIGHT), expected, 'both triangles use their captured border');
    }
  }

  console.log('PASS software GL texture unit 1: MODULATE, REPLACE, push/pop, independent of unit 0, alpha test after unit 1');
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
