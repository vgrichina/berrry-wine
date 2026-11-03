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
      const componentBits=[0xd52,0xd53,0xd54,0xd55].map(p=>{
        call('glGetIntegerv',[p,512]);return dv.getInt32(512,true);
      });
      const afterSeed=scenario==='unaccessed'?null:pixels();
      if(!same(Array.from(storage),before))throw Error('read/seed changed canonical input before publication');
      if(!['unaccessed','read-only'].includes(scenario)) {
      call('glColorMask',scenario==='rgb-write'?[1,1,1,0]:scenario==='alpha-write'?[0,0,0,1]:[0,0,0,0]);
      const v=new Float32Array(19);v.set([0,0,0,0,1,0,bpp===16?0:0.5]);v[14]=1;
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
      const storageCases=[],storageBefore=Array.from(storage);
      if(scenario==='read-only') {
        const draw=(value,count=1,alpha=.5)=>{
          const packed=new Float32Array(19*count);
          for(let i=0;i<count;i++){packed.set([0,0,0,value/255,value/255,value/255,alpha],i*19);packed[i*19+14]=1;}
          bridge._current().frontend.enqueuePacked(0,packed);bridge._current().frontend.flushPendingDraw();
        };
        call('glColorMask',[1,1,1,0]);
        for(const value of [0,7,8,15,16,79,80,87,88,247,248,255]) {
          draw(value);const immediate=pixels().slice(4,8);bridge.flushFrontBuffer();
          storageCases.push({value,immediate,published:pixels().slice(4,8),canonical:Array.from(storage)});
        }
        // Fixed-function blending must read the *stored* five-bit result of
        // the preceding fragment, including two overlapping points in one batch.
        for(const batched of [false,true]) {
          call('glDisable',[0xbe2]);draw(0);call('glEnable',[0xbe2]);call('glBlendFunc',[0x302,0x303]);
          if(batched)draw(255,2);else{draw(255);draw(255);}
          const immediate=pixels().slice(4,8);bridge.flushFrontBuffer();
          storageCases.push({batched,immediate,published:pixels().slice(4,8),canonical:Array.from(storage)});
        }
        call('glDisable',[0xbe2]);
        const f=x=>{dv.setFloat32(4000,x,true);return dv.getUint32(4000,true);};
        call('glColorMask',[1,1,1,1]);call('glClearAccum',[.25,.5,.75,0].map(f));
        call('glClear',[0x200]);call('glAccum',[0x102,f(1)]);
        const immediate=pixels().slice(4,8);bridge.flushFrontBuffer();
        storageCases.push({accumulationReturn:true,immediate,published:pixels().slice(4,8),canonical:Array.from(storage)});
        call('glColorMask',[1,1,1,1]);draw(0,1,0);
        call('glColorMask',[1,0,1,0]);call('glClearAccum',[.0162,.0162,.0162,0].map(f));
        call('glClear',[0x200]);call('glAccum',[0x102,f(1)]);
        const precision=pixels().slice(4,8);bridge.flushFrontBuffer();
        storageCases.push({accumulationPrecision:true,immediate:precision,published:pixels().slice(4,8),canonical:Array.from(storage)});
        call('glColorMask',[1,1,1,1]);draw(16,1,0);
        call('glColorMask',[1,1,1,0]);call('glAccum',[0x101,f(.252)]);call('glAccum',[0x102,f(1)]);
        const loaded=pixels().slice(4,8);bridge.flushFrontBuffer();
        storageCases.push({accumulationLoadPrecision:true,immediate:loaded,published:pixels().slice(4,8),canonical:Array.from(storage)});
        for(let mask=0;mask<16;mask++) {
          call('glColorMask',[1,1,1,1]);draw(0,1,0);
          call('glColorMask',[0,1,2,3].map(i=>Number(!!(mask&(1<<i)))));draw(255);
          const immediate=pixels().slice(4,8);bridge.flushFrontBuffer();
          storageCases.push({mask,immediate,published:pixels().slice(4,8),canonical:Array.from(storage)});
        }
      }
      const storageError=call('glGetError');
      rows.push({componentBits,storageError,storageBefore,storageCases,freshGdiCanonicalStable,freshGdiRead,apiVersion,bpp,scenario,width,height,stride,renderer,before,after,afterSeed,afterMasked,afterPublish,error,
        attachmentUnchangedByMaskedDraw:same(afterSeed,afterMasked),canonicalUnchanged:same(before,after),
        paddingUnchanged:paddingOffsets.every(i=>before[i]===after[i]),differences});
    } finally {bridge.destroy();}
  }
  return rows;
}
async function queuedBitmapProbe(source) {
  function start() {
    const memory={buffer:new ArrayBuffer(4096)},v=new DataView(memory.buffer);
    const endpoint=GLRenderWorker.create({instance:{exports:{guest_to_wasm:p=>p}},memory,backend:'webgl',sendFrame(){}});
    self.onmessage=({data:d})=>{try{
      const args=d.args||[],packed=d.packed,stack=packed?0:(args.length+1)*4,bytes=32+stack+(packed?packed.length*4:0);
      new Uint8Array(memory.buffer,0,bytes).fill(0);
      v.setUint32(0,bytes,true);v.setUint32(4,packed?0x10000:OpenGLCompat.CALL_INDEX[d.name],true);
      v.setUint32(8,d.aux||0,true);v.setUint32(12,stack,true);
      if(packed){v.setUint32(20,packed.length*4,true);v.setUint32(24,32,true);v.setUint32(28,1,true);new Float32Array(memory.buffer,32,packed.length).set(packed);}
      else args.forEach((a,i)=>v.setUint32(36+i*4,a>>>0,true));
      const result=endpoint.execute({memoryOffset:0,bytes,owner:1,surfaces:d.surfaces});
      self.postMessage({id:d.id,value:result.value,pixel:Array.from(new Uint8Array(memory.buffer,512,4)),integer:v.getInt32(512,true)});
    }catch(e){self.postMessage({id:d.id,error:String(e),stack:e.stack});}};
  }
  const url=URL.createObjectURL(new Blob([source,'\n('+start.toString()+')();'],{type:'text/javascript'}));
  const worker=new Worker(url),pending=new Map();let next=0;
  const guard=setTimeout(()=>{for(const p of pending.values())p.reject(Error('bitmap worker timeout'));},30000);
  worker.onmessage=({data:d})=>{const p=pending.get(d.id);if(p){pending.delete(d.id);d.error?p.reject(Error(d.error+'\n'+d.stack)):p.resolve(d);}};
  worker.onerror=e=>{for(const p of pending.values())p.reject(Error(e.message));pending.clear();};
  const call=(name,args=[],aux=0,packed,surfaces)=>new Promise((resolve,reject)=>{
    const id=++next;pending.set(id,{resolve,reject});worker.postMessage({id,name,args,aux,packed,surfaces});
  });
  const equal=(a,b,label)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error('actual bitmap worker '+label+' '+JSON.stringify(a)+' expected '+JSON.stringify(b));};
  const read=async()=> (await call('glReadPixels',[0,0,1,1,0x1908,0x1401,512])).pixel;
  const draw=async(value,count=1)=>{
    const p=Array(19*count).fill(0);
    for(let i=0;i<count;i++){p.splice(i*19,7,0,0,0,value/255,value/255,value/255,.5);p[i*19+14]=1;}
    await call(null,[],0,p);
  };
  try {
    const ctx=(await call('wglCreateContext',[1],0x80000005,undefined,[{id:5,width:1,height:1,bpp:16,colorMasks:[0x7c00,0x03e0,0x001f],pixels:new Uint8ClampedArray([0,0,0,255])}])).value;
    if(!ctx)throw Error('actual bitmap worker context creation');
    equal((await call('wglMakeCurrent',[1,ctx],0x80000005)).value,1,'bind');
    await call('glViewport',[0,0,1,1]);await call('glDisable',[0xbd0]);await call('glColorMask',[1,1,1,0]);
    const bits=[];for(const p of [0xd52,0xd53,0xd54,0xd55])bits.push((await call('glGetIntegerv',[p,512])).integer);
    equal(bits,[5,5,5,0],'stored width metadata');
    const rows=[],values=[0,7,8,15,16,79,80,87,88,247,248,255],levels=[0,8,8,16,16,82,82,90,90,247,247,255];
    for(let i=0;i<values.length;i++){
      await draw(values[i]);const immediate=await read();await call('glFlush');const published=await read();
      equal(immediate,[levels[i],levels[i],levels[i],255],'immediate '+values[i]);equal(published,immediate,'published '+values[i]);
      rows.push({value:values[i],immediate,published});
    }
    for(const batched of [false,true]){
      await call('glDisable',[0xbe2]);await draw(0);await call('glEnable',[0xbe2]);await call('glBlendFunc',[0x302,0x303]);
      if(batched)await draw(255,2);else{await draw(255);await draw(255);}
      const pixel=await read();equal(pixel,[197,197,197,255],'overlap '+batched);rows.push({batched,pixel});
    }
    await call('glDisable',[0xbe2]);await call('glColorMask',[1,1,1,1]);
    const f=x=>{const b=new ArrayBuffer(4),v=new DataView(b);v.setFloat32(0,x,true);return v.getUint32(0,true);};
    await call('glClearAccum',[.25,.5,.75,0].map(f));await call('glClear',[0x200]);await call('glAccum',[0x102,f(1)]);
    equal(await read(),[66,132,189,255],'accumulation RETURN');equal((await call('glGetError')).value,0,'final error');
    await call('glColorMask',[1,1,1,1]);await draw(0);
    await call('glColorMask',[1,0,1,0]);await call('glClearAccum',[.0162,.0162,.0162,0].map(f));
    await call('glClear',[0x200]);await call('glAccum',[0x102,f(1)]);
    equal(await read(),[8,0,8,255],'direct stored-width RETURN with component mask');
    equal((await call('glGetError')).value,0,'precision RETURN error');
    await call('glColorMask',[1,1,1,0]);await draw(16);
    await call('glAccum',[0x101,f(.252)]);await call('glAccum',[0x102,f(1)]);
    equal(await read(),[8,8,8,255],'stored-width LOAD normalization');equal((await call('glGetError')).value,0,'LOAD precision error');
    return {actualBrowserWorker:true,componentBits:bits,rows,loadPrecision:[8,8,8,255],accumulation:[66,132,189,255],precisionReturn:[8,0,8,255]};
  } finally {clearTimeout(guard);worker.terminate();URL.revokeObjectURL(url);}
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
    const mutation=process.argv.find(s=>s.startsWith('--mutation='))?.split('=')[1];
    for(const name of ['region-map.generated','gpu-backend','gl-command-stream','mem-utils','gdi-surface','gl-compat','gl-render-worker'])
    {
      let source=fs.readFileSync(path.join(process.cwd(),'lib',name+'.js'),'utf8');
      if(name==='gpu-backend'&&mutation==='accumulation-byte-load') {
        const needle="d.colorFormat === 'rgb555' && c < 3 ? Math.round(pixels[i] * 31 / 255) / 31 : pixels[i] / 255";
        if(!source.includes(needle))throw Error('byte LOAD mutation target missing');
        source=source.replace(needle,'pixels[i] / 255');
      }
      if(name==='gpu-backend'&&mutation==='accumulation-double-round') {
        const needle='Math.min(1, a[i] * value)) * 31';
        if(!source.includes(needle))throw Error('double-round mutation target missing');
        source=source.replace(needle,'Math.min(1, Math.round(a[i] * value * 255) / 255)) * 31');
      }
      await evaluate(source);
    }
    if(mutation==='private-rgba8')await evaluate(`{
      const original=GpuBackend.WebGLBackend.prototype.createDrawable;
      GpuBackend.WebGLBackend.prototype.createDrawable=function(id,w,h,single){return original.call(this,id,w,h,single);};
    }`);
    if(mutation==='private-alpha-query')await evaluate(`{
      const original=OpenGLCompat.OpenGLHostBridge.prototype._getState;
      OpenGLCompat.OpenGLHostBridge.prototype._getState=function(f,p,...args){
        const saved=f.bitmapNoAlpha;if(p===0xd55)f.bitmapNoAlpha=false;
        try{return original.call(this,f,p,...args);}finally{f.bitmapNoAlpha=saved;}
      };
    }`);
    if(mutation==='accumulation-byte'||mutation==='accumulation-alpha')await evaluate(`{
      const original=GpuBackend.WebGLBackend.prototype.accumulate;
      GpuBackend.WebGLBackend.prototype.accumulate=function(...args){
        const gl=this.gl,upload=gl.texSubImage2D;
        gl.texSubImage2D=function(...values){
          if(values[7]===gl.UNSIGNED_SHORT_5_5_5_1){
            if(${JSON.stringify(mutation)}==='accumulation-byte'){
              values[7]=gl.UNSIGNED_BYTE;values[8]=new Uint8Array(values[4]*values[5]*4);
            }else values[8]=Uint16Array.from(values[8],x=>x&~1);
          }
          return upload.apply(this,values);
        };
        try{return original.apply(this,args);}finally{gl.texSubImage2D=upload;}
      };
    }`);
    if(mutation==='expose-alpha')await evaluate(`{
      const original=OpenGLCompat.FixedFunctionGL.prototype.applyColorMask;
      OpenGLCompat.FixedFunctionGL.prototype.applyColorMask=function(){
        const saved=this.bitmapNoAlpha;this.bitmapNoAlpha=false;
        try{return original.call(this);}finally{this.bitmapNoAlpha=saved;}
      };
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
      if(row.error||row.storageError||!row.paddingUnchanged||!row.freshGdiCanonicalStable)throw Error(tag+' GL error/padding/GDI corruption');
      equal(row.componentBits,row.bpp===16?[5,5,5,0]:[8,8,8,8],'exposed stored component widths');
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
      for(const c of row.storageCases) {
        // Literal hardware-storage controls, separate from integer-color
        // source conversion and the still unsupported logic-operation API.
        const levels=[0,8,8,16,16,82,82,90,90,247,247,255];
        const channel=c.value===undefined?(row.bpp===16?197:192):
          row.bpp===16?levels[[0,7,8,15,16,79,80,87,88,247,248,255].indexOf(c.value)]:c.value;
        const literal=c.mask!==undefined?[0,1,2,3].map(i=>i===3?(row.bpp===16?255:c.mask&8?128:0):c.mask&(1<<i)?255:0):
          c.accumulationLoadPrecision?(row.bpp===16?[8,8,8,255]:[4,4,4,0]):c.accumulationPrecision?(row.bpp===16?[8,0,8,255]:[4,0,4,0]):c.accumulationReturn?(row.bpp===16?[66,132,189,255]:[64,128,191,0]):[channel,channel,channel,255];
        const control=c.accumulationLoadPrecision?'precision LOAD':c.accumulationPrecision?'precision RETURN':c.accumulationReturn?'accumulation RETURN':c.mask!==undefined?'mask '+c.mask:
          c.value!==undefined?'value '+c.value:'overlap '+c.batched;
        equal(c.immediate,literal,'stored-width immediate '+control);
        equal(c.published,literal,'publication cannot change stored history');
        if(row.bpp===16) {
          for(const i of [1,3,5,9,11,13])if((c.canonical[i]&0x80)!==(row.storageBefore[i]&0x80))throw Error(tag+' RGB555 X padding lost');
          for(const i of [6,7,14,15])if(c.canonical[i]!==0x6d)throw Error(tag+' row padding changed');
        }
      }
    }
    let workerSource=['region-map.generated','gpu-backend','gl-command-stream','mem-utils','gl-compat','gl-render-worker'].map(n=>fs.readFileSync('lib/'+n+'.js','utf8')).join('\n');
    if(mutation==='drop-color-masks')workerSource=workerSource.replace('maskInfo:item.colorMasks?.map(mask=>({mask}))','maskInfo:undefined');
    console.log(JSON.stringify({queuedBitmap:await evaluate('('+queuedBitmapProbe.toString()+')('+JSON.stringify(workerSource)+')')},null,2));
    await send('Browser.close');
  } finally {
    clearTimeout(guard);if(socket)socket.close();if(child.exitCode===null)child.kill('SIGTERM');
  }
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
