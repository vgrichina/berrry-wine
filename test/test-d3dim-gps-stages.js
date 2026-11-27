#!/usr/bin/env node
'use strict';
// DX6/7 texture-stage cascades through the WAT GPU stream producer
// ($d3g_stage_key -> the shared 09aj cascade -> core IR), on the software
// executor and, when headless GL is available, the WebGL executor; both
// against independently computed D3D per-channel values. Each case draws a
// full-target triangle with a 1x1 texture, so every pixel is one cascade
// evaluation of (texture T, diffuse D, specular S, TEXTUREFACTOR F).
//
// Covers what the pre-D5 stage-0 lowering approximated or ignored:
// TFACTOR (read as diffuse before), MODULATE2X, ADDSIGNED,
// BLENDCURRENTALPHA, DOTPRODUCT3, COMPLEMENT / ALPHAREPLICATE, the SPECULAR
// argument, SPECULARENABLE, ALPHAOP DISABLE-free alpha ops, a stage-1
// operation with no texture (honoured), a stage 1 that samples (cut: one
// texture stage), and a TFACTOR change reusing one shader (CONSTS c0).
//
//   node test/test-d3dim-gps-stages.js
const assert = require('assert');
const path = require('path');
const { bootGpsDevice } = require('./helpers/d3dim-gps-device');

const ROOT = path.join(__dirname, '..');
const TOL = 3;
const ch = c => [(c >>> 16 & 255) / 255, (c >>> 8 & 255) / 255, (c & 255) / 255, (c >>> 24) / 255]; // r g b a
const T = 0xC0806040, D = 0x80A0C0E0, S = 0x00204060, F = 0x40FF8020;
const sat = v => Math.min(1, Math.max(0, v));
const t = ch(T), d = ch(D), s = ch(S), f = ch(F);
const per = fn => [0, 1, 2, 3].map(i => sat(fn(i)));
// D3DTA: DIFFUSE 0, CURRENT 1, TEXTURE 2, TFACTOR 3, SPECULAR 4;
// D3DTOP: SELECTARG1 2, SELECTARG2 3, MODULATE 4, MODULATE2X 5, ADD 7,
// ADDSIGNED 8, BLENDCURRENTALPHA 16, DOTPRODUCT3 24.
const CASES = [
  { name: 'MODULATE(TEX, TFACTOR), alpha SELECTARG1 TFACTOR',
    st: [[4, 2, 3, 2, 3, 0]], want: per(i => i < 3 ? t[i] * f[i] : f[3]), lowered: 1 },
  { name: 'MODULATE2X(TEX, DIFFUSE), alpha ADD',
    st: [[5, 2, 0, 7, 2, 0]], want: per(i => i < 3 ? 2 * t[i] * d[i] : t[3] + d[3]), lowered: 1 },
  { name: 'ADDSIGNED(TEX, DIFFUSE), alpha MODULATE',
    st: [[8, 2, 0, 4, 2, 0]], want: per(i => i < 3 ? t[i] + d[i] - .5 : t[3] * d[3]), lowered: 1 },
  { name: 'BLENDCURRENTALPHA(TEX, DIFFUSE), alpha SELECTARG2 DIFFUSE',
    st: [[16, 2, 0, 3, 2, 0]], want: per(i => i < 3 ? t[i] * d[3] + d[i] * (1 - d[3]) : d[3]), lowered: 1 },
  { name: 'DOTPRODUCT3(TEX, DIFFUSE)', rgbOnly: true,
    st: [[24, 2, 0, 2, 2, 0]], want: (() => { const v = sat(4 * [0, 1, 2].reduce((a, i) => a + (t[i] - .5) * (d[i] - .5), 0)); return [v, v, v, 0]; })(), lowered: 1 },
  { name: 'MODULATE(TEX|ALPHAREPLICATE, DIFFUSE|COMPLEMENT), alpha SELECTARG1 TEX|COMPLEMENT',
    st: [[4, 0x22, 0x10, 2, 0x12, 0]], want: per(i => i < 3 ? t[3] * (1 - d[i]) : 1 - t[3]), lowered: 1 },
  { name: 'ADD(DIFFUSE, SPECULAR) untextured, alpha SELECTARG1 DIFFUSE', untextured: true,
    st: [[7, 0, 4, 2, 0, 0]], want: per(i => i < 3 ? d[i] + s[i] : d[3]), lowered: 1 },
  { name: 'SPECULARENABLE: MODULATE(TEX, DIFFUSE) + specular', spec: 1,
    st: [[4, 2, 0, 4, 2, 0]], want: per(i => i < 3 ? t[i] * d[i] + s[i] : t[3] * d[3]), lowered: 1 },
  { name: 'stage 1 without a texture: SELECTARG1 TEX then MODULATE(CURRENT, TFACTOR)',
    st: [[2, 2, 0, 2, 2, 0], [4, 1, 3, 4, 1, 3]], want: per(i => t[i] * f[i]), multi: 1, lowered: 1 },
  { name: 'stage 1 sampling a texture is cut: stage 0 MODULATE(TEX, DIFFUSE) only',
    st: [[4, 2, 0, 4, 2, 0], [7, 2, 1, 2, 1, 0]], want: per(i => t[i] * d[i]), cut: 1 },
  { name: 'plain MODULATE(TEX, DIFFUSE): not counted as lowered',
    st: [[4, 2, 0, 4, 2, 0]], want: per(i => t[i] * d[i]) },
];

async function run(label, makeExecutor) {
  const g = await bootGpsDevice({ makeExecutor }), { e, m } = g;
  const vertices = e.guest_alloc(256);
  const rt = g.surface(8, 8, { caps: 0x2840, pf: g.PF.argb32 }), dev = g.device(rt);
  const tex = g.surface(1, 1, { caps: 0x1000, pf: g.PF.argb32 });
  g.fill32(tex, T);
  const rs = (r, v) => e.gd_rs(dev, r, v), tss = (stage, ty, v) => e.gd_tss(dev, stage, ty, v);
  // No z, no blend, no alpha test, no fog, no culling.
  rs(7, 0); rs(14, 0); rs(27, 0); rs(15, 0); rs(28, 0); rs(22, 1); rs(60, F);
  const pixel = () => { const v = m.getUint32(g.dib(rt) + 3 * g.pitch(rt) + 3 * 4, true); return ch(v); };
  const stats = () => [46, 47, 48, 49].map(i => g.stat(i));
  let n = 0;
  for (const c of CASES) {
    e.gd_bind(dev, 0, c.untextured ? 0 : tex);
    for (let stage = 0; stage < 3; stage++) {
      const row = c.st[stage] || [1, 2, 1, 1, 2, 1];
      [1, 2, 3, 4, 5, 6].forEach((ty, k) => tss(stage, ty, row[k]));
    }
    rs(29, c.spec ? 1 : 0);
    g.fill32(rt, 0x5a5a5a5a);
    const before = stats(), draws = g.stat(0), declined = g.stat(14);
    g.vertices(vertices, [[-1, -1, .5, 1, D, S, .5, .5], [30, -1, .5, 1, D, S, .5, .5], [-1, 30, .5, 1, D, S, .5, .5]]);
    e.gd_draw(dev, 4, vertices, 3);
    g.fence();
    assert.strictEqual(g.stat(0), draws + 1, `${label} ${c.name}: the producer took the draw`);
    assert.strictEqual(g.stat(14), declined, `${label} ${c.name}: nothing declined`);
    const got = pixel().map(v => Math.round(v * 255)), want = c.want.map(v => Math.round(v * 255));
    const k = c.rgbOnly ? 3 : 4;
    assert(got.slice(0, k).every((v, i) => Math.abs(v - want[i]) <= TOL),
      `${label} ${c.name}: rgba ${got} != expected ${want}`);
    const after = stats().map((v, i) => v - before[i]);
    assert.deepStrictEqual(after, [c.multi ? 1 : 0, c.cut ? 1 : 0, c.lowered ? 1 : 0, 0], `${label} ${c.name}: stage stats`);
    n++;
  }
  // A TFACTOR change re-binds CONSTS c0; the shader is reused.
  e.gd_bind(dev, 0, tex);
  [[4, 2, 3, 2, 3, 0]].forEach(row => [1, 2, 3, 4, 5, 6].forEach((ty, k) => tss(0, ty, row[k])));
  rs(29, 0); rs(60, 0xff00ff00);
  g.vertices(vertices, [[-1, -1, .5, 1, D, S, .5, .5], [30, -1, .5, 1, D, S, .5, .5], [-1, 30, .5, 1, D, S, .5, .5]]);
  e.gd_draw(dev, 4, vertices, 3); g.fence();
  const got = pixel().map(v => Math.round(v * 255)), want = [0, t[1], 0, 1].map(v => Math.round(v * 255));
  assert(got.every((v, i) => Math.abs(v - want[i]) <= TOL), `${label} TFACTOR change: rgba ${got} != ${want}`);
  assert.strictEqual(g.stat(1), 0, `${label}: no software fallback`);
  return n + 1;
}

(async () => {
  const counts = [`software ${await run('software', null)}`];
  const hgl = require(path.join(ROOT, 'lib', 'headless-gl'));
  if (hgl.available() && !process.argv.includes('--software-only')) {
    const { createCanvas } = require(path.join(ROOT, 'lib', 'canvas-compat'));
    const { WebGLBackend } = require(path.join(ROOT, 'lib', 'gpu-backend'));
    const WebGL = require(path.join(ROOT, 'lib', 'gpu-stream-webgl'));
    let usable = true;
    try { new WebGLBackend(createCanvas(8, 8)); } catch (error) { usable = false; counts.push(`webgl SKIP (${error.message})`); }
    if (usable) counts.push(`webgl ${await run('webgl', () => {
      const canvas = createCanvas(8, 8);
      return new WebGL.Executor({ canvas, backend: new WebGLBackend(canvas) });
    })}`);
  } else counts.push(`webgl SKIP (${hgl.available() ? '--software-only' : hgl.unavailableReason()})`);
  console.log(`PASS D3DIM texture stages through the 09aj cascade: ${counts.join(', ')} cases`);
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
