#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { bootRenderHarness } = require(path.join(process.cwd(), 'test/render-helper'));
const apiTable = require(path.join(process.cwd(), 'src/api_table.json'));

// The public WAVEHDR contract identifies dwFlags as a DWORD at +16 in the
// 32-bit guest layout. Preserve this emulator's existing permissive handle,
// cbWaveHdr and unprepare policy; these tests do not redefine that policy.
// https://learn.microsoft.com/en-us/windows/win32/api/mmeapi/ns-mmeapi-wavehdr
// https://learn.microsoft.com/en-us/windows/win32/api/mmeapi/nf-mmeapi-waveoutprepareheader
// https://learn.microsoft.com/en-us/windows/win32/api/mmeapi/nf-mmeapi-waveoutunprepareheader
const extraWat = String.raw`
 (func (export "wh_init")
  (global.set $thunk_guest_base (i32.add (global.get $image_base)
   (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
  (call $update_thunk_end))
 (func (export "wh_regs") (result i32) (global.get $reg_base))
 (func (export "wh_alias") (param i32 i32) (result i32)
  (call $guest_page_publish_range (local.get 0) (i32.const 4096)
   (local.get 1) (i32.const 4)))
 (func (export "wh_module") (param i32) (result i32)
  (call $handle_GetModuleHandleA (local.get 0) (i32.const 0) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "wh_resolve") (param i32 i32) (result i32)
  (call $handle_GetProcAddress (local.get 0) (local.get 1) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "wh_call") (param i32)
  (global.set $eip (i32.const 0x456789ab))
  (call $win32_dispatch (i32.shr_u
   (i32.sub (local.get 0) (global.get $thunk_guest_base)) (i32.const 3))))
`;
// Literal independent oracles: input, prepare output, unprepare output.
// Include DONE/PREPARED/loop/INQUEUE combinations and opaque high bits.
const vectors = [
 [0, 2, 1], [1, 3, 1], [2, 2, 1], [3, 3, 1],
 [0x0c, 0x0e, 0x0d], [0x10, 0x12, 1], [0x1f, 0x1f, 0x0d],
 [0x12345678, 0x1234567a, 0x12345669],
 [0x89abcdef, 0x89abcdef, 0x89abcded],
 [0xffffffff, 0xffffffff, 0xffffffed],
 [0x80000000, 0x80000002, 0x80000001],
 [0x76543210, 0x76543212, 0x76543201],
];
async function run({ expectParent = false } = {}) {
 const h = await bootRenderHarness({ extraWat, fonts: 'none', width: 8, height: 8 });
 const { exports: e, memory } = h;
 e.init_thread(1, 0x400000, 0, 0, 0, 0, 0); e.heap_init(0x800000); e.wh_init(); e.set_api_log(0);
 const mem = new Uint8Array(memory.buffer), dv = new DataView(memory.buffer);
 const regs = e.wh_regs() >>> 0, wa = p => e.guest_to_wasm(p) >>> 0;
 const alloc = n => { const p = e.guest_alloc(n) >>> 0; assert.ok(p); return p; };
 const put = (p, b) => { for (let i = 0; i < b.length; i++) mem[wa(p + i)] = b[i]; };
 const read = (p, n) => Buffer.from(Array.from({ length: n }, (_, i) => mem[wa(p + i)]));
 const str = s => { const b = Buffer.from(s + '\0'), p = alloc(b.length); put(p, b); return p; };
 const stack = alloc(256) + 64, entries = new Map();
 const stats = { calls: 0, queries: 0, comparisons: 0, controlFailures: 0,
  prepareFailures: 0, unprepareFailures: 0, examples: [] };
 for (const [dll, names] of [
  ['WINMM.DLL', ['waveOutPrepareHeader', 'waveOutUnprepareHeader']],
  ['KERNEL32.DLL', ['VirtualAlloc', 'VirtualFree']],
 ]) {
  dv.setUint32(regs + 16, stack, true); const mod = e.wh_module(str(dll)) >>> 0; assert.ok(mod);
  for (const name of names) {
   dv.setUint32(regs + 16, stack, true);
   const stub = e.wh_resolve(mod, str(name)) >>> 0, row = apiTable.find(r => r.name === name);
   assert.ok(stub); assert.equal(row.convention, 'stdcall');
   // KERNEL32 exposes real PE jump stubs; WINMM resolves directly to thunks.
   const thunk = dll === 'KERNEL32.DLL' ? (stub + 5 + (e.guest_read32(stub + 1) | 0)) >>> 0 : stub;
   if (dll === 'KERNEL32.DLL') assert.equal(e.guest_read8(stub), 0xe9);
   assert.equal(e.guest_read32(thunk + 4), row.id);
   entries.set(name, { thunk, nargs: row.nargs });
  }
 }
 function call(name, args) {
  const row = entries.get(name); assert.equal(args.length, row.nargs);
  e.guest_write32(stack, 0x12345678); args.forEach((v, i) => e.guest_write32(stack + 4 + i * 4, v));
  const frame = read(stack, 4 + args.length * 4);
  const seed = [0x81234567, 0x12345678, 0x23456789, 0x3456789a, stack, 0x456789ab, 0x56789abc, 0x6789abcd];
  seed.forEach((v, i) => dv.setUint32(regs + i * 4, v, true));
  e.wh_call(row.thunk); stats.calls++;
  assert.equal(e.get_esp() >>> 0, stack + frame.length, name + ' ESP');
  assert.equal(e.get_eip() >>> 0, 0x456789ab, name + ' EIP');
  for (const i of [1, 2, 3, 5, 6, 7]) assert.equal(dv.getUint32(regs + i * 4, true), seed[i], name + ' register ' + i);
  assert.deepEqual(read(stack, frame.length), frame, name + ' stdcall frame');
  return e.get_eax() >>> 0;
 }
 const commit = (p, n) => assert.equal(call('VirtualAlloc', [p, n, 0x3000, 4]), p);
 const fragmented = 0x30000000, adjacent = 0x31000000, alias = 0x32000000;
 const decoys = [0x28000000, 0x29000000], replacement = 0x33000000;
 for (const p of [fragmented, decoys[0], fragmented + 4096, decoys[1], replacement]) commit(p, 4096);
 commit(adjacent, 8192);
 assert.equal(wa(decoys[0]), wa(fragmented) + 4096);
 assert.equal(wa(decoys[1]), wa(fragmented + 4096) + 4096);
 assert.notEqual(wa(fragmented + 4096), wa(fragmented) + 4096);
 assert.equal(wa(adjacent + 4096), wa(adjacent) + 4096);
 const direct = alloc(8192);
 const spans = [[wa(direct), 8192], [wa(fragmented), 4096], [wa(fragmented + 4096), 4096],
  ...decoys.map(p => [wa(p), 4096]), [wa(adjacent), 8192], [wa(replacement), 4096]];
 const views = spans.map(([p, n]) => Buffer.from(memory.buffer, p, n));
 const saved = views.map(b => Buffer.alloc(b.length));
 function compare(a, b, label, bucket) {
  stats.comparisons++;
  if (Buffer.isBuffer(a) ? a.equals(b) : a === b) return;
  stats[bucket]++;
  if (stats.examples.length < 12) stats.examples.push({ label, actual: Buffer.isBuffer(a) ? a.toString('hex').slice(0, 96) : a,
   expected: Buffer.isBuffer(b) ? b.toString('hex').slice(0, 96) : b });
 }
 function query(name, p, v, label, mapped = false, handle = 0x123456, size = 32) {
  const bucket = mapped ? (name === 'waveOutPrepareHeader' ? 'prepareFailures' : 'unprepareFailures') : 'controlFailures';
  spans.forEach(([a, n], i) => mem.fill(0x90 + i, a, a + n));
  // Distinct fields and guards around the entire WAVEHDR. Initialize via
  // individually translated bytes, independently of gl32/gs32 under test.
  const header = Buffer.from('0123456789abcdef1032547698badcfe00000000123456789abcdef0123456789ab', 'hex');
  header.writeUInt32LE(v[0], 16); put(p, header);
  views.forEach((b, i) => b.copy(saved[i]));
  const expected = Buffer.alloc(4); expected.writeUInt32LE(v[name === 'waveOutPrepareHeader' ? 1 : 2]);
  for (let i = 0; i < 4; i++) {
   const a = wa(p + 16 + i), j = spans.findIndex(([b, n]) => a >= b && a < b + n);
   assert.ok(j >= 0); saved[j][a - spans[j][0]] = expected[i];
  }
  compare(call(name, [handle, p, size]), 0, label + ' return', 'controlFailures'); stats.queries++;
  compare(read(p + 16, 4), expected, label + ' logical flags', bucket);
  for (let i = 0; i < views.length; i++) compare(views[i], saved[i], label + ' physical span ' + i, bucket);
  assert.equal(e.guest_span_cursor_bytes(), 0); assert.equal(e.guest_span_overflow_count(), 0);
 }
 const names = ['waveOutPrepareHeader', 'waveOutUnprepareHeader'];
 // Genuine alias: two guest pages backed by the SAME physical page.
 assert.equal(e.wh_alias(alias, wa(fragmented)), 1);
 assert.equal(e.wh_alias(alias + 4096, wa(fragmented)), 1);
 assert.equal(wa(alias), wa(alias + 4096));
 for (const name of names) for (const v of vectors) query(name, direct + 64, v, 'direct ' + name);
 // All 4096 phases, including a wholly relocated flags field and each of
 // its three internal byte cuts. Adjacent physical pages are the control.
 for (const base of [adjacent, fragmented, alias]) for (let phase = 0; phase < 4096; phase++)
  for (const name of names) for (const v of vectors)
   query(name, base + phase, v, [name, base, phase, v[0]].join('/'), base !== adjacent);
 // Explicit cuts before/after and within dwFlags, with every policy input.
 for (let cut = 0; cut <= 4; cut++) for (const base of [adjacent, fragmented, alias])
  for (const name of names) for (const v of vectors)
   for (const handle of [0, 0x123456, 0xffffffff]) for (const size of [0, 1, 31, 32, 33, 0xffffffff])
    query(name, base + 4096 - 16 - cut, v, 'flags cut ' + [name, base, cut, handle, size], base !== adjacent, handle, size);
 // Remap the SAME guest pages to different backing. Former backing is in
 // the guarded spans; neither a cached address nor physical fall-through
 // may modify it. Exercise nonadjacent and repeated-page aliases in turn.
 for (const target of [replacement, fragmented + 4096, fragmented]) {
  assert.equal(e.wh_alias(alias, wa(target)), 1);
  assert.equal(e.wh_alias(alias + 4096, wa(replacement)), 1);
  assert.equal(wa(alias), wa(target)); assert.equal(wa(alias + 4096), wa(replacement));
  for (let phase = 0; phase < 4096; phase++) for (const name of names)
   query(name, alias + phase, vectors[7 + phase % 5], 'remap ' + [target, phase, name], true);
 }
 // Public allocator release/recommit control, no private map-table edits.
 assert.equal(call('VirtualFree', [replacement, 0, 0x8000]), 1);
 commit(replacement, 4096);
 assert.equal(wa(replacement), spans[6][0]);
 for (const name of names) for (const v of vectors) query(name, replacement + 64, v, 'public recommit');
 console.log(JSON.stringify(stats));
 assert.equal(stats.controlFailures, 0, 'contiguous and ABI/policy controls');
 if (expectParent) {
  assert.ok(stats.prepareFailures > 0, 'fresh parent prepare transport must fail');
  assert.ok(stats.unprepareFailures > 0, 'fresh parent unprepare transport must fail');
 } else {
  assert.equal(stats.prepareFailures, 0, 'prepare mapping');
  assert.equal(stats.unprepareFailures, 0, 'unprepare mapping');
 }
 return stats;
}
if (require.main === module) run({ expectParent: process.argv.includes('--expect-parent') }).catch(e => { console.error(e); process.exitCode = 1; });
module.exports = { run, extraWat };
