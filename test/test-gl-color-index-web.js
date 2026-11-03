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
 let file=process.env.GL_CI_CASES;
 if(!file){file=path.join(os.tmpdir(),'gl-ci-cases-'+process.pid+'.json');require('child_process').execFileSync(process.execPath,[path.join(__dirname,'test-gl-color-index.js')],{env:{...process.env,GL_CI_CAPTURE:file},stdio:'inherit'});}
 const native=JSON.parse(fs.readFileSync(file,'utf8'));if(!process.env.GL_CI_CASES)fs.unlinkSync(file);
 const browser=await launchBrowser();
 try{
 const page=await browser.newPage();
 for(const name of ['region-map.generated','mem-utils','gpu-backend','gl-command-stream','gl-compat'])await page.addScriptTag({path:path.join(__dirname,'../lib/'+name+'.js')});
 const results=await page.evaluate(native=>{
  const out=[];
  for(const apiVersion of [1,2]){
   const canvas=document.createElement('canvas');canvas.width=canvas.height=64;document.body.appendChild(canvas);
   const b=new GpuBackend.WebGLBackend(canvas,{apiVersion,stencil:true}),g=b.gl;
   const f=new OpenGLCompat.FixedFunctionGL(b),mem=new ArrayBuffer(16*1024*1024);
   const bridge=new OpenGLCompat.OpenGLHostBridge({getMemory:()=>mem,exports:{guest_to_wasm:p=>p}});
   bridge.contexts.set(1,{frontend:f,backend:b});bridge.current=1;
   f.matrices[0x1701]=[OpenGLCompat.ortho(0,64,0,64,-1,1)];f.uniformDirty.add('uProjection');
   const replay=name=>{for(const bytes of native[name]){const buffer=new Uint8Array(bytes).buffer;bridge.replay({buffer,bytes:buffer.byteLength});}f.flushPendingDraw();};
   const pixels=()=>{const p=new Uint8Array(64*64*4);b.readPixels(0,0,64,64,g.RGBA,g.UNSIGNED_BYTE,p);return Array.from(p);};
   replay('setup');replay('before');const before=pixels();
   if(before[(24*64+32)*4]!==255)throw Error('before render triangle missing');
   replay('selection');const selected=pixels();if(JSON.stringify(selected)!==JSON.stringify(before))throw Error('selection changed framebuffer');
   // Other cases include ordinary state setters but no draw records.
   replay('feedback');const feedback=pixels();if(JSON.stringify(feedback)!==JSON.stringify(before))throw Error('feedback changed framebuffer');
   replay('restored');const restored=pixels();if(restored[(24*64+32)*4]!==255||restored[(2*64+2)*4]!==0)throw Error('restoration pixels');
   if(b.version!==apiVersion)throw Error('requested WebGL '+apiVersion+' got '+b.version);
   out.push({apiVersion,version:g.getParameter(g.VERSION),error:g.getError(),center:restored.slice((24*64+32)*4,(24*64+32)*4+4),renderer:g.getParameter(g.RENDERER),png:canvas.toDataURL('image/png')});
  }return out;
 },native);
 for(const r of results){assert.strictEqual(r.error,0);if(process.env.GL_CI_WEB_PIXELS){fs.mkdirSync(process.env.GL_CI_WEB_PIXELS,{recursive:true});fs.writeFileSync(path.join(process.env.GL_CI_WEB_PIXELS,'restored-webgl'+r.apiVersion+'.png'),Buffer.from(r.png.split(',')[1],'base64'));}delete r.png;}
 console.log(JSON.stringify({pass:true,results}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

