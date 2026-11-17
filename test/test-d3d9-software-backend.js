#!/usr/bin/env node
'use strict';
const assert=require('assert');
const {bootRenderHarness}=require('./render-helper');
const {Device}=require('../lib/d3d9-software-backend');
const IR=require('../lib/d3d-shader-ir');
// The neutral CommandQueue/execute() transport went with the old JS D3D9 path
// (d3d9-retire S4). This shim drives the Device entry points
// lib/gpu-stream-software.js calls, returning a synchronous validation error
// as a value the way execute() did, so later draws still run.
const OP={DRAW:'draw',CLEAR:'clear',PRESENT:'present'};
function directQueue(device){
  const queue={error:null,submitted:0,completed:0,submit(op,payload){
    queue.submitted++;let value;
    try{value=op===OP.DRAW?device.draw(payload):op===OP.CLEAR?device.clearCommand(payload):device.present();}
    catch(error){value={error};}
    queue.completed++;return {value};
  }};
  return queue;
}
(async()=>{
  const {exports:e,memory}=await bootRenderHarness({fonts:'none'});
  const fixedLive=new Set();let fixedCreated=0,fixedFreed=0;
  const nativeExports={...e,d3d_fixed_compile(ptr){
    const bundle=e.d3d_fixed_compile(ptr)>>>0;if(bundle){assert(!fixedLive.has(bundle));fixedLive.add(bundle);fixedCreated++;}return bundle;
  },d3d_fixed_free(bundle){assert(fixedLive.delete(bundle),'bundle released exactly once by its owner');fixedFreed++;e.d3d_fixed_free(bundle);}};
  for(const name of ['d3d_fixed_compile_vertex','d3d_fixed_compile_pixel','d3d_fixed_compile_cascade','d3d_fixed_compile_cascade2','d3d_fixed_compile_cascade3','d3d_fixed_compile_cascade4','d3d_fixed_compile_cascade5','d3d_fixed_compile_cascade6','d3d_fixed_compile_cached6',
    // The backend's default per-device packet cache hands out bundles too; each
    // is the caller's to free once (09aj: "Bundle owns ... until d3d_fixed_free").
    'd3d_fixed_compile_cached'])nativeExports[name]=(...args)=>{
    const bundle=e[name](...args)>>>0;if(bundle){assert(!fixedLive.has(bundle));fixedLive.add(bundle);fixedCreated++;}return bundle;
  };
  const options={getExports:()=>nativeExports,getMemory:()=>memory.buffer,width:8,height:8};
  const vs=new Uint32Array([0xfffe0101,1,0xc00f0000,0x90e40000,1,0xd00f0000,0x90e40005,
    1,0xe00f0000,0x90e40007,0xffff]);
  const ps=new Uint32Array([0xffff0101,5,0x800f0000,0x90e40000,0xa0e40000,0xffff]);
  function native(tokens){
    const guest=e.guest_alloc(tokens.byteLength)>>>0,p=e.guest_to_wasm(guest)>>>0;
    new Uint32Array(memory.buffer,p,tokens.length).set(tokens);
    const ir=e.d3d_shader_ir_compile(p,tokens.length)>>>0;assert(ir);
    const result=IR.read(memory.buffer,ir);e.d3d_shader_ir_free(ir);e.guest_free(guest);
    return result;
  }
  function snapshot(){
    const vertices=new Uint8Array(72),v=new DataView(vertices.buffer);
    [[-1,1],[1,1],[-1,-1]].forEach(([x,y],i)=>{
      v.setFloat32(i*24,x,true);v.setFloat32(i*24+4,y,true);v.setFloat32(i*24+8,.5,true);
      vertices.set([255,0,0,255],i*24+12);v.setFloat32(i*24+16,.5,true);v.setFloat32(i*24+20,.5,true);
    });
    return {primitive:4,primitiveCount:1,stride:24,vertices,
      attributes:[{register:0,usage:0,usageIndex:0,type:2,offset:0},
        {register:5,usage:10,usageIndex:0,type:4,offset:12},{register:7,usage:5,usageIndex:0,type:1,offset:16}],
      vertexShader:vs,pixelShader:ps,vertexConstants:new Float32Array(384),pixelConstants:new Float32Array([.5,1,1,1]),
      state:{zenable:true,zwrite:true,zfunc:4,blend:false,cull:1},textures:[]};
  }
  function fixedSnapshot(transformed=false){
    const draw=snapshot(),identity=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
    draw.vertexShader=null;draw.pixelShader=null;
    draw.fixedFunction={lighting:false,fog:false,specular:false,alphaTest:false,textureFactor:0xffffffff,
      world:identity(),view:identity(),projection:identity(),stages:[{
        colorOp:4,colorArg1:2,colorArg2:0,alphaOp:2,alphaArg1:2,alphaArg2:0,
        constant:0xffffffff,transformFlags:0,texCoordIndex:0},{colorOp:1}]};
    if(transformed){
      draw.stride=28;draw.vertices=new Uint8Array(84);const view=new DataView(draw.vertices.buffer);
      [[0,0],[8,0],[0,8]].forEach(([x,y],i)=>{
        [x,y,.5,1].forEach((v,j)=>view.setFloat32(i*28+j*4,v,true));
        draw.vertices.set([255,0,0,255],i*28+16);view.setFloat32(i*28+20,.5,true);view.setFloat32(i*28+24,.5,true);
      });
      draw.attributes=[{register:0,usage:9,usageIndex:0,type:3,offset:0},
        {register:5,usage:10,usageIndex:0,type:4,offset:16},{register:7,usage:5,usageIndex:0,type:1,offset:20}];
    }
    return draw;
  }
  function bumpSnapshot(stage=1,opcode=67,bytes=[128,128,0,0]){
    const uvCount=stage+1,stride=16+uvCount*8,vertices=new Uint8Array(stride*3),view=new DataView(vertices.buffer);
    const attributes=[{register:0,usage:0,usageIndex:0,type:3,offset:0}],tokens=[0xfffe0101,1,0xc00f0000,0x90e40000];
    for(let t=0;t<uvCount;t++){
      attributes.push({register:7+t,usage:5,usageIndex:t,type:1,offset:16+t*8});
      tokens.push(1,0xe00f0000+t,0x90e40007+t);
    }
    tokens.push(0xffff);
    [[-1,1],[1,1],[-1,-1]].forEach(([x,y],i)=>{
      [x,y,.5,1].forEach((v,c)=>view.setFloat32(i*stride+c*4,v,true));
      for(let t=0;t<uvCount;t++){
        view.setFloat32(i*stride+16+t*8,t===stage?.5:.9,true);
        view.setFloat32(i*stride+20+t*8,t===stage?.5:.1,true);
      }
    });
    const sampler={addressU:3,addressV:3,min:1,mag:1,mip:0},textures=[];
    textures[0]={width:1,height:1,format:62,pixels:new Uint8Array(bytes),sampler};
    textures[stage]={width:2,height:2,pixels:new Uint8Array([255,0,0,255,0,255,0,255,0,0,255,255,255,255,255,255]),sampler};
    const bumpStates=[];bumpStates[stage]=new Float32Array([0,.25,.25,0,.5,.25]);
    return {primitive:4,primitiveCount:1,stride,vertices,attributes,vertexShader:new Uint32Array(tokens),
      pixelShader:new Uint32Array([0xffff0101,66,0xb00f0000,opcode,0xb00f0000+stage,0xb0e40000,1,0x800f0000,0xb0e40000+stage,0xffff]),
      textures,bumpStates,state:{zenable:false,cull:1}};
  }
  function topologySnapshot(primitive,positions,indices=null){
    const draw=snapshot(),template=draw.vertices.slice(0,draw.stride);
    draw.primitive=primitive;draw.primitiveCount=primitive===4?(indices?indices.length:positions.length)/3:(indices?indices.length:positions.length)-2;
    draw.vertices=new Uint8Array(positions.length*draw.stride);const view=new DataView(draw.vertices.buffer);
    positions.forEach(([x,y],i)=>{
      draw.vertices.set(template,i*draw.stride);view.setFloat32(i*draw.stride,x,true);view.setFloat32(i*draw.stride+4,y,true);
    });
    if(indices)draw.indices=new Uint16Array(indices);
    return draw;
  }
  function matrixSnapshot(modifier=0,u=.25,v=.25,output=2){
    const draw=snapshot();
    draw.vertexShader=new Uint32Array([0xfffe0101,1,0xc00f0000,0x90e40000,
      1,0xe00f0000,0xa0e40000,1,0xe00f0001,0xa0e40001,1,0xe00f0002,0xa0e40002,0xffff]);
    const source=(0xb0e40000|modifier<<24)>>>0;
    draw.pixelShader=new Uint32Array([0xffff0101,64,0xb00f0000,
      1,0xb00f0001,0xa0e40000,1,0xb00f0002,0xa0e40000,
      71,0xb00f0001,source,72,0xb00f0002,source,1,0x800f0000,0xb0e40000+output,0xffff]);
    draw.vertexConstants=new Float32Array([modifier?(u+1)/2:u,modifier?(v+1)/2:v,.75,1,1,0,0,99,0,1,0,99]);
    draw.pixelConstants=new Float32Array([.2,.4,.6,1]);
    draw.textures=[null,{faces:[]},{width:2,height:2,
      pixels:new Uint8Array([255,0,0,255,0,255,0,255,0,0,255,255,255,255,255,255]),
      sampler:{addressU:3,addressV:3,min:1,mag:1,mip:0}}];
    return draw;
  }
  const device=new Device(options),base=device.bytes;
  try{
    const queue=directQueue(device);
    queue.submit(OP.CLEAR,{color:[0,0,0,1],flags:3});
    const draw=snapshot();draw.vertexShader=native(vs);draw.pixelShader=native(ps);
    queue.submit(OP.DRAW,draw);
    const frame=queue.submit(OP.PRESENT).value;
    assert.deepStrictEqual([frame.width,frame.height,frame.pitch],[8,8,32]);
    const colors=new Uint32Array(frame.pixels.buffer);
    for(let y=0;y<8;y++)for(let x=0;x<8;x++)assert.strictEqual(colors[y*8+x]>>>0,x+y<8?0xff800000:0xff000000);
    assert.strictEqual(device.bytes,base,'draw releases transient input/program ownership');
    queue.submit(OP.CLEAR,{color:[0,1,0,1],flags:1});
    assert.strictEqual(new Uint32Array(device.readPixels().buffer)[0]>>>0,0xff00ff00);
    assert.strictEqual(colors[0]>>>0,0xff800000,'Present is an immutable completed frame');
    const indexed=snapshot();indexed.indices=new Uint16Array([0,1,2]);
    device.clear([0,0,0,1],3);device.draw(indexed);
    assert.deepStrictEqual(device.readPixels(),frame.pixels,'INDEX16 and nonindexed produce identical native pixels');
    // True LINELIST records have no polygon area. Exercise actual native
    // coverage and effects, including the shared endpoint's draw multiplicity.
    function line(positions,indices=null){
      const result=topologySnapshot(2,positions,indices);
      result.primitiveCount=(indices?indices.length:positions.length)/2;
      result.state.zenable=false;
      result.pixelConstants=new Float32Array([1,1,1,1]);
      return result;
    }
    const linePixels=draw=>{device.clear([0,0,0,1],3);device.draw(draw);return new Uint32Array(device.readPixels().buffer);};
    const lineRed=(pixels)=>Array.from(pixels).flatMap((v,i)=>v===0xffff0000?[i]:[]);
    for(const lastPixel of [false,true])for(const cull of [1,2,3])for(const fillMode of [1,2,3]){
      const draw=line([[-.75,.5],[.5,.5]]);Object.assign(draw.state,{lastPixel,cull,fillMode});
      assert.deepStrictEqual(lineRed(linePixels(draw)),lastPixel?[17,18,19,20,21,22]:[17,18,19,20,21],
        `LINELIST ordered endpoints LASTPIXEL=${lastPixel}, ignores polygon cull/fill ${cull}/${fillMode}`);
      assert.strictEqual(device.bytes,base);
    }
    {
      const direct=line([[-.75,.5],[.5,.5],[.5,.5],[.5,-.5]]);
      const indexedLine=line([[99,99],[.5,-.5],[-.75,.5],[.5,.5]],[2,3,3,1]);
      assert.deepStrictEqual(linePixels(indexedLine),linePixels(direct),'indexed lines preserve pair order and ignore unused offscreen vertices');
      const reverse=line([[.5,.5],[-.75,.5]]);reverse.state.lastPixel=false;
      assert.deepStrictEqual(lineRed(linePixels(reverse)),[18,19,20,21,22],'LASTPIXEL excludes directed terminal endpoint');
      const zero=line([[0,0],[0,0]]);zero.state.lastPixel=true;
      assert.deepStrictEqual(lineRed(linePixels(zero)),[36],'zero length line draws one endpoint');
      zero.state.lastPixel=false;assert.deepStrictEqual(lineRed(linePixels(zero)),[]);
    }
    // Eight octants and both directions through the standalone topology path.
    // No half-step tie occurs in this 5:2 slope, so reflections preserve the
    // independent expected sample list without assuming a tie convention.
    for(const swap of [false,true])for(const flipX of [false,true])for(const flipY of [false,true])for(const reverse of [false,true]){
      const transform=([x,y])=>{if(swap)[x,y]=[y,x];return [flipX?7-x:x,flipY?7-y:y];};
      const samples=[[1,1],[2,1],[3,2],[4,2],[5,3],[6,3]].map(transform);
      if(reverse)samples.reverse();
      const draw=line([samples[0],samples.at(-1)].map(([x,y])=>[x/4-1,1-y/4]));draw.state.lastPixel=false;
      assert.deepStrictEqual(lineRed(linePixels(draw)),samples.slice(0,-1).map(([x,y])=>y*8+x).sort((a,b)=>a-b),
        `standalone line octant swap=${swap} flip=${flipX}/${flipY} reverse=${reverse}`);
    }
    {
      const draw=line([[-.75,.5],[.5,.5]]),planes=new Float32Array(24);planes.set([1,0,0,0],20);
      draw.vertices.set([0,255,0,255],draw.stride+12);
      draw.userClipPlanes={space:'clip',mask:32,planes};
      let pixels=linePixels(draw);
      assert.strictEqual(pixels[19],0xff000000,'enabled sixth user plane clips line');
      assert.strictEqual(pixels[20],0xff669900,'user-plane intersection preserves varying interpolation');
      assert.strictEqual(pixels[22],0xff00ff00);
      draw.userClipPlanes.mask=0;pixels=linePixels(draw);
      assert.strictEqual(pixels[17],0xffff0000,'disabled user plane leaves start endpoint');
      draw.userClipPlanes.mask=32;planes.set([-1,0,0,-2],20);
      assert(new Uint32Array(linePixels(draw)).every(v=>v===0xff000000),'same-side outside user plane rejects whole line');
      planes.set([1,0,0,2],20);pixels=linePixels(draw);
      assert.strictEqual(pixels[17],0xffff0000,'inside user plane retains line');
    }
    {
      // Homogeneous left-plane clipping must retain the varying gradient.
      const clipped=line([[-2,.5],[.5,.5]]);
      clipped.vertices.set([0,255,0,255],clipped.stride+12);
      const pixels=linePixels(clipped);
      assert.strictEqual(pixels[16],0xff996600,'new clip endpoint interpolates 40% green');
      assert.strictEqual(pixels[19],0xff4db300,'line midpoint attribute interpolation');
      assert.strictEqual(pixels[22],0xff00ff00,'terminal varying is exact');
      const outside=line([[-3,.5],[-2,-.5]]);assert.deepStrictEqual(lineRed(linePixels(outside)),[],'both outside endpoints reject whole segment');
      const near=line([[-.75,.5],[.5,.5]]),view=new DataView(near.vertices.buffer);
      view.setFloat32(8,-.5,true);view.setFloat32(near.stride+8,.5,true);
      assert.deepStrictEqual(lineRed(linePixels(near)),[20,21,22],'near-plane clips a line rather than dropping a degenerate polygon');
    }
    {
      const draw=line([[-.75,.5],[.5,.5]]),source=draw.vertices;
      draw.stride=28;draw.vertices=new Uint8Array(56);const view=new DataView(draw.vertices.buffer);
      for(let i=0;i<2;i++){
        const w=i+1;[i?.5*w:-.75,.5*w,.5*w,w].forEach((v,j)=>view.setFloat32(i*28+j*4,v,true));
        draw.vertices.set(source.subarray(i*24+12,i*24+24),i*28+16);
      }
      draw.vertices.set([0,255,0,255],44);
      draw.attributes=draw.attributes.map(a=>a.usage===0?{...a,type:3}:{...a,offset:a.offset+4});
      assert.strictEqual(linePixels(draw)[19],0xffbf4000,'line varying uses reciprocal-W perspective correction');
      draw.scissor={enabled:true,left:3,top:1,right:5,bottom:4};
      const clipped=linePixels(draw);
      assert.strictEqual(clipped[18],0xff000000,'scissor clips line coverage');
      assert.strictEqual(clipped[19],0xffbf4000,'scissor does not restart attribute interpolation');
      assert.strictEqual(clipped[21],0xff000000);
      const fixed=fixedSnapshot(true);fixed.primitive=2;fixed.primitiveCount=1;
      fixed.vertices=fixed.vertices.slice(0,56);const position=new DataView(fixed.vertices.buffer);
      position.setFloat32(0,1,true);position.setFloat32(4,2,true);
      position.setFloat32(28,6,true);position.setFloat32(32,2,true);
      assert.deepStrictEqual(lineRed(linePixels(fixed)),[17,18,19,20,21,22],'fixed POSITIONT line enters identical raster path');
      assert.strictEqual(fixedLive.size,0);
    }
    {
      const effect=line([[-.75,.5],[.5,.5],[.5,.5],[.5,-.5]]);
      effect.pixelConstants=new Float32Array([.25,0,0,1]);
      Object.assign(effect.state,{blend:true,srcblend:2,dstblend:2,blendop:1});
      const pixels=linePixels(effect);
      assert.strictEqual(pixels[18],0xff400000,'one line shader/blend application');
      assert.strictEqual(pixels[22],0xff800000,'shared endpoint gets one effect per line with LASTPIXEL');
      effect.state.lastPixel=false;
      assert.strictEqual(linePixels(effect)[22],0xff400000,'LASTPIXEL prevents duplicate shared endpoint effect');
      const depth=line([[-.75,.5],[.5,.5]]);Object.assign(depth.state,{zenable:true,zwrite:true,zfunc:2});
      device.clear([0,0,0,1],3,.25);device.draw(depth);
      assert(new Uint32Array(device.readPixels().buffer).every(v=>v===0xff000000),'line shader output obeys depth rejection');
    }
    {
      const stencilDevice=new Device(options),attachment={id:99,width:8,height:8,format:75};
      try{
        const draw=line([[-.75,.5],[.5,.5],[.5,.5],[.5,-.5]]);draw.depthAttachment=attachment;
        Object.assign(draw.state,{stencilEnable:true,stencilFunc:8,stencilPass:7,colorWriteMask:0});
        stencilDevice.clear([0,0,0,1],7,1,null,attachment,0);stencilDevice.draw(draw);
        draw.state.colorWriteMask=15;draw.state.stencilFunc=3;draw.state.stencilRef=2;draw.state.stencilPass=1;
        stencilDevice.draw(draw);
        assert.deepStrictEqual(lineRed(new Uint32Array(stencilDevice.readPixels().buffer)),[22],
          'stencil counts exactly one fragment per line; only shared endpoint reaches two');
      }finally{stencilDevice.destroy();}
    }
    for(const malformed of [
      {...line([[-.75,.5],[.5,.5]]),primitiveCount:2},
      {...line([[-.75,.5],[.5,.5]]),indices:new Uint16Array([0,2])},
      {...line([[-.75,.5],[.5,.5]]),indices:new Uint16Array([0])},
      {...line([[-.75,.5],[.5,.5]]),state:{antialiasedLine:true}},
      {...line([[-.75,.5],[.5,.5]]),primitive:3},
    ]){
      const before=device.readPixels();assert.throws(()=>device.draw(malformed),/D3D9 software/);
      assert.deepStrictEqual(device.readPixels(),before,'invalid line leaves output unchanged');assert.strictEqual(device.bytes,base);
    }
    const corners=[[-1,1],[1,1],[-1,-1],[1,-1]],fanCorners=[corners[0],corners[1],corners[3],corners[2]];
    for(const [primitive,positions,indices,reference]of[
      [5,corners,null,[0,1,2,2,1,3]],
      [6,fanCorners,null,[0,1,2,0,2,3]],
      [5,[[4,4],...corners,[4,4]],[1,2,3,4],[1,2,3,3,2,4]],
      [6,[[4,4],...fanCorners,[4,4]],[1,2,3,4],[1,2,3,1,3,4]],
      [5,corners,[0,1,2,2,1,3],[0,1,2,2,1,2,2,2,1,1,2,3]],
      [6,fanCorners,[0,1,1,2,3],[0,1,1,0,1,2,0,2,3]],
    ])for(const cull of [1,2,3]){
      const actual=topologySnapshot(primitive,positions,indices),expected=topologySnapshot(4,positions,reference);
      actual.state.cull=expected.state.cull=cull;
      device.clear([0,0,0,1],3);device.draw(expected);const referencePixels=device.readPixels();
      device.clear([0,0,0,1],3);
      assert.strictEqual(queue.submit(OP.DRAW,actual).value,1,'topology draw reaches native pipeline');
      assert.deepStrictEqual(queue.submit(OP.PRESENT).value.pixels,referencePixels,`topology ${primitive}, cull ${cull}, degenerates ${indices}`);
      assert.strictEqual(device.bytes,base,'expanded index lifetime ends with the draw');
    }
    {
      const actual=topologySnapshot(5,corners,[0,1,2,3]);actual.indices=new Uint16Array([0,1,2,3,65535]);
      device.clear([0,0,0,1],3);device.draw(actual);
      assert(new Uint32Array(device.readPixels().buffer).every(v=>v===0xff800000),'unused index trailer ignored and strip fills both triangles');
    }
    for(const source of [
      {...topologySnapshot(5,corners),primitiveCount:3},
      {...topologySnapshot(6,fanCorners),primitiveCount:257},
      {...topologySnapshot(5,corners),indices:new Uint16Array([0,1,2])},
      {...topologySnapshot(6,fanCorners),indices:new Uint16Array([0,1,2,65535])},
    ]){
      const before=device.readPixels();assert.throws(()=>device.draw(source),/D3D9 software/);
      assert.deepStrictEqual(device.readPixels(),before);assert.strictEqual(device.bytes,base);
    }
    for(const primitive of [5,6]){
      const indices=Array.from({length:258},(_,i)=>primitive===5?i%3:i===0?0:1+(i&1));
      const source=topologySnapshot(primitive,corners.slice(0,3),indices);
      device.clear([0,0,0,1],3);device.draw(source);
      assert.strictEqual(new Uint32Array(device.readPixels().buffer)[9],0xff800000,'maximum256 primitives expand to checked768 native indices');
      assert.strictEqual(device.bytes,base);
    }
    const blendSource=()=>{
      const source=snapshot();source.pixelConstants=new Float32Array([1,1,1,128/255]);
      source.state={zenable:false,cull:1,blend:true,srcblend:5,dstblend:6,blendop:1};return source;
    };
    for(const [change,expected]of[
      [{},[127,0,128,191]],
      [{separateAlpha:true,srcblendalpha:1,dstblendalpha:2,blendopalpha:1},[127,0,128,255]],
      [{srcblend:2,dstblend:2,blendop:1},[255,0,255,255]],
      [{srcblend:2,dstblend:2,blendop:2},[0,0,255,0]],
      [{srcblend:2,dstblend:2,blendop:3},[255,0,0,127]],
      [{srcblend:2,dstblend:2,blendop:4},[0,0,0,128]],
      [{srcblend:2,dstblend:2,blendop:5},[255,0,255,255]],
      [{srcblend:14,dstblend:1,blendFactor:0x80402010,colorWriteMask:9},[255,0,64,64]],
      [{srcblend:12,dstblend:1},[127,0,128,191]],
    ]){
      const source=blendSource();Object.assign(source.state,change);device.clear([0,0,1,1],3);
      assert.strictEqual(queue.submit(OP.DRAW,source).value,1);
      const pixels=queue.submit(OP.PRESENT).value.pixels;
      assert.deepStrictEqual([...pixels.slice(0,4)],expected,'native blend state produces canonical pixels');
      assert.deepStrictEqual([...pixels.slice(63*4)],[255,0,0,255],'uncovered target unchanged');
      assert.strictEqual(device.bytes,base);
    }
    for(let mask=0;mask<16;mask++){
      const source=blendSource();source.state.colorWriteMask=mask;device.clear([0,0,1,1],3);device.draw(source);
      const blended=[127,0,128,191],old=[255,0,0,255],bits=[4,2,1,8];
      assert.deepStrictEqual([...device.readPixels().slice(0,4)],old.map((v,i)=>mask&bits[i]?blended[i]:v),'write mask applies after native blend');
    }
    for(const state of [{srcblend:0},{dstblend:12},{srcblend:16},{blendop:6},{blendopalpha:0},
      {blendFactor:NaN},{colorWriteMask:16},{blend:'yes'},{separateAlpha:2}]){
      const source=blendSource();Object.assign(source.state,state);const before=device.readPixels();
      assert.throws(()=>device.draw(source),/D3D9 software/);assert.deepStrictEqual(device.readPixels(),before);assert.strictEqual(device.bytes,base);
    }

    const texture=snapshot();texture.pixelShader=new Uint32Array([0xffff0101,66,0xb00f0000,1,0x800f0000,0xb0e40000,0xffff]);
    texture.textures=[{width:1,height:1,pixels:new Uint8Array([0,128,255,255]),sampler:{min:1,mag:1,mip:0,addressU:3,addressV:3}}];
    device.clear([0,0,0,1],3);device.draw(texture);
    assert.deepStrictEqual([...device.readPixels().slice(0,4)],[255,128,0,255],'actual WAT texture sampling');
    // Same signed source bytes, off-diagonal bump matrix and 2x2 texture as
    // the real WebGL fixture. Native targets additionally preserve alpha.
    for(const stage of [1,2,3])for(const opcode of [67,68]){
      for(const [bytes,rgb]of[
        [[128,128,0,0],[255,0,0]],[[128,127,85,0],[0,255,0]],
        [[127,128,170,0],[0,0,255]],[[127,127,255,0],[255,255,255]],
      ]){
        const source=bumpSnapshot(stage,opcode,bytes);
        // Binding another unsupported texture must not make it a used sampler.
        if(stage!==2)source.textures[2]={faces:[],pixels:new Uint8Array(0)};
        queue.submit(OP.CLEAR,{color:[0,0,0,1],flags:3});
        assert.strictEqual(queue.submit(OP.DRAW,source).value,1,'actual multistage queue draw');
        const result=queue.submit(OP.PRESENT).value.pixels,factor=opcode===68?bytes[2]/255*.5+.25:1;
        const expected=[rgb[2],rgb[1],rgb[0],255].map(v=>Math.round(v*factor));
        for(let y=0;y<8;y++)for(let x=0;x<8;x++)assert.deepStrictEqual([...result.slice((y*8+x)*4,(y*8+x+1)*4)],
          x+y<8?expected:[0,0,0,255],`native bump t${stage} opcode${opcode} pixel ${x},${y}`);
        assert.strictEqual(device.bytes,base,'all sampled texture/bump snapshots retire');
      }
    }
    {
      const source=bumpSnapshot(3);source.pixelShader=new Uint32Array([0xffff0101,66,0xb00f0003,1,0x800f0000,0xb0e40003,0xffff]);
      source.textures[0]={faces:[]};delete source.bumpStates;
      device.clear([0,0,0,1],3);device.draw(source);
      assert.deepStrictEqual([...device.readPixels().slice(0,4)],[255,255,255,255],'TEX t3 does not require or bind sampler0');
      const gb=bumpSnapshot(1,70);delete gb.bumpStates;
      gb.textures[0]={...gb.textures[0],format:0,pixels:new Uint8Array([77,64,192,255])};
      device.clear([0,0,0,1],3);device.draw(gb);
      assert.deepStrictEqual([...device.readPixels().slice(0,4)],[255,0,0,255],'TEXREG2GB samples its destination stage without bump state');
      assert.strictEqual(device.bytes,base);
    }
    // `s.textures[1]=null` used to belong here. It does not any more: sampling
    // an unbound stage is legal D3D9 with an undefined result, and refusing the
    // draw for it was fatal (the command queue's error is sticky), so the
    // backend now samples a 1x1 transparent texel instead. That behaviour is
    // pinned by test/test-d3d9-unbound-sampler.js.
    for(const mutate of [s=>delete s.bumpStates,s=>s.bumpStates[1]=new Float32Array(5),
      s=>s.bumpStates[1][2]=Infinity,s=>s.textures[0].format=99]){
      const source=bumpSnapshot();mutate(source);const before=device.readPixels();
      assert.throws(()=>device.draw(source),/D3D9 software/);assert.deepStrictEqual(device.readPixels(),before);
      assert.strictEqual(device.bytes,base,'bump validation failures release snapshots');
    }
    {
      // TEXCOORD6 has no fixed UV lane, and used to be refused for it. A
      // programmable vertex program reads its inputs by REGISTER, so the
      // semantic only decides which attribute feeds v8 -- the attribute now
      // gets its own appended lane and the picture is unchanged.
      device.clear([0,0,0,1],3);device.draw(bumpSnapshot());
      const expected=device.readPixels().slice();
      const moved=bumpSnapshot();moved.attributes.find(a=>a.usage===5&&a.usageIndex===1).usageIndex=6;
      device.clear([0,0,0,1],3);device.draw(moved);
      assert.deepStrictEqual(device.readPixels(),expected,'TEXCOORD6 reaches v8 through an appended lane');
      assert.strictEqual(device.bytes,base);
    }
    {
      const source=snapshot();source.stride=40;source.vertices=new Uint8Array(120);
      const v=new DataView(source.vertices.buffer);
      [[-1,1],[1,1],[-1,-1]].forEach(([x,y],i)=>{
        [x,y,.5,1,0,0,1,.25,.25,0].forEach((n,j)=>v.setFloat32(i*40+j*4,n,true));
      });
      source.attributes=[{register:0,usage:0,usageIndex:0,type:2,offset:0},
        {register:1,usage:10,usageIndex:0,type:3,offset:12},{register:7,usage:5,usageIndex:5,type:1,offset:28}];
      source.vertexShader=new Uint32Array([0xfffe0101,1,0xc00f0000,0x90e40000,1,0xd00f0000,0x90e40001,1,0xe00f0005,0x90e40007,0xffff]);
      // ps_1_4 is public (D3D9-PUBLIC-PS14; D3DCAPS9.PixelShaderVersion 1.4): a
      // guest PS1.4 blob compiles through the native validator and texld r5,t5
      // samples stage 5 through the six-stage table and the ABI3 UV5 lane.
      source.pixelShader=new Uint32Array([0xffff0104,66,0x800f0005,0xb0e40005,1,0x800f0000,0x80e40005,0xffff]);
      source.textures=Array(6).fill(null);source.textures[5]={width:1,height:1,pixels:new Uint8Array([0,255,0,255]),sampler:{min:1,mag:1,mip:0}};
      queue.submit(OP.CLEAR,{color:[0,0,0,1],flags:3});
      {const t=queue.submit(OP.DRAW,source);assert.strictEqual(t.value,1,String(t.value&&t.value.error&&t.value.error.message));}
      assert.deepStrictEqual([...queue.submit(OP.PRESENT).value.pixels.slice(0,4)],[0,255,0,255],'PS1.4 native sampler5 and ABI3 UV5 queue pixels');
      assert.strictEqual(device.bytes,base,'six-stage descriptor and native storage cleanup');
      // ps_1_4 coissue: mov r0.rgb,c0 + mov r0.a,c1 is one RGB/alpha pair; the
      // VM used to refuse every coissued ps_1_4 record.
      source.pixelShader=new Uint32Array([0xffff0104,81,0xa00f0000,0x3f800000,0,0,0,81,0xa00f0001,0,0,0,0x3f000000,
        1,0x80070000,0xa0e40000,0x40000001,0x80080000,0xa0e40001,0xffff]);
      queue.submit(OP.CLEAR,{color:[0,0,0,1],flags:3});
      {const t=queue.submit(OP.DRAW,source);assert.strictEqual(t.value,1,String(t.value&&t.value.error&&t.value.error.message));}
      assert.deepStrictEqual([...queue.submit(OP.PRESENT).value.pixels.slice(0,4)],[0,0,255,128],'ps_1_4 coissued RGB + alpha pair (BGRA readback: red, alpha 0.5)');
      assert.strictEqual(device.bytes,base);
      // A ps_1_4 pair may write any temp r0..r5, not only the ps_1_1..1_3 r0/r1
      // file: mov r3.rgb,c0 + mov r2.a,c1, then mov r0.rgb,r3 + mov r0.a,r2.
      // Black & White 2's Aligned_Vines pairs into r3 and r2; the IR compiler
      // took it and the VM refused it at draw time, which latched the queue.
      source.pixelShader=new Uint32Array([0xffff0104,81,0xa00f0000,0x3f800000,0,0,0,81,0xa00f0001,0,0,0,0x3f000000,
        1,0x80070003,0xa0e40000,0x40000001,0x80080002,0xa0e40001,
        1,0x80070000,0x80e40003,0x40000001,0x80080000,0x80e40002,0xffff]);
      queue.submit(OP.CLEAR,{color:[0,0,0,1],flags:3});
      {const t=queue.submit(OP.DRAW,source);assert.strictEqual(t.value,1,String(t.value&&t.value.error&&t.value.error.message));}
      assert.deepStrictEqual([...queue.submit(OP.PRESENT).value.pixels.slice(0,4)],[0,0,255,128],'ps_1_4 coissued pairs into r3/r2 and back');
      assert.strictEqual(device.bytes,base);
      // ps_1_4 masks are arbitrary, so the RGB half of a pair may name any
      // non-empty r/g/b subset and either half may come first. Over r0=c2
      // (0,0,1,1): mov r0.r,c0 + mov r0.a,c1, then mov r0.a,c1 + mov r0.rb,c0.
      // The IR compiler took both and the VM refused them at draw time.
      for(const [pair,pixel] of [[[1,0x80010000,0xa0e40000,0x40000001,0x80080000,0xa0e40001],[255,0,255,128]],
        [[1,0x80080000,0xa0e40001,0x40000001,0x80050000,0xa0e40000],[0,0,255,128]]]){
        source.pixelShader=new Uint32Array([0xffff0104,81,0xa00f0000,0x3f800000,0,0,0,81,0xa00f0001,0,0,0,0x3f000000,
          81,0xa00f0002,0,0,0x3f800000,0x3f800000,1,0x800f0000,0xa0e40002,...pair,0xffff]);
        queue.submit(OP.CLEAR,{color:[0,0,0,1],flags:3});
        {const t=queue.submit(OP.DRAW,source);assert.strictEqual(t.value,1,String(t.value&&t.value.error&&t.value.error.message));}
        assert.deepStrictEqual([...queue.submit(OP.PRESENT).value.pixels.slice(0,4)],pixel,'ps_1_4 partial-RGB coissue pair (BGRA readback)');
        assert.strictEqual(device.bytes,base);
      }
      // The six-stage texture table and the ABI3 UV5 lane still reach a PS1.1
      // program: the vertex shader writes oT0 from v7 as well, t0 is sampled.
      source.vertexShader=new Uint32Array([0xfffe0101,1,0xc00f0000,0x90e40000,1,0xd00f0000,0x90e40001,1,0xe00f0005,0x90e40007,
        1,0xe00f0000,0x90e40007,0xffff]);
      source.pixelShader=new Uint32Array([0xffff0101,66,0xb00f0000,1,0x800f0000,0xb0e40000,0xffff]);
      source.textures[0]=source.textures[5];
      queue.submit(OP.CLEAR,{color:[0,0,0,1],flags:3});{const t=queue.submit(OP.DRAW,source);assert.strictEqual(t.value,1,String(t.value&&t.value.error&&t.value.error.message));}
      assert.deepStrictEqual([...queue.submit(OP.PRESENT).value.pixels.slice(0,4)],[0,255,0,255],'PS1.1 t0 with a six-stage texture table and ABI3 UV5 queue pixels');
      assert.strictEqual(device.bytes,base,'six-stage descriptor and native storage cleanup');
    }
    for(const transformed of [false,true]){
      queue.submit(OP.CLEAR,{color:[0,0,0,1],flags:3});
      const ticket=queue.submit(OP.DRAW,fixedSnapshot(transformed));assert.strictEqual(ticket.value,1,'NULL shader draw executes native fixed compiler');
      const fixedFrame=queue.submit(OP.PRESENT).value,colors=new Uint32Array(fixedFrame.pixels.buffer);
      for(let y=0;y<8;y++)for(let x=0;x<8;x++)assert.strictEqual(colors[y*8+x]>>>0,x+y<8?0xffff0000:0xff000000,
        `native fixed ${transformed?'POSITIONT':'XYZ'} queue pixels`);
      assert.strictEqual(fixedLive.size,0);assert.strictEqual(device.bytes,base);
    }
    for(const transformed of [false,true]){
      const draw=fixedSnapshot(transformed);
      Object.assign(draw.state,{fillMode:1,pointSize:2,pointSizeMin:0,pointSizeMax:64,pointScale:true,pointScaleA:1,pointScaleB:2,pointScaleC:3});
      queue.submit(OP.CLEAR,{color:[0,0,0,1],flags:3});const pointTicket=queue.submit(OP.DRAW,draw);assert.strictEqual(pointTicket.value,1);
      const frame=queue.submit(OP.PRESENT).value,colors=new Uint32Array(frame.pixels.buffer);
      assert.strictEqual(colors[0],0xffff0000,`native fixed POINT scaling ${transformed?'POSITIONT':'XYZ'}: ${Array.from(colors).map((c,i)=>c===0xffff0000?i:null).filter(i=>i!==null)}`);
      assert.strictEqual(colors.filter(c=>c===0xffff0000).length,1);
      assert.strictEqual(fixedLive.size,0);assert.strictEqual(device.bytes,base,'point bundle and sidecar lifecycle');
    }
    {
      const draw=fixedSnapshot();draw.textures=[{width:1,height:1,pixels:new Uint8Array([128,255,255,255]),sampler:{min:1,mag:1,mip:0}}];
      device.clear([0,0,0,1],3);device.draw(draw);
      assert.deepStrictEqual([...device.readPixels().slice(0,4)],[0,0,128,255],'fixed texture modulate runs in WAT');
      assert.strictEqual(fixedLive.size,0);
    }
    {
      const draw=fixedSnapshot();draw.attributes=draw.attributes.filter(a=>a.usage!==10);
      device.clear([0,0,0,1],3);device.draw(draw);assert.deepStrictEqual([...device.readPixels().slice(0,4)],[255,255,255,255],'missing fixed diffuse defaults white');
    }
    {
      const draw=fixedSnapshot();draw.fixedFunction.stages[0].texCoordIndex=1;draw.attributes.find(a=>a.usage===5).usageIndex=1;
      draw.textures=[{width:1,height:1,pixels:new Uint8Array([128,255,255,255]),sampler:{min:1,mag:1,mip:0}}];
      device.clear([0,0,0,1],3);device.draw(draw);assert.deepStrictEqual([...device.readPixels().slice(0,4)],[0,0,128,255],'selected fixed texcoord index maps to the one UV input');
    }
    for(const fixedVertex of [false,true])for(const transformed of fixedVertex?[false,true]:[false]){
      const source=fixedSnapshot(transformed);
      if(fixedVertex){
        source.pixelShader=new Uint32Array([0xffff0101,1,0x800f0000,0xa0e40000,0xffff]);
        source.pixelConstants=new Float32Array([0,1,0,1]);
        source.vertexConstants='unused';source.fixedFunction.stages[0].colorOp=999;
      }else{
        source.vertexShader=new Uint32Array([0xfffe0101,1,0xc00f0000,0x90e40000,1,0xd00f0000,0xa0e40000,0xffff]);
        source.vertexConstants=new Float32Array([0,1,0,1]);source.pixelConstants='unused';
        source.fixedFunction.world=null;source.fixedFunction.stages[0].transformFlags=999;
      }
      queue.submit(OP.CLEAR,{color:[0,0,0,1],flags:3});
      assert.strictEqual(queue.submit(OP.DRAW,source).value,1);
      const pixels=new Uint32Array(queue.submit(OP.PRESENT).value.pixels.buffer);
      for(let y=0;y<8;y++)for(let x=0;x<8;x++)assert.strictEqual(pixels[y*8+x]>>>0,x+y<8?0xff00ff00:0xff000000,
        'independent fixed and programmed stages preserve their own constants');
      assert.strictEqual(fixedLive.size,0);assert.strictEqual(device.bytes,base);
    }
    for(const fixedVertex of [false,true]){
      const source=fixedSnapshot();
      source.textures=[{width:1,height:1,pixels:new Uint8Array([0,255,255,255]),sampler:{min:1,mag:1,mip:0}}];
      if(fixedVertex){source.pixelShader=new Uint32Array([0xffff0101,66,0xb00f0000,1,0x800f0000,0xb0e40000,0xffff]);source.fixedFunction.stages[0].colorOp=1;}
      else{source.vertexShader=vs;source.fixedFunction.stages[0].colorOp=2;}
      device.clear([0,0,0,1],3);device.draw(source);
      assert.deepStrictEqual([...device.readPixels().slice(0,4)],[255,255,0,255],'mixed-stage texture linkage uses native lowering and sampler');
      assert.strictEqual(fixedLive.size,0);assert.strictEqual(device.bytes,base);
    }
    for(const modifier of [0,4])for(const [u,v,expected]of[
      [.25,.25,[0,0,255,255]],[.75,.25,[0,255,0,255]],
      [.25,.75,[255,0,0,255]],[.75,.75,[255,255,255,255]],
    ]){
      const source=matrixSnapshot(modifier,u,v);
      source.vertexShader=native(source.vertexShader);source.pixelShader=native(source.pixelShader);
      queue.submit(OP.CLEAR,{color:[0,0,0,1],flags:3});
      assert.strictEqual(queue.submit(OP.DRAW,source).value,1,'native IR matrix macro draw');
      const frame=queue.submit(OP.PRESENT).value;
      for(let y=0;y<8;y++)for(let x=0;x<8;x++)assert.deepStrictEqual([...frame.pixels.slice((y*8+x)*4,(y*8+x+1)*4)],
        x+y<8?expected:[0,0,0,255],'TEXM3x2 uses original rows, only destination sampler and optional bx2');
      assert.strictEqual(device.bytes,base);
    }
    device.clear([0,0,0,1],3);device.draw(matrixSnapshot(0,.75,.75,1));
    assert.deepStrictEqual([...device.readPixels().slice(0,4)],[153,102,51,255],'PAD hidden intermediate leaves t1 unchanged');
    {
      // Sampling a stage with no texture is legal D3D9 (undefined result), and
      // since c0ab171d5 the backend serves it as transparent black instead of
      // refusing the draw (B&W2's land pass does exactly this; a refusal made
      // the queue error sticky and ended rendering). The VM itself stays strict
      // (test-d3d-shader-vm.js).
      const source=matrixSnapshot();source.textures[2]=null;
      device.clear([0,0,0,1],3);device.draw(source);
      assert.deepStrictEqual([...device.readPixels().slice(0,4)],[0,0,0,0],'an unbound destination stage samples as transparent black');
      assert.strictEqual(device.bytes,base,'unbound matrix destination sampler still retires compiled programs');
    }
    for(const fixed of [false,true])for(let cmp=1;cmp<=8;cmp++){
      const source=fixed?fixedSnapshot():snapshot();
      source.state={...source.state,alphaTest:true,alphaFunc:cmp,alphaRef:0xffffffFF};
      device.clear([0,0,1,1],3);device.draw(source);
      const pass=[3,4,7,8].includes(cmp),pixels=new Uint32Array(device.readPixels().buffer);
      assert.strictEqual(pixels[9],pass?(fixed?0xffff0000:0xff800000):0xff0000ff,
        `native ${fixed?'fixed':'programmed'} alpha comparison ${cmp}`);
      assert.strictEqual(device.bytes,base,'alpha descriptor lifetime');
    }
    const before=device.readPixels();
    {
      const source=fixedSnapshot();source.fixedFunction.fog=true;source.fixedFunction.fogTableMode=4;source.fixedFunction.alphaTest=true;
      assert.throws(()=>device.draw(source),/invalid raster fog/,'invalid table fog mode rejects independently of alpha testing');
      assert.deepStrictEqual(device.readPixels(),before);assert.strictEqual(device.bytes,base);
    }
    assert.throws(()=>device.draw({...snapshot(),primitive:4,primitiveCount:257}),
      /short source range/,'large draws still require all input vertices');
    assert.throws(()=>device.draw({...texture,textures:[{...texture.textures[0],levels:[{},{}]}]}),
      /invalid four-byte mip level 0/,'diagnostic identifies rejected texture shape');
    assert.strictEqual(device.bytes,base,'diagnostic failures preserve allocation ownership');
    for(const [badIndex,bad] of [
      {...snapshot(),fixedFunction:{}},
      {...snapshot(),state:{blend:true,srcblend:16}},
      {...snapshot(),primitive:3},
      {...snapshot(),attributes:[]},
      {...texture,textures:[{...texture.textures[0],faces:[]}]},
      {...fixedSnapshot(),vertexShader:new Uint32Array([0xfffe0101,0x12345678,0xffff])},
      {...fixedSnapshot(),pixelShader:new Uint32Array([0xffff0101,0x12345678,0xffff])},
      {...fixedSnapshot(),fixedFunction:{...fixedSnapshot().fixedFunction,lighting:true}},
      {...snapshot(),state:{alphaTest:2}},
      {...snapshot(),state:{alphaTest:true,alphaFunc:0}},
      {...snapshot(),state:{alphaTest:true,alphaFunc:9}},
      {...snapshot(),state:{alphaTest:true,alphaRef:-1}},
      {...snapshot(),state:{alphaTest:true,alphaRef:0x100000000}},
      {...fixedSnapshot(),textures:[{width:1,height:1,pixels:new Uint8Array(3)}]},
      {...snapshot(),pixelShader:new Uint32Array([0xffff0101,0x12345678,0xffff])},
    ].entries()){
      assert.throws(()=>device.draw(bad),/D3D9 software:/,`invalid draw #${badIndex} must be refused`);
      assert.strictEqual(device.bytes,base,'validation failure frees partial native allocations');
      assert.strictEqual(fixedLive.size,0,'validation failure frees derived fixed bundle');
      assert.deepStrictEqual(device.readPixels(),before,'validation fails before target writes');
    }
    // A textured draw whose texture was unbound is legal D3D9, not an invalid
    // draw: since c0ab171d5 it samples transparent black instead of failing.
    assert.doesNotThrow(()=>device.draw({...texture,textures:[]}),'an unbound texture stage still draws');
    assert.strictEqual(device.bytes,base,'unbound-stage draw frees its native allocations');
    // PS1.1 may read v1 (specular); with no oD1 writer it reads zero (c0ab171d5).
    // Only a specular producer the lowering would drop is still refused.
    device.clear([0,0,0,1],3);
    assert.doesNotThrow(()=>device.draw({...snapshot(),pixelShader:new Uint32Array([0xffff0101,1,0x800f0000,0x90e40001,0xffff])}),
      'an unwritten v1 is legal pixel input');
    assert.deepStrictEqual([...device.readPixels().slice(0,4)],[0,0,0,0],'an unwritten v1 reads as zero');
    assert.strictEqual(device.bytes,base);
    for(let i=0;i<30;i++){device.clear([0,0,0,1],3);device.draw(snapshot());assert.strictEqual(device.bytes,base);}
    for(let i=0;i<30;i++){device.clear([0,0,0,1],3);device.draw(fixedSnapshot(i%2));assert.strictEqual(device.bytes,base);assert.strictEqual(fixedLive.size,0);}
    const rejected=queue.submit(OP.DRAW,{...snapshot(),state:{blend:true,srcblend:16}});
    assert.match(rejected.value.error.message,/blending/);
    assert.strictEqual(queue.error,null,'synchronous API validation must not poison the stream');
    queue.submit(OP.DRAW,snapshot());
    assert.strictEqual(queue.submitted,queue.completed);
  }finally{device.destroy();}
  assert.strictEqual(device.bytes,0);
  assert.throws(()=>device.readPixels(),/destroyed/);

  let refuseRelease=true;
  const guardedExports={...e,guest_map_free(guest){return refuseRelease?0:e.guest_map_free(guest);}};
  const retryDevice=new Device({...options,getExports:()=>guardedExports}),ownedBytes=retryDevice.bytes;
  assert.throws(()=>retryDevice.destroy(),/release failed/);
  // destroy() frees the per-device fixed packet cache (d3b22f5e7) before the
  // guest-mapped target, and that free does not go through guest_map_free: it
  // succeeds, so the accounting still owns exactly what is left.
  assert.strictEqual(retryDevice.fixedCache,0,'the packet cache was released');
  assert.strictEqual(retryDevice.bytes,ownedBytes-(retryDevice.fixedCacheLimit+32),'failed native free preserves ownership accounting');
  assert.strictEqual(retryDevice.target.live,true);assert.strictEqual(retryDevice.depth.live,true);
  assert.strictEqual(retryDevice.destroyed,false,'failed destruction remains retryable');
  refuseRelease=false;retryDevice.destroy();
  assert.strictEqual(retryDevice.bytes,0);assert.strictEqual(retryDevice.destroyed,true);
  // RGB565 keeps packed CPU bytes separate from its expanded native target.
  const q=(value,green=false)=>{const shift=green?2:3,bits=value>>>shift;return bits<<shift|bits>>>(green?4:2);};
  const rgb565=new Device({...options,format:23});
  try{
    const resource={id:12345,width:3,height:2,format:23},packed=new Uint8Array(16).fill(0xa5);
    const words=new DataView(packed.buffer);
    [0xf800,0x07e0,0x001f,0x1234,0xabcd,0xffff].forEach((v,i)=>words.setUint16(Math.floor(i/3)*8+i%3*2,v,true));
    rgb565.createColor(resource,packed,8);
    const read=rgb565.readColor(resource);
    assert.strictEqual(read.pitch,6);assert.strictEqual(read.format,23);
    assert.deepStrictEqual([...read.pixels],[0,248,224,7,31,0,52,18,205,171,255,255]);
    assert.deepStrictEqual([...packed.slice(6,8)],[0xa5,0xa5],'upload never changes row padding');
    rgb565.updateColor(resource,new Uint8Array([224,7]),2,{x:1,y:1,width:1,height:1});
    assert.strictEqual(new DataView(rgb565.readColor(resource).pixels.buffer).getUint16(8,true),0x07e0);
    rgb565.clear([93/255,137/255,181/255,0],1,1,null,null,0,resource);
    const nativeBytes=new Uint8Array(memory.buffer,rgb565.colorSurface(resource).wa,4);
    assert.deepStrictEqual([...nativeBytes],[q(181),q(137,true),q(93),255],'clear immediately quantizes native storage');
    const draw=snapshot();draw.pixelConstants=new Float32Array([1,1,1,1]);
    for(let i=0;i<3;i++)draw.vertices.set([93,137,181,128],i*24+12);
    draw.state={zenable:false,cull:1,blend:true,srcblend:5,dstblend:6,blendop:1};
    rgb565.clear([0,0,0,0],1);
    const cpuRead=rgb565.readColor();
    assert.strictEqual(cpuRead.format,23);assert.strictEqual(cpuRead.pixels.length,128,'ordered backbuffer READBACK is packed');
    assert.strictEqual(rgb565.readPixels()[3],255,'opaque565 alpha is established before the first blend');
    let expected=[0,0,0,255];
    for(let n=0;n<4;n++){
      rgb565.draw(draw);
      expected=[181,137,93].map((s,i)=>q(Math.round(s*128/255+expected[i]*127/255),i===1)).concat(255);
      assert.deepStrictEqual([...rgb565.readPixels().slice(0,4)],expected,'each blend reads the previously quantized destination');
    }
    const finalOnly=[181,137,93].map((s,i)=>q(Math.round(s*(1-(127/255)**4)),i===1));
    assert.notDeepStrictEqual(expected.slice(0,3),finalOnly,'fixture distinguishes per-write precision from Present-only packing');
    for(const mask of [0,1,2,4,8,15]){
      rgb565.clear([0,0,1,0],1);draw.state={zenable:false,cull:1,blend:false,colorWriteMask:mask};rgb565.draw(draw);
      assert.deepStrictEqual([...rgb565.readPixels().slice(0,4)],
        [mask&4?q(181):255,mask&2?q(137,true):0,mask&1?q(93):0,255],'565 channel masks ignore alpha writes');
    }
    // Render-target aliases sample the expanded storage, not packed guest bytes.
    const alias=snapshot();alias.textures=[{width:3,height:2,levels:[{width:3,height:2,resource}],sampler:{}}];
    alias.pixelShader=new Uint32Array([0xffff0101,66,0xb00f0000,1,0x800f0000,0xb0e40000,0xffff]);
    alias.state={zenable:false,cull:1};rgb565.draw(alias);
    assert.deepStrictEqual([...rgb565.readPixels().slice(0,4)],[q(181),q(137,true),q(93),255],'565 render-to-texture sampling preserves color');
    assert.strictEqual(rgb565.present().pixels.length,8*8*4,'presentation remains BGRA8');
  }finally{rgb565.destroy();}
  // BW2-RASTER-BUDGET-LATCH: each split batch keeps its native context (~1.15 KB
  // per triangle) until the draw ends, so one large draw beside B&W2's resident
  // textures exceeded the 64 MB budget and latched the queue. A draw whose
  // batches cannot all be held now streams batch by batch, in the same order:
  // same pixels and samples as the atomic path, storage back to base.
  {
    const tris=2000,stride=24,vertices=new Uint8Array(tris*3*stride),v=new DataView(vertices.buffer);
    for(let t=0;t<tris;t++)for(let k=0;k<3;k++){
      const i=t*3+k,a=(t*2.399+k*2.094)%6.283,r=.2+.8*((t*7)%13)/13;
      v.setFloat32(i*stride,Math.cos(a)*r,true);v.setFloat32(i*stride+4,Math.sin(a)*r,true);
      v.setFloat32(i*stride+8,.25+.5*((t*5)%11)/11,true);vertices.set([t&255,(t*3)&255,(t*7)&255,255],i*stride+12);
    }
    const big=()=>{const d=snapshot();Object.assign(d,{primitiveCount:tris,vertices,vertexShader:native(vs),pixelShader:native(ps)});return d;};
    const run=maxBytes=>{
      const device=new Device({...options,width:16,height:16,...(maxBytes?{maxBytes}:{})}),base=device.bytes;
      try{
        device.clear([0,0,0,1],3);device.draw(big());
        assert.strictEqual(device.bytes,base,'large draw returns every native byte');
        return {pixels:device.readPixels(),samples:device.lastDrawSamples};
      }finally{device.destroy();}
    };
    const atomic=run(0),streamed=run(4*1024*1024);
    assert.ok(atomic.samples>0n);
    assert.strictEqual(streamed.samples,atomic.samples,'streamed batches publish the same sample count');
    assert.deepStrictEqual(streamed.pixels,atomic.pixels,'streamed batches draw the same pixels in the same order');
  }
  assert.ok(fixedCreated>40);assert.strictEqual(fixedCreated,fixedFreed);assert.strictEqual(fixedLive.size,0);
  console.log('PASS D3D9 software backend: native fixed/programmed, strips/fans, bump sampling, blend/separate-alpha/ops/factor/write masks, immutable snapshots and exact ownership');
})().catch(error=>{console.error(error);process.exitCode=1;});
