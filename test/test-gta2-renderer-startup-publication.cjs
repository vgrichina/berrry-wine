'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {test}=require('node:test'),vm=require('node:vm'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');

function startupPE(variant='delayed-d3d'){
  const previous=require('./test-gta2-native-user-readiness.cjs');
  if(variant==='gdi')return previous.startupPE('delayed-user');
  if(variant!=='delayed-d3d')return previous.startupPE(variant);
  assert.equal(variant,'delayed-d3d');
  // Independently authored public DDraw/D3D7 COM calls, after real healthy
  // USER creation and Sleep. No production methods/exports are injected.
  const b=previous.startupPE('delayed-user'),base=0x400000,raw=r=>r-0x1000+0x400;
  const dw=(r,v)=>b.writeUInt32LE(v>>>0,raw(r));
  dw(0x1028,0x1400);dw(0x1034,0x1d00);dw(0x1038,0x1400);
  b.write('ddraw.dll\0',raw(0x1d00));dw(0x1400,0x1d40);b.write('DirectDrawCreateEx\0',raw(0x1d42));
  // The original USER fixture's import directory now contains three entries.
  b.writeUInt32LE(80,0x80+24+108);
  for(const [r,words] of [[0x2900,[0x15e65ec0,0x11d23b9c,0x60002fb9,0x5bea9797]],
    [0x2920,[0xf5049e77,0x11d24861,0xa00007a4,0xa82906c9]],
    [0x2940,[0x84e63de0,0x11cf46aa,0x00006f81,0x6e1520c0]]])words.forEach((v,i)=>dw(r+4*i,v));
  for(const [off,v] of [[0,124],[4,0x1007],[8,64],[12,64],[72,32],[76,0x40],[84,32],
    [88,0xff0000],[92,0xff00],[96,0xff],[104,0x2840]])dw(0x2980+off,v);
  [[8,8],[56,8],[8,56]].forEach(([x,y],i)=>{
    for(const [j,v]of [x,y,.5,1].entries())b.writeFloatLE(v,raw(0x2b00+i*32+j*4));
    dw(0x2b00+i*32+16,0xff32cc55);
  });
  b.write('Native D3D draw completed\0',raw(0x2bc0));
  b.write('Native D3D HRESULT failure\0',raw(0x2bf0));
  // Add public SetWindowTextA and OutputDebugStringA to free IAT slots.
  dw(0x1324,0x1dc0);b.write('SetWindowTextA\0',raw(0x1dc2));
  dw(0x1208,0x1e00);b.write('OutputDebugStringA\0',raw(0x1e02));
  const code=[],fixups=[],u=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24&255];
  const emit=(...a)=>code.push(...a.flat()),push=v=>Array.isArray(v)?emit(0xff,0x35,u(base+v[0])):emit(0x68,u(v));
  const call=r=>emit(0xff,0x15,u(base+r));
  const check=()=>{emit(0x85,0xc0,0x0f,0x88);fixups.push(code.length);emit(0,0,0,0);};
  const com=(obj,slot,args)=>{for(const a of [...args].reverse())push(a);
    emit(0xa1,u(base+obj),0x50,0x8b,0x08,0xff,0x91,u(slot*4));check();};
  push(650);call(0x1200);
  for(const a of [0,base+0x2900,base+0x2c00,0])push(a);call(0x1400);check();
  com(0x2c00,20,[[0x3240],8]);
  com(0x2c00,6,[base+0x2980,base+0x2c04,0]);
  com(0x2c00,0,[base+0x2920,base+0x2c08]);
  com(0x2c08,4,[base+0x2940,[0x2c04],base+0x2c0c]);
  com(0x2c0c,20,[22,1]); // D3DRS_CULLMODE NONE
  com(0x2c0c,5,[]);
  com(0x2c0c,25,[4,0x1c4,base+0x2b00,3,0]);
  com(0x2c0c,6,[]); // Ordinary native EndScene/fence publishes the renderer.
  push(base+0x2bc0);call(0x1208);
  push(base+0x2bc0);push([0x3240]);call(0x1324);
  emit(0xc3);
  const failure=code.length;push(base+0x2bf0);call(0x1208);push(71);call(0x1204);emit(0xcc);
  for(const at of fixups){const v=failure-at-4;code.splice(at,4,...u(v));}
  assert(code.length<0x400);Buffer.from(code).copy(b,raw(0x2d00));
  // Locate the authored USER fixture's message-pump entry and insert one
  // CALL, preserving its existing relative branches by moving none of it.
  const needle=Buffer.from([0x68,0,0,0,0,0x68,0,0,0,0,0x68,0,0,0,0,0x68,...u(base+0x3280)]);
  const at=b.indexOf(needle,raw(0x2000));assert(at>=0&&at<raw(0x2600));
  const end=b.indexOf(Buffer.from([0xff,0x15,...u(base+0x1204),0xcc]),at)+7;
  assert(end>at&&end<raw(0x2600)-5);
  const tail=Buffer.from(b.subarray(at,end));
  // Startup code's message-pump branches are internal to this shifted tail.
  tail.copy(b,at+5);b[at]=0xe8;b.writeInt32LE(raw(0x2d00)-at-5,at+1);
  return b;
}

function nativeGate(out){
  assert(path.isAbsolute(out));
  const watch=JSON.parse(fs.readFileSync(path.join(out,'..','watchdog-armed.json')));
  const launch=JSON.parse(fs.readFileSync(path.join(out,'..','launch.json')));
  assert(watch.independent&&watch.deadline*1000>Date.now()&&launch.deadline*1000>Date.now());
  process.kill(watch.pid,0);
  assert(process.env.GTA2_FROZEN_MODULE_SHA256,'exact frozen module required');
  assert(globalThis.__gta2ImmutableVerifiedViewV1,'sealed Git view required');
}

function modelControls(){
  const binding=require('../tools/gta2-browser-release-binding.cjs');
  const fixture=require('./test-gta2-native-user-readiness.cjs');
  function page(required){
    const a=fixture.authoredPublicExports(),memory={buffer:new SharedArrayBuffer(8)},module={};
    const wine={running:true,processId:1000,_processObject:{},instance:{exports:a.ex},memory,_wasmModule:module,
      renderer:{canvas:{},inputQueue:[],_physicalKeys:{},handleKeyDown(){},handleKeyUp(){},handleKeyPress(){}}};
    const worker={},link={worker,endpointIdentity:7},guest={link};wine.guestWorker=guest;
    const context={runningApps:[{name:'authored',wine}],document:{getElementById:()=>null},Atomics,
      readNative:()=>binding.nativeContext(a.ex,true)};
    const observer=vm.runInNewContext('('+binding.userStartupObserver.toString()+')(readNative,'+
      JSON.stringify({app:'authored',cpu:'page',backend:'software',rendererRequired:required})+')',context);
    function create(){
      const manager={options:{module,memory},worker:{},ports:new Map()};
      const port={id:23,manager,options:{backend:'software'}};manager.ports.set(23,port);
      wine._renderWorkerManager=manager;link._renderLegacyEndpoint=port;
      link._renderLegacyControl=new Int32Array(new SharedArrayBuffer(64));Atomics.store(link._renderLegacyControl,0,1);
      return {manager,port};
    }
    return {observer,wine,link,guest,create,context};
  }
  const p=page(true);assert.equal(p.observer.sample().healthy,false);
  assert.equal(Object.hasOwn(p.context,'__gta2NativeReleasePageV1'),false);
  p.create();assert.equal(p.observer.sample().healthy,true);
  const g=page(false);assert.equal(g.observer.sample().healthy,true);assert.equal(g.observer.sample().renderer.endpoint,'none');
  for(const fault of ['manager','worker','module','memory','port','id','backend','wrongowner','closed','failed','ambiguous','control-error','retired']){
    const f=page(true);const {manager,port}=f.create();assert(f.observer.sample().healthy);
    if(fault==='manager')f.wine._renderWorkerManager={...manager};
    if(fault==='worker')manager.worker={};
    if(fault==='module')manager.options.module={};
    if(fault==='memory')manager.options.memory={};
    if(fault==='port')manager.ports.set(23,{...port});
    if(fault==='id')port.id++;
    if(fault==='backend')port.options.backend='webgl';
    if(fault==='wrongowner')f.guest.d3dStats={renderEndpointId:24};
    if(fault==='closed')port.closed=true;
    if(fault==='failed')manager._failure=Error('authored');
    if(fault==='ambiguous')manager.ports.set(24,{...port,id:24});
    if(fault==='control-error')Atomics.store(f.link._renderLegacyControl,2,1);
    if(fault==='retired')f.wine._renderWorkerRetired=true;
    assert.throws(()=>f.observer.sample(),/UNSENT/,fault);
  }
  const entry={generation:9,options:{backend:'software'},control:new Int32Array(new SharedArrayBuffer(64))};
  Atomics.store(entry.control,0,1);
  const c={sharedMode:true,instance:{},memory:{buffer:new SharedArrayBuffer(8)},stopping:false,
    retirementError:null,endpoints:new Map([[23,entry]]),Atomics};
  const observer=vm.runInNewContext('('+binding.rendererStartupObserver.toString()+')({endpoint:23,backend:"software"})',c);
  assert(observer.sample().healthy);entry.generation++;assert.throws(()=>observer.sample(),/generation/);
  return {state:'PASS',gdiHealthy:true,delayedRendererUNSENT:true,terminalPageFaults:13,renderGenerationRefused:true};
}

if(require.main===module){
  if(process.argv[2]==='--models')console.log(JSON.stringify(modelControls()));
  else if(process.argv[2]==='--focused')focused(path.resolve(process.argv[3]))
    .catch(error=>{console.error(error);process.exitCode=1;});
  else if(process.argv[2]==='--original-software')originalSoftware(path.resolve(process.argv[3]),path.resolve(process.argv[4])).catch(error=>{console.error(error);process.exitCode=1;});
  else if(process.argv[2]==='--native-plan')nativePlan(path.resolve(process.argv[3])).catch(error=>{console.error(error);process.exitCode=1;});
  else if(process.argv[2]==='--native')nativeStartupFixture(path.resolve(process.argv[3]),process.argv[4],process.argv[5],process.argv[6],process.argv[7])
    .catch(error=>{console.error(error);process.exitCode=1;});
  else test('renderer startup models retain delayed publication and strict identities',modelControls);
}
async function nativeStartupFixture(out,mode,variant,phase,postFault=null) {
  nativeGate(out);
  assert(['main','worker'].includes(mode));assert(['before','after'].includes(phase));
  const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
  const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
  const {inspectUser}=require('./test-gta2-native-user-readiness.cjs');
  const native=require('../tools/gta2-browser-release-binding.cjs');
  const controller=require('../tools/gta2-paired-controller.cjs');
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  fs.mkdirSync(out,{recursive:true});
  const record=(name,value)=>fs.writeFileSync(path.join(out,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
  const append=(name,value)=>fs.appendFileSync(path.join(out,name),JSON.stringify(value)+'\n');
  const fixtureDir=path.join(root,'test/binaries/gta2-renderer-startup-20261116');
  fs.mkdirSync(fixtureDir,{recursive:true});
  const bytes=startupPE(variant),fixture=path.join(fixtureDir,variant+'-'+sha(bytes).slice(0,12)+'.exe');
  if(fs.existsSync(fixture))assert(fs.readFileSync(fixture).equals(bytes),'exact authored fixture bytes');
  else fs.writeFileSync(fixture,bytes,{flag:'wx'});
  const files=['tools/gta2-browser-release-binding.cjs','tools/gta2-paired-controller.cjs',
    'test/test-gta2-renderer-startup-publication.cjs','host.js','lib/guest-worker.js','lib/guest-thread-host.js','build/wine-assembly.wasm'];
  record('provenance.json',{head:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
    frozenSourceHead:process.env.GTA2_VIEW_HEAD??null,mode,variant,phase,fixturePath:path.relative(root,fixture),fixtureSHA256:sha(bytes),
    files:files.map(p=>({path:p,sha256:sha(fs.readFileSync(path.join(root,p)))}))});
  let server,browser,joined,c,session,controlTask; const workers=new Map(),tasks=[],http=[];
  let wireInputs=0,captures=0,wireSequence=0;
  const app='authored_user_readiness';
  const evaluate=(expression,s=session)=>native.evaluate(c,s,expression);
  try {
    const staticServer=require('./static-server.js');
    server=await staticServer.startStaticServer({root,crossOriginIsolated:true,
      rewritePath:p=>p.startsWith('/binaries/')?'/test'+p:p,
      handleRequest:async(req,res)=>{
        const name=new URL(req.url,'http://127.0.0.1').pathname;
        if(!process.env.GTA2_VIEW_HEAD||!/\.(?:js|html|json|css|wat|watx)$/.test(name))return false;
        const resolved=await staticServer.resolveStaticPath(root,req.url);if(resolved.status!==200)return false;
        // The sealed source-view preload supplies exact HEAD plus whole owned
        // files through this synchronous read; ordinary file streams bypass it.
        const body=fs.readFileSync(resolved.file);
        res.writeHead(200,{'Content-Type':staticServer.mimeType(resolved.file),'Cache-Control':'no-store'});
        res.end(body);return true;
      }});
    server.prependListener('request',(req,res)=>{
      const digest=crypto.createHash('sha256');let size=0;
      const write=res.write,end=res.end;
      const consume=b=>{if(b){const bytes=Buffer.isBuffer(b)?b:Buffer.from(b);digest.update(bytes);size+=bytes.length;}};
      res.write=function(b){consume(b);return write.apply(this,arguments);};
      res.end=function(b){consume(b);return end.apply(this,arguments);};
      res.once('finish',()=>{const row={url:req.url,status:res.statusCode,size,sha256:digest.digest('hex')};
        http.push(row);append('http.log',row);});
    });
    browser=cp.spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--no-first-run',
      '--no-default-browser-check','--disable-dev-shm-usage','--enable-unsafe-swiftshader',
      '--window-size=1024,900','--remote-debugging-port=0','--user-data-dir='+out+'/profile','about:blank'],
      {stdio:['ignore','pipe','pipe']});
    const stdout=[],stderr=[];browser.stdout.on('data',b=>stdout.push(b));browser.stderr.on('data',b=>stderr.push(b));
    joined=new Promise(resolve=>browser.once('close',(code,signal)=>{
      fs.writeFileSync(path.join(out,'chrome.stdout'),Buffer.concat(stdout));fs.writeFileSync(path.join(out,'chrome.stderr'),Buffer.concat(stderr));
      record('chrome-wait.json',{pid:browser.pid,code,signal,actualWait:true,
        stdoutEOF:browser.stdout.readableEnded,stderrEOF:browser.stderr.readableEnded});resolve();
    }));
    record('chrome-pid.json',{pid:browser.pid});
    let url;const connectionDue=Date.now()+3000;
    while(!(url=controller.devtoolsEndpoint(out+'/profile/DevToolsActivePort'))){
      assert(Date.now()<connectionDue,'browser launch bounded');assert.equal(browser.exitCode,null);await pause(20);
    }
    c=controller.connection(url,value=>record('UNKNOWN.json',{...value,lastWireSequence:wireSequence}));
    c.protocol=value=>{
      if(value.event==='sent')wireSequence++;
      append('protocol.log',{...value,wireSequence});
    };
    await c.ready;
    const send=c.send;
    c.send=(method,params={},sid)=>{
      if(c.closed)return send(method,params,sid); // local refusal is not a wire request
      if(method.startsWith('Input.'))wireInputs++;
      if(method==='Page.captureScreenshot')captures++;
      append('requests.log',{method,session:sid??null,at:Date.now(),
        startupCommit:method==='Runtime.callFunctionOn'&&params.functionDeclaration?.includes('this.commit')===true,
        startupSample:method==='Runtime.callFunctionOn'&&params.functionDeclaration?.includes('this.sample')===true});
      return send(method,params,sid);
    };
    c.event=value=>{
      if(value.method==='Runtime.consoleAPICalled')append('console.log',{session:value.sessionId,
        type:value.params.type,text:value.params.args.map(a=>a.value??a.description??'').join(' ')});
      if(value.method==='Runtime.exceptionThrown')append('exceptions.log',value);
      if(value.method==='Target.attachedToTarget'&&value.params.targetInfo.type==='worker'){
        const {sessionId,targetInfo}=value.params;workers.set(sessionId,{sessionId,targetId:targetInfo.targetId,...targetInfo,closed:false,scripts:[]});
        const task=(async()=>{await c.send('Runtime.enable',{},sessionId);if(postFault==='metadata')await c.send('Debugger.enable',{},sessionId);await c.send('Runtime.runIfWaitingForDebugger',{},sessionId);})();
        tasks.push(task);task.catch(()=>{});
      }
      if(postFault==='metadata'&&value.method==='Debugger.scriptParsed'&&workers.has(value.sessionId)){workers.get(value.sessionId).scripts.push({scriptId:value.params.scriptId,url:value.params.url});append('early-debugger-inventory.log',{session:value.sessionId,...value.params});}
      if(value.method==='Target.detachedFromTarget'){const w=workers.get(value.params.sessionId);if(w)w.closed=true;}
    };
    const pages=(await c.send('Target.getTargets')).targetInfos.filter(t=>t.type==='page');assert.equal(pages.length,1);
    session=(await c.send('Target.attachToTarget',{targetId:pages[0].targetId,flatten:true})).sessionId;
    await c.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true},session);
    await c.send('Page.enable',{},session);await c.send('Runtime.enable',{},session);
    await c.send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/index.html?debug&'+
      (mode==='worker'?'threads':'no-threads')+'&d3d-renderer=software'},session);
    const shellDue=Date.now()+20000;
    while(!await evaluate(`typeof shell!=='undefined'&&typeof apps!=='undefined'`)){
      assert(Date.now()<shellDue,'bounded shell startup');await pause(50);
    }
    await evaluate(`(()=>{apps.${app}={label:'Authored USER startup',exe:${JSON.stringify('/'+path.relative(root,fixture))},dlls:[]};
      shell.launchApp('${app}').catch(error=>console.error(error));return true;})()`);
    const startupDue=Date.now()+20000;let first=null;
    for(;;){
      first=await evaluate(`typeof runningApps==='undefined'?[]:
        (runningApps.length?runningApps:(shell.currentWine?[{name:null,wine:shell.currentWine}]:[])).map(a=>({name:a.name,running:a.wine.running,
        stopped:!!a.wine._stopped,exited:a.wine._processObject?.exited===true,
        fatal:!!document.getElementById('wine-crash-report'),worker:!!a.wine.guestWorker,
        processId:a.wine.processId,exitCode:a.wine._processObject?.exitCode,
        endpoint:a.wine.guestWorker?.link?.endpointIdentity,slice:!!a.wine._workerLastSlice,
        lastNativeSlice:a.wine._workerLastSlice?{eip:a.wine._workerLastSlice.eip,
          yieldReason:a.wine._workerLastSlice.yield,quit:a.wine._workerLastSlice.quit,
          blocks:a.wine._workerLastSlice.blocks}:null}))`);
      if(first.length===1&&first[0].running&&(mode==='main'||first[0].slice))break;
      if(first.some(a=>a.stopped||a.exited||a.fatal))break;
      assert(Date.now()<startupDue,'bounded native launch');await pause(10);
    }
    await Promise.all(tasks);record('first-host-startup.json',{at:Date.now(),state:first});
    for(const required of ['/src/api_table.json','/lib/vendor/tweetnacl.js','/lib/vendor/webaudio-tinysynth.js'])
      assert(http.some(row=>new URL(row.url,'http://127.0.0.1').pathname===required&&row.status===200),
        'actual startup dependency must be served '+required);
    let otherWindows=[];
    if(variant==='other-thread-window'){
      const due=Date.now()+2500;
      while(!(otherWindows=await evaluate(`Object.entries(runningApps[0].wine.renderer.windows)
        .filter(([h,w])=>w.visible&&w.processId===runningApps[0].wine.processId).map(([h])=>Number(h))`)).length){
        assert(Date.now()<due,'actual other-thread window must appear');await pause(20);
      }
    }
    if(first[0]?.running&&!first[0]?.stopped&&!first[0]?.exited){
      let owningSession=session;
      if(mode==='worker'){
        const matches=[];
        for(const w of workers.values())if(!w.closed&&w.url.includes('guest-worker')){
          const owner=await evaluate(`typeof endpointIdentity==='undefined'?null:({endpointIdentity,slot:workerSlot})`,w.sessionId);
          if(owner?.endpointIdentity===first[0].endpoint&&owner.slot===0)matches.push(w);
        }
        assert.equal(matches.length,1,'one actual owning Worker for startup diagnostic');owningSession=matches[0].sessionId;
      }
      const expression=`(()=>{const assert={equal:(a,b,m)=>{if(a!==b)throw Error(m);}};
        const read=${inspectUser.toString()};
        const current=${mode==='worker'?'instance':'runningApps[0].wine.instance'};
        return read(current.exports);})()`;
      const initial=await evaluate(expression,owningSession);
      record('initial-native-user.json',{at:Date.now(),publicNative:initial,mode,endpoint:first[0].endpoint??'main'});
      if(otherWindows.length){
        const windows=await evaluate(`(()=>{const ex=${mode==='worker'?'instance':'runningApps[0].wine.instance'}.exports;
          return ${JSON.stringify(otherWindows)}.map(hwnd=>({hwnd,live:!!ex.wnd_lookup_live(hwnd),
            generation:String(ex.wnd_lookup_generation(hwnd)),threadId:ex.get_window_thread(hwnd)>>>0,
            currentThreadId:ex.get_current_thread_id()>>>0}));})()`,owningSession);
        record('other-thread-windows.json',{windows});
        assert(windows.some(w=>w.live&&w.threadId!==w.currentThreadId),'real other-thread USER window required');
      }
    }
    // No screenshot or physical input is part of readiness observation.
    const options={c,pageSession:session,workers,app,backend:'software',rendererRequired:mode==='worker'&&variant==='delayed-d3d'&&postFault!=='none-to-one',expectedModules:[sha(fs.readFileSync(root+'/build/wine-assembly.wasm'))]};
    if(phase==='before') {
      try {
        const Module=require('node:module'),old=require('node:child_process').execFileSync('git',['show',process.env.GTA2_RENDERER_BEFORE_HEAD+':tools/gta2-browser-release-binding.cjs'],{encoding:'utf8'});
        const previous=new Module(root+'/tools/gta2-browser-release-binding.cjs');previous.filename=root+'/tools/gta2-browser-release-binding.cjs';previous.paths=Module._nodeModulePaths(root+'/tools');previous._compile(old,previous.filename);
        await previous.exports.install(options);record('before-install.json',{state:'INSTALLED',sourceSHA256:sha(Buffer.from(old)),identity:await evaluate('(async()=>(await __gta2NativeReleasePageV1.read()).pageIdentity)()')});
        await pause(1200);
        record('before-delayed-renderer.json',await evaluate('(async()=>({identity:(await __gta2NativeReleasePageV1.read()).pageIdentity,title:Object.values(runningApps[0].wine.renderer.windows).map(w=>w.title)}))()'));
      }
      catch(error){record('before-refusal.json',{state:'REFUSED',error:String(error)});throw error;}
    } else {
      const diagnostics=[];
      // The implementation must independently bound its pre-install observer.
      // This hook only retains its returned current public native diagnostics.
      await native.install({...options,onReadiness:value=>{
        diagnostics.push(value);append('native-readiness.log',value);
        if(variant==='retired-owner'&&!controlTask){
          assert(!value.healthy,'actual owner retirement occurs before USER publication');
          controlTask=evaluate(`(()=>{const wine=runningApps[0].wine;wine.stop();return {
            processId:wine.processId,stopped:!!wine._stopped,running:wine.running,
            processExited:wine._processObject.exited,forcedHostStop:true,nativeQuitClaim:false};})()`)
            .then(value=>record('actual-owner-retirement.json',value));
          controlTask.catch(()=>{});
        }
      }});
      assert(diagnostics.length,'after implementation must publish current readiness diagnostics');
      assert(diagnostics.some(v=>v.healthy===true),'only a positive native USER observation can install');
      record('after-install.json',{state:'INSTALLED',diagnostics});
      if(postFault==='none-to-one'){
        const until=Date.now()+3000; // bounded authored postpublication observation only
        for(;;){
          const progress=await evaluate(`({running:runningApps[0]?.wine.running,title:Object.values(runningApps[0].wine.renderer.windows).map(w=>w.title)})`);
          assert(progress.running,'authored renderer fixture stopped');
          if(progress.title.includes('Native D3D draw completed'))break;
          assert(Date.now()<until,'authored public COM completion not observed');await pause(20);
        }
        await evaluate(`__gta2NativeReleasePageV1.read()`);
        assert.fail('none-to-one after permanent publication must refuse');
      }
      if(variant==='delayed-d3d'){
        if(mode==='main')await pause(1200);
        const actual=await evaluate('(async()=>({identity:(await __gta2NativeReleasePageV1.read()).pageIdentity,title:Object.values(runningApps[0].wine.renderer.windows).map(w=>w.title)}))()');
        record('after-delayed-renderer.json',actual);
        assert(actual.title.includes('Native D3D draw completed'),'real native public COM draw must complete');
        assert.equal(actual.identity.backend,mode==='worker'?'software':'none');
      }
    }
    if(postFault&&postFault!=='metadata'){
      assert.equal(mode,'worker');assert.equal(phase,'after');assert.equal(variant,'delayed-d3d');
      if(postFault==='generation'){
        const renderer=[...workers.values()].find(w=>!w.closed&&w.url.includes('d3d-render-worker'));
        assert(renderer);
        await evaluate(`globalThis.__authoredRenderObserver=(${native.rendererStartupObserver.toString()})({endpoint:Array.from(endpoints.keys())[0],backend:'software'});__authoredRenderObserver.commit()`,renderer.sessionId);
        await evaluate(`Array.from(endpoints.values())[0].generation++;true`,renderer.sessionId);
        await evaluate(`__authoredRenderObserver.sample()`,renderer.sessionId);
      }else{
        const mutations={manager:'w._renderWorkerManager={}',worker:'m.worker={}',
          port:'m.ports.set(p.id,{...p})',backend:"p.options={...p.options,backend:'webgl'}",
          module:'m.options={...m.options,module:{}}',closed:'p.closed=true'};
        assert(Object.hasOwn(mutations,postFault),'named authored renderer fault only');
        await evaluate(`(()=>{const w=runningApps[0].wine,m=w._renderWorkerManager,p=Array.from(m.ports.values())[0];${mutations[postFault]};return true;})()`);
        await evaluate(`__gta2NativeReleasePageV1.read()`);
      }
      assert.fail('actual subsequent renderer '+postFault+' change must refuse');
    }
    assert.equal(wireInputs,0);assert.equal(captures,0);
    record('startup-result.json',{state:'INSTALLED',phase,mode,variant,wireInputs,captures,nativeQuitClaim:false});
  } catch(error) {
    c?.seal('first startup failure: '+error);
    record('startup-result.json',{state:'REFUSED',phase,mode,variant,postFault,error:String(error),
      nativeStartupState:error.nativeStartupState??null,wireInputs,captures,
      nativeQuitClaim:false,laterRequestsAllowed:0});
    const beforeWire=fs.readFileSync(out+'/requests.log');
    for(const [method,params] of [['Target.getTargets',{}],['Runtime.evaluate',{expression:'1'}],['Input.dispatchKeyEvent',{type:'keyDown',key:'Enter'}]])
      await assert.rejects(c.send(method,params),/permanently closed/);
    assert(fs.readFileSync(out+'/requests.log').equals(beforeWire));
    record('terminal-local-refusals.json',{state:'REFUSED_BEFORE_WIRE',requests:0});
    throw error;
  } finally {
    if(controlTask)await controlTask.catch(error=>record('owner-retirement-error.json',{error:String(error)}));
    if(c&&!c.closed)c.stop();
    if(browser){
      const processes=[];
      for(const name of fs.readdirSync('/proc').filter(n=>/^\d+$/.test(n)))try{
        const line=fs.readFileSync('/proc/'+name+'/stat','utf8'),f=line.slice(line.lastIndexOf(')')+2).split(' ');
        processes.push({pid:Number(name),ppid:Number(f[1]),pgid:Number(f[2]),startToken:f[19]});
      }catch{}
      const owned=new Set([browser.pid]);let changed=true;
      while(changed){changed=false;for(const p of processes)if(owned.has(p.ppid)&&!owned.has(p.pid)){owned.add(p.pid);changed=true;}}
      record('chrome-processes.json',{processes:processes.filter(p=>owned.has(p.pid))});
      browser.kill('SIGTERM');let timer;
      try{await Promise.race([joined,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Chrome close timeout')),3000);})]);}
      catch{browser.kill('SIGKILL');await joined;}finally{clearTimeout(timer);}
    }
    if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
    fs.rmSync(out+'/profile',{recursive:true,force:true});
  }
}
async function focused(out){
  fs.mkdirSync(out,{recursive:true});
  const commands=[
    ['node','--check','tools/gta2-browser-release-binding.cjs'],
    ['node','--check','tools/gta2-paired-controller.cjs'],
    ['node','--check','tools/gta2-renderer-startup-runtime.cjs'],
    ['node','--test','test/test-gta2-renderer-startup-publication.cjs','test/test-gta2-native-user-readiness.cjs','test/test-gta2-worker-complete-confirmation.cjs'],
    ['node','test/test-gta2-native-user-readiness.cjs','--binding-controls'],
    ['node','test/gta2-paired-controller.test.cjs'],
    ...['--source-guards','--bridge-model','--page-model','--candidate-faults']
      .map(flag=>['node','test/test-gta2-browser-release-scene-binding.cjs',flag]),
  ];
  const cp=require('node:child_process'),rows=[];
  for(const [i,args]of commands.entries()){
    const child=cp.spawn(args[0],args.slice(1),{cwd:ROOT,env:{...process.env,GTA2_TEST_OUT:out+'/controller'},stdio:['ignore','pipe','pipe']});
    const stdout=[],stderr=[];child.stdout.on('data',b=>stdout.push(b));child.stderr.on('data',b=>stderr.push(b));
    const result=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>resolve({code,signal}));});
    fs.writeFileSync(out+'/'+i+'.stdout.log',Buffer.concat(stdout),{flag:'wx'});
    fs.writeFileSync(out+'/'+i+'.stderr.log',Buffer.concat(stderr),{flag:'wx'});
    const row={args,pid:child.pid,...result,actualWait:true,stdoutEOF:child.stdout.readableEnded,stderrEOF:child.stderr.readableEnded};
    rows.push(row);fs.writeFileSync(out+'/'+i+'-wait.json',JSON.stringify(row)+'\n',{flag:'wx'});
    assert.equal(result.code,0,JSON.stringify(args)+' '+Buffer.concat(stderr));
  }
  fs.writeFileSync(out+'/focused-result.json',JSON.stringify({state:'PASS',rows},null,2)+'\n',{flag:'wx'});
}
module.exports={startupPE,modelControls,nativeGate,nativeStartupFixture,focused};

async function nativePlan(base){
  const cp=require('node:child_process'),plan=JSON.parse(fs.readFileSync(path.join(base,'native-plan.json'))),rows=[];
  for(const row of plan){
    assert(/^[a-z0-9-]+$/.test(row.name));const out=path.join(base,row.name);
    if(!fs.existsSync(path.join(out,'outer-child-wait.json'))){
      const child=cp.spawn('python3',['-u','-B','tools/forsaken-supervisor.py','outerwait',out],{cwd:ROOT,stdio:['ignore','pipe','pipe']});
      const stdout=[],stderr=[];child.stdout.on('data',b=>stdout.push(b));child.stderr.on('data',b=>stderr.push(b));
      const waited=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>resolve({code,signal}));});
      fs.writeFileSync(path.join(out,'plan-child-wait.json'),JSON.stringify({pid:child.pid,...waited,actualWait:true,stdoutEOF:child.stdout.readableEnded,stderrEOF:child.stderr.readableEnded})+'\n',{flag:'wx'});
      fs.writeFileSync(path.join(out,'plan-child.stdout.log'),Buffer.concat(stdout),{flag:'wx'});
      fs.writeFileSync(path.join(out,'plan-child.stderr.log'),Buffer.concat(stderr),{flag:'wx'});
    }
    const result=JSON.parse(fs.readFileSync(path.join(out,'control/startup-result.json')));
    const wait=JSON.parse(fs.readFileSync(path.join(out,'source-view-child-wait.json')));
    const positive=!row.fault&&['delayed-d3d','gdi','delayed-user','modal'].includes(row.variant);
    assert.equal(result.state,positive?'INSTALLED':'REFUSED',row.name+' '+result.error);
    assert.equal(wait.exit,positive?0:1,row.name+' actual child exit');
    assert(wait.actualWait&&wait.stdoutEOF&&wait.stderrEOF);
    assert.equal(result.wireInputs,0);assert.equal(result.captures,0);
    if(!positive){
      const terminal=JSON.parse(fs.readFileSync(path.join(out,'control/terminal-local-refusals.json')));assert.equal(terminal.requests,0);
    }
    rows.push({...row,result,exit:wait.exit});
    fs.writeFileSync(path.join(base,'native-progress.json'),JSON.stringify({rows},null,2)+'\n');
  }
  const before=path.join(base,'native-worker-delayed-d3d-before/control');
  const initial=JSON.parse(fs.readFileSync(path.join(before,'before-install.json'))),later=JSON.parse(fs.readFileSync(path.join(before,'before-delayed-renderer.json')));
  assert.equal(initial.identity.renderEndpoint,'none');assert.notEqual(later.identity.renderEndpoint,'none');assert(later.title.includes('Native D3D draw completed'));
  const after=path.join(base,'native-worker-delayed-d3d-after/control');
  const actual=JSON.parse(fs.readFileSync(path.join(after,'after-delayed-renderer.json')));
  assert.notEqual(actual.identity.renderEndpoint,'none');assert.equal(actual.identity.backend,'software');
  fs.writeFileSync(path.join(base,'native-summary.json'),JSON.stringify({state:'PASS',rows,actualBeforeAfter:true},null,2)+'\n',{flag:'wx'});
}

async function originalSoftware(out,qualification){
  // A fresh launch is authorized only by current, published actual qualification.
  // This entry never accepts an old endpoint or a caller-supplied source pin.
  const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
  const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
  fs.mkdirSync(out,{recursive:true});nativeGate(out);
  const root=path.resolve(__dirname,'..'),q=JSON.parse(fs.readFileSync(qualification));
  assert.equal(q.status,'PUBLISHED_MAIN_WORKER_COMPLETE_AND_50_FAULTS_PASS');
  assert.equal(q.head,process.env.GTA2_VIEW_HEAD);
  assert.equal(cp.execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),'main');
  // Other authorized lanes may publish while this exact immutable runtime is
  // qualified. Its source commit must remain published on main; its executed
  // source/module view and every owned pin must still match qualification.
  cp.execFileSync('git',['merge-base','--is-ancestor',q.head,'HEAD']);
  cp.execFileSync('git',['merge-base','--is-ancestor',q.head,'origin/main']);
  assert(/^[a-f0-9]{40}$/.test(q.implementation),'published implementation SHA required');
  cp.execFileSync('git',['merge-base','--is-ancestor',q.implementation,'origin/main']);
  const baseline=JSON.parse(fs.readFileSync(q.workerPins));
  const files=baseline.files.filter(p=>!p.path.startsWith('test/binaries/gta2-user-readiness-20261116/'));
  const inventory='scratch/runs/20261115-gta2-current-native-thunks-visible-driving/current-inputs.json';
  const media=JSON.parse(fs.readFileSync(inventory));
  for(const p of media.matches){assert.equal(sha(fs.readFileSync(p.path)),p.sha256,'current original media '+p.path);
    if(!files.some(v=>v.path===p.path))files.push({path:p.path,sha256:p.sha256});}
  for(const p of [path.relative(root,__filename),inventory,'test/binaries/tlbs/stdole2.tlb',
    'test/binaries/sims-native-common-controls/kommctrl.dll'])if(!files.some(v=>v.path===p))
      files.push({path:p,sha256:sha(fs.readFileSync(p))});
  for(const p of files)assert.equal(sha(fs.readFileSync(p.path)),p.sha256,'fresh qualified original pin '+p.path);
  for(const name of ['tools/gta2-browser-release-binding.cjs','tools/gta2-paired-controller.cjs',
    'tools/gta2-renderer-startup-runtime.cjs','tools/gta2-renderer-startup-runtime.py',
    'test/test-gta2-renderer-startup-publication.cjs','test/test-gta2-worker-complete-confirmation.cjs']){
    const pin=files.find(p=>p.path===name);assert(pin,'qualified published owned input '+name);
    assert.equal(sha(cp.execFileSync('git',['show',q.implementation+':'+name])),pin.sha256,'published implementation differs from qualified input '+name);
  }
  const http=files.filter(p=>['comctl32.dll','commctrl.dll','gta2.exe','mss32.dll'].some(n=>p.path.endsWith('/'+n)))
    .map(p=>({url:'/'+p.path.replace(/^test\//,''),sha256:p.sha256}));
  assert.equal(http.length,4);
  for(const name of ['tools/gta2-renderer-startup-runtime.cjs','tools/gta2-renderer-startup-runtime.py']){
    if(!files.some(p=>p.path===name))files.push({path:name,sha256:sha(fs.readFileSync(name))});
  }
  const launch=JSON.parse(fs.readFileSync(path.join(out,'..','launch.json')));
  const recipe=JSON.parse(fs.readFileSync(path.join(out,'..','recipe.json')));
  const watch=JSON.parse(fs.readFileSync(path.join(out,'..','watchdog-armed.json')));
  assert.equal(recipe.seconds,900,'original software budget remains 900 seconds');
  assert.equal(watch.deadline-launch.deadline,20,'independent watchdog remains 920 seconds');
  fs.writeFileSync(path.join(out,'launch.json'),JSON.stringify(launch)+'\n',{flag:'wx'});
  fs.writeFileSync(path.join(out,'pins.json'),JSON.stringify({files,http,modules:baseline.modules,gitSHA:q.head})+'\n',{flag:'wx'});
  fs.writeFileSync(path.join(out,'media-preflight.json'),JSON.stringify({files:media.matches,
    inventorySHA256:sha(fs.readFileSync(inventory)),copies:0,at:Date.now()})+'\n',{flag:'wx'});
  fs.writeFileSync(path.join(path.dirname(qualification),'original-attempt.json'),JSON.stringify({out,
    head:q.head,at:Date.now(),attempt:1,oldEndpointsContacted:0})+'\n',{flag:'wx'});
  const child=cp.spawn(process.execPath,['tools/gta2-paired-controller.cjs','browser',out,'software'],
    {cwd:root,stdio:['ignore','pipe','pipe']});
  const stdout=[],stderr=[];child.stdout.on('data',b=>stdout.push(b));child.stderr.on('data',b=>stderr.push(b));
  const result=await new Promise((resolve,reject)=>{child.once('error',reject);
    child.once('close',(code,signal)=>resolve({code,signal}));});
  fs.writeFileSync(path.join(out,'original-controller.stdout.log'),Buffer.concat(stdout),{flag:'wx'});
  fs.writeFileSync(path.join(out,'original-controller.stderr.log'),Buffer.concat(stderr),{flag:'wx'});
  fs.writeFileSync(path.join(out,'original-controller-wait.json'),JSON.stringify({pid:child.pid,...result,
    actualWait:true,stdoutEOF:child.stdout.readableEnded,stderrEOF:child.stderr.readableEnded,at:Date.now()})+'\n',{flag:'wx'});
  assert.equal(result.code,0,'single original controller outcome');
}
