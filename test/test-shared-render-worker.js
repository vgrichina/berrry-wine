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
  Object.assign(self,{GlideRenderWorker:factory,GLRenderWorker:factory,D3DIMRenderWorker:factory,
    D3D9RenderWorker:factory,D3DCommandStream:Stream});
  const sharedMemory=nativeMemory ? new WebAssembly.Memory({initial:96,maximum:96,shared:true})
    : {buffer:new SharedArrayBuffer(legacy?6*1024*1024:1024)};
  let allocation=4096,override=0;
  const exports={d3d_render_reset_transients(){transients=0;override=0;},d3dim_worker_init(){init++;},d3d_render_retire_heap(){retire++;return 1234;},
    d3dim_worker_draw(...args){events.push(['software-draw',...args]);},
    d3dim_worker_flip(...args){events.push(['flip',...args]);},
    guest_to_wasm:p=>p,
    d3dim_gpu_state_override(p){override=p;events.push(['override',p]);},
    guest_alloc(bytes){const p=allocation;allocation+=bytes;return p;}};
  if(legacy){
    class FakeGPU {
      constructor(){this.targets=new Map();}
      call(opcode,wa,length=0){
        if(opcode===0x20001)return this.fence(wa,length);
        const d=new DataView(sharedMemory.buffer);
        if(opcode===0x20000){
          assert(override,'GPU draw receives packet state override');
          assert.strictEqual(d.getUint32(wa+20,true),override);
          events.push(['gpu-draw',d.getUint32(override,true),d.getUint32(d.getUint32(wa+12,true),true)]);
          return d.getUint32(wa+4,true)===1?0:1;
        }
        assert.strictEqual(override,0,'state override reset before clear');
        events.push(['gpu-clear',wa]);return 7;
      }
      fence(address=0,length=0){assert.strictEqual(override,0);events.push(['gpu-fence',address,length]);return length?2:1;}
      snapshot(){return {draws:events.filter(e=>e[0]==='gpu-draw').length};}
      stop(){events.push(['gpu-stop']);}
    }
    const adapterContext={module:{exports:{}},require:()=>({D3DIMGpu:FakeGPU}),DataView,Error};
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
  encoder.stop();
  messages.length=0;
  const shared=new Stream.Encoder({workerFactory:()=>worker,memory,module:{},
    getImageBase:()=>0x400000,guestToWasm:p=>p,explicitFence:true,sharedSurfaceSync:true});
  // Already consumed batches need no readback to publish a lazy range.
  assert.strictEqual(shared.call(0x20007,0,0),1);
  assert.deepStrictEqual(messages.map(m=>m.t),['init']);
  consume=true;
  shared.call(0x20005,0);shared.call(0x20005,0);
  assert.strictEqual(shared.call(0x20007,0,0),1);
  assert.deepStrictEqual(messages.map(m=>m.t),['init','batch','batch'],
    'lazy publication consumes both buffered batches without requesting readback');
  assert.strictEqual(shared.snapshot().publications,2);
  assert.strictEqual(shared.snapshot().transportFences,0);
  assert.strictEqual(shared.snapshot().publicationWaitMs,0,'already completed publication does not wait');
  assert.strictEqual(encoder.call(0x20007,0,0),0,'private encoder declines shared lazy synchronization');
  shared.stop();
}
encoderScopedFence();
// Actual adapter, with the native boundary controlled: only calls returning
// normally count. These are D3DIM calls, not software OpenGL or pixel writes.
{
  let fail=false;
  const context={module:{exports:{}},require:()=>({}),DataView,Error};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../lib/d3dim-render-worker.js'),'utf8'),context);
  const adapter=context.module.exports.create({backend:'software',
    memory:{buffer:new ArrayBuffer(64)},instance:{exports:{
      d3dim_worker_draw(){if(fail)throw new Error('native draw failed');},
      gl_sw_worker_draw(){return 1;},
    }}});
  adapter.execute({opcode:0x20000,wa:0});
  assert.strictEqual(adapter.d3dimSoftwareDrawCallsCompleted,1);
  fail=true;
  assert.throws(()=>adapter.execute({opcode:0x20000,wa:0}),/native draw failed/);
  assert.strictEqual(adapter.d3dimSoftwareDrawCallsCompleted,1,'throwing draw does not complete');
  adapter.execute({opcode:0x20005,wa:0});
  assert.strictEqual(adapter.d3dimSoftwareDrawCallsCompleted,1,'GL has separate evidence semantics');
}
(async()=>{
  const f=fixture(),a=f.manager.createEndpoint({api:'glide',name:'a'}),b=f.manager.createEndpoint({api:'gl',name:'b'});
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
  const anotherGL=f.manager.createEndpoint({api:'gl',name:'second-gl',backend:'software'});
  await anotherGL.ready;
  assert.strictEqual(f.importOrder.filter(url=>url==='mem-utils.js').length,1,'GL dependencies shared across endpoints');
  await anotherGL.terminate();
  f.failedImports.add('d3d9-fixed.js');
  const failedLoad=f.manager.createEndpoint({api:'neutral',name:'failed-load'});
  await assert.rejects(failedLoad.ready,/injected import failure/);
  await failedLoad.terminate();

  // Existing neutral command receipts use a separate per-port namespace.
  const c=f.manager.createEndpoint({api:'neutral',name:'c'});await c.ready;
  assert.strictEqual(f.importOrder.filter(url=>url==='d3d9-fixed.js').length,2,'failed dependency retried');
  assert.strictEqual(f.importOrder.filter(url=>url==='d3d9-shader.js').length,1,'successful predecessor retained across retry');
  const consumer=new Stream.WorkerConsumer(c);
  const command={version:Stream.VERSION,opcode:Stream.OPCODES.FENCE,deviceId:1,generation:1,sequence:1,payload:{kind:'echo',value:9}};
  const receipt=consumer.execute(command);await receipt.consumed;await receipt.completion;
  assert.strictEqual(await receipt.value,9);
  await consumer.cancel(1);assert.strictEqual(f.counts().retire,0);
  await b.terminate();await f.manager.stop();
  assert.deepStrictEqual(f.adopted,[1234]);
  assert.deepStrictEqual(f.counts(),{init:1,retire:1,terminated:1});
  await f.manager.stop();assert.strictEqual(f.counts().retire,1,'idempotent process shutdown');
  // Production Encoder -> Manager endpoint -> worker legacy decoder ->
  // D3DIM adapter, with only the WASM/GPU executor and event delivery mocked.
  // Queued render-state generations survive producer scratch reuse. Palette
  // payloads are not copied by this protocol: this is NOT a COM lifetime test.
  {
    // A real Memory handle follows the manager's initialization-handle byte
    // accounting; a plain {buffer} mock would charge the entire shared heap.
    const q=fixture(true,true),port=q.manager.createEndpoint({api:'legacy',backend:'webgl'});
    await port.ready;
    const encoder=new Stream.Encoder({workerFactory:()=>port,memory:q.sharedMemory,module:{},
      getImageBase:()=>0x400000,guestToWasm:p=>p,capacity:32+4096+96});
    await tick();
    const d=new DataView(q.sharedMemory.buffer),descriptor=65536,state=131072,vertices=140000;
    [123,4,3,vertices,3,state].forEach((v,i)=>d.setUint32(descriptor+i*4,v,true));
    for(const [generation,vertex] of [[31,41],[32,42]]){
      d.setUint32(state,generation,true);d.setUint32(vertices,vertex,true);
      assert.strictEqual(encoder.enqueue(descriptor),1);
    }
    d.setUint32(state,99,true);d.setUint32(vertices,99,true);
    assert.strictEqual(q.events.filter(e=>e[0]==='gpu-draw').length,0,'producer changes precede drain');
    await tick();
    assert.deepStrictEqual(q.events.filter(e=>e[0]==='gpu-draw'),
      [['gpu-draw',31,41],['gpu-draw',32,42]],'both queued snapshots retain FIFO generation');
    assert.strictEqual(encoder.snapshot().replayCommands,2);
    assert.strictEqual(encoder.snapshot().fallbacks,0);
    assert.strictEqual(q.events.filter(e=>e[0]==='software-draw').length,0,'no software fallback');
    encoder.stop();await tick();await q.manager.stop();
  }
  // Actual legacy decoder + production D3DIM worker adapter. A GPU call is
  // recorded rather than rendered, so the fixture isolates ordering and owns
  // the expected snapshot values independently of rasterization.
  {
  const l=fixture(true),port=l.manager.createEndpoint({api:'legacy',backend:'webgl'});
  await port.ready;
  const control=new Int32Array(new SharedArrayBuffer(64));
  const packet=new SharedArrayBuffer(16384),d=new DataView(packet);
  let offset=0;
  function drawRecord(state,vertex,primitive=4){
    const size=32+4096+96;
    [size,123,primitive,3,3,4096,96,0].forEach((v,i)=>d.setUint32(offset+i*4,v,true));
    d.setUint32(offset+32,state,true);d.setUint32(offset+32+4096,vertex,true);offset+=size;
  }
  drawRecord(11,21);drawRecord(12,22);
  port.postMessage({t:'init',control:control.buffer,buffers:[packet]});await tick();
  port.postMessage({t:'batch',index:0,seq:1,bytes:offset,commands:2,imageBase:0x400000});await tick();
  assert.strictEqual(Atomics.load(control,1),1,'batch consumption releases snapshots');
  assert.deepStrictEqual(l.events.filter(e=>e[0]==='gpu-draw'),[['gpu-draw',11,21],['gpu-draw',12,22]]);
  assert.strictEqual(l.events.filter(e=>e[0]==='gpu-fence').length,0,'no readback per batch');
  let gpuStats;
  port.onmessage=event=>{if(event.data.t==='stats')gpuStats=event.data.stats;};
  port.postMessage({t:'legacy-fence',seq:2,address:8194,length:3});await tick();
  assert.strictEqual(Atomics.load(control,1),2);assert.strictEqual(gpuStats.draws,2);
  assert.strictEqual(gpuStats.d3dimSoftwareDrawCallsCompleted,0);
  assert.strictEqual(gpuStats.d3dimFallbackSoftwareDrawCallsCompleted,0);
  assert.strictEqual(gpuStats.completedFenceSequence,2);
  assert.strictEqual(l.events.filter(e=>e[0]==='gpu-fence').length,1,'explicit fence materializes GPU contents');
  assert.deepStrictEqual(l.events.at(-1),['gpu-fence',8194,3],'range reaches GPU executor unchanged');
  assert.strictEqual(Atomics.load(control,11),2,'scoped fence retains other dirty targets');
  port.postMessage({t:'legacy-fence',seq:3});await tick();
  assert.strictEqual(Atomics.load(control,11),1,'global fence finishes remaining targets');
  port.postMessage({t:'legacy-call',seq:4,opcode:0x20004,wa:80});await tick();
  assert.strictEqual(Atomics.load(control,11),7,'clear returns result through shared control');
  assert.strictEqual(Atomics.load(control,1),4);
  offset=0;drawRecord(13,23,1);
  [32,123,456,0,0,0,0,1].forEach((v,i)=>d.setUint32(offset+i*4,v,true));offset+=32;
  port.postMessage({t:'batch',index:0,seq:5,bytes:offset,commands:2,imageBase:0x400000});await tick();
  const softwareIndex=l.events.findIndex(e=>e[0]==='software-draw');
  assert.strictEqual(l.events[softwareIndex-1][0],'gpu-fence','fallback materializes prior GPU writes');
  const flipIndex=l.events.findIndex(e=>e[0]==='flip');
  assert.strictEqual(l.events[flipIndex-1][0],'gpu-fence','DIB swap follows GPU materialization');
  port.postMessage({t:'legacy-fence',seq:6});await tick();
  assert.strictEqual(gpuStats.d3dimFallbackSoftwareDrawCallsCompleted,1,'one completed fallback; flip is not a draw');
  assert.strictEqual(gpuStats.d3dimSoftwareDrawCallsCompleted,0,'fallback stays separate from requested software');
  const gpuEndpoint=gpuStats.renderEndpointId;
  const peer=l.manager.createEndpoint({api:'legacy',backend:'software'});
  await peer.ready;
  const peerControl=new Int32Array(new SharedArrayBuffer(64));
  let softwareStats;
  peer.onmessage=event=>{if(event.data.t==='stats')softwareStats=event.data.stats;};
  peer.postMessage({t:'init',control:peerControl.buffer,buffers:[packet]});await tick();
  const priorFences=l.events.filter(e=>e[0]==='gpu-fence').length;
  peer.postMessage({t:'legacy-fence',seq:1,address:8192,length:4});await tick();
  assert.strictEqual(Atomics.load(peerControl,1),1,'foreign caller completes only after owner fence');
  assert.strictEqual(l.events.filter(e=>e[0]==='gpu-fence').length,priorFences+1,
    'producer without a GPU still reaches the owning endpoint');
  assert.strictEqual(Atomics.load(peerControl,11),2,'foreign producer receives pending-target result');
  assert.strictEqual(softwareStats.d3dimSoftwareDrawCallsCompleted,0,'foreign fence cannot claim owner draws');
  assert.strictEqual(softwareStats.d3dimFallbackSoftwareDrawCallsCompleted,0);
  assert.notStrictEqual(softwareStats.renderEndpointId,gpuEndpoint);
  peer.postMessage({t:'batch',index:0,seq:2,bytes:offset,commands:2,imageBase:0x400000});await tick();
  assert.strictEqual(softwareStats.d3dimSoftwareDrawCallsCompleted,0,'no extra telemetry publication per batch');
  peer.postMessage({t:'legacy-fence',seq:3});await tick();
  assert.strictEqual(softwareStats.d3dimSoftwareDrawCallsCompleted,1,'native draw completed; flip excluded');
  assert.strictEqual(softwareStats.d3dimFallbackSoftwareDrawCallsCompleted,0);
  assert.strictEqual(softwareStats.completedFenceSequence,3);
  assert.strictEqual(softwareStats.requestedBackend,'software');
  await peer.terminate();
  port.postMessage({t:'legacy-close'});await tick();
  assert(l.events.some(e=>e[0]==='gpu-stop'));assert.strictEqual(l.counts().retire,0);
  await l.manager.stop();assert.strictEqual(l.counts().init,1);assert.strictEqual(l.counts().retire,1);
  let orphanTerminated=0;
  assert.throws(()=>new Manager({workerFactory:()=>({addEventListener(){},postMessage(){throw new Error('clone failed');},
    terminate(){orphanTerminated++;}}),module:{},memory:{},imageBase:0x400000}),/clone failed/);
  assert.strictEqual(orphanTerminated,1,'failed constructor terminates unowned worker');
  }
  console.log('PASS shared render worker: global completion order, ownership/bounds, frames, scoped errors, neutral receipts and single heap retirement');
})().catch(error=>{console.error(error);process.exit(1);});
