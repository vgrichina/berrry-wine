'use strict';
// Characterize the retained axis-aligned tile workaround, NOT a portable
// per-edge top-left rule. The global translation also moves UV/color/depth
// evaluation and can drop strict interiors. Positive diagonal ties remain
// subject to GL ownership because the displacement is tangential there.
// Keep these controls until coverage and interpolation are repaired together.
// Ported in slice 9.2 from lib/d3d9-fixed.js (deleted): fixed function now
// lowers through 09aj WAT IR, and the backend's raster wrapper applies the
// same (0.5 - 1/16) px shift to POSITIONT and transformed fixed draws alike.
const assert = require('assert');
const hgl = require('../lib/headless-gl');
const { createCanvas } = require('../lib/canvas-compat');
const { Device } = require('../lib/d3d9-backend');
if (!hgl.available()) { console.log(`SKIP test-d3d9-fixed-top-left-bias: ${hgl.unavailableReason()}`); process.exit(0); }

const identity = () => Float32Array.from([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
const draw = positionUsage => ({
  primitive: 4, primitiveCount: 1, stride: 20,
  vertices: new Uint8Array(new Float32Array(positionUsage === 9
    ? [0,0,.5,1,0, 8,0,.5,1,0, 0,8,.5,1,0] : [-1,-1,.5, 0,0, 1,-1,.5, 0,0, -1,1,.5, 0,0]).buffer),
  vertexShader: null, pixelShader: null, state: { cull: 1, zenable: false }, textures: [],
  attributes: [[0, positionUsage, 0, positionUsage === 9 ? 3 : 2, 0], [5, 10, 0, 4, 16]].map(
    ([register, usage, usageIndex, type, offset]) => ({ register, usage, usageIndex, type, offset })),
  fixedFunction: { lighting: false, specular: false, fog: false, alphaTest: false, colorKey: false,
    textureFactor: 0xffffffff, stages: [{ colorOp: 2, colorArg1: 0, colorArg2: 0, alphaOp: 2, alphaArg1: 0, alphaArg2: 0, constant: 0xffffffff,
      transformFlags: 0, texCoordIndex: 0 }, { colorOp: 1 }],
    world: identity(), view: identity(), projection: identity() },
});
const SUBPIXEL = 1 / 16, VISIBLE = 0.25;
(async () => {
  const { exports: native, memory } = await require('./render-helper').bootRenderHarness({ fonts: 'none' });
  const device = new Device(createCanvas(16, 16), { webglVersion: 1, getExports: () => native, getMemory: () => memory.buffer });
  const sources = []; const g = device.gpu, create = g.createProgram.bind(g);
  g.createProgram = (vs, ...rest) => { sources.push(vs); return create(vs, ...rest); };
  const shift = usage => {
    sources.length = 0;
    const d = draw(usage);
    device.draw(d); assert.strictEqual(g.getError(), 0);
    assert.strictEqual(sources.length, 1, 'one fixed program');
    const m = /gl_Position\.xy\+=vec2\(([\d.]+),-([\d.]+)\)\*gl_Position\.w\/d3d_raster_extent\.xy/.exec(sources[0]);
    assert(m && m[1] === m[2], `fixed raster wrapper carries a symmetric shift:\n${sources[0].slice(-300)}`);
    // d3d_raster_extent is the target size; NDC 2/size = one pixel, so the
    // shift in pixels is value/2. The D3D->GL centre move alone would be 0.5.
    return 0.5 - Number(m[1]) / 2;
  };
  try {
    const e = shift(9);
    assert.strictEqual(e, SUBPIXEL, `POSITIONT bias is one 4-bit subpixel (${e})`);
    const H = 480, glEdge = H - (256 + 0.5 - e), glCentre = H - 256 - 0.5;
    assert(glEdge - glCentre >= SUBPIXEL, `edge clears the centre by >= one 4-bit subpixel step (${glEdge - glCentre})`);
    assert(glEdge - glCentre < VISIBLE, `the bias stays invisible (${glEdge - glCentre})`);
    assert(256 + 0.5 - e < 256 + 0.5 && 256 + 0.5 - (256 + 0.5 - e) >= SUBPIXEL);
    assert.strictEqual(shift(0), e, 'transformed fixed draws carry the same bias');
    // Analytic coverage controls (not measured GL snapping): why the axis-only
    // observation must not be promoted to an exact rasterization guarantee.
    const { integerOwnership, covered } = require('./test-legacy-integer-center-interpolation');
    const t = [[0,0],[8,0],[0,8+1/32]], p = [4,4];
    assert(covered(t,p) && integerOwnership(t,p), 'authored strict interior is covered');
    assert(!integerOwnership(t,[p[0]+e,p[1]+e]), 'retained shift drops a strict interior');
    const diagonal = [[0,0],[8,0],[8,8]];
    assert.equal(integerOwnership(diagonal,[4,4]), integerOwnership(diagonal,[4+e,4+e]), 'positive diagonal tie is not displaced');
    assert.notEqual(integerOwnership(diagonal,[4+e,4+e]), integerOwnership(diagonal,[4+e,4+e],true), 'opposite complementary edge rules still disagree after displacement');
    console.log(`PASS retained axis-aligned displacement ${e} px; strict-interior and diagonal controls REJECT a general top-left guarantee (no rendered repair)`);
  } finally { device.destroy(); }
})().catch(error => { console.error(error); process.exit(1); });
