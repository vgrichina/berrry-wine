#!/usr/bin/env node
'use strict';
// ps1.x -> core IR canonicalization (09af1). The canonical IR carries only the
// core op subset; texkill on any register (ps_1_4 temps included) discards on
// both executors; ps1.x constants clamp to [-1,1]; non-ps1.x input declines.
const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const { Device } = require('../lib/d3d9-software-backend');
const IR = require('../lib/d3d-shader-ir');
const CORE = new Set([1, 2, 4, 5, 6, 8, 9, 10, 11, 18, 65, 66, 81, 88]);
const W = 8, H = 8;
(async () => {
  const { exports: e, memory } = await bootRenderHarness({ fonts: 'none' });
  const getMemory = () => memory.buffer;
  const compile = tokens => {
    const guest = e.guest_alloc(tokens.byteLength) >>> 0, p = e.guest_to_wasm(guest) >>> 0;
    new Uint32Array(memory.buffer, p, tokens.length).set(tokens);
    const ir = e.d3d_shader_ir_compile(p, tokens.length) >>> 0;
    return { ir, release() { if (ir) e.d3d_shader_ir_free(ir); e.guest_free(guest); } };
  };
  const canonical = tokens => {
    const c = compile(tokens); assert(c.ir, 'guest shader validates');
    try { return IR.canonical(e, getMemory, c.ir); } finally { c.release(); }
  };
  // ps_1_4: texld r0,t0; sub r2,r0.a,c0; phase; texkill r2; texld r1,t1; mov r0,r1
  const killTemp = new Uint32Array([0xffff0104, 66, 0x800f0000, 0xb0e40000, 3, 0x800f0002, 0x80ff0000, 0xa0e40000,
    0xfffd, 65, 0x800f0002, 66, 0x800f0001, 0xb0e40001, 1, 0x800f0000, 0x80e40001, 0xffff]);
  const core = canonical(killTemp);
  assert(core.flags & 8, 'canonical IR is flagged core');
  for (const ins of core.instructions) assert(CORE.has(ins.opcode), `op ${ins.opcode} is in the core subset`);
  const kill = core.instructions.filter(ins => ins.opcode === 65);
  assert.strictEqual(kill.length, 1, 'one texkill survives');
  assert.strictEqual((kill[0].args[0] >>> 28) & 7, 0, 'texkill reads a temp register, not a texture coordinate');

  // Left texel alpha 255 (kept), right texel alpha 0 (killed): c0.a = .5.
  const vertices = new Uint8Array(4 * 32), view = new DataView(vertices.buffer);
  // The quad overhangs the target: an exact [-1,1] quad leaves the top row
  // uncovered on the GL executor (pre-existing, base tree too), which is a
  // raster-edge question, not a texkill one.
  [[-1.25, 1.25, -.125, -.125], [1.25, 1.25, 1.125, -.125], [-1.25, -1.25, -.125, 1.125], [1.25, -1.25, 1.125, 1.125]].forEach(([x, y, u, v], i) => {
    [x, y, .5, 1, u, v, u, v].forEach((value, c) => view.setFloat32(i * 32 + c * 4, value, true));
  });
  const point = { addressU: 3, addressV: 3, min: 1, mag: 1, mip: 0 };
  const draw = pixelShader => ({ primitive: 5, primitiveCount: 2, stride: 32, vertices,
    attributes: [{ register: 0, usage: 0, usageIndex: 0, type: 3, offset: 0 },
      { register: 7, usage: 5, usageIndex: 0, type: 1, offset: 16 }, { register: 8, usage: 5, usageIndex: 1, type: 1, offset: 24 }],
    vertexShader: new Uint32Array([0xfffe0101, 1, 0xc00f0000, 0x90e40000, 1, 0xe00f0000, 0x90e40007, 1, 0xe00f0001, 0x90e40008, 0xffff]),
    pixelShader, vertexConstants: new Float32Array(384), pixelConstants: new Float32Array([.5, .5, .5, .5, 2, -1.5, .5, 1]),
    textures: [{ width: 2, height: 1, pixels: new Uint8Array([10, 20, 30, 255, 40, 50, 60, 0]), sampler: point },
      { width: 1, height: 1, pixels: new Uint8Array([0, 200, 0, 255]), sampler: point }],
    state: { zenable: false, zwrite: false, cull: 1, blend: false } });
  // Software present is BGRA top-down; GL readback is RGBA bottom-up. Both
  // normalize to RGBA rows top-down.
  const expectKill = (pixels, label) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, px = [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]];
      assert.deepStrictEqual(px, x < W / 2 ? [0, 200, 0, 255] : [0, 0, 0, 255], `${label} pixel ${x},${y}`);
    }
  };
  // ps_1_1 mov r0, c1: c1 = (2,-1.5,.5,1) clamps to (1,-1,.5,1) -> (255,0,128,255).
  const clampShader = new Uint32Array([0xffff0101, 1, 0x800f0000, 0xa0e40001, 0xffff]);
  const expectClamp = (pixels, label) => {
    for (let i = 0; i < pixels.length; i += 4) {
      assert.deepStrictEqual([pixels[i], pixels[i + 1], pixels[i + 3]], [255, 0, 255], `${label} clamped constant`);
      assert(Math.abs(pixels[i + 2] - 128) <= 1, `${label} in-range constant`);
    }
  };
  const sw = new Device({ getExports: () => e, getMemory, width: W, height: H });
  const swPixels = shader => {
    sw.clear([0, 0, 0, 1], 1); sw.draw(draw(shader));
    const a = Uint8Array.from(sw.present().pixels);
    for (let i = 0; i < a.length; i += 4) { const t = a[i]; a[i] = a[i + 2]; a[i + 2] = t; }
    return a;
  };
  expectKill(swPixels(killTemp), 'software');
  expectClamp(swPixels(clampShader), 'software');
  sw.destroy();

  // Declines are counted, never silent: a vertex shader is outside ps1.x.
  const before = e.d3d_shader_ir_canon_declines() >>> 0;
  const vs11 = compile(new Uint32Array([0xfffe0101, 1, 0xc00f0000, 0x90e40000, 0xffff]));
  assert(vs11.ir, 'vs_1_1 validates');
  try { assert.strictEqual(e.d3d_shader_ir_canonicalize(vs11.ir) >>> 0, 0, 'a vertex shader is not canonicalized'); }
  finally { vs11.release(); }
  assert.strictEqual(e.d3d_shader_ir_canon_declines() >>> 0, before + 1, 'decline is counted');
  assert.strictEqual(e.d3d_shader_ir_canonicalize(0xfffffff0) >>> 0, 0, 'out-of-range IR pointer declines');

  if (require('../lib/headless-gl').available()) {
    const { createCanvas } = require('../lib/canvas-compat'), Backend = require('../lib/d3d9-backend');
    const gl = new Backend.Device(createCanvas(W, H), { webglVersion: 1, getExports: () => e, getMemory });
    const glPixels = shader => {
      gl.clear([0, 0, 0, 1], 1); gl.draw(draw(shader));
      const raw = gl.gpu.readPixels(0, 0, W, H, gl.gpu.gl.RGBA, gl.gpu.gl.UNSIGNED_BYTE, new Uint8Array(W * H * 4));
      const out = new Uint8Array(raw.length);
      for (let y = 0; y < H; y++) out.set(raw.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
      return out;
    };
    try { expectKill(glPixels(killTemp), 'GL'); expectClamp(glPixels(clampShader), 'GL'); }
    finally { gl.destroy(); }
    console.log('PASS test-d3d9-shader-canon (software + GL)');
  } else console.log('PASS test-d3d9-shader-canon (software; headless GL unavailable)');
})().catch(error => { console.error(error); process.exit(1); });
