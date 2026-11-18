#!/usr/bin/env node
'use strict';
// --gl-gps reads the executor's capability block (GpsRing caps_flags) and
// declines only what the executor says it cannot do. With every cap the
// software executor draws logic op, stencil and linear GL_CLAMP textures
// (a GPU frame); with one cap masked off the same scene is a counted decline
// of the matching reason and a software frame. Pixels match the software
// path (within 1) either way.
//
//   GPS_CAP_LOGIC_OP 8       -> reason 1
//   GPS_CAP_STENCIL 4        -> reason 4
//   GPS_CAP_BORDER_LINEAR 32 -> reason 10 (GL_CLAMP + GL_LINEAR; every
//                               executor has it since 2026-11-16, and the
//                               WebGL one used to crash on it before that;
//                               with it, coordinates outside [0, 1] are
//                               saturated in the shader and drawn too)
const assert = require('assert');
const { bothArms } = require('./helpers/gl-gps-context');

const ALL = 0x4500;
const TEX2D = 0xde1;

function texture(g) {
  const px = g.e.guest_alloc(4 * 4 * 4) >>> 0, v = new Uint8Array(g.memory.buffer, g.wa(px), 64);
  for (let i = 0; i < 16; i++) v.set([(i * 37) & 255, (i * 91) & 255, 255 - i * 15, 255], i * 4);
  g.call('glBindTexture', [TEX2D, 1]);
  g.call('glTexImage2D', [TEX2D, 0, 0x1908, 4, 4, 0, 0x1908, 0x1401, px]);
  g.call('glTexParameteri', [TEX2D, 0x2801, 0x2601]);
  g.call('glTexParameteri', [TEX2D, 0x2800, 0x2601]);
  g.call('glTexParameteri', [TEX2D, 0x2802, 0x2900]);
  g.call('glTexParameteri', [TEX2D, 0x2803, 0x2900]);
}

const scenes = {
  1: g => {
    g.clear([0.2, 0.4, 0.6, 1], ALL);
    g.call('glLogicOp', [0x1506]); g.call('glEnable', [0xbf2]);
    g.quad(-0.5, -0.5, 1, 1, [1, 1, 0, 1]);
    g.call('glDisable', [0xbf2]);
  },
  4: g => {
    g.call('glClearStencil', [0]);
    g.clear([0, 0, 0, 1], ALL);
    g.call('glEnable', [0xb90]);
    g.call('glStencilFunc', [0x207, 1, 255]); g.call('glStencilOp', [0x1e00, 0x1e00, 0x1e01]);
    g.quad(-1, -1, 0, 1, [0, 0, 1, 1]);
    g.call('glStencilFunc', [0x202, 1, 255]); g.call('glStencilOp', [0x1e00, 0x1e00, 0x1e00]);
    g.quad(-1, -1, 1, 0, [1, 0, 0, 1]);
    g.call('glDisable', [0xb90]);
  },
  10: g => {
    g.clear([0, 0, 0, 1], ALL);
    texture(g);
    g.call('glEnable', [TEX2D]);
    g.quad(-1, -1, 1, 1, [1, 1, 1, 1], { t: [[0, 0], [1, 0], [1, 1], [0, 1]] });
    g.call('glDisable', [TEX2D]);
  },
};
// GL_CLAMP + linear past [0, 1]: GL clamps the coordinate first (half edge
// texel, half border however far out), the executor's border is all
// border, so the generated shader saturates each GL_CLAMP axis before
// sampling the border sampler (key bits 16-19). Drawn on the GPU with
// BORDER_LINEAR, a decline 10 without it; the picture matches the
// all-software one either way. Variants: both axes, S only (T repeats),
// projective (S/Q, T/Q outside [0, 1]), 1D, and texture unit 1.
const clampScenes = {
  both: g => {
    texture(g);
    g.call('glEnable', [TEX2D]);
    g.quad(-1, -1, 1, 1, [1, 1, 1, 1], { t: [[-0.5, -0.5], [1.5, -0.5], [1.5, 1.5], [-0.5, 1.5]] });
    g.call('glDisable', [TEX2D]);
  },
  sOnly: g => {
    texture(g);
    g.call('glTexParameteri', [TEX2D, 0x2803, 0x2901]);
    g.call('glEnable', [TEX2D]);
    g.quad(-1, -1, 1, 1, [1, 1, 1, 1], { t: [[-0.75, -0.6], [1.75, -0.6], [1.75, 1.4], [-0.75, 1.4]] });
    g.call('glDisable', [TEX2D]);
  },
  projective: g => {
    texture(g);
    g.call('glEnable', [TEX2D]);
    g.quad(-1, -1, 1, 1, [1, 1, 1, 1], { t: [[-1, -1, 0, 2], [1.5, -0.25, 0, 1], [3, 3, 0, 2], [-0.25, 1.5, 0, 1]] });
    g.call('glDisable', [TEX2D]);
  },
  oneD: g => {
    const px = g.e.guest_alloc(32) >>> 0, v = new Uint8Array(g.memory.buffer, g.wa(px), 32);
    for (let i = 0; i < 8; i++) v.set([i * 32, 255 - i * 32, (i & 1) * 255, 255], i * 4);
    g.call('glBindTexture', [0xde0, 3]);
    g.call('glTexImage1D', [0xde0, 0, 0x1908, 8, 0, 0x1908, 0x1401, px]);
    g.call('glTexParameteri', [0xde0, 0x2801, 0x2601]);
    g.call('glTexParameteri', [0xde0, 0x2800, 0x2601]);
    g.call('glTexParameteri', [0xde0, 0x2802, 0x2900]);
    g.call('glEnable', [0xde0]);
    g.quad(-1, -1, 1, 1, [1, 1, 1, 1], { t: [[-0.5], [1.5], [1.5], [-0.5]] });
    g.call('glDisable', [0xde0]);
  },
  unit1: g => {
    // Unit 0 a repeating white-ish texture, unit 1 the GL_CLAMP one
    // (MODULATE both), coordinates per unit with glMultiTexCoord2fARB.
    const w = g.e.guest_alloc(16) >>> 0;
    new Uint8Array(g.memory.buffer, g.wa(w), 16).set([255, 255, 255, 255, 200, 220, 240, 255, 240, 200, 220, 255, 220, 240, 200, 255]);
    g.call('glBindTexture', [TEX2D, 2]);
    g.call('glTexImage2D', [TEX2D, 0, 0x1908, 2, 2, 0, 0x1908, 0x1401, w]);
    g.call('glTexParameteri', [TEX2D, 0x2801, 0x2600]);
    g.call('glTexParameteri', [TEX2D, 0x2800, 0x2600]);
    g.call('glEnable', [TEX2D]);
    g.call('glActiveTextureARB', [0x84c1]);
    texture(g);
    g.call('glEnable', [TEX2D]);
    const T0 = 0x84c0, T1 = 0x84c1;
    g.call('glColor4f', [1, 1, 1, 1].map(g.f));
    g.call('glBegin', [7]);
    for (const [x, y, s, t] of [[-1, -1, -0.5, -0.5], [1, -1, 1.5, -0.5], [1, 1, 1.5, 1.5], [-1, 1, -0.5, 1.5]]) {
      g.call('glMultiTexCoord2fARB', [T0, g.f(s * 2), g.f(t * 2)]);
      g.call('glMultiTexCoord2fARB', [T1, g.f(s), g.f(t)]);
      g.call('glVertex3f', [g.f(x), g.f(y), g.f(0)]);
    }
    g.call('glEnd');
    g.call('glDisable', [TEX2D]);
    g.call('glActiveTextureARB', [T0]);
    g.call('glDisable', [TEX2D]);
  },
};
const clampFrames = scene => g => { for (let i = 0; i < 2; i++) { g.clear([0, 0, 0, 1], ALL); scene(g); g.swap(); } };
const CAP = { 1: 8, 4: 4, 10: 32 };

(async () => {
  for (const reason of [1, 4, 10]) {
    // Four frames: the stencil case needs one frame to ask for a D24S8
    // executor depth target and the next full clear to make it.
    const run = g => { for (let i = 0; i < 4; i++) { scenes[reason](g); g.swap(); } };
    const full = await bothArms(run);
    const fs = full.gp.stats();
    assert.ok(full.cmp.ok, `reason ${reason}, all caps: pixels ${JSON.stringify(full.cmp)}`);
    assert.ok(!fs.reasons[reason] || reason === 4, `reason ${reason} not declined with the cap: ${JSON.stringify(fs.reasons)}`);
    assert.ok(fs.gpuFrames >= 2, `reason ${reason}, all caps: GPU frames ${fs.gpuFrames}`);
    const masked = await bothArms(run, { dropCaps: CAP[reason] });
    const ms = masked.gp.stats();
    assert.ok(masked.cmp.ok, `reason ${reason}, cap masked: pixels ${JSON.stringify(masked.cmp)}`);
    assert.ok(ms.reasons[reason] >= 1, `reason ${reason} declined without its cap: ${JSON.stringify(ms.reasons)}`);
    assert.strictEqual(ms.gpuFrames, 0, `reason ${reason}, cap masked: every frame software`);
    console.log(`PASS reason ${reason}: cap present -> ${fs.gpuFrames} GPU frames (worst ${full.cmp.worst}); ` +
      `cap 0x${CAP[reason].toString(16)} masked -> ${ms.reasons[reason]} declines, ${ms.swFrames} SW frames (worst ${masked.cmp.worst})`);
  }
  for (const [name, scene] of Object.entries(clampScenes)) {
    const out = await bothArms(clampFrames(scene));
    const os = out.gp.stats();
    assert.ok(out.cmp.ok, `GL_CLAMP ${name} outside [0,1], all caps: pixels ${JSON.stringify(out.cmp)}`);
    assert.strictEqual(os.declines, 0, `GL_CLAMP ${name} outside [0,1] drawn, not declined: ${JSON.stringify(os.reasons)}`);
    assert.ok(os.gpuFrames === 2 && os.swFrames === 0, `GL_CLAMP ${name}: GPU frames ${JSON.stringify(os)}`);
    assert.ok(out.swPic.px.some(p => p !== 0), `GL_CLAMP ${name}: a picture`);
    const masked = await bothArms(clampFrames(scene), { dropCaps: CAP[10] });
    const ms = masked.gp.stats();
    assert.ok(masked.cmp.ok, `GL_CLAMP ${name}, cap masked: pixels ${JSON.stringify(masked.cmp)}`);
    assert.ok(ms.reasons[10] >= 1 && ms.gpuFrames === 0, `GL_CLAMP ${name} declines 10 without BORDER_LINEAR: ${JSON.stringify(ms.reasons)}`);
    console.log(`PASS GL_CLAMP + linear ${name} outside [0,1]: ${os.gpuFrames} GPU frames (worst ${out.cmp.worst}, ` +
      `${out.cmp.differ} px differ); BORDER_LINEAR masked -> ${ms.reasons[10]} declines 10 (worst ${masked.cmp.worst})`);
  }
})().catch(e => { console.error(e.stack || e); process.exitCode = 1; });
