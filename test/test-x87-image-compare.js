'use strict';
const fs=require('fs'),a=require('assert/strict'),crypto=require('crypto');
// Intel SDM finite image order; explicit module, regions and output arguments.
const im=(m,s,integer)=>({m,s,integer});
const p=im('a000000000000000',0x4000),q=im('a000000000000001',0x4000),n=im(p.m,0xc000),nq=im(q.m,0xc000);
const pairs=[
 ['plus-deciding-bit',p,q,-1],['minus-deciding-bit',n,nq,1],
 ['fild-adjacent',im('8000000000000000',0x4034,'9007199254740992'),im('8000000000000400',0x4034,'9007199254740993'),-1],
 ['negative-fild-adjacent',im('8000000000000000',0xc034,'-9007199254740992'),im('8000000000000400',0xc034,'-9007199254740993'),1],
 ['signed-zero',im('0000000000000000',0),im('0000000000000000',0x8000),0],
 ['large-lowbit',im('8000000000000000',0x5000),im('8000000000000001',0x5000),-1],
 ['large-exponent',im('ffffffffffffffff',0x5000),im('8000000000000000',0x5001),-1],
 ['negative-large',im('ffffffffffffffff',0xd000),im('8000000000000000',0xd001),1],
 ['opposite-large',im('ffffffffffffffff',0xfffe),im('ffffffffffffffff',0x7ffe),-1],
 ['opposite-tiny',im('8000000000000000',0x8001),im('8000000000000000',1),-1],
 ['tiny-lowbit',im('8000000000000000',1),im('8000000000000001',1),-1],
 ['finite-equal',q,q,0],['ordinary',im('c000000000000000',0x3fff),p,-1]
];
const forms=[['FCOM',[0xd8,0xd1],0,0],['FCOMP',[0xd8,0xd9],1,0],['FCOMPP',[0xde,0xd9],2,0],['FUCOM',[0xdd,0xe1],0,0],['FUCOMP',[0xdd,0xe9],1,0],['FUCOMPP',[0xda,0xe9],2,0],['FCOMI',[0xdb,0xf1],0,1],['FCOMIP',[0xdf,0xf1],1,1],['FUCOMI',[0xdb,0xe9],0,1],['FUCOMIP',[0xdf,0xe9],1,1]];

// Additional literal encodings sealed before this expanded measurement.
for(const f of forms.slice())if(f[2]!==2)for(const rm of [0,5,7])forms.push([f[0]+'-st'+rm,[f[1][0],(f[1][1]&248)+rm],f[2],f[3],rm]);
const memoryPairs=[
 ['memory-plus-retained',q,p,1,'4004000000000000','40200000'],
 ['memory-plus-below',im('9fffffffffffffff',0x4000),p,-1,'4004000000000000','40200000'],
 ['memory-minus-retained',nq,n,-1,'c004000000000000','c0200000'],
 ['memory-minus-below',im('9fffffffffffffff',0xc000),n,1,'c004000000000000','c0200000'],
 ['memory-zero',im('0000000000000000',0x8000),im('0000000000000000',0),0,'0000000000000000','00000000'],
 ['memory-large-positive',im('ffffffffffffffff',0x7ffe),im('8000000000000000',0x3fff),1,'3ff0000000000000','3f800000'],
 ['memory-large-negative',im('ffffffffffffffff',0xfffe),im('8000000000000000',0x3fff),-1,'3ff0000000000000','3f800000'],
 ['memory-tiny-positive',im('8000000000000000',1),im('0000000000000000',0),1,'0000000000000000','00000000'],
 ['memory-tiny-negative',im('8000000000000000',0x8001),im('0000000000000000',0),-1,'0000000000000000','00000000'],
 ['memory-exact',p,p,0,'4004000000000000','40200000']
];


const le=x=>[x&255,x>>>8&255,x>>>16&255,x>>>24],sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
const [file='build/wine-assembly.wasm',regionFile,out]=process.argv.slice(2),bytes=fs.readFileSync(file),mod=await WebAssembly.compile(bytes),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),imports={};
for(const i of WebAssembly.Module.imports(mod))(imports[i.module]||={})[i.name]=i.kind==='memory'?memory:i.name==='math_log2'?Math.log2:i.name==='math_pow2'?x=>2**x:()=>0;
const e=new WebAssembly.Instance(mod,imports).exports,mem=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer),g=x=>e.guest_to_wasm(x)>>>0;
const pe=fs.readFileSync('test/binaries/notepad.exe');mem.set(pe,e.get_staging());a(e.load_pe(pe.length));e.set_fault_unmapped(2);e.set_uop(0);e.set_esp(0x1108000);
const regions=(regionFile ? JSON.parse(fs.readFileSync(regionFile)) : require('../tools/region-layout').layout().regions),base=n=>regions.find(r=>r.name==='$'+n).base,fp=base('FPU_FILE'),meta=base('FPU_IMAGE_META');
const input=0xc02000,env=0xc05000,flags=0xc06000;let pc=0x1820000;
function exec(b,at){if(at===undefined){at=pc;pc+=128;mem.set([...b,0xeb,0],g(at));}e.clear_yield();e.set_eip(at);e.run(1);return at;}
function load(v){if(v.integer){dv.setBigInt64(g(input),BigInt(v.integer),true);exec([0xdf,0x2d,...le(input)]);}else{dv.setBigUint64(g(input),BigInt('0x'+v.m),true);dv.setUint16(g(input)+8,v.s,true);exec([0xdb,0x2d,...le(input)]);}}
function state(){return {top:e.get_fpu_top(),tags:e.get_fpu_tags(),fp:Buffer.from(mem.slice(fp,fp+128)).toString('hex'),meta:Buffer.from(mem.slice(meta,meta+32)).toString('hex'),images:Array.from({length:8},(_,i)=>[BigInt.asUintN(64,e.get_mmx(i)).toString(16).padStart(16,'0'),dv.getUint16(meta+2*i,true)])};}
const rows=[];
const jobs=[];
for(const pair of pairs)for(const reverse of [false,true])for(const form of forms)jobs.push({pair,reverse,form});
for(const pair of memoryPairs)for(const width of [32,64])for(const pop of [0,1])jobs.push({pair,reverse:false,form:['FCOM'+(pop?'P':'')+'-m'+width,[width===32?0xd8:0xdc,pop?0x1d:0x15,...le(input)],pop,0,1],width});
for(const {pair:[id,x,y,rel,bits64,bits32],reverse,form:[name,op,pop,cpu,rm=1],width}of jobs)for(const seed of [0,0x473f])for(const flagSeed of [0x202,0xed7]){
 const at=pc;pc+=128;mem.set([...op,0xeb,0],g(at));const first=reverse?y:x,second=reverse?x:y,r=rm===0?0:reverse?-rel:rel;
 for(let repeat=0;repeat<2;repeat++){
 exec([0xdb,0xe3]);[0x37f,(2<<11)|seed,0xffff,0,0,0,0].forEach((x,i)=>e.guest_write32(env+i*4,x));exec([0xd9,0x25,...le(env)]);
 const logical=Array.from({length:8},(_,i)=>({m:(0x9000000000000001n+BigInt(i)).toString(16),s:16400+i}));
 logical[0]=first;if(rm)logical[rm]=second;for(let i=7;i>=0;i--)load(logical[i]);
 if(width===64)dv.setBigUint64(g(input),BigInt('0x'+bits64),true);if(width===32)dv.setUint32(g(input),parseInt(bits32,16),true);
 exec([0x68,...le(flagSeed),0x9d]);const before=state();a.equal(before.top,2);a.deepEqual(before.images[2],[first.m,first.s]);if(rm)a.deepEqual(before.images[(2+rm)&7],[second.m,second.s]);a.equal(e.get_fpu_sw(),seed);
 const hits=e.get_page_hits(),stores=e.get_cache_stores();exec(null,at);const cache={hits:e.get_page_hits()-hits,stores:e.get_cache_stores()-stores};const after=state();exec([0xdd,0x3d,...le(env+64)]);const sw=dv.getUint16(g(env+64),true);exec([0x9c,0x8f,5,...le(flags),0x0f,0x92,5,...le(flags+4),0x0f,0x94,5,...le(flags+5),0x0f,0x9a,5,...le(flags+6)]);const actualFlags=dv.getUint32(g(flags),true);
 const cc=r<0?0x100:r===0?0x4000:0,wantSW=(((2+pop)&7)<<11)|(cpu?(seed&~0x200):((seed&~0x4700)|cc)),wantFlags=cpu?((flagSeed&~0x8d5)|(r<0?1:r===0?0x40:0)):flagSeed;
 // Occupancy is an 8-bit physical mask, distinct from canonical image metadata.
 let wantTags=before.tags;for(let i=0;i<pop;i++)wantTags&=~(1<<((2+i)&7));
 const checks={conditions:[0,6,2].every((bit,j)=>mem[g(flags+4+j)]===((wantFlags>>>bit)&1)),status:sw===wantSW,flags:actualFlags===wantFlags,top:after.top===((2+pop)&7),tags:after.tags===wantTags,images:JSON.stringify(before.images)===JSON.stringify(after.images),fp:before.fp===after.fp,meta:before.meta===after.meta,cached:cache.stores===(repeat===0?1:0)&&(repeat===0||cache.hits===1)};
 rows.push({id,reverse,name,rm,width,seed,flagSeed,repeat,r,sw,wantSW,actualFlags,wantFlags,cache,checks,pass:Object.values(checks).every(Boolean)});
 }
}
const failureCounts={};for(const r of rows)for(const [k,v]of Object.entries(r.checks))if(!v)failureCounts[k]=(failureCounts[k]||0)+1;const result={sha256:sha(bytes),cases:rows.length,failures:rows.filter(r=>!r.pass).length,failureCounts,firstFailure:rows.find(r=>!r.pass),rows};if(out)fs.writeFileSync(out,JSON.stringify(result,null,2));console.log(JSON.stringify({...result,rows:undefined}));if(result.failures)process.exitCode=1;
}main().catch(e=>{console.error(e);process.exitCode=2;});
