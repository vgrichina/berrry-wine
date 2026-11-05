'use strict';
// Generated PE/x86, actual filesystem lazy fill, both shipped modules. No game/browser.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {test} = require('node:test');
const ROOT = process.env.READFILE_RETRY_ROOT || path.resolve(__dirname, '..');
const {VirtualFS} = require(path.join(ROOT, 'lib/filesystem'));
const bp = require(path.join(ROOT, 'lib/byte-provider'));
const {REGIONS} = require(path.join(ROOT, 'lib/region-map.generated'));
const B=0x400000, C=0x402000, CB=0x403000, CHILD=0x403200, S=0x074fff20;
const BUF=0x405000, COUNT=0x405100, DONE=0x405104, IAT=0x401460, EPOCH=0x996f5003;
const bytes=Uint8Array.from({length:96},(_,i)=>(i*37+11)&255);
const d32=v=>[v&255,v>>>8&255,v>>>16&255,v>>>24&255];
class Code {
 constructor(){this.b=[];}
 emit(...v){this.b.push(...v.flat());return this;}
 push(v){return this.emit(0x68,d32(v));}
 api(slot){return this.emit(0xff,0x15,d32(IAT+slot*8));}
 read(h){return this.push(0).push(COUNT).push(bytes.length).push(BUF).push(h).api(0);}
 callback(target){return this.push(0x44).push(0x33).push(0x22).push(0x11).push(target).api(1);}
}
function pe(){
 const img=Buffer.alloc(0x6200),at=r=>0x200+r-0x1000;
 const u16=(p,v)=>img.writeUInt16LE(v,p),u32=(p,v)=>img.writeUInt32LE(v>>>0,p);
 const p=0x80,o=p+24,s=o+0xe0;
 u16(0,0x5a4d);u32(0x3c,p);u32(p,0x4550);u16(p+4,0x14c);u16(p+6,1);u16(p+20,0xe0);u16(p+22,0x102);
 u16(o,0x10b);u32(o+4,0x6000);u32(o+16,C-B);u32(o+20,0x1000);u32(o+28,B);u32(o+32,0x1000);u32(o+36,0x200);
 u16(o+40,4);u16(o+48,4);u32(o+56,0x7000);u32(o+60,0x200);u16(o+68,2);
 for(const [k,v] of [[72,0x100000],[76,0x1000],[80,0x100000],[84,0x1000],[92,16]])u32(o+k,v);
 u32(o+104,0x1400);u32(o+108,60);
 img.write('.text',s);u32(s+8,0x6000);u32(s+12,0x1000);u32(s+16,0x6000);u32(s+20,0x200);u32(s+36,0xe0000060);
 for(const [i,dll,name] of [[0,'kernel32.dll','ReadFile'],[1,'user32.dll','CallWindowProcA']]){
  const desc=at(0x1400)+i*20,oft=0x1440+i*8,iat=0x1460+i*8,n=0x14a0+i*64;
  u32(desc,oft);u32(desc+12,n);u32(desc+16,iat);img.write(dll+'\0',at(n));
  u32(at(oft),n+20);u32(at(iat),n+20);img.write(name+'\0',at(n+20)+2);
 }
 return img;
}
async function fixture(file,{nested=false,tracked=false,postCallback=false,eager=false,armed=true,profile=2,hook}={}){
 const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
 const vfs=new VirtualFS(),trace=[],ctx={exports:null,vfs,getMemory:()=>memory.buffer};
 const provider={size:bytes.length,readRange:(off,len)=>Promise.resolve(bytes.slice(off,off+len))};
 if(eager){vfs.files.set('c:\\retry.dat',{data:bytes.slice(),attrs:0x20,name:'retry.dat'});}
 else vfs.setProviderFile('c:\\retry.dat',{provider:new bp.ChunkCache(provider,{chunkSize:32,maxChunks:2,readAhead:0,prefetch:0})});
 const h=vfs.createFile('c:\\retry.dat',0x80000000,3);
 const host=require(path.join(ROOT,'lib/host-imports')).createHostImports(ctx).host;
 let e,armedSlot;
 const snap=label=>{
  const depth=e.pending_context_depth(),dv=new DataView(memory.buffer);
  const row={label,eip:e.get_eip()>>>0,esp:e.get_esp()>>>0,eax:e.get_eax()>>>0,thread:e.get_current_thread_id(),
   epoch:e.pending_context_epoch()>>>0,root:String(e.null_diag_root()),nativeProcess:String(dv.getBigUint64(REGIONS.CALLBACK_OWNERSHIP.base+8,true)),
   cs:e.get_sreg_cs(),ss:e.get_sreg_ss(),yield:e.get_yield_reason(),steps:e.get_steps(),depth,
   entries:e.pending_context_callback_entries(),returns:e.pending_context_callback_returns(),reason:e.pending_context_reason(),
   stack:Array.from({length:6},(_,i)=>dv.getUint32(e.guest_to_wasm(e.get_esp())+i*4,true)),
   frames:Array.from({length:depth},(_,i)=>Array.from({length:8},(_,j)=>dv.getUint32(armedSlot+i*32+j*4,true)))};
  trace.push(row);return row;
 };
 Object.assign(host,{memory,exit(){},log(){},log_i32(){},crash_unimplemented(){},wait_multiple(){return 0;},shell_execute(){return 33;}});
 const read=host.fs_read_file_result;
 host.fs_read_file_result=function(...args){
  snap('host-read-entry');if(hook)hook('read',e,args);const result=Reflect.apply(read,this,args);
  Object.assign(snap('host-read-result'),{result,args});return result;
 };
 host.log_api_exit=()=>{snap('api-exit');if(hook)hook('exit',e,[]);};
 const result=await WebAssembly.instantiate(fs.readFileSync(path.join(ROOT,file)),{host});e=ctx.exports=result.instance.exports;
 const img=pe(),mem=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer);
 mem.set(img,e.get_staging());e.load_pe(img.length);
 const g2w=a=>e.guest_to_wasm(a)>>>0,put=(a,b)=>{mem.set(b,g2w(a));e.invalidate_code_range(a,b.length);};
 const u=(a,v)=>dv.setUint32(g2w(a),v>>>0,true),get=a=>dv.getUint32(g2w(a),true);
 const finish=c=>c.emit(0xa3,d32(DONE),0xeb,0xfe);
 const main=new Code();if(nested)main.callback(CB);else if(tracked)main.emit(0xe8,d32(0x4e95f0-C-5));else main.read(h);const successor=C+main.b.length;if(postCallback)main.callback(CB);finish(main);put(C,main.b);
 if(postCallback)put(CB,[0xb8,...d32(1),0xc2,16,0]);
 if(tracked)put(0x4e95f0,new Code().read(h).emit(0xc3).b);
 if(nested){const outer=new Code().callback(CHILD).emit(0xc2,16,0);put(CB,outer.b);put(CHILD,new Code().read(h).emit(0xc2,16,0).b);}
 e.set_api_log(1);e.set_uop(0);e.set_stack_fusion(0);e.set_eip(C);e.set_esp(S);u(S,0);u(COUNT,0xdeadbeef);u(DONE,0xdeadbeef);
 armedSlot=REGIONS.PENDING_CONTEXT.base+4096+dv.getUint32(REGIONS.PENDING_CONTEXT.base,true)*2048;
 if(armed)assert.equal(profile===1?e.pending_context_arm(EPOCH):e.pending_context_arm_profile(EPOCH,profile,B),1);
 return {e,mem,vfs,h,trace,snap,g2w,put,u,get,successor,nested,
  first:()=>Array.from({length:36},(_,i)=>e.pending_context_first_failure(i)>>>0)};
}
async function park(f){
 for(let i=0;i<32&&f.e.get_yield_reason()!==12;i++)f.e.run(1);
 assert.equal(f.e.get_yield_reason(),12,'actual io_block park');return f.snap('slice-park');
}
async function complete(f){
 let parks=0;
 for(let i=0;i<64&&f.get(DONE)===0xdeadbeef;i++){
  if(f.e.get_yield_reason()===12){
   const pending=f.vfs.getIoState(1).pendingRead;assert(pending,'real VFS pending read');
   f.snap('before-fill');await f.vfs.fillPendingRead(pending);f.snap('after-fill');
   f.e.clear_yield();f.snap('retry-ready');parks++;
  }
  f.e.run(1);f.snap('slice-return');
 }
 assert.notEqual(f.get(DONE),0xdeadbeef,'generated caller completed');return parks;
}
function evidence(file,mode,f){
 if(!process.env.READFILE_RETRY_EVIDENCE)return;
 fs.mkdirSync(process.env.READFILE_RETRY_EVIDENCE,{recursive:true});
 fs.writeFileSync(path.join(process.env.READFILE_RETRY_EVIDENCE,path.basename(file)+'.'+mode+'.json'),
  JSON.stringify({file,mode,trace:f.trace,first:f.first()},null,2)+'\n');
}
for(const file of ['build/wine-assembly.wasm','build/wine-assembly.compat.wasm']){
 for(const mode of ['lazy','eager','nested','tracked','after-retry-callback','unarmed','error'])test(file+' ReadFile ownership '+mode,async()=>{
  const f=await fixture(file,{nested:mode==='nested',tracked:mode==='tracked',postCallback:mode==='after-retry-callback',eager:mode==='eager',armed:mode!=='unarmed'});
  try{
   if(mode!=='eager'){
    const p=await park(f);assert.equal(p.eip,f.get(IAT));assert.equal(p.esp,S-(mode==='nested'?40:mode==='tracked'?4:0)-24);
    assert.equal(f.get(p.esp),mode==='nested'?CHILD+new Code().read(f.h).b.length:mode==='tracked'?0x4e95f0+new Code().read(f.h).b.length:f.successor);
    assert.equal(f.get(COUNT),0);assert.equal(f.get(DONE),0xdeadbeef);
    assert.equal(p.depth,mode==='nested'?2:mode==='tracked'?1:0,'park is not a guest callback');
    assert.equal(p.entries,mode==='nested'?2:0);
    if(mode==='error')f.vfs.closeHandle(f.h);
   }
   if(mode==='error'){
    // A failed/cancelled host operation retries to the ordinary API error.
    f.e.clear_yield();for(let i=0;i<16&&f.get(DONE)===0xdeadbeef;i++)f.e.run(1);
    assert.equal(f.get(DONE),0);assert.equal(f.get(COUNT),0);
   }else{
    const parks=await complete(f);assert.equal(parks,mode==='eager'?0:3);
    assert.equal(f.get(DONE),1);assert.equal(f.get(COUNT),bytes.length);
    assert.deepEqual(f.mem.slice(f.g2w(BUF),f.g2w(BUF)+bytes.length),bytes);
   }
   const last=f.snap('complete');assert.equal(last.esp,S);assert.equal(last.depth,0);
   assert.equal(last.entries,mode==='nested'?2:mode==='after-retry-callback'?1:0);assert.equal(last.returns,last.entries);
   assert.equal(last.reason,0);if(mode!=='unarmed')assert.equal(f.e.pending_context_status(EPOCH),1);
   const rows=f.trace.filter(r=>r.label==='host-read-entry');
   const ret=mode==='nested'?CHILD+new Code().read(f.h).b.length:mode==='tracked'?0x4e95f0+new Code().read(f.h).b.length:f.successor;
   for(const r of rows){assert.deepEqual(r.stack,[ret,f.h,BUF,bytes.length,COUNT,0]);assert.equal(r.thread,1);assert.equal(r.epoch,mode==='unarmed'?0:EPOCH);assert.equal(r.cs,last.cs);assert.equal(r.ss,last.ss);assert.equal(r.root,last.root);assert.equal(r.nativeProcess,last.nativeProcess);}
  }finally{evidence(file,mode,f);}
 });
 for(const mode of ['foreign-thread','foreign-epoch','import-throws','exit-throws','return-corrupt','stack-corrupt','thunk-corrupt','yield-corrupt','flag-corrupt','steps-corrupt','handler-corrupt','legacy-profile'])test(file+' ReadFile fails closed '+mode,async()=>{
  let once=false;
  const f=await fixture(file,{profile:mode==='legacy-profile'?1:2,hook:(phase,e)=>{
   if(phase==='read'&&mode==='import-throws')throw Error('fixture ReadFile import exception');
   if(phase==='exit'&&mode==='exit-throws')throw Error('fixture API exit exception');
   if(phase==='exit'&&mode==='yield-corrupt')e.set_yield_state(0,1);
   if(phase==='exit'&&mode==='flag-corrupt')e.set_yield_state(12,0);
   if(phase==='exit'&&mode==='steps-corrupt')e.set_steps(1);
   if(phase==='exit'&&mode==='handler-corrupt')e.set_handler_set_eip(0);
   if(phase==='exit'&&mode==='stack-corrupt'){
    // Fault injection after io_block, without a public setter invalidating first.
    const dv=new DataView(e.memory.buffer),esp=REGIONS.REGFILE.base+16;
    assert.equal(dv.getUint32(esp,true),e.get_esp()>>>0);dv.setUint32(esp,e.get_esp()+4,true);
   }
   if(phase==='read'&&mode==='thunk-corrupt')e.set_current_thunk_eip(0x075003f8);
   if(phase==='exit'&&mode==='return-corrupt'&&!once){once=true;new DataView(e.memory.buffer).setUint32(e.guest_to_wasm(e.get_esp()),0x402900,true);}
  }});
  try{
   if(mode==='import-throws'||mode==='exit-throws'){assert.throws(()=>f.e.run(16),/fixture (ReadFile import|API exit) exception/);assert.equal(f.e.pending_context_status(EPOCH),0);}
   else{
    if(mode==='foreign-thread'||mode==='foreign-epoch'||mode==='legacy-profile')await park(f);
    else for(let i=0;i<32&&!f.trace.some(r=>r.label==='api-exit');i++)f.e.run(1);
    if(mode.endsWith('-corrupt')){assert.equal(f.first()[0],5);assert.equal(f.first()[1],109,'park authentication rejects malformed transition');}
    if(mode==='foreign-thread')f.e.set_current_thread_id(2);
    if(mode==='foreign-epoch')f.e.pending_context_coverage(EPOCH+1);
    if(mode==='foreign-thread')assert.equal(f.e.pending_context_reason(),5,'public thread setter invalidates first');
    if(mode==='foreign-epoch')assert.equal(f.e.pending_context_reason(),2);
    assert.equal(f.e.pending_context_status(EPOCH),0,'mismatch never supplies coverage');
   }
   const reason=f.e.pending_context_reason();assert.notEqual(reason,0);
   assert.equal(f.e.pending_context_arm_profile(EPOCH,2,B),0);assert.equal(f.e.pending_context_reason(),reason);
   f.snap('rejected');
  }finally{evidence(file,mode,f);}
 });
 for(const mode of ['process','root'])test(file+' parked read rejects replaced native '+mode,async()=>{
  const f=await fixture(file);await park(f);
  try{
   const ctx={exports:null,getMemory:()=>f.e.memory.buffer};
   const host=require(path.join(ROOT,'lib/host-imports')).createHostImports(ctx).host;
   Object.assign(host,{memory:f.e.memory,exit(){},log(){},log_i32(){},crash_unimplemented(){}});
   const {instance}=await WebAssembly.instantiate(fs.readFileSync(path.join(ROOT,file)),{host}),other=ctx.exports=instance.exports;
   if(mode==='process'){const img=pe();new Uint8Array(f.e.memory.buffer).set(img,other.get_staging());other.load_pe(img.length);}
   else other.init_thread(0,B,0,0,0,0,0,0);
   assert.equal(f.e.get_current_thread_id(),1);assert.equal(f.e.pending_context_status(EPOCH),0);
   assert.equal(f.e.pending_context_reason(),2);f.snap('replaced-'+mode);
  }finally{evidence(file,'foreign-'+mode,f);}
 });
 for(const mode of ['good','yield12-without-io-block','bad-return','escape','guest-fault'])test(file+' genuine native callback '+mode,async()=>{
  let marked=false;
  const f=await fixture(file,{nested:true,eager:true,hook:(phase,e)=>{
   if(mode==='yield12-without-io-block'&&phase==='exit'&&!marked){marked=true;e.set_yield_state(12,1);}
  }});
  if(mode==='bad-return')f.put(CHILD,[0xc7,4,0x24,...d32(0x402900),0xc2,16,0]);
  if(mode==='guest-fault')f.put(CHILD,[0x0f,0x0b]);
  if(mode==='escape')f.put(CHILD,[0x83,0xc4,24,0xe9,...d32(0x402900-CHILD-8)]);
  try{
   f.e.run(1);assert.equal(f.e.pending_context_depth(),1);assert.equal(f.e.pending_context_callback_entries(),1);
   if(mode==='yield12-without-io-block'){assert.equal(f.e.get_yield_reason(),12);f.e.clear_yield();}
   // A one-block slice can leave yield_flag for the next run to consume.
   for(let i=0;i<3&&f.e.pending_context_depth()<2;i++)f.e.run(1);
   assert.equal(f.e.pending_context_depth(),2);assert.equal(f.e.pending_context_callback_entries(),2);
   if(mode==='good'||mode==='yield12-without-io-block'){await complete(f);assert.equal(f.e.pending_context_status(EPOCH),1);assert.equal(f.e.pending_context_depth(),0);assert.equal(f.e.pending_context_callback_returns(),2);}
   else if(mode==='guest-fault'){assert.throws(()=>f.e.run(1));assert.equal(f.e.pending_context_status(EPOCH),0);}
   else{for(let i=0;i<4&&!f.e.pending_context_reason();i++)f.e.run(1);assert.notEqual(f.e.pending_context_reason(),0);assert.equal(f.e.pending_context_status(EPOCH),0);}
  }finally{evidence(file,'callback-'+mode,f);}
 });
}
