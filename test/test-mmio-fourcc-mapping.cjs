#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');
const { makeFixture } = require('../tools/kernel32-native-fixture');
const apiTable = require('../src/api_table.json');

// Only setup/inspection exports: the API under test runs through the public
// WINMM PE export, resolver, stdcall thunk and x86 interpreter.
const extraWat = String.raw`
 (func (export "fc_regs") (result i32) (global.get $reg_base))
 (func (export "fc_thread") (result i32) (global.get $current_thread_id))
 (func (export "fc_alias") (param i32 i32) (result i32)
  (call $guest_page_publish_range (local.get 0) (i32.const 4096)
   (local.get 1) (i32.const 4)))
 (func (export "fc_module") (param i32) (result i32)
  (call $handle_GetModuleHandleA (local.get 0) (i32.const 0) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "fc_resolve") (param i32 i32) (result i32)
  (call $handle_GetProcAddress (local.get 0) (local.get 1) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
`;

async function run({ expectParent = false } = {}) {
 const { exports: e, memory } = await bootRenderHarness({ extraWat, fonts: 'none', width: 8, height: 8 });
 const fixture = makeFixture(); new Uint8Array(memory.buffer).set(fixture, e.get_staging());
 assert.ok(e.load_pe(fixture.length), 'fresh actual PE load'); e.set_api_log(0);
 const mem = new Uint8Array(memory.buffer), dv = new DataView(memory.buffer);
 const regs = e.fc_regs() >>> 0, wa = p => e.guest_to_wasm(p >>> 0) >>> 0;
 const alloc = n => { const p = e.guest_alloc(n) >>> 0; assert.ok(p); return p; };
 const str = s => { const b = Buffer.from(s + '\0'), p = alloc(b.length);
  b.forEach((v, i) => e.guest_write8(p + i, v)); return p; };
 const stackBase = alloc(256), stack = stackBase + 64, entries = new Map();
 const stats = { calls: 0, queries: 0, mappingFailures: 0, controlFailures: 0, examples: [] };
 for (const [dll, names] of [['WINMM.DLL', ['mmioStringToFOURCCA']],
  ['KERNEL32.DLL', ['VirtualAlloc', 'VirtualFree']]]) {
  dv.setUint32(regs + 16, stack, true); const mod = e.fc_module(str(dll)) >>> 0; assert.ok(mod);
  assert.equal(e.guest_read32(mod) & 0xffff, 0x5a4d, dll + ' PE module');
  for (const name of names) {
   dv.setUint32(regs + 16, stack, true);
   const entry = e.fc_resolve(mod, str(name)) >>> 0, row = apiTable.find(r => r.name === name);
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
  const thread = e.fc_thread(); e.clear_yield(); e.set_eip(row.entry);
  for (let i = 0; i < 16 && e.get_eip(); i++) e.run(32);
  stats.calls++;
  assert.equal(e.get_eip() >>> 0, 0, name + ' x86 return');
  assert.equal(e.get_esp() >>> 0, stack + 4 + args.length * 4, name + ' ESP (FourCC +12)');
  assert.equal(e.fc_thread(), thread, name + ' thread');
  for (const i of [1, 2, 3, 5, 6, 7]) assert.equal(dv.getUint32(regs + i * 4, true), seed[i], name + ' register ' + i);
  assert.deepEqual(mem.subarray(wa(stackBase), wa(stackBase) + 256), new Uint8Array(frame), name + ' stack guards');
  return e.get_eax() >>> 0;
 }
 const commit = (p, n) => assert.equal(call('VirtualAlloc', [p, n, 0x3000, 4]), p);
 const separate = 0x30000000, adjacent = 0x31000000, alias = 0x32000000, reuse = 0x33000000;
 const decoys = [0x28000000, 0x28010000];
 for (let i = 0; i < 2; i++) { commit(separate + i * 4096, 4096); commit(decoys[i], 4096); }
 commit(adjacent, 8192); commit(reuse, 4096);
 for (let i = 0; i < 2; i++) assert.equal(wa(decoys[i]), wa(separate + i * 4096) + 4096);
 assert.notEqual(wa(separate + 4096), wa(separate) + 4096, 'nonadjacent physical backing');
 assert.equal(wa(adjacent + 4096), wa(adjacent) + 4096);
 const direct = alloc(8192);
 const spans = [[wa(direct), 8192], [wa(separate), 4096], [wa(separate + 4096), 4096],
  ...decoys.map(p => [wa(p), 4096]), [wa(adjacent), 8192], [wa(reuse), 4096], [0xf0, 64]];
 const views = spans.map(([p, n]) => Buffer.from(memory.buffer, p, n));
 const saved = views.map(b => Buffer.alloc(b.length));
 const pristine = views.map(b => Buffer.alloc(b.length, 0x71));
 function publish(g, p) { assert.equal(e.fc_alias(g, wa(p)), 1); assert.equal(wa(g), wa(p)); }
 publish(alias, separate); publish(alias + 4096, separate);
 assert.equal(wa(alias), wa(alias + 4096), 'physical aliases');
 // Independent literal byte-pack oracle: input hex, expected bytes without
 // MMIO_TOUPPER, expected bytes with it. No guest reads or handler algorithm.
 const cases = [
  ['61627a64', '61627a64', '41425a44'], ['80fffe81', '80fffe81', '80fffe81'],
  ['00616263', '20202020', '20202020'], ['61006263', '61202020', '41202020'],
  ['61620063', '61622020', '41422020'], ['61627a00', '61627a20', '41425a20'],
  ['2020007a', '20202020', '20202020'], ['61202000', '61202020', '41202020'],
  ['40605b7b', '40605b7b', '40605b7b'], ['417a5a61', '417a5a61', '415a5a41'],
  ['7f80ff7e', '7f80ff7e', '7f80ff7e'], ['5f607a7b', '5f607a7b', '5f605a7b'],
 ];
 function query(p, c, flags, label, mapped = false) {
  views.forEach((b, i) => pristine[i].copy(b));
  // Wrong physical continuation remains plausible non-NUL ASCII, unlike the
  // logical continuation. The entire backing and decoys must stay read-only.
  if (p) Buffer.from(c[0], 'hex').forEach((v, i) => e.guest_write8(p + i, v));
  views.forEach((b, i) => b.copy(saved[i]));
  const expected = Buffer.from(c[(flags & 0x10) ? 2 : 1], 'hex').readUInt32LE();
  const actual = call('mmioStringToFOURCCA', [p, flags]); stats.queries++;
  if (actual !== expected) {
   stats[mapped ? 'mappingFailures' : 'controlFailures']++;
   if (stats.examples.length < 8) stats.examples.push({ label, p, flags, actual, expected });
  }
  for (let i = 0; i < views.length; i++) assert.ok(views[i].equals(saved[i]), label + ' read-only backing ' + i);
  assert.equal(e.guest_span_cursor_bytes(), 0); assert.equal(e.guest_span_overflow_count(), 0);
 }
 function sweep(base, mapped, label) {
  // Every starting phase, including 1/2/3-byte page cuts, with NUL at each
  // position and exactly four nonterminated bytes. The fifth byte is poison.
  for (let phase = 0; phase < 4096; phase++) for (const j of [0, 2, 3, 4, 5])
   for (const flags of [0, 0x10]) query(base + phase, cases[j], flags, label + '/' + phase, mapped);
 }
 for (const [base, mapped, label] of [[direct, false, 'direct'], [adjacent, false, 'adjacent'],
  [separate, true, 'separate'], [alias, true, 'alias']]) sweep(base, mapped, label);
 const flags = [0, 0x10, 0xffffffef, 0xffffffff, ...Array.from({ length: 32 }, (_, i) => (2 ** i) >>> 0)];
 for (const [a, b] of [[reuse, separate], [separate + 4096, reuse], [separate, reuse]]) {
  publish(alias, a); publish(alias + 4096, b);
  for (const phase of [0, 1, 4092, 4093, 4094, 4095]) for (const c of cases)
   for (const f of flags) query(alias + phase, c, f, 'remap/' + phase, true);
 }
 const old = wa(reuse);
 assert.equal(call('VirtualFree', [reuse, 4096, 0x4000]), 1, 'public decommit');
 assert.equal(call('VirtualAlloc', [reuse, 4096, 0x1000, 4]), reuse, 'public recommit');
 assert.equal(wa(reuse), old, 'decommit/recommit backing reuse');
 assert.equal(call('VirtualFree', [reuse, 0, 0x8000]), 1, 'public release'); commit(reuse, 4096);
 assert.equal(wa(reuse), old, 'release/reallocate backing reuse');
 publish(alias, reuse); publish(alias + 4096, separate + 4096);
 for (const p of [direct, separate + 4093, alias + 4095]) for (const c of cases)
  for (const f of flags) query(p, c, f, 'cases/flags/reuse', p !== direct);
 for (const f of flags) query(0, cases[2], f, 'NULL four spaces');
 // Strict unmapped diagnostics make an extra translated read observable.
 // NUL at each position immediately before an unmapped page, or four bytes
 // ending there, must finish without even translating the following byte.
 const terminal = 0x35000000; commit(terminal, 4096);
 assert.equal(wa(terminal + 4096), 0xf0, 'unmapped next page');
 e.set_fault_unmapped(2);
 for (let pos = 0; pos < 4; pos++) {
  const c = cases[pos + 2], bytes = Buffer.from(c[0], 'hex');
  const p = terminal + 4095 - pos;
  for (let i = 0; i <= pos; i++) e.guest_write8(p + i, bytes[i]);
  for (const f of [0, 0x10]) assert.equal(call('mmioStringToFOURCCA', [p, f]), Buffer.from(c[f ? 2 : 1], 'hex').readUInt32LE());
 }
 for (let i = 0; i < 4; i++) e.guest_write8(terminal + 4092 + i, [0x80, 0xff, 0xfe, 0x81][i]);
 assert.equal(call('mmioStringToFOURCCA', [terminal + 4092, 0xffffffff]), 0x81feff80);
 assert.equal(call('mmioStringToFOURCCA', [0, 0xffffffff]), 0x20202020);
 e.set_fault_unmapped(0);
 assert.equal(call('VirtualFree', [terminal, 0, 0x8000]), 1);
 console.log(JSON.stringify(stats));
 assert.equal(stats.controlFailures, 0, 'unchanged byte/case/flags/NULL/ABI controls');
 if (expectParent) assert.ok(stats.mappingFailures > 0, 'fresh parent must fail public mapping oracle');
 else assert.equal(stats.mappingFailures, 0, 'mapped bytes');
 return stats;
}
if (require.main === module) run({ expectParent: process.argv.includes('--expect-parent') })
 .catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { run };
