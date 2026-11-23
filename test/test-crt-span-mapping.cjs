#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');
const { makeFixture } = require('../tools/kernel32-native-fixture');
const apiTable = require('../src/api_table.json');

// Setup exports only; all tested functions enter public GPA/PE/x86 JMP/API dispatch.
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
 const crtNames = ['strspn', 'strcspn', 'strpbrk', 'strtok'];
 const thunks = crtNames.map(name => {
  dv.setUint32(regs + 16, stack, true);
  const thunk = e.cc_resolve(e.get_image_base(), str(name)) >>> 0;
  const row = apiTable.find(r => r.name === name);
  assert.ok(thunk); assert.equal(row.convention, 'cdecl');
  assert.equal(row.nargs, 2);
  assert.equal(e.guest_read32(thunk + 4), row.id, name + ' actual GPA thunk ID');
  return thunk;
 });
 const dll = makeFixture(), opt = 0x98, base = e.get_next_dll_addr() >>> 0;
 const raw = rva => rva - 0x1000 + 0x200;
 dll.writeUInt16LE(0x210e, 0x96); dll.writeUInt32LE(0, opt + 16);
 dll.writeUInt32LE(base, opt + 28);
 dll.writeUInt32LE(0, opt + 104); dll.writeUInt32LE(0, opt + 108);
 dll.writeUInt32LE(4, raw(0x1100 + 20)); dll.writeUInt32LE(4, raw(0x1100 + 24));
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
 assert.equal(e.guest_read32(eat + 20), 4); assert.equal(e.guest_read32(eat + 24), 4);
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
  entries.set(name, {entry,nargs:2,cdecl:true});
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
 const pages=new Map(),spans=[],decoys=[];
 const register=(g,n)=>{for(let i=0;i<n;i+=4096)pages.set(g+i,wa(g+i));spans.push([wa(g),n]);};
 const commit=(g,n)=>{assert.equal(call('VirtualAlloc',[g,n,0x3000,4])>>>0,g);register(g,n);};
 const split=[0x30000000,0x31000000],adjacent=[0x32000000,0x33000000];
 const aliases=[0x34000000,0x35000000],reuse=0x36000000;
 for(let op=0;op<2;op++) {
  for(let page=0;page<2;page++) {
   commit(split[op]+page*4096,4096);
   const d=0x28000000+op*0x10000+page*0x2000;commit(d,4096);decoys.push(d);
   assert.equal(wa(d),wa(split[op]+page*4096)+4096,'physical scan decoy');
  }
  commit(adjacent[op],8192);
  assert.notEqual(wa(split[op]+4096),wa(split[op])+4096,'nonadjacent backing');
 }
 commit(reuse,4096);
 const direct=[0,1].map(()=>{const g=(alloc(12288)+4095)&~4095;register(g,8192);return g;});
 const physical=g=>pages.get((g>>>0)&~4095)+(g&4095);
 const put=(g,v)=>{const p=physical(g);assert.ok(Number.isFinite(p));mem[p]=v;};
 const publish=(g,backing)=>{assert.equal(e.cc_alias(g,pages.get(backing)),1);pages.set(g,pages.get(backing));assert.equal(wa(g),pages.get(g));};
 for(let op=0;op<2;op++)for(let page=0;page<2;page++)publish(aliases[op]+page*4096,split[op]+page*4096);
 const views=spans.map(([p,n])=>Buffer.from(memory.buffer,p,n));
 const guards=views.map(b=>Buffer.alloc(b.length));
 const bytes=s=>Array.from(Buffer.from(s,'latin1'));
 // Oracles use only literal arrays, never guest helpers or implementation code.
 function spanOracle(a,b) {
  let yes=0,no=0;while(yes<a.length&&b.includes(a[yes]))yes++;
  while(no<a.length&&!b.includes(a[no]))no++;
  return [yes,no,no<a.length?no:null];
 }
 function tokenOracle(a,b,cursor) {
  let i=cursor;while(i<a.length&&a[i]!==0&&b.includes(a[i]))i++;
  if(i===a.length||a[i]===0)return {offset:null,cursor:i,write:null};
  const offset=i;while(i<a.length&&a[i]!==0&&!b.includes(a[i]))i++;
  if(i<a.length&&a[i]!==0){a[i]=0;return {offset,cursor:i+1,write:i};}
  return {offset,cursor:i,write:null};
 }
 assert.deepEqual(spanOracle([65,66,67],[65,66]),[2,0,0]);
 assert.deepEqual(tokenOracle([44,65,44,66],[44],0),{offset:1,cursor:3,write:2});
 const cases=[
  [bytes('abcaX'),bytes('abc')], [bytes('XYZabc'),bytes('abc')],
  [bytes('abcabc'),bytes('abc')], [bytes('XYZ'),bytes('abc')],
  [[],bytes('abc')], [bytes('abc'),[]],
  [[0xff,0x80,65,0xfe],[0x80,0xff,65]], [bytes(',,ab;;cd,ef'),bytes(',;')],
 ];
 function reset(ap,bp,a,b) {
  views.forEach(v=>v.fill(0xa7));
  for(const d of decoys)mem.fill(0,physical(d),physical(d)+4096);
  for(const[p,v]of [[ap,a],[bp,b]])[...v,0].forEach((x,i)=>put(p+i,x));
  views.forEach((v,i)=>v.copy(guards[i]));
 }
 function record(name,label,mapped,got,expected,writesOK=true) {
  stats.queries++;
  if(got!==expected||!writesOK) {
   stats[mapped?'mappingFailures':'controlFailures']++;
   if(stats.examples.length<16)stats.examples.push({name,label,got,expected,writesOK});
   stats.byName[name]=(stats.byName[name]||0)+1;
  }
 }
 function guarded(name,args,expected,label,mapped,write=null) {
  e.cc_seed_error(0x87654321);const got=call(name,args)>>>0;
  assert.equal(e.cc_error()>>>0,0x87654321,'lastError');
  if(write!==null) {
   const p=physical(write);let found=false;
   for(let i=0;i<views.length;i++)if(p>=spans[i][0]&&p<spans[i][0]+spans[i][1]){guards[i][p-spans[i][0]]=0;found=true;}
   assert.ok(found,'expected write is within guarded input');
  }
  const writesOK=views.every((v,i)=>v.equals(guards[i]));
  record(name,label,mapped,got,expected>>>0,writesOK);
  assert.equal(e.guest_span_cursor_bytes(),0);assert.equal(e.guest_span_overflow_count(),0);
 }
 function query(ap,bp,a,b,label,mapped,token=true) {
  reset(ap,bp,a,b);const result=spanOracle(a,b);
  for(const[name,i]of [['strspn',0],['strcspn',1],['strpbrk',2]])
   guarded(name,[ap,bp],i===2?(result[2]===null?0:ap+result[2]):result[i],label,mapped);
  if(!token)return;
  reset(ap,bp,a,b);const oracle=a.slice();let cursor=0;
  // Full sequence, including repeated exhausted NULL continuation. Delimiters
  // change after the first token to exercise the delimiter argument each time.
  const changed=b.slice(0,1);
  for(let step=0;step<a.length+3;step++) {
   const delim=step?changed:b;
   [...delim,0].forEach((v,i)=>{put(bp+i,v);const p=physical(bp+i);for(let k=0;k<views.length;k++)if(p>=spans[k][0]&&p<spans[k][0]+spans[k][1])guards[k][p-spans[k][0]]=v;});
   const r=tokenOracle(oracle,delim,cursor);cursor=r.cursor;
   guarded('strtok',[step?0:ap,bp],r.offset===null?0:ap+r.offset,label+'/'+step,mapped,r.write===null?null:ap+r.write);
  }
 }
 stats.byName={};
 // Every phase for EACH operand in all layouts; sparse/direct combinations
 // isolate input and set translation failures independently.
 const layouts=[[direct,false,'direct'],[adjacent,false,'adjacent'],[split,true,'split'],[aliases,true,'alias'],[[direct[0],split[1]],true,'direct/split'],[[split[0],direct[1]],true,'split/direct']];
 for(const[bases,mapped,label]of layouts)for(let op=0;op<2;op++)for(let phase=0;phase<4096;phase++)for(const[a,b]of cases)
  query(bases[0]+(op===0?phase:128),bases[1]+(op===1?phase:128),a,b,label+'/'+op+'/'+phase,mapped);
 for(let b=1;b<256;b++)query(direct[0],direct[1],[b,b,127],[b], 'all unsigned bytes/'+b,false);
 // Identical operands are legal for readonly spans. Tokenization uses disjoint
 // guest aliases so mutations cannot silently change the delimiter oracle.
 query(aliases[0]+4094,aliases[0]+4094,[255,128],[255,128],'identical operands',true,false);
 for(const[a,b]of [[reuse,split[0]+4096],[split[0]+4096,reuse]]) {
  publish(aliases[0],a);publish(aliases[0]+4096,b);
  for(let phase=0;phase<4096;phase++)query(aliases[0]+phase,split[1]+4094,bytes(',,a;b,c'),bytes(',;'),'input remap/'+phase,true);
 }
 for(const[a,b]of [[reuse,split[1]+4096],[split[1]+4096,reuse]]) {
  publish(aliases[1],a);publish(aliases[1]+4096,b);
  for(let phase=0;phase<4096;phase++)query(split[0]+4094,aliases[1]+phase,bytes(',,a;b,c'),bytes(',;'),'set remap/'+phase,true);
 }
 const protectOut=alloc(4);
 for(const base of split)for(let page=0;page<2;page++)assert.equal(call('VirtualProtect',[base+page*4096,4096,2,protectOut]),1);
 for(let phase=0;phase<4096;phase++)for(let op=0;op<2;op++)query(split[0]+(op===0?phase:128),split[1]+(op===1?phase:128),bytes('abcaX'),bytes('abc'),'readonly/'+op+'/'+phase,true,false);
 for(const base of split)for(let page=0;page<2;page++)assert.equal(call('VirtualProtect',[base+page*4096,4096,4,protectOut]),1);
 e.set_fault_unmapped(2);
 for(const[a,b]of cases)query(reuse+4095-a.length,adjacent[1]+8191-b.length,a,b,'terminal NUL',false);
 // Empty input at its final byte must not walk input or delimiter successors.
 query(reuse+4095,adjacent[1]+8191,[],[],'empty final bytes',false);
 e.set_fault_unmapped(0);
 console.log(JSON.stringify(stats));
 assert.equal(stats.controlFailures,0,'independent JS oracle controls');
 if(expectParent){assert.ok(stats.mappingFailures>0,'fresh parent mapping failures');for(const n of crtNames)assert.ok(stats.byName[n]>0,n+' parent mapping failure');}
 else assert.equal(stats.mappingFailures,0,'all guest byte cursors map at each read');
 return stats;
}
if(require.main===module)run({expectParent:process.argv.includes('--expect-parent')}).catch(error=>{console.error(error);process.exitCode=1;});
module.exports={run,extraWat};

