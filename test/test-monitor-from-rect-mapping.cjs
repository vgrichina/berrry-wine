#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');
const { makeFixture } = require('../tools/kernel32-native-fixture');
const apiTable = require('../src/api_table.json');

// Only setup/inspection exports: the API under test runs through the public
// USER32 PE export, resolver, stdcall thunk and x86 interpreter.
const extraWat = String.raw`
 (func (export "mr_error") (result i32) (global.get $last_error))
 (func (export "mr_seed_error") (param i32) (global.set $last_error (local.get 0)))
 (func (export "mr_regs") (result i32) (global.get $reg_base))
 (func (export "mr_thread") (result i32) (global.get $current_thread_id))
 (func (export "mr_alias") (param i32 i32) (result i32)
  (call $guest_page_publish_range (local.get 0) (i32.const 4096)
   (local.get 1) (i32.const 4)))
 (func (export "mr_module") (param i32) (result i32)
  (call $handle_GetModuleHandleA (local.get 0) (i32.const 0) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "mr_resolve") (param i32 i32) (result i32)
  (call $handle_GetProcAddress (local.get 0) (local.get 1) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
`;

async function run({ expectParent = false, moduleBytes = null } = {}) {
 let screen = 640 | (480 << 16);
 const { exports: e, memory } = await bootRenderHarness({ extraWat: moduleBytes ? '' : extraWat, prebuiltModule: moduleBytes ? new WebAssembly.Module(moduleBytes) : null, extraHostOverrides: {get_screen_size: () => screen}, fonts: 'none', width: 640, height: 480 });
 const fixture = makeFixture(); new Uint8Array(memory.buffer).set(fixture, e.get_staging());
 assert.ok(e.load_pe(fixture.length), 'fresh actual PE load'); e.set_api_log(0);
 const mem = new Uint8Array(memory.buffer), dv = new DataView(memory.buffer);
 const regs = e.mr_regs() >>> 0, wa = p => e.guest_to_wasm(p >>> 0) >>> 0;
 const alloc = n => { const p = e.guest_alloc(n) >>> 0; assert.ok(p); return p; };
 const str = s => { const b = Buffer.from(s + '\0'), p = alloc(b.length);
  b.forEach((v, i) => e.guest_write8(p + i, v)); return p; };
 const stackBase = alloc(256), stack = stackBase + 64, entries = new Map();
 const stats = { calls: 0, queries: 0, mappingFailures: 0, controlFailures: 0, examples: [] };
 for (const [dll, names] of [['USER32.DLL', ['MonitorFromRect']],
  ['KERNEL32.DLL', ['VirtualAlloc', 'VirtualFree']]]) {
  dv.setUint32(regs + 16, stack, true); const mod = e.mr_module(str(dll)) >>> 0; assert.ok(mod);
  assert.equal(e.guest_read32(mod) & 0xffff, 0x5a4d, dll + ' PE module');
  for (const name of names) {
   dv.setUint32(regs + 16, stack, true);
   const entry = e.mr_resolve(mod, str(name)) >>> 0, row = apiTable.find(r => r.name === name);
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
  const thread = e.mr_thread(); e.clear_yield(); e.set_eip(row.entry);
  for (let i = 0; i < 16 && e.get_eip(); i++) e.run(32);
  stats.calls++;
  assert.equal(e.get_eip() >>> 0, 0, name + ' x86 return');
  assert.equal(e.get_esp() >>> 0, stack + 4 + args.length * 4, name + ' ESP (MonitorFromRect +12)');
  assert.equal(e.mr_thread(), thread, name + ' thread');
  for (const i of [1, 2, 3, 5, 6, 7]) assert.equal(dv.getUint32(regs + i * 4, true), seed[i], name + ' register ' + i);
  assert.deepEqual(mem.subarray(wa(stackBase), wa(stackBase) + 256), new Uint8Array(frame), name + ' stack guards');
  return e.get_eax() >>> 0;
 }
 const commit = (p, n) => assert.equal(call('VirtualAlloc', [p, n, 0x3000, 4]), p);
 const separate = 0x30000000, adjacent = 0x31000000, alias = 0x32000000, reuse = 0x33000000;
 const decoys = [0x28000000, 0x28010000];
 for (let i = 0; i < 2; i++) { commit(separate + i * 4096, 4096); commit(decoys[i], 4096); }
 commit(adjacent, 8192); commit(reuse, 4096);
 const terminal=0x35000000; commit(terminal,4096);
 for (let i = 0; i < 2; i++) assert.equal(wa(decoys[i]), wa(separate + i * 4096) + 4096);
 assert.notEqual(wa(separate + 4096), wa(separate) + 4096, 'nonadjacent physical backing');
 assert.equal(wa(adjacent + 4096), wa(adjacent) + 4096);
 const direct = alloc(8192);
 const spans = [[wa(direct), 8192], [wa(separate), 4096], [wa(separate + 4096), 4096],
  ...decoys.map(p => [wa(p), 4096]), [wa(adjacent), 8192], [wa(reuse), 4096], [wa(terminal),4096], [0xf0, 64]];
 const views = spans.map(([p, n]) => Buffer.from(memory.buffer, p, n));
 const saved = views.map(b => Buffer.alloc(b.length));
 function publish(g, p) { assert.equal(e.mr_alias(g, wa(p)), 1); assert.equal(wa(g), wa(p)); }
 publish(alias, separate); publish(alias + 4096, separate);
 assert.equal(wa(alias), wa(alias + 4096), 'physical aliases');
 // Literal oracle for the existing one-monitor policy at 640x480. Expected
 // handles are data, independent of guest reads and the implementation's
 // intersection expression. Columns: flags 0,1,2,3,-1,INT_MIN,INT_MAX.
 const yes = [65536,65536,65536,65536,65536,65536,65536];
 const no = [0,65536,65536,0,0,0,0];
 const flags = [0,1,2,3,0xffffffff,0x80000000,0x7fffffff];
 const cases = [
  ['one-pixel', [-10,-10,1,1], yes],
  ['right-edge-only', [640,0,700,20], no],
  ['empty-width', [20,20,20,30], no],
  ['signed-span', [-2147483648,-2147483648,2147483647,2147483647], yes],
  ['negative', [-30,-30,-1,-1], no],
  ['bottom-edge-only', [0,480,20,500], no],
  ['left-edge-only', [-20,0,0,20], no],
  ['top-edge-only', [0,-20,20,0], no],
  ['last-pixel', [639,479,640,480], yes],
  ['screen', [0,0,640,480], yes],
  ['offscreen', [700,500,800,600], no],
  ['empty-height', [20,20,30,20], no],
  ['inverted-width', [30,20,20,30], no],
  ['inverted-height', [20,30,30,20], no],
  ['inverted-both', [30,30,20,20], no],
  ['signed-min', [-2147483648,-2147483648,-2147483647,-2147483647], no],
  ['signed-max', [2147483646,2147483646,2147483647,2147483647], no],
  ['signed-inverted', [2147483647,2147483647,-2147483648,-2147483648], no],
 ];
 function query(p, c, fi, label, mapped = false) {
  views.forEach(b => b.fill(0x71));
  // Plausible offscreen physical continuation, with whole-page guards.
  // Each scalar is written bytewise to avoid borrowing the reader's oracle.
  if (p) {
   const bytes = Buffer.alloc(16);
   c[1].forEach((v, i) => bytes.writeInt32LE(v, i * 4));
   bytes.forEach((v, i) => e.guest_write8(p + i, v));
   bytes.forEach((v, i) => assert.equal(mem[wa(p + i)], v, 'literal input byte'));
  }
  views.forEach((b, i) => b.copy(saved[i]));
  e.mr_seed_error(0x13579bdf);
  const actual = call('MonitorFromRect', [p, flags[fi]]);
  const expected = (p ? c[2] : no)[fi]; stats.queries++;
  if (actual !== expected) {
   stats[mapped ? 'mappingFailures' : 'controlFailures']++;
   if (stats.examples.length < 12) stats.examples.push({label, p, flags: flags[fi], actual, expected});
  }
  assert.equal(e.mr_error(), 0x13579bdf, 'lastError unchanged');
  for (let i = 0; i < views.length; i++) assert.ok(views[i].equals(saved[i]), label + ' immutable full backing/neighbor ' + i);
  assert.equal(e.guest_span_cursor_bytes(), 0); assert.equal(e.guest_span_overflow_count(), 0);
 }
 // Every page phase, including all 15 RECT cuts and the three internal
 // byte cuts in EACH scalar, on direct/contiguous/separate/aliased backing.
 for (const [base, mapped, label] of [[direct,false,'direct'], [adjacent,false,'adjacent'],
  [separate,true,'separate'], [alias,true,'alias']])
  for (let phase = 0; phase < 4096; phase++) for (const c of cases)
   for (let fi = 0; fi < flags.length; fi++) query(base + phase, c, fi, label+'/'+phase+'/'+c[0], mapped);
 for (const [a,b] of [[reuse,separate], [separate+4096,reuse], [separate,reuse]]) {
  publish(alias,a); publish(alias+4096,b);
  for (let phase = 4080; phase < 4096; phase++) for (const c of cases)
   for (let fi = 0; fi < flags.length; fi++) query(alias+phase,c,fi,'remap/'+phase,true);
 }
 const old = wa(reuse);
 assert.equal(call('VirtualFree',[reuse,4096,0x4000]),1);
 assert.equal(call('VirtualAlloc',[reuse,4096,0x1000,4]),reuse);
 assert.equal(wa(reuse),old,'decommit/recommit reuse');
 assert.equal(call('VirtualFree',[reuse,0,0x8000]),1); commit(reuse,4096);
 assert.equal(wa(reuse),old,'release/reallocate reuse');
 publish(alias,reuse); publish(alias+4096,separate+4096);
 for (let phase = 4080; phase < 4096; phase++) for (const c of cases)
  for (let fi = 0; fi < flags.length; fi++) query(alias+phase,c,fi,'reuse/'+phase,true);
 for (let fi = 0; fi < flags.length; fi++) query(0,cases[0],fi,'NULL');
 // Strict unmapped diagnostics prove no reads past the exact 16-byte RECT.
 assert.equal(wa(terminal+4096),0xf0);
 e.set_fault_unmapped(2);
 for (const c of cases) for (let fi=0;fi<flags.length;fi++) query(terminal+4080,c,fi,'terminal');
 for (let fi=0;fi<flags.length;fi++) query(0,cases[0],fi,'strict NULL');
 e.set_fault_unmapped(0);
 screen = 800 | (600 << 16);
 for (const p of [direct, separate+4095]) for (let fi=0;fi<flags.length;fi++)
  query(p,['live-larger',[700,500,701,501],yes],fi,'live larger',p!==direct);
 screen = 320 | (200 << 16);
 for (const p of [direct, separate+4093]) for (let fi=0;fi<flags.length;fi++) {
  query(p,['live-smaller',[639,479,640,480],no],fi,'live smaller',p!==direct);
  query(p,['live-last-pixel',[319,199,320,200],yes],fi,'live last pixel',p!==direct);
 }
 assert.equal(call('VirtualFree',[terminal,0,0x8000]),1);
 console.log(JSON.stringify(stats));
 assert.equal(stats.controlFailures,0,'unchanged literal policy/flags/null/ABI controls');
 if (expectParent) assert.ok(stats.mappingFailures>0,'fresh parent public transport must fail');
 else assert.equal(stats.mappingFailures,0,'mapped RECT input');
 return stats;
}
if (require.main === module) run({expectParent:process.argv.includes('--expect-parent')})
 .catch(error=>{console.error(error);process.exitCode=1;});
module.exports={run,extraWat};
