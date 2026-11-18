'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm');
const {inspectCapture}=require('../tools/nfs3-capture-composition.cjs');
async function run(change,deliver=true){
 let now=1000,producer=1000,reads=0,turns=0;
 const scene=[2,1000,10,10,0,0,1,0,1,0],canvas={width:1,height:1,getContext:()=>({getImageData:()=>{now+=100;reads++;return {data:new Uint8ClampedArray([2,3,4,255])};}})};
 const actor={worker:{},endpointIdentity:7},win={hwnd:10,processId:1000,wasm:{},visible:true,w:1,h:1,_backCanvas:canvas};
 const layer={canvas},renderer={windows:{10:win},canvas,presentationCanvas:canvas,
 _presentationStack:()=>({sorted:[win],top:win,exclusive:false}),_overlayFrameLayer:()=>layer};
 const wine={renderer,memory:{buffer:{}},instance:win.wasm,_wasmModule:{},_processObject:{},guestWorker:{link:{slot:0},threadLinks:new Map([[1,actor]])},
 hostCtx:{d3dimBridge:{endpoint:{},presenter:{win,layer}}},_renderWorkerManager:{worker:{}},
 _browserNativeInput:{snapshot:()=>({scene:scene.slice(),slot:1,healthy:true,terminal:false,observedAt:producer,ready:now-producer<=250})}};
 const ctx={Date:{now:()=>now},performance:{timeOrigin:0,now:()=>now},Uint8ClampedArray,
 setTimeout:fn=>{turns++;now+=10;if(deliver)producer=now;change?.({wine,win,actor,scene,layer,renderer});queueMicrotask(fn);}};
 const f=vm.runInNewContext('('+inspectCapture.toString()+')',ctx);
 const result=await f(wine);return {result,reads,turns};
}
(async()=>{
 const {result,reads,turns}=await run();assert.equal(reads,4);assert.equal(turns,1);
 const old=result.rows.find(r=>r.name==='guard-after-sync-reads');assert.equal(old.value.ready,false,'old synchronous ordering ages metadata');
 assert.equal(old.after.wall,1400);assert.equal(old.value.observedAt,1000);
 assert.equal(result.final.ready,true);assert.equal(result.final.observedAt,1410,'only delivered producer is accepted');
 assert.equal(result.rows.find(r=>r.name==='retained-pixels').before.wall,1300);
 for(const [name,change]of Object.entries({
  endpoint:f=>f.wine.hostCtx.d3dimBridge.endpoint={},worker:f=>f.actor.worker={},retired:f=>f.actor._retirementComplete=true,
  reused:f=>f.renderer.windows[10]={...f.win},foreign:f=>f.win.wasm={},process:f=>f.win.processId++,
  target:f=>f.wine.hostCtx.d3dimBridge.presenter.win={},source:f=>f.layer.canvas={},generation:f=>f.scene[6]++,
  unselected:f=>f.renderer._presentationStack=()=>({sorted:[],top:null}),
  hidden:f=>f.win.visible=false,
 }))await assert.rejects(run(change),/changed|not selected/,name);
 await assert.rejects(run(null,false),/expired/,'stale producer never renewed');
 console.log('PASS timed pixel/guard ordering, delivered producer, fixed deadline and owner/retired/reused/foreign/unselected negatives');
})().catch(e=>{console.error(e);process.exitCode=1;});
