'use strict';
const PROGRAM_ENTERED_AT=Date.now();
// Manual browser controller. No gameplay selection, guest writes, or retries.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..');
const HELPER='scratch/runs/20261108-redline-car-door-native/bound-input.cjs';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const KEYS={ArrowUp:38,ArrowDown:40,ArrowLeft:37,ArrowRight:39,Enter:13,Escape:27,Space:32,Control:17,y:89,n:78};
const QUIT={'open-menu':'Escape','menu-up':'ArrowUp','menu-down':'ArrowDown','select-quit':'Enter','confirm-quit':'y'};
function devtoolsEndpoint(file) {
  if(!fs.existsSync(file))return null;
  const [port,endpoint]=fs.readFileSync(file,'utf8').trim().split('\n');
  return /^\d+$/.test(port)&&Number(port)>0&&Number(port)<=65535&&/^\/devtools\/browser\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(endpoint||'')?'ws://127.0.0.1:'+port+endpoint:null;
}
function policy(c,launch,phase,now=Date.now()) {
  assert(['play','menu','quit'].includes(c.mode));
  assert(Array.isArray(c.keys)&&c.keys.length>=1&&c.keys.length<=2&&new Set(c.keys).size===c.keys.length);
  assert(c.keys.every(k=>Object.hasOwn(KEYS,k)));
  if(c.keys.length===2)assert(c.mode==='play'&&c.keys[0]==='ArrowUp'&&['ArrowLeft','ArrowRight'].includes(c.keys[1]),'ordinary throttle plus manual steering only');
  assert(Number.isInteger(c.ms)&&c.ms>=80&&c.ms<=1400,'finite hold leaves independent UP margin');
  assert(now<launch.deadline*1000,'immutable deadline');
  assert(c.observation?.trim(),'personal scene review required');
  assert(/^[a-z0-9-]{8,100}$/.test(c.nonce||''),'fresh gesture nonce required');
  assert(c.intent?.trim(),'explicit manual intent required');
  if(c.mode!=='play')assert(c.keys.length===1&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter','Escape','y','n'].includes(c.keys[0]));
  if(c.mode==='quit'){
    assert(Object.hasOwn(QUIT,c.route)&&c.keys.length===1&&c.keys[0]===QUIT[c.route],'reviewed native Quit route required');
    if(c.route==='select-quit')assert(['Quit','Quit GTA2','Exit'].includes(c.selectedQuit),'personally reviewed Quit selection required');
  }
  else assert(!phase&&now+3000<(launch.deadline-180)*1000,'irreversible 180 second Quit reserve');
  return c.mode==='play'?5000:30000;
}
function connection(url,onUnknown=()=>{}) {
  const ws=new WebSocket(url),pending=new Map();let id=0,terminal=null,readyResolve,readyReject;
  const ready=new Promise((r,j)=>{readyResolve=r;readyReject=j;});
  const api={ws,ready,event:()=>{},protocol:()=>{},get closed(){return terminal!==null;},stop(){if(terminal)return;terminal='deliberate host teardown';clearTimeout(openTimer);for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error(terminal));}pending.clear();ws.onclose=null;ws.close();},seal(reason){
    if(terminal)return;terminal=String(reason);clearTimeout(openTimer);
    const error=Error('UNKNOWN '+terminal+'; permanently closed; never replay');
    onUnknown({state:'UNKNOWN',reason:terminal,at:Date.now(),permanentClose:true,laterRequestsAllowed:0});
    readyReject(error);for(const p of pending.values()){clearTimeout(p.timer);p.reject(error);}pending.clear();ws.close();
  },send(method,params={},sessionId){
    if(terminal)return Promise.reject(Error('permanently closed '+terminal));
    return new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>api.seal(method+' timeout'),3000);pending.set(n,{resolve,reject,timer,method,sessionId,scriptId:params.scriptId,at:Date.now()});
      try{api.protocol({event:'sent',method,session:sessionId??null,at:Date.now(),type:params.type??null});ws.send(JSON.stringify({id:n,method,params,...(sessionId?{sessionId}:{})}));}catch(e){api.seal(method+' send '+e);}
    });
  }};
  const openTimer=setTimeout(()=>api.seal('connection timeout'),3000);
  ws.onopen=()=>{clearTimeout(openTimer);readyResolve();};
  ws.onerror=()=>api.seal('transport error');ws.onclose=()=>api.seal('transport closed');
  ws.onmessage=msg=>{if(terminal)return;try{const v=JSON.parse(msg.data);if(v.id){const p=pending.get(v.id);if(p){clearTimeout(p.timer);pending.delete(v.id);api.protocol({method:p.method,session:p.sessionId??null,scriptId:p.scriptId??null,at:p.at,ack:Date.now(),ms:Date.now()-p.at,responseBytes:msg.data.length,error:v.error??null});v.error?p.reject(Error(JSON.stringify(v.error))):p.resolve(v.result);}}else api.event(v);}catch(e){api.seal('invalid message '+e);}};
  return api;
}
function save(out,n,v){const p=path.join(out,n);assert(!fs.existsSync(p),n);fs.writeFileSync(p+'.pending',JSON.stringify(v,null,2)+'\n',{flag:'wx'});fs.renameSync(p+'.pending',p);}
async function boundedOperation(c,label,work) {
  let timer;
  try {
    return await Promise.race([Promise.resolve().then(work),new Promise((_,reject)=>{
      timer=setTimeout(()=>{c.seal(label+' exceeded 3000ms');reject(Error('UNKNOWN '+label+'; permanently closed; never replay'));},3000);
    })]);
  } finally {clearTimeout(timer);}
}
async function release(out,file) {
  const cfg=JSON.parse(fs.readFileSync(file)),native=require('./gta2-browser-release-binding.cjs');
  native.checkPID(cfg.pid,cfg.startToken);
  assert(Array.isArray(cfg.keys)&&cfg.keys.length>=1&&cfg.keys.length<=2&&new Set(cfg.keys).size===cfg.keys.length&&cfg.keys.every(k=>Object.hasOwn(KEYS,k)));
  assert(Number.isSafeInteger(cfg.startedAt),'immutable prearm launch time');
  const phases=[];
  const trace=(phase,detail)=>{const at=Date.now();phases.push({phase,at,sinceStarted:at-cfg.startedAt,...(detail?{detail}:{})});};
  trace('release-program-entry',{programEnteredAt:PROGRAM_ENTERED_AT,entryMs:PROGRAM_ENTERED_AT-cfg.startedAt,pid:process.pid});
  const c=connection(cfg.url,v=>save(out,cfg.name+'-UNKNOWN.json',v));
  c.protocol=v=>trace('protocol',v);
  const operationTimer=setTimeout(()=>c.seal('independent release operation exceeded 3000ms'),Math.max(0,3000-(Date.now()-cfg.startedAt)));
  let pending='',scheduled=false,ended=false,due=Infinity,armed,session,prearmTimer;
  process.stdin.on('data',b=>{
    pending+=b;let i;
    while((i=pending.indexOf('\n'))>=0){
      try {const v=JSON.parse(pending.slice(0,i));pending=pending.slice(i+1);
        assert(armed&&Number.isSafeInteger(v.at)&&v.at>=armed.at&&v.at<=armed.fallback,'finite release schedule');
        scheduled=true;due=Math.min(due,v.at);
      }catch(error){ended=true;due=Date.now();}
    }
  });
  process.stdin.on('end',()=>{ended=true;if(!scheduled){due=Date.now();if(!armed)c.seal('parent EOF before independent arm');}});
  try {
    const prepare=(async()=>{
      await c.ready;trace('independent-transport-connected');session=(await c.send('Target.attachToTarget',{targetId:cfg.targetId,flatten:true})).sessionId;trace('independent-page-attached');
      let attestation=null;
      if(cfg.mode==='blank-control'){
        assert(!cfg.owner&&!cfg.review&&!cfg.bindingToken,'blank controls cannot admit a native owner');
        const actual=await native.evaluate(c,session,`({url:location.href,apps:typeof runningApps==='undefined'?0:runningApps.length})`);
        assert.equal(actual.url,'about:blank');assert.equal(actual.apps,0);
      }else{
        assert.equal(cfg.mode,'native');assert(cfg.nonce&&cfg.review&&cfg.owner&&cfg.bindingToken);
        attestation=await native.attestExecuted({c,pageSession:session,cfg,trace});
      }
      assert(!ended,'parent EOF/cancel before arm');native.checkPID(cfg.pid,cfg.startToken);
      const startedAt=cfg.startedAt;assert(Number.isSafeInteger(startedAt)&&Date.now()>=startedAt&&Date.now()-startedAt<=500,'release prearm exceeded 500ms');
      let result;
      if(cfg.mode==='native'){
        attestation.assertCurrent();
        const childToken=crypto.randomUUID();
        result=await native.evaluate(c,session,`__gta2NativeReleasePageV1.arm(${JSON.stringify({
          bindingToken:cfg.bindingToken,nonce:cfg.nonce,intent:cfg.intent,keys:cfg.keys.map(k=>KEYS[k]),childToken,startedAt})})`);
        attestation.assertCurrent();
        assert(result.armed&&result.nonce===cfg.nonce&&result.childToken===childToken);
        assert.deepEqual(result.native,cfg.review.native);assert.deepEqual(result.pageIdentity,cfg.review.pageIdentity);
        save(out,cfg.name+'-attestation.json',{...attestation,nonce:cfg.nonce,childToken,currentHelperSHA256:sha(fs.readFileSync(require.resolve('./gta2-browser-release-binding.cjs')))});
      }else {const at=Date.now();result={armed:true,at,fallback:at+1500,protocolOnly:true};}
      assert(Date.now()-startedAt<=500,'release ACK exceeded 500ms');
      const stat=fs.readFileSync('/proc/'+process.pid+'/stat','utf8');
      armed={...result,pid:process.pid,startToken:stat.slice(stat.lastIndexOf(')')+2).split(' ')[19],session};
      due=Math.min(due,armed.fallback);trace('arm-ack-ready');process.stdout.write(JSON.stringify(armed)+'\n');
    })();
    await Promise.race([prepare,new Promise((_,reject)=>{prearmTimer=setTimeout(()=>{c.seal('release prearm exceeded 500ms');reject(Error('release prearm exceeded 500ms'));},Math.max(0,500-(Date.now()-cfg.startedAt)));})]);
    clearTimeout(prearmTimer);
    while(Date.now()<due)await wait(Math.min(5,due-Date.now()));
    const fired=Date.now(),receipts=[];
    for(const key of [...cfg.keys].reverse())receipts.push(await c.send('Input.dispatchKeyEvent',{type:'keyUp',key:key==='Space'?' ':key,code:key==='Control'?'ControlLeft':key==='y'?'KeyY':key==='n'?'KeyN':key,windowsVirtualKeyCode:KEYS[key]},session));
    const ack=Date.now();assert(ack-armed.at<=1750,'independent UP acknowledgement exceeded 1750ms');
    let released=null;
    if(cfg.mode==='native'){
      if(!scheduled){
        // EOF/cancel is terminal. UP already reached the original renderer;
        // this never authorizes a fresh capture or another intent.
        throw Error('parent EOF/cancel without completed finite schedule');
      }
      released=await native.evaluate(c,session,`__gta2NativeReleasePageV1.finish(${JSON.stringify({nonce:cfg.nonce,childToken:armed.childToken})})`);
      assert.equal(released.state,'RELEASED');
    }
    save(out,cfg.name+'-up.json',{armed:armed.at,fallback:armed.fallback,due,fired,ack,receipts,released,nonce:cfg.nonce??null,state:'ACK',independent:true});
    await c.send('Target.detachFromTarget',{sessionId:session});
  }catch(error){if(!c.closed)c.seal(error);throw error;}
  finally {clearTimeout(prearmTimer);clearTimeout(operationTimer);c.stop();process.stdin.destroy();
    fs.writeFileSync(out+'/'+cfg.name+'-prearm-phases.jsonl',phases.map(row=>JSON.stringify(row)).join('\n')+'\n',{flag:'wx'});}
}
async function releaseGesture({c,session,out,name,keys,ms,cfg,beforeDown=()=>{},onAttempt=()=>{}}) {
  assert(Number.isInteger(ms)&&ms>=80&&ms<=1400);
  const native=require('./gta2-browser-release-binding.cjs'),stat=fs.readFileSync('/proc/'+process.pid+'/stat','utf8');
  const config={...cfg,name,keys,mode:'native',parentPID:process.pid,parentStartToken:stat.slice(stat.lastIndexOf(')')+2).split(' ')[19],startedAt:Date.now()};
  save(out,name+'-release-config.json',config);
  const child=cp.spawn(process.execPath,[__filename,'release',out,out+'/'+name+'-release-config.json'],{stdio:['pipe','pipe','pipe']});
  let output='',errors='',error,armTimer,armed,childError;
  child.stderr.on('data',b=>errors+=b);child.stdin.on('error',e=>{childError=e;});
  const joined=new Promise(resolve=>{child.once('error',e=>{childError=e;});child.once('close',(code,signal)=>resolve({pid:child.pid??null,code,signal}));});
  const events=[];
  try {
    armed=await new Promise((resolve,reject)=>{
      armTimer=setTimeout(()=>reject(Error('release prearm timeout')),Math.max(0,500-(Date.now()-config.startedAt)));
      child.stdout.on('data',b=>{output+=b;if(output.includes('\n')){try{resolve(JSON.parse(output.split('\n')[0]));}catch(e){reject(e);}}});
      child.once('error',reject);child.once('exit',code=>{if(!output.includes('\n'))reject(Error('release child exit '+code));});
    });
    clearTimeout(armTimer);assert(armed.armed&&armed.nonce===cfg.nonce&&Date.now()-config.startedAt<=500,'actual independent child arm within 500ms');
    assert.equal(armed.bindingToken,cfg.bindingToken);assert.deepEqual(armed.native,cfg.review.native);assert.deepEqual(armed.pageIdentity,cfg.review.pageIdentity);
    native.checkPID(armed.pid,armed.startToken);
    for(const key of keys){
      await beforeDown();native.verifyPins(cfg.pins);native.checkPID(cfg.pid,cfg.startToken);
      assert(Date.now()<armed.fallback-250,'native release lease expired');
      const before=Date.now();onAttempt();
      await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:key==='Space'?' ':key,code:key==='Control'?'ControlLeft':key==='y'?'KeyY':key==='n'?'KeyN':key,windowsVirtualKeyCode:KEYS[key]},session);
      const consumed=await native.evaluate(c,session,`__gta2NativeReleasePageV1.consumed(${JSON.stringify({nonce:cfg.nonce,key:KEYS[key]})})`);
      assert.equal(consumed.state,'CONSUMED');assert.equal(consumed.nonce,cfg.nonce);
      events.push({key,before,ack:Date.now(),consumed});
    }
    child.stdin.write(JSON.stringify({at:Math.min(armed.fallback,events[0].consumed.at+ms)})+'\n');
  }catch(e){error=e;}
  finally {
    clearTimeout(armTimer);child.stdin.end();const result=await joined;
    save(out,name+'-release-wait.json',{...result,actualWait:true,stdoutEOF:child.stdout.readableEnded,stderrEOF:child.stderr.readableEnded,stdout:output,stderr:errors});
    if(result.code!==0)error??=Error('release child failed '+result.code+' '+errors);
    error??=childError;
  }
  if(error){if(!c.closed)c.seal(error);throw error;}
  const up=JSON.parse(fs.readFileSync(out+'/'+name+'-up.json'));
  assert(up.released?.physicalUp,'independent original renderer physical UP required');
  assert(events.every(e=>up.ack-e.before<=1750),'physical UP exceeded 1750ms');
  for(const key of keys){
    const edges=up.released.events.filter(e=>e.key===KEYS[key]);assert.deepEqual(edges.map(e=>e.type),['DOWN','UP']);
    assert(edges[1].at-edges[0].at>=80&&edges[1].at-edges[0].at<=1400,'actual original physical edge order/bounds');
  }
  return {armed,events,up,noReplay:true};
}
async function browser(out,backend) {
  assert(['software','webgl','controls'].includes(backend));
  const launch=JSON.parse(fs.readFileSync(out+'/launch.json'));
  const pins=JSON.parse(fs.readFileSync(out+'/pins.json'));
  function verifyPins(){for(const p of pins.files)assert.equal(sha(fs.readFileSync(ROOT+'/'+p.path)),p.sha256,p.path);}
  verifyPins();const pinMap=new Map(pins.files.map(p=>['/'+p.path,p.sha256]));
  let server,browser,chromeWait,c,session,chain,latest,bound,bridgeOptions,closing=false,phase=false;
  const workers=new Map(),tasks=[];
  const record=(n,v)=>save(out,n,v),log=(n,v)=>fs.appendFileSync(out+'/'+n,JSON.stringify(v)+'\n');
  async function evaluate(expression,s=session){const v=await c.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},s);if(v.exceptionDetails)throw Error(JSON.stringify(v.exceptionDetails));return v.result.value;}
  async function state(){
    const page=await evaluate(`({at:Date.now(),apps:runningApps.map(a=>({name:a.name,running:a.wine?.running,stopped:a.wine?._stopped,processId:a.wine?.processId,slice:a.wine?._workerLastSlice,d3dStats:a.wine?.guestWorker?.d3dStats,exitCode:a.wine?._exitCode})),retiredOwner:globalThis.__gta2PassiveOwner?{processId:__gta2PassiveOwner.processId,running:__gta2PassiveOwner.running,stopped:__gta2PassiveOwner._stopped,nativeExitCode:__gta2PassiveOwner._exitCode??null,processExited:__gta2PassiveOwner._processObject?.exited,processExitCode:__gta2PassiveOwner._processObject?.exitCode}:null,log:document.getElementById('log')?.textContent?.slice(-12000)})`);
    const owners=[];
    for(const w of workers.values())if(!w.closed&&w.url.includes('d3d-render-worker'))owners.push({targetId:w.targetId,sessionId:w.sessionId,value:await evaluate(`Array.from(endpoints,([id,e])=>({id,options:e.options,failed:e.failed?String(e.failed):null,evidence:e.evidence,adapterPresent:!!e.adapter,targets:e.adapter?.inspectTargets?.()??null,software:e.adapter?.d3dimSoftwareDrawCallsCompleted??null,control:e.control?Array.from(e.control):null}))`,w.sessionId)});
    return {...page,owners,workers:[...workers.values()]};
  }
  async function capture(name){
    verifyPins();assert(/^[a-z0-9-]+$/.test(name));assert(!fs.existsSync(out+'/'+name+'.png'));
    const nativeBefore=await evaluate('__gta2NativeReleasePageV1.read()');
    const captured=await chain.capture(name);
    const nativeAfter=await evaluate('__gta2NativeReleasePageV1.read()');assert.deepEqual(nativeBefore,nativeAfter,'native scene changed during full capture');
    captured.capture.nativeReview={...nativeAfter,capturedAt:Date.parse(captured.capture.at),pngSHA256:captured.capture.sha256};
    fs.writeFileSync(out+'/'+name+'.png',captured.png,{flag:'wx'});
    latest=captured.capture;record(name+'.json',{...captured,png:undefined});const observed=await state();record(name+'-state.json',observed);
    if(latest.identity.renderEndpoint!=='none'){
      const owners=observed.owners.flatMap(w=>w.value.filter(e=>e.id===latest.identity.renderEndpoint&&w.targetId===latest.identity.rendererTarget));
      assert.equal(owners.length,1,'unique actual owning backend');assert.equal(owners[0].options.api,'legacy');assert.equal(owners[0].options.backend,backend,'actual backend differs from selected arm');assert(!owners[0].failed);
    }
    return latest;
  }
  async function close(reason){
    if(closing)return;closing=true;record('close-reason.json',{reason,at:Date.now(),hostOnly:true});
    if(c){c.event=()=>{};c.stop();} // Host teardown uses OS signals; no later CDP request after failure.
    if(browser){browser.kill('SIGTERM');let timer;try{await Promise.race([chromeWait,new Promise((_,j)=>{timer=setTimeout(()=>j(Error('browser close timeout')),3000);})]);}catch(e){browser.kill('SIGKILL');await chromeWait;}finally{clearTimeout(timer);}}
    c?.ws.close();server?.closeAllConnections();if(server)await new Promise(r=>server.close(r));fs.rmSync(out+'/profile',{recursive:true,force:true});record('closed.json',{at:Date.now(),nativeQuitClaim:false});
  }
  try {
    server=await require(ROOT+'/test/static-server.js').startStaticServer({root:ROOT,crossOriginIsolated:true,rewritePath:p=>p.startsWith('/binaries/')?'/test'+p:p});
    server.prependListener('request',(req,res)=>{const h=crypto.createHash('sha256');let size=0;const add=b=>{if(b){b=Buffer.isBuffer(b)?b:Buffer.from(b);size+=b.length;h.update(b);}},wr=res.write,en=res.end;res.write=function(b){add(b);return wr.apply(this,arguments);};res.end=function(b){add(b);return en.apply(this,arguments);};res.once('finish',()=>{const hash=h.digest('hex'),url=new URL(req.url,'http://localhost').pathname,file=url.startsWith('/binaries/')?'/test'+url:url;log('http.jsonl',{url:req.url,status:res.statusCode,size,sha256:hash});if(res.statusCode===200&&pinMap.has(file)&&pinMap.get(file)!==hash)c?.seal('HTTP pin mismatch '+file);});});
    const port=server.address().port;
    for(const p of pins.http){const r=await fetch('http://127.0.0.1:'+port+p.url);assert.equal(r.status,200);assert.equal(sha(Buffer.from(await r.arrayBuffer())),p.sha256);}
    record('http-dependency-check.json',{passed:true,pins:pins.http});
    browser=cp.spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--no-first-run','--no-default-browser-check','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--window-size=1024,900','--remote-debugging-port=0','--user-data-dir='+out+'/profile','about:blank'],{stdio:['ignore','pipe','pipe']});
    const stdout=fs.createWriteStream(out+'/chrome.stdout',{flags:'wx'}),stderr=fs.createWriteStream(out+'/chrome.stderr',{flags:'wx'});browser.stdout.pipe(stdout);browser.stderr.pipe(stderr);
    chromeWait=new Promise(r=>browser.once('close',(code,signal)=>{record('chrome-wait.json',{pid:browser.pid,code,signal,actualWait:true,stdoutEOF:browser.stdout.readableEnded,stderrEOF:browser.stderr.readableEnded,at:Date.now()});r();}));
    const stat=fs.readFileSync('/proc/'+browser.pid+'/stat','utf8'),startToken=stat.slice(stat.lastIndexOf(')')+2).split(' ')[19];
    record('browser-pid.json',{pid:browser.pid,startToken,port,at:Date.now()});
    const active=out+'/profile/DevToolsActivePort',endpointDeadline=Date.now()+3000;let url;
    while(!(url=devtoolsEndpoint(active))){assert(browser.exitCode===null);assert(Date.now()<endpointDeadline,'complete Chrome endpoint within 3000ms');await wait(25);}
    c=connection(url,v=>record('UNKNOWN.json',v));await c.ready;
    record('endpoint.json',{url,pid:browser.pid,startToken});
    c.event=v=>{
      if(v.method==='Target.attachedToTarget'&&v.params.targetInfo.type==='worker'){
        const {sessionId,targetInfo}=v.params,w={sessionId,targetId:targetInfo.targetId,url:targetInfo.url,scripts:[],closed:false};workers.set(sessionId,w);
        const task=(async()=>{await c.send('Runtime.enable',{},sessionId);await c.send('Debugger.enable',{},sessionId);await c.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true},sessionId);await c.send('Runtime.runIfWaitingForDebugger',{},sessionId);})();tasks.push(task);task.catch(e=>log('worker-errors.jsonl',{error:String(e)}));
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
    chain=require(ROOT+'/'+HELPER).createChain({evaluate,send:c.send,workers,pageSession:session,app:'gta2_demo',expectedModules:pins.modules});
    record('page-target.json',{targetId,session});
    if(backend==='controls'){
      await evaluate(`globalThis.keyProof=[];for(const type of ['keydown','keyup'])addEventListener(type,e=>keyProof.push({type,key:e.key,trusted:e.isTrusted,at:Date.now()}));`);
      for(const [i,key] of Object.keys(KEYS).entries()){
        const name='control-'+i,config={url,pid:browser.pid,startToken,targetId,keys:[key],name,mode:'blank-control',startedAt:Date.now()};record(name+'-release-config.json',config);
        const child=cp.spawn(process.execPath,[__filename,'release',out,out+'/'+name+'-release-config.json'],{stdio:['pipe','pipe','pipe']});let stdout='',stderr='',stdinError;child.stdin.on('error',e=>stdinError=e);child.stderr.on('data',b=>stderr+=b);const joined=new Promise(r=>child.once('close',(code,signal)=>r({code,signal})));
        let armed,result,armError;
        try {
          armed=await new Promise((r,j)=>{const t=setTimeout(()=>j(Error('native release arm timeout')),Math.max(0,500-(Date.now()-config.startedAt)));child.stdout.on('data',b=>{stdout+=b;if(stdout.includes('\n')){clearTimeout(t);try{r(JSON.parse(stdout.split('\n')[0]));}catch(e){j(e);}}});child.once('error',e=>{clearTimeout(t);j(e);});child.once('exit',code=>{if(!stdout){clearTimeout(t);j(Error('release child exit '+code));}});});
          assert(armed.armed&&Date.now()-config.startedAt<=500);
          const before=Date.now();await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:key==='Space'?' ':key,code:key==='Control'?'ControlLeft':key==='y'?'KeyY':key==='n'?'KeyN':key,windowsVirtualKeyCode:KEYS[key]},session);child.stdin.write(JSON.stringify({at:before+120})+'\n');
        }catch(error){armError=error;}
        finally{child.stdin.end();result=await joined;record(name+'-wait.json',{...result,pid:child.pid,actualWait:true,stdoutEOF:child.stdout.readableEnded,stderrEOF:child.stderr.readableEnded,stdout,stderr});}
        if(armError||stdinError)throw armError||stdinError;assert.equal(result.code,0,stderr);
      }
      const proof=await evaluate('keyProof');assert.equal(proof.length,Object.keys(KEYS).length*2);assert(proof.every(e=>e.trusted));for(let i=0;i<proof.length;i+=2){assert.equal(proof[i].type,'keydown');assert.equal(proof[i+1].type,'keyup');assert.equal(proof[i].key,proof[i+1].key);assert(proof[i+1].at-proof[i].at<=1750);}
      record('native-controls.json',{passed:true,proof,originalLaunched:false});await close('blank-page native input controls complete');return;
    }
    await c.send('Page.navigate',{url:'http://127.0.0.1:'+port+'/index.html?debug&threads&d3d-renderer='+backend+'&app=gta2_demo'},session);
    const startupEnd=Math.min(Date.now()+60000,(launch.deadline-180)*1000);
    for(;;){
      const fatal=await evaluate(`!!document.getElementById('wine-crash-report')`);if(fatal){const shot=await c.send('Page.captureScreenshot',{format:'png'},session);const png=Buffer.from(shot.data,'base64');fs.writeFileSync(out+'/startup-failure.png',png,{flag:'wx'});record('startup-failure.json',{at:Date.now(),sha256:sha(png),diagnostic:true,nativeQuit:false});throw Error('original fatal launch report');}
      const ready=await evaluate(`typeof runningApps==='undefined'?null:runningApps.map(a=>({name:a.name,running:a.wine?.running,stopped:a.wine?._stopped,worker:!!a.wine?.guestWorker,slice:!!a.wine?._workerLastSlice}))`);
      if(ready?.length===1&&ready[0].running&&ready[0].worker&&ready[0].slice)break;
      assert(!ready?.some(a=>a.stopped),'original stopped during startup');assert(Date.now()<startupEnd,'bounded original startup readiness');await wait(250);
    }
    await Promise.all(tasks);record('executed-sources.json',{workers:[...workers.values()]});
    bridgeOptions=await require('./gta2-browser-release-binding.cjs').install({c,pageSession:session,workers,app:'gta2_demo',backend});
    record('native-bridge.json',{bridgeOptions});await boundedOperation(c,'startup capture',()=>capture('startup'));
    bound=latest.identity;record('permanent-owner.json',{identity:bound,browser:{pid:browser.pid,startToken},backend,noReplay:true});
    await evaluate(`(()=>{if(Object.hasOwn(globalThis,'__gta2PassiveOwner'))throw Error('owner reference already bound');Object.defineProperty(globalThis,'__gta2PassiveOwner',{value:runningApps[0].wine});return true;})()`);
    record('ready.json',{at:Date.now(),backend});
    for(let n=0;!closing;n++) {
      const file=out+'/command-'+n+'.json';while(!fs.existsSync(file)&&Date.now()<launch.deadline*1000)await wait(25);
      assert(Date.now()<launch.deadline*1000,'fixed deadline');const cmd=JSON.parse(fs.readFileSync(file));assert(!fs.existsSync(out+'/receipt-'+n+'.json'));
      await boundedOperation(c,'manual operation '+cmd.action,async()=>{
      if(cmd.action==='close'){record('terminal-state.json',await state());await close('reviewed host teardown');record('receipt-'+n+'.json',{state:'ACK',hostOnly:true});return;}
      if(cmd.action==='terminal'){
        assert(phase,'reviewed irreversible Quit phase required');const terminal=await state();assert(terminal.retiredOwner?.processExited===true,'actual original owner has not exited');
        const at=Date.now(),shot=await c.send('Page.captureScreenshot',{format:'png'},session),png=Buffer.from(shot.data,'base64');assert(/^[a-z0-9-]+$/.test(cmd.name));fs.writeFileSync(out+'/'+cmd.name+'.png',png,{flag:'wx'});record(cmd.name+'.json',{at,terminal,pngSHA256:sha(png),nativeQuitClaim:false});record('receipt-'+n+'.json',{state:'ACK',at:Date.now()});return;
      }
      if(cmd.action==='capture'){await capture(cmd.name);record('receipt-'+n+'.json',{state:'ACK',capture:latest});return;}
      assert.equal(cmd.action,'pulse');verifyPins();const maxAge=policy(cmd,launch,phase);assert(!fs.existsSync(out+'/nonce-'+cmd.nonce+'.json'),'gesture nonce cannot be reused');record('nonce-'+cmd.nonce+'.json',{intent:cmd.intent,name:cmd.name,at:Date.now()});
      if(cmd.mode==='quit'){phase=true;if(!fs.existsSync(out+'/quit-phase.json'))record('quit-phase.json',{at:Date.now(),cutoff:(launch.deadline-180)*1000,irreversible:true,route:cmd.route});}
      assert.equal(cmd.review,latest.label);assert(!fs.existsSync(out+'/'+latest.label+'-used.json'),'fresh full scene before each gesture');const review={...latest,review:cmd.observation};record(cmd.name+'-review.json',{...review,mode:cmd.mode,route:cmd.route});
      assert.equal(sha(fs.readFileSync(out+'/'+latest.label+'.png')),latest.sha256,'reviewed fullscene bytes changed');
      require(ROOT+'/'+HELPER).same(bound,latest.identity);
      if(Date.now()-Date.parse(latest.at)>=maxAge){record('receipt-'+n+'.json',{state:'NOT_SENT',effects:0,reason:'fresh scene expired',newIntentOnly:true});return;}
      record(latest.label+'-used.json',{intent:cmd.name,at:Date.now()});let attempted=false;
      await chain.admit(review,async admission=>{
        require(ROOT+'/'+HELPER).same(bound,admission.live.identity);policy(cmd,launch,phase&&cmd.mode!=='quit');
        const nativeReview={...latest.nativeReview,reviewed:true,observation:cmd.observation,maxAgeMs:maxAge};
        const binding=await evaluate(`__gta2NativeReleasePageV1.bind(${JSON.stringify(nativeReview)})`);
        const result=await releaseGesture({c,session,out,name:cmd.name,keys:cmd.keys,ms:cmd.ms,
          cfg:{...JSON.parse(fs.readFileSync(out+'/endpoint.json')),targetId,owner:bound,pins,bridgeOptions,
            review:nativeReview,bindingToken:binding.bindingToken,nonce:cmd.nonce,intent:cmd.intent},
          beforeDown:()=>{verifyPins();policy(cmd,launch,phase&&cmd.mode!=='quit');},
          onAttempt:()=>{attempted=true;}});
        record(cmd.name+'-delivery.json',{...result,admission,attempted});
      });
      record('receipt-'+n+'.json',{state:attempted?'ACK':'NOT_SENT',effects:attempted?cmd.keys.length:0,noReplay:true,at:Date.now()});
      });
    }
  }catch(e){if(!fs.existsSync(out+'/executed-sources.json'))record('executed-sources.json',{workers:[...workers.values()]});if(c&&!c.closed)c.seal('first causal failure: '+e);if(!fs.existsSync(out+'/UNKNOWN.json'))record('UNKNOWN.json',{state:'UNKNOWN',reason:String(e),at:Date.now(),permanentClose:true,laterRequestsAllowed:0});record('failure.json',{error:e.stack,noReplay:true,at:Date.now()});process.exitCode=1;await close('first causal failure');}
}
if(require.main===module){const [mode,out,arg]=process.argv.slice(2);(mode==='release'?release(out,arg):browser(out,arg)).catch(e=>{console.error(e);process.exitCode=1;});}
module.exports={policy,KEYS,HELPER,sha,connection,release,releaseGesture,boundedOperation,devtoolsEndpoint};
