#!/usr/bin/env node
'use strict';
const assert=require('assert'),path=require('path');
const fs=require('fs'),os=require('os'),{spawn}=require('child_process');
const mutation=process.env.GL_INTERLEAVED_WEB_MUTATION?JSON.parse(fs.readFileSync(process.env.GL_INTERLEAVED_WEB_MUTATION)):null;let mutationApplied=false;
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
    const portFile=path.join(profile,'DevToolsActivePort'),start=Date.now();let port=0;
    // Chrome creates the file before finishing its port line.
    while(!(port>0&&port<=65535)){
      if(fs.existsSync(portFile))port=Number(fs.readFileSync(portFile,'utf8').split('\n')[0]);
      if(port>0&&port<=65535)break;
      if(spawnError)throw spawnError;
      if(chrome.exitCode!==null||chrome.signalCode)throw Error('Chrome exited: '+stderr);
      if(Date.now()-start>20000)throw Error('Chrome startup timeout: '+stderr);await delay(50);
    }
    assert(port>0&&port<=65535);
    const response=await fetch('http://127.0.0.1:'+port+'/json/list');assert(response.ok);
    const page=(await response.json()).find(p=>p.type==='page'&&p.url==='about:blank');assert(page);
    const url=new URL(page.webSocketDebuggerUrl);assert(['127.0.0.1','localhost'].includes(url.hostname));
    ws=new WebSocket(url);
    ws.addEventListener('message',event=>{const m=JSON.parse(event.data),p=pending.get(m.id);if(p){
      pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);
    }});
    ws.addEventListener('close',()=>{for(const p of pending.values())p.reject(Error('CDP disconnected'));pending.clear();});
    await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
    return {close,newPage:async()=>({addScriptTag:async({path:file})=>{let source=fs.readFileSync(file,'utf8');if(mutation&&path.basename(file)===mutation.file){assert.strictEqual(source.split(mutation.from).length-1,1,'unique browser mutation');source=source.replace(mutation.from,mutation.to);mutationApplied=true;}await evaluate(source);},
      evaluate:async (fn,arg)=>evaluate('('+fn.toString()+')('+JSON.stringify(arg)+')')})};
  } catch(error) {await close();throw error;}
}

// Compare independently specified pixels with the production WebGL consumers
// of copied native-generated commands from dynamically resolved APIs.
async function verifyNativeConsumers(page,native){
 for(const file of ['region-map.generated','mem-utils','gpu-backend','gl-command-stream','gl-compat'])await page.addScriptTag({path:require('path').resolve('lib/'+file+'.js')});
 const results=await page.evaluate(native=>{
  const rows=[];
  for(const apiVersion of [1,2]){
   const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
   const backend=new GpuBackend.WebGLBackend(canvas,{apiVersion});const gl=backend.gl;if(backend.version!==apiVersion)throw Error("WebGL version mismatch");const driver=gl.getParameter(gl.VERSION);
   const frontend=new OpenGLCompat.FixedFunctionGL(backend),memory=new ArrayBuffer(4096);
   const bridge=new OpenGLCompat.OpenGLHostBridge({getMemory:()=>memory,exports:{guest_to_wasm:p=>p}});
   bridge.current=1;bridge.contexts.set(1,{frontend,backend});
   backend.setViewport(0,0,64,64);frontend.matrices[0x1701]=[OpenGLCompat.ortho(0,64,0,64,-1,1)];frontend.uniformDirty.add('uProjection');
   // Production frontend state drives separate literal color, normal-lighting
   // and projective texture pixel oracles for the same native-owned records.
   const texels=new Uint8Array(8*8*4);
   for(let y=0;y<8;y++)for(let x=0;x<8;x++)texels.set([x*32,y*32,64,255],(y*8+x)*4);
   frontend.bindTexture(41);frontend.texImage(0,0x1908,8,8,0,0x1908,0x1401,texels);
   frontend.texParameter(0x2801,0x2600);frontend.texParameter(0x2800,0x2600);
   frontend.setTextureMode(0x1e01);
   frontend.setLightModel(0xb53,[0,0,0,1]);
   for(const pname of [0x1200,0x1202])frontend.setLight(0x4000,pname,[0,0,0,1]);
   frontend.setLight(0x4000,0x1201,[1,1,1,1]);frontend.setLight(0x4000,0x1203,[0,0,1,0]);
   for(const pname of [0x1200,0x1202,0x1600])frontend.setMaterial(pname,[0,0,0,1]);
   frontend.setMaterial(0x1201,[1,1,1,1]);frontend.setEnabled(0x4000,true);
   const color=(x,y)=>Array.from(backend.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4)));
   for(const scenario of ["color","normal","texture"])for(const c of native){
    frontend.setEnabled(0xb50,scenario==="normal");frontend.setEnabled(0xde1,scenario==="texture");
    gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    // Actual production decoder, bridge, fixed-function frontend and shaders.
    const bytes=Uint8Array.from(c.record);bridge.replay({buffer:bytes.buffer,bytes:bytes.byteLength,commands:1});frontend.flushPendingDraw();
    rows.push({apiVersion,driver,name:c.name,scenario,inside:color(32,20),outside:color(2,2)});
   }
   frontend.destroy();backend.destroy();
  }
  return rows;
 },native);
 for(const row of results){
  const c=native.find(c=>c.name===row.name);
  const expected=row.scenario==='color'?c.rgb:row.scenario==='normal'?
   (row.name.includes('N3F')?[191,191,191]:[255,255,255]):
   (row.name.includes('T2F')?[64,128,64]:[32,64,64]);
  assert.deepStrictEqual(row.outside.slice(0,3),[0,0,0],row.name+' outside');
  expected.forEach((v,k)=>assert(Math.abs(row.inside[k]-v)<=1,
   JSON.stringify({apiVersion:row.apiVersion,name:row.name,scenario:row.scenario,channel:k,actual:row.inside,expected})));
 }
 console.log(JSON.stringify({drivers:[...new Map(results.map(r=>[r.apiVersion,{apiVersion:r.apiVersion,driver:r.driver}])).values()]}));
 return results;
}

if(process.argv.includes('--negative-controls'))require('./test-gl-interleaved').negativeControls(true);
else (async()=>{const native=await require('./test-gl-interleaved').run();const browser=await launchBrowser();try{const rows=await verifyNativeConsumers(await browser.newPage(),native);assert.strictEqual(rows.length,504);if(mutation)assert(mutationApplied);console.log(JSON.stringify({pass:true,webglVersions:[1,2],pixelCases:rows.length,scenarios:["color","normal","texture"]}));}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
