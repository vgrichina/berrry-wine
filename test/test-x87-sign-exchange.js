'use strict';
const fs=require('fs'),a=require('assert/strict'),crypto=require('crypto');
// id, mantissa, literal source/FCHS/FABS sign-exponents; no measured oracle.
const vectors=[
 ['near+', 'a000000000000001',0x4000,0xc000,0x4000],
 ['near-', '9fffffffffffffff',0xc000,0x4000,0x4000],
 ['tiny+', '8000000000000000',0x0001,0x8001,0x0001],
 ['tiny-next+', '8000000000000001',0x0001,0x8001,0x0001],
 ['tiny-', '8000000000000001',0x8001,0x0001,0x0001],
 ['huge+', '8000000000000001',0x5000,0xd000,0x5000],
 ['huge-', '8000000000000001',0xd000,0x5000,0x5000],
 ['max+', 'ffffffffffffffff',0x7ffe,0xfffe,0x7ffe],
 ['max-', 'ffffffffffffffff',0xfffe,0x7ffe,0x7ffe],
 ['zero+', '0000000000000000',0x0000,0x8000,0x0000],
 ['zero-', '0000000000000000',0x8000,0x0000,0x0000],
 ['integer+', '8000000000000400',0x4034,0xc034,0x4034],
 ['integer-', '8000000000000c00',0xc034,0x4034,0x4034],
 ['min-signed64', '8000000000000000',0xc03e,0x403e,0x403e]
];
const forms=[['FCHS',[0xd9,0xe0],'neg'],['FABS',[0xd9,0xe1],'abs'],['FCHS-twice',[0xd9,0xe0,0xd9,0xe0],'identity'],['FABS-twice',[0xd9,0xe1,0xd9,0xe1],'abs']];
for(let i=0;i<8;i++)for(const twice of [false,true])forms.push(['FXCH-'+i+(twice?'-twice':''),Array(twice?2:1).fill([0xd9,0xc8+i]).flat(),twice?'identity':'swap',i]);
const le=x=>[x&255,x>>>8&255,x>>>16&255,x>>>24];
async function main(){
 const [file='build/wine-assembly.wasm',regionFile,out]=process.argv.slice(2),bytes=fs.readFileSync(file),mod=await WebAssembly.compile(bytes),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),imports={};
 for(const i of WebAssembly.Module.imports(mod))(imports[i.module]||={})[i.name]=i.kind==='memory'?memory:i.name==='math_log2'?Math.log2:i.name==='math_pow2'?x=>2**x:()=>0;
 const e=new WebAssembly.Instance(mod,imports).exports,mem=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer),g=x=>e.guest_to_wasm(x)>>>0;
 const pe=fs.readFileSync('test/binaries/notepad.exe');mem.set(pe,e.get_staging());a(e.load_pe(pe.length));e.set_fault_unmapped(2);e.set_uop(0);e.set_esp(0x1108000);
 const regions=(regionFile ? JSON.parse(fs.readFileSync(regionFile)) : require('../tools/region-layout').layout().regions),base=n=>regions.find(r=>r.name==='$'+n).base,fp=base('FPU_FILE'),meta=base('FPU_IMAGE_META');
 const input=0xc02000,env=0xc05000,flags=0xc06000;let pc=0x1820000;
 function exec(b,at){if(at===undefined){at=pc;pc+=64;mem.set([...b,0xeb,0],g(at));}e.clear_yield();e.set_eip(at);e.run(1);return at;}
 function load(m,s){dv.setBigUint64(g(input),BigInt('0x'+m),true);dv.setUint16(g(input)+8,s,true);exec([0xdb,0x2d,...le(input)]);}
 const regs=['eax','ecx','edx','ebx','esp','ebp','esi','edi'];
 function state(){return {top:e.get_fpu_top(),tags:e.get_fpu_tags(),fp:Buffer.from(mem.slice(fp,fp+128)),meta:Buffer.from(mem.slice(meta,meta+32)),images:Array.from({length:8},(_,i)=>[BigInt.asUintN(64,e.get_mmx(i)).toString(16).padStart(16,'0'),dv.getUint16(meta+2*i,true)]),gp:regs.map(r=>e['get_'+r]())};}
 const rows=[];
 for(const [id,m,s,neg,abs]of vectors)for(const [name,op,kind,rm=0]of forms)for(const top of [2,5])for(const seed of [0,0x473f]){
  const at=pc;pc+=64;mem.set([...op,0xeb,0],g(at));
  for(let repeat=0;repeat<2;repeat++){
   exec([0xdb,0xe3]);[0x37f,(top<<11)|seed,0xffff,0,0,0,0].forEach((x,i)=>e.guest_write32(env+i*4,x));exec([0xd9,0x25,...le(env)]);
   for(let i=7;i>=0;i--)load(i===0?m:(0x9000000000000001n+BigInt(i)).toString(16),i===0?s:0x4010+i);
   exec([0x68,...le(0xed7),0x9d]);const before=state();a.equal(before.top,top);a.deepEqual(before.images[top],[m,s]);a.equal(e.get_fpu_sw(),seed);
   const want=structuredClone(before.images),wantFP=Buffer.from(before.fp),q=(top+rm)&7;
   if(kind==='swap'){
    [want[top],want[q]]=[want[q],want[top]];
    for(const offset of [0,64]){const b=Buffer.from(before.fp.subarray(offset+top*8,offset+top*8+8));before.fp.copy(wantFP,offset+top*8,offset+q*8,offset+q*8+8);b.copy(wantFP,offset+q*8);}
   }
   if(kind==='neg'||kind==='abs'){
    want[top]=[m,kind==='neg'?neg:abs];const bits=before.fp.readBigUInt64LE(top*8);wantFP.writeBigUInt64LE(kind==='neg'?bits^0x8000000000000000n:bits&0x7fffffffffffffffn,top*8);
   }
   const hits=e.get_page_hits(),stores=e.get_cache_stores();exec(null,at);const cache={hits:e.get_page_hits()-hits,stores:e.get_cache_stores()-stores};const after=state();
   exec([0xdd,0x3d,...le(env+64)]);const sw=dv.getUint16(g(env+64),true);exec([0xd9,0x35,...le(env+96)]);const cw=dv.getUint16(g(env+96),true);exec([0x9c,0x8f,5,...le(flags)]);const actualFlags=dv.getUint32(g(flags),true);
   const targetShadow=(kind==='neg'||kind==='abs'||name==='FCHS-twice'||name==='FABS-twice');
   const checks={images:JSON.stringify(after.images)===JSON.stringify(want),physical:after.fp.every((x,i)=>targetShadow&&i>=64+top*8&&i<72+top*8||x===wantFP[i]),metaNeighbors:after.meta.every((x,i)=>i<16?x===((i&1)?want[i>>1][1]>>>8:want[i>>1][1]&255):x===before.meta[i]),C1:(sw&0x200)===0,sticky:(sw&0x3f)===(seed&0x3f),top:after.top===top&&(sw&0x3800)===(top<<11),tags:after.tags===before.tags,cw:cw===0x37f,flags:actualFlags===0xed7,gp:JSON.stringify(before.gp)===JSON.stringify(after.gp),cached:cache.stores===(repeat===0?1:0)&&(repeat===0||cache.hits===1)};
   rows.push({id,name,top,seed,repeat,cache,sw,wantC1:0,checks,pass:Object.values(checks).every(Boolean)});
  }
 }
 const failureCounts={};for(const r of rows)for(const [k,v]of Object.entries(r.checks))if(!v)failureCounts[k]=(failureCounts[k]||0)+1;
 const result={module:file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),cases:rows.length,cachedHits:rows.filter(r=>r.repeat===1&&r.cache.hits===1).length,failures:rows.filter(r=>!r.pass).length,failureCounts,firstFailure:rows.find(r=>!r.pass),rows};if(out)fs.writeFileSync(out,JSON.stringify(result,null,2));console.log(JSON.stringify({...result,rows:undefined}));if(result.failures)process.exitCode=1;
}main().catch(error=>{console.error(error);process.exitCode=2;});
