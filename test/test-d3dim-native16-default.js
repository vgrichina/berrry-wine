#!/usr/bin/env node
'use strict';
// Default (non-exact) native16 policy: 16bpp targets keep RGBA8 colour on the
// GPU between draws, so an ordinary draw is one device draw with no storage
// pass. Only destination-alpha blending on an A1R5G5B5 (format 3) or
// A4R4G4B4 (format 4) target keeps the ordered per-primitive native store,
// because there the quantized stored alpha changes what the next primitive
// reads. exactNative16 restores per-primitive storage everywhere.
const assert = require('assert/strict');
const { D3DIMGpu } = require('../lib/d3dim-gpu');

function run({ format, state, exact = false, count = 5 }) {
  let stores = 0, draws = 0;
  const gl = { NO_ERROR: 0, DITHER: 7, SCISSOR_TEST: 8, TRIANGLE_STRIP: 9,
    getError() { return 0; }, copyTexSubImage2D() { stores++; } };
  const g = { gl, renderHeight: 48, _stateValues: new Map(), bindImplicitTarget() {}, bindTexture() {},
    setScissor() {}, setCapability() {}, setColorMask() {}, setViewport() {}, setUniform() {}, draw() {} };
  const executor = new D3DIMGpu({ exactNative16: exact, getExports: () => ({}), getMemory: () => new ArrayBuffer(0) });
  const target = { bpp: 16, width: 64, height: 48, format, nativeStorage: { texture: {}, program: {}, buffer: {} },
    device: { gpu: g, draw() { draws++; } } };
  executor._markColorDirty = () => {};
  const vertices = new Uint8Array(count * 3 * 32), dv = new DataView(vertices.buffer);
  for (let i = 0; i < count * 3; i++) dv.setFloat32(i * 32 + 12, 1, true);
  const result = executor._submitImmediate(target, { primitive: 4, primitiveCount: count, stride: 32, vertices, state });
  assert.equal(result, 1);
  return { stores, draws };
}

const opaque = { blend: false };
const alphaBlend = { blend: true, srcblend: 5, dstblend: 6 };          // SRCALPHA / INVSRCALPHA
const destAlpha = { blend: true, srcblend: 7, dstblend: 8 };           // DESTALPHA / INVDESTALPHA
const satSrc = { blend: true, srcblend: 11, dstblend: 2 };             // SRCALPHASAT / ONE

// Full colour: one draw, no storage pass.
for (const format of [1, 2, 3, 4])
  for (const state of [opaque, alphaBlend])
    assert.deepEqual(run({ format, state }), { stores: 0, draws: 1 }, `format ${format} ${JSON.stringify(state)}`);
// Destination alpha on a 565/555 target has no stored alpha to quantize.
assert.deepEqual(run({ format: 1, state: destAlpha }), { stores: 0, draws: 1 });
// Destination alpha on A1/A4 keeps ordered per-primitive storage.
for (const format of [3, 4]) {
  assert.deepEqual(run({ format, state: destAlpha }), { stores: 6, draws: 5 }); // +1: whole-target reduce first
  assert.deepEqual(run({ format, state: satSrc }), { stores: 6, draws: 5 });
}
// Exact mode stores after every primitive regardless.
assert.deepEqual(run({ format: 1, state: alphaBlend, exact: true }), { stores: 5, draws: 5 });
console.log('PASS native16 default keeps full colour; dest-alpha A1/A4 and exact mode store per primitive');
