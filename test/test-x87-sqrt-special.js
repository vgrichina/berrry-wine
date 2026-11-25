'use strict';
const fs=require('fs'),a=require('assert/strict'),crypto=require('crypto');
// Literal sign outputs established from Intel before measuring either module.
const literals=[['zero+','0000000000000000',0],['zero-','0000000000000000',32768],['inf+','8000000000000000',32767]];
for(const se of [32767,65535])for(const mant of ['c000000000000000','c000000000000001','c0000000000007ff','c000000000000800','d23456789abcdef1','ffffffffffffffff'])literals.push(['q'+se+'-'+mant,mant,se]);
const forms=[['FSQRT',[217,250],'identity']];
const seeds=[0,1,2,4,8,16,32,0x200,0x477f],le=x=>[x&255,x>>>8&255,x>>>16&255,x>>>24];
if(process.argv[2]==='--oracle'){console.log(JSON.stringify({literals,forms,seeds,precision:[0,2,3],rounding:[0,1,2,3],C1:0,excluded:'empty/unsupported/unmasked',definedSWMask:0xbaff}));process.exit(0);}
async function main(){
 const [file='build/wine-assembly.wasm',rf,out='x87-sqrt-special.json']=process.argv.slice(2),bytes=fs.readFileSync(file),mod=await WebAssembly.compile(bytes),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),imports={};
 for(const i of WebAssembly.Module.imports(mod))(imports[i.module]||={})[i.name]=i.kind==='memory'?memory:i.name==='math_log2'?Math.log2:i.name==='math_pow2'?x=>2**x:()=>0;
 const e=new WebAssembly.Instance(mod,imports).exports,mem=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer),g=x=>e.guest_to_wasm(x)>>>0;
 const pe=fs.readFileSync('test/binaries/notepad.exe');mem.set(pe,e.get_staging());a(e.load_pe(pe.length));e.set_fault_unmapped(2);e.set_uop(0);e.set_esp(0x1108000);
 const regions=rf?JSON.parse(fs.readFileSync(rf)):require('../tools/region-layout').layout().regions,base=n=>regions.find(r=>r.name==='$'+n).base,fp=base('FPU_FILE'),meta=base('FPU_IMAGE_META');
 const input=0xc02000,env=0xc05000,flags=0xc07000,dest=0xc08000;let pc=0x1820000;
 const setup=new Map();function exec(b,at){if(at===undefined){const key=b.join(',');at=setup.get(key);if(at===undefined){at=pc;pc+=128;setup.set(key,at);mem.set([...b,235,0],g(at));}}e.clear_yield();e.set_eip(at);e.run(1);return at;}
 function load(v){dv.setBigUint64(g(input),BigInt('0x'+v[1]),true);dv.setUint16(g(input)+8,v[2],true);exec([219,45,...le(input)]);}
 const regs=['eax','ecx','edx','ebx','esp','ebp','esi','edi'];
 function state(){return {top:e.get_fpu_top(),tags:e.get_fpu_tags(),fp:Buffer.from(mem.slice(fp,fp+128)).toString('hex'),meta:Buffer.from(mem.slice(meta,meta+32)).toString('hex'),images:Array.from({length:8},(_,p)=>[BigInt.asUintN(64,e.get_mmx(p)).toString(16).padStart(16,'0'),dv.getUint16(meta+2*p,true)]),gp:regs.map(r=>e['get_'+r]())};}
 const equal=(x,y)=>JSON.stringify(x)===JSON.stringify(y),failureCounts={};let cases=0,failures=0,cold=0,cachedHits=0,firstFailure=null;
 const fd=fs.openSync(out+'.rows.jsonl','w');
 for(const top of [2,5])for(let vi=0;vi<literals.length;vi++)for(const [name,op,kind,rm=0]of forms)for(const precision of [0,2,3])for(let rc=0;rc<4;rc++){
  const at=pc;pc+=128;mem.set([...op,235,0],g(at));
  for(const seed of seeds)for(let repeat=0;repeat<2;repeat++){
   exec([219,227]);const cw=0x7f|(precision<<8)|(rc<<10);
   [cw,top<<11,0xffff,0,0,0,0].forEach((x,i)=>e.guest_write32(env+i*4,x));exec([217,37,...le(env)]);
   // All eight occupied canonical specials; rotating literal neighbors exercises
   // payload preservation without replaying positive finite arithmetic.
   const source=Array.from({length:8},(_,i)=>literals[(vi+i)%literals.length]);
   for(let i=7;i>=0;i--)load(source[i]);
   for(let p=0;p<8;p++)dv.setBigUint64(fp+64+p*8,0x1122334455667700n+BigInt(p),true);
   exec([217,53,...le(env)]);dv.setUint16(g(env),cw,true);dv.setUint16(g(env)+4,(top<<11)|seed,true);exec([217,37,...le(env)]);
   exec([104,...le(0xed7),157]);dv.setUint32(meta+16,255,true);const before=state();a.equal(Buffer.from(before.meta,'hex').readUInt32LE(16),255,'all eight valid physical images');a.equal(before.top,top);a.equal(before.tags,255);a.equal(e.get_fpu_sw(),seed);a.deepEqual(before.images[top],source[0].slice(1,3));
   const want=structuredClone(before.images),wantFP=Buffer.from(before.fp,'hex'),wantMeta=Buffer.from(before.meta,'hex'),q=(top+rm)&7;
   if(kind==='swap'){
    [want[top],want[q]]=[want[q],want[top]];
    for(const offset of [0,64]){const b=Buffer.from(wantFP.subarray(offset+top*8,offset+top*8+8));wantFP.copy(wantFP,offset+top*8,offset+q*8,offset+q*8+8);b.copy(wantFP,offset+q*8);}
   }
   if(kind==='neg'||kind==='abs'){
    want[top]=[source[0][1],source[0][kind==='neg'?3:4]];
    // Approximation is a signed infinity or quiet f64 NaN; exact payload lives
    // exclusively in the physical80 image. Invalid shadow is diagnostic only.
    const approximation=(source[0][0].startsWith('inf')?0x7ff0000000000000n:0x7ff8000000000000n)|(want[top][1]===65535?0x8000000000000000n:0n);
    wantFP.writeBigUInt64LE(approximation,top*8);
    if(kind==='neg')wantFP.writeBigInt64LE(-wantFP.readBigInt64LE(64+top*8),64+top*8);
   }
   for(let p=0;p<8;p++)wantMeta.writeUInt16LE(want[p][1],p*2);
   const hits=e.get_page_hits(),stores=e.get_cache_stores();exec(null,at);const cache={hits:e.get_page_hits()-hits,stores:e.get_cache_stores()-stores},after=state();
   exec([221,61,...le(env+64)]);const sw=dv.getUint16(g(env+64),true);exec([217,53,...le(env+96)]);const gotCW=dv.getUint16(g(env+96),true);exec([156,143,5,...le(flags)]);const cpuFlags=dv.getUint32(g(flags),true);
   mem.fill(0xa5,g(dest),g(dest+144));const stored=[];
   for(let i=0;i<8;i++){const addr=dest+8+i*16;exec([219,61,...le(addr)]);stored.push([dv.getBigUint64(g(addr),true).toString(16).padStart(16,'0'),dv.getUint16(g(addr)+8,true)]);}
   const post=state(),storeBuffer=Buffer.from(mem.slice(g(dest),g(dest+144))).toString('hex');
   const checks={images:equal(after.images,want),allFP:after.fp===wantFP.toString('hex'),allMeta:after.meta===wantMeta.toString('hex'),C1:(sw&0x200)===0,definedSW:(sw&0xbaff)===(((top<<11)|seed)&0xb8ff),tags:after.tags===255,top:after.top===top,cw:gotCW===cw,gp:equal(after.gp,before.gp),flags:cpuFlags===0xed7,stores:equal(stored,Array.from({length:8},(_,i)=>want[(top+i)&7])),storeBounds:mem.slice(g(dest),g(dest+144)).every((v,i)=>i>=8&&i<136&&((i-8)%16)<10||v===0xa5),storeImages:equal(post.images,after.images),storeFP:post.fp===after.fp,storeMeta:post.meta===after.meta,storeTOP:post.top===top,storeTags:post.tags===0,cached:cache.stores===(seed===0&&repeat===0?1:0)&&((seed===0&&repeat===0)||cache.hits===1)};
   const pass=Object.values(checks).every(Boolean);cases++;if(cache.stores===1)cold++;if(cache.hits===1&&cache.stores===0)cachedHits++;if(!pass){failures++;for(const [k,v]of Object.entries(checks))if(!v)failureCounts[k]=(failureCounts[k]||0)+1;}
   const row={top,vi,name,precision,rc,seed,repeat,cache,before,after,post,sw,cw:gotCW,cpuFlags,stored,storeBuffer,checks,pass};if(!pass&&!firstFailure)firstFailure=row;fs.writeSync(fd,JSON.stringify(row)+'\n');
  }
 }
 fs.fsyncSync(fd);fs.closeSync(fd);const result={module:file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),cases,cold,cachedHits,failures,failureCounts,firstFailure,rowsFile:out+'.rows.jsonl'};fs.writeFileSync(out,JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(failures)process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=2;});
