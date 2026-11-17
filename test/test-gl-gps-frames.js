#!/usr/bin/env node
'use strict';
// Software GL on the GPU stream v2 ring (src/09a8gt-gl-gps.wat, --gl-gps):
// one scene through the real opengl32 thunks on the software path and on
// the producer + software executor, compared pixel for pixel (within 1 per
// channel) on the presented front buffer.
//
//   1. A GPU frame: clear, a Gouraud quad, a logic-op quad (XOR) and a
//      partial colour mask, all on the executor (no decline, no readback
//      until the front is fetched).
//   2. A decline-to-software frame: polygon stipple (reason 3) sends the whole
//      frame to the CPU; the next frame stays software, the one after is GPU.
//   3. Stencil: the first stencil draw declines (4: the executor's depth
//      target is D16 and holds no stencil); the next full depth+stencil clear
//      makes it D24S8 and the stencil frame runs on the GPU.
const assert = require('assert');
const { bothArms, bootGlGps } = require('./helpers/gl-gps-context');

const GL_COLOR_LOGIC_OP = 0xbf2, GL_XOR = 0x1506, GL_POLYGON_STIPPLE = 0xb42, GL_STENCIL_TEST = 0xb90;
const ALL = 0x4000 | 0x100 | 0x400;

(async () => {
  // 1. GPU frame.
  {
    const r = await bothArms(g => {
      g.clear([0.1, 0.2, 0.3, 1], ALL);
      g.prim(7, [{ x: -1, y: -1, c: [1, 0, 0, 1] }, { x: 0.5, y: -1, c: [0, 1, 0, 1] },
        { x: 0.5, y: 0.5, c: [0, 0, 1, 1] }, { x: -1, y: 0.5, c: [1, 1, 1, 1] }]);
      g.call('glLogicOp', [GL_XOR]); g.call('glEnable', [GL_COLOR_LOGIC_OP]);
      g.quad(-0.5, -0.5, 1, 1, [1, 1, 0, 1]);
      g.call('glDisable', [GL_COLOR_LOGIC_OP]);
      g.call('glColorMask', [0, 1, 0, 1]);
      g.quad(0, -1, 1, 0, [1, 0.5, 1, 1]);
      g.call('glColorMask', [1, 1, 1, 1]);
      g.swap();
    });
    const s = r.gp.stats();
    assert.ok(r.cmp.ok, `GPU frame matches software within 1: ${JSON.stringify(r.cmp)}`);
    assert.ok(r.cmp.differ < r.swPic.px.length, 'scene is not empty');
    assert.strictEqual(s.declines, 0, `no declines: ${JSON.stringify(s.reasons)}`);
    assert.ok(s.gpuFrames >= 1 && s.swFrames === 0, `GPU frame: ${JSON.stringify(s)}`);
    assert.ok(s.draws >= 3, 'the producer took the draws');
    console.log(`PASS GPU frame (logic op + colour mask) worst=${r.cmp.worst} differ=${r.cmp.differ}`);
  }
  // 2. A declined frame, then a GPU frame.
  {
    let mid;
    const r = await bothArms(g => {
      const pat = g.e.guest_alloc(128) >>> 0;
      new Uint8Array(g.memory.buffer, g.wa(pat), 128).fill(0xaa);
      g.call('glPolygonStipple', [pat]);
      g.clear([0, 0, 0, 1], ALL);
      g.call('glEnable', [GL_POLYGON_STIPPLE]);
      g.quad(-1, -1, 1, 1, [1, 1, 1, 1]);
      g.call('glDisable', [GL_POLYGON_STIPPLE]);
      g.swap();
      mid = g.front();
      // A frame after a declined one stays software (09a8gt $glg_armed);
      // the one after that is GPU again.
      for (let i = 0; i < 2; i++) {
        g.clear([0, 0, 0, 1], ALL);
        g.quad(-1, -1, 0, 0, [0, 1, 0, 1]);
        g.swap();
      }
      return mid;
    });
    const s = r.gp.stats();
    assert.ok(r.cmp.ok, `frame after the declined one matches: ${JSON.stringify(r.cmp)}`);
    const { comparePictures } = require('./helpers/gl-gps-context');
    const c1 = comparePictures(r.swOut, r.gpOut, 1);
    assert.ok(c1.ok, `declined (software) frame matches: ${JSON.stringify(c1)}`);
    assert.strictEqual(s.reasons[3], 1, `one stipple decline: ${JSON.stringify(s.reasons)}`);
    assert.ok(s.swFrames === 2 && s.gpuFrames === 1, `two SW frames, then a GPU one: sw=${s.swFrames} gpu=${s.gpuFrames}`);
    console.log(`PASS decline-to-software frame then GPU (sw=${s.swFrames} gpu=${s.gpuFrames} sites=${JSON.stringify(s.sites)})`);
  }
  // GPU depth must survive a mid-frame CPU fallback (Q3 glEnd trap).
  {
    const scene = g => {
      g.clear([0, 0, 0, 1], ALL);
      g.call('glEnable', [0xb71]); // DEPTH_TEST, default LESS and writes on
      const q = (x0, y0, x1, y1, z, c) => g.prim(7,
        [{x:x0,y:y0,z}, {x:x1,y:y0,z}, {x:x1,y:y1,z}, {x:x0,y:y1,z}], c);
      q(-1, -1, 0, 0, -1, [0, 1, 0, 1]);
      q(0, 0, 1, 1, 0.5, [0, 0, 1, 1]);
      const pat = g.e.guest_alloc(128) >>> 0;
      new Uint8Array(g.memory.buffer, g.wa(pat), 128).fill(255);
      g.call('glPolygonStipple', [pat]); g.call('glEnable', [GL_POLYGON_STIPPLE]);
      // Near green must survive LESS; nearer red replaces blue;
      // red also fills the two untouched (clear-depth) quadrants.
      q(-1, -1, 1, 1, -0.5, [1, 0, 0, 1]);
      g.call('glDisable', [GL_POLYGON_STIPPLE]);
      q(-1, -1, 1, 1, 0, [1, 1, 1, 1]); // must remain occluded by CPU writes
      g.swap();
    };
    const r = await bothArms(scene);
    assert.ok(r.cmp.ok, `GPU depth -> CPU depth matches native software: ${JSON.stringify(r.cmp)}`);
    assert.deepStrictEqual([...new Set(r.gpPic.px)].sort(), [0x00ff00, 0xff0000].sort(), 'both depth outcomes visible');
    assert.ok(r.gp.stats().draws >= 1 && r.gp.stats().reasons[3] >= 1, `GPU writes precede stipple fallback: ${JSON.stringify(r.gp.stats())}`);
    const unsupported = await bootGlGps({ dropCaps: 1024 });
    assert.throws(() => scene(unsupported), WebAssembly.RuntimeError, 'missing depth-readback capability retains lost-depth trap');
    console.log('PASS depth handoff: occlusion, orientation, CPU writes and missing-capability guard');
  }
  // 3. Stencil.
  {
    const scene = g => {
      g.call('glClearStencil', [0]);
      g.clear([0, 0, 0, 1], ALL);
      g.call('glEnable', [GL_STENCIL_TEST]);
      g.call('glStencilFunc', [0x207, 1, 255]); g.call('glStencilOp', [0x1e00, 0x1e00, 0x1e01]);
      g.quad(-1, -1, 0, 1, [0, 0, 1, 1]);
      g.call('glStencilFunc', [0x202, 1, 255]); g.call('glStencilOp', [0x1e00, 0x1e00, 0x1e00]);
      g.quad(-1, -1, 1, 0, [1, 0, 0, 1]);
      g.call('glDisable', [GL_STENCIL_TEST]);
      g.swap();
    };
    const r = await bothArms(g => [1, 2, 3, 4].map(() => { scene(g); return g.stats(); }));
    const per = r.gpOut;
    console.log('stencil frames', JSON.stringify(per.map(s => ({ gpu: s.gpuFrames, sw: s.swFrames, d: s.declines, r: s.reasons }))));
    assert.ok(r.cmp.ok, `stencil frame matches: ${JSON.stringify(r.cmp)}`);
    assert.ok(per[0].reasons[4] >= 1 && per[0].swFrames === 1, 'the first stencil frame declines (D16 executor depth)');
    assert.strictEqual(per[3].gpuFrames - per[2].gpuFrames, 1, 'a later stencil frame runs on the GPU');
    assert.strictEqual(per[3].declines, per[2].declines, 'and declines nothing');
    console.log(`PASS stencil: declined first, then on the GPU (worst=${r.cmp.worst})`);
  }
})().catch(e => { console.error(e.stack || e); process.exitCode = 1; });
