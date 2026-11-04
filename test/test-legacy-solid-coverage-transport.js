'use strict';
// Source-boundary checks execute the complete Device.draw path. Rendered cases
// are exported for a separately bounded real-browser session; Node alone does
// not qualify coverage, GLSL compilation, interpolation or public COM pixels.
const assert=require('node:assert/strict');
const backendArg=process.argv.find(a=>a.startsWith('--backend-sha='));
// Load the exact predecessor in memory, with its normal relative dependencies.
// Git remains the source archive; do not write an old backend into the worktree.
const {Device}=backendArg?(()=>{
  const Module=require('node:module'),{execFileSync}=require('node:child_process');
  const filename=require.resolve('../lib/d3d9-backend'),m=new Module(filename,module);
  m.filename=filename;m.paths=module.paths;
  m._compile(execFileSync('git',['show',backendArg.slice(14)+':lib/d3d9-backend.js'],{encoding:'utf8'}),filename);
  return m.exports;
})():require('../lib/d3d9-backend');
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
  for(const limit of [0,1024])for(const version of [1,2])for(const usage of [9,0])for(const primitive of [4,5,6]){
    const programs=[],calls=[],uniforms=[],uploads=[],constants=new Map();
    const gl=new Proxy({colorMask(){},getExtension(){return {}; },getParameter(){return limit; }},{get(t,n){if(n in t)return t[n];if(!constants.has(n))constants.set(n,constants.size+1);return constants.get(n);}});
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
    assert.equal(calls.length,limit?2:4,'bounded consecutive original primitives per submission');
    assert(calls.every(c=>c.count===(limit?12:6)&&c.stride===12&&c.indexBuffer===undefined&&c.attributes[0].name==='solid_corner'));
    assert.equal(uploads.length,limit?2:4);assert(uploads.every(u=>u.bytes.length===(limit?36:18)));
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
    assert(uniforms.some(u=>u.name==='solid_input_d3d_v0[0]'&&u.value.length===(limit?96:12)));
    assert(uniforms.some(u=>u.name==='solid_v_d3d_ff_viewport'));
    const expected=primitive===5?[[0,1,3],[3,1,2]]:[[0,1,2],[0,2,3]];
    const positions=uniforms.filter(u=>u.name==='solid_input_d3d_v0[0]');
    const uv=uniforms.filter(u=>u.name==='solid_input_d3d_v2[0]');
    assert.equal(positions.length,limit?2:4);assert.equal(uv.length,limit?2:4);
    const bytes=new DataView(original.buffer);
    for(let submission=0;submission<4;submission++)for(let corner=0;corner<3;corner++){
      const vertex=expected[submission%2][corner],bank=limit?Math.floor(submission/2):submission,component=(limit?submission%2*12:0)+corner*4;
      for(let c=0;c<4;c++)assert.equal(positions[bank].value[component+c],bytes.getFloat32(vertex*40+c*4,true),'input planes preserve original position and RHW');
      for(let c=0;c<2;c++)assert.equal(uv[bank].value[component+c],bytes.getFloat32(vertex*40+32+c*4,true),'primitive-local UV inputs preserve topology parity');
    }
    reports.push({limit,version,usage,primitive,programs:programs.length,draws:calls.length});
  }
  return reports;
}

// Actual Device.draw with a recording GPU boundary. Decode every submitted
// rectangle back into an independent per-original-primitive record. No pixels
// or compiler acceptance are inferred from these records.
function batching(){
  const legacy=process.argv.includes('--expect-unbatched'),reports=[];
  for(const version of [1,2])for(const limit of [0,50,64,1024]){
    const uniforms=new Map(),programs=[],calls=[],constants=new Map();let upload,label;
    const state={};
    const gl=new Proxy({colorMask(...v){state.colorMask=v;},getExtension(){return {};},
      getParameter(){return limit;}},{get(t,n){if(n in t)return t[n];if(!constants.has(n))constants.set(n,constants.size+1);return constants.get(n);}});
    const gpu={version,gl,canvas:{width:32,height:32},renderHeight:32,
      createProgram(v,p,attributes){const r={v,p,attributes};programs.push(r);return r;},
      updateBuffer(_b,_t,bytes){upload=bytes.slice();},
      setUniform(_p,n,_k,v){uniforms.set(n,typeof v==='number'?v:Array.from(v));},
      draw(c){calls.push({...c,label,upload:upload.slice(),uniforms:new Map(uniforms),state:JSON.parse(JSON.stringify(state))});},
      setCapability(n,v){state[n]=v;},setDepthFunc(v){state.depthFunc=v;},setDepthMask(v){state.depthMask=v;},
      setBlendFunc(...v){state.blend=v;},setFrontFace(v){state.front=v;},setCullFace(v){state.cull=v;},
      setViewport(...v){state.viewport=v;},setDepthRange(...v){state.range=v;},setScissor(...v){state.scissor=v;},
      setStencilMask(v){state.stencilMask=v;},setStencilFunc(face,...v){state['stencilFunc'+face]=v;},setStencilOp(face,...v){state['stencilOp'+face]=v;},bindTexture(){}};
    const device=Object.create(Device.prototype);
    const mip=Object.fromEntries(['mips0[0]','lod0','filter0','extent0','address0','border0'].map(n=>['d3d_'+n,new Float32Array(n==='mips0[0]'?48:4)]));
    Object.assign(device,{gpu,solidCoverageTransport:true,vertices:{},indices:{},fixedPlans:new Fixed.TLCache(),programs:new Map(),
      textures:new Map(),textureTargets:new Map(),mipUniforms:new Map([[0,mip]]),bindDepth(){},touchColor(){},uploadTexture(){}});
    let originals=0;const records=[];
    // Return to the first shader/state after an intervening topology, vertex
    // type, sampler, blend, depth, cull, viewport and depth-range transition.
    for(const [sequence,primitive,typed,indexed] of [[0,4,0,true],[1,5,6,true],[2,6,7,false],[3,4,0,true]]){
      label=sequence;
      const draw=snapshot(9,primitive),triangles=19,vertexCount=primitive===4?57:21;
      draw.primitiveCount=triangles;draw.stride=40;
      const backing=new Uint8Array((65536+2)*40+32);draw.vertices=backing.subarray(16,16+(65536+2)*40);
      const data=new DataView(draw.vertices.buffer,draw.vertices.byteOffset,draw.vertices.byteLength);
      const order=Array.from({length:vertexCount},(_,i)=>i===2?65535:i+1);
      for(const vertex of order){
        for(let c=0;c<10;c++)data.setFloat32(vertex*40+c*4,(vertex%29+c+1)/32,true);
        if(typed){
          for(let c=0;c<4;c++)data.setUint8(vertex*40+16+c,(vertex+c*31)%256);
          for(let c=0;c<(typed===6?2:4);c++)data.setInt16(vertex*40+32+c*2,-1000+vertex%127+c,true);
        }
      }
      if(indexed){const storage=new Uint16Array(vertexCount+4);storage.set(order,2);draw.indices=storage.subarray(2,2+vertexCount);}
      else {delete draw.indices; // Nonindexed fan uses a contiguous view starting at vertex 1.
        draw.vertices=draw.vertices.subarray(40,40+vertexCount*40);
      }
      if(typed){draw.attributes[1].type=4;draw.attributes[2].type=typed;}
      draw.state={cull:sequence%3+1,blend:sequence%2===1,srcblend:5,dstblend:6,zenable:true,zwrite:sequence%2===0,zfunc:sequence%2?4:2,colorWriteMask:15-sequence};
      draw.viewport={x:sequence,y:sequence,width:24,height:24,minZ:sequence/8,maxZ:1-sequence/8};
      draw.scissor={enabled:sequence%2===1,left:2,top:3,right:20,bottom:22};
      draw.depthAttachment={format:75};
      Object.assign(draw.state,{stencilEnable:sequence%2===1,twoSidedStencil:true,stencilRef:sequence,stencilMask:127,stencilWriteMask:63,stencilPass:3,ccwStencilPass:6});
      for(const v of Object.values(mip))v.fill(sequence/4);
      const beforeVertices=draw.vertices.slice(),beforeIndices=draw.indices?.slice(),start=calls.length;
      device.draw(draw);originals+=triangles;
      const submitted=calls.slice(start),capacity=Number(/solid_input_d3d_v0\[(\d+)\]/.exec(submitted[0].program.v)[1])/3;
      assert.equal(submitted.length,Math.ceil(triangles/capacity));
      if(legacy||!limit)assert.equal(capacity,1);
      else if(limit===1024)assert.equal(capacity,8);
      else assert(capacity>1&&capacity<8,'uniform limits must reduce chunk capacity');
      if(!legacy)for(const source of [submitted[0].program.v,submitted[0].program.p])for(let slot=0;slot<capacity;slot++)for(let corner=0;corner<3;corner++)for(const a of draw.attributes)
        assert(source.includes('if(solid_batch<'+(slot+.5)+')solid_v_d3d_v'+a.register+'=solid_input_d3d_v'+a.register+'['+(slot*3+corner)+'];'),'GPU selector must address the exact original attribute and corner');
      assert.deepEqual(draw.vertices,beforeVertices);assert.deepEqual(draw.indices,beforeIndices);
      let primitiveIndex=0;
      for(const call of submitted){
        assert.equal(call.label,sequence);assert.equal(call.indexBuffer,undefined);
        assert.equal(call.mode,gl.TRIANGLES);
        assert.deepEqual(call.uniforms.get('solid_view'),[sequence,sequence,24,24]);
        assert.deepEqual(call.uniforms.get('solid_target'),[32,32,sequence/8,1-sequence/8]);
        assert.deepEqual(call.uniforms.get('d3d_lod0'),Array(4).fill(sequence/4));
        assert.deepEqual(call.uniforms.get('d3d_filter0'),Array(4).fill(sequence/4));
        assert.deepEqual(call.uniforms.get('d3d_mips0[0]'),Array(48).fill(sequence/4));
        assert.equal(call.state.depthMask,sequence%2===0);
        assert.equal(call.state.depthFunc,sequence%2?gl.LEQUAL:gl.LESS);
        assert.equal(call.state[gl.CULL_FACE],sequence%3!==0);
        assert.equal(call.state.cull,sequence%3===1?gl.FRONT:gl.BACK);
        assert.equal(call.state[gl.SCISSOR_TEST],sequence%2===1);
        assert.equal(call.state[gl.STENCIL_TEST],sequence%2===1);
        if(sequence%2){
          assert.deepEqual(call.state.scissor,[2,10,18,19]);
          assert.equal(call.state.stencilMask,63);
          assert.deepEqual(call.state['stencilFunc'+gl.FRONT],[gl.ALWAYS,sequence,127]);
          assert.deepEqual(call.state['stencilOp'+gl.FRONT],[gl.KEEP,gl.KEEP,gl.REPLACE]);
          assert.deepEqual(call.state['stencilOp'+gl.BACK],[gl.KEEP,gl.KEEP,gl.INVERT]);
        }
        assert.equal(call.state[gl.BLEND],sequence%2===1);
        assert.deepEqual(call.state.colorMask,[0,1,2,3].map(c=>!!((15-sequence)&(1<<c))));
        for(let slot=0;slot<call.count/6;slot++,primitiveIndex++){
          const t=primitiveIndex;
          records.push({sequence,t,inputs:draw.attributes.map(a=>call.uniforms.get('solid_input_d3d_v'+a.register+'[0]').slice(slot*12,slot*12+12)),
            view:call.uniforms.get('solid_view'),target:call.uniforms.get('solid_target'),depthMask:call.state.depthMask,blend:call.state[gl.BLEND],
            mip:['mips0[0]','lod0','filter0','extent0','address0','border0'].map(n=>call.uniforms.get('d3d_'+n))});
          // Original GL/D3D topology parity: the odd strip swaps its first two
          // inputs even when it is the first triangle of a new chunk.
          const triangle=primitive===4?[3*t,3*t+1,3*t+2]:primitive===5?(t%2?[t+1,t,t+2]:[t,t+1,t+2]):[0,t+1,t+2];
          const view=new DataView(beforeVertices.buffer,beforeVertices.byteOffset,beforeVertices.byteLength);
          for(let corner=0;corner<3;corner++){
            const vertex=indexed?beforeIndices[triangle[corner]]:triangle[corner];
            for(const a of draw.attributes){
              const expected=[0,0,0,1],size=a.type===6?2:a.type===1?2:4;
              for(let c=0;c<size;c++)expected[c]=a.type===4?Math.fround(view.getUint8(vertex*40+a.offset+c)/255):
                a.type>=6?view.getInt16(vertex*40+a.offset+c*2,true):view.getFloat32(vertex*40+a.offset+c*4,true);
              assert.deepEqual(call.uniforms.get('solid_input_d3d_v'+a.register+'[0]').slice(slot*12+corner*4,slot*12+corner*4+4),expected,
                'original position/RHW/color/UV and default components at '+JSON.stringify({version,limit,sequence,t,corner,register:a.register}));
            }
          }
          const width=call.stride/4,xy=[];
          for(let v=0;v<6;v++){
            const base=(slot*6+v)*width;xy.push(...call.upload.slice(base,base+2));
            if(width===3)assert.equal(call.upload[base+2],slot,'constant selector on both rectangle triangles');
          }
          assert.deepEqual(xy,[0,0,1,0,1,1,0,0,1,1,0,1]);
        }
      }
      assert.equal(primitiveIndex,triangles);
    }
    // Rejections must never append a draw, and subsequent valid state survives.
    const before=calls.length;
    for(const indices of [new Uint32Array([0,1,2]),new Uint8Array([0,1,2]),new Uint16Array([0,1])]){
      const d=snapshot();d.indices=indices;assert.throws(()=>device.draw(d),/INDEX16|too short/);
    }
    for(const patch of [{userClipPlanes:{mask:1}},{attributes:[{register:0,usage:9,usageIndex:0,type:5,offset:0}]},{vertices:new Uint8Array(4)}]){
      assert.throws(()=>device.draw({...snapshot(),...patch}),/user clip planes|declaration|outside buffer/);
    }
    const empty=snapshot();empty.primitiveCount=0;device.draw(empty);
    assert.equal(calls.length,before);
    const missing=snapshot();device.gpu.gl.getExtension=()=>null;
    if(version===1)assert.throws(()=>device.draw(missing),/EXT_frag_depth/);
    device.gpu.gl.getExtension=()=>({});
    if(version===1){const outline=snapshot();outline.state.fillMode=2;assert.throws(()=>device.draw(outline),/outline requires WebGL2/);}
    for(const primitive of [1,2,3]){
      device.draw(snapshot(9,primitive));assert(!calls.at(-1).program.v.includes('solid_batch'),'point/line topology stays on original path');
    }
    const disabled=snapshot();device.solidCoverageTransport=false;device.draw(disabled);
    assert.equal(calls.at(-1).count,6);assert.equal(calls.at(-1).stride,40);
    assert.equal(calls.at(-1).indexBuffer,device.indices,'default path keeps ordinary indexed draw');
    assert(!calls.at(-1).program.v.includes('solid_batch'));
    reports.push({version,limit,originals,draws:before,transportSHA256:require('node:crypto').createHash('sha256').update(JSON.stringify(records)).digest('hex')});
  }
  return reports;
}

// Numerical reproducer for the first real-browser failure, not GPU acceptance.
// Replay the historical clip arithmetic at Float32 precision, then compare its
// surviving edge with the independently known integer line x=(y+34)/12.
function clippedOriginalEdges(){
  const F=Math.fround,add=(a,b)=>F(F(a)+F(b)),sub=(a,b)=>F(F(a)-F(b));
  const mul=(a,b)=>F(F(a)*F(b)),div=(a,b)=>F(F(a)/F(b));
  const cross=(a,b)=>sub(mul(a[0],b[1]),mul(a[1],b[0]));
  const screen=p=>[mul(add(div(p[0],p[3]),1),16),mul(add(-div(p[1],p[3]),1),16)];
  const plane=(p,n)=>n%2?sub(p[3],p[n>>1]):add(p[3],p[n>>1]);
  const reports=[];
  for(const i of [2,5,8,11,14,17]){
    const points=[[3,2],[26,4],[5,26]],depth=[-.1+i*.01,.5+i*.01,.9-i*.01],rhw=[1,.5,.25];
    const original=points.map((p,j)=>{
      const w=div(1,rhw[j]);return [mul(sub(div(p[0],16),1),w),mul(sub(1,div(p[1],16)),w),mul(sub(mul(F(depth[j]),2),1),w),w];
    });
    let polygon=original;
    for(let n=0;n<6;n++){
      const output=[];let previous=polygon.at(-1);
      for(const p of polygon){
        const dp=plane(previous,n),dc=plane(p,n);
        if(dp<0&&dc>0||dp>0&&dc<0)output.push(previous.map((v,k)=>div(sub(mul(v,dc),mul(p[k],dp)),sub(dc,dp))));
        if(dc>=0)output.push(p);previous=p;
      }
      polygon=output;
    }
    const projected=polygon.map(screen),a=projected.at(-1),b=projected[0];
    const edge=cross([sub(b[0],a[0]),sub(b[1],a[1])],[sub(4,a[0]),sub(14,a[1])]);
    const sa=screen(original[2]),sb=screen(original[0]);
    const anchored=cross([sub(sb[0],sa[0]),sub(sb[1],sa[1])],[sub(4,sa[0]),sub(14,sa[1])]);
    assert.equal(12*4,14+34,'the independent integer line owns (4,14)');
    assert.equal(anchored,0,'original endpoint equation retains exact tie');
    assert(sb[1]<sa[1],'this is an inclusive left edge');
    reports.push({primitive:i,clippedEdge:edge,originalEdge:anchored});
  }
  assert.equal(reports[0].clippedEdge,-1/65536,'retained first clipped edge changes the ownership sign');
  assert(reports.some(r=>r.clippedEdge<0),'old clipped endpoints must reject an owned sample');
  assert(reports.slice(3).every(r=>r.clippedEdge===0),'unclipped control retains exact edge');
  // Actual production-generated sources must contain the correction in both
  // fallback and batched programs; this is a source check, never pixel proof.
  transport(p=>{
    assert.match(p.p,/if\(positiveW\)/);
    assert.match(p.p,/solid_owns\(sc,sa,point,originalOrientation\)/);
    assert.match(p.p,/float clipDepth=dot\(beta,vec3\(a.z,b.z,c.z\)\)/);
    assert.match(p.p,/bool constantPlane=slope.x==0\.&&slope.y==0\./);
    assert.match(p.p,/solid_cut\(vec3\(a.w\+a.z,b.w\+b.z,c.w\+c.z\),beta,dx,dy\)/);
    assert.match(p.p,/solid_cut\(vec3\(a.w-a.z,b.w-b.z,c.w-c.z\),beta,dx,dy\)/);
    // Evaluate the emitted scalar halfspace helper itself. This checks its
    // tie-direction semantics, not WebGL compilation or floating-point rules.
    const body=/bool solid_cut\(vec3 distances,vec3 beta,vec3 dx,vec3 dy\)\{([\s\S]*?)\n\}/.exec(p.p)[1];
    const evaluate=source=>Function('dot','vec2','distances','beta','dx','dy',source.replace(/\b(?:float|vec2|bool) (\w+)=/g,'const $1='));
    const dot=(a,b)=>a.reduce((s,n,i)=>s+n*b[i],0),vec2=(x,y)=>({x,y});
    const cut=evaluate(body),beta=[.5,.25,.25],dx=[-1,1,0],dy=[-1,0,1];
    const cases=[
      [[-1,1,1],true,'near diagonal inclusive'],[[1,-1,-1],false,'far diagonal exclusive'],
      [[-1,3,-1],true,'vertical inclusive'],[[1,-3,1],false,'vertical exclusive'],
      [[-1,-1,3],true,'horizontal inclusive'],[[1,1,-3],false,'horizontal exclusive'],
      [[0,0,0],true,'flat boundary'],[[1,1,1],true,'flat interior'],[[-1,-1,-1],false,'flat outside'],
    ];
    for(const [distances,expected,label]of cases)assert.equal(cut(dot,vec2,distances,beta,dx,dy),expected,label);
    const backwards=evaluate(body.replace('slope.x>0.','slope.x<0.'));
    assert.notEqual(backwards(dot,vec2,[-1,1,1],beta,dx,dy),true,'reversed tie-direction control must reject');
  });
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
// Real compiler and pixel coverage across bank boundaries. The reference below
// operates on the original triangles, never on invocation rectangles or GLSL.
async function renderedBatches(options={}){
  const check=(ok,message)=>{if(!ok)throw Error(message);};
  const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;document.body.append(canvas);
  const d=new D3D9Backend.Device(canvas,{webglVersion:options.version,solidCoverageTransport:true});
  const g=d.gpu,gl=g.gl,submissions=[],programs=[];
  const create=g.createProgram.bind(g),submit=g.draw.bind(g);
  g.createProgram=(v,p,...args)=>{
    programs.push({vertex:v,fragment:p});
    // Deliberately collapse all banks to primitive zero. This compiles, but
    // must fail the independent pixel oracle with distinct primitive inputs.
    if(options.control==='selector'){
      v=v.replace(/solid_batch=solid_corner.z;/,'solid_batch=0.;');
      p=p.replace(/if\(solid_batch</g,'if(0.<');
    }
    return create(v,p,...args);
  };
  g.draw=call=>{submissions.push(call.count);return submit(call);};
  if(options.limit)d.solidUniformLimits=[options.limit,options.limit];
  const depth={id:900,width:32,height:32,format:75};
  const attributes=[{register:0,usage:9,usageIndex:0,type:3,offset:0},{register:1,usage:10,usageIndex:0,type:3,offset:16}];
  const fixedFunction={lighting:false,specular:false,fog:false,textureFactor:0xffffffff,stages:[{colorOp:1}]};
  const reports=[];let comparisons=0;
  // Preserve the reached cells and first failed pixel before throwing. A
  // first-failure browser run must remain diagnosable without another launch.
  const evidence=globalThis.legacyBatchEvidence={version:g.version,control:options.control||null,
    limit:options.limit||null,reports,submissions,programs,comparisons:0,samples:[]};
  const clear=()=>d.clear([0,0,0,1],7,1,null,depth,0);
  const issue=(triangles,state={},extra={})=>{
    if(options.control==='order')triangles=triangles.slice().reverse();
    const input=Float32Array.from(triangles.flatMap(t=>t.points.flatMap((p,i)=>[...p,t.z?.[i]??.5,t.q?.[i]??1,...(t.colors?.[i]||t.color)])));
    d.draw({primitive:4,primitiveCount:triangles.length,stride:32,vertices:new Uint8Array(input.buffer),attributes,
      depthAttachment:depth,state:{cull:1,zenable:false,...state},fixedFunction,...extra});
  };
  const cross=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
  const sample=(t,x,y)=>{
    let v=t.points.map((p,i)=>({p,z:t.z?.[i]??.5,q:t.q?.[i]??1,c:t.colors?.[i]||t.color}));
    if(cross(v[0].p,v[1].p,v[2].p)<0)v=[v[0],v[2],v[1]];
    const area=cross(v[0].p,v[1].p,v[2].p),p=[x,y];
    if(!area||!v.every((a,i)=>{const b=v[(i+1)%3],e=cross(a.p,b.p,p),dy=b.p[1]-a.p[1],dx=b.p[0]-a.p[0];return e>0||(e===0&&(dy<0||(dy===0&&dx>0)));}))return null;
    const w=[cross(v[1].p,v[2].p,p),cross(v[2].p,v[0].p,p),cross(v[0].p,v[1].p,p)].map(n=>n/area);
    const z=w.reduce((s,n,i)=>s+n*v[i].z,0);if(z<0||z>1)return null;
    const q=w.reduce((s,n,i)=>s+n*v[i].q,0);
    return {z,color:[0,1,2,3].map(c=>w.reduce((s,n,i)=>s+n*v[i].q*v[i].c[c],0)/q)};
  };
  const pixels=()=>g.readPixels(0,0,32,32,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4096));
  const compare=(label,reference)=>{
    const bytes=pixels();
    for(let y=1;y<24;y++)for(let x=1;x<24;x++){
      const expected=reference(x,y),offset=((31-y)*32+x)*4,actual=Array.from(bytes.slice(offset,offset+3));
      if(x===4&&y===14)evidence.samples.push({label,x,y,actual,expected});
      if(!actual.every((n,c)=>Math.abs(n-expected[c])<=2)){
        evidence.failure={label,x,y,actual,expected};evidence.failedRGBA=Array.from(bytes);
      }
      check(actual.every((n,c)=>Math.abs(n-expected[c])<=2),label+' pixel '+x+','+y+' actual '+actual+' expected '+expected);
      comparisons++;evidence.comparisons=comparisons;
    }
    check(g.getError()===gl.NO_ERROR,label+' GL error');reports.push(label);
  };
  const triangles=Array.from({length:19},(_,i)=>({
    points:i%3===0?[[-3,0],[27,0],[0,27]]:i%3===1?[[0,0],[25,3],[3,25]]:[[3,2],[26,4],[5,26]],
    color:[(i%3===0?1:.1),(i%3===1?1:.2),(i%3===2?1:.3),.25],
    q:[1,.5,.25],z:[-.1+i*.01,.5+i*.01,.9-i*.01],
  }));
  const reference=(list,blend=false,depthTest=false)=>(x,y)=>{
    let color=[0,0,0],z=1;
    for(const t of list){const s=sample(t,x,y);if(!s||(depthTest&&s.z>z))continue;
      if(depthTest)z=s.z;
      color=s.color.slice(0,3).map((n,c)=>Math.round(n*255*(blend?s.color[3]:1)+(blend?color[c]*(1-s.color[3]):0)));
    }
    return color;
  };
  try{
    clear();issue(triangles);compare('19 ordered clipped primitives',reference(triangles));
    check(submissions.some(n=>n>6)&&submissions.length>=3,'must cross real batched submissions');
    clear();issue(triangles,{blend:true,srcblend:5,dstblend:6});compare('ordered alpha overlap',reference(triangles,true));
    clear();issue(triangles,{zenable:true,zwrite:true});compare('affine depth across batches',reference(triangles,false,true));
    clear();issue(triangles,{blend:true,srcblend:5,dstblend:6},{scissor:{enabled:true,left:4,top:5,right:18,bottom:19}});
    compare('scissor transition',(x,y)=>x>=4&&x<18&&y>=5&&y<19?reference(triangles,true)(x,y):[0,0,0]);
    issue(triangles);compare('scissor blend depth reset',reference(triangles));
    // Distinct interpolated colors in every bank, not just constant colors.
    const smooth=triangles.map((t,i)=>({...t,z:[.2,.4,.6],colors:[[i/20,.1,.2,1],[.1,i/20,.4,1],[.2,.3,i/20,1]]}));
    clear();issue(smooth);compare('rational color across banks',reference(smooth));
    // Each fragment increments exactly once. Nineteen overlapping primitives
    // must leave 19, including coverage-discarded rectangle invocations.
    const cover=Array.from({length:19},()=>({points:[[0,0],[30,0],[0,30]],color:[1,0,0,1]}));
    clear();issue(cover,{colorWriteMask:0,stencilEnable:true,stencilPass:7});
    issue([{...cover[0],color:[0,1,0,1]}],{stencilEnable:true,stencilFunc:3,stencilRef:19,stencilWriteMask:0});
    compare('stencil increment through coverage discard',(x,y)=>sample(cover[0],x,y)?[0,255,0]:[0,0,0]);
    // Opposite winding selects opposite stencil operations under frontFace CW.
    clear();issue(cover.map(t=>({...t,points:[t.points[0],t.points[2],t.points[1]]})),
      {colorWriteMask:0,stencilEnable:true,twoSidedStencil:true,stencilPass:1,ccwStencilPass:7});
    issue([{...cover[0],color:[0,0,1,1]}],{stencilEnable:true,stencilFunc:3,stencilRef:19,stencilWriteMask:0});
    compare('two sided stencil winding',(x,y)=>sample(cover[0],x,y)?[0,0,255]:[0,0,0]);
    issue([{...cover[0],color:[1,0,0,1]}]);
    compare('stencil disable transition',(x,y)=>sample(cover[0],x,y)?[255,0,0]:[0,0,0]);
    for(const cull of [2,3]){
      clear();issue(cover.map((t,i)=>({...t,points:i%2?[t.points[0],t.points[2],t.points[1]]:t.points,
        color:i%2?[0,1,0,1]:[1,0,0,1]})),{cull});
      compare('cull winding '+cull,(x,y)=>sample(cover[0],x,y)?(cull===2?[0,255,0]:[255,0,0]):[0,0,0]);
    }
    for(const primitive of [5,6]){
      const points=primitive===5?Array.from({length:21},(_,i)=>[i+1,i%2?22:1]):
        [[12,12],...Array.from({length:20},(_,i)=>[12+10*Math.cos(i*Math.PI/9.5),12+10*Math.sin(i*Math.PI/9.5)])];
      const colors=points.map((_,i)=>[i/21,(21-i)/21,.25,1]),q=points.map((_,i)=>[1,.5,.25][i%3]);
      const list=Array.from({length:19},(_,i)=>{
        const ids=primitive===5?(i%2?[i+1,i,i+2]:[i,i+1,i+2]):[0,i+1,i+2];
        return {points:ids.map(n=>points[n]),colors:ids.map(n=>colors[n]),q:ids.map(n=>q[n])};
      });
      const input=Float32Array.from(points.flatMap((p,i)=>[...p,.5,q[i],...colors[i]]));
      clear();d.draw({primitive,primitiveCount:19,stride:32,vertices:new Uint8Array(input.buffer),
        indices:Uint16Array.from(points.map((_,i)=>i)),attributes,depthAttachment:depth,state:{cull:1,zenable:false},fixedFunction});
      compare('indexed topology '+primitive+' bank parity',reference(list));
    }
    return {version:g.version,control:options.control||null,limit:options.limit||null,reports,comparisons,submissions,programs,
      samples:evidence.samples,finalRGBA:Array.from(pixels())};
  }finally{d.destroy();canvas.remove();}
}
// Independent exact integer determinant oracle. Inputs are authored window
// homogeneous integers [X,Y,W,Zd3d], not backend-generated clip endpoints.
function eyeOracle(t,x,y){
  const det=(a,b,c)=>a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0]);
  const v=t.h.map(h=>h.slice(0,3).map(BigInt)),p=[BigInt(x),BigInt(y),1n];
  let d=det(...v);if(d===0n)return null;
  const sign=d<0n?-1n:1n;d*=sign;
  const n=[det(p,v[1],v[2]),det(v[0],p,v[2]),det(v[0],v[1],p)].map(a=>a*sign);
  const nx=[det([1n,0n,0n],v[1],v[2]),det(v[0],[1n,0n,0n],v[2]),det(v[0],v[1],[1n,0n,0n])].map(a=>a*sign);
  const ny=[det([0n,1n,0n],v[1],v[2]),det(v[0],[0n,1n,0n],v[2]),det(v[0],v[1],[0n,1n,0n])].map(a=>a*sign);
  const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0n);
  const tests=[[1n,0n,0n],[0n,1n,0n],[0n,0n,1n],t.h.map(h=>BigInt(h[3])),t.h.map(h=>BigInt(h[2]-h[3]))];
  for(const a of tests){const e=dot(a,n),dx=dot(a,nx),dy=dot(a,ny);
    if(e<0n||e===0n&&!(dx>0n||dx===0n&&dy>=0n))return null;
  }
  const q=n.reduce((a,b)=>a+b,0n);if(q<=0n)return null;
  const colors=t.colors||Array(3).fill(t.color||[1,0,0,.5]);
  return {z:Number(dot(t.h.map(h=>BigInt(h[3])),n))/Number(d),
    color:[0,1,2,3].map(c=>n.reduce((s,w,i)=>s+Number(w)*colors[i][c],0)/Number(q))};
}
function eyePlan(){
  return [
    {name:'one negative W oblique',h:[[3,2,1,0],[52,8,2,1],[-5,-26,-1,0]]},
    {name:'zero W direction',h:[[3,2,1,0],[52,8,2,1],[2,24,0,0]]},
    {name:'two negative W',h:[[16,16,1,0],[28,4,-1,0],[4,28,-1,0]]},
    {name:'zero W origin degenerate',h:[[0,0,0,0],[8,2,1,0],[2,8,1,0]]},
    {name:'all negative W',h:[[-2,-2,-1,0],[-24,-2,-1,0],[-2,-24,-1,0]]},
    {name:'eye near cut',h:[[0,0,1,-1],[32,0,1,1],[0,32,-1,0]]},
    {name:'eye far cut',h:[[0,0,1,2],[32,0,1,0],[0,32,-1,0]]},
    {name:'eye shared diagonal a',h:[[0,0,1,0],[32,0,1,1],[32,32,-1,0]]},
    {name:'eye shared diagonal b',h:[[0,0,1,0],[32,32,-1,0],[0,32,1,1]]},
    {name:'collinear XYW',h:[[2,2,1,0],[4,4,2,1],[8,8,-1,0]]},
  ];
}
function eyeFocused(){
const F=Math.fround,A=(a,b)=>F(F(a)+F(b)),S=(a,b)=>F(F(a)-F(b)),M=(a,b)=>F(F(a)*F(b)),D=(a,b)=>F(F(a)/F(b));
function clip(t){let poly=t.map(([X,Y,W,Z])=>[F((X-16*W)/16),F((16*W-Y)/16),F(2*Z-W),W]);for(let n=0;n<6;n++){let out=[],a=poly.at(-1);for(let b of poly){const plane=p=>n%2?S(p[3],p[n>>1]):A(p[3],p[n>>1]);let da=plane(a),db=plane(b);if(da<0&&db>0||da>0&&db<0)out.push(a.map((v,k)=>D(S(M(v,db),M(b[k],da)),S(db,da))));if(db>=0)out.push(b);a=b;}poly=out;}return poly.map(p=>[M(A(D(p[0],p[3]),1),16),M(S(1,D(p[1],p[3])),16)]);}
function edge(a,b,p){return S(M(S(b[0],a[0]),S(p[1],a[1])),M(S(b[1],a[1]),S(p[0],a[0])));}
const owns=(poly,p)=>{if(poly.length<3)return false;let area=0;for(let i=0;i<poly.length;i++)area+=edge([0,0],poly[i],poly[(i+1)%poly.length]);if(area<0)poly=poly.slice().reverse();return poly.every((a,i)=>{let b=poly[(i+1)%poly.length],e=edge(a,b,p);return e>0||e===0&&(b[1]<a[1]||b[1]===a[1]&&b[0]>a[0]);});};


  const reports=[];
  for(const t of eyePlan()){
    const polygon=clip(t.h);let difference=0,visible=0;
    for(let y=0;y<32;y++)for(let x=0;x<32;x++){
      const expected=!!eyeOracle(t,x,y);visible+=expected;
      if(owns(polygon,[x,y])!==expected)difference++;
      const reversed={...t,h:t.h.slice().reverse()};
      assert.deepEqual(eyeOracle(reversed,x,y),eyeOracle(t,x,y),'winding invariant exact oracle');
    }
    reports.push({name:t.name,visible,roundedDifferences:difference});
  }
  assert(reports.some(r=>r.roundedDifferences),'rounded clipping counterexample required');
  for(const name of ['zero W origin degenerate','all negative W','collinear XYW'])assert.equal(reports.find(r=>r.name===name).visible,0);
  transport(p=>{assert.match(p.p,/solid_halfspace\(ea\*direction,point\)/);assert(!p.p.includes('solid_screen(solid_polygon'));
    assert.match(p.v,/solid_polygon\[i\].w>0\./);assert.match(p.p,/if\(determinant==0\.\)discard/);});
  return reports;
}
async function renderedEyeCases(options){
  const oracle=Function('return ('+options.oracle+')')(),plan=options.plan;
  const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;document.body.append(canvas);
  const d=new D3D9Backend.Device(canvas,{webglVersion:options.version,solidCoverageTransport:true});
  const g=d.gpu,gl=g.gl,depth={id:907,width:32,height:32,format:75};
  const evidence=globalThis.legacyEyeEvidence={version:g.version,reports:[],comparisons:0,programs:[],submissions:[]};
  const create=g.createProgram.bind(g),submit=g.draw.bind(g);
  g.createProgram=(v,p,...args)=>{evidence.programs.push({vertex:v,fragment:p});
    if(options.control==='rounded')p=p.replace(/if\(!positiveW\)\{[\s\S]*?\n \}/,`if(!positiveW){
     solid_clip(a,b,c);covered=solid_count>=3;vec2 previous=vec2(0.);
     for(int i=0;i<12;i++){if(i==solid_count-1)previous=solid_screen(solid_polygon[i]);}
     for(int i=0;i<12;i++){if(i<solid_count){vec2 current=solid_screen(solid_polygon[i]);if(!solid_owns(previous,current,point,-determinant))covered=false;previous=current;}}
    }`);
    return create(v,p,...args);};
  g.draw=c=>{evidence.submissions.push(c.count);return submit(c);};
  const identity=Float32Array.from([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
  const attributes=[{register:0,usage:0,usageIndex:0,type:3,offset:0},{register:1,usage:10,usageIndex:0,type:3,offset:16},{register:2,usage:5,usageIndex:0,type:1,offset:32}];
  const fixedFunction={lighting:false,specular:false,fog:false,world:identity,view:identity,projection:identity,stages:[{colorOp:1}]};
  const issue=(list,state={},texture=null)=>{
    const input=Float32Array.from(list.flatMap(t=>t.h.flatMap(([X,Y,W,Z],i)=>[(X-16*W)/16,(16*W-Y)/16,Z,W,...(t.colors?.[i]||t.color||[1,0,0,.5]),...(t.uv?.[i]||[0,0])])));
    d.draw({primitive:4,primitiveCount:list.length,stride:40,vertices:new Uint8Array(input.buffer),attributes,depthAttachment:depth,
      state:{cull:1,zenable:false,...state},fixedFunction:texture?{...fixedFunction,stages:[{colorOp:2,colorArg1:2,alphaOp:2,alphaArg1:2,texCoordIndex:0,transformFlags:0},{colorOp:1}]}:fixedFunction,textures:texture?[texture]:[]});
  };
  const clear=()=>d.clear([0,0,0,1],7,1,null,depth,0);
  const compare=(label,reference)=>{
    if(options.preflightOnly){evidence.reports.push(label);return;}
    const bytes=g.readPixels(0,0,32,32,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4096));
    for(let y=0;y<32;y++)for(let x=0;x<32;x++){
      const expected=reference(x,y),offset=((31-y)*32+x)*4,actual=Array.from(bytes.slice(offset,offset+3));
      if(!actual.every((n,i)=>Math.abs(n-expected[i])<=2)){evidence.failure={label,x,y,actual,expected};evidence.failedRGBA=Array.from(bytes);throw Error(label+' pixel '+x+','+y+' actual '+actual+' expected '+expected);}
      evidence.comparisons++;
    }
    if(g.getError()!==gl.NO_ERROR)throw Error(label+' GL error');evidence.reports.push(label);
  };
  const reference=(list,blend=false,depthTest=false)=>(x,y)=>{let color=[0,0,0],z=1;
    for(const t of list){const s=oracle(t,x,y);if(!s||depthTest&&s.z>z)continue;if(depthTest)z=s.z;
      color=s.color.slice(0,3).map((n,c)=>Math.round(n*255*(blend?s.color[3]:1)+(blend?color[c]*(1-s.color[3]):0)));}return color;};
  try{
    for(const t of plan)for(const reverse of [false,true]){
      const v=reverse?{...t,h:t.h.slice().reverse()}:t;clear();issue([v]);compare(t.name+'/'+reverse,reference([v]));
    }
    const list=Array.from({length:19},(_,i)=>({...plan[i%plan.length],color:[i%3===0?1:.1,i%3===1?1:.2,i%3===2?1:.3,.25]}));
    for(const reversed of [false,true])for(const mode of ['opaque','alpha','depth','smooth']){
      let l=reversed?list.slice().reverse():list;
      if(mode==='smooth')l=l.map(t=>({...t,colors:[[.125,.25,.75,1],[.75,.125,.25,1],[.25,.75,.125,1]]}));
      clear();issue(l,{blend:mode==='alpha',srcblend:5,dstblend:6,zenable:mode==='depth',zwrite:true});
      compare(mode+' order '+reversed,reference(l,mode==='alpha',mode==='depth'));
    }
    const t=plan[1];
    for(const reverse of [false,true]){
      const v=reverse?{...t,h:t.h.slice().reverse()}:t;
      clear();issue([v],{colorWriteMask:0,stencilEnable:true,stencilPass:7});
      issue([{...v,color:[0,1,0,1]}],{stencilEnable:true,stencilFunc:3,stencilRef:1,stencilWriteMask:0});
      compare('stencil exact once '+reverse,(x,y)=>oracle(v,x,y)?[0,255,0]:[0,0,0]);
    }
    for(const cull of [2,3]){
      clear();issue([{...t,color:[1,0,0,1]},{...t,h:t.h.slice().reverse(),color:[0,1,0,1]}],{cull});
      // This fixture's window determinant is positive. D3D screen CW is
      // culled by mode 2, leaving the reversed green primitive.
      compare('eye cull '+cull,(x,y)=>oracle(t,x,y)?(cull===2?[0,255,0]:[255,0,0]):[0,0,0]);
    }
    clear();issue([{...t,h:t.h.slice().reverse()}],{colorWriteMask:0,stencilEnable:true,twoSidedStencil:true,stencilPass:1,ccwStencilPass:7});
    issue([{...t,color:[0,0,1,1]}],{stencilEnable:true,stencilFunc:3,stencilRef:1,stencilWriteMask:0});
    compare('eye two sided stencil',(x,y)=>oracle(t,x,y)?[0,0,255]:[0,0,0]);
    // Eye-crossing geometry has the same N/Q field as the unchanged public
    // right-triangle oracle with q=[1,1,3]. Its original third UV is 3*n.
    const mipOracle=Function('return ('+options.mipOracle+')')(),colors=options.mipColors;
    for(const mip of [2,3])for(const n of [2,8]){
      const levels=colors.map((c,l)=>{const width=16>>l,pixels=new Uint8Array(width*width*4);for(let i=0;i<width*width;i++)pixels.set([...c,255],i*4);return {width,height:width,pixels};});
      // Public D3DTEXTUREFILTER uses NONE/POINT/LINEAR=1/2/3; the
      // backend snapshot uses 0/1/2. Match the public bridge's mip atlas
      // route so the solid shader differentiates the original N/Q field.
      const texture={...levels[0],levels,clampMipChain:true,sampler:{min:1,mag:1,mip:mip-1}};
      const t={h:[[0,0,1,0],[32,0,1,0],[0,32,-1,0]],uv:[[0,0],[n,0],[0,3*n]]};
      clear();issue([t],{},texture);
      compare('eye rational mip '+mip+'/'+n,(x,y)=>oracle(t,x,y)?mipOracle(colors,{n,mip,q:[1,1,3]},{x,y}):[0,0,0]);
    }
    evidence.finalRGBA=Array.from(g.readPixels(0,0,32,32,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4096)));
    globalThis.legacyEyeCapture=canvas.toDataURL();
    return evidence;
  }finally{d.destroy();canvas.remove();}
}
// Execute every exact fixture draw through the real fixed compiler before a
// bounded browser run. This checks the previously missed textured branch; it
// deliberately makes no GPU/pixel claim.
async function eyePreflight(){
  const vm=require('node:vm'),{oracle,plan}=require('./test-legacy-public-mip-webgl');
  let draws=0,textured=0;const filters=[];
  class FixtureDevice{
    constructor(){
      const constants=new Map(),gl=new Proxy({colorMask(){},getExtension(){return {};},getParameter(){return 1024;}},
        {get(t,n){if(n in t)return t[n];if(!constants.has(n))constants.set(n,constants.size+1);return constants.get(n);}});
      this.gpu=new Proxy({version:1,gl,canvas:{width:32,height:32},renderHeight:32,
        createProgram(v,p){if(p.includes('d3d_lod0'))assert.match(p,/dFdx\(uv\*solid_q\)-uv\*dFdx\(solid_q\)/);return {};},
        createTexture(){return {};},getError(){return gl.NO_ERROR;},readPixels(x,y,w,h,f,t,out){return out;}},
        {get(t,n){return n in t?t[n]:()=>{};}});
      this.device=Object.create(Device.prototype);
      Object.assign(this.device,{gpu:this.gpu,solidCoverageTransport:true,vertices:{},indices:{},
        fixedPlans:new Fixed.TLCache(),programs:new Map(),bindDepth(){},touchColor(){}});
      for(const n of ['textures','textureTargets','resourceSamples','residentPixels','keyedTextures','keyMembers','stageKeys'])this.device[n]=new Map();
    }
    clear(){}destroy(){}
    draw(snapshot){
      const compiled=Fixed.compile(snapshot,{x:0,y:0,width:32,height:32,minZ:0,maxZ:1});
      assert(compiled.vertex.source.includes('gl_Position'));
      assert(compiled.pixel.source.includes('gl_FragColor'));
      this.device.draw(snapshot);
      draws++;if(snapshot.textures.length){
        assert.equal(snapshot.textures[0].clampMipChain,true,'eye fixture must use the public mip atlas route');
        const filter=this.device.mipUniforms.get(0).d3d_filter0[2];
        assert.equal(filter,textured<2?1:2,'public POINT/LINEAR must map to snapshot 1/2');
        filters.push(filter);textured++;
      }
    }
  }
  const context={Float32Array,Uint8Array,D3D9Backend:{Device:FixtureDevice},document:{createElement(){return {remove(){},toDataURL(){return '';}};},body:{append(){}}}};
  const run=vm.runInNewContext('('+renderedEyeCases.toString()+')',context);
  const options={version:1,preflightOnly:true,oracle:eyeOracle.toString(),plan:eyePlan(),mipOracle:oracle.toString(),mipColors:plan().colors};
  const result=await run(options);assert.equal(textured,4);assert.equal(result.reports.length,37);
  const successfulDraws=draws;
  const missing=vm.runInNewContext('('+renderedEyeCases.toString().replace('texCoordIndex:0,transformFlags:0','')+')',context);
  await assert.rejects(missing(options),/invalid texture coordinate index/,'historical fixture omission must reject before browser');
  textured=0;
  const wrongMip=vm.runInNewContext('('+renderedEyeCases.toString().replace('mip:mip-1','mip')+')',context);
  await assert.rejects(wrongMip(options),/public POINT\/LINEAR must map/,'public enum must not reach the snapshot unchanged');
  textured=0;
  const nativeMip=vm.runInNewContext('('+renderedEyeCases.toString().replace('clampMipChain:true','clampMipChain:false')+')',context);
  await assert.rejects(nativeMip(options),/public mip atlas route/,'implicit native gradients must not replace the public rational-gradient route');
  return {draws:successfulDraws,textured:4,filters:filters.slice(0,4),grids:result.reports.length,missingTexCoordRejected:true,wrongMipRejected:true,nativeMipRejected:true};
}
function eyeRenderedEvidence(file){
  const fs=require('node:fs'),hash=b=>require('node:crypto').createHash('sha256').update(b).digest('hex');
  const e=JSON.parse(fs.readFileSync(file));
  assert.match(e.status,/^PASS rendered candidate/);assert(!e.error&&!e.timeout);
  for(const p of ['lib/d3d9-backend.js','test/test-legacy-solid-coverage-transport.js'])
    assert.equal(e.source.files[p].sha256,hash(fs.readFileSync(require('node:path').join(__dirname,'..',p))));
  for(const version of [1,2]){
    const cells=e.stages.filter(s=>s.eye?.version===version);assert.equal(cells.length,1);
    assert.equal(cells[0].eye.reports.length,37);assert.equal(cells[0].eye.comparisons,37*1024);
    const negatives=e.stages.filter(s=>s.negative?.version===version&&s.negative.control==='rounded');assert.equal(negatives.length,1);
    assert.match(negatives[0].negative.error,/pixel .*actual .*expected/);
  }
  let observations=0;
  for(const module of ['wine-assembly.wasm','wine-assembly.compat.wasm'])for(const mode of ['worker','webgl'])for(const version of [1,2]){
    const cells=e.stages.filter(s=>s.module===module&&s.mode===mode&&s.version===version);assert.equal(cells.length,1);
    const r=cells[0].result;assert.equal(r.status,'PASS');assert.equal(r.observations.length,mode==='worker'?18:12);
    assert.equal(r.stats.errors,0);assert.equal(r.stats.fallbacks,0);
    for(const o of r.observations)assert(o.actual.every((c,i)=>Math.abs(c-o.expected[i])<=2));
    observations+=r.observations.length;
  }
  return {eyePixels:2*37*1024,publicObservations:observations};
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
function batchRenderedEvidence(file){
  const summary=renderedEvidence(file),fs=require('node:fs'),crypto=require('node:crypto');
  const e=JSON.parse(fs.readFileSync(file)),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
  assert.equal(e.source.files['test/test-legacy-solid-coverage-transport.js'].sha256,hash(fs.readFileSync(__filename)),
    'batch oracle must match the executed fixture');
  for(const version of [1,2]){
    for(const limit of [null,22]){
      const cells=e.stages.filter(s=>s.batches?.version===version&&s.batches.limit===limit);
      assert.equal(cells.length,1,'missing real batch pixel cell');
      const r=cells[0].batches;
      assert.equal(r.reports.length,13);assert.equal(r.comparisons,13*529);
      assert(r.submissions.includes((limit?3:8)*6),'real multi-primitive submission required');
      assert(r.submissions.includes(6),'final bank and single-draw transition required');
      assert(r.programs.every(p=>p.vertex.includes('solid_batch=solid_corner.z;')));
    }
    for(const control of ['selector','order']){
      const cells=e.stages.filter(s=>s.negative?.version===version&&s.negative.control===control);
      assert.equal(cells.length,1);assert.match(cells[0].negative.error,/pixel .*actual .*expected/);
    }
  }
  return {...summary,batchCells:4,batchComparisons:4*13*529,pixelControls:4};
}
if(require.main===module){
  if(!backendArg)console.log('PASS solid candidate actual Device.draw transport '+JSON.stringify(transport()));
  if(!backendArg)eyePreflight().then(r=>console.log('PASS exact eye fixture preflight '+JSON.stringify(r))).catch(e=>{console.error(e);process.exitCode=1;});
  if(!backendArg)console.log('PASS eye focused '+JSON.stringify(eyeFocused()));
  if(!backendArg)console.log('PASS offline original-edge clipping reproducer '+JSON.stringify(clippedOriginalEdges()));
  console.log('PASS actual Device batching '+JSON.stringify(batching()));
  const file=process.argv.find(a=>a.startsWith('--render-evidence='));
  if(file)console.log('PASS retained real WebGL evidence '+JSON.stringify(renderedEvidence(file.slice(18))));
  const batchFile=process.argv.find(a=>a.startsWith('--batch-render-evidence='));
  if(batchFile)console.log('PASS retained real batch WebGL evidence '+JSON.stringify(batchRenderedEvidence(batchFile.slice(24))));
}
module.exports={eyeRenderedEvidence,eyePreflight,eyeOracle,eyePlan,eyeFocused,renderedEyeCases,snapshot,transport,batching,clippedOriginalEdges,renderedCases,renderedBatches,renderedEvidence,batchRenderedEvidence};
