#!/usr/bin/env node
'use strict';
// Real manager + worker dispatcher; small injected adapters expose ordering
// independently of GPU availability and native rasterizer execution speed.
const assert=require('assert'),fs=require('fs'),vm=require('vm'),path=require('path');
const {Manager}=require('../lib/render-worker');
const Stream=require('../lib/d3d-command-stream');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(legacy=false,nativeMemory=false){
  const events=[],pending=[],listeners=new Map();let init=0,retire=0,terminated=0,transients=0;
  const self={postMessage(message,transfer){
    const owned=structuredClone(message,{transfer:transfer||[]});
    queueMicrotask(()=>{for(const f of listeners.get('message')||[])f({data:owned});});
  }};
  const factory={create({options,sendFrame}){
    return {execute(message){
      assert.strictEqual(transients,0,'peer starts with cleared raster hooks and state override');
      const p=message.payload||message;events.push(['execute',options.name,p.kind,p.value]);
      if(p.kind==='hold'){
        transients=7;
        return {value:p.value,completion:new Promise(resolve=>pending.push(()=>{
          assert.strictEqual(transients,7,'raster hooks survive until asynchronous completion');resolve();
        }))};
      }
      if(p.kind==='fail'){transients=7;throw new WebAssembly.RuntimeError('injected endpoint failure');}
      if(p.kind==='frame')sendFrame({pixels:new Uint8Array([p.value]),width:1,height:1});
      return {complete:true,value:p.value};
    },destroy(){events.push(['destroy',options.name]);}};
  }};
  Object.assign(self,{GpuStreamRenderWorker:factory,D3DIMRenderWorker:factory,
    D3DCommandStream:Stream});
  const sharedMemory=nativeMemory ? new WebAssembly.Memory({initial:96,maximum:96,shared:true})
    : {buffer:new SharedArrayBuffer(legacy?6*1024*1024:1024)};
  let allocation=4096;
  const exports={d3d_render_reset_transients(){transients=0;},d3dim_worker_init(){init++;},d3d_render_retire_heap(){retire++;return 1234;},
    guest_to_wasm:p=>p,
    guest_alloc(bytes){const p=allocation;allocation+=bytes;return p;}};
  if(legacy){
    // The production D3DIM adapter (software OpenGL replay only); load it unmodified.
    const adapterContext={module:{exports:{}},require:()=>({}),DataView,Error};
    vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../lib/d3dim-render-worker.js'),'utf8'),adapterContext);
    self.D3DIMRenderWorker=adapterContext.module.exports;
  }
  const imported=new Set(),importOrder=[],failedImports=new Set();
  const context={self,importScripts(url){
    importOrder.push(url);
    if(failedImports.delete(url))throw new Error('injected import failure');
    assert(!imported.has(url),'dependency evaluated twice: '+url);imported.add(url);
  },setTimeout,clearTimeout,performance,console,
    ArrayBuffer,SharedArrayBuffer,Uint8Array,Int32Array,DataView,Atomics,Map,Set,Promise,
    WebAssembly:{Memory:WebAssembly.Memory,Module:WebAssembly.Module,instantiate:async()=>({exports})}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../lib/d3d-render-worker.js'),'utf8'),context);
  const worker={addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},
    postMessage(message){const owned=structuredClone(message);queueMicrotask(()=>self.onmessage({data:owned}));},
    terminate(){terminated++;return Promise.resolve();}};
  const adopted=[];
  const manager=new Manager({workerFactory:()=>worker,module:{},memory:sharedMemory,
    sigs:{},imageBase:0x400000,maxQueuedCommands:2,maxQueuedBytes:legacy?65536:4096,reclaimHeap:p=>{adopted.push(p);return 1;}});
  return {manager,events,pending,adopted,sharedMemory,importOrder,failedImports,counts:()=>({init,retire,terminated})};
}
function encoderScopedFence(){
  let control,consume=false;const messages=[];
  const memory={buffer:new SharedArrayBuffer(4096)},descriptor=new DataView(memory.buffer);
  [64,1032,1200,200].forEach((v,i)=>descriptor.setUint32(i*4,v,true));
  const worker={postMessage(message){
    messages.push(message);
    if(message.t==='init'){control=new Int32Array(message.control);Atomics.store(control,0,1);}
    if(message.t==='batch'&&consume)Atomics.store(control,1,message.seq);
    // Deliberately leave batches in flight. The second draw remains buffered
    // until the scoped fence submits it. The synchronous reply avoids waits.
    if(message.t==='legacy-fence'){
      Atomics.store(control,11,message.length?2:1);Atomics.store(control,1,message.seq);
    }
  },terminate(){}};
  const encoder=new Stream.Encoder({workerFactory:()=>worker,memory,module:{},
    getImageBase:()=>0x400000,guestToWasm:p=>p,explicitFence:true});
  assert.strictEqual(encoder.call(0x20005,0),1);
  assert.strictEqual(encoder.call(0x20005,0),1);
  assert.strictEqual(messages.filter(m=>m.t==='batch').length,1,'second draw is pending before barrier');
  assert.strictEqual(encoder.call(0x20001,8194,3),2,'producer preserves partially synchronized result');
  assert.deepStrictEqual(messages.map(m=>m.t),['init','batch','batch','legacy-fence'],'pending snapshots precede scoped barrier');
  assert.deepStrictEqual([messages.at(-1).address,messages.at(-1).length],[8194,3]);
  const scopedSequence=messages.at(-1).seq;
  assert.strictEqual(encoder.call(0x20001,0,0),1,'empty global barrier still reaches consumer');
  assert(messages.at(-1).seq>scopedSequence);
  assert.deepStrictEqual([messages.at(-1).address,messages.at(-1).length],[0,0]);
  assert.strictEqual(encoder.snapshot().transportFences,2);
  // 0x20007 (lazy shared-surface publication), 0x2000A (present) and 0x20004
  // (clear) belong to the WAT producer since GPU stream v2 D2c; the software
  // transport declines them without posting anything.
  const before=messages.length;
  for(const opcode of [0x20004,0x20007,0x2000A])
    assert.strictEqual(encoder.call(opcode,0,0),-1,'software transport declines GPU opcode 0x'+opcode.toString(16));
  assert.strictEqual(messages.length,before,'declined GPU opcodes post nothing');
  encoder.stop();
}
encoderScopedFence();
// Actual adapter, with the native boundary controlled: only calls returning
// normally count. These are D3DIM calls, not software OpenGL or pixel writes.
{
  let fail=false;
  const context={module:{exports:{}},require:()=>({}),DataView,Error};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../lib/d3dim-render-worker.js'),'utf8'),context);
  // D3DIM is GPU stream v2 only: the adapter replays software OpenGL and
  // refuses the retired D3DIM draw opcode instead of rasterizing it.
  const adapter=context.module.exports.create({backend:'software',
    memory:{buffer:new ArrayBuffer(64)},instance:{exports:{
      gl_sw_worker_draw(){if(fail)throw new Error('native draw failed');return 1;},
    }}});
  assert.throws(()=>adapter.execute({opcode:0x20000,wa:0}),/retired or unknown/);
  assert.strictEqual(adapter.execute({opcode:0x20005,wa:0}),1);
  fail=true;
  assert.throws(()=>adapter.execute({opcode:0x20005,wa:0}),/native draw failed/);
  assert.strictEqual(adapter.d3dimSoftwareDrawCallsCompleted,0,'no D3DIM draw completes on the adapter');
}
(async()=>{
  const f=fixture(),a=f.manager.createEndpoint({api:'glide',name:'a'}),b=f.manager.createEndpoint({api:'d3dim',name:'b'});
  await Promise.all([a.ready,b.ready]);
  assert.strictEqual(f.counts().init,1,'one native initializer for both APIs');
  const first=a.request({kind:'hold',value:1});
  const packet={kind:'echo',value:new Uint8Array([7])};
  const second=b.request(packet);packet.value[0]=99;
  await assert.rejects(b.request({kind:'echo',value:3}),/capacity/);
  await tick();
  assert.strictEqual(f.events.filter(e=>e[0]==='execute').length,1,'other endpoint waits for sliced draw completion');
  f.pending.shift()();assert.strictEqual(await first,1);
  assert.deepStrictEqual(await second,new Uint8Array([7]),'postMessage owns mutable payload');
  await tick();assert.strictEqual(f.manager.queuedBytes,0);
  await assert.rejects(a.request({kind:'echo',value:new Uint8Array(5000)}),/capacity/);
  let frame;
  b.addEventListener('message',event=>{if(event.data.t==='frame')frame=event.data.frame;});
  await b.request({kind:'frame',value:42});assert.strictEqual(frame.pixels[0],42);
  await assert.rejects(a.request({kind:'fail'}),/injected/);
  assert.strictEqual(await b.request({kind:'echo',value:4}),4,'failed endpoint does not poison peer');
  await a.terminate();assert.strictEqual(f.counts().retire,0,'closing endpoint keeps process heap');
  const another=f.manager.createEndpoint({api:'d3dim',name:'second-d3dim',backend:'software'});
  await another.ready;
  assert.strictEqual(f.importOrder.filter(url=>url==='d3dim-render-worker.js').length,1,'dependencies shared across endpoints');
  await another.terminate();
  const d3d9=f.manager.createEndpoint({api:'d3d9-gps',name:'native-d3d9'});
  await d3d9.ready;
  assert.strictEqual(await d3d9.request({kind:'echo',value:9}),9,
    'native D3D9 opens the shared GPU stream endpoint used by CreateDevice');
  assert.strictEqual(f.importOrder.filter(url=>url==='gpu-stream-render-worker.js').length,1,
    'D3D9 shares the existing GPU stream dependency closure');
  await assert.rejects(d3d9.request({kind:'fail'}),/injected/);
  assert.strictEqual(await b.request({kind:'echo',value:5}),5,
    'a D3D9 endpoint failure remains scoped to its endpoint');
  await d3d9.terminate();
  await b.terminate();await f.manager.stop();
  assert.deepStrictEqual(f.adopted,[1234]);
  assert.deepStrictEqual(f.counts(),{init:1,retire:1,terminated:1});
  await f.manager.stop();assert.strictEqual(f.counts().retire,1,'idempotent process shutdown');
  // The legacy decoder's D3DIM draw/flip replay into the D3DIM adapter is
  // retired (D3DIM is GPU stream v2 only; the adapter replays software GL).
  let orphanTerminated=0;
  assert.throws(()=>new Manager({workerFactory:()=>({addEventListener(){},postMessage(){throw new Error('clone failed');},
    terminate(){orphanTerminated++;}}),module:{},memory:{},imageBase:0x400000}),/clone failed/);
  assert.strictEqual(orphanTerminated,1,'failed constructor terminates unowned worker');
  console.log('PASS shared render worker: global completion order, ownership/bounds, frames, scoped errors and single heap retirement');
})().catch(error=>{console.error(error);process.exit(1);});
