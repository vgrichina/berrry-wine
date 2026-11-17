#!/usr/bin/env node
'use strict';
// Colour-keyed mip chains through the WAT GPU stream producer, with the real SetColorKey handler on every level:
// with COLORKEYBLENDENABLE (state 144) key-to-zero precedes spatial and mip
// filtering, so a fully keyed level reads as transparent black, a linear mip
// blend halves the unkeyed neighbour, and an alpha blend over a keyed level
// keeps the destination. Without 144 a keyed mip chain is the documented
// software trap ('D3DIM:keyed mip filtering'). Ported from the deleted
// WebGL/Worker modes of test-d3dim-keyed-mip-public-web.js and
// test-d3dim-keyed-mip-formats-web.js (whose software route stays there).
const assert = require('assert');
const { bootGpsDevice } = require('./helpers/d3dim-gps-device');

const KEY = 0xffff00ff, BG = 0xff111111;
const MIP_POINT = 2, MIP_LINEAR = 3; // DirectX 7 d3dtypes.h

async function arm() {
  const label = 'GPS';
  const g = await bootGpsDevice(), { e, m } = g;
  const vertices = e.guest_alloc(256), key = e.guest_alloc(16);
  const rt = g.surface(32, 32), dev = g.device(rt);
  const tex = g.surface(16, 16, { caps: 0x401008 }), levels = [];
  for (let s = tex; s; s = e.gd_next(s) >>> 0) levels.push(s);
  assert.strictEqual(levels.length, 5, 'five levels');
  // Level 1 is entirely the key colour; the rest are opaque solids.
  const colors = [0xffff0000, KEY, 0xff0000ff, 0xffffffff, 0xffffff00];
  levels.forEach((s, i) => g.fill32(s, colors[i]));
  g.w32(key, KEY & 0xffffff); g.w32(key + 4, KEY & 0xffffff);
  for (const s of levels) assert.strictEqual(e.gd_key(s, key) >>> 0, 0, 'SetColorKey');
  const tss = (t, v) => e.gd_tss(dev, 0, t, v), rs = (r, v) => e.gd_rs(dev, r, v);
  e.gd_bind(dev, 0, tex); rs(22, 1); rs(7, 0); rs(27, 0); rs(15, 0);
  tss(1, 2); tss(2, 2); tss(4, 2); tss(5, 2); tss(13, 1); tss(14, 1); tss(16, 1); tss(17, 1); tss(18, MIP_POINT);
  rs(41, 1); rs(144, 1);
  let checks = 0;
  const draw = n => {
    g.fence(); g.fill32(rt, BG);
    g.vertices(vertices, [[0, 0], [32, 0], [0, 32]].map(([x, y], i) => [x, y, .5, 1, 0xffffffff, 0, i === 1 ? n : 0, i === 2 ? n : 0]));
    const before = g.stat(0);
    e.gd_draw(dev, 4, vertices, 3); g.fence();
    assert.strictEqual(g.stat(0), before + 1, 'draw lowered by the producer'); assert.strictEqual(g.stat(14), 0, 'no decline');
  };
  const expect = (name, c, tol = 2) => {
    const got = m.getUint32(g.dib(rt) + 4 * g.pitch(rt) + 16, true) >>> 0;
    for (let b = 0; b < 3; b++) assert(Math.abs((got >>> (8 * b) & 255) - (c >>> (8 * b) & 255)) <= tol,
      `${label} ${name}: pixel ${got.toString(16)} expected ${c.toString(16)}`);
    checks++;
  };
  draw(2); expect('unkeyed level 0', colors[0]);
  draw(4); expect('fully keyed level 1 is transparent black', 0xff000000);
  draw(8); expect('unkeyed level 2', colors[2]);
  tss(18, MIP_LINEAR); draw(2 * Math.sqrt(8));
  expect('keyed level zeroed before the level 1/2 mip blend', 0xff000080, 3);
  tss(18, MIP_POINT); rs(27, 1); rs(19, 5); rs(20, 6);
  draw(4); expect('SRCALPHA blend over a keyed level keeps the destination', BG);
  draw(8); expect('SRCALPHA blend of an opaque level replaces it', colors[2]);
  rs(27, 0);
  // State 144 FALSE: keyed mip filtering has no defined result; it traps.
  rs(144, 0);
  let trapped = false;
  try { draw(4); } catch (error) { trapped = error instanceof WebAssembly.RuntimeError; }
  assert(trapped, `${label}: keyed mip chain without COLORKEYBLENDENABLE traps`);
  return { checks, s: g.stats() };
}

(async () => {
  const gps = await arm();
  console.log(`PASS GPS producer keyed mip chains: ${gps.checks} GPS pixel checks; ` +
    `GPS draws=${gps.s.draws} textureUploads=${gps.s.textureUploads} fallbacks=${gps.s.fallbacks}`);
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
