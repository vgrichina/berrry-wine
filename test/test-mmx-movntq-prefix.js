'use strict';
// Intel SDM Vol.2B MOVNTQ 4-106 (325383): NP0FE7 /r m64,mm;
// DEST := SRC. 66 selects MOVNTDQ (unsupported SSE2). Memory only.
// https://cdrdv2-public.intel.com/835757/325383-sdm-vol-2abcd.pdf
// Aligned destinations only; cache ordering, segment-limit/permission faults,
// CR0/CR4 and pending x87 exceptions are outside this decoder regression.
const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const le=x=>[x&255,x>>>8&255,x>>>16&255,x>>>24];
// Independent literal input words and expected bytes. Freeze before running
// the original module; never derive expected bytes from candidate output.
const vectors=[
 [0,0,'0000000000000000'],[0xffffffff,0xffffffff,'ffffffffffffffff'],
 [0x76543210,0xfedcba98,'1032547698badcfe'],[0x89abcdef,0x01234567,'efcdab8967452301'],
 [0x7f0080ff,0xfeaa5581,'ff80007f8155aafe'],[0x00000080,0,'8000000000000000'],
 [0x00008000,0,'0080000000000000'],[0x00800000,0,'0000800000000000'],
 [0x80000000,0,'0000008000000000'],[0,0x00000080,'0000000080000000'],
 [0,0x00008000,'0000000000800000'],[0,0x00800000,'0000000000008000'],
 [0,0x80000000,'0000000000000080'],[0x01010101,0x01010101,'0101010101010101']
];
const seal={oracleSha256:sha(JSON.stringify(vectors)),testSha256:sha(fs.readFileSync(__filename))};
// Setup/inspection only. Every instruction under test uses the real decoder.
const setup16=`
 (func (export "movntq_setup16") (param $input i32) (param $flags i32) (param $big i32)
  (local $i i32)
  (loop $regs
   (call $mmx_set (local.get $i) (call $gl64 (i32.add (local.get $input) (i32.shl (local.get $i) (i32.const 3)))))
   (call $xmm_set (local.get $i) (v128.load (call $g2w (i32.add (local.get $input) (i32.add (i32.const 64) (i32.shl (local.get $i) (i32.const 4)))))))
   (local.set $i (i32.add (local.get $i) (i32.const 1)))
   (br_if $regs (i32.lt_u (local.get $i) (i32.const 8))))
  (global.set $code16 (i32.const 1))
  (global.set $cs_big (local.get $big))
  (global.set $seg_base_cs (i32.const 0x1800000))
  (global.set $seg_base_ds (i32.const 0xc00000))
  (global.set $seg_base_ss (i32.const 0xd00000))
  (global.set $seg_base_es (i32.const 0xe00000))
  (global.set $fs_base (i32.const 0xf00000))
  (global.set $gs_base (i32.const 0x1000000))
  (call $load_eflags (local.get $flags)))
 (func (export "movntq_snapshot16") (param $out i32)
  (local $i i32)
  (loop $regs
   (call $gs64 (i32.add (local.get $out) (i32.shl (local.get $i) (i32.const 3))) (call $mmx_get (local.get $i)))
   (v128.store (call $g2w (i32.add (local.get $out) (i32.add (i32.const 64) (i32.shl (local.get $i) (i32.const 4))))) (call $xmm_get (local.get $i)))
   (local.set $i (i32.add (local.get $i) (i32.const 1)))
   (br_if $regs (i32.lt_u (local.get $i) (i32.const 8)))))
 (func (export "movntq_flags16") (result i32) (call $build_eflags))
`;
module.exports={setup16};
if(process.env.FREEZE_ONLY){fs.writeFileSync(process.env.FREEZE_ONLY,JSON.stringify({...seal,vectors},null,2));console.log(seal);}
else if(require.main===module)main().catch(err=>{console.error(err);process.exitCode=1;});
async function main(){
 const code16=!!process.env.MOVNTQ_CODE16_ONLY;
 const bytes=process.env.WINE_ASSEMBLY_WASM?fs.readFileSync(process.env.WINE_ASSEMBLY_WASM):require('./compile-src').compileSrcWasm(code16?(f,t)=>f==='13-exports.wat'?t+'\n'+setup16:t:undefined);
 const mod=await WebAssembly.compile(bytes),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),imports={};let unmapped=0;
 for(const i of WebAssembly.Module.imports(mod)){assert(['memory','function'].includes(i.kind));(imports[i.module]||={})[i.name]=i.kind==='memory'?memory:i.name==='unmapped_trace'?()=>{unmapped++;}:()=>0;}
 const e=(await WebAssembly.instantiate(mod,imports)).exports,mem=new Uint8Array(memory.buffer),g=a=>e.guest_to_wasm(a)>>>0;
 const pe=fs.readFileSync('test/binaries/notepad.exe');mem.set(pe,e.get_staging());assert(e.load_pe(pe.length));e.set_fault_unmapped(2);
 const regs=['eax','ecx','edx','ebx','esp','ebp','esi','edi'],input=0xc02000,out=0xc80000,stack=0x1108000,env=out+256;
 const write=(a,v)=>v.forEach((x,i)=>e.guest_write32(a+4*i,x));
 const read=(a,n)=>Array.from({length:n},(_,i)=>e.guest_read32(a+4*i)>>>0);
 const snap=(a,n)=>Buffer.from(mem.subarray(g(a),g(a)+n));
 const fill=(a,n,x)=>mem.fill(x,g(a),g(a)+n);
 const sites=new Map(),failures=[],groups={};let count=0,failed=0,unsupported=0;
 const setupPc=0x3901000,snapshotPc=0x3900000;
 if(!code16){
  mem.set([...Array.from({length:8},(_,i)=>[0x0f,0x6f,5|i<<3,...le(input+8*i)]).flat(),...Array.from({length:8},(_,i)=>[0x0f,0x10,5|i<<3,...le(input+64+16*i)]).flat(),0x68,...le(0xad7),0x9d,0xc3],g(setupPc));
  mem.set([...Array.from({length:8},(_,i)=>[0x0f,0x7f,5|i<<3,...le(out+8*i)]).flat(),...Array.from({length:8},(_,i)=>[0x0f,0x11,5|i<<3,...le(out+64+16*i)]).flat(),0x9c,0x8f,5,...le(out+224),0xc3],g(snapshotPc));
 }
 function runAt(pc){e.set_esp(stack);e.guest_write32(stack,0);e.clear_yield();e.set_eip(pc);e.run(code16?1:1000);}
 function state(){if(code16)e.movntq_snapshot16(out);else runAt(snapshotPc);return [...read(out,48),code16?e.movntq_flags16():e.guest_read32(out+224)];}
 function record(group,detail,issues){count++;const row=groups[group]||={count:0,failed:0,unsupported:0};row.count++;if(issues.length){failed++;row.failed++;if(issues.includes('trap:unreachable')){unsupported++;row.unsupported++;}if(failures.length<32)failures.push({...detail,issues});}}
 function fixture(row,src,big,flags){
  const mm=Array.from({length:8},(_,i)=>[0xdead0000+i,0xbeef0000+i]);if(src<0)mm.forEach((_,i)=>mm[i]=vectors[(row+i)%vectors.length].slice(0,2));else mm[src]=vectors[row].slice(0,2);
  const xmm=Array.from({length:8},(_,i)=>[0x7f812345+i,0xffc54321+i,0x80000000+i,0xabcdef00+i]);
  fill(input-8,208,0x5a);write(input,[...mm.flat(),...xmm.flat()]);
  if(code16)e.movntq_setup16(input,flags,big);else{
   // The flags immediate is rewritten through guest invalidation.
   [...le(flags)].forEach((b,i)=>e.guest_write8(setupPc+112+1+i,b));
   runAt(setupPc);
  }
  return [...mm.flat(),...xmm.flat(),flags];
 }
 function encoding(addr16,kind,src,seg,big){
  const r=regs.map((_,i)=>0x71000000+i*0x10000);r[4]=stack;
  let operand,offset=0x8000,ss=false;
  if(addr16){
   const [mod,rm]=kind;const pair=rm<4,absolute=mod===0&&rm===6;
   const ids=pair?[rm&2?5:3,rm&1?7:6]:[rm===4?6:rm===5?7:rm===6?5:3];
   const disp=mod===1?-16:mod===2?-32768:0;
   // Deliberate high words plus wrap at 16 bits for mod0 and mod2.
   if(!absolute){const sum=mod===1?0x8010:mod===2?0x10000:0x18000;
    if(pair){r[ids[0]]=(0x7a120000|0xc000)>>>0;r[ids[1]]=(0x6b340000|((sum-0xc000)&65535))>>>0;}
    else r[ids[0]]=(0x7a120000|(sum&65535))>>>0;
   }
   ss=pair?!!(rm&2):rm===6&&!absolute;
   operand=[mod<<6|src<<3|rm,...(absolute?[0,0x80]:mod===1?[0xf0]:mod===2?[0,0x80]:[])];
  }else{
   const base=code16?0:0xc00000;
   if(kind==='abs')operand=[5|src<<3,...le(base+offset)];
   if(kind==='disp8'){r[3]=base+offset+16;operand=[0x43|src<<3,0xf0];}
   if(kind==='disp32'){r[5]=base+offset+0x8000;ss=true;operand=[0x85|src<<3,...le(-32768)];}
   if(kind==='sib'){r[3]=base+offset+16-12;r[6]=3;operand=[0x44|src<<3,0xb3,0xf0];}
   if(kind==='sib-ss'){r[5]=base+offset+32-20;r[1]=5;ss=true;operand=[0x44|src<<3,0x8d,0xe0];}
   if(kind==='sib-nobase'){r[1]=5;operand=[4|src<<3,0x8d,...le(base+offset-20)];}
   if(kind==='sib-noindex'){r[3]=base+offset;operand=[4|src<<3,0x23];}
   offset+=base;
  }
  const sb=code16?[0xe00000,0x1800000,0xd00000,0xc00000,0xf00000,0x1000000]:[0,0,0,0,0xf00000,0];
  const selected=seg<0?(ss?2:3):seg;
  // In flat code32 the baseline has no GS override support. The segmented
  // code16 helper covers all six segment registers with distinct bases.
  const target=(offset+(code16?sb[selected]:selected===4?0xf00000:0))>>>0;
  const address=addr16!==(code16&&!big);
  return {r,target,prefix:[...(seg<0?[]:[[0x26,0x2e,0x36,0x3e,0x64,0x65][seg]]),...(address?[0x67]:[])],operand};
 }
 function execute(row,src,addr16,kind,seg,big,cached,flags,sequence=false){
  const {r,target,prefix,operand}=encoding(addr16,kind,src,seg,big);
  // In flat code32, address16 needs a segment base to keep the target out
  // of the PE header. FS is the explicit legal address16 positive control.
  const ins=sequence?Array.from({length:8},(_,i)=>[...prefix,0x0f,0xe7,...(addr16?[6|i<<3,...le(0x8000+8*i).slice(0,2)]:[5|i<<3,...le((code16?0:0xc00000)+0x8000+8*i)])]).flat():[...prefix,0x0f,0xe7,...operand];
  const code=code16?[...ins,...ins,0x0f,0xae,0xf8,0x0f,0x77,0xd9,0xe8,...(big?[]:[0x67]),0xd9,0x1d,...le(out+288-0xc00000),0xeb,0xfe]:[
   ...ins,...ins,0x0f,0xae,0xf8,...regs.flatMap((_,i)=>[0x89,5|i<<3,...le(out+192+4*i)]),
   ...Array.from({length:8},(_,i)=>[0x0f,0x7f,5|i<<3,...le(out+8*i)]).flat(),
   ...Array.from({length:8},(_,i)=>[0x0f,0x11,5|i<<3,...le(out+64+16*i)]).flat(),
   0x9c,0x8f,5,...le(out+224),0x0f,0x77,0xd9,0x35,...le(env),0xd9,0xe8,0xd9,0x1d,...le(env+32),0xc3];
  let pc=code16?0x1800200:sites.get(code.join(','));
  if(pc===undefined){pc=0x2000000+sites.size*512;sites.set(code.join(','),pc);mem.set(code,g(pc));}
  if(code16&&!cached)code.forEach((x,i)=>e.guest_write8(pc+i,x));
  const expected=fixture(row,sequence?-1:src,big,flags),inputBefore=snap(input-8,208);
  e.set_fs_base(0xf00000);const len=sequence?64:8;fill(target-8,len+16,0x6b);const want=Buffer.concat([Buffer.alloc(8,0x6b),...(sequence?Array.from({length:8},(_,i)=>Buffer.from(vectors[(row+i)%vectors.length][2],'hex')):[Buffer.from(vectors[row][2],'hex')]),Buffer.alloc(8,0x6b)]);
  fill(out-8,344,0x73);regs.forEach((name,i)=>e['set_'+name](r[i]));fill(stack-16,40,0x65);e.guest_write32(stack,0);const stackBefore=snap(stack-16,40);
  e.clear_yield();e.set_eip(pc);const issues=[],um=unmapped;
  try{e.run(code16?1:10000);if(code16)e.movntq_snapshot16(out);}catch(err){issues.push('trap:'+err.message);}
  if(unmapped!==um)issues.push('unmapped');
  if(!issues.length){
   if(!snap(target-8,len+16).equals(want))issues.push('store/neighbor');
   if(JSON.stringify(read(out,48))!==JSON.stringify(expected.slice(0,48)))issues.push('MMX/XMM');
   if((code16?e.movntq_flags16():e.guest_read32(out+224))!==flags)issues.push('flags');
   const actual=code16?regs.map(n=>e['get_'+n]()>>>0):read(out+192,8);
   if(JSON.stringify(actual)!==JSON.stringify(r))issues.push('GPR');
   if(!snap(input-8,208).equals(inputBefore))issues.push('source/guards');
   if(!snap(stack-16,8).equals(stackBefore.subarray(0,8))||!snap(stack+4,20).equals(stackBefore.subarray(20)))issues.push('stack-guards');
   if(code16&&e.guest_read32(out+288)!==0x3f800000)issues.push('EMMS/FLD1');
   if(!code16&&((e.guest_read32(env+8)&65535)!==65535||e.guest_read32(env+32)!==0x3f800000||e.get_eip()!==0))issues.push('EMMS/continuation');
  }
  record((addr16?'addr16':'addr32')+'/big'+big+'/'+(seg<0?'default':seg)+(sequence?'/sequential64':''),{row,src,kind,cached,flags},issues);
 }
 for(const big of code16?[0,1]:[0])for(const addr16 of [false,true]){
  // Flat code32 supports only absolute disp16 through the existing EA
  // decoder; its register-based addr16 forms remain explicit rejects below.
  const forms=addr16?(code16?Array.from({length:24},(_,i)=>[i/8|0,i%8]):[[0,6]]):['abs','disp8','disp32','sib','sib-ss','sib-nobase','sib-noindex'];
  const segments=code16?[-1,0,1,2,3,4,5]:addr16?[4]:[-1,0,1,2,3,4];
  for(const seg of segments)for(const kind of forms)for(let row=0;row<vectors.length;row++)for(let src=0;src<8;src++)
   for(const cached of [false,true])execute(row,src,addr16,kind,seg,big,cached,[0x202,0xad7,0x646][row%3]);
 }
 for(const big of code16?[0,1]:[0])for(const addr16 of [false,true])for(let row=0;row<vectors.length;row++)for(const cached of [false,true])execute(row,0,addr16,addr16?[0,6]:'abs',4,big,cached,0xad7,true);
 // Invalid encodings must reject before poisoned EA evaluation or any store.
 let rejected=0;const negativeFailures=[];
 for(const big of code16?[0,1]:[0])for(const address of [false,true])for(const prefix of [[],[0x66],[0xf2],[0xf3],[0xf0],[0x66,0xf3],[0xf3,0x66]])for(let mr=0;mr<256;mr++){
  const unsupportedEA=!code16&&address&&!prefix.length&&mr<192&&!(mr<64&&(mr&7)===6);
  if(!prefix.length&&mr<192&&!unsupportedEA)continue;
  const pc=code16?0x180f000:0x3800000+rejected*16;
  [...prefix,...(address?[0x67]:[]),0x0f,0xe7,mr,...Array(8).fill(0xff),0xeb,0xfe].forEach((x,i)=>e.guest_write8(pc+i,x));
  fixture(4,3,big,0xad7);const before=state(),inputBefore=snap(input-8,208);
  regs.forEach((name,i)=>e['set_'+name](i===4?stack:0xe1234321+i));const rb=regs.map(n=>e['get_'+n]()>>>0),um=unmapped;
  e.clear_yield();e.set_eip(pc);let trapped=false;try{e.run(code16?1:1000);}catch(err){trapped=err instanceof WebAssembly.RuntimeError;}
  const ra=regs.map(n=>e['get_'+n]()>>>0),after=state();rejected++;
  if(!trapped||unmapped!==um||JSON.stringify(rb)!==JSON.stringify(ra)||JSON.stringify(before)!==JSON.stringify(after)||!snap(input-8,208).equals(inputBefore))negativeFailures.push({big,address,prefix,mr,trapped,unmapped:unmapped-um});
 }
 const result={...seal,moduleSha256:sha(bytes),moduleSize:bytes.length,code16,count,failed,unsupported,groups,failures,rejected,negativeFailures,
  limits:'Aligned memory results only; no cache ordering, segment-limit/permission, CR0/CR4, pending exception, hardware, Windows or gameplay claim.'};
 if(process.env.PROBE_OUT)fs.writeFileSync(process.env.PROBE_OUT,JSON.stringify(result,null,2));console.log(JSON.stringify(result));process.exitCode=failed||negativeFailures.length?1:0;
}
