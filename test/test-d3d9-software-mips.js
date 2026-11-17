#!/usr/bin/env node
'use strict';
const assert=require('assert');
const {bootRenderHarness}=require('./render-helper');
const {Device}=require('../lib/d3d9-software-backend');
(async()=>{
  const {exports:e,memory}=await bootRenderHarness({fonts:'none'});
  const options={width:8,height:8,getExports:()=>e,getMemory:()=>memory.buffer};
  function source(){
    const vertices=new Uint8Array(72),view=new DataView(vertices.buffer);
    [[-1,-1,.5,1,0,0],[3,-1,.5,1,2,0],[-1,3,.5,1,0,2]].forEach((p,i)=>
      p.forEach((x,j)=>view.setFloat32(i*24+j*4,x,true)));
    const colors=[[255,0,0,255],[0,255,0,255],[0,0,255,255],[255,255,255,255],[0,0,0,255]];
    const levels=colors.map((color,i)=>{const width=16>>i,pixels=new Uint8Array(width*width*4);
      for(let j=0;j<pixels.length;j+=4)pixels.set(color,j);return {width,height:width,pixels};});
    return {primitive:4,primitiveCount:1,stride:24,vertices,
      attributes:[{register:0,usage:0,usageIndex:0,type:3,offset:0},{register:1,usage:5,usageIndex:0,type:1,offset:16}],
      vertexShader:new Uint32Array([0xfffe0101,1,0xc00f0000,0x90e40000,1,0xe00f0000,0x90e40001,0xffff]),
      pixelShader:new Uint32Array([0xffff0101,66,0xb00f0000,1,0x800f0000,0xb0e40000,0xffff]),
      state:{cull:1},textures:[{...levels[0],levels,originalWidth:16,originalHeight:16,baseLOD:0,
        sampler:{min:1,mag:2,mip:1,addressU:3,addressV:3}}]};
  }
  const d=new Device(options),base=d.bytes;
  for(const [sampler,expected]of[[{},[0,255,0,255]],[{lodBias:1},[255,0,0,255]],
    [{mip:0},[0,0,255,255]],[{maxMipLevel:2},[255,0,0,255]],[{mip:2,lodBias:.5},[128,128,0,255]]]){
    const s=source();Object.assign(s.textures[0].sampler,sampler);d.draw(s);
    const pixels=d.readPixels();for(let i=0;i<64;i++)for(let c=0;c<4;c++)
      assert(Math.abs(pixels[i*4+c]-expected[c])<=1,`${JSON.stringify(sampler)} pixel${i} channel${c}: ${pixels[i*4+c]}`);
    assert.strictEqual(d.bytes,base);
  }
  {
    const s=source(),t=s.textures[0];
    t.levels=Array.from({length:11},(_,i)=>{
      const width=1024>>i,pixels=new Uint8Array(width*width*4),color=i===7?[0,255,0,255]:[255,0,0,255];
      for(let j=0;j<pixels.length;j+=4)pixels.set(color,j);return {width,height:width,pixels};
    });
    Object.assign(t,t.levels[0],{originalWidth:1024,originalHeight:1024});
    d.draw(s);assert(new Uint32Array(d.readPixels().buffer).every(p=>p===0xff00ff00),
      'real-game1024x1024 eleven-level chain selects level7 at8x8 footprint');
    assert.strictEqual(d.bytes,base);
  }
  const resident=source(),t=resident.textures[0];t.levels=t.levels.slice(1);Object.assign(t,t.levels[0]);t.baseLOD=1;
  d.draw(resident);assert.strictEqual(new Uint32Array(d.readPixels().buffer)[9],0xff00ff00,'original size survives SetLOD residency');
  const before=d.readPixels();
  for(const mutate of [s=>s.textures[0].levels[1]=s.textures[0].levels[2],
    s=>s.textures[0].sampler.lodBias=NaN,s=>s.textures[0].sampler.maxMipLevel=-1,
    s=>s.textures[0].levels=[],s=>s.textures[0].sampler.min=3]){
    const s=source();mutate(s);assert.throws(()=>d.draw(s),/D3D9 software/);
    assert.deepStrictEqual(d.readPixels(),before);assert.strictEqual(d.bytes,base);
  }
  d.destroy();
  console.log('PASS software mip adapter: native implicit LOD, filters/bias/residency, invalid-chain cleanup (async snapshots/cancel went with the old JS D3D9 host, d3d9-retire S4)');
})().catch(error=>{console.error(error);process.exitCode=1;});
