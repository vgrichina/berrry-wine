#!/usr/bin/env node
'use strict';
// NFS-style integer edges and half-texel UVs through the WAT GPU stream
// producer into the software executor, for 565, X1/A1 555, 4444 and 32-bit
// targets: a 4x4 quad at integer pixel edges samples texel row y-origin, and
// the stored pixel is S*As + D*(1-As) in the target's native component bits,
// byte-identical to the WAT software rasterizer ($d3dim_gpu_on = 0). A
// diffuse-only selector must fail the same oracle. Ported from the deleted
// WebGL test-d3dim-gpu-edge-web.js (public-COM page fixture over D3DIMGpu).
const assert = require('assert');
const { bootGpsDevice } = require('./helpers/d3dim-gps-device');

(async () => {
  const g = await bootGpsDevice(), { e, m } = g;
  const vertices = e.guest_alloc(256);
  const tex = g.surface(4, 4, { caps: 0x1000, pf: g.PF.argb32 });
  const declined = [];
  for (const target of ['rgb565', 'x1', 'a1', 'a4', 'rgb32']) {
    const pf = g.PF[target], bpp = pf[1];
    const widths = pf.slice(2).map(v => { let n = 0; while (v) { n += v & 1; v >>>= 1; } return n; });
    const shifts = pf.slice(2).map(v => { let n = 0; while (v && !(v & 1)) { n++; v >>>= 1; } return n; });
    const encode = rgba => rgba.reduce((p, b, i) => p | (((b >>> (8 - widths[i])) << shifts[i]) & pf[i + 2]), 0) >>> 0;
    const results = {};
    for (const gpu of [1, 0]) for (const negative of [null, ...(target === 'rgb565' ? ['diffuse'] : [])]) {
      g.setGpu(gpu);
      const rt = g.surface(8, 8, { caps: 0x2840, pf }), dev = g.device(rt);
      const rs = (r, v) => e.gd_rs(dev, r, v), tss = (t, v) => e.gd_tss(dev, 0, t, v);
      for (const [id, v] of [[7, 0], [9, 1], [14, 0], [15, 0], [19, 5], [20, 6], [22, 1], [27, 1], [28, 0], [41, 0], [137, 0]]) rs(id, v);
      e.gd_bind(dev, 0, tex);
      for (const [id, v] of [[1, 4], [2, negative === 'diffuse' ? 0 : 2], [3, 0], [4, 4], [5, 2], [6, 0], [13, 1], [14, 1], [16, 1], [17, 1], [18, 0]]) tss(id, v);
      e.gd_tss(dev, 1, 1, 1);
      const cases = [];
      let failed = null;
      for (const alpha of [0, 85, 170, 255]) for (const shape of ['diagonal', 'other-diagonal', 'offset']) {
        const o = shape === 'offset' ? 2 : 0;
        // Row zero is the roof; other rows are transparent. The colour tells a
        // missing texture selector from the white diffuse.
        const color = alpha === 255 ? [0, 0, 0] : [51, 153, 204];
        for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) m.setUint32(g.dib(tex) + y * g.pitch(tex) + x * 4,
          y === 0 ? ((alpha * 0x1000000) + (color[0] << 16) + (color[1] << 8) + color[2]) >>> 0 : 0, true);
        g.cpuWrote(tex);
        g.fence();
        const white = encode([255, 255, 255, 255]);
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
          const p = g.dib(rt) + y * g.pitch(rt) + x * bpp / 8;
          if (bpp === 16) m.setUint16(p, white, true); else m.setUint32(p, white, true);
        }
        g.cpuWrote(rt);
        const corners = [[0, 0], [4, 0], [4, 4], [0, 4]], order = shape === 'other-diagonal' ? [0, 1, 3, 1, 2, 3] : [0, 1, 2, 0, 2, 3];
        g.vertices(vertices, order.map(k => { const [x, y] = corners[k]; return [x + o, y + o, .5, 1, 0xffffffff, 0, (x + .5) / 4, (y + .5) / 4]; }));
        e.gd_draw(dev, 4, vertices, 6); g.fence();
        const product = [...color, alpha].map(v => (v * alpha + 255 * (255 - alpha)) / 255);
        const lo = encode(product.map(Math.floor)), hi = encode(product.map(Math.ceil));
        assert.strictEqual(lo, hi, 'oracle independent of framebuffer byte rounding');
        const actual = [], expected = [];
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
          const p = g.dib(rt) + y * g.pitch(rt) + x * bpp / 8, raw = bpp === 16 ? m.getUint16(p, true) : m.getUint32(p, true) >>> 0;
          actual.push(bpp === 32 ? raw & 0xffffff : raw); expected.push(x >= o && x < o + 4 && y === o ? (bpp === 32 ? lo & 0xffffff : lo) : (bpp === 32 ? white & 0xffffff : white));
        }
        cases.push(actual);
        if (!failed && JSON.stringify(actual) !== JSON.stringify(expected)) failed = `${alpha}/${shape}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`;
      }
      const label = `${gpu ? 'GPS' : 'WAT software'} ${target}`;
      if (negative) { assert(failed, label + ' diffuse-only selector must fail the roof pixel oracle'); continue; }
      assert(!failed, 'ROOF PIXEL ORACLE ' + label + ' ' + failed);
      results[gpu] = cases;
    }
    assert.deepStrictEqual(results[1], results[0], `${target}: GPS and WAT software store identical native pixels`);
    if (g.stat(14)) declined.push(target);
  }
  const s = g.stats();
  assert.strictEqual(s.fallbacks, 0, 'no software fallback');
  console.log(`PASS GPS producer roof edges: 5 targets x 12 cases match the native oracle and WAT software byte for byte (draws=${s.draws} declined=${s.declined})`);
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
