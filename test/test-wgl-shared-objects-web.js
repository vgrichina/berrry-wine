#!/usr/bin/env node
'use strict';
const assert=require('assert'),path=require('path');
const fs=require('fs'),os=require('os'),{spawn}=require('child_process');
const mutation=process.env.GL_SHARED_OBJECTS_WEB_MUTATION?JSON.parse(fs.readFileSync(process.env.GL_SHARED_OBJECTS_WEB_MUTATION)):null;let mutationApplied=false;
// Use the installed Chrome and Node's CDP/WebSocket support; no package or
// browser download is required. The test owns its profile and browser process.
async function launchBrowser() {
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'gl-shared-objects-webgl-'));
  const chrome=spawn(process.env.CHROME||'/usr/bin/google-chrome',[
    '--headless=new','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0',
    '--user-data-dir='+profile,'--no-sandbox','--no-first-run','--no-default-browser-check',
    '--disable-background-networking','--disable-component-update','--disable-sync',
    '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','about:blank'
  ],{stdio:['ignore','ignore','pipe']});
  console.log('OWN_BROWSER',JSON.stringify({pid:chrome.pid,profile}));
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
    const n=++id,timer=setTimeout(()=>{pending.delete(n);reject(Error('CDP timeout '+method));},45000);
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

async function verify(page,native){
 for(const file of ['region-map.generated','mem-utils','gpu-backend','gl-command-stream','gl-compat'])await page.addScriptTag({path:path.resolve('lib/'+file+'.js')});
 const result=await page.evaluate(({native,capture})=>{
  const rows=[],drivers=[];
  for(const apiVersion of [1,2]){
   const memory=new ArrayBuffer(64*1024*1024),base=RegionMap.REGIONS.GUEST_BASE.base;
   const exports={guest_to_wasm:p=>(p-0x400000+base)>>>0,get_image_base:()=>0x400000,get_guest_base:()=>base};
   const renderer={windows:{42:{hwnd:42,w:64,h:64,clientRect:{w:64,h:64}}},repaint(){}};
   const bridge=new OpenGLCompat.OpenGLHostBridge({getMemory:()=>memory,exports,renderer,apiVersion});
   try{
    for(const event of native.events){
     if(event.batch){const bytes=Uint8Array.from(event.batch);bridge.replay(GLCommandStream.memoryBatch({buffer:bytes.buffer},0,bytes.length),event.owner);}
     else if(event.check){
      bridge._owner=event.owner;
      const context=bridge._current(),backend=context.backend,gl=backend.gl;
      if(!drivers.some(d=>d.apiVersion===apiVersion))drivers.push({apiVersion,actual:backend.version,driver:gl.getParameter(gl.VERSION)});
      context.frontend.flushPendingDraw();
      const pixel=Array.from(backend.readPixels(32,32,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4)));
      const err=backend.getError();if(err)throw Error('driver error '+err+' '+event.check.name);
      const row={apiVersion,name:event.check.name,pixel,expected:event.check.pixel};
      if(capture&&/separate native producer shared (image|mutation)|delayed Worker|producer source destroyed|migrated context/.test(row.name)){
       row.pixels=Array.from(backend.readPixels(0,0,64,64,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(64*64*4)));
       row.texturePixels=Array.from(context.frontend._textureState().levels.get(0)?.pixels||[]);
      }
      rows.push(row);
     }
    }
   }finally{bridge.destroy();}
  }
  return {rows,drivers};
 },{native,capture:!!process.env.GL_SHARED_OBJECTS_WEB_OUT});
 result.nativeModule=native.module;
 if(process.env.GL_SHARED_OBJECTS_WEB_OUT){
  const out=process.env.GL_SHARED_OBJECTS_WEB_OUT,{PNG}=require('pngjs');
  for(const row of result.rows)if(row.pixels){
   const png=new PNG({width:64,height:64});
   for(let y=0;y<64;y++)png.data.set(row.pixels.slice(y*64*4,(y+1)*64*4),(63-y)*64*4);
   row.capture=path.basename(out)+`-webgl${row.apiVersion}-`+row.name.replace(/[^a-z0-9]+/gi,'-')+'.png';
   fs.writeFileSync(path.join(path.dirname(out),row.capture),PNG.sync.write(png));delete row.pixels;
  }
  // Preserve actual failures and captures before evaluating the pixel oracle.
  fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
 }
 for(const row of result.rows)assert.deepStrictEqual(row.pixel,row.expected,JSON.stringify(row));
 assert.deepStrictEqual(result.drivers.map(d=>d.actual),[1,2]);
 assert.strictEqual(result.rows.length,2*native.cases.length);
 console.log(JSON.stringify({pass:true,...result}));
}
(async()=>{const native=await require('./test-wgl-shared-objects').run();const browser=await launchBrowser();try{await verify(await browser.newPage(),native);if(mutation)assert(mutationApplied);}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
