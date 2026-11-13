#!/usr/bin/env node
'use strict';
// Real native dispatch across two instances sharing memory. A contended API
// must retry without popping arguments or blocking its host event loop.
const assert=require('node:assert/strict');
const {Worker}=require('node:worker_threads');
const {bootRenderHarness}=require('./render-helper');
const api=require('../src/api_table.json');
const id=api.findIndex(a=>a.name==='IDirect3DDevice9_GetAvailableTextureMem');
const extraWat=`
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
 const h=await bootRenderHarness({extraWat,fonts:'none'}),e=h.exports;
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
    const e=(await WebAssembly.instantiate(d.module,{host})).exports;
    e.guard_init(d.regs);
    parentPort.on('message',async m=>{
      try{
       let value;
       if(m.op==='stress'){
        let done=0;
        while(done<2000){if(e.guard_pair(d.pair,2))done++;else await new Promise(r=>setImmediate(r));}
        value=done;
       }else value=e[m.op]();
       parentPort.postMessage({value});
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
  const racing=call('stress');let done=0;
  while(done<2000){if(e.guard_pair(pair,1))done++;await new Promise(r=>setImmediate(r));}
  assert.equal((await racing).value,2000);
  console.log('PASS native D3D state guard: contention, retry, nesting and 4000 concurrent consistent updates');
 }finally{await worker.terminate();}
})().catch(error=>{console.error(error);process.exitCode=1;});
