'use strict';
// One native-CDP browser. Only explicit fixture mode substitutes a small PE.
const fs=require('node:fs'),cp=require('node:child_process'),crypto=require('node:crypto'),path=require('node:path'),assert=require('node:assert/strict');
const zlib=require('node:zlib'),{pipeline}=require('node:stream/promises');
const {createLifecycle,observeChild}=require('./redline-fixture-shutdown.cjs');
const {observeStartup,portPublication,publicationSnapshot}=require('./redline-chrome-startup.cjs');
const root=path.resolve(__dirname,'..'),run=path.resolve(process.env.REDLINE_RUN||root+'/scratch/runs/20261108-redline-car-door-native');
const fixture=process.env.REDLINE_NATIVE_FIXTURE==='1'?require('./redline-production-fixture.cjs'):null;
const {observeHold}=require('./redline-key-delivery.cjs');
if(fixture)assert(!process.env.NO_ORIGINAL&&!process.env.WEBGL_QUALIFY&&!process.env.TR2_GENERATED,'fixture requires the production startup route');
const bound=require(run+'/bound-input.cjs');
const out=run+'/'+(fixture?'native-fixture':process.env.NO_ORIGINAL?'production-preflight':process.env.WEBGL_QUALIFY?'webgl-qualify':process.env.TR2_GENERATED?'generated-v2':'original'),t=require(run+'/transport.cjs');

const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),save=(n,v)=>t.publish(out+'/'+n,v),log=(n,v)=>fs.appendFileSync(out+'/'+n,JSON.stringify(v)+'\n'),wait=ms=>new Promise(r=>setTimeout(r,ms));
const pins=JSON.parse(fs.readFileSync(run+'/runtime-pins.json'));
for(const p of pins.files){const b=fs.readFileSync(root+'/'+p.path);assert.equal(sha(b),p.sha256,p.path);assert.equal(b.length,p.size);}
if(fixture)for(const name of ['tools/redline-native-fixture.cjs','tools/redline-production-fixture.cjs','tools/redline-fixture-shutdown.cjs'])assert.equal(pins.files.filter(p=>p.path===name).length,1,'fixture provider must be in verified closure: '+name);
if(!process.env.NO_ORIGINAL&&!process.env.WEBGL_QUALIFY&&!process.env.TR2_GENERATED){
  for(const name of ['host.js','tools/redline-browser-run.cjs','tools/redline-startup.cjs','tools/redline-fixture-shutdown.cjs','tools/redline-chrome-startup.cjs','tools/redline-key-delivery.cjs','lib/redline-startup-admission.js'])
  assert.equal(pins.files.filter(p=>p.path===name).length,1,'startup provider must be in verified closure: '+name);
}
const start=Date.now(),deadline=Number(process.env.BROWSER_DEADLINE);assert(Number.isFinite(deadline)&&deadline>start&&deadline-start<30*60000);if(process.env.DRIVER_PREFLIGHT==='1'){console.log(JSON.stringify({passed:true,start,deadline,remainingMs:deadline-start,strictLimitMs:30*60000,pins:pins.files.length,chromiumStarted:false,originalStarted:false}));process.exit(0);}fs.mkdirSync(out);fs.mkdirSync(out+'/commands');save('execution-window.json',{start:new Date(start).toISOString(),browserStop:new Date(deadline).toISOString(),replayAllowed:false});
let browser,server,ws,pageSession,chain,closing=false,latest=null,timer;let cdpMousePoint=null;let id=0;const pending=new Map(),workers=new Map(),workerPromises=[];
let browserExit,shutdown,serverAcquisition,firstFailure,startupEvidence,endpointAdmitted=false;const streams=[];
function send(method,params={},sessionId){if(closing&&method!=='Browser.close')return Promise.reject(Error('runtime terminal; no further input/capture'));if(method==='Input.dispatchMouseEvent'&&Number.isFinite(params.x)&&Number.isFinite(params.y))cdpMousePoint={x:params.x,y:params.y};return new Promise((resolve,reject)=>{const n=++id;const timer=setTimeout(()=>{pending.delete(n);reject(Error('CDP UNKNOWN '+method+'; no replay'));},20000);pending.set(n,{resolve,reject,timer});ws.send(JSON.stringify({id:n,method,params,...(sessionId?{sessionId}:{})}));});}
async function evaluate(expression,sessionId=pageSession){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sessionId);if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
async function event(v){
 if(v.method==='Target.attachedToTarget'){
  const {sessionId,targetInfo}=v.params;
  if(targetInfo.type==='worker'){
   workers.set(sessionId,{sessionId,targetId:targetInfo.targetId,url:targetInfo.url,scripts:[],closed:false});
   const task=(async()=>{await send('Runtime.enable',{},sessionId);await send('Debugger.enable',{},sessionId);await evaluate(fs.readFileSync(run+'/input-observer.js','utf8'),sessionId);await send('Runtime.runIfWaitingForDebugger',{},sessionId);})();workerPromises.push(task);task.catch(e=>log('worker-errors.jsonl',{at:new Date().toISOString(),error:String(e)}));
  }
 }
 if(v.method==='Target.detachedFromTarget'){const w=workers.get(v.params.sessionId);if(w)w.closed=true;}
 if(v.method==='Debugger.scriptParsed'&&workers.has(v.sessionId)){
  const s=v.params;if(s.scriptLanguage!=='WebAssembly'&&!s.url.startsWith('wasm://'))return;
  const row={url:s.url,scriptId:s.scriptId,cdpHash:s.hash};workers.get(v.sessionId).scripts.push(row);
  const task=send('Debugger.getScriptSource',{scriptId:s.scriptId},v.sessionId).then(r=>{row.bytecodeAvailable=!!r.bytecode;if(r.bytecode){const b=Buffer.from(r.bytecode,'base64');row.sha256=sha(b);row.bytes=b.length;const file=out+'/module-'+row.sha256+'.wasm';if(!fs.existsSync(file))fs.writeFileSync(file,b,{flag:'wx'});}}).catch(e=>{row.error=String(e);});workerPromises.push(task);
 }
 if(v.method==='Runtime.consoleAPICalled')log('console.jsonl',{at:new Date().toISOString(),session:v.sessionId,type:v.params.type,args:v.params.args.map(a=>a.value??a.description)});
 if(v.method==='Runtime.exceptionThrown')log('exceptions.jsonl',{at:new Date().toISOString(),session:v.sessionId,details:v.params.exceptionDetails});
}
async function state(){
 const page=await evaluate(`(()=>{const all=typeof runningApps==='undefined'?[]:runningApps;const c=document.getElementById('screen'),r=c?.getBoundingClientRect();return {at:new Date().toISOString(),isolated:crossOriginIsolated,canvas:c?{width:c.width,height:c.height,rect:{left:r.left,top:r.top,width:r.width,height:r.height}}:null,apps:all.map(a=>{const w=a.wine;return {name:a.name,processId:w?.processId,running:w?.running,stopped:w?._stopped,guestWorker:!!w?.guestWorker,endpoint:w?.guestWorker?.link?.endpointIdentity,slot:w?.guestWorker?.link?.slot,d3dStats:w?.guestWorker?.d3dStats,slice:w?._workerLastSlice,renderEndpoints:[...(w?._renderWorkerManager?.ports?.values()||[])].map(p=>({id:p.id,options:p.options,closed:p.closed})),threads:[...(w?.threadManager?.threads?.values()||[])].map(t=>({tid:t.tid,state:t.state,slot:t.link?.slot,d3dStats:t.link?.d3dStats}))}}),log:document.getElementById('log')?.textContent?.slice(-8000)}})()`);
 await Promise.all(workerPromises);
 const owners=[];for(const w of workers.values())if(w.url.includes('d3d-render-worker')&&!w.closed){try{owners.push({sessionId:w.sessionId,targetId:w.targetId,url:w.url,endpoints:await evaluate(`Array.from(endpoints,([id,e])=>({id,options:e.options,failed:e.failed?String(e.failed):null,evidence:e.evidence,adapterStats:e.adapter?.stats??null,adapterPresent:!!e.adapter,adapterSoftwareDrawCallsCompleted:e.adapter?.d3dimSoftwareDrawCallsCompleted??null,control:e.control?{ready:Atomics.load(e.control,0),completed:Atomics.load(e.control,1),error:Atomics.load(e.control,2),batches:Atomics.load(e.control,4),commands:Atomics.load(e.control,5)}:null}))`,w.sessionId)});}catch(e){owners.push({sessionId:w.sessionId,error:String(e)});}}
 return {...page,workers:[...workers.values()],owningRenderer:owners};
}
async function traceSnapshot(label){for(const w of workers.values())if(!w.closed){try{const v=await evaluate('globalThis.__inputConsumption?.snapshot()',w.sessionId);if(v)save(label+'-trace-'+w.targetId+'.json',v)}catch(e){log('trace-errors.jsonl',{label,error:String(e)})}}}
async function capture(label){assert(!closing,'runtime terminal; no further capture');assert(/^[a-z0-9-]+$/.test(label));assert(!fs.existsSync(out+'/'+label+'.png'));const s=await state();assert(!closing,'runtime terminal; no further capture');save(label+'-state.json',s);save(label+'-mouse-events.json',await evaluate('({events:globalThis.__nativeMouseEvents,locked:document.pointerLockElement===document.getElementById("screen")})'));const shot=await chain.capture(label);assert(!closing,'runtime terminal; discard unsettled capture');fs.writeFileSync(out+'/'+label+'.png',shot.png,{flag:'wx'});latest=shot.capture;save(label+'-binding.json',{before:shot.before,after:shot.after});save(label+'-capture.json',latest);save('latest.json',latest);await traceSnapshot(label);console.log('CAPTURE '+label);}
function close(reason){if(shutdown)return shutdown;closing=true;clearTimeout(timer);save('close-reason.json',{at:new Date().toISOString(),reason});
 const lifecycle=createLifecycle({initialFailure:firstFailure,resources:()=>({browser,server,exit:browserExit,streams,streamHandles:[browser?.stdout,browser?.stderr].filter(Boolean),tasks:workerPromises}),
  stopProtocol:()=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('runtime closed; no replay'));}pending.clear();if(ws)ws.onmessage=null;},
  closeBrowser:onError=>{if(ws?.readyState===1){const n=++id;ws.onmessage=msg=>{const v=JSON.parse(msg.data);if(v.id===n&&v.error)onError(Error(JSON.stringify(v.error)));};ws.send(JSON.stringify({id:n,method:'Browser.close',params:{}}));}},
  finalize:receipt=>{ws?.close();save('shutdown.json',{...receipt,startupEvidence,postTerminalPublication:publicationSnapshot(out+'/chrome-profile/DevToolsActivePort'),firstFailure:receipt.firstFailure?String(receipt.firstFailure):null});assert(!browser||receipt.actualBrowserExit,'actual browser wait required');if(receipt.streamEOF)fs.rmSync(out+'/chrome-profile',{recursive:true,force:true});assert(receipt.streamEOF,'browser stream EOF required');if(browser)assert.equal(receipt.actualBrowserExit.code,0,'normal browser exit required');t.closed(out,browser?.exitCode);console.log('TERMINAL '+reason);}});
 shutdown=lifecycle.run(async()=>{await serverAcquisition;});return shutdown;}
function fail(error,reason='first terminal failure'){firstFailure??=error;closing=true;process.exitCode=1;if(!fs.existsSync(out+'/first-browser-failure.json'))save('first-browser-failure.json',{at:new Date().toISOString(),error:firstFailure.stack??String(firstFailure),noReplay:true});return close(reason).catch(cleanupError=>{save('shutdown-failure.json',{error:String(cleanupError)});});}
if(process.once)for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{fail(Error(signal),signal);});
async function execute(c,markDispatch){
 if(c.action==='relative')require(run+'/relative-input.cjs').validate(c);
 if(c.action==='combo')require(run+'/ordinary-keys.cjs').validateCombo(c.keys,c.holdMs);
 if(c.action==='key')require(run+'/ordinary-keys.cjs').validate(c.key,c.holdMs??100);
 assert(Date.now()<deadline,'immutable runtime deadline');assert(['capture','click','doubleclick','drag','key','combo','type','relative','quit'].includes(c.action),'known action');
 if(c.action==='quit'){await close('ordinary completion');return;}
 assert(Number.isInteger(c.waitMs)&&c.waitMs>=0&&c.waitMs<=10000,'wait bound');
 if(c.action!=='capture'){
  assert(latest&&c.reviewRef===latest.label,'current reviewed capture required');const review=JSON.parse(fs.readFileSync(out+'/'+latest.label+'-review.json'));assert.equal(review.sha256,latest.sha256);assert(review.review?.trim());assert.equal(sha(fs.readFileSync(out+'/'+latest.label+'.png')),latest.sha256);

 }
 const dispatch=async receipt=>{
 markDispatch();
 if(receipt)save('input-'+c.id+'-admission.json',{at:new Date().toISOString(),...receipt,reviewRef:c.reviewRef});
 if(c.action==='relative'){const locked=await evaluate("document.pointerLockElement===document.getElementById('screen')");const proof=await require(run+'/relative-input.cjs').perform({send,session:pageSession,command:c,point:cdpMousePoint,locked});save('input-'+c.id+'-relative.json',proof);}
 if(['click','doubleclick','drag'].includes(c.action)){const geometry=await evaluate(`(()=>{const r=document.getElementById('screen').getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height}})()`);const proof=await require(run+'/native-mouse.cjs').perform({send,session:pageSession,geometry,command:c});save('input-'+c.id+'-mouse.json',proof);}
 if(c.action==='key'||c.action==='combo'){
  const before=fixture?await fixture.poll(evaluate):null;
  const held=await observeHold({hold:bound.hold,save:report=>save('input-'+c.id+'-delivery.json',report),send,session:pageSession,keys:c.action==='combo'?c.keys:[c.key],holdMs:c.holdMs??100,
   sample:async()=>{if(c.captureHeld&&!fs.existsSync(out+'/'+c.label+'-held.png')){const shot=await send('Page.captureScreenshot',{format:'png'},pageSession);fs.writeFileSync(out+'/'+c.label+'-held.png',Buffer.from(shot.data,'base64'),{flag:'wx'});}const progress=await chain.progress(receipt.live.identity);return fixture?{...progress,fixture:await fixture.poll(evaluate)}:progress;},saveSample:s=>log('input-'+c.id+'-samples.jsonl',s)});
  save('input-'+c.id+'-hold.json',held);
  if(fixture){const after=await fixture.poll(evaluate),i=[',','.'].indexOf(c.key);assert(i>=0,'fixture comma/period control required');assert(held.samples.some(s=>s.whollyDuringHold&&s.fixture.keys[i]===128),'owning native keyboard high read');assert.equal(after.keys[i],0,'native key released');assert(after.counts[i]>before.counts[i]);assert.equal(after.endpoint,before.endpoint);save('input-'+c.id+'-native.json',{before,after});}
 }
 if(c.action==='type'){await require(run+'/keyboard-bridge.cjs').type(send,pageSession,c.text);}
 };
 if(c.action!=='capture')await chain.admit(JSON.parse(fs.readFileSync(out+'/'+latest.label+'-review.json')),dispatch);
 await wait(c.waitMs);await capture(c.label);
}
(async()=>{
 serverAcquisition=require(root+'/test/static-server.js').startStaticServer({root,crossOriginIsolated:true,rewritePath:p=>p.startsWith('/binaries/')?'/test'+p:p}).then(value=>server=value);
 await serverAcquisition;assert(!closing,'runtime terminal during server acquisition');
 server.prependListener('request',(req,res)=>{const h=crypto.createHash('sha256');let bytes=0;const add=b=>{if(b){b=Buffer.isBuffer(b)?b:Buffer.from(b);bytes+=b.length;h.update(b);}},write=res.write,end=res.end;res.write=function(b){add(b);return write.apply(this,arguments)};res.end=function(b){add(b);return end.apply(this,arguments)};res.once('finish',()=>log('served.jsonl',{at:new Date().toISOString(),url:req.url,status:res.statusCode,range:req.headers.range??null,contentRange:res.getHeader('Content-Range')??null,coop:res.getHeader('Cross-Origin-Opener-Policy'),coep:res.getHeader('Cross-Origin-Embedder-Policy'),bytes,sha256:h.digest('hex')}));});
 const port=server.address().port;
 const httpProof=[];for(const pin of pins.httpPins){const r=await fetch('http://127.0.0.1:'+port+pin.url),b=Buffer.from(await r.arrayBuffer());assert.equal(r.status,200,pin.url);assert.equal(sha(b),pin.sha256,pin.url);assert.equal(b.length,pin.size);httpProof.push({...pin,status:r.status,actualSha256:sha(b)});}save('http-resolver-pins.json',httpProof);
 assert(!closing,'runtime terminal before browser creation');browser=cp.spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--no-first-run','--no-default-browser-check','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--remote-debugging-port=0','--user-data-dir='+out+'/chrome-profile','about:blank'],{stdio:['ignore','pipe','pipe']});
 browserExit=browser.exitCode!==null?Promise.resolve({code:browser.exitCode,signal:browser.signalCode??null}):observeChild(browser);startupEvidence=observeStartup(browser,browserExit);if(browser.exitCode===null)browserExit.then(()=>{if(!closing&&endpointAdmitted)fail(Error('browser exited before ordinary shutdown'));},e=>{if(endpointAdmitted)fail(e);});
 for(const [stream,name] of [[browser.stdout,'stdout'],[browser.stderr,'stderr']])if(stream){const joined=pipeline(stream,zlib.createGzip(),fs.createWriteStream(out+'/chrome-'+name+'.gz',{flags:'wx'}));joined.catch(fail);streams.push(joined);}
 browser.once('exit',(code,signal)=>save('chrome-exit.json',{at:new Date().toISOString(),code,signal}));save('process.json',{pid:process.pid,chromePid:browser.pid,port,profile:out+'/chrome-profile'});
 timer=setTimeout(()=>fail(Error('immutable runtime cap'),'immutable runtime cap'),deadline-Date.now());
 const endpoint=await portPublication({file:out+'/chrome-profile/DevToolsActivePort',exit:browserExit,evidence:startupEvidence,deadline,guard:()=>assert(!closing,'runtime terminal before endpoint admission'),save});
 assert(!closing&&!startupEvidence.exit&&!startupEvidence.waitError,'runtime terminal before WebSocket');endpointAdmitted=true;
 const {debugPort,browserPath:debugPath}=endpoint;save('endpoint.json',endpoint);
 ws=new WebSocket('ws://127.0.0.1:'+debugPort+debugPath);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});ws.onmessage=msg=>{const v=JSON.parse(msg.data);if(v.id){const p=pending.get(v.id);if(!p)return;clearTimeout(p.timer);pending.delete(v.id);v.error?p.reject(Error(JSON.stringify(v.error))):p.resolve(v.result);}else event(v).catch(e=>log('event-errors.jsonl',{error:String(e)}));};
 save('browser-version.json',await send('Browser.getVersion'));await send('Target.setDiscoverTargets',{discover:true});await send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true});
 const targets=(await send('Target.getTargets')).targetInfos.filter(t=>t.type==='page');assert.equal(targets.length,1);pageSession=(await send('Target.attachToTarget',{targetId:targets[0].targetId,flatten:true})).sessionId;
 chain=bound.createChain({evaluate,send,workers,pageSession,app:'redline_demo',expectedModules:pins.files.filter(p=>p.path.startsWith('build/')&&p.path.endsWith('.wasm')).map(p=>p.sha256)});
 await send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true},pageSession);await send('Runtime.runIfWaitingForDebugger',{},pageSession);await send('Page.enable',{},pageSession);await send('Runtime.enable',{},pageSession);// Preserve native viewport: no emulation or resize.
 // Focused new exit controls on blank page; existing arrows/combos reused.
 await send('Page.navigate',{url:'about:blank'},pageSession);
 await evaluate(`window.exitProof=[];for(const type of ['keydown','keyup'])addEventListener(type,e=>exitProof.push({type,key:e.key,trusted:e.isTrusted}));`);
 for(const key of ['Delete','PageDown'])await require(run+'/ordinary-keys.cjs').hold(send,pageSession,key,50);
 const exitProof=await evaluate('exitProof');assert.deepEqual(exitProof.map(e=>[e.type,e.key]),[['keydown','Delete'],['keyup','Delete'],['keydown','PageDown'],['keyup','PageDown']]);assert(exitProof.every(e=>e.trusted));save('native-exit-preflight.json',{passed:true,exitProof});
 const selectedApp=process.env.WEBGL_QUALIFY?'dx_boids':process.env.TR2_GENERATED?'generated_property':'redline_demo';
 const redlineOriginal=!process.env.TR2_GENERATED&&!process.env.NO_ORIGINAL&&!process.env.WEBGL_QUALIFY;
 const url='http://127.0.0.1:'+port+'/index.html?candidates&no-log&threads'+(process.env.TR2_GENERATED||process.env.NO_ORIGINAL||redlineOriginal?'':'&app='+selectedApp);
 await send('Page.navigate',{url},pageSession);
 if(process.env.TR2_GENERATED){
  for(let n=0;n<160;n++){if(await evaluate("typeof apps!=='undefined' && typeof shell!=='undefined'"))break;await wait(100);}
  await evaluate(`apps.generated_property={name:'Generated COMCTL property control',exe:'scratch/runs/20261107-mcm-refresh-driving/generated-property-v2.exe',files:[],requiredFiles:true,dlls:['binaries/dlls/comctl32.dll']};shell.launchApp('generated_property');`);
 }
 if(process.env.NO_ORIGINAL){for(let n=0;n<160;n++){if(await evaluate("typeof runningApps!=='undefined'"))break;await wait(100);}assert.equal(await evaluate('runningApps.length'),0);save('final-app-selection-boundary.json',{passed:true,originalLaunches:0});await close('preflight final app-selection boundary');return;}
 if(redlineOriginal){
  for(let n=0;n<160;n++){if(await evaluate("typeof apps!=='undefined' && typeof shell!=='undefined'"))break;await wait(100);}
  if(fixture)await fixture.prepare(evaluate);
  await require(root+'/tools/redline-startup.cjs').launch({evaluate,send,workers,pageSession,
   source:fs.readFileSync(root+'/lib/redline-startup-admission.js','utf8'),
   selected:(()=>{const p=pins.files.find(p=>p.path==='build/wine-assembly.wasm');
    assert(p,'selected CPU pin required');return {sha256:p.sha256,bytes:p.size};})(),deadline,save});
 }
 await evaluate(`window.__nativeMouseEvents=[];for(const type of ['mousemove','mousedown','mouseup','pointerlockchange'])addEventListener(type,e=>{__nativeMouseEvents.push({at:Date.now(),type,trusted:e.isTrusted,x:e.clientX,y:e.clientY,dx:e.movementX,dy:e.movementY,button:e.button,buttons:e.buttons,locked:document.pointerLockElement===document.getElementById('screen')});if(__nativeMouseEvents.length>2048)__nativeMouseEvents.shift();},true);`);
 save('launch.json',{at:new Date().toISOString(),app:selectedApp,generated:!!process.env.TR2_GENERATED,fixture:!!fixture,commit:pins.commit,url,productionDirectRoute:!process.env.TR2_GENERATED});
 if(fixture){await fixture.ready(evaluate,Math.min(deadline,Date.now()+18000));const baseline=await fixture.poll(evaluate);assert(baseline.results.every(x=>x===0),'ordinary fixture COM setup');save('fixture-baseline.json',baseline);}
 if(process.env.TR2_GENERATED){await wait(12000);await evaluate(`(()=>{const a=runningApps[0],el=a.window?.element||a.window?.el;const w=document.getElementById('screen');if(!w)throw Error('fixture window absent');w.style.position='fixed';w.style.left='137px';w.style.top='83px';w.style.transformOrigin='top left';w.style.transform='scale(0.8)';return w.getBoundingClientRect().toJSON()})()`);}
 await wait(fixture?0:process.env.TR2_GENERATED?1000:15000);await capture('startup');
 if(process.env.WEBGL_QUALIFY){
 const first=await state();await wait(3000);const second=await state();
 const owner=s=>s.owningRenderer.flatMap(w=>w.endpoints||[]).filter(e=>e.options.api==='legacy'&&e.options.backend==='webgl');
 const a=owner(first),b=owner(second);assert.equal(a.length,1);assert.equal(b.length,1);assert(b[0].adapterPresent&&!b[0].failed&&b[0].control.error===0);assert(b[0].control.completed>a[0].control.completed&&a[0].control.completed>0,'actual owning WebGL completions advance');
 assert.equal(second.apps[0].d3dStats.fallbacks,0);save('qualification.json',{passed:true,first,second});await close('WebGL owner qualification complete');return;
 }
if(process.env.TR2_GENERATED){assert((await state()).apps.length===1,'actual generated guest launch');save('generated-qualification.json',{guestLaunched:true});}save('ready.json',{at:new Date().toISOString()});
 for(let n=0;!closing;n++){while(!closing&&!fs.existsSync(out+'/commands/'+n+'.json'))await wait(100);if(closing)break;await t.consume(out,n,execute);}
})().catch(fail);
