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
 const server=http.createServer(),sockets=new Set(),events=[];let failUp=false,lateCapture=false,wrongSession=false,closeRequest=false;
 server.on('upgrade',(req,socket)=>{
  sockets.add(socket);socket.on('close',()=>sockets.delete(socket));let buffer=Buffer.alloc(0);
  const accept=crypto.createHash('sha1').update(req.headers['sec-websocket-key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');
  const response=v=>{const b=Buffer.from(JSON.stringify(v)),head=Buffer.alloc(b.length<126?2:4);head[0]=0x81;if(b.length<126)head[1]=b.length;else{head[1]=126;head.writeUInt16BE(b.length,2);}socket.write(Buffer.concat([head,b]));};
  socket.on('data',chunk=>{buffer=Buffer.concat([buffer,chunk]);while(buffer.length>=2){const opcode=buffer[0]&15;let size=buffer[1]&127,offset=2;if(size===126){if(buffer.length<4)return;size=buffer.readUInt16BE(2);offset=4;}assert(size<65536);if(buffer.length<offset+4+size)return;const mask=buffer.subarray(offset,offset+4);offset+=4;const b=Buffer.from(buffer.subarray(offset,offset+size));for(let i=0;i<b.length;i++)b[i]^=mask[i%4];buffer=buffer.subarray(offset+size);if(opcode===8){socket.end(Buffer.from([0x88,0]));continue;}const v=JSON.parse(b);events.push({at:Date.now(),...v});if(failUp&&v.method==='Input.dispatchKeyEvent')continue;if(closeRequest){socket.end();continue;}if(lateCapture&&v.method==='Page.captureScreenshot'){setTimeout(()=>{if(!socket.destroyed)response({id:v.id,sessionId:v.sessionId,result:{data:'late'}});},3150);continue;}if(wrongSession){response({id:v.id,sessionId:'replacement',result:{}});continue;}response({id:v.id,...(v.sessionId?{sessionId:v.sessionId}:{}),result:v.method==='Target.attachToTarget'?{sessionId:'fixture-page'}:v.method==='Runtime.evaluate'?{result:{value:{apps:[{name:'gltron',processId:1}]}}}:{}});}});
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const stat=fs.readFileSync('/proc/'+process.pid+'/stat','utf8'),startToken=stat.slice(stat.lastIndexOf(')')+2).split(' ')[19];
 try {
  for(const kind of ['scheduled','parent-eof','pair','late-eof']){
   const out=path.join(root,kind);fs.mkdirSync(out);const keys=kind==='pair'?['a','s']:['Enter'];
   const file=out+'/config.json';fs.writeFileSync(file,JSON.stringify({pid:process.pid,startToken,url:'ws://127.0.0.1:'+server.address().port,targetId:'exact-page',keys,name:'pulse'}));
   const child=cp.spawn(process.execPath,[path.resolve(__dirname,'../tools/gltron-browser-controller.cjs'),'release',out,file],{stdio:['pipe','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);const joined=new Promise(r=>child.once('close',(code,signal)=>r({code,signal})));
   const end=Date.now()+2000;while(!stdout.includes('\n')){assert(Date.now()<end);await pause(5);}const armed=JSON.parse(stdout.trim());assert(armed.armed);assert.equal(armed.fallback-armed.at,1750);
   if(kind!=='parent-eof')child.stdin.write(JSON.stringify({at:armed.at+150})+'\n');if(kind==='late-eof')setTimeout(()=>child.stdin.end(),1900);else child.stdin.end();
   const result=await joined;assert.equal(result.code,0,stderr);assert(child.stdout.readableEnded&&child.stderr.readableEnded);
   const up=JSON.parse(fs.readFileSync(out+'/pulse-up.json'));assert.equal(up.state,'ACK');assert(up.ack>=up.due&&up.ack-up.armed<=2000);
   const ups=events.filter(e=>e.method==='Input.dispatchKeyEvent'&&e.at>=armed.at&&e.at<=up.ack);assert.deepEqual(ups.map(e=>e.params.key),[...keys].reverse());assert(ups.every(e=>e.params.type==='keyUp'&&e.sessionId==='fixture-page'));
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
 const {captureScene,PAGE_READ}=require('../'+controller.HELPER);
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
  report.pid=p.pid;report.browser=await c.send('Browser.getVersion');report.runtimeErrors=[];c.event=v=>{if(v.method==='Runtime.exceptionThrown')report.runtimeErrors.push(v.params.exceptionDetails);};
  const target=(await c.send('Target.getTargets')).targetInfos.filter(t=>t.type==='page');assert.equal(target.length,1);
  const session=(await c.send('Target.attachToTarget',{targetId:target[0].targetId,flatten:true})).sessionId;
  const cdp={send:(method,params)=>c.send(method,params,session)};
  const page={waitForFunction:async expression=>{const end=Date.now()+10000;while(true){const r=await cdp.send('Runtime.evaluate',{expression:'!!('+expression+')',returnByValue:true});if(r.result?.value)return;assert(Date.now()<end,'bounded fixture readiness');await pause(20);}}};
  await cdp.send('Runtime.enable',{});await cdp.send('Page.enable',{});await cdp.send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/index.html?debug'});
  await page.waitForFunction('typeof Win98Renderer!=="undefined"&&typeof runningApps!=="undefined"');
  const evaluate=async expression=>{const r=await cdp.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  report.setup=await evaluate(`(() => {
    if(runningApps.length)throw Error('no originals permitted');
    const screen=document.getElementById('screen');screen.width=1024;screen.height=768;const r=new Win98Renderer(screen),instance={exports:{}},w=Object.assign(Object.create(WineAssembly.prototype),{renderer:r,instance,processId:991,running:true,guestWorker:{link:{endpointIdentity:'fixture',slot:0,worker:{},module:{}}}});
    r.createWindow(65537,0x90000000,60,70,480,360,'Capture WebGL workload',0,instance,null);
    const win=r.windows[65537];win.processId=w.processId;
    const canvas=document.createElement('canvas');canvas.width=480;canvas.height=360;
    r.attachWindowSurface(65537,canvas);
    runningApps.push({name:'gltron',wine:w});
    const source=\`const c=new OffscreenCanvas(800,600),g=c.getContext('webgl2');
      if(!g)throw Error('real WebGL2 required');
      const vs=g.createShader(g.VERTEX_SHADER);g.shaderSource(vs,'#version 300 es\\\\nvoid main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.0-1.0,0,1);}');g.compileShader(vs);
      const fs=g.createShader(g.FRAGMENT_SHADER);g.shaderSource(fs,'#version 300 es\\\\nprecision highp float;uniform float blue;out vec4 o;void main(){o=vec4(gl_FragCoord.x/800.0,gl_FragCoord.y/600.0,blue,1);}');g.compileShader(fs);
      const p=g.createProgram();g.attachShader(p,vs);g.attachShader(p,fs);g.linkProgram(p);if(!g.getProgramParameter(p,g.LINK_STATUS))throw Error(g.getProgramInfoLog(p));g.useProgram(p);const blue=g.getUniformLocation(p,'blue');g.uniform1f(blue,0.7);onmessage=({data:m})=>g.uniform1f(blue,m.blue);
      let n=0;setInterval(()=>{for(let i=0;i<32;i++)g.drawArrays(g.TRIANGLES,0,3);const b=c.transferToImageBitmap();postMessage({bitmap:b,n:++n,version:g.getParameter(g.VERSION)},[b]);},30);\`;
    const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'})),worker=new Worker(url);
    globalThis.fixture={r,w,win,canvas,worker,url,frames:0,publications:[],keys:[]};
    const observe=r.observePresentationPublication;r.observePresentationPublication=function(d,n){observe.call(this,d,n);fixture.publications.push({n,at:Date.now()});if(fixture.publications.length>10)fixture.publications.shift();};
    worker.onerror=e=>{fixture.workerError=e.message;};worker.onmessage=({data:m})=>{canvas.getContext('2d').drawImage(m.bitmap,0,0,canvas.width,canvas.height);m.bitmap.close();fixture.frames=m.n;fixture.version=m.version;r.scheduleRepaint();};
    for(const type of ['keydown','keyup'])addEventListener(type,e=>fixture.keys.push({type,key:e.key,at:Date.now(),trusted:e.isTrusted}));
    return {hwnd:win.hwnd,processId:win.processId};
  })()`);
  await page.waitForFunction('fixture.frames>3&&fixture.r._immutablePublicationSequence>3');
  const identity=(await evaluate(PAGE_READ)).apps[0];
  const begin=Date.now();
  const shot=await captureScene({evaluate,identity});report.capture={at:shot.at,elapsedMs:Date.now()-begin,stages:shot.stages,metadata:shot.metadata,sha256:controller.sha(shot.png)};
  for(const w of shot.metadata.composition.windows){assert(w.x>=0&&w.y>=0&&w.x+w.width<=shot.metadata.output.width&&w.y+w.height<=shot.metadata.output.height,'complete owner window inside output');}
  fs.writeFileSync(root+'/complete-scene.png',shot.png,{flag:'wx'});
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
  // A held compositor is refused, never released by the API.
  await evaluate('fixture.r.beginWorkerGuestSlice();true');
  const heldAt=Date.now();await assert.rejects(captureScene({evaluate,identity:(await evaluate(PAGE_READ)).apps[0]}),/held|in-flight/);
  report.held={elapsedMs:Date.now()-heldAt,ticketAbsent:await evaluate('!globalThis.__gltronCaptureTicketV1'),pending:await evaluate('!!fixture.r._immutableCaptureRequest'),depth:await evaluate('fixture.r._workerGuestSliceDepth')};
  assert(report.held.ticketAbsent&&!report.held.pending&&report.held.depth===1);
  await evaluate('fixture.r.endWorkerGuestSlice();fixture.r.scheduleRepaint();true');await pause(100);
  assert(await evaluate('!globalThis.__gltronCaptureTicketV1'),'late publication cannot promote cancelled capture');
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
  // Actual replacement while a ticket waits for ordinary damage.
  const current=(await evaluate(PAGE_READ)).apps[0];
  await evaluate('fixture.r.windows[65537]={...fixture.win};true');
  await assert.rejects(captureScene({evaluate,identity:current}),/changed|selected/);
  assert(await evaluate('!globalThis.__gltronCaptureTicketV1'));
  report.replacementRefused=true;report.version=await evaluate('fixture.version');report.frames=await evaluate('fixture.frames');report.keys=await evaluate('fixture.keys');assert.equal(report.keys.length,0);
  await evaluate('URL.revokeObjectURL(fixture.url);true');report.passed=true;
 }catch(e){report.error=String(e.stack);throw e;}
 finally{
  if(browser){const p=browser.process();await browser.close();report.chrome={code:p.exitCode,signal:p.signalCode,stdoutEOF:p.stdout?.readableEnded??null,stderrEOF:p.stderr?.readableEnded??null};}
  await closeServer(server);report.serverClosed=!server.listening;report.endedAt=new Date().toISOString();fs.writeFileSync(root+'/report.json',JSON.stringify(report,null,2)+'\n');
 }
}


async function chainControls(){
 const binding=require('../'+controller.HELPER),bytes=Buffer.from('module identity fixture'),hash=binding.sha(bytes);
 function fixture(kind){
  let clock=Date.now(),readback=false,shifted=false;
  const a=Object.assign(Object.fromEntries(binding.FIELDS.map(k=>[k,'original:'+k])),{name:'gltron',running:true,stopped:false,guestWorker:true,outputVisible:true,guestEndpoint:'guest',slot:0,windowHwnd:65537,processId:991,renderEndpoint:'none',publication:7});
  const workers=new Map([['guest-session',{targetId:'guest-target',sessionId:'guest-session',url:'guest-worker.js',scripts:[{scriptId:'module',sha256:hash,bytecodeAvailable:true}]}]]);
  const evaluate=async expression=>{
   if(expression===binding.PAGE_READ){
    if(readback&&!shifted){shifted=true;clock+=kind==='old-menu'?31000:kind==='old-play'?6000:0;if(kind==='replacement')a.windowObject='replaced';}
    return {isolated:true,apps:[{...a}]};
   }
   if(expression===binding.WORKER_READ){if(kind==='hidden-during-validation')a.outputVisible=false;return {endpointIdentity:'guest',slot:0,instance:'worker-instance'};}
   if(expression.includes('t=w.requestCurrentDisplayCapture')){readback=false;shifted=false;return {at:clock,publication:7};}
   if(expression.includes('r=t.read()')){if(kind==='cancelled')throw Error('capture cancelled; no replay');readback=true;return {data:'data:image/png;base64,eA==',encodeMs:0,metadata:{publication:8,observation:'current-display',content:'already-displayed',completion:'canvas2d-readback',captureOwner:{hwnd:65537,processId:991},composition:{windows:[{hwnd:65537,processId:991}]},output:{width:1,height:1}}};}
   if(expression.includes('h.ticket.cancel()')){a.publication=8;return {status:'complete'};}
   throw Error('unexpected fixture expression');
  };
  const chain=binding.createChain({evaluate,send:async()=>({bytecode:bytes.toString('base64')}),workers,pageSession:'page',app:'gltron',expectedModules:[hash],now:()=>clock});
  return {chain,now:()=>clock,replace:()=>{a.windowObject='replacement-between-captures';}};
 }
 for(const kind of ['old-menu','old-play','replacement','unknown','cancelled','between-captures','no-replay','hidden-during-validation']){
  const f=fixture(kind);let effects=0;
  if(kind==='replacement'||kind==='cancelled'||kind==='hidden-during-validation'){
   await assert.rejects(f.chain.capture('scene'),/identity changed|cancelled|hidden or clipped/);assert(f.chain.closed);await assert.rejects(f.chain.capture('again'),/closed/);continue;
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
}
