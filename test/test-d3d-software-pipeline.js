#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const {bootRenderHarness}=require('./render-helper');
(async()=>{
  const manifest=fs.readFileSync(path.join(__dirname,'../src/main.watx'),'utf8');
  const extraWat=['09af-d3d-shader-ir.wat','09ag-d3d-shader-vm.wat','09ah-d3d-software.wat']
    .map(file=>manifest.includes(file)?'':fs.readFileSync(path.join(__dirname,'../src',file),'utf8')).join('\n')+`
      (export "test_compile20" (func $d3d_shader_ir_compile20))
      (export "test_load_constants" (func $d3d_software_constants))
      (func (export "line_coverage") (param $a i32) (param $b i32) (param $x i32) (param $y i32) (param $last i32) (result i32)
        (call $d3d_software_line_inside (local.get $a) (local.get $b) (local.get $x) (local.get $y) (local.get $last)))
      (func (export "test_scan14") (param $p i32) (param $n i32) (param $out i32) (result i32)
        (call $d3d_ir_scan14 (local.get $p) (local.get $n) (local.get $out)))`;
  const {exports:e,memory}=await bootRenderHarness({fonts:'none',extraWat});
  const u8=new Uint8Array(memory.buffer),u16=new Uint16Array(memory.buffer),u32=new Uint32Array(memory.buffer),f32=new Float32Array(memory.buffer);
  const alloc=n=>e.guest_to_wasm(e.guest_alloc(n))>>>0;
  function program(tokens){
    const p=alloc(tokens.length*4);u32.set(tokens,p/4);
    let ir;
    if(tokens[0]===0xffff0104){
      {const pub=e.d3d_shader_ir_compile(p,tokens.length)>>>0;assert(pub,'public PS1.4 compiles');e.d3d_shader_ir_free(pub);}
      const count=e.test_scan14(p,tokens.length,0);assert(count>=0,'private PS1.4 validation');
      ir=alloc(32+count*128);u8.fill(0,ir,ir+32+count*128);
      u32.set([0x44534952,1,1,0xffff0104,count,tokens.length,32+count*128,0],ir/4);
      assert.strictEqual(e.test_scan14(p,tokens.length,ir),count);
    }else ir=tokens[0]===0xfffe0200?e.test_compile20(p,tokens.length):e.d3d_shader_ir_compile(p,tokens.length);
    assert.ok(ir,`IR error ${e.d3d_shader_ir_error()}`);
    const result=tokens[0]===0xfffe0200?e.d3d_shader_vm_compile_vs20(ir):e.d3d_shader_vm_compile(ir);e.d3d_shader_ir_free(ir);assert.ok(result,'VM compilation');return result;
  }
  const vs=program([0xfffe0101,1,0xc00f0000,0x90e40000,1,0xd00f0000,0x90e40001,1,0xe00f0000,0x90e40002,0xffff]);
  const ps=program([0xffff0101,5,0x800f0000,0x90e40000,0xa0e40000,0xffff]);
  const red=[1,0,0,1],green=[0,1,0,1],blue=[0,0,1,1];
  const vertex=(x,y,z=.5,w=1,color=red,tex=[0,0,0,1])=>[x*w,y*w,z*w,w,...color,...tex];
  function draw(vertices,options={}){
    const width=options.width||8,height=options.height||8,pitch=width*4+8;
    const colorBase=alloc(pitch*height+32),color=colorBase+16,depthBase=alloc(pitch*height+32),depth=depthBase+16;
    u8.fill(0x5a,colorBase,colorBase+pitch*height+32);u8.fill(0x6b,depthBase,depthBase+pitch*height+32);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){u32[(color+y*pitch+x*4)/4]=options.initialColor===undefined?0xff000000:options.initialColor;f32[(depth+y*pitch+x*4)/4]=options.initialDepth===undefined?1:options.initialDepth;}
    const stride=options.stride||48;
    const input=alloc(vertices.length*stride);vertices.forEach((v,i)=>f32.set(v,input/4+i*stride/4));
    const indices=options.indices||null,indexPtr=indices?alloc(indices.length*2):0;if(indices)u16.set(indices,indexPtr/2);
    const constants=alloc(16);f32.set(options.constant||[1,1,1,1],constants/4);
    const vertexConstants=options.vertexConstants?alloc(options.vertexConstants.byteLength):0;
    if(vertexConstants)f32.set(options.vertexConstants,vertexConstants/4);
    const desc=alloc(128);u32.fill(0,desc/4,desc/4+32);
    u32.set([0x44535031,options.abi||1,width,height,color,pitch,depth,pitch,input,vertices.length,stride,indexPtr,indices?indices.length:vertices.length,options.vs||vs,options.ps||ps,0,0,constants,1,options.vx||0,options.vy||0,options.vw||width,options.vh||height],desc/4);
    u32[desc/4+15]=vertexConstants;u32[desc/4+16]=options.vertexConstants?options.vertexConstants.length/4:0;
    f32[desc/4+23]=options.minZ===undefined?0:options.minZ;f32[desc/4+24]=options.maxZ===undefined?1:options.maxZ;
    u32.set([options.flags===undefined?3:options.flags,options.depthFunc||2,options.mask===undefined?15:options.mask,options.cull||1,options.inputMap||0,options.uvCount||0,options.extraMap||0],desc/4+25);
    const ctx=options.typed===undefined?e.d3d_software_create(desc):e.d3d_software_create_typed(desc,options.typed);
    if(ctx&&options.fill)assert(e.d3d_software_bind_fill(ctx,options.fill,options.lastPixel===false?0:1));
    function run(budget=3){let result=1,n=0;while(result===1){result=e.d3d_software_step(ctx,budget);assert.ok(++n<10000,'bounded completion');}const vm=u32[(ctx+148)/4];assert.strictEqual(result,0,`pipeline status ${result}, VM status ${u32[(vm+12)/4]|0}, PC ${u32[(vm+8)/4]}, mask ${u32[(vm+16)/4]}, helpers ${u32[(vm+24)/4]}`);return n;}
    const pixel=(x,y)=>u32[(color+y*pitch+x*4)/4]>>>0;
    const depthAt=(x,y)=>f32[(depth+y*pitch+x*4)/4];
    function guards(){for(const [base,value] of [[colorBase,0x5a],[depthBase,0x6b]]){
      assert.ok(u8.slice(base,base+16).every(v=>v===value));assert.ok(u8.slice(base+16+pitch*height,base+32+pitch*height).every(v=>v===value));
      for(let y=0;y<height;y++)assert.ok(u8.slice(base+16+y*pitch+width*4,base+16+(y+1)*pitch).every(v=>v===value),'pitch padding intact');
    }}
    return{ctx,desc,input,constants,indexPtr,color,depth,pitch,width,height,run,pixel,depthAt,guards};
  }
  const triangle=[vertex(-1,1),vertex(1,1),vertex(-1,-1)];
  let cases=0;
  {
    const bytes=e.d3d_shader_vm_context_bytes(),vm=alloc(bytes),source=alloc(4096);
    const words=[0,0x80000000,0x7f800000,0xff800000,0x7fc12345,1,0x807fffff,0x3f800000];
    for(let i=0;i<1024;i++)u32[source/4+i]=words[i%words.length];
    for(const count of [0,96,128,129,256]){
      u8.fill(0xa5,vm,vm+bytes);
      const expected=u8.slice(vm,vm+bytes),expectedWords=new Uint32Array(expected.buffer);
      for(let i=0;i<count;i++)for(let component=0;component<4;component++)for(let lane=0;lane<4;lane++){
        const offset=i<128?16416+i*64:65568+(i-128)*64;
        expectedWords[(offset+component*16+lane*4)/4]=u32[source/4+i*4+component];
      }
      e.test_load_constants(vm,source,count);
      assert.deepStrictEqual(u8.slice(vm,vm+bytes),expected,
        `${count} constants preserve raw bits in all lanes without touching any other VM storage`);
      cases++;
    }
    e.d3d_shader_vm_free(vm);e.d3d_shader_vm_free(source);
  }
  {
    const I=(op,...args)=>[(args.length<<24)|op,...args];
    for(const index of [95,96,127,128,255]){
      const constants=new Float32Array(256*4);
      for(let i=0;i<256;i++)constants.set([i/255,1-i/255,0,1],i*4);
      const shader=program([0xfffe0200,...I(31,0x80000000,0x900f0000),
        ...I(1,0xc00f0000,0x90e40000),...I(1,0xd00f0000,0xa0e40000|index),65535]);
      const d=draw(triangle,{vs:shader,vertexConstants:constants});
      assert(d.ctx,`full256 VS constants accepted for c${index}`);
      constants.fill(0);d.run();
      assert.strictEqual(d.pixel(1,1),(0xff000000|(index<<16)|((255-index)<<8))>>>0,`c${index} reaches real pixels`);
      d.guards();e.d3d_software_free(d.ctx);e.d3d_shader_vm_free(shader);cases++;
    }
    const d=draw(triangle,{vertexConstants:new Float32Array(257*4)});
    assert.strictEqual(d.ctx,0,'257 VS constants rejected');d.guards();cases++;
  }
  {
    const I=(op,...args)=>[(args.length<<24)|op,...args];
    const bits=value=>new Uint32Array(new Float32Array([value]).buffer)[0];
    const typedTokens=[0xfffe0200,...I(31,0x80000000,0x900f0000),
      ...I(81,0xa00f0000,...[0,0,0,1].map(bits)),...I(81,0xa00f0001,...[.25,0,0,0].map(bits)),
      ...I(81,0xa00f0002,...[0,1,0,1].map(bits)),...I(1,0x800f0000,0xa0e40000),
      ...I(40,0xe0e40800),...I(38,0xf0e40000),...I(2,0x800f0000,0x80e40000,0xa0e40001),...I(39),
      ...I(42),...I(1,0x800f0000,0xa0e40002),...I(43),
      ...I(1,0xc00f0000,0x90e40000),...I(1,0xd00f0000,0x80e40000),65535];
    const typedVS=program(typedTokens);
    for(const boolean of [0,1,0x80000000])for(const count of [0,1,3]) {
      const typed=alloc(640);u8.fill(0,typed,typed+640);
      u32.set([count,0xffffffff,0x80000000,0x7fc00000],typed/4);
      u32[typed/4+64]=boolean;u32[typed/4+80]=0x80000000;u32[typed/4+144]=0xffffffff;
      const d=draw(triangle,{vs:typedVS,typed});assert(d.ctx,'typed banks precede vertex execution');
      const vm=u32[(d.ctx+148)/4];
      assert.strictEqual(u32[(vm+73760)/4],0x80000000,'pixel integer bank keeps bits');
      assert.strictEqual(u32[(vm+74016)/4],1,'pixel Boolean nonzero normalized');
      u8.fill(0,typed,typed+640);d.run();
      assert.strictEqual(d.pixel(1,1),boolean?((0xff000000|Math.round(count*.25*255)<<16)>>>0):0xff00ff00);
      d.guards();e.d3d_software_free(d.ctx);cases++;
    }
    for(const typed of [0xf0,memory.buffer.byteLength-636,0xfffffff0]) {
      const d=draw(triangle,{vs:typedVS,typed});assert.strictEqual(d.ctx,0);d.guards();cases++;
    }
    const definedVS=program([...typedTokens.slice(0,-1),
      ...I(47,0xe00f0800,1),...I(48,0xf00f0000,2,0,0,0),65535]);
    const typed=alloc(640);u8.fill(0,typed,typed+640);
    u32[typed/4]=0xffffffff; // invalid REP count if API bank incorrectly wins
    const defined=draw(triangle,{vs:definedVS,typed});
    assert(defined.ctx,'shader definitions override external banks before execution');
    defined.run();assert.strictEqual(defined.pixel(1,1),0xff800000);
    defined.guards();e.d3d_software_free(defined.ctx);e.d3d_shader_vm_free(definedVS);cases++;
    e.d3d_shader_vm_free(typedVS);
  }
  {const wideVS=program([0xfffe0101,1,0xc00f0000,0x90e40000,1,0xd00f0000,0x90e4000a,0xffff]);
   const vertices=triangle.map(v=>[...v,...Array(7).fill([0,0,0,1]).flat(),...green]);
   const options={abi:5,uvCount:11,extraMap:0xa9876543,stride:176,vs:wideVS};
   const d=draw(vertices,options);assert(d.ctx,'ABI5 eleven inputs');d.run();assert.strictEqual(d.pixel(1,1),0xff00ff00,'highest register survives 32-bit map boundary');d.guards();e.d3d_software_free(d.ctx);cases++;
   for(const patch of [{uvCount:0},{uvCount:2},{uvCount:12},{uvCount:0xffffffff},{extraMap:0x09876543},{uvCount:10},{stride:160}]){
    const bad=draw(triangle,{...options,...patch});assert.strictEqual(bad.ctx,0,'ABI5 malformed count, duplicate register, unused bits or stride');bad.guards();cases++;
   }
   for(const [word,value] of [[8,memory.buffer.byteLength-16],[8,0xfffffff0],[9,0xffffffff],[10,0xffffffff]]){
    u32[d.desc/4+word]=value;assert.strictEqual(e.d3d_software_create(d.desc),0,'ABI5 extent/overflow rejects before input read');d.guards();
    u32[d.desc/4+word]=word===8?d.input:word===9?3:176;cases++;
   }
   e.d3d_shader_vm_free(wideVS);
  }
  // Public VS1.1 oFog is scalar/clamped; fog blending occurs after the PS and
  // preserves alpha. Legacy descriptor layout and unfogged paths are unchanged.
  for(const value of [-1,.25,2]){
    const fogVS=program([0xfffe0101,1,0xc00f0000,0x90e40000,1,0xd00f0000,0x90e40001,1,0xc00f0001,0x90e40002,0xffff]);
    const d=draw([vertex(-1,1,.5,1,red,[value,3,-7,NaN]),vertex(1,1,.5,1,red,[value,3,-7,NaN]),vertex(-1,-1,.5,1,red,[value,3,-7,NaN])],{vs:fogVS});
    assert.ok(d.ctx);assert.strictEqual(e.d3d_software_bind_fog(d.ctx,1,0x000000ff),1);d.run();
    const f=Math.max(0,Math.min(1,value)),expected=(0xff000000|(Math.round(f*255)<<16)|Math.round((1-f)*255))>>>0;
    assert.strictEqual(d.pixel(1,1),expected,'public oFog scalar x and RGB-only blend');
    assert.strictEqual(e.d3d_software_bind_fog(d.ctx,0,0),0,'fog immutable after execution');
    d.guards();e.d3d_software_free(d.ctx);e.d3d_shader_vm_free(fogVS);cases++;
  }
  for(const tokens of [[0xfffe0101,1,0xc0020001,0x90e40000,0xffff],[0xfffe0101,1,0x800f0000,0xc0e40001,0xffff]]){
    const p=alloc(tokens.length*4);u32.set(tokens,p/4);assert.strictEqual(e.d3d_shader_ir_compile(p,tokens.length),0,'oFog rejects non-scalar masks and reads');cases++;
  }
  // Private W-fog binder coverage does not advertise WFOG or enable host W mode.
  for(const depthMode of [0,1]){
    const d=draw([vertex(-1,1,.5,1),vertex(1,1,.5,4),vertex(-1,-1,.5,1)]),state=alloc(32);
    u32.set([1,3,0xff0000ff,depthMode,0,0,0,0],state/4);f32.set([0,2,1],state/4+4);
    assert.strictEqual(e.d3d_software_bind_table_fog(d.ctx,state),1);
    const retained=u32[(d.ctx+280)/4];assert(retained);u32[state/4+7]=1;
    assert.strictEqual(e.d3d_software_bind_table_fog(d.ctx,state),0,'invalid rebind leaves existing state');assert.strictEqual(u32[(d.ctx+280)/4],retained);
    f32[state/4+5]=99;d.run();
    const factor=depthMode?1-(1/.8125)/2:.75;
    assert.strictEqual(d.pixel(2,2),(0xff000000|(Math.round(factor*255)<<16)|Math.round((1-factor)*255))>>>0,'Z vs reciprocal interpolated RHW, never interpolated W');
    assert.strictEqual(e.d3d_software_bind_table_fog(d.ctx,state),0,'table state immutable once executing');
    d.guards();e.d3d_software_free(d.ctx);cases++;
  }
  {const d=draw(triangle),state=alloc(32);u32.set([1,3,0xff0000ff,0,0,0,0,0],state/4);f32.set([0,1,1],state/4+4);
   assert.strictEqual(e.d3d_software_bind_table_fog(d.ctx,state),1);assert.strictEqual(e.d3d_software_bind_fog(d.ctx,0,0),1);
   assert.strictEqual(u32[(d.ctx+280)/4],0,'vertex/disabled rebind retires table state');d.run();assert.strictEqual(d.pixel(1,1),0xffff0000);
   e.d3d_software_free(d.ctx);cases++;}
  {const d=draw(triangle,{fill:2}),state=alloc(32);u32.set([1,3,0xff0000ff,0,0,0,0,0],state/4);f32.set([0,1,1],state/4+4);
   assert.strictEqual(e.d3d_software_bind_table_fog(d.ctx,state),1);d.run();assert.strictEqual(d.pixel(1,0),0xff800080,'wire uses original raster depth');
   d.guards();e.d3d_software_free(d.ctx);cases++;}
  {
    const sixVS=program([0xfffe0101,1,0xc00f0000,0x90e40000,1,0xd00f0000,0x90e40001,
      1,0xe00f0004,0x90e40006,1,0xe00f0005,0x90e40007,0xffff]);
    const vertices=triangle.map((v,i)=>[...v,...Array(3).fill([0,0,0,1]).flat(),.1+i,.2+i,.3+i,1,.4+i,.5+i,.6+i,1]);
    const d=draw(vertices,{abi:3,uvCount:6,extraMap:0x76543,stride:128,vs:sixVS});assert.ok(d.ctx);
    const output=u32[(d.ctx+152)/4];
    assert.ok(Math.abs(f32[(output+96)/4]-.1)<1e-6,'ABI3 fifth texture output survives native vertex storage');
    assert.ok(Math.abs(f32[(output+112)/4]-.4)<1e-6,'ABI3 sixth texture output survives native vertex storage');
    d.run(1);assert.strictEqual(d.pixel(1,1),0xffff0000);d.guards();e.d3d_software_free(d.ctx);cases++;
    for(const options of [{abi:2,uvCount:6,extraMap:0x76543,stride:128},{abi:3,uvCount:6,extraMap:0x66543,stride:128},
      {abi:3,uvCount:6,extraMap:0x176543,stride:128},{abi:3,uvCount:6,extraMap:0x76543,stride:112}]){
      const bad=draw(triangle,{...options,vs:sixVS});assert.strictEqual(bad.ctx,0,'ABI3 extent/mapping errors reject before target writes');bad.guards();cases++;
    }
    e.d3d_shader_vm_free(sixVS);
  }
  {
    const sixVS=program([0xfffe0101,1,0xc00f0000,0x90e40000,1,0xd00f0000,0x90e40001,1,0xe00f0005,0x90e40007,0xffff]);
    const sixPS=program([0xffff0104,66,0x800f0005,0xb0e40005,1,0x800f0000,0x80e40005,0xffff]);
    const vertices=triangle.map((v,i)=>[...v,...Array(4).fill([0,0,0,1]).flat(),i===1?1:0,i===2?1:0,0,1]);
    const d=draw(vertices,{abi:3,uvCount:6,extraMap:0x76543,stride:128,vs:sixVS,ps:sixPS});assert.ok(d.ctx);
    const pixels=alloc(16),sampler=alloc(36);u8.set([255,0,0,255,0,255,0,255,0,0,255,255,255,255,255,255],pixels);
    u32.set([pixels,2,2,8,0,3,3,1,0],sampler/4);assert.strictEqual(e.d3d_software_bind_texture(d.ctx,5,sampler),1);
    u32.fill(0,sampler/4,sampler/4+9);d.run(1);
    assert.strictEqual(d.pixel(1,1),0xffff0000);assert.strictEqual(d.pixel(5,1),0xff00ff00);
    assert.strictEqual(d.pixel(1,5),0xff0000ff,'stage5 sampler uses perspective-linked t5, not a lower-stage alias');
    d.guards();e.d3d_software_free(d.ctx);e.d3d_shader_vm_free(sixVS);e.d3d_shader_vm_free(sixPS);cases++;
  }
  function bindPoints(d,{size=1,min=0,max=64,cap=64,sprite=false}={}){
    const p=alloc(32);u32.fill(0,p/4,p/4+8);u32.set([1,sprite?1:0],p/4);f32.set([size,min,max,cap],p/4+2);
    assert.strictEqual(e.d3d_software_bind_points(d.ctx,p),1);return p;
  }
  {
    const sizedVS=program([0xfffe0101,1,0xc00f0000,0x90e40000,1,0xd00f0000,0x90e40001,1,0xe00f0000,0x90e40002,
      1,0xc0010002,0x90000002,0xffff]);
    for(const indices of [null,[2,0,1]]){
      const d=draw([vertex(2,2,.5,1,red,[2,0,0,1]),vertex(12,2,.5,1,green,[4,0,0,1]),vertex(2,12,.5,1,blue,[1,0,0,1])],
        {fill:1,flags:12,width:16,height:16,vs:sizedVS,indices});
      bindPoints(d,{size:8});d.run(1);
      assert.strictEqual(e.d3d_software_samples(d.ctx),21n,'oPts sizes follow original indexed vertices, not render-state size');
      assert.strictEqual(d.pixel(1,1),0xffff0000);assert.strictEqual(d.pixel(10,0),0xff00ff00);
      assert.strictEqual(d.pixel(1,12),0xff000000);d.guards();e.d3d_software_free(d.ctx);cases++;
    }
    const clipped=draw([vertex(-.5,.5,-1,1,red,[8,0,0,1]),vertex(.5,.5,.5,1,green,[2,0,0,1]),vertex(-.5,-.5,.5,1,blue,[3,0,0,1])],
      {fill:1,flags:8,vs:sizedVS});bindPoints(clipped);clipped.run(1);
    assert.strictEqual(e.d3d_software_samples(clipped.ctx),13n,'near clipping preserves retained original oPts sizes without intersection points');
    clipped.guards();e.d3d_software_free(clipped.ctx);cases++;
    // A non-finite oPts used to fail CREATION, which killed the whole draw --
    // and, because the render queue's error is sticky, every draw after it.
    // Real hardware rasterizes nothing for a primitive it cannot order and
    // carries on, so the setup now marks the vertex and the clipper drops only
    // the triangles that reference it. The target must still be untouched.
    const invalid=draw([vertex(2,2,.5,1,red,[NaN,0,0,1]),vertex(6,2),vertex(2,6)],{flags:12,vs:sizedVS});
    assert.notStrictEqual(invalid.ctx,0,'a non-finite point size does not fail creation');
    invalid.run();
    assert.strictEqual(invalid.pixel(2,2),0xff000000,'and paints nothing');
    invalid.guards();e.d3d_software_free(invalid.ctx);cases++;
    e.d3d_shader_vm_free(sizedVS);
  }
  {
    const d=draw([vertex(-1,4),vertex(40,4),vertex(4,40)],{fill:1,flags:12});bindPoints(d,{size:4});d.run(1);
    assert.strictEqual(e.d3d_software_samples(d.ctx),4n,'point center outside viewport retains its visible square intersection');
    assert.strictEqual(d.pixel(0,2),0xffff0000);assert.strictEqual(d.pixel(1,2),0xff000000);d.guards();e.d3d_software_free(d.ctx);cases++;
    const shared=draw([vertex(1,1),vertex(6,1),vertex(1,6)],{fill:1,flags:12,indices:[0,1,2,0,1,2]});shared.run(1);
    assert.strictEqual(e.d3d_software_samples(shared.ctx),6n,'POINT ownership is per input triangle, not globally deduplicated indices');e.d3d_software_free(shared.ctx);cases++;
    const bad=draw([vertex(4,4),vertex(40,4),vertex(4,40)],{fill:1,flags:12}),p=bindPoints(bad,{size:4});
    const saved=u32.slice(p/4,p/4+8);
    for(const [index,value]of[[0,2],[1,2],[2,0x7fc00000],[3,0x40800000],[5,0],[6,1],[7,1]]){
      u32.set(saved,p/4);u32[p/4+index]=value;
      // min4 is valid with cap64: make max smaller for that cross-field case.
      if(index===3)f32[p/4+4]=2;
      assert.strictEqual(e.d3d_software_bind_points(bad.ctx,p),0,'invalid point-state replacement preserves old state');cases++;
    }
    bad.run();assert.strictEqual(e.d3d_software_samples(bad.ctx),16n);bad.guards();e.d3d_software_free(bad.ctx);
  }
  for(const [center,size,min,max,cap,count]of[[4,4,0,64,64,16n],[4,8,0,3,64,9n],[4,8,0,64,1,1n],
    [4,0,2,64,64,4n],[4,.5,0,64,64,1n],[4.5,.5,0,64,64,0n]]){
    const d=draw([vertex(center,center),vertex(40,4),vertex(4,40)],{fill:1,flags:12});
    const p=bindPoints(d,{size,min,max,cap});u32.fill(0,p/4,p/4+8);d.run(1);
    assert.strictEqual(e.d3d_software_samples(d.ctx),count,'point-size square coverage and min/max/cap clamps');
    assert.strictEqual(e.d3d_software_bind_points(d.ctx,p),0,'late point-state mutation rejects');
    d.guards();e.d3d_software_free(d.ctx);cases++;
  }
  {
    const pointPS=program([0xffff0101,64,0xb00f0000,1,0x800f0000,0xb0e40000,0xffff]);
    for(const sprite of [false,true]){
      const d=draw([vertex(4,4,.5,1,red,[.5,.25,0,1]),vertex(40,4),vertex(4,40)],{fill:1,flags:12,ps:pointPS});
      bindPoints(d,{size:4,sprite});d.run(1);
      assert.strictEqual(d.pixel(3,3),sprite?0xff404000:0xff804000);
      assert.strictEqual(d.pixel(5,5),sprite?0xffbfbf00:0xff804000,'sprite UVs span the square; ordinary points duplicate the vertex UV');
      d.guards();e.d3d_software_free(d.ctx);cases++;
    }
    e.d3d_shader_vm_free(pointPS);
  }
  for(const [vertices,count,coords]of[
    [[vertex(1,1),vertex(6,1),vertex(1,6)],3n,[[1,1],[6,1],[1,6]]],
    [[vertex(-.25,1),vertex(6,1),vertex(1,6)],3n,[[0,1],[6,1],[1,6]]],
    [[vertex(.5,.5),vertex(6.5,.5),vertex(.5,6.5)],3n,[[0,0],[6,0],[0,6]]],
    [[vertex(1,1,-1),vertex(6,1),vertex(1,6)],2n,[[6,1],[1,6]]],
    [[vertex(1,1,2),vertex(6,1),vertex(1,6)],2n,[[6,1],[1,6]]],
  ]){
    const d=draw(vertices,{fill:1,flags:12});d.run(1);
    assert.strictEqual(e.d3d_software_samples(d.ctx),count,'POINT ownership and depth clipping count original vertices');
    for(const [x,y]of coords)assert.strictEqual(d.pixel(x,y),0xffff0000);
    assert.strictEqual(d.pixel(3,3),0xff000000,'POINT fill does not fill edges or interiors');
    d.guards();e.d3d_software_free(d.ctx);cases++;
  }
  {
    const vertices=[vertex(-.5,.5,-.5),vertex(.5,.5),vertex(-.5,-.5)];
    const d=draw(vertices,{fill:1,flags:8});d.run(1);
    assert.strictEqual(e.d3d_software_samples(d.ctx),2n,'near clip produces no extra points or fan duplicates');
    assert.strictEqual(d.pixel(6,2),0xffff0000);assert.strictEqual(d.pixel(2,6),0xffff0000);
    e.d3d_software_free(d.ctx);cases++;
    const point=draw(triangle,{flags:8});assert.strictEqual(e.d3d_software_bind_fill(point.ctx,3,1),0,'POINT creation cannot bind SOLID');e.d3d_software_free(point.ctx);
    const solid=draw(triangle);assert.strictEqual(e.d3d_software_bind_fill(solid.ctx,1,1),0,'SOLID clipping cannot later bind POINT');e.d3d_software_free(solid.ctx);cases++;
  }
  {
    const a=alloc(16),b=alloc(16);
    for(const end of [[7,4],[7,5],[6,7],[4,7],[2,7],[1,5],[1,4],[1,2],[2,1],[4,1],[6,1],[7,2]])for(const last of [0,1]){
      f32.set([4,4,0,1],a/4);f32.set([...end,0,1],b/4);
      let x=4,y=4,dx=Math.abs(end[0]-x),dy=-Math.abs(end[1]-y),sx=x<end[0]?1:-1,sy=y<end[1]?1:-1,error=dx+dy;
      const expected=new Set();
      while(true){if(x===end[0]&&y===end[1]){if(last)expected.add(`${x},${y}`);break;}
        expected.add(`${x},${y}`);const twice=2*error;
        if(twice>=dy){error+=dy;x+=sx;}if(twice<=dx){error+=dx;y+=sy;}
      }
      for(let py=0;py<8;py++)for(let px=0;px<8;px++)assert.strictEqual(!!e.line_coverage(a,b,px,py,last),expected.has(`${px},${py}`),'line octant/tie matches independent Bresenham walk');
      cases++;
    }
  }
  for(const lastPixel of [false,true]){
    const d=draw(triangle,{fill:2,flags:0,lastPixel});d.run(1);
    assert.strictEqual(d.pixel(3,3),0xff000000,'wireframe does not fill triangle interiors');
    assert.strictEqual(d.pixel(4,4),0xffff0000,'wireframe retains the original diagonal edge');
    assert.strictEqual(e.d3d_software_samples(d.ctx),lastPixel?23n:22n,'line endpoints counted per original edge');
    assert.strictEqual(e.d3d_software_bind_fill(d.ctx,3,1),0,'fill changes after raster start reject');
    d.guards();e.d3d_software_free(d.ctx);cases++;
  }
  {
    const vertices=[vertex(-1,1,.5,1,red),vertex(1,1,.5,2,green),vertex(-1,-1,.5,3,blue)];
    const d=draw(vertices,{fill:2,flags:0}),fast=draw(vertices,{fill:2,flags:0});d.run(1);fast.run(1000);
    assert.strictEqual(d.pixel(4,0),0xffaa5500,'wireframe color is perspective-correct along its original edge');
    assert.strictEqual(d.pixel(0,4),0xffbf0040,'reversed edge preserves interpolation direction');
    for(let y=0;y<8;y++)for(let x=0;x<8;x++)assert.strictEqual(d.pixel(x,y),fast.pixel(x,y),'quad/edge resume preserves every pixel');
    d.guards();fast.guards();e.d3d_software_free(d.ctx);e.d3d_software_free(fast.ctx);cases++;
  }
  for(const [vertices,cull]of[[triangle,2],[[triangle[0],triangle[2],triangle[1]],3]]){
    const d=draw(vertices,{fill:2,flags:0,cull});d.run();assert.strictEqual(e.d3d_software_samples(d.ctx),0n,'wireframe preserves original polygon culling');
    e.d3d_software_free(d.ctx);cases++;
  }
  for(const vertices of [
    [vertex(-1,1,-.5),vertex(1,1,.5),vertex(-1,-1,.5)],
    [vertex(-3,3),vertex(3,3),vertex(0,-3)],
  ]){
    const d=draw(vertices),indexBase=u32[(d.ctx+156)/4],vertexBase=u32[(d.ctx+152)/4],n=u32[(d.ctx+48)/4];
    let enabled=0;
    for(let i=0;i<n;i+=3){
      const mask=u16[indexBase/2+i]>>>13;
      for(let j=0;j<3;j++){
        const index=u16[indexBase/2+i+j]&8191;assert(index<n,'encoded provenance does not corrupt vertex index');
        if(!(mask&(1<<j)))continue;enabled++;
        const next=u16[indexBase/2+i+(j+1)%3]&8191;
        const a=[f32[(vertexBase+index*144)/4],f32[(vertexBase+index*144)/4+1]],b=[f32[(vertexBase+next*144)/4],f32[(vertexBase+next*144)/4+1]];
        assert(vertices.some((v,k)=>{
          const w=vertices[(k+1)%3],p=[(v[0]/v[3]+1)*4,(1-v[1]/v[3])*4],q=[(w[0]/w[3]+1)*4,(1-w[1]/w[3])*4];
          return [a,b].every(r=>Math.abs((q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]))<1e-4);
        }),'enabled edge belongs to an original segment, never clipping cap/fan diagonal');
      }
    }
    assert(enabled<=3);e.d3d_software_free(d.ctx);cases++;
  }
  assert.strictEqual(draw(triangle,{indices:[0x2000,1,2]}).ctx,0,'guest indices cannot smuggle private edge flags');cases++;
  {
    const d=draw([vertex(-4,-2),vertex(12,-2),vertex(4,6)],{fill:2,flags:4});d.run(1);
    assert.strictEqual(d.pixel(0,2),0xffff0000,'offscreen first edge does not skip later visible wire edges');
    assert.strictEqual(d.pixel(4,6),0xffff0000);d.guards();e.d3d_software_free(d.ctx);cases++;
    const outside=draw([vertex(-8,-8),vertex(-2,-8),vertex(-8,-2)],{flags:4});outside.run();
    assert.strictEqual(e.d3d_software_samples(outside.ctx),0n);outside.guards();e.d3d_software_free(outside.ctx);cases++;
    const huge=draw([vertex(-2097152,0),vertex(4,0),vertex(4,4)],{flags:4});
    assert.strictEqual(e.d3d_software_bind_fill(huge.ctx,2,1),0,'huge offscreen wire endpoints reject before conversion or pixel writes');
    assert.strictEqual(huge.pixel(0,0),0xff000000);huge.guards();e.d3d_software_free(huge.ctx);cases++;
  }
  {
    const d=draw([vertex(-1,1,-.5),vertex(1,1,.5),vertex(-1,-1,.5)],{fill:2,flags:0});d.run(1);
    assert.strictEqual(d.pixel(2,2),0xff000000,'near clipping cap is not a wireframe edge');
    assert.strictEqual(d.pixel(4,2),0xff000000,'triangulation diagonal is not a wireframe edge');
    assert.strictEqual(d.pixel(6,0),0xffff0000);assert.strictEqual(d.pixel(0,6),0xffff0000);assert.strictEqual(d.pixel(4,4),0xffff0000);
    d.guards();e.d3d_software_free(d.ctx);cases++;
  }
  function stencilDraw(options={},state={}){
    const d=draw(state.reverse?[triangle[0],triangle[2],triangle[1]]:triangle,options);
    assert(e.d3d_software_bind_depth_format(d.ctx,75));
    const plane=alloc(96),sd=alloc(64);u8.fill(0xa6,plane,plane+96);
    assert.strictEqual(e.d3d_software_clear_stencil(plane+8,8,8,10,state.initial===undefined?9:state.initial),0);
    u32.set([1,state.twoSided?3:1,plane+8,10,state.ref===undefined?17:state.ref,state.readMask===undefined?255:state.readMask,
      state.writeMask===undefined?255:state.writeMask,state.fail||1,state.zfail||1,state.pass||1,state.func||8,
      state.ccwFail||1,state.ccwZFail||1,state.ccwPass||1,state.ccwFunc||8,0],sd/4);
    assert(e.d3d_software_bind_stencil(d.ctx,sd));
    return {...d,sd,stencil:()=>u8[plane+8],stencilGuards:()=>{
      assert(u8.slice(plane,plane+8).every(v=>v===0xa6));
      for(let y=0;y<8;y++)assert(u8.slice(plane+8+y*10+8,plane+8+y*10+10).every(v=>v===0xa6));
      assert(u8.slice(plane+88,plane+96).every(v=>v===0xa6));
    }};
  }
  for(const [initial,expected]of [[9,[9,0,17,10,8,246,10,8]],[255,[255,0,17,255,254,0,0,254]],[0,[0,0,17,1,0,255,1,255]]]){
    for(let op=1;op<=8;op++){
      const d=stencilDraw({}, {initial,pass:op});
      u32.fill(0,d.sd/4,d.sd/4+16); // binder owns its descriptor snapshot
      d.run(1);assert.strictEqual(d.stencil(),expected[op-1]);assert.strictEqual(e.d3d_software_samples(d.ctx),36n);
      assert.strictEqual(e.d3d_software_bind_stencil(d.ctx,d.sd),0,'late state changes reject');
      d.guards();d.stencilGuards();e.d3d_software_free(d.ctx);cases++;
    }
  }
  for(const [state,options,expected,count]of [
    [{func:1,fail:3},{},17,0n],
    [{zfail:3},{initialDepth:0},17,0n],
    [{zfail:3,pass:4},{initialDepth:0,flags:0},10,36n],
    [{writeMask:15,ref:0xab,pass:3,initial:0xd0},{},0xdb,36n],
    [{ref:0x109,readMask:0x10ff,func:3},{},9,36n],
    [{twoSided:true,pass:4,ccwPass:5},{},10,36n],
    [{twoSided:true,reverse:true,pass:4,ccwPass:5},{},8,36n],
    [{twoSided:true,reverse:true,ccwFunc:1,ccwFail:3},{},17,0n],
  ]){
    const d=stencilDraw(options,state);d.run();assert.strictEqual(d.stencil(),expected);
    assert.strictEqual(e.d3d_software_samples(d.ctx),count);d.guards();d.stencilGuards();e.d3d_software_free(d.ctx);cases++;
  }
  for(let func=1;func<=8;func++)for(const ref of [8,9,10]){
    const pass=[false,false,ref<9,ref===9,ref<=9,ref>9,ref!==9,ref>=9,true][func];
    const d=stencilDraw({}, {func,ref,fail:2});d.run();
    assert.strictEqual(e.d3d_software_samples(d.ctx),pass?36n:0n);e.d3d_software_free(d.ctx);cases++;
  }
  {
    const d=stencilDraw({}, {pass:3}),ad=alloc(16);u32.set([1,1,1,0],ad/4);
    assert(e.d3d_software_bind_alpha(d.ctx,ad));d.run();assert.strictEqual(d.stencil(),9,'alpha rejection does not mutate stencil');
    assert.strictEqual(e.d3d_software_samples(d.ctx),0n);e.d3d_software_free(d.ctx);cases++;
  }
  {
    const d=stencilDraw({}, {pass:3}),saved=u32.slice(d.sd/4,d.sd/4+16);
    for(const [index,value]of[[0,2],[1,4],[2,0],[3,7],[7,0],[8,9],[10,9],[14,0],[15,1]]){
      u32.set(saved,d.sd/4);u32[d.sd/4+index]=value;
      assert.strictEqual(e.d3d_software_bind_stencil(d.ctx,d.sd),0,'invalid descriptor rejects without replacing prior state');cases++;
    }
    d.run();assert.strictEqual(d.stencil(),17);d.stencilGuards();e.d3d_software_free(d.ctx);
  }
  assert.strictEqual(e.d3d_software_samples(0),-1n,'invalid counter context rejected');
  for(const [options,count] of [[{},36n],[{mask:0,flags:0},36n],
    [{initialDepth:0},0n],[{initialDepth:0,flags:0},36n]]){
    const d=draw(triangle,options);assert.ok(d.ctx);
    assert.strictEqual(e.d3d_software_samples(d.ctx),-1n,'unexecuted draw cannot publish samples');
    assert.strictEqual(e.d3d_software_step(d.ctx,1),1);
    assert.strictEqual(e.d3d_software_samples(d.ctx),-1n,'partial draw cannot publish samples');
    d.run(1);assert.strictEqual(e.d3d_software_samples(d.ctx),count);
    assert.strictEqual(e.d3d_software_step(d.ctx,1),0);
    assert.strictEqual(e.d3d_software_samples(d.ctx),count,'completion polling never double-counts');
    d.guards();e.d3d_software_free(d.ctx);cases++;
  }
  {
    const d=draw([...triangle,...triangle],{mask:0,flags:0});d.run(1);
    assert.strictEqual(e.d3d_software_samples(d.ctx),72n,'overdraw counts samples, not distinct pixels');
    d.guards();e.d3d_software_free(d.ctx);cases++;
  }
  for(const format of [70,80,75,77]){
    const scale=format===70||format===80?65535:16777215;
    for(const z of [0,.1,.5,.99999,1]){
      const expected=Math.fround(Math.floor(Math.fround(z)*scale+.5)/scale);
      assert.strictEqual(e.d3d_software_quantize_depth(format,z),expected);
      const d=draw(triangle.map(v=>[v[0],v[1],Math.fround(z),v[3],...v.slice(4)]),{depthFunc:8});
      assert.strictEqual(e.d3d_software_bind_depth_format(d.ctx,format),1);
      assert.strictEqual(e.d3d_software_bind_depth_format(d.ctx,99),0,'invalid format leaves binding unchanged');
      d.run();assert.strictEqual(d.depthAt(0,0),expected,'native raster stores quantized depth');
      assert.strictEqual(e.d3d_software_bind_depth_format(d.ctx,format),0,'late format binding rejects');
      d.guards();e.d3d_software_free(d.ctx);cases++;
    }
  }
  for(const width of [7,8])for(const reject of ['coverage','depth','discard']) {
    const texPS=program([0xffff0101,...(reject==='discard'?[65,0xb00f0000]:[]),66,0xb00f0000,1,0x800f0000,0xb0e40000,0xffff]);
    const offset=reject==='discard'?-.5:0,span=width*.5;
    const vertices=[vertex(-1,1,.5,1,red,[offset,0,0,1]),vertex(1,1,.5,1,red,[offset+span,0,0,1]),vertex(-1,-1,.5,1,red,[offset,4,0,1])];
    const reference=draw(vertices,{width}),d=draw(vertices,{width,ps:texPS});
    const table=alloc(48),desc=alloc(64);
    for(let level=0;level<3;level++) {
      const size=4>>level,pixels=alloc(size*size*4),color=[red,green,blue][level];
      for(let i=0;i<size*size;i++)u8.set(color.map(c=>c*255),pixels+i*4);
      u32.set([pixels,size,size,size*4],table/4+level*4);
    }
    u32.set([1,3,table,0,3,3,0,1,1,1,0,0,0,4,4,0],desc/4);
    assert.strictEqual(e.d3d_software_bind_texture_mips(d.ctx,0,desc),1);
    u32.fill(0,desc/4,desc/4+16);u32.fill(0,table/4,table/4+12);
    if(reject==='depth')f32[(d.depth+4)/4]=0; // helper beside covered (0,0)
    reference.run(1);d.run(1);
    for(let y=0;y<8;y++)for(let x=0;x<width;x++) {
      const covered=reference.pixel(x,y)!==0xff000000;
      const rejected=reject==='depth'&&x===1&&y===0||reject==='discard'&&x===0;
      assert.strictEqual(d.pixel(x,y),covered&&!rejected?0xff00ff00:0xff000000,
        `mip helper ${reject} ${width}x8 at${x},${y}`);
      assert.strictEqual(d.depthAt(x,y),reject==='depth'&&x===1&&y===0?0:covered&&!rejected?.5:1,
        'helper/discard lanes never write depth');
    }
    assert.strictEqual(e.d3d_software_bind_texture_mips(d.ctx,0,0),0,'no mip rebinding after execution');
    d.guards();reference.guards();e.d3d_software_free(d.ctx);e.d3d_software_free(reference.ctx);e.d3d_shader_vm_free(texPS);cases++;
  }
  {
    const texPS=program([0xffff0101,66,0xb00f0000,1,0x800f0000,0xb0e40000,0xffff]);
    const vertices=[vertex(-1,1,.5,1,red,[0,0,0,1]),vertex(1,1,.5,2,red,[4,0,0,1]),vertex(-1,-1,.5,4,red,[0,4,0,1])];
    const d=draw(vertices,{ps:texPS}),reference=draw(vertices),table=alloc(48),desc=alloc(64);
    for(let level=0;level<3;level++) {
      const size=4>>level,p=alloc(size*size*4);
      for(let i=0;i<size*size;i++)u8.set([red,green,blue][level].map(v=>v*255),p+i*4);
      u32.set([p,size,size,size*4],table/4+level*4);
    }
    u32.set([1,3,table,0,1,1,0,2,1,2,0,0,0,4,4,0],desc/4);
    assert.strictEqual(e.d3d_software_bind_texture_mips(d.ctx,0,desc),1);d.run(1);reference.run(3);
    // Analytic perspective interpolation, then independent adjacent-pixel
    // differences. No WAT registers/LOD values are read as the expected result.
    const uv=(x,y)=>{const b=x/8,c=y/8,den=1-b-c+b/2+c/4;return[2*b/den,c/den];};
    for(let y=0;y<8;y++)for(let x=0;x<8;x++) {
      if(reference.pixel(x,y)===0xff000000){assert.strictEqual(d.pixel(x,y),0xff000000);continue;}
      const p=uv(x,y),qx=uv(x^1,y),qy=uv(x,y^1);
      const rho=Math.max(Math.hypot((p[0]-qx[0])*4,(p[1]-qx[1])*4),Math.hypot((p[0]-qy[0])*4,(p[1]-qy[1])*4));
      const lod=Math.min(2,Math.max(0,Math.log2(rho))),level=Math.floor(lod),f=lod-level;
      const expected=[red,green,blue][level].map((v,c)=>Math.round((v*(1-f)+[red,green,blue][Math.min(2,level+1)][c]*f)*255));
      const pixel=d.pixel(x,y),actual=[pixel>>>16&255,pixel>>>8&255,pixel&255,pixel>>>24];
      actual.forEach((v,c)=>assert.ok(Math.abs(v-expected[c])<=1,`perspective implicit LOD ${x},${y} component${c}: ${v} vs${expected[c]}`));
    }
    d.guards();reference.guards();e.d3d_software_free(d.ctx);e.d3d_software_free(reference.ctx);e.d3d_shader_vm_free(texPS);cases++;
  }
  // Independent scalar blend oracle; the shipping path is WAT SIMD.
  const unpack=n=>[n>>>16&255,n>>>8&255,n&255,n>>>24].map(n=>n/255);
  const factor=(kind,s,d,k)=>{
    const one=[1,1,1,1],inv=a=>a.map(x=>1-x);
    return ({1:[0,0,0,0],2:one,3:s,4:inv(s),5:one.map(()=>s[3]),
      6:one.map(()=>1-s[3]),7:one.map(()=>d[3]),8:one.map(()=>1-d[3]),
      9:d,10:inv(d),11:[...one.slice(0,3).map(()=>Math.min(s[3],1-d[3])),1],
      14:k,15:inv(k)})[kind];
  };
  const blend=(s,d,k,src,dst,op)=>{
    if(src===12){src=5;dst=6;}else if(src===13){src=6;dst=5;}
    const a=factor(src,s,d,k),b=factor(dst,s,d,k);
    return s.map((v,i)=>Math.max(0,Math.min(1,
      op===4?Math.min(v,d[i]):op===5?Math.max(v,d[i]):
      op===2?v*a[i]-d[i]*b[i]:op===3?d[i]*b[i]-v*a[i]:v*a[i]+d[i]*b[i])));
  };
  const source=[.2,.4,.6,.8],destination=0x80402010,blendConstant=0x4080c020;
  const blendTriangle=[vertex(-1,1,.5,1,source),vertex(1,1,.5,1,source),vertex(-1,-1,.5,1,source)];
  const blendStates=[];
  for(let f=1;f<=15;f++){
    blendStates.push([1,f,2,1,2,1,1]);
    if(f!==12&&f!==13)blendStates.push([1,2,f,1,2,1,1]);
  }
  for(let op=1;op<=5;op++)blendStates.push([3,5,6,op,2,1,6-op]);
  for(const state of blendStates){
    const d=draw(blendTriangle,{initialColor:destination});assert(d.ctx);
    const binding=alloc(36);u32.set([1,...state,blendConstant],binding/4);
    assert.strictEqual(e.d3d_software_bind_blend(d.ctx,binding),1);
    u32.fill(0,binding/4,binding/4+9); // all state must already be owned
    d.run(1);
    const expected=blend(source,unpack(destination),unpack(blendConstant),...state.slice(1,4));
    if(state[0]&2)expected[3]=blend(source,unpack(destination),unpack(blendConstant),...state.slice(4,7))[3];
    const actual=unpack(d.pixel(1,1));
    actual.forEach((v,i)=>assert(Math.abs(Math.round(v*255)-Math.round(expected[i]*255))<=1,
      `blend ${state} channel${i}: ${v} vs ${expected[i]}`));
    assert.strictEqual(d.pixel(7,7),destination,'uncovered blend pixels unchanged');
    assert.strictEqual(e.d3d_software_bind_blend(d.ctx,binding),0,'no late state changes');
    d.guards();e.d3d_software_free(d.ctx);cases++;
  }
  {
    const d=draw(blendTriangle,{initialColor:destination,mask:1}),binding=alloc(36);
    u32.set([1,1,2,1,1,2,1,1,0],binding/4);
    assert.strictEqual(e.d3d_software_bind_blend(d.ctx,binding),1);
    for(const [word,value] of [[0,2],[1,4],[2,16],[3,12],[4,0],[5,0],[6,13],[7,6]]){
      const old=u32[binding/4+word];u32[binding/4+word]=value;
      assert.strictEqual(e.d3d_software_bind_blend(d.ctx,binding),0,'invalid blend preserves prior state');
      u32[binding/4+word]=old;
    }
    d.run();assert.strictEqual(d.pixel(1,1),0x80332010,'blend respects final RGBA write mask');
    d.guards();e.d3d_software_free(d.ctx);cases++;
  }
  for(const options of [{initialDepth:.1},{mask:0}]){
    const d=draw(blendTriangle,{initialColor:destination,...options}),binding=alloc(36);
    u32.set([1,3,2,2,1,2,2,1,blendConstant],binding/4);
    assert.strictEqual(e.d3d_software_bind_blend(d.ctx,binding),1);
    assert.strictEqual(e.d3d_software_step(d.ctx,1),1);
    assert.strictEqual(e.d3d_software_bind_blend(d.ctx,binding),0,'binding rejects partially executed draw');
    d.run();
    for(let y=0;y<8;y++)for(let x=0;x<8;x++)assert.strictEqual(d.pixel(x,y),destination,
      'depth rejection or zero write mask prevents blended writes');
    d.guards();e.d3d_software_free(d.ctx);cases++;
  }
  {
    const d=draw(triangle,{constant:[.5,1,1,1]});assert.ok(d.ctx,'real programmable triangle created');
    assert.strictEqual(e.d3d_software_step(d.ctx,0),1);assert.strictEqual(d.pixel(0,0),0xff000000);
    const steps=d.run(1);assert.ok(steps>1,'resumable quad work');
    for(let y=0;y<8;y++)for(let x=0;x<8;x++)assert.strictEqual(d.pixel(x,y),x+y<8?0xff800000:0xff000000,`coverage ${x},${y}`);
    assert.strictEqual(d.depthAt(1,1),.5);assert.strictEqual(d.depthAt(7,7),1);
    d.guards();e.d3d_software_free(d.ctx);cases++;
  }
  {
    const d=draw(triangle,{initialDepth:.25});assert.ok(d.ctx);d.run();
    for(let y=0;y<8;y++)for(let x=0;x<8;x++){assert.strictEqual(d.pixel(x,y),0xff000000);assert.strictEqual(d.depthAt(x,y),.25);}
    d.guards();e.d3d_software_free(d.ctx);cases++;
  }
  {
    const d=draw(triangle,{mask:1,initialColor:0x12345678});assert.ok(d.ctx);d.run();
    assert.strictEqual(d.pixel(1,1),0x12ff5678,'only red channel written');d.guards();e.d3d_software_free(d.ctx);cases++;
  }
  {
    const d=draw([vertex(-1,1,.5,1,red),vertex(1,1,.5,2,green),vertex(-1,-1,.5,4,blue)]);assert.ok(d.ctx);d.run();
    // At screen (2,2), screen weights .5/.25/.25 become perspective weights
    // 8/11,2/11,1/11. This differs substantially from affine RGB interpolation.
    const expected=(0xff000000|(Math.round(255*8/11)<<16)|(Math.round(255*2/11)<<8)|Math.round(255/11))>>>0;
    assert.strictEqual(d.pixel(2,2),expected);d.guards();e.d3d_software_free(d.ctx);cases++;
  }
  {
    const vertices=[vertex(-1,1,.5,1,red),vertex(1,1,.5,1,red),vertex(-1,-1,.5,1,red),vertex(1,-1,.5,1,green),vertex(-1,-1,.5,1,green),vertex(1,1,.5,1,green)];
    const d=draw(vertices,{width:7,height:5});assert.ok(d.ctx);d.run();
    for(let y=0;y<5;y++)for(let x=0;x<7;x++)assert.notStrictEqual(d.pixel(x,y),0xff000000,'adjacent triangles fill odd dimensions without cracks');
    d.guards();e.d3d_software_free(d.ctx);cases++;
  }
  {
    const first=draw(triangle),second=draw([vertex(1,-1),vertex(-1,-1),vertex(1,1)]);
    assert.ok(first.ctx&&second.ctx);first.run();second.run();
    for(let y=0;y<8;y++)for(let x=0;x<8;x++){
      const n=Number(first.pixel(x,y)!==0xff000000)+Number(second.pixel(x,y)!==0xff000000);
      assert.strictEqual(n,1,`exactly one owner for shared-edge sample ${x},${y}`);
    }
    first.guards();second.guards();e.d3d_software_free(first.ctx);e.d3d_software_free(second.ctx);cases++;
  }
  for(let fn=1;fn<=8;fn++)for(const old of [.25,.5,.75]){
    const d=draw(triangle,{initialDepth:old,depthFunc:fn});assert.ok(d.ctx);d.run();
    const pass=[false,false,.5<old,.5===old,.5<=old,.5>old,.5!==old,.5>=old,true][fn];
    assert.strictEqual(d.pixel(1,1),pass?0xffff0000:0xff000000,`depth comparison ${fn}, ${old}`);
    assert.strictEqual(d.depthAt(1,1),pass?.5:old);d.guards();e.d3d_software_free(d.ctx);cases++;
  }
  {
    const d=draw(triangle,{flags:1,initialDepth:.75});assert.ok(d.ctx);d.run();
    assert.strictEqual(d.pixel(1,1),0xffff0000);assert.strictEqual(d.depthAt(1,1),.75,'depth write disabled');e.d3d_software_free(d.ctx);cases++;
  }
  {
    const d=draw(triangle,{flags:0,initialDepth:.25});assert.ok(d.ctx);d.run();
    assert.strictEqual(d.pixel(1,1),0xffff0000);assert.strictEqual(d.depthAt(1,1),.25,'depth disabled does not compare or write');e.d3d_software_free(d.ctx);cases++;
  }
  {
    const d=draw(triangle,{vx:1,vy:1,vw:5,vh:3,minZ:.2,maxZ:.6});assert.ok(d.ctx);d.run();
    assert.strictEqual(d.pixel(1,1),0xffff0000);assert.ok(Math.abs(d.depthAt(1,1)-.4)<1e-6);
    for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(x<1||x>=6||y<1||y>=4)assert.strictEqual(d.pixel(x,y),0xff000000,'viewport clips partial quads');
    d.guards();e.d3d_software_free(d.ctx);cases++;
  }
  {
    const d=draw(triangle,{indices:[0,1,2]});assert.ok(d.ctx);
    u8.fill(0,d.input,d.input+144);u16.fill(65535,d.indexPtr/2,d.indexPtr/2+3);f32.fill(0,d.constants/4,d.constants/4+4);u32.fill(0,d.desc/4,d.desc/4+32);
    d.run();assert.strictEqual(d.pixel(1,1),0xffff0000,'creation snapshots guest inputs/constants/indices/descriptor');d.guards();e.d3d_software_free(d.ctx);cases++;
  }
  // A non-finite clip position is dropped, not rejected: the draw runs, the
  // triangles referencing the bad vertex rasterize nothing, and the rest of
  // the draw is unaffected. Refusing the whole draw was fatal in practice --
  // the render queue's error is sticky, so Black & White 2 lost every frame
  // after the first NaN its own geometry contained.
  for(const vertices of [[vertex(NaN,1),triangle[1],triangle[2]],[vertex(-1,1,.5,Infinity),triangle[1],triangle[2]]]){
    const d=draw(vertices);assert.notStrictEqual(d.ctx,0,'nonfinite clip position does not fail creation');
    d.run();
    for(let y=0;y<8;y++)for(let x=0;x<8;x++)assert.strictEqual(d.pixel(x,y),0xff000000,'and leaves the target alone');
    d.guards();e.d3d_software_free(d.ctx);cases++;
  }
  {
    const d=draw(triangle,{cull:2});assert.ok(d.ctx);d.run();assert.strictEqual(d.pixel(1,1),0xff000000,'clockwise culled');e.d3d_software_free(d.ctx);cases++;
  }
  {
    const d=draw(triangle);assert.ok(d.ctx);e.d3d_software_cancel(d.ctx);assert.strictEqual(e.d3d_software_step(d.ctx,100),-2);assert.strictEqual(d.pixel(1,1),0xff000000);e.d3d_software_free(d.ctx);cases++;
  }
  {
    const mapped=program([0xfffe0101,1,0xc00f0000,0x90e40000,1,0xd00f0000,0x90e40005,1,0xe00f0000,0x90e40007,0xffff]);
    const d=draw(triangle,{vs:mapped,inputMap:0x750});assert.ok(d.ctx);d.run();assert.strictEqual(d.pixel(1,1),0xffff0000,'real FVF v0/v5/v7 inputs');
    e.d3d_software_free(d.ctx);e.d3d_shader_vm_free(mapped);cases++;
  }
  {
    const d=draw(triangle);assert.ok(d.ctx);
    assert.strictEqual(e.d3d_software_clear(d.color,d.width,d.height,d.pitch,0xff123456,d.depth,d.pitch,.75,3),0);
    for(let y=0;y<8;y++)for(let x=0;x<8;x++){assert.strictEqual(d.pixel(x,y),0xff123456);assert.strictEqual(d.depthAt(x,y),.75);}
    assert.strictEqual(e.d3d_software_clear(d.color+4+d.pitch,3,2,d.pitch,0xffabcdef,0,0,NaN,1),0);
    assert.strictEqual(d.pixel(1,1),0xffabcdef);assert.strictEqual(d.pixel(0,1),0xff123456);assert.strictEqual(d.depthAt(1,1),.75);
    assert.strictEqual(e.d3d_software_clear(d.color,8,8,d.pitch,0,d.depth,d.pitch,NaN,3),-1,'invalid depth refuses entireclear');
    assert.strictEqual(d.pixel(1,1),0xffabcdef);d.guards();e.d3d_software_free(d.ctx);cases++;
  }
  {
    const textured=program([0xffff0101,66,0xb00f0000,5,0x800f0000,0xb0e40000,0x90e40000,0xffff]);
    const white=[1,1,1,1],verts=[vertex(-1,1,.5,1,white,[.75,.25,0,1]),vertex(1,1,.5,1,white,[.75,.25,0,1]),vertex(-1,-1,.5,1,white,[.75,.25,0,1])];
    const d=draw(verts,{ps:textured});assert.ok(d.ctx);
    const pixels=alloc(16);u8.set([255,0,0,255,0,255,0,255,0,0,255,255,255,255,255,255],pixels);
    const sampler=alloc(36);u32.set([pixels,2,2,8,0,3,3,1,0],sampler/4);
    assert.strictEqual(e.d3d_software_bind_texture(d.ctx,0,sampler),1);
    u32.fill(0,sampler/4,sampler/4+9);
    d.run();assert.strictEqual(d.pixel(1,1),0xff00ff00,'actual TEX/MUL programmable triangle samples boundtexture');
    assert.strictEqual(e.d3d_software_bind_texture(d.ctx,0,0),0,'completed draw binding immutable');d.guards();e.d3d_software_free(d.ctx);e.d3d_shader_vm_free(textured);cases++;
  }
  {
    const killed=program([0xffff0101,65,0xb00f0000,1,0x800f0000,0x90e40000,0xffff]);
    const verts=[vertex(-1,1,.5,1,red,[-1,0,0,1]),vertex(1,1,.5,1,red,[-1,0,0,1]),vertex(-1,-1,.5,1,red,[-1,0,0,1])];
    const d=draw(verts,{ps:killed});assert.ok(d.ctx);d.run();assert.strictEqual(d.pixel(1,1),0xff000000,'TEXKILL prevents colorwrite');assert.strictEqual(d.depthAt(1,1),1,'TEXKILL prevents depthwrite');
    d.guards();e.d3d_software_free(d.ctx);e.d3d_shader_vm_free(killed);cases++;
  }
  function compareClipped(input,reference,label,options={}){
    const actual=draw(input,options),expected=draw(reference,options);
    assert.ok(actual.ctx,`${label} accepted`);assert.ok(expected.ctx);actual.run(1);expected.run(7);
    for(let y=0;y<actual.height;y++)for(let x=0;x<actual.width;x++){
      assert.strictEqual(actual.pixel(x,y),expected.pixel(x,y),`${label} pixel ${x},${y}`);
      assert.ok(Math.abs(actual.depthAt(x,y)-expected.depthAt(x,y))<1e-6,`${label} depth ${x},${y}`);
    }
    actual.guards();expected.guards();e.d3d_software_free(actual.ctx);e.d3d_software_free(expected.ctx);cases++;
  }
  // Independently constructed geometric intersections, not a second copy of
  // the clipping algorithm. Both sides/top/bottom clip before perspective divide.
  compareClipped([vertex(-2,1),vertex(1,1),vertex(-1,-1)],triangle,'left plane');
  compareClipped([vertex(-1,1),vertex(2,1),vertex(1,-1)],
    [vertex(-1,1),vertex(1,1),vertex(1,-1)],'right plane');
  compareClipped([vertex(-1,2),vertex(1,1),vertex(-1,-1)],triangle,'top plane');
  compareClipped([vertex(-1,1),vertex(1,-1),vertex(-1,-2)],
    [vertex(-1,1),vertex(1,-1),vertex(-1,-1)],'bottom plane');
  for(const [outside,plane,label] of [[-.5,0,'near'],[1.5,1,'far']]){
    const a=vertex(-1,1,outside,1,red),b=vertex(1,1,.5,1,green),c=vertex(-1,-1,.5,1,blue);
    const ca=vertex(-1,0,plane,1,[.5,0,.5,1]),ab=vertex(0,1,plane,1,[.5,.5,0,1]);
    compareClipped([a,b,c],[ca,ab,b,ca,b,c],`${label} plane attributes/depth`);
  }
  // Homogeneous clipping: intersection weights use clip distances, not screen
  // positions. Near intersection A(w=1,z=-1)->B(w=2,z=1) is t=.5,w=1.5.
  {
    const a=vertex(-1,1,-1,1,red),b=vertex(1,1,.5,2,green),c=vertex(-1,-1,.5,2,blue);
    const ca=[-1.5,-.5,0,1.5,.5,0,.5,1,0,0,0,1];
    const ab=[.5,1.5,0,1.5,.5,.5,0,1,0,0,0,1];
    compareClipped([a,b,c],[ca,ab,b,ca,b,c],'perspective near clipping');
  }
  for(const vertices of [triangle.map(v=>[v[0]-4,...v.slice(1)]),triangle.map(v=>[v[0],v[1],-1,...v.slice(3)]),triangle.map(v=>[v[0],v[1],2,...v.slice(3)]),triangle.map(v=>[v[0],v[1],-.5,-1,...v.slice(4)])]){
    const d=draw(vertices);assert.ok(d.ctx,'fully clipped draw is valid');d.run(1);
    for(let y=0;y<8;y++)for(let x=0;x<8;x++){assert.strictEqual(d.pixel(x,y),0xff000000);assert.strictEqual(d.depthAt(x,y),1);}
    d.guards();e.d3d_software_free(d.ctx);cases++;
  }
  {
    const d=draw([vertex(-1,1,.5,0),triangle[1],triangle[2]]);assert.ok(d.ctx,'homogeneous origin does not divide by zero');d.run();
    for(let y=0;y<8;y++)for(let x=0;x<8;x++)assert.strictEqual(d.pixel(x,y),0xff000000,'zero homogeneous vertex plus two points projects to zero area');
    d.guards();e.d3d_software_free(d.ctx);cases++;
  }
  {
    const first=draw([vertex(-2,2),vertex(2,2),vertex(-2,-2)]);
    const second=draw([vertex(2,-2),vertex(-2,-2),vertex(2,2)]);
    assert.ok(first.ctx&&second.ctx);first.run(1);second.run(5);
    for(let y=0;y<8;y++)for(let x=0;x<8;x++)assert.strictEqual(
      Number(first.pixel(x,y)!==0xff000000)+Number(second.pixel(x,y)!==0xff000000),1,
      `clipped shared-edge single owner ${x},${y}`);
    first.guards();second.guards();e.d3d_software_free(first.ctx);e.d3d_software_free(second.ctx);cases++;
  }
  {
    const behind=[0,0,-.5,-1,...red,0,0,0,1],b=vertex(-.5,-.5),c=vertex(.5,-.5);
    const ca=vertex(1,-1,.5,1/3),ab=vertex(-1,-1,.5,1/3);
    compareClipped([behind,b,c],[ca,ab,b,ca,b,c],'negative W crossing');
  }
  {
    const onEye=[0,.5,-.5,0,...red,0,0,0,1],b=vertex(-.5,-.5),c=vertex(.5,-.5);
    const ca=vertex(.5,0,0,.5),ab=vertex(-.5,0,0,.5);
    compareClipped([onEye,b,c],[ca,ab,b,ca,b,c],'nonzero vertex on W=0');
  }
  {
    const uv=program([0xffff0101,64,0xb00f0000,1,0x800f0000,0xb0e40000,0xffff]);
    const a=vertex(-1,1,-1,1,red,[0,0,0,1]),b=vertex(1,1,.5,2,red,[1,0,0,1]),c=vertex(-1,-1,.5,2,red,[0,1,0,1]);
    const ca=[-1.5,-.5,0,1.5,...red,0,.5,0,1],ab=[.5,1.5,0,1.5,...red,.5,0,0,1];
    compareClipped([a,b,c],[ca,ab,b,ca,b,c],'perspective UV clipping',{ps:uv});e.d3d_shader_vm_free(uv);
  }
  {
    const verts=[vertex(-2,2),vertex(2,2),vertex(0,-2)];
    const d=draw(verts,{indices:Array.from({length:768},(_,i)=>i%3),width:3,height:3});assert.ok(d.ctx,'maximum input index budget with generated fan geometry');
    assert.ok(u32[(d.ctx+48)/4]>768,'clipping really expands input triangles');d.run(17);
    assert.strictEqual(d.pixel(1,1),0xffff0000);d.guards();e.d3d_software_free(d.ctx);cases++;
  }
  for(const options of [{indices:[0,1,65535]},{indices:Array.from({length:771},(_,i)=>i%3)},{inputMap:0x777}]){
    const d=draw(triangle,options);assert.strictEqual(d.ctx,0,'invalid indices/count/linkage reject before allocation writes');
    assert.strictEqual(d.pixel(1,1),0xff000000);d.guards();cases++;
  }
  {
    // Two triangles, the second carrying a NaN. The bad one is dropped and the
    // GOOD one still draws -- which is the point of per-vertex marking over a
    // whole-draw refusal, and the opposite of what this case used to assert.
    const d=draw([...triangle,vertex(-1,1),vertex(1,1),vertex(NaN,-1)]);
    assert.notStrictEqual(d.ctx,0,'one bad vertex does not fail the draw');
    d.run();
    assert.strictEqual(d.pixel(1,1),0xffff0000,'the finite triangle still rasterizes');
    d.guards();e.d3d_software_free(d.ctx);cases++;
  }
  {
    const tokens=[0xfffe0101,1,0xc00f0000,0x90e40000,1,0xd00f0000,0x90e40001];
    for(let stage=0;stage<4;stage++)tokens.push(1,0xe00f0000+stage,0x90e40002+stage);
    tokens.push(0xffff);const multiVS=program(tokens);
    const signedPixels=alloc(4);u8.set([64,224,128,0],signedPixels);
    const sourceSampler=alloc(36);u32.set([signedPixels,1,1,4,62,3,3,1,0],sourceSampler/4);
    const image=alloc(64);
    for(let y=0;y<4;y++)for(let x=0;x<4;x++)u8.set([x*40,y*60,200,255],image+(y*4+x)*4);
    const targetSampler=alloc(36);u32.set([image,4,4,16,0,3,3,1,0],targetSampler/4);
    const gradients=[[.15,.2,0,1],[.65,.35,0,1],[.3,.8,0,1]];
    for(const stage of [1,2,3])for(const luminance of [false,true])for(const clipped of [false,true]){
      const uvCount=stage+1,stride=32+uvCount*16,extraMap=0x543&((1<<(stage*4))-1);
      const bumpPS=program([0xffff0101,66,0xb00f0000,luminance?68:67,0xb00f0000+stage,0xb0e40000,
        1,0x800f0000,0xb0e40000+stage,0xffff]);
      const verts=[vertex(-1,1,clipped?-.5:.5,1),vertex(1,1,.5,2),vertex(-1,-1,.5,4)].map((v,i)=>{
        const result=v.slice(0,8);
        for(let t=0;t<uvCount;t++)result.push(...(t===stage?gradients[i]:[.9,.1,0,1]));
        return result;
      });
      const d=draw(verts,{abi:2,uvCount,extraMap,stride,vs:multiVS,ps:bumpPS,width:7,height:5});
      assert.ok(d.ctx,'multi-UV bump pipeline created');
      assert.strictEqual(e.d3d_software_bind_texture(d.ctx,0,sourceSampler),1);
      assert.strictEqual(e.d3d_software_bind_texture(d.ctx,stage,targetSampler),1);
      const bump=alloc(28);u32[bump/4]=1;f32.set([.1,.2,.3,.4,.5,.1],bump/4+1);
      assert.strictEqual(e.d3d_software_bind_bump(d.ctx,stage,bump),1);
      u8.fill(0,bump,bump+28);u8.fill(0,d.input,d.input+verts.length*stride);
      u32.fill(0,d.desc/4,d.desc/4+32);
      assert.strictEqual(e.d3d_software_step(d.ctx,1),1);
      assert.strictEqual(e.d3d_software_bind_bump(d.ctx,stage,0),0,'yielded draw coefficient snapshot is immutable');
      d.run(1);
      for(let y=0;y<5;y++)for(let x=0;x<7;x++){
        const b=x/7,c=y/5,a=1-b-c;
        const covered=a>0&&(!clipped||a<=.5);
        if(!covered){assert.strictEqual(d.pixel(x,y),0xff000000);assert.strictEqual(d.depthAt(x,y),1);continue;}
        const denominator=a+b/2+c/4;
        const u=(a*gradients[0][0]+b/2*gradients[1][0]+c/4*gradients[2][0])/denominator;
        const v=(a*gradients[0][1]+b/2*gradients[1][1]+c/4*gradients[2][1])/denominator;
        const sampledX=Math.min(3,Math.max(0,Math.floor((u+.1*64/127+.3*(-32/127))*4)));
        const sampledY=Math.min(3,Math.max(0,Math.floor((v+.2*64/127+.4*(-32/127))*4)));
        const factor=luminance?(128/255*.5+.1):1;
        const expected=((Math.round(255*factor)<<24)|(Math.round(sampledX*40*factor)<<16)|
          (Math.round(sampledY*60*factor)<<8)|Math.round(200*factor))>>>0;
        assert.strictEqual(d.pixel(x,y),expected,`TEXBEM${luminance?'L':''} t${stage} clip=${clipped} pixel ${x},${y}`);
        assert.ok(Math.abs(d.depthAt(x,y)-(clipped?.5-a:.5))<1e-6,'bump fragments retain depth');
      }
      d.guards();e.d3d_software_free(d.ctx);e.d3d_shader_vm_free(bumpPS);cases++;
    }
    for(const options of [
      {abi:1,uvCount:2},{abi:2},{abi:2,uvCount:5},
      {abi:2,uvCount:2,extraMap:3}, // insufficient input stride
      {abi:2,uvCount:2,extraMap:0x13,stride:64}, // unused mapping bits
      {abi:2,uvCount:2,extraMap:1,stride:64}, // aliases color
      {abi:2,uvCount:4,extraMap:0x553,stride:96}, // duplicate extra input
    ]){
      const d=draw(triangle,options);assert.strictEqual(d.ctx,0,'bad versioned UV layout rejects');
      assert.strictEqual(d.pixel(1,1),0xff000000);d.guards();cases++;
    }
    const one=draw(triangle,{abi:2,uvCount:1});assert.ok(one.ctx);one.run();
    assert.strictEqual(one.pixel(1,1),0xffff0000,'ABI2 single UV preserves default48-byte input');
    one.guards();e.d3d_software_free(one.ctx);cases++;
    e.d3d_shader_vm_free(multiVS);
  }
  function alphaDescriptor(enabled,func,reference){
    const p=alloc(16);u32.set([1,enabled,func,reference],p/4);return p;
  }
  for(let func=1;func<=8;func++)for(const alpha of [127,128,129]){
    const d=draw(triangle,{constant:[1,1,1,alpha/255],initialDepth:.75});assert.ok(d.ctx);
    const descriptor=alphaDescriptor(1,func,0xdead0080);
    assert.strictEqual(e.d3d_software_bind_alpha(d.ctx,descriptor),1);
    u32.fill(0,descriptor/4,descriptor/4+4);d.run(1);
    const pass=[false,false,alpha<128,alpha===128,alpha<=128,alpha>128,alpha!==128,alpha>=128,true][func];
    assert.strictEqual(d.pixel(0,0),pass?((alpha<<24)|0xff0000)>>>0:0xff000000,`alpha compare${func} source${alpha} ref low8`);
    assert.strictEqual(d.depthAt(0,0),pass?.5:.75,'alpha rejection suppresses depth writes');
    assert.strictEqual(d.pixel(7,7),0xff000000);d.guards();e.d3d_software_free(d.ctx);cases++;
  }
  // Exact f32 threshold policy: no additional 8-bit source-alpha quantization.
  // Sub-UNORM8 native hardware parity remains an explicit reference gate.
  for(const [alpha,func,ref]of[[127.75/255,2,128],[128.25/255,5,128],[-1,3,0],[2,3,255],[0,3,0],[1,3,255]]){
    const d=draw(triangle,{constant:[1,1,1,alpha]});assert.ok(d.ctx);
    assert.strictEqual(e.d3d_software_bind_alpha(d.ctx,alphaDescriptor(1,func,ref)),1);d.run();
    assert.strictEqual(d.depthAt(0,0),.5,'alpha boundary/clamp passes chosen comparison');
    d.guards();e.d3d_software_free(d.ctx);cases++;
  }
  {
    const d=draw(triangle,{constant:[1,1,1,.25],initialColor:0x12345678,initialDepth:.75});assert.ok(d.ctx);
    const blend=alloc(36);u32.set([1,1,2,2,1,2,1,1,0xffffffff],blend/4);
    assert.strictEqual(e.d3d_software_bind_blend(d.ctx,blend),1);
    const valid=alphaDescriptor(1,1,0);assert.strictEqual(e.d3d_software_bind_alpha(d.ctx,valid),1);
    const saved=u32[(d.ctx+204)/4];
    for(const words of [[2,1,1,0],[1,2,1,0],[1,1,0,0],[1,1,9,0]]){
      const bad=alloc(16);u32.set(words,bad/4);assert.strictEqual(e.d3d_software_bind_alpha(d.ctx,bad),0);
      assert.strictEqual(u32[(d.ctx+204)/4],saved,'invalid alpha binding cannot replace existing state');
    }
    assert.strictEqual(e.d3d_software_bind_alpha(d.ctx,memory.buffer.byteLength-8),0,'descriptor extent checked');
    assert.strictEqual(e.d3d_software_step(d.ctx,1),1);
    const vm=u32[(d.ctx+148)/4];
    assert.strictEqual(u32[(vm+16)/4],15,'alpha test does not disable shader quad lanes');
    assert(u32[(vm+20)/4]>0,'shader executes even when alpha rejects every lane');
    assert.strictEqual(e.d3d_software_bind_alpha(d.ctx,alphaDescriptor(0,8,0)),0,'late binding rejects after a yielded quad');
    d.run(1);
    for(let y=0;y<8;y++)for(let x=0;x<8;x++){
      assert.strictEqual(d.pixel(x,y),0x12345678,'alpha NEVER suppresses blending and color writes');
      assert.strictEqual(d.depthAt(x,y),.75);
    }
    assert.strictEqual(e.d3d_software_bind_alpha(d.ctx,valid),0,'completed binding rejects');
    assert.strictEqual(e.d3d_software_samples(d.ctx),0n,'alpha NEVER contributes no samples');
    d.guards();e.d3d_software_free(d.ctx);cases++;
  }
  {
    const d=draw(triangle,{mask:0});assert.ok(d.ctx);
    assert.strictEqual(e.d3d_software_bind_alpha(d.ctx,alphaDescriptor(0,1,0)),1);d.run();
    assert.strictEqual(d.pixel(0,0),0xff000000);assert.strictEqual(d.depthAt(0,0),.5,'disabled alpha NEVER does not suppress depth despite zero color mask');
    d.guards();e.d3d_software_free(d.ctx);cases++;
  }
  {
    const d=draw(triangle);assert.ok(d.ctx);e.d3d_software_cancel(d.ctx);
    assert.strictEqual(e.d3d_software_bind_alpha(d.ctx,alphaDescriptor(1,8,0)),0,'cancelled binding rejects');
    assert.strictEqual(e.d3d_software_samples(d.ctx),-1n,'cancelled draw never publishes partial count');
    e.d3d_software_free(d.ctx);cases++;
  }
  {
    const d=draw([vertex(-1,1,.5,1,[1,0,0,0]),vertex(1,1,.5,1,[1,0,0,1]),vertex(-1,-1,.5,1,[1,0,0,0])],{width:7,height:5});
    assert.ok(d.ctx);assert.strictEqual(e.d3d_software_bind_alpha(d.ctx,alphaDescriptor(1,7,100)),1);d.run(1);
    let expectedSamples=0n;
    for(let y=0;y<5;y++)for(let x=0;x<7;x++){
      const pass=x>=3&&x/7+y/5<1;
      if(pass)expectedSamples++;
      assert.strictEqual(d.pixel(x,y),pass?((Math.round(255*x/7)<<24)|0xff0000)>>>0:0xff000000,'per-lane alpha mask across partial quads');
      assert.strictEqual(d.depthAt(x,y),pass?.5:1);
    }
    assert.strictEqual(e.d3d_software_samples(d.ctx),expectedSamples,'partial quad helper lanes never count');
    d.guards();e.d3d_software_free(d.ctx);cases++;
  }
  {
    const kill=program([0xffff0101,65,0xb00f0000,1,0x800f0000,0x90e40000,0xffff]);
    const d=draw(triangle.map(v=>[...v.slice(0,8),-1,0,0,1]),{ps:kill});assert.ok(d.ctx);
    assert.strictEqual(e.d3d_software_bind_alpha(d.ctx,alphaDescriptor(1,8,0)),1);d.run();
    assert.strictEqual(d.pixel(0,0),0xff000000);assert.strictEqual(d.depthAt(0,0),1,'alpha ALWAYS cannot revive TEXKILL lanes');
    assert.strictEqual(e.d3d_software_samples(d.ctx),0n,'discarded lanes never count');
    d.guards();e.d3d_software_free(d.ctx);e.d3d_shader_vm_free(kill);cases++;
  }
  {
    const depthVS=program([0xfffe0101,81,0xa00f0000,0x3f800000,0,0,0,
      1,0xc00f0000,0x90e40000,1,0xd00f0000,0x90e40001,
      1,0xe00f0000,0x90e40001,1,0xe00f0001,0x90e40002,1,0xe00f0002,0xa0e40000,65535]);
    const depthPS=program([0xffff0103,64,0xb00f0000,71,0xb00f0001,0xb0e40000,
      84,0xb00f0002,0xb0e40000,1,0x800f0000,0x90e40000,65535]);
    for(const pass of [false,true])for(const budget of [1,1000])for(const format of [75,80]) {
      const vertices=triangle.map(v=>[v[0],v[1],pass?.8:.2,1,...red,pass?.25:.75,0,0,1]);
      const d=draw(vertices,{vs:depthVS,ps:depthPS,initialDepth:.5});assert(d.ctx);
      assert(e.d3d_software_bind_depth_format(d.ctx,format));
      const plane=alloc(64),sd=alloc(64);u8.fill(9,plane,plane+64);
      // ZFAIL increments, PASS replaces: distinguishes shader-depth outcome.
      u32.set([1,1,plane,8,17,255,255,1,7,3,8,1,1,1,8,0],sd/4);
      if(format===75)assert(e.d3d_software_bind_stencil(d.ctx,sd));d.run(budget);
      const depth=pass?e.d3d_software_quantize_depth(format,.25):.5;
      assert.strictEqual(d.pixel(0,0),pass?0xffff0000:0xff000000,'shader depth overrides opposite geometry depth');
      assert.strictEqual(d.depthAt(0,0),depth,'shader depth is quantized before store');
      if(format===75)assert.strictEqual(u8[plane],pass?17:10,'stencil PASS/ZFAIL follows shader-written depth');
      const covered=Array.from({length:64},(_,i)=>d.pixel(i%8,i>>3)).filter(v=>v===0xffff0000).length;
      assert.strictEqual(e.d3d_software_samples(d.ctx),BigInt(covered),'occlusion counts post-shader depth survivors only');
      assert.strictEqual(d.pixel(7,7),0xff000000,'helper lane output stays masked');
      d.guards();e.d3d_software_free(d.ctx);cases++;
    }
    e.d3d_shader_vm_free(depthVS);e.d3d_shader_vm_free(depthPS);
  }
  e.d3d_shader_vm_free(vs);e.d3d_shader_vm_free(ps);
  console.log(`PASS software programmable pipeline: ${cases} cases, actual WAT shader pixels, alpha tests before blend/depth, quad resume, masks, four-UV perspective/clipping, TEXBEM/BEML, snapshots, bounds and cancellation`);
})().catch(error=>{console.error(error);process.exitCode=1;});
