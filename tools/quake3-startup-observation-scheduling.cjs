'use strict';
// Startup uses genuine transport completions, never speculative Worker polls.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const base=require('./quake3-browser-controller.cjs'),vis=require('./quake3-visibility-controller.cjs');
const {hash}=require('./quake3-startup-observer.cjs');
const ROOT=path.resolve(__dirname,'..'),RUN='scratch/runs/20261115-quake3-startup-observation-scheduling/',FILE='./quake3-startup-observation-scheduling.cjs';
const BINDING='__q3StartupCompletion',MAX_AGE_MS=1000,once=vis.replaceOnce;
function createRegistry({now=()=>performance.now(),epochNow=()=>Date.now()}={}){
  const sessions=new Map();
  const notReady=reason=>({status:'NOT_READY',workerRequests:0,reason});
  function invalidate(sessionId,reason){const s=sessions.get(sessionId);if(s){s.record=null;s.poison=reason;}}
  function observe(v){
    const p=v.params||{},sid=v.sessionId;
    if(v.method==='Target.attachedToTarget'&&p.targetInfo.type==='worker')sessions.set(p.sessionId,{targetId:p.targetInfo.targetId,contexts:new Map(),scripts:new Map(),nonce:null,record:null,poison:null,sequence:0,generation:0});
    if(v.method==='Target.detachedFromTarget'){sessions.delete(p.sessionId);return;}
    const s=sessions.get(sid);if(!s)return;
    if(v.method==='Runtime.executionContextCreated'){
      const c=p.context;s.contexts.set(c.id,{id:c.id,uniqueId:c.uniqueId});s.nonce=null;s.record=null;s.poison=null;s.sequence=0;s.generation=0;
    }
    if(v.method==='Runtime.executionContextDestroyed'||v.method==='Runtime.executionContextsCleared'){
      if(p.executionContextId!==undefined)s.contexts.delete(p.executionContextId);else s.contexts.clear();s.nonce=null;s.record=null;
    }
    if(v.method==='Debugger.scriptParsed'){
      if(p.isLiveEdit||(p.url&&s.scripts.has(p.url)&&s.scripts.get(p.url)!==p.hash))invalidate(sid,'actual source replacement');
      if(p.url)s.scripts.set(p.url,p.hash);
    }
    if(v.method!=='Runtime.bindingCalled'||p.name!==BINDING)return;
    const context=s.contexts.get(p.executionContextId);
    if(!context?.uniqueId||context.uniqueId!==s.uniqueId||!s.nonce)return;
    let r;try{r=JSON.parse(p.payload);}catch{invalidate(sid,'invalid completion JSON');return;}
    // Old numeric context IDs may be reused; an old installation cannot
    // invalidate or refresh the current installation through delayed delivery.
    if(r.nonce!==s.nonce)return;
    if(s.poison)return;
    if(!Number.isSafeInteger(r.sequence)||r.sequence<=s.sequence||!Number.isSafeInteger(r.generation)||r.generation<1){invalidate(sid,'unordered completion');return;}
    s.sequence=r.sequence;
    if(r.kind==='context-lost'||r.kind==='overflow'){invalidate(sid,r.kind);return;}
    if(r.kind==='generation'){s.generation=r.generation;s.record=null;return;}
    if(r.kind!=='complete'||![r.transportId,r.endpointId,r.frameToken,r.hwnd].every(n=>Number.isSafeInteger(n)&&n>0)||!Number.isFinite(r.epochMs))return;
    if(s.generation&&s.generation!==r.generation){invalidate(sid,'device generation changed without notification');return;}
    s.generation=r.generation;
    if(s.record&&(r.transportId<=s.record.transportId||r.frameToken<=s.record.frameToken)){invalidate(sid,'reordered frame');return;}
    s.record={...r,receivedMs:now(),targetId:s.targetId,sessionId:sid,contextId:context.id,contextUniqueId:context.uniqueId};
  }
  function install(sid,nonce){
    const s=sessions.get(sid);assert(s&&s.contexts.size===1,'one live actual Worker context required');
    const c=[...s.contexts.values()][0];assert(c.uniqueId&&typeof nonce==='string'&&nonce.length,'unique realm and installation nonce required');
    assert(!s.nonce,'completion observer cannot be reinstalled');s.uniqueId=c.uniqueId;s.nonce=nonce;
  }
  function read(sid,owner){
    const s=sessions.get(sid),r=s?.record;
    if(!s||s.poison||!r||!s.nonce)return notReady(s?.poison||'no live completion');
    if(s.contexts.size!==1||s.contexts.get(r.contextId)?.uniqueId!==r.contextUniqueId||r.nonce!==s.nonce||r.generation!==s.generation)return notReady('context/generation changed');
    const age=epochNow()-r.epochMs,receiptAge=now()-r.receivedMs;
    if(age < -2||age>MAX_AGE_MS||receiptAge<0||receiptAge>MAX_AGE_MS)return notReady('stale or future producer time');
    if(r.endpointId!==owner.endpointId||r.hwnd!==owner.hwnd)return notReady('endpoint/window changed');
    if(owner.pending!==undefined&&owner.pending!==0)return notReady('newer pending transport');
    if(owner.sequence!==undefined&&owner.sequence!==r.transportId)return notReady('newer transport sequence');
    if(owner.publication!==undefined&&!(owner.publication>0))return notReady('no ordinary publication');
    const x=r.snapshot;
    if(!x||![x.draws,x.transfers,x.frontendDraws,x.frontendPresents].every(n=>Number.isFinite(n)&&n>0)||!x.contexts?.some(c=>c.hwnd===r.hwnd&&c.current&&c.deviceObserved&&!c.software))return notReady('no initialized native frontend frame');
    return {status:'READY',workerRequests:0,...r};
  }
  return {observe,install,read,invalidate};
}
// No GL status queries, native-call clocks, pixels, timers or task scheduling.
// The existing snapshot is counters/identities only. render-done is a transport
// completion, not GPU idleness or a promise that the next task will be short.
function workerInstall({nonce,binding}){
  if(globalThis.__q3StartupObservation)throw Error('startup observer already installed');
  let sequence=0,generation=0,active=true,last=-Infinity,emitted=0,frame=null,initialized=false;
  const known=new WeakSet(),post=self.postMessage,get=OffscreenCanvas.prototype.getContext;
  const emit=value=>{globalThis[binding](JSON.stringify({nonce,sequence:++sequence,generation,...value}));};
  OffscreenCanvas.prototype.getContext=function(...args){
    const gl=Reflect.apply(get,this,args);
    if(gl&&/^webgl/.test(args[0])&&!known.has(gl)){
      known.add(gl);generation++;if(active)emit({kind:'generation'});
      this.addEventListener('webglcontextlost',()=>{if(active){emit({kind:'context-lost'});active=false;}});
    }return gl;
  };
  self.postMessage=function(message,...args){
    const result=Reflect.apply(post,this,[message,...args]);
    if(!active)return result;
    if(message?.t==='render-event'&&message.message?.t==='frame'){
      const f=message.message.frame;frame=f?{endpointId:message.endpointId,frameToken:f.frameToken,hwnd:f.hwnd}:null;
    }
    if(message?.t==='render-done'&&frame){
      const f=frame;frame=null;const ms=performance.now();
      if(!initialized||ms-last>=100){
        if(emitted++>=512){emit({kind:'overflow'});active=false;return result;}
        const snapshot=globalThis.__gltronObserver?.snapshot?.()??null;
        initialized=!!(snapshot?.frontendDraws>0&&snapshot?.frontendPresents>0&&snapshot?.draws>0&&snapshot?.transfers>0);
        last=ms;emit({kind:'complete',...f,transportId:message.transportId,epochMs:performance.timeOrigin+ms,snapshot});
      }
    }return result;
  };
  globalThis.__q3StartupObservation={stop(){active=false;frame=null;}};return true;
}
function instrumentation(nonce){return '('+workerInstall.toString()+')('+JSON.stringify({nonce,binding:BINDING})+')';}
function installation(c,sid){const nonce=require('node:crypto').randomUUID();c.startupObservation.install(sid,nonce);return instrumentation(nonce);}
function connection(url,out,externalObserver){
  const c=base.connection(url,externalObserver),r=createRegistry(),receive=c.ws.onmessage,send=c.send;
  c.startupObservation=r;
  c.ws.onmessage=function(event){r.observe(JSON.parse(event.data));return Reflect.apply(receive,this,[event]);};
  c.send=function(method,params,sessionId){if(method==='Debugger.setScriptSource')r.invalidate(sessionId,'explicit source replacement');return Reflect.apply(send,c,[method,params,sessionId]);};
  return c;
}
function load(filename,source){const m=new Module(filename,module);m.filename=filename;m.paths=module.paths;m._compile(source,filename);return m.exports;}
function compose(source){
  let s=vis.compose(source);
  s=once(s,"'scratch/runs/20261115-quake3-source-inventory/']","'scratch/runs/20261115-quake3-source-inventory/','"+RUN+"']");
  s=once(s,'c=connection(url);await c.ready;',"c=require('"+FILE+"').connection(url,out);await c.ready;");
  s=once(s,"await c.send('Runtime.evaluate',{expression:GL_OBSERVER},sessionId);", "await c.send('Runtime.evaluate',{expression:GL_OBSERVER},sessionId);await c.send('Runtime.addBinding',{name:'"+BINDING+"'},sessionId);{const expr=require('"+FILE+"').installation(c,sessionId);sourceInventory.noteEvaluation(sessionId,expr);await c.send('Runtime.evaluate',{expression:expr},sessionId);}");
  s=once(s,'slice:w?._workerLastSlice??null,d3dStats:', 'slice:w?._workerLastSlice??null,startupRenderQueue:{pending:w?._renderWorkerManager?.pending?.size??null,sequence:w?._renderWorkerManager?.sequence??null},d3dStats:');
  s=once(s,"const observations=await Promise.all(renderers.map(w=>evaluate('globalThis.__gltronObserver?.snapshot?.()??null',w.sessionId)));",`const hints=renderers.map(w=>c.startupObservation.read(w.sessionId,{endpointId:startupOwner.renderEndpoint,hwnd:startupOwner.windowHwnd,...live[0].startupRenderQueue,publication:live[0].publication}));
      log('startup-scheduling.jsonl',{at:Date.now(),hints});
      const observations=hints.map(h=>h.status==='READY'?h.snapshot:null);`);
  s=once(s,'evaluate(`Array.from(endpoints,', 'evaluate(`(globalThis.__q3StartupObservation?.stop?.(),Array.from(endpoints,');
  s=once(s,'control:e.control?Array.from(e.control):null}))`,w.sessionId)', 'control:e.control?Array.from(e.control):null})))`,w.sessionId)');
  return s+"\nmodule.exports.connection=(url)=>require('"+FILE+"').connection(url,process.env.QUAKE3_TEST_OUT);\n";
}
function controller(){const file=ROOT+'/tools/quake3-browser-controller.cjs';return load(file,compose(fs.readFileSync(file,'utf8')));}
function qualificationSource(source){
  let s=vis.qualificationSource(source);
  s=once(s,"const controller=require('../tools/quake3-visibility-controller.cjs').controller();","const controller=require('../tools/quake3-startup-observation-scheduling.cjs').controller();");
  s=once(s,"await c.send('Runtime.enable',{},sessionId);await c.send('Debugger.enable',{},sessionId);", "await c.send('Runtime.enable',{},sessionId);await c.send('Runtime.addBinding',{name:'"+BINDING+"'},sessionId);for(const expression of [controller.GL_OBSERVER,require('../tools/quake3-startup-observation-scheduling.cjs').installation(c,sessionId)]){sourceInventory.noteEvaluation(sessionId,expression);await c.send('Runtime.evaluate',{expression},sessionId);}await c.send('Debugger.enable',{},sessionId);");
  s=once(s,"await cdp.send('Page.enable',{});","await cdp.send('Page.enable',{});await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:require('../test/test-quake3-fullscreen-exit-layout.cjs').INIT});");
  s=once(s,'    report.hostNoReplay=true;',"    report.hostNoReplay=true;await require('../test/test-quake3-fullscreen-exit-layout.cjs').chromeExit({evaluate,cdp,page,report,PAGE_READ,root,expect:'green',browserURL:c.ws.url,controller});");
  return once(s,'  const unknownAt=Date.now(),unknownBefore=',"  await require('../test/quake3-compact-readiness-fixture.cjs').chromeEquivalence({evaluate,cdp,report,old:require('../tools/quake3-compact-readiness.cjs').legacyController(),compact:controller});\n  const unknownAt=Date.now(),unknownBefore=");
}
function assertSchedulingQualification(pins){
  const q=pins.schedulingQualification;assert(q,'fresh scheduling qualification required');
  const read=p=>{assert(p.path.startsWith(RUN+'scheduling-chrome/')&&!p.path.includes('..'));const b=fs.readFileSync(ROOT+'/'+p.path);assert.equal(hash(b),p.sha256);return JSON.parse(b);};
  const report=read(q.report),tested=read(q.pins),post=read(q.postflight);
  assert(report.passed&&report.originals===0&&report.cases.length===3);
  for(const arm of ['minimal','instrumented']){const r=report.cases.find(v=>v.arm===arm);assert(r.busyDurationMs>=4200&&r.queueRaceRefused&&r.staleRefused&&r.eventualValidSnapshot&&r.capture&&r.actualSourceInventory&&r.retiredSourceRefused);assert(r.passive.workerRequests===0);}
  assert(report.cases.find(v=>v.arm==='minimal').contextLossRefused&&report.cases.find(v=>v.arm==='instrumented').actualSourceReplacementRefused);
  const late=report.cases.find(v=>v.arm==='written-late');assert(late.terminalUNKNOWN&&late.requestsAfterTerminal===0&&late.lateReply.afterTerminal);
  for(const p of tested.files){assert.equal(hash(fs.readFileSync(ROOT+'/'+p.path)),p.sha256);assert(pins.files.some(v=>v.path===p.path&&v.sha256===p.sha256));}
  for(const p of tested.hostFiles){assert.equal(hash(fs.readFileSync(p.path)),p.sha256);assert(pins.hostFiles.some(v=>v.path===p.path&&v.sha256===p.sha256));}
  assert(!post.pinDrift.length&&!post.httpMismatches.length&&post.requestsAfterTerminal===0&&post.allPIDsAbsent&&post.profileAbsent);
  const folder=ROOT+'/'+RUN+'scheduling-chrome';for(const name of ['native-wait.json','watchdog-wait.json','outer-child-wait.json']){const w=JSON.parse(fs.readFileSync(folder+'/'+name));assert(w.exit===0&&w.actualWait&&w.stdoutEOF&&w.stderrEOF);assert(!fs.existsSync('/proc/'+w.pid));}
  const released=JSON.parse(fs.readFileSync(folder+'/supervisor-complete.json'));assert(released.heavyReleased&&released.bothEOF&&released.actualChildWaits);
  return true;
}
function visibility(){
  const file=ROOT+'/tools/quake3-visibility-controller.cjs';let s=fs.readFileSync(file,'utf8');
  s=once(s,"const ORIGINAL_RUN='scratch/runs/20261115-quake3-source-inventory/';","const ORIGINAL_RUN='"+RUN+"';");
  for(const name of ['controller','compose','qualificationSource'])s=once(s,vis[name].toString(),'function '+name+'(...args){return require("'+FILE+'").'+name+'(...args);}');
  s=once(s,'  return true;\n}\nasync function original(out)', '  require("'+FILE+'").assertSchedulingQualification(pins);const nativeReport=JSON.parse(fs.readFileSync(folder+"/report.json"));assert(nativeReport.fullscreenExitLayout?.completePublicPaint&&nativeReport.fullscreenExitLayout?.retiredContextRefused&&nativeReport.compactReadiness?.semanticEquivalence);return true;\n}\nasync function original(out)');
  s=once(s,"authorization:'20261115 published causal source-inventory correction; one registered original',productionCorrection:true", "authorization:'20261115 published passive startup scheduling repair; one registered original',productionCorrection:true,optionalPerCallDiagnostics:false");
  return load(file,s);
}
module.exports={RUN,BINDING,MAX_AGE_MS,createRegistry,instrumentation,installation,connection,compose,controller,qualificationSource,visibility,assertSchedulingQualification};
if(require.main===module){
  const [mode,out]=process.argv.slice(2);assert(['scheduling-chrome','qualified','original'].includes(mode));assert(path.resolve(out).startsWith(ROOT+'/'+RUN));
  const watchdog=JSON.parse(fs.readFileSync(out+'/watchdog-armed.json'));assert(watchdog.independent&&fs.existsSync('/proc/'+watchdog.pid)&&watchdog.deadline*1000>Date.now());
  assert.equal(JSON.parse(fs.readFileSync(out+'/heavy-lock.json')).pid,process.ppid,'independent supervisor must own runtime');
  Promise.resolve(mode==='scheduling-chrome'?(vis.installServer(out),require('../test/test-quake3-startup-observation-scheduling.cjs').chromeControls(out)):mode==='qualified'?visibility().qualified(out):visibility().original(out)).catch(error=>{console.error(error);process.exitCode=1;});
}
