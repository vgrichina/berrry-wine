#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');
const { makeFixture } = require('../tools/kernel32-native-fixture');
const apiTable = require('../src/api_table.json');

// Public KERNEL32 PE EAT == GetProcAddress, followed by actual x86/thunk dispatch.
const extraWat = String.raw`
 (func (export "ld_error") (result i32) (global.get $last_error))
 (func (export "ld_seed_error") (param i32) (global.set $last_error (local.get 0)))
 (func (export "ld_regs") (result i32) (global.get $reg_base))
 (func (export "ld_thread") (result i32) (global.get $current_thread_id))
 (func (export "ld_alias") (param i32 i32) (result i32)
  (call $guest_page_publish_range (local.get 0) (i32.const 4096)
   (local.get 1) (i32.const 4)))
 (func (export "ld_module") (param i32) (result i32)
  (call $handle_GetModuleHandleA (local.get 0) (i32.const 0) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "ld_resolve") (param i32 i32) (result i32)
  (call $handle_GetProcAddress (local.get 0) (local.get 1) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
`;

async function run({ expectParent = false, moduleBytes = null } = {}) {
 const prebuiltModule = moduleBytes ? await WebAssembly.compile(moduleBytes) : null;
 const { exports: e, memory, hostCtx } = await bootRenderHarness({ extraWat: prebuiltModule ? '' : extraWat,
  prebuiltModule, fonts: 'none', width: 640, height: 480 });
 const fixture = makeFixture(); new Uint8Array(memory.buffer).set(fixture, e.get_staging());
 assert.ok(e.load_pe(fixture.length), 'fresh actual PE load'); e.set_api_log(0);
 const mem = new Uint8Array(memory.buffer), dv = new DataView(memory.buffer);
 const regs = e.ld_regs() >>> 0, wa = p => e.guest_to_wasm(p >>> 0) >>> 0;
 const alloc = n => { const p = e.guest_alloc(n) >>> 0; assert.ok(p); return p; };
 const str = s => { const b = Buffer.from(s + '\0'), p = alloc(b.length);
  b.forEach((v, i) => e.guest_write8(p + i, v)); return p; };
 const stackBase = alloc(256), stack = stackBase + 64, entries = new Map();
 const stats = { calls: 0, queries: 0, mappingFailures: 0, controlFailures: 0, examples: [] };
 for (const [dll, names] of [['KERNEL32.DLL', ['GetLogicalDriveStringsA', 'GetLogicalDriveStringsW', 'VirtualAlloc', 'VirtualFree']]]) {
  dv.setUint32(regs + 16, stack, true); const mod = e.ld_module(str(dll)) >>> 0; assert.ok(mod);
  assert.equal(e.guest_read32(mod) & 0xffff, 0x5a4d);
  const nt = mod + (e.guest_read32(mod + 0x3c) >>> 0);
  assert.equal(e.guest_read32(nt), 0x4550);
  const directory = mod + (e.guest_read32(nt + 120) >>> 0);
  const count = e.guest_read32(directory + 24) >>> 0;
  assert.ok(count > 0 && count < 4096, 'public named exports');
  const functions = mod + (e.guest_read32(directory + 28) >>> 0);
  const namesTable = mod + (e.guest_read32(directory + 32) >>> 0);
  const ordinals = mod + (e.guest_read32(directory + 36) >>> 0);
  for (const name of names) {
   dv.setUint32(regs + 16, stack, true);
   const entry = e.ld_resolve(mod, str(name)) >>> 0, row = apiTable.find(r => r.name === name);
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
  const thread = e.ld_thread(); e.clear_yield(); e.set_eip(row.entry);
  for (let i = 0; i < 16 && e.get_eip(); i++) e.run(32);
  stats.calls++;
  assert.equal(e.get_eip() >>> 0, 0, name + ' x86 return');
  assert.equal(e.get_esp() >>> 0, stack + 4 + args.length * 4, name + ' stdcall ESP');
  assert.equal(e.ld_thread(), thread, name + ' thread');
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
  assert.equal(e.ld_alias(g, pages.get(backing)), 1);
  pages.set(g, pages.get(backing)); assert.equal(wa(g), pages.get(g));
 };
 publish(alias, separate); publish(alias + 4096, separate);


 // Literal roots are independent of the production drive-mask loop. The VFS
 // assignment map is real host input; all output byte routing uses pages above.
 let literal, required;
 function query(name,p,cap,label,mapped) {
  const wide=name.endsWith('W'), payload=wide?Buffer.from(literal,'utf16le'):Buffer.from(literal,'latin1');
  const enough=(cap>>>0)>=required, writes=enough&&p!==0;
  views.forEach(b=>b.fill(0xa7)); views.forEach((b,i)=>b.copy(expected[i]));
  if(writes)for(let i=0;i<payload.length;i++) {
   const addr=physical((p+i)>>>0),j=spans.findIndex(([start,n])=>addr>=start&&addr<start+n);
   assert.ok(j>=0);expected[j][addr-spans[j][0]]=payload[i];
  }
  e.ld_seed_error(0x87654321);
  const actual=call(name,[cap,p]);stats.queries++;
  const want=!enough?required:p===0?0:required-1;
  let failure=actual!==want||(e.ld_error()>>>0)!==(enough&&p===0?87:0x87654321);
  for(let i=0;i<views.length;i++)if(!views[i].equals(expected[i]))failure=true;
  if(failure){stats[mapped?'mappingFailures':'controlFailures']++;if(stats.examples.length<8)stats.examples.push({name,p,cap,label,actual,want});}
  assert.equal(e.guest_span_cursor_bytes(),0);assert.equal(e.guest_span_overflow_count(),0);
 }
 const fixtures=[
  {assign:[],roots:['C:\\','D:\\']},
  {assign:['z','e','not-a-letter'],roots:['C:\\','D:\\','E:\\','Z:\\']},
  {assign:Array.from('zyxwvutsrqponmlkjihgfedcba'),roots:Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ',c=>c+':\\')}
 ];
 for(const f of fixtures){
  hostCtx.vfs.driveTypes=new Map(f.assign.map(c=>[c,3]));
  literal=f.roots.join('\0')+'\0\0'; required=literal.length;
  for(const name of ['GetLogicalDriveStringsA','GetLogicalDriveStringsW']){
   const n=required*(name.endsWith('W')?2:1),caps=[0,1,required-1,required,required+1,0x80000000,0xffffffff];
   for(const cap of caps)query(name,0,cap,'NULL',false);
   for(const [base,mapped,label] of [[direct,false,'direct'],[adjacent,false,'adjacent'],[separate,true,'separate'],[alias,true,'alias']]){
    for(let cut=0;cut<=n;cut++)for(const cap of caps)query(name,base+4096-cut,cap,label+'/cut'+cut,mapped);
    for(let phase=0;phase<4096;phase++)query(name,base+phase,required,label+'/phase'+phase,mapped);
   }
   for(const [a,b]of [[reuse,separate],[separate+4096,reuse],[separate,reuse]]){
    publish(alias,a);publish(alias+4096,b);
    for(let cut=0;cut<=n;cut++)for(const cap of caps)query(name,alias+4096-cut,cap,'remap/'+cut,true);
   }
  }
 }
 assert.equal(stats.controlFailures,0,JSON.stringify(stats));
 if(expectParent)assert.ok(stats.mappingFailures>0,'published parent must fail mapped output');
 else assert.equal(stats.mappingFailures,0,JSON.stringify(stats));
 console.log(JSON.stringify({expectParent,...stats}));return stats;
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={run,extraWat};
