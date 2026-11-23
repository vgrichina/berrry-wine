#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');
const apiTable = require('../src/api_table.json');
const { makeFixture } = require('../tools/kernel32-native-fixture');
// Public struct layout and selector meanings:
// https://learn.microsoft.com/en-us/windows/win32/api/msacm/ns-msacm-acmformattagdetails
// https://learn.microsoft.com/en-us/windows/win32/api/msacm/nf-msacm-acmformattagdetailsa
// Existing emulator policy is deliberately retained: three tags, low nibble
// selector, ignored handle/cbStruct, null 87, unavailable 512, no error writes.
// Literal independent byte oracle; no source parsing or Wine reference.
const extraWat = String.raw`
 (func (export "mc_regs") (result i32) (global.get $reg_base))
 (func (export "mc_thread") (result i32) (global.get $current_thread_id))
 (func (export "mc_alias") (param i32 i32) (result i32)
  (call $guest_page_publish_range (local.get 0) (i32.const 4096)
   (local.get 1) (i32.const 4)))
 (func (export "mc_module") (param i32) (result i32)
  (call $handle_GetModuleHandleA (local.get 0) (i32.const 0) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "mc_resolve") (param i32 i32) (result i32)
  (call $handle_GetProcAddress (local.get 0) (local.get 1) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
`;

async function run({ expectParent = false } = {}) {
 let boundaryCalls = 0;
 const h = await bootRenderHarness({ extraWat, fonts: 'none', width: 8, height: 8,
  beforeInstantiate(ctx, host) {
   for (const [name, fn] of Object.entries(host)) if (typeof fn === 'function')
    host[name] = (...args) => { boundaryCalls++; return fn(...args); };
  } });
 const { exports: e, memory } = h;
 const fixture = makeFixture();
 new Uint8Array(memory.buffer).set(fixture, e.get_staging());
 assert.ok(e.load_pe(fixture.length), 'fresh actual PE load'); e.set_api_log(0);
 const mem = new Uint8Array(memory.buffer), dv = new DataView(memory.buffer);
 const regs = e.mc_regs() >>> 0, wa = p => e.guest_to_wasm(p) >>> 0;
 const alloc = n => { const p = e.guest_alloc(n) >>> 0; assert.ok(p); return p; };
 const read = (p, n) => Buffer.from(Array.from({ length: n }, (_, i) => mem[wa(p + i)]));
 const str = s => { const b = Buffer.from(s + '\0'), p = alloc(b.length);
  for (let i = 0; i < b.length; i++) mem[wa(p + i)] = b[i]; return p; };
 const stackBase = alloc(256), stack = stackBase + 64, entries = new Map();
 const stats = { calls: 0, queries: 0, comparisons: 0, mappingFailures: 0, controlFailures: 0, examples: [] };
 for (const [dll, names] of [
  ['MSACM32.DLL', ['acmFormatTagDetailsA', 'acmFormatTagDetailsW']], ['KERNEL32.DLL', ['VirtualAlloc', 'VirtualFree']],
 ]) {
  dv.setUint32(regs + 16, stack, true); const mod = e.mc_module(str(dll)) >>> 0; assert.ok(mod);
  assert.equal(e.guest_read32(mod) & 0xffff, 0x5a4d, dll + ' public PE module');
  for (const name of names) {
   dv.setUint32(regs + 16, stack, true);
   const stub = e.mc_resolve(mod, str(name)) >>> 0, row = apiTable.find(r => r.name === name);
   assert.ok(stub); assert.equal(row.convention, 'stdcall');
   if (dll === 'KERNEL32.DLL') assert.equal(e.guest_read8(stub), 0xe9, 'public PE JMP');
   const thunk = dll === 'KERNEL32.DLL' ? (stub + 5 + (e.guest_read32(stub + 1) | 0)) >>> 0 : stub;
   assert.equal(e.guest_read32(thunk + 4), row.id);
   entries.set(name, { entry: stub, nargs: row.nargs });
  }
 }
 function call(name, args) {
  const row = entries.get(name); assert.equal(args.length, row.nargs);
  mem.fill(0x6d, wa(stackBase), wa(stackBase) + 256);
  e.guest_write32(stack, 0); args.forEach((v, i) => e.guest_write32(stack + 4 + i * 4, v));
  const frame = read(stackBase, 256);
  const seed = [0x81234567, 0x12345678, 0x23456789, 0x3456789a, stack, 0x456789ab, 0x56789abc, 0x6789abcd];
  seed.forEach((v, i) => dv.setUint32(regs + i * 4, v, true));
  const thread = e.mc_thread();
  e.clear_yield(); e.set_eip(row.entry);
  for (let i = 0; i < 16 && e.get_eip(); i++) e.run(32);
  stats.calls++;
  assert.equal(e.get_esp() >>> 0, stack + 4 + args.length * 4, name + ' ESP');
  assert.equal(e.get_eip() >>> 0, 0, name + ' returned through x86 engine');
  assert.equal(e.mc_thread(), thread, name + ' current thread');
  for (const i of [1, 2, 3, 5, 6, 7]) assert.equal(dv.getUint32(regs + i * 4, true), seed[i], name + ' register ' + i);
  assert.deepEqual(read(stackBase, 256), frame, name + ' full stack guards');
  return e.get_eax() >>> 0;
 }
 const commit = (p, n) => assert.equal(call('VirtualAlloc', [p, n, 0x3000, 4]), p);
 const fragmented = 0x30000000, adjacent = 0x31000000, alias = 0x32000000;
 const decoys = [0x28000000, 0x28010000], replacement = 0x33000000;
 for (let i = 0; i < 2; i++) { commit(fragmented + i * 4096, 4096); commit(decoys[i], 4096); }
 commit(adjacent, 8192); commit(replacement, 4096);
 for (let i = 0; i < 2; i++) assert.equal(wa(decoys[i]), wa(fragmented + i * 4096) + 4096);
 assert.notEqual(wa(fragmented + 4096), wa(fragmented) + 4096);
 assert.equal(wa(adjacent + 4096), wa(adjacent) + 4096);
 const direct = alloc(8192);
 const spans = [[wa(direct), 8192], [wa(fragmented), 4096], [wa(fragmented + 4096), 4096],
  ...decoys.map(p => [wa(p), 4096]), [wa(adjacent), 8192], [wa(replacement), 4096]];
 spans.push([0xf0, 128]); // NULL translation sentinel is also a no-write guard.
 const views = spans.map(([p, n]) => Buffer.from(memory.buffer, p, n));
 const saved = views.map(b => Buffer.alloc(b.length));
 const pristine = views.map((b, j) => Buffer.from(Array.from({ length: b.length },
  (_, i) => (i * 73 + (i >>> 8) * 29 + j * 41 + 0x53) & 255)));
 const physicalByte = new Map();
 spans.forEach(([p, n], j) => { for (let i = 0; i < n; i++) physicalByte.set(p + i, [j, i]); });
 function publish(g, p) { assert.equal(e.mc_alias(g, wa(p)), 1); assert.equal(wa(g), wa(p)); }
 publish(alias, fragmented); publish(alias + 4096, fragmented);
 assert.equal(wa(alias), wa(alias + 4096), 'actual shared physical page');
 function compare(a, b, label, bucket) {
  stats.comparisons++;
  if (Buffer.isBuffer(a) ? a.equals(b) : a === b) return;
  stats[bucket]++;
  if (stats.examples.length < 8) stats.examples.push({ label,
   actual: Buffer.isBuffer(a) ? a.toString('hex').slice(0, 240) : a,
   expected: Buffer.isBuffer(b) ? b.toString('hex').slice(0, 240) : b });
 }
 // Ordered little endian bytes, independently specified for each inventory
 // member. cStandardFormats for ADPCM is established by the preceding clear.
 const records = [
  { tag: 1, len: 3, fields: [[8, [1, 0, 0, 0]], [12, [16, 0, 0, 0]],
   [16, [4, 0, 0, 0]], [20, [16, 0, 0, 0]], [24, [80, 67, 77, 0]]] },
  { tag: 2, len: 15, fields: [[8, [2, 0, 0, 0]], [12, [50, 0, 0, 0]],
   [16, [1, 0, 0, 0]], [24, [77, 105, 99, 114]], [28, [111, 115, 111, 102]],
   [32, [116, 32, 65, 68]], [36, [80, 67, 77, 0]]] },
  { tag: 17, len: 9, fields: [[8, [17, 0, 0, 0]], [12, [20, 0, 0, 0]],
   [16, [1, 0, 0, 0]], [24, [73, 77, 65, 32]], [28, [65, 68, 80, 67]],
   [32, [77, 0, 0, 0]]] },
 ];
 function query(p, wide, flags, index, tag, cb, handle, label, mapped = false, poison = false) {
  const bucket = mapped ? 'mappingFailures' : 'controlFailures', extent = wide ? 120 : 72;
  views.forEach((b, i) => pristine[i].copy(b));
  // An independently backed physical fall-through can contain plausible but
  // different selectors. Seed it BEFORE the logical input fields.
  if (poison) {
   assert.notEqual(wa(p) + 4, wa(p + 4));
   dv.setUint32(wa(p) + 4, 0, true); dv.setUint32(wa(p) + 8, 1, true);
  }
  if (p) { e.guest_write32(p, cb); e.guest_write32(p + 4, index); e.guest_write32(p + 8, tag); }
  views.forEach((b, i) => b.copy(saved[i]));
  const addresses = p ? Array.from({ length: 128 }, (_, i) => wa(p + i)) : [];
  const loc = a => { const v = physicalByte.get(a); assert.ok(v, 'oracle address guarded'); return v; };
  const get = i => { const [j, k] = loc(addresses[i]); return saved[j][k]; };
  const put = (i, v) => { const [j, k] = loc(addresses[i]); saved[j][k] = v; };
  const selected = (flags & 15) === 0 ? index : (flags & 15) === 1 ? records.findIndex(r => r.tag === tag) : -1;
  const valid = p !== 0 && selected >= 0 && selected < 3;
  if (valid) {
   const r = records[selected];
   for (let i = 4; i < extent; i++) put(i, 0);
   [selected, 0, 0, 0].forEach((v, i) => put(4 + i, v));
   for (const [offset, bytes] of r.fields) bytes.forEach((v, i) => put(offset + i, v));
   if (wide) {
    put(24 + r.len * 2, 0); put(25 + r.len * 2, 0);
    for (let i = r.len - 1; i >= 0; i--) { const v = get(24 + i); put(24 + i * 2, v); put(25 + i * 2, 0); }
   }
  }
  const logical = p ? Buffer.from(addresses.map((_, i) => get(i))) : null;
  const hostBefore = boundaryCalls;
  compare(call(wide ? 'acmFormatTagDetailsW' : 'acmFormatTagDetailsA', [handle, p, flags]),
   p === 0 ? 87 : valid ? 0 : 512, label + ' return', bucket);
  assert.equal(boundaryCalls, hostBefore, label + ' host/callback boundary');
  stats.queries++;
  if (p) compare(read(p, 128), logical, label + ' logical struct and guards', bucket);
  for (let j = 0; j < views.length; j++) compare(views[j], saved[j], label + ' full backing ' + j, bucket);
  assert.equal(e.guest_span_cursor_bytes(), 0); assert.equal(e.guest_span_overflow_count(), 0);
 }
 function sweep(base, mapped, label) {
  // Every starting phase covers every byte of every input/output DWORD, all
  // clear/name cuts, A/W field ends, and fields wholly after the boundary.
  for (let phase = 0; phase < 4096; phase++) for (const wide of [false, true])
   for (const selector of [0, 1]) for (let i = 0; i < 3; i++)
    query(base + phase, wide, (phase & 1 ? 0xa5a50000 : 0) | selector,
     selector ? 0xdeadbeef : i, selector ? records[i].tag : 0x99887766,
     [0, 1, 3, 4, 71, 72, 119, 120, 0xffffffff, 0x81526374][phase % 10],
     phase & 1 ? 0xfedcba98 : 0, label + '/' + [phase, wide, selector, i], mapped);
 }
 for (const [base, mapped, label] of [[direct, false, 'direct'], [adjacent, false, 'adjacent'],
  [fragmented, true, 'separate'], [alias, true, 'alias']]) sweep(base, mapped, label);
 // Same guest pointers remapped to different backing, old pages/decoys guarded.
 for (const [a, b] of [[replacement, fragmented], [fragmented + 4096, replacement], [fragmented, replacement]]) {
  publish(alias, a); publish(alias + 4096, b); sweep(alias, true, 'remap/' + [a, b]);
 }
 const oldBacking = wa(replacement);
 assert.equal(call('VirtualFree', [replacement, 0, 0x8000]), 1); commit(replacement, 4096);
 assert.equal(wa(replacement), oldBacking, 'public allocator backing reuse');
 // Error paths must preserve all bytes, even when a valid-looking decoy is
 // physically adjacent. cbStruct and handle do not validate or bound writes.
 for (const base of [direct, fragmented, alias]) for (const phase of [0, 3977, 4023, 4057, 4073, 4085, 4087, 4089, 4091, 4093, 4094, 4095])
  for (const wide of [false, true]) for (const flags of [0, 1, 2, 15, 16, 17, 0xfffffff0, 0xfffffff1, 0xffffffff])
   for (const value of [0, 1, 2, 3, 17, 18, 0x80000000, 0xffffffff])
    query(base + phase, wide, flags, value, value, 0x93725140, 0xbaadf00d,
     'policy/' + [base, phase, wide, flags, value], base !== direct);
 for (const wide of [false, true]) for (let low = 0; low < 16; low++)
  for (const high of [0, 0x80000000, 0xfffffff0])
   query(0, wide, (high | low) >>> 0, 0, 1, 0, 0, 'null');
 for (const wide of [false, true]) for (const cb of [0, 1, 4, 71, 72, 119, 120, 0xffffffff])
  for (let i = 0; i < 3; i++) query(replacement + 64, wide, 0, i, 99, cb, cb, 'recommit/ignored-size');
 for (const wide of [false, true]) for (const selector of [0, 1])
  for (const value of [1, 2, 3, 17, 0xffffffff])
   query(fragmented + 4092, wide, selector, value, value, 0x81526374, 0,
    'plausible-physical-decoy/' + [wide, selector, value], true, true);
 for (let bit = 4; bit < 32; bit++) for (const wide of [false, true])
  for (const selector of [0, 1]) for (let i = 0; i < 3; i++)
   query(fragmented + 4095, wide, ((2 ** bit) | selector) >>> 0, i, records[i].tag,
    1, 0xfedcba98, 'individual-high-flag/' + [bit, wide, selector, i], true);
 console.log(JSON.stringify(stats));
 assert.equal(stats.controlFailures, 0, 'literal direct/adjacent policy and ABI controls');
 if (expectParent) assert.ok(stats.mappingFailures > 0, 'fresh parent public MSACM32 PE mapping must fail');
 else assert.equal(stats.mappingFailures, 0, 'guest struct transport');
 return stats;
}
if (require.main === module) run({ expectParent: process.argv.includes('--expect-parent') }).catch(e => { console.error(e); process.exitCode = 1; });
module.exports = { run, extraWat };
