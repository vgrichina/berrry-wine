'use strict';
// Intel SDM Vol.2B 253667-080US (June 2023), pp.4-55..57, 4-105..107.
// https://cdrdv2-public.intel.com/782151/253667-sdm-vol-2b.pdf
// NP MOVD zero extends to MMX or stores low32; MOVQ copies all64.
// ModRM reg is MMX, r/m is GPR for MOVD and MMX for MOVQ.
// Literal [MMX A, r/m B, low32 A, low32 B, zero extended low32 B].
const literal=[
 ['7766554433221100','ffeeddccbbaa9988','33221100','bbaa9988','00000000bbaa9988'],
 ['ffffffff00000000','00000000ffffffff','00000000','ffffffff','00000000ffffffff'],
 ['80000000ffffffff','7fffffff80000000','ffffffff','80000000','0000000080000000']
];
const operations=['loadD','storeD','loadQ','storeQ'];
const operation=process.env.MOVE_OP||'loadD';
if(!operations.includes(operation))throw Error('invalid MOVE_OP');
const opcode=[0x6e,0x7e,0x6f,0x7f][operations.indexOf(operation)];
const store=operation.startsWith('store'),dword=operation.endsWith('D');
const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const le=x=>[x&255,x>>>8&255,x>>>16&255,x>>>24];
const pack=x=>{const n=BigInt('0x'+x);return [Number(n&0xffffffffn),Number(n>>32n)];};
const vectors=literal;
const seal={oracleSha256:sha(JSON.stringify(literal)),testSha256:sha(fs.readFileSync(__filename))};
// Setup and observation only. All tested instructions use the real decoder.
const setupWat=`
 (func (export "move_setup") (param $input i32) (param $flags i32) (param $mode i32) (param $big i32)
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
  ;; Begin with active MMX state; leave x87 TOP unchanged.
  (global.set $fpu_tag (i32.const 255))
  (call $load_eflags (local.get $flags)))
 (func (export "move_snapshot") (param $out i32)
  (local $i i32)
  (loop $regs
   (call $gs64 (i32.add (local.get $out) (i32.shl (local.get $i) (i32.const 3))) (call $mmx_get (local.get $i)))
   (v128.store (call $g2w (i32.add (local.get $out) (i32.add (i32.const 64) (i32.shl (local.get $i) (i32.const 4))))) (call $xmm_get (local.get $i)))
   (local.set $i (i32.add (local.get $i) (i32.const 1)))
   (br_if $regs (i32.lt_u (local.get $i) (i32.const 8)))))
 (func (export "move_flags") (result i32) (call $build_eflags))
 (func (export "move_top") (result i32) (global.get $fpu_top))
 (func (export "move_tag") (result i32) (global.get $fpu_tag))
`;
module.exports={setupWat,seal,vectors};
if(process.env.FREEZE_ONLY){fs.writeFileSync(process.env.FREEZE_ONLY,JSON.stringify({...seal,literal},null,2));console.log(seal);}
else if(require.main===module)main().then(()=>{
 if(!process.env.MOVE_OP){
  for(const next of ['storeD','loadQ','storeQ']){
   const r=require('child_process').spawnSync(process.execPath,[__filename],{stdio:'inherit',env:{...process.env,MOVE_OP:next},timeout:300000});
   if(r.status!==0)process.exitCode=1;
  }
 }
}).catch(e=>{console.error(e);process.exitCode=1;});
async function main(){
 const mode=Number(process.env.MOVE_CODE16||0),big=Number(process.env.MOVE_CS_BIG||0);
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
  const [a,b,lowA,lowB,extendedB]=vectors[row],mm=Array.from({length:8},(_,i)=>[0xdead0000+i,0xbeef0000+i]);
  mm[dst]=pack(a);if(rr&&src!==dst)mm[src]=pack(b);
  const xmm=Array.from({length:32},(_,i)=>0x7f800001+i);
  fill(input-8,208,0x5a);write(input,[...mm.flat(),...xmm]);fill(out-8,208,0x73);
  e.move_setup(input,flags,mode,big);e.set_fs_base(0xe00000);
  const gp=regs.map((_,i)=>0x71000000+i*0x10001);gp[4]=0x1108000;
  if(rr&&dword&&!store)gp[src]=parseInt(lowB,16);
  return {mm,xmm,gp,want:pack(dword?extendedB:rr&&dst===src?a:b),source:pack(b),lowA:parseInt(lowA,16)};
 }
 function observe(){e.move_snapshot(out);return [...read(out,48),e.move_flags(),e.move_top(),e.move_tag()];}
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
  const expectedMemory=sourceBefore&&Buffer.from(sourceBefore);
  if(!rr&&store){const values=dword?[s.lowA]:s.mm[dst];values.forEach((v,i)=>expectedMemory.writeUInt32LE(v,8+4*i));}
  const inputBefore=snap(input-8,208);regs.forEach((r,i)=>e['set_'+r](s.gp[i]));
  const beforeUnmapped=unmapped;let trapped=false;const issues=[];
  e.clear_yield();e.set_eip(pc);try{e.run(1);}catch(err){trapped=true;issues.push('trap:'+err.message);}
  if(!trapped){
   const expected=s.mm.map(x=>x.slice());
   if(!store)expected[dst]=s.want;
   if(store&&rr&&!dword)expected[src]=s.mm[dst].slice();
   const state=observe();
   if(JSON.stringify(state.slice(0,16))!==JSON.stringify(expected.flat()))issues.push('MMX');
   if(JSON.stringify(state.slice(16,48))!==JSON.stringify(s.xmm))issues.push('XMM');
   if(state[48]!==flags)issues.push('flags');if(state[49]!==0||state[50]!==255)issues.push('TOP/tag');
  }
  if(unmapped!==beforeUnmapped)issues.push('unmapped');
  const expectedGP=s.gp.slice();if(store&&rr&&dword)expectedGP[src]=s.lowA;
  if(regs.some((r,i)=>(e['get_'+r]()>>>0)!==expectedGP[i]))issues.push('GPR');
  if(!snap(input-8,208).equals(inputBefore))issues.push('input');
  if(!rr&&!snap(addr-8,24).equals(expectedMemory))issues.push('memory/guards');
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
  const protectedAddr=form==='valid'?(mode||a16?0xc08003:input):null;
  if(protectedAddr!==null)fill(protectedAddr-8,24,0x6b);
  const protectedBefore=protectedAddr===null?null:snap(protectedAddr-8,24);
  const instruction=[...prefix,...(addr67?[0x67]:[]),...(form==='invalid'&&a16?[0x64]:[]),0x0f,opcode,...operand,0xf4];
  instruction.forEach((v,i)=>e.guest_write8(pc+i,v));regs.forEach((r,i)=>e['set_'+r](s.gp[i]));
  const before=observe(),inputBefore=snap(input-8,208),beforeUnmapped=unmapped;let trapped=false;
  e.clear_yield();e.set_eip(pc);try{e.run(1);}catch(err){trapped=err instanceof WebAssembly.RuntimeError;}
  const after=observe(),preserved=JSON.stringify(before)===JSON.stringify(after)&&regs.every((r,i)=>(e['get_'+r]()>>>0)===s.gp[i])&&snap(input-8,208).equals(inputBefore)&&(!protectedBefore||snap(protectedAddr-8,24).equals(protectedBefore));
  rejected++;if(!trapped||!preserved||unmapped!==beforeUnmapped)negativeFailures.push({addr67,prefix,form,dst,trapped,preserved,unmapped:unmapped-beforeUnmapped});
 }
 const result={...seal,moduleSha256:sha(bytes),moduleSize:bytes.length,operation,mode,big,count,failed,groups,failures,rejected,negativeFailures,limits:'Decoder semantics only; no hardware, Windows, gameplay, or complete x87 alias/exception claim.'};
 if(process.env.PROBE_OUT)fs.writeFileSync(process.env.PROBE_OUT,JSON.stringify(result,null,2));console.log(JSON.stringify(result));process.exitCode=failed||negativeFailures.length?1:0;
}



