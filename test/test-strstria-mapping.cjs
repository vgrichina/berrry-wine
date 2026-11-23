#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');
const { makeFixture } = require('../tools/kernel32-native-fixture');
const apiTable = require('../src/api_table.json');

// Setup/inspection only: actual x86 enters a mapped SHLWAPI fixture PE export,
// checked against GetProcAddress, then JMPs to the built-in SHLWAPI API thunk.
// SHLWAPI has no built-in identity PE: assert the absent module and the
// actual LoadLibraryA EXE fallback, then use a clearly labeled local PE EAT.
const extraWat = String.raw`
 (func (export "ss_loadlib") (param i32) (result i32)
  (call $handle_LoadLibraryA (local.get 0) (i32.const 0) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "ss_error") (result i32) (global.get $last_error))
 (func (export "ss_seed_error") (param i32) (global.set $last_error (local.get 0)))
 (func (export "ss_regs") (result i32) (global.get $reg_base))
 (func (export "ss_thread") (result i32) (global.get $current_thread_id))
 (func (export "ss_alias") (param i32 i32) (result i32)
  (call $guest_page_publish_range (local.get 0) (i32.const 4096)
   (local.get 1) (i32.const 4)))
 (func (export "ss_module") (param i32) (result i32)
  (call $handle_GetModuleHandleA (local.get 0) (i32.const 0) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "ss_resolve") (param i32 i32) (result i32)
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
 const regs = e.ss_regs() >>> 0, wa = p => e.guest_to_wasm(p >>> 0) >>> 0;
 const alloc = n => { const p = e.guest_alloc(n) >>> 0; assert.ok(p); return p; };
 const str = s => { const b = Buffer.from(s + '\0'), p = alloc(b.length);
  b.forEach((v, i) => e.guest_write8(p + i, v)); return p; };
 const stackBase = alloc(256), stack = stackBase + 64, entries = new Map();
 const stats = { calls: 0, queries: 0, mappingFailures: 0, controlFailures: 0, examples: [], controlExamples: [] };
 for (const [dll, names] of [['SHLWAPI.DLL', ['StrStrIA']], ['KERNEL32.DLL', ['VirtualAlloc', 'VirtualFree', 'VirtualProtect']]]) {
  dv.setUint32(regs + 16, stack, true); let mod = e.ss_module(str(dll)) >>> 0;
  if(dll==='SHLWAPI.DLL'){assert.equal(mod,0,'no built-in SHLWAPI identity PE');dv.setUint32(regs+16,stack,true);mod=e.ss_loadlib(str(dll))>>>0;assert.equal(mod,e.get_image_base()>>>0,'actual LoadLibraryA fallback is EXE');}
  assert.ok(mod);
  assert.equal(e.guest_read32(mod) & 0xffff, 0x5a4d, dll + ' PE module');
  const nt = mod + (e.guest_read32(mod + 0x3c) >>> 0);
  assert.equal(e.guest_read32(nt), 0x4550, 'public PE signature');
  if (dll === 'SHLWAPI.DLL') {
   assert.ok(e.guest_read32(nt+120),'fallback EXE has its own fixture EAT, not SHLWAPI exports');
   dv.setUint32(regs + 16, stack, true);
   const thunk = e.ss_resolve(mod, str('StrStrIA')) >>> 0;
   const row = apiTable.find(r => r.name === 'StrStrIA');
   assert.ok(thunk); assert.equal(row.nargs, 2); assert.equal(row.convention, 'stdcall');
   assert.equal(e.guest_read32(thunk + 4), row.id, 'built-in SHLWAPI thunk ID');
   // Local deterministic DLL fixture: no imports or DllMain; one real EAT.
   const dllBytes = makeFixture(), opt = 0x98, base = e.get_next_dll_addr() >>> 0;
   dllBytes.writeUInt16LE(0x210e, 0x96); dllBytes.writeUInt32LE(0, opt + 16);
   dllBytes.writeUInt32LE(base, opt + 28);
   dllBytes.writeUInt32LE(0, opt + 104); dllBytes.writeUInt32LE(0, opt + 108);
   dllBytes.fill(0, 0x380, 0x3b0); dllBytes.write('shlwapi.dll\0', 0x380);
   dllBytes.write('StrStrIA\0', 0x390);
   mem.set(dllBytes, e.get_staging());
   assert.equal(e.load_dll(dllBytes.length, base), 0, 'entryless DLL');
   assert.ok(e.get_last_loaded_dll_index() >= 0, 'SHLWAPI fixture DLL actually mapped');
   e.mark_dll_initialized(base);
   assert.equal(e.guest_read32(base) & 0xffff, 0x5a4d);
   const pe = base + (e.guest_read32(base + 60) >>> 0);
   assert.equal(e.guest_read32(pe), 0x4550);
   const dir = base + (e.guest_read32(pe + 120) >>> 0);
   assert.equal(e.guest_read32(dir + 20), 1); assert.equal(e.guest_read32(dir + 24), 1);
   const names = base + (e.guest_read32(dir + 32) >>> 0);
   const np = base + (e.guest_read32(names) >>> 0);
   assert.equal(Buffer.from(Array.from({length: 9}, (_,i) => e.guest_read8(np+i))).toString(), 'StrStrIA\0');
   const funcs = base + (e.guest_read32(dir + 28) >>> 0);
   const ords = base + (e.guest_read32(dir + 36) >>> 0);
   assert.equal(e.guest_read8(ords) | (e.guest_read8(ords+1)<<8), 0);
   const entry = base + (e.guest_read32(funcs) >>> 0);
   dv.setUint32(regs + 16, stack, true);
   assert.equal(e.ss_resolve(base, str('StrStrIA')) >>> 0, entry, 'SHLWAPI fixture public PE EAT == GPA');
   e.guest_write8(entry, 0xe9); e.guest_write32(entry+1, (thunk-entry-5) >>> 0);
   assert.equal((entry+5+(e.guest_read32(entry+1)|0))>>>0, thunk, 'real x86 JMP to API thunk');
   entries.set('StrStrIA', {entry, nargs: 2}); continue;
  }
  const directory = mod + (e.guest_read32(nt + 120) >>> 0);
  const count = e.guest_read32(directory + 24) >>> 0;
  assert.ok(count > 0 && count < 4096, 'public named exports');
  const functions = mod + (e.guest_read32(directory + 28) >>> 0);
  const namesTable = mod + (e.guest_read32(directory + 32) >>> 0);
  const ordinals = mod + (e.guest_read32(directory + 36) >>> 0);
  for (const name of names) {
   dv.setUint32(regs + 16, stack, true);
   const entry = e.ss_resolve(mod, str(name)) >>> 0, row = apiTable.find(r => r.name === name);
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
  const thread = e.ss_thread(); e.clear_yield(); e.set_eip(row.entry);
  for (let i = 0; i < 16 && e.get_eip(); i++) e.run(32);
  stats.calls++;
  
  assert.equal(e.get_eip() >>> 0, 0, name + ' x86 return');
  assert.equal(e.get_esp() >>> 0, stack + 4 + args.length * 4, name + ' ESP (StrStrIA +12)');
  assert.equal(e.ss_thread(), thread, name + ' thread');
  for (const i of [1, 2, 3, 5, 6, 7]) assert.equal(dv.getUint32(regs + i * 4, true), seed[i], name + ' register ' + i);
  assert.deepEqual(mem.subarray(wa(stackBase), wa(stackBase) + 256), new Uint8Array(frame), name + ' stack guards');
  return e.get_eax() >>> 0;
 }
 const pages = new Map(), spans = [];
 const register = (g,n) => { for(let i=0;i<n;i+=4096)pages.set(g+i,wa(g+i));spans.push([wa(g),n]); };
 const commit = (g,n) => { assert.equal(call('VirtualAlloc',[g,n,0x3000,4]),g);register(g,n); };
 const separate=[0x30000000,0x31000000],adjacent=[0x32000000,0x33000000];
 const aliases=[0x34000000,0x35000000],reuse=0x36000000,decoys=[];
 for(let op=0;op<2;op++) {
  for(let page=0;page<2;page++) {
   commit(separate[op]+page*4096,4096);
   const d=0x28000000+op*0x10000+page*0x2000;commit(d,4096);decoys.push(d);
   assert.equal(wa(d),wa(separate[op]+page*4096)+4096,'physical scan decoy');
  }
  commit(adjacent[op],8192);
  assert.notEqual(wa(separate[op]+4096),wa(separate[op])+4096,'nonadjacent backing');
 }
 commit(reuse,4096);
 const direct=[0,1].map(()=>{const g=(alloc(12288)+4095)&~4095;register(g,8192);return g;});
 spans.push([0xb0,160]);assert.equal(wa(0),0xf0,'NULL sentinel');
 const views=spans.map(([p,n])=>Buffer.from(memory.buffer,p,n));
 const guards=views.map(b=>Buffer.alloc(b.length));
 const physical=g=>g===0?0xf0:pages.get((g>>>0)&~4095)+(g&4095);
 const put=(g,v)=>{const p=physical(g);assert.ok(Number.isFinite(p),'oracle mapped byte');mem[p]=v;};
 const publish=(g,backing)=>{assert.equal(e.ss_alias(g,pages.get(backing)),1);pages.set(g,pages.get(backing));assert.equal(wa(g),pages.get(g));};
 for(let op=0;op<2;op++)for(let page=0;page<2;page++)publish(aliases[op]+page*4096,separate[op]+page*4096);
 // Oracle operates only on fixture literals and integer indices, never guest
 // reads or a production string helper. Only ASCII uppercase folds.
 const fold=b=>b>=65&&b<=90?b+32:b;
 const oracle=(h,n)=>{
  if(!n.length)return 0;
  for(let i=0;i<h.length;i++)if(n.length<=h.length-i&&n.every((b,j)=>fold(b)===fold(h[i+j])))return i;
  return -1;
 };
 const bytes=s=>Array.from(Buffer.from(s,'latin1'));
 const cases=[
  [bytes('xxAbCaBc!'),bytes('aBc'),2],
  [bytes('aaaab'),bytes('AAB'),2],
  [bytes('abc'),bytes('abcd'),-1],
  [[0xc0,0x41,0xe0,0x61,0xff],[0xe0,0x41],2],
  [[0xc0,0x41],[0xe0,0x61],-1],
  [bytes('abc'),[],0],
  [[],bytes('a'),-1],
  [bytes('@AZ[az{'),bytes('@az['),0],
 ];
 for(const[h,n,index]of cases)assert.equal(oracle(h,n),index,'literal index oracle');
 function query(hp,np,h,n,label,mapped) {
  views.forEach(b=>b.fill(0xa7));
  for(const d of decoys)mem.fill(0,physical(d),physical(d)+4096);
  // Translation misses retain the runtime's four-byte zero sentinel.
  mem.fill(0,0xf0,0xf4);
  for(const[p,b]of [[hp,h],[np,n]]) {
   if(p===0||p===0xffffffff){assert.equal(b.length,0);continue;}
   [...b,0].forEach((v,i)=>put(p+i,v));
  }
  views.forEach((b,i)=>b.copy(guards[i]));
  const index=oracle(h,n),expected=index<0?0:(hp+index)>>>0;
  e.ss_seed_error(0x87654321);
  const got=call('StrStrIA',[hp,np]);stats.queries++;
  let failure=got!==expected||(e.ss_error()>>>0)!==0x87654321;
  for(let i=0;i<views.length;i++)if(!views[i].equals(guards[i]))failure=true;
  if(failure){if(!mapped)stats.controlExamples.push({hp,np,label,index,got,expected});stats[mapped?'mappingFailures':'controlFailures']++;if(stats.examples.length<12)stats.examples.push({hp,np,label,index,got,expected});}
  assert.equal(e.guest_span_cursor_bytes(),0);assert.equal(e.guest_span_overflow_count(),0);
 }
 // Each operand independently occupies all 4096 page phases; the other
 // operand stays on a different mapping. Every character and NUL cut occurs.
 for(const[bases,mapped,label]of [[direct,false,'direct'],[adjacent,false,'adjacent'],[separate,true,'split'],[aliases,true,'aliases']])
  for(let op=0;op<2;op++)for(let phase=0;phase<4096;phase++)for(const[h,n]of cases)
   query(bases[0]+(op===0?phase:128),bases[1]+(op===1?phase:128),h,n,label+'/'+op+'/'+phase,mapped);
 // Every byte value is literal: high bytes never acquire a case pairing.
 for(let b=1;b<256;b++) {
  query(direct[0],direct[1],[b],[b],'byte identity',false);
  const paired=b>=65&&b<=90?b+32:b>=97&&b<=122?b-32:b;
  query(direct[0],direct[1],[b],[paired],'ASCII pairing',false);
 }
 for(const[h,n]of cases) {
  if(!h.length)query(0,direct[1],h,n,'NULL hay sentinel',false);
  if(!n.length)query(direct[0],0,h,n,'NULL needle sentinel',false);
 }
 query(0,0,[],[],'both NULL',false);
 // Two guest operands alias the same physical bytes; first occurrence stays
 // a guest pointer. Page remapping is observed on the very next call.
 query(aliases[0]+4092,aliases[0]+4093,bytes('aBAB'),bytes('BAB'),'operand alias',true);
 for(const [a,b]of [[reuse,separate[0]+4096],[separate[0]+4096,reuse]]) {
  publish(aliases[0],a);publish(aliases[0]+4096,b);
  for(let phase=0;phase<4096;phase++)query(aliases[0]+phase,separate[1]+4094,bytes('xxAbCaBc!'),bytes('aBc'),'remap/'+phase,true);
 }
 const old=wa(reuse);
 assert.equal(call('VirtualFree',[reuse,4096,0x4000]),1);
 assert.equal(call('VirtualAlloc',[reuse,4096,0x1000,4]),reuse);assert.equal(wa(reuse),old);
 assert.equal(call('VirtualFree',[reuse,0,0x8000]),1);commit(reuse,4096);assert.equal(wa(reuse),old);
 publish(aliases[0],reuse);publish(aliases[0]+4096,separate[0]);
 for(let phase=0;phase<4096;phase++)query(aliases[0]+phase,separate[1]+4094,bytes('xxAbCaBc!'),bytes('aBc'),'reuse/'+phase,true);
 // Read-only strings: the page permission metadata must remain unchanged.
 const protectOut=alloc(4);
 for(const base of separate)for(let page=0;page<2;page++)assert.equal(call('VirtualProtect',[base+page*4096,4096,2,protectOut]),1);
 for(let phase=0;phase<4096;phase++)for(let op=0;op<2;op++)query(separate[0]+(op===0?phase:128),separate[1]+(op===1?phase:128),bytes('xxAbCaBc!'),bytes('aBc'),'readonly/'+op+'/'+phase,true);
 e.set_fault_unmapped(2);
 for(const[h,n]of cases) {
  query(reuse+4095-h.length,adjacent[1]+8191-n.length,h,n,'terminal hay+needle',false);
 }
 // NULL sentinel controls above use the normal translator policy; strict
 // unmapped mode intentionally traps NULL in the runtime.
 // Empty needle must return arg0 without translating an unmapped haystack.
 query(0xffffffff,direct[1],[],[],'empty needle unmapped hay',false);
 e.set_fault_unmapped(0);
 console.log(JSON.stringify(stats));
 assert.equal(stats.controlFailures,0,'literal/index, ASCII/highbytes, first/nomatch, NULL, ABI/lastError/full guards');
 if(expectParent)assert.ok(stats.mappingFailures>0,'published parent mapping failure');
 else assert.equal(stats.mappingFailures,0,'guest string mapping');
 return stats;
}
if(require.main===module)run({expectParent:process.argv.includes('--expect-parent')}).catch(error=>{console.error(error);process.exitCode=1;});
module.exports={run,extraWat};
