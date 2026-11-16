#!/usr/bin/env node
'use strict';
const assert=require('assert');
const path=require('path');
const puppeteer=require('puppeteer');
(async()=>{
  const browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-first-run','--no-default-browser-check']});
  try {
    const page=await browser.newPage();
    for(const file of ['gpu-backend.js','d3d9-shader.js','render-clear.js','d3d9-backend.js'])await page.addScriptTag({path:path.join(__dirname,'../lib',file)});
    const result=await page.evaluate(()=>{
      const canvas=document.createElement('canvas');canvas.width=canvas.height=4;
      const d=new D3D9Backend.Device(canvas),g=d.gpu,gl=g.gl;
      const vs=new Uint32Array([0xfffe0101,1,0xc00f0000,0x90e40000,0xffff]);
      const ps=new Uint32Array([0xffff0101,1,0x800f0000,0xa0e40000,0xffff]);
      const pixel=()=>Array.from(g.readPixels(1,1,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4)));
      const draw=(depth,color,z)=>d.draw({vertexShader:vs,pixelShader:ps,primitive:4,primitiveCount:1,stride:16,
        vertices:new Uint8Array(new Float32Array([-1,-1,z,1,3,-1,z,1,-1,3,z,1]).buffer),
        attributes:[{register:0,type:3,offset:0}],pixelConstants:new Float32Array(color),depthAttachment:depth,state:{cull:1,zfunc:2}});
      const results=[];
      for(const format of [80,77,75]){
        const a={id:format,width:4,height:4,format},b={id:format+100,width:8,height:7,format};
        d.clear([0,0,0,1],3,1,null,a);draw(a,[1,0,0,1],.2);
        d.clear([0,0,0,1],2,1,null,b);results.push(pixel());
        draw(b,[0,1,0,1],.6);results.push(pixel());
        draw(a,[0,0,1,1],.5);results.push(pixel());
        draw(b,[1,1,0,1],.8);results.push(pixel());
        d.present();results.push(Array.from(g.getPresentationSurface().getContext('2d').getImageData(1,1,1,1).data));
        d.releaseDepth(b.id);results.push(pixel());
        draw(null,[0,0,1,1],.9);results.push(pixel());
        d.clear([1,0,0,1],1,1,[[0,0,2,2]],a);
        results.push(Array.from(g.readPixels(0,3,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4))));
      }
      const before=pixel();let rejected=false;
      try{d.reset({width:4,height:4,depthAttachment:{id:999,width:100000,height:4,format:80}});}catch(e){rejected=true;}
      const after=pixel();
      g.targetBudget=g._targetBytes;
      let budgetRejected=false;
      try{d.reset({width:2,height:2,depthAttachment:null});}catch(e){budgetRejected=true;}
      const budgetAfter=pixel(),oldDimensions=[canvas.width,canvas.height];
      g.targetBudget=256*1024*1024;
      d.reset({width:2,height:3,depthAttachment:{id:1000,width:5,height:6,format:80}});
      d.clear([1,0,1,1],3,1,null,{id:1000,width:5,height:6,format:80});d.present();
      const resized=[canvas.width,canvas.height,...pixel()];
      const error=g.getError();d.destroy();return {results,before,after,rejected,budgetRejected,budgetAfter,oldDimensions,resized,error,targets:g._targets.size};
    });
    const expected=[[255,0,0,255],[0,255,0,255],[0,255,0,255],[0,255,0,255],[0,255,0,255],[0,255,0,255],[0,0,255,255],[255,0,0,255]];
    assert.deepStrictEqual(result.results,[...expected,...expected,...expected]);
    assert(result.rejected);assert.deepStrictEqual(result.before,result.after);
    assert(result.budgetRejected);assert.deepStrictEqual(result.before,result.budgetAfter);assert.deepStrictEqual(result.oldDimensions,[4,4]);
    assert.deepStrictEqual(result.resized,[2,3,255,0,255,255]);assert.strictEqual(result.error,0);assert.strictEqual(result.targets,0);
    console.log('PASS WebGL D16/D24 depth identity, oversized attachments, color preservation, Clear/Present/readback, release and atomic Reset');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
