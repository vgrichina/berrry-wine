'use strict';
// Public-output observer controls; this test never launches original Boids.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {installObserver,selectWindow,installSoftwareObserver}=require('../tools/boids-current-runtime.cjs');
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
for(const f of app.files)assert.equal(fs.statSync(f.url).size,f.size,f.url);
const instance={},win={hwnd:65537,visible:true,w:640,h:480,processId:1000,wasm:instance},owner={processId:1000,instance,renderer:{windows:{65537:win}}};
assert.equal(selectWindow(owner),win);assert.throws(()=>selectWindow({...owner,instance:{}}),/missing/);
owner.renderer.windows[65538]={...win,hwnd:65538};assert.throws(()=>selectWindow(owner),/ambiguous/);
const memory={buffer:new ArrayBuffer(16384)},d=new DataView(memory.buffer);[1,4,1,8192,3,4096].forEach((n,i)=>d.setUint32(i*4,n,true));
let calls=0;const sw={D3DIMRenderWorker:{create:()=>({execute(m){calls++;if(m.fail)throw Error('raster failure');return 9;}})}};
installSoftwareObserver(sw);const adapter=sw.D3DIMRenderWorker.create({memory,instance:{exports:{guest_to_wasm:p=>p}}});
assert.equal(adapter.execute({opcode:0x20000,wa:0}),9);assert.equal(sw.__boidsPublicTrace.records[0].complete,true);assert.equal(sw.__boidsPublicTrace.records[0].state.length,4096);assert.equal(sw.__boidsPublicTrace.records[0].vertices.length,96);
assert.throws(()=>adapter.execute({opcode:0x20000,wa:0,fail:true}),/raster failure/);assert.equal(sw.__boidsPublicTrace.records[1].complete,false);assert.equal(calls,2);
console.log('PASS passive public-record preservation, copied inputs, exception propagation, bounded frames; complete registered Boids media manifest');
async function driverControls(){
  const {installDriver}=require('../tools/boids-current-driver.cjs');
  function setup(status='complete'){
    const instance={},win={hwnd:71,visible:true,w:32,h:32,processId:1000,wasm:instance},renderer={windows:{},_currentDisplayRecord:{windows:[{window:new WeakRef(win)}]}};
    let requests=0,cancelled=0;
    const w={instance,processId:1000,renderer,running:true,requestCurrentDisplayCapture(){requests++;return {status,error:'authored control',cancel(){cancelled++;},read(){return {metadata:{observation:'current-display',captureOwner:{hwnd:71,processId:1000},readbackCompletedAt:Date.now(),source:{width:1,height:1},output:{width:1,height:1}},sourceRGBA:new Uint8Array(4),outputRGBA:new Uint8Array(4)};}};}};
    w._renderWorkerManager={ports:new Map([[1,{id:1,closed:false}]]),_failure:null};w.hostCtx={d3dimBridge:{device:{},stats:{records:1}}};
    const context=vm.createContext({runningApps:[{name:'selected',wine:w}],Date,setTimeout,innerWidth:32,innerHeight:32,btoa:s=>Buffer.from(s,'binary').toString('base64')});
    const install=(app='selected',ms=500)=>vm.runInContext('('+installDriver.toString()+')(globalThis,'+JSON.stringify({app,mode:'coop',deadline:Date.now()+ms})+')',context);
    install();return {context,w,win,renderer,install,get requests(){return requests;},get cancelled(){return cancelled;}};
  }
  const delayed=setup();setTimeout(()=>{delayed.renderer.windows[71]=delayed.win;},35);
  const before=Date.now();await delayed.context.__boidsDriver.ready();assert(Date.now()-before>=30);
  assert.equal((await delayed.context.__boidsDriver.capture()).metadata.captureOwner.hwnd,71);
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
  console.log('PASS shared exact driver delayed window, absent/wrong/replaced owners, failed/UNKNOWN/pending, fixed deadlines and sticky refusal');
}
driverControls().catch(e=>{console.error(e);process.exitCode=1;});
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
