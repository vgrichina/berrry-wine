'use strict';
// Bounded default: 792 rows, 13 literals, 33 input/PC combinations in binades 0,1,2,48.
// Fourth argument full: 2376 rows with all nine seeds; declines observes fallback.

const fs=require('fs'),a=require('assert/strict'),crypto=require('crypto'),zlib=require('zlib');


const hx=m=>m.toString(16).padStart(16,'0');
const literals=[['two',0x8000000000000000n,16384],['three',0xc000000000000000n,16384],['five',0xa000000000000000n,16385]];
for(const r of [16777217n,16777219n])literals.push(['pc24-tie-root-'+r,r*r<<15n,16431,[0]]);
const mid24=(1n<<63n)+(1n<<40n)+(1n<<15n);
for(const delta of [-1n,0n,1n])literals.push(['pc24-mid-square'+delta,mid24+delta,16383,delta===0n?[0]:[0,2,3]]);
for(const delta of [0n,1n])literals.push(['pc53-mid-square'+delta,(1n<<63n)+(1n<<11n)+delta,16383]);
for(const delta of [1n,3n])literals.push(['pc64-near-mid'+delta,(1n<<63n)+delta,16383]);
literals.push(['below-four-carry',0xffffffffffffffffn,16384]);
const inputs=literals.map(([id,m,se,pcs=[0,2,3]])=>({id,m:hx(m),se,pcs}));
const bits=pc=>({0:24,2:53,3:64})[pc];
function isqrt(n){let lo=0n,hi=1n<<BigInt((n.toString(2).length+1)>>1);while(lo<hi){const mid=(lo+hi+1n)>>1n;if(mid*mid<=n)lo=mid;else hi=mid-1n;}return lo;}
function rational(m,se){let n=BigInt('0x'+m),d=1n,k=se-16446;if(k>=0)n<<=BigInt(k);else d<<=BigInt(-k);return {n,d};}
function expected(v,pc,rc){
 const p=bits(pc);a(p);let e=Math.floor((v.se-16383)/2);const shift=v.se-16446-2*e+2*(p-1);
 let n=BigInt('0x'+v.m),d=1n;if(shift>=0)n<<=BigInt(shift);else d<<=BigInt(-shift);
 const q=isqrt(n/d);a(q*q*d<=n&&(q+1n)*(q+1n)*d>n);a(q>=1n<<BigInt(p-1)&&q<1n<<BigInt(p));
 const inexact=q*q*d!==n,cmp=4n*n-(2n*q+1n)**2n*d;
 const up=inexact&&(rc===2||(rc===0&&(cmp>0n||(cmp===0n&&(q&1n)===1n))));
 let r=q+BigInt(up);if(r===1n<<BigInt(p)){r>>=1n;e++;}
 const result={m:hx(r<<BigInt(64-p)),se:e+16383,PE:Number(inexact),C1:Number(up),tie:cmp===0n,proof:{n:n.toString(),d:d.toString(),floor:q.toString(),midpointDifference:cmp.toString()}};
 verify(v,result,pc,rc);return result;
}
// Independent comparison proof: derive exact grid neighbors from the delivered
// image and compare their rational squares. No integer-square-root invocation.
function verify(v,r,pc,rc){
 const p=bits(pc),x=rational(v.m,v.se),y=rational(r.m,r.se),cmp=(n,d)=>n*n*x.d-x.n*d*d;
 const sign=cmp(y.n,y.d),pe=sign!==0n;a.equal(r.PE,Number(pe));a.equal(r.C1,Number(sign>0n));
 let e=Math.floor((v.se-16383)/2),s=e-(p-1),stepN=1n,stepD=1n;if(s>=0)stepN<<=BigInt(s);else stepD<<=BigInt(-s);
 // All inputs lie in the chosen binade; include its upper endpoint on carry.
 const yn=y.n*stepD,yd=y.d*stepN;a.equal(yn%yd,0n);const q=yn/yd;
 if(pe){const lo=sign<0n?q:q-1n,hi=lo+1n;
  const cLo=cmp(lo*stepN,stepD),cHi=cmp(hi*stepN,stepD);a(cLo<0n&&cHi>0n);
  if(rc===1||rc===3)a.equal(q,lo);if(rc===2)a.equal(q,hi);
  if(rc===0){const cm=cmp((lo+hi)*stepN,stepD*2n);a(cm<0n?q===hi:cm>0n?q===lo:(q&1n)===0n);a.equal(r.tie,cm===0n);}
 }
}
// Exact binary64 shadow encoding from a rounded physical80 image, using only
// integer rounding. No JS Number floating arithmetic is used as a value oracle.
function shadow(m,se){let n=BigInt('0x'+m),q=n>>11n,rem=n&2047n;if(rem>1024n||(rem===1024n&&(q&1n)))q++;let e=se-16383;if(q===1n<<53n){q>>=1n;e++;}a(e>=-1022&&e<=1023);return (BigInt(e+1023)<<52n)|(q&((1n<<52n)-1n));}
const seeds=[0,1,2,4,8,16,32,0x200,0x477f];


const vectors=inputs,le=x=>[x&255,x>>>8&255,x>>>16&255,x>>>24];
async function main(){
 const [file='build/wine-assembly.wasm',rf,out='x87-sqrt-rounded.json',mode='bounded']=process.argv.slice(2),bytes=fs.readFileSync(file),mod=await WebAssembly.compile(bytes),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),imports={};
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
   if(mode!=='declines'){const r=expected(v,precision,rc);v={...v,r:r.m,re:r.se,PE:r.PE,C1:r.C1};}
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
    // Exact integer-derived binary64 representation of the selected image.
    wantFP.writeBigUInt64LE(shadow(v.r,v.re),top*8);
   }
   const hits=e.get_page_hits(),stores=e.get_cache_stores();exec(null,at);const cache={hits:e.get_page_hits()-hits,stores:e.get_cache_stores()-stores},after=state();
   exec([221,61,...le(env+64)]);const sw=dv.getUint16(g(env+64),true);exec([217,53,...le(env+96)]);const gotCW=dv.getUint16(g(env+96),true);exec([156,143,5,...le(flags)]);const cpuFlags=dv.getUint32(g(flags),true);
   mem.fill(0xa5,g(dest),g(dest+144));const stored=[];
   for(let i=0;i<8;i++){const addr=dest+8+i*16;exec([219,61,...le(addr)]);stored.push([dv.getBigUint64(g(addr),true).toString(16).padStart(16,'0'),dv.getUint16(g(addr)+8,true)]);}
   const post=state(),storeBuffer=hex(g(dest),144),wasCold=!emitted.has(at);emitted.add(at);
   const checks={cache:cache.stores===(wasCold?1:0)&&(wasCold||cache.hits===1),storeBounds:mem.subarray(g(dest),g(dest+144)).every((v,i)=>i>=8&&i<136&&((i-8)%16)<10||v===0xa5)};
   if(mode!=='declines')Object.assign(checks,{images:equal(after.images,want),allFP:after.fp===wantFP.toString('hex'),allMeta:after.meta===wantMeta.toString('hex'),C1:((sw>>>9)&1)===v.C1,definedSW:(sw&0xbaff)===((((top<<11)|seed)&0xb8ff)|0x20|(v.C1<<9)),tags:after.tags===255,top:after.top===top,cw:gotCW===cw,gp:equal(after.gp,before.gp),flags:cpuFlags===0xed7,stores:equal(stored,Array.from({length:8},(_,i)=>want[(top+i)&7])),storeImages:equal(post.images,after.images),storeFP:post.fp===after.fp,storeMeta:post.meta===after.meta,storeTOP:post.top===top,storeTags:post.tags===0});
   const pass=Object.values(checks).every(Boolean);cases++;if(cache.stores===1)cold++;if(cache.hits===1&&cache.stores===0)cachedHits++;if(!pass){failures++;for(const [k,v]of Object.entries(checks))if(!v)failureCounts[k]=(failureCounts[k]||0)+1;}
   const row={top,vector:v.id,input:[v.m,v.se],expected:mode==='declines'?null:[v.r,v.re],precision,rc,seed,extra,cache,before,after,post,sw,cw:gotCW,cpuFlags,stored,storeBuffer,checks,pass};if(!pass&&!firstFailure)firstFailure=row;lines.push(JSON.stringify(row)+'\n');if(lines.length===512)flush();
 }
 for(const top of [2,5]){
  if(['bounded','selected','full'].includes(mode))for(const v of vectors)for(const precision of v.pcs)for(let rc=0;rc<4;rc++){
   const at=pc;pc+=128;mem.set([217,250,235,0],g(at));
   for(const seed of mode==='bounded'?[0,0x200,0x477f]:seeds)executeCase(top,v,precision,rc,seed,at);
  }
  else if(mode==='declines'){
   const declined=[
    ['negative','8000000000000000',49152,{}],
    ['subnormal','0000000000000006',0,{}],
    ['plus-zero','0000000000000000',0,{}],
    ['minus-zero','0000000000000000',32768,{}],
    ['plus-infinity','8000000000000000',32767,{}],
    ['qnan','c123456789abcdef',32767,{}],
    ['snan','8123456789abcdef',32767,{}],
    ['unsupported','4000000000000000',16384,{}],
    ['outside-bounded-exponent','8000000000000001',16382,{}],
    ['reserved','8000000000000000',16384,{pc:1}],
    ['invalid-image','8000000000000000',16384,{noImage:true}],
    ['empty','8000000000000000',16384,{empty:true}],
    ...Array.from({length:6},(_,i)=>['unmask'+i,'8000000000000000',16384,{unmask:1<<i}])];
   for(const [id,m,se,extra]of declined)for(const precision of extra.pc!==undefined?[extra.pc]:[0,2,3])for(let rc=0;rc<4;rc++){
    const at=pc;pc+=128;mem.set([217,250,235,0],g(at));for(const seed of [0,0x23f])executeCase(top,{id,m,se},precision,rc,seed,at,extra);
   }
  }else throw Error('unknown mode');
 }
 flush();fs.fsyncSync(fd);fs.closeSync(fd);
 const result={mode,module:file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),cases,cold,cachedHits,failures,failureCounts,firstFailure,rowsFile:out+'.rows.jsonl.gz',rawBytes,rawSHA256:rawHash.digest('hex'),gzipBytes,gzipSHA256:gzHash.digest('hex'),chunks,eachChunkDecompressionByteExact:true};fs.writeFileSync(out,JSON.stringify(result,null,2));console.log(JSON.stringify({...result,firstFailure:firstFailure?{vector:firstFailure.vector,checks:firstFailure.checks}:null}));if(failures)process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=2;});
