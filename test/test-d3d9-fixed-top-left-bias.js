'use strict';
// Characterize the retained axis-aligned tile workaround, NOT a portable
// per-edge top-left rule. The global translation also moves UV/color/depth
// evaluation and can drop strict interiors. Positive diagonal ties remain
// subject to GL ownership because the displacement is tangential there.
// Keep these controls until coverage and interpolation are repaired together.
const assert = require('assert');
const Fixed = require('../lib/d3d9-fixed');

const viewport = { x: 0, y: 0, width: 640, height: 480, minZ: 0, maxZ: 1 };
const draw = positionUsage => ({
  vertexShader: null, pixelShader: null, state: {}, textures: [],
  attributes: [[0, positionUsage, 0, positionUsage === 9 ? 3 : 2, 0], [5, 10, 0, 4, 16]].map(
    ([register, usage, usageIndex, type, offset]) => ({ register, usage, usageIndex, type, offset })),
  fixedFunction: { lighting: false, specular: false, fog: false, alphaTest: false, colorKey: false,
    textureFactor: 0xffffffff, stages: [{ colorOp: 1 }],
    world: identity(), view: identity(), projection: identity() },
});
function identity() { return Float32Array.from([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]); }
const SUBPIXEL = 1 / 16, VISIBLE = 0.25;

// Pretransformed (POSITIONT): screen = (pos - vp + vec2(0.5 - e)) / vp.size.
const tl = Fixed.compile(draw(9), viewport).vertex.source;
const m = /\+ vec2\(0\.5 - ([\d.]+)\/([\d.]+)\)\) \/ d3d_ff_viewport\.zw/.exec(tl);
assert(m, `the retained TL mapping carries a finite displacement:\n${tl}`);
const e = Number(m[1]) / Number(m[2]);
// D3D edge at y=256 vs the GL centre of D3D row 256, both in GL window y (up).
const H = viewport.height;
const glEdge = H - (256 + 0.5 - e), glCentre = H - 256 - 0.5;
assert(glEdge - glCentre >= SUBPIXEL, `edge clears the centre by >= one 4-bit subpixel step (${glEdge - glCentre})`);
assert(glEdge - glCentre < VISIBLE, `the bias stays invisible (${glEdge - glCentre})`);
// Same on x: an integer column edge sits LEFT of that column's centre, so the
// triangle to its right clears the column. This says nothing about oblique ties.
assert(256 + 0.5 - e < 256 + 0.5 && 256 + 0.5 - (256 + 0.5 - e) >= SUBPIXEL);

// Transformed vertices: the half-pixel shift is (0.5 - e) px too.
const xf = Fixed.compile(draw(0), viewport).vertex.source;
const n = /vec2\(1\.0,-1\.0\)\*\(1\.0-([\d.]+)\/([\d.]+)\)\*gl_Position\.w\/d3d_ff_viewport\.zw/.exec(xf);
assert(n, `the transformed half-pixel shift carries the same bias:\n${xf}`);
const shiftPx = (1 - Number(n[1]) / Number(n[2])) * 0.5;
assert(Math.abs((0.5 - shiftPx) - e) < 1e-9, `transformed bias ${0.5 - shiftPx} matches TL bias ${e}`);
// Independent coverage controls establish why the axis-only observation must
// not be promoted to an exact rasterization guarantee. These are analytic,
// rather than measured GL snapping or readback results.
const {integerOwnership,covered}=require('./test-legacy-integer-center-interpolation');
const t=[[0,0],[8,0],[0,8+1/32]],p=[4,4];
assert(covered(t,p)&&integerOwnership(t,p),'authored strict interior is covered');
assert(!integerOwnership(t,[p[0]+e,p[1]+e]),'retained shift drops a strict interior');
const diagonal=[[0,0],[8,0],[8,8]];
assert.equal(integerOwnership(diagonal,[4,4]),integerOwnership(diagonal,[4+e,4+e]),'positive diagonal tie is not displaced');
assert.notEqual(integerOwnership(diagonal,[4+e,4+e]),integerOwnership(diagonal,[4+e,4+e],true),'opposite complementary edge rules still disagree after displacement');
console.log(`PASS retained axis-aligned displacement ${e} px; strict-interior and diagonal controls REJECT a general top-left guarantee (no rendered repair)`);
