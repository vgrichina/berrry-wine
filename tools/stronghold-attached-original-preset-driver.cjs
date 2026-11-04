'use strict';
// A fresh successor only. Never resumes the closed 20261104 original attempt.
const fs=require('node:fs'),path=require('node:path');
const attachment=require('./stronghold-preset-driver-attachment.cjs');

// A target paused for debugger startup need not yet have an executable realm.
// Stop its FIRST script before executing any source, then evaluate in that
// script's actual context. No guest grant, input, Module substitution or guessed
// context is introduced. The caller's existing browser deadline is authoritative.
async function installBeforeFirstScript(session,{event,expression,deadline,log=()=>{},now=Date.now}){
 if(event.waitingForDebugger!==true||event.targetInfo.type!=='worker'||
   new URL(event.targetInfo.url).pathname!=='/lib/guest-worker.js')throw Error('exact paused owning Worker required');
 if(!Number.isFinite(deadline)||deadline<=now())throw Error('original live deadline required');
 const identity={targetId:event.targetInfo.targetId,sessionId:event.sessionId,workerURL:event.targetInfo.url};
 const scripts=new Map();let timer,resolvePause,rejectPause,breakpoint;
 const paused=new Promise((resolve,reject)=>{resolvePause=resolve;rejectPause=reject;});
 // Attach rejection handling before any asynchronous CDP operation can fail.
 paused.catch(()=>{});
 const onScript=e=>scripts.set(e.scriptId,e);
 const onPause=e=>resolvePause(e);
 const onDisconnect=()=>rejectPause(Error('owning Worker disconnected before preload'));
 session.on('Debugger.scriptParsed',onScript);session.on('Debugger.paused',onPause);session.on('Disconnected',onDisconnect);
 timer=setTimeout(()=>rejectPause(Error('original bootstrap deadline')),Math.max(0,deadline-now()));
 try{
  await session.send('Runtime.enable');await session.send('Debugger.enable');
  const bp=await session.send('Debugger.setInstrumentationBreakpoint',{instrumentation:'beforeScriptExecution'});
  if(!bp.breakpointId)throw Error('pre-script breakpoint missing');breakpoint=bp.breakpointId;
  log('worker-bootstrap.jsonl',{...identity,phase:'breakpoint-before-startup-resume'});
  await session.send('Runtime.runIfWaitingForDebugger');
  const stop=await paused,frame=stop.callFrames?.[0],script=scripts.get(frame?.location?.scriptId);
  if(now()>=deadline||stop.reason!=='instrumentation'||!script||script.url!==identity.workerURL||
    !Number.isInteger(script.executionContextId)||script.executionContextId<=0)
   throw Error('exact first-script/context prerequisite missing');
  const result=await session.send('Runtime.evaluate',{expression,contextId:script.executionContextId});
  if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));
  log('worker-bootstrap.jsonl',{...identity,phase:'preload-before-first-script',scriptId:script.scriptId,contextId:script.executionContextId});
  await session.send('Debugger.removeBreakpoint',{breakpointId:breakpoint});breakpoint=null;
  await session.send('Debugger.resume');
  return {scriptId:script.scriptId,contextId:script.executionContextId,result};
 }catch(error){
  log('worker-bootstrap.jsonl',{...identity,phase:'failed-no-script-resume',error:String(error)});
  throw error;
 }finally{
  clearTimeout(timer);session.off('Debugger.scriptParsed',onScript);session.off('Debugger.paused',onPause);session.off('Disconnected',onDisconnect);
  // On failure the original browser cleanup owns the paused target. Do not
  // resume an uninstrumented script merely to remove a diagnostic breakpoint.
 }
}

// Observe-browser records the constructor argument, which may be relative.
// CDP records the resolved URL. Resolve against the actual owning page, keeping
// origin, path and query exact; retain every event so ambiguity still rejects.
function createAttachment(options){
 const pageState=options.pageState;
 return attachment.createAttachment({...options,pageState:async()=>{
  const state=await pageState(),main=state.main;
  const events=main?.observation?.events;
  if(!Array.isArray(events))return state;
  const normalized=events.map(event=>{
   if(event.kind!=='sent-module')return event;
   if(typeof event.workerURL!=='string'||!event.workerURL)throw Error('sent Module Worker URL missing');
   const base=new URL(main.href);
   if(!['http:','https:'].includes(base.protocol))throw Error('owning page HTTP URL required');
   const workerURL=new URL(event.workerURL,base).href;
   options.log?.('module-url-bindings.jsonl',{pageURL:base.href,rawWorkerURL:event.workerURL,workerURL});
   return {...event,workerURL};
  });
  return {...state,main:{...main,observation:{...main.observation,events:normalized}}};
 }});
}

function prepare(options){
 const p=attachment.prepare(options),q=JSON.stringify;
 p.source=attachment.replaceOnce(p.source,'const presetAttachment=attachmentAPI.createAttachment(',`const presetAttachment=require(${q(__filename)}).createAttachment(`);
 const before="      await session.send('Runtime.enable');\n      if(event.waitingForDebugger!==true)throw Error('late Worker preload: not paused at attach');";
 p.source=attachment.replaceOnce(p.source,before,"      if(event.waitingForDebugger!==true)throw Error('late Worker preload: not paused at attach');");
 p.source=attachment.replaceOnce(p.source,"const result=await session.send('Runtime.evaluate',{expression});",
  `const bootstrap=await require(${q(__filename)}).installBeforeFirstScript(session,{event,expression,deadline,log});const result=bootstrap.result;`);
 p.source=attachment.replaceOnce(p.source,"      await session.send('Runtime.runIfWaitingForDebugger');\n    })().catch(e=>{halted=true;log('first-failures.jsonl',{phase:'worker preload',error:String(e)});}));",
  "    })().catch(e=>{halted=true;log('first-failures.jsonl',{phase:'worker preload',error:String(e)});void boundary.close(()=>close('first concrete Worker preload failure'));}));");
 p.evidence.successor={path:__filename,sha256:attachment.hash(fs.readFileSync(__filename)),sourceSHA256:attachment.hash(p.source),routeCompositionUnchanged:true,
  scope:'Offline pre-first-script bootstrap handshake; original failed run is closed; fresh Chrome qualification required'};
 return p;
}
module.exports={installBeforeFirstScript,createAttachment,prepare};
if(require.main===module){
 try{
  const args=process.argv.slice(2),value=n=>args[args.indexOf(n)+1];
  if(!args.includes('--run')||!args.includes('--pins')||args.some(a=>a.startsWith('--')&&!['--run','--pins','--check'].includes(a)))throw Error('usage: --run ABS_FRESH_RUN --pins ABS_PINS [--check]');
  const p=prepare({run:value('--run'),pins:value('--pins')});fs.mkdirSync(value('--run'),{recursive:true});fs.writeFileSync(path.join(value('--run'),'attached-original-composition.json'),JSON.stringify(p.evidence,null,2)+'\n');
  if(args.includes('--check'))console.log(JSON.stringify(p.evidence,null,2));else attachment.compileClosure(p.source,p.driver,p.route,p.evidence.retainedClosure);
 }catch(error){console.error(error.stack||String(error));process.exitCode=1;}
}
