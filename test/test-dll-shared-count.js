'use strict';
const fs=require('fs'),path=require('path');
const {Worker,isMainThread,parentPort,workerData}=require('worker_threads');
const root=path.resolve(__dirname,'..');
const assert=require('node:assert/strict');
if(!isMainThread){
 (async()=>{
  const {createHostImports}=require(root+'/lib/host-imports');
  const {loadDll}=require(root+'/lib/dll-loader');
  const {guestToWasm}=require(root+'/lib/mem-utils');
  const memory=workerData.memory,barrier=new Int32Array(workerData.barrier);
  const ctx={getMemory:()=>memory.buffer,resourceJson:{menus:{},dialogs:{},strings:{},bitmaps:{}},onExit:()=>{}};
  const imports=createHostImports(ctx);imports.host.memory=memory;
  for(const name of ['create_thread','exit_thread','terminate_thread','create_event','set_event','reset_event','wait_single','wait_multiple'])imports.host[name]=()=>0;
  const instance=await WebAssembly.instantiate(workerData.module,imports),e=instance.exports;ctx.exports=e;
  parentPort.postMessage({ready:true,id:workerData.id});
  parentPort.once('message',()=>{
   try{
    // Distinct low addresses isolate shared registry ownership from the
    // separate mapping-address and staging-buffer serialization concerns.
    const wrapped={...e,get_next_dll_addr:()=>workerData.id==='a'?0x00400000:0x00600000,load_dll:(...args)=>{
     if (!workerData.serialized) { Atomics.add(barrier,0,1);Atomics.notify(barrier,0);
     while(Atomics.load(barrier,0)<2){
      if(Atomics.wait(barrier,0,1,10000)==='timed-out')throw Error('staging barrier timed out');
     }
     } return e.load_dll(...args);
    }};
    const mapped=loadDll(wrapped,memory.buffer,new Uint8Array(workerData.fixture),workerData.id+'.dll');
    const addr=guestToWasm(mapped.loadAddr+0x1180,e,memory.buffer,e.get_image_base());
    const actual=new DataView(memory.buffer).getUint32(addr,true);
    parentPort.postMessage({id:workerData.id,expected:workerData.expected,actual,mapped,dllCount:e.get_dll_count(),tableFirst:new DataView(memory.buffer).getUint32(e.get_dll_table(),true),correct:actual===workerData.expected});
   }catch(error){parentPort.postMessage({id:workerData.id,error:String(error)});}
  });
 })().catch(error=>parentPort.postMessage({id:workerData.id,error:String(error)}));
}else{
 (async()=>{
function resourceDll(counter = 0) {
  const b = Buffer.alloc(0x400), pe = 0x80, opt = pe + 24, section = opt + 0xe0;
  b.writeUInt16LE(0x5a4d, 0); b.writeUInt32LE(pe, 0x3c);
  b.writeUInt32LE(0x4550, pe); b.writeUInt16LE(0x14c, pe + 4);
  b.writeUInt16LE(1, pe + 6); b.writeUInt16LE(0xe0, pe + 20);
  b.writeUInt16LE(0x210e, pe + 22); b.writeUInt16LE(0x10b, opt);
  b.writeUInt32LE(0x10000000, opt + 28);
  b.writeUInt32LE(0x1000, opt + 32); b.writeUInt32LE(0x200, opt + 36);
  b.writeUInt32LE(0x2000, opt + 56); b.writeUInt32LE(0x200, opt + 60);
  b.writeUInt32LE(16, opt + 92);
  b.write('.data\0\0\0', section, 'ascii');
  b.writeUInt32LE(0x200, section + 8); b.writeUInt32LE(0x1000, section + 12);
  b.writeUInt32LE(0x200, section + 16); b.writeUInt32LE(0x200, section + 20);
  b.writeUInt32LE(0xc0000040, section + 36);
  b.writeUInt32LE(0x12345678, 0x380);
  if (counter) {
    b.writeUInt32LE(0x1000, opt + 16);
    b.writeUInt32LE(0xe0000060, section + 36);
    // DllMain increments counter[reason & 1], then returns TRUE (stdcall).
    Buffer.from([0x8b,0x44,0x24,0x08,0x83,0xe0,0x01,0xba,
      counter & 255,(counter >>> 8) & 255,(counter >>> 16) & 255,counter >>> 24,
      0xff,0x04,0x82,0xb8,1,0,0,0,0xc2,0x0c,0]).copy(b, 0x200);
  }
  return b;
}

  const makeFixture=resourceDll;
  const module=await WebAssembly.compile(fs.readFileSync(root+'/build/wine-assembly.wasm'));
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),barrier=new SharedArrayBuffer(4);
  const workers=[],results=[],ready=[];
  const completions=[];const guard=setTimeout(()=>{for(const w of workers)w.terminate();},30000);
  try{
   for(const[id,expected]of [['a',0x11112222],['b',0x33334444]]){
    const fixture=makeFixture();fixture.writeUInt32LE(expected,0x380);
    const w=new Worker(__filename,{workerData:{id,expected,fixture,module,memory,barrier,serialized:true}});workers.push(w);
    ready.push(new Promise(resolve=>w.on('message',m=>{if(m.ready)resolve();})));
    completions.push(new Promise(resolve=>{w.on('message',m=>{if(!m.ready){results.push(m);resolve();}});w.on('error',error=>{results.push({id,error:String(error)});resolve();});w.on('exit',resolve);}));
   }
   await Promise.all(ready);workers[0].postMessage({go:true});await completions[0];workers[1].postMessage({go:true});await completions[1];
   assert.equal(results.length,2,'both actual workers returned');
   assert.ok(results.every(r=>r.correct),'serialized mapping preserves both payloads');
   assert.equal(results[0].dllCount,1,'first worker publishes row one');
   assert.equal(results[1].dllCount,2,'second worker sees published count without host replay');
   assert.equal(results[1].tableFirst,results[0].mapped.loadAddr,'second worker preserves first row');
   // A delayed host reply must not replay a captured count over shared state.
   // Exercise the production thread-manager paths, not copies of their guards.
   const {ThreadManager}=require(root+'/lib/thread-manager');
   const shared={has_shared_dll_registry:()=>1,get_dll_count:()=>2,
    set_dll_count:()=>{throw Error('stale module-count replay');}};
   const tm=Object.create(ThreadManager.prototype);
   tm.mainInstance={exports:shared};tm.workerBackend=null;
   tm.publishWorkerThunkState=()=>{};
   await tm._publishLinkLoaderState({callExport:async name=>name==='get_dll_count'?99:0});
   tm.adoptMainGlobals({...shared});
   tm.publishWorkerGlobals({...shared,get_dll_count:()=>99});
   console.log('PASS shared DLL count across independently instantiated workers');
  }finally{clearTimeout(guard);await Promise.all(workers.map(w=>w.terminate()));}
 })().catch(error=>{console.error(error);process.exitCode=1;});
}
