'use strict';
// tl;dr: GPU stream v2 slice 9.4b equivalence. D3D9 vertex shader bytecode
// (vs_1_1 with DCLs and vs_2_0) is validated and canonicalized to core vertex
// IR in WAT (09af1), then drawn as one point per pixel on BOTH executors --
// software (09ag VM) and WebGL (GLSL from lib/d3d9-shader.js compileCoreVS) --
// and on the old D3D9 transport (guest bytecode: d3d9-software-backend's
// guest-profile VM and d3d9-backend's JS compileIR translation). Every output
// (oPos, oD0-1, oT0-7, oFog) is read back through a pixel shader that copies
// it, and the four pictures must agree within 1 per channel. Also: DRAW from
// VBUF/IBUF (16- and 32-bit indices, byte offsets = base vertex/start index)
// equals DRAW_UP; sampler-naming PS IR 0xffff0200 reaches s6/s7 on WebGL and
// is refused (caps: 6) on software; truthful caps; canonicalizer declines.
// Without headless GL the software/old-software half still runs.
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const GS = require('../lib/gpu-stream');
const { makeProducer, packLayout } = require('./gpu-stream-fixture');
const { bootRenderHarness } = require('./render-helper');
const SW = require('../lib/gpu-stream-software');
const IR = require('../lib/d3d-shader-ir');
const { Device: SoftDevice } = require('../lib/d3d9-software-backend');
const hgl = require('../lib/headless-gl');

const { KIND, FMT, CONST } = GS;
const W = 16, H = 16, N = W * H;

// ── D3D9 bytecode assembler (tokens per the D3D9 shader format) ──
const T = { r: 0, v: 1, c: 2, a: 3, rast: 4, attr: 5, tex: 6 };
const regBits = (type, n) => (((type & 7) << 28) | (((type >> 3) & 3) << 11) | n) >>> 0;
const D = (type, n, mask = 15, sat = 0) => (0x80000000 | regBits(type, n) | (mask << 16) | (sat << 20)) >>> 0;
const SWZ = (s) => [...s.padEnd(4, s[s.length - 1])].reduce((a, ch, i) => a | ('xyzw'.indexOf(ch) << (2 * i)), 0);
const S = (type, n, swz = 'xyzw', neg = 0, rel = 0) => (0x80000000 | regBits(type, n) | (SWZ(swz) << 16) | (neg << 24) | (rel << 13)) >>> 0;
function assemble(version, body) {
  const vs20 = version === 0xfffe0200, out = [version];
  for (const [op, ...tokens] of body) out.push(vs20 ? (op | (tokens.length << 24)) >>> 0 : op, ...tokens);
  out.push(0xffff);
  return new Uint32Array(out);
}
const f2u = (x) => new Uint32Array(new Float32Array([x]).buffer)[0];
const dcl = (usage, index, reg) => [31, (0x80000000 | usage | (index << 16)) >>> 0, D(T.v, reg)];
const def = (n, xyzw) => [81, D(T.c, n), ...xyzw.map(f2u)];
// Inputs: v0 POSITION, v1 TEXCOORD0 (A), v2 TEXCOORD1 (B), v3 COLOR0 (D3DCOLOR).
// vs_1_1 reads one v# and one c# per instruction: v2/v3 are copied to
// r10/r11 and the output bias c1 to r9 first.
const DCLS = [dcl(0, 0, 0), dcl(5, 0, 1), dcl(5, 1, 2), dcl(10, 0, 3),
  [1, D(T.r, 9), S(T.c, 1)], [1, D(T.r, 10), S(T.v, 2)], [1, D(T.r, 11), S(T.v, 3)]];
// Map a result into colour range: out = r * c0 + c1 (c0 = .25, c1 = .5).
const OUT = (dst, r) => [4, dst, S(T.r, r), S(T.c, 0), S(T.r, 9)];
const OUTS = [D(T.attr, 0), D(T.attr, 1), ...[0, 1, 2, 3, 4, 5].map((k) => D(T.tex, k))];
const OUT_NAMES = ['oD0', 'oD1', 'oT0', 'oT1', 'oT2', 'oT3', 'oT4', 'oT5'];
const pos = [1, D(T.rast, 0), S(T.v, 0)];

const SHADERS = {
  // vs_1_1 arithmetic.
  arith: assemble(0xfffe0101, [...DCLS, pos,
    [2, D(T.r, 0), S(T.v, 1), S(T.r, 10)],
    [3, D(T.r, 1), S(T.v, 1), S(T.r, 10, 'wzyx')],
    [5, D(T.r, 2), S(T.v, 1), S(T.r, 10, 'yxwz', 1)],
    [4, D(T.r, 3), S(T.v, 1), S(T.r, 10), S(T.c, 2)],
    [10, D(T.r, 4), S(T.v, 1), S(T.r, 10)],
    [11, D(T.r, 5, 3), S(T.v, 1), S(T.r, 10)], [1, D(T.r, 5, 12), S(T.r, 11)],
    [12, D(T.r, 6), S(T.v, 1), S(T.r, 10)],
    [13, D(T.r, 7), S(T.v, 1), S(T.r, 10, 'zwxy')],
    ...OUTS.map((d, k) => OUT(d, k))]),
  // vs_1_1 scalar and macro ops: rcp rsq exp log expp logp frc lit dst.
  scalar: assemble(0xfffe0101, [...DCLS, pos,
    [6, D(T.r, 0, 1), S(T.v, 1, 'x')], [7, D(T.r, 0, 2), S(T.v, 1, 'y')],
    [14, D(T.r, 0, 4), S(T.r, 10, 'z')], [15, D(T.r, 0, 8), S(T.r, 10, 'w')],
    [78, D(T.r, 1), S(T.r, 10, 'x')],
    [79, D(T.r, 2), S(T.v, 1, 'y')],
    [19, D(T.r, 3, 3), S(T.r, 10)], [1, D(T.r, 3, 12), S(T.v, 1)],
    [16, D(T.r, 4), S(T.v, 1)],
    [16, D(T.r, 5), S(T.r, 10, 'yxzw')],
    [17, D(T.r, 6), S(T.v, 1), S(T.r, 10)],
    [1, D(T.r, 7), S(T.r, 11, 'wzyx')],
    ...OUTS.map((d, k) => OUT(d, k))]),
  // vs_1_1 matrices: m4x4 position (w = 2) and m3x3/m4x3/m3x4/m3x2, dp3/dp4.
  matrix: assemble(0xfffe0101, [...DCLS,
    [20, D(T.rast, 0), S(T.v, 0), S(T.c, 4)],
    [23, D(T.r, 0, 7), S(T.v, 1), S(T.c, 8)], [1, D(T.r, 0, 8), S(T.r, 10)],
    [21, D(T.r, 1, 7), S(T.r, 10), S(T.c, 8)], [1, D(T.r, 1, 8), S(T.v, 1)],
    [22, D(T.r, 2), S(T.v, 1), S(T.c, 8)],
    [24, D(T.r, 3, 3), S(T.r, 10), S(T.c, 9)], [1, D(T.r, 3, 12), S(T.v, 1)],
    [8, D(T.r, 4), S(T.v, 1), S(T.r, 10)],
    [9, D(T.r, 5), S(T.v, 1), S(T.c, 10)],
    [1, D(T.r, 6), S(T.r, 11)], [1, D(T.r, 7), S(T.r, 10, 'w')],
    ...OUTS.map((d, k) => OUT(d, k))]),
  // vs_1_1 a0: MOV a0.x floors; c[a0.x + n] in range, out of range (zero)
  // and onto a DEF'd constant.
  address: assemble(0xfffe0101, [...DCLS, def(20, [0.75, -1, 1.5, 0.25]), pos,
    [1, D(T.a, 0, 1), S(T.v, 1, 'x')],
    [1, D(T.r, 0), S(T.c, 12, 'xyzw', 0, 1)],
    [1, D(T.r, 1), S(T.c, 14, 'wzyx', 1, 1)],
    [1, D(T.a, 0, 1), S(T.r, 10, 'y')],
    [1, D(T.r, 2), S(T.c, 16, 'xyzw', 0, 1)],
    [2, D(T.r, 3), S(T.c, 18, 'xyzw', 0, 1), S(T.v, 1)],
    [1, D(T.r, 4), S(T.c, 20)],
    [1, D(T.r, 5), S(T.v, 1)], [1, D(T.r, 6), S(T.r, 10)], [1, D(T.r, 7), S(T.r, 11)],
    ...OUTS.map((d, k) => OUT(d, k))]),
  // vs_2_0: mova (nearest-even) + a0.y relative, pow crs abs nrm lrp sge slt
  // expp (full precision) logp sat, oFog.
  vs20: assemble(0xfffe0200, [...DCLS, pos,
    [46, D(T.a, 0, 3), S(T.v, 1, 'xz')],
    [1, D(T.r, 0), S(T.c, 12, 'xyzw', 0, 1), S(T.a, 0, 'y')],
    [2, D(T.r, 0, 3), S(T.r, 0), S(T.c, 14, 'xyzw', 0, 1), S(T.a, 0, 'x')],
    [32, D(T.r, 1, 1), S(T.r, 10, 'x', 0, 0), S(T.v, 1, 'y')], [1, D(T.r, 1, 14), S(T.r, 10)],
    [35, D(T.r, 2), S(T.v, 1)], [33, D(T.r, 2, 7), S(T.v, 1), S(T.r, 10)],
    [36, D(T.r, 3, 7), S(T.v, 1)], [1, D(T.r, 3, 8), S(T.r, 10)],
    [18, D(T.r, 4), S(T.r, 11), S(T.v, 1), S(T.r, 10)],
    [13, D(T.r, 5, 3), S(T.v, 1), S(T.r, 10)], [12, D(T.r, 5, 12), S(T.v, 1), S(T.r, 10)],
    [78, D(T.r, 6, 1), S(T.v, 1, 'z')], [79, D(T.r, 6, 2), S(T.r, 10, 'w')], [1, D(T.r, 6, 12), S(T.r, 11)],
    [1, D(T.r, 7, 15, 1), S(T.v, 1)],
    [1, D(T.rast, 1, 1), S(T.r, 11, 'z')],
    ...OUTS.map((d, k) => OUT(d, k))]),
};
const VS20_ADDRESS = true;

// Per-pixel inputs: deterministic, chosen away from the singular points
// (rcp/rsq/log of ~0, pow of a negative base) where D3D is undefined.
function inputs(seed) {
  let s = seed >>> 0;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const away = (lo, hi) => { const v = lo + (hi - lo) * rnd(); return Math.abs(v) < 0.25 ? 0.25 + v : v; };
  const rows = [];
  for (let i = 0; i < N; i++) {
    const px = i % W, py = (i / W) | 0;
    const A = [away(-2, 2), Math.abs(away(-2, 2)), away(-2, 2), away(-2, 2)];
    const B = [Math.abs(away(-2, 2)), away(-2, 2), away(-2, 2), Math.abs(away(-2, 2))];
    // a0 addressing: v1.x spans -3..12 (some out of range), v2.y -2..8.
    A[0] = -3 + 15 * rnd(); B[1] = -2 + 10 * rnd();
    if (i % 7 === 0) A[0] = 6.5;  // a nearest-even tie for MOVA (vs_2_0)
    if (i % 11 === 0) A[2] = 3.5;
    const color = [(rnd() * 256) | 0, (rnd() * 256) | 0, (rnd() * 256) | 0, (rnd() * 256) | 0];
    rows.push({ pos: [px * 2 / W - 1, 1 - py * 2 / H, 0.25 + 0.5 * rnd(), 1], A, B, color });
  }
  return rows;
}
const STRIDE = 16 * 3 + 4;
function vertexBytes(rows) {
  const out = new Uint8Array(rows.length * STRIDE), dv = new DataView(out.buffer);
  rows.forEach((r, i) => {
    const at = i * STRIDE;
    [...r.pos, ...r.A, ...r.B].forEach((v, k) => dv.setFloat32(at + k * 4, v, true));
    r.color.forEach((b, k) => dv.setUint8(at + 48 + k, b));  // B,G,R,A bytes
  });
  return out;
}
const ELEMS = [[3, 0, 0, 0], [3, 5, 0, 16], [3, 5, 1, 32], [4, 10, 0, 48]];
// Constants: c0/c1 output scale/bias, c2 a mad addend, c4..7 the position
// matrix (w = 2), c8..11 a general matrix, c12..19 address targets.
function vconsts() {
  const c = new Float32Array(256 * 4);
  c.set([0.25, 0.25, 0.25, 0.25, 0.5, 0.5, 0.5, 0.5, 0.5, -0.25, 1, -1], 0);
  // m4x4 rows are dp4 against c4..c7: (2x, 2y, 2z, 2w).
  c.set([2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2], 16);
  c.set([0.5, -0.25, 0.75, 0.1, 0.3, 0.6, -0.4, 0.2, -0.7, 0.2, 0.1, 0.9, 0.25, 0.5, -0.5, 1], 32);
  for (let k = 12; k < 20; k++) c.set([(k - 12) / 8, 1 - (k - 12) / 8, ((k * 3) % 8) / 8, 0.5 + (k % 3) / 4], k * 4);
  for (let k = 20; k < 40; k++) c.set([((k * 5) % 9) / 9, ((k * 7) % 11) / 11, 0.3, 0.6], k * 4);
  return c;
}

// ── core IR helpers ──
function coreIR(version, stage, flags, instructions) {
  const bytes = new Uint8Array(32 + instructions.length * 128), u = new Uint32Array(bytes.buffer);
  u.set([0x44534952, 1, stage, version, instructions.length, instructions.length + 2, bytes.length, flags]);
  instructions.forEach(([op, ...args], i) => {
    const at = 8 + i * 32;
    u.set([op, i + 1, args.length, 0], at);
    args.forEach((a, j) => u.set(a, at + 4 + j * 4));
  });
  return bytes;
}
// PS 0xffff0200 core (sampler-naming ABI): mov r0, <bank:index>.
const copyPS = (bank, index) => coreIR(0xffff0200, 1, 8, [[1, [0, 0, 15, 0], [bank, index, 228, 0]]]);
// texld r0, t0, s<n>; the coordinate is a vertex output.
const texPS = (n) => coreIR(0xffff0200, 1, 8, [[66, [0, 0, 15, 0], [3, 0, 228, 0], [10, n, 2, 0]]]);
const OUT_PS = [[1, 0], [1, 1], [3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [3, 5]];

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ fonts: 'none',
    extraWat: '(export "compile20" (func $d3d_shader_ir_compile20))' });
  const getMemory = () => memory.buffer;
  const checks = { n: 0, failed: [] };
  const ok = (cond, msg) => { checks.n++; if (!cond) { checks.failed.push(msg); console.log(`FAIL ${msg}`); } };
  const compileTokens = (tokens) => {
    const guest = e.guest_alloc(tokens.byteLength) >>> 0, p = e.guest_to_wasm(guest) >>> 0;
    new Uint32Array(memory.buffer, p, tokens.length).set(tokens);
    const ir = (tokens[0] === 0xfffe0200 ? e.compile20 : e.d3d_shader_ir_compile)(p, tokens.length) >>> 0;
    e.guest_free(guest);
    return ir;
  };
  const canonical = (ir) => {
    try { return IR.canonical(e, getMemory, ir); } finally { e.d3d_shader_ir_free(ir); }
  };
  const vsIR = {};
  for (const [name, tokens] of Object.entries(SHADERS)) {
    const ir = compileTokens(tokens);
    ok(ir, `${name}: guest bytecode validates (error ${e.d3d_shader_ir_error()} at token ${e.d3d_shader_ir_error_offset()})`);
    const c = canonical(ir);
    ok(c.stage === 'vertex' && c.version === 0xfffe0200 && (c.flags & 8), `${name}: core vertex IR`);
    const OPS = new Set([1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 19, 31, 46, 81]);
    for (const ins of c.instructions) ok(OPS.has(ins.opcode), `${name}: op ${ins.opcode} is core vertex`);
    vsIR[name] = c.nativeBytes;
  }
  // Declines: no DCL (D3D8-style vs_1_1), coissue-free shift etc.
  {
    const before = e.d3d_shader_ir_canon_declines() >>> 0;
    const ir = compileTokens(new Uint32Array([0xfffe0101, 1, D(T.rast, 0), S(T.v, 0), 0xffff]));
    ok(ir, 'undeclared vs_1_1 validates');
    ok((e.d3d_shader_ir_canonicalize(ir) >>> 0) === 0, 'reading an undeclared v# declines');
    e.d3d_shader_ir_free(ir);
    ok((e.d3d_shader_ir_canon_declines() >>> 0) === before + 1, 'the decline is counted');
  }
  // PS 0xffff0200 core IR passes the canonicalizer as a validated copy.
  for (const [b, i] of [[1, 0], [3, 7]]) {
    const bytes = copyPS(b, i), guest = e.guest_alloc(bytes.length) >>> 0, p = e.guest_to_wasm(guest) >>> 0;
    new Uint8Array(memory.buffer, p, bytes.length).set(bytes);
    const c = IR.canonical(e, getMemory, p);
    e.guest_free(guest);
    ok(c.version === 0xffff0200 && c.flags === 8, `PS 0xffff0200 ${b}:${i} validates`);
  }

  const rows = inputs(0x94b);
  const vbytes = vertexBytes(rows);
  const C = vconsts();
  const layoutTail = new Uint8Array(ELEMS.length * 8);
  ELEMS.forEach(([type, usage, index, offset], i) => layoutTail.set(packLayout('GpsLayoutElem', { slot: 0, type, usage, index, offset }), i * 8));

  // One executor run: every shader x every output, read back as RGBA rows.
  function runV2(ex, outputs, extra) {
    const p = makeProducer({ ringBytes: 1 << 16, arenaBytes: 1 << 20, memBytes: 1 << 22 });
    const ring = p.ring();
    const run = () => GS.drain([ring], ex);
    const arena = (bytes) => { const at = p.arenaAlloc(bytes.length); p.arenaView(at, bytes.length).set(bytes); return at; };
    p.emit('CREATE', { id: 1, kind: KIND.RT, fmt: FMT.A8B8G8R8, levels: 1, width: W, height: H });
    p.emit('LAYOUT', { id: 2, count: ELEMS.length, stride: STRIDE }, layoutTail);
    p.emit('TARGETS', { color: 1, depth: 0 });
    p.emit('CONSTS', { stage: CONST.STAGE_VS, first: 0, count: 256 }, new Uint8Array(C.buffer));
    p.emit('RASTER', { depth_mode: 0, zfunc: 8, zwrite: 0, cull: 1, blend: 0, src_rgb: 2, dst_rgb: 1, src_alpha: 2, dst_alpha: 1,
      blend_op: 1, blend_op_alpha: 1, linear: 0, alpha_func: 8, alpha_ref: 0, colormask: 15, fog_mode: 0, fog_flags: 0, fill: 3,
      fog_color: 0, fog_table: 0, depth_bias: 0, scissor_left: 0, scissor_top: 0, scissor_right: W, scissor_bottom: H });
    p.emit('BIND', { count: 0 });
    let id = 100;
    const ps = OUT_PS.slice(0, outputs).map(([b, i]) => { const bytes = copyPS(b, i); p.emit('SHADER', { id: ++id, stage: 1, ir_bytes: bytes.length }, bytes); return id; });
    run();
    const out = {};
    const readback = () => {
      const at = p.arenaAlloc(W * H * 4);
      p.emit('READBACK', { rt: 1, x: 0, y: 0, w: W, h: H, fmt: FMT.A8B8G8R8, dst: at, pitch: W * 4, slot: 0 });
      run();
      return Uint8Array.from(p.arenaView(at, W * H * 4));
    };
    for (const [name, bytes] of Object.entries(vsIR)) {
      const vs = ++id;
      p.emit('SHADER', { id: vs, stage: 0, ir_bytes: bytes.length }, bytes);
      run();
      for (let k = 0; k < ps.length; k++) {
        p.emit('CLEAR', { mask: 1, colormask: 15, rgba: 0xff000000, z: 1, left: 0, top: 0, right: W, bottom: H });
        p.emit('DRAW_UP', { prim: 1, vs, ps: ps[k], layout: 2, vbuf: 0, voff: arena(vbytes), stride: STRIDE, ibuf: 0, ioff: 0, count: N, vcount: N });
        run();
        out[`${name}/${OUT_NAMES[k]}`] = readback();
      }
    }
    // Programmed vertex fog: oFog = v3.z blends toward the fog colour after a
    // ps_1_1 (core IR from 09af1; native fog takes PS 1.x only).
    {
      const psFog = canonical(compileTokens(new Uint32Array([0xffff0101, 1, 0x800f0000, 0x90e40000, 0xffff]))).nativeBytes;
      const vs = ++id, fps = ++id;
      p.emit('SHADER', { id: vs, stage: 0, ir_bytes: vsIR.vs20.length }, vsIR.vs20);
      p.emit('SHADER', { id: fps, stage: 1, ir_bytes: psFog.length }, psFog);
      p.emit('RASTER', { depth_mode: 0, zfunc: 8, zwrite: 0, cull: 1, blend: 0, src_rgb: 2, dst_rgb: 1, src_alpha: 2, dst_alpha: 1,
        blend_op: 1, blend_op_alpha: 1, linear: 0, alpha_func: 8, alpha_ref: 0, colormask: 15, fog_mode: CONST.FOG_VERTEX_ALPHA, fog_flags: 0, fill: 3,
        fog_color: 0xff2080f0, fog_table: 0, depth_bias: 0, scissor_left: 0, scissor_top: 0, scissor_right: W, scissor_bottom: H });
      p.emit('CLEAR', { mask: 1, colormask: 15, rgba: 0xff000000, z: 1, left: 0, top: 0, right: W, bottom: H });
      p.emit('DRAW_UP', { prim: 1, vs, ps: fps, layout: 2, vbuf: 0, voff: arena(vbytes), stride: STRIDE, ibuf: 0, ioff: 0, count: N, vcount: N });
      run();
      out['vs20/fog'] = readback();
      p.emit('RASTER', { depth_mode: 0, zfunc: 8, zwrite: 0, cull: 1, blend: 0, src_rgb: 2, dst_rgb: 1, src_alpha: 2, dst_alpha: 1,
        blend_op: 1, blend_op_alpha: 1, linear: 0, alpha_func: 8, alpha_ref: 0, colormask: 15, fog_mode: 0, fog_flags: 0, fill: 3,
        fog_color: 0, fog_table: 0, depth_bias: 0, scissor_left: 0, scissor_top: 0, scissor_right: W, scissor_bottom: H });
    }
    if (extra) extra({ p, run, arena, readback, ps, vsIR, id: () => ++id });
    return out;
  }

  // Old transport: guest bytecode on d3d9 Device objects (RGBA rows top-down).
  const oldSnapshot = (vsTokens, psTokens) => ({
    primitive: 1, primitiveCount: N, stride: STRIDE, vertices: vbytes,
    attributes: ELEMS.map(([type, usage, index, offset], register) => ({ register, usage, usageIndex: index, type, offset })),
    vertexShader: vsTokens, pixelShader: psTokens, vertexConstants: C, pixelConstants: new Float32Array(32),
    textures: [], state: { zenable: false, zwrite: false, cull: 1, blend: false } });
  const PS_V = [new Uint32Array([0xffff0101, 1, 0x800f0000, 0x90e40000, 0xffff]), new Uint32Array([0xffff0101, 1, 0x800f0000, 0x90e40001, 0xffff])];

  const diff = (a, b) => { let m = 0, at = -1; for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i] - b[i]); if (d > m) { m = d; at = i; } } return { max: m, at }; };
  const maxDiff = {};
  const compare = (A, B, label, tol = 1) => {
    for (const key of Object.keys(A)) {
      if (!B[key]) continue;
      const d = diff(A[key], B[key]);
      maxDiff[label] = Math.max(maxDiff[label] || 0, d.max);
      const i = d.at >> 2;
      ok(d.max <= tol, `${label} ${key}: max channel difference ${d.max} at pixel ${i % W},${(i / W) | 0} ` +
        `(${Array.from(A[key].subarray(i * 4, i * 4 + 4))} vs ${Array.from(B[key].subarray(i * 4, i * 4 + 4))})`);
    }
  };
  const covered = (pixels) => { let n = 0; for (let i = 0; i < pixels.length; i += 4) if (pixels[i] || pixels[i + 1] || pixels[i + 2]) n++; return n; };

  // ── software v2 ──
  const swEx = new SW.Executor({ getExports: () => e, getMemory });
  ok((swEx.caps().flags & CONST.CAP_VS_IR) !== 0 && swEx.caps().maxSamplers === 6, 'software caps: VS IR, six samplers');
  let swExtra = {};
  const sw = runV2(swEx, 8, (x) => {
    // DRAW from VBUF/IBUF: base vertex 3 (voff = 3 * stride), start index 5
    // (ioff = 5 * size), indices naming every point once, reversed.
    const pad = 3, start = 5;
    const vb = new Uint8Array((N + pad) * STRIDE); vb.set(vbytes, pad * STRIDE);
    for (const size of [2, 4]) {
      const ib = new Uint8Array((N + start) * size), dv = new DataView(ib.buffer);
      for (let i = 0; i < N; i++) size === 2 ? dv.setUint16((start + i) * 2, N - 1 - i, true) : dv.setUint32((start + i) * 4, N - 1 - i, true);
      const v = x.id(), b = x.id();
      x.p.emit('CREATE', { id: v, kind: KIND.VBUF, fmt: 0, levels: 1, width: vb.length, height: 1, size: vb.length });
      x.p.emit('CREATE', { id: b, kind: KIND.IBUF, fmt: 0, levels: 1, width: ib.length, height: 1, size: ib.length });
      // Two uploads per buffer: byte offsets x.
      const half = (vb.length >> 1) & ~3;
      x.p.emit('UPLOAD', { id: v, level: 0, face: 0, x: 0, y: 0, w: half, h: 1, pitch: half, src: x.arena(vb.subarray(0, half)), bytes: half });
      x.p.emit('UPLOAD', { id: v, level: 0, face: 0, x: half, y: 0, w: vb.length - half, h: 1, pitch: vb.length - half, src: x.arena(vb.subarray(half)), bytes: vb.length - half });
      x.p.emit('UPLOAD', { id: b, level: 0, face: 0, x: 0, y: 0, w: ib.length, h: 1, pitch: ib.length, src: x.arena(ib), bytes: ib.length });
      const vs = x.id();
      x.p.emit('SHADER', { id: vs, stage: 0, ir_bytes: x.vsIR.arith.length }, x.vsIR.arith);
      x.p.emit('CLEAR', { mask: 1, colormask: 15, rgba: 0xff000000, z: 1, left: 0, top: 0, right: W, bottom: H });
      x.p.emit('DRAW', { prim: 1, index_size: size, vs, ps: x.ps[0], layout: 2, vbuf: v, voff: pad * STRIDE, stride: STRIDE, ibuf: b, ioff: start * size, count: N, vcount: N });
      x.run();
      swExtra[`ibuf${size * 8}`] = x.readback();
    }
  });
  ok(diff(sw['vs20/fog'], sw['vs20/oD0']).max > 16, 'vertex fog changes the picture');
  for (const k of Object.keys(sw)) ok(covered(sw[k]) > 0, `software ${k} drew (${covered(sw[k])} pixels; first ${Array.from(sw[k].subarray(0, 16))})`);
  for (const size of [16, 32]) compare({ x: swExtra[`ibuf${size}`] }, { x: sw['arith/oD0'] }, `software DRAW ibuf${size} = DRAW_UP`, 0);
  // Software refuses texld s6 at SHADER (caps: 6 samplers).
  {
    const p = makeProducer({ ringBytes: 4096, arenaBytes: 4096, memBytes: 1 << 20 });
    const bytes = texPS(6);
    p.emit('SHADER', { id: 9, stage: 1, ir_bytes: bytes.length }, bytes);
    let code = 0;
    try { GS.drain([p.ring()], new SW.Executor({ getExports: () => e, getMemory })); } catch (err) { code = err.code; }
    ok(code === GS.ERR.UNSUPPORTED || p.load('error_code') === GS.ERR.UNSUPPORTED, `software refuses texld s6 as unsupported (code ${code})`);
  }

  // ── old transport, software ──
  const oldSW = {};
  {
    const dev = new SoftDevice({ getExports: () => e, getMemory, width: W, height: H });
    for (const [name, tokens] of Object.entries(SHADERS)) for (let k = 0; k < 2 && tokens[0] !== 0xfffe0200; k++) {
      dev.clear([0, 0, 0, 1], 1); dev.draw(oldSnapshot(tokens, PS_V[k]));
      const a = Uint8Array.from(dev.present().pixels);
      for (let i = 0; i < a.length; i += 4) { const t = a[i]; a[i] = a[i + 2]; a[i + 2] = t; }
      oldSW[`${name}/${OUT_NAMES[k]}`] = a;
    }
    dev.destroy();
  }
  compare(sw, oldSW, 'v2 software vs old software (guest IR)');

  const evidence = { checks: 0, glAvailable: hgl.available() };
  if (hgl.available()) {
    const { createCanvas } = require(path.join(ROOT, 'lib', 'canvas-compat'));
    const { WebGLBackend } = require(path.join(ROOT, 'lib', 'gpu-backend'));
    const WG = require(path.join(ROOT, 'lib', 'gpu-stream-webgl'));
    const canvas = createCanvas(W, H);
    const backend = new WebGLBackend(canvas);
    const glEx = new WG.Executor({ canvas, backend });
    const caps = glEx.caps();
    ok((caps.flags & CONST.CAP_VS_IR) !== 0, 'webgl caps: VS IR');
    let glExtra = {};
    const gl = runV2(glEx, 8, (x) => {
      // oT6/oT7 and s6/s7 exist on WebGL only.
      const vs = x.id();
      const t67 = assemble(0xfffe0200, [...DCLS, pos, [4, D(T.tex, 6), S(T.v, 1), S(T.c, 0), S(T.r, 9)],
        [4, D(T.tex, 7), S(T.v, 2), S(T.c, 0), S(T.r, 9)], [1, D(T.tex, 0), S(T.v, 1)]]);
      const ir = compileTokens(t67); const c = canonical(ir);
      x.p.emit('SHADER', { id: vs, stage: 0, ir_bytes: c.nativeBytes.length }, c.nativeBytes);
      for (const n of [6, 7]) {
        const ps = x.id(), bytes = copyPS(3, n);
        x.p.emit('SHADER', { id: ps, stage: 1, ir_bytes: bytes.length }, bytes);
        x.p.emit('CLEAR', { mask: 1, colormask: 15, rgba: 0xff000000, z: 1, left: 0, top: 0, right: W, bottom: H });
        x.p.emit('DRAW_UP', { prim: 1, vs, ps, layout: 2, vbuf: 0, voff: x.arena(vbytes), stride: STRIDE, ibuf: 0, ioff: 0, count: N, vcount: N });
        x.run();
        glExtra[`oT${n}`] = x.readback();
      }
      if (caps.maxSamplers >= 8) {
        // texld s7 through the sampler operand: a 1x1 texture bound to slot 7.
        const tex = x.id(), smp = x.id(), ps = x.id(), bytes = texPS(7);
        x.p.emit('CREATE', { id: tex, kind: KIND.TEX2D, fmt: FMT.A8B8G8R8, levels: 1, width: 1, height: 1 });
        x.p.emit('UPLOAD', { id: tex, level: 0, x: 0, y: 0, w: 1, h: 1, pitch: 4, src: x.arena(new Uint8Array([10, 200, 30, 255])), bytes: 4 });
        x.p.emit('SAMPLER', { id: smp, address_u: 3, address_v: 3, min: 1, mag: 1, mip: 0, lod_bias: 0 });
        x.p.emit('SHADER', { id: ps, stage: 1, ir_bytes: bytes.length }, bytes);
        x.p.emit('BIND', { count: 1 }, packLayout('GpsBindEntry', { slot: 7, texture: tex, sampler: smp }));
        x.p.emit('CLEAR', { mask: 1, colormask: 15, rgba: 0xff000000, z: 1, left: 0, top: 0, right: W, bottom: H });
        x.p.emit('DRAW_UP', { prim: 1, vs, ps, layout: 2, vbuf: 0, voff: x.arena(vbytes), stride: STRIDE, ibuf: 0, ioff: 0, count: N, vcount: N });
        x.run();
        glExtra.s7 = x.readback();
        x.p.emit('BIND', { count: 0 });
      }
      // DRAW from VBUF/IBUF with a triangle list (two triangles, u32 indices).
      const pad = 2, start = 3, quad = [rows[0], rows[W - 1], rows[N - W], rows[N - 1]].map((r, i) =>
        Object.assign({}, r, { pos: [[-1, 1], [1, 1], [-1, -1], [1, -1]][i].concat([0.5, 1]) }));
      const qb = vertexBytes(quad), vb = new Uint8Array((4 + pad) * STRIDE); vb.set(qb, pad * STRIDE);
      const ib = new Uint8Array((6 + start) * 4), dv = new DataView(ib.buffer);
      [0, 1, 2, 2, 1, 3].forEach((v, i) => dv.setUint32((start + i) * 4, v, true));
      const v = x.id(), b = x.id(), vs2 = x.id();
      x.p.emit('CREATE', { id: v, kind: KIND.VBUF, fmt: 0, levels: 1, width: vb.length, height: 1, size: vb.length });
      x.p.emit('CREATE', { id: b, kind: KIND.IBUF, fmt: 0, levels: 1, width: ib.length, height: 1, size: ib.length });
      x.p.emit('UPLOAD', { id: v, level: 0, face: 0, x: 0, y: 0, w: vb.length, h: 1, pitch: vb.length, src: x.arena(vb), bytes: vb.length });
      x.p.emit('UPLOAD', { id: b, level: 0, face: 0, x: 0, y: 0, w: ib.length, h: 1, pitch: ib.length, src: x.arena(ib), bytes: ib.length });
      x.p.emit('SHADER', { id: vs2, stage: 0, ir_bytes: x.vsIR.arith.length }, x.vsIR.arith);
      x.p.emit('CLEAR', { mask: 1, colormask: 15, rgba: 0xff000000, z: 1, left: 0, top: 0, right: W, bottom: H });
      x.p.emit('DRAW', { prim: 4, index_size: 4, vs: vs2, ps: x.ps[0], layout: 2, vbuf: v, voff: pad * STRIDE, stride: STRIDE, ibuf: b, ioff: start * 4, count: 6, vcount: 4 });
      x.run();
      glExtra.quad = x.readback();
      glExtra.quadBuffers = { vb, ib, pad, start };
      // Fixed-function-origin core pixel IR (header flags 8|4, what 09aj's
      // fixed pipeline publishes) compiles on WebGL and draws like flags 8.
      const core = copyPS(1, 0), fixed = core.slice();
      const hv = new DataView(fixed.buffer, fixed.byteOffset, fixed.byteLength);
      ok(hv.getUint32(28, true) === 8, `core PS header flags 8 (got ${hv.getUint32(28, true)})`);
      hv.setUint32(28, 8 | 4, true);
      for (const [key, bytes] of [['flags8', core], ['flags12', fixed]]) {
        const ps = x.id();
        x.p.emit('SHADER', { id: ps, stage: 1, ir_bytes: bytes.length }, bytes);
        x.p.emit('CLEAR', { mask: 1, colormask: 15, rgba: 0xff000000, z: 1, left: 0, top: 0, right: W, bottom: H });
        x.p.emit('DRAW_UP', { prim: 1, vs: vs2, ps, layout: 2, vbuf: 0, voff: x.arena(vbytes), stride: STRIDE, ibuf: 0, ioff: 0, count: N, vcount: N });
        x.run();
        glExtra[key] = x.readback();
      }
    });
    ok(covered(glExtra.flags12) > 0, 'webgl draws a fixed-origin (flags 8|4) core pixel shader');
    compare({ x: glExtra.flags12 }, { x: glExtra.flags8 }, 'webgl fixed-origin flags 8|4 = flags 8', 0);
    compare(sw, gl, 'v2 software vs v2 webgl');
    for (const n of [6, 7]) ok(covered(glExtra[`oT${n}`]) > N / 2, `webgl oT${n} reaches the pixel shader`);
    // oT6 = v1 * .25 + .5 and oT7 = v2 * .25 + .5, clamped, per pixel.
    for (let i = 0; i < N; i++) {
      for (const [n, src] of [[6, rows[i].A], [7, rows[i].B]]) {
        const want = src.map((x) => Math.round(Math.min(1, Math.max(0, x * 0.25 + 0.5)) * 255));
        const got = Array.from(glExtra[`oT${n}`].subarray(i * 4, i * 4 + 4));
        ok(got.every((g, k) => Math.abs(g - want[k]) <= 1), `webgl oT${n} pixel ${i}: ${got} vs ${want}`);
      }
    }
    if (glExtra.s7) for (let i = 0; i < N; i++) ok(Array.from(glExtra.s7.subarray(i * 4, i * 4 + 4)).join() === '10,200,30,255', `webgl texld s7 pixel ${i}`);

    // Software draws the same VBUF/IBUF quad: compare.
    {
      const p = makeProducer({ ringBytes: 1 << 14, arenaBytes: 1 << 16, memBytes: 1 << 20 });
      const x = new SW.Executor({ getExports: () => e, getMemory });
      const arena = (bytes) => { const at = p.arenaAlloc(bytes.length); p.arenaView(at, bytes.length).set(bytes); return at; };
      const { vb, ib, pad, start } = glExtra.quadBuffers, ps = copyPS(1, 0);
      p.emit('CREATE', { id: 1, kind: KIND.RT, fmt: FMT.A8B8G8R8, levels: 1, width: W, height: H });
      p.emit('LAYOUT', { id: 2, count: ELEMS.length, stride: STRIDE }, layoutTail);
      p.emit('TARGETS', { color: 1, depth: 0 });
      p.emit('CONSTS', { stage: CONST.STAGE_VS, first: 0, count: 256 }, new Uint8Array(C.buffer));
      p.emit('RASTER', { depth_mode: 0, zfunc: 8, zwrite: 0, cull: 1, blend: 0, src_rgb: 2, dst_rgb: 1, src_alpha: 2, dst_alpha: 1,
        blend_op: 1, blend_op_alpha: 1, linear: 0, alpha_func: 8, alpha_ref: 0, colormask: 15, fog_mode: 0, fog_flags: 0, fill: 3,
        fog_color: 0, fog_table: 0, depth_bias: 0, scissor_left: 0, scissor_top: 0, scissor_right: W, scissor_bottom: H });
      p.emit('BIND', { count: 0 });
      p.emit('SHADER', { id: 3, stage: 1, ir_bytes: ps.length }, ps);
      p.emit('SHADER', { id: 4, stage: 0, ir_bytes: vsIR.arith.length }, vsIR.arith);
      p.emit('CREATE', { id: 5, kind: KIND.VBUF, fmt: 0, levels: 1, width: vb.length, height: 1, size: vb.length });
      p.emit('CREATE', { id: 6, kind: KIND.IBUF, fmt: 0, levels: 1, width: ib.length, height: 1, size: ib.length });
      p.emit('UPLOAD', { id: 5, level: 0, face: 0, x: 0, y: 0, w: vb.length, h: 1, pitch: vb.length, src: arena(vb), bytes: vb.length });
      p.emit('UPLOAD', { id: 6, level: 0, face: 0, x: 0, y: 0, w: ib.length, h: 1, pitch: ib.length, src: arena(ib), bytes: ib.length });
      p.emit('CLEAR', { mask: 1, colormask: 15, rgba: 0xff000000, z: 1, left: 0, top: 0, right: W, bottom: H });
      p.emit('DRAW', { prim: 4, index_size: 4, vs: 4, ps: 3, layout: 2, vbuf: 5, voff: pad * STRIDE, stride: STRIDE, ibuf: 6, ioff: start * 4, count: 6, vcount: 4 });
      const at = p.arenaAlloc(W * H * 4);
      p.emit('READBACK', { rt: 1, x: 0, y: 0, w: W, h: H, fmt: FMT.A8B8G8R8, dst: at, pitch: W * 4, slot: 0 });
      GS.drain([p.ring()], x);
      const swQuad = Uint8Array.from(p.arenaView(at, W * H * 4));
      ok(covered(swQuad) === N, 'software VBUF/IBUF quad covers the target');
      ok(covered(glExtra.quad) === N, 'webgl VBUF/IBUF quad covers the target');
      compare({ quad: swQuad }, { quad: glExtra.quad }, 'VBUF/IBUF triangle quad software vs webgl');
    }

    // ── old transport, GL (JS compileIR translation of the guest bytecode) ──
    const Backend = require('../lib/d3d9-backend');
    const oldGL = {};
    const dev = new Backend.Device(createCanvas(W, H), { webglVersion: 1, getExports: () => e, getMemory });
    try {
      for (const [name, tokens] of Object.entries(SHADERS)) for (let k = 0; k < 2 && tokens[0] !== 0xfffe0200; k++) {
        dev.clear([0, 0, 0, 1], 1); dev.draw(oldSnapshot(tokens, PS_V[k]));
        const raw = dev.gpu.readPixels(0, 0, W, H, dev.gpu.gl.RGBA, dev.gpu.gl.UNSIGNED_BYTE, new Uint8Array(W * H * 4));
        const out = new Uint8Array(raw.length);
        for (let y = 0; y < H; y++) out.set(raw.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
        oldGL[`${name}/${OUT_NAMES[k]}`] = out;
      }
    } finally { dev.destroy(); }
    compare(gl, oldGL, 'v2 webgl vs old GL (JS compileIR)');
    evidence.oldGL = Object.keys(oldGL).length;
  } else console.log(`SKIP webgl half: ${hgl.unavailableReason()}`);
  console.log(`evidence: ${JSON.stringify({ shaders: Object.keys(SHADERS), outputs: OUT_NAMES, gl: evidence.glAvailable, oldSoftware: Object.keys(oldSW).length, oldGL: evidence.oldGL || 0, maxDiff })}`);
  if (checks.failed.length) { console.log(`FAIL test-gpu-stream-vs: ${checks.failed.length}/${checks.n} checks failed`); process.exit(1); }
  console.log(`PASS test-gpu-stream-vs: ${checks.n} checks`);
  process.exit(0);
})().catch((err) => { console.error(`FAIL test-gpu-stream-vs: ${err && err.stack || err}`); process.exit(1); });
