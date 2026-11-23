#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');
const { makeFixture } = require('../tools/kernel32-native-fixture');
const apiTable = require('../src/api_table.json');

// Inspect the real identity PE. An empty ADVAPI32 EAT means GPA fallback,
// not a native export. The resolved public thunk is executed by the x86 CPU.
const extraWat = String.raw`
 (func (export "rc_error") (result i32) (global.get $last_error))
 (func (export "rc_seed_error") (param i32) (global.set $last_error (local.get 0)))
 (func (export "rc_regs") (result i32) (global.get $reg_base))
 (func (export "rc_thread") (result i32) (global.get $current_thread_id))
 (func (export "rc_alias") (param i32 i32) (result i32)
  (call $guest_page_publish_range (local.get 0) (i32.const 4096)
   (local.get 1) (i32.const 4)))
 (func (export "rc_module") (param i32) (result i32)
  (call $handle_GetModuleHandleA (local.get 0) (i32.const 0) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "rc_resolve") (param i32 i32) (result i32)
  (call $handle_GetProcAddress (local.get 0) (local.get 1) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
`;

async function run({ expectParent = false, moduleBytes = null } = {}) {
 let activeHostCall = null, hostCalls = 0;
 const prebuiltModule = moduleBytes ? await WebAssembly.compile(moduleBytes) : null;
 const { exports: e, memory } = await bootRenderHarness({
  extraWat: prebuiltModule ? '' : extraWat, prebuiltModule, fonts: 'none',
  extraHostOverrides: { reg_create_key: (key, input, output, wide, disposition) => {
   hostCalls++;
   assert.ok(activeHostCall, 'no unplanned registry host calls');
   return activeHostCall(key >>> 0, input >>> 0, output >>> 0, wide, disposition >>> 0);
  } }
 });
 const fixture = makeFixture(); new Uint8Array(memory.buffer).set(fixture, e.get_staging());
 assert.ok(e.load_pe(fixture.length), 'fresh fixture PE load'); e.set_api_log(0);
 const mem = new Uint8Array(memory.buffer), dv = new DataView(memory.buffer);
 const regs = e.rc_regs() >>> 0, wa = p => e.guest_to_wasm(p >>> 0) >>> 0;
 const alloc = n => { const p = e.guest_alloc(n) >>> 0; assert.ok(p); return p; };
 const str = s => { const b = Buffer.from(s + '\0'), p = alloc(b.length);
  b.forEach((v, i) => e.guest_write8(p + i, v)); return p; };
 const stackBase = alloc(256), stack = stackBase + 64, entries = new Map();
 const stats = { calls: 0, queries: 0, mappingFailures: 0, controlFailures: 0, routes: [], examples: [] };
 let advapi = 0;
 for (const [dll, names] of [
  ['KERNEL32.DLL', ['GetProcAddress', 'VirtualAlloc', 'VirtualFree']],
  ['ADVAPI32.DLL', ['RegCreateKeyExA', 'RegCreateKeyExW']]
 ]) {
  dv.setUint32(regs + 16, stack, true); const mod = e.rc_module(str(dll)) >>> 0; assert.ok(mod);
  if (dll === 'ADVAPI32.DLL') advapi = mod;
  assert.equal(e.guest_read32(mod) & 0xffff, 0x5a4d);
  const nt = mod + (e.guest_read32(mod + 0x3c) >>> 0);
  assert.equal(e.guest_read32(nt), 0x4550);
  const rva = e.guest_read32(nt + 120) >>> 0, directory = mod + rva;
  const count = rva ? e.guest_read32(directory + 24) >>> 0 : 0;
  assert.ok(count < 4096);
  const functions = count ? mod + (e.guest_read32(directory + 28) >>> 0) : 0;
  const namesTable = count ? mod + (e.guest_read32(directory + 32) >>> 0) : 0;
  const ordinals = count ? mod + (e.guest_read32(directory + 36) >>> 0) : 0;
  for (const name of names) {
   dv.setUint32(regs + 16, stack, true);
   const entry = e.rc_resolve(mod, str(name)) >>> 0, row = apiTable.find(r => r.name === name);
   assert.ok(entry); assert.equal(row.convention, 'stdcall');
   let eatEntry = 0;
   for (let i = 0; i < count; i++) {
    const p = mod + (e.guest_read32(namesTable + i * 4) >>> 0);
    let exportedName = '';
    for (let j = 0; j < 128; j++) {
     const c = e.guest_read8(p + j); if (!c) break;
     exportedName += String.fromCharCode(c);
    }
    if (exportedName === name) {
     const ordinal = e.guest_read8(ordinals + i * 2) | (e.guest_read8(ordinals + i * 2 + 1) << 8);
     eatEntry = mod + (e.guest_read32(functions + ordinal * 4) >>> 0); break;
    }
   }
   if (eatEntry) assert.equal(entry, eatEntry, name + ' PE EAT == GPA');
   else assert.equal(dll, 'ADVAPI32.DLL', 'KERNEL32 must expose public EAT entries');
   const thunk = e.guest_read8(entry) === 0xe9 ? (entry + 5 + (e.guest_read32(entry + 1) | 0)) >>> 0 : entry;
   assert.equal(e.guest_read32(thunk + 4), row.id, name + ' thunk ID');
   stats.routes.push({ dll, name, module: mod, exportRva: rva, namedExports: count,
    eatEntry, entry, thunk, route: eatEntry ? 'PE EAT == GPA -> x86/thunk' : 'identity PE; no matching EAT -> GPA fallback -> x86/thunk' });
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
  const thread = e.rc_thread(); e.clear_yield(); e.set_eip(row.entry);
  for (let i = 0; i < 16 && e.get_eip(); i++) e.run(32);
  stats.calls++;
  assert.equal(e.get_eip() >>> 0, 0, name + ' x86 return');
  assert.equal(e.get_esp() >>> 0, stack + 4 + args.length * 4, name + ' stdcall ESP');
  assert.equal(e.rc_thread(), thread, name + ' thread');
  for (const i of [1, 2, 3, 5, 6, 7]) assert.equal(dv.getUint32(regs + i * 4, true), seed[i], name + ' register ' + i);
  assert.deepEqual(mem.subarray(wa(stackBase), wa(stackBase) + 256), new Uint8Array(frame), name + ' stack guards');
  return e.get_eax() >>> 0;
 }
 for (const name of ['RegCreateKeyExA', 'RegCreateKeyExW']) {
  const publicEntry = call('GetProcAddress', [advapi, str(name)]);
  const publicThunk = e.guest_read8(publicEntry) === 0xe9
   ? (publicEntry + 5 + (e.guest_read32(publicEntry + 1) | 0)) >>> 0 : publicEntry;
  assert.equal(e.guest_read32(publicThunk + 4), apiTable.find(r => r.name === name).id);
  entries.get(name).entry = publicEntry;
  stats.routes.push({ name, route: 'public x86 GetProcAddress -> x86/thunk', entry: publicEntry, thunk: publicThunk });
 }
 const pages = new Map(), spans = [];
 const register = (g, n) => {
  for (let i = 0; i < n; i += 4096) pages.set(g + i, wa(g + i));
  spans.push([wa(g), n]);
 };
 const commit = (p, n) => { assert.equal(call('VirtualAlloc', [p, n, 0x3000, 4]), p); register(p, n); };
 const separate = 0x30000000, adjacent = 0x31000000, alias = 0x32000000, reuse = 0x33000000;
 const decoys = [0x28000000, 0x28010000];
 for (let i = 0; i < 2; i++) { commit(separate + i * 4096, 4096); commit(decoys[i], 4096); }
 commit(adjacent, 8192); commit(reuse, 4096);
 const reuseGuard = 0x34000000; commit(reuseGuard, 4096);
 assert.equal(wa(reuseGuard), wa(reuse) + 4096, 'whole physical remap neighbor guard');
 for (let i = 0; i < 2; i++) assert.equal(wa(decoys[i]), wa(separate + i * 4096) + 4096);
 assert.notEqual(wa(separate + 4096), wa(separate) + 4096, 'nonadjacent stack backing');
 assert.equal(wa(adjacent + 4096), wa(adjacent) + 4096);
 const inputA = str('Software\\Transport');
 const wideBytes = Buffer.from('Software\\Transport\0', 'utf16le'), inputW = alloc(wideBytes.length);
 mem.set(wideBytes, wa(inputW));
 // Literal intended output addresses, including their NULL controls. The host
 // double records transport and returns a fixed status; it adds no registry semantics.
 commit(0x35000000, 4096); commit(0x36000000, 4096);
 const direct = (alloc(12288) + 4095) & ~4095; register(direct, 8192);
 assert.equal(wa(0), 0xf0, 'existing NULL sentinel');
 spans.push([0xb0, 160]);
 const views = spans.map(([p, n]) => Buffer.from(memory.buffer, p, n));
 const expected = views.map(b => Buffer.alloc(b.length));
 // This page map is captured from the allocator before calls. The fixture
 // writes literal argument bytes directly to physical pages, independently of
 // guest stack load/store helpers and production pointer packing.
 const physical = g => { assert.ok(pages.has(g & ~4095)); return pages.get(g & ~4095) + (g & 4095); };
 const writeWord = (g, v) => { for (let i = 0; i < 4; i++) mem[physical(g + i)] = (v >>> (i * 8)) & 255; };
 const publish = (g, backing) => {
  assert.equal(e.rc_alias(g, pages.get(backing)), 1);
  pages.set(g, pages.get(backing)); assert.equal(wa(g), pages.get(g));
 };
 publish(alias, separate); publish(alias + 4096, separate);
 function query(name, esp, label, mapped, status = 0, output = 0x35000010, disposition = 0x36000024, nullInput = false, short = false) {
  views.forEach(b => b.fill(0xa7));
  const wide = name === 'RegCreateKeyExW' ? 1 : 0;
  const input = nullInput ? 0 : wide ? inputW : inputA;
  const args = [0x80000002, input, short ? 0 : 0xfeedcafe, short ? 0 : 0x12345678,
   short ? 0 : 0x13579bdf, short ? 0 : 0x2468ace0, short ? 0 : 0x11223344, output, disposition];
  writeWord(esp, 0); args.forEach((v, i) => writeWord(esp + 4 + i * 4, v));
  views.forEach((b, i) => b.copy(expected[i]));
  if (!input) {
   const sentinel = spans.findIndex(([p]) => p === 0xb0);
   expected[sentinel].fill(0, 0x40, 0x44); // g2w(NULL) clears its DWORD as before.
  }
  const inputPhysical = input ? wa(input) : 0xf0;
  const inputBefore = input ? Buffer.from(mem.subarray(inputPhysical, inputPhysical + (wide ? wideBytes.length : 19))) : null;
  const seed = [0x81234567, 0x12345678, 0x23456789, 0x3456789a, esp, 0x456789ab, 0x56789abc, 0x6789abcd];
  seed.forEach((v, i) => dv.setUint32(regs + i * 4, v, true));
  e.rc_seed_error(0xabcde012); const before = hostCalls, thread = e.rc_thread(); let record;
  activeHostCall = (...values) => {
   assert.equal(record, undefined, 'exactly one host call'); record = values;
   assert.equal(e.get_esp() >>> 0, esp, 'host precedes ESP cleanup');
   assert.equal(e.get_eax() >>> 0, 0x81234567, 'host precedes result EAX');
   assert.equal(e.rc_error() >>> 0, 0xabcde012);
   // Inputs, output pages, stack bytes, and entire adjacent physical guards
   // remain byte-for-byte intact when the host is entered.
   views.forEach((b, i) => assert.ok(b.equals(expected[i]), 'host guard: ' + label));
   return status;
  };
  e.clear_yield(); e.set_eip(entries.get(name).entry);
  for (let i = 0; i < 16 && e.get_eip(); i++) e.run(32);
  activeHostCall = null; stats.queries++;
  assert.equal(hostCalls - before, 1); assert.ok(record);
  // Compare against the literal intended pointers, not a stack-reading helper.
  const intended = [0x80000002, inputPhysical, output, wide, disposition];
  const failure = record.some((v, i) => v !== intended[i]);
  if (failure) {
   stats[mapped ? 'mappingFailures' : 'controlFailures']++;
   if (stats.examples.length < 12) stats.examples.push({ name, esp, label, intended, hostCall: record });
  }
  assert.equal(e.get_eip() >>> 0, 0, 'public x86 return');
  assert.equal(e.get_eax() >>> 0, status >>> 0, 'host status passed through unchanged');
  assert.equal(e.get_esp() >>> 0, esp + 40, '9-argument stdcall');
  assert.equal(e.rc_error() >>> 0, 0xabcde012, 'lastError unchanged');
  assert.equal(e.rc_thread(), thread);
  for (const i of [1, 2, 3, 5, 6, 7]) assert.equal(dv.getUint32(regs + i * 4, true), seed[i], 'register ' + i);
  views.forEach((b, i) => assert.ok(b.equals(expected[i]), 'whole physical guard after call: ' + label));
  if (inputBefore) assert.ok(inputBefore.equals(mem.subarray(inputPhysical, inputPhysical + inputBefore.length)), 'input unchanged');
  assert.equal(e.guest_span_cursor_bytes(), 0); assert.equal(e.guest_span_overflow_count(), 0);
 }
 for (const name of ['RegCreateKeyExA', 'RegCreateKeyExW']) {
  for (const [base, mapped, label] of [[direct, false, 'direct'], [adjacent, false, 'adjacent'],
   [separate, true, 'nonadjacent'], [alias, true, 'alias']]) {
   // All ESP alignments include every byte cut within either output-pointer
   // DWORD and all earlier stack arguments/return-address cuts.
   for (let phase = 0; phase < 4096; phase++) query(name, base + phase, label + '/phase' + phase, mapped);
   for (let cut = 0; cut <= 40; cut++) {
    const esp = base + 4096 - cut;
    query(name, esp, label + '/failure-cut' + cut, mapped, 0x80070005);
    for (const [output, disposition] of [[0, 0], [0, 0x36000024], [0x35000010, 0]]) {
     query(name, esp, label + '/NULL-output-cut' + cut, mapped, 0, output, disposition);
    }
    query(name, esp, label + '/NULL-input-cut' + cut, mapped, 0, 0x35000010, 0x36000024, true);
    query(name, esp, label + '/NULL-input-failure-cut' + cut, mapped, 5, 0, 0, true);
   }
   // No output-size parameter exists. Zero/short caller payload controls keep
   // the literal output pointers and ignored argument values unchanged.
   for (let available = 0; available < 4; available++) query(name, base + 4096 - 32 - available,
    label + '/short' + available, mapped, 0, 0x35000010, 0x36000024, false, true);
  }
  for (const [a, b] of [[reuse, separate], [separate + 4096, reuse], [separate, reuse]]) {
   publish(alias, a); publish(alias + 4096, b);
   for (let cut = 0; cut <= 40; cut++) {
    query(name, alias + 4096 - cut, 'remap/' + cut, true);
    query(name, alias + 4096 - cut, 'remap-failure/' + cut, true, 5);
   }
  }
  publish(alias, separate); publish(alias + 4096, separate);
 }
 assert.equal(stats.controlFailures, 0, JSON.stringify(stats));
 if (expectParent) assert.ok(stats.mappingFailures > 0, 'unchanged fresh published parent must fail stack transport');
 else assert.equal(stats.mappingFailures, 0, JSON.stringify(stats));
 assert.equal(hostCalls, stats.queries);
 console.log(JSON.stringify({ expectParent, hostCalls, ...stats })); return stats;
}
if (require.main === module) run().catch(e => { console.error(e); process.exitCode = 1; });
module.exports = { run, extraWat };
