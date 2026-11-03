#!/usr/bin/env node
'use strict';
const assert=require('assert'),path=require('path');
const fs=require('fs'),os=require('os'),{spawn}=require('child_process');
const mutation=null;let mutationApplied=false;
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


(async()=>{
 let file=process.env.WGL_FONT_CASES;
 if(!file){file=path.join(os.tmpdir(),'wgl-font-cases-'+process.pid+'.json');require('child_process').execFileSync(process.execPath,[path.join(__dirname,'test-wgl-layer-font.js')],{env:{...process.env,WGL_FONT_CAPTURE:file},stdio:'inherit'});}
 const native=JSON.parse(fs.readFileSync(file,'utf8'));if(!process.env.WGL_FONT_CASES)fs.unlinkSync(file);
 const browser=await launchBrowser();
 try{
  const page=await browser.newPage();
  for(const name of ['region-map.generated','mem-utils','gpu-backend','gl-command-stream','gl-compat'])await page.addScriptTag({path:path.join(__dirname,'../lib/'+name+'.js')});
  const results=await page.evaluate(({native,suppress})=>{
   const out=[];
   for(const apiVersion of [1,2]){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=64;document.body.appendChild(canvas);
    const b=new GpuBackend.WebGLBackend(canvas,{apiVersion,stencil:true}),g=b.gl;
    const f=new OpenGLCompat.FixedFunctionGL(b),mem=new ArrayBuffer(16*1024*1024);
    const bridge=new OpenGLCompat.OpenGLHostBridge({getMemory:()=>mem,exports:{guest_to_wasm:p=>p}});
    bridge.contexts.set(1,{frontend:f,backend:b});bridge.current=1;
    f.matrices[0x1701]=[OpenGLCompat.ortho(0,64,0,64,-1,1)];f.uniformDirty.add('uProjection');
    const replay=name=>{if(suppress&&name==='bitmap')return;for(const bytes of native[name]){const buffer=new Uint8Array(bytes).buffer;bridge.replay({buffer,bytes:buffer.byteLength});}f.flushPendingDraw();};
    replay('setup');const observations=[];
    for(const name of ['bitmap','outline65','outline79','outline103','outline233','extrusion']){
     replay(name);const p=new Uint8Array(64*64*4);b.readPixels(0,0,64,64,g.RGBA,g.UNSIGNED_BYTE,p);
     let on=0,off=0;for(const [x,y,want] of native[name+'Checks']){const got=p[(y*64+x)*4]!==0;if(got!==want)throw Error('glyph '+name+' WebGL'+apiVersion+' pixel '+x+','+y+' expected '+want+' got '+got);want?on++:off++;}
     if(!on||!off)throw Error('missing positive/negative glyph controls');observations.push({name,on,off,png:canvas.toDataURL('image/png')});
    }
    replay('lines');const line=new Uint8Array(64*64*4);b.readPixels(0,0,64,64,g.RGBA,g.UNSIGNED_BYTE,line);let count=0;
    for(let i=0;i<64*64;i++)if(line[i*4])count++;
    if(count<=30||count>=250||line[(24*64+25)*4])throw Error('real contour lines/counter');
    observations.push({name:'lines',count,png:canvas.toDataURL('image/png')});
    if(b.version!==apiVersion)throw Error('WebGL version mismatch');
    out.push({apiVersion,version:g.getParameter(g.VERSION),error:g.getError(),renderer:g.getParameter(g.RENDERER),observations});
   }return out;
  },{native,suppress:!!process.env.WGL_FONT_SUPPRESS});
  for(const r of results){assert.strictEqual(r.error,0);for(const o of r.observations){if(process.env.WGL_FONT_WEB_PIXELS){fs.mkdirSync(process.env.WGL_FONT_WEB_PIXELS,{recursive:true});fs.writeFileSync(path.join(process.env.WGL_FONT_WEB_PIXELS,o.name+'-webgl'+r.apiVersion+'.png'),Buffer.from(o.png.split(',')[1],'base64'));}delete o.png;}}
  console.log(JSON.stringify({pass:true,results}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
