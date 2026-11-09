#!/usr/bin/env node
'use strict';
// Diagnostic for the still-unresolved mixed topology (local guest main plus
// Worker peers). Reports callbackPreserved; exit zero means the probe ran,
// not that callback retention passed. Worker callback coverage is a separate
// regression in test/test-d3d9-callback-guard.js.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {Worker}=require('node:worker_threads');
const {bootRenderHarness}=require('../test/render-helper');
const api=require('../src/api_table.json');
const u32=n=>[n,n>>>8,n>>>16,n>>>24].map(n=>n&255);
const extraWat=`
 (func (export "probe_enter") (result i32) (call $d3d_state_try_enter))
 (func (export "probe_leave") (call $d3d_state_leave))
 (func (export "probe_completed") (result i32) (global.get $wnd_send_completed))
 (func (export "probe_window") (param $proc i32) (result i32)
   (local $h i32)
   (local.set $h (global.get $next_hwnd))
   (global.set $next_hwnd (i32.add (local.get $h) (i32.const 1)))
   (call $host_register_dialog_frame (local.get $h) (i32.const 0) (i32.const 0)
     (i32.const 32) (i32.const 24) (i32.const 0))
   (call $wnd_table_set (local.get $h) (local.get $proc))
   (drop (call $wnd_set_style (local.get $h) (i32.const 0x90000000))) (local.get $h))
 (func (export "probe_thunk") (param $id i32) (result i32)
   (local $p i32)
   (global.set $thunk_guest_base (call $w2g (global.get $THUNK_BASE)))
   (local.set $p (i32.add (global.get $THUNK_BASE) (i32.mul (global.get $num_thunks) (i32.const 8))))
   (i32.store (local.get $p) (i32.const 0)) (i32.store offset=4 (local.get $p) (local.get $id))
   (global.set $num_thunks (i32.add (global.get $num_thunks) (i32.const 1)))
   (call $update_thunk_end) (call $w2g (local.get $p)))`;
(async()=>{
 const logs=[];
 const h=await bootRenderHarness({extraWat,fonts:'none',extraHostOverrides:{log_i32:n=>logs.push(n>>>0)}}),e=h.exports;
 const marker=e.guest_alloc(8),entered=marker+4,thunk=e.probe_thunk(api.findIndex(a=>a.name==='IDirect3DDevice9_GetAvailableTextureMem'));
 // Increment before the potentially parked API: replaying the whole callback
 // would duplicate this observable side effect. Then mark normal completion.
 const bytes=[0xff,0x05,...u32(entered),0x6a,0,0xb8,...u32(thunk),0xff,0xd0,0xc7,0x05,...u32(marker),...u32(1),0xb8,...u32(0x1234),0xc2,16,0];
 const code=e.guest_alloc(bytes.length);bytes.forEach((b,i)=>e.guest_write8(code+i,b));
 const hwnd=e.probe_window(code);
 const worker=new Worker(`
  const {parentPort,workerData:d}=require('node:worker_threads');
  (async()=>{
   const host={memory:d.memory};
   for(const i of WebAssembly.Module.imports(d.module))if(i.kind==='function')host[i.name]=()=>0;
   const e=(await WebAssembly.instantiate(d.module,{host})).exports;
   parentPort.on('message',m=>{
    if(m.op==='hold'){
     if(e.probe_enter()!==1)throw new Error('unexpected contention acquiring probe lock');
     parentPort.postMessage({held:true});
     if(m.hostDependent)parentPort.postMessage({serviceRequired:true});
     else setTimeout(()=>{e.probe_leave();parentPort.postMessage({released:true});},m.ms);
    }
    if(m.op==='serviceComplete'){e.probe_leave();parentPort.postMessage({released:true});}
   });parentPort.postMessage({ready:true});
  })();`,{eval:true,workerData:{module:h.module,memory:h.memory}});
 const messages=[],waiters=[],events=[];
 worker.on('message',m=>{
  if(m.serviceRequired){
   // Model an owner RPC that needs the local host event loop. This cannot
   // complete while the same host is blocked in Atomics.wait or a busy loop.
   events.push('host serviced owner request');worker.postMessage({op:'serviceComplete'});return;
  }
  const resolve=waiters.shift();if(resolve)resolve(m);else messages.push(m);
 });
 const next=()=>messages.length?Promise.resolve(messages.shift()):new Promise(r=>waiters.push(r));
 try{
  await next();
  const run=label=>{
   e.guest_write32(marker,0);e.guest_write32(entered,0);
   events.push('send entered');const start=performance.now(),result=e.send_message(hwnd,15,0,0);
   events.push('send returned');
   return {label,elapsedMs:performance.now()-start,result:result>>>0,completed:e.probe_completed(),
     entered:e.guest_read32(entered)>>>0,marker:e.guest_read32(marker)>>>0,syncDepth:e.get_sync_msg_depth(),logs:logs.splice(0)};
  };
  const control=run('uncontended');assert.equal(control.completed,1);assert.equal(control.marker,1);
  worker.postMessage({op:'hold',ms:100});assert((await next()).held);
  const contended=run('worker holds guard for 100ms');
  assert((await next()).released);
  const recovery=run('new send after owner release');assert.equal(recovery.completed,1);assert.equal(recovery.marker,1);
  events.length=0;
  worker.postMessage({op:'hold',hostDependent:true});assert((await next()).held);
  const hostDependent=run('owner release requires host event-loop service');
  assert((await next()).released);
  const hostDependentOrder=events.slice();
  const finalRecovery=run('new send after host-dependent release');
  assert.equal(finalRecovery.completed,1);assert.equal(finalRecovery.entered,1);assert.equal(finalRecovery.marker,1);
  // Controls must remain meaningful even while this diagnostic records the
  // unresolved failure. Do not turn missing callback completion into a PASS.
  for(const row of [control,contended,recovery,hostDependent,finalRecovery]){
   assert.equal(row.entered,1);assert.equal(row.syncDepth,0);
  }
  const report={node:process.version,sourceCommit:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:path.resolve(__dirname,'..'),encoding:'utf8'}).trim(),
    scope:'Fresh native harness, actual shared-memory Worker; modeled host-dependent owner RPC; no browser or GPU',control,contended,recovery,hostDependent,hostDependentOrder,finalRecovery,
    callbackPreserved:[contended,hostDependent].every(r=>r.completed===1&&r.marker===1)};
  const output=process.argv.find(a=>a.startsWith('--output='))?.slice(9);
  const dir=output?path.resolve(output):path.join(__dirname,'../scratch/runs/20261109-d3d-callback-dependency');fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'probe.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
  if(process.argv.includes('--require-preserved')&&!report.callbackPreserved)process.exitCode=1;
 }finally{await worker.terminate();}
})().catch(e=>{console.error(e);process.exitCode=1;});
