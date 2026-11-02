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

// Real WebGL attachment and state oracles.
(async()=>{
 const browser=await launchBrowser();
 try {
  const page=await browser.newPage();
  for(const file of ['region-map.generated','mem-utils','gpu-backend','gl-command-stream','gl-compat'])await page.addScriptTag({path:path.join(__dirname,'../lib/'+file+'.js')});
  const results=await page.evaluate(()=>{
   const results=[];
   for(const apiVersion of [1,2]) {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=8;
    const b=new GpuBackend.WebGLBackend(canvas,{apiVersion}),g=b.gl;
    b.enableDrawableBuffers();b.createDrawable('pixel-copy',8,8,false);b.bindDrawable('pixel-copy',0x405,0x405);
    g.clearColor(.2,.4,.6,1);g.clearDepth(1);g.clearStencil(0xa0);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT|g.STENCIL_BUFFER_BIT);
    b.setViewport(1,2,3,4);b.setDepthRange(.2,.8);b.setCapability(g.STENCIL_TEST,true);b.setStencilFunc(g.FRONT_AND_BACK,g.NEVER,7,255);
    b.setCapability(g.DEPTH_TEST,true);b.setDepthFunc(g.NEVER);b.setStencilMask(15);
    const v=new Float32Array(19*2);v.set([2,3,.5,0x15]);v.set([3,3,.5,0x26],19);
    b.drawStencilPixels(v);
    const names=['VIEWPORT','DEPTH_RANGE','DEPTH_FUNC','DEPTH_WRITEMASK','COLOR_WRITEMASK','COLOR_CLEAR_VALUE',
     'STENCIL_FUNC','STENCIL_REF','STENCIL_VALUE_MASK','STENCIL_WRITEMASK','STENCIL_FAIL','STENCIL_PASS_DEPTH_FAIL','STENCIL_PASS_DEPTH_PASS',
     'STENCIL_BACK_FUNC','STENCIL_BACK_REF','STENCIL_BACK_VALUE_MASK','STENCIL_BACK_WRITEMASK','PACK_ALIGNMENT'];
    if(apiVersion===2)names.push('PACK_ROW_LENGTH','PACK_SKIP_ROWS','PACK_SKIP_PIXELS','UNPACK_ROW_LENGTH','UNPACK_SKIP_ROWS','UNPACK_SKIP_PIXELS');
    const snapshot=()=>Object.fromEntries(names.map(n=>{const x=g.getParameter(g[n]);return[n,ArrayBuffer.isView(x)?Array.from(x):x];}));
    const before=snapshot(),stencil=b.readRasterAttachment(2,3,2,1,0x1901),after=snapshot();
    b.setCapability(g.SCISSOR_TEST,true);b.setScissor(3,3,1,1);v[3]=9;v[22]=10;b.drawStencilPixels(v);
    b.setCapability(g.SCISSOR_TEST,false);const clipped=b.readRasterAttachment(2,3,2,1,0x1901);
    b.setCapability(g.STENCIL_TEST,false);b.setCapability(g.DEPTH_TEST,true);b.setDepthMask(true);b.setDepthFunc(g.ALWAYS);
    const depths=[0,.125,.25,.5,.75,.875,1];
    const p=new Float32Array(19*depths.length);
    depths.forEach((z,i)=>p.set([i,1,z,1,0,0,1],i*19));b.drawBitmapPoints(p,false,g.ALWAYS,0);
    const depthBefore=snapshot(),depth=b.readRasterAttachment(0,1,7,1,0x1902),depthAfter=snapshot();
    // A copied depth must pass EQUAL against the original source depth;
    // a numerical tolerance alone can hide a one-unit copy error.
    const copied=new Float32Array(19*depths.length),equal=new Float32Array(19*depths.length);
    depths.forEach((z,i)=>{copied.set([i,2,depth.pixels[i],0,0,1,1],i*19);equal.set([i,2,z,1,1,1,1],i*19);});
    b.setDepthFunc(g.ALWAYS);b.drawBitmapPoints(copied,false,g.ALWAYS,0);b.setDepthFunc(g.EQUAL);b.drawBitmapPoints(equal,false,g.ALWAYS,0);
    const depthEqual=Array.from(b.readPixels(0,2,7,1,g.RGBA,g.UNSIGNED_BYTE,new Uint8Array(28)));
    const color=Array.from(b.readPixels(2,3,2,1,g.RGBA,g.UNSIGNED_BYTE,new Uint8Array(8)));
    // The actual frontend consumer decodes the packed stencil record and
    // synchronous attachment barrier, using guest output rather than JS arrays.
    const mem=new ArrayBuffer(65536),dv=new DataView(mem),front=new OpenGLCompat.FixedFunctionGL(b);
    const bridge=new OpenGLCompat.OpenGLHostBridge({getMemory:()=>mem,exports:{guest_to_wasm:p=>p}});
    bridge.contexts.set(1,{frontend:front,backend:b});bridge.current=1;
    b.setStencilMask(255);b.setCapability(g.SCISSOR_TEST,false);
    const batch=new ArrayBuffer(32+19*4*2),header=new DataView(batch),verts=new Float32Array(batch,32);
    header.setUint32(0,batch.byteLength,true);header.setUint32(4,0x10000,true);header.setUint32(8,0x50000,true);header.setUint32(20,19*4*2,true);header.setUint32(24,32,true);
    verts.set([2,3,.5,0x99]);verts.set([3,3,.5,0x88],19);bridge.replay({buffer:batch,bytes:batch.byteLength,commands:1});
    const barrier=(name,args=[])=>{args.forEach((v,i)=>dv.setUint32(4+i*4,v,true));return bridge.call(OpenGLCompat.CALL_INDEX[name],0,0);};
    const size=barrier('_glRasterSize'),copyError=barrier('_glReadRasterPixels',[2,3,2,1,0x1901,4096]);
    const consumer={size,error:copyError,pixels:[dv.getFloat64(4096,true),dv.getFloat64(4112,true)]};
    results.push({version:apiVersion,depthEqual,consumer,before,after,stencil:{error:stencil.error,pixels:Array.from(stencil.pixels||[])},
     clipped:{error:clipped.error,pixels:Array.from(clipped.pixels||[])},depthBefore,depthAfter,
     depth:{error:depth.error,pixels:Array.from(depth.pixels||[])},color,error:g.getError()});b.destroy();
   }return results;
  });
  for(const r of results){
   assert.deepStrictEqual(r.before,r.after,'stencil probe preserves state');assert.deepStrictEqual(r.depthBefore,r.depthAfter,'depth probe preserves state');
   assert.deepStrictEqual(r.stencil,{error:0,pixels:[0xa5,0xa6]});assert.deepStrictEqual(r.clipped,{error:0,pixels:[0xa5,0xaa]});
   assert.strictEqual(r.depth.error,0);assert.deepStrictEqual(r.depthEqual,Array(28).fill(255),'copied depth equality');
   [0,.125,.25,.5,.75,.875,1].forEach((v,i)=>assert(Math.abs(r.depth.pixels[i]-v)<=2/0xffffff,'depth '+i+' '+r.depth.pixels[i]));
   assert.deepStrictEqual(r.consumer,{size:(8<<16)|8,error:0,pixels:[0x99,0x88]});
   assert.deepStrictEqual(r.color,[51,102,153,255,51,102,153,255]);assert.strictEqual(r.error,0);
  }
  console.log(JSON.stringify({passed:true,results}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
