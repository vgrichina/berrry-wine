'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const bound=require('../tools/mcm-bound-input.cjs');

function fixture() {
  const bytes=Buffer.from('0061736d01000000','hex'),instance={nativeInstance:{}};
  const link={endpointIdentity:7,slot:0,worker:{},module:{}};
  const wine={running:true,processId:3,instance,memory:{},renderer:{peekKeyDownState:()=>null},guestWorker:{link},
    threadManager:{mainInstance:instance}};
  let arms=0,effects=0,reads=0;
  wine.armD3dimPublicationObservation=async()=>{
    arms++;
    assert(link._renderLegacyEndpoint&&!link._renderLegacyEndpoint.closed);
    return wine._d3dimPublicationJoin={synchronous:{valid:()=>true,owner:{scope:'own'},observationGeneration:1}};
  };
  const page=vm.createContext({crypto:webcrypto,crossOriginIsolated:true,runningApps:[{name:'mcm',wine}]});
  const worker=vm.createContext({crypto:webcrypto,endpointIdentity:7,workerSlot:0,instance});
  const workers=new Map([['guest',{sessionId:'guest',targetId:'guest',url:'guest-worker.js',
    scripts:[{scriptId:'1',bytecodeAvailable:true,sha256:bound.sha(bytes)}]}]]);
  const chain=bound.createChain({workers,pageSession:'page',evaluate:async(s,target)=>{
    reads++;return JSON.parse(JSON.stringify(await vm.runInContext(s,target==='guest'?worker:page)));
  },send:async method=>method==='Debugger.getScriptSource'?{bytecode:bytes.toString('base64')}:
    {data:Buffer.from('reviewed test image').toString('base64')}});
  const review=shot=>({...shot.capture,stage:'menu-before-start',review:'Visible menu reviewed before Start'});
  return {chain,wine,link,review,dispatch:()=>++effects,get arms(){return arms;},
    get reads(){return reads;},get effects(){return effects;}};
}

test('startup dialogs advance through reviewed admission; legacy menu arms before Start',async()=>{
  const f=fixture();
  const dialog=await f.chain.capture('hardware-change');
  await f.chain.admit(f.review(dialog),f.dispatch);
  assert.equal(f.effects,1);assert.equal(f.arms,0);
  f.link._renderLegacyEndpoint={closed:false};
  const menu=await f.chain.capture('menu');
  await f.chain.armMenuSource(f.review(menu));assert.equal(f.arms,1);
  const start=await f.chain.capture('menu-armed');
  await f.chain.admit(f.review(start),f.dispatch);assert.equal(f.effects,2);
});

test('premature menu arm records exact same-read absent endpoint before calling host',async()=>{
  const f=fixture(),shot=await f.chain.capture('startup');
  await assert.rejects(f.chain.armMenuSource(f.review(shot)),/missingEndpoint":true.*closedEndpoint":false.*missingThreads":false/);
  assert.equal(f.arms,0);assert(f.chain.closed);
  const reads=f.reads;f.link._renderLegacyEndpoint={closed:false};
  await assert.rejects(f.chain.capture('later'),/closed/);assert.equal(f.reads,reads);
});

for(const [name,change] of Object.entries({
  closed:f=>{f.link._renderLegacyEndpoint.closed=true;},
  threads:f=>{f.wine.threadManager=null;},
  main:f=>{f.wine.threadManager.mainInstance={};},
  native:f=>{f.wine.instance.nativeInstance=null;},
  armed:f=>{f.wine._d3dimPublicationArming=true;}
}))test('menu arm refuses '+name+' before host effects',async()=>{
  const f=fixture();f.link._renderLegacyEndpoint={closed:false};change(f);
  const shot=await f.chain.capture('menu');
  await assert.rejects(f.chain.armMenuSource(f.review(shot)),/prerequisites/);
  assert.equal(f.arms,0);assert.equal(f.effects,0);assert(f.chain.closed);
});

test('menu arm requires explicit current menu review',async()=>{
  const f=fixture();f.link._renderLegacyEndpoint={closed:false};
  const shot=await f.chain.capture('menu');
  await assert.rejects(f.chain.armMenuSource({...f.review(shot),stage:'startup'}),/reviewed menu/);
  assert.equal(f.arms,0);
});

test('arming consumes the pre-arm review so Start needs a new capture',async()=>{
  const f=fixture();f.link._renderLegacyEndpoint={closed:false};
  const shot=await f.chain.capture('menu'),review=f.review(shot);
  await f.chain.armMenuSource(review);
  await assert.rejects(f.chain.admit(review,f.dispatch),/current reviewed capture/);
  assert.equal(f.effects,0);assert(f.chain.closed);
});

test('equal-looking legacy endpoint replacement cannot borrow a menu review',async()=>{
  const f=fixture();f.link._renderLegacyEndpoint={closed:false};
  const shot=await f.chain.capture('menu');
  f.link._renderLegacyEndpoint={closed:false};
  await assert.rejects(f.chain.armMenuSource(f.review(shot)),/reviewed menu source owner changed/);
  assert.equal(f.arms,0);assert.equal(f.effects,0);assert(f.chain.closed);
});
