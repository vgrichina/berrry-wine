'use strict';
// Literal bitmap boundary regressions on actual WebGL1 and WebGL2.
// No glLogicOp availability or logic-operation claim.
const fs = require('fs'), path = require('path'), {spawn} = require('child_process');
async function probe() {
  const rows=[];
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  for(const apiVersion of [1,2]) for(const bpp of [16,32]) for(const scenario of ['unaccessed','read-only','masked','rgb-write','alpha-write']) {
    const width=3,height=2,stride=bpp===16?8:16;
    const storage=new Uint8Array(stride*height).fill(0x6d);
    const dvBits=new DataView(storage.buffer);
    // Matching RGB, differing only in X / alpha. Third pixel is a second
    // unchanged RGB control. Include non-pixel row padding in the oracle.
    const words=bpp===16?[0xa8c7,0x28c7,0x7fff]:[0x3c283848,0xff283848,0x0096aa55];
    for(let y=0;y<height;y++) for(let x=0;x<width;x++)
      bpp===16?dvBits.setUint16(y*stride+x*2,words[x],true):dvBits.setUint32(y*stride+x*4,words[x],true);
    const before=Array.from(storage),surface=new gdiSurfaceLib.GdiSurface({width,height,bpp,stride,storage,topDown:true});
    const memory=new ArrayBuffer(4096),dv=new DataView(memory);
    const bridge=new OpenGLCompat.OpenGLHostBridge({apiVersion,getMemory:()=>memory,exports:{guest_to_wasm:p=>p},
      getGdiSurface:id=>id===5?{surface}:null,
      createCanvas:(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;}});
    const call=(name,args=[])=>{args.forEach((v,i)=>dv.setUint32(4+i*4,v>>>0,true));return bridge.call(OpenGLCompat.CALL_INDEX[name],0,0);};
    const pixels=()=>{call('glReadPixels',[0,0,width,height,0x1908,0x1401,512]);return Array.from(new Uint8Array(memory,512,width*height*4));};
    try {
      const handle=bridge.createBitmapContext(0x80000005);
      if(!handle||!bridge.makeCurrent(handle,0x80000005))throw Error('real bitmap context creation failed v'+apiVersion);
      call('glViewport',[0,0,width,height]);call('glDisable',[0xbd0]);
      const afterSeed=scenario==='unaccessed'?null:pixels();
      if(!same(Array.from(storage),before))throw Error('read/seed changed canonical input before publication');
      if(!['unaccessed','read-only'].includes(scenario)) {
      call('glColorMask',scenario==='rgb-write'?[1,1,1,0]:scenario==='alpha-write'?[0,0,0,1]:[0,0,0,0]);
      const v=new Float32Array(19);v.set([0,0,0,0,1,0,0.5]);v[14]=1;
      bridge._current().frontend.enqueuePacked(0,v);bridge._current().frontend.flushPendingDraw();
      }
      const afterMasked=scenario==='unaccessed'?null:pixels();
      if(scenario==='masked'&&!same(afterSeed,afterMasked))throw Error('masked draw changed GPU attachment');
      const gl=bridge._current().backend.gl,ext=gl.getExtension('WEBGL_debug_renderer_info');
      const renderer=ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
      bridge.flushFrontBuffer();
      const after=Array.from(storage),afterPublish=pixels(),error=call('glGetError');
      // After publication a frame consisting only of GDI must retain the newer
      // canonical bytes; the next GL read must import those bytes afresh.
      bridge.flushFrontBuffer();
      surface.writeRgbaRect(0,0,1,1,new Uint8Array([0,0,255,78]));
      const freshGdiBefore=Array.from(storage);
      bridge.flushFrontBuffer();
      const freshGdiCanonicalStable=same(freshGdiBefore,Array.from(storage));
      const freshGdiRead=pixels().slice(width*(height-1)*4,width*(height-1)*4+4);
      const differences=after.flatMap((n,i)=>n===before[i]?[]:[{offset:i,before:before[i],after:n}]);
      const paddingOffsets=[];
      for(let y=0;y<height;y++)for(let i=width*bpp/8;i<stride;i++)paddingOffsets.push(y*stride+i);
      rows.push({freshGdiCanonicalStable,freshGdiRead,apiVersion,bpp,scenario,width,height,stride,renderer,before,after,afterSeed,afterMasked,afterPublish,error,
        attachmentUnchangedByMaskedDraw:same(afterSeed,afterMasked),canonicalUnchanged:same(before,after),
        paddingUnchanged:paddingOffsets.every(i=>before[i]===after[i]),differences});
    } finally {bridge.destroy();}
  }
  return rows;
}
async function main() {
  const executable=process.env.CHROME||['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(fs.existsSync);
  if(!executable)throw Error('No installed Chrome/Chromium; downloads excluded');
  const child=spawn(executable,['--headless','--no-sandbox','--no-first-run','--remote-debugging-port=0',
    '--user-data-dir=/tmp/wine-gl-bitmap-boundary-profile','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','about:blank'],{stdio:['ignore','ignore','pipe']});
  let socket,stderr='',next=1;const pending=new Map();
  const guard=setTimeout(()=>{child.kill('SIGKILL');process.exitCode=1;},60000);
  try {
    const endpoint=await new Promise((resolve,reject)=>{
      child.stderr.on('data',b=>{stderr=(stderr+b).slice(-12000);const m=stderr.match(/DevTools listening on (ws:\/\/\S+)/);if(m)resolve(m[1]);});
      child.once('error',reject);child.once('exit',c=>reject(Error('Chrome exited before CDP '+c+' '+stderr)));
    });
    socket=new WebSocket(endpoint);
    await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
    socket.onmessage=event=>{const m=JSON.parse(event.data),p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}};
    const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=next++;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
    const {targetId}=await send('Target.createTarget',{url:'about:blank'});
    const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
    const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},sessionId);if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
    for(const name of ['region-map.generated','gpu-backend','gl-command-stream','mem-utils','gdi-surface','gl-compat'])
      await evaluate(fs.readFileSync(path.join(process.cwd(),'lib',name+'.js'),'utf8'));
    const mutation=process.argv.find(s=>s.startsWith('--mutation='))?.split('=')[1];
    if(mutation==='expose-alpha')await evaluate(`{
      const original=OpenGLCompat.FixedFunctionGL.prototype.applyColorMask;
      OpenGLCompat.FixedFunctionGL.prototype.applyColorMask=function(){this.bitmapNoAlpha=false;return original.call(this);};
    }`);
    if(mutation==='import-alpha')await evaluate(`{
      const original=gdiSurfaceLib.GdiSurface.prototype.rgbaRect;
      gdiSurfaceLib.GdiSurface.prototype.rgbaRect=function(x,y,w,h,out){return original.call(this,x,y,w,h,out);};
    }`);
    if(mutation==='store-alpha'||mutation==='store-padding')await evaluate(`{
      const original=gdiSurfaceLib.GdiSurface.prototype.writeRgbaRect;
      gdiSurfaceLib.GdiSurface.prototype.writeRgbaRect=function(x,y,w,h,p,options={}){
        return original.call(this,x,y,w,h,p,{...options,${mutation==='store-alpha'?'preserveAlpha':'preserveUnusedBits'}:false});
      };
    }`);
    if(mutation==='presentation')await evaluate(`{
      const original=OpenGLCompat.OpenGLHostBridge.prototype._publishToBitmap;
      OpenGLCompat.OpenGLHostBridge.prototype._publishToBitmap=function(c){const b=c.backend;c.backend=null;try{return original.call(this,c);}finally{c.backend=b;}};
    }`);
    const version=await send('Browser.getVersion');
    const rows=await evaluate('('+probe.toString()+')()');
    console.log(JSON.stringify({version,rows},null,2));
    for(const row of rows) {
      const tag='WebGL'+row.apiVersion+' bpp'+row.bpp+' '+row.scenario;
      const equal=(actual,expected,reason)=>{
        if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error(tag+' '+reason+' actual='+JSON.stringify(actual)+' expected='+JSON.stringify(expected));
      };
      if(row.error||!row.paddingUnchanged||!row.freshGdiCanonicalStable)throw Error(tag+' GL error/padding/GDI corruption');
      equal(row.freshGdiRead,[0,0,255,255],'fresh GDI import');
      const seedRow=row.bpp===16?[82,49,58,255,82,49,58,255,255,255,255,255]:[40,56,72,60,40,56,72,255,150,170,85,0];
      const seed=[...seedRow,...seedRow];
      if(row.afterSeed)equal(row.afterSeed,seed,'literal import');
      if(row.scenario==='masked'||(row.bpp===16&&row.scenario==='alpha-write'))equal(row.afterMasked,seed,'zero/unexposed-alpha mask attachment');
      const expected=[...row.before];
      if(row.scenario==='rgb-write') {
        if(row.bpp===16)expected.splice(10,2,0xe0,3);
        else expected.splice(20,3,0,255,0);
      }
      if(row.scenario==='alpha-write'&&row.bpp===32)expected[23]=128;
      equal(row.after,expected,'literal canonical publication');
      if(row.bpp===32) {
        const attachment=[...seed];
        if(row.scenario==='rgb-write')attachment.splice(4,3,0,255,0);
        if(row.scenario==='alpha-write')attachment[7]=128;
        equal(row.afterPublish,attachment,'publication/reimport');
      }
    }
    await send('Browser.close');
  } finally {
    clearTimeout(guard);if(socket)socket.close();if(child.exitCode===null)child.kill('SIGTERM');
  }
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
