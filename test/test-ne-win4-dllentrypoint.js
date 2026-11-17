'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {inspectNeDll}=require('../lib/ne-image');
const {neLifecycleImage}=require('./helpers/ne-lifecycle-image');

// Two real NE segments, distinct header LibEntry, resident notification
// export (ordinal 4), VALUE and WEP. All eight passed words are copied by x86
// instructions, not inferred from host arguments. No proprietary fixture.
function win4Image({attach=1,trap=false,detachTrap=false,cleanup=16,version=0x400}={}) {
  const b=neLifecycleImage(),n=0x80,w=(p,v)=>b.writeUInt16LE(v,p);
  w(n+0x3e,version);w(n+6,16);
  b.set([4,1,1,0,0,1,16,0,1,32,0,1,64,0,0,0],n+0x60);
  b.fill(0,n+0x70,n+0x90);
  let p=n+0x70;
  for(const [name,ordinal] of [['WEP',3],['VALUE',2],['DLLENTRYPOINT',4]]) {
    b[p++]=name.length;b.write(name,p);p+=name.length;w(p,ordinal);p+=2;
  }
  // Names need more room than the legacy helper reserved.
  w(n+0x28,0xa0);w(n+0x2a,0xb0);
  b.fill(0,0x200,0x300);
  b.set([0x89,0x3e,0,0,0x8c,0x1e,2,0,0x89,0x0e,4,0,0xb8,1,0,0xcb],0x200);
  b.set([0xa1,10,0,0xcb],0x210);
  b.set([0xc7,6,14,0,4,0,0xb8,0,0,0xca,2,0],0x220);
  const code=[0x55,0x89,0xe5];
  for(let i=0;i<8;i++)code.push(0x8b,0x46,6+i*2,0xa3,0x20+i*2,0);
  // AX = low reason. Separate counters for every increment/decrement.
  code.push(0x83,0x7e,18,0,0x74,15,
    0xff,6,10,0,0xc7,6,14,0,2,0,0xa1,16,0,0xeb,13,
    0xff,6,12,0,0xc7,6,14,0,3,0,0xb8,0,0);
  if(trap)code.push(0x0f,0x0b); // actual invalid instruction
  if(detachTrap)code.push(0x83,0x7e,18,0,0x75,2,0x0f,0x0b);
  code.push(0x5d,0xca,cleanup,0);
  b.set(code,0x240);
  w(0x310,attach);
  return b;
}

function staticControls() {
  const image=inspectNeDll(win4Image());
  assert.equal(image.dllEntryOrdinal,4);
  assert.equal(image.expectedWinVersion,0x400);
  assert.equal(inspectNeDll(win4Image({version:0x30a})).dllEntryOrdinal,0);
  const missing=win4Image();missing[0x80+0x70+15]=88;
  assert.equal(inspectNeDll(missing).dllEntryOrdinal,0,'Win4 notification export is optional');
  const data=win4Image();data[0x80+0x61]=2;
  assert.throws(()=>inspectNeDll(data),/initializer|DllEntryPoint/);
  const absent=win4Image();absent.writeUInt16LE(99,0x80+0x70+28);
  assert.throws(()=>inspectNeDll(absent));
}

async function compiledControls() {
  const {createHostImports}=require('../lib/host-imports');
  const {createNeLifecycle}=require('../lib/ne-lifecycle');
  const {neGuestCaller}=require('./helpers/ne-guest-caller');
  const {serviceLoadLibraryYieldSync}=require('../lib/process-boot');
  const {ThreadManager}=require('../lib/thread-manager');
  const {GuestThreadHost}=require('../lib/guest-thread-host');
  const path=require('node:path');
  const module=await WebAssembly.compile(fs.readFileSync(process.env.WA_TEST_WASM));
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const imports=createHostImports({getMemory:()=>memory.buffer,renderer:null,resourceJson:{}});imports.host.memory=memory;let trace=false;const traceWords=[];imports.host.log_i32=value=>{if(trace){traceWords.push(value>>>0);}};imports.host.log=(ptr,len)=>{if(trace)console.log('WIN16',Buffer.from(memory.buffer,ptr,len).toString());};
  const raw=(await WebAssembly.instantiate(module,imports)).exports;
  const bytes=new Uint8Array(memory.buffer),view=new DataView(memory.buffer),fixture=neGuestCaller();
  bytes.set(fixture.bytes,raw.get_staging());raw.load_pe(fixture.bytes.length);raw.set_eip(fixture.entry);raw.set_esp(0x7408000);
  const snapshot=()=>[raw.get_eip(),raw.get_esp(),raw.get_sreg_cs(),raw.get_sreg_ds(),raw.get_sreg_ss(),raw.get_sync_msg_depth()];
  const original=snapshot(),events=[];let during,ds=0;
  const read=(offset)=>view.getUint16((raw.guest_to_wasm(raw.win16_seg_base(ds>>>3))>>>0)+offset,true);
  const e={...raw,
    win16_bridge_invoke_begin(...args){ds=args[2];events.push({target:args[1]&65535,before:read(14)});return raw.win16_bridge_invoke_begin(...args);},
    run(blocks){during?.();return raw.run(blocks);},
    win16_bridge_module_release_finish(id){events.push({final:read(14),attach:read(10),detach:read(12)});return raw.win16_bridge_module_release_finish(id);}};
  const life=createNeLifecycle(e,memory,[['DEMO',win4Image()]],{maxBlocks:10000});
  const id=life.load('DEMO');assert.deepEqual(snapshot(),original);
  assert.equal(read(10),1);assert.equal(read(14),2);
  assert.deepEqual(Array.from({length:8},(_,i)=>read(0x20+i*2)),[0,0,0,16,ds,ds,1,0]);
  assert.equal(read(0),ds);assert.equal(read(2),ds);assert.equal(read(4),16);
  const empty=createNeLifecycle(e,memory,[]);
  assert(empty.liveModule('DEMO'));assert.equal(read(10),1,'internal inspection is not a guest load');
  assert.equal(life.load('DEMO'),id);assert.equal(read(10),2);
  assert.deepEqual(Array.from({length:8},(_,i)=>read(0x20+i*2)),[0,0,0,16,ds,ds,1,0]);
  let handle=empty.retainGuest('DEMO');assert(handle>=32);assert.equal(read(10),3);
  empty.releaseGuest(handle);assert.equal(read(12),1);
  life.release(id);assert.equal(read(12),2);assert.equal(read(14),3);
  assert.deepEqual(Array.from({length:8},(_,i)=>read(0x20+i*2)),[0,0,0,16,ds,ds,0,0]);
  during=()=>{during=null;assert.throws(()=>life.load('DEMO'),/busy|notification/);assert.throws(()=>life.release(id),/busy|notification|rejected/);};
  life.release(id);assert.deepEqual(snapshot(),original);
  assert.deepEqual(events.at(-1),{final:4,attach:3,detach:3});assert.equal(life.lookup(id,'VALUE'),0);
  assert.deepEqual(events.filter(x=>x.target!==undefined).map(x=>x.target),[0,64,64,64,64,64,64,32]);
  assert.equal(life.load('DEMO'),id,'unloaded record reusable');life.release(id);
  const repeated=life.load('DEMO'),dataAddress=raw.guest_to_wasm(raw.win16_seg_base(ds>>>3))>>>0;
  view.setUint16(dataAddress+16,0,true);
  assert.throws(()=>life.load('DEMO'),/AX zero/);
  view.setUint16(dataAddress+16,1,true);
  life.release(repeated);assert(!life.liveModule('DEMO'),'failed repeated attach did not consume an existing reference');
  const detImage=win4Image({detachTrap:true}),detLife=createNeLifecycle(e,memory,[['DETTRAP',detImage]]),detId=detLife.load('DETTRAP');
  assert.throws(()=>detLife.release(detId));assert(detLife.lookup(detId,'VALUE'),'failed detach retains code and its reference');
  // Repair only our synthetic failing instruction to prove a retry owns the
  // same live image. Original/proprietary bytes are never modified.
  const frame=raw.win16_bridge_frame_begin();assert(frame);assert(raw.win16_bridge_scope_begin(frame));
  const detTarget=raw.win16_bridge_module_notify(detId,0),trapOffset=detImage.indexOf(Buffer.from([0x0f,0x0b]),0x240)-0x200;
  const trapAddress=raw.win16_seg_base(detTarget>>>19)+trapOffset;
  bytes.set([0x90,0x90],raw.guest_to_wasm(trapAddress));raw.invalidate_code_range(trapAddress,2);assert(raw.win16_bridge_frame_end(frame));
  detLife.release(detId);assert(!detLife.liveModule('DETTRAP'));assert.deepEqual(snapshot(),original);
  const legacyStart=events.length,legacy=createNeLifecycle(e,memory,[['LEGACY',win4Image({version:0x30a})]]);
  const legacyId=legacy.load('LEGACY');legacy.load('LEGACY');legacy.release(legacyId);legacy.release(legacyId);
  assert.deepEqual(events.slice(legacyStart).filter(x=>x.target!==undefined).map(x=>x.target),[0,32],'Win3 LibMain/WEP preserved even with a similarly named export');
  const optionalImage=win4Image();optionalImage[0x80+0x70+15]=88;
  const optionalStart=events.length,optional=createNeLifecycle(e,memory,[['OPTIONAL',optionalImage]]);
  const optionalId=optional.load('OPTIONAL');optional.load('OPTIONAL');
  assert(optional.liveModule('OPTIONAL'));
  optional.release(optionalId);optional.release(optionalId);
  assert.deepEqual(events.slice(optionalStart).filter(x=>x.target!==undefined).map(x=>x.target),[0,32],
    'Win4 without DllEntryPoint executes real LibMain and final WEP only');
  assert(!optional.liveModule('OPTIONAL'));assert.deepEqual(snapshot(),original);
  // A legacy NE DriverProc-shaped FAR PASCAL call keeps its own sixteen
  // argument bytes and AX return; it receives no Win4 notifications.
  const driverImage=win4Image({version:0x30a});
  driverImage.set([0x55,0x89,0xe5,0x8b,0x46,6,0x5d,0xca,16,0],0x210);
  const driverLife=createNeLifecycle(e,memory,[['DRIVER',driverImage]]),driverId=driverLife.load('DRIVER');
  assert.equal(driverLife.call(driverId,'VALUE',[0x4242,0,0x3333,0,0x22,0x11,0x5555,0]),0x4242);
  driverLife.release(driverId);assert.deepEqual(snapshot(),original);
  for(const [name,image,pattern] of [['ZERO',win4Image({attach:0}),/AX zero/],['TRAP',win4Image({trap:true}),/./],['STACK',win4Image({cleanup:14}),/./]]) {
    const start=events.length,broken=createNeLifecycle(e,memory,[[name,image]]);assert.throws(()=>broken.load(name),pattern);
    assert.deepEqual(events.slice(start).filter(x=>x.target!==undefined).map(x=>x.target),[0,64,32],'completed LibMain cleanup without detach for failed attach');
    assert.equal(broken.liveModule(name),false);assert.deepEqual(snapshot(),original);
    const repaired=createNeLifecycle(e,memory,[[name,win4Image()]]);const good=repaired.load(name);repaired.release(good);
  }
  const nonzero=createNeLifecycle(e,memory,[['NONZERO',win4Image({attach:0x8000})]]),nonzeroId=nonzero.load('NONZERO');
  nonzero.release(nonzeroId);assert.deepEqual(snapshot(),original);
  // Cancellation raised from a synchronous callback must rollback the owned
  // first-load record and restore the caller; no publication or fake success.
  const cancelStart=events.length,abort=new AbortController();during=()=>{if(events.at(-1)?.target!==64)return;during=null;abort.abort(new Error('cancel control'));};
  let cancelled;try{createNeLifecycle(e,memory,[['CANCEL',win4Image()]],{signal:abort.signal}).load('CANCEL');}catch(error){cancelled=error;}
  assert(cancelled);assert.match(String(cancelled)+String(cancelled.errors||''),/cancel control/);
  assert.deepEqual(events.slice(cancelStart).filter(x=>x.target!==undefined).map(x=>x.target),[0,64,64,32],'cancelled completed attach receives matching detach before WEP');
  assert(!empty.liveModule('CANCEL'));assert.deepEqual(snapshot(),original);

  const retainAbort=new AbortController(),retainCancel=createNeLifecycle(e,memory,[['CANCELREF',win4Image()]],{signal:retainAbort.signal});
  const cancelRefId=retainCancel.load('CANCELREF');
  during=()=>{during=null;retainAbort.abort(new Error('cancel repeated control'));};
  assert.throws(()=>retainCancel.load('CANCELREF'),/cancel repeated control/);
  assert.equal(read(10),2);assert.equal(read(12),1);assert(empty.liveModule('CANCELREF'));
  empty.release(cancelRefId);assert.deepEqual(events.at(-1),{final:4,attach:2,detach:2});assert.deepEqual(snapshot(),original);

  // Normal compiled PE IAT/EAT resolver path, on main and an actual
  // cooperative owner. Two loads, two frees, no host-created handles.
  async function local(owner) {
    owner.set_eip(fixture.entry);owner.set_esp(0x7408000);owner.guest_write32(0x7408000,0);
    let notices=0;
    const facade=new Proxy({}, {get(_target,name){if(name==='win16_bridge_module_notify')return (...args)=>{if(args[1]===0)notices++;return owner.win16_bridge_module_notify(...args);};return owner[name];}});
    for(let i=0;i<50;i++) {
      facade.run(1000);
      if(facade.get_yield_reason()===18)assert(serviceLoadLibraryYieldSync({exports:facade,memoryBuffer:memory.buffer,findDllSync:()=>win4Image()}));
      else assert.equal(facade.get_yield_reason(),0);
      if(!facade.get_eip())break;assert(i<49);
    }
    assert.equal(owner.get_esp(),0x7408004);assert.equal(notices,4);
  }
  await local(raw);
  const secondary=(await WebAssembly.instantiate(module,imports)).exports;
  secondary.init_thread(1,raw.get_image_base(),raw.get_code_start(),raw.get_code_end(),raw.get_thunk_base(),raw.get_thunk_end(),raw.get_num_thunks(),0);
  const manager=new ThreadManager(module,memory,{exports:raw},()=>imports,{}),thread={instance:{exports:secondary},state:'active',tid:1};
  manager.threads=new Map([[123,thread]]);manager._runningThreadHandle=0;
  const facade=manager.cooperativeCallbackExports(thread);await local(facade);
  thread.state='exited';assert.throws(()=>createNeLifecycle(facade,memory,[['DEMO',win4Image()]]).load('DEMO'),/retired/);

  for(const mode of ['normal','cancel']) {
    let started,release;const pending=new Promise(r=>started=r),gate=new Promise(r=>release=r);
    const host=new GuestThreadHost({memory,module,hostImports:imports.host,sigs:require('../lib/host-import-sigs.generated.json').sigs,
      workerUrl:path.resolve(__dirname,'../lib/guest-worker.js'),clockIntervalMs:0,
      findDll:async()=>{if(mode==='cancel'){started();await gate;}return win4Image();},log:()=>{}});
    try {
      await host.start();await host.loadPe(fixture.bytes,'win4-caller.exe');await host.callExport('set_esp',0x7408000);await host.callExport('guest_write32',0x7408000,0);await host.callExport('set_eip',fixture.entry);
      const running=host.link.slice(1000);const failure=running.then(()=>null,error=>error);
      if(mode==='cancel'){await pending;await host.stop();release();assert(await failure);}
      else {assert.equal(await failure,null);for(let i=0;i<30;i++){if(!await host.callExport('get_eip'))break;const result=await host.link.slice(1000);assert(!result.trapped);assert(i<29);}assert.equal(await host.callExport('get_esp'),0x7408004);}
    } finally {release?.();await host.stop();}
  }
  if(process.env.WA_WIN4_COMPANION) {
    const source=fs.readFileSync(process.env.WA_WIN4_COMPANION);
    assert.equal(source.length,155136);assert.equal(crypto.createHash('sha256').update(source).digest('hex'),'39bbfafa8b759ebfcf6a00ee878fa494581a9144891bbd788bded61441de13f9');
    assert.equal(inspectNeDll(source).dllEntryOrdinal,300);
    const original=neGuestCaller(0x400000,{path:'COMMCTRL.DLL',calls:[[35,[0x402840]]]});
    bytes.set(original.bytes,raw.get_staging());raw.load_pe(original.bytes.length);raw.set_eip(original.entry);raw.set_esp(0x7408000);
    trace=true;raw.set_win16_trace(1);raw.run(1000);assert.equal(raw.get_yield_reason(),18);
    const before=[raw.get_eip(),raw.get_esp()],entries=[],resolved=[];
    const owner={...raw,win16_bridge_invoke_begin(...args){entries.push(args[1]&65535);return raw.win16_bridge_invoke_begin(...args);}};
    let failure;try{serviceLoadLibraryYieldSync({exports:owner,memoryBuffer:memory.buffer,findDllSync:(file,full)=>{resolved.push([file,full]);return source;}});}catch(error){failure=error;}
    assert(failure instanceof WebAssembly.RuntimeError);assert.deepEqual(entries,[0],'genuine LibMain traps before the exported notification');const marker=traceWords.lastIndexOf(0xca16a9f1);assert(marker>=0);assert.equal(traceWords[marker+1],0x20119,'actual unsupported USER ordinal 281');assert.deepEqual([raw.get_eip(),raw.get_esp()],before);
    assert.deepEqual(resolved,[['commctrl.dll','COMMCTRL.DLL']]);
    assert(!createNeLifecycle(raw,memory,[]).liveModule('COMMCTRL'));
    console.log('GENUINE partial initialization boundary:',failure.message,JSON.stringify({entries,resolved,unsupportedKey:traceWords[marker+1],returnLinear:traceWords[marker+2],exportedEntryReached:false}));
  }
  console.log('PASS compiled Win4 six-argument notifications, every reference, rollback, reentrancy, local/cooperative/Worker and retired owners');
}
if(require.main===module)(async()=>{staticControls();if(process.env.WA_TEST_WASM)await compiledControls();else console.log('PASS Win4 image controls (compiled controls require WA_TEST_WASM)');})().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={win4Image};
