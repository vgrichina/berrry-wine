'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { compileSrcWasm } = require('./compile-src');
const { Win98Renderer } = require('../lib/renderer');
const { createCanvas } = require('../lib/canvas-compat');
const { createWindowHost } = require('../lib/host-window');
const RPC = require('../lib/guest-rpc');
const signatures = require('../lib/host-import-sigs.generated.json').sigs;

// Only entry/inspection adapters are added to the complete production module.
// No DirectInput implementation, input producer, or host input import is replaced.
const extraWat = `
 (func (export "mouse") (result i32)
  (local $obj i32)
  (local.set $obj (call $dx_create_com_obj (i32.const 7) (i32.const 0)))
  (store.field DxObject misc0 (call $dx_from_this (local.get $obj)) (i32.const 2))
  (local.get $obj))
 (func (export "stack")
  (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000)))
 (func (export "format") (param i32 i32)
  (call $handle_IDirectInputDevice_SetDataFormat (local.get 0) (local.get 1)
   (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
 (func (export "bufferSize") (param i32 i32)
  (call $handle_IDirectInputDevice_SetProperty (local.get 0) (i32.const 1) (local.get 1)
   (i32.const 0) (i32.const 0) (i32.const 0)))
 (func (export "acquire") (param i32)
  (call $handle_IDirectInputDevice_Acquire (local.get 0)
   (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
 (func (export "data") (param i32 i32 i32 i32)
  (call $handle_IDirectInputDevice_GetDeviceData (local.get 0) (i32.const 16)
   (local.get 1) (local.get 2) (local.get 3) (i32.const 0)))
 (func (export "state") (param i32 i32)
  (call $handle_IDirectInputDevice_GetDeviceState (local.get 0) (i32.const 16)
   (local.get 1) (i32.const 0) (i32.const 0) (i32.const 0)))
`;

// Literal expected offsets, signed deltas and successive sequence numbers.
// NULL without DIGDD_PEEK discards a prefix; state and event consumption are independent.
const cases = [
 ['partial discard removes exactly the requested prefix', h => {
  h.move(7, -3); h.move(-2, 5);
  h.records(4, 1, [[0, 7, 0], [4, -3, 1], [0, -2, 2], [4, 5, 3]]);
  h.discard(2, 2);
  h.records(4, 1, [[0, -2, 2], [4, 5, 3]]);
  h.records(1, 0, [[0, -2, 2]]);
  h.records(4, 0, [[4, 5, 3]]);
  h.records(4, 0, []);
  h.state([5, 2, 0, 0]); h.state([0, 0, 0, 0]);
 }],
 ['NULL PEEK and zero-capacity discard leave all movement pending', h => {
  h.move(-11, 9); h.discard(0, 0); h.count(1, 1, 1); h.count(8, 1, 2);
  h.records(1, 1, [[0, -11, 0]]); h.records(1, 1, [[0, -11, 0]]);
  h.records(8, 0, [[0, -11, 0], [4, 9, 1]]);
  h.state([-11, 9, 0, 0]); h.state([0, 0, 0, 0]);
 }],
 ['configured capacity limits a finite discard and preserves the suffix', h => {
  h.move(-8, 6); h.move(3, -4);
  h.discard(8, 2);
  h.records(8, 1, [[0, 3, 2], [4, -4, 3]]);
  h.records(8, 0, [[0, 3, 2], [4, -4, 3]]);
  h.state([-5, 2, 0, 0]); h.records(8, 0, []);
 }, 2],
 ['discarded motion never reappears after a new signed move', h => {
  h.move(-13, 17); h.state([-13, 17, 0, 0]); h.discard(8, 2);
  h.move(4, -6);
  h.records(8, 0, [[0, 4, 2], [4, -6, 3]]);
  h.state([4, -6, 0, 0]); h.records(8, 0, []);
 }],
 ['discard crosses the ring and coalesced overflow without consuming state', h => {
  for (let i = 0; i < 30; i++) h.move(1, -1);
  h.move(-7, 9); h.discard(61, 61);
  h.records(8, 1, [[4, 9, 61]]); h.records(8, 0, [[4, 9, 61]]);
  h.records(8, 0, []); h.state([23, -21, 0, 0]); h.state([0, 0, 0, 0]);
 }],
];

async function fixture(module, rpc, capacity) {
 const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
 const renderer = new Win98Renderer(createCanvas(640, 480));
 renderer.wasmMemory = memory;
 const ctx = { renderer, getMemory: () => memory.buffer };
 const windowHost = createWindowHost(ctx, {}).imports;
 const host = { memory };
 for (const entry of WebAssembly.Module.imports(module)) {
  if (entry.kind === 'function') host[entry.name] = (...args) => {
   throw Error('unexpected unrelated import: ' + entry.name + '(' + args + ')');
  };
 }
 Object.assign(host, windowHost);
 // Fixed fixture time is unrelated to movement consumption.
 host.get_ticks = () => 100;
 if (rpc) {
  const selected = Object.fromEntries(['get_mouse_buttons_live', 'di_mouse_receipt', 'queue_mouse_input']
   .map(name => [name, signatures[name]]));
  const broker = RPC.createMainBroker(memory, { ...host }, selected, {});
  const worker = RPC.createWorkerImports(memory, selected, m => broker.serveRpc(m.slot), { slot: 2 });
  Object.assign(host, worker.imports.host);
 }
 const instance = await WebAssembly.instantiate(module, { host });
 const e = instance.exports;
 renderer.wasm = instance; ctx.exports = e;
 const obj = e.mouse() >>> 0;
 const format = 0x00411000, objects = 0x00412000, property = 0x00413000;
 const buf = 0x00414000, count = 0x00415000;
 const write = (p, v) => e.guest_write32(p, v);
 const read = p => e.guest_read32(p) >>> 0;
 const call = (method, pop, ...args) => {
  e.stack(); e[method](...args); assert.equal(e.get_eax() >>> 0, 0, method + ' HRESULT');
  assert.equal(e.get_esp() >>> 0, 0x074ff000 + pop, method + ' stdcall cleanup');
 };
 [24, 16, 2, 16, 7, objects].forEach((v, i) => write(format + 4 * i, v));
 for (let i = 0; i < 7; i++) {
  [0, i < 3 ? i * 4 : i + 9, i < 3 ? 0x00ffff03 : 0x00ffff0c, 0]
   .forEach((v, j) => write(objects + 16 * i + 4 * j, v));
 }
 call('format', 12, obj, format);
 [20, 16, 0, 0, capacity].forEach((v, i) => write(property + 4 * i, v));
 call('bufferSize', 16, obj, property); call('acquire', 8, obj);
 function data(n, flags, pointer) {
  write(count, n);
  // Buffer canaries and untouched payload also detect writes through NULL.
  for (let i = -4; i < 1032; i += 4) write(buf + i, 0xa5a5a5a5);
  call('data', 24, obj, pointer, count, flags);
  const got = read(count);
  assert(got <= Math.min(n >>> 0, capacity));
  assert.equal(read(buf - 4), 0xa5a5a5a5);
  assert.equal(read(buf + (pointer ? got * 16 : 0)), 0xa5a5a5a5);
  return got;
 }
 return {
  move: (x, y) => renderer.handleRelativeMouseMove(x, y, { guestCounts: true }),
  state(expected) {
   call('state', 16, obj, buf);
   assert.deepEqual([0, 4, 8, 12].map(o => read(buf + o) | 0), expected);
  },
  discard(n, expected) { assert.equal(data(n, 0, 0), expected); },
  count(n, flags, expected) { assert.equal(data(n, flags, 0), expected); },
  records(n, flags, expected) {
   const got = data(n, flags, buf);
   const actual = Array.from({ length: got }, (_, i) =>
    [read(buf + i * 16), read(buf + i * 16 + 4) | 0, read(buf + i * 16 + 12)]);
   assert.deepEqual(actual, expected);
  },
 };
}

(async () => {
 const bytes = compileSrcWasm((file, source) => file === '13-exports.wat' ? source + extraWat : source);
 const output = process.argv.find(x => x.startsWith('--module-out='));
 if (output) fs.writeFileSync(output.slice('--module-out='.length), bytes);
 const module = await WebAssembly.compile(bytes);
 const failures = [];
 for (const rpc of [false, true]) for (const [name, run, capacity = 128] of cases) {
  try { await run(await fixture(module, rpc, capacity)); console.log('PASS ' + (rpc ? 'RPC ' : 'direct ') + name); }
  catch (error) { failures.push({ rpc, name, error: error.stack }); console.error('FAIL ' + JSON.stringify(failures.at(-1))); }
 }
 assert.equal(failures.length, 0, JSON.stringify(failures));
 console.log('PASS 10 full-production mouse discard/PEEK/state cases');
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
