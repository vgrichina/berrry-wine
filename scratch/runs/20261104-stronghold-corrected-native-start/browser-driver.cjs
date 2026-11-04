'use strict';
// One registered selector/Launch attempt, sequential acknowledged commands.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=process.cwd(),RUN=__dirname,OUT=path.join(RUN,'browser');
const {EvidenceBoundary}=require('./evidence-boundary.cjs');
const {NativeStartDriver,pageAdapter,guardNativeCommands,assertAck}=require('./native-start-boundary.cjs');
let nativeDriver,guarded;
const boundary=new EvidenceBoundary(OUT,path.join(RUN,'snapshots'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const save=(name,value)=>{const file=path.join(OUT,name);fs.writeFileSync(file+'.tmp',JSON.stringify(value,null,2)+'\n');fs.renameSync(file+'.tmp',file);};
const log=(name,value)=>fs.appendFileSync(path.join(OUT,name),JSON.stringify({at:new Date().toISOString(),...value})+'\n');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let browser,page,server,closing=false,halted=false,number=0,timer,deadline;
const sessions=new Map(),pending=[],held=new Set(),mouseHeld=new Set();
const preload=fs.readFileSync(path.join(RUN,'observe-browser.js'),'utf8');
async function state(){
  const main=await page.evaluate(()=>{
    const w=typeof wine==='undefined'?null:wine,r=typeof sharedRenderer==='undefined'?null:sharedRenderer;
    return {at:new Date().toISOString(),href:location.href,isolated:crossOriginIsolated,tick:typeof WineFrozen!=='undefined'?WineFrozen.status():null,threads:typeof WINE_THREADS==='undefined'?null:WINE_THREADS,
      running:w?.running,guestWorker:!!w?.guestWorker,threadBackend:w?.threadManager?.backend,frozen:window.WineFrozen?.status(),
      rendererState:r?{constructor:r.constructor.name,useWebGL:r.useWebGL,canvasMode:r.canvasMode}:null,observation:globalThis.__mdk2Observe,lastInput:w?._lastInputEvent,inputQueue:r?.inputQueue,activeInput:r?._activeInputEvent,mouseButtonsMask:r?._mouseButtonsMask,canvases:[...document.querySelectorAll("canvas")].map(c=>({id:c.id,rect:c.getBoundingClientRect().toJSON()})),
      windows:Object.values(r?.windows||{}).map(x=>({hwnd:x.hwnd,title:x.title,visible:x.visible,x:x.x,y:x.y,w:x.w,h:x.h})),
      log:document.getElementById('log')?.textContent?.slice(-7000)};
  });
  const workers=[];
  for(const [id,{session,info}] of sessions) {
    try {const v=await session.send('Runtime.evaluate',{expression:'JSON.stringify(globalThis.__mdk2Observe||null)',returnByValue:true});workers.push({id,info,observation:JSON.parse(v.result.value)});}
    catch(e){workers.push({id,info,error:String(e)});}
  }
  return {main,workers};
}
async function close(reason){
  if(closing)return;closing=true;clearTimeout(timer);
  try{if(page)save('final-state.json',await state());}catch(e){log('cleanup-errors.jsonl',{error:String(e)});}
  if(page){for(const key of held)await page.keyboard.up(key).catch(()=>{});for(const button of mouseHeld)await page.mouse.up({button}).catch(()=>{});}
  const child=browser?.process();
  if(browser)await browser.close().catch(e=>log('cleanup-errors.jsonl',{error:String(e)}));
  if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}
  await Promise.allSettled(pending);
  save('cleanup.json',{at:new Date().toISOString(),reason,chromePid:child?.pid,chromeExit:child?.exitCode,chromeSignal:child?.signalCode,boxLeftRunning:true});
}
async function freshShot(name){
  if(!/^[a-z0-9-]+$/.test(name)||fs.existsSync(path.join(OUT,name+'.png')))throw Error('fresh capture name required');
  const png=Buffer.from(await page.screenshot()),current=await state();
  fs.writeFileSync(path.join(OUT,name+'.png.tmp'),png);fs.renameSync(path.join(OUT,name+'.png.tmp'),path.join(OUT,name+'.png'));
  save(name+'.json',{sha256:sha(png),state:current});return {png,state:current};
}
async function personalReview(cap){
  const id=cap.sha256,request={sha256:id,scene:cap.scene,at:new Date().toISOString()};
  save('review-required.json',request);
  const file=path.join(RUN,'reviews',id+'.json');
  while(!fs.existsSync(file)) {if(closing||Date.now()>=deadline)throw Error('personal review deadline');await pause(150);}
  const receipt=JSON.parse(fs.readFileSync(file));
  if(receipt.personallyViewed!==true||receipt.sha256!==id||receipt.scene!==cap.scene||!receipt.observation)throw Error('explicit personal review required');
  log('personal-reviews.jsonl',receipt);return receipt;
}
async function command(c,i){
  if(c.action==='install-native'){
    if(nativeDriver)throw Error('guard already installed');
    const io=pageAdapter(page,state,freshShot,()=>({keys:[...held],buttons:[...mouseHeld]}));
    nativeDriver=new NativeStartDriver(io,{maxSteps:4096,review:personalReview});
    guarded=guardNativeCommands(nativeDriver,command);return {installed:true};
  }
  if(halted&&!['state','shot','keyup','mouseup','quit'].includes(c.action))throw Error('first failure preserved; no further steps or input');
  log('commands.jsonl',{i,...c});
  if(c.action==='quit')return close('operator handback');
  if(c.action==='state')return save(c.name+'.json',await state());
  if(c.action==='shot'){
    if(!/^[a-z0-9-]+$/.test(c.name)||fs.existsSync(path.join(OUT,c.name+'.png')))throw Error('fresh capture name required');
    const b=await page.screenshot();fs.writeFileSync(path.join(OUT,c.name+'.png'),b);return save(c.name+'.json',{sha256:sha(b),state:await state()});
  }
  if(c.action==='step'){
    if(!Number.isInteger(c.n)||c.n<1||c.n>64)throw Error('step count must be 1..64');
    const result=await page.evaluate(n=>WineFrozen.step(n),c.n);save('step-'+i+'.json',result);
    if(result.ran!==c.n||result.timedOut)throw Error('incomplete frozen step: '+JSON.stringify(result));return;
  }
  if(c.action==='tick'){
    if(![5,16,20].includes(c.ms))throw Error('ordinary clock bound');return save('tick-'+i+'.json',await page.evaluate(ms=>WineFrozen.setTickMs(ms),c.ms));
  }
  if(!c.reviewRef||!fs.existsSync(path.join(OUT,c.reviewRef+'.png')))throw Error('reviewed screenshot reference required');
  if(c.action==='keydown'||c.action==='keyup'){
    if(!['Enter','Escape','ArrowUp','ArrowDown','Space'].includes(c.key))throw Error('ordinary allowed keys only');
    if(c.action==='keydown'?held.has(c.key):!held.has(c.key))throw Error('unbalanced key');
    await page.keyboard[c.action==='keydown'?'down':'up'](c.key);
    c.action==='keydown'?held.add(c.key):held.delete(c.key);
    save('input-'+i+'.json',await state());return;
  }
  if(['mousemove','mousedown','mouseup'].includes(c.action)){
    if(c.action==='mousemove'){
      if(!Number.isInteger(c.x)||!Number.isInteger(c.y)||c.x<0||c.x>1200||c.y<0||c.y>900)throw Error('viewport bound');
      await page.mouse.move(c.x,c.y);
    }else{
      if(!['left','right'].includes(c.button))throw Error('original button only');
      if(c.action==='mousedown'?mouseHeld.has(c.button):!mouseHeld.has(c.button))throw Error('unbalanced mouse');
      await page.mouse[c.action==='mousedown'?'down':'up']({button:c.button});
      c.action==='mousedown'?mouseHeld.add(c.button):mouseHeld.delete(c.button);
    }
    save('input-'+i+'.json',await state());return;
  }
  if(c.action==='click'){
    if(!Number.isInteger(c.x)||!Number.isInteger(c.y)||c.x<0||c.x>1200||c.y<0||c.y>900)throw Error('viewport bound');
    await page.mouse.click(c.x,c.y);save('input-'+i+'.json',await state());return;
  }
  throw Error('unsupported action');
}
let gameplayNumber=0;
async function guardedGesture(c,i){
  const cap=await nativeDriver.requireWorld();await personalReview(cap);
  const fresh=await nativeDriver.capture();if(sha(fresh.png)!==cap.sha256)throw Error('stale ordinary capture review');
  let used=0;
  const advance=async()=>{if((used+=64)>4096)throw Error('ordinary drainage budget');const before=(await state()).main.tick.steps;const ack=await page.evaluate(n=>WineFrozen.step(n),64);assertAck(ack,before,64);save('gameplay-step-'+gameplayNumber++ +'.json',ack);};
  const drain=async()=>{await advance();for(;;){const m=(await state()).main;if(!m.activeInput&&!m.lastInput&&!m.inputQueue?.length)return;await advance();}};
  const reviewRef='ordinary-reviewed-'+i;await freshShot(reviewRef);
  if(c.key){await command({action:'keydown',key:c.key,reviewRef},i);await drain();await command({action:'keyup',key:c.key,reviewRef},i);await drain();}
  else{await command({action:'mousemove',x:c.x,y:c.y,reviewRef},i);await drain();await command({action:'mousedown',button:c.button||'left',reviewRef},i);await drain();await command({action:'mouseup',button:c.button||'left',reviewRef},i);await drain();}
  return {steps:used,reviewSHA256:cap.sha256};
}
async function dispatch(c,i){
  if(c.action==='gesture')return boundary.run(async()=>{try {if(!nativeDriver)throw Error('world controls locked');return await guardedGesture(c,i);}catch(e){if(nativeDriver)nativeDriver.phase='failed';throw e;}});
  if(nativeDriver&&['click','mousemove','mousedown','mouseup','keydown','keyup'].includes(c.action))return boundary.run(()=>{throw Error('post-entry controls require reviewed balanced gesture');});
  if(c.action==='quit')return boundary.close(()=>command(c,i));
  if(c.action==='snapshot'){
    const receipt=await boundary.snapshot(c.name,async()=>{
      if(closing||held.size||mouseHeld.size)throw Error('snapshot requires balanced live controls');
      await Promise.all(pending);
      const current=await state();
      if(current.main.activeInput||current.main.inputQueue?.length||current.main.mouseButtonsMask)throw Error('snapshot requires drained input');
      log('commands.jsonl',{i,...c});
      save('snapshot-boundary-'+c.name+'.json',{i,state:current,ackThrough:i-1});
    });
    save('snapshot-receipt-'+c.name+'.json',receipt);return;
  }
  return boundary.run(()=>guarded?guarded(c,i):command(c,i));
}
async function main(){
  const release=JSON.parse(fs.readFileSync(path.join(RUN,'runtime-release.json')));
  if(release.authorization!=='stronghold-corrected-native-start user task'||release.shutdownOwner!=='coordinator'||!release.boxId||Date.parse(release.expiry)<Date.now()+600000)throw Error('fresh authorized finite TTL required');
  if(fs.existsSync(OUT))throw Error('one original launch only');fs.mkdirSync(OUT);fs.mkdirSync(path.join(OUT,'commands'));
  const pins=JSON.parse(fs.readFileSync(path.join(RUN,'runtime-pins.json')));
  for(const item of pins.files)if(sha(fs.readFileSync(path.join(ROOT,item.path)))!==item.sha256)throw Error('runtime pin mismatch '+item.path);
  const puppeteer=require('puppeteer');
  server=await require(path.join(ROOT,'test/static-server.js')).startStaticServer({root:ROOT,port:0,crossOriginIsolated:true,
    handleRequest:(req,res)=>{res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');return false;},
    headers:(req,resolved)=>{const relative=path.relative(ROOT,resolved.file),hash=sha(fs.readFileSync(resolved.file)),expected=pins.files.find(p=>p.path===relative)?.sha256;
      log('served.jsonl',{url:req.url,path:relative,sha256:hash,expected:expected||null,match:hash===expected});
      if(!expected||hash!==expected){halted=true;throw Error('unsealed HTTP file '+relative);}return {};}});
  browser=await puppeteer.launch({headless:false,executablePath:'/usr/bin/google-chrome',userDataDir:path.join(RUN,'chrome-profile'),
    args:['--no-sandbox','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--disable-background-networking'],protocolTimeout:60000,timeout:30000});
  page=await browser.newPage();await page.setViewport({width:1200,height:900});await page.setCacheEnabled(false);
  const cdp=await page.createCDPSession();
  cdp.on('Target.attachedToTarget',event=>{
    const session=cdp.connection().session(event.sessionId);
    if(event.targetInfo.type!=='worker'){
      pending.push(session.send('Runtime.runIfWaitingForDebugger').then(()=>log('nonworker-resumed.jsonl',{info:event.targetInfo,observerSkipped:true})));return;
    }
    sessions.set(event.targetInfo.targetId,{session,info:event.targetInfo});
    pending.push((async()=>{
      await session.send('Runtime.enable');
      const result=await session.send('Runtime.evaluate',{expression:preload});
      if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));
      log('worker-preloads.jsonl',{id:event.targetInfo.targetId,url:event.targetInfo.url,preloadSHA256:sha(preload),waitingForDebuggerAtAttach:event.waitingForDebugger,resumeIssuedAfterInjection:true});
      await session.send('Runtime.runIfWaitingForDebugger');
    })().catch(e=>{halted=true;log('first-failures.jsonl',{phase:'worker preload',error:String(e)});}));
  });
  await cdp.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true});
  await page.evaluateOnNewDocument(preload);
  page.on('console',m=>log('console.jsonl',{type:m.type(),text:m.text().slice(0,12000)}));
  page.on('pageerror',e=>{halted=true;log('first-failures.jsonl',{phase:'pageerror',error:String(e)});});
  page.on('response',r=>log('http.jsonl',{url:r.url(),status:r.status(),headers:r.headers(),cache:r.fromCache()}));
  deadline=Math.min(Date.now()+720000,Date.parse('2026-11-04T06:06:00Z'));save('orderly-quit-checkpoint.json',{quitBy:new Date(deadline-300000).toISOString(),recoveryReserveMs:300000});timer=setTimeout(()=>boundary.close(()=>close('bounded browser deadline')),Math.max(0,deadline-Date.now()));
  const url='http://127.0.0.1:'+server.address().port+'/index.html?debug&candidates&frozen';
  save('identity.json',{at:new Date().toISOString(),url,deadline:new Date(deadline).toISOString(),release,commit:pins.commit,chromeVersion:await browser.version(),chromePid:browser.process().pid,chromeArgs:browser.process().spawnargs,preloadSHA256:sha(preload)});
  await page.goto(url,{waitUntil:'load',timeout:45000});
  await page.waitForFunction(()=>typeof launchApp==='function'&&apps.stronghold_crusader_demo,{timeout:20000});
  await page.select('#app-select','stronghold_crusader_demo');
  if(!await page.evaluate(()=>document.querySelector('#app-select').value==='stronghold_crusader_demo'))throw Error('registered Stronghold selection missing; no launch issued');
  save('selector.json',await page.evaluate(()=>({app:document.querySelector('#app-select').value,registry:apps.stronghold_crusader_demo,renderer:WineD3D.renderer,isolated:crossOriginIsolated,frozen:WineFrozen.status()})));
  await page.screenshot({path:path.join(OUT,'selector-before-launch.png')});
  if(!await page.evaluate(()=>crossOriginIsolated))throw Error('browser isolation missing');
  await page.click('button[onclick="launchApp()"]');
  await page.waitForFunction(()=>typeof wine!=='undefined'&&wine?.running&&WineFrozen.status().hosts>0,{timeout:60000});
  save('ready.json',await state());console.log('Stronghold ordinary browser launch ready');
  while(!closing&&Date.now()<deadline){
    const file=path.join(OUT,'commands',number+'.json');
    if(!fs.existsSync(file)){await pause(150);continue;}
    const i=number++;
    try{const c=JSON.parse(fs.readFileSync(file));const result=await dispatch(c,i);save('reply-'+i+'.json',{i,ok:true,result,at:new Date().toISOString()});}
    catch(e){halted=true;save('reply-'+i+'.json',{i,ok:false,error:String(e),at:new Date().toISOString()});log('first-failures.jsonl',{phase:'command',i,error:String(e)});}
  }
  if(!closing)await boundary.close(()=>close('bounded browser deadline'));
  await boundary.snapshot('closed');
}
main().catch(async e=>{if(!fs.existsSync(OUT))fs.mkdirSync(OUT,{recursive:true});save('bootstrap-failure.json',{error:e.stack||String(e)});await close('first concrete bootstrap failure');process.exitCode=1;});
