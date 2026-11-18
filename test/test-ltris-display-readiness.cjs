'use strict';
const assert = require('node:assert/strict');
const {Win98Renderer} = require('../lib/renderer');
const {createCanvas} = require('../lib/raster-canvas');
const {startupDisplayReadiness: ready} = require('../tools/ltris-display-readiness.cjs');

function fixture() {
  const r = new Win98Renderer(createCanvas(80,80));
  r.repaint(); // Actual ordinary desktop publication, before SDL ShowWindow.
  const w = {hwnd:123,processId:1000,wasm:{},x:5,y:5,w:40,h:40,z:1,
    style:0x80000000,visible:true,isChild:false,_backCanvas:createCanvas(40,40)};
  r.windows[w.hwnd]=w;
  const owner={hwnd:w.hwnd,processId:w.processId,instance:w.wasm,window:w};
  return {r,w,owner};
}
const deadline=Date.now()+30000;
{
  const {r,w,owner}=fixture();
  assert.throws(()=>r._validateCurrentDisplayCapture({owner}),/owner changed, hidden or clipped/);
  assert.equal(ready(r,owner,deadline).ready,false);
  assert.equal(r._immutableCaptureRequest,null);
  r.repaint();
  assert.equal(ready(r,owner,deadline).ready,true);
  const t=r.requestCurrentDisplayCapture(owner);
  assert.equal(t.status,'complete');
  assert.equal(t.read().metadata.captureOwner.hwnd,w.hwnd);
}
for (const kind of ['window','instance','hidden','clipped','region','stack','pixel-error','output','expired']) {
  const {r,w,owner}=fixture();
  if(kind==='window')r.windows[w.hwnd]={...w};
  if(kind==='instance')w.wasm={};
  if(kind==='hidden')w.visible=false;
  if(kind==='clipped')w.x=-1;
  if(kind==='region')w.region={};
  if(kind==='stack')r.windows[456]={...w,hwnd:456};
  if(kind==='pixel-error')r._currentDisplayRecord.pixelError=Error('actual readback failed');
  if(kind==='output')r.canvas=createCanvas(80,80);
  assert.throws(()=>ready(r,owner,kind==='expired'?0:deadline));
}
for(const kind of ['window','geometry','hidden','error']) {
  const {r,w,owner}=fixture();r.repaint();
  if(kind==='window')r.windows[w.hwnd]={...w};
  if(kind==='geometry')w.x++;
  if(kind==='hidden')w.visible=false;
  if(kind==='error')r._currentDisplayRecord.pixelError=Error('invalid capture');
  r.beginWorkerGuestSlice();
  assert.throws(()=>ready(r,owner,deadline),'replacement/error cannot hide behind writer wait');
}
console.log('PASS actual renderer desktop-before-SDL old-fail/new-NOT_READY then ordinary-ready/readback; replacement/hidden/clipped/error/expiry fail closed');
{
  const {requireFreshReview}=require('../tools/ltris-display-readiness.cjs');
  const frame={label:'whole',sha256:'actual-frame-hash',at:1000,metadata:{readbackCompletedAt:900}};
  const command={review:frame.label,sha256:frame.sha256,observation:'personally viewed whole frame'};
  requireFreshReview(command,frame,15899);
  assert.throws(()=>requireFreshReview(command,frame,15900));
  assert.throws(()=>requireFreshReview({...command,sha256:'other'},frame,1001));
}
