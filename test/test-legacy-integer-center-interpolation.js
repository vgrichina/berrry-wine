#!/usr/bin/env node
'use strict';
// Offline analytic diagnostics, NOT GPU/queued/public acceptance. The default
// checks the oracle and discriminating controls. --require-integer-center also
// gates the CURRENT emitted, uncorrected fixed VS mapping and currently fails.
// --require-unbiased-raster retains the earlier pre-fragment dependency failure.
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
    [[[[0,4],[8,4],[0,0]],[[0,4],[8,8],[8,4]]],[2,4]],
    [[[[4,0],[4,8],[0,0]],[[4,0],[8,8],[4,8]]],[4,2]],
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
  let transportSamples=0,strictInteriorSamples=0,boundarySamples=0,reversedTransportSamples=0;
  for(const triangle of [t,[[2,1],[12,4],[3,13]]]) {
    const values=[[0,2,0],[0,0,4],[.2,.6,1]],Q=plane(triangle,q);
    for(let y=2;y<9;y++)for(let x=2;x<10;x++) {
      const p=[x,y];if(!covered(triangle,p))continue;
      const displaced=[x+1/16,y+1/16];
      if(barycentric(triangle,p).every(w=>w>0))strictInteriorSamples++;else boundarySamples++;
      const reverse=a=>[a[0],a[2],a[1]],reversed=reverse(triangle),reverseQ=plane(reversed,reverse(q));
      for(const v of values) {
        const N=plane(triangle,v.map((a,i)=>a*q[i]));
        near(quotient(N,Q,p).value,perspective(triangle,v,q,p),'plane/barycentric agreement');
        const transported=(at(N,displaced)-(N.x+N.y)/16)/(at(Q,displaced)-(Q.x+Q.y)/16);
        near(transported,perspective(triangle,v,q,p),'exact rational transport across oblique triangle');
        const reverseN=plane(reversed,reverse(v.map((a,i)=>a*q[i])));
        const reverseTransport=(at(reverseN,displaced)-(reverseN.x+reverseN.y)/16)/(at(reverseQ,displaced)-(reverseQ.x+reverseQ.y)/16);
        near(reverseTransport,perspective(triangle,v,q,p),'reversing winding preserves rational UV/color transport');
        near(perspective(reversed,reverse(v),reverse(q),p),reverseTransport,'reversed barycentric/plane agreement');
      }
      const Z=plane(triangle,[.1,.7,.9]);
      near(at(Z,displaced)-(Z.x+Z.y)/16,affine(triangle,[.1,.7,.9],p),'affine depth transport');
      near(at(plane(reversed,reverse([.1,.7,.9])),p),at(Z,p),'reversing winding preserves affine depth');
      transportSamples++;reversedTransportSamples++;
    }
  }
  // A finite translation changes coverage away from ties. It cannot serve as
  // a general exact top-left predicate, even when it preserves tile seams.
  const sliver=[[0,0],[8,0],[0,8+1/32]],point=[4,4];
  assert(covered(sliver,point));
  assert(!covered(sliver,[point[0]+1/16,point[1]+1/16]),'reject finite coverage bias as exact rule');
  const diagonal=[[0,0],[8,8]];
  near(edge(...diagonal,[4,4]),edge(...diagonal,[4+1/16,4+1/16]),'diagonal translation is tangential');
  return {coverageSamples,transportSamples,strictInteriorSamples,boundarySamples,reversedTransportSamples,obliqueTriangle:t,sample:p,perspectiveUV:[4/11,4/11],depth:.45};
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

// Inspect the COMPLETE solid submission boundary, including actual buffers and
// program caching. This spy never compiles GLSL or rasterizes pixels. In
// particular its successful draws cannot qualify any rendered repair.
function solidTransport() {
  const identity=()=>Float32Array.from([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
  const reports=[];
  for(const version of [1,2])for(const usage of [9,0])for(const primitive of [4,5,6]) {
    const constants=new Map(),uploads=[],submitted=[],programs=[],extensions=[];
    const gl=new Proxy({
      colorMask(){},getExtension(name){extensions.push(name);return null;},
    },{get(target,name){if(name in target)return target[name];
      if(!constants.has(name))constants.set(name,constants.size+1);return constants.get(name);}});
    const uniforms=[];
    const gpu={version,gl,canvas:{width:32,height:32},renderHeight:32,
      createProgram(v,p,attributes,names){const value={v,p,attributes,names};programs.push(value);return value;},
      updateBuffer(buffer,target,bytes){uploads.push({buffer,target,bytes});},
      draw(command){submitted.push(command);},
      setUniform(program,name,kind,value){uniforms.push({name,kind,value});},
      setCapability(){},setDepthFunc(){},setDepthMask(){},setBlendFunc(){},
      setFrontFace(){},setCullFace(){},setViewport(){},setDepthRange(){},bindTexture(){},
    };
    const device=Object.create(Device.prototype);
    Object.assign(device,{gpu,vertices:{name:'original vertex buffer'},indices:{name:'original index buffer'},
      fixedPlans:new Fixed.TLCache(),programs:new Map(),textures:new Map(),textureTargets:new Map(),
      bindDepth(){},touchColor(){},uploadTexture(){}});
    const vertices=new Uint8Array(4*28),data=new DataView(vertices.buffer);
    [[0,0],[8,0],[8,8],[0,8]].forEach(([x,y],i)=>{
      [x,y,.1+i*.2,usage===9?1/(i+1):1].forEach((v,j)=>data.setFloat32(i*28+j*4,v,true));
      data.setUint32(i*28+16,0xff203040+i*0x10203,true);
      data.setFloat32(i*28+20,x/8,true);data.setFloat32(i*28+24,y/8,true);
    });
    const indices=Uint16Array.from(primitive===4?[0,1,2,0,2,3]:primitive===5?[0,1,3,2]:[0,1,2,3]);
    const before=vertices.slice(),beforeIndices=indices.slice();
    const snapshot={primitive,primitiveCount:2,stride:28,vertices,indices,
      viewport:{x:0,y:0,width:32,height:32,minZ:0,maxZ:1},
      vertexShader:null,pixelShader:null,state:{cull:1},textures:[{width:16,height:16}],
      attributes:[[0,usage,3,0],[5,10,4,16],[7,5,1,20]].map(([register,usage,type,offset])=>({register,usage,usageIndex:0,type,offset})),
      fixedFunction:{lighting:false,specular:false,fog:false,textureFactor:0xffffffff,
        world:identity(),view:identity(),projection:identity(),
        stages:[{colorOp:4,colorArg1:2,colorArg2:0,alphaOp:4,alphaArg1:2,alphaArg2:0,
          transformFlags:0,texCoordIndex:0},{colorOp:1}]}};
    device.draw(snapshot);device.draw(snapshot);
    assert.equal(programs.length,1,'actual backend program cache reuses this source');
    assert.equal(submitted.length,2);
    for(const call of submitted){
      assert.equal(call.count,indices.length,'no conservative solid expansion');
      assert.equal(call.mode,gl[primitive===4?'TRIANGLES':primitive===5?'TRIANGLE_STRIP':'TRIANGLE_FAN']);
      assert.equal(call.stride,28);
      assert.deepEqual(call.attributes.map(a=>a.name),['d3d_v0','d3d_v5','d3d_v7'],'only original per-vertex inputs');
      assert.equal(call.vertexBuffer,device.vertices);assert.equal(call.indexBuffer,device.indices);
    }
    assert.equal(uploads.length,4);
    assert(uploads.filter(u=>u.target===gl.ARRAY_BUFFER).every(u=>u.bytes===vertices),'original bytes uploaded directly');
    assert(uploads.filter(u=>u.target===gl.ELEMENT_ARRAY_BUFFER).every(u=>{
      assert.equal(u.bytes.buffer,indices.buffer);assert.deepEqual(u.bytes,indices);return true;
    }),'original indices without primitive-local copies');
    assert.deepEqual(vertices,before);assert.deepEqual(indices,beforeIndices);
    assert(!/gl_FragCoord|gl_FragDepth|dFdx|dFdy/.test(programs[0].p),'no fragment ownership/attribute/depth reconstruction');
    assert(programs[0].p.includes('texture2D(d3d_s0,ff_uv)'),'smooth UV consumed unchanged');
    assert.deepEqual(extensions,[],'ordinary fixed draw works with neither optional WebGL1 correction extension');
    reports.push({version,usage,primitive,draws:submitted.length,programs:programs.length,
      originalVertices:true,originalIndices:true,edgeTransport:false,conservativeExpansion:false,
      fragmentDepthCorrection:false,optionalExtensionsRequested:extensions});
  }
  return reports;
}

// A second exact coverage implementation uses integer edge coefficients,
// independent of the barycentric helper. 1/32 is an authored fixture lattice,
// NOT a claim about D3D or GL snapping. No epsilon enters interpolation.
function integerOwnership(triangle,p,oppositeTies=false) {
  let t=triangle.map(v=>v.map(n=>{assert(Number.isInteger(n*32));return BigInt(n*32);}));
  const P=p.map(n=>{assert(Number.isInteger(n*32));return BigInt(n*32);});
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  if(cross(...t)<0n)t=[t[0],t[2],t[1]];
  return t.every((a,i)=>{
    const b=t[(i+1)%3],A=a[1]-b[1],B=b[0]-a[0],C=a[0]*b[1]-b[0]*a[1];
    const E=A*P[0]+B*P[1]+C,inclusive=A>0n||(A===0n&&B>0n);
    return E>0n||(E===0n&&(oppositeTies?!inclusive:inclusive));
  });
}
function coverageDependency() {
  // A missing strict interior is a pre-fragment failure. Even exact rational
  // attribute reconstruction plus discard cannot create an invocation there.
  const triangle=[[0,0],[8,0],[0,8+1/32]],p=[4,4],translated=[4+1/16,4+1/16];
  assert(barycentric(triangle,p).every(w=>w>0),'strict interior, not a tie');
  assert(integerOwnership(triangle,p));
  assert(!integerOwnership(triangle,translated));
  const q=[1,.5,.25],values=[0,2,4],Q=plane(triangle,q),N=plane(triangle,values.map((v,i)=>v*q[i]));
  near((at(N,translated)-(N.x+N.y)/16)/(at(Q,translated)-(Q.x+Q.y)/16),
    perspective(triangle,values,q,p),'exact rational correction exists but cannot run at omitted pixel');
  const pair=[[[0,0],[8,0],[8,8]],[[0,0],[8,8],[0,8]]];
  let seamSamples=0,wrongOwners=0;
  for(const reverse of [false,true])for(let k=1;k<8;k++) {
    const triangles=pair.map(t=>reverse?[t[0],t[2],t[1]]:t),sample=[k,k];
    const wanted=triangles.map(t=>integerOwnership(t,sample));
    const displaced=[k+1/16,k+1/16];
    // ES2 guarantees one owner for a shared edge, but does not prescribe D3D
    // top-left ownership. The opposite complementary policy is legal input to
    // this portability counterexample; it is NOT a measured GPU policy.
    const other=triangles.map(t=>integerOwnership(t,displaced,true));
    assert.equal(wanted.filter(Boolean).length,1);assert.equal(other.filter(Boolean).length,1);
    assert.notDeepEqual(wanted,other,'finite shift tangential to the diagonal cannot control its tie');
    const blend=owners=>owners.reduce((dst,owns,i)=>owns?dst*.5+[.2,.8][i]*.5:dst,0);
    assert(Math.abs(blend(wanted)-blend(other))>.2,'ownership-sensitive blending discriminates legal opposite ties');
    // Distinct primitive depths expose wrong ownership as well as blend color.
    const depth=owners=>Math.min(1,...owners.flatMap((owns,i)=>owns?[.25,.75][i]:[]));
    assert.notEqual(depth(wanted),depth(other));
    seamSamples++;wrongOwners++;
  }
  // Axis/diagonal/oblique paired coverage across a grid, both winding orders.
  // Expected coverage is independent of attributes and no bias is inserted.
  let coverageSamples=0;
  for(const pair of [
    [[[0,0],[8,0],[8,8]],[[0,0],[8,8],[0,8]]],
    [[[0,0],[8,0],[0,8]],[[8,0],[8,8],[0,8]]],
    [[[0,4],[8,4],[0,0]],[[0,4],[8,8],[8,4]]],
    [[[4,0],[4,8],[0,0]],[[4,0],[8,8],[4,8]]],
    [[[0,0],[8,2],[10,10]],[[0,0],[10,10],[2,8]]],
  ])for(const reverse of [false,true])for(let y=1;y<8;y++)for(let x=1;x<8;x++) {
    const triangles=pair.map(t=>reverse?[t[0],t[2],t[1]]:t),point=[x,y];
    const owners=triangles.map(t=>integerOwnership(t,point));
    assert.deepEqual(owners,triangles.map(t=>covered(t,point)),'independent coefficient/edge coverage');
    assert(owners.filter(Boolean).length<=1,'no double blend on the authored adjacent triangles');
    if(pair.every(t=>t.every(([a,b])=>(a===0||a===8)&&(b===0||b===8))))
      assert.equal(owners.filter(Boolean).length,1,'rectangle strict interiors and both diagonals have no holes');
    coverageSamples++;
  }
  // Correct LOD requires the quotient-rule gradient at the corrected location.
  // Reusing displaced derivatives after correcting only UV is discriminated.
  const t=[[1,1],[9,1],[5,9]],v=[0,2,0],r=[1,.5,.25],P=plane(t,r),U=plane(t,v.map((a,i)=>a*r[i]));
  const a=quotient(U,P,[4,3]),b=quotient(U,P,[4+1/16,3+1/16]);
  assert(Math.abs(a.dx-b.dx)>1e-4&&Math.abs(a.dy-b.dy)>1e-4,'displaced gradients are not corrected gradients');
  return {firstUnsupportedDependency:'solid conservative coverage plus primitive-local post-clip edge transport before fragment shading',
    strictInterior:{triangle,p,integerCenterCovered:true,shiftedCovered:false},
    seamSamples,wrongOwners,coverageSamples,correctedGradient:{dx:a.dx,dy:a.dy},displacedGradient:{dx:b.dx,dy:b.dy},
    limitation:'analytic counterexamples and actual backend submission spy; no rendered candidate or GPU snapping model'};
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
  const solid=solidTransport(),coverage=coverageDependency();
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
    solid,coverage,
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
  if(options.requireUnbiasedRaster) {
    assert(!solid.some(s=>!s.conservativeExpansion&&!s.edgeTransport),
      'MISSING_SOLID_COVERAGE_TRANSPORT: original indexed vertices reach GL without conservative coverage or primitive-local post-clip edge equations; fragment-only correction cannot restore the strict interior witness');
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
  assert(args.every(a=>a==='--require-integer-center'||a==='--require-unbiased-raster'||a.startsWith('--evidence=')),'unknown argument');
  console.log(JSON.stringify(run({requireIntegerCenter:args.includes('--require-integer-center'),requireUnbiasedRaster:args.includes('--require-unbiased-raster'),evidence:evidence?.slice(11)}),null,2));
}
module.exports={run,solidTransport,integerOwnership,coverageDependency,covered,barycentric,affine,perspective,plane,quotient};
