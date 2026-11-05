'use strict';
// Synthetic guest programs on both shipped modules. No application/browser run.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {test}=require('node:test');
const bench=require('../tools/bench-loops.js');
const integration=require('../tools/mdk2-construction-driver-integration.cjs');
const observer=require('../tools/mdk2-lua-construction-observer.cjs');
const ROOT=path.resolve(__dirname,'..'),S=0x74ff000,C=0x401800,T=0x443070,END=0x401900;
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const d32=v=>[v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255];
const call=(from,to)=>[0xe8,...d32(to-from-5)],jmp=(from,to)=>[0xe9,...d32(to-from-5)];
async function fixture(file,armed=true){
 const f=await bench.newInstance(path.join(ROOT,file)),{e,mem,g2w}=f,dv=new DataView(mem.buffer);
 const put=(a,b)=>{mem.set(b,g2w(a));e.invalidate_code_range(a,b.length);};
 const u=(a,v)=>dv.setUint32(g2w(a),v>>>0,true);
 e.set_api_log(0);e.set_stack_fusion(0);e.set_uop(0);put(END,[0xeb,0xfe]);e.set_eip(C);e.set_esp(S);u(S,END);
 if(armed)assert.equal(e.pending_context_arm(17),1);
 return {...f,put,u,valid:()=>e.pending_context_status(17),depth:()=>e.pending_context_depth()};
}
for(const file of ['build/wine-assembly.wasm','build/wine-assembly.compat.wasm']){
 for(const kind of ['relative','register','memory','base-memory','stack-run'])test(file+' actual CALL/RET '+kind,async()=>{
  const f=await fixture(file),{e,put,valid,depth}=f;
  let ret=C+5,entry=S-4;
  if(kind==='relative')put(C,call(C,T));
  if(kind==='register'){e.set_eax(T);put(C,[0xff,0xd0]);ret=C+2;}
  if(kind==='memory'){f.u(0x1800000,T);put(C,[0xff,0x15,...d32(0x1800000)]);ret=C+6;}
  if(kind==='base-memory'){e.set_eax(0x1800000);f.u(0x1800004,T);put(C,[0xff,0x50,4]);ret=C+3;}
  if(kind==='stack-run'){e.set_stack_fusion(1);put(C,[0x50,0x53,...call(C+2,T)]);ret=C+7;entry=S-12;}
  put(ret,[...jmp(ret,END)]);put(T,kind==='stack-run'?[0x56,0x57,0x5f,0x5e,0xc3]:[0xc3]);
  if(kind==='stack-run'){e.set_handler_hist_enabled(1);e.reset_handler_hist();}
  e.run(1);assert.equal(e.get_eip()>>>0,T);assert.equal(valid(),1);assert.equal(depth(),1);
  assert.deepEqual([0,1,2].map(i=>e.pending_context_entry(0,i)>>>0),[T,ret,entry]);
  e.run(1);assert.equal(e.get_eip()>>>0,ret);assert.equal(valid(),1);assert.equal(depth(),0);
  if(kind==='stack-run'){
   const counts=new Uint32Array(e.memory.buffer,e.get_handler_hist_base(),e.get_handler_hist_slots());
   // H474/475 are fused push+CALL/pop+RET in the actual handler table.
   const table=fs.readFileSync(path.join(ROOT,'src/02-thread-table.wat'),'utf8');
   const funcs=[...table.matchAll(/(\$th_[A-Za-z0-9_]+)\s*;;\s*(\d+)\b/g)];
   for(const n of ['$th_push_run_call','$th_pop_run_ret'])assert(counts[Number(funcs.find(m=>m[1]===n)?.[2])]>0,n);
  }
 });
 test(file+' RET imm validates entry slot and architectural cleanup',async()=>{
  const {e,put,valid,depth}=await fixture(file);put(C,[0x50,...call(C+1,T)]);put(T,[0xc2,4,0]);
  e.run(1);assert.equal(depth(),1);e.run(1);assert.equal(valid(),1);assert.equal(depth(),0);assert.equal(e.get_esp()>>>0,S);
 });
 test(file+' actual uop CALL/RET preserves tier and proof',async()=>{
  const {e,put,valid,depth}=await fixture(file);e.set_uop(1);e.set_ecx(9);e.set_handler_hist_enabled(1);e.reset_handler_hist();
  put(C,[...call(C,T),0x49,0x75,0xf8,...jmp(C+8,END)]);put(T,[0x40,0xc3]);
  const pc=e.uop_compile(C);assert(pc,'must compile actual call/ret loop');e.uop_install(C,pc);
  assert.equal(e.get_dbg_tier_guard(),0);
  const enters=e.uop_stats(4);e.run(1);assert.equal(depth(),1,JSON.stringify({pc:(e.get_eip()>>>0).toString(16),reason:e.pending_context_reason(),blocks:e.get_last_run_blocks(),uopEnters:e.uop_stats(4)}));assert.equal(e.get_eip()>>>0,T);assert.equal(valid(),1);
  assert(e.uop_stats(4)>enters,'actual program entry');
  for(let k=0;k<40&&(e.get_eip()>>>0)!==END;k++)e.run(8);
  assert.equal(e.get_eip()>>>0,END);assert.equal(depth(),0);assert.equal(valid(),1);assert.equal(e.get_eax(),9);
  // A tier entry counter alone cannot prove that RET stayed in that tier.
  // Histogram collection preserves uop scheduling. There are exactly nine real
  // CALLs and RETs here; fewer than nine ordinary RETs proves actual uop RET
  // execution while allowing the natural fallback at a slice budget boundary.
  const counts=new Uint32Array(e.memory.buffer,e.get_handler_hist_base(),e.get_handler_hist_slots());
  const table=fs.readFileSync(path.join(ROOT,'src/02-thread-table.wat'),'utf8');
  const funcs=[...table.matchAll(/(\$th_[A-Za-z0-9_]+)\s*;;\s*(\d+)\b/g)];
  const ordinary=n=>{const row=funcs.find(m=>m[1]===n);assert(row,n);return counts[Number(row[2])];};
  assert.equal(ordinary('$th_call_rel'),0,'CALLs execute as native uops');
  assert(ordinary('$th_ret')<9,'at least one actual RET must execute as native uops');
 });
 for(const mode of ['return-pc','entry-esp'])test(file+' sticky '+mode+' mismatch from actual RET',async()=>{
  const {e,put,u,valid}=await fixture(file);put(C,call(C,T));
  // Mutate the architectural return slot with guest instructions, not a host
  // register setter that would itself invalidate coverage.
  put(T,mode==='return-pc'?[0xc7,4,0x24,...d32(END),0xc3]:[0x83,0xec,4,0xc3]);u(S-8,C+5);
  e.run(1);e.run(1);assert.equal(valid(),0);assert.equal(e.pending_context_reason(),4);
  e.run(4);assert.equal(valid(),0);
 });
 test(file+' overflow then real recursive returns cannot recover validity',async()=>{
  const {e,put,valid}=await fixture(file);e.set_ecx(65);put(C,call(C,T));
  put(T,[0x49,0x74,5,...call(T+3,T),0xc3]);
  for(let k=0;k<300&&(e.get_eip()>>>0)!==C+5;k++)e.run(1);
  assert.equal(e.get_eip()>>>0,C+5);assert.equal(valid(),0);assert.equal(e.pending_context_reason(),3);
  assert.equal(e.get_esp()>>>0,S);assert.equal(e.pending_context_status(17),0);
 });
 for(const mode of ['late','foreign-epoch','foreign-thread','rearm','callback','nonlocal','untracked-entry','precompiled','aborted-run','raw-uop','raw-install','raw-range','stale-install','reload','reinit','foreign-arm'])test(file+' rejects '+mode,async()=>{
  const {e,put,valid}=await fixture(file,mode!=='late'&&mode!=='precompiled'&&mode!=='foreign-arm');put(C,[0xeb,0xfe]);
  if(mode==='foreign-arm'){e.set_current_thread_id(2);assert.equal(e.pending_context_arm(17),0);}
  if(mode==='reload'){e.run(1);const exe=fs.readFileSync(path.join(ROOT,'test/binaries/notepad.exe'));new Uint8Array(e.memory.buffer).set(exe,e.get_staging());e.load_pe(exe.length);}
  if(mode==='reinit'){e.run(1);e.init_thread(0,e.get_image_base(),0,0,0,0,0,0);}
  if(mode==='late'){e.run(1);assert.equal(e.pending_context_arm(17),0);}
  if(mode==='aborted-run'){put(C,[0x0f,0x0b]);assert.throws(()=>e.run(1));}
  if(mode==='raw-uop'){e.set_uop(1);const pc=e.uop_compile(C);assert(pc);e.uop_run(pc+48,1);}
  if(mode==='raw-install')e.uop_install(C,1234);
  if(mode==='raw-range')e.uop_add_range(C,C+2,1234);
  if(mode==='stale-install'){e.set_uop(1);const pc=e.uop_compile(C);e.uop_flush();e.uop_install(C,pc);}
  if(mode==='precompiled'){e.set_uop(1);e.uop_compile(C);assert.equal(e.pending_context_arm(17),0);}
  if(mode==='foreign-epoch')assert.equal(e.pending_context_status(18),0);
  if(mode==='foreign-thread')e.set_current_thread_id(2);
  if(mode==='rearm')assert.equal(e.pending_context_arm(17),0);
  if(mode==='callback'){const token=e.com_callback_enter();e.com_callback_leave(token);}
  if(mode==='nonlocal'){
   // Real RaiseException import path, with an unhandled fixture exception.
   // SEH rejects proof even when its ordinary behavior terminates the guest.
   // Use an actual UD2 fault routed into the native SEH delivery machinery.
   e.set_fault_unmapped(3);put(C,[0xa1,...d32(0)]);e.run(1);
  }
  if(mode==='untracked-entry'){e.set_eip(T);put(T,[0xeb,0xfe]);e.run(1);}
  assert.equal(valid(),0,mode);assert.notEqual(e.pending_context_reason(),0);
  assert.throws(()=>observer.pendingAbsence(e,17),/incomplete/);
 });
 test(file+' disabled and enabled guest output/state parity',async()=>{
  const out=[];
  for(const armed of [false,true]){
   const {e,put}=await fixture(file,armed);put(C,[...call(C,T),...jmp(C+5,END)]);put(T,[0xb8,...d32(0x12345678),0xc3]);e.run(5);
   out.push(['eip','esp','eax','ebx','ecx','edx','esi','edi','flag_op','flag_a','flag_b','flag_res','last_run_blocks','last_run_halt'].map(n=>e['get_'+n]()>>>0));
   assert.equal(e.get_dbg_tier_guard(),0);
  }
  assert.deepEqual(out[0],out[1]);
 });
}

for(const file of ['build/wine-assembly.wasm','build/wine-assembly.compat.wasm'])for(const mode of ['process','root'])test(file+' foreign shared native '+mode+' lifetime invalidates unchanged thread',async()=>{
 const a=await fixture(file);a.put(C,[0xeb,0xfe]);a.e.run(1);assert.equal(a.valid(),1);
 const ctx={exports:null,getMemory:()=>a.e.memory.buffer},host=require('../lib/host-imports.js').createHostImports(ctx).host;
 Object.assign(host,{memory:a.e.memory,exit(){},log(){},log_i32(){},crash_unimplemented(){}});
 const {instance}=await WebAssembly.instantiate(fs.readFileSync(path.join(ROOT,file)),{host}),b=ctx.exports=instance.exports;
 if(mode==='process'){
  const exe=fs.readFileSync(path.join(ROOT,'test/binaries/notepad.exe'));new Uint8Array(a.e.memory.buffer).set(exe,b.get_staging());b.load_pe(exe.length);
 }else b.init_thread(0,a.e.get_image_base(),0,0,0,0,0,0);
 assert.equal(a.e.get_current_thread_id(),1);assert.equal(a.valid(),0);assert.equal(a.e.pending_context_reason(),2);
 assert.throws(()=>observer.pendingAbsence(a.e,17),/incomplete/);
});

// Existing immutable historical modules are decoded in memory only. The same
// synthetic program verifies disabled architectural output and tier choices.
for(const pin of integration.pinnedRuntime().pins.moduleFiles)for(const tier of ['ordinary','stack-run','uop'])test(pin.path+' disabled parity against retained control '+tier,async()=>{
 const output=[];
 for(const bytes of [integration.retainedModule(pin),fs.readFileSync(path.join(ROOT,pin.path))]){
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const ctx={exports:null,getMemory:()=>memory.buffer},host=require('../lib/host-imports.js').createHostImports(ctx).host;
  Object.assign(host,{memory,exit(){},log(){},log_i32(){},crash_unimplemented(){},wait_multiple(){return 0;},shell_execute(){return 33;}});
  const {instance}=await WebAssembly.instantiate(bytes,{host}),e=ctx.exports=instance.exports,b=new Uint8Array(memory.buffer);
  const exe=fs.readFileSync(path.join(ROOT,'test/binaries/notepad.exe'));b.set(exe,e.get_staging());e.load_pe(exe.length);
  const put=(a,code)=>{b.set(code,e.guest_to_wasm(a));e.invalidate_code_range(a,code.length);};
  e.set_api_log(0);e.set_stack_fusion(tier==='stack-run'?1:0);e.set_uop(tier==='uop'?1:0);e.set_eip(C);e.set_esp(S);e.set_ecx(9);e.set_eax(0);
  put(C,[...call(C,T),0x49,0x75,0xf8,...jmp(C+8,END)]);put(T,tier==='stack-run'?[0x56,0x57,0x40,0x5f,0x5e,0xc3]:[0x40,0xc3]);put(END,[0xeb,0xfe]);
  if(tier==='uop'){const pc=e.uop_compile(C);assert(pc);e.uop_install(C,pc);}
  const before=e.uop_stats(4);e.run(100);
  const names=['eip','esp','eax','ebx','ecx','edx','esi','edi','flag_op','flag_a','flag_b','flag_res','last_run_blocks','last_run_halt','dbg_tier_guard'];
  output.push({state:names.map(n=>e['get_'+n]()>>>0),uopEntries:e.uop_stats(4)-before,bytes:Buffer.from(b.subarray(e.guest_to_wasm(S-64),e.guest_to_wasm(S+16))).toString('hex')});
  assert.equal(e.get_eax(),9);assert.equal(e.get_dbg_tier_guard(),0);if(tier==='uop')assert(output.at(-1).uopEntries>0);
 }
 assert.deepEqual(output[1],output[0]);
});

async function liveFixture(file,mode='match'){
 const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
 const ctx={exports:null,getMemory:()=>memory.buffer};
 const host=require('../lib/host-imports.js').createHostImports(ctx).host;host.memory=memory;host.log_block=()=>{};host.log=()=>{};host.log_i32=()=>{};host.exit=()=>{};
 const bytes=fs.readFileSync(path.join(ROOT,file)),module=await WebAssembly.compile(bytes),sha=hash(bytes),url='http://fixture/lib/guest-worker.js';
 let listener;
 const realm={URL,Date,performance,setTimeout,clearTimeout,ArrayBuffer,Uint8Array,
  WebAssembly:{Module:WebAssembly.Module,compile:WebAssembly.compile,instantiate:WebAssembly.instantiate},addEventListener(t,fn){assert.equal(t,'message');listener=fn;}};
 vm.createContext(realm);vm.runInContext(fs.readFileSync(path.join(ROOT,'tools/mdk2-lua-construction-observer.cjs'),'utf8'),realm);
 vm.runInContext('('+integration.installBinding.toString()+')('+JSON.stringify({moduleHashes:[sha],targetId:'native-fixture',workerURL:url})+')',realm);
 listener({data:{t:'init',module,slot:0,endpointIdentity:1,__mdk2Binding:{kind:'sent',sha256:sha,compilation:0,bytes:bytes.length,workerURL:url,slot:0,endpointIdentity:1}}});
 const instance=await realm.WebAssembly.instantiate(module,{host}),e=instance.exports;ctx.exports=e;
 const b=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer),wa=a=>e.guest_to_wasm(a)>>>0;
 const u=(a,v)=>dv.setUint32(wa(a),v>>>0,true),put=(a,v)=>{b.set(v,wa(a));e.invalidate_code_range(a,v.length);};
 const exe=fs.readFileSync(path.join(ROOT,'test/binaries/candidates/mdk2-demo/installed/mdk2demo/mdk2Main.exe'));
 assert.equal(hash(exe),observer.EXE_SHA256);b.set(exe,e.get_staging());assert(e.load_pe(exe.length));e.set_api_log(0);e.set_stack_fusion(0);e.set_uop(0);
 const object=0x1810000,output=0x1820000,seamESP=S-28,caller=0x47ca79;
 // Actual original decoder executes a real CALL/RET. Only its synthetic caller
 // and heap/stack inputs are supplied; original decoder and full GC stay intact.
 put(caller,call(caller,0x47d980));
 put(caller+5,[0x83,0xc4,12,0x31,0xdb,...jmp(caller+10,0x402176)]);
 u(object+0x20,1);u(object+0x24,1);u(object+0x4c,output);u(object+0x50,4);u(object+0x48,0);
 for(let i=0;i<4;i++)u(output+i*4,100+i*20);
 u(S,object);u(S+4,output+0x100);u(S+8,8);
 const guards=[[6,0x47ca7e],[14,0x47a928],[22,0x47b393],[39,0x47c012],[42,0x47c626],[45,0x451546],[47,0x402176]];
 for(const [index,pc]of guards)if(index!==6)u(seamESP+index*4,pc);
 if(mode.startsWith('guard-')){const index=Number(mode.slice(6));if(index===6){put(caller,jmp(caller,0x47d9c8));e.set_ebx(object);u(seamESP+28,object);u(seamESP+24,0);e.set_esp(seamESP);}else u(seamESP+index*4,0);}
 // Same explicit nil-Level root fixture as the existing continuous-GC test,
 // established by the original initializer contracts. No collector is stubbed.
 const L=0x1800000,luaStack=L+0x1000,buckets=L+0x2000,tags=L+0x3000,str=L+0x5000,list=L+0x5100;
 u(0x4b7ce4,L);u(L,luaStack+12);u(L+4,luaStack);u(L+8,luaStack+0x5f4);u(luaStack,-2);u(luaStack+4,str);
 u(L+0xa8,-5);u(L+0xac,0x444470);u(L+0xcc,str);u(L+0xd4,buckets);u(L+0xd8,tags);u(L+0xdc,14);u(L+0xe0,-6);
 for(let i=0;i<14*18;i++)u(tags+i*12,-6);u(L+0xec,150);u(L+0xf0,1);
 u(str+4,0);u(str+16,-6);u(str+28,5);put(str+32,Buffer.from('Level\0'));
 u(buckets+(76%61)*12,1);u(buckets+(76%61)*12+4,1);u(buckets+(76%61)*12+8,list);u(list,str);
 for(const a of [0x4b87d4,0x4b7d14,0x4b87cc,0x4b87d0,0x5ce08c,0x5ccb48])u(a,0);
 u(0x4b6570,4);e.set_current_thread_id(1);if(mode!=='guard-6')e.set_esp(S);e.set_eip(caller);e.set_ebx(mode==='guard-6'?object:0);
 if(mode==='callback'){const token=e.com_callback_enter();e.com_callback_leave(token);}
 if(mode==='pending'){
  // An actual tracked CALL whose synthetic callee tail-transfers to the seam.
  // The tracked frame is still live; no stack readback can erase it.
  const P=0x4522d0;put(caller,call(caller,P));put(P,jmp(P,0x47d9c8));e.set_esp(seamESP+4);e.set_ebx(object);
 }
 const bound=realm.__mdk2BoundTrace;return {e,bound,u,put,dv,wa,str,mode,seamESP};
}
for(const file of ['build/wine-assembly.wasm','build/wine-assembly.compat.wasm']){
 test(file+' synchronous live admission then genuine continuous GC entry/return',async()=>{
  const f=await liveFixture(file),{e,bound,dv,wa,str}=f;let runs=0;
  while(!bound.report().started&&runs++<50)e.run(1);
  let report=bound.report();assert.equal(report.liveAdmission.status,'admitted',JSON.stringify(report));assert.equal(e.get_eip()>>>0,0x47d9c8);
  assert.equal(report.liveAdmission.witness.proof.depth,0);assert.equal(report.observer.blocks,0);assert(!report.observer.records.some(r=>r.kind==='gc-entry'));
  const traceEnd=report.traceEnd;let marked=false;
  while((e.get_eip()>>>0)!==0x452450&&runs++<3000){e.run(1);marked ||= dv.getUint32(wa(str+4),true)===1;assert.equal(bound.report().fatal,null,JSON.stringify(bound.report()));}
  report=bound.report();assert.equal(e.get_eip()>>>0,0x452450);assert(marked);assert.equal(dv.getUint32(wa(str+4),true),0);
  const entry=report.observer.records.find(r=>r.kind==='gc-entry'),ret=report.observer.records.find(r=>r.kind==='gc-return');
  assert(entry&&ret,JSON.stringify(report));assert.equal(entry.pc,0x443070);assert.equal(entry.frame.caller,0x40218c);assert.equal(ret.pc,0x40218c);assert.equal(ret.esp,entry.esp+4);assert(entry.block<ret.block);
  assert.equal(report.traceEnd,traceEnd);assert(report.observer.blocks<=50000000);assert(report.observer.records.length<=512);
  bound.invoke('finish',{reason:'fixture-end'});
 });
 for(const mode of ['guard-6','guard-14','guard-22','guard-39','guard-42','guard-45','guard-47','callback','pending'])test(file+' live rejection '+mode,async()=>{
  const {e,bound}=await liveFixture(file,mode);let n=0;
  let failure;
  try{while((e.get_eip()>>>0)!==0x47d9c8&&n++<50)e.run(1);}catch(error){failure=error;}
  assert(failure,'first failed native proof must stop the caller');
  const r=JSON.parse(JSON.stringify(bound.report()));assert.equal(r.started,false);assert.equal(r.observer,null);assert(r.terminal);assert(r.fatal);assert(r.liveAdmission.failure,JSON.stringify(r));
  if(mode==='callback'){assert.equal(r.liveAdmission.failure.phase,'before-run');assert.equal(r.startup.slices,0);}
  else{assert.equal(e.get_eip()>>>0,0x47d9c8);assert(r.liveAdmission.rejection,JSON.stringify(r));}
  if(mode==='pending')assert(e.pending_context_depth()>0);
  const registers=[e.get_eip(),e.get_esp(),e.get_eax(),e.get_last_run_blocks()];
  e.run(1000);assert.deepEqual([e.get_eip(),e.get_esp(),e.get_eax(),e.get_last_run_blocks()],registers);assert.deepEqual(JSON.parse(JSON.stringify(bound.report())),r);assert.deepEqual(JSON.parse(JSON.stringify(bound.invoke('finish',{reason:'fixture-cleanup'}))),r);
 });
}

for(const file of ['build/wine-assembly.wasm','build/wine-assembly.compat.wasm']){
 test(file+' instance leases never overwrite another owner and saturate',async()=>{
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const mod=await WebAssembly.compile(fs.readFileSync(path.join(ROOT,file)));
  const host=new Proxy({memory},{get:(o,k)=>k in o?o[k]:()=>0}),owners=[];
  for(let i=0;i<17;i++){
   const instance=await WebAssembly.instantiate(mod,{host}),e=instance.exports;owners.push(e);
   assert.equal(e.pending_context_arm(i+1),i<16?1:0);
  }
  for(let i=0;i<16;i++)assert.equal(owners[i].pending_context_status(i+1),1);
  assert.equal(owners[16].pending_context_reason(),6);
 });
 test(file+' coverage loss after admission stops before next instruction',async()=>{
  const {e,bound}=await liveFixture(file);let n=0;
  while(!bound.report().started&&n++<50)e.run(1);
  assert.equal(bound.report().liveAdmission.status,'admitted');
  const pc=e.get_eip(),esp=e.get_esp(),token=e.com_callback_enter();e.com_callback_leave(token);
  e.run(1);const first=JSON.parse(JSON.stringify(bound.report()));
  assert.match(first.fatal,/native pending coverage lost/);assert.equal(e.get_eip(),pc);assert.equal(e.get_esp(),esp);
  e.run(1);assert.deepEqual(JSON.parse(JSON.stringify(bound.report())),first);
 });
}

for(const file of ['build/wine-assembly.wasm','build/wine-assembly.compat.wasm'])test(file+' pre-admission invalidation during native execution seals first completed boundary',async()=>{
 const {e,bound,put}=await liveFixture(file);
 // Actual guest JMP enters relevant GC without a CALL; status is valid before
 // execution, then the native entry hook invalidates. No saved stack supplies it.
 const caller=e.get_eip()>>>0;put(caller,jmp(caller,0x443070));
 assert.equal(e.pending_context_status(1),1);let failure,n=0;
 try{while(n++<4)e.run(1);}catch(error){failure=error;}
 assert(failure);const r=JSON.parse(JSON.stringify(bound.report()));
 assert.equal(r.liveAdmission.failure.phase,'after-run');assert.equal(r.liveAdmission.status,'invalid');assert(r.terminal);assert.equal(r.started,false);assert.equal(r.observer,null);
 assert(r.nativeSlice.completed);assert.equal(r.startup.status,'sealed');assert.equal(r.startup.firstFailure.message,r.fatal);
 const registers=[e.get_eip(),e.get_esp(),e.get_eax(),e.get_last_run_blocks()];
 e.run(1000);assert.deepEqual([e.get_eip(),e.get_esp(),e.get_eax(),e.get_last_run_blocks()],registers);assert.deepEqual(JSON.parse(JSON.stringify(bound.report())),r);assert.deepEqual(JSON.parse(JSON.stringify(bound.invoke('finish',{reason:'fixture-cleanup'}))),r);
});
