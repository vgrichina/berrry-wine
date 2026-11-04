'use strict';
// Source-boundary checks execute the complete Device.draw path. Rendered cases
// are exported for a separately bounded real-browser session; Node alone does
// not qualify coverage, GLSL compilation, interpolation or public COM pixels.
const assert=require('node:assert/strict');
const {Device}=require('../lib/d3d9-backend');
const Fixed=require('../lib/d3d9-fixed');
function snapshot(usage=9,primitive=4){
  const vertices=new Uint8Array(4*40),v=new DataView(vertices.buffer);
  [[0,0],[8,0],[8,8],[0,8]].forEach(([x,y],i)=>{
    [x,y,.1+i*.2,usage===9?1/(i+1):1,.2,.4,.6,1,x/8,y/8].forEach((n,j)=>v.setFloat32(i*40+j*4,n,true));
  });
  return {primitive,primitiveCount:2,stride:40,vertices,
    indices:Uint16Array.from(primitive===4?[0,1,2,0,2,3]:primitive===5?[0,1,3,2]:[0,1,2,3]),
    viewport:{x:0,y:0,width:32,height:32,minZ:0,maxZ:1},state:{cull:1},
    textures:[{width:16,height:16,clampMipChain:true,sampler:{min:2,mag:1,mip:2}}],
    attributes:[[0,usage,3,0],[1,10,3,16],[2,5,1,32]].map(([register,usage,type,offset])=>({register,usage,usageIndex:0,type,offset})),
    fixedFunction:{lighting:false,specular:false,fog:false,textureFactor:0xffffffff,
      world:Float32Array.from([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),
      view:Float32Array.from([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),
      projection:Float32Array.from([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),
      stages:[{colorOp:4,colorArg1:2,colorArg2:0,alphaOp:4,alphaArg1:2,alphaArg2:0,texCoordIndex:0,transformFlags:0},{colorOp:1}]}};
}
function transport(onProgram){
  const reports=[];
  for(const version of [1,2])for(const usage of [9,0])for(const primitive of [4,5,6]){
    const programs=[],calls=[],uniforms=[],uploads=[],constants=new Map();
    const gl=new Proxy({colorMask(){},getExtension(){return {}; }},{get(t,n){if(n in t)return t[n];if(!constants.has(n))constants.set(n,constants.size+1);return constants.get(n);}});
    const gpu={version,gl,canvas:{width:32,height:32},renderHeight:32,
      createProgram(v,p,attributes,names){const result={v,p,attributes,names};programs.push(result);return result;},
      updateBuffer(buffer,target,bytes){uploads.push({buffer,target,bytes});},
      draw(call){calls.push(call);},setUniform(program,name,kind,value){uniforms.push({name,kind,value});},
      setCapability(){},setDepthFunc(){},setDepthMask(){},setBlendFunc(){},setFrontFace(){},setCullFace(){},setViewport(){},setDepthRange(){},bindTexture(){}};
    const device=Object.create(Device.prototype);
    const mipMetadata=Object.fromEntries(['mips0[0]','lod0','filter0','extent0','address0','border0'].map(n=>['d3d_'+n,new Float32Array(n==='mips0[0]'?48:4)]));
    Object.assign(device,{gpu,solidCoverageTransport:true,vertices:{},indices:{},fixedPlans:new Fixed.TLCache(),programs:new Map(),
      textures:new Map(),textureTargets:new Map(),mipUniforms:new Map([[0,mipMetadata]]),bindDepth(){},touchColor(){},uploadTexture(){}});
    const draw=snapshot(usage,primitive),original=draw.vertices.slice(),indices=draw.indices.slice();
    device.draw(draw);device.draw(draw);
    assert.equal(programs.length,1,'candidate source cache');
    assert.equal(calls.length,4,'one conservative invocation rectangle per original primitive');
    assert(calls.every(c=>c.count===6&&c.stride===8&&c.indexBuffer===undefined&&c.attributes[0].name==='solid_corner'));
    assert.equal(uploads.length,2);assert(uploads.every(u=>u.bytes.length===12));
    assert.deepEqual(draw.vertices,original);assert.deepEqual(draw.indices,indices);
    const p=programs[0];
    if(onProgram)onProgram(p,{version,usage,primitive});
    assert.match(p.v,/solid_clip\(a,b,c\)/);assert.match(p.v,/floor\(low\)/);
    assert.match(p.p,/edge==0\.&&!inclusive/);assert.match(p.p,/gl_FragDepthEXT=/);
    assert.match(p.p,/cross\(pb,pc\)/);assert.match(p.p,/solid_pixel\(\);if\(!covered\)discard/);
    assert.match(p.p,/ff_uv=\(solid_value0_ff_uv\*beta.x/,'UV reconstructs its original numerator/Q');
    assert.match(p.p,/ff_diffuse=\(solid_value0_ff_diffuse\*beta.x/,'color reconstructs its own original numerator/Q');
    assert.match(p.p,/dFdx\(uv\*solid_q\)-uv\*dFdx\(solid_q\)/,'mip derivative uses the unbiased affine numerator and Q');
    assert.match(p.p,/dot\(beta,vec3\(a.z,b.z,c.z\)\)/,'device depth is affine independently of Q');
    assert(!p.v.includes('1.0/16.0')&&!p.v.includes('1.0-2.0/16.0'),'no displaced input geometry');
    assert(!p.p.includes('.solid_v_'),'namespace must preserve GLSL swizzles');
    for(const source of [p.v,p.p])for(const index of source.matchAll(/solid_(?:polygon|scratch)\[([^\]]+)\]/g))
      assert(/^(?:12|[012]|i|slot)$/.test(index[1]),'ES1 fragment arrays require constant or loop-symbol subscripts: '+index[1]);
    assert(uniforms.some(u=>u.name==='solid_input_d3d_v0[0]'&&u.value.length===12));
    assert(uniforms.some(u=>u.name==='solid_v_d3d_ff_viewport'));
    const expected=primitive===5?[[0,1,3],[3,1,2]]:[[0,1,2],[0,2,3]];
    const positions=uniforms.filter(u=>u.name==='solid_input_d3d_v0[0]');
    const uv=uniforms.filter(u=>u.name==='solid_input_d3d_v2[0]');
    assert.equal(positions.length,4);assert.equal(uv.length,4);
    const bytes=new DataView(original.buffer);
    for(let submission=0;submission<4;submission++)for(let corner=0;corner<3;corner++){
      const vertex=expected[submission%2][corner];
      for(let c=0;c<4;c++)assert.equal(positions[submission].value[corner*4+c],bytes.getFloat32(vertex*40+c*4,true),'input planes preserve original position and RHW');
      for(let c=0;c<2;c++)assert.equal(uv[submission].value[corner*4+c],bytes.getFloat32(vertex*40+32+c*4,true),'primitive-local UV inputs preserve topology parity');
    }
    reports.push({version,usage,primitive,programs:programs.length,draws:calls.length});
  }
  return reports;
}

// Independent screen-space edge oracle, not imported from the backend or the
// older diagnostic. Float fixtures are binary rationals, with no tolerances in
// ownership and no biased weights in the color/depth expectations.
async function renderedCases(options={}){
  const check=(ok,message)=>{if(!ok)throw Error(message);};
  const cross=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
  const owns=(t,p)=>{const v=cross(t[0],t[1],t[2])>0?t:[t[0],t[2],t[1]];return v.every((a,i)=>{const b=v[(i+1)%3],e=cross(a,b,p);return e>0||(e===0&&(b[1]<a[1]||(b[1]===a[1]&&b[0]>a[0])));});};
  const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;document.body.append(canvas);
  const device=new D3D9Backend.Device(canvas,{webglVersion:options.version||1,solidCoverageTransport:options.candidate!==false});
  const gpu=device.gpu,gl=gpu.gl;
  const result={version:gpu.version,candidate:options.candidate!==false,cases:[],pixels:0};
  const draw=(points,colors,q=[1,1,1],depth=[.5,.5,.5],state={})=>{
    const input=new Float32Array(3*8);
    points.forEach((p,i)=>input.set([p[0],p[1],depth[i],q[i],...colors[i]],i*8));
    device.draw({primitive:4,primitiveCount:1,stride:32,vertices:new Uint8Array(input.buffer),
      attributes:[{register:0,usage:9,usageIndex:0,type:3,offset:0},{register:1,usage:10,usageIndex:0,type:3,offset:16}],
      state:{cull:1,zenable:false,...state},fixedFunction:{lighting:false,specular:false,fog:false,textureFactor:0xffffffff,stages:[{colorOp:1}]}});
  };
  const read=()=>gpu.readPixels(0,0,32,32,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(32*32*4));
  const at=(bytes,x,y)=>Array.from(bytes.slice(((31-y)*32+x)*4,((31-y)*32+x)*4+4));
  const near=(actual,expected,label)=>check(actual.every((n,i)=>Math.abs(n-expected[i])<=1),label+' '+actual+' expected '+expected);
  const clear=()=>device.clear([0,0,0,1],3);
  try{
    const witness=[[0,0],[8,0],[0,8+1/32]];
    clear();draw(witness,Array(3).fill([1,0,0,1]));
    const first=at(read(),4,4);result.strictInterior=first;
    if(options.candidate===false){check(first[0]===0,'old path must retain omitted strict interior');return result;}
    near(first,[255,0,0,255],'omitted strict interior');result.cases.push('strict interior restored');
    for(const original of [
      [[[0,0],[8,0],[8,8]],[[0,0],[8,8],[0,8]]],
      [[[0,0],[8,0],[0,8]],[[8,0],[8,8],[0,8]]],
      [[[0,4],[8,4],[0,0]],[[0,4],[8,8],[8,4]]],
      [[[4,0],[4,8],[0,0]],[[4,0],[8,8],[4,8]]],
      [[[0,0],[8,2],[10,10]],[[0,0],[10,10],[2,8]]],
    ])for(const reverse of [false,true])for(const blend of [false,true]){
      const pair=original.map(t=>reverse?[t[0],t[2],t[1]]:t);clear();
      pair.forEach((t,i)=>draw(t,Array(3).fill(i?[0,1,0,.5]:[1,0,0,.5]),undefined,undefined,{blend,srcblend:5,dstblend:6}));
      const bytes=read();
      for(let y=1;y<8;y++)for(let x=1;x<8;x++){
        const owners=pair.map(t=>owns(t,[x,y])),expected=owners[0]?[blend?128:255,0,0]:owners[1]?[0,blend?128:255,0]:[0,0,0];
        near(at(bytes,x,y).slice(0,3),expected,'shared edge '+JSON.stringify({pair,reverse,blend,x,y}));result.pixels++;
      }
      result.cases.push('paired ownership '+reverse+'/'+blend);
    }
    // Perspective color, independent hand barycentrics (1/2,1/4,1/4).
    const t=[[1,1],[9,1],[5,9]],colors=[[.2,.1,.9,1],[.6,.8,.1,1],[1,.4,.5,1]],q=[1,.5,.25];
    for(const reverse of [false,true]){
      const rev=a=>reverse?[a[0],a[2],a[1]]:a;clear();draw(rev(t),rev(colors),rev(q),rev([.1,.7,.9]));
      const weights=[.5,.125,.0625],sum=weights.reduce((a,b)=>a+b);
      const expected=[0,1,2,3].map(c=>255*weights.reduce((s,w,i)=>s+w*colors[i][c],0)/sum);
      near(at(read(),4,3),expected,'perspective color '+reverse);result.cases.push('perspective color '+reverse);
    }
    // Viewport-generated clip edge: x=0 is inclusive, x=32 exclusive. The
    // original primitive extends beyond both sides of the viewport.
    clear();draw([[-8,0],[40,0],[-8,48]],Array(3).fill([0,0,1,1]));
    near(at(read(),0,4),[0,0,255,255],'generated left clip edge');result.cases.push('viewport clip edge');
    // Near clipping generates an oblique edge x+y=4. Compare to the two
    // independently authored triangles of the resulting clipped quadrilateral.
    for(const reverse of [false,true]){
      const rev=a=>reverse?[a[0],a[2],a[1]]:a;
      clear();draw(rev([[0,0],[8,0],[0,8]]),Array(3).fill([0,0,1,1]),undefined,rev([-.5,.5,.5]));
      const clipped=[[[4,0],[8,0],[0,8]],[[4,0],[0,8],[0,4]]],bytes=read();
      for(let y=0;y<9;y++)for(let x=0;x<9;x++){
        near(at(bytes,x,y),clipped.some(t=>owns(t,[x,y]))?[0,0,255,255]:[0,0,0,255],'near clip '+x+','+y);result.pixels++;
      }
      result.cases.push('generated oblique near clip '+reverse);
    }
    // Hardware depth must see affine device Z=.45, independent of RHW.
    // A later .44 primitive passes; .46 fails. Perspective depth (~.282)
    // would incorrectly occlude both. Repeat both winding orders.
    for(const reverse of [false,true])for(const z of [.44,.46]){
      const rev=a=>reverse?[a[0],a[2],a[1]]:a;
      clear();draw(rev(t),Array(3).fill([1,0,0,1]),rev(q),rev([.1,.7,.9]),{zenable:true,zwrite:true});
      draw(t,Array(3).fill([0,1,0,1]),undefined,[z,z,z],{zenable:true,zwrite:true});
      near(at(read(),4,3),z<.45?[0,255,0,255]:[255,0,0,255],'affine depth '+reverse+'/'+z);
      result.cases.push('affine depth '+reverse+'/'+z);
    }
    check(gpu.getError()===gl.NO_ERROR,'GL error');
    return result;
  }finally{device.destroy();}
}
// Validate retained real-browser results separately from the submission mocks.
// A planner/GLSL-only result, stale backend, or a missing queued Worker cell
// must not be presented as rendered acceptance.
function renderedEvidence(file){
  const fs=require('node:fs'),crypto=require('node:crypto');
  const evidence=JSON.parse(fs.readFileSync(file,'utf8'));
  const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
  assert.match(evidence.status,/^PASS rendered candidate/);
  assert(!evidence.error&&!evidence.timeout);
  assert.equal(evidence.source.files['lib/d3d9-backend.js'].sha256,
    hash(fs.readFileSync(require.resolve('../lib/d3d9-backend'))),'rendered backend must match current source');
  assert.deepEqual(evidence.oldInterior.strictInterior,[0,0,0,255]);
  assert.match(evidence.oldPublic.error,/PIXEL ORACLE spatial MIN LINEAR/);
  assert.deepEqual(evidence.oldPublic.partial.observations.at(-1).actual,[121,50,107]);
  for(const version of [1,2]){
    const cells=evidence.stages.filter(s=>s.direct?.version===version);
    assert.equal(cells.length,1);
    const direct=cells[0].direct;
    assert.equal(direct.candidate,true);assert.equal(direct.pixels,1142);
    assert.equal(direct.cases.length,30);
    assert.deepEqual(direct.strictInterior,[255,0,0,255]);
  }
  let observations=0;
  for(const module of ['wine-assembly.wasm','wine-assembly.compat.wasm'])
    for(const mode of ['worker','webgl'])for(const version of [1,2]){
      const cells=evidence.stages.filter(s=>s.module===module&&s.mode===mode&&s.version===version);
      assert.equal(cells.length,1,'missing/duplicate real public cell');
      const r=cells[0].result;assert.equal(r.status,'PASS');
      assert.equal(r.observations.length,mode==='worker'?18:12);
      assert.equal(r.stats.errors,0);assert.equal(r.stats.fallbacks,0);
      assert(r.stats.drawCalls>0);
      if(mode==='worker')assert.equal(r.queued.length,3);
      for(const o of r.observations){
        assert(o.actual.every((c,i)=>Math.abs(c-o.expected[i])<=2),'unchanged public tolerance');
        if(mode==='webgl'){assert.equal(o.glError,0);assert.deepEqual(o.webglRGBA.slice(0,3),o.actual);}
      }
      const witness=r.observations.find(o=>o.label==='spatial MIN LINEAR/2,3');
      assert(witness);assert.deepEqual(witness.actual,[114,42,103]);
      assert(witness.expected.every((c,i)=>Math.abs(c-[113.752,42.28,103.404992][i])<1e-8));
      observations+=r.observations.length;
    }
  return {directVersions:2,directPixels:2284,publicCells:8,publicObservations:observations};
}
if(require.main===module){
  console.log('PASS solid candidate actual Device.draw transport '+JSON.stringify(transport()));
  const file=process.argv.find(a=>a.startsWith('--render-evidence='));
  if(file)console.log('PASS retained real WebGL evidence '+JSON.stringify(renderedEvidence(file.slice(18))));
}
module.exports={snapshot,transport,renderedCases,renderedEvidence};
