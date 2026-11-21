'use strict';
// Actual x86 USER calls in an owning Worker, with the page's separate shadow
// instance sharing the same memory. No original application or private focus
// writes: ordinary imports create a hidden-console viewport or a modeless
// owned dialog with a focused child, then poll real native USER input.
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const {Worker,isMainThread,parentPort,workerData}=require('node:worker_threads');
function fixture(variant='viewport'){
 const b=require('./test-disciples2-native-paint-binding.cjs').fixture(false),raw=r=>r-0x1000+0x400;
 const word=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];
 for(const [i,name]of ['ShowWindow','SetCapture','PeekMessageA','CreateDialogIndirectParamA'].entries()){
  b.writeUInt32LE(0x1d00+i*64,raw(0x1334+i*4));b.write(name+'\0',raw(0x1d02+i*64));
 }b.writeUInt32LE(0,raw(0x1344));
 const a=[],emit=(...v)=>a.push(...v),push=n=>emit(0x68,...word(n)),call=n=>emit(0xff,0x15,...word(n));
 const handle=p=>emit(0xff,0x35,...word(p));
 push(0x403500);call(0x401300);
 const mouse=variant.startsWith('modeless-mouse'),modeless=variant.startsWith('modeless');
 if(mouse){
  b.writeUInt32LE(0x402a00,raw(0x3504));
  const proc=[0x55,0x89,0xe5,0x81,0x7d,0x0c,...word(0x201),0x75,28,
   0xff,0x05,...word(0x403680),0x8b,0x45,8,0xa3,...word(0x403684),
   0x8b,0x45,20,0xa3,...word(0x403688),0x31,0xc0,0xc9,0xc2,0x10,0];
  // Non-mouse messages retain ordinary USER activation/default handling.
  for(const n of [20,16,12,8])proc.push(0xff,0x75,n);
  proc.push(0xff,0x15,...word(0x401318),0xc9,0xc2,0x10,0);
  Buffer.from(proc).copy(b,raw(0x2a00));
  Buffer.from([...proc.slice(0,40),0x31,0xc0,0xc9,0xc2,0x10,0]).copy(b,raw(0x2c00));
 }
 for(const store of modeless?[0x403600,0x403608,0x403604]:[0x403600,0x403604]){
  if(modeless&&store===0x403608){
   b.fill(0,raw(0x3900),raw(0x3940));b.writeUInt32LE(0x90c80000,raw(0x3900));
   b.writeUInt16LE(320,raw(0x390e));b.writeUInt16LE(240,raw(0x3910));
   if(!mouse)Buffer.from([0x31,0xc0,0xc2,0x10,0]).copy(b,raw(0x2c00));
   push(0);push(0x402c00);handle(0x403600);push(0x403900);push(0x400000);call(0x401340);
   emit(0xa3,...word(store));
   if(mouse){push(5);handle(store);call(0x401334);}
   continue;
  }
  for(const n of [0,0x400000,0])push(n);
  if(modeless&&store!==0x403600)handle(0x403608);else push(0);
  const child=mouse&&store===0x403604;
  for(const n of [child?200:480,child?320:640,child?30:0,child?20:0,
   modeless&&store===0x403604?0x50000000:0x90c80000,0x403080,0x403000,0])push(n);
  call(0x401304);emit(0xa3,...word(store));
  if(store===0x403600){handle(store);call(0x401308);}
 }
 if(!modeless&&variant!=='visible-main'){push(0);handle(0x403600);call(0x401334);}
 handle(0x403604);call(0x401308);
 if(!modeless){handle(0x403604);call(0x401338);}
 if(variant==='hidden-viewport'){push(0);handle(0x403604);call(0x401334);}
 const pump=a.length;
 for(const n of [1,0,0,0,0x403640])push(n);call(0x40133c);
 if(mouse){
  emit(0x85,0xc0,0x74,11);push(0x403640);call(0x401314);
 }
 emit(0xe9,...word(pump-(a.length+5)));
 assert(a.length<0x400);b.fill(0,raw(0x2000),raw(0x2400));Buffer.from(a).copy(b,raw(0x2000));
 return b;
}
if(!isMainThread){
 let e;
 const rpc=require('../lib/guest-rpc').createWorkerImports(workerData.memory,workerData.sigs,
  m=>parentPort.postMessage(m),{slot:0,getExports:()=>e});
 e=new WebAssembly.Instance(workerData.module,rpc.imports).exports;
 const bytes=fixture(workerData.variant);new Uint8Array(workerData.memory.buffer).set(bytes,e.get_staging());assert(e.load_pe(bytes.length));
 const run=()=>{try{e.run(2000);setImmediate(run);}catch(error){parentPort.postMessage({t:'error',error:error.stack});}};
 run();
}
async function main(variant=process.argv[2]||'viewport',fault=null){
 assert(['viewport','visible-main','hidden-viewport','modeless','modeless-mouse','modeless-mouse-popup'].includes(variant));
 const module=new WebAssembly.Module(fs.readFileSync(path.join(__dirname,'../build/wine-assembly.wasm')));
 const h=await require('./render-helper').bootRenderHarness({prebuiltModule:module,fonts:'none'});
 const RPC=require('../lib/guest-rpc'),sigs=JSON.parse(fs.readFileSync(path.join(__dirname,'../lib/host-import-sigs.generated.json'))).sigs;
 const table={...h.host},actor={slot:0,endpointIdentity:1,module,memory:h.memory};
 const wine={renderer:h.renderer,instance:h.instance,memory:h.memory,_wasmModule:module,
  _processObject:{},processId:1000,running:true,hostCtx:{instance:h.instance},
  guestWorker:{link:actor,module,memory:h.memory,hostImports:table}};
 let wall=1000,mono=0;
 const guard=require('../lib/browser-native-input').createBrowserNativeInput(wine,
  {now:()=>wall,monotonic:()=>mono,trusted:()=>true});
 wine.hostCtx.guardedInput=table.browserInputScope=guard;
 const create=table.create_window;
 table.create_window=(...a)=>{const v=create(...a),win=h.renderer.windows[a[0]];
  win.processId=1000;win.wasm=h.instance;win.wasmMemory=h.memory;return v;};
 let resolve,reject,resolveReceipt,token=0,target=0,lparam=0;const nativeReturns=[];
 const observation=new Promise((r,j)=>{resolve=r;reject=j;}),receipt=new Promise(r=>resolveReceipt=r);
 table.input_validate=(t,...v)=>guard.withActor(0,'input_validate',()=>guard.validate(t,v));
 table.input_consumed=(...a)=>guard.withActor(0,'input_consumed',()=>{
  const view=new DataView(h.memory.buffer),p=a.at(-1);
  nativeReturns.push([...a]);
  if(variant.startsWith('modeless-mouse')){
   const before=Array.from({length:4},(_,i)=>view.getUint32(p+i*4,true));
   console.log('native MSG '+JSON.stringify(before));
   for(const [index,value]of [[0,65537],[0,65539+9],[1,0x202],[2,0],[3,before[3]+1]]){
    view.setUint32(p+index*4,value,true);
    assert.equal(guard.consumed(...a.slice(0,5),a.slice(5)),0,'copied wrong native MSG field '+index);
    view.setUint32(p+index*4,before[index],true);
   }
   assert.equal(guard.consumed(a[0],a[1]+1,...a.slice(2,5),a.slice(5)),0,'foreign native thread');
   const wrong=a.slice(5);wrong[8]++;
   assert.equal(guard.consumed(...a.slice(0,5),wrong),0,'wrong native scene generation');
   if(fault==='detach')h.exports.test_wnd_set_parent(65539,65537);
   if(fault==='retire')h.exports.wnd_lookup_retire(65538);
   if(fault==='geometry')h.renderer.canvas.getBoundingClientRect=()=>({left:1,top:0,right:641,bottom:480,width:640,height:480});
  }
  if(variant==='modeless'){
   assert.equal(guard.consumed(a[0],a[1]+1,...a.slice(2,5),a.slice(5)),0,'foreign native return thread');
   const wrong=a.slice(5);wrong[8]++;
   assert.equal(guard.consumed(...a.slice(0,5),wrong),0,'native return focus generation');
   // The actor is blocked in this synchronous broker call. Reject a copied
   // MSG aimed at the root, then restore its bytes before returning to USER.
   const view=new DataView(h.memory.buffer),p=a.at(-1),hwnd=view.getUint32(p,true);
   try{view.setUint32(p,65537,true);assert.equal(guard.consumed(...a.slice(0,5),a.slice(5)),0,'wrong returned HWND');}
   finally{view.setUint32(p,hwnd,true);}
  }
  const result=guard.consumed(...a.slice(0,5),a.slice(5));if(result)resolveReceipt(result);return result;
 });
 table.check_input_token=()=>token;table.check_input_hwnd=f=>target||f;table.check_input_lparam=()=>lparam;
 table.check_input=(...scene)=>guard.withActor(0,'check_input',()=>{
  guard.observe(scene);resolve(scene);const edge=h.renderer.inputQueue.shift();if(!edge)return 0;
  token=guard.dequeued(edge);if(!token)return 0;target=edge.hwnd;lparam=edge.lParam;return edge.msg|(edge.wParam<<16);
 });
 const broker=RPC.createMainBroker(h.memory,table,sigs);
 const worker=new Worker(__filename,{workerData:{module,memory:h.memory,sigs,variant}});actor.worker=worker;
 const timer=setTimeout(()=>reject(Error('native scene deadline')),10000);
 worker.on('error',reject);worker.on('message',m=>{try{if(m.t==='rpc')broker.serveRpc(m.slot);
  if(m.t==='calls')broker.serveCalls(m);if(m.t==='error')reject(Error(m.error));}catch(e){reject(e);}});
 try{
  const scene=await observation;clearTimeout(timer);
  if(variant.startsWith('modeless-mouse')){
   assert.equal(guard.snapshot().ready,true);
   h.renderer.canvas.getBoundingClientRect=()=>({left:0,top:0,right:640,bottom:480,width:640,height:480});
   const e=h.exports,child=65539;
   const popup=variant.endsWith('popup'),targetHwnd=popup?65538:child;
   const cx=popup?10:60,cy=popup?150:70;
   const x=e.wnd_mouse_msg_origin_x(targetHwnd)+cx,y=e.wnd_mouse_msg_origin_y(targetHwnd)+cy;
   const b=guard.bind();guard.prepare({owner:b.owner,nonce:'mouse',kind:'mouse',button:0,
    x,y,code:1,reviewed:true,reviewedAt:wall,imageSHA256:'a'.repeat(64),mode:'game'});
   h.renderer.handleMouseDown(x,y,0);
   const produced=h.renderer.inputQueue.map(v=>({...v}));
   broker.publish({inputPending:1});
   await new Promise(r=>setTimeout(r,120));
   const view=new DataView(h.memory.buffer),p=nativeReturns[0].at(-1)+0x40;
   const result={produced,nativeReturns,status:guard.status('mouse'),proc:e.wnd_get_proc_export(child),pointer:p,
    callbackCount:view.getUint32(p,true),callbackHwnd:view.getUint32(p+4,true),callbackLParam:view.getUint32(p+8,true)};
   console.log(JSON.stringify(result));
   if(fault){assert.equal(result.status.consumed,false,fault);assert.equal(result.callbackCount,0,fault+' callback refused');return;}
   assert.equal(result.status.consumed,true,'actual native modeless mouse receipt');
   assert.equal(result.status.nativeMessage.hwnd,targetHwnd);
   assert.equal(result.status.nativeMessage.lParam,(cy<<16)|cx);
   assert.equal(result.callbackCount,1,'successful PeekMessage followed by actual x86 DispatchMessage callback');
   assert.equal(result.callbackHwnd,targetHwnd);assert.equal(result.callbackLParam,(cy<<16)|cx);
   h.renderer.handleMouseUp(x,y,0);guard.release(b.owner,'mouse');return;
  }
  if(variant==='modeless'){
   assert.deepEqual(scene,[1,1000,65537,65539,0,0,1,0,3,0]);
   const e=h.exports;
   assert.equal(e.wnd_get_owner(65538),65537,'ordinary CreateDialogIndirectParamA owner');
   assert.equal(e.wnd_get_parent(65539),65538,'ordinary native child');
   assert.equal(h.exports.get_main_hwnd(),0,'shadow cannot supply actor main');
   assert.equal(guard.snapshot().ready,true,'live same-thread modeless ancestry');
   const observe=s=>guard.withActor(0,'check_input',()=>guard.observe(s));
   for(const [label,index,value]of [['process',1,1001],['thread',0,2],['root generation',6,9],
     ['root generation high',7,1],['focus generation',8,9],['focus generation high',9,1],['modal',4,65538],
     ['capture child',5,65539],['capture popup',5,65538],['unrelated focus',3,65538+8]]){
    observe(scene.map((n,i)=>i===index?value:n));assert.equal(guard.snapshot().ready,false,label);observe(scene);
   }
   wall=1251;mono=251;assert.equal(guard.snapshot().ready,false,'stale');wall=1000;mono=0;
   // A live but unrelated ancestry cannot certify input. No private guest focus writes.
   e.test_wnd_set_parent(65539,0);assert.equal(guard.snapshot().ready,false,'detached live child');
   e.test_wnd_set_parent(65539,65539);assert.equal(guard.snapshot().ready,false,'cyclic live child');
   e.test_wnd_set_parent(65539,65537);assert.equal(guard.snapshot().ready,true,'native child of root');
   e.test_wnd_set_parent(65539,65538);
   const b=guard.bind();guard.prepare({owner:b.owner,nonce:'modeless',reviewed:true,reviewedAt:wall,imageSHA256:'a'.repeat(64),code:65,mode:'game'});
   h.renderer.handleKeyDown(65);
   broker.publish({inputPending:1});
   await Promise.race([receipt,new Promise((_,j)=>setTimeout(()=>j(Error('modeless USER receipt deadline '+JSON.stringify({returns:nativeReturns,status:guard.status('modeless'),queue:h.renderer.inputQueue}))),4000))]);
   assert.equal(guard.status('modeless').consumed,true,'actual worker native PeekMessage return');
   h.renderer.handleKeyUp(65);assert.equal(guard.release(b.owner,'modeless').owner,b.owner);
   guard.bind();
   e.test_wnd_set_parent(65539,65537);assert.equal(guard.snapshot().ready,false,'changed ancestry invalidates binding');
   e.test_wnd_set_parent(65539,65538);
   e.wnd_lookup_retire(65538);assert.equal(guard.snapshot().ready,false,'destroyed intermediate popup');
   console.log('PASS actual Worker modeless parent/popup/child USER return; process/thread/generation/modal/capture/stale/ancestry/destroyed negatives');return;
  }
  if(variant!=='viewport'){
   assert.equal(scene[2],65537,'ineligible focused window cannot replace main');
   assert.equal(guard.snapshot().ready,false,variant);
   console.log('PASS native scene refuses '+variant);return;
  }
  assert.deepEqual(scene,[1,1000,65538,65538,0,65538,2,0,2,0]);
  assert.equal(h.exports.get_main_hwnd(),0,'shadow instance cannot supply actor-local main');
  assert.equal(h.renderer.windows[65537].visible,false,'native ShowWindow hid console');
  assert.equal(h.exports.wnd_lookup_generation(65538),2n);
  assert.equal(h.exports.get_authoritative_capture_hwnd(),65538);
  assert.equal(guard.snapshot().ready,true,'same native owner, focus, capture, module and memory');
  const faults=[
   ['wrong process',()=>{wine.processId++;return()=>wine.processId--;}],
   ['hidden window',()=>{const win=h.renderer.windows[65538];win.visible=false;return()=>win.visible=true;}],
   ['wrong memory',()=>{wine.memory={};return()=>wine.memory=h.memory;}],
   ['wrong actor memory',()=>{actor.memory={};return()=>actor.memory=h.memory;}],
   ['retired actor',()=>{actor._retirementComplete=true;return()=>delete actor._retirementComplete;}],
   ['stale scene',()=>{wall=1251;mono=251;return()=>{wall=1000;mono=0;};}],
   ['different focus',()=>{guard.withActor(0,'check_input',()=>guard.observe(scene.map((n,i)=>i===3?65537:n)));
    return()=>guard.withActor(0,'check_input',()=>guard.observe(scene));}],
  ];
  for(const [name,mutate]of faults){const restore=mutate();assert.equal(guard.snapshot().ready,false,name);restore();assert.equal(guard.snapshot().ready,true,name+' restored');}
  // Host window retirement is the production shared native lookup boundary.
  h.exports.wnd_lookup_retire(65538);assert.equal(guard.snapshot().ready,false,'retired native HWND');
  console.log('PASS real native hidden-console -> focused viewport; shadow isolation; process/hidden/memory/actor/freshness/focus/retired-HWND negatives');
 }finally{clearTimeout(timer);await worker.terminate();}
}
if(isMainThread&&require.main===module)(async()=>{
 await main();if(!process.argv[2]){
  await main('modeless');await main('modeless-mouse');await main('modeless-mouse-popup');
  for(const fault of ['detach','retire','geometry'])await main('modeless-mouse',fault);
 }
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={fixture,main:isMainThread?main:null};
