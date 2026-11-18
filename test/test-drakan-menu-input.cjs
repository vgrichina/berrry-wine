'use strict';
const fs=require('node:fs'),path=require('node:path'),net=require('node:net'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const c=require('../tools/native-supervisor-common.cjs');
async function main(out,frameMs=800,confirmationMs=5000){
 out=path.resolve(out);fs.mkdirSync(out,{recursive:true});const a=require('../tools/drakan-authentic-reviewed.cjs');a.R=out;
 const exe=path.join(out,'authored.exe');fs.writeFileSync(exe,require('../tools/drakan-menu-input.cjs').fixture({frameMs}),{flag:'wx'});
 const prep=require('../tools/blood2-immutable-preparation.cjs'),base='6308e7a3be6c98ab150d07c2f178d8cd09f4b2e6';
 const rows=prep.collect([],{revision:base,media:[{path:path.relative(path.resolve(__dirname,'..'),exe),size:fs.statSync(exe).size,sha256:c.sha256(fs.readFileSync(exe))}]});
 for(const file of ['lib/renderer-input.js','lib/cli-native-scene.js','lib/dll-registry.js']){const b=require('node:child_process').execFileSync('git',['show','5aa5dabdfaf017f945037eefcffead29ccb87bf1:'+file]);Object.assign(rows.find(r=>r.path===file),{sha256:c.sha256(b),body:b.toString('base64')});}
 if(process.env.DRAKAN_REVIEW_CALIBRATED==='1'){
  const b=require('node:child_process').execFileSync('git',['show','98e56ec00390a46fa73dcb7f10ec424c54f0f1d1:lib/cli-native-scene.js']);
  Object.assign(rows.find(r=>r.path==='lib/cli-native-scene.js'),{sha256:c.sha256(b),body:b.toString('base64')});
 }
 const frozen=prep.freeze(rows,fs.readFileSync(process.env.DRAKAN_TEST_MODULE));
 const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});a.URL='http://127.0.0.1:'+port+'/ctl';
 const at=c.now();a.save('launch.json',{at,deadline:at+240,gameplayCutoff:at+60,reserveSeconds:180,nativeScene:true,bindingContract:'native-reviewed-context-v1',menuInputPolicy:{confirmationMs:2500,fallbackMs:3500,physicalUpMs:6500,operationMs:10000,...(process.env.DRAKAN_REVIEW_CALIBRATED==='1'?{gameFreshnessSeconds:60,menuFreshnessSeconds:90}:{})}});
 a.save('identity.json',{base,moduleSHA256:c.sha256(fs.readFileSync(process.env.DRAKAN_TEST_MODULE)),sourceSHA256:frozen.sourceSHA256,inventory:frozen.inventory,frameMs,confirmationMs,calibrationOnly:true});
 require('../tools/blood2-durable-launcher.cjs').launch({run:out,command:[process.execPath,'test/run.js','--exe='+exe,'--no-build','--threads','--real-ticks','--screen=1024x712','--control='+port,'--max-seconds=35','--max-batches=100000000','--stuck-after=0','--quiet-api','--quiet-blocks','--no-close'],env:{...frozen.env,WINE_PUBLIC_INPUT_TRACE:out+'/input-trace.jsonl'},fds:frozen.fds,deadline:at+40,cleanupDeadline:at+55});frozen.close();
 let error;
 try{
  await require('../tools/drakan-launch-readiness.cjs').wait(out);
  const listenEnd=c.now()+12;while(!c.listenerOwnedBy(a.read('native-pid.json').pid,port)){assert(c.now()<listenEnd,'authored listener deadline');await c.sleep(25);}
  const end=c.now()+15;for(;;){const s=await a.call({action:'native-startup-readiness'},2);if(s.ready)break;assert(c.now()<end);await c.sleep(30);}
  await a.capture('main');const rr=a.read('main.json');a.save('main-review.json',{at:c.now(),pngSHA256:rr.pngSHA256,scene:'menu',wholeFrame:true,targetHwnd:rr.snapshot.focus,observation:'Authored diagnostic fixture; no original game review claimed'});await a.bind('main');
  if(process.env.DRAKAN_MENU_FIXED==='1'){
   const pointer=process.env.DRAKAN_MENU_POINTER==='1';
   if(process.env.DRAKAN_DURATION_REJECTION==='1'){
    const refused=await require('../tools/drakan-menu-input.cjs').pulse({name:'too-long',key:38,ms:1000,review:'main',scene:'menu',observation:'Authored duration admission control'});
    assert.match(refused,/NOT_SENT/);assert.equal(a.read('too-long-rejection.json').effects,false);
    assert(!fs.existsSync(path.join(out,'too-long-dispatch.json')));assert(!fs.existsSync(path.join(out,'terminal-input-failure.json')));
   }
   const delay=Number(process.env.DRAKAN_REVIEW_DELAY_MS||0);assert(Number.isInteger(delay)&&delay>=0&&delay<=21000);
   if(delay){await a.capture('aged');await c.sleep(delay);}
   const outcome=await require('../tools/drakan-menu-input.cjs').pulse({name:'enter',ms:process.env.DRAKAN_DURATION_REJECTION==='1'?700:300,...(pointer?{pointer:{action:'mousedown',x:300,y:300}}:{key:13}),review:delay?'aged':'main',scene:delay?'game':'menu',observation:'Authored diagnostic native USER/DirectInput control; no original claim'});
   if(process.env.DRAKAN_EXPECT_REVIEW_REFUSAL==='1'){
    assert.match(outcome,/NOT_SENT/);assert.equal(a.read('enter-rejection.json').effects,false);
    assert(!fs.existsSync(path.join(out,'enter-dispatch.json')));assert(!fs.existsSync(path.join(out,'terminal-input-failure.json')));
    a.save('assertions.json',{pass:true,refusedBeforeDown:true,reviewDelayMs:delay});return;
   }
   assert(a.read('enter-complete.json').consumed);assert(a.read('enter-complete.json').physicalUpACK);
   if(pointer){const result=await a.call({action:'eval',code:`(()=>{const e=instance.exports,dv=new DataView(memory.buffer);return {everDown:dv.getUint32(e.guest_to_wasm(0x402824),true),hresult:dv.getUint32(e.guest_to_wasm(0x40281c),true)};})()`},2);a.save('directinput-mouse.json',result);assert.equal(result.everDown,128);assert.equal(result.hresult,0);}
   a.save('assertions.json',{pass:true,nativeConsumption:true,physicalUpACK:true,policyFixedBeforeDispatch:true,reviewDelayMs:delay});return;
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
   return {at:Date.now(),actor:await w.guestWorker.readExports(['get_process_id','get_current_thread_id','get_focus_hwnd','get_main_hwnd']),async:r(0x402810),dispatched:r(0x402814),diHRESULT:r(0x402818),diEnter:dv.getUint8(e.guest_to_wasm(0x402e1c)),diMouse:dv.getUint8(e.guest_to_wasm(0x402f0c)),everMouse:r(0x402824),windows:Object.values(w.renderer.windows).map(v=>({hwnd:v.hwnd,visible:v.visible,title:v.title}))};});
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
  await c.sleep(2200);const up=await sample();assert.equal(up.diEnter,0);c.save(out,'after-up.json',up);
  const point=await page.evaluate(()=>{const w=wineShell.runningApps[0].wine,canvas=w.renderer.canvas,b=canvas.getBoundingClientRect();return {x:b.left+300*b.width/canvas.width,y:b.top+300*b.height/canvas.height};});await page.mouse.move(point.x,point.y);
  const releaseCode=`const fs=require('fs'),c=require('./tools/native-supervisor-common.cjs');(async()=>{const ws=new WebSocket(${JSON.stringify(chrome.wsEndpoint())});await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});let id=0;const pending=new Map();ws.onmessage=m=>{const v=JSON.parse(m.data),p=pending.get(v.id);if(p){pending.delete(v.id);clearTimeout(p.t);v.error?p.j(Error(JSON.stringify(v.error))):p.r(v.result);}};const send=(method,params,sessionId)=>new Promise((r,j)=>{const n=++id,t=setTimeout(()=>j(Error('CDP timeout')),2000);pending.set(n,{r,j,t});ws.send(JSON.stringify({id:n,method,params,sessionId}));});const s=(await send('Target.attachToTarget',{targetId:${JSON.stringify(page.target()._targetId)},flatten:true})).sessionId;process.stdout.write('armed\\n');setTimeout(async()=>{let receipt;try{if(c.token(${target.pid})!==${JSON.stringify(target.startToken)})throw Error('identity');await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,x:${point.x},y:${point.y},clickCount:1},s);receipt={ackAt:Date.now()};}catch(e){receipt={error:String(e)};process.exitCode=1;}c.save(${JSON.stringify(out)},'mouse-up.json',receipt);ws.close();},2800);})().catch(e=>{console.error(e);process.exitCode=1;});`;
  const mouseChild=cp.spawn(process.execPath,['-e',releaseCode],{stdio:['ignore','pipe','pipe']});let mo='',me='';mouseChild.stdout.on('data',b=>mo+=b);mouseChild.stderr.on('data',b=>me+=b);const mouseWait=new Promise(r=>mouseChild.once('close',(code,signal)=>r({pid:mouseChild.pid,code,signal,actualWait:true,stdoutEOF:mouseChild.stdout.readableEnded,stderrEOF:mouseChild.stderr.readableEnded,stdout:mo,stderr:me})));
  await new Promise(r=>mouseChild.stdout.once('data',r));let mouse;
  try{await page.mouse.down();const until=Date.now()+2500;while(Date.now()<until){mouse=await sample();if(mouse.everMouse===128&&mouse.dispatched>up.dispatched)break;await c.sleep(25);}}finally{c.save(out,'mouse-release-wait.json',await mouseWait);}
  assert.equal(mouse.everMouse,128);assert(mouse.dispatched>up.dispatched);assert(c.readJSON(path.join(out,'mouse-up.json')).ackAt);await c.sleep(2200);const mouseUp=await sample();assert.equal(mouseUp.diMouse,0);c.save(out,'mouse-proof.json',{point,down:mouse,up:mouseUp,nativeUSERDispatch:true,directInputConsumed:true});
  await page.screenshot({path:path.join(out,'after.png')});
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
 // Original capture had only 873ms left: old admission checked now<expiry,
 // then sent DOWN. Reserve the unchanged 2500ms confirmation before effects.
 assert(14.127<15);assert.equal(h.reviewAdmission(14.127,15,p),false);
 assert.equal(h.reviewAdmission(12.5,15,p),false);
 assert.equal(h.reviewAdmission(12.499,15,p),true);
 assert.equal(h.reviewAdmission(NaN,15,p),false);
 assert.equal(h.durationAdmission(p,1000),false);assert.equal(h.durationAdmission(p,700),true);
 for(const ms of [Infinity,NaN,79,1001,300.5])assert.equal(h.durationAdmission(p,ms),false);
 assert.equal(h.reviewSeconds(p,'game'),15);
 const calibrated={...p,gameFreshnessSeconds:60,menuFreshnessSeconds:90};
 assert.equal(h.reviewSeconds(calibrated,'game'),60);assert.equal(h.reviewSeconds(calibrated,'menu'),90);
 assert.equal(h.reviewAdmission(20,60,p),true);
 for(const seconds of [Infinity,0,-1,61,1.5])assert.throws(()=>h.reviewSeconds({...p,gameFreshnessSeconds:seconds},'game'));
 assert.throws(()=>h.reviewSeconds({...p,menuFreshnessSeconds:91},'menu'));
 for(const edit of [p=>p.confirmationMs=Infinity,p=>p.fallbackMs=2500,p=>p.physicalUpMs=6000,p=>p.operationMs=7000]){const q={...p};edit(q);assert.throws(()=>h.policy(q));}
 const expected={owner:{owner:'owner',epoch:1},nonce:'nonce',deadline:2000,key:13,sentAt:1,hwnd:65537,threadId:1};
 const r={state:'CONSUMED',consumed:true,owner:'owner',epoch:1,nonce:'nonce',deadline:2000,consumedAt:1500,receiptBoundary:'native-input-return',nativeMessage:{consumption:'owner-user-return',nonce:'nonce',token:1,msg:256,wParam:13,hwnd:65537,threadId:1,apiKind:2,remove:true}};
 h.proof(r,expected);
 const mouse={...expected,key:undefined,pointer:{action:'mousedown',x:300,y:300}},mr=structuredClone(r);mr.nativeMessage.msg=0x201;h.proof(mr,mouse);
 for(const msg of [0x200,0x202,0x100]){const q=structuredClone(mr);q.nativeMessage.msg=msg;assert.throws(()=>h.proof(q,mouse));}
 for(const edit of [r=>r.state='UNKNOWN',r=>r.owner='foreign',r=>r.epoch++,r=>r.nonce='foreign',r=>r.deadline++,r=>r.consumedAt=2000,r=>r.receiptBoundary='host-handler',r=>r.nativeMessage.consumption='poll',r=>r.nativeMessage.hwnd++,r=>r.nativeMessage.threadId++,r=>r.nativeMessage.token=0,r=>r.nativeMessage.wParam=27,r=>r.nativeMessage.remove=false]){const q=structuredClone(r);edit(q);assert.throws(()=>h.proof(q,expected));}
 console.log('PASS finite policy and thirteen native receipt negatives');
}
module.exports={main,browser,unit};if(require.main===module)(process.argv[2]==='--unit'?unit():process.argv[2]==='--browser'?browser(process.argv[3]):main(process.argv[2],Number(process.argv[3]??800),Number(process.argv[4]??5000))).catch(e=>{console.error(e);process.exitCode=1;});
