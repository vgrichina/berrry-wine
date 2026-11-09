'use strict';
// Exact retained consumer path. Small explicit transformations for compressed
// logging and terminal stdio closure; no guest/input/budget changes.
const fs=require('node:fs'),path=require('node:path'),z=require('node:zlib'),Module=require('node:module');
const root=process.cwd(),own=__dirname,consumer=path.join(root,'scratch/runs/20261108-q3-gl-readiness-gameplay/browser-run.cjs');
const out=path.join(path.dirname(consumer),'instrumented');
const append=fs.appendFileSync;
fs.appendFileSync=function(file,data,...rest){if(typeof file==='string'&&file.endsWith('.jsonl'))return append.call(this,file+'.gz',z.gzipSync(data));return append.call(this,file,data,...rest);};
const original=Module._extensions['.cjs']||Module._extensions['.js'];
Module._extensions['.cjs']=function(module,filename){
 if(filename===path.join(path.dirname(consumer),'bound-input.cjs')){
  let s=fs.readFileSync(filename,'utf8');
  const a="const attempted=[], samples=[]; let error;";
  const b="const attempted=[], samples=[]; let error;const telemetry={};const persist=()=>require('node:fs').appendFileSync("+JSON.stringify(own+'/physical-completion.jsonl')+",JSON.stringify(telemetry)+'\\n');";
  if(s.split(a).length!==2)throw Error('hold telemetry anchor');s=s.replace(a,b);
  s=s.replace("},holdMs);\n    for(const key", "},holdMs);telemetry.armedAt=Date.now();telemetry.dueAt=started+holdMs;telemetry.state='ARMED';persist();\n    for(const key");
  s=s.replace("await send('Input.dispatchKeyEvent',{type:'keyDown',...base},session);", "await send('Input.dispatchKeyEvent',{type:'keyDown',...base},session);telemetry.downCompletedAt=Date.now();persist();");
  s=s.replace("await send('Input.dispatchKeyEvent',{type:'keyUp',...base},session);", "telemetry.upAttemptedAt=Date.now();persist();await send('Input.dispatchKeyEvent',{type:'keyUp',...base},session);telemetry.upCompletedAt=Date.now();telemetry.state='ACTUAL_UP_COMPLETED';persist();");
  s=s.replace("finally {clearTimeout(timer);await release();}","finally {clearTimeout(timer);await release();telemetry.completionPromiseSettledAt=Date.now();persist();}if(!error){assert(telemetry.armedAt&&telemetry.upCompletedAt&&telemetry.completionPromiseSettledAt>=telemetry.upCompletedAt,'actual physical UP completion required');}");
  return module._compile(s,filename);
 }
 if(filename!==consumer)return original(module,filename);
 let s=fs.readFileSync(filename,'utf8');
 const replace=(a,b)=>{if(s.split(a).length!==2)throw Error('nonunique consumer anchor '+a.slice(0,70));s=s.replace(a,b);};
 replace("const start=Date.now()", "const commandLogs=require(root+'/tools/native-command-log.cjs').createLogs(out);const start=Date.now()");
 replace("stdio:['ignore',fs.openSync(out+'/chrome.stdout','w'),fs.openSync(out+'/chrome.stderr','w')]", "stdio:['ignore','pipe','pipe']");
 replace("browser.once('exit',(code,signal)=>", "commandLogs.attach('chrome.stdout',browser.stdout);commandLogs.attach('chrome.stderr',browser.stderr);browser.once('exit',(code,signal)=>");
 const begin="try{if(ws?.readyState===1)await send('Browser.close');}";
 const end="\n for(const p of pending.values())";
 const a=s.indexOf(begin),b=s.indexOf(end,a);if(a<0||b<0)throw Error('close anchor missing');
 s=s.slice(0,a)+"if(browser){const receipt=await require(root+'/tools/native-browser-close.cjs').closeBrowser({browser,requestClose:()=>ws?.readyState===1?send('Browser.close'):Promise.reject(Error('endpoint unavailable')),record:v=>log('terminal-browser.jsonl',v)});save('terminal-browser.json',receipt);await commandLogs.drainStreams();commandLogs.close();}"+s.slice(b);
 // Identical module bytes already pinned at build path: retain identity only.
 replace("if(!fs.existsSync(file))fs.writeFileSync(file,b,{flag:'wx'});", "save('module-reference-'+row.sha256+'.json',{path:pins.files.find(p=>p.sha256===row.sha256)?.path??'UNKNOWN',sha256:row.sha256,size:b.length});");
 // Arm before GLRenderHost assignment completes, thus before host-imports.
 const marker="globalThis.__q3InputEvents=[];";
 const arm="Object.defineProperty(globalThis,'GLRenderHost',{configurable:true,get(){return this.__q3GLHost},set(value){value.configureDiagnostics({enabled:true,maxRecords:64});this.__q3GLHost=value;console.debug('Q3_DIAGNOSTICS_ARMED',JSON.stringify({at:performance.now(),beforeHostImports:typeof createHostImports==='undefined'}));}});";
 replace(marker,arm+marker);
 // Existing page-owner boundaries export synchronous partials. Never add an
 // RPC or join a pending render request. Node deadline retains last delivery.
 replace("const page=await evaluate(`", "const page=await evaluate(`");
 const oldSend="ws.send(JSON.stringify({id:n,method,params,...(sessionId?{sessionId}:{})}));";
 replace(oldSend,"if(method==='Runtime.evaluate'&&params.expression?.includes('__mcmPassiveIdentityV1')){const expression=params.expression;params={...params,expression:'(()=>{const value=('+expression+');try{console.debug(\"Q3_GL_PARTIAL\",JSON.stringify(GLRenderHost.diagnosticSnapshot()));}catch(error){console.debug(\"Q3_GL_UNAVAILABLE\",String(error));}return value;})()'};}"+oldSend);
 fs.writeFileSync(own+'/consumer-transform.patch.txt.gz',z.gzipSync(JSON.stringify({originalSha256:require('node:crypto').createHash('sha256').update(fs.readFileSync(filename)).digest('hex'),transformedSha256:require('node:crypto').createHash('sha256').update(s).digest('hex'),changes:'gzip logs, pipe stdout/stderr, accepted actual close/drain, no duplicate module copy, configure before host imports, synchronous partial at existing PAGE_READ'})));
 return module._compile(s,filename);
};
