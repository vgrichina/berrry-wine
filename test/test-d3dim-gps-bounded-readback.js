#!/usr/bin/env node
'use strict';
// Bounded readback in the WAT GPU stream producer (src/09abg-d3dim-gps.wat):
// a fence reads back only the union of what the GPU changed ($d3g_mark's dirty
// rect), a depth-only clear reads nothing, a draw with a negative rhw falls
// back to the whole target, and CPU writes outside the GPU's rect survive.
// Ported from the deleted WebGL test-d3dim-bounded-readback-web.js (whose
// boundedReadback A/B and _submit colorBounds probes were executor internals).
const assert = require('assert');
const { bootGpsDevice } = require('./helpers/d3dim-gps-device');

(async () => {
  const g = await bootGpsDevice(), { e, m } = g;
  const vertices = e.guest_alloc(256);
  for (const [name, pf, bpp] of [['32-bit', 'rgb32', 32], ['16-bit', 'rgb565', 16]]) {
    const W = 32, H = 32, rt = g.surface(W, H, { caps: 0x2840, pf: g.PF[pf] }), dev = g.device(rt);
    const pitch = g.pitch(rt), Bpp = bpp / 8, full = W * H * Bpp;
    const rs = (r, v) => e.gd_rs(dev, r, v), tss = (t, v) => e.gd_tss(dev, 0, t, v);
    rs(7, 0); rs(22, 1); rs(27, 0); rs(19, 5); rs(20, 6); tss(1, 2); tss(2, 0); tss(4, 2); tss(5, 0);
    const put = (x, y, [r, gg, b]) => {
      const p = g.dib(rt) + y * pitch + x * Bpp;
      if (bpp === 32) m.setUint32(p, 0xff000000 | (r << 16) | (gg << 8) | b, true);
      else m.setUint16(p, ((r >> 3) << 11) | ((gg >> 2) << 5) | (b >> 3), true);
    };
    const get = (x, y) => {
      const p = g.dib(rt) + y * pitch + x * Bpp;
      if (bpp === 32) { const v = m.getUint32(p, true); return [v >>> 16 & 255, v >>> 8 & 255, v & 255]; }
      const v = m.getUint16(p, true), r = v >> 11, gg = (v >> 5) & 63, b = v & 31;
      return [(r << 3) | (r >> 2), (gg << 2) | (gg >> 4), (b << 3) | (b >> 2)];
    };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) put(x, y, [16, 32, 66]); // exact in RGB565
    g.cpuWrote(rt);
    const draw = (color, pts, prim = 4, rhw = 1) => {
      g.vertices(vertices, pts.map(([x, y]) => [x, y, .5, rhw, color]));
      const before = g.stat(0); e.gd_draw(dev, prim, vertices, pts.length);
      assert.strictEqual(g.stat(0), before + 1, name + ' producer took the draw');
    };
    // Bytes the next fence reads back.
    const fenced = () => { const b = g.stat(34); g.fence(); return g.stat(34) - b; };

    draw(0xffff0000, [[2, 2], [9, 2], [2, 9]]);
    const small = fenced();
    assert(small > 0 && small < full / 4, `${name} small triangle reads a strict subrectangle (${small} of ${full})`);
    assert.deepStrictEqual(get(3, 3), [255, 0, 0]);
    assert.deepStrictEqual(get(20, 20), [16, 32, 66], 'outside the GPU rect keeps the CPU pixels');
    assert.strictEqual(fenced(), 0, 'a clean target reads nothing');

    // Disjoint draws: the union, not the target.
    draw(0xff00ff00, [[2, 2], [9, 2], [2, 9]]); draw(0xff00ff00, [[15, 2], [22, 2], [15, 9]]);
    const union = fenced();
    assert(union > small && union < full / 2, `${name} disjoint draws read their union (${union})`);

    assert.strictEqual(e.gd_clear(rt, 1, 0xffffff00, 1, 20, 20, 4, 3), 1, 'producer takes the partial clear');
    assert.strictEqual(fenced(), 4 * 3 * Bpp, `${name} partial clear reads exactly its rect`);
    assert.deepStrictEqual(get(21, 21), [255, 255, 0]);
    assert.strictEqual(e.gd_clear(rt, 2, 0, 1, 0, 0, W, H), 1, 'producer takes the depth-only clear');
    assert.strictEqual(fenced(), 0, 'depth-only clear needs no colour readback');

    // A CPU write after the GPU drew: uploaded, kept, and blended over.
    put(28, 28, [255, 0, 255]); g.cpuWrote(rt);
    draw(0xffff0000, [[2, 12], [8, 12], [2, 18]]); fenced();
    assert.deepStrictEqual(get(28, 28), [255, 0, 255], 'CPU pixel outside GPU bounds survives');
    rs(27, 1); draw(0x8000ff00, [[26, 26], [31, 26], [26, 31]]); fenced(); rs(27, 0);
    assert(get(28, 28).every((v, i) => Math.abs(v - [127, 128, 127][i]) <= 8), 'GPU blends the uploaded CPU change: ' + get(28, 28));

    // A full colour clear saturates the rect.
    assert.strictEqual(e.gd_clear(rt, 1, 0xff000000, 1, 0, 0, W, H), 1);
    draw(0xffffff00, [[2, 2], [9, 2], [2, 9]]);
    assert.strictEqual(fenced(), full, `${name} full clear + draw reads the whole target`);
    assert.deepStrictEqual(get(3, 3), [255, 255, 0]);

    // Lines and edge-touching geometry stay inside the target.
    draw(0xffffffff, [[0, 31], [31, 31], [31, 0]], 3); draw(0xff00ffff, [[-.5, -.5], [5.5, -.5], [-.5, 5.5]]);
    const edges = fenced();
    assert(edges > 0 && edges <= full, `${name} edges and lines bounded (${edges})`);

    // A negative homogeneous w cannot be bounded: the whole target.
    draw(0xffff0000, [[4, 4], [6, 4], [4, 6]], 4, -1);
    assert.strictEqual(fenced(), full, `${name} negative W uses the conservative full target`);
    const s = g.stats();
    assert.strictEqual(s.fallbacks, 0, 'no software fallback');
    console.log(`PASS ${name}: small=${small} union=${union} edges=${edges} of ${full} bytes; readbacks=${s.readbacks}`);
  }
  console.log('PASS GPS producer bounded readback: dirty-rect union, clears, depth-only, CPU writes, lines/edges, negative W');
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
