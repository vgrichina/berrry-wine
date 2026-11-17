#!/usr/bin/env node
'use strict';
// D3D POINTLIST through the WAT GPU stream producer ($d3g_points: 2x2 quads,
// D3D integer snapping, viewport clip, native-format storage) into the
// software executor, against an independent native-pixel oracle, for 565,
// 555, A1 555 and 32-bit targets (the producer lowers all four). Texture,
// blend and alpha are ignored by points; a later triangle gets its blending
// back. Ported from the deleted WebGL test-d3dim-gpu-points-web.js (its
// batchDraws/boundedReadback option matrix and WebGL1/2 split were executor
// internals; depth is covered by test-d3dim-gpu-points.js).
const assert = require('assert');
const { bootGpsDevice } = require('./helpers/d3dim-gps-device');

const points = [[-.51, 1.49, 0x00123456], [-.5, -.5, 0x804a92d3],
  [2.4999998, 3.5, 0xffd78129], [6.5, 6.5, 0x00336699],
  [2, 3, 0x00abcdef], [4, 0, 0x7f4a92d3], [4, 2, 0x804a92d3], ['NaN', 5, 0x00e13277], ['Infinity', 0, 0xff123456],
  [-1000001, -1000001, 0xff123456], [1000001, 1000001, 0xff123456]];
function nativePointOracle(c) {
  const bytes = Uint8Array.from(c.initial), view = new DataView(bytes.buffer);
  const masks = c.format === 1 ? [0xf800, 0x7e0, 31, 0] : c.format === 2 ? [0x7c00, 0x3e0, 31, 0] : [0x7c00, 0x3e0, 31, 0x8000];
  const coord = value => { const f = Math.fround(Number(value));
    return Number.isNaN(f) ? 0 : Math.floor(Math.fround(Math.max(-1000000, Math.min(1000000, f)) + .5)); };
  for (const [x, y, color] of c.points) {
    const left = coord(x), top = coord(y);
    let packed = color >>> 0;
    if (c.bpp === 16) packed = masks.reduce((p, mask, i) => {
      let m = mask, shift = 0, width = 0; while (m && !(m & 1)) { shift++; m >>>= 1; } while (m) { width += m & 1; m >>>= 1; }
      const channel = (color >>> [16, 8, 0, 24][i]) & 255;
      return p | (((channel >>> (8 - width)) << shift) & mask);
    }, 0);
    for (let py = 0; py < 8; py++) for (let px = 0; px < 8; px++) {
      if (px < left || px >= left + 2 || py < top || py >= top + 2) continue;
      if (c.clip && (px < c.clip[0] || py < c.clip[1] || px >= c.clip[2] || py >= c.clip[3])) continue;
      const offset = py * c.pitch + px * c.bpp / 8;
      if (c.bpp === 16) view.setUint16(offset, packed, true); else view.setUint32(offset, packed, true);
    }
  }
  return Array.from(bytes);
}

(async () => {
  const g = await bootGpsDevice(), { e, m } = g;
  const vertices = e.guest_alloc(512), tex = g.surface(2, 2, { caps: 0x1000 });
  const pfName = { 1: 'rgb565', 2: 'x1', 3: 'a1', 6: 'rgb32' };
  let n = 0;
  for (const format of [1, 2, 3, 6]) for (const clip of [null, [1, 2, 7, 6]]) {
    const bpp = format === 6 ? 32 : 16;
    const rt = g.surface(8, 8, { caps: 0x2840, pf: g.PF[pfName[format]] }), dev = g.device(rt);
    const rs = (r, v) => e.gd_rs(dev, r, v), tss = (t, v) => e.gd_tss(dev, 0, t, v);
    // Everything points must ignore: a bound texture, blending, alpha test, fog.
    e.gd_bind(dev, 0, tex); tss(1, 4); tss(2, 2); tss(3, 0);
    rs(7, 0); rs(22, 1); rs(27, 1); rs(19, 5); rs(20, 6); rs(15, 1); rs(24, 255); rs(25, 7); rs(28, 1);
    if (clip) e.gd_vprect(dev, clip[0], clip[1], clip[2] - clip[0], clip[3] - clip[1]);
    const c = { format, bpp, clip, pitch: g.pitch(rt),
      points: points.map(([x, y, col]) => [x, y, format === 6 ? (col | 0xff000000) >>> 0 : col]) };
    c.initial = Array.from({ length: c.pitch * 8 }, (_, i) => (i * 37 + 11) & 255);
    new Uint8Array(g.memory().buffer).set(c.initial, g.dib(rt)); g.cpuWrote(rt);
    const draw = list => {
      g.vertices(vertices, list.map(([x, y, col]) => [Number(x), Number(y), NaN, -1, col]));
      e.gd_draw(dev, 1, vertices, list.length);
    };
    const before = g.stat(12), declinedBefore = g.stat(14);
    // One multi-point call, then single points reusing the guest buffer.
    draw(c.points.slice(0, 2)); c.points.slice(2).forEach(p => draw([p]));
    new Uint8Array(g.memory().buffer).fill(255, vertices, vertices + 64);
    g.fence();
    const actual = Array.from(new Uint8Array(g.memory().buffer, g.dib(rt), c.pitch * 8));
    const label = `GPS format${format}${clip ? ' clipped' : ''}`;
    // X1R5G5B5's top bit and X8R8G8B8's top byte are unused (DDPF has no
    // mask for them): the executor sets them its own way when it lands the
    // target, so compare them out.
    const unusedX = bytes => format === 2 ? bytes.map((b, i) => i & 1 ? b & 0x7f : b)
      : format === 6 ? bytes.map((b, i) => (i & 3) === 3 ? 0 : b) : bytes;
    assert.deepStrictEqual(unusedX(actual), unusedX(nativePointOracle(c)), label + ' independent native bytes');
    assert.strictEqual(g.stat(12) - before, points.length, label + ' every point lowered by the producer');
    assert.strictEqual(g.stat(14), declinedBefore, label + ' nothing declined');
    assert.strictEqual(g.stat(1), 0, 'no software fallback');
    n++;
  }

  // Blending is ignored by a point and restored for the next triangle.
  const rt = g.surface(8, 8, { caps: 0x2840, pf: g.PF.rgb565 }), dev = g.device(rt);
  const rs = (r, v) => e.gd_rs(dev, r, v), tss = (t, v) => e.gd_tss(dev, 0, t, v);
  tss(1, 2); tss(2, 0); tss(4, 2); tss(5, 0); rs(7, 0); rs(22, 1); rs(27, 1); rs(19, 5); rs(20, 6);
  new Uint8Array(g.memory().buffer).fill(0, g.dib(rt), g.dib(rt) + g.pitch(rt) * 8); g.cpuWrote(rt);
  g.vertices(vertices, [[2, 2, .5, 1, 0x00ff0000]]); e.gd_draw(dev, 1, vertices, 1);
  g.vertices(vertices, [[-10, -10, 0, 1, 0x000000ff], [30, -10, 0, 1, 0x000000ff], [-10, 30, 0, 1, 0x000000ff]]); e.gd_draw(dev, 4, vertices, 3);
  g.fence();
  assert.strictEqual(m.getUint16(g.dib(rt) + 2 * g.pitch(rt) + 2 * 2, true), 0xf800,
    'alpha-zero point overwrites without blending; the alpha-zero triangle after it blends to nothing');
  console.log(`PASS GPS producer POINTLIST: ${n} native-oracle cases, clip, ignored texture/blend/alpha/fog, blend restored`);
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
