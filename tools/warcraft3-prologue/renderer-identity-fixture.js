'use strict';
// Small real Chrome control; never loads Warcraft, WASM, media or guest runtime.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {createRendererIdentity,attributeTerminal}=require('./renderer-identity'),{createLifecycle}=require('./lifecycle');
const {identity}=require(fs.existsSync(__dirname+'/native-clock-process-proof.cjs')?'./native-clock-process-proof.cjs':'../native-clock-process-proof.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const out=path.resolve(process.argv[2]||'');assert(process.argv[2],'unique output required');
const save=(n,v)=>fs.writeFileSync(path.join(out,n),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
function append(n,v){const fd=fs.openSync(path.join(out,n),'a');try{fs.writeSync(fd,JSON.stringify(v)+'\n');fs.fsyncSync(fd)}finally{fs.closeSync(fd)}}
// Post-run joining is the production helper's validator, not a copied predicate.
if(process.argv[3]==='--join'){
 const drain=JSON.parse(fs.readFileSync(out+'/kernel-drain.json')),snapshot=JSON.parse(fs.readFileSync(out+'/crash-snapshot.json'));
 const p=snapshot.terminalProof;assert(p,'no pre-fault identity');
 const entries=fs.readFileSync(out+'/custody.ndjson','utf8').trim().split('\n').map(s=>JSON.parse(s));
 const receipt=drain.reaped.find(e=>e.pid===p.renderer.pid&&e.start===p.renderer.startTicks);assert(receipt,'exact actual renderer wait required');
 const wait=entries.find(e=>e.kind==='reaped'&&e.sequence===receipt.sequence);assert(wait);assert.equal(wait.pid,receipt.pid);assert.equal(wait.start,receipt.start);assert.equal(wait.status,receipt.status);
 const before=entries.find(e=>e.sequence===receipt.beforeReapSequence);assert.equal(before.pid,wait.pid);assert.equal(before.start,wait.start);
 const observer=JSON.parse(fs.readFileSync(out+'/custodian.json'));
 const joined=attributeTerminal(snapshot,{source:'kernel-waitpid',pid:wait.pid,startTicks:wait.start,bootId:observer.bootId,observerPid:observer.pid,
  beforeWaitAt:before.at*1000,waitAt:wait.at*1000,status:wait.status,beforeReapSequence:before.sequence,reapSequence:wait.sequence});
 assert.equal(joined.termination.signal,6,'deliberate Page.crash must have independent SIGABRT');
 assert.equal(joined.target.value.status,'crashed');assert.equal(joined.target.value.errorCode,134);
 assert(drain.complete,'actual custody drain required');assert.equal(drain.exit,0);assert(drain.reaped.length===drain.owned.length);
 save('joined-terminal.json',joined);console.log(JSON.stringify({passed:true,renderer:p.renderer,termination:joined.termination,owned:drain.owned.length,reaped:drain.reaped.length}));
}else main().catch(e=>{console.error(e.stack);process.exitCode=1});
async function main(){
 fs.mkdirSync(out,{recursive:true});const deadline=Number(process.env.FIXTURE_DEADLINE);assert(deadline>Date.now()&&deadline<=Date.now()+180000,'finite independent fixture deadline required');
 const profile=out+'/profile';fs.mkdirSync(profile);
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>renderer identity fixture</title><p>'+req.url+'</p>')});
 let chrome,ws,seq=0,guard;const pending=new Map(),sessions=new Map(),guards=[];let httpPort,debugPort,chromeStart,terminal,terminalResolve;
 const exit=new Promise(r=>terminalResolve=r);let cleanupResult;
 const lifecycle=createLifecycle(async()=>{
  for(const g of guards)g.dispose();
  if(ws?.readyState===1){try{await send('Browser.close')}catch{}}
  if(chrome&&!terminal){const timer=setTimeout(()=>chrome.kill('SIGTERM'),8000);await exit;clearTimeout(timer)}
  ws?.close();for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('fixture closed'))}pending.clear();
  if(server.listening)await new Promise(r=>server.close(r));
  if(terminal)fs.rmSync(profile,{recursive:true,force:true});
  cleanupResult={terminal,chromeStart,profileRemoved:!fs.existsSync(profile),serverClosed:!server.listening,debugPort,httpPort,at:Date.now(),input:'no keyboard or pointer input',locks:'no runtime input lock acquired'};
  save('cleanup.json',cleanupResult);return cleanupResult;
 });
 const timer=setTimeout(()=>lifecycle.finish('fixture deadline'),deadline-Date.now());
 function session(id){const s=new EventEmitter();s.id=()=>id;s.send=(m,p)=>send(m,p,id);sessions.set(id||'',s);return s;}
 function send(method,params={},sessionId){return new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method))},15000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params,sessionId}));});}
 const b=session();
 try {
  await new Promise(r=>server.listen(0,'127.0.0.1',r));httpPort=server.address().port;
  const fd=fs.openSync(out+'/chrome.stderr','wx');
  chrome=await lifecycle.acquire(()=>cp.spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--no-first-run','--no-default-browser-check','--disable-dev-shm-usage','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore',fd]}));fs.closeSync(fd);
  chrome.once('exit',(code,signal)=>{terminal={code,signal,at:Date.now()};terminalResolve(terminal)});chromeStart=identity(chrome.pid);save('chrome-start.json',chromeStart);
  chrome.once('error',e=>{console.error(e);terminalResolve({error:String(e)})});
  const startupDue=Math.min(deadline,Date.now()+30000);while(!fs.existsSync(profile+'/DevToolsActivePort')&&Date.now()<startupDue)await sleep(50);
  const [port,url]=fs.readFileSync(profile+'/DevToolsActivePort','utf8').trim().split('\n');debugPort=Number(port);
  ws=new WebSocket('ws://127.0.0.1:'+port+url);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});
  ws.onmessage=m=>{const v=JSON.parse(m.data);if(v.id){const p=pending.get(v.id);if(p){clearTimeout(p.timer);pending.delete(v.id);v.error?p.reject(Error(JSON.stringify(v.error))):p.resolve(v.result)}}else{
   if(v.method.startsWith('Target.')||v.method.startsWith('Inspector.'))append('cdp-events.jsonl',{at:Date.now(),...v});
   sessions.get(v.sessionId||'')?.emit(v.method,v.params);
  }};
  ws.onclose=()=>{for(const s of sessions.values())s.emit('CDPSession.Disconnected',{})};
  save('version.json',await b.send('Browser.getVersion'));
  async function page(label){
   const t=await b.send('Target.createTarget',{url:'http://127.0.0.1:'+server.address().port+'/'+label});
   const a=await b.send('Target.attachToTarget',{targetId:t.targetId,flatten:true});const s=session(a.sessionId);
   await s.send('Page.enable');await s.send('Runtime.enable');
   const readyDue=Math.min(deadline,Date.now()+30000);while(Date.now()<readyDue){const frame=(await s.send('Page.getFrameTree')).frameTree.frame;if(frame.loaderId&&frame.url.endsWith('/'+label)){const ready=await s.send('Runtime.evaluate',{expression:"document.readyState==='complete'&&document.title==='renderer identity fixture'",returnByValue:true});if(ready.result.value)return {t,s};}await sleep(30)}
   throw Error('page commit timeout');
  }
  function monitor(s,label){const g=createRendererIdentity({browserSession:b,pageSession:s,chromePid:chrome.pid,deadline,
   retain:r=>append(label+'-identity.jsonl',r),retainTrace:bytes=>{const fd=fs.openSync(out+'/'+label+'-trace.json','wx');try{fs.writeSync(fd,bytes);fs.fsyncSync(fd)}finally{fs.closeSync(fd)}}});guards.push(g);return g;}
  const normal=await page('normal');guard=monitor(normal.s,'normal');const normalProof=await guard.qualify();save('normal-proof.json',normalProof);guard.check();
  const result=await normal.s.send('Runtime.evaluate',{expression:'document.title',returnByValue:true});assert.equal(result.result.value,'renderer identity fixture');
  // Bind the actual lifecycle guard as production browser.js does; navigation
  // retires this exact identity and never silently rearms it.
  const normalLife=createLifecycle(async()=>{});normalLife.watch(()=>guard.check());normalLife.check();
  await normal.s.send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/navigated'});
  for(let n=0;n<100&&!guard.snapshot().unknown;n++)await sleep(20);
  assert.throws(()=>normalLife.check(),/UNKNOWN/);const first=guard.snapshot().unknown;
  assert.throws(()=>guard.check(),/UNKNOWN/);save('navigation-stale.json',guard.snapshot());guard.dispose();
  for(let n=0;n<100;n++){const frame=(await normal.s.send('Page.getFrameTree')).frameTree.frame;if(frame.url.endsWith('/navigated')&&frame.loaderId!==normalProof.frame.loaderId)break;await sleep(30)}
  const afterNavigation=monitor(normal.s,'after-navigation');let navigationQualification;
  try{const nextProof=await afterNavigation.qualify();assert.equal(nextProof.targetId,normalProof.targetId);assert.notEqual(nextProof.frame.loaderId,normalProof.frame.loaderId);afterNavigation.check();navigationQualification='qualified fresh loader';}
  catch(e){assert.match(String(e),/one exact initial frame mapping required/);assert.equal(afterNavigation.snapshot().proof,null);navigationQualification='rejected ambiguous cached frame metadata';save('navigation-qualification-refused.json',afterNavigation.snapshot());}

  await b.send('Target.closeTarget',{targetId:normal.t.targetId});
  for(let n=0;n<100&&!afterNavigation.snapshot().unknown;n++)await sleep(20);
  assert.throws(()=>afterNavigation.check(),/UNKNOWN/);save('target-closed.json',afterNavigation.snapshot());afterNavigation.dispose();
  const replacement=await page('replacement');const replacementGuard=monitor(replacement.s,'replacement');const replacementProof=await replacementGuard.qualify();assert.notEqual(replacementProof.targetId,normalProof.targetId);
  assert.throws(()=>guard.check(),/UNKNOWN/);assert.equal(guard.snapshot().unknown,first);save('replacement-proof.json',replacementProof);
  replacementGuard.check();assert.equal(replacementGuard.snapshot().crashEvents.length,0);
  await b.send('Target.closeTarget',{targetId:replacement.t.targetId});
  for(let n=0;n<100&&!replacementGuard.snapshot().unknown;n++)await sleep(20);
  assert.throws(()=>replacementGuard.check(),/UNKNOWN/);save('replacement-closed.json',replacementGuard.snapshot());replacementGuard.dispose();
  const crash=await page('crash');const crashGuard=monitor(crash.s,'crash');const proof=await crashGuard.qualify();crashGuard.check();save('pre-fault-proof.json',proof);
  // Record durably before issuing the deliberate fault, with no requalification.
  save('fault-request.json',{at:Date.now(),method:'Page.crash',targetId:proof.targetId,sessionId:proof.sessionId});
  const fault=crash.s.send('Page.crash').catch(e=>({requestError:String(e)}));
  for(let n=0;n<200&&!crashGuard.snapshot().crashEvents.some(e=>e.name==='Target.targetCrashed');n++)await sleep(50);
  const snapshot=crashGuard.snapshot();save('crash-snapshot.json',snapshot);
  assert(snapshot.terminalProof);assert(snapshot.crashEvents.some(e=>e.name==='Inspector.targetCrashed'));
  assert(snapshot.crashEvents.some(e=>e.name==='Target.targetCrashed'&&e.value.targetId===proof.targetId&&e.value.status==='crashed'&&e.value.errorCode===134));
  assert.throws(()=>crashGuard.check(),/UNKNOWN/);await fault;
  save('controls.json',{passed:true,normal:true,navigationQualification,navigationInvalidates:true,oldGuardSticky:true,targetCloseInvalidates:true,replacementDistinct:true,preFaultQualified:true,exactCrashEvents:true,independentOsWait:'join only after custodian actual wait'});
 }finally{clearTimeout(timer);await lifecycle.finish('ordinary fixture close')}
 assert.equal(cleanupResult.terminal.code,0);assert(cleanupResult.profileRemoved&&cleanupResult.serverClosed);
 console.log(JSON.stringify({passed:true,cleanup:cleanupResult}));
}
