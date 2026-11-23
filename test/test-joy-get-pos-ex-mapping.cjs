#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');
const apiTable = require('../src/api_table.json');

// Public JOYINFOEX: thirteen DWORDs, dwSize at +0 and dwFlags at +4.
// https://learn.microsoft.com/en-us/windows/win32/api/joystickapi/ns-joystickapi-joyinfoex
// https://learn.microsoft.com/en-us/windows/win32/api/joystickapi/nf-joystickapi-joygetposex
// The literal results below preserve the existing no-device policy, including
// accepting opaque nonzero flags; this is a transport test, not a driver test.
const extraWat = String.raw`
 (func (export "jx_init")
  (global.set $thunk_guest_base (i32.add (global.get $image_base)
   (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
  (call $update_thunk_end))
 (func (export "jx_regs") (result i32) (global.get $reg_base))
 (func (export "jx_alias") (param i32 i32) (result i32)
  (call $guest_page_publish_range (local.get 0) (i32.const 4096)
   (local.get 1) (i32.const 4)))
 (func (export "jx_module") (param i32) (result i32)
  (call $handle_GetModuleHandleA (local.get 0) (i32.const 0) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "jx_resolve") (param i32 i32) (result i32)
  (call $handle_GetProcAddress (local.get 0) (local.get 1) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "jx_call") (param i32)
  (global.set $eip (i32.const 0x456789ab))
  (call $win32_dispatch (i32.shr_u
   (i32.sub (local.get 0) (global.get $thunk_guest_base)) (i32.const 3))))
`;
// id, size, flags, result. Independent literals, including unsigned ID limits,
// size equality, each flags byte, opaque bits and validation precedence.
const vectors = [
 [0, 52, 0xff, 167], [15, 52, 1, 167], [1, 52, 0x100, 167],
 [7, 52, 0x10000, 167], [0, 52, 0x80000000, 167], [0, 52, 0xffffffff, 167],
 [0, 0, 0xff, 11], [0, 51, 0xff, 11], [0, 56, 0xff, 11],
 [0, 0xffffffff, 0xff, 11], [0, 52, 0, 11], [0, 0, 0, 11],
 [16, 52, 0xff, 2], [0xffffffff, 0, 0, 2], [0x80000000, 52, 1, 2],
];
async function run({ expectParent = false } = {}) {
 const { exports: e, memory } = await bootRenderHarness({ extraWat, fonts: 'none', width: 8, height: 8 });
 e.init_thread(1, 0x400000, 0, 0, 0, 0, 0); e.heap_init(0x800000); e.jx_init(); e.set_api_log(0);
 const mem = new Uint8Array(memory.buffer), dv = new DataView(memory.buffer);
 const regs = e.jx_regs() >>> 0, wa = p => e.guest_to_wasm(p) >>> 0;
 const alloc = n => { const p = e.guest_alloc(n) >>> 0; assert.ok(p); return p; };
 const put = (p, b) => { for (let i = 0; i < b.length; i++) mem[wa(p + i)] = b[i]; };
 const read = (p, n) => Buffer.from(Array.from({length:n}, (_, i) => mem[wa(p + i)]));
 const str = s => { const b = Buffer.from(s + '\0'), p = alloc(b.length); put(p, b); return p; };
 const stack = alloc(256) + 64, entries = new Map();
 const stats = {calls:0, queries:0, comparisons:0, transportFailures:0, controlFailures:0, examples:[]};
 for (const [dll, names] of [
  ['WINMM.DLL', ['joyGetPosEx']], ['KERNEL32.DLL', ['VirtualAlloc', 'VirtualFree']],
 ]) {
  dv.setUint32(regs + 16, stack, true); const mod = e.jx_module(str(dll)) >>> 0; assert.ok(mod);
  for (const name of names) {
   dv.setUint32(regs + 16, stack, true);
   const stub = e.jx_resolve(mod, str(name)) >>> 0, row = apiTable.find(r => r.name === name);
   assert.ok(stub); assert.equal(row.convention, 'stdcall');
   const thunk = dll === 'KERNEL32.DLL' ? (stub + 5 + (e.guest_read32(stub + 1) | 0)) >>> 0 : stub;
   if (dll === 'KERNEL32.DLL') assert.equal(e.guest_read8(stub), 0xe9);
   assert.equal(e.guest_read32(thunk + 4), row.id);
   entries.set(name, {thunk, nargs:row.nargs});
  }
 }
 function call(name, args) {
  const row = entries.get(name); assert.equal(args.length, row.nargs);
  mem.fill(0xb7, wa(stack - 32), wa(stack + 64));
  e.guest_write32(stack, 0x12345678); args.forEach((v, i) => e.guest_write32(stack + 4 + i * 4, v));
  const frame = read(stack - 32, 96);
  const seed = [0x81234567, 0x12345678, 0x23456789, 0x3456789a, stack, 0x456789ab, 0x56789abc, 0x6789abcd];
  seed.forEach((v, i) => dv.setUint32(regs + i * 4, v, true));
  e.jx_call(row.thunk); stats.calls++;
  assert.equal(e.get_esp() >>> 0, stack + 4 + args.length * 4, name + ' ESP');
  assert.equal(e.get_eip() >>> 0, 0x456789ab, name + ' EIP');
  for (const i of [1, 2, 3, 5, 6, 7]) assert.equal(dv.getUint32(regs + i * 4, true), seed[i], name + ' register ' + i);
  assert.deepEqual(read(stack - 32, 96), frame, name + ' full frame and guards');
  return e.get_eax() >>> 0;
 }
 const commit = (p, n) => assert.equal(call('VirtualAlloc', [p, n, 0x3000, 4]), p);
 // Raw numeric pointers remain in bounds so the parent failure is observable
 // without trapping. These raw locations are deliberately contradictory decoys.
 const direct = 0x05000000, adjacent = 0x18000000, separate = 0x18100000;
 const gap1 = 0x18200000, gap2 = 0x18300000, alias = 0x18400000, replacement = 0x18500000;
 commit(direct, 8192); commit(adjacent, 8192);
 for (const p of [separate, gap1, separate + 4096, gap2, replacement]) commit(p, 4096);
 assert.equal(wa(adjacent + 4096), wa(adjacent) + 4096);
 assert.equal(wa(gap1), wa(separate) + 4096);
 assert.notEqual(wa(separate + 4096), wa(separate) + 4096);
 assert.equal(e.jx_alias(alias, wa(separate)), 1);
 assert.equal(e.jx_alias(alias + 4096, wa(separate)), 1);
 assert.equal(wa(alias), wa(alias + 4096));
 const spans = [[wa(direct),8192], [wa(adjacent),8192], [wa(separate),4096],
  [wa(separate + 4096),4096], [wa(gap1),4096], [wa(gap2),4096], [wa(replacement),4096],
  ...[direct,adjacent,separate,alias,replacement].map(p => [p,8192])];
 for (let i = 0; i < spans.length; i++) for (let j = 0; j < i; j++)
  assert.ok(spans[i][0] + spans[i][1] <= spans[j][0] || spans[j][0] + spans[j][1] <= spans[i][0], 'independent physical guards');
 const views = spans.map(([p,n]) => Buffer.from(memory.buffer,p,n)), saved = views.map(b=>Buffer.alloc(b.length));
 function compare(actual, expected, label, bucket) {
  stats.comparisons++;
  if (Buffer.isBuffer(actual) ? actual.equals(expected) : actual === expected) return;
  stats[bucket]++;
  if (stats.examples.length < 12) stats.examples.push({label,
   actual:Buffer.isBuffer(actual) ? actual.toString('hex').slice(0,104) : actual,
   expected:Buffer.isBuffer(expected) ? expected.toString('hex').slice(0,104) : expected});
 }
 function query(p, v, label) {
  const [id,size,flags,result] = v;
  spans.forEach(([a,n],i) => mem.fill(0x90 + i,a,a+n));
  const header = Buffer.alloc(52);
  for (let i = 0; i < 52; i++) header[i] = (i * 37 + 19) & 255;
  header.writeUInt32LE(size,0); header.writeUInt32LE(flags,4); put(p,header);
  // Parent raw reads see valid input when the guest input is malformed, and
  // malformed input when the guest is valid. Physical and guest cannot agree
  // accidentally. Per-byte setup above does not use the gl32 under test.
  dv.setUint32(p,result === 167 ? 51 : 52,true);
  dv.setUint32(p+4,result === 167 ? 0 : 0xff,true);
  const logicalBefore = read(p,52);
  assert.deepEqual(logicalBefore,header,'independent guest fixture');
  views.forEach((b,i)=>b.copy(saved[i]));
  compare(call('joyGetPosEx',[id,p]),result,label+' result',id > 15 ? 'controlFailures' : 'transportFailures');
  compare(read(p,52),logicalBefore,label+' full JOYINFOEX','controlFailures');
  for (let i = 0; i < views.length; i++) compare(views[i],saved[i],label+' backing/decoy '+i,'controlFailures');
  assert.equal(e.guest_span_cursor_bytes(),0); assert.equal(e.guest_span_overflow_count(),0);
  stats.queries++;
 }
 // Every page phase includes every internal byte cut in BOTH input DWORDs,
 // and every byte of the unchanged 52-byte output structure across the edge.
 for (const base of [direct,adjacent,separate,alias]) for (let phase=0;phase<4096;phase++)
  for (const v of vectors) query(base+phase,v,[base,phase,v[0],v[1],v[2]].join('/'));
 // Every device ID at every explicit size/flags field byte cut.
 for (const base of [direct,adjacent,separate,alias]) for (let cut=0;cut<=8;cut++)
  for (let id=0;id<=16;id++) for (const v of [[id,52,0xff,id===16?2:167], [id,52,0,id===16?2:11]])
   query(base+4096-cut,v,'bytecut/'+[base,cut,id,v[2]]);
 // Real remapping of the SAME guest addresses, retaining the old physical
 // backing in the full-buffer guards. Exercise adjacent, separate and repeated
 // backing rather than calling a second guest pointer an alias.
 for (const [left,right] of [[adjacent,adjacent+4096],[replacement,separate+4096],[replacement,replacement]]) {
  assert.equal(e.jx_alias(alias,wa(left)),1); assert.equal(e.jx_alias(alias+4096,wa(right)),1);
  assert.equal(wa(alias),wa(left)); assert.equal(wa(alias+4096),wa(right));
  for (let phase=0;phase<4096;phase++) for (const v of vectors)
   query(alias+phase,v,'remap/'+[left,right,phase,v[0],v[1],v[2]]);
 }
 for (const [id,p,result] of [[0,0,11],[15,0,11],[16,0,2],[0xffffffff,0,2],
  [16,0xffffffff,2],[0xffffffff,0xffffffff,2]])
  assert.equal(call('joyGetPosEx',[id,p]),result,'ID/null precedence without pointer dereference');
 assert.equal(call('VirtualFree',[replacement,0,0x8000]),1); commit(replacement,4096);
 assert.equal(wa(replacement),spans[6][0]);
 for (const v of vectors) query(replacement+64,v,'public release/recommit');
 console.log(JSON.stringify(stats));
 assert.equal(stats.controlFailures,0,'ABI, error precedence and no-output-write controls');
 if (expectParent) assert.ok(stats.transportFailures>0,'fresh parent public WINMM thunk must expose raw-address failure');
 else assert.equal(stats.transportFailures,0,'guest-aware input transport');
 return stats;
}
if (require.main===module) run({expectParent:process.argv.includes('--expect-parent')}).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={run,extraWat};
