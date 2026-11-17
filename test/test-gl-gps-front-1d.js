#!/usr/bin/env node
'use strict';
// --gl-gps lowerings that used to decline:
//
//   front buffer (was reason 5): glDrawBuffer(GL_FRONT) draws and clears go
//     to the executor's front RT, which is PRESENTed after each draw command
//     (front-presents stat). Hexen II draws its loading plaque this way.
//   1D textures (was reasons 9/21): a non-mipmapped 1D texture with one
//     filter is a Wx1 TEX2D sampled at (s, 0.5).
//
// Pixels compared with the software path on the presented front buffer.
const assert = require('assert');
const { bothArms } = require('./helpers/gl-gps-context');

const ALL = 0x4500;

(async () => {
  {
    const r = await bothArms(g => {
      g.clear([0, 0, 0.5, 1], ALL);
      g.quad(-1, -1, 0, 0, [1, 0, 0, 1]);
      g.swap();
      g.call('glDrawBuffer', [0x404]);
      g.quad(-0.5, -0.5, 0.5, 0.5, [0, 1, 0, 1]);
      g.call('glClearColor', [g.f(1), g.f(1), g.f(0), g.f(1)]);
      g.call('glScissor', [12, 12, 4, 4]); g.call('glEnable', [0xc11]);
      g.call('glClear', [0x4000]);
      g.call('glDisable', [0xc11]);
      g.call('glFlush');
      g.call('glDrawBuffer', [0x405]);
    });
    const s = r.gp.stats();
    assert.ok(r.cmp.ok, `front-buffer draw matches: ${JSON.stringify(r.cmp)}`);
    assert.ok(!s.reasons[5], `no front-buffer declines: ${JSON.stringify(s.reasons)}`);
    assert.strictEqual(s.declines, 0, `no declines: ${JSON.stringify(s.reasons)}`);
    assert.ok(s.frontPresents >= 2, `front draws presented: ${s.frontPresents}`);
    // The front picture has all three layers: the swapped back (red/blue),
    // the front quad (green) and the scissored front clear (yellow).
    const at = (x, y) => r.gpPic.px[y * r.gpPic.w + x];
    const colors = new Set(r.gpPic.px);
    assert.ok(colors.has(0x00ff00) && colors.has(0xffff00) && colors.has(0xff0000), `layers present: ${[...colors].map(c => c.toString(16))}`);
    console.log(`PASS front-buffer draw + clear on the GPU (front presents ${s.frontPresents}, worst ${r.cmp.worst}, centre ${at(8, 8).toString(16)})`);
  }
  for (const filter of [0x2600, 0x2601]) for (const wrap of [0x2901, 0x812f]) {
    const r = await bothArms(g => {
      g.clear([0, 0, 0, 1], ALL);
      const px = g.e.guest_alloc(32) >>> 0, v = new Uint8Array(g.memory.buffer, g.wa(px), 32);
      for (let i = 0; i < 8; i++) v.set([i * 32, 255 - i * 32, (i & 1) * 255, 255], i * 4);
      g.call('glBindTexture', [0xde0, 3]);
      g.call('glTexImage1D', [0xde0, 0, 0x1908, 8, 0, 0x1908, 0x1401, px]);
      g.call('glTexParameteri', [0xde0, 0x2801, filter]);
      g.call('glTexParameteri', [0xde0, 0x2800, filter]);
      g.call('glTexParameteri', [0xde0, 0x2802, wrap]);
      g.call('glEnable', [0xde0]);
      g.quad(-1, -1, 1, 1, [1, 1, 1, 1], { t: [[-0.25], [1.25], [1.25], [-0.25]] });
      g.call('glDisable', [0xde0]);
      g.swap();
    });
    const s = r.gp.stats();
    assert.ok(r.cmp.ok, `1D filter ${filter.toString(16)} wrap ${wrap.toString(16)}: ${JSON.stringify(r.cmp)}`);
    assert.strictEqual(s.declines, 0, `1D lowered, not declined: ${JSON.stringify(s.reasons)}`);
    assert.ok(s.gpuFrames === 1 && s.texUploads >= 1, `a GPU frame with the 1D texture uploaded: ${JSON.stringify(s)}`);
    console.log(`PASS 1D texture filter 0x${filter.toString(16)} wrap 0x${wrap.toString(16)} on the GPU (worst ${r.cmp.worst})`);
  }
  {
    // Mipmapped 1D still declines (9): the filter is chosen per fragment.
    const r = await bothArms(g => {
      g.clear([0, 0, 0, 1], ALL);
      const px = g.e.guest_alloc(64) >>> 0;
      new Uint8Array(g.memory.buffer, g.wa(px), 64).fill(200);
      g.call('glBindTexture', [0xde0, 4]);
      for (let l = 0, w = 8; w >= 1; l++, w >>= 1) g.call('glTexImage1D', [0xde0, l, 0x1908, w, 0, 0x1908, 0x1401, px]);
      g.call('glTexParameteri', [0xde0, 0x2801, 0x2703]);
      g.call('glEnable', [0xde0]);
      g.quad(-1, -1, 1, 1, [1, 1, 1, 1], { t: [[0], [1], [1], [0]] });
      g.swap();
    });
    const s = r.gp.stats();
    assert.ok(r.cmp.ok, `mipmapped 1D (software) matches: ${JSON.stringify(r.cmp)}`);
    assert.ok(s.reasons[9] >= 1, `mipmapped 1D declines 9: ${JSON.stringify(s.reasons)}`);
    console.log('PASS mipmapped 1D declines 9 and draws in software');
  }
})().catch(e => { console.error(e.stack || e); process.exitCode = 1; });
