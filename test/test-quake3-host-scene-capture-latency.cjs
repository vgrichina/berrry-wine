'use strict';
// Full host viewport diagnostic; real production Worker/GL/transferred pixels.
// No original, game reads, input, capture substitution or widened CDP deadline.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {PNG}=require('pngjs');
const ROOT=path.resolve(__dirname,'..'),pause=ms=>new Promise(r=>setTimeout(r,ms));
const variants={normal:{format:'png',captureBeyondViewport:false},fast:{format:'png',captureBeyondViewport:false,optimizeForSpeed:true},view:{format:'png',captureBeyondViewport:false,fromSurface:false}};
const scripts=['surface','renderer','region-map.generated','render-worker','gl-command-stream','mem-utils','gpu-backend','gl-compat','gl-render-host'];
const HTML='<!doctype html><meta charset="utf-8"><title>Full host capture control</title><style>html,body{margin:0;background:#203041;color:#fff;font:18px sans-serif}header,footer{padding:18px;background:#314c62}main{padding:24px}canvas{display:block;width:800px;height:600px;border:3px solid #ffcc00}button{padding:12px;margin:10px}#edge{position:fixed;right:0;bottom:0;background:#a50;color:white;padding:8px}</style><header>Complete host viewport • production WebGL and compositor</header><main><canvas id="output"></canvas><button>Fixture consent — no game input</button></main><footer>All displayed pixels, including host controls</footer><div id="edge">Right / bottom viewport edge</div>'+scripts.map(s=>'<script src="/lib/'+s+'.js"></script>').join('');
function setupSource(){
  let s=require('./test-quake3-startup-observation-scheduling.cjs').setupSource();
  s=s.replaceAll('w:16,h:16,clientRect:{w:16,h:16}','w:640,h:480,clientRect:{w:640,h:480}').replaceAll("{name:'glViewport',args:[0,0,16,16]}","{name:'glViewport',args:[0,0,640,480]}");
  // The dense packed stream is 2,188,832 bytes. Reserve only the needed
  // command-buffer capacity through the ordinary exported allocator.
  s=s.replace('const buffer=e.guest_to_wasm(e.guest_alloc(2048))>>>0;',`const allocation=e.guest_alloc(3145728);if(!allocation)throw Error('fixture command allocation failed');const buffer=e.guest_to_wasm(allocation)>>>0;`);
  const direct="if(frame.bitmap){const c=document.getElementById('output');c.width=frame.width;c.height=frame.height;c.getContext('2d').drawImage(frame.bitmap,0,0);frame.bitmap.close();}";
  assert.equal(s.split(direct).length,2);
  s=s.replace(direct,`if(frame.bitmap){fixture.bridge._present(frame,fixture.port.id);fixture.surface=fixture.bridge.layers.get(1).canvas;}`);
  s=s.replace('fixture.port=port;',`fixture.port=port;fixture.bridge=new GLRenderHost.Bridge({renderer:fixture.renderer,exports:e,backend:'webgl'});`);
  s=s.replace('const result=await port.request(',`fixture.bridge.frameOwners.set(fixture.transportFrame+1,new Map([[1,fixture.renderer.windows[1]]]));const result=await port.request(`);
  s=s.replace('await manager.ready;',`const screen=document.getElementById('output');screen.width=800;screen.height=600;
    const renderer=new Win98Renderer(screen),surface=document.createElement('canvas');surface.width=640;surface.height=480;
    renderer.createWindow(1,0x90000000,40,40,640,480,'Production GL fixture',0,{exports:{}},null);
    renderer.attachWindowSurface(1,surface);fixture.renderer=renderer;fixture.surface=surface;
    fixture.settled=async()=>{await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));if(renderer._repaintScheduled||renderer._repainting||renderer._workerPublicationHeld()||!renderer._currentDisplayRecord)throw Error('ordinary compositor not settled');};
    await manager.ready;`);
  s=s.replace('fixture.draw=()=>fixture.batch([{vertices},{name:\'gpuPresent\'}]);',`fixture.draw=()=>fixture.batch([{vertices},{name:'gpuPresent'}]);
    // Deterministic colored geometry goes through the same production packed
    // GL stream. This tests PNG entropy without injecting or painting pixels.
    fixture.renderBurst=()=>{const records=[];for(let i=0;i<209;i++){records.push({vertices},{name:'glFrontFace',args:[0x901]});if(i%15===14||i===208)records.push({name:'gpuPresent'});}return fixture.batch(records);};
    fixture.denseDraw=()=>{const dense=[];let seed=173;
      const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return (seed>>>8)/16777216;};
      for(let y=0;y<60;y++)for(let x=0;x<80;x++){
        const r=random(),g=random(),b=random(),l=x/40-1,h=(x+1)/40-1,t=y/30-1,d=(y+1)/30-1;
        for(const [px,py] of [[l,t],[h,t],[l,d],[h,t],[h,d],[l,d]])dense.push(px,py,0,r,g,b,1,0,0,0,0,1,0,0,1,0,1,0,1);
      }return fixture.batch([{vertices:dense},{name:'gpuPresent'}]);};`);
  assert(s.includes('w:640,h:480')&&s.includes('glViewport\',args:[0,0,640,480]'));
  return s;
}
function equalFullPixels(a,b,viewport){
  const x=PNG.sync.read(a),y=PNG.sync.read(b);
  for(const p of [x,y]){assert.equal(p.width,viewport.width);assert.equal(p.height,viewport.height);}
  assert(x.data.equals(y.data),'every decoded RGBA byte in the host viewport must match');
  return {width:x.width,height:x.height,rgbaBytes:x.data.length,equal:true};
}
function measurements(cases){
  const median=xs=>{const a=xs.slice().sort((x,y)=>x-y),m=Math.floor(a.length/2);assert(a.length);return a.length%2?a[m]:(a[m-1]+a[m])/2;};
  const result=[];
  for(const scene of ['simple','dense']){
    const rows=Object.keys(variants).map(name=>{
      const samples=cases.filter(v=>v.scene===scene&&v.name===name);
      assert(samples.length===6,'complete balanced measurements required');
      return {name,fullPixelEquivalent:samples.every(v=>v.pixels.equal),samples:samples.map(v=>v.elapsedMs),medianMs:median(samples.map(v=>v.elapsedMs)),encoderMedianMs:median(samples.map(v=>v.phases.encoderMs))};
    });
    const normal=rows[0];
    result.push({scene,rows:rows.map(row=>({...row,savedMedianMs:normal.medianMs-row.medianMs,savedFraction:1-row.medianMs/normal.medianMs})),historicalDelayCause:'UNPROVED'});
  }return result;
}
function traceSummary(events){
  const selected=events.filter(v=>!String(v.name).includes('::(lambda)')&&/EncodeBitmap|Screenshot|CopyOutput|CopyFromSurface|Readback|ReadPixels|SubmitCompositorFrame|DrawAndSwap|SwapBuffers|Display::Draw|Commit|ActivateLayerTree|DrawFrame|clock_sync/.test(v.name||''));
  // Arguments may contain pixel payloads. Only timing and process/thread IDs
  // survive; raw traces are not retained and screenshot categories are excluded.
  return selected.map(({name,cat,ph,ts,dur,pid,tid,id,args})=>({name,cat,ph,ts,dur:dur??null,pid,tid,id:id??null,...(name==='clock_sync'?{syncId:typeof args?.sync_id==='string'?args.sync_id:null}:{})}));
}
async function until(fn,ms=15000){const end=performance.now()+ms;while(!fn()){assert(performance.now()<end,'bounded fixture readiness');await pause(10);}}
async function chromeControls(out,{busyArm=null,nativeTraceSeconds=0,busyVariant='normal'}={}){
  assert(Object.hasOwn(variants,busyVariant));
  assert([null,'baseline','scheduled','render-baseline','render-scheduled'].includes(busyArm));
  const api=require('../tools/quake3-startup-observation-scheduling.cjs'),base=require('../tools/quake3-browser-controller.cjs');
  const {createObserver,hash}=require('../tools/quake3-startup-observer.cjs');
  const {createInventory}=require('../tools/cdp-source-inventory.cjs');
  const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n',{flag:'wx'}),log=(n,v)=>fs.appendFileSync(out+'/'+n,JSON.stringify(v)+'\n');
  const watchdog=JSON.parse(fs.readFileSync(out+'/watchdog-armed.json'));assert(watchdog.independent&&fs.existsSync('/proc/'+watchdog.pid)&&watchdog.deadline*1000>Date.now()+10000);
  assert.equal(JSON.parse(fs.readFileSync(out+'/heavy-lock.json')).pid,process.ppid);
  save('fixture-http-pin.json',{url:'/capture-fixture',sha256:hash(HTML),bytes:Buffer.byteLength(HTML),beforeServerStart:true});
  const server=await require('./static-server.js').startStaticServer({root:ROOT,crossOriginIsolated:true,handleRequest(req,res){if(req.url==='/capture-fixture'){res.setHeader('Content-Type','text/html');res.end(HTML);return true;}}});
  const nativeTracePath=out+'/temporary-native-trace.json';
  const traceFlags=nativeTraceSeconds?['--trace-startup=devtools,cc,viz,gpu,benchmark','--trace-startup-duration='+nativeTraceSeconds,'--trace-startup-format=json','--trace-startup-file='+nativeTracePath]:[];
  const profile=out+'/profile',chrome=cp.spawn('/usr/bin/google-chrome',[...traceFlags,'--headless=new','--no-sandbox','--no-first-run','--no-default-browser-check','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--window-size=1024,1000','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','pipe','pipe']});
  chrome.stdout.pipe(fs.createWriteStream(out+'/chrome.stdout.log'));chrome.stderr.pipe(fs.createWriteStream(out+'/chrome.stderr.log'));
  save('browser-pid.json',{pid:chrome.pid});
  const joined=new Promise(r=>chrome.once('close',(code,signal)=>r({pid:chrome.pid,code,signal,actualWait:true,stdoutEOF:chrome.stdout.readableEnded,stderrEOF:chrome.stderr.readableEnded})));
  const report={originals:0,repairQualified:false,productionWorker:true,cases:[],historicalCaptureInternalCause:'UNPROVED'},operations=[],tasks=[],workers=new Map(),sources=[],bindings=[],trace=[],transport=[];
  let c,inventory,error,traceDone=false;
  try{
    await until(()=>fs.existsSync(profile+'/DevToolsActivePort'),10000);
    const [port,endpoint]=fs.readFileSync(profile+'/DevToolsActivePort','utf8').trim().split('\n');
    c=api.connection('ws://127.0.0.1:'+port+endpoint,null,createObserver({connectionId:'host-capture',emit:r=>{operations.push(r);log('operations.jsonl',r);}}));await c.ready;
    // Timestamp delivery and existing decoder/dispatch separately. Preserve
    // the exact connection handler, permanent terminal and deadline behavior.
    const receive=c.ws.onmessage;c.ws.onmessage=function(event){const start=performance.now(),bytes=Buffer.byteLength(event.data);try{return Reflect.apply(receive,this,[event]);}finally{transport.push({start,end:performance.now(),bytes});}};
    report.browser=await c.send('Browser.getVersion');
    const targetId=(await c.send('Target.getTargets')).targetInfos.find(t=>t.type==='page').targetId;
    const session=(await c.send('Target.attachToTarget',{targetId,flatten:true})).sessionId;
    inventory=createInventory({send:c.send,terminal:()=>c.closed});
    const ev=async(expression,s=session)=>{if(error)throw error;inventory.noteEvaluation(s,expression);const r=await c.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},s);assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result?.value;};
    c.event=v=>{
      const p=v.params||{};
      if(v.method==='Tracing.dataCollected')trace.push(...p.value);
      else if(v.method==='Tracing.tracingComplete')traceDone=true;
      else if(v.method==='Runtime.bindingCalled')bindings.push({sessionId:v.sessionId,at:Date.now(),name:p.name,payload:JSON.parse(p.payload)});
      else if(v.method==='Target.attachedToTarget'&&p.targetInfo.type==='worker'){
        const w={sessionId:p.sessionId,targetId:p.targetInfo.targetId};workers.set(w.sessionId,w);inventory.attach(w.sessionId,w.targetId);
        const task=(async()=>{await c.send('Runtime.enable',{},w.sessionId);await c.send('Runtime.addBinding',{name:api.BINDING},w.sessionId);await ev(base.GL_OBSERVER,w.sessionId);await ev(api.installation(c,w.sessionId),w.sessionId);
          if(busyArm){
            await c.send('Runtime.addBinding',{name:'__q3CapturePhase'},w.sessionId);
            await ev(busyArm.startsWith('render-')?`(() => {const get=OffscreenCanvas.prototype.getContext,seen=new WeakSet();globalThis.__q3CaptureBurstArmed=false;OffscreenCanvas.prototype.getContext=function(...args){const gl=get.apply(this,args);if(gl&&/^webgl/.test(args[0])&&!seen.has(gl)){seen.add(gl);const draw=gl.drawArrays;gl.drawArrays=function(...a){if(globalThis.__q3CaptureBurstArmed){globalThis.__q3CaptureBurstArmed=false;__q3CapturePhase(JSON.stringify({phase:'production-burst-first-native-draw',begin:performance.timeOrigin+performance.now()}));}return draw.apply(this,a);};}return gl;};return true;})()`:`(() => {const get=OffscreenCanvas.prototype.getContext,seen=new WeakSet();globalThis.__q3CaptureWaitMs=0;OffscreenCanvas.prototype.getContext=function(...args){const gl=get.apply(this,args);if(gl&&/^webgl/.test(args[0])&&!seen.has(gl)){seen.add(gl);const flush=gl.flush;gl.flush=function(...a){const duration=globalThis.__q3CaptureWaitMs;globalThis.__q3CaptureWaitMs=0;if(duration){const begin=performance.timeOrigin+performance.now();__q3CapturePhase(JSON.stringify({phase:'fixture-wait-before-GL-flush',begin,duration}));Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,duration);__q3CapturePhase(JSON.stringify({phase:'fixture-wait-returned',begin,end:performance.timeOrigin+performance.now()}));}return flush.apply(this,a);};}return gl;};return true;})()`,w.sessionId);
          }
          await c.send('Debugger.enable',{},w.sessionId);await c.send('Runtime.runIfWaitingForDebugger',{},w.sessionId);})();tasks.push(task);task.catch(e=>{error??=e;});
      }else if(v.method==='Runtime.executionContextCreated')inventory.contextCreated(v.sessionId,p.context);
      else if(v.method==='Runtime.executionContextsCleared')inventory.contextsCleared(v.sessionId);
      else if(v.method==='Runtime.executionContextDestroyed')inventory.contextsCleared(v.sessionId,p.executionContextId);
      else if(v.method==='Target.detachedFromTarget')inventory.detach(p.sessionId);
      else if(v.method==='Debugger.scriptParsed'&&workers.has(v.sessionId)){const task=inventory.inspect(v.sessionId,p).then(r=>sources.push(r));tasks.push(task);task.catch(e=>{error??=e;if(!c.closed)c.abort(e);});}
    };
    await c.send('Runtime.enable',{},session);await c.send('Runtime.addBinding',{name:'__q3LatencyEvent'},session);await c.send('Page.enable',{},session);await c.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true},session);
    await c.send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/capture-fixture'},session);
    const end=Date.now()+15000;while(!await ev("typeof OpenGLCompat!=='undefined'")){assert(Date.now()<end);await pause(20);}
    await ev(setupSource());while(!await ev('fixtureReady&&!fixtureFailure')){assert(Date.now()<end);await pause(20);}
    await ev('fixture.drawPromise.then(()=>fixture.settled()).then(()=>true)');await Promise.all(tasks);if(error)throw error;
    report.source=sources;assert(sources.some(v=>v.actualBytesFetched&&v.url?.includes('d3d-render-worker.js')));assert(sources.some(v=>v.scriptLanguage==='WebAssembly'&&v.actualBytesFetched));
    // Produce a real post-inventory fixture frame after the observer's normal
    // emission interval. No timestamp is refreshed or relabelled by the test.
    await pause(110);await ev('fixture.draw().then(()=>fixture.settled()).then(()=>true)');
    const identityExpression=`(() => {const f=fixture,m=f.manager,c=document.getElementById('output'),r=f.renderer;if(!f.captureOwner)f.captureOwner={canvas:c,manager:m,port:f.port,renderer:r,window:r.windows[1],surface:f.surface};return {same:c===f.captureOwner.canvas&&m===f.captureOwner.manager&&f.port===f.captureOwner.port&&r===f.captureOwner.renderer&&r.windows[1]===f.captureOwner.window&&f.surface===f.captureOwner.surface,sequence:m.sequence,pending:m.pending.size,frames:f.frames,publication:r._immutablePublicationSequence,publicationHeld:r._workerPublicationHeld(),repaintPending:r._repaintScheduled||r._repainting,width:innerWidth,height:innerHeight,canvas:{width:c.width,height:c.height},surface:{width:f.surface.width,height:f.surface.height},box:c.getBoundingClientRect().toJSON(),visibility:document.visibilityState,focus:document.hasFocus()};})()`;
    report.owner=await ev(identityExpression);assert(report.owner.same&&report.owner.canvas.width===800&&report.owner.canvas.height===600&&report.owner.surface.width===640&&report.owner.surface.height===480&&report.owner.pending===0&&!report.owner.publicationHeld&&!report.owner.repaintPending&&report.owner.publication>0);
    report.producerHint=c.startupObservation.read([...workers.keys()][0],{endpointId:1,hwnd:1,pending:report.owner.pending,sequence:report.owner.sequence,publication:report.owner.publication});assert.equal(report.producerHint.status,'READY');
    report.hostLayout=await ev(`[...document.querySelectorAll('header,footer,button,#edge,#output')].map(e=>{const b=e.getBoundingClientRect(),s=getComputedStyle(e);return {element:e.id||e.tagName,box:b.toJSON(),whole:b.width>0&&b.height>0&&b.left>=0&&b.top>=0&&b.right<=innerWidth&&b.bottom<=innerHeight&&s.display!=='none'&&s.visibility==='visible'&&s.opacity==='1'};})`);
    assert(report.hostLayout.length===5&&report.hostLayout.every(e=>e.whole),'all fixture host controls and output must fit the complete viewport');
    if(busyArm){
      const realBurst=busyArm.startsWith('render-'),w=[...workers.values()][0],viewport={width:report.owner.width,height:report.owner.height};
      const reference=Buffer.from((await c.send('Page.captureScreenshot',variants.normal,session)).data,'base64');fs.writeFileSync(out+'/result-production-reference.png',reference,{flag:'wx'});
      await pause(110);await ev(realBurst?'globalThis.__q3CaptureBurstArmed=true;true':'globalThis.__q3CaptureWaitMs=4300;true',w.sessionId);
      const queuedAt=Date.now(),queue=await ev(`(() => {fixture.longWork=${realBurst?'fixture.renderBurst()':"fixture.batch([{name:'glFlush'}])"};fixture.longWork.catch(()=>{});return {pending:fixture.manager.pending.size,sequence:fixture.manager.sequence};})()`);
      await until(()=>bindings.some(v=>v.name==='__q3CapturePhase'&&v.payload.phase===(realBurst?'production-burst-first-native-draw':'fixture-wait-before-GL-flush')));
      assert(queue.pending>0);const count=operations.filter(v=>v.type==='request'&&v.method==='Page.captureScreenshot').length;
      report.longWork={arm:busyArm,captureVariant:busyVariant,queue,queuedAt,fixtureWaitMs:realBurst?0:4300,nativeGLInternalDuration:'UNPROVED',historicalCause:'UNPROVED',...(realBurst?{expectedFrontendDraws:209,expectedPresents:14,originalGeometryReproduced:false}:{})};
      if(busyArm.endsWith('baseline')){
        const started=performance.now();let shot;
        try{shot=await c.send('Page.captureScreenshot',variants[busyVariant],session);report.longWork.captureElapsedMs=performance.now()-started;}
        catch(e){assert.match(String(e),/UNKNOWN/);assert(c.closed);report.longWork.permanentUNKNOWN=true;report.longWork.captureElapsedMs=performance.now()-started;}
        const request=operations.filter(v=>v.type==='request'&&v.method==='Page.captureScreenshot').at(-1);
        report.longWork.captureRequestStartedAt=request.startedAt;
        if(c.closed){await until(()=>operations.some(v=>v.type==='response'&&v.id===request.id));const late=operations.find(v=>v.type==='response'&&v.id===request.id);assert(late.afterTerminal&&late.elapsedMs>3000);report.longWork.lateReply=late;const n=operations.filter(v=>v.type==='request').length;await assert.rejects(c.send('Browser.getVersion'),/UNKNOWN/);assert.equal(operations.filter(v=>v.type==='request').length,n);report.longWork.requestsAfterUNKNOWN=0;}
        else {report.longWork.pixels=equalFullPixels(reference,Buffer.from(shot.data,'base64'),viewport);fs.writeFileSync(out+'/result-production-host.png',Buffer.from(shot.data,'base64'),{flag:'wx'});}
        report.longWork.writtenScreenshotRequests=operations.filter(v=>v.type==='request'&&v.method==='Page.captureScreenshot').length-count;
      }else{
        const written=operations.filter(v=>v.type==='request').length;
        const hint=c.startupObservation.read(w.sessionId,{endpointId:1,hwnd:1,...queue});assert.equal(hint.status,'NOT_READY');
        assert.equal(operations.filter(v=>v.type==='request'&&v.method==='Page.captureScreenshot').length,count);
        assert.equal(operations.filter(v=>v.type==='request').length,written);
        report.longWork.busyRefusal={at:Date.now(),hint,writtenRequests:0,writtenScreenshotRequests:0};
      }
      await until(()=>bindings.some(v=>realBurst?v.name==='__q3LatencyEvent'&&v.payload.phase==='batch-complete'&&v.at>=queuedAt:v.name==='__q3CapturePhase'&&v.payload.phase==='fixture-wait-returned'));
      report.longWork.phases=bindings.filter(v=>v.name==='__q3CapturePhase');
      if(realBurst){const completed=bindings.filter(v=>v.name===api.BINDING&&v.payload.kind==='complete'&&v.at>=queuedAt).at(-1);assert(completed,'genuine completed production burst required');const before=report.producerHint.snapshot,after=completed.payload.snapshot,begin=report.longWork.phases.find(v=>v.payload.phase==='production-burst-first-native-draw').payload.begin,end=completed.payload.epochMs,decision=report.longWork.captureRequestStartedAt??report.longWork.busyRefusal.at;report.longWork.actualBurst={frontendDraws:after.frontendDraws-before.frontendDraws,presents:after.frontendPresents-before.frontendPresents,transfers:after.transfers-before.transfers,draws:after.draws-before.draws,completion:completed,decisionAt:decision,workOverlappedDecision:decision>begin+2&&decision<end-2,epochComparisonMarginMs:2};assert.equal(report.longWork.actualBurst.frontendDraws,209);assert.equal(report.longWork.actualBurst.presents,14);assert.equal(report.longWork.actualBurst.transfers,14);}
      if(!c.closed&&!busyArm.endsWith('baseline')){
        const settleAt=Date.now();await ev('fixture.longWork.then(()=>fixture.settled()).then(()=>true)');report.longWork.settledAt=Date.now();report.longWork.settleElapsedMs=Date.now()-settleAt;
        const owner=await ev(identityExpression),hint=c.startupObservation.read(w.sessionId,{endpointId:1,hwnd:1,pending:owner.pending,sequence:owner.sequence});report.longWork.settledOwner=owner;report.longWork.settledHint=hint;
        if(hint.status==='READY'){const start=performance.now(),shot=await c.send('Page.captureScreenshot',variants.normal,session);report.longWork.afterReady={endToEndMs:Date.now()-queuedAt,captureElapsedMs:performance.now()-start,pixels:equalFullPixels(reference,Buffer.from(shot.data,'base64'),viewport),owner,hint};}
        else {assert.equal(hint.reason,'stale or future producer time');assert.equal(operations.filter(v=>v.type==='request'&&v.method==='Page.captureScreenshot').length,count);report.longWork.stalePublicationRefusal={writtenScreenshotRequests:0,repairQualified:false};}
      }
      report.passed=true;save('capture-report.json',report);return report;
    }
    await c.send('Tracing.start',{categories:'devtools,cc,viz,gpu,benchmark',transferMode:'ReportEvents'});
    const viewport={width:report.owner.width,height:report.owner.height};
    for(const scene of ['simple','dense']){
    if(scene==='dense')await ev('fixture.denseDraw().then(()=>fixture.settled()).then(()=>true)');
    report.owner=await ev(identityExpression);let reference;
    // Alternate ordering to expose first-capture/compositor warming separately.
    for(const [i,name] of ['normal','fast','view','view','fast','normal','normal','view','fast','fast','normal','view','view','normal','fast','fast','view','normal'].entries()){
      const before=await ev(identityExpression),syncId='capture-'+scene+'-'+i,syncStart=performance.now();
      await c.send('Tracing.recordClockSyncMarker',{syncId});const syncEnd=performance.now(),started=performance.now(),at=Date.now();
      assert.deepEqual(before,report.owner,'idle actual source/frame/viewport identity must remain exact');
      const shot=await c.send('Page.captureScreenshot',variants[name],session),elapsedMs=performance.now()-started,png=Buffer.from(shot.data,'base64');
      const after=await ev(identityExpression);assert.deepEqual(after,before);
      reference??=png;let pixels;
      try{pixels=equalFullPixels(reference,png,viewport);}catch(e){if(name==='normal')throw e;pixels={equal:false,reason:String(e),alternativeIneligible:true};}
      const response=operations.filter(v=>v.type==='response'&&v.method==='Page.captureScreenshot').at(-1),delivery=transport.filter(v=>v.start<=response.monotonicMs&&v.end>=response.monotonicMs);
      assert.equal(delivery.length,1,'one exact received WebSocket message contains the screenshot response');
      report.cases.push({scene,i,name,at,started,elapsedMs,syncId,syncStart,syncEnd,bytes:png.length,sha256:hash(png),pixels,owner:after,transport:{id:response.id,receivedAt:delivery[0].start,handlerMs:delivery[0].end-delivery[0].start,messageBytes:delivery[0].bytes,responseObservedAt:response.monotonicMs}});
      if(i===0||i===1||i===2)fs.writeFileSync(out+'/result-'+scene+'-'+name+'.png',png,{flag:'wx'});
    }
    }
    await c.send('Tracing.end');await until(()=>traceDone);
    const summary=traceSummary(trace);save('capture-trace-boundaries.json',summary);
    const encoders=summary.filter(v=>/^EncodeBitmapAsPng/.test(v.name)&&v.ph==='X').sort((a,b)=>a.ts-b.ts);assert.equal(encoders.length,report.cases.length,'one actual encoder duration per screenshot required');
    for(const [i,entry] of report.cases.entries()){
      const encoder=encoders[i],sync=summary.filter(v=>v.name==='clock_sync'&&v.syncId===entry.syncId);
      assert.equal(sync.length,1,'unique necessary capture clock marker');
      const offsetLow=sync[0].ts/1000-entry.syncEnd,offsetHigh=sync[0].ts/1000-entry.syncStart;
      entry.phases={encoderName:encoder.name,encoderMs:encoder.dur/1000,
        requestToEncoderStartMs:[encoder.ts/1000-entry.started-offsetHigh,encoder.ts/1000-entry.started-offsetLow],
        encoderEndToResponseMs:[entry.started+entry.elapsedMs+offsetLow-(encoder.ts+encoder.dur)/1000,entry.started+entry.elapsedMs+offsetHigh-(encoder.ts+encoder.dur)/1000],
        encoderEndToMessageDeliveryMs:[entry.transport.receivedAt+offsetLow-(encoder.ts+encoder.dur)/1000,entry.transport.receivedAt+offsetHigh-(encoder.ts+encoder.dur)/1000],
        messageDecodeDispatchMs:entry.transport.handlerMs,
        clockUncertaintyMs:entry.syncEnd-entry.syncStart};
    }
    report.trace={events:trace.length,selected:summary.length,encoders};
    report.measurements=measurements(report.cases);
    report.producerBindings=bindings.filter(v=>v.name===api.BINDING).length;
    const w=[...workers.values()][0],screenshots=()=>operations.filter(v=>v.type==='request'&&v.method==='Page.captureScreenshot').length;
    const rejected=[];
    const refusal=(reason,queue)=>{const count=screenshots(),written=operations.filter(v=>v.type==='request').length,hint=c.startupObservation.read(w.sessionId,{endpointId:1,hwnd:1,...queue});assert.equal(hint.status,'NOT_READY',reason);assert.equal(screenshots(),count);assert.equal(operations.filter(v=>v.type==='request').length,written);rejected.push({reason,hint,writtenRequests:0});};
    // Request ordinary transport work, observing the actual pending map before
    // its asynchronous reply. A cached completed frame cannot admit capture.
    await pause(110);await ev('fixture.draw().then(()=>fixture.settled()).then(()=>true)');
    const fresh=await ev(identityExpression);assert.equal(c.startupObservation.read(w.sessionId,{endpointId:1,hwnd:1,pending:fresh.pending,sequence:fresh.sequence,publication:fresh.publication}).status,'READY');
    const queue=await ev(`(() => {fixture.queued=fixture.batch([{name:'glFlush'}]);fixture.queued.catch(()=>{});return {pending:fixture.manager.pending.size,sequence:fixture.manager.sequence};})()`);
    assert(queue.pending>0);refusal('actual newer queued production work',queue);await ev('fixture.queued.then(()=>true)');
    await pause(api.MAX_AGE_MS+30);refusal('stale original producer time');
    await ev(`function captureSourceMarker(){return 1;}\n//# sourceURL=http://fixture/capture-source-marker.js`,w.sessionId);await Promise.all(tasks);
    await ev(`function captureSourceMarker(){return 2;}\n//# sourceURL=http://fixture/capture-source-marker.js`,w.sessionId);await Promise.all(tasks);
    assert(sources.filter(v=>v.url==='http://fixture/capture-source-marker.js'&&v.actualBytesFetched).length===2);
    refusal('actual changed same-URL source');
    await ev('fixture.manager.worker.terminate();true');await pause(50);refusal('retired actual Worker');
    report.oppositions=rejected;
    report.passed=true;save('capture-report.json',report);return report;
  }finally{
    try{if(nativeTraceSeconds){let raw;await until(()=>{try{raw=fs.readFileSync(nativeTracePath);JSON.parse(raw);return true;}catch{return false;}},(nativeTraceSeconds+10)*1000);const parsed=JSON.parse(raw),selected=traceSummary(parsed.traceEvents);save('capture-trace-boundaries.json',{autostopSeconds:nativeTraceSeconds,rawSHA256:hash(raw),rawBytes:raw.length,rawRemoved:true,selected});fs.unlinkSync(nativeTracePath);}}catch(traceError){save('trace-failure.json',{error:String(traceError),repairQualified:false});throw traceError;}finally{
    save('partial-report.json',report);inventory?.close();
    if(c&&!c.closed)try{await c.send('Browser.close');}catch{}
    if(chrome.exitCode===null)chrome.kill('SIGTERM');save('chrome-wait.json',await joined);c?.ws.close();fs.rmSync(profile,{recursive:true,force:true});
    server.closeAllConnections();await new Promise(r=>server.close(r));}
  }
}
// Run the unchanged current native safety qualification as a fixture only.
// This entry point cannot launch or admit an original.
function nativeControls(out){
  const api=require('../tools/quake3-startup-observation-scheduling.cjs'),Module=require('node:module');
  const watchdog=JSON.parse(fs.readFileSync(out+'/watchdog-armed.json'));assert(watchdog.independent&&fs.existsSync('/proc/'+watchdog.pid)&&watchdog.deadline*1000>Date.now());
  assert.equal(JSON.parse(fs.readFileSync(out+'/heavy-lock.json')).pid,process.ppid);
  const pins=JSON.parse(fs.readFileSync(out+'/pins.json')),hash=require('../tools/quake3-startup-observer.cjs').hash;
  for(const p of [...pins.files,...pins.hostFiles])assert.equal(hash(fs.readFileSync(path.resolve(ROOT,p.path))),p.sha256);
  const filename=ROOT+'/test/quake3-browser-controller.test.cjs',source=api.qualificationSource(fs.readFileSync(filename,'utf8'));
  assert.equal(hash(source),pins.compositions.qualification);assert.equal(hash(api.compose(fs.readFileSync(ROOT+'/tools/quake3-browser-controller.cjs','utf8'))),pins.compositions.controller);
  fs.writeFileSync(out+'/qualification-composition.json',JSON.stringify({originals:0,sourcePath:'test/quake3-browser-controller.test.cjs',composedSHA256:hash(source),sourceCopy:false,repairQualified:false})+'\n',{flag:'wx'});
  require('../tools/quake3-visibility-controller.cjs').installServer(out);
  const m=new Module(filename,module);m.filename=filename;m.paths=module.paths;m._compile(source,filename);
}
module.exports={HTML,setupSource,variants,equalFullPixels,traceSummary,measurements,chromeControls,nativeControls};
if(require.main===module){
  if(process.argv[2]==='chrome')chromeControls(path.resolve(process.argv[3])).catch(e=>{console.error(e);process.exitCode=1;});
  else{
    const {test}=require('node:test');
    test('full viewport production fixture preserves real GL and transferred-frame path',()=>{const s=setupSource();assert(s.includes('fixture.bridge._present(frame,fixture.port.id)'));assert(s.includes('new GLRenderHost.Bridge'));assert(!s.includes('c.width=frame.width'));assert(s.includes("port.request({t:'gl-batch'"));assert(!s.includes('toDataURL'));});
    test('trace summaries omit pixels and source payloads',()=>{assert.deepEqual(traceSummary([{name:'EncodeBitmapAsPngSlow',ph:'X',ts:1,dur:2,pid:3,tid:4,args:{data:'private pixels'}},{name:'unrelated',args:{source:'private'}}]),[{name:'EncodeBitmapAsPngSlow',cat:undefined,ph:'X',ts:1,dur:2,pid:3,tid:4,id:null}]);});
    test('full-pixel equivalence rejects a changed byte and a smaller viewport',()=>{
      const png=new PNG({width:2,height:2});png.data.fill(255);const a=PNG.sync.write(png);
      equalFullPixels(a,a,{width:2,height:2});png.data[3]=0;const b=PNG.sync.write(png);
      assert.throws(()=>equalFullPixels(a,b,{width:2,height:2}),/RGBA/);
      assert.throws(()=>equalFullPixels(a,a,{width:3,height:2}));
    });
  }
}
