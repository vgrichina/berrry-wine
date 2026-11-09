#!/usr/bin/env node
'use strict';
// Compare the mixed topology (local guest main plus Worker peers) with
// --worker-main (production GuestThreadHost slot 0 under node worker_threads).
// Reports callbackPreserved; default exit zero means the probe ran, not that
// callback retention passed. --require-preserved makes retention mandatory.
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
 const workerMain=process.argv.includes('--worker-main');
 const logs=[];
 const h=await bootRenderHarness({extraWat,fonts:'none',extraHostOverrides:{log_i32:n=>logs.push(n>>>0)}}),e=h.exports;
 let main,worker,serviceTimer;
 try{
 if(workerMain){
  const {GuestThreadHost}=require('../lib/guest-thread-host');
  main=new GuestThreadHost({module:h.module,memory:h.memory,hostImports:h.host,
   sigs:require('../lib/host-import-sigs.generated.json').sigs,
   workerUrl:path.resolve(__dirname,'../lib/guest-worker.js'),clockIntervalMs:0,
   forwardGuestLogs:true});
  await main.start();e.set_host_shadow(1);
 }
 const call=(name,...args)=>main?main.callExport(name,...args):Promise.resolve(e[name](...args));
 const marker=await call('guest_alloc',8),entered=marker+4,
  thunk=await call('probe_thunk',api.findIndex(a=>a.name==='IDirect3DDevice9_GetAvailableTextureMem'));
 // Increment before the potentially parked API: replaying the whole callback
 // would duplicate this observable side effect. Then mark normal completion.
 const bytes=[0xff,0x05,...u32(entered),0x6a,0,0xb8,...u32(thunk),0xff,0xd0,0xc7,0x05,...u32(marker),...u32(1),0xb8,...u32(0x1234),0xc2,16,0];
 const code=await call('guest_alloc',bytes.length);bytes.forEach((b,i)=>e.guest_write8(code+i,b));
 const hwnd=await call('probe_window',code);
 worker=new Worker(`
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
   // Wait for an actual guest-side effect first: releasing immediately on
   // the message could win the race against dispatch to the main Worker.
   const service=()=>{
    if(!e.guest_read32(entered)){serviceTimer=setTimeout(service,1);return;}
    assert.equal(e.guest_read32(marker),0,'owner still holds guard before callback completes');
    events.push('callback entered while owner held');
    serviceTimer=setTimeout(()=>{
     events.push('host serviced owner request');worker.postMessage({op:'serviceComplete'});
    },20);
   };
   service();return;
  }
  const resolve=waiters.shift();if(resolve)resolve(m);else messages.push(m);
 });
 const next=async()=>{
  let timer;
  try{return await Promise.race([
   messages.length?Promise.resolve(messages.shift()):new Promise(r=>waiters.push(r)),
   new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('owner Worker response timed out')),10000);}),
  ]);}finally{clearTimeout(timer);}
 };
  await next();
  const run=async label=>{
   e.guest_write32(marker,0);e.guest_write32(entered,0);
   events.push('send entered');const start=performance.now(),result=await call('send_message',hwnd,15,0,0);
   events.push('send returned');
   const elapsedMs=performance.now()-start;
   return {label,elapsedMs,result:result>>>0,completed:await call('probe_completed'),
     entered:e.guest_read32(entered)>>>0,marker:e.guest_read32(marker)>>>0,syncDepth:await call('get_sync_msg_depth'),logs:logs.splice(0)};
  };
  const control=await run('uncontended');assert.equal(control.completed,1);assert.equal(control.marker,1);
  worker.postMessage({op:'hold',ms:100});assert((await next()).held);
  const contended=await run('worker holds guard for 100ms');
  assert((await next()).released);
  const recovery=await run('new send after owner release');assert.equal(recovery.completed,1);assert.equal(recovery.marker,1);
  events.length=0;
  worker.postMessage({op:'hold',hostDependent:true});assert((await next()).held);
  const hostDependent=await run('owner release requires host event-loop service');
  assert((await next()).released);
  const hostDependentOrder=events.slice();
  assert(hostDependentOrder.includes('callback entered while owner held'));
  if(workerMain){
   assert(hostDependentOrder.indexOf('host serviced owner request')<hostDependentOrder.indexOf('send returned'),
    'host services owner while the same callback is parked in its owning Worker');
  }
  const finalRecovery=await run('new send after host-dependent release');
  assert.equal(finalRecovery.completed,1);assert.equal(finalRecovery.entered,1);assert.equal(finalRecovery.marker,1);
  // Controls must remain meaningful even while this diagnostic records the
  // unresolved failure. Do not turn missing callback completion into a PASS.
  for(const row of [control,contended,recovery,hostDependent,finalRecovery]){
   assert.equal(row.entered,1);assert.equal(row.syncDepth,0);
  }
  const report={node:process.version,sourceCommit:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:path.resolve(__dirname,'..'),encoding:'utf8'}).trim(),
    scope:'Fresh native harness, actual shared-memory Worker; modeled host-dependent owner RPC; no browser or GPU',
    mainOwner:workerMain?'production GuestThreadHost slot-0 Worker':'local instance',
    control,contended,recovery,hostDependent,hostDependentOrder,finalRecovery,
    callbackPreserved:[contended,hostDependent].every(r=>r.completed===1&&r.marker===1)};
  const output=process.argv.find(a=>a.startsWith('--output='))?.slice(9);
  const dir=output?path.resolve(output):path.join(__dirname,'../scratch/runs/20261109-d3d-callback-dependency'+(workerMain?'-worker-main':''));fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'probe.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
  if(process.argv.includes('--require-preserved')&&!report.callbackPreserved)process.exitCode=1;
 }finally{clearTimeout(serviceTimer);await worker?.terminate();await main?.stop();}
})().catch(e=>{console.error(e);process.exitCode=1;});
