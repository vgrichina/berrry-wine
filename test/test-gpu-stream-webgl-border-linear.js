'use strict';
// tl;dr: BORDER addressing with linear filtering (GPS_CAP_BORDER_LINEAR) on
// the WebGL executor. GL has no border wrap mode, so the executor filters
// such samplers in the fragment shader from exact texel fetches; this draws
// the same stream on the WebGL executor (headless GL) and on the software
// executor (the native VM, the reference) and compares every pixel. GL_CLAMP
// with GL_LINEAR lowers to exactly this (09a8gt-gl-gps.wat $glg_addr), and
// without the cap Hexen II declined every frame with reason 10.
//
// Cases, each a full-target quad whose texcoords run past [0, 1]:
//   magnified, both axes border, min = mag = linear
//   border u + wrap v, and mirror u + border v
//   min point / mag linear magnified, and min linear / mag point minified
//   minified through linear-filtered mips (mip 2) and point mips (mip 1)
//   an RT bound as the texture (stored bottom-up)
//
//   node test/test-gpu-stream-webgl-border-linear.js
//
// Skips (exit 0) when headless GL is unavailable.

const path = require('path');
const ROOT = path.join(__dirname, '..');
const hgl = require(path.join(ROOT, 'lib', 'headless-gl'));
if (!hgl.available()) {
  console.log(`SKIP test-gpu-stream-webgl-border-linear: ${hgl.unavailableReason()}`);
  process.exit(0);
}
const GS = require(path.join(ROOT, 'lib', 'gpu-stream'));
const { makeProducer } = require('./gpu-stream-fixture');
const { bootRenderHarness } = require('./render-helper');
const { createCanvas } = require(path.join(ROOT, 'lib', 'canvas-compat'));
const { WebGLBackend } = require(path.join(ROOT, 'lib', 'gpu-backend'));
const WebGL = require(path.join(ROOT, 'lib', 'gpu-stream-webgl'));
const Software = require(path.join(ROOT, 'lib', 'gpu-stream-software'));
const { TEX_IR, irShader } = require('./gpu-stream-webgl-scenario');

const { CONST } = GS;
const W = 64, H = 64;
const TOL = 3; // per channel: 8-bit texels, two float filter paths
let checks = 0;
const failures = [];
const check = (name, ok, detail) => { checks++; if (!ok) failures.push(`${name}${detail ? `: ${detail}` : ''}`); };

const ID = { RT: 1, LAYOUT: 2, TEX: 3, SMALL: 4, BIG: 5, SRC: 6, FLAT: 7, FIRST_SAMPLER: 20 };
const S = 28; // POSITIONT f4 @0, COLOR0 D3DCOLOR @16, TEXCOORD0 f2 @20
const B = CONST.ADDR_BORDER, WR = CONST.ADDR_WRAP, MI = CONST.ADDR_MIRROR;
const BORDER = 0xff00ffff; // yellow, opaque (R | G<<8 | B<<16 | A<<24)
const CASES = [
  { name: 'magnified, border/border, linear', tex: ID.SMALL, u: B, v: B, min: 2, mag: 2, mip: 0, uv: [-0.5, 1.5] },
  { name: 'border u, wrap v, linear', tex: ID.SMALL, u: B, v: WR, min: 2, mag: 2, mip: 0, uv: [-0.75, 1.25] },
  { name: 'mirror u, border v, linear', tex: ID.SMALL, u: MI, v: B, min: 2, mag: 2, mip: 0, uv: [-0.6, 1.9] },
  { name: 'magnified, min point / mag linear', tex: ID.SMALL, u: B, v: B, min: 1, mag: 2, mip: 0, uv: [-0.5, 1.5] },
  { name: 'minified, min linear / mag point', tex: ID.BIG, u: B, v: B, min: 2, mag: 1, mip: 0, uv: [-0.5, 2.5] },
  { name: 'minified, linear mips', tex: ID.BIG, u: B, v: B, min: 2, mag: 2, mip: 2, uv: [-0.5, 2.5] },
  { name: 'minified, point mips, bias 0.4', tex: ID.BIG, u: B, v: B, min: 2, mag: 2, mip: 1, bias: 0.4, uv: [-0.5, 2.5] },
  { name: 'RT texture, border/border, linear', tex: ID.SRC, u: B, v: B, min: 2, mag: 2, mip: 0, uv: [-0.5, 1.5] },
];

// Deterministic texel colours, distinct per level.
const texels = (n, salt) => {
  const t = new Uint8Array(n * n * 4);
  for (let i = 0; i < n * n; i++) {
    const h = Math.imul(i + 1, 2654435761) ^ Math.imul(salt + 7, 40503);
    t.set([h & 255, (h >>> 8) & 255, (h >>> 16) & 255, 255], i * 4);
  }
  return t;
};

// Draw the whole scene on one executor; returns [{name, w, px}] per case.
function scene(makeExecutor) {
  const frames = [];
  const ex = makeExecutor((f) => frames.push({ w: f.width, h: f.height, px: Uint8Array.from(f.pixels) }));
  const p = makeProducer({ ringBytes: 1 << 16, arenaBytes: 1 << 20, buffer: new SharedArrayBuffer(1 << 22) });
  const ring = p.ring();
  const emit = (op, fields, tail) => p.emit(op, fields, tail);
  const put = (bytes) => { const pos = p.arenaAlloc(bytes.length); p.arenaView(pos, bytes.length).set(bytes); return pos; };
  const reclaim = () => p.store('arena_tail', p.load('arena_head'));
  const i32s = (...v) => new Uint8Array(new Int32Array(v).buffer);
  const drain = () => { GS.drain([ring], ex); reclaim(); };
  const elems = new Uint8Array(3 * 8), edv = new DataView(elems.buffer);
  [[CONST.USAGE_POSITIONT, CONST.VTYPE_FLOAT4, 0], [CONST.USAGE_COLOR, CONST.VTYPE_D3DCOLOR, 16],
    [CONST.USAGE_TEXCOORD, CONST.VTYPE_FLOAT2, 20]].forEach(([usage, type, offset], i) => {
    edv.setUint8(i * 8 + 1, type); edv.setUint8(i * 8 + 2, usage); edv.setUint16(i * 8 + 4, offset, true);
  });
  // Full-target quad (pixel centres at integers, so edges at -0.5 / 63.5).
  const quad = (ps, uv0, uv1, argb = 0xffffffff) => {
    const e0 = -0.5, e1 = W - 0.5;
    const v = [[e0, e0, uv0, uv0], [e1, e0, uv1, uv0], [e0, e1, uv0, uv1], [e1, e0, uv1, uv0], [e1, e1, uv1, uv1], [e0, e1, uv0, uv1]];
    const out = new Uint8Array(v.length * S), dv = new DataView(out.buffer);
    v.forEach(([x, y, s, t], i) => {
      dv.setFloat32(i * S, x, true); dv.setFloat32(i * S + 4, y, true); dv.setFloat32(i * S + 8, 0.5, true);
      dv.setFloat32(i * S + 12, 1, true); dv.setUint32(i * S + 16, argb >>> 0, true);
      dv.setFloat32(i * S + 20, s, true); dv.setFloat32(i * S + 24, t, true);
    });
    emit('DRAW_UP', { prim: CONST.PRIM_TRIANGLELIST, vs: 0, ps, layout: ID.LAYOUT, voff: put(out), stride: S,
      index_size: 0, ioff: 0, count: v.length, vcount: v.length });
  };
  // linear 1 (rhw is 1, so the varyings are the same): a perspective draw's
  // WebGL rasterization is lifted 1/16 px (Y_CENTRE), which moves every
  // varying by that much against the software executor; that is a raster
  // property, not the filter under test.
  const target = (rt, w, h) => {
    emit('TARGETS', { color: rt, depth: 0 });
    emit('RASTER', { depth_mode: 0, zfunc: 8, zwrite: 0, cull: 1, blend: 0, src_rgb: 2, dst_rgb: 1, src_alpha: 2,
      dst_alpha: 1, blend_op: 1, blend_op_alpha: 1, alpha_func: 8, alpha_ref: 0, colormask: 15, fill: 3, linear: 1,
      scissor_left: 0, scissor_top: 0, scissor_right: w, scissor_bottom: h });
  };
  try {
    emit('CREATE', { id: ID.RT, kind: CONST.KIND_RT, fmt: CONST.FMT_A8B8G8R8, levels: 1, width: W, height: H });
    emit('CREATE', { id: ID.SRC, kind: CONST.KIND_RT, fmt: CONST.FMT_A8B8G8R8, levels: 1, width: 4, height: 4 });
    emit('LAYOUT', { id: ID.LAYOUT, count: 3, stride: S }, elems);
    emit('SHADER', { id: ID.TEX, stage: 1, ir_bytes: TEX_IR.length }, TEX_IR);
    const FLAT_IR = irShader([[1, 0x801F0000, 0x90E40000]]); // mov_sat r0, v0
    emit('SHADER', { id: ID.FLAT, stage: 1, ir_bytes: FLAT_IR.length }, FLAT_IR);
    emit('CREATE', { id: ID.SMALL, kind: CONST.KIND_TEX2D, fmt: CONST.FMT_A8B8G8R8, levels: 1, width: 4, height: 4 });
    const small = texels(4, 0);
    emit('UPLOAD', { id: ID.SMALL, level: 0, x: 0, y: 0, w: 4, h: 4, pitch: 16, src: put(small), bytes: small.length });
    emit('CREATE', { id: ID.BIG, kind: CONST.KIND_TEX2D, fmt: CONST.FMT_A8B8G8R8, levels: 6, width: 32, height: 32 });
    for (let lvl = 0, n = 32; n >= 1; lvl++, n >>= 1) {
      const t = texels(n, lvl + 1);
      emit('UPLOAD', { id: ID.BIG, level: lvl, x: 0, y: 0, w: n, h: n, pitch: n * 4, src: put(t), bytes: t.length });
    }
    // The 4 x 4 RT source: four flat bands, top row red (t = 0 is the top).
    target(ID.SRC, 4, 4);
    emit('CLEAR', { mask: 1, colormask: 15, rgba: 0xff0000ff, z: 1, left: 0, top: 0, right: 4, bottom: 1 });
    emit('CLEAR', { mask: 1, colormask: 15, rgba: 0xff00ff00, z: 1, left: 0, top: 1, right: 4, bottom: 2 });
    emit('CLEAR', { mask: 1, colormask: 15, rgba: 0xffff0000, z: 1, left: 0, top: 2, right: 4, bottom: 3 });
    emit('CLEAR', { mask: 1, colormask: 15, rgba: 0xffffffff, z: 1, left: 2, top: 3, right: 4, bottom: 4 });
    emit('CLEAR', { mask: 1, colormask: 15, rgba: 0xff000000, z: 1, left: 0, top: 3, right: 2, bottom: 4 });
    CASES.forEach((c, k) => {
      emit('SAMPLER', { id: ID.FIRST_SAMPLER + k, address_u: c.u, address_v: c.v, min: c.min, mag: c.mag, mip: c.mip,
        lod_bias: c.bias || 0, border: BORDER });
    });
    drain();
    CASES.forEach((c, k) => {
      target(ID.RT, W, H);
      emit('CLEAR', { mask: 1, colormask: 15, rgba: 0xff404040, z: 1, left: 0, top: 0, right: W, bottom: H });
      emit('BIND', { count: 1 }, i32s(0, c.tex, ID.FIRST_SAMPLER + k));
      quad(ID.TEX, c.uv[0], c.uv[1]);
      emit('PRESENT', { rt: ID.RT, x: 0, y: 0, w: W, h: H, surface: 0x77, stamp: k + 1 });
      drain();
    });
  } finally {
    if (ex.close) ex.close();
  }
  return frames;
}

(async () => {
  let gl, soft;
  try {
    const canvas = createCanvas(W, H);
    const backend = new WebGLBackend(canvas);
    const glEx = (onPresent) => new WebGL.Executor({ canvas, backend, onPresent });
    check('WebGL executor advertises BORDER_LINEAR',
      !!(new WebGL.Executor({ canvas, backend }).caps().flags & CONST.CAP_BORDER_LINEAR));
    gl = scene(glEx);
  } catch (e) {
    failures.push(`WebGL executor threw: ${e.message || e}`);
  }
  try {
    const { exports: e, memory } = await bootRenderHarness({ fonts: 'none' });
    soft = scene((onPresent) => new Software.Executor({ getExports: () => e, getMemory: () => memory.buffer, onPresent }));
  } catch (e) {
    failures.push(`software executor threw: ${e.stack || e}`);
  }
  if (gl && soft) {
    check('frame count', gl.length === CASES.length && soft.length === CASES.length, `${gl.length} / ${soft.length}`);
    const at = (f, x, y) => Array.from(f.px.subarray((y * f.w + x) * 4, (y * f.w + x) * 4 + 3));
    const yellow = [255, 255, 0];
    CASES.forEach((c, k) => {
      const a = gl[k], b = soft[k];
      if (!a || !b) return;
      let bad = 0, worst = 0, where = '';
      for (let i = 0; i < a.px.length; i++) {
        const d = Math.abs(a.px[i] - b.px[i]);
        if (d > worst) { worst = d; where = `${(i >> 2) % W},${Math.floor((i >> 2) / W)}`; }
        if (d > TOL && (i & 3) !== 3) bad++;
      }
      check(`${c.name}: WebGL matches software within ${TOL}`, bad === 0, `${bad} channels differ, worst ${worst} at ${where}`);
      // Every case reaches the border colour in a corner, unfiltered.
      const corner = c.u === B && c.v === B ? at(a, 0, 0) : null;
      if (corner) check(`${c.name}: corner is the border colour`, corner.every((v, i) => Math.abs(v - yellow[i]) <= 1), `got ${corner}`);
      // ...and is not just border: uv (0.5, 0.5) carries texture.
      const m = Math.round((0.5 - c.uv[0]) / (c.uv[1] - c.uv[0]) * W - 0.5);
      const mid = at(a, m, m);
      check(`${c.name}: uv 0.5 is texture`, !mid.every((v, i) => Math.abs(v - yellow[i]) <= 1), `got ${mid}`);
    });
  }
  for (const f of failures) console.log(`FAIL ${f}`);
  if (failures.length) { console.log(`FAIL test-gpu-stream-webgl-border-linear: ${failures.length}/${checks} checks failed`); process.exit(1); }
  console.log(`PASS test-gpu-stream-webgl-border-linear: ${checks}/${checks} checks`);
  process.exit(0);
})();
