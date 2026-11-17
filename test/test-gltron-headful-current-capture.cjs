'use strict';
// Authored continuous Win32/OpenGL producer, never original game media.
// Derived from read-only baseline test SHA256 b64e5f260308d68d91be2658aa566bdba19f7aa218854852429c67c69fc478ce.
// --native serves a sealed Git runtime from memory; it never reads shared
// build outputs, adopts foreign WIP, or persists source/module bundles.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const cp=require('node:child_process'),crypto=require('node:crypto'),http=require('node:http');
const ROOT=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function fixture(){
  const b=Buffer.alloc(0x6400),base=0x400000,raw=r=>r-0x1000+0x400;
  const d=(o,n)=>b.writeUInt32LE(n>>>0,o),w=(o,n)=>b.writeUInt16LE(n,o),pe=0x80,opt=pe+24,s=opt+224;
  w(0,0x5a4d);d(0x3c,pe);d(pe,0x4550);w(pe+4,0x14c);w(pe+6,1);w(pe+20,224);w(pe+22,0x10e);
  w(opt,0x10b);d(opt+16,0x2000);d(opt+28,base);d(opt+32,4096);d(opt+36,1024);w(opt+40,4);w(opt+48,4);
  d(opt+56,0x7000);d(opt+60,1024);w(opt+68,2);d(opt+72,0x100000);d(opt+76,4096);d(opt+80,0x100000);d(opt+84,4096);d(opt+92,16);
  b.write('.native',s);d(s+8,0x6000);d(s+12,0x1000);d(s+16,0x6000);d(s+20,1024);d(s+36,0xe0000060);
  const libraries=[['kernel32.dll',['ExitProcess','OutputDebugStringA']],['user32.dll',['RegisterClassA','CreateWindowExA','SetFocus','PeekMessageA','TranslateMessage','DispatchMessageA','DefWindowProcA','GetDC','ChangeDisplaySettingsA']],['gdi32.dll',['SwapBuffers']],['opengl32.dll',['wglCreateContext','wglMakeCurrent','glClearColor','glClear','glBegin','glColor3f','glVertex2f','glEnd']]];
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
    label('loop');for(const n of [1,0,0,0,base+0x3640])push(n);call('PeekMessageA');emit(0x85,0xc0);jump('draw',0x84);push(base+0x3640);call('TranslateMessage');push(base+0x3640);call('DispatchMessageA');
    label('draw');push(0x3f800000);push(0x3e800000);push(0x3e000000);emit(0xff,0x35,...u(base+0x3608));call('glClearColor');push(0x4000);call('glClear');
    push(4);call('glBegin');for(const n of [0x3f000000,0x3f800000,0x3f800000])push(n);call('glColor3f');
    for(const p of [[0xbf000000,0xbf000000],[0xbf000000,0x3f000000],[0x3f000000,0]]){for(const n of p)push(n);call('glVertex2f');}call('glEnd');emit(0xff,0x35,...u(base+0x3604));call('SwapBuffers');jump('loop');
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
function gitRuntime(commit){
  const names=cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','src','lib','tools','index.html','host.js'],{cwd:ROOT,encoding:'utf8',maxBuffer:8*1024*1024}).trim().split('\n').filter(n=>/^(src|lib|tools)\//.test(n)&&/\.(js|cjs|json|wat|watx)$/.test(n)||/^(index\.html|host\.js)$/.test(n));
  const packed=cp.execFileSync('git',['cat-file','--batch'],{cwd:ROOT,input:names.map(n=>commit+':'+n+'\n').join(''),maxBuffer:100*1024*1024});let at=0;const files=new Map();
  for(const n of names){const end=packed.indexOf(10,at),header=packed.subarray(at,end).toString().split(' '),size=Number(header[2]);assert(header[1]==='blob'&&Number.isSafeInteger(size));files.set(n,Buffer.from(packed.subarray(end+1,end+1+size)));at=end+size+2;}assert.equal(at,packed.length);return files;
}
function compile(files){
  // Compiler dependencies use this same immutable Git map, not the worktree.
  const read=fs.readFileSync,Module=require('node:module'),extensions={...Module._extensions};
  fs.readFileSync=function(file,options){const n=typeof file==='string'?path.relative(ROOT,path.resolve(file)):null,b=files.get(n);if(!b)return read.apply(this,arguments);const enc=typeof options==='string'?options:options?.encoding;return enc?b.toString(enc):Buffer.from(b);};
  for(const ext of ['.js','.cjs','.json'])Module._extensions[ext]=(m,file)=>{const b=files.get(path.relative(ROOT,file));if(!b)return extensions[ext](m,file);if(ext==='.json')m.exports=JSON.parse(b);else m._compile(b.toString(),file);};
  try{
    const {sourceTextFromBytes}=require('../tools/watx.js'),vfs=new Map();for(const [n,b]of files)if(/^src\/.*\.(wat|watx)$/.test(n)){const text=sourceTextFromBytes(b),f=n.slice(4);for(const key of [f,n,'./'+f])vfs.set(key,text);}
    const result=require('../tools/watx-closure.js').compileClosure({entry:'src/main.watx',source:vfs.get('main.watx'),vfs},{tailCalls:true});assert(result.success,result.error);
    const {appendSection,layoutHash}=require('../tools/region-layout-hash.js');return appendSection(Buffer.from(result.wasmBinary),layoutHash(result.regions.regions));
  }finally{fs.readFileSync=read;for(const ext of ['.js','.cjs','.json']){if(extensions[ext])Module._extensions[ext]=extensions[ext];else delete Module._extensions[ext];}}
}
async function native(out){
  assert(process.env.GLTRON_HEADFUL_GATE,'independent watchdog gate required');
  while(!fs.existsSync(process.env.GLTRON_HEADFUL_GATE))await sleep(10);
  fs.mkdirSync(out,{recursive:false});const save=(n,v)=>fs.writeFileSync(path.join(out,n),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
  const commit=cp.execFileSync('git',['rev-parse','30bb96a5a44b5e67c64b9a65bcc6fdbab49664de'],{cwd:ROOT,encoding:'utf8'}).trim(),files=gitRuntime(commit);
  save('git-inputs.json',{commit,files:[...files].map(([path,b])=>({path,sha256:sha(b),size:b.length})),foreignWIPAdopted:false});
  const module=compile(files);save('module.json',{sha256:sha(module),bytes:module.length,sourceCommit:commit,persisted:false});files.set('build/wine-assembly.wasm',module);files.set('authored-native.exe',fixture());
  const controller=require('../tools/gltron-browser-controller.cjs'),binding=require('../tools/gltron-browser-binding.cjs');
  let browser,c,server,session,waited,sampler,probe,probeWait,display,rootTimer;const presentation=require('../tools/gltron-headful-display.cjs');const requests=[],workers=new Map(),tasks=[],wire=[],samples=[];
  const evaluate=async(expression,s=session)=>{const r=await c.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},s);if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  try{
    server=http.createServer((req,res)=>{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'index.html';res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
      let b=files.get(name);if(!b&&/^(fonts|icons|images)\/[a-zA-Z0-9_.\/-]+$/.test(name)&&!name.includes('..')){try{b=fs.readFileSync(path.join(ROOT,name));files.set(name,b);}catch{}}
      requests.push({name,status:b?200:404,sha256:b?sha(b):null});res.statusCode=b?200:404;res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.wasm')?'application/wasm':name.endsWith('.html')?'text/html':name.endsWith('.json')?'application/json':'application/octet-stream');res.end(b||'not found');});
    await new Promise(r=>server.listen(0,'127.0.0.1',r));save('server.json',{port:server.address().port,owned:true});
    display=await presentation.start(out);
    save('browser-binary-before.json',{sha256:cp.execFileSync('sha256sum',['/opt/google/chrome/chrome'],{encoding:'utf8'}).split(' ')[0],newSurfaceRequested:false,headful:true});
    browser=cp.spawn('/usr/bin/google-chrome',['--no-sandbox','--no-first-run','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--window-size=1024,900','--window-position=0,0','--remote-debugging-port=0','--user-data-dir='+out+'/profile','http://127.0.0.1:'+server.address().port+'/index.html?debug&threads&gl-renderer=webgl'],{env:display.env,stdio:['ignore','pipe','pipe']});
    sampler=setInterval(()=>{const at=Date.now();for(const p of fs.readdirSync('/proc').filter(n=>/^\d+$/.test(n))){try{const cmd=fs.readFileSync('/proc/'+p+'/cmdline','utf8');if(!cmd.includes(out+'/profile'))continue;const threads=[];for(const tid of fs.readdirSync('/proc/'+p+'/task')){try{const pre='/proc/'+p+'/task/'+tid+'/';threads.push({tid,name:fs.readFileSync(pre+'comm','utf8').trim(),stat:fs.readFileSync(pre+'stat','utf8'),wchan:fs.readFileSync(pre+'wchan','utf8'),syscall:fs.readFileSync(pre+'syscall','utf8')});}catch{}}samples.push({at,pid:p,cmd,threads});}catch{}}},100);
    let stdout='',stderr='';browser.stdout.on('data',b=>stdout+=b);browser.stderr.on('data',b=>stderr+=b);waited=new Promise(r=>browser.once('close',(code,signal)=>{save('chrome-wait.json',{pid:browser.pid,code,signal,actualWait:true,stdoutEOF:browser.stdout.readableEnded,stderrEOF:browser.stderr.readableEnded});fs.writeFileSync(out+'/chrome.log',stdout+stderr);r();}));save('browser.json',{pid:browser.pid,owned:true});
    const active=out+'/profile/DevToolsActivePort';for(let i=0;!fs.existsSync(active);i++){assert(i<100&&browser.exitCode===null);await sleep(50);}const [port,url]=fs.readFileSync(active,'utf8').trim().split('\n');c=controller.connection('ws://127.0.0.1:'+port+url);await c.ready;
    const send=c.ws.send.bind(c.ws);c.ws.send=value=>{const v=JSON.parse(value);wire.push({at:Date.now(),direction:'request',id:v.id,method:v.method,sessionId:v.sessionId,params:v.method==='Page.captureScreenshot'?v.params:undefined});return send(value);};
    c.ws.addEventListener('message',e=>{const v=JSON.parse(e.data);if(v.id)wire.push({at:Date.now(),direction:'response',id:v.id,error:v.error,dataBytes:v.result?.data?.length??null});});
    c.event=v=>{if(v.method==='Target.attachedToTarget'&&v.params.targetInfo.type==='worker'){
      const {sessionId,targetInfo}=v.params,w={sessionId,targetId:targetInfo.targetId,url:targetInfo.url,scripts:[],closed:false};workers.set(sessionId,w);
      const task=(async()=>{await c.send('Runtime.enable',{},sessionId);await c.send('Runtime.evaluate',{expression:controller.GL_OBSERVER},sessionId);await c.send('Debugger.enable',{},sessionId);await c.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true},sessionId);await c.send('Runtime.runIfWaitingForDebugger',{},sessionId);})();tasks.push(task);task.catch(()=>{});
    }else if(v.method==='Target.detachedFromTarget'){const w=workers.get(v.params.sessionId);if(w)w.closed=true;}else if(v.method==='Debugger.scriptParsed'&&workers.has(v.sessionId)){
      const row={scriptId:v.params.scriptId,url:v.params.url};workers.get(v.sessionId).scripts.push(row);const task=c.send('Debugger.getScriptSource',{scriptId:row.scriptId},v.sessionId).then(s=>{row.bytecodeAvailable=!!s.bytecode;row.sha256=sha(Buffer.from(s.bytecode||s.scriptSource||'',s.bytecode?'base64':'utf8'));});tasks.push(task);task.catch(e=>row.error=String(e));}};
    const targets=(await c.send('Target.getTargets')).targetInfos.filter(t=>t.type==='page');assert.equal(targets.length,1);session=(await c.send('Target.attachToTarget',{targetId:targets[0].targetId,flatten:true})).sessionId;
    const windowInfo=await c.send('Browser.getWindowForTarget',{targetId:targets[0].targetId});
    const geometryDeadline=Date.now()+3000,geometryObservations=[];let sized=false;
    for(;;){const geometry=await evaluate('({width:innerWidth,height:innerHeight,outerWidth,outerHeight,focus:document.hasFocus(),visibility:document.visibilityState})');geometryObservations.push(geometry);fs.writeFileSync(out+'/viewport-observations.json',JSON.stringify(geometryObservations,null,2)+'\n');if(geometry.width===1024&&geometry.height===757){save('viewport.json',{...geometry,deviceScale:await evaluate('devicePixelRatio'),windowInfo});break;}assert(Date.now()<geometryDeadline,'same full viewport required');if(!sized&&geometry.outerWidth>0&&geometry.outerHeight>0&&geometry.visibility==='visible'){sized=true;await c.send('Browser.setWindowBounds',{windowId:windowInfo.windowId,bounds:{left:0,top:0,width:geometry.outerWidth+1024-geometry.width,height:geometry.outerHeight+757-geometry.height,windowState:'normal'}});}await sleep(50);}
    await c.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true},session);await c.send('Page.enable',{},session);await c.send('Runtime.enable',{},session);
    await c.send('Page.bringToFront',{},session);
    save('content-focus.json',await evaluate('({focus:document.hasFocus(),visibility:document.visibilityState,active:document.activeElement?.tagName})'));
    assert(await evaluate('document.hasFocus()&&document.visibilityState==="visible"'),'headful content must have real focus before native launch');
    const until=Date.now()+30000;while(!await evaluate('typeof wineShell!=="undefined"&&typeof wineShell.launchApp==="function"')){assert(Date.now()<until);await sleep(25);}
    const idle=false;
    if(!idle){await evaluate(`(()=>{wineApps.APPS.live_input_fixture={exe:'authored-native.exe',threads:true,runSlice:{cooperative:1000,worker:1000,compat:1000}};globalThis.nativeKeys=[];for(const type of ['keydown','keyup'])document.addEventListener(type,e=>nativeKeys.push({type,key:e.key,trusted:e.isTrusted,at:Date.now()}),true);wineShell.launchApp('live_input_fixture');return true;})()`);
    const startup=Date.now()+30000;while(!await evaluate('runningApps.length===1&&!!runningApps[0].wine._workerLastSlice')){assert(Date.now()<startup,'native fixture startup deadline');await sleep(25);}}await Promise.all(tasks);
    save('workers.json',[...workers.values()]);
    const chain=binding.createChain({evaluate,send:c.send,workers,pageSession:session,app:'live_input_fixture',expectedModules:[sha(module)]});
    {
      const observations=[],deadline=Date.now()+30000;
      for(;;){const host=await evaluate(binding.HOST_READ);observations.push(host);if(host.button.visible&&host.button.enabled&&host.button.hit&&host.strip.visible)break;assert(Date.now()<deadline,'production consent UI prerequisite');await sleep(25);}
      save('consent-prerequisite.json',{observations,passiveOnly:true,noRendererReadinessChange:true});
    }
    save('before-owner.json',await evaluate(binding.PAGE_READ));save('host-state.json',await evaluate(binding.HOST_READ));
    save('actual-gl.json',await Promise.all([...workers.values()].filter(w=>!w.closed&&w.url.includes('d3d-render-worker')).map(async w=>({targetId:w.targetId,observation:await evaluate('globalThis.__gltronObserver?.snapshot?.()??null',w.sessionId),endpoints:await evaluate(binding.RENDER_READ,w.sessionId)}))));
    if(true){
      // Exclude historical/transient launch helpers; freeze only currently
      // sampled browser, renderer and GPU processes for passive probes.
      const pids=[...new Set(samples.filter(s=>Date.now()-s.at<500&&/^\/opt\/google\/chrome\/chrome[\0 ]/.test(s.cmd)&&(Number(s.pid)===browser.pid||/--type=(renderer|gpu-process)[\0 ]/.test(s.cmd))).map(s=>s.pid))].filter(p=>fs.existsSync('/proc/'+p));
      assert(pids.includes(String(browser.pid))&&pids.length>=3,'owned browser/renderer/GPU probe inventory');
      save('probe-config.json',{at:Date.now(),browserPid:browser.pid,pids});
      const events=['capture_enter','old_visual_call','copy_surface','skia_copy','surface_received','png_encode','cc_draw','viz_swap','viz_swap_ack','surface_activate'].map(n=>'probe_headful:gltron_'+n);
      save('probe-events-selected.json',{events,noInherit:true});
      probe=cp.spawn('sudo',['-n','timeout','--kill-after=2','12','perf','record','--no-inherit','--control=fd:0,1','--delay=-1','-o',out+'/capture.perf','-e',events.join(','),'-p',pids.join(','),'--','sleep','8'],{stdio:['pipe','pipe','pipe']});
      let stdout='',stderr='';probe.stdout.on('data',b=>stdout+=b);probe.stderr.on('data',b=>stderr+=b);
      probeWait=new Promise(r=>probe.once('close',(code,signal)=>{save('probe-wait.json',{pid:probe.pid,code,signal,actualWait:true,stdoutEOF:probe.stdout.readableEnded,stderrEOF:probe.stderr.readableEnded,stdout,stderr});r();}));
      probe.stdin.write('enable\n');const limit=Date.now()+3000;while(!stdout.includes('ack\n')){assert(Date.now()<limit&&probe.exitCode===null,'bounded perf enable ACK');await sleep(10);}
      save('probe-prearmed.json',{at:Date.now(),pid:probe.pid,browserPids:pids,durationSeconds:8,CDPRequests:false,ack:stdout});
    }
    presentation.rootCapture(out,'presented-before-capture',display.env);
    fs.writeFileSync(out+'/xwindows.txt',cp.execFileSync('xwininfo',['-root','-tree'],{env:display.env,encoding:'utf8',timeout:3000}),{flag:'wx'});
    rootTimer=setTimeout(()=>{try{presentation.rootCapture(out,'presented-pending-capture',display.env);}catch(e){save('root-capture-failure.json',{error:String(e)});}},1000);
    const screenshotAt=Date.now(),screenshot=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},session);fs.writeFileSync(out+'/native-host.png',Buffer.from(screenshot.data,'base64'),{flag:'wx'});save('native-host.json',{at:screenshotAt,sha256:sha(Buffer.from(screenshot.data,'base64')),elapsed:Date.now()-screenshotAt,hostOnly:true,reviewed:false});
    if(idle){save('report.json',{idleShellOnly:true,nativeContinuousProducer:false,originalLaunched:false,trustedInputPositive:false,conditionalOriginalPermitted:false});return;}
    const live=await chain.readLive();save('owner.json',live);
    const observations=[],start=Date.now();while(Date.now()-start<3000){const at=Date.now(),ready=await evaluate(binding.readinessExpression(live.identity,false,true));observations.push({at,ms:Date.now()-at,...ready});await sleep(10);}save('readiness.json',observations);
    save('native-state.json',await evaluate(`({at:Date.now(),log:document.getElementById('log')?.textContent,apps:runningApps.map(a=>({name:a.name,steps:a.wine.stepsPerSlice,running:a.wine.running,slice:a.wine._workerLastSlice,depth:a.wine.renderer._workerGuestSliceDepth,gdiDepth:a.wine.renderer._workerGdiPaintDepth,publication:a.wine.renderer._immutablePublicationSequence,dxDirty:a.wine._dxDirty,presentDue:a.wine._presentFrameDue}))})`));
    save('report.json',{nativeContinuousProducer:true,readinessReady:observations.filter(s=>s.ready).length,total:observations.length,originalLaunched:false,trustedInputPositive:false,conditionalOriginalPermitted:false});
  }catch(e){save('failure.json',{at:Date.now(),error:e.stack,originalLaunched:false,transportClosed:c?.closed??null});throw e;}
  finally{
    clearTimeout(rootTimer);
    if(c&&!c.closed)try{await c.send('Browser.close');}catch{}c?.ws.close();if(browser){if(browser.exitCode===null){const timer=setTimeout(()=>browser.kill('SIGTERM'),5000);await waited;clearTimeout(timer);}else await waited;}
    clearInterval(sampler);save('wire.json',wire);save('os-threads.json',samples);

    if(probeWait)await probeWait;
    if(display)await display.close();
    if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}fs.rmSync(out+'/profile',{recursive:true,force:true});save('http.json',requests);
  }
}
if(require.main===module){const [mode,out]=process.argv.slice(2);assert(out,'explicit output path required');if(mode==='--verify-negative')console.log(JSON.stringify(require('../tools/gltron-headful-audit.cjs').verifyNegative(out,{focused:true}),null,2));else{assert(mode==='--native','--native OUTPUT or --verify-negative OUTPUT required');native(path.resolve(out)).catch(e=>{console.error(e);process.exitCode=1;});}}
module.exports={fixture,gitRuntime,compile,native};

