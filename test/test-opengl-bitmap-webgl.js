#!/usr/bin/env node
'use strict';
const assert=require('assert'),path=require('path'),puppeteer=require('puppeteer');
(async()=>{
  const browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME||'/usr/bin/google-chrome',
    args:['--no-sandbox','--no-first-run','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    const page=await browser.newPage();
    await page.addScriptTag({path:path.join(__dirname,'../lib/gpu-backend.js')});
    const results=await page.evaluate(()=>{
      const results=[];
      for(const apiVersion of [1,2]) {
        const canvas=document.createElement('canvas');canvas.width=canvas.height=16;
        const gpu=new GpuBackend.WebGLBackend(canvas,{apiVersion}),gl=gpu.gl;
        const pixel=(x,y)=>Array.from(gpu.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4)));
        const draw=(x,y,z,rgba,alpha=false,func=0x207,ref=0)=>{
          const v=new Float32Array(19);v.set([x,y,z,...rgba]);gpu.drawBitmapPoints(v,alpha,func,ref);
        };
        gpu.setViewport(3,4,5,6);gpu.setDepthRange(.2,.8);
        gl.clearColor(0,0,0,1);gl.clearDepth(1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
        draw(2,3,.5,[1,0,0,1]);
        const red=pixel(2,3),zero=pixel(3,3);
        const viewport=Array.from(gl.getParameter(gl.VIEWPORT)),range=Array.from(gl.getParameter(gl.DEPTH_RANGE));
        gpu.setCapability(gl.SCISSOR_TEST,true);gpu.setScissor(5,5,1,1);
        draw(2,3,.5,[0,1,0,1]);const scissor=pixel(2,3);gpu.setCapability(gl.SCISSOR_TEST,false);
        draw(2,3,.5,[0,1,0,1],true,0x200);const alpha=pixel(2,3);
        gpu.setCapability(gl.DEPTH_TEST,true);gpu.setDepthFunc(gl.LESS);gpu.setDepthMask(true);
        draw(2,3,.25,[0,1,0,1]);draw(2,3,.75,[0,0,1,1]);const depth=pixel(2,3);
        gpu.setCapability(gl.DEPTH_TEST,false);gpu.setCapability(gl.BLEND,true);gpu.setBlendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
        draw(2,3,.5,[1,0,0,.5]);const blend=pixel(2,3);
        results.push({version:gpu.version,red,zero,viewport,range,scissor,alpha,depth,blend,error:gl.getError()});gpu.destroy();
      }
      return results;
    });
    for(const r of results) {
      assert.deepStrictEqual(r.red.slice(0,3),[255,0,0]);assert.deepStrictEqual(r.zero.slice(0,3),[0,0,0]);
      assert.deepStrictEqual(r.viewport,[3,4,5,6]);assert(Math.abs(r.range[0]-.2)<1e-6&&Math.abs(r.range[1]-.8)<1e-6);
      assert.deepStrictEqual(r.scissor,r.red);assert.deepStrictEqual(r.alpha,r.red);assert.deepStrictEqual(r.depth.slice(0,3),[0,255,0]);
      assert(r.blend[0]>=126&&r.blend[0]<=129&&r.blend[1]>=126&&r.blend[1]<=129&&r.blend[2]===0);
      assert.strictEqual(r.error,0);
    }
    console.log('PASS WebGL1+2 bitmap window pixels, viewport/depth-range restoration, scissor, alpha, depth and blend',JSON.stringify(results));
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
