#!/usr/bin/env node
// Authored finite images; no installed application or retained evidence inputs.
'use strict';
const fs=require('fs'),a=require('assert/strict'),path=require('path');
const {REGIONS}=require('../lib/region-map.generated');
// Independent byte interpreter. No handler IDs, decoder operands or WAT helpers.
function oracle(code,before){
 const regs=before.gp.map(BigInt), memory=new Map(), reads=[],writes=[],steps=[];
 for(const r of before.memory)for(let i=0;i<r.hex.length/2;i++)memory.set(r.at+i,parseInt(r.hex.slice(i*2,i*2+2),16));
 const addr=n=>{a(n>=0n&&n<0x100000000n,'no wrap');return Number(n);};
 const read=(p,n)=>{let x=0n;for(let i=0;i<n;i++){a(memory.has(addr(p)+i),'mapped read');x|=BigInt(memory.get(addr(p)+i))<<BigInt(i*8);}reads.push({at:addr(p),bytes:n,value:Number(x)});return x;};
 const write=(p,n,x)=>{for(let i=0;i<n;i++){a(memory.has(addr(p)+i),'mapped write');memory.set(addr(p)+i,Number(x>>BigInt(i*8)&255n));}writes.push({at:addr(p),bytes:n,value:Number(x&((1n<<BigInt(n*8))-1n))});};
 const setBP=(n,w)=>{regs[5]=w===2?(regs[5]&0xffff0000n)|(n&65535n):n;};
 let pc=0;
 while(pc<code.length){const start=pc;let w=4;if(code[pc]===0x66){w=2;pc++;}const op=code[pc++];
  if(op===0xc8){const allocation=code[pc++]|(code[pc++]<<8),imm8=code[pc++],old=regs[5];
   a.equal(imm8,0,'only nesting zero is runtime-admitted');
   const push=x=>{regs[4]-=BigInt(w);write(regs[4],w,x);};push(old);const temp=regs[4],frameTemp=w===2?temp&65535n:temp;
   setBP(frameTemp,w);const pre=regs[4];regs[4]-=BigInt(allocation);
   // This admitted operand16 domain avoids low-word borrow and frame-region crossing.
   if(w===2)a((pre>>16n)===(regs[4]>>16n));
   addr(regs[4]);a(memory.has(addr(regs[4])),'final stack write-check mapped');
   steps.push({start,op:'ENTER',width:w*8,allocation,oldBP:Number(old),frameTemp:Number(frameTemp),esp:Number(regs[4]),ebp:Number(regs[5])});
  }else if(op===0xc9){regs[4]=regs[5];const x=read(regs[4],w);setBP(x,w);regs[4]+=BigInt(w);addr(regs[4]);steps.push({start,op:'LEAVE',width:w*8,esp:Number(regs[4]),ebp:Number(regs[5])});
  }else throw Error('unadmitted opcode '+op.toString(16));
 }
 return {gp:regs.map(Number),flags:before.flags,memory:before.memory.map(r=>({...r,hex:Buffer.from(Array.from({length:r.hex.length/2},(_,i)=>memory.get(r.at+i))).toString('hex')})),reads,writes,steps};
};

const same=(x,y)=>JSON.stringify(x)===JSON.stringify(y),gp=['eax','ecx','edx','ebx','esp','ebp','esi','edi'],le=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24&255];
function pe(){const b=Buffer.alloc(1024),p=128,o=p+24,s=o+224;b.writeUInt16LE(0x5a4d);b.writeUInt32LE(p,60);b.writeUInt32LE(0x4550,p);b.writeUInt16LE(0x14c,p+4);b.writeUInt16LE(1,p+6);b.writeUInt16LE(224,p+20);b.writeUInt16LE(0x102,p+22);b.writeUInt16LE(0x10b,o);for(const [k,v]of [[16,4096],[28,0x400000],[32,4096],[36,512],[56,8192],[60,512],[72,0x100000],[76,4096],[92,16]])b.writeUInt32LE(v,o+k);b.write('.text',s);for(const [k,v]of [[8,4096],[12,4096],[16,512],[20,512],[36,0xe0000020]])b.writeUInt32LE(v,s+k);b[512]=0xc3;return b;}
(process.argv.includes('--ne-only')?Promise.resolve():main()).then(()=>runNE()).catch(err=>{console.error(err);process.exitCode=1;});
async function main(){
 const module=await WebAssembly.compile(fs.readFileSync(process.argv[2]||path.join(__dirname,'../build/wine-assembly.wasm'))),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),imports={},events=[];
 for(const i of WebAssembly.Module.imports(module))(imports[i.module]||={})[i.name]=i.kind==='memory'?memory:(...args)=>{events.push({name:i.module+'.'+i.name,args});return 0;};
 const e=new WebAssembly.Instance(module,imports).exports,mem=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer),g=x=>e.guest_to_wasm(x)>>>0,header=pe();mem.set(header,e.get_staging());a(e.load_pe(header.length)>=0);a.equal(e.is_code16(),0);e.set_uop(0);e.set_block_exec(0);e.set_fault_unmapped(2);a(e.test_virtual_map_commit(0x30000000,0x10000));
 const fp=REGIONS.FPU_FILE.base,meta=REGIONS.FPU_IMAGE_META.base,helperStack=0x1308000,flagOut=0xc07000,cwIn=0xc09000,cwOut=0xc09010,hex=(p,n)=>Buffer.from(mem.subarray(p,p+n)).toString('hex');
 let setupPC=0x1800000;const setups=new Map();function setup(b){let at=setups.get(b.join(','));if(at===undefined){at=setupPC;setupPC+=64;setups.set(b.join(','),at);mem.set([...b,235,0],g(at));}e.clear_yield();e.set_eip(at);e.run(1);}
 function flags(){const saved=e.get_esp();e.set_esp(helperStack);setup([0x9c,0x8f,5,...le(flagOut)]);e.set_esp(saved);return dv.getUint32(g(flagOut),true);}
 function cw(){setup([0xd9,0x3d,...le(cwOut)]);return dv.getUint16(g(cwOut),true);}
 e.set_esp(helperStack);setup([0xdb,0xe3,0xd9,0xe8,0xd9,0xeb,0xd9,0xc9,0xd8,0xd1]);a.equal(e.get_fpu_sw()&0x4500,0x100);
 const cases=frameCases();for(const v of cases)mem.set([...v.code,235,0,...Array(30-v.code.length).fill(144)],g(v.at));
 let ranges=[];function state(v){return {gp:gp.map(r=>e['get_'+r]()>>>0),flags:null,segments:Array.from({length:6},(_,i)=>[e.win16_sreg(i),e.win16_seg_base_of(i)]),fs:e.get_fs_base(),code16:e.is_code16(),fpu:[e.get_fpu_top(),e.get_fpu_tags(),e.get_fpu_sw(),hex(fp,128),hex(meta,32)],cw:null,lazy:[e.get_flag_op(),e.get_flag_a(),e.get_flag_b(),e.get_flag_res(),e.get_flag_sign_shift()],memory:ranges.map(r=>({...r,hex:hex(g(r.at),r.bytes)})),code:hex(g(v.at),32),eip:e.get_eip()>>>0,yield:[e.get_yield_reason(),e.get_yield_flag()]};}
 let count=0,cached=0;
 for(const v of cases)for(const hot of [0,1]){
  const stack=(v.layout==='direct'?0x1109000:0x30009000)+v.odd+hot*64,frame=stack+0x800;
  a.equal(stack>>>14,frame>>>14);a((stack&65535)>v.allocation+128);a.equal(e.win16_seg_base_of(2),0);
  ranges=[{name:'complete-stack-allocation-with-readable-low-high-guards',at:stack-1024,bytes:2048},{name:'complete-ancestry-with-readable-guards',at:frame-256,bytes:512},{name:'named-guard-low',at:stack-1040,bytes:16},{name:'named-guard-high',at:frame+256,bytes:16},{name:'named-data-control',at:0xd01000,bytes:64}];
  for(const r of ranges){a.notEqual(g(r.at),0xf0);a.equal(g(r.at+r.bytes-1),g(r.at)+r.bytes-1);for(let i=0;i<r.bytes;i++)mem[g(r.at+i)]=(i*37+v.id*11+hot*83+19)&255;}
  dv.setUint16(g(cwIn),0x7f|((v.id%4)<<10)|((v.id&4)?0x300:0),true);setup([0xd9,0x2d,...le(cwIn)]);
  const raw=v.producer<8,seed=0x202|[0,2,4,6,7,11].reduce((n,b,k)=>n|((((v.id+hot*17)>>>k)&1)<<b),0),pw=raw?0:[8,8,16,16,32,32][v.producer-8],sub=!raw&&v.producer%2===1;
  e.set_esp(helperStack);setup([0x68,...le(seed),0x9d,...(raw?[]:[0xb8,...le(2**(pw-1)),...(pw===16?[102]:[]),pw===8?128:129,sub?232:192,...(pw===8?[1]:pw===16?[1,0]:le(1))]),hot?0xfd:0xfc]);
  const regs=[(0xa1234567+hot*0x111111)>>>0,(0xb2345678+hot*0x222222)>>>0,(0xc3456789+hot*0x333333)>>>0,(0xd456789a+hot*0x444444)>>>0,stack,frame,(0xe56789ab+hot*0x555555)>>>0,(0xf6789abc+hot*0x666666)>>>0];gp.forEach((r,i)=>e['set_'+r](regs[i]));e.set_fs_base(hot?0x200000:0x100000);
  const beforeFlags=flags(),beforeCW=cw();e.clear_yield();e.set_eip(v.at);const before=state(v);before.flags=beforeFlags;before.cw=beforeCW;
  const intended=oracle(v.code,before);
  // Admit the complete footprint before executing this finite authored block.
  a([...intended.reads,...intended.writes].every(t=>ranges.some(r=>t.at>=r.at&&t.at+t.bytes<=r.at+r.bytes)));
  const hs=e.get_page_hits(),cs=e.get_cache_stores(),ev=events.length;let error=null;try{e.run(1);}catch(err){error={name:err.name,message:err.message};}
  const after=state(v),cache={hits:e.get_page_hits()-hs,stores:e.get_cache_stores()-cs},hostEvents=events.slice(ev);after.flags=flags();after.cw=cw();
  const checks={noTrap:!error,noHost:hostEvents.length===0,gp:same(after.gp,intended.gp),flags:after.flags===before.flags,lazy:same(after.lazy,before.lazy),memory:same(after.memory,intended.memory),segments:same(after.segments,before.segments)&&after.fs===before.fs&&after.code16===before.code16,fpu:same(after.fpu,before.fpu)&&after.cw===before.cw,code:after.code===before.code,eip:after.eip===v.at+v.code.length+2,yield:same(after.yield,[0,0]),cache:same(cache,hot?{hits:1,stores:0}:{hits:0,stores:1})};
  a(Object.values(checks).every(Boolean),JSON.stringify({v,hot,checks,expected:intended.gp,actual:after.gp}));
  count++;if(hot)cached++;
 }
 console.log('PE32 ENTER/LEAVE: '+count+' full-state rows, '+cached+' actual cache hits');
}

function frameCases(){
 const cases=[];
 for(const width of [16,32])for(const layout of ['direct','sparse'])for(const odd of [0,1])
 for(const producer of [0,9,12])for(const allocation of [0,1,3,4,16,256])for(const op of ['enter','leave','pair']){
  const prefix=width===16?[0x66]:[],enter=[...prefix,0xc8,allocation&255,allocation>>>8,0],leave=[...prefix,0xc9];
  cases.push({id:cases.length,at:0x2000000+cases.length*32,width,layout,odd,producer,allocation,
   code:op==='enter'?enter:op==='leave'?leave:[...enter,...leave]});
 }
 return cases;
}

// A 16-bit NE with eight full 64K segments, all authored here. The tested
// stack offsets stay inside [0x6000,0xa000); no wrap, limit or fault behavior.
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
 const cs=e.win16_seg_base_of(1)>>>0,ss=e.win16_seg_base_of(2)>>>0,g=p=>e.guest_to_wasm(p)>>>0;
 a.equal(ss,e.win16_seg_base(8)>>>0);a.equal(e.win16_seg_limit(8),65536);a.equal(ss&65535,0);
 const low=ss+0x6000,span=0x4000,hex=(p,n)=>Buffer.from(mem.subarray(p,p+n)).toString('hex');
 a.notEqual(g(low),0xf0);a.equal(g(low+span-1),g(low)+span-1);
 let helper=cs+0x9000;const setups=new Map();
 function setup(bytes){const k=bytes.join(',');if(!setups.has(k)){setups.set(k,helper);mem.set([...bytes,235,0],g(helper));helper+=32;a(helper<cs+0xff00);}e.clear_yield();e.set_eip(setups.get(k));e.run(1);}
 function flags(){const ax=e.get_eax(),sp=e.get_esp();e.set_esp(ss+0xb000);setup([0x9c,0x58]);const f=e.get_eax()&65535;e.set_eax(ax);e.set_esp(sp);return f;}
 function state(){return {
  gp:gp.map(r=>e['get_'+r]()>>>0),lazy:[e.get_flag_op(),e.get_flag_a(),e.get_flag_b(),e.get_flag_res(),e.get_flag_sign_shift()],
  segments:Array.from({length:6},(_,i)=>[e.win16_sreg(i),e.win16_seg_base_of(i)]),fs:e.get_fs_base(),code16:e.is_code16(),
  fpu:[e.get_fpu_top(),e.get_fpu_tags(),e.get_fpu_sw(),hex(REGIONS.FPU_FILE.base,128),hex(REGIONS.FPU_IMAGE_META.base,32)],
 };}
 e.set_esp(ss+0xb000);setup([0xdb,0xe3,0xd9,0xe8,0xd9,0xeb]);
 let id=0,rows=0;
 for(const width of [16,32])for(const allocation of [0,1,3,4,16,256])for(const odd of [0,1])for(const op of ['enter','leave','pair']){
  const at=cs+0x100+id++*32,prefix=width===32?[0x66]:[],enter=[...prefix,0xc8,allocation&255,allocation>>>8,0],leave=[...prefix,0xc9];
  const code=[...(op==='enter'?enter:op==='leave'?leave:[...enter,...leave]),235,0];mem.set(code,g(at));
  for(const hot of [0,1]){
   e.set_esp(ss+0xb000);setup([0x68,0xd7,0x0a,0x9d,hot?0xfd:0xfc]);
   for(let j=0;j<span;j++)mem[g(low)+j]=(j*37+id*11+hot*83)&255;
   const stack=ss+0x8000+odd+hot*64,frame=0x8800+odd+hot*64;
   const initial=[0xa1234567,0xb2345678,0xc3456789,0xd456789a,stack,(0xface0000|frame)>>>0,0xe56789ab,0xf6789abc].map((n,i)=>i===4||i===5?n:(n+hot*0x111111)>>>0);
   gp.forEach((r,i)=>e['set_'+r](initial[i]));
   const bf=flags(),before=state(),expected=initial.slice(),bytes=Buffer.from(mem.subarray(g(low),g(low)+span)),n=width/8;
   const setBP=x=>expected[5]=width===16?((expected[5]&0xffff0000)|(x&65535))>>>0:x>>>0;
   const write=(p,x)=>{a(p>=low&&p+n<=low+span);for(let j=0;j<n;j++)bytes[p-low+j]=x>>>(j*8)&255;};
   const read=p=>{a(p>=low&&p+n<=low+span);let x=0;for(let j=0;j<n;j++)x+=(bytes[p-low+j]*2**(j*8));return x>>>0;};
   if(op!=='leave'){expected[4]-=n;write(expected[4],expected[5]);setBP(expected[4]-ss);expected[4]-=allocation;}
   if(op!=='enter'){expected[4]=ss+(expected[5]&65535);setBP(read(expected[4]));expected[4]+=n;}
   a(expected[4]>=low&&expected[4]<low+span); // complete static, mapped footprint before run
   e.clear_yield();e.set_eip(at);const hits=e.get_page_hits(),stores=e.get_cache_stores(),ev=events.length;
   e.run(1);const after=state();
   a.deepEqual(after,{...before,gp:expected},JSON.stringify({width,allocation,odd,op,hot}));
   a.deepEqual(Buffer.from(mem.subarray(g(low),g(low)+span)),bytes);
   a.equal(e.get_eip()>>>0,at+code.length);a.deepEqual([e.get_yield_reason(),e.get_yield_flag()],[0,0]);
   a.deepEqual(Buffer.from(mem.subarray(g(at),g(at)+code.length)),Buffer.from(code));a.equal(events.length,ev);
   a.deepEqual([e.get_page_hits()-hits,e.get_cache_stores()-stores],hot?[1,0]:[0,1]);a.equal(flags(),bf);rows++;
  }
 }
 console.log('code16 ENTER/LEAVE: '+rows+' full-state rows, '+rows/2+' actual cache hits');
}

