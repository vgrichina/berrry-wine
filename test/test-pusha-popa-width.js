'use strict';
const fs=require('fs'),a=require('assert/strict'),path=require('path'),oracle=(code,before)=>{
 const r=before.gp.map(BigInt),m=new Map(),reads=[],writes=[],steps=[];
 for(const x of before.memory)for(let i=0;i<x.hex.length/2;i++)m.set(BigInt(x.at+i),BigInt(parseInt(x.hex.slice(i*2,i*2+2),16)));
 const address=p=>{a(p>=0n&&p<0x100000000n);return Number(p);};
 const load=(p,w)=>{let v=0n;for(let i=0n;i<BigInt(w);i++){address(p+i);a(m.has(p+i));v|=m.get(p+i)<<(8n*i);}reads.push({at:address(p),bytes:w,value:Number(v)});return v;};
 const store=(p,w,v)=>{for(let i=0n;i<BigInt(w);i++){address(p+i);a(m.has(p+i));m.set(p+i,(v>>(8n*i))&255n);}writes.push({at:address(p),bytes:w,value:Number(v&((1n<<BigInt(w*8))-1n))});};
 let pc=0;while(pc<code.length){const start=pc;let w=4;if(code[pc]===102){w=2;pc++;}const op=code[pc++],originalSP=r[4],order=op===96?[0,1,2,3,4,5,6,7]:[7,6,5,4,3,2,1,0];a(op===96||op===97);
  for(const k of order){if(op===96){const v=k===4?originalSP:r[k];r[4]-=BigInt(w);store(r[4],w,v);}else{if(k!==4){const v=load(r[4],w);r[k]=w===2?(r[k]&0xffff0000n)|v:v;}r[4]+=BigInt(w);address(r[4]);}}
  steps.push({start,opcode:op,width:w*8,originalSP:Number(originalSP),finalSP:Number(r[4]),skip:op===97?{at:Number(originalSP+3n*BigInt(w)),bytes:w}:null});
 }
 return {gp:r.map(Number),flags:before.flags,memory:before.memory.map(x=>({...x,hex:Buffer.from(Array.from({length:x.hex.length/2},(_,i)=>Number(m.get(BigInt(x.at+i))))).toString('hex')})),reads,writes,steps};
};
const {REGIONS}=require('../lib/region-map.generated');
const same=(x,y)=>JSON.stringify(x)===JSON.stringify(y),gp=['eax','ecx','edx','ebx','esp','ebp','esi','edi'],le=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24&255];
function pe(){const b=Buffer.alloc(1024),p=128,o=p+24,s=o+224;b.writeUInt16LE(0x5a4d);b.writeUInt32LE(p,60);b.writeUInt32LE(0x4550,p);b.writeUInt16LE(0x14c,p+4);b.writeUInt16LE(1,p+6);b.writeUInt16LE(224,p+20);b.writeUInt16LE(0x102,p+22);b.writeUInt16LE(0x10b,o);for(const [k,v]of [[16,4096],[28,0x400000],[32,4096],[36,512],[56,8192],[60,512],[72,0x100000],[76,4096],[92,16]])b.writeUInt32LE(v,o+k);b.write('.text',s);for(const [k,v]of [[8,4096],[12,4096],[16,512],[20,512],[36,0xe0000020]])b.writeUInt32LE(v,s+k);b[512]=0xc3;return b;}
(async()=>{if(!process.argv.includes('--ne-only'))await main();if(!process.argv.includes('--pe-only'))await runNE();})().catch(err=>{console.error(err);process.exitCode=1;});
async function main(){
 const module=await WebAssembly.compile(fs.readFileSync(process.argv[2]||path.join(__dirname,'../build/wine-assembly.wasm'))),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),imports={},events=[];
 for(const i of WebAssembly.Module.imports(module))(imports[i.module]||={})[i.name]=i.kind==='memory'?memory:(...args)=>{events.push({name:i.module+'.'+i.name,args});return 0;};
 const e=new WebAssembly.Instance(module,imports).exports,mem=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer),g=x=>e.guest_to_wasm(x)>>>0,header=pe();mem.set(header,e.get_staging());a(e.load_pe(header.length)>=0);a.equal(e.is_code16(),0);e.set_uop(0);e.set_block_exec(0);e.set_fault_unmapped(2);a(e.test_virtual_map_commit(0x30000000,0x20000));
 const fp=REGIONS.FPU_FILE.base,meta=REGIONS.FPU_IMAGE_META.base,helperStack=0x1308000,flagOut=0xc07000,cwIn=0xc09000,cwOut=0xc09010,hex=(p,n)=>Buffer.from(mem.subarray(p,p+n)).toString('hex');
 let setupPC=0x1800000;const setups=new Map();function setup(b){let at=setups.get(b.join(','));if(at===undefined){at=setupPC;setupPC+=64;setups.set(b.join(','),at);mem.set([...b,235,0],g(at));}e.clear_yield();e.set_eip(at);e.run(1);}
 function flags(){const saved=e.get_esp();e.set_esp(helperStack);setup([0x9c,0x8f,5,...le(flagOut)]);e.set_esp(saved);return dv.getUint32(g(flagOut),true);}
 function cw(){setup([0xd9,0x3d,...le(cwOut)]);return dv.getUint16(g(cwOut),true);}
 e.set_esp(helperStack);setup([0xdb,0xe3,0xd9,0xe8,0xd9,0xeb,0xd9,0xc9,0xd8,0xd1]);a.equal(e.get_fpu_sw()&0x4500,0x100);
 const cases=aggregateCases();for(const v of cases)mem.set([...v.code,235,0,...Array(30-v.code.length).fill(144)],g(v.at));
 let ranges=[];function state(v){return {gp:gp.map(r=>e['get_'+r]()>>>0),flags:null,segments:Array.from({length:6},(_,i)=>[e.win16_sreg(i),e.win16_seg_base_of(i)]),fs:e.get_fs_base(),code16:e.is_code16(),fpu:[e.get_fpu_top(),e.get_fpu_tags(),e.get_fpu_sw(),hex(fp,128),hex(meta,32)],cw:null,lazy:[e.get_flag_op(),e.get_flag_a(),e.get_flag_b(),e.get_flag_res(),e.get_flag_sign_shift()],memory:ranges.map(r=>({...r,hex:hex(g(r.at),r.bytes)})),code:hex(g(v.at),32),eip:e.get_eip()>>>0,yield:[e.get_yield_reason(),e.get_yield_flag()]};}
 let count=0,cached=0;
 for(const v of cases)for(const hot of [0,1]){
  const stack=(v.layout==='direct'?0x1100000:0x30000000)+v.offset+hot*64,frame=(0xa5678901+hot*0x777777)>>>0;
  a.equal(e.win16_seg_base_of(2),0);
  ranges=[{name:"complete-stack-with-low-high-readable-guards",at:stack-256,bytes:512},{name:"named-guard-low",at:stack-272,bytes:16},{name:"named-guard-high",at:stack+256,bytes:16},{name:"named-data-control",at:0xd01000,bytes:64}];
  for(const r of ranges){a.notEqual(g(r.at),0xf0);a.equal(g(r.at+r.bytes-1),g(r.at)+r.bytes-1);for(let i=0;i<r.bytes;i++)mem[g(r.at+i)]=(i*37+v.id*11+hot*83+19)&255;}
  dv.setUint16(g(cwIn),0x7f|((v.id%4)<<10)|((v.id&4)?0x300:0),true);setup([0xd9,0x2d,...le(cwIn)]);
  const raw=v.producer<8,seed=0x202|[0,2,4,6,7,11].reduce((n,b,k)=>n|((((v.id+hot*17)>>>k)&1)<<b),0),pw=raw?0:[8,8,16,16,32,32][v.producer-8],sub=!raw&&v.producer%2===1;
  e.set_esp(helperStack);setup([0x68,...le(seed),0x9d,...(raw?[]:[0xb8,...le(2**(pw-1)),...(pw===16?[102]:[]),pw===8?128:129,sub?232:192,...(pw===8?[1]:pw===16?[1,0]:le(1))]),hot?0xfd:0xfc]);
  const regs=[(0xa1234567+hot*0x111111)>>>0,(0xb2345678+hot*0x222222)>>>0,(0xc3456789+hot*0x333333)>>>0,(0xd456789a+hot*0x444444)>>>0,stack,frame,(0xe56789ab+hot*0x555555)>>>0,(0xf6789abc+hot*0x666666)>>>0];gp.forEach((r,i)=>e['set_'+r](regs[i]));e.set_fs_base(hot?0x200000:0x100000);
  const beforeFlags=flags(),beforeCW=cw();e.clear_yield();e.set_eip(v.at);const before=state(v);before.flags=beforeFlags;before.cw=beforeCW;
  const intended=oracle(v.code,before),actualCode=v.code.filter(b=>b!==0x66),decoded=oracle(actualCode,before);
  // Admission covers both actual baseline and intended byte semantics BEFORE execution.
  a([...intended.reads,...intended.writes,...decoded.reads,...decoded.writes].every(t=>ranges.some(r=>t.at>=r.at&&t.at+t.bytes<=r.at+r.bytes)));
  const hs=e.get_page_hits(),cs=e.get_cache_stores(),ev=events.length;let error=null;try{e.run(1);}catch(err){error={name:err.name,message:err.message};}
  const after=state(v),cache={hits:e.get_page_hits()-hs,stores:e.get_cache_stores()-cs},hostEvents=events.slice(ev);after.flags=flags();after.cw=cw();
  const checks={noTrap:!error,noHost:hostEvents.length===0,gp:same(after.gp,intended.gp),flags:after.flags===before.flags,lazy:same(after.lazy,before.lazy),memory:same(after.memory,intended.memory),segments:same(after.segments,before.segments)&&after.fs===before.fs&&after.code16===before.code16,fpu:same(after.fpu,before.fpu)&&after.cw===before.cw,code:after.code===before.code,eip:after.eip===v.at+v.code.length+2,yield:same(after.yield,[0,0]),cache:same(cache,hot?{hits:1,stores:0}:{hits:0,stores:1})};
  a(Object.values(checks).every(Boolean),JSON.stringify({v,hot,checks,expected:intended.gp,actual:after.gp}));count++;if(hot)cached++;
 }
 console.log(JSON.stringify({scope:'PE32 aggregate16/32',rows:count,actualCache:cached,pass:true}));
}

function aggregateCases(){const cases=[];for(const code of [[96],[97],[102,96],[102,97],[96,97],[102,96,102,97],[102,96,97],[96,102,97]])for(const layout of ['direct','sparse'])for(const offset of [0x9000,0x9001,0xfff0,0xfff1,0x10008,0x10009])for(const producer of [0,9,12])cases.push({id:cases.length,at:0x2000000+cases.length*32,code,layout,offset,producer});return cases;}

// Authored NE, no original executable or retained run dependency.
async function runNE() {
 const module=await WebAssembly.compile(fs.readFileSync(process.argv[2]||path.join(__dirname,'../build/wine-assembly.wasm')));
 const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),imports={},events=[];
 for(const i of WebAssembly.Module.imports(module))(imports[i.module]||={})[i.name]=i.kind==='memory'?memory:(...args)=>{events.push([i.name,args]);return 0;};
 const e=new WebAssembly.Instance(module,imports).exports,mem=new Uint8Array(memory.buffer),image=Buffer.alloc(1024),ne=64;
 image.writeUInt16LE(0x5a4d);image.writeUInt32LE(ne,60);
 const word=(at,v)=>image.writeUInt16LE(v,ne+at);
 for(const [at,v]of [[0,0x454e],[4,0x90],[6,2],[14,3],[18,4096],[22,1],[24,0x8000],[26,8],[28,8],[34,0x40],[50,4]])word(at,v);
 for(let i=0;i<8;i++){word(0x40+i*8,0x20+i);word(0x42+i*8,16);word(0x44+i*8,i?1:0);word(0x46+i*8,0);}
 mem.set(image,e.get_staging());a(e.load_pe(image.length)>=0);a.equal(e.is_code16(),1);
 e.set_uop(0);e.set_block_exec(0);e.set_fault_unmapped(2);
 const cs=e.win16_seg_base_of(1)>>>0,ss=e.win16_seg_base_of(2)>>>0,ds=e.win16_seg_base_of(3)>>>0,g=p=>e.guest_to_wasm(p)>>>0;
 a.equal(ss,e.win16_seg_base(8)>>>0);a.equal(e.win16_seg_limit(8),65536);a.equal(ss&65535,0);
 a.notEqual(g(ss),0xf0);a.equal(g(ss+65535),g(ss)+65535);
 const hex=(p,n)=>Buffer.from(mem.subarray(p,p+n)).toString('hex'),dv=new DataView(memory.buffer);
 let helper=cs+0x9000;const setups=new Map();
 function setup(bytes){const k=bytes.join(',');if(!setups.has(k)){setups.set(k,helper);mem.set([...bytes,235,0],g(helper));helper+=32;a(helper<cs+0xff00);}e.clear_yield();e.set_eip(setups.get(k));e.run(1);}
 function flags(){const ax=e.get_eax(),sp=e.get_esp();e.set_esp(ss+0xb000);setup([0x9c,0x58]);const f=e.get_eax()&65535;e.set_eax(ax);e.set_esp(sp);return f;}
 function cw(){setup([0xd9,0x3e,2,0x70]);return dv.getUint16(g(ds+0x7002),true);}
 function state(){return {
  gp:gp.map(r=>e['get_'+r]()>>>0),lazy:[e.get_flag_op(),e.get_flag_a(),e.get_flag_b(),e.get_flag_res(),e.get_flag_sign_shift()],
  segments:Array.from({length:6},(_,i)=>[e.win16_sreg(i),e.win16_seg_base_of(i)]),fs:e.get_fs_base(),code16:e.is_code16(),
  fpu:[e.get_fpu_top(),e.get_fpu_tags(),e.get_fpu_sw(),hex(REGIONS.FPU_FILE.base,128),hex(REGIONS.FPU_IMAGE_META.base,32)],
 };}
 e.set_esp(ss+0xb000);setup([0xdb,0xe3,0xd9,0xe8,0xd9,0xeb]);
 const bodies=[[96],[97],[102,96],[102,97],[96,97],[102,96,102,97],[96,102,97],[102,96,97]],records=[];
 let rows=0,excluded=0,wraps=0,id=0;
 for(const body of bodies)for(const start of [0x8000,0x8001,0x10,0x11,0xfff0,0xfff1])for(const high of [0,0x12340000]){
  // Preflight exact slots without executing: a slot may not straddle 64KB.
  let probe=start,pc=0,valid=true,wrap=false;
  while(pc<body.length){let w=2;if(body[pc]===102){pc++;w=4;}const op=body[pc++];for(let i=0;i<8;i++){
   if(op===96){if(probe<w)wrap=true;probe=(probe-w)&65535;}
   if(probe+w>65536)valid=false;
   if(op===97){if(probe+w>=65536)wrap=true;probe=(probe+w)&65535;}
  }}
  if(!valid){excluded++;continue;}
  const at=cs+0x100+id++*32,code=[...body,235,0];mem.set(code,g(at));
  for(const hot of [0,1]){
   e.set_esp(ss+0xb000);setup([0x68,0xd7,0x0a,0x9d,...(hot?[0xb8,0,0x80,0x83,0xe8,1,0xfd]:[0xfc])]);
   dv.setUint16(g(ds+0x7000),hot?0xb7f:0x37f,true);setup([0xd9,0x2e,0,0x70]);
   for(let j=0;j<65536;j++)mem[g(ss)+j]=(j*37+id*11+hot*83)&255;
   const initial=[0xa1234567,0xb2345678,0xc3456789,0xd456789a,(ss+high+start)>>>0,0xface8800,0xe56789ab,0xf6789abc].map((n,i)=>i===4?n:(n+hot*0x111111)>>>0);
   gp.forEach((r,i)=>e['set_'+r](initial[i]));
   const bf=flags(),bcw=cw(),before=state(),bytes=Buffer.from(mem.subarray(g(ss),g(ss)+65536));
   // BigInt byte model: high architectural ESP survives every low-SP step.
   const r=initial.map(BigInt),m=Buffer.from(bytes),steps=[];pc=0;
   while(pc<body.length){let w=2;if(body[pc]===102){pc++;w=4;}const op=body[pc++],original=r[4]-BigInt(ss);let sp=original&65535n;
    for(const k of op===96?[0,1,2,3,4,5,6,7]:[7,6,5,4,3,2,1,0]){
     if(op===96)sp=(sp-BigInt(w))&65535n;
     a(sp+BigInt(w)<=65536n);
     if(op===96){const v=k===4?original:r[k];for(let j=0;j<w;j++)m[Number(sp)+j]=Number((v>>BigInt(8*j))&255n);}
     else{if(k!==4){let v=0n;for(let j=0;j<w;j++)v|=BigInt(m[Number(sp)+j])<<BigInt(8*j);r[k]=w===2?(r[k]&0xffff0000n)|v:v;}sp=(sp+BigInt(w))&65535n;}
     r[4]=BigInt(ss)+(original&0xffff0000n)+sp;
    }steps.push({op,width:w,original:Number(original),final:Number(r[4]-BigInt(ss))});
   }
   // Independent slot-vector model uses Number arithmetic and read/writeUInt.
   const rr=initial.slice(),mm=Buffer.from(bytes);pc=0;
   while(pc<body.length){let w=2;if(body[pc]===102){pc++;w=4;}const op=body[pc++],original=(rr[4]-ss)>>>0,sp=original&65535;
    const offsets=Array.from({length:8},(_,j)=>(sp+(op===96?-(j+1):j)*w+65536)&65535);
    if(op===96){const values=rr.slice();values[4]=original;offsets.forEach((off,j)=>w===2?mm.writeUInt16LE(values[j]&65535,off):mm.writeUInt32LE(values[j]>>>0,off));}
    else offsets.forEach((off,j)=>{const k=7-j;if(k!==4){const v=w===2?mm.readUInt16LE(off):mm.readUInt32LE(off);rr[k]=w===2?((rr[k]&0xffff0000)|v)>>>0:v;}});
    rr[4]=(ss+(original&0xffff0000)+((sp+(op===96?-8:8)*w+65536)&65535))>>>0;
   }
   a.deepEqual(rr,r.map(Number));a.deepEqual(mm,m);
   e.clear_yield();e.set_eip(at);const hits=e.get_page_hits(),stores=e.get_cache_stores(),ev=events.length;
   e.run(1);const after=state(),actualBytes=Buffer.from(mem.subarray(g(ss),g(ss)+65536));
   a.deepEqual(after,{...before,gp:r.map(Number)},JSON.stringify({body,start,high,hot}));a.deepEqual(actualBytes,m);
   a.equal(e.get_eip()>>>0,at+code.length);a.deepEqual([e.get_yield_reason(),e.get_yield_flag()],[0,0]);
   a.deepEqual(Buffer.from(mem.subarray(g(at),g(at)+code.length)),Buffer.from(code));a.equal(events.length,ev);
   a.deepEqual([e.get_page_hits()-hits,e.get_cache_stores()-stores],hot?[1,0]:[0,1]);a.equal(flags(),bf);a.equal(cw(),bcw);
   records.push({body,start,high,hot,wrap,before,after,flags:bf,cw:bcw,steps,cache:hot?'hit':'cold',stackBefore:bytes.toString('hex'),stackExpected:m.toString('hex'),stackActual:actualBytes.toString('hex'),independentVectorPASS:true});rows++;if(wrap)wraps++;
  }
 }
 const out=process.env.AGGREGATE_NE_RAW;if(out)fs.writeFileSync(out,require('zlib').gzipSync(JSON.stringify(records)));
 console.log(JSON.stringify({scope:'NE default16/66 operand32 SS16',rows,actualCache:rows/2,wrapRows:wraps,excludedStraddlingCases:excluded,independentModels:true,full64KBStackGuards:true,pass:true}));
}
