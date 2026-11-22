'use strict';
const assert=require('node:assert/strict');
const {captureMapping,nativePoint,containsPointer}=require('../lib/cli-native-pointer-coordinates');
// Independent oracle: execute the production renderer input methods, rather
// than deriving an expected point with the new containment helper.
class Renderer{}
require('../lib/renderer-input').installInputHandlers(Renderer);
function renderer(t=null,v=null,clip=null){
  const r=new Renderer();r.canvas={width:1024,height:712};
  r._exclusiveTransform=t;r._exclusivePresentationViewport=v;
  r.wasm={exports:{clip_cursor_active:()=>!!clip,
    ...Object.fromEntries(['left','top','right','bottom'].map(k=>['clip_cursor_'+k,()=>clip?.[k]]))}};
  return r;
}
function units(){
 const cases=[
  ['identity',renderer()],
  ['scaled',renderer({srcX:0,srcY:0,srcW:800,srcH:600,dstX:0,dstY:0,dstW:1024,dstH:712})],
  ['offset',renderer({srcX:40,srcY:70,srcW:800,srcH:600,dstX:100,dstY:50,dstW:800,dstH:600})],
  ['letterbox-dpr2',renderer({srcX:0,srcY:0,srcW:800,srcH:600,dstX:0,dstY:0,dstW:1024,dstH:712},
   {outputW:2048,outputH:1424,dstX:224,dstY:112,dstW:1600,dstH:1200,nativeX:40,nativeY:70,nativeW:800,nativeH:600})],
  ['clipped',renderer(null,null,{left:100,top:100,right:900,bottom:600})]
 ];let checked=0,refused=0;
 for(const [name,r]of cases){
  const m=captureMapping(r);
  for(const x of [0,39,99,100,111,112,113,500,899,900,911,912,947,1023,1024,-1])
   for(const y of [0,49,50,55,56,100,300,599,600,655,656,682,711,712,-1]){
    let p;try{p=nativePoint(m,x,y);}catch{refused++;continue;}
    const mapped=r._mapExclusiveInputPoint(x,y),actual=r._applyCursorClip(mapped.x,mapped.y);
    assert.deepEqual(p,{x:actual.x,y:actual.y},name+':'+x+','+y);checked++;
   }
  // Exercise the real press-to-hover call. This non-strict renderer mutates
  // its formal coordinates; reading arguments afterwards aliases those
  // native values and maps a scaled point a second time.
  r._coordinatePressHoverMs=30;r._mouseX=-1;r._mouseY=-1;
  let hover;const stop={};
  r.handleMouseMove=function(x,y){
   const p=this._mapExclusiveInputPoint(x,y);
   hover={input:{x,y},native:this._applyCursorClip(p.x,p.y)};throw stop;
  };
  try{r.handleMouseDown(500,300,1);assert.fail('hover expected');}catch(e){assert.equal(e,stop);}
  assert.deepEqual(hover.input,{x:500,y:300},name+' press must forward original canvas point');
  const p=r._mapExclusiveInputPoint(500,300);
  assert.deepEqual(hover.native,r._applyCursorClip(p.x,p.y),name+' hover maps exactly once');
 }
 const m=captureMapping(cases[1][1]);
 assert.deepEqual(nativePoint(m,947,682),{x:739,y:574});
 const main={hwnd:'0x1',live:true,visible:true,isChild:false,screenX:0,screenY:0,w:800,h:600,
  nativeClientRect:{screenX:4,screenY:24,w:792,h:572}};
 const child={...main,hwnd:'0x2',isChild:true,parent:'0x1',screenX:700,screenY:550,w:100,h:50};
 assert.deepEqual(containsPointer({pointerMapping:m,windows:[main,child]},child,{x:947,y:682}),{x:739,y:574});
 assert.throws(()=>containsPointer({pointerMapping:m,windows:[main,child]},child,{x:500,y:400}),/outside/);
 assert.throws(()=>nativePoint({...m,canvas:{w:0,h:1}},0,0),/invalid/);
 assert.throws(()=>nativePoint(null,0,0));
 assert.throws(()=>require('../lib/cli-native-pointer-coordinates').encodeReviewedCanvas({
  _exclusivePresentationViewport:{},_presentDisplayCanvas:()=>({output:{}})},()=>Buffer.from('wrong')),
  /presentation output unavailable/);
 assert.throws(()=>nativePoint(captureMapping(cases[3][1]),0,0),/presentation/);
 const cut={...main,nativeClientRect:{...main.nativeClientRect,w:730}};
 assert.throws(()=>containsPointer({pointerMapping:m,windows:[cut,child]},child,{x:947,y:682}),/outside/);
 const captionChild={...child,screenY:0,h:30};
 assert.throws(()=>containsPointer({pointerMapping:m,windows:[main,captionChild]},captionChild,{x:947,y:12}),/outside/);
 console.log(`PASS independent production input mapping ${checked} accepted points, ${refused} refusals; identity/scale/offset/DPR/letterbox/clip/edges/child bounds`);
 return {checked,refused};
}
function contextUnits(){
 const {createReviewedContexts}=require('../lib/cli-native-scene');
 let clock=1000;const registry=createReviewedContexts({now:()=>clock,monotonic:()=>clock});
 const main={hwnd:'0x1',generation:'1',live:true,visible:true,isChild:false,title:'fixture',owner:'0x0',parent:'0x0',
  processId:1,threadId:1,screenX:0,screenY:0,w:800,h:600,style:0,controlClass:0};
 const s={windows:[main],mainHwnd:main.hwnd,modalHwnd:'0x0',focus:main.hwnd,focusTopLevel:main.hwnd,
  focusWindow:{...main},capture:'0x0',physicalUp:true,nativeProcess:{pid:1,executable:'fixture'},
  screen:{w:1024,h:712},eip:'0x400000',pointerMapping:captureMapping(renderer(
   {srcX:0,srcY:0,srcW:800,srcH:600,dstX:0,dstY:0,dstW:1024,dstH:712}))};
 const c=registry.capture(()=>s,()=>Buffer.from('complete fixture image'),()=>{});
 const review={contract:c.contract,captureId:c.captureId,pngSHA256:c.pngSHA256,reviewed:true,reviewedAt:clock,scope:'menu',targetHwnd:main.hwnd};
 const event={action:'mousedown',x:947,y:682};
 registry.verify(s,review,event,'one');
 for(const change of [v=>v.pointerMapping.transform.dstW++,v=>v.pointerMapping.canvas.w++,
  v=>v.pointerMapping.sourceHwnd=9,v=>v.pointerMapping.presentationOutput={w:2048,h:1424,filter:true},
  v=>v.pointerMapping.viewport={outputW:2048,outputH:1424,dstX:0,dstY:0,dstW:2048,dstH:1424,nativeX:0,nativeY:0,nativeW:800,nativeH:600},
  v=>v.pointerMapping.clip={left:0,top:0,right:100,bottom:100},v=>v.windows[0].generation='2',
  v=>v.windows[0].owner='0x9',v=>v.windows[0].w--,v=>v.focusWindow.threadId++,v=>v.nativeProcess.pid++]){
  const v=structuredClone(s);change(v);assert.throws(()=>registry.verify(v,review,event,'one'));
 }
 assert.throws(()=>registry.verify(s,review,event,'two'),/another finite intent/);
 assert.throws(()=>registry.verify(s,{...review,pointerMapping:{canvas:{w:1,h:1}}},{...event,x:1024},'one'),/outside/);
 clock=90999;registry.verify(s,review,event,'one');
 clock=91000;assert.throws(()=>registry.verify(s,review,event,'one'),/stale/);
 console.log('PASS retained mapping, window/owner/generation/focus/actor changes, nonce, forged transform and stale refusal');
}
async function native(out){
 const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),{once}=require('node:events');
 const {startControlSession}=require('./control-session'),pause=ms=>new Promise(r=>setTimeout(r,ms));
 fs.mkdirSync(out,{recursive:true});
 for(const screen of ['800x600','1024x712','1400x900','400x300','button-scaled','button-clipped','changed-viewport']){
  const buttonMode=screen.startsWith('button-'),clippedMode=screen==='button-clipped';
  const viewportFault=screen==='changed-viewport';
  const dir=path.join(out,screen);fs.mkdirSync(dir);
  const save=(n,v)=>fs.writeFileSync(path.join(dir,n),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
  const image=path.join(dir,'coordinates.exe');
  const bytes=buttonMode?require('./test-vb5-native-dialog-identity.cjs').fixture():require('./test-cli-native-button-delivery.cjs').fixture(0);
  if(clippedMode){
   const marker=Buffer.from([80,0,65,0,60,0,15,0,1,0,255,255,128,0]);
   const at=bytes.indexOf(marker);assert(at>0);bytes.writeUInt16LE(98,at+2);bytes.writeUInt16LE(30,at+6);
  }
  if(screen!=='800x600'&&!buttonMode){
   const raw=r=>r-0x1000+0x400,u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];
   // Real authored ChangeDisplaySettingsA(CDS_FULLSCREEN), popup 800x600.
   // Ordinary production presentation discovers this public display claim.
   bytes.writeUInt32LE(0x1c40,raw(0x1334));bytes.write('ChangeDisplaySettingsA\0',raw(0x1c42));
   bytes.fill(0,raw(0x3700),raw(0x379c));bytes.writeUInt32LE(0x180000,raw(0x3728));
   bytes.writeUInt32LE(800,raw(0x376c));bytes.writeUInt32LE(600,raw(0x3770));
   const prefix=Buffer.from([0x68,...u32(300),0x68,...u32(700),0x68,...u32(40),0x68,...u32(40),0x68,...u32(0x10cf0000)]);
   const at=bytes.indexOf(prefix);assert(at>0);
   for(const [off,value]of [[1,600],[6,800],[11,0],[16,0],[21,0x90000000]])bytes.writeUInt32LE(value,at+off);
   const code=Buffer.from([0x6a,4,0x68,...u32(0x403700),0xff,0x15,...u32(0x401334),0xe9,...u32(0x402000-(0x402e00+18))]);
   assert.equal(code.length,18);code.copy(bytes,raw(0x2e00));bytes.writeUInt32LE(0x2e00,0x80+24+16);
  }
  fs.writeFileSync(image,bytes);
  const wd=cp.spawn(process.execPath,['-e',`let p;const t=setTimeout(()=>{if(p)try{process.kill(-p,'SIGTERM')}catch{};process.exit(2)},30000);console.log('ARMED');process.stdin.on('data',b=>p=+b);process.stdin.on('end',()=>clearTimeout(t));`]);
  let wo='',we='';wd.stdout.on('data',b=>wo+=b);wd.stderr.on('data',b=>we+=b);const ww=once(wd,'close');
  while(!wo.includes('ARMED'))await pause(5);save('watchdog-armed.json',{pid:wd.pid,beforeNative:true,deadlineMs:30000});
  const server=require('node:net').createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));
  const s=startControlSession(['test/run.js','--exe='+image,'--no-build','--threads','--real-ticks','--screen='+(buttonMode||viewportFault?'1024x712':screen),
   '--control-stdin','--control='+port,'--max-seconds=25','--max-batches=100000000','--stuck-after=0','--quiet-api','--quiet-blocks','--no-close'],{spawnOptions:{detached:true}});
  wd.stdin.write(String(s.child.pid));
  try{
   let snap;for(let i=0;i<100;i++){snap=await s.send({action:'snapshot'});if(snap.focusWindow.live&&snap.windows.length>=2&&(!buttonMode||snap.nativeDialogBox))break;await pause(20);}
   assert(snap.focusWindow.live);
   if(buttonMode)await s.send({action:'eval',code:"renderer.presentationCanvas=renderer._createOffscreen(2048,1424);renderer.presentationFilter=new (process.mainModule.require('../lib/presentation-filter').PresentationFilter)(renderer.presentationCanvas);renderer.singleAppMode=true;renderer.refreshInputPresentation();true"});
   const target=buttonMode?snap.windows.find(w=>w.parent===snap.modalHwnd&&w.controlClass===1):snap.windows.find(w=>w.hwnd===snap.mainHwnd);
   assert(target);const expected=buttonMode?{x:target.screenX+Math.floor(target.w/2),y:target.screenY+Math.floor(target.h/2)}:{x:700,y:300};
   const capture=await s.send({action:'native-reviewed-capture',path:path.join(dir,'fixture.png')});save('capture.json',capture);
   if(buttonMode){
    const png=require('pngjs').PNG.sync.read(fs.readFileSync(path.join(dir,'fixture.png')));
    assert.equal(png.width,1024);assert.equal(png.height,712);
    // A fixed pixel in the displayed blue title bar lies on teal desktop in
    // the old hidden staging image. Independent of the coordinate helper.
    const pixel=(90*png.width+800)*4;
    assert(png.data[pixel+2]>png.data[pixel+1]+40,'complete displayed title bar must be encoded');
    save('display-pixel.json',{x:800,y:90,rgba:[...png.data.subarray(pixel,pixel+4)],logicalImage:{w:png.width,h:png.height},physicalOutput:{w:2048,h:1424}});
   }
   // Synthetic attestation in an authored test only, never an original-game
   // personal review. Expected native point is fixed independently of helper.
   const review={contract:capture.contract,captureId:capture.captureId,pngSHA256:capture.pngSHA256,
    reviewed:true,reviewedAt:Date.now(),scope:'menu',targetHwnd:target.hwnd};
   const point=await s.send({action:'eval',code:`(()=>{renderer.refreshInputPresentation();const p=renderer._unmapExclusiveInputPoint(${expected.x}+.25,${expected.y}+.25);return {x:Math.round(p.x),y:Math.round(p.y),transform:renderer._exclusiveTransform,clientX:instance.exports.wnd_client_screen_x(instance.exports.get_main_hwnd()),clientY:instance.exports.wnd_client_screen_y(instance.exports.get_main_hwnd())}})()`});save('point.json',point);
   if(screen!=='800x600')assert(point.transform,'actual fullscreen transform required');
   const bound=await s.send({action:'guarded-bind',reviewedScene:review});
   if(viewportFault)await s.send({action:'frozen',mode:'on'});
   // A separate process owns physical release; its timer is armed before DOWN.
   const release=cp.spawn(process.execPath,['-e',`console.log('ARMED');setTimeout(async()=>{try{const r=await fetch('http://127.0.0.1:${port}/ctl',{method:'POST',signal:AbortSignal.timeout(500),body:JSON.stringify({action:'guarded-release',owner:${JSON.stringify(bound.owner)}})});console.log(JSON.stringify(await r.json()))}catch(e){console.error(e);process.exitCode=1}},200);`]);
   let ro='',re='';release.stdout.on('data',b=>ro+=b);release.stderr.on('data',b=>re+=b);const rw=once(release,'close');
   while(!ro.includes('ARMED'))await pause(2);
   const sent=Date.now(),nonce='native-'+screen;
   let receipt=await s.send({action:'guarded-input',cmd:'mousedown:'+point.x+':'+point.y,
    guard:{...bound,nonce,reviewed:true,deadline:sent+500,intent:{review}}});
   if(viewportFault){
    assert.equal(receipt.state,'QUEUED');
    await s.send({action:'eval',code:'renderer.canvas.width++;true'});
    await s.send({action:'step',n:1});receipt=await s.send({action:'guarded-status',nonce});
   }
   save('down.json',{sent,at:Date.now(),receipt});
   const [rx,rs]=await rw;save('release-wait.json',{exit:rx,signal:rs,actualWait:true,stdoutEOF:release.stdout.readableEnded,stderrEOF:release.stderr.readableEnded,stdout:ro,stderr:re});assert.equal(rx,0);
   if(clippedMode||viewportFault){assert.equal(receipt.state,'CANCELLED');assert.equal(receipt.handlerApplied,false);assert(!receipt.consumed);save('assertions.json',{screen,clippedChildRefused:clippedMode,changedViewportRefused:viewportFault,zeroHandler:true,independentUp:true});continue;}
   assert.equal(receipt.state,'CONSUMED');assert.equal(receipt.receiptBoundary,buttonMode?'native-button-dispatch-return':'native-input-return');
   assert.equal(receipt.nativeMessage.msg,0x201);
   if(!buttonMode){const lp=receipt.nativeMessage.lParam>>>0;
   assert.equal(lp&65535,700-point.clientX,JSON.stringify(receipt));
   assert.equal(lp>>>16,300-point.clientY,JSON.stringify(receipt));
   }else assert.equal(receipt.nativeMessage.hwnd,parseInt(target.hwnd,16));
   await pause(80);snap=await s.send({action:'snapshot'});save('after.json',snap);
   if(buttonMode){assert.notEqual(snap.modalHwnd,capture.snapshot.modalHwnd);save('assertions.json',{screen,expectedNative:expected,syntheticAuthoredAttestation:true,nativeButton:true,physicalUp:true});continue;}
   assert.equal(snap.windows.find(w=>w.hwnd===snap.mainHwnd).title,'UP after DOWN');
   const moves=[...s.output().matchAll(/\[check_input\] msg=0x200 wParam=0x[0-9a-f]+ lParam=0x([0-9a-f]+)/g)];
   assert(moves.length,'actual native hover required');
   const hoverLP=parseInt(moves.at(-1)[1],16)>>>0;
   assert.equal(hoverLP&65535,700-point.clientX,'native hover and DOWN must share client X');
   assert.equal(hoverLP>>>16,300-point.clientY,'native hover and DOWN must share client Y');
   save('hover-coordinate.json',{source:'actual native check_input log',clientX:hoverLP&65535,clientY:hoverLP>>>16,matchingDown:true});
   await s.send({cmd:'keydown:27'});await pause(30);await s.send({cmd:'keyup:27'});s.child.stdin.end();await s.exited;
   assert.equal(s.child.exitCode,0);save('assertions.json',{screen,expectedNative:{x:700,y:300},syntheticAuthoredAttestation:true,queuedDown:true,physicalUp:true});
  }finally{
   if(s.child.exitCode===null&&s.child.signalCode===null)process.kill(-s.child.pid,'SIGTERM');await s.exited;
   fs.writeFileSync(path.join(dir,'native.log'),s.output());save('native-wait.json',{pid:s.child.pid,exit:s.child.exitCode,signal:s.child.signalCode,actualWait:true,stdoutEOF:s.child.stdout.readableEnded,stderrEOF:s.child.stderr.readableEnded});
   wd.stdin.end();const [exit,signal]=await ww;save('watchdog-wait.json',{exit,signal,actualWait:true,stdoutEOF:wd.stdout.readableEnded,stderrEOF:wd.stderr.readableEnded,stdout:wo,stderr:we});assert.equal(exit,0);
  }
 }
 console.log('PASS native rendered identity/scaled/offset/letterbox/nonclient points, scaled DPR2 native child BUTTON, guarded queue and independent UP');
}
module.exports={units,renderer,contextUnits,native};
if(require.main===module){if(process.argv[2]==='--native')native(require('node:path').resolve(process.argv[3])).catch(e=>{console.error(e);process.exitCode=1;});else{units();if(process.argv.includes('--context'))contextUnits();}}
