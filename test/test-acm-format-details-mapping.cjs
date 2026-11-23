#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');
const apiTable = require('../src/api_table.json');
const { makeFixture } = require('../tools/kernel32-native-fixture');
// Existing policy: sixteen PCM formats, tags 0/1, low nibble query,
// ignored handle/cbStruct, null 87, unavailable 512, no error writes.
// Literal independent byte oracle; no source parsing or Wine reference.
const extraWat = String.raw`
 (func (export "mc_regs") (result i32) (global.get $reg_base))
 (func (export "mc_thread") (result i32) (global.get $current_thread_id))
 (func (export "mc_alias") (param i32 i32) (result i32)
  (call $guest_page_publish_range (local.get 0) (i32.const 4096)
   (local.get 1) (i32.const 4)))
 (func (export "mc_module") (param i32) (result i32)
  (call $handle_GetModuleHandleA (local.get 0) (i32.const 0) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "mc_resolve") (param i32 i32) (result i32)
  (call $handle_GetProcAddress (local.get 0) (local.get 1) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
`;

async function run({ expectParent = false, prebuiltModule = null } = {}) {
 let boundaryCalls = 0;
 const h = await bootRenderHarness({ ...(prebuiltModule ? { prebuiltModule } : { extraWat }), fonts: 'none', width: 8, height: 8,
  beforeInstantiate(ctx, host) {
   for (const [name, fn] of Object.entries(host)) if (typeof fn === 'function')
    host[name] = (...args) => { boundaryCalls++; return fn(...args); };
  } });
 const { exports: e, memory } = h;
 const fixture = makeFixture();
 new Uint8Array(memory.buffer).set(fixture, e.get_staging());
 assert.ok(e.load_pe(fixture.length), 'fresh actual PE load'); e.set_api_log(0);
 const mem = new Uint8Array(memory.buffer), dv = new DataView(memory.buffer);
 const regs = e.mc_regs() >>> 0, wa = p => e.guest_to_wasm(p) >>> 0;
 const alloc = n => { const p = e.guest_alloc(n) >>> 0; assert.ok(p); return p; };
 const read = (p, n) => Buffer.from(Array.from({ length: n }, (_, i) => mem[wa(p + i)]));
 const str = s => { const b = Buffer.from(s + '\0'), p = alloc(b.length);
  for (let i = 0; i < b.length; i++) mem[wa(p + i)] = b[i]; return p; };
 const stackBase = alloc(256), stack = stackBase + 64, entries = new Map();
 const stats = { calls: 0, queries: 0, comparisons: 0, mappingFailures: 0, controlFailures: 0, examples: [] };
 for (const [dll, names] of [
  ['MSACM32.DLL', ['acmFormatDetailsA', 'acmFormatDetailsW']], ['KERNEL32.DLL', ['VirtualAlloc', 'VirtualFree']],
 ]) {
  dv.setUint32(regs + 16, stack, true); const mod = e.mc_module(str(dll)) >>> 0; assert.ok(mod);
  assert.equal(e.guest_read32(mod) & 0xffff, 0x5a4d, dll + ' public PE module');
  for (const name of names) {
   dv.setUint32(regs + 16, stack, true);
   const stub = e.mc_resolve(mod, str(name)) >>> 0, row = apiTable.find(r => r.name === name);
   assert.ok(stub); assert.equal(row.convention, 'stdcall');
   if (dll === 'KERNEL32.DLL') assert.equal(e.guest_read8(stub), 0xe9, 'public PE JMP');
   const thunk = dll === 'KERNEL32.DLL' ? (stub + 5 + (e.guest_read32(stub + 1) | 0)) >>> 0 : stub;
   assert.equal(e.guest_read32(thunk + 4), row.id);
   entries.set(name, { entry: stub, nargs: row.nargs });
  }
 }
 function call(name, args) {
  const row = entries.get(name); assert.equal(args.length, row.nargs);
  mem.fill(0x6d, wa(stackBase), wa(stackBase) + 256);
  e.guest_write32(stack, 0); args.forEach((v, i) => e.guest_write32(stack + 4 + i * 4, v));
  const frame = read(stackBase, 256);
  const seed = [0x81234567, 0x12345678, 0x23456789, 0x3456789a, stack, 0x456789ab, 0x56789abc, 0x6789abcd];
  seed.forEach((v, i) => dv.setUint32(regs + i * 4, v, true));
  const thread = e.mc_thread();
  e.clear_yield(); e.set_eip(row.entry);
  for (let i = 0; i < 16 && e.get_eip(); i++) e.run(32);
  stats.calls++;
  assert.equal(e.get_esp() >>> 0, stack + 4 + args.length * 4, name + ' ESP');
  assert.equal(e.get_eip() >>> 0, 0, name + ' returned through x86 engine');
  assert.equal(e.mc_thread(), thread, name + ' current thread');
  for (const i of [1, 2, 3, 5, 6, 7]) assert.equal(dv.getUint32(regs + i * 4, true), seed[i], name + ' register ' + i);
  assert.deepEqual(read(stackBase, 256), frame, name + ' full stack guards');
  return e.get_eax() >>> 0;
 }
 const commit = (p, n) => assert.equal(call('VirtualAlloc', [p, n, 0x3000, 4]), p);
 const fragmented = 0x30000000, adjacent = 0x31000000, alias = 0x32000000;
 const decoys = [0x28000000, 0x28010000], replacement = 0x33000000;
 for (let i = 0; i < 2; i++) { commit(fragmented + i * 4096, 4096); commit(decoys[i], 4096); }
 commit(adjacent, 8192); commit(replacement, 4096);
 for (let i = 0; i < 2; i++) assert.equal(wa(decoys[i]), wa(fragmented + i * 4096) + 4096);
 assert.notEqual(wa(fragmented + 4096), wa(fragmented) + 4096);
 assert.equal(wa(adjacent + 4096), wa(adjacent) + 4096);
 const secondary = 0x34000000, secondaryDecoys = [0x29000000, 0x29010000];
 for (let i=0;i<2;i++) { commit(secondary+i*4096,4096); commit(secondaryDecoys[i],4096); }
 const direct = alloc(16384);
 const spans = [[wa(direct), 16384], [wa(fragmented), 4096], [wa(fragmented + 4096), 4096],
  ...decoys.map(p => [wa(p), 4096]), [wa(adjacent), 8192], [wa(replacement), 4096]];
 for(let i=0;i<2;i++) spans.push([wa(secondary+i*4096),4096],[wa(secondaryDecoys[i]),4096]);
 spans.push([0xf0, 128]); // NULL translation sentinel is also a no-write guard.
 const views = spans.map(([p, n]) => Buffer.from(memory.buffer, p, n));
 const saved = views.map(b => Buffer.alloc(b.length));
 const pristine = views.map((b, j) => Buffer.from(Array.from({ length: b.length },
  (_, i) => (i * 73 + (i >>> 8) * 29 + j * 41 + 0x53) & 255)));
 const physicalByte = new Map();
 spans.forEach(([p, n], j) => { for (let i = 0; i < n; i++) physicalByte.set(p + i, [j, i]); });
 function publish(g, p) { assert.equal(e.mc_alias(g, wa(p)), 1); assert.equal(wa(g), wa(p)); }
 publish(alias, fragmented); publish(alias + 4096, fragmented);
 assert.equal(wa(alias), wa(alias + 4096), 'actual shared physical page');
 function compare(a, b, label, bucket) {
  stats.comparisons++;
  if (Buffer.isBuffer(a) ? a.equals(b) : a === b) return;
  stats[bucket]++;
  if (stats.examples.length < 8) stats.examples.push({ label, bucket,
   actual: Buffer.isBuffer(a) ? a.toString('hex').slice(0, 240) : a,
   expected: Buffer.isBuffer(b) ? b.toString('hex').slice(0, 240) : b });
 }
 // Sixteen literal PCM records: complete WAVEFORMATEX bytes and exact names.
 const records = [
  ['01000100401f0000401f0000010008000000', '8.000 kHz, 8 Bit, Mono'],
  ['01000200401f0000803e0000020008000000', '8.000 kHz, 8 Bit, Stereo'],
  ['01000100401f0000803e0000020010000000', '8.000 kHz, 16 Bit, Mono'],
  ['01000200401f0000007d0000040010000000', '8.000 kHz, 16 Bit, Stereo'],
  ['01000100112b0000112b0000010008000000', '11.025 kHz, 8 Bit, Mono'],
  ['01000200112b000022560000020008000000', '11.025 kHz, 8 Bit, Stereo'],
  ['01000100112b000022560000020010000000', '11.025 kHz, 16 Bit, Mono'],
  ['01000200112b000044ac0000040010000000', '11.025 kHz, 16 Bit, Stereo'],
  ['010001002256000022560000010008000000', '22.050 kHz, 8 Bit, Mono'],
  ['010002002256000044ac0000020008000000', '22.050 kHz, 8 Bit, Stereo'],
  ['010001002256000044ac0000020010000000', '22.050 kHz, 16 Bit, Mono'],
  ['010002002256000088580100040010000000', '22.050 kHz, 16 Bit, Stereo'],
  ['0100010044ac000044ac0000010008000000', '44.100 kHz, 8 Bit, Mono'],
  ['0100020044ac000088580100020008000000', '44.100 kHz, 8 Bit, Stereo'],
  ['0100010044ac000088580100020010000000', '44.100 kHz, 16 Bit, Mono'],
  ['0100020044ac000010b10200040010000000', '44.100 kHz, 16 Bit, Stereo'],
 ];
 function query(p, w, wide, flags, index, tag, cbwfx, rate=22050, bits=16, ch=2, mapped=false, label='query', poison=false) {
  const bucket=mapped?'mappingFailures':'controlFailures';
  views.forEach((b,i)=>pristine[i].copy(b));
  if(poison) { // Physical decoys are initialized independently, before logical inputs.
   if(p) { dv.setUint32(wa(p)+4,15,true); dv.setUint32(wa(p)+8,1,true); dv.setUint32(wa(p)+16,direct+9000,true); dv.setUint32(wa(p)+20,18,true); }
   if(w) { dv.setUint16(wa(w)+2,1,true); dv.setUint32(wa(w)+4,8000,true); dv.setUint16(wa(w)+14,8,true); }
  }
  if(w) { e.guest_write32(w+4,rate); e.guest_write16(w+14,bits); e.guest_write16(w+2,ch); }
  if(p) { e.guest_write32(p,[0,1,23,24,151,152,279,280,0xffffffff][index%9]); e.guest_write32(p+4,index); e.guest_write32(p+8,tag); e.guest_write32(p+16,w); e.guest_write32(p+20,cbwfx); }
  views.forEach((b,i)=>b.copy(saved[i]));
  const loc=a=>{const v=physicalByte.get(wa(a));assert.ok(v,'oracle address guarded');return v;};
  const get=a=>{const[j,k]=loc(a);return saved[j][k];};
  const put=(a,v)=>{const[j,k]=loc(a);saved[j][k]=v;};
  const load=(a,n)=>{let v=0;for(let i=0;i<n;i++)v+=get(a+i)*2**(8*i);return v>>>0;};
  const store=(a,bytes)=>bytes.forEach((v,i)=>put(a+i,v));
  // Reads happen before any writes, including when buffers overlap or alias.
  let result=0, selected=0, wp=0, cb=0;
  if(!p) result=87;
  else {
   selected=load(p+4,4);wp=load(p+16,4);cb=load(p+20,4);
   const actualTag=load(p+8,4);
   if(actualTag!==0&&actualTag!==1)result=512;
   else if((flags&15)===0) { if(selected>=16)result=512; }
   else if(!wp)result=87;
   else {const r=load(wp+4,4),b=load(wp+14,2),c=load(wp+2,2);
    selected=(r>=44100?12:r>=22050?8:r>=11025?4:0)+(b>=16?2:0)+(c>=2?1:0);}
  }
  if(!result) {
   const [hex,name]=records[selected];
   if((flags&15)===0) {
    if(wp&&cb>=16) {const b=Buffer.from(hex,'hex');
     // Secondary WAVEFORMAT writes precede tag, support and name writes.
     for(const [o,n] of [[0,2],[2,2],[4,4],[8,4],[12,2],[14,2],...(cb>=18?[[16,2]]:[])]) store(wp+o,Array.from(b.subarray(o,o+n)));
    }
    store(p+8,[1,0,0,0]);
   }
   store(p+12,[4,0,0,0]);
   store(p+24,Array.from(Buffer.from(name+'\0')));
   if(wide) {store(p+24+name.length*2,[0,0]);for(let i=name.length-1;i>=0;i--)store(p+24+i*2,[get(p+24+i),0]);}
  }
  const before=boundaryCalls;
  compare(call(wide?'acmFormatDetailsW':'acmFormatDetailsA',[index&1?0xfedcba98:0,p,flags]),result,label+' return',bucket);
  assert.equal(boundaryCalls,before,'no host callbacks'); stats.queries++;
  for(let j=0;j<views.length;j++)compare(views[j],saved[j],label+' full backing '+j,bucket);
  assert.equal(e.guest_span_cursor_bytes(),0);assert.equal(e.guest_span_overflow_count(),0);
 }
 // Independent starting phases: either buffer can cross any field byte cut
 // while the other stays on a separate backing. Also controls for direct and
 // adjacent physical mappings, every format, A/W, and low-nibble selection.
 for(const [base,mapped] of [[direct,false],[adjacent,false],[fragmented,true],[alias,true]])
  for(let phase=0;phase<4096;phase++) for(const wide of [false,true]) {
   const i=phase%16;
   query(base+phase,secondary+128,wide,phase&1?0xa5a50000:0,i,i&1, [16,17,18][phase%3],22050,16,2,mapped,'struct/'+base+'/'+phase);
   query(direct+128,base+phase,wide,phase&1?0xfffffff2:1,0xffffffff,1,0, [0,11024,11025,22049,22050,44099,44100,0xffffffff][phase%8],phase&2?16:15,phase&4?2:1,mapped,'wave/'+phase);
  }
 const pcuts=[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,47,48,49,73];
 const wcuts=[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18];
 function cuts(label) {
  for(const pc of pcuts)for(const wc of wcuts)for(const wide of [false,true])for(let i=0;i<16;i++)
   for(const flags of [0,1,15]) query(alias+4096-pc,secondary+4096-wc,wide,flags,i,i&1,[0,15,16,17,18,0xffffffff][i%6], [0,11024,11025,22049,22050,44099,44100,0xffffffff][i%8],i&2?65535:0,i&1?65535:0,true,label);
 }
 cuts('independent cuts');
 for(const [a,b] of [[replacement,fragmented],[fragmented+4096,replacement],[fragmented,replacement]]) {
  publish(alias,a);publish(alias+4096,b);cuts('remap');
 }
 // Genuine physical overlap, including secondary fields overwriting struct
 // metadata and names. Literal oracle applies writes against shared bytes.
 for(const wide of [false,true])for(let i=0;i<16;i++)for(const delta of [-24,-16,-8,-4,0,4,8,12,16,20,24,28,32,48])
  for(const flags of [0,1,0xfffffff0,0xffffffff]) {
   query(direct+512,direct+512+delta,wide,flags,i,1,18,44100,16,2,false,'direct overlap');
   query(alias+4080,alias+4080+delta,wide,flags,i,1,18,44100,16,2,true,'mapped overlap');
  }
 const waveAlias=0x35000000;
 publish(waveAlias,fragmented);publish(waveAlias+4096,replacement);
 for(const wide of [false,true])for(let i=0;i<16;i++)for(const delta of [-24,-16,-8,-4,0,4,8,12,16,20,24,28,32,48])
  for(const flags of [0,1,0xfffffff0,0xffffffff])
   query(alias+4080,waveAlias+4080+delta,wide,flags,i,1,18,44100,16,2,true,'distinct guest physical overlap');
 const old=wa(replacement); assert.equal(call('VirtualFree',[replacement,0,0x8000]),1);commit(replacement,4096);assert.equal(wa(replacement),old);
 for(const wide of [false,true])for(let i=0;i<16;i++)for(const cb of [0,1,15,16,17,18,0xffffffff])
  query(replacement+64,secondary+4095,wide,0,i,i&1,cb,0,0,0,true,'reuse');
 for(const p of [0,direct+128,fragmented+4091])for(const w of [0,secondary+4093])for(const wide of [false,true])
  for(const flags of [0,1,2,3,15,16,17,0xfffffff0,0xffffffff])for(const i of [0,15,16,0x80000000,0xffffffff])for(const tag of [0,1,2,17,0xffffffff])
   query(p,w,wide,flags,i,tag,0,22050,16,2,p>=fragmented||w>=fragmented,'errors/policy');
 for(let bit=4;bit<32;bit++)for(let low=0;low<16;low++)for(const wide of [false,true])
  query(fragmented+4093,secondary+4093,wide,((2**bit)|low)>>>0,3,1,18,44100,16,2,true,'high flags',true);
 for(const rate of [0,1,7999,8000,11024,11025,11026,22049,22050,22051,44099,44100,44101,0x80000000,0xffffffff])
  for(const bits of [0,1,7,8,15,16,17,65535])for(const ch of [0,1,2,3,65535])for(const wide of [false,true])
   query(fragmented+4095,secondary+4095,wide,15,0xffffffff,0,0,rate,bits,ch,true,'thresholds');
 console.log(JSON.stringify(stats));
 assert.equal(stats.controlFailures,0,'direct/adjacent literal policy and ABI');
 if(expectParent)assert.ok(stats.mappingFailures>0,'fresh parent public MSACM32 mapping fails');
 else assert.equal(stats.mappingFailures,0,'guest struct and secondary transport');
 return stats;
}
if(require.main===module)run({expectParent:process.argv.includes('--expect-parent')}).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={run,extraWat};
