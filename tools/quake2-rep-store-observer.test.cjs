'use strict';
// Real shipped CPU, authored REP programs. No source transforms or test exports.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {hash}=require('./quake2-owning-load-witness.cjs');
const cpu=fs.readFileSync('build/wine-assembly.wasm'),mod=new WebAssembly.Module(cpu);
const pc=0x401000,stop=0x402000,base=0x500000,source=0x510000;
const names=['eip','esp','eax','ebx','ecx','edx','esi','edi','ebp','flag_op','flag_a','flag_b','flag_res','yield_reason'];
const fields=['on','pc','generation','invalid','limit',...['a','b'].flatMap(r=>['lo','hi','epoch','overflow','pc','address','width','host'].map(k=>r+'_'+k))];
function run(c,armed){
 const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
 const host=new Proxy({memory},{get:(o,k)=>k in o?o[k]:String(k).startsWith('beep_')?()=>0:()=>{throw Error('unexpected import '+String(k));}});
 const e=new WebAssembly.Instance(mod,{host}).exports;
 e.init_thread(0,0x400000,pc,0x7409000,0,0,0,0);e.set_esp(0x7408000);
 const mem=new Uint8Array(memory.buffer),wa=a=>e.guest_to_wasm(a)>>>0;
 for(let i=0;i<96;i++){mem[wa(base)+i]=0xa5;mem[wa(source)+i]=(17*i+7)&255;}
 if(c.overlap)for(let i=-4;i<96;i++)mem[wa(base+i)]=(29*i+131)&255;
 const dst=base+(c.cross?4094:0),src=c.overlap?dst+(c.df?c.w:-c.w):source;
 const d=dst+(c.df?(c.n-1)*c.w:0),s=src+(c.df?(c.n-1)*c.w:0);
 if(c.same && c.mov)for(let i=0;i<c.n*c.w;i++)mem[wa(dst+i)]=mem[wa(src+i)];
 // Independent byte expectations in x86 element order, including overlap.
 const expected=new Map();
 for(let i=0;i<c.n;i++){
  const at=d+(c.df?-1:1)*i*c.w,from=s+(c.df?-1:1)*i*c.w;
  const value=Array.from({length:c.w},(_,b)=>c.mov?(expected.has(from+b)?expected.get(from+b):mem[wa(from+b)]):((c.same?0xa5a5a5a5:0x12345678) >>> (8*b))&255);
  value.forEach((v,b)=>expected.set(at+b,v));
 }
 const code=[c.df?0xfd:0xfc,...(c.w===2?[0x66]:[]),0xf3,c.mov? (c.w===1?0xa4:0xa5):(c.w===1?0xaa:0xab)];
 mem.set([...code,0xeb,0xfe],wa(pc));
 e.set_eip(pc);e.set_instruction_watchpoint(pc+code.length);e.set_eax(c.same?0xa5a5a5a5:0x12345678);e.set_ecx(c.n);
 e.set_esi(c.n?s:0xdead0000);e.set_edi(c.n?d:0xdead1000);
 const receipt=()=>Object.fromEntries(fields.map((k,i)=>[k,e.native_store_get(i)>>>0]));
 if(armed)e.native_store_arm(dst,dst+Math.max(1,c.n*c.w),dst+1,dst+2,c.limit||0);
 for(let n=0;e.get_eip()!==pc+code.length;n++){assert(n<20,JSON.stringify({c,armed,eip:e.get_eip(),target:pc+code.length}));e.run(1);}
 const r=receipt();
 for(const [a,v] of expected)assert.equal(mem[wa(a)],v,'x86 ordered write at '+a.toString(16));
 assert.equal(e.get_ecx(),0);
 assert.equal(e.get_edi()>>>0,c.n?(d+(c.df?-1:1)*c.n*c.w)>>>0:0xdead1000);
 assert.equal(e.get_esi()>>>0,c.n?(s+(c.mov?(c.df?-1:1)*c.n*c.w:0))>>>0:0xdead0000);
 const state=Object.fromEntries(names.map(k=>[k,e['get_'+k]()>>>0]));
 const guest=hash(mem.subarray(wa(base)-16,wa(source)+128));
 if(armed){
  assert.equal(r.a_epoch,Math.min(c.n,c.limit||c.n));assert.equal(r.a_overflow,+(!!c.limit&&c.n>c.limit));
  assert.equal(r.invalid,0);assert.equal(r.a_host,0);assert.equal(r.b_epoch,c.n?1:0,'second overlapping range');
  if(c.n){assert.equal(r.a_pc,pc+1);assert.equal(r.a_address,d+(c.df?-1:1)*(c.n-1)*c.w);assert.equal(r.a_width,c.w);}
  // Rearm clears counts, changes generation, and the same cached REP records again.
  const gen=r.generation;e.native_store_arm(dst,dst+Math.max(1,c.n*c.w),0,0,0);
  assert.equal(receipt().a_epoch,0);assert.equal(receipt().generation,gen+1);
  e.set_eip(pc);e.set_ecx(c.n);e.set_esi(c.n?s:0xdead0000);e.set_edi(c.n?d:0xdead1000);
  for(let n=0;e.get_eip()!==pc+code.length;n++){assert(n<20,JSON.stringify({c,armed,eip:e.get_eip(),target:pc+code.length}));e.run(1);}
  assert.equal(receipt().a_epoch,c.n);
  e.init_thread(0,0x400000,pc,0x7409000,0,0,0,0);assert.equal(receipt().invalid,1);
  e.native_store_arm(dst,dst+4,0,0,0);assert.equal(receipt().invalid,1,'reset ABA remains invalid');
  e.native_store_arm(0,0,0,0,0);assert.equal(receipt().on,0);
 }else assert.equal(r.a_epoch,0);
 return {r,state,guest};
}
const results=[];
for(const w of [1,2,4])for(const df of [0,1])for(const mov of [false,true])for(const variant of ['ordinary','zero','cross','same','overflow',...(mov?['overlap']:[])]){
 const c={w,df,mov,n:variant==='zero'?0:3,cross:variant==='cross',same:variant==='same',limit:variant==='overflow'?2:0,overlap:variant==='overlap'};
 const off=run(c,false),on=run(c,true);
 assert.deepEqual(on.state,off.state,'architecture '+JSON.stringify(c));assert.equal(on.guest,off.guest,'memory '+JSON.stringify(c));
 results.push({c,receipt:on.r,guest:on.guest});
}
console.log(JSON.stringify({pass:true,cpuSHA:hash(cpu),results,coverage:'threaded REP MOVS/STOS B/W/D; observer guard disables optimized tiers',nativeQualification:false}));
