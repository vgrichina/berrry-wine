'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {PAGE_READ,same,FIELDS}=require('../tools/gltron-browser-binding.cjs');
const {literalOracle,installInitializedObserver}=require('../tools/gltron-current-native-capture.cjs');
function page(){
  const endpoint={id:7,options:{api:'gl-gps'},closed:false},instance={};
  const gps={endpoint,workerEpoch:3,device:{worker:true}},renderer={windows:{},peekKeyDownState:()=>false};
  const wine={running:true,processId:1000,instance,renderer,hostCtx:{getGlGpsBridge:()=>gps},_renderWorkerManager:{ports:new Map([[7,endpoint]])}};
  const context={runningApps:[{name:'fixture',wine}],crypto:require('node:crypto').webcrypto,crossOriginIsolated:true,document:{visibilityState:'visible',getElementById:()=>null}};
  return {endpoint,gps,wine,context,read:()=>vm.runInNewContext(PAGE_READ,context).apps[0]};
}
test('actual GPS endpoint and bridge generation are included in identity',()=>{
  const p=page(),a=p.read();assert.equal(a.renderEndpoint,7);assert.equal(a.renderApi,'gl-gps');assert.equal(a.renderGeneration,3);assert.notEqual(a.renderBridgeObject,'none');
  p.gps.workerEpoch++;assert.notEqual(p.read().renderGeneration,a.renderGeneration);
});
test('GPS owner mismatch, retirement, failure and ambiguity refuse',()=>{
  for(const alter of [p=>p.gps.endpoint={},p=>p.gps.workerClosing=Promise.resolve(),p=>p.gps.workerAsyncError=Error('context lost'),p=>p.gps.device=null,p=>p.wine._renderWorkerManager.ports.set(8,{id:8,options:{api:'gl'}})]){
    const p=page();alter(p);assert.throws(p.read,/GPS owner|ambiguous/);
  }
});
test('GPS generations cannot reuse an otherwise equal input identity',()=>{
  const a=Object.fromEntries(FIELDS.map(k=>[k,k]));same(a,{...a});assert.throws(()=>same(a,{...a,renderGeneration:4}),/renderGeneration/);
});
test('initial GDI desktop and unrelated transfer are not initialized GPU publications',()=>{
  class R {observePresentationTransfer(){}observePresentationPublication(){}}
  const r=new R(),instance={},canvas={width:480,height:360,getContext:()=>({getImageData:()=>({data:[0,32,64,255]})})},layer={canvas,writeSeq:9};
  const win={hwnd:1,wasm:instance,_dxFrameLayer:layer};
  const bridge={api:'gl-gps',endpoint:{id:2},workerEpoch:1,presenter:{layer,win,presents:1,stamp:8}};
  const root={Win98Renderer:R},apps=[{wine:{renderer:r,instance,hostCtx:{getGlGpsBridge:()=>bridge}}}];
  installInitializedObserver(root,()=>apps);const source={};
  r.observePresentationPublication({source,output:{}},1);assert.equal(root.__nativeInitialized.receipts.length,0);
  r.observePresentationTransfer({},source,[0,0]);r.observePresentationPublication({source,output:{}},2);assert.equal(root.__nativeInitialized.receipts.length,0);
  r.observePresentationTransfer(canvas,source,[0,0]);r.observePresentationPublication({source,output:{}},3);
  const receipt=root.__nativeInitialized.receipts[0];assert.equal(receipt.publication,3);assert.equal(receipt.writeSeq,9);assert.equal(receipt.stamp,8);assert.equal(receipt.endpoint,2);
});
test('opaque white cannot satisfy the independent authored literal scene',()=>{
  const bytes=Buffer.alloc(480*360*4,255),result=literalOracle(bytes,{width:480,height:360});
  assert.equal(result.qualified,false);assert(result.mismatches>160000);assert.equal(result.colors['255,255,255,255'],172800);
});
