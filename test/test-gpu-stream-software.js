'use strict';
// tl;dr: drives lib/gpu-stream-software.js (the GPU stream v2 software
// executor) with synthetic records from test/gpu-stream-fixture.js and checks
// pixels: CLEAR, a flat triangle, a textured quad, Z test, a point, a line,
// A8B8G8R8 READBACK, PRESENT with and without a gamma LUT, alpha test, blend,
// RT UPLOAD (LFB write path), occlusion fences, fail-fast refusals, and the
// shared D1 contract scenario (test/gpu-stream-webgl-scenario.js runD1).
// Exits non-zero on failure.
const assert = require('assert');
const GS = require('../lib/gpu-stream');
const { makeProducer } = require('./gpu-stream-fixture');
const { bootRenderHarness } = require('./render-helper');
const { Executor } = require('../lib/gpu-stream-software');
const scenario = require('./gpu-stream-webgl-scenario');

const { KIND, FMT, CONST } = GS;
const W = 64, H = 64;

// ── native IR (src/09af-d3d-shader-ir.wat ABI 1), the encoding Glide emits ──
const dst = (index, mask = 15) => [0, index, mask, 0];
const src = (bank, index = 0, modifier = 0) => [bank, index, 228, modifier];
function ir(instructions) {
  const bytes = new Uint8Array(32 + instructions.length * 128), u = new Uint32Array(bytes.buffer);
  u.set([0x44534952, 1, 1, 0xffff0104, instructions.length, instructions.length + 2, bytes.length, 1]);
  instructions.forEach(([op, ...args], i) => {
    const at = 8 + i * 32;
    u.set([op, i + 1, args.length, 0], at);
    args.forEach((a, j) => u.set(a, at + 4 + j * 4));
  });
  return bytes;
}
const FLAT = ir([[1, dst(0), src(1)]]);                 // mov r0, v0
const TEXTURED = ir([[66, dst(0), src(3, 0, 10)]]);     // texld r0, t0_dw

// Vertex: x y z rgba(0..1) s t, in Glide's half-integer pixel centres, written
// as the contract's integer ones (Glide's WAT subtracts 0.5 the same way).
function vert(x, y, z, rgba, s = 0, t = 0) {
  return [x - 0.5, y - 0.5, z, 1, ...rgba, s, t, 1, 1, 0, 0, 0, 1];
}
const RED = [1, 0, 0, 1], GREEN = [0, 1, 0, 1], BLUE = [0, 0, 1, 1], YELLOW = [1, 1, 0, 1], WHITE = [1, 1, 1, 1];

function raster(over = {}) {
  return Object.assign({
    depth_mode: 0, zfunc: 8, zwrite: 0, cull: 1, blend: 1,
    src_rgb: 2, dst_rgb: 1, src_alpha: 2, dst_alpha: 1, blend_op: 1, blend_op_alpha: 1, linear: 1,
    alpha_func: 8, alpha_ref: 0, colormask: 15, fog_mode: 0, fog_flags: 0, fill: 3,
    fog_color: 0, fog_table: 0, depth_bias: 0,
    scissor_left: 0, scissor_top: 0, scissor_right: W, scissor_bottom: H,
  }, over);
}

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ fonts: 'none' });
  const frames = [];
  let canvasPut = null;
  const canvas = {
    width: 0, height: 0,
    getContext: () => ({
      createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      putImageData(image) { canvasPut = image.data.slice(); },
    }),
  };
  const ex = new Executor({ canvas, getExports: () => e, getMemory: () => memory.buffer, onPresent: (f) => frames.push(f) });
  const p = makeProducer({ ringBytes: 16384, arenaBytes: 65536, memBytes: 1 << 20 });
  const ring = p.ring();
  const run = () => GS.drain([ring], ex);
  const arena = (bytes) => { const pos = p.arenaAlloc(bytes.length); p.arenaView(pos, bytes.length).set(bytes); return pos; };
  const draw = (prim, verts, ps) => {
    const f = new Float32Array(verts.flat());
    const voff = arena(new Uint8Array(f.buffer));
    p.emit('DRAW_UP', { prim, vs: 0, ps, layout: 4, vbuf: 0, voff, stride: 64, ibuf: 0, ioff: 0, count: verts.length, vcount: verts.length });
  };
  const px = (frame, x, y) => Array.from(frame.pixels.subarray((y * frame.width + x) * 4, (y * frame.width + x) * 4 + 4));
  const present = (gamma = 0) => { p.emit('PRESENT', { rt: 2, gamma, x: 0, y: 0, w: W, h: H, surface: 0x1234 }); run(); return frames[frames.length - 1]; };

  // ── setup ──
  p.emit('CREATE', { id: 1, kind: KIND.RT, fmt: FMT.A8B8G8R8, levels: 1, width: W, height: H });
  p.emit('CREATE', { id: 2, kind: KIND.RT, fmt: FMT.A8B8G8R8, levels: 1, width: W, height: H });
  p.emit('CREATE', { id: 3, kind: KIND.DS, fmt: FMT.D16, levels: 1, width: W, height: H });
  const elems = [[9, 0, 0], [10, 0, 16], [5, 0, 32], [5, 1, 48]].map(([usage, index, offset]) =>
    require('./gpu-stream-fixture').packLayout('GpsLayoutElem', { slot: 0, type: 3, usage, index, offset }));
  const layoutTail = new Uint8Array(32); elems.forEach((b, i) => layoutTail.set(b, i * 8));
  p.emit('LAYOUT', { id: 4, count: 4, stride: 64 }, layoutTail);
  p.emit('TARGETS', { color: 2, depth: 3 });
  p.emit('SHADER', { id: 5, stage: 1, ir_bytes: FLAT.length }, FLAT);
  p.emit('SHADER', { id: 6, stage: 1, ir_bytes: TEXTURED.length }, TEXTURED);
  p.emit('SAMPLER', { id: 7, address_u: 3, address_v: 3, min: 1, mag: 1, mip: 0, lod_bias: 0 });
  p.emit('CREATE', { id: 8, kind: KIND.TEX2D, fmt: FMT.A8B8G8R8, levels: 1, width: 2, height: 2 });
  const texel = new Uint8Array([255, 0, 255, 255, 0, 255, 255, 255, 255, 255, 0, 255, 10, 20, 30, 255]); // magenta cyan / yellow (10,20,30)
  p.emit('UPLOAD', { id: 8, level: 0, x: 0, y: 0, w: 2, h: 2, pitch: 8, src: arena(texel), bytes: 16 });
  const consts = new Float32Array(20); consts.set([1, 1, 1, 1], 4); consts.fill(0.5 / 255, 16);
  p.emit('CONSTS', { stage: 1, first: 0, count: 5 }, new Uint8Array(consts.buffer));
  // CLEAR to red, depth 1.
  p.emit('CLEAR', { mask: 3, colormask: 15, rgba: 0xff0000ff, z: 1, left: 0, top: 0, right: W, bottom: H });
  p.emit('RASTER', raster());
  p.emit('BIND', { count: 0 });
  // Flat green triangle, top-left.
  draw(4, [vert(0, 0, 0, GREEN), vert(32, 0, 0, GREEN), vert(0, 32, 0, GREEN)], 5);
  // Textured quad in the bottom-right 32x32 (two triangles).
  const bind = require('./gpu-stream-fixture').packLayout('GpsBindEntry', { slot: 0, texture: 8, sampler: 7 });
  p.emit('BIND', { count: 1 }, bind);
  draw(4, [vert(32, 32, 0, WHITE, 0, 0), vert(64, 32, 0, WHITE, 1, 0), vert(32, 64, 0, WHITE, 0, 1),
    vert(64, 32, 0, WHITE, 1, 0), vert(64, 64, 0, WHITE, 1, 1), vert(32, 64, 0, WHITE, 0, 1)], 6);
  run();

  let f = present();
  assert.strictEqual(frames.length, 1);
  assert.strictEqual(f.width, W); assert.strictEqual(f.height, H); assert.strictEqual(f.hwnd, 0x1234);
  assert.ok(f.pixels instanceof Uint8ClampedArray);
  assert.strictEqual(f.surface, canvas);
  assert.deepStrictEqual(Array.from(canvasPut), Array.from(f.pixels), 'canvas gets the presented pixels');
  assert.deepStrictEqual(px(f, 2, 2), [0, 255, 0, 255], 'flat triangle');
  assert.deepStrictEqual(px(f, 30, 30), [255, 0, 0, 255], 'clear color outside the triangle');
  assert.deepStrictEqual(px(f, 50, 5), [255, 0, 0, 255], 'clear color');
  assert.deepStrictEqual(px(f, 36, 36), [255, 0, 255, 255], 'texel 0,0');
  assert.deepStrictEqual(px(f, 60, 36), [0, 255, 255, 255], 'texel 1,0');
  assert.deepStrictEqual(px(f, 36, 60), [255, 255, 0, 255], 'texel 0,1');
  assert.deepStrictEqual(px(f, 60, 60), [10, 20, 30, 255], 'texel 1,1');
  // Glide edge rule: x=0..31 covered on row 0 (centers x+0.5 < 32 - 0.5).
  assert.deepStrictEqual(px(f, 30, 0), [0, 255, 0, 255], 'edge pixel inside');
  assert.deepStrictEqual(px(f, 31, 0), [255, 0, 0, 255], 'edge pixel outside');

  // ── READBACK A8B8G8R8, top-down ──
  const rbPos = p.arenaAlloc(W * 4 * H);
  p.emit('READBACK', { rt: 2, x: 0, y: 0, w: W, h: H, fmt: FMT.A8B8G8R8, dst: rbPos, pitch: W * 4, slot: 0 });
  const rbSeq = p.load('submit_seq');
  run();
  assert.strictEqual(p.slot(0), rbSeq, 'READBACK completes its slot');
  const rb = p.arenaView(rbPos, W * 4 * H);
  const rgba = (x, y) => Array.from(rb.subarray((y * W + x) * 4, (y * W + x) * 4 + 4));
  assert.deepStrictEqual(rgba(2, 2), [0, 255, 0, 255], 'readback green');
  assert.deepStrictEqual(rgba(50, 5), [255, 0, 0, 255], 'readback red');
  assert.deepStrictEqual(rgba(60, 60), [10, 20, 30, 255], 'readback texel');

  // ── gamma LUT (inverting) ──
  p.emit('CREATE', { id: 9, kind: KIND.TEX2D, fmt: FMT.A8B8G8R8, levels: 1, width: 256, height: 1 });
  const lut = new Uint8Array(1024);
  for (let i = 0; i < 256; i++) lut.set([255 - i, 255 - i, 255 - i, 255], i * 4);
  p.emit('UPLOAD', { id: 9, level: 0, x: 0, y: 0, w: 256, h: 1, pitch: 1024, src: arena(lut), bytes: 1024 });
  f = present(9);
  assert.deepStrictEqual(px(f, 50, 5), [0, 255, 255, 255], 'gamma LUT applied per channel');
  assert.deepStrictEqual(px(f, 60, 60), [245, 235, 225, 255], 'gamma LUT on a texel');

  // ── Z test: blue at z .5, then yellow at z .7 behind it ──
  p.emit('BIND', { count: 0 });
  p.emit('RASTER', raster({ depth_mode: 1, zfunc: 2, zwrite: 1 }));
  draw(4, [vert(0, 40, 0.5, BLUE), vert(24, 40, 0.5, BLUE), vert(0, 64, 0.5, BLUE)], 5);
  draw(4, [vert(0, 40, 0.7, YELLOW), vert(24, 40, 0.7, YELLOW), vert(0, 64, 0.7, YELLOW)], 5);
  // and yellow in front somewhere else in the same triangle region: z .3 over row 41..
  draw(4, [vert(0, 52, 0.3, YELLOW), vert(4, 52, 0.3, YELLOW), vert(0, 56, 0.3, YELLOW)], 5);
  // ── point and line ──
  p.emit('RASTER', raster());
  draw(1, [vert(40.5, 10.5, 0, WHITE)], 5);
  draw(2, [vert(40, 20.5, 0, BLUE), vert(50, 20.5, 0, BLUE)], 5);
  draw(2, [vert(45, 25, 0, BLUE), vert(45, 25, 0, BLUE)], 5); // zero length: nothing
  run();
  f = present();
  assert.deepStrictEqual(px(f, 2, 42), [0, 0, 255, 255], 'nearer blue wins');
  assert.deepStrictEqual(px(f, 0, 52), [255, 255, 0, 255], 'z .3 in front of blue');
  assert.deepStrictEqual(px(f, 40, 10), [255, 255, 255, 255], 'point');
  assert.deepStrictEqual(px(f, 39, 10), [255, 0, 0, 255], 'point is one pixel wide');
  assert.deepStrictEqual(px(f, 41, 10), [255, 0, 0, 255], 'point is one pixel wide');
  assert.deepStrictEqual(px(f, 45, 20), [0, 0, 255, 255], 'line');
  assert.deepStrictEqual(px(f, 45, 21), [255, 0, 0, 255], 'line is one pixel thick');
  assert.deepStrictEqual(px(f, 45, 25), [255, 0, 0, 255], 'zero-length line draws nothing');

  // ── alpha test (GREATER than 128) and additive blend ──
  p.emit('RASTER', raster({ alpha_func: 5, alpha_ref: 128 }));
  draw(4, [vert(40, 0, 0, [0, 0, 1, 0.25]), vert(64, 0, 0, [0, 0, 1, 0.25]), vert(40, 8, 0, [0, 0, 1, 0.25])], 5);
  p.emit('RASTER', raster({ src_rgb: 2, dst_rgb: 2 }));
  draw(4, [vert(48, 8, 0, [0, 0.5, 0, 1]), vert(64, 8, 0, [0, 0.5, 0, 1]), vert(48, 24, 0, [0, 0.5, 0, 1])], 5);
  // colormask 0: draws nothing visible
  p.emit('RASTER', raster({ colormask: 0 }));
  draw(4, [vert(56, 40, 0, GREEN), vert(64, 40, 0, GREEN), vert(56, 48, 0, GREEN)], 5);
  // cull: (24,0)->(32,0)->(24,8) is clockwise on screen (y down).
  // cull 2 (CW) drops it; cull 3 (CCW) keeps it; the reversed winding the opposite.
  const cw = [vert(24, 26, 0, BLUE), vert(32, 26, 0, BLUE), vert(24, 34, 0, BLUE)];
  p.emit('RASTER', raster({ cull: 2 }));
  draw(4, cw, 5);
  draw(4, [vert(34, 0, 0, BLUE), vert(34, 8, 0, BLUE), vert(42, 0, 0, BLUE)], 5); // CCW kept
  p.emit('RASTER', raster({ cull: 3 }));
  draw(4, [vert(24, 0, 0, YELLOW), vert(32, 0, 0, YELLOW), vert(24, 8, 0, YELLOW)], 5); // CW kept
  // scissor: only columns 0..3 of the next triangle
  p.emit('RASTER', raster({ scissor_right: 4 }));
  draw(4, [vert(0, 34, 0, WHITE), vert(30, 34, 0, WHITE), vert(0, 38, 0, WHITE)], 5);
  run();
  f = present();
  assert.deepStrictEqual(px(f, 44, 1), [255, 0, 0, 255], 'alpha test rejected a .25 alpha');
  const add = px(f, 50, 10);
  assert.ok(add[0] === 255 && add[1] >= 127 && add[1] <= 128 && add[2] === 0, `additive blend ${add}`);
  assert.deepStrictEqual(px(f, 57, 41), [0, 255, 255, 255], 'colormask 0 keeps the texel');
  assert.deepStrictEqual(px(f, 25, 27), [255, 0, 0, 255], 'cull 2 drops a clockwise (y down) triangle');
  assert.deepStrictEqual(px(f, 35, 1), [0, 0, 255, 255], 'cull 2 keeps a counter-clockwise triangle');
  assert.deepStrictEqual(px(f, 25, 1), [255, 255, 0, 255], 'cull 3 keeps a clockwise triangle');
  assert.deepStrictEqual(px(f, 2, 34), [255, 255, 255, 255], 'inside scissor');
  assert.deepStrictEqual(px(f, 6, 34), [255, 0, 0, 255], 'outside scissor');

  // ── RT UPLOAD (LFB write path): a 4x2 band at 10,30, R,G,B,255 rows ──
  const band = new Uint8Array(4 * 2 * 4);
  for (let i = 0; i < 8; i++) band.set([1, 2, 3, 255], i * 4);
  p.emit('UPLOAD', { id: 2, level: 0, x: 10, y: 30, w: 4, h: 2, pitch: 16, src: arena(band), bytes: band.length });
  // partial clear: colormask rgb only, inside a rect
  p.emit('CLEAR', { mask: 1, colormask: 7, rgba: 0x00ff0000, z: 1, left: 20, top: 28, right: 22, bottom: 30 });
  run();
  f = present();
  assert.deepStrictEqual(px(f, 10, 30), [1, 2, 3, 255], 'RT upload');
  assert.deepStrictEqual(px(f, 13, 31), [1, 2, 3, 255], 'RT upload last pixel');
  assert.deepStrictEqual(px(f, 14, 31), [255, 0, 0, 255], 'RT upload stays in its rect');
  assert.deepStrictEqual(px(f, 21, 29), [0, 0, 255, 255], 'rect clear');
  assert.deepStrictEqual(px(f, 22, 29), [255, 0, 0, 255], 'rect clear is exclusive');

  // Texture re-upload invalidates the resident copy.
  p.emit('UPLOAD', { id: 8, level: 0, x: 0, y: 0, w: 1, h: 1, pitch: 4, src: arena(new Uint8Array([7, 8, 9, 255])), bytes: 4 });
  p.emit('RASTER', raster());
  p.emit('BIND', { count: 1 }, bind);
  draw(4, [vert(32, 32, 0, WHITE, 0, 0), vert(64, 32, 0, WHITE, 1, 0), vert(32, 64, 0, WHITE, 0, 1)], 6);
  p.emit('MARK', { frame: 1, tag: 0x47504c44 });
  p.emit('FENCE', { slot: 1 });
  run();
  f = present();
  assert.deepStrictEqual(px(f, 36, 36), [7, 8, 9, 255], 're-uploaded texel');

  const s = ex.stats();
  assert.strictEqual(s.presents, frames.length);
  assert.ok(s.draws >= 10 && s.readbacks === 1 && s.marks === 1 && s.fences === 1, JSON.stringify(s));

  // ── fail fast ──
  const expectFail = (fn, re, what) => {
    let err = null;
    try { fn(); } catch (error) { err = error; }
    assert.ok(err && re.test(err.message), `${what}: expected ${re}, got ${err && err.message}`);
  };
  const lone = (setup) => {
    const q = makeProducer({ ringBytes: 4096, arenaBytes: 4096, memBytes: 1 << 16 });
    const x = new Executor({ getExports: () => e, getMemory: () => memory.buffer });
    setup(q);
    try { GS.drain([q.ring()], x); } finally { x.close(); }
  };
  expectFail(() => lone((q) => q.emit('VIEWPORT', {})), /color target is id 0/, 'viewport without a target');
  expectFail(() => lone((q) => q.emit('TARGETS', { color: 5, depth: 0 })), /never created/, 'unknown target');
  expectFail(() => lone((q) => { q.emit('CREATE', { id: 1, kind: KIND.RT, fmt: FMT.A8B8G8R8, levels: 1, width: 8, height: 8 });
    q.emit('CREATE', { id: 1, kind: KIND.RT, fmt: FMT.A8B8G8R8, levels: 1, width: 8, height: 8 }); }), /already live/, 'duplicate id');
  expectFail(() => lone((q) => q.emit('CREATE', { id: 1, kind: KIND.TEX2D, fmt: FMT.DXT1, levels: 1, width: 8, height: 8 })), /TEX2D fmt/, 'texture format');
  expectFail(() => lone((q) => { q.emit('CREATE', { id: 1, kind: KIND.RT, fmt: FMT.A8B8G8R8, levels: 1, width: 8, height: 8 });
    q.emit('TARGETS', { color: 1, depth: 0 }); q.emit('RASTER', raster({ fog_mode: 1, fog_flags: 1 }));
    q.emit('SHADER', { id: 2, stage: 1, ir_bytes: FLAT.length }, FLAT); q.emit('LAYOUT', { id: 3, count: 4, stride: 64 }, layoutTail);
    const fv = new Float32Array([vert(0, 0, 0, RED), vert(4, 0, 0, RED), vert(0, 4, 0, RED)].flat());
    const pos = q.arenaAlloc(fv.byteLength); q.arenaView(pos, fv.byteLength).set(new Uint8Array(fv.buffer));
    q.emit('DRAW_UP', { prim: 4, ps: 2, layout: 3, voff: pos, stride: 64, count: 3, vcount: 3 }); }), /fog_flags/, 'fog flags');
  // a failed executor stored the error in the ring
  {
    const q = makeProducer({ ringBytes: 4096, arenaBytes: 4096, memBytes: 1 << 16 });
    const x = new Executor({ getExports: () => e, getMemory: () => memory.buffer });
    q.emit('COPY', {}); // COPY (CAP_COPY) of ids never created
    const r = q.ring();
    assert.throws(() => GS.drain([r], x), /COPY/);
    assert.strictEqual(r.errorCode, CONST.ERR_EXECUTOR);
    x.close();
  }

  // D16 readback: native quantized depth, top-down subrect, padded rows,
  // slot completion, and fail-fast format/kind/pitch/rectangle controls.
  {
    const q = makeProducer({ ringBytes: 4096, arenaBytes: 4096, memBytes: 1 << 16 });
    const x = new Executor({ getExports: () => e, getMemory: () => memory.buffer });
    q.emit('CREATE', { id: 1, kind: KIND.RT, fmt: FMT.A8B8G8R8, levels: 1, width: 4, height: 4 });
    q.emit('CREATE', { id: 2, kind: KIND.DS, fmt: FMT.D16, levels: 1, width: 4, height: 4 });
    q.emit('TARGETS', { color: 1, depth: 2 });
    q.emit('CLEAR', { mask: 2, z: 0.25, left: 0, top: 0, right: 4, bottom: 2 });
    const pos = q.arenaAlloc(24); q.arenaView(pos, 24).fill(0xa5);
    q.emit('READBACK', { rt: 2, x: 1, y: 1, w: 2, h: 2, fmt: FMT.D16, dst: pos, pitch: 6, slot: 2 });
    const ring = q.ring(); GS.drain([ring], x);
    const d = new DataView(q.buffer, q.arenaData + pos, 24);
    assert.strictEqual(d.getUint16(0, true), Math.round(0.25 * 65535));
    assert.strictEqual(d.getUint16(2, true), Math.round(0.25 * 65535));
    assert.strictEqual(d.getUint16(6, true), 65535); assert.strictEqual(d.getUint16(8, true), 65535);
    assert.strictEqual(d.getUint16(4, true), 0xa5a5, 'row padding untouched');
    assert.ok(x.caps().flags & CONST.CAP_DEPTH_READBACK);
    for (let i = 0; i <= 65535; i++)
      assert.strictEqual(Math.round(e.d3d_software_quantize_depth(80, i / 65535) * 65535), i, 'all D16 values round-trip through native f32 storage');
    x.close();
    for (const [over, pattern] of [[{rt:1}, /kind/], [{pitch:3}, /pitch/], [{x:4}, /rect/], [{fmt:FMT.D24S8}, /requires a D24S8/]])
      expectFail(() => lone(q => {
        q.emit('CREATE', { id: 1, kind: KIND.RT, fmt: FMT.A8B8G8R8, levels: 1, width: 4, height: 4 });
        q.emit('CREATE', { id: 2, kind: KIND.DS, fmt: FMT.D16, levels: 1, width: 4, height: 4 });
        q.emit('READBACK', { rt:2, x:0, y:0, w:2, h:2, fmt:FMT.D16, dst:q.arenaAlloc(24), pitch:4, slot:0, ...over });
      }), pattern, 'invalid depth readback');
    console.log('PASS native D16 readback and fail-fast controls');
  }

  // D24S8 readback (CAP_DS_READBACK): packed (depth24 << 8 | stencil8)
  // words, top-down subrect, padded rows, and fail-fast controls.
  {
    const q = makeProducer({ ringBytes: 4096, arenaBytes: 4096, memBytes: 1 << 16 });
    const x = new Executor({ getExports: () => e, getMemory: () => memory.buffer });
    q.emit('CREATE', { id: 1, kind: KIND.RT, fmt: FMT.A8B8G8R8, levels: 1, width: 4, height: 4 });
    q.emit('CREATE', { id: 2, kind: KIND.DS, fmt: FMT.D24S8, levels: 1, width: 4, height: 4 });
    q.emit('TARGETS', { color: 1, depth: 2 });
    q.emit('CLEAR', { mask: 6, z: 0.25, stencil: 0x5a, left: 0, top: 0, right: 4, bottom: 2 });
    q.emit('CLEAR', { mask: 4, z: 0, stencil: 0xc3, left: 2, top: 2, right: 4, bottom: 4 });
    const pos = q.arenaAlloc(40); q.arenaView(pos, 40).fill(0xa5);
    q.emit('READBACK', { rt: 2, x: 1, y: 1, w: 2, h: 2, fmt: FMT.D24S8, dst: pos, pitch: 12, slot: 3 });
    const ring = q.ring(); GS.drain([ring], x);
    const d = new DataView(q.buffer, q.arenaData + pos, 40);
    const q24 = Math.round(0.25 * 0xffffff);
    assert.strictEqual(d.getUint32(0, true) >>> 0, ((q24 << 8) | 0x5a) >>> 0, 'cleared depth + stencil');
    assert.strictEqual(d.getUint32(4, true) >>> 0, ((q24 << 8) | 0x5a) >>> 0);
    assert.strictEqual(d.getUint32(12, true) >>> 0, 0xffffff00, 'untouched: depth 1.0, stencil 0');
    assert.strictEqual(d.getUint32(16, true) >>> 0, 0xffffffc3, 'stencil-only clear keeps depth');
    assert.strictEqual(d.getUint32(8, true) >>> 0, 0xa5a5a5a5, 'row padding untouched');
    assert.ok(x.caps().flags & CONST.CAP_DS_READBACK);
    for (let i = 0; i <= 0xffffff; i += 4093)
      assert.strictEqual(Math.round(e.d3d_software_quantize_depth(75, i / 0xffffff) * 0xffffff), i, 'D24 values round-trip through native f32 storage');
    assert.strictEqual(Math.round(e.d3d_software_quantize_depth(75, 1) * 0xffffff), 0xffffff);
    x.close();
    for (const [ds, over, pattern] of [[FMT.D24S8, {rt:1}, /kind/], [FMT.D24S8, {pitch:7}, /pitch/],
        [FMT.D24S8, {y:3}, /rect/], [FMT.D16, {}, /requires a D24S8/], [FMT.D24S8, {fmt:FMT.D16}, /requires a D16/]])
      expectFail(() => lone(q => {
        q.emit('CREATE', { id: 1, kind: KIND.RT, fmt: FMT.A8B8G8R8, levels: 1, width: 4, height: 4 });
        q.emit('CREATE', { id: 2, kind: KIND.DS, fmt: ds, levels: 1, width: 4, height: 4 });
        q.emit('READBACK', { rt:2, x:0, y:0, w:2, h:2, fmt:FMT.D24S8, dst:q.arenaAlloc(32), pitch:8, slot:0, ...over });
      }), pattern, 'invalid D24S8 readback');
    console.log('PASS native D24S8 depth+stencil readback and fail-fast controls');
  }

  // ── occlusion: a FENCE pair counts the samples that passed between them ──
  {
    const q = makeProducer({ ringBytes: 4096, arenaBytes: 4096, memBytes: 1 << 16 });
    const x = new Executor({ getExports: () => e, getMemory: () => memory.buffer });
    q.emit('CREATE', { id: 1, kind: KIND.RT, fmt: FMT.A8B8G8R8, levels: 1, width: 8, height: 8 });
    q.emit('TARGETS', { color: 1, depth: 0 });
    q.emit('RASTER', raster({ scissor_right: 8, scissor_bottom: 8 }));
    q.emit('SHADER', { id: 2, stage: 1, ir_bytes: FLAT.length }, FLAT); q.emit('LAYOUT', { id: 3, count: 4, stride: 64 }, layoutTail);
    const fv = new Float32Array([vert(0, 0, 0, RED), vert(4, 0, 0, RED), vert(0, 4, 0, RED), vert(4, 0, 0, RED), vert(4, 4, 0, RED), vert(0, 4, 0, RED)].flat());
    const pos = q.arenaAlloc(fv.byteLength); q.arenaView(pos, fv.byteLength).set(new Uint8Array(fv.buffer));
    const dst = q.arenaAlloc(16);
    q.emit('FENCE', { kind: CONST.FENCEK_OCCLUSION_BEGIN, slot: 1 });
    q.emit('DRAW_UP', { prim: 4, ps: 2, layout: 3, voff: pos, stride: 64, count: 6, vcount: 6 });
    q.emit('FENCE', { kind: CONST.FENCEK_OCCLUSION_END, slot: 2, dst });
    GS.drain([q.ring()], x);
    assert.strictEqual(new DataView(q.buffer).getUint32(q.arenaData + dst, true), 16, 'occlusion counts a 4x4 quad');
    assert.ok(x.caps().flags & CONST.CAP_OCCLUSION, 'software advertises occlusion');
    x.close();
  }

  ex.close();

  // ── the shared D1 contract scenario ──
  const d1 = scenario.runD1({ GS, makeProducer, buffer: new SharedArrayBuffer(1 << 22),
    makeExecutor: (onPresent) => new Executor({ getExports: () => e, getMemory: () => memory.buffer, onPresent }) });
  for (const msg of d1.failures) console.log(`FAIL D1 ${msg}`);
  assert.strictEqual(d1.failures.length, 0, `D1 scenario: ${d1.failures.length} of ${d1.checks} checks failed`);
  console.log(`D1 scenario: ${d1.checks}/${d1.checks} checks`);
  // Slice 9.4a features, the same checks the WebGL executor runs.
  const r94 = scenario.run94a({ GS, makeProducer, buffer: new SharedArrayBuffer(1 << 22),
    makeExecutor: (onPresent) => new Executor({ getExports: () => e, getMemory: () => memory.buffer, onPresent }) });
  for (const msg of r94.failures) console.log(`FAIL 9.4a ${msg}`);
  assert.strictEqual(r94.failures.length, 0, `9.4a scenario: ${r94.failures.length} of ${r94.checks} checks failed`);
  console.log(`9.4a scenario: ${r94.checks}/${r94.checks} checks`);
  console.log(`PASS test-gpu-stream-software (${frames.length} presents, ${s.nativeDraws} native draws)`);
})().catch((error) => {
  console.error('FAIL test-gpu-stream-software:', error && error.stack || error);
  process.exit(1);
});
