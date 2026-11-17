'use strict';
// Public-output observer controls; this test never launches original Boids.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {installObserver,selectWindow}=require('../tools/boids-current-runtime.cjs');
const seen=[];class Executor{execute(r){seen.push(r);if(r.fail)throw Error('native failure');return 731;}stats(){return {draws:seen.length};}}
const root={Fake:{Executor}};installObserver(root,'Fake');installObserver(root,'Fake');const e=new Executor();
// Loading another executor must not hide records from the active executor.
class OtherExecutor{execute(){return 12;}}
root.Other={Executor:OtherExecutor};installObserver(root,'Other');
const data=new Uint8Array([1,2,3]);const record={name:'DRAW_UP',seq:1,fields:{count:3},refs:[{input:true,pos:0,len:3}],arena:()=>data};
assert.equal(e.execute(record),731);data[0]=99;record.fields.count=9;
assert.equal(root.__boidsPublicTrace,root.__boidsPublicTraces.Fake);
assert.equal(root.__boidsPublicTraces.Other.executor,'Other');
assert.deepEqual(root.__boidsPublicTrace.pending[0].inputs[0].bytes,[1,2,3]);assert.equal(root.__boidsPublicTrace.pending[0].fields.count,3);
assert.throws(()=>e.execute({...record,fail:true}),/native failure/);
const present={name:'PRESENT',seq:2,fields:{},refs:[]};for(let i=0;i<3;i++)e.execute(present);assert.equal(root.__boidsPublicTrace.frames.length,2);
for(let i=0;i<600;i++)e.execute(record);assert.equal(root.__boidsPublicTrace.pending.length,512);assert(root.__boidsPublicTrace.dropped>0);assert.equal(seen.length,605);
const app=require('../lib/apps').APPS.dx_boids;assert.equal(app.exe,'binaries/dx-sdk/bin/boids.exe');assert.equal(app.files.length,37);
// These original SDK models deliberately differ from the deployed copies
// catalogued by app-file-sizes. Pin the retained original bytes explicitly.
const originalModels={
  'camera.x':'1c56daf9d94fa31c3a721d69d07d223c44ebe1972914af497da40dd251295383',
  'mslogo.x':'bbe967bbe686d5b3bc25979b70abf2d8ce6aea4b821f4ced9ca59d7902a6727d',
  'sphere2.x':'804a4b79b7de03ed529bc7af7e9a904278956d6c052c9b81cc617ce703d633be'
};
for(const f of app.files){const expected=originalModels[f.url.split('/').pop()];
  if(expected)assert.equal(require('crypto').createHash('sha256').update(fs.readFileSync(f.url)).digest('hex'),expected,f.url);
  else assert.equal(fs.statSync(f.url).size,f.size,f.url);
}
assert.throws(()=>require('../lib/gpu-stream-webgl').Executor.prototype.execute.call({gl:{isContextLost:()=>true}},{}),/context lost/);
const instance={},win={hwnd:65537,visible:true,w:640,h:480,processId:1000,wasm:instance},owner={processId:1000,instance,renderer:{windows:{65537:win}}};
assert.equal(selectWindow(owner),win);assert.throws(()=>selectWindow({...owner,instance:{}}),/missing/);
owner.renderer.windows[65538]={...win,hwnd:65538};assert.throws(()=>selectWindow(owner),/ambiguous/);
console.log('PASS passive public-record preservation, copied inputs, exception propagation, bounded frames; complete registered Boids media manifest');
async function driverControls(trace=false){
  const {installDriver}=require('../tools/boids-current-driver.cjs');
  function setup(status='complete'){
    const instance={},win={hwnd:71,visible:true,w:32,h:32,processId:1000,wasm:instance},renderer={windows:{},_currentDisplayRecord:{windows:[{window:new WeakRef(win)}]}};
    let requests=0,cancelled=0;
    const w={instance,processId:1000,renderer,running:true,requestCurrentDisplayCapture(){requests++;return {status,error:'authored control',cancel(){cancelled++;},read(){return {metadata:{observation:'current-display',captureOwner:{hwnd:71,processId:1000},readbackCompletedAt:Date.now(),source:{width:1,height:1},output:{width:1,height:1}},sourceRGBA:new Uint8Array(4),outputRGBA:new Uint8Array(4)};}};}};
    w._renderWorkerManager={ports:new Map([[1,{id:1,closed:false}]]),_failure:null};w.hostCtx={d3dimBridge:{device:{},stats:{records:1}}};
    const logs=[];
    const context=vm.createContext({runningApps:[{name:'selected',wine:w}],Date,setTimeout,console:{debug:s=>logs.push(s)},innerWidth:32,innerHeight:32,btoa:s=>Buffer.from(s,'binary').toString('base64')});
    const install=(app='selected',ms=500)=>vm.runInContext('('+installDriver.toString()+')(globalThis,'+JSON.stringify({app,mode:'coop',deadline:Date.now()+ms,trace})+')',context);
    install();return {context,w,win,renderer,install,get requests(){return requests;},get cancelled(){return cancelled;}};
  }
  const delayed=setup();setTimeout(()=>{delayed.renderer.windows[71]=delayed.win;},35);
  const before=Date.now();await delayed.context.__boidsDriver.ready();assert(Date.now()-before>=30);
  assert.equal((await delayed.context.__boidsDriver.capture()).metadata.captureOwner.hwnd,71);
  for(let i=0;i<30;i++)await delayed.context.__boidsDriver.capture();
  assert.equal(delayed.context.__boidsCaptureTrace?.length||0,trace?64:0,'trace bounded and opt-in');
  const brokenLog=setup();brokenLog.renderer.windows[71]=brokenLog.win;
  brokenLog.context.console.debug=()=>{throw Error('authored observer failure');};
  await brokenLog.context.__boidsDriver.ready();
  assert.equal((await brokenLog.context.__boidsDriver.capture()).metadata.captureOwner.hwnd,71);
  for(const fault of ['absent','wrong-process','wrong-instance','replaced-window','replaced-renderer','stopped','failed','closed','retired','lost']){
    const f=setup();f.renderer.windows[71]=f.win;await f.context.__boidsDriver.ready();
    if(fault==='absent')delete f.renderer.windows[71];
    if(fault==='wrong-process')f.win.processId++;
    if(fault==='wrong-instance')f.win.wasm={};
    if(fault==='replaced-window')f.renderer.windows[71]={...f.win};
    if(fault==='replaced-renderer')f.w.renderer={...f.renderer};
    if(fault==='stopped')f.w._stopped=true;
    if(fault==='failed')f.w._renderWorkerManager._failure=Error('failed native manager');
    if(fault==='closed')f.w._renderWorkerManager.ports.get(1).closed=true;
    if(fault==='retired')f.w._renderWorkerRetired=true;
    if(fault==='lost')f.w.hostCtx.d3dimBridge.workerAsyncError=Error('lost native stream');
    await assert.rejects(f.context.__boidsDriver.capture());assert.equal(f.requests,0,fault);
  }
  for(const status of ['failed','UNKNOWN','cancelled']){
    const f=setup(status);f.renderer.windows[71]=f.win;await f.context.__boidsDriver.ready();
    await assert.rejects(f.context.__boidsDriver.capture(),/DISPLAY_UNKNOWN/);
    await assert.rejects(f.context.__boidsDriver.capture());assert.equal(f.requests,1);assert.equal(f.cancelled,1);
  }
  // Corrupt only returned protocol data in unit controls, never native output.
  for(const fault of ['wrong-capture-owner','incomplete-array','late-data','wrong-observation']){
    const f=setup();f.renderer.windows[71]=f.win;await f.context.__boidsDriver.ready();
    const request=f.w.requestCurrentDisplayCapture;
    f.w.requestCurrentDisplayCapture=()=>{const t=request();return {...t,read(){const r=t.read();
      if(fault==='wrong-capture-owner')r.metadata.captureOwner.hwnd++;
      if(fault==='incomplete-array')r.outputRGBA=new Uint8Array(3);
      if(fault==='late-data')r.metadata.readbackCompletedAt=Date.now()+6000;
      if(fault==='wrong-observation')r.metadata.observation='partial';
      return r;}};};
    await assert.rejects(f.context.__boidsDriver.capture());await assert.rejects(f.context.__boidsDriver.capture());assert.equal(f.requests,1);
  }
  const absent=setup();absent.install('absent',45);await assert.rejects(absent.context.__boidsDriver.ready(),/deadline/);assert.equal(absent.requests,0);
  const pending=setup('pending');pending.renderer.windows[71]=pending.win;pending.install('selected',60);await pending.context.__boidsDriver.ready();
  await assert.rejects(pending.context.__boidsDriver.capture(),/late|deadline/);assert.equal(pending.cancelled,1);
  console.log('PASS shared exact driver delayed window, absent/wrong/replaced owners, failed/UNKNOWN/pending, fixed deadlines and sticky refusal; trace='+trace);
}
// Start the timed controls after the synchronous full-frame oracle blocks.
// Their CPU work must not consume the delayed-window control's own deadline.
setImmediate(()=>driverControls().then(()=>driverControls(true)).catch(e=>{console.error(e);process.exitCode=1;}));
{
  const {Bridge}=require('../lib/gpu-stream-host');
  const b=new Bridge({api:'d3dim-gps'});let shown=0,closed=0;
  b.workerEpoch=7;b.device={};b.endpoint={closed:false};b.presenter={present(){shown++;}};
  const frame=()=>({bitmap:{close(){closed++;}}});
  b._workerFrame(frame(),6);assert.equal(closed,1);
  for(const fault of ['workerAsyncError','workerClosing','endpoint','device']){
    const old=b[fault];b[fault]=fault==='endpoint'?{closed:true}:fault==='device'?null:Error('authored loss');
    b._workerFrame(frame(),7);b[fault]=old;
  }
  assert.equal(shown,0);assert.equal(closed,5);b._workerFrame(frame(),7);assert.equal(shown,1);
  console.log('PASS source epoch, lost stream/context fault, closing and closed endpoint refusal before bitmap publication; every refused bitmap closed');
}
// Production dirty-rectangle merge and delayed delivery order. Every byte of
// the composed image is checked against literal colours, including offsets.
{
  const {Win98Renderer}=require('../lib/renderer'),{createCanvas}=require('../lib/raster-canvas');
  const r=Object.create(Win98Renderer.prototype),canvas=createCanvas(6,4),ctx=canvas.getContext('2d');
  const fill=color=>{ctx.fillStyle=color;ctx.fillRect(0,0,6,4);};fill('#0000ff');
  const exports={d3dim_gps_window_present:()=>10},instance={exports},win={hwnd:91,wasm:instance},layer={api:'d3dim-gps',kind:'gpu',canvas,d3dimWindow:win,d3dimInstance:instance,d3dimPresentSeq:10};
  win._dxFrameLayer=layer;r.windows={91:win};r._createOffscreen=createCanvas;r._frameLayerOffset=()=>({x:2,y:1});
  const presentation={targetHwnd:91,surface:{rgbaRect(x,y,w,h){const b=new Uint8Array(w*h*4);for(let i=0;i<b.length;i+=4)b.set([255,0,0,255],i);return b;}}};
  assert.equal(r.composeD3dimWindowGdiUpload(91,presentation,3,2,5,4,{d3dim_gps_window_present:()=>10}),false,'foreign native instance refused');
  r.composeD3dimWindowGdiUpload(91,presentation,3,2,5,4,exports);
  const verify=(base,patch)=>{const b=ctx.getImageData(0,0,6,4).data;for(let y=0;y<4;y++)for(let x=0;x<6;x++)assert.deepEqual([...b.subarray((y*6+x)*4,(y*6+x+1)*4)],patch&&x>=1&&x<3&&y>=1&&y<3?[255,0,0,255]:base);};
  verify([0,0,255,255],true);fill('#0000ff');r.composeD3dimPendingGdi(win,layer,10);verify([0,0,255,255],true);
  fill('#00ff00');r.composeD3dimPendingGdi(win,layer,11);verify([0,255,0,255],false);
  assert.equal(win._d3dimGdiPatches.length,0,'later native PRESENT covers earlier GDI damage');
  r.windows[91]={...win};assert.equal(r._overlayFrameLayer(r.windows[91]),null,'same handle/new window object cannot inherit GPU ownership');
  console.log('PASS full literal dirtyrect composition, client offsets, delayed matching record replay, later record replacement and HWND object reuse refusal');
}
// The ownership oracle refuses even a single corrupted pixel anywhere in
// the full frame, including alpha, and never derives expected pixels from it.
{
  const {classifyOwnershipPixels}=require('../tools/boids-current-owner.cjs');
  for(const kind of ['blue','black','red','green']){
    const b=Buffer.alloc(640*480*4);
    for(let y=0;y<480;y++)for(let x=0;x<640;x++){
      const rect=x<320&&y>=1&&y<=240;
      const c=kind==='red'?[255,0,0,255]:kind==='green'?[0,255,0,255]:rect?[0,0,kind==='blue'?255:0,255]:[255,255,255,255];
      b.set(c,(y*640+x)*4);
    }
    assert.equal(classifyOwnershipPixels(b,640,480).kind,kind);
    b[b.length-1]=254;assert.equal(classifyOwnershipPixels(b,640,480).kind,'other');
  }
  assert.equal(classifyOwnershipPixels(Buffer.alloc(4),1,1).reason,'extent');
  const sequence=require('../tools/boids-current-fixture.cjs').ownershipSequenceSource();
  assert(sequence.includes('((GetTickCount()-started)/2000)%4'));
  assert(sequence.includes('FillRect(dc,r,brush)'));assert(!sequence.includes('GetAsyncKeyState(27)'));
  console.log('PASS independent full-pixel GPU/GDI oracle, single-pixel alpha corruption, extent refusal and public native sequence');
}
// The passive presenter observer preserves errors/returns and bounds storage.
{
  const {installPresentationObserver}=require('../tools/boids-current-runtime.cjs');
  class Presenter{constructor(){this.presents=0;this.stale=0;}present(f){if(f.fail)throw Error('present failed');this.presents++;return 19;}}
  const root={GpuStreamHost:{Presenter}};installPresentationObserver(root);installPresentationObserver(root);const p=new Presenter();
  const f={hwnd:1,width:2,height:2,stamp:1};
  assert.equal(p.present(f),19);assert.deepEqual(f,{hwnd:1,width:2,height:2,stamp:1});
  assert.throws(()=>p.present({...f,fail:true}),/present failed/);
  for(let i=0;i<100;i++)p.present(f);
  assert.equal(root.__boidsPresentationTrace.rows.length,64);assert.equal(root.__boidsPresentationTrace.count,102);assert.equal(root.__boidsPresentationTrace.errors,1);
}
// Observation runs after native completion, once per selected frame, and
// preserves the callback and thrown completion. These are observer unit controls.
{
  const {installPixelObserver}=require('../tools/boids-current-runtime.cjs');
  const rgba=new Uint8Array([0,0,255,255,0,0,0,255]);let sends=0;
  class Canvas{constructor(w,h){this.width=w;this.height=h;}getContext(){return {drawImage(){},getImageData(){return {data:rgba};}};}}
  class PixelExecutor{constructor(){this.onPresent=()=>{sends++;return 7;};}execute(rec){if(rec.fail)throw Error('completion failed');return this.onPresent({pixels:rgba,width:2,height:1,hwnd:71,stamp:0});}}
  const r={GpuStreamWebGL:{Executor:PixelExecutor},OffscreenCanvas:Canvas};installPixelObserver(r);installPixelObserver(r);r.__boidsPixelStages.startedAt-=16000;
  const executor=new PixelExecutor(),callback=executor.onPresent;
  for(let i=0;i<8;i++)assert.equal(executor.execute({name:'PRESENT',seq:i,fields:{rt:3}}),7);
  assert.equal(r.__boidsPixelStages.rows.length,2);assert.equal(sends,8);assert.equal(executor.onPresent,callback);
  assert.equal(r.__boidsPixelStages.rows[0].pixels.nonblack,1);assert.equal(r.__boidsPixelStages.rows[0].pixels.opaque,2);
  r.__boidsPixelStages.rows=[];
  assert.throws(()=>executor.execute({name:'PRESENT',fail:true}),/completion failed/);assert.equal(executor.onPresent,callback);
  assert.equal(r.__boidsPixelStages.rows.length,0);
  const source=require('../tools/boids-current-fixture.cjs').device2Source();
  for(const fragment of ['0x6aae1ec1','C1(device,6,vp)','C1(device,13,vp)','C0(device,10)','C0(device,11)','[30])(device,4,2','C3(vp,12,1,rect,3)','640,480,16'])assert(source.includes(fragment),fragment);
  console.log('PASS bounded ordinary completion pixel observer, callback/errors preserved, Device2 ABI source controls');
}
