#!/usr/bin/env node
'use strict';

// Production native producer -> broker -> shared packet bridge -> physical
// browser render Worker. Record the actual WebGL implementation: launch flags
// alone do not establish hardware versus software coverage.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { startStaticServer } = require('./static-server');
const os = require('os');
const crypto = require('crypto');
const {spawn} = require('child_process');
const ROOT = process.env.WINE_ROOT || path.resolve(__dirname, '..');
const selectedPrimitiveArg=process.argv.find(arg=>arg.startsWith('--primitive-mode='));
const selectedPrimitive=selectedPrimitiveArg?Number(selectedPrimitiveArg.split('=')[1]):null;
if(selectedPrimitiveArg)assert(Number.isInteger(selectedPrimitive)&&selectedPrimitive>=0&&selectedPrimitive<=11,
  'selected primitive must be an integer from zero through eleven');
assert(!(selectedPrimitiveArg&&process.argv.includes('--point-witness')),'select one diagnostic scope');

function producerWorker() {
  importScripts('/lib/region-map.generated.js', '/lib/gl-command-stream.js',
    '/lib/guest-rpc.js', '/lib/gl-software-producer.js', '/lib/gl-compat.js');
  self.onmessage = async event => {
    const m = event.data;
    if (m.t !== 'start') return;
    try {
      const {memory,module,sigs,backend,hwnd,dc,primitiveMode,watchdogPort} = m;
      // A separate physical Worker observes each fixed 3s deadline. Its port
      // reports directly to the host even while this producer is blocked.
      const watchdogState=new SharedArrayBuffer(32),ws=new BigInt64Array(watchdogState);
      function deadlineThread(){
        self.onmessage=event=>{
          const s=new BigInt64Array(event.data.state),port=event.data.port;
          if(Atomics.load(s,0)!==0n||BigInt(Date.now())>=Atomics.load(s,2)){
            Atomics.store(s,0,1n);port.postMessage({t:'PERMANENT_UNKNOWN',reason:'startup expired',at:Date.now()});self.close();return;
          }
          Atomics.store(s,3,0n);Atomics.notify(s,3);port.postMessage({t:'ready',fixedMilliseconds:3000});
          for(;;){
            const active=Atomics.load(s,1);
            if(active===-1n){port.postMessage({t:'stopped',terminal:Atomics.load(s,0)!==0n});Atomics.store(s,3,-1n);Atomics.notify(s,3);self.close();return;}
            if(active>0n){
              Atomics.store(s,3,active);Atomics.notify(s,3);
              if(BigInt(Date.now())>=Atomics.load(s,2)&&Atomics.load(s,1)===active){
                Atomics.store(s,0,1n);
                port.postMessage({t:'PERMANENT_UNKNOWN',sequence:Number(active),deadline:Number(Atomics.load(s,2)),at:Date.now()});
                self.close();return;
              }
            }
            Atomics.wait(s,1,active,2);
          }
        };
      }
      Atomics.store(ws,3,-2n);
      const deadlineURL=URL.createObjectURL(new Blob(['('+deadlineThread.toString()+')()'],{type:'application/javascript'}));
      const startup={launchedAt:Date.now()};startup.deadline=startup.launchedAt+3000;
      Atomics.store(ws,2,BigInt(startup.deadline));
      const deadlineWorker=new Worker(deadlineURL);
      deadlineWorker.onerror=()=>Atomics.store(ws,0,1n);
      deadlineWorker.postMessage({state:watchdogState,port:watchdogPort},[watchdogPort]);
      // Yield the creator's event loop while the physical child starts. The
      // absolute startup deadline remains three seconds from launch.
      while(Atomics.load(ws,3)===-2n&&Atomics.load(ws,0)===0n&&Date.now()<startup.deadline)
        await new Promise(resolve=>setTimeout(resolve,2));
      startup.readySeenAt=Date.now();
      if(Atomics.load(ws,3)!==0n||Atomics.load(ws,0)!==0n||startup.readySeenAt>=startup.deadline){
        Atomics.store(ws,0,1n);deadlineWorker.terminate();URL.revokeObjectURL(deadlineURL);
        throw Error('PERMANENT_UNKNOWN independent watchdog startup');
      }
      URL.revokeObjectURL(deadlineURL);
      let operationSequence=0;
      const operationEvents=[];
      const controlled=(name,fn)=>{
        if(Atomics.load(ws,0)!==0n)throw Error('PERMANENT_UNKNOWN refuses later request '+name);
        const sequence=++operationSequence,armedAt=Date.now(),deadline=armedAt+3000;
        const event={sequence,name,armedAt,deadline};operationEvents.push(event);
        postMessage({t:'fixture-operation',...event});
        Atomics.store(ws,2,BigInt(deadline));Atomics.store(ws,1,BigInt(sequence));Atomics.notify(ws,1);
        Atomics.wait(ws,3,BigInt(sequence-1),3000);
        try{
          if(Atomics.load(ws,3)!==BigInt(sequence)||Date.now()>=deadline||Atomics.load(ws,0)!==0n)
            throw Error('independent watchdog did not prearm within fixed 3s');
          const value=fn();
          if(Date.now()>=deadline||Atomics.load(ws,0)!==0n)throw Error('fixed 3s public operation expired');
          Atomics.store(ws,1,0n);Atomics.notify(ws,1);event.outcome='COMPLETED';event.completedAt=Date.now();return value;
        }catch(error){
          Atomics.store(ws,0,1n);event.outcome='PERMANENT_UNKNOWN';
          postMessage({t:'fixture-error',error:'PERMANENT_UNKNOWN '+name+' '+String(error.stack||error)});throw error;
        }
      };
      const closeDeadline=()=>{
        Atomics.store(ws,1,-1n);Atomics.notify(ws,1);
        Atomics.wait(ws,3,BigInt(operationSequence),3000);
        if(Atomics.load(ws,3)!==-1n)throw Error('deadline Worker stop acknowledgement missing');
        deadlineWorker.terminate();
        return {workerURL:deadlineURL,startup,fixedMilliseconds:3000,prearmed:true,stopAcknowledged:true,physicallyTerminated:true,permanentUnknown:false,events:operationEvents};
      };
      let instance;
      const software = new GLSoftwareProducer.Producer(() => instance.exports);
      const built = GuestRpc.createWorkerImports(memory, sigs, message => postMessage(message),
        {slot:0, getExports:()=>instance?.exports, softwareGLConfig:software.config,
          configureSoftwareGL:config=>software.configure(config)});
      instance = controlled('WebAssembly.Instance',()=>new WebAssembly.Instance(module,built.imports));
      const e = instance.exports, v = new DataView(memory.buffer);
      if(e.gl_wat_encoder_set_enabled !== undefined)throw Error('runtime JS encoder selector');
      controlled('init_thread',()=>e.init_thread(1,0x400000,0,0,0,0,0,0));
      if(controlled('pool-enable',()=>e.gl_wat_stream_pool_enable(1))!==1)throw Error('native triple pool unavailable');
      const stack=RegionMap.BASE.GUEST_STACK+0x4000;
      let callSequence=0;
      const call=(name,args=[],aux=0)=>{
        postMessage({t:'api',sequence:++callSequence,name});
        new Uint8Array(memory.buffer,stack,128).fill(0);
        v.setUint32(stack,0xdec0adde,true);
        args.forEach((x,i)=>v.setUint32(stack+4+i*4,x>>>0,true));
        return controlled(name,()=>e.gl_wat_encoder_call(OpenGLCompat.CALL_INDEX[name],stack,aux)|0);
      };
      const f=x=>{v.setFloat32(stack+124,x,true);return v.getUint32(stack+124,true);};
      const timed=(name,fn)=>{const start=performance.now(),value=fn();
        const result={name,value,elapsed:performance.now()-start};postMessage({t:'step',...result});return value;};
      const handle=timed('create',()=>call('wglCreateContext',[],hwnd));
      if(!handle)throw Error('real backend context creation failed');
      if(timed('current',()=>call('wglMakeCurrent',[0,handle],hwnd))!==1)throw Error('make current');
      if(primitiveMode===10)call('glPolygonMode',[0x408,0x1b01]);
      call('glViewport',[0,0,8,8]);call('glPixelStorei',[0xd05,1]);
      timed('setup-finish',()=>call('glFinish'));
      timed('empty-flush',()=>controlled('stream-flush',()=>e.gl_wat_stream_flush()));
      const primitiveSpecs=[
        {p:[[-.875,-.875,0]],prov:0},
        {p:[[-1,-.875,0],[0,-.875,0]],prov:1},
        {p:[[-1,-.875,0],[0,-.875,0],[-1,1,0]],prov:1},
        {p:[[-1,-.875,0],[0,-.875,0],[-1,1,0]],prov:1},
        {p:[[-1,-1,0],[0,-1,0],[-1,1,0]],prov:2},
        {p:[[-1,-1,0],[0,-1,0],[-1,1,0],[0,1,0]],prov:2},
        {p:[[-1,-1,0],[0,-1,0],[0,1,0],[-1,1,0]],prov:2},
        {p:[[-1,-1,0],[0,-1,0],[0,1,0],[-1,1,0]],prov:3},
        {p:[[-1,-1,0],[0,-1,0],[-1,1,0],[0,1,0]],prov:3},
        {p:[[-1,-1,0],[0,-1,0],[0,1,0],[-1,1,0]],prov:0},
        {p:[[-.875,-.875,0],[.125,-.875,0],[.125,.625,0],[-.875,.625,0]],prov:3},
        {p:[[-2,-2,0,2],[0,-2,0,2],[-2,2,0,2]],prov:2},
      ];
      const colors=[[1,0,0],[0,1,0],[0,0,1],[1,1,0],[1,0,1],[0,1,1]];
      for(let i=0;i<colors.length;i++){
        call('glClearColor',[...colors[i].map(f),f(1)]);call('glClear',[0x4000]);
        if(primitiveMode===null){
          call('glBegin',[4]);call('glColor4f',[f(1),f(1),f(1),f(1)]);
          for(const p of [[-1,-1,0],[0,-1,0],[-1,1,0]])call('glVertex3f',p.map(f));
        }else{
          const spec=primitiveSpecs[primitiveMode];
          call('glShadeModel',[i<3?0x1d01:0x1d00]);
          call('glBegin',[primitiveMode===10?7:primitiveMode===11?4:primitiveMode]);
          spec.p.forEach((p,j)=>{
            if(primitiveMode===10)call('glEdgeFlag',[j===1?0:1]);
            const white=i<3||j===spec.prov;
            call('glColor4f',[f(1),f(white?1:0),f(white?1:0),f(1)]);
            call(primitiveMode===11?'glVertex4f':'glVertex3f',p.map(f));
          });
        }
        call('glEnd');timed('frame-'+i,()=>call('gpuPresent'));
        if(i===2)timed('queued-finish',()=>call('glFinish'));
      }
      const gdiPixel=timed('gdi-read',()=>controlled('GDI GetPixel',()=>e.test_call_GetPixel(dc,7,0)>>>0));
      timed('finish',()=>call('glFinish'));
      call('glReadBuffer',[0x404]); // Explicit FRONT: inspect the presented image after swapping.
      const out=e.guest_alloc(128)>>>0,at=e.guest_to_wasm(out)>>>0;
      new Uint8Array(memory.buffer,at,128).fill(0xa5);
      // G1 owns GL queries natively on both backends, including RED_BITS.
      // Readback below remains the actual delayed backend output barrier.
      timed('query',()=>call('glGetIntegerv',[backend==='webgl'?0xd52:0x84e2,out+16]));
      const query=v.getInt32(at+16,true);
      const queryCanaries=[v.getUint32(at+12,true),v.getUint32(at+20,true)];
      timed('readback',()=>call('glReadPixels',[7,7,1,1,0x1908,0x1401,out+32]));
      const pixel=Array.from(new Uint8Array(memory.buffer,at+32,4));
      const pixelCanaries=[v.getUint32(at+28,true),v.getUint32(at+36,true)];
      postMessage({t:'rendered',backend,handle,gdiPixel,query,queryCanaries,pixel,pixelCanaries,
        pool:[0,1,2].map(i=>e.gl_wat_stream_pool_base(i)>>>0),stats:built.stats});
      self.onmessage=next=>{
        try {
          if(next.data.t==='retired'){
            const value=timed('present-after-retire',()=>call('gpuPresent'));
            const deadline=closeDeadline();postMessage({t:'done',value,stats:built.stats,deadline});self.close();
          }
        }catch(error){postMessage({t:'fixture-error',error:String(error.stack||error)});self.close();}
      };
    }catch(error){postMessage({t:'fixture-error',error:String(error.stack||error)});self.close();}
  };
}

function delayedRenderWorker() {
  // Delivery scheduler only. Real worker code owns instantiation, endpoints,
  // replay, backend, replies and retirement. No command or result replacement.
  const getContext=OffscreenCanvas.prototype.getContext;
  OffscreenCanvas.prototype.getContext=function(type,...args){
    const context=Reflect.apply(getContext,this,[type,...args]);
    if(context&&/^webgl/.test(type)){
      // Observe the fresh fixture's actual driver calls without warming a
      // program, issuing extra GL calls or changing the fixed deadline.
      for(const name of ['compileShader','linkProgram','drawArrays','drawElements','readPixels','finish']){
        if(typeof context[name]!=='function')continue;
        const original=context[name];
        context[name]=function(...args){
          const startedAt=performance.now();
          postMessage({t:'fixture-native-phase',name,phase:'begin',at:startedAt});
          try{return Reflect.apply(original,this,args);}
          finally{postMessage({t:'fixture-native-phase',name,phase:'end',at:performance.now(),elapsed:performance.now()-startedAt});}
        };
      }
      const extension=context.getExtension('WEBGL_debug_renderer_info');
      postMessage({t:'fixture-backend',type,version:context.getParameter(context.VERSION),
        renderer:context.getParameter(extension?extension.UNMASKED_RENDERER_WEBGL:context.RENDERER),
        vendor:context.getParameter(extension?extension.UNMASKED_VENDOR_WEBGL:context.VENDOR)});
    }
    return context;
  };
  importScripts('/lib/d3d-render-worker.js');
  const consume=self.onmessage;
  let delivery=Promise.resolve(),memory;
  self.onmessage=event=>{
    const msg=event.data;
    if(msg.t==='render-init')memory=msg.memory;
    delivery=delivery.then(async()=>{
      if(msg.t==='render-message'){
        await new Promise(resolve=>setTimeout(resolve,300));
        const b=msg.message?.message;
        if(b?.t==='gl-batch'){
          const raw=new Uint8Array(b.commandBuffer||memory.buffer,b.memoryOffset,b.bytes);
          let hash=2166136261;for(const x of raw)hash=Math.imul(hash^x,16777619)>>>0;
          postMessage({t:'fixture-delivery',requestId:msg.message.requestId,offset:b.memoryOffset,
            bytes:b.bytes,hash,ownedCopy:!!b.commandBuffer});
        }
      }
      consume(event);
    }).catch(error=>postMessage({t:'fixture-error',error:String(error.stack||error)}));
  };
}

async function browserScenario(backend, primitiveMode = null) {
  const observations=[],steps=[],frames=[],batches=[],deliveries=[],responses=[],backends=[],contextCounts=[],ownershipFences=[];
  const assert=(ok,label)=>{if(!ok)throw Error(label);};
  const equal=(a,b,label)=>assert(JSON.stringify(a)===JSON.stringify(b),label+': '+JSON.stringify(a)+' != '+JSON.stringify(b));
  const moduleBytes=await(await fetch('/build/wine-assembly.wasm')).arrayBuffer();
  const module=await WebAssembly.compile(moduleBytes);
  const moduleHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',moduleBytes)),x=>x.toString(16).padStart(2,'0')).join('');
  const sigs=(await(await fetch('/lib/host-import-sigs.generated.json')).json()).sigs;
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const hwnd=0x10001,surfaces=new Map(),host={memory};
  for(const [name,sig]of Object.entries(sigs))host[name]=()=>sig.results?.length?0:undefined;
  host.gdi_surface_create=(id,width,height,bpp,bits,stride,topDown)=>{
    surfaces.set(id,new gdiSurfaceLib.GdiSurface({width,height,bpp,storage:memory.buffer,
      storageOffset:bits,stride,topDown:!!topDown}));return 1;};
  host.gdi_surface_attach=()=>1;
  const native=new WebAssembly.Instance(module,{host}),e=native.exports;
  e.init_thread(0,0x400000,0,0,0,0,0,0);e.heap_init(0x800000);
  e.wnd_table_set(hwnd,0);e.ctrl_set_geom(hwnd,0,0,8,8);
  e.wnd_set_style_export(hwnd,0x10000000);e.test_gdi_client_rect_set(hwnd,0,0,8,8);
  const dc=e.test_call_GetDC(hwnd)>>>0;assert(dc,'native window DC');
  const surface=[...surfaces.values()][0];assert(surface,'native canonical window surface');
  const canonical=document.createElement('canvas');canonical.width=canonical.height=8;
  canonical._waCanonicalPresentation={surface};
  const win={hwnd,x:0,y:0,w:8,h:8,clientRect:{x:0,y:0,w:8,h:8},wasm:native};
  let seq=0;
  const renderer={windows:{[hwnd]:win},wasm:native,
    getWindowCanvas:()=>({canvas:canonical,ctx:canonical.getContext('2d')}),
    nextSurfaceWriteSeq:()=>++seq,scheduleRepaint(){}};
  for(const name of ['deferGpuWindowReadback','resolveGpuWindowReadback','mergeGpuLayerIntoBackCanvas'])
    renderer[name]=Win98Renderer.prototype[name];
  const rpc=GuestRpc.views(memory,0).i32;
  let fail,rendered,done,renderWorker,producer,bridge,manager,port,producerResult;
  const failure=new Promise((_,reject)=>{fail=reject;});
  const safe=promise=>Promise.race([promise,failure]);
  const pending=new Map();
  const wait=t=>new Promise(resolve=>pending.set(t,resolve));
  const hash=raw=>{let value=2166136261;for(const x of raw)value=Math.imul(value^x,16777619)>>>0;return value;};
  let retirement,physicalTerminate=false,activeCall,workload;
  const apiCalls=[],watchdogReceipts=[],nativePhases=[],operationEvents=[];let permanentUnknown=false,laterRequests=0;
  const watchdogChannel=new MessageChannel();
  watchdogChannel.port1.onmessage=event=>{watchdogReceipts.push(event.data);if(event.data.t==="PERMANENT_UNKNOWN"){permanentUnknown=true;producer?.terminate();renderWorker?.terminate();fail(Error("PERMANENT_UNKNOWN fixed 3s public-operation deadline "+JSON.stringify(event.data)));}};
  try {
    manager=new RenderWorker.Manager({module,memory,sigs,imageBase:0x400000,
      workerFactory:()=>{
        renderWorker=new Worker('/lib/gl-load-delay-fixture.js');
        const terminate=renderWorker.terminate.bind(renderWorker);
        renderWorker.terminate=()=>{physicalTerminate=true;return terminate();};
        renderWorker.addEventListener('message',event=>{
          const m=event.data;
          if(m.t==='fixture-delivery')deliveries.push({...m,at:performance.now()});
          if(m.t==='fixture-backend')backends.push(m);
          if(m.t==='fixture-native-phase')nativePhases.push({...m,receivedAt:performance.now()});
          if(m.t==='fixture-error'||m.t==='error')fail(Error(m.error));
          if(m.t==='render-event'&&m.message.t==='render-response')responses.push({requestId:m.message.requestId,at:performance.now()});
        });return renderWorker;
      },onError:fail,reclaimHeap:head=>e.d3d_render_adopt_free_list(head)});
    await safe(manager.ready);
    bridge=new GLRenderHost.Bridge({backend,renderer,exports:e,
      createCanvas:(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;},
      createRenderEndpoint:options=>(port=manager.createEndpoint(options)),
      onContextCountChange:count=>contextCounts.push(count),
      onPresent:layer=>{
        if(!layer.canvas.isConnected){document.body.appendChild(layer.canvas);layer.canvas.style.width='256px';layer.canvas.style.imageRendering='pixelated';}
        const ctx=layer.canvas.getContext('2d');
        frames.push({...(primitiveMode===0 && frames.length===0 ? {pointPixels:Array.from(ctx.getImageData(0,0,8,8).data)} : {}),background:Array.from(ctx.getImageData(7,0,1,1).data),
          triangle:Array.from(ctx.getImageData(0,7,1,1).data),
          homogeneous:Array.from(ctx.getImageData(2,6,1,1).data),boundary:[[0,3],[2,1],[4,4],[2,4]].map(([x,y])=>Array.from(ctx.getImageData(x,y,1,1).data)),at:performance.now()});
      }});
    const broker=GuestRpc.createMainBroker(memory,{
      beep_process_begin:()=>1,beep_thread_begin:()=>1,
      dx_trace:(...args)=>observations.push({kind:'native-trace',args}),
      gpu_gl_batch:(desc,owner)=>{
        const index=batches.length,raw=new Uint8Array(memory.buffer,desc.memoryOffset,desc.bytes);
        const ops=[];GLCommandStream.replay(GLCommandStream.memoryBatch(memory,desc.memoryOffset,desc.bytes),(op)=>{ops.push(op);return 0;});
        const item={index,offset:desc.memoryOffset,bytes:desc.bytes,hash:hash(raw),ops,
          pool:desc.pool,api:{...activeCall},packetStatsBefore:{...bridge.packetStats},
          receivedAt:performance.now(),framesBefore:frames.length,responsesBefore:responses.length};
        for(const earlier of batches)if(earlier.offset===item.offset&&earlier.hash!==item.hash)
          observations.push({kind:'overwrite',earlier:earlier.index,later:index});
        batches.push(item);
        const batch=Object.assign(GLCommandStream.memoryBatch(memory,desc.memoryOffset,desc.bytes),
          {pool:desc.pool,softwareFront:desc.softwareFront,softwareConfig:desc.softwareConfig});
        return Promise.resolve(bridge.replay(batch,owner)).then(value=>{
          item.ackAt=performance.now();item.responsesAtAck=responses.length;
          item.packetStatsAtAck={...bridge.packetStats};
          item.leased=item.packetStatsAtAck.leasedBatches-item.packetStatsBefore.leasedBatches;
          item.framesAtAck=frames.length;item.queueAtAck=bridge.submissions.used;return value;
        });
      },gpu_gl_call:(op,owner)=>{
        assert(op===0x10002,'only native GDI readback bridge call expected');
        const fence={hwnd:owner,batchesBefore:batches.length,responsesBefore:responses.length,at:performance.now()};
        ownershipFences.push(fence);
        return bridge.synchronize(()=>{
          const value=renderer.resolveGpuWindowReadback(owner)?1:0;
          fence.responsesAtReturn=responses.length;fence.value=value;fence.completedAt=performance.now();
          return value;
        });
      }
    },sigs,{onError:(name,error)=>fail(Error(name+': '+error.stack))});
    rendered=wait('rendered');done=wait('done');
    producer=new Worker('/test/gl-load-producer-fixture.js');
    producer.onerror=event=>fail(Error(event.message));
    producer.onmessage=event=>{
      if(permanentUnknown){laterRequests++;return;}
      try {
        const m=event.data;
        if(m.t==='glBatch'){
          assert(!Object.hasOwn(m,'batch'),'native transport must be shared offset');
          assert(Atomics.load(rpc,GuestRpc.SLOT.STATUS)===GuestRpc.STATUS_REQ,'broker sees waiting native producer');
          assert(broker.serveGlBatch(m),'production broker serves actual waiting producer');
        }else if(m.t==='rpc')broker.serveRpc(m.slot);
        else if(m.t==='calls')broker.serveCalls(m);
        else if(m.t==='api'){activeCall=m;apiCalls.push(m);}
        else if(m.t==='step')steps.push({...m,batches:batches.length});
        else if(m.t==='fixture-operation')operationEvents.push(m);
        else if(m.t==='fixture-error'){if(String(m.error).includes('PERMANENT_UNKNOWN')){permanentUnknown=true;producer?.terminate();renderWorker?.terminate();}fail(Error(m.error));}
        else if(pending.has(m.t)){pending.get(m.t)(m);pending.delete(m.t);}
        else fail(Error('unexpected producer message '+JSON.stringify(m)));
      }catch(error){fail(error);}
    };
    producer.postMessage({t:'start',module,memory,sigs,backend,hwnd,dc,primitiveMode,watchdogPort:watchdogChannel.port2},[watchdogChannel.port2]);
    const result=producerResult=await safe(rendered);
    await safe(bridge.drain());
    // Freeze the producer workload before the separate context-retirement
    // requests extend the same endpoint's delivery/reply transcript.
    workload={submitted:batches.length,sent:deliveries.length,completed:responses.length,
      packetStats:{...bridge.packetStats},liveCredits:bridge.submissions.used};
    equal(frames.map(x=>x.background),[[255,0,0,255],[0,255,0,255],[0,0,255,255],
      [255,255,0,255],[255,0,255,255],[0,255,255,255]],'literal presented frame FIFO');
    equal(frames.map(x=>x.triangle),Array(6).fill([255,255,255,255]),'literal packed triangle pixels');
    if(primitiveMode===10)frames.forEach((frame,i)=>equal(frame.boundary,[[255,255,255,255],[255,255,255,255],frame.background,frame.background],'literal left/top edge, suppressed right edge and absent quad diagonal frame '+i));
    if(primitiveMode===11)equal(frames.map(frame=>frame.homogeneous),Array(6).fill([255,255,255,255]),'actual Worker homogeneous W division interior pixel');
    equal(result.pixel,[0,255,255,255],'native glReadPixels final color');
    equal(result.gdiPixel,0xffff00,'native producer GetPixel crosses actual pre-GDI readback fence');
    equal(result.query,backend==='webgl'?8:2,'query first-instruction output');
    equal(result.queryCanaries,[0xa5a5a5a5,0xa5a5a5a5],'query write canaries');
    equal(result.pixelCanaries,[0xa5a5a5a5,0xa5a5a5a5],'readback write canaries');
    equal(deliveries.map(x=>[x.offset,x.bytes,x.hash]),batches.map(x=>[x.offset,x.bytes,x.hash]),'delayed consumer payload equals submitted native bytes');
    assert(new Set(result.pool).size===3,'three distinct native pool slots');
    for(const [index,b]of batches.entries()){
      equal(b.pool,{version:1,capacity:GLCommandStream.DEFAULT_BYTES,offsets:result.pool},'stable production pool descriptor');
      equal(b.offset,result.pool[index%3],'native producer pool rotates in exact publication order');
    }
    assert(observations.some(x=>x.kind==='overwrite'),'native stream visibly overwrote released storage');
    const frameBatches=batches.filter(x=>x.ops.at(-1)===OpenGLCompat.CALL_INDEX.gpuPresent);
    equal(frameBatches.length,6,'six native frame publications');
    equal(steps.filter(x=>x.name.startsWith('frame-')).map(x=>x.value),Array(6).fill(1),'literal native SwapBuffers success results');
    equal(steps.find(x=>x.name==='finish').value,0,'literal native glFinish result');
    const drawOpcode=primitiveMode===10?GLCommandStream.EDGE_DRAW_OPCODE:GLCommandStream.PACKED_DRAW_OPCODE;
    for(const b of frameBatches)equal(b.ops,[drawOpcode,OpenGLCompat.CALL_INDEX.gpuPresent],'exact complete geometry/present opcodes');
    if(backend==='webgl'){
      assert(backends.some(x=>x.renderer&&/^WebGL/.test(x.version)),'actual render worker WebGL renderer identified');
      // Count leases in their actual scope: setup, clears and read-buffer
      // selection also publish safe packets. A frame is two submissions.
      const C=OpenGLCompat.CALL_INDEX,expected=[
        ['wglCreateContext',[C.wglCreateContext],0],
        ['wglMakeCurrent',[C.wglMakeCurrent],0],
        ['glPixelStorei',[...(primitiveMode===10?[C.glPolygonMode]:[]),C.glViewport,C.glPixelStorei],1],
        ['glFinish',[C.glFinish],0],
      ];
      for(let i=0;i<6;i++){
        expected.push(['glClear',[C.glClearColor,C.glClear],1],
          ['gpuPresent',[drawOpcode,C.gpuPresent],1]);
        if(i===2)expected.push(['glFinish',[C.glFinish],0]);
      }
      expected.push(['glFinish',[C.glFinish],0],['glReadBuffer',[C.glReadBuffer],1],
        ['glReadPixels',[C.glReadPixels],0]);
      equal(batches.map(b=>[b.api.name,b.ops,b.leased]),expected,
        'every native submission has exactly one API cause and the required lease policy');
      const leased=batches.filter(b=>b.leased===1);
      equal(leased.length,14,'exact original fourteen leased setup/clear/frame/read-buffer batches');
      equal(frameBatches.reduce((n,b)=>n+b.leased,0),6,'six scoped draw/present leases');
      equal(leased.filter(b=>b.api.name==='glClear').length,6,'six separate ordered clear leases');
      equal(bridge.packetStats,{leasedBatches:leased.length,copiedBatches:0,copiedBytes:0},
        'cumulative leases account for all safe submissions with zero copies');
      assert(leased[0].responsesAtAck===leased[0].responsesBefore,'setup ACK precedes replay');
      assert(leased[1].responsesAtAck===leased[1].responsesBefore,'first clear ACK precedes replay');
      assert(leased[2].responsesAtAck===leased[2].responsesBefore,'first draw/present ACK precedes replay');
      const thirdLive=leased[3];
      assert(thirdLive.ackAt-thirdLive.receivedAt>=150,'third live native publication backpressured');
      assert(thirdLive.responsesAtAck>thirdLive.responsesBefore,'oldest replay completed before third live publication ACK');
      assert(batches.every(b=>b.queueAtAck<=2),'all publications respect two live credits');
      equal(deliveries.length,batches.length,'every submitted packet reaches the consumer once');
      equal(responses.length,batches.length,'every submitted packet completes once after drain');
      equal(responses.map(x=>x.requestId),deliveries.map(x=>x.requestId),'sent and completed request FIFO');
      for(const [i,b]of batches.entries()){
        assert(responses[i].at>=deliveries[i].at,'completion follows actual consumer read');
        const previous=batches.findLast((p,j)=>j<i&&p.offset===b.offset);
        if(previous)assert(b.receivedAt>=responses[previous.index].at,
          'slot reuse follows previous reader completion, including synchronous barriers');
      }
      equal(steps.find(x=>x.name==='empty-flush').batches,
        steps.find(x=>x.name==='setup-finish').batches,'empty native flush never submits or rotates');
      equal(bridge.submissions.used,0,'all live credits retired after output barriers');
      equal(bridge.frameOwners.size,0,'no completed frame owner retained');
      assert(deliveries.every(x=>!x.ownedCopy),'shared ranges reach actual worker without copies');
      equal(ownershipFences.length,1,'one actual native pre-GDI ownership fence');
      equal(ownershipFences[0].value,1,'canonical readback succeeds at the ownership fence');
      equal(ownershipFences[0].responsesAtReturn,ownershipFences[0].batchesBefore,
        'GDI readback completes every earlier submitted packet');
      assert(ownershipFences[0].responsesBefore<ownershipFences[0].batchesBefore,
        'GDI fence exercises outstanding actual consumer work');
      assert(steps.find(x=>x.name==='gdi-read').elapsed>=150,'native GDI read waits for pending actual presentations');
      assert(steps.find(x=>x.name==='queued-finish').elapsed>=450,'native finish waits behind the outstanding actual frame queue');
    } else {
      equal(backends.length,0,'native software path creates no WebGL backend');
      equal(bridge.packetStats,{leasedBatches:0,copiedBatches:0,copiedBytes:0},'software keeps synchronous leases');
      assert(frameBatches.every(b=>b.framesAtAck>b.framesBefore),'software waits for real presentation');
    }
    assert(steps.find(x=>x.name==='finish').elapsed>=150,'finish waits behind bounded consumer delay');
    equal(batches.filter(b=>b.api.name==='glGetIntegerv'),[],
      'G1 native query writes caller output without a backend packet on either route');
    assert(steps.find(x=>x.name==='readback').elapsed>=150,'glReadPixels waits for actual consumer output');
    // Exercise production renderer readback methods inside production ordered
    // admission. The pixels are written to the real native GDI window surface.
    if(backend==='webgl'){
      await safe(bridge.synchronize(()=>{assert(renderer.resolveGpuWindowReadback(hwnd),'production canonical readback');}));
      equal(e.test_call_GetPixel(dc,7,0)>>>0,0xffff00,'native GetPixel sees presented cyan');
    }
    const deletion=new ArrayBuffer(40),dv=new DataView(deletion);
    dv.setUint32(0,40,true);dv.setUint32(4,OpenGLCompat.CALL_INDEX.wglDeleteContext,true);
    dv.setUint32(12,8,true);dv.setUint32(36,result.handle,true);
    // A second owner has its own record; lifecycle barriers intentionally use
    // shared process memory just like the native producer's synchronous calls.
    const deleteGuest=e.guest_alloc(40)>>>0,deleteAt=e.guest_to_wasm(deleteGuest)>>>0;
    new Uint8Array(memory.buffer,deleteAt,40).set(new Uint8Array(deletion));
    equal(await safe(bridge.replay(GLCommandStream.memoryBatch(memory,deleteAt,40),2)),0,'cannot delete another owner current context');
    const release=new ArrayBuffer(44),rv=new DataView(release);
    rv.setUint32(0,44,true);rv.setUint32(4,OpenGLCompat.CALL_INDEX.wglMakeCurrent,true);rv.setUint32(12,12,true);
    const releaseGuest=e.guest_alloc(44)>>>0,releaseAt=e.guest_to_wasm(releaseGuest)>>>0;
    new Uint8Array(memory.buffer,releaseAt,44).set(new Uint8Array(release));
    equal(await safe(bridge.replay(GLCommandStream.memoryBatch(memory,releaseAt,44),0)),1,'owner releases context before deletion');
    equal(await safe(bridge.replay(GLCommandStream.memoryBatch(memory,deleteAt,40),2)),1,'cross-owner released context deletion');
    assert([...bridge.activeWindows.values()].every(x=>!x),'context retirement invalidates every active owner');
    producer.postMessage({t:'retired'});
    const finalProducer=await safe(done);
    equal(finalProducer.value,0,'SwapBuffers reports real failure after context retirement');
    assert(finalProducer.deadline.prearmed&&finalProducer.deadline.stopAcknowledged&&finalProducer.deadline.physicallyTerminated,'independent fixed 3s watchdog prearmed and stopped');
    assert(finalProducer.deadline.events.every(event=>event.outcome==='COMPLETED'&&event.completedAt<event.deadline),'every controlled operation completed before its fixed deadline');
    equal(laterRequests,0,'zero requests after permanent UNKNOWN');
    equal(contextCounts.at(-1),0,'real backend reports zero surviving contexts');
    equal(Atomics.load(rpc,GuestRpc.SLOT.STATUS),GuestRpc.STATUS_IDLE,'producer RPC slot idle');
    await safe(bridge.close());assert(port.closed,'endpoint closure acknowledged');
    equal(manager.ports.size,0,'physical worker removed endpoint');
    assert(bridge.layers.size===0&&bridge.frameOwners.size===0,'frame owners and presentation layers retired');
    retirement=await safe(manager.stop());assert(physicalTerminate,'production manager physically terminated worker');
    assert(Object.hasOwn(retirement,'heapHead')&&manager._retired,'real worker acknowledged native heap retirement');
    equal(manager.pending.size,0,'transport pending drained');
    return {backend,moduleHash,webglImplementation:backend==='webgl'?backends:'native WAT software',
      result,deadline:finalProducer.deadline,watchdogReceipts,nativePhases,operationEvents,laterRequests,workload,frames,batches,deliveries,responses,apiCalls,ownershipFences,steps,observations,backends,contextCounts,packetStats:bridge.packetStats,retirement,physicalTerminate};
  } catch(error) {
    window.glLoadFailure={backend,error:String(error.stack||error),moduleHash,producerResult,frames,batches,deliveries,responses,steps,observations,backends,
      permanentUnknown,laterRequests,watchdogReceipts,nativePhases,operationEvents,packetStats:bridge?.packetStats,queue:bridge&&{used:bridge.submissions.used,error:String(bridge.submissions.error)}};
    throw error;
  } finally {
    producer?.terminate();
    watchdogChannel.port1.close();
    if(manager&&!physicalTerminate)renderWorker?.terminate();
  }
}

async function launchBrowser() {
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'gl-native-load-'));
  const chrome=spawn(process.env.CHROME||'/usr/bin/google-chrome',[
    '--headless=new','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0',
    '--user-data-dir='+profile,'--no-sandbox','--no-first-run','--no-default-browser-check',
    '--disable-background-networking','--disable-component-update','--disable-sync',
    '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','about:blank'
  ],{stdio:['ignore','pipe','pipe']});
  let ws,spawnError,stdout='',stderr='',stdoutEOF=false,stderrEOF=false,id=0;const pending=new Map();
  chrome.on('error',e=>spawnError=e);chrome.stdout.on('data',b=>stdout+=b);chrome.stderr.on('data',b=>stderr+=b);
  chrome.stdout.on('end',()=>{stdoutEOF=true;});
  chrome.stderr.on('end',()=>{stderrEOF=true;});
  const exited=new Promise(resolve=>chrome.once('exit',(code,signal)=>resolve({code,signal})));
  const closed=new Promise(resolve=>chrome.once('close',(code,signal)=>resolve({code,signal})));
  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function close(terminalUnknown=false) {
    if(!terminalUnknown&&ws?.readyState===WebSocket.OPEN)await send('Browser.close').catch(()=>{});
    let grace;
    await Promise.race([exited,new Promise(resolve=>{grace=setTimeout(resolve,500);})]);clearTimeout(grace);
    if(chrome.exitCode===null&&!chrome.signalCode){
      const timer=setTimeout(()=>chrome.kill('SIGKILL'),3000);
      try {chrome.kill('SIGTERM');await exited;} finally {clearTimeout(timer);}
    }
    ws?.close();fs.rmSync(profile,{recursive:true,force:true});
    return {pid:chrome.pid,...await closed,actualWait:true,
      stdoutEOF,stderrEOF,stdout,stderr,terminalUnknown,fixtureHostStop:true};
  }
  function send(method,params={}) {return new Promise((resolve,reject)=>{
    const n=++id,timer=setTimeout(()=>{pending.delete(n);reject(Error('CDP timeout '+method));},45000);
    pending.set(n,{resolve:r=>{clearTimeout(timer);resolve(r);},reject:e=>{clearTimeout(timer);reject(e);}});
    ws.send(JSON.stringify({id:n,method,params}));
  });}
  async function evaluate(expression) {
    const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;
  }
  try {
    const portFile=path.join(profile,'DevToolsActivePort'),start=Date.now();
    while(!fs.existsSync(portFile)){
      if(spawnError)throw spawnError;
      if(chrome.exitCode!==null||chrome.signalCode)throw Error('Chrome exited: '+stderr);
      if(Date.now()-start>20000)throw Error('Chrome startup timeout: '+stderr);await delay(50);
    }
    const port=Number(fs.readFileSync(portFile,'utf8').split('\n')[0]);assert(port>0&&port<=65535);
    const response=await fetch('http://127.0.0.1:'+port+'/json/list');assert(response.ok);
    const page=(await response.json()).find(p=>p.type==='page'&&p.url==='about:blank');assert(page);
    const url=new URL(page.webSocketDebuggerUrl);assert(['127.0.0.1','localhost'].includes(url.hostname));
    ws=new WebSocket(url);
    ws.addEventListener('message',event=>{const m=JSON.parse(event.data),p=pending.get(m.id);if(p){
      pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);
    }});
    ws.addEventListener('close',()=>{for(const p of pending.values())p.reject(Error('CDP disconnected'));pending.clear();});
    await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
    // Page WebGL identity may be altered by the installed browser. Inspect
    // the browser's GPU implementation separately through its browser target.
    const metadata=await(await fetch('http://127.0.0.1:'+port+'/json/version')).json();
    const browserSocket=new WebSocket(metadata.webSocketDebuggerUrl);
    const systemInfo=await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{browserSocket.close();reject(Error('GPU system info timeout'));},10000);
      browserSocket.addEventListener('open',()=>browserSocket.send(JSON.stringify({id:1,method:'SystemInfo.getInfo'})),{once:true});
      browserSocket.addEventListener('message',event=>{
        const m=JSON.parse(event.data);if(m.id!==1)return;
        clearTimeout(timer);browserSocket.close();m.error?reject(Error(JSON.stringify(m.error))):resolve(m.result);
      });
      browserSocket.addEventListener('error',error=>{clearTimeout(timer);reject(error);},{once:true});
    });
    return {close,send,evaluate,exited,pid:chrome.pid,version:await send('Browser.getVersion'),systemInfo};
  } catch(error) {await close();throw error;}
}

(async()=>{
  const served=[];
  const virtual={
    '/test/gl-load-producer-fixture.js':'('+producerWorker.toString()+')()',
    '/lib/gl-load-delay-fixture.js':'('+delayedRenderWorker.toString()+')()'
  };
  const server=await startStaticServer({root:ROOT,crossOriginIsolated:true,handleRequest(request,response){
    const url=new URL(request.url,'http://localhost'),name=url.pathname;
    if(name==='/'){
      response.setHeader('Content-Type','text/html');response.end('<!doctype html><title>Native GL real worker load fixture</title>');return;
    }
    if(virtual[name]){const source=virtual[name];served.push({path:name,virtual:true,bytes:Buffer.byteLength(source),
      sha256:crypto.createHash('sha256').update(source).digest('hex')});
      response.setHeader('Content-Type','text/javascript');response.end(source);return;}
    const file=path.resolve(ROOT,'.'+name);
    if(!file.startsWith(ROOT+path.sep)||!/^\/(?:lib\/[^/]+\.(?:js|json)|build\/wine-assembly\.wasm)$/.test(name)){
      response.writeHead(404);response.end();return;
    }
    try{response.setHeader('Content-Type',file.endsWith('.wasm')?'application/wasm':file.endsWith('.json')?'application/json':'text/javascript');
      const bytes=fs.readFileSync(file);served.push({path:name,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
      response.end(bytes);}catch(error){response.writeHead(404);response.end(String(error));}
  }});
  const startedAt=new Date().toISOString(),report={startedAt,results:[],
    scope:selectedPrimitiveArg?'selected-primitive-two-backends':process.argv.includes('--point-witness')?'software-point-full-pixel-witness':process.argv.includes('--primitives')?'all-26-browser-primitive-scenarios':'default-two-backends',
    selectedPrimitive,
    expectedScenarios:process.argv.includes('--point-witness')?1:selectedPrimitiveArg?2:process.argv.includes('--primitives')?26:2};
  let browser;
  try {
    browser=await launchBrowser();report.browser=browser.version;report.systemInfo=browser.systemInfo;
    assert.strictEqual(report.systemInfo.gpu.auxAttributes.displayType,'ANGLE_SWIFTSHADER',
      'browser GPU system info confirms software WebGL; page renderer identity alone is insufficient');
    await browser.send('Page.enable');
    await browser.send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/'});
    for(let i=0;i<100;i++){
      if(await browser.evaluate('location.origin.startsWith("http://127.0.0.1:") && document.readyState === "complete"'))break;
      await new Promise(resolve=>setTimeout(resolve,25));
    }
    assert(await browser.evaluate('crossOriginIsolated'),'fixture requires cross-origin isolated shared memory');
    for(const lib of ['region-map.generated','mem-utils','gpu-backend','gl-command-stream','gl-compat',
      'guest-rpc','render-worker','gl-render-host','gdi-surface','surface','renderer']){
      await browser.evaluate('(async()=>{const e=document.createElement("script");e.src="/lib/'+lib+'.js";document.head.appendChild(e);await new Promise((r,j)=>{e.onload=r;e.onerror=j;});})()');
    }
    for(const primitiveMode of selectedPrimitiveArg?[selectedPrimitive]:process.argv.includes('--point-witness')?[0]:process.argv.includes('--primitives')?[null,0,1,2,3,4,5,6,7,8,9,10,11]:[null]) for(const backend of process.argv.includes('--point-witness')?['software']:['webgl','software']){
      const result=await browser.evaluate('('+browserScenario.toString()+')('+JSON.stringify(backend)+','+JSON.stringify(primitiveMode)+')');
      result.primitiveMode=primitiveMode;
      report.results.push(result);
      let targets;
      for(let i=0;i<40;i++){
        targets=(await browser.send('Target.getTargets')).targetInfos.filter(x=>x.type==='worker'&&(/gl-load-(?:producer|delay)-fixture/.test(x.url)||x.url===result.deadline.workerURL));
        if(!targets.length)break;
        await new Promise(resolve=>setTimeout(resolve,50));
      }
      assert.deepStrictEqual(targets,[],'own physical browser Worker targets absent after retirement');
      result.workerTargetsAfter=targets;
      if(process.env.GL_LOAD_OUTPUT && (primitiveMode===null || process.argv.includes('--point-witness') ||
        (backend==='software' && [6,10].includes(primitiveMode)))){
        const shot=await browser.send('Page.captureScreenshot',{format:'png'});
        const suffix=primitiveMode===null||process.argv.includes('--point-witness')?'':'.primitive-'+primitiveMode;
        fs.writeFileSync(process.env.GL_LOAD_OUTPUT+'.'+backend+suffix+'.png',Buffer.from(shot.data,'base64'));
      }
    }
    assert.equal(report.results.length,report.expectedScenarios,'every selected backend/primitive scenario completed');
    report.passed=true;
  }catch(error){report.error=String(error.stack||error);
    if(browser)report.firstFailure=await browser.evaluate('window.glLoadFailure || null').catch(()=>null);
    if(browser && process.env.GL_LOAD_OUTPUT && process.argv.includes('--point-witness') && !report.firstFailure?.permanentUnknown){
      const shot=await browser.send('Page.captureScreenshot',{format:'png'});
      fs.writeFileSync(process.env.GL_LOAD_OUTPUT+'.failure.png',Buffer.from(shot.data,'base64'));
    }
    throw error;}
  finally {
    if(browser)report.chromeExit=await browser.close(Boolean(report.firstFailure?.permanentUnknown)||String(report.error).includes('PERMANENT_UNKNOWN'));
    if(report.chromeExit)assert(report.chromeExit.stdoutEOF&&report.chromeExit.stderrEOF,'actual Chrome stdout and stderr EOF');
    await new Promise(resolve=>server.close(resolve));
    report.finishedAt=new Date().toISOString();
    report.served=served;
    report.moduleSha256=crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,'build/wine-assembly.wasm'))).digest('hex');
    if(process.env.GL_LOAD_OUTPUT)fs.writeFileSync(process.env.GL_LOAD_OUTPUT+'.json',JSON.stringify(report,null,2));
    console.log(JSON.stringify(report));
  }
})().catch(error=>{console.error(error);process.exitCode=1;});

