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
const GL_DEPTH_TEST = 0xb71;
const CAP_DS_READBACK = require('../lib/gpu-stream.generated').CONST.CAP_DS_READBACK;
const DECLINES = require('../lib/gl-gps-declines.generated');
// The return address the helper's call() leaves on the guest stack.
const CALL_RET = 0x12345678;
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
    // Last-decline diagnostics: reason, guest return address of the GL call
    // (glEnd) it happened in, and the fallback sequence counter.
    assert.strictEqual(r.gp.e.gl_gps_last_decline(), 3, 'last decline is the stipple');
    assert.strictEqual(DECLINES.name(r.gp.e.gl_gps_last_decline()), 'polygon stipple');
    assert.strictEqual(r.gp.e.gl_gps_last_decline_eip() >>> 0, CALL_RET, 'decline EIP is the GL call return address');
    assert.strictEqual(r.gp.e.gl_gps_decline_seq(), s.declines, 'sequence counts every decline');
    assert.ok(r.gp.e.gl_gps_readback_count() >= s.readbacks, 'readback count includes colour readbacks');
    assert.strictEqual(r.sw.e.gl_gps_decline_seq(), 0, 'no fallback without the producer');
    assert.strictEqual(r.sw.e.gl_gps_last_decline(), 0);
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
    assert.strictEqual(unsupported.failCode(), 20, 'the trap is the lost-depth $glg_fail(20)');
    console.log('PASS depth handoff: occlusion, orientation, CPU writes and missing-capability guard');
  }
  // Strict mode: the first fallback traps at the declining draw with
  // $glg_fail(100 + reason), and the diagnostics already name it.
  {
    const g = await bootGlGps();
    g.e.gl_gps_strict(1);
    const pat = g.e.guest_alloc(128) >>> 0;
    new Uint8Array(g.memory.buffer, g.wa(pat), 128).fill(0xaa);
    g.call('glPolygonStipple', [pat]);
    g.clear([0, 0, 0, 1], ALL);
    g.quad(-1, -1, 0, 0, [0, 1, 0, 1]);
    assert.strictEqual(g.e.gl_gps_decline_seq(), 0, 'no fallback before the stipple');
    g.call('glEnable', [GL_POLYGON_STIPPLE]);
    assert.throws(() => g.quad(-1, -1, 1, 1, [1, 1, 1, 1]), WebAssembly.RuntimeError, 'strict mode traps');
    assert.strictEqual(g.failCode(), 100 + 3, 'trap code is 100 + reason');
    assert.strictEqual(g.e.gl_gps_last_decline(), 3);
    assert.strictEqual(g.e.gl_gps_last_decline_eip() >>> 0, CALL_RET);
    assert.strictEqual(g.e.gl_gps_decline_seq(), 1);
    assert.strictEqual(g.stats().declines, 0, 'trapped before the decline moved any state');
    assert.strictEqual(DECLINES.strictTrapBase, 100);
    console.log('PASS strict mode: trap 103 at the stipple draw, last decline 3 @ call return');
  }
  // D24S8: GPU depth and stencil survive a mid-frame CPU fallback. Two
  // stencil frames first (the first declines 4 and asks for D24S8, whose
  // full clear in the second remakes the DS), then a GPU frame writes depth
  // and stencil and a stipple sends it to software. $combined: the first CPU
  // draw needs depth and stencil together (one D24S8 readback); otherwise
  // a stencil-only draw, then a depth-only one (two readbacks).
  {
    const scene = combined => g => {
      const prep = () => {
        g.call('glClearStencil', [0]);
        g.clear([0, 0, 0, 1], ALL);
        g.call('glEnable', [GL_STENCIL_TEST]);
        g.call('glStencilFunc', [0x207, 1, 255]); g.call('glStencilOp', [0x1e00, 0x1e00, 0x1e01]);
        g.quad(-1, -1, 1, 1, [0, 0, 0, 1]);
        g.call('glDisable', [GL_STENCIL_TEST]);
        g.swap();
      };
      prep(); prep();
      const before = g.stats();
      const q = (x0, y0, x1, y1, z, c) => g.prim(7,
        [{x:x0,y:y0,z}, {x:x1,y:y0,z}, {x:x1,y:y1,z}, {x:x0,y:y1,z}], c);
      g.call('glClearStencil', [0]);
      g.clear([0, 0, 0, 1], ALL);
      g.call('glEnable', [GL_DEPTH_TEST]);
      q(-1, -1, 0, 0, -1, [0, 1, 0, 1]);                       // green, near, bottom-left
      g.call('glEnable', [GL_STENCIL_TEST]);
      g.call('glStencilOp', [0x1e00, 0x1e00, 0x1e01]);
      g.call('glStencilFunc', [0x207, 1, 255]); q(0, 0, 1, 1, 0.5, [0, 0, 1, 1]);   // blue top-right, s=1
      g.call('glStencilFunc', [0x207, 2, 255]); q(-1, 0, 0, 1, 0.9, [1, 0, 1, 1]);  // magenta top-left, s=2
      const mid = g.stats();
      const pat = g.e.guest_alloc(128) >>> 0;
      new Uint8Array(g.memory.buffer, g.wa(pat), 128).fill(255);
      g.call('glPolygonStipple', [pat]); g.call('glEnable', [GL_POLYGON_STIPPLE]);
      g.call('glStencilOp', [0x1e00, 0x1e00, 0x1e00]);
      g.call('glStencilFunc', [0x202, 1, 255]);                // EQUAL 1: only the GPU's top-right
      if (!combined) g.call('glDisable', [GL_DEPTH_TEST]);
      q(-1, -1, 1, 1, -0.5, [1, 0, 0, 1]);                     // red where stencil 1
      // Still stippled: a draw after a declined one would otherwise go back
      // to the GPU mid-frame ($glg_enter) and never test the CPU depth.
      g.call('glDisable', [GL_STENCIL_TEST]);
      g.call('glEnable', [GL_DEPTH_TEST]);
      q(-1, -1, 1, 1, 0.8, [1, 1, 1, 1]);                      // white: beats magenta (0.95) and clear
      g.call('glDisable', [GL_POLYGON_STIPPLE]);
      g.call('glDisable', [GL_DEPTH_TEST]);
      g.call('glEnable', [GL_STENCIL_TEST]);
      g.call('glStencilFunc', [0x202, 2, 255]);
      q(-1, -1, 1, 1, 0, [0, 1, 1, 1]);                        // cyan where stencil 2
      g.call('glDisable', [GL_STENCIL_TEST]);
      g.swap();
      return { before, mid, after: g.stats() };
    };
    for (const combined of [true, false]) {
      const r = await bothArms(scene(combined));
      const { before, mid, after } = r.gpOut;
      assert.ok(mid.draws - before.draws >= 2 && mid.declines === before.declines,
        `depth+stencil frame starts on the GPU: ${JSON.stringify({ before, mid })}`);
      assert.ok(after.reasons[3] >= 1, 'stipple sends it to software');
      assert.strictEqual(after.dsReadbacks, combined ? 1 : 2, `D24S8 readbacks: ${JSON.stringify(after)}`);
      assert.ok(r.cmp.ok, `D24S8 GPU depth+stencil -> CPU matches software: ${JSON.stringify(r.cmp)}`);
      assert.deepStrictEqual([...new Set(r.gpPic.px)].sort(), [0x00ff00, 0xff0000, 0x00ffff, 0xffffff].sort(),
        'green (depth), red (stencil 1 + depth), cyan (stencil 2) and white all visible');
      console.log(`PASS D24S8 handoff (${combined ? 'depth+stencil in one readback' : 'stencil, then depth'}): readbacks=${after.dsReadbacks}`);
    }
    const unsupported = await bootGlGps({ dropCaps: CAP_DS_READBACK });
    assert.throws(() => scene(true)(unsupported), WebAssembly.RuntimeError, 'missing D24S8 readback capability retains the lost-depth trap');
    assert.strictEqual(unsupported.failCode(), 20);
    console.log('PASS D24S8 missing-capability guard: $glg_fail(20)');
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
