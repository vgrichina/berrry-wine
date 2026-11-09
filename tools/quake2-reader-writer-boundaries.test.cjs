'use strict';
// Actual serialized reader/capture/progress caller, inert VM page; no browser.
const assert=require('node:assert/strict'),vm=require('node:vm');
const passive=require('./quake2-passive-attack.cjs');
const {fixture}=require('./quake2-passive-attack.test.cjs');
const {COPIES}=require('./quake2-frame-writer-witness.cjs');
const strip=row=>{row=JSON.parse(JSON.stringify(row));delete row.at;delete row.frameWriterWitness;return row;};
async function main(){
 const f=fixture(true),events=[];
 // Compare boundary events with the actual typed-array iterations, without
 // supplying boundaries from the iteration instrumentation.
 f.context.events=events;
 vm.runInContext(`globalThis.Uint8Array=class extends Uint8Array {
  *[Symbol.iterator](){
   const shared=this.buffer instanceof SharedArrayBuffer;
   if(shared)events.push(['copy',this.byteOffset,this.length]);
   yield* super[Symbol.iterator]();
  }
 };`,f.context);
 const points=[];
 f.context.q2Writer={boundary:(copy,edge)=>{events.push([copy,edge]);points.push({copy,edge});},
  snapshot:()=>({status:'BOUNDED',points:structuredClone(points),limits:{allWriters:'UNKNOWN',parseGeneration:'UNKNOWN',frameABA:'UNKNOWN',nativeQualification:false}})};
 const bound={createChain:()=>({closed:false,capture:async()=>({capture:{identity:f.identity},after:{}}),progress:async()=>({})})};
 const options={evaluate:source=>vm.runInContext(source,f.context)};
 const chain=passive.createChain(bound,{...options,writerWitnessGlobal:'q2Writer'});
 const original=f.read();events.length=0;
 const capture=await chain.capture('ordinary');
 const row=capture.after.attackInput;
 assert.deepEqual(strip(row),strip(original),'opt-in evidence does not change reader result');
 const expected=[];
 for(const [i,copy] of COPIES.entries()){
  const size=copy.startsWith('damage')?3840:240;
  const bytes=copy.endsWith('.current')?0xa9ce98:0xa9cf8c+(copy.startsWith('damage')?0:(17&15)*240);
  expected.push([copy,'before'],['copy',bytes-0x400000+0x12000,size],[copy,'after']);
 }
 assert.deepEqual(JSON.parse(JSON.stringify(events)),expected,'all six real copies bracketed exactly once in order');
 assert.equal(row.frameWriterWitness.points.length,12);
 assert.equal(row.frameWriterWitness.nativeQualification,false);
 assert.equal(row.frameWriterWitness.limits.parseGeneration,'UNKNOWN');
 const progress=await chain.progress(f.identity);
 assert.equal(progress.attackInput.frameWriterWitness.points.length,24,'progress uses same integration');
 assert.equal(row.frameWriterWitness.points.length,12,'earlier evidence remains detached');
 const missing=await passive.createChain(bound,{...options,writerWitnessGlobal:'absent'}).progress(f.identity);
 assert.equal(missing.attackInput.frameWriterWitness.status,'UNAVAILABLE');
 assert.deepEqual(strip(missing.attackInput),strip(original),'missing evidence cannot waive/change predicates');
 f.context.absent=false;
 assert.equal((await passive.createChain(bound,{...options,writerWitnessGlobal:'absent'}).progress(f.identity)).attackInput.frameWriterWitness.status,'UNAVAILABLE','false binding cannot silently disable opt-in');
 const ordinary=await passive.createChain(bound,options).progress(f.identity);
 assert.equal(ordinary.attackInput.frameWriterWitness,undefined,'default caller has no witness API calls');
 assert.throws(()=>passive.createChain(bound,{...options,writerWitnessGlobal:'bad.name'}),/global name/);
 for(const [label,witness] of [
  ['boundary failure',{boundary(){throw Error('failed boundary');},snapshot:()=>({status:'BOUNDED',points:[]})}],
  ['snapshot failure',{boundary(){},snapshot(){throw Error('failed snapshot');}}],
  ['async boundary',{boundary:()=>Promise.reject(Error('async observer failed')),snapshot:()=>({status:'BOUNDED'})}],
  ['async snapshot',{boundary(){},snapshot:()=>Promise.reject(Error('async snapshot failed'))}],
  // Exercise the real WorkerLink API without starting a Worker. Its export
  // receipt is a Promise even when the transport reply is already available.
  ['actual WorkerLink export proxy',{boundary:()=>require('../lib/guest-thread-host').WorkerLink.prototype.callExport.call(
   {_ask:()=>Promise.resolve({value:0})},'native_store_get',0),snapshot:()=>({status:'BOUNDED'})}]
 ]){
  f.context.q2Writer=witness;
  const r=(await chain.progress(f.identity)).attackInput;
  assert.equal(r.frameWriterWitness.status,'INVALID',label);
  assert.equal(r.frameWriterWitness.nativeQualification,false,label);
  assert.deepEqual(strip(r),strip(original),label+' leaves predicates unchanged');
 }
 // Rejection before copies retains empty evidence, never invents completion.
 f.context.q2Writer={boundary(){throw Error('unexpected copy');},snapshot:()=>({status:'BOUNDED',points:[]})};
 f.wine.running=false;
 const early=(await chain.progress(f.identity)).attackInput;
 assert.equal(early.status,'UNKNOWN');assert.equal(early.rejectedFrame.motionFirst,null);
 assert.equal(early.frameWriterWitness.points.length,0);
 console.log('PASS actual serialized capture/progress six exact copy boundaries, opt-in/default/missing binding, detached evidence, early rejection, observer errors and asynchronous refusal; acceptance unchanged; nativeQualification false');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
