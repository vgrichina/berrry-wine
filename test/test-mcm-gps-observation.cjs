'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {PreparedGpsObservation,WriterEpoch}=require('../lib/render-worker');
function fixture({delay=false,fail=false}={}){
  let release,valid=true,stops=0,closes=0;
  const wait=new Promise(r=>{release=r;});
  const listeners=new Set(),epoch=new WriterEpoch();
  const endpoint={id:41,options:{api:'d3dim-gps'},closed:false,
    addEventListener:(t,f)=>listeners.add(f),removeEventListener:(t,f)=>listeners.delete(f),
    producerObservation:async action=>{
      if(action==='stop'){stops++;return;}
      if(delay)await wait;if(fail)throw Error('install failed');
      return {owner:{scope:'actual',endpointId:41,generation:9},generation:11};
    }};
  const join={live:true,synchronous:{rows:[],retire(){this.dead=true;}},retire(){this.live=false;}};
  const p=new PreparedGpsObservation({epoch,options:{ownerGeneration:'actual'},timeoutMs:100,
    validateOwner:()=>{if(!valid)throw Error('owner replaced');},onArm:()=>join,onClose:()=>{closes++;}});
  return {p,endpoint,join,epoch,listeners,release,replace:()=>{valid=false;},get stops(){return stops;},get closes(){return closes;}};
}
test('PREPARED has no endpoint/source authority; actual ack arms, only qualified publication publishes',async()=>{
  const f=fixture();assert.equal(f.p.state,'PREPARED');assert.equal(f.p.endpoint,null);
  assert.equal(f.p.join,undefined);await f.p.bind(f.endpoint);assert.equal(f.p.state,'ARMED');
  f.join.synchronous.rows.push({qualified:false});assert.equal(f.p.state,'ARMED');
  f.join.synchronous.rows.push({qualified:true});assert.equal(f.p.state,'PUBLISHED');
  await f.p.cancel();assert.equal(f.p.state,'CLOSED');assert.equal(f.listeners.size,0);
  assert.equal(f.stops,1);assert.equal(f.closes,1);assert.equal(f.epoch.snapshot(),null);
});
test('concurrent same-port creation shares one installation',async()=>{
  const f=fixture({delay:true}),a=f.p.bind(f.endpoint),b=f.p.bind(f.endpoint);
  assert.equal(a,b);f.release();await a;await f.p.cancel();
});
for(const reason of ['cancel','owner','replacement','retire','failure'])test('installation race closes: '+reason,async()=>{
  const f=fixture({delay:true,fail:reason==='failure'}),binding=f.p.bind(f.endpoint);
  if(reason==='cancel')f.p.cancel('stop during install');
  if(reason==='owner')f.replace();
  if(reason==='replacement')await assert.rejects(f.p.bind({...f.endpoint}),/replaced/);
  if(reason==='retire')for(const listener of f.listeners)listener();
  f.release();await assert.rejects(binding);await f.p.cancel();
  assert.equal(f.p.state,'CLOSED');assert.equal(f.listeners.size,0);assert.equal(f.stops,1);
});
test('wrong API and wrong owner refused before installation',async()=>{
  for(const wrong of ['api','owner']){
    const f=fixture();if(wrong==='api')f.endpoint.options.api='legacy';else f.replace();
    await assert.rejects(f.p.bind(f.endpoint));assert.equal(f.stops,0);await f.p.cancel();
  }
});
test('finite preparation expiry invalidates epoch without endpoint creation',async()=>{
  const f=fixture();await new Promise(r=>setTimeout(r,120));
  assert.equal(f.p.state,'CLOSED');assert.match(f.p.reason,/timed out/);assert.equal(f.closes,1);
  await assert.rejects(f.p.bind(f.endpoint),/timed out/);
});

test('explicit GPS menu preparation accepts absent legacy port without granting source authority',async()=>{
  const vm=require('node:vm'),bound=require('../tools/mcm-bound-input.cjs');
  const {webcrypto}=require('node:crypto');
  const bytes=Buffer.from('0061736d01000000','hex'),instance={nativeInstance:{}};
  const link={endpointIdentity:7,slot:0,worker:{},module:{}};
  const wine={running:true,processId:3,instance,memory:{},renderer:{peekKeyDownState:()=>null},
    guestWorker:{link},threadManager:{mainInstance:instance}};
  let preparations=0,reads=0;
  wine.prepareD3dimGpsPublicationObservation=async()=>{
    preparations++;return wine._d3dimGpsObservation={state:'PREPARED',endpoint:null};
  };
  const page=vm.createContext({crypto:webcrypto,crossOriginIsolated:true,runningApps:[{name:'mcm',wine}]}),
    worker=vm.createContext({crypto:webcrypto,endpointIdentity:7,workerSlot:0,instance});
  const workers=new Map([['guest',{sessionId:'guest',targetId:'guest',url:'guest-worker.js',
    scripts:[{scriptId:'1',bytecodeAvailable:true,sha256:bound.sha(bytes)}]}]]);
  const config={workers,pageSession:'page',gpsSourcePreparation:true,evaluate:async(s,target)=>{
    reads++;return JSON.parse(JSON.stringify(await vm.runInContext(s,target==='guest'?worker:page)));},
    send:async method=>method==='Debugger.getScriptSource'?{bytecode:bytes.toString('base64')}:
      {data:Buffer.from('menu image').toString('base64')}};
  const chain=bound.createChain(config);
  const shot=await chain.capture('menu'),review={...shot.capture,stage:'menu-before-start',review:'reviewed menu'};
  const receipt=await chain.armMenuSource(review);
  assert.equal(preparations,1);assert.equal(receipt.state,'PREPARED');assert.equal(receipt.qualified,false);
  assert.equal(wine._d3dimPublicationJoin,undefined);
  await assert.rejects(chain.admit(review,()=>assert.fail('stale pre-arm review dispatched')),/current reviewed capture/);
  wine._d3dimGpsObservation.state='CLOSED';
  const expired=bound.createChain(config);
  await assert.rejects(expired.capture('expired'),/GPS preparation closed/);assert(expired.closed);
  const lastReads=reads;await assert.rejects(expired.capture('later'),/closed/);assert.equal(reads,lastReads);
});
