'use strict';
// Actual Chrome screenshot/Worker byte recovery/trusted CDP mouse events.
// The static menu is an authored transport fixture, not original game evidence
// or a second GPS producer qualification. GPS is qualified independently.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createChain,sha}=require('../tools/mcm-bound-input.cjs');
const {CAPABILITY,createImageSink}=require('../tools/mcm-menu-reviewed-context.cjs');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const out=process.env.MCM_CONTEXT_EVIDENCE;
const report={startedAt:new Date().toISOString(),route:'authored static MENU / actual Chrome Worker and trusted mouse',controls:[]};
const tmp=fs.mkdtempSync('/dev/shm/mcm-context-native-');
let browser,server,floorClosed=false,guard,minimum=Infinity;
const floor=()=>{const s=fs.statfsSync('/home'),free=s.bavail*s.bsize;minimum=Math.min(minimum,free);
  if(free<=1500000000)floorClosed=true;assert(!floorClosed,'permanent native scope floor closure');};
async function run(){
  floor();
  const bytes=Buffer.from('0061736d01000000','hex');
  const html=`<!doctype html><style>body{margin:0;background:#123;color:white}canvas{display:block}</style><canvas id="screen" width="400" height="300"></canvas><script>
  const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');
  function paint(){ctx.fillStyle='#123';ctx.fillRect(0,0,400,300);ctx.fillStyle='white';ctx.font='24px sans-serif';ctx.fillText('MENU — Start',130,150);}paint();
  const worker=new Worker('/fixture-worker.js');
  const instance={nativeInstance:{}},win={hwnd:119,wasm:instance,processId:8181,visible:true,isChild:false,zOrder:1,x:0,y:0,w:400,h:300,style:0x90000000};
  const link={endpointIdentity:7,slot:0,worker,module:{}};
  const wine={running:true,processId:8181,instance,memory:{},renderer:{windows:{119:win},peekKeyDownState:()=>null,getActiveModalWindow:()=>null},guestWorker:{link},threadManager:{mainInstance:instance},
   prepareD3dimGpsPublicationObservation:async function(){return this._d3dimGpsObservation={state:'PREPARED',endpoint:null};}};
  globalThis.runningApps=[{name:'mcm',wine}];globalThis.edges=[];
  canvas.addEventListener('mousedown',e=>edges.push({type:'DOWN',trusted:e.isTrusted,x:e.offsetX,y:e.offsetY,at:Date.now()}));
  canvas.addEventListener('mouseup',e=>edges.push({type:'UP',trusted:e.isTrusted,at:Date.now()}));
  </script>`;
  server=await require('./static-server').startStaticServer({root:path.resolve(__dirname,'..'),crossOriginIsolated:true,
    handleRequest(req,res){res.writeHead(200,{'Content-Type':req.url==='/fixture-worker.js'?'text/javascript':'text/html'});
      res.end(req.url==='/fixture-worker.js'?`let endpointIdentity=7,workerSlot=0,instance;setTimeout(()=>WebAssembly.instantiate(Uint8Array.from(${JSON.stringify([...bytes])})).then(r=>{instance=r.instance;postMessage('ready');}),200);`:html);return true;}});
  browser=await require('puppeteer').launch({executablePath:'/usr/bin/google-chrome',headless:true,userDataDir:tmp+'/profile',args:['--no-sandbox','--no-first-run'],protocolTimeout:10000});
  report.chromePid=browser.process().pid;
  guard=setInterval(()=>{try{floor();}catch{browser.process().kill('SIGTERM');}},100);
  const page=await browser.newPage();await page.setViewport({width:400,height:300,deviceScaleFactor:1});
  const client=await page.createCDPSession(),workers=new Map(),jobs=[];
  page.on('workercreated',w=>{const c=w.client,record={sessionId:c.id(),targetId:w.url(),url:'guest-worker.js',scripts:[]};workers.set(record.sessionId,record);
    c.on('Debugger.scriptParsed',e=>{if(e.scriptLanguage==='WebAssembly'){
      const s={scriptId:e.scriptId};record.scripts.push(s);jobs.push(c.send('Debugger.getScriptSource',{scriptId:e.scriptId}).then(r=>{
        const b=Buffer.from(r.bytecode,'base64');assert(b.equals(bytes));Object.assign(s,{bytecodeAvailable:true,sha256:sha(b)});
        record.bytecode=r;report.workerModule={sha256:sha(b),bytes:b.length,recoveredOnce:true};}));}});
    record.client=c;jobs.push(c.send('Debugger.enable'));jobs.push(c.send('Target.getTargetInfo').then(r=>record.targetId=r.targetInfo.targetId));
  });
  await page.goto('http://127.0.0.1:'+server.address().port+'/');
  await page.waitForFunction(()=>runningApps.length===1);
  const until=Date.now()+5000;while(![...workers.values()].some(w=>w.bytecode)&&Date.now()<until)await wait(20);
  await Promise.all(jobs);assert.equal(workers.size,1);assert(report.workerModule);
  let count=0,downCount=0,closeOnDown=false,sinkFail=null,cancelAtFinal=false,cancelled=false,delayFresh=false,changeAfterFresh=false;
  const cancelledGate=()=>{floor();assert(!cancelled,'cancelled');};
  function chain(explicit=true){
    let shotCount=0;
    const folder=out?path.join(out,'case-'+(++count)):path.join(tmp,'case-'+(++count));fs.mkdirSync(folder,{recursive:true});
    const sink=createImageSink(folder);
    const c=createChain({pageSession:'page',workers,gpsSourcePreparation:true,
      evaluate:(expression,session)=>{floor();const w=workers.get(session);return w?w.client.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true}).then(r=>{if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}):page.evaluate(s=>eval(s),expression);},
      send:(method,params,session)=>{
        floor();if(method==='Debugger.getScriptSource')return workers.get(session).bytecode;
        if(method==='Page.captureScreenshot'){
          const n=++shotCount;
          return client.send(method,params).then(async r=>{
            if(n===3&&delayFresh)await wait(5010);
            if(n===3&&changeAfterFresh)await page.evaluate(()=>{const c=document.querySelector('canvas').getContext('2d');c.fillStyle='red';c.fillRect(0,0,1,1);});
            return r;
          });
        }
        if(method==='Input.dispatchMouseEvent'&&params.type==='mousePressed'){downCount++;
          const result=client.send(method,params);if(closeOnDown)result.then(()=>page.close()).catch(()=>{});return result;}
        return client.send(method,params);
      },...(explicit?{reviewedMenuContext:{capability:CAPABILITY,checkpoint:cancelledGate,evidenceSink:r=>{
        if(r.stage===sinkFail)throw Error('sink refusal');const ok=sink(r);if(r.stage==='final'&&cancelAtFinal)cancelled=true;return ok;}}}:{})});
    return c;
  }
  async function prepare(c){
    await page.evaluate(()=>{delete runningApps[0].wine._d3dimGpsObservation;});
    const s=await c.capture('preparation');await c.armMenuSource({...s.capture,stage:'menu-before-start',review:'Authored static MENU fixture reviewed'});
    return c.captureMenuContext();
  }
  const startIntent=image=>({capability:CAPABILITY,mode:'MENU',action:'Start',kind:'mouse',button:'left',holdMs:100,
    x:200,y:150,nonce:'one-start',imageSHA256:image.sha256,reviewedAt:Date.now(),review:'I reviewed the complete authored MENU and exact Start at 200,150'});
  const c=chain(),source=await prepare(c),direct=chain(false),directShot=await direct.capture('identical-static-menu');
  assert.equal(source.sha256,directShot.capture.sha256);
  await wait(12500);floor();
  const before=downCount;
  await assert.rejects(direct.admit({...directShot.capture,review:'Complete static MENU'},()=>{downCount++;}),/stale/);
  assert.equal(downCount,before);report.controls.push({name:'unchanged direct12s refusal',actualAgeMs:Date.now()-Date.parse(directShot.capture.at),zeroDown:true,identicalStaticPNG:source.sha256});
  const intent=startIntent(source),handle=c.reviewMenuContext(intent);
  const acceptance=await c.startMenuContext(handle,intent);const edges=await page.evaluate(()=>edges);
  assert.deepEqual(edges.map(e=>e.type),['DOWN','UP']);assert(edges.every(e=>e.trusted));
  report.controls.push({name:'explicit context accepts identical static MENU after12s',acceptance,edges});
  const beforeReplay=downCount;await assert.rejects(c.startMenuContext(handle,intent),/one-use/);assert.equal(downCount,beforeReplay);
  report.controls.push({name:'actual successful Start cannot replay',zeroAdditionalDown:true});
  for(const kind of ['pixel','final-pixel','generation','process','endpoint','epoch','viewport','module','preparation','sink','cancel','fresh-clock']){
    cancelled=false;sinkFail=null;cancelAtFinal=false;
    const a=chain(),image=await prepare(a),i=startIntent(image),h=a.reviewMenuContext(i);const old=downCount;
    if(kind==='pixel')await page.evaluate(()=>{const c=document.querySelector('canvas').getContext('2d');c.fillStyle='red';c.fillRect(0,0,1,1);});
    if(kind==='generation')await page.evaluate(()=>{const r=runningApps[0].wine.renderer;r.windows[119]={...r.windows[119]};});
    if(kind==='process')await page.evaluate(()=>runningApps[0].wine.processId++);
    if(kind==='endpoint')await page.evaluate(()=>runningApps[0].wine.guestWorker.link={...runningApps[0].wine.guestWorker.link});
    if(kind==='epoch')await page.evaluate(()=>{globalThis.__mcmPassiveIdentityV1.epoch+='new';});
    if(kind==='viewport')await page.setViewport({width:401,height:300});
    if(kind==='module')await page.evaluate(()=>runningApps[0].wine.guestWorker.link.module={});
    if(kind==='preparation')await page.evaluate(()=>runningApps[0].wine._d3dimGpsObservation={state:'PREPARED',endpoint:null});
    if(kind==='final-pixel')changeAfterFresh=true;
    if(kind==='fresh-clock')delayFresh=true;
    if(kind==='sink')sinkFail='final';if(kind==='cancel')cancelAtFinal=true;
    await assert.rejects(a.startMenuContext(h,i));assert.equal(downCount,old);assert(a.closed);
    report.controls.push({name:kind+' actual-browser refusal',zeroDown:true});
    cancelled=false;sinkFail=null;cancelAtFinal=false;delayFresh=false;changeAfterFresh=false;
    if(kind==='pixel'||kind==='final-pixel')await page.evaluate(()=>paint());
    if(kind==='process')await page.evaluate(()=>runningApps[0].wine.processId--);
    if(kind==='viewport')await page.setViewport({width:400,height:300});
  }
  const aged=chain(),agedSource=await prepare(aged),agedIntent=startIntent(agedSource),agedHandle=aged.reviewMenuContext(agedIntent);
  const oldSource=chain(),oldImage=await prepare(oldSource);
  await wait(15010);const beforeClock=downCount;
  await assert.rejects(aged.startMenuContext(agedHandle,agedIntent),/clock/);assert.equal(downCount,beforeClock);
  report.controls.push({name:'actual 15s review expiry',ageMs:Date.now()-agedIntent.reviewedAt,zeroDown:true});
  await wait(Math.max(0,oldImage.at+30005-Date.now()));
  assert.throws(()=>oldSource.reviewMenuContext(startIntent(oldImage)),/clock/);assert.equal(downCount,beforeClock);
  report.controls.push({name:'actual 30s source expiry cannot be renewed by review',ageMs:Date.now()-oldImage.at,zeroDown:true});
  const up=chain(),upSource=await prepare(up),upIntent=startIntent(upSource),upHandle=up.reviewMenuContext(upIntent);
  closeOnDown=true;await assert.rejects(up.startMenuContext(upHandle,upIntent));assert(up.closed);
  const last=downCount;await assert.rejects(up.startMenuContext(upHandle,upIntent),/idle MENU/);assert.equal(downCount,last);
  report.controls.push({name:'physical UP endpoint retirement closes scope',downSent:true,upQualified:false,noReplay:true});
}
run().catch(e=>{report.error=e.stack;process.exitCode=1;}).finally(async()=>{
  clearInterval(guard);if(browser)await browser.close();if(server)await require('./static-server').closeServer(server);
  report.minimumFreeBytes=minimum;report.floorClosed=floorClosed;report.pidAbsent=report.chromePid?!fs.existsSync('/proc/'+report.chromePid):null;
  fs.rmSync(tmp,{recursive:true,force:true});report.profileAbsent=!fs.existsSync(tmp);report.finishedAt=new Date().toISOString();
  if(out)fs.writeFileSync(path.join(out,'native.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
});
