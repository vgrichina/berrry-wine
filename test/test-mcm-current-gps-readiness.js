'use strict';
// Production expressions and chain, actual software GPS endpoint/shared ring.
// This checks admission identity, not rendered pixels or a game consequence.
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const { test } = require('node:test');
const bound = require('../tools/mcm-bound-input.cjs');
const GPS = require('../lib/gpu-stream-render-worker');
const { makeProducer } = require('./gpu-stream-fixture');
const bytes = Buffer.from('0061736d01000000', 'hex');

function fixture(app='dx_boids') {
  const producer = makeProducer();
  const instance = new WebAssembly.Instance(new WebAssembly.Module(bytes));
  const adapter = GPS.create({instance, memory:{buffer:producer.buffer}, backend:'software',
    endpointId:9, options:{api:'d3dim-gps'}, sendFrame(){assert.fail('empty ring');}});
  const kick = mode => adapter.execute({t:'gps-kick',ring:producer.header,mode});
  kick(0);
  const port={id:9,options:{api:'d3dim-gps',backend:'webgl'},closed:false};
  const layer={writeSeq:1,stale:()=>false};
  const win={wasm:instance,processId:3,_gpuFrameLayer:layer};
  const bridge={endpoint:port,presenter:{layer,win,stamp:0,presents:1}};
  const wine={running:true,instance,renderer:{peekKeyDownState:()=>null},processId:3,hostCtx:{getD3dimBridge:()=>bridge},
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
  let time=Date.now(), dispatches=0;
  const chain=bound.createChain({app,workers,pageSession:'page',now:()=>time,
    evaluate:async(expression,session)=>JSON.parse(JSON.stringify(await vm.runInContext(expression,
      session==='guest'?guest:session==='render'?render:page))),
    send:async method=>method==='Debugger.getScriptSource'?{bytecode:bytes.toString('base64')}:{data:Buffer.from('image').toString('base64')}});
  const review=c=>({...c,review:'Reviewed full current frame'});
  return {chain,wine,bridge,port,layer,entry,adapter,kick,workers,review,page,
    advance:ms=>time+=ms, dispatch:()=>++dispatches,get dispatches(){return dispatches;}};
}

test('current GPS ownership passes with absent legacy readiness and actual software fallback',async()=>{
  const f=fixture();try {
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
