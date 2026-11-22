'use strict';
// Real child + loopback CDP protocol fixture. No original, browser or GPU claim.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),cp=require('node:child_process'),{once}=require('node:events');
const controller=require('../tools/gltron-browser-controller.cjs');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const now=Date.now(),launch={at:now/1000,deadline:now/1000+900},cmd={mode:'play',keys:['a'],ms:400,liveCycle:true,observation:'personally reviewed intact yellow player1 cycle and clear forward path'};
assert.equal(controller.policy(cmd,launch,false,now),5000);
assert.throws(()=>controller.policy({...cmd,keys:['a','s']},launch,false,now));
assert.throws(()=>controller.policy({...cmd,keys:['Control','Enter']},launch,false,now));
assert.equal(controller.policy({...cmd,mode:'menu',keys:['Enter']},launch,false,now),30000);
assert.equal(controller.policy({...cmd,mode:'quit',keys:['Enter'],route:'select-quit',selectedQuit:'Quit'},launch,true,now),30000);
for(const patch of [{ms:0},{ms:49},{ms:1501},{ms:2001},{ms:NaN},{ms:100.5},{keys:['Cheat']},{keys:['ArrowUp','ArrowUp']},{observation:''},{liveCycle:false},{mode:'quit',route:''},{mode:'menu',keys:['Control']}])assert.throws(()=>controller.policy({...cmd,...patch},launch,false,now));
assert.throws(()=>controller.policy(cmd,launch,true,now));
assert.equal(controller.gameplayCutoff(launch),(launch.deadline-180)*1000);
assert.throws(()=>controller.policy(cmd,launch,false,now+717001));
assert.throws(()=>controller.policy({...cmd,mode:'quit',keys:['Enter'],route:'select-quit'},launch,true,now));
assert.throws(()=>controller.policy({...cmd,mode:'quit',keys:['Escape'],route:'open-menu'},launch,true,now+900001));
{
 const b=require('../'+controller.HELPER),owner=Object.fromEntries(b.HOST_FIELDS.map(k=>[k,'owner:'+k]));
 Object.assign(owner,{name:'gltron',running:true,stopped:false,guestWorker:true,outputVisible:false});
 const live={page:{isolated:true,apps:[owner]},wrap:'wrap',fullscreen:null,viewport:{width:1024,height:900,scale:1},strip:{object:'strip',visible:true,text:'App is using the full page'},button:{object:'button',label:'Use browser fullscreen',box:{x:400,y:0,width:180,height:34},x:490,y:17,enabled:true,visible:true,hit:true,contained:true}};
 const scene={at:now,sha256:'png-sha',observation:structuredClone(live)},review={sha256:'png-sha',observation:'personally reviewed full host strip and button',hostOnly:true};
 assert.deepEqual(b.reviewHostBootstrap(scene,review,live,now),{x:490,y:17});
 for(const patch of [{hit:false},{visible:false},{enabled:false},{contained:false},{label:'Quit'},{object:'replacement'},{x:491}]){
  const changed=structuredClone(live);Object.assign(changed.button,patch);assert.throws(()=>b.reviewHostBootstrap(scene,review,changed,now));
 }
 for(const patch of [{fullscreen:'wrap'},{viewport:{width:1200,height:900,scale:1}},{strip:{...live.strip,object:'replacement'}}])assert.throws(()=>b.reviewHostBootstrap(scene,review,{...live,...patch},now));
 assert.throws(()=>b.reviewHostBootstrap(scene,review,live,now+30000));
 assert.throws(()=>b.reviewHostBootstrap(scene,{...review,hostOnly:false},live,now));
 const changed=structuredClone(live);changed.page.apps[0].processObject='replacement';assert.throws(()=>b.reviewHostBootstrap(scene,review,changed,now));
}
class RendererProbe{constructor(){this.inputQueue=[];this.windows={};this._exited=false;}}
{
 const vm=require('node:vm'),renderer={peekKeyDownState:()=>0},canvas={},link={endpointIdentity:'guest-1',slot:0,worker:{},module:{}},legacy={id:1,options:{api:'legacy'}},gl={id:2,options:{api:'gl'}};
 const wine={running:true,processId:1000,renderer,guestWorker:{link,d3dStats:{renderEndpointId:1}},_renderWorkerManager:{worker:{},ports:new Map([[1,legacy],[2,gl]])}};
 const context=vm.createContext({crypto,crossOriginIsolated:true,document:{getElementById:()=>canvas},runningApps:[{name:'gltron',wine}]});
 const result=vm.runInContext(require('../'+controller.HELPER).PAGE_READ,context);
 assert.equal(result.apps[0].renderEndpoint,2,'bind the actual GL port even alongside a legacy executor');
 wine._renderWorkerManager.ports.set(3,{id:3,options:{api:'gl'}});
 assert.throws(()=>vm.runInContext(require('../'+controller.HELPER).PAGE_READ,context),/ambiguous actual GL/);
}
// The passive observer must preserve authentic operations and never draw/read
// on its own. Exercise the exact browser injection before any original launch.
{
 const vm=require('node:vm');let draws=0,reads=0,swaps=0;
 const gl={VERSION:1,RENDERER:2,getExtension:()=>null,getParameter:x=>x===1?'WebGL fixture':'fixture renderer',drawArrays(){draws++;return 71;},readPixels(){reads++;return 72;}};
 class Canvas{constructor(){this.width=800;this.height=600;}getContext(){return gl;}transferToImageBitmap(){swaps++;return 'authentic bitmap';}}
 const context=vm.createContext({OffscreenCanvas:Canvas});vm.runInContext(controller.GL_OBSERVER,context);
 class Bridge{constructor(){this.contexts=new Map();this.currentByOwner=new Map();}createContext(){this.contexts.set(1,{hwnd:65537,software:false,backend:{gl}});return 1;}makeCurrent(){this.currentByOwner.set(0,1);return 1;}present(){return 1;}}
 context.OpenGLCompat={OpenGLHostBridge:Bridge};const canvas=new Canvas(),device=canvas.getContext('webgl'),bridge=new Bridge();
 assert.equal(draws+reads+swaps,0,'observation emits no synthetic rendering');
 assert.equal(bridge.createContext(),1);assert.equal(bridge.makeCurrent(),1);assert.equal(bridge.present(),1);
 assert.equal(device.drawArrays(),71);assert.equal(device.readPixels(),72);assert.equal(canvas.transferToImageBitmap(),'authentic bitmap');
 const snapshot=context.__gltronObserver.snapshot();assert.equal(snapshot.draws,1);assert.equal(snapshot.readbacks,1);assert.equal(snapshot.transfers,1);assert.equal(snapshot.contexts[0].deviceObserved,true);assert.equal(snapshot.contexts[0].current,true);
}
require('../lib/renderer-input').installInputHandlers(RendererProbe);
for(const [key,vk] of Object.entries(controller.KEYS)){
 const renderer=new RendererProbe();renderer.handleKeyDown(vk,{code:key});assert.equal(renderer.peekKeyDownState(vk),0x8000);renderer.handleKeyUp(vk,{code:key});assert.equal(renderer.peekKeyDownState(vk),0);
 assert.equal(renderer.inputQueue.length,2,'balanced production renderer edges '+key);
}
async function main(){
 const root=process.env.GLTRON_TEST_OUT;assert(root&&path.isAbsolute(root),'unique run-local GLTRON_TEST_OUT required');fs.mkdirSync(root,{recursive:true});
 const server=http.createServer(),sockets=new Set(),events=[];let failUp=false,lateCapture=false,wrongSession=false,closeRequest=false,attachDelay=0;
 server.on('upgrade',(req,socket)=>{
  sockets.add(socket);socket.on('close',()=>sockets.delete(socket));let buffer=Buffer.alloc(0);
  const accept=crypto.createHash('sha1').update(req.headers['sec-websocket-key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');
  const response=v=>{const write=()=>{if(socket.destroyed)return;const b=Buffer.from(JSON.stringify(v)),head=Buffer.alloc(b.length<126?2:4);head[0]=0x81;if(b.length<126)head[1]=b.length;else{head[1]=126;head.writeUInt16BE(b.length,2);}socket.write(Buffer.concat([head,b]));};if(v.result?.sessionId==='fixture-page'&&attachDelay)setTimeout(write,attachDelay);else write();};
  socket.on('data',chunk=>{buffer=Buffer.concat([buffer,chunk]);while(buffer.length>=2){const opcode=buffer[0]&15;let size=buffer[1]&127,offset=2;if(size===126){if(buffer.length<4)return;size=buffer.readUInt16BE(2);offset=4;}assert(size<65536);if(buffer.length<offset+4+size)return;const mask=buffer.subarray(offset,offset+4);offset+=4;const b=Buffer.from(buffer.subarray(offset,offset+size));for(let i=0;i<b.length;i++)b[i]^=mask[i%4];buffer=buffer.subarray(offset+size);if(opcode===8){socket.end(Buffer.from([0x88,0]));continue;}const v=JSON.parse(b);events.push({at:Date.now(),...v});if(failUp&&v.method==='Input.dispatchKeyEvent')continue;if(closeRequest){socket.end();continue;}if(lateCapture&&v.method==='Page.captureScreenshot'){setTimeout(()=>{if(!socket.destroyed)response({id:v.id,sessionId:v.sessionId,result:{data:'late'}});},3150);continue;}if(wrongSession){response({id:v.id,sessionId:'replacement',result:{}});continue;}response({id:v.id,...(v.sessionId?{sessionId:v.sessionId}:{}),result:v.method==='Target.attachToTarget'?{sessionId:'fixture-page'}:v.method==='Runtime.evaluate'?{result:{value:{apps:[{name:'gltron',processId:1}]}}}:{}});}});
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const stat=fs.readFileSync('/proc/'+process.pid+'/stat','utf8'),startToken=stat.slice(stat.lastIndexOf(')')+2).split(' ')[19];
 try {
  // Exercise the same lifecycle used by production host, guest and controls.
  // Each case owns a fresh finite child and protocol scope, never a retry.
  for(const kind of ['slowarm','slowarm-down','earlyexit','malformedoutput','timeout','stalelease','expired-after-arm']){
   const out=path.join(root,'prearm-'+kind);fs.mkdirSync(out);const start=events.length,at=Date.now();
   attachDelay=kind.startsWith('slowarm')?1250:kind==='timeout'||kind==='stalelease'?250:0;
   const file=out+'/config.json';fs.writeFileSync(file,JSON.stringify({pid:process.pid,startToken,url:'ws://127.0.0.1:'+server.address().port,targetId:'exact-page',keys:['Enter'],name:'pulse'}));
   const synthetic=kind==='earlyexit'||kind==='malformedoutput';
   const args=synthetic?['-e',kind==='earlyexit'?"process.stderr.write('finite early exit\\n');process.exitCode=7;":"process.stdout.write('{broken\\n');process.stderr.write('finite malformed output\\n');setTimeout(()=>{},50);"]:[path.resolve(__dirname,'../tools/gltron-browser-controller.cjs'),'release',out,file];
   const child=cp.spawn(process.execPath,args,{detached:true,stdio:['pipe','pipe','pipe']});let receipt,armedAt,down=false;
   const run=()=>controller.releasePrearm({child,deadline:at+(kind==='stalelease'?125:kind==='expired-after-arm'?300:6000),attachMs:kind==='timeout'?100:controller.RELEASE_ATTACH_MS,record:r=>{receipt=r;},action:async(armed,markDown)=>{
    armedAt=armed.at;
    if(kind==='expired-after-arm'){await pause(325);markDown();}
    if(kind==='slowarm-down'){
     const c=controller.connection('ws://127.0.0.1:'+server.address().port);await c.ready;
     try{markDown();down=true;await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter'},'fixture-page');child.stdin.write(JSON.stringify({at:Math.min(armed.fallback,Date.now()+100)})+'\n');}finally{c.ws.close();}
    }
   }});
   if(kind.startsWith('slowarm'))await run();else await assert.rejects(run(),e=>e.inputState==='NOT_SENT');
   assert(receipt.actualWait&&receipt.stdoutEOF&&receipt.stderrEOF);
   assert(receipt.watchdog.actualWait&&receipt.watchdog.stderrEOF);assert.equal(receipt.watchdog.code,0);
   assert.throws(()=>process.kill(child.pid,0),e=>e.code==='ESRCH','child actually reaped');
   const requests=events.slice(start),downs=requests.filter(e=>e.params?.type==='keyDown'),ups=requests.filter(e=>e.params?.type==='keyUp');
   assert.equal(downs.length,kind==='slowarm-down'?1:0);assert.equal(ups.length,kind==='slowarm-down'?1:0);
   assert.equal(receipt.state,down?'ACK':'NOT_SENT');
   if(kind.startsWith('slowarm'))assert(armedAt-at>1000&&armedAt-at<controller.RELEASE_ATTACH_MS);
   if(!down)assert(!fs.existsSync(out+'/pulse-up.json'));
   fs.writeFileSync(out+'/wait.json',JSON.stringify({...receipt,elapsedMs:Date.now()-at,requests,armedAt}));
  }
  attachDelay=0;
  for(const kind of ['scheduled','parent-eof','pair','late-eof','mouse-scheduled','mouse-parent-eof']){
   const out=path.join(root,kind);fs.mkdirSync(out);const keys=kind==='pair'?['a','s']:['Enter'];
   const mouse=kind.startsWith('mouse-')?{button:'left',x:490,y:17}:null;
   const file=out+'/config.json';fs.writeFileSync(file,JSON.stringify({pid:process.pid,startToken,url:'ws://127.0.0.1:'+server.address().port,targetId:'exact-page',keys,name:'pulse',...(mouse?{mouse}:{})}));
   const child=cp.spawn(process.execPath,[path.resolve(__dirname,'../tools/gltron-browser-controller.cjs'),'release',out,file],{stdio:['pipe','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);const joined=new Promise(r=>child.once('close',(code,signal)=>r({code,signal})));
   const end=Date.now()+2000;while(!stdout.includes('\n')){assert(Date.now()<end);await pause(5);}const armed=JSON.parse(stdout.trim());assert(armed.armed);assert.equal(armed.fallback-armed.at,1750);
   if(!kind.endsWith('parent-eof'))child.stdin.write(JSON.stringify({at:armed.at+150})+'\n');if(kind==='late-eof')setTimeout(()=>child.stdin.end(),1900);else child.stdin.end();
   const result=await joined;assert.equal(result.code,0,stderr);assert(child.stdout.readableEnded&&child.stderr.readableEnded);
   const up=JSON.parse(fs.readFileSync(out+'/pulse-up.json'));assert.equal(up.state,'ACK');assert(up.ack>=up.due&&up.ack-up.armed<=2000);
   const ups=events.filter(e=>e.method===(mouse?'Input.dispatchMouseEvent':'Input.dispatchKeyEvent')&&e.at>=armed.at&&e.at<=up.ack);
   if(mouse){assert.equal(ups.length,1);assert.deepEqual(ups[0].params,{type:'mouseReleased',button:'left',buttons:0,x:490,y:17,clickCount:1});assert.equal(ups[0].sessionId,'fixture-page');}
   else{assert.deepEqual(ups.map(e=>e.params.key),[...keys].reverse());assert(ups.every(e=>e.params.type==='keyUp'&&e.sessionId==='fixture-page'));}
   fs.writeFileSync(out+'/wait.json',JSON.stringify({...result,stdoutEOF:true,stderrEOF:true,actualWait:true,stdout,stderr,events:ups}));
  }
  for(const kind of ['wrong-start','wrong-owner','unknown-up']){
   failUp=kind==='unknown-up';const out=path.join(root,kind);fs.mkdirSync(out);const file=out+'/config.json';const start=events.length;
   fs.writeFileSync(file,JSON.stringify({pid:process.pid,startToken:kind==='wrong-start'?'replacement':startToken,url:'ws://127.0.0.1:'+server.address().port,targetId:'exact-page',keys:['Enter'],name:'pulse',...(kind==='wrong-owner'?{owner:{processId:2}}:{})}));
   const child=cp.spawn(process.execPath,[path.resolve(__dirname,'../tools/gltron-browser-controller.cjs'),'release',out,file],{stdio:['pipe','pipe','pipe']});child.stdin.end();let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);const result=await new Promise(r=>child.once('close',(code,signal)=>r({code,signal})));assert.equal(result.code,1);assert(!fs.existsSync(out+'/pulse-up.json'));
   const requests=events.slice(start).filter(e=>e.method==='Input.dispatchKeyEvent');assert.equal(requests.length,kind==='unknown-up'?1:0,'no replay after UNKNOWN or changed owner');assert(!requests.some(e=>e.params.type==='keyDown'));
   fs.writeFileSync(out+'/wait.json',JSON.stringify({...result,actualWait:true,stdoutEOF:child.stdout.readableEnded,stderrEOF:child.stderr.readableEnded,stdout,stderr,requests}));
  }
  failUp=false;
  for(const kind of ['late-capture','wrong-session','socket-close']){
   lateCapture=kind==='late-capture';wrongSession=kind==='wrong-session';closeRequest=kind==='socket-close';
   const c=controller.connection('ws://127.0.0.1:'+server.address().port);await c.ready;const start=events.length;
   const at=Date.now();await assert.rejects(c.send('Page.captureScreenshot',{},'exact-page'),/UNKNOWN/);assert(c.closed);
   await pause(kind==='late-capture'?250:10);
   for(const method of ['Input.dispatchKeyEvent','Page.captureScreenshot','Runtime.evaluate'])await assert.rejects(c.send(method,{},'exact-page'),/UNKNOWN/);
   assert.equal(events.length-start,1,'late reply/closed transport cannot send or replay');
   fs.writeFileSync(root+'/'+kind+'.json',JSON.stringify({passed:true,elapsedMs:Date.now()-at,events:events.slice(start),closed:c.closed}));c.ws.close();
  }
  lateCapture=wrongSession=closeRequest=false;
  if(process.env.GLTRON_BEFORE_PATCH){
   const patch=fs.readFileSync(process.env.GLTRON_BEFORE_PATCH,'utf8');
   const source=patch.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).map(l=>l.slice(1)).join('\n');
   const Module=require('node:module'),m=new Module(path.resolve(__dirname,'../tools/gltron-browser-controller.cjs'),module);
   m.filename=path.resolve(__dirname,'../tools/gltron-browser-controller.cjs');m.paths=module.paths;m._compile(source,m.filename);
   lateCapture=true;
   const old=m.exports.connection('ws://127.0.0.1:'+server.address().port);await old.ready;
   await assert.rejects(old.send('Page.captureScreenshot',{},'exact-page'),/UNKNOWN/);await pause(250);
   const start=events.length;await old.send('Runtime.evaluate',{},'exact-page');
   assert.equal(events.length-start,1,'causal red: predecessor still sends after capture UNKNOWN');
   fs.writeFileSync(root+'/causal-before.json',JSON.stringify({beforePatch:process.env.GLTRON_BEFORE_PATCH,unknownClosed:false,lateReplyReceived:true,postUnknownRequestSent:true,realLoopbackEndpoint:true,originalLaunched:false}));
   old.ws.close();lateCapture=false;
  }
  await startupControls();
  await chainControls();
  const {FIELDS,same}=require('../'+controller.HELPER),identity=Object.fromEntries(FIELDS.map(k=>[k,'original:'+k]));same(identity,{...identity});for(const k of FIELDS)assert.throws(()=>same(identity,{...identity,[k]:'replacement'}));
  console.log('PASS reserve/irreversible Quit/finite keys, permanent identity replacement, independent actual child scheduled/EOF/pair UP; no game or renderer proof');
 } finally {for(const socket of sockets)socket.destroy();await new Promise(r=>server.close(r));}
}
(process.env.GLTRON_BROWSER_CAPTURE==='1'?browserCaptureControls():main()).catch(e=>{console.error(e);process.exitCode=1;});

// Opt-in actual Chrome production-compositor control. Synthetic WebGL producer,
// never a guest original. No forced repaint is used by captureScene.
async function browserCaptureControls(){
 const root=process.env.GLTRON_TEST_OUT;assert(root&&path.isAbsolute(root));fs.mkdirSync(root,{recursive:true});
 const {startStaticServer,closeServer}=require('./static-server');
 const {captureScene,PAGE_READ,awaitStartupReady}=require('../'+controller.HELPER);
 const server=await startStaticServer({root:path.resolve(__dirname,'..'),crossOriginIsolated:true});
 let browser;const report={originalLaunched:false,startedAt:new Date().toISOString()};
 try{
  const profile=root+'/profile',p=cp.spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--no-first-run','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--window-size=1024,900','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='';p.stdout.on('data',b=>stdout+=b);p.stderr.on('data',b=>stderr+=b);
  const joined=new Promise(r=>p.once('close',(code,signal)=>r({code,signal,actualWait:true,stdoutEOF:p.stdout.readableEnded,stderrEOF:p.stderr.readableEnded})));
  let c;
  browser={process:()=>p,close:async()=>{try{await c?.send('Browser.close');}catch{}if(p.exitCode===null){const timer=setTimeout(()=>p.kill('SIGTERM'),3000);report.chromeWait=await joined;clearTimeout(timer);}else report.chromeWait=await joined;c?.ws.close();fs.rmSync(profile,{recursive:true,force:true});fs.writeFileSync(root+'/chrome.stdout.log',stdout);fs.writeFileSync(root+'/chrome.stderr.log',stderr);}};
  const active=profile+'/DevToolsActivePort',start=Date.now();
  while(!fs.existsSync(active)){assert(p.exitCode===null);assert(Date.now()-start<5000);await pause(20);}
  const [port,endpoint]=fs.readFileSync(active,'utf8').trim().split('\n');c=controller.connection('ws://127.0.0.1:'+port+endpoint);await c.ready;
  report.pid=p.pid;report.browser=await c.send('Browser.getVersion');report.runtimeErrors=[];
  const workers=new Map(),workerTasks=[];
  c.event=v=>{
    if(v.method==='Runtime.exceptionThrown')report.runtimeErrors.push(v.params.exceptionDetails);
    if(v.method==='Target.attachedToTarget'&&v.params.targetInfo.type==='worker'){
      const {sessionId,targetInfo}=v.params,w={sessionId,targetId:targetInfo.targetId,url:targetInfo.url,scripts:[],closed:false};workers.set(sessionId,w);
      const t=(async()=>{await c.send('Runtime.enable',{},sessionId);await c.send('Debugger.enable',{},sessionId);await c.send('Runtime.runIfWaitingForDebugger',{},sessionId);})();workerTasks.push(t);
    }else if(v.method==='Target.detachedFromTarget'){const w=workers.get(v.params.sessionId);if(w)w.closed=true;}
    else if(v.method==='Debugger.scriptParsed'&&workers.has(v.sessionId)){
      const w=workers.get(v.sessionId),row={scriptId:v.params.scriptId};w.scripts.push(row);
      workerTasks.push(c.send('Debugger.getScriptSource',{scriptId:row.scriptId},v.sessionId).then(s=>{row.bytecodeAvailable=!!s.bytecode;row.sha256=controller.sha(Buffer.from(s.bytecode||s.scriptSource||'',s.bytecode?'base64':'utf8'));}).catch(e=>row.error=String(e)));
    }
  };
  const target=(await c.send('Target.getTargets')).targetInfos.filter(t=>t.type==='page');assert.equal(target.length,1);
  const session=(await c.send('Target.attachToTarget',{targetId:target[0].targetId,flatten:true})).sessionId;
  const cdp={send:(method,params)=>c.send(method,params,session)};
  const page={waitForFunction:async expression=>{const end=Date.now()+10000;while(true){const r=await cdp.send('Runtime.evaluate',{expression:'!!('+expression+')',returnByValue:true});if(r.result?.value)return;assert(Date.now()<end,'bounded fixture readiness');await pause(20);}}};
  await cdp.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true});
  await cdp.send('Runtime.enable',{});await cdp.send('Page.enable',{});await cdp.send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/index.html?debug'});
  await page.waitForFunction('typeof Win98Renderer!=="undefined"&&typeof runningApps!=="undefined"');
  const evaluate=async (expression,workerSession)=>{const r=await c.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},workerSession??session);if(r.exceptionDetails){
    const diagnostic=await cdp.send('Runtime.evaluate',{expression:`(() => {const r=fixture.r,c=!r.presentationFilter||r._directPresentation?r.canvas:r.presentationCanvas||r.canvas,b=c.getBoundingClientRect();return {output:c.id,direct:r._directPresentation,box:b.toJSON(),overlap:[...document.querySelectorAll('*')].filter(e=>e!==c&&!e.contains(c)).map(e=>{const s=getComputedStyle(e),x=e.getBoundingClientRect();return {id:e.id,tag:e.tagName,box:x.toJSON(),display:s.display,visibility:s.visibility,opacity:s.opacity,parent:e.parentElement?.id,backgroundColor:s.backgroundColor,backgroundImage:s.backgroundImage,boxShadow:s.boxShadow,backdropFilter:s.backdropFilter,pseudo:[getComputedStyle(e,'::before').content,getComputedStyle(e,'::after').content],text:e.textContent,border:s.border,outline:s.outline};}).filter(e=>e.box.width>0&&e.box.height>0&&e.box.left<b.right&&e.box.right>b.left&&e.box.top<b.bottom&&e.box.bottom>b.top)}})()`,returnByValue:true});
    report.failureDOM=diagnostic.result?.value;throw Error(JSON.stringify(r.exceptionDetails));}return r.result.value;};
  report.setup=await evaluate(`(() => {
    if(runningApps.length)throw Error('no originals permitted');
    const screen=document.getElementById('screen');screen.width=1024;screen.height=768;const r=new Win98Renderer(screen),instance={exports:{}},w=Object.assign(Object.create(WineAssembly.prototype),{renderer:r,instance,processId:991,running:true,guestWorker:{link:{endpointIdentity:'fixture',slot:0,worker:{},module:{}}}});
    r.createWindow(65537,0x90000000,60,70,480,360,'Capture WebGL workload',0,instance,null);
    const win=r.windows[65537];win.processId=w.processId;
    const canvas=document.createElement('canvas');canvas.width=480;canvas.height=360;
    r.attachWindowSurface(65537,canvas);
    runningApps.push({name:'gltron',wine:w});
    const source=\`var endpointIdentity='fixture',workerSlot=0,instance=new WebAssembly.Instance(new WebAssembly.Module(new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,127,3,2,1,0,7,10,1,6,97,110,115,119,101,114,0,0,10,6,1,4,0,65,42,11])));const c=new OffscreenCanvas(800,600),g=c.getContext('webgl2');
      if(!g)throw Error('real WebGL2 required');
      const vs=g.createShader(g.VERTEX_SHADER);g.shaderSource(vs,'#version 300 es\\\\nvoid main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.0-1.0,0,1);}');g.compileShader(vs);
      const fs=g.createShader(g.FRAGMENT_SHADER);g.shaderSource(fs,'#version 300 es\\\\nprecision highp float;uniform float blue;out vec4 o;void main(){o=vec4(gl_FragCoord.x/800.0,gl_FragCoord.y/600.0,blue,1);}');g.compileShader(fs);
      const p=g.createProgram();g.attachShader(p,vs);g.attachShader(p,fs);g.linkProgram(p);if(!g.getProgramParameter(p,g.LINK_STATUS))throw Error(g.getProgramInfoLog(p));g.useProgram(p);const blue=g.getUniformLocation(p,'blue');g.uniform1f(blue,0.7);let plan=null;onmessage=({data:m})=>{if(m.paint)plan={...m.paint,start:n+1};else g.uniform1f(blue,m.blue);};
      let n=0;setInterval(()=>{for(let i=0;i<32;i++)g.drawArrays(g.TRIANGLES,0,3);const b=c.transferToImageBitmap();const frame=++n,begin=!!plan&&frame===plan.start,end=!!plan&&frame===plan.start+plan.frames;postMessage({bitmap:b,n:frame,begin,end,version:g.getParameter(g.VERSION)},[b]);if(end){if(plan.cycles>1){plan.cycles--;plan.start=frame+10;}else plan=null;}},30);\`;
    const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'})),worker=new Worker(url+'#guest-worker');
    globalThis.fixture={r,w,win,canvas,worker,url,frames:0,publications:[],keys:[],captureCalls:[],startupEvents:[],paintEvents:[]};
    const request=w.requestCurrentDisplayCapture;w.requestCurrentDisplayCapture=function(o){fixture.captureCalls.push({at:Date.now(),frames:fixture.frames,held:r._workerPublicationHeld()});return request.call(this,o);};
    const observe=r.observePresentationPublication;r.observePresentationPublication=function(d,n){observe.call(this,d,n);fixture.publications.push({n,at:Date.now()});if(fixture.publications.length>10)fixture.publications.shift();if(!fixture.startupEvents.length){r.beginWorkerGuestSlice();fixture.startupEvents.push({event:'ordinary-producer-begin',at:Date.now()});}if(fixture.onPublication){const f=fixture.onPublication;fixture.onPublication=null;queueMicrotask(f);}};
    worker.onerror=e=>{fixture.workerError=e.message;};worker.onmessage=({data:m})=>{if(m.begin){r.beginWorkerGuestSlice();fixture.paintEvents.push({event:'begin',at:Date.now(),frame:m.n});}if(m.end){r.endWorkerGuestSlice();fixture.paintEvents.push({event:'end',at:Date.now(),frame:m.n});}canvas.getContext('2d').drawImage(m.bitmap,0,0,canvas.width,canvas.height);m.bitmap.close();fixture.frames=m.n;fixture.version=m.version;if(m.n===20){r.endWorkerGuestSlice();fixture.startupEvents.push({event:'ordinary-producer-end',at:Date.now(),frames:m.n});}r.scheduleRepaint();if(fixture.onFrame){const f=fixture.onFrame;fixture.onFrame=null;f();}};
    for(const type of ['keydown','keyup'])addEventListener(type,e=>fixture.keys.push({type,key:e.key,at:Date.now(),trusted:e.isTrusted}));
    return {hwnd:win.hwnd,processId:win.processId};
  })()`);
  await page.waitForFunction('fixture.startupEvents.length>0&&fixture.r._workerPublicationHeld()');
  // Reproduce the predecessor's premature ticket in a synthetic control,
  // never by reopening its closed original. Compile exact committed source
  // in memory; Git remains the source archive.
  const Module=require('node:module'),old=new Module(path.resolve(__dirname,'../tools/gltron-browser-binding.cjs'),module);
  old.filename=path.resolve(__dirname,'../tools/gltron-browser-binding.cjs');old.paths=module.paths;
  const oldSource=cp.execFileSync('git',['show','9baf6cec8122baa5698e1934240db8abe1617f84:tools/gltron-browser-binding.cjs'],{encoding:'utf8'});
  old._compile(oldSource,old.filename);
  report.startupPredecessor={commit:'9baf6cec8122baa5698e1934240db8abe1617f84',path:'tools/gltron-browser-binding.cjs',sha256:controller.sha(oldSource),sourceRecoveredFromGit:true,oldOriginalReopened:false};
  const startupIdentity=(await evaluate(PAGE_READ)).apps[0];
  await assert.rejects(old.exports.captureScene({evaluate,identity:startupIdentity}),/held|in-flight/);
  report.startupRed=await evaluate('({calls:fixture.captureCalls.slice(),held:fixture.r._workerPublicationHeld(),ticketAbsent:!globalThis.__gltronCaptureTicketV1,keys:fixture.keys.slice()})');
  assert.equal(report.startupRed.calls.length,1);assert(report.startupRed.calls[0].held&&report.startupRed.held&&report.startupRed.ticketAbsent);assert.equal(report.startupRed.keys.length,0);
  const startupObservations=[];
  report.startupGreen={...await awaitStartupReady({evaluate,identity:startupIdentity,deadline:Date.now()+10000,onObservation:s=>startupObservations.push(s)})};
  report.startupGreen.observations=startupObservations;
  assert(startupObservations.some(s=>!s.ready),'held startup must actually be observed');
  const beforeFirst=await evaluate('({calls:fixture.captureCalls.length,keys:fixture.keys.length,events:fixture.startupEvents})');
  assert.equal(beforeFirst.calls,1,'new PREBIND wait must create zero tickets');assert.equal(beforeFirst.keys,0);
  assert(beforeFirst.events.some(e=>e.event==='ordinary-producer-end'));report.startupGreen.beforeFirst=beforeFirst;
  await page.waitForFunction('fixture.frames>=20&&fixture.r._immutablePublicationSequence>0');
  const identity=(await evaluate(PAGE_READ)).apps[0];
  const begin=Date.now();
  const shot=await captureScene({evaluate,identity});report.capture={at:shot.at,elapsedMs:Date.now()-begin,stages:shot.stages,metadata:shot.metadata,sha256:controller.sha(shot.png)};
  for(const w of shot.metadata.composition.windows){assert(w.x>=0&&w.y>=0&&w.x+w.width<=shot.metadata.output.width&&w.y+w.height<=shot.metadata.output.height,'complete owner window inside output');}
  fs.writeFileSync(root+'/complete-scene.png',shot.png,{flag:'wx'});
  const first=await evaluate('fixture.captureCalls.slice()');assert.equal(first.length,2);assert(!first[1].held&&first[1].frames>=20);report.startupGreen.firstCapture=first[1];
  // Compare the currently displayed complete output while the synthetic
  // producer continues publishing identical pixels, never a raw source slot.
  await pause(100);
  const visible=await evaluate(`(() => {const r=fixture.r,c=!r.presentationFilter||r._directPresentation?r.canvas:r.presentationCanvas||r.canvas;return c.toDataURL('image/png');})()`);
  const {PNG}=require('pngjs'),a=PNG.sync.read(shot.png),b=PNG.sync.read(Buffer.from(visible.split(',')[1],'base64'));
  assert.equal(a.width,b.width);assert.equal(a.height,b.height);assert(a.data.equals(b.data),'complete current visible canvas pixels unchanged');
  const frame=await evaluate('fixture.frames');await evaluate('fixture.worker.postMessage({blue:0.2});true');
  await page.waitForFunction('fixture.frames>'+String(frame+3));
  const changed=await captureScene({evaluate,identity:(await evaluate(PAGE_READ)).apps[0]});
  assert(changed.metadata.publication>shot.metadata.publication);assert(!changed.png.equals(shot.png),'new real WebGL pixels required');
  fs.writeFileSync(root+'/changed-scene.png',changed.png,{flag:'wx'});
  report.changed={at:changed.at,stages:changed.stages,metadata:changed.metadata,sha256:controller.sha(changed.png),currentPixelsChanged:true};
  // Exercise the production exclusive compositor with one fully covered
  // owner while the real WebGL Worker still supplies its pixels.
  const beforeExclusive=await evaluate('fixture.r._immutablePublicationSequence');
  await evaluate('fixture.w.instance.exports.get_dx_exclusive_hwnd=()=>65537;fixture.r.scheduleRepaint();true');
  await page.waitForFunction('fixture.r._immutablePublicationSequence>'+beforeExclusive+'&&fixture.r._exclusiveFullscreen');
  const exclusive=await captureScene({evaluate,identity:(await evaluate(PAGE_READ)).apps[0]});
  assert(exclusive.metadata.composition.exclusive);
  assert.equal(exclusive.metadata.presentationViewport.cropX,0);assert.equal(exclusive.metadata.presentationViewport.cropY,0);
  assert.equal(exclusive.metadata.presentationViewport.cropW,480);assert.equal(exclusive.metadata.presentationViewport.cropH,360);
  const exclusiveDisplay=await evaluate('fixture.r.presentationCanvas.toDataURL("image/png")');
  assert(PNG.sync.read(exclusive.png).data.equals(PNG.sync.read(Buffer.from(exclusiveDisplay.split(',')[1],'base64')).data));
  fs.writeFileSync(root+'/exclusive-scene.png',exclusive.png,{flag:'wx'});
  report.exclusive={metadata:exclusive.metadata,stages:exclusive.stages,pixelMatch:true};
  await evaluate('delete fixture.w.instance.exports.get_dx_exclusive_hwnd;fixture.r.scheduleRepaint();true');
  await page.waitForFunction('!fixture.r._exclusiveFullscreen');
  await Promise.all(workerTasks);
  await atomicBrowserControls({evaluate,send:c.send,workers,pageSession:session,page,root,report,cdp});
  await evaluate('fixture.worker.terminate();true');await pause(100);
  const screenshotAt=Date.now();try{await cdp.send('Page.captureScreenshot',{format:'png'});report.screenshot={elapsedMs:Date.now()-screenshotAt,completed:true};}catch(e){report.screenshot={elapsedMs:Date.now()-screenshotAt,error:String(e)};}
  // Causal red/green on exactly the same idle scene, without a hold/draw.
  // The old next-publication API correctly stays pending for the full fixed
  // budget. The distinct current-display API reads it without publishing.
  await pause(100);const idlePublication=await evaluate('fixture.r._immutablePublicationSequence'),idleAt=Date.now();
  await evaluate('fixture.oldTicket=fixture.w.requestImmutableCapture({hwnd:65537});true');
  await pause(3000);
  report.idleRed=await evaluate('({status:fixture.oldTicket.status,publication:fixture.r._immutablePublicationSequence,cancelled:fixture.oldTicket.cancel(),held:fixture.r._workerPublicationHeld(),pendingDamage:fixture.r._repaintScheduled})');
  report.idleRed.elapsedMs=Date.now()-idleAt;
  assert.equal(report.idleRed.status,'pending');assert.equal(report.idleRed.publication,idlePublication);assert(report.idleRed.cancelled&&!report.idleRed.held&&!report.idleRed.pendingDamage);
  const greenAt=Date.now(),idle=await captureScene({evaluate,identity:(await evaluate(PAGE_READ)).apps[0]});
  const idleVisible=await evaluate(`(() => {const r=fixture.r,c=!r.presentationFilter||r._directPresentation?r.canvas:r.presentationCanvas||r.canvas;return c.toDataURL('image/png');})()`);
  assert(PNG.sync.read(idle.png).data.equals(PNG.sync.read(Buffer.from(idleVisible.split(',')[1],'base64')).data));
  assert.equal(idle.metadata.content,'already-displayed');assert.equal(idle.metadata.publication,idlePublication);
  assert(idle.metadata.displayedAt<idle.metadata.requestedAt);
  fs.writeFileSync(root+'/idle-scene.png',idle.png,{flag:'wx'});
  report.idle={elapsedMs:Date.now()-greenAt,before:idlePublication,after:await evaluate('fixture.r._immutablePublicationSequence'),metadata:idle.metadata,pixelMatch:true,ticketAbsent:await evaluate('!globalThis.__gltronCaptureTicketV1')};
  assert.equal(report.idle.before,report.idle.after);assert(report.idle.ticketAbsent);assert(report.idle.elapsedMs<3000);
  const bounds=await evaluate(`(() => {const r=fixture.r,c=!r.presentationFilter||r._directPresentation?r.canvas:r.presentationCanvas||r.canvas,b=c.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,scale:1};})()`);
  const displayed=await cdp.send('Page.captureScreenshot',{format:'png',clip:bounds,captureBeyondViewport:false});
  const displayPixels=PNG.sync.read(Buffer.from(displayed.data,'base64')),idlePixels=PNG.sync.read(idle.png);
  assert.equal(displayPixels.width,idlePixels.width);assert.equal(displayPixels.height,idlePixels.height);
  assert(displayPixels.data.equals(idlePixels.data),'actual Chrome compositor screenshot matches complete idle output');
  report.idle.browserCompositorPixelMatch=true;
  // Pending ordinary damage is neither discarded nor published by capture.
  report.pending=await evaluate(`(() => {const r=fixture.r,ctx=fixture.canvas.getContext('2d');ctx.fillStyle='#7733cc';ctx.fillRect(0,0,480,360);r.scheduleRepaint();const before=r._immutablePublicationSequence,t=fixture.w.requestCurrentDisplayCapture({hwnd:65537});fixture.pendingTicket=t;return {before,status:t.status,stillScheduled:r._repaintScheduled};})()`);
  assert.equal(report.pending.status,'pending');assert(report.pending.stillScheduled);
  await page.waitForFunction("fixture.pendingTicket.status==='complete'");
  const pending=await evaluate('({metadata:fixture.pendingTicket.read().metadata,status:fixture.pendingTicket.status})');
  assert.equal(pending.metadata.publication,report.pending.before+1);assert.equal(pending.metadata.content,'ordinary-publication-after-request');report.pending.after=pending;
  // A pending ticket can be cancelled without cancelling ordinary damage.
  report.cancelled=await evaluate(`(() => {const r=fixture.r;r.scheduleRepaint();const t=fixture.w.requestCurrentDisplayCapture({hwnd:65537});fixture.cancelledTicket=t;return {pending:t.status,cancelled:t.cancel(),damage:r._repaintScheduled};})()`);
  assert.equal(report.cancelled.pending,'pending');assert(report.cancelled.cancelled&&report.cancelled.damage);
  await pause(100);assert(await evaluate("fixture.cancelledTicket.status==='cancelled'&&fixture.cancelledTicket.read()===null&&!fixture.r._immutableCaptureRequest"));
  // Late holds and fixed-bound startup expiry are exercised above through
  // real Worker begin/end messages, with no test-side hold release.
  assert(await evaluate('!globalThis.__gltronCaptureTicketV1'),'late publication cannot promote cancelled capture');
  // Visible HTML siblings cannot appear in canvas bytes, including a
  // pointer-events:none overlay. Admission refuses their overlapping boxes.
  await evaluate(`(() => {const c=fixture.r._directPresentation?fixture.r.canvas:fixture.r.presentationCanvas,b=c.getBoundingClientRect(),e=document.createElement('div');e.id='fixture-dom-overlay';e.textContent='HTML OVERLAY';Object.assign(e.style,{position:'fixed',left:(b.left+10)+'px',top:(b.top+10)+'px',width:'140px',height:'50px',background:'red',zIndex:'2147483647',pointerEvents:'none'});document.body.append(e);return true;})()`);
  const overlayOwner=(await evaluate(PAGE_READ)).apps[0];assert(!overlayOwner.outputVisible);
  await assert.rejects(captureScene({evaluate,identity:overlayOwner}),/visible/);
  report.domOverlay={pointerEventsNone:true,admissionRefused:true,canvasDoesNotDepictHTML:true};
  await evaluate("document.getElementById('fixture-dom-overlay').remove();true");
  // CSS output hiding/clipping and output object replacement are refusals.
  report.outputNegatives=[];
  for(const kind of ['hidden','clipped','replacement']){
    const before=(await evaluate(PAGE_READ)).apps[0];
    await evaluate(`(() => {const r=fixture.r,c=!r.presentationFilter||r._directPresentation?r.canvas:r.presentationCanvas||r.canvas;fixture.output=c;fixture.outputStyle=c.getAttribute('style');fixture.logical=r.canvas;fixture.present=r.presentationCanvas;if('${kind}'==='hidden')c.style.visibility='hidden';else if('${kind}'==='clipped')c.style.transform='translateX(-2000px)';else if(c===r.canvas)r.canvas=c.cloneNode();else r.presentationCanvas=c.cloneNode();return true;})()`);
    const direct=await evaluate('(() => {const t=fixture.w.requestCurrentDisplayCapture({hwnd:65537});return {status:t.status,error:t.error,read:t.read()};})()');
    assert.equal(direct.status,'failed');assert.equal(direct.read,null);
    await assert.rejects(captureScene({evaluate,identity:before}),/visible|hidden|clipped|changed/);
    report.outputNegatives.push({kind,refused:true,direct});
    await evaluate(`(() => {const f=fixture;f.r.canvas=f.logical;f.r.presentationCanvas=f.present;if(f.outputStyle===null)f.output.removeAttribute('style');else f.output.setAttribute('style',f.outputStyle);return true;})()`);
  }
  if(process.env.GLTRON_FULLSCREEN_BOOTSTRAP==='1'){
    // Synthetic owner uses the real page viewport and input wiring. The
    // ordinary compositor enters exclusive mode; no CSS/DOM dismissal exists.
    await evaluate(`(() => {const f=fixture;Object.defineProperty(window,'sharedRenderer',{configurable:true,value:f.r});Object.defineProperty(window,'wine',{configurable:true,value:f.w});browserInput.wireCanvasInput(f.r.canvas,f.r,{runningApps,debugMode:true});f.mouseCalls=[];for(const k of ['handleMouseDown','handleMouseUp']){const fn=f.r[k];f.r[k]=function(...a){f.mouseCalls.push({method:k,args:a,at:Date.now()});return fn.apply(this,a);};}f.w.instance.exports.get_dx_exclusive_hwnd=()=>65537;f.r.scheduleRepaint();return true;})()`);
    await page.waitForFunction('fixture.r._exclusiveFullscreen');await pause(100);
    const binding=require('../'+controller.HELPER),red=await evaluate(binding.HOST_READ);
    binding.consentButton(red);assert.notEqual(red.fullscreen,red.wrap,'host fullscreen requirement is not yet satisfied');
    const beforeCalls=await evaluate('fixture.captureCalls.length');
    if(!red.page.apps[0].outputVisible)await assert.rejects(captureScene({evaluate,identity:red.page.apps[0]}),/visible/);
    assert.equal(await evaluate('fixture.captureCalls.length'),beforeCalls,'consent refusal before ticket');
    report.fullscreenRed={observation:red,ticketCount:beforeCalls,guestMouseCalls:await evaluate('fixture.mouseCalls'),visibilityRefused:!red.page.apps[0].outputVisible,qualification:'Actual production strip present. Synthetic geometry may place the complete canvas below it; no invented occlusion refusal.'};
    const stat=fs.readFileSync('/proc/'+p.pid+'/stat','utf8'),startToken=stat.slice(stat.lastIndexOf(')')+2).split(' ')[19];
    await controller.hostBootstrap({out:root,evaluate,send:c.send,session,owner:red.page.apps[0],browserIdentity:{pid:p.pid,startToken,targetId:target[0].targetId,url:'ws://127.0.0.1:'+port+endpoint},deadline:Date.now()+40000});
    assert.equal(await evaluate('fixture.captureCalls.length'),beforeCalls,'host setup emits no game ticket');
    assert.deepEqual(await evaluate('fixture.mouseCalls'),[],'host button sends no guest mouse edge');
    const previous=new Module(path.resolve(__dirname,'../tools/gltron-browser-binding.cjs'),module);previous.filename=path.resolve(__dirname,'../tools/gltron-browser-binding.cjs');previous.paths=module.paths;
    const previousSource=cp.execFileSync('git',['show','f6931d34b7ada7386d335624fe77f41803a2ea4f:tools/gltron-browser-binding.cjs'],{encoding:'utf8'});previous._compile(previousSource,previous.filename);
    const oldFullscreen=await evaluate(previous.exports.PAGE_READ),newFullscreen=await evaluate(PAGE_READ);
    assert(!oldFullscreen.apps[0].outputVisible&&newFullscreen.apps[0].outputVisible,'causal fullscreen red/green on same actual browser without repaint or ticket');
    report.fullscreenScopeCausal={commit:'f6931d34b7ada7386d335624fe77f41803a2ea4f',sourceSHA256:controller.sha(previousSource),oldOutputVisible:false,newOutputVisible:true,sameBrowser:true,noTicketOrRepaint:true};
    await binding.awaitStartupReady({evaluate,identity:red.page.apps[0],selectOutput:true,deadline:Date.now()+5000});
    const green=await captureScene({evaluate,identity:(await evaluate(PAGE_READ)).apps[0]});
    fs.writeFileSync(root+'/fullscreen-scene.png',green.png,{flag:'wx'});
    const bounds=await evaluate(`(() => {const r=fixture.r,c=!r.presentationFilter||r._directPresentation?r.canvas:r.presentationCanvas||r.canvas,b=c.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,scale:1};})()`);
    const displayed=await cdp.send('Page.captureScreenshot',{format:'png',clip:bounds,captureBeyondViewport:false});
    const a=PNG.sync.read(green.png),b=PNG.sync.read(Buffer.from(displayed.data,'base64'));assert.equal(a.width,b.width);assert.equal(a.height,b.height);assert(a.data.equals(b.data),'fullscreen current output equals actual Chrome compositor pixels');
    assert(green.metadata.displayedAt<green.metadata.requestedAt,'old publication age retained');
    report.fullscreenGreen={metadata:green.metadata,stages:green.stages,browserCompositorPixelMatch:true,guestMouseCalls:[],hostOnlyUntilCapture:true};
    // Fullscreen scope must retain HTML occlusion refusal. These are explicit
    // synthetic negative fixtures, added only after successful normal setup.
    await evaluate(`(() => {const e=document.createElement('div');e.id='fullscreen-negative-overlay';e.textContent='SYNTHETIC OCCLUSION';Object.assign(e.style,{position:'fixed',left:'10px',top:'10px',width:'180px',height:'50px',background:'red',pointerEvents:'none',zIndex:99999});document.fullscreenElement.append(e);return true;})()`);
    const overlay=(await evaluate(PAGE_READ)).apps[0];assert(!overlay.outputVisible);assert.equal(overlay.outputVisibility.element.id,'fullscreen-negative-overlay');await assert.rejects(captureScene({evaluate,identity:overlay}),/visible/);
    await evaluate("document.getElementById('fullscreen-negative-overlay').remove();true");
    report.fullscreenNegativeOverlayRefused=true;
    for(const kind of ['modal','popover']){
      await evaluate(`(() => {const e=document.createElement('${kind==='modal'?'dialog':'div'}');e.id='fullscreen-negative-layer';e.textContent='SYNTHETIC TOP LAYER';document.body.append(e);if('${kind}'==='modal')e.showModal();else{e.popover='manual';e.showPopover();}return true;})()`);
      const top=(await evaluate(PAGE_READ)).apps[0];assert(!top.outputVisible);assert.equal(top.outputVisibility.reason,'modal/popover top layer over fullscreen');await assert.rejects(captureScene({evaluate,identity:top}),/visible/);
      await evaluate(`(() => {const e=document.getElementById('fullscreen-negative-layer');if('${kind}'==='modal')e.close();else e.hidePopover();e.remove();return true;})()`);
    }
    report.fullscreenModalAndPopoverRefused=true;
    await assert.rejects(controller.hostBootstrap({out:root,evaluate,send:c.send,session,owner:red.page.apps[0],browserIdentity:{pid:p.pid,startToken},deadline:Date.now()+1000}),/never replay/);
    report.hostNoReplay=true;
  }
  // Actual replacement while a ticket waits for ordinary damage.
  const current=(await evaluate(PAGE_READ)).apps[0];
  await evaluate('fixture.r.windows[65537]={...fixture.win};true');
  await assert.rejects(captureScene({evaluate,identity:current}),/changed|selected/);
  assert(await evaluate('!globalThis.__gltronCaptureTicketV1'));
  report.replacementRefused=true;report.version=await evaluate('fixture.version');report.frames=await evaluate('fixture.frames');report.keys=await evaluate('fixture.keys');assert.equal(report.keys.length,0);
  // Owner replacement during passive startup closes readiness rather than
  // waiting for a similar-looking replacement owner to become ready.
  await evaluate('fixture.r.windows[65537]=fixture.win;fixture.w._presentFrameDue=true;setTimeout(()=>{fixture.r.windows[65537]={...fixture.win};},50);true');
  await assert.rejects(awaitStartupReady({evaluate,identity:(await evaluate(PAGE_READ)).apps[0],deadline:Date.now()+1000}),/identity changed/);
  report.startupOwnerReplacementRefused=true;
  await evaluate('fixture.r.windows[65537]=fixture.win;fixture.w._presentFrameDue=false;true');
  await page.waitForFunction('!fixture.r._workerPublicationHeld()&&!fixture.r._repaintScheduled');
  await evaluate('URL.revokeObjectURL(fixture.url);true');
  // Actual Chrome delayed response: fixed 3s UNKNOWN closes transport, and
  // neither its late reply nor any subsequent call can send input/replay.
  const unknownAt=Date.now(),unknownBefore=await evaluate('fixture.captureCalls.length'),unknownObservations=[];
  // The synthetic producer has retired normally above. Exercise the ticket
  // helper directly on its still-live idle display; never invent a Worker.
  const unknownIdentity=(await evaluate(PAGE_READ)).apps[0];
  const unknownCapture=captureScene({evaluate:async(expression,workerSession)=>{
    if(!workerSession&&expression.includes('const t=h.ticket,status'))await evaluate('new Promise(r=>setTimeout(()=>r(17),3150))');
    return evaluate(expression,workerSession);
  },identity:unknownIdentity,onTicketObservation:o=>unknownObservations.push(o)});
  await assert.rejects(unknownCapture,e=>/UNKNOWN/.test(e.message)&&e.ticketObservation.status==='UNKNOWN');
  await pause(250);assert(c.closed);
  for(const method of ['Input.dispatchKeyEvent','Runtime.evaluate'])await assert.rejects(cdp.send(method,{}),/UNKNOWN/);
  report.chromeUnknown={elapsedMs:Date.now()-unknownAt,closed:c.closed,lateReplyCannotReopen:true,inputDispatches:0,unknownBefore,observations:unknownObservations,helperTerminal:true};
  report.passed=true;
 }catch(e){report.error=String(e.stack);throw e;}
 finally{
  if(browser){const p=browser.process();await browser.close();report.chrome={code:p.exitCode,signal:p.signalCode,stdoutEOF:p.stdout?.readableEnded??null,stderrEOF:p.stderr?.readableEnded??null};}
  await closeServer(server);report.serverClosed=!server.listening;report.endedAt=new Date().toISOString();fs.writeFileSync(root+'/report.json',JSON.stringify(report,null,2)+'\n');
 }
}


async function atomicBrowserControls({evaluate,send,workers,pageSession,page,root,report,cdp}){
 const binding=require('../'+controller.HELPER),{PNG}=require('pngjs');
 const oldSource=cp.execFileSync('git',['show','ee9c89feb84901561d1999d9d5a9ba3fcdbaa8be:tools/gltron-browser-binding.cjs'],{encoding:'utf8'});
 const Module=require('node:module'),old=new Module(path.resolve(__dirname,'../tools/gltron-browser-binding.cjs'),module);
 old.filename=path.resolve(__dirname,'../tools/gltron-browser-binding.cjs');old.paths=module.paths;old._compile(oldSource,old.filename);
 const snapshot=()=>evaluate('({calls:fixture.captureCalls.slice(),held:fixture.r._workerPublicationHeld(),events:fixture.paintEvents.slice(),keys:fixture.keys.slice(),ticketAbsent:!globalThis.__gltronCaptureTicketV1})');
 const naturalEnd=()=>page.waitForFunction('!fixture.r._workerPublicationHeld()&&!fixture.r._repaintScheduled&&!fixture.r._repaintPending');
 const armAfterPublication=expression=>evaluate(`new Promise(resolve=>{fixture.onPublication=()=>resolve((${expression}));})`);
 const restoreSyntheticOwner=async()=>{
  const frame=await evaluate('fixture.r.windows[65537]=fixture.win;fixture.frames');
  await page.waitForFunction('fixture.frames>'+frame);await naturalEnd();
 };
 const plan=async p=>{await evaluate('fixture.worker.postMessage('+JSON.stringify({paint:p})+');true');await page.waitForFunction('fixture.r._workerPublicationHeld()');};
 const make=(impl,inject,observe=()=>{})=>{
  let armed=false;const passive=[];
  return {activate:()=>armed=true,passive,chain:impl.createChain({evaluate:async(...args)=>{
   const value=await evaluate(...args);
   if(value?.state==='NOT_READY'){
    const observed=await snapshot();
    assert(observed.ticketAbsent,'passive refusal leaves no ticket');
    assert.equal(observed.keys.length,0);
    passive.push({nonce:value.nonce,observed});
   }
   return value;
  },workers,pageSession,app:'gltron',send:async(...args)=>{
   // The module bytes really come from the attached Chrome Worker. The
   // producer event is introduced only during this asynchronous boundary.
   if(armed&&args[0]==='Debugger.getScriptSource'){armed=false;await inject();observe(await snapshot());}
   return send(...args);
  }})};
 };
 report.atomic={predecessor:{commit:'ee9c89feb84901561d1999d9d5a9ba3fcdbaa8be',sha256:controller.sha(oldSource)},cases:[]};
 for(const candidate of [false,true]){
  await naturalEnd();const before=await snapshot(),observations=[],during=[];
  const f=make(candidate?binding:old.exports,()=>plan({frames:20}),s=>during.push(s));
  const deadline=Date.now()+5000,initial=await f.chain.prepareStartup(deadline,s=>observations.push(s));assert(initial.ready);
  f.activate();
  if(!candidate){
   await assert.rejects(f.chain.capture('late-hold'),/precondition refused/);assert(f.chain.closed);
   await assert.rejects(f.chain.capture('no-reopen'),/closed/);
  }else{
   const shot=await f.chain.capture('late-hold');assert(!f.chain.closed);
   const checks=observations.filter(s=>s.state==='NOT_READY');assert(checks.length>0);
   assert.equal(new Set(checks.map(s=>s.nonce)).size,checks.length,'fresh passive probe nonces');
   assert(checks.every(s=>s.requestCalled===false&&s.ticketCreated===false&&s.inputDispatched===false));
   const after=await snapshot();assert.equal(after.calls.length,before.calls.length+1);assert(!after.calls.at(-1).held);
   const output=await evaluate('(() => {const r=fixture.r,c=!r.presentationFilter||r._directPresentation?r.canvas:r.presentationCanvas||r.canvas,b=c.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,scale:1};})()');
   const displayed=await cdp.send('Page.captureScreenshot',{format:'png',clip:output,captureBeyondViewport:false});
   const a=PNG.sync.read(shot.png),b=PNG.sync.read(Buffer.from(displayed.data,'base64'));assert.equal(a.width,b.width);assert.equal(a.height,b.height);assert(a.data.equals(b.data));
   fs.writeFileSync(root+'/atomic-current-scene.png',shot.png,{flag:'wx'});
   report.atomic.scene={...shot.capture,pixelMatch:true};
  }
  assert(during[0].held);assert.equal(during[0].calls.length,before.calls.length);assert.equal(during[0].keys.length,0);
  assert(during[0].events.at(-1).at>=initial.at,'hold introduced after initial readiness');
  for(const probe of f.passive)assert.equal(probe.observed.calls.length,before.calls.length,'zero requests throughout passive held observations');
  const final=await snapshot();if(!candidate)assert.equal(final.calls.length,before.calls.length);
  report.atomic.cases.push({candidate,initial,deadline,before,during,observations,passive:f.passive,final,closed:f.chain.closed});await naturalEnd();
 }
 // A fixed real test bound expires during sustained ordinary Worker work.
 // Its normal end message still owns release; the test never clears a hold.
 {
  const before=await snapshot(),observations=[],f=make(binding,()=>plan({frames:100}));
  const deadline=Date.now()+1000;await f.chain.prepareStartup(deadline,s=>observations.push(s));f.activate();const at=Date.now();
  await assert.rejects(f.chain.capture('sustained'),/bounded PREBIND/);assert(f.chain.closed);
  await assert.rejects(f.chain.capture('no-reopen'),/closed/);const final=await snapshot();assert.equal(final.calls.length,before.calls.length);assert(Date.now()>=deadline);
  report.atomic.timeout={deadline,at,endedAt:Date.now(),observations,before,final};await naturalEnd();
 }
 // Replacement after asynchronous module validation starts is fatal, even
 // when a replacement looks identical and later publishes naturally.
 {
  const before=await snapshot(),f=make(binding,async()=>{await evaluate('fixture.r.windows[65537]={...fixture.win};true');});
  await f.chain.prepareStartup(Date.now()+2000);f.activate();await assert.rejects(f.chain.capture('replacement'),/identity changed/);assert(f.chain.closed);
  await assert.rejects(f.chain.capture('no-reopen'),/closed/);const final=await snapshot();assert.equal(final.calls.length,before.calls.length);report.atomic.replacement={before,final,closed:f.chain.closed};
  await restoreSyntheticOwner();
 }
 // Replace the owner after the final awaited page read has returned its
 // old identity, immediately before the synchronous arm transaction.
 {
  let active=false,reads=0;const before=await snapshot();
  const f=binding.createChain({evaluate:async(...args)=>{
   const value=await evaluate(...args);
   if(active&&args[0]===binding.PAGE_READ&&++reads===2){
    active=false;await evaluate('fixture.r.windows[65537]={...fixture.win};true');
   }
   return value;
  },send,workers,pageSession,app:'gltron'});
  await f.prepareStartup(Date.now()+3000);active=true;
  await assert.rejects(f.capture('replacement-before-arm'),/identity changed/);assert(f.closed);
  await assert.rejects(f.capture('no-reopen'),/closed/);
  const final=await snapshot();assert.equal(reads,2);assert.equal(final.calls.length,before.calls.length);
  report.atomic.replacementBeforeArm={before,final,closed:f.closed,reads};
  await restoreSyntheticOwner();
 }
 // Causal lifetime control: exact a918 helper and candidate each get ONE
 // already-complete production ticket, then normal Worker begin before read.
 // No hold release, new publication, repaint, guest input or retry is forced.
 const lifetimeSource=cp.execFileSync('git',['show','a918f0b61854121fddce5d9d5671b9f0f6d1fc08:tools/gltron-browser-binding.cjs'],{encoding:'utf8'});
 const prior=new Module(old.filename,module);prior.filename=old.filename;prior.paths=module.paths;prior._compile(lifetimeSource,prior.filename);
 report.atomic.ticketLifetime=[];
 for(const candidate of [false,true]){
  await naturalEnd();const before=await snapshot(),observations=[];let receipt;
  const identity=(await evaluate(binding.PAGE_READ)).apps[0];
  const wrapped=async expression=>{
   const v=expression.includes('t=w.requestCurrentDisplayCapture')?await armAfterPublication(expression):await evaluate(expression);
   if(expression.includes('t=w.requestCurrentDisplayCapture')){
    receipt=await evaluate(`(async()=>{const t=globalThis.__gltronCaptureTicketV1.ticket;fixture.lifetimeTicket=t;const r=t.read();if(t.status!=='complete'||!r)throw Error('lifetime control requires completed ticket');fixture.lifetimeMetadata=r.metadata;const hash=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');const outputSha256=await hash(r.outputRGBA);r.outputRGBA.fill(0);return {status:t.status,at:Date.now(),metadata:r.metadata,outputSha256,copyIsolated:outputSha256===await hash(t.read().outputRGBA)};})()`);
    assert.equal(receipt.status,'complete');assert(receipt.copyIsolated);
    await plan({frames:20});receipt.afterBegin=await evaluate('({status:fixture.lifetimeTicket.status,at:Date.now(),held:fixture.r._workerPublicationHeld(),metadata:fixture.lifetimeTicket.read().metadata})');
    assert(receipt.afterBegin.held);assert.equal(receipt.afterBegin.status,'complete');
   }
   return v;
  };
  if(!candidate)await assert.rejects(prior.exports.captureScene({evaluate:wrapped,identity}),/post-ticket readiness changed/);
  else{
   const shot=await binding.captureScene({evaluate:wrapped,identity,onTicketObservation:o=>observations.push(o)});
   assert.deepEqual(shot.metadata,receipt.metadata);assert.equal(controller.sha(PNG.sync.read(shot.png).data),receipt.outputSha256);
   assert(observations.some(o=>o.status==='complete'&&o.paint?.held),'actual complete read while later Worker paint held');
   assert(Date.parse(shot.at)<=shot.metadata.requestedAt,'original observation age retained');
   fs.writeFileSync(root+'/completed-ticket.png',shot.png,{flag:'wx'});
  }
  const final=await snapshot();assert.equal(final.calls.length,before.calls.length+1);assert(final.ticketAbsent);
  await naturalEnd();const retained=await evaluate(`(async()=>{const t=fixture.lifetimeTicket,r=t.read();return {status:t.status,metadata:r.metadata,outputSha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',r.outputRGBA)),x=>x.toString(16).padStart(2,'0')).join(''),publication:fixture.r._immutablePublicationSequence};})()`);
  assert.equal(retained.outputSha256,receipt.outputSha256);assert.deepEqual(retained.metadata,receipt.metadata);assert(retained.publication>retained.metadata.publication);
  report.atomic.ticketLifetime.push({candidate,before,receipt,observations,final,retained});
 }
 // Immutable read is separate from current owner/output and input authority.
 for(const kind of ['owner','output','pending','failed']){
  await naturalEnd();const before=await snapshot(),identity=(await evaluate(binding.PAGE_READ)).apps[0],observations=[];let armed=false,receipt;
  const wrapped=async expression=>{
   if(!armed&&expression.includes('t=w.requestCurrentDisplayCapture')){
    armed=true;
    let value;
    if(kind==='pending'||kind==='failed'){
     value=await evaluate(`new Promise(resolve=>{fixture.onFrame=()=>{const v=(${expression}),h=globalThis.__gltronCaptureTicketV1;fixture.negativeTicket=h.ticket;fixture.negativeArm={status:h.ticket.status,at:Date.now()};${kind==='failed'?'fixture.r.windows[65537]={...fixture.win};':''}resolve(v);};})`);
     assert.equal((await evaluate('fixture.negativeArm')).status,'pending');
     if(kind==='failed')await page.waitForFunction("fixture.negativeTicket.status==='failed'");
    }else{
     value=await armAfterPublication(expression);
     await evaluate(kind==='owner'?'fixture.r.windows[65537]={...fixture.win};true':'fixture.r.canvas.width+=1;true');
    }
    receipt=await evaluate('(() => {const h=globalThis.__gltronCaptureTicketV1,t=h.ticket;return {status:t.status,at:Date.now(),metadata:t.status===\'complete\'?t.read().metadata:null};})()');
    return value;
   }
   return evaluate(expression);
  };
  const transaction=binding.captureScene({evaluate:wrapped,identity,onTicketObservation:o=>observations.push(o)});
  if(kind==='pending'){const shot=await transaction;assert.equal(shot.metadata.content,'ordinary-publication-after-request');}
  else await assert.rejects(transaction,e=>{assert(e.ticketObservation);return /changed|failed/.test(e.message);});
  const final=await snapshot();assert.equal(final.calls.length,before.calls.length+1);assert(final.ticketAbsent);
  assert.equal(receipt.status,kind==='failed'?'failed':kind==='pending'?receipt.status:'complete');
  assert.equal(observations.at(-1).status,kind==='pending'?'complete':receipt.status);
  report.atomic['ticketNegative-'+kind]={before,receipt,observations,final};
  if(kind==='output')await evaluate('fixture.r.canvas.width-=1;true');
  await restoreSyntheticOwner();
 }
 {
  const before=await snapshot();let cancel=false;
  const f=binding.createChain({evaluate:async(expression,session)=>{
   if(cancel&&!session&&expression.includes('t=w.requestCurrentDisplayCapture')){
    cancel=false;
    // Run after a genuine producer message schedules ordinary damage and
    // before its normal rAF. Cancel the real pending ticket in that task.
    return evaluate(`new Promise(resolve=>{fixture.onFrame=()=>{const arm=(${expression}),h=globalThis.__gltronCaptureTicketV1;fixture.cancelObservation={before:h.ticket.status,cancelled:h.ticket.cancel(),after:h.ticket.status,at:Date.now()};resolve(arm);};})`);
   }
   return evaluate(expression,session);
  },send,workers,pageSession,app:'gltron'});
  await f.prepareStartup(Date.now()+3000);cancel=true;await assert.rejects(f.capture('cancelled'),/cancelled/);assert(f.closed);await assert.rejects(f.capture('no-reopen'),/closed/);
  const final=await snapshot(),receipt=await evaluate('fixture.cancelObservation');assert.equal(receipt.before,'pending');assert(receipt.cancelled&&receipt.after==='cancelled');assert.equal(final.calls.length,before.calls.length+1);assert(final.ticketAbsent);report.atomic.cancelled={before,final,receipt,closed:f.closed};await naturalEnd();
 }
 // Repeated finite producer intervals can naturally yield an observation
 // window. No timer or sleep is accepted as evidence that a hold ended.
 {
  const before=await snapshot(),observations=[],f=make(binding,()=>plan({frames:20,cycles:4}));
  await f.chain.prepareStartup(Date.now()+5000,s=>observations.push(s));f.activate();const shot=await f.chain.capture('cyclic');const final=await snapshot();
  assert.equal(final.calls.length,before.calls.length+1);assert(!final.calls.at(-1).held);assert(observations.some(s=>s.state==='NOT_READY'));
  report.atomic.cyclic={before,final,observations,metadata:shot.capture.metadata};await page.waitForFunction('fixture.paintEvents.filter(e=>e.event==="end").length>='+String(before.events.filter(e=>e.event==='end').length+4));await naturalEnd();
 }
 assert.equal((await snapshot()).keys.length,0);
}

async function chainControls(){
 const binding=require('../'+controller.HELPER),bytes=Buffer.from('module identity fixture'),hash=binding.sha(bytes);
 function fixture(kind){
  let clock=Date.now(),readback=false,shifted=false,probes=0,requests=0;
  const tick=()=>kind.startsWith('startup-')?Date.now():clock;
  const a=Object.assign(Object.fromEntries(binding.FIELDS.map(k=>[k,'original:'+k])),{name:'gltron',running:true,stopped:false,guestWorker:true,outputVisible:true,guestEndpoint:'guest',slot:0,windowHwnd:65537,processId:991,renderEndpoint:'none',publication:7});
  const workers=new Map([['guest-session',{targetId:'guest-target',sessionId:'guest-session',url:'guest-worker.js',scripts:[{scriptId:'module',sha256:hash,bytecodeAvailable:true}]}]]);
  const evaluate=async expression=>{
   if(expression===binding.PAGE_READ){
    if(readback&&!shifted){shifted=true;clock+=kind==='old-menu'?31000:kind==='old-play'?6000:0;if(kind==='replacement')a.windowObject='replaced';}
    return {isolated:true,apps:[{...a}]};
   }
   if(expression===binding.WORKER_READ){if(kind==='hidden-during-validation')a.outputVisible=false;return {endpointIdentity:'guest',slot:0,instance:'worker-instance'};}
   if(expression.includes('t=w.requestCurrentDisplayCapture')){
    probes++;readback=false;shifted=false;const nonce=JSON.parse(expression.match(/nonce:("[^"]+")/)[1]);
    if(kind==='late-hold'||kind==='startup-timeout'||(kind==='startup-hold'&&probes<3))return {state:'NOT_READY',nonce,requestCalled:false,ticketCreated:false,inputDispatched:false,ready:false,pending:['held/in-flight paint']};
    requests++;
    if(kind==='startup-unknown')throw Error('UNKNOWN arm request; never replay');
    if(kind==='startup-ambiguous')return {state:'NOT_READY',nonce,ready:false,pending:['held'],requestCalled:true,ticketCreated:true,inputDispatched:false};
    return {state:'ARMED',nonce,requestCalled:true,ticketCreated:true,at:tick(),publication:7};
   }
   if(expression.includes('const pending=[]')&&!expression.includes('const t=h.ticket,status'))return {ready:true,at:tick(),publication:7};
   if(expression.includes('const t=h.ticket,status')){if(kind==='failed-ticket'||kind==='startup-failed')return {refused:'capture ticket failed: actual request already called',code:'CAPTURE_TICKET_FAILED'};if(kind==='cancelled')throw Error('capture cancelled; no replay');readback=true;return {data:'data:image/png;base64,eA==',encodeMs:0,metadata:{publication:8,observation:'current-display',content:'already-displayed',completion:'canvas2d-readback',captureOwner:{hwnd:65537,processId:991},composition:{windows:[{hwnd:65537,processId:991}]},output:{width:1,height:1}}};}
   if(expression.includes('h.ticket.cancel()')){a.publication=8;return {status:'complete'};}
   throw Error('unexpected fixture expression');
  };
  const chain=binding.createChain({evaluate,send:async()=>({bytecode:bytes.toString('base64')}),workers,pageSession:'page',app:'gltron',expectedModules:[hash],now:tick});
  return {chain,now:tick,counts:()=>({probes,requests}),replace:()=>{a.windowObject='replacement-between-captures';}};
 }
 for(const kind of ['old-menu','old-play','replacement','unknown','cancelled','between-captures','no-replay','hidden-during-validation','late-hold','failed-ticket']){
  const f=fixture(kind);let effects=0;
  if(kind==='replacement'||kind==='cancelled'||kind==='hidden-during-validation'||kind==='late-hold'||kind==='failed-ticket'){
   await assert.rejects(f.chain.capture('scene'),/identity changed|cancelled|hidden or clipped|precondition refused|capture ticket failed/);assert(f.chain.closed);await assert.rejects(f.chain.capture('again'),/closed/);continue;
  }
  const shot=await f.chain.capture('scene');
  if(kind==='between-captures'){
   f.replace();await assert.rejects(f.chain.capture('new-scene'),/identity changed/);assert(f.chain.closed);continue;
  }
  if(kind==='no-replay'){
   const review={...shot.capture,review:'personally reviewed',maxAgeMs:5000};
   await f.chain.admit(review,async()=>{effects++;return {state:'ACK'};});
   await assert.rejects(f.chain.admit(review,async()=>effects++),/consumed/);
   assert(f.chain.closed);assert.equal(effects,1);continue;
  }
  if(kind.startsWith('old-')){
   assert(f.now()-Date.parse(shot.capture.at)>=(kind==='old-play'?6000:31000),'validation cannot refresh reviewed pixels');
   await assert.rejects(f.chain.admit({...shot.capture,review:'reviewed',maxAgeMs:kind==='old-play'?5000:30000},async()=>effects++),/stale/);
   assert.equal(effects,0);assert(!f.chain.closed,'provably all-unsent stale refusal allows new intent');
  }else{
   await assert.rejects(f.chain.admit({...shot.capture,review:'reviewed',maxAgeMs:5000},async()=>{effects++;throw Error('UNKNOWN effect');}),/UNKNOWN/);
   assert(f.chain.closed);await assert.rejects(f.chain.capture('again'),/closed/);assert.equal(effects,1);
  }
 }
 for(const kind of ['startup-hold','startup-timeout','startup-unknown','startup-failed','startup-ambiguous']){
  const f=fixture(kind),observations=[],deadline=Date.now()+125;
  await f.chain.prepareStartup(deadline,s=>observations.push(s));
  if(kind==='startup-hold'){
   const shot=await f.chain.capture('startup');assert(!f.chain.closed);assert.equal(observations.filter(s=>s.state==='NOT_READY').length,2);assert.deepEqual(f.counts(),{probes:3,requests:1});
   assert(new Set(observations.filter(s=>s.nonce).map(s=>s.nonce)).size===2);
   assert(Date.parse(shot.capture.at)<deadline);
  }else{
   await assert.rejects(f.chain.capture('startup'),kind==='startup-failed'?e=>e.code==='CAPTURE_TICKET_FAILED'&&e.requestCalled&&e.ticketCreated:/bounded PREBIND|UNKNOWN|passive precheck effects/);
   assert(f.chain.closed);await assert.rejects(f.chain.capture('again'),/closed/);assert.equal(f.counts().requests,kind==='startup-timeout'?0:1);
   if(kind==='startup-timeout')assert(Date.now()>=deadline);
  }
 }
}

async function startupControls(){
 const binding=require('../'+controller.HELPER),vm=require('node:vm');
 function fixture(){
  const rect={left:0,top:0,right:640,bottom:480,width:640,height:480},style={display:'block',visibility:'visible',opacity:'1'};
  const canvas={isConnected:true,getBoundingClientRect:()=>rect,contains:()=>false};
  const win={visible:true,w:640,h:480,processId:1,hwnd:65537,wasm:{}},r={canvas,windows:{65537:win},_workerPublicationHeld:()=>r.held,held:true,_immutablePublicationSequence:1,_currentDisplayRecord:{displayedAt:Date.now()},peekKeyDownState:()=>0,_validateCurrentDisplayCapture(req){assert.equal(req.owner.window,win);return this._currentDisplayRecord;}};
  const w={running:true,renderer:r,processId:1,instance:win.wasm,guestWorker:{link:{endpointIdentity:'guest',worker:{},module:{}}}};
  const context=vm.createContext({crypto,performance,crossOriginIsolated:true,document:{visibilityState:'visible',getElementById:()=>canvas,querySelectorAll:()=>[canvas]},getComputedStyle:()=>style,innerWidth:800,innerHeight:600,runningApps:[{name:'gltron',wine:w}]});
  const evaluate=async s=>vm.runInContext(s,context),identity=vm.runInContext(binding.PAGE_READ,context).apps[0];
  return {r,w,evaluate,identity,context};
 }
 {
  const f=fixture(),observations=[];setTimeout(()=>{f.r.held=false;f.r._immutablePublicationSequence++;},50);
  const result=await binding.awaitStartupReady({...f,deadline:Date.now()+1000,onObservation:s=>observations.push(s)});
  assert(result.ready&&observations.some(s=>!s.ready));assert.equal(result.publication,2);
  assert(!f.context.__gltronCaptureTicketV1,'passive startup creates no ticket');
 }
 {
  const f=fixture(),at=Date.now();
  await assert.rejects(binding.awaitStartupReady({...f,deadline:at+75}),e=>e.code==='CAPTURE_PRECONDITION_REFUSED'&&e.inputState==='NOT_SENT');
  assert(Date.now()-at>=75,'actual bounded timeout, no fake clock');
 }
 {
  const f=fixture();setTimeout(()=>{f.r.windows[65537]={...f.r.windows[65537]};},25);
  await assert.rejects(binding.awaitStartupReady({...f,deadline:Date.now()+500}),/identity changed/);
 }
 {
  const f=fixture();
  const precheck=await binding.captureScene(f);assert.equal(precheck.state,'NOT_READY');assert.equal(precheck.requestCalled,false);assert.equal(precheck.ticketCreated,false);assert.equal(precheck.inputDispatched,false);
  assert(!f.context.__gltronCaptureTicketV1,'late hold refuses before first ticket');
 }
 {
  const f=fixture();f.r.held=false;let requests=0;
  f.w.requestCurrentDisplayCapture=()=>{requests++;throw Error('expired transaction called request');};
  await assert.rejects(binding.captureScene({...f,precheckDeadline:Date.now()-1}),/expired before ticket/);
  assert.equal(requests,0);assert(!f.context.__gltronCaptureTicketV1);
 }
 {
  const f=fixture();f.r.held=false;
  const unselected={...f.identity,outputCanvasObject:'not-yet-selected'};
  const selected=await binding.awaitStartupReady({...f,identity:unselected,selectOutput:true,deadline:Date.now()+500});
  assert.equal(selected.outputCanvasObject,f.identity.outputCanvasObject,'select output once from actual ordinary display');
  await assert.rejects(binding.awaitStartupReady({...f,identity:unselected,deadline:Date.now()+500}),/identity changed outputCanvasObject/);
 }
 for(const status of ['pending','failed','cancelled','UNKNOWN']){
  const f=fixture(),observations=[];f.r.held=false;let calls=0,reads=0,cancels=0;
  f.w.requestCurrentDisplayCapture=()=>{calls++;return {status,error:'fixture readback failed',read(){reads++;return null;},cancel(){cancels++;return status==='pending';}};};
  const evaluate=async expression=>{const v=await f.evaluate(expression);if(expression.includes('t=w.requestCurrentDisplayCapture'))f.r.held=true;return v;};
  await assert.rejects(binding.captureScene({...f,evaluate,onTicketObservation:o=>observations.push(o)}),e=>{
   assert.equal(e.ticketObservation.status,status);assert.equal(e.ticketObservation.metadata,null);
   assert.equal(observations.find(o=>o.phase==='poll').paint.held,true);
   return status==='pending'?/while pending/.test(e.message):status==='failed'?e.code==='CAPTURE_TICKET_FAILED':/cancelled|UNKNOWN/.test(e.message);
  });
  assert.equal(calls,1);assert.equal(reads,0,'non-complete bytes must never be read');assert.equal(cancels,1);
  assert(!f.context.__gltronCaptureTicketV1);assert.equal(observations[0].status,status);
 }
 console.log('PASS passive PREBIND readiness and status-specific post-ticket pending/failed/cancelled/UNKNOWN refusal without reads or second request');
}
