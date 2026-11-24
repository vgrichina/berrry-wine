'use strict';
// Intel SDM Vol.2B PAVGB/PAVGW: rounded unsigned average using 9/17-bit sums.
// 66 selects SSE2; NP excludes F2/F3. LOCK is #UD before operand access.
// https://www.intel.com/content/dam/www/public/us/en/documents/manuals/64-ia-32-architectures-software-developer-vol-2b-manual.pdf
// Independent literal oracles frozen before original execution. Aliases return a.
const literal=[
 {width:8,boundary:[0,1,127,128,254,255],averages:[
 [0,1,64,64,127,128],[1,1,64,65,128,128],[64,64,127,128,191,191],
 [64,65,128,128,191,192],[127,128,191,191,254,255],[128,128,191,192,255,255]],
 mixed:[[[0,1,127,128,254,255,255,128],[255,0,128,127,255,254,255,128],[128,1,128,128,255,255,255,128]],
 [[255,254,128,127,1,0,250,251],[1,2,128,127,0,0,251,251],[128,128,128,127,1,0,251,251]]]},
 {width:16,boundary:[0,1,32767,32768,65534,65535],averages:[
 [0,1,16384,16384,32767,32768],[1,1,16384,16385,32768,32768],
 [16384,16384,32767,32768,49151,49151],[16384,16385,32768,32768,49151,49152],
 [32767,32768,49151,49151,65534,65535],[32768,32768,49151,49152,65535,65535]],
 mixed:[[[65535,32768,1,65534],[1,32767,0,65535],[32768,32768,1,65535]],
 [[32767,0,65535,32768],[32768,65535,65535,32768],[32768,32768,65535,32768]]]}
];
const width=Number(process.env.PAVG_WIDTH||8),spec=literal.find(x=>x.width===width);
if(!spec)throw Error('PAVG_WIDTH must be 8 or 16');
const {boundary,averages,mixed}=spec,opcode=width===8?0xe0:0xe3;
const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const le=x=>[x&255,x>>>8&255,x>>>16&255,x>>>24];
const pack=w=>{const b=Buffer.alloc(8);w.forEach((x,i)=>width===8?b.writeUInt8(x,i):b.writeUInt16LE(x,2*i));return [b.readUInt32LE(0),b.readUInt32LE(4)];};
const vectors=boundary.flatMap((a,i)=>boundary.map((b,j)=>[Array(64/width).fill(a),Array(64/width).fill(b),Array(64/width).fill(averages[i][j]),Array(64/width).fill(a)])).concat(mixed.map(([a,b,w])=>[a,b,w,a]));
const seal={oracleSha256:sha(JSON.stringify(literal)),testSha256:sha(fs.readFileSync(__filename))};
// Setup and observation only. All tested instructions use the real decoder.
const setupWat=`
 (func (export "pavg_setup") (param $input i32) (param $flags i32) (param $mode i32) (param $big i32)
  (local $i i32)
  (loop $regs
   (call $mmx_set (local.get $i) (call $gl64 (i32.add (local.get $input) (i32.shl (local.get $i) (i32.const 3)))))
   (call $xmm_set (local.get $i) (v128.load (call $g2w (i32.add (local.get $input) (i32.add (i32.const 64) (i32.shl (local.get $i) (i32.const 4)))))))
   (local.set $i (i32.add (local.get $i) (i32.const 1)))
   (br_if $regs (i32.lt_u (local.get $i) (i32.const 8))))
  (global.set $code16 (local.get $mode)) (global.set $cs_big (local.get $big))
  (global.set $seg_base_cs (i32.const 0x1800000))
  (global.set $seg_base_ds (i32.const 0xc00000))
  (global.set $seg_base_ss (i32.const 0xd00000))
  (global.set $fpu_top (i32.const 0)) (global.set $fpu_tag (i32.const 255))
  (call $load_eflags (local.get $flags)))
 (func (export "pavg_snapshot") (param $out i32)
  (local $i i32)
  (loop $regs
   (call $gs64 (i32.add (local.get $out) (i32.shl (local.get $i) (i32.const 3))) (call $mmx_get (local.get $i)))
   (v128.store (call $g2w (i32.add (local.get $out) (i32.add (i32.const 64) (i32.shl (local.get $i) (i32.const 4))))) (call $xmm_get (local.get $i)))
   (local.set $i (i32.add (local.get $i) (i32.const 1)))
   (br_if $regs (i32.lt_u (local.get $i) (i32.const 8)))))
 (func (export "pavg_flags") (result i32) (call $build_eflags))
 (func (export "pavg_top") (result i32) (global.get $fpu_top))
 (func (export "pavg_tag") (result i32) (global.get $fpu_tag))
`;
module.exports={setupWat,seal,vectors};
if(process.env.FREEZE_ONLY){fs.writeFileSync(process.env.FREEZE_ONLY,JSON.stringify({...seal,literal},null,2));console.log(seal);}
else if(require.main===module&&!process.env.PAVG_WIDTH){
 // The default command covers both instruction encodings.
 const cp=require('child_process');let bad=false;
 for(const bits of [8,16]){
  const env={...process.env,PAVG_WIDTH:String(bits)};
  if(env.PROBE_OUT)env.PROBE_OUT+='.'+bits+'.json';
  const r=cp.spawnSync(process.execPath,[__filename],{env,stdio:'inherit',timeout:300000});
  if(r.error)console.error(r.error);if(r.status!==0)bad=true;
 }
 process.exitCode=bad?1:0;
}
else if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
async function main(){
 const mode=Number(process.env.PAVG_CODE16||0),big=Number(process.env.PAVG_CS_BIG||0);
 const bytes=process.env.WINE_ASSEMBLY_WASM?fs.readFileSync(process.env.WINE_ASSEMBLY_WASM):require('./compile-src').compileSrcWasm((f,t)=>f==='13-exports.wat'?t+'\n'+setupWat:t);
 const mod=await WebAssembly.compile(bytes),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),imports={};let unmapped=0;
 for(const i of WebAssembly.Module.imports(mod)){assert(['memory','function'].includes(i.kind));(imports[i.module]||={})[i.name]=i.kind==='memory'?memory:i.name==='unmapped_trace'?()=>unmapped++:()=>0;}
 const e=(await WebAssembly.instantiate(mod,imports)).exports,mem=new Uint8Array(memory.buffer),g=a=>e.guest_to_wasm(a)>>>0;
 const pe=fs.readFileSync('test/binaries/notepad.exe');mem.set(pe,e.get_staging());assert(e.load_pe(pe.length));e.set_fault_unmapped(2);
 const regs=['eax','ecx','edx','ebx','esp','ebp','esi','edi'],input=0xc02000,out=0xc80000,pc=0x1800200;
 const write=(a,v)=>v.forEach((x,i)=>e.guest_write32(a+4*i,x));
 const read=(a,n)=>Array.from({length:n},(_,i)=>e.guest_read32(a+4*i)>>>0);
 const snap=(a,n)=>Buffer.from(mem.subarray(g(a),g(a)+n));
 const fill=(a,n,x)=>mem.fill(x,g(a),g(a)+n);
 const groups={},failures=[],negativeFailures=[];let count=0,failed=0,rejected=0;
 function record(label,detail,issues){const z=groups[label]||={count:0,failed:0};count++;z.count++;if(issues.length){failed++;z.failed++;if(failures.length<32)failures.push({...detail,issues});}}
 function init(row,dst,src,rr,flags){
  const [a,b,w,square]=vectors[row],mm=Array.from({length:8},(_,i)=>[0xdead0000+i,0xbeef0000+i]);
  mm[dst]=pack(a);if(rr&&src!==dst)mm[src]=pack(b);
  const xmm=Array.from({length:32},(_,i)=>0x7f800001+i);
  fill(input-8,208,0x5a);write(input,[...mm.flat(),...xmm]);fill(out-8,208,0x73);
  e.pavg_setup(input,flags,mode,big);e.set_fs_base(0xe00000);
  const gp=regs.map((_,i)=>0x71000000+i*0x10001);gp[4]=0x1108000;
  return {mm,xmm,gp,want:pack(rr&&dst===src?square:w),source:pack(b)};
 }
 function observe(){e.pavg_snapshot(out);return [...read(out,48),e.pavg_flags(),e.pavg_top(),e.pavg_tag()];}
 function encode(dst,src,addr67,form,gp,seg=0){
  const a16=!!(mode&&!big)!==!!addr67;
  if(form==='rr')return {operand:[0xc0|dst<<3|src],addr:null};
  let operand,off,base=0xc00000;
  if(a16){
   const {rm,mod,disp}=form;const terms=[[3,6],[3,7],[5,6],[5,7],[6],[7],[5],[3]][rm];
   gp[3]=0xaaaa7fe0;gp[5]=0xbbbb7ff0;gp[6]=0xcccc0020;gp[7]=0xdddd0030;
   off=terms.reduce((n,r)=>n+(gp[r]&65535),0)+disp;
   if(mod===0&&rm===6)off=0x8003;
   off&=65535;base=mode?(terms.includes(5)&&!(mod===0&&rm===6)?0xd00000:0xc00000):0;
   operand=[mod<<6|dst<<3|rm,...(mod===0&&rm===6?[3,0x80]:mod===1?[disp&255]:mod===2?[disp&255,disp>>8&255]:[])];
  }else{
   off=mode?0x8003:0xc08003;base=mode?0xc00000:0;
   if(form==='abs')operand=[5|dst<<3,...le(off)];
   if(form==='disp8'){gp[3]=off+128;operand=[0x43|dst<<3,0x80];}
   if(form==='disp32'){gp[3]=off+0x1234;operand=[0x83|dst<<3,...le(-0x1234)];}
   if(form==='sib'){gp[3]=off+128-12;gp[6]=3;operand=[0x44|dst<<3,0xb3,0x80];}
   if(form==='sib-ss'){gp[5]=off+128-12;gp[6]=3;operand=[0x44|dst<<3,0xb5,0x80];base=mode?0xd00000:0;}
   if(form==='sib-abs'){gp[6]=3;operand=[4|dst<<3,0xb5,...le(off-12)];}
  }
  if(seg===0x64)base=0xe00000;if(seg===0x2e)base=mode?0x1800000:0;
  if(seg===0x3e)base=mode?0xc00000:0;
  if(seg===0x36)base=mode||a16?0xd00000:0;
  return {operand,addr:(base+off)>>>0};
 }
 function execute(row,dst,src,addr67,form,seg,flags,cached){
  const rr=form==='rr',s=init(row,dst,src,rr,flags),{operand,addr}=encode(dst,src,addr67,form,s.gp,seg);
  const instruction=[...(addr67?[0x67]:[]),...(seg?[seg]:[]),0x0f,opcode,...operand,0xf4];
  if(!cached)instruction.forEach((v,i)=>e.guest_write8(pc+i,v));
  let sourceBefore;if(!rr){fill(addr-8,24,0x6b);write(addr,s.source);sourceBefore=snap(addr-8,24);}
  const inputBefore=snap(input-8,208);regs.forEach((r,i)=>e['set_'+r](s.gp[i]));
  const beforeUnmapped=unmapped;let trapped=false;const issues=[];
  e.clear_yield();e.set_eip(pc);try{e.run(1);}catch(err){trapped=true;issues.push('trap:'+err.message);}
  if(!trapped){
   const expected=s.mm.map(x=>x.slice());expected[dst]=s.want;const state=observe();
   if(JSON.stringify(state.slice(0,16))!==JSON.stringify(expected.flat()))issues.push('MMX');
   if(JSON.stringify(state.slice(16,48))!==JSON.stringify(s.xmm))issues.push('XMM');
   if(state[48]!==flags)issues.push('flags');if(state[49]!==0||state[50]!==255)issues.push('TOP/tag');
  }
  if(unmapped!==beforeUnmapped)issues.push('unmapped');
  if(regs.some((r,i)=>(e['get_'+r]()>>>0)!==s.gp[i]))issues.push('GPR');
  if(!snap(input-8,208).equals(inputBefore))issues.push('input');
  if(!rr&&!snap(addr-8,24).equals(sourceBefore))issues.push('source/guards');
  if(!snap(out-8,8).equals(Buffer.alloc(8,0x73))||!snap(out+192,8).equals(Buffer.alloc(8,0x73)))issues.push('output-guards');
  record(`${rr?'rr':!!(mode&&!big)!==!!addr67?'ea16':'ea32'}/67=${addr67}/seg=${seg}/cached=${cached}`,{row,dst,src,addr67,form,seg,want:s.want},issues);
 }
 for(const flags of [0x202,0xad7,0x646])for(const addr67 of [0,1]){
  for(let row=0;row<vectors.length;row++)for(let dst=0;dst<8;dst++)for(let src=0;src<8;src++)for(const cached of [false,true])execute(row,dst,src,addr67,'rr',0,flags,cached);
  const a16=!!(mode&&!big)!==!!addr67;
  const forms=a16?Array.from({length:8},(_,rm)=>[0,1,2].flatMap(mod=>(mod===0?[0]:mod===1?[-128,127]:[-32768,32767]).map(disp=>({rm,mod,disp})))).flat():['abs','disp8','disp32','sib','sib-ss','sib-abs'];
  for(const form of forms.filter(f=>mode||!a16||(f.rm===6&&f.mod===0)))for(const seg of (!mode&&a16?[0x64]:[0,0x64,0x2e,0x36,0x3e]))for(let row=0;row<vectors.length;row++)for(let dst=0;dst<8;dst++)for(const cached of [false,true])execute(row,dst,0,addr67,form,seg,flags,cached);
 }
 // Existing code32/address16 register EAs remain unsupported by the shared
 // decoder. Cover each form without expanding that separate address scope.
 if(!mode)for(let rm=0;rm<8;rm++)for(const mod of [0,1,2]){
  if(mod===0&&rm===6)continue;
  const s=init(0,0,1,true,0xad7);regs.forEach((r,i)=>e['set_'+r](s.gp[i]));
  const instruction=[0x67,0x64,0x0f,opcode,mod<<6|rm,...(mod===1?[0x80]:mod===2?[0,0x80]:[]),0xf4];
  instruction.forEach((v,i)=>e.guest_write8(pc+i,v));const before=observe(),beforeUnmapped=unmapped;let trapped=false;
  e.clear_yield();e.set_eip(pc);try{e.run(1);}catch(err){trapped=err instanceof WebAssembly.RuntimeError;}
  const preserved=JSON.stringify(before)===JSON.stringify(observe())&&regs.every((r,i)=>(e['get_'+r]()>>>0)===s.gp[i]);
  rejected++;if(!trapped||!preserved||unmapped!==beforeUnmapped)negativeFailures.push({unsupportedEA:true,rm,mod,trapped,preserved});
 }
 // Invalid/unsupported prefix forms reject before fetching a bad EA or writes.
 for(const addr67 of [0,1])for(const prefix of [[0x66],[0xf2],[0xf3],[0xf0],[0xf3,0x66],[0x66,0xf2]])for(const form of ['rr','valid','invalid'])for(let dst=0;dst<8;dst++){
  const s=init(vectors.length-1,dst,7,true,0xad7),a16=!!(mode&&!big)!==!!addr67;
  const operand=form==='rr'?[0xc0|dst<<3|7]:a16?[6|dst<<3,0x03,0x80]:[5|dst<<3,...le(form==='invalid'?0xdead0000:mode?0x8003:input)];
  if(form==='invalid'&&a16)e.set_fs_base(0xdead0000);
  const instruction=[...prefix,...(addr67?[0x67]:[]),...(form==='invalid'&&a16?[0x64]:[]),0x0f,opcode,...operand,0xf4];
  instruction.forEach((v,i)=>e.guest_write8(pc+i,v));regs.forEach((r,i)=>e['set_'+r](s.gp[i]));
  const before=observe(),inputBefore=snap(input-8,208),beforeUnmapped=unmapped;let trapped=false;
  e.clear_yield();e.set_eip(pc);try{e.run(1);}catch(err){trapped=err instanceof WebAssembly.RuntimeError;}
  const after=observe(),preserved=JSON.stringify(before)===JSON.stringify(after)&&regs.every((r,i)=>(e['get_'+r]()>>>0)===s.gp[i])&&snap(input-8,208).equals(inputBefore);
  rejected++;if(!trapped||!preserved||unmapped!==beforeUnmapped)negativeFailures.push({addr67,prefix,form,dst,trapped,preserved,unmapped:unmapped-beforeUnmapped});
 }
 const result={...seal,moduleSha256:sha(bytes),moduleSize:bytes.length,width,mode,big,count,failed,groups,failures,rejected,negativeFailures,limits:'Decoder semantics only; no hardware, Windows, gameplay, or complete x87 alias/exception claim.'};
 if(process.env.PROBE_OUT)fs.writeFileSync(process.env.PROBE_OUT,JSON.stringify(result,null,2));console.log(JSON.stringify(result));process.exitCode=failed||negativeFailures.length?1:0;
}
