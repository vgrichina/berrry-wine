#!/usr/bin/env node
'use strict';
const assert=require('assert'),path=require('path'),puppeteer=require('puppeteer');
(async()=>{
 const browser=await puppeteer.launch({headless:true,
  executablePath:process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--no-first-run','--no-default-browser-check']});
 try{
  const page=await browser.newPage();
  for(const file of['gpu-backend.js','d3d9-shader.js','render-clear.js','d3d9-backend.js'])
   await page.addScriptTag({path:path.join(__dirname,'../lib',file)});
  const results=await page.evaluate(()=>{
   const out=[],identity=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
   const sampler={addressU:3,addressV:3,min:1,mag:1};
   for(const version of[1,2])for(const bumpStage of[0,1,4])for(const programmed of[false,true]){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=8;
    const d=new D3D9Backend.Device(canvas,{webglVersion:version}),g=d.gpu,gl=g.gl;
    try{
     const stage={colorOp:2,colorArg1:6,colorArg2:1,alphaOp:2,alphaArg1:6,alphaArg2:1,
      texCoordIndex:0,transformFlags:0,constant:0x80402010};
     const stages=Array.from({length:bumpStage},()=>({...stage}));
     stages.push({...stage,colorOp:22},{...stage,colorArg1:2,alphaArg1:2},{colorOp:1});
     if(programmed)stages.forEach((s,i)=>{s.texCoordIndex=i;});
     const shader=[0xfffe0101,1,0xc00f0000,0x90e40000,1,0xd00f0000,0x90ff0000];
     for(let i=0;i<6;i++)shader.push(1,(0xe00f0000|i)>>>0,0x90e40002);
     shader.push(0xffff);
     const draw={primitive:4,primitiveCount:1,stride:32,attributes:[
      {register:0,usage:0,usageIndex:0,type:3,offset:0},{register:2,usage:5,usageIndex:0,type:3,offset:16}],
      vertices:new Uint8Array(new Float32Array([[-1,-1,.5,1],[3,-1,.5,1],[-1,3,.5,1]].flatMap(p=>[...p,.25,.25,0,1])).buffer),
      vertexShader:programmed?new Uint32Array(shader):null,
      textures:[],bumpStates:[],state:{cull:1,zenable:false},fixedFunction:{lighting:false,fog:false,specular:false,
       world:identity,view:identity,projection:identity,stages}};
     draw.textures[bumpStage+1]={width:2,height:2,pixels:new Uint8Array([
      255,0,0,128,0,255,0,128,0,0,255,128,255,255,255,128]),sampler};
     for(const c of[
      {name:'identity',du:127,dv:0,m:[.5,0,0,0,1,0],expected:[0,255,0,128]},
      {name:'cross-u',du:0,dv:127,m:[0,0,.5,0,1,0],expected:[0,255,0,128]},
      {name:'cross-v',du:127,dv:0,m:[0,.5,0,0,1,0],expected:[0,0,255,128]},
      {name:'negative',du:128,dv:0,m:[-.5,0,0,0,1,0],expected:[0,255,0,128]},
      {name:'luminance',du:127,dv:0,m:[.5,0,0,0,.5,.25],lum:128,expected:[0,128,0,128]},
     ]){
      draw.textures[bumpStage]={width:1,height:1,format:62,pixels:new Uint8Array([c.du,c.dv,c.lum||0,0]),sampler};
      // Conflicting state on the environment stage catches destination-stage lookup.
      draw.bumpStates[bumpStage+1]=new Float32Array([0,0,0,0,0,0]);
      draw.bumpStates[bumpStage]=new Float32Array(c.m);stages[bumpStage].colorOp=c.lum?23:22;
      d.draw(draw);const pixel=Array.from(g.readPixels(3,3,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4)));
      out.push({version,bumpStage,programmed,name:c.name,pixel,expected:c.expected,error:g.getError()});
     }
     stages[bumpStage+1].colorOp=7;
     d.draw(draw);
     out.push({version,bumpStage,programmed,name:'base-color-preserved',
      pixel:Array.from(g.readPixels(3,3,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4))),
      expected:bumpStage?[64,160,16,128]:[255,255,255,128],error:g.getError()});
     stages[bumpStage+1].colorOp=2;stages[bumpStage].colorOp=22;
     d.draw(draw);const programs=d.programs.size;
     draw.bumpStates[bumpStage][0]=0;d.draw(draw);
     if(d.programs.size!==programs)throw new Error('bump matrix created a shader variant');
     const before=Array.from(g.readPixels(3,3,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4)));
     out.push({version,bumpStage,programmed,name:'matrix-uniform-update',pixel:before,expected:[255,0,0,128],error:g.getError()});
     draw.bumpStates[bumpStage][0]=NaN;
     let invalid=false;try{d.draw(draw);}catch(e){invalid=/bump metadata/.test(e.message);}
     if(!invalid)throw new Error('nonfinite bump matrix accepted');
     const after=Array.from(g.readPixels(3,3,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4)));
     if(after.some((v,i)=>v!==before[i]))throw new Error('invalid bump state changed pixels');
     draw.bumpStates[bumpStage][0]=0;
     stages[bumpStage].alphaOp=22;
     let rejected=false;try{d.draw(draw);}catch(e){rejected=/color-only/.test(e.message);}
     if(!rejected)throw new Error('bump ALPHAOP accepted');
    }finally{d.destroy();}
   }
   return out;
  });
  for(const r of results){assert.strictEqual(r.error,0);r.pixel.forEach((v,c)=>assert(Math.abs(v-r.expected[c])<=1,JSON.stringify(r)));}
  console.log('PASS fixed bump WebGL1/2: signed deltas, cross terms, source-stage matrix, luminance and alpha rejection');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
