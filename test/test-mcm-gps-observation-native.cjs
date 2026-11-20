'use strict';
// Real process render Worker and compiled native instance, including the
// transport races. Source-copy/publication qualification is a separate test.
const assert=require('node:assert/strict');
const {Worker}=require('node:worker_threads');
const R=require('../lib/render-worker');
const {compileSrcWasm}=require('./compile-src');
const sigs=require('../lib/host-import-sigs.generated.json').sigs;
const moduleBytes=compileSrcWasm(),compiled=new WebAssembly.Module(moduleBytes);
const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
const manager=new R.Manager({module:compiled,memory,sigs,imageBase:0x400000,
  workerFactory:()=>new Worker(require.resolve('../lib/d3d-render-worker.js'))});
const controls=[];
const options=epoch=>({ownerGeneration:'actual-native-gps',maxRecords:2,writerEpochBuffer:epoch.buffer,
  surfaceVersionBuffer:new SharedArrayBuffer(2*65536),retainedSurfaceBuffer:new SharedArrayBuffer(4*(16+2*1024*1024))});
async function open(api='d3dim-gps'){const p=manager.createEndpoint({api,backend:'software'});await p.ready;return p;}
(async()=>{
 await manager.ready;
 for(const name of ['normal','wrong-owner','replacement','cancel','invalid-journal','endpoint-retirement']){
  const endpoint=await open(),epoch=new R.WriterEpoch(),o=options(epoch);
  if(name==='invalid-journal')o.surfaceVersionBuffer=new SharedArrayBuffer(3);
  let valid=true,armed=0;
  const prep=new R.PreparedGpsObservation({epoch,options:o,timeoutMs:1000,
   validateOwner:()=>{if(!valid)throw Error('wrong owner');},onArm:()=>{armed++;return {retire(){}};}});
  if(name==='wrong-owner')valid=false;
  const binding=prep.bind(endpoint);
  const outcome=binding.then(value=>({ok:true,value}),error=>({ok:false,error}));
  let other;
  if(name==='replacement'){
   other=await open();await assert.rejects(prep.bind(other),/replaced/);
  }
  if(name==='cancel')prep.cancel('stop before acknowledgment');
  if(name==='endpoint-retirement')await endpoint.terminate();
  if(name==='normal'){
   await binding;assert.equal(prep.state,'ARMED');
   const receipt=await endpoint.producerObservation('read');
   assert.equal(receipt.active,true);assert.equal(receipt.owner.endpointId,endpoint.id);
   assert.equal(receipt.qualified,false);assert.equal(receipt.records.length,0);
  }else if(['replacement','endpoint-retirement'].includes(name))await outcome; // either side of the real acknowledgment race
  else assert.equal((await outcome).ok,false,name+' must not arm');
  await prep.cancel();assert.equal(prep.state,'CLOSED');assert.equal(epoch.snapshot(),null);
  if(!endpoint.closed){const receipt=await endpoint.producerObservation('read');assert(!receipt?.active);}
  if(name==='wrong-owner')assert.equal(armed,0);
  await endpoint.terminate();if(other)await other.terminate();controls.push(name);
 }
 const gps=await open(),oldEpoch=new R.WriterEpoch();
 const oldReply=await new Promise((resolve,reject)=>{
  const requestId=987654;
  const listener=event=>{if(event.data.requestId!==requestId)return;
    clearTimeout(timer);gps.removeEventListener('message',listener);resolve(event.data);};
  const timer=setTimeout(()=>{gps.removeEventListener('message',listener);reject(Error('old control reply missing'));},1000);
  gps.addEventListener('message',listener);
  gps.postMessage({t:'legacy-producer-observation',requestId,action:'arm',options:options(oldEpoch)});
 });
 assert.match(oldReply.error,/queued legacy endpoint required/);
 assert(oldEpoch.snapshot());
 const newReply=await gps.producerObservation('arm',options(oldEpoch));assert(newReply.active);
 await gps.producerObservation('stop');await gps.terminate();controls.push('actual-GPS-legacy-wire-oldfail-new-protocol-pass');
 const legacy=await open('legacy');
 // The old protocol's legacy guard is deliberately preserved. It cannot be
 // used as a shortcut to a GPS installation or source receipt.
 const epoch=new R.WriterEpoch();
 await assert.rejects(legacy.producerObservation('arm',{...options(epoch),maxRecords:0}));
 await legacy.terminate();controls.push('legacy-invalid-control');
 console.log(JSON.stringify({nativeRenderWorker:true,controls}));
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
 try{await manager.stop();}catch(error){console.error(error);process.exitCode=1;}
});
