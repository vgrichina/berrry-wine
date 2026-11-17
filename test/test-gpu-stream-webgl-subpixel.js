'use strict';
// tl;dr: the WebGL executor's top-left fill rule must survive a GPU that
// snaps vertices to 4 subpixel bits (GL ES's minimum; SwiftShader, so every
// browser without a GPU). A perspective (linear 0) draw lifts y by a fraction
// of a pixel so an edge exactly on a pixel centre goes to the tile below
// (D3D) rather than the one above (GL). Headless GL here keeps more bits, so
// this test snaps the window y of every vertex to 1/16 px in the vertex
// shader, then draws two 1:1 point-sampled WRAP tiles meeting at y = 32 (a
// pixel centre), as Heretic II's main-menu book does. Row 32 must be the
// lower tile's first texel row; a lift the snap rounds away (1/128 px before
// 2026-11-16) gives it to the upper tile at v = 1, which wraps to that tile's
// first row: a 1 px dark seam.
//
//   node test/test-gpu-stream-webgl-subpixel.js
//
// Skips (exit 0) when headless GL is unavailable.

const path = require('path');
const ROOT = path.join(__dirname, '..');
const hgl = require(path.join(ROOT, 'lib', 'headless-gl'));
if (!hgl.available()) {
  console.log(`SKIP test-gpu-stream-webgl-subpixel: ${hgl.unavailableReason()}`);
  process.exit(0);
}
const GS = require(path.join(ROOT, 'lib', 'gpu-stream'));
const { makeProducer } = require('./gpu-stream-fixture');
const { createCanvas } = require(path.join(ROOT, 'lib', 'canvas-compat'));
const { WebGLBackend } = require(path.join(ROOT, 'lib', 'gpu-backend'));
const { Executor } = require(path.join(ROOT, 'lib', 'gpu-stream-webgl'));
const { TEX_IR } = require('./gpu-stream-webgl-scenario');

const { CONST } = GS;
const W = 64, H = 64;
let checks = 0;
const failures = [];
const check = (name, ok, detail) => { checks++; if (!ok) failures.push(`${name}${detail ? `: ${detail}` : ''}`); };

const canvas = createCanvas(W, H);
const backend = new WebGLBackend(canvas);
// Emulate a 4-subpixel-bit rasterizer: round each vertex's window y (rows
// down from the top) to 1/16 px. Exact for the w = 1 draws below.
const createProgram = backend.createProgram.bind(backend);
const ANCHOR = 'gl_Position=vec4(ndc*W,';
let snapped = 0;
backend.createProgram = (vs, ...rest) => {
  if (vs.includes(ANCHOR)) {
    snapped++;
    vs = vs.replace(ANCHOR, 'ndc.y=1.0-floor((1.0-ndc.y)*gps_target.y*8.0+0.5)/(gps_target.y*8.0);' + ANCHOR);
  }
  return createProgram(vs, ...rest);
};

let frame = null;
const ex = new Executor({ canvas, backend, onPresent: (f) => { frame = { w: f.width, px: Uint8Array.from(f.pixels) }; } });
const p = makeProducer({ ringBytes: 1 << 16, arenaBytes: 1 << 20, buffer: new SharedArrayBuffer(1 << 22) });
const ring = p.ring();
const emit = (op, fields, tail) => p.emit(op, fields, tail);
const put = (bytes) => { const pos = p.arenaAlloc(bytes.length); p.arenaView(pos, bytes.length).set(bytes); return pos; };
const i32s = (...v) => new Uint8Array(new Int32Array(v).buffer);
const px = (x, y) => Array.from(frame.px.subarray((y * frame.w + x) * 4, (y * frame.w + x) * 4 + 4));

const ID = { RT: 1, LAYOUT: 2, TEX: 3, WRAP: 4, UPPER: 5, LOWER: 6 };
const S = 28; // POSITIONT f4 @0, COLOR0 D3DCOLOR @16, TEXCOORD0 f2 @20
const elems = new Uint8Array(3 * 8), edv = new DataView(elems.buffer);
[[CONST.USAGE_POSITIONT, CONST.VTYPE_FLOAT4, 0], [CONST.USAGE_COLOR, CONST.VTYPE_D3DCOLOR, 16],
  [CONST.USAGE_TEXCOORD, CONST.VTYPE_FLOAT2, 20]].forEach(([usage, type, offset], i) => {
  edv.setUint8(i * 8 + 1, type); edv.setUint8(i * 8 + 2, usage); edv.setUint16(i * 8 + 4, offset, true);
});
// A quad from y0 to y1 (contract y: pixel centres at integers), v 0..1.
const quad = (y0, y1) => {
  const v = [[0, y0, 0, 0], [W, y0, 1, 0], [0, y1, 0, 1], [W, y0, 1, 0], [W, y1, 1, 1], [0, y1, 0, 1]];
  const out = new Uint8Array(v.length * S), dv = new DataView(out.buffer);
  v.forEach(([x, y, s, t], i) => {
    dv.setFloat32(i * S, x, true); dv.setFloat32(i * S + 4, y, true); dv.setFloat32(i * S + 8, 0.5, true);
    dv.setFloat32(i * S + 12, 1, true); dv.setUint32(i * S + 16, 0xffffffff, true);
    dv.setFloat32(i * S + 20, s, true); dv.setFloat32(i * S + 24, t, true);
  });
  emit('DRAW_UP', { prim: CONST.PRIM_TRIANGLELIST, vs: 0, ps: ID.TEX, layout: ID.LAYOUT, voff: put(out), stride: S,
    index_size: 0, ioff: 0, count: v.length, vcount: v.length });
};
// A 4 x 32 tile: first row `first`, the rest `rest` (A8B8G8R8 bytes).
const tile = (id, first, rest) => {
  emit('CREATE', { id, kind: CONST.KIND_TEX2D, fmt: CONST.FMT_A8B8G8R8, levels: 1, width: 4, height: 32 });
  const t = new Uint8Array(4 * 32 * 4);
  for (let i = 0; i < 4 * 32; i++) t.set(i < 4 ? first : rest, i * 4);
  emit('UPLOAD', { id, level: 0, x: 0, y: 0, w: 4, h: 32, pitch: 16, src: put(t), bytes: t.length });
};

const BLACK = [0, 0, 0, 255], RED = [255, 0, 0, 255], GREEN = [0, 255, 0, 255];
try {
  emit('CREATE', { id: ID.RT, kind: CONST.KIND_RT, fmt: CONST.FMT_A8B8G8R8, levels: 1, width: W, height: H });
  emit('LAYOUT', { id: ID.LAYOUT, count: 3, stride: S }, elems);
  emit('SHADER', { id: ID.TEX, stage: 1, ir_bytes: TEX_IR.length }, TEX_IR);
  emit('SAMPLER', { id: ID.WRAP, address_u: CONST.ADDR_WRAP, address_v: CONST.ADDR_WRAP, min: 1, mag: 1, mip: 0 });
  emit('TARGETS', { color: ID.RT, depth: 0 });
  emit('RASTER', { depth_mode: 0, zfunc: 8, zwrite: 0, cull: 1, blend: 0, src_rgb: 2, dst_rgb: 1, src_alpha: 2,
    dst_alpha: 1, blend_op: 1, blend_op_alpha: 1, alpha_func: 8, alpha_ref: 0, colormask: 15, fill: 3, linear: 0,
    scissor_left: 0, scissor_top: 0, scissor_right: W, scissor_bottom: H });
  emit('CLEAR', { mask: 1, colormask: 15, rgba: 0xffff00ff, z: 1, left: 0, top: 0, right: W, bottom: H });
  tile(ID.UPPER, BLACK, RED);
  tile(ID.LOWER, GREEN, GREEN);
  emit('BIND', { count: 1 }, i32s(0, ID.UPPER, ID.WRAP));
  quad(0, 32);
  emit('BIND', { count: 1 }, i32s(0, ID.LOWER, ID.WRAP));
  quad(32, 64);
  emit('PRESENT', { rt: ID.RT, x: 0, y: 0, w: W, h: H, surface: 0x77, stamp: 1 });
  GS.drain([ring], ex);
  check('vertex snapping injected', snapped > 0, 'executor VS anchor not found');
  check('presented', !!frame);
  if (frame) {
    for (const x of [0, 31, 63]) {
      const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) <= 2);
      check(`row 0 is the upper tile's first texel @x=${x}`, near(px(x, 0), BLACK), `got ${px(x, 0)}`);
      check(`row 31 is the upper tile @x=${x}`, near(px(x, 31), RED), `got ${px(x, 31)}`);
      check(`row 32 (edge on a pixel centre) is the lower tile @x=${x}`, near(px(x, 32), GREEN), `got ${px(x, 32)}`);
      check(`row 63 is the lower tile @x=${x}`, near(px(x, 63), GREEN), `got ${px(x, 63)}`);
    }
  }
} catch (e) {
  failures.push(`threw: ${e.stack || e}`);
} finally {
  if (ex.close) ex.close();
}
for (const f of failures) console.log(`FAIL ${f}`);
if (failures.length) { console.log(`FAIL test-gpu-stream-webgl-subpixel: ${failures.length}/${checks} checks failed`); process.exit(1); }
console.log(`PASS test-gpu-stream-webgl-subpixel: ${checks}/${checks} checks`);
