'use strict';
// Standalone architectural byte fixture, no application entrypoint or host FP oracle.
const fs=require('fs'),a=require('assert/strict'),crypto=require('crypto');
const le=x=>[x&255,x>>>8&255,x>>>16&255,x>>>24];
const Q=0x8123456789abcdefn,ONE=0x8000000000000000n;
const code=0x1800200,initPC=0x1808000,env=0xc01000,input=0xc02000,out=0xc03000,save=0xc04000;
async function run(file=process.env.WINE_ASSEMBLY_WASM || 'build/wine-assembly.wasm'){
 const bytes=fs.readFileSync(file),mod=await WebAssembly.compile(bytes),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),imports={};
 // These are interpreter imports, never the expectation oracle. Saved literal
 // 1.0/2.0 images below detect a broken math bridge before trusting the probe.
 for(const i of WebAssembly.Module.imports(mod))(imports[i.module]||={})[i.name]=i.kind==='memory'?memory:i.name==='math_log2'?Math.log2:i.name==='math_pow2'?x=>2**x:()=>0;
 const e=(await WebAssembly.instantiate(mod,imports)).exports,mem=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer),g=x=>e.guest_to_wasm(x)>>>0;
 const pe=fs.readFileSync('test/binaries/notepad.exe');mem.set(pe,e.get_staging());a(e.load_pe(pe.length));e.set_fault_unmapped(2);e.set_uop(0);e.set_esp(0x1108000);
 function write(at,b){b.forEach((v,i)=>e.guest_write8(at+i,v));}
 function execute(at,b){if(b)write(at,[...b,0xeb,0]);e.clear_yield();e.set_eip(at);e.run(1);}
 function init(top){
  // Define all physical payloads with guest instructions; no set_mmx or private-file stores.
  execute(initPC,[0xdb,0xe3,...Array(8).fill([0xd9,0xe8]).flat(),0xdb,0xe3]);
  [0x037f,top<<11,0xffff,0,0,0,0].forEach((v,i)=>e.guest_write32(env+i*4,v));
  execute(initPC+128,[0xd9,0x25,...le(env)]);
  mem.fill(0xa5,g(out)-8,g(out)+24);mem.fill(0x6b,g(save)-8,g(save)+116);
  dv.setBigUint64(g(input),Q,true);dv.setUint16(g(input)+8,0x4000,true);
 }
 const rows=[];let pc=code;
 function check(name,top,body,want,opts={}){
  const at=pc;pc+=256;write(at,[...body,0xeb,0]);
  for(const cached of [false,true]){
   init(top);if(opts.i64)dv.setBigUint64(g(input),0x20000000000001n,true);
   e.set_eax(0x89abcdef);execute(at);
   const issues=[],actual={top:e.get_fpu_top(),tag:e.get_fpu_tags(),sw:e.get_fpu_sw(),eax:e.get_eax()>>>0,mm3:BigInt.asUintN(64,e.get_mmx(3)).toString(16).padStart(16,'0')};
   // FNSAVE resets the environment after writing it. Observe saved TOP/tags.
   actual.savedTop=(dv.getUint16(g(save)+4,true)>>>11)&7;actual.savedTag=dv.getUint16(g(save)+8,true);
   actual.regs=Array.from({length:8},(_,i)=>({mant:dv.getBigUint64(g(save)+28+10*i,true).toString(16).padStart(16,'0'),se:dv.getUint16(g(save)+36+10*i,true)}));
   actual.output=dv.getBigUint64(g(out),true).toString(16).padStart(16,'0');
   if(actual.savedTop!==0)issues.push('saved TOP');if(actual.savedTag!==0)issues.push('all saved tags valid');
   if(actual.top!==0||actual.tag!==0)issues.push('FNSAVE reset');
   for(let i=0;i<8;i++){const expected=want.regs?.[i]||{mant:'8000000000000000',se:0x3fff};for(const k of ['mant','se'])if(actual.regs[i][k]!==expected[k])issues.push('physical'+i+'.'+k);}
   if(want.output!==undefined&&actual.output!==want.output)issues.push('MMX read value');
   if(want.eax!==undefined&&actual.eax!==want.eax)issues.push('MMX GPR read');
   if(want.mm3!==undefined&&actual.mm3!==want.mm3)issues.push('MMX destination value');
   if(!mem.subarray(g(out)-8,g(out)).every(v=>v===0xa5)||!mem.subarray(g(out)+8,g(out)+24).every(v=>v===0xa5))issues.push('output guards');
   if(!mem.subarray(g(save)-8,g(save)).every(v=>v===0x6b)||!mem.subarray(g(save)+108,g(save)+116).every(v=>v===0x6b))issues.push('save guards');
   if((e.get_eip()>>>0)!==at+body.length+2)issues.push('continuation');
   rows.push({name,seedTop:top,cached,instructionBytes:body,expected:want,actual,issues});
  }
 }
 const fnsave=[0xdd,0x35,...le(save)],store=p=>[0x0f,0x7f,0x05+(p<<3),...le(out)];
 check('literal x87 1.0 save control',0,[...Array(8).fill([0xd9,0xe8]).flat(),...fnsave],{});
 check('literal x87 2.0 save control',0,[...Array(8).fill([0xd9,0xe8]).flat(),0xd8,0xc0,...fnsave],{regs:{0:{mant:'8000000000000000',se:0x4000}}});
 for(const top of [0,3,7]){
  check('MOVQ mm3 writes physical3+FFFF',top,[0x0f,0x6f,0x1d,...le(input),...fnsave],{regs:{3:{mant:'8123456789abcdef',se:0xffff}},mm3:'8123456789abcdef'});
  check('MOVD mm3 upper32 zero+FFFF',top,[0x0f,0x6e,0xd8,...fnsave],{regs:{3:{mant:'0000000089abcdef',se:0xffff}},mm3:'0000000089abcdef'});
  const p=(top+7)&7;
  check('FLD1/FADD then nonwriting MOVQ store',top,[0xd9,0xe8,0xd8,0xc0,...store(p),...fnsave],{regs:{[p]:{mant:'8000000000000000',se:0x4000}},output:'8000000000000000'});
  check('FLD m80 exact low11 then MOVQ store',top,[0xdb,0x2d,...le(input),...store(p),...fnsave],{regs:{[p]:{mant:'8123456789abcdef',se:0x4000}},output:'8123456789abcdef'});
  check('FILD m64 exact shadow is NOT mantissa',top,[0xdf,0x2d,...le(input),...store(p),...fnsave],{regs:{[p]:{mant:'8000000000000400',se:0x4034}},output:'8000000000000400'},{i64:true});
  check('FLD1 EMMS then nonwriting MMX store preserves exponent',top,[0xd9,0xe8,0x0f,0x77,...store(p),...fnsave],{output:'8000000000000000'});
  check('MOVQ EMMS nonwriting store preserves all80',top,[0x0f,0x6f,0x1d,...le(input),0x0f,0x77,...store(3),...fnsave],{regs:{3:{mant:'8123456789abcdef',se:0xffff}},output:'8123456789abcdef'});
  // Read to GPR also enters MMX, without setting the source exponent FFFF.
  check('MOVD read to GPR leaves all physical80 unchanged',top,[0xdb,0x2d,...le(input),0x0f,0x7e,0xc0+(p<<3),...fnsave],{regs:{[p]:{mant:'8123456789abcdef',se:0x4000}},eax:0x89abcdef});
 }
 const failures=rows.filter(r=>r.issues.length);return {module:file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),cases:rows.length,failures:failures.length,rows};
}
module.exports={run};
if(require.main===module)run(process.argv[2]).then(r=>{if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify(r,null,2));console.log(JSON.stringify({module:r.module,cases:r.cases,failures:r.failures}));if(r.failures)process.exitCode=1;}).catch(e=>{console.error(e);process.exitCode=2;});
