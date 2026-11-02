#!/usr/bin/env node
'use strict';
const assert=require('assert'),path=require('path');
const fs=require('fs'),os=require('os'),{spawn}=require('child_process');
// Use the installed Chrome and Node's CDP/WebSocket support; no package or
// browser download is required. The test owns its profile and browser process.
async function launchBrowser() {
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'raster-webgl-'));
  const chrome=spawn(process.env.CHROME||'/usr/bin/google-chrome',[
    '--headless=new','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0',
    '--user-data-dir='+profile,'--no-sandbox','--no-first-run','--no-default-browser-check',
    '--disable-background-networking','--disable-component-update','--disable-sync',
    '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','about:blank'
  ],{stdio:['ignore','ignore','pipe']});
  let ws,spawnError,stderr='',id=0;const pending=new Map();
  chrome.on('error',e=>spawnError=e);chrome.stderr.on('data',b=>stderr=(stderr+b).slice(-8000));
  const exited=new Promise(resolve=>chrome.once('exit',(code,signal)=>resolve({code,signal})));
  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function close() {
    if(ws?.readyState===WebSocket.OPEN)await send('Browser.close').catch(()=>{});
    if(chrome.exitCode===null&&!chrome.signalCode){
      const timer=setTimeout(()=>chrome.kill('SIGKILL'),5000);
      try {chrome.kill('SIGTERM');await exited;} finally {clearTimeout(timer);}
    }
    ws?.close();fs.rmSync(profile,{recursive:true,force:true});
  }
  function send(method,params={}) {return new Promise((resolve,reject)=>{
    const n=++id,timer=setTimeout(()=>{pending.delete(n);reject(Error('CDP timeout '+method));},15000);
    pending.set(n,{resolve:r=>{clearTimeout(timer);resolve(r);},reject:e=>{clearTimeout(timer);reject(e);}});
    ws.send(JSON.stringify({id:n,method,params}));
  });}
  async function evaluate(expression) {
    const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;
  }
  try {
    const portFile=path.join(profile,'DevToolsActivePort'),start=Date.now();
    while(!fs.existsSync(portFile)){
      if(spawnError)throw spawnError;
      if(chrome.exitCode!==null||chrome.signalCode)throw Error('Chrome exited: '+stderr);
      if(Date.now()-start>20000)throw Error('Chrome startup timeout: '+stderr);await delay(50);
    }
    const port=Number(fs.readFileSync(portFile,'utf8').split('\n')[0]);assert(port>0&&port<=65535);
    const response=await fetch('http://127.0.0.1:'+port+'/json/list');assert(response.ok);
    const page=(await response.json()).find(p=>p.type==='page'&&p.url==='about:blank');assert(page);
    const url=new URL(page.webSocketDebuggerUrl);assert(['127.0.0.1','localhost'].includes(url.hostname));
    ws=new WebSocket(url);
    ws.addEventListener('message',event=>{const m=JSON.parse(event.data),p=pending.get(m.id);if(p){
      pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);
    }});
    ws.addEventListener('close',()=>{for(const p of pending.values())p.reject(Error('CDP disconnected'));pending.clear();});
    await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
    return {close,newPage:async()=>({addScriptTag:async({path:file})=>{await evaluate(fs.readFileSync(file,'utf8'));},
      evaluate:async fn=>evaluate('('+fn.toString()+')()')})};
  } catch(error) {await close();throw error;}
}

(async()=>{
  const browser=await launchBrowser();
  try {
    const page=await browser.newPage();
    await page.addScriptTag({path:path.join(__dirname,'../lib/gpu-backend.js')});
    await page.addScriptTag({path:path.join(__dirname,'../lib/gl-command-stream.js')});
    await page.addScriptTag({path:path.join(__dirname,'../lib/gl-compat.js')});
    const results=await page.evaluate(()=>{
      const results=[];
      for(const apiVersion of [1,2]) {
        const canvas=document.createElement('canvas');canvas.width=canvas.height=16;
        const gpu=new GpuBackend.WebGLBackend(canvas,{apiVersion}),gl=gpu.gl;
        // Production GL contexts draw into RGBA drawable attachments. The
        // browser's opaque presentation canvas cannot expose fragment alpha.
        gpu.enableDrawableBuffers();gpu.createDrawable('bitmap-test',16,16,true);
        gpu.bindDrawable('bitmap-test',0x404,0x404);
        const pixel=(x,y)=>Array.from(gpu.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4)));
        const frontend=new OpenGLCompat.FixedFunctionGL(gpu);
        const draw=(x,y,z,rgba,alpha=false,func=0x207,ref=0)=>{
          const v=new Float32Array(19);v.set([x,y,z,...rgba]);v[18]=v[16]=1;
          frontend.setEnabled(0xbc0,alpha);frontend.alphaFunc=func;frontend.alphaRef=ref;
          frontend.uniformDirty.add('uAlphaFunc');frontend.uniformDirty.add('uAlphaRef');frontend.drawBitmap(v);
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
        gpu.setCapability(gl.BLEND,false);
        frontend.bindTexture(42);frontend.unpackAlignment=1;
        frontend.texImage(0,0x1908,2,1,0,0x1908,0x1401,new Uint8Array([0,0,255,255,255,255,0,255]));
        frontend.texParameter(0x2800,0x2600);frontend.texParameter(0x2801,0x2600);
        frontend.textureModes[0]=0x1e01;frontend.uniformDirty.add('uTextureMode');frontend.setEnabled(0xde1,true);
        const captured=new Float32Array(19);captured.set([7,8,.5,1,1,1,1,1.5,1]);captured[16]=2;captured[18]=1;
        frontend.drawBitmap(captured);const texture=pixel(7,8);frontend.setEnabled(0xde1,false);
        frontend.setFog(0xb65,[0x2601]);frontend.setFog(0xb63,[0]);frontend.setFog(0xb64,[1]);frontend.setFog(0xb66,[0,0,1,0]);frontend.setEnabled(0xb60,true);
        captured.set([9,8,.5,1,0,0,.5]);captured[9]=.5;frontend.drawBitmap(captured);const fog=pixel(9,8);frontend.setEnabled(0xb60,false);
        results.push({texture,fog,version:gpu.version,red,zero,viewport,range,scissor,alpha,depth,blend,error:gl.getError()});gpu.destroy();
      }
      return results;
    });
    for(const r of results) {
      assert.deepStrictEqual(r.red.slice(0,3),[255,0,0]);assert.deepStrictEqual(r.zero.slice(0,3),[0,0,0]);
      assert.deepStrictEqual(r.viewport,[3,4,5,6]);assert(Math.abs(r.range[0]-.2)<1e-6&&Math.abs(r.range[1]-.8)<1e-6);
      assert.deepStrictEqual(r.scissor,r.red);assert.deepStrictEqual(r.alpha,r.red);assert.deepStrictEqual(r.depth.slice(0,3),[0,255,0]);
      assert(r.blend[0]>=126&&r.blend[0]<=129&&r.blend[1]>=126&&r.blend[1]<=129&&r.blend[2]===0);
      assert.deepStrictEqual(r.texture,[255,255,0,255]);assert.deepStrictEqual(r.fog,[128,0,128,128]);
      assert.strictEqual(r.error,0);
    }
    console.log('PASS WebGL1+2 bitmap window pixels, viewport/depth-range restoration, scissor, alpha, depth and blend',JSON.stringify(results));
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
