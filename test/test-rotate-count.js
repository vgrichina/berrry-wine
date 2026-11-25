'use strict';
const fs=require('fs'),a=require('assert/strict'),z=require('zlib'),c=require('crypto'),d=__dirname;
const sha=b=>c.createHash('sha256').update(b).digest('hex'),le=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24&255],same=(x,y)=>JSON.stringify(x)===JSON.stringify(y);
// Intel ROL/ROR: five-bit masked zero preserves flags; nonzero full cycles
// update CF. OF is defined only at masked count one. Iterate one bit at a time.
function oracle(width,type,value,count,flags){let r=value,cf=flags&1;const m=2**width,top=m/2,n=count&31;
 for(let i=0;i<n;i++){if(type===0){cf=Number(r>=top);r=(r*2)%m+cf;}else{cf=r%2;r=Math.floor(r/2)+cf*top;}}
 let mask=n===0?0xffffffff:(n===1?0xffffffff:0xfffff7ff),out=flags;
 if(n){out=(out&~1)|cf;if(n===1){const of=type===0?Number(r>=top)^cf:Number(r>=top)^Number(r%top>=top/2);out=(out&~0x800)|(of<<11);}}
 return{result:r,cf,flags:out>>>0,mask:mask>>>0};}
function instruction(v){const prefix=[...(v.width===16?[0x66]:[]),...(v.loc==='fsabs'?[0x64]:[])],op=v.form==='imm'?(v.width===8?0xc0:0xc1):v.form==='cl'?(v.width===8?0xd2:0xd3):(v.width===8?0xd0:0xd1),t=v.type<<3;
 const addr=v.loc==='reg'?[0xc0|t]:v.loc==='high'?[0xc4|t]:v.loc==='abs'?[0x05|t,...le(0xc10040)]:v.loc==='fsabs'?[0x05|t,...le(0x1040)]:v.loc==='base'?[0x43|t,0x40]:[0x44|t,0x73,0x38];
 return [...prefix,op,...addr,...(v.form==='imm'?[v.count]:[])];}
function matrix(){const rows=[];function add(width,type,loc,form,count,vector,reference=false){const m=2**width,values=[1,m/2,m-1,Math.floor(m/3)],value=values[vector%4],wanted=oracle(width,type%2,value,count,0).cf,cf=(count&31)?wanted^1:vector&1,seed=(0x202|[0x400,0x244100,0x244500,0][vector%4]|[0x894,0x40,0x84,0x810][vector%4]|cf)>>>0;
 const v={id:rows.length,width,type,loc,form,count,vector,value,seed,lazy:(rows.length%3===0)?[8,16,32][rows.length%9/3|0]:0,reference,at:0x2000000+rows.length*32};v.code=instruction(v);rows.push(v);}
 for(const w of [8,16,32])for(const t of [0,1]){
  const counts=[...new Set([0,1,w,2*w,3*w,32,33,255].filter(n=>n<=255))];
  for(const f of ['imm','cl'])for(const n of counts)for(const v of [0,1])add(w,t,'reg',f,n,v);
  // Memory route samples cover every path and form, with full-cycle focus.
  for(const loc of ['abs','base','sib','fsabs'])for(const f of ['imm','cl']){
   const counts=loc==='abs'?[0,1,w,32,255]:loc==='base'?[w,33,255]:loc==='sib'?[0,w,32]:[1,w,33];
   for(const n of [...new Set(counts)])for(const v of [0,1])add(w,t,loc,f,n,v);
  }
  for(const loc of ['reg','abs','base'])add(w,t,loc,'one',1,2);
 }
 for(const t of [0,1])for(const f of ['imm','cl'])for(const n of [0,1,8,16,24,32,33,255])add(8,t,'high',f,n,n%4);
 for(const t of [0,1])for(const f of ['imm','cl'])for(const loc of ['abs','base'])for(const n of [16,24])add(8,t,loc,f,n,3);
 // Carry-through rotates are bounded raw-identity references, not new oracle scope.
 for(const w of [8,16,32])for(const t of [2,3])for(const loc of ['reg','base'])for(const n of [0,1,32,255])add(w,t,loc,n===1?'one':'imm',n,2,true);
 return rows;}
function fixturePE(){const b=Buffer.alloc(1024),p=128,o=p+24,s=o+224;b.writeUInt16LE(0x5a4d);b.writeUInt32LE(p,60);b.writeUInt32LE(0x4550,p);b.writeUInt16LE(0x14c,p+4);b.writeUInt16LE(1,p+6);b.writeUInt16LE(224,p+20);b.writeUInt16LE(0x102,p+22);b.writeUInt16LE(0x10b,o);for(const [k,v]of [[16,4096],[28,0x400000],[32,4096],[36,512],[56,8192],[60,512],[72,0x100000],[76,4096],[92,16]])b.writeUInt32LE(v,o+k);b.write('.text',s);for(const [k,v]of [[8,4096],[12,4096],[16,512],[20,512],[36,0xe0000020]])b.writeUInt32LE(v,s+k);b[512]=0xc3;return b;}
main().catch(err=>{console.error(err);process.exitCode=1;});
async function main(){const phase='candidate',kind='production',file=process.argv[2]||'build/wine-assembly.wasm',bytes=fs.readFileSync(file),record={path:file,sha256:sha(bytes)},rows=matrix();a.equal(rows.length,610);
 const mod=await WebAssembly.compile(bytes),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),imports={};let logs=[];
 for(const i of WebAssembly.Module.imports(mod))(imports[i.module]||={})[i.name]=i.kind==='memory'?memory:(...args)=>{logs.push({name:i.module+'.'+i.name,args});return 0;};
 const e=new WebAssembly.Instance(mod,imports).exports,mem=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer),g=x=>e.guest_to_wasm(x)>>>0,pe=fixturePE();mem.set(pe,e.get_staging());a(e.load_pe(pe.length)>=0);e.set_uop(0);e.set_block_exec(0);e.set_fault_unmapped(2);
 const regions=process.argv[3]?JSON.parse(fs.readFileSync(process.argv[3])):require('../tools/region-layout').layout().regions,base=n=>regions.find(r=>r.name==='$'+n).base,fp=base('FPU_FILE'),meta=base('FPU_IMAGE_META');
 const regs=['eax','ecx','edx','ebx','esp','ebp','esi','edi'],stack=0x1108000,flagOut=0xc07000,cwIn=0xc09000,cwOut=0xc09010,data=0xc10000,fsData=0xd00000,hex=(p,n)=>Buffer.from(mem.subarray(p,p+n)).toString('hex');
 let setupPC=0x1800000;const programs=new Map();function setup(b){const key=b.join(',');let at=programs.get(key);if(at===undefined){at=setupPC;setupPC+=64;programs.set(key,at);mem.set([...b,235,0],g(at));}e.clear_yield();e.set_eip(at);e.run(1);}
 setup([0xdb,0xe3,0xd9,0xe8,0xd9,0xeb,0xd9,0xc9,0xd8,0xd1]);a.equal(e.get_fpu_sw()&0x4500,0x100);
 const readFlags=()=>{setup([0x9c,0x8f,0x05,...le(flagOut)]);return dv.getUint32(g(flagOut),true);},readCW=()=>{setup([0xd9,0x3d,...le(cwOut)]);return dv.getUint16(g(cwOut),true);};
 const lazy=()=>[e.get_flag_op(),e.get_flag_a(),e.get_flag_b(),e.get_flag_res(),e.get_flag_sign_shift()];
 function state(v){return {gp:regs.map(r=>e['get_'+r]()>>>0),segments:['cs','ss','ds','es','fs','gs'].filter(s=>typeof e['get_sreg_'+s]==='function').map(s=>[s,e['get_sreg_'+s]()]),fs:e.get_fs_base(),fpu:[e.get_fpu_top(),e.get_fpu_tags(),e.get_fpu_sw(),hex(fp,128),hex(meta,32)],stack:hex(g(stack-64),128),data:hex(g(data),128),fsData:hex(g(fsData),128),code:hex(g(v.at),32),eip:e.get_eip()>>>0,lazy:lazy(),yield:[e.get_yield_reason(),e.get_yield_flag()]};}
 for(const v of rows)mem.set([...v.code,235,0,...Array(30-v.code.length).fill(0x90)],g(v.at));
 const fd=process.argv[4]?fs.openSync(process.argv[4],'w'):null,rawHash=c.createHash('sha256');let lines=[],count=0,failures=0,cold=0,cached=0,firstFailure=null,categories={},fullCycleFailures=0;
 function flush(){if(!lines.length)return;const b=Buffer.from(lines.join(''));rawHash.update(b);if(fd!==null)fs.writeSync(fd,z.gzipSync(b,{level:6}));lines=[];}
 for(const v of rows)for(let path=0;path<2;path++){
  dv.setUint16(g(cwIn),0x7f|((v.id&3)<<10)|((v.id&4)?0x300:0),true);setup([0xd9,0x2d,...le(cwIn)]);
  e.set_esp(stack);mem.fill(0xa5,g(stack-64),g(stack+64));mem.fill(0x5a,g(data),g(data+128));mem.fill(0x69,g(fsData),g(fsData+128));e.set_fs_base(fsData-0x1000);
  const cf=v.seed&1,producer=v.lazy?[0xba,...le(cf?2**v.lazy-1:1),...(v.lazy===16?[0x66]:[]),v.lazy===8?0x80:0x81,0xc2,...(v.lazy===8?[1]:v.lazy===16?[1,0]:le(1))]:[];
  setup([0x68,...le(v.seed),0x9d,...producer]);
  regs.forEach((r,i)=>e['set_'+r](i===4?stack:(0x10203040+i*0x11111111)>>>0));e.set_ecx((0x50607000|v.count)>>>0);e.set_ebx(data);e.set_esi(4);
  if(v.loc==='reg')e.set_eax(((0xa55af00d&~(v.width===32?-1:2**v.width-1))|v.value)>>>0);else if(v.loc==='high')e.set_eax((0xa55a00ed|(v.value<<8))>>>0);
  const target=(v.loc==='reg'||v.loc==='high')?null:v.loc==='fsabs'?fsData+0x40:data+0x40;
  if(target!==null)for(let i=0;i<v.width/8;i++)mem[g(target)+i]=Math.floor(v.value/2**(8*i))&255;
  const beforeFlags=readFlags(),beforeCW=readCW();e.clear_yield();e.set_eip(v.at);const before=state(v),h=e.get_page_hits(),s=e.get_cache_stores(),logAt=logs.length;let error=null;
  try{e.run(1);}catch(err){error={name:err.name,message:err.message};}
  const after=state(v),cache={hits:e.get_page_hits()-h,stores:e.get_cache_stores()-s},events=logs.slice(logAt),afterFlags=readFlags(),afterCW=readCW(),want=oracle(v.width,v.type%2,v.value,v.count,beforeFlags);
  const expectedGP=before.gp.slice(),expectedData=Buffer.from(before.data,'hex'),expectedFS=Buffer.from(before.fsData,'hex');
  if(!v.reference){if(v.loc==='reg')expectedGP[0]=((before.gp[0]&~(v.width===32?-1:2**v.width-1))|want.result)>>>0;else if(v.loc==='high')expectedGP[0]=((before.gp[0]&~0xff00)|(want.result<<8))>>>0;else for(let i=0;i<v.width/8;i++)(v.loc==='fsabs'?expectedFS:expectedData)[64+i]=Math.floor(want.result/2**(8*i))&255;}
  const seeded=v.lazy?((v.seed&~0x8d5)|(cf?0x55:0))>>>0:v.seed;
  const checks={producerFlags:beforeFlags===seeded,actualLazy:before.lazy[0]===(v.lazy?1:9),noTrap:error===null,flags:v.reference||((afterFlags&want.mask)>>>0)===((want.flags&want.mask)>>>0),gp:v.reference||same(after.gp,expectedGP),data:v.reference||(after.data===expectedData.toString('hex')&&after.fsData===expectedFS.toString('hex')),segments:same(before.segments,after.segments)&&before.fs===after.fs,fpu:same(before.fpu,after.fpu),cw:beforeCW===afterCW&&beforeCW===dv.getUint16(g(cwIn),true),stack:before.stack===after.stack,code:before.code===after.code,eip:after.eip===v.at+v.code.length+2,noYield:same(after.yield,[0,0]),zeroMaskedRawLazy:(v.count&31)!==0||same(before.lazy,after.lazy),zeroMaskedRawFlags:(v.count&31)!==0||afterFlags===beforeFlags,cache:path===0?cache.hits===0&&cache.stores===1:cache.hits===1&&cache.stores===0};
  if(path===0&&cache.stores===1)cold++;if(path===1&&cache.hits===1&&cache.stores===0)cached++;
  const pass=Object.values(checks).every(Boolean),row={id:count,caseId:v.id,path,beforeFlags,afterFlags,beforeCW,afterCW,before,after,cache,events,error,want:v.reference?null:want,checks,pass};count++;if(!pass){failures++;for(const [k,ok]of Object.entries(checks))if(!ok)categories[k]=(categories[k]||0)+1;if(!firstFailure)firstFailure={...row,case:v};if(!v.reference&&(v.count&31)!==0&&(v.count&31)%v.width===0)fullCycleFailures++;}
  lines.push(JSON.stringify(row)+'\n');if(lines.length>=128)flush();
 }
 flush();if(fd!==null){fs.fsyncSync(fd);fs.closeSync(fd);}const result={phase,kind,module:record,cases:count,failures,cold,cached,categories,fullCycleFailures,firstFailure,rawSHA256:rawHash.digest('hex'),authoredPE:{bytes:pe.length,sha256:sha(pe)},setupPrograms:programs.size};console.log(JSON.stringify({...result,firstFailure:firstFailure?{id:firstFailure.id,case:firstFailure.case,checks:firstFailure.checks}:null}));
 // Baseline architectural failures are measured evidence, not infrastructure failure.
 process.exitCode=phase==='candidate'&&failures?1:0;
}
