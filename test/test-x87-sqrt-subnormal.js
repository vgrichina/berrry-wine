'use strict';
// Bounded production default; fourth argument full covers all 13320 rows.
// declines records observational fallback preservation; no exception oracle.

const fs=require('fs'),a=require('assert/strict'),crypto=require('crypto'),zlib=require('zlib');
// Fixed odd-square literals, independently checked by exact multiplication.
// Subnormal x=M*2^-16445. Root=R*2^(re-16446), hence
// R^2=M*2^(16447-2*re). No sqrt or recognizer is used by this oracle.
const odd=[['one','1','8000000000000000',1],['three','9','c000000000000000',2],['five','19','a000000000000000',3],['seven','31','e000000000000000',3],['eleven','79','b000000000000000',4],['pc24-max','fffffe000001','ffffff0000000000',24],['pc25-low','1000002000001','8000008000000000',25],['pc31-max','3fffffff00000001','fffffffe00000000',31]];
const vectors=[];
for(const [id,square,r,bits]of odd)for(const t of id==='one'?Array.from({length:31},(_,i)=>2*i+1):[1,3,7,15,31,47,61]){
 const M=BigInt('0x'+square)<<BigInt(t);if(M>=1n<<63n)continue;
 const re=16383+bits-1+(t-16445)/2,R=BigInt('0x'+r);
 a.equal(R*R,M<<BigInt(16447-2*re),id+'@'+t);
 a(M>0n&&M<1n<<63n);a(re>0&&re<32767);a.equal(R.toString(2).replace(/0+$/,'').length,bits);
 vectors.push({id:id+'@'+t,m:M.toString(16).padStart(16,'0'),se:0,r,re,bits,t});
}
const seeds=[0,1,2,4,8,16,32,0x200,0x477f],le=x=>[x&255,x>>>8&255,x>>>16&255,x>>>24];
const oracle={vectors,seeds,precision:[0,2,3],rounding:[0,1,2,3],DE:1,C1:0,newPE:0,definedSWMask:0xbaff};
if(process.argv[2]==='--oracle'){console.log(JSON.stringify(oracle,null,2));process.exit(0);}
async function main(){
 const [file='build/wine-assembly.wasm',rf,out='x87-sqrt-subnormal.json',mode='bounded']=process.argv.slice(2),bytes=fs.readFileSync(file),mod=await WebAssembly.compile(bytes),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),imports={};
 for(const i of WebAssembly.Module.imports(mod))(imports[i.module]||={})[i.name]=i.kind==='memory'?memory:i.name==='math_log2'?Math.log2:i.name==='math_pow2'?x=>2**x:()=>0;
 const e=new WebAssembly.Instance(mod,imports).exports,mem=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer),g=x=>e.guest_to_wasm(x)>>>0;
 const pe=fs.readFileSync('test/binaries/notepad.exe');mem.set(pe,e.get_staging());a(e.load_pe(pe.length));e.set_fault_unmapped(2);e.set_uop(0);e.set_esp(0x1108000);
 // MMX_FILE is a fixed subregion alias, not an allocated region-map entry.
 // Resolve its source-declared offset through the allocator's UOP_CSCRATCH base.
 const regions=(rf?JSON.parse(fs.readFileSync(rf)):require('../tools/region-layout').layout().regions),base=n=>regions.find(r=>r.name==='$'+n).base,fp=base('FPU_FILE'),meta=base('FPU_IMAGE_META'),mmx=base('UOP_CSCRATCH')+0x139800;
 const input=0xc02000,env=0xc05000,flags=0xc07000,dest=0xc08000;let pc=0x1820000;
 const setup=new Map();function exec(b,at){if(at===undefined){const key=b.join(',');at=setup.get(key);if(at===undefined){at=pc;pc+=128;setup.set(key,at);mem.set([...b,235,0],g(at));}}e.clear_yield();e.set_eip(at);e.run(1);return at;}
 function load(m,se){dv.setBigUint64(g(input),BigInt('0x'+m),true);dv.setUint16(g(input)+8,se,true);exec([219,45,...le(input)]);}
 const regs=['eax','ecx','edx','ebx','esp','ebp','esi','edi'],hex=(p,n)=>Buffer.from(mem.subarray(p,p+n)).toString('hex');
 function state(){return {top:e.get_fpu_top(),tags:e.get_fpu_tags(),fp:hex(fp,128),meta:hex(meta,32),images:Array.from({length:8},(_,p)=>[dv.getBigUint64(mmx+p*8,true).toString(16).padStart(16,'0'),dv.getUint16(meta+2*p,true)]),gp:regs.map(r=>e['get_'+r]()),sw:e.get_fpu_sw()};}
 const equal=(x,y)=>JSON.stringify(x)===JSON.stringify(y),failureCounts={};let cases=0,failures=0,cold=0,cachedHits=0,firstFailure=null;
 const rawHash=crypto.createHash('sha256'),gzHash=crypto.createHash('sha256');let lines=[],rawBytes=0,gzipBytes=0,chunks=0;
 const fd=fs.openSync(out+'.rows.jsonl.gz','w');
 function flush(){if(!lines.length)return;const raw=Buffer.from(lines.join('')),gz=zlib.gzipSync(raw,{level:1});a.deepEqual(zlib.gunzipSync(gz),raw);rawHash.update(raw);gzHash.update(gz);rawBytes+=raw.length;gzipBytes+=gz.length;fs.writeSync(fd,gz);lines=[];chunks++;const stat=fs.statfsSync('/home');a(stat.bavail*stat.bsize>1500000000,'HOME disk floor');}
 const emitted=new Set();
 function executeCase(top,v,precision,rc,seed,at,extra={}){
   exec([219,227]);const cw=(0x7f|(precision<<8)|(rc<<10))&~(extra.unmask||0);
   [cw,top<<11,0xffff,0,0,0,0].forEach((x,i)=>e.guest_write32(env+i*4,x));exec([217,37,...le(env)]);
   for(let i=7;i>=0;i--)load(i===0?v.m:'900000000000000'+i,i===0?v.se:16400+i);
   for(let p=0;p<8;p++)dv.setBigUint64(fp+64+p*8,0x1122334455667700n+BigInt(p),true);
   exec([217,53,...le(env)]);dv.setUint16(g(env),cw,true);dv.setUint16(g(env)+4,(top<<11)|seed,true);
   if(extra.empty)dv.setUint16(g(env)+8,3<<(top*2),true);
   exec([217,37,...le(env)]);
   if(extra.noImage)dv.setUint32(meta+16,dv.getUint32(meta+16,true)&~(1<<top),true);
   exec([104,...le(0xed7),157]);const before=state();a.equal(before.top,top);a.equal(e.get_fpu_sw(),seed);a.deepEqual(before.images[top],[v.m,v.se]);
   const want=structuredClone(before.images),wantFP=Buffer.from(before.fp,'hex'),wantMeta=Buffer.from(before.meta,'hex');
   if(mode!=='declines'){
    want[top]=[v.r,v.re];wantMeta.writeUInt16LE(v.re,top*2);
    // A <=32-bit root significand converts exactly to binary64. Range collapse
    // is only the existing representation contract; exact80 stays canonical.
    wantFP.writeDoubleLE(Number(BigInt('0x'+v.r))/2**63*2**(v.re-16383),top*8);
   }
   const hits=e.get_page_hits(),stores=e.get_cache_stores();exec(null,at);const cache={hits:e.get_page_hits()-hits,stores:e.get_cache_stores()-stores},after=state();
   exec([221,61,...le(env+64)]);const sw=dv.getUint16(g(env+64),true);exec([217,53,...le(env+96)]);const gotCW=dv.getUint16(g(env+96),true);exec([156,143,5,...le(flags)]);const cpuFlags=dv.getUint32(g(flags),true);
   mem.fill(0xa5,g(dest),g(dest+144));const stored=[];
   for(let i=0;i<8;i++){const addr=dest+8+i*16;exec([219,61,...le(addr)]);stored.push([dv.getBigUint64(g(addr),true).toString(16).padStart(16,'0'),dv.getUint16(g(addr)+8,true)]);}
   const post=state(),storeBuffer=hex(g(dest),144),wasCold=!emitted.has(at);emitted.add(at);
   const checks={cache:cache.stores===(wasCold?1:0)&&(wasCold||cache.hits===1),storeBounds:mem.subarray(g(dest),g(dest+144)).every((v,i)=>i>=8&&i<136&&((i-8)%16)<10||v===0xa5)};
   if(mode!=='declines')Object.assign(checks,{images:equal(after.images,want),allFP:after.fp===wantFP.toString('hex'),allMeta:after.meta===wantMeta.toString('hex'),C1:(sw&0x200)===0,definedSW:(sw&0xbaff)===((((top<<11)|seed)&0xb8ff)|2),tags:after.tags===255,top:after.top===top,cw:gotCW===cw,gp:equal(after.gp,before.gp),flags:cpuFlags===0xed7,stores:equal(stored,Array.from({length:8},(_,i)=>want[(top+i)&7])),storeImages:equal(post.images,after.images),storeFP:post.fp===after.fp,storeMeta:post.meta===after.meta,storeTOP:post.top===top,storeTags:post.tags===0});
   const pass=Object.values(checks).every(Boolean);cases++;if(cache.stores===1)cold++;if(cache.hits===1&&cache.stores===0)cachedHits++;if(!pass){failures++;for(const [k,v]of Object.entries(checks))if(!v)failureCounts[k]=(failureCounts[k]||0)+1;}
   const row={top,vector:v.id,input:[v.m,v.se],expected:mode==='declines'?null:[v.r,v.re],precision,rc,seed,extra,cache,before,after,post,sw,cw:gotCW,cpuFlags,stored,storeBuffer,checks,pass};if(!pass&&!firstFailure)firstFailure=row;lines.push(JSON.stringify(row)+'\n');if(lines.length===512)flush();
 }
 for(const top of [2,5]){
  if(['bounded','selected','full'].includes(mode))for(const v of vectors)for(const precision of v.bits<=24?[0,2,3]:[2,3])for(let rc=0;rc<4;rc++){
   const at=pc;pc+=128;mem.set([217,250,235,0],g(at));
   for(const seed of mode==='bounded'?[0,0x200,0x477f]:seeds)executeCase(top,v,precision,rc,seed,at);
  }
  else if(mode==='declines'){
   const declined=[['negative','0000000000000002',32768,{}],['nonsquare','0000000000000006',0,{}],['odd-exponent','0000000000000001',0,{}],['pc24-inexact','0002000004000002',0,{pc:0}],['reserved','0000000000000012',0,{pc:1}],['invalid-image','0000000000000012',0,{noImage:true}],['empty','0000000000000012',0,{empty:true}],...Array.from({length:6},(_,i)=>['unmask'+i,'0000000000000012',0,{unmask:1<<i}])];
   for(const [id,m,se,extra]of declined)for(const precision of extra.pc!==undefined?[extra.pc]:[0,2,3])for(let rc=0;rc<4;rc++){
    const at=pc;pc+=128;mem.set([217,250,235,0],g(at));for(const seed of [0,0x23f])executeCase(top,{id,m,se},precision,rc,seed,at,extra);
   }
  }else throw Error('unknown mode');
 }
 flush();fs.fsyncSync(fd);fs.closeSync(fd);
 const result={mode,module:file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),cases,cold,cachedHits,failures,failureCounts,firstFailure,rowsFile:out+'.rows.jsonl.gz',rawBytes,rawSHA256:rawHash.digest('hex'),gzipBytes,gzipSHA256:gzHash.digest('hex'),chunks,eachChunkDecompressionByteExact:true};fs.writeFileSync(out,JSON.stringify(result,null,2));console.log(JSON.stringify({...result,firstFailure:firstFailure?{vector:firstFailure.vector,checks:firstFailure.checks}:null}));if(failures)process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=2;});
