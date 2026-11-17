'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),cp=require('node:child_process'),crypto=require('node:crypto'),vm=require('node:vm');
const {PNG}=require('pngjs'),{gitFiles,compile,installObserver,selectWindow,installSoftwareObserver,installPresentationObserver,installPixelObserver}=require('./boids-current-runtime.cjs');
const ROOT=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const {installDriver}=require('./boids-current-driver.cjs');
const {installOwnershipObserver,classifyOwnershipPixels}=require('./boids-current-owner.cjs');
async function run(out,commit,backend,mode,fixtureFile){
  fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(path.join(out,n),JSON.stringify(v,null,2));
  save('harness-pins.json',['tools/boids-current-run.cjs','tools/boids-current-driver.cjs','tools/boids-current-runtime.cjs','tools/boids-current-supervise.py','tools/boids-current-fixture.cjs','tools/boids-current-owner.cjs','test/test-boids-current-rendering.cjs'].map(path=>({path,sha256:sha(fs.readFileSync(path))})));
  fs.writeFileSync(path.join(out,'owned-harness.patch'),cp.execFileSync('git',['diff','--binary',commit,'--','tools/boids-current-fixture.cjs','tools/boids-current-runtime.cjs','tools/boids-current-run.cjs','tools/boids-current-driver.cjs','tools/boids-current-supervise.py','test/test-boids-current-rendering.cjs']));
  fs.writeFileSync(path.join(out,'owner-helper.patch'),cp.spawnSync('git',['diff','--no-index','--binary','--','/dev/null','tools/boids-current-owner.cjs']).stdout);
  const files=gitFiles(commit);
  if(process.env.BOIDS_REPAIR_OWNED_OVERLAY){
    if(!fixtureFile)throw Error('Repair overlay is authored-only');
    const paths=['lib/host-imports.js','lib/renderer.js','src/09abg-d3dim-gps.wat','lib/gpu-stream-host.js','lib/gpu-stream-webgl.js','lib/gpu-stream-software.js','lib/gpu-stream-render-worker.js'];
    save('repair-overlay.json',paths.map(path=>{const bytes=fs.readFileSync(path);files.set(path,bytes);return {path,sha256:sha(bytes)};}));
    fs.writeFileSync(path.join(out,'repair-overlay.patch'),cp.execFileSync('git',['diff','--binary',commit,'--',...paths]));
  }
  if(process.env.BOIDS_CAPTURE_OWNED_OVERLAY){
    if(!fixtureFile)throw Error('Owned overlay is fixture-only');
    const paths=['host.js','lib/renderer.js'];
    save('owned-overlay.json',paths.map(path=>{const bytes=fs.readFileSync(path);files.set(path,bytes);return {path,sha256:sha(bytes)};}));
    fs.writeFileSync(path.join(out,'owned-overlay.patch'),cp.execFileSync('git',['diff','--binary',commit,'--',...paths]));
  }
  const sourcePins=[...files].map(([path,b])=>({path,size:b.length,sha256:sha(b)}));
  const sizes={module:{exports:{}}};vm.runInNewContext(files.get('lib/app-file-sizes.generated.js').toString(),sizes);
  const sandbox={module:{exports:{}},console,URL,require:n=>{if(n!=='./app-file-sizes.generated.js')throw Error('unexpected registry dependency');return sizes.module.exports;}};vm.runInNewContext(files.get('lib/apps.js').toString(),sandbox);const app=sandbox.module.exports.APPS.dx_boids;
  const media=[app.exe,...app.files.map(f=>f.url)].map(n=>{const b=fs.readFileSync(path.join(ROOT,n));files.set(n,b);return {path:n,size:b.length,sha256:sha(b)};});
  save('pins-before.json',{commit,sourcePins,media,app,foreignWIPAdopted:false});
  const module=compile(files);files.set('build/wine-assembly.wasm',module);fs.writeFileSync(path.join(out,'native.wasm'),module);save('module.json',{sha256:sha(module),size:module.length,commit,persisted:true,path:'native.wasm'});
  if(fixtureFile){const b=fs.readFileSync(fixtureFile);files.set(app.exe,b);save('fixture.json',{path:fixtureFile,sha256:sha(b),bytes:b.length,original:false});}
  if(process.env.BOIDS_CONTEXT_LOSS){
    if(!fixtureFile)throw Error('Context loss is authored-only');
    const n='lib/gpu-stream-webgl.js',old=files.get(n),suffix='\n;(()=>{const p=GpuStreamWebGL.Executor.prototype,execute=p.execute;p.execute=function(rec){globalThis.__boidsContextExecutor=this;return execute.call(this,rec);};})();\n';
    files.set(n,Buffer.concat([old,Buffer.from(suffix)]));save('context-fault-observer.json',{path:n,baseSHA256:sha(old),servedSHA256:sha(files.get(n)),suffix});
  }
  const observerPatches=[];for(const [n,api]of [['lib/gpu-stream-webgl.js','GpuStreamWebGL'],['lib/gpu-stream-software.js','GpuStreamSoftware']]){const suffix='\n;('+installObserver.toString()+')(globalThis,'+JSON.stringify(api)+');\n';const old=files.get(n);files.set(n,Buffer.concat([old,Buffer.from(suffix)]));observerPatches.push({path:n,baseSHA256:sha(old),servedSHA256:sha(files.get(n)),suffix});}const n='lib/d3dim-render-worker.js',old=files.get(n),suffix='\n;('+installSoftwareObserver.toString()+')(globalThis);\n';files.set(n,Buffer.concat([old,Buffer.from(suffix)]));observerPatches.push({path:n,baseSHA256:sha(old),servedSHA256:sha(files.get(n)),suffix});save('observer-patches.json',observerPatches);
  if(process.env.BOIDS_CONTENT_DIAGNOSTIC){
    const n='lib/gpu-stream-host.js',old=files.get(n),suffix='\n;('+installPresentationObserver.toString()+')(globalThis);\n';
    files.set(n,Buffer.concat([old,Buffer.from(suffix)]));observerPatches.push({path:n,baseSHA256:sha(old),servedSHA256:sha(files.get(n)),suffix});save('observer-patches.json',observerPatches);
  }
  if(process.env.BOIDS_PIXEL_STAGES){
    for(const n of ['lib/gpu-stream-webgl.js','lib/gpu-stream-render-worker.js','lib/gpu-stream-host.js','lib/renderer.js']){const old=files.get(n),suffix='\n;('+installPixelObserver.toString()+')(globalThis);\n';files.set(n,Buffer.concat([old,Buffer.from(suffix)]));observerPatches.push({path:n,baseSHA256:sha(old),servedSHA256:sha(files.get(n)),suffix});}
    save('observer-patches.json',observerPatches);
  }
  if(process.env.BOIDS_OWNERSHIP_SEQUENCE){
    if(!fixtureFile)throw Error('ownership sequence instrumentation is authored-only');
    for(const n of ['lib/gpu-stream-host.js','lib/renderer.js']){const old=files.get(n),suffix='\n;('+installOwnershipObserver.toString()+')(globalThis,('+classifyOwnershipPixels.toString()+'),'+(process.env.BOIDS_DEVICE2==='partial-paint-sequence')+');\n';files.set(n,Buffer.concat([old,Buffer.from(suffix)]));observerPatches.push({path:n,baseSHA256:sha(old),servedSHA256:sha(files.get(n)),suffix});}
    save('observer-patches.json',observerPatches);
  }
  save('prepared.json',{at:Date.now(),commit,moduleSHA256:sha(module),fixture:!!fixtureFile});
  while(!fs.existsSync(path.join(out,'runtime-start.json')))await sleep(20);
  const {deadline}=JSON.parse(fs.readFileSync(path.join(out,'runtime-start.json')));
  if(!(deadline>Date.now()&&deadline<=Date.now()+300000))throw Error('invalid fixed runtime deadline');

  let browser,server;const requests=[],consoleLog=[],modules=[],workerSessions=[],workerTasks=[],captures=[],errors=[],targetClosures=[];
  let terminal={outcome:'unknown',backend,mode,commit,originalInputs:0,clock:'real unmodified',nativeDeadlineSeconds:300,independentWatchdogSeconds:320};
  try{
    server=http.createServer((req,res)=>{const n=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'index.html';let b=files.get(n);if(!b&&/^(fonts|icons|images)\/[\w./-]+$/.test(n)&&!n.includes('..')){try{b=fs.readFileSync(path.join(ROOT,n));files.set(n,b);}catch{}}
      requests.push({at:Date.now(),path:n,status:b?200:404,sha256:b?sha(b):null});res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':n.endsWith('.wasm')?'application/wasm':n.endsWith('.html')?'text/html':n.endsWith('.json')?'application/json':'application/octet-stream');res.statusCode=b?200:404;res.end(b||'not found');});
    await new Promise(r=>server.listen(0,'127.0.0.1',r));save('server.json',{port:server.address().port});
    browser=await require('puppeteer').launch({executablePath:'/opt/google/chrome/chrome',headless:true,defaultViewport:{width:1280,height:960},protocolTimeout:Math.max(1,deadline-Date.now()),timeout:Math.max(1,deadline-Date.now()),args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--window-size=1280,960']});
    const proc=browser.process();let chromeClose;const closed=new Promise(r=>proc.once('close',(code,signal)=>{chromeClose={pid:proc.pid,code,signal,actualWait:true};r();}));save('browser.json',{pid:proc.pid,spawnargs:proc.spawnargs,version:await browser.version()});
    async function observeTarget(target){if(!['page','other'].includes(target.type()))return;const s=await target.createCDPSession();workerSessions.push({session:s,target});s.on('Debugger.scriptParsed',ev=>{if(ev.scriptLanguage!=='WebAssembly'&&!ev.url.startsWith('wasm:'))return;const task=s.send('Debugger.getScriptSource',{scriptId:ev.scriptId}).then(r=>{modules.push({target:target.url(),scriptId:ev.scriptId,bytecodeAvailable:!!r.bytecode,sha256:r.bytecode?sha(Buffer.from(r.bytecode,'base64')):null});});workerTasks.push(task);task.catch(e=>errors.push(String(e)));});await s.send('Debugger.enable');}
    browser.on('targetcreated',t=>{const p=observeTarget(t);workerTasks.push(p);p.catch(e=>errors.push(String(e)));});
    browser.on('targetdestroyed',t=>targetClosures.push({url:t.url(),type:t.type(),at:Date.now()}));
    const page=(await browser.pages())[0];
    if(process.env.BOIDS_CONTENT_DIAGNOSTIC)await page.evaluateOnNewDocument(()=>{
      const names=new Set(['DefWindowProcA','DispatchMessageA','ShowWindow','SetFocus','SetActiveWindow','SetForegroundWindow','IDirectDraw_SetCooperativeLevel','IDirectDrawSurface_IsLost','IDirectDrawSurface_Restore','IDirect3DDevice2_BeginScene','IDirect3DDevice2_EndScene','IDirectDrawSurface_Flip']);
      const counts={};const has=names.has.bind(names);names.has=name=>{if(!has(name))return false;counts[name]=(counts[name]||0)+1;return counts[name]<=40;};
      globalThis.__waTraceApiNames=names;globalThis.__boidsApiCounts=counts;
    });await page.evaluateOnNewDocument('('+installDriver.toString()+')(globalThis,'+JSON.stringify({app:'dx_boids',mode,deadline,trace:!!process.env.BOIDS_CAPTURE_TRACE})+');');await page.evaluateOnNewDocument(()=>{globalThis.__boidsInputs=[];for(const type of ['keydown','keyup','pointerdown','pointerup','mousedown','mouseup'])document.addEventListener(type,e=>globalThis.__boidsInputs.push({type,trusted:e.isTrusted,at:Date.now()}),true);});page.on('console',m=>consoleLog.push({at:Date.now(),type:m.type(),text:m.text()}));page.on('pageerror',e=>errors.push(String(e)));await observeTarget(page.target());
    const url='http://127.0.0.1:'+server.address().port+'/index.html?app=dx_boids&'+(mode==='worker'?'threads':'no-threads')+'&d3d-renderer='+backend;
    terminal.url=url;terminal.launchedAt=new Date().toISOString();await page.goto(url,{waitUntil:'domcontentloaded',timeout:Math.max(1,deadline-Date.now())});
    save('readiness.json',await page.evaluate(()=>__boidsDriver.ready()));
    if(fixtureFile)await page.evaluate((end,held)=>{globalThis.__boidsFixtureDeadline=end;globalThis.__boidsSelectHeld=held;},deadline,!!process.env.BOIDS_CAPTURE_HELD);
    const identity=()=>page.evaluate(()=>({...__boidsDriver.identity(),inputEvents:globalThis.__boidsInputs||[]}));
    save('identity-start.json',await identity());
    // One selected queued boundary suffices for the authored delay regression.
    // Originals retain all three independent passive observations.
    for(const delay of fixtureFile&&(process.env.BOIDS_CAPTURE_ACTIVE||process.env.BOIDS_FLIP_DIAGNOSTIC||process.env.BOIDS_DEVICE2)?[15000]:[15000,15000,15000]){
      await sleep(delay);const i=captures.length;
      const captureStarted=Date.now();save('controller-capture-start.json',{at:captureStarted,index:i,boundMs:3000});let captureTimer;
      const snapshot=await Promise.race([page.evaluate(async active=>{
        if(active){
          // Fixture only: select a naturally queued update and request within
          // the same turn. No writer/flag/clock or publication is changed.
          while(Date.now()<__boidsFixtureDeadline){
            const w=runningApps.find(a=>a.name==='dx_boids').wine,r=w.renderer;
            const hostPending=!!(w._dxDirty||w._dxLockDeferred||w._presentFrameDue);
            if((globalThis.__boidsSelectHeld ? !hostPending&&r._workerPublicationHeld() : hostPending)){
              globalThis.__boidsPendingAttempt={at:Date.now(),dirty:!!w._dxDirty,lockDeferred:!!w._dxLockDeferred,presentDue:!!w._presentFrameDue,held:r._workerPublicationHeld(),publication:r._immutablePublicationSequence,displayedAt:r._currentDisplayRecord?.displayedAt,gdiPaint:r._workerGdiPaintDepth,repainting:!!r._repainting};
              console.debug('BOIDS actual pending capture '+JSON.stringify(__boidsPendingAttempt));
              return __boidsDriver.capture();
            }
            await new Promise(resolve=>setTimeout(resolve,0));
          }throw Error('no actual pending host publication');
        }
        return __boidsDriver.capture();
      },!!fixtureFile&&!!process.env.BOIDS_CAPTURE_ACTIVE),new Promise((_,reject)=>{captureTimer=setTimeout(()=>reject(Error('DISPLAY_UNKNOWN controller capture deadline')),Math.max(1,Math.min(3000,deadline-Date.now())));})]).finally(()=>clearTimeout(captureTimer));
      if(Date.now()>=Math.min(deadline,captureStarted+3000))throw Error('late controller capture delivery');
      save('controller-capture-complete.json',{at:Date.now(),startedAt:captureStarted,index:i,elapsedMs:Date.now()-captureStarted,pageElapsedMs:snapshot.elapsedMs});
      if(process.env.BOIDS_CAPTURE_TRACE)save('capture-trace-cost.json',await page.evaluate(()=>globalThis.__boidsCaptureTraceCost));
      if(fixtureFile&&!process.env.BOIDS_DEVICE2){
        save(`literal-reference-${i}.json`,process.env.BOIDS_FLIP_DIAGNOSTIC?require('./boids-current-fixture.cjs').qualifyFlip(snapshot,process.env.BOIDS_FLIP_DIAGNOSTIC==='black'):require('./boids-current-fixture.cjs').qualify(snapshot,mode));
        if(process.env.BOIDS_CAPTURE_ACTIVE){
          save(`pending-host-${i}.json`,await page.evaluate(()=>__boidsPendingAttempt));
          const pending=snapshot.metadata.pendingHostPublicationAtRequest;
          const selectedHeld=!!process.env.BOIDS_CAPTURE_HELD;
          if(!pending||(selectedHeld ? Object.values(pending).some(Boolean)||!snapshot.metadata.rendererWorkAtRequest?.writerHeld : !Object.values(pending).some(Boolean))||snapshot.metadata.content!=='ordinary-publication-after-request')throw Error('active fixture did not complete its selected natural publication');
        }
      }
      for(const kind of ['source','output']){const dims=snapshot.metadata[kind],png=new PNG({width:dims.width,height:dims.height});png.data=Buffer.from(snapshot[kind],'base64');fs.writeFileSync(path.join(out,`frame-${i}-${kind}.png`),PNG.sync.write(png));}
      const row={index:i,metadata:snapshot.metadata,identity:await identity(),at:new Date().toISOString()};save(`frame-${i}.json`,row);captures.push(row);
      const traces=[{target:'page',trace:await page.evaluate(()=>({records:globalThis.__boidsPublicTrace||null,pixelStages:globalThis.__boidsPixelStages||null,bridge:(()=>{const b=runningApps.find(a=>a.name==='dx_boids').wine.hostCtx.d3dimBridge;return {workerEpoch:b?.workerEpoch,endpointId:b?.endpoint?.id};})()}))}];for(const {session,target}of workerSessions.filter(x=>x.target.type()==='page'||x.target.url().includes('/d3d-render-worker.js')))try{const r=await session.send('Runtime.evaluate',{expression:'JSON.stringify({executors:globalThis.__boidsPublicTraces||null,presentation:globalThis.__boidsPresentationTrace||null,pixelStages:globalThis.__boidsPixelStages||null})',returnByValue:true});traces.push({target:target.url(),trace:JSON.parse(r.result.value)});}catch(e){traces.push({target:target.url(),error:String(e)});}save(`public-trace-${i}.json`,traces);
      if(process.env.BOIDS_CONTENT_DIAGNOSTIC||process.env.BOIDS_PIXEL_STAGES)save(`content-boundary-${i}.json`,await page.evaluate(()=>{
        const w=runningApps.find(a=>a.name==='dx_boids').wine,b=w.hostCtx.d3dimBridge,r=w.renderer;
        const layer=b?.presenter?.layer;
        const win=b?.presenter?.win;const summarize=c=>c&&globalThis.__boidsSummarizeCanvas?.(c);
        return {pixelStages:globalThis.__boidsPixelStages,layerPixels:summarize(layer?.canvas),backPixels:summarize(win?._backCanvas),sourcePixels:summarize(r._exclusivePresentationSource),windowDetails:win?{clientRect:win.clientRect,gdiWriteSeq:win._gdiWriteSeq,style:win.style,off:r._frameLayerOffset(win,layer)}:null,at:Date.now(),presentation:globalThis.__boidsPresentationTrace,apiCounts:globalThis.__boidsApiCounts,
          presentCount:b?.presenter?.presents,staleCount:b?.presenter?.stale,
          layer:layer?{kind:layer.kind,api:layer.api,width:layer.canvas?.width,height:layer.canvas?.height,writeSeq:layer.writeSeq,merged:layer.mergedIntoWindow,stale:layer.stale?.(),window:b.presenter.win?.hwnd}:null,
          publicState:{focus:w.instance.exports.get_focus_hwnd?.(),exclusive:w.instance.exports.get_dx_exclusive_hwnd?.(),presentHwnd:w.instance.exports.get_dx_present_hwnd?.(),cpuPresentSeq:w.instance.exports.get_d3dim_cpu_present_seq?.()},
          compositorLayer:Object.values(r.windows).filter(v=>v.visible&&!v.isChild).map(v=>({hwnd:v.hwnd,layerAPI:v._dxFrameLayer?.api,writeSeq:v._dxFrameLayer?.writeSeq,stale:v._dxFrameLayer?.stale?.(),overlay:!!r._overlayFrameLayer(v)}))};
      }));
    }
    if(process.env.BOIDS_OWNERSHIP_SEQUENCE)save('ownership-sequence.json',await page.evaluate(()=>globalThis.__boidsOwnership));
    terminal.outcome='observed';save('identity-end.json',await identity());
    if(process.env.BOIDS_LATE_CALLBACK){
      if(!fixtureFile)throw Error('Late callback retirement is authored-only');
      save('native-late-callback.json',await page.evaluate(async()=>{
        const b=runningApps.find(a=>a.name==='dx_boids').wine.hostCtx.d3dimBridge;
        const original=b._workerFrame;let held;
        b._workerFrame=function(frame,epoch){if(!held){held={frame,epoch};return;}return original.call(this,frame,epoch);};
        try {
          const end=Date.now()+2000;while(!held&&Date.now()<end)await new Promise(r=>setTimeout(r,10));
          if(!held?.frame.bitmap)throw Error('No actual native GPU bitmap callback');
          const before={epoch:held.epoch,width:held.frame.bitmap.width,height:held.frame.bitmap.height};
          await b.close();const count=b.presenter.presents,epoch=b.workerEpoch;
          original.call(b,held.frame,held.epoch);
          const closed=held.frame.bitmap.width===0&&held.frame.bitmap.height===0;
          if(!closed||b.presenter.presents!==count||epoch===before.epoch)throw Error('Late native bitmap admitted after retirement');
          return {before,epoch,afterPresents:b.presenter.presents,count,closed,actualBridgeCloseAwaited:true};
        } finally { b._workerFrame=original; }
      }));
    }
    if(fixtureFile&&!process.env.BOIDS_CONTEXT_LOSS&&!process.env.BOIDS_LATE_CALLBACK){
      // Fault only the authored fixture's ownership records. Never runs on originals.
      const controls=await page.evaluate(async(source,deadline,mode)=>{
        const install=(app='dx_boids',end=deadline)=>(0,eval)('('+source+')')(globalThis,{app,mode,deadline:end});
        const a=runningApps.find(a=>a.name==='dx_boids'),w=a.wine,r=w.renderer,win=Object.values(r.windows).find(v=>v.wasm===w.instance&&v.visible&&!v.isChild);
        const rows=[];
        for(const fault of ['absent-app','wrong-process','replaced-window','replaced-instance',...(w.hostCtx?.d3dimBridge?['replaced-source','lost-stream']:[]),'replaced-renderer','failed-renderer','closed-endpoint','retired-renderer','bad-readiness']){
          install(fault==='absent-app'?'missing-authored-app':'dx_boids',Math.min(deadline,Date.now()+(['absent-app','bad-readiness'].includes(fault)?200:5000)));
          let refused=false,stage='ready';
          const pid=win.processId,guest=w.guestWorker,manager=w._renderWorkerManager,port=[...(w._renderWorkerManager?.ports?.values()||[])][0],bridge=w.hostCtx?.d3dimBridge;
          const prior={failure:manager?._failure,closed:port?.closed,retired:w._renderWorkerRetired,streamError:bridge?.workerAsyncError,instance:w.instance,device:bridge?.device};
          try{
            if(fault==='bad-readiness')w.guestWorker=mode==='worker'?null:{};
            if(fault==='absent-app'||fault==='bad-readiness')await __boidsDriver.ready();
            else{
              await __boidsDriver.ready();stage='capture';
              if(fault==='wrong-process')win.processId++;
              if(fault==='replaced-window')r.windows[win.hwnd]={...win};
              if(fault==='replaced-instance')w.instance={};
              if(fault==='replaced-source'){if(!bridge)throw Error('missing fixture bridge');bridge.device={};}
              if(fault==='replaced-renderer')w.renderer={...r};
              if(fault==='failed-renderer'){if(!manager)throw Error('missing fixture manager');manager._failure=Error('authored native renderer failure');}
              if(fault==='closed-endpoint'){if(!port)throw Error('missing fixture endpoint');port.closed=true;}
              if(fault==='retired-renderer')w._renderWorkerRetired=true;
              if(fault==='lost-stream'){if(!bridge)throw Error('missing fixture bridge');bridge.workerAsyncError=Error('authored native stream loss');}
              await __boidsDriver.capture();
            }
          }catch(e){
            if(!['absent-app','bad-readiness'].includes(fault)&&stage!=='capture')throw Error('fixture fault was not reached '+fault+': '+e);
            if(String(e).includes('missing fixture'))throw e;
            refused=true;rows.push({fault,stage,refused,error:String(e)});
          }
          finally{win.processId=pid;r.windows[win.hwnd]=win;w.renderer=r;w.instance=prior.instance;w.guestWorker=guest;if(manager)manager._failure=prior.failure;if(port)port.closed=prior.closed;w._renderWorkerRetired=prior.retired;if(bridge){bridge.workerAsyncError=prior.streamError;bridge.device=prior.device;}}
          if(!refused)throw Error('native fault admitted '+fault);
        }
        return rows;
      },installDriver.toString(),deadline,mode);
      save('native-owner-controls.json',controls);
    }
    if(process.env.BOIDS_CONTEXT_LOSS){
      await page.evaluate(()=>{globalThis.__boidsContextBridge=runningApps.find(a=>a.name==='dx_boids').wine.hostCtx.d3dimBridge;});
      let injected=false;
      for(const {session,target}of workerSessions.filter(x=>x.target.url().includes('/d3d-render-worker.js'))){
        let v;try{v=await session.send('Runtime.evaluate',{expression:`(()=>{const e=globalThis.__boidsContextExecutor;if(!e)return null;const x=e.gl.getExtension('WEBGL_lose_context');if(!x)throw Error('WEBGL_lose_context unavailable');x.loseContext();return {target:location.href,at:Date.now(),backend:e.stats().backend};})()`,returnByValue:true});}catch(error){save('context-loss-skipped-'+workerSessions.indexOf(workerSessions.find(x=>x.session===session))+'.json',{target:target.url(),error:String(error)});continue;}
        if(v.exceptionDetails)throw Error(JSON.stringify(v.exceptionDetails));
        if(v.result.value){save('context-loss-injected.json',v.result.value);injected=true;break;}
      }
      if(!injected)throw Error('No actual WebGL executor for context fault');
      const end=Math.min(deadline,Date.now()+5000);let loss;
      while(Date.now()<end){loss=await page.evaluate(()=>{const b=globalThis.__boidsContextBridge;return {error:String(b.workerAsyncError||''),count:b.presenter.presents,epoch:b.workerEpoch,at:Date.now()};});if(loss.error)break;await sleep(20);}
      if(!loss?.error.includes('context lost'))throw Error('Natural native records did not refuse actual context loss '+JSON.stringify(loss));
      await sleep(250);const after=await page.evaluate(()=>globalThis.__boidsContextBridge.presenter.presents);
      save('context-loss-refusal.json',{...loss,after,noLaterPresentation:after===loss.count});if(after!==loss.count)throw Error('Frame published after context loss');
    }
    if(fixtureFile){await page.close();terminal.fixturePageClose={actualAwait:true,closed:page.isClosed(),at:Date.now()};}
    await browser.close();await closed;terminal.chromeClose=chromeClose;browser=null;
  }catch(e){terminal.error=String(e);terminal.outcome='blocked';}
  finally{
    if(browser){const p=browser.process();const closed=new Promise(r=>{if(p.exitCode!==null)return r();p.once('close',(code,signal)=>{terminal.chromeClose={pid:p.pid,code,signal,actualWait:true};r();});});await browser.close().catch(e=>errors.push(String(e)));await closed;}
    if(server)await new Promise(r=>server.close(r));await Promise.allSettled(workerTasks);
    save('modules.json',modules);save('requests.json',requests);save('console.json',consoleLog);save('errors.json',errors);
    save('capture-boundary-trace.json',consoleLog.filter(r=>r.text.startsWith('BOIDS_CAPTURE_TRACE ')).map(r=>({deliveredAt:r.at,...JSON.parse(r.text.slice('BOIDS_CAPTURE_TRACE '.length))})));
    save('pins-after.json',{media:media.map(p=>({...p,sha256After:sha(fs.readFileSync(path.join(ROOT,p.path)))})),served:[...files].map(([path,b])=>({path,size:b.length,sha256:sha(b)}))});
    terminal.targetClosures=targetClosures;terminal.captures=captures.map(r=>({index:r.index,publication:r.metadata.publication}));terminal.endedAt=new Date().toISOString();save('terminal.json',terminal);
  }
  if(terminal.outcome!=='observed')throw Error(terminal.error||'Boids observation failed');
}
if(require.main===module)run(...process.argv.slice(2)).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={run};
