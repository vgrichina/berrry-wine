'use strict';
// Real x86 WM_DESTROY -> FreeLibrary -> DllMain detach -> callback return.
// The production Worker import owns this instance; no callback/export mocks.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {Worker,isMainThread,parentPort}=require('node:worker_threads');
const {createHostImports}=require('../lib/host-imports'),RPC=require('../lib/guest-rpc');
const loader=require('../lib/dll-loader');
const {pe,X86,BASE,DATA,u32}=require('./test-dll-lifecycle-real-pe');
const sigs={service_load_library:{params:[],results:['i32']}};
async function exercise(){
 const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),events=[];
 const ctx={getMemory:()=>memory.buffer,resourceJson:{},onExit(){}};
 const imports=createHostImports(ctx);imports.host.memory=memory;let e;
 parentPort.postMessage({t:'nativeMemory',buffer:memory.buffer});
 const local=RPC.createWorkerImports(memory,sigs,m=>{events.push(m);parentPort.postMessage(m);},{getExports:()=>e});
 imports.host.service_load_library=local.imports.host.service_load_library;
 const module=await WebAssembly.compile(fs.readFileSync(process.env.WA_TEST_WASM||path.join(__dirname,'../build/wine-assembly.wasm')));
 e=(await WebAssembly.instantiate(module,imports)).exports;ctx.exports=e;
 const callback=new X86().emit(0xff,0x35,u32(DATA)).api('FreeLibrary').eaxTo(4).store(8,1).emit(0x31,0xc0,0xc2,16,0).finish();
 const exe=pe([[0x2000,[0xc3]],[0x2200,callback]]);
 new Uint8Array(memory.buffer,e.get_staging(),exe.length).set(exe);e.load_pe(exe.length);
 const dll=pe([[0x1000,new X86().emit(0x83,0x7c,0x24,8,0).branch([0x0f,0x85],'return').store(0x100,1).label('return').emit(0xb8,1,0,0,0,0xc2,12,0).finish()]],true);
 const row=loader.loadDll(e,memory.buffer,dll,'nested-close.dll');
 const attached=loader.callDllMain(e,row.loadAddr,row.dllMain,null,{requireCompletion:true});
 loader.finishDllInitialization(e,memory.buffer,row,attached);
 e.guest_write32(DATA,row.loadAddr);e.wnd_table_set(0x10001,BASE+0x2200);
 const before=[e.get_eip(),e.get_esp(),e.get_sync_msg_depth()];e.send_message(0x10001,2,0,0);
 assert.equal(e.guest_read32(DATA+8),1,'WM_DESTROY reaches its native tail after unload');
 assert.equal(e.guest_read32(DATA+4),1,'FreeLibrary returns TRUE');
 assert.equal(e.guest_read32(DATA+0x100),1,'real PROCESS_DETACH ran');
 assert.equal(e.get_dll_index(row.loadAddr),-1,'module retires after detach');
 assert.deepEqual([e.get_eip(),e.get_esp(),e.get_sync_msg_depth()],before,'enclosing CPU restored only after native return');
 assert.equal(e.get_yield_reason(),0);assert.equal(events.filter(m=>m.t==='dllRetired'&&m.record.loadAddr===row.loadAddr).length,1);
 // Invalid handles complete with FALSE; a stale unload must not replay detach.
 e.guest_write32(DATA,0x12345678);e.guest_write32(DATA+8,0);e.send_message(0x10001,2,0,0);
 assert.equal(e.guest_read32(DATA+8),1);assert.equal(e.guest_read32(DATA+4),0);assert.equal(e.guest_read32(DATA+0x100),1);
 assert.equal(local.imports.host.service_load_library(),0,'no pending yield is not serviced');
 return {nativeDestroyReturned:true,nativeDetach:true,retired:true,invalidHandleFalse:true,worker:!isMainThread};
}
if(isMainThread){
 (async()=>{const w=new Worker(__filename),guard=setTimeout(()=>w.terminate(),15000);let result,error,broker;w.on('message',m=>{if(m.t==='nativeMemory')broker=RPC.createMainBroker({buffer:m.buffer},{service_load_library:()=>0},sigs,{});else if(m.t==='rpc')broker.serveRpc(m.slot,m.waitEntry);else if(m.worker)result=m;});w.on('error',e=>{error=e;});const code=await new Promise(r=>w.on('exit',r));clearTimeout(guard);if(error)throw error;assert.equal(code,0);assert(result?.worker);console.log('PASS',JSON.stringify(result));})().catch(e=>{console.error(e);process.exitCode=1;});
}else exercise().then(r=>parentPort.postMessage(r)).catch(e=>{console.error(e);process.exitCode=1;});
