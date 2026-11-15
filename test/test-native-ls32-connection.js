'use strict';

// Generated originals for a PE-facing LS connection. These bytes are fixtures,
// never edits to the selected proprietary COMCTL32/COMMCTRL pair.
const assert = require('node:assert/strict');
const {makeFixture} = require('../tools/kernel32-native-fixture');
const {thunkImage} = require('./test-ne-thunkconnect16');

function pairingImages({base=0x400000, name='PAIR', checksum=0x13572468,
  value=0x1234abcd, reason=1, layout='LS01', lateBinding='LB01',
  qtOffset=36, ftOffset=68, module32='peer.dll', name32='Pair_ThunkData32',
  name16='THUNKDATA16', module16=name+'.dll', module=base, ...neOptions}={}) {
  const bytes=makeFixture(), raw=rva=>rva-0x1000+0x200;
  bytes.writeUInt32LE(base,0x80+24+28);
  bytes.write('ThunkConnect32\0',raw(0x1a02));
  const data=base+0x2700;
  const args=[data,base+0x2800,base+0x2840,base+0x2880,module,reason];
  const u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];
  const code=[];
  for(const arg of [...args].reverse())code.push(0x68,...u32(arg));
  code.push(0xff,0x15,...u32(base+0x1900),0xa3,...u32(base+0x2900),0xc3);
  bytes.set(code,raw(0x2000));
  bytes.write(layout,raw(0x2700));bytes.writeUInt32LE(checksum,raw(0x2704));
  bytes.write(lateBinding,raw(0x270c));
  bytes.writeUInt32LE(qtOffset,raw(0x271c));bytes.writeUInt32LE(ftOffset,raw(0x2720));
  bytes.fill(0xcc,raw(0x2724),raw(0x2764));
  bytes.write(name16+'\0',raw(0x2800));bytes.write(module16+'\0',raw(0x2840));
  bytes.write(module32+'\0',raw(0x2880));
  // The real LS16 registration names this exact PE data export. The EAT
  // resolves to the supplied LS32 header rather than a host-provided pointer.
  bytes.writeUInt32LE(0x2700,raw(0x1140));
  bytes.write(name32+'\0',raw(0x1190));
  bytes.write(module32+'\0',raw(0x1180));
  // A separate ordinary x86 loader is used by Worker controls before parking
  // the actual connection CALL. Resolve LoadLibrary16/FreeLibrary16 from the
  // native KERNEL32 EAT, without injecting an API thunk from the host.
  bytes.writeUInt32LE(0x1b00,raw(0x1904));
  bytes.write('GetModuleHandleA\0',raw(0x1b02));
  bytes.write('kernel32.dll\0',raw(0x28c0));
  const load=[],emit=(...b)=>load.push(...b),slots=base+0x29a0;
  emit(0x68,...u32(base+0x28c0),0xff,0x15,...u32(base+0x1904));
  emit(0x89,0xc3,0x8b,0x53,0x3c,0x01,0xda,0x8b,0x52,0x78,0x01,0xda,
    0x8b,0x4a,0x10,0x8b,0x72,0x1c,0x01,0xde);
  for(const ordinal of [35,36])emit(0xb8,...u32(ordinal),0x29,0xc8,
    0x8b,0x04,0x86,0x01,0xd8,0xa3,...u32(slots+(ordinal-35)*4));
  emit(0x68,...u32(base+0x2840),0xff,0x15,...u32(slots),
    0xa3,...u32(base+0x2904),0xc3);
  bytes.set(load,raw(0x2400));
  const ne=thunkImage({name,checksum,value,module16:name+'.dll',module32,name32,...neOptions});
  return {bytes,ne,args,entry:base+0x2000,preloadEntry:base+0x2400,slots,
    result:base+0x2900,data,base,
    names:{module16,module32,name16,name32},checksum,value,raw};
}

function fixtureControls() {
  const {inspectNeDll}=require('../lib/ne-image');
  for(const options of [{},{name:'OTHER',checksum:0x24681357,value:0x56781234},
    {checksum:0},{checksum:0xfedcba98},{codeTable:true},{reject:true},{trap:true}]) {
    const f=pairingImages(options),ne=inspectNeDll(f.ne);
    assert.equal(ne.dllEntryOrdinal,4);
    assert.equal(ne.entries.get(5).segment,2);
    assert.equal(f.bytes.toString('ascii',f.raw(0x2700),f.raw(0x2704)),'LS01');
    assert.equal(f.bytes.readUInt32LE(f.raw(0x2704)),f.ne.readUInt32LE(0x904));
    assert.equal(f.bytes.toString('ascii',f.raw(0x270c),f.raw(0x2710)),'LB01');
    assert.equal(f.bytes.readUInt32LE(f.raw(0x271c)),36);
    assert.equal(f.bytes.readUInt32LE(f.raw(0x2720)),68);
    assert.equal(f.bytes[f.raw(0x2000)],0x68,'real x86 pushes, then imported CALL');
    assert.equal(f.bytes.readUInt32LE(f.raw(0x1140)),0x2700,'native EAT data export');
    assert.equal(f.ne.readUInt16LE(0xd00),options.codeTable?1:2,'real internal FAR relocations');
  }
  console.log('PASS synthetic PE six-argument LS/LB caller and independent native KERNEL.651 NE fixtures (static only)');
}

const extraWat=String.raw`
  (func (export "ls32_test_request") (result f64)
    (f64.convert_i64_u (global.get $win16_guest_pending)))
`;

async function compiledControls() {
  const fs=require('node:fs');
  assert(process.env.WA_TEST_WASM,'explicit fully qualified WA_TEST_WASM required');
  const wasm=fs.readFileSync(process.env.WA_TEST_WASM);
  const {createHostImports}=require('../lib/host-imports');
  const {createNeLifecycle}=require('../lib/ne-lifecycle');
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const imports=createHostImports({getMemory:()=>memory.buffer,renderer:null,resourceJson:{}});
  imports.host.memory=memory;
  const module=await WebAssembly.compile(wasm);
  const e=(await WebAssembly.instantiate(module,imports)).exports;
  const state=owner=>['get_eip','get_esp','get_eax','get_edx','get_sreg_cs',
    'get_sreg_ds','get_sreg_ss','get_sync_msg_depth'].map(k=>owner[k]());
  const start=(owner,f)=>{
    new Uint8Array(memory.buffer).set(f.bytes,owner.get_staging());
    assert.equal(owner.load_pe(f.bytes.length),f.entry);
    owner.invalidate_code_range(f.base,0x3000);
    owner.set_eip(f.entry);owner.set_esp(0x7408000);owner.run(1000);
    assert.equal(owner.get_yield_reason(),18,'actual imported PE CALL parks');
    const request=owner.win16_guest_request_token();
    assert.equal(owner.win16_guest_request_field(request,0),5);
    assert.equal(owner.win16_guest_request_settle(request,1),0,'generic TRUE stays closed');
    return request;
  };
  for(const options of [{},{name:'OTHER',checksum:0x24681357,value:0x56781234},
    {checksum:0},{checksum:0xfedcba98},{codeTable:true}]) {
    const f=pairingImages(options),request=start(e,f),before=state(e);
    const life=createNeLifecycle(e,memory,[[f.names.module16,f.ne]]);
    const handle=life.loadGuest(f.names.module16);
    const header=Array.from({length:100},(_,i)=>e.guest_read8(f.data+i));
    const pair=life.pairGuest(handle,f.names.name16);assert(pair>0);
    assert.equal(life.callPaired(pair,0),f.value);
    const frame=e.win16_bridge_frame_begin();assert(frame);assert(e.win16_bridge_scope_begin(frame));
    const id=e.win16_bridge_module_resolve(handle),ds=e.win16_bridge_module_data(id);
    const headerAddress=e.win16_seg_base(ds>>>3);
    const table=e.guest_read32(headerAddress+8)>>>0;
    const tableAddress=e.win16_seg_base(table>>>19)+(table&65535);
    const target=e.guest_read32(tableAddress)>>>0;
    // A different *valid* code address in the same owned module must not be
    // accepted as the target pinned by this connection.
    e.guest_write32(tableAddress,target&0xffff0000);
    assert(e.win16_bridge_frame_end(frame));
    assert.throws(()=>life.callPaired(pair,0),/LS32|pair|connection/);
    const restore=e.win16_bridge_frame_begin();assert(e.win16_bridge_scope_begin(restore));
    e.guest_write32(tableAddress,target);assert(e.win16_bridge_frame_end(restore));
    assert.equal(life.callPaired(pair,0),f.value);
    assert.deepEqual(state(e),before,'long return preserves the original parked caller');
    assert.equal(createNeLifecycle(e,memory,[]).callPaired(pair,0),f.value,
      'native pairing survives replacement of the JS coordinator');
    for(const index of [-1,1,256,0x10000])assert.throws(()=>life.callPaired(pair,index));
    assert.throws(()=>life.releaseGuest(handle),/busy|notification|rejected/,
      'live connection pins prevent its companion from being retired');
    assert.equal(life.pairGuest(handle,f.names.name16),pair,'repeated pairing owns a reference');
    life.releasePair(pair);assert.equal(life.callPaired(pair,0),f.value);
    const tid=e.get_current_thread_id();e.set_current_thread_id(tid+19);
    assert.throws(()=>life.callPaired(pair,0));assert.throws(()=>life.releasePair(pair));
    e.set_current_thread_id(tid);
    for(const [offset,replacement] of [[0,0],[4,0x55],[12,0],[28,40],[32,72]]) {
      const old=e.guest_read32(f.data+offset)>>>0;
      e.guest_write32(f.data+offset,replacement);
      assert.throws(()=>life.callPaired(pair,0),/LS32|pair|connection/);
      e.guest_write32(f.data+offset,old);
    }
    assert.equal(life.callPaired(pair,0),f.value);
    for(const [address,value] of [[f.base+0x1140,0x2704],[f.base+0x2800,0x58],
      [f.base+0x2840,0x58],[f.base+0x2880,0x58],[f.data+36,0]]) {
      const old=e.guest_read32(address)>>>0;e.guest_write32(address,value);
      assert.throws(()=>life.callPaired(pair,0));e.guest_write32(address,old);
    }
    assert.equal(life.callPaired(pair,0),f.value);
    assert.equal(e.win16_process_arena_release(),0,'live pairing refuses process retirement');
    let reentered=false;
    const nested=createNeLifecycle({...e,run(blocks){
      if(!reentered){reentered=true;assert.throws(()=>life.callPaired(pair,0));assert.throws(()=>life.releasePair(pair));}
      return e.run(blocks);
    }},memory,[]);
    assert.equal(nested.callPaired(pair,0),f.value);assert(reentered);
    assert.deepEqual(Array.from({length:100},(_,i)=>e.guest_read8(f.data+i)),header,
      'pairing never rewrites the original header or unimplemented QT/FT relays');
    life.releasePair(pair);assert.throws(()=>life.callPaired(pair,0));
    life.releaseGuest(handle);assert.deepEqual(state(e),before);
    assert(e.win16_guest_request_valid(request));e.win16_guest_request_cancel();
    assert.equal(e.win16_guest_request_valid(request),0);
  }
  for(const options of [{layout:'SL01'},{lateBinding:'XX01'},{qtOffset:35},
    {ftOffset:64},{ftOffset:0xfffffffc},{module:0x410000}]) {
    const f=pairingImages(options);start(e,f);const before=state(e);
    const life=createNeLifecycle(e,memory,[[f.names.module16,f.ne]]);
    const handle=life.loadGuest(f.names.module16);
    assert.throws(()=>life.pairGuest(handle,f.names.name16),undefined,JSON.stringify(options));
    life.releaseGuest(handle);assert.deepEqual(state(e),before);e.win16_guest_request_cancel();
  }
  for(const changed of ['checksum','export','module','section']) {
    const f=pairingImages();
    if(changed==='checksum')f.bytes.writeUInt32LE(0x24681357,f.raw(0x2704));
    if(changed==='export')f.bytes.writeUInt32LE(0x2704,f.raw(0x1140));
    if(changed==='module')f.bytes.write('other.dll\0',f.raw(0x1180));
    if(changed==='section')f.bytes.writeUInt32LE(0x60000060,0x80+24+0xe0+36);
    start(e,f);const life=createNeLifecycle(e,memory,[[f.names.module16,f.ne]]),handle=life.loadGuest(f.names.module16);
    assert.throws(()=>life.pairGuest(handle,f.names.name16),undefined,changed);
    life.releaseGuest(handle);e.win16_guest_request_cancel();
  }
  for(const asynchronous of [false,true]) {
    const f=pairingImages({name:asynchronous?'ASYNC':'SERVICE'}),request=start(e,f),before=state(e);
    const bridge=require('../lib/ne-guest-bridge'),events=[];
    const owner={...e,win16_bridge_ls32_pair(...a){const result=e.win16_bridge_ls32_pair(...a);events.push(['pair',result]);return result;},
      win16_bridge_ls32_release(...a){const result=e.win16_bridge_ls32_release(...a);events.push(['release',result]);return result;}};
    const opts={exports:owner,memoryBuffer:memory.buffer,findDllSync:()=>f.ne,findDll:async()=>f.ne,checkNeOwner:()=>{}};
    let error;try{if(asynchronous)await bridge.serviceNeGuestYield(opts);else bridge.serviceNeGuestYieldSync(opts);}catch(failure){error=failure;}
    assert.match(error?.message??'',/pairing established.*FT prolog/);
    assert.deepEqual(error.nativePairing,{established:true,retired:true});
    assert.equal(events.length,2);assert(events[0][1]>0);assert.deepEqual(events[1],['release',1]);
    assert.deepEqual(state(e),before);assert(e.win16_guest_request_valid(request));
    assert.equal(createNeLifecycle(e,memory,[]).liveModule(f.names.module16),false,'service rollback retired its temporary companion');
    e.win16_guest_request_cancel();
  }
  {
    // A real native PE DLL row, normal DllMain callback and imported connection
    // CALL prove that the pairing pin holds the exact initializing generation.
    e.clear_yield();const loader=require('../lib/dll-loader');
    const base=e.get_next_dll_addr()>>>0,f=pairingImages({base,name:'DLLPAIR',module32:'native-pair.dll'});
    new Uint8Array(memory.buffer).set(f.bytes,e.get_staging());
    e.set_next_dll_explicit_root(1);const dllMain=e.load_dll(f.bytes.length,base)>>>0;
    const index=e.get_last_loaded_dll_index();assert(index>=0);assert.equal(dllMain,f.entry);
    const native=new DataView(memory.buffer),at=e.get_dll_lifecycle_table()+index*64;
    const generation=native.getUint32(at+4,true);
    loader.patchDllImports(e,memory.buffer,[{name:'native-pair.dll',bytes:f.bytes}],
      [{loadAddr:base,dllMain,index,generation}],()=>{});
    const before=state(e);let checked=false,callbackPins=0;
    const owner={...e,win16_bridge_ls32_pair(...a){
      const pins=native.getUint32(at+12,true),pair=e.win16_bridge_ls32_pair(...a);assert(pair);callbackPins=pins;
      assert.equal(native.getUint32(at+12,true),pins+1);
      const life=createNeLifecycle(e,memory,[]);assert.equal(life.callPaired(pair,0),f.value);
      native.setUint32(at+4,generation+1,true);assert.throws(()=>life.callPaired(pair,0));native.setUint32(at+4,generation,true);
      checked=true;return pair;
    }};
    let error;try{loader.callDllMain(owner,base,dllMain,()=>{},{reason:1,requireCompletion:true,maxBlocks:10000,
      onLoadLibraryYield:()=>require('../lib/ne-guest-bridge').serviceNeGuestYieldSync({exports:owner,memoryBuffer:memory.buffer,findDllSync:()=>f.ne})});}catch(failure){error=failure;}
    assert(checked,'ordinary native PE attach reached a generation-pinned executable connection');
    assert(error);assert.deepEqual(state(e),before);
    assert.equal(native.getUint32(at+12,true),callbackPins,'pairing pin retires; the incomplete DLL callback retains its existing quarantine');
    assert.equal(createNeLifecycle(e,memory,[]).liveModule(f.names.module16),false);
    e.win16_guest_request_cancel();e.clear_yield();
  }
  // Cancellation and a failed NE attach must not grant a connection, and
  // cancellation retires an existing one without resuming the parked PE API.
  {
    const f=pairingImages();start(e,f);const before=state(e);
    const life=createNeLifecycle(e,memory,[[f.names.module16,f.ne]]);
    const handle=life.loadGuest(f.names.module16),pair=life.pairGuest(handle,f.names.name16);
    e.win16_guest_request_cancel();assert.throws(()=>life.callPaired(pair,0));
    // Native cancellation owns retirement; releaseGuest is again available.
    life.releaseGuest(handle);assert.deepEqual(state(e),before);
  }
  for(const mode of ['trap','cancel']) {
    const f=pairingImages({name:mode.toUpperCase()});start(e,f);const before=state(e);
    const life=createNeLifecycle(e,memory,[[f.names.module16,f.ne]]);
    const handle=life.loadGuest(f.names.module16),pair=life.pairGuest(handle,f.names.name16);
    if(mode==='trap') {
      const outer=e.win16_bridge_frame_begin();assert(e.win16_bridge_scope_begin(outer));
      const id=e.win16_bridge_module_resolve(handle),far=e.win16_bridge_module_entry(id,2)>>>0;
      const at=e.win16_seg_base(far>>>19)+(far&65535);
      e.guest_write16(at,0x0b0f);e.invalidate_code_range(at,2);assert(e.win16_bridge_frame_end(outer));
      assert.throws(()=>life.callPaired(pair,0));life.releasePair(pair);life.releaseGuest(handle);
    } else {
      const controller=new AbortController();let cancelled=false;
      const owner={...e,run(blocks){const result=e.run(blocks);if(!cancelled){cancelled=true;e.win16_guest_request_cancel();controller.abort(new Error('LS32 target cancelled'));}return result;}};
      const invocation=createNeLifecycle(owner,memory,[],{signal:controller.signal});
      assert.throws(()=>invocation.callPaired(pair,0),/LS32 target cancelled/);
      assert.throws(()=>life.callPaired(pair,0));life.releaseGuest(handle);
    }
    assert.deepEqual(state(e),before,'trap/cancel restores the PE caller and releases native pins');e.win16_guest_request_cancel();
  }
  for(const options of [{reject:true},{trap:true},{badTable:true},{badReason:true}]) {
    const f=pairingImages(options);start(e,f);const before=state(e);
    const life=createNeLifecycle(e,memory,[[f.names.module16,f.ne]]);
    assert.throws(()=>life.loadGuest(f.names.module16));
    assert.equal(life.liveModule(f.names.module16),false);
    assert.deepEqual(state(e),before);e.win16_guest_request_cancel();
  }
  {
    const f=pairingImages({name:'COOP'});
    new Uint8Array(memory.buffer).set(f.bytes,e.get_staging());e.load_pe(f.bytes.length);
    const secondary=(await WebAssembly.instantiate(module,imports)).exports;
    secondary.init_thread(1,e.get_image_base(),e.get_code_start(),e.get_code_end(),
      e.get_thunk_base(),e.get_thunk_end(),e.get_num_thunks(),0);
    const {ThreadManager}=require('../lib/thread-manager');
    const manager=new ThreadManager(module,memory,{exports:e},()=>imports,{});
    const thread={instance:{exports:secondary},state:'active',tid:1};
    manager.threads=new Map([[123,thread]]);manager._runningThreadHandle=0;
    const facade=manager.cooperativeCallbackExports(thread);
    facade.set_eip(f.entry);facade.set_esp(0x7408000);facade.run(1000);
    assert.equal(facade.get_yield_reason(),18);const before=state(facade);
    const life=createNeLifecycle(facade,memory,[['COOP',f.ne]]);
    const handle=life.loadGuest('COOP'),pair=life.pairGuest(handle,f.names.name16);
    assert.equal(life.callPaired(pair,0),f.value);assert.deepEqual(state(facade),before);
    life.releasePair(pair);life.releaseGuest(handle);facade.win16_guest_request_cancel();
    thread.state='exited';assert.throws(()=>life.callPaired(pair,0),/retired/);
  }
  const {GuestThreadHost}=require('../lib/guest-thread-host');
  const path=require('node:path');
  for(const options of [{},{name:'OTHER',checksum:0x24681357,value:0x56781234}]) {
    const f=pairingImages(options);
    const host=new GuestThreadHost({memory,module,hostImports:imports.host,
      sigs:require('../lib/host-import-sigs.generated.json').sigs,
      workerUrl:path.resolve(__dirname,'../lib/guest-worker.js'),clockIntervalMs:0,
      findDll:async()=>f.ne,log:()=>{}});
    const remote=(name,...args)=>host.callExport(name,...args);
    const snapshot=()=>Promise.all(['get_eip','get_esp','get_eax','get_edx',
      'get_sreg_cs','get_sreg_ds','get_sreg_ss','get_sync_msg_depth'].map(n=>remote(n)));
    try {
      await host.start();await host.loadPe(f.bytes,'ls32-caller.exe');
      await remote('set_eip',f.preloadEntry);await remote('set_esp',0x7408000);
      await remote('guest_write32',0x7408000,0);
      for(let i=0;i<30;i++) {
        const ran=await host.link.slice(1000);assert(!ran.trapped);
        if(!await remote('get_eip'))break;assert(i<29);
      }
      const handle=new DataView(memory.buffer).getUint32(await remote('guest_to_wasm',f.result+4),true);
      assert(handle>=32);
      await remote('set_eip',f.entry);await remote('set_esp',0x7408000);
      // callExport(run) parks the actual import without asking the host to
      // service its still unsupported FT publication. Pair using native exports.
      await remote('run',1000);assert.equal(await remote('get_yield_reason'),18);
      const before=await snapshot();
      const outer=BigInt(await remote('ls_test_frame_begin'));
      assert(await remote('win16_bridge_scope_begin',outer));
      const id=await remote('win16_bridge_module_resolve',handle);
      const ds=await remote('win16_bridge_module_data',id);
      const pair=await remote('win16_bridge_ls32_pair',outer,id,(ds<<16)>>>0);assert(pair);
      assert(await remote('win16_bridge_frame_end',outer));
      const invocation=BigInt(await remote('ls_test_frame_begin'));
      assert(await remote('win16_bridge_ls32_invoke_begin',invocation,pair,0));
      await remote('run',256);
      assert.equal(await remote('ls_test_invoke_result',invocation),f.value);
      assert(await remote('win16_bridge_frame_end',invocation));
      assert.deepEqual(await snapshot(),before,'real Worker restores the parked caller');
      const final=BigInt(await remote('ls_test_frame_begin'));
      assert(await remote('win16_bridge_scope_begin',final));
      assert(await remote('win16_bridge_ls32_release',final,pair));
      assert(await remote('win16_bridge_frame_end',final));
      await remote('win16_guest_request_cancel');await remote('clear_yield');
      // Ordinary x86 FreeLibrary16 notification and final native unload.
      const code=Buffer.alloc(12);code[0]=0x68;code.writeUInt32LE(handle,1);
      code.set([0xff,0x15],5);code.writeUInt32LE(f.slots+4,7);code[11]=0xc3;
      new Uint8Array(memory.buffer,await remote('guest_to_wasm',f.base+0x2500),code.length).set(code);
      await remote('set_eip',f.base+0x2500);await remote('set_esp',0x7408000);
      await remote('guest_write32',0x7408000,0);
      for(let i=0;i<30;i++) {
        const ran=await host.link.slice(1000);assert(!ran.trapped);
        if(!await remote('get_eip'))break;assert(i<29);
      }
      assert.equal(await remote('get_esp'),0x7408004);
    } finally {await host.stop();}
  }
  {
    const f=pairingImages({name:'CANCELIO'});let entered,release;
    const pending=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
    const host=new GuestThreadHost({memory,module,hostImports:imports.host,
      sigs:require('../lib/host-import-sigs.generated.json').sigs,
      workerUrl:path.resolve(__dirname,'../lib/guest-worker.js'),clockIntervalMs:0,
      findDll:async()=>{entered();await gate;return f.ne;},log:()=>{}});
    try {
      await host.start();await host.loadPe(f.bytes,'ls32-cancel.exe');
      await host.callExport('set_eip',f.entry);await host.callExport('set_esp',0x7408000);
      const running=host.link.slice(1000),failure=running.then(()=>null,error=>error);
      await pending;await host.stop();release();assert(await failure,'retired Worker cannot pair after source lookup');
    } finally {release?.();await host.stop();}
  }
  console.log('PASS compiled PE-facing native LS32 pairing, distinct x86 targets, context, refs, malformed/foreign/stale/cancel/attach rollback');
}

if(require.main===module)(async()=>{
  fixtureControls();if(process.argv.includes('--compiled'))await compiledControls();
})().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={pairingImages,fixtureControls,compiledControls,extraWat};
