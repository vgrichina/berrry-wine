'use strict';
// Startup uses loadDlls rather than the dynamic LoadLibrary reply path. Real
// DLL entry points must roll back only the failing startup transaction's roots.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {Worker,isMainThread,parentPort,workerData}=require('node:worker_threads');
const {createHostImports}=require('../lib/host-imports');
const loader=require('../lib/dll-loader');
const {X86,pe,u32,BASE,DATA}=require('./test-dll-lifecycle-real-pe');
const {graphDll}=require('./test-dll-import-graph-lifecycle');
async function exercise(module,detachFails=false){
 const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
 const ctx={getMemory:()=>memory.buffer,resourceJson:{menus:{},dialogs:{},strings:{},bitmaps:{}},onExit(){}};
 const imports=createHostImports(ctx);imports.host.memory=memory;
 const instance=await WebAssembly.instantiate(module,imports),e=ctx.exports=instance.exports;
 const exe=pe([[0x2000,new X86().store(0x70,1).emit(0xc3).finish()]]),raw=r=>r-0x1000+0x200,o=0x80+24;
 exe.writeUInt32LE(0x1c00,raw(0x1814));exe.writeUInt32LE(0x1c80,raw(0x1820));exe.writeUInt32LE(0x1c40,raw(0x1824));exe.writeUInt32LE(60,o+108);
 exe.writeUInt32LE(0x1cc0,raw(0x1c00));exe.writeUInt32LE(0x1cc0,raw(0x1c40));exe.write('graph-a.dll\0',raw(0x1c80));exe.write('Ping\0',raw(0x1cc2));
 new Uint8Array(memory.buffer,e.get_staging(),exe.length).set(exe);e.load_pe(exe.length);
 const residentBytes=pe([[0x1000,new X86().emit(0x8b,0x44,0x24,8,0xff,0x04,0x85,u32(DATA+0x80),0xb8,1,0,0,0,0xc2,12,0).finish()]],true);
 const resident=loader.loadDll(e,memory.buffer,residentBytes,'resident.dll');
 const residentOutcome=loader.callDllMain(e,resident.loadAddr,resident.dllMain,null,{requireCompletion:true});
 loader.finishDllInitialization(e,memory.buffer,resident,residentOutcome);
 const a=graphDll('a','b'),b=graphDll('b');
 // FALSE for process attach, ordinary FALSE return for process detach too.
 // The latter return value must be ignored while unwinding this rollback.
 new X86().emit(0x8b,0x44,0x24,8,0xff,0x04,0x85,u32(DATA),0x31,0xc0,0xc2,12,0).finish().copy(a,0x200);
 if(detachFails){
  // Attach returns FALSE; detach jumps to NULL instead of returning. The
  // startup error must survive the secondary failure, and no image retires.
  new X86().emit(0x83,0x7c,0x24,8,0).branch([0x0f,0x84],'detach')
   .emit(0x31,0xc0,0xc2,12,0).label('detach').emit(0x31,0xc0,0xff,0xe0).finish().copy(a,0x200);
  let failure;
  try{loader.loadDlls(e,memory.buffer,exe,[{name:'graph-b.dll',bytes:b},{name:'graph-a.dll',bytes:a}],null);}catch(error){failure=error;}
  assert.ok(failure instanceof AggregateError);
  assert.match(failure.message,/DLL_PROCESS_ATTACH returned FALSE: module=0x.*rollback also failed: DllMain did not complete/);
  assert.equal(failure.cause,failure.errors[0]);
  assert.equal(failure.errors[0].dllInitializationFailed,true);
  assert.equal(failure.errors[1].outcome.completed,false);
  assert.equal(e.guest_read32(DATA+0x70),0,'failed boot never runs EXE');
  assert.equal(e.guest_read32(DATA+0x10),0,'failed detach does not continue unwinding dependency');
  assert.equal(e.get_dll_index(resident.loadAddr),resident.index,'preexisting root remains mapped');
  assert.equal(e.get_dll_count(),3,'failed detach retains all mapped images');
  return {preservedAttachFailure:true,failedDetach:true};
 }
 assert.throws(()=>loader.loadDlls(e,memory.buffer,exe,[{name:'graph-b.dll',bytes:b},{name:'graph-a.dll',bytes:a}],null),/DLL.*initializ|DLL_PROCESS_ATTACH|DllMain/i);
 const read=off=>e.guest_read32(DATA+off)>>>0;
 assert.equal(read(4),1);assert.equal(read(0),1,'FALSE initializer receives process detach');
 assert.equal(read(0x14),1);assert.equal(read(0x10),1,'completed dependency attach is undone');
 assert.equal(read(0x70),0,'failed boot never runs the EXE entry point');
 assert.equal(read(0x84),1);assert.equal(read(0x80),0,'preexisting explicit root is not transaction-owned');
 assert.equal(e.get_dll_index(resident.loadAddr),resident.index);
 for(const baseName of['graph-a.dll','graph-b.dll']){
  const name='C:\\'+baseName;
  const p=e.guest_alloc(name.length+1);new Uint8Array(memory.buffer,e.guest_to_wasm(p),name.length+1).set(Buffer.from(name+'\0'));
  assert.equal(e.find_loaded_dll_path(p),-1,'failed startup path must be retired');e.guest_free(p);
 }
 assert.equal(loader.drainDllUnload({exports:e,memoryBuffer:memory.buffer},resident.loadAddr),true);assert.equal(read(0x80),1);
 return {badAttach:read(4),badDetach:read(0),dependencyDetach:read(0x10),residentDetach:read(0x80)};
}

// Actual production Worker command boundary: a normal attach, an unfinished
// NULL-jump frame, and an interpreter trap retain their distinct outcomes.
// Shared generated control body for the Node regression and browser validation.
// env provides the real production Host and its ordinary memory/import setup.
async function transportControl(env) {
 const results=[];
 for (const [name, code] of [
  ['success',[0xb8,7,0,0,0,0xc2,12,0]],
  ['incomplete',[0x31,0xc0,0xff,0xe0]],
  ['fault',[0x0f,0x0b]],
  ['rollback',[0x83,0x7c,0x24,8,1,0x75,5,0x31,0xc0,0xc2,12,0,0x31,0xc0,0xff,0xe0]],
 ]) {
  const {host,logs}=await env.create();
  try {
   const exe=env.pe([[0x2000,[0xc3]]]);
   await host.start(); await host.loadPe(exe,'loader-control.exe',1);
   const before={eip:await host.callExport('get_eip'),esp:await host.callExport('get_esp')};
   let response,error;
   try {response=await host.loadDlls([{name:name+'.dll',bytes:env.pe([[0x1000,code]],true)}],exe);}
   catch(e){error=e;}
   const after={eip:await host.callExport('get_eip'),esp:await host.callExport('get_esp')};
   if(name==='success') {
    env.check(!error&&response.length===1,'successful real attach reaches response');
    env.check(logs.some(x=>x.includes('DllMain returned, EAX=0x7')),'existing success trace forwarded');
   } else if(name==='rollback') {
    env.check(error?.name==='AggregateError'&&error.errors?.length===2,'aggregate startup/rollback retained');
    env.check(error.cause?.dllInitializationFailed&&error.errors[0].dllInitializationFailed,'initiating FALSE preserved through rollback');
    env.check(error.errors[1].outcome?.completed===false,'secondary incomplete detach retained');
   } else {
    env.check(error&&error.outcome,'loader outcome survives actual Worker transport');
    env.check(!error.outcome.completed&&!error.outcome.exited,'actual incomplete callback');
    env.check(Number.isInteger(error.outcome.eip)&&Number.isInteger(error.outcome.esp),'owning callback registers retained');
    env.check(Number.isInteger(error.outcome.halt)&&Number.isInteger(error.outcome.yieldReason),'pre-restoration halt/yield retained');
    env.check(error.stage==='loadDlls'&&error.workerSlot===0,'failure owner retained');
    if(name==='incomplete')env.check(error.outcome.eip===0&&error.outcome.esp!==before.esp&&!error.outcome.fault,'NULL jump is unfinished frame');
    if(name==='fault')env.check(error.outcome.fault?.message&&error.cause?.message===error.outcome.fault.message,'trap and initiating cause retained');
    env.check(logs.some(x=>x.includes('error details:')),'browser console receives details before launch catch');
   }
   env.check(before.eip===after.eip&&before.esp===after.esp,'caller context restored separately from retained callback context');
   results.push({name,before,after,response,error:error?{name:error.name,message:error.message,outcome:error.outcome,cause:error.cause,errors:error.errors,stage:error.stage,workerSlot:error.workerSlot}:null,logs});
  } finally {await host.stop();}
 }
 return results;
}

async function exerciseTransport(module) {
 const {GuestThreadHost}=require('../lib/guest-thread-host');
 return transportControl({pe,check:(value,message)=>assert.ok(value,message),create:async()=>{
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),logs=[];
  const ctx={getMemory:()=>memory.buffer,resourceJson:{menus:{},dialogs:{},strings:{},bitmaps:{}},onExit(){}};
  const imports=createHostImports(ctx);imports.host.memory=memory;
  const {sigs}=require('../lib/host-import-sigs.generated.json');
  const host=new GuestThreadHost({memory,module,sigs,hostImports:imports.host,
   workerUrl:path.join(__dirname,'../lib/guest-worker.js'),clockIntervalMs:0,log:line=>logs.push(line)});
  return {host,logs};
 }});
}

async function main(){
 const module=await WebAssembly.compile(fs.readFileSync(process.env.WA_TEST_WASM||path.join(__dirname,'../build/wine-assembly.wasm')));
 const transport=await exerciseTransport(module);
 if(process.env.WA_LOADER_OUTCOME_ARTIFACTS)fs.writeFileSync(path.join(process.env.WA_LOADER_OUTCOME_ARTIFACTS,"transport-"+path.basename(process.env.WA_TEST_WASM||"standard")+".json"),JSON.stringify(transport,null,2));
 const run=async()=>[await exercise(module),await exercise(module,true)];
 const expected=await run(),worker=new Worker(__filename,{workerData:{module}});
 const guard=setTimeout(()=>worker.terminate(),20000);
 try{const result=await new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);worker.once('exit',code=>reject(Error('worker exited before result '+code)));});assert.deepEqual(result,expected);}
 finally{clearTimeout(guard);await worker.terminate();}
 console.log('PASS real PE startup FALSE rollback, original/cleanup error preservation and mapping quarantine, main/Worker');
}
if(isMainThread)main().catch(error=>{console.error(error);process.exitCode=1;});else Promise.all([exercise(workerData.module),exercise(workerData.module,true)]).then(result=>parentPort.postMessage(result),error=>{throw error;});
