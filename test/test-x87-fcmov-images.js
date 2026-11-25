'use strict';
// Default bounded matrix; explicit fourth argument full runs all 147456 rows.
// excluded is observational preservation only. Inputs/regions/output may be supplied.

const fs=require('fs'),a=require('assert/strict'),crypto=require('crypto'),z=require('zlib'),{once}=require('events');
// Fixed before execution. Mantissas intentionally include bits below f64 precision.
const packs=[[
 ['negative-zero','0000000000000000',0x8000],['one+ulp80','8000000000000001',0x3fff],
 ['negative-near-two','ffffffffffffffff',0xbfff],['huge-normal','8123456789abcdef',0x7000],
 ['tiny-normal','fedcba9876543210',0x0001],['smallest-subnormal','0000000000000001',0],
 ['positive-infinity','8000000000000000',0x7fff],['negative-qnan-payload','c123456789abcdef',0xffff]
],[
 ['positive-qnan-lowpayload','c000000000000001',0x7fff],['positive-zero','0000000000000000',0],
 ['negative-subnormal','7fffffffffffffff',0x8000],['negative-infinity','8000000000000000',0xffff],
 ['negative-tiny-normal','8000000000000001',0x8001],['positive-max-normal','ffffffffffffffff',0x7ffe],
 ['negative-qnan-maxpayload','ffffffffffffffff',0xffff],['two','8000000000000000',0x4000]
]];
// Column order is B,E,BE,U,NB,NE,NBE,NU. CF,ZF,PF vary independently.
const truth=[
 [0,0,0,[0,0,0,0,1,1,1,1]],[1,0,0,[1,0,1,0,0,1,0,1]],
 [0,1,0,[0,1,1,0,1,0,0,1]],[1,1,0,[1,1,1,0,0,0,0,1]],
 [0,0,1,[0,0,0,1,1,1,1,0]],[1,0,1,[1,0,1,1,0,1,0,0]],
 [0,1,1,[0,1,1,1,1,0,0,0]],[1,1,1,[1,1,1,1,0,0,0,0]]
];
const forms=['B','E','BE','U','NB','NE','NBE','NU'],modes=[[0,0],[2,1],[3,2],[3,3]],seeds=[0,1,2,4,8,16,32,0x200,0x477f];
const excluded=[['snan-min','8000000000000001',0x7fff],['snan-negative','bfffffffffffffff',0xffff],['unsupported-q','4000000000000001',0x7fff],['pseudo-inf','0000000000000000',0x7fff],['unnormal','4000000000000000',0x3fff],['pseudo-denormal','8000000000000000',0],['invalid-image','c000000000000001',0x7fff],['empty','c000000000000001',0x7fff],...Array.from({length:6},(_,i)=>['unmasked-'+i,'c000000000000001',0x7fff])];
const le=x=>[x&255,x>>>8&255,x>>>16&255,x>>>24],equal=(x,y)=>JSON.stringify(x)===JSON.stringify(y),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
if(process.argv[2]==='--oracle'){console.log(JSON.stringify({packs,truth,forms,modes,seeds,excluded,definedSWmask:0xb8ff},null,2));process.exit(0);}
async function main(){
 const [file='build/wine-assembly.wasm',rf,out='x87-fcmov-images.json',mode='bounded']=process.argv.slice(2),bytes=fs.readFileSync(file),mod=await WebAssembly.compile(bytes),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),imports={};
 for(const i of WebAssembly.Module.imports(mod))(imports[i.module]||={})[i.name]=i.kind==='memory'?memory:i.name==='math_log2'?Math.log2:i.name==='math_pow2'?x=>2**x:()=>0;
 const e=new WebAssembly.Instance(mod,imports).exports,mem=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer),g=x=>e.guest_to_wasm(x)>>>0;
 const pe=fs.readFileSync('test/binaries/notepad.exe');mem.set(pe,e.get_staging());a(e.load_pe(pe.length));e.set_fault_unmapped(2);e.set_uop(0);e.set_esp(0x1108000);
 const regions=rf?JSON.parse(fs.readFileSync(rf)):require(process.cwd()+'/tools/region-layout').layout().regions,base=n=>regions.find(r=>r.name==='$'+n).base,fp=base('FPU_FILE'),meta=base('FPU_IMAGE_META'),mmx=base('UOP_CSCRATCH')+0x139800;
 const input=0xc02000,env=0xc05000,flags=0xc07000,dest=0xc08000;let pc=0x1820000;
 const setup=new Map();function exec(b,at){if(at===undefined){const key=b.join(',');at=setup.get(key);if(at===undefined){at=pc;pc+=128;setup.set(key,at);mem.set([...b,235,0],g(at));}}e.clear_yield();e.set_eip(at);e.run(1);return at;}
 function load(v){dv.setBigUint64(g(input),BigInt('0x'+v[1]),true);dv.setUint16(g(input)+8,v[2],true);exec([219,45,...le(input)]);}
 const regs=['eax','ecx','edx','ebx','esp','ebp','esi','edi'];
 // Read physical memory directly; get_mmx materializes invalid images and is unsuitable here.
 function state(){return {top:e.get_fpu_top(),tags:e.get_fpu_tags(),fp:Buffer.from(mem.slice(fp,fp+128)).toString('hex'),meta:Buffer.from(mem.slice(meta,meta+32)).toString('hex'),images:Array.from({length:8},(_,p)=>[dv.getBigUint64(mmx+p*8,true).toString(16).padStart(16,'0'),dv.getUint16(meta+2*p,true)]),gp:regs.map(r=>e['get_'+r]())};}
 const gz=z.createGzip({level:6}),stream=fs.createWriteStream(out+'.rows.jsonl.gz');gz.pipe(stream);const hash=crypto.createHash('sha256');let rawBytes=0;
 async function row(r){const b=Buffer.from(JSON.stringify(r)+'\n');hash.update(b);rawBytes+=b.length;if(!gz.write(b))await once(gz,'drain');}
 let cases=0,failures=0,traps=0,cold=0,cachedHits=0,firstFailure=null;const failureCounts={},perCondition=Object.fromEntries(forms.map(x=>[x,{cases:0,taken:0,untaken:0,failures:0,traps:0}]));
 const variants=mode==='excluded'?excluded.flatMap((v,i)=>[false,true].map(badDest=>({source:[...packs[0]],excluded:v,id:i*2+Number(badDest),badDest}))):packs.map((source,id)=>({source,id}));
 for(const top of [2,5])for(const variant of variants)for(let ci=0;ci<8;ci++)for(let rm=0;rm<8;rm++)for(const [precision,rc]of (mode==='excluded'?[[3,0]]:mode==='bounded'?[modes[0],modes[3]]:modes)){
  const at=pc;pc+=128;mem.set([ci<4?218:219,192+(ci%4)*8+rm,235,0],g(at));
  for(const seed of (mode==='excluded'||mode==='bounded'?[0,0x477f]:seeds))for(let ti=0;ti<truth.length;ti++)for(let repeat=0;repeat<2;repeat++){
   exec([219,227]);const v=variant.excluded,cw=(0x7f|(precision<<8)|(rc<<10))&~(v&&v[0].startsWith('unmasked-')?(1<<Number(v[0].slice(9))):0);
   [cw,top<<11,0xffff,0,0,0,0].forEach((x,i)=>e.guest_write32(env+i*4,x));exec([217,37,...le(env)]);
   const source=variant.source.map(x=>[...x]);const badIndex=variant.badDest?0:rm;if(v)source[badIndex]=v;
   for(let i=7;i>=0;i--)load(source[i]);
   // Distinct invalid shadow bytes; valid integral lanes retain their seeded load shadows.
   for(let p=0;p<8;p++)if(!['two','positive-zero','negative-zero'].includes(source[(p-top+8)&7][0]))dv.setBigUint64(fp+64+p*8,0x1122334455667700n+BigInt(p),true);
   exec([217,53,...le(env)]);dv.setUint16(g(env),cw,true);dv.setUint16(g(env)+4,(top<<11)|seed,true);
   if(v?.[0]==='empty')dv.setUint16(g(env)+8,3<<(((top+badIndex)&7)*2),true);
   exec([217,37,...le(env)]);dv.setUint32(meta+16,255&~(v?.[0]==='invalid-image'?(1<<((top+badIndex)&7)):0),true);
   const [cf,zf,pf,table]=truth[ti],cpuSeed=0xe92|(cf?1:0)|(zf?0x40:0)|(pf?4:0);exec([104,...le(cpuSeed),157]);const before=state(),q=(top+rm)&7,taken=!!table[ci];
   const want=structuredClone(before.images),wantFP=Buffer.from(before.fp,'hex'),wantMeta=Buffer.from(before.meta,'hex');
   if(taken){want[top]=[...want[q]];for(const off of [0,64])wantFP.set(Buffer.from(wantFP.subarray(off+q*8,off+q*8+8)),off+top*8);wantMeta.writeUInt16LE(want[q][1],top*2);}
   const hits=e.get_page_hits(),stores=e.get_cache_stores();let trap=null;try{exec(null,at);}catch(err){trap={name:err.name,message:err.message};}
   const cache={hits:e.get_page_hits()-hits,stores:e.get_cache_stores()-stores},after=state();
   exec([221,61,...le(env+64)]);const sw=dv.getUint16(g(env+64),true);exec([217,53,...le(env+96)]);const gotCW=dv.getUint16(g(env+96),true);exec([156,143,5,...le(flags)]);const cpuFlags=dv.getUint32(g(flags),true);
   mem.fill(0xa5,g(dest),g(dest+144));const stored=[];
   for(let i=0;i<8;i++){const addr=dest+8+i*16;exec([219,61,...le(addr)]);stored.push([dv.getBigUint64(g(addr),true).toString(16).padStart(16,'0'),dv.getUint16(g(addr)+8,true)]);}
   const post=state(),storeBuffer=Buffer.from(mem.slice(g(dest),g(dest+144))).toString('hex');
   const checks={noTrap:trap===null,images:equal(after.images,want),allFP:after.fp===wantFP.toString('hex'),allMeta:after.meta===wantMeta.toString('hex'),definedSW:(sw&0xb8ff)===(((top<<11)|seed)&0xb8ff),fullSWimplementation:sw===((top<<11)|seed),tags:after.tags===before.tags,top:after.top===top,cw:gotCW===cw,gp:equal(after.gp,before.gp),flags:cpuFlags===cpuSeed,stores:equal(stored,Array.from({length:8},(_,i)=>want[(top+i)&7])),storeBounds:mem.slice(g(dest),g(dest+144)).every((v,i)=>i>=8&&i<136&&((i-8)%16)<10||v===0xa5),storeImages:equal(post.images,after.images),storeFP:post.fp===after.fp,storeMeta:post.meta===after.meta,storeTOP:post.top===top,storeTags:post.tags===0,cached:cache.stores===(seed===0&&ti===0&&repeat===0?1:0)&&((seed===0&&ti===0&&repeat===0)||cache.hits===1)};
   const pass=mode==='excluded'?null:Object.values(checks).every(Boolean);cases++;const c=perCondition[forms[ci]];c.cases++;c[taken?'taken':'untaken']++;if(trap){traps++;c.traps++;}if(cache.stores===1)cold++;if(cache.hits===1&&cache.stores===0)cachedHits++;
   if(pass===false){failures++;c.failures++;for(const [k,v]of Object.entries(checks))if(!v)failureCounts[k]=(failureCounts[k]||0)+1;}
   const r={top,variant:variant.id,excluded:v?.[0]||null,ci,rm,precision,rc,seed,ti,repeat,taken,cache,trap,before,after,post,sw,cw:gotCW,cpuFlags,stored,storeBuffer,...(mode==='excluded'?{}:{checks,pass})};if(pass===false&&!firstFailure)firstFailure=r;await row(r);
  }
 }
 gz.end();await once(stream,'close');const result={module:file,sha256:sha(bytes),mode,cases,cold,cachedHits,traps,failures,failureCounts,perCondition,firstFailure,rowsFile:out+'.rows.jsonl.gz',rawBytes,rawSha256:hash.digest('hex')};fs.writeFileSync(out,JSON.stringify(result,null,2));console.log(JSON.stringify({...result,firstFailure:firstFailure?{ci:firstFailure.ci,checks:firstFailure.checks}:null}));if(failures)process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=2;});
