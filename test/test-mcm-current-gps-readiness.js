'use strict';
// Production expressions and chain, actual software GPS endpoint/shared ring.
// This checks admission identity, not rendered pixels or a game consequence.
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const { test } = require('node:test');
const bound = require('../tools/mcm-bound-input.cjs');
const GPS = require('../lib/gpu-stream-render-worker');
const { Presenter } = require('../lib/gpu-stream-host');
const { Win98Renderer } = require('../lib/renderer');
const { createCanvas } = require('../lib/raster-canvas');
const { makeProducer } = require('./gpu-stream-fixture');
const bytes = Buffer.from('0061736d01000000', 'hex');

function fixture(app='dx_boids', {pending=false, timeout=10000}={}) {
  const producer = makeProducer();
  const instance = new WebAssembly.Instance(new WebAssembly.Module(bytes));
  const adapter = GPS.create({instance, memory:{buffer:producer.buffer}, backend:'software',
    endpointId:9, options:{api:'d3dim-gps'}, sendFrame(){assert.fail('empty ring');}});
  const kick = mode => adapter.execute({t:'gps-kick',ring:producer.header,mode});
  kick(0);
  const port={id:9,options:{api:'d3dim-gps',backend:'webgl'},closed:false};
  const win={hwnd:1,wasm:instance,processId:3,_backCanvas:createCanvas(2,2)};
  const renderer={windows:{1:win},peekKeyDownState:()=>null,
    _overlayFrameLayer:Win98Renderer.prototype._overlayFrameLayer};
  const presenter=new Presenter({api:'d3dim-gps',renderer,createCanvas});
  const present=()=>presenter.present({hwnd:1,stamp:0,surface:createCanvas(2,2)});
  if(!pending)present();
  const layer=presenter.layer;
  const bridge={endpoint:port,presenter};
  const wine={running:true,instance,renderer,processId:3,hostCtx:{getD3dimBridge:()=>bridge},
    guestWorker:{link:{endpointIdentity:7,slot:0,worker:{},module:{}}},
    _renderWorkerManager:{worker:{},ports:new Map([[9,port]])}};
  const common={crypto:webcrypto,Atomics,SharedArrayBuffer};
  const page=vm.createContext({...common,crossOriginIsolated:true,runningApps:[{name:app,wine}]});
  const guest=vm.createContext({...common,endpointIdentity:7,workerSlot:0,instance});
  const entry={options:port.options,adapter};
  const render=vm.createContext({...common,instance,endpoints:new Map([[9,entry]])});
  const workers=new Map(['guest','render'].map(sessionId=>[sessionId,{sessionId,targetId:sessionId,
    url:sessionId==='guest'?'guest-worker.js':'d3d-render-worker.js',
    scripts:[{scriptId:'1',bytecodeAvailable:true,sha256:bound.sha(bytes)}]}]));
  let time=Date.now(), dispatches=0, reads=0, screenshots=0;
  const chain=bound.createChain({app,workers,pageSession:'page',now:()=>time,readinessTimeoutMs:timeout,
    evaluate:async(expression,session)=>{reads++;return JSON.parse(JSON.stringify(await vm.runInContext(expression,
      session==='guest'?guest:session==='render'?render:page)));},
    send:async method=>{if(method==='Debugger.getScriptSource')return {bytecode:bytes.toString('base64')};screenshots++;return {data:Buffer.from('image').toString('base64')};}});
  const review=c=>({...c,review:'Reviewed full current frame'});
  const oldCapture=async()=>{
    const Module=require('node:module'),{execFileSync}=require('node:child_process');
    const file=require.resolve('../tools/mcm-bound-input.cjs'),legacy=new Module(file,module);
    legacy.paths=Module._nodeModulePaths(require('node:path').dirname(file));
    legacy._compile(execFileSync('git',['show','8e7989e5c:tools/mcm-bound-input.cjs'],{encoding:'utf8'}),file);
    const old=legacy.exports.createChain({app,workers,pageSession:'page',evaluate:async expression=>
      JSON.parse(JSON.stringify(vm.runInContext(expression,page))),send:async()=>assert.fail('premature old screenshot')});
    await assert.rejects(old.capture('old-premature'),/current D3DIM GPS publication required/);
    assert(old.closed);
  };
  return {chain,wine,bridge,port,layer,entry,adapter,kick,workers,review,page,present,oldCapture,
    get reads(){return reads;},get screenshots(){return screenshots;},
    advance:ms=>time+=ms, dispatch:()=>++dispatches,get dispatches(){return dispatches;}};
}

test('published owner waits for first complete PRESENT before capture or intent',async()=>{
  const f=fixture('mcm',{pending:true});try {
    assert.throws(()=>vm.runInContext(bound.PAGE_READ,f.page),/missingLayer.*missingWindow/);
    const capture=f.chain.capture('first');
    await new Promise(r=>setTimeout(r,20));
    assert.equal(f.screenshots,0);assert.equal(f.dispatches,0);
    f.present();
    const s=await capture;
    assert.equal(f.screenshots,1);
    await f.chain.admit(f.review(s.capture),f.dispatch);
    assert.equal(f.dispatches,1);
  }finally{f.adapter.destroy();}
});

test('first PRESENT wait expires and permanently closes with no later requests',async()=>{
  const f=fixture('mcm',{pending:true,timeout:30});try {
    await assert.rejects(f.chain.capture('never'),/readiness expired/);
    assert(f.chain.closed);assert.equal(f.screenshots,0);
    const reads=f.reads;f.present();await assert.rejects(f.chain.readLive(),/closed chain/);
    assert.equal(f.reads,reads);
  }finally{f.adapter.destroy();}
});

for(const [name,mutate] of Object.entries({
  replacement:f=>{f.wine._renderWorkerManager.worker={};},
  mainInstance:f=>{f.wine.instance={};},
  mainRenderer:f=>{f.wine.renderer={...f.wine.renderer};},
  presenter:f=>{f.bridge.presenter=new Presenter({api:'d3dim-gps',renderer:f.wine.renderer,createCanvas});},
  retired:f=>{f.port.closed=true;},
  context:f=>{const read=f.adapter.identity;f.adapter.identity=()=>({...read(),executorRole:'webgl',context:{},contextLost:true,glRenderer:'lost'});},
  generation:f=>{f.kick(2);f.kick(0);},
  incomplete:f=>{f.present();f.bridge.presenter.layer.writeSeq=0;},
  wrongOwner:f=>{f.present();f.bridge.presenter.win.wasm={};},
  stale:f=>{f.present();f.bridge.presenter.layer.stale=()=>true;},
}))test('first PRESENT pending does not excuse '+name,async()=>{
  const f=fixture('mcm',{pending:true});try {
    const capture=f.chain.capture('pending');
    await new Promise(r=>setTimeout(r,20));mutate(f);
    await assert.rejects(capture);
    assert(f.chain.closed);assert.equal(f.screenshots,0);assert.equal(f.dispatches,0);
    const reads=f.reads;await assert.rejects(f.chain.readLive(),/closed chain/);assert.equal(f.reads,reads);
  }finally{f.adapter.destroy();}
});

test('publication refusal carries exactly nine same-read scalar predicates',()=>{
  const f=fixture();try {
    f.layer.writeSeq=0;
    assert.throws(()=>vm.runInContext(bound.PAGE_READ,f.page),error=>{
      const reasons=JSON.parse(error.message.slice(error.message.indexOf('{')));
      assert.equal(Object.keys(reasons).length,9);
      assert(Object.values(reasons).every(v=>typeof v==='boolean'));
      assert.deepEqual(Object.keys(reasons).filter(k=>reasons[k]),['zeroWriteSeq']);
      return true;
    });
  }finally{f.adapter.destroy();}
});

test('actual native producer first complete PRESENT releases the bounded capture',async()=>{
  const {bootGpsDevice}=require('./helpers/d3dim-gps-device');
  const g=await bootGpsDevice({extraWat:`
    (func (export "mcm_first_present") (param $surface i32)
      (local $pb i32) (local $entry i32) (local $target i32)
      (local.set $pb (call $d3g_pb))
      (local.set $entry (call $dx_from_this (local.get $surface)))
      (call $dx_coop_hwnd_set (i32.const 1))
      (local.set $target (call $d3g_find (local.get $pb) (load.field DxObject misc1 (local.get $entry))))
      (call $d3g_present (local.get $pb) (i32.load offset=28 (local.get $target))
        (i32.const 0) (i32.const 0) (i32.const 2) (i32.const 2)
        (i32.const 1) (i32.const 0) (i32.const 0) (local.get $entry))
      (drop (call $d3g_kick (local.get $pb) (global.get $GPS_KICK_SYNC))))`});
  const surface=g.surface(2,2,{caps:0x6040}),device=g.device(surface);
  const vertices=g.e.guest_alloc(128);
  g.vertices(vertices,[[0,0,.5,1,0xff00ff00],[2,0,.5,1,0xff00ff00],[0,2,.5,1,0xff00ff00]]);
  g.e.gd_draw(device,4,vertices,3);
  assert.equal(g.e.gd_clear(surface,1,0xff00ff00,1,0,0,2,2,0),1);g.fence();
  const f=fixture('mcm',{pending:true});try {
    f.wine.instance=g.h.instance;
    const win=f.wine.renderer.windows[1];win.wasm=g.h.instance;
    // This callback receives only the native ring executor's real output.
    g.executor().options.presentPixels=frame=>f.bridge.presenter.present(frame);
    await f.oldCapture();
    assert.throws(()=>vm.runInContext(bound.PAGE_READ,f.page),/current D3DIM GPS publication required/);
    const capture=f.chain.capture('native-first');
    await new Promise(r=>setTimeout(r,20));assert.equal(f.screenshots,0);
    g.e.mcm_first_present(surface);
    assert.equal(f.bridge.presenter.presents,1);
    assert(g.e.d3dim_gps_window_present(1,0)>0,'actual native HWND publication');
    const s=await capture;
    assert.equal(s.after.page.apps[0].publication.presents,1);
    assert.deepEqual([...f.bridge.presenter.canvas.getContext('2d').getImageData(0,0,1,1).data],[0,255,0,255]);
    await f.chain.admit(f.review(s.capture),f.dispatch);assert.equal(f.dispatches,1);
  }finally{f.adapter.destroy();g.executor()?.close();}
});

test('current GPS ownership passes with absent legacy readiness and actual software fallback',async()=>{
  const f=fixture();try {
    assert.equal(f.layer.kind,'gpu');
    assert.equal(f.bridge.presenter.win._gpuFrameLayer,f.layer);
    assert.equal(f.bridge.presenter.win._dxFrameLayer,f.layer);
    assert.equal(f.wine.renderer._overlayFrameLayer(f.bridge.presenter.win),f.layer);
    assert.equal(f.wine.guestWorker.d3dStats?.renderEndpointId,undefined);
    assert.equal(vm.runInContext(bound.READY_READ,f.page),true);
    const s=await f.chain.capture('current');
    assert.equal(s.capture.identity.renderEndpoint,9);
    assert.equal(s.capture.identity.renderRole,'d3dim-gps');
    assert.equal(s.capture.identity.rendererExecutorRole,'software');
    assert.equal(s.capture.identity.rendererContext,'none');
    assert.equal(s.after.page.apps[0].publication.stamp,0);
    await f.chain.admit(f.review(s.capture),f.dispatch);
    assert.equal(f.dispatches,1);
  } finally {f.adapter.destroy();}
});

test('MCM observation adapter arms exact synchronous API once and requires a new reviewed capture',async()=>{
  const f=fixture('mcm');try {
    f.wine.memory={};let calls=0;
    f.wine.armD3dimPublicationObservation=async options=>{
      assert.equal(options.synchronousSource,true);assert.equal(options.maxRecords,256);calls++;
      return f.wine._d3dimPublicationJoin={synchronous:{valid:()=>true,owner:{scope:'own'},observationGeneration:1}};
    };
    const old=await f.chain.capture('before-arm');
    const receipt=await f.chain.armSynchronousSource();
    assert.equal(receipt.endpoint,7);assert.equal(calls,1);
    await assert.rejects(f.chain.armSynchronousSource(),/unarmed MCM/);
    await assert.rejects(f.chain.admit(f.review(old.capture),f.dispatch),/current reviewed capture/);
    assert.equal(f.dispatches,0);
  }finally{f.adapter.destroy();}
});

test('MCM arming replacement closes the adapter before any input',async()=>{
  const f=fixture('mcm');try {
    f.wine.memory={};
    f.wine.armD3dimPublicationObservation=async()=>{
      f.wine.memory={};
      return f.wine._d3dimPublicationJoin={synchronous:{valid:()=>true}};
    };
    await assert.rejects(f.chain.armSynchronousSource(),/owner changed while arming/);
    assert(f.chain.closed);assert.equal(f.dispatches,0);
  }finally{f.adapter.destroy();}
});

for(const [name,mutate] of Object.entries({
  'unbound sole port':f=>{f.bridge.endpoint=null;},
  'stale publication':f=>{f.layer.stale=()=>true;},
  'replaced window':f=>{f.bridge.presenter.win={...f.bridge.presenter.win};},
  'replaced executor':f=>{f.kick(2);f.kick(0);},
  'wrong renderer role':f=>{f.entry.options={api:'glide'};},
  'missing executor observation':f=>{f.entry.adapter={};},
  'lost context':f=>{const read=f.adapter.identity;f.adapter.identity=()=>({...read(),executorRole:'webgl',context:{},contextLost:true,glRenderer:'test'});},
  'ring error':f=>{const read=f.adapter.identity;f.adapter.identity=()=>({...read(),error:1});},
  'detached renderer':f=>{f.workers.get('render').closed=true;},
  'missing module inventory':f=>{f.workers.get('guest').scripts=[];},
}))test(name+' refuses before dispatch and closes',async()=>{
  const f=fixture();try {
    const s=await f.chain.capture('before');mutate(f);
    await assert.rejects(f.chain.admit(f.review(s.capture),f.dispatch));
    assert.equal(f.dispatches,0);assert.equal(f.chain.closed,true);
    await assert.rejects(f.chain.readLive(),/closed chain/);
  }finally{f.adapter.destroy();}
});

test('scene age remains 12000 ms; stale refusal has no effects',async()=>{
  const f=fixture();try{
    const s=await f.chain.capture('age');f.advance(12001);
    await assert.rejects(f.chain.admit(f.review(s.capture),f.dispatch),{code:'STALE_SCENE_BEFORE_DISPATCH'});
    assert.equal(f.dispatches,0);assert.equal(f.chain.closed,false);
    assert.equal(bound.MAX_AGE_MS,12000);
  }finally{f.adapter.destroy();}
});
