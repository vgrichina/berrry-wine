'use strict';
// Startup uses loadDlls rather than the dynamic LoadLibrary reply path. Real
// DLL entry points must roll back only the failing startup transaction's roots.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {Worker,isMainThread,parentPort,workerData}=require('node:worker_threads');
const {createHostImports}=require('../lib/host-imports');
const loader=require('../lib/dll-loader');
const {X86,pe,u32,BASE,DATA}=require('./test-dll-lifecycle-real-pe');
const {graphDll}=require('./test-dll-import-graph-lifecycle');
async function exercise(module,detachFails=false,asyncMode=false){
 const load=asyncMode?loader.loadDllsAsync:loader.loadDlls;
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
  try{await load(e,memory.buffer,exe,[{name:'graph-b.dll',bytes:b},{name:'graph-a.dll',bytes:a}],null);}catch(error){failure=error;}
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
 await assert.rejects(async()=>load(e,memory.buffer,exe,[{name:'graph-b.dll',bytes:b},{name:'graph-a.dll',bytes:a}],null),/DLL.*initializ|DLL_PROCESS_ATTACH|DllMain/i);
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
    const row=response[0];
    env.check(row.name==='success.dll'&&row.origBase===0x10000000,'module name and original PE base survive transport');
    env.check(row.dllMain===row.loadAddr+0x1000,'actual DLL entry point survives transport');
    env.check(row.index===await host.callExport('get_dll_index',row.loadAddr),'identity matches owner module table');
    env.check(Number.isInteger(row.generation)&&row.generation>0,'module generation survives transport');
    env.check(!('temporary' in row)&&!('priorExeRoot' in row),'startup transaction fields are not transferred');
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
 const env={pe,check:(value,message)=>assert.ok(value,message),create:async()=>{
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),logs=[];
  const ctx={getMemory:()=>memory.buffer,resourceJson:{menus:{},dialogs:{},strings:{},bitmaps:{}},onExit(){}};
  const imports=createHostImports(ctx);imports.host.memory=memory;
  const {sigs}=require('../lib/host-import-sigs.generated.json');
  const host=new GuestThreadHost({memory,module,sigs,hostImports:imports.host,
   workerUrl:path.join(__dirname,'../lib/guest-worker.js'),clockIntervalMs:0,log:line=>logs.push(line)});
  return {host,logs};
 }};
 return [...await transportControl(env),...await transportResources(env)];
}

async function transportResources(env){
 const results=[];
 for(const mode of ['resources-success','resources-failure','resources-stop']){
  const {host}=await env.create();let release;
  try{
   await host.start();await host.loadPe(env.pe([[0x2000,[0xc3]]]),'resource-control.exe',1);
   const at=await host.callExport('guest_to_wasm',0x401404);
   const gateAt=await host.callExport('get_dll_callback_lock');
   const view=new DataView(host.memory.buffer),gate=new Int32Array(host.memory.buffer,gateAt,2);
   let entered,signal,resourceMessage,calls=0;
   const ready=new Promise(resolve=>{entered=resolve;});
   const held=new Promise(resolve=>{release=resolve;});
   const receive=host.link._onMessage.bind(host.link);
   host.link._onMessage=msg=>{if(msg.t==='dllResources')resourceMessage=msg;return receive(msg);};
   // Process attach increments a counter in the EXE image before returning.
   const code=[0xff,0x05,4,0x14,0x40,0,0xb8,1,0,0,0,0xc2,12,0];
   const loading=host.loadDlls([{name:'resource.dll',bytes:env.pe([[0x1000,code]],true)}],
    env.pe([[0x2000,[0xc3]]]),{registerDllResources:async(configs,rows,control)=>{
     calls++;signal=control.signal;
     env.check(configs[0].name==='resource.dll'&&rows[0].dllMain===rows[0].loadAddr+0x1000,'resource registration gets mapped module');
     entered();await held;if(mode==='resources-failure')throw new Error('host resource failure');
    }});
   const outcome=loading.then(rows=>({rows}),error=>({error}));
   await ready;
   env.check(view.getUint32(at,true)===0,'real Worker does not enter DLL before host registration');
   env.check(Atomics.load(gate,1)===1,'Worker retains startup gate during host registration');
   host.link.worker.postMessage({t:'dllResourcesResult',endpointIdentity:host.link.endpointIdentity+1,
    lookup:resourceMessage.lookup});
   await new Promise(resolve=>setTimeout(resolve,10));
   env.check(view.getUint32(at,true)===0,'foreign endpoint acknowledgement cannot release initializer');
   if(mode==='resources-stop'){
    await host.stop();env.check(signal.aborted,'retirement cancels host registration signal');
    release();await Promise.resolve();
    env.check(view.getUint32(at,true)===0,'late registration cannot resurrect retired initializer');
   }else release();
   const result=await outcome;
   if(mode==='resources-success'){
    env.check(!result.error&&view.getUint32(at,true)===1,'attach runs once after acknowledgement');
    env.check(!signal.aborted,'successful registration is not revoked on completion');
   }
   else env.check(result.error&&view.getUint32(at,true)===0,'failed or retired registration does not run attach');
   env.check(Atomics.load(gate,0)===0&&Atomics.load(gate,1)===0,'startup gate unwinds');
   env.check(calls===1,'one host resource registration per load');
   results.push({name:mode,attach:view.getUint32(at,true),calls,error:result.error?.message||null});
  }finally{release?.();await host.stop();}
 }
 return results;
}

async function resourceBarrier(module){
 for(const reject of [false,true]){
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const ctx={getMemory:()=>memory.buffer,resourceJson:{menus:{},dialogs:{},strings:{},bitmaps:{}},onExit(){}};
  const imports=createHostImports(ctx);imports.host.memory=memory;
  const e=ctx.exports=(await WebAssembly.instantiate(module,imports)).exports;
  const exe=pe([[0x2000,[0xc3]]]);
  new Uint8Array(memory.buffer,e.get_staging(),exe.length).set(exe);e.load_pe(exe.length);
  const code=new X86().emit(0x8b,0x44,0x24,8,0xff,0x04,0x85,u32(DATA),0xb8,1,0,0,0,0xc2,12,0).finish();
  let entered,release,rows;
  const registered=new Promise(resolve=>{entered=resolve;});
  const pending=new Promise(resolve=>{release=resolve;});
  const loading=loader.loadDllsAsync(e,memory.buffer,exe,[{name:'barrier.dll',bytes:pe([[0x1000,code]],true)}],null,{
   registerDllResources:async(configs,results)=>{
    rows=results;assert.equal(configs[0].name,'barrier.dll');entered();await pending;
    if(reject)throw new Error('resource registration failed');
   },
  });
  await registered;
  assert.equal(e.guest_read32(DATA+4),0,'DllMain cannot overtake resource registration');
  const gate=new Int32Array(memory.buffer,e.get_dll_callback_lock(),2);
  assert.notEqual(Atomics.load(gate,0),0,'callback gate retained across host await');
  assert.equal(Atomics.load(gate,1),1);
  const failed=reject?assert.rejects(loading,/resource registration failed/):null;
  release();
  if(reject){
   await failed;assert.equal(e.guest_read32(DATA+4),0,'failed registration never runs attach');
   assert.equal(e.guest_read32(DATA),0,'uninitialized DLL does not get detach');
   assert.equal(e.get_dll_index(rows[0].loadAddr),-1,'failed registration rolls back mapping');
  }else{
   const result=await loading;assert.equal(result[0].loadAddr,rows[0].loadAddr);
   assert.equal(e.guest_read32(DATA+4),1,'one attach after successful registration');
  }
  assert.equal(Atomics.load(gate,0),0,'startup gate released on success or failure');
  assert.equal(Atomics.load(gate,1),0);
 }
}

async function main(){
 const module=await WebAssembly.compile(fs.readFileSync(process.env.WA_TEST_WASM||path.join(__dirname,'../build/wine-assembly.wasm')));
 const transport=await exerciseTransport(module);
 await resourceBarrier(module);
 if(process.env.WA_LOADER_OUTCOME_ARTIFACTS)fs.writeFileSync(path.join(process.env.WA_LOADER_OUTCOME_ARTIFACTS,"transport-"+path.basename(process.env.WA_TEST_WASM||"standard")+".json"),JSON.stringify(transport,null,2));
 const run=async()=>[await exercise(module),await exercise(module,true),await exercise(module,false,true),await exercise(module,true,true)];
 const expected=await run(),worker=new Worker(__filename,{workerData:{module}});
 const guard=setTimeout(()=>worker.terminate(),20000);
 try{const result=await new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);worker.once('exit',code=>reject(Error('worker exited before result '+code)));});assert.deepEqual(result,expected);}
 finally{clearTimeout(guard);await worker.terminate();}
 console.log('PASS real PE sync/async startup rollback, resource barrier/rejection, original errors and mapping quarantine, main/Worker');
}
if(isMainThread)main().catch(error=>{console.error(error);process.exitCode=1;});else Promise.all([exercise(workerData.module),exercise(workerData.module,true),exercise(workerData.module,false,true),exercise(workerData.module,true,true)]).then(result=>parentPort.postMessage(result),error=>{throw error;});
