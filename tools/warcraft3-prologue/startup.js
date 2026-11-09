'use strict';
const fs=require('node:fs');
const {performance}=require('node:perf_hooks');

// One observer is installed at spawn, before either readiness or cleanup can
// consume an event. Exit, ChildProcess close and each pipe EOF are distinct.
function observe(browser,{deadline,record=()=>{}}){
 if(!Number.isFinite(deadline)||deadline<=Date.now())throw Error('invalid immutable run deadline');
 const wall=Date.now(),mono=performance.now(),now=()=>Math.max(Date.now(),wall+performance.now()-mono);
 const state={terminal:null,closed:false,stdoutEOF:false,stderrEOF:false,error:null,unknown:null};
 const emit=(kind,extra={})=>record({kind,at:Date.now(),...extra});
 browser.once('error',e=>{state.error=String(e);unknown(state.error);emit('spawn-error',{error:state.error})});
 browser.once('exit',(code,signal)=>{state.terminal={code,signal};if(!cancelled)unknown('Chrome exited before readiness');emit('exit',state.terminal)});
 browser.once('close',(code,signal)=>{state.closed=true;emit('child-close',{code,signal})});
 for(const name of ['stdout','stderr']){
  if(!browser[name])throw Error('separate Chrome pipes required');
  browser[name].once('end',()=>{state[name+'EOF']=true;emit(name+'-eof')});
 }
 const sleep=async end=>{await new Promise(r=>setTimeout(r,Math.max(1,Math.min(25,end-now()))))};
 const drained=()=>state.closed&&state.terminal&&state.stdoutEOF&&state.stderrEOF;
 let cancelled=false,closePromise;
 function unknown(reason){if(!state.unknown){state.unknown=String(reason);emit('startup-unknown',{reason:state.unknown})}return Error(state.unknown+'; UNKNOWN; no replay')}
 function check(){if(state.unknown)throw unknown(state.unknown);if(cancelled)throw unknown('startup cancelled');if(state.error)throw unknown(state.error);if(state.terminal||browser.exitCode!==null||browser.signalCode!==null)throw unknown('Chrome exited before readiness');if(now()>=deadline)throw unknown('immutable run deadline')}
 async function ready(file,{startupMs=60000,reserveMs=20000}={}){
  const end=Math.min(deadline-reserveMs,now()+startupMs);emit('startup-begin',{deadline,end});
  while(now()<end){
   check();let value;
   try{value=fs.readFileSync(file,'utf8')}catch(e){if(e.code!=='ENOENT')throw e}
   if(value){const m=/^(\d+)\n(\/devtools\/browser\/[A-Za-z0-9-]+)\n?$/.exec(value);
    if(m&&Number(m[1])>0&&Number(m[1])<65536){check();if(now()>=end)break;const endpoint={debugPort:Number(m[1]),browserPath:m[2]};emit('startup-ready',endpoint);return endpoint;}}
   await sleep(end);
  }
  check();throw unknown('DevTools startup deadline; no endpoint');
 }
 function cancel(reason='startup cancelled'){cancelled=true;unknown(reason);emit('cancel',{reason:state.unknown})}
 function close(requestClose){return closePromise??=(async()=>{
  const wasCancelled=cancelled;cancelled=true;const began=now(),end=Math.min(deadline,began+18000),scale=Math.max(0,(end-began)/18000),signals=[];let request='not-requested';
  if(!state.terminal){request='pending';Promise.resolve().then(requestClose).then(()=>{request='ACK';emit('close-ack')},e=>{request='UNKNOWN';emit('close-unknown',{error:String(e)})})}
  for(const [index,signal] of ['SIGTERM','SIGKILL',null].entries()){
   const due=Math.min(end,began+[14000,16000,18000][index]*scale);while(!drained()&&now()<due)await sleep(due);
   if(drained())break;
   if(signal&&!state.terminal){const sent=browser.kill(signal);signals.push({signal,sent});emit('signal',{signal,sent})}
  }
  const receipt={...state,drained:!!drained(),request,signals,deadline,elapsedMs:now()-began,
   cancelled:wasCancelled,normal:!wasCancelled&&!state.unknown&&!!drained()&&state.terminal.code===0&&state.terminal.signal===null&&signals.length===0&&request==='ACK'};
  emit('terminal-result',receipt);return receipt;
 })()}
 return{ready,close,cancel,check,state};
}

function adapt(source,{root}){
 const replace=(a,b)=>{if(source.split(a).length!==2)throw Error('unique startup composition anchor '+a.slice(0,90));source=source.replace(a,b)};
 replace('let browser,server,ws,pageSession,chain,closing=false,latest=null,timer,guard,guardTimer;', 'let browser,server,ws,pageSession,chain,closing=false,latest=null,timer,guard,guardTimer,custody,closeReason;');
 replace("{stdio:['ignore',fs.openSync(out+'/chrome.stdout','w'),fs.openSync(out+'/chrome.stderr','w')]}","{stdio:['ignore','pipe','pipe']}");
 replace(" browser=cp.spawn('/usr/bin/google-chrome'", " check();assert(Date.now()<deadline-20000,'Chrome launch cannot fit immutable cleanup reserve');browser=cp.spawn('/usr/bin/google-chrome'");
 replace(" browser.once('exit',(code,signal)=>save('chrome-exit.json'",` custody=require(${JSON.stringify(root+'/tools/warcraft3-prologue/startup.js')}).observe(browser,{deadline,record:r=>log('browser-lifecycle.jsonl',r)});
 for(const name of ['stdout','stderr'])browser[name].on('data',b=>fs.appendFileSync(out+'/chrome.'+name,b));
 browser.once('exit',(code,signal)=>{if(!closing)close('unexpected Chrome exit UNKNOWN').catch(e=>console.error(e))});
 browser.once('exit',(code,signal)=>save('chrome-exit.json'`);
 replace(" const active=out+'/chrome-profile/DevToolsActivePort';for(let i=0;i<100&&!fs.existsSync(active);i++)await wait(100);const [debugPort,debugPath]=fs.readFileSync(active,'utf8').trim().split('\\n');save('endpoint.json',{debugPort:Number(debugPort),browserPath:debugPath});", " const {debugPort,browserPath:debugPath}=await custody.ready(out+'/chrome-profile/DevToolsActivePort');check();save('endpoint.json',{debugPort,browserPath:debugPath});");
 replace("deadline-Date.now());", "Math.max(1,deadline-Date.now()-20000));");
 replace("function check(){if(closing)throw Error('runtime closing');if(guard)guard.check();}","function check(){if(closing)throw Error(closeReason+'; UNKNOWN; no replay');custody?.check();if(guard)guard.check();}");
 replace(" if(method.startsWith('Input.')&&!method.endsWith('Released')&&params.type!=='keyUp'&&params.type!=='mouseReleased')check();", " const cleanup=method==='Browser.close'||(method==='Input.dispatchKeyEvent'&&params.type==='keyUp')||(method==='Input.dispatchMouseEvent'&&params.type==='mouseReleased');if(!cleanup)check();");
 // A command dispatched while live can settle after close has started. Check
 // its continuation as well; only independent release/close may cross it.
 replace(" return trace.span('cdp.request',()=>new Promise", " const result=await trace.span('cdp.request',()=>new Promise");
 replace("}),meta);\n });}", "}),meta);\n if(!cleanup)check();return result;\n });}");
 replace("pending.set(n,{resolve,reject,timer,meta})", "pending.set(n,{resolve,reject,timer,meta,cleanup})");
 // The check at dispatch cannot protect a publication after a later await.
 replace("save=(n,v)=>t.publish(out+'/'+n,v)", "save=(n,v)=>{if(['browser-version.json','launch.json','guest-worker-ready.json','renderer-readiness.json','renderer-qualified.json','generated-qualification.json','qualification.json','ready.json','fixture-startup.json'].includes(n))check();return t.publish(out+'/'+n,v)}");
 const start=source.indexOf('async function close(reason){'),end=source.indexOf('\nasync function executeImpl(',start);
 if(start<0||end<0)throw Error('missing actual close composition');
 source=source.slice(0,start)+`let closePromise;
 function close(reason){return closePromise??=(async()=>{
 closing=true;reason=custody?.state.unknown||reason;closeReason=reason;clearTimeout(timer);clearInterval(floorTimer);clearInterval(passive);clearInterval(processSamples);clearInterval(guardTimer);
 save('close-reason.json',{at:new Date().toISOString(),reason});
 const interrupted=[...pending.values()].some(p=>!p.cleanup);
 if(interrupted||!['ordinary completion','startup terminal fixture complete','production startup fixture complete','preflight final app-selection boundary','WebGL owner qualification complete'].includes(reason)){custody?.cancel(reason);process.exitCode=1;save('transport-closed.json',{error:reason+'; UNKNOWN; no replay',sticky:true})}
 for(const [id,p] of pending){if(p.cleanup)continue;clearTimeout(p.timer);p.reject(Error(reason+'; UNKNOWN; no replay'));pending.delete(id)}
 let receipt;try{
  if(custody){receipt=await custody.close(()=>{if(ws?.readyState!==1)throw Error('CDP unavailable; no replay');return send('Browser.close')});save('browser-terminal.json',receipt);if(!receipt.normal)process.exitCode=1;}
 }finally{
  for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('runtime closed; UNKNOWN; no replay'))}pending.clear();
  if(guard){save('renderer-identity-summary.json',guard.snapshot());guard.dispose()}
  ws?.close();let cleanupTimer;
  try{await Promise.race([(async()=>{if(server){server.closeAllConnections();await new Promise(r=>server.close(r))}await recorder.close()})(),new Promise((_,reject)=>{cleanupTimer=setTimeout(()=>reject(Error('resource close deadline; UNKNOWN')),Math.max(1,Math.min(1000,deadline-Date.now())))})])}
  finally{clearTimeout(cleanupTimer)}
 }
 if(browser&&!receipt?.drained){save('browser-drain-unknown.json',{receipt,noReplay:true});process.exitCode=1;
  // Stop holding the command alive through inherited pipe writers. This is
  // abandonment with UNKNOWN EOF, never a drain claim. Kernel custody still
  // owns every descendant and must retain its actual terminal waits.
  for(const stream of [browser.stdout,browser.stderr])stream?.destroy();browser.unref();
  throw Error('Chrome terminal/EOF UNKNOWN; no replay')}
 if(receipt?.drained)fs.rmSync(out+'/chrome-profile',{recursive:true,force:true});
 if(receipt&&!receipt.normal&&!fs.existsSync(out+'/transport-closed.json'))save('transport-closed.json',{error:(receipt.unknown||'abnormal Chrome termination')+'; UNKNOWN; no replay',receipt,sticky:true});
 t.closed(out,browser?.exitCode);console.log('TERMINAL '+reason);return receipt;
 })()}
 process.once('SIGTERM',()=>{custody?.cancel('explicit cancellation');process.exitCode=1;close('explicit cancellation').catch(e=>console.error(e))});
 process.once('SIGINT',()=>{custody?.cancel('explicit cancellation');process.exitCode=1;close('explicit cancellation').catch(e=>console.error(e))});
 `+source.slice(end);
 replace("if(c.action==='quit'){await close('ordinary completion');return;}", "if(c.action==='quit'){check();const terminal=await close('ordinary completion');assert(terminal?.normal,'quit terminal abnormal; UNKNOWN; no replay');return;}");
 replace("ws=new WebSocket('ws://127.0.0.1:'+debugPort+debugPath);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});", "ws=new WebSocket('ws://127.0.0.1:'+debugPort+debugPath);const connected=new Promise((r,j)=>{const timeout=setTimeout(()=>{j(Error('endpoint connection deadline; no replay'));},Math.max(1,Math.min(10000,deadline-Date.now()-20000)));ws.onopen=()=>{clearTimeout(timeout);try{check();r()}catch(e){ws.close();j(e)}};ws.onerror=e=>{clearTimeout(timeout);j(e)};});");
 replace("\n save('browser-version.json',await send('Browser.getVersion'));", "\n await connected;check();\n save('browser-version.json',await send('Browser.getVersion'));");
 return source;
}
module.exports={observe,adapt};
