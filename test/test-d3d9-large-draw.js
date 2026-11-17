#!/usr/bin/env node
'use strict';
const assert=require('assert');
const {bootRenderHarness}=require('./render-helper');
const {Device}=require('../lib/d3d9-software-backend');
(async()=>{
  const {exports:e,memory}=await bootRenderHarness({fonts:'none',extraWat:`
    (func (export "free_head") (result i32) (global.get $free_list))
    (func (export "reverse_pointer") (param i32) (result i32) (call $w2g (local.get 0)))`});
  let creates=0,programs=0,textureBinds=0,failAt=0,indices=0;
  const live=new Set(),stepped=new Set();
  // A context comes from one of four constructors -- plain, typed, deferred and
  // deferred+clipped -- chosen by clip planes, deferred setup and typed
  // constants, and every one of them is released through the single
  // d3d_software_free below. Watching only the plain one made this whole test
  // vacuous once large draws moved to deferred setup: it builds all 35 of its
  // contexts with d3d_software_create_deferred, so creates and indices stayed 0,
  // the failAt injection never fired, and the free of a context that was never
  // recorded tripped live.delete.
  const track=name=>(desc,...rest)=>{creates++;if(creates===failAt)return 0;
    indices+=new Uint32Array(memory.buffer,desc,32)[12];
    const p=e[name](desc,...rest)>>>0;if(p){assert(!live.has(p));live.add(p);}return p;};
  const ex={...e,d3d_shader_vm_compile(ir){programs++;return e.d3d_shader_vm_compile(ir);},
    d3d_software_free(p){assert(live.delete(p>>>0));e.d3d_software_free(p);},
    d3d_software_step(p,n){assert(live.has(p));stepped.add(p);return e.d3d_software_step(p,n);},
    d3d_software_bind_texture_mips(...args){textureBinds++;return e.d3d_software_bind_texture_mips(...args);}};
  for(const name of ['d3d_software_create','d3d_software_create_typed',
    'd3d_software_create_deferred','d3d_software_create_deferred_clipped'])
    if(typeof e[name]==='function')ex[name]=track(name);
  const options={width:8,height:8,getExports:()=>ex,getMemory:()=>memory.buffer};
  if(process.argv.includes('--no-coalesce'))ex.d3d_render_coalesce_heap=()=>0;
  function source(){
    const count=2950,vertices=new Uint8Array(count*3*24),v=new DataView(vertices.buffer);
    for(let i=0;i<count;i++)for(let j=0;j<3;j++){
      const at=(i*3+j)*24;
      [-1+(j===1?2:0),1-(j===2?2:0),.5].forEach((x,k)=>v.setFloat32(at+k*4,x,true));
      vertices.set(i&1?[0,255,0,255]:[255,0,0,255],at+12);
      v.setFloat32(at+16,.5,true);v.setFloat32(at+20,.5,true);
    }
    return {primitive:4,primitiveCount:count,stride:24,vertices,
      attributes:[{register:0,usage:0,usageIndex:0,type:2,offset:0},
        {register:1,usage:10,usageIndex:0,type:4,offset:12},{register:2,usage:5,usageIndex:0,type:1,offset:16}],
      vertexShader:new Uint32Array([0xfffe0101,1,0xc00f0000,0x90e40000,1,0xd00f0000,0x90e40001,1,0xe00f0000,0x90e40002,0xffff]),
      pixelShader:new Uint32Array([0xffff0101,66,0xb00f0000,5,0x800f0000,0xb0e40000,0x90e40000,0xffff]),
      state:{cull:1},textures:[{width:512,height:512,pixels:new Uint8Array(512*512*4).fill(255),sampler:{min:1,mag:1,mip:0}}]};
  }
  const d=new Device(options),base=d.bytes;
  let textureCopies=0;const copy=d.copy;
  d.copy=function(data,owned){if(data.byteLength===512*512*4)textureCopies++;return copy.call(this,data,owned);};
  assert.strictEqual(d.draw(source()),1);
  const samplesPerDraw=2950n*36n;
  assert.strictEqual(d.lastDrawSamples,samplesPerDraw,'all batches contribute native covered samples');
  assert.strictEqual(d.sampleCount(),samplesPerDraw);
  assert(creates>1);assert.strictEqual(indices,2950*3,'every original primitive executes');
  assert.strictEqual(programs,2,'programs compiled once per large draw');
  assert.strictEqual(textureCopies,1,'texture storage shared across batches');
  assert.strictEqual(textureBinds,creates,'each context sees shared texture binding');
  assert.strictEqual(new Uint32Array(d.readPixels().buffer)[9],0xff00ff00,'last green triangle wins in original order');
  assert.strictEqual(live.size,0);assert.strictEqual(d.bytes,base);
  d.clear([0,0,0,1],3);const before=d.readPixels();failAt=creates+3;
  assert.throws(()=>d.draw(source()),/native raster validation rejected/);
  assert.strictEqual(d.sampleCount(),samplesPerDraw,'failed preflight publishes no samples');
  assert.deepStrictEqual(d.readPixels(),before,'late preflight failure writes no pixels');
  assert.strictEqual(live.size,0);assert.strictEqual(d.bytes,base);failAt=0;
  const budget=d.budget;d.budget=2*1024*1024;
  assert.throws(()=>d.draw(source()),/budget exceeded/);
  assert.strictEqual(d.sampleCount(),samplesPerDraw,'budget failure publishes no samples');
  assert.deepStrictEqual(d.readPixels(),before,'budget failure before any batch output');
  assert.strictEqual(live.size,0);assert.strictEqual(d.bytes,base);d.budget=budget;
  const blended=source(),expected=[0,0,0],a=128/255;
  blended.state={cull:1,blend:true,srcblend:5,dstblend:6};
  for(let i=0;i<2950;i++){
    for(let j=0;j<3;j++)blended.vertices[(i*3+j)*24+15]=128;
    for(let c=0;c<3;c++)expected[c]=Math.round(((i&1)?c===1:c===0)*255*a+expected[c]*(1-a));
  }
  d.draw(blended);const color=d.readPixels();
  assert.deepStrictEqual(Array.from(color.slice(9*4,9*4+3)),expected.slice().reverse(),
    'blending preserves destination contents and order across every batch boundary');
  assert.strictEqual(live.size,0);assert.strictEqual(d.bytes,base);
  {
    const repeated=source(),texture=repeated.textures[0];
    texture.levels=Array.from({length:11},(_,i)=>{
      const width=1024>>i;return {width,height:width,pixels:new Uint8Array(width*width*4).fill(255)};
    });
    Object.assign(texture,texture.levels[0],{originalWidth:1024,originalHeight:1024,baseLOD:0});
    texture.sampler.mip=1;
    let warmState;
    for(let frame=0;frame<32;frame++){
      let head=e.free_head()>>>0,freeBytes=0,largest=0,blocks=0;
      while(head){const p=e.guest_to_wasm(head)>>>0,words=new Uint32Array(memory.buffer,p,2);
        freeBytes+=words[0];largest=Math.max(largest,words[0]);head=words[1];assert(++blocks<65536);}
      const state={heap:e.get_heap_ptr()>>>0,sparse:e.get_heap_sparse_ptr()>>>0,freeBytes,largest,blocks};
      if(frame===8)warmState=state;
      if(frame>8&&!process.argv.includes('--no-coalesce'))assert.deepStrictEqual(state,warmState,
        'identical repeated draws reuse native storage after warm-up');
      if(process.argv.includes('--stress-mips')||process.argv.includes('--no-coalesce'))
        console.log('stress',JSON.stringify({frame,...state,owned:d.bytes}));
      d.draw(repeated);assert.strictEqual(d.bytes,base);assert.strictEqual(live.size,0);
    }
  }
  d.destroy();
  console.log('PASS large native draw: 2950 triangles, shared programs/texture, ordered pixels, preflight failure (drawAsync went with the old JS D3D9 host, d3d9-retire S4)');
})().catch(error=>{console.error(error);process.exitCode=1;});
