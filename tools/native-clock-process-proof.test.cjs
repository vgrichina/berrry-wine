'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process'),http=require('node:http');
const {identity,listener,createVerifier,createGuardedProbe}=require('./native-clock-process-proof.cjs');
const {arm,bind}=require('./native-deadline-watchdog.cjs');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const out=path.resolve(process.env.RECOIL_PROOF_TEST_DIR);fs.mkdirSync(out,{recursive:true});const profile=out+'/chrome-profile';
 const deadline=Date.now()+20000;await arm(out,{browserDeadline:deadline,watchdogDeadline:deadline+6000,profile});
 const server=http.createServer((req,res)=>res.end('clock census only'));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const chrome=cp.spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--no-first-run','--disable-dev-shm-usage','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:['ignore',fs.openSync(out+'/chrome.stdout','wx'),fs.openSync(out+'/chrome.stderr','wx')]});
 let ws;const verifiers=[];let binding;
 try {
  const active=profile+'/DevToolsActivePort';for(let i=0;i<100&&!fs.existsSync(active);i++)await wait(50);
  const [port,browserPath]=fs.readFileSync(active,'utf8').trim().split('\n'),debugPort=Number(port),endpoint='ws://127.0.0.1:'+port+browserPath;
  const a=identity(process.pid),b=identity(chrome.pid),simple=p=>({pid:p.pid,startTicks:p.startTicks,netns:p.namespaces.net});
  fs.writeFileSync(out+'/actual-processes.json',JSON.stringify({node:a,chrome:b}));
  bind(out,deadline,chrome.pid,profile);
  const claim={bootId:a.bootId,driverProc:simple(a),chromeProc:simple(b),endpoint};
  fs.writeFileSync(out+'/same-host-clock-proof.json',JSON.stringify(claim));fs.writeFileSync(out+'/process.json',JSON.stringify({pid:process.pid,chromePid:chrome.pid,port:server.address().port,profile}));fs.writeFileSync(out+'/endpoint.json',JSON.stringify({debugPort,browserPath}));
  let count=0;const retain=row=>{const fd=fs.openSync(out+'/proof-'+(++count)+'.json','wx');try{fs.writeSync(fd,JSON.stringify(row));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}};
  const verify=createVerifier({out,deadline:Date.now()+20000,retain});verifiers.push(verify);assert(await verify());
  const proof=JSON.parse(fs.readFileSync(out+'/proof-1.json')).proof;assert.notEqual(proof.observer.pid,process.pid);assert.notEqual(proof.observer.pid,chrome.pid);assert(proof.nodeListener.fds.length&&proof.chromeFds.length);
  ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});let n=0;const pending=new Map();ws.onmessage=e=>{const v=JSON.parse(e.data);if(v.id){const p=pending.get(v.id);pending.delete(v.id);v.error?p.reject(Error(JSON.stringify(v.error))):p.resolve(v.result);}};
  const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++n;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
  const targets=(await send('Target.getTargets')).targetInfos.filter(t=>t.type==='page');assert.equal(targets.length,1);
  const {sessionId}=await send('Target.attachToTarget',{targetId:targets[0].targetId,flatten:true});
  const begin=Date.now(),value=(await send('Runtime.evaluate',{expression:'Date.now()',returnByValue:true},sessionId)).result.value,end=Date.now();assert(value>=begin&&value<=end,'actual browser clock bracket');
  const guarded=createGuardedProbe(verify,async()=>({at:Date.now(),qualified:true}),{deadline});const result=await guarded({phase:'beforeResume'});assert(result.qualified);assert.equal(count,3);
  const firstProof=JSON.parse(fs.readFileSync(out+'/proof-1.json')),thirdProof=JSON.parse(fs.readFileSync(out+'/proof-3.json'));
  assert.equal(firstProof.proof.observer.pid,thirdProof.proof.observer.pid,'persistent independent observer');
  assert.notEqual(firstProof.request.challenge,thirdProof.request.challenge,'new challenge per census');
  assert(firstProof.proof.clock.ended<=thirdProof.proof.clock.began,'fresh census each time');
  const expired=createGuardedProbe(verify,async()=>({at:Date.now()-300}),{deadline});await assert.rejects(()=>expired({phase:'beforeResume'}),/expired/);await assert.rejects(()=>expired({}),/no replay/);
  assert.throws(()=>listener(process.pid,debugPort),/FD must belong/);
  const invalid={...claim,chromeProc:{...claim.chromeProc,startTicks:'0'}};fs.writeFileSync(out+'/same-host-clock-proof.json',JSON.stringify(invalid));
  const bad=createVerifier({out,deadline:Date.now()+20000,retain});verifiers.push(bad);await assert.rejects(bad,/start mismatch/);fs.writeFileSync(out+'/same-host-clock-proof.json',JSON.stringify(claim));await assert.rejects(bad,/no replay/);
  const sink=createVerifier({out,deadline:Date.now()+20000,retain(){throw Error('durable sink refusal');}});verifiers.push(sink);await assert.rejects(sink,/sink refusal/);await assert.rejects(sink,/no replay/);
  let retired=false,checks=0,probeCalls=0;
  const retirement=createGuardedProbe(async()=>{if(++checks===2)retired=true;},async()=>{probeCalls++;return {at:Date.now()};},{deadline,isClosed:()=>retired});
  await assert.rejects(()=>retirement({phase:'beforeResume'}),/lifecycle retired/);await assert.rejects(()=>retirement({phase:'afterResume'}),/no replay/);assert.equal(probeCalls,1);
  const transition=createGuardedProbe(async()=>wait(10),async()=>({at:Date.now()}),{deadline,transitionMs:5});await assert.rejects(()=>transition({phase:'beforeResume'}),/transition expired/);
  const staleSource=createGuardedProbe(async()=>{},async()=>({at:Date.now(),reads:[{software:{copyAt:Date.now()},responses:[{requestAt:Date.now()-300}]}]}),{deadline});await assert.rejects(()=>staleSource({phase:'beforeResume'}),/expired/);
  const driver=fs.readFileSync(process.env.RECOIL_DRIVER_PATH,'utf8'),beginBinding=driver.indexOf('const clockProof='),endBinding=driver.indexOf('async function armSoftware()',beginBinding);assert(beginBinding>0&&endBinding>beginBinding);
  let actualProbes=0,actualPreparations=0;binding=require('node:vm').runInNewContext(driver.slice(beginBinding,endBinding)+';({independentClock,softwareProbe,censusClock})',{require,root:path.resolve(__dirname,'..'),run:out,out,deadline,fs,softwareDriver:{closed:false,prepareProbe:async()=>{actualPreparations++;},abortProbe:async()=>{},probe:async()=>{actualProbes++;return {at:Date.now(),qualified:true};}}});
  assert(await binding.independentClock());await binding.softwareProbe({phase:'beforeResume'});assert((await binding.softwareProbe()).qualified);assert.equal(actualProbes,2);assert.equal(actualPreparations,driver.includes("softwareDriver.prepareProbe()")?2:0);
  const before=fs.readdirSync(out).filter(x=>x.startsWith('independent-clock-process-proof-'));assert.equal(before.length,5);
  // Retirement is sticky even if the claimed driver/Chrome pair is still live.
  let observerProof;
  const retiredObserver=createVerifier({out,deadline:Date.now()+10000,retain:row=>{observerProof=row;}});verifiers.push(retiredObserver);
  await retiredObserver();const observerPid=observerProof.proof.observer.pid;
  process.kill(observerPid,'SIGKILL');await wait(50);
  await assert.rejects(retiredObserver,/no replay/);await assert.rejects(retiredObserver,/no replay/);
  // A stopped live producer cannot turn a fresh-request timeout into a retry.
  const stalled=createVerifier({out,deadline:Date.now()+10000,retain:row=>{if(row.proof)observerProof=row;}});verifiers.push(stalled);
  await stalled();const stopped=observerProof.proof.observer;process.kill(stopped.pid,'SIGSTOP');
  try {await assert.rejects(stalled,/census timed out/);await assert.rejects(stalled,/no replay/);}
  finally {try {process.kill(stopped.pid,'SIGCONT');}catch(e){if(e.code!=='ESRCH')throw e;}}
  // The producer itself refuses reused challenges and changed immutable caps.
  async function rawProducer(mutate){
   const limit=Date.now()+5000,p=cp.spawn(process.execPath,[path.resolve(__dirname,'native-clock-process-proof.cjs'),'--serve',String(limit)],{stdio:['pipe','pipe','pipe']});
   const lines=require('node:readline').createInterface({input:p.stdout}),queued=[],pending=[];
   lines.on('line',line=>{const row=JSON.parse(line);if(pending.length)pending.shift()(row);else queued.push(row);});
   const next=()=>queued.length?Promise.resolve(queued.shift()):new Promise(r=>pending.push(r));
   const exited=new Promise(r=>p.once('exit',(code,signal)=>r({code,signal})));
   try {
    const ready=await next();assert.equal(ready.deadline,limit);
    const request={...firstProof.request,deadline:limit};
    if(mutate)request.deadline++;
    p.stdin.write(JSON.stringify(request)+'\n');const answer=await next();
    if(mutate)assert.match(answer.error,/deadline changed/);
    else {assert(answer.proof.passed);p.stdin.write(JSON.stringify(request)+'\n');assert.match((await next()).error,/challenge replay/);}
    assert.equal((await exited).code,1);
   }finally{lines.close();p.stdin.destroy();p.kill('SIGKILL');await exited;}
  }
  await rawProducer(false);await rawProducer(true);
  // Successful idle observers must not keep a closing driver alive. The real
  // parent exit hook terminates its exact child; kernel drain also checks this.
  const natural=out+'/natural-exit';fs.mkdirSync(natural);
  const code=`const fs=require('fs'),http=require('http'),{identity,createVerifier}=require(${JSON.stringify(path.resolve(__dirname,'native-clock-process-proof.cjs'))});
   const out=${JSON.stringify(out)},profile=${JSON.stringify(profile)},chrome=${chrome.pid},endpoint=${JSON.stringify(endpoint)},debugPort=${debugPort},browserPath=${JSON.stringify(browserPath)};
   const server=http.createServer((q,s)=>s.end());server.listen(0,'127.0.0.1',async()=>{try{
    const a=identity(process.pid),b=identity(chrome),simple=p=>({pid:p.pid,startTicks:p.startTicks,netns:p.namespaces.net});
    fs.writeFileSync(out+'/process.json',JSON.stringify({pid:process.pid,chromePid:chrome,port:server.address().port,profile}));
    fs.writeFileSync(out+'/same-host-clock-proof.json',JSON.stringify({bootId:a.bootId,driverProc:simple(a),chromeProc:simple(b),endpoint}));
    fs.writeFileSync(out+'/endpoint.json',JSON.stringify({debugPort,browserPath}));
    const verify=createVerifier({out,deadline:Date.now()+10000,retain:row=>fs.writeFileSync(${JSON.stringify(natural+'/proof.json')},JSON.stringify(row))});await verify();
   }finally{server.close();}});`;
  await new Promise((resolve,reject)=>cp.execFile(process.execPath,['-e',code],{timeout:8000},(error,stdout,stderr)=>error?reject(Error(stderr||error.message)):resolve()));
  const naturalProof=JSON.parse(fs.readFileSync(natural+'/proof.json'));assert(naturalProof.proof.passed);
  for(let n=0;n<100;n++){try{identity(naturalProof.proof.observer.pid);await wait(10);}catch{break;}}
  assert.throws(()=>identity(naturalProof.proof.observer.pid),'observer retired after parent natural exit');
  const prearmCode=`const fs=require('fs'),{identity,createVerifier}=require(${JSON.stringify(path.resolve(__dirname,'native-clock-process-proof.cjs'))});
   createVerifier({out:'/not-read-before-first-census',deadline:Date.now()+10000,retain(){}});
   const children=fs.readFileSync('/proc/'+process.pid+'/task/'+process.pid+'/children','utf8').trim().split(/\\s+/).map(Number).map(identity);
   fs.writeFileSync(${JSON.stringify(natural+'/prearm-identities.json')},JSON.stringify(children));`;
  await new Promise((resolve,reject)=>cp.execFile(process.execPath,['-e',prearmCode],{timeout:8000},(error,stdout,stderr)=>error?reject(Error(stderr||error.message)):resolve()));
  const prearmed=JSON.parse(fs.readFileSync(natural+'/prearm-identities.json'));assert.equal(prearmed.length,1);
  for(let n=0;n<100;n++){try{identity(prearmed[0].pid);await wait(10);}catch{break;}}
  assert.throws(()=>identity(prearmed[0].pid),'prearmed observer cannot keep failed startup alive');
  fs.writeFileSync(out+'/process.json',JSON.stringify({pid:process.pid,chromePid:chrome.pid,port:server.address().port,profile}));fs.writeFileSync(out+'/same-host-clock-proof.json',JSON.stringify(claim));
  await send('Browser.close');ws.close();ws=null;await new Promise(r=>chrome.exitCode===null?chrome.once('exit',r):r());
  await assert.rejects(verify,/no replay/);
  fs.writeFileSync(out+'/result.json',JSON.stringify({passed:true,realChrome:true,original:false,actualBrowserWallBracket:{begin,value,end},independentProcessProofs:count,wrongStart:true,wrongListenerOwner:true,expiredFreshness:true,durableFailure:true,stickyUnknown:true,postExitRefused:true,actualNativeDriverBinding:true,lifecycleRetirementDuringCensus:true,immutableTransition:true,oldSourceFreshPixelRefused:true,persistentObserverFreshChallenges:true,observerDeathSticky:true,freshResponseTimeoutSticky:true,producerReplayRefused:true,producerDeadlineMutationRefused:true,naturalParentExitRetiresObserver:true}));
  console.log(fs.readFileSync(out+'/result.json','utf8'));
 }finally {for(const verify of verifiers)verify.close();binding?.censusClock.close();ws?.close();if(chrome.exitCode===null){chrome.kill('SIGKILL');await new Promise(r=>chrome.once('exit',r));}await new Promise(r=>server.close(r));fs.rmSync(profile,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
