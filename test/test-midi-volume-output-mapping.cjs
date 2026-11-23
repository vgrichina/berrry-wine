#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');
const apiTable = require('../src/api_table.json');

// DWORD = low WORD left, high WORD right; return the full value set by
// midiOutSetVolume. Preserve the implementation's device/default/MAPPER policy.
// https://learn.microsoft.com/en-us/windows/win32/api/mmeapi/nf-mmeapi-midioutgetvolume
const extraWat = String.raw`
 (func (export "mv_init")
  (global.set $thunk_guest_base (i32.add (global.get $image_base)
   (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
  (call $update_thunk_end))
 (func (export "mv_regs") (result i32) (global.get $reg_base))
 (func (export "mv_alias") (param i32 i32) (result i32)
  (call $guest_page_publish_range (local.get 0) (i32.const 4096) (local.get 1) (i32.const 4)))
 (func (export "mv_module") (param i32) (result i32)
  (call $handle_GetModuleHandleA (local.get 0) (i32.const 0) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "mv_resolve") (param i32 i32) (result i32)
  (call $handle_GetProcAddress (local.get 0) (local.get 1) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "mv_call") (param i32)
  (global.set $eip (i32.const 0x456789ab))
  (call $win32_dispatch (i32.shr_u
   (i32.sub (local.get 0) (global.get $thunk_guest_base)) (i32.const 3))))
`;

async function run({ expectParent = false } = {}) {
 let boundary = [], inspect = () => {}, inject = 0;
 const h = await bootRenderHarness({ extraWat, fonts: 'none', width: 8, height: 8,
  beforeInstantiate(ctx, host) {
   for (const [name, fn] of Object.entries(host)) if (typeof fn === 'function')
    host[name] = (...args) => {
     boundary.push([name, ...args]);
     if (name === 'midi_out_get_volume') {
      inspect(args);
      if (inject) return inject;
     }
     return fn(...args);
    };
  } });
 const { exports: e, memory, host } = h;
 e.init_thread(1, 0x400000, 0, 0, 0, 0, 0); e.heap_init(0x800000); e.mv_init(); e.set_api_log(0);
 const mem = new Uint8Array(memory.buffer), dv = new DataView(memory.buffer);
 const regs = e.mv_regs() >>> 0, wa = p => e.guest_to_wasm(p) >>> 0;
 const alloc = n => { const p = e.guest_alloc(n) >>> 0; assert.ok(p); return p; };
 const read = (p, n) => Buffer.from(Array.from({ length: n }, (_, i) => mem[wa(p + i)]));
 const str = s => { const b = Buffer.from(s + '\0'), p = alloc(b.length); mem.set(b, wa(p)); return p; };
 const stackBase = alloc(256), stack = stackBase + 64, entries = new Map();
 const stats = { queries: 0, comparisons: 0, mappingFailures: 0, controlFailures: 0, examples: [] };
 for (const [dll, names] of [
  ['WINMM.DLL', ['midiOutGetVolume', 'midiOutSetVolume', 'midiOutOpen', 'midiOutClose']],
  ['KERNEL32.DLL', ['VirtualAlloc', 'VirtualFree']],
 ]) {
  dv.setUint32(regs + 16, stack, true); const mod = e.mv_module(str(dll)) >>> 0; assert.ok(mod);
  for (const name of names) {
   dv.setUint32(regs + 16, stack, true);
   const stub = e.mv_resolve(mod, str(name)) >>> 0, row = apiTable.find(r => r.name === name);
   assert.ok(stub); assert.equal(row.convention, 'stdcall');
   const thunk = dll === 'KERNEL32.DLL' ? (stub + 5 + (e.guest_read32(stub + 1) | 0)) >>> 0 : stub;
   if (dll === 'KERNEL32.DLL') assert.equal(e.guest_read8(stub), 0xe9);
   assert.equal(e.guest_read32(thunk + 4), row.id); entries.set(name, { thunk, nargs: row.nargs });
  }
 }
 function call(name, args) {
  const row = entries.get(name); assert.equal(args.length, row.nargs);
  mem.fill(0x6d, wa(stackBase), wa(stackBase) + 256);
  e.guest_write32(stack, 0x12345678); args.forEach((v, i) => e.guest_write32(stack + 4 + i * 4, v));
  const frame = read(stackBase, 256);
  const seed = [0x81234567, 0x12345678, 0x23456789, 0x3456789a, stack, 0x456789ab, 0x56789abc, 0x6789abcd];
  seed.forEach((v, i) => dv.setUint32(regs + i * 4, v, true)); e.mv_call(row.thunk);
  assert.equal(e.get_esp() >>> 0, stack + 4 + args.length * 4, name + ' ESP');
  assert.equal(e.get_eip() >>> 0, 0x456789ab, name + ' EIP');
  for (const i of [1, 2, 3, 5, 6, 7]) assert.equal(dv.getUint32(regs + i * 4, true), seed[i], name + ' register ' + i);
  assert.deepEqual(read(stackBase, 256), frame, name + ' stack guards');
  return e.get_eax() >>> 0;
 }
 const commit = (p, n) => assert.equal(call('VirtualAlloc', [p, n, 0x3000, 4]), p);
 const fragmented = 0x30000000, adjacent = 0x31000000, alias = 0x32000000, replacement = 0x33000000;
 const decoys = [0x28000000, 0x28010000];
 for (let i = 0; i < 2; i++) { commit(fragmented + i * 4096, 4096); commit(decoys[i], 4096); }
 commit(adjacent, 8192); commit(replacement, 4096);
 for (let i = 0; i < 2; i++) assert.equal(wa(decoys[i]), wa(fragmented + i * 4096) + 4096);
 assert.notEqual(wa(fragmented + 4096), wa(fragmented) + 4096);
 assert.equal(wa(adjacent + 4096), wa(adjacent) + 4096);
 const direct = alloc(8192), outHandle = alloc(4), directPhysical = alloc(32);
 function open(id) {
  assert.equal(call('midiOutOpen', [outHandle, id, 0, 0, 0]), 0);
  return e.guest_read32(outHandle) >>> 0;
 }
 const a = open(0), b = open(0xffffffff); assert.notEqual(a, b);
 const spans = [[wa(direct), 8192], [wa(fragmented), 4096], [wa(fragmented + 4096), 4096],
  ...decoys.map(p => [wa(p), 4096]), [wa(adjacent), 8192], [wa(replacement), 4096]];
 const views = spans.map(([p, n]) => Buffer.from(memory.buffer, p, n));
 const saved = views.map(v => Buffer.alloc(v.length));
 const physicalByte = new Map();
 spans.forEach(([p, n], j) => { for (let i = 0; i < n; i++) physicalByte.set(p + i, [j, i]); });
 function compare(actual, expected, label, bucket) {
  stats.comparisons++;
  if (Buffer.isBuffer(actual) ? actual.equals(expected) : actual === expected) return;
  stats[bucket]++;
  if (stats.examples.length < 8) stats.examples.push({ label,
   actual: Buffer.isBuffer(actual) ? actual.toString('hex').slice(0, 64) : actual,
   expected: Buffer.isBuffer(expected) ? expected.toString('hex').slice(0, 64) : expected });
 }
 function query(p, handle, volume, result = 0, mapped = false) {
  spans.forEach(([start, n], i) => mem.fill(0x91 + i, start, start + n));
  views.forEach((v, i) => v.copy(saved[i]));
  const addresses = p ? Array.from({ length: 4 }, (_, i) => wa(p + i)) : [];
  if (p && !result) addresses.forEach((address, i) => {
   const loc = physicalByte.get(address); assert.ok(loc); saved[loc[0]][loc[1]] = (volume >>> (8 * i)) & 255;
  });
  const expected = Buffer.from(addresses.map(address => { const [j, i] = physicalByte.get(address); return saved[j][i]; }));
  boundary = [];
  inspect = args => {
   assert.equal(args[0] >>> 0, handle >>> 0);
   assert.ok(args[1]); // Import still receives a physical address, never a guest VA.
   assert.equal(dv.getUint32(regs, true), 0x81234567, 'host before EAX');
   assert.equal(e.get_esp() >>> 0, stack, 'host before cleanup');
   views.forEach((v, i) => assert.ok(v.every(byte => byte === 0x91 + i), 'host before output'));
  };
  compare(call('midiOutGetVolume', [handle, p]), p ? result : 11, 'return', 'controlFailures');
  inspect = () => {};
  assert.deepEqual(boundary.map(row => row[0]), p ? ['midi_out_get_volume'] : [], 'exact host call order/count');
  const bucket = mapped ? 'mappingFailures' : 'controlFailures';
  if (p) compare(read(p, 4), expected, 'logical DWORD', bucket);
  views.forEach((v, i) => compare(v, saved[i], 'full physical guard ' + i, bucket));
  assert.equal(e.guest_span_cursor_bytes(), 0); assert.equal(e.guest_span_overflow_count(), 0);
  stats.queries++;
 }
 const set = (handle, volume) => assert.equal(call('midiOutSetVolume', [handle, volume]), 0);
 // Real state, set via public WINMM thunk, independent default and two devices.
 for (const volume of [0x1234abcd, 0xe1790246, 0, 0xffffffff]) {
  set(0, 0x2468ace0); set(a, volume); set(b, 0xb9751357);
  for (const [handle, expected] of [[a, volume], [b, 0xb9751357], [0, 0x2468ace0], [0xffffffff, 0x2468ace0]]) {
   query(direct + 64, handle, expected);
   // Every DWORD phase, including all three page cuts, with adjacent and
   // independent backing. Full pages and physical fall-through decoys guarded.
   for (const base of [adjacent, fragmented]) for (let phase = 0; phase < 4096; phase++)
    query(base + phase, handle, expected, 0, base === fragmented);
  }
 }
 set(a, 0x963c5aa5);
 for (const target of [fragmented, replacement, fragmented + 4096, fragmented]) {
  assert.equal(e.mv_alias(alias, wa(target)), 1);
  assert.equal(e.mv_alias(alias + 4096, wa(target)), 1); // Actual same-backing alias, then remap/reuse.
  assert.equal(wa(alias), wa(alias + 4096));
  for (let phase = 0; phase < 4096; phase++) query(alias + phase, a, 0x963c5aa5, 0, true);
 }
 const oldBacking = wa(replacement);
 assert.equal(call('VirtualFree', [replacement, 0, 0x8000]), 1); commit(replacement, 4096);
 assert.equal(wa(replacement), oldBacking);
 for (const phase of [0, 1, 2, 3, 4092]) query(replacement + phase, a, 0x963c5aa5);
 // Host error codes must survive; failed calls must leave every output byte
 // untouched and release staging before the next success. Null bypasses host.
 assert.equal(call('midiOutClose', [b]), 0);
 for (const handle of [a, b, 0, 0xffffffff, 0xfffffffe, 7]) {
  for (const p of [0, direct + 64, fragmented + 4093, fragmented + 4094, fragmented + 4095]) {
   const valid = [a, 0, 0xffffffff].includes(handle);
   query(p, handle, handle === a ? 0x963c5aa5 : 0x2468ace0, valid ? 0 : 5, p >= fragmented);
   for (const error of [1, 7, 8, 11]) {
    inject = error; query(p, handle, 0, error, p >= fragmented); inject = 0;
   }
  }
 }
 // Direct host callers retain the physical-address ABI and exact real state.
 const phys = wa(directPhysical) + 7;
 mem.fill(0x72, wa(directPhysical), wa(directPhysical) + 32);
 assert.equal(host.midi_out_get_volume(a, phys), 0);
 assert.equal(dv.getUint32(phys, true), 0x963c5aa5);
 assert.ok(mem.slice(wa(directPhysical), phys).every(x => x === 0x72));
 assert.ok(mem.slice(phys + 4, wa(directPhysical) + 32).every(x => x === 0x72));
 assert.equal(host.midi_out_get_volume(a, 0), 11);
 assert.equal(call('midiOutClose', [a]), 0);
 console.log(JSON.stringify(stats));
 assert.equal(stats.controlFailures, 0, 'policy, literal values, ABI and contiguous controls');
 if (expectParent) assert.ok(stats.mappingFailures > 0, 'fresh parent public WINMM thunk must fail');
 else assert.equal(stats.mappingFailures, 0, 'guest output transport');
 return stats;
}
if (require.main === module) run({ expectParent: process.argv.includes('--expect-parent') }).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { run, extraWat };
