#!/usr/bin/env node
'use strict';
// Exact rational geometry and IEEE-754 roundTiesToEven. This file imports no
// renderer, clipper, plane, span or sampler. Public transport is loaded only
// by publicRuns(); its floating reference is never an acceptance oracle here.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const gcd=(a,b)=>b?gcd(b,a%b):a<0n?-a:a;
class Q{
  constructor(n,d=1n){n=BigInt(n);d=BigInt(d);assert(d!==0n);if(d<0n){n=-n;d=-d;}const g=gcd(n,d);this.n=n/g;this.d=d/g;}
  static of(v){if(v instanceof Q)return v;const s=String(v),m=s.match(/^(-?)(\d+)(?:\.(\d+))?$/);assert(m,'decimal '+s);return new Q(BigInt((m[1]||'')+m[2]+(m[3]||'')),10n**BigInt((m[3]||'').length));}
  add(v){v=Q.of(v);return new Q(this.n*v.d+v.n*this.d,this.d*v.d);}
  neg(){return new Q(-this.n,this.d);}
  sub(v){return this.add(Q.of(v).neg());}
  mul(v){v=Q.of(v);return new Q(this.n*v.n,this.d*v.d);}
  div(v){v=Q.of(v);return new Q(this.n*v.d,this.d*v.n);}
  floor(){return this.n>=0n?this.n/this.d:-((-this.n+this.d-1n)/this.d);}
  number(){return Number(this.n)/Number(this.d);}
  toJSON(){return {exact:this.n+'/'+this.d,decimal:this.number()};}
}
const q=Q.of,pow2=e=>e>=0?new Q(1n<<BigInt(e)):new Q(1n,1n<<BigInt(-e));
function even(n,d){const k=n/d,r=n%d;return k+(2n*r>d||(2n*r===d&&(k&1n))?1n:0n);}
function bitsQ(bits){const sign=bits>>>31?-1n:1n,e=bits>>>23&255,m=bits&0x7fffff;assert(e!==255);return new Q(sign*BigInt(e?m+0x800000:m)).mul(pow2(e?e-150:-149));}
function bits(v){v=q(v);if(v.n===0n)return 0;const sign=v.n<0n?0x80000000:0;v=v.n<0n?v.neg():v;let e=v.n.toString(2).length-v.d.toString(2).length;if(v.sub(pow2(e)).n<0n)e--;assert(e<128);const unit=pow2(Math.max(e-23,-149)),s=v.div(unit);let m=even(s.n,s.d);if(e< -126)return (sign+Number(m))>>>0;if(m===0x1000000n){m>>=1n;e++;}return (sign+(e+127)*0x800000+Number(m-0x800000n))>>>0;}
const f=v=>bitsQ(bits(v)),describe=v=>({...q(v).toJSON(),binary32:'0x'+bits(v).toString(16).padStart(8,'0')});
const rgba=[['16','48','80','255'],['224','40','176','255'],['64','128','224','255']].map(a=>a.map(q));
function authored(zs,order=[0,1,2],storage=false){return order.map(i=>{const z=q(zs[i]),w=q(1).add(z.div(2)),x=[-1,1,-1][i],y=[1,1,-1][i];const h=[w.mul(x),w.mul(y),z,w];if(storage){h[0]=f(h[0]);h[1]=f(h[1]);h[2]=f(z);h[3]=f(q(1).add(f(h[2].div(2))));}return {h,c:rgba[i],fog:q([32,128,224][i])};});}
// Algebraic edge intersection, exact on the supplied homogeneous inputs.
function clip(poly){for(const plane of [v=>v.h[2],v=>v.h[3].sub(v.h[2])]){const out=[];for(let i=0;i<poly.length;i++){const a=poly[(i+poly.length-1)%poly.length],b=poly[i],da=plane(a),db=plane(b);if((da.n<0n)!==(db.n<0n)){const at=(av,bv)=>db.mul(av).sub(da.mul(bv)).div(db.sub(da));out.push({h:a.h.map((v,j)=>at(v,b.h[j])),c:a.c.map((v,j)=>q(at(v,b.c[j]).floor())),fog:q(at(a.fog,b.fog).floor())});}if(db.n>=0n)out.push(b);}poly=out;}return poly;}
function project(poly,store=false){return poly.map(v=>({...v,s:[q(16).mul(v.h[0].div(v.h[3]).add(1)),q(16).mul(q(1).sub(v.h[1].div(v.h[3])))].map(n=>store?f(n):n)}));}
function bary(poly,point){const cross=(a,b,c)=>b[0].sub(a[0]).mul(c[1].sub(a[1])).sub(b[1].sub(a[1]).mul(c[0].sub(a[0])));for(let i=1;i+1<poly.length;i++){const tri=[poly[0],poly[i],poly[i+1]],s=tri.map(v=>v.s),a=cross(...s),p=point.map(q),weights=[cross(s[1],s[2],p).div(a),cross(s[2],s[0],p).div(a),cross(s[0],s[1],p).div(a)];if(weights.some(v=>v.n<0n))continue;const channels=[0,1,2,3].map(c=>weights.reduce((sum,w,j)=>sum.add(w.mul(tri[j].c[c])),q(0)));return {tri,weights,channels,bytes:channels.map(v=>Number(v.floor()))};}return null;}
// A small, explicit arithmetic experiment, NOT an output oracle. The graph
// tests whether an already-rounded reciprocal/depth representation can explain
// the far edge. Every operation reports its exact unrounded result and RN32.
function farEdgeExperiment(){
  const trace=[];
  const op=(name,expression)=>{const value=f(expression);trace.push({name,before:expression,after:describe(value)});return value;};
  const sz=op('store 4/3',q(4).div(3)),rhw=op('store 1/3',q(1).div(3));
  const w=op('recover w',q(1).div(rhw));
  const oneMinusZ=op('1 - stored sz',q(1).sub(sz));
  const distance=op('far distance',oneMinusZ.div(rhw));
  const denominator=op('distance - 1',distance.sub(1));
  const t=op('clip fraction B to A',distance.div(denominator));
  const lerp=(label,a,b)=>{a=q(a);b=q(b);const delta=op(label+' difference',b.sub(a)),product=op(label+' product',delta.mul(t));return op(label+' sum',a.add(product));};
  const iw=lerp('w',w,1),cx=lerp('homogeneous x',w,-1),cy=lerp('homogeneous y',w,1);
  const sx=op('screen x',q(16).add(op('x scale',op('x quotient',cx.div(iw)).mul(16))));
  const sy=op('screen y',q(16).sub(op('y scale',op('y quotient',cy.div(iw)).mul(16))));
  const reciprocal=op('intersection reciprocal',q(1).div(iw));
  const values=[lerp('red',224,16),lerp('green',40,48),lerp('blue',176,80),lerp('alpha',255,255),lerp('fog',128,32)];
  return {trace,s:[sx,sy],rhw:reciprocal,channels:values,bytes:values.map(v=>Number(v.floor()))};
}
function nearEdgeExperiment(){
  const trace=[];
  const op=(name,expression)=>{const value=f(expression);trace.push({name,before:expression,after:describe(value)});return value;};
  const za=op('guest A.z',q('-0.5')),zb=op('guest B.z',q('0.8'));
  const wa=op('project A.w',q(1).add(op('A.z / 2',za.div(2))));
  const wb=op('project B.w',q(1).add(op('B.z / 2',zb.div(2))));
  const qa=op('store A.rhw',q(1).div(wa)),qb=op('store B.rhw',q(1).div(wb));
  const sa=op('store A.sz',za.div(wa)),sb=op('store B.sz',zb.div(wb));
  const da=op('near A.distance',sa.div(qa)),db=op('near B.distance',sb.div(qb));
  const t=op('near clip fraction A to B',da.div(op('distance difference',da.sub(db))));
  const aw=op('recover A.w',q(1).div(qa)),bw=op('recover B.w',q(1).div(qb));
  const lerp=(label,a,b)=>{a=q(a);b=q(b);return op(label+' sum',a.add(op(label+' product',op(label+' difference',b.sub(a)).mul(t))));};
  const w=lerp('intersection w',aw,bw),x=lerp('intersection x',aw.neg(),bw);
  const sx=op('screen x',q(16).add(op('x scale',op('x quotient',x.div(w)).mul(16))));
  const values=[lerp('red',16,224),lerp('green',48,40),lerp('blue',80,176),lerp('alpha',255,255),lerp('fog',32,128)];
  return {trace,x:sx,channels:values,bytes:values.map(v=>Number(v.floor()))};
}
function reference(){
  const near=clip(authored(['-0.5','0.8','0.6'],[1,2,0])),far=clip(authored(['0','4','0'],[0,2,1]));
  const primary=bary(project(clip(authored(['-0.5','0.8','0.6']))),[16,4]);
  assert.deepEqual(primary.bytes.slice(0,3),[104,51,131]);
  const n=bary(project(near),[16,4]),ns=bary(project(near,true),[16,4]);
  assert.equal(n.channels[0].sub(100).n,0n);assert.equal(ns.bytes[0],99);
  const ulps=[-1,0,1].map(offset=>{const poly=project(near,true);poly[0].s[0]=bitsQ(bits(poly[0].s[0])+offset);return {offset,x:describe(poly[0].s[0]),sample:bary(poly,[16,4])};});
  assert.deepEqual(ulps.map(v=>v.sample.bytes[0]),[100,99,99]);
  // Independently specified representation experiment: storing z/w and 1/w
  // before recovering signed far distances. It is not a D3D requirement.
  const z=f(q(4).div(3)),rhw=f(q(1).div(3));
  const d=f(f(q(1).sub(z)).div(rhw)),den=f(d.sub(1)),t=f(d.div(den));
  const delta=f(q(80).sub(176)),product=f(t.mul(delta)),sum=f(q(176).add(product));
  assert.equal(Number(sum.floor()),127);assert.equal(q(80).add(q(96).div(2)).floor(),128n);
  const farIdeal=bary(project(far),[5,6]);assert.equal(farIdeal.bytes[2],117);
  // Hold geometry fixed and replace ONLY the affected intersection byte.
  const packed=far.map(v=>({...v,c:v.c.slice()}));const affected=packed.find(v=>v.c[2].sub(128).n===0n);assert(affected);affected.c[2]=q(127);
  const isolated=bary(project(packed),[5,6]);assert.equal(isolated.bytes[2],116);
  const experiment=farEdgeExperiment(),derived=project(far);
  derived[0]={...derived[0],s:experiment.s,c:experiment.bytes.slice(0,4).map(q),fog:q(experiment.bytes[4])};
  experiment.exactSample=bary(derived,[5,6]);
  experiment.oppositeT=describe(f(q(1).div(f(q(1).sub(d)))));
  experiment.near=nearEdgeExperiment();
  const neighbors=[[-1,0],[0,0],[1,0],[0,-1],[0,1]];
  return {farEdgeExperiment:experiment,primary,near:{ideal:n,storedTL:ns,ulps,storedInputExactClip:project(clip(authored(['-0.5','0.8','0.6'],[1,2,0],true)),true),polygon:project(near,true),neighbors:neighbors.map(([x,y])=>({point:[16+x,4+y],ideal:bary(project(near),[16+x,4+y]),stored:bary(project(near,true),[16+x,4+y])}))},far:{ideal:farIdeal,oneByteIsolation:isolated,polygon:project(far),checkpoints:{z:describe(z),rhw:describe(rhw),distance:describe(d),denominator:describe(den),t:describe(t),delta:describe(delta),product:describe(product),sum:describe(sum)},neighbors:neighbors.map(([x,y])=>({point:[5+x,6+y],ideal:bary(project(far),[5+x,6+y]),isolated:bary(project(packed),[5+x,6+y])}))},authored:{near:authored(['-0.5','0.8','0.6']).map(v=>({...v,h:v.h.map(describe)})),storedNear:authored(['-0.5','0.8','0.6'],[0,1,2],true).map(v=>({...v,h:v.h.map(describe)})),far:authored(['0','4','0']).map(v=>({...v,h:v.h.map(describe)}))}};
}
function selfTest(){
  assert.equal(bits(new Q(1n).add(pow2(-24))),0x3f800000); // tie, even low
  assert.equal(bits(new Q(1n).add(pow2(-23)).add(pow2(-24))),0x3f800002);
  assert.equal(bits(pow2(-150)),0);assert.equal(bits(pow2(-149)),1);
  assert.equal(bits(new Q(3n).mul(pow2(-150))),2);assert.equal(bits(q(-1)),0xbf800000);
  const d=new DataView(new ArrayBuffer(4));for(let i=0;i<1000;i++){const v=new Q(BigInt(i*7919-3000000),BigInt(i+17));d.setFloat32(0,v.number(),true);assert.equal(bits(v),d.getUint32(0,true));}
  return reference();
}
async function publicRuns(wasm,out){
  const transport=require('./test-legacy-fractional-color'),p=transport.plan(),states=[];
  for(const [prefix,order,point] of [['z-0.5,0.8,0.6/',[1,2,0],[16,4]],['z0,4,0/',[0,2,1],[5,6]],['z-0.5,0.8,0.6/',[0,1,2],[16,4]]]){
    for(const constant of [false,true])for(const fog of [false,true]){
      const s=p.states.find(s=>s.label.startsWith(prefix)&&s.geomW&&s.constant===constant&&s.fog===fog&&String(s.order)===String(order));assert(s);
      const samples=[[0,0],[-1,0],[1,0],[0,-1],[0,1]].map(([x,y])=>({x:point[0]+x,y:point[1]+y}));
      states.push({...s,samples});
      const poly=clip(authored(s.layers[0].zs.map(String),order));const hit=bary(project(poly),point);assert(hit);
      const manual=hit.tri.map(v=>({h:v.h.map(n=>n.number()),c:constant?[64,96,128,255]:v.c.map(n=>n.number()),f:constant?96:v.fog.number()}));
      states.push({...s,label:s.label+'/exactManualTL',samples,layers:s.layers.map(l=>l.name==='clipped'?{...l,manual}:l)});
    }
    const s=states.find(s=>s.label.startsWith(prefix)&&String(s.order)===String(order)&&!s.constant&&!s.fog);
    const qControl=p.states.find(v=>v.label.endsWith('/otherTextureQ'));
    states.push({...s,label:s.label+'/distinctQ',layers:s.layers.map(l=>({...l,matrix:qControl.layers[0].matrix,qCoefficients:qControl.layers[0].qCoefficients}))});
    states.push({...s,label:s.label+'/alpha',layers:s.layers.map(l=>l.name==='clipped'?{...l,alphaTest:true,diffuse:l.diffuse.map((c,i)=>((c&0xffffff)|([32,192,128][i]<<24))>>>0)}:l)});
  }
  let images;const summaries=[];
  for(const queued of [false,true])for(const indexed of [false,true]){
    const r=await transport.run(wasm,{states,queued,indexed});assert.equal(r.failure,null);assert.equal(r.status,'PASS');
    if(summaries.length)assert.equal(r.wasmSHA256,summaries[0].moduleSHA,'same module bytes for every route');
    assert(r.calls.some(c=>c.label==='Lock Surface7'&&c.result===0));
    if(queued){
      assert.equal(r.transport.fallbacks,0);assert.equal(r.records.length,states.length);assert.equal(r.immutable.length,states.length);assert.equal(r.transport.replayCommands,states.length*2);
      for(const row of r.immutable)assert.deepEqual(row.after,row.before);
      for(let i=0;i<states.length;i++)for(let j=0;j<states[i].layers.length;j++){
        const layer=states[i].layers[j];
        for(let slot=0;slot<3;slot++){
          const v=r.records[i][j].vertices[slot],manual=layer.manual?.[slot];
          const z=manual?q(manual.h[2]):f(q(layer.zs[layer.order[slot]]));
          const w=manual?q(manual.h[3]):layer.geomW?f(q(1).add(f(z.div(2)))):q(1);
          assert.equal(v[2],f(z.div(w)).number(),'exact binary32 captured z/w');
          assert.equal(v[3],f(q(1).div(w)).number(),'exact binary32 captured 1/w');
        }
      }
    }
    const targets=r.observations.filter((o,i)=>i%5===0).map(o=>o.dibRGBA);
    if(images)assert.deepEqual(targets,images,'all public routes complete target parity');else images=targets;
    for(let i=0;i<states.length;i++)if(states[i].label.endsWith('/distinctQ')){const j=states.findIndex(s=>s.label===states[i].label.replace('/distinctQ',''));assert.deepEqual(targets[i],targets[j]);}
    for(let i=0;i<states.length;i++)if(states[i].constant&&!states[i].fog){for(const o of r.observations.slice(i*5,i*5+5))assert.deepEqual(o.actual,[64,96,128]);}
    const alpha=states.findIndex(s=>s.label.startsWith('z0,4,0/')&&s.label.endsWith('/alpha'));
    const opaque=states.findIndex(s=>s.label===states[alpha].label.replace('/alpha',''));
    assert.notDeepEqual(targets[alpha],targets[opaque],'public alpha-test discriminator');
    fs.writeFileSync(path.join(out,`public-${queued}-${indexed}.json.gz`),zlib.gzipSync(JSON.stringify(r)));
    summaries.push({queued,indexed,moduleSHA:r.wasmSHA256,scenes:states.length,draws:r.drawCount,observations:r.observations.map(o=>({label:o.label,actual:o.actual,expected:o.expected}))});
  }
  fs.writeFileSync(path.join(out,'public-summary.json'),JSON.stringify(summaries,null,2));return images;
}
async function main(){const report=selfTest(),out=process.argv.find(a=>a.startsWith('--out='))?.slice(6),wasm=process.argv.find(a=>a.startsWith('--wasm='))?.slice(7);if(out){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'exact-reference.json'),JSON.stringify(report,null,2));}if(wasm){assert(out);await publicRuns(wasm,out);}console.log('PASS exact rational / binary32 boundary diagnostics'+(wasm?' and public transport characterizations':''));}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={Q,bits,bitsQ,f,clip,project,bary,authored,reference,selfTest,publicRuns};
