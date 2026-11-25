'use strict';
// Usage: node test/test-ascii-adjust.js [wasm] [regions.json] [bounded|full]
// Full: AAA/AAS 52224 + AAD 32768 + focused AAM/AAD 24 rows.
// Every input executes cold and again at its actual cached address.
const runAscii=(()=>{
'use strict';
const fs=require('fs'),a=require('assert/strict'),z=require('zlib'),crypto=require('crypto'),d=__dirname;
const le=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24&255],sha=b=>crypto.createHash('sha256').update(b).digest('hex');
// Retains the minimal authored PE envelope and producer encoder from bcd-flags-root.
function fixturePE(){const b=Buffer.alloc(1024),p=128,o=p+24,s=o+224;b.writeUInt16LE(0x5a4d);b.writeUInt32LE(p,60);b.writeUInt32LE(0x4550,p);b.writeUInt16LE(0x14c,p+4);b.writeUInt16LE(1,p+6);b.writeUInt16LE(224,p+20);b.writeUInt16LE(0x102,p+22);b.writeUInt16LE(0x10b,o);for(const [k,v]of [[16,4096],[28,0x400000],[32,4096],[36,512],[56,8192],[60,512],[72,0x100000],[76,4096],[92,16]])b.writeUInt32LE(v,o+k);b.write('.text',s);for(const [k,v]of [[8,4096],[12,4096],[16,512],[20,512],[36,0xe0000020]])b.writeUInt32LE(v,s+k);b[512]=0xc3;return b;}
// Literal primary Intel AX operation. The review uses separate byte arithmetic.
function oracle(op,ax,af){const adjust=(ax&15)>9||!!af;let r=ax;if(adjust){if(op===0x37)r=(r+0x106)&65535;else {r=(r-6)&65535;r=(r&255)|((((r>>>8)-1)&255)<<8);}}return {ax:r&0xff0f,flags:adjust?17:0};}
const producers=[['raw',0,0],['add8',8,0],['sub8',8,1],['add16',16,0],['sub16',16,1],['add32',32,0],['sub32',32,1]];
function producer(width,sub,af,cf){if(!width)return [];const max=2**width-1,vals=[0,1,6,9,15,16,17,max-16,max-15,max-1,max];for(const x of vals)for(const y of vals){const t=sub?x-y:x+y,r=t&max,A=((x^y^r)>>>4)&1,C=Number(sub?x<y:t>max);if(A===af&&C===cf){const imm=width===8?[y&255]:width===16?le(y).slice(0,2):le(y);return [0xb9,...le(x),...(width===16?[0x66]:[]),width===8?0x80:0x81,sub?0xe9:0xc1,...imm];}}throw Error('missing producer');}
async function main(file,regionFile,full,interaction=false){const mode='candidate',kind='production',matrix='main';
const bytes=fs.readFileSync(file),mod=await WebAssembly.compile(bytes),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),imports={};let hostLogs=0;
for(const i of WebAssembly.Module.imports(mod))(imports[i.module]||={})[i.name]=i.kind==='memory'?memory:i.name==='log_i32'?()=>{hostLogs++;}:()=>0;
const e=new WebAssembly.Instance(mod,imports).exports,mem=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer),g=x=>e.guest_to_wasm(x)>>>0,pe=fixturePE();mem.set(pe,e.get_staging());a(e.load_pe(pe.length)>=0);e.set_uop(0);e.set_block_exec(0);e.set_fault_unmapped(2);
const regions=regionFile?JSON.parse(fs.readFileSync(regionFile)):require('../tools/region-layout').layout().regions,baseOf=n=>regions.find(r=>r.name==='$'+n).base,fp=baseOf('FPU_FILE'),meta=baseOf('FPU_IMAGE_META');
const regs=['eax','ecx','edx','ebx','esp','ebp','esi','edi'],stack=0x1108000,flagOut=0xc07000,guard=0xc08000,cwIn=0xc09000,cwOut=0xc09010,hex=(p,n)=>Buffer.from(mem.subarray(p,p+n)).toString('hex');
let setupPC=0x1800000;const programs=new Map();function setup(b){const key=b.join(',');let at=programs.get(key);if(at===undefined){at=setupPC;setupPC+=64;a(setupPC<0x1900000);programs.set(key,at);mem.set([...b,235,0],g(at));}e.clear_yield();e.set_eip(at);e.run(1);}
setup([0xdb,0xe3,...Array(4).fill([0xd9,0xe8,0xd9,0xeb]).flat()]);
setup([0x66,0xb8,0x33,0,0x8e,0xd8,0x66,0xb8,0x44,0,0x8e,0xc0]);e.set_fs_base(0x12345000);
const readFlags=()=>{setup([0x9c,0x8f,0x05,...le(flagOut)]);return dv.getUint32(g(flagOut),true);};
const readCW=()=>{setup([0xd9,0x3d,...le(cwOut)]);return dv.getUint16(g(cwOut),true);};
function state(at){return {lazyRaw:['op','a','b','res','sign_shift'].map(n=>e['get_flag_'+n]()),gp:regs.map(r=>e['get_'+r]()>>>0),segments:['cs','ss','ds','es'].map(s=>e['get_sreg_'+s]()),fs:e.get_fs_base(),fpu:[e.get_fpu_top(),e.get_fpu_tags(),e.get_fpu_sw(),hex(fp,128),hex(meta,32)],stack:hex(g(stack-32),64),guard:hex(g(guard),128),code:hex(g(at),16),eip:e.get_eip()>>>0};}
const rows=[],edges=[0,5,6,9,10,0xf9,0xfa,255],ahs=[0,255,15,16],uppers=[0,0x12340000,0xffff0000];let pc=0x2000000;
function add(op,al,ah,af,cf,upper,prod,group){const at=pc;pc+=16;mem.set(matrix==='excluded'?[0xf0,op,235,0]:[op,235,0,0x90],g(at));rows.push({op,al,ah,af,cf,upper,prod,at,group});}
for(const op of [0x37,0x3f])for(const ah of ahs)for(let af=0;af<2;af++)for(let cf=0;cf<2;cf++){
 if(matrix==='main'){
  for(const al of full?Array.from({length:256},(_,i)=>i):[0,5,6,9,10,249,250,255])for(const upper of uppers)add(op,al,ah,af,cf,upper,producers[0],'exhaustiveAL');
  for(const al of edges)for(const prod of producers.slice(1))add(op,al,ah,af,cf,uppers[(al+ah+af+cf+prod[1]+prod[2])%3],prod,'lazyWidths');
 }else for(const al of edges)for(const prod of producers)add(op,al,ah,af,cf,uppers[(al+ah+af+cf+prod[1]+prod[2])%3],prod,'excludedLOCK');
}
a.equal(rows.length*2,full?52224:4608);
const fd=null;let lines=[],count=0,failures=0,traps=0,cold=0,cached=0,cacheFailures=0,setupFailures=0,firstFailure=null;const hash=crypto.createHash('sha256'),failureCounts={};
function flush(){if(!lines.length)return;const raw=Buffer.from(lines.join('')),gz=z.gzipSync(raw,{level:1});a(z.gunzipSync(gz).equals(raw));hash.update(raw);lines=[];}
for(const v of rows)for(let path=0;path<2;path++){
 const {op,al,ah,af,cf,upper,prod,at}=v,seed=(0x202|((al&1)?0x400:0)|((al&2)?0x800:0)|(af<<4)|cf)>>>0;
 dv.setUint16(g(cwIn),0x7f|((al&3)<<10)|((af?3:0)<<8),true);setup([0xd9,0x2d,...le(cwIn)]);
 regs.forEach((r,i)=>e['set_'+r](i===4?stack:(0x10203040+i*0x11111111)>>>0));mem.fill(0xa5,g(stack-32),g(stack+32));mem.fill(0x5a,g(guard),g(guard+128));
 setup([0x68,...le(seed),0x9d,...producer(prod[1],prod[2],af,cf)]);e.set_eax((upper|(ah<<8)|al)>>>0);const beforeFlags=readFlags(),lazy=[e.get_flag_op(),e.get_flag_sign_shift()];
 const setupOK=(beforeFlags&17)===((af<<4)|cf)&&(prod[1]===0?lazy[0]===9:lazy[0]===(prod[2]?2:1)&&lazy[1]===prod[1]-1);if(!setupOK)setupFailures++;
 const beforeCW=readCW();e.clear_yield();e.set_eip(at);const before=state(at),h=e.get_page_hits(),s=e.get_cache_stores(),logs=hostLogs;let error=null;
 try{e.run(1);}catch(err){error={name:err.name,message:err.message};traps++;}
 const after=state(at),cache={hits:e.get_page_hits()-h,stores:e.get_cache_stores()-s},afterFlags=readFlags(),afterCW=readCW(),want=oracle(op,(ah<<8)|al,af),same=(x,y)=>JSON.stringify(x)===JSON.stringify(y);
 const cacheOK=path===0?cache.stores===1:cache.stores===0&&cache.hits===1;
 let checks={setup:setupOK,noTrap:error===null,eax:after.gp[0]===((upper|want.ax)>>>0),otherGP:same(after.gp.slice(1),before.gp.slice(1)),segments:same(after.segments,before.segments)&&after.fs===before.fs,fpu:same(after.fpu,before.fpu),fpuCW:beforeCW===afterCW,stack:after.stack===before.stack,guard:after.guard===before.guard,code:after.code===before.code,eip:after.eip===at+3,definedFlags:(afterFlags&17)===want.flags,unaffectedFlags:(afterFlags&~0x8d5)===(beforeFlags&~0x8d5),cache:cacheOK};
 if(matrix==='excluded')checks={setup:setupOK,trap:error?.name==='RuntimeError',unchanged:same(after,{...before,eip:at+1}),fpuCW:beforeCW===afterCW,flags:afterFlags===beforeFlags,cache:cacheOK};
 if(!checks.cache)cacheFailures++;if(cache.stores===1)cold++;if(path===1&&cache.hits===1&&cache.stores===0)cached++;
 const pass=Object.values(checks).every(Boolean);count++;if(!pass){failures++;for(const [k,b]of Object.entries(checks))if(!b)failureCounts[k]=(failureCounts[k]||0)+1;}
 const row={...v,path,seed,beforeCW,afterCW,beforeFlags,afterFlags,lazy,before,after,cache,error,hostLogs:hostLogs-logs,want,checks,pass};if(!pass&&!firstFailure)firstFailure=row;lines.push(JSON.stringify(row)+'\n');if(lines.length===512)flush();
}
flush();const result={mode,kind,matrix,module:{file,sha256:sha(bytes),bytes:bytes.length},authoredPE:{bytes:pe.length,sha256:sha(pe)},cases:count,failures,traps,cold,cached,cacheFailures,setupFailures,failureCounts,firstFailure,rows:{rawSha256:hash.digest('hex')},undefinedFlags:['OF','SF','ZF','PF'],codeMode:'authored PE32; opcode-level applicability only'};
console.log(JSON.stringify({...result,firstFailure:firstFailure?{op:firstFailure.op,al:firstFailure.al,ah:firstFailure.ah,af:firstFailure.af,cf:firstFailure.cf,error:firstFailure.error,cache:firstFailure.cache,checks:firstFailure.checks}:null}));
a.equal(failures,0,JSON.stringify(firstFailure));a.equal(cached,count/2);a.equal(cold,count/2);return result;
}
return main;

})();
const runAad=(()=>{
'use strict';
const fs=require('fs'),a=require('assert/strict'),z=require('zlib'),crypto=require('crypto'),d=__dirname;
const le=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24&255],sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function fixturePE(){const b=Buffer.alloc(1024),p=128,o=p+24,s=o+224;b.writeUInt16LE(0x5a4d);b.writeUInt32LE(p,60);b.writeUInt32LE(0x4550,p);b.writeUInt16LE(0x14c,p+4);b.writeUInt16LE(1,p+6);b.writeUInt16LE(224,p+20);b.writeUInt16LE(0x102,p+22);b.writeUInt16LE(0x10b,o);for(const [k,v]of [[16,4096],[28,0x400000],[32,4096],[36,512],[56,8192],[60,512],[72,0x100000],[76,4096],[92,16]])b.writeUInt32LE(v,o+k);b.write('.text',s);for(const [k,v]of [[8,4096],[12,4096],[16,512],[20,512],[36,0xe0000020]])b.writeUInt32LE(v,s+k);b[512]=0xc3;return b;}
// Intel byte arithmetic oracle, undefined flags excluded.
function oracle(op,al,ah,base){const r=(al+ah*base)%256;let ones=0;for(let i=0;i<8;i++)ones+=r>>>i&1;return {al:r,flags:(Number(r===0)<<6)|(r&128)|((1-ones%2)<<2)};}
const producers=[['raw',0,0],['add8',8,0],['sub8',8,1],['add16',16,0],['sub16',16,1],['add32',32,0],['sub32',32,1]];
function producer(width,sub,af,cf){if(!width)return [];const max=2**width-1,vals=[0,1,6,9,15,16,17,max-16,max-15,max-1,max];for(const x of vals)for(const y of vals){const t=sub?x-y:x+y,r=t&max,A=((x^y^r)>>>4)&1,C=Number(sub?x<y:t>max);if(A===af&&C===cf){const imm=width===8?[y&255]:width===16?le(y).slice(0,2):le(y);return [0xb9,...le(x),...(width===16?[0x66]:[]),width===8?0x80:0x81,sub?0xe9:0xc1,...imm];}}throw Error('missing producer');}
async function main(file,regionFile,full,interaction=false){const mode='candidate',kind='production',bytes=fs.readFileSync(file),mod=await WebAssembly.compile(bytes),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),imports={};let hostLogs=0;
for(const i of WebAssembly.Module.imports(mod))(imports[i.module]||={})[i.name]=i.kind==='memory'?memory:i.name==='log_i32'?()=>{hostLogs++;}:()=>0;
const e=new WebAssembly.Instance(mod,imports).exports,mem=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer),g=x=>e.guest_to_wasm(x)>>>0,pe=fixturePE();mem.set(pe,e.get_staging());a(e.load_pe(pe.length)>=0);e.set_uop(0);e.set_block_exec(0);e.set_fault_unmapped(2);
const regions=regionFile?JSON.parse(fs.readFileSync(regionFile)):require('../tools/region-layout').layout().regions,baseOf=n=>regions.find(r=>r.name==='$'+n).base,fp=baseOf('FPU_FILE'),meta=baseOf('FPU_IMAGE_META');
const regs=['eax','ecx','edx','ebx','esp','ebp','esi','edi'],stack=0x1108000,flagOut=0xc07000,guard=0xc08000,hex=(p,n)=>Buffer.from(mem.subarray(p,p+n)).toString('hex');
let setupPC=0x1800000;const programs=new Map();function setup(b){const key=b.join(',');let at=programs.get(key);if(at===undefined){at=setupPC;setupPC+=64;programs.set(key,at);mem.set([...b,235,0],g(at));}e.clear_yield();e.set_eip(at);e.run(1);}
setup([0xdb,0xe3,0xd9,0xe8,0xd9,0xeb]); const cwIn=0xc09000,cwOut=0xc09010;function readCW(){setup([0xd9,0x3d,...le(cwOut)]);return dv.getUint16(g(cwOut),true);} const readFlags=()=>{setup([0x9c,0x8f,0x05,...le(flagOut)]);return dv.getUint32(g(flagOut),true);};
function state(at){return {gp:regs.map(r=>e['get_'+r]()>>>0),segments:['cs','ss','ds','es'].map(s=>e['get_sreg_'+s]()),fs:e.get_fs_base(),fpu:[e.get_fpu_top(),e.get_fpu_tags(),e.get_fpu_sw(),hex(fp,128),hex(meta,32)],stack:hex(g(stack-32),64),guard:hex(g(guard),128),code:hex(g(at),interaction?6:5),eip:e.get_eip()>>>0};}
// Programs are authored and prewritten; no original file or entry point is used.
const rows=[];let pc=0x2000000;for(const [encoding,base] of (interaction?[['aam-aad',10]]:[['default',10],... [0,1,2,8,10,16,255].map(x=>['explicit',x])]))for(const al of interaction?[0,1,9,10,99,255]:full?Array.from({length:256},(_,i)=>i):[0,5,6,9,10,249,250,255])for(const ah of (interaction?[0,255]:[0,1,2,9,15,127,128,255])){const op=0xd5,af=(al+ah)&1,cf=(al>>>1)&1,upper=[0,0x12340000,0xffff0000][(al+ah+base)%3],prod=producers[(al+ah+base)%7];const at=pc;pc+=16;mem.set(interaction?[0xd4,10,op,base,235,0]:[op,base,235,0,0x90],g(at));rows.push({op,encoding,base,al,ah,af,cf,upper,prod,at});}
const fd=null;let lines=[],count=0,failures=0,traps=0,cold=0,cached=0,cacheFailures=0,setupFailures=0,firstFailure=null;const hash=crypto.createHash('sha256'),failureCounts={};
function flush(){if(!lines.length)return;const raw=Buffer.from(lines.join('')),gz=z.gzipSync(raw,{level:1});a(z.gunzipSync(gz).equals(raw));hash.update(raw);lines=[];}
for(const v of rows)for(let path=0;path<2;path++){
 const {op,al,ah,base,af,cf,upper,prod,at}=v,seed=(0x202|((al&1)?0x400:0)|((al&2)?0x800:0)|(af<<4)|cf)>>>0;
 dv.setUint16(g(cwIn),0x7f|((al&3)<<10)|((ah&1?3:0)<<8),true);setup([0xd9,0x2d,...le(cwIn)]);regs.forEach((r,i)=>e['set_'+r](i===4?stack:(0x10203040+i*0x11111111)>>>0));mem.fill(0xa5,g(stack-32),g(stack+32));mem.fill(0x5a,g(guard),g(guard+128));
 setup([0x68,...le(seed),0x9d,...producer(prod[1],prod[2],af,cf)]);e.set_eax((upper|(ah<<8)|al)>>>0);const beforeFlags=readFlags(),lazy=[e.get_flag_op(),e.get_flag_sign_shift()];
 const setupOK=(beforeFlags&17)===((af<<4)|cf)&&(prod[1]===0?lazy[0]===9:lazy[0]===(prod[2]?2:1)&&lazy[1]===prod[1]-1);if(!setupOK)setupFailures++;
 const beforeCW=readCW();e.clear_yield();e.set_eip(at);const before=state(at),h=e.get_page_hits(),s=e.get_cache_stores(),logs=hostLogs;let error=null;
 try{e.run(1);}catch(err){error={name:err.name,message:err.message};traps++;}
 const after=state(at),cache={hits:e.get_page_hits()-h,stores:e.get_cache_stores()-s},afterFlags=readFlags(),afterCW=readCW(),want=oracle(op,al,interaction?0:ah,base),same=(x,y)=>JSON.stringify(x)===JSON.stringify(y);
 const checks={fpuCW:beforeCW===afterCW,setup:setupOK,noTrap:error===null,eax:after.gp[0]===((upper|want.al)>>>0),otherGP:same(after.gp.slice(1),before.gp.slice(1)),segments:same(after.segments,before.segments)&&after.fs===before.fs,fpu:same(after.fpu,before.fpu),stack:after.stack===before.stack,guard:after.guard===before.guard,code:after.code===before.code,eip:after.eip===at+(interaction?6:4),definedFlags:(afterFlags&0xc4)===want.flags,unaffectedFlags:(afterFlags&~0x8d5)===(beforeFlags&~0x8d5),cache:path===0?cache.stores===1:cache.stores===0&&cache.hits===1};
 if(!checks.cache)cacheFailures++;if(cache.stores===1)cold++;if(path===1&&cache.hits===1&&cache.stores===0)cached++;
 const pass=Object.values(checks).every(Boolean);count++;if(!pass){failures++;for(const [k,b]of Object.entries(checks))if(!b)failureCounts[k]=(failureCounts[k]||0)+1;}
 const row={...v,path,seed,beforeCW,afterCW,beforeFlags,afterFlags,lazy,before,after,cache,error,hostLogs:hostLogs-logs,want,checks,pass};if(!pass&&!firstFailure)firstFailure=row;lines.push(JSON.stringify(row)+'\n');if(lines.length===512)flush();
}
flush();const result={mode,kind,module:{file,sha256:sha(bytes),bytes:bytes.length},authoredPE:{bytes:pe.length,sha256:sha(pe)},cases:count,failures,traps,cold,cached,cacheFailures,setupFailures,failureCounts,firstFailure,rows:{rawSha256:hash.digest('hex')},undefinedFlags:'AF/CF/OF undefined; excluded from assertions',codeMode:'PE32 legacy; Win16 applicability is opcode-level, no Win16 original launched'};console.log(JSON.stringify({...result,firstFailure:firstFailure?{op:firstFailure.op,al:firstFailure.al,af:firstFailure.af,cf:firstFailure.cf,error:firstFailure.error,cache:firstFailure.cache,checks:firstFailure.checks}:null}));a.equal(failures,0,JSON.stringify(firstFailure));a.equal(cached,count/2);a.equal(cold,count/2);return result;
}
return main;

})();
(async()=>{const [file='build/wine-assembly.wasm',regions,mode='bounded']=process.argv.slice(2);require('assert/strict')(['bounded','full'].includes(mode));const results=[await runAscii(file,regions,mode==='full'),await runAad(file,regions,mode==='full'),await runAad(file,regions,false,true)];console.log(JSON.stringify({pass:true,mode,cases:results.map(r=>r.cases)}));})().catch(e=>{console.error(e);process.exitCode=1;});
