'use strict';

// Intel SDM Vol.2B PINSRW 4-296/297 (253667-060US), and Vol.3A 12.2:
// https://www.intel.com/content/dam/www/public/us/en/documents/manuals/64-ia-32-architectures-software-developer-vol-2b-manual.pdf
// NP 0F C4 inserts low16 of a GPR or exactly m16 into an MMX destination.
// 66 selects the separate SSE2 XMM form; this test requires it to stay unsupported.
// Literal results below are independent of the interpreter's shift/mask helper.
const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const le=x=>[x&255,x>>>8&255,x>>>16&255,x>>>24];
const vectors=[
 [[0x89abcdef,0x01234567],0xa5a58000,[[0x89ab8000,0x01234567],[0x8000cdef,0x01234567],[0x89abcdef,0x01238000],[0x89abcdef,0x80004567]]],
 [[0xffffffff,0xffffffff],0x12340000,[[0xffff0000,0xffffffff],[0x0000ffff,0xffffffff],[0xffffffff,0xffff0000],[0xffffffff,0x0000ffff]]],
 [[0,0],0xabcdffff,[[0x0000ffff,0],[0xffff0000,0],[0,0x0000ffff],[0,0xffff0000]]],
 [[0x7f812345,0xffc54321],0x55555555,[[0x7f815555,0xffc54321],[0x55552345,0xffc54321],[0x7f812345,0xffc55555],[0x7f812345,0x55554321]]],
 [[0x80000000,0x7fffffff],0xdead0001,[[0x80000001,0x7fffffff],[0x00010000,0x7fffffff],[0x80000000,0x7fff0001],[0x80000000,0x0001ffff]]],
 [[0x76543210,0xfedcba98],0x0000aaaa,[[0x7654aaaa,0xfedcba98],[0xaaaa3210,0xfedcba98],[0x76543210,0xfedcaaaa],[0x76543210,0xaaaaba98]]],
];
const seal={oracleSha256:sha(JSON.stringify(vectors)),testSha256:sha(fs.readFileSync(__filename))};
// Test-only setup/inspection for real code16 decoding; no instruction emulation.
const setup16=`
 (func (export "pinsrw_setup16") (param $input i32)
  (local $i i32)
  (loop $regs
   (call $mmx_set (local.get $i) (call $gl64 (i32.add (local.get $input) (i32.shl (local.get $i) (i32.const 3)))))
   (call $xmm_set (local.get $i) (v128.load (call $g2w (i32.add (local.get $input) (i32.add (i32.const 64) (i32.shl (local.get $i) (i32.const 4)))))))
   (local.set $i (i32.add (local.get $i) (i32.const 1)))
   (br_if $regs (i32.lt_u (local.get $i) (i32.const 8))))
  (global.set $code16 (i32.const 1))
  (global.set $seg_base_cs (i32.const 0x1800000))
  (global.set $seg_base_ds (i32.const 0xc00000))
  (global.set $seg_base_ss (i32.const 0))
  (call $load_eflags (i32.const 0xad7)))
 (func (export "pinsrw_snapshot16") (param $out i32)
  (local $i i32)
  (loop $regs
   (call $gs64 (i32.add (local.get $out) (i32.shl (local.get $i) (i32.const 3))) (call $mmx_get (local.get $i)))
   (v128.store (call $g2w (i32.add (local.get $out) (i32.add (i32.const 64) (i32.shl (local.get $i) (i32.const 4))))) (call $xmm_get (local.get $i)))
   (local.set $i (i32.add (local.get $i) (i32.const 1)))
   (br_if $regs (i32.lt_u (local.get $i) (i32.const 8)))))
 (func (export "pinsrw_top16") (result i32) (global.get $fpu_top))
 (func (export "pinsrw_tag16") (result i32) (global.get $fpu_tag))
 (func (export "pinsrw_flags16") (result i32) (call $build_eflags))
`;
if(process.env.FREEZE_ONLY){fs.writeFileSync(process.env.FREEZE_ONLY,JSON.stringify({...seal,vectors},null,2));console.log(seal);}
else main().catch(err=>{console.error(err);process.exitCode=1;});
async function main(){
 const code16=!!process.env.PINSRW_CODE16_ONLY;
 const bytes=code16?require('./compile-src').compileSrcWasm((file,text)=>file==='13-exports.wat'?text+'\n'+setup16:text)
  :process.env.WINE_ASSEMBLY_WASM?fs.readFileSync(process.env.WINE_ASSEMBLY_WASM):require('./compile-src').compileSrcWasm();
 const mod=await WebAssembly.compile(bytes),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),imports={};
 for(const i of WebAssembly.Module.imports(mod)){assert(['memory','function'].includes(i.kind));(imports[i.module]||={})[i.name]=i.kind==='memory'?memory:()=>0;}
 const e=(await WebAssembly.instantiate(mod,imports)).exports,mem=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer),g=a=>e.guest_to_wasm(a)>>>0;
 const pe=fs.readFileSync('test/binaries/notepad.exe');mem.set(pe,e.get_staging());assert(e.load_pe(pe.length));
 const write=(a,v)=>v.forEach((x,i)=>e.guest_write32(a+4*i,x));
 const read=(a,n)=>Array.from({length:n},(_,i)=>e.guest_read32(a+4*i)>>>0);
 const snap=(a,n)=>Buffer.from(Array.from({length:n},(_,i)=>mem[g(a+i)]));
 const fill=(a,n,x)=>{for(let i=0;i<n;i++)mem[g(a+i)]=x;};
 const regs=['eax','ecx','edx','ebx','esp','ebp','esi','edi'];
 const input=0xc02003,out=0xc80003,env=out+256,sites=new Map(),failures=[],groups={};let count=0,failed=0;
 if(!code16){
  const thunk=e.get_thunk_base()>>>0,tw=g(thunk),old=dv.getUint32(tw+4,true);
  dv.setUint32(tw+4,require('../src/api_table.json').find(x=>x.name==='VirtualAlloc').id,true);
  for(const [i,addr] of [0x30000000,0x31000000,0x30001000].entries()){
   const pc=0x480000+i*64;mem.set([0x6a,4,0x68,...le(0x3000),0x68,...le(4096),0x68,...le(addr),0xb8,...le(thunk),0xff,0xd0,0xc3],g(pc));
   e.set_esp(0x1100000);e.guest_write32(0x1100000,0);e.set_eip(pc);e.run(10000);assert.equal(e.get_eax()>>>0,addr);
  }
  dv.setUint32(tw+4,old,true);assert.notEqual(g(0x30001000),g(0x30000000)+4096);e.set_fault_unmapped(2);
 }
 function record(label,detail,issues){count++;const group=groups[label]||={count:0,failed:0};group.count++;if(issues.length){failed++;group.failed++;if(failures.length<24)failures.push({...detail,issues});}}
 function execute({row,dst,src=0,imm,b=null,form='abs',cached=false,patch=false,prefix=[]}){
  const rr=b===null,[initial,source,wants]=vectors[row],want=wants[imm&3];
  const mm=Array.from({length:8},(_,i)=>[0xdead0000+i,0xbeef0000+i]);mm[dst]=initial;
  const xmm=Array.from({length:8},(_,i)=>[0x7f812345+i,0xffc54321+i,0x80000000+i,0xabcdef00+i]);
  const expected=mm.map(x=>x.slice());expected[dst]=want;
  const gprs=regs.map((_,i)=>0x71000000+i*0x10000);gprs[4]=0x1108000;
  if(rr)gprs[src]=src===4?0x1100000+(source&65535):source;
  if(!rr&&form==='sib'){gprs[3]=b-28;gprs[6]=3;}
  if(!rr&&form==='disp')gprs[3]=b-16;
  if(!rr&&form==='bxsi'){gprs[3]=0x7fd0;gprs[6]=0x20;}
  const stack=gprs[4];
  let operand=rr?[0xc0|dst<<3|src]:form==='sib'?[0x44|dst<<3,0xb3,16]:form==='disp'?[0x43|dst<<3,16]
   :form==='addr16'||(code16&&form==='abs')?[6|dst<<3,0,0x80]:form==='bxsi'?[0x40|dst<<3,16]:[5|dst<<3,...le(code16?0x8000:form==='fs'?0x100:b)];
  const instruction=[...prefix,...(form==='fs'?[0x64]:[]),...(form==='addr16'?[0x64,0x67]:[]),...(code16&&form==='addr32'?[0x67]:[]),0x0f,0xc4,...operand,imm];
  const code=code16?[0xdb,0xe3,0xd9,0xe8,...instruction,...instruction,0xf4]:[
   ...mm.flatMap((_,i)=>[0x0f,0x6f,5|i<<3,...le(input+8*i)]),
   ...xmm.flatMap((_,i)=>[0x0f,0x10,5|i<<3,...le(input+64+16*i)]),
   0xdb,0xe3,0xd9,0xe8,0x68,...le(0xad7),0x9d,...instruction,...instruction,
   0xd9,0x35,...le(env),...mm.flatMap((_,i)=>[0x0f,0x7f,5|i<<3,...le(out+8*i)]),
   ...xmm.flatMap((_,i)=>[0x0f,0x11,5|i<<3,...le(out+64+16*i)]),
   0x9c,0x8f,5,...le(out+192),0x0f,0x77,0xd9,0x35,...le(env+32),0xd9,0xe8,0xd9,0x1d,...le(env+64),0xc3];
  const key=code.join(',')+'/'+(form==='fs'||form==='addr16'?b:'');
  let pc=patch?0x3700000:code16?0x1800200:sites.get(key);
  if(pc===undefined){pc=0x1800000+sites.size*512;sites.set(key,pc);mem.set(code,g(pc));}
  else if((code16&&!cached)||patch)code.forEach((x,i)=>e.guest_write8(pc+i,x));
  fill(input-8,208,0x5a);write(input,[...mm.flat(),...xmm.flat()]);const before=snap(input-8,208);
  fill(out-8,344,0x73);let guard,n;
  if(!rr){n=(b&4095)===4094?10:20;fill(b-8,n,0x6b);e.guest_write8(b,source&255);e.guest_write8(b+1,source>>>8&255);guard=snap(b-8,n);}
  e.set_fs_base(form==='fs'?b-0x100:form==='addr16'?b-0x8000:0);
  if(code16)e.pinsrw_setup16(input);
  regs.forEach((r,i)=>e['set_'+r](gprs[i]));fill(stack-16,40,0x65);e.guest_write32(stack,0);const stackBefore=snap(stack-16,40);
  e.clear_yield();e.set_eip(pc);const issues=[];
  try{e.run(code16?1:10000);if(code16)e.pinsrw_snapshot16(out);}catch(err){issues.push('trap:'+err.message);}
  if(!issues.length){
   if(JSON.stringify(read(out,16))!==JSON.stringify(expected.flat()))issues.push('MMX');
   if(JSON.stringify(read(out+64,32))!==JSON.stringify(xmm.flat()))issues.push('XMM');
   if(code16){if(e.pinsrw_top16()!==0||e.pinsrw_tag16()!==255)issues.push('TOP/tag');if(e.pinsrw_flags16()!==0xad7)issues.push('flags');}
   else{
    if(e.guest_read32(out+192)!==0xad7)issues.push('flags');
    if((e.guest_read32(env+4)&0x3800)!==0||(e.guest_read32(env+8)&65535)!==0)issues.push('TOP/tag');
    if((e.guest_read32(env+40)&65535)!==65535||e.guest_read32(env+64)!==0x3f800000)issues.push('EMMS/FLD1');
    if(e.get_eip()!==0)issues.push('return');
   }
   regs.forEach((r,i)=>{if((e['get_'+r]()>>>0)!==gprs[i]+(!code16&&i===4?4:0))issues.push('GPR-'+r);});
   if(!snap(input-8,208).equals(before))issues.push('input');
   if(!snap(out-8,8).equals(Buffer.alloc(8,0x73))||!snap(out+324,12).equals(Buffer.alloc(12,0x73)))issues.push('output-guards');
   if(!snap(stack-16,8).equals(stackBefore.subarray(0,8))||!snap(stack+4,20).equals(stackBefore.subarray(20)))issues.push('stack-guards');
   if(!rr&&!snap(b-8,n).equals(guard))issues.push('source/guards');
  }
  record((rr?'rr':form)+(cached?'/cached':'/first')+(patch?'/codewrite':''),{row,dst,src,imm,b,want,actual:read(out+dst*8,2)},issues);
 }
 for(let row=0;row<vectors.length;row++)for(let dst=0;dst<8;dst++)for(let src=0;src<8;src++)
 for(let imm=0;imm<(row===0?256:4);imm++)for(const cached of [false,true])execute({row,dst,src,imm,cached});
 const forms=code16?[[0xc08000,'abs'],[0xc08000,'bxsi'],[0xc08000,'addr32']]
  :[[0xc01003,'abs'],[0xc01007,'disp'],[0xc0100f,'sib'],[0xc01013,'fs'],[0xc08000,'addr16'],[0x30000013,'fs'],[0x31000ffe,'abs'],[0x30000fff,'abs']];
 for(const [b,form] of forms)for(let row=0;row<vectors.length;row++)for(let dst=0;dst<8;dst++)for(let imm=0;imm<4;imm++)
 for(const cached of [false,true])execute({row,dst,imm:imm|0xfc,b,form,cached});
 if(!code16)for(let dst=0;dst<8;dst++)for(let src=0;src<8;src++)for(let imm=0;imm<4;imm++)execute({row:(src+dst)%vectors.length,dst,src,imm,patch:true});
 // Rejected encodings must trap, not reinterpret the source as MMX or XMM.
 let rejected=0;const negativeFailures=[];
 const snapshotPc=0x3900000;
 if(!code16)mem.set([
  ...Array.from({length:8},(_,i)=>[0x0f,0x7f,5|i<<3,...le(out+8*i)]).flat(),
  ...Array.from({length:8},(_,i)=>[0x0f,0x11,5|i<<3,...le(out+64+16*i)]).flat(),
  0xd9,0x35,...le(env),0x9c,0x8f,5,...le(out+192),0xc3],g(snapshotPc));
 function negativeState(){
  if(code16){e.pinsrw_snapshot16(out);return [...read(out,48),e.pinsrw_top16(),e.pinsrw_tag16(),e.pinsrw_flags16()];}
  e.clear_yield();e.set_esp(0x1108000);e.guest_write32(0x1108000,0);e.set_eip(snapshotPc);e.run(1000);
  return [...read(out,49),e.guest_read32(env+4)&0x3800,e.guest_read32(env+8)&65535];
 }
 for(const prefix of [[0x66],[0xf2],[0xf3],[0xf0],[0x66,0xf3],[0xf3,0x66]])for(const rr of [true,false]){
  const pc=code16?0x1800200:0x3800000+rejected*64;
  const operand=rr?[0xc1]:code16?[6,0,0x80]:[5,...le(input)];
  [...prefix,0x0f,0xc4,...operand,0xff,0xf4].forEach((x,i)=>e.guest_write8(pc+i,x));
  if(code16)e.pinsrw_setup16(input);const before=negativeState(),sourceBefore=snap(input,192);
  e.set_esp(0x1108000);const regsBefore=regs.map(r=>e['get_'+r]()>>>0);e.clear_yield();e.set_eip(pc);
  let trapped=false;try{e.run(code16?1:1000);}catch(err){trapped=err instanceof WebAssembly.RuntimeError;}
  const regsAfter=regs.map(r=>e['get_'+r]()>>>0),after=negativeState();
  rejected++;if(!trapped||JSON.stringify(before)!==JSON.stringify(after)||JSON.stringify(regsBefore)!==JSON.stringify(regsAfter)||!snap(input,192).equals(sourceBefore))negativeFailures.push({prefix,rr,trapped,preserved:JSON.stringify(before)===JSON.stringify(after)});
 }
 const result={...seal,moduleSha256:sha(bytes),moduleSize:bytes.length,code16,count,failed,groups,failures,rejected,negativeFailures,
  limits:'Separate MMX/x87 value files do not model mantissa/exponent aliasing; no MXCSR, pending/unmasked exceptions, hardware, Windows or gameplay claim.'};
 if(process.env.PROBE_OUT)fs.writeFileSync(process.env.PROBE_OUT,JSON.stringify(result,null,2));console.log(JSON.stringify(result));process.exitCode=failed||negativeFailures.length?1:0;
}
