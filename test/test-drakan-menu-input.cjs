'use strict';
const fs=require('node:fs'),path=require('node:path'),net=require('node:net'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const c=require('../tools/native-supervisor-common.cjs');
async function main(out,frameMs=800,confirmationMs=5000){
 out=path.resolve(out);fs.mkdirSync(out,{recursive:true});const a=require('../tools/drakan-authentic-reviewed.cjs');a.R=out;
 const exe=path.join(out,'authored.exe');fs.writeFileSync(exe,require('../tools/drakan-menu-input.cjs').fixture({frameMs}),{flag:'wx'});
 const prep=require('../tools/blood2-immutable-preparation.cjs'),base='6308e7a3be6c98ab150d07c2f178d8cd09f4b2e6';
 const rows=prep.collect([],{revision:base,media:[{path:path.relative(path.resolve(__dirname,'..'),exe),size:fs.statSync(exe).size,sha256:c.sha256(fs.readFileSync(exe))}]});
 for(const file of ['lib/renderer-input.js','lib/cli-native-scene.js','lib/dll-registry.js']){const b=require('node:child_process').execFileSync('git',['show','5aa5dabdfaf017f945037eefcffead29ccb87bf1:'+file]);Object.assign(rows.find(r=>r.path===file),{sha256:c.sha256(b),body:b.toString('base64')});}
 const frozen=prep.freeze(rows,fs.readFileSync(process.env.DRAKAN_TEST_MODULE));
 const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});a.URL='http://127.0.0.1:'+port+'/ctl';
 const at=c.now();a.save('launch.json',{at,deadline:at+240,gameplayCutoff:at+60,reserveSeconds:180,nativeScene:true,bindingContract:'native-reviewed-context-v1',menuInputPolicy:{confirmationMs:2500,fallbackMs:3500,physicalUpMs:6500,operationMs:10000}});
 a.save('identity.json',{base,moduleSHA256:c.sha256(fs.readFileSync(process.env.DRAKAN_TEST_MODULE)),sourceSHA256:frozen.sourceSHA256,inventory:frozen.inventory,frameMs,confirmationMs,calibrationOnly:true});
 require('../tools/blood2-durable-launcher.cjs').launch({run:out,command:[process.execPath,'test/run.js','--exe='+exe,'--no-build','--threads','--real-ticks','--screen=1024x712','--control='+port,'--max-seconds=35','--max-batches=100000000','--stuck-after=0','--quiet-api','--quiet-blocks','--no-close'],env:{...frozen.env,WINE_PUBLIC_INPUT_TRACE:out+'/input-trace.jsonl'},fds:frozen.fds,deadline:at+40,cleanupDeadline:at+55});frozen.close();
 let error;
 try{
  await require('../tools/drakan-launch-readiness.cjs').wait(out);
  const listenEnd=c.now()+12;while(!c.listenerOwnedBy(a.read('native-pid.json').pid,port)){assert(c.now()<listenEnd,'authored listener deadline');await c.sleep(25);}
  const end=c.now()+15;for(;;){const s=await a.call({action:'native-startup-readiness'},2);if(s.ready)break;assert(c.now()<end);await c.sleep(30);}
  await a.capture('main');const rr=a.read('main.json');a.save('main-review.json',{at:c.now(),pngSHA256:rr.pngSHA256,scene:'menu',wholeFrame:true,targetHwnd:rr.snapshot.focus,observation:'Authored diagnostic fixture; no original game review claimed'});await a.bind('main');
  if(process.env.DRAKAN_MENU_FIXED==='1'){
   await require('../tools/drakan-menu-input.cjs').pulse({name:'enter',key:13,review:'main',observation:'Authored diagnostic native USER/DirectInput control; no original claim'});
   assert(a.read('enter-complete.json').consumed);assert(a.read('enter-complete.json').physicalUpACK);
   a.save('assertions.json',{pass:true,nativeConsumption:true,physicalUpACK:true,policyFixedBeforeDispatch:true});return;
  }
  const [owner]=await a.lease(),nonce=crypto.randomUUID(),begin=c.now(),deadline=Math.trunc((begin+6)*1000);
  // Independently prearmed physical UP is a separate process before DOWN.
  const cp=require('node:child_process'),child=cp.spawn(process.execPath,['-e',`const c=require('./tools/native-supervisor-common.cjs');const fs=require('fs');process.stdout.write('armed\\n');setTimeout(async()=>{let r;try{r=await c.postJSON(${JSON.stringify(a.URL)},{action:'guarded-release',owner:${JSON.stringify(owner.owner)}},3);}catch(e){r={error:String(e)}}c.save(${JSON.stringify(out)},'independent-up.json',{at:c.now(),reply:r});},2500);`],{stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);const wait=new Promise(r=>child.once('close',(code,signal)=>r({pid:child.pid,code,signal,stdout,stderr,actualWait:true,stdoutEOF:child.stdout.readableEnded,stderrEOF:child.stderr.readableEnded})));
  await new Promise(r=>child.stdout.once('data',r));
  const sentAt=c.now();let reply;
  try{reply=await c.postJSON(a.URL,{action:'guarded-input',cmd:'keydown:13',guard:{...owner,nonce,reviewed:true,deadline,intent:{review:{contract:'native-reviewed-context-v1',captureId:rr.captureId,pngSHA256:rr.pngSHA256,reviewed:true,reviewedAt:a.read('main-review.json').at*1000,scope:'menu',targetHwnd:rr.snapshot.focus}}}},confirmationMs/1000);}catch(e){reply={ok:false,error:String(e)};}
  a.save('measurement.json',{sentAt,returnedAt:c.now(),elapsedMs:(c.now()-sentAt)*1000,reply});a.save('release-wait.json',await wait);
  if(!reply.ok){a.save('terminal-input-failure.json',{noReplay:true,error:reply,at:c.now()});return;}
  assert.equal(reply.value.consumed,true);assert.equal(reply.value.nativeMessage.consumption,'owner-user-return');
  a.save('after.json',await a.call({action:'eval',code:`(()=>{const e=instance.exports,dv=new DataView(memory.buffer),r=p=>dv.getUint32(e.guest_to_wasm(p),true);return {async:r(0x402810),dispatched:r(0x402814),diHRESULT:r(0x402818),diEnter:dv.getUint8(e.guest_to_wasm(0x402e1c)),windows:Object.values(renderer.windows).map(w=>({hwnd:w.hwnd,title:w.title}))};})()`},2));
 }catch(e){error=e;a.save('failure.json',{error:String(e)});}
 finally{
  a.save('cancel-request.json',{fixtureOnly:true});const end=c.now()+15;while(!fs.existsSync(path.join(out,'owner-complete.json'))){assert(c.now()<end);await c.sleep(25);}const done=a.read('owner-complete.json');assert(done.retainedActualWaits);assert.equal(done.receipt.leaked,false);if(error)throw error;
 }
}
async function browser(out){
 out=path.resolve(out);fs.mkdirSync(out,{recursive:true});
 const cp=require('node:child_process'),base='6308e7a3be6c98ab150d07c2f178d8cd09f4b2e6',moduleBytes=fs.readFileSync(process.env.DRAKAN_TEST_MODULE);
 const rows=require('../tools/blood2-immutable-preparation.cjs').collect([],{revision:base}),files=new Map(rows.map(r=>[r.path,Buffer.from(r.body,'base64')]));
 const fixture=require('../tools/drakan-menu-input.cjs').fixture({frameMs:2000}),reads=[],logs=[];
 let chrome,server,watch,watchWait,unknown=false;
 try{
  server=await require('./static-server').startStaticServer({root:path.resolve(__dirname,'..'),crossOriginIsolated:true,handleRequest(req,res){
   const p=new URL(req.url,'http://local').pathname.slice(1)||'index.html';let b=p==='build/wine-assembly.wasm'?moduleBytes:p==='fixture.exe'?fixture:files.get(p);
   if(!b){try{b=cp.execFileSync('git',['show',base+':'+p],{maxBuffer:4e6,stdio:['ignore','pipe','ignore']});files.set(p,b);}catch{res.writeHead(404);res.end();return true;}}
   reads.push({path:p,sha256:c.sha256(b),size:b.length});res.writeHead(200,{'Content-Type':require('./static-server').mimeType(p)});res.end(b);return true;
  }});
  chrome=await require('puppeteer').launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage'],protocolTimeout:10000});
  const target={pid:chrome.process().pid,startToken:c.token(chrome.process().pid)};
  watch=cp.spawn(process.execPath,['-e',`const c=require('./tools/native-supervisor-common.cjs');setTimeout(()=>{try{if(c.token(${target.pid})===${JSON.stringify(target.startToken)})process.kill(${target.pid},'SIGTERM');}catch{}},45000);process.stdin.resume();process.stdin.on('end',()=>process.exit(0));`],{stdio:['pipe','pipe','pipe']});
  watchWait=new Promise(r=>watch.once('close',(code,signal)=>r({pid:watch.pid,code,signal,actualWait:true,stdoutEOF:watch.stdout.readableEnded,stderrEOF:watch.stderr.readableEnded})));watch.stdout.resume();watch.stderr.resume();
  const page=await chrome.newPage();page.on('console',m=>logs.push(m.text()));page.on('pageerror',e=>logs.push(String(e)));
  await page.evaluateOnNewDocument(()=>localStorage.setItem('wine-assembly.threads','1'));
  await page.goto('http://127.0.0.1:'+server.address().port+'/?debug&no-log&force-threads');await page.waitForFunction(()=>window.wineShell&&window.wineApps,{timeout:15000});
  await page.evaluate(async()=>{window.WINE_THREADS=true;wineApps.APPS.authored_drakan={name:'Authored Drakan menu',exe:'fixture.exe',dlls:[],files:[],threads:true};await wineShell.launchApp('authored_drakan');});
  const sample=()=>page.evaluate(async()=>{const w=wineShell.runningApps.find(a=>a?.name==='authored_drakan')?.wine;if(!w?.guestWorker)return {unavailable:true};const e=w.instance.exports,dv=new DataView(w.memory.buffer),r=p=>dv.getUint32(e.guest_to_wasm(p),true);
   return {at:Date.now(),actor:await w.guestWorker.readExports(['get_process_id','get_current_thread_id','get_focus_hwnd','get_main_hwnd']),async:r(0x402810),dispatched:r(0x402814),diHRESULT:r(0x402818),diEnter:dv.getUint8(e.guest_to_wasm(0x402e1c)),windows:Object.values(w.renderer.windows).map(v=>({hwnd:v.hwnd,visible:v.visible,title:v.title}))};});
  let before;const end=c.now()+15;while(c.now()<end){before=await sample();if(before.actor?.get_main_hwnd)break;await c.sleep(50);}assert(before.actor?.get_main_hwnd);
  await page.screenshot({path:path.join(out,'before.png')});c.save(out,'before.json',before);
  const child=cp.fork(require.resolve('../tools/nfs3-normal-worker-control.cjs'),['release'],{silent:true});let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
  const wait=new Promise(r=>child.once('close',(code,signal)=>r({pid:child.pid,code,signal,stdout,stderr,actualWait:true,stdoutEOF:child.stdout.readableEnded,stderrEOF:child.stderr.readableEnded})));
  const armed=new Promise((r,j)=>{const t=setTimeout(()=>j(Error('UP arm timeout')),2000);child.once('message',m=>{clearTimeout(t);m.armed?r(m):j(Error('UP arm failed'));});});
  child.send({...target,url:chrome.wsEndpoint(),target:page.target()._targetId,key:'Enter',code:13,holdMs:2800,file:path.join(out,'physical-up.json')});
  await armed;const sentAt=Date.now();let after;
  try{await page.keyboard.down('Enter');const until=sentAt+2500;while(Date.now()<until){after=await sample();if(after.dispatched&&after.diEnter===128)break;await c.sleep(25);}}
  finally{c.save(out,'release-wait.json',await wait);}
  c.save(out,'measurement.json',{sentAt,after,confirmationMs:2500,physicalFallbackMs:2800,actualPhysicalDOMInput:true});
  assert(after.dispatched>before.dispatched);assert.equal(after.diHRESULT,0);assert.equal(after.diEnter,128);assert.equal(after.actor.get_current_thread_id,1);
  assert.deepEqual(after.actor,before.actor);assert(c.readJSON(path.join(out,'physical-up.json')).ackAt);
  await c.sleep(2200);const up=await sample();assert.equal(up.diEnter,0);c.save(out,'after-up.json',up);await page.screenshot({path:path.join(out,'after.png')});
  c.save(out,'proof.json',{pass:true,browser:await chrome.version(),moduleSHA256:c.sha256(moduleBytes),base,reads,logs,before,after,up,nativeUSERDispatch:true,ordinaryDirectInput:true,guardedACKClaim:false});
 }catch(e){unknown=true;c.save(out,'failure.json',{error:String(e),noReplay:true});throw e;}
 finally{
  if(chrome){const proc=chrome.process(),wait=new Promise(r=>proc.once('close',(code,signal)=>r({pid:proc.pid,code,signal,actualWait:true,stdoutEOF:proc.stdout?.readableEnded??null,stderrEOF:proc.stderr?.readableEnded??null})));proc.stdout?.resume();proc.stderr?.resume();if(unknown)proc.kill('SIGTERM');else await chrome.close();c.save(out,'browser-wait.json',await wait);}
  if(watch){watch.stdin.end();c.save(out,'watchdog-wait.json',await watchWait);}if(server)await require('./static-server').closeServer(server);
 }
}
async function unit(){
 const h=require('../tools/drakan-menu-input.cjs');
 const p={confirmationMs:2500,fallbackMs:3500,physicalUpMs:6500,operationMs:10000};assert(Object.isFrozen(h.policy(p)));
 for(const edit of [p=>p.confirmationMs=Infinity,p=>p.fallbackMs=2500,p=>p.physicalUpMs=6000,p=>p.operationMs=7000]){const q={...p};edit(q);assert.throws(()=>h.policy(q));}
 const expected={owner:{owner:'owner',epoch:1},nonce:'nonce',deadline:2000,key:13,sentAt:1,hwnd:65537,threadId:1};
 const r={state:'CONSUMED',consumed:true,owner:'owner',epoch:1,nonce:'nonce',deadline:2000,consumedAt:1500,receiptBoundary:'native-input-return',nativeMessage:{consumption:'owner-user-return',nonce:'nonce',token:1,msg:256,wParam:13,hwnd:65537,threadId:1,apiKind:2,remove:true}};
 h.proof(r,expected);
 for(const edit of [r=>r.state='UNKNOWN',r=>r.owner='foreign',r=>r.epoch++,r=>r.nonce='foreign',r=>r.deadline++,r=>r.consumedAt=2000,r=>r.receiptBoundary='host-handler',r=>r.nativeMessage.consumption='poll',r=>r.nativeMessage.hwnd++,r=>r.nativeMessage.threadId++,r=>r.nativeMessage.token=0,r=>r.nativeMessage.wParam=27,r=>r.nativeMessage.remove=false]){const q=structuredClone(r);edit(q);assert.throws(()=>h.proof(q,expected));}
 console.log('PASS finite policy and thirteen native receipt negatives');
}
module.exports={main,browser,unit};if(require.main===module)(process.argv[2]==='--unit'?unit():process.argv[2]==='--browser'?browser(process.argv[3]):main(process.argv[2],Number(process.argv[3]??800),Number(process.argv[4]??5000))).catch(e=>{console.error(e);process.exitCode=1;});
