'use strict';
// Authored PE/NE instructions only; no game process or proprietary byte patch.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {qtImages}=require('./test-neverhood-qt-thunk.cjs');
const {createHostImports}=require('../lib/host-imports');
const {serviceNeGuestYieldSync,retireNativeFtConnections}=require('../lib/ne-guest-bridge');
const word=n=>[n&255,n>>>8&255];
function fixedLoadImages(name){
 const f=qtImages({index:0});
 const code=[0x0e,0x68,...word(0x560),0x9a,0xff,0xff,0,0,
  0x83,0xf8,0x20,0x73,2,0x0f,0x0b,0x50,0x9a,0xff,0xff,0,0,
  0x66,0xb8,0x78,0x56,0x34,0x12,0x66,0xba,0xbc,0x9a,0,0,0xca,34,0];
 f.ne.set(code,0x380);f.ne.write(name+'\0',0x760);f.ne.writeUInt16LE(3,0x800);
 f.ne.set([3,1,...word(0x185),1,0,95,0],0x80a);
 f.ne.set([3,1,...word(0x192),1,0,96,0],0x812);
 return f;
}
const extraWat=String.raw`
 (func (export "qt_load_test_slot") (param $kind i32) (result i32)
  (local $f i32) (local $d i32) (local $i i32) (local $r i32)
  (local.set $f (i32.wrap_i64 (global.get $win16_bridge_frame)))
  (local.set $d (i32.add (global.get $WIN16_SEG_TABLE) (i32.shl (i32.load offset=12 (local.get $f)) (i32.const 4))))
  (if (i32.eq (local.get $kind) (i32.const 10)) (then (return (local.get $d))))
  (if (i32.eq (local.get $kind) (i32.const 1)) (then (return (i32.add (local.get $f) (i32.const 352)))))
  (if (i32.eq (local.get $kind) (i32.const 2)) (then (return (i32.add (local.get $f) (i32.const 24)))))
  (if (i32.le_u (local.get $kind) (i32.const 5))
   (then (return (i32.add (local.get $d) (i32.shl (i32.sub (local.get $kind) (i32.const 3)) (i32.const 2))))))
  (loop $leases
   (local.set $r (call $virtual_map_lease_record (local.get $i)))
   (if (i64.eq (i64.load (local.get $r)) (global.get $win16_bridge_frame))
    (then (return (i32.add (local.get $r) (i32.shl (i32.sub (local.get $kind) (i32.const 6)) (i32.const 2))))))
   (local.set $i (i32.add (local.get $i) (i32.const 1)))
   (br_if $leases (i32.lt_u (local.get $i) (i32.const 16))))
  (unreachable))
 (func (export "qt_load_test_arena") (result i32) (call $win16_arena_slot_base (i32.const 2)))
`;
async function main(){
 assert(process.env.WA_TEST_WASM,'explicit immutable diagnostic module required');
 const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),words=[];
 const imports=createHostImports({getMemory:()=>memory.buffer,renderer:null,resourceJson:{}});
 imports.host.memory=memory;imports.host.log_i32=n=>words.push(n>>>0);
 const module=await WebAssembly.compile(fs.readFileSync(process.env.WA_TEST_WASM));
 const e=(await WebAssembly.instantiate(module,imports)).exports;
 const view=new DataView(memory.buffer),records=[];let mutation=null;
 const restore=()=>{if(mutation){view.setUint32(mutation.ptr,mutation.old,true);mutation=null;}};
 const owner={...e,win16_bridge_qt_begin(...args){
  const result=e.win16_bridge_qt_begin(...args);
  if(result&&activeMutation){const ptr=e.qt_load_test_slot(activeMutation),old=view.getUint32(ptr,true);mutation={ptr,old};view.setUint32(ptr,activeMutation===2?0:activeMutation===10?e.qt_load_test_arena():old^0x1000,true);}
  return result;
 },win16_bridge_frame_end(...args){restore();return e.win16_bridge_frame_end(...args);}};
 const ctx={exports:owner,memoryBuffer:memory.buffer};let activeMutation=0;
 const cases=[...['KERNEL','KRNL386.EXE','SETUPX.DLL','NEAR-KERNEL.DLL'].map(name=>({name,mutation:0})),
  ...[1,2,3,4,5,6,7,8,9,10].map(mutation=>({name:'KERNEL',mutation}))];
 for(const shift of [0,2])for(const item of cases){
  const {name}=item;activeMutation=0;
  const f=fixedLoadImages(name);
  new Uint8Array(memory.buffer).set(f.bytes,e.get_staging());assert.equal(e.load_pe(f.bytes.length),f.entry);
  e.invalidate_code_range(f.base,0x3000);e.set_eip(f.entry);e.set_esp(0x7408000);e.guest_write32(0x7408000,0);
  const service=()=>serviceNeGuestYieldSync({...ctx,findDllSync:()=>f.ne,neInvokeOptions:{maxBlocks:4096,sliceBlocks:32}});
  for(let n=0;n<100&&e.get_eip();n++){e.run(256);if(e.get_yield_reason()===18)assert(service());else assert.equal(e.get_yield_reason(),0);}
  assert.equal(e.get_eip(),0);const usage=e.win16_bridge_fixed_usage(1);
  e.set_eip(f.invoke);e.set_esp(0x74fd494+shift);e.guest_write32(0x74fd494+shift,0);
  for(let n=0;n<100;n++){e.run(1);if(e.get_yield_reason()===18)break;}
  assert.equal(e.win16_guest_request_field(e.win16_guest_request_token(),0),4);
  const saved={esp:e.get_esp(),ebp:e.get_ebp()},ret=e.guest_read32(saved.esp);
  words.length=0;activeMutation=item.mutation;
  const allowed=!activeMutation&&(name==='KERNEL'||name==='KRNL386.EXE');
  if(allowed){assert(service());assert.equal(e.get_eip(),f.body);assert.equal(e.get_esp(),saved.esp+38);}
  else{assert.throws(service,WebAssembly.RuntimeError);assert(words.includes(95),'native KERNEL95 refusal reached');assert.equal(e.get_esp(),saved.esp);assert.equal(e.get_ebp(),saved.ebp);assert.equal(e.guest_read32(saved.esp),ret);}
  assert.equal(e.win16_bridge_fixed_usage(1),usage,'balanced references after return/refusal');
  assert.equal(e.win16_ft_checkpoint(),0n);assert.equal(e.get_sync_msg_depth(),0);assert.equal(mutation,null);
  retireNativeFtConnections(ctx);assert.equal(e.guest_read32(f.data+8),0);
  records.push({...item,shift,allowed,restored:true,balancedReferences:true});
 }
 const {GuestThreadHost}=require('../lib/guest-thread-host'),path=require('node:path');
 for(const name of ['KERNEL','KRNL386.EXE','SETUPX.DLL'])for(const shift of [0,2]){
  const f=fixedLoadImages(name),host=new GuestThreadHost({memory,module,hostImports:imports.host,
   sigs:require('../lib/host-import-sigs.generated.json').sigs,workerUrl:path.resolve(__dirname,'../lib/guest-worker.js'),
   clockIntervalMs:0,findDll:async()=>f.ne,log:()=>{}});
  const remote=(name,...args)=>host.callExport(name,...args);
  const run=async(entry,stack)=>{
   await remote('set_eip',entry);await remote('set_esp',stack);await remote('guest_write32',stack,0);
   for(let n=0;n<100;n++){const r=await host.link.slice(256);if(r.trapped||!await remote('get_eip'))return r;}
   throw Error('authored QT fixed-load Worker budget');
  };
  let link;
  try{
   await host.start();link=host.link;await host.loadPe(f.bytes,'authored-qt-fixed-load.exe');
   assert(!(await run(f.entry,0x7408000)).trapped);
   const usage=await remote('win16_bridge_fixed_usage',1),r=await run(f.invoke,0x74fd494+shift);
   if(name==='SETUPX.DLL')assert(r.trapped);else{
    assert(!r.trapped);assert.equal((await remote('get_eax'))>>>0,0x9abc5678);
    assert.equal(await remote('get_esp'),0x74fd494+shift+40);
   }
   // A Worker fault retires its connection immediately, including the NE's
   // imported KERNEL reference; successful calls keep that connection live.
   assert.equal(await remote('win16_bridge_fixed_usage',1),name==='SETUPX.DLL'?0:usage);
  }finally{await host.stop();}
  assert(link._loaderRetirementReceipt?.retired);assert.equal(e.guest_read32(f.data+8),0);
  records.push({name,shift,kind:'actual-cpu-worker',allowed:name!=='SETUPX.DLL',joined:true});
 }
 if(process.env.NEVERHOOD_LOAD_RESULT)fs.writeFileSync(process.env.NEVERHOOD_LOAD_RESULT,JSON.stringify({records,originalExecuted:false},null,2)+'\n');
 console.log('PASS native packed QT fixed LoadLibrary/FreeLibrary, alias/frame/descriptor/lease mutations and nonfixed refusal');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
module.exports={extraWat,main,fixedLoadImages};
