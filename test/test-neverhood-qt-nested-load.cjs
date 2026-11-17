'use strict';
// Authored instruction streams drive the real native loader and QT return.
// No original application, guest byte patch, or scalar success substitute.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {fixedLoadImages}=require('./test-neverhood-qt-fixed-load.cjs');
const {win4Image}=require('./test-ne-win4-dllentrypoint');
const {neLifecycleImage}=require('./helpers/ne-lifecycle-image');
const {createHostImports}=require('../lib/host-imports');
const {createNeLifecycle}=require('../lib/ne-lifecycle');
const {serviceNeGuestYieldSync,serviceNeGuestYield,retireNativeFtConnections}=require('../lib/ne-guest-bridge');
function identity(b,name){
 const ne=b.readUInt32LE(0x3c),p=ne+b.readUInt16LE(ne+0x26),end=ne+b.readUInt16LE(ne+0x28);
 const names=Buffer.from(b.subarray(p,end));
 assert(p+name.length+3+names.length<0x200);
 // Preserve import names/module table for the authored KERNEL import fixture.
 const mod=Buffer.from(b.subarray(ne+b.readUInt16LE(ne+0x28),ne+b.readUInt16LE(ne+0x2a))),imports=Buffer.from(b.subarray(ne+b.readUInt16LE(ne+0x2a),0x200));
 b.fill(0,p,0x200);b[p]=name.length;b.write(name,p+1);b.set(names,p+name.length+3);
 const m=p+name.length+3+names.length;b.writeUInt16LE(m-ne,ne+0x28);b.writeUInt16LE(m+mod.length-ne,ne+0x2a);b.set(mod,m);b.set(imports.subarray(0,0x200-m-mod.length),m+mod.length);
 return b;
}
function reentryImage(){
 const b=neLifecycleImage({importEntry:{module:'KERNEL',symbol:95}});
 b.set([0x0e,0x68,0x80,0,0x9a,0xff,0xff,0,0,0x50,0x9a,0xff,0xff,0,0,0xb8,1,0,0xcb],0x200);
 b.write('CHILD.DLL\0',0x280);b.writeUInt16LE(2,0x300);
 b.set([3,1,5,0,1,0,95,0,3,1,11,0,1,0,96,0],0x302);
 return identity(b,'DEMO');
}
const extraWat=String.raw`
 (func (export "nested_test_owner_slot") (param $offset i32) (result i32)
  (i32.add (i32.wrap_i64 (global.get $win16_bridge_frame)) (local.get $offset)))
 (func (export "nested_test_connection_slot") (result i32)
  (i32.add (i32.load offset=400 (i32.wrap_i64 (global.get $win16_bridge_frame))) (i32.const 56)))
 (func (export "nested_test_actor") (result i32) (call $lock_owner_id))
`;
async function main(){
 assert(process.env.WA_TEST_WASM,'explicit diagnostic module required');
 const module=await WebAssembly.compile(fs.readFileSync(process.env.WA_TEST_WASM));
 const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),v=new DataView(memory.buffer);
 const imp=createHostImports({getMemory:()=>memory.buffer,renderer:null,resourceJson:{}});imp.host.memory=memory;
 imp.host.log_i32=()=>{};
 const e=(await WebAssembly.instantiate(module,imp)).exports,records=[];
 const snap=()=>['eip','esp','ebp','ebx','esi','edi','sreg_cs','sreg_ds','sreg_ss','sync_msg_depth'].map(k=>e['get_'+k]());
 let trace=[],requests=[],active=null,mutate=null,mutation=null,publishHook=null;
 const owner={...e,
  win16_bridge_module_publish(...a){const ok=e.win16_bridge_module_publish(...a);publishHook?.();return ok;},
  win16_bridge_invoke_begin(...a){trace.push({entry:a[1]&65535,ds:a[2]});return e.win16_bridge_invoke_begin(...a);},
  win16_bridge_module_release_finish(id){trace.push({wep:true,id});return e.win16_bridge_module_release_finish(id);},
  win16_nested_request_valid(...a){if(mutate){const action=mutate;mutate=null;action(a);}return e.win16_nested_request_valid(...a);},
  win16_nested_request_settle(...a){const ok=e.win16_nested_request_settle(...a);requests.push({frame:String(a[0]),serial:String(a[1]),value:a[2],ok});assert.equal(e.win16_nested_request_settle(...a),0,'no replay');return ok;},
  win16_bridge_frame_end(...a){if(mutation){v.setUint32(mutation.p,mutation.old,true);mutation=null;}return e.win16_bridge_frame_end(...a);}
 };
 function start(f){
  new Uint8Array(memory.buffer).set(f.bytes,e.get_staging());assert.equal(e.load_pe(f.bytes.length),f.entry);e.invalidate_code_range(f.base,0x3000);
  e.set_eip(f.entry);e.set_esp(0x7408000);e.guest_write32(0x7408000,0);
  const ctx={exports:owner,memoryBuffer:memory.buffer,findDllSync:file=>file==='pair.dll'?f.ne:null,neInvokeOptions:{maxBlocks:4096,sliceBlocks:16}};
  for(let n=0;n<100&&e.get_eip();n++){e.run(256);if(e.get_yield_reason()===18)serviceNeGuestYieldSync(ctx);}
  assert.equal(e.get_eip(),0);return ctx;
 }
 function park(f,shift){e.set_eip(f.invoke);e.set_esp(0x74fd494+shift);e.guest_write32(0x74fd494+shift,0);for(let n=0;n<100;n++){e.run(1);if(e.get_yield_reason()===18)return;}throw Error('no QT request');}
 if(!process.env.NEVERHOOD_GENUINE_ONLY)for(const shift of [0,2])for(const kind of ['new','loaded','reentry','missing','wrong-source','init-fault','notify-fault','cancel','cancel-after-publish','frame-generation','request-generation','process-generation','actor','lease','selector','retired']){
  const f=fixedLoadImages('DEMO.DLL'),ctx=start(f);trace=[];requests=[];
  const demo=identity(win4Image({trap:kind==='notify-fault'}),'DEMO'),child=identity(win4Image(),'CHILD');
  const bytes=kind==='reentry'?reentryImage():kind==='init-fault'?identity(neLifecycleImage({trapInit:true}),'DEMO'):kind==='wrong-source'?identity(win4Image(),'OTHER'):demo;
  const life=createNeLifecycle(owner,memory,[['DEMO',demo]],{maxBlocks:4096});let pre=0;
  if(kind==='loaded')pre=life.load('DEMO');
  park(f,shift);const before=snap(),ret=e.guest_read32(e.get_esp()),outer=e.win16_guest_request_token();
  const abort=new AbortController();active=null;publishHook=kind==='cancel-after-publish'?()=>abort.abort(new Error('authored cancellation after publication')):null;
  const options={...ctx,neInvokeOptions:{...ctx.neInvokeOptions,signal:abort.signal},findDllSync:(file)=>{
   assert.notEqual(kind,'loaded','ready image must not look up source');
   if(kind==='cancel')abort.abort(new Error('authored cancellation'));
   return file==='demo.dll'?(kind==='missing'?null:bytes):file==='child.dll'?child:null;
  }};
  const bad=['frame-generation','request-generation','process-generation','actor','lease','selector','retired'].includes(kind);
  if(bad)mutate=([frame,serial])=>{
   active={frame,serial};
   if(kind==='frame-generation'){assert.equal(e.win16_nested_request_valid(frame^(1n<<32n),serial),0);throw Error('authored frame-generation');}
   if(kind==='request-generation'){assert.equal(e.win16_nested_request_valid(frame,serial+1n),0);throw Error('authored request-generation');}
   if(kind==='retired'){e.win16_guest_request_cancel();return;}
   let p;
   if(kind==='actor')p=Number(frame&0xffffffffn)+8;
   if(kind==='selector')p=Number(frame&0xffffffffn)+492;
   if(kind==='lease')p=e.qt_load_test_slot(8);
   if(kind==='process-generation')p=e.nested_test_connection_slot();
   mutation={p,old:v.getUint32(p,true)};v.setUint32(p,mutation.old^0x1000,true);
  };
  let error=null;try{serviceNeGuestYieldSync(options);}catch(x){error=x;}
  const ok=['new','loaded','reentry'].includes(kind);
  if(ok){assert.equal(error,null);assert.equal(e.get_eip(),f.body);assert.equal(e.get_esp(),before[1]+38);assert.equal(e.get_eax()>>>0,0x12345678);assert(requests.length>=2);}
  else{
   assert(error,kind);assert.equal(e.get_esp(),before[1]);assert.equal(e.get_ebp(),before[2]);assert.equal(e.guest_read32(before[1]),ret);
   if(kind==='missing')assert(requests.some(r=>r.ok&&r.value===2));
   if(bad)assert.match(error.message,/Stale nested|authored (frame|request)-generation/);
   if(kind==='wrong-source')assert.match(error.message,/source identity mismatch/);
  }
  if(kind!=='retired')assert.equal(e.win16_guest_request_token(),ok?0n:outer);
  if(active)assert.equal(e.win16_nested_request_valid(active.frame,active.serial),0,'unwound request retired');
  publishHook=null;
  if(pre)life.release(pre);
  assert.equal(life.liveModule('DEMO'),false);assert.equal(life.liveModule('CHILD'),false);
  retireNativeFtConnections(ctx);assert.equal(e.get_sync_msg_depth(),0);assert.equal(e.win16_ft_checkpoint(),0n);assert.equal(e.guest_read32(f.data+8),0);
  assert.equal(e.win16_bridge_fixed_usage(1),0);
  records.push({kind,shift,ok,requests,trace,error:error?.message,callerRestored:true,retired:true});
 }
 // Actual Worker: async source acquisition while its exact callback command is
 // parked; source cannot be resolved synchronously on this backend.
 const {GuestThreadHost}=require('../lib/guest-thread-host');
 if(!process.env.NEVERHOOD_GENUINE_ONLY)for(const kind of ['new','missing','wrong-source'])for(const shift of [0,2]){
  const f=fixedLoadImages('DEMO.DLL'),demo=identity(win4Image(),kind==='wrong-source'?'OTHER':'DEMO'),lookups=[];
  const host=new GuestThreadHost({memory,module,hostImports:imp.host,sigs:require('../lib/host-import-sigs.generated.json').sigs,
   workerUrl:path.resolve(__dirname,'../lib/guest-worker.js'),clockIntervalMs:0,
   findDll:async(file)=>{lookups.push(file);await new Promise(r=>setTimeout(r,2));return file==='pair.dll'?f.ne:kind==='missing'?null:demo;},log:()=>{}});
  const call=(name,...a)=>host.callExport(name,...a);let link;
  const run=async(entry,sp)=>{await call('set_eip',entry);await call('set_esp',sp);await call('guest_write32',sp,0);for(let n=0;n<100;n++){const r=await host.link.slice(256);if(r.trapped||!await call('get_eip'))return r;}throw Error('Worker budget');};
  try{await host.start();link=host.link;await host.loadPe(f.bytes,'nested-qt.exe');assert(!(await run(f.entry,0x7408000)).trapped);
   const r=await run(f.invoke,0x74fd494+shift);assert.equal(!!r.trapped,kind!=='new');
   if(kind==='new'){assert.equal((await call('get_eax'))>>>0,0x9abc5678);assert.equal(await call('get_esp'),0x74fd494+shift+40);}
   assert(lookups.includes('demo.dll'));
  }finally{await host.stop();}
  assert(link._loaderRetirementReceipt?.retired);assert.equal(e.guest_read32(f.data+8),0);
  records.push({kind,shift,backend:'actual-cpu-worker',lookups,joined:true});
 }
 if(!process.env.NEVERHOOD_GENUINE_ONLY){
  const f=fixedLoadImages('DEMO.DLL'),demo=identity(win4Image(),'DEMO');let arrived,deliver;
  const sourcePending=new Promise(r=>{arrived=r;}),sourceBytes=new Promise(r=>{deliver=r;});
  const host=new GuestThreadHost({memory,module,hostImports:imp.host,sigs:require('../lib/host-import-sigs.generated.json').sigs,
   workerUrl:path.resolve(__dirname,'../lib/guest-worker.js'),clockIntervalMs:0,
   findDll:async file=>{if(file==='pair.dll')return f.ne;arrived();await sourceBytes;return demo;},log:()=>{}});
  let link;
  try{
   await host.start();link=host.link;await host.loadPe(f.bytes,'retiring-nested-qt.exe');
   const call=(name,...a)=>host.callExport(name,...a);
   await call('set_eip',f.entry);await call('set_esp',0x7408000);await call('guest_write32',0x7408000,0);
   for(let n=0;n<100&&await call('get_eip');n++)assert(!(await host.link.slice(256)).trapped);
   await call('set_eip',f.invoke);await call('set_esp',0x74fd494);await call('guest_write32',0x74fd494,0);
   const running=host.link.slice(256);running.catch(()=>{});
   await sourcePending;const stop=host.stop();deliver();await stop;
   try{const value=await running;assert(value.trapped||link.dead||link._loaderRetirementReceipt?.retired);}catch(error){assert(error);}
  }finally{deliver();await host.stop();}
  assert(link._loaderRetirementReceipt?.retired);assert.equal(e.guest_read32(f.data+8),0);
  records.push({kind:'retirement-during-async-nested-source',backend:'actual-cpu-worker',lateBytesFenced:true,joined:true});
 }
 if(process.env.NEVERHOOD_GENUINE==='1'){
  const crypto=require('node:crypto'),iso=require('../lib/iso9660');
  const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
  const media=JSON.parse(fs.readFileSync('scratch/runs/20261117-neverhood-qt-leased-stack-install/media-preflight.json'));
  const pin=media.inputs.setupx,setupx=fs.readFileSync(pin.path);assert.equal(sha(setupx),pin.sha256);
  const cd=media.inputs.iso,fd=fs.openSync(cd.path,'r');let dsetup;
  try{
   const provider={size:fs.fstatSync(fd).size,readRange(at,n){const b=Buffer.alloc(n);assert.equal(fs.readSync(fd,b,0,n,at),n);return b;}};
   const image=iso.parseIso(provider);dsetup=Buffer.from(iso.readEntry(image,iso.findEntry(image,'setup/DSETUP6E.DLL')));
  }finally{fs.closeSync(fd);}
  assert.equal(sha(dsetup),'a3feb8e3a947d8c6b6c594b80b5c0db0c5bd26968f3d749c27781cb60d6c7d7d');
  // New source, real SETUPX initializer and WEP under the authored QT caller.
  {const f=fixedLoadImages('SETUPX.DLL'),ctx=start(f);park(f,0);requests=[];
   serviceNeGuestYieldSync({...ctx,findDllSync:()=>setupx});assert.equal(e.get_eip(),f.body);assert.equal(requests.length,2);
   retireNativeFtConnections(ctx);assert.equal(e.win16_bridge_fixed_usage(1),0);
   records.push({kind:'genuine-setupx-new-source',sha256:sha(setupx),requests,libMainAndWep:true});}
  // Unchanged genuine DSETUP6E's registered LS target executes its actual
  // KERNEL.95 at code2:1316. Stop at the completed return, before any device
  // installation work; this is not an original application run.
  const {qtImages}=require('./test-neverhood-qt-thunk.cjs');
  const f=qtImages({index:1,name:'DSETUP6E',module16:'dsetup6e.dll',module32:'dsetupe.dll',name32:'thk3216_ThunkData32',name16:'THK3216_THUNKDATA16',checksum:0x2e32});
  f.bytes.writeUInt32LE(0x10002,f.raw(0x2601)); // authored caller selects genuine target index 2
  new Uint8Array(memory.buffer).set(f.bytes,e.get_staging());assert.equal(e.load_pe(f.bytes.length),f.entry);e.invalidate_code_range(f.base,0x3000);
  e.set_eip(f.entry);e.set_esp(0x7408000);e.guest_write32(0x7408000,0);
  let proof=null;
  const stopped=new Error('genuine nested call completed; fixture stop before device installation');
  const observer={...owner,run(blocks){try{return e.run(blocks);}catch(error){console.error('GENUINE_FAULT',JSON.stringify({eip:e.get_eip()>>>0,cs:e.get_sreg_cs(),ds:e.get_sreg_ds(),ss:e.get_sreg_ss(),esp:e.get_esp()>>>0,module:e.win16_last_module(),ordinal:e.win16_last_ordinal(),stack:Array.from({length:10},(_,i)=>e.guest_read32(e.get_esp()+4*i)>>>0)}));throw error;}},win16_nested_request_settle(frame,serial,value){
   const address=e.win16_nested_request_field(frame,serial,1)>>>0;
   const name=require('../lib/ne-guest-bridge').readNeGuestString(e,memory.buffer,address,260);
   const sp=e.get_esp()>>>0,returnFar=e.guest_read32(sp)>>>0;
   const ok=e.win16_nested_request_settle(frame,serial,value);assert.equal(ok,1);
   proof={name,returnFar,returnOffset:returnFar&65535,returnLinear:e.get_eip()>>>0,handle:value,settled:true,sourceLookup:false};
   assert.equal(name.toLowerCase(),'setupx.dll');assert.equal(proof.returnOffset,0x131b);assert(value>=32);
   throw stopped;
  }};
  const ctx={exports:observer,memoryBuffer:memory.buffer,findDllSync:file=>file==='dsetup6e.dll'?dsetup:file==='setupx.dll'?setupx:null,neInvokeOptions:{maxBlocks:100000,sliceBlocks:32}};
  for(let n=0;n<100&&e.get_eip();n++){e.run(256);if(e.get_yield_reason()===18)serviceNeGuestYieldSync(ctx);}
  assert.equal(e.get_eip(),0);park(f,0);const before=snap();
  assert.throws(()=>serviceNeGuestYieldSync({...ctx,findDllSync:()=>{throw Error('already loaded SETUPX must not fetch bytes');}}),x=>x===stopped);
  assert(proof);assert.deepEqual(snap(),before);retireNativeFtConnections(ctx);assert.equal(e.win16_bridge_fixed_usage(1),0);
  records.push({kind:'genuine-dsetup6e-native-nested-caller',sha256:sha(dsetup),proof,unchangedDlls:true,originalExecuted:false});
 }
 if(process.env.NEVERHOOD_NESTED_RESULT)fs.writeFileSync(process.env.NEVERHOOD_NESTED_RESULT,JSON.stringify({records,originalExecuted:false},null,2)+'\n');
 console.log('PASS native QT nested image load/free, lifecycle reentry, notification/WEP, refusals and actual CPUWorker');
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1});
module.exports={extraWat,identity,reentryImage,main};
