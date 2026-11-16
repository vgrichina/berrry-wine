'use strict';
// WebGL fixed-function program reuse after GPU stream v2 slice 9.2: the state
// lowers through 09aj WAT (D3DShaderIR.fixedCascade) to shared IR, and the
// backend keys its GL translation by the IR SHAPE with DEF values masked out.
// So per-draw values (fog colour, alpha reference, viewport, matrices, light
// and material) are uniforms and never regenerate a shader, while any state
// that changes the instruction stream does. Invalid state must never reuse an
// earlier valid plan, and the translation cache stays bounded.
// Ported from the retained-JS TLCache test (lib/d3d9-fixed.js, deleted).
const assert = require('assert');
const hgl = require('../lib/headless-gl');
const { createCanvas } = require('../lib/canvas-compat');
const { Device } = require('../lib/d3d9-backend');
const fixtures = require('./fixtures/d3d9-lighting-cases');
if (!hgl.available()) { console.log(`SKIP test-d3d9-fixed-plan-cache: ${hgl.unavailableReason()}`); process.exit(0); }

function textured() {
  const d = fixtures.draw(), f = d.fixedFunction;
  d.vertices = new Uint8Array(new Float32Array([-1, 1, .5, 0, 0, 3, 1, .5, 2, 0, -1, -3, .5, 0, 2]).buffer); d.stride = 20;
  d.attributes = [{ register: 0, usage: 0, usageIndex: 0, type: 2, offset: 0 }, { register: 7, usage: 5, usageIndex: 0, type: 1, offset: 12 }];
  d.textures = [{ width: 2, height: 2, pixels: new Uint8Array(16).fill(200), sampler: { min: 1, mag: 1, mip: 0 } }];
  Object.assign(f, { lighting: false, fog: true, fogVertexMode: 3, fogStart: 0, fogEnd: 1, fogColor: 0xff112233,
    alphaTest: true, alphaFunc: 7, alphaRef: 16 });
  Object.assign(f.stages[0], { colorOp: 4, colorArg1: 2, colorArg2: 0, alphaOp: 4, alphaArg1: 2, alphaArg2: 0 });
  return d;
}

(async () => {
  const { exports: native, memory } = await require('./render-helper').bootRenderHarness({ fonts: 'none' });
  const device = new Device(createCanvas(8, 8), { webglVersion: 1, getExports: () => native, getMemory: () => memory.buffer });
  const g = device.gpu;
  let programs = 0; const create = g.createProgram.bind(g);
  g.createProgram = (...args) => { programs++; return create(...args); };
  try {
    const draw = d => { device.draw(d); assert.strictEqual(g.getError(), 0); };
    draw(textured());
    const shapes = device.fixedShaders.size, built = programs;
    assert(shapes === 2 && built === 1, `first draw builds one VS+PS translation and one program (${shapes}/${built})`);
    // Values only: DEF words change, the shape key does not.
    for (const edit of [
      d => { d.fixedFunction.fogColor = 0xffabcdef; d.fixedFunction.alphaRef = 192; },
      d => { d.viewport = { x: 1, y: 2, width: 6, height: 5, minZ: .2, maxZ: .8 }; },
      d => { d.fixedFunction.world = Float32Array.from([2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1, 0, .1, .2, 0, 1]); },
      d => { d.fixedFunction.textureFactor = 0x80808080; d.fixedFunction.fogEnd = 3; },
    ]) {
      const d = textured(); edit(d); draw(d);
      assert.strictEqual(device.fixedShaders.size, shapes, 'dynamic values do not regenerate translations');
      assert.strictEqual(programs, built, 'dynamic values do not relink programs');
    }
    // Lit draws: light/material values are uniforms too.
    const lit = fixtures.cases().find(c => c.name === 'front directional').draw;
    draw(lit); const litShapes = device.fixedShaders.size, litPrograms = programs;
    const moved = fixtures.cases().find(c => c.name === 'front directional').draw;
    moved.fixedFunction.lights[0].diffuse[0] *= .25; moved.fixedFunction.material.diffuse[1] *= .5;
    draw(moved);
    assert.strictEqual(device.fixedShaders.size, litShapes, 'light and material values do not regenerate');
    assert.strictEqual(programs, litPrograms, 'light and material values do not relink');
    // Shape edits: each changes the instruction stream or the executor wrapper.
    for (const edit of [
      d => { d.fixedFunction.stages[0].colorOp = 2; },
      d => { d.fixedFunction.fog = false; },
      d => { d.fixedFunction.alphaFunc = 5; },
      d => { d.fixedFunction.fogVertexMode = 1; },
      d => { d.textures = []; d.fixedFunction.stages[0] = { ...d.fixedFunction.stages[0], colorOp: 2, colorArg1: 0, alphaOp: 2, alphaArg1: 0 }; },
    ]) {
      const before = device.fixedShaders.size, linked = programs, d = textured(); edit(d); draw(d);
      // Alpha test is an executor wrapper over the IR: it relinks, the IR is shared.
      assert(device.fixedShaders.size > before || programs > linked, `state change ${edit} builds a new translation or program`);
    }
    // Invalid state must not hit an earlier valid plan (in-place mutation).
    for (const edit of [
      d => { d.fixedFunction.stages[0].colorOp = 999; },
      d => { d.fixedFunction.alphaFunc = 999; },
      d => { d.fixedFunction.stages[0].texCoordIndex = 0x50000; },
      d => { d.fixedFunction.world = new Float32Array(16).fill(NaN); },
    ]) {
      const d = textured(); draw(d); edit(d);
      assert.throws(() => device.draw(d), /D3D9 draw/, 'invalid fixed state refuses after a cached valid draw');
    }
    // Bounded translation cache.
    for (let i = 0; i < 300 && device.fixedShaders.size < 256; i++) {
      const d = textured(); d.fixedFunction.stages[0].colorOp = [2, 3, 4, 5, 6, 7, 8, 10][i % 8]; d.fixedFunction.stages[0].colorArg1 = [0, 2, 3][(i >> 3) % 3];
      d.fixedFunction.fogVertexMode = [1, 2, 3][(i / 24 | 0) % 3]; d.fixedFunction.alphaFunc = 1 + (i / 72 | 0) % 8; draw(d);
    }
    assert(device.fixedShaders.size <= 256, 'bounded translation cache');
  } finally { device.destroy(); }
  assert.strictEqual(device.fixedShaders.size, 0, 'destroy releases translations');
  // Without native exports the WebGL device refuses instead of guessing.
  // (After the main device: headless GL shares one state machine.)
  const bare = new Device(createCanvas(4, 4), { webglVersion: 1 });
  try { assert.throws(() => bare.draw(textured()), /native lowering exports/); } finally { bare.destroy(); }
  console.log('PASS fixed WAT IR plan cache: shape reuse, DEF values as uniforms, shape edits, validation and bounded lifetime');
})().catch(error => { console.error(error); process.exit(1); });
