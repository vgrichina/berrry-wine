#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');
const { makeFixture } = require('../tools/kernel32-native-fixture');
const apiTable = require('../src/api_table.json');

// Setup/inspection only: actual x86 enters a mapped WINMM fixture PE export,
// checked against GetProcAddress, then JMPs to the built-in WINMM API thunk.
// The built-in WINMM identity PE has no EAT; that fact is asserted explicitly.
const extraWat = String.raw`
 (func (export "tc_error") (result i32) (global.get $last_error))
 (func (export "tc_seed_error") (param i32) (global.set $last_error (local.get 0)))
 (func (export "tc_regs") (result i32) (global.get $reg_base))
 (func (export "tc_thread") (result i32) (global.get $current_thread_id))
 (func (export "tc_alias") (param i32 i32) (result i32)
  (call $guest_page_publish_range (local.get 0) (i32.const 4096)
   (local.get 1) (i32.const 4)))
 (func (export "tc_module") (param i32) (result i32)
  (call $handle_GetModuleHandleA (local.get 0) (i32.const 0) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "tc_resolve") (param i32 i32) (result i32)
  (call $handle_GetProcAddress (local.get 0) (local.get 1) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
`;

async function run({ expectParent = false, moduleBytes = null } = {}) {
 const prebuiltModule = moduleBytes ? await WebAssembly.compile(moduleBytes) : null;
 const { exports: e, memory } = await bootRenderHarness({ extraWat: prebuiltModule ? '' : extraWat,
  prebuiltModule, fonts: 'none', width: 640, height: 480 });
 const fixture = makeFixture(); new Uint8Array(memory.buffer).set(fixture, e.get_staging());
 assert.ok(e.load_pe(fixture.length), 'fresh actual PE load'); e.set_api_log(0);
 const mem = new Uint8Array(memory.buffer), dv = new DataView(memory.buffer);
 const regs = e.tc_regs() >>> 0, wa = p => e.guest_to_wasm(p >>> 0) >>> 0;
 const alloc = n => { const p = e.guest_alloc(n) >>> 0; assert.ok(p); return p; };
 const str = s => { const b = Buffer.from(s + '\0'), p = alloc(b.length);
  b.forEach((v, i) => e.guest_write8(p + i, v)); return p; };
 const stackBase = alloc(256), stack = stackBase + 64, entries = new Map();
 const stats = { calls: 0, queries: 0, mappingFailures: 0, controlFailures: 0, examples: [] };
 for (const [dll, names] of [['WINMM.DLL', ['timeGetDevCaps']], ['KERNEL32.DLL', ['VirtualAlloc', 'VirtualFree']]]) {
  dv.setUint32(regs + 16, stack, true); const mod = e.tc_module(str(dll)) >>> 0; assert.ok(mod);
  assert.equal(e.guest_read32(mod) & 0xffff, 0x5a4d, dll + ' PE module');
  const nt = mod + (e.guest_read32(mod + 0x3c) >>> 0);
  assert.equal(e.guest_read32(nt), 0x4550, 'public PE signature');
  if (dll === 'WINMM.DLL') {
   assert.equal(e.guest_read32(nt + 120), 0, 'built-in WINMM identity has no EAT');
   dv.setUint32(regs + 16, stack, true);
   const thunk = e.tc_resolve(mod, str('timeGetDevCaps')) >>> 0;
   const row = apiTable.find(r => r.name === 'timeGetDevCaps');
   assert.ok(thunk); assert.equal(row.nargs, 2); assert.equal(row.convention, 'stdcall');
   assert.equal(e.guest_read32(thunk + 4), row.id, 'built-in WINMM thunk ID');
   // Local deterministic DLL fixture: no imports or DllMain; one real EAT.
   const dllBytes = makeFixture(), opt = 0x98, base = e.get_next_dll_addr() >>> 0;
   dllBytes.writeUInt16LE(0x210e, 0x96); dllBytes.writeUInt32LE(0, opt + 16);
   dllBytes.writeUInt32LE(base, opt + 28);
   dllBytes.writeUInt32LE(0, opt + 104); dllBytes.writeUInt32LE(0, opt + 108);
   dllBytes.fill(0, 0x380, 0x3b0); dllBytes.write('winmm.dll\0', 0x380);
   dllBytes.write('timeGetDevCaps\0', 0x390);
   mem.set(dllBytes, e.get_staging());
   assert.equal(e.load_dll(dllBytes.length, base), 0, 'entryless DLL');
   assert.ok(e.get_last_loaded_dll_index() >= 0, 'WINMM fixture DLL actually mapped');
   e.mark_dll_initialized(base);
   assert.equal(e.guest_read32(base) & 0xffff, 0x5a4d);
   const pe = base + (e.guest_read32(base + 60) >>> 0);
   assert.equal(e.guest_read32(pe), 0x4550);
   const dir = base + (e.guest_read32(pe + 120) >>> 0);
   assert.equal(e.guest_read32(dir + 20), 1); assert.equal(e.guest_read32(dir + 24), 1);
   const names = base + (e.guest_read32(dir + 32) >>> 0);
   const np = base + (e.guest_read32(names) >>> 0);
   assert.equal(Buffer.from(Array.from({length: 15}, (_,i) => e.guest_read8(np+i))).toString(), 'timeGetDevCaps\0');
   const funcs = base + (e.guest_read32(dir + 28) >>> 0);
   const ords = base + (e.guest_read32(dir + 36) >>> 0);
   assert.equal(e.guest_read8(ords) | (e.guest_read8(ords+1)<<8), 0);
   const entry = base + (e.guest_read32(funcs) >>> 0);
   dv.setUint32(regs + 16, stack, true);
   assert.equal(e.tc_resolve(base, str('timeGetDevCaps')) >>> 0, entry, 'WINMM fixture public PE EAT == GPA');
   e.guest_write8(entry, 0xe9); e.guest_write32(entry+1, (thunk-entry-5) >>> 0);
   assert.equal((entry+5+(e.guest_read32(entry+1)|0))>>>0, thunk, 'real x86 JMP to API thunk');
   entries.set('timeGetDevCaps', {entry, nargs: 2}); continue;
  }
  const directory = mod + (e.guest_read32(nt + 120) >>> 0);
  const count = e.guest_read32(directory + 24) >>> 0;
  assert.ok(count > 0 && count < 4096, 'public named exports');
  const functions = mod + (e.guest_read32(directory + 28) >>> 0);
  const namesTable = mod + (e.guest_read32(directory + 32) >>> 0);
  const ordinals = mod + (e.guest_read32(directory + 36) >>> 0);
  for (const name of names) {
   dv.setUint32(regs + 16, stack, true);
   const entry = e.tc_resolve(mod, str(name)) >>> 0, row = apiTable.find(r => r.name === name);
   assert.ok(entry); assert.equal(row.convention, 'stdcall');
   let publicEntry = 0;
   for (let i = 0; i < count; i++) {
    const p = mod + (e.guest_read32(namesTable + i * 4) >>> 0);
    let exportedName = '';
    for (let j = 0; j < 128; j++) {
     const c = e.guest_read8(p + j); if (!c) break;
     exportedName += String.fromCharCode(c);
    }
    if (exportedName === name) {
     const ordinal = e.guest_read8(ordinals + i * 2) | (e.guest_read8(ordinals + i * 2 + 1) << 8);
     publicEntry = mod + (e.guest_read32(functions + ordinal * 4) >>> 0); break;
    }
   }
   assert.equal(entry, publicEntry, name + ' actual public PE export');
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
  const thread = e.tc_thread(); e.clear_yield(); e.set_eip(row.entry);
  for (let i = 0; i < 16 && e.get_eip(); i++) e.run(32);
  stats.calls++;
  if (name === 'timeGetDevCaps') assert.equal(e.get_eax() >>> 0, 0, name + ' EAX0');
  assert.equal(e.get_eip() >>> 0, 0, name + ' x86 return');
  assert.equal(e.get_esp() >>> 0, stack + 4 + args.length * 4, name + ' ESP (timeGetDevCaps +12)');
  assert.equal(e.tc_thread(), thread, name + ' thread');
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
 assert.equal(wa(0), 0xf0, 'existing NULL physical sentinel');
 spans.push([0xb0, 160]);
 const views = spans.map(([p, n]) => Buffer.from(memory.buffer, p, n));
 const expected = views.map(b => Buffer.alloc(b.length));
 // The oracle routes bytes using this independent page map, never guest_read,
 // guest_write, a production struct helper, or the handler's packing logic.
 const physical = g => pages.get(g & ~4095) + (g & 4095);
 const put = (g, v) => { mem[physical(g)] = v; };
 const publish = (g, backing) => {
  assert.equal(e.tc_alias(g, pages.get(backing)), 1);
  pages.set(g, pages.get(backing)); assert.equal(wa(g), pages.get(g));
 };
 publish(alias, separate); publish(alias + 4096, separate);

 // Independent literal TIMECAPS DWORDs [1, 1000000]. Oracle byte routing
 // uses the independent page map and never production guest memory helpers.
 const literal = Buffer.from('0100000040420f00', 'hex');
 assert.equal(literal.length, 8);
 const caps = [0,1,2,3,4,5,6,7,8,9,0x7fffffff,0x80000000,0xfffffffe,0xffffffff];
 function query(p, cap, label, mapped) {
  views.forEach(b => b.fill(0xa7)); views.forEach((b,i) => b.copy(expected[i]));
  if (p !== 0 && (cap >>> 0) >= 8) for (let i=0;i<8;i++) {
   const addr=physical((p+i)>>>0);
   const j=spans.findIndex(([start,n]) => addr>=start && addr<start+n);
   assert.ok(j>=0); expected[j][addr-spans[j][0]]=literal[i];
  }
  e.tc_seed_error(0x87654321); call('timeGetDevCaps', [p,cap]); stats.queries++;
  let failure=(e.tc_error()>>>0)!==0x87654321;
  for(let i=0;i<views.length;i++) if(!views[i].equals(expected[i])) failure=true;
  if(failure) {
   stats[mapped?'mappingFailures':'controlFailures']++;
   if(stats.examples.length<8)stats.examples.push({p,cap,label});
  }
  assert.equal(e.guest_span_cursor_bytes(),0); assert.equal(e.guest_span_overflow_count(),0);
 }
 // All 4096 phases, every cut within/between both DWORDs, for every capacity.
 for(const [base,mapped,label] of [[direct,false,'direct'],[adjacent,false,'adjacent'],
  [separate,true,'separate'],[alias,true,'alias']])
  for(let phase=0;phase<4096;phase++)for(const cap of caps) query(base+phase,cap,label+'/'+phase,mapped);
 for(const cap of caps)query(0,cap,'NULL',false);
 for(const [a,b] of [[reuse,separate],[separate+4096,reuse],[separate,reuse]]) {
  publish(alias,a);publish(alias+4096,b);
  for(let phase=0;phase<4096;phase++)for(const cap of [7,8,9,0x80000000,0xffffffff])
   query(alias+phase,cap,'remap/'+phase,true);
 }
 const old=wa(reuse);
 assert.equal(call('VirtualFree',[reuse,4096,0x4000]),1);
 assert.equal(call('VirtualAlloc',[reuse,4096,0x1000,4]),reuse);
 assert.equal(wa(reuse),old,'decommit/recommit reuse');
 assert.equal(call('VirtualFree',[reuse,0,0x8000]),1);commit(reuse,4096);
 assert.equal(wa(reuse),old,'release/reallocate reuse');
 publish(alias,reuse);publish(alias+4096,separate+4096);
 for(let phase=0;phase<4096;phase++)for(const cap of caps)query(alias+phase,cap,'reuse/'+phase,true);
 // No speculative access beyond the complete structure or on no-write paths.
 e.set_fault_unmapped(2);
 for(const cap of caps){query(reuse+4096-8,cap,'terminal',false);query(0,cap,'strict NULL',false);}
 for(let cap=0;cap<8;cap++) {
  query(reuse+4095,cap,'short terminal',false);
  query(0xffffffff,cap,'short unmapped',false);
 }
 e.set_fault_unmapped(0);
 console.log(JSON.stringify(stats));
 assert.equal(stats.controlFailures,0,'literal DWORDs, NULL/short no writes, lastError, EAX0, ESP12, registers and guards');
 if(expectParent) assert.ok(stats.mappingFailures>0,'fresh published parent fails mapping oracle');
 else assert.equal(stats.mappingFailures,0,'guest output and full backing guards');
 return stats;
}
if(require.main===module) run({expectParent:process.argv.includes('--expect-parent')})
 .catch(error=>{console.error(error);process.exitCode=1;});
module.exports={run,extraWat};
