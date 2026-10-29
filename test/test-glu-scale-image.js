#!/usr/bin/env node
'use strict';

// Real host implementation and production stream replay; no GL driver or PE.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
let gl = require('../lib/gl-compat');
// Same executable regression can reject the pinned pre-change implementation.
if (process.env.GLU_CONTROL_SOURCE) {
  const Module = require('module');
  const filename = path.resolve(__dirname, '../lib/gl-compat.js');
  const control = new Module(filename, module);
  control.filename = filename;
  control.paths = module.paths;
  control._compile(fs.readFileSync(process.env.GLU_CONTROL_SOURCE, 'utf8'), filename);
  gl = control.exports;
}
const stream = require('../lib/gl-command-stream');
const { CALL_INDEX, CALLS, OpenGLHostBridge, FixedFunctionGL } = gl;
assert.strictEqual(CALL_INDEX.gluScaleImage, 141, 'production gluScaleImage opcode must exist');
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
assert.strictEqual(hash(CALLS.slice(0, 141)), '8548357a1e86d6a0a4f4c869bfb8f1e6940363c2cc58a2bfd0064f40eb151044',
  'all established GL/WGL opcodes retain their ordering');
assert.strictEqual(stream.ARG_WORDS[141], 9);
assert(stream.BARRIERS.has(141), 'guest output and GLU status must be synchronous');

const root = path.resolve(__dirname, '..');
const table = JSON.parse(fs.readFileSync(path.join(root, 'src/api_table.json')));
assert.strictEqual(hash(table.slice(0, 4594)), '6326d56574a4462446c295d8c3bb70f4f5328979b1d293ce4ff52e5ee1cc0520',
  'all established API rows are unchanged');
const api = table.find(a => a.name === 'gluScaleImage');
assert(api && api.id === 4594 && api.nargs === 9 && api.convention === 'stdcall');
let fnv = 0x811c9dc5;
for (const c of api.name) fnv = Math.imul(fnv ^ c.charCodeAt(0), 0x01000193) >>> 0;
assert.strictEqual(api.hash, fnv);
const hashLine = fs.readFileSync(path.join(root, 'src/01b-api-hashes.generated.wat'), 'utf8')
  .split('\n').find(l => l.endsWith(': gluScaleImage'));
assert(hashLine, 'production hash table exposes the import');
const bytes = Buffer.from([...hashLine.matchAll(/\\([0-9a-f]{2})/g)].map(m => parseInt(m[1], 16)));
assert.strictEqual(bytes.readUInt32LE(0), fnv);
assert.strictEqual(bytes.readUInt32LE(4), api.id);
const dispatch = fs.readFileSync(path.join(root, 'src/09b2-dispatch-table.generated.wat'), 'utf8');
assert(dispatch.includes('(call $handle_gpu_api (i32.const 141) (i32.const 9)'), 'real generated dispatch selects nine dwords');
const handler = fs.readFileSync(path.join(root, 'src/09a8b-handlers-opengl.wat'), 'utf8');
assert(handler.includes('(i32.shl (i32.add (local.get $stack_dwords) (i32.const 1)) (i32.const 2))'),
  'production stdcall cleanup consumes return address plus all arguments');
const lists = fs.readFileSync(path.join(root, 'src/09a8ca-gl-lists.wat'), 'utf8');
assert(lists.includes('(i32.const 141)) (then (return (i32.const 1))))'), 'GLU conversion executes inside GL_COMPILE');

const memory = new ArrayBuffer(65536), u8 = new Uint8Array(memory), dv = new DataView(memory);
let translate = p => p;
const bridge = new OpenGLHostBridge({ getMemory: () => memory, exports: { guest_to_wasm: p => translate(p) } });
const backend = { gl: {}, createProgram: () => ({}), createBuffer: () => ({}), createTexture: () => ({}), getError: () => 0 };
const frontend = new FixedFunctionGL(backend);
bridge.current = 1;
bridge.contexts.set(1, { frontend });
const stack = 256, src = 8192, dst = 16384;
function call(name, args) {
  dv.setUint32(stack, 0x12345678, true);
  args.forEach((v, i) => dv.setUint32(stack + 4 + i * 4, v >>> 0, true));
  return bridge.call(CALL_INDEX[name], stack, 0);
}
const scale = (format, wi, hi, ti, wo = wi, ho = hi, to = ti, input = src, output = dst) =>
  call('gluScaleImage', [format, wi, hi, ti, input, wo, ho, to, output]);
const store = (p, v) => call('glPixelStorei', [p, v]);
function reset() {
  translate = p => p;
  for (const base of [0x0D00, 0x0CF0]) for (let i = 0; i <= 5; i++) store(base + i, i === 5 ? 4 : 0);
  u8.fill(0xCD, dst, dst + 128);
}
reset();
u8.set([3, 9, 17, 25, 33, 41, 0xAA, 0xBB, 51, 61, 71, 81, 91, 101], src);
assert.strictEqual(scale(0x1907, 2, 2, 0x1401), 0);
assert.deepStrictEqual(Array.from(u8.slice(dst, dst + 14)), [3, 9, 17, 25, 33, 41, 0xCD, 0xCD, 51, 61, 71, 81, 91, 101]);
assert.strictEqual(u8[dst + 14], 0xCD, 'last row has no required padding');
for (const alignment of [1, 2, 4, 8]) {
  reset(); store(0x0CF5, alignment); store(0x0D05, alignment);
  const stride = Math.ceil(3 / alignment) * alignment;
  u8.set([10, 20, 30], src); u8.set([40, 50, 60], src + stride);
  assert.strictEqual(scale(0x1907, 1, 2, 0x1401), 0);
  assert.deepStrictEqual(Array.from(u8.slice(dst + stride, dst + stride + 3)), [40, 50, 60]);
  for (let i = 3; i < stride; i++) assert.strictEqual(u8[dst + i], 0xCD);
}
reset(); store(0x0CF5, 1); store(0x0D05, 1);
u8.set([0, 100, 200, 100], src);
assert.strictEqual(scale(0x1909, 2, 2, 0x1401, 1, 1), 0);
assert.strictEqual(u8[dst], 100, '2x2 reduction averages all four pixels');
u8.set([0, 100], src);
assert.strictEqual(scale(0x1909, 2, 1, 0x1401, 4, 1), 0);
assert.deepStrictEqual(Array.from(u8.slice(dst, dst + 4)), [25, 25, 75, 75], 'linear enlargement including periodic GLU edges');
u8.set([0, 60, 120], src);
assert.strictEqual(scale(0x1909, 3, 1, 0x1401, 2, 1), 0);
assert.deepStrictEqual(Array.from(u8.slice(dst, dst + 2)), [20, 100], 'fractional box coverage');

reset();
store(0x0CF2, 4); store(0x0CF3, 1); store(0x0CF4, 1);
store(0x0D02, 5); store(0x0D03, 1); store(0x0D04, 2);
u8.set([4, 8], src + 5); u8.set([12, 16], src + 9);
assert.strictEqual(scale(0x1909, 2, 2, 0x1401), 0);
assert.deepStrictEqual([u8[dst + 10], u8[dst + 11], u8[dst + 18], u8[dst + 19]], [4, 8, 12, 16]);
assert.strictEqual(u8[dst + 9], 0xCD);
call('glPushClientAttrib', [1]); store(0x0D02, 0); store(0x0CF4, 0); call('glPopClientAttrib', []);
assert.strictEqual(frontend.pixelStore[0x0D02], 5);
assert.strictEqual(frontend.pixelStore[0x0CF4], 1);
call('glGetIntegerv', [0x0D02, dst + 100]); assert.strictEqual(dv.getInt32(dst + 100, true), 5);
store(0x0CF5, 3); assert.strictEqual(call('glGetError', []), 0x0501);
assert.strictEqual(frontend.unpackAlignment, 4);

// Scalar conversion, byte swapping and every legal format's component count.
for (const format of [0x1900, 0x1901, 0x1902, 0x1903, 0x1904, 0x1905, 0x1906, 0x1907, 0x1908, 0x1909, 0x190A, 0x80E0, 0x80E1]) {
  reset(); u8.fill(73, src, src + 4);
  assert.strictEqual(scale(format, 1, 1, 0x1401), 0);
  assert.strictEqual(u8[dst], 73);
}
for (const [type, size, kind, value] of [[0x1400, 1, 'Int8', 63], [0x1401, 1, 'Uint8', 127],
  [0x1402, 2, 'Int16', 12345], [0x1403, 2, 'Uint16', 45678], [0x1404, 4, 'Int32', 0x23452345],
  [0x1405, 4, 'Uint32', 0xABCDABCD], [0x1406, 4, 'Float32', 0.5]]) {
  reset(); store(0x0CF0, 1); store(0x0D00, 1);
  dv['set' + kind](src, value, false);
  assert.strictEqual(scale(0x1909, 1, 1, type), 0);
  const result = dv['get' + kind](dst, false);
  assert(Math.abs(result - value) <= (size === 4 && type !== 0x1406 ? 65537 : type === 0x1406 ? 1 / 65535 : 0), `${kind} conversion`);
}
reset(); dv.setFloat32(src, 1, true);
assert.strictEqual(scale(0x1909, 1, 1, 0x1406, 1, 1, 0x1401), 0); assert.strictEqual(u8[dst], 255);

// Packed RGB/RGBA, normal and REV encodings, with roundtrip extrema.
for (const [type, size, channels] of [[0x8032,1,3],[0x8362,1,3],[0x8363,2,3],[0x8364,2,3],
  [0x8033,2,4],[0x8365,2,4],[0x8034,2,4],[0x8366,2,4],[0x8035,4,4],[0x8367,4,4],[0x8036,4,4],[0x8368,4,4]]) {
  reset(); u8.fill(255, src, src + size);
  assert.strictEqual(scale(channels === 3 ? 0x1907 : 0x1908, 1, 1, type), 0);
  assert.deepStrictEqual(Array.from(u8.slice(dst, dst + size)), Array(size).fill(255));
}
reset(); dv.setUint16(src, 0xF800, true);
assert.strictEqual(scale(0x1907, 1, 1, 0x8363, 1, 1, 0x1401), 0);
assert.deepStrictEqual(Array.from(u8.slice(dst, dst + 3)), [255, 0, 0]);
reset(); store(0x0CF1, 1); store(0x0D01, 0); store(0x0CF4, 1); store(0x0D04, 2);
u8[src] = 0b00001010; u8[dst] = 0xFF;
assert.strictEqual(scale(0x1900, 3, 1, 0x1A00), 0);
assert.strictEqual(u8[dst], 0b11101111, 'bitmap skips, LSB input, MSB output, untouched surrounding bits');

reset();
for (const args of [[0x1907,-1,1,0x1401], [0x1907,1,-1,0x1401], [0x1907,1,1,0x1401,-1,1], [0x1907,1,1,0x1401,1,-1]]) {
  assert.strictEqual(scale(...args), 100901);
}
assert.strictEqual(scale(0xDEAD, 1, 1, 0x1401), 100900);
assert.strictEqual(scale(0x1907, 1, 1, 0xDEAD), 100900);
assert.strictEqual(scale(0x1907, 1, 1, 0x1401, 1, 1, 0xDEAD), 100900);
assert.strictEqual(scale(0x1908, 1, 1, 0x8363), 100904);
assert.strictEqual(scale(0x1907, 1, 1, 0x1401, 1, 1, 0x8033), 100904);
assert.strictEqual(scale(0x1907, 0, 1, 0x1401, 1, 1, 0x1401, 0, 0), 0);
assert.strictEqual(scale(0x1908, 0x7FFFFFFF, 0x7FFFFFFF, 0x1401), 100902);
for (const [input, output] of [[0, dst], [src, 0], [65535, dst], [src, 65535], [0xFFFFFFFE, dst], [src, 0xFFFFFFFE]]) {
  u8.fill(0xCD, dst, dst + 128);
  assert.strictEqual(scale(0x1907, 2, 2, 0x1401, 2, 2, 0x1401, input, output), 100901);
  assert(u8.slice(dst, dst + 128).every(v => v === 0xCD), 'failure never partly writes output');
}
translate = p => p >= dst + 4096 ? 0xF0 : p;
assert.strictEqual(scale(0x1907, 1024, 2, 0x1401), 100901);
assert(u8.slice(dst, dst + 128).every(v => v === 0xCD), 'late unmapped output page is rejected before any writes');
translate = p => p;
// Guest continuity does not imply contiguous sparse physical backing.
const sparseIn = 0x10000000, sparseOut = 0x20000000;
translate = p => p >= sparseIn && p < sparseIn + 8192
  ? 32768 + (p - sparseIn < 4096 ? p - sparseIn : p - sparseIn + 4096)
  : p >= sparseOut && p < sparseOut + 8192
    ? 49152 + (p - sparseOut < 4096 ? p - sparseOut : p - sparseOut + 4096) : p;
u8.fill(0xCD, 32768);
for (let y = 0; y < 2; y++) for (let b = 0; b < 3075; b++) u8[translate(sparseIn + y * 3076 + b)] = (b + y) & 255;
assert.strictEqual(scale(0x1907, 1025, 2, 0x1401, 1025, 2, 0x1401, sparseIn, sparseOut), 0);
for (let y = 0; y < 2; y++) for (let b = 0; b < 3075; b++) assert.strictEqual(u8[translate(sparseOut + y * 3076 + b)], (b + y) & 255);
assert(u8.slice(53248, 57344).every(v => v === 0xCD), 'unrelated slab between output pages remains untouched');
reset(); store(0x0CF5, 1); store(0x0D05, 1);
u8.set([1, 2, 3, 4], src);
assert.strictEqual(scale(0x1909, 4, 1, 0x1401, 4, 1, 0x1401, src, src + 1), 0);
assert.deepStrictEqual(Array.from(u8.slice(src + 1, src + 5)), [1, 2, 3, 4], 'overlapping buffers use an input snapshot');

// The unchanged production replay consumes nine captured arguments and writes
// guest memory, rather than writing into the detached captured stack buffer.
const record = new ArrayBuffer(72), rd = new DataView(record);
rd.setUint32(0, 72, true); rd.setUint32(4, 141, true); rd.setUint32(12, 40, true);
[0x1909, 2, 1, 0x1401, src, 1, 1, 0x1401, dst].forEach((v,i) => rd.setUint32(36 + i * 4, v, true));
u8.set([20, 80], src);
assert.strictEqual(bridge.replay({ buffer: record, bytes: 72 }), 0);
assert.strictEqual(u8[dst], 50, 'synchronous replay publishes scaled output');
rd.setUint32(36 + 3 * 4, 0xDEAD, true);
assert.strictEqual(bridge.replay({ buffer: record, bytes: 72 }), 100900, 'synchronous replay propagates GLU error');
console.log('gluScaleImage: production lookup/dispatch ABI, replay, filtering, pixel stores, types and bounds PASS');
