#!/usr/bin/env node
'use strict';
const assert=require('assert');
const {bootRenderHarness}=require('./render-helper');
const {Device}=require('../lib/d3d9-software-backend');
// Screen-space vertices must retain pixel-edge ownership when the target grows.
// https://learn.microsoft.com/en-us/windows/win32/direct3d9/viewports-and-clipping
(async()=>{
  const {exports:e,memory,module}=await bootRenderHarness({fonts:'none'});
  e.d3dim_worker_init(0x400000);
  const vertices=new Uint8Array(60),view=new DataView(vertices.buffer);
  [[0,0],[8,0],[0,8]].forEach(([x,y],i)=>{
    [x,y,.5,1].forEach((v,j)=>view.setFloat32(i*20+j*4,v,true));
    view.setUint32(i*20+16,0xff0000ff,true); // neutral descriptor color bytes are RGBA
  });
  const snapshot={primitive:4,primitiveCount:1,stride:20,vertices,
    attributes:[{register:0,usage:9,usageIndex:0,type:3,offset:0},
      {register:5,usage:10,usageIndex:0,type:4,offset:16}],
    vertexShader:null,pixelShader:null,textures:[],state:{zenable:false,zwrite:false,cull:1},
    fixedFunction:{lighting:false,fog:false,specular:false,textureFactor:0xffffffff,
      stages:[{colorOp:2,colorArg1:0,colorArg2:0,alphaOp:2,alphaArg1:0,alphaArg2:0,
        constant:0xffffffff,transformFlags:0,texCoordIndex:0},{colorOp:1}]}};
  for(const [width,height]of[[8,8],[320,240],[640,480],[800,600],[1024,768]]){
    const device=new Device({getExports:()=>e,getMemory:()=>memory.buffer,width,height});
    try{
      device.draw(snapshot);
      assert.strictEqual(device.sampleCount(),36n,`POSITIONT coverage at ${width}x${height}`);
      const pixels=new Uint32Array(memory.buffer,device.target.wa,width*height);
      for(let y=0;y<8;y++)for(let x=0;x<8;x++)
        assert.strictEqual(pixels[y*width+x]>>>0,x+y<8?0xffff0000:0xff000000,
          `exact integer edge ownership ${width}x${height} (${x},${y})`);
    }finally{device.destroy();}
  }
  for(const rhw of[.25,2]){
    const device=new Device({getExports:()=>e,getMemory:()=>memory.buffer,width:32,height:32});
    try{
      const shifted=vertices.slice(),data=new DataView(shifted.buffer);
      for(let i=0;i<3;i++){
        data.setFloat32(i*20,data.getFloat32(i*20,true)+12,true);
        data.setFloat32(i*20+4,data.getFloat32(i*20+4,true)+12,true);
        data.setFloat32(i*20+8,.3,true);data.setFloat32(i*20+12,rhw,true);
      }
      // POSITIONT depth and XY are already mapped; viewport MinZ/MaxZ and XY
      // offsets must not transform them a second time. RHW still interpolates.
      device.clear([0,0,0,1],3,.4);
      device.draw({...snapshot,vertices:shifted,viewport:{x:8,y:8,width:16,height:16,minZ:.6,maxZ:.9},
        state:{...snapshot.state,zenable:true,zwrite:true,zfunc:4}});
      assert.strictEqual(device.sampleCount(),36n,`offset viewport and RHW ${rhw}`);
      const pixels=new Uint32Array(memory.buffer,device.target.wa,32*32);
      assert.strictEqual(pixels[12*32+12]>>>0,0xffff0000,'diffuse remains correct after RHW interpolation');
      assert.strictEqual(pixels[8*32+8]>>>0,0xff000000,'viewport offset does not relocate vertices');
    }finally{device.destroy();}
  }
  for(const [positions,expected]of[
    [[[-4,-4],[8,-4],[-4,8]],10n],
    [[[-20,-20],[-12,-20],[-20,-12]],0n],
    [[[64,64],[72,64],[64,72]],0n],
  ]){
    const device=new Device({getExports:()=>e,getMemory:()=>memory.buffer,width:32,height:32});
    try{
      const clipped=vertices.slice(),data=new DataView(clipped.buffer);
      positions.forEach(([x,y],i)=>{data.setFloat32(i*20,x,true);data.setFloat32(i*20+4,y,true);});
      device.draw({...snapshot,vertices:clipped});
      assert.strictEqual(device.sampleCount(),expected,'offscreen screen-space vertices retain geometry and bounded coverage');
    }finally{device.destroy();}
  }
  console.log('PASS POSITIONT coverage: dimensions, viewport/depth/RHW, offscreen bounds');
})().catch(error=>{console.error(error);process.exitCode=1;});
