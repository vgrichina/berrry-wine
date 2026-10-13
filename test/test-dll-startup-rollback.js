'use strict';
// Startup uses loadDlls rather than the dynamic LoadLibrary reply path. Real
// DLL entry points must roll back only the failing startup transaction's roots.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {Worker,isMainThread,parentPort,workerData}=require('node:worker_threads');
const {createHostImports}=require('../lib/host-imports');
const loader=require('../lib/dll-loader');
const {X86,pe,u32,BASE,DATA}=require('./test-dll-lifecycle-real-pe');
const {graphDll}=require('./test-dll-import-graph-lifecycle');
async function exercise(module){
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
async function main(){
 const module=await WebAssembly.compile(fs.readFileSync(process.env.WA_TEST_WASM||path.join(__dirname,'../build/wine-assembly.wasm')));
 const expected=await exercise(module),worker=new Worker(__filename,{workerData:{module}});
 const guard=setTimeout(()=>worker.terminate(),20000);
 try{const result=await new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);worker.once('exit',code=>reject(Error('worker exited before result '+code)));});assert.deepEqual(result,expected);}
 finally{clearTimeout(guard);await worker.terminate();}
 console.log('PASS real PE startup FALSE rollback preserves preexisting root and retires initialized dependency, main/Worker');
}
if(isMainThread)main().catch(error=>{console.error(error);process.exitCode=1;});else exercise(workerData.module).then(result=>parentPort.postMessage(result),error=>{throw error;});
