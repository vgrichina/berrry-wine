'use strict';
// Personally reviewed finite native input, or read-only observation. All
// keyboard edges enter through the browser, never through a guest callback.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {PNG}=require('pngjs'),{gitFiles,compile}=require('./boids-current-runtime.cjs');
const {installInitializedObserver,fixture}=require('./gltron-current-native-capture.cjs');
const {connection,GL_OBSERVER}=require('./gltron-browser-controller.cjs');
const {completeCapture}=require('./gltron-current-capture.cjs');
const {installNativeRouteObserver,inspectNativeRoute,requireNativeRoute}=require('./gltron-current-native-input.cjs');
const ROOT=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function run(out,commit,authored=false,backend='webgl',qualifyNative=false){
 assert(['software','webgl'].includes(backend));
 const save=(n,v)=>fs.writeFileSync(path.join(out,n),JSON.stringify(v,null,2)+'\n',{flag:'wx'}),append=(n,v)=>fs.appendFileSync(path.join(out,n),JSON.stringify(v)+'\n');
 assert(fs.existsSync(out),'independent supervisor creates the unique run');
 const files=gitFiles(commit),sizes={module:{exports:{}}};vm.runInNewContext(files.get('lib/app-file-sizes.generated.js').toString(),sizes);
 const candidate=process.env.GLTRON_BRIDGE_CANDIDATE==='1';
 assert(!candidate||authored,'candidate runtime only for authored qualification');
 if(candidate)for(const n of ['host.js','index.html','lib/browser-native-input.js','lib/guest-rpc.js'])files.set(n,fs.readFileSync(path.join(ROOT,n)));
 const registry={module:{exports:{}},console,URL,require:()=>sizes.module.exports};vm.runInNewContext(files.get('lib/apps.js').toString(),registry);
 const app=registry.module.exports.APPS.gltron;assert(app?.exe);
 const media=[],seen=new Set(),add=n=>{if(seen.has(n))return;seen.add(n);const b=fs.readFileSync(path.join(ROOT,n));files.set(n,b);media.push({path:n,bytes:b.length,sha256:sha(b)});};
 const walk=d=>{for(const e of fs.readdirSync(path.join(ROOT,d),{withFileTypes:true})){const n=d+'/'+e.name;if(e.isDirectory())walk(n);else if(e.isFile()||(e.isSymbolicLink()&&fs.statSync(path.join(ROOT,n)).isFile()))add(n);}};
 if(!authored){add(app.exe);for(const f of app.files||[])add(f.url);walk(path.posix.dirname(app.exe));}
 for(const d of ['binaries/dlls','test/binaries/tlbs','fonts','icons','images'])if(fs.existsSync(path.join(ROOT,d)))walk(d);
 const helpers=['tools/gltron-current-original.cjs','tools/gltron-current-capture.cjs','tools/gltron-current-native-input.cjs','tools/gltron-current-supervise.py','tools/boids-current-runtime.cjs','tools/boids-current-supervise.py','tools/gltron-current-native-capture.cjs','tools/gltron-browser-controller.cjs','tools/gltron-browser-binding.cjs'];
 const helperPins=helpers.map(n=>{const b=fs.readFileSync(path.join(ROOT,n)),r=cp.spawnSync('git',['show',commit+':'+n],{cwd:ROOT});return {path:n,sha256:sha(b),published:r.status===0&&r.stdout.equals(b)};});
 save('source.json',{commit,candidate,authored,backend,qualifyNative,registry:app,media,source:[...files].filter(([n])=>!seen.has(n)).map(([path,b])=>({path,bytes:b.length,sha256:sha(b)})),helpers:helperPins,foreignWIPAdopted:false});
 if(!authored)assert(helperPins.every(p=>p.published),'original requires exact published helper bytes');
 let wasm;
 if(candidate&&process.env.GLTRON_REUSE_MODULE){
   const previous=path.resolve(process.env.GLTRON_REUSE_MODULE),source=JSON.parse(fs.readFileSync(previous+'/source.json'));
   assert.equal(source.commit,commit,'module reuse exact Git compile graph');
   const pins=new Map(source.source.map(v=>[v.path,v]));
   for(const [n,b]of files)if(!seen.has(n)&&!['host.js','index.html','lib/browser-native-input.js','lib/guest-rpc.js'].includes(n))
     assert.equal(pins.get(n)?.sha256,sha(b),'module reuse compile graph '+n);
   const module=JSON.parse(fs.readFileSync(previous+'/module.json'));wasm=fs.readFileSync(previous+'/tested-'+module.sha256+'.wasm');assert.equal(sha(wasm),module.sha256);
   save('module-reuse.json',{sourceRun:previous,sha256:module.sha256,compileGraphUnchanged:true});
 }else wasm=compile(files);
 files.set('build/wine-assembly.wasm',wasm);
 fs.writeFileSync(path.join(out,'tested-'+sha(wasm)+'.wasm'),wasm,{flag:'wx'});
 if(authored)files.set('authored-native.exe',fixture({drawOnce:true,timerMs:16}));
 save('module.json',{commit,sha256:sha(wasm),bytes:wasm.length,retainedBeforeExecution:true});save('prepared.json',{at:Date.now(),commit,authored});
 while(!fs.existsSync(out+'/runtime-start.json'))await sleep(10);
 const {deadline}=JSON.parse(fs.readFileSync(out+'/runtime-start.json'));assert(deadline>Date.now()&&deadline<=Date.now()+300000);
 let server,browser,c,session,browserWait,terminal=false,lastImage,nativeQuit=false;const workers=new Map(),tasks=[],destroyed=[];
 const evaluate=async(expression,s=session)=>{const r=await c.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},s);if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const bounded=async work=>{let timer;try{return await Promise.race([work(),new Promise((_,reject)=>{timer=setTimeout(()=>{terminal=true;c?.ws.close();reject(Error('DISPLAY_UNKNOWN complete 3000ms deadline; permanently closed'));},3000);})]);}finally{clearTimeout(timer);}};
 async function capture(label){
  assert(!terminal);const at=Date.now();let hostCapturedAt;
  try{const shot=await completeCapture({
   close:()=>{terminal=true;c?.ws.close();},record:v=>append(label+'-phases.jsonl',v),
   requestTicket:async()=>{
   await evaluate(`(()=>{if(globalThis.__originalTicket)throw Error('existing ticket');const w=runningApps[0].wine,r=w.renderer;const wins=Object.values(r.windows).filter(v=>v.visible&&!v.isChild&&v.processId===w.processId&&v.wasm===w.instance);if(wins.length!==1)throw Error('ambiguous owner');const win=wins[0];globalThis.__originalPin={w,r,win,instance:w.instance};globalThis.__originalTicket=w.requestCurrentDisplayCapture({hwnd:win.hwnd});return true;})()`);
   },
   readTicket:async()=>{const shot=await evaluate(`(()=>{const p=__originalPin,t=__originalTicket;if(p.w._stopped||!p.w.running||p.w.instance!==p.instance||p.r.windows[p.win.hwnd]!==p.win)throw Error('owner retired');if(t.status!=='complete')return {status:t.status,error:t.error,participant:__nativeInitialized.ticketEvents};const r=t.read(),receipt=__nativeInitialized.receipts.find(v=>v.publication===r.metadata.publication);if(!receipt)throw Error('capture lacks initialized GL producer join');const encode=b=>{let s='';for(let i=0;i<b.length;i+=8192)s+=String.fromCharCode(...b.subarray(i,i+8192));return btoa(s);};return {status:'complete',metadata:r.metadata,receipt,source:encode(r.sourceRGBA),output:encode(r.outputRGBA)};})()`);
    if(shot.participant)append(label+'-participants.jsonl',{at:Date.now(),status:shot.status,events:shot.participant});return shot;},
   captureHost:async()=>{const host=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},session);hostCapturedAt=Date.now();return host;},
   retain:async(shot,host)=>{
   for(const k of ['source','output']){const dim=shot.metadata[k],b=Buffer.from(shot[k],'base64');assert.equal(b.length,dim.width*dim.height*4);const p=new PNG(dim);p.data=b;fs.writeFileSync(out+'/'+label+'-'+k+'.png',PNG.sync.write(p),{flag:'wx'});}
   fs.writeFileSync(out+'/'+label+'-host.png',Buffer.from(host.data,'base64'),{flag:'wx'});
   save(label+'.json',{at,completedAt:Date.now(),hostCapturedAt,elapsedMs:Date.now()-at,metadata:shot.metadata,receipt:shot.receipt,authored,inputEvents:0});
   }});
   await evaluate('delete globalThis.__originalTicket;delete globalThis.__originalPin;true');
   lastImage={label,completedAt:hostCapturedAt,sha256:sha(fs.readFileSync(out+'/'+label+'-host.png'))};return shot;
  }catch(e){terminal=true;c?.ws.close();throw e;}
 }
 try{
  server=http.createServer((req,res)=>{const n=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'index.html',b=files.get(n);append('requests.jsonl',{at:Date.now(),path:n,status:b?200:404,sha256:b?sha(b):null});res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':n.endsWith('.wasm')?'application/wasm':n.endsWith('.html')?'text/html':n.endsWith('.json')?'application/json':'application/octet-stream');res.statusCode=b?200:404;res.end(b||'not found');});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));save('server.json',{port:server.address().port});
  const launched=await require('puppeteer').launch({executablePath:'/opt/google/chrome/chrome',headless:true,userDataDir:out+'/profile',defaultViewport:{width:1400,height:1031},timeout:30000,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--window-size=1400,1031']});
  browser=launched.process();const endpoint=launched.wsEndpoint();await launched.disconnect();
  browser.stdout.on('data',b=>fs.appendFileSync(out+'/browser.stdout.log',b));browser.stderr.on('data',b=>fs.appendFileSync(out+'/browser.stderr.log',b));
  browserWait=new Promise(resolve=>browser.once('close',(code,signal)=>{save('browser-wait.json',{pid:browser.pid,code,signal,actualWait:true,stdoutEOF:browser.stdout.readableEnded,stderrEOF:browser.stderr.readableEnded});resolve();}));
  save('browser.json',{pid:browser.pid,args:browser.spawnargs});c=connection(endpoint);await c.ready;
  const send=c.send;c.send=async(method,params,sessionId)=>{
   const at=Date.now();append('wire.jsonl',{event:'request',at,method,sessionId});
   try{const result=await send(method,params,sessionId);append('wire.jsonl',{event:'return',at:Date.now(),requestedAt:at,method,sessionId});return result;}
   catch(error){append('wire.jsonl',{event:'error',at:Date.now(),requestedAt:at,method,sessionId,error:String(error)});throw error;}
  };
  c.event=v=>{
   if(v.method==='Target.attachedToTarget'&&v.params.targetInfo.type==='worker'){
    const {sessionId,targetInfo}=v.params,w={sessionId,targetId:targetInfo.targetId,url:targetInfo.url,scripts:[]};workers.set(sessionId,w);
    const t=(async()=>{await c.send('Runtime.enable',{},sessionId);await c.send('Runtime.evaluate',{expression:GL_OBSERVER},sessionId);await c.send('Debugger.enable',{},sessionId);await c.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true},sessionId);await c.send('Runtime.runIfWaitingForDebugger',{},sessionId);})();tasks.push(t);t.catch(()=>{});
   }else if(v.method==='Debugger.scriptParsed'&&v.params.scriptLanguage==='WebAssembly'&&workers.has(v.sessionId)){
    const w=workers.get(v.sessionId),t=c.send('Debugger.getScriptSource',{scriptId:v.params.scriptId},v.sessionId).then(r=>{assert(r.bytecode,'actual Worker bytes');const hash=sha(Buffer.from(r.bytecode,'base64'));assert.equal(hash,sha(wasm));w.scripts.push({sha256:hash,bytes:Buffer.from(r.bytecode,'base64').length});append('worker-modules.jsonl',w);});tasks.push(t);t.catch(()=>{});
   }else if(v.method==='Target.targetDestroyed'){destroyed.push({at:Date.now(),...v.params});append('target-destroyed.jsonl',destroyed.at(-1));}
   else if(['Runtime.consoleAPICalled','Runtime.exceptionThrown'].includes(v.method))append('console.jsonl',v);
  };
  await c.send('Target.setDiscoverTargets',{discover:true});const pages=(await c.send('Target.getTargets')).targetInfos.filter(t=>t.type==='page');assert.equal(pages.length,1);
  session=(await c.send('Target.attachToTarget',{targetId:pages[0].targetId,flatten:true})).sessionId;
  await c.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true},session);await c.send('Page.enable',{},session);await c.send('Runtime.enable',{},session);
  await c.send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/index.html?debug&threads&gl-gps='+backend},session);await c.send('Page.bringToFront',{},session);
  while(!await evaluate('typeof wineShell!=="undefined"&&typeof wineShell.launchApp==="function"')){assert(Date.now()<deadline);await sleep(25);}
  await evaluate(`(${installInitializedObserver.toString()})(globalThis,()=>runningApps);true`);
  await evaluate(`(()=>{let remaining=128;for(const name of ['_readCurrentDisplayCapture','_validateCurrentDisplayCapture','_readImmutableCapture']){const original=Win98Renderer.prototype[name];Win98Renderer.prototype[name]=function(){if(remaining-->0)console.log('GLTRON_CAPTURE_PHASE',JSON.stringify({name,edge:'enter',at:Date.now(),publication:this._immutablePublicationSequence,held:this._workerPublicationHeld()}));try{return original.apply(this,arguments);}finally{if(remaining-->0)console.log('GLTRON_CAPTURE_PHASE',JSON.stringify({name,edge:'return',at:Date.now()}));}};}return true;})()`);
  if(qualifyNative)await evaluate('window.WINE_BROWSER_NATIVE_INPUT=true;true');
  if(qualifyNative)await evaluate(`(${installNativeRouteObserver.toString()})(globalThis,WineAssembly);true`);
  if(authored)await evaluate('wineApps.APPS.lifecycle_gl_authored={exe:"authored-native.exe",threads:true};true');
  save('invocation.json',{at:Date.now(),app:authored?'lifecycle_gl_authored':'gltron',authored,registeredDefaults:!authored,originalInvocations:authored?0:1,inputDispatches:0});
  await evaluate(`wineShell.launchApp(${JSON.stringify(authored?'lifecycle_gl_authored':'gltron')});true`);
  const startupAt=Date.now();let startupHost=false;
  for(;;){const s=await evaluate('({at:Date.now(),receipts:__nativeInitialized.receipts,apps:runningApps.map(a=>({name:a.name,running:a.wine?.running,stopped:!!a.wine?._stopped,slice:a.wine?._workerLastSlice?.seq})),fatal:document.querySelector("#wine-crash-report .wine-crash-text")?.value||null})');append('startup.jsonl',s);
   if(!startupHost&&(s.fatal||Date.now()-startupAt>10000)){startupHost=true;await bounded(async()=>{const at=Date.now(),host=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},session);fs.writeFileSync(out+'/selected-startup-host.png',Buffer.from(host.data,'base64'),{flag:'wx'});save('selected-startup.json',{at,completedAt:Date.now(),elapsedMs:Date.now()-at,initializedGLQualified:false,inputEvents:0,state:s});});}
   assert(!s.fatal,s.fatal);assert(!s.apps.some(a=>a.stopped),'native owner stopped during startup');if(s.receipts.length)break;assert(Date.now()<deadline-3000);await sleep(100);}
  await Promise.all(tasks);save('workers-before.json',[...workers.values()]);assert([...workers.values()].filter(w=>w.scripts.length).length>=2,'main and render Worker inheritance');
  save('actual-backend.json',await evaluate(`(()=>{const w=runningApps[0].wine,b=w.hostCtx.getGlGpsBridge?.();return {requested:${JSON.stringify(backend)},api:b?.api,configuredBackend:b?.options.backend,endpointBackend:b?.endpoint?.options?.backend,endpoint:b?.endpoint?.id,epoch:b?.workerEpoch,device:b?.device,receipts:__nativeInitialized.receipts};})()`));
  save('actual-render-workers.json',await Promise.all([...workers.values()].filter(w=>w.url.includes('d3d-render-worker')).map(async w=>({targetId:w.targetId,observation:await evaluate('globalThis.__gltronObserver?.snapshot?.()??null',w.sessionId)}))));
  if(qualifyNative){const audit=await evaluate(`(${inspectNativeRoute.toString()})(globalThis,runningApps[0].wine)`);save('native-route.json',audit);}
  await capture('selected-0');save('ready.json',{at:Date.now(),authored,readOnly:true});
  if(qualifyNative){
    const binding=await evaluate('(globalThis.__nativeBridgeOwner=runningApps[0].wine)._browserNativeInput.bind()');save('native-binding.json',binding);
    save('input-ready.json',{at:Date.now(),binding});
    // Each command is written only after personal inspection of its complete
    // image. No next command is accepted after a missing native return.
    for(let n=0;n<16;n++){
      const file=out+'/action-'+n+'.json';while(!fs.existsSync(file)&&Date.now()<deadline-4000)await sleep(10);
      assert(Date.now()<deadline-4000,'finite native command wait');const intent=JSON.parse(fs.readFileSync(file));
      if(intent.action==='stop')break;
      if(intent.action==='observe'){await capture('selected-'+(n+1));save('action-'+n+'-complete.json',{at:Date.now(),inputEvents:0});continue;}
      assert(intent.action==='key'&&intent.review?.trim());
      const reviewAge=Date.now()-lastImage.completedAt;
      assert(intent.imageSHA256===lastImage.sha256&&intent.reviewedAt>=lastImage.completedAt&&
        intent.reviewedAt<=Date.now()&&reviewAge<(intent.mode==='game'?15000:30000),
        'finite input requires the fresh complete selected host image');
      save('action-'+n+'-image-join.json',{...lastImage,reviewAge,reviewedAt:intent.reviewedAt,nonce:intent.nonce});
      // A separate process owns physical UP before any DOWN may be sent.
      const cfg={name:'action-'+n,pid:browser.pid,startToken:fs.readFileSync('/proc/'+browser.pid+'/stat','utf8').split(') ').at(-1).split(' ')[19],url:endpoint,targetId:pages[0].targetId,nonce:intent.nonce,key:intent.key,code:intent.code};
      const cfgPath=out+'/action-'+n+'-release.json';save('action-'+n+'-release.json',cfg);
      const release=cp.spawn(process.execPath,['tools/gltron-current-native-input.cjs','release',out,cfgPath],{cwd:ROOT,stdio:['pipe','pipe','pipe']});
      let stdout='',stderr='';release.stdout.on('data',b=>stdout+=b);release.stderr.on('data',b=>stderr+=b);
      const joined=new Promise(resolve=>release.once('close',(code,signal)=>resolve({code,signal,actualWait:true,stdoutEOF:release.stdout.readableEnded,stderrEOF:release.stderr.readableEnded,stdout,stderr})));
      try{
        const until=Date.now()+1000;while(!stdout.includes('\n')){assert(release.exitCode===null&&Date.now()<until,'independent physical UP arm');await sleep(5);}
        save('action-'+n+'-up-armed.json',JSON.parse(stdout.split('\n')[0]));
        const ready=await evaluate(`runningApps[0].wine._browserNativeInput.prepare(${JSON.stringify({...intent,owner:binding.owner,reviewed:true})})`);
        save('action-'+n+'-prepared.json',ready);assert.equal(ready.state,'PREPARED');
        const before=Date.now();await c.send('Input.dispatchKeyEvent',{type:'rawKeyDown',key:intent.key,code:intent.key,windowsVirtualKeyCode:intent.code},session);
        if(authored&&intent.parentStallMs){assert(intent.parentStallMs>=1800&&intent.parentStallMs<=2500);
          save('action-'+n+'-parent-stall.json',{at:Date.now(),milliseconds:intent.parentStallMs});
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,intent.parentStallMs);}
        let proof;do{proof=await evaluate(`__nativeBridgeOwner._browserNativeInput.status(${JSON.stringify(intent.nonce)})`);if(proof.state==='CONSUMED')break;assert(proof.state==='DELIVERY_PENDING'||proof.state==='PREPARED',JSON.stringify(proof));await sleep(5);}while(Date.now()-before<500);
        save('action-'+n+'-native.json',proof);requireNativeRoute(JSON.parse(fs.readFileSync(out+'/native-route.json')),proof);
        if(!intent.parentStallMs)release.stdin.write(JSON.stringify({at:Date.now()+50})+'\n');
      }finally{release.stdin.end();const wait=await joined;save('action-'+n+'-physical-wait.json',wait);assert.equal(wait.code,0);}
      if(intent.expectQuit){
        const until=Math.min(deadline,Date.now()+3000);let exit;
        do{exit=await evaluate('({running:__nativeBridgeOwner.running,exited:__nativeBridgeOwner._processObject.exited,nativeCode:__nativeBridgeOwner._exitCode})');if(exit.exited&&!exit.running&&Number.isInteger(exit.nativeCode))break;await sleep(10);}while(Date.now()<until);
        assert(exit.exited&&!exit.running&&Number.isInteger(exit.nativeCode),'native Quit did not exit');
        save('native-quit.json',{...exit,at:Date.now(),nonce:intent.nonce,hostStop:false});nativeQuit=true;break;
      }
      await capture('selected-'+(n+1));save('action-'+n+'-complete.json',{at:Date.now()});
    }
  }
  if(!authored&&!qualifyNative)for(let n=0;n<2;n++){const f=out+'/observe-'+n+'.json';while(!fs.existsSync(f)&&Date.now()<deadline-3000)await sleep(20);assert(Date.now()<deadline-3000);const intent=JSON.parse(fs.readFileSync(f));assert(intent.review?.trim()&&['observe','stop'].includes(intent.action));save('observation-intent-'+n+'.json',intent);if(intent.action==='stop')break;if(intent.waitMs)await sleep(Math.min(30000,intent.waitMs));await capture('selected-'+(n+1));}
  if(!nativeQuit)save('host-stop.json',await evaluate('new Promise(async resolve=>{const w=runningApps[0].wine;w.stop({repaint:false});const guest=await w._guestRuntimeStopPromise;await w._renderWorkerRetirement;resolve({nativeQuit:false,kind:"explicit host stop",guest,renderRetired:w._renderWorkerRetired,at:Date.now()});})'));
  else save('native-quit-retired.json',await evaluate('(async()=>({guest:await __nativeBridgeOwner._guestRuntimeStopPromise,render:await __nativeBridgeOwner._renderWorkerRetirement}))()'));
  const end=Math.min(deadline,Date.now()+2000);while(Date.now()<end&&![...workers.values()].every(w=>destroyed.some(d=>d.targetId===w.targetId)))await sleep(10);
  save('worker-closure.json',{workers:[...workers.values()],destroyed});await c.send('Browser.close');
 }catch(e){terminal=true;save('failure.json',{at:Date.now(),error:e.stack,endpointPermanentlyClosed:true,noLaterQueries:true,nativeQuit:false});process.exitCode=1;
 }finally{
  c?.ws.close();if(browser){if(terminal&&browser.exitCode===null&&browser.signalCode===null)browser.kill('SIGTERM');let timer;try{timer=setTimeout(()=>browser.kill('SIGKILL'),3000);await browserWait;}finally{clearTimeout(timer);}}
  if(server)await new Promise(r=>server.close(r));await Promise.allSettled(tasks);
  if(browser&&browser.exitCode!==null||browser?.signalCode!==null&&browser?.signalCode!==undefined)fs.rmSync(out+'/profile',{recursive:true,force:true});
 }
}
if(require.main===module)run(process.argv[2],process.argv[3],['authored','qualify-native'].includes(process.argv[4]),process.argv[5]||'webgl',['qualify-native','native-original'].includes(process.argv[4])).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={run};
