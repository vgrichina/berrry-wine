#!/usr/bin/env node
'use strict';

// src/09a8g-gl-raster.wat -- points and lines on the WAT software GL path.
//
// Before this, $gl_sw_consume returned early on packed modes 0 and 1, so a
// GL_POINTS starfield, a GL_LINES wireframe or a HUD outline simply was not
// there on the software backend. Everything drawn here goes through the real
// packed-draw funnel ($gl_packed_begin/$gl_packed_finish), not a private copy.
//
// The projection is glOrtho(0, 64, 0, 64) over a 64x64 viewport, so a vertex
// at (x, y) is window pixel (x, y), and surface row 64 - y after the y flip.
// What is pinned:
//   - exact pixel counts, because an off-by-one at a line's end is the whole
//     difference between a strip that blends evenly and one with a bright
//     dot at every joint (GL leaves the last pixel of a segment off);
//   - glPointSize/glLineWidth, and that glPopAttrib restores them;
//   - colour interpolation and GL_FLAT's provoking vertex (a line's second);
//   - the near-plane clip, which must shorten a line, not drop or mirror it.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const { CALL_INDEX } = require('../lib/gl-command-stream');

const MODELVIEW = 0x1700, PROJECTION = 0x1701;
const VERT_BYTES = 60, VERT_FLOATS = 15;  // w is the 15th float
const VP = 64;
const GL_POINTS = 0, GL_LINES = 1;

async function main() {
  const { exports: e, memory } = await bootRenderHarness();
  const guestBase = e.get_guest_base() >>> 0, imageBase = e.get_image_base() >>> 0;
  const toWasm = guest => guestBase + (guest >>> 0) - imageBase;
  const verts = toWasm(e.guest_alloc(VERT_BYTES * 8));
  const stack = toWasm(e.guest_alloc(64));

  const putVertex = (i, [x, y, z = 0], [r, g, b, a]) => {
    const f = new Float32Array(memory.buffer, verts + i * VERT_BYTES, VERT_FLOATS);
    f.fill(0);
    f[14] = 1;
    f.set([x, y, z, r, g, b, a]);
  };
  const draw = (mode, pts, colours) => {
    pts.forEach((p, i) => putVertex(i, p, Array.isArray(colours[0]) ? colours[i] : colours));
    e.gl_sw_emit_packed(verts, pts.length, mode);
  };
  // Arguments as the guest's stdcall frame, argument i at 4 + 4*i. Floats
  // are named explicitly: glLineWidth(3.0) must not go out as the integer 3.
  const glCall = (op, ...args) => {
    const words = new Int32Array(memory.buffer, stack, 16);
    const floats = new Float32Array(memory.buffer, stack, 16);
    words.fill(0);
    args.forEach((v, i) => {
      if (typeof v === 'object') floats[1 + i] = v.f; else words[1 + i] = v;
    });
    e.gl_sw_observe(op, stack);
  };
  const f = v => ({ f: v });

  const words = new Int32Array(memory.buffer, stack, 16);
  words.fill(0);
  words.set([0, 0, 0, VP, VP], 0);
  e.gl_mtx_observe(CALL_INDEX.glViewport, stack);
  e.gl_mtx_set_mode(MODELVIEW);
  e.gl_mtx_load_identity();
  e.gl_mtx_set_mode(PROJECTION);
  e.gl_mtx_load_identity();
  e.gl_mtx_ortho(0, VP, 0, VP, -1, 1);
  e.gl_sw_set_enabled(1);

  const WHITE = [1, 1, 1, 1];
  // --- one point, one pixel ------------------------------------------------
  draw(GL_POINTS, [[10, 20]], WHITE);
  assert.strictEqual(e.gl_sw_points(), 1, 'one point rasterized');
  const entry = e.gl_sw_entry() >>> 0;
  assert.notStrictEqual(entry, 0, 'a render target was created');
  const u16 = o => new Uint16Array(memory.buffer.slice(entry + o, entry + o + 2))[0];
  const pitch = u16(18), h = u16(14), w = u16(12);
  const dib = new Int32Array(memory.buffer.slice(entry + 20, entry + 24))[0] >>> 0;
  let px;
  const snap = () => { px = new Uint32Array(memory.buffer.slice(dib, dib + pitch * h)); };
  const at = (x, y) => px[(y * pitch) / 4 + x] >>> 0;
  const litList = () => {
    const out = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (at(x, y) & 0xFFFFFF) out.push([x, y]);
    return out;
  };
  const clear = () => glCall(CALL_INDEX.glClear, 0x4000);
  snap();
  assert.deepStrictEqual(litList(), [[10, VP - 1 - 20]], 'GL 2.1 point pixel index uses height-1-floor(windowY), independently native-verified');

  // --- glPointSize -----------------------------------------------------------
  clear();
  glCall(CALL_INDEX.glPointSize, f(4));
  draw(GL_POINTS, [[30, 30]], WHITE);
  snap();
  let lit = litList();
  assert.strictEqual(lit.length, 16, `a size-4 point covers 16 pixels, got ${lit.length}`);
  const xs = lit.map(p => p[0]), ys = lit.map(p => p[1]);
  assert.strictEqual(Math.max(...xs) - Math.min(...xs), 3, 'the square is four pixels wide');
  assert.strictEqual(Math.max(...ys) - Math.min(...ys), 3, 'and four tall');
  assert.ok(Math.min(...xs) <= 30 && Math.max(...xs) >= 30, 'and sits on the vertex');
  glCall(CALL_INDEX.glPointSize, f(-2));
  clear();
  draw(GL_POINTS, [[30, 30]], WHITE);
  snap();
  assert.strictEqual(litList().length, 16, 'a non-positive glPointSize is ignored, as GL does');
  glCall(CALL_INDEX.glPointSize, f(1));

  // --- horizontal, vertical, diagonal ---------------------------------------
  const linePixels = (a, b) => {
    clear();
    draw(GL_LINES, [a, b], WHITE);
    snap();
    return litList();
  };
  lit = linePixels([5, 10], [25, 10]);
  assert.strictEqual(lit.length, 20, `a 20-pixel horizontal line leaves its last pixel off: ${lit.length}`);
  assert.ok(lit.every(p => p[1] === VP - 10), 'on one row');
  assert.deepStrictEqual([Math.min(...lit.map(p => p[0])), Math.max(...lit.map(p => p[0]))], [5, 24],
    'from the first vertex up to the one before the second');
  lit = linePixels([25, 10], [5, 10]);
  assert.deepStrictEqual([Math.min(...lit.map(p => p[0])), Math.max(...lit.map(p => p[0]))], [6, 25],
    'drawn the other way it is the other end that is left off');
  lit = linePixels([40, 5], [40, 25]);
  assert.strictEqual(lit.length, 20, `vertical: ${lit.length}`);
  assert.ok(lit.every(p => p[0] === 40), 'in one column');
  lit = linePixels([2, 2], [22, 22]);
  assert.strictEqual(lit.length, 20, `diagonal: ${lit.length}`);
  assert.strictEqual(new Set(lit.map(p => p[0])).size, 20, 'one pixel per column');
  assert.strictEqual(new Set(lit.map(p => p[1])).size, 20, 'one pixel per row');
  lit = linePixels([2, 40], [42, 50]);
  assert.strictEqual(lit.length, 40, `shallow slope: one pixel per column, ${lit.length}`);
  assert.strictEqual(new Set(lit.map(p => p[0])).size, 40, 'shallow slope covers every column once');
  assert.strictEqual(new Set(lit.map(p => p[1])).size, 11, 'and steps through eleven rows');
  lit = linePixels([30, 30], [30, 30]);
  assert.strictEqual(lit.length, 0, 'a zero-length line draws nothing');

  // --- glLineWidth, and glPushAttrib(GL_LINE_BIT) ---------------------------
  glCall(CALL_INDEX.glPushAttrib, 0x4);
  glCall(CALL_INDEX.glLineWidth, f(3));
  lit = linePixels([5, 10], [25, 10]);
  assert.strictEqual(lit.length, 60, `width 3 is three rows of 20: ${lit.length}`);
  assert.strictEqual(new Set(lit.map(p => p[1])).size, 3, 'three rows');
  lit = linePixels([40, 5], [40, 25]);
  assert.strictEqual(lit.length, 60, `a width-3 vertical line is three columns: ${lit.length}`);
  glCall(CALL_INDEX.glPopAttrib);
  lit = linePixels([5, 10], [25, 10]);
  assert.strictEqual(lit.length, 20, 'glPopAttrib(GL_LINE_BIT) restored width 1');

  // --- colour: smooth, then GL_FLAT ------------------------------------------
  clear();
  draw(GL_LINES, [[0, 32], [40, 32]], [[1, 0, 0, 1], [0, 0, 1, 1]]);
  snap();
  const row = VP - 32;
  assert.strictEqual(at(0, row) & 0xFFFFFF, 0xFF0000, 'the first pixel is the first vertex\'s colour');
  const end = at(39, row);
  assert.ok(((end >> 16) & 0xFF) < 16 && (end & 0xFF) > 240,
    `the last drawn pixel is nearly the second vertex's: 0x${end.toString(16)}`);
  const mid = at(20, row);
  assert.ok(Math.abs(((mid >> 16) & 0xFF) - 128) < 12 && Math.abs((mid & 0xFF) - 128) < 12,
    `halfway along is half and half: 0x${mid.toString(16)}`);
  // The shade model lives in the encoder, so it goes in through the encoder.
  const shadeModel = mode => {
    words.fill(0); words[1] = mode;
    e.gl_wat_encoder_call(CALL_INDEX.glShadeModel, stack, 0);
  };
  shadeModel(0x1D00);
  clear();
  draw(GL_LINES, [[0, 32], [40, 32]], [[1, 0, 0, 1], [0, 0, 1, 1]]);
  snap();
  assert.strictEqual(at(0, row) & 0xFFFFFF, 0x0000FF, 'GL_FLAT colours a line by its second vertex');
  shadeModel(0x1D01);

  // --- a blended strip gets no bright joints --------------------------------
  // GL_LINE_STRIP reaches this as separate pairs sharing a vertex; drawing
  // each segment's last pixel would add the joint twice under ONE,ONE.
  clear();
  glCall(CALL_INDEX.glEnable, 0x0BE2);
  glCall(CALL_INDEX.glBlendFunc, 1, 1);
  const GREY = [0.25, 0.25, 0.25, 1];
  draw(GL_LINES, [[5, 40], [15, 40], [15, 40], [25, 40]], GREY);
  snap();
  const r40 = VP - 40;
  assert.strictEqual(at(15, r40) & 0xFFFFFF, at(10, r40) & 0xFFFFFF,
    `the joint is drawn once: 0x${at(15, r40).toString(16)} vs 0x${at(10, r40).toString(16)}`);
  glCall(CALL_INDEX.glDisable, 0x0BE2);

  // --- the near plane shortens a line -----------------------------------------
  // glOrtho(-1, 1) puts eye z = +1 on the near plane. From z = 0 to z = 3 the
  // line crosses it a third of the way along, at x = 10 + 40/3.
  const clippedBefore = e.gl_sw_clipped();
  lit = linePixels([10, 50, 0], [50, 50, 3]);
  const maxX = Math.max(...lit.map(p => p[0]));
  assert.ok(lit.length >= 12 && lit.length <= 14 && maxX <= 24,
    `the visible third draws, nothing past the plane: ${lit.length} pixels up to x=${maxX}`);
  assert.strictEqual(e.gl_sw_clipped(), clippedBefore, 'a shortened line is not counted as dropped');
  lit = linePixels([10, 50, 2], [50, 50, 3]);
  assert.strictEqual(lit.length, 0, 'a line wholly behind the near plane draws nothing');
  assert.strictEqual(e.gl_sw_clipped(), clippedBefore + 1, 'and is counted as clipped');
  clear();
  draw(GL_POINTS, [[20, 20, 3]], WHITE);
  snap();
  assert.strictEqual(litList().length, 0, 'a point behind the near plane draws nothing');

  // --- depth test applies to lines ------------------------------------------
  clear();
  glCall(CALL_INDEX.glClear, 0x100);
  glCall(CALL_INDEX.glEnable, 0x0B71);
  draw(GL_LINES, [[0, 20, 0.5], [60, 20, 0.5]], [1, 0, 0, 1]);   // nearer (eye z +0.5)
  draw(GL_LINES, [[0, 20, -0.5], [60, 20, -0.5]], [0, 1, 0, 1]); // farther
  snap();
  assert.strictEqual(at(30, VP - 20) & 0xFFFFFF, 0xFF0000, 'a farther line is hidden by a nearer one');

  // --- glClearDepth sets what a depth clear writes ---------------------------
  // GLclampd is a double: two stack words (UE1 OpenGlDrv calls it).
  const clearDepth = d => {
    new Int32Array(memory.buffer, stack, 16).fill(0);
    new DataView(memory.buffer).setFloat64(stack + 4, d, true);
    e.gl_sw_observe(CALL_INDEX.glClearDepth, stack);
  };
  clear();
  clearDepth(0);
  glCall(CALL_INDEX.glClear, 0x100);
  draw(GL_LINES, [[0, 40, 0.5], [60, 40, 0.5]], [1, 0, 0, 1]);
  snap();
  assert.strictEqual(at(30, VP - 40) & 0xFFFFFF, 0, 'depth cleared to 0 hides everything under GL_LESS');
  clearDepth(1);
  glCall(CALL_INDEX.glClear, 0x100);
  draw(GL_LINES, [[0, 40, 0.5], [60, 40, 0.5]], [1, 0, 0, 1]);
  snap();
  assert.strictEqual(at(30, VP - 40) & 0xFFFFFF, 0xFF0000, 'and depth cleared to 1 shows it again');
  glCall(CALL_INDEX.glDisable, 0x0B71);

  assert.ok(e.gl_sw_lines() > 10, 'lines counted');
  console.log('PASS test-gl-software-lines');
}

main().catch(err => { console.error(err); process.exit(1); });
