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
 const f=fixture();mutate(f);let detail;assert.throws(()=>f.validate(),e=>{detail=JSON.parse(e.message.slice(e.message.indexOf('{')));return true;});assert.deepEqual(detail.failed,[predicate]);assert.equal(detail.expected.processId,1000);assert.equal(detail.expected.epoch,detail.actual.epoch);
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
console.log(JSON.stringify({faultControls:6,diagnosticsOnly:true,healthyPASS:true,epochVersionIsSampleNotOwner:true,controls,originalCauseProven:false}));
