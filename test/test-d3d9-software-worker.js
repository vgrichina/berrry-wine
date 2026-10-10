#!/usr/bin/env node
'use strict';
const assert=require('assert');
const path=require('path');
const {Worker}=require('worker_threads');
const {compileSrcWasm}=require('./compile-src');
const {Device}=require('../lib/d3d9-software-backend');
const {CommandQueue,WorkerConsumer,OPCODES:OP}=require('../lib/d3d-command-stream');
const sigs=require('../lib/host-import-sigs.generated.json').sigs;
function nextMessage(worker,predicate){return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{worker.off('message',receive);reject(new Error('render worker message deadline'));},15000);
  function receive(message){if(predicate(message)){clearTimeout(timer);worker.off('message',receive);resolve(message);}}
  worker.on('message',receive);
});}
function snapshot(){
  const vertices=new Float32Array([
    -1,1,.5,1, 1,0,0,1, 0,0,0,1,
    1,1,.5,1, 1,0,0,1, 1,0,0,1,
    -1,-1,.5,1, 1,0,0,1, 0,1,0,1,
  ]);
  return {primitive:4,primitiveCount:1,stride:48,vertices:new Uint8Array(vertices.buffer),
    attributes:[{register:0,usage:0,usageIndex:0,type:3,offset:0},
      {register:1,usage:10,usageIndex:0,type:3,offset:16},{register:2,usage:5,usageIndex:0,type:3,offset:32}],
    vertexShader:new Uint32Array([0xfffe0101,1,0xc00f0000,0x90e40000,1,0xd00f0000,0x90e40001,1,0xe00f0000,0x90e40002,0xffff]),
    pixelShader:new Uint32Array([0xffff0101,1,0x800f0000,0xa0e40000,0xffff]),
    vertexConstants:new Float32Array(384),pixelConstants:new Float32Array([.25,.5,.75,1]),
    state:{zenable:true,zwrite:true,zfunc:4,blend:false,cull:1},textures:[]};
}
(async()=>{
  const module=await WebAssembly.compile(compileSrcWasm());
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),host={memory};
  for(const [name,sig] of Object.entries(sigs))host[name]=sig.results?.length?()=>0:()=>{};
  const e=(await WebAssembly.instantiate(module,{host})).exports;
  e.d3dim_worker_init(0x400000);e.set_eip(0x456789);e.set_esp(0x302004);
  const sentinelGuest=e.guest_alloc(4096)>>>0,sentinel=e.guest_to_wasm(sentinelGuest)>>>0;
  new Uint8Array(memory.buffer,sentinel,4096).fill(0xa7);
  const direct=new Device({getExports:()=>e,getMemory:()=>memory.buffer,width:16,height:16});
  direct.clear([0,1,0,1],3);const parentFrame=direct.readPixels();
  const baseBytes=direct.bytes;
  for(const invalid of [0,-1,1.5,0x100000000,NaN])assert.throws(()=>direct.queryBegin(invalid),/identity/);
  direct.queryBegin(1);direct.queryBegin(1);
  assert.strictEqual(direct.bytes,baseBytes+32,'restarting a query does not double-charge storage');
  // Wire-width arithmetic only: native raster counting is tested separately.
  direct.completedSamples=0x100000005n;
  assert.deepStrictEqual(direct.queryEnd(1),{samplesLow:5,samplesHigh:1});
  direct.queryRelease(1);
  direct.completedSamples=0n;
  const savedBudget=direct.budget;direct.budget=baseBytes;
  assert.throws(()=>direct.queryBegin(2),/budget/);
  assert.strictEqual(direct.queries.size,0,'budget rejection creates no partial query');
  direct.budget=savedBudget;
  for(let id=1;id<=4096;id++)direct.queryBegin(id);
  assert.throws(()=>direct.queryBegin(4097),/budget/,'active query count bounded');
  for(let id=1;id<=4096;id++)direct.queryRelease(id);
  assert.strictEqual(direct.bytes,baseBytes,'all query accounting reclaimed');
  const worker=new Worker(path.join(__dirname,'../lib/d3d-render-worker.js'));
  const consumer=new WorkerConsumer(worker,{module,memory,sigs,imageBase:0x400000,sourceVersion:'worker-test',
    reclaimHeap(head){assert.strictEqual(worker.threadId,-1,'adopt only after actual worker termination');return e.d3d_render_adopt_free_list(head);}});
  try{
    await consumer.ready;
    assert.strictEqual(e.get_eip()>>>0,0x456789);assert.strictEqual(e.get_esp()>>>0,0x302004);
    assert(new Uint8Array(memory.buffer,sentinel,4096).every(x=>x===0xa7),'worker initialization preserves parent guest allocation');
    assert.deepStrictEqual(direct.readPixels(),parentFrame,'worker initialization preserves canonical target');
    const queue=new CommandQueue({deviceId:19,consumer});
    const created=queue.submit(OP.RESOURCE_CREATE,{kind:'device',width:16,height:16,quadBudget:2});
    assert.deepStrictEqual(await created.value,{width:16,height:16,pitch:64});
    queue.submit(OP.CLEAR,{color:[0,0,0,1],flags:3});
    const input=snapshot(),consumed=nextMessage(worker,m=>m.t==='d3d-result'&&m.sequence===3&&m.phase==='consumed');
    const draw=queue.submit(OP.DRAW,input),frame=queue.submit(OP.PRESENT);
    input.vertices.fill(0);input.pixelConstants.fill(0);
    await consumed;
    assert.strictEqual(draw.status,'consumed');
    assert.strictEqual(queue.completed,2,'real raster work is not complete at consumption');
    const laterGuest=e.guest_alloc(4096)>>>0,later=e.guest_to_wasm(laterGuest)>>>0;
    new Uint8Array(memory.buffer,later,4096).fill(0x39);
    const actual=await frame.value;await queue.fence();
    direct.clear([0,0,0,1],3);direct.draw(snapshot());
    assert.deepStrictEqual(actual.pixels,direct.readPixels(),'same production WAT direct and render-worker pixels');
    assert.deepStrictEqual([...actual.pixels.slice(0,4)],[191,128,64,255]);
    assert(new Uint8Array(memory.buffer,sentinel,4096).every(x=>x===0xa7));
    assert(new Uint8Array(memory.buffer,later,4096).every(x=>x===0x39),'worker arena does not overlap concurrent parent allocation');
    e.guest_free(laterGuest);
    const previous=actual.pixels.slice();
    queue.submit(OP.CLEAR,{color:[1,0,0,1],flags:1});
    const cleared=await queue.submit(OP.READBACK).value;
    assert.deepStrictEqual([...cleared.pixels.slice(0,4)],[0,0,255,255]);
    assert.deepStrictEqual(actual.pixels,previous,'readback owns immutable completed frame');
    queue.submit(OP.QUERY_BEGIN,{queryId:11});
    queue.submit(OP.DRAW,snapshot());
    queue.submit(OP.QUERY_BEGIN,{queryId:12});
    queue.submit(OP.DRAW,snapshot());
    const whole=queue.submit(OP.QUERY_END,{queryId:11}),nested=queue.submit(OP.QUERY_END,{queryId:12});
    assert.deepStrictEqual(await whole.value,{samplesLow:272,samplesHigh:0},'query brackets both ordered draws');
    assert.deepStrictEqual(await nested.value,{samplesLow:136,samplesHigh:0},'overlapping query has independent baseline');
    queue.submit(OP.QUERY_BEGIN,{queryId:13});queue.submit(OP.DRAW,snapshot());
    queue.submit(OP.QUERY_BEGIN,{queryId:13});queue.submit(OP.DRAW,snapshot());
    queue.submit(OP.CLEAR,{color:[0,0,0,1],flags:3});
    assert.deepStrictEqual(await queue.submit(OP.QUERY_END,{queryId:13}).value,
      {samplesLow:136,samplesHigh:0},'BEGIN restarts bracket; Clear contributes no samples');
    queue.submit(OP.QUERY_BEGIN,{queryId:14});
    await queue.submit(OP.RESOURCE_RELEASE,{kind:'query',queryId:14}).value;
    const missing=await queue.submit(OP.QUERY_END,{queryId:14}).value;
    assert.match(missing.error.message,/no begin/,'released query cannot publish a fabricated result');
    queue.submit(OP.QUERY_BEGIN,{queryId:15});queue.submit(OP.DRAW,snapshot());
    assert.deepStrictEqual(await queue.submit(OP.QUERY_END,{queryId:15}).value,
      {samplesLow:136,samplesHigh:0},'query release does not delete the worker device');
    const stencilSurface={id:103,width:16,height:16,format:75};
    queue.submit(OP.CLEAR,{color:[0,0,0,1],flags:1});
    const wire=snapshot();Object.assign(wire.state,{fillMode:2,zenable:false,zwrite:false,lastPixel:true});
    queue.submit(OP.QUERY_BEGIN,{queryId:19});queue.submit(OP.DRAW,wire);wire.state.fillMode=3;
    assert.deepStrictEqual(await queue.submit(OP.QUERY_END,{queryId:19}).value,{samplesLow:47,samplesHigh:0},
      'wireframe worker counts original line samples, not filled triangle coverage');
    const wireFrame=await queue.submit(OP.PRESENT).value;
    assert.deepStrictEqual([...wireFrame.pixels.slice((7+7*16)*4,(8+7*16)*4)],[0,0,0,255]);
    assert.deepStrictEqual([...wireFrame.pixels.slice((8+8*16)*4,(9+8*16)*4)],[191,128,64,255],
      'worker snapshots fill state and executes original-edge native coverage');
    queue.submit(OP.CLEAR,{color:[0,0,0,1],flags:1});
    const points=snapshot();Object.assign(points.state,{fillMode:1,zenable:false,zwrite:false});
    queue.submit(OP.QUERY_BEGIN,{queryId:20});queue.submit(OP.DRAW,points);points.state.fillMode=3;
    assert.deepStrictEqual(await queue.submit(OP.QUERY_END,{queryId:20}).value,{samplesLow:1,samplesHigh:0},
      'POINT fill counts only original vertices whose pixel squares intersect viewport');
    const pointFrame=await queue.submit(OP.PRESENT).value;
    assert.deepStrictEqual([...pointFrame.pixels.slice(0,4)],[191,128,64,255]);
    assert.deepStrictEqual([...pointFrame.pixels.slice((8+8*16)*4,(9+8*16)*4)],[0,0,0,255]);
    // Point topology is independent of polygon fill/cull and emits each
    // submitted point exactly once, including coincident points.
    function pointList(positions,extra={}) {
      const s=snapshot(),v=new Float32Array(positions.length*12);
      positions.forEach((p,i)=>v.set([...p,1,0,0,1,0,0,0,1],i*12));
      return {...s,primitive:1,primitiveCount:positions.length,vertices:new Uint8Array(v.buffer),
        state:{...s.state,zenable:false,zwrite:false,fillMode:2,cull:3,...extra}};
    }
    const center=[0,0,.5,1];
    for(const [positions,state,expected] of [
      [[center],{},1],[[center,center],{},2],
      [[[-.5,.5,-.1,1],[.5,.5,1.1,1],center],{},1],
      // Production advertises MaxPointSize=1 and clamps larger requests.
      [[center],{pointSize:3,pointSizeMin:0,pointSizeMax:8},1],
      [Array.from({length:300},()=>center),{},300],
    ]) {
      const draw=pointList(positions,state);
      queue.submit(OP.CLEAR,{color:[0,0,0,1],flags:1});
      queue.submit(OP.QUERY_BEGIN,{queryId:21});queue.submit(OP.DRAW,draw);
      assert.deepStrictEqual(await queue.submit(OP.QUERY_END,{queryId:21}).value,
        {samplesLow:expected,samplesHigh:0},'point-list samples, clipping, size and batch boundaries');
      const frame=await queue.submit(OP.PRESENT).value;
      assert.deepStrictEqual([...frame.pixels.slice((8+8*16)*4,(9+8*16)*4)],[191,128,64,255]);
      assert.deepStrictEqual([...frame.pixels.slice(0,4)],[0,0,0,255],'point does not fill surrounding polygon');
    }
    const clippedPoints=pointList([[-.5,0,.5,1],[.5,0,.5,1]]);
    clippedPoints.userClipPlanes={space:'clip',mask:1,planes:new Float32Array([1,0,0,0,...Array(20).fill(0)])};
    queue.submit(OP.QUERY_BEGIN,{queryId:22});queue.submit(OP.DRAW,clippedPoints);
    assert.deepStrictEqual(await queue.submit(OP.QUERY_END,{queryId:22}).value,
      {samplesLow:1,samplesHigh:0},'user plane clips point centers without generating extra points');
    queue.submit(OP.CLEAR,{color:[0,0,0,1],flags:7,depth:1,stencil:0,depthAttachment:stencilSurface});
    const stencilWrite=snapshot();stencilWrite.depthAttachment=stencilSurface;
    Object.assign(stencilWrite.state,{stencilEnable:true,stencilPass:3,stencilRef:7,colorWriteMask:0,zwrite:false});
    queue.submit(OP.DRAW,stencilWrite);
    stencilWrite.state.stencilRef=99;
    queue.submit(OP.CLEAR,{color:[0,0,1,1],flags:1});
    queue.submit(OP.CLEAR,{color:[0,0,0,0],flags:4,stencil:0x100,rects:[[0,0,1,1]],depthAttachment:stencilSurface});
    const stencilRead=snapshot();stencilRead.depthAttachment=stencilSurface;
    Object.assign(stencilRead.state,{stencilEnable:true,stencilFunc:3,stencilRef:7});
    queue.submit(OP.QUERY_BEGIN,{queryId:18});queue.submit(OP.DRAW,stencilRead);
    assert.deepStrictEqual(await queue.submit(OP.QUERY_END,{queryId:18}).value,
      {samplesLow:135,samplesHigh:0},'occlusion excludes the one rectangular stencil-clear rejection');
    const stencilled=await queue.submit(OP.PRESENT).value;
    assert.deepStrictEqual([...stencilled.pixels.slice(0,4)],[255,0,0,255]);
    assert.deepStrictEqual([...stencilled.pixels.slice(4,8)],[191,128,64,255],
      'native worker stencil uses immutable draw state and preserves neighbors');
    await queue.submit(OP.RESOURCE_RELEASE,{kind:'depth',id:103}).value;
    const depthA={id:101,width:8,height:8,format:80},depthB={id:102,width:8,height:8,format:77};
    queue.submit(OP.QUERY_BEGIN,{queryId:17});
    await queue.submit(OP.RESOURCE_UPDATE,{kind:'reset',width:8,height:8,depthAttachment:depthA}).value;
    assert.match((await queue.submit(OP.QUERY_END,{queryId:17}).value).error.message,/no begin/,
      'successful Reset retires old query brackets');
    queue.submit(OP.CLEAR,{color:[0,0,0,1],flags:3,depth:.25,depthAttachment:depthA});
    queue.submit(OP.CLEAR,{color:[0,0,0,1],flags:3,depth:.75,depthAttachment:depthB});
    const resetDraw=()=>({...snapshot(),depthAttachment:depthA});
    queue.submit(OP.DRAW,resetDraw());
    let resized=await queue.submit(OP.PRESENT).value;
    assert.deepStrictEqual([resized.width,resized.height,resized.pitch],[8,8,32]);
    assert.deepStrictEqual([...resized.pixels.slice(0,4)],[0,0,0,255],
      'A/B/A preserves the rejecting depth contents across attachment selection');
    queue.submit(OP.DRAW,{...snapshot(),depthAttachment:depthB});
    resized=await queue.submit(OP.PRESENT).value;
    assert.deepStrictEqual([...resized.pixels.slice(0,4)],[191,128,64,255],
      'the independent B attachment accepts the same native shader fragments');
    await queue.submit(OP.RESOURCE_RELEASE,{kind:'depth',id:102}).value;
    queue.submit(OP.QUERY_BEGIN,{queryId:17});
    queue.submit(OP.DRAW,{...snapshot(),depthAttachment:null});
    assert.deepStrictEqual(await queue.submit(OP.QUERY_END,{queryId:17}).value,
      {samplesLow:36,samplesHigh:0},'fresh query and draw survive Reset and child depth release');
    queue.submit(OP.QUERY_BEGIN,{queryId:16}); // device destruction must retire this bracket
    queue.submit(OP.RESOURCE_RELEASE,{kind:'device'});await queue.fence();
    await consumer.cancel();
    assert.deepStrictEqual([consumer.shutdownInfo.devicesReleased,consumer.shutdownInfo.allocatedBytes],[0,0]);
    assert(consumer.shutdownInfo.heapAdopted>0,'native freed blocks and current arena tails return to parent');
  }finally{await consumer.cancel();}

  const cancelWorker=new Worker(path.join(__dirname,'../lib/d3d-render-worker.js'));
  let adoptedHead=0;
  const cancelConsumer=new WorkerConsumer(cancelWorker,{module,memory,sigs,imageBase:0x400000,
    reclaimHeap(head){assert.strictEqual(cancelWorker.threadId,-1);adoptedHead=head;return e.d3d_render_adopt_free_list(head);}});
  let retained=0,released=0;
  try{
    await cancelConsumer.ready;
    const queue=new CommandQueue({deviceId:20,consumer:cancelConsumer,
      retainResource:ref=>{retained++;return ref;},releaseResource:()=>{released++;}});
    queue.submit(OP.RESOURCE_CREATE,{kind:'device',width:64,height:64,quadBudget:1});await queue.fence();
    const consumed=nextMessage(cancelWorker,m=>m.t==='d3d-result'&&m.sequence===2&&m.phase==='consumed');
    queue.submit(OP.DRAW,snapshot(),{resources:[{id:999,version:1}]});
    await consumed;
    const fence=queue.fence();queue.cancel();
    assert.strictEqual(retained,1);assert.strictEqual(released,0,'termination request alone cannot retire command lease');
    await assert.rejects(fence,/cancel/i);
    await cancelConsumer.cancel();
    assert.strictEqual(released,1);
    assert.deepStrictEqual([cancelConsumer.shutdownInfo.devicesReleased,cancelConsumer.shutdownInfo.allocatedBytes],[1,0],
      'graceful cancellation frees native draw/program/texture/target allocations before termination');
    assert.strictEqual(queue.inflight,0);assert.strictEqual(queue.bytes,0);
    assert(cancelConsumer.shutdownInfo.heapAdopted>0);
    const handedSize=new DataView(memory.buffer).getUint32(e.guest_to_wasm(adoptedHead)>>>0,true);
    // Ask for more than HEAP_BIN_MAX (256): a small request is served from the
    // exact-size bins (0e43eff2) before the free list, so it proves nothing
    // about the adopted block. 1024 bytes is a 1032-byte block.
    const reuse=e.guest_alloc(1024)>>>0;
    assert.strictEqual(reuse,adoptedHead+(handedSize>=1048?handedSize-1032:0)+4,
      'parent allocator really reuses handed-off worker storage (tail-split allocator)');
    e.guest_free(reuse);
  }finally{await cancelConsumer.cancel();}
  // Forced death cannot attest native allocator handoff. Wake command waiters
  // after confirmed exit, but explicitly report orphaned native ownership; this
  // is NOT a test claiming killed-worker heap reclamation is implemented.
  const killedWorker=new Worker(path.join(__dirname,'../lib/d3d-render-worker.js'));
  const killedConsumer=new WorkerConsumer(killedWorker,{module,memory,sigs,imageBase:0x400000,
    reclaimHeap:head=>e.d3d_render_adopt_free_list(head)});
  let killedReleased=0;
  await killedConsumer.ready;
  const killedQueue=new CommandQueue({deviceId:21,consumer:killedConsumer,
    retainResource:ref=>ref,releaseResource:()=>{killedReleased++;}});
  killedQueue.submit(OP.RESOURCE_CREATE,{kind:'device',width:64,height:64,quadBudget:1});await killedQueue.fence();
  const killedConsumed=nextMessage(killedWorker,m=>m.t==='d3d-result'&&m.sequence===2&&m.phase==='consumed');
  killedQueue.submit(OP.DRAW,snapshot(),{resources:[{id:1000,version:1}]});await killedConsumed;
  const killedFence=assert.rejects(killedQueue.fence(),/exited/);
  const exit=killedWorker.terminate();assert.strictEqual(killedReleased,0);
  await exit;await killedFence;
  assert.strictEqual(killedReleased,1,'transport lease retires only after killed worker exits');
  await assert.rejects(killedConsumer.cancel(),error=>error.code==='ORPHANED');
  assert.strictEqual(killedConsumer.orphaned,true);
  assert(new Uint8Array(memory.buffer,sentinel,4096).every(x=>x===0xa7));
  assert.strictEqual(e.get_eip()>>>0,0x456789);assert.strictEqual(e.get_esp()>>>0,0x302004);
  direct.destroy();e.guest_free(sentinelGuest);
  console.log('PASS production D3D9 render Worker: real WAT pixel parity, async order, parent memory/CPU survival, immutable readback and native cleanup before termination');
})().catch(error=>{console.error(error);process.exitCode=1;});
