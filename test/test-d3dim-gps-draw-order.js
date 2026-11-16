#!/usr/bin/env node
'use strict';
// Draw ordering through the WAT GPU stream producer into the software
// executor: alpha-blended draws composite in submission order, a state change
// between them keeps that order, a clear cannot overtake earlier geometry, and
// rewriting a texture's bytes between draws leaves the earlier draws with the
// old texels. Ported from the deleted WebGL test-d3dim-gpu-batching-web.js
// (its batchDraws on/off A/B and mergedDraws count were executor internals).
const assert = require('assert');
const { bootGpsDevice } = require('./helpers/d3dim-gps-device');

(async () => {
  const g = await bootGpsDevice(), { e, m } = g;
  const vertices = e.guest_alloc(256);
  const rt = g.surface(8, 8, { caps: 0x2840 }), dev = g.device(rt);
  const tex = g.surface(1, 1, { caps: 0x1000 });
  const rs = (r, v) => e.gd_rs(dev, r, v), tss = (t, v) => e.gd_tss(dev, 0, t, v);
  rs(7, 0); rs(22, 1); rs(27, 1); rs(19, 5); rs(20, 6);
  const diffuse = () => { tss(1, 2); tss(2, 0); tss(4, 2); tss(5, 0); };
  diffuse();
  g.fill32(rt, 0xff000000);
  const draw = (color, pts = [[-1, -1], [20, -1], [-1, 20]]) => {
    g.vertices(vertices, pts.map(([x, y]) => [x, y, .5, 1, color, 0, .5, .5]));
    const before = g.stat(0); e.gd_draw(dev, 4, vertices, 3);
    assert.strictEqual(g.stat(0), before + 1, 'producer took the draw');
  };
  const pixel = (x = 2, y = 2) => { const v = m.getUint32(g.dib(rt) + y * g.pitch(rt) + x * 4, true); return [v >>> 16 & 255, v >>> 8 & 255, v & 255]; };
  const near = (actual, expected, label) => assert(actual.every((v, i) => Math.abs(v - expected[i]) <= 2), `${label}: ${actual} != ${expected}`);

  // Alpha compositing is order-dependent: blue over green over red over black.
  draw(0x80ff0000); draw(0x8000ff00); draw(0x800000ff); g.fence();
  near(pixel(), [32, 64, 128], 'blue over green over red');
  // An opaque draw with blending off between two blended ones.
  draw(0x80ff0000); draw(0x8000ff00);
  rs(27, 0); draw(0xffffff00); rs(27, 1); draw(0x800000ff); g.fence();
  near(pixel(), [127, 127, 128], 'state change keeps submission order');
  // A clear cannot overtake earlier geometry.
  draw(0x80ff0000); draw(0x8000ff00);
  assert.strictEqual(e.gd_clear(rt, 1, 0xff000000, 1, 0, 0, 8, 8), 1, 'producer takes the clear');
  g.fence();
  assert.deepStrictEqual(pixel(), [0, 0, 0], 'clear follows queued geometry');
  // Same texture surface, new bytes: earlier draws keep the old texels.
  rs(27, 0); e.gd_bind(dev, 0, tex); tss(1, 2); tss(2, 2); tss(4, 2); tss(5, 2);
  const half = (left, right) => {
    draw(0xffffffff, [[left, -.5], [right, -.5], [left, 7.5]]);
    draw(0xffffffff, [[right, -.5], [right, 7.5], [left, 7.5]]);
  };
  g.fill32(tex, 0xffff0000); half(-.5, 3.5); half(-.5, 3.5);
  g.fill32(tex, 0xff00ff00); half(3.5, 7.5); g.fence();
  assert.deepStrictEqual(pixel(1, 3), [255, 0, 0], 'old texture generation retained on left');
  assert.deepStrictEqual(pixel(6, 3), [0, 255, 0], 'replacement texture visible on right');
  const s = g.stats();
  assert.strictEqual(s.fallbacks, 0, 'no software fallback');
  assert(s.textureUploads >= 2, 'the rewritten texture was uploaded again');
  console.log(`PASS GPS producer draw ordering: alpha order, state change, clear after geometry, texture rewrite (draws=${s.draws} texUploads=${s.textureUploads})`);
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
