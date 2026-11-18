'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm');
const {compile}=require('../tools/watx.js');
const {bootstrap}=require('../tools/nfs3-native-scene-attribution.cjs');
const funcs={get_main_hwnd:10,get_focus_hwnd:10,get_current_thread_id:2,get_process_id:1000,
  modal_dialog_hwnd:0,get_capture_hwnd:0,get_window_thread:2,get_eip:0x4cba8e,get_yield_reason:7};
const declarations=Object.entries(funcs).map(([n,v])=>`(func (export "${n}") ${n==='get_window_thread'?'(param i32)':''} (result i32) (i32.const ${v}))`).join('\n');
const source=`(import "host" "memory" (memory 1))
 (import "host" "get_ticks" (func $ticks (result i32)))
 (import "host" "check_input" (func $input (result i32)))
 (import "host" "gpu_stream_kick" (func $gpu (param i32 i32) (result i32)))
 ${declarations}
 (func (export "wnd_lookup_generation") (param i32) (result i64) (i64.const 1))
 (func (export "has_pending_message") (result i32) (drop (call $ticks)) (i32.const 0))
 (func (export "resume_message_wait") (result i32) (i32.const 0))
 (func (export "run") (param $p i32) (result i32)
   (drop (call $input)) (call $gpu (local.get $p) (i32.const 1)))
 (func (export "get_sleep_yielded") (result i32) (unreachable))
 (data (i32.const 12) "retained")`;
const compiled=compile(source,new Map(),{runtimeBuiltins:false,standardWat:true,tailCalls:false});
assert(compiled.success,compiled.error);
async function check(asyncMode){
 const wasm={Instance:WebAssembly.Instance,instantiate:WebAssembly.instantiate};
 const context={WebAssembly:wasm,Date,performance,Reflect,Proxy,BigInt};vm.runInNewContext(bootstrap(),context);
 let inputs=0,ticks=0,kicks=0;const memory=new WebAssembly.Memory({initial:1});
 const imports={host:{memory,check_input:()=>{inputs++;return 0;},get_ticks:()=>++ticks,
   gpu_stream_kick:(p,m)=>{kicks++;assert.equal(m,1);return p+1;}}};
 const module=new WebAssembly.Module(compiled.wasmBinary),instance=asyncMode?
   await wasm.instantiate(module,imports):new wasm.Instance(module,imports);
 assert(instance instanceof WebAssembly.Instance);const before=Buffer.from(memory.buffer);
 assert.equal(instance.exports.run(126),127);
 // Actual native wait probes continue without invoking check_input again.
 for(let n=0;n<4;n++)assert.equal(instance.exports.has_pending_message(),0);
 const report=JSON.parse(JSON.stringify(context.nfs3SceneAttribution()));const actor=report.actors[0];
 assert.equal(inputs,1);assert.equal(ticks,4);assert.equal(kicks,1);
 assert.equal(actor.calls.has_pending_message.count,4);assert.equal(actor.calls.check_input.count,1);
 assert(actor.rows.some(r=>r.phase==='has_pending_message'&&r.scene.yield===7&&r.scene.windowThread===2));
 assert(actor.rows.some(r=>r.phase==='gpu_stream_kick-enter'&&r.args[1]===1));
 assert.deepEqual(actor.rows.find(r=>r.phase==='check_input').scene.values,[2,1000,10,10,0,0,1,0,1,0]);
 assert.deepEqual(report.errors,[]);assert.deepEqual(Buffer.from(memory.buffer),before);
 assert.equal(report.extraGuestPolls,0);assert.equal(report.readinessWrites,0);
 for(const row of actor.rows){assert(row.wall>0&&row.mono>0&&row.timeOrigin>0);assert(Math.abs(row.wall-(row.timeOrigin+row.mono))<1000);}
 return {asyncMode,nativeReturn:127,inputs,ticks,kicks,waitProbes:4,memoryUnchanged:true};
}
function guardChecks(){
 const {createBrowserNativeInput}=require('../lib/browser-native-input');
 function fixture(){
  let wall=1000,mono=10;
  const instance={},memory={buffer:new ArrayBuffer(1024)},module={},actor={slot:1,worker:{},endpointIdentity:17};
  const win={visible:true,wasm:instance,processId:1000};
  const manager={options:{memory,module},worker:{},ports:new Map()};
  const endpoint={id:1,manager,options:{api:'d3dim-gps'},closed:false};manager.ports.set(1,endpoint);
  const bridge={api:'d3dim-gps',endpoint,device:{worker:true},presenter:{win,layer:{canvas:{}}}};
  const wine={instance,memory,_wasmModule:module,_processObject:{},running:true,
   guestWorker:{link:{slot:0},threadLinks:new Map([[1,actor]])},processId:1000,
   renderer:{canvas:{},inputQueue:[],windows:{10:win},handleKeyDown(){}},
   _renderWorkerManager:manager,hostCtx:{d3dimBridge:bridge,getD3dimBridge:()=>bridge}};
  const g=createBrowserNativeInput(wine,{now:()=>wall,monotonic:()=>mono,trusted:()=>true});
  const values=[2,1000,10,10,0,0,1,0,1,0];
  const observe=(context=values,w=wall,m=mono,e=17)=>g.withActor(1,'input_validate',()=>
   g.validate(-1,[...context,w,performance.timeOrigin+m,e]));
  g.withActor(1,'check_input',()=>g.observe(values));
  return {g,wine,actor,values,observe,clock:(w,m)=>{wall=w;mono=m;}};
 }
 const f=fixture();f.clock(1300,310);assert.equal(f.g.snapshot().ready,false,'old check_input source expires');
 assert.equal(f.observe(),0,'observation is never a native consumption receipt');
 assert.equal(f.g.snapshot().ready,true);assert.equal(f.g.snapshot().source,'native_message_wait');
 f.clock(1551,561);assert.equal(f.g.snapshot().ready,false,'250ms producer fence unchanged');
 for(const [name,mutate]of Object.entries({
  wallLate:f=>f.clock(1300,10),monoLate:f=>f.clock(1000,310),
  retired:f=>f.actor._stopped=true,stopping:f=>f.actor._stopping=true,
  completed:f=>f.actor._retirementComplete=true,
  replaced:f=>f.wine.guestWorker.threadLinks.set(1,{...f.actor,endpointIdentity:18}),
  missing:f=>f.wine.guestWorker.threadLinks.delete(1),
 })){const a=fixture();const before=a.g.snapshot();mutate(a);a.observe(a.values,1000,10);assert.equal(a.g.snapshot().source,before.source,name);}
 for(const mutate of [f=>f.actor._stopped=true,f=>f.actor.worker={},
  f=>f.wine.guestWorker.threadLinks.set(1,{...f.actor}),f=>f.actor.endpointIdentity++]){
  const a=fixture();a.observe();assert(a.g.snapshot().ready);mutate(a);assert.equal(a.g.snapshot().ready,false);
 }
 const a=fixture();a.clock(1300,310);a.observe(a.values,1000,10);assert.equal(a.g.snapshot().ready,false,'late receipt cannot renew native time');
 a.observe(a.values,1400,410);assert.equal(a.g.snapshot().ready,false,'future producer refused');
 const b=fixture();b.observe();const binding=b.g.bind();b.actor.worker={};
 assert.equal(b.g.prepare({owner:binding.owner,nonce:'retired',code:38,reviewed:true,
  reviewedAt:1000,imageSHA256:'a'.repeat(64),mode:'game'}).state,'CANCELLED');
}
Promise.all([check(false),check(true)]).then(results=>{guardChecks();console.log(JSON.stringify({pass:true,results,guardProducerClockAndRetirement:true}));})
 .catch(e=>{console.error(e);process.exitCode=1;});
