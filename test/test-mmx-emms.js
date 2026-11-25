'use strict';
// Intel SDM 253666-060US EMMS and 253668-060US section12.2/Table12-2:
// plain EMMS empties tags, resets TOP, preserves data/environment; LOCK #UD.
// MMX entry and exact80 alias behavior are deliberately outside this regression.
const fs=require('fs'),crypto=require('crypto'),a=require('assert/strict');
const root=require('path').resolve(__dirname,'..');
const {setupWat}=require('./test-mmx-move-prefix');
module.exports={setupWat};
const map=require(root+'/lib/region-map.generated'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const regs=['eax','ecx','edx','ebx','esp','ebp','esi','edi'],le=x=>[x&255,x>>>8&255,x>>>16&255,x>>>24];
const prefixes=[[],[0xf0]];
async function main(){
 const mode=Number(process.env.EMMS_CODE16||0),big=Number(process.env.EMMS_CS_BIG||0),seam=true;
 const bytes=process.env.WINE_ASSEMBLY_WASM?fs.readFileSync(process.env.WINE_ASSEMBLY_WASM):require('./compile-src').compileSrcWasm((f,t)=>f==='13-exports.wat'?t+'\n'+setupWat:t),mod=await WebAssembly.compile(bytes);
 if(WebAssembly.Module.customSections(mod,'wine-region-layout').length)a.equal(Buffer.from(WebAssembly.Module.customSections(mod,'wine-region-layout')[0]).toString(),map.LAYOUT_HASH);
 const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),imports={};let reads=0;const logs=[];
 for(const i of WebAssembly.Module.imports(mod))(imports[i.module]||={})[i.name]=i.kind==='memory'?memory:i.name==='unmapped_trace'?()=>reads++:i.name==='log_i32'?x=>logs.push(x):()=>0;
 const e=(await WebAssembly.instantiate(mod,imports)).exports,mem=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer),g=x=>e.guest_to_wasm(x)>>>0;
 const pe=fs.readFileSync(root+'/test/binaries/notepad.exe');mem.set(pe,e.get_staging());a(e.load_pe(pe.length));e.set_fault_unmapped(2);
 const fp=map.BASE.FPU_FILE,mm=map.BASE.UOP_CSCRATCH+0x139800,xm=map.BASE.XMM_FILE,env=0xc01000,inp=0xc02000,obs=0xc03000;
 const run=(pc,code)=>{if(code)code.forEach((b,i)=>e.guest_write8(pc+i,b));e.clear_yield();e.set_eip(pc);e.run(1);};
 const addr=(x)=>mode&&!big?[0x67,...le(x-0xc00000)]:le(mode?x-0xc00000:x);
 function init(top,flags,tag=0x55){
  if(seam)e.move_setup(inp,flags,0,0);
  [0x77f,top<<11|0x4500,0xffff].forEach((v,i)=>e.guest_write32(env+4*i,v));
  // Seed environment using actual unprefixed code32 FLDENV; no pending exception.
  run(0x180c000,[0xd9,0x25,...le(env),0xf4]);
  // FLDENV packs architectural tags; use alternating valid/empty tags as input.
  e.guest_write32(env+8,tag===255?0:tag===0?0xffff:0xcccc);
  run(0x180c000,[0xd9,0x25,...le(env),0xf4]);
  for(let i=0;i<8;i++){dv.setFloat64(fp+8*i,i+1.25,true);dv.setBigUint64(mm+8*i,0x1122334455667700n+BigInt(i),true);}
  mem.fill(0x5a,xm,xm+128);
  if(seam){for(let i=0;i<192;i++)e.guest_write8(inp+i,mem[i<64?mm+i:xm+i-64]);e.move_setup(inp,flags,mode,big);}
  else {e.set_esp(0x1108000);run(0x180c100,[0x68,...le(flags),0x9d,0xf4]);}
  run(0x180c400,[...(mode&&!big?[0x67]:[]),0xd9,0x25,...le(mode?env-0xc00000:env),0xf4]);
  regs.forEach((r,i)=>e['set_'+r](r==='esp'?0x1108000:0x71000000+i*0x10001));
 }
 function flags(){if(seam)return e.move_flags();const eax=e.get_eax();run(0x180c200,[0x9c,0x58,0xf4]);const f=e.get_eax()>>>0;e.set_eax(eax);return f;}
 function snap(){
  const f=flags(),gp=regs.map(r=>e['get_'+r]()>>>0);
  // FNSTCW has no state effect. Address override in small mode is on observer only.
  const code=[...(mode&&!big?[0x67]:[]),0xd9,0x3d,...le(mode?obs-0xc00000:obs),0xf4];run(0x180c300,code);
  return {top:e.get_fpu_top(),tag:e.get_fpu_tags(),sw:e.get_fpu_sw(),cw:e.guest_read32(obs)&65535,flags:f,gp,fp:Buffer.from(mem.subarray(fp,fp+128)).toString('hex'),mm:Buffer.from(mem.subarray(mm,mm+64)).toString('hex'),xmm:Buffer.from(mem.subarray(xm,xm+128)).toString('hex')};
 }
 const rows=[];let pc=0x1800200;
 for(const p of prefixes)for(const top of [0,3,7])for(const f of [0x202,0xad7,0x646]){
  const at=pc;pc+=64;const instruction=[...p,0x0f,0x77,0xeb,0];
  for(const cached of [false,true]){
   init(top,f);const before=snap(),r0=reads;let trap=null;
   if(!cached)[...instruction,...(mode&&!big?[0x66]:[]),0xbf,...le(0x1234abcd),0xf4].forEach((b,i)=>e.guest_write8(at+i,b));
   try{run(at);}catch(err){if(!(err instanceof WebAssembly.RuntimeError))throw err;trap=err.message;}
   const next=e.get_eip()>>>0,after=snap();let continuation=null;
   if(!trap){run(at+instruction.length);continuation=e.get_edi()>>>0;}
   const preservation=['sw','cw','flags','gp','fp','mm','xmm'].filter(k=>JSON.stringify(before[k])!==JSON.stringify(after[k]));
   const classification=p.length===0?'plain':p.length===1&&p[0]===0xf0?'lock':'reserved';
   const issues=[];
   if(classification==='plain'&&trap)issues.push('plain trapped');
   if(classification==='lock'&&!trap)issues.push('LOCK admitted');
   if(trap){for(const k of Object.keys(before))if(JSON.stringify(before[k])!==JSON.stringify(after[k]))issues.push('trap mutation '+k);}
   else {if(after.tag!==0)issues.push('EMMS tags');if(after.top!==0)issues.push('TOP not zero');if(preservation.length)issues.push('preservation '+preservation);if(next!==at+instruction.length)issues.push('consumption');if(continuation!==0x1234abcd)issues.push('continuation');}
   if(reads!==r0)issues.push('unmapped read');
   rows.push({prefix:p.map(x=>x.toString(16)).join(' '),top,flags:f,cached,classification,trap,next,expectedNext:at+instruction.length,continuation,before,after,issues});
  }
 }
 const entry=[];
 for(const seedTop of [0,3,7])for(const seedTag of [255])for(const op of [[0x0f,0x6e,0xc0],[0x0f,0x6f,0xc1],[0x0f,0xfc,0xc1]]){
  init(seedTop,0xad7,seedTag);const before=snap();run(pc,[...op,0xeb,0]);const entered=snap();
  run(pc+16,[0x0f,0x77,0xeb,0]);const emptied=snap();
  run(pc+32,[0xd9,0xe8,0xd8,0xc0,0xeb,0]);const after=snap();
  entry.push({seedTop,seedTag,op,before,entered,emptied,after,valuePhysical7:dv.getFloat64(fp+56,true),valueActualTop:dv.getFloat64(fp+8*after.top,true),entryTagPass:entered.tag===255,entryTopPass:entered.top===0,emmsPass:emptied.tag===0&&emptied.top===0,x87Pass:after.top===7&&after.tag===128&&dv.getFloat64(fp+56,true)===2,aliasChanged:before.fp!==entered.fp});pc+=64;
 }
 for(const r of rows)a.deepEqual(r.issues,[],JSON.stringify(r));
 for(const r of entry){a.equal(r.emmsPass,true);a.equal(r.x87Pass,true);a.equal(r.after.sw&0x41,0);for(const k of ['flags','gp','cw','sw','xmm','fp','mm'])a.deepEqual(r.entered[k],r.emptied[k]);}
 a.equal(reads,0);console.log(JSON.stringify({mode,big,cases:rows.length,sequences:entry.length,pass:true}));
}
if(require.main===module)main().catch(err=>{console.error(err);process.exitCode=1;});
