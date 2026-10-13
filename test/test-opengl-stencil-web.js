#!/usr/bin/env node
'use strict';
const assert=require('assert'),path=require('path'),puppeteer=require('puppeteer');
(async()=>{
  const browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME||'/usr/bin/google-chrome',
    args:['--no-sandbox','--no-first-run','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    const page=await browser.newPage();
    for(const name of ['gpu-backend','gl-command-stream','mem-utils','gl-compat'])
      await page.addScriptTag({path:path.join(__dirname,`../lib/${name}.js`)});
    const results=await page.evaluate(()=>{
      const results=[];
      for(const apiVersion of [1,2]) {
        const canvas=document.createElement('canvas');canvas.width=canvas.height=16;
        const gpu=new GpuBackend.WebGLBackend(canvas,{apiVersion,stencil:true}),gl=gpu.gl;
        const front=new OpenGLCompat.FixedFunctionGL(gpu),memory=new ArrayBuffer(512),dv=new DataView(memory);
        const bridge=new OpenGLCompat.OpenGLHostBridge({getMemory:()=>memory});
        bridge.contexts.set(1,{frontend:front,backend:gpu});bridge.current=1;
        const call=(name,args=[])=>{args.forEach((v,i)=>dv.setUint32(4+i*4,v>>>0,true));return bridge.call(OpenGLCompat.CALL_INDEX[name],0,0);};
        const pixel=(x=2,y=2)=>Array.from(gpu.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4))).slice(0,3);
        const draw=(rgba=[1,0,0,1],z=0)=>{
          const v=new Float32Array(19);v.set([-.6875,-.6875,z,...rgba]);v[14]=1;
          front.enqueuePacked(gl.POINTS,v);front.flushPendingDraw();
        };
        const clear=v=>{call('glClearStencil',[v]);call('glClear',[0x400]);};
        const probe=(ref,x=2,y=2)=>{
          call('glClear',[gl.COLOR_BUFFER_BIT]);
          call('glStencilFunc',[gl.EQUAL,ref,255]);call('glStencilOp',[gl.KEEP,gl.KEEP,gl.KEEP]);
          const v=new Float32Array(19);v.set([x,y,.5,0,1,0,1]);gpu.drawBitmapPoints(v,false,gl.ALWAYS,0);
          return pixel(x,y);
        };
        call('glViewport',[0,0,16,16]);call('glEnable',[gl.STENCIL_TEST]);
        call('glStencilMask',[255]);clear(0xa0);call('glStencilMask',[15]);clear(5);
        const masked=probe(0xa5);
        call('glEnable',[gl.SCISSOR_TEST]);call('glScissor',[2,2,1,1]);clear(9);call('glDisable',[gl.SCISSOR_TEST]);
        const scissor=probe(0xa9),outside=probe(0xa5,3,2);
        call('glStencilMask',[255]);clear(0);call('glStencilFunc',[gl.ALWAYS,7,255]);call('glStencilOp',[gl.KEEP,gl.KEEP,gl.REPLACE]);
        draw();const accepted=pixel();const replaced=probe(7);
        call('glStencilFunc',[gl.ALWAYS,11,255]);call('glStencilOp',[gl.KEEP,gl.KEEP,gl.REPLACE]);
        front.setEnabled(0xbc0,true);front.setAlphaFunc(gl.GREATER,.5);draw([1,0,0,0]);front.setEnabled(0xbc0,false);
        const alpha=probe(7);
        call('glStencilFunc',[gl.NEVER,0,255]);call('glStencilOp',[gl.INCR,gl.KEEP,gl.KEEP]);draw();const fail=probe(8);
        call('glEnable',[gl.DEPTH_TEST]);call('glDepthFunc',[gl.NEVER]);call('glStencilFunc',[gl.ALWAYS,0,255]);
        call('glStencilOp',[gl.KEEP,gl.DECR,gl.KEEP]);draw();call('glDisable',[gl.DEPTH_TEST]);const zfail=probe(7);
        call('glPushAttrib',[0x400]);call('glStencilMask',[0]);call('glDisable',[gl.STENCIL_TEST]);call('glPopAttrib');
        const stack=[gl.getParameter(gl.STENCIL_WRITEMASK),gl.isEnabled(gl.STENCIL_TEST)];
        const ctx={frontend:front,backend:gpu,win:{},layer:{}};
        bridge._clientSize=()=>({w:20,h:20});bridge._syncDrawableSize(ctx);
        const resized=[gl.getParameter(gl.STENCIL_BITS),gl.getParameter(gl.STENCIL_WRITEMASK),gl.isEnabled(gl.STENCIL_TEST)];
        results.push({version:gpu.version,bits:gl.getParameter(gl.STENCIL_BITS),masked,scissor,outside,accepted,replaced,alpha,fail,zfail,stack,resized,error:gl.getError()});
        front.destroy();
      }
      return results;
    });
    for(const r of results) {
      assert.strictEqual(r.bits,8);assert.deepStrictEqual(r.accepted,[255,0,0]);
      for(const key of ['masked','scissor','outside','replaced','alpha','fail','zfail'])assert.deepStrictEqual(r[key],[0,255,0],key);
      assert.deepStrictEqual(r.stack,[255,true]);assert.deepStrictEqual(r.resized,[8,255,true]);assert.strictEqual(r.error,0);
    }
    console.log('PASS WebGL1+2 frontend stencil pixels, masked/scissored clears, alpha/depth tests, stack and resized attachment',JSON.stringify(results));
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
