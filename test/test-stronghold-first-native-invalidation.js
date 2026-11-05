'use strict';
// Generated x86 only; no original entry, browser, or accepted startup suite.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {test}=require('node:test');
const ROOT=path.resolve(__dirname,'..'),bench=require(path.join(ROOT,'tools/bench-loops.js'));
const api=require(path.join(ROOT,'tools/stronghold-owning-callback-observer.cjs'));
const C=0x401800,T=0x4e95f0,END=0x401900,S=0x74ff000,EPOCH=0x13579bdf;
const d32=v=>[v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255];
const call=(a,b)=>[0xe8,...d32(b-a-5)],jmp=(a,b)=>[0xe9,...d32(b-a-5)];
const words=e=>Array.from({length:36},(_,i)=>e.pending_context_first_failure(i)>>>0);
async function fixture(file,{armed=true,throwMarker=false}={}){
 const instantiate=WebAssembly.instantiate;let owner,ex,markers=0,atMarker;
 WebAssembly.instantiate=async function(bytes,imports,...args){
  const host=imports.host,forward=host.log_i32;
  host.log_i32=function(v,...rest){
   if((v>>>0)===0x504e4631){markers++;atMarker={reason:ex.pending_context_reason(),words:words(ex)};if(throwMarker)throw Error('fixture marker import exception');}
   return Reflect.apply(forward,this,[v,...rest]);
  };
  owner=api.attach({host,getExports:()=>ex,memory:host.memory,translate:a=>ex.guest_to_wasm(a),
   workerSlot:0,endpointIdentity:1,epoch:'generated-first-failure',nativeEpoch:EPOCH,
   exeSha256:api.EXE_SHA256,wasmSha256:'a'.repeat(64),workerURL:'http://fixture/guest-worker.js',
   expectedWorkerURL:'http://fixture/guest-worker.js',deadline:performance.now()+30000});
  const result=await Reflect.apply(instantiate,this,[bytes,imports,...args]);ex=(result.instance||result).exports;return result;
 };
 let f;try{f=await bench.newInstance(path.join(ROOT,file));}finally{WebAssembly.instantiate=instantiate;}
 const {e,mem,g2w}=f,dv=new DataView(mem.buffer);
 const put=(a,b)=>{mem.set(b,g2w(a));e.invalidate_code_range(a,b.length);};
 const u=(a,v)=>dv.setUint32(g2w(a),v>>>0,true);
 e.set_api_log(0);e.set_uop(0);e.set_stack_fusion(0);e.set_eip(C);e.set_esp(S);
 put(C,call(C,T));put(T,[0xc3]);put(C+5,jmp(C+5,END));put(END,[0xeb,0xfe]);u(S,END);
 assert.equal(e.pending_context_first_failure_version(),1);assert.deepEqual(words(e),Array(36).fill(0));
 if(armed)assert.equal(e.pending_context_arm_profile(EPOCH,2,0x400000),1);
 return {...f,put,u,owner,markers:()=>markers,atMarker:()=>atMarker};
}
for(const file of ['build/wine-assembly.wasm','build/wine-assembly.compat.wasm']){
 for(const mode of ['entry-gap','unwind','host-setter','bad-return','foreign-epoch','marker-throws','unarmed'])test(file+' retains FIRST native failure: '+mode,async()=>{
  const f=await fixture(file,{armed:mode!=='unarmed',throwMarker:mode==='marker-throws'}),{e,put,owner}=f;
  try{
   if(mode==='entry-gap'){e.set_eip(T);e.run(1);}
   else if(mode==='unwind'||mode==='marker-throws'){
    put(T,[0x83,0xc4,8,...jmp(T+3,END)]);e.run(1);assert.equal(e.pending_context_depth(),1);
    if(mode==='marker-throws')assert.throws(()=>e.run(2),/marker import exception/);
    else {e.run(1);e.run(1);}
   }else if(mode==='bad-return'){
    put(T,[0xc7,4,0x24,...d32(END),0xc3]);e.run(1);e.run(1);
   }else{
    e.run(1);assert.equal(e.pending_context_depth(),mode==='unarmed'?0:1);
    if(mode==='foreign-epoch')e.pending_context_coverage(EPOCH+1);
    else e.set_eip(END);
   }
   if(mode==='unarmed'){
    assert.deepEqual(words(e),Array(36).fill(0));assert.equal(f.markers(),0);assert.equal(owner.report.firstNativeFailure,undefined);return;
   }
   const first=words(e),report=structuredClone(owner.report.firstNativeFailure);
   assert.equal(first[0],mode==='foreign-epoch'?2:mode==='bad-return'?4:5);
   assert.equal(first[4],1);assert.equal(first[5],1);assert.equal(first[7],EPOCH);assert.equal(first[8],2);assert.equal(first[9],0x400000);
   assert.equal(first[19],0,'snapshot precedes reason latch');
   assert(first[28]||first[29],'native process epoch');assert(first[30]||first[31],'native invocation root');
   assert.equal(report.version,1);assert.deepEqual(report.words,first);assert(Number.isFinite(Date.parse(report.at)));
   assert.match(report.stack,/wasm-function\[/,'actual synchronous native caller stack');assert.equal(owner.report.blocks,0,'startup diagnostic needs no observed block');
   assert.equal(f.atMarker().reason,first[0],'fail closed before calling diagnostic import');assert.deepEqual(f.atMarker().words,first);
   if(mode==='entry-gap'){assert.equal(first[1],5);assert.equal(first[2],T);assert.equal(first[6],0);assert.equal(first[16],T);}
   else if(mode==='unwind'||mode==='marker-throws'){
    assert.equal(first[1],4);assert.equal(first[6],1);assert.equal(first[16],END);assert.equal(first[17],S+4);
    assert.deepEqual(first.slice(20,24),[T,C+5,S-4,0]);
   }else if(mode!=='foreign-epoch')assert.equal(first[6],1);
   const reason=e.pending_context_reason();
   // Later setters, thread changes, abort-status checks, epoch errors, rearm,
   // callbacks and real execution cannot replace the first native/host record.
   e.set_eip(END);e.set_esp(S);e.pending_context_status(EPOCH+1);
   assert.equal(e.pending_context_arm_profile(EPOCH,2,0x400000),0);
   const token=e.com_callback_enter();e.com_callback_leave(token);e.run(2);e.set_current_thread_id(2);
   assert.deepEqual(words(e),first);assert.deepEqual(owner.report.firstNativeFailure,report);assert.equal(f.markers(),1);
   assert.equal(e.pending_context_status(EPOCH),0);assert.equal(e.pending_context_reason(),reason);
   const cycle=api.cycleFactory({getExports:()=>e,u32:()=>0,emit(){},nativeEpoch:EPOCH});
   assert.throws(()=>cycle.snapshot(true),error=>{
    assert.deepEqual(error.nativeCoverage.firstNativeFailure,{version:1,words:first});return /coverage unavailable/.test(error.message);
   });
   assert.equal(e.pending_context_first_failure(-1),0);assert.equal(e.pending_context_first_failure(36),0);
  }finally{owner.finish('fixture-complete');}
 });
}
