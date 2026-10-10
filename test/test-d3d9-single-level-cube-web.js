#!/usr/bin/env node
'use strict';
const assert=require('assert'),path=require('path'),puppeteer=require('puppeteer');
(async()=>{
 const browser=await puppeteer.launch({headless:true,
  executablePath:process.env.CHROME||'/usr/bin/google-chrome',
  args:['--no-sandbox','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage();
  for(const file of['gpu-backend.js','d3d9-shader.js','d3d9-fixed.js','d3d9-backend.js'])
   await page.addScriptTag({path:path.join(__dirname,'../lib',file)});
  const results=await page.evaluate(()=>{
   const results=[],colors=[[255,0,0,255],[0,255,0,255],[0,0,255,255],[255,255,0,255],[0,255,255,255],[255,0,255,255]];
   const directions=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
   const identity=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
   for(const version of[1,2]){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=8;
    const device=new D3D9Backend.Device(canvas,{webglVersion:version}),gpu=device.gpu,gl=gpu.gl;
    try{
     const pixels=c=>Uint8Array.from({length:64*64*4},(_,i)=>c[i%4]);
     const cube={width:64,height:64,pixels:pixels(colors[0]),faces:colors.map(c=>({width:64,height:64,pixels:pixels(c)})),
      sampler:{addressU:3,addressV:3,min:1,mag:1}};
     for(const stage of[0,1])for(const programmed of[false])for(const filter of[1,2])for(const bias of[-1,0,2])for(const max of[0,3])for(let face=0;face<6;face++){
      cube.sampler={addressU:3,addressV:3,min:filter,mag:filter,mip:2,lodBias:bias,maxMipLevel:max};
      const sample={colorOp:2,colorArg1:2,colorArg2:1,alphaOp:2,alphaArg1:2,alphaArg2:1,
       texCoordIndex:programmed?stage:0,transformFlags:0};
      const pass={...sample,colorArg1:0,alphaArg1:0};
      const vertices=new Float32Array([[-1,-1,.5,1],[3,-1,.5,1],[-1,3,.5,1]]
       .flatMap(p=>[...p,1,1,1,1,...directions[face],1]));
      const shader=new Uint32Array([0xfffe0101,1,0xc00f0000,0x90e40000,
       1,0xd00f0000,0x90e40001,1,(0xe00f0000|stage)>>>0,0x90e40002,0xffff]);
      const draw={primitive:4,primitiveCount:1,stride:48,vertices:new Uint8Array(vertices.buffer),
       attributes:[{register:0,usage:0,usageIndex:0,type:3,offset:0},
        {register:1,usage:10,usageIndex:0,type:3,offset:16},{register:2,usage:5,usageIndex:0,type:3,offset:32}],
       vertexShader:programmed?shader:null,textures:stage?[null,cube]:[cube],state:{cull:1,zenable:false},
       fixedFunction:{lighting:false,fog:false,specular:false,world:identity,view:identity,projection:identity,
        stages:stage?[pass,sample,{colorOp:1}]:[sample,{colorOp:1}]}};
      device.draw(draw);
      const pixel=Array.from(gpu.readPixels(3,3,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4)));
      results.push({version,stage,programmed,filter,bias,max,face,pixel,expected:colors[face],error:gpu.getError()});
     }
     const refused=image=>{let caught=false;try{device.uploadTexture(0,image)}catch(e){caught=/LOD/.test(String(e))}if(!caught)throw Error('invalid or unsupported LOD state accepted')};
     refused({...cube,sampler:{...cube.sampler,min:1,mag:2,lodBias:-1}});
     refused({...cube,faces:cube.faces.map(face=>({...face,levels:[face,{width:32,height:32,pixels:new Uint8Array(32*32*4)}]})),sampler:{...cube.sampler,lodBias:-1}});
     for(const lodBias of[NaN,Infinity,1e100])refused({...cube,sampler:{...cube.sampler,lodBias}});
     for(const maxMipLevel of[-1,0.5,0x100000000])refused({...cube,sampler:{...cube.sampler,maxMipLevel}});
    }finally{device.destroy();}
   }
   return results;
  });
  assert.strictEqual(results.length,288);
  for(const r of results){assert.strictEqual(r.error,0);assert.deepStrictEqual(r.pixel,r.expected,
   `WebGL${r.version} stage${r.stage} programmedVS=${r.programmed} cube face${r.face}`);}
  console.log('PASS one-level cube LOD clamp: 288 WebGL1/2 face/stage/filter/bias/MAXMIPLEVEL cases');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
