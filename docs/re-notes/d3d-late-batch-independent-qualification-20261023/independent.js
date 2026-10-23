'use strict';
const assert=require('assert'),fs=require('fs'),Module=require('module'),path=require('path');
const donor='/tmp/d3d-late-batch-oct23/repo';
const fixture=donor+'/docs/re-notes/d3d-late-batch-failure-20261023/device-fault-injection.js';
const src=fs.readFileSync(fixture,'utf8');
const {Device}=require(donor+'/lib/d3d9-software-backend');
function load(text){const m=new Module(fixture,module);m.filename=fixture;m.paths=Module._nodeModulePaths(path.dirname(fixture));m._compile(text.slice(0,text.indexOf('(async()=>{'))+'\nmodule.exports={harness,snapshot};',fixture);return m.exports;}
const results=[];
function late(h,streaming){
 h.fail();const before=h.d.readPixels(),samples=h.d.sampleCount(),last=h.d.lastDrawSamples;
 assert.throws(()=>h.d.draw(load(src).snapshot()),/native raster validation rejected/);
 assert.strictEqual(h.d.sampleCount(),samples);assert.strictEqual(h.d.lastDrawSamples,last);
 const raster=h.events.filter(x=>x[0]==='raster').map(x=>x[1]);assert.deepStrictEqual(raster,streaming?[1,2]:[]);
 if(!streaming)assert.deepStrictEqual(h.d.readPixels(),before);
 else {const expected=new Uint32Array(before.buffer.slice(0));expected[0]=0xff000001;expected[1]=0xff000002;assert.deepStrictEqual(h.d.readPixels(),new Uint8Array(expected.buffer));}
 h.finish();
}
for(const streaming of [false,true]){late(load(src).harness(streaming),streaming);results.push({case:'late-failure',streaming,pass:true});}
function reject(name,make,restore=()=>{}){let rejected=false,reason;try{late(make(),true);}catch(e){assert(e instanceof assert.AssertionError);rejected=true;reason=e.message.slice(0,150);}finally{restore();}assert(rejected,name+' must reject');results.push({control:name,rejected,reason});}
reject('missing-native-release',()=>load(src.replace("assert(contexts.delete(p),'context freed exactly once');","assert(contexts.has(p));")).harness(true));
const retire=Device.prototype.retireBatch;
reject('premature-sample-publication',()=>{Device.prototype.retireBatch=function(draw){retire.call(this,draw);this.completedSamples+=1n;};return load(src).harness(true);},()=>{Device.prototype.retireBatch=retire;});
reject('missing-prefix-write',()=>load(src.replace('0xff000000|c.sequence','0xff000000')).harness(true));
reject('third-batch-incorrectly-accepted',()=>load(src.replace('if(sequence===failAt)return 0;','if(false)return 0;')).harness(true));
{
 const h=load(src).harness(false),step=h.d.step.bind(h.d);let injected=false;
 h.d.step=draw=>{if(!injected){injected=true;const ctx=h.d.exports();
   // A deliberately broken retained path rasterizes its first context before
   // all remaining contexts validate. The real Device path must reject this.
   const result=step(draw);assert(draw.contexts[0]);ctx.d3d_software_step(draw.contexts[0]);return result;}
   return step(draw);};
 assert.throws(()=>late(h,false),assert.AssertionError);assert(h.events.some(x=>x[0]==='raster'));results.push({control:'retained-raster-before-all-validation',rejected:true,actualRaster:h.events.filter(x=>x[0]==='raster')});
}
// Pointer lifetimes, rather than address uniqueness: make streaming reuse one
// native address after retirement. Programs retain their separate identifiers.
const reused=src.replace('const p=identifier++;contexts.set(p,','const p=900000;assert(!contexts.has(p));contexts.set(p,');
late(load(reused).harness(true),true);results.push({case:'streaming-reuses-native-address',pass:true});
const Geometry=require(donor+'/lib/d3d-geometry-batches');
const fixtures=require(donor+'/test/fixtures/d3d9-triangle-edge-cases');
const snap=fixtures.draw([[0,0],[8,0],[0,8]],8,8,true);snap.primitiveCount=800;
snap.vertices=new Uint8Array(800*48);for(let i=0;i<800;i++)snap.vertices.set(fixtures.draw([[0,0],[8,0],[0,8]],8,8,true).vertices,i*48);
const batches=Geometry.split(snap).batches,counts=batches.map(b=>b.indices.length);
assert.deepStrictEqual(counts,[255,255,255,255,255,255,255,255,255,105]);
const prefixCount=counts.slice(0,2).reduce((n,x)=>n+x/3,0);assert.strictEqual(prefixCount,170);
const prefix={...snap,primitiveCount:prefixCount,vertices:snap.vertices.slice(0,prefixCount*48)};
const pb=Geometry.split(prefix).batches;assert.strictEqual(pb.length,2);
for(let i=0;i<2;i++){assert.deepStrictEqual(pb[i].indices,batches[i].indices);assert.deepStrictEqual(pb[i].vertices,batches[i].vertices);}
results.push({case:'saved-count-two-batch-prefix',counts,prefixCount,pass:true});
// Exactly the Set lifetime bookkeeping added to the native fixture.
const live=new Set();for(let i=0;i<3;i++){live.add(123);assert(live.delete(123));}assert(!live.delete(123));
results.push({case:'live-set-reuse-and-double-free-rejection',pass:true});
fs.writeFileSync('/tmp/d3d-late-batch-independent-oct23/independent-results.json',JSON.stringify({scope:'offline production Device/Geometry; explicit export doubles; NOT native',results},null,2)+'\n');
console.log('Independent offline PASS: 5 positive checks and 5 rejecting controls');
