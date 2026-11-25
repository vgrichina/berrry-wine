'use strict';
const fs=require('fs'),a=require('assert/strict'),z=require('zlib'),c=require('crypto'),d=__dirname;
const sha=b=>c.createHash('sha256').update(b).digest('hex'),le=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24&255],same=(x,y)=>JSON.stringify(x)===JSON.stringify(y),u=n=>n>>>0;
const gp=['eax','ecx','edx','ebx','esp','ebp','esi','edi'];
function pe(){const b=Buffer.alloc(1024),p=128,o=p+24,s=o+224;b.writeUInt16LE(0x5a4d);b.writeUInt32LE(p,60);b.writeUInt32LE(0x4550,p);b.writeUInt16LE(0x14c,p+4);b.writeUInt16LE(1,p+6);b.writeUInt16LE(224,p+20);b.writeUInt16LE(0x102,p+22);b.writeUInt16LE(0x10b,o);for(const [k,v]of [[16,4096],[28,0x400000],[32,4096],[36,512],[56,8192],[60,512],[72,0x100000],[76,4096],[92,16]])b.writeUInt32LE(v,o+k);b.write('.text',s);for(const [k,v]of [[8,4096],[12,4096],[16,512],[20,512],[36,0xe0000020]])b.writeUInt32LE(v,s+k);b[512]=0xc3;return b;}
const paths=[{name:'eax-edx',dst:0,src:2},{name:'edi-esi',dst:7,src:6},{name:'ebp-self',dst:5,src:5},{name:'absolute',memory:true,src:6},{name:'base-index-alias',memory:true,src:7},{name:'sib-base-bitindex-alias',memory:true,src:5},{name:'fs-absolute',memory:true,src:2,fs:true}];
const indexes=w=>[-1,-w,-w-1,0,w-1,w,w+1,w===16?-32768:-2147483648,w===16?32767:2147483647,w===16?0x10001:0x40000021];
function matrix(){const rows=[];for(const width of [16,32])for(let op=0;op<4;op++){
 for(const p of paths)for(let n=0;n<indexes(width).length;n++)rows.push({width,op,p,n,immediate:false});
 for(const p of paths.filter(p=>['eax-edx','absolute','fs-absolute'].includes(p.name)))for(const raw of [0,width-1,width,width+1,255])rows.push({width,op,p,raw,immediate:true});
 }return rows.map((v,id)=>({...v,id,at:0x2000000+id*32}));}
// Intel BT/BTS/BTR/BTC preserve ZF; OF/SF/AF/PF are undefined.
// Memory register offsets are signed; immediate bytes remain a separate form.
main().catch(err=>{console.error(err);process.exitCode=1;});
async function main(){const phase='candidate',kind=process.argv[5]||'native',file=process.argv[2]||'build/wine-assembly.wasm',bytes=fs.readFileSync(file),record={path:file,sha256:sha(bytes)},cases=matrix();a(['native','compat'].includes(kind));a.equal(cases.length,680);
const mod=await WebAssembly.compile(bytes),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),imports={};let events=[];
for(const i of WebAssembly.Module.imports(mod))(imports[i.module]||={})[i.name]=i.kind==='memory'?memory:(...args)=>{events.push({name:i.module+'.'+i.name,args});return 0;};
const e=new WebAssembly.Instance(mod,imports).exports,mem=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer),g=x=>e.guest_to_wasm(u(x))>>>0,input=pe();mem.set(input,e.get_staging());a(e.load_pe(input.length)>=0);a.equal(e.is_code16(),0);e.set_uop(0);e.set_block_exec(0);e.set_fault_unmapped(2);
const regions=process.argv[3]?JSON.parse(fs.readFileSync(process.argv[3])):require('../tools/region-layout').layout().regions,base=n=>regions.find(r=>r.name==='$'+n).base,fp=base('FPU_FILE'),meta=base('FPU_IMAGE_META');
const stack=0x1108000,flagOut=0xc07000,guard=0xc08000,cwIn=0xc09000,cwOut=0xc09010,data=0xd00130,fsBase=0x1200000,hex=(p,n)=>Buffer.from(mem.subarray(p,p+n)).toString('hex');
let setupPC=0x1800000;const setups=new Map();function setup(b){const key=b.join(',');let at=setups.get(key);if(at===undefined){at=setupPC;setupPC+=64;setups.set(key,at);mem.set([...b,235,0],g(at));}e.clear_yield();e.set_eip(at);e.run(1);}
e.set_esp(stack);setup([0xdb,0xe3,0xd9,0xe8,0xd9,0xeb,0xd9,0xc9,0xd8,0xd1]);a.equal(e.get_fpu_sw()&0x4500,0x100);
const lazy=()=>[e.get_flag_op(),e.get_flag_a(),e.get_flag_b(),e.get_flag_res(),e.get_flag_sign_shift()];
const readFlags=()=>{setup([0x9c,0x8f,0x05,...le(flagOut)]);return dv.getUint32(g(flagOut),true);},readCW=()=>{setup([0xd9,0x3d,...le(cwOut)]);return dv.getUint16(g(cwOut),true);};
function state(v){return {gp:gp.map(r=>u(e['get_'+r]())),segments:Array.from({length:6},(_,i)=>[e.win16_sreg(i),e.win16_seg_base_of(i)]),fs:e.get_fs_base(),code16:e.is_code16(),fpu:[e.get_fpu_top(),e.get_fpu_tags(),e.get_fpu_sw(),hex(fp,128),hex(meta,32)],stack:hex(g(stack-64),128),guard:hex(g(guard),128),data:hex(g(data)-64,192),code:hex(g(v.at),32),lazy:lazy(),eip:u(e.get_eip()),yield:[e.get_yield_reason(),e.get_yield_flag()]};}
// Addressing is encoded once. Extreme indexes use displacement compensation so the selected word is mapped.
function initialIndex(v){return v.immediate?v.raw:indexes(v.width)[v.n];}
function signed(v,n){const m=2**v.width,r=((n%m)+m)%m;return r>=m/2?r-m:r;}
function baseEA(v){const off=signed(v,initialIndex(v));return v.p.memory&&!v.immediate&&Math.abs(off)>1024?u(data-Math.floor(off/v.width)*(v.width/8)):data;}
function encoding(v){const p=v.p,ea=baseEA(v),raw=u(initialIndex(v)),b=[...(p.fs?[0x64]:[]),...(v.width===16?[0x66]:[]),0x0f,v.immediate?0xba:[0xa3,0xab,0xb3,0xbb][v.op]],src=v.immediate?4+v.op:p.src;
 if(!p.memory)b.push(0xc0+src*8+p.dst);else if(p.name==='base-index-alias')b.push(0x80+src*8+7,...le(u(ea-raw)));else if(p.name==='sib-base-bitindex-alias')b.push(0x80+src*8+4,0x75,...le(u(ea-raw-0x200)));else b.push(src*8+5,...le(p.fs?u(ea-fsBase):ea));
 if(v.immediate)b.push(v.raw);return b;}
for(const v of cases){v.code=encoding(v);mem.set([...v.code,235,0,...Array(30-v.code.length).fill(0x90)],g(v.at));}
const fd=process.argv[4]?fs.openSync(process.argv[4],'wx'):null,hash=c.createHash('sha256');let lines=[],total=0,failures=0,cold=0,cached=0,firstFailure=null,categories={},changedIndex=0,changedOperand=0;const prev=new Map();
function flush(){if(!lines.length)return;const b=Buffer.from(lines.join(''));hash.update(b);if(fd!==null)fs.writeSync(fd,z.gzipSync(b));lines=[];}
for(const v of cases)for(let path=0;path<2;path++){
 const p=v.p,m=2**v.width,vector=(v.id+path)%8;
 // Hot pass changes index by one while retaining immutable code, including base/source alias.
 const delta=(!v.immediate&&signed(v,initialIndex(v))===2**(v.width-1)-1&&!(kind==='native'&&v.id<39&&!p.memory))?-1:1;
 const raw=v.immediate?v.raw:u(initialIndex(v)+(path?delta:0)),regs=[0xa55a0000,0xb77b0000,0xc33c0000,0xd11d0000,stack,0xe22e0000,0xf44f0000,0x96690000].map((x,i)=>u(i===4?x:x+v.id%257+i));
 if(!p.memory)regs[p.dst]=u((v.width===16?regs[p.dst]&0xffff0000:0)|([0x55aa55aa,0xaa55aa55,0xffffffff,0,0x80000000,1,0x8001,0x7fffffff][vector]%(2**v.width)));
 if(!v.immediate)regs[p.src]=v.width===16?u((regs[p.src]&0xffff0000)|(raw&65535)):raw;
 // For base-index aliases full register must equal the encoded raw value, even for r16.
 if(p.name==='base-index-alias'||p.name==='sib-base-bitindex-alias')regs[p.src]=raw;
 if(p.name==='sib-base-bitindex-alias')regs[6]=0x100;
 const pw=[0,8,8,16,16,32,32][(v.id+path)%7],sub=(v.id+path)%7%2===0&&pw!==0,seed=u(0x202|((v.id+path)%2?0x40:0)|[0,0x400,0x244100,0x244500][vector%4]|((v.id*17+path)%2?0x895:0));
 dv.setUint16(g(cwIn),0x7f|((vector%4)<<10)|((vector&4)?0x300:0),true);setup([0xd9,0x2d,...le(cwIn)]);e.set_esp(stack);
 const x=pw?(vector%2===0?1:0):0,y=pw?(sub?0:1):0,pb=pw?[0xb8,...le(x),...(pw===16?[0x66]:[]),pw===8?0x80:0x81,sub?0xe8:0xc0,...(pw===8?[y]:pw===16?le(y).slice(0,2):le(y))]:[];setup([0x68,...le(seed),0x9d,...pb]);
 const producerLazy=lazy();gp.forEach((r,i)=>e['set_'+r](regs[i]));e.set_fs_base(fsBase);mem.fill(0xa5,g(stack-64),g(stack+64));mem.fill(0x5a,g(guard),g(guard+128));for(let j=0;j<192;j++)mem[g(data)-64+j]=(j*37+vector*53+path*11)&255;
 const ea=u(baseEA(v)+((p.name==='base-index-alias'||p.name==='sib-base-bitindex-alias')&&path?delta:0)),idx=v.immediate?v.raw:(p.memory?signed(v,regs[p.src]):regs[p.src]%m),bit=((idx%(p.memory&&!v.immediate?8:v.width))+(p.memory&&!v.immediate?8:v.width))%(p.memory&&!v.immediate?8:v.width);
 // Oracle selects a byte directly per Intel; it does not copy operand-word shift formulas.
 const byteAddress=p.memory?u(ea+(v.immediate?Math.floor((idx%v.width)/8):Math.floor(idx/8))):null,byteBit=p.memory?(v.immediate?(idx%v.width)%8:bit):null;
 if(p.memory)a(byteAddress>=data-64&&byteAddress<data+128,'mapped selected byte');
 const dst=p.memory?mem[g(byteAddress)]:regs[p.dst]%m,selected=p.memory?byteBit:bit,cf=Math.floor(dst/2**selected)%2,newBit=v.op===0?cf:v.op===1?1:v.op===2?0:1-cf,expectedValue=dst+(newBit-cf)*2**selected;
 const beforeFlags=readFlags(),beforeCW=readCW();e.clear_yield();e.set_eip(v.at);const before=state(v),h=e.get_page_hits(),s=e.get_cache_stores(),ev=events.length;let error=null;try{e.run(1);}catch(err){error={name:err.name,message:err.message};}
 const after=state(v),cache={hits:e.get_page_hits()-h,stores:e.get_cache_stores()-s},hostEvents=events.slice(ev),afterFlags=readFlags(),afterCW=readCW(),wantRegs=[...before.gp],wantData=Buffer.from(before.data,'hex');
 if(p.memory)wantData[byteAddress-(data-64)]=expectedValue;else wantRegs[p.dst]=v.width===16?u((wantRegs[p.dst]&0xffff0000)|expectedValue):u(expectedValue);
 const checks={lazyUnmaterialized:same(producerLazy,before.lazy),noTrap:!error,noHost:hostEvents.length===0,GPR:same(after.gp,wantRegs),CF:(afterFlags&1)===cf,ZF:((beforeFlags^afterFlags)&64)===0,nonarithmeticFlags:((beforeFlags^afterFlags)&~0x8d5)===0,segments:same(before.segments,after.segments)&&before.fs===after.fs&&before.code16===after.code16,fpu:same(before.fpu,after.fpu),cw:beforeCW===afterCW&&beforeCW===dv.getUint16(g(cwIn),true),stack:before.stack===after.stack,guard:before.guard===after.guard,data:after.data===wantData.toString('hex'),code:before.code===after.code,eip:after.eip===v.at+v.code.length+2,noYield:same(after.yield,[0,0]),cache:path===0?cache.hits===0&&cache.stores===1:cache.hits===1&&cache.stores===0};
 if(path===0&&cache.stores===1)cold++;if(path===1&&cache.hits===1&&cache.stores===0)cached++;if(path){const old=prev.get(v.id);if(old.idx!==idx)changedIndex++;if(old.dst!==dst)changedOperand++;}prev.set(v.id,{idx,dst});
 const pass=Object.values(checks).every(Boolean),row={id:total,caseId:v.id,path,width:v.width,op:v.op,pathName:p.name,immediate:v.immediate,raw,idx,ea,byteAddress,selected,dst,expectedValue,cf,producer:{pw,sub,x,y,seed,lazy:producerLazy},beforeFlags,afterFlags,beforeCW,afterCW,before,after,cache,error,hostEvents,checks,pass};total++;if(!pass){failures++;for(const [k,ok]of Object.entries(checks))if(!ok)categories[k]=(categories[k]||0)+1;firstFailure||=row;}lines.push(JSON.stringify(row)+'\n');if(lines.length>=64)flush();
}
flush();if(fd!==null){fs.fsyncSync(fd);fs.closeSync(fd);}const summary={kind,phase,module:record,cases:total,failures,cold,cached,changedIndex,changedOperand,categories,firstFailure,rawSHA256:hash.digest('hex'),authoredPE:{bytes:input.length,sha256:sha(input)},setupPrograms:setups.size};console.log(JSON.stringify({...summary,firstFailure:firstFailure?{id:firstFailure.id,path:firstFailure.pathName,checks:firstFailure.checks}:null}));process.exitCode=failures?1:0;
}
