'use strict';
// Intel SDM Vol3A 12.2 Table12-2:
// ordinary MMX executes with TOP=0/all x87 tags valid; LOCK rejects first.
// Literal vectors test entry and preservation, not full opcode qualification.
// Successful destinations alias x87; faults and read-only operands preserve payloads.
const fs=require('fs'),a=require('assert/strict'),root=process.cwd();
const map=require(root+'/lib/region-map.generated');
const le=x=>[x&255,x>>>8&255,x>>>16&255,x>>>24];
const A=0x1010101010101010n,B=0x0101010101010101n;
// name, instruction, changed result (MM0 unless specified), memory operand
const vectors=[
 ['movq-rr',[0x0f,0x6f,0xc1],B],
 ['movq-out-rr',[0x0f,0x7f,0xc1],A,'mm1'],
 ['movd-in-rr',[0x0f,0x6e,0xc1],0x1234n],
 ['movd-out-rr',[0x0f,0x7e,0xc1],0x10101010,'ecx'],
 ['paddb-rr',[0x0f,0xfc,0xc1],0x1111111111111111n],
 ['pand-rr',[0x0f,0xdb,0xc1],0n],
 ['packsswb-rr',[0x0f,0x63,0xc1],0x7f7f7f7f7f7f7f7fn],
 ['punpcklbw-rr',[0x0f,0x60,0xc1],0x0110011001100110n],
 ['pcmpeqb-rr',[0x0f,0x74,0xc1],0n],
 ['psllw-variable',[0x0f,0xf1,0xc1],0n],
 ['psllw-immediate',[0x0f,0x71,0xf0,1],0x2020202020202020n],
 ['pmovmskb',[0x0f,0xd7,0xc8],0,'ecx'],
 ['pinsrw-rr',[0x0f,0xc4,0xc1,0],0x1010101010101234n],
 ['pextrw',[0x0f,0xc5,0xc8,0],0x1010,'ecx'],
 ['pshufw-rr',[0x0f,0x70,0xc1,0x1b],B],
 ['psadbw-rr',[0x0f,0xf6,0xc1],0x78n],
 ['maskmovq-zero',[0x0f,0xf7,0xc1],null],
 ['maskmovq-active',[0x0f,0xf7,0xc1],A,'maskStore'],
 ['movq-rm',[0x0f,0x6f,0x06],B,'mem'],
 ['movd-rm',[0x0f,0x6e,0x06],0x01010101n,'mem'],
 ['paddb-rm',[0x0f,0xfc,0x06],0x1111111111111111n,'mem'],
 ['pinsrw-rm',[0x0f,0xc4,0x06,0],0x1010101010100101n,'mem'],
 ['pshufw-rm',[0x0f,0x70,0x06,0x1b],B,'mem'],
 ['psadbw-rm',[0x0f,0xf6,0x06],0x78n,'mem'],
 ['movq-store',[0x0f,0x7f,0x07],A,'storeQ'],
 ['movd-store',[0x0f,0x7e,0x07],0x10101010,'storeD'],
 ['movntq-store',[0x0f,0xe7,0x07],A,'storeQ'],
];
// These are the exact supported recognizer bodies, not approximate loop shapes.
const copy=[0x0f,0x18,0x86,0x38,2,0,0,0x0f,0x6f,6,0x0f,0x6f,0x4e,8,0x0f,0x7f,7,0x0f,0x7f,0x4f,8,0x0f,0x6f,0x56,16,0x0f,0x6f,0x5e,24,0x0f,0x7f,0x57,16,0x0f,0x7f,0x5f,24,0x0f,0x6f,0x46,32,0x0f,0x6f,0x4e,40,0x0f,0x7f,0x47,32,0x0f,0x7f,0x4f,40,0x0f,0x6f,0x56,48,0x0f,0x6f,0x5e,56,0x0f,0x7f,0x57,48,0x0f,0x7f,0x5f,56,0x83,0xc6,64,0x83,0xc7,64,0x49,0x75,0xb2];
const stream=[0x0f,0x6f,6,0x0f,0x6f,0x4e,8,0x0f,0x6f,0x56,16,0x0f,0x6f,0x5e,24,0x0f,0x6f,0x66,32,0x0f,0x6f,0x6e,40,0x0f,0x6f,0x76,48,0x0f,0x6f,0x7e,56,0x83,0xc6,64,0x0f,0xe7,7,0x0f,0xe7,0x4f,8,0x0f,0xe7,0x57,16,0x0f,0xe7,0x5f,24,0x0f,0xe7,0x67,32,0x0f,0xe7,0x6f,40,0x0f,0xe7,0x77,48,0x0f,0xe7,0x7f,56,0x83,0xc7,64,0x48,0x75,0xb9];
const pipe=[0x0f,0x18,0x86,0x38,2,0,0,0x0f,0x6f,6,0x83,0xc7,64,0x0f,0x6f,0x4e,8,0x83,0xc6,64,0x0f,0x6f,0x56,0xd0,0x0f,0xe7,0x47,0xc0,0x0f,0x6f,0x46,0xd8,0x0f,0xe7,0x4f,0xc8,0x0f,0x6f,0x4e,0xe0,0x0f,0xe7,0x57,0xd0,0x0f,0x6f,0x56,0xe8,0x0f,0xe7,0x47,0xd8,0x0f,0x6f,0x46,0xf0,0x0f,0xe7,0x4f,0xe0,0x0f,0x6f,0x4e,0xf8,0x0f,0xe7,0x57,0xe8,0x0f,0xe7,0x47,0xf0,0x49,0x0f,0xe7,0x4f,0xf8,0x75,0xb1];
async function run(bytes){
 const mod=await WebAssembly.compile(bytes),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),imports={};
 for(const i of WebAssembly.Module.imports(mod))(imports[i.module]||={})[i.name]=i.kind==='memory'?memory:()=>0;
 const e=(await WebAssembly.instantiate(mod,imports)).exports,mem=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer),g=x=>e.guest_to_wasm(x)>>>0;
 const pe=fs.readFileSync(root+'/test/binaries/notepad.exe');mem.set(pe,e.get_staging());a(e.load_pe(pe.length));e.set_fault_unmapped(2);e.set_uop(0);
 const fp=map.BASE.FPU_FILE,xm=map.BASE.XMM_FILE,env=0xc01000,src=0xc08000,dst=0xc09000,stack=0x1108000;
 const regs=['eax','ecx','edx','ebx','esp','ebp','esi','edi'];let pc=0x1800200;const rows=[];
 const write=(at,code)=>code.forEach((b,i)=>e.guest_write8(at+i,b));
 function execute(at,code,budget=1){if(code)write(at,code);e.clear_yield();e.set_eip(at);e.run(budget);}
 function init(keepTier=false){
  if(!keepTier)e.set_uop(0);e.set_esp(stack);
  [0x77f,0x7d00,0xcccc].forEach((v,i)=>e.guest_write32(env+4*i,v));
  execute(0x180c000,[0xd9,0x25,...le(env),0xf4]);
  execute(0x180c080,[0x68,...le(0xad7),0x9d,0xf4]);
  regs.forEach((r,i)=>e['set_'+r](r==='esp'?stack:0x71000000+i*0x10001));
  for(let i=0;i<8;i++){e.set_mmx(i,i===0?A:i===1?B:BigInt(i));}
  mem.fill(0x5a,xm,xm+128);e.set_ecx(0x1234);e.set_esi(src);e.set_edi(dst);
  mem.fill(0x6b,g(src)-8,g(src)+80);mem.fill(0x6b,g(dst)-8,g(dst)+80);dv.setBigUint64(g(src),B,true);
 }
 function snap(){
  execute(0x180c100,[0xd9,0x3d,...le(env+32),0xf4]);
  return {top:e.get_fpu_top(),tag:e.get_fpu_tags(),sw:e.get_fpu_sw(),cw:e.guest_read32(env+32)&65535,flags:e.uop_flags(),gp:regs.map(r=>e['get_'+r]()>>>0),mm:Array.from({length:8},(_,i)=>BigInt.asUintN(64,e.get_mmx(i)).toString(16)),fp:Buffer.from(mem.subarray(fp,fp+128)).toString('hex'),xmm:Buffer.from(mem.subarray(xm,xm+128)).toString('hex')};
 }
 function check(name,before,after,issues=[]){
  if(after.top!==0)issues.push('TOP');if(after.tag!==255)issues.push('tag');
  for(const k of ['sw','cw','xmm'])if(after[k]!==before[k])issues.push('preserve '+k);
  const expectedFP=Buffer.from(before.fp,'hex');
  for(let i=0;i<8;i++)if(after.mm[i]!==before.mm[i]){
   const mant=BigInt('0x'+after.mm[i]);
   expectedFP.writeBigUInt64LE(mant===0n?0x8000000000000000n:(mant&0x7fffffffffffffffn)?0xfff8000000000000n:0xfff0000000000000n,8*i);
  }
  if(after.fp!==expectedFP.toString('hex'))issues.push('physical destination/neighbor/integer shadow bytes');
  rows.push({name,before,after,issues});return issues;
 }
 for(const [name,code,value,action]of vectors)for(const locked of [false,true]){
  const at=pc;pc+=128;write(at,[...(locked?[0xf0]:[]),...code,0xeb,0]);
  for(const cached of [false,true]){
   init();if(action==='maskStore')e.set_mmx(1,-1n);const before=snap(),want=structuredClone(before),m0=Buffer.from(mem.subarray(g(dst)-8,g(dst)+80));let trap=false;
   try{execute(at);}catch(err){a(err instanceof WebAssembly.RuntimeError);trap=true;}
   const next=e.get_eip()>>>0,after=snap(),issues=[];
   if(locked){if(!trap)issues.push('LOCK admitted');if(JSON.stringify(before)!==JSON.stringify(after))issues.push('LOCK mutation');}
   else{
    if(trap)issues.push('unexpected trap');
    if(value!==null){if(action==='ecx')want.gp[1]=value;else if(action==='mm1')want.mm[1]=value.toString(16);else if(action==='storeQ'||action==='maskStore')m0.writeBigUInt64LE(value,8);else if(action==='storeD')m0.writeUInt32LE(value,8);else want.mm[0]=value.toString(16);}
    if(after.flags!==before.flags)issues.push('flags');
    for(const k of ['gp','mm'])if(JSON.stringify(after[k])!==JSON.stringify(want[k]))issues.push(k+' result/preservation');
    if(next!==at+code.length+2)issues.push('consumption');
   }
   if(!Buffer.from(mem.subarray(g(dst)-8,g(dst)+80)).equals(m0))issues.push('memory/guards');
   if(locked)rows.push({name,locked,cached,before,after,issues});else check(name+' cached='+cached,before,after,issues);
  }
 }
 // Failed first access must not enter MMX. A zero MASKMOVQ mask suppresses
 // translation altogether. Trap mode is deterministic and never raises guest SEH.
 for(const [name,code,reg,mask]of [
  ['fault-loadQ',[0x0f,0x6f,6],'esi'],['fault-loadD',[0x0f,0x6e,6],'esi'],
  ['fault-binary',[0x0f,0xfc,6],'esi'],['fault-pinsrw',[0x0f,0xc4,6,0],'esi'],
  ['fault-pshufw',[0x0f,0x70,6,0],'esi'],['fault-psadbw',[0x0f,0xf6,6],'esi'],
  ['fault-storeQ',[0x0f,0x7f,7],'edi'],['fault-storeD',[0x0f,0x7e,7],'edi'],
  ['fault-mask',[0x0f,0xf7,0xc1],'edi',-1n],['zero-mask-unmapped',[0x0f,0xf7,0xc1],'edi',0n]]){
  init();e['set_'+reg](0xe0000000);if(mask!==undefined)e.set_mmx(1,mask);
  const at=pc;pc+=128;write(at,[...code,0xeb,0]);const before=snap();let trap=false;
  try{execute(at);}catch(err){a(err instanceof WebAssembly.RuntimeError);trap=true;}
  const after=snap(),issues=[];
  if(mask===0n){if(trap)issues.push('zero mask fault');check(name,before,after,issues);}
  else{if(!trap)issues.push('missing memory trap');if(JSON.stringify(before)!==JSON.stringify(after))issues.push('fault mutation');rows.push({name,before,after,issues});}
 }
 // Each lowering form: r/r binary, immediate, MOVD both ways, m64 load/store,
 // m32 load/store, memory arithmetic. Require actual installed-tier entry.
 for(const [body,value,action]of [[[0x0f,0xfc,0xc1],0x1212121212121212n],[[0x0f,0x71,0xf0,1],0x4040404040404040n],[[0x0f,0x6e,0xc0],0x71000000n],[[0x0f,0x7e,0xc0],0x10101010,'eax'],[[0x0f,0x6f,0x06],B],[[0x0f,0x7f,0x07],A,'storeQ'],[[0x0f,0x6e,0x06],0x01010101n],[[0x0f,0x7e,0x07],0x10101010,'storeD'],[[0x0f,0xfc,0x06],0x1212121212121212n]]){
  const at=pc;pc+=128;write(at,[...body,0x49,0x75,256-(body.length+3),0xc3]);
  init();e.set_ecx(2);e.set_uop(1);const program=e.uop_compile(at);a.equal(program,0,'MMX lowering must decline until image-aware');
  for(const cached of [false,true]){
   init(true);e.set_ecx(2);e.guest_write32(stack,0);const before=snap(),entered=e.uop_stats(4),want=structuredClone(before),wantMem=Buffer.from(mem.subarray(g(dst)-8,g(dst)+80));execute(at,null,100);const after=snap(),issues=[];
   want.gp[1]=0;want.gp[4]+=4;
   if(action==='eax')want.gp[0]=value;else if(action==='storeQ')wantMem.writeBigUInt64LE(value,8);else if(action==='storeD')wantMem.writeUInt32LE(value,8);else want.mm[0]=value.toString(16);
   for(const k of ['gp','mm'])if(JSON.stringify(after[k])!==JSON.stringify(want[k]))issues.push('uop '+k+' literal');
   if(after.flags!==19)issues.push('uop literal flags');
   if(!Buffer.from(mem.subarray(g(dst)-8,g(dst)+80)).equals(wantMem))issues.push('uop memory/guards');
   if(e.uop_stats(4)!==entered)issues.push('declined MMX unexpectedly entered uop');if(e.get_ecx()!==0)issues.push('loop count');
   check('uop '+body.join(',')+' cached='+cached,before,after,issues);
  }
 }
 // A lowered memory instruction that misses its window falls back before
 // its completion marker, including MOVD store's register staging operation.
 for(const [name,body,reg]of [['load',[0x0f,0x6f,6],'esi'],['storeD',[0x0f,0x7e,7],'edi']]){
  init();const at=pc;pc+=128;write(at,[...body,0x49,0x75,256-(body.length+3),0xc3]);e.set_uop(1);const program=e.uop_compile(at);a.equal(program,0,'faulting MMX lowering must decline');
  init(true);e.set_ecx(1);e['set_'+reg](0xe0000000);const before=snap(),entered=e.uop_stats(4);let trap=false;
  try{execute(at,null,100);}catch(err){a(err instanceof WebAssembly.RuntimeError);trap=true;}
  const after=snap(),issues=[];if(!trap)issues.push('missing uop memory trap');if(e.uop_stats(4)!==entered)issues.push('faulting declined MMX entered uop');if(JSON.stringify(before)!==JSON.stringify(after))issues.push('uop fault mutation');rows.push({name:'uop fault '+name,before,after,issues});
 }
 // A copy has executed MMX loads before a destination fault; fill has not
 // executed any MMX store when its first destination faults.
 for(const [name,body,fill]of [['copy',copy],['stream',stream],['pipeline',pipe],['fill',[0x0f,0x7f,7,0x83,0xc7,8,0x49,0x75,0xf7],true]]){
  init();e.set_mmx_copy64(1);e.set_loop_mmx_fill_emit(1);e.set_edi(0xe0000000);e.set_ecx(1);e.set_eax(1);const at=pc;pc+=256;write(at,[...body,0xc3]);const before=snap();let trap=false;
  try{execute(at,null,100);}catch(err){a(err instanceof WebAssembly.RuntimeError);trap=true;}
  const after=snap(),issues=[];if(!trap)issues.push('missing bulk fault');
  if(fill){if(after.top!==before.top||after.tag!==before.tag)issues.push('faulting fill entered');rows.push({name:'fault '+name,before,after,issues});}
  else check('fault after load '+name,before,after,issues);
 }
 // A completed fill store enters MMX even if a later page traps. Check both
 // the page-local bulk path and the slow path's first straddling qword.
 for(const unaligned of [false,true]){
  init();const page=0xe1000000+(unaligned?0x10000:0);
  a(e.test_virtual_map_commit(page,unaligned?8192:4096));
  const target=page+4096-(unaligned?4:8),at=pc;pc+=128;
  e.set_mmx_copy64(1);e.set_loop_mmx_fill_emit(1);e.set_edi(target);e.set_ecx(unaligned?514:2);
  write(at,[0x0f,0x7f,7,0x83,0xc7,8,0x49,0x75,0xf7,0xc3]);
  const before=snap(),runs=e.get_mmx_fill64_runs();let trap=false;
  try{execute(at,null,2000);}catch(err){a(err instanceof WebAssembly.RuntimeError);trap=true;}
  const after=snap(),issues=[];
  if(!trap)issues.push('missing later fill trap');
  if(e.get_mmx_fill64_runs()!==runs)issues.push('declined fill fold entered');
  if(dv.getBigUint64(g(target),true)!==A)issues.push('first fill store missing');
  check('fill later-page trap unaligned='+unaligned,before,after,issues);
 }
 // One or two lines are enough to distinguish each fused handler. Same
 // address is reentered with nonzero TOP: cached code cannot hide stale state.
 for(const [name,body,fill]of [['copy',copy],['stream',stream],['pipeline',pipe],['fill',[0x0f,0x7f,7,0x83,0xc7,8,0x49,0x75,0xf7],true]])for(const overlap of [false,true]){
  const at=pc;pc+=256;write(at,[...body,0xc3]);e.set_mmx_copy64(1);e.set_loop_mmx_fill_emit(1);
  for(const cached of [false,true]){
   init();const target=overlap?src+3:dst;
   // Uniform bytes make both forward overlap ordering and all final MMX
   // values literal, including the pipelined register allocation.
   mem.fill(0x10,g(src),g(src)+128);e.set_edi(target);e.set_ecx(1);e.set_eax(1);e.guest_write32(stack,0);
   const before=snap(),runs=fill?e.get_mmx_fill64_runs():e.entry_copy_runs?.(),wantGP=before.gp.slice(),wantMem=Buffer.from(mem.subarray(g(src)-8,g(dst)+80));execute(at,null,100);const after=snap(),issues=[];
   wantGP[4]+=4;wantGP[7]+=(fill?8:64);if(!fill)wantGP[6]+=64;
   wantGP[name==='stream'?0:1]=0;
   if(JSON.stringify(after.gp)!==JSON.stringify(wantGP))issues.push('bulk GPR literal');
   if(after.flags!==18)issues.push('bulk flags literal');
   wantMem.fill(0x10,g(target)-(g(src)-8),g(target)-(g(src)-8)+(fill?8:64));
   if(!Buffer.from(mem.subarray(g(src)-8,g(dst)+80)).equals(wantMem))issues.push('bulk memory/guards');
   if(runs!==undefined&&(fill?e.get_mmx_fill64_runs():e.entry_copy_runs())!==runs)issues.push('declined fold entered');
   if(!Buffer.from(mem.subarray(g(target),g(target)+(fill?8:64))).equals(Buffer.alloc(fill?8:64,0x10)))issues.push('bulk literal bytes');
   const changed=fill?0:name==='copy'?4:name==='stream'?8:3;
   for(let i=0;i<8;i++)if(after.mm[i]!== (i<changed?A.toString(16):before.mm[i]))issues.push('bulk MMX '+i);
   check(name+' overlap='+overlap+' cached='+cached,before,after,issues);
  }
 }
 // EMMS and SSE stay distinct, and harness set_mmx has no entry effect.
 init();const b=snap();e.set_mmx(0,42n);const s=snap();a.equal(s.top,b.top);a.equal(s.tag,b.tag);
 execute(pc,[0x0f,0x57,0xc0,0xeb,0]);a.equal(e.get_fpu_top(),b.top);a.equal(e.get_fpu_tags(),b.tag);
 execute(pc+32,[0x0f,0x6f,0xc1,0x0f,0x77,0xd9,0xe8,0xd8,0xc0,0xeb,0]);
 a.equal(e.get_fpu_top(),7);a.equal(e.get_fpu_tags(),128);a.equal(dv.getFloat64(fp+56,true),2);
 const failures=rows.filter(r=>r.issues.length),counts={};for(const r of failures)for(const i of r.issues)counts[i]=(counts[i]||0)+1;
 return {cases:rows.length,failures:failures.length,counts,rows};
}
module.exports={run,vectors};
if(require.main===module){const bytes=process.env.WINE_ASSEMBLY_WASM?fs.readFileSync(process.env.WINE_ASSEMBLY_WASM):require(root+'/test/compile-src').compileSrcWasm();run(bytes).then(r=>{if(process.env.MMX_ENTRY_RESULT)fs.writeFileSync(process.env.MMX_ENTRY_RESULT,JSON.stringify(r,null,2));console.log(JSON.stringify({cases:r.cases,failures:r.failures,counts:r.counts}));if(r.failures)process.exitCode=1;}).catch(err=>{console.error(err);process.exitCode=2;});}
