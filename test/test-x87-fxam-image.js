'use strict';
const fs=require('fs'),a=require('assert/strict'),crypto=require('crypto');
// Fixed literal ISA oracle, established before baseline or candidate execution.
const positive=[['tiny','8000000000000001',1],['tiny-max','ffffffffffffffff',1],['huge','8000000000000001',32766],['huge-max','ffffffffffffffff',32766],['shadow-subnormal','8000000000000000',15360],['shadow-min','8000000000000000',15309],['lowbit','a000000000000001',16388],['one','8000000000000000',16383]];
const vectors=positive.flatMap(([id,mant,se])=>[{id,mant,se,cc:0x400},{id:id+'-negative',mant,se:se|32768,cc:0x600}]);
for(const v of vectors){a(BigInt('0x'+v.mant)>=0x8000000000000000n);a((v.se&32767)>0&&(v.se&32767)<32767);a.equal(v.cc,(v.se&32768)?0x600:0x400);}
if(process.argv[2]==='--oracle'){console.log(JSON.stringify({vectors,normalClass:0x400,negativeNormal:0x600,mask:0x4700}));process.exit(0);}
const le=x=>[x&255,x>>>8&255,x>>>16&255,x>>>24];
async function main(){
 const [file='build/wine-assembly.wasm',regionFile,out]=process.argv.slice(2),bytes=fs.readFileSync(file),mod=await WebAssembly.compile(bytes),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),imports={};
 for(const i of WebAssembly.Module.imports(mod))(imports[i.module]||={})[i.name]=i.kind==='memory'?memory:i.name==='math_log2'?Math.log2:i.name==='math_pow2'?x=>2**x:()=>0;
 const e=new WebAssembly.Instance(mod,imports).exports,mem=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer),g=x=>e.guest_to_wasm(x)>>>0;
 const pe=fs.readFileSync('test/binaries/notepad.exe');mem.set(pe,e.get_staging());a(e.load_pe(pe.length));e.set_fault_unmapped(2);e.set_uop(0);e.set_esp(0x1108000);
 const regions=regionFile?JSON.parse(fs.readFileSync(regionFile)):require('../tools/region-layout').layout().regions,base=n=>regions.find(r=>r.name==='$'+n).base,fp=base('FPU_FILE'),meta=base('FPU_IMAGE_META');
 const input=0xc02000,env=0xc05000,swp=0xc07000;let pc=0x1820000;
 function exec(b,at){if(at===undefined){at=pc;pc+=128;mem.set([...b,0xeb,0],g(at));}e.clear_yield();e.set_eip(at);e.run(1);return at;}
 function load(m,se){dv.setBigUint64(g(input),BigInt('0x'+m),true);dv.setUint16(g(input)+8,se,true);exec([0xdb,0x2d,...le(input)]);}
 function state(){return {top:e.get_fpu_top(),tags:e.get_fpu_tags(),fp:Buffer.from(mem.slice(fp,fp+128)).toString('hex'),meta:Buffer.from(mem.slice(meta,meta+32)).toString('hex'),images:Array.from({length:8},(_,i)=>[BigInt.asUintN(64,e.get_mmx(i)).toString(16).padStart(16,'0'),dv.getUint16(meta+2*i,true)])};}
 const regs=['eax','ecx','edx','ebx','esp','ebp','esi','edi'],rows=[];
 for(const top of [2,5])for(const v of vectors)for(const precision of [0,2,3])for(let rc=0;rc<4;rc++){
  const at=pc;pc+=128;mem.set([0xd9,0xe5,0xeb,0],g(at));
  for(const seed of [0,0x23f,0xc7ff])for(let repeat=0;repeat<2;repeat++){
   exec([0xdb,0xe3]);for(let i=0;i<8;i++)load((0x9000000000000001n+BigInt(i)).toString(16),16400+i);
   // Replace occupied physical TOP through FLD after freeing precisely that slot.
   exec([0xd9,0x35,...le(env)]);dv.setUint16(g(env)+4,((top+1)&7)<<11,true);exec([0xd9,0x25,...le(env)]);exec([0xdd,0xc7]); // FFREE ST7 = destination for push
   load(v.mant,v.se);a.equal(e.get_fpu_top(),top);
   exec([0xd9,0x35,...le(env)]);const cw=0x7f|(precision<<8)|(rc<<10);dv.setUint16(g(env),cw,true);dv.setUint16(g(env)+4,(top<<11)|seed,true);exec([0xd9,0x25,...le(env)]);
   exec([0x68,...le(0xed7),0x9d]);const gp=regs.map(r=>e['get_'+r]()),before=state();a.deepEqual(before.images[top],[v.mant,v.se]);
   const hits=e.get_page_hits(),stores=e.get_cache_stores();exec(null,at);const cache={hits:e.get_page_hits()-hits,stores:e.get_cache_stores()-stores},after=state(),afterGP=regs.map(r=>e['get_'+r]());exec([0xdd,0x3d,...le(swp)]);const sw=dv.getUint16(g(swp),true),wantSW=(((top<<11)|seed)&0xb8ff)|v.cc;
   exec([0xd9,0x35,...le(env+96)]);const gotCW=dv.getUint16(g(env+96),true);exec([0x9c,0x8f,5,...le(env+160)]);const cpuFlags=dv.getUint32(g(env+160),true);
   const equal=(x,y)=>JSON.stringify(x)===JSON.stringify(y),checks={class:(sw&0x4500)===0x400,C1:(sw&0x200)===(v.cc&0x200),allOtherSW:(sw&0xb8ff)===(wantSW&0xb8ff),fullSW:sw===wantSW,fullImages:equal(before.images,after.images),fullFP:before.fp===after.fp,fullMetadata:before.meta===after.meta,top:after.top===before.top,tags:after.tags===before.tags,cw:gotCW===cw,gp:equal(gp,afterGP),cpuFlags:cpuFlags===0xed7,cached:cache.stores===(seed===0&&repeat===0?1:0)&&((seed===0&&repeat===0)||cache.hits===1)};
   rows.push({top,vector:v.id,precision,rc,seed,repeat,cache,image:before.images[top],shadow:before.fp.slice(top*16,top*16+16),sw,wantSW,checks,pass:Object.values(checks).every(Boolean)});
  }
 }
 const failureCounts={};for(const r of rows)for(const [k,v]of Object.entries(r.checks))if(!v)failureCounts[k]=(failureCounts[k]||0)+1;
 const result={module:file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),cases:rows.length,failures:rows.filter(r=>!r.pass).length,failureCounts,firstFailure:rows.find(r=>!r.pass),rows};if(out)fs.writeFileSync(out,JSON.stringify(result,null,2));console.log(JSON.stringify({...result,rows:undefined}));if(result.failures)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=2;});
