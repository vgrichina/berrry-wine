#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {Worker}=require('node:worker_threads');
const {bootRenderHarness}=require('./render-helper');
const api=require('../src/api_table.json');
const u32=n=>[n,n>>>8,n>>>16,n>>>24].map(n=>n&255);
const extraWat=`
 (func (export "guard_enter") (result i32) (call $d3d_state_try_enter))
 (func (export "guard_leave") (call $d3d_state_leave))
 (func (export "guard_completed") (result i32) (global.get $wnd_send_completed))
 (func (export "guard_window") (param $proc i32) (result i32)
   (local $h i32)
   (local.set $h (global.get $next_hwnd))
   (global.set $next_hwnd (i32.add (local.get $h) (i32.const 1)))
   (call $host_register_dialog_frame (local.get $h) (i32.const 0) (i32.const 0)
     (i32.const 32) (i32.const 24) (i32.const 0))
   (call $wnd_table_set (local.get $h) (local.get $proc))
   (drop (call $wnd_set_style (local.get $h) (i32.const 0x90000000))) (local.get $h))
 (func (export "guard_thunk") (param $id i32) (result i32)
   (local $p i32)
   (global.set $thunk_guest_base (call $w2g (global.get $THUNK_BASE)))
   (local.set $p (i32.add (global.get $THUNK_BASE) (i32.mul (global.get $num_thunks) (i32.const 8))))
   (i32.store (local.get $p) (i32.const 0)) (i32.store offset=4 (local.get $p) (local.get $id))
   (global.set $num_thunks (i32.add (global.get $num_thunks) (i32.const 1)))
   (call $update_thunk_end) (call $w2g (local.get $p)))`;
(async()=>{
 const h=await bootRenderHarness({extraWat,fonts:'none'}),e=h.exports;
 assert.equal(h.host.gpu_gl_call(0x30018,0,1),0,'page import never blocks');
 const marker=e.guest_alloc(4),id=api.findIndex(a=>a.name==='IDirect3DDevice9_GetAvailableTextureMem');
 const thunk=e.guard_thunk(id);
 const bytes=[0x6a,0,0xb8,...u32(thunk),0xff,0xd0,0xc7,0x05,...u32(marker),...u32(1),0xb8,...u32(0x1234),0xc2,16,0];
 const code=e.guest_alloc(bytes.length);bytes.forEach((b,i)=>e.guest_write8(code+i,b));
 const hwnd=e.guard_window(code);
 const publication=new (require('../lib/render-worker').PublicationQueue)();
 const worker=new Worker(`
  const {parentPort,workerData:d}=require('node:worker_threads');
  (async()=>{
   const RPC=require(d.rpc);let e;
   const imports=RPC.createWorkerImports(d.memory,{gpu_gl_call:{params:['i32','i32','i32'],results:['i32']}},
     ()=>{throw new Error('state wait must not be brokered');},{slot:1,getExports:()=>e,renderPublication:d.publication});
   const host={memory:d.memory};
   for(const i of WebAssembly.Module.imports(d.module))if(i.kind==='function')host[i.name]=()=>0;
   let waits=0;
   host.gpu_gl_call=(op,at,aux)=>{
    if(op===0x30018){waits++;parentPort.postMessage({waiting:true});}
    return imports.imports.host.gpu_gl_call(op,at,aux);
   };
   e=(await WebAssembly.instantiate(d.module,{host})).exports;
   if(e.guard_thunk(d.id)!==d.thunk)throw new Error('thunk identity mismatch');
   parentPort.on('message',()=>{
    try{
     const result=e.send_message(d.hwnd,15,0,0);
     parentPort.postMessage({result,completed:e.guard_completed(),depth:e.get_sync_msg_depth(),waits});
    }catch(error){parentPort.postMessage({error:error.stack});}
   });parentPort.postMessage({ready:true});
  })().catch(error=>{throw error});
 `,{eval:true,workerData:{module:h.module,memory:h.memory,id,thunk,hwnd,publication:publication.buffer,rpc:require.resolve('../lib/guest-rpc')}});
 let resolve,reject,onWaiting;const backlog=[];
 worker.on('message',m=>{
  if(m.waiting){onWaiting?.();return;}
  if(resolve){const done=resolve,fail=reject;resolve=reject=null;m.error?fail(new Error(m.error)):done(m);}
  else backlog.push(m);
 });
 worker.on('error',error=>{if(reject)reject(error);else backlog.push({error:error.stack});});
 const next=()=>backlog.length?Promise.resolve(backlog.shift()):new Promise((r,j)=>{resolve=r;reject=j;});
 const send=()=>{const done=next();worker.postMessage({send:true});return done;};
 let held=0,timer;
 try{
  assert((await next()).ready);
  e.guest_write32(marker,0);
  const control=await send();assert.equal(control.completed,1);assert.equal(control.waits,0);
  assert.equal(e.guest_read32(marker),1);
  assert.equal(e.guard_enter(),1);held++;assert.equal(e.guard_enter(),1);held++;
  e.guest_write32(marker,0);
  let pageTurns=0;
  onWaiting=()=>{
   assert.equal(e.guest_read32(marker),0,'callback has not passed contended API');
   e.guard_leave();held--;
   timer=setTimeout(()=>{
    pageTurns++;assert.equal(e.guest_read32(marker),0,'inner unlock does not release the guard');
    e.guard_leave();held--;
   },20);
  };
  const result=await send();
  assert.equal(pageTurns,1,'page serviced work while guest Worker waited');
  assert.equal(result.waits,1,'callback waited locally instead of repeating bounded send rounds');
  assert.equal(result.completed,1);assert.equal(result.result,0x1234);assert.equal(result.depth,0);
  assert.equal(e.guest_read32(marker),1,'same callback continued past the D3D call');
  assert.equal(e.guard_enter(),1);held++;
  e.guest_write32(marker,0);
  onWaiting=()=>publication.fail();
  await assert.rejects(send(),/render publication queue closed or failed/,'failed process wakes via bounded wait check');
  assert.equal(e.guest_read32(marker),0,'failure is not reported as callback completion');
  console.log('PASS native Worker callback survives D3D contention; nested unlock, local wait and page progress');
 }finally{clearTimeout(timer);while(held>0){e.guard_leave();held--;}await worker.terminate();}
})().catch(error=>{console.error(error);process.exitCode=1;});
