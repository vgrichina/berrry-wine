'use strict';
const fs=require('fs'),path=require('path'),{spawn}=require('child_process');
async function exactProbe(workerSource){
 const equal=(a,b,label)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error(label+' actual='+JSON.stringify(a)+' expected='+JSON.stringify(b));};
 const f=x=>{const b=new ArrayBuffer(4),v=new DataView(b);v.setFloat32(0,x,true);return v.getUint32(0,true);};
 // Raw words use numeric 16-bit limbs, including words shaped like NaNs.
 const packed=(bits,raw,{signed=false,float=false,clipped=false}={})=>{
  const v=[],tag=float?0:bits+(signed?256:0),den=2**bits-1;
  const color=Math.fround(signed?(2*raw+1)/den:raw/den),extent=clipped?3:1;
  for(const [x,y] of [[-1,-1],[1,-1],[1,1],[-1,-1],[1,1],[-1,1]]){
   const a=Array(28).fill(0);a.splice(0,7,x*extent,y*extent,0,color,color,color,1);a[14]=1;a[16]=a[18]=1;
   for(let c=0;c<4;c++){const word=c===3?(signed?2**(bits-1)-1:den):raw;a[19+2*c]=word&65535;a[20+2*c]=word>>>16;}
   a[27]=tag;v.push(...a);
  }return v;
 };
 const cases=bpp=>[
  [32,bpp===16?0x07ffffff:0x7fffffff,{},bpp===16?0:127],
  [32,bpp===16?134217728 /* unsigned color value */:0x80000000,{},bpp===16?8:128],
  [16,bpp===16?0x07ff:0x7fff,{},bpp===16?0:127],
  [16,bpp===16?0x0800:0x8000,{},bpp===16?8:128],
  [8,bpp===16?7:127,{},bpp===16?0:127],
  [8,bpp===16?8:128,{},bpp===16?8:128],
  [32,bpp===16?0x07ffffff:0x7fffffff,{float:true},bpp===16?8:128],
  [32,bpp===16?0x07ffffff:0x7fffffff,{clipped:true},bpp===16?8:128],
  [32,0x7fc00001,{},bpp===16?123:127],
  [8,0,{signed:true},bpp===16?0:1],
  [8,63,{signed:true},bpp===16?123:127],
  [16,16384,{signed:true},bpp===16?132:128],
  [32,1073741823,{signed:true},bpp===16?123:127],
 ];
 const rows=[];
 for(const apiVersion of [1,2])for(const bpp of [16,32]){
  const width=3,height=2,stride=bpp===16?8:16,storage=new Uint8Array(stride*height).fill(0x6d);
  const view=new DataView(storage.buffer);for(let y=0;y<height;y++)for(let x=0;x<width;x++)
   bpp===16?view.setUint16(y*stride+x*2,0x8000,true):view.setUint32(y*stride+x*4,0xff000000,true);
  const surface=new gdiSurfaceLib.GdiSurface({width,height,bpp,stride,storage,topDown:true});
  const memory=new ArrayBuffer(8192),dv=new DataView(memory),bridge=new OpenGLCompat.OpenGLHostBridge({apiVersion,
   getMemory:()=>memory,exports:{guest_to_wasm:p=>p},getGdiSurface:id=>id===5?{surface}:null,
   createCanvas:(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;}});
  const call=(name,args=[])=>{args.forEach((a,i)=>dv.setUint32(4+i*4,a>>>0,true));return bridge.call(OpenGLCompat.CALL_INDEX[name],0,0);};
  try{
   const ctx=bridge.createBitmapContext(0x80000005);if(!ctx||!bridge.makeCurrent(ctx,0x80000005))throw Error('real WebGL context '+apiVersion);
   call('glViewport',[0,0,width,height]);call('glDisable',[0xbd0]);
   const backend=bridge._current().backend;if(backend.version!==apiVersion)throw Error('requested WebGL version unavailable');
   for(const [bits,raw,options,level]of cases(bpp)){
    const vertices=packed(bits,raw,options),bytes=32+vertices.length*4;
    new Uint8Array(memory,1024,bytes).fill(0);dv.setUint32(1024,bytes,true);dv.setUint32(1028,0x10002,true);
    dv.setUint32(1032,4,true);dv.setUint32(1044,vertices.length*4,true);dv.setUint32(1048,32,true);dv.setUint32(1052,1,true);
    new Float32Array(memory,1056,vertices.length).set(vertices);
    bridge.replay(GLCommandStream.memoryBatch(memory,1024,bytes));
    call('glReadPixels',[0,0,width,height,0x1908,0x1401,512]);
    const pixel=Array.from(new Uint8Array(memory,512,4));equal(pixel,[level,level,level,255],'WebGL'+apiVersion+' bpp'+bpp+' raw'+raw+' '+JSON.stringify(options));
    bridge.flushFrontBuffer();
    for(let y=0;y<height;y++)for(let i=width*bpp/8;i<stride;i++)equal(storage[y*stride+i],0x6d,'row padding');
    rows.push({apiVersion,bpp,bits,raw,options,pixel});
   }
   equal(call('glGetError'),0,'direct final error');
  }finally{bridge.destroy();}
 }
 function workerStart(){
  const memory={buffer:new ArrayBuffer(8192)},dv=new DataView(memory.buffer);
  const endpoint=GLRenderWorker.create({instance:{exports:{guest_to_wasm:p=>p}},memory,backend:'webgl',sendFrame(){}});
  self.onmessage=({data:d})=>{try{
   const n=d.packed?.length||0,stack=n?0:(d.args.length+1)*4,bytes=32+stack+n*4;
   new Uint8Array(memory.buffer,0,bytes).fill(0);dv.setUint32(0,bytes,true);dv.setUint32(4,n?0x10002:OpenGLCompat.CALL_INDEX[d.name],true);
   dv.setUint32(8,d.aux||0,true);dv.setUint32(12,stack,true);
   if(n){dv.setUint32(20,n*4,true);dv.setUint32(24,32,true);dv.setUint32(28,1,true);new Float32Array(memory.buffer,32,n).set(d.packed);}
   else d.args.forEach((a,i)=>dv.setUint32(36+i*4,a>>>0,true));
   const r=endpoint.execute({memoryOffset:0,bytes,owner:1,surfaces:d.surfaces});
   self.postMessage({id:d.id,value:r.value,pixel:Array.from(new Uint8Array(memory.buffer,512,4))});
  }catch(e){self.postMessage({id:d.id,error:String(e),stack:e.stack});}};
 }
 const url=URL.createObjectURL(new Blob([workerSource,'\n('+workerStart.toString()+')();'],{type:'text/javascript'})),worker=new Worker(url);
 let next=0;const pending=new Map();worker.onmessage=({data:d})=>{const p=pending.get(d.id);if(p){pending.delete(d.id);d.error?p.reject(Error(d.error+'\n'+d.stack)):p.resolve(d);}};
 worker.onerror=e=>{for(const p of pending.values())p.reject(Error(e.message));pending.clear();};
 const call=(name,args=[],aux=0,vertices,surfaces)=>new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});worker.postMessage({id,name,args,aux,packed:vertices,surfaces});});
 try{
  const ctx=(await call('wglCreateContext',[1],0x80000005,undefined,[{id:5,width:1,height:1,bpp:16,colorMasks:[0x7c00,0x3e0,31],pixels:new Uint8ClampedArray([0,0,0,255])}])).value;
  if(!ctx)throw Error('browser Worker context failed');equal((await call('wglMakeCurrent',[1,ctx],0x80000005)).value,1,'worker bind');
  await call('glViewport',[0,0,1,1]);await call('glDisable',[0xbd0]);
  for(const [bits,raw,options,level]of cases(16)){
   await call(null,[],4,packed(bits,raw,options));const pixel=(await call('glReadPixels',[0,0,1,1,0x1908,0x1401,512])).pixel;
   equal(pixel,[level,level,level,255],'actual browser Worker exact source '+raw+' '+JSON.stringify(options));rows.push({actualBrowserWorker:true,bits,raw,options,pixel});
  }equal((await call('glGetError')).value,0,'worker final error');
 }finally{worker.terminate();URL.revokeObjectURL(url);}
 return rows;
}
async function main(){
 const executable=process.env.CHROME||['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(fs.existsSync);
 if(!executable)throw Error('No installed Chrome/Chromium');
 const child=spawn(executable,['--headless','--no-sandbox','--no-first-run','--remote-debugging-port=0','--user-data-dir=/tmp/wine-gl-exact-source-profile','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','about:blank'],{stdio:['ignore','ignore','pipe']});
 let socket,stderr='',next=1;const pending=new Map(),guard=setTimeout(()=>child.kill('SIGKILL'),60000);
 try{
  const endpoint=await new Promise((resolve,reject)=>{child.stderr.on('data',b=>{stderr=(stderr+b).slice(-12000);const m=stderr.match(/DevTools listening on (ws:\/\/\S+)/);if(m)resolve(m[1]);});child.once('error',reject);child.once('exit',c=>reject(Error('Chrome exited '+c+' '+stderr)));});
  socket=new WebSocket(endpoint);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});socket.onmessage=event=>{const m=JSON.parse(event.data),p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}};
  const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=next++;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
  const {targetId}=await send('Target.createTarget',{url:'about:blank'}),{sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},sessionId);if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  let sources='';for(const name of ['region-map.generated','gpu-backend','gl-command-stream','mem-utils','gdi-surface','gl-compat','gl-render-worker']){
   let source=fs.readFileSync(path.join(process.cwd(),'lib',name+'.js'),'utf8');
   const mutation=process.argv.find(s=>s.startsWith('--mutation='))?.slice(11);
   if(name==='gl-compat'&&mutation==='erase-source'){
    const needle='tag=p.source?.[0]||0;';if(!source.includes(needle))throw Error('mutation anchor');source=source.replace(needle,'tag=0;');
   }
   if(name==='gl-compat'&&mutation==='retain-clipped'){
    const needle='dist:a.dist.map((x,i)=>x+(b.dist[i]-x)*t),source:null';if(!source.includes(needle))throw Error('mutation anchor');source=source.replace(needle,'dist:a.dist.map((x,i)=>x+(b.dist[i]-x)*t),source:a.source');
   }
   sources+=source+'\n';await evaluate(source);
  }
  const rows=await evaluate('('+exactProbe.toString()+')('+JSON.stringify(sources)+')');
  console.log(JSON.stringify({passed:true,rows,version:await send('Browser.getVersion')}));
 }finally{clearTimeout(guard);if(socket)socket.close();child.kill('SIGKILL');}
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
