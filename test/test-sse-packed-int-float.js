'use strict';

// Intel SDM Vol.2A CVTPI2PS 3-281 (signed m64/MMX -> low two f32).
// https://cdrdv2-public.intel.com/671110/325383-sdm-vol-2abcd.pdf
// Intel 243191-002, 3-122 explicitly excludes memory from the x87 transition:
// https://www.c-jump.com/CIS77/reference/Intel/CIS77_24319102/pg_0162.htm
// SDM's general transition wording is refined by that form-specific text.
// Independently frozen integer inputs and literal binary32 expectations;
// integer zero produces positive zero, including a negative-zero-looking
// integer bit pattern (0x80000000 is INT32_MIN, not floating negative zero).
const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const le=x=>[x&255,x>>>8&255,x>>>16&255,x>>>24];
const vectors=[
 [[0x00000000,0x00000001],[0x00000000,0x3f800000]],
 [[0xffffffff,0x00000000],[0xbf800000,0x00000000]],
 [[0x00000002,0xfffffffe],[0x40000000,0xc0000000]],
 [[0x00ffffff,0xff000001],[0x4b7fffff,0xcb7fffff]],
 [[0x01000000,0xff000000],[0x4b800000,0xcb800000]],
 [[0x01000001,0xfeffffff],[0x4b800000,0xcb800000]],
 [[0x01000003,0xfefffffd],[0x4b800002,0xcb800002]],
 [[0x01000005,0xfefffffb],[0x4b800002,0xcb800002]],
 [[0x7fffffff,0x80000000],[0x4f000000,0xcf000000]],
 [[0x7fffff80,0x80000080],[0x4effffff,0xceffffff]],
 [[0x7fffffbf,0x80000041],[0x4effffff,0xceffffff]],
 [[0x7fffffc0,0x80000040],[0x4f000000,0xcf000000]],
 [[0x02000002,0xfdfffffe],[0x4c000000,0xcc000000]],
 [[0x02000006,0xfdfffffa],[0x4c000002,0xcc000002]],
];
const seal={oracleSha256:sha(JSON.stringify(vectors)),testSha256:sha(fs.readFileSync(__filename))};
// Setup/inspection only. The instruction itself always goes through the full
// decoder, including real 16-bit ModRM addressing and the 67 override.
const setup16=`
 (func (export "cvtpi_setup16") (param $input i32)
  (local $i i32)
  (loop $regs
   (call $xmm_set (local.get $i) (v128.load (call $g2w (i32.add (local.get $input) (i32.shl (local.get $i) (i32.const 4))))))
   (call $mmx_set (local.get $i) (call $gl64 (i32.add (local.get $input) (i32.add (i32.const 128) (i32.shl (local.get $i) (i32.const 3))))))
   (local.set $i (i32.add (local.get $i) (i32.const 1)))
   (br_if $regs (i32.lt_u (local.get $i) (i32.const 8))))
  (global.set $code16 (i32.const 1))
  (global.set $seg_base_cs (i32.const 0x1800000))
  (global.set $seg_base_ds (i32.const 0xc00000))
  (global.set $seg_base_ss (i32.const 0))
  (call $load_eflags (i32.const 0xad7)))
 (func (export "cvtpi_snapshot16") (param $out i32)
  (local $i i32)
  (loop $regs
   (v128.store (call $g2w (i32.add (local.get $out) (i32.shl (local.get $i) (i32.const 4)))) (call $xmm_get (local.get $i)))
   (call $gs64 (i32.add (local.get $out) (i32.add (i32.const 128) (i32.shl (local.get $i) (i32.const 3)))) (call $mmx_get (local.get $i)))
   (local.set $i (i32.add (local.get $i) (i32.const 1)))
   (br_if $regs (i32.lt_u (local.get $i) (i32.const 8)))))
 (func (export "cvtpi_top16") (result i32) (global.get $fpu_top))
 (func (export "cvtpi_tag16") (result i32) (global.get $fpu_tag))
 (func (export "cvtpi_flags16") (result i32) (call $build_eflags))
`;
if(process.env.FREEZE_ONLY){fs.writeFileSync(process.env.FREEZE_ONLY,JSON.stringify(seal,null,2));console.log(seal);}
else main().catch(err=>{console.error(err);process.exitCode=1;});
async function main(){
 const bytes=process.env.CVT_CODE16_ONLY
  ? require('./compile-src').compileSrcWasm((file,text)=>file==='13-exports.wat'?text+'\n'+setup16:text)
  : process.env.WINE_ASSEMBLY_WASM?fs.readFileSync(process.env.WINE_ASSEMBLY_WASM):require('./compile-src').compileSrcWasm();
 const mod=await WebAssembly.compile(bytes),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),imports={};
 for(const i of WebAssembly.Module.imports(mod)){
  assert(['memory','function'].includes(i.kind));(imports[i.module]||={})[i.name]=i.kind==='memory'?memory:()=>0;
 }
 const e=(await WebAssembly.instantiate(mod,imports)).exports,mem=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer),g=a=>e.guest_to_wasm(a)>>>0;
 const pe=fs.readFileSync('test/binaries/notepad.exe');mem.set(pe,e.get_staging());assert(e.load_pe(pe.length));
 if(process.env.CVT_CODE16_ONLY){
  const failures=[];let count=0,failed=0;
  for(let row=0;row<vectors.length;row++)for(let dst=0;dst<8;dst++)for(const form of ['rr','abs16','bxsi','addr32'])
  for(let src=0;src<(form==='rr'?8:1);src++)for(let repeat=0;repeat<2;repeat++){
   const [source,want]=vectors[row],input=0xc02000,out=0xc03000,b=0xc01000,pc=0x1800200;
   const xmm=Array.from({length:8},(_,i)=>[0x12340000+i,0xabcd0000+i,0x7f812345,0xffc54321]);
   const mm=Array.from({length:8},(_,i)=>[0x11110000+i,0x22220000+i]);mm[src]=source;
   const expected=xmm.map(x=>x.slice());expected[dst]=[...want,...xmm[dst].slice(2)];
   [...xmm.flat(),...mm.flat()].forEach((x,i)=>e.guest_write32(input+4*i,x));source.forEach((x,i)=>e.guest_write32(b+4*i,x));
   const operand=form==='rr'?[0xc0|dst<<3|src]:form==='abs16'?[6|dst<<3,0,16]:form==='bxsi'?[0x40|dst<<3,16]:[5|dst<<3,...le(0x1000)];
   const instruction=[...(form==='addr32'?[0x67]:[]),0x0f,0x2a,...operand];
   const code=[0xdb,0xe3,0xd9,0xe8,...instruction,...instruction,0xf4];
   if(!repeat)code.forEach((x,i)=>e.guest_write8(pc+i,x));
   e.cvtpi_setup16(input);e.set_ebx(0xfd0);e.set_esi(0x20);e.set_esp(0x1100000);e.clear_yield();e.set_eip(pc);
   let issue;try{e.run(1);e.cvtpi_snapshot16(out);
    const read=(a,n)=>Array.from({length:n},(_,i)=>e.guest_read32(a+4*i)>>>0);
    if(JSON.stringify(read(out,32))!==JSON.stringify(expected.flat()))issue='XMM';
    if(JSON.stringify(read(out+128,16))!==JSON.stringify(mm.flat()))issue='MMX';
    if(e.cvtpi_top16()!==(form==='rr'?0:7)||e.cvtpi_tag16()!==(form==='rr'?255:128))issue='TOP/tag';
    if(e.cvtpi_flags16()!==0xad7||e.get_ebx()!==0xfd0||e.get_esi()!==0x20)issue='flags/GPR';
   }catch(err){issue='trap:'+err.message;}
   count++;if(issue){failed++;if(failures.length<20)failures.push({row,dst,src,form,repeat,issue});}
  }
  const result={...seal,moduleSha256:sha(bytes),count,failed,failures,code16:true};
  if(process.env.PROBE_OUT)fs.writeFileSync(process.env.PROBE_OUT,JSON.stringify(result,null,2));console.log(JSON.stringify(result));process.exitCode=failed?1:0;return;
 }
 const stack=0x1100000,input=0xc00003,out=0xc80003,env=out+256;
 const thunk=e.get_thunk_base()>>>0,tw=g(thunk),old=dv.getUint32(tw+4,true);
 dv.setUint32(tw+4,require('../src/api_table.json').find(x=>x.name==='VirtualAlloc').id,true);
 for(const [i,addr] of [0x30000000,0x31000000,0x30001000].entries()){
  const pc=0x480000+i*64;mem.set([0x6a,4,0x68,...le(0x3000),0x68,...le(4096),0x68,...le(addr),0xb8,...le(thunk),0xff,0xd0,0xc3],g(pc));
  e.set_esp(stack);e.guest_write32(stack,0);e.set_eip(pc);e.run(10000);assert.equal(e.get_eax()>>>0,addr);
 }
 dv.setUint32(tw+4,old,true);assert.notEqual(g(0x30001000),g(0x30000000)+4096);e.set_fault_unmapped(2);
 const write=(a,v)=>v.forEach((x,i)=>e.guest_write32(a+4*i,x));
 const read=(a,n)=>Array.from({length:n},(_,i)=>e.guest_read32(a+4*i)>>>0);
 const snap=(a,n)=>Buffer.from(Array.from({length:n},(_,i)=>mem[g(a+i)]));
 const fill=(a,n,x)=>{for(let i=0;i<n;i++)mem[g(a+i)]=x;};
 const groups={},failures=[],sites=new Map();let count=0,failed=0;
 const gprs={eax:0x71000000,ecx:0x72000000,edx:0x73000000,ebx:0x74000000,ebp:0x75000000,esi:0x76000000,edi:0x77000000};
 function execute({row,dst,src,b=null,form='abs',repeats=1,cached=false,patch=false}){
  const rr=b===null,label='CVTPI2PS'+'/'+(rr?'rr':form)+'/'+(cached?'cached':'first')+(patch?'/codewrite':'');
  const [source,want]=vectors[row];
  const uppers=[[0x7fc12345,0xffc54321],[0x7f812345,0xff812346],[0x80000000,0],[0x7f800000,0xff800000]];
  const xmm=Array.from({length:8},(_,i)=>[0x11111111+i,0x22222222+i,...uppers[(row+i)%4]]);
  const mm=Array.from({length:8},(_,i)=>[0xdead0000+i,0xbeef0000+i]),expected=xmm.map(x=>x.slice());expected[dst]=[...want,...xmm[dst].slice(2)];mm[src]=source;
  const disp=form==='fs'?0x100:b,operand=rr?[0xc0|dst<<3|src]:form==='sib'?[0x44|dst<<3,0xb3,16]:form==='disp'?[0x43|dst<<3,16]:[5|dst<<3,...le(disp)];
  const instruction=[...(form==='fs'?[0x64]:[]),0x0f,0x2a,...operand];
  const code=[
   ...xmm.flatMap((_,i)=>[0x0f,0x10,5|i<<3,...le(input+16*i)]),
   ...mm.flatMap((_,i)=>[0x0f,0x6f,5|i<<3,...le(input+128+8*i)]),
   0xdb,0xe3,0xd9,0xe8, // FNINIT/FLD1 after MMX setup: TOP7, only physical7 valid.
   0x68,...le(0xad7),0x9d,...Array.from({length:repeats},()=>instruction).flat(),
   0xd9,0x35,...le(env), // snapshot transition before MMX stores
   ...mm.flatMap((_,i)=>[0x0f,0x7f,5|i<<3,...le(out+8*i)]),
   ...xmm.flatMap((_,i)=>[0x0f,0x11,5|i<<3,...le(out+64+16*i)]),
   0x9c,0x8f,5,...le(out+192),
   0x0f,0x77,0xd9,0x35,...le(env+32),0xd9,0xe8,0xd9,0x1d,...le(env+64),0xc3];
  // Segment bases are part of a decoded site's setup; each FS base gets a
  // distinct site, then cached execution repeats with that same base.
  const key=code.join(',')+(form==='fs'?'/fs-base/'+b:'');let pc=patch?0x3700000:sites.get(key);
  if(pc===undefined){pc=0x1800000+sites.size*512;sites.set(key,pc);mem.set(code,g(pc));}
  else if(patch&&!cached)code.forEach((x,i)=>e.guest_write8(pc+i,x));
  fill(input-8,208,0x5a);xmm.forEach((v,i)=>write(input+16*i,v));mm.forEach((v,i)=>write(input+128+8*i,v));const before=snap(input-8,208);
  fill(out-8,344,0x73);let guard,n;
  if(!rr){n=b===0x31000ff8?16:24;fill(b-8,n,0x6b);write(b,source);guard=snap(b-8,n);}
  e.set_fs_base(form==='fs'?b-0x100:0);
  for(const [reg,val] of Object.entries(gprs))e['set_'+reg](val);
  if(!rr){e.set_ebx(b-16-(form==='sib'?12:0));e.set_esi(3);}
  e.set_esp(stack);e.guest_write32(stack,0);e.set_eip(pc);const issues=[];
  try{e.run(10000);}catch(err){issues.push('trap:'+err.message);}
  if(!issues.length){
   if(JSON.stringify(read(out,16))!==JSON.stringify(mm.flat()))issues.push('MMX');
   if(JSON.stringify(read(out+64,32))!==JSON.stringify(expected.flat()))issues.push('XMM');
   if(e.guest_read32(out+192)!==0xad7)issues.push('flags');
   if(e.get_eip()!==0||e.get_esp()!==stack+4)issues.push('stack');
   if((e.guest_read32(env+4)&0x3800)!==(rr?0:0x3800)||(e.guest_read32(env+8)&0xffff)!==(rr?0:0x3fff))issues.push('TOP/tag-transition');
   if((e.guest_read32(env+40)&0xffff)!==0xffff||e.guest_read32(env+64)!==0x3f800000)issues.push('EMMS/FLD1');
   for(const [reg,val] of Object.entries(gprs)){
    const expected=!rr&&reg==='ebx'?b-16-(form==='sib'?12:0):!rr&&reg==='esi'?3:val;
    if((e['get_'+reg]()>>>0)!==expected)issues.push('GPR-'+reg);
   }
   if(!snap(input-8,208).equals(before))issues.push('input');
   if(!snap(out-8,8).equals(Buffer.alloc(8,0x73))||!snap(out+324,12).equals(Buffer.alloc(12,0x73)))issues.push('output-guards');
   if(!rr&&!snap(b-8,n).equals(guard))issues.push('memory-guards');
  }
  const group=groups[label]||={count:0,failed:0};group.count++;count++;
  if(issues.length){failed++;group.failed++;if(failures.length<30)failures.push({row,dst,src,b,label,issues,actual:read(out+64+16*dst,4),want});}
 }
 for(let row=0;row<vectors.length;row++)for(let dst=0;dst<8;dst++)for(let src=0;src<8;src++)for(const cached of [false,true]){
  execute({row,dst,src,cached,repeats:3});
 }
 for(const [b,form] of [[0xc01003,'abs'],[0xc01007,'disp'],[0xc0100f,'sib'],[0xc01013,'fs'],[0x30000013,'fs'],[0x31000ff8,'abs'],...Array.from({length:7},(_,i)=>[0x30000ff9+i,'abs'])])
 for(let row=0;row<vectors.length;row++)for(let dst=0;dst<8;dst++)for(const cached of [false,true]){
  execute({row,dst,src:7,b,form,cached});
 }
 for(let dst=0;dst<8;dst++)for(let src=0;src<8;src++)for(const cached of [false,true])execute({row:(dst+src)%vectors.length,dst,src,cached,patch:true});
 const negativeFailures=[];let rejected=0;
 // F3 is separately supported CVTSI2SS, covered by scalar regression tests.
 for(const prefix of [[0x66],[0xf2],[0xf0],[0x66,0xf3],[0xf3,0x66]])for(const operand of [[0xc1],[5,...le(input)]]){
  const pc=0x3800000+rejected++*64;mem.set([...prefix,0x0f,0x2a,...operand,0xc3],g(pc));e.set_esp(stack);e.guest_write32(stack,0);e.set_eip(pc);
  let trapped=false;try{e.run(1000);}catch(err){trapped=err instanceof WebAssembly.RuntimeError;}if(!trapped)negativeFailures.push({prefix,operand});
 }
 const result={...seal,moduleSha256:sha(bytes),moduleSize:bytes.length,count,failed,groups,failures,rejected,negativeFailures,
  limits:'Reset masked nearest-even only; no MXCSR runtime/status or unmasked exception claims; separate MMX/x87 values do not alias; no Windows/hardware/gameplay claim'};
 if(process.env.PROBE_OUT)fs.writeFileSync(process.env.PROBE_OUT,JSON.stringify(result,null,2));console.log(JSON.stringify(result));process.exitCode=failed||negativeFailures.length?1:0;
}

