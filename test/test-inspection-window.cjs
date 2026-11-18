'use strict';
const assert=require('node:assert/strict');
const {PNG}=require('pngjs');
const {connectInspector,inspectWholePage,InspectionScope,readInspectionReadiness}=require('../tools/inspection-window.cjs');
(async()=>{
  let options;
  await connectInspector('http://127.0.0.1:1',{connect:async o=>{options=o;return {};}});
  assert.deepEqual(options,{browserURL:'http://127.0.0.1:1',defaultViewport:null});
  const state={viewport:{width:13,height:7,dpr:1},canvases:[{width:13,height:7}],apps:[{windows:[{generation:'12'}]}]};
  const bytes=PNG.sync.write(new PNG({width:13,height:7}));
  let calls=0;
  const page={evaluate:async()=>structuredClone(state),screenshot:async o=>{
    calls++;assert.deepEqual(o,{type:'png',fullPage:false,captureBeyondViewport:false});return bytes;
  }};
  assert.equal((await inspectWholePage(page,state)).width,13);
  assert.equal(calls,1);
  await assert.rejects(inspectWholePage(page,{...state,viewport:{width:800,height:600,dpr:1}}),/attachment changed/);
  assert.equal(calls,1);
  let reads=0;
  await assert.rejects(inspectWholePage({...page,evaluate:async()=>{
    const s=structuredClone(state);if(reads++)s.apps[0].windows[0].generation='13';return s;
  }}),/capture changed/);
  await assert.rejects(inspectWholePage({...page,screenshot:async()=>PNG.sync.write(new PNG({width:8,height:6}))}),/whole image width/);
  let samples=0,mutated=false;
  const startup={...page,evaluate:async fn=>{
    if(fn===readInspectionReadiness)return ++samples>1;
    const s=structuredClone(state);
    if(samples<3||mutated)s.canvases[0].width=6;
    return s;
  }};
  const scope=new InspectionScope(startup);
  const settled=await scope.bind({timeoutMs:250,stableMs:30,pollMs:10});
  assert.deepEqual(settled.baseline,state);
  assert(settled.observations.some(o=>o.ready&&o.state.canvases[0].width===6));
  await scope.capture();
  await assert.rejects(scope.bind(),/cannot rebaseline/);
  mutated=true;
  const captureCount=calls;
  await assert.rejects(scope.capture(),/attachment changed/);
  assert.equal(calls,captureCount);
  await assert.rejects(scope.check(),/not bound/);
  const unstable=new InspectionScope({...startup,evaluate:async fn=>{
    if(fn===readInspectionReadiness)return true;
    return {...state,sequence:++samples};
  }});
  await assert.rejects(unstable.bind({timeoutMs:75,stableMs:30,pollMs:10}),/stabilization timeout/);
  await assert.rejects(unstable.bind(),/cannot rebaseline/);
  const unready=new InspectionScope({...page,evaluate:async fn=>fn===readInspectionReadiness?false:state});
  await assert.rejects(unready.bind({timeoutMs:75,stableMs:30,pollMs:10}),/stabilization timeout/);
  let stalledReads=0;
  const stalled=new InspectionScope({evaluate:()=>{stalledReads++;return new Promise(()=>{});}});
  await assert.rejects(stalled.bind({timeoutMs:75,stableMs:30,pollMs:10}),/stabilization timeout/);
  assert.equal(stalledReads,1);
  await assert.rejects(stalled.check(),/not bound/);
  console.log('inspection-window: null viewport, unchanged geometry/generation and whole lossless extent PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
