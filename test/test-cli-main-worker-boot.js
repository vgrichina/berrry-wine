'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const crypto=require('node:crypto');
const {bootRenderHarness}=require('./render-helper');
const {GuestThreadHost}=require('../lib/guest-thread-host');
const {createGuestMainOwner}=require('../lib/guest-main-owner');
const {configureExeOwned,stageAndLoadPeOwned}=require('../lib/process-boot');
const {BASE}=require('../lib/region-map.generated');
const {pe,u32,API}=require('./test-dll-lifecycle-real-pe');
const {ThreadManager}=require('../lib/thread-manager');
const {serviceMainTimingWait}=require('./main-timing-waits');
const {serviceMainIoWait}=require('../lib/main-io-wait');
const {VirtualFS}=require('../lib/filesystem');
const {Worker}=require('node:worker_threads');
const {CommandQueue,WorkerConsumer,OPCODES:OP}=require('../lib/d3d-command-stream');
const sigs=require('../lib/host-import-sigs.generated.json').sigs;
const root=path.resolve(__dirname,'..');

(async()=>{
 const bytes=fs.readFileSync(path.join(__dirname,'binaries/calc.exe'));
 const optional=bytes.readUInt32LE(0x3c)+24;
 const imageBase=bytes.readUInt32LE(optional+28),entry=imageBase+bytes.readUInt32LE(optional+16);
 const rows=[];
 for(const name of ['wine-assembly.wasm','wine-assembly.compat.wasm']){
  const wasm=fs.readFileSync(path.join(root,'build',name)),module=await WebAssembly.compile(wasm);
  for(const remote of [false,true]){
   const h=await bootRenderHarness({fonts:'none',prebuiltModule:module});
   let worker;
   try{
    if(remote){
     h.exports.set_host_shadow(1);
     worker=new GuestThreadHost({module,memory:h.memory,hostImports:h.host,sigs,
      workerUrl:path.join(root,'lib/guest-worker.js'),clockIntervalMs:0});
     await worker.start();
    }
    const owner=createGuestMainOwner(remote?{worker}:{localExports:h.exports});
    await owner.call('set_startup_show',0);
    const identity={name:'games\\owner-calc.exe',drive:0x44,args:'-test "owned boot"'};
    let actual;
    if(remote)actual=await worker.loadPe(bytes,identity.name,42,{exeDrive:identity.drive,extraArgs:identity.args});
    else{
     await configureExeOwned(owner,h.memory.buffer,identity);
     actual=(await stageAndLoadPeOwned(owner,h.memory.buffer,bytes,()=>{})).entry;
    }
    assert.equal(actual,entry);
    const state=await owner.read(['get_image_base','get_eip']);
    assert.equal(state.get_image_base,imageBase);
    assert.equal(state.get_eip,entry);
    if(remote)assert.equal(h.exports.get_image_base(),0,'host shadow did not load PE or acquire guest registers');
    const view=new DataView(h.memory.buffer),p=BASE.PROCESS_IMAGE_STATE;
    assert.equal(view.getUint32(BASE.STARTUP_SHOW_STATE,true),1,'explicit startup show retained');
    assert.equal(view.getUint32(BASE.STARTUP_SHOW_STATE+4,true),0,'SW_HIDE is not treated as absent');
    assert.equal(view.getUint32(p+12,true),identity.drive);
    assert.equal(Buffer.from(h.memory.buffer,view.getUint32(p+4,true),view.getUint32(p+8,true)).toString(),identity.name);
    assert.equal(Buffer.from(h.memory.buffer,BASE.EXTRA_CMDLINE_BUFFER,identity.args.length).toString(),identity.args);
    const shadowCpu=h.exports.get_cpu_mmx(),shadowVersion=h.exports.get_winver();
    for(const [setter,value] of [['set_cpu_mmx',0],['set_cpu_sse',1],['set_ansi_code_page',950],
      ['set_winver',0x05650004],['set_virtual_alloc_top',0x12345000]]){
     assert(owner.supports(setter),setter+' exists on this owner');
     await owner.optionalCall(setter,value);
    }
    assert.equal(owner.supports('nonexistent_owner_setting'),false);
    await owner.optionalCall('nonexistent_owner_setting',1);
    const settings=await owner.read(['get_cpu_mmx','get_cpu_sse','get_ansi_code_page','get_winver','get_virtual_alloc_top']);
    assert.deepEqual(settings,{get_cpu_mmx:0,get_cpu_sse:1,get_ansi_code_page:950,get_winver:0x05650004,get_virtual_alloc_top:0x12345000});
    if(remote){
     assert.equal(h.exports.get_cpu_mmx(),shadowCpu,'CPU configuration is not applied to shadow');
     assert.equal(h.exports.get_winver(),shadowVersion,'Windows version belongs to guest owner');
    }
    const shadowUop=h.exports.get_uop_icg_mega();
    const experiments=require('./runner-experiments').createRunnerExperiments({
     hasFlag:flag=>flag==='no-uop-retry-ladder',
     getArg:(flag,fallback)=>flag==='uop-icg-mega'?'3':fallback,env:{},log:()=>{},
    });
    await experiments.applyMainOwned(owner,{copySuperops:false,ctx:{}});
    await owner.optionalCall('set_spin_park_k',0);
    const postload=await owner.read(['get_uop','get_uop_retry_ladder','get_uop_icg_mega','get_spin_park_k']);
    assert.deepEqual(postload,{get_uop:1,get_uop_retry_ladder:0,get_uop_icg_mega:3,get_spin_park_k:0});
    if(remote)assert.equal(h.exports.get_uop_icg_mega(),shadowUop,'interpreter options do not target shadow');
    const marker=await owner.call('guest_alloc',4);
    assert(marker,'DLL attach marker allocation');
    const markerOffset=await owner.call('guest_to_wasm',marker);
    view.setUint32(markerOffset,0,true);
    // Only PROCESS_ATTACH increments the marker; later detach cannot touch it.
    const dllBytes=pe([[0x1000,[0x83,0x7c,0x24,0x08,0x01,0x75,0x06,
     0xff,0x05,...u32(marker),0xb8,1,0,0,0,0xc2,0x0c,0]]],true);
    const beforeDll=await owner.read(['get_eip','get_esp']);
    let registrations=0;
    const dlls=await owner.loadDlls(bytes,[{name:'owner-init.dll',bytes:dllBytes}],()=>{}, {
     registerDllResources(configs,loaded){
      registrations++;
      assert.equal(configs[0].name,'owner-init.dll');
      assert.equal(loaded[0].name,'owner-init.dll');
      assert.equal(view.getUint32(markerOffset,true),0,'resources registered before guest attach');
     },
    });
    assert.equal(registrations,1);
    assert.equal(view.getUint32(markerOffset,true),1,'selected owner executed DLL attach exactly once');
    assert.equal(dlls.length,1);
    assert.equal(dlls[0].dllMain,dlls[0].loadAddr+0x1000);
    assert.equal(dlls[0].index,await owner.call('get_dll_index',dlls[0].loadAddr));
    assert(dlls[0].generation>0);
    assert.deepEqual(await owner.read(['get_eip','get_esp']),beforeDll,'DLL startup restores owner registers');
    if(remote)assert.equal(h.exports.get_image_base(),0,'DLL startup never loads the host shadow');
    await owner.call('guest_free',marker);
    // The renderer owns another native allocator. Its retired blocks must be
    // adopted by the guest instance, after termination, not by the host shadow.
    const shadowFree=h.exports.get_free_list();
    const renderWorker=new Worker(path.join(root,'lib/d3d-render-worker.js'));
    let adoptions=0;
    const consumer=new WorkerConsumer(renderWorker,{module,memory:h.memory,sigs,imageBase:state.get_image_base,
     reclaimHeap:async head=>{
      assert.equal(renderWorker.threadId,-1,'renderer terminated before heap handoff');
      adoptions++;
      const count=await owner.call('d3d_render_adopt_free_list',head);
      // get_free_list flushes bins and may prepend blocks freed during DLL startup.
      assert.equal(await owner.call('d3d_render_free_list_diagnostic',1),head,
       'retired heap belongs to selected guest instance');
      return count;
     }});
    try{
     await consumer.ready;
     const queue=new CommandQueue({deviceId:71,consumer});
     await queue.submit(OP.RESOURCE_CREATE,{kind:'device',width:8,height:8}).value;
     queue.submit(OP.CLEAR,{color:[1,0,0,1],flags:3});
     const frame=await queue.submit(OP.READBACK).value;
     assert.equal(frame.pixels.length,8*8*4);
     for(let i=0;i<frame.pixels.length;i+=4)
      assert.deepEqual([...frame.pixels.slice(i,i+4)],[0,0,255,255],'native BGRA red');
     await queue.fence();
    }finally{await consumer.cancel(0);}
    assert.equal(adoptions,1,'heap adopted exactly once');
    assert(consumer.shutdownInfo.heapAdopted>0,'actual native renderer allocations reclaimed');
    if(remote)assert.equal(h.exports.get_free_list(),shadowFree,'host shadow allocator untouched');
    const retirement={adoptions,blocks:consumer.shutdownInfo.heapAdopted,pixels:64};
    const shadowYield=h.exports.get_yield_reason();
    await owner.call('test_vblank_reset');
    assert((await owner.call('test_vblank_wait_once'))&1,'native DirectDraw call parks');
    // The native probe preserves its caller by clearing yield on return.
    // Restore the observed park to exercise the CLI owner-service boundary.
    await owner.call('set_yield_state',13,1);
    const parked=await owner.read(['get_yield_reason','get_vblank_deadline_ms']);
    assert.equal(parked.get_yield_reason,13);
    const timing={batchClock:{batchTicks:()=>(parked.get_vblank_deadline_ms-5)>>>0,getTickMsPerBatch:()=>1},
     tickState:{pausedMs:0,lastTick:0},vblank:{waits:0,guestMsAdded:0},
     spin:{clockWaits:0,peekWaits:0,guestMsAdded:0}};
    assert.equal(await serviceMainTimingWait(owner,timing),true);
    assert.equal((await owner.read(['get_yield_reason'])).get_yield_reason,0);
    assert.equal(timing.tickState.pausedMs,6);
    assert.equal(timing.vblank.waits,1);
    if(remote)assert.equal(h.exports.get_yield_reason(),shadowYield,'host shadow yield unchanged');
    await owner.call('vblank_tick');
    const resumed=await owner.call('test_vblank_wait_once');
    assert.equal(resumed&1,0,'native wait completes after display tick');
    assert(resumed&8,'native wait returns DD_OK');
    const vfs=new VirtualFS(),ioBytes=new Uint8Array(4);
    vfs.setProviderFile('c:\\owner-read.bin',{provider:{size:4,
     readRange:async()=>new Uint8Array([9,8,7,6])}});
    const file=vfs.createFile('c:\\owner-read.bin',0x80000000,3);
    vfs.pendingRead=vfs.readFile(file,ioBytes,4).pending;
    assert(vfs.pendingRead); // Host import publishes this alongside yield 12.
    await owner.call('set_yield_state',12,1);
    assert.equal(await serviceMainIoWait(owner,vfs),true);
    assert.equal((await owner.read(['get_yield_reason'])).get_yield_reason,0);
    assert(vfs.readFile(file,ioBytes,4).ok);
    assert.deepEqual([...ioBytes],[9,8,7,6]);
    if(remote)assert.equal(h.exports.get_yield_reason(),shadowYield,'I/O completion leaves shadow unchanged');
    const sleepThunk=await owner.call('guest_read32',dlls[0].loadAddr+0x1900+API.indexOf('Sleep')*4);
    const sleepCode=await owner.call('guest_alloc',32);
    const sleepOffset=await owner.call('guest_to_wasm',sleepCode);
    new Uint8Array(h.memory.buffer).set([0x68,...u32(77),0xb8,...u32(sleepThunk),0xff,0xd0,0xeb,0xfe],sleepOffset);
    await owner.call('set_yield_state',0,0);await owner.call('set_eip',sleepCode);
    const sleepSlice=await owner.run(100);
    // WinHelp interruption bookkeeping is ThreadManager's own (covered by its
    // help-callback tests); this fixture has no help macro to synchronize.
    const sleepState={_mainSleepUntil:0,_sleepNow:()=>1000,_syncMainHelpCallback(){}};
    if(remote)assert.equal(sleepSlice.sleepMs,77,'actual Worker slice carries consumed Sleep');
    await ThreadManager.prototype.noteMainSleepOwned.call(sleepState,owner,remote?sleepSlice:undefined);
    assert.equal(sleepState._mainSleepUntil,1077,'native Sleep observed on selected owner '+JSON.stringify({sleepThunk,sleepCode,sleepSlice,state:await owner.read(['get_eip','get_esp','get_yield_reason','get_sleep_timeout','get_halted'])}));
    await ThreadManager.prototype.noteMainSleepOwned.call(sleepState,owner);
    assert.equal(sleepState._mainSleepUntil,1077,'consumed flag cannot reset existing deadline');
    if(remote)assert.equal(h.exports.get_sleep_yielded(),0,'shadow has no guest sleep flag');
    assert.deepEqual(await owner.resumeMessageWait(false),{resumed:false},
      'message resume does not touch a guest outside message wait');
    rows.push({module:name,sha256:crypto.createHash('sha256').update(wasm).digest('hex'),owner:owner.kind,entry:actual,...state,settings,postload,dlls,registrations,retirement,timing:timing.vblank,sleepUntil:sleepState._mainSleepUntil});
   }finally{await worker?.stop();}
  }
 }
 let called=false;
 await assert.rejects(stageAndLoadPeOwned({read:async()=>({}),call:()=>{called=true;}},new ArrayBuffer(32),bytes),/placement export/);
 assert.equal(called,false,'invalid owner placement never invokes load_pe');
 const memory=new ArrayBuffer(32);new Uint8Array(memory).fill(0xa5);
 await assert.rejects(configureExeOwned({read:async()=>({get_staging:30,get_staging_size:4}),call:()=>{called=true;}},memory,{name:'x'}),/staging range/);
 assert(new Uint8Array(memory).every(n=>n===0xa5),'invalid metadata placement never writes shared memory');
 console.log(JSON.stringify({status:'pass',rows},null,2));
 if(process.env.CLI_OWNER_BOOT_EVIDENCE){
  fs.mkdirSync(process.env.CLI_OWNER_BOOT_EVIDENCE,{recursive:true});
  fs.writeFileSync(path.join(process.env.CLI_OWNER_BOOT_EVIDENCE,'test-result.json'),JSON.stringify({status:'pass',rows},null,2)+'\n');
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
