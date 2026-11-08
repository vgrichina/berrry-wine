#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const {Bridge,D3DIMBridge}=require('../lib/gl-render-host');
const GL=require('../lib/gl-compat');
const Stream=require('../lib/gl-command-stream');
const RPC=require('../lib/guest-rpc');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function batch(buffer,at,opcode,aux=0){
  const v=new DataView(buffer,at,32);v.setUint32(0,32,true);v.setUint32(4,opcode,true);v.setUint32(8,aux,true);
  return Stream.memoryBatch(buffer,at,32);
}
function scalarBatch(buffer,at,name,args=[]){
  const bytes=36+args.length*4,v=new DataView(buffer,at,bytes);
  new Uint8Array(buffer,at,bytes).fill(0);
  v.setUint32(0,bytes,true);v.setUint32(4,GL.CALL_INDEX[name],true);
  v.setUint32(12,4+args.length*4,true);
  args.forEach((value,i)=>v.setUint32(36+i*4,value,true));
  return Stream.memoryBatch(buffer,at,bytes);
}
function vectorBatch(buffer,at,name,args,values){
  const stackBytes=4+args.length*4,pointerOffset=32+stackBytes,bytes=pointerOffset+values.length*4;
  const v=new DataView(buffer,at,bytes);
  new Uint8Array(buffer,at,bytes).fill(0);
  v.setUint32(0,bytes,true);v.setUint32(4,GL.CALL_INDEX[name],true);
  v.setUint32(12,stackBytes,true);v.setUint32(16,args[args.length-1],true);
  v.setUint32(20,values.length*4,true);v.setUint32(24,pointerOffset,true);
  v.setUint32(28,Stream.FLAG_POINTER_COPY,true);
  args.forEach((value,i)=>v.setUint32(36+i*4,value,true));
  values.forEach((value,i)=>v.setFloat32(pointerOffset+i*4,value,true));
  return Stream.memoryBatch(buffer,at,bytes);
}
async function queuedFixture(options={}){
  const memory=new SharedArrayBuffer(options.memoryBytes||8192),requests=[],flags=[],events={};
  const renderer={windows:{8:{hwnd:8,w:2,h:2,clientRect:{left:0,top:0,right:2,bottom:2}}}};
  const port={ready:Promise.resolve(),addEventListener(type,fn){events[type]=fn;},
    request(message){const gate=deferred();requests.push({message,...gate});return gate.promise;},
    terminate(){this.stopped=true;}};
  const bridge=new Bridge({backend:'webgl',renderer,
    exports:{gl_window_readback_version:()=>1,gl_window_set_gpu_owned:(hwnd,owned)=>{flags.push([hwnd,owned]);return 1;}},
    createRenderEndpoint:()=>port,...options});
  const ready=bridge.replay(batch(memory,0,GL.CALL_INDEX.wglMakeCurrent),1);
  await tick();requests[0].resolve({value:1,activeWindows:[[1,8]],contexts:1});await ready;
  return {bridge,memory,requests,flags,port,renderer,events,
    complete(index,value=0){requests[index].resolve({value,activeWindows:[[1,8]],contexts:1});}};
}
async function queuedSnapshotsAndOrder(){
  const f=await queuedFixture(),{bridge,memory,requests,flags}=f;
  const input=scalarBatch(memory,128,'glClear',[0x4000]);
  assert.strictEqual(await bridge.replay(input,1),0,'void batch is acknowledged before rendering completes');
  await tick();assert(requests[1].message.commandBuffer instanceof ArrayBuffer);
  new DataView(memory).setUint32(164,0x0100,true);
  let copied;
  Stream.replay(Stream.memoryBatch(requests[1].message.commandBuffer,0,input.bytes),
    (op,aux,capture)=>{copied=new DataView(capture.buffer).getUint32(capture.stackOffset+4,true);return 0;});
  assert.strictEqual(copied,0x4000,'queued commands own immutable inputs after producer reuse');
  assert.deepStrictEqual(flags,[[8,1]],'canonical ownership is marked before early acknowledgement');
  await bridge.replay(scalarBatch(memory,256,'glClear',[0x0100]),1);
  assert.strictEqual(requests.length,2,'second owned batch waits behind first replay');
  let thirdDone=false,queryDone=false;
  const third=bridge.replay(scalarBatch(memory,384,'glClear',[0x0400]),1).then(()=>{thirdDone=true;});
  const query=bridge.replay(batch(memory,512,GL.CALL_INDEX.glGetError),2).then(value=>{queryDone=true;return value;});
  await tick();assert(!thirdDone&&!queryDone,'third producer is backpressured and later owner cannot overtake it');
  f.complete(1);await tick();await third;
  assert.strictEqual(requests.length,3);assert.strictEqual(requests[2].message.owner,1);
  f.complete(2);await tick();
  assert.strictEqual(requests.length,4);assert.strictEqual(requests[3].message.owner,1);
  assert(!queryDone);
  f.complete(3);await tick();
  assert.strictEqual(requests.length,5);assert.strictEqual(requests[4].message.owner,2);
  assert.strictEqual(requests[4].message.commandBuffer,undefined,'query retains shared output-memory lease');
  f.complete(4,1280);assert.strictEqual(await query,1280);
  await bridge.drain();await bridge.close();assert(f.port.stopped);
}
async function sharedPacketRotation(){
  const cap=Stream.DEFAULT_BYTES,offsets=[128,128+cap,128+cap*2];
  const f=await queuedFixture({memoryBytes:128+cap*3});
  const packet=(i,value)=>Object.assign(scalarBatch(f.memory,offsets[i],'glClear',[value]),
    {pool:{version:1,capacity:cap,offsets}});
  await f.bridge.replay(packet(0,0x4000),1);await tick();
  assert.strictEqual(f.requests[1].message.commandBuffer,undefined,'only a range in already-shared process memory is sent');
  assert.strictEqual(f.requests[1].message.memoryOffset,offsets[0]);
  await f.bridge.replay(packet(1,0x100),1);
  let thirdAck=false;
  const third=f.bridge.replay(packet(2,0x400),1).then(()=>{thirdAck=true;});
  await tick();assert(!thirdAck,'third publication cannot release writer until oldest slot consumed');
  assert.strictEqual(new DataView(f.memory).getUint32(offsets[0]+36,true),0x4000,'writing slots one/two preserves oldest payload');
  f.complete(1);await tick();await third;
  assert.strictEqual(f.requests[2].message.commandBuffer,undefined);
  const fourth=f.bridge.replay(packet(0,0x800),1);
  await tick();f.complete(2);await tick();await fourth;
  assert.strictEqual(new DataView(f.memory).getUint32(offsets[2]+36,true),0x400,'reused oldest slot does not corrupt pending third');
  f.complete(3);await tick();f.complete(4);await f.bridge.drain();
  assert.deepStrictEqual(f.bridge.packetStats,{leasedBatches:4,copiedBatches:0,copiedBytes:0});
  // Same owner may not change backing allocation while the encoder is live.
  const malformed=packet(0,0x4000);malformed.pool={version:1,capacity:cap,offsets:[128,128,128+cap*2]};
  await assert.rejects(f.bridge.replay(malformed,1),/overlapping/);
  await f.bridge.close();
  const copied=await queuedFixture({memoryBytes:128+cap*3,sharedPackets:false});
  const input=Object.assign(scalarBatch(copied.memory,128,'glClear',[0x4000]),{pool:{version:1,capacity:cap,offsets}});
  await copied.bridge.replay(input,1);await tick();
  assert(copied.requests[1].message.commandBuffer instanceof ArrayBuffer,'comparison switch retains copy transport');
  copied.complete(1);await copied.bridge.close();
}
async function queuedBarriersAndFallbacks(){
  const f=await queuedFixture(),{bridge,memory,requests}=f;
  assert.strictEqual(await bridge.replay(scalarBatch(memory,128,'gpuPresent',[0]),1),1);
  let drained=false;const drain=bridge.drain().then(()=>{drained=true;});
  await tick();assert(!drained,'presentation drain waits after early SwapBuffers acknowledgement');
  f.complete(1,1);await drain;
  const borrowed=scalarBatch(memory,256,'glClear',[0x4000]);
  new DataView(memory).setUint32(256+28,Stream.FLAG_POINTER_BORROW,true);
  let done=false;const pending=bridge.replay(borrowed,1).then(value=>{done=true;return value;});
  await tick();assert(!done);assert.strictEqual(requests[2].message.commandBuffer,undefined);
  f.complete(2,7);assert.strictEqual(await pending,7,'borrowed batch reports actual completion result');
  const unknown=batch(memory,384,0x7fffffff);
  const fallback=bridge.replay(unknown,1);await tick();
  assert.strictEqual(requests[3].message.commandBuffer,undefined,'unknown operation is never copied for early acknowledgement');
  f.complete(3,9);assert.strictEqual(await fallback,9);await bridge.close();
  const software=await queuedFixture({backend:'software'});
  let softwareDone=false;
  const sw=software.bridge.replay(scalarBatch(software.memory,128,'glClear',[0]),1).then(()=>{softwareDone=true;});
  await tick();assert(!softwareDone);assert.strictEqual(software.requests[1].message.commandBuffer,undefined);
  software.complete(1);await sw;await software.bridge.close();
}
async function queuedFailure(){
  const f=await queuedFixture();
  await f.bridge.replay(scalarBatch(f.memory,128,'glClear',[0]),1);await tick();
  f.requests[1].reject(new Error('queued GPU failure'));await tick();
  await assert.rejects(f.bridge.drain(),/queued GPU failure/);
  await assert.rejects(f.bridge.replay(batch(f.memory,256,GL.CALL_INDEX.glGetError),1),/queued GPU failure/,
    'asynchronous error survives until a subsequent guest barrier');
  assert.strictEqual(f.requests.length,2,'failed queue cannot submit further work');
  await assert.rejects(f.bridge.close(),/queued GPU failure/);assert(f.port.stopped);
}
async function queuedClose(){
  const f=await queuedFixture();
  await f.bridge.replay(scalarBatch(f.memory,128,'glClear',[0]),1);await tick();
  const closing=f.bridge.close();
  await tick();assert(!f.port.stopped,'teardown keeps endpoint alive until outstanding replay settles');
  f.complete(1);await closing;assert(f.port.stopped);
  assert.throws(()=>f.bridge.replay(batch(f.memory,256,GL.CALL_INDEX.glGetError),1),/closed/);
}
async function queuedSynchronization(){
  const f=await queuedFixture(),events=[];
  await f.bridge.replay(scalarBatch(f.memory,128,'glClear',[1]),1);await tick();
  const fence=f.bridge.synchronize(()=>{events.push('readback');f.flags.push([8,0]);});
  const next=f.bridge.replay(scalarBatch(f.memory,256,'glClear',[2]),1).then(()=>events.push('next'));
  await tick();assert.deepStrictEqual(events,[]);
  f.complete(1);await fence;await next;
  assert.deepStrictEqual(events,['readback','next'],'GDI fence action completes before next producer admission');
  assert.deepStrictEqual(f.flags,[[8,1],[8,0],[8,1]],'old fence cannot clear ownership of a later queued frame');
  await tick();f.complete(2);await f.bridge.close();
}
async function queuedOwnerInvalidation(){
  const f=await queuedFixture();
  const deletion=f.bridge.replay(batch(f.memory,128,GL.CALL_INDEX.wglDeleteContext),2);
  await tick();f.requests[1].resolve({value:1,activeWindows:[],contexts:0});await deletion;
  let settled=false;
  const present=f.bridge.replay(scalarBatch(f.memory,256,'gpuPresent',[0]),1)
    .then(value=>{settled=true;return value;});
  await tick();assert(!settled,'context deleted by another owner cannot use stale early-ACK eligibility');
  assert.strictEqual(f.requests[2].message.commandBuffer,undefined);
  f.requests[2].resolve({value:0,activeWindows:[],contexts:0});
  assert.strictEqual(await present,0,'SwapBuffers without current context preserves actual failure result');
  await f.bridge.close();
}
async function queuedPackedPayload(){
  for(const [opcode,stride] of [[Stream.PACKED_DRAW_OPCODE,Stream.VERTEX_FLOATS],
    [Stream.EXACT_DRAW_OPCODE,Stream.EXACT_VERTEX_FLOATS],
    [Stream.EDGE_DRAW_OPCODE,Stream.EXACT_VERTEX_FLOATS+1]]) {
  const f=await queuedFixture(),at=128,bytes=32+stride*4;
  const v=new DataView(f.memory,at,bytes);
  v.setUint32(0,bytes,true);v.setUint32(4,opcode,true);v.setUint32(8,4,true);
  v.setUint32(20,stride*4,true);v.setUint32(24,32,true);
  v.setUint32(28,Stream.FLAG_POINTER_COPY,true);v.setFloat32(32,42.5,true);
  await f.bridge.replay(Stream.memoryBatch(f.memory,at,bytes),1);await tick();
  v.setFloat32(32,-1,true);let position;
  Stream.replay(Stream.memoryBatch(f.requests[1].message.commandBuffer,0,bytes),(op,aux,capture)=>{
    position=new Float32Array(capture.buffer,capture.pointerOffset,stride)[0];return 0;
  });
  assert.strictEqual(position,42.5,'packed vertex payload is copied with its relative pointer intact');
  f.complete(1);await f.bridge.drain();
  for(const borrowed of [false,true]) {
    v.setUint32(20,(stride-(borrowed?0:1))*4,true);
    v.setUint32(28,borrowed?Stream.FLAG_POINTER_BORROW:Stream.FLAG_POINTER_COPY,true);
    let acknowledged=false;
    const index=f.requests.length;
    const pending=f.bridge.replay(Stream.memoryBatch(f.memory,at,bytes),1).then(()=>{acknowledged=true;});
    await tick();assert(!acknowledged,'borrowed or incomplete vertices retain the producer lease');
    assert.strictEqual(f.requests[index].message.commandBuffer,undefined);
    f.complete(index);await pending;
  }
  await f.bridge.close();
  }
}
async function queuedCopiedVectors(){
  const f=await queuedFixture(),pointer=0x30000000;
  const cases=[
    ['glLightfv',[0x4000,0x1203,pointer],[1,2,3,4]],
    ['glMaterialfv',[0x0408,0x1200,pointer],[0.25,0.5,0.75,1]],
    ['glMaterialfv',[0x0408,GL.constants.SHININESS,pointer],[32]],
    ['glLightModelfv',[GL.constants.LIGHT_MODEL_AMBIENT,pointer],[0.25,0.5,0.75,1]],
    ['glFogfv',[GL.constants.FOG_COLOR,pointer],[0.25,0.5,0.75,1]],
    ['glFogfv',[0x0B62,pointer],[0.5]],
    ['glLoadMatrixf',[pointer],Array.from({length:16},(_,i)=>i)],
    ['glMultMatrixf',[pointer],Array.from({length:16},(_,i)=>i+1)],
  ];
  for(const [name,args,values] of cases){
    const input=vectorBatch(f.memory,128,name,args,values);
    // A present at the tail models WC3's frame-end batch: copied state must
    // not force the entire frame back onto the synchronous transport.
    const present=scalarBatch(f.memory,128+input.bytes,'gpuPresent',[0]);
    input.bytes+=present.bytes;
    const index=f.requests.length;
    assert.strictEqual(await f.bridge.replay(input,1),1,`${name}: copied frame acknowledged before replay`);
    await tick();
    const message=f.requests[index].message;
    assert(message.commandBuffer instanceof ArrayBuffer,`${name}: command packet owns copied vectors`);
    new Uint8Array(f.memory,128,input.bytes).fill(0xEE);
    let observed;
    Stream.replay(Stream.memoryBatch(message.commandBuffer,0,input.bytes),(op,aux,capture)=>{
      if(op===GL.CALL_INDEX[name])observed=Array.from(new Float32Array(capture.buffer,capture.pointerOffset,values.length));
      return 0;
    });
    assert.deepStrictEqual(observed,values,`${name}: vector survives producer overwrite`);
    f.complete(index,1);await f.bridge.drain();
  }
  // Finish is an explicit fence, even after a copied vector frame.
  let finished=false;
  const finish=f.bridge.replay(scalarBatch(f.memory,128,'glFinish'),1).then(()=>{finished=true;});
  await tick();assert(!finished,'glFinish cannot be acknowledged before render completion');
  const index=f.requests.length-1;
  assert.strictEqual(f.requests[index].message.commandBuffer,undefined,'glFinish remains synchronous');
  f.complete(index);await finish;await f.bridge.close();
}
async function queuedMalformedVectors(){
  const f=await queuedFixture(),pointer=0x30000000;
  const cases=[
    ['wrong pointer', 'glLightfv',[0x4000,0x1203,pointer],[1,2,3,4],v=>v.setUint32(16,pointer+16,true)],
    ['missing copy', 'glLightfv',[0x4000,0x1203,pointer],[1,2,3,4],v=>v.setUint32(24,0,true)],
    ['borrowed vector', 'glLightfv',[0x4000,0x1203,pointer],[1,2,3,4],v=>v.setUint32(28,Stream.FLAG_POINTER_BORROW,true)],
    ['short light vector', 'glLightfv',[0x4000,0x1203,pointer],[1],()=>{}],
    ['short material color', 'glMaterialfv',[0x0408,0x1200,pointer],[1],()=>{}],
    ['long shininess', 'glMaterialfv',[0x0408,GL.constants.SHININESS,pointer],[1,2,3,4],()=>{}],
    ['short ambient model', 'glLightModelfv',[GL.constants.LIGHT_MODEL_AMBIENT,pointer],[1],()=>{}],
    ['short fog color', 'glFogfv',[GL.constants.FOG_COLOR,pointer],[1],()=>{}],
    ['long fog scalar', 'glFogfv',[0x0B62,pointer],[1,2,3,4],()=>{}],
    ['truncated argument stack', 'glLightfv',[0x4000,0x1203,pointer],[1,2,3,4],v=>v.setUint32(12,4,true)],
    ['payload overlaps arguments', 'glLightfv',[0x4000,0x1203,pointer],[1,2,3,4],v=>v.setUint32(24,32,true)],
    ['matrix pointer mismatch', 'glLoadMatrixf',[pointer],Array(16).fill(1),v=>v.setUint32(16,pointer+4,true)],
  ];
  for(const [label,name,args,values,change] of cases){
    const input=vectorBatch(f.memory,128,name,args,values);change(new DataView(f.memory,128,input.bytes));
    let settled=false;
    const index=f.requests.length;
    const pending=f.bridge.replay(input,1).then(value=>{settled=true;return value;});
    await tick();assert(!settled,`${label}: malformed snapshot must retain synchronous lease`);
    assert.strictEqual(f.requests[index].message.commandBuffer,undefined,label);
    f.complete(index,37);assert.strictEqual(await pending,37,`${label}: preserves actual replay result`);
  }
  await f.bridge.close();
}
async function queuedSmallTextureUploads(){
  const f=await queuedFixture(),memory=new SharedArrayBuffer(131072),pointer=0x30000000;
  for(const [w,h,format] of [[16,16,0x1908],[128,128,0x80E1],[3,1,0x1908]]){
    const input=vectorBatch(memory,128,'glTexSubImage2D',
      [0x0DE1,0,0,0,w,h,format,0x1401,pointer],Array(w*h).fill(0.5));
    const index=f.requests.length;
    assert.strictEqual(await f.bridge.replay(input,1),0);
    await tick();assert(f.requests[index].message.commandBuffer instanceof ArrayBuffer);
    new Uint8Array(memory,128,input.bytes).fill(0);
    let copied;
    Stream.replay(Stream.memoryBatch(f.requests[index].message.commandBuffer,0,input.bytes),
      (op,aux,capture)=>{copied=new Float32Array(capture.buffer,capture.pointerOffset,w*h)[0];return 0;});
    assert.strictEqual(copied,0.5,'small texture bytes are owned after producer reuse');
    f.complete(index);await f.bridge.drain();
  }
  const cases=[
    ['large',128,129,0x1908,0x1401,()=>{}],
    ['padded',3,2,0x1908,0x1401,()=>{}],
    ['RGB',16,16,0x1907,0x1401,()=>{}],
    ['packed type',16,16,0x1908,0x8033,()=>{}],
    ['wrong pointer',16,16,0x1908,0x1401,v=>v.setUint32(16,pointer+4,true)],
    ['short copied span',16,16,0x1908,0x1401,v=>v.setUint32(20,1020,true)],
    ['missing copy',16,16,0x1908,0x1401,v=>v.setUint32(24,0,true)],
    ['borrowed',16,16,0x1908,0x1401,v=>v.setUint32(28,Stream.FLAG_POINTER_BORROW,true)],
    ['short stack',16,16,0x1908,0x1401,v=>v.setUint32(12,36,true)],
    ['null pointer',16,16,0x1908,0x1401,v=>{v.setUint32(16,0,true);v.setUint32(68,0,true);}],
  ];
  for(const [label,w,h,format,type,change] of cases){
    const input=vectorBatch(memory,128,'glTexSubImage2D',
      [0x0DE1,0,0,0,w,h,format,type,pointer],Array(w*h).fill(0.5));
    change(new DataView(memory,128,input.bytes));
    const index=f.requests.length;let settled=false;
    const pending=f.bridge.replay(input,1).then(value=>{settled=true;return value;});
    await tick();assert(!settled,`${label}: texture fallback remains leased`);
    assert.strictEqual(f.requests[index].message.commandBuffer,undefined,label);
    f.complete(index,37);assert.strictEqual(await pending,37);
  }
  await f.bridge.close();
}
async function queuedWindowLifetime(){
  const f=await queuedFixture();
  let liveWidth=11,liveHeight=13;
  Object.assign(f.bridge.options.exports,{
    get_client_rect_l:()=>3,get_client_rect_t:()=>5,
    get_client_rect_r:()=>3+liveWidth,get_client_rect_b:()=>5+liveHeight,
  });
  await f.bridge.replay(scalarBatch(f.memory,128,'glClear',[1]),1);await tick();
  await f.bridge.replay(scalarBatch(f.memory,256,'gpuPresent',[0]),1);
  liveWidth=111;liveHeight=113;
  const original=f.renderer.windows[8];original.w=32;original.clientRect.right=32;
  f.renderer.windows[8]={hwnd:8,w:64,h:64};
  f.complete(1);await tick();
  const message=f.requests[2].message;
  assert.strictEqual(message.windows[0].w,2,'queued drawable dimensions are captured at admission');
  assert.strictEqual(message.windows[0].clientRect.right,2,'nested client rectangle is copied');
  assert.deepStrictEqual(message.windows[0].clientSize,{w:11,h:13},
    'admission captures authoritative WASM geometry before later shared-memory resize');
  const bitmap={close(){this.closed=true;}};
  f.events.message({data:{t:'frame',frame:{frameToken:message.frameToken,hwnd:8,width:2,height:2,bitmap}}});
  assert(bitmap.closed,'frame for destroyed/replaced HWND releases bitmap');
  assert.strictEqual(f.renderer.windows[8]._gpuFrameLayer,undefined,'stale frame cannot attach to reused HWND');
  f.complete(2);await f.bridge.close();
  assert.strictEqual(f.bridge.frameOwners.size,0,'frame ownership references retire after replies');
}
function workerOwnedCommandReplay(){
  const memory={buffer:new SharedArrayBuffer(1024)},owned=new ArrayBuffer(128);let observed;
  scalarBatch(owned,32,'glClear',[0x4000]);
  scalarBatch(memory.buffer,32,'glClear',[0x0100]);
  class FakeGL{
    destroy(){this.contexts.clear();}
    constructor(){this.contexts=new Map();this.currentByOwner=new Map();}
    replay(input,owner){return Stream.replay(input,(opcode,aux,capture)=>{
      observed={owner,opcode,value:new DataView(capture.buffer).getUint32(capture.stackOffset+4,true)};return 17;
    });}
  }
  const context={OpenGLCompat:{OpenGLHostBridge:FakeGL},GLCommandStream:Stream,Uint8ClampedArray};
  vm.runInNewContext(fs.readFileSync(require.resolve('../lib/gl-render-worker'),'utf8'),context);
  const adapter=context.GLRenderWorker.create({instance:{exports:{}},memory,backend:'webgl',sendFrame(){}});
  const result=adapter.execute({commandBuffer:owned,memoryOffset:32,bytes:40,owner:3});
  assert.deepStrictEqual(observed,{owner:3,opcode:GL.CALL_INDEX.glClear,value:0x4000},
    'render endpoint replays owned command buffer rather than reused shared stream');
  assert.strictEqual(result.value,17);adapter.destroy();
}
function workerCapturedGeometry(){
  const observed=[];
  class FakeGL{
    destroy(){this.contexts.clear();}
    constructor(options){this.options=options;this.contexts=new Map();this.currentByOwner=new Map();}
    replay(){
      const e=this.options.exports();
      observed.push([e.get_client_rect_l(8),e.get_client_rect_t(8),
        e.get_client_rect_r(8),e.get_client_rect_b(8),e.get_client_rect_r(99),e.other_export()]);
      return 0;
    }
  }
  const context={OpenGLCompat:{OpenGLHostBridge:FakeGL},GLCommandStream:Stream,Uint8ClampedArray};
  vm.runInNewContext(fs.readFileSync(require.resolve('../lib/gl-render-worker'),'utf8'),context);
  const adapter=context.GLRenderWorker.create({instance:{exports:{
    get_client_rect_l:()=>10,get_client_rect_t:()=>20,
    get_client_rect_r:()=>1010,get_client_rect_b:()=>2020,other_export:()=>73,
  }},memory:{buffer:new SharedArrayBuffer(64)},backend:'webgl',sendFrame(){}});
  adapter.execute({memoryOffset:0,bytes:0,windows:[{hwnd:8,clientSize:{w:11,h:13}}]});
  assert.deepStrictEqual(observed[0],[0,0,11,13,1010,73],
    'captured drawable dimensions override future shared exports while unrelated/missing-window exports delegate');
  adapter.execute({memoryOffset:0,bytes:0,windows:[{hwnd:8,clientSize:null}]});
  assert.deepStrictEqual(observed[1],[10,20,1010,2020,1010,73],
    'a later batch without captured dimensions returns to authoritative live exports');
  adapter.destroy();
}
function workerSoftwareResponseClone(){
  const memory={buffer:new SharedArrayBuffer(1024)};
  const adapter=require('../lib/gl-render-worker').create({instance:{exports:{}},memory,
    backend:'software',sendFrame(){}});
  const execute=(name,aux,args=[])=>{
    const input=scalarBatch(memory.buffer,0,name,args);
    new DataView(memory.buffer).setUint32(8,aux,true);
    return adapter.execute({memoryOffset:0,bytes:input.bytes,owner:0,
      windows:[{hwnd:1,w:16,h:16,clientRect:{w:16,h:16}}]});
  };
  try{
    const created=execute('wglCreateContext',1,[1]);
    assert(created.value,'real software consumer context created');
    structuredClone(created);
    const bound=execute('wglMakeCurrent',1,[1,created.value]);
    assert.strictEqual(bound.value,1,'software consumer bound to its window');
    assert.doesNotThrow(()=>structuredClone(bound),
      'software current response must cross Worker postMessage');
    assert.strictEqual(bound.webglVersion,undefined,'software response has no WebGL version');
    assert.deepStrictEqual(bound.activeWindows,[[0,1]]);
    assert.deepStrictEqual(bound.producerConfig,[1,16,16,0]);
    const released=execute('wglMakeCurrent',0,[0,0]);
    assert.strictEqual(released.value,1);structuredClone(released);
    assert.deepStrictEqual(released.producerConfig,[0,0,0,0]);
  }finally{adapter.destroy();}
}
async function nullRendererProtocol(){
  const memory={buffer:new SharedArrayBuffer(4096)},frames=[];
  const adapter=require('../lib/gl-render-worker').create({instance:{exports:{
    guest_to_wasm:p=>p,gl_sw_set_enabled(){throw Error('null enabled native rasterization');}
  }},memory,backend:'null',sendFrame:frame=>frames.push(frame)});
  const execute=(name,aux,args=[])=>{
    const input=scalarBatch(memory.buffer,0,name,args);
    new DataView(memory.buffer).setUint32(8,aux,true);
    return adapter.execute({memoryOffset:0,bytes:input.bytes,owner:0,frameToken:17,
      windows:[{hwnd:1,w:16,h:16,clientRect:{w:16,h:16}}]});
  };
  try {
    const context=execute('wglCreateContext',1,[1]).value;
    assert(context);
    assert.deepStrictEqual(execute('wglMakeCurrent',1,[1,context]).producerConfig,[0,0,0,0],
      'null never requests software rasterization in the guest');
    execute('glEnable',0,[0xb71]);
    assert.strictEqual(execute('glIsEnabled',0,[0xb71]).value,1,'state queries survive');
    execute('glViewport',0,[2,3,7,9]);
    execute('glGetIntegerv',0,[0xba2,1024]);
    assert.deepStrictEqual(Array.from(new Int32Array(memory.buffer,1024,4)),[2,3,7,9]);
    const bytes=32+Stream.VERTEX_FLOATS*4,v=new DataView(memory.buffer);
    v.setUint32(0,bytes,true);v.setUint32(4,Stream.PACKED_DRAW_OPCODE,true);v.setUint32(8,4,true);
    v.setUint32(12,0,true);v.setUint32(20,Stream.VERTEX_FLOATS*4,true);
    v.setUint32(24,32,true);v.setUint32(28,Stream.FLAG_POINTER_COPY,true);
    const draw=()=>adapter.execute({memoryOffset:0,bytes,owner:0});
    assert.strictEqual(draw().value,0,'packed geometry is discarded without a rasterizer');
    v.setUint32(20,Stream.VERTEX_FLOATS*4-4,true);
    assert.throws(draw,/invalid packed GL vertex payload/,'null still rejects malformed vertex records');
    assert.strictEqual(execute('glFinish',0).value,0);
    assert.strictEqual(execute('gpuPresent',0).value,1);
    assert(frames.length);assert(frames.every(f=>f.nullRender&&f.hwnd===1&&f.frameToken===17&&!f.pixels&&!f.bitmap));
    assert.throws(()=>execute('glReadPixels',0,[0,0,1,1,0x1908,0x1401,1024]),/null renderer cannot answer/);
    assert.throws(()=>execute('wglCreateContext',0x80000001,[1]),/bitmap drawables/);
  } finally {adapter.destroy();}
  let counted=0;
  const f=await queuedFixture({backend:'null',onPresent:()=>counted++,createCanvas(){throw Error('null allocated canvas');}});
  await f.bridge.replay(scalarBatch(f.memory,128,'glClear',[0x4000]),1);
  await tick();
  let finished=false;
  const finish=f.bridge.replay(batch(f.memory,256,GL.CALL_INDEX.glFinish),1).then(()=>finished=true);
  await tick();assert(!finished,'null retains synchronization behind queued work');
  f.complete(1);await tick();f.complete(2);await finish;
  f.bridge._present({hwnd:8,nullRender:true});assert.strictEqual(counted,1);
  await f.bridge.close();
}
async function hostProtocol(){
  // Same-sized frames retain storage; bitmap replacement must include alpha.
  {
    let width=2,height=2,resizes=0,closed=0;
    const ctx={drawImage(){assert.strictEqual(this.globalCompositeOperation,'copy');},
      createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}};
    const canvas={get width(){return width;},set width(v){width=v;resizes++;},
      get height(){return height;},set height(v){height=v;resizes++;},getContext:()=>ctx};
    const renderer={windows:{8:{}}};
    const bridge=new Bridge({renderer,createCanvas:()=>canvas});
    const frame=(w,h)=>({hwnd:8,width:w,height:h,bitmap:{close(){closed++;}}});
    bridge._present(frame(2,2));bridge._present(frame(2,2));
    assert.strictEqual(resizes,0,'stable frame dimensions never reset storage');
    bridge._present(frame(3,2));
    assert.strictEqual(resizes,1,'resolution changes resize only the changed dimension');
    bridge._present({hwnd:8,width:3,height:2,pixels:new Uint8Array(24)});
    assert.strictEqual(resizes,1,'pixel frames also reuse storage');
    assert.strictEqual(closed,3,'each transferred bitmap is released');
    await bridge.close();
  }
  const memory=new SharedArrayBuffer(4096),commands=[],copies=[],draws=[],events={},gate=deferred();
  const windows={8:{hwnd:8,w:2,h:2,clientRect:{left:0,top:0,right:2,bottom:2}}};
  const surface={width:2,height:2,rgbaRect(){return Uint8ClampedArray.from({length:16},(_,i)=>i);},
    writeRgbaRect(...args){copies.push(args);}};
  const port={ready:Promise.resolve(),addEventListener(type,fn){events[type]=fn;},
    request(msg){commands.push(msg);return gate.promise;},terminate(){this.stopped=true;}};
  let contextCount=-1,merged=0,repaints=0,enabled=true;
  const renderer={windows,getWindowCanvas(){},nextSurfaceWriteSeq:()=>19,
    mergeGpuLayerIntoBackCanvas(hwnd){assert.strictEqual(hwnd,8);merged++;},scheduleRepaint(){repaints++;}};
  const bridge=new Bridge({backend:'webgl',shouldUseRenderWorker:()=>enabled,renderer:()=>renderer,getGdiSurface:id=>id===5?{surface}:null,
    createRenderEndpoint(options){assert.deepStrictEqual(options,{api:'gl',backend:'webgl'});return port;},
    createCanvas:(width,height)=>({width,height,getContext:kind=>{assert.strictEqual(kind,'2d');return {drawImage:b=>draws.push(b)};}}),
    onContextCountChange:n=>{contextCount=n;}});
  const input=batch(memory,128,GL.CALL_INDEX.wglCreateContext,0x80000005);
  input.softwareFront=512;
  input.softwareConfig=new Int32Array(new SharedArrayBuffer(16));
  let settled=false;const done=bridge.replay(input,3).then(value=>{settled=true;return value;});
  await tick();assert(!settled,'caller retains command and query memory until request completion');
  assert.strictEqual(commands[0].memoryOffset,128);assert.strictEqual(commands[0].bytes,32);assert.strictEqual(commands[0].owner,3);
  assert.strictEqual(commands[0].softwareFront,512,'front descriptor belongs to the producing guest');
  assert.deepStrictEqual(commands[0].windows,[{...windows[8],generation:1}]);
  assert.strictEqual(commands[0].surfaces[0].id,5);assert.strictEqual(commands[0].surfaces[0].pixels[15],15);
  const image={closed:false,close(){this.closed=true;}};
  events.message({data:{t:'frame',frame:{hwnd:8,width:2,height:2,bitmap:image}}});
  assert(image.closed);assert.strictEqual(draws[0],image);assert.strictEqual(merged,1);assert.strictEqual(repaints,1);
  assert.strictEqual(windows[8]._gpuFrameLayer.writeSeq,19);
  new DataView(memory).setUint32(2048,0x12345678,true); // worker query writes its leased shared output
  gate.resolve({value:6,contexts:1,producerConfig:[1,2,2,5],surfaces:[{id:5,x:0,y:0,width:1,height:1,pixels:new Uint8ClampedArray([9,8,7,255])}]});
  assert.strictEqual(await done,6);assert.strictEqual(contextCount,1);
  assert.deepStrictEqual([...input.softwareConfig],[1,2,2,5],'producer setup is published before its RPC lease ends');
  assert.strictEqual(new DataView(memory).getUint32(2048,true),0x12345678);
  assert.deepStrictEqual(Array.from(copies[0][4]),[9,8,7,255]);
  enabled=false;
  assert.strictEqual(await bridge.replay(input,3),6);
  assert.strictEqual(commands.length,2,'a live endpoint stays on its worker when the host predicate turns off');
  assert.strictEqual(bridge.local,null,'predicate change must not create a second local renderer');
  await bridge.close();assert(port.stopped);
  assert.throws(()=>bridge.replay(input,3),/closed/,'closed bridge cannot reopen through disabled-predicate fallback');
  assert(!windows[8]._gpuFrameLayer&&!windows[8]._dxFrameLayer,'close detaches owned presentation layers');
  const late={close(){this.closed=true;}};
  events.message({data:{t:'frame',frame:{hwnd:8,width:2,height:2,bitmap:late}}});
  assert(late.closed);assert.strictEqual(draws.length,1,'late frames cannot repaint a closed bridge');
}
async function brokerProtocol(){
  const memory={buffer:new SharedArrayBuffer(RPC.RPC_BASE+RPC.RPC_STRIDE*RPC.RPC_MAX_SLOTS)};
  const gate=deferred(),errors=[];let calls=0;
  const broker=RPC.createMainBroker(memory,{gpu_gl_batch(desc,owner){calls++;assert.strictEqual(owner,1);assert.strictEqual(desc.memoryOffset,512);return gate.promise;}},
    {gpu_gl_call:{params:['i32','i32','i32'],results:['i32']}},{onError:(name,error)=>errors.push([name,error])});
  const v=RPC.views(memory,1);Atomics.store(v.i32,RPC.SLOT.STATUS,RPC.STATUS_REQ);
  assert(broker.serveGlBatch({slot:1,memoryOffset:512,bytes:32}));
  assert.strictEqual(Atomics.load(v.i32,RPC.SLOT.STATUS),RPC.STATUS_REQ);
  assert(!broker.serveGlBatch({slot:1,memoryOffset:512,bytes:32}));assert(!broker.serveRpc(1));assert.strictEqual(calls,1);
  new DataView(memory.buffer).setUint32(1024,17,true);gate.resolve(73);await tick();
  assert.strictEqual(Atomics.load(v.i32,RPC.SLOT.STATUS),RPC.STATUS_RESP);assert.strictEqual(v.i32[RPC.SLOT.RESULT],73);
  assert.strictEqual(new DataView(memory.buffer).getUint32(1024,true),17);assert.strictEqual(errors.length,0);
}
async function publishedBrokerProtocol(){
  const {PublicationQueue}=require('../lib/render-worker'),{Worker}=require('worker_threads');
  const queue=new PublicationQueue(new SharedArrayBuffer(64+4096));
  const memory={buffer:new SharedArrayBuffer(RPC.RPC_BASE+RPC.RPC_STRIDE*RPC.RPC_MAX_SLOTS)};
  const sigs={gpu_gl_call:{params:['i32','i32','i32'],results:['i32']},
    glide_submit:{params:['i32','i32','i32'],results:['i32']}};
  const events=[],marks=new Int32Array(new SharedArrayBuffer(4));
  const broker=RPC.createMainBroker(memory,{
    glide_submit(op){events.push(op===1?'glide-open':'glide-read');return 1;},
    async glide_batch(bytes){await new Promise(resolve=>setTimeout(resolve,10));events.push([...bytes]);return 1;},
    gpu_gl_batch(desc,owner){
    assert.strictEqual(desc.pool,undefined,'publication must not mix with native buffer leases');
    return Stream.replay(Stream.memoryBatch(desc.commandBuffer||memory.buffer,desc.memoryOffset,desc.bytes),(op,aux,capture)=>{
      if(op===51){events.push('bind');return 1;}
      if(op===GL.CALL_INDEX.glTexEnvfv){
        assert.strictEqual(Atomics.load(marks,0),1,'window marked before asynchronous replay');
        events.push(new DataView(capture.buffer).getFloat32(capture.pointerOffset,true));return 0;
      }
      if(op===12){events.push('query');return 73;}
      throw Error('unexpected published opcode '+op);
    });
  }},sigs,{renderPublication:queue.buffer,onRenderSnapshot:async value=>{
    await tick();assert.deepStrictEqual([...value.vertices],[33,44]);events.push('neutral');
  }});
  const code=`const {parentPort,workerData:d}=require('worker_threads');
    const RPC=require(d.rpc),S=require(d.stream),m={buffer:d.memory},v=new DataView(d.memory);
    const softwareConfig=new Int32Array(new SharedArrayBuffer(16));
    const built=RPC.createWorkerImports(m,d.sigs,msg=>parentPort.postMessage(msg),{
      slot:0,renderPublication:d.queue,publishOpenGL:true,softwareGLConfig:softwareConfig,getExports:()=>({
        gl_wat_stream_pool_version:()=>1,gl_wat_stream_pool_base:i=>512+i*2097152,gl_wat_stream_capacity:()=>2097152,
        gl_window_set_gpu_owned:(hwnd,value)=>{if(hwnd!==8)throw Error('bad drawable');Atomics.store(new Int32Array(d.marks),0,value);return 1;}
      })});
    function make(op,args,aux=0,floats=[]){
      new Uint8Array(d.memory,512,128).fill(0);const n=36+args.length*4+floats.length*4;
      v.setUint32(512,n,true);v.setUint32(516,op,true);v.setUint32(520,aux,true);v.setUint32(524,4+args.length*4,true);
      args.forEach((x,i)=>v.setUint32(548+i*4,x,true));
      if(floats.length){const off=36+args.length*4;v.setUint32(528,1234,true);v.setUint32(532,floats.length*4,true);v.setUint32(536,off,true);v.setUint32(540,1,true);floats.forEach((x,i)=>v.setFloat32(512+off+i*4,x,true));}
      return built.imports.host.gpu_gl_call(S.WAT_STREAM_FLUSH_OPCODE,512,n);
    }
    try{if(make(51,[10,20],8)!==1)throw Error('bind failed');
      make(147,[0x2300,0x2200,1234],0,[0.25]);make(147,[0x2300,0x2200,1234],0,[0.75]);
      const publication=new (require(d.transport).PublicationQueue)(d.queue),vertices=new Uint8Array([33,44]);
      publication.publishSnapshot(4,0,{value:{vertices},bytes:64},m=>parentPort.postMessage(m),
        ()=>parentPort.postMessage({t:'renderPublished',slot:0}));vertices.fill(99);
      const value=make(12,[]),glide=built.imports.host.glide_submit;
      softwareConfig[0]=1;const asyncBefore=built.stats.async;
      make(147,[0x2300,0x2200,1234],0,[0.5]);
      if(built.stats.async!==asyncBefore)throw Error('software GL metadata bypassed');
      glide(1,900,0);new Uint8Array(d.memory,900,3).set([7,8,9]);
      glide(0,900,3);new Uint8Array(d.memory,900,3).fill(99);glide(9,900,3);
      new Uint8Array(d.memory,900,3).set([4,5,6]);glide(0,900,3);
      built.fencePublications();
      parentPort.postMessage({done:true,value,stats:built.stats});
    }catch(error){parentPort.postMessage({error:error.stack});}`;
  const worker=new Worker(code,{eval:true,workerData:{rpc:require.resolve('../lib/guest-rpc'),stream:require.resolve('../lib/gl-command-stream'),transport:require.resolve('../lib/render-worker'),memory:memory.buffer,queue:queue.buffer,marks:marks.buffer,sigs}});
  const timeout=setTimeout(()=>queue.fail(),5000);
  try{
    const result=await new Promise((resolve,reject)=>{
      worker.on('error',reject);worker.on('message',msg=>{
        if(msg.done)resolve(msg);else if(msg.error)reject(new Error(msg.error));
        else if(msg.t==='renderPublished')broker.drainPublications().catch(reject);
        else if(msg.t==='renderSnapshot')broker.receiveRenderSnapshot(msg);
        else if(msg.t==='glBatch')broker.serveGlBatch(msg);
        else if(msg.t==='rpc')broker.serveRpc(msg.slot);
      });
    });
    assert.strictEqual(result.value,73,'query keeps synchronous result');
    assert.deepStrictEqual(events,['bind',0.25,0.75,'neutral','query',0.5,'glide-open',[7,8,9],'glide-read',[4,5,6]],
      'GL and Glide own their inputs and synchronous queries/readbacks cannot overtake publications');
    assert.strictEqual(result.stats.async,4);assert.strictEqual(result.stats.sync,5);
  }finally{clearTimeout(timeout);queue.fail();await worker.terminate();}
  const packed=new SharedArrayBuffer(512);
  assert(Stream.publicationSafe(scalarBatch(packed,0,'glEnable',[0x0de1])));
  assert(!Stream.publicationSafe(scalarBatch(packed,0,'glFinish',[])));
  assert(!Stream.publicationSafe(scalarBatch(packed,0,'glGetError',[])));
  const borrowed=vectorBatch(packed,0,'glTexEnvfv',[0x2300,0x2200,1234],[1]);
  new DataView(packed).setUint32(28,Stream.FLAG_POINTER_BORROW,true);
  assert(!Stream.publicationSafe(borrowed),'borrowed data retains synchronous fallback');
  const f=await queuedFixture(),owned=vectorBatch(new ArrayBuffer(128),0,'glTexEnvfv',[0x2300,0x2200,1234],[0.5]);
  owned.owned=true;
  const done=f.bridge.replay(owned,1);await tick();
  assert.strictEqual(f.requests[1].message.commandBuffer,owned.buffer,
    'owned publications retain their buffer on synchronous adapter fallback');
  f.complete(1);await done;await f.bridge.close();
}
function bitmapWorkerCoherence(){
  // Exercise the production endpoint surface adapter without a GPU: a bitmap
  // publish followed by a seed in one batch must read the just-written bytes.
  let observed;
  class FakeGL{
    destroy(){this.contexts.clear();}
    constructor(options){this.options=options;this.contexts=new Map();}
    replay(){const s=this.options.getGdiSurface(5).surface;
      s.writeRgbaRect(1,0,1,1,new Uint8ClampedArray([10,20,30,40]));observed=s.rgbaRect(0,0,2,1);return 9;}
  }
  const context={OpenGLCompat:{OpenGLHostBridge:FakeGL},GLCommandStream:Stream,Uint8ClampedArray};
  vm.runInNewContext(fs.readFileSync(require.resolve('../lib/gl-render-worker'),'utf8'),context);
  const adapter=context.GLRenderWorker.create({instance:{exports:{}},memory:{buffer:new SharedArrayBuffer(128)},backend:'webgl',sendFrame(){}});
  const result=adapter.execute({memoryOffset:0,bytes:0,surfaces:[{id:5,width:2,height:1,pixels:new Uint8ClampedArray([1,2,3,4,5,6,7,8])}]});
  assert.strictEqual(result.value,9);assert.deepStrictEqual(Array.from(observed),[1,2,3,4,10,20,30,40]);
  assert.deepStrictEqual(Array.from(result.surfaces[0].pixels),[10,20,30,40]);adapter.destroy();
}
async function legacyProxy(){
  let calls=0;const gate=deferred();const port={ready:gate.promise,request:async msg=>{calls++;assert.strictEqual(msg.wa,128);return msg.opcode===0x20001?(assert.strictEqual(msg.length,37),{value:2,stats:{syncs:1}}):1;},terminate(){this.stopped=true;}};
  const bridge=new D3DIMBridge({createRenderEndpoint:()=>port,backend:'software'});
  const done=bridge.call(0x20000,128);await tick();assert.strictEqual(calls,0);gate.resolve();assert.strictEqual(await done,1);
  assert.strictEqual(await bridge.call(0x20001,128,37),2,'main proxy preserves fence range and pending result');
  await bridge.close();assert(port.stopped);assert.throws(()=>bridge.call(0x20000,128),/closed/);
}
function legacyWorkerCleanup(){
  let stops=0;
  class FakeGPU{stop(){stops++;}}
  const context={D3DIMGpu:{D3DIMGpu:FakeGPU}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../lib/d3dim-render-worker'),'utf8'),context);
  const adapter=context.D3DIMRenderWorker.create({instance:{exports:{}},memory:{buffer:new SharedArrayBuffer(128)},backend:'webgl'});
  adapter.destroy();assert.strictEqual(stops,1,'legacy GPU teardown flushes and releases resources through stop()');
}
function legacyUnavailableFallback(){
  const RealGPU=require('../lib/d3dim-gpu').D3DIMGpu;
  let gpu,attempts=0;const warnings=[],draws=[],overrides=[];
  class ObservedGPU extends RealGPU {constructor(options){super(options);gpu=this;}}
  class MissingCanvas {constructor(){attempts++;throw new Error('no WebGL context');}}
  const context={D3DIMGpu:{D3DIMGpu:ObservedGPU},OffscreenCanvas:MissingCanvas,
    console:{warn:message=>warnings.push(message)}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../lib/d3dim-render-worker'),'utf8'),context);
  const memory={buffer:new SharedArrayBuffer(16384)},d=new DataView(memory.buffer);
  [1,4,3,1024,3,4096].forEach((value,i)=>d.setUint32(64+i*4,value,true));
  [512,4,4,32,16,2048,1].forEach((value,i)=>d.setUint32(256+i*4,value,true));
  const e={d3dim_gpu_describe:()=>256,d3dim_gpu_state_override:p=>overrides.push(p),
    d3dim_worker_draw:(...args)=>draws.push(args)};
  const adapter=context.D3DIMRenderWorker.create({instance:{exports:e},memory,backend:'webgl'});
  assert.strictEqual(adapter.execute({opcode:0x20000,wa:64,stateGuest:4096}),1);
  assert.deepStrictEqual(draws,[[1,4,3,1024,3,4096]],'unavailable GPU draw reaches native fallback');
  assert.deepStrictEqual(overrides,[4096,0],'snapshot scope is reset before native fallback');
  assert.strictEqual(warnings.length,1,'unavailable renderer remains diagnosed');
  assert.strictEqual(adapter.execute({opcode:0x20000,wa:64,stateGuest:4096}),1);
  assert.strictEqual(attempts,1,'unavailable context is not retried per triangle');
  assert.strictEqual(draws.length,2);
  assert.throws(()=>gpu._fail(new Error('shader execution failed')),/shader execution failed/,
    'a real GPU failure remains fatal even after unavailable fallback');
  adapter.destroy();
}
const watchdog=setTimeout(()=>{console.error('GL shared render worker protocol timed out');process.exitCode=1;},10000);
(async()=>{await nullRendererProtocol();await hostProtocol();await brokerProtocol();await publishedBrokerProtocol();bitmapWorkerCoherence();
  await queuedSnapshotsAndOrder();await queuedBarriersAndFallbacks();await queuedFailure();await queuedClose();
  await queuedSynchronization();await queuedOwnerInvalidation();await queuedPackedPayload();await queuedWindowLifetime();
  await queuedCopiedVectors();await queuedMalformedVectors();
  await queuedSmallTextureUploads();
  await sharedPacketRotation();
  workerOwnedCommandReplay();workerCapturedGeometry();workerSoftwareResponseClone();
  await legacyProxy();legacyWorkerCleanup();legacyUnavailableFallback();
  console.log('GL shared render worker protocol PASS');})().catch(error=>{console.error(error);process.exitCode=1;})
  .finally(()=>clearTimeout(watchdog));
