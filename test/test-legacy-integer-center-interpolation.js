#!/usr/bin/env node
'use strict';
// Offline analytic diagnostics, NOT GPU/queued/public acceptance. The default
// checks the oracle and discriminating controls. --require-integer-center also
// gates the CURRENT emitted, uncorrected fixed VS mapping and currently fails.
// No production/public-fixture interpolation or sampling oracle is imported.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Fixed = require('../lib/d3d9-fixed');
const {Device} = require('../lib/d3d9-backend');
const near = (a,b,why) => assert(Math.abs(a-b)<1e-10, `${why}: ${a} != ${b}`);
const vectorNear = (a,b,why) => a.forEach((v,i)=>near(v,b[i],why));
const edge = (a,b,p) => (b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);

// Screen y grows down. Normalize winding, then apply exact top/left ties to
// coverage ONLY. Barycentric interpolation never uses biased edge equations.
function covered(triangle,p) {
  const t = edge(...triangle)>0 ? triangle : [triangle[0],triangle[2],triangle[1]];
  return t.every((a,i)=>{
    const b=t[(i+1)%3], e=edge(a,b,p), dx=b[0]-a[0],dy=b[1]-a[1];
    return e>0 || (e===0 && (dy<0 || (dy===0 && dx>0)));
  });
}
function barycentric(t,p) {
  const area=edge(...t);
  assert(area!==0);
  return [edge(t[1],t[2],p)/area,edge(t[2],t[0],p)/area,edge(t[0],t[1],p)/area];
}
const affine = (t,values,p) => barycentric(t,p).reduce((s,w,i)=>s+w*values[i],0);
function perspective(t,values,q,p) {
  return affine(t,values.map((v,i)=>v*q[i]),p)/affine(t,q,p);
}
// Independently solve the plane coefficients (not barycentric weights).
function plane(t,v) {
  const [a,b,c]=t, det=(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);
  const x=((v[1]-v[0])*(c[1]-a[1])-(v[2]-v[0])*(b[1]-a[1]))/det;
  const y=((b[0]-a[0])*(v[2]-v[0])-(c[0]-a[0])*(v[1]-v[0]))/det;
  return {x,y,c:v[0]-x*a[0]-y*a[1]};
}
const at = (f,p)=>f.x*p[0]+f.y*p[1]+f.c;
function quotient(n,q,p) {
  const N=at(n,p),Q=at(q,p);
  return {value:N/Q,dx:(n.x*Q-N*q.x)/(Q*Q),dy:(n.y*Q-N*q.y)/(Q*Q)};
}

function controls() {
  let coverageSamples=0;
  // Both diagonals, horizontal/vertical seams, oblique seams, both windings.
  for(const corners of [
    [[0,0],[8,0],[8,8],[0,8]],
    [[0,0],[8,0],[10,8],[2,8]],
    [[0,0],[8,2],[10,10],[2,8]],
  ]) for(const pair of [
    [[corners[0],corners[1],corners[2]],[corners[0],corners[2],corners[3]]],
    [[corners[0],corners[1],corners[3]],[corners[1],corners[2],corners[3]]],
  ]) for(const reverse of [false,true]) {
    const triangles=pair.map(t=>reverse?[t[0],t[2],t[1]]:t);
    // Test actual shared-edge midpoints, including positive-slope diagonals.
    const shared=pair[0].filter(a=>pair[1].includes(a));
    const p=shared[0].map((v,i)=>(v+shared[1][i])/2);
    assert.equal(triangles.filter(t=>covered(t,p)).length,1,'one shared-edge owner');
    coverageSamples++;
  }
  for(const [pair,p] of [
    [[[[0,0],[8,0],[0,4]],[[0,4],[8,4],[0,8]]],[2,4]],
    [[[[0,0],[4,0],[4,8]],[[4,0],[8,0],[4,8]]],[4,2]],
  ]) {
    assert.equal(pair.filter(t=>covered(t,p)).length,1,'one axis-aligned seam owner');
    coverageSamples++;
  }
  // Authored oblique triangle. At (4,3), lambda=(1/2,1/4,1/4).
  const t=[[1,1],[9,1],[5,9]],p=[4,3],q=[1,.5,.25];
  vectorNear(barycentric(t,p),[.5,.25,.25],'hand barycentrics');
  const uv=[[0,0],[2,0],[0,4]];
  vectorNear([0,1].map(i=>perspective(t,uv.map(v=>v[i]),q,p)),[4/11,4/11],'hand perspective UV');
  // Affine color test with q=1 avoids imposing an unverified legacy color
  // perspective policy. Smooth perspective color separately tests GL transport.
  near(affine(t,[.2,.6,1],p),.5,'hand affine color');
  near(perspective(t,[.2,.6,1],q,p),19/55,'hand smooth color');
  near(affine(t,[.1,.7,.9],p),.45,'hand device depth (affine, not divided by Q)');
  const Q=plane(t,q),N=plane(t,uv.map((v,i)=>v[0]*q[i]));
  near(quotient(N,Q,p).value,4/11,'independent quotient plane');
  // Exact numerator/denominator transport recovers integer-center values.
  // A first-order correction of the divided UV is NOT exact for perspective.
  const shifted=[p[0]+1/16,p[1]+1/16],s=quotient(N,Q,shifted);
  const corrected=(at(N,shifted)-(N.x+N.y)/16)/(at(Q,shifted)-(Q.x+Q.y)/16);
  near(corrected,4/11,'exact plane transport');
  assert(Math.abs(s.value-(s.dx+s.dy)/16-4/11)>1e-6,'reject first-order UV correction');
  assert(Math.abs(perspective(t,[.1,.7,.9],q,p)-.45)>.1,'reject perspective device depth');
  // A second oblique triangle, varied Q and sample positions: compare two
  // independent interpolators and transport BOTH UV numerator planes.
  let transportSamples=0;
  for(const triangle of [t,[[2,1],[12,4],[3,13]]]) {
    const values=[[0,2,0],[0,0,4],[.2,.6,1]],Q=plane(triangle,q);
    for(let y=2;y<9;y++)for(let x=2;x<10;x++) {
      const p=[x,y];if(!covered(triangle,p))continue;
      const displaced=[x+1/16,y+1/16];
      for(const v of values) {
        const N=plane(triangle,v.map((a,i)=>a*q[i]));
        near(quotient(N,Q,p).value,perspective(triangle,v,q,p),'plane/barycentric agreement');
        const transported=(at(N,displaced)-(N.x+N.y)/16)/(at(Q,displaced)-(Q.x+Q.y)/16);
        near(transported,perspective(triangle,v,q,p),'exact rational transport across oblique triangle');
      }
      const Z=plane(triangle,[.1,.7,.9]);
      near(at(Z,displaced)-(Z.x+Z.y)/16,affine(triangle,[.1,.7,.9],p),'affine depth transport');
      transportSamples++;
    }
  }
  // A finite translation changes coverage away from ties. It cannot serve as
  // a general exact top-left predicate, even when it preserves tile seams.
  const sliver=[[0,0],[8,0],[0,8+1/32]],point=[4,4];
  assert(covered(sliver,point));
  assert(!covered(sliver,[point[0]+1/16,point[1]+1/16]),'reject finite coverage bias as exact rule');
  const diagonal=[[0,0],[8,8]];
  near(edge(...diagonal,[4,4]),edge(...diagonal,[4+1/16,4+1/16]),'diagonal translation is tangential');
  return {coverageSamples,transportSamples,obliqueTriangle:t,sample:p,perspectiveUV:[4/11,4/11],depth:.45};
}

function mapping() {
  const identity=()=>Float32Array.from([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
  const draw=usage=>({vertexShader:null,pixelShader:null,state:{},textures:[{width:16,height:16}],
    attributes:[[0,usage,3],[5,10,4],[7,5,1]].map(([register,usage,type])=>({register,usage,usageIndex:0,type,offset:0})),
    fixedFunction:{lighting:false,specular:false,fog:false,textureFactor:0xffffffff,
      world:identity(),view:identity(),projection:identity(),
      stages:[{colorOp:4,colorArg1:2,colorArg2:0,alphaOp:4,alphaArg1:2,alphaArg2:0,
        transformFlags:0,texCoordIndex:0},{colorOp:1}]}});
  const viewport={x:0,y:0,width:32,height:32,minZ:0,maxZ:1};
  const tl=Fixed.compile(draw(9),viewport),xf=Fixed.compile(draw(0),viewport);
  // Fail closed on a changed lowering; this deliberately bounded diagnostic
  // does not pretend to execute arbitrary GLSL or model rasterizer snapping.
  const a=/vec2\(0\.5 - (\d+\.\d+)\/(\d+\.\d+)\)/.exec(tl.vertex.source);
  const b=/vec2\(1\.0,-1\.0\)\*\(1\.0-(\d+\.\d+)\/(\d+\.\d+)\)/.exec(xf.vertex.source);
  assert(a&&b,'unsupported new mapping; extend the diagnostic before accepting it');
  for(const plan of [tl,xf]) {
    assert(plan.vertex.source.includes('ff_uv = d3d_v7.xy;'));
    assert(plan.vertex.source.includes('ff_diffuse = clamp(d3d_v5,0.0,1.0);'));
    assert(!/dFdx|dFdy|gl_FragDepth/.test(plan.pixel.source),'unsupported fragment correction');
  }
  const bias=Number(a[1])/Number(a[2]);
  near(Number(b[1])/Number(b[2])/2,bias,'transformed and POSITIONT displacement');
  // Capture actual backend program assembly, stopping before compilation or
  // uploads. This is a source-boundary test, NEVER a queued draw substitute.
  for(const usage of [9,0]) {
    const snapshot=draw(usage),sentinel=new Error('program captured');
    snapshot.primitive=4;snapshot.primitiveCount=1;
    snapshot.textures[0].sampler={min:2,mag:1,mip:2};
    const device=Object.create(Device.prototype);
    let sources;
    Object.assign(device,{gpu:{version:2,canvas:{width:32,height:32},gl:{},
      createProgram(v,p){sources={v,p};throw sentinel;}},
      programs:new Map(),fixedPlans:new Fixed.TLCache(),bindDepth(){}});
    assert.throws(()=>device.draw(snapshot),error=>error===sentinel);
    assert.equal(sources.v,(usage===9?tl:xf).vertex.source,'backend retains the displaced fixed VS');
    assert(sources.p.includes('d3d_sample0(ff_uv)'),'mip wrapper consumes unchanged smooth UV');
  }
  return {bias,tl,xf};
}

// Independent four-tap sampler using explicit tensor weights, not the public
// oracle's nested lerps. The grid is authored here, not read from production.
function sample(level,u,v,linear) {
  const d=16>>level;
  const tap=(x,y)=>[24+23*level+(x%2)*112,20+17*level+(y%2)*120,28+19*level+((x+y)%2)*96];
  if(!linear)return tap(Math.floor(u*d),Math.floor(v*d));
  const x=u*d-.5,y=v*d-.5,i=Math.floor(x),j=Math.floor(y),fx=x-i,fy=y-j;
  const taps=[tap(i,j),tap(i+1,j),tap(i,j+1),tap(i+1,j+1)];
  const weights=[(1-fx)*(1-fy),fx*(1-fy),(1-fx)*fy,fx*fy];
  return [0,1,2].map(c=>taps.reduce((sum,t,k)=>sum+t[c]*weights[k],0));
}
function run(options={}) {
  const analytic=controls(),{bias}=mapping();
  const t=[[0,0],[32,0],[0,32]],p=[2,3];
  const actuals=[[24,140,124],[47,98,84],[24,140,124],[159,37,143],[121,50,107]];
  const configs=[[.5,false],[.5,true],[.5,false],[4,false],[4,true]];
  const observations=configs.map(([n,linear],i)=>{
    const uv=[[.137,.193],[.137+n,.193],[.137,.193+n]];
    const color=point=>sample(n<1?0:1,...[0,1].map(c=>affine(t,uv.map(v=>v[c]),point)),linear);
    const expected=color(p),displaced=color([p[0]+bias,p[1]+bias]),actual=actuals[i];
    assert(actual.every((v,c)=>Math.abs(v-displaced[c])<.6),'displacement predicts retained readback, not runtime proof');
    return {expected,displaced,retainedActual:actual,withinTolerance:actual.every((v,c)=>Math.abs(v-expected[c])<=2)};
  });
  vectorNear(observations[4].expected,[113.752,42.28,103.404992],'independent first failure');
  assert(!observations[4].withinTolerance,'retained MIN LINEAR must remain rejected at tolerance 2');
  // Interior points are covered in both models: failure here is interpolation,
  // not an omitted pixel. Also exercise oblique edges and a nonuniform Q.
  const t2=analytic.obliqueTriangle,p2=analytic.sample,q=[1,.5,.25],uv=[0,2,0];
  assert(covered(t2,p2)&&covered(t2,[p2[0]+bias,p2[1]+bias]));
  const expectedUV=perspective(t2,uv,q,p2);
  const shiftedUV=perspective(t2,uv,q,[p2[0]+bias,p2[1]+bias]);
  const expectedColor=affine(t2,[.2,.6,1],p2),shiftedColor=affine(t2,[.2,.6,1],[p2[0]+bias,p2[1]+bias]);
  const expectedDepth=affine(t2,[.1,.7,.9],p2),shiftedDepth=affine(t2,[.1,.7,.9],[p2[0]+bias,p2[1]+bias]);
  assert(Math.abs(shiftedUV-expectedUV)>.009,'perspective control detects displaced evaluation');
  assert(Math.abs(shiftedColor-expectedColor)>.007,'color control detects displaced evaluation');
  assert(Math.abs(shiftedDepth-expectedDepth)>.008,'depth control detects displaced evaluation');
  const report={status:'OFFLINE DIAGNOSTICS ONLY; integer-center contract unresolved',analytic,bias,observations,
    oblique:{expectedUV,shiftedUV,expectedColor,shiftedColor,expectedDepth,shiftedDepth}};
  if(options.evidence) {
    const retained=JSON.parse(fs.readFileSync(options.evidence));
    assert(retained.status.startsWith('FAIL'));
    const rows=retained.partial.observations;
    assert.equal(rows.length,5);
    rows.forEach((row,i)=>{
      assert.deepEqual(row.actual,actuals[i]);
      vectorNear(row.expected,observations[i].expected,'retained independent expected');
    });
    report.retainedEvidenceVerified=path.resolve(options.evidence);
  }
  if(options.requireIntegerCenter) {
    // An acceptance command must reject CURRENT source as well as the old
    // pixels. Keeping this gate opt-in avoids disguising a known failing test
    // as an ordinary passing regression or breaking unrelated unit runs.
    near(shiftedUV,expectedUV,'CURRENT lowering integer-center perspective UV');
    near(shiftedColor,expectedColor,'CURRENT lowering integer-center color');
    near(shiftedDepth,expectedDepth,'CURRENT lowering integer-center depth');
  }
  return report;
}
if(require.main===module) {
  const args=process.argv.slice(2),evidence=args.find(a=>a.startsWith('--evidence='));
  assert(args.every(a=>a==='--require-integer-center'||a.startsWith('--evidence=')),'unknown argument');
  console.log(JSON.stringify(run({requireIntegerCenter:args.includes('--require-integer-center'),evidence:evidence?.slice(11)}),null,2));
}
module.exports={run,covered,barycentric,affine,perspective,plane,quotient};
