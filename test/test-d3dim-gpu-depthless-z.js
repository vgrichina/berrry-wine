#!/usr/bin/env node
// A TL vertex's sz is only a depth value. With ZENABLE and ZWRITEENABLE both
// off it decides nothing, and the software rasterizer ignores it; WebGL still
// clips anything outside [0,1]. The DX SDK Flip3DTL sample draws its cube at
// sz=300 with the z buffer off, so on ?d3dim-gpu every triangle vanished
// while the software arm drew it. lib/d3dim-gpu.js must clamp sz into range
// when depth is off, and must leave it alone when a depth test is in play.
'use strict';
const assert = require('assert');
const { D3DIMGpu, OPCODES } = require('../lib/d3dim-gpu');

const memory = new ArrayBuffer(0x10000);
const dv = new DataView(memory);
const DESC = 0x1000, VERTS = 0x2000, CALL = 0x3000;

function run(zenable, zwrite, zs, primitive = 4, vertexType = 3) {
  new Uint8Array(memory).fill(0);
  const f = [];
  f[0] = 0x4000; f[1] = 640; f[2] = 480; f[3] = 16; f[4] = 1280; f[5] = 0x8000; f[6] = 1;
  f[16] = zenable; f[17] = 4; f[18] = zwrite; f[27] = 1; f[28] = 2;
  for (let i = 0; i < 33; i++) dv.setUint32(DESC + i * 4, f[i] | 0, true);
  zs.forEach((z, i) => {
    const o = VERTS + i * 32;
    dv.setFloat32(o, 10 * i, true); dv.setFloat32(o + 4, 20 + i, true);
    dv.setFloat32(o + 8, z, true); dv.setFloat32(o + 12, 1, true);
    dv.setUint32(o + 16, [0xffff0000, 0xff00ff00, 0xff0000ff, 0xffffffff][i % 4], true);
  });
  dv.setUint32(CALL, 0x5000, true);      // device
  dv.setUint32(CALL + 4, primitive, true);
  dv.setUint32(CALL + 8, vertexType, true);
  dv.setUint32(CALL + 12, VERTS, true);  // guest address (identity-mapped here)
  dv.setUint32(CALL + 16, zs.length, true);
  const draws = [];
  const gpu = new D3DIMGpu({
    exactNative16: true,
    getExports: () => ({ d3dim_gpu_describe: () => DESC, guest_to_wasm: a => a }),
    getMemory: () => memory,
    createCanvas: () => null,
    onError: message => { throw new Error(message); },
  });
  // No WebGL here: a target whose device records what it is handed.
  const target = { width: 640, height: 480, bpp: 16, dib: 0x8000, check: false, textureKeys: new Set(),
    device: { draw: d => draws.push(d) } };
  let stores = 0;
  gpu._storeNative16 = () => { stores++; };
  gpu._target = () => target;
  const accepted = gpu.call(OPCODES.DRAW, CALL);
  if (!accepted) return { accepted, draws, stats: gpu.stats };
  assert.strictEqual(stores, draws.length, 'every canonical primitive stores native color');
  assert(draws.every(d => d.primitiveCount === 1));
  const bytes = new Uint8Array(draws.reduce((n, d) => n + d.vertices.byteLength, 0));
  let offset = 0;
  for (const d of draws) { bytes.set(d.vertices, offset); offset += d.vertices.byteLength; }
  const draw = { ...draws[0], primitiveCount: draws.length, vertices: bytes };
  const out = new DataView(bytes.buffer);
  return { accepted, draw, stats: gpu.stats,
    depths: Array.from({length: bytes.byteLength / 32}, (_, i) => out.getFloat32(i * 32 + 8, true)) };
}

// Depth off: sz = 300 (Flip3DTL), negative and in-range values all land in [0,1].
const off = run(0, 0, [300, -2, 0.25]).depths;
assert.deepStrictEqual(off, [1, 0, 0.25], `depth-off sz clamps into range: ${off}`);

// Prepared supplied-projection geometry is untransformed at the public API.
// Near/far clipping must survive depth-off, including after queue replay.
assert.deepStrictEqual(run(0, 0, [-0.5, 1.5, 0.25], 4, 4).depths,
  [-0.5, 1.5, 0.25], 'type 4 preserves geometric clip Z with depth disabled');

// Depth test on: sz is the depth value and is passed through untouched.
const on = run(1, 1, [300, -2, 0.25]).depths;
assert.deepStrictEqual(on, [300, -2, 0.25], `depth-on sz is unchanged: ${on}`);

// Depth write only still needs the real value.
const writeOnly = run(0, 1, [1.5, 0.5, 0.75]).depths;
assert.deepStrictEqual(writeOnly, [1.5, 0.5, 0.75], `zwrite-only sz is unchanged: ${writeOnly}`);

// NFS III submits two-vertex line strips. Longer strips must also preserve
// every adjacent segment and use each segment's first colour, not interpolate
// colours or accidentally connect the end of a line list to the next line.
for (const [primitive, count, expectedX, expectedColor] of [
  [3, 2, [0, 10], [0xff0000ff, 0xff0000ff]],
  [3, 4, [0, 10, 10, 20, 20, 30], [0xff0000ff, 0xff0000ff, 0xff00ff00, 0xff00ff00, 0xffff0000, 0xffff0000]],
  [2, 3, [0, 10], [0xff0000ff, 0xff0000ff]],
]) {
  const result = run(1, 1, Array(count).fill(NaN), primitive);
  assert.strictEqual(result.accepted, 1);
  assert.strictEqual(result.stats.fallbacks, 0);
  assert.strictEqual(result.stats.lines, expectedX.length / 2);
  assert.strictEqual(result.draw.primitive, 2);
  assert.strictEqual(result.draw.primitiveCount, expectedX.length / 2);
  const v = new DataView(result.draw.vertices.buffer);
  assert.deepStrictEqual(expectedX.map((_, i) => v.getFloat32(i * 32, true)), expectedX);
  assert.deepStrictEqual(expectedColor.map((_, i) => v.getUint32(i * 32 + 16, true)), expectedColor);
  assert(result.depths.every(Number.isFinite), 'unused line Z must not clip the segment');
  assert.strictEqual(result.draw.state.zenable, false);
  assert.strictEqual(result.draw.state.zwrite, false);
  assert.strictEqual(result.draw.state.blend, false);
  assert.deepStrictEqual(result.draw.textures, []);
}
for (const count of [0, 1]) {
  const result = run(0, 0, Array(count).fill(0), 3);
  assert.strictEqual(result.accepted, 0, 'incomplete strip stays on fallback path');
  assert.strictEqual(result.draws.length, 0);
}
// No WebGL context must decline a real draw, not throw out of guest execution.
run(0, 0, [0, 0, 0]); // Reset the incomplete-strip descriptor to a valid triangle.
let canvasAttempts = 0;
const unavailableMessages = [];
const unavailable = new D3DIMGpu({
  getExports: () => ({ d3dim_gpu_describe: () => DESC, guest_to_wasm: a => a }),
  getMemory: () => memory,
  createCanvas: () => { canvasAttempts++; return { getContext: () => null }; },
  onError: message => unavailableMessages.push(message),
});
assert.strictEqual(unavailable.call(OPCODES.DRAW, CALL), 0, 'missing WebGL falls back to software');
assert.strictEqual(unavailable.call(OPCODES.DRAW, CALL), 0, 'subsequent draws still fall back');
assert.strictEqual(canvasAttempts, 1, 'do not retry unavailable context per draw');
assert.strictEqual(unavailableMessages.length, 1);
assert.strictEqual(unavailable.call(OPCODES.FENCE, 0), 1, 'empty GPU fence remains safe');

console.log('test-d3dim-gpu-depthless-z: OK');
