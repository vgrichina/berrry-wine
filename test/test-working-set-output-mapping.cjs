#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');
const { makeFixture } = require('../tools/kernel32-native-fixture');
const rows = require('../src/api_table.json');

// Public Win32 output roles (32-bit SIZE_T), not a sizing-policy change:
// https://learn.microsoft.com/en-us/windows/win32/api/memoryapi/nf-memoryapi-getprocessworkingsetsize
// Preserve the historical nullable outputs, ignored handle and literal values.
const extraWat = String.raw`
 (func (export "ws_regs") (result i32) (global.get $reg_base))
 (func (export "ws_alias") (param i32 i32) (result i32)
  (call $guest_page_publish_range (local.get 0) (i32.const 4096) (local.get 1) (i32.const 4)))
 (func (export "ws_error") (global.set $last_error (i32.const 0x1234abcd)))
 (func (export "ws_flags")
  (global.set $flag_op (i32.const 0))
  (global.set $flag_a (i32.const 0x12345678))
  (global.set $flag_b (i32.const 0x23456789))
  (global.set $flag_res (i32.const 0x3456789a))
  (global.set $flag_sign_shift (i32.const 31))
  (global.set $saved_cf (i32.const 1)))
 (func (export "ws_module") (param i32) (result i32)
  (call $handle_GetModuleHandleA (local.get 0) (i32.const 0) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "ws_resolve") (param i32 i32) (result i32)
  (call $handle_GetProcAddress (local.get 0) (local.get 1) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
` + ['flag_op', 'flag_a', 'flag_b', 'flag_res', 'flag_sign_shift', 'saved_cf', 'current_thread_id'].map(n =>
 `(func (export "ws_${n}") (result i32) (global.get $${n}))`).join('\n');

async function run({ expectParent = false } = {}) {
 const { exports: e, memory } = await bootRenderHarness({ extraWat, fonts: 'none', width: 8, height: 8 });
 const fixture = makeFixture();
 new Uint8Array(memory.buffer).set(fixture, e.get_staging());
 assert.ok(e.load_pe(fixture.length), 'fresh parent/candidate actual PE load');
 e.set_api_log(0);
 const mem = new Uint8Array(memory.buffer), dv = new DataView(memory.buffer), regs = e.ws_regs() >>> 0;
 const wa = p => e.guest_to_wasm(p) >>> 0;
 const alloc = n => { const p = e.guest_alloc(n) >>> 0; assert.ok(p); return p; };
 const str = s => { const b = Buffer.from(s + '\0'), p = alloc(b.length); b.forEach((v, i) => e.guest_write8(p + i, v)); return p; };
 const read = (p, n) => Buffer.from(Array.from({ length: n }, (_, i) => mem[wa(p + i)]));
 const frame = alloc(256), stack = frame + 64, other = alloc(128), direct = alloc(16384);
 dv.setUint32(regs + 16, stack, true);
 const kernel = e.ws_module(str('KERNEL32.DLL')) >>> 0;
 assert.ok(kernel); assert.equal(e.guest_read32(kernel) & 0xffff, 0x5a4d, 'public module is a PE image');
 const entries = new Map();
 for (const name of ['GetProcessWorkingSetSize', 'VirtualAlloc', 'VirtualFree']) {
  dv.setUint32(regs + 16, stack, true);
  const entry = e.ws_resolve(kernel, str(name)) >>> 0, row = rows.find(r => r.name === name);
  assert.ok(entry); assert.equal(e.guest_read8(entry), 0xe9, 'public PE JMP ' + name);
  const thunk = (entry + 5 + (e.guest_read32(entry + 1) | 0)) >>> 0;
  assert.equal(e.guest_read32(thunk + 4), row.id, 'resolved thunk identity ' + name);
  assert.equal(row.convention, 'stdcall');
  entries.set(name, { entry, nargs: row.nargs });
 }
 assert.equal(entries.get('GetProcessWorkingSetSize').nargs, 3);
 const stats = { calls: 0, queries: 0, comparisons: 0, mappingFailures: 0, controlFailures: 0,
  fieldFailures: { min: 0, max: 0 }, examples: [] };
 function compare(a, b, label, mapped = false) {
  stats.comparisons++;
  if (Buffer.isBuffer(a) ? a.equals(b) : a === b) return;
  stats[mapped ? 'mappingFailures' : 'controlFailures']++;
  if (stats.examples.length < 12) stats.examples.push({ label,
   actual: Buffer.isBuffer(a) ? a.toString('hex').slice(0, 80) : a,
   expected: Buffer.isBuffer(b) ? b.toString('hex').slice(0, 80) : b });
 }
 function call(name, args) {
  const row = entries.get(name); assert.equal(args.length, row.nargs);
  mem.fill(0x5a, wa(frame), wa(frame) + 256);
  e.guest_write32(stack, 0); args.forEach((v, i) => e.guest_write32(stack + 4 + i * 4, v));
  const before = read(frame, 256), independent = read(other, 128);
  const seed = [0xa0123456, 0x11223344, 0x22334455, 0x33445566, stack, 0x44556677, 0x55667788, 0x66778899];
  seed.forEach((v, i) => dv.setUint32(regs + i * 4, v, true));
  e.ws_error(); e.ws_flags();
  const globals = ['flag_op', 'flag_a', 'flag_b', 'flag_res', 'flag_sign_shift', 'saved_cf', 'current_thread_id'];
  const state = globals.map(n => e['ws_' + n]());
  // Execute the real resolver-returned PE JMP and thunk through the x86 engine.
  e.clear_yield(); e.set_eip(row.entry);
  for (let i = 0; i < 16 && e.get_eip(); i++) e.run(32);
  stats.calls++;
  compare(e.get_eip(), 0, name + ' returned');
  compare(e.get_esp() >>> 0, stack + 4 + args.length * 4, name + ' stdcall ESP');
  for (const i of [1, 2, 3, 5, 6, 7]) compare(dv.getUint32(regs + i * 4, true), seed[i], name + ' register ' + i);
  compare(read(frame, 256), before, name + ' full stack');
  compare(read(other, 128), independent, name + ' independent allocation');
  if (name === 'GetProcessWorkingSetSize') {
   globals.forEach((n, i) => compare(e['ws_' + n](), state[i], name + ' ' + n));
   compare(e.test_get_last_error() >>> 0, 0x1234abcd, name + ' LastError');
  }
  compare(e.guest_span_cursor_bytes(), 0, name + ' no span leak');
  compare(e.guest_span_overflow_count(), 0, name + ' no span overflow');
  return e.get_eax() >>> 0;
 }
 const commit = (p, n) => assert.equal(call('VirtualAlloc', [p, n, 0x3000, 4]), p);
 const fragmented = 0x30000000, adjacent = 0x31000000, alias = 0x32000000, reuse = 0x33000000;
 const decoys = [0x28000000, 0x28010000, 0x28020000, 0x28030000];
 for (let i = 0; i < 4; i++) { commit(fragmented + i * 4096, 4096); commit(decoys[i], 4096); }
 commit(adjacent, 16384);
 const first = wa(fragmented), second = wa(fragmented + 4096), linear = wa(direct), contiguous = wa(adjacent);
 for (let i = 0; i < 4; i++) {
  assert.equal(wa(decoys[i]), wa(fragmented + i * 4096) + 4096);
  if (i) assert.notEqual(wa(fragmented + i * 4096), first + i * 4096);
  assert.equal(wa(adjacent + i * 4096), contiguous + i * 4096);
 }
 const spans = [[linear, 16384], ...Array.from({ length: 4 }, (_, i) => [wa(fragmented + i * 4096), 4096]),
  ...decoys.map(p => [wa(p), 4096]), [contiguous, 16384]];
 const views = spans.map(([p, n]) => Buffer.from(memory.buffer, p, n));
 const expected = views.map(b => Buffer.alloc(b.length));
 // Oracle translations are explicit physical frames proven above, independent
 // of guest reads/stores. Full guards include every old/new frame and decoy.
 const pages = new Map();
 for (let i = 0; i < 4; i++) {
  pages.set(fragmented + i * 4096, wa(fragmented + i * 4096));
  pages.set(adjacent + i * 4096, contiguous + i * 4096);
 }
 function publish(g, w) { assert.equal(e.ws_alias(g, w), 1); pages.set(g, w); assert.equal(wa(g), w); }
 publish(alias, first); publish(alias + 4096, first);
 publish(alias + 8192, second); publish(alias + 12288, second);
 assert.equal(wa(alias), wa(alias + 4096), 'actual physical alias');
 function physical(p) {
  if (p >= direct && p < direct + 16384) return linear + p - direct;
  const page = p - p % 4096; assert.ok(pages.has(page)); return pages.get(page) + p % 4096;
 }
 function patch(p, bytes) {
  if (!p) return;
  bytes.forEach((v, j) => { const at = physical(p + j), i = spans.findIndex(([b, n]) => at >= b && at < b + n);
   assert.ok(i >= 0); expected[i][at - spans[i][0]] = v; });
 }
 function query(min, max, label, mapped = false, handle = 0xffffffff, poison = [0x39, 0xda, 0x4a, 0xeb]) {
  spans.forEach(([p, n], i) => mem.fill(i >= 5 && i < 9 ? poison[i - 5] : 0x91 + i, p, p + n));
  views.forEach((b, i) => b.copy(expected[i]));
  // Order matters for equal, byte-overlapping and physically aliased outputs.
  patch(min, [0, 0, 0x10, 0]); patch(max, [0, 0, 0, 0x10]);
  compare(call('GetProcessWorkingSetSize', [handle, min, max]), 1, label + ' TRUE'); stats.queries++;
  for (let i = 0; i < views.length; i++) compare(views[i], expected[i], label + ' full backing ' + i, mapped);
  for (const [field, p] of [['min', min], ['max', max]]) if (p) {
   const got = [], want = [];
   for (let j = 0; j < 4; j++) { const at = physical(p + j), i = spans.findIndex(([b, n]) => at >= b && at < b + n);
    got.push(mem[at]); want.push(expected[i][at - spans[i][0]]); }
   if (!Buffer.from(got).equals(Buffer.from(want))) stats.fieldFailures[field]++;
   compare(Buffer.from(got), Buffer.from(want), label + ' ordered ' + field, mapped);
  }
 }
 for (const base of [direct, adjacent, fragmented, alias]) for (let phase = 0; phase < 4096; phase++) {
  const p = base + phase, mapped = base === fragmented || base === alias;
  query(p, direct + 6000, 'independent min/' + [base, phase], mapped);
  query(direct + 6000, p, 'independent max/' + [base, phase], mapped);
  query(p, base + 8192 + phase, 'both independent splits/' + [base, phase], mapped);
  query(p, base + ((phase + 2051) % 4096), 'independent phases/' + [base, phase], mapped);
  for (const delta of [-3, -2, -1, 0, 1, 2, 3]) if (phase + delta >= 0)
   query(p, p + delta, 'ordered overlap/' + [base, phase, delta], mapped);
 }
 // Distinct guest destinations with identical physical bytes, also when
 // only one logical range crosses into its differently mapped next page.
 for (let phase = 0; phase < 4096; phase++)
  for (const delta of [-3, -2, -1, 0, 1, 2, 3]) if (phase + delta >= 0)
   query(alias + phase, alias + 4096 + phase + delta, 'physical overlap/' + [phase, delta], true);
 // All nine independent internal-DWORD cut pairs, varying decoys separately.
 const poisons = [];
 for (let i = 0; i < 4; i++) for (const value of [0, 255]) {
  const poison = [0x39, 0xda, 0x4a, 0xeb]; poison[i] = value; poisons.push(poison);
 }
 for (const base of [adjacent, fragmented, alias]) for (let a = 1; a <= 3; a++) for (let b = 1; b <= 3; b++)
  for (const poison of poisons)
   {
    query(base + 4096 - a, base + 4096 - b, 'overlapping cuts/' + [base, a, b, poison], base !== adjacent, 0, poison);
    query(base + 4096 - a, base + 12288 - b, 'independent cuts/' + [base, a, b, poison], base !== adjacent, 0, poison);
   }
 for (let generation = 0; generation < 4; generation++) {
  publish(reuse, generation & 1 ? second : first); publish(reuse + 4096, generation & 1 ? first : second);
  for (let phase = 0; phase < 4096; phase++) {
   query(reuse + phase, direct + 6000, 'remap min/' + [generation, phase], true);
   query(direct + 6000, reuse + phase, 'remap max/' + [generation, phase], true);
  }
 }
 for (const base of [direct, adjacent, fragmented, alias]) for (let cut = 1; cut <= 3; cut++) {
  query(base + 4096 - cut, 0, 'null max/' + [base, cut], base === fragmented || base === alias);
  query(0, base + 4096 - cut, 'null min/' + [base, cut], base === fragmented || base === alias);
 }
 for (const handle of [0, 1, 0x12345678, 0x80000000, 0xffffffff])
  for (const min of [0, direct + 64, fragmented + 4093]) for (const max of [0, direct + 80, fragmented + 4094])
   query(min, max, 'nullable ignored handle/' + [handle, min, max], min >= fragmented || max >= fragmented, handle);
 // Public allocator controls: reserve/commit, decommit/recommit and release
 // actually reuse the same physical frame; old frames remain guarded above.
 const managed = 0x34000000;
 assert.equal(call('VirtualAlloc', [managed, 65536, 0x2000, 4]), managed);
 assert.equal(call('VirtualAlloc', [managed, 8192, 0x1000, 4]), managed);
 const managedFrame = wa(managed);
 const addManaged = () => {
  for (let i = 0; i < 2; i++) {
   const p = managed + i * 4096, w = wa(p);
   if (!spans.some(([b, n]) => w >= b && w + 4096 <= b + n)) {
    spans.push([w, 4096]); views.push(Buffer.from(memory.buffer, w, 4096)); expected.push(Buffer.alloc(4096));
   }
   pages.set(p, w);
  }
 };
 addManaged();
 for (let cut = 1; cut <= 3; cut++) query(managed + 4096 - cut, fragmented + 4093, 'allocator initial/' + cut, true);
 assert.equal(call('VirtualFree', [managed, 8192, 0x4000]), 1);
 assert.equal(call('VirtualAlloc', [managed, 8192, 0x1000, 4]), managed);
 assert.equal(wa(managed), managedFrame, 'decommit physical reuse');
 addManaged();
 for (let cut = 1; cut <= 3; cut++) query(fragmented + 4093, managed + 4096 - cut, 'allocator recommit/' + cut, true);
 assert.equal(call('VirtualFree', [managed, 0, 0x8000]), 1);
 assert.equal(call('VirtualAlloc', [managed, 8192, 0x3000, 4]), managed);
 assert.equal(wa(managed), managedFrame, 'release physical reuse');
 addManaged();
 for (let cut = 1; cut <= 3; cut++) query(managed + 4096 - cut, managed + 4096 - cut + 1, 'allocator release/reuse/' + cut, true);
 assert.equal(call('VirtualFree', [managed, 0, 0x8000]), 1);
 console.log(JSON.stringify(stats));
 assert.equal(stats.controlFailures, 0, 'unchanged policy/ABI/contiguous controls');
 if (expectParent) for (const n of ['min', 'max']) assert.ok(stats.fieldFailures[n] > 0, 'fresh parent independently fails ' + n);
 else assert.equal(stats.mappingFailures, 0, 'guest output mapping');
 return stats;
}
module.exports = { run };
if (require.main === module) run().then(() => console.log('PASS GetProcessWorkingSetSize output mapping'))
 .catch(e => { console.error(e); process.exitCode = 1; });
