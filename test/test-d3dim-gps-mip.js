#!/usr/bin/env node
'use strict';
// D3D7 mip-chain sampling through the WAT GPU stream producer
// ($d3dim_gpu_on = 1) into the software executor: the real CreateSurface /
// CreateDevice / SetTexture / state / draw closure, pixels read back only
// by the producer's own fence. Ported from the deleted WebGL
// test-d3dim-gpu-mip-web.js; the WAT-software twin is test-d3dim-native-mip.js.
const assert = require('assert');
const { bootGpsDevice } = require('./helpers/d3dim-gps-device');

(async () => {
  const g = await bootGpsDevice(), { e, m } = g;
  const vertices = e.guest_alloc(256), caps = e.guest_alloc(256);
  const rt = g.surface(32, 32);
  let dev = g.device(rt);
  const tex = g.surface(16, 16, { caps: 0x401008 }), levels = [];
  for (let s = tex; s; s = e.gd_next(s) >>> 0) { levels.push(s); assert(levels.length <= 5, 'bounded creation'); }
  assert.strictEqual(levels.length, 5, 'five levels');
  const colors = [0xffff0000, 0xff00ff00, 0xff0000ff, 0xffffffff, 0xffffff00];
  levels.forEach((s, i) => g.fill32(s, colors[i]));
  const tss = (t, v) => e.gd_tss(dev, 0, t, v), rs = (r, v) => e.gd_rs(dev, r, v);
  const bind = () => { e.gd_bind(dev, 0, tex); rs(22, 1); rs(7, 0); rs(27, 0); tss(1, 2); tss(2, 2); tss(4, 2); tss(5, 2); tss(13, 1); tss(14, 1); };
  bind();
  const MIP_NONE = 1, MIP_POINT = 2, MIP_LINEAR = 3; // DirectX 7 d3dtypes.h, not D3DTEXF.
  const stage = (min = 1, mag = 1, mip = MIP_POINT) => { tss(17, min); tss(16, mag); tss(18, mip); };
  let checks = 0;
  function draw(n, { q = [1, 1, 1], uv = null } = {}) {
    g.fence(); g.fill32(rt, 0xff111111);
    g.vertices(vertices, [[0, 0], [32, 0], [0, 32]].map(([x, y], i) =>
      [x, y, 0.5, q[i], 0xffffffff, 0, uv ? uv[i][0] : i === 1 ? n : 0, uv ? uv[i][1] : i === 2 ? n : 0]));
    const before = g.stat(0);
    e.gd_draw(dev, 4, vertices, 3); g.fence();
    assert(g.stat(0) > before, 'draw reached the GPU stream producer');
    assert.strictEqual(g.stat(1), 0, 'no software fallback');
  }
  const pixel = (x = 4, y = 4) => m.getUint32(g.dib(rt) + y * g.pitch(rt) + x * 4, true) >>> 0;
  function expect(label, c, x = 4, y = 4, tol = 2) {
    const got = pixel(x, y);
    for (let b = 0; b < 3; b++) assert(Math.abs((got >>> (8 * b) & 255) - (c >>> (8 * b) & 255)) <= tol,
      `${label} pixel ${got.toString(16)} expected ${c.toString(16)}`);
    checks++;
  }
  stage(); for (const [n, l] of [[.5, 0], [2, 0], [4, 1], [8, 2], [16, 3], [32, 4], [65536, 4]]) { draw(n); expect('nearest footprint ' + n / 2, colors[l]); }
  stage(1, 1, MIP_NONE); draw(32); expect('MIP NONE stays level zero', colors[0]);
  stage(1, 1, MIP_LINEAR); draw(2 * Math.sqrt(8)); expect('linear mip green/blue blend', 0xff008080);
  stage(2, 2, MIP_LINEAR); draw(2 * Math.sqrt(8)); expect('trilinear green/blue blend', 0xff008080);
  stage(); draw(16, { q: [1, .25, .25] });
  // Independent quotient-rule footprint at D3D integer pixel centres; points
  // away from LOD borders.
  for (const [x, y] of [[1, 1], [8, 1], [14, 1], [20, 1], [27, 1]]) {
    const Q = 1 - 3 * (x + y) / 128, U = x / 8, V = y / 8, dux = (.125 * Q + U * 3 / 128) / Q ** 2, duy = U * 3 / 128 / Q ** 2,
      dvx = V * 3 / 128 / Q ** 2, dvy = (.125 * Q + V * 3 / 128) / Q ** 2;
    const rho = 16 * Math.sqrt(Math.max(dux ** 2 + dvx ** 2, duy ** 2 + dvy ** 2)), l = Math.min(4, Math.max(0, Math.floor(Math.log2(rho) + .5)));
    expect('perspective rho ' + rho, colors[l], x, y);
  }
  stage(); draw(0, { uv: [[.25, 0], [.25, 0], [.25, 16]] }); expect('vertical minification', colors[3]);
  // MIN/MAG must switch with the footprint.
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) m.setUint32(g.dib(tex) + y * g.pitch(tex) + 4 * x, x % 2 ? 0xffffffff : 0xff000000, true);
  g.cpuWrote(tex);
  stage(1, 2, MIP_NONE); draw(.5, { uv: [[.25, .25], [.75, .25], [.25, .75]] }); expect('MAG linear', 0xff7f7f7f);
  draw(4); expect('MIN point', 0xff000000);
  stage(2, 1, MIP_NONE); draw(.5, { uv: [[.25, .25], [.75, .25], [.25, .75]] }); expect('MAG point', 0xffffffff);
  draw(4); expect('MIN linear', 0xff7f7f7f);
  levels.forEach((s, i) => g.fill32(s, colors[i]));
  // Each level owns metadata; bad successors stop instead of following them.
  const a = g.entry(levels[1]), link = m.getUint32(a + 8, true), size = m.getUint32(a + 12, true), b = g.entry(levels[2]), savedDib = m.getUint32(b + 20, true);
  stage(); m.setUint32(a + 8, 0, true); draw(32); expect('partial chain clamps', colors[1]); m.setUint32(a + 8, link, true);
  m.setUint32(b + 20, 0, true); draw(32); expect('missing DIB clamps', colors[1]); m.setUint32(b + 20, savedDib, true);
  m.setUint32(a + 8, tex, true); draw(32); expect('cycle bounded', colors[1]); m.setUint32(a + 8, link, true);
  m.setUint32(a + 8, 0xfffffff8, true); draw(32); expect('invalid wrapper bounded', colors[1]); m.setUint32(a + 8, link, true);
  m.setUint32(a + 12, 0x00070007, true); draw(32); expect('malformed dimensions bounded', colors[0]); m.setUint32(a + 12, size, true);
  e.gd_flags(levels[2], 0x20000); draw(32); expect('depth attachment is not a mip', colors[1]); e.gd_flags(levels[2], 0x401008);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) m.setUint32(g.dib(levels[1]) + y * g.pitch(levels[1]) + 4 * x, x % 2 ? 0xffffffff : 0xff000000, true);
  g.cpuWrote(levels[1]);
  stage(1, 2, MIP_POINT); draw(4); expect('mip1 uses MIN point', 0xff000000);
  g.fill32(levels[1], colors[1]); stage();
  // A level's own pitch and format: padded RGB565.
  const packed = m.getUint32(a + 16, true); e.gd_format(levels[1], 1); m.setUint32(a + 16, (20 << 16) | 16, true);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) m.setUint16(g.dib(levels[1]) + y * 20 + x * 2, 0xf81f, true);
  e.page_watch_write(g.dib(levels[1]), 20 * 8);
  draw(4); expect('per-level RGB565 padded pitch', 0xffff00ff); m.setUint32(a + 16, packed, true); e.gd_format(levels[1], 0); g.fill32(levels[1], colors[1]);
  const short = g.surface(16, 16, { caps: 0x401008, count: 2 }); g.fill32(short, colors[0]); g.fill32(e.gd_next(short) >>> 0, colors[1]);
  e.gd_bind(dev, 0, short); draw(65536); expect('declared two levels clamp', colors[1]); e.gd_bind(dev, 0, tex);
  // A lower-level byte change must invalidate its upload independently.
  g.fill32(levels[2], 0xffff00ff); draw(8); expect('changed mip2 uploaded', 0xffff00ff);
  g.fill32(levels[2], colors[2]); draw(8); expect('restored mip2 uploaded', colors[2]);
  // Legacy combined filters, plus an explicit stage NONE override.
  // Same expectations as the WAT software reference (test-d3dim-native-mip.js):
  // 3/4 select one level, 5/6 blend the two nearest.
  for (const [f, c] of [[3, colors[2]], [4, colors[2]], [5, 0xff006699], [6, 0xff006699]]) { dev = g.device(rt); bind(); rs(17, 1); rs(18, f); draw(2 * 2 ** 1.6); expect('legacy filter ' + f, c); }
  tss(18, MIP_NONE); draw(32); expect('explicit NONE overrides legacy', colors[0]);
  e.gd_caps(caps); assert.strictEqual(e.guest_read32(caps + 96) >>> 0, 0x030303ff, 'implemented triangle mip caps');
  assert.strictEqual(e.guest_read32(caps + 40) >>> 0, 0x030003c3, 'line caps unchanged');
  const s = g.stats();
  assert(s.draws > 0 && s.textureUploads > 0, 'producer drew and uploaded textures');
  assert.strictEqual(s.fallbacks, 0);
  console.log(`PASS GPS producer D3D7 mip-chain sampling: ${checks} pixel checks, draws=${s.draws} texUploads=${s.textureUploads} readbacks=${s.readbacks}`);
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
