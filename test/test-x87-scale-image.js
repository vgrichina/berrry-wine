'use strict';
const fs=require('fs'),a=require('assert/strict'),crypto=require('crypto');

// Before-candidate literal mantissa/SE oracles: scaling adds trunc(ST1) to biased exponent.
const vectors=[
 ['max-scale-retained-near32766','8000000000000001',1,'fffbffffffffffff',16397,32766],
 ['max-negative-scale-retained-near32766','ffffffffffffffff',32766,'fffbffffffffffff',49165,1],
 ['negative-max-scale','8000000000000001',32769,'fffa000000000000',16397,65534],
 ['negative-max-down','ffffffffffffffff',65534,'fffa000000000000',49165,32769],
 ['tiny-up','8000000000000001',1,'8000000000000000',16383,2],
 ['tiny-to-mid','ffffffffffffffff',1,'8000000000000000',16396,8193],
 ['huge-down','8000000000000001',32766,'8000000000000000',49151,32765],
 ['huge-to-mid','ffffffffffffffff',32766,'8000000000000000',49164,24574],
 ['lowbits-plus-trunc','a000000000000001',16384,'bfffffffffffffff',16384,16386],
 ['lowbits-minus-trunc','ffffffffffffffff',16384,'bfffffffffffffff',49152,16382],
 ['plus-near3','8000000000000001',20000,'bfffffffffffffff',16384,20002],
 ['minus-near3','8000000000000001',10000,'bfffffffffffffff',49152,9998],
 ['tiny-scale-trunc-zero','a000000000000001',1,'ffffffffffffffff',1,1],
 ['huge-negative-tiny-scale','8000000000000001',65534,'8000000000000001',32769,65534],
 ['largest-normal-noop','ffffffffffffffff',32766,'0000000000000000',0,32766],
 ['positive-zero','0000000000000000',0,'8000000000000000',16396,0],
 ['negative-zero','0000000000000000',32768,'8000000000000000',49164,32768],
 ['negative-tiny-up','ffffffffffffffff',32769,'8000000000000000',16383,32770]
].map(([id,mant,se,nmant,nse,wse])=>({id,mant,se,nmant,nse,want:[mant,wse]}));

const le=x=>[x&255,x>>>8&255,x>>>16&255,x>>>24];
async function main(){
 const [file='build/wine-assembly.wasm',regionFile,out]=process.argv.slice(2),bytes=fs.readFileSync(file),mod=await WebAssembly.compile(bytes),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),imports={};
 for(const i of WebAssembly.Module.imports(mod))(imports[i.module]||={})[i.name]=i.kind==='memory'?memory:i.name==='math_log2'?Math.log2:i.name==='math_pow2'?x=>2**x:()=>0;
 const e=new WebAssembly.Instance(mod,imports).exports,mem=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer),g=x=>e.guest_to_wasm(x)>>>0;
 const pe=fs.readFileSync('test/binaries/notepad.exe');mem.set(pe,e.get_staging());a(e.load_pe(pe.length));e.set_fault_unmapped(2);e.set_uop(0);e.set_esp(0x1108000);
 const regions=(regionFile ? JSON.parse(fs.readFileSync(regionFile)) : require('../tools/region-layout').layout().regions),base=n=>regions.find(r=>r.name==='$'+n).base,fp=base('FPU_FILE'),meta=base('FPU_IMAGE_META');
 const input=0xc02000,env=0xc05000,swp=0xc07000;let pc=0x1820000;
 function exec(b,at){if(at===undefined){at=pc;pc+=128;mem.set([...b,0xeb,0],g(at));}e.clear_yield();e.set_eip(at);e.run(1);return at;}
 function load(mant,se){dv.setBigUint64(g(input),BigInt('0x'+mant),true);dv.setUint16(g(input)+8,se,true);exec([0xdb,0x2d,...le(input)]);}
 function state(){const mant=Array.from({length:8},(_,i)=>BigInt.asUintN(64,e.get_mmx(i)).toString(16).padStart(16,'0'));return {top:e.get_fpu_top(),tags:e.get_fpu_tags(),fp:Buffer.from(mem.slice(fp,fp+128)).toString('hex'),meta:Buffer.from(mem.slice(meta,meta+32)).toString('hex'),images:mant.map((m,i)=>[m,dv.getUint16(meta+2*i,true)])};}
 const rows=[];
 for(const top of [2,5])for(const v of vectors)for(const precision of [0,2,3])for(let rc=0;rc<4;rc++){
  const at=pc;pc+=128;mem.set([0xd9,0xfd,0xeb,0],g(at));
  for(const seed of [0,0x23f])for(let repeat=0;repeat<2;repeat++){
   exec([0xdb,0xe3]);[0x7f|(precision<<8)|(rc<<10),top<<11,0xffff,0,0,0,0].forEach((x,i)=>e.guest_write32(env+i*4,x));exec([0xd9,0x25,...le(env)]);
   // Seven live exact physical neighbors, all with distinct low deciding bits.
   for(let i=0;i<6;i++)load((0x9000000000000001n+BigInt(i)).toString(16),16400+i);
   // Seed before the source load: FLDENV must not erase the FILD shadow.
   exec([0xd9,0x35,...le(env)]);dv.setUint16(g(env)+4,(((top+2)&7)<<11)|seed,true);exec([0xd9,0x25,...le(env)]);
   load(v.nmant,v.nse);
   if(v.integer){dv.setBigInt64(g(input),BigInt(v.integer),true);exec([0xdf,0x2d,...le(input)]);}
   else load(v.mant,v.se);
   a.equal(e.get_fpu_sw()&0x23f,seed);
   const before=state();a.deepEqual(before.images[top],[v.mant,v.se]);a.equal(before.top,top);
   const hits=e.get_page_hits(),stores=e.get_cache_stores();exec(null,at);const cache={hits:e.get_page_hits()-hits,stores:e.get_cache_stores()-stores};const after=state();exec([0xdd,0x3d,...le(swp)]);const sw=dv.getUint16(g(swp),true);
   exec([0xdb,0x3d,...le(input+64)]);const stored=[dv.getBigUint64(g(input+64),true).toString(16).padStart(16,'0'),dv.getUint16(g(input+64)+8,true)];
   const checks={store:JSON.stringify(stored)===JSON.stringify(v.want),pop:e.get_fpu_top()===((top+1)&7),st1AfterPop:BigInt.asUintN(64,e.get_mmx((top+1)&7)).toString(16).padStart(16,'0')===v.nmant,image:JSON.stringify(after.images[top])===JSON.stringify(v.want),PE:(sw&32)===(seed&32),C1:((sw>>>9)&1)===0,sticky:(sw&31)===(seed&31),ES:(sw&0x80)===0,top:after.top===top,tags:after.tags===before.tags,neighbors:after.images.every((x,i)=>i===top||JSON.stringify(x)===JSON.stringify(before.images[i])),neighborFP:Buffer.from(after.fp,'hex').every((x,i)=>i>=top*8&&i<top*8+8||x===Buffer.from(before.fp,'hex')[i]),meta:Buffer.from(after.meta,'hex').every((x,i)=>i>=top*2&&i<top*2+2||x===Buffer.from(before.meta,'hex')[i]),cached:cache.stores===(seed===0&&repeat===0?1:0)&&((seed===0&&repeat===0)||cache.hits===1)};
   rows.push({top,vector:v.id,precision,rc,seed,repeat,cache,source:before.images[top],got:after.images[top],want:v.want,sw,expected:{pe:0,c1:0},checks,pass:Object.values(checks).every(Boolean)});
  }
 }
 const failureCounts={};for(const r of rows)for(const [k,v]of Object.entries(r.checks))if(!v)failureCounts[k]=(failureCounts[k]||0)+1;
 const result={module:file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),cases:rows.length,failures:rows.filter(r=>!r.pass).length,failureCounts,firstFailure:rows.find(r=>!r.pass),rows};if(out)fs.writeFileSync(out,JSON.stringify(result,null,2));console.log(JSON.stringify({...result,rows:undefined}));if(result.failures)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=2;});
