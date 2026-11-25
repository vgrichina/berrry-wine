'use strict';
const fs=require('fs'),a=require('assert/strict'),crypto=require('crypto');
const [file=process.env.WINE_ASSEMBLY_WASM || 'build/wine-assembly.wasm',regionFile,out]=process.argv.slice(2);
const le=x=>[x&255,x>>>8&255,x>>>16&255,x>>>24];
const body=[0x0f,0x18,0x86,0x38,2,0,0,0x0f,0x6f,6,0x0f,0x6f,0x4e,8,0x0f,0x7f,7,0x0f,0x7f,0x4f,8,0x0f,0x6f,0x56,16,0x0f,0x6f,0x5e,24,0x0f,0x7f,0x57,16,0x0f,0x7f,0x5f,24,0x0f,0x6f,0x46,32,0x0f,0x6f,0x4e,40,0x0f,0x7f,0x47,32,0x0f,0x7f,0x4f,40,0x0f,0x6f,0x56,48,0x0f,0x6f,0x5e,56,0x0f,0x7f,0x57,48,0x0f,0x7f,0x5f,56,0x83,0xc6,64,0x83,0xc7,64,0x49,0x75,0xb2];
const ops=[['L',0,0,7],['L',1,8,10],['S',0,0,14],['S',1,8,17],['L',2,16,21],['L',3,24,25],['S',2,16,29],['S',3,24,33],['L',0,32,37],['L',1,40,41],['S',0,32,45],['S',1,40,49],['L',2,48,53],['L',3,56,57],['S',2,48,61],['S',3,56,65]];
const regs=['eax','ecx','edx','ebx','esp','ebp','esi','edi'],pc=0x1820000,env=0xc01000,stack=0x1108000,input=0xc02000;
async function context(file,regions){
 const bytes=fs.readFileSync(file),mod=await WebAssembly.compile(bytes),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),imports={};
 for(const i of WebAssembly.Module.imports(mod))(imports[i.module]||={})[i.name]=i.kind==='memory'?memory:i.name==='math_log2'?Math.log2:i.name==='math_pow2'?x=>2**x:()=>0;
 const e=new WebAssembly.Instance(mod,imports).exports,mem=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer),map=(regions?JSON.parse(fs.readFileSync(regions)):require('../tools/region-layout').layout().regions),base=n=>map.find(r=>r.name==='$'+n).base;
 mem.set(fs.readFileSync('test/binaries/notepad.exe'),e.get_staging());a(e.load_pe(fs.statSync('test/binaries/notepad.exe').size));
 const g=x=>e.guest_to_wasm(x)>>>0,write=(at,b)=>b.forEach((v,i)=>e.guest_write8(at+i,v));
 function exec(at,code,budget=1){if(code)write(at,code);e.clear_yield();e.set_eip(at);e.run(budget);}
 let faultMode=null;
 function init(s){const mode=s.redirect?3:2;if(mode!==faultMode){e.set_fault_unmapped(mode);faultMode=mode;}e.set_uop(0);e.set_block_exec(0);e.set_block_chain(0);e.set_branch_clock(s.clock||0);e.set_mmx_copy64(s.enabled===false?0:1);e.set_esp(stack);
   exec(pc+0x2000,[0xdb,0xe3,0xeb,0]);
   [0x37f,3<<11,0xffff,0,0,0,0].forEach((v,i)=>e.guest_write32(env+i*4,v));exec(pc+0x2200,[0xd9,0x25,...le(env),0xeb,0]);
   for(let i=0;i<8;i++){dv.setBigInt64(g(input),9007199254740993n+BigInt(i*2),true);exec(pc+0x2100,[0xdf,0x2d,...le(input),0xeb,0]);}
   exec(pc+0x2250,[0xdd,0xc2,0xdd,0xc3,0xdd,0xc4,0xeb,0]);
   exec(pc+0x2300,[0x68,...le(0xad7),0x9d,0xeb,0]);
   regs.forEach((r,i)=>e['set_'+r](0x71000000+i*0x10001));e.set_esp(stack);e.set_esi(s.src);e.set_edi(s.dst);e.set_ecx(s.count);e.guest_write32(stack,0);
   e.set_fs_base(env+256);e.guest_write32(env+256,-1);
 }
 function snap(){return {gp:regs.map(r=>e['get_'+r]()>>>0),flags:e.uop_flags(),lazy:['op','a','b','res','sign_shift'].map(x=>e['get_flag_'+x]()),mm:Array.from({length:8},(_,i)=>BigInt.asUintN(64,e.get_mmx(i)).toString(16)),se:Array.from({length:8},(_,i)=>dv.getUint16(base('FPU_IMAGE_META')+i*2,true)),fp:Buffer.from(mem.subarray(base('FPU_FILE'),base('FPU_FILE')+128)).toString('hex'),meta:Buffer.from(mem.subarray(base('FPU_IMAGE_META'),base('FPU_IMAGE_META')+32)).toString('hex'),top:e.get_fpu_top(),tag:e.get_fpu_tags(),sw:e.get_fpu_sw(),eip:e.get_eip()>>>0,yield:e.get_yield_reason(),xmm:Buffer.from(mem.subarray(base('XMM_FILE'),base('XMM_FILE')+128)).toString('hex')};}
 return {e,mem,dv,g,write,exec,init,snap,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
}
function model(s,seed,initial){const memory=new Map(initial),mm=seed.mm.map(x=>BigInt('0x'+x)),se=seed.se.slice(),trace=[];let src=s.src,dst=s.dst,count=s.count,entered=false,fail=null;
 outer:for(let iter=0;iter<s.count;iter++){
  for(const [kind,p,off,ip]of ops){if(iter===0&&s.resumeIP!==undefined&&ip<s.resumeIP)continue;const addr=(kind==='L'?src:dst)+off,half=[0,4].find(h=>!memory.has(addr+h)||!memory.has(addr+h+3));
   if(half!==undefined){fail={iter,kind,p,off,ip,address:kind==='S'&&half===4?addr+7:addr+half};trace.push({...fail,success:false});break outer;}
   if(kind==='L'){let q=0n;for(let j=0;j<8;j++)q|=BigInt(memory.get(addr+j))<<BigInt(j*8);mm[p]=q;se[p]=65535;}else for(let j=0;j<8;j++)memory.set(addr+j,Number(mm[p]>>BigInt(j*8)&255n));
   entered=true;trace.push({iter,kind,p,off,ip,success:true});
  }src+=64;dst+=64;count--;
 }
 return {memory,mm:mm.map(x=>x.toString(16)),se,src:src>>>0,dst:dst>>>0,count,entered,fail,trace};}
async function run(){
 const cand=await context(file,regionFile),base=await context(file,regionFile),rows=[];
 const cases=[
  {name:'literal-one',count:1},{name:'literal-three',count:3},{name:'bounded-513',count:513},{name:'overlap-forward',count:3,overlap:3},{name:'overlap-backward',count:3,overlap:-3},{name:'negative-hash-prefetch',count:3,negative:true},{name:'disabled',count:3,enabled:false},{name:'branch-clock',count:3,clock:1},
  {name:'source-first',count:1,sourceRoom:0},{name:'source-second-load',count:1,sourceRoom:8},{name:'source-second-half',count:1,sourceRoom:40},{name:'source-straddle',count:1,sourceRoom:4},{name:'destination-first',count:1,destRoom:0},{name:'destination-second-pair',count:1,destRoom:16},{name:'destination-straddle',count:1,destRoom:4},{name:'source-later-iteration',count:2,sourceRoom:64},{name:'destination-later-iteration',count:2,destRoom:64},
  {name:'redirect-source-first',count:1,sourceRoom:0,redirect:true},{name:'redirect-source-second',count:1,sourceRoom:8,redirect:true},{name:'redirect-destination-first',count:1,destRoom:0,redirect:true},{name:'redirect-destination-later',count:2,destRoom:64,redirect:true}
 ];
 for(let ci=0;ci<cases.length;ci++)for(let cached=0;cached<2;cached++){
  const s={src:0xc10000,dst:0xc30000,...cases[ci]},page=0xe0000000+ci*0x20000;
  if(s.overlap)s.dst=s.src+s.overlap;
  if(s.sourceRoom!==undefined)s.src=page+4096-s.sourceRoom;
  if(s.destRoom!==undefined)s.dst=page+4096-s.destRoom;
  const ranges=[[0xc0f000,0x20000],[0xc30000,0x10000]];if(s.sourceRoom!==undefined||s.destRoom!==undefined)ranges.push([page,4096]);
  const code=body.slice();if(s.negative)code[3]++;
  const record={name:s.name,cached:!!cached};try{
   let expect,reference;
   for(const [who,c]of [['baseline',base],['candidate',cand]]){
    const {e,dv,g}=c;
    c.init(who==='baseline'?{...s,enabled:false}:s);if(!cached)c.write(pc,[...code,0xc3]);
    // Only mapped fixture pages are initialized or read.
    if(ranges.length===3&&!cached)a(e.test_virtual_map_commit(page,4096));
    const initial=new Map();for(const [at,len]of ranges)for(let j=0;j<len;j++){const b=(Math.imul(at+j,29)+((at+j)>>>8)+17)&255;c.mem[g(at)+j]=b;initial.set(at+j,b);}
    const before=c.snap();expect=model(s,before,initial);e.clear_yield();e.set_eip(pc);e.set_handler_hist_enabled(1);e.reset_handler_hist();
    const stores=e.get_cache_stores();let trap=false;try{e.run(4000);}catch(error){a(error instanceof WebAssembly.RuntimeError);trap=true;}
    const after=c.snap(),hist=dv.getUint32(e.get_handler_hist_base()+419*4,true),blocks=e.get_last_run_blocks();
    a.equal(trap,!!expect.fail&&!s.redirect,'trap');a.deepEqual(after.mm,expect.mm,'literal mantissas');a.deepEqual(after.se,expect.se,'literal SE');
    a.equal(after.gp[6],expect.src,'ESI');a.equal(after.gp[7],expect.dst,'EDI');a.equal(after.gp[1],expect.count,'ECX');a.equal(after.top,expect.entered?0:before.top);a.equal(after.tag,expect.entered?255:before.tag);
    for(const [at,len]of ranges)for(let j=0;j<len;j++)a.equal(c.mem[g(at)+j],expect.memory.get(at+j),'literal memory '+(at+j).toString(16));
    const shouldFold=who==='candidate'&&!s.negative&&s.enabled!==false;a.equal(hist>0,shouldFold,'H419 actual installed execution');
    if(cached)a.equal(e.get_cache_stores(),stores,'same-address cached decode reused');
    if(expect.fail&&who==='candidate'&&!s.redirect)a.equal(after.eip,pc+expect.fail.ip,'precise original fault instruction EIP');
    if(s.redirect){a.equal(after.eip,0);a.equal(after.yield,2);}
    const compare={...after};delete compare.eip;
    if(who==='baseline')reference={state:compare,blocks,hist};else {a.deepEqual(compare,reference.state,'baseline functional/fault state');record.blocks={baseline:reference.blocks,candidate:blocks};record.h419={baseline:reference.hist,candidate:hist};record.fault=expect.fail;record.state=after;}
    record[who]={trap,blocks,h419:hist,cacheStores:e.get_cache_stores()-stores};
   }
   // The literal unfaulted copy reduction is stable on both cold and cached runs.
   if(s.name==='bounded-513')a(record.blocks.candidate<record.blocks.baseline/10,'bounded block reduction');
   if(s.clock)a.equal(record.blocks.candidate,record.blocks.baseline,'branch-clock charge');
   if(cached&&expect.fail&&!s.redirect){
    const c=cand,{e,g,dv}=c,st=c.snap();a(e.test_virtual_map_commit(page+4096,4096));const initial=new Map(expect.memory);
    for(let j=0;j<4096;j++){const at=page+4096+j,b=(Math.imul(at,29)+(at>>>8)+17)&255;c.mem[g(page+4096)+j]=b;initial.set(at,b);}
    const resumed=model({...s,src:st.gp[6],dst:st.gp[7],count:st.gp[1],resumeIP:expect.fail.ip},st,initial);a.equal(resumed.fail,null);
    e.clear_yield();e.set_eip(st.eip);e.run(4000);const after=c.snap();a.equal(after.eip,0);a.deepEqual(after.mm,resumed.mm);a.deepEqual(after.se,resumed.se);a.equal(after.gp[6],resumed.src);a.equal(after.gp[7],resumed.dst);a.equal(after.gp[1],0);
    for(const [at,b]of resumed.memory)a.equal(c.mem[g(at)],b,'restart literal memory');record.restart={pass:true,at:st.eip,mm:after.mm,esi:after.gp[6],edi:after.gp[7],ecx:after.gp[1]};
   }
   if(cached&&s.name==='literal-one'){
    const c=cand,{e,g,dv}=c;const probes=[];
    for(const p of [0,1,2,3,4]){c.exec(pc+0x2400,[0xdf,0x3d,...le(input),0xeb,0]);const value=dv.getBigInt64(g(input),true);a.equal(value,p===4?9007199254741005n:-9223372036854775808n,'signed-shadow invalidation/neighbor');probes.push({p,value:String(value)});}record.signedShadowProbes=probes;
   }
   record.pass=true;
  }catch(error){record.pass=false;record.error=error.stack;}
  rows.push(record);
 }
 // Replacing the first code line with RET must stop the batch and redecode.
 // The second and third lines must never execute from the invalidated body.
 const sm={name:'self-modifying-code',pass:false};
 try{
  let reference;
  for(const [who,c]of [['baseline',base],['candidate',cand]]){
   const s={src:0xc10000,dst:pc,count:3,enabled:who==='candidate'};
   c.init(s);c.write(pc,[...body,0xc3]);
   c.mem.fill(0x90,c.g(s.src),c.g(s.src)+192);c.mem[c.g(s.src)]=0xc3;
   const afterCode=Buffer.from(c.mem.subarray(c.g(pc)+64,c.g(pc)+78));
   c.e.set_handler_hist_enabled(1);c.e.reset_handler_hist();c.e.clear_yield();c.e.set_eip(pc);c.e.run(100);
   const after=c.snap(),h419=c.dv.getUint32(c.e.get_handler_hist_base()+419*4,true);
   a.equal(h419>0,who==='candidate');a.equal(after.eip,0);a.equal(after.gp[1],2);
   a.equal(after.gp[6],s.src+64);a.equal(after.gp[7],pc+64);a.equal(after.top,0);a.equal(after.tag,255);
   a(Buffer.from(c.mem.subarray(c.g(pc)+64,c.g(pc)+78)).equals(afterCode));
   a(Buffer.from(c.mem.subarray(c.g(pc),c.g(pc)+64)).equals(Buffer.from(c.mem.subarray(c.g(s.src),c.g(s.src)+64))));
   if(reference)a.deepEqual(after,reference);else reference=after;
   sm[who]={h419,ecx:after.gp[1],eip:after.eip};
  }
  sm.pass=true;
 }catch(error){sm.error=error.stack;}
 rows.push(sm);
 const result={module:file,candidate:cand.sha256,baseline:base.sha256,cases:rows.length,failures:rows.filter(r=>!r.pass).length,rows};if(out)fs.writeFileSync(out,JSON.stringify(result,null,2));console.log(JSON.stringify({cases:result.cases,failures:result.failures}));if(result.failures)process.exitCode=1;
}
run().catch(error=>{console.error(error);process.exitCode=2;});
