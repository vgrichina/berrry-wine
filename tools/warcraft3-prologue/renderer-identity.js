'use strict';
// Opt-in Linux/CDP page identity guard. Trace on the *page* session: Chromium's
// TracingHandler::EmitFrameTree needs a WebContents; a browser session has none.
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {identity,hasArgument}=require(fs.existsSync(__dirname+'/native-clock-process-proof.cjs')?'./native-clock-process-proof.cjs':'../native-clock-process-proof.cjs');
const clone=v=>JSON.parse(JSON.stringify(v));
function createRendererIdentity({browserSession,pageSession,chromePid,deadline,retain,retainTrace,
 collectionMs=8000,maxTraceBytes=4*1024*1024,readIdentity=identity}) {
 assert(browserSession&&pageSession&&typeof retain==='function');
 assert(Number.isFinite(deadline)&&deadline>Date.now());
 assert(collectionMs>0&&collectionMs<=10000&&maxTraceBytes>0&&maxTraceBytes<=8*1024*1024);
 let proof=null,unknown=null,disposed=false,collecting=false,traceOwned=false,traceHandle=null;
 let epoch=0,eventCount=0,terminalProof=null,traceComplete=null,discoveryReady=false;
 const listeners=[],crashEvents=[];
 function record(kind,value){
  const result=retain({kind,at:Date.now(),...clone(value)});
  assert(!result||typeof result.then!=='function','retain must durably write synchronously');
 }
 function fail(reason){
  if(!unknown){unknown=Error('UNKNOWN renderer identity: '+reason);try{record('unknown',{reason:unknown.message})}catch{} }
  return unknown;
 }
 function invalidate(reason){epoch++;fail(reason);}
 function listen(session,name,fn){const wrapped=value=>{if(disposed)return;try{fn(value)}catch(e){fail(e.message)}};session.on(name,wrapped);listeners.push(()=>session.off(name,wrapped));}
 function event(name,value,crash=false){
  // Save even the second crash event after Inspector has invalidated the guard.
  // Never resurrect a proof invalidated by navigation/detach/recreation.
  if(++eventCount>64){fail('event cap');return;}
  if(crash&&proof&&!unknown)terminalProof=clone(proof);
  const entry={name,value,at:Date.now()};
  if(crash)crashEvents.push(clone(entry));
  record('event',{...entry,preFaultIdentity:crash?terminalProof:null});
  invalidate(name);
 }
 for(const name of ['Target.targetCrashed','Target.targetDestroyed'])listen(browserSession,name,v=>{
  if(v.targetId===proof?.targetId||v.targetId===targetId)event(name,v,name==='Target.targetCrashed');
 });
 let targetId=null;
 listen(browserSession,'Target.targetCreated',v=>{if(discoveryReady&&v.targetInfo?.targetId===targetId)event('Target.targetCreated (identity recreated)',v)});
 listen(browserSession,'Target.detachedFromTarget',v=>{if(v.targetId===targetId||v.sessionId===pageSession.id())event('Target.detachedFromTarget',v)});
 for(const name of ['Inspector.targetCrashed','Inspector.detached','Inspector.targetReloadedAfterCrash','CDPSession.Disconnected'])listen(pageSession,name,v=>event(name,v||{},name==='Inspector.targetCrashed'));
 listen(browserSession,'CDPSession.Disconnected',v=>event('browser session disconnected',v||{}));
 for(const name of ['Page.frameNavigated','Page.frameDetached','Page.frameStartedLoading','Page.navigatedWithinDocument'])listen(pageSession,name,v=>{
  const id=v.frame?.id||v.frameId;
  // Before the first frame read any navigation is unsafe; after it only the
  // bound main frame invalidates (subframes have their own renderer identity).
  if(!boundFrame||id===boundFrame)event(name,v);
 });
 let boundFrame=null;
 const cap=setTimeout(()=>invalidate('immutable lifetime deadline'),deadline-Date.now());cap.unref?.();
 const same=(a,b)=>assert.deepEqual(a,b,'process identity changed');
 function check(){
  if(unknown)throw unknown;
  try{
   assert(!disposed,'guard disposed');assert(Date.now()<deadline,'immutable lifetime deadline');assert(proof,'not qualified');
   same(readIdentity(chromePid),proof.chrome);same(readIdentity(proof.renderer.pid),proof.renderer);
   return clone(proof);
  }catch(e){throw fail(e.message)}
 }
 async function qualify(){
  if(unknown)throw unknown;
  if(collecting||proof||disposed)throw fail('one qualification per guard');collecting=true;
  const began=Date.now(),due=Math.min(deadline,began+collectionMs);let timer;
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(fail('bounded collection timeout')),Math.max(0,due-Date.now()))});
  const bounded=promise=>Promise.race([promise,timeout]);
  const send=(s,m,p={})=>bounded(s.send(m,p));
  const healthy=()=>{if(unknown)throw unknown;assert(Date.now()<due,'collection deadline');};
  try {
   const chrome=readIdentity(chromePid);
   function completeIdentity(p){assert(p&&Number.isSafeInteger(p.pid)&&/^[0-9]+$/.test(p.startTicks||'')&&typeof p.bootId==='string'&&p.bootId&&p.namespaces?.pid&&p.exe,'complete Linux start identity required');}
   completeIdentity(chrome);
   const info=(await send(pageSession,'Target.getTargetInfo')).targetInfo;
   assert(info.type==='page','exact page target required');targetId=info.targetId;
   await send(browserSession,'Target.setDiscoverTargets',{discover:true});discoveryReady=true;
   await send(pageSession,'Page.enable');await send(pageSession,'Inspector.enable');
   const frame=(await send(pageSession,'Page.getFrameTree')).frameTree.frame;
   assert(frame.id&&frame.loaderId&&!frame.parentId,'committed main frame required');boundFrame=frame.id;
   const targets=(await send(browserSession,'Target.getTargets')).targetInfos;
   assert.equal(targets.filter(t=>t.targetId===targetId&&t.type==='page').length,1,'ambiguous/missing target');
   const before=new Map();
   const initialProcesses=(await send(browserSession,'SystemInfo.getProcessInfo')).processInfo;
   assert.equal(initialProcesses.filter(p=>p.type==='browser'&&p.id===chromePid).length,1,'CDP browser/OS PID mismatch');
   for(const p of initialProcesses.filter(p=>p.type==='renderer')) {
    try{before.set(p.id,readIdentity(p.id))}catch{/* A missing candidate is never usable. */}
   }
   const generation=epoch;
   const complete=new Promise(resolve=>traceComplete=resolve);
   listen(pageSession,'Tracing.tracingComplete',v=>{if(traceComplete)traceComplete(v);else if(v.stream)pageSession.send('IO.close',{handle:v.stream}).catch(()=>{});});
   const start=pageSession.send('Tracing.start',{transferMode:'ReturnAsStream',streamFormat:'json',
    traceConfig:{recordMode:'recordUntilFull',includedCategories:['disabled-by-default-devtools.timeline'],traceBufferSizeInKb:1024}}).then(result=>{
     traceOwned=true;
     if(unknown||disposed){traceOwned=false;pageSession.send('Tracing.end').catch(()=>{});}
     return result;
    });
   await bounded(start);healthy();
   await send(pageSession,'Tracing.end');traceOwned=false;
   const completion=await bounded(complete);
   assert(completion.stream&&completion.dataLossOccurred===false,'complete lossless trace stream required');traceHandle=completion.stream;
   let bytes=0;const chunks=[];
   while(true){
    const r=await send(pageSession,'IO.read',{handle:traceHandle,size:65536});
    const b=Buffer.from(r.data,r.base64Encoded?'base64':'utf8');bytes+=b.length;assert(bytes<=maxTraceBytes,'trace byte cap');chunks.push(b);
    if(r.eof)break;
   }
   await send(pageSession,'IO.close',{handle:traceHandle});traceHandle=null;
   const trace=Buffer.concat(chunks);
   if(retainTrace){const result=retainTrace(Buffer.from(trace));assert(!result||typeof result.then!=='function','retainTrace must write synchronously');}
   const events=JSON.parse(trace.toString('utf8')).traceEvents;
   assert(Array.isArray(events),'trace events required');
   const rows=events.filter(e=>e.name==='TracingStartedInBrowser').flatMap(e=>(e.args?.data?.frames||[]).map(f=>({event:e.name,ts:e.ts,...f}))).filter(f=>f.frame===frame.id);
   assert.equal(rows.length,1,'one exact initial frame mapping required');
   const row=rows[0];assert(row.isOutermostMainFrame!==false&&row.isInPrimaryMainFrame!==false,'non-primary trace frame');
   assert(!row.parent&&row.url===frame.url.split('#')[0],'stale/non-main trace frame');
   assert(Number.isSafeInteger(row.processId)&&row.processId>0,'OS renderer PID required');
   // A commit/process-ready/deletion in this trace invalidates even if the
   // frame token or the numerical PID is later reused.
   assert(!events.some(e=>['FrameCommittedInBrowser','FrameDeletedInBrowser','ProcessReadyInBrowser'].includes(e.name)&&e.args?.data?.frame===frame.id),'frame changed during trace');
   const renderer=readIdentity(row.processId);completeIdentity(renderer);assert(before.has(row.processId),'renderer absent before trace');same(before.get(row.processId),renderer);
   assert(hasArgument(renderer,'--type=renderer'),'OS process is not a renderer');
   assert.equal(renderer.bootId,chrome.bootId);assert.deepEqual(renderer.namespaces,chrome.namespaces);assert.equal(renderer.exe,chrome.exe);
   const afterProcesses=(await send(browserSession,'SystemInfo.getProcessInfo')).processInfo;
   assert.equal(afterProcesses.filter(p=>p.type==='browser'&&p.id===chromePid).length,1,'CDP browser changed');
   assert.equal(afterProcesses.filter(p=>p.id===row.processId&&p.type==='renderer').length,1,'renderer missing after trace');
   const afterFrame=(await send(pageSession,'Page.getFrameTree')).frameTree.frame;
   assert.deepEqual(afterFrame,frame,'frame/loader changed during collection');
   assert.deepEqual((await send(pageSession,'Target.getTargetInfo')).targetInfo,info,'target changed during collection');
   assert.equal(epoch,generation,'target/frame invalidated during collection');healthy();same(readIdentity(chromePid),chrome);same(readIdentity(renderer.pid),renderer);
   const candidate={version:1,targetId,sessionId:pageSession.id(),frame,renderer,chrome,began,qualifiedAt:Date.now(),deadline,
    trace:{bytes,sha256:crypto.createHash('sha256').update(trace).digest('hex'),completion,mapping:row},scope:'exact main page frame only; no Worker/subframe identity or historical cause claim'};
   record('qualified',candidate);healthy();proof=clone(candidate);return check();
  }catch(e){throw fail(e.message)}finally{
   clearTimeout(timer);collecting=false;traceComplete=null;
   // Do not leave our bounded qualification tracing across ordinary gameplay.
   if(traceOwned){traceOwned=false;pageSession.send('Tracing.end').catch(()=>{});}
   if(traceHandle){const handle=traceHandle;traceHandle=null;pageSession.send('IO.close',{handle}).catch(()=>{});}
  }
 }
 // Synchronous start identity validation at each guarded use. Navigation and
 // target/session lifetime events invalidate proactively between commands.
 function dispose(){if(disposed)return;disposed=true;clearTimeout(cap);for(const off of listeners)off();}
 return {qualify,check,dispose,snapshot:()=>clone({proof,unknown:unknown?.message||null,terminalProof,crashEvents})};
}
// Join only an independent kernel terminal wait, never a later /proc absence.
// A custodian supplies the pre-consumption identity and actual waitpid status.
function attributeTerminal(snapshot,diagnostic) {
 const p=snapshot.terminalProof,d=diagnostic;
 assert(p,'no valid identity at first crash');
 const target=snapshot.crashEvents.find(e=>e.name==='Target.targetCrashed'&&e.value.targetId===p.targetId);
 const inspector=snapshot.crashEvents.find(e=>e.name==='Inspector.targetCrashed');
 assert(target&&inspector,'actual exact Target and scoped Inspector crash events required');
 assert(p.qualifiedAt<=target.at&&p.qualifiedAt<=inspector.at,'identity was not pre-fault');
 assert.equal(d.source,'kernel-waitpid');assert.equal(d.pid,p.renderer.pid);assert.equal(d.startTicks,p.renderer.startTicks);
 assert.equal(d.bootId,p.renderer.bootId);assert(Number.isSafeInteger(d.observerPid)&&d.observerPid>0&&d.observerPid!==d.pid&&d.observerPid!==p.chrome.pid,'independent OS observer required');
 assert(d.beforeWaitAt>=p.qualifiedAt&&d.waitAt>=d.beforeWaitAt,'invalid terminal wait chronology');
 assert(Number.isInteger(d.status)&&d.status>=0&&d.status<=65535,'actual terminal status required');
 const signal=d.status&127,exitCode=(d.status>>8)&255;
 assert(signal>0&&signal<=64&&(d.status>>8)===0||signal===0&&(d.status&255)===0,'nonterminal wait status');
 return {identity:clone(p),target:clone(target),inspector:clone(inspector),os:clone(d),
  termination:signal?{signal,coreDumped:!!(d.status&128)}:{exitCode},
  scope:'independent terminal status for this qualified page lifetime only; no causal diagnosis'};
}
module.exports={createRendererIdentity,attributeTerminal};
