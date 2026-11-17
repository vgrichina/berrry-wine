'use strict';
// Manual browser controller. No gameplay selection, guest writes, or retries.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..');
const HELPER='tools/gltron-browser-binding.cjs';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const KEYS={ArrowUp:38,ArrowDown:40,ArrowLeft:37,ArrowRight:39,Enter:13,Escape:27,Space:32,a:65,s:83};

const GL_OBSERVER = `(() => {
 if(globalThis.__gltronObserver)throw Error('observer already installed');
 const bridges=[],contexts=[],counts={draws:0,readbacks:0,transfers:0,creates:0,bindings:0,presents:0,contextLostEvents:0};
 const get=OffscreenCanvas.prototype.getContext,transfer=OffscreenCanvas.prototype.transferToImageBitmap;
 OffscreenCanvas.prototype.getContext=function(type,...args){
  const gl=get.call(this,type,...args);
  if(gl&&/^webgl/.test(type)&&!contexts.some(x=>x.gl===gl)){
   const ext=gl.getExtension('WEBGL_debug_renderer_info');
   contexts.push({gl,canvas:this,type,version:gl.getParameter(gl.VERSION),renderer:gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER)});
   this.addEventListener?.('webglcontextlost',()=>{counts.contextLostEvents++;});
   for(const method of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced','readPixels']){
    const old=gl[method];if(typeof old==='function')gl[method]=function(...a){const v=old.apply(this,a);counts[method==='readPixels'?'readbacks':'draws']++;return v;};
   }
  }return gl;
 };
 OffscreenCanvas.prototype.transferToImageBitmap=function(...a){const v=transfer.apply(this,a);counts.transfers++;return v;};
 let compat;
 Object.defineProperty(globalThis,'OpenGLCompat',{configurable:true,get(){return compat;},set(v){
  compat=v;const p=v.OpenGLHostBridge.prototype;
  for(const [method,count] of [['createContext','creates'],['makeCurrent','bindings'],['present','presents']]){
   const old=p[method];p[method]=function(...a){const result=old.apply(this,a);if(!bridges.includes(this))bridges.push(this);counts[count]++;return result;};
  }
 }});
 globalThis.__gltronObserver={loseContexts:()=>contexts.map(x=>{const ext=x.gl.getExtension('WEBGL_lose_context');if(!ext)throw Error('actual context loss extension unavailable');ext.loseContext();return {type:x.type,requested:true};}),snapshot:()=>({...counts,frontendDraws:compat?.stats?.draws??null,frontendPresents:compat?.stats?.presents??null,devices:contexts.map(x=>({type:x.type,version:x.version,renderer:x.renderer,width:x.canvas.width,height:x.canvas.height})),
  contexts:bridges.flatMap(b=>[...b.contexts].map(([id,x])=>({id,hwnd:x.hwnd,software:x.software===true,current:[...b.currentByOwner].some(([o,h])=>h===id),owners:[...b.currentByOwner],backend:x.backend?.constructor?.name,deviceObserved:contexts.some(y=>y.gl===x.backend?.gl||y.gl===b._webglBackend?.gl)})))})};
 return true;
})()`;

const QUIT={'open-menu':'Escape','menu-up':'ArrowUp','menu-down':'ArrowDown','select-quit':'Enter'};
function gameplayCutoff(launch){assert(Number.isFinite(launch.at)&&Number.isFinite(launch.deadline)&&launch.deadline-launch.at>180,'immutable launch/deadline required');return (launch.deadline-180)*1000;}
function policy(c,launch,phase,now=Date.now()) {
  assert(['play','menu','quit'].includes(c.mode));
  assert(Array.isArray(c.keys)&&c.keys.length===1);
  assert(c.keys.every(k=>Object.hasOwn(KEYS,k)));
  assert(Number.isInteger(c.ms)&&c.ms>=50&&c.ms<=1500,'finite hold leaves independent UP margin');
  assert(now<launch.deadline*1000,'immutable deadline');
  assert(c.observation?.trim(),'personal scene review required');
  if(c.mode==='play')assert(['a','s','Space','Enter'].includes(c.keys[0])&&c.liveCycle===true,'reviewed intact controlled cycle required');
  if(c.mode!=='play')assert(c.keys.length===1&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter','Escape'].includes(c.keys[0]));
  if(c.mode==='quit'){
    assert(Object.hasOwn(QUIT,c.route)&&c.keys.length===1&&c.keys[0]===QUIT[c.route],'reviewed native Quit route required');
    if(c.route==='select-quit')assert(['Quit'].includes(c.selectedQuit),'personally reviewed Quit selection required');
  }
  else assert(!phase&&now+3000<gameplayCutoff(launch),'irreversible 180 second gameplay cutoff');
  return c.mode==='play'?5000:30000;
}
function connection(url) {
  const ws=new WebSocket(url),pending=new Map();let id=0,terminal=null;
  function fail(error){
    terminal??=error;
    for(const p of pending.values()){clearTimeout(p.timer);p.reject(terminal);}
    pending.clear();
  }
  const ready=new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  ws.addEventListener('close',()=>fail(Error('UNKNOWN CDP closed; never replay')));
  ws.addEventListener('error',()=>fail(Error('UNKNOWN CDP error; never replay')));
  ws.onmessage=msg=>{const v=JSON.parse(msg.data);if(v.id){const p=pending.get(v.id);if(p){
    if(v.sessionId!==p.sessionId){fail(Error('UNKNOWN CDP response session changed; never replay'));return;}
    clearTimeout(p.timer);pending.delete(v.id);v.error?p.reject(Error(JSON.stringify(v.error))):p.resolve(v.result);
  }}else api.event(v);};
  const api={ws,ready,event:()=>{},get closed(){return !!terminal;},send(method,params={},sessionId){
    if(terminal)return Promise.reject(terminal);
    return new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>fail(Error('UNKNOWN '+method+'; never replay')),3000);pending.set(n,{resolve,reject,timer,sessionId});try{ws.send(JSON.stringify({id:n,method,params,...(sessionId?{sessionId}:{})}));}catch(e){fail(e);}});
  }};
  return api;
}
function save(out,n,v){const p=path.join(out,n);assert(!fs.existsSync(p),n);fs.writeFileSync(p+'.pending',JSON.stringify(v,null,2)+'\n',{flag:'wx'});fs.renameSync(p+'.pending',p);}
async function release(out,file) {
  const cfg=JSON.parse(fs.readFileSync(file));
  const s=fs.readFileSync('/proc/'+cfg.pid+'/stat','utf8');assert.equal(s.slice(s.lastIndexOf(')')+2).split(' ')[19],cfg.startToken);
  const c=connection(cfg.url);try {await c.ready;
  const session=(await c.send('Target.attachToTarget',{targetId:cfg.targetId,flatten:true})).sessionId;
  async function checkOwner(){if(cfg.owner){
    const live=await c.send('Runtime.evaluate',{expression:require(ROOT+'/'+HELPER).PAGE_READ,returnByValue:true},session);
    assert(!live.exceptionDetails);const apps=live.result.value.apps;assert.equal(apps.length,1);assert.equal(apps[0].name,'gltron');
    for(const key of ['processId','processObject','endpoint','endpointObject','workerObject','moduleObject','epoch','renderEndpoint','renderEndpointObject','renderWorkerObject','renderApi','renderBridgeObject','renderGeneration','pageRendererObject','canvasObject','windowHwnd','windowObject','windowInstance','outputCanvasObject'])assert.equal(apps[0][key],cfg.owner[key],'independent release owner mismatch '+key);
  }}
  async function checkHost(){if(cfg.hostOwner){
    const stat=fs.readFileSync('/proc/'+cfg.pid+'/stat','utf8');assert.equal(stat.slice(stat.lastIndexOf(')')+2).split(' ')[19],cfg.startToken);
    const live=await c.send('Runtime.evaluate',{expression:require(ROOT+'/'+HELPER).HOST_READ,returnByValue:true},session);
    assert(!live.exceptionDetails);require(ROOT+'/'+HELPER).sameHostOwner(cfg.hostOwner,live.result.value);
  }}
  await checkOwner();
  await checkHost();
  const armed=Date.now(),fallback=armed+1750;let due=fallback,pending='';
  process.stdin.on('data',b=>{pending+=b;let i;while((i=pending.indexOf('\n'))>=0){const v=JSON.parse(pending.slice(0,i));pending=pending.slice(i+1);assert(v.at>=armed&&v.at<=fallback);due=Math.min(due,v.at);}});
  process.stdout.write(JSON.stringify({armed:true,at:armed,fallback,session,pid:process.pid})+'\n');
  while(Date.now()<due)await wait(Math.min(5,due-Date.now()));
  await checkOwner();
  await checkHost();
  const fired=Date.now(),receipts=[];
  if(cfg.mouse){assert.equal(cfg.mouse.button,'left');receipts.push(await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,x:cfg.mouse.x,y:cfg.mouse.y,clickCount:1},session));}
  else for(const key of [...cfg.keys].reverse())receipts.push(await c.send('Input.dispatchKeyEvent',{type:'keyUp',key:key==='Space'?' ':key,code:key==='a'?'KeyA':key==='s'?'KeyS':key,windowsVirtualKeyCode:KEYS[key]},session));
  const ack=Date.now();save(out,cfg.name+'-up.json',{armed,fallback,due,fired,ack,receipts,state:'ACK',independent:true});
  await c.send('Target.detachFromTarget',{sessionId:session});
  } finally {c.ws.close();process.stdin.destroy();}
}
async function hostBootstrap({out,evaluate,send,session,owner,browserIdentity,deadline}){
  const binding=require(ROOT+'/'+HELPER),record=(n,v)=>save(out,n,v);
  const checkBrowser=()=>{const s=fs.readFileSync('/proc/'+browserIdentity.pid+'/stat','utf8');assert.equal(s.slice(s.lastIndexOf(')')+2).split(' ')[19],browserIdentity.startToken,'host browser process replaced');};
  assert(!fs.existsSync(out+'/host-bootstrap-attempt.json'),'one host bootstrap; never replay');
  record('host-bootstrap-attempt.json',{at:Date.now(),hostOnly:true,noReplay:true});
  await evaluate(`(() => {if(globalThis.__gltronHostUIEvents)throw Error('host observer already installed');const events=[];Object.defineProperty(globalThis,'__gltronHostUIEvents',{value:events});for(const type of ['mousedown','mouseup','click'])document.addEventListener(type,e=>events.push({type,trusted:e.isTrusted,at:Date.now(),consent:e.target===document.querySelector('#browser-fullscreen-consent button'),canvas:e.target?.tagName==='CANVAS',target:e.target?.id||e.target?.tagName}),true);return true;})()`);
  checkBrowser();const before=await evaluate(binding.HOST_READ);binding.sameHostOwner(owner,before);binding.consentButton(before);
  const at=Date.now(),shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},session),png=Buffer.from(shot.data,'base64');
  assert(Date.now()-at<3000,'host screenshot deadline');
  const scene={at,sha256:sha(png),nonce:crypto.randomUUID(),observation:before,browser:browserIdentity,hostOnly:true,gameAdmission:false};
  binding.reviewHostBootstrap(scene,{sha256:scene.sha256,observation:'geometry consistency only; personal review still required',hostOnly:true},await evaluate(binding.HOST_READ));
  fs.writeFileSync(out+'/host-bootstrap.png',png,{flag:'wx'});record('host-bootstrap.json',scene);
  const reviewFile=out+'/host-review.json';
  while(!fs.existsSync(reviewFile)){assert(Date.now()<Math.min(deadline,at+30000),'bounded personal host review expired');await wait(10);}
  const review=JSON.parse(fs.readFileSync(reviewFile));assert(!review.cancelled,'host review cancelled; permanently closed');assert.equal(review.nonce,scene.nonce,'current host nonce');
  assert.equal(sha(fs.readFileSync(out+'/host-bootstrap.png')),scene.sha256);
  checkBrowser();const point=binding.reviewHostBootstrap(scene,review,await evaluate(binding.HOST_READ));
  record('host-bootstrap-used.json',{nonce:scene.nonce,at:Date.now(),noReplay:true,guestClickAuthorized:false,review});
  const config={...browserIdentity,name:'host-consent',mouse:{...point,button:'left'},hostOwner:owner};record('host-release-config.json',config);
  const child=cp.spawn(process.execPath,[__filename,'release',out,out+'/host-release-config.json'],{stdio:['pipe','pipe','pipe']});
  let stdout='',stderr='',error,down;
  child.stderr.on('data',b=>stderr+=b);const joined=new Promise(r=>child.once('close',(code,signal)=>r({code,signal})));
  try{
    const armed=await new Promise((r,j)=>{const timer=setTimeout(()=>j(Error('host independent release arm timeout')),1000);child.stdout.on('data',b=>{stdout+=b;if(stdout.includes('\n')){clearTimeout(timer);r(JSON.parse(stdout.split('\n')[0]));}});child.once('exit',code=>{if(!stdout){clearTimeout(timer);j(Error('host release child exit '+code));}});});assert(armed.armed);
    checkBrowser();binding.reviewHostBootstrap(scene,review,await evaluate(binding.HOST_READ));
    assert(Date.now()<deadline&&Date.now()<armed.fallback-250,'finite host DOWN window');
    down=Date.now();await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,x:point.x,y:point.y,clickCount:1},session);
    child.stdin.write(JSON.stringify({at:Math.min(armed.fallback,down+120)})+'\n');
  }catch(e){error=e;}
  finally{child.stdin.end();const result=await joined;record('host-release-wait.json',{...result,actualWait:true,stdoutEOF:child.stdout.readableEnded,stderrEOF:child.stderr.readableEnded,stdout,stderr});if(result.code!==0)error??=Error('independent host UP failed');}
  record('host-down.json',{at:down??null,error:error?String(error):null,hostOnly:true});if(error)throw error;
  const up=JSON.parse(fs.readFileSync(out+'/host-consent-up.json'));assert(up.ack-down<=2000,'bounded independent host UP');
  const events=await evaluate('__gltronHostUIEvents');record('host-events.json',{events,canvasMouseEventObserved:events.some(e=>e.canvas)});
  assert.deepEqual(events.map(e=>e.type),['mousedown','mouseup','click'],'one ordinary host click');assert(events.every(e=>e.trusted&&e.consent&&!e.canvas),'trusted host button edges only');
  for(;;){
    checkBrowser();const live=await evaluate(binding.HOST_READ);binding.sameHostOwner(owner,live);
    assert.equal(live.wrap,scene.observation.wrap,'fullscreen target replaced');
    recordObservation(live);
    if(live.fullscreen===live.wrap&&!live.strip.visible&&live.page.apps[0].outputVisible){record('host-fullscreen.json',{at:Date.now(),observation:live,hostOnly:true,gameAdmission:false});return live;}
    assert(Date.now()<Math.min(deadline,up.ack+5000),'trusted consent did not produce visible complete fullscreen scene');await wait(25);
  }
  function recordObservation(v){fs.appendFileSync(out+'/host-fullscreen-observations.jsonl',JSON.stringify(v)+'\n');}
}
async function browser(out,backend) {
  assert(['webgl','controls'].includes(backend));
  const launch=JSON.parse(fs.readFileSync(out+'/launch.json'));
  const pins=JSON.parse(fs.readFileSync(out+'/pins.json'));
  for(const p of pins.files)assert.equal(sha(fs.readFileSync(ROOT+'/'+p.path)),p.sha256,p.path);
  let server,browser,chromeWait,c,session,chain,latest,bound,cutoffTimer,closing=false,phase=false;
  const workers=new Map(),tasks=[];
  const record=(n,v)=>save(out,n,v),log=(n,v)=>fs.appendFileSync(out+'/'+n,JSON.stringify(v)+'\n');
  async function evaluate(expression,s=session){const v=await c.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},s);if(v.exceptionDetails)throw Error(JSON.stringify(v.exceptionDetails));return v.result.value;}
  async function state(){
    const page=await evaluate(`({at:Date.now(),apps:runningApps.map(a=>({name:a.name,running:a.wine?.running,stopped:a.wine?._stopped,processId:a.wine?.processId,slice:a.wine?._workerLastSlice,d3dStats:a.wine?.guestWorker?.d3dStats,exitCode:a.wine?._exitCode})),retiredOwner:globalThis.__gltronPassiveOwner?{processId:__gltronPassiveOwner.processId,running:__gltronPassiveOwner.running,stopped:__gltronPassiveOwner._stopped,nativeExitCode:__gltronPassiveOwner._exitCode??null,processExited:__gltronPassiveOwner._processObject?.exited,processExitCode:__gltronPassiveOwner._processObject?.exitCode}:null,log:document.getElementById('log')?.textContent?.slice(-12000)})`);
    const owners=[];
    for(const w of workers.values())if(!w.closed&&w.url.includes('d3d-render-worker'))owners.push({targetId:w.targetId,sessionId:w.sessionId,value:await evaluate(`Array.from(endpoints,([id,e])=>({id,options:e.options,failed:e.failed?String(e.failed):null,evidence:e.evidence,adapterPresent:!!e.adapter,glObservation:globalThis.__gltronObserver?.snapshot?.()??null,control:e.control?Array.from(e.control):null}))`,w.sessionId)});
    const producers=[];
    for(const w of workers.values())if(!w.closed&&w.url.includes('guest-worker'))producers.push({targetId:w.targetId,value:await evaluate(`typeof instance==='undefined'||!instance?null:({glSwEnabled:instance.exports.gl_sw_enabled?.()??null})`,w.sessionId)});
    const scheduling=await evaluate(`runningApps.map(a=>({name:a.name,stepsPerSlice:a.wine?.stepsPerSlice,frozen:a.wine?.frozen??null,hostSteps:a.wine?._debugStepCount??null}))`);
    return {...page,owners,producers,scheduling,workers:[...workers.values()]};
  }
  async function capture(name){
    assert(/^[a-z0-9-]+$/.test(name));assert(!fs.existsSync(out+'/'+name+'.png'));
    const captured=await chain.capture(name);fs.writeFileSync(out+'/'+name+'.png',captured.png,{flag:'wx'});
    latest=captured.capture;record(name+'.json',{...captured,png:undefined});const observed=await state();record(name+'-state.json',observed);
    if(latest.identity.renderEndpoint!=='none'){
      const owners=observed.owners.flatMap(w=>w.value.filter(e=>e.id===latest.identity.renderEndpoint&&w.targetId===latest.identity.rendererTarget));
      assert.equal(owners.length,1,'unique actual owning backend');assert.equal(owners[0].options.api,latest.identity.renderApi);assert(['gl','gl-gps'].includes(owners[0].options.api));assert.equal(owners[0].options.backend,backend,'actual backend differs from selected arm');assert(!owners[0].failed);
    }
    return latest;
  }
  async function close(reason){
    if(closing)return;closing=true;clearTimeout(cutoffTimer);record('close-reason.json',{reason,at:Date.now(),hostOnly:true});
    if(c)try{await c.send('Browser.close');}catch(e){record('browser-close-error.json',{error:String(e)});}
    if(browser){let timer;try{await Promise.race([chromeWait,new Promise((_,j)=>{timer=setTimeout(()=>j(Error('browser close timeout')),5000);})]);}catch(e){browser.kill('SIGTERM');await chromeWait;}finally{clearTimeout(timer);}}
    c?.ws.close();server?.closeAllConnections();if(server)await new Promise(r=>server.close(r));fs.rmSync(out+'/profile',{recursive:true,force:true});record('closed.json',{at:Date.now(),nativeQuitClaim:false});
  }
  try {
    if(backend!=='controls')cutoffTimer=setTimeout(()=>{phase=true;if(!fs.existsSync(out+'/quit-phase.json'))record('quit-phase.json',{at:Date.now(),cutoff:gameplayCutoff(launch),irreversible:true,reason:'mechanical 180s Quit reserve; no automatic input'});},Math.max(0,gameplayCutoff(launch)-Date.now()));
    server=await require(ROOT+'/test/static-server.js').startStaticServer({root:ROOT,crossOriginIsolated:true,rewritePath:p=>p.startsWith('/binaries/')?'/test'+p:p});
    server.prependListener('request',(req,res)=>{const h=crypto.createHash('sha256');let size=0;const add=b=>{if(b){b=Buffer.isBuffer(b)?b:Buffer.from(b);size+=b.length;h.update(b);}},wr=res.write,en=res.end;res.write=function(b){add(b);return wr.apply(this,arguments);};res.end=function(b){add(b);return en.apply(this,arguments);};res.once('finish',()=>log('http.jsonl',{url:req.url,status:res.statusCode,size,sha256:h.digest('hex')}));});
    const port=server.address().port;
    for(const p of pins.http){const r=await fetch('http://127.0.0.1:'+port+p.url);assert.equal(r.status,200);assert.equal(sha(Buffer.from(await r.arrayBuffer())),p.sha256);}
    record('http-dependency-check.json',{passed:true,pins:pins.http});
    browser=cp.spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--no-first-run','--no-default-browser-check','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--window-size=1024,900','--remote-debugging-port=0','--user-data-dir='+out+'/profile','about:blank'],{stdio:['ignore','pipe','pipe']});
    const stdout=fs.createWriteStream(out+'/chrome.stdout',{flags:'wx'}),stderr=fs.createWriteStream(out+'/chrome.stderr',{flags:'wx'});browser.stdout.pipe(stdout);browser.stderr.pipe(stderr);
    chromeWait=new Promise(r=>browser.once('close',(code,signal)=>{record('chrome-wait.json',{pid:browser.pid,code,signal,actualWait:true,stdoutEOF:browser.stdout.readableEnded,stderrEOF:browser.stderr.readableEnded,at:Date.now()});r();}));
    const stat=fs.readFileSync('/proc/'+browser.pid+'/stat','utf8'),startToken=stat.slice(stat.lastIndexOf(')')+2).split(' ')[19];
    record('browser-pid.json',{pid:browser.pid,startToken,port,at:Date.now()});
    const active=out+'/profile/DevToolsActivePort';for(let n=0;n<100&&!fs.existsSync(active);n++){assert(browser.exitCode===null);await wait(100);}
    const [dp,wp]=fs.readFileSync(active,'utf8').trim().split('\n'),url='ws://127.0.0.1:'+dp+wp;c=connection(url);await c.ready;
    record('endpoint.json',{url,pid:browser.pid,startToken});
    c.event=v=>{
      if(v.method==='Target.attachedToTarget'&&v.params.targetInfo.type==='worker'){
        const {sessionId,targetInfo}=v.params,w={sessionId,targetId:targetInfo.targetId,url:targetInfo.url,scripts:[],closed:false};workers.set(sessionId,w);
        const task=(async()=>{await c.send('Runtime.enable',{},sessionId);await c.send('Runtime.evaluate',{expression:GL_OBSERVER},sessionId);await c.send('Debugger.enable',{},sessionId);await c.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true},sessionId);await c.send('Runtime.runIfWaitingForDebugger',{},sessionId);})();tasks.push(task);task.catch(e=>log('worker-errors.jsonl',{error:String(e)}));
      } else if(v.method==='Target.detachedFromTarget'){const w=workers.get(v.params.sessionId);if(w)w.closed=true;}
      else if(v.method==='Debugger.scriptParsed'&&workers.has(v.sessionId)){
        const w=workers.get(v.sessionId),p=v.params,row={url:p.url,scriptId:p.scriptId};w.scripts.push(row);
        const task=c.send('Debugger.getScriptSource',{scriptId:p.scriptId},v.sessionId).then(s=>{const b=s.bytecode?Buffer.from(s.bytecode,'base64'):Buffer.from(s.scriptSource||'');row.bytecodeAvailable=!!s.bytecode;row.sha256=sha(b);row.size=b.length;});tasks.push(task);task.catch(e=>row.error=String(e));
      } else if(['Runtime.consoleAPICalled','Runtime.exceptionThrown'].includes(v.method))log('console.jsonl',v);
    };
    record('browser-version.json',await c.send('Browser.getVersion'));record('system-info.json',await c.send('SystemInfo.getInfo'));
    const tabs=(await c.send('Target.getTargets')).targetInfos.filter(t=>t.type==='page');assert.equal(tabs.length,1);
    const targetId=tabs[0].targetId;session=(await c.send('Target.attachToTarget',{targetId,flatten:true})).sessionId;
    await c.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true},session);await c.send('Page.enable',{},session);await c.send('Runtime.enable',{},session);
    chain=require(ROOT+'/'+HELPER).createChain({evaluate,send:c.send,workers,pageSession:session,app:'gltron',expectedModules:pins.modules,onTicketObservation:o=>log('capture-ticket-observations.jsonl',o)});
    record('page-target.json',{targetId,session});
    if(backend==='controls'){
      await evaluate(`globalThis.keyProof=[];for(const type of ['keydown','keyup'])addEventListener(type,e=>keyProof.push({type,key:e.key,trusted:e.isTrusted,at:Date.now()}));`);
      const cases=[...Object.keys(KEYS).map(key=>({key,ms:120})),{key:'a',ms:1500},{key:'s',ms:null}];
      for(const [i,{key,ms}] of cases.entries()){
        const name='control-'+i,config={url,pid:browser.pid,startToken,targetId,keys:[key],name};record(name+'-release-config.json',config);
        const child=cp.spawn(process.execPath,[__filename,'release',out,out+'/'+name+'-release-config.json'],{stdio:['pipe','pipe','pipe']});let stdout='',stderr='';child.stderr.on('data',b=>stderr+=b);const joined=new Promise(r=>child.once('close',(code,signal)=>r({code,signal})));
        const armed=await new Promise((r,j)=>{const t=setTimeout(()=>j(Error('native release arm timeout')),1500);child.stdout.on('data',b=>{stdout+=b;if(stdout.includes('\n')){clearTimeout(t);r(JSON.parse(stdout.trim()));}});});assert(armed.armed);
        const before=Date.now();await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:key==='Space'?' ':key,code:key==='a'?'KeyA':key==='s'?'KeyS':key,windowsVirtualKeyCode:KEYS[key]},session);child.stdin.end(ms===null?'':JSON.stringify({at:before+ms})+'\n');
        const result=await joined;record(name+'-wait.json',{...result,actualWait:true,stdoutEOF:child.stdout.readableEnded,stderrEOF:child.stderr.readableEnded,stdout,stderr});assert.equal(result.code,0,stderr);
      }
      const proof=await evaluate('keyProof');assert.equal(proof.length,cases.length*2);assert(proof.every(e=>e.trusted));for(let i=0;i<proof.length;i+=2){assert.equal(proof[i].type,'keydown');assert.equal(proof[i+1].type,'keyup');assert.equal(proof[i].key,proof[i+1].key);assert(proof[i+1].at-proof[i].at<=2000);}
      await evaluate(`globalThis.mouseProof=[];for(const type of ['mousedown','mouseup'])addEventListener(type,e=>mouseProof.push({type,trusted:e.isTrusted,at:Date.now()}));`);
      for(const [i,ms] of [1500,null].entries()){
        const name='mouse-control-'+i,config={url,pid:browser.pid,startToken,targetId,mouse:{button:'left',x:20,y:20},name};record(name+'-release-config.json',config);
        const child=cp.spawn(process.execPath,[__filename,'release',out,out+'/'+name+'-release-config.json'],{stdio:['pipe','pipe','pipe']});let stdout='',stderr='';child.stderr.on('data',b=>stderr+=b);const joined=new Promise(r=>child.once('close',(code,signal)=>r({code,signal})));
        const armed=await new Promise((r,j)=>{const t=setTimeout(()=>j(Error('native mouse release arm timeout')),1500);child.stdout.on('data',b=>{stdout+=b;if(stdout.includes('\n')){clearTimeout(t);r(JSON.parse(stdout.trim()));}});});assert(armed.armed);
        const before=Date.now();await c.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,x:20,y:20,clickCount:1},session);child.stdin.end(ms===null?'':JSON.stringify({at:before+ms})+'\n');
        const result=await joined;record(name+'-wait.json',{...result,actualWait:true,stdoutEOF:child.stdout.readableEnded,stderrEOF:child.stderr.readableEnded,stdout,stderr});assert.equal(result.code,0,stderr);
      }
      const mouseProof=await evaluate('mouseProof');assert.equal(mouseProof.length,4);assert(mouseProof.every(e=>e.trusted));for(let i=0;i<4;i+=2){assert.equal(mouseProof[i].type,'mousedown');assert.equal(mouseProof[i+1].type,'mouseup');assert(mouseProof[i+1].at-mouseProof[i].at<=2000);}
      record('native-controls.json',{passed:true,proof,mouseProof,originalLaunched:false});await close('blank-page native input controls complete');return;
    }
    await c.send('Page.addScriptToEvaluateOnNewDocument',{source:`document.addEventListener('DOMContentLoaded',()=>{const s=document.getElementById('slice-size-select');s.add(new Option('1k task budget','1000'));s.value='1000';},{once:true});`},session);
    await c.send('Page.navigate',{url:'http://127.0.0.1:'+port+'/index.html?debug&threads&gl-renderer=webgl&app=gltron'},session);
    const startupEnd=Math.min(Date.now()+90000,gameplayCutoff(launch));
    for(;;){
      const ready=await evaluate(`typeof runningApps==='undefined'?null:runningApps.map(a=>({name:a.name,running:a.wine?.running,stopped:a.wine?._stopped,worker:!!a.wine?.guestWorker,slice:!!a.wine?._workerLastSlice,glPorts:[...(a.wine?._renderWorkerManager?.ports?.values()||[])].filter(p=>!p.closed&&['gl','gl-gps'].includes(p.options?.api)).length}))`);
      if(ready?.length===1&&ready[0].running&&ready[0].worker&&ready[0].slice&&ready[0].glPorts===1)break;
      assert(!ready?.some(a=>a.stopped),'original stopped during startup');assert(Date.now()<startupEnd,'bounded original startup readiness');await wait(250);
    }
    await Promise.all(tasks);
    // Pin the first identifiable owner before waiting for scene production.
    // It cannot be replaced with a similar-looking initialized owner later.
    const binding=require(ROOT+'/'+HELPER),startupOwner=(await evaluate(binding.PAGE_READ)).apps[0];
    const startupFields=binding.FIELDS.filter(k=>!['outputCanvasObject','workerTarget','workerInstance','moduleSha256','rendererTarget','rendererEpoch','rendererModuleSha256'].includes(k));
    record('startup-owner-observation.json',{identity:startupOwner,outputSelected:false,permanentBound:false});
    for(;;){
      const live=(await evaluate(binding.PAGE_READ)).apps;
      assert(live.length===1&&live[0].running&&!live[0].stopped,'startup owner stopped');
      for(const k of startupFields){assert(startupOwner[k]!==undefined&&startupOwner[k]!==null,'missing startup identity '+k);assert.equal(live[0][k],startupOwner[k],'startup identity changed '+k);}
      const renderers=[...workers.values()].filter(w=>!w.closed&&w.url.includes('d3d-render-worker'));
      const observations=await Promise.all(renderers.map(w=>evaluate('globalThis.__gltronObserver?.snapshot?.()??null',w.sessionId)));
      log('startup-gl-observations.jsonl',{at:Date.now(),observations});
      // A context/first clear/present is not an initialized game scene.
      // These are necessary producer observations only; personal review of
      // the subsequent complete display still precedes permanent binding.
      assert(Date.now()<startupEnd,'bounded original startup readiness');
      if(observations.length===1&&observations[0]?.frontendDraws>0&&observations[0]?.frontendPresents>0&&observations[0]?.draws>0&&observations[0]?.transfers>0)break;
      await wait(25);
    }
    // Output choice is unknown before the first ordinary valid display (the
    // normal compositor can select direct or filtered presentation). Select
    // it exactly once from that receipt; all subsequent reads pin it.
    await hostBootstrap({out,evaluate,send:c.send,session,owner:startupOwner,browserIdentity:{url,pid:browser.pid,startToken,targetId},deadline:startupEnd});
    const selected=await binding.awaitStartupReady({evaluate,identity:startupOwner,deadline:startupEnd,selectOutput:true,onObservation:s=>log('startup-initial-display.jsonl',s)});
    const selectedOwner=await chain.readLive();assert.equal(selectedOwner.identity.outputCanvasObject,selected.outputCanvasObject,'selected startup output replaced');
    const startupReadiness=await chain.prepareStartup(startupEnd,s=>log('startup-readiness.jsonl',s));
    // This is a passive observation, not a promise that paint stays idle
    // across the asynchronous module reads preceding the final arm.
    record('startup-prebind-ready.json',{...startupReadiness,passiveOnly:true,captureRequested:false,permanentBound:false,inputDowns:0,startupDeadline:startupEnd});
    await capture('startup');
    // Permanent binding waits for personally reviewed nonblack submitted WebGL scene.
    record('startup-ready.json',{at:Date.now(),backend,permanentBound:false});
    await evaluate(`(()=>{if(Object.hasOwn(globalThis,'__gltronPassiveOwner'))throw Error('owner reference already bound');Object.defineProperty(globalThis,'__gltronPassiveOwner',{value:runningApps[0].wine});return true;})()`);
    record('ready.json',{at:Date.now(),backend});
    for(let n=0;!closing;n++) {
      const file=out+'/command-'+n+'.json';while(!fs.existsSync(file)&&Date.now()<launch.deadline*1000)await wait(25);
      assert(Date.now()<launch.deadline*1000,'fixed deadline');const cmd=JSON.parse(fs.readFileSync(file));assert(!fs.existsSync(out+'/receipt-'+n+'.json'));
      if(cmd.action==='close'){record('terminal-state.json',await state());await close('reviewed host teardown');record('receipt-'+n+'.json',{state:'ACK',hostOnly:true});break;}
      if(cmd.action==='terminal'){
        assert(phase,'reviewed irreversible Quit phase required');const terminal=await state();assert(terminal.retiredOwner?.processExited===true,'actual original owner has not exited');
        const at=Date.now(),shot=await c.send('Page.captureScreenshot',{format:'png'},session),png=Buffer.from(shot.data,'base64');assert(/^[a-z0-9-]+$/.test(cmd.name));fs.writeFileSync(out+'/'+cmd.name+'.png',png,{flag:'wx'});record(cmd.name+'.json',{at,terminal,pngSHA256:sha(png),nativeQuitClaim:false});record('receipt-'+n+'.json',{state:'ACK',at:Date.now()});continue;
      }
      if(cmd.action==='capture'){await capture(cmd.name);record('receipt-'+n+'.json',{state:'ACK',capture:latest});continue;}
      if(cmd.action==='outcome'){
        assert(bound&&cmd.review===latest.label&&cmd.observation?.trim()&&Date.now()-Date.parse(latest.at)<30000);
        phase=true;if(!fs.existsSync(out+'/quit-phase.json'))record('quit-phase.json',{at:Date.now(),irreversible:true,reason:'personally reviewed native outcome',observation:cmd.observation});
        record('receipt-'+n+'.json',{state:'ACK',at:Date.now()});continue;
      }
      if(cmd.action==='bind'){
        assert(!bound&&cmd.review===latest.label&&cmd.observation?.trim());
        assert(Date.now()-Date.parse(latest.at)<30000,'fresh reviewed initialized scene');
        const observed=await state(),owned=observed.owners.flatMap(w=>w.value.filter(e=>e.id===latest.identity.renderEndpoint&&w.targetId===latest.identity.rendererTarget));
        assert.equal(owned.length,1);const g=owned[0].glObservation;
        assert(g&&g.frontendDraws>0&&g.frontendPresents>0&&g.draws>0&&g.transfers>0&&g.contexts.some(x=>!x.software&&x.hwnd&&x.current&&x.deviceObserved),'actual initialized submitted WebGL required');
        assert(observed.scheduling.every(x=>x.stepsPerSlice===1000),'fixed 1000 block browser launch budget');
        const producer=observed.producers.find(x=>x.targetId===latest.identity.workerTarget);assert.equal(producer?.value?.glSwEnabled,0,'actual owning producer must not select SoftwareGL');
        bound=latest.identity;record('permanent-owner.json',{identity:bound,browser:{pid:browser.pid,startToken,targetId},backend,noReplay:true,review:cmd.observation,scene:latest,actualGL:g});
        record('receipt-'+n+'.json',{state:'ACK',at:Date.now()});continue;
      }
      assert(bound,'permanent reviewed owner required');assert.equal(cmd.action,'pulse');const maxAge=policy(cmd,launch,phase);
      if(cmd.mode==='quit'){phase=true;if(!fs.existsSync(out+'/quit-phase.json'))record('quit-phase.json',{at:Date.now(),cutoff:gameplayCutoff(launch),irreversible:true,route:cmd.route});}
      assert.equal(cmd.review,latest.label);assert(!fs.existsSync(out+'/'+latest.label+'-used.json'),'fresh full scene before each gesture');const review={...latest,review:cmd.observation};record(cmd.name+'-review.json',{...review,mode:cmd.mode,route:cmd.route});
      assert.equal(sha(fs.readFileSync(out+'/'+latest.label+'.png')),latest.sha256,'reviewed fullscene bytes changed');
      require(ROOT+'/'+HELPER).same(bound,latest.identity);
      if(Date.now()-Date.parse(latest.at)>=maxAge){record('receipt-'+n+'.json',{state:'NOT_SENT',effects:0,reason:'fresh scene expired',newIntentOnly:true});continue;}
      record(latest.label+'-used.json',{intent:cmd.name,at:Date.now()});let attempted=false;
      await chain.admit({...review,maxAgeMs:maxAge},async admission=>{
        require(ROOT+'/'+HELPER).same(bound,admission.live.identity);policy(cmd,launch,phase&&cmd.mode!=='quit');
        const config={...JSON.parse(fs.readFileSync(out+'/endpoint.json')),name:cmd.name,targetId,keys:cmd.keys,owner:bound};record(cmd.name+'-release-config.json',config);
        const child=cp.spawn(process.execPath,[__filename,'release',out,out+'/'+cmd.name+'-release-config.json'],{stdio:['pipe','pipe','pipe']});
        let output='',errors='';const joined=new Promise(r=>child.once('close',(code,signal)=>r({code,signal})));child.stderr.on('data',b=>errors+=b);
        const armed=await new Promise((r,j)=>{let timer=setTimeout(()=>j(Error('release prearm timeout')),1000);child.stdout.on('data',b=>{output+=b;if(output.includes('\n')){clearTimeout(timer);r(JSON.parse(output.split('\n')[0]));}});child.once('exit',code=>{if(!output)j(Error('release child exit '+code));});});assert(armed.armed);
        const events=[];let error;
        try {
          const ready=await evaluate(require(ROOT+'/'+HELPER).readinessExpression(bound,false,true));
          assert(ready.ready,'input current display not ready after prearm: '+ready.pending?.join(', '));
          if(Date.now()-Date.parse(latest.at)>=maxAge){record(cmd.name+'-unsent.json',{downEffects:0,state:'CLOSED_BEFORE_DOWN',reason:'expired after prearm; independent UP remains armed'});throw Error('expired after release prearm; permanently close input');}
          for(const key of cmd.keys){assert(Date.now()<armed.fallback-250);attempted=true;const before=Date.now();await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:key==='Space'?' ':key,code:key==='a'?'KeyA':key==='s'?'KeyS':key,windowsVirtualKeyCode:KEYS[key]},session);events.push({key,before,ack:Date.now()});}
          child.stdin.write(JSON.stringify({at:Math.min(armed.fallback,events[0].before+cmd.ms)})+'\n');
        }catch(e){error=e;}
        finally {child.stdin.end();const joinedValue=await joined;record(cmd.name+'-release-wait.json',{...joinedValue,actualWait:true,stdoutEOF:child.stdout.readableEnded,stderrEOF:child.stderr.readableEnded,stdout:output,stderr:errors});assert.equal(joinedValue.code,0);}
        record(cmd.name+'-delivery.json',{events,admission,attempted,error:error?String(error):null});if(error)throw error;
        const up=JSON.parse(fs.readFileSync(out+'/'+cmd.name+'-up.json'));assert(events.every(e=>up.ack-e.before<=2000),'UP acknowledgement exceeded maximum hold');
        const physical=await evaluate(`runningApps.map(a=>({name:a.name,keys:${JSON.stringify(cmd.keys.map(k=>KEYS[k]))}.map(k=>({key:k,down:a.wine?.renderer?.peekKeyDownState(k)}))}))`);record(cmd.name+'-physical.json',{physical,at:Date.now()});assert(physical.every(a=>a.keys.every(k=>k.down===false||k.down===0)),'released physical key state');
      });
      record('receipt-'+n+'.json',{state:attempted?'ACK':'NOT_SENT',effects:attempted?cmd.keys.length:0,noReplay:true,at:Date.now()});
    }
  }catch(e){
    record('failure.json',{error:e.stack,code:e.code??null,inputState:e.inputState??null,ticketObservation:e.ticketObservation??null,captureNonce:e.captureNonce??null,noReplay:true,at:Date.now()});process.exitCode=1;
    if(c&&session)try{const shot=await c.send('Page.captureScreenshot',{format:'png'},session);fs.writeFileSync(out+'/first-failure.png',Buffer.from(shot.data,'base64'),{flag:'wx'});record('first-failure-state.json',await state());}catch(captureError){record('failure-capture-error.json',{error:String(captureError)});}
    await close('first causal failure');
  }
}
if(require.main===module){const [mode,out,arg]=process.argv.slice(2);(mode==='release'?release(out,arg):browser(out,arg)).catch(e=>{console.error(e);process.exitCode=1;});}
module.exports={policy,gameplayCutoff,KEYS,HELPER,sha,connection,release,GL_OBSERVER,hostBootstrap};
