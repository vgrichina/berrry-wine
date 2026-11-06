#!/usr/bin/env node
'use strict';

// Prebuilt, unmodified production modules; all resource/state/draw operations
// reuse the public x86 COM harness. --plan cannot qualify rendered coverage.
// Runtime requires LEGACY_PUBLIC_MIP_{EVIDENCE,MODULE_DIR,SOURCE,MODULE_MANIFEST};
// the manifest is {source: GitSHA, modules: [{name, sha256, bytes}, ...]}.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const crypto=require('node:crypto'),vm=require('node:vm');
const {browserFixture}=require('./test-legacy-texture-rendered-contract');
const {versionControls}=require('./test-legacy-mirror-gpu-worker-contract');
const ROOT=path.resolve(__dirname,'..');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');

// Independent analytic perspective interpolation on a 32-pixel right triangle.
// Differentiate U/Q and V/Q; choose mip levels from the largest texture-space
// footprint. Spatial levels additionally use the normalized texel-center rule.
function oracle(colors,state,sample) {
  const {x,y}=sample,q=state.q||[1,1,1],n=state.n;
  const Q=q[0]+(q[1]-q[0])*x/32+(q[2]-q[0])*y/32;
  const offset=state.offset||[0,0];
  const U=n*q[1]*x/32,V=n*q[2]*y/32;
  const Qx=(q[1]-q[0])/32,Qy=(q[2]-q[0])/32;
  const ux=(n*q[1]/32*Q-U*Qx)/(Q*Q),uy=-U*Qy/(Q*Q);
  const vx=-V*Qx/(Q*Q),vy=(n*q[2]/32*Q-V*Qy)/(Q*Q);
  const rho=16*Math.sqrt(Math.max(ux*ux+vx*vx,uy*uy+vy*vy));
  const lod=Math.max(0,Math.min(4,Math.log2(rho)));
  if(state.spatial){
    const u=offset[0]+U/Q,v=offset[1]+V/Q;
    const filter=rho<=1?state.mag:state.min;
    const at=level=>{
      const grid=colors[level],d=grid.length;
      const tap=(a,b)=>grid[((b%d)+d)%d][((a%d)+d)%d];
      if(filter===1)return tap(Math.floor(u*d),Math.floor(v*d)).slice();
      const sx=u*d-.5,sy=v*d-.5,ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy;
      const a=tap(ix,iy),b=tap(ix+1,iy),c=tap(ix,iy+1),e=tap(ix+1,iy+1);
      return a.map((z,i)=>(z*(1-fx)+b[i]*fx)*(1-fy)+(c[i]*(1-fx)+e[i]*fx)*fy);
    };
    if(state.mip===1)return at(0);
    if(state.mip===2)return at(Math.floor(lod+.5));
    const lo=Math.floor(lod),hi=Math.min(4,lo+1),w=lod-lo,a=at(lo),b=at(hi);
    return a.map((z,i)=>z*(1-w)+b[i]*w);
  }
  if(state.mip===1)return colors[0].slice();
  if(state.mip===2)return colors[Math.floor(lod+.5)].slice();
  const lo=Math.floor(lod),hi=Math.min(4,lo+1),w=lod-lo;
  return colors[lo].map((c,i)=>c*(1-w)+colors[hi][i]*w);
}

function plan() {
  const colors=[[255,0,0],[0,255,0],[0,0,255],[255,255,0],[0,255,255]];
  const point={x:4,y:4};
  const states=[
    {label:'NONE minification',n:32,mip:1},
    {label:'POINT after NONE',n:8,mip:2},
    {label:'LINEAR after POINT',n:2*Math.sqrt(8),mip:3},
    {label:'POINT restored',n:8,mip:2},
    ...[.5,2,4,16,32,65536].map(n=>({label:'POINT footprint '+n/2,n,mip:2})),
    {label:'trilinear',n:2*Math.sqrt(8),mip:3,filter:2},
    {label:'perspective',n:16,mip:2,q:[1,.25,.25],
      samples:[1,8,14,20,27].map(x=>({x,y:1}))},
    {label:'NONE restored',n:32,mip:1},
  ].map(s=>({filter:1,samples:[point],...s}));
  const update={level:2,color:[192,48,224],state:{label:'child mip update',n:8,mip:2,filter:1,samples:[point]}};
  const p={colors,states,update,tolerance:2};
  const changed=colors.map(c=>c.slice());changed[update.level]=update.color;
  assert.deepEqual(oracle(changed,update.state,point),update.color);
  assert(oracle(colors,update.state,point).some((c,i)=>Math.abs(c-update.color[i])>p.tolerance),
    'stale child upload discriminates at unchanged tolerance');
  assert.deepEqual(oracle(colors,states[0],point),colors[0]);
  assert.deepEqual(oracle(colors,states[1],point),colors[2]);
  const blend=oracle(colors,states[2],point);
  for(const [i,c] of [0,127.5,127.5].entries())assert(Math.abs(blend[i]-c)<1e-10);
  assert.deepEqual(oracle(colors,states[3],point),colors[2]);
  const perspective=states.find(s=>s.q).samples.map(s=>oracle(colors,states.find(s=>s.q),s));
  assert(new Set(perspective.map(JSON.stringify)).size>=3,'perspective must select distinct levels');
  for(const negative of ['level-zero-only','stale-mip-filter']) {
    let mismatches=0;
    for(const state of states){const broken={...state,mip:negative==='level-zero-only'?1:state.mip===3?2:state.mip};
      for(const sample of state.samples)if(oracle(colors,state,sample).some((c,i)=>Math.abs(c-oracle(colors,broken,sample)[i])>2))mismatches++;}
    assert(mismatches>0,negative+' is discriminating at unchanged tolerance');
  }
  return p;
}

function spatialPlan(){
  // Authored independently of production decoding: asymmetric checker/ramp
  // channels vary in both axes and also distinguish every mip level.
  const colors=Array.from({length:5},(_,level)=>Array.from({length:16>>level},(_,y)=>
    Array.from({length:16>>level},(_,x)=>[24+level*23+(x%2)*112,
      20+level*17+(y%2)*120,28+level*19+((x+y)%2)*96])));
  const states=[
    {label:'spatial MAG POINT',n:.5,min:1,mag:1},
    {label:'spatial MAG LINEAR',n:.5,min:1,mag:2},
    {label:'spatial MAG POINT restored',n:.5,min:2,mag:1},
    {label:'spatial MIN POINT',n:4,min:1,mag:2},
    {label:'spatial MIN LINEAR',n:4,min:2,mag:1},
    {label:'spatial MIN POINT restored',n:4,min:1,mag:2},
    {label:'spatial fractional POINT mip bilinear',n:2*Math.sqrt(8),min:2,mag:1},
    {label:'spatial fractional trilinear',n:2*Math.sqrt(8),min:2,mag:1,mip:3},
    {label:'spatial fractional trilinear point taps',n:2*Math.sqrt(8),min:1,mag:2,mip:3},
    {label:'spatial perspective trilinear',n:4,min:2,mag:1,mip:3,q:[1,.5,.75],
      samples:[2,5,8].map(x=>({x,y:2}))},
    // Opposite gradients reject a constant UV adjustment masquerading as a
    // sample-location repair. Keep the same integer centre and authored grid.
    {label:'spatial reversed MIN LINEAR',n:-4,min:2,mag:1,offset:[.815,.867]},
    // A small, changing reciprocal W makes reuse of the displaced denominator
    // distinguishable from reconstructing both affine planes before division.
    {label:'spatial steep perspective trilinear',n:4,min:2,mag:1,mip:3,
      q:[1,.001,.01],samples:[{x:30,y:1}]},
  ].map(s=>({spatial:true,mip:2,offset:[.137,.193],samples:[{x:2,y:3}],...s}));
  const tolerance=2;
  for(const [a,b] of [[0,1],[3,4],[6,7],[7,8]]){
    const x=oracle(colors,states[a],states[a].samples[0]),y=oracle(colors,states[b],states[b].samples[0]);
    assert(x.some((c,i)=>Math.abs(c-y[i])>2*tolerance),'spatial pair discriminates '+a+'/'+b);
  }
  // Hand-calculated normalized coordinates and point / bilinear answers.
  assert.deepEqual(oracle(colors,states[0],states[0].samples[0]),[24,140,124]);
  assert.deepEqual(oracle(colors,states[3],states[3].samples[0]),[159,37,143]);
  for(const [index,expected] of [[1,[45.504,99.44,85.580032]],
    [4,[113.752,42.28,103.404992]],
    [7,[120.84812152132,111.900779386421,103.339059274967]],
    [10,[49.24,104.68,100.89824]],
    [11,[103.22077804435263,113.92472681378077,97.21580498154373]]]){
    const actual=oracle(colors,states[index],states[index].samples[0]);
    for(const [i,c] of expected.entries())assert(Math.abs(actual[i]-c)<1e-8,'analytic reference '+index);
  }
  for(const state of states)for(const sample of state.samples){
    const q=state.q||[1,1,1],Q=q[0]+(q[1]-q[0])*sample.x/32+(q[2]-q[0])*sample.y/32;
    const uv=[state.offset[0]+state.n*q[1]*sample.x/32/Q,
      state.offset[1]+state.n*q[2]*sample.y/32/Q];
    assert(uv.every(v=>v>.125&&v<.875),'interior UV away from wrap edges');
    assert(uv.every(v=>Math.abs(v*16-Math.round(v*16))>.01),'noninteger base texel coordinates');
  }
  return {colors,states,tolerance,spatial:true,queuedPairs:[[0,1],[3,4],[4,5]],update:null};
}

function fixtureSource() {
  // Immediate-mode injection switches targets through mutable bindings. This
  // older adapter's strict seams and descendants use fixed targets instead.
  let source=browserFixture.toString()
    .replace('let rt=await surface(8,8,0x2840);','const rt=await surface(8,8,0x2840);')
    .replace('let device=await acquire','const device=await acquire')
    .replace('const held=[],heldPackets=[];', 'const held=[];const heldPackets=[];');
  const replace=(a,b)=>{assert.equal(source.split(a).length,2,'unique public mip seam: '+a.slice(0,60));source=source.replace(a,b);};
  const block=(a,b,replacement)=>{const start=source.indexOf(a),end=source.indexOf(b,start);assert(start>=0&&end>start);replace(source.slice(start,end),replacement);};
  replace('port=manager.createEndpoint(options);','port=manager.createEndpoint({...options,webglVersion:config.webglVersion});');
  replace("new D3DIMGpu.D3DIMGpu({getExports", "new D3DIMGpu.D3DIMGpu({webglVersion:config.webglVersion,getExports");
  replace('const surface=async(width,height,caps)=>{','const surface=async(width,height,caps,count=0)=>{');
  replace('[4,0x1007],[8,height],[12,width]', '[4,0x1007|(count?0x20000:0)],[24,count],[8,height],[12,width]');
  replace('const texture=await surface(2,2,0x1800);',`const texture=await surface(16,16,0x401008,5);
    const levels=[texture];
    const mipCaps=await guard(16);await words(mipCaps.p,[0x401000,0,0,0]);
    for(let i=1;i<5;i++){
      levels.push(await acquire(out=>com('GetAttachedSurface7 mip '+i,levels[i-1],12,mipCaps.p,out)));
      await mipCaps.check();
    }
    evidence.levels=levels;`);
  replace('const rt=await surface(8,8,0x2840);','const rt=await surface(32,32,0x2840);');
  replace("    const texLock=await lock(texture);\n    for(let i=0;i<4;i++){const [r,g,b]=config.texture[i];await write(texLock.pointer+(i>>>1)*texLock.pitch+(i%2)*4,0xff000000|(r<<16)|(g<<8)|b);}\n    await unlock(texture);evidence.textureLock=texLock;",`    evidence.levelLocks=[];
    for(const [level,obj] of levels.entries()){
      const l=await lock(obj),dimension=16>>level;
      eq(await read(lockDesc.p+8),dimension,'public mip height');
      eq(await read(lockDesc.p+12),dimension,'public mip width');
      eq(l.pitch,dimension*4,'public mip exact pitch');
      for(let y=0;y<dimension;y++)for(let x=0;x<dimension;x++){
        const [r,g,b]=config.spatial?config.colors[level][y][x]:config.colors[level];
        await write(l.pointer+y*l.pitch+x*4,0xff000000|(r<<16)|(g<<8)|b);
      }
      await unlock(obj);evidence.levelLocks.push({level,dimension,...l});
    }`);
  replace('[0,0,8,8,0,0x3f800000]','[0,0,32,32,0,0x3f800000]');
  replace("    const vertices=await alloc(96)",`    eq(await read(caps.p+96),0x030303ff,'exact advertised triangle mip filter mask');
    eq(await read(caps.p+40),0x030003c3,'line filter caps unchanged');
    if(config.bootstrap){evidence.status='BOOTSTRAP PASS; no draws';return evidence;}
    const vertices=await alloc(96)`);
  block('    const geometry=async uv=>{','    const describe=async()=>{',`    const geometry=async state=>{
      for(const [i,[x,y]] of [[0,0],[32,0],[0,32]].entries())
        await words(vertices+i*32,[bits(x),bits(y),bits(.5),bits((state.q||[1,1,1])[i]),
          0xffffffff,0,bits((state.offset||[0,0])[0]+(i===1?state.n:0)),
          bits((state.offset||[0,0])[1]+(i===2?state.n:0))]);
    };
    let previousMip=1;
    const setState=async state=>{
      const mip=negative==='level-zero-only'?1:
        negative==='stale-mip-filter'&&state.mip===3?previousMip:state.mip;
      const min=negative==='nearest-only'?1:(state.min||state.filter),
        mag=negative==='nearest-only'?1:(state.mag||state.filter);
      for(const [id,v] of [[16,mag],[17,min],[18,mip],[13,1],[14,1]]){
        await tss(id,v);const out=await guard(4);
        await ok(com('GetTextureStageState7',device,36,0,id,out.p));await out.check();
        eq(await read(out.p),v,'public sampler readback '+id);
      }
      previousMip=mip;
    };
`);
  replace('preview.width=preview.height=8','preview.width=preview.height=32');
  replace('p=l.pointer+2*l.pitch+2*4','p=l.pointer+sample.y*l.pitch+sample.x*4');
  replace('for(let y=0;y<8;y++)for(let x=0;x<8;x++)','for(let y=0;y<32;y++)for(let x=0;x<32;x++)');
  replace("if(preview)preview.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(dibRGBA),8,8)","if(preview)preview.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(dibRGBA),32,32)");
  replace("const expectedAddress=state.address===4?(mode==='software'?1:3):state.address;\n      const expected=expectedColor(state.palette||config.texture,sample.uv,state.filter,expectedAddress);",'const expectedAddress=[1,1];\n      const expected=expectedColor(config.colors,state,sample);');
  replace('gl.readPixels(2,8-1-2,1,1','gl.readPixels(sample.x,32-1-sample.y,1,1');
  replace("      eq(actual,expected,'PIXEL ORACLE '+label);\n      if(gpu)eq(state.rgbOnly?row.webglRGBA.slice(0,3):row.webglRGBA,\n        state.rgbOnly?expected:[...expected,255],'independent actual WebGL pixels');",`      const close=(got,want,label)=>check(got.length===want.length&&got.every((c,i)=>Math.abs(c-want[i])<=config.tolerance),
        'PIXEL ORACLE '+label+': '+JSON.stringify(got)+' expected '+JSON.stringify(want));
      if(mode==='worker'){
        await until(()=>lastStats?.stats.drawCalls===drawCount,'observed worker stats');
        row.workerStats=lastStats.stats;
        eq(row.workerStats.requestedBackend,'webgl','worker backend');
        eq(row.workerStats.renderApi,'legacy','worker API');
        eq(row.workerStats.fallbacks,0,'worker no fallback');eq(row.workerStats.errors,0,'worker no errors');
        eq(row.workerStats.d3dimSoftwareDrawCallsCompleted,0,'no native software pixels');
        eq(row.workerStats.d3dimFallbackSoftwareDrawCallsCompleted,0,'no fallback software pixels');
        check(row.workerStats.renderEndpointId&&row.workerStats.glRenderer,'actual worker identity');
      }
      if(mode!=='software'){
        const version=gpu?evidence.glRenderer.version:row.workerStats.glVersion;
        check(version.startsWith('WebGL '+config.webglVersion+'.0'),'actual context VERSION '+version);
      }
      close(actual,expected,label);
      if(gpu){close(row.webglRGBA.slice(0,3),expected,'actual GL '+label);eq(row.webglRGBA[3],255,'GL opaque alpha');}`);
  block('    if(!config.stateblocks&&!config.immediate)for(const state of config.states){','    evidence.drawCount=drawCount;',`    for(const state of config.states){await setState(state);await geometry(state);await draw();
      for(const sample of state.samples)await observe(state.label+'/'+sample.x+','+sample.y,sample,state);
    }
    if(mode==='worker'){
      for(const [a,b] of config.queuedPairs||[[0,1],[1,2],[2,3]]){
        const old=config.states[a],next=config.states[b];
        await geometry(old);await setState(old);
        heldRecord={old,next,messages:[]};evidence.queued.push(heldRecord);holding=true;
        await draw();await until(()=>held.length>0,'held production batch');
        if(config.captureHeldPackets){
          check(heldPackets.length>0,'held production packet retained');
          const packet=heldPackets.at(-1),buffer=queueBuffers[packet.index],view=new DataView(buffer);
          eq(packet.commands,1,'one draw in held production packet');
          eq(view.getUint32(28,true),0,'real D3DIM draw record');
          eq(view.getUint32(20,true),4096,'production state snapshot size');
          heldRecord.sequence=packet.seq;heldRecord.index=packet.index;
          heldRecord.before=transportSnapshot();
          heldRecord.header=Array.from(new Uint32Array(buffer,0,8));
          heldRecord.state=Array.from(new Uint8Array(buffer,32,4096));
          check(heldRecord.before.completed<packet.seq,'packet not consumed before live change');
        }
        await setState(next);heldRecord.liveChangedBeforeDrain=true;
        if(config.captureHeldPackets){
          heldRecord.afterLiveChange=transportSnapshot();
          check(heldRecord.afterLiveChange.completed<heldRecord.sequence,'packet still held after live change');
          eq(Array.from(new Uint8Array(queueBuffers[heldRecord.index],32,4096)),heldRecord.state,
            'queued state immutable after public sampler changes');
          heldRecord.immutable=true;
        }
        holding=false;for(const send of held.splice(0))send();
        await observe('queued '+old.label,old.samples[0],old);
        if(config.captureHeldPackets){
          heldPackets.length=0;heldRecord.afterDrain=transportSnapshot();
          check(heldRecord.afterDrain.completed>=heldRecord.sequence,'held production packet actually consumed');
          eq(heldRecord.afterDrain.error,0,'production queue error');
        }
        await geometry(next);await draw();await observe('next '+next.label,next.samples[0],next);
      }
      await until(()=>lastStats?.stats.drawCalls===drawCount,'all production stats');evidence.stats=lastStats.stats;
    }else if(gpu)evidence.stats=gpu.snapshot();
`);
  replace('    evidence.drawCount=drawCount;',`    if(config.update){
    const update=config.update,state=update.state,sample=state.samples[0];
    await setState(state);await geometry(state);await draw();
    await observe('child before overwrite',sample,state);
    const obj=levels[update.level],dimension=16>>update.level,l=await lock(obj);
    eq(await read(lockDesc.p+8),dimension,'updated child height');
    eq(await read(lockDesc.p+12),dimension,'updated child width');
    eq(l.pitch,dimension*4,'updated child pitch');
    const [r,g,b]=update.color,pixel=(0xff000000|(r<<16)|(g<<8)|b)>>>0;
    for(let y=0;y<dimension;y++)for(let x=0;x<dimension;x++)await write(l.pointer+y*l.pitch+x*4,pixel);
    await unlock(obj);
    const verify=await lock(obj);
    eq(verify,l,'child backing and pitch retained');
    for(let y=0;y<dimension;y++)for(let x=0;x<dimension;x++)
      eq(await read(verify.pointer+y*verify.pitch+x*4),pixel,'public child overwrite persisted');
    await unlock(obj);
    evidence.update={object:obj,level:update.level,dimension,lock:l,color:update.color,persisted:true};
    config.colors=config.colors.map((c,i)=>i===update.level?update.color.slice():c.slice());
    await draw();await observe('child after overwrite',sample,state);
    if(mode==='worker'){
      await until(()=>lastStats?.stats.drawCalls===drawCount,'updated child GPU stats');evidence.stats=lastStats.stats;
    }else if(gpu)evidence.stats=gpu.snapshot();
    }
    evidence.drawCount=drawCount;`);
  replace("    for(const [name,obj] of Object.entries({device,texture,rt,padding,d3d,dd}))",`    for(const obj of levels.slice(1))await com('Release acquired mip',obj,2);
    for(const [name,obj] of Object.entries({device,texture,rt,padding,d3d,dd}))`);
  return source;
}

// Additional batch regression; the original fixture/oracle/geometry above
// remain the default qualification. A second triangle starts at x=16 with
// a different UV plane, so left and right samples reject stale plane uniforms.
function batchedFixtureSource(){
  let source=fixtureSource();
  const replace=(a,b)=>{assert.equal(source.split(a).length,2,'unique batch seam');source=source.replace(a,b);};
  replace('const vertices=await alloc(96)','const vertices=await alloc(192)');
  const start=source.indexOf('    const geometry=async state=>{'),end=source.indexOf('    let previousMip=1;',start);
  assert(start>=0&&end>start);
  source=source.slice(0,start)+`    const geometry=async state=>{
      for(let triangle=0;triangle<2;triangle++)for(const [i,[x,y]] of [[0,0],[32,0],[0,32]].entries()){
        const s=triangle?{n:-4,q:[1,1,1],offset:[.815,.867]}:state;
        await words(vertices+(triangle*3+i)*32,[bits(x+triangle*16),bits(y),bits(.5),bits((s.q||[1,1,1])[i]),
          0xffffffff,0,bits((s.offset||[0,0])[0]+(i===1?s.n:0)),bits((s.offset||[0,0])[1]+(i===2?s.n:0))]);
      }
    };
`+source.slice(end);
  replace("await ok(com('DrawPrimitive7',device,25,4,0x1c4,vertices,3,0));", "await ok(com('DrawPrimitive7',device,25,4,0x1c4,vertices,6,0));");
  return source;
}

function batchTopologyControls(){
  const {Device}=require('../lib/d3d9-backend'),Fixed=require('../lib/d3d9-fixed');
  const identity=()=>Float32Array.from([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
  const vertices=new Uint8Array(6*32),data=new DataView(vertices.buffer);
  for(let i=0;i<6;i++){
    [i*3,i%2?8:0,.5,1].forEach((v,c)=>data.setFloat32(i*32+c*4,v,true));
    data.setUint32(i*32+16,0xffffffff,true);data.setFloat32(i*32+24,i/8,true);data.setFloat32(i*32+28,i/9,true);
  }
  let cases=0;
  for(const [primitive,corners] of [[4,[[0,1,2],[3,4,5]]],[5,[[0,1,2],[2,1,3]]],[6,[[0,1,2],[0,2,3]]]])for(const indexed of [false,true]){
    const children=[],device=Object.create(Device.prototype);
    Object.assign(device,{gpu:{version:2,canvas:{width:32,height:32},renderHeight:32,gl:{},createProgram(){return {}; }},
      programs:new Map(),fixedPlans:new Fixed.TLCache(),bindDepth(){}});
    const indices=indexed?new Uint16Array([5,4,3,2,1,0]):undefined;
    const draw={primitive,primitiveCount:2,stride:32,vertices,indices,textures:[{width:16,height:16,clampMipChain:true,sampler:{min:2,mag:1,mip:2}}],
      attributes:[{register:0,usage:9,usageIndex:0,type:3,offset:0},{register:5,usage:10,usageIndex:0,type:4,offset:16},{register:7,usage:5,usageIndex:0,type:1,offset:24}],
      fixedFunction:{lighting:false,specular:false,fog:false,world:identity(),view:identity(),projection:identity(),textureFactor:0xffffffff,
        stages:[{colorOp:2,colorArg1:2,alphaOp:2,alphaArg1:2,transformFlags:0,texCoordIndex:0},{colorOp:1}]}};
    device.draw=d=>{if(d.primitiveCount===1)children.push(d);else Device.prototype.draw.call(device,d);};
    device.draw(draw);assert.equal(children.length,2);
    for(const [i,child] of children.entries()){
      assert.equal(child.primitive,4);assert.equal(child.indices,undefined);assert.equal(child.textures,draw.textures);
      const expected=Buffer.concat(corners[i].map(c=>Buffer.from(vertices.subarray((indices?indices[c]:c)*32,(indices?indices[c]:c)*32+32))));
      assert.deepEqual(Buffer.from(child.vertices),expected,'immutable triangle records and winding '+primitive+'/'+indexed+'/'+i);
    }
    children.length=0;
    assert.throws(()=>device.draw({...draw,vertices:vertices.subarray(0,32)}),/vertex input outside buffer/);
    assert.equal(children.length,0,'entire batch validated before first draw');cases++;
  }
  return cases;
}

function controls(){
  versionControls();plan();batchTopologyControls();const p=spatialPlan(),source=fixtureSource();
  new vm.Script('('+source+')');
  new vm.Script('('+batchedFixtureSource()+')');
  assert(!/mip_seed|mip_surface|mip_draw|fixedLOD/.test(source));
  for(const label of ['DirectDrawCreateEx','QI IDirect3D7','CreateSurface','CreateDevice7',
    'GetAttachedSurface7 mip','SetTextureStageState7','DrawPrimitive7','Lock Surface7'])assert(source.includes(label));
  for(const expression of ['const heldPackets=[]','Atomics.load(queueControl,1)',
    'queued state immutable after public sampler changes','packet still held after live change',
    'held production packet actually consumed'])assert(source.includes(expression),expression);
  const context=vm.createContext({D3DIMGpu:{D3DIMGpu:class{_textureLevel(t,d){return {key:d.generation};}}}});
  vm.runInContext('('+staleUploadControl.toString()+')()',context);
  assert.deepEqual(JSON.parse(vm.runInContext(`JSON.stringify((()=>{
    const gpu=new D3DIMGpu.D3DIMGpu(),child={texWidth:4,texHeight:4};
    return [gpu._textureLevel(null,{...child,generation:'old'}).key,
      gpu._textureLevel(null,{...child,generation:'new'}).key,
      gpu._textureLevel(null,{texWidth:8,texHeight:8,generation:'other'}).key];
  })())`,context)),['old','old','other']);
  return {status:'PLANNER ONLY; no pixels',observations:p.states.reduce((n,s)=>n+s.samples.length,0),...p};
}

function config(planName='spatial'){
  assert(['solid','spatial'].includes(planName));
  const pe=fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'));
  const selected=planName==='solid'?plan():spatialPlan();
  if(process.argv.includes('--batched'))selected.states=selected.states.map(s=>({...s,samples:[{x:2,y:3},{x:18,y:3,second:true}]}));
  return {...selected,captureHeldPackets:true,thunkBase:require('../lib/region-map.generated').BASE.THUNK_BASE,
    factoryId:require('../src/api_table.json').find(x=>x.name==='DirectDrawCreateEx').id,
    imageBase:pe.readUInt32LE(pe.readUInt32LE(0x3c)+52)};
}

// Fault injection only: freeze the first decoded 4x4 child generation while
// leaving public writes, other uploads, draws and real GL readback active.
// Served in both the page and render Worker; no production file/module changes.
function staleUploadControl(){
  const original=D3DIMGpu.D3DIMGpu.prototype._textureLevel;
  const frozen=new WeakMap();
  D3DIMGpu.D3DIMGpu.prototype._textureLevel=function(target,desc){
    if(desc.texWidth!==4||desc.texHeight!==4)return original.call(this,target,desc);
    if(!frozen.has(this))frozen.set(this,original.call(this,target,desc));
    return {...frozen.get(this)};
  };
}

async function createServer(getWasm,getNegative=()=>null,onInjection=()=>{},onServe=()=>{}){
  const scripts=['region-map.generated','gl-command-stream','d3d-command-stream','guest-rpc','guest-thread-host',
    'render-worker','gpu-backend','d3d9-shader','d3d-shader-ir','d3d9-fixed','d3d9-texture','render-clear','d3d9-backend','d3dim-gpu'];
  return require('./static-server').startStaticServer({root:ROOT,crossOriginIsolated:true,handleRequest(req,res){
    // The custom handler runs before static-server's ordinary header path.
    res.setHeader('Cross-Origin-Opener-Policy','same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(pathname==='/lib/d3dim-gpu.js'&&getNegative()==='stale-child-upload'){
      const body=fs.readFileSync(path.join(ROOT,'lib/d3dim-gpu.js'),'utf8')+'\n;('+staleUploadControl.toString()+')();';
      onInjection({url:req.url,sha256:sha(body),bytes:Buffer.byteLength(body)});
      onServe({url:req.url,sha256:sha(body),bytes:Buffer.byteLength(body),injected:true});
      res.writeHead(200,{'Content-Type':'application/javascript','Cache-Control':'no-store'});
      res.end(body);return true;
    }
    if(req.url==='/legacy-render.wasm'){
      const bytes=getWasm();onServe({url:req.url,sha256:sha(bytes),bytes:bytes.length});
      res.writeHead(200,{'Content-Type':'application/wasm'});res.end(bytes);return true;
    }
    if(/^\/lib\/[a-zA-Z0-9_.-]+\.(js|json)$/.test(pathname)){
      const bytes=fs.readFileSync(path.join(ROOT,pathname));
      onServe({url:req.url,sha256:sha(bytes),bytes:bytes.length});
      res.writeHead(200,{'Content-Type':pathname.endsWith('.json')?'application/json':'application/javascript'});
      res.end(bytes);return true;
    }
    if(req.url!=='/legacy-render-fixture')return false;
    res.writeHead(200,{'Content-Type':'text/html'});res.end(scripts.map(n=>'<script src="/lib/'+n+'.js"></script>').join('\n'));return true;
  }});
}

async function isolationControls(server,bytes){
    for(const route of ['/legacy-render-fixture','/legacy-render.wasm','/lib/guest-worker.js']){
      const response=await fetch('http://127.0.0.1:'+server.address().port+route);
      assert.equal(response.status,200);
      assert.equal(response.headers.get('cross-origin-opener-policy'),'same-origin',route);
      assert.equal(response.headers.get('cross-origin-embedder-policy'),'require-corp',route);
      if(route.endsWith('.wasm'))assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
      else await response.text();
    }
}

async function serverControls(){
  const injectedRows=[],bytes=Buffer.from([0,97,115,109,1,0,0,0]);
  let negative='stale-child-upload';
  const server=await createServer(()=>bytes,()=>negative,row=>injectedRows.push(row));
  try{
    await isolationControls(server,bytes);
    // RenderWorker imports the GPU script with its production version query.
    for(const route of ['/lib/d3dim-gpu.js','/lib/d3dim-gpu.js?v=legacy-texture-public-com']){
      const response=await fetch('http://127.0.0.1:'+server.address().port+route);
      assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
      const injected=await response.text();
      assert.equal(injected,fs.readFileSync(path.join(ROOT,'lib/d3dim-gpu.js'),'utf8')+'\n;('+staleUploadControl.toString()+')();');
      new vm.Script(injected);
      assert.deepEqual(injectedRows.at(-1),{url:route,sha256:sha(injected),bytes:Buffer.byteLength(injected)});
    }
    negative=null;
    for(const route of ['/lib/d3dim-gpu.js','/lib/d3dim-gpu.js?v=legacy-texture-public-com']){
      const response=await fetch('http://127.0.0.1:'+server.address().port+route);
      assert.equal(await response.text(),fs.readFileSync(path.join(ROOT,'lib/d3dim-gpu.js'),'utf8'));
    }
    assert.equal(injectedRows.length,2,'ordinary requests never inject');
  }finally{await require('./static-server').closeServer(server);}
}

async function bootstrap(modulePath){
  const routes=new Map([['/legacy-render.wasm',fs.readFileSync(modulePath)],
    ['/lib/host-import-sigs.generated.json',fs.readFileSync(path.join(ROOT,'lib/host-import-sigs.generated.json'))],
    ['/test/binaries/calc.exe',fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'))]]);
  const context=vm.createContext({WebAssembly,performance,setTimeout,fetch:async url=>{
    assert(routes.has(url));const bytes=routes.get(url);
    return {arrayBuffer:async()=>Uint8Array.from(bytes).buffer,json:async()=>JSON.parse(bytes)};
  }});
  try{return await vm.runInContext('('+fixtureSource()+')',context)('software',{...config(),bootstrap:true},oracle.toString());}
  catch(error){error.partial=context.legacyTextureEvidence;throw error;}
}

async function runtime(){
  controls();await serverControls();
  const batched=process.argv.includes('--batched');
  const selectedFixture=batched?batchedFixtureSource():fixtureSource();
  const oracleSource=batched?`(function(colors,state,sample){const base=${oracle.toString()};
    return sample.second?base(colors,{...state,n:-4,q:[1,1,1],offset:[.815,.867]},{x:sample.x-16,y:sample.y}):base(colors,state,sample);})`:oracle.toString();
  const dir=process.env.LEGACY_PUBLIC_MIP_EVIDENCE,moduleDir=process.env.LEGACY_PUBLIC_MIP_MODULE_DIR;
  const source=process.env.LEGACY_PUBLIC_MIP_SOURCE;
  assert(dir&&moduleDir);assert.match(source||'',/^[0-9a-f]{40}$/);
  const pins=JSON.parse(fs.readFileSync(process.env.LEGACY_PUBLIC_MIP_MODULE_MANIFEST,'utf8'));
  assert.equal(pins.source,source,'module manifest source must match tested Git source');
  assert.deepEqual(pins.modules.map(m=>m.name).sort(),['wine-assembly.compat.wasm','wine-assembly.wasm']);
  fs.mkdirSync(dir,{recursive:true});
  const evidence={status:'RUNNING',source,batched,node:process.version,plans:{solid:plan(),spatial:spatialPlan()},modules:[],results:[],negativeControls:[],requests:[],
    fixtureSha256:sha(fs.readFileSync(__filename)),adaptedFixtureSha256:sha(fixtureSource()),
    publicFixtureSha256:sha(fs.readFileSync(path.join(__dirname,'test-legacy-texture-rendered-contract.js'))),
    selectedFixtureSha256:sha(selectedFixture),selectedOracleSha256:sha(oracleSource),
    calcSha256:sha(fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'))),
    unexecuted:['partial/malformed chains',
      'other per-level formats/padded pitch','legacy combined filters','other dimensions/formats',
      'physical GPU','games / full27']};
  const save=()=>fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(evidence,null,2)+'\n');
  let server,browser,page,wasm,activeNegative=null;
  try{
    for(const name of ['wine-assembly.wasm','wine-assembly.compat.wasm']){
      const bytes=fs.readFileSync(path.join(moduleDir,name)),hash=sha(bytes);
      const pin=pins.modules.find(m=>m.name===name);
      assert.match(pin.sha256,/^[0-9a-f]{64}$/);
      assert.equal(hash,pin.sha256,'exact prebuilt production module '+name);
      assert.equal(bytes.length,pin.bytes,'exact module length '+name);
      evidence.modules.push({name,sha256:hash,bytes:bytes.length});
      fs.writeFileSync(path.join(dir,name),bytes);
      const result=await bootstrap(path.join(moduleDir,name));
      assert.equal(result.status,'BOOTSTRAP PASS; no draws');assert(!result.calls.some(c=>c.label==='DrawPrimitive7'));
      evidence.results.push({module:name,bootstrap:result});save();
    }
    if(process.argv.includes('--bootstrap')){evidence.status='BOOTSTRAP PASS; rendered paths unexecuted';return;}
    evidence.injections=[];
    server=await createServer(()=>wasm,()=>activeNegative,row=>evidence.injections.push(row),row=>evidence.requests.push(row));
    evidence.httpIsolation=[];
    for(const module of evidence.modules){
      wasm=fs.readFileSync(path.join(moduleDir,module.name));
      await isolationControls(server,wasm);
      evidence.httpIsolation.push({module:module.name,sha256:sha(wasm),routes:3,status:'PASS'});
    }
    save();
    evidence.browserOpenedAt=new Date().toISOString();
    browser=await require('puppeteer').launch({headless:true,executablePath:process.env.CHROME||'/usr/bin/google-chrome',
      args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'],protocolTimeout:120000});
    evidence.browser=await browser.version();evidence.browserPid=browser.process().pid;
    const cdp=await browser.target().createCDPSession();evidence.systemInfo=await cdp.send('SystemInfo.getInfo');await cdp.detach();
    const fixture=Function('return ('+selectedFixture+')')();
    const open=async()=>{page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port+'/legacy-render-fixture');};
    const runNegative=async(module,mode,webglVersion,negative,planName='spatial')=>{
      const cfg={...config(planName),webglVersion},injectionStart=evidence.injections.length;
      activeNegative=negative;
      await open();let failure;
      try{await page.evaluate(fixture,mode,cfg,oracleSource,negative);}catch(error){failure=String(error);}
      const partial=await page.evaluate(()=>globalThis.legacyTextureEvidence);
      const injections=evidence.injections.slice(injectionStart);
      evidence.negativeControls.push({module:module.name,mode,webglVersion,planName,negative,failure,partial,injections});save();
      assert(failure?.includes('PIXEL ORACLE'),'negative must fail actual pixels: '+failure);
      assert(partial.calls.some(c=>c.label==='DrawPrimitive7'&&c.result===0));
      assert(partial.observations.some(o=>o.actual.some((c,i)=>Math.abs(c-o.expected[i])>cfg.tolerance)));
      if(negative==='nearest-only'){
        const failed=partial.observations.at(-1);
        assert.equal(failed.state.mag,2,'linear magnification is exercised');
        const nearest=oracle(cfg.colors,{...failed.state,min:1,mag:1},failed.sample);
        assert(failed.actual.every((c,i)=>Math.abs(c-nearest[i])<=cfg.tolerance),
          'successful rendered readback actually sampled nearest texels');
        assert(partial.observations.length>=2,'point baseline draws before linear rejection');
      }
      if(negative==='stale-child-upload'){
        assert(injections.some(r=>r.url===(mode==='worker'?'/lib/d3dim-gpu.js?v=legacy-texture-public-com':'/lib/d3dim-gpu.js')),
          'exact executor script served with injection');
        assert(partial.update?.persisted,'negative must execute public child writes');
        const before=partial.observations.find(o=>o.label==='child before overwrite');
        const after=partial.observations.find(o=>o.label==='child after overwrite');
        assert(before&&after);assert.deepEqual(after.actual,before.actual,'old generation actually sampled');
        assert.deepEqual(after.expected,cfg.update.color,'independent new authored color');
      }
      if(mode==='worker')assert(partial.observations.some(o=>o.workerStats?.drawCalls>0));
      else if(mode==='webgl')assert(partial.observations.some(o=>o.webglRGBA&&o.glError===0));
      await page.close();page=null;console.log('PASS rendered negative '+negative+' '+module.name+' '+mode+' WebGL'+webglVersion);
    };
    for(const planName of ['solid','spatial'])for(const module of evidence.modules){
      wasm=fs.readFileSync(path.join(moduleDir,module.name));
      for(const mode of ['software','webgl','worker'])
      for(const webglVersion of mode==='software'?[null]:[1,2]){
        const cfg={...config(planName),webglVersion};
        activeNegative=null;await open();const result=await page.evaluate(fixture,mode,cfg,oracleSource);
        assert.equal(result.status,'PASS');
        const expected=cfg.states.reduce((n,s)=>n+s.samples.length,0)+(mode==='worker'?6:0)+(cfg.update?2:0);
        assert.equal(result.observations.length,expected);
        if(mode==='worker'){
          assert.equal(result.queued.length,3);
          assert(result.queued.every(q=>q.immutable&&q.afterLiveChange.completed<q.sequence&&q.afterDrain.completed>=q.sequence));
          assert.equal(result.retirement?.t,'render-stopped','owning render Worker acknowledged retirement');
          assert(Number.isInteger(result.retirement.heapHead),'native render heap retirement recorded');
          if(result.retirement.heapHead)assert(Number.isInteger(result.retirement.heapAdopted)&&result.retirement.heapAdopted>=0,
            'native render heap adopted before owning Worker termination');
        }
        evidence.results.push({module:module.name,webglVersion,planName,...result});save();
        await page.screenshot({path:path.join(dir,module.name+'-'+planName+'-'+mode+'-'+webglVersion+'.png')});await page.close();page=null;
        console.log('PASS '+module.name+' '+mode+' WebGL'+webglVersion+' observations '+result.observations.length);
        const negatives=planName==='spatial'?['nearest-only']:['level-zero-only','stale-mip-filter',
          ...(mode==='software'?[]:['stale-child-upload'])];
        for(const negative of negatives)await runNegative(module,mode,webglVersion,negative,planName);
      }
    }
    evidence.status='PASS';
  }catch(error){evidence.status='FAIL; subsequent paths unexecuted';evidence.error=error.stack;
    evidence.partial=error.partial||(page?await page.evaluate(()=>globalThis.legacyTextureEvidence).catch(()=>null):null);
    if(page)try{await page.screenshot({path:path.join(dir,'failure.png')});evidence.failureScreenshot='failure.png';}
    catch(captureError){evidence.captureError=String(captureError);}
    throw error;
  }finally{
    if(browser)await browser.close();evidence.browserClosedAt=new Date().toISOString();
    if(server)await require('./static-server').closeServer(server);evidence.helpersClosedAt=new Date().toISOString();save();
  }
}

if(require.main===module){
  if(process.argv.includes('--plan'))serverControls().then(()=>console.log(JSON.stringify(controls(),null,2)))
    .catch(error=>{console.error(error);process.exitCode=1;});
  else runtime().catch(error=>{console.error(error);process.exitCode=1;});
}
module.exports={oracle,plan,spatialPlan,fixtureSource,controls,bootstrap,serverControls};
