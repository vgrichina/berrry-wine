#!/usr/bin/env node
'use strict';
const assert=require('assert');
const {bootRenderHarness}=require('./render-helper');
const {Device}=require('../lib/d3d9-software-backend');
const IR=require('../lib/d3d-shader-ir');
const {CommandQueue,OPCODES:OP}=require('../lib/d3d-command-stream');
(async()=>{
  const {exports:e,memory}=await bootRenderHarness({fonts:'none'});
  const fixedLive=new Set();let fixedCreated=0,fixedFreed=0;
  const nativeExports={...e,d3d_fixed_compile(ptr){
    const bundle=e.d3d_fixed_compile(ptr)>>>0;if(bundle){assert(!fixedLive.has(bundle));fixedLive.add(bundle);fixedCreated++;}return bundle;
  },d3d_fixed_free(bundle){assert(fixedLive.delete(bundle),'bundle released exactly once by its owner');fixedFreed++;e.d3d_fixed_free(bundle);}};
  for(const name of ['d3d_fixed_compile_vertex','d3d_fixed_compile_pixel','d3d_fixed_compile_cascade','d3d_fixed_compile_cascade2','d3d_fixed_compile_cascade3','d3d_fixed_compile_cascade4','d3d_fixed_compile_cascade5',
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
    const queue=new CommandQueue({deviceId:11,consumer:device});
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

  const scheduled=[],asyncDevice=new Device({...options,quadBudget:1,schedule:callback=>scheduled.push(callback)});
  try{
    const queue=new CommandQueue({deviceId:12,consumer:asyncDevice}),source=snapshot();
    const draw=queue.submit(OP.DRAW,source);
    const clearRects=[[7,7,8,8]],clear=queue.submit(OP.CLEAR,{color:[0,0,1,1],flags:3,depth:.375,rects:clearRects});
    clearRects[0].fill(0);
    const frame=queue.submit(OP.PRESENT);
    source.vertices.fill(0);source.pixelConstants.fill(0);
    assert.strictEqual(draw.status,'consumed');assert.strictEqual(frame.status,'submitted');
    assert.throws(()=>asyncDevice.readPixels(),/in flight/);
    let steps=0;
    while(scheduled.length){scheduled.shift()();await Promise.resolve();assert(++steps<100);}
    await queue.fence();
    assert(steps>1,'real WAT tile execution yields and resumes');
    assert.deepStrictEqual([...frame.value.pixels.slice(0,4)],[0,0,128,255],'queued inputs survive guest overwrite');
    assert.deepStrictEqual([...frame.value.pixels.slice(252,256)],[255,0,0,255],'rectangle clear waits for draw and owns its rectangle snapshot');
    assert.strictEqual(new Float32Array(memory.buffer,asyncDevice.depth.wa,64)[63],.375);
    assert.strictEqual(clear.status,'completed');
    const fixedSource=fixedSnapshot(true),fixedDraw=queue.submit(OP.DRAW,fixedSource),fixedFrame=queue.submit(OP.PRESENT);
    // Setup (and with it the fixed compile) is deferred into the scheduled
    // work since 5a1d94309, so nothing is compiled at submit; the ownership
    // rule is checked where it applies -- while the draw's quad work runs.
    assert.strictEqual(fixedDraw.status,'consumed');assert.strictEqual(fixedLive.size,0,'fixed compile is deferred with setup');
    fixedSource.vertices.fill(0);fixedSource.fixedFunction.world.fill(0);fixedSource.fixedFunction.stages[0].colorOp=12;
    let liveDuringWork=0;
    while(scheduled.length){scheduled.shift()();await Promise.resolve();if(scheduled.length)liveDuringWork=Math.max(liveDuringWork,fixedLive.size);}
    assert.strictEqual(liveDuringWork,1,'bundle retained while quad work remains');
    await queue.fence();assert.deepStrictEqual([...fixedFrame.value.pixels.slice(0,4)],[0,0,255,255],'queued fixed descriptor and vertex snapshots survive mutation');
    assert.strictEqual(fixedLive.size,0);
    const bumpSource=bumpSnapshot(3,68,[127,127,255,0]);
    const bumpDraw=queue.submit(OP.DRAW,bumpSource),bumpFrame=queue.submit(OP.PRESENT);
    assert.strictEqual(bumpDraw.status,'consumed');
    bumpSource.vertices.fill(0);bumpSource.bumpStates[3].fill(NaN);
    bumpSource.textures[0].pixels.fill(0);bumpSource.textures[3].pixels.fill(0);
    bumpSource.textures[3].sampler.min=99;bumpSource.attributes.length=0;
    while(scheduled.length){scheduled.shift()();await Promise.resolve();}
    await queue.fence();assert.deepStrictEqual([...bumpFrame.value.pixels.slice(0,4)],[191,191,191,191],
      'queued UVs, both textures, sampler and bump coefficients are immutable native snapshots');
    const baseline=asyncDevice.bytes;
    for(const fixedVertex of [false,true]){
      const mixed=()=>{const s=fixedSnapshot();if(fixedVertex)s.pixelShader=ps;else s.vertexShader=vs;return s;};
      asyncDevice.clear([0,0,0,1],3);
      const source=mixed(),task=asyncDevice.drawAsync(source);
      source.vertices.fill(0);source.vertexConstants.fill(0);source.pixelConstants.fill(0);
      source.fixedFunction.world.fill(NaN);source.fixedFunction.stages[0].colorOp=999;
      let mixedLive=0;
      while(scheduled.length){scheduled.shift()();if(scheduled.length)mixedLive=Math.max(mixedLive,fixedLive.size);}
      await task;
      assert.strictEqual(mixedLive,1,'only selected fixed stage bundle retained (deferred setup, checked during work)');
      assert.deepStrictEqual([...asyncDevice.readPixels().slice(0,4)],fixedVertex?[0,0,128,255]:[0,0,255,255],'mixed stage resources survive caller mutation');
      assert.strictEqual(asyncDevice.bytes,baseline);assert.strictEqual(fixedLive.size,0);
      const cancelled=asyncDevice.drawAsync(mixed());asyncDevice.cancel();await assert.rejects(cancelled,/cancel/);
      while(scheduled.length)scheduled.shift()();
      assert.strictEqual(asyncDevice.bytes,baseline);assert.strictEqual(fixedLive.size,0,'cancel releases selected bundle exactly once');
    }
    asyncDevice.clear([0,0,1,1],3);
    const alphaSource=snapshot();alphaSource.state={...alphaSource.state,alphaTest:true,alphaFunc:1};
    const alphaTask=asyncDevice.drawAsync(alphaSource);alphaSource.state.alphaFunc=8;
    while(scheduled.length)scheduled.shift()();await alphaTask;
    assert(new Uint32Array(asyncDevice.readPixels().buffer).every(v=>v===0xff0000ff),'queued alpha test state is copied');
    assert.strictEqual(asyncDevice.bytes,baseline);
    const cancelledAlpha=asyncDevice.drawAsync(alphaSource);asyncDevice.cancel();
    await assert.rejects(cancelledAlpha,/cancel/);while(scheduled.length)scheduled.shift()();
    assert.strictEqual(asyncDevice.bytes,baseline,'cancel retires alpha descriptor');
    const stripSource=topologySnapshot(5,[[-1,1],[1,1],[-1,-1],[1,-1]],[0,1,2,3]);
    const stripTask=asyncDevice.drawAsync(stripSource);stripSource.indices.fill(65535);stripSource.vertices.fill(0);
    while(scheduled.length)scheduled.shift()();await stripTask;
    assert(new Uint32Array(asyncDevice.readPixels().buffer).every(v=>v===0xff800000),'expanded strip indices survive caller mutation');
    assert.strictEqual(asyncDevice.bytes,baseline);
    asyncDevice.clear([0,0,1,1],3);
    const blendSource=snapshot();blendSource.pixelConstants=new Float32Array([1,1,1,128/255]);
    blendSource.state={blend:true,srcblend:5,dstblend:6,blendop:1,cull:1};
    const blendTask=asyncDevice.drawAsync(blendSource);blendSource.state.srcblend=16;blendSource.state.colorWriteMask=0;
    while(scheduled.length)scheduled.shift()();await blendTask;
    assert.deepStrictEqual([...asyncDevice.readPixels().slice(0,4)],[127,0,128,191],'native blend snapshot survives deferred state mutation');
    assert.strictEqual(asyncDevice.bytes,baseline);
    const cancelledBlend=snapshot();cancelledBlend.state={blend:true,srcblend:5,dstblend:6};
    const cancelledBlendTask=asyncDevice.drawAsync(cancelledBlend);asyncDevice.cancel();
    await assert.rejects(cancelledBlendTask,/cancel/);while(scheduled.length)scheduled.shift()();
    assert.strictEqual(asyncDevice.bytes,baseline,'cancel releases copied blend descriptor and raster context');
    const matrixSource=matrixSnapshot(4,.75,.25),matrixTask=asyncDevice.drawAsync(matrixSource);
    matrixSource.vertexConstants.fill(0);matrixSource.pixelConstants.fill(0);matrixSource.textures[2].pixels.fill(0);
    while(scheduled.length)scheduled.shift()();await matrixTask;
    assert.deepStrictEqual([...asyncDevice.readPixels().slice(0,4)],[0,255,0,255],'matrix macro constants and sampler survive queued mutation');
    assert.strictEqual(asyncDevice.bytes,baseline);
    const matrixCancel=asyncDevice.drawAsync(matrixSnapshot());asyncDevice.cancel();await assert.rejects(matrixCancel,/cancel/);
    while(scheduled.length)scheduled.shift()();assert.strictEqual(asyncDevice.bytes,baseline,'matrix sampler ownership retires on cancellation');
    // Setup is deferred (5a1d94309): run its first scheduled slice so the
    // fixed bundle exists, then cancel with quad work still pending.
    const runSetup=()=>{if(scheduled.length)scheduled.shift()();};
    queue.submit(OP.DRAW,fixedSnapshot());runSetup();assert.strictEqual(fixedLive.size,1,'setup compiled the fixed bundle');
    const fence=queue.fence();queue.cancel();
    await assert.rejects(fence,/cancel/i);
    assert.strictEqual(asyncDevice.bytes,baseline,'cancellation retires WAT context and snapshots');
    assert.strictEqual(fixedLive.size,0,'cancellation releases fixed bundle');
    while(scheduled.length)scheduled.shift()();
    for(let i=0;i<10;i++){
      const task=asyncDevice.drawAsync(fixedSnapshot(i%2));runSetup();assert.strictEqual(fixedLive.size,1);asyncDevice.cancel();
      await assert.rejects(task,/cancel/);while(scheduled.length)scheduled.shift()();
      assert.strictEqual(fixedLive.size,0);assert.strictEqual(asyncDevice.bytes,baseline);
      const bumpTask=asyncDevice.drawAsync(bumpSnapshot(1+i%3));asyncDevice.cancel();
      await assert.rejects(bumpTask,/cancel/);while(scheduled.length)scheduled.shift()();
      assert.strictEqual(asyncDevice.bytes,baseline,'cancel frees all native multisampler snapshots');
      const stripTask=asyncDevice.drawAsync(topologySnapshot(i%2?5:6,[[-1,1],[1,1],[-1,-1],[1,-1]]));
      asyncDevice.cancel();await assert.rejects(stripTask,/cancel/);while(scheduled.length)scheduled.shift()();
      assert.strictEqual(asyncDevice.bytes,baseline,'cancel frees topology expansion');
    }
  }finally{asyncDevice.destroy();}
  assert.strictEqual(asyncDevice.bytes,0);
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
    const cpuRead=rgb565.execute({opcode:OP.READBACK,payload:{}}).value;
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
  const constrained=new Device({...options,format:23,maxBytes:2048,fixedCacheBytes:0});
  try{
    constrained.clear([1,0,0,1],1);const old=constrained.target,pixels=constrained.readPixels();
    assert.throws(()=>constrained.reset({width:32,height:32,format:22,depthAttachment:null}),/budget/);
    assert.strictEqual(constrained.target,old);assert.strictEqual(constrained.format,23);
    assert.deepStrictEqual(constrained.readPixels(),pixels,'failed allocation retains565 rendering storage');
    constrained.reset({width:8,height:8,format:22,depthAttachment:null});
    assert.strictEqual(constrained.format,21,'32-bit reset retains historical output behavior');
  }finally{constrained.destroy();}
  assert.ok(fixedCreated>40);assert.strictEqual(fixedCreated,fixedFreed);assert.strictEqual(fixedLive.size,0);
  console.log('PASS D3D9 software backend: native fixed/programmed, strips/fans, bump sampling, blend/separate-alpha/ops/factor/write masks, immutable snapshots, yields/cancel and exact ownership');
})().catch(error=>{console.error(error);process.exitCode=1;});
