'use strict';
const fs=require('fs'),a=require('assert/strict'),crypto=require('crypto');

// Literal primary-spec oracles. Array order: nearest-even, down, up, zero.
const images={
 p0:['0000000000000000',0],n0:['0000000000000000',32768],
 p1:['8000000000000000',16383],n1:['8000000000000000',49151],
 p2:['8000000000000000',16384],n2:['8000000000000000',49152],
 p3:['c000000000000000',16384],n3:['c000000000000000',49152],
 p4:['8000000000000000',16385],n4:['8000000000000000',49153],
 p63:['8000000000000000',16446],n63:['8000000000000000',49214],
 pMax63:['fffffffffffffffe',16445],nMax63:['fffffffffffffffe',49213]
};
const vectors=[
 ['plus-1.5','c000000000000000',16383,['p2','p1','p2','p1'],[1,0,1,0]],
 ['minus-1.5','c000000000000000',49151,['n2','n2','n1','n1'],[1,1,0,0]],
 ['plus-2.5','a000000000000000',16384,['p2','p2','p3','p2'],[0,0,1,0]],
 ['minus-2.5','a000000000000000',49152,['n2','n3','n2','n2'],[0,1,0,0]],
 ['plus-retained-above-2.5','a000000000000001',16384,['p3','p2','p3','p2'],[1,0,1,0]],
 ['minus-retained-above-2.5','a000000000000001',49152,['n3','n3','n2','n2'],[1,1,0,0]],
 ['plus-retained-below-1.5','bfffffffffffffff',16383,['p1','p1','p2','p1'],[0,0,1,0]],
 ['minus-retained-below-1.5','bfffffffffffffff',49151,['n1','n2','n1','n1'],[0,1,0,0]],
 ['plus-0.5','8000000000000000',16382,['p0','p0','p1','p0'],[0,0,1,0]],
 ['minus-0.5','8000000000000000',49150,['n0','n1','n0','n0'],[0,1,0,0]],
 ['plus-tiny-normal','8000000000000000',1,['p0','p0','p1','p0'],[0,0,1,0]],
 ['minus-tiny-normal','8000000000000000',32769,['n0','n1','n0','n0'],[0,1,0,0]],
 ['plus-3.5','e000000000000000',16384,['p4','p3','p4','p3'],[1,0,1,0]],
 ['minus-3.5','e000000000000000',49152,['n4','n4','n3','n3'],[1,1,0,0]],
 ['boundary-plus-below-2p63-half','ffffffffffffffff',16445,['p63','pMax63','p63','pMax63'],[1,0,1,0]],
 ['boundary-minus-below-2p63-half','ffffffffffffffff',49213,['n63','n63','nMax63','nMax63'],[1,1,0,0]],
].map(([id,mant,se,want,c1])=>({id,mant,se,want:want.map(x=>images[x]),c1,pe:1}));
for(const [id,mant,se,integer] of [
 ['plus-zero','0000000000000000',0],['minus-zero','0000000000000000',32768],
 ['exact-plus-two','8000000000000000',16384],['exact-minus-two','8000000000000000',49152],
 ['fild-plus-2p53-plus1','8000000000000400',16436,'9007199254740993'],
 ['fild-minus-2p53-plus3','8000000000000c00',49204,'-9007199254740995'],
 ['fild-max-signed64','fffffffffffffffe',16445,'9223372036854775807'],
 ['fild-min-signed64','8000000000000000',49214,'-9223372036854775808'],
 ['plus-2p63','8000000000000000',16446],['minus-2p63','8000000000000000',49214],
 ['plus-2p64-minus1','ffffffffffffffff',16446],['minus-2p64-minus1','ffffffffffffffff',49214],
 ['plus-2p1000-lowbit','8000000000000001',17383],['minus-2p1000-lowbit','8000000000000001',50151],
 ['plus-max-finite','ffffffffffffffff',32766],['minus-max-finite','ffffffffffffffff',65534],
 ['plus-infinity-control','8000000000000000',32767],['minus-infinity-control','8000000000000000',65535]
])vectors.push({id,mant,se,integer,want:Array(4).fill([mant,se]),c1:[0,0,0,0],pe:0});


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
 for(const v of vectors)for(const precision of [0,2,3])for(let rc=0;rc<4;rc++){
  const at=pc;pc+=128;mem.set([0xd9,0xfc,0xeb,0],g(at));
  for(const seed of [0,0x23f])for(let repeat=0;repeat<2;repeat++){
   exec([0xdb,0xe3]);[0x7f|(precision<<8)|(rc<<10),2<<11,0xffff,0,0,0,0].forEach((x,i)=>e.guest_write32(env+i*4,x));exec([0xd9,0x25,...le(env)]);
   // Seven live exact physical neighbors, all with distinct low deciding bits.
   for(let i=0;i<7;i++)load((0x9000000000000001n+BigInt(i)).toString(16),16400+i);
   // Seed before the source load: FLDENV must not erase the FILD shadow.
   exec([0xd9,0x35,...le(env)]);dv.setUint16(g(env)+4,(3<<11)|seed,true);exec([0xd9,0x25,...le(env)]);
   if(v.integer){dv.setBigInt64(g(input),BigInt(v.integer),true);exec([0xdf,0x2d,...le(input)]);}
   else load(v.mant,v.se);
   a.equal(e.get_fpu_sw()&0x23f,seed);
   const before=state();a.deepEqual(before.images[2],[v.mant,v.se]);a.equal(before.top,2);
   const hits=e.get_page_hits(),stores=e.get_cache_stores();exec(null,at);const cache={hits:e.get_page_hits()-hits,stores:e.get_cache_stores()-stores};const after=state();exec([0xdd,0x3d,...le(swp)]);const sw=dv.getUint16(g(swp),true);
   const checks={image:JSON.stringify(after.images[2])===JSON.stringify(v.want[rc]),PE:(sw&32)===((seed&32)|(v.pe?32:0)),C1:((sw>>>9)&1)===v.c1[rc],sticky:(sw&31)===(seed&31),ES:(sw&0x80)===0,top:after.top===2,tags:after.tags===before.tags,neighbors:after.images.every((x,i)=>i===2||JSON.stringify(x)===JSON.stringify(before.images[i])),neighborFP:Buffer.from(after.fp,'hex').every((x,i)=>i>=16&&i<24||x===Buffer.from(before.fp,'hex')[i]),meta:after.meta.slice(0,8)===before.meta.slice(0,8)&&after.meta.slice(12)===before.meta.slice(12),cached:cache.stores===(seed===0&&repeat===0?1:0)&&((seed===0&&repeat===0)||cache.hits===1)};
   rows.push({vector:v.id,precision,rc,seed,repeat,cache,source:before.images[2],got:after.images[2],want:v.want[rc],sw,expected:{pe:v.pe,c1:v.c1[rc]},checks,pass:Object.values(checks).every(Boolean)});
  }
 }
 const failureCounts={};for(const r of rows)for(const [k,v]of Object.entries(r.checks))if(!v)failureCounts[k]=(failureCounts[k]||0)+1;
 const result={module:file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),cases:rows.length,failures:rows.filter(r=>!r.pass).length,failureCounts,firstFailure:rows.find(r=>!r.pass),rows};if(out)fs.writeFileSync(out,JSON.stringify(result,null,2));console.log(JSON.stringify({...result,rows:undefined}));if(result.failures)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=2;});
