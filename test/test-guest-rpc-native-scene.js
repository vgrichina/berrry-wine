'use strict';
// Actual x86 USER calls in an owning Worker, with the page's separate shadow
// instance sharing the same memory. No original application or private focus
// writes: the authored PE creates two windows, hides the first and focuses
// and captures the second through ordinary imports.
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const {Worker,isMainThread,parentPort,workerData}=require('node:worker_threads');
function fixture(variant='viewport'){
 const b=require('./test-disciples2-native-paint-binding.cjs').fixture(false),raw=r=>r-0x1000+0x400;
 const word=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];
 for(const [i,name]of ['ShowWindow','SetCapture','PeekMessageA'].entries()){
  b.writeUInt32LE(0x1d00+i*64,raw(0x1334+i*4));b.write(name+'\0',raw(0x1d02+i*64));
 }b.writeUInt32LE(0,raw(0x1340));
 const a=[],emit=(...v)=>a.push(...v),push=n=>emit(0x68,...word(n)),call=n=>emit(0xff,0x15,...word(n));
 const handle=p=>emit(0xff,0x35,...word(p));
 push(0x403500);call(0x401300);
 for(const store of [0x403600,0x403604]){
  for(const n of [0,0x400000,0,0,480,640,0,0,0x90c80000,0x403080,0x403000,0])push(n);
  call(0x401304);emit(0xa3,...word(store));
  if(store===0x403600){handle(store);call(0x401308);}
 }
 if(variant!=='visible-main'){push(0);handle(0x403600);call(0x401334);}
 handle(0x403604);call(0x401308);handle(0x403604);call(0x401338);
 if(variant==='hidden-viewport'){push(0);handle(0x403604);call(0x401334);}
 const pump=a.length;
 for(const n of [1,0,0,0,0x403640])push(n);call(0x40133c);
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
async function main(variant=process.argv[2]||'viewport'){
 assert(['viewport','visible-main','hidden-viewport'].includes(variant));
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
 let resolve,reject;const observation=new Promise((r,j)=>{resolve=r;reject=j;});
 table.input_validate=token=>token===0?0x424e49:0;
 table.check_input=(...scene)=>{guard.withActor(0,'check_input',()=>guard.observe(scene));resolve(scene);return 0;};
 const broker=RPC.createMainBroker(h.memory,table,sigs);
 const worker=new Worker(__filename,{workerData:{module,memory:h.memory,sigs,variant}});actor.worker=worker;
 const timer=setTimeout(()=>reject(Error('native scene deadline')),10000);
 worker.on('error',reject);worker.on('message',m=>{try{if(m.t==='rpc')broker.serveRpc(m.slot);
  if(m.t==='calls')broker.serveCalls(m);if(m.t==='error')reject(Error(m.error));}catch(e){reject(e);}});
 try{
  const scene=await observation;clearTimeout(timer);
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
if(isMainThread&&require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={fixture,main:isMainThread?main:null};
