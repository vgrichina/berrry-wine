#!/usr/bin/env node
'use strict';
// Real native dispatch across two instances sharing memory. A contended API
// must retry without popping arguments or blocking its host event loop.
const assert=require('node:assert/strict');
const {Worker}=require('node:worker_threads');
const {bootRenderHarness}=require('./render-helper');
const api=require('../src/api_table.json');
// A new persistent frontend field must survive CPU instance handoff too.
const source=require('node:fs').readFileSync(require('node:path').join(__dirname,'../src/09akg-d3d9-gps.wat'),'utf8');
const fields=[...source.matchAll(/\(global \$(\w+) \(mut (\w+)\)/g)].map(m=>[m[1],m[2]]);
const layout=source.slice(source.indexOf('(layout D3d9GpsState'),source.indexOf('(func $d9g_state_load'));
assert.deepEqual([...layout.matchAll(/\(field (\w+) (\w+)\)/g)].map(m=>[m[1],m[2]]),fields,'every persistent D3D9 GPS field is process owned');
const id=api.findIndex(a=>a.name==='IDirect3DDevice9_GetAvailableTextureMem');
const extraWat=`
 (func (export "guard_host_seed") (param $nested i32)
   (global.set $api_io_retry (i32.const 100))
   (global.set $handler_set_eip (i32.const 101))
   (global.set $eip (i32.const 102))
   (global.set $current_thunk_eip (i32.const 103))
   (global.set $yield_flag (i32.const 104))
   (global.set $yield_reason (i32.const 105))
   (global.set $steps (i32.const 106))
   (global.set $eflags_extra (i32.const 107))
   (global.set $df (i32.const 108))
   (global.set $flag_op (i32.const 109))
   (global.set $flag_a (i32.const 110))
   (global.set $flag_b (i32.const 111))
   (global.set $flag_res (i32.const 112))
   (global.set $saved_cf (i32.const 113))
   (global.set $flag_sign_shift (i32.const 114))
   (global.set $sync_msg_depth (local.get $nested)))
 (func (export "guard_host_state") (param $p i32)
   (i32.store offset=0 (local.get $p) (global.get $api_io_retry))
   (i32.store offset=4 (local.get $p) (global.get $handler_set_eip))
   (i32.store offset=8 (local.get $p) (global.get $eip))
   (i32.store offset=12 (local.get $p) (global.get $current_thunk_eip))
   (i32.store offset=16 (local.get $p) (global.get $yield_flag))
   (i32.store offset=20 (local.get $p) (global.get $yield_reason))
   (i32.store offset=24 (local.get $p) (global.get $steps))
   (i32.store offset=28 (local.get $p) (global.get $eflags_extra))
   (i32.store offset=32 (local.get $p) (global.get $df))
   (i32.store offset=36 (local.get $p) (global.get $flag_op))
   (i32.store offset=40 (local.get $p) (global.get $flag_a))
   (i32.store offset=44 (local.get $p) (global.get $flag_b))
   (i32.store offset=48 (local.get $p) (global.get $flag_res))
   (i32.store offset=52 (local.get $p) (global.get $saved_cf))
   (i32.store offset=56 (local.get $p) (global.get $flag_sign_shift))
   (i32.store offset=60 (local.get $p) (global.get $sync_msg_depth))
)
 (func (export "guard_gps_ring") (result i32) (global.get $d9g_h))
 (func (export "guard_gps_frame") (result i32) (global.get $d9g_frame))
 (func (export "guard_gps_create") (result i32)
   (local $id i32)
   (if (i32.eqz (call $d3d_state_try_enter)) (then (return (i32.const 0))))
   (drop (call $d9g_open))
   (local.set $id (call $d9g_id))
   (call $gps_create (global.get $d9g_h) (local.get $id) (global.get $GPS_KIND_RT)
     (global.get $GPS_FMT_A8B8G8R8) (i32.const 1) (i32.const 1) (i32.const 1) (i32.const 0))
   (global.set $d9g_frame (i32.add (global.get $d9g_frame) (i32.const 1)))
   (call $d3d_state_leave) (local.get $id))
 (func (export "guard_init") (param $regs i32)
   (global.set $reg_base (local.get $regs))
   (global.set $current_thunk_eip (i32.const 123456)))
 (func (export "guard_enter") (result i32) (call $d3d_state_try_enter))
 (func (export "guard_leave") (call $d3d_state_leave))
 (func (export "guard_dispatch")
   (global.set $yield_reason (i32.const 0))
   (global.set $handler_set_eip (i32.const 0))
   (i32.store (global.get $reg_base) (i32.const 123))
   (i32.store offset=16 (global.get $reg_base) (i32.const 7000000))
   (call $dispatch_api_table (i32.const ${id}) (i32.const 0) (i32.const 0)
     (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
 (func (export "guard_retry") (result i32) (global.get $handler_set_eip))
 (func (export "guard_pair") (param $p i32) (param $value i32) (result i32)
   (local $i i32)
   (if (i32.eqz (call $d3d_state_try_enter)) (then (return (i32.const 0))))
   (if (i32.ne (i32.load (local.get $p)) (i32.load offset=4 (local.get $p))) (then (unreachable)))
   (i32.store (local.get $p) (local.get $value))
   (loop $delay
     (local.set $i (i32.add (local.get $i) (i32.const 1)))
     (br_if $delay (i32.lt_u (local.get $i) (i32.const 1000))))
   (i32.store offset=4 (local.get $p) (local.get $value))
   (call $d3d_state_leave) (i32.const 1))`;

(async()=>{
 const h=await bootRenderHarness({extraWat,fonts:'none',extraHostOverrides:{gpu_stream_kick:()=>1}}),e=h.exports;
 e.d3dim_worker_init(0x400000);
 const alloc=n=>e.guest_to_wasm(e.guest_alloc(n))>>>0;
 const mainRegs=alloc(64),workerRegs=alloc(64),pair=alloc(8);
 e.guard_init(mainRegs);
 const view=new DataView(h.memory.buffer);
 const state=regs=>({eax:view.getUint32(regs,true),esp:view.getUint32(regs+16,true)});
 const worker=new Worker(`
   const {parentPort,workerData:d}=require('node:worker_threads');
   (async()=>{
    const host={memory:d.memory};
    for(const i of WebAssembly.Module.imports(d.module))if(i.kind==='function')host[i.name]=()=>0;
    host.gpu_stream_kick=()=>1;
    const e=(await WebAssembly.instantiate(d.module,{host})).exports;
    e.d3dim_worker_init(0x400000);
    e.guard_init(d.regs);
    parentPort.on('message',async m=>{
      try{
       let value;
       if(m.op==='gpsStress'){
        let done=0;while(done<2000){if(e.guard_gps_create())done++;else await new Promise(r=>setImmediate(r));}value=done;
       }else if(m.op==='stress'){
        let done=0;
        while(done<2000){if(e.guard_pair(d.pair,2))done++;else await new Promise(r=>setImmediate(r));}
        value=done;
       }else value=e[m.op]();
       parentPort.postMessage({value,ring:e.guard_gps_ring(),frame:e.guard_gps_frame()});
      }catch(error){parentPort.postMessage({error:error.stack});}
    });
    parentPort.postMessage({ready:true});
   })().catch(error=>{throw error});
 `,{eval:true,workerData:{module:h.module,memory:h.memory,regs:workerRegs,pair}});
 const receive=()=>new Promise((resolve,reject)=>{
   const onMessage=m=>{worker.off('error',onError);m.error?reject(new Error(m.error)):resolve(m);};
   const onError=error=>{worker.off('message',onMessage);reject(error);};
   worker.once('message',onMessage);worker.once('error',onError);
 });
 const call=op=>{const result=receive();worker.postMessage({op});return result;};
 try{
  await receive();
  assert.equal(e.d3d_state_guard_held(),0,'producer capture unavailable outside guarded dispatch');
  assert.equal(e.guard_enter(),1);assert.equal(e.guard_enter(),1);
  assert.equal(e.d3d_state_guard_held(),1,'owning instance may capture');
  assert.equal((await call('d3d_state_guard_held')).value,0,'foreign instance cannot claim capture ownership');
  await call('guard_dispatch');
  assert.deepEqual(state(workerRegs),{eax:123,esp:7000000});
  assert.equal((await call('guard_retry')).value,1,'contended API retries its thunk');
  e.guard_leave();await call('guard_dispatch');
  assert.equal(state(workerRegs).eax,123,'nested leave retains ownership');
  assert.equal(e.d3d_state_guard_held(),1);
  e.guard_leave();await call('guard_dispatch');
  assert.equal(e.d3d_state_guard_held(),0,'outer return closes capture ownership');
  assert.equal(state(workerRegs).esp,7000008,'retry executes exactly once');
  assert.notEqual(state(workerRegs).eax,123);
  assert.equal((await call('guard_enter')).value,1);
  e.guard_dispatch();assert.deepEqual(state(mainRegs),{eax:123,esp:7000000});
  assert.equal(e.guard_retry(),1,'page yields rather than spinning on worker');
  assert.equal(e.get_yield_reason(),0,'contention stays runnable, never resolves an unrelated handle wait');
  assert.equal(e.get_eip(),123456,'contention preserves the retry thunk');
  await call('guard_leave');e.guard_dispatch();assert.equal(state(mainRegs).esp,7000008);
  // The public host export runs outside API dispatch. A busy lock must
  // synchronously refuse without redirecting any parked guest CPU frame.
  const hostState=alloc(64),snapshot=()=>{e.guard_host_state(hostState);return Buffer.from(new Uint8Array(h.memory.buffer,hostState,64));};
  for(const syncDepth of [0,1]){
  e.guard_host_seed(syncDepth);const beforeHost=snapshot(),beforeRegs=Buffer.from(new Uint8Array(h.memory.buffer,mainRegs,64));
  assert.equal((await call('guard_enter')).value,1);
  let hostRefused=false;try{e.d3d9_gps_sync_front();}catch(error){assert(error instanceof WebAssembly.RuntimeError);hostRefused=true;}
  assert.deepEqual(snapshot(),beforeHost,'busy actual host export preserves all guest CPU control globals');
  assert(hostRefused,'busy host capture refuses synchronously');
  assert.deepEqual(Buffer.from(new Uint8Array(h.memory.buffer,mainRegs,64)),beforeRegs,'busy host capture preserves register bytes');
  assert.equal(e.d3d_state_guard_held(),0,'refusal never claims foreign ownership');
  await call('guard_leave');
  assert.equal(e.guard_enter(),1);e.d3d9_gps_sync_front();assert.equal(e.d3d_state_guard_held(),1,'nested host capture retains outer ownership');e.guard_leave();
  e.d3d9_gps_sync_front();assert.equal(e.d3d_state_guard_held(),0,'uncontended host export releases its own lock');
  assert.deepEqual(snapshot(),beforeHost,'successful and nested host sync preserve CPU control state');
  }
  const racing=call('stress');let done=0;
  while(done<2000){if(e.guard_pair(pair,1))done++;await new Promise(r=>setImmediate(r));}
  assert.equal((await racing).value,2000);
  // A second CPU instance uses the SAME process-owned consumer. Reproduce
  // Conan's worker-start CREATE id=1 collision with real native GPS records.
  const GpuStream=require('../lib/gpu-stream'),executor=new GpuStream.NullExecutor();
  const drain=ring=>GpuStream.drain([new GpuStream.Ring(()=>h.memory.buffer,ring)],executor);
  const first=e.guard_gps_create(),ring=e.guard_gps_ring();drain(ring);
  const second=await call('guard_gps_create');drain(second.ring);
  assert.equal(second.value,first+1,'worker continues process resource namespace');
  assert.equal(second.ring,ring,'worker continues the same process ring/sequence');
  const third=e.guard_gps_create();drain(e.guard_gps_ring());
  assert.equal(third,second.value+1,'main resumes after worker without resource reuse');
  assert.equal(e.guard_gps_frame(),3,'frame/cache state survives both instance handoffs');
  assert.equal(executor.live.size,3,'three distinct live RTs in the actual consumer');
  const gpsRacing=call('gpsStress');let created=0;
  while(created<2000){if(e.guard_gps_create())created++;await new Promise(r=>setImmediate(r));}
  assert.equal((await gpsRacing).value,2000);drain(ring);
  assert.equal(executor.live.size,4003,'concurrent instances never reuse any live RT id');
  assert.equal(e.guard_enter(),1);assert.equal(e.guard_gps_frame(),4003,'all concurrent frame updates retained');e.guard_leave();
  console.log('PASS native D3D state guard: contention/retry/nesting, 4000 updates, 4003 cross-instance GPS CREATEs, frame handoff and CPU-preserving host sync refusal/nesting');
 }finally{await worker.terminate();}
})().catch(error=>{console.error(error);process.exitCode=1;});
