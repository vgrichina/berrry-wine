'use strict';
// Real compiled native Flip, actual owning guest Worker, source seal, decoder
// and compositor. No game launch and no synthetic completed-source record.
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {webcrypto} = require('node:crypto');
const {currentSynchronousSource} = require('../tools/mcm-synchronous-source.cjs');
const bound = require('../tools/mcm-bound-input.cjs');
const fixture = require('./helpers/synchronous-flip-producer');
const {execFileSync} = require('node:child_process');
const Module = require('node:module');
const baseline = new Module(require.resolve('../tools/mcm-bound-input.cjs'), module);
baseline.paths = module.paths;
baseline._compile(execFileSync('git',['show','759080889:tools/mcm-bound-input.cjs'],{encoding:'utf8'}),baseline.id);
const controls = [];
fixture(async f => {
  const {renderer, window:win, join, link, memory} = f;
  win.processId = 8181;
  if(f.phase==='setup') {
    const {createCanvas}=require('../lib/raster-canvas');
    const {PresentationFilter}=require('../lib/presentation-filter');
    renderer.presentationCanvas=createCanvas(2,2);
    renderer.presentationFilter=new PresentationFilter(renderer.presentationCanvas,{createCanvas:()=>createCanvas(2,2)});
    return;
  }
  const wine = {running:true, processId:8181, memory, renderer, instance:win.wasm,
    guestWorker:{link}, _d3dimPublicationJoin:{synchronous:join}};
  const read = () => currentSynchronousSource(wine, win);
  const refuse = (name, mutate, restore) => {
    mutate();try {assert.throws(read,/current completed/);controls.push(name);} finally {restore();}
  };
  if (['repainted','incomplete','retired-owner'].includes(f.phase)) {
    assert.throws(read,/current completed/);controls.push(f.phase);return;
  }
  let admitted;
  try {admitted=read();} catch(error) {
    console.error('CURRENT_DISPLAY_REFUSAL',JSON.stringify({window:{x:win.x,y:win.y,w:win.w,h:win.h},display:renderer._currentDisplayRecord&&{
      width:renderer._currentDisplayRecord.width,height:renderer._currentDisplayRecord.height,
      composition:renderer._currentDisplayRecord.composition,viewport:renderer._currentDisplayRecord.viewport}}));throw error;
  }
  assert.equal(admitted.publication.serial,f.record.request.serial);
  assert.equal(admitted.publication.workerSlot,9);
  assert.equal(admitted.layer,win._dxFrameLayer);
  controls.push(f.phase+'-newpass');
  const layer=win._dxFrameLayer, instance=wine.instance, endpoint=join.endpointId;
  refuse('wrong-owner',()=>{wine.instance={};},()=>{wine.instance=instance;});
  refuse('wrong-endpoint',()=>{join.endpointId++;},()=>{join.endpointId=endpoint;});
  refuse('replacement-layer',()=>{win._dxFrameLayer={...layer};},()=>{win._dxFrameLayer=layer;});
  const x=win.x;
  refuse('moved-after-publication',()=>{win.x++;},()=>{win.x=x;});
  const canvas=renderer.canvas;
  refuse('replaced-display',()=>{renderer.canvas={width:canvas.width,height:canvas.height};},()=>{renderer.canvas=canvas;});
  const sequence=renderer._immutablePublicationSequence;
  refuse('stale-publication',()=>{renderer._immutablePublicationSequence++;},()=>{renderer._immutablePublicationSequence=sequence;});
  const live=join.live;
  refuse('retired',()=>{join.live=false;},()=>{join.live=live;});
  const version=layer.canvas._waD3dimVersion;
  refuse('incomplete-decode',()=>{delete layer.canvas._waD3dimVersion;},()=>{layer.canvas._waD3dimVersion=version;});
  // Exact production page expression, with the former GPS publication stale.
  // The native window/Worker/source/canonical canvas above remain untouched.
  const oldGpu={kind:'gpu',writeSeq:0,stale:()=>true};win._gpuFrameLayer=oldGpu;
  const port={id:71,options:{api:'d3dim-gps'},closed:false};
  wine._renderWorkerManager={ports:new Map([[71,port]]),worker:{}};
  wine.hostCtx={getD3dimBridge:()=>({endpoint:port,presenter:{win,layer:oldGpu,stamp:0,presents:1}})};
  const page=vm.createContext({crossOriginIsolated:true,crypto:webcrypto,runningApps:[{name:'mcm',wine}]});
  assert.throws(()=>vm.runInContext(baseline.exports.PAGE_READ,page),/current D3DIM GPS/);
  const actual=vm.runInContext(bound.PAGE_READ,page).apps[0];
  assert.equal(actual.publication.kind,'synchronous-native-flip');
  assert.equal(actual.publication.serial,f.record.request.serial);
  controls.push('actual-native-page-oldfail-newpass');
  delete win._gpuFrameLayer;
}).then(()=>console.log(JSON.stringify({native:true,controls}))).catch(e=>{console.error(e.stack);process.exitCode=1;});
