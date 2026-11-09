'use strict';
// One native-CDP browser; no generated guest or substituted game assets.
const fs=require('node:fs'),cp=require('node:child_process'),crypto=require('node:crypto'),path=require('node:path'),assert=require('node:assert/strict');
const bound=require('./bound-input.cjs'),trace=require('./trace.cjs');
const run=__dirname,root=path.resolve(run,'../../..'),out=run+'/'+(process.env.CASE_TAG||(process.env.NO_ORIGINAL?'production-preflight':process.env.WEBGL_QUALIFY?'webgl-qualify':process.env.TR2_GENERATED?'generated-v2':'original')),t=require('./transport.cjs');

const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),save=(n,v)=>t.publish(out+'/'+n,v),log=(n,v)=>fs.appendFileSync(out+'/'+n,JSON.stringify(v)+'\n'),wait=ms=>trace.span('wait',()=>new Promise(r=>setTimeout(r,ms)),{ms});
const pins=JSON.parse(fs.readFileSync(run+'/runtime-pins.json'));
for(const p of pins.files){const b=fs.readFileSync(root+'/'+p.path);assert.equal(sha(b),p.sha256,p.path);assert.equal(b.length,p.size);}

const start=Date.now(),deadline=Number(process.env.BROWSER_DEADLINE);assert(Number.isFinite(deadline)&&deadline>start&&deadline-start<30*60000);if(process.env.DRIVER_PREFLIGHT==='1'){console.log(JSON.stringify({passed:true,start,deadline,remainingMs:deadline-start,strictLimitMs:30*60000,pins:pins.files.length,chromiumStarted:false,originalStarted:false}));process.exit(0);}fs.mkdirSync(out);trace.init(out);fs.mkdirSync(out+'/commands');save('execution-window.json',{start:new Date(start).toISOString(),browserStop:new Date(deadline).toISOString(),replayAllowed:false});
let floorTimer,passive;
let browser,server,ws,pageSession,chain,closing=false,latest=null,timer;let id=0;const pending=new Map(),workers=new Map(),workerPromises=[];
function send(method,params={},sessionId){return trace.span('cdp',async()=>{
 const n=++id,w=workers.get(sessionId),meta={requestId:n,method,sessionId:sessionId??null,targetId:w?.targetId??(sessionId===pageSession?'page':null),url:w?.url??null,scriptId:params.scriptId??null,expression:params.expression?trace.expression(params.expression):null};
 return trace.span('cdp.request',()=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>{trace.snapshot('CDP deadline',meta);pending.delete(n);reject(Error('CDP UNKNOWN '+method+'; no replay'));},20000);pending.set(n,{resolve,reject,timer,meta});ws.send(JSON.stringify({id:n,method,params,...(sessionId?{sessionId}:{})}));}),meta);
 });}
async function evaluate(expression,sessionId=pageSession){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sessionId);if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
async function event(v){
 if(v.method==='Target.attachedToTarget'){
  const {sessionId,targetInfo}=v.params;
  if(targetInfo.type==='worker'){
   workers.set(sessionId,{sessionId,targetId:targetInfo.targetId,url:targetInfo.url,scripts:[],closed:false});
   const task=(async()=>{await send('Debugger.enable',{},sessionId);await send('Runtime.enable',{},sessionId);if(targetInfo.url.includes('d3d-render-worker'))await evaluate(fs.readFileSync(run+'/worker-observe.js','utf8'),sessionId);await send('Runtime.runIfWaitingForDebugger',{},sessionId);})();workerPromises.push(task);task.catch(e=>log('worker-errors.jsonl',{at:new Date().toISOString(),error:String(e)}));
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
async function stateImpl(){
 const page=await evaluate(`(()=>{const all=typeof runningApps==='undefined'?[]:runningApps;const c=document.getElementById('screen'),r=c?.getBoundingClientRect();return {inputEvents:globalThis.__q3InputEvents||[],config:(()=>{const v=all[0]?.wine?._helpCtx?.vfs;return v?new TextDecoder().decode([...v.files].find(([p])=>p.endsWith('q3config.cfg'))?.[1]?.data||new Uint8Array()):null})(),at:new Date().toISOString(),isolated:crossOriginIsolated,canvas:c?{width:c.width,height:c.height,rect:{left:r.left,top:r.top,width:r.width,height:r.height}}:null,apps:all.map(a=>{const w=a.wine;return {name:a.name,processId:w?.processId,running:w?.running,stopped:w?._stopped,guestWorker:!!w?.guestWorker,endpoint:w?.guestWorker?.link?.endpointIdentity,slot:w?.guestWorker?.link?.slot,d3dStats:w?.guestWorker?.d3dStats,slice:w?._workerLastSlice,renderEndpoints:[...(w?._renderWorkerManager?.ports?.values()||[])].map(p=>({id:p.id,options:p.options,closed:p.closed})),threads:[...(w?.threadManager?.threads?.values()||[])].map(t=>({tid:t.tid,state:t.state,slot:t.link?.slot,d3dStats:t.link?.d3dStats}))}}),log:document.getElementById('log')?.textContent?.slice(-8000)}})()`);
 await trace.span('state.workerPromises',()=>Promise.all(workerPromises));
 const owners=[];for(const w of workers.values())if(w.url.includes('d3d-render-worker')&&!w.closed){try{owners.push({sessionId:w.sessionId,targetId:w.targetId,url:w.url,endpoints:await evaluate(`Array.from(endpoints,([id,e])=>({id,options:e.options,failed:e.failed?String(e.failed):null,evidence:e.evidence,adapterStats:e.adapter?.stats??null,adapterPresent:!!e.adapter,adapterClass:e.adapter?.constructor?.name,context:e.adapter?.gl?{class:e.adapter.gl.constructor.name,version:e.adapter.gl.getParameter(e.adapter.gl.VERSION),renderer:e.adapter.gl.getParameter(e.adapter.gl.RENDERER)}:null,adapterSoftwareDrawCallsCompleted:e.adapter?.d3dimSoftwareDrawCallsCompleted??null,control:e.control?{ready:Atomics.load(e.control,0),completed:Atomics.load(e.control,1),error:Atomics.load(e.control,2),batches:Atomics.load(e.control,4),commands:Atomics.load(e.control,5)}:null}))`,w.sessionId)});}catch(e){owners.push({sessionId:w.sessionId,error:String(e)});}}
 const cpu=[];for(const w of workers.values())if(!w.closed&&w.url.includes('guest-worker'))cpu.push({targetId:w.targetId,state:await evaluate(`({endpoint:endpointIdentity,slot:workerSlot,gpu:typeof d3dimGpuEnable==='undefined'?null:d3dimGpuEnable})`,w.sessionId)});const contexts=[];for(const w of workers.values())if(!w.closed&&w.url.includes('d3d-render-worker'))contexts.push({targetId:w.targetId,observed:await evaluate(`(globalThis.__simgolfGL||[]).map(({canvas,context,...v})=>({...v,width:canvas.width,height:canvas.height}))`,w.sessionId)});const gl=[];for(const w of workers.values())if(!w.closed&&w.url.includes('d3d-render-worker'))gl.push({targetId:w.targetId,owner:await evaluate(fs.readFileSync(run+'/gl-owner.js','utf8'),w.sessionId)});return {...page,cpu,contexts,gl,workers:[...workers.values()],owningRenderer:owners};
}
async function state(){return trace.span('state',stateImpl);}
async function captureImpl(label){assert(/^[a-z0-9-]+$/.test(label));assert(!fs.existsSync(out+'/'+label+'.png'));const s=await trace.span('capture.state',state);save(label+'-state.json',s);const shot=await trace.span('capture.chain',()=>chain.capture(label));fs.writeFileSync(out+'/'+label+'.png',shot.png,{flag:'wx'});latest=shot.capture;save(label+'-binding.json',{before:shot.before,after:shot.after});save(label+'-capture.json',latest);save('latest.json',latest);console.log('CAPTURE '+label);}
async function capture(label){return trace.span('capture.'+label,()=>captureImpl(label));}
async function close(reason){if(closing)return;closing=true;clearTimeout(timer);clearInterval(floorTimer);clearInterval(passive);save('close-reason.json',{at:new Date().toISOString(),reason});try{if(ws?.readyState===1)await send('Browser.close');}catch(e){save('close-error.json',{error:String(e)});}if(browser){await Promise.race([new Promise(r=>browser.exitCode!==null?r():browser.once('exit',r)),wait(8000)]);if(browser.exitCode===null)browser.kill('SIGTERM');await Promise.race([new Promise(r=>browser.exitCode!==null?r():browser.once('exit',r)),wait(5000)]);if(browser.exitCode===null)browser.kill('SIGKILL');}
 for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('runtime closed; no replay'));}pending.clear();
 ws?.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}fs.rmSync(out+'/chrome-profile',{recursive:true,force:true});t.closed(out,browser?.exitCode);console.log('TERMINAL '+reason);}
async function executeImpl(c,markDispatch){
 if(c.action==='combo')require('./ordinary-keys.cjs').validateCombo(c.keys,c.holdMs);
 if(c.action==='key')require('./ordinary-keys.cjs').validate(c.key,c.holdMs??100);
 assert(Date.now()<deadline,'immutable runtime deadline');assert(['capture','click','doubleclick','drag','key','combo','type','quit'].includes(c.action),'known action');
 if(c.action==='quit'){await close('ordinary completion');return;}
 assert(Number.isInteger(c.waitMs)&&c.waitMs>=0&&c.waitMs<=120000,'wait bound');
 if(c.action!=='capture'){
  assert(latest&&c.reviewRef===latest.label,'current reviewed capture required');const review=JSON.parse(fs.readFileSync(out+'/'+latest.label+'-review.json'));assert.equal(review.sha256,latest.sha256);assert(review.review?.trim());assert.equal(sha(fs.readFileSync(out+'/'+latest.label+'.png')),latest.sha256);

 }
 const dispatch=async receipt=>{
 markDispatch();
 if(receipt)save('input-'+c.id+'-admission.json',{at:new Date().toISOString(),...receipt,reviewRef:c.reviewRef});
 if(['click','doubleclick','drag'].includes(c.action)){const geometry=await evaluate(`(()=>{const r=document.getElementById('screen').getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height}})()`);const proof=await require('./native-mouse.cjs').perform({send,session:pageSession,geometry,command:c});save('input-'+c.id+'-mouse.json',proof);}
 if(c.action==='key'||c.action==='combo'){
  const held=await trace.span('command.hold',()=>bound.hold({send,session:pageSession,keys:c.action==='combo'?c.keys:[c.key],holdMs:c.holdMs??100,
   sample:async()=>{if(c.captureHeld&&!fs.existsSync(out+'/'+c.label+'-held.png')){const shot=await send('Page.captureScreenshot',{format:'png'},pageSession);fs.writeFileSync(out+'/'+c.label+'-held.png',Buffer.from(shot.data,'base64'),{flag:'wx'});}return chain.progress(receipt.live.identity)},saveSample:s=>log('input-'+c.id+'-samples.jsonl',s)}));
  save('input-'+c.id+'-hold.json',held);
 }
 if(c.action==='type'){await require('./keyboard-bridge.cjs').type(send,pageSession,c.text);}
 };
 if(c.action!=='capture')await trace.span('command.admission',()=>chain.admit(JSON.parse(fs.readFileSync(out+'/'+latest.label+'-review.json')),dispatch));
 await trace.span('command.settle',()=>wait(c.waitMs));await capture(c.label);
}
async function execute(c,markDispatch){return trace.span('command.'+c.id,()=>executeImpl(c,markDispatch),c.timing);}
(async()=>{
 const sampleDisk=()=>{const d=fs.statfsSync('/home'),free=d.bavail*d.bsize;log('disk.jsonl',{at:new Date().toISOString(),free,floor:5000000000});assert(free>5000000000,'5GB disk floor');};sampleDisk();floorTimer=setInterval(()=>{try{sampleDisk();}catch(e){trace.snapshot('disk floor');close(String(e));}},5000);floorTimer.unref();
 server=await require(root+'/test/static-server.js').startStaticServer({root,crossOriginIsolated:true,handleRequest:process.env.LOCAL_PRODUCTION_FIXTURE?require('./generated.cjs').handle:undefined,rewritePath:p=>p.startsWith('/binaries/')?'/test'+p:p});
 server.prependListener('request',(req,res)=>{const h=crypto.createHash('sha256');let bytes=0;const add=b=>{if(b){b=Buffer.isBuffer(b)?b:Buffer.from(b);bytes+=b.length;h.update(b);}},write=res.write,end=res.end;res.write=function(b){add(b);return write.apply(this,arguments)};res.end=function(b){add(b);return end.apply(this,arguments)};res.once('finish',()=>log('served.jsonl',{at:new Date().toISOString(),url:req.url,status:res.statusCode,range:req.headers.range??null,contentRange:res.getHeader('Content-Range')??null,coop:res.getHeader('Cross-Origin-Opener-Policy'),coep:res.getHeader('Cross-Origin-Embedder-Policy'),bytes,sha256:h.digest('hex')}));});
 const port=server.address().port;
 const httpProof=[];for(const pin of pins.httpPins){const r=await fetch('http://127.0.0.1:'+port+pin.url),b=Buffer.from(await r.arrayBuffer());assert.equal(r.status,200,pin.url);assert.equal(sha(b),pin.sha256,pin.url);assert.equal(b.length,pin.size);httpProof.push({...pin,status:r.status,actualSha256:sha(b)});}save('http-resolver-pins.json',httpProof);
 browser=cp.spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--no-first-run','--no-default-browser-check','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--remote-debugging-port=0','--user-data-dir='+out+'/chrome-profile','about:blank'],{stdio:['ignore',fs.openSync(out+'/chrome.stdout','w'),fs.openSync(out+'/chrome.stderr','w')]});
 browser.once('exit',(code,signal)=>save('chrome-exit.json',{at:new Date().toISOString(),code,signal}));save('process.json',{pid:process.pid,chromePid:browser.pid,port,profile:out+'/chrome-profile'});
 timer=setTimeout(()=>close('immutable runtime cap').catch(e=>console.error(e)),deadline-Date.now());
 const active=out+'/chrome-profile/DevToolsActivePort';for(let i=0;i<100&&!fs.existsSync(active);i++)await wait(100);const [debugPort,debugPath]=fs.readFileSync(active,'utf8').trim().split('\n');save('endpoint.json',{debugPort:Number(debugPort),browserPath:debugPath});
 ws=new WebSocket('ws://127.0.0.1:'+debugPort+debugPath);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});ws.onmessage=msg=>{const v=JSON.parse(msg.data);if(v.id){const p=pending.get(v.id);if(!p)return;clearTimeout(p.timer);pending.delete(v.id);v.error?p.reject(Error(JSON.stringify(v.error))):(process.env.LOCAL_PRODUCTION_FIXTURE?p.resolve(v.result):p.resolve(v.result));}else event(v).catch(e=>log('event-errors.jsonl',{error:String(e)}));};
 save('browser-version.json',await send('Browser.getVersion'));await send('Target.setDiscoverTargets',{discover:true});await send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true});
 const targets=(await send('Target.getTargets')).targetInfos.filter(t=>t.type==='page');assert.equal(targets.length,1);pageSession=(await send('Target.attachToTarget',{targetId:targets[0].targetId,flatten:true})).sessionId;
 chain=bound.createChain({evaluate,send,workers,pageSession,useBoundOwner:()=>fs.existsSync(run+'/use-bound-owner.json'),app:process.env.LOCAL_PRODUCTION_FIXTURE?'dx_tunnel':'quake3_demo',expectedModules:pins.files.filter(p=>p.path.startsWith('build/')&&p.path.endsWith('.wasm')).map(p=>p.sha256)});
 await send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true},pageSession);await send('Page.enable',{},pageSession);await send('Runtime.enable',{},pageSession);// Preserve native viewport: no emulation or resize.
 const selectedApp=process.env.WEBGL_QUALIFY?'dx_boids':process.env.TR2_GENERATED?'generated_property':'quake3_demo';
 const url=process.env.LOCAL_PRODUCTION_FIXTURE?'http://127.0.0.1:'+port+'/generated-readiness?backend='+(process.env.RENDER_BACKEND||'software'):'http://127.0.0.1:'+port+'/index.html?candidates&no-log&threads'+(process.env.TR2_GENERATED||process.env.NO_ORIGINAL?'':'&app='+selectedApp+'&gl-renderer='+(process.env.RENDER_BACKEND||'software')+'&d3d-renderer='+(process.env.RENDER_BACKEND||'software'));
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`globalThis.__q3InputEvents=[];for(const type of ['keydown','keyup','mousedown','mouseup'])addEventListener(type,e=>{const row={at:Date.now(),type,key:e.key,code:e.code,button:e.button,trusted:e.isTrusted,target:e.target?.id};__q3InputEvents.push(row);queueMicrotask(()=>{const r=typeof runningApps==='undefined'?null:runningApps[0]?.wine?.renderer;row.state={mouse:r?._mouseButtonsMask,physical:r?._physicalKeys,async:r?._asyncKeys,queue:r?.inputQueue?.length};});},true);`},pageSession);
 await send('Page.navigate',{url},pageSession);
 if(process.env.TR2_GENERATED){
  for(let n=0;n<100;n++){if(await evaluate("typeof apps!=='undefined' && typeof shell!=='undefined'"))break;await wait(100);}
  await evaluate(`apps.generated_property={name:'Generated COMCTL property control',exe:'scratch/runs/20261107-mcm-refresh-driving/generated-property-v2.exe',files:[],requiredFiles:true,dlls:['binaries/dlls/comctl32.dll']};shell.launchApp('generated_property');`);
 }
 if(process.env.LOCAL_PRODUCTION_FIXTURE){
 await require('./readiness.cjs').ready(evaluate,'dx_tunnel',{attempts:300,wait});
 await Promise.all(workerPromises);
 await require('./local-controls.cjs').run({bound,evaluate,send,workers,pageSession,save,wait,state,capture,execute,out,chain,workerPromises});
 await close('production startup fixture complete');return;
 }
 if(process.env.NO_ORIGINAL){for(let n=0;n<100;n++){if(await evaluate("typeof runningApps!=='undefined'"))break;await wait(100);}assert.equal(await evaluate('runningApps.length'),0);save('final-app-selection-boundary.json',{passed:true,originalLaunches:0});await close('preflight final app-selection boundary');return;}
 save('launch.json',{at:new Date().toISOString(),app:selectedApp,generated:!!process.env.TR2_GENERATED,commit:pins.commit,url,productionDirectRoute:!process.env.TR2_GENERATED});
 if(process.env.TR2_GENERATED){await wait(12000);await evaluate(`(()=>{const a=runningApps[0],el=a.window?.element||a.window?.el;const w=document.getElementById('screen');if(!w)throw Error('fixture window absent');w.style.position='fixed';w.style.left='137px';w.style.top='83px';w.style.transformOrigin='top left';w.style.transform='scale(0.8)';return w.getBoundingClientRect().toJSON()})()`);}
 passive=setInterval(()=>{evaluate(fs.readFileSync(run+'/passive.js','utf8')).then(v=>log('natural-progress.jsonl',v)).catch(e=>log('passive-errors.jsonl',{error:String(e)}));},5000);passive.unref();
 await require('./readiness.cjs').ready(evaluate,selectedApp,{attempts:600,wait});
 save('guest-worker-ready.json',{at:Date.now()});
 save('renderer-readiness.json',await chain.establishReady({wait:async ms=>{assert(ms<=10000);log('startup-observations.jsonl',{at:new Date().toISOString(),page:await evaluate(bound.PAGE_READ)});await wait(ms);}}));
 await capture('startup');
 if(process.env.WEBGL_QUALIFY){
 const first=await state();await wait(3000);const second=await state();
 const owner=s=>s.owningRenderer.flatMap(w=>w.endpoints||[]).filter(e=>e.options.api==='legacy'&&e.options.backend==='webgl');
 const a=owner(first),b=owner(second);assert.equal(a.length,1);assert.equal(b.length,1);assert(b[0].adapterPresent&&!b[0].failed&&b[0].control.error===0);assert(b[0].control.completed>a[0].control.completed&&a[0].control.completed>0,'actual owning WebGL completions advance');
 assert.equal(second.apps[0].d3dStats.fallbacks,0);save('qualification.json',{passed:true,first,second});await close('WebGL owner qualification complete');return;
 }
if(process.env.TR2_GENERATED){assert((await state()).apps.length===1,'actual generated guest launch');save('generated-qualification.json',{guestLaunched:true});}save('ready.json',{at:new Date().toISOString()});
 for(let n=0;!closing;n++){while(!closing&&!fs.existsSync(out+'/commands/'+n+'.json'))await wait(100);if(closing)break;await t.consume(out,n,execute);}
})().catch(async e=>{save('first-browser-failure.json',{at:new Date().toISOString(),error:e.stack,noReplay:true});process.exitCode=1;await close('first terminal failure');});
