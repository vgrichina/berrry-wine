#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { bootRenderHarness } = require(path.join(process.cwd(), 'test/render-helper'));
const apiTable = require(path.join(process.cwd(), 'src/api_table.json'));

// Public layout/contract, not a new size policy:
// https://learn.microsoft.com/en-us/windows/win32/api/mmeapi/ns-mmeapi-midioutcapsa
// https://learn.microsoft.com/en-us/windows/win32/api/mmeapi/nf-mmeapi-midioutgetdevcaps
// Preserve current behavior: clear cbCaps bytes, then unconditionally write
// WORDs 1 at +0/+2/+40, even for zero/short/oversized cbCaps. The documented
// bounded-copy policy is a separate issue. No Wine reference is used.
const extraWat = String.raw`
 (func (export "mc_init")
  (global.set $thunk_guest_base (i32.add (global.get $image_base)
   (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
  (call $update_thunk_end))
 (func (export "mc_regs") (result i32) (global.get $reg_base))
 (func (export "mc_alias") (param i32 i32) (result i32)
  (call $guest_page_publish_range (local.get 0) (i32.const 4096)
   (local.get 1) (i32.const 4)))
 (func (export "mc_module") (param i32) (result i32)
  (call $handle_GetModuleHandleA (local.get 0) (i32.const 0) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "mc_resolve") (param i32 i32) (result i32)
  (call $handle_GetProcAddress (local.get 0) (local.get 1) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "mc_call") (param i32)
  (global.set $eip (i32.const 0x456789ab))
  (call $win32_dispatch (i32.shr_u
   (i32.sub (local.get 0) (global.get $thunk_guest_base)) (i32.const 3))))
`;

async function run({ expectParent = false } = {}) {
 let deviceCount = 1, countCalls = 0, boundaryCalls = 0, beforeCount = () => {};
 const h = await bootRenderHarness({ extraWat, fonts: 'none', width: 8, height: 8,
  beforeInstantiate(ctx, host) {
   // Every unrelated host boundary (including callback delivery) is counted.
   for (const [name, fn] of Object.entries(host)) if (typeof fn === 'function')
    host[name] = (...args) => { boundaryCalls++; return fn(...args); };
   host.midi_num_devs = () => { countCalls++; beforeCount(); return deviceCount; };
  } });
 const { exports: e, memory } = h;
 e.init_thread(1, 0x400000, 0, 0, 0, 0, 0); e.heap_init(0x800000); e.mc_init(); e.set_api_log(0);
 const mem = new Uint8Array(memory.buffer), dv = new DataView(memory.buffer);
 const regs = e.mc_regs() >>> 0, wa = p => e.guest_to_wasm(p) >>> 0;
 const alloc = n => { const p = e.guest_alloc(n) >>> 0; assert.ok(p); return p; };
 const read = (p, n) => Buffer.from(Array.from({ length: n }, (_, i) => mem[wa(p + i)]));
 const str = s => { const b = Buffer.from(s + '\0'), p = alloc(b.length);
  for (let i = 0; i < b.length; i++) mem[wa(p + i)] = b[i]; return p; };
 const stackBase = alloc(256), stack = stackBase + 64, entries = new Map();
 const stats = { calls: 0, queries: 0, comparisons: 0, mappingFailures: 0, controlFailures: 0, examples: [] };
 for (const [dll, names] of [
  ['WINMM.DLL', ['midiOutGetDevCapsA']], ['KERNEL32.DLL', ['VirtualAlloc', 'VirtualFree']],
 ]) {
  dv.setUint32(regs + 16, stack, true); const mod = e.mc_module(str(dll)) >>> 0; assert.ok(mod);
  for (const name of names) {
   dv.setUint32(regs + 16, stack, true);
   const stub = e.mc_resolve(mod, str(name)) >>> 0, row = apiTable.find(r => r.name === name);
   assert.ok(stub); assert.equal(row.convention, 'stdcall');
   const thunk = dll === 'KERNEL32.DLL' ? (stub + 5 + (e.guest_read32(stub + 1) | 0)) >>> 0 : stub;
   if (dll === 'KERNEL32.DLL') assert.equal(e.guest_read8(stub), 0xe9);
   assert.equal(e.guest_read32(thunk + 4), row.id);
   entries.set(name, { thunk, nargs: row.nargs });
  }
 }
 function call(name, args) {
  const row = entries.get(name); assert.equal(args.length, row.nargs);
  mem.fill(0x6d, wa(stackBase), wa(stackBase) + 256);
  e.guest_write32(stack, 0x12345678); args.forEach((v, i) => e.guest_write32(stack + 4 + i * 4, v));
  const frame = read(stackBase, 256);
  const seed = [0x81234567, 0x12345678, 0x23456789, 0x3456789a, stack, 0x456789ab, 0x56789abc, 0x6789abcd];
  seed.forEach((v, i) => dv.setUint32(regs + i * 4, v, true));
  e.mc_call(row.thunk); stats.calls++;
  assert.equal(e.get_esp() >>> 0, stack + 4 + args.length * 4, name + ' ESP');
  assert.equal(e.get_eip() >>> 0, 0x456789ab, name + ' EIP');
  for (const i of [1, 2, 3, 5, 6, 7]) assert.equal(dv.getUint32(regs + i * 4, true), seed[i], name + ' register ' + i);
  assert.deepEqual(read(stackBase, 256), frame, name + ' full stack guards');
  return e.get_eax() >>> 0;
 }
 const commit = (p, n) => assert.equal(call('VirtualAlloc', [p, n, 0x3000, 4]), p);
 const fragmented = 0x30000000, adjacent = 0x31000000, alias = 0x32000000;
 const decoys = [0x28000000, 0x28010000, 0x28020000, 0x28030000], replacement = 0x33000000;
 for (let i = 0; i < 4; i++) { commit(fragmented + i * 4096, 4096); commit(decoys[i], 4096); }
 commit(adjacent, 16384); commit(replacement, 4096);
 for (let i = 0; i < 4; i++) assert.equal(wa(decoys[i]), wa(fragmented + i * 4096) + 4096);
 for (let i = 1; i < 4; i++) {
  assert.notEqual(wa(fragmented + i * 4096), wa(fragmented) + i * 4096);
  assert.equal(wa(adjacent + i * 4096), wa(adjacent) + i * 4096);
 }
 const direct = alloc(16384);
 const spans = [[wa(direct), 16384], ...Array.from({ length: 4 }, (_, i) => [wa(fragmented + i * 4096), 4096]),
  ...decoys.map(p => [wa(p), 4096]), [wa(adjacent), 16384], [wa(replacement), 4096]];
 const views = spans.map(([p, n]) => Buffer.from(memory.buffer, p, n));
 const saved = views.map(b => Buffer.alloc(b.length));
 const pristine = views.map((b, i) => Buffer.alloc(b.length, 0x90 + i));
 const physicalByte = new Map();
 spans.forEach(([p, n], j) => { for (let i = 0; i < n; i++) physicalByte.set(p + i, [j, i]); });
 function compare(a, b, label, bucket) {
  stats.comparisons++;
  if (Buffer.isBuffer(a) ? a.equals(b) : a === b) return;
  stats[bucket]++;
  if (stats.examples.length < 8) stats.examples.push({ label,
   actual: Buffer.isBuffer(a) ? a.toString('hex').slice(0, 128) : a,
   expected: Buffer.isBuffer(b) ? b.toString('hex').slice(0, 128) : b });
 }
 function query(p, size, label, mapped = false, id = 0, n = 1) {
  const bucket = mapped ? 'mappingFailures' : 'controlFailures';
  spans.forEach(([a, len], i) => mem.fill(0x90 + i, a, a + len));
  views.forEach((b, i) => b.copy(saved[i]));
  const valid = p !== 0 && (id === 0xffffffff || (id >>> 0) < (n >>> 0));
  const extent = Math.max(size, 42);
  const addresses = p ? Array.from({ length: extent }, (_, i) => wa(p + i)) : [];
  const expectedByte = (a, v) => { const loc = physicalByte.get(a); assert.ok(loc); saved[loc[0]][loc[1]] = v; };
  if (valid) {
   // Literal byte oracle: all clear bytes zero, three little endian WORDs 1.
   // Apply in contract order so actual overlapping aliases are modelled too.
   for (let i = 0; i < size; i++) expectedByte(addresses[i], 0);
   for (const [i, v] of [[0, 1], [1, 0], [2, 1], [3, 0], [40, 1], [41, 0]]) expectedByte(addresses[i], v);
  }
  const fullExpected = Buffer.from(addresses.map(a => { const [j, i] = physicalByte.get(a); return saved[j][i]; }));
  const countBefore = countCalls, hostBefore = boundaryCalls;
  deviceCount = n;
  // Count must happen once, before any output byte or return-register change,
  // including null/invalid-ID paths. Inspect independently at host boundary.
  beforeCount = () => {
   assert.equal(dv.getUint32(regs, true), 0x81234567, label + ' count before EAX');
   assert.equal(e.get_esp() >>> 0, stack, label + ' count before cleanup');
   for (let j = 0; j < views.length; j++) {
    assert.ok(views[j].equals(pristine[j]), label + ' count before output');
   }
  };
  compare(call('midiOutGetDevCapsA', [id, p, size]), valid ? 0 : 2, label + ' return', 'controlFailures');
  beforeCount = () => {};
  assert.equal(countCalls - countBefore, 1, label + ' device-count calls');
  assert.equal(boundaryCalls - hostBefore, 0, label + ' unrelated host/callback calls');
  stats.queries++;
  if (p) compare(read(p, extent), fullExpected, label + ' full logical output', bucket);
  for (let j = 0; j < views.length; j++) compare(views[j], saved[j], label + ' full physical span ' + j, bucket);
  assert.equal(e.guest_span_cursor_bytes(), 0); assert.equal(e.guest_span_overflow_count(), 0);
 }
 const sizes = [0, 1, 2, 3, 4, 39, 40, 41, 42, 48, 51, 52, 53, 64, 128];
 for (let i = 0; i < 4; i++) assert.equal(e.mc_alias(alias + i * 4096, wa(fragmented)), 1);
 assert.equal(wa(alias), wa(alias + 4096));
 for (const size of [...sizes, 4095, 4096, 4097, 8193]) query(direct + 64, size, 'direct/' + size);
 // Every page phase, hence every fill cut and both bytes of every WORD,
 // including fields wholly on the relocated page; contiguous backing control.
 for (const base of [adjacent, fragmented, alias]) for (let phase = 0; phase < 4096; phase++)
  for (const size of sizes) query(base + phase, size, [base, phase, size].join('/'), base !== adjacent);
 // Multi-page fills and every possible cut of a 4097-byte fill; reused aliases
 // also test that memset completes before the literal WORD writes.
 for (const base of [adjacent, fragmented, alias]) for (let phase = 0; phase < 4096; phase++)
  query(base + phase, 4097, 'long/' + [base, phase].join('/'), base !== adjacent);
 for (const size of [4095, 4096, 8193]) for (const base of [adjacent, fragmented, alias])
  for (const phase of [0, 1, 2, 39, 40, 41, 4055, 4093, 4094, 4095])
   query(base + phase, size, 'multipage/' + [base, phase, size].join('/'), base !== adjacent);
 // Same guest addresses, genuinely changed physical backing; former backing
 // remains independently guarded, along with each physical fall-through decoy.
 for (const target of [replacement, fragmented + 4096, fragmented]) {
  assert.equal(e.mc_alias(alias, wa(target)), 1);
  assert.equal(e.mc_alias(alias + 4096, wa(replacement)), 1);
  assert.equal(wa(alias), wa(target)); assert.equal(wa(alias + 4096), wa(replacement));
  for (let phase = 0; phase < 4096; phase++)
   query(alias + phase, sizes[phase % sizes.length], 'remap/' + [target, phase].join('/'), true);
 }
 // Independent public allocator release/recommit, same guest address/backing.
 const oldBacking = wa(replacement);
 assert.equal(call('VirtualFree', [replacement, 0, 0x8000]), 1); commit(replacement, 4096);
 assert.equal(wa(replacement), oldBacking);
 for (const size of sizes) query(replacement + 64, size, 'recommit/' + size);
 for (const n of [0, 1, 2, 7]) for (const id of [0, 1, 6, 7, 0xfffffffe, 0xffffffff])
  for (const p of [0, direct + 64, fragmented + 4095]) for (const size of sizes)
   query(p, size, 'policy/' + [n, id, p, size].join('/'), p === fragmented + 4095, id, n);
 console.log(JSON.stringify(stats));
 assert.equal(stats.controlFailures, 0, 'contiguous, literal policy, ABI controls');
 if (expectParent) assert.ok(stats.mappingFailures > 0, 'fresh parent public WINMM mapping must fail');
 else assert.equal(stats.mappingFailures, 0, 'guest output mapping');
 return stats;
}
if (require.main === module) run({ expectParent: process.argv.includes('--expect-parent') }).catch(e => { console.error(e); process.exitCode = 1; });
module.exports = { run, extraWat };
