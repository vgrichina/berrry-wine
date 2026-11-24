'use strict';

// Intel SDM Vol.2B PEXTRW 4-277/278 (253667): NP 0FC5 requires
// ModRM.mod=3; 66 is the separate SSE2 XMM form, outside this contract.
// https://www.intel.com/content/dam/www/public/us/en/documents/manuals/64-ia-32-architectures-software-developer-vol-2b-manual.pdf
// Vol.3A Table 15-2: reading MMX sets TOP=0 and all tags valid.
// https://cdrdv2-public.intel.com/874240/325462-090-sdm-vol-1-2abcd-3abcd-4.pdf
// Expected words are independent literals, frozen before baseline execution.
const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const le=x=>[x&255,x>>>8&255,x>>>16&255,x>>>24];
const vectors=[
 [[0x89abcdef,0x01234567],[0xcdef,0x89ab,0x4567,0x0123]],
 [[0x8000ffff,0x00017fff],[0xffff,0x8000,0x7fff,0x0001]],
 [[0x00000000,0xffffffff],[0x0000,0x0000,0xffff,0xffff]],
 [[0x7f812345,0xffc54321],[0x2345,0x7f81,0x4321,0xffc5]],
 [[0x76543210,0xfedcba98],[0x3210,0x7654,0xba98,0xfedc]],
];
const seal={oracleSha256:sha(JSON.stringify(vectors)),testSha256:sha(fs.readFileSync(__filename))};
// Setup and inspection only; the tested instruction always uses the decoder.
const setup16=`
 (func (export "pextrw_setup16") (param $input i32)
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
 (func (export "pextrw_snapshot16") (param $out i32)
  (local $i i32)
  (loop $regs
   (call $gs64 (i32.add (local.get $out) (i32.shl (local.get $i) (i32.const 3))) (call $mmx_get (local.get $i)))
   (v128.store (call $g2w (i32.add (local.get $out) (i32.add (i32.const 64) (i32.shl (local.get $i) (i32.const 4))))) (call $xmm_get (local.get $i)))
   (local.set $i (i32.add (local.get $i) (i32.const 1)))
   (br_if $regs (i32.lt_u (local.get $i) (i32.const 8)))))
 (func (export "pextrw_top16") (result i32) (global.get $fpu_top))
 (func (export "pextrw_tag16") (result i32) (global.get $fpu_tag))
 (func (export "pextrw_flags16") (result i32) (call $build_eflags))
`;
module.exports={setup16};
if(process.env.FREEZE_ONLY){fs.writeFileSync(process.env.FREEZE_ONLY,JSON.stringify({...seal,vectors},null,2));console.log(seal);}
else if(require.main===module)main().catch(err=>{console.error(err);process.exitCode=1;});
async function main(){
 const code16=!!process.env.PEXTRW_CODE16_ONLY;
 const bytes=process.env.WINE_ASSEMBLY_WASM?fs.readFileSync(process.env.WINE_ASSEMBLY_WASM)
  :require('./compile-src').compileSrcWasm(code16?(file,text)=>file==='13-exports.wat'?text+'\n'+setup16:text:undefined);
 const mod=await WebAssembly.compile(bytes),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),imports={};
 let unmapped=0;
 for(const i of WebAssembly.Module.imports(mod)){assert(['memory','function'].includes(i.kind));(imports[i.module]||={})[i.name]=i.kind==='memory'?memory:i.name==='unmapped_trace'?()=>{unmapped++;}:()=>0;}
 const e=(await WebAssembly.instantiate(mod,imports)).exports,mem=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer),g=a=>e.guest_to_wasm(a)>>>0;
 const pe=fs.readFileSync('test/binaries/notepad.exe');mem.set(pe,e.get_staging());assert(e.load_pe(pe.length));
 const write=(a,v)=>v.forEach((x,i)=>e.guest_write32(a+4*i,x));
 const read=(a,n)=>Array.from({length:n},(_,i)=>e.guest_read32(a+4*i)>>>0);
 const snap=(a,n)=>Buffer.from(Array.from({length:n},(_,i)=>mem[g(a+i)]));
 const fill=(a,n,x)=>{for(let i=0;i<n;i++)mem[g(a+i)]=x;};
 const regs=['eax','ecx','edx','ebx','esp','ebp','esi','edi'];
 const input=0xc02003,out=0xc80003,env=out+256,stack=0x1108000,sites=new Map(),failures=[],groups={};let count=0,failed=0;
 if(!code16){
  const thunk=e.get_thunk_base()>>>0,tw=g(thunk),old=dv.getUint32(tw+4,true);
  dv.setUint32(tw+4,require('../src/api_table.json').find(x=>x.name==='VirtualAlloc').id,true);
  for(const [i,addr] of [0x30000000,0x31000000,0x30010000].entries()){
   const pc=0x480000+i*64;mem.set([0x6a,4,0x68,...le(0x3000),0x68,...le(65536),0x68,...le(addr),0xb8,...le(thunk),0xff,0xd0,0xc3],g(pc));
   e.set_esp(stack);e.guest_write32(stack,0);e.set_eip(pc);e.run(10000);assert.equal(e.get_eax()>>>0,addr);
  }
  dv.setUint32(tw+4,old,true);assert.notEqual(g(0x30010000),g(0x30000000)+65536);
 }
 e.set_fault_unmapped(2);
 function record(label,detail,issues){count++;const group=groups[label]||={count:0,failed:0};group.count++;if(issues.length){failed++;group.failed++;if(failures.length<24)failures.push({...detail,issues});}}
 function execute({row,dst,src,imm,cached=false,patch=false,sparse=false,address=false}){
  const [source,wants]=vectors[row],want=wants[imm&3];
  const mm=Array.from({length:8},(_,i)=>[0xdead0000+i,0xbeef0000+i]);mm[src]=source;
  const xmm=Array.from({length:8},(_,i)=>[0x7f812345+i,0xffc54321+i,0x80000000+i,0xabcdef00+i]);
  const gprs=regs.map((_,i)=>0x7100a500+i*0x10001);gprs[4]=stack;
  const expected=gprs.slice();expected[dst]=want;
  const instruction=[...(address?[0x67]:[]),0x0f,0xc5,0xc0|dst<<3|src,imm];
  const code=code16?[0xdb,0xe3,0xd9,0xe8,...instruction,...instruction,0xf4]:[
   ...mm.flatMap((_,i)=>[0x0f,0x6f,5|i<<3,...le(input+8*i)]),
   ...xmm.flatMap((_,i)=>[0x0f,0x10,5|i<<3,...le(input+64+16*i)]),
   0xdb,0xe3,0xd9,0xe8,0x68,...le(0xad7),0x9d,...instruction,...instruction,
   ...regs.flatMap((_,i)=>[0x89,5|i<<3,...le(out+192+4*i)]),
   0xbc,...le(stack),0xd9,0x35,...le(env),
   ...mm.flatMap((_,i)=>[0x0f,0x7f,5|i<<3,...le(out+8*i)]),
   ...xmm.flatMap((_,i)=>[0x0f,0x11,5|i<<3,...le(out+64+16*i)]),
   0x9c,0x8f,5,...le(out+224),0x0f,0x77,0xd9,0x35,...le(env+32),0xd9,0xe8,0xd9,0x1d,...le(env+64),0xc3];
  const key=code.join(',');let pc=code16?0x1800200:sparse?0x3000ff80:patch?0x3700000:sites.get(key);
  if(pc===undefined){pc=0x2000000+sites.size*512;sites.set(key,pc);mem.set(code,g(pc));}
  else if(!cached||patch)code.forEach((x,i)=>e.guest_write8(pc+i,x));
  fill(input-8,208,0x5a);write(input,[...mm.flat(),...xmm.flat()]);const before=snap(input-8,208);
  fill(out-8,344,0x73);fill(stack-16,40,0x65);e.guest_write32(stack,0);const stackBefore=snap(stack-16,40);
  if(code16)e.pextrw_setup16(input);
  regs.forEach((r,i)=>e['set_'+r](gprs[i]));e.clear_yield();e.set_eip(pc);const issues=[];
  try{e.run(code16?1:10000);if(code16)e.pextrw_snapshot16(out);}catch(err){issues.push('trap:'+err.message);}
  if(!issues.length){
   if(JSON.stringify(read(out,16))!==JSON.stringify(mm.flat()))issues.push('MMX-source');
   if(JSON.stringify(read(out+64,32))!==JSON.stringify(xmm.flat()))issues.push('XMM');
   const actual=code16?regs.map(r=>e['get_'+r]()>>>0):read(out+192,8);
   if(JSON.stringify(actual)!==JSON.stringify(expected))issues.push('entire-r32');
   if(code16){if(e.pextrw_top16()!==0||e.pextrw_tag16()!==255)issues.push('TOP/tag');if(e.pextrw_flags16()!==0xad7)issues.push('flags');}
   else{
    if(e.guest_read32(out+224)!==0xad7)issues.push('flags');
    if((e.guest_read32(env+4)&0x3800)!==0||(e.guest_read32(env+8)&65535)!==0)issues.push('TOP/tag');
    if((e.guest_read32(env+40)&65535)!==65535||e.guest_read32(env+64)!==0x3f800000)issues.push('EMMS/FLD1');
   }
   if(!snap(input-8,208).equals(before))issues.push('input');
   if(!snap(out-8,8).equals(Buffer.alloc(8,0x73))||!snap(out+324,12).equals(Buffer.alloc(12,0x73)))issues.push('output-guards');
   if(!snap(stack-16,12).equals(stackBefore.subarray(0,12))||!snap(stack,24).equals(stackBefore.subarray(16)))issues.push('stack-guards');
  }
  record((sparse?'sparse':patch?'codewrite':address?'addr-override':'rr')+(cached?'/cached':'/first'),{row,dst,src,imm,want},issues);
 }
 for(let row=0;row<vectors.length;row++)for(let dst=0;dst<8;dst++)for(let src=0;src<8;src++)
 for(let imm=0;imm<(row===0?256:4);imm++)for(const cached of [false,true])execute({row,dst,src,imm,cached});
 for(let dst=0;dst<8;dst++)for(let src=0;src<8;src++)for(let imm=0;imm<4;imm++)for(const cached of [false,true]){
  execute({row:(dst+src+imm)%vectors.length,dst,src,imm:imm|0xfc,cached,address:true});
  if(!code16)execute({row:(dst+src+imm)%vectors.length,dst,src,imm:imm|0x80,cached,sparse:true});
 }
 if(!code16)for(let dst=0;dst<8;dst++)for(let src=0;src<8;src++)for(let imm=0;imm<4;imm++)execute({row:(src+dst)%vectors.length,dst,src,imm,patch:true});
 // Every memory ModRM in both address sizes, and mandatory/LOCK prefixes.
 // Mode 2 faults call unmapped_trace: a trap caused by a guest data access
 // is a failure, not acceptable evidence of rejecting an instruction.
 let rejected=0;const negativeFailures=[];
 for(const prefix of [[],[0x66],[0xf2],[0xf3],[0xf0],[0x66,0xf3],[0xf3,0x66]])for(const address of [false,true])for(let mr=0;mr<256;mr++){
  if(prefix.length===0&&mr>=192)continue;
  const pc=code16?0x1800200:0x3800000;
  const mod=mr>>>6,rm=mr&7,addr16=code16!==address,operand=[mr];
  if(mod<3){
   if(!addr16&&rm===4)operand.push(0x23); // SIB, mapped/unmapped GPRs never read on rejection.
   const disp=mod===1?1:mod===2?(addr16?2:4):addr16&&rm===6?2:!addr16&&rm===5?4:0;
   operand.push(...Array(disp).fill(0xff));
  }
  // A valid terminator makes accidental acceptance fail even when its bad
  // operand address happens to lie in the direct guest window.
  const code=[...prefix,...(address?[0x67]:[]),0x0f,0xc5,...operand,0xff,0xeb,0xfe];
  code.forEach((x,i)=>e.guest_write8(pc+i,x));
  if(code16)e.pextrw_setup16(input);
  regs.forEach(r=>e['set_'+r](0xe1234321));e.set_esp(stack);e.clear_yield();e.set_eip(pc);
  const before=unmapped,gprs=regs.map(r=>e['get_'+r]()>>>0),guard=snap(stack-16,40);
  let trapped=false;try{e.run(code16?1:1000);}catch(err){trapped=err instanceof WebAssembly.RuntimeError;}
  rejected++;if(!trapped||unmapped!==before||JSON.stringify(gprs)!==JSON.stringify(regs.map(r=>e['get_'+r]()>>>0))||!snap(stack-16,40).equals(guard))negativeFailures.push({prefix,address,mr,trapped,unmapped:unmapped-before});
 }
 const result={...seal,moduleSha256:sha(bytes),moduleSize:bytes.length,code16,count,failed,groups,failures,rejected,negativeFailures,
  limits:'Separate MMX/x87 value files do not model mantissa/exponent aliasing; no pending/unmasked exceptions, hardware, Windows or gameplay claim.'};
 if(process.env.PROBE_OUT)fs.writeFileSync(process.env.PROBE_OUT,JSON.stringify(result,null,2));console.log(JSON.stringify(result));process.exitCode=failed||negativeFailures.length?1:0;
}
