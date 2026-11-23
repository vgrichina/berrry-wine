#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');
const { makeFixture } = require('../tools/kernel32-native-fixture');
const apiTable = require('../src/api_table.json');

// Inspection and mapping setup only. VirtualQuery executes via the actual
// KERNEL32 PE EAT, public GPA, stdcall thunk and x86 interpreter.
const extraWat = String.raw`
 (func (export "vq_error") (result i32) (global.get $last_error))
 (func (export "vq_seed_error") (param i32) (global.set $last_error (local.get 0)))
 (func (export "vq_regs") (result i32) (global.get $reg_base))
 (func (export "vq_thread") (result i32) (global.get $current_thread_id))
 (func (export "vq_alias") (param i32 i32) (result i32)
  (call $guest_page_publish_range (local.get 0) (i32.const 4096)
   (local.get 1) (i32.const 4)))
 (func (export "vq_module") (param i32) (result i32)
  (call $handle_GetModuleHandleA (local.get 0) (i32.const 0) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "vq_resolve") (param i32 i32) (result i32)
  (call $handle_GetProcAddress (local.get 0) (local.get 1) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
`;

async function run({ expectParent = false, moduleBytes = null } = {}) {
 const prebuiltModule = moduleBytes ? await WebAssembly.compile(moduleBytes) : null;
 const { exports: e, memory } = await bootRenderHarness({ extraWat: prebuiltModule ? '' : extraWat,
  prebuiltModule, fonts: 'none' });
 const fixture = makeFixture(); new Uint8Array(memory.buffer).set(fixture, e.get_staging());
 assert.ok(e.load_pe(fixture.length)); e.set_api_log(0);
 const mem = new Uint8Array(memory.buffer), dv = new DataView(memory.buffer);
 const regs = e.vq_regs() >>> 0, wa = p => e.guest_to_wasm(p >>> 0) >>> 0;
 const alloc = n => { const p = e.guest_alloc(n) >>> 0; assert.ok(p); return p; };
 const str = s => { const p = alloc(s.length + 1); Buffer.from(s + '\0').forEach((b,i)=>e.guest_write8(p+i,b)); return p; };
 const stackBase = alloc(256), stack = stackBase + 64, entries = new Map();
 dv.setUint32(regs+16,stack,true);
 const mod = e.vq_module(str('KERNEL32.DLL')) >>> 0;
 assert.ok(mod); assert.equal(e.guest_read32(mod)&0xffff,0x5a4d);
 const pe = mod + e.guest_read32(mod+0x3c), eat = mod + e.guest_read32(pe+0x78);
 const count=e.guest_read32(eat+24), names=mod+e.guest_read32(eat+32);
 const ords=mod+e.guest_read32(eat+36), funcs=mod+e.guest_read32(eat+28);
 const cstr = p => { let s=''; for(let i=0;i<256;i++){const b=e.guest_read8(p+i);if(!b)return s;s+=String.fromCharCode(b);}throw Error('unterminated export'); };
 for(const name of ['VirtualQuery','VirtualAlloc','VirtualFree','VirtualProtect']) {
  dv.setUint32(regs+16,stack,true);
  const entry=e.vq_resolve(mod,str(name))>>>0, row=apiTable.find(r=>r.name===name);
  let exported=0;
  for(let i=0;i<count;i++) if(cstr(mod+e.guest_read32(names+4*i))===name) {
   const ord=e.guest_read8(ords+2*i)|(e.guest_read8(ords+2*i+1)<<8);
   exported=(mod+e.guest_read32(funcs+4*ord))>>>0;
  }
  assert.equal(entry,exported,name+' honest PE EAT == GPA'); assert.ok(entry);
  const thunk=e.guest_read8(entry)===0xe9?(entry+5+(e.guest_read32(entry+1)|0))>>>0:entry;
  assert.equal(e.guest_read32(thunk+4),row.id,name+' thunk ID');
  assert.equal(row.convention,'stdcall'); entries.set(name,{entry,nargs:row.nargs});
 }
 const stats={calls:0,queries:0,mappingFailures:0,controlFailures:0,examples:[]};
 function call(name,args) {
  const row=entries.get(name); assert.equal(args.length,row.nargs);
  mem.fill(0x6d,wa(stackBase),wa(stackBase)+256);
  e.guest_write32(stack,0);args.forEach((v,i)=>e.guest_write32(stack+4+4*i,v));
  const frame=Buffer.from(mem.subarray(wa(stackBase),wa(stackBase)+256));
  const seed=[0x81234567,0x12345678,0x23456789,0x3456789a,stack,0x456789ab,0x56789abc,0x6789abcd];
  seed.forEach((v,i)=>dv.setUint32(regs+4*i,v,true));const thread=e.vq_thread();
  e.clear_yield();e.set_eip(row.entry);for(let i=0;i<16&&e.get_eip();i++)e.run(32);
  stats.calls++;assert.equal(e.get_eip()>>>0,0,name+' x86 return');
  assert.equal(e.get_esp()>>>0,stack+4+4*args.length,name+' stdcall ESP');
  assert.equal(e.vq_thread(),thread);
  for(const i of [1,2,3,5,6,7])assert.equal(dv.getUint32(regs+4*i,true),seed[i],name+' register '+i);
  assert.deepEqual(mem.subarray(wa(stackBase),wa(stackBase)+256),new Uint8Array(frame),name+' stack guards');
  return e.get_eax()>>>0;
 }
 const pages=new Map(),spans=[];
 const register=(g,n)=>{for(let i=0;i<n;i+=4096)pages.set(g+i,wa(g+i));spans.push([wa(g),n]);};
 const commit=(p,n)=>{assert.equal(call('VirtualAlloc',[p,n,0x3000,4]),p);register(p,n);};
 const separate=0x30000000,adjacent=0x31000000,alias=0x32000000,reuse=0x33000000;
 for(let i=0;i<2;i++){commit(separate+i*4096,4096);commit(0x28000000+i*0x10000,4096);}
 commit(adjacent,8192);commit(reuse,4096);
 assert.notEqual(wa(separate+4096),wa(separate)+4096,'nonadjacent backing');
 assert.equal(wa(adjacent+4096),wa(adjacent)+4096);
 const direct=(alloc(12288)+4095)&~4095;register(direct,8192);spans.push([0xf0,64]);
 const physical=g=>{assert.ok(pages.has(g&~4095));return pages.get(g&~4095)+(g&4095);};
 const publish=(g,b)=>{assert.equal(e.vq_alias(g,pages.get(b)),1);pages.set(g,pages.get(b));assert.equal(wa(g),pages.get(g));};
 publish(alias,separate);publish(alias+4096,separate);
 const views=spans.map(([p,n])=>Buffer.from(memory.buffer,p,n)),expected=views.map(b=>Buffer.alloc(b.length));
 // Literal existing image-header classification: independent of handler and
 // guest structure readers. This task changes transport, not Windows policy.
 const header=Buffer.from('00004000000040008000000000100000001000000200000000000001','hex');
 assert.equal(header.length,28);
 const seedError=0x87654321;
 function query(p,label,mapped,{address=0x400123,length=28,bytes=header,result=28,error=seedError}={}) {
  views.forEach(b=>b.fill(0xa7));views.forEach((b,i)=>b.copy(expected[i]));
  // The existing destination-validity g2w miss clears its four-byte sentinel.
  if(p===0x7f000000)expected[expected.length-1].fill(0,0,4);
  if(result)for(let i=0;i<bytes.length;i++){
   const a=physical(p+i),j=spans.findIndex(([s,n])=>a>=s&&a<s+n);
   assert.ok(j>=0);expected[j][a-spans[j][0]]=bytes[i];
  }
  e.vq_seed_error(seedError);const actual=call('VirtualQuery',[address,p,length]);stats.queries++;
  let failure=actual!==result||(e.vq_error()>>>0)!==error;
  for(let i=0;i<views.length;i++)if(!views[i].equals(expected[i]))failure=true;
  if(failure){stats[mapped?'mappingFailures':'controlFailures']++;if(!mapped||stats.examples.length<8)stats.examples.push({p,label,actual,result,error:e.vq_error()>>>0});}
  assert.equal(e.guest_span_cursor_bytes(),0);assert.equal(e.guest_span_overflow_count(),0);
 }
 // All byte phases include every cut inside and between all seven DWORDs.
 for(const [base,mapped,label] of [[direct,false,'direct'],[adjacent,false,'adjacent'],[separate,true,'separate'],[alias,true,'alias']])
  for(let phase=0;phase<4096;phase++)query(base+phase,label+'/'+phase,mapped);
 for(const [a,b] of [[reuse,separate],[separate+4096,reuse],[separate,reuse]]){
  publish(alias,a);publish(alias+4096,b);
  for(let phase=4068;phase<4096;phase++)query(alias+phase,'remap/'+phase,true);
 }
 for(const p of [direct,separate+4090,0]){
  query(p,'NULL/short',false,{length:27,result:0});
  if(p===0)query(p,'NULL',false,{result:0});
  else query(p,'kernel address',false,{address:0x80000000,result:0,error:87});
 }
 query(0x7f000000,'unmapped destination',false,{result:0,error:87});
 query(0,'NULL before address',false,{address:0x80000000,result:0});
 query(direct,'short before address',false,{address:0x80000000,length:0,result:0});
 // Existing sparse committed and reserved classifications, literal DWORDs.
 const sparse=Buffer.alloc(28);[reuse,reuse,4,4096,0x1000,4,0x20000].forEach((v,i)=>sparse.writeUInt32LE(v,4*i));
 query(separate+4093,'sparse',true,{address:reuse+123,bytes:sparse});
 const old=wa(reuse);assert.equal(call('VirtualFree',[reuse,4096,0x4000]),1);
 assert.equal(call('VirtualAlloc',[reuse,4096,0x1000,4]),reuse);assert.equal(wa(reuse),old);
 assert.equal(call('VirtualFree',[reuse,0,0x8000]),1);commit(reuse,4096);assert.equal(wa(reuse),old);
 publish(alias,reuse);publish(alias+4096,separate+4096);
 for(let phase=4068;phase<4096;phase++)query(alias+phase,'reuse/'+phase,true);
 e.set_fault_unmapped(2);query(reuse+4096-28,'terminal exact output',false);e.set_fault_unmapped(0);
 console.log(JSON.stringify(stats));assert.equal(stats.controlFailures,0,'literal output, policy, ABI, lastError and complete guards');
 if(expectParent)assert.ok(stats.mappingFailures>0,'published parent mapping regression');
 else assert.equal(stats.mappingFailures,0,'guest output and physical guards');
 return stats;
}
if(require.main===module)run({expectParent:process.argv.includes('--expect-parent')}).catch(error=>{console.error(error);process.exitCode=1;});
module.exports={run,extraWat};
