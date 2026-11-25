'use strict';
// Bounded default: 2688 rows; full: 86016; excluded: 2688 LOCK rows;
// control: 1344 populated-x87/CW rows. No retained run dependencies.
// Usage: node test/test-decimal-adjust.js [wasm] [regions.json] [output.json] [bounded|full|excluded|control]
const fs=require('fs'),a=require('assert/strict'),z=require('zlib'),crypto=require('crypto');
const le=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24&255],sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function fixturePE(){const b=Buffer.alloc(1024),p=128,o=p+24,s=o+224;b.writeUInt16LE(0x5a4d);b.writeUInt32LE(p,60);b.writeUInt32LE(0x4550,p);b.writeUInt16LE(0x14c,p+4);b.writeUInt16LE(1,p+6);b.writeUInt16LE(224,p+20);b.writeUInt16LE(0x102,p+22);b.writeUInt16LE(0x10b,o);for(const [k,v]of [[16,4096],[28,0x400000],[32,4096],[36,512],[56,8192],[60,512],[72,0x100000],[76,4096],[92,16]])b.writeUInt32LE(v,o+k);b.write('.text',s);for(const [k,v]of [[8,4096],[12,4096],[16,512],[20,512],[36,0xe0000020]])b.writeUInt32LE(v,s+k);b[512]=0xc3;return b;}
// Literal Intel operation, independent of WAT implementation.
function oracle(op,al,af,cf){const old=al,oldCF=cf;cf=0;if((al&15)>9||af){const t=al+(op===0x27?6:-6);cf=oldCF|Number(t<0||t>255);al=t&255;af=1;}else af=0;if(old>153||oldCF){al=(al+(op===0x27?96:-96))&255;cf=1;}else if(op===0x27)cf=0;let ones=0;for(let i=0;i<8;i++)ones+=al>>>i&1;return {al,flags:cf|(af<<4)|(Number(al===0)<<6)|(al&128)|((1-(ones%2))<<2)};}
const producers=[['raw',0,0],['add8',8,0],['sub8',8,1],['add16',16,0],['sub16',16,1],['add32',32,0],['sub32',32,1]];
function producer(width,sub,af,cf){if(!width)return [];const max=2**width-1,vals=[0,1,6,9,15,16,17,max-16,max-15,max-1,max];for(const x of vals)for(const y of vals){const t=sub?x-y:x+y,r=t&max,A=((x^y^r)>>>4)&1,C=Number(sub?x<y:t>max);if(A===af&&C===cf){const imm=width===8?[y&255]:width===16?le(y).slice(0,2):le(y);return [0xb9,...le(x),...(width===16?[0x66]:[]),width===8?0x80:0x81,sub?0xe9:0xc1,...imm];}}throw Error('missing producer');}
async function main(){const [file='build/wine-assembly.wasm',regionFile,output,mode='bounded']=process.argv.slice(2);
a(['bounded','full','excluded','control'].includes(mode),'unknown matrix mode');
const kind='production',bytes=fs.readFileSync(file),mod=await WebAssembly.compile(bytes),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),imports={};let hostLogs=0;
for(const i of WebAssembly.Module.imports(mod))(imports[i.module]||={})[i.name]=i.kind==='memory'?memory:i.name==='log_i32'?()=>{hostLogs++;}:()=>0;
const e=new WebAssembly.Instance(mod,imports).exports,mem=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer),g=x=>e.guest_to_wasm(x)>>>0,pe=fixturePE();mem.set(pe,e.get_staging());a(e.load_pe(pe.length)>=0);e.set_uop(0);e.set_block_exec(0);e.set_fault_unmapped(2);
const regions=regionFile?JSON.parse(fs.readFileSync(regionFile)):require('../tools/region-layout').layout().regions,baseOf=n=>regions.find(r=>r.name==='$'+n).base,fp=baseOf('FPU_FILE'),meta=baseOf('FPU_IMAGE_META');
const regs=['eax','ecx','edx','ebx','esp','ebp','esi','edi'],stack=0x1108000,flagOut=0xc07000,guard=0xc08000,hex=(p,n)=>Buffer.from(mem.subarray(p,p+n)).toString('hex');
let setupPC=0x1800000;const programs=new Map();function setup(b){const key=b.join(',');let at=programs.get(key);if(at===undefined){at=setupPC;setupPC+=64;programs.set(key,at);mem.set([...b,235,0],g(at));}e.clear_yield();e.set_eip(at);e.run(1);}
if(mode==='control')setup([0xdb,0xe3,0xd9,0xe8,0xd9,0xeb]);
const cwIn=0xc09000,cwOut=0xc09010;
function readCW(){setup([0xd9,0x3d,...le(cwOut)]);return dv.getUint16(g(cwOut),true);}
const readFlags=()=>{setup([0x9c,0x8f,0x05,...le(flagOut)]);return dv.getUint32(g(flagOut),true);};
function state(at){return {gp:regs.map(r=>e['get_'+r]()>>>0),segments:['cs','ss','ds','es'].map(s=>e['get_sreg_'+s]()),fs:e.get_fs_base(),fpu:[e.get_fpu_top(),e.get_fpu_tags(),e.get_fpu_sw(),hex(fp,128),hex(meta,32)],stack:hex(g(stack-32),64),guard:hex(g(guard),128),code:hex(g(at),4),eip:e.get_eip()>>>0};}
// Programs are authored and prewritten; no original file or entry point is used.
const rows=[];let pc=0x2000000;for(const op of [0x27,0x2f])for(const al of mode==='full'?Array.from({length:256},(_,i)=>i):mode==='control'?[0,5,0x99,255]:[0,5,6,9,10,0x99,0x9a,255])for(let af=0;af<2;af++)for(let cf=0;cf<2;cf++)for(const upper of [0,0x12345600,0xffffff00])for(const prod of producers){const at=pc;pc+=16;mem.set(mode==='excluded'?[0xf0,op,235,0]:[op,235,0,0x90],g(at));rows.push({op,al,af,cf,upper,prod,at});}
const rowFile=output?output+'.rows.jsonl.gz':null,fd=rowFile?fs.openSync(rowFile,'w'):null;let lines=[],count=0,failures=0,traps=0,cold=0,cached=0,cacheFailures=0,setupFailures=0,firstFailure=null;const hash=crypto.createHash('sha256'),failureCounts={};
function flush(){if(!lines.length)return;const raw=Buffer.from(lines.join('')),gz=z.gzipSync(raw,{level:1});a(z.gunzipSync(gz).equals(raw));hash.update(raw);if(fd!==null)fs.writeSync(fd,gz);lines=[];}
for(const v of rows)for(let path=0;path<2;path++){
 const {op,al,af,cf,upper,prod,at}=v,seed=(0x202|((al&1)?0x400:0)|((al&2)?0x800:0)|(af<<4)|cf)>>>0;
 if(mode==='control'){dv.setUint16(g(cwIn),0x7f|((al&3)<<10)|((af?3:0)<<8),true);setup([0xd9,0x2d,...le(cwIn)]);}
 regs.forEach((r,i)=>e['set_'+r](i===4?stack:(0x10203040+i*0x11111111)>>>0));mem.fill(0xa5,g(stack-32),g(stack+32));mem.fill(0x5a,g(guard),g(guard+128));
 setup([0x68,...le(seed),0x9d,...producer(prod[1],prod[2],af,cf)]);e.set_eax((upper|al)>>>0);const beforeFlags=readFlags(),lazy=[e.get_flag_op(),e.get_flag_sign_shift()];
 const setupOK=(beforeFlags&17)===((af<<4)|cf)&&(prod[1]===0?lazy[0]===9:lazy[0]===(prod[2]?2:1)&&lazy[1]===prod[1]-1);if(!setupOK)setupFailures++;
 const beforeCW=mode==='control'?readCW():null;
 e.clear_yield();e.set_eip(at);const before=state(at),h=e.get_page_hits(),s=e.get_cache_stores(),logs=hostLogs;let error=null;
 try{e.run(1);}catch(err){error={name:err.name,message:err.message};traps++;}
 const after=state(at),cache={hits:e.get_page_hits()-h,stores:e.get_cache_stores()-s},afterFlags=readFlags(),afterCW=mode==='control'?readCW():null,want=oracle(op,al,af,cf),same=(x,y)=>JSON.stringify(x)===JSON.stringify(y);
 let checks={fpuCW:beforeCW===afterCW,setup:setupOK,noTrap:error===null,eax:after.gp[0]===((upper|want.al)>>>0),otherGP:same(after.gp.slice(1),before.gp.slice(1)),segments:same(after.segments,before.segments)&&after.fs===before.fs,fpu:same(after.fpu,before.fpu),stack:after.stack===before.stack,guard:after.guard===before.guard,code:after.code===before.code,eip:after.eip===at+3,definedFlags:(afterFlags&0xd5)===want.flags,unaffectedFlags:(afterFlags&~0x8d5)===(beforeFlags&~0x8d5),cache:path===0?cache.stores===1:cache.stores===0&&cache.hits===1};
 // Invalid LOCK consumes its prefix before trapping at the opcode byte.
 if(mode==='excluded')checks={setup:setupOK,trap:error?.name==='RuntimeError',unchanged:same(after,{...before,eip:at+1}),flags:(afterFlags&~0x800)===(beforeFlags&~0x800),cache:checks.cache};
 if(!checks.cache)cacheFailures++;if(cache.stores===1)cold++;if(path===1&&cache.hits===1&&cache.stores===0)cached++;
 const pass=Object.values(checks).every(Boolean);count++;if(!pass){failures++;for(const [k,b]of Object.entries(checks))if(!b)failureCounts[k]=(failureCounts[k]||0)+1;}
 const row={...v,path,seed,beforeCW,afterCW,beforeFlags,afterFlags,lazy,before,after,cache,error,hostLogs:hostLogs-logs,want,checks,pass};if(!pass&&!firstFailure)firstFailure=row;lines.push(JSON.stringify(row)+'\n');if(lines.length===512)flush();
}
flush();if(fd!==null){fs.fsyncSync(fd);fs.closeSync(fd);}const result={mode,kind,module:{file,sha256:sha(bytes),bytes:bytes.length},authoredPE:{bytes:pe.length,sha256:sha(pe)},cases:count,failures,traps,cold,cached,cacheFailures,setupFailures,failureCounts,firstFailure,rows:{file:rowFile,rawSha256:hash.digest('hex'),gzipSha256:rowFile?sha(fs.readFileSync(rowFile)):null},OF:'undefined; excluded from assertions',codeMode:'PE32 legacy; Win16 applicability is opcode-level, no Win16 original launched'};if(output)fs.writeFileSync(output,JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,firstFailure:firstFailure?{op:firstFailure.op,al:firstFailure.al,af:firstFailure.af,cf:firstFailure.cf,error:firstFailure.error,cache:firstFailure.cache,checks:firstFailure.checks}:null}));
a.equal(count,mode==='full'?86016:mode==='control'?1344:2688);
a.equal(failures,0,JSON.stringify(result.firstFailure));a.equal(cached,count/2);a.equal(cold,count/2);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
