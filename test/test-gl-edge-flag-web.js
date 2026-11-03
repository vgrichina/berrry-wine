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
 let file=process.env.GL_EDGE_CASES;
 if(!file){
  file=path.join(os.tmpdir(),'gl-edge-cases-'+process.pid+'.json');
  require('child_process').execFileSync(process.execPath,[path.join(__dirname,'test-gl-edge-flag.js')],{env:{...process.env,GL_EDGE_CAPTURE:file},stdio:'inherit'});
 }
 const native=JSON.parse(fs.readFileSync(file,'utf8'));
 if(!process.env.GL_EDGE_CASES)fs.unlinkSync(file);
 const browser=await launchBrowser();
 try{
 const page=await browser.newPage();
 for(const name of ['region-map.generated','mem-utils','gpu-backend','gl-command-stream','gl-compat'])await page.addScriptTag({path:path.join(__dirname,'../lib/'+name+'.js')});
 const results=await page.evaluate(native=>{
  const out=[];
  for(const apiVersion of [1,2]){
   const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
   const b=new GpuBackend.WebGLBackend(canvas,{apiVersion,stencil:true}),g=b.gl;
   const f=new OpenGLCompat.FixedFunctionGL(b),mem=new ArrayBuffer(4096);
   const bridge=new OpenGLCompat.OpenGLHostBridge({getMemory:()=>mem,exports:{guest_to_wasm:p=>p}});
   bridge.contexts.set(1,{frontend:f,backend:b});bridge.current=1;
   f.matrices[0x1701]=[OpenGLCompat.ortho(0,64,0,64,-1,1)];f.uniformDirty.add('uProjection');
   function replay(name){for(const bytes of native[name]){const buffer=new Uint8Array(bytes).buffer;bridge.replay({buffer,bytes:buffer.byteLength});}f.flushPendingDraw();}
   function region(x,y){let n=0;for(let a=Math.max(0,x-1);a<=Math.min(63,x+1);a++)for(let c=Math.max(0,y-1);c<=Math.min(63,y+1);c++){const v=new Uint8Array(4);b.readPixels(a,c,1,1,g.RGBA,g.UNSIGNED_BYTE,v);if(v[0])n++;}return n;}
   replay('setup');
   const sample=(name,points)=>{replay(name);return points.map(p=>region(...p)>0);};
   const values={};
   const tri=[[16,8],[16,16],[8,16]];
   values.triangleTrue=sample('triangleTrue',tri);
   values.triangleFalse=sample('triangleFalse',tri);
   values.triangleMixed=sample('triangleMixed',tri);
   values.quadTrue=sample('quadTrue',[[16,8],[16,16]]);
   values.polygonMixed=sample('polygonMixed',[[16,8],[24,16],[16,16]]);
   values.clippedFalse=sample('clippedFalse',[[16,16],[24,16],[20,16]]);
   values.clippedQuadFalse=sample('clippedQuadFalse',[[16,16],[20,16]]);
   values.collinearFront=sample('collinearFront',[[16,24]]);
   values.clippedBackCull=sample('clippedBackCull',[[0,16]]);
   values.userClipFalse=sample('userClipFalse',[[16,16],[24,16]]);
   values.pointMixed=sample('pointMixed',[[8,8],[24,8],[8,24]]);
   values.clippedPointFalse=sample('clippedPointFalse',[[0,24],[0,8],[0,16]]);
   values.indexedStrided=sample('indexedStrided',[[16,8],[24,16],[16,24],[8,16],[16,16]]);
   values.packedArrays=sample('packedArrays',[[16,8],[24,16],[16,24],[8,16]]);
   values.arrayListSnapshot=sample('arrayListSnapshot',[[16,8],[24,16],[16,24],[8,16]]);
   values.listVectorFalse=sample('listVectorFalse',[[16,8]]);
   for(const name of ['strip','fan','quadStrip'])values[name]=sample(name,[[16,8]]);
   values.independentLines=sample('independentLines',[[16,8]]);
   values.independentPoints=sample('independentPoints',[[16,16]]);
   values.fillFalse=sample('fillFalse',[[16,16]]);
   const lighting=[];let referenceMask=null;
   for(const {name,expected} of native.__lighting||[]){
    replay(name);const colors=new Map(),rgba=new Uint8Array(64*64*4);
    b.readPixels(0,0,64,64,g.RGBA,g.UNSIGNED_BYTE,rgba);
    for(let i=0;i<rgba.length;i+=4){
     const rgb=(rgba[i]<<16)|(rgba[i+1]<<8)|rgba[i+2];
     if(rgb)colors.set(rgb,(colors.get(rgb)||0)+1);
    }
    const mask=Uint8Array.from({length:64*64},(_,i)=>Number(rgba[i*4]!==0||rgba[i*4+1]!==0||rgba[i*4+2]!==0));
    const actual=Array.from(colors,([rgb,count])=>({rgb:[rgb>>>16,(rgb>>>8)&255,rgb&255],count}));
    const ok=actual.length>0&&actual.every(c=>c.rgb.every((v,i)=>Math.abs(v-expected[i])<=1));
    const coverage=actual.reduce((n,c)=>n+c.count,0);
    const pixelDifferences=name.endsWith('_2')?mask.reduce((n,v,i)=>n+(v!==referenceMask[i]),0):0;
    const same=pixelDifferences<=8;referenceMask=mask;
    lighting.push({name,expected,actual,coverage,pixelDifferences,ok,same});
   }
   out.push({version:b.version,apiVersion,values,lighting,error:g.getError()});b.destroy();
  }
  return out;
 },native);
 const expected={
  triangleTrue:[true,true,true],triangleFalse:[false,false,false],triangleMixed:[false,true,false],
  quadTrue:[true,false],polygonMixed:[false,true,false],clippedFalse:[true,false,false],
  clippedQuadFalse:[true,false],collinearFront:[true],clippedBackCull:[false],userClipFalse:[true,false],
  pointMixed:[false,true,false],clippedPointFalse:[true,false,false],indexedStrided:[false,true,false,true,false],
  packedArrays:[true,false,true,false],arrayListSnapshot:[true,false,true,false],listVectorFalse:[false],strip:[true],fan:[true],quadStrip:[true],
  independentLines:[true],independentPoints:[true],fillFalse:[true]
 };
 console.log(JSON.stringify({passed:results.every(r=>r.version===r.apiVersion&&r.error===0&&
  JSON.stringify(r.values)===JSON.stringify(expected)&&r.lighting.length===144&&r.lighting.every(c=>c.ok&&c.same)),results}));
 for(const r of results){assert.strictEqual(r.version,r.apiVersion,'actual WebGL API');assert.deepStrictEqual(r.values,expected);assert.strictEqual(r.error,0);
  assert.strictEqual(r.lighting.length,144,'complete two-sided fixture matrix');
  assert.deepStrictEqual(r.lighting.filter(c=>!c.ok||!c.same),[],'WebGL two-sided boundary lighting and cyclic equivalence');}
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

