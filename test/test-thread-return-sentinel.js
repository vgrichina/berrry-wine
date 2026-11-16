'use strict';
// Real WASM, production ThreadManager, cooperative instances and actual Workers.
// NULL transfers must never count as the host-seeded ThreadProc return.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const {createHostImports} = require(root + '/lib/host-imports');
const {ThreadManager} = require(root + '/lib/thread-manager');
const {GuestThreadHost} = require(root + '/lib/guest-thread-host');
const {makeFixture, BASE, iat} = require(root + '/tools/kernel32-native-fixture');
const {loadDll, callDllMain} = require(root + '/lib/dll-loader');
const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return [...b]; };
async function exercise(backend, module) {
  const memory = new WebAssembly.Memory({initial:8192, maximum:8192, shared:true});
  const ctx = {getMemory:()=>memory.buffer, resourceJson:{menus:{},dialogs:{},strings:{},bitmaps:{}}, onExit(){}};
  const imports = createHostImports(ctx); imports.host.memory = memory;
  let tm, host;
  Object.assign(imports.host, {
    exit_thread: code => tm.exitThread(code),
    get_exit_code_thread: handle => tm.getExitCodeThread(handle),
    wait_single: (handle, timeout) => tm.waitSingle(handle, timeout),
  });
  const instance = await WebAssembly.instantiate(module, imports), e=instance.exports; ctx.exports=e;
  const pe=makeFixture(); new Uint8Array(memory.buffer,e.get_staging(),pe.length).set(pe); assert(e.load_pe(pe.length));
  const logs=[];
  if (backend === 'worker') {
    host = new GuestThreadHost({memory,module,hostImports:imports.host,
      sigs:JSON.parse(fs.readFileSync(root+'/lib/host-import-sigs.generated.json')).sigs,
      workerUrl:root+'/lib/guest-worker.js',localMainExports:()=>e,clockIntervalMs:0,log:s=>logs.push(s)});
  }
  tm=new ThreadManager(module,memory,instance,()=>imports,{workerBackend:host}); tm._log=s=>logs.push(s);
  const write = bytes => { const a=e.guest_alloc(bytes.length)>>>0; bytes.forEach((v,i)=>e.guest_write8(a+i,v)); return a; };
  const str = s=>write([...Buffer.from(s+'\0')]);
  const stack=e.get_esp();
  const call = (addr,args=[]) => {
    const code=write([...args.slice().reverse().flatMap(v=>[0x68,...u32(v)]),0xb8,...u32(addr),0xff,0xd0,0xc3]);
    e.clear_yield();e.set_esp(stack);e.call_func(code,0,0,0,0);e.run(10000);assert.equal(e.get_eip(),0);return e.get_eax()>>>0;
  };
  const k=call(e.guest_read32(iat('LoadLibraryA'))>>>0,[str('KERNEL32.DLL')]);
  const resolve = name => {const p=call(e.guest_read32(iat('GetProcAddress'))>>>0,[k,str(name)]);assert(p,name);return p;};
  const funcs=Object.fromEntries(['ExitThread','WaitForSingleObject','GetExitCodeThread'].map(n=>[n,resolve(n)]));
  const count=write([0,0,0,0]);
  // A real loaded DllMain counts only DLL_THREAD_DETACH in guest memory.
  const dll=makeFixture(), p=0x80,o=p+24;
  dll.writeUInt16LE(0x210e,p+22);dll.writeUInt32LE(0x10000000,o+28);
  dll.writeUInt32LE(0,o+96);dll.writeUInt32LE(0,o+100);
  Buffer.from([0x83,0x7c,0x24,8,3,0x75,6,0xff,5,...u32(count),0xb8,1,0,0,0,0xc2,12,0]).copy(dll,0x1200);
  const loaded=loadDll(e,memory.buffer,dll,'C:\\sentinel.dll');
  const attached=callDllMain(e,loaded.loadAddr,loaded.dllMain,null,{strictReturn:true}); assert(attached.completed);
  tm.setLoadedDlls([loaded],callDllMain);
  const output=[];
  try {
    if(host) await host.start();
    const cases=[
      ['ret0',[0x31,0xc0,0xc2,4,0]],
      ['retDWORD',[0xb8,...u32(0x87654321),0xc2,4,0]],
      ['fusedRetDWORD',[0x53,0xb8,...u32(0x12345678),0x5b,0xc2,4,0]],
      ['nullCall',[0x31,0xc0,0xff,0xd0]],
      ['nullJump',[0x31,0xc0,0xff,0xe0]],
      ['balancedNullJump',[0x83,0xc4,8,0x31,0xc0,0xff,0xe0]],
      ['corruptReturn',[0x6a,0,0xc2,4,0]],
      ['wrongRetCleanup',[0x31,0xc0,0xc2,8,0]],
      ['corruptNonzeroReturn',[0xc7,4,0x24,0xff,0xff,0xff,0xff,0xc2,4,0]],
      ['trap',[0x0f,0x0b]],
      ['exitThread',[0x6a,37,0xb8,...u32(funcs.ExitThread),0xff,0xd0,0xcc]],
    ];
    for(const [name,bytes] of cases){
      const start=write(bytes), before=e.guest_read32(count)>>>0, offset=logs.length;
      const handle=tm.createThread(start,0x12345678,65536,0,0);assert(handle);
      const liveCode=write([0,0,0,0]);
      assert.equal(call(funcs.WaitForSingleObject,[handle,0]),258,'new thread is not signaled');
      assert.equal(call(funcs.GetExitCodeThread,[handle,liveCode]),1);
      assert.equal(e.guest_read32(liveCode)>>>0,259,'new thread is STILL_ACTIVE');
      await tm.spawnPending(); const thread=tm.threads.get(handle);
      for(let i=0;i<15&&thread.state!=='exited';i++){
        if(host) await tm.runWorkerSlices(1000);else tm.runSlice(1000);
      }
      const destination=write([0,0,0,0]);
      const wait=call(funcs.WaitForSingleObject,[handle,0]);
      const getExit=call(funcs.GetExitCodeThread,[handle,destination]);
      const detach=(e.guest_read32(count)>>>0)-before;
      const row={backend,name,handle,state:thread.state,wait,getExit,returnedDWORD:e.guest_read32(destination)>>>0,
        detach,reason:thread._exitCleanup?.reason,logs:logs.slice(offset)};
      if(thread.instance){const ex=thread.instance.exports;row.regs={eip:ex.get_eip()>>>0,esp:ex.get_esp()>>>0,eax:ex.get_eax()>>>0,prev:ex.get_dbg_prev_eip()>>>0,halt:ex.get_last_run_halt()};}
      output.push(row);console.log(JSON.stringify(row));
      assert.equal(thread.state,'exited',name);assert.equal(wait,0,name);assert.equal(getExit,1,name);
      // Exercise the actual allocator reclamation boundary, without replacing it.
      if(host && thread.link) await host.dropThread(thread.link);
      tm._allocWorkerSlot();
      row.stackAllocAfterReclaim=thread.stackAlloc>>>0;
      row.detachAfterReclaim=(e.guest_read32(count)>>>0)-before;
      if(!process.argv.includes('--baseline')){
        const normal=name.startsWith('ret')||name==='fusedRetDWORD';
        const expected=name==='retDWORD'?0x87654321:name==='fusedRetDWORD'?0x12345678:name==='exitThread'?37:normal?0:1;
        assert.equal(row.returnedDWORD,expected,backend+' '+name+' returned DWORD');
        assert.equal(detach,normal||name==='exitThread'?1:0,backend+' '+name+' detach');
        assert.equal(row.detachAfterReclaim,detach,backend+' '+name+' detach exactly once');
        assert.equal(row.stackAllocAfterReclaim,0,backend+' '+name+' reclaimed stack');
        if(normal)assert.equal(row.reason,'ThreadProc return');
        else if(name==='trap')assert.equal(row.reason,backend==='worker'?'trap':'crash');
        else if(name!=='exitThread')assert.equal(row.reason,'unexpected-eip=0');
      }
    }
  } finally { if(host) await host.stop(); ctx.stopAudio?.(); }
  return output;
}
(async()=>{
  const module=await WebAssembly.compile(fs.readFileSync(root+'/build/wine-assembly.wasm'));
  const all=[];for(const backend of (process.argv.includes('--cooperative-only')?['cooperative']:['cooperative','worker']))all.push(...await exercise(backend,module));
  if (process.env.THREAD_SENTINEL_OBSERVATIONS)
    fs.writeFileSync(process.env.THREAD_SENTINEL_OBSERVATIONS,JSON.stringify(all,null,2)+'\n');
  console.log('PASS actual ThreadProc return/NULL/stack fault/ExitThread paths on cooperative and Worker backends');
})().catch(e=>{console.error(e);process.exitCode=1;});
