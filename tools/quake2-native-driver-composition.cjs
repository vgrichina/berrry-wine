'use strict';
// Explicit preload of the actual 0105 consumer; retained evidence is immutable.
// node --require ./tools/quake2-native-driver-composition.cjs RETAINED_BROWSER
// QUAKE2_NATIVE_RUN must name fresh staged inputs (pins/lifecycle); output is
// QUAKE2_NATIVE_RUN/original. No original is started by importing this module.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),Module=require('node:module'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const consumerPath='scratch/runs/20261109-quake2-observed-guard-route-0105/browser-run.cjs';
// Tested bounded retirement provider, committed as c443739b5. Refuse drift
// before compiling or starting either the native fixture or original consumer.
const custodySha256='05b7fe42cf7ac09df5f12f0ea073ea066892efb598b64b05fae19a3492c9f32c';
// d90eb457c: exact numbered owning quit, joined launch wait and both EOFs.
const orderlyCallers=Object.freeze({
 'tools/quake2-native-launch-client.py':'cd8b886512553a67a5fcc66dfc09e7932e5cde2e771f24daf3fcde64b920c338',
 'tools/q3-native-launch-client.py':'d3b9927b17372e74ef0abc8f43b59e709b1822d4927d7793c0153b07cda6509d'
});
const providers=Object.freeze({
  "scratch/runs/20261109-quake2-observed-guard-route-0105/browser-run.cjs": "2016ceaf3373097e3068d19b17977c68603b021805b4590202bdf3e6ffa0afbb",
  "scratch/runs/20261109-quake2-observed-guard-route-0105/control.py": "6d9a2ba481bd4092494c2cec4d9a011d3aaedc43e5d137a803c536f336fcfe1f",
  "scratch/runs/20261109-quake2-observed-guard-route-0105/launch.py": "bd26316f0eb8a9194abba6c4d441097a3d2179caa14193355c0b9bb6875e2648",
  "scratch/runs/20261109-quake2-observed-guard-route-0105/run-command.py": "a1a0caa4c1a79277dc3c3cc650e6cf98f19d6051d6d4f3f996e0dd991ee8bf61",
  "scratch/runs/20261109-quake2-observed-guard-route-0105/bound-input.cjs": "2bf0539b0d613d67bf4f166a9068d7a8139bcb423376faac4cfe695138fd536b",
  "scratch/runs/20261109-quake2-observed-guard-route-0105/ordinary-keys.cjs": "2e1e76ed32108ebb15b55ab9f7a994878522195cabebdaebdb191435f14d48a7",
  "scratch/runs/20261109-quake2-observed-guard-route-0105/transport.cjs": "7a72ba3a63582ddcb8887dc44993cba5ebab14ed05c7d1330e329929fbbd911d",
  "scratch/runs/20261109-quake2-observed-guard-route-0105/ack-client.cjs": "9c3a8a215d9f88f592a8960598801bb04dd7982a1a5d6af714aea891b9bafca6",
  "scratch/runs/20261109-quake2-observed-guard-route-0105/native-mouse.cjs": "8a4a51ba40b6caaf81bf155c9ee9791aa8527af221b36899bd806dfee77a8844",
  "scratch/runs/20261109-quake2-observed-guard-route-0105/keyboard-bridge.cjs": "b17df90ee4fa4fca0ba30ed576e69a7af9879c172cfe48ed093245272c25ed0f"
});
function replaceOnce(source,before,after){assert.equal(source.split(before).length,2,'missing/nonunique Q2 integration: '+before);return source.replace(before,after);}
function compose(){
 const references=Object.entries(providers).map(([file,hash])=>{const b=fs.readFileSync(path.join(root,file));assert.equal(crypto.createHash('sha256').update(b).digest('hex'),hash,'Q2 provider changed: '+file);return {path:file,sha256:hash,size:b.length};});
 for(const file of ['tools/quake2-native-driver-composition.cjs','tools/quake2-passive-attack.cjs','lib/quake2-owning-load-core.js','tools/quake2-native-launch-client.py','tools/q3-native-launch-client.py','tools/quake2-native-input.cjs','tools/quake2-native-transport.cjs','tools/native-browser-close.cjs','tools/native-command-log.cjs','tools/native-devtools-ready.cjs','tools/native_kernel_custody.py']){
  const b=fs.readFileSync(path.join(root,file)),sha256=crypto.createHash('sha256').update(b).digest('hex');
  if(file==='tools/native_kernel_custody.py')assert.equal(sha256,custodySha256,'tested Q2 custody provider required');
  if(orderlyCallers[file])assert.equal(sha256,orderlyCallers[file],'tested Q2 orderly caller required: '+file);
  references.push({path:file,sha256,size:b.length});
 }
 const retainedSource=fs.readFileSync(path.join(root,consumerPath),'utf8');let source=retainedSource;
 source=replaceOnce(source,"const run=__dirname,root=path.resolve(run,'../../..')",`const run=path.resolve(process.env.QUAKE2_NATIVE_RUN),root=${JSON.stringify(root)}`);
 source=replaceOnce(source,"t=require('./transport.cjs')","t=require(root+'/tools/quake2-native-transport.cjs')");
 source=replaceOnce(source,'chain=bound.createChain({evaluate,send,workers,pageSession,',"chain=require(root+'/tools/quake2-passive-attack.cjs').createChain(bound,{evaluate,send,workers,pageSession,");
 source=replaceOnce(source,'for(const p of pins.files){',`for(const ref of ${JSON.stringify(references)})assert(pins.files.some(p=>p.path===ref.path&&p.sha256===ref.sha256&&p.size===ref.size),'staged production Q2 provider required: '+ref.path);for(const p of pins.files){`);
 source=replaceOnce(source,'let diskTimer;',`let terminalFailure=null;const terminalAbort=new AbortController();
function checkTerminal(){
 if(!terminalFailure&&fs.existsSync(run+'/caller-cancelled.json'))observeTerminal('caller input revoked');
 if(terminalFailure)throw terminalFailure;
}
function observeTerminal(reason,deferClose=false){
 if(terminalFailure)return terminalFailure;
 terminalFailure=Error('Q2 terminal UNKNOWN; no replay: '+reason);
 save('first-transport-failure.json',{at:new Date().toISOString(),error:String(terminalFailure),noReplay:true});
 terminalAbort.abort(terminalFailure);
 for(const p of pending.values()){clearTimeout(p.timer);p.reject(terminalFailure);}pending.clear();
 if(!closing&&!deferClose)close('first transport failure').catch(e=>{process.exitCode=1;console.error(e);});
 return terminalFailure;
}
let diskTimer;`);
 source=replaceOnce(source,'new Promise(r=>setTimeout(r,ms))',`new Promise((resolve,reject)=>{
 checkTerminal();const done=()=>{clearTimeout(timer);terminalAbort.signal.removeEventListener('abort',abort);resolve();};
 const abort=()=>{clearTimeout(timer);terminalAbort.signal.removeEventListener('abort',abort);reject(terminalFailure);};
 const timer=setTimeout(done,ms);terminalAbort.signal.addEventListener('abort',abort,{once:true});
})`);
 source=replaceOnce(source,'const n=++id;const timer=',"if(method!=='Browser.close'&&!(method==='Input.dispatchKeyEvent'&&params.type==='keyUp'))checkTerminal();const n=++id;const timer=");
 source=replaceOnce(source,"pending.delete(n);reject(Error('CDP UNKNOWN '+method+'; no replay'));","pending.delete(n);const error=Error('CDP UNKNOWN '+method+'; no replay');reject(error);if(method!=='Browser.close')observeTerminal(error);");
 source=replaceOnce(source,"ws.send(JSON.stringify({id:n,method,params,...(sessionId?{sessionId}:{})}));","try{ws.send(JSON.stringify({id:n,method,params,...(sessionId?{sessionId}:{})}));}catch(e){observeTerminal(e);reject(e);}");
 source=replaceOnce(source,'async function capture(label){','async function capture(label){checkTerminal();');
 source=replaceOnce(source,'async function execute(c,markDispatch){','async function execute(c,markDispatch){checkTerminal();');
 // The caller revocation also gates automatic setup, rather than only the
 // later numbered command loop. Independent keyUp/Browser.close still pass.
 source=replaceOnce(source,'(async()=>{\n server=', '(async()=>{\n checkTerminal();\n server=');
 source=replaceOnce(source,'const r=await fetch(', 'checkTerminal();const r=await fetch(');
 source=replaceOnce(source,"browser=cp.spawn('/usr/bin/google-chrome'", "checkTerminal();browser=cp.spawn('/usr/bin/google-chrome'");
 // Motion dependence is explicit per reviewed command, never inferred from
 // attack status or imposed on unrelated captures. Reject malformed policies.
 source=replaceOnce(source," if(c.action==='combo')",` assert(c.requireMotion===undefined||typeof c.requireMotion==='boolean','boolean motion policy');
 if(c.requireMotion)assert(['key','combo'].includes(c.action),'required held motion needs key/combo');
 if(c.action==='combo')`);
 source=replaceOnce(source,"sample:async()=>{if(c.captureHeld&&!fs.existsSync(out+'/'+c.label+'-held.png')){const shot=await send('Page.captureScreenshot',{format:'png'},pageSession);fs.writeFileSync(out+'/'+c.label+'-held.png',Buffer.from(shot.data,'base64'),{flag:'wx'});}return chain.progress(receipt.live.identity)},saveSample:s=>log('input-'+c.id+'-samples.jsonl',s)",`sample:()=>chain.progress(receipt.live.identity),
   checkSample:s=>{checkTerminal();if(c.requireMotion){try{require(root+'/tools/quake2-passive-attack.cjs').requireMotion(s);}catch(e){throw observeTerminal(e,true);}}},
   saveSample:async s=>{log('input-'+c.id+'-samples.jsonl',s);checkTerminal();if(c.captureHeld&&!fs.existsSync(out+'/'+c.label+'-held.png')){const shot=await send('Page.captureScreenshot',{format:'png'},pageSession);checkTerminal();fs.writeFileSync(out+'/'+c.label+'-held.png',Buffer.from(shot.data,'base64'),{flag:'wx'});}}`);
 source=replaceOnce(source,'const held=await bound.hold(','let held;try{held=await bound.hold(');
 source=replaceOnce(source,"  save('input-'+c.id+'-hold.json',held);","  }catch(e){if(e.holdReceipt)save('input-'+c.id+'-hold-unknown.json',e.holdReceipt);throw e;}\n  save('input-'+c.id+'-hold.json',held);\n  if(c.requireMotion&&!held.samples.length)throw observeTerminal('required playerMotion sample absent');");
 source=replaceOnce(source,"if(c.action==='quit'){await close('ordinary completion');return;}","if(c.action==='quit'){markDispatch();await close('ordinary completion',c.timing.workEnd);return;}");
 const begin=source.indexOf('let closePromise;'),end=source.indexOf('\nasync function execute(',begin);
 assert(begin>=0&&end>begin);
 source=source.slice(0,begin)+`let closePromise;
function close(reason,workEnd){return closePromise??=closeOnce(reason,workEnd);}
async function closeOnce(reason,workEnd){
 closing=true;clearTimeout(timer);clearInterval(diskTimer);save('close-reason.json',{at:new Date().toISOString(),reason});
 let receipt,failure;
 try{
  if(browser){
   // Quit's close is nested inside command work, never an extra 30 seconds.
   // Leave 100ms for the numbered ACK; independent cleanup retains its 30s cap.
   const cap=workEnd===undefined?30000:Math.min(30000,workEnd-Date.now()-100);
   assert(cap>0,'no close budget');const escalation=Math.min(5000,cap/3);
   receipt=await require(root+'/tools/native-browser-close.cjs').closeBrowser({browser,
    graceMs:cap-2*escalation,termMs:escalation,killMs:escalation,
    requestClose:()=>{assert.equal(ws?.readyState,1,'CDP disconnected; no replay');return send('Browser.close');},record:r=>log('browser-close.jsonl',r)});
   save('browser-terminal.json',receipt);save('stream-log-drain.json',await compressedLogs.drainStreams());
   if(!receipt.normal){const error=Error('abnormal browser shutdown; UNKNOWN; no replay');error.receipt=receipt;throw error;}
  }
 }catch(e){failure=e;process.exitCode=1;save('browser-drain-unknown.json',{error:String(e),receipt:e.receipt??null,noReplay:true});observeTerminal(e);}
 finally{
  for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('runtime closed; UNKNOWN; no replay'));}pending.clear();
  await new Promise(r=>setImmediate(r));ws?.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}
 }
 if(failure)throw failure;
 fs.rmSync(out+'/chrome-profile',{recursive:true,force:true});t.closed(out,browser?.exitCode);console.log('TERMINAL '+reason);
 return receipt;
}`+source.slice(end);
 source=replaceOnce(source,"browser.once('exit',(code,signal)=>save('chrome-exit.json'","browser.once('error',e=>observeTerminal(e));browser.once('exit',(code,signal)=>{if(!closing)observeTerminal('browser exit '+code+'/'+signal);});for(const stream of [browser.stdout,browser.stderr])stream.once('end',()=>{if(!closing)observeTerminal('browser stdio EOF');});browser.once('exit',(code,signal)=>save('chrome-exit.json'");
 source=replaceOnce(source,"ws=new WebSocket('ws://127.0.0.1:'+debugPort+debugPath);","ws=new WebSocket('ws://127.0.0.1:'+debugPort+debugPath);for(const event of ['close','error'])ws.addEventListener(event,()=>{if(!closing)observeTerminal('CDP '+event);});");
 source=replaceOnce(source,"})().catch(async e=>{save('first-browser-failure.json'","})().catch(async e=>{observeTerminal(e);save('first-browser-failure.json'");
 // Compile now; startup DLL gate and both strict flags are left byte-for-byte.
 new vm.Script(Module.wrap(source),{filename:path.join(root,consumerPath)});
 return {source,retainedSource,references};
}
function install(){
 assert.equal(path.resolve(process.argv[1]||''),path.join(root,consumerPath),'actual retained Q2 consumer required');
 assert(process.env.QUAKE2_NATIVE_RUN,'fresh staged Q2 run required');
 const run=path.resolve(process.env.QUAKE2_NATIVE_RUN);
 assert.notEqual(run,path.dirname(path.join(root,consumerPath)),'retained evidence is read-only');
 const result=compose(),original=Module._extensions['.cjs']||Module._extensions['.js'];
 Module._extensions['.cjs']=function(module,filename){
  if(filename===path.join(root,consumerPath))return module._compile(result.source,filename);
  if(filename===path.join(root,path.dirname(consumerPath),'ordinary-keys.cjs')){
   const input=require('./quake2-native-input.cjs');module.exports={...input,hold:(send,session,key,ms)=>input.hold({send,session,keys:[key],holdMs:ms})};return;
  }
  if(filename===path.join(root,path.dirname(consumerPath),'bound-input.cjs'))return module._compile(fs.readFileSync(filename,'utf8')+"\nmodule.exports.hold=require("+JSON.stringify(path.join(root,'tools/quake2-native-input.cjs'))+").hold;",filename);
  return original(module,filename);
 };
 return result.references;
}
module.exports={compose,install,replaceOnce,consumerPath,providers};
if(require.main!==module&&process.env.QUAKE2_NATIVE_COMPOSITION==='1')install();
