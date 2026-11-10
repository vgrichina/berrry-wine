'use strict';
// Explicit composition of the accepted Nox consumer with a current source closure.
// The retained consumer and media are read-only inputs, never repinned in place.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const HISTORY='scratch/runs/20261108-nox-native-equipment';
const DRIVER_SHA='72b2eead63b36ef53fb5e3e1457536eaf1b94d1d0792eb425a3419f6a39c0705';
const MEDIA='test/binaries/candidates/nox-demo';
const HELPERS=['ack-client.cjs','bound-input.cjs','keyboard-bridge.cjs','native-mouse.cjs','ordinary-keys.cjs','transport.cjs'];
const PLAN_FIELDS=['version','app','historicalCommit','currentCommit','acceptedDriver','files','modules','changes','registry'];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=p=>fs.readFileSync(path.join(ROOT,p));
const pin=(p,b=read(p))=>({path:p,size:b.length,sha256:sha(b)});
const git=(...args)=>cp.execFileSync('git',args,{cwd:ROOT,maxBuffer:32*1024*1024});
const json=p=>JSON.parse(fs.readFileSync(p));
function exact(text,from,to){assert.equal(text.split(from).length,2,'unique composition anchor: '+from);return text.replace(from,to);}
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
function checkPin(root,p){assert(!path.isAbsolute(p.path)&&!p.path.split('/').includes('..'),'relative input');const b=fs.readFileSync(path.join(root,p.path));assert.equal(sha(b),p.sha256,'immutable input '+p.path);assert.equal(b.length,p.size,p.path);}
function registry(root=ROOT){
  const file=path.join(root,'lib/apps.js');delete require.cache[require.resolve(file)];
  const {APPS}=require(file),app=APPS.nox_demo;
  assert.deepEqual(app,{exe:MEDIA+'/game/nox.exe',dlls:[MEDIA+'/game/mss32.dll'],files:[],localFileManifest:MEDIA+'/.wine-assembly-browser.json',requiredFiles:true,fileConcurrency:8},'actual registered nox_demo consumer');
  return app;
}
function mediaCheck(root,files){
  const media=files.filter(p=>p.path.startsWith(MEDIA+'/'));assert.equal(media.length,126,'125 originals plus manifest');
  media.forEach(p=>checkPin(root,p));
  const actual=walk(path.join(root,MEDIA,'game')).map(p=>path.relative(root,p)).sort();
  assert.deepEqual(actual,media.filter(p=>p.path.startsWith(MEDIA+'/game/')).map(p=>p.path).sort(),'exact original installed set');
  const manifest=json(path.join(root,MEDIA,'.wine-assembly-browser.json'));
  assert.equal(manifest.schemaVersion,1);assert.equal(manifest.files.length,124);
  assert.deepEqual([...manifest.files.map(p=>MEDIA+'/'+p.url),MEDIA+'/game/nox.exe'].sort(),actual,'registered media plus separate EXE');
}
function modules(){
  const {watxSourceClosure,compileClosure}=require('./watx-closure.js');
  const {applyToVfs}=require('../lib/dispatch-trampoline.js');
  const {layoutHash,appendSection}=require('./region-layout-hash.js');
  const closure=watxSourceClosure(),reuse=require('./watx.js').createFrontendReuse();
  return [true,false].map(tailCalls=>{
    const c=tailCalls?closure:{...closure,vfs:applyToVfs(new Map(closure.vfs))};
    const r=compileClosure(c,{tailCalls,frontendReuse:reuse});assert(r?.success&&r.wasmBinary,r?.error);
    const bytes=appendSection(Buffer.from(r.wasmBinary),layoutHash(r.regions.regions));
    const p=pin('build/wine-assembly'+(tailCalls?'':'.compat')+'.wasm',bytes);
    checkPin(ROOT,p);return {...p,tailCalls,sourceRecompiled:true};
  });
}
function historical(){
  const prior=json(path.join(ROOT,HISTORY,'runtime-pins.json'));
  assert.equal(sha(read(HISTORY+'/browser-run.cjs')),DRIVER_SHA,'accepted driver immutable');
  for(const p of prior.files.filter(p=>p.path.startsWith(HISTORY+'/')))checkPin(ROOT,p);
  mediaCheck(ROOT,prior.files);registry();return prior;
}
function inspect(){
  const prior=historical(),build=modules(),paths=new Set(prior.files.map(p=>p.path));
  // Current browser/source files include newly introduced dependencies too.
  for(const dir of ['src','lib'])for(const f of walk(path.join(ROOT,dir)))if(/\.(watx?|js|cjs)$/.test(f))paths.add(path.relative(ROOT,f));
  const visited=new Set();
  function dependencies(mod){
    if(!mod||visited.has(mod.filename))return;visited.add(mod.filename);
    if(mod.filename.startsWith(ROOT+'/tools/')||mod.filename.startsWith(ROOT+'/lib/'))paths.add(path.relative(ROOT,mod.filename));
    for(const child of mod.children)dependencies(child);
  }
  for(const name of ['./watx-closure.js','./watx.js','./region-layout-hash.js','../lib/dispatch-trampoline.js','../lib/apps.js'])dependencies(require.cache[require.resolve(name)]);
  for(const p of ['index.html','host.js','test/static-server.js','ops/browser-native-input.cjs','tools/build.sh','tools/build-compile-wat.js','tools/nox-current-driver.cjs','tools/q3-startup-custody.py','tools/native_kernel_custody.py'])paths.add(p);
  const files=[...paths].sort().map(p=>pin(p)),before=new Map(prior.files.map(p=>[p.path,p]));
  const changes=[],patches={};
  for(const current of files){
    const old=before.get(current.path);if(old?.sha256===current.sha256)continue;
    if(current.path.startsWith('build/')){changes.push({old,current,kind:'recompiled-module'});continue;}
    if(current.path.startsWith(HISTORY+'/')||current.path.startsWith(MEDIA+'/'))throw Error('immutable historical/media input '+current.path);
    // A changed historical source must be exactly recoverable from its Git base.
    if(old)assert.equal(sha(git('show',prior.commit+':'+current.path)),old.sha256,'historical Git source '+current.path);
    const tracked=cp.spawnSync('git',['ls-files','--error-unmatch',current.path],{cwd:ROOT,stdio:'ignore'}).status===0;
    const patch=tracked?git('diff','--binary',prior.commit,'--',current.path):cp.spawnSync('git',['diff','--no-index','--binary','/dev/null',current.path],{cwd:ROOT,maxBuffer:32*1024*1024}).stdout;
    const name='source-'+sha(Buffer.from(current.path)).slice(0,16)+'.patch';patches[name]=patch;
    changes.push({old:old??null,current,kind:old?'changed-source':'added-current-dependency',gitBase:prior.commit,patch:name,patchSha256:sha(patch)});
  }
  return {plan:{version:1,app:'nox_demo',historicalCommit:prior.commit,currentCommit:git('rev-parse','HEAD').toString().trim(),acceptedDriver:DRIVER_SHA,files,modules:build,changes,registry:registry()},patches};
}
function planHash(manifest){return sha(Buffer.from(JSON.stringify(Object.fromEntries(PLAN_FIELDS.map(k=>[k,manifest[k]])))));}
function verify(root,manifest,generated,expectedPlan){
  if(expectedPlan)assert.equal(planHash(manifest),expectedPlan,'immutable current plan; regenerate from explicit sources');
  assert.equal(manifest.version,1);assert.equal(manifest.app,'nox_demo');assert.equal(manifest.acceptedDriver,DRIVER_SHA);
  for(const p of manifest.files)checkPin(root,p);
  for(const p of manifest.generated)checkPin(generated,p);
  for(const p of manifest.provenance)checkPin(generated,p);
  for(const c of manifest.changes.filter(c=>c.patch))assert.equal(manifest.provenance.find(p=>p.path===c.patch)?.sha256,c.patchSha256,'exact changed-source diff identity');
  mediaCheck(root,manifest.files);registry(root);
  assert.equal(manifest.modules.length,2);
  for(const m of manifest.modules){assert(m.sourceRecompiled);checkPin(root,m);}
  assert.notEqual(manifest.modules[0].sha256,manifest.modules[1].sha256,'distinct primary and compat');
  return true;
}
function startupDiagnostics(source){
  // Amend the actual retained native entrypoint, never the historical input.
  source=exact(source," browser=cp.spawn('/usr/bin/google-chrome'", " const startupStarted=performance.now();\n browser=cp.spawn('/usr/bin/google-chrome'");
  const begin=" const active=out+'/chrome-profile/DevToolsActivePort';";
  const end=" save('browser-version.json',await send('Browser.getVersion'));";
  const a=source.indexOf(begin),b=source.indexOf(end);
  assert(a>=0&&b>a&&source.indexOf(begin,a+1)<0&&source.indexOf(end,b+1)<0,'unique native startup boundary');
  let startup=source.slice(a,b);
  startup=exact(startup,"const active=out+'/chrome-profile/DevToolsActivePort';",'');
  startup=exact(startup,'i++)await wait(100);','i++){startupPolls++;sampleStartup();await wait(100);}');
  startup=exact(startup,"fs.readFileSync(active,'utf8').trim()","(startupPortText=fs.readFileSync(active,'utf8')).trim()");
  return source.slice(0,a)+` const active=out+'/chrome-profile/DevToolsActivePort';let startupPolls=0,startupPortText=null;
 const startupSamples=[],startupBeginNs=process.hrtime.bigint().toString();
 function sampleStartup(){
  if(startupSamples.length>=102)return;
  const row={monoNs:process.hrtime.bigint().toString(),at:new Date().toISOString(),poll:startupPolls};
  try{
   const base='/proc/'+browser.pid,stat=fs.readFileSync(base+'/stat','utf8'),fields=stat.slice(stat.lastIndexOf(')')+2).trim().split(/\\s+/);
   row.process={state:fields[0],ppid:Number(fields[1]),startTicks:fields[19],userTicks:Number(fields[11]),systemTicks:Number(fields[12]),threads:Number(fields[17])};
   row.process.wchan=fs.readFileSync(base+'/wchan','utf8').trim();
   const status=fs.readFileSync(base+'/status','utf8');row.process.tracerPid=Number(status.match(/^TracerPid:\\s+(\\d+)/m)?.[1]??0);
  }catch(e){row.error={code:e.code,message:e.message};}
  startupSamples.push(row);
 }
 try{
${startup} }catch(error){
  // Snapshot before terminal cleanup removes the profile. Observations only:
  // stderr is never an endpoint source, and the original exception is rethrown.
  try{
   const observedAt=new Date().toISOString(),elapsedMs=performance.now()-startupStarted;
   let liveness;try{process.kill(browser.pid,0);liveness={probe:'kill(pid,0)',present:true};}catch(e){liveness={probe:'kill(pid,0)',present:e.code==='ESRCH'?false:null,error:{code:e.code,message:e.message}};}
   let stderr,fd;try{fd=fs.openSync(out+'/chrome.stderr','r');const size=fs.fstatSync(fd).size,bytes=Buffer.alloc(Math.min(size,8192));const read=fs.readSync(fd,bytes,0,bytes.length,Math.max(0,size-bytes.length));stderr={path:out+'/chrome.stderr',size,tail:bytes.subarray(0,read).toString('utf8'),truncated:size>bytes.length};}catch(e){stderr={error:{code:e.code,message:e.message}};}finally{if(fd!==undefined)fs.closeSync(fd);}
   save('native-startup-failure.json',{version:1,phase:'native-devtools-startup',observedAt,elapsedMs,pollLimit:100,pollIntervalMs:100,pollBoundMs:10000,polls:startupPolls,boundExhausted:startupPolls===100,
    error:{name:error.name,code:error.code??null,message:error.message,stack:error.stack},
    process:{pid:browser.pid??null,exitCode:browser.exitCode,signalCode:browser.signalCode,liveness},
    portFile:{path:active,existsAtFailure:fs.existsSync(active),readCompleted:startupPortText!==null,text:startupPortText===null?null:startupPortText.slice(0,1024),truncated:startupPortText!==null&&startupPortText.length>1024},stderr});
  }catch(diagnosticError){console.error('native startup diagnostic failed:',diagnosticError);}
  throw error;
 }finally{
  // Same existing polls only. Observations never supply an endpoint or extend
  // readiness. CLOCK_MONOTONIC aligns these Linux samples with custody timing.
  try{sampleStartup();save('native-startup-timing.json',{version:1,observationalOnly:true,clock:'Linux CLOCK_MONOTONIC / hrtime.bigint',beginNs:startupBeginNs,endNs:process.hrtime.bigint().toString(),polls:startupPolls,portRead:startupPortText!==null,samples:startupSamples});}catch(e){console.error('native startup timing failed:',e);}
 }
`+source.slice(b);
}
function terminalCleanup(source){
  source=exact(source,'function send(method,params={},sessionId){return new Promise',`let terminalError=null;
function terminal(error){
 if(!terminalError){terminalError=error;process.exitCode=1;clearTimeout(timer);
  save('terminal-error.json',{at:new Date().toISOString(),error:error.stack||String(error),noReplay:true});
  queueMicrotask(()=>close('first terminal failure').catch(e=>console.error(e)));
 }
 for(const p of pending.values()){clearTimeout(p.timer);p.reject(terminalError);}pending.clear();
 return terminalError;
}
function send(method,params={},sessionId){if(terminalError)return Promise.reject(terminalError);return new Promise`);
  source=exact(source,"pending.delete(n);reject(Error('CDP UNKNOWN '+method+'; no replay'));","const error=Error('CDP UNKNOWN '+method+'; no replay');terminal(error);reject(error);");
  source=exact(source,'ws.send(JSON.stringify({id:n,method,params,...(sessionId?{sessionId}:{})}));',"try{ws.send(JSON.stringify({id:n,method,params,...(sessionId?{sessionId}:{})}));}catch(error){terminal(error);reject(error);}");
  source=exact(source,'async function event(v){','async function event(v){\n if(terminalError)return;');
  source=exact(source,"if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));", "if(r.exceptionDetails)throw terminal(Error(JSON.stringify(r.exceptionDetails)));");
  source=exact(source,' await Promise.all(workerPromises);'," if(page.apps.some(a=>a.stopped||!a.running))throw terminal(Error('guest death; no replay'));\n await Promise.all(workerPromises);");
  source=exact(source,"async function close(reason){if(closing)return;closing=true;clearTimeout(timer);try{if(pageSession)","async function close(reason){if(closing)return;closing=true;clearTimeout(timer);try{if(!terminalError&&pageSession)");
  source=exact(source,"if(ws?.readyState===1)await send('Browser.close');","if(!terminalError&&ws?.readyState===1)await send('Browser.close');");
  source=exact(source,'async function execute(c,markDispatch){','async function execute(c,markDispatch){\n if(terminalError)throw terminalError;');
  source=exact(source,'return chain.progress(receipt.live.identity)', 'return chain.progress(receipt.live.identity).catch(error=>{throw terminal(error);})');
  source=exact(source,"browser.once('exit',(code,signal)=>save('chrome-exit.json',{at:new Date().toISOString(),code,signal}));",`browser.once('exit',(code,signal)=>{save('chrome-exit.json',{at:new Date().toISOString(),code,signal});if(!closing){terminal(Error('browser exited; no replay'));close('browser exit').catch(e=>console.error(e));}});`);
  source=exact(source,"timer=setTimeout(()=>close('immutable runtime cap').catch(e=>console.error(e)),deadline-Date.now());","timer=setTimeout(()=>{terminal(Error('immutable runtime cap'));close('immutable runtime cap').catch(e=>console.error(e));},deadline-Date.now());");
  source=exact(source,"v.error?p.reject(Error(JSON.stringify(v.error))):p.resolve(v.result);","v.error?p.reject(terminal(Error(JSON.stringify(v.error)))):p.resolve(v.result);");
  source=exact(source,"})().catch(async e=>{save('first-browser-failure.json'","})().catch(async e=>{terminal(e);save('first-browser-failure.json'");
  return source;
}
function captureLabels(source){
  // Validate every captured command before review reads, live observations or input.
  source=exact(source,"async function capture(label){assert(/^[a-z0-9-]+$/.test(label));",`function validCaptureLabel(label){assert(typeof label==='string'&&label.length<=80&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(label)&&!['undefined','null'].includes(label),'valid capture label required');}
async function capture(label){validCaptureLabel(label);`);
  source=exact(source," if(c.action==='quit'){await close('ordinary completion');return;}",` if(c.action==='quit'){await close('ordinary completion');return;}
 validCaptureLabel(c.label);
 assert(!fs.existsSync(out+'/'+c.label+'.png'),'unique capture label required');
 assert(!c.captureHeld||!fs.existsSync(out+'/'+c.label+'-held.png'),'unique held capture label required');`);
  return source;
}
function pointerObservations(source){
  // Disabled unless explicitly selected by the finite native experiment.
  // Existing console delivery is the prearmed sink; terminal cleanup performs
  // no diagnostic Runtime.evaluate or guest/input/capture operation.
  source=exact(source,"async function capture(label){validCaptureLabel(label);",`async function capture(label){validCaptureLabel(label);
 if(process.env.NOX_POINTER_OBSERVER==='1'&&!pointerObserverInstalled){
  await evaluate(fs.readFileSync(root+'/lib/nox-pointer-observer.js','utf8')+\`\n;(()=>{
   const a=runningApps.filter(a=>a.wine?.running&&!a.wine?._stopped);
   if(a.length!==1)throw Error('unique Nox observer owner required');
   const w=a[0].wine,r=w.renderer,c=document.getElementById('screen');
   if(!r||r.wasmMemory!==w.memory)throw Error('Nox observer memory owner mismatch');
   window.noxPointerObserver=NoxPointerObserver.install({enabled:true,canvas:c,renderer:r,memory:w.memory,
    document,diBase:RegionMap.BASE.DI_MOUSE_INPUT_STATE,
    emit:row=>console.log('NOX_POINTER_RECORD '+JSON.stringify(row))});return true;
  })()\`);pointerObserverInstalled=true;
 }
`);
  source=exact(source,'let browser,server,ws,pageSession,chain,closing=false,latest=null,timer;',
    'let pointerObserverInstalled=false;let browser,server,ws,pageSession,chain,closing=false,latest=null,timer;');
  source=exact(source,"save('latest.json',latest);console.log('CAPTURE '+label);",`save('latest.json',latest);
 if(pointerObserverInstalled){
  await evaluate('window.noxPointerObserver.image('+JSON.stringify(latest)+');true');
  const records=await evaluate('window.noxPointerObserver.snapshot()');
  assert(records.active,'Nox pointer observer exhausted');
  save(label+'-pointer.json',{capture:latest,observations:records});
 }
 console.log('CAPTURE '+label);`);
  source=exact(source,' const dispatch=async receipt=>{\n markDispatch();',` const dispatch=async receipt=>{
 if(pointerObserverInstalled)await evaluate('window.noxPointerObserver.begin('+JSON.stringify({id:c.id,label:c.label,action:c.action,previous:latest})+');true');
 markDispatch();`);
  source=exact(source,' await wait(c.waitMs);await capture(c.label);',` if(c.action==='capture'&&pointerObserverInstalled)await evaluate('window.noxPointerObserver.begin('+JSON.stringify({id:c.id,label:c.label,action:c.action,previous:latest})+');true');
 await wait(c.waitMs);await capture(c.label);`);
  source=exact(source,"await close('preflight final app-selection boundary');return;",`if(process.env.NOX_POINTER_OBSERVER==='1')await nativePointerFixture();await close('preflight final app-selection boundary');return;`);
  source=exact(source,'async function state(){',nativePointerFixture.toString()+'\nasync function state(){');
  return source;
}
async function nativePointerFixture(){
 // This is an explicit renderer/DOM fixture, with no guest or game acceptance.
 // It uses the loaded production renderer and bridge and the generated mouse
 // helper. Both returned images wait for separate external model reviews.
 await evaluate(fs.readFileSync(root+'/lib/nox-pointer-observer.js','utf8')+`;(()=>{
  if(runningApps.length||browserInput.isWired())throw Error('fixture requires unused production bridge');
  const c=document.createElement('canvas');c.id='nox-pointer-fixture';c.width=640;c.height=480;
  Object.assign(c.style,{position:'fixed',left:'20px',top:'40px',width:'640px',height:'480px',zIndex:2147483647});
  document.body.append(c);const r=new Win98Renderer(c),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  r.wasmMemory=memory;r.wasm={exports:{clip_cursor_active:()=>0,post_message_q:()=>1,wnd_mouse_msg_origin_x:()=>0,wnd_mouse_msg_origin_y:()=>0}};
  r.windows[7]={hwnd:7,visible:true,isChild:false,x:0,y:0,w:640,h:480,clientRect:{x:0,y:0,w:640,h:480},zOrder:1,wasm:r.wasm,wasmMemory:memory};
  r._exclusiveTransform={hwnd:7,srcX:0,srcY:0,srcW:640,srcH:480,dstX:0,dstY:0,dstW:640,dstH:480};
  r.setMousePosition(100,100);browserInput.wireCanvasInput(c,r,{runningApps:[],debugMode:false});
  const paint=()=>{const x=c.getContext('2d');x.fillStyle='#102030';x.fillRect(0,0,640,480);
   x.fillStyle='white';x.font='22px sans-serif';x.fillText('Nox pointer observation fixture',30,40);
   x.font='18px sans-serif';x.fillText('Production DOM + renderer; no game guest',30,75);
   x.fillStyle='#26c87a';x.fillRect(280,210,80,60);x.fillStyle='white';x.fillText('TARGET',284,248);
   x.strokeStyle='#ffdf40';x.lineWidth=3;x.beginPath();x.moveTo(r._mouseX-12,r._mouseY);x.lineTo(r._mouseX+12,r._mouseY);
   x.moveTo(r._mouseX,r._mouseY-12);x.lineTo(r._mouseX,r._mouseY+12);x.stroke();
   const publication=r._presentDisplayCanvas();
   if(publication.source!==c||publication.output!==c||publication.backend!=='direct-canvas')throw Error('fixture requires direct production publication');
   return publication.backend;};
  window.noxFixture={canvas:c,renderer:r,paint,owner:crypto.randomUUID()};
  window.noxFixtureObserver=NoxPointerObserver.install({enabled:true,canvas:c,renderer:r,memory,document,
   diBase:RegionMap.BASE.DI_MOUSE_INPUT_STATE,emit:row=>console.log('NOX_POINTER_RECORD '+JSON.stringify(row))});
  paint();return true;
 })()`);
 const fixtureOwner=await evaluate('noxFixture.owner');
 const image=async label=>{
  const publication=await evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>{
   const f=noxFixture,c=f.canvas,b=c.getBoundingClientRect(),s=getComputedStyle(c);
   resolve({owner:f.owner,canvasId:c.id,opacity:s.opacity,display:s.display,visibility:s.visibility,
    hit:document.elementFromPoint(b.left+b.width/2,b.top+b.height/2)===c,
    rect:{left:b.left,top:b.top,width:b.width,height:b.height},direct:f.renderer._directPresentation,
    target:Array.from(c.getContext('2d').getImageData(300,220,1,1).data)});
  })))`);
  assert.equal(publication.owner,fixtureOwner);assert.equal(publication.opacity,'1');
  assert.equal(publication.direct,true);assert.equal(publication.hit,true);
  assert.notEqual(publication.display,'none');assert.equal(publication.visibility,'visible');
  assert.deepEqual(publication.target,[38,200,122,255]);
  save(label+'-publication.json',publication);
  const shot=await send('Page.captureScreenshot',{format:'png'},pageSession),bytes=Buffer.from(shot.data,'base64');
  fs.writeFileSync(out+'/'+label+'.png',bytes,{flag:'wx'});
  const capture={label,sha256:sha(bytes),identity:{kind:'explicit-native-pointer-fixture',guest:false,fixtureOwner,canvasId:publication.canvasId,productionCommit:pins.currentCommit,modules:pins.modules.map(m=>m.sha256)}};
  save(label+'-capture.json',capture);
  const reviewFile=out+'/'+label+'-review.json';
  while(!fs.existsSync(reviewFile)){if(terminalError)throw terminalError;await wait(100);}
  const review=JSON.parse(fs.readFileSync(reviewFile));
  assert.equal(review.sha256,capture.sha256);assert.equal(review.label,capture.label);
  assert.deepEqual(review.identity,capture.identity);assert(review.review?.trim());
  assert.equal(sha(fs.readFileSync(out+'/'+label+'.png')),capture.sha256,'reviewed fixture bytes unchanged');return capture;
 };
 const before=await image('fixture-before');
 await evaluate('window.noxFixtureObserver.begin('+JSON.stringify({id:'native-fixture-click',label:'fixture-after',previous:before})+');true');
 const geometry=await evaluate('(()=>{const r=noxFixture.canvas.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height}})()');
 const receipt=await require('./native-mouse.cjs').perform({send,session:pageSession,geometry,command:{action:'click',point:[.5,.5],holdMs:150}});
 save('fixture-native-mouse.json',receipt);
 const observed=await evaluate('(()=>{noxFixture.paint();return noxFixtureObserver.snapshot()})()');
 save('fixture-pointer.json',observed);
 assert(observed.active);assert.equal(observed.state.cursor.x,320);assert.equal(observed.state.cursor.y,240);
 const dom=observed.records.filter(r=>r.kind==='dom'&&['mousedown','mouseup'].includes(r.type));
 assert.equal(dom.length,2);assert(dom.every(r=>r.trusted));
 assert(observed.records.some(r=>r.kind==='renderer-return'&&r.method==='_queueDirectInputMouseEvent'));
 const after=await image('fixture-after');
 save('native-pointer-fixture.json',{passed:true,before,after,productionDOM:true,productionRenderer:true,nativeMouse:true,guest:false});
}
function generate(planFile,destination){
  const reviewed=json(planFile),inspected=inspect(),patches=inspected.patches;
  // Another worker may commit unrelated files in the shared main checkout.
  // Keep the reviewed recovery base when its entire pinned closure is unchanged.
  git('merge-base','--is-ancestor',reviewed.currentCommit,inspected.plan.currentCommit);
  assert.deepEqual({...inspected.plan,currentCommit:reviewed.currentCommit},reviewed,'current inputs differ from explicit reviewed plan');
  const plan=reviewed;
  assert(!fs.existsSync(destination),'fresh generated destination');fs.mkdirSync(destination,{recursive:true});
  const emit=(name,bytes)=>fs.writeFileSync(path.join(destination,name),bytes,{flag:'wx'});
  for(const name of HELPERS){
    let bytes=read(HISTORY+'/'+name);
    if(name==='transport.cjs')bytes=Buffer.from(exact(bytes.toString(),`   if(e.code==='STALE_SCENE_BEFORE_DISPATCH'&&!dispatched){
    base.writeJson(path.join(out,'reply-'+number+'.json'),{ok:true,id:c.id,status:'refused-before-dispatch',effects:0,refreshRequired:true,error:String(e)});return true;
   }`, '   // Nox: every refusal is terminal; retain the unchanged pre-effect guard.'));
    emit(name,bytes);
  }
  // Compose the actual current production helper with only Nox key descriptors.
  let native=read('ops/browser-native-input.cjs').toString();
  native=exact(native,'KeyI:73,','KeyI:73,KeyV:86,KeyB:66,KeyQ:81,');
  native=exact(native,"code==='KeyI'?'i':code","/^Key[A-Z]$/.test(code)?code.slice(3).toLowerCase():code");
  emit('native-input.cjs',native);
  let source=read(HISTORY+'/browser-run.cjs').toString();
  const relRoot=path.relative(destination,ROOT);
  source=exact(source,"root=path.resolve(run,'../../..')",'root=path.resolve(run,'+JSON.stringify(relRoot)+')');
  source=exact(source,"const pins=JSON.parse(fs.readFileSync(run+'/runtime-pins.json'));","const pins=JSON.parse(fs.readFileSync(run+'/runtime-pins.json'));\nrequire(root+'/tools/nox-current-driver.cjs').verify(root,pins,run,"+JSON.stringify(planHash(plan))+");");
  source=startupDiagnostics(source);
  source=terminalCleanup(source);
  source=captureLabels(source);
  source=pointerObservations(source);
  emit('browser-run.cjs',source);
  // Reuse the authenticated durable service, including its ready-stop scan.
  // Keep Q3's app-specific observation wrapper out of the Nox process. Both
  // executable Python inputs belong to the same reviewed source closure.
  emit('custody-run.py',`import sys,json,hashlib,runpy
from pathlib import Path
root=Path(__file__).resolve().parent / ${JSON.stringify(relRoot)}
root=root.resolve()
manifest=json.loads(Path(__file__).with_name('runtime-pins.json').read_bytes())
for name in ('tools/q3-startup-custody.py','tools/native_kernel_custody.py'):
 pin=next(p for p in manifest['files'] if p['path']==name)
 data=(root/name).read_bytes()
 assert len(data)==pin['size'] and hashlib.sha256(data).hexdigest()==pin['sha256'],name
adapter=runpy.run_path(str(root/'tools/q3-startup-custody.py'))
assert adapter['VERSION']=='q3-startup-custody-release-cohorts-v3'
supervise=adapter['load']().supervise
if __name__=='__main__':
 supervise(Path(sys.argv[1]),sys.argv[4:],deadline=float(sys.argv[2]),cleanup_deadline=float(sys.argv[3]),journal_compression='gzip',command_compression='gzip')
`);
  const generated=walk(destination).map(p=>pin(path.basename(p),fs.readFileSync(p))).sort((a,b)=>a.path.localeCompare(b.path));
  const provenance=Object.entries(patches).map(([name,b])=>pin(name,b));
  const manifest={...plan,generated,provenance,httpPins:json(path.join(ROOT,HISTORY,'runtime-pins.json')).httpPins.map(p=>({...plan.files.find(f=>f.path===p.path),url:p.url}))};
  emit('runtime-pins.json',JSON.stringify(manifest,null,2)+'\n');
  for(const [name,bytes] of Object.entries(patches))emit(name,bytes);
  verify(ROOT,manifest,destination);return manifest;
}
module.exports={ROOT,HISTORY,DRIVER_SHA,HELPERS,sha,pin,planHash,inspect,generate,verify,registry,checkPin,pointerObservations};
if(require.main===module){
  try{
    if(process.argv[2]==='inspect'){
      const out=process.argv[3];assert(out&&!fs.existsSync(out),'fresh explicit plan');
      const {plan,patches}=inspect();
      for(const [name,bytes] of Object.entries(patches))fs.writeFileSync(path.join(path.dirname(out),name),bytes,{flag:'wx'});
      fs.writeFileSync(out,JSON.stringify(plan,null,2)+'\n',{flag:'wx'});
      console.log(JSON.stringify({plan:out,inputs:plan.files.length,changed:plan.changes.length,modules:plan.modules}));
    }else if(process.argv[2]==='generate'){
      const manifest=generate(process.argv[3],path.resolve(process.argv[4]));console.log(JSON.stringify({generated:true,inputs:manifest.files.length,modules:manifest.modules}));
    }else throw Error('usage: nox-current-driver.cjs inspect PLAN | generate PLAN FRESH_DIRECTORY');
  }catch(e){console.error(e.stack);process.exitCode=1;}
}
