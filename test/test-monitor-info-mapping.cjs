#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');
const { makeFixture } = require('../tools/kernel32-native-fixture');
const apiTable = require('../src/api_table.json');

// Only setup/inspection exports: the API under test runs through the public
// USER32 PE export, resolver, stdcall thunk and x86 interpreter.
const extraWat = String.raw`
 (func (export "mi_error") (result i32) (global.get $last_error))
 (func (export "mi_seed_error") (param i32) (global.set $last_error (local.get 0)))
 (func (export "mi_regs") (result i32) (global.get $reg_base))
 (func (export "mi_thread") (result i32) (global.get $current_thread_id))
 (func (export "mi_alias") (param i32 i32) (result i32)
  (call $guest_page_publish_range (local.get 0) (i32.const 4096)
   (local.get 1) (i32.const 4)))
 (func (export "mi_module") (param i32) (result i32)
  (call $handle_GetModuleHandleA (local.get 0) (i32.const 0) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "mi_resolve") (param i32 i32) (result i32)
  (call $handle_GetProcAddress (local.get 0) (local.get 1) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
`;

async function run({ expectParent = false, prebuiltModule = null } = {}) {
 const { exports: e, memory } = await bootRenderHarness({ extraWat: prebuiltModule ? '' : extraWat,
  prebuiltModule, fonts: 'none', width: 640, height: 480 });
 const fixture = makeFixture(); new Uint8Array(memory.buffer).set(fixture, e.get_staging());
 assert.ok(e.load_pe(fixture.length), 'fresh actual PE load'); e.set_api_log(0);
 const mem = new Uint8Array(memory.buffer), dv = new DataView(memory.buffer);
 const regs = e.mi_regs() >>> 0, wa = p => e.guest_to_wasm(p >>> 0) >>> 0;
 const alloc = n => { const p = e.guest_alloc(n) >>> 0; assert.ok(p); return p; };
 const str = s => { const b = Buffer.from(s + '\0'), p = alloc(b.length);
  b.forEach((v, i) => e.guest_write8(p + i, v)); return p; };
 const stackBase = alloc(256), stack = stackBase + 64, entries = new Map();
 const stats = { calls: 0, queries: 0, mappingFailures: 0, controlFailures: 0, examples: [] };
 for (const [dll, names] of [['USER32.DLL', ['GetMonitorInfoA']],
  ['KERNEL32.DLL', ['VirtualAlloc', 'VirtualFree']]]) {
  dv.setUint32(regs + 16, stack, true); const mod = e.mi_module(str(dll)) >>> 0; assert.ok(mod);
  assert.equal(e.guest_read32(mod) & 0xffff, 0x5a4d, dll + ' PE module');
  for (const name of names) {
   dv.setUint32(regs + 16, stack, true);
   const entry = e.mi_resolve(mod, str(name)) >>> 0, row = apiTable.find(r => r.name === name);
   assert.ok(entry); assert.equal(row.convention, 'stdcall');
   const thunk = e.guest_read8(entry) === 0xe9 ? (entry + 5 + (e.guest_read32(entry + 1) | 0)) >>> 0 : entry;
   assert.equal(e.guest_read32(thunk + 4), row.id, name + ' resolved thunk ID');
   entries.set(name, { entry, nargs: row.nargs });
  }
 }
 function call(name, args) {
  const row = entries.get(name); assert.equal(args.length, row.nargs);
  mem.fill(0x6d, wa(stackBase), wa(stackBase) + 256);
  e.guest_write32(stack, 0); args.forEach((v, i) => e.guest_write32(stack + 4 + i * 4, v));
  const frame = Buffer.from(mem.subarray(wa(stackBase), wa(stackBase) + 256));
  const seed = [0x81234567, 0x12345678, 0x23456789, 0x3456789a, stack, 0x456789ab, 0x56789abc, 0x6789abcd];
  seed.forEach((v, i) => dv.setUint32(regs + i * 4, v, true));
  const thread = e.mi_thread(); e.clear_yield(); e.set_eip(row.entry);
  for (let i = 0; i < 16 && e.get_eip(); i++) e.run(32);
  stats.calls++;
  assert.equal(e.get_eip() >>> 0, 0, name + ' x86 return');
  assert.equal(e.get_esp() >>> 0, stack + 4 + args.length * 4, name + ' ESP (GetMonitorInfoA +12)');
  assert.equal(e.mi_thread(), thread, name + ' thread');
  for (const i of [1, 2, 3, 5, 6, 7]) assert.equal(dv.getUint32(regs + i * 4, true), seed[i], name + ' register ' + i);
  assert.deepEqual(mem.subarray(wa(stackBase), wa(stackBase) + 256), new Uint8Array(frame), name + ' stack guards');
  return e.get_eax() >>> 0;
 }
 const pages = new Map(), spans = [];
 const register = (g, n) => {
  for (let i = 0; i < n; i += 4096) pages.set(g + i, wa(g + i));
  spans.push([wa(g), n]);
 };
 const commit = (p, n) => {
  assert.equal(call('VirtualAlloc', [p, n, 0x3000, 4]), p); register(p, n);
 };
 const separate = 0x30000000, adjacent = 0x31000000, alias = 0x32000000, reuse = 0x33000000;
 const decoys = [0x28000000, 0x28010000];
 for (let i = 0; i < 2; i++) { commit(separate + i * 4096, 4096); commit(decoys[i], 4096); }
 commit(adjacent, 8192); commit(reuse, 4096);
 for (let i = 0; i < 2; i++) assert.equal(wa(decoys[i]), wa(separate + i * 4096) + 4096);
 assert.notEqual(wa(separate + 4096), wa(separate) + 4096, 'nonadjacent backing');
 assert.equal(wa(adjacent + 4096), wa(adjacent) + 4096);
 const direct = (alloc(12288) + 4095) & ~4095; register(direct, 8192);
 spans.push([0xf0, 64]);
 const views = spans.map(([p, n]) => Buffer.from(memory.buffer, p, n));
 const expected = views.map(b => Buffer.alloc(b.length));
 // The oracle routes bytes using this independent page map, never guest_read,
 // guest_write, a production struct helper, or the handler's packing logic.
 const physical = g => pages.get(g & ~4095) + (g & 4095);
 const put = (g, v) => { mem[physical(g)] = v; };
 const publish = (g, backing) => {
  assert.equal(e.mi_alias(g, pages.get(backing)), 1);
  pages.set(g, pages.get(backing)); assert.equal(wa(g), pages.get(g));
 };
 publish(alias, separate); publish(alias + 4096, separate);
 // Literal little-endian bytes for the existing 640x480 monitor, 640x452
 // work area, primary flag and exact 32-byte device field (including zeros).
 const outputs = new Map([
  [40, Buffer.from('28000000000000000000000080020000e0010000000000000000000080020000c401000001000000', 'hex')],
  [72, Buffer.from('48000000000000000000000080020000e0010000000000000000000080020000c4010000010000005c5c2e5c444953504c4159310000000000000000000000000000000000000000', 'hex')],
 ]);
 assert.equal(outputs.get(40).length, 40); assert.equal(outputs.get(72).length, 72);
 function query(p, size, monitor, label, mapped) {
  views.forEach(b => b.fill(0xa7));
  if (p) for (let i = 0; i < 4; i++) put(p + i, (size >>> (8 * i)) & 255);
  views.forEach((b, i) => b.copy(expected[i]));
  const ok = monitor === 0x10000 && p !== 0 && outputs.has(size);
  if (ok) for (let i = 4; i < size; i++) {
   const addr = physical(p + i);
   const j = spans.findIndex(([start, n]) => addr >= start && addr < start + n);
   assert.ok(j >= 0); expected[j][addr - spans[j][0]] = outputs.get(size)[i];
  }
  const error = monitor !== 0x10000 ? 1461 : ok ? 0x87654321 : 87;
  e.mi_seed_error(0x87654321);
  const actual = call('GetMonitorInfoA', [monitor, p]); stats.queries++;
  let failure = actual !== Number(ok) || (e.mi_error() >>> 0) !== error;
  for (let i = 0; i < views.length; i++) if (!views[i].equals(expected[i])) failure = true;
  if (failure) {
   stats[mapped ? 'mappingFailures' : 'controlFailures']++;
   if (stats.examples.length < 8) stats.examples.push({label, p, size, monitor, actual, error: e.mi_error() >>> 0});
  }
  assert.equal(e.guest_span_cursor_bytes(), 0); assert.equal(e.guest_span_overflow_count(), 0);
 }
 for (const [base, mapped, name] of [[direct, false, 'direct'], [adjacent, false, 'adjacent'],
  [separate, true, 'separate'], [alias, true, 'alias']]) {
  for (let phase = 0; phase < 4096; phase++) {
   for (const size of [40, 72, 0, 39, 41, 71, 73, 0xffffffff])
    query(base + phase, size, 0x10000, name + '/' + phase, mapped);
   query(base + phase, 72, 0x9999, name + '/invalid-monitor/' + phase, false);
   query(base + phase, 39, 0, name + '/precedence/' + phase, false);
  }
 }
 for (const [a, b] of [[reuse, separate], [separate + 4096, reuse], [separate, reuse]]) {
  publish(alias, a); publish(alias + 4096, b);
  for (const phase of [0, 1, ...Array.from({length: 73}, (_, i) => 4095 - i)])
   for (const size of [40, 72, 39, 73]) query(alias + phase, size, 0x10000, 'remap/' + phase, true);
 }
 const old = wa(reuse);
 assert.equal(call('VirtualFree', [reuse, 4096, 0x4000]), 1);
 assert.equal(call('VirtualAlloc', [reuse, 4096, 0x1000, 4]), reuse);
 assert.equal(wa(reuse), old, 'decommit/recommit reuse');
 assert.equal(call('VirtualFree', [reuse, 0, 0x8000]), 1); commit(reuse, 4096);
 assert.equal(wa(reuse), old, 'release/reallocate reuse');
 publish(alias, reuse); publish(alias + 4096, separate + 4096);
 for (let phase = 0; phase < 4096; phase++) for (const size of [40, 72])
  query(alias + phase, size, 0x10000, 'reuse/' + phase, true);
 // Strict unmapped diagnostics prove monitor/null precedence before cbSize
 // transport, and that successful writes stop at the declared structure end.
 e.set_fault_unmapped(2);
 for (const monitor of [0, 0x9999, 0x10000]) query(0, 72, monitor, 'NULL', false);
 for (const size of [40, 72]) query(reuse + 4096 - size, size, 0x10000, 'terminal', false);
 e.mi_seed_error(123);
 assert.equal(call('GetMonitorInfoA', [0x9999, 0x60000000]), 0);
 assert.equal(e.mi_error(), 1461);
 e.set_fault_unmapped(0);
 console.log(JSON.stringify(stats));
 assert.equal(stats.controlFailures, 0, 'literal bytes/errors/precedence/ABI/guards controls');
 if (expectParent) assert.ok(stats.mappingFailures > 0, 'fresh public parent must fail mapping oracle');
 else assert.equal(stats.mappingFailures, 0, 'mapped monitor bytes and complete backing guards');
 return stats;
}
if (require.main === module) run({expectParent: process.argv.includes('--expect-parent')})
 .catch(error => { console.error(error); process.exitCode = 1; });
module.exports = {run, extraWat};
