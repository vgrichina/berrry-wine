#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');
const { makeFixture } = require('../tools/kernel32-native-fixture');
const apiTable = require('../src/api_table.json');

// Public contract: Microsoft CRT _stricmp/_strnicmp compare lowercase bytes;
// bounded comparison ends at count or NUL. Exact results below preserve this
// project's existing -1/0/1 and byte-difference contracts respectively.
// Setup exports only; comparison enters actual GPA/PE/x86 JMP/API dispatch.
// https://learn.microsoft.com/en-us/cpp/c-runtime-library/reference/stricmp-wcsicmp-mbsicmp-stricmp-l-wcsicmp-l-mbsicmp-l
// https://learn.microsoft.com/en-us/cpp/c-runtime-library/reference/strnicmp-wcsnicmp-mbsnicmp-strnicmp-l-wcsnicmp-l-mbsnicmp-l
const extraWat = String.raw`
 (func (export "cc_loadlib") (param i32) (result i32)
  (call $handle_LoadLibraryA (local.get 0) (i32.const 0) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "cc_error") (result i32) (global.get $last_error))
 (func (export "cc_seed_error") (param i32) (global.set $last_error (local.get 0)))
 (func (export "cc_regs") (result i32) (global.get $reg_base))
 (func (export "cc_thread") (result i32) (global.get $current_thread_id))
 (func (export "cc_alias") (param i32 i32) (result i32)
  (call $guest_page_publish_range (local.get 0) (i32.const 4096)
   (local.get 1) (i32.const 4)))
 (func (export "cc_module") (param i32) (result i32)
  (call $handle_GetModuleHandleA (local.get 0) (i32.const 0) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "cc_resolve") (param i32 i32) (result i32)
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
 const regs = e.cc_regs() >>> 0, wa = p => e.guest_to_wasm(p >>> 0) >>> 0;
 const alloc = n => { const p = e.guest_alloc(n) >>> 0; assert.ok(p); return p; };
 const str = s => { const b = Buffer.from(s + '\0'), p = alloc(b.length);
  b.forEach((v, i) => e.guest_write8(p + i, v)); return p; };
 const stackBase = alloc(256), stack = stackBase + 64, entries = new Map();
 const stats = { calls: 0, queries: 0, mappingFailures: 0, controlFailures: 0, examples: [] };
 // The EXE does not export these CRT names: GPA supplies built-in thunks.
 // A deterministic entryless DLL gives them explicit public PE EAT entries.
 const crtNames = ['_stricmp', '_strnicmp'];
 const thunks = crtNames.map(name => {
  dv.setUint32(regs + 16, stack, true);
  const thunk = e.cc_resolve(e.get_image_base(), str(name)) >>> 0;
  const row = apiTable.find(r => r.name === name);
  assert.ok(thunk); assert.equal(row.convention, 'cdecl');
  assert.equal(row.nargs, name === '_stricmp' ? 2 : 3);
  assert.equal(e.guest_read32(thunk + 4), row.id, name + ' actual GPA thunk ID');
  return thunk;
 });
 const dll = makeFixture(), opt = 0x98, base = e.get_next_dll_addr() >>> 0;
 const raw = rva => rva - 0x1000 + 0x200;
 dll.writeUInt16LE(0x210e, 0x96); dll.writeUInt32LE(0, opt + 16);
 dll.writeUInt32LE(base, opt + 28);
 dll.writeUInt32LE(0, opt + 104); dll.writeUInt32LE(0, opt + 108);
 dll.writeUInt32LE(2, raw(0x1100 + 20)); dll.writeUInt32LE(2, raw(0x1100 + 24));
 dll.writeUInt32LE(0x1160, raw(0x1100 + 32));
 dll.writeUInt32LE(0x1170, raw(0x1100 + 36));
 dll.fill(0, raw(0x1180), raw(0x1200)); dll.write('crtmap.dll\0', raw(0x1180));
 crtNames.forEach((name, i) => {
  dll.writeUInt32LE(0x2100 + i * 16, raw(0x1140) + i * 4);
  dll.writeUInt32LE(0x1190 + i * 32, raw(0x1160) + i * 4);
  dll.writeUInt16LE(i, raw(0x1170) + i * 2);
  dll.write(name + '\0', raw(0x1190 + i * 32));
  const entry = base + 0x2100 + i * 16;
  dll[raw(0x2100 + i * 16)] = 0xe9;
  dll.writeUInt32LE((thunks[i] - entry - 5) >>> 0, raw(0x2100 + i * 16) + 1);
 });
 mem.set(dll, e.get_staging()); assert.equal(e.load_dll(dll.length, base), 0);
 assert.ok(e.get_last_loaded_dll_index() >= 0); e.mark_dll_initialized(base);
 assert.equal(e.guest_read32(base) & 0xffff, 0x5a4d);
 const nt = base + e.guest_read32(base + 60); assert.equal(e.guest_read32(nt), 0x4550);
 const eat = base + e.guest_read32(nt + 120);
 assert.equal(e.guest_read32(eat + 20), 2); assert.equal(e.guest_read32(eat + 24), 2);
 crtNames.forEach((name, i) => {
  const namePtr = base + e.guest_read32(base + e.guest_read32(eat + 32) + i * 4);
  assert.equal(Buffer.from(Array.from({length:name.length + 1}, (_,j)=>e.guest_read8(namePtr+j))).toString(),name+'\0');
  const ordinalPtr = base + e.guest_read32(eat + 36) + i * 2;
  const ordinal = e.guest_read8(ordinalPtr) | e.guest_read8(ordinalPtr + 1) << 8;
  const entry = base + e.guest_read32(base + e.guest_read32(eat + 28) + ordinal * 4);
  dv.setUint32(regs + 16, stack, true);
  assert.equal(e.cc_resolve(base, str(name)) >>> 0, entry, name + ' actual GPA == public EAT');
  assert.equal(e.guest_read8(entry), 0xe9);
  assert.equal((entry + 5 + (e.guest_read32(entry+1)|0)) >>> 0, thunks[i]);
  entries.set(name, {entry,nargs:i+2,cdecl:true});
 });
 for (const name of ['VirtualAlloc','VirtualFree','VirtualProtect']) {
  dv.setUint32(regs+16,stack,true); const mod=e.cc_module(str('KERNEL32.DLL'))>>>0;
  assert.ok(mod); assert.equal(e.guest_read32(mod)&0xffff,0x5a4d);
  dv.setUint32(regs+16,stack,true); const entry=e.cc_resolve(mod,str(name))>>>0;
  assert.ok(entry); const row=apiTable.find(r=>r.name===name);
  const thunk=e.guest_read8(entry)===0xe9?(entry+5+(e.guest_read32(entry+1)|0))>>>0:entry;
  assert.equal(e.guest_read32(thunk+4),row.id);
  entries.set(name,{entry,nargs:row.nargs,cdecl:false});
 }
 function call(name,args) {
  const row=entries.get(name);assert.equal(args.length,row.nargs);
  mem.fill(0x6d,wa(stackBase),wa(stackBase)+256);
  e.guest_write32(stack,0);args.forEach((v,i)=>e.guest_write32(stack+4+i*4,v));
  const frame=Buffer.from(mem.subarray(wa(stackBase),wa(stackBase)+256));
  const seed=[0x81234567,0x12345678,0x23456789,0x3456789a,stack,0x456789ab,0x56789abc,0x6789abcd];
  seed.forEach((v,i)=>dv.setUint32(regs+i*4,v,true));
  const thread=e.cc_thread();e.clear_yield();e.set_eip(row.entry);
  for(let i=0;i<16&&e.get_eip();i++)e.run(32);
  stats.calls++;
  assert.equal(e.get_eip()>>>0,0,name+' x86 return');
  assert.equal(e.get_esp()>>>0,stack+4+(row.cdecl?0:args.length*4),name+' ESP');
  assert.equal(e.cc_thread(),thread,name+' thread');
  for(const i of [1,2,3,5,6,7])assert.equal(dv.getUint32(regs+i*4,true),seed[i],name+' register '+i);
  assert.deepEqual(mem.subarray(wa(stackBase),wa(stackBase)+256),new Uint8Array(frame),name+' stack guards');
  return e.get_eax()|0;
 }
 const pages=new Map(),spans=[];
 const register=(g,n)=>{for(let i=0;i<n;i+=4096)pages.set(g+i,wa(g+i));spans.push([wa(g),n]);};
 const commit=(g,n)=>{assert.equal(call('VirtualAlloc',[g,n,0x3000,4])>>>0,g);register(g,n);};
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
 const physical=g=>pages.get((g>>>0)&~4095)+(g&4095);
 const put=(g,v)=>{const p=physical(g);assert.ok(Number.isFinite(p));mem[p]=v;};
 const publish=(g,backing)=>{assert.equal(e.cc_alias(g,pages.get(backing)),1);pages.set(g,pages.get(backing));assert.equal(wa(g),pages.get(g));};
 for(let op=0;op<2;op++)for(let page=0;page<2;page++)publish(aliases[op]+page*4096,separate[op]+page*4096);
 const views=spans.map(([p,n])=>Buffer.from(memory.buffer,p,n));
 const guards=views.map(b=>Buffer.alloc(b.length));
 // Literal byte oracle: independent of all guest reads/string helpers.
 const fold=b=>b>=65&&b<=90?b+32:b;
 const oracle=(a,b,n)=>{for(let i=0;i<n;i++){const x=fold(a[i]||0),y=fold(b[i]||0);if(x!==y)return x-y;if(!x)return 0;}return 0;};
 const bytes=s=>Array.from(Buffer.from(s,'latin1'));
 const cases=[
  [bytes('AbCd!'),bytes('aBcD!'),8],
  [bytes('abcX'),bytes('ABCz'),8],
  [bytes('abcX'),bytes('ABCz'),3],
  [bytes('ABCz'),bytes('abcX'),8],
  [[0xc0,65,0xff],[0xe0,97,0xff],8],
  [[0xc0,65,0xff],[0xc0,97,0xff],8],
  [[65,0xc0],[97,0xe0],8],
  [[],[],3],
  [[],bytes('a'),2],
  [bytes('ab'),bytes('abC'),8],
  [bytes('@AZ[az{'),bytes('@az[az{'),3],
 ];
 assert.equal(oracle(bytes('A'),bytes('a'),2),0);
 assert.equal(oracle([255],[127],1),128);
 function query(ap,bp,a,b,count,label,mapped) {
  views.forEach(v=>v.fill(0xa7));
  for(const d of decoys)mem.fill(0,physical(d),physical(d)+4096);
  for(const[p,v]of [[ap,a],[bp,b]])[...v,0].forEach((x,i)=>put(p+i,x));
  views.forEach((v,i)=>v.copy(guards[i]));
  for(const name of crtNames) {
   const difference=oracle(a,b,name==='_stricmp'?Math.max(a.length,b.length)+1:count);
   const expected=name==='_stricmp'?Math.sign(difference):difference;
   e.cc_seed_error(0x87654321);
   const got=call(name,name==='_stricmp'?[ap,bp]:[ap,bp,count]);stats.queries++;
   assert.equal(e.cc_error()>>>0,0x87654321,'lastError');
   for(let i=0;i<views.length;i++)assert.ok(views[i].equals(guards[i]),'all input/decoy guards');
   if(got!==expected){stats[mapped?'mappingFailures':'controlFailures']++;if(stats.examples.length<12)stats.examples.push({name,label,ap,bp,got,expected});}
   assert.equal(e.guest_span_cursor_bytes(),0);assert.equal(e.guest_span_overflow_count(),0);
  }
 }
 // Both operands independently visit every 4K phase in each layout.
 for(const[bases,mapped,label]of [[direct,false,'direct'],[adjacent,false,'adjacent'],[separate,true,'split'],[aliases,true,'alias']])
  for(let op=0;op<2;op++)for(let phase=0;phase<4096;phase++)for(const[a,b,n]of cases)
   query(bases[0]+(op===0?phase:128),bases[1]+(op===1?phase:128),a,b,n,label+'/'+op+'/'+phase,mapped);
 for(let b=1;b<256;b++) {
  query(direct[0],direct[1],[b],[b],1,'all bytes equal',false);
  query(direct[0],direct[1],[b],[b>=65&&b<=90?b+32:b],1,'all bytes fold',false);
 }
 // Equal operand aliases, and changed page-table bindings on the next call.
 query(aliases[0]+4094,aliases[0]+4094,bytes('AbC'),bytes('AbC'),4,'same operand',true);
 for(const[a,b]of [[reuse,separate[0]+4096],[separate[0]+4096,reuse]]) {
  publish(aliases[0],a);publish(aliases[0]+4096,b);
  for(let phase=0;phase<4096;phase++)query(aliases[0]+phase,separate[1]+4094,bytes('AbCd!'),bytes('aBcD!'),6,'remap/'+phase,true);
 }
 const old=wa(reuse);
 assert.equal(call('VirtualFree',[reuse,4096,0x4000]),1);
 assert.equal(call('VirtualAlloc',[reuse,4096,0x1000,4])>>>0,reuse);assert.equal(wa(reuse),old);
 assert.equal(call('VirtualFree',[reuse,0,0x8000]),1);commit(reuse,4096);assert.equal(wa(reuse),old);
 publish(aliases[0],reuse);publish(aliases[0]+4096,separate[0]);
 for(let phase=0;phase<4096;phase++)query(aliases[0]+phase,separate[1]+4094,bytes('AbCd!'),bytes('aBcD!'),6,'reuse/'+phase,true);
 const protectOut=alloc(4);
 for(const base of separate)for(let page=0;page<2;page++)assert.equal(call('VirtualProtect',[base+page*4096,4096,2,protectOut]),1);
 for(let phase=0;phase<4096;phase++)for(let op=0;op<2;op++)query(separate[0]+(op===0?phase:128),separate[1]+(op===1?phase:128),bytes('AbCd!'),bytes('aBcD!'),6,'readonly/'+op+'/'+phase,true);
 for(const base of separate)for(let page=0;page<2;page++) {
  assert.equal(call('VirtualProtect',[base+page*4096,4096,2,protectOut]),1);
  assert.equal(e.guest_read32(protectOut),2,'read-only metadata remains unchanged');
 }
 e.set_fault_unmapped(2);
 // NUL and first difference at the last mapped byte must never read past it.
 for(const[a,b,n]of cases)query(reuse+4095-a.length,adjacent[1]+8191-b.length,a,b,n,'terminal NUL',false);
 e.cc_seed_error(0x87654321);
 assert.equal(call('_strnicmp',[0xffffffff,0xffffffff,0]),0,'zero count has no reads');
 assert.equal(e.cc_error()>>>0,0x87654321);
 // Nonterminated equal count ends precisely at an unmapped successor page.
 for(const g of [reuse+4095,adjacent[1]+8191])put(g,65);
 assert.equal(call('_strnicmp',[reuse+4095,adjacent[1]+8191,1]),0,'count ends before next page');
 put(reuse+4095,65);put(adjacent[1]+8191,90);
 assert.equal(call('_stricmp',[reuse+4095,adjacent[1]+8191]),-1,'first mismatch stops before next page');
 assert.equal(call('_strnicmp',[reuse+4095,adjacent[1]+8191,99]),-25,'bounded first mismatch stops before next page');
 e.set_fault_unmapped(0);
 console.log(JSON.stringify(stats));
 assert.equal(stats.controlFailures,0,'independent literal oracle and controls');
 if(expectParent)assert.ok(stats.mappingFailures>0,'fresh parent reproduces mapping failure');
 else assert.equal(stats.mappingFailures,0,'both CRT comparisons translate guest bytes');
 return stats;
}
if(require.main===module)run({expectParent:process.argv.includes('--expect-parent')}).catch(error=>{console.error(error);process.exitCode=1;});
module.exports={run,extraWat};
