'use strict';
// Native ownership investigation. Fixtures are never original gameplay.
// The browser entry points require an external, independently armed supervisor.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');

function retainedOriginal(folder){
  const read=name=>JSON.parse(fs.readFileSync(path.join(folder,name)));
  const boundary=read('original-boundary.json');
  assert(boundary.unknownPermanent&&boundary.requestsAfterTerminal===0);
  assert.equal(boundary.operation.method,'Page.captureScreenshot');
  assert.equal(boundary.operation.deadlineMs,3000);
  assert(boundary.lateResponse.afterTerminal&&boundary.lateResponse.afterDeadline);
  assert.equal(boundary.gameDowns,0);
  // These observations do not contain the native ownership bit or the actual
  // canonical presentation identity at request 554. Never infer that branch
  // from GL counters, the presence of an export in source, or PID absence.
  return {historicalClosed:true,requestsAfterTerminal:0,operation:boundary.operation,
    lateElapsedMs:boundary.lateResponse.elapsedMs,
    hwnd:boundary.freshCompletion.hwnd,context:boundary.freshCompletion.snapshot.contexts,
    nativeOwnershipBranch:'UNKNOWN_NOT_RECORDED',captureInternalCause:'UNPROVED',
    source:{path:path.join(folder,'original-boundary.json'),sha256:hash(fs.readFileSync(path.join(folder,'original-boundary.json')))}};
}

// Runs in a real producer Worker with the existing native WAT encoder and
// GuestRpc broker, just like test-gl-native-render-load-web.js. No JS encoder,
// hand-packed replacement stream, artificial wait, clock or game read.
function producerWorker(){
  importScripts('/lib/region-map.generated.js','/lib/gl-command-stream.js',
    '/lib/guest-rpc.js','/lib/gl-software-producer.js','/lib/gl-compat.js');
  self.onmessage=event=>{
    if(event.data.t!=='start')return;
    try{
      const {module,memory,sigs,hwnd,dc}=event.data;
      let instance;
      const software=new GLSoftwareProducer.Producer(()=>instance.exports);
      const built=GuestRpc.createWorkerImports(memory,sigs,m=>postMessage(m),
        {slot:0,getExports:()=>instance?.exports,softwareGLConfig:software.config,
          configureSoftwareGL:c=>software.configure(c)});
      instance=new WebAssembly.Instance(module,built.imports);
      const e=instance.exports,v=new DataView(memory.buffer);
      e.init_thread(1,0x400000,0,0,0,0,0,0);
      if(e.gl_wat_stream_pool_enable(1)!==1)throw Error('native pool unavailable');
      const stack=RegionMap.BASE.GUEST_STACK+0x4000;
      const call=(name,args=[],aux=0)=>{
        new Uint8Array(memory.buffer,stack,128).fill(0);
        v.setUint32(stack,0xdec0adde,true);
        args.forEach((x,i)=>v.setUint32(stack+4+i*4,x>>>0,true));
        return e.gl_wat_encoder_call(OpenGLCompat.CALL_INDEX[name],stack,aux)|0;
      };
      const f=x=>{v.setFloat32(stack+124,x,true);return v.getUint32(stack+124,true);};
      const context=call('wglCreateContext',[],hwnd);
      if(!context||call('wglMakeCurrent',[0,context],hwnd)!==1)throw Error('native WGL context');
      call('glViewport',[0,0,640,480]);call('glDisable',[0xbd0]);
      function frame(count=1,gdiEager=false){
        let presents=0;
        for(let i=0;i<count;i++){
          call('glClearColor',[f(.25),f(.125),f(.5),f(1)]);call('glClear',[0x4000]);
          call('glBegin',[4]);call('glColor4f',[f(0),f(1),f(0),f(1)]);
          for(const p of [[-1,-1,0],[1,-1,0],[0,1,0]])call('glVertex3f',p.map(f));
          call('glEnd');call('glFrontFace',[0x901]);
          if(i%15===14||i===count-1){
            if(call('gpuPresent')!==1)throw Error('native present failed');
            presents++;
            // A real native GDI source access forces canonical readback at
            // the ordinary pre-GDI fence. This is an eager readback control,
            // not a fake old module or an ownership=>1 substitute.
            if(gdiEager)e.test_call_GetPixel(dc,639,0);
          }
        }
        return presents;
      }
      frame();call('glFinish');
      postMessage({t:'ready',context,processId:e.get_process_id(),threadId:e.get_current_thread_id(),rpcSlot:0,
        pool:[0,1,2].map(i=>e.gl_wat_stream_pool_base(i)>>>0)});
      self.onmessage=next=>{
        const m=next.data;
        try{
          if(m.t==='frame'||m.t==='burst'){
            postMessage({t:'started',id:m.id,at:performance.timeOrigin+performance.now()});
            const presents=frame(m.t==='burst'?209:1,m.gdiEager===true);
            postMessage({t:'completed',id:m.id,presents,at:performance.timeOrigin+performance.now()});
          }else if(m.t==='gdi'){
            const value=e.test_call_GetPixel(dc,639,0)>>>0;
            postMessage({t:'completed',id:m.id,value,at:performance.timeOrigin+performance.now()});
          }else if(m.t==='retire'){
            call('glFinish');call('wglMakeCurrent',[0,0]);
            if(call('wglDeleteContext',[context])!==1)throw Error('context retirement');
            postMessage({t:'completed',id:m.id,retired:true});self.close();
          }else throw Error('unknown fixture command');
        }catch(error){postMessage({t:'fixture-error',error:String(error.stack||error)});self.close();}
      };
    }catch(error){postMessage({t:'fixture-error',error:String(error.stack||error)});self.close();}
  };
}

async function browserSetup({hostPresentation=false}={}){
  const check=(v,s)=>{if(!v)throw Error(s);};
  const module=await WebAssembly.compile(await(await fetch('/build/wine-assembly.wasm')).arrayBuffer());
  const sigs=(await(await fetch('/lib/host-import-sigs.generated.json')).json()).sigs;
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const screen=document.getElementById('output');screen.width=hostPresentation?640:800;screen.height=hostPresentation?480:600;
  const renderer=new Win98Renderer(screen),surfaces=new Map(),host={memory};
  renderer.singleAppMode=hostPresentation;
  for(const [name,sig]of Object.entries(sigs))host[name]=()=>sig.results?.length?0:undefined;
  let native;
  host.gdi_surface_create=(id,width,height,bpp,bits,stride,topDown)=>{
    const surface=new gdiSurfaceLib.GdiSurface({width,height,bpp,stride,topDown:!!topDown,
      storage:memory.buffer,storageOffset:bits,onWrite:(at,bytes)=>native?.exports.page_watch_write?.(at,bytes)});
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d');
    let image;
    const flush=()=>{const dirty=surface.takeDirtyRect();if(!dirty)return 1;
      if(!image||image.width!==dirty.w||image.height!==dirty.h)image=ctx.createImageData(dirty.w,dirty.h);
      surface.rgbaRect(dirty.x,dirty.y,dirty.w,dirty.h,image.data);ctx.putImageData(image,dirty.x,dirty.y);return 1;};
    const p={id,width,height,canvas,surface,bitsWa:bits,flush};
    canvas._waCanonicalPresentation=p;canvas._waFlushCanonicalSurface=flush;
    surfaces.set(id,p);surface.markDirty(0,0,width,height);flush();surface.onDirty=()=>renderer.scheduleRepaint();return 1;
  };
  host.gdi_surface_attach=(id,hwnd)=>{const p=surfaces.get(id);check(p,'native surface exists');p.hwnd=hwnd;return renderer.attachWindowSurface(hwnd,p.canvas)?1:0;};
  host.gdi_surface_upload=(id,l,t,r,b)=>{const p=surfaces.get(id);check(p,'native upload surface');p.surface.markDirty(l,t,r-l,b-t);return 1;};
  native=new WebAssembly.Instance(module,{host});const e=native.exports;
  renderer.wasm=native;renderer.wasmMemory=memory;
  e.init_thread(0,0x400000,0,0,0,0,0,0);e.heap_init(0x800000);
  // The exact exported registration/geometry controls used by the existing
  // actual-native readback test. GetDC allocates the genuine native record,
  // DIB and storage; JS never manufactures that record or ownership success.
  const hwnd=0x10001;
  check(e.gl_window_set_gpu_owned(hwnd,1)===0,'unregistered ownership must fail');
  const origin=hostPresentation?0:40;
  e.wnd_table_set(hwnd,0);e.ctrl_set_geom(hwnd,origin,origin,640,480);
  e.wnd_set_style_export(hwnd,0x90000000);e.test_gdi_client_rect_set(hwnd,0,0,640,480);
  check(e.get_client_rect_r(hwnd)-e.get_client_rect_l(hwnd)===640&&
    e.get_client_rect_b(hwnd)-e.get_client_rect_t(hwnd)===480,'native client rectangle is window-relative');
  renderer.createWindow(hwnd,0x90000000,origin,origin,640,480,'Native GL ownership fixture',0,native,memory);
  const win=renderer.windows[hwnd];win.processId=e.get_process_id();check(win.processId>0,'actual native process ID');
  const dc=e.test_call_GetDC(hwnd)>>>0;check(dc,'native GetDC');
  const record=e.test_gdi_window_surface_record(hwnd)>>>0;check(record,'native window surface record');
  const canonical=renderer.getWindowCanvas(hwnd).canvas;
  check(canonical._waCanonicalPresentation?.surface,'actual canonical surface attached');
  const nativeRecord=new DataView(memory.buffer),presentation=canonical._waCanonicalPresentation;
  check(nativeRecord.getUint32(record,true)===hwnd,'native record owner');
  check(nativeRecord.getUint32(record+8,true)===640&&nativeRecord.getUint32(record+12,true)===480,'native surface dimensions');
  check(presentation.surface.storage.buffer===memory.buffer&&presentation.surface.storageOffset===nativeRecord.getUint32(record+16,true),'canonical storage is the actual native DIB');
  check(e.gl_window_readback_version()===1&&e.gl_window_set_gpu_owned(hwnd,1)===1,'actual ownership export');
  check(e.gl_window_set_gpu_owned(hwnd,0)===1,'actual clear ownership');
  const ownership=()=>Atomics.load(new Int32Array(memory.buffer),((record+28)>>>2));
  const frames=[],events=[],batches=[],pending=new Map();
  let failed,serial=0,readyResolve;
  const ready=new Promise(resolve=>readyResolve=resolve);
  const fail=error=>{failed=error;readyResolve();for(const p of pending.values())p.reject(error);pending.clear();};
  const manager=new RenderWorker.Manager({module,memory,sigs,imageBase:0x400000,onError:fail,
    reclaimHeap:head=>e.d3d_render_adopt_free_list(head)});
  await manager.ready;
  let port;
  const bridge=new GLRenderHost.Bridge({backend:'webgl',renderer,exports:e,
    glBatchDiagnostics:{enabled:true,maxRecords:128},
    createRenderEndpoint:options=>(port=manager.createEndpoint(options)),
    onPresent:layer=>{frames.push({at:performance.timeOrigin+performance.now(),
      pending:!!layer.pendingWindowReadback,merged:!!layer.mergedIntoWindow,owned:ownership()});}});
  const broker=GuestRpc.createMainBroker(memory,{
    beep_process_begin:()=>1,beep_thread_begin:()=>1,
    gpu_gl_batch:(desc,owner)=>{
      const row={at:performance.timeOrigin+performance.now(),owner,bytes:desc.bytes};batches.push(row);
      const batch=Object.assign(GLCommandStream.memoryBatch(memory,desc.memoryOffset,desc.bytes),
        {pool:desc.pool,softwareFront:desc.softwareFront,softwareConfig:desc.softwareConfig});
      return Promise.resolve(bridge.replay(batch,owner)).then(value=>{row.ack=performance.timeOrigin+performance.now();return value;});
    },
    gpu_gl_call:(op,owner)=>{
      check(op===0x10002,'only genuine pre-GDI readback expected');
      return bridge.synchronize(()=>{const start=performance.timeOrigin+performance.now();
        const value=renderer.resolveGpuWindowReadback(owner)?1:0;
        events.push({kind:'native-pre-GDI-readback',owner,start,end:performance.timeOrigin+performance.now(),value});return value;});
    }
  },sigs,{onError:(name,error)=>fail(Error(name+': '+error))});
  const producer=new Worker('/ownership-producer.js');
  producer.onerror=event=>fail(Error(event.message));
  producer.onmessage=event=>{const m=event.data;try{
    if(m.t==='glBatch')check(broker.serveGlBatch(m),'real broker admits native stream');
    else if(m.t==='rpc')broker.serveRpc(m.slot);
    else if(m.t==='calls')broker.serveCalls(m);
    else if(m.t==='fixture-error')fail(Error(m.error));
    else if(m.t==='ready'){check(m.processId===win.processId&&m.threadId>0,'native producer process/thread');fixture.context=m.context;fixture.pool=m.pool;fixture.nativeProducer={processId:m.processId,threadId:m.threadId,rpcSlot:m.rpcSlot};readyResolve();}
    else if(m.t==='started')events.push(m);
    else if(m.t==='completed'){events.push(m);const p=pending.get(m.id);check(p,'live fixture command');pending.delete(m.id);p.resolve(m);}
    else throw Error('unknown native producer message');
  }catch(error){fail(error);}};
  const fixture=globalThis.fixture={renderer,native,e,memory,manager,bridge,producer,hwnd,dc,record,canonical,frames,events,batches,
    command(t,options={}){if(failed)return Promise.reject(failed);const id=++serial;const result=new Promise((resolve,reject)=>pending.set(id,{resolve,reject}));producer.postMessage({t,id,...options});return result;},
    async settled(){await bridge.drain();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));if(failed)throw failed;check(!renderer._workerPublicationHeld()&&!renderer._repaintScheduled&&!renderer._repainting,'ordinary publication settled');},
    snapshot(){const layer=win._gpuFrameLayer;return {hwnd,dc,context:this.context,processId:win.processId,nativeProcessId:e.get_process_id(),mainThreadId:e.get_current_thread_id(),nativeProducer:this.nativeProducer,
      owned:ownership(),pending:!!layer?.pendingWindowReadback,merged:!!layer?.mergedIntoWindow,
      sameWindow:renderer.windows[hwnd]===win,sameInstance:win.wasm===native,
      sameCanonical:renderer.getWindowCanvas(hwnd).canvas===canonical,
      sameSurface:canonical._waCanonicalPresentation?.surface===surfaces.get(canonical._waCanonicalPresentation.id)?.surface,
      nativeRecord:e.test_gdi_window_surface_record(hwnd)>>>0,endpoint:port?.id,transport:manager.sequence,pendingTransport:manager.pending.size,
      generation:bridge.windowGenerations.get(win),publication:renderer._immutablePublicationSequence,
      displayedAt:renderer._currentDisplayRecord?.displayedAt,
      presentation:{outputId:renderer._currentDisplayRecord?.display?.output?.id,
        backend:renderer._currentDisplayRecord?.display?.backend,direct:renderer._directPresentation,
        logical:{width:screen.width,height:screen.height},
        output:renderer.presentationCanvas?{width:renderer.presentationCanvas.width,height:renderer.presentationCanvas.height}:null},
      viewport:{width:innerWidth,height:innerHeight},frames:frames.length,events:events.slice(),packetStats:{...bridge.packetStats}};},
    async close(){await this.command('retire');await bridge.close();await manager.stop();producer.terminate();}
  };
  producer.postMessage({t:'start',module,memory,sigs,hwnd,dc});
  await ready;if(failed)throw failed;await fixture.settled();
  return fixture.snapshot();
}

const scripts=['surface','presentation-filter','renderer','gdi-surface','region-map.generated','render-worker','gl-command-stream',
  'mem-utils','gpu-backend','gl-compat','gl-render-host','guest-rpc','gl-software-producer'];
const HTML='<!doctype html><meta charset="utf-8"><title>Native ownership capture fixture</title>'+
  '<style>html,body{margin:0;background:#203041;color:white;font:18px sans-serif}header,footer{padding:18px;background:#314c62}main{padding:24px}canvas{display:block;width:800px;height:600px;border:3px solid #fc0}button{padding:12px;margin:10px}#edge{position:fixed;right:0;bottom:0;background:#a50;padding:8px}</style>'+
  '<header>Complete host viewport / native window ownership</header><main><canvas id="output"></canvas><button>Fixture consent control</button></main><footer>Canonical native surface and actual WebGL</footer><div id="edge">Right / bottom edge</div>'+
  scripts.map(s=>'<script src="/lib/'+s+'.js"></script>').join('');
// Authored host chrome, with the retained original's output/viewport geometry.
// Pixel content is a native fixture; this does not reproduce the old scene or
// assert unknown historical filter/gamma settings.
const HOST_HTML=HTML.replace('<canvas id="output"></canvas>',
  '<canvas id="output"></canvas><canvas id="screen-present" width="684" height="525"></canvas>')+
  '<style>header{position:absolute;left:0;top:0;right:0}main{padding:0}#output,#screen-present{position:absolute;left:10px;top:194px;width:684px;height:525px;border:0}button{position:absolute;left:0;top:115px}footer{position:absolute;left:0;right:0;bottom:0;padding:8px}</style>';

async function chromeControls(out,{mode='ownership',nativeTraceSeconds=0,hostPresentation=false}={}){
  assert(['ownership','deferred-burst','gdi-eager-burst','deferred-current','gdi-eager-current'].includes(mode));
  const cp=require('node:child_process');
  const api=require('../tools/quake3-startup-observation-scheduling.cjs');
  const base=require('../tools/quake3-browser-controller.cjs');
  const {createInventory}=require('../tools/cdp-source-inventory.cjs');
  const {createObserver}=require('../tools/quake3-startup-observer.cjs');
  const {equalFullPixels,traceSummary}=require('./test-quake3-host-scene-capture-latency.cjs');
  const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n',{flag:'wx'});
  const log=(n,v)=>fs.appendFileSync(out+'/'+n,JSON.stringify(v)+'\n');
  const pause=ms=>new Promise(r=>setTimeout(r,ms));
  const until=async(fn,ms=15000)=>{const end=performance.now()+ms;while(!await fn()){assert(performance.now()<end,'bounded native fixture readiness');await pause(10);}};
  const watchdog=JSON.parse(fs.readFileSync(out+'/watchdog-armed.json'));
  assert(watchdog.independent&&fs.existsSync('/proc/'+watchdog.pid)&&watchdog.deadline*1000>Date.now()+10000);
  assert.equal(JSON.parse(fs.readFileSync(out+'/heavy-lock.json')).pid,process.ppid);
  const producerSource='('+producerWorker.toString()+')();';
  const html=hostPresentation?HOST_HTML:HTML;
  save('fixture-http-pin.json',{url:'/ownership-fixture',sha256:hash(html),bytes:Buffer.byteLength(html),beforeServerStart:true});
  save('producer-http-pin.json',{url:'/ownership-producer.js',sha256:hash(producerSource),bytes:Buffer.byteLength(producerSource),beforeServerStart:true});
  const server=await require('./static-server.js').startStaticServer({root:ROOT,crossOriginIsolated:true,
    handleRequest(req,res){if(req.url==='/ownership-fixture'||req.url==='/ownership-producer.js'){
      res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':'text/html');
      res.end(req.url.endsWith('.js')?producerSource:html);return true;}}});
  assert([0,20].includes(nativeTraceSeconds));
  const tracePath=out+'/temporary-native-trace.json';
  const traceFlags=nativeTraceSeconds?['--trace-startup=devtools,cc,viz,gpu,benchmark',
    '--trace-startup-duration='+nativeTraceSeconds,'--trace-startup-format=json','--trace-startup-file='+tracePath]:[];
  const profile=out+'/profile';
  const chrome=cp.spawn('/usr/bin/google-chrome',[...traceFlags,'--headless=new','--no-sandbox','--no-first-run',
    '--no-default-browser-check','--disable-dev-shm-usage','--enable-unsafe-swiftshader',
    '--window-size=1024,'+(hostPresentation?'900':'1000'),'--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],
    {stdio:['ignore','pipe','pipe']});
  chrome.stdout.pipe(fs.createWriteStream(out+'/chrome.stdout.log'));
  chrome.stderr.pipe(fs.createWriteStream(out+'/chrome.stderr.log'));
  save('browser-pid.json',{pid:chrome.pid});
  const joined=new Promise(r=>chrome.once('close',(code,signal)=>r({pid:chrome.pid,code,signal,actualWait:true,
    stdoutEOF:chrome.stdout.readableEnded,stderrEOF:chrome.stderr.readableEnded})));
  const operations=[],sources=[],tasks=[],workers=new Map(),bindings=[];
  const report={mode,hostPresentation,originals:0,repairQualified:false,historicalOwnershipBranch:'UNKNOWN_NOT_RECORDED',
    ownershipSuccessStub:false,artificialWait:false};
  let c,inventory,error;
  try{
    await until(()=>fs.existsSync(profile+'/DevToolsActivePort'),10000);
    const [port,endpoint]=fs.readFileSync(profile+'/DevToolsActivePort','utf8').trim().split('\n');
    c=api.connection('ws://127.0.0.1:'+port+endpoint,null,createObserver({connectionId:'native-ownership',emit:r=>{operations.push(r);log('operations.jsonl',r);}}));await c.ready;
    report.browser=await c.send('Browser.getVersion');
    const targetId=(await c.send('Target.getTargets')).targetInfos.find(t=>t.type==='page').targetId;
    const session=(await c.send('Target.attachToTarget',{targetId,flatten:true})).sessionId;
    report.page={targetId,sessionId:session};
    inventory=createInventory({send:c.send,terminal:()=>c.closed});
    const ev=async(expression,s=session)=>{if(error)throw error;inventory.noteEvaluation(s,expression);
      const r=await c.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},s);
      assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result?.value;};
    c.event=v=>{const p=v.params||{};
      if(v.method==='Runtime.bindingCalled')bindings.push({sessionId:v.sessionId,at:Date.now(),name:p.name,payload:JSON.parse(p.payload)});
      else if(v.method==='Target.attachedToTarget'&&p.targetInfo.type==='worker'){
        const w={sessionId:p.sessionId,targetId:p.targetInfo.targetId};workers.set(w.sessionId,w);inventory.attach(w.sessionId,w.targetId);
        const t=(async()=>{await c.send('Runtime.enable',{},w.sessionId);await c.send('Runtime.addBinding',{name:api.BINDING},w.sessionId);
          await ev(base.GL_OBSERVER,w.sessionId);await ev(api.installation(c,w.sessionId),w.sessionId);
          await c.send('Runtime.addBinding',{name:'__q3OwnershipPhase'},w.sessionId);
          await ev(`(() => {const get=OffscreenCanvas.prototype.getContext,seen=new WeakSet();globalThis.__q3OwnershipBurst=false;OffscreenCanvas.prototype.getContext=function(...args){const gl=get.apply(this,args);if(gl&&/^webgl/.test(args[0])&&!seen.has(gl)){seen.add(gl);const draw=gl.drawArrays;gl.drawArrays=function(...a){if(globalThis.__q3OwnershipBurst){globalThis.__q3OwnershipBurst=false;__q3OwnershipPhase(JSON.stringify({phase:'first-native-draw',begin:performance.timeOrigin+performance.now()}));}return draw.apply(this,a);};}return gl;};return true;})()`,w.sessionId);
          await c.send('Debugger.enable',{},w.sessionId);await c.send('Runtime.runIfWaitingForDebugger',{},w.sessionId);})();
        tasks.push(t);t.catch(e=>{error??=e;});
      }else if(v.method==='Runtime.executionContextCreated')inventory.contextCreated(v.sessionId,p.context);
      else if(v.method==='Runtime.executionContextsCleared')inventory.contextsCleared(v.sessionId);
      else if(v.method==='Runtime.executionContextDestroyed')inventory.contextsCleared(v.sessionId,p.executionContextId);
      else if(v.method==='Target.detachedFromTarget')inventory.detach(p.sessionId);
      else if(v.method==='Debugger.scriptParsed'&&workers.has(v.sessionId)){
        const t=inventory.inspect(v.sessionId,p).then(r=>sources.push(r));tasks.push(t);t.catch(e=>{error??=e;if(!c.closed)c.abort(e);});}
    };
    await c.send('Runtime.enable',{},session);await c.send('Page.enable',{},session);
    await c.send('Runtime.addBinding',{name:'__q3OwnershipPhase'},session);
    await c.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true},session);
    await c.send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/ownership-fixture'},session);
    await until(async()=>await ev("typeof GLRenderHost!=='undefined'&&typeof GuestRpc!=='undefined'"));
    await ev('globalThis.fixtureReady=false;globalThis.fixtureFailure=null;('+browserSetup.toString()+')('+JSON.stringify({hostPresentation})+').then(v=>{fixtureReady=v;}).catch(e=>{fixtureFailure=String(e.stack||e)});true');
    await until(async()=>{const state=await ev('({ready:!!fixtureReady,failure:fixtureFailure})');assert(!state.failure,state.failure);return state.ready;});
    await Promise.all(tasks);if(error)throw error;
    report.source=sources;
    assert(sources.some(v=>v.actualBytesFetched&&v.url?.includes('d3d-render-worker.js')));
    assert(sources.filter(v=>v.actualBytesFetched&&v.scriptLanguage==='WebAssembly').length>=2,'actual producer and render native modules');
    await pause(110);await ev("fixture.command('frame').then(()=>fixture.settled()).then(()=>true)");
    const snapshot=()=>ev('fixture.snapshot()');
    const retire=async()=>{await ev("fixture.close().then(()=>__q3OwnershipPhase(JSON.stringify({phase:'fixture-retired'}))).catch(e=>__q3OwnershipPhase(JSON.stringify({phase:'fixture-retire-error',error:String(e)})));true");
      await until(()=>bindings.some(v=>v.payload.phase==='fixture-retired'||v.payload.phase==='fixture-retire-error'));
      assert(!bindings.some(v=>v.payload.phase==='fixture-retire-error'));};
    report.deferred=await snapshot();
    const valid=s=>{assert(s.sameWindow&&s.sameInstance&&s.sameCanonical&&s.sameSurface);
      assert(s.nativeRecord&&s.endpoint&&s.context&&s.generation&&s.publication>0&&!s.pendingTransport);};
    valid(report.deferred);assert(report.deferred.pending&&!report.deferred.merged&&report.deferred.owned===1);
    if(hostPresentation){
      assert.deepEqual(report.deferred.viewport,{width:1024,height:757});
      assert.equal(report.deferred.presentation.outputId,'screen-present');
      assert.equal(report.deferred.presentation.direct,false);
      assert.deepEqual(report.deferred.presentation.logical,{width:640,height:480});
      assert.deepEqual(report.deferred.presentation.output,{width:684,height:525});
    }
    const hintOwner={endpointId:report.deferred.endpoint,hwnd:report.deferred.hwnd,pending:report.deferred.pendingTransport,sequence:report.deferred.transport,publication:report.deferred.publication};
    report.initialOwnerHints=[...workers.keys()].map(sessionId=>({sessionId,hint:c.startupObservation.read(sessionId,hintOwner)}));
    report.initialDiagnostics=await ev('fixture.bridge.diagnosticSnapshot()');
    const renderSession=report.initialOwnerHints.find(v=>v.hint.status==='READY')?.sessionId;
    assert(renderSession,'current actual native render-owner completion and installation required');
    report.producerHint=c.startupObservation.read(renderSession,hintOwner);report.renderSession=renderSession;
    report.hostLayout=await ev("[...document.querySelectorAll('header,footer,button,#edge,#output,#screen-present')].map(e=>{const b=e.getBoundingClientRect();return {element:e.id||e.tagName,box:b.toJSON(),whole:b.left>=0&&b.top>=0&&b.right<=innerWidth&&b.bottom<=innerHeight&&b.width>0&&b.height>0};})");
    assert(report.hostLayout.length===(hostPresentation?6:5)&&report.hostLayout.every(v=>v.whole));
    const shot=async name=>{const start=performance.now();const data=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},session);
      const bytes=Buffer.from(data.data,'base64');fs.writeFileSync(out+'/'+name,bytes,{flag:'wx'});
      return {bytes,elapsedMs:performance.now()-start,sha256:hash(bytes)};};
    const reference=await shot('result-deferred-host.png');
    report.referenceAfter=await snapshot();valid(report.referenceAfter);
    assert.deepEqual(report.referenceAfter,report.deferred,'quiescent capture must preserve the complete native owner/publication');
    report.reference={elapsedMs:reference.elapsedMs,sha256:reference.sha256};
    report.referenceDiagnostics=await ev('fixture.bridge.diagnosticSnapshot()');
    if(mode==='ownership'){
      const gdi=await ev("fixture.command('gdi').then(v=>fixture.settled().then(()=>v))");
      report.gdi=gdi;report.eager=await snapshot();valid(report.eager);
      assert.equal(gdi.value,0x802040,'native GetPixel reads the actual GL clear color from canonical storage');
      assert(!report.eager.pending&&report.eager.merged&&report.eager.owned===0);
      assert.equal(report.eager.nativeRecord,report.deferred.nativeRecord);
      assert(report.eager.events.some(v=>v.kind==='native-pre-GDI-readback'&&v.value===1));
      const eager=await shot('result-eager-host.png');
      report.eagerAfter=await snapshot();valid(report.eagerAfter);assert.deepEqual(report.eagerAfter,report.eager);
      report.eagerCapture={elapsedMs:eager.elapsedMs,sha256:eager.sha256,pixels:equalFullPixels(reference.bytes,eager.bytes,report.deferred.viewport)};
      await ev("fixture.command('frame').then(()=>fixture.settled()).then(()=>true)");
      report.reacquired=await snapshot();valid(report.reacquired);
      assert(report.reacquired.pending&&!report.reacquired.merged&&report.reacquired.owned===1);
      const again=await shot('result-reacquired-host.png');
      report.reacquiredAfter=await snapshot();valid(report.reacquiredAfter);assert.deepEqual(report.reacquiredAfter,report.reacquired);
      report.reacquiredCapture={elapsedMs:again.elapsedMs,pixels:equalFullPixels(reference.bytes,again.bytes,report.deferred.viewport)};
      report.finalDiagnostics=await ev('fixture.bridge.diagnosticSnapshot()');
      await retire();report.retired=true;
    }else{
      const before=report.deferred.frames;
      const current=mode.endsWith('-current');
      await ev('globalThis.__q3OwnershipBurst=true;true',renderSession);
      await ev("fixture.work=fixture.command('burst',{gdiEager:"+mode.startsWith('gdi-eager')+"});fixture.work.then(()=>fixture.settled()).then(()=>__q3OwnershipPhase(JSON.stringify({phase:'ordinary-publication',snapshot:fixture.snapshot(),diagnostics:fixture.bridge.diagnosticSnapshot(),at:performance.timeOrigin+performance.now()}))).catch(()=>{});true");
      // Observe a production render-owner completion boundary rather than
      // inserting an artificial Worker wait. This page read cannot grant
      // admission to an original, nor can a late response be adopted.
      report.burstDecision=current?{notRequested:true,reason:'passive ordinary publication only'}:await snapshot();
      await until(()=>bindings.some(v=>v.name==='__q3OwnershipPhase'&&v.payload.phase==='first-native-draw'));
      report.firstNativeDrawAt=bindings.find(v=>v.name==='__q3OwnershipPhase'&&v.payload.phase==='first-native-draw').payload.begin;
      if(current){
        await until(()=>bindings.some(v=>v.name==='__q3OwnershipPhase'&&v.payload.phase==='ordinary-publication'));
        const publication=bindings.find(v=>v.name==='__q3OwnershipPhase'&&v.payload.phase==='ordinary-publication').payload;
        report.currentPublication=publication;valid(publication.snapshot);
        const s=publication.snapshot;
        report.currentProducerHint=c.startupObservation.read(renderSession,{endpointId:s.endpoint,hwnd:s.hwnd,
          pending:s.pendingTransport,sequence:s.transport,publication:s.publication});
        report.currentPublicationAgeMs=Date.now()-s.displayedAt;
        if(report.currentPublicationAgeMs<0||report.currentPublicationAgeMs>1000)
          report.currentProducerHint={status:'NOT_READY',reason:'stale or future ordinary publication',workerRequests:0};
        if(report.currentProducerHint.status!=='READY'){
          report.currentCapture={refused:true,reason:report.currentProducerHint.reason,screenshotRequests:0};
          report.burstAfter=s;report.finalDiagnostics=publication.diagnostics;
          assert.equal(s.frames-before,14);
          await retire();report.retired=true;
          report.passed=true;save('capture-report.json',report);return report;
        }
      }
      report.captureStartedAt=Date.now();
      const start=performance.now();
      try{const image=await shot('result-burst-host.png');report.burstCapture={elapsedMs:image.elapsedMs,sha256:image.sha256,pixels:equalFullPixels(reference.bytes,image.bytes,report.deferred.viewport)};}
      catch(e){assert.match(String(e),/UNKNOWN/);assert(c.closed);report.burstCapture={permanentUNKNOWN:true,elapsedMs:performance.now()-start};
        const request=operations.filter(v=>v.type==='request'&&v.method==='Page.captureScreenshot').at(-1);
        await until(()=>operations.some(v=>v.type==='response'&&v.id===request.id));
        const late=operations.find(v=>v.type==='response'&&v.id===request.id);assert(late.afterTerminal&&late.elapsedMs>3000);
        report.burstCapture.lateResponse=late;const n=operations.filter(v=>v.type==='request').length;
        await assert.rejects(c.send('Browser.getVersion'),/UNKNOWN/);assert.equal(operations.filter(v=>v.type==='request').length,n);
        report.requestsAfterUNKNOWN=0;report.latePixelsAdopted=false;}
      report.nativePhases=bindings.filter(v=>v.name==='__q3OwnershipPhase');
      if(!c.closed){await ev('fixture.work.then(()=>fixture.settled()).then(()=>true)');report.burstAfter=await snapshot();valid(report.burstAfter);
        if(current)assert.deepEqual(report.burstAfter,report.currentPublication.snapshot,'current capture preserves exact owner/frame/publication');
        assert.equal(report.burstAfter.frames-before,14);
        report.finalDiagnostics=await ev('fixture.bridge.diagnosticSnapshot()');
        const exits=report.finalDiagnostics.host.records.filter(v=>v.kind==='request-exit');
        report.lastRenderCompletionAt=Math.max(...exits.map(v=>v.timeOrigin+v.atMs));
        report.captureOverlappedNativeTransport=report.captureStartedAt>=report.firstNativeDrawAt-2&&
          report.captureStartedAt<=report.lastRenderCompletionAt+2;
        await retire();report.retired=true;}
    }
    report.passed=true;save('capture-report.json',report);return report;
  }finally{
    save('partial-report.json',report);inventory?.close();
    // Chrome's prearmed native trace stop needs no CDP operation after UNKNOWN.
    // Keep only timing/process/thread boundaries, never trace pixel payloads.
    let traceFailure;
    try{if(nativeTraceSeconds){
      let raw;
      await until(()=>{try{raw=fs.readFileSync(tracePath);JSON.parse(raw);return true;}catch{return false;}},30000);
      const selected=traceSummary(JSON.parse(raw).traceEvents);
      save('capture-trace-boundaries.json',{autostopSeconds:nativeTraceSeconds,
        rawSHA256:hash(raw),rawBytes:raw.length,rawRemoved:true,selected});
      fs.unlinkSync(tracePath);
    }}catch(error){traceFailure=error;save('trace-failure.json',{error:String(error),repairQualified:false});}
    if(c&&!c.closed)try{await c.send('Browser.close');}catch{}
    if(chrome.exitCode===null)chrome.kill('SIGTERM');save('chrome-wait.json',await joined);c?.ws.close();
    fs.rmSync(profile,{recursive:true,force:true});server.closeAllConnections();await new Promise(r=>server.close(r));
    if(traceFailure)throw traceFailure;
  }
}

module.exports={retainedOriginal,producerWorker,browserSetup,HTML,chromeControls};
if(require.main===module){
  const {test}=require('node:test');
  test('retained original stays UNKNOWN; missing ownership telemetry cannot prove parity',
    {skip:!fs.existsSync(ROOT+'/scratch/runs/20261115-quake3-startup-observation-scheduling/original-boundary.json')},()=>{
    const v=retainedOriginal(ROOT+'/scratch/runs/20261115-quake3-startup-observation-scheduling');
    assert.equal(v.nativeOwnershipBranch,'UNKNOWN_NOT_RECORDED');
    assert.equal(v.hwnd,65543);assert(v.lateElapsedMs>3000);
  });
}
