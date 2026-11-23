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
  ['MSACM32.DLL', ['acmFormatSuggest']], ['KERNEL32.DLL', ['VirtualAlloc', 'VirtualFree']],
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

 // Literal PCM wire bytes, indexed by channel/rate/bits. Output is never
 // derived from the implementation or a compiled helper.
 const pcm = new Map([
  ['1/11025/8','01000100112b0000112b0000010008000000'],
  ['2/11025/8','01000200112b000022560000020008000000'],
  ['1/11025/16','01000100112b000022560000020010000000'],
  ['2/11025/16','01000200112b000044ac0000040010000000'],
  ['1/22050/8','010001002256000022560000010008000000'],
  ['2/22050/8','010002002256000044ac0000020008000000'],
  ['1/22050/16','010001002256000044ac0000020010000000'],
  ['2/22050/16','010002002256000088580100040010000000'],
 ]);
 const formats = [
  '01000100112b0000112b000001000800a1b2',
  '01000200225600008858010004001000c3d4',
  // IMA mono/stereo and MS mono/stereo, 32 byte blocks.
  '11000100112b0000000000002000040002003900',
  '1100020022560000000000002000040002001900',
  '02000100112b0000000000002000040008003400010000010000',
  '0200020022560000000000002000040008001400010000010000',
  '03000100112b0000112b0000010008000000',
 ];
 function query(src,dst,flags=0,cb=18,kind=0,dch=2,drate=22050,dbits=16,dtag=1,mapped=false,label='query',mutate=null,poison=false) {
  const bucket=mapped?'mappingFailures':'controlFailures';
  views.forEach((b,i)=>pristine[i].copy(b));
  if(poison) for(const p of [src,dst])if(p){
   // Independent physically contiguous decoys disagree with logical inputs.
   dv.setUint16(wa(p),3,true);dv.setUint16(wa(p)+2,7,true);
   dv.setUint32(wa(p)+4,0,true);dv.setUint16(wa(p)+14,3,true);
  }
  const bytes=(p,b)=>{if(p)Array.from(b).forEach((v,i)=>e.guest_write8(p+i,v));};
  bytes(src,Buffer.from(formats[kind],'hex'));
  if(dst){e.guest_write16(dst,dtag);e.guest_write16(dst+2,dch);e.guest_write32(dst+4,drate);e.guest_write16(dst+14,dbits);}
  if(mutate&&src)e.guest_write16(src+mutate[0],mutate[1]);
  views.forEach((b,i)=>b.copy(saved[i]));
  const loc=a=>{const v=physicalByte.get(wa(a));assert.ok(v,'oracle address guarded');return v;};
  const get=a=>{const[j,k]=loc(a);return saved[j][k];};
  const put=(a,v)=>{const[j,k]=loc(a);saved[j][k]=v;};
  const load=(a,n)=>{let v=0;for(let i=0;i<n;i++)v+=get(a+i)*2**(8*i);return v>>>0;};
  const store=(a,b)=>Array.from(b).forEach((v,i)=>put(a+i,v));
  let result=0;
  if(!src||!dst||cb<16)result=11;
  else {
   const tag=load(src,2),c=load(src+2,2),r=load(src+4,4),b=load(src+14,2);
   let adpcm=false;
   if((tag===2||tag===17)&&c>=1&&c<=2&&b===4&&r!==0){
    const align=load(src+12,2),extra=load(src+16,2),samples=load(src+18,2),hdr=c*(tag===2?7:4);
    if(extra>=2&&align>hdr){
     if(tag===2){const coef=load(src+20,2);adpcm=extra>=4&&coef>=1&&coef<=256&&extra>=4+coef*4&&samples===Math.floor((align-hdr)*2/c)+2;}
     else adpcm=(align-hdr)%(c*4)===0&&samples===Math.floor((align-hdr)*2/c)+1;
    }
   }
   // Freeze eager pre-write reads, including both operands of each select.
   const dt=load(dst,2),dc=load(dst+2,2),dr=load(dst+4,4),db=load(dst+14,2);
   let oc,orr,ob;
   if(adpcm){
    if(((flags&0x10000)&&dt!==1)||((flags&0x20000)&&dc!==c)||((flags&0x40000)&&dr!==r)||((flags&0x80000)&&db!==8&&db!==16))result=512;
    oc=c;orr=r;ob=(flags&0x80000)&&db===8?8:16;
   }else{
    if(tag!==1||((flags&0x10000)&&dt!==1))result=512;
    oc=flags&0x20000?dc:c;orr=flags&0x40000?dr:r;ob=flags&0x80000?db:b;
    if((ob!==8&&ob!==16)||oc<1||oc>2||orr===0)result=512;
   }
   if(!result){
    const literal=pcm.get(oc+'/'+orr+'/'+(adpcm?16:ob));
    // Overlapping inputs can form arbitrary valid PCM rates. Pack their
    // integer wire representation independently, without guest helper calls.
    const le=(v,n)=>Array.from({length:n},(_,i)=>Math.floor((v>>>0)/2**(8*i))&255);
    const pack=bits=>Buffer.from([1,0,...le(oc,2),...le(orr,4),...le(Math.imul(orr,oc*(bits/8)),4),...le(oc*(bits/8),2),...le(bits,2),0,0]);
    const wire=literal?Buffer.from(literal,'hex'):pack(adpcm?16:ob);
    // Exact existing ordered stores, including helper's 16-bit baseline
    // followed by the three 8-bit overrides in the ADPCM branch.
    for(const[o,n]of [[0,2],[2,2],[4,4],[8,4],[12,2],[14,2],...(cb>=18?[[16,2]]:[])])store(dst+o,wire.subarray(o,o+n));
    if(adpcm&&ob===8){const eight=pcm.has(oc+'/'+orr+'/8')?Buffer.from(pcm.get(oc+'/'+orr+'/8'),'hex'):pack(8);for(const[o,n]of [[8,4],[12,2],[14,2]])store(dst+o,eight.subarray(o,o+n));}
   }
  }
  const before=boundaryCalls;
  compare(call('acmFormatSuggest',[0xfedcba98,src,dst,cb,flags]),result,label+' return',bucket);
  assert.equal(boundaryCalls,before,'no host callbacks');stats.queries++;
  for(let j=0;j<views.length;j++)compare(views[j],saved[j],label+' full physical backing '+j,bucket);
  assert.equal(e.guest_span_cursor_bytes(),0);assert.equal(e.guest_span_overflow_count(),0);
 }
 // All phases for BOTH buffers, all sixteen independent pin combinations,
 // on direct, adjacent, separate nonadjacent and actual aliased mappings.
 for(const[base,mapped]of [[direct,false],[adjacent,false],[fragmented,true],[alias,true]])
  for(let phase=0;phase<4096;phase++)for(let pin=0;pin<16;pin++){
   query(base+phase,secondary+128,pin<<16,[16,17,18][phase%3],phase&1,phase&2?1:2,phase&4?11025:22050,phase&8?8:16,1,mapped,'source phase');
   query(direct+128,base+phase,pin<<16,[16,17,18][phase%3],phase&1,phase&2?1:2,phase&4?11025:22050,phase&8?8:16,1,mapped,'destination phase');
  }
 for(let k=2;k<6;k++)for(let pin=0;pin<16;pin++)for(const bits of [8,16,4])for(const cb of [0,15,16,17,18])
  query(direct+64,direct+512,pin<<16,cb,k,k%2?2:1,k%2?22050:11025,bits,1,false,'ADPCM controls');
 const cuts=[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,25,26];
 function cutCases(label){for(const sc of cuts)for(const dc of cuts)for(let k=0;k<6;k++)for(const f of [0,0xf0000,0xfff0ffff])
  query(alias+4096-sc,secondary+4096-dc,f,[0,15,16,17,18][(sc+dc)%5],k,k%2?2:1,k%2?22050:11025,k%3?16:8,1,true,label,null,true);}
 cutCases('independent field cuts');
 for(const[a,b]of [[replacement,fragmented],[fragmented+4096,replacement],[fragmented,replacement]]){
  publish(alias,a);publish(alias+4096,b);cutCases('remap');
 }
 // Across-guest physical overlap and guest overlap apply the same ordered
 // byte stores to one physical oracle, preserving alias effects.
 const otherAlias=0x35000000;publish(otherAlias,fragmented);publish(otherAlias+4096,replacement);
 publish(alias,fragmented);publish(alias+4096,replacement);
 for(let k=0;k<7;k++)for(let delta=-24;delta<=24;delta++)for(let pin=0;pin<16;pin++){
  query(direct+512,direct+512+delta,pin<<16,18,k,1,11025,8,1,false,'guest overlap');
  query(alias+4080,otherAlias+4080+delta,pin<<16,18,k,1,11025,8,1,true,'physical alias overlap');
 }
 for(let k=0;k<7;k++)for(let pin=0;pin<16;pin++)for(const cb of [0,15,16,17,18])
  for(const src of [0,fragmented+4095])for(const dst of [0,secondary+4095])
   query(src,dst,pin<<16,cb,k,k%2?2:1,k%2?22050:11025,8,1,true,'null/cb/error');
 for(let bit=0;bit<32;bit++)if(bit<16||bit>19)for(let pin=0;pin<16;pin++)for(let k=0;k<6;k++)
  query(fragmented+4093,secondary+4093,((2**bit)|(pin<<16))>>>0,18,k,k%2?2:1,k%2?22050:11025,k&2?8:16,1,true,'unknown flag',null,true);
 for(let k=0;k<6;k++)for(let pin=0;pin<16;pin++)for(const dc of [0,1,2,3,65535])for(const db of [0,4,8,16,17,65535])for(const dt of [0,1,2,17,65535])
  query(fragmented+4095,secondary+4095,pin<<16,18,k,dc,0,db,dt,true,'invalid pins');
 for(let k=0;k<6;k++)for(const mutation of [[0,0],[0,65535],[2,0],[2,3],[4,0],[12,0],[12,7],[14,3],[16,0],[16,1],[16,3],[18,0],[18,1],[20,0],[20,257]])
  for(let pin=0;pin<16;pin++)query(fragmented+4095,secondary+4095,pin<<16,18,k,1,11025,16,1,true,'source validation',mutation);
 const old=wa(replacement);assert.equal(call('VirtualFree',[replacement,0,0x8000]),1);commit(replacement,4096);assert.equal(wa(replacement),old);
 for(let k=0;k<6;k++)for(let pin=0;pin<16;pin++)query(replacement+64,secondary+4095,pin<<16,18,k,1,11025,8,1,true,'public allocator reuse');
 console.log(JSON.stringify(stats));
 assert.equal(stats.controlFailures,0,'direct/adjacent literal policy and ABI');
 if(expectParent)assert.ok(stats.mappingFailures>0,'fresh parent public MSACM32 mapping fails');
 else assert.equal(stats.mappingFailures,0,'guest source and destination transport');
 return stats;
}
if(require.main===module)run({expectParent:process.argv.includes('--expect-parent')}).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={run,extraWat};
