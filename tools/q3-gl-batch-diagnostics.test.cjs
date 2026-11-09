'use strict';
// Offline plumbing and dispatch controls. Real host, Manager/Endpoint, Node
// Worker, dispatcher, Stream and OpenGLHostBridge; synthetic WASM exports and
// canvas consumer. No browser, GPU, game, native rasterization or latency claim.
const assert=require('node:assert/strict');
const {Worker}=require('node:worker_threads');
const {Bridge}=require('../lib/gl-render-host');
const Host=require('../lib/gl-render-host');
const {Manager}=require('../lib/render-worker');
const GL=require('../lib/gl-compat');
const Stream=require('../lib/gl-command-stream');
const WorkerAdapter=require('../lib/gl-render-worker');
const vm=require('node:vm'),fs=require('node:fs');
const tick=()=>new Promise(r=>setTimeout(r,5));
async function until(fn){for(let n=0;n<1000;n++){if(fn())return;await tick();}throw Error('control deadline');}
function batch(memory,records,offset=128){
  let at=offset;const view=new DataView(memory.buffer);
  for(const [name,args=[],aux=0] of records){
    const bytes=36+args.length*4;new Uint8Array(memory.buffer,at,bytes).fill(0);
    view.setUint32(at,bytes,true);view.setUint32(at+4,GL.CALL_INDEX[name],true);
    view.setUint32(at+8,aux,true);view.setUint32(at+12,4+args.length*4,true);
    args.forEach((value,i)=>view.setUint32(at+36+i*4,value,true));at+=bytes;
  }
  return Stream.memoryBatch(memory.buffer,offset,at-offset);
}
const init=[['wglCreateContext',[],8],['wglMakeCurrent',[0,1],8]];
const workerSource=`
const {workerData}=require('node:worker_threads');
const GL=require(workerData.gl),gate=new Int32Array(workerData.gate);
GL.hooks.trace=(slot,opcode)=>{
  Atomics.add(gate,3,1);
  if(opcode!==GL.CALL_INDEX.glClear)return;
  const mode=Atomics.load(gate,0);Atomics.store(gate,1,1);
  if(mode===1&&Atomics.wait(gate,2,0,15000)==='timed-out')throw Error('test gate deadline');
  if(mode===2)throw Error('controlled dispatch failure');
};
WebAssembly.instantiate=async()=>({exports:{d3dim_worker_init(){},d3d_render_reset_transients(){},d3d_render_retire_heap(){return 0;}}});
require(workerData.dispatcher);
`;
async function fixture(enabled,maxRecords=128){
  const memory={buffer:new SharedArrayBuffer(8192)},gate=new Int32Array(new SharedArrayBuffer(16)),writes=[];
  const worker=new Worker(workerSource,{eval:true,workerData:{gate:gate.buffer,
    gl:require.resolve('../lib/gl-compat'),dispatcher:require.resolve('../lib/d3d-render-worker')}});
  // Independent parent deadline is armed before initialization. Every worker
  // is also terminated/awaited in finally, including failed controls.
  const watchdog=setTimeout(()=>worker.terminate(),25000);
  const manager=new Manager({workerFactory:()=>worker,module:{},memory,sigs:{},imageBase:0x400000,reclaimHeap:()=>1});
  let port;
  const renderer={windows:{8:{hwnd:8,w:1,h:1}},scheduleRepaint(){writes.push('repaint');},
    mergeGpuLayerIntoBackCanvas(){writes.push('merge');}};
  if(enabled==='configured')Host.configureDiagnostics({enabled:true,maxRecords});
  const bridge=new Bridge({backend:'software',renderer,
    ...(enabled==='configured'?{}:{glBatchDiagnostics:{enabled,maxRecords}}),
    createCanvas:()=>({getContext:()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),
      putImageData:image=>writes.push([...image.data])})}),
    createRenderEndpoint:options=>(port=manager.createEndpoint(options))});
  Host.configureDiagnostics({enabled:false});
  const view=new DataView(memory.buffer),front=4096;
  view.setUint16(front+12,1,true);view.setUint16(front+14,1,true);view.setUint16(front+16,32,true);
  view.setUint16(front+18,4,true);view.setUint32(front+20,4200,true);view.setUint32(4200,0xff123456,true);
  return {bridge,memory,gate,writes,manager,renderer,get port(){return port;},front,
    async stop(expected){
      try{if(expected)await assert.rejects(bridge.close(),expected);else await bridge.close();}
      finally{try{await manager.stop();}finally{clearTimeout(watchdog);await worker.terminate();}}
    }};
}
async function parity(enabled){
  const f=await fixture(enabled);
  try{
    assert.equal(await f.bridge.replay(batch(f.memory,init),7),1);
    const commands=batch(f.memory,[['glClear',[0x4000]],['gpuPresent']]);commands.softwareFront=f.front;
    assert.equal(await f.bridge.replay(commands,7),1);
    const snap=f.bridge.diagnosticSnapshot();
    if(enabled){
      const r=snap.render.records;
      assert.equal(snap.render.errors,0);assert.equal(snap.render.dropped,0);
      assert.deepEqual(r.filter(r=>r.kind==='opcode-enter').map(r=>r.opcode),
        ['wglCreateContext','wglMakeCurrent','glClear','gpuPresent'].map(n=>GL.CALL_INDEX[n]));
      assert(r.some(r=>r.kind==='opcode-exit'&&r.context===1));
      const kinds=r.filter(r=>r.frameToken===2).map(r=>r.kind);
      assert.deepEqual(kinds,['batch-enter','stream-replay-enter','opcode-enter','opcode-exit','opcode-enter',
        'frame-produce-enter','frame-produce-exit','frame-send-enter','frame-send-exit','opcode-exit','stream-replay-exit','batch-exit']);
      for(const item of r){assert.equal(item.owner,7);assert.equal(item.endpointId,f.port.id);}
      for(let n=1;n<r.length;n++)assert(r[n].atMs>=r[n-1].atMs);
      for(const end of r.filter(r=>r.beginSequence)){
        const begin=r.find(r=>r.sequence===end.beginSequence);
        assert(begin);assert.equal(end.durationMs,end.atMs-begin.atMs);
        assert.equal(end.frameToken,begin.frameToken);
      }
      const sent=snap.host.records.filter(r=>r.kind==='request-sent');
      assert.deepEqual(sent.map(r=>r.requestId),[1,2]);assert.deepEqual(sent.map(r=>r.frameToken),[1,2]);
      assert(snap.host.records.some(r=>r.kind==='frame-consume-exit'));
      // Returned copies cannot mutate the retained ring.
      snap.render.records[0].kind='changed';snap.host.records[0].kind='changed';
      assert.notEqual(f.bridge.diagnosticSnapshot().render.records[0].kind,'changed');
      assert.notEqual(f.bridge.diagnosticSnapshot().host.records[0].kind,'changed');
    }else assert.deepEqual(snap,{enabled:false,status:'UNKNOWN',reason:'not armed'});
    return {writes:f.writes,calls:Atomics.load(f.gate,3),memory:Buffer.from(f.memory.buffer).toString('hex')};
  }finally{await f.stop();}
}
async function pendingAndErrors(){
  const f=await fixture(true);
  try{
    await f.bridge.replay(batch(f.memory,init),9);
    Atomics.store(f.gate,0,1);
    let settled=false;
    const pending=f.bridge.replay(batch(f.memory,[['glClear',[0x4000]]]),9).finally(()=>{settled=true;});
    await until(()=>Atomics.load(f.gate,1)===1);
    const partial=f.bridge.diagnosticSnapshot();
    assert.deepEqual(Host.diagnosticSnapshot().render,partial.render,'module safe pull sees same pre-op marker without scheduling render JS');
    assert.equal(settled,false);assert.equal(f.port.requests.size,1);
    assert.equal(partial.render.records.at(-1).kind,'opcode-enter');
    assert.equal(partial.render.records.at(-1).opcode,GL.CALL_INDEX.glClear);
    assert.equal(partial.render.records.at(-1).context,1);
    assert.equal(partial.host.records.at(-1).requestId,2);
    // Repeated pulls add no transport requests and cannot settle the batch.
    for(let n=0;n<100;n++)assert.equal(f.bridge.diagnosticSnapshot().render.sequence,partial.render.sequence);
    assert.equal(f.port.sequence,2);assert.equal(settled,false);
    Atomics.store(f.gate,2,1);Atomics.notify(f.gate,2);assert.equal(await pending,0);
    assert.equal(f.bridge.diagnosticSnapshot().render.records.at(-1).kind,'batch-exit');
    Atomics.store(f.gate,0,2);
    await assert.rejects(f.bridge.replay(batch(f.memory,[['glClear',[0x4000]]]),9),/controlled dispatch failure/);
    const error=f.bridge.diagnosticSnapshot();
    assert.equal(error.render.boundaryErrors,3,'opcode, stream and batch error boundaries, not three failed operations');
    assert.deepEqual(error.render.records.slice(-3).map(r=>r.kind),['opcode-error','stream-replay-error','batch-error']);
    assert.equal(error.host.records.at(-1).kind,'request-error');
    const seq=error.render.sequence;
    await assert.rejects(f.port.request({t:'gl-batch',bytes:0}),/controlled dispatch failure/);
    assert.equal(f.bridge.diagnosticSnapshot().render.sequence,seq,'failed dispatcher must not execute a late request');
    await assert.rejects(f.bridge.close(),/controlled dispatch failure/);
    const retired=f.bridge.diagnosticSnapshot();assert.equal(retired.render.retired,true);assert.equal(retired.status,'UNKNOWN');
  }finally{await f.stop(/controlled dispatch failure/);}
}
async function boundedAndRejected(){
  const f=await fixture(true,4);
  try{
    await f.bridge.replay(batch(f.memory,init),3);
    const s=f.bridge.diagnosticSnapshot();assert.equal(s.render.records.length,4);assert(s.render.dropped>0);
    assert(s.host.records.length<=4);assert.equal(s.status,'UNKNOWN');
    let closed=0;
    f.bridge._present({hwnd:8,frameToken:1,bitmap:{close(){closed++;}}},f.port.id);
    assert.equal(closed,1,'late frame after token retirement must be closed');
    assert(f.bridge.diagnosticSnapshot().host.records.some(r=>r.kind==='frame-rejected'));
    const good=f.renderer.windows[8];f.bridge.frameOwners.set(77,new Map([[8,good]]));
    f.renderer.windows[8]={hwnd:8};f.bridge._present({hwnd:8,frameToken:77,bitmap:{close(){closed++;}}},f.port.id);
    assert.equal(closed,2,'reused HWND cannot receive old frame');
    f.renderer.windows[8]=good;
    const original=f.bridge.options.createCanvas;f.bridge.options.createCanvas=()=>{throw Error('consumer failure');};
    assert.throws(()=>f.bridge._present({hwnd:8,frameToken:77,width:1,height:1},f.port.id),/consumer failure/);
    assert.equal(f.bridge.diagnosticSnapshot().host.records.at(-1).kind,'frame-consume-error');
    f.bridge.options.createCanvas=original;f.bridge.frameOwners.delete(77);
    // Simulate a slot being overwritten while read: never report its old body
    // as a committed marker. This is a ring-race control, not render progress.
    const words=new Int32Array(f.bridge.batchDiagnostics.buffer),seq=words[2],at=16+((seq-1)%4)*16;
    Atomics.store(words,at,-seq);
    assert.equal(f.bridge.diagnosticSnapshot().render.unavailable,1);
  }finally{await f.stop();}
}
function exactExceptionsAndOffPath(){
  const memory={buffer:new SharedArrayBuffer(1024)};
  const off=WorkerAdapter.create({instance:{exports:{}},memory,backend:'software',sendFrame(){}});
  // Count calls to the real bridge via its existing diagnostic hook; exception
  // identity must survive our wrapper, including non-Error thrown values.
  const thrown={sentinel:true},old=GL.hooks.trace;
  try{
    GL.hooks.trace=()=>{throw thrown;};
    for(const enabled of [false,true]){
      const host=new Bridge({glBatchDiagnostics:{enabled},renderer:{}});
      const adapter=WorkerAdapter.create({instance:{exports:{}},memory,endpointId:12,backend:'software',sendFrame(){},
        options:{glBatchDiagnostics:host.batchDiagnostics?{buffer:host.batchDiagnostics.buffer}:undefined}});
      const b=batch(memory,[['glGetError']]);
      assert.throws(()=>adapter.execute({memoryOffset:b.byteOffset,bytes:b.bytes,owner:5,frameToken:10}),e=>e===thrown);
      adapter.destroy();
    }
  }finally{GL.hooks.trace=old;off.destroy();}
  // A failing monotonic observer must not change dispatch or exceptions.
  const host=new Bridge({renderer:{},glBatchDiagnostics:{enabled:true}}),instances=[];
  class CaptureBridge extends GL.OpenGLHostBridge{constructor(o){super(o);instances.push(this);}}
  const context={OpenGLCompat:{OpenGLHostBridge:CaptureBridge},GLCommandStream:Stream,SharedArrayBuffer,Atomics,
    Int32Array,Float64Array,performance:{now(){throw Error('clock observer failure');}}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../lib/gl-render-worker'),'utf8'),context);
  for(const enabled of [false,true]){
    const adapter=context.GLRenderWorker.create({instance:{exports:{}},memory,backend:'software',sendFrame(){},
      options:enabled?{glBatchDiagnostics:{buffer:host.batchDiagnostics.buffer}}:undefined});
    assert.equal(Object.hasOwn(instances.at(-1),'call'),enabled,'off path installs no opcode wrapper');
    assert.equal(adapter.execute({bytes:0}).value,0);adapter.destroy();
  }
  assert(host.diagnosticSnapshot().render.errors>0);
  const malformed=new Bridge({renderer:{},glBatchDiagnostics:{enabled:true,maxRecords:999}});
  assert.equal(malformed.diagnosticSnapshot().host.errors,1);
}
async function transportErrorParity(enabled){
  const f=await fixture(enabled);
  try{
    await f.bridge.replay(batch(f.memory,init),7);Atomics.store(f.gate,0,2);
    let message;
    try{await f.bridge.replay(batch(f.memory,[['glClear',[0x4000]]]),7);assert.fail('must reject');}
    catch(error){message=error.message.split('\n')[0];}
    return {message,calls:Atomics.load(f.gate,3),owners:f.bridge.frameOwners.size};
  }finally{await f.stop(/controlled dispatch failure/);}
}
async function ordering(enabled){
  const f=await fixture(enabled);
  try{
    await f.bridge.replay(batch(f.memory,init),7);Atomics.store(f.gate,0,1);
    const first=f.bridge.replay(batch(f.memory,[['glClear',[0x4000]]]),7);
    await until(()=>Atomics.load(f.gate,1)===1);
    let done=false;
    const second=f.bridge.replay(batch(f.memory,[['glGetError']],512),8).then(value=>{done=true;return value;});
    await tick();assert.equal(done,false);assert.equal(f.port.sequence,2,'later owner cannot overtake blocked dispatcher');
    Atomics.store(f.gate,2,1);Atomics.notify(f.gate,2);
    const values=await Promise.all([first,second]);
    return {values,calls:Atomics.load(f.gate,3),requests:f.port.sequence,owners:f.bridge.frameOwners.size};
  }finally{await f.stop();}
}
function bitmapBoundaryPlumbing(){
  // Synthetic GPU adapter ONLY: retain genuine Stream + GL bridge replay,
  // dispatch and publish path, replacing context backend allocation with a
  // software proxy and bitmap stub. This cannot establish GPU completion.
  for(const fail of ['none','transfer','send']){
    const host=new Bridge({renderer:{},glBatchDiagnostics:{enabled:true}}),memory={buffer:new SharedArrayBuffer(4096)};
    const sentinel={fail},frames=[];
    const canvas={width:1,height:1,transferToImageBitmap(){if(fail==='transfer')throw sentinel;return {bitmap:true};}};
    class SyntheticGPU extends GL.OpenGLHostBridge{
      _createWebglContext(target,win,size){
        const handle=this._createSoftwareContext(target,win,size),c=this.contexts.get(handle);
        c.software=false;c.layer.canvas=canvas;c.backend.present=()=>canvas;win._gpuFrameLayer=c.layer;
        return handle;
      }
    }
    const context={OpenGLCompat:{OpenGLHostBridge:SyntheticGPU},GLCommandStream:Stream,
      SharedArrayBuffer,Atomics,Int32Array,Float64Array,performance};
    vm.runInNewContext(fs.readFileSync(require.resolve('../lib/gl-render-worker'),'utf8'),context);
    const adapter=context.GLRenderWorker.create({instance:{exports:{}},memory,backend:'webgl',endpointId:21,
      options:{glBatchDiagnostics:{buffer:host.batchDiagnostics.buffer}},
      sendFrame(frame){if(fail==='send')throw sentinel;frames.push(frame);}});
    try{
      const b=batch(memory,[...init,['gpuPresent']]);
      const execute=()=>adapter.execute({memoryOffset:b.byteOffset,bytes:b.bytes,owner:6,frameToken:73,windows:[{hwnd:8,w:1,h:1}]});
      if(fail==='none'){
        assert.equal(execute().value,1);assert.equal(frames.length,1);assert.equal(frames[0].frameToken,73);
        assert(host.diagnosticSnapshot().render.records.some(r=>r.kind==='frame-produce-exit'));
      }else{
        assert.throws(execute,e=>e===sentinel);
        assert(host.diagnosticSnapshot().render.records.some(r=>r.kind===(fail==='transfer'?'frame-produce-error':'frame-send-error')));
      }
    }finally{adapter.destroy();}
  }
}
function getErrorStages(){
  // Actual adapter -> Stream -> bridge.call(12) -> _call -> _current,
  // with controlled activation/draw and the real GPU context error facade.
  // The device's native GL method is a stub: these are semantic/boundary
  // controls, never evidence for the cause or duration of a native stall.
  const {WebGLBackend}=require('../lib/gpu-backend');
  for(const enabled of [false,true])for(const scenario of [
    'backend','retained','frontend','flush-error-value','context-throw','flush-throw',
    'frontend-throw','backend-throw','no-context','clock-throw','bounded']){
    const capacity=scenario==='bounded'?4:128;
    const host=new Bridge({renderer:{},glBatchDiagnostics:{enabled,maxRecords:capacity}});
    const memory={buffer:new SharedArrayBuffer(4096)},events=[],sentinel={scenario};
    let bridge,clockCalls=0,now=100,flushes=0,nativeCalls=0,partial;
    const device=Object.create(WebGLBackend.prototype);
    device.canvas={width:1,height:1};
    let retained=[0x502,0];
    device.gl={getError(){
      nativeCalls++;events.push('native');
      if(scenario==='backend-throw')throw sentinel;
      if(scenario==='retained')return retained.shift()||0;
      partial=host.diagnosticSnapshot();return 0x501;
    }};
    const backend=device.createContextBackend(1,1);
    if(scenario==='retained'){backend.captureErrors();events.length=0;nativeCalls=0;}
    const frontend=Object.assign(Object.create(GL.FixedFunctionGL.prototype),{
      gl:device.gl,backend,lastError:scenario==='frontend'?0x504:0,
      flushPendingDraw(){
        flushes++;events.push('flush');
        return GL.FixedFunctionGL.prototype.flushPendingDraw.call(this);
      },
      _drawGeometry(draw){
        events.push('draw');assert.equal(draw.vertices.length,8);
        if(scenario==='flush-throw')throw sentinel;
        if(scenario==='flush-error-value')this.lastError=0x505;
      }});
    frontend.enqueuePacked(4,new Float32Array(4));
    frontend.enqueuePacked(4,new Float32Array(4));
    if(scenario==='frontend-throw')Object.defineProperty(frontend,'lastError',{get(){throw sentinel;}});
    class ControlledBridge extends GL.OpenGLHostBridge{
      constructor(options){super(options);bridge=this;}
      _activateWebgl(){events.push('activate');if(scenario==='context-throw')throw sentinel;}
    }
    const context={OpenGLCompat:{OpenGLHostBridge:ControlledBridge},GLCommandStream:Stream,
      SharedArrayBuffer,Atomics,Int32Array,Float64Array,performance:{now(){
        clockCalls++;
        if(!enabled||scenario==='clock-throw')throw Error('observer clock unavailable');
        return now+=0.25;
      }}};
    vm.runInNewContext(fs.readFileSync(require.resolve('../lib/gl-render-worker'),'utf8'),context);
    const adapter=context.GLRenderWorker.create({instance:{exports:{}},memory,backend:'webgl',endpointId:31,
      options:enabled?{glBatchDiagnostics:{buffer:host.batchDiagnostics.buffer}}:undefined,sendFrame(){}});
    if(scenario!=='no-context'){
      bridge.contexts.set(9,{handle:9,hwnd:8,drawable:{},software:false,frontend,backend});
      bridge.currentByOwner.set(7,9);
    }
    assert.equal(Object.hasOwn(bridge,'_getErrorStage'),enabled);
    const b=batch(memory,[['glGetError',[],123]]);
    const execute=()=>adapter.execute({memoryOffset:b.byteOffset,bytes:b.bytes,owner:7,frameToken:73,
      windows:[{hwnd:8,w:1,h:1}]}).value;
    try{
      const throws=scenario.endsWith('-throw')&&scenario!=='clock-throw';
      if(throws)assert.throws(execute,e=>e===sentinel,'original thrown value survives all wrappers');
      else assert.equal(execute(),scenario==='no-context'?0:scenario==='frontend'?0x504:
        scenario==='flush-error-value'?0x505:scenario==='retained'?0x502:0x501);
      assert.equal(bridge._owner,0);assert.equal(bridge._capture,null);
      if(scenario==='frontend')assert.equal(frontend.lastError,0);
      if(['frontend','flush-error-value','retained','context-throw','flush-throw','frontend-throw','no-context'].includes(scenario))
        assert.equal(nativeCalls,0,'frontend/retained errors and early failure must not query the device');
      if(scenario!=='no-context')assert.equal(flushes,scenario==='context-throw'?1:2,
        'original replay-finally flush follows opcode flush/failure');
      if(scenario!=='no-context'){
        assert.equal(frontend.pendingDraw,null,'real pending draw is consumed exactly once');
        assert.equal(events.filter(e=>e==='draw').length,1);
        if(nativeCalls)assert(events.indexOf('draw')<events.indexOf('native'),'pending draw precedes native query');
      }
      const snap=host.diagnosticSnapshot();
      if(!enabled){assert.equal(clockCalls,0,'unarmed actual opcode12 never reads diagnostic clock');continue;}
      if(scenario==='clock-throw'){assert(snap.render.errors>0);continue;}
      assert(clockCalls>0);
      const records=snap.render.records,stages=records.filter(r=>r.kind.startsWith('get-error-'));
      if(scenario==='bounded'){
        for(let n=0;n<200;n++)execute();
        assert.equal(host.diagnosticSnapshot().render.records.length,capacity);
        assert.equal(records.length,capacity);assert(snap.render.dropped>0);
        assert.equal(host.batchDiagnostics.buffer.byteLength,(16+capacity*16)*4);continue;
      }
      const failed=scenario==='context-throw'?'context':scenario==='flush-throw'?'flush':
        scenario==='frontend-throw'?'frontend':scenario==='backend-throw'?'backend':null;
      const names=scenario==='no-context'||failed==='context'?['context']:
        failed==='flush'?['context','flush']:failed==='frontend'||['frontend','flush-error-value'].includes(scenario)?
          ['context','flush','frontend']:['context','flush','frontend','backend'];
      assert.deepEqual(stages.map(r=>r.kind),names.flatMap(n=>[
        `get-error-${n}-enter`,`get-error-${n}-${n===failed?'error':'exit'}`]));
      for(const r of stages){
        assert.equal(r.opcode,12);assert.equal(r.endpointId,31);assert.equal(r.owner,7);
        assert.equal(r.context,scenario==='no-context'?0:9);assert.equal(r.frameToken,73);
        assert.equal(r.aux,123);assert.equal(r.memoryOffset,b.byteOffset);assert.equal(r.bytes,b.bytes);
        if(r.beginSequence){
          const start=records.find(s=>s.sequence===r.beginSequence);
          assert(start);assert.equal(r.durationMs,r.atMs-start.atMs);assert.equal(r.durationMs,0.25);
        }
      }
      assert.equal(snap.render.boundaryErrors,throws?4:0,'stage/opcode/stream/batch error boundaries');
      if(scenario==='backend')assert.equal(partial.render.records.at(-1).kind,'get-error-backend-enter',
        'snapshot while backend is running retains committed enter marker');
      if(scenario==='frontend'||scenario==='retained'){
        assert.equal(execute(),scenario==='frontend'?0x501:0,'consumed error is cleared before next query');
        assert.equal(nativeCalls,1,'next query reaches the real device method once');
      }
    }finally{bridge.contexts.clear();adapter.destroy();}
  }
}
(async()=>{
  assert.deepEqual(await parity(false),await parity(true),'off/on commands, values, frames, ordering and memory parity');
  assert.deepEqual(await parity(false),await parity('configured'),'normal constructor module opt-in parity');
  assert.deepEqual(await transportErrorParity(false),await transportErrorParity(true),'off/on actual transport errors and owner retirement parity');
  assert.deepEqual(await ordering(false),await ordering(true),'off/on actual pending admission and owner ordering parity');
  await pendingAndErrors();await boundedAndRejected();exactExceptionsAndOffPath();bitmapBoundaryPlumbing();getErrorStages();
  console.log('PASS production GL host/Endpoint/Manager/NodeWorker dispatcher + real Stream/bridge; pending independent snapshots, errors, late/rejected frames, ring bounds, off/on parity. Synthetic WASM exports/canvas only; no GPU/game claims.');
})().catch(error=>{console.error(error);process.exitCode=1;});
