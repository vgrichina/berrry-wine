'use strict';
// Immutable Git source and ordinary registered media. Inventory the instantiated
// modules only after the observation interval: enabling Debugger during startup
// changes V8's WebAssembly execution tier. Never inspect a closed UNKNOWN scope.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),vm=require('node:vm');
const assert=require('node:assert/strict');
const {gitFiles}=require('./boids-current-runtime.cjs');
const {InspectionScope,connectInspector,readInspectionState,readInspectionReadiness,inspectWholePage}=require('./inspection-window.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function observer(root,name){
  const p=root[name].Executor.prototype,execute=p.execute;
  const row={executor:name,counts:{},completed:[]};(root.__rmExecutors||(root.__rmExecutors={}))[name]=row;
  p.execute=function(rec){const result=execute.call(this,rec);row.counts[rec.name]=(row.counts[rec.name]||0)+1;
    if(rec.name==='PRESENT'){let context=null;if(this.gl){const gl=this.gl,e=gl.getExtension('WEBGL_debug_renderer_info');context={version:gl.getParameter(gl.VERSION),renderer:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};}
      row.completed.push({at:Date.now(),seq:rec.seq,stats:this.stats(),context});if(row.completed.length>2)row.completed.shift();}return result;};
}
// Read-only facts through the existing native route; no execution/repaint.
// A missing presenter is unknown, never evidence of zero completed PRESENT.
async function readStartupObservation(){
  const apps=typeof runningApps==='undefined'?[]:runningApps;
  return {at:Date.now(),apps:await Promise.all(apps.map(async a=>{
    const w=a.wine,r=w?.renderer,b=w?.hostCtx?.d3dimBridge;
    // One existing read-only rendezvous; all getters run together on the owner.
    // No continuation issues a second request if this read outlives closure.
    // Only the existing audited reservation-safe getter set. Focus is already
    // carried by normal slice replies; modal identity has no safe public read.
    const names=['get_eip','get_yield_reason','get_steps'];
    const native=w?.guestWorker?.readExports?await w.guestWorker.readExports(names):null;
    const get=(e,n)=>{try{return typeof e?.[n]==='function'?e[n]():null;}catch{return null;}};
    const wins=Object.values(r?.windows||{}),visible=wins.filter(v=>v.visible&&!v.isChild);
    const display=r?._currentDisplayRecord;
    const windows=wins.map(v=>{const e=(v.wasm||w?.instance)?.exports;return {
      hwnd:v.hwnd,processId:v.processId??null,title:v.title??null,className:v.className??null,
      visible:!!v.visible,isChild:!!v.isChild,isDialog:v.isDialog??null,
      nativeOwnerHwnd:typeof e?.wnd_get_owner==='function'?e.wnd_get_owner(v.hwnd):null,
      focusHwnd:native?(w._workerFocusHwnd??null):get(e,'get_focus_hwnd'),
      focusSource:native?'last ordinary owning-worker slice reply; age unknown':'page instance getter',
      modalHwnd:native?null:get(e,'modal_dialog_hwnd'),
      dialogHwnd:native?null:get(e,'dialogbox_hwnd'),
      composed:display?.windows?display.windows.some(p=>p.window.deref()===v):null};});
    const completedPRESENT=typeof b?.presenter?.presents==='number'?b.presenter.presents:null;
    const composed=display?.windows?visible.length===1&&display.windows.some(p=>p.window.deref()===visible[0]):null;
    const failed=!!(w?._stopped||w?.running===false||b?.workerAsyncError||b?.workerClosing);
    return {name:a.name,processId:w?.processId??null,running:w?.running??null,failed,
      completedPRESENT,composed,visibleTopLevelCount:visible.length,windows,
      ready:!failed&&visible.length===1&&completedPRESENT>0&&composed===true,
      execution:{guestEndpoint:w?.guestWorker?.link?.endpointIdentity??null,
        source:native?'owning guestWorker.readExports':'page instance getters',
        eip:native?.get_eip??null,yieldReason:native?.get_yield_reason??null,
        remainingSliceSteps:native?.get_steps??null,modalYield:native?native.get_yield_reason===6:null,
        api:null,loadingComplete:null,reason:'Modal HWND, API and loading completion not exposed by reservation-safe route; console/HTTP progress retained separately'},
      stream:{records:b?.stats?.records??null,deviceRecords:b?.device?.stats?.records??null,
        workerEpoch:b?.workerEpoch??null,endpointId:b?.endpoint?.id??null},
      errors:{workerAsyncError:b?.workerAsyncError?String(b.workerAsyncError):null,workerClosing:b?.workerClosing??null}};
  }))};
}
function startupPage(page,rows,active,onRow=async()=>{}){
  return {evaluate:async(fn,...args)=>{
    assert(active(),'closed startup observer cannot query endpoint');
    if(fn!==readInspectionReadiness)return page.evaluate(fn,...args);
    const row=await page.evaluate(readStartupObservation);
    if(!active())return false;
    if(rows.length<160)rows.push(row);
    if(active())await onRow(row);
    if(row.apps.some(a=>a.failed))throw Error('failed native inspection owner');
    return row.apps.length===1&&row.apps.every(a=>a.ready);
  }};
}
async function inventory(session,target){
  const modules=[],tasks=[];
  const parsed=e=>{if(e.scriptLanguage!=='WebAssembly'&&!e.url.startsWith('wasm:'))return;
    tasks.push(session.send('Debugger.getScriptSource',{scriptId:e.scriptId}).then(r=>{assert(r.bytecode,'missing actual module bytes');const b=Buffer.from(r.bytecode,'base64');modules.push({target,scriptId:e.scriptId,sha256:sha(b),size:b.length});}));};
  session.on('Debugger.scriptParsed',parsed);
  try{await session.send('Debugger.enable');await Promise.all(tasks);return modules;}
  finally{session.off('Debugger.scriptParsed',parsed);await session.send('Debugger.disable');}
}
async function finiteCapture(scope){
  let timer;
  const page={};for(const method of ['evaluate','screenshot'])page[method]=(...args)=>{
    assert.equal(scope.phase,'bound','closed capture cannot issue another endpoint request');return scope.page[method](...args);};
  try{return await Promise.race([inspectWholePage(page,scope.baseline),new Promise((_,reject)=>{timer=setTimeout(()=>{scope.phase='closed';reject(Error('whole-frame capture timeout'));},3000);})]);}
  catch(e){scope.phase='closed';throw e;}
  finally{clearTimeout(timer);}
}
async function run({out,commit,modulePath,backend,fixture,earlyDebugger=false,delays=[15000,15000],appName='scr_rockroll',startupObservations=false,presentationObservation=false}){
  assert(['software','webgl'].includes(backend));assert(!earlyDebugger||fixture,'early debugger is authored-only');
  assert(!fs.existsSync(out),'fresh scope directory required');fs.mkdirSync(out,{recursive:true});
  const save=(n,v)=>fs.writeFileSync(path.join(out,n),JSON.stringify(v,null,2)+'\n');
  const root=path.resolve(__dirname,'..'),files=gitFiles(commit),module=fs.readFileSync(modulePath);
  const registry={module:{exports:{}},require:n=>{assert.equal(n,'./app-file-sizes.generated.js');const c={module:{exports:{}}};vm.runInNewContext(files.get('lib/app-file-sizes.generated.js').toString(),c);return c.module.exports;},URL,console};
  vm.runInNewContext(files.get('lib/apps.js').toString(),registry);const app=registry.module.exports.APPS[appName];assert(app);
  const pins=[...files].map(([path,b])=>({path,size:b.length,sha256:sha(b)}));
  const media=[...new Set([app.exe,...app.files.map(f=>f.url),'binaries/dlls/d3drm.dll','binaries/dlls/d3dxof.dll','binaries/dlls/oleaut32.dll'])].map(n=>{const b=fs.readFileSync(path.join(root,n));files.set(n,b);return {path:n,size:b.length,sha256:sha(b)};});
  files.set('build/wine-assembly.wasm',module);
  const patches=[];
  for(const [n,api]of [['lib/gpu-stream-webgl.js','GpuStreamWebGL'],['lib/gpu-stream-software.js','GpuStreamSoftware']]){const old=files.get(n),suffix='\n;('+observer.toString()+')(globalThis,'+JSON.stringify(api)+');\n';files.set(n,Buffer.concat([old,Buffer.from(suffix)]));patches.push({path:n,baseSHA256:sha(old),sha256:sha(files.get(n)),suffix});}
  if(fixture)files.set(app.exe,fs.readFileSync(fixture));
  const pathObserver=presentationObservation?require('./oasaver-presentation-observer.cjs'):null;
  if(pathObserver)for(const n of ['lib/guest-worker.js','lib/d3d-render-worker.js']){
    const old=files.get(n);files.set(n,Buffer.concat([Buffer.from(pathObserver.prefix),old]));
    patches.push({path:n,baseSHA256:sha(old),sha256:sha(files.get(n)),prefix:pathObserver.prefix});
  }
  save('pins-before.json',{commit,pins,media,app,module:{existingPath:modulePath,sha256:sha(module)},fixture:fixture?{path:fixture,sha256:sha(fs.readFileSync(fixture))}:null,patches});
  let server,browser,scope,closedUnknown=false;
  const requests=[],logs=[],errors=[],sessions=[],moduleReceipts=[],tasks=[],startupRows=[],pathRows=[];
  const terminal={backend,commit,original:!fixture,earlyDebugger,startedAt:new Date().toISOString(),state:'PREPARING',inputs:0};
  const watchTarget=async target=>{if(closedUnknown||!['page','other'].includes(target.type()))return;
    const session=await target.createCDPSession();sessions.push({session,target});
    if(closedUnknown)return;
    // Runtime inspection does not switch Wasm into debugger execution mode.
    await session.send('Runtime.enable');
    if(earlyDebugger){session.on('Debugger.scriptParsed',e=>{if(!closedUnknown&&e.scriptLanguage==='WebAssembly')tasks.push(session.send('Debugger.getScriptSource',{scriptId:e.scriptId}).then(r=>moduleReceipts.push({target:target.url(),sha256:sha(Buffer.from(r.bytecode,'base64'))})));});await session.send('Debugger.enable');}
  };
  try{
    server=http.createServer((req,res)=>{const n=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'index.html';let b=files.get(n);
      if(!b&&/^(fonts|icons|images)\/[\w./-]+$/.test(n)&&!n.includes('..')){try{b=fs.readFileSync(path.join(root,n));files.set(n,b);}catch{}}
      requests.push({at:Date.now(),path:n,status:b?200:404,sha256:b?sha(b):null});res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':n.endsWith('.wasm')?'application/wasm':n.endsWith('.html')?'text/html':'application/octet-stream');res.statusCode=b?200:404;res.end(b||'not found');});
    await new Promise(r=>server.listen(0,'127.0.0.1',r));save('server.json',{port:server.address().port});
    browser=await require('puppeteer').launch({executablePath:'/opt/google/chrome/chrome',headless:true,defaultViewport:{width:1280,height:960},protocolTimeout:20000,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--window-size=1280,960']});
    save('browser.json',{pid:browser.process().pid,args:browser.process().spawnargs,version:await browser.version()});
    browser.on('targetcreated',t=>{const p=watchTarget(t);tasks.push(p);p.catch(e=>errors.push(String(e)));});
    const page=(await browser.pages())[0];await watchTarget(page.target());
    if(pathObserver)await page.evaluateOnNewDocument(pathObserver.install);
    page.on('console',m=>logs.push({at:Date.now(),type:m.type(),text:m.text()}));page.on('pageerror',e=>errors.push(String(e)));
    await page.evaluateOnNewDocument(()=>{globalThis.__rmInputs=[];for(const type of ['keydown','keyup','pointerdown','pointerup'])document.addEventListener(type,e=>__rmInputs.push({type,trusted:e.isTrusted}),true);});
    terminal.url='http://127.0.0.1:'+server.address().port+'/index.html?app='+appName+'&threads&d3d-renderer='+backend;
    await page.goto(terminal.url,{waitUntil:'domcontentloaded',timeout:20000});
    // Same entry condition as the predecessor: visible native window, composed
    // desktop and an existing stream with at least one decoded record.
    const readyEnd=Date.now()+300000;
    // Authored controls admit from navigation, exercising the complete native
    // startup workload rather than excluding it behind the desktop checkpoint.
    while(!fixture&&Date.now()<readyEnd){const ready=await page.evaluate(name=>{
      const a=typeof runningApps==='undefined'?null:runningApps.find(a=>a.name===name),w=a?.wine,r=w?.renderer,b=w?.hostCtx?.d3dimBridge;
      if(w?._stopped||w?.running===false||b?.workerAsyncError||b?.workerClosing)throw Error('failed startup owner');
      const wins=Object.values(r?.windows||{}).filter(v=>v.visible&&!v.isChild);
      return {device:wins.length===1&&!!w.guestWorker&&!!b?.device&&((b.device.stats?.records||0)>0||b.stats.records>0),display:r?._currentDisplayRecord?.windows?.some(p=>p.window.deref()===wins[0])};
    },appName);if(ready.device&&(fixture||ready.display))break;await sleep(20);}
    assert(Date.now()<readyEnd,'startup owner deadline');
    terminal.bindStartedAt=Date.now();let initialCaptured=false;
    const active=()=>!closedUnknown&&scope.phase!=='closed';
    const passivePage={};for(const n of ['evaluate','screenshot'])passivePage[n]=(...args)=>{assert(active(),'closed initial UI capture cannot query endpoint');return page[n](...args);};
    scope=new InspectionScope(startupObservations?startupPage(page,startupRows,active,async row=>{
      if(pathObserver){
        const evidence={at:Date.now(),page:null,realms:[]};
        if(!active())return;
        evidence.page=await page.evaluate(pathObserver.readPage);
        for(const {session,target}of sessions){
          if(!active())return;
          const r=await session.send('Runtime.evaluate',{expression:'JSON.stringify({native:globalThis.__oaPresentation||null,executors:globalThis.__rmExecutors||null})',returnByValue:true});
          if(!active())return;
          evidence.realms.push({target:target.url(),observation:r.result?.value?JSON.parse(r.result.value):null});
        }
        if(active()&&pathRows.length<160)pathRows.push(evidence);
      }
      if(initialCaptured||Date.now()-terminal.bindStartedAt<2000||!row.apps.some(a=>a.visibleTopLevelCount))return;
      initialCaptured=true;
      // Observation only: this geometry is never admitted as an input baseline.
      const before=await passivePage.evaluate(readInspectionState);
      const png=await passivePage.screenshot({type:'png',fullPage:false,captureBeyondViewport:false});
      const after=await passivePage.evaluate(readInspectionState);
      const safe=JSON.stringify(before)===JSON.stringify(after);
      save('initial-native-ui.json',{at:Date.now(),before,after,safe,inputAdmitted:false,
        reason:safe?null:'Startup geometry/owner changed during diagnostic capture; image omitted'});
      if(safe){const image=require('pngjs').PNG.sync.read(png);
        assert.equal(image.width,Math.round(before.viewport.width*before.viewport.dpr));
        assert.equal(image.height,Math.round(before.viewport.height*before.viewport.dpr));
        fs.writeFileSync(path.join(out,'initial-native-ui.png'),png);}
    }):page);
    const bound=await scope.bind();save('startup-stabilization.json',bound);terminal.bindMs=Date.now()-terminal.bindStartedAt;terminal.state='BOUND';
    scope.page=page;
    const inspector=await connectInspector('http://127.0.0.1:'+new URL(browser.wsEndpoint()).port);
    try{const other=(await inspector.pages()).find(p=>p.url()===page.url());assert(other);await scope.check(other);save('inspection-attachment.json',{defaultViewport:null,baseline:scope.baseline,observed:await other.evaluate(readInspectionState)});}
    finally{await inspector.disconnect();}
    await scope.check();
    for(let i=0;i<delays.length;i++){
      await sleep(delays[i]);const result=await finiteCapture(scope);
      fs.writeFileSync(path.join(out,'whole-'+i+'.png'),result.png);save('capture-'+i+'.json',{before:result.before,after:result.after,width:result.width,height:result.height,at:Date.now()});
      const traces=[];for(const {session,target}of sessions){const r=await session.send('Runtime.evaluate',{expression:'JSON.stringify(globalThis.__rmExecutors||null)',returnByValue:true});if(r.result?.value)for(const trace of Object.values(JSON.parse(r.result.value)||{}))traces.push({target:target.url(),trace});}save('executors-'+i+'.json',traces);
    }
    await scope.check();save('inputs.json',await page.evaluate(()=>__rmInputs));
    // Completed interval first; no debugger tier changes within startup/motion.
    for(const {session,target}of sessions)moduleReceipts.push(...await inventory(session,target.url()));
    terminal.state='OBSERVED';
  }catch(e){closedUnknown=true;terminal.state='UNKNOWN_CLOSED';terminal.error=String(e);terminal.observations=e.observations||null;terminal.failedAt=Date.now();}
  finally{
    // A closed scope permits lifecycle cleanup only, never endpoint queries.
    terminal.noEndpointQueriesAfterUnknown=closedUnknown;
    if(browser){const p=browser.process(),wait=new Promise(r=>{if(p.exitCode!==null)r({pid:p.pid,exit:p.exitCode});else p.once('close',(exit,signal)=>r({pid:p.pid,exit,signal}));});await browser.close();terminal.browserWait=await wait;}
    if(server)await new Promise(r=>server.close(r));await Promise.allSettled(tasks);
    save('requests.json',requests);save('console.json',logs);save('errors.json',errors);save('modules.json',moduleReceipts);
    save('startup-progress.json',{rows:startupRows,limit:160,passive:true,unknowns:'API and loading completion not exposed; see timestamped console and HTTP progress separately'});
    if(pathObserver)save('presentation-path.json',{rows:pathRows,limit:160,passive:true,extraNativeCalls:0,debuggerDuringStartup:false});
    save('pins-after.json',media.map(p=>({...p,sha256After:sha(fs.readFileSync(path.join(root,p.path)))})));
    terminal.finishedAt=new Date().toISOString();save('terminal.json',terminal);
  }
  return terminal;
}
module.exports={run,inventory,finiteCapture,readStartupObservation,startupPage};
if(require.main===module){const [out,commit,modulePath,backend,fixture,early]=process.argv.slice(2);run({out,commit,modulePath,backend,fixture,earlyDebugger:early==='early',delays:fixture?[0]:undefined}).then(t=>{process.exitCode=t.state==='OBSERVED'?0:1;},e=>{console.error(e);process.exitCode=1;});}
