'use strict';
const assert=require('node:assert/strict');
const {PNG}=require('pngjs');
const {connectInspector,inspectWholePage}=require('../tools/inspection-window.cjs');
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
  console.log('inspection-window: null viewport, unchanged geometry/generation and whole lossless extent PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
