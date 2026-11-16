#!/usr/bin/env node

// CRT presets: preference mapping, beam-line / mask planning, the uniforms
// the beam pass receives, and the backend label. A recording WebGL stand-in
// replaces the GPU, so this checks what is asked of WebGL, not pixels (the
// browser test test-retina-scale2x-web.js and the captured stills do that).

'use strict';

const assert = require('assert');
const {
  PresentationFilter,
  CRT_BEAM_FRAGMENT_SHADER,
  CRT_BLOOM_FRAGMENT_SHADER,
  CRT_PRESETS,
  crtBeamLines,
  crtMaskPlan,
  normalizeCrtEffects,
} = require('../lib/presentation-filter');
const pageSettings = require('../lib/page-settings');

// ---- preference mapping ---------------------------------------------------
for (const normalize of [normalizeCrtEffects, pageSettings.normalizeCrtEffects]) {
  assert.deepStrictEqual(normalize(undefined),
    { preset: 'off', curvature: false, persistence: false });
  assert.deepStrictEqual(normalize({ scanlines: false, mask: true, glow: false }),
    { preset: 'vga', curvature: false, persistence: false },
    'any old CRT checkbox maps to the VGA monitor preset');
  assert.deepStrictEqual(normalize({ preset: 'vga', persistence: 1 }),
    { preset: 'vga', curvature: false, persistence: true });
  assert.deepStrictEqual(normalize({ preset: 'arcade' }),
    { preset: 'arcade', curvature: false, persistence: false });
  assert.deepStrictEqual(normalize({ preset: 'off', glow: true }),
    { preset: 'off', curvature: false, persistence: false },
    'an explicit Off wins over stale legacy flags');
}

// ---- beam lines: VGA doublescans the low modes ------------------------------
assert.strictEqual(crtBeamLines(CRT_PRESETS.vga, 200), 400);
assert.strictEqual(crtBeamLines(CRT_PRESETS.vga, 240), 480);
assert.strictEqual(crtBeamLines(CRT_PRESETS.vga, 480), 480);
assert.strictEqual(crtBeamLines(CRT_PRESETS.arcade, 240), 240);

// ---- mask plan ------------------------------------------------------------
assert.deepStrictEqual(crtMaskPlan(CRT_PRESETS.vga, 1, 3),
  { type: 'grille', reason: 'full', strength: CRT_PRESETS.vga.maskStrength, unit: 1 });
assert.strictEqual(crtMaskPlan(CRT_PRESETS.vga, 1.5, 3).reason, 'device-scale',
  'a canvas resampled by a fractional factor would beat the mask into moire');
assert.strictEqual(crtMaskPlan(CRT_PRESETS.vga, 0.5, 3).type, 'off');
assert.strictEqual(crtMaskPlan(CRT_PRESETS.vga, 2, 3).type, 'grille',
  'a whole number of device pixels per canvas pixel keeps the mask aligned');
assert.strictEqual(crtMaskPlan(CRT_PRESETS.vga, 1, 1.2).reason, 'pixel-scale');
const faded = crtMaskPlan(CRT_PRESETS.arcade, 1, 1.75);
assert.strictEqual(faded.type, 'slot');
assert.strictEqual(faded.reason, 'faded');
assert(faded.strength > 0 && faded.strength < CRT_PRESETS.arcade.maskStrength);

assert(CRT_BEAM_FRAGMENT_SHADER.includes('crt_decode') &&
  CRT_BEAM_FRAGMENT_SHADER.includes('crt_encode'), 'the beam works in linear light');
assert(CRT_BEAM_FRAGMENT_SHADER.includes('erf3'), 'the spot is integrated over the pixel');
assert(CRT_BLOOM_FRAGMENT_SHADER.includes('u_step'));

// ---- recording WebGL ------------------------------------------------------
function recordingGl() {
  const calls = [];
  const sources = new Map();
  const attached = new Map();
  let current = null;
  let serial = 0;
  const gl = new Proxy({}, {
    get(_, prop) {
      if (typeof prop !== 'string') return undefined;
      if (prop === 'calls') return calls;
      if (prop === 'FRAMEBUFFER_COMPLETE') return 0x8CD5;
      if (/^[A-Z0-9_]+$/.test(prop)) return prop;
      if (prop === 'getShaderParameter' || prop === 'getProgramParameter') return () => true;
      if (prop === 'checkFramebufferStatus') return () => 0x8CD5;
      if (prop === 'getAttribLocation') return () => 0;
      if (prop === 'getUniformLocation') return (program, name) => ({ program, name });
      if (prop === 'shaderSource') return (shader, source) => sources.set(shader, source);
      if (prop === 'attachShader') return (program, shader) => {
        if (!attached.has(program)) attached.set(program, []);
        attached.get(program).push(shader);
      };
      if (prop === 'useProgram') return program => {
        // vertex shader first, fragment second
        current = sources.get((attached.get(program) || [])[1]);
      };
      if (prop.startsWith('uniform') && prop !== 'uniform1i') {
        return (location, ...values) => calls.push(['uniform', current, location.name,
          values.length === 1 ? values[0] : values]);
      }
      if (prop === 'drawArrays') return () => calls.push(['draw', current]);
      return (...args) => { calls.push([prop, ...args]); return { id: ++serial }; };
    },
  });
  return gl;
}

function harness() {
  const gl = recordingGl();
  const blits = [];
  const ctx = {
    imageSmoothingEnabled: false,
    clearRect() {},
    fillRect() {},
    drawImage(...args) { blits.push(args); },
  };
  const output = { width: 1, height: 1, getContext: type => (type === '2d' ? ctx : null) };
  const filter = new PresentationFilter(output, {
    createCanvas: () => {
      const canvas = {
        width: 0,
        height: 0,
        getContext: type => (type === 'webgl' ? gl : type === '2d' ? ctx : null),
      };
      return canvas;
    },
  });
  filter.devicePixelScale = 1;
  return { gl, filter, blits };
}

// Uniforms of the last draw made with the beam shader.
function beamUniforms(gl) {
  const draws = gl.calls.filter(call => call[0] === 'draw' && call[1] === CRT_BEAM_FRAGMENT_SHADER);
  assert(draws.length > 0, 'the beam pass should have drawn');
  const out = {};
  for (const call of gl.calls) {
    if (call[0] === 'uniform' && call[1] === CRT_BEAM_FRAGMENT_SHADER) out[call[2]] = call[3];
  }
  return out;
}

{
  // VGA, a 640x480 frame on a 1280x960 output.
  const { gl, filter, blits } = harness();
  filter.resize(1280, 960);
  assert.strictEqual(filter.present({ width: 640, height: 480 }, 'scale-auto',
    { preset: 'vga' }, { dedither: 'mdapt' }), true);
  assert.strictEqual(filter.lastBackend, 'webgl-beam+crt');
  assert.strictEqual(filter.lastCrt.backend, 'webgl-beam');
  assert.strictEqual(filter.lastCrt.preset, 'vga');
  assert.strictEqual(filter.lastCrt.lines, 480);
  assert.strictEqual(filter.lastCrt.doublescan, false);
  assert.strictEqual(filter.lastCrt.mask, 'grille');
  assert.strictEqual(filter.lastCrt.bloom, 'on');
  assert.strictEqual(filter.lastDeditherBackend, 'bypassed-crt',
    'dedither applies only with CRT off');
  assert.deepStrictEqual(filter.lastPixelScalePasses, [],
    'the selected scaler does not run under CRT');
  assert(!('scale2x' in filter._gpu.programs) && !('mdaptPass0' in filter._gpu.programs));
  const u = beamUniforms(gl);
  assert.deepStrictEqual(u.u_source_size, [640, 480]);
  assert.strictEqual(u.u_lines, 480);
  assert.strictEqual(u.u_line_height, 0.5);
  assert.strictEqual(u.u_scan_fade, 0, 'two output pixels per line keep the full beam');
  assert.deepStrictEqual(u.u_spot, CRT_PRESETS.vga.spot);
  assert.deepStrictEqual(u.u_mask, [1, crtMaskPlan(CRT_PRESETS.vga, 1, 2).strength, 1, 0]);
  assert(u.u_mask[1] > 0.5 * CRT_PRESETS.vga.maskStrength, 'at 2x the mask is mostly on');
  assert.strictEqual(u.u_bloom_amount, CRT_PRESETS.vga.bloom);
  assert.strictEqual(u.u_geometry[0], 0, 'curvature is off unless asked for');
  // Bloom renders at a quarter of the output, two separable passes.
  const bloomDraws = gl.calls.filter(call => call[0] === 'draw' &&
    call[1] === CRT_BLOOM_FRAGMENT_SHADER);
  assert.strictEqual(bloomDraws.length, 2);
  assert(gl.calls.some(call => call[0] === 'texImage2D' && call[4] === 320 && call[5] === 240),
    'the halation buffer should be quarter output resolution');
  assert.strictEqual(blits.length, 1, 'one blit of the finished frame to the page canvas');
}

{
  // VGA doublescans a 320x200 mode; a fractional device mapping drops the mask.
  const { gl, filter } = harness();
  filter.devicePixelScale = 1.25;
  filter.resize(1280, 800);
  filter.present({ width: 320, height: 200 }, 'nearest', { preset: 'vga', curvature: true });
  assert.strictEqual(filter.lastCrt.lines, 400);
  assert.strictEqual(filter.lastCrt.doublescan, true);
  assert.strictEqual(filter.lastCrt.mask, 'off');
  assert.strictEqual(filter.lastCrt.maskReason, 'device-scale');
  const u = beamUniforms(gl);
  assert.strictEqual(u.u_lines, 400);
  assert.strictEqual(u.u_mask[0], 0);
  assert(u.u_geometry[0] > 0, 'curvature on');
}

{
  // Arcade: slot mask, no doublescan, wider spot range.
  const { gl, filter } = harness();
  filter.resize(1280, 960);
  filter.present({ width: 320, height: 240 }, 'nearest', { preset: 'arcade' });
  assert.strictEqual(filter.lastBackend, 'webgl-beam+crt');
  assert.strictEqual(filter.lastCrt.lines, 240);
  assert.strictEqual(filter.lastCrt.mask, 'slot');
  const u = beamUniforms(gl);
  assert.strictEqual(u.u_mask[0], 2);
  assert.strictEqual(u.u_convergence, CRT_PRESETS.arcade.convergence);
  assert(u.u_spot[0] < CRT_PRESETS.vga.spot[0], 'arcade lines are thinner when dark');
}

{
  // Placement inside a letterboxed viewport, and a viewport crop is applied
  // before the beam sees the texture.
  const { gl, filter } = harness();
  filter.resize(1600, 1000);
  const viewport = {
    cropX: 10, cropY: 20, cropW: 640, cropH: 480, nativeW: 640, nativeH: 480,
    dstX: 133, dstY: 0, dstW: 1333, dstH: 1000, multiplier: 2, background: '#000000',
  };
  filter.present({ width: 800, height: 600 }, 'nearest', { preset: 'vga' }, { viewport });
  assert.strictEqual(filter.lastBackend, 'webgl-beam+crt');
  assert(gl.calls.some(call => call[0] === 'viewport' && call[1] === 133 && call[3] === 1333),
    'the beam quad should land on the viewport rectangle');
  assert.deepStrictEqual(beamUniforms(gl).u_source_size, [640, 480]);
  assert(filter._cropStage && filter._cropStage.width === 640);
}

{
  // A frame shown smaller than itself keeps the ordinary path, no CRT.
  const { filter } = harness();
  filter.resize(800, 600);
  filter.present({ width: 1024, height: 768 }, 'nearest', { preset: 'vga' });
  assert.strictEqual(filter.lastBackend, 'canvas-nearest');
  assert.deepStrictEqual(filter.lastCrt, { preset: 'vga', backend: 'skipped-downscale' });
}

{
  // Off: the beam is never compiled.
  const { filter } = harness();
  filter.resize(1280, 960);
  filter.present({ width: 640, height: 480 }, 'nearest', {});
  assert.strictEqual(filter.lastBackend, 'canvas-nearest');
  assert.strictEqual(filter.lastCrt, null);
  assert(!filter._gpu || !('crtBeam' in filter._gpu.programs));
}

{
  // Persistence renders the beam into a stage and composites it with the
  // decayed previous output.
  const { gl, filter } = harness();
  filter.resize(1280, 960);
  filter.present({ width: 640, height: 480 }, 'nearest', { preset: 'vga', persistence: true });
  assert.strictEqual(filter.lastCrt.persistence, true);
  assert(gl.calls.some(call => call[0] === 'copyTexSubImage2D'),
    'the composited output should become the next previous frame');
  filter._stopCrtDecay();
}

console.log('PASS  CRT presets: legacy mapping, doublescan, device-pixel mask plan, beam uniforms, backend label');
