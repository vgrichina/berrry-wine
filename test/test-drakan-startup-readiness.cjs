'use strict';
const fs=require('node:fs'),path=require('node:path'),net=require('node:net'),assert=require('node:assert/strict');
const c=require('../tools/native-supervisor-common.cjs');
async function main(out){
 out=path.resolve(out);fs.mkdirSync(out,{recursive:true});const a=require('../tools/drakan-authentic-reviewed.cjs');a.R=out;
 const exe=path.join(out,'authored.exe');fs.writeFileSync(exe,require('../tools/drakan-startup-readiness.cjs').fixture(),{flag:'wx'});
 const prep=require('../tools/blood2-immutable-preparation.cjs');
 const rows=prep.collect([],{revision:'6308e7a3be6c98ab150d07c2f178d8cd09f4b2e6',media:[{path:path.relative(path.resolve(__dirname,'..'),exe),size:fs.statSync(exe).size,sha256:c.sha256(fs.readFileSync(exe))}]});
 for(const file of ['lib/renderer-input.js','lib/cli-native-scene.js']){const b=fs.readFileSync(path.resolve(__dirname,'..',file));Object.assign(rows.find(r=>r.path===file),{sha256:c.sha256(b),body:b.toString('base64')});}
 const frozen=prep.freeze(rows,fs.readFileSync(process.env.DRAKAN_TEST_MODULE));
 const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});a.URL='http://127.0.0.1:'+port+'/ctl';
 Object.assign(process.env,{DRAKAN_CONTROL_OUT:out,DRAKAN_CONTROL_URL:a.URL});
 const at=c.now(),deadline=at+240;a.save('launch.json',{at,deadline,gameplayCutoff:deadline-180,reserveSeconds:180,startupReadinessSeconds:15,nativeScene:true,bindingContract:'native-reviewed-context-v1',inputPolicy:{confirmationMs:500,physicalUpMs:1750,observationMs:3000,gameFreshnessSeconds:15,menuFreshnessSeconds:30}});
 require('../tools/blood2-durable-launcher.cjs').launch({run:out,command:[process.execPath,'test/run.js','--exe='+exe,'--no-build','--threads','--real-ticks','--screen=1024x712','--control='+port,'--max-seconds=35','--max-batches=100000000','--stuck-after=0','--quiet-api','--quiet-blocks','--no-close'],env:frozen.env,fds:frozen.fds,deadline:at+40,cleanupDeadline:at+55});frozen.close();
 try{
  const end=c.now()+15;for(;;){try{const s=await a.call({action:'snapshot'},.5);if(s.nativeMessageBox&&s.physicalUp)break;}catch{}assert(c.now()<end);await c.sleep(25);}
  await a.capture('warning');const first=a.read('warning.json');assert.equal(first.snapshot.mainHwnd,'0x0');assert.equal(first.snapshot.nativeMessageBox.controlClass,16);
  const old=process.env.DRAKAN_STARTUP_OLD==='1';
  let failure=null;
  try{await a.submit({review:'warning',bind:true,name:'enter',key:13,ms:300,scene:'menu',startup:!old,observation:'Authored warning to 4500ms native initialization then ordinary main ShowWindow'});}catch(e){failure=String(e);}
  assert.equal(a.read('enter-up.json').state,'ACK');assert(a.read('enter-down.json')[0].consumed);
  if(old){
   assert.match(failure,/3000ms/);assert(fs.existsSync(path.join(out,'terminal-input-failure.json')));
   assert(!fs.existsSync(path.join(out,'enter.png')));
   a.save('assertions.json',{pass:true,expectedOldFailure:true,consumed:true,independentUP:true,closedWithoutLaterEndpoint:true});
  }else{
   assert.equal(failure,null);const done=a.read('enter-input-complete.json');assert(done.at<done.deadline);
   assert(!fs.existsSync(path.join(out,'enter.png')),'input completion allocates no capture');
   const ready=await require('../tools/drakan-startup-readiness.cjs').wait('enter');
   const {identity}=require('../tools/drakan-startup-readiness.cjs');
   for(const edit of [r=>r.snapshot.nativeProcess.pid++,r=>r.snapshot.screen.w++,r=>r.ordinaryOwner.threadId++,
    r=>r.ordinaryOwner.processId++,r=>r.snapshot.physicalUp=false,r=>r.snapshot.capture='0x1',
    r=>r.failures.push('focus.live'),r=>r.ordinaryOwner.healthy=false,r=>r.ordinaryOwner.actorContext=false]){
    const changed=structuredClone(ready);edit(changed);assert.throws(()=>identity(changed,done));
   }
   assert(ready.snapshot.focusWindow.live);assert.equal(ready.snapshot.focus,ready.snapshot.mainHwnd);
   await a.capture('main');
   const samples=fs.readFileSync(path.join(out,'enter-startup.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
   assert(samples.some(r=>!r.reply.ready));assert(samples.at(-1).reply.ready);
   assert(samples.at(-1).at>a.read('enter-operation.json').deadline,'readiness is after original input deadline');
   a.save('assertions.json',{pass:true,oldOperationDeadlinePreserved:true,passiveSeparatePhase:true,realNativeMainShow:true,correctActor:ready.ordinaryOwner,consumed:true,independentUP:true,samples:samples.length});
  }
 }finally{
  if(!fs.existsSync(path.join(out,'native-wait.json')))a.save('cancel-request.json',{fixtureOnly:true});
  const end=c.now()+15;while(!fs.existsSync(path.join(out,'owner-complete.json'))){assert(c.now()<end);await c.sleep(25);}
  assert(a.read('owner-complete.json').retainedActualWaits);assert.equal(a.read('owner-complete.json').receipt.leaked,false);
 }
}
async function browser(out){
 out=path.resolve(out);fs.mkdirSync(out,{recursive:true});
 const cp=require('node:child_process'),moduleBytes=fs.readFileSync(process.env.DRAKAN_TEST_MODULE),exe=require('../tools/drakan-startup-readiness.cjs').fixture();
 const base='6308e7a3be6c98ab150d07c2f178d8cd09f4b2e6';
 const rows=require('../tools/blood2-immutable-preparation.cjs').collect([],{revision:base});
 const files=new Map(rows.map(r=>[r.path,Buffer.from(r.body,'base64')]));
 const reads=[],logs=[];let chrome,server;
 try{
  server=await require('./static-server').startStaticServer({root:path.resolve(__dirname,'..'),crossOriginIsolated:true,handleRequest(req,res){
   let p=new URL(req.url,'http://local').pathname.slice(1)||'index.html';
   let b=p==='build/wine-assembly.wasm'?moduleBytes:p==='fixture.exe'?exe:files.get(p);
   if(!b){try{b=cp.execFileSync('git',['show',base+':'+p],{maxBuffer:4e6,stdio:['ignore','pipe','ignore']});files.set(p,b);}catch{res.writeHead(404);res.end();return true;}}
   reads.push({path:p,sha256:c.sha256(b),size:b.length});res.writeHead(200,{'Content-Type':require('./static-server').mimeType(p)});res.end(b);return true;
  }});
  chrome=await require('puppeteer').launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage'],protocolTimeout:20000});
  const page=await chrome.newPage();page.on('console',m=>logs.push(m.text()));page.on('pageerror',e=>logs.push(String(e)));
  await page.evaluateOnNewDocument(()=>localStorage.setItem('wine-assembly.threads','1'));
  await page.goto('http://127.0.0.1:'+server.address().port+'/?debug&no-log&force-threads');
  await page.waitForFunction(()=>window.wineShell&&window.wineApps,{timeout:15000});
  await page.evaluate(async()=>{window.WINE_THREADS=true;wineApps.APPS.authored_drakan={name:'Authored Drakan transition',exe:'fixture.exe',dlls:[],files:[],threads:true};await wineShell.launchApp('authored_drakan');});
  const sample=()=>page.evaluate(async()=>{const w=wineShell.runningApps.find(a=>a?.name==='authored_drakan')?.wine;if(!w?.guestWorker)return {unavailable:true};
   return {at:Date.now(),actor:await w.guestWorker.readExports(['get_process_id','get_current_thread_id','get_eip','get_esp','get_focus_hwnd','get_main_hwnd','modal_dialog_hwnd','get_yield_reason']),shadowFocus:w.instance.exports.get_focus_hwnd(),windows:Object.values(w.renderer.windows).map(v=>({hwnd:v.hwnd,visible:v.visible,title:v.title,style:w.instance.exports.wnd_get_style_export(v.hwnd)}))};});
  const samples=[];let warning,end=c.now()+12;
  while(c.now()<end){const r=await sample();samples.push(r);if(r.actor?.modal_dialog_hwnd){warning=r;break;}await c.sleep(25);}assert(warning,'real browser warning required');
  await page.keyboard.down('Enter');await c.sleep(300);await page.keyboard.up('Enter');
  end=c.now()+15;let ready;
  while(c.now()<end){const r=await sample();samples.push(r);if(r.actor?.get_main_hwnd&&r.actor.get_focus_hwnd===r.actor.get_main_hwnd){ready=r;break;}await c.sleep(100);}
  c.save(out,'browser-proof.json',{pass:!!ready,browser:await chrome.version(),moduleSHA256:c.sha256(moduleBytes),base,samples,reads,logs});
  assert(ready,'ordinary browser Worker must finish delayed ShowWindow');assert.equal(ready.actor.get_current_thread_id,1);
  assert.notEqual(ready.actor.get_focus_hwnd,ready.shadowFocus,'actual owner differs from idle observer');
  assert(ready.at-warning.at>4500);assert(ready.windows.some(w=>(w.style&0x10000000)!==0));
  await page.screenshot({path:path.join(out,'authored-main.png')});
 }finally{if(chrome)await chrome.close();if(server)await require('./static-server').closeServer(server);}
}
module.exports={main,browser};if(require.main===module)(process.argv[2]==='--browser'?browser(process.argv[3]):main(process.argv[2])).catch(e=>{console.error(e);process.exitCode=1;});
