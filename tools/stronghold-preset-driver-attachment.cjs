'use strict';
// Offline composition of the retained original closure. No runtime is allocated.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),Module=require('node:module'),zlib=require('node:zlib');
const ROOT=path.resolve(__dirname,'..');
const ORIGINAL='scratch/runs/20261104-stronghold-setup-preset-native-world/successor-driver.cjs';
const DRIVER_SHA='230a11947699af0721dc54d58c6b027f6ba21563b59bffc7d2014221ec481a10';
const ROUTE_SHA='bb38b5787c277c94c2913a9ddba72a8663b9fd2fb706a88e320bcb83419633de';
const MEDIA='test/binaries/candidates/stronghold-crusader-demo/installed/App_Executables/Stronghold Crusader multiplayer demo.exe';
const OBSERVER_COMMIT='8574dfa540da10ade7ba7b5799c974d131775a38';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function retained(file){return fs.existsSync(file)?fs.readFileSync(file):zlib.gunzipSync(fs.readFileSync(file+'.gz'));}
function replaceOnce(source,before,after){if(source.split(before).length!==2)throw Error('sealed composition seam missing/ambiguous: '+before.slice(0,90));return source.replace(before,after);}

// Serialized into the exact paused Worker after observe-browser.js. Native
// imports remain owned by the published passive installer, including returns
// to dynamically saved PCs; the one caller-owned trace covers all native PCs.
function installWorker(options){
 if(new URL(options.expectedWorkerURL).pathname!=='/lib/guest-worker.js')throw Error('wrong owning Worker URL');
 if(globalThis.__strongholdPresetAttachment||globalThis.__strongholdObservers?.length)throw Error('competing or late observer preload');
 if(globalThis.__mdk2Observe?.events?.some(e=>['received-module','instantiated'].includes(e.kind)))throw Error('late Worker preload');
 const preload=globalThis.StrongholdNativePresetObserver.installPreload(options);
 let entry=null,command=null,traced=false,terminal=false;
 const report=()=>({targetId:options.targetId,sessionId:options.sessionId,workerURL:options.expectedWorkerURL,
   entries:preload.entries.length,installedBeforeInstantiation:preload.entries[0]?.installedBeforeInstantiation===true,
   entryError:preload.entries[0]?.error||null,thread:entry?.getExports()?.get_current_thread_id(),
   terminal,traced,report:entry?.observer?.report||preload.entries[0]?.observer?.report||null,
   events:globalThis.__mdk2Observe?.events||[]});
 function cleanup(reason){
   terminal=true;
   try{if(traced){traced=false;entry.getExports().set_trace_esp(0,0,0);}}
   finally{preload.finish(reason);}
 }
 function running(){
   const r=entry?.observer?.report;
   if(!r||r.status!=='running'){cleanup(r?.status||'lost-instance');throw Error('observer terminal: '+(r?.status||'missing'));}
   return r;
 }
 function invoke(action,row){
   if(action==='report')return report();
   if(action==='finish'){cleanup(row?.reason||'explicit-stop');return report();}
   if(action==='start'){
     if(terminal||entry||preload.entries.length!==1||!preload.entries[0].installedBeforeInstantiation||preload.entries[0].error)throw Error('single pre-instantiation instance prerequisite');
     entry=preload.entries[0];
     const ex=entry.getExports();
     if(!ex||ex.get_current_thread_id()!==1||typeof ex.set_trace_esp!=='function')throw Error('owning thread/trace prerequisite');
     preload.start();running();command=row.command;
     // Only this attachment arms the diagnostic; no second choose trace.
     traced=true;ex.set_trace_esp(1,0,0);
     entry.observer.annotate({command,kind:'begin'});running();
   }else{
     running();
     if(action==='check'){entry.observer.check();running();}
     else if(action==='annotate'){
       entry.observer.annotate({...row,command});
       if(row.kind==='failed'){cleanup('command-failed');return report();}
       running();
       if(row.kind==='success')cleanup('command-succeeded');
     }else throw Error('unsupported attachment operation');
   }
   return report();
 }
 // The observer's own idle timer terminates evidence. Also release trace and
 // instantiate ownership without waiting for another driver command.
 const poll=setInterval(()=>{if(entry&&entry.observer.report.status!=='running'){cleanup(entry.observer.report.status);clearInterval(poll);}if(terminal)clearInterval(poll);},10);
 poll.unref?.();
 globalThis.__strongholdPresetAttachment={invoke,report};
 return globalThis.__strongholdPresetAttachment;
}

function workerSource({observeSource,observerSource,options}){
 return observeSource+'\n'+observerSource+'\n;('+installWorker.toString()+')('+JSON.stringify(options)+');';
}
function createAttachment({sessions,save,log,pageState,wasmSha256,enabled=true,validateAck}){
 validateAck||=require(path.join(ROOT,'scratch/runs/20261104-stronghold-explicit-idle-input/native-start-boundary.cjs')).assertAck;
 let owner=null,active=false,terminal=false,fatal=null,seq=0,command=null,balanced=false;
 const persist=value=>{save('preset-attachment-'+seq+++'.json',value);return value;};
 async function rpc(action,row){
   if(!owner||sessions.get(owner.id)!==owner.entry||owner.entry.sessionId!==owner.sessionId||owner.entry.session!==owner.session||owner.entry.info.url!==owner.url)throw Error('lost exact Worker target/session');
   const r=await owner.entry.session.send('Runtime.evaluate',{expression:`JSON.stringify(globalThis.__strongholdPresetAttachment.invoke(${JSON.stringify(action)},${JSON.stringify(row||{})}))`,returnByValue:true});
   if(r.exceptionDetails)throw Error('Worker attachment evaluation: '+JSON.stringify(r.exceptionDetails));
   const value=JSON.parse(r.result?.value||'null');
   if(!value||value.targetId!==owner.id||value.sessionId!==owner.entry.sessionId||value.workerURL!==owner.entry.info.url)throw Error('foreign Worker target/session report');
   return persist(value);
 }
 async function finish(reason){
   if(!enabled||terminal)return;
   terminal=true;active=false;
   try{if(owner)await rpc('finish',{reason});}catch(e){persist({reason,error:String(e),history:'unknown; last reports retained'});}
 }
 async function failed(error){
   if(!enabled||terminal)return;
   try{if(active)await rpc('annotate',{kind:'failed',reason:String(error)});}catch(e){persist({error:String(e),history:'unknown; pending frames retained in prior reports'});}
   await finish('first-command-failed');
 }
 async function annotate(row){if(fatal)throw fatal;if(active){try{await rpc('annotate',row);}catch(e){await failed(e);throw e;}}}
 async function begin(c,i){
   if(!enabled)return;
   if(fatal&&c.action!=='quit')throw fatal;
   if(c.action!=='route-press-preset')return;
   if(terminal)throw Error('preset attachment terminal');
   try{
     const candidates=[...sessions].filter(([,e])=>e.preloadVerified&&e.info.url===e.expectedWorkerURL);
     if(candidates.length!==1)throw Error('single exact preloaded Worker target/session prerequisite');
     const [id,entry]=candidates[0];owner={id,entry,sessionId:entry.sessionId,session:entry.session,url:entry.info.url};
     const r=await rpc('report');
     const page=await pageState(),events=page.main?.observation?.events;
     if(!Array.isArray(events))throw Error('original compile/send evidence missing');
     const sent=events.filter(e=>e.kind==='sent-module'&&e.workerURL===entry.info.url);
     const compiled=events.filter(e=>e.kind==='compiled'&&e.sha256===wasmSha256);
     const received=r.events.filter(e=>e.kind==='received-module');
     const instantiated=r.events.filter(e=>e.kind==='instantiated');
     if(sent.length!==1||sent[0].sha256!==wasmSha256||sent[0].slot!==0||sent[0].type!=='init'||compiled.length!==1||
       events.indexOf(compiled[0])>events.indexOf(sent[0])||received.length!==1||received[0].slot!==0||received[0].type!=='init'||
       instantiated.length!==1||instantiated[0].incoming?.slot!==0||instantiated[0].incoming?.type!=='init'||
       r.entries!==1||!r.installedBeforeInstantiation||r.entryError)throw Error('original compile/send/slot0 Module binding missing or ambiguous');
     command=i;balanced=false;await rpc('start',{command});active=true;
   }catch(e){await failed(e);throw e;}
 }
 return {get active(){return active;},begin,failed,finish,assertLive(){if(fatal)throw fatal;},
   async event(kind,state){if(fatal)throw fatal;if(!active)return;const m=state.main;await annotate({kind,steps:m.tick.steps,input:m.inputQueue,activeInput:m.activeInput,lastInput:m.lastInput,mask:m.mouseButtonsMask,inputTelemetry:m.inputTelemetry});if(kind==='UP-consumed')balanced=true;},
   async ack(result,requested,before){
     if(fatal)throw fatal;
     if(!active)return;
     try{
       validateAck(result,before,requested);
       await annotate({kind:'ACK',requested,before,steps:result.steps,guests:result.guests});await rpc('check');
     }catch(e){await failed(e);throw e;}
   },
   async capture(name,digest,state){await annotate({kind:'capture',name,sha256:digest,steps:state.main.tick.steps});},
   async success(c){if(active&&c.action==='route-press-preset'){
     if(!balanced)throw Error('balanced original consumption missing');
     await rpc('check');await annotate({kind:'success'});active=false;terminal=true;
   }},
   retire(event){for(const [id,e]of sessions){if(e.sessionId===event.sessionId){sessions.delete(id);log('preset-detached.jsonl',{id,sessionId:e.sessionId,history:'unknown'});if(owner?.id===id){fatal=Error('owning Worker session detached; native history unknown');terminal=true;active=false;persist({reason:'owning-session-detached',history:'unknown; retain last native frames'});}}}}
 };
}

function composeRoute(source){
 if(hash(source)!==ROUTE_SHA)throw Error('sealed original route hash mismatch');
 source=replaceOnce(source,"function createRouteDriver({page,state,shot,controls,review,boundary,live,maxSteps=4096})", "function createRouteDriver({page,state,shot,controls,review,boundary,live,maxSteps=4096,presetAttachment})");
 source=replaceOnce(source,'this.live=options.live;','this.live=options.live;this.presetAttachment=options.presetAttachment;');
 source=replaceOnce(source,'{maxSteps,review:checkedReview,live}', '{maxSteps,review:checkedReview,live,presetAttachment}');
 source=replaceOnce(source,'assertReady(s,mask);return;', 'assertReady(s,mask);return s;');
 source=replaceOnce(source,'await this.step();await this.drain(mask);this.pending=null;',
   "if(action==='down'||action==='up')await this.presetAttachment?.event(action==='down'?'DOWN-enqueued':'UP-enqueued',s);\n   await this.step();const drained=await this.drain(mask);\n   if(action==='down'||action==='up')await this.presetAttachment?.event(action==='down'?'DOWN-consumed':'UP-consumed',drained);\n   this.pending=null;");
 return source;
}
function composeDriver(source,{run,pins,wasmSha256,enabled=true,attachmentPath=__filename}){
 if(hash(source)!==DRIVER_SHA)throw Error('sealed original driver hash mismatch');
 const q=JSON.stringify;
 source=replaceOnce(source,"RUN=__dirname,OUT=path.join(RUN,'browser')",`RUN=${q(run)},OUT=path.join(RUN,'browser')`);
 source=replaceOnce(source,"const callbackPreload=fs.readFileSync(path.join(RUN,'../20261104-stronghold-current-request-native/observer-preload.js'),'utf8');",`const attachmentAPI=require(${q(attachmentPath)});`);
 source=replaceOnce(source,"const preload=fs.readFileSync(path.join(RUN,'../20261104-stronghold-explicit-idle-input/observe-browser.js'),'utf8');",`const preload=fs.readFileSync(${q(path.join(ROOT,'scratch/runs/20261104-stronghold-explicit-idle-input/observe-browser.js'))},'utf8');`);
 source=replaceOnce(source,"let observerActive=false;\nconst observerControl=require('../20261104-stronghold-current-request-native/observer-control.cjs').createObserverControl({sessions,save,log,onActive:v=>{observerActive=v;}});\nconst observerCommand=observerControl.command;",
   `const presetAttachment=attachmentAPI.createAttachment({sessions,save,log,pageState:state,validateAck:assertAck,wasmSha256:${q(wasmSha256)},enabled:${enabled}});`);
 source=replaceOnce(source,"if(observerActive)await observerCommand('stop','terminal');", "await presetAttachment.finish('terminal');");
 source=replaceOnce(source,"log('personal-reviews.jsonl',receipt);if(cap.scene==='choose-type-custom-hover')await observerCommand('arm','reviewed-hover');return receipt;", "log('personal-reviews.jsonl',receipt);return receipt;");
 source=replaceOnce(source,"save(name+'.json',{sha256:sha(png),state:current});return {png,state:current};", "save(name+'.json',{sha256:sha(png),state:current});await presetAttachment.capture(name,sha(png),current);return {png,state:current};");
 source=replaceOnce(source,'live:commandLive,maxSteps:4096},dispatch)', 'live:commandLive,maxSteps:4096,presetAttachment},dispatch)');
 source=replaceOnce(source,"if(stepping&&observerActive)await observerCommand('sample','pre-ACK');",'const observerBefore=stepping&&presetAttachment.active?(await state()).main.tick.steps:null;');
 source=replaceOnce(source,"if(stepping&&observerActive)await observerCommand('sample','post-ACK');",'if(stepping)await presetAttachment.ack(result,args[0],observerBefore);');
 source=replaceOnce(source,'function commandLive(){operatorLive();','function commandLive(){presetAttachment.assertLive();operatorLive();');
 source=replaceOnce(source,"const pins=JSON.parse(fs.readFileSync(path.join(RUN,'../20261104-stronghold-explicit-idle-input/runtime-pins.json')));",`const pins=JSON.parse(fs.readFileSync(${q(pins)}));`);
 source=replaceOnce(source,"cdp.on('Target.detachedFromTarget',observerControl.retire);","cdp.on('Target.detachedFromTarget',presetAttachment.retire);");
 source=replaceOnce(source,"sessions.set(event.targetInfo.targetId,{session,sessionId:event.sessionId,info:event.targetInfo});",`const owner={session,sessionId:event.sessionId,info:event.targetInfo,expectedWorkerURL:event.targetInfo.url,preloadVerified:false};\n    sessions.set(event.targetInfo.targetId,owner);`);
 source=replaceOnce(source,"const result=await session.send('Runtime.evaluate',{expression:preload+'\\n'+callbackPreload});",`if(event.waitingForDebugger!==true)throw Error('late Worker preload: not paused at attach');
      const expression=${enabled}?attachmentAPI.workerSource({observeSource:preload,observerSource:fs.readFileSync(require.resolve('./stronghold-native-preset-observer.cjs'),'utf8'),options:{targetId:event.targetInfo.targetId,sessionId:event.sessionId,expectedWorkerURL:event.targetInfo.url,exeSha256:attachmentAPI.EXE_SHA256,wasmSha256:${q(wasmSha256)},deadlineEpochMs:deadline}}):preload;
      const result=await session.send('Runtime.evaluate',{expression});` .replace("require.resolve('./stronghold-native-preset-observer.cjs')",q(path.join(ROOT,'tools/stronghold-native-preset-observer.cjs'))));
 source=replaceOnce(source,"if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));\n      log('worker-preloads.jsonl'", "if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));owner.preloadVerified=true;\n      log('worker-preloads.jsonl'");
 source=replaceOnce(source,'const result=await mailboxDispatch(c,i);', 'await presetAttachment.begin(c,i);const result=await mailboxDispatch(c,i);await presetAttachment.success(c);');
 source=replaceOnce(source,"catch(e){halted=true;save('reply-'+i+'.json'", "catch(e){halted=true;await presetAttachment.failed(e);save('reply-'+i+'.json'");
 // This assignment deliberately ends at route handoff; Start/gameplay remain
 // unavailable even if an operator submits a predecessor native command.
 source=replaceOnce(source,"if(c.action==='title-enter')", "if(['install-native','gesture'].includes(c.action))throw Error('preset attachment ends before Start/gameplay');\n if(c.action==='title-enter')");
 return source;
}
function compileClosure(source,filename,routeSource,hashes=closureHashes(filename)){
 const expected=new Map(hashes.map(r=>[path.resolve(ROOT,r.path),r.sha256])),cache=new Map();
 const routeFile=path.join(path.dirname(filename),'route-driver.cjs');
 function load(file,parent){
   if(cache.has(file))return cache.get(file).exports;
   const bytes=retained(file);
   if(hash(bytes)!==expected.get(file))throw Error('retained helper source changed '+file);
   const m=new Module(file,parent);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));cache.set(file,m);
   const native=m.require.bind(m);
   m.require=id=>{
     if(id.startsWith('.')){
       const base=path.resolve(path.dirname(file),id),target=[base,base+'.js',base+'.cjs',base+'.json'].find(f=>expected.has(f));
       if(target)return load(target,m);
     }
     return native(id);
   };
   if(file.endsWith('.json'))m.exports=JSON.parse(bytes);
   else m._compile(file===filename?source:file===routeFile?routeSource:bytes.toString(),file);
   return m.exports;
 }
 return load(filename,module);
}
function closureHashes(driver){
 const seen=new Set(),rows=[];
 function visit(file){
   if(seen.has(file))return;seen.add(file);
   const bytes=retained(file);rows.push({path:path.relative(ROOT,file),sha256:hash(bytes)});
   if(!/\.(cjs|js)$/.test(file))return;
   for(const match of bytes.toString().matchAll(/require\(['"](\.[^'"]+)['"]\)/g)){
     const p=path.resolve(path.dirname(file),match[1]);
     const target=[p,p+'.js',p+'.cjs',p+'.json'].find(f=>fs.existsSync(f)||fs.existsSync(f+'.gz'));
     if(!target)throw Error('retained closure dependency missing '+p);
     visit(target);
   }
 }
 visit(driver);visit(path.join(ROOT,'scratch/runs/20261104-stronghold-explicit-idle-input/observe-browser.js'));
 return rows;
}
function prepare({run,pins,driver=path.join(ROOT,ORIGINAL),enabled=true}){
 if(!run||!pins||!path.isAbsolute(run)||!path.isAbsolute(pins))throw Error('absolute fresh --run and --pins required');
 if(fs.existsSync(path.join(run,'browser')))throw Error('fresh run required; original attempts never resume');
 const observer=require('./stronghold-native-preset-observer.cjs'),manifest=JSON.parse(fs.readFileSync(pins));
 for(const f of manifest.files||[])if(hash(fs.readFileSync(path.join(ROOT,f.path)))!==f.sha256)throw Error('current source pin mismatch '+f.path);
 const wasm=manifest.files?.filter(f=>f.path==='build/wine-assembly.wasm');
 if(wasm?.length!==1||hash(fs.readFileSync(path.join(ROOT,MEDIA)))!==observer.EXE_SHA256)throw Error('original media/module pin prerequisite');
 const driverSource=retained(driver),routeSource=retained(path.join(path.dirname(driver),'route-driver.cjs'));
 const source=composeDriver(driverSource.toString(),{run,pins,wasmSha256:wasm[0].sha256,enabled}),route=composeRoute(routeSource.toString());
 const relevant=['tools/stronghold-native-preset-observer.cjs','tools/stronghold-preset-driver-attachment.cjs','lib/guest-worker.js',MEDIA];
 const evidence={observerCommit:OBSERVER_COMMIT,driver:{path:driver,sha256:hash(driverSource)},route:{path:path.join(path.dirname(driver),'route-driver.cjs'),sha256:hash(routeSource)},wasmSha256:wasm[0].sha256,enabled,
   currentSources:relevant.map(file=>({path:file,sha256:hash(fs.readFileSync(path.join(ROOT,file)))})),retainedClosure:closureHashes(driver),servedClosure:manifest.files,compositionSHA256:hash(source),routeCompositionSHA256:hash(route),bounds:{navigation:16384,route:4096,arrival:3072,stability:768,perACK:64,commandMs:40000,chromeMs:360000}};
 return {source,route,driver,evidence};
}
const api={ORIGINAL,DRIVER_SHA,ROUTE_SHA,MEDIA,OBSERVER_COMMIT,EXE_SHA256:require('./stronghold-native-preset-observer.cjs').EXE_SHA256,hash,retained,replaceOnce,installWorker,workerSource,createAttachment,composeRoute,composeDriver,compileClosure,closureHashes,prepare};
module.exports=api;
if(require.main===module){
 try{
   const args=process.argv.slice(2),get=n=>args[args.indexOf(n)+1];
   if(!args.includes('--run')||!args.includes('--pins')||args.some((a,i)=>a.startsWith('--')&&!['--run','--pins','--driver','--observer-off','--check'].includes(a)))throw Error('usage: node tools/stronghold-preset-driver-attachment.cjs --run ABS_FRESH_RUN --pins ABS_CURRENT_PINS [--driver ABS_RETAINED_DRIVER] [--observer-off] [--check]');
   const run=get('--run'),p=prepare({run,pins:get('--pins'),driver:args.includes('--driver')?get('--driver'):undefined,enabled:!args.includes('--observer-off')});
   fs.mkdirSync(run,{recursive:true});fs.writeFileSync(path.join(run,'attachment-composition.json'),JSON.stringify(p.evidence,null,2)+'\n');
   if(args.includes('--check'))console.log(JSON.stringify(p.evidence,null,2));else compileClosure(p.source,p.driver,p.route,p.evidence.retainedClosure);
 }catch(e){console.error(e.stack||String(e));process.exitCode=1;}
}
