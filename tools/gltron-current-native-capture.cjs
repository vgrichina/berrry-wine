'use strict';
// Authored continuous native GL qualification. Never loads original game media.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const cp=require('node:child_process'),http=require('node:http'),crypto=require('node:crypto');
const {PNG}=require('pngjs');
const {gitFiles,compile}=require('./boids-current-runtime.cjs');
const controller=require('./gltron-browser-controller.cjs'),binding=require('./gltron-browser-binding.cjs');
const ROOT=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// Passive identity joins. A complete desktop may legitimately precede the
// first native GPU frame. Neither white/nonwhite pixels nor elapsed time
// identifies that transition.
function installInitializedObserver(root,getApps=()=>root.runningApps||[]) {
  const p=root.Win98Renderer.prototype;
  const transfer=p.observePresentationTransfer,publish=p.observePresentationPublication;
  const ids=new WeakMap();let next=0;
  const token=o=>{if(!o)return null;if(!ids.has(o))ids.set(o,++next);return ids.get(o);};
  const state=root.__nativeInitialized={receipts:[],initialPublications:0,transfers:[],ticketEvents:[]};
  for(const name of ['requestCurrentDisplayCapture','endWorkerGuestSlice','serviceCurrentDisplayCapture']){
    const original=p[name];if(typeof original!=='function')continue;
    p[name]=function(){
      const relevant=name==='requestCurrentDisplayCapture'||this._immutableCaptureRequest?.currentDisplay;
      try{return original.apply(this,arguments);}finally{if(relevant){
        const w=getApps().find(a=>a.wine?.renderer===this)?.wine;
        state.ticketEvents.push({event:name,at:Date.now(),publication:this._immutablePublicationSequence,
          pending:!!this._immutableCaptureRequest,held:this._workerPublicationHeld(),gdi:this._workerGdiPaintDepth,
          scheduled:this._repaintScheduled,repaintPending:this._repaintPending,deferred:this._workerRepaintDeferred,
          host:w?{dirty:!!w._dxDirty,lockDeferred:!!w._dxLockDeferred,presentDue:!!w._presentFrameDue,
            running:w.running,stopped:!!w._stopped}:null});
        if(state.ticketEvents.length>64)state.ticketEvents.shift();
      }}
    };
  }
  p.observePresentationTransfer=function(source,destination,geometry){
    const result=transfer.apply(this,arguments);
    const w=getApps().find(a=>a.wine?.renderer===this)?.wine,b=w?.hostCtx.getGlGpsBridge?.();
    if(b?.presenter.layer?.canvas===source&&b.presenter.win){
      state.transfers.push({renderer:this,source,destination,geometry:[...geometry],layer:b.presenter.layer,
        writeSeq:b.presenter.layer.writeSeq,stamp:b.presenter.stamp,endpoint:b.endpoint,epoch:b.workerEpoch});
      if(state.transfers.length>32)state.transfers.shift();
    }
    return result;
  };
  p.observePresentationPublication=function(display,sequence){
    const result=publish.apply(this,arguments);
    const w=getApps().find(a=>a.wine?.renderer===this)?.wine,b=w?.hostCtx.getGlGpsBridge?.();
    const layer=b?.presenter.layer,win=b?.presenter.win;
    const t=state.transfers.findLast(t=>t.renderer===this&&t.destination===display.source&&t.layer===layer&&t.writeSeq===layer?.writeSeq);
    if(t&&t.endpoint===b.endpoint&&t.epoch===b.workerEpoch&&b.api==='gl-gps'&&b.endpoint&&!b.endpoint.closed&&!b.workerAsyncError&&win?._dxFrameLayer===layer&&win.wasm===w.instance){
      // Identity/sequence observation only, after the ordinary display call.
      const receipt={publication:sequence,at:Date.now(),api:b.api,endpoint:b.endpoint.id,endpointObject:token(b.endpoint),epoch:b.workerEpoch,
        window:win.hwnd,windowObject:token(win),instance:token(win.wasm),layer:token(layer),sourceCanvas:token(t.source),
        writeSeq:t.writeSeq,stamp:t.stamp,presents:b.presenter.presents,geometry:t.geometry};
      state.receipts.push(receipt);if(state.receipts.length>8)state.receipts.shift();
    }else state.initialPublications++;
    state.transfers=[];
    return result;
  };
}
function fixture({messageDriven=false,drawOnce=false,timerMs=0,firstInputDelay=0,afterFirstInputDelay=0}={}){
  assert(Number.isInteger(firstInputDelay)&&firstInputDelay>=0&&firstInputDelay<=5000);
  assert(Number.isInteger(afterFirstInputDelay)&&afterFirstInputDelay>=0&&afterFirstInputDelay<=5000);
  const b=Buffer.alloc(0x6400),base=0x400000,raw=r=>r-0x1000+0x400;
  const d=(o,n)=>b.writeUInt32LE(n>>>0,o),w=(o,n)=>b.writeUInt16LE(n,o),pe=0x80,opt=pe+24,s=opt+224;
  w(0,0x5a4d);d(0x3c,pe);d(pe,0x4550);w(pe+4,0x14c);w(pe+6,1);w(pe+20,224);w(pe+22,0x10e);
  w(opt,0x10b);d(opt+16,0x2000);d(opt+28,base);d(opt+32,4096);d(opt+36,1024);w(opt+40,4);w(opt+48,4);
  d(opt+56,0x7000);d(opt+60,1024);w(opt+68,2);d(opt+72,0x100000);d(opt+76,4096);d(opt+80,0x100000);d(opt+84,4096);d(opt+92,16);
  b.write('.native',s);d(s+8,0x6000);d(s+12,0x1000);d(s+16,0x6000);d(s+20,1024);d(s+36,0xe0000060);
  const libraries=[['kernel32.dll',['ExitProcess','OutputDebugStringA']],['user32.dll',['RegisterClassA','CreateWindowExA','SetFocus',messageDriven?'GetMessageA':'PeekMessageA','TranslateMessage','DispatchMessageA','DefWindowProcA','GetDC','ChangeDisplaySettingsA']],['gdi32.dll',['SwapBuffers']],['opengl32.dll',['wglCreateContext','wglMakeCurrent','glClearColor','glClear','glBegin','glColor3f','glVertex2f','glEnd']]];
  if(timerMs)libraries[1][1].push('SetTimer');
  if(firstInputDelay||afterFirstInputDelay)libraries[0][1].push('Sleep');
  d(opt+104,0x1000);d(opt+108,(libraries.length+1)*20);let str=0x1800;const apis=new Map();
  libraries.forEach(([dll,names],i)=>{const desc=raw(0x1000+i*20),thunk=0x1200+i*256;d(desc,thunk);d(desc+12,str);d(desc+16,thunk);b.write(dll+'\0',raw(str));str+=dll.length+1;
    names.forEach((name,j)=>{d(raw(thunk+j*4),str);b.write(name+'\0',raw(str+2));str+=name.length+3;apis.set(name,base+thunk+j*4);});});assert(str<0x2000);
  for(const [r,text]of [[0x3000,'ContinuousNativeGL'],[0x3060,'Native continuous GL input qualification'],[0x3100,'NATIVE_DOWN'],[0x3140,'NATIVE_UP'],[0x3180,'NATIVE_QUIT']])b.write(text+'\0',raw(r));
  d(raw(0x3504),base+0x2800);d(raw(0x3510),base);d(raw(0x3524),base+0x3000);
  w(raw(0x3800+36),156);d(raw(0x3800+40),0x1c0000);d(raw(0x3800+104),32);d(raw(0x3800+108),480);d(raw(0x3800+112),360);
  const u=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];
  const asm=(r,work)=>{const code=[],labels=new Map(),fix=[];const emit=(...a)=>code.push(...a),push=n=>emit(0x68,...u(n)),call=n=>{assert(apis.has(n));emit(0xff,0x15,...u(apis.get(n)));},label=n=>labels.set(n,code.length),jump=(n,c)=>{emit(...(c?[0x0f,c]:[0xe9]));fix.push([code.length,n]);emit(0,0,0,0);};
    work({emit,push,call,label,jump});const a=Buffer.from(code);for(const [o,n]of fix){assert(labels.has(n));a.writeInt32LE(labels.get(n)-o-4,o);}assert(a.length<0x800);a.copy(b,raw(r));};
  asm(0x2000,({emit,push,call,label,jump})=>{
    push(base+0x3500);call('RegisterClassA');for(const n of [0,base,0,0,360,480,40,40,0x90000000,base+0x3060,base+0x3000,0])push(n);call('CreateWindowExA');emit(0xa3,...u(base+0x3600),0x50);call('SetFocus');
    push(4);push(base+0x3800);call('ChangeDisplaySettingsA');
    emit(0xff,0x35,...u(base+0x3600));call('GetDC');emit(0xa3,...u(base+0x3604),0x50);call('wglCreateContext');emit(0x50,0xff,0x35,...u(base+0x3604));call('wglMakeCurrent');
    if(timerMs){push(0);push(timerMs);push(1);emit(0xff,0x35,...u(base+0x3600));call('SetTimer');}
    if(messageDriven||drawOnce)jump('draw'); // The authored initial frame precedes the normal message wait.
    label('loop');for(const n of (messageDriven?[0,0,0,base+0x3640]:[1,0,0,0,base+0x3640]))push(n);call(messageDriven?'GetMessageA':'PeekMessageA');
    if(afterFirstInputDelay){emit(0x50,0x83,0x3d,...u(base+0x3610),0);jump('after-first-input-delay',0x85);
      emit(0xc7,0x05,...u(base+0x3610),...u(1));push(afterFirstInputDelay);call('Sleep');label('after-first-input-delay');emit(0x58);}
    emit(0x85,0xc0);jump(drawOnce?'loop':'draw',0x84);push(base+0x3640);call('TranslateMessage');push(base+0x3640);call('DispatchMessageA');
    if(timerMs){emit(0x81,0x3d,...u(base+0x3644),...u(0x113));jump('loop',0x85);}
    else if(drawOnce)jump('loop');
    label('draw');push(0x3f800000);push(0x3e800000);push(0x3e000000);emit(0xff,0x35,...u(base+0x3608));call('glClearColor');push(0x4000);call('glClear');
    push(4);call('glBegin');for(const n of [0x3f000000,0x3f800000,0x3f800000])push(n);call('glColor3f');
    for(const p of [[0xbf000000,0xbf000000],[0xbf000000,0x3f000000],[0x3f000000,0]]){for(const n of p)push(n);call('glVertex2f');}call('glEnd');emit(0xff,0x35,...u(base+0x3604));call('SwapBuffers');
    if(firstInputDelay){emit(0x83,0x3d,...u(base+0x360c),0);jump('after-initial-delay',0x85);
      emit(0xc7,0x05,...u(base+0x360c),...u(1));push(firstInputDelay);call('Sleep');label('after-initial-delay');}
    jump('loop');
  });
  asm(0x2800,({emit,push,call,label,jump})=>{
    emit(0x55,0x89,0xe5,0x81,0x7d,0x0c,...u(0x100));jump('down',0x84);emit(0x81,0x7d,0x0c,...u(0x101));jump('up',0x84);
    for(const o of [20,16,12,8])emit(0xff,0x75,o);call('DefWindowProcA');jump('return');
    label('down');push(base+0x3100);call('OutputDebugStringA');emit(0xc7,0x05,...u(base+0x3608),...u(0x3f400000));jump('zero');
    label('up');push(base+0x3140);call('OutputDebugStringA');emit(0x83,0x7d,0x10,27);jump('quit',0x84);jump('zero');
    label('quit');push(base+0x3180);call('OutputDebugStringA');push(0);call('ExitProcess');
    label('zero');emit(0x31,0xc0);label('return');emit(0x5d,0xc2,0x10,0);
  });return b;
}

async function run(out,commit){
  const save=(name,value)=>fs.writeFileSync(path.join(out,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
  assert(fs.existsSync(out),'observable independent supervisor must create output directory');
  const timerMs=Number(process.env.GLTRON_FIXTURE_TIMER_MS||0);
  assert(Number.isInteger(timerMs)&&(timerMs===0||(timerMs>=16&&timerMs<=2000)));
  const files=gitFiles(commit),messageDriven=process.env.GLTRON_FIXTURE_MESSAGE_DRIVEN==='1',drawOnce=process.env.GLTRON_FIXTURE_DRAW_ONCE==='1'||timerMs>0,exe=fixture({messageDriven,drawOnce,timerMs});
  // Explicit authored-only runtime candidate. All other runtime sources stay
  // on the immutable Git graph, including concurrent foreign Worker edits.
  if(process.env.GLTRON_CAPTURE_HOST_CANDIDATE==='1')files.set('host.js',fs.readFileSync(path.join(ROOT,'host.js')));
  const [viewportWidth,viewportHeight]=(process.env.GLTRON_NATIVE_VIEWPORT||'1280x960').split('x').map(Number);
  assert(Number.isInteger(viewportWidth)&&viewportWidth>=800&&viewportWidth<=1920&&Number.isInteger(viewportHeight)&&viewportHeight>=600&&viewportHeight<=1440);
  const helpers=['tools/gltron-current-native-capture.cjs','tools/gltron-browser-controller.cjs','tools/gltron-browser-binding.cjs','tools/boids-current-runtime.cjs','tools/boids-current-supervise.py'];
  save('source.json',{commit,foreignWIPAdopted:false,helpers:helpers.map(n=>{const r=cp.spawnSync('git',['show',commit+':'+n],{cwd:ROOT});return {path:n,sha256:sha(fs.readFileSync(path.join(ROOT,n))),published:r.status===0&&r.stdout.equals(fs.readFileSync(path.join(ROOT,n)))};}),runtime:[...files].map(([path,b])=>({path,sha256:sha(b),bytes:b.length})),fixture:{sha256:sha(exe),bytes:exe.length,clock:'real',slice:1000}});
  const wasm=compile(files);files.set('build/wine-assembly.wasm',wasm);files.set('authored-native.exe',exe);
  const modulePath=path.join(path.dirname(out),'tested-'+sha(wasm)+'.wasm');
  if(!fs.existsSync(modulePath))fs.writeFileSync(modulePath,wasm,{flag:'wx'});
  assert.equal(sha(fs.readFileSync(modulePath)),sha(wasm));
  save('module.json',{sha256:sha(wasm),bytes:wasm.length,commit,persisted:true,retainedBeforeExecution:true,fixture:{messageDriven,drawOnce,timerMs,viewport:{width:viewportWidth,height:viewportHeight}}});
  save('prepared.json',{at:Date.now(),commit,module:sha(wasm)});
  while(!fs.existsSync(out+'/runtime-start.json'))await sleep(10);
  const {deadline}=JSON.parse(fs.readFileSync(out+'/runtime-start.json'));
  let browser,c,server,session,joined,captureTimer;const wire=[],workers=new Map(),tasks=[],requests=[],closedTargets=[];
  const evaluate=async(expression,s=session)=>{const r=await c.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},s);if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  let failure=null;
  try{
    server=http.createServer((req,res)=>{const n=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'index.html';let b=files.get(n);
      if(!b&&/^(fonts|icons|images)\/[\w./-]+$/.test(n)&&!n.includes('..')){try{b=fs.readFileSync(path.join(ROOT,n));files.set(n,b);}catch{}}
      requests.push({at:Date.now(),path:n,status:b?200:404,sha256:b?sha(b):null});
      res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':n.endsWith('.wasm')?'application/wasm':n.endsWith('.html')?'text/html':n.endsWith('.json')?'application/json':'application/octet-stream');res.statusCode=b?200:404;res.end(b||'not found');});
    await new Promise(r=>server.listen(0,'127.0.0.1',r));save('server.json',{port:server.address().port,owned:true});
    const launched=await require('puppeteer').launch({executablePath:'/opt/google/chrome/chrome',headless:true,userDataDir:out+'/profile',defaultViewport:{width:viewportWidth,height:viewportHeight},timeout:Math.max(1,Math.min(30000,deadline-Date.now())),args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader',`--window-size=${viewportWidth},${viewportHeight}`]});
    browser=launched.process();const endpoint=launched.wsEndpoint();await launched.disconnect();
    let stdout='',stderr='';browser.stdout.on('data',b=>stdout+=b);browser.stderr.on('data',b=>stderr+=b);
    joined=new Promise(r=>browser.once('close',(code,signal)=>{save('browser-wait.json',{pid:browser.pid,code,signal,actualWait:true,stdoutEOF:browser.stdout.readableEnded,stderrEOF:browser.stderr.readableEnded});fs.writeFileSync(out+'/browser.stdout.log',stdout);fs.writeFileSync(out+'/browser.stderr.log',stderr);r();}));
    save('browser.json',{pid:browser.pid,args:browser.spawnargs,binarySHA256:sha(fs.readFileSync('/opt/google/chrome/chrome')),backendRequested:'ANGLE SwiftShader',physicalGPUClaim:false});
    c=controller.connection(endpoint);await c.ready;
    const send=c.ws.send.bind(c.ws);c.ws.send=value=>{const v=JSON.parse(value);wire.push({at:Date.now(),direction:'request',id:v.id,method:v.method,sessionId:v.sessionId,operation:v.params?.expression?.includes('const t=w.requestCurrentDisplayCapture')?'current-display-arm':v.params?.expression?.includes('const p=__gltronCurrentPin')?'current-display-poll':null,...(v.method==='Page.captureScreenshot'?{params:v.params}:{})});return send(value);};
    c.ws.addEventListener('message',e=>{const v=JSON.parse(e.data);if(v.id)wire.push({at:Date.now(),direction:'response',id:v.id,error:v.error,dataBytes:v.result?.data?.length??null});});
    c.event=v=>{if(v.method==='Target.attachedToTarget'&&v.params.targetInfo.type==='worker'){
      const {sessionId,targetInfo}=v.params,w={sessionId,targetId:targetInfo.targetId,url:targetInfo.url,scripts:[],closed:false};workers.set(sessionId,w);
      const task=(async()=>{await c.send('Runtime.enable',{},sessionId);await c.send('Runtime.evaluate',{expression:controller.GL_OBSERVER},sessionId);await c.send('Debugger.enable',{},sessionId);await c.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true},sessionId);await c.send('Runtime.runIfWaitingForDebugger',{},sessionId);})();tasks.push(task);task.catch(()=>{});
    }else if(v.method==='Target.detachedFromTarget'){const w=workers.get(v.params.sessionId);if(w)w.closed=true;closedTargets.push({at:Date.now(),method:v.method,...v.params});}
    else if(v.method==='Target.targetDestroyed'){for(const w of workers.values())if(w.targetId===v.params.targetId)w.closed=true;closedTargets.push({at:Date.now(),method:v.method,...v.params});}
    else if(v.method==='Debugger.scriptParsed'&&workers.has(v.sessionId)&&v.params.scriptLanguage==='WebAssembly'){
      const row={scriptId:v.params.scriptId,url:v.params.url};workers.get(v.sessionId).scripts.push(row);const task=c.send('Debugger.getScriptSource',{scriptId:row.scriptId},v.sessionId).then(s=>{row.bytecodeAvailable=!!s.bytecode;const bytes=Buffer.from(s.bytecode||s.scriptSource||'',s.bytecode?'base64':'utf8');row.sha256=sha(bytes);if(s.bytecode){assert.equal(row.sha256,sha(wasm),'actual Worker module differs');const name='tested-'+row.sha256+'.wasm',dest=path.join(path.dirname(out),name);if(!fs.existsSync(dest))fs.writeFileSync(dest,bytes,{flag:'wx'});}});tasks.push(task);task.catch(e=>row.error=String(e));}};
    await c.send('Target.setDiscoverTargets',{discover:true});
    const pages=(await c.send('Target.getTargets')).targetInfos.filter(t=>t.type==='page');assert.equal(pages.length,1);
    const targetId=pages[0].targetId;session=(await c.send('Target.attachToTarget',{targetId,flatten:true})).sessionId;
    await c.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true},session);await c.send('Page.enable',{},session);await c.send('Runtime.enable',{},session);
    await c.send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/index.html?debug&threads&gl-renderer=webgl'},session);await c.send('Page.bringToFront',{},session);
    const startup=Math.min(deadline,Date.now()+30000);while(!await evaluate('typeof wineShell!=="undefined"&&typeof wineShell.launchApp==="function"')){assert(Date.now()<startup,'shell startup');await sleep(25);}
    await evaluate(`(${installInitializedObserver.toString()})(globalThis,()=>runningApps);true`);
    await evaluate(`(()=>{wineApps.APPS.live_input_fixture={exe:'authored-native.exe',threads:true,runSlice:{cooperative:1000,worker:1000,compat:1000}};globalThis.nativeKeys=[];for(const type of ['keydown','keyup'])document.addEventListener(type,e=>nativeKeys.push({type,key:e.key,trusted:e.isTrusted,at:Date.now()}),true);wineShell.launchApp('live_input_fixture');return true;})()`);
    const startupObservations=[];
    for(;;){const state=await evaluate(`(()=>{const w=runningApps[0]?.wine,b=w?.hostCtx.getGlGpsBridge?.();return {at:Date.now(),ready:runningApps.length===1&&!!w?._workerLastSlice&&__nativeInitialized.receipts.length>0,publication:w?.renderer._immutablePublicationSequence,initialPublications:__nativeInitialized.initialPublications,slice:w?._workerLastSlice?.seq,presents:b?.presenter.presents,endpoint:b?.endpoint?.id,epoch:b?.workerEpoch,error:String(b?.workerAsyncError||'')};})()`);
      startupObservations.push(state);if(startupObservations.length>32)startupObservations.shift();fs.writeFileSync(out+'/startup-observations.json',JSON.stringify(startupObservations,null,2)+'\n');
      if(state.ready)break;assert(Date.now()<startup,'native initialized GPS ordinary publication startup');await sleep(25);
    }await Promise.all(tasks);
    save('initialized-before.json',await evaluate('({initialPublications:__nativeInitialized.initialPublications,receipts:__nativeInitialized.receipts})'));
    save('owner-before.json',await evaluate(binding.PAGE_READ));save('host-before.json',await evaluate(binding.HOST_READ));
    save('native-gps-owner.json',await evaluate(`(()=>{const w=runningApps[0].wine,b=w.hostCtx.getGlGpsBridge?.();return {at:Date.now(),focus:document.hasFocus(),visibility:document.visibilityState,bridge:b?{api:b.api,stats:b.stats,epoch:b.workerEpoch,endpoint:b.endpoint?.id,error:String(b.workerAsyncError||''),presents:b.presenter.presents,layer:b.presenter.layer?{api:b.presenter.layer.api,writeSeq:b.presenter.layer.writeSeq,width:b.presenter.layer.canvas.width,height:b.presenter.layer.canvas.height}:null}:null,ports:[...w._renderWorkerManager.ports.values()].map(p=>({id:p.id,closed:p.closed,options:p.options})),slice:w._workerLastSlice?.seq,publication:w.renderer._immutablePublicationSequence};})()`));
    save('actual-gl.json',await Promise.all([...workers.values()].filter(w=>!w.closed&&w.url.includes('d3d-render-worker')).map(async w=>({targetId:w.targetId,observation:await evaluate('globalThis.__gltronObserver?.snapshot?.()??null',w.sessionId),endpoints:await evaluate(binding.RENDER_READ,w.sessionId)}))));
    save('workers-before.json',[...workers.values()]);
    const captureStart=Date.now();save('capture-start.json',{at:captureStart,boundMs:3000,route:'public requestCurrentDisplayCapture',noForcedPublication:true});
    const nonce=crypto.randomUUID(),observations=[];
    const snapshot=await Promise.race([(async()=>{
    const armExpression=`(()=>{
      const w=runningApps[0].wine,r=w.renderer;
      const windows=Object.values(r.windows).filter(v=>v.visible&&!v.isChild&&v.processId===w.processId&&v.wasm===w.instance);if(windows.length!==1)throw Error('ambiguous native owner');const win=windows[0],manager=w._renderWorkerManager,ports=[...manager.ports.values()];
      const verify=()=>{if(r.windows[win.hwnd]!==win||win.wasm!==w.instance||manager!==w._renderWorkerManager||manager._failure||w._stopped||!w.running||ports.some(p=>p.closed))throw Error('native owner retired');};
      verify();if(globalThis.__gltronCurrentTicket)throw Error('ticket already armed');
      const t=w.requestCurrentDisplayCapture({hwnd:win.hwnd});globalThis.__gltronCurrentTicket=t;
      globalThis.__gltronCurrentPin={w,r,win,verify,nonce:${JSON.stringify(nonce)}};
      return {at:Date.now(),status:t.status,error:t.error,publication:r._immutablePublicationSequence,held:r._workerPublicationHeld(),slice:w._workerLastSlice?.seq};
    })()`;
    const arm=await evaluate(process.env.GLTRON_CAPTURE_AT_SLICE_START==='1'
      ? `new Promise(resolve=>{const r=runningApps[0].wine.renderer,prior=r.beginWorkerGuestSlice;
          r.beginWorkerGuestSlice=function(){r.beginWorkerGuestSlice=prior;prior.apply(this,arguments);resolve(${armExpression});};})`
      : armExpression);
    observations.push({stage:'arm',...arm});save('capture-arm.json',{nonce,...arm});
    let snapshot;
    while(Date.now()-captureStart<3000){
      const row=await evaluate(`(async()=>{const p=__gltronCurrentPin,t=__gltronCurrentTicket;if(p.nonce!==${JSON.stringify(nonce)})throw Error('ticket nonce replaced');p.verify();
        const state={at:Date.now(),status:t.status,error:t.error,publication:p.r._immutablePublicationSequence,held:p.r._workerPublicationHeld(),slice:p.w._workerLastSlice?.seq,pending:{dirty:!!p.w._dxDirty,lockDeferred:!!p.w._dxLockDeferred,presentDue:!!p.w._presentFrameDue},gdi:p.r._workerGdiPaintDepth};
        state.ticketEvents=__nativeInitialized.ticketEvents;
        if(t.status!=='complete')return {state};const first=t.read();globalThis.__gltronRetainedFirst=first;
        const encode=b=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(Error('immutable byte transport failed'));reader.onload=()=>resolve(reader.result.slice(reader.result.indexOf(',')+1));reader.readAsDataURL(new Blob([b],{type:'application/octet-stream'}));});
        const receipt=__nativeInitialized.receipts.find(r=>r.publication===first.metadata.publication);
        if(!receipt)throw Error('capture is not joined to an initialized GPS publication');
        const source=await encode(first.sourceRGBA),output=await encode(first.outputRGBA);p.verify();return {state,snapshot:{metadata:first.metadata,receipt,source,output}};
      })()`);
      observations.push({stage:'poll',...row.state});fs.writeFileSync(out+'/capture-observations.json',JSON.stringify({nonce,observations},null,2)+'\n');
      if(row.snapshot){snapshot=row.snapshot;break;}
      assert.equal(row.state.status,'pending','current-display ticket refused: '+row.state.error);
      await sleep(10);
    }
    assert(snapshot,'DISPLAY_UNKNOWN current-display completion deadline; no replay');
    assert(Date.now()-captureStart<3000,'late controller current-display completion');
    save('capture.json',{startedAt:captureStart,completedAt:Date.now(),elapsedMs:Date.now()-captureStart,...snapshot,source:undefined,output:undefined});
    for(const kind of ['source','output']){const dim=snapshot.metadata[kind],bytes=Buffer.from(snapshot[kind],'base64');assert.equal(bytes.length,dim.width*dim.height*4);fs.writeFileSync(out+'/authored-'+kind+'.png',require('./gltron-current-capture.cjs').encodeCapturePNG(dim.width,dim.height,bytes),{flag:'wx'});}
    // Canvas bytes do not depict host HTML consent/occlusion. The required
    // full host capture shares the original unchanged 3000ms deadline.
    // Retention/oracle tests follow its completion, outside that transaction.
    save('host-capture-start.json',{at:Date.now(),boundMs:3000,params:{format:'png',captureBeyondViewport:false}});
    const hostStart=Date.now(),host=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},session);
    assert(Date.now()-hostStart<3000&&Date.now()-captureStart<3000,'late complete native pixels/host observation');const png=Buffer.from(host.data,'base64');fs.writeFileSync(out+'/authored-host.png',png,{flag:'wx'});save('host-capture.json',{at:hostStart,elapsedMs:Date.now()-hostStart,totalObservationMs:Date.now()-captureStart,sha256:sha(png),reviewed:false});
    return snapshot;
    })(),new Promise((_,reject)=>{captureTimer=setTimeout(()=>{c.ws.close();reject(Error('DISPLAY_UNKNOWN controller current-display deadline; permanent close'));},Math.max(1,3000-(Date.now()-captureStart)));})]).finally(()=>clearTimeout(captureTimer));
    save('scene-characterization.json',characterizeSource(Buffer.from(snapshot.source,'base64'),snapshot.metadata.source));
    const oracle=literalOracle(Buffer.from(snapshot.source,'base64'),snapshot.metadata.source);
    save('literal-oracle.json',oracle);
    save('literal-output-math-diagnostic.json',literalOutputOracle(Buffer.from(snapshot.output,'base64'),snapshot.metadata));
    save('literal-output-oracle.json',await evaluate(`(${canvasLiteralOutputOracle.toString()})(__gltronRetainedFirst)`));
    await sleep(250);
    save('retained.json',await evaluate(`(()=>{const t=__gltronCurrentTicket,a=__gltronRetainedFirst,b=t.read();let mismatch=0;for(const k of ['sourceRGBA','outputRGBA']){if(a[k].length!==b[k].length)throw Error('retained length changed');for(let i=0;i<a[k].length;i++)if(a[k][i]!==b[k][i])mismatch++;}return {at:Date.now(),status:t.status,mismatch,metadataSame:JSON.stringify(a.metadata)===JSON.stringify(b.metadata),capturedPublication:a.metadata.publication,currentPublication:runningApps[0].wine.renderer._immutablePublicationSequence,cancelComplete:t.cancel()};})()`));
    save('boundary.json',{at:Date.now(),nativeContinuousProducer:timerMs>0||!drawOnce,currentDisplayObserved:true,hostPixelsObserved:true,
      initializedLiteralSceneQualified:oracle.qualified,fullInputQualification:false,originalPermitted:false,
      next:'Current-display pixels are display observations; shared USER input qualification and full native fault/lifecycle scope remain separate prerequisites for any original.'});
    if(process.env.GLTRON_NATIVE_RETIRE==='1'){
      save('producer-retirement.json',await evaluate(`new Promise(resolve=>{const p=__gltronCurrentPin,w=p.w,r=p.r,b=w.hostCtx.getGlGpsBridge(),prior=r.beginWorkerGuestSlice;
        r.beginWorkerGuestSlice=function(){r.beginWorkerGuestSlice=prior;prior.apply(this,arguments);
          const old={epoch:b.workerEpoch,endpoint:b.endpoint.id},t=w.requestCurrentDisplayCapture({hwnd:p.win.hwnd});
          const closing=b.close(),immediate={status:t.status,error:t.error};
          Promise.resolve(closing).then(()=>resolve({at:Date.now(),old,epoch:b.workerEpoch,endpoint:b.endpoint?.id??null,
            immediate,status:t.status,error:t.error,read:t.read(),retainedStatus:__gltronCurrentTicket.status}),e=>resolve({error:String(e)}));};})`));
      let afterRetirement;
      try{
        afterRetirement=await evaluate(binding.PAGE_READ);
        const pinned=JSON.parse(fs.readFileSync(out+'/owner-before.json')).apps[0];
        verifyNativeProducer(pinned,afterRetirement.apps[0]);
        save('native-owner-after-retirement.json',{status:'accepted',value:afterRetirement});
      }catch(e){save('native-owner-after-retirement.json',{status:'refused',error:String(e),observation:afterRetirement});}
      // The generic display API may observe a NEW ordinary desktop after
      // detachment. That is not delivery from the retired native producer.
      save('late-capture-after-retirement.json',await evaluate(`(()=>{const p=__gltronCurrentPin;try{const t=p.w.requestCurrentDisplayCapture({hwnd:p.win.hwnd}),a=t.read();
        const result={status:t.status,error:t.error,metadata:a?.metadata,initializedReceipt:a?__nativeInitialized.receipts.some(v=>v.publication===a.metadata.publication):null};
        if(t.status==='pending'){t.cancel();result.status=t.status;}return result;}catch(e){return {status:'refused',error:String(e)};}})()`));
    }
    if(process.env.GLTRON_NATIVE_LOSS==='1'){
      assert(timerMs>0,'context loss requires a future ordinary authored native timer draw');
      await evaluate(`(()=>{const p=__gltronCurrentPin;globalThis.__gltronLifecycle={w:p.w,r:p.r,win:p.win,b:p.w.hostCtx.getGlGpsBridge()};return true;})()`);
      const render=[...workers.values()].filter(w=>!w.closed&&w.url.includes('d3d-render-worker'));assert.equal(render.length,1);
      const at=Date.now(),request=await evaluate('__gltronObserver.loseContexts()',render[0].sessionId);
      save('context-loss-request.json',{at,request,actualExtension:true});
      let loss;
      while(Date.now()-at<3000){
        loss=await evaluate(`(()=>{const {w,r,b,win}=__gltronLifecycle;return {at:Date.now(),error:String(b.workerAsyncError||''),stopped:!!w._stopped,running:w.running,recordPresent:!!r._currentDisplayRecord,recordHasProducer:!!r._currentDisplayRecord?.windows.some(p=>p.window.deref()===win),retainedStatus:__gltronCurrentTicket.status};})()`);
        if(loss.error)break;await sleep(20);
      }
      assert(loss.error,'actual native producer did not report context loss within 3000ms');
      save('context-loss.json',{...loss,elapsedMs:Date.now()-at});
      save('late-capture-after-loss.json',await evaluate(`(()=>{const {w,win}=__gltronLifecycle;try{const t=w.requestCurrentDisplayCapture({hwnd:win.hwnd});return {status:t.status,error:t.error};}catch(e){return {status:'refused',error:String(e)};}})()`));
    }
    if(process.env.GLTRON_NATIVE_SHUTDOWN==='1'){
      const shutdown=await evaluate(`(async()=>{const p=__gltronCurrentPin,w=p.w;let ticket=null;
        if(!w._stopped){await new Promise(resolve=>{const r=p.r,prior=r.beginWorkerGuestSlice;
          r.beginWorkerGuestSlice=function(){r.beginWorkerGuestSlice=prior;prior.apply(this,arguments);
            const t=w.requestCurrentDisplayCapture({hwnd:p.win.hwnd});w.stop({repaint:false});ticket={status:t.status,error:t.error,read:t.read()};resolve();};});}
        const guest=await w._guestRuntimeStopPromise;
        const end=Date.now()+2000;while(!w._renderWorkerRetired&&!w._renderWorkerRetirementError&&Date.now()<end)await new Promise(r=>setTimeout(r,10));
        return {at:Date.now(),kind:'explicit-host-stop',nativeQuit:false,ticket,guest:guest?{ok:guest.ok,error:String(guest.error||'')}:null,
          stopped:!!w._stopped,running:w.running,renderRetired:!!w._renderWorkerRetired,renderError:String(w._renderWorkerRetirementError||'')};})()`);
      save('host-shutdown.json',shutdown);
      const destroyed=w=>closedTargets.some(e=>e.method==='Target.targetDestroyed'&&e.targetId===w.targetId);
      const end=Date.now()+2000;while([...workers.values()].some(w=>!w.closed||!destroyed(w))&&Date.now()<end)await sleep(10);
      save('worker-target-close.json',{at:Date.now(),workers:[...workers.values()].map(w=>({targetId:w.targetId,url:w.url,closed:w.closed})),events:closedTargets});
    }
  }catch(e){failure=e;save('failure.json',{at:Date.now(),error:e.stack,transportClosed:c?.closed??null,originalLaunched:false,noReplay:true});c?.ws.close();}
  finally{
    clearTimeout(captureTimer);
    // A permanently UNKNOWN connection receives no cleanup or later query.
    // OS teardown is independent; all live browser children are still joined.
    if(!failure&&c&&!c.closed)try{await c.send('Browser.close');}catch{}
    c?.ws.close();if(browser){if(browser.exitCode===null&&browser.signalCode===null){const timer=setTimeout(()=>browser.kill('SIGTERM'),3000);await joined;clearTimeout(timer);}else await joined;}
    await Promise.allSettled(tasks);if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}
    save('wire.json',wire);save('workers-after.json',[...workers.values()]);save('target-closures.json',closedTargets);save('requests.json',requests);fs.rmSync(out+'/profile',{recursive:true,force:true});
    save('closure.json',{at:Date.now(),connectionClosed:c?.closed??null,profileAbsent:!fs.existsSync(out+'/profile'),originalLaunched:false,inputs:wire.filter(v=>v.direction==='request'&&v.method?.startsWith('Input.')).length});
  }
  if(failure)throw failure;
}
function characterizeSource(bytes,{width,height}){
  assert.equal(bytes.length,width*height*4);let white=0;
  for(let i=0;i<bytes.length;i+=4)if(bytes[i]===255&&bytes[i+1]===255&&bytes[i+2]===255&&bytes[i+3]===255)white++;
  return {width,height,pixels:width*height,whitePixels:white,allWhite:white===width*height,sourceRGBA_SHA256:sha(bytes),initializedLiteralSceneQualified:false};
}
function verifyObserved(out,{published=false}={}){
  const read=n=>JSON.parse(fs.readFileSync(path.join(out,n),'utf8'));
  const source=read('source.json'),module=read('module.json'),capture=read('capture.json'),retained=read('retained.json'),host=read('host-capture.json'),boundary=read('boundary.json');
  if(published)assert(source.helpers.every(h=>h.published));assert.equal(module.commit,source.commit);
  assert(capture.elapsedMs<3000&&host.elapsedMs<3000);const m=capture.metadata;
  assert.equal(m.observation,'current-display');assert.equal(m.captureOwner.hwnd,65537);assert.equal(m.captureOwner.processId,1000);
  assert(m.requestedAt<=m.readbackStartedAt&&m.displayedAt<=m.readbackStartedAt&&m.readbackStartedAt<=m.readbackCompletedAt&&m.readbackCompletedAt<=capture.completedAt);
  for(const k of ['source','output']){const p=PNG.sync.read(fs.readFileSync(path.join(out,'authored-'+k+'.png')));assert.equal(p.width,m[k].width);assert.equal(p.height,m[k].height);assert.equal(p.data.length,p.width*p.height*4);}
  const p=PNG.sync.read(fs.readFileSync(path.join(out,'authored-source.png'))),scene=characterizeSource(p.data,p);
  assert.equal(retained.mismatch,0);assert.equal(retained.metadataSame,true);assert.equal(retained.status,'complete');assert.equal(retained.cancelComplete,false);
  assert(module.fixture?.timerMs>0 ? retained.currentPublication>=retained.capturedPublication : module.fixture?.drawOnce ? retained.currentPublication===retained.capturedPublication : retained.currentPublication>retained.capturedPublication);
  const literal=read('literal-oracle.json'),literalOutput=read('literal-output-oracle.json');
  assert(literal.qualified&&literal.checked===480*360);assert(literalOutput.qualified&&literalOutput.checked===m.output.width*m.output.height);
  assert(host.totalObservationMs<3000);
  if(fs.existsSync(path.join(out,'producer-retirement.json'))){
    const retired=read('producer-retirement.json'),late=read('late-capture-after-retirement.json');
    assert.equal(retired.immediate.status,'failed');assert.equal(retired.status,'failed');assert.equal(retired.read,null);
    assert.equal(retired.retainedStatus,'complete');assert.equal(retired.endpoint,null);assert(retired.epoch>retired.old.epoch);
    assert.equal(read('native-owner-after-retirement.json').status,'refused');
    if(late.status==='complete'){assert(late.metadata.publication>m.publication);assert.equal(late.initializedReceipt,false);}
    else assert(['failed','refused','cancelled'].includes(late.status));
  }
  if(fs.existsSync(path.join(out,'context-loss.json'))){
    const loss=read('context-loss.json');assert.match(loss.error,/context lost/);assert(loss.elapsedMs<3000);
    assert.equal(loss.recordHasProducer,false);assert.equal(loss.retainedStatus,'complete');
    assert(['failed','refused'].includes(read('late-capture-after-loss.json').status));
  }
  if(fs.existsSync(path.join(out,'host-shutdown.json'))){
    const stop=read('host-shutdown.json'),targets=read('worker-target-close.json');
    assert.equal(stop.nativeQuit,false);assert.equal(stop.guest.ok,true);assert.equal(stop.renderRetired,true);assert.equal(stop.renderError,'');
    if(stop.ticket){assert.equal(stop.ticket.status,'failed');assert.match(stop.ticket.error,/owner stopped/);assert.equal(stop.ticket.read,null);}
    assert(targets.workers.length>=2&&targets.workers.every(w=>w.closed));
    for(const w of targets.workers)assert(targets.events.some(e=>e.method==='Target.targetDestroyed'&&e.targetId===w.targetId));
  }
  assert.equal(boundary.originalPermitted,false);assert.equal(boundary.fullInputQualification,false);
  const requests=read('wire.json').filter(v=>v.direction==='request');assert.equal(requests.filter(v=>v.method.startsWith('Input.')).length,0);
  const wait=read('wait.json'),browser=read('browser-wait.json');for(const w of [wait,browser,...wait.watchdogs]){assert.equal(w.actualWait,true);assert.equal(w.stdoutEOF,true);assert.equal(w.stderrEOF,true);}
  assert.equal(wait.returncode,0);assert.equal(browser.code,0);assert(wait.watchdogs.every(w=>w.returncode===0));assert.deepEqual(wait.remainingAfterRuntime,[]);
  for(const w of read('workers-before.json'))assert(w.scripts.some(s=>s.bytecodeAvailable&&s.sha256===module.sha256));
  return {outcome:'PARTIAL_OBSERVATION_NOT_INPUT_QUALIFICATION',qualified:false,commit:source.commit,module:module.sha256,captureMs:capture.elapsedMs,hostCaptureMs:host.elapsedMs,scene,retainedBytesExact:true,retainedTimestampsExact:true,actualWaits:true,publishedHelpers:published,originalLaunched:false};
}
function verifyPendingNegative(out,{published=false}={}){
  const read=n=>JSON.parse(fs.readFileSync(path.join(out,n),'utf8'));
  const source=read('source.json'),module=read('module.json'),start=read('capture-start.json'),arm=read('capture-arm.json'),failure=read('failure.json'),trace=read('capture-observations.json');
  assert.equal(module.commit,source.commit);assert.equal(source.foreignWIPAdopted,false);
  if(published)assert(source.helpers.every(h=>h.published),'all helpers must be exact published Git bytes');
  assert.equal(start.boundMs,3000);assert.equal(start.noForcedPublication,true);
  assert.match(failure.error,/DISPLAY_UNKNOWN controller current-display deadline; permanent close/);
  assert.equal(failure.originalLaunched,false);assert(failure.at-start.at>=2990&&failure.at-start.at<3200,'timer delivery differs materially from unchanged bound');
  assert.equal(arm.status,'pending');assert.equal(arm.held,true);assert.equal(trace.nonce,arm.nonce);
  assert(trace.observations.length>0);assert(trace.observations.every(o=>o.status==='pending'&&o.publication===arm.publication));
  const workers=read('workers-before.json');assert(workers.some(w=>w.url.includes('guest-worker'))&&workers.some(w=>w.url.includes('d3d-render-worker')));
  for(const w of workers){assert(w.scripts.some(s=>s.bytecodeAvailable&&s.sha256===module.sha256));assert(w.scripts.every(s=>!s.error));}
  const gl=read('actual-gl.json');assert(gl.some(w=>w.observation.draws>0&&w.observation.transfers>0&&w.observation.devices.some(d=>d.width===480&&d.height===360&&/^WebGL/.test(d.version))));
  const wire=read('wire.json'),requests=wire.filter(v=>v.direction==='request');
  assert.equal(requests.filter(v=>v.operation==='current-display-arm').length,1);
  assert.equal(requests.filter(v=>v.at>=failure.at).length,0,'request after permanent close');
  assert.equal(requests.filter(v=>v.method.startsWith('Input.')||v.method==='Page.captureScreenshot').length,0);
  for(const n of ['capture.json','authored-source.png','authored-output.png','authored-host.png'])assert(!fs.existsSync(path.join(out,n)),'no late pixels');
  const browser=read('browser-wait.json'),wait=read('wait.json');
  for(const w of [browser,wait,...wait.watchdogs]){assert.equal(w.actualWait,true);assert.equal(w.stdoutEOF,true);assert.equal(w.stderrEOF,true);}
  assert.equal(wait.returncode,1);assert(wait.watchdogs.every(w=>w.returncode===0));assert.deepEqual(wait.remainingAfterRuntime,[]);
  const closure=read('closure.json');assert.equal(closure.profileAbsent,true);assert.equal(closure.inputs,0);
  return {outcome:'EXPECTED_PENDING_CURRENT_DISPLAY_NEGATIVE',qualified:false,originalLaunched:false,commit:source.commit,module:module.sha256,boundMs:3000,observedFailureMs:failure.at-start.at,publication:arm.publication,firstSlice:arm.slice,lastSlice:trace.observations.at(-1).slice,polls:trace.observations.length,actualWaits:true,pipeEOFObserved:true,publishedHelpers:published};
}
if(require.main===module){const [first,arg]=process.argv.slice(2);if(['--verify-pending','--verify-observed'].includes(first)){console.log(JSON.stringify((first==='--verify-pending'?verifyPendingNegative:verifyObserved)(path.resolve(arg),{published:process.env.GLTRON_VERIFY_PUBLISHED==='1'}),null,2));}else{assert(first&&arg,'explicit supervised OUTPUT and exact COMMIT required');run(path.resolve(first),arg).catch(e=>{console.error(e);process.exitCode=1;});}}
function literalOracle(bytes,{width,height}) {
  assert.equal(width,480);assert.equal(height,360);assert.equal(bytes.length,width*height*4);
  let checked=0,mismatches=0;const colors={};
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=(y*width+x)*4,p=[...bytes.subarray(i,i+4)],key=p.join(',');colors[key]=(colors[key]||0)+1;
    // Independent authored coordinates: (120,270), (360,270), (240,90).
    // Pixel centers never land on these sloping edges at this resolution.
    const half=(y+.5-90)*2/3,left=240-half,right=240+half;
    const inside=y+.5>90&&y+.5<270&&x+.5>left&&x+.5<right;
    const want=inside?[255,255,128,255]:[0,32,64,255];
    checked++;if(p.some((v,j)=>v!==want[j]))mismatches++;
  }
  return {width,height,checked,mismatches,colors,qualified:mismatches===0};
}
function literalOutputOracle(bytes,metadata){
  const {width,height}=metadata.output,v=metadata.presentationViewport;
  assert.equal(bytes.length,width*height*4);assert(v&&metadata.backend==='canvas-nearest');
  let mismatches=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    let want=[0,0,0,255];
    if(x>=v.dstX&&x<v.dstX+v.dstW&&y>=v.dstY&&y<v.dstY+v.dstH){
      const sx=Math.floor((x+.5-v.dstX)*480/v.dstW),sy=Math.floor((y+.5-v.dstY)*360/v.dstH);
      const half=(sy+.5-90)*2/3;
      want=sy+.5>90&&sy+.5<270&&sx+.5>240-half&&sx+.5<240+half?[255,255,128,255]:[0,32,64,255];
    }
    const i=(y*width+x)*4;if(want.some((n,j)=>bytes[i+j]!==n))mismatches++;
  }
  return {width,height,checked:width*height,mismatches,qualified:mismatches===0};
}
// Canvas nearest-neighbour rasterization rounds subpixel source boundaries.
// Use the browser's rasterizer on an independent literal image (no captured
// source pixels), rather than approximating that rounding with JS division.
function canvasLiteralOutputOracle(retained) {
  const {metadata:m,outputRGBA:got}=retained,v=m.presentationViewport;
  if(!v||m.backend!=='canvas-nearest')throw Error('literal canvas oracle needs complete nearest viewport');
  const src=new OffscreenCanvas(480,360),s=src.getContext('2d'),image=s.createImageData(480,360);
  for(let y=0;y<360;y++)for(let x=0;x<480;x++){
    const half=(y+.5-90)*2/3,inside=y+.5>90&&y+.5<270&&x+.5>240-half&&x+.5<240+half;
    image.data.set(inside?[255,255,128,255]:[0,32,64,255],(y*480+x)*4);
  }
  s.putImageData(image,0,0);
  const out=new OffscreenCanvas(m.output.width,m.output.height),ctx=out.getContext('2d');
  ctx.fillStyle='#000';ctx.fillRect(0,0,out.width,out.height);ctx.imageSmoothingEnabled=false;
  ctx.drawImage(src,0,0,480,360,v.dstX,v.dstY,v.dstW,v.dstH);
  const want=ctx.getImageData(0,0,out.width,out.height).data;let mismatches=0;
  for(let i=0;i<want.length;i+=4)if(want[i]!==got[i]||want[i+1]!==got[i+1]||want[i+2]!==got[i+2]||want[i+3]!==got[i+3])mismatches++;
  return {width:out.width,height:out.height,checked:out.width*out.height,mismatches,qualified:mismatches===0,oracle:'independent literal raster through browser Canvas2D nearest'};
}
function verifyNativeProducer(pinned,observed){
  assert(pinned&&pinned.renderEndpoint!=='none','initialized native producer required');
  // PAGE_READ is an inspector and can truthfully return renderEndpoint:none.
  // A native delivery must still match its previously pinned producer.
  for(const field of ['renderEndpoint','renderEndpointObject','renderApi','renderBridgeObject','renderGeneration']){
    assert(pinned[field]!==undefined,'missing native producer '+field);
    assert.equal(observed?.[field],pinned[field],'native producer identity changed: '+field);
  }
}
module.exports={fixture,run,verifyPendingNegative,verifyObserved,characterizeSource,literalOracle,literalOutputOracle,installInitializedObserver,verifyNativeProducer};
