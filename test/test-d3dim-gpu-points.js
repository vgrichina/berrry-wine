#!/usr/bin/env node
'use strict';
const assert = require('assert');
const { D3DIMGpu, OPCODES } = require('../lib/d3dim-gpu');

function fixture({ bpp = 16, format = 1, clip = null, boundedReadback = true } = {}) {
  const memory = new ArrayBuffer(65536), dv = new DataView(memory), draws = [], reads = [];
  const desc = { rt: 4096, width: 8, height: 8, dib: 32768, bpp, format, pitch: 8 * bpp / 8,
    clip, texture: 1, texDib: 24576, texWidth: 2, texHeight: 2, texPitch: 8,
    zenable: 1, zwrite: 1, zfunc: 1, blend: 1, srcblend: 5, dstblend: 6,
    fog: 1, alphaFunc: 1, alphaRef: 255, cull: 3 };
  const target = { ...desc, check: false, textureKeys: new Set(), device: {
    draw: d => draws.push(d), gpu: { bindImplicitTarget() {}, updateColorResource() {}, gl: { RGBA: 1, UNSIGNED_BYTE: 2,
      readPixels: (...args) => { reads.push(args.slice(0, 4)); args[6].fill(255); } } } } };
  const gpu = new D3DIMGpu({ getMemory: () => memory,
    getExports: () => ({ guest_to_wasm: a => a }), createCanvas: () => null, boundedReadback });
  gpu._describe = () => desc; gpu._target = () => target; gpu.targets.set(desc.rt, target);
  gpu._texture = () => { throw new Error('points must not decode textures'); };
  const draw = points => {
    [1, 1, 3, 8192, points.length].forEach((v, i) => dv.setUint32(12288 + i * 4, v, true));
    points.forEach(([x, y, color = 0x00123456], i) => {
      const p = 8192 + i * 32;
      [x, y, NaN, -1].forEach((v, j) => dv.setFloat32(p + j * 4, v, true));
      dv.setUint32(p + 16, color, true);
    });
    return gpu.call(OPCODES.DRAW, 12288);
  };
  return { gpu, draws, reads, draw, dv, target };
}
const f = fixture({ clip: { left: 1, top: 1, right: 7, bottom: 7 } });
assert.equal(f.draw([[0.49, 0.5], [5.5, 6.49], [NaN, Infinity]]), 1);
const d = f.draws[0], v = new DataView(d.vertices.buffer);
assert.equal(d.primitive, 4); assert.equal(d.primitiveCount, 4);
assert.deepEqual(d.colorBounds, [1, 1, 7, 7]);
assert.deepEqual(Array.from({ length: 12 }, (_, i) => [v.getFloat32(i * 32, true), v.getFloat32(i * 32 + 4, true)]),
  [[.5,.5],[1.5,.5],[.5,2.5],[1.5,.5],[1.5,2.5],[.5,2.5],
    [5.5,5.5],[6.5,5.5],[5.5,6.5],[6.5,5.5],[6.5,6.5],[5.5,6.5]]);
assert.deepEqual(d.textures, []);
assert.equal(d.state.zenable, false); assert.equal(d.state.zwrite, false);
assert.equal(d.state.blend, false); assert.equal(d.state.cull, 1);
assert.equal(d.fixedFunction.alphaTest, false); assert.equal(d.fixedFunction.fog, false);
for (let i = 0; i < 12; i++) {
  assert.equal(v.getFloat32(i * 32 + 8, true), 0);
  assert.equal(v.getFloat32(i * 32 + 12, true), 1);
  assert.equal(v.getUint32(i * 32 + 16, true), 0x00563412);
}
assert.equal(f.gpu.stats.points, 3);
// The first draw validates the batch key. Later calls snapshot guest bytes,
// merge in order, and fence before any software fallback.
assert.equal(f.draw([[2, 2, 0x00ff0000]]), 1);
assert.equal(f.draw([[3, 3, 0x0000ff00]]), 1);
f.dv.setUint32(8192 + 16, 0xffffffff, true);
assert(f.gpu.pendingDraw);
assert.equal(f.draw([]), 0);
assert.equal(f.gpu.pendingDraw, null);
assert.equal(new DataView(f.draws.at(-1).vertices.buffer).getUint32(16, true), 0x000000ff);
assert.equal(f.gpu.stats.shapeRejectMask4, 1);

// Validate all colors before the first 32-bit point, not after a partial draw.
const wide = fixture({ bpp: 32, format: 6 });
assert.equal(wide.draw([[1, 1, 0xff123456], [4, 4, 0x00123456]]), 0);
assert.equal(wide.draws.length, 0); assert.equal(wide.gpu.stats.fallbackDrawTarget, 1);
assert.equal(wide.draw([[0, 0, 0xff123456], [7, 7, 0xffabcdef]]), 1);
assert.deepEqual(wide.reads, [[0, 6, 2, 2], [7, 0, 1, 1]], 'no readback through untouched gaps');
assert.equal(wide.gpu.pendingDraw, null);
assert.equal(fixture({ bpp: 32, format: 6, boundedReadback: false }).draw([[1, 1, 0xffffffff]]), 0);
assert.equal(fixture({ format: 4 }).draw([[1, 1]]), 0, 'unsupported 4444 remains software');
assert.equal(fixture().draw([[Infinity, -Infinity]]), 1, 'fully clipped operation is accepted without pixels');
const nan = fixture(); nan.draw([[NaN, NaN]]);
assert.deepEqual(nan.draws[0].colorBounds, [0, 0, 2, 2], 'WAT saturating NaN conversion is zero');
console.log('PASS D3DIM point lowering, clipping, immutable batches, state independence and explicit fallbacks');
