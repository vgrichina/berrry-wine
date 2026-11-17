#!/usr/bin/env node
'use strict';
// A viewport background image (D3DMATERIAL.hTexture) clears through the WAT
// GPU stream producer as the texture stretched nearest-neighbour over the
// viewport rect ($d3g_clear's textured blit): the texture wins over the
// diffuse colour, a CPU rewrite of the texture is re-uploaded, an inset rect
// leaves the outside alone. Ported from the deleted
// WebGL modes of test-d3dim-background-generated-web.js (its public-COM
// material/viewport handle plumbing is software-path API, unchanged).
const assert = require('assert');
const { bootGpsDevice } = require('./helpers/d3dim-gps-device');

// Independent nearest-neighbour reference: clip destination pixels, keep the
// original UV rectangle.
function oracle(colors, rect, outside, width = 12, height = 8) {
  const pixels = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const inside = x >= rect[0] && x < rect[0] + rect[2] && y >= rect[1] && y < rect[1] + rect[3];
    pixels.push(!inside ? outside : Array.isArray(colors[0])
      ? colors[Math.floor((y - rect[1] + .5) * 2 / rect[3]) * 4 + Math.floor((x - rect[0] + .5) * 4 / rect[2])]
      : colors);
  }
  return pixels;
}
const A = [[240, 16, 32], [16, 224, 48], [32, 48, 208], [208, 160, 16], [32, 192, 224], [192, 32, 176], [96, 160, 32], [160, 80, 224]];
const B = A.map(([r, g, b]) => [b, r, g]), OUTSIDE = [11, 22, 33], FULL = [0, 0, 12, 8], INSET = [2, 1, 8, 6];

(async () => {
  const g = await bootGpsDevice(), { e, m } = g;
  const vertices = e.guest_alloc(256);
  const rgb = c => 0xff000000 | (c[0] << 16) | (c[1] << 8) | c[2];
  const fill = (s, colors) => {
    for (let y = 0; y < g.height(s); y++) for (let x = 0; x < g.width(s); x++)
      m.setUint32(g.dib(s) + y * g.pitch(s) + x * 4, rgb(Array.isArray(colors[0]) ? colors[y * g.width(s) + x] : colors), true);
    g.cpuWrote(s);
  };
  const read = s => { const out = [];
    for (let y = 0; y < 8; y++) for (let x = 0; x < 12; x++) { const v = m.getUint32(g.dib(s) + y * g.pitch(s) + x * 4, true); out.push([v >>> 16 & 255, v >>> 8 & 255, v & 255]); }
    return out; };
  let observations = 0;
  {
    const rt = g.surface(12, 8, { caps: 0x2840 }), dev = g.device(rt);
    const texture = g.surface(4, 2, { caps: 0x1000 }), alternate = g.surface(4, 2, { caps: 0x1000 });
    fill(texture, A); fill(alternate, B);
    // The producer clears only a target the GPU has drawn on: prime it.
    const rs = (r, v) => e.gd_rs(dev, r, v), tss = (t, v) => e.gd_tss(dev, 0, t, v);
    rs(7, 0); rs(22, 1); rs(27, 0); tss(1, 2); tss(2, 0); tss(4, 2); tss(5, 0);
    g.vertices(vertices, [[-4, -4, .5, 1, 0xff0b1621], [32, -4, .5, 1, 0xff0b1621], [-4, 24, .5, 1, 0xff0b1621]]);
    e.gd_draw(dev, 4, vertices, 3); g.fence();
    const label = 'GPS';
    const observe = (name, tex, colors, rect = FULL, diffuse = [255, 255, 255]) => {
      const before = g.stat(9);
      assert.strictEqual(e.gd_clear(rt, 1, rgb(diffuse), 1, ...rect, tex), 1, `${label} ${name}: producer takes the clear`);
      g.fence();
      // A textured clear is a blit, not a CLEAR record; a colour clear counts.
      if (!tex) assert.strictEqual(g.stat(9), before + 1, name + ' counted as a GPU clear');
      assert.deepStrictEqual(read(rt), oracle(colors, rect, OUTSIDE), `PIXEL ORACLE ${label} ${name}`);
      observations++;
    };
    fill(rt, OUTSIDE);
    observe('4x2 texture beats white diffuse', texture, A);
    observe('diffuse mutation preserves texture', texture, A, FULL, [255, 0, 255]);
    fill(texture, B); observe('CPU texture rewrite re-uploaded', texture, B);
    observe('second texture', alternate, B);
    observe('texture removed uses diffuse', 0, [255, 0, 255], FULL, [255, 0, 255]);
    fill(texture, A); fill(rt, OUTSIDE); observe('inset viewport preserves outside', texture, A, INSET);
    observe('restored after removal', texture, A);
  }
  const s = g.stats();
  assert.strictEqual(s.fallbacks, 0, 'no software fallback');
  console.log(`PASS GPS producer textured background clear: ${observations} pixel-oracle observations, clears=${s.clears} readbacks=${s.readbacks}`);
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
