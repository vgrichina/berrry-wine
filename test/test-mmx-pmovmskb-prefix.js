'use strict';

// Intel SDM Vol.2B, PMOVMSKB, pp.4-338/339: NP 0FD7 reg,mm;
// upper 24 destination bits zero, flags unchanged. 66 selects SSE2.
// https://www.intel.com/content/dam/www/public/us/en/documents/manuals/64-ia-32-architectures-software-developer-vol-2b-manual.pdf
// Intel 245127-001, Example 4-17 and Figure 4-8 (p.4-24).
// https://download.intel.com/design/PentiumII/manuals/24512701.pdf
// Literal expected results, frozen before original-module execution. Input
// construction varies the ignored seven bits independently of these results.
const expectedMasks=[
  0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,
  16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,
  32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,
  48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,
  64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,
  80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,
  96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,
  112,113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,
  128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,143,
  144,145,146,147,148,149,150,151,152,153,154,155,156,157,158,159,
  160,161,162,163,164,165,166,167,168,169,170,171,172,173,174,175,
  176,177,178,179,180,181,182,183,184,185,186,187,188,189,190,191,
  192,193,194,195,196,197,198,199,200,201,202,203,204,205,206,207,
  208,209,210,211,212,213,214,215,216,217,218,219,220,221,222,223,
  224,225,226,227,228,229,230,231,232,233,234,235,236,237,238,239,
  240,241,242,243,244,245,246,247,248,249,250,251,252,253,254,255
];
const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const le=x=>[x&255,x>>>8&255,x>>>16&255,x>>>24];
const words=b=>[0,4].map(i=>(b[i]|b[i+1]<<8|b[i+2]<<16|b[i+3]<<24)>>>0);
const seal={oracleSha256:sha(JSON.stringify(expectedMasks)),testSha256:sha(fs.readFileSync(__filename))};
// Code16 setup and inspection only: instruction execution uses the decoder.
const setup16=`
 (func (export "pmovmskb_setup16") (param $input i32) (param $flags i32)
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
  (call $load_eflags (local.get $flags)))
 (func (export "pmovmskb_snapshot16") (param $out i32)
  (local $i i32)
  (loop $regs
   (call $gs64 (i32.add (local.get $out) (i32.shl (local.get $i) (i32.const 3))) (call $mmx_get (local.get $i)))
   (v128.store (call $g2w (i32.add (local.get $out) (i32.add (i32.const 64) (i32.shl (local.get $i) (i32.const 4))))) (call $xmm_get (local.get $i)))
   (local.set $i (i32.add (local.get $i) (i32.const 1)))
   (br_if $regs (i32.lt_u (local.get $i) (i32.const 8)))))
 (func (export "pmovmskb_flags16") (result i32) (call $build_eflags))
`;
module.exports={setup16};
if(process.env.FREEZE_ONLY){fs.writeFileSync(process.env.FREEZE_ONLY,JSON.stringify({...seal,expectedMasks},null,2));console.log(seal);}
else if(require.main===module)main().catch(err=>{console.error(err);process.exitCode=1;});
async function main(){
 const code16=!!process.env.PMOVMSKB_CODE16_ONLY;
 const bytes=process.env.WINE_ASSEMBLY_WASM?fs.readFileSync(process.env.WINE_ASSEMBLY_WASM):require('./compile-src').compileSrcWasm(code16?(f,t)=>f==='13-exports.wat'?t+'\n'+setup16:t:undefined);
 const mod=await WebAssembly.compile(bytes),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),imports={};let unmapped=0;
 for(const i of WebAssembly.Module.imports(mod)){assert(['memory','function'].includes(i.kind));(imports[i.module]||={})[i.name]=i.kind==='memory'?memory:i.name==='unmapped_trace'?()=>{unmapped++;}:()=>0;}
 const e=(await WebAssembly.instantiate(mod,imports)).exports,mem=new Uint8Array(memory.buffer),g=a=>e.guest_to_wasm(a)>>>0;
 const pe=fs.readFileSync('test/binaries/notepad.exe');mem.set(pe,e.get_staging());assert(e.load_pe(pe.length));e.set_fault_unmapped(2);
 const regs=['eax','ecx','edx','ebx','esp','ebp','esi','edi'],input=0xc02003,out=0xc80003,stack=0x1108000,env=out+256;
 const write=(a,v)=>v.forEach((x,i)=>e.guest_write32(a+4*i,x));
 const read=(a,n)=>Array.from({length:n},(_,i)=>e.guest_read32(a+4*i)>>>0);
 const snap=(a,n)=>Buffer.from(mem.subarray(g(a),g(a)+n));
 const fill=(a,n,x)=>mem.fill(x,g(a),g(a)+n);
 const failures=[],groups={},sites=new Map();let count=0,failed=0,unsupported=0;
 function record(label,detail,issues){count++;const group=groups[label]||={count:0,failed:0,unsupported:0};group.count++;if(issues.length){failed++;group.failed++;if(issues.includes('trap:unreachable')){unsupported++;group.unsupported++;}if(failures.length<32)failures.push({...detail,issues});}}
 function execute(row,dst,src,variant,prefix,cached,flags){
  const source=Array.from({length:8},(_,i)=>((row>>>i&1)<<7)|((variant?row*17+i*29+src*13:0)&127));
  const mm=Array.from({length:8},(_,i)=>[0xdead0000+i,0xbeef0000+i]);mm[src]=words(source);
  const xmm=Array.from({length:8},(_,i)=>[0x7f812345+i,0xffc54321+i,0x80000000+i,0xabcdef00+i]);
  const gprs=regs.map((_,i)=>0x7100a500+i*0x10001);gprs[4]=stack;
  const want=gprs.slice();want[dst]=expectedMasks[row];
  const instruction=[...prefix,0x0f,0xd7,0xc0|dst<<3|src];
  const code=code16?[...instruction,...instruction,0xeb,0xfe]:[
   ...mm.flatMap((_,i)=>[0x0f,0x6f,5|i<<3,...le(input+8*i)]),
   ...xmm.flatMap((_,i)=>[0x0f,0x10,5|i<<3,...le(input+64+16*i)]),
   0x68,...le(flags),0x9d,...instruction,...instruction,
   ...regs.flatMap((_,i)=>[0x89,5|i<<3,...le(out+192+4*i)]),
   0xbc,...le(stack),
   ...mm.flatMap((_,i)=>[0x0f,0x7f,5|i<<3,...le(out+8*i)]),
   ...xmm.flatMap((_,i)=>[0x0f,0x11,5|i<<3,...le(out+64+16*i)]),
   0x9c,0x8f,5,...le(out+224),0x0f,0x77,0xd9,0x35,...le(env),0xd9,0xe8,0xd9,0x1d,...le(env+32),0xc3];
  const key=code.join(',');let pc=sites.get(key);
  if(pc===undefined){pc=(code16?0x1800200:0x2000000)+sites.size*(code16?32:512);sites.set(key,pc);mem.set(code,g(pc));}
  fill(input-8,208,0x5a);write(input,[...mm.flat(),...xmm.flat()]);const before=snap(input-8,208);
  fill(out-8,344,0x73);fill(stack-16,40,0x65);e.guest_write32(stack,0);const stackBefore=snap(stack-16,40);
  if(code16)e.pmovmskb_setup16(input,flags);
  regs.forEach((r,i)=>e['set_'+r](gprs[i]));e.clear_yield();e.set_eip(pc);const issues=[],um=unmapped;
  try{e.run(code16?1:10000);if(code16)e.pmovmskb_snapshot16(out);}catch(err){issues.push('trap:'+err.message);}
  if(unmapped!==um)issues.push('unmapped-access');
  if(!issues.length){
   if(JSON.stringify(read(out,16))!==JSON.stringify(mm.flat()))issues.push('MMX');
   if(JSON.stringify(read(out+64,32))!==JSON.stringify(xmm.flat()))issues.push('XMM');
   const actual=code16?regs.map(r=>e['get_'+r]()>>>0):read(out+192,8);
   if(JSON.stringify(actual)!==JSON.stringify(want))issues.push('entire-r32');
   if((code16?e.pmovmskb_flags16():e.guest_read32(out+224))!==flags)issues.push('flags');
   if(!code16&&((e.guest_read32(env+8)&65535)!==65535||e.guest_read32(env+32)!==0x3f800000||e.get_eip()!==0))issues.push('EMMS/continuation');
   if(!snap(input-8,208).equals(before))issues.push('input');
   if(!snap(out-8,8).equals(Buffer.alloc(8,0x73))||!snap(out+324,12).equals(Buffer.alloc(12,0x73)))issues.push('output-guards');
   if(!snap(stack-16,8).equals(stackBefore.subarray(0,8))||!snap(stack+4,20).equals(stackBefore.subarray(20)))issues.push('stack-guards');
   if(code16){
    const emmsPc=0x180e000;
    mem.set([0x0f,0x77,0xd9,0xe8,0x67,0xd9,0x1d,...le(out+288-0xc00000),0xeb,0xfe],g(emmsPc));
    e.clear_yield();e.set_eip(emmsPc);e.run(1);
    if(e.guest_read32(out+288)!==0x3f800000||e.pmovmskb_flags16()!==flags||JSON.stringify(regs.map(r=>e['get_'+r]()>>>0))!==JSON.stringify(want))issues.push('EMMS/continuation');
   }
  }
  record(prefix.join(',')+(cached?'/cached':'/first'),{row,dst,src,variant,flags},issues);
 }
 // All masks and all 64 source/destination pairs, both address sizes, cold
 // and cached decoding, and different ignored low bits. ESP is snapshotted
 // before restoring the continuation stack; no push/pop uses its mask value.
 for(const prefix of [[],[0x67]])for(let row=0;row<256;row++)for(let dst=0;dst<8;dst++)for(let src=0;src<8;src++)
 for(const variant of [0,1])execute(row,dst,src,variant,prefix,!!variant,0xad7);
 for(const flags of [0x202,0x646])for(const seg of [0x26,0x2e,0x36,0x3e,0x64,0x65])for(const address of [false,true])
 for(let dst=0;dst<8;dst++)for(let src=0;src<8;src++)execute((src*37+dst*13)&255,dst,src,1,[seg,...(address?[0x67]:[])],false,flags);
 // No TOP/tag inference: the regression checks values/flags and EMMS
 // continuation only. Rejection must preserve all GPR/MMX/XMM/flags/input.
 const snapshotPc=0x3900000,setupPc=0x3901000;
 if(!code16){
  mem.set([...Array.from({length:8},(_,i)=>[0x0f,0x7f,5|i<<3,...le(out+8*i)]).flat(),...Array.from({length:8},(_,i)=>[0x0f,0x11,5|i<<3,...le(out+64+16*i)]).flat(),0x9c,0x8f,5,...le(out+224),0xc3],g(snapshotPc));
  mem.set([...Array.from({length:8},(_,i)=>[0x0f,0x6f,5|i<<3,...le(input+8*i)]).flat(),...Array.from({length:8},(_,i)=>[0x0f,0x10,5|i<<3,...le(input+64+16*i)]).flat(),0x68,...le(0xad7),0x9d,0xc3],g(setupPc));
 }
 function runAt(pc){e.set_esp(stack);e.guest_write32(stack,0);e.clear_yield();e.set_eip(pc);e.run(code16?1:1000);}
 function state(){if(code16)e.pmovmskb_snapshot16(out);else runAt(snapshotPc);return [...read(out,48),code16?e.pmovmskb_flags16():e.guest_read32(out+224)];}
 let rejected=0;const negativeFailures=[];
 for(const prefix of [[],[0x66],[0xf2],[0xf3],[0xf0],[0x66,0xf3],[0xf3,0x66]])for(const address of [false,true])for(let mr=0;mr<256;mr++){
  if(!prefix.length&&mr>=192)continue;
  const pc=code16?0x180f000:0x3800000+rejected*16;
  // Deliberate poison SIB/displacement: no legal memory form exists.
  [...prefix,...(address?[0x67]:[]),0x0f,0xd7,mr,...Array(8).fill(0xff),0xeb,0xfe].forEach((x,i)=>e.guest_write8(pc+i,x));
  if(code16)e.pmovmskb_setup16(input,0xad7);else runAt(setupPc);
  const before=state(),sourceBefore=snap(input-8,208);regs.forEach((r,i)=>e['set_'+r](i===4?stack:0xe1234321+i));
  const regsBefore=regs.map(r=>e['get_'+r]()>>>0),guard=snap(stack+4,20),um=unmapped;let trapped=false;
  e.clear_yield();e.set_eip(pc);try{e.run(code16?1:1000);}catch(err){trapped=err instanceof WebAssembly.RuntimeError;}
  const regsAfter=regs.map(r=>e['get_'+r]()>>>0),after=state();
  rejected++;if(!trapped||unmapped!==um||JSON.stringify(before)!==JSON.stringify(after)||JSON.stringify(regsBefore)!==JSON.stringify(regsAfter)||!snap(input-8,208).equals(sourceBefore)||!snap(stack+4,20).equals(guard))negativeFailures.push({prefix,address,mr,trapped,unmapped:unmapped-um});
 }
 const result={...seal,moduleSha256:sha(bytes),moduleSize:bytes.length,code16,count,failed,unsupported,groups,failures,rejected,negativeFailures,
  limits:'No TOP/tag change inferred; no x87 aliasing, pending exception, hardware, Windows, gameplay or SSE2 support claim.'};
 if(process.env.PROBE_OUT)fs.writeFileSync(process.env.PROBE_OUT,JSON.stringify(result,null,2));console.log(JSON.stringify(result));process.exitCode=failed||negativeFailures.length?1:0;
}
