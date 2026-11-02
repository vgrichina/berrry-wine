#!/usr/bin/env node
'use strict';
const assert=require('assert'),path=require('path');
const fs=require('fs'),os=require('os'),{spawn}=require('child_process');
const mutation=process.env.GL_STIPPLE_WEB_MUTATION?JSON.parse(fs.readFileSync(process.env.GL_STIPPLE_WEB_MUTATION)):null;let mutationApplied=false;
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

// Generate command bytes through the native encoder with software rendering
// disabled. The browser below consumes those exact owned records.
async function nativeCases(){
 const {bootRenderHarness}=require('./render-helper'),S=require('../lib/gl-command-stream'),O=require('../lib/gl-compat').CALL_INDEX;
 let memory;let batches=[];
 const h=await bootRenderHarness({fonts:'none',extraHostOverrides:{gpu_gl_call(op,p,n){
  assert.strictEqual(op,S.WAT_STREAM_FLUSH_OPCODE);const batch=S.memoryBatch(memory,p,n);
  const bytes=new Uint8Array(batch.buffer,batch.byteOffset||0,batch.bytes).slice();let wgl=false;
  const result=S.replay({buffer:bytes.buffer,bytes:bytes.byteLength},code=>{if(code===O.wglCreateContext||code===O.wglMakeCurrent){wgl=true;return 1;}return 0;});
  if(!wgl)batches.push(Array.from(bytes));return result;
 }}});
 memory=h.memory;const e=h.exports,dv=new DataView(memory.buffer),wa=p=>e.guest_to_wasm(p)>>>0;
 e.init_thread(1,0x400000,0,0,0,0,0);e.heap_init(0x800000);assert.strictEqual(e.gl_sw_enabled(),0);
 const stack=wa(e.guest_alloc(256)),input=e.guest_alloc(512)>>>0,output=e.guest_alloc(128)>>>0;
 function call(name,args=[]){new Uint8Array(memory.buffer,stack,256).fill(0);args.forEach((v,i)=>name==='glOrtho'?dv.setFloat64(stack+4+i*8,v,true):['glColor4f','glVertex2f'].includes(name)?dv.setFloat32(stack+4+i*4,v,true):dv.setUint32(stack+4+i*4,v>>>0,true));return e.gl_wat_encoder_call(O[name],stack,name.startsWith('wgl')?42:0)>>>0;}
 assert.strictEqual(call('wglCreateContext',[0]),1);assert.strictEqual(call('wglMakeCurrent',[0,1]),1);
 call('glViewport',[0,0,64,64]);call('glMatrixMode',[0x1701]);call('glLoadIdentity');call('glOrtho',[0,64,0,64,-1,1]);call('glMatrixMode',[0x1700]);call('glLoadIdentity');call('glColor4f',[1,1,1,1]);
 const draw=(mode,pts)=>{call('glBegin',[mode]);pts.forEach(p=>call('glVertex2f',p));call('glEnd');};
 const take=()=>{e.gl_wat_stream_flush();const result=batches;batches=[];return result;};
 call('glLineStipple',[2,5]);call('glEnable',[0xb24]);call('glClear',[0x4500]);draw(1,[[4,10],[12,10]]);const factor=take();
 call('glLineStipple',[1,3]);call('glClear',[0x4500]);draw(3,[[4,10],[9,10],[14,10]]);const strip=take();
 call('glLineStipple',[1,0x1111]);call('glClear',[0x4500]);draw(2,[[4,10],[9,10],[9,15],[4,15]]);const loop=take();call('glLineStipple',[1,3]);
 call('glPushAttrib',[4]);call('glDisable',[0xb24]);call('glLineStipple',[9,0]);call('glPopAttrib');call('glGetIntegerv',[0xb26,output]);assert.strictEqual(dv.getInt32(wa(output),true),1);assert.strictEqual(call('glIsEnabled',[0xb24]),1);call('glDisable',[0xb24]);
 const mask=new Uint8Array(128);mask.set([128,0,0,1]);mask.set([64,0,0,2],4);mask.set([0,0,0,128],124);
 new Uint8Array(memory.buffer,wa(input),128).set(mask);const list=call('glGenLists',[1]);call('glNewList',[list,0x1300]);call('glPolygonStipple',[input]);call('glEndList');
 new Uint8Array(memory.buffer,wa(input),128).fill(0);call('glPixelStorei',[0xcf1,1]);call('glPixelStorei',[0xcf3,3]);call('glCallList',[list]);
 call('glGetPolygonStipple',[output]);assert.deepStrictEqual(Array.from(new Uint8Array(memory.buffer,wa(output),128)),Array.from(mask),'WebGL-route native getter/list capture');
 call('glEnable',[0xb42]);call('glClear',[0x4500]);draw(7,[[0,0],[64,0],[64,64],[0,64]]);const polygon=take();
 return {factor,strip,loop,polygon};
}

// Exercise the actual command decoder and fragment shaders, in both APIs.
(async()=>{
 const native=await nativeCases();const browser=await launchBrowser();try{
 const page=await browser.newPage();
 for(const name of ['region-map.generated','mem-utils','gpu-backend','gl-command-stream','gl-compat'])await page.addScriptTag({path:path.join(__dirname,'../lib/'+name+'.js')});
 assert(!mutation||mutationApplied);
 const results=await page.evaluate((native)=>{
 const out=[];
 for(const apiVersion of [1,2]){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
  const b=new GpuBackend.WebGLBackend(canvas,{apiVersion,stencil:true}),g=b.gl;
  const f=new OpenGLCompat.FixedFunctionGL(b),mem=new ArrayBuffer(4096);
  const bridge=new OpenGLCompat.OpenGLHostBridge({getMemory:()=>mem,exports:{guest_to_wasm:p=>p}});
  bridge.contexts.set(1,{frontend:f,backend:b});bridge.current=1;
  b.setViewport(0,0,64,64);f.matrices[0x1701]=[OpenGLCompat.ortho(0,64,0,64,-1,1)];
  f.uniformDirty.add('uProjection');
  function record(op,args=[],payload=null,aux=0){
   const n=32+(args.length+1)*4+(payload?.byteLength||0),buf=new ArrayBuffer(n),d=new DataView(buf);
   d.setUint32(0,n,true);d.setUint32(4,op,true);d.setUint32(8,aux,true);d.setUint32(12,(args.length+1)*4,true);
   args.forEach((v,i)=>d.setUint32(36+i*4,v>>>0,true));
   if(payload){const at=32+(args.length+1)*4;d.setUint32(20,payload.byteLength,true);d.setUint32(24,at,true);new Uint8Array(buf,at).set(new Uint8Array(payload.buffer,payload.byteOffset,payload.byteLength));}
   bridge.replay({buffer:buf,bytes:n,commands:1});return buf;
  }
  const call=(name,args=[])=>record(OpenGLCompat.CALL_INDEX[name],args);
  function draw(mode,points,color=[1,1,1,1]){const v=new Float32Array(points.length*19);points.forEach((p,i)=>v.set([p[0],p[1],p[2]||0,...color,0,0,0,0,0,0,1,p[3]===undefined?1:p[3],1,1,1,1],i*19));record(0x10000,[],v,mode);f.flushPendingDraw();}
  const clear=()=>{g.clearColor(0,0,0,1);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT|g.STENCIL_BUFFER_BIT);};
  const bits=(xs,y)=>xs.map(x=>b.readPixels(x,y,1,1,g.RGBA,g.UNSIGNED_BYTE,new Uint8Array(4))[0]?'1':'0').join('');
  const xs=Array.from({length:8},(_,i)=>i+4);
  call('glLineStipple',[2,5]);call('glEnable',[0xb24]);clear();draw(1,[[4,10],[12,10]]);const factor=bits(xs,9);
  call('glLineStipple',[1,3]);clear();draw(1,[[4,10],[9,10],[9,10],[14,10]]);const independent=bits(Array.from({length:10},(_,i)=>i+4),9);
  clear();draw(0x1000001,[[4,10],[9,10],[9,10],[14,10]]);const connected=bits(Array.from({length:10},(_,i)=>i+4),9);
  clear();draw(0x1000001,[[4,10],[9,10]]);draw(0x3000001,[[9,10],[14,10]]);const continuation=bits(Array.from({length:10},(_,i)=>i+4),9);
  clear();draw(0x1000001,[[4,10],[9,10]]);draw(0x1000001,[[9,10],[14,10]]);const reset=bits(Array.from({length:10},(_,i)=>i+4),9);
  call('glLineStipple',[1,5]);clear();draw(1,[[4.25,10.25],[12.25,10.25]]);const fractional=bits(xs,10);
  clear();draw(1,[[12,10],[4,10]]);const reverse=bits([11,10,9,8,7,6,5,4],9);
  clear();draw(1,[[4.25,10.25],[12.25,18.25]]);const diagonal=xs.map((x,i)=>bits([x],10+i)).join('');
  clear();draw(1,[[10,4],[10,12]]);const vertical=[4,5,6,7,8,9,10,11].map(y=>bits([9],y)).join('');
  call('glLineStipple',[1,1]);clear();draw(1,[[4,10],[24,10]]);const wrap=bits(Array.from({length:20},(_,i)=>i+4),9);
  call('glDisable',[0xb24]);
  const mask=new Uint8Array(128);mask.set([128,0,0,1]);mask.set([64,0,0,2],4);mask.set([0,0,0,128],124);
  const owned=record(OpenGLCompat.CALL_INDEX.glPolygonStipple,[0],mask,1);mask.fill(0);new Uint8Array(owned,40).fill(0);call('glEnable',[0xb42]);
  clear();draw(4,[[0,0],[64,0],[64,64],[0,0],[64,64],[0,64]]);
  const row0=bits([0,1,24,30,31,32,33,56,62,63],32),row1=bits([0,1,24,30,31,32,33,56,62,63],33),row31=bits([20,23,24,25,31,32,55,56,57],31);
  b.setViewport(5,7,48,48);clear();draw(4,[[0,0],[64,0],[64,64],[0,0],[64,64],[0,64]]);const anchored=bits([30,31,32,33],32);
  b.setViewport(0,0,64,64);b.setCapability(g.DEPTH_TEST,true);b.setDepthFunc(g.LESS);clear();
  draw(4,[[0,0],[64,0],[64,64],[0,0],[64,64],[0,64]],[1,0,0,1]);call('glDisable',[0xb42]);
  draw(4,[[0,0,-.5],[64,0,-.5],[64,64,-.5],[0,0,-.5],[64,64,-.5],[0,64,-.5]],[0,0,1,1]);
  const depthSurvivor=Array.from(b.readPixels(31,32,1,1,g.RGBA,g.UNSIGNED_BYTE,new Uint8Array(4))),depthHole=Array.from(b.readPixels(30,32,1,1,g.RGBA,g.UNSIGNED_BYTE,new Uint8Array(4)));
  b.setCapability(g.DEPTH_TEST,false);call('glEnable',[0xb42]);b.setCapability(g.STENCIL_TEST,true);b.setStencilFunc(g.FRONT_AND_BACK,g.ALWAYS,1,255);b.setStencilOp(g.FRONT_AND_BACK,g.KEEP,g.KEEP,g.REPLACE);clear();
  draw(4,[[0,0],[64,0],[64,64],[0,0],[64,64],[0,64]]);call('glDisable',[0xb42]);b.setStencilFunc(g.FRONT_AND_BACK,g.EQUAL,0,255);b.setStencilOp(g.FRONT_AND_BACK,g.KEEP,g.KEEP,g.KEEP);
  draw(4,[[0,0],[64,0],[64,64],[0,0],[64,64],[0,64]],[0,1,0,1]);
  const stencilSurvivor=Array.from(b.readPixels(31,32,1,1,g.RGBA,g.UNSIGNED_BYTE,new Uint8Array(4))),stencilHole=Array.from(b.readPixels(30,32,1,1,g.RGBA,g.UNSIGNED_BYTE,new Uint8Array(4)));
  b.setCapability(g.STENCIL_TEST,false);
  // Clipped initial phase is indeterminate; its period/count remain defined.
  call('glEnable',[0xb24]);call('glLineStipple',[1,0x5555]);clear();draw(1,[[-4,10],[12,10]]);
  const clipPeriod=bits(Array.from({length:12},(_,i)=>i),9);
  // Homogeneous clipping must also keep counter uniforms finite at zero or
  // negative W. ANGLE's solid control for this degenerate probe emits no pixels.
  const oldProjection=f.matrices[0x1701],lineUniforms=[],setUniform=b.setUniform.bind(b);
  b.setUniform=(program,name,type,value)=>{if(name==='uLineStipple')lineUniforms.push(Array.from(value));return setUniform(program,name,type,value);};
  f.matrices[0x1701]=[OpenGLCompat.identity()];f.uniformDirty.add('uProjection');call('glEnable',[0xb24]);call('glLineStipple',[1,1]);clear();
  draw(1,[[-2,0,0,-1],[.5,0,0,1]]);
  draw(1,[[0,0,0,0],[.5,0,0,1]]);const finite=lineUniforms.every(v=>v.every(Number.isFinite));
  b.setUniform=setUniform;f.matrices[0x1701]=oldProjection;f.uniformDirty.add('uProjection');call('glDisable',[0xb24]);
  // Both attribute enables and parameters survive their own groups only.
  call('glEnable',[0xb42]);call('glPushAttrib',[4]);call('glDisable',[0xb42]);call('glEnable',[0xb24]);call('glLineStipple',[6,9]);call('glPopAttrib');
  const attrib=[f.enabled.has(0xb24),f.enabled.has(0xb42),f.lineFactor,f.linePattern];
  // Replay the native-produced state and packed geometry unchanged.
  call('glDisable',[0xb42]);b.setViewport(0,0,64,64);
  const replay=key=>{for(const bytes of native[key]){const buf=new Uint8Array(bytes).buffer;bridge.replay({buffer:buf,bytes:buf.byteLength});}f.flushPendingDraw();};
  replay('factor');const nativeFactor=bits(xs,9);replay('strip');const nativeStrip=bits(Array.from({length:10},(_,i)=>i+4),9);
  replay('loop');const nativeLoop=[bits([4,5,6,7,8],9),[10,11,12,13,14].map(y=>bits([8],y)).join(''),[14,13,12,11,10].map(y=>bits([3],y)).join('')];
  replay('polygon');const nativePolygon=bits([0,1,24,30,31,32,33,56,62,63],32);
  out.push({nativeLoop,diagonal,vertical,clipPeriod,finite,nativeFactor,nativeStrip,nativePolygon,version:b.version,widthRange:Array.from(g.getParameter(g.ALIASED_LINE_WIDTH_RANGE)),fractional,reverse,wrap,depthSurvivor,depthHole,stencilSurvivor,stencilHole,attrib,apiVersion,factor,independent,connected,continuation,reset,row0,row1,row31,anchored,error:g.getError()});b.destroy();
 }return out;
 },native);
 for(const r of results){
  assert.strictEqual(r.version,r.apiVersion,'actual WebGL API');
  for(const name of ['diagonal','vertical','fractional','reverse'])assert.strictEqual(r[name],'10100000',name+' pixel phase');
  assert.strictEqual(r.finite,true,'finite homogeneous counter');assert(['101010101010','010101010101'].includes(r.clipPeriod),'clipped period');
  assert.strictEqual(r.nativeFactor,'11001100','native producer line factor');assert.strictEqual(r.nativeStrip,'1100000000','native producer strip phase');assert.strictEqual(r.nativePolygon,'1000110001','native producer owned list mask');
  assert.deepStrictEqual(r.nativeLoop,['10001','00010','01000'],'native producer loop closing phase');
  assert.strictEqual(r.factor,'11001100','factor2 pixels');assert.strictEqual(r.wrap,'10000000000000001000','pattern16 wrap');
  assert.strictEqual(r.independent,'1100011000','independent reset');assert.strictEqual(r.connected,'1100000000','connected strip phase');assert.strictEqual(r.continuation,'1100000000','record continuation');assert.strictEqual(r.reset,'1100011000','Begin resets');
  assert.strictEqual(r.row0,'1000110001','polygon row0 window anchor');assert.strictEqual(r.row1,'0101001010','polygon row1 orientation');assert.strictEqual(r.row31,'001000010','polygon row31 orientation');assert.strictEqual(r.anchored,'0110','viewport-independent anchor');
  assert.deepStrictEqual(r.depthSurvivor,[255,0,0,255],'surviving depth writes');assert.deepStrictEqual(r.depthHole,[0,0,255,255],'discard leaves depth untouched');
  assert.deepStrictEqual(r.stencilSurvivor,[255,255,255,255],'surviving stencil writes');assert.deepStrictEqual(r.stencilHole,[0,255,0,255],'discard leaves stencil untouched');
  assert.deepStrictEqual(r.attrib,[false,false,1,1],'line attribute group');assert.strictEqual(r.error,0,'WebGL errors');
 }
 console.log(JSON.stringify({passed:true,results}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
