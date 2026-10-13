#!/usr/bin/env node
'use strict';
// Pure JS branch coverage: no WebGL, browser, guest execution or timing claim.
const assert = require('assert');
const { D3DIMGpu, OPCODES } = require('../lib/d3dim-gpu');
const reasons = ['fallbackDrawShape', 'fallbackDrawDescribe', 'fallbackDrawTarget',
  'fallbackDrawTexture', 'fallbackClearTarget', 'fallbackClearTextureShape'];
const CALL = 0x100, CLEAR = 0x200, RT = 0x300, VERTS = 0x400;
function fixture() {
  const memory = new ArrayBuffer(4096), dv = new DataView(memory);
  const put = (at, value) => dv.setUint32(at, value, true);
  [1, 4, 3, VERTS, 3].forEach((v, i) => put(CALL + i * 4, v));
  [RT, 1, 0, 0, 0, 0, 8, 8].forEach((v, i) => put(CLEAR + i * 4, v));
  const messages = [], draws = [], clears = [];
  const gpu = new D3DIMGpu({ getMemory: () => memory,
    getExports: () => ({ guest_to_wasm: a => a, d3dim_gpu_surface_fmt: () => 1,
      d3dim_gpu_decode_texture: () => 0 }),
    createCanvas: () => { throw new Error('mock tests must not create a canvas'); },
    onError: m => messages.push(m), batchDraws: false });
  const desc = { rt: RT, width: 8, height: 8, dib: 0x800, bpp: 32, pitch: 32 };
  const target = { ...desc, drawn: true, check: false, textureKeys: new Set(),
    device: { draw: d => draws.push(d), clear: (...args) => clears.push(args) } };
  gpu._describe = () => desc;
  gpu._target = () => target;
  gpu.targets.set(RT, target);
  const texture = () => {
    Object.assign(desc, { texture: 1, texWidth: 1, texHeight: 1, texPitch: 4, texDib: 0x900 });
    [1, 1, 1, 32, 4, 0x900].forEach((v, i) => put(CLEAR + 32 + i * 4, v));
  };
  return { gpu, desc, target, put, texture, messages, draws, clears };
}
function check(gpu, reason = null, count = 1) {
  const s = gpu.snapshot();
  for (const name of reasons) assert.strictEqual(s[name], name === reason ? count : 0, name);
  assert.strictEqual(s.fallbacks, reasons.reduce((sum, name) => sum + s[name], 0), 'reason sum');
  assert.strictEqual(s.fallbackDrawShape, Array.from({ length: 7 }, (_, i) => s[`shapeRejectMask${i + 1}`])
    .reduce((a, b) => a + b, 0), 'disjoint shape mask sum');
  assert.strictEqual(s.fallbackDrawShape, ['0', '1', '2', '3', '4To15', '16Plus']
    .reduce((sum, bucket) => sum + s[`shapeCount${bucket}`], 0), 'count bucket sum');
  assert.strictEqual(s.fallbackDrawShape, Array.from({ length: 8 }, (_, i) => s[`shapeTuple${i}Draws`])
    .reduce((a, b) => a + b, s.shapeTupleOverflow), 'tuple plus overflow sum');
  return s;
}
function reject(reason, setup, opcode = OPCODES.DRAW, address = CALL) {
  const f = fixture(); setup(f);
  const initial = check(f.gpu);
  for (let i = 1; i <= 2; i++) {
    assert.strictEqual(f.gpu.call(opcode, address), 0);
    check(f.gpu, reason, i);
    assert.strictEqual(f.gpu.stats.errors, 0);
    assert.strictEqual(f.gpu.stats.declinedClears, 0);
  }
  assert.strictEqual(initial.fallbacks, 0, 'prior snapshot remains unchanged');
  assert.strictEqual(initial[reason], 0);
  const external = f.gpu.snapshot(); external[reason] = 999; external.fallbacks = 999;
  check(f.gpu, reason, 2);
}
// Shape predicates share the aggregate bucket, including overlapping invalid inputs.
for (const [primitive, type, count] of [[4, 2, 3], [2, 3, 1], [3, 3, 0],
  [0, 3, 3], [7, 3, 3], [4, 3, 2], [0, 2, 0]]) {
  reject('fallbackDrawShape', f => {
    f.put(CALL + 4, primitive); f.put(CALL + 8, type); f.put(CALL + 16, count);
    f.gpu._describe = () => { throw new Error('shape rejection must stop before describe'); };
  });
}
// Exact masks distinguish every overlap, including short unsupported primitives.
for (const [primitive, type, count, mask] of [[4, 2, 3, 1], [0, 3, 3, 2],
  [7, 2, 3, 3], [2, 3, 1, 4], [3, 2, 0, 5], [0, 3, 2, 6], [0, 2, 1, 7],
  [4, 3, 2, 4], [6, 3, 0, 4], [0xffffffff, 0xffffffff, 0xffffffff, 3]]) {
  const f = fixture(), before = f.gpu.snapshot();
  f.put(CALL + 4, primitive); f.put(CALL + 8, type); f.put(CALL + 16, count);
  for (let n = 1; n <= 2; n++) {
    assert.strictEqual(f.gpu.call(OPCODES.DRAW, CALL), 0);
    const s = check(f.gpu, 'fallbackDrawShape', n);
    assert.strictEqual(s[`shapeRejectMask${mask}`], n);
    assert.deepStrictEqual([s.shapeTupleUsed, s.shapeTuple0VertexType, s.shapeTuple0Primitive,
      s.shapeTuple0Count, s.shapeTuple0Draws, s.shapeTupleOverflow], [1, type, primitive, count, n, 0]);
  }
  assert.strictEqual(before.shapeTupleUsed, 0);
  assert.strictEqual(before.shapeTuple0Draws, 0);
  const external = f.gpu.snapshot();
  external.shapeTuple0Primitive = 99; external.shapeTuple0Draws = 99;
  assert.strictEqual(f.gpu.snapshot().shapeTuple0Primitive, primitive);
  assert.strictEqual(f.gpu.snapshot().shapeTuple0Draws, 2);
}
{
  const f = fixture(), keys = Object.keys(f.gpu.snapshot());
  f.put(CALL + 8, 2); // Reject even when count and primitive are otherwise supported.
  const counts = [0, 1, 2, 3, 4, 15, 16, 0xffffffff, 17, 18, 17, 0];
  for (const count of counts) {
    f.put(CALL + 16, count);
    assert.strictEqual(f.gpu.call(OPCODES.DRAW, CALL), 0);
  }
  const s = check(f.gpu, 'fallbackDrawShape', counts.length);
  assert.deepStrictEqual(Object.keys(s), keys, 'no field growth after tuple saturation');
  assert.strictEqual(s.shapeTupleUsed, 8);
  assert.strictEqual(s.shapeTupleOverflow, 3, 'overflow counts operations, including repeats');
  assert.strictEqual(s.shapeTuple0Draws, 2, 'retained tuples still accumulate after saturation');
  assert.deepStrictEqual(Array.from({ length: 8 }, (_, i) => s[`shapeTuple${i}Count`]), counts.slice(0, 8));
  assert.deepStrictEqual(['0', '1', '2', '3', '4To15', '16Plus'].map(b => s[`shapeCount${b}`]),
    [2, 1, 1, 1, 2, 5]);
  assert(Object.values(s).every(Number.isFinite), 'snapshots contain only finite numbers');
}
reject('fallbackDrawDescribe', f => { f.gpu._describe = () => null; });
reject('fallbackDrawTarget', f => { f.gpu._target = () => null; });
reject('fallbackDrawTexture', f => { f.texture(); }); // Real decoder returns zero.
reject('fallbackClearTarget', f => { f.gpu._target = () => null; }, OPCODES.CLEAR, CLEAR);
for (const offset of [36, 40, 48, 52]) {
  reject('fallbackClearTextureShape', f => { f.texture(); f.put(CLEAR + offset, 0); }, OPCODES.CLEAR, CLEAR);
}
// Accepted triangles, line lists/strips, textured draws, solid/background clears.
for (const primitive of [2, 3, 4, 5, 6]) {
  const f = fixture(); f.put(CALL + 4, primitive);
  f.put(CALL + 16, primitive <= 3 ? 2 : 3); // Accepted minimum for each primitive.
  assert.strictEqual(f.gpu.call(OPCODES.DRAW, CALL), 1);
  assert.strictEqual(f.draws.length, 1); check(f.gpu);
}
{
  const f = fixture(); f.texture(); f.gpu._texture = () => ({ key: 'mock' });
  assert.strictEqual(f.gpu.call(OPCODES.DRAW, CALL), 1); check(f.gpu);
}
{
  const f = fixture();
  assert.strictEqual(f.gpu.call(OPCODES.CLEAR, CLEAR), 1);
  assert.strictEqual(f.clears.length, 1); check(f.gpu);
  f.texture(); f.gpu._clearTexture = () => 1;
  assert.strictEqual(f.gpu.call(OPCODES.CLEAR, CLEAR), 1);
  assert.strictEqual(f.gpu.stats.textureClears, 1); check(f.gpu);
}
for (const absent of [false, true]) {
  const f = fixture();
  if (absent) f.gpu.targets.delete(RT); else f.target.drawn = false;
  assert.strictEqual(f.gpu.call(OPCODES.CLEAR, CLEAR), 0);
  assert.strictEqual(f.gpu.stats.declinedClears, 1); check(f.gpu);
}
{
  const f = fixture(); f.texture();
  // A valid background shape whose decoder declines is not an aggregate fallback.
  assert.strictEqual(f.gpu.call(OPCODES.CLEAR, CLEAR), 0); check(f.gpu);
  assert.strictEqual(f.gpu.stats.errors, 0);
}
for (const opcode of [OPCODES.DRAW, OPCODES.CLEAR]) {
  const f = fixture();
  f.target.device[opcode === OPCODES.DRAW ? 'draw' : 'clear'] = () => { throw new Error('device failure'); };
  assert.strictEqual(f.gpu.call(opcode, opcode === OPCODES.DRAW ? CALL : CLEAR), 0);
  assert.strictEqual(f.gpu.stats.errors, 1); assert.strictEqual(f.messages.length, 1); check(f.gpu);
}
console.log('test-d3dim-gpu-fallback-counters: OK');
