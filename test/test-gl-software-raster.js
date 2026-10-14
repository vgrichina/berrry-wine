#!/usr/bin/env node
'use strict';

// src/09a8g-gl-raster.wat -- the first thing that RASTERIZES a GL draw in WAT
// with no JS in the path. It transforms the 60-byte GL vertices of a packed
// draw record, projects them, and hands the triangle to the D3DIM rasterizer
// writing into a DxObject surface.
//
// WHAT THIS TEST IS FOR. Everything that can go wrong in this lowering
// produces a picture, not a crash, and most of the pictures are plausible:
//
//   - THE Y FLIP. GL's window origin is bottom-left; a DIB surface's is
//     top-left. Get it wrong and every scene still renders, upside down, and
//     a symmetric test model cannot tell. So the triangle below sits in ONE
//     CORNER of clip space and the assertion is about which corner of the
//     surface it lands in.
//   - THE MATRIX ORDER. mvp = projection * modelview, and the reverse is a
//     product that still projects geometry -- just the wrong geometry. The
//     modelview here carries a translation, which is what makes the two
//     orders differ; an identity modelview would pass either way and so
//     would be worse than no test at all.
//   - READING THE SELECTED STACK. The lowering wants the modelview and the
//     projection BY NAME. A build that reads "the current matrix" is correct
//     only while an app leaves GL_MODELVIEW selected, so this runs with
//     PROJECTION left selected, exactly as test-gl-dfx1-transform.js does.
//   - INHERITING D3D'S CULL DEFAULT. GL_CULL_FACE is off by default in GL;
//     D3D's default is D3DCULL_CCW, which 8b227b5c made this emulator honour.
//     A lowering that routed through $d3dim_draw_tl_triangle would silently
//     discard half of every model, so both windings are drawn below.
//   - PROJECTING THROUGH A NEGATIVE W. Dividing by a negative w mirrors
//     geometry about the origin and draws a convincing wrong picture. A
//     triangle wholly behind the near plane must be DROPPED and counted; one
//     straddling it must be CLIPPED and its visible part drawn.
//
// Pixel colour is deliberately asserted only as zero / non-zero plus one
// equality against what the surface actually holds: the point of the test is
// the geometry, and the 32bpp store belongs to $viewport_fill_rect.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const { CALL_INDEX } = require('../lib/gl-compat.js');

const MODELVIEW = 0x1700, PROJECTION = 0x1701;
const VERT_BYTES = 60, VERT_FLOATS = 15;  // w is the 15th float
const VP = 64; // viewport is VP x VP, so a surface of the same size

async function main() {
  const { exports: e, memory } = await bootRenderHarness({
    extraWat: '(export "border_sample_test" (func $gl_sw_border_sample))',
  });
  const guestBase = e.get_guest_base() >>> 0, imageBase = e.get_image_base() >>> 0;
  const toWasm = guest => guestBase + (guest >>> 0) - imageBase;

  // Border taps are explicit per-draw data, not a mutable global. These
  // assertions exercise the real Wasm sampler before GL state wiring uses it.
  const borderPixels = toWasm(e.guest_alloc(8));
  new Uint32Array(memory.buffer, borderPixels, 2).set([0xff0000ff, 0xffffff00]);
  const borderSample = (u, v, ws, wt, linear, border = 0xff000000, ptr = borderPixels) =>
    e.border_sample_test(2, 1, 32, 8, ptr, 0, 0, 0, u, v, ws, wt, linear, border) >>> 0;
  const CLAMP = 0x2900, EDGE = 0x812f, BORDER = 0x812d, REPEAT = 0x2901;
  assert.strictEqual(borderSample(0, 0.5, EDGE, EDGE, 1), 0xff0000ff);
  assert.strictEqual(borderSample(0.25, 0.5, CLAMP, CLAMP, 1), 0xff0000ff);
  assert.strictEqual(borderSample(0, 0.5, CLAMP, CLAMP, 1), 0xff00007f,
    'linear GL_CLAMP edge has one half border');
  assert.strictEqual(borderSample(0, 0, CLAMP, CLAMP, 1), 0xff00003f,
    'linear GL_CLAMP corner has three quarters border');
  assert.strictEqual(borderSample(-20, 0.5, CLAMP, EDGE, 1), 0xff00007f,
    'GL_CLAMP clamps coordinates before filtering');
  assert.strictEqual(borderSample(-20, 0.5, BORDER, EDGE, 1, 0xff00ff00), 0xff00ff00);
  assert.strictEqual(borderSample(0, 0.5, CLAMP, EDGE, 1, 0xff00ff00), 0xff007f7f,
    'the same image uses the supplied color independently for each draw');
  assert.strictEqual(borderSample(0, 0.5, CLAMP, EDGE, 1), 0xff00007f);
  assert.strictEqual(borderSample(1, 0.5, CLAMP, EDGE, 0), 0xffffff00);
  assert.strictEqual(borderSample(-1, 0.5, BORDER, EDGE, 0, 0x12345678,
    memory.buffer.byteLength - 1), 0x12345678,
    'an outside border tap returns without dereferencing invalid image backing');
  assert.strictEqual(borderSample(0.25, 1.5, CLAMP, REPEAT, 1), 0xff0000ff,
    'the other axis retains its own wrap mode');

  // --- somewhere to put three GL vertices -------------------------------
  const verts = toWasm(e.guest_alloc(VERT_BYTES * 3));
  const stack = toWasm(e.guest_alloc(64));

  // One 15-float GL vertex: x,y,z, r,g,b,a, s0,t0, nx,ny,nz, s1,t1, w
  // (src/09a8c-gl-encoder.wat:134, mirrored as VERTEX_FLOATS in
  // lib/gl-command-stream.js).
  const putVertex = (i, x, y, z, r, g, b, a, s = 0, t = 0) => {
    const f = new Float32Array(memory.buffer, verts + i * VERT_BYTES, VERT_FLOATS);
    f.fill(0);
    f[14] = 1;
    f[0] = x; f[1] = y; f[2] = z;
    f[3] = r; f[4] = g; f[5] = b; f[6] = a;
    f[7] = s; f[8] = t;
  };
  const triangle = (pts, colour) => {
    pts.forEach(([x, y, z, s, t], i) => putVertex(i, x, y, z, ...colour, s, t));
    e.gl_sw_emit_triangles(verts, 3);
  };

  // One GL call through the state observer the encoder calls, arguments laid
  // out as the guest's stdcall frame: argument i at 4 + 4*i. A number that is
  // not an integer is written as a GLfloat.
  const glCall = (op, ...args) => {
    const words = new Int32Array(memory.buffer, stack, 16);
    const floats = new Float32Array(memory.buffer, stack, 16);
    words.fill(0);
    args.forEach((v, i) => {
      if (Number.isInteger(v)) words[1 + i] = v; else floats[1 + i] = v;
    });
    e.gl_sw_observe(op, stack);
  };

  // --- glViewport, through the observer the encoder really uses ---------
  const setViewport = (x, y, w, h) => {
    const words = new Int32Array(memory.buffer, stack, 16);
    words.fill(0);
    words.set([0, x, y, w, h], 0); // argument i lives at offset 4 + i*4
    e.gl_mtx_observe(CALL_INDEX.glViewport, stack);
  };
  setViewport(0, 0, VP, VP);

  // --- a GL state whose matrix order matters ----------------------------
  // The modelview translates +0.5 in x. Swap the product order and that
  // translation is applied in the wrong space, which moves the triangle.
  e.gl_mtx_set_mode(MODELVIEW);
  e.gl_mtx_load_identity();
  e.gl_mtx_translate(0.5, 0, 0);
  e.gl_mtx_set_mode(PROJECTION);
  e.gl_mtx_load_identity();
  e.gl_mtx_ortho(-1, 1, -1, 1, -1, 1);
  assert.strictEqual(e.gl_mtx_selected(), 1,
    'the test means to draw while PROJECTION is the selected stack');
  assert.strictEqual(e.gl_mtx_untrusted(), 0, 'mirror is trusted before the draw');

  // --- disabled is inert -------------------------------------------------
  assert.strictEqual(e.gl_sw_enabled(), 0, 'the path is off unless a host asks');
  triangle([[-0.4, 0.1, 0], [0.4, 0.1, 0], [0.4, 0.9, 0]], [1, 0, 0, 1]);
  assert.strictEqual(e.gl_sw_triangles(), 0, 'a disabled path rasterizes nothing');
  assert.strictEqual(e.gl_sw_entry(), 0, 'and allocates no surface');

  // --- one triangle in the TOP-RIGHT of clip space ----------------------
  // After the modelview's +0.5 the x range is 0.1..0.9 and y is 0.1..0.9, so
  // in GL's bottom-left-origin window this is the top-right corner.
  e.gl_sw_set_enabled(1);
  triangle([[-0.4, 0.1, 0], [0.4, 0.1, 0], [0.4, 0.9, 0]], [1, 0, 0, 1]);
  assert.strictEqual(e.gl_sw_triangles(), 1, 'one triangle rasterized');
  assert.strictEqual(e.gl_sw_clipped(), 0, 'nothing was in front of the eye plane');

  const entry = e.gl_sw_entry() >>> 0;
  assert.notStrictEqual(entry, 0, 'a render target was created');
  const u16 = o => new Uint16Array(memory.buffer.slice(entry + o, entry + o + 2))[0];
  const i32 = o => new Int32Array(memory.buffer.slice(entry + o, entry + o + 4))[0];
  const [w, h, bpp, pitch, dib] = [u16(12), u16(14), u16(16), u16(18), i32(20) >>> 0];
  assert.strictEqual(w, VP, 'surface width follows the viewport');
  assert.strictEqual(h, VP, 'surface height follows the viewport');
  assert.strictEqual(bpp, 32, 'surface is 32bpp');
  assert.strictEqual(i32(28), 4, 'draws land in the offscreen back buffer');
  const front = e.gl_sw_front() >>> 0;
  assert.notStrictEqual(front, 0, 'a front buffer was created with it');
  assert.strictEqual(new Int32Array(memory.buffer.slice(front + 28, front + 32))[0], 1,
    'the front is flagged primary, so a --png capture finds it');
  assert.ok(e.gl_sw_slot() >= 0, 'gl_sw_slot names a DX slot once a target exists');
  const frontDib = new Int32Array(memory.buffer.slice(front + 20, front + 24))[0] >>> 0;
  const frontPixels = () => new Uint32Array(memory.buffer.slice(frontDib, frontDib + pitch * h));
  assert.ok(frontPixels().every(v => v === 0), 'nothing is shown before SwapBuffers');

  const pixels = new Uint32Array(memory.buffer.slice(dib, dib + pitch * h));
  const at = (x, y) => pixels[(y * pitch) / 4 + x];
  const lit = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (at(x, y)) lit.push([x, y]);

  assert.ok(lit.length > 150,
    `expected a few hundred lit pixels for a 0.8x0.8 clip-space triangle, got ${lit.length}`);

  // THE Y FLIP, and the half of clip space the triangle is in. y=0.1..0.9 in
  // GL is the TOP of the window, which is the LOW row indices of a top-down
  // DIB; x=0.1..0.9 is the right half, which is the high column indices.
  const maxY = Math.max(...lit.map(p => p[1])), minX = Math.min(...lit.map(p => p[0]));
  assert.ok(maxY < h / 2,
    `every lit pixel should be in the top half of the surface (y < ${h / 2});`
    + ` the lowest reached y=${maxY}. A y that runs the other way is the flip bug.`);
  assert.ok(minX >= w / 2 - 2,
    `every lit pixel should be in the right half (x >= ${w / 2 - 2});`
    + ` the leftmost was x=${minX}. A leftward triangle means the modelview`
    + ` translation went in on the wrong side of the product.`);
  assert.strictEqual(at(2, h - 3), 0, 'the opposite corner stays background');

  // The colour the rasterizer actually stored, pinned once so a later change
  // to the 32bpp store is visible here rather than only in a screenshot.
  const sample = at(...lit[Math.floor(lit.length / 2)]);
  // The 32bpp store keeps the D3DCOLOR's alpha byte, so opaque red is
  // 0xFFFF0000 in the surface, not 0x00FF0000.
  assert.strictEqual(sample >>> 0, 0xFFFF0000,
    `an opaque red vertex should store as 0xFFFF0000; got 0x${(sample >>> 0).toString(16)}`);

  // --- the opposite winding draws too ------------------------------------
  // Inheriting D3D's D3DCULL_CCW default would drop exactly one of these.
  // The first triangle is counter-clockwise in GL's window; this one runs up
  // the left edge first, so it is clockwise.
  const CW = [[-0.4, -0.9, 0], [-0.4, -0.1, 0], [0.4, -0.1, 0]];
  const before = e.gl_sw_triangles();
  triangle(CW, [0, 1, 0, 1]);
  assert.strictEqual(e.gl_sw_triangles(), before + 1,
    'a clockwise triangle draws too -- GL_CULL_FACE is off by default');
  let green = 0;
  const after = new Uint32Array(memory.buffer.slice(dib, dib + pitch * h));
  for (const v of after) if ((v >>> 0) === 0xFF00FF00) green++;
  assert.ok(green > 150, `the second winding painted ${green} pixels, expected hundreds`);

  // --- SwapBuffers is what makes the back buffer visible ------------------
  glCall(CALL_INDEX.gpuPresent);
  assert.strictEqual(e.gl_sw_presents(), 1, 'one present counted');
  assert.deepStrictEqual(Array.from(frontPixels()), Array.from(after),
    'SwapBuffers copies the back buffer to the front');

  // --- GL_CULL_FACE, with GL's defaults: cull BACK, front is CCW ----------
  const GL_CULL_FACE = 0x0B44, GL_TEXTURE_2D = 0x0DE1, GL_DEPTH_TEST = 0x0B71;
  glCall(CALL_INDEX.glEnable, GL_CULL_FACE);
  const beforeCull = e.gl_sw_triangles();
  triangle(CW, [0, 1, 0, 1]);
  assert.strictEqual(e.gl_sw_culled(), 1, 'a clockwise triangle is a back face and is culled');
  triangle([[-0.4, 0.1, 0], [0.4, 0.1, 0], [0.4, 0.9, 0]], [1, 0, 0, 1]);
  assert.strictEqual(e.gl_sw_triangles(), beforeCull + 1, 'a counter-clockwise one is drawn');
  // Cull state saved and restored by glPushAttrib(GL_POLYGON_BIT)/glPopAttrib.
  glCall(CALL_INDEX.glPushAttrib, 0x8);
  glCall(CALL_INDEX.glDisable, GL_CULL_FACE);
  glCall(CALL_INDEX.glPopAttrib);
  triangle(CW, [0, 1, 0, 1]);
  assert.strictEqual(e.gl_sw_culled(), 2, 'glPopAttrib(GL_POLYGON_BIT) restored GL_CULL_FACE');
  glCall(CALL_INDEX.glDisable, GL_CULL_FACE);

  // Everything below draws in the whole viewport, untranslated.
  e.gl_mtx_set_mode(MODELVIEW);
  e.gl_mtx_load_identity();
  e.gl_mtx_set_mode(PROJECTION);
  const back = () => new Uint32Array(memory.buffer.slice(dib, dib + pitch * h));
  const quad = (z, colour, st = true) => {
    triangle([[-1, -1, z, 0, 0.5], [1, -1, z, 1, 0.5], [1, 1, z, 1, 0.5]], colour);
    triangle([[-1, -1, z, 0, 0.5], [1, 1, z, 1, 0.5], [-1, 1, z, 0, 0.5]], colour);
  };

  // --- a texture uploaded through glTexImage2D, sampled NEAREST -----------
  // 2x1 RGB, blue then yellow, with UNPACK_ALIGNMENT 1 so the row is 6
  // bytes. GL_REPLACE puts the texel on screen unmodulated, and the opaque
  // internal format forces alpha to 0xFF.
  const texels = e.guest_alloc(8) >>> 0;
  new Uint8Array(memory.buffer, toWasm(texels), 6).set([0, 0, 255, 255, 255, 0]);
  glCall(CALL_INDEX.glClear, 0x4000);
  glCall(CALL_INDEX.glBindTexture, GL_TEXTURE_2D, 7);
  glCall(CALL_INDEX.glPixelStorei, 0x0CF5, 1);
  glCall(CALL_INDEX.glTexImage2D, GL_TEXTURE_2D, 0, 0x1907, 2, 1, 0, 0x1907, 0x1401, texels);
  assert.strictEqual(e.gl_sw_tex_uploads(), 1, 'the upload was accepted');
  glCall(CALL_INDEX.glTexParameteri, GL_TEXTURE_2D, 0x2800, 0x2600);  // MAG_FILTER NEAREST
  glCall(CALL_INDEX.glTexEnvi, 0x2300, 0x2200, 0x1E01);                // REPLACE
  glCall(CALL_INDEX.glEnable, GL_TEXTURE_2D);
  quad(0, [1, 1, 1, 1]);
  let px = back();
  const pick = (x, y) => px[(y * pitch) / 4 + x] >>> 0;
  assert.strictEqual(pick(VP / 4, VP / 2), 0xFF0000FF,
    `the left half samples texel 0 (blue); got 0x${pick(VP / 4, VP / 2).toString(16)}`);
  assert.strictEqual(pick(VP * 3 / 4, VP / 2), 0xFFFFFF00,
    `the right half samples texel 1 (yellow); got 0x${pick(VP * 3 / 4, VP / 2).toString(16)}`);
  // Regression: GL_CLAMP blends missing border taps; EDGE never does.
  // Constant coordinates remove interpolation/LOD ambiguity. The two-pixel
  // RGB image has blue at its left edge and the default black border.
  glCall(CALL_INDEX.glTexParameteri, GL_TEXTURE_2D, 0x2800, 0x2601);
  glCall(CALL_INDEX.glTexParameteri, GL_TEXTURE_2D, 0x2801, 0x2601);
  const atConstant = (wrap, s, t) => {
    glCall(CALL_INDEX.glTexParameteri, GL_TEXTURE_2D, 0x2802, wrap);
    glCall(CALL_INDEX.glTexParameteri, GL_TEXTURE_2D, 0x2803, wrap);
    triangle([[-1, -1, 0, s, t], [1, -1, 0, s, t], [1, 1, 0, s, t]], [1,1,1,1]);
    triangle([[-1, -1, 0, s, t], [1, 1, 0, s, t], [-1, 1, 0, s, t]], [1,1,1,1]);
    px = back(); return pick(VP/2,VP/2) & 0xffffff;
  };
  assert.strictEqual(atConstant(0x812f,0,0.5),0xff,'EDGE control is full blue');
  assert.strictEqual(atConstant(0x2900,0.25,0.5),0xff,'CLAMP interior is full blue');
  const borderEdge=atConstant(0x2900,0,0.5);
  assert.ok(borderEdge===0x7f || borderEdge===0x80,
    'GL_CLAMP linear edge must blend half default black border; got0x'+borderEdge.toString(16));
  const borderCorner=atConstant(0x2900,0,0);
  assert.ok(borderCorner===0x3f || borderCorner===0x40,
    'GL_CLAMP linear corner must blend three default border taps; got0x'+borderCorner.toString(16));
  assert.strictEqual(pick(VP/2,VP/2)>>>24,255,
    'RGB internal format keeps border alpha opaque');
  glCall(CALL_INDEX.glTexParameteri, GL_TEXTURE_2D, 0x2800, 0x2600);
  glCall(CALL_INDEX.glTexParameteri, GL_TEXTURE_2D, 0x2801, 0x2702);
  glCall(CALL_INDEX.glTexParameteri, GL_TEXTURE_2D, 0x2802, 0x2901);
  glCall(CALL_INDEX.glTexParameteri, GL_TEXTURE_2D, 0x2803, 0x2901);
  // glTexEnvi on any target but GL_TEXTURE_ENV is GL_INVALID_ENUM and must
  // not change the mode. SimGolf asks for REPLACE on GL_TEXTURE_2D 474 times;
  // honouring it drew its lit terrain unlit. Here: a MODULATE request on the
  // wrong target leaves REPLACE, so a red vertex still shows pure blue.
  glCall(CALL_INDEX.glTexEnvi, GL_TEXTURE_2D, 0x2200, 0x2100);
  quad(0, [1, 0, 0, 1]);
  px = back();
  assert.strictEqual(pick(VP / 4, VP / 2), 0xFF0000FF,
    `glTexEnvi(GL_TEXTURE_2D, ...) is ignored; got 0x${pick(VP / 4, VP / 2).toString(16)}`);
  // The same request on GL_TEXTURE_ENV takes: blue texel times red vertex.
  glCall(CALL_INDEX.glTexEnvi, 0x2300, 0x2200, 0x2100);
  quad(0, [1, 0, 0, 1]);
  px = back();
  assert.strictEqual(pick(VP / 4, VP / 2) & 0xFFFFFF, 0,
    `MODULATE on GL_TEXTURE_ENV multiplies; got 0x${pick(VP / 4, VP / 2).toString(16)}`);
  glCall(CALL_INDEX.glTexEnvi, 0x2300, 0x2200, 0x1E01);
  // An unsupported type is refused and counted, not guessed at.
  glCall(CALL_INDEX.glTexImage2D, GL_TEXTURE_2D, 0, 0x1908, 2, 1, 0, 0x1908, 0x1406, texels);
  assert.strictEqual(e.gl_sw_tex_unsupported(), 1, 'a GL_FLOAT upload is counted as unsupported');
  glCall(CALL_INDEX.glDisable, GL_TEXTURE_2D);

  // --- the depth test ------------------------------------------------------
  // ortho(-1,1,-1,1,-1,1) maps eye z=+0.5 to window depth 0.25 and z=-0.5
  // to 0.75, so the green quad is nearer and the later red one must lose.
  glCall(CALL_INDEX.glEnable, GL_DEPTH_TEST);
  glCall(CALL_INDEX.glClear, 0x4100);
  quad(0.5, [0, 1, 0, 1]);
  quad(-0.5, [1, 0, 0, 1]);
  px = back();
  assert.strictEqual(pick(VP / 2, VP / 2), 0xFF00FF00,
    `the nearer green quad survives the farther red one; got 0x${pick(VP / 2, VP / 2).toString(16)}`);
  glCall(CALL_INDEX.glDisable, GL_DEPTH_TEST);
  quad(-0.5, [1, 0, 0, 1]);
  px = back();
  assert.strictEqual(pick(VP / 2, VP / 2), 0xFFFF0000, 'with GL_DEPTH_TEST off the later quad wins');

  // --- the alpha test --------------------------------------------------------
  // glAlphaFunc(GL_GREATER, 0.5): a quad with vertex alpha 0.25 is rejected
  // whole, and one with alpha 0.75 is not. Written against a raw-value
  // i32.and that once made this test impossible to switch on.
  glCall(CALL_INDEX.glEnable, 0x0BC0);
  glCall(CALL_INDEX.glAlphaFunc, 0x204, 0.5);
  quad(0, [0, 0, 1, 0.25]);
  px = back();
  assert.strictEqual(pick(VP / 2, VP / 2), 0xFFFF0000, 'alpha 0.25 fails GL_GREATER 0.5');
  quad(0, [0, 0, 1, 0.75]);
  px = back();
  assert.strictEqual(pick(VP / 2, VP / 2) & 0xFFFFFF, 0x0000FF, 'alpha 0.75 passes it');
  glCall(CALL_INDEX.glDisable, 0x0BC0);

  // --- the scissor test ----------------------------------------------------
  // GL scissors glClear as well as triangles. Fill everything red, then with
  // a box on GL's bottom-left quadrant (surface rows VP/2.., since GL is
  // bottom-up) clear blue, then draw a green quad over the whole view.
  // Nothing outside the box may change. 0.999 stands for 1.0: glCall writes
  // an integer argument as an integer.
  const GL_SCISSOR_TEST = 0x0C11;
  glCall(CALL_INDEX.glClearColor, 0.999, 0, 0, 0.999);
  glCall(CALL_INDEX.glClear, 0x4000);
  glCall(CALL_INDEX.glEnable, GL_SCISSOR_TEST);
  glCall(CALL_INDEX.glScissor, 0, 0, VP / 2, VP / 2);
  glCall(CALL_INDEX.glClearColor, 0, 0, 0.999, 0.999);
  glCall(CALL_INDEX.glClear, 0x4000);
  px = back();
  const rgb = (x, y) => pick(x, y) & 0xFFFFFF;
  assert.strictEqual(rgb(VP / 4, VP * 3 / 4), 0x0000FF, 'a scissored clear fills the box');
  assert.strictEqual(rgb(VP / 4, VP / 4), 0xFF0000, 'and not the rows above it');
  assert.strictEqual(rgb(VP * 3 / 4, VP * 3 / 4), 0xFF0000, 'nor the columns right of it');
  quad(0, [0, 1, 0, 1]);
  px = back();
  assert.strictEqual(rgb(VP / 4, VP * 3 / 4), 0x00FF00, 'inside the box the quad is drawn');
  assert.strictEqual(rgb(VP * 3 / 4, VP / 4), 0xFF0000, 'outside it, nothing is');
  assert.strictEqual(rgb(VP * 3 / 4, VP * 3 / 4), 0xFF0000, 'the quad is cut at the box edge');
  glCall(CALL_INDEX.glDisable, GL_SCISSOR_TEST);

  // --- behind the eye is dropped, not mirrored ---------------------------
  // A frustum with near=1 puts z=0 geometry at w=0, which has no screen
  // position at all.
  e.gl_mtx_set_mode(PROJECTION);
  e.gl_mtx_load_identity();
  e.gl_mtx_frustum(-1, 1, -1, 1, 1, 100);
  const drawn = e.gl_sw_triangles();
  triangle([[-0.4, 0.1, 0], [0.4, 0.1, 0], [0.4, 0.9, 0]], [0, 0, 1, 1]);
  assert.strictEqual(e.gl_sw_triangles(), drawn,
    'a triangle at the eye plane must not be rasterized');
  assert.strictEqual(e.gl_sw_clipped(), 1, 'and must be counted as dropped');

  // --- a triangle straddling the near plane is clipped, not dropped --------
  // A floor running from eye z=-0.5 (in front of the eye, short of near=1)
  // out to z=-10: the visible part covers the bottom-centre of the view,
  // from the bottom edge (y=-1 at the near plane) up to ndc y=-0.1. Before
  // near clipping this whole triangle was dropped -- Half-Life's corridor
  // floor lost a wedge at every step.
  glCall(CALL_INDEX.glDisable, 0x0B44);
  const beforeStraddle = e.gl_sw_triangles();
  triangle([[-5, -1, -0.5], [5, -1, -0.5], [0, -1, -10]], [0, 1, 0, 1]);
  assert.ok(e.gl_sw_triangles() > beforeStraddle, 'the visible part of a straddling triangle is drawn');
  assert.strictEqual(e.gl_sw_clipped(), 1, 'and nothing more is counted as dropped');
  px = back();
  // ndc y=-0.5 is GL row VP/4, surface row 3*VP/4.
  assert.strictEqual(pick(VP / 2, VP * 3 / 4) & 0xFFFFFF, 0x00FF00,
    `the floor shows below the horizon; got 0x${pick(VP / 2, VP * 3 / 4).toString(16)}`);

  // --- linear fog --------------------------------------------------------
  // Under this frustum clip w is the eye distance. GL_LINEAR from 10 to 90
  // puts a quad at eye z=-50 exactly halfway, so green fogged toward red is
  // half of each; one at z=-5, nearer than the fog start, is untouched.
  // Start/end go through glFogi because glCall writes integers as integers.
  const GL_FOG = 0x0B60;
  const fogColor = e.guest_alloc(16) >>> 0;
  new Float32Array(memory.buffer, toWasm(fogColor), 4).set([1, 0, 0, 1]);
  glCall(CALL_INDEX.glFogi, 0x0B65, 0x2601);        // GL_FOG_MODE, GL_LINEAR
  glCall(CALL_INDEX.glFogi, 0x0B63, 10);            // GL_FOG_START
  glCall(CALL_INDEX.glFogi, 0x0B64, 90);            // GL_FOG_END
  glCall(CALL_INDEX.glFogfv, 0x0B66, fogColor);     // GL_FOG_COLOR
  glCall(CALL_INDEX.glEnable, GL_FOG);
  const wall = (z, colour) => {
    const r = -z * 1.5;                             // wider than the view at z
    triangle([[-r, -r, z], [r, -r, z], [r, r, z]], colour);
    triangle([[-r, -r, z], [r, r, z], [-r, r, z]], colour);
  };
  wall(-50, [0, 1, 0, 1]);
  px = back();
  const fogged = rgb(VP / 2, VP / 2);
  const near = (v, want) => Math.abs(v - want) <= 2;
  assert.ok(near(fogged >>> 16, 0x80) && near((fogged >>> 8) & 0xFF, 0x80) && (fogged & 0xFF) === 0,
    `z=-50 under LINEAR 10..90 is half green, half fog red; got 0x${fogged.toString(16)}`);
  wall(-5, [0, 1, 0, 1]);
  px = back();
  assert.strictEqual(rgb(VP / 2, VP / 2), 0x00FF00, 'nearer than GL_FOG_START is unfogged');
  glCall(CALL_INDEX.glDisable, GL_FOG);
  wall(-50, [0, 1, 0, 1]);
  px = back();
  assert.strictEqual(rgb(VP / 2, VP / 2), 0x00FF00, 'with GL_FOG off nothing is fogged');

  // --- fixed-function lighting --------------------------------------------
  // Light 0 is directional toward the viewer. A wall facing it gets the full
  // material diffuse; one edge-on gets only emission plus ambient. The light
  // and material go through the matrix mirror, which is where the path
  // reads them from.
  const GL_LIGHTING = 0x0B50, GL_LIGHT0 = 0x4000, GL_COLOR_MATERIAL = 0x0B57;
  const vec = e.guest_alloc(16) >>> 0;
  const vecSet = v => new Float32Array(memory.buffer, toWasm(vec), 4).set(v);
  const mtxCall = (op, ...args) => {
    const words = new Int32Array(memory.buffer, stack, 16);
    words.fill(0);
    words.set(args, 1);
    e.gl_mtx_observe(op, stack);
  };
  vecSet([0, 0, 1, 0]); mtxCall(CALL_INDEX.glLightfv, GL_LIGHT0, 0x1203, vec);  // POSITION
  vecSet([1, 1, 1, 1]); mtxCall(CALL_INDEX.glLightfv, GL_LIGHT0, 0x1201, vec);  // DIFFUSE
  vecSet([0, 0, 0, 1]); mtxCall(CALL_INDEX.glLightModelfv, 0x0B53, vec);        // no global ambient
  vecSet([0, 0, 0, 1]); mtxCall(CALL_INDEX.glMaterialfv, 0x408, 0x1200, vec);   // AMBIENT
  vecSet([0, 1, 0, 1]); mtxCall(CALL_INDEX.glMaterialfv, 0x408, 0x1201, vec);   // DIFFUSE
  vecSet([0, 0, 0.5, 1]); mtxCall(CALL_INDEX.glMaterialfv, 0x408, 0x1600, vec); // EMISSION
  const litWall = (z, colour, n) => {
    const r = -z * 1.5;
    const tri = pts => {
      pts.forEach(([x, y], i) => {
        putVertex(i, x, y, z, ...colour);
        new Float32Array(memory.buffer, verts + i * VERT_BYTES, VERT_FLOATS).set(n, 9);
      });
      e.gl_sw_emit_triangles(verts, 3);
    };
    tri([[-r, -r], [r, -r], [r, r]]);
    tri([[-r, -r], [r, r], [-r, r]]);
  };
  glCall(CALL_INDEX.glEnable, GL_LIGHTING);
  glCall(CALL_INDEX.glEnable, GL_LIGHT0);
  litWall(-20, [1, 0, 0, 1], [0, 0, 1]);
  px = back();
  assert.strictEqual(rgb(VP / 2, VP / 2), 0x00FF80,
    `facing the light: diffuse green plus emission blue, vertex red ignored; got 0x${rgb(VP / 2, VP / 2).toString(16)}`);
  litWall(-20, [1, 0, 0, 1], [1, 0, 0]);
  px = back();
  assert.ok(near(rgb(VP / 2, VP / 2), 0x000080),
    `edge-on to the light: emission only; got 0x${rgb(VP / 2, VP / 2).toString(16)}`);
  glCall(CALL_INDEX.glEnable, GL_COLOR_MATERIAL);
  litWall(-20, [1, 0, 0, 1], [0, 0, 1]);
  px = back();
  assert.strictEqual(rgb(VP / 2, VP / 2), 0xFF0080,
    `COLOR_MATERIAL takes diffuse from the vertex colour; got 0x${rgb(VP / 2, VP / 2).toString(16)}`);
  glCall(CALL_INDEX.glDisable, GL_COLOR_MATERIAL);
  glCall(CALL_INDEX.glDisable, GL_LIGHT0);
  litWall(-20, [1, 0, 0, 1], [0, 0, 1]);
  px = back();
  assert.ok(near(rgb(VP / 2, VP / 2), 0x000080), 'a disabled light contributes nothing');
  glCall(CALL_INDEX.glDisable, GL_LIGHTING);
  litWall(-20, [1, 0, 0, 1], [0, 0, 1]);
  px = back();
  assert.strictEqual(rgb(VP / 2, VP / 2), 0xFF0000, 'with GL_LIGHTING off the vertex colour is used');

  // --- far plane ------------------------------------------------------------
  // The frustum's far plane is 100. A wall past it is clipped away whole
  // (Warcraft III's sky dome drew white until this), one straddling it keeps
  // its near part.
  litWall(-20, [0, 0, 1, 1], [0, 0, 1]);
  glCall(CALL_INDEX.glDisable, 0x0B71);             // no depth test: order decides
  litWall(-150, [1, 1, 0, 1], [0, 0, 1]);
  px = back();
  assert.strictEqual(rgb(VP / 2, VP / 2), 0x0000FF, 'a wall beyond the far plane draws nothing');
  const tilted = pts => {
    pts.forEach(([x, y, z], i) => putVertex(i, x, y, z, 1, 1, 0, 1));
    e.gl_sw_emit_triangles(verts, 3);
  };
  // A floor-like strip from eye z=-50 to z=-200 across the centre column.
  tilted([[-10, -1, -50], [10, -1, -50], [10, -4, -200]]);
  tilted([[-10, -1, -50], [10, -4, -200], [-10, -4, -200]]);
  px = back();
  const straddle = [...Array(VP).keys()].filter(y => rgb(VP / 2, y) === 0xFFFF00).length;
  assert.ok(straddle > 0, 'the part of a straddling strip inside the far plane draws');

  console.log('PASS test-gl-software-raster');
}

main().catch(err => { console.error(err); process.exit(1); });
