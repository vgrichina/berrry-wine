'use strict';

// Intel SDM Vol.2A CVTPS2PI, printed 3-288:
// https://cdrdv2-public.intel.com/671110/325383-sdm-vol-2abcd.pdf
// Opcode table and operation specify m64 despite the description's m128 typo.
// Literal binary32 inputs, nearest-even outputs, truncation controls frozen
// before originals. No host conversion or implementation-derived oracle.
const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const le=x=>[x&255,x>>>8&255,x>>>16&255,x>>>24];
const vectors=[
 [[0x3f000000,0xbf000000],[0,0],[0,0]],
 [[0x3fc00000,0xbfc00000],[2,0xfffffffe],[1,0xffffffff]],
 [[0x40200000,0xc0200000],[2,0xfffffffe],[2,0xfffffffe]],
 [[0x40600000,0xc0600000],[4,0xfffffffc],[3,0xfffffffd]],
 [[0x40900000,0xc0900000],[4,0xfffffffc],[4,0xfffffffc]],
 [[0x40b00000,0xc0b00000],[6,0xfffffffa],[5,0xfffffffb]],
 [[0x3effffff,0xbeffffff],[0,0],[0,0]],
 [[0x3f000001,0xbf000001],[1,0xffffffff],[0,0]],
 [[0x4effffff,0xceffffff],[0x7fffff80,0x80000080],[0x7fffff80,0x80000080]],
 [[0x4affffff,0xcaffffff],[0x00800000,0xff800000],[0x007fffff,0xff800001]],
 [[0x4f000000,0xcf000000],[0x80000000,0x80000000],[0x80000000,0x80000000]],
 [[0x4f000001,0xcf000001],[0x80000000,0x80000000],[0x80000000,0x80000000]],
 [[0x7f800000,0xff800000],[0x80000000,0x80000000],[0x80000000,0x80000000]],
 [[0x7fc12345,0xffc54321],[0x80000000,0x80000000],[0x80000000,0x80000000]],
 [[0x7f812345,0xff812346],[0x80000000,0x80000000],[0x80000000,0x80000000]],
 [[0x00000001,0x80000001],[0,0],[0,0]],
 [[0x007fffff,0x807fffff],[0,0],[0,0]],
 [[0x00000000,0x80000000],[0,0],[0,0]],
 [[0x7f7fffff,0xff7fffff],[0x80000000,0x80000000],[0x80000000,0x80000000]],
];
const seal={oracleSha256:sha(JSON.stringify(vectors)),testSha256:sha(fs.readFileSync(__filename))};
if(process.env.FREEZE_ONLY){fs.writeFileSync(process.env.FREEZE_ONLY,JSON.stringify(seal,null,2));console.log(seal);}
else main().catch(err=>{console.error(err);process.exitCode=1;});
async function main(){
 const bytes=process.env.WINE_ASSEMBLY_WASM?fs.readFileSync(process.env.WINE_ASSEMBLY_WASM):require('./compile-src').compileSrcWasm();
 const mod=await WebAssembly.compile(bytes),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),imports={};
 for(const i of WebAssembly.Module.imports(mod)){
  assert(['memory','function'].includes(i.kind));(imports[i.module]||={})[i.name]=i.kind==='memory'?memory:()=>0;
 }
 const e=(await WebAssembly.instantiate(mod,imports)).exports,mem=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer),g=a=>e.guest_to_wasm(a)>>>0;
 const pe=fs.readFileSync('test/binaries/notepad.exe');mem.set(pe,e.get_staging());assert(e.load_pe(pe.length));
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
 function execute({row,dst,src,b=null,form='abs',trunc=false,repeats=1,cached=false,patch=false}){
  const rr=b===null,label=(trunc?'CVTTPS2PI':'CVTPS2PI')+'/'+(rr?'rr':form)+'/'+(cached?'cached':'first')+(patch?'/codewrite':'');
  const [source,rounded,cut]=vectors[row],want=trunc?cut:rounded;
  const xmm=Array.from({length:8},(_,i)=>[0x11111111+i,0x22222222+i,0x7f812345,0xff800000]);xmm[src]=[...source,0x7f812345,0xff800000];
  const mm=Array.from({length:8},(_,i)=>[0xdead0000+i,0xbeef0000+i]),expected=mm.map(x=>x.slice());expected[dst]=want;
  const disp=form==='fs'?0x100:b,operand=rr?[0xc0|dst<<3|src]:form==='sib'?[0x44|dst<<3,0xb3,16]:form==='disp'?[0x43|dst<<3,16]:[5|dst<<3,...le(disp)];
  const instruction=[...(form==='fs'?[0x64]:[]),0x0f,trunc?0x2c:0x2d,...operand];
  const code=[0xdb,0xe3,0xd9,0xe8, // FNINIT; FLD1 gives TOP=7 and one occupied tag.
   ...xmm.flatMap((_,i)=>[0x0f,0x10,5|i<<3,...le(input+16*i)]),
   ...mm.flatMap((_,i)=>[0x0f,0x6f,5|i<<3,...le(input+128+8*i)]),
   0x68,...le(0xad7),0x9d,...Array.from({length:repeats},()=>instruction).flat(),
   ...mm.flatMap((_,i)=>[0x0f,0x7f,5|i<<3,...le(out+8*i)]),
   ...xmm.flatMap((_,i)=>[0x0f,0x11,5|i<<3,...le(out+64+16*i)]),
   0x9c,0x8f,5,...le(out+192),0xd9,0x35,...le(env), // FNSTENV
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
   if(JSON.stringify(read(out,16))!==JSON.stringify(expected.flat()))issues.push('MMX');
   if(JSON.stringify(read(out+64,32))!==JSON.stringify(xmm.flat()))issues.push('XMM');
   if(e.guest_read32(out+192)!==0xad7)issues.push('flags');
   if(e.get_eip()!==0||e.get_esp()!==stack+4)issues.push('stack');
   if(!trunc&&((e.guest_read32(env+4)&0x3800)!==0||(e.guest_read32(env+8)&0xffff)!==0))issues.push('TOP/tag-transition');
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
  if(issues.length){failed++;group.failed++;if(failures.length<30)failures.push({row,dst,src,b,label,issues,actual:read(out+8*dst,2),want});}
 }
 for(let row=0;row<vectors.length;row++)for(let dst=0;dst<8;dst++)for(let src=0;src<8;src++)for(const cached of [false,true]){
  execute({row,dst,src,cached,repeats:3});execute({row,dst,src,cached,trunc:true});
 }
 for(const [b,form] of [[0xc01003,'abs'],[0xc01007,'disp'],[0xc0100f,'sib'],[0xc01013,'fs'],[0x30000013,'fs'],[0x31000ff8,'abs'],...Array.from({length:7},(_,i)=>[0x30000ff9+i,'abs'])])
 for(let row=0;row<vectors.length;row++)for(let dst=0;dst<8;dst++)for(const cached of [false,true]){
  execute({row,dst,src:7,b,form,cached});execute({row,dst,src:7,b,form,cached,trunc:true});
 }
 for(let dst=0;dst<8;dst++)for(let src=0;src<8;src++)for(const cached of [false,true])execute({row:(dst+src)%vectors.length,dst,src,cached,patch:true});
 const negativeFailures=[];let rejected=0;
 // F3 CVTSS2SI and F2 CVTSD2SI are supported scalar conversions.
 // Check the formerly rejected F2 forms with a literal binary64 2.5 input.
 for(const operand of [[0xc1],[5,...le(input)]]){
  write(input,[0,0x40040000,0x12345678,0x87654321]);
  const pc=0x37f0000+(operand.length===1?0:64);
  mem.set([0xdb,0xe3,0x0f,0x10,0x0d,...le(input),0xf2,0x0f,0x2d,...operand,0xc3],g(pc));
  e.set_eax(0xdeadbeef);e.set_esp(stack);e.guest_write32(stack,0);e.set_eip(pc);e.run(1000);
  assert.equal(e.get_eax()>>>0,2,'CVTSD2SI nearest-even register/memory');
  assert.equal(e.get_eip(),0);assert.equal(e.get_esp(),stack+4);
  assert.deepEqual(read(input,4),[0,0x40040000,0x12345678,0x87654321]);
 }
 for(const prefix of [[0x66],[0xf0],[0x66,0xf3],[0xf3,0x66]])for(const operand of [[0xc1],[5,...le(input)]]){
  const pc=0x3800000+rejected++*64;mem.set([...prefix,0x0f,0x2d,...operand,0xc3],g(pc));e.set_esp(stack);e.guest_write32(stack,0);e.set_eip(pc);
  let trapped=false;try{e.run(1000);}catch(err){trapped=err instanceof WebAssembly.RuntimeError;}if(!trapped)negativeFailures.push({prefix,operand});
 }
 const result={...seal,moduleSha256:sha(bytes),moduleSize:bytes.length,count,failed,groups,failures,rejected,negativeFailures,
  limits:'Reset masked nearest-even only; no MXCSR runtime/status or unmasked exception claims; no Windows/hardware/gameplay claim'};
 if(process.env.PROBE_OUT)fs.writeFileSync(process.env.PROBE_OUT,JSON.stringify(result,null,2));console.log(JSON.stringify(result));process.exitCode=failed||negativeFailures.length?1:0;
}
