'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../host.js'),'utf8');
const start=source.indexOf('    const ownerIds=new WeakMap();'),end=source.indexOf('    this._d3dimPublicationArming=true;',start);
assert(start>0&&end>start);
const guard=source.slice(start,end);
function fixture(){
 const instance={exports:{}},link={endpointIdentity:7},guest={link,localMainExports:()=>instance.exports};
 const epoch={words:new Int32Array(new SharedArrayBuffer(16))};
 const threads={mainInstance:instance},memory={},renderer={},processId=1000;
 const host={guestWorker:guest,threadManager:threads,instance,memory,renderer,processId};
 const ctx={guest,link,threads,instance,memory,renderer,processId,epoch,Atomics,admission:{sameParticipants:()=>true}};
 ctx.host=host;vm.createContext(ctx);ctx.validate=vm.runInContext('(function(){'+guard+'return validateOwner;}).call(host)',ctx);
 return ctx;
}
const controls=[];
const mutations={stopped:f=>f.host._stopped=true,guest:f=>f.host.guestWorker={},link:f=>f.guest.link={},threads:f=>f.host.threadManager={},instance:f=>f.host.instance={},memory:f=>f.host.memory={},renderer:f=>f.host.renderer={},processId:f=>f.host.processId++,hostWrites:f=>f.host._d3dimHostWritesInFlight=1,mainInstance:f=>f.threads.mainInstance={},localExports:f=>f.guest.localMainExports=()=>({}),participants:f=>f.admission.sameParticipants=()=>false,epochInvalid:f=>Atomics.store(f.epoch.words,2,1)};
fixture().validate();
for(const [predicate,mutate] of Object.entries(mutations)){
 const f=fixture();mutate(f);let detail;assert.throws(()=>f.validate(true),e=>{detail=JSON.parse(e.message.slice(e.message.indexOf('{')));return true;});assert.deepEqual(detail.failed,[predicate]);assert.equal(detail.expected.processId,1000);assert.equal(detail.expected.epoch,detail.actual.epoch);
 if(['guest','link','threads','instance','memory','renderer','processId'].includes(predicate))assert.notEqual(detail.expected[predicate],detail.actual[predicate]);
 controls.push({predicate,refused:true,boundedDiagnostic:detail});
}
const healthy=fixture();Atomics.store(healthy.epoch.words,1,42);healthy.validate();
// Later predicates must never run after the first refusal.
const stopped=fixture();stopped.host._stopped=true;
stopped.guest.localMainExports=()=>{throw Error('later export fault');};
stopped.admission.sameParticipants=()=>{throw Error('later participant fault');};
assert.throws(()=>stopped.validate(),/owner retired\/replaced or epoch invalid.*stopped/);
for(const key of ['localMainExports','sameParticipants']){
 const f=fixture(),sentinel=Error(key+' primary fault');
 if(key==='localMainExports')f.guest.localMainExports=()=>{throw sentinel;};
 else f.admission.sameParticipants=()=>{throw sentinel;};
 assert.throws(()=>f.validate(),e=>e===sentinel);
}
const diagnosticFault=fixture();diagnosticFault.host._stopped=true;
Object.defineProperty(diagnosticFault.host,'processId',{get(){throw Error('diagnostic getter fault');}});
assert.throws(()=>diagnosticFault.validate(),e=>e.message==='GPS preparation owner retired/replaced or epoch invalid');
const bounded=fixture();bounded.host.processId={toJSON(){throw Error('unsafe serializer');}};
bounded.guest.link={endpointIdentity:'x'.repeat(10000)};
bounded.host._d3dimHostWritesInFlight=1n;
let boundedDetail;
assert.throws(()=>bounded.validate(),e=>{boundedDetail=JSON.parse(e.message.slice(e.message.indexOf('{')));return true;});
assert.equal(boundedDetail.actual.processId,'object');
assert.equal(boundedDetail.actual.endpoint.length,80);
assert.equal(boundedDetail.actual.hostWrites,'bigint');
assert(JSON.stringify(boundedDetail).length<1500);
const defaultHealthy=fixture();defaultHealthy.guest.localMainExports=undefined;
defaultHealthy.admission=null;defaultHealthy.validate();
// Binding occurs during an observed gpu_stream_kick. Activity is not owner
// replacement and does not grant retained-source/publication authority.
const binding=fixture();binding.host._d3dimHostWritesInFlight=1;
Atomics.store(binding.epoch.words,0,2);Atomics.store(binding.epoch.words,1,509438);
binding.validate();assert.throws(()=>binding.validate(true),/hostWrites/);
for(const [predicate,mutate] of Object.entries(mutations)){
 if(predicate==='hostWrites')continue;
 const f=fixture();f.host._d3dimHostWritesInFlight=1;mutate(f);
 assert.throws(()=>f.validate(),new RegExp('"'+predicate+'"'));
}
console.log(JSON.stringify({faultControls:6,healthyPASS:true,epochVersionIsSampleNotOwner:true,
 controls,bindingActivityAccepted:true,initialAttachmentActivityRefused:true,bindingOwnersAndEpochStillRequired:true}));

// Execute the production preparation and its actual bind callback together.
// This catches passing the idle validator to bind, or dropping it at attach.
(async()=>{
 const R=require('../lib/render-worker');
 const a=source.indexOf('  async prepareD3dimGpsPublicationObservation(');
 const b=source.indexOf('\n  async armQuake2WriterObservation(',a);
 assert(a>0&&b>a);
 const prepare=vm.runInNewContext('(class { '+source.slice(a,b)+' }).prototype.prepareD3dimGpsPublicationObservation',{
  Atomics,SharedArrayBuffer,WeakMap,Number,setTimeout,clearTimeout,
  RenderWorker:{WriterEpoch:R.WriterEpoch,PreparedGpsObservation:R.PreparedGpsObservation,
   SurfaceVersionJournal:class {},SurfacePublicationJoin:class {
    constructor(){this.rows=[];}retire(){this.retired=true;}
   }}
 });
 for(const mode of ['active-at-attach','active-at-arm-ack','active-at-bind','replaced-at-bind-ack','invalid-at-bind-ack']){
  const f=fixture();f.instance.nativeInstance={};let attached=0,unsubscribed=0;
  f.host.threadManager.holdWriterObservationBoundary=()=>()=>{};
  f.guest.attachWriterObservationAtBoundary=async(epoch,{validateOwner})=>{
   if(mode==='active-at-attach')f.host._d3dimHostWritesInFlight=1;
   validateOwner();attached++;return f.admission;
  };
  f.link._ask=async message=>{
   if(message.action==='arm'&&mode==='active-at-arm-ack')f.host._d3dimHostWritesInFlight=1;
   return {generation:3};
  };
  f.link.onRetiring=()=>()=>{unsubscribed++;};
  if(mode.startsWith('active-at-')&&mode!=='active-at-bind'){
   await assert.rejects(prepare.call(f.host,{maxRecords:1}),/hostWrites/);
   assert.equal(attached,mode==='active-at-attach'?0:1);continue;
  }
  const p=await prepare.call(f.host,{maxRecords:1});
  assert.equal(p.state,'PREPARED');assert.equal(p.endpoint,null);
  f.host._d3dimHostWritesInFlight=1;Atomics.store(p.epoch.words,0,2);
  const endpoint={id:9,options:{api:'d3dim-gps'},addEventListener(){},removeEventListener(){},
   producerObservation:async action=>{
    if(action==='stop')return;
    if(mode==='replaced-at-bind-ack')f.host.instance={};
    if(mode==='invalid-at-bind-ack')p.epoch.invalidate();
    return {owner:{scope:p.options.ownerGeneration,endpointId:9,generation:2},generation:3};
   }};
  if(mode==='active-at-bind'){
   await p.bind(endpoint);assert.equal(p.state,'ARMED');
   assert.equal(p.join.synchronous.rows.length,0);assert.equal(p.epoch.snapshot(),null);
  }else await assert.rejects(p.bind(endpoint),/instance|epochInvalid/);
  await p.cancel();assert.equal(p.state,'CLOSED');assert.equal(unsubscribed,1);
 }
 console.log('PASS actual GPS prepare/bind: idle attachment, observed active bind, replacement, invalid epoch; no publication authority');
})().catch(error=>{console.error(error);process.exitCode=1;});
