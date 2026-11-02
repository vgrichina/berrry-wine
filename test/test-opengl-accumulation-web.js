#!/usr/bin/env node
'use strict';
function accumulationPixels() {
 const results=[];let checks=0;
 const check=(actual,expected,label)=>{if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error(label+': '+JSON.stringify(actual)+' expected '+JSON.stringify(expected));checks++;};
 for(const apiVersion of [1,2]){
  const firstCheck=checks;
  const memory={buffer:new ArrayBuffer(4096)},v=new DataView(memory.buffer);
  const windows={42:{hwnd:42,w:4,h:4,clientRect:{w:4,h:4}},123:{hwnd:123,w:4,h:4,clientRect:{w:4,h:4}}};
  const bridge=new OpenGLCompat.OpenGLHostBridge({backend:'webgl',apiVersion,getMemory:()=>memory.buffer,exports:{guest_to_wasm:p=>p},renderer:{windows,repaint(){}}});
  const f=x=>{v.setFloat32(4000,x,true);return v.getUint32(4000,true);};
  const call=(name,args=[])=>{args.forEach((a,i)=>v.setUint32(4+i*4,a>>>0,true));return bridge.call(OpenGLCompat.CALL_INDEX[name]??({glAccum:143,glClearAccum:144}[name]),0,0);};
  const clear=(mode,rgba)=>{call('glDrawBuffer',[mode]);call('glClearColor',rgba.map(f));call('glClear',[0x4000]);};
  const accum=(op,value)=>call('glAccum',[op,f(value)]);
  const read=(mode,x=0,y=0)=>{call('glReadBuffer',[mode]);call('glReadPixels',[x,y,1,1,0x1908,0x1401,512]);check(call('glGetError'),0,'read error');return Array.from(new Uint8Array(memory.buffer,512,4));};
  try{
   const a=bridge.createContext(42);check(bridge.makeCurrent(a,42),1,'bind');call('glViewport',[0,0,4,4]);
   clear(0x404,[1,0,0,1]);clear(0x405,[0,0,1,1]);call('glReadBuffer',[0x405]);call('glColorMask',[0,0,0,0]);call('glDrawBuffer',[0]);accum(0x101,.5);
   call('glReadBuffer',[0x404]);accum(0x100,.25);accum(0x103,-.5);accum(0x104,.25);
   call('glColorMask',[1,1,1,1]);call('glDrawBuffer',[0x405]);accum(0x102,2);const exactRGBA=read(0x405);check(exactRGBA,[64,128,0,0],'independent exact oracle');check(read(0x404),[255,0,0,255],'source retained');
   call('glClearAccum',[-2,.5,2,-.25].map(f));call('glGetFloatv',[0xb80,512]);check(Array.from(new Float32Array(memory.buffer,512,4)),[-1,.5,1,-.25],'clear query');
   for(let p=0xd58;p<=0xd5b;p++){call('glGetIntegerv',[p,512]);check(v.getInt32(512,true),32,'signed component bits');}
   call('glDrawBuffer',[0]);call('glColorMask',[0,0,0,0]);call('glClear',[0x200]);call('glColorMask',[1,1,1,1]);call('glDrawBuffer',[0x405]);accum(0x102,1);check(read(0x405),[0,128,255,0],'clear ignores mask and NONE');
   call('glClearAccum',[.25,.5,.75,1].map(f));call('glClear',[0x200]);
   for(const mode of [0,0x404,0x405,0x408])for(let mask=0;mask<16;mask++){
    call('glColorMask',[1,1,1,1]);clear(0x404,[1,0,0,1]);clear(0x405,[0,0,1,1]);call('glDrawBuffer',[mode]);call('glColorMask',[0,1,2,3].map(i=>!!(mask&(1<<i))));
    call('glScissor',[1,1,1,1]);call('glEnable',[0xc11]);accum(0x102,1);call('glDisable',[0xc11]);
    for(const selected of [0x404,0x405]){const base=selected===0x404?[255,0,0,255]:[0,0,255,255];
     check(read(selected,1,1),base.map((x,c)=>(mode===selected||mode===0x408)&&(mask&(1<<c))?[64,128,191,255][c]:x),'masked selected RETURN');check(read(selected,0,1),base,'outside scissor');}
   }
   call('glColorMask',[1,1,1,1]);call('glDrawBuffer',[0x405]);
   for(const [operation,value,inside] of [[0x101,.5,[128,0,0,128]],
    [0x100,.5,[191,128,191,255]],[0x103,-1,[0,0,0,0]],
    [0x104,-.5,[0,0,64,128]],[-1,0,[0,64,0,255]]]){
    call('glClearAccum',[.25,.5,.75,1].map(f));call('glClear',[0x200]);
    clear(0x404,[1,0,0,1]);call('glReadBuffer',[0x404]);call('glDrawBuffer',[0x405]);
    call('glScissor',[1,1,1,1]);call('glEnable',[0xc11]);
    if(operation===-1){call('glClearAccum',[-.5,.25,-.25,1].map(f));call('glClear',[0x200]);}else accum(operation,value);
    call('glDisable',[0xc11]);accum(0x102,1);
    check(read(0x405,1,1),inside,'scissored operation '+operation);
    check(read(0x405,0,1),[64,128,191,255],'operation preserves accumulation neighbor');
   }
   call('glClearAccum',[.25,.5,.75,1].map(f));call('glClear',[0x200]);
   for(const cap of [0xbc0,0xb71,0xb90,0xbe2])call('glEnable',[cap]);call('glAlphaFunc',[0x200,f(1)]);call('glDepthFunc',[0x200]);call('glStencilFunc',[0x200,0,255]);call('glBlendFunc',[0,0]);
   accum(0x102,1);check(read(0x405),[64,128,191,255],'RETURN bypasses fragment tests and blend');for(const cap of [0xbc0,0xb71,0xb90,0xbe2])call('glDisable',[cap]);
   call('glPushAttrib',[0x200]);call('glClearAccum',[0,0,0,0]);call('glPopAttrib');call('glGetFloatv',[0xb80,512]);check(Array.from(new Float32Array(memory.buffer,512,4)),[.25,.5,.75,1],'accum attrib');
   // Preserve separate WebGL2 bindings and native pixel stores even on RETURN.
   const backend=bridge._current().backend,gl=backend.gl;
   const params=[gl.PACK_ALIGNMENT,gl.UNPACK_ALIGNMENT,gl.UNPACK_FLIP_Y_WEBGL,gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,gl.UNPACK_COLORSPACE_CONVERSION_WEBGL];
   if(apiVersion===2)params.push(gl.PACK_ROW_LENGTH,gl.PACK_SKIP_ROWS,gl.PACK_SKIP_PIXELS,gl.UNPACK_ROW_LENGTH,gl.UNPACK_SKIP_ROWS,gl.UNPACK_SKIP_PIXELS);
   const defaults=params.map(p=>gl.getParameter(p));
   gl.pixelStorei(gl.PACK_ALIGNMENT,8);gl.pixelStorei(gl.UNPACK_ALIGNMENT,8);
   gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
   const device=bridge._webglBackend,buffers=[];
   if(apiVersion===2){
    for(const name of ['PACK_ROW_LENGTH','UNPACK_ROW_LENGTH'])gl.pixelStorei(gl[name],7);
    for(const name of ['PACK_SKIP_ROWS','PACK_SKIP_PIXELS','UNPACK_SKIP_ROWS','UNPACK_SKIP_PIXELS'])gl.pixelStorei(gl[name],1);
    for(const target of [gl.PIXEL_PACK_BUFFER,gl.PIXEL_UNPACK_BUFFER]){const buffer=gl.createBuffer();gl.bindBuffer(target,buffer);gl.bufferData(target,4096,gl.STATIC_DRAW);buffers.push([target,buffer]);}
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER,device._drawable.frames[2]);gl.readBuffer(gl.COLOR_ATTACHMENT1);
   }
   const before=params.map(p=>gl.getParameter(p));
   const frames=[gl.getParameter(apiVersion===2?gl.READ_FRAMEBUFFER_BINDING:gl.FRAMEBUFFER_BINDING),apiVersion===2?gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING):null];
   check(device.accumulate(0x102,1,[0,0,0,0],[true,true,true,true]),0,'direct backend RETURN');
   check(params.map(p=>gl.getParameter(p)),before,'hostile pixel stores restored');
   check(gl.getParameter(apiVersion===2?gl.READ_FRAMEBUFFER_BINDING:gl.FRAMEBUFFER_BINDING)===frames[0],true,'read framebuffer restored');
   if(apiVersion===2){check(gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)===frames[1],true,'draw framebuffer restored');check(gl.getParameter(gl.READ_BUFFER),gl.COLOR_ATTACHMENT1,'per-frame read buffer restored');}
   for(const [target,buffer] of buffers){check(gl.getParameter(target===gl.PIXEL_PACK_BUFFER?gl.PIXEL_PACK_BUFFER_BINDING:gl.PIXEL_UNPACK_BUFFER_BINDING)===buffer,true,'PBO restored');gl.bindBuffer(target,null);gl.deleteBuffer(buffer);}
   params.forEach((p,i)=>gl.pixelStorei(p,defaults[i]));
   check(gl.getError(),0,'hostile native state no WebGL error');check(read(0x405),[64,128,191,255],'hostile stores do not change RETURN pixels');
   const b=bridge.createContext(42);check(bridge.makeCurrent(b,42),1,'second context');call('glGetFloatv',[0xb80,512]);check(Array.from(new Float32Array(memory.buffer,512,4)),[0,0,0,0],'clear state isolated');accum(0x102,1);check(read(0x405),[64,128,191,255],'signed drawable shared');
   check(bridge.makeCurrent(a,123),1,'second drawable');
   const budget=device.targetBudget,allocated=device._targetBytes;device.targetBudget=allocated;accum(0x104,1);check(call('glGetError'),0x505,'signed allocation failure');check(device._targetBytes,allocated,'failed allocation keeps budget');device.targetBudget=budget;
   call('glClearAccum',[-.5,0,.5,1].map(f));call('glClear',[0x200]);
   check(bridge.makeCurrent(b,42),1,'first drawable retained');accum(0x102,1);check(read(0x405),[64,128,191,255],'cross drawable isolation');
   bridge.deleteContext(a);check(bridge.makeCurrent(b,123),1,'context delete retains drawable');accum(0x102,1);check(read(0x405),[0,0,128,255],'retained second signed image');
   windows[123].clientRect={w:2,h:3};check(bridge.makeCurrent(b,123),1,'resize');call('glClearAccum',[0,.25,.5,1].map(f));call('glClear',[0x200]);accum(0x102,1);check(read(0x405),[0,64,128,255],'resized signed image');
   check(bridge.makeCurrent(b,42),1,'return first');accum(0x102,1);check(read(0x405),[64,128,191,255],'resize isolates other image');
   const prior=device._drawables.get(42);windows[42]={hwnd:42,w:4,h:4,clientRect:{w:4,h:4}};
   check(bridge.makeCurrent(b,42),1,'reused HWND gets fresh drawable');check(prior.accumulation,null,'deleted signed array released');
   accum(0x104,.125);accum(0x102,1);check(read(0x405),[32,32,32,32],'fresh signed image after HWND reuse');
   const canonical=new Uint8ClampedArray(4*4*4);for(let i=0;i<canonical.length;i+=4)canonical.set([0,0,255,255],i);
   bridge.options.getGdiSurface=id=>id===5?{surface:{width:4,height:4,rgbaRect(){return canonical.slice();},
    writeRgbaRect(x,y,w,h,pixels){for(let row=0;row<h;row++)canonical.set(pixels.subarray(row*w*4,(row+1)*w*4),((y+row)*4+x)*4);}}}:null;
   const bitmap=bridge.createBitmapContext(0x80000005);check(!!bitmap,true,'bitmap context');check(bridge.makeCurrent(bitmap,0x80000005),1,'bitmap bind');
   call('glReadBuffer',[0x404]);call('glDrawBuffer',[0]);accum(0x101,.5);accum(0x103,-1);accum(0x104,.75);
   call('glColorMask',[1,0,1,0]);call('glDrawBuffer',[0x404]);call('glScissor',[1,1,1,1]);call('glEnable',[0xc11]);accum(0x102,1);call('glDisable',[0xc11]);
   check(read(0x404,1,1),[191,0,64,255],'bitmap source/RETURN preserves masked canonical channels');check(read(0x404,0,1),[0,0,255,255],'bitmap outside scissor');
   bridge.flushFrontBuffer();check(Array.from(canonical.slice((2*4+1)*4,(2*4+1)*4+4)),[191,0,64,255],'bitmap publishes RETURN');
   check(call('glGetError'),0,'final error');results.push({apiVersion,exactRGBA,masks:64,checks:checks-firstCheck,renderer:gl.getParameter(gl.RENDERER),version:gl.getParameter(gl.VERSION)});
  }finally{bridge.destroy();}
 }
 return results;
}
async function accumulationWorkerPixels(source) {
  function startConsumer() {
    const memory={buffer:new ArrayBuffer(4096)},v=new DataView(memory.buffer),frames=[];
    const endpoint=GLRenderWorker.create({instance:{exports:{guest_to_wasm:p=>p}},memory,backend:'webgl',sendFrame(frame){
      const canvas=new OffscreenCanvas(frame.width,frame.height),ctx=canvas.getContext('2d');ctx.drawImage(frame.bitmap,0,0);frame.bitmap.close();
      frames.push(Array.from(ctx.getImageData(2,2,1,1).data));
    }});
    const windows=[{hwnd:42,w:8,h:8,clientSize:{w:8,h:8},generation:1},{hwnd:123,w:8,h:8,clientSize:{w:8,h:8},generation:1}];
    self.onmessage=({data})=>{try{
      const {id,name,args=[],aux=0,packed}=data,stackBytes=packed?0:(args.length+1)*4,bytes=32+stackBytes+(packed?packed.length*4:0);
      new Uint8Array(memory.buffer,0,bytes).fill(0);v.setUint32(0,bytes,true);v.setUint32(4,packed?0x10000:(OpenGLCompat.CALL_INDEX[name]??({glAccum:143,glClearAccum:144}[name])),true);v.setUint32(8,aux>>>0,true);v.setUint32(12,stackBytes,true);
      if(packed){v.setUint32(20,packed.length*4,true);v.setUint32(24,32,true);v.setUint32(28,1,true);new Float32Array(memory.buffer,32,packed.length).set(packed);}
      else args.forEach((a,i)=>v.setUint32(36+i*4,a>>>0,true));
      const result=endpoint.execute({windows,memoryOffset:0,bytes,owner:data.owner||1});
      self.postMessage({id,value:result.value,pixel:Array.from(new Uint8Array(memory.buffer,512,4)),frames});
    }catch(e){self.postMessage({id:data.id,error:String(e),stack:e.stack});}};
  }
  const url=URL.createObjectURL(new Blob([source,'\n('+startConsumer.toString()+')();'],{type:'text/javascript'}));
  const worker=new Worker(url),pending=new Map();let next=1,checks=0;
  const guard=setTimeout(()=>{for(const p of pending.values())p.reject(Error('WebGL worker timeout'));},30000);
  worker.onmessage=({data})=>{const p=pending.get(data.id);if(p){pending.delete(data.id);data.error?p.reject(Error(data.error+'\n'+data.stack)):p.resolve(data);}};
  worker.onerror=event=>{for(const p of pending.values())p.reject(Error(event.message));pending.clear();};
  const call=(name,args=[],aux=0,packed)=>new Promise((resolve,reject)=>{const id=next++;pending.set(id,{resolve,reject});worker.postMessage({id,name,args,aux,packed});});
  const equal=(actual,expected,label,tolerance=0)=>{if(Array.isArray(expected)?!(Array.isArray(actual)&&actual.length===expected.length&&actual.every((x,i)=>Math.abs(x-expected[i])<=tolerance)):actual!==expected)throw Error(label+': '+JSON.stringify(actual));checks++;};
  const f=x=>{const b=new DataView(new ArrayBuffer(4));b.setFloat32(0,x,true);return b.getUint32(0,true);};
  const clear=async(mode,color)=>{await call('glDrawBuffer',[mode]);await call('glClearColor',color.map(f));await call('glClear',[0x4000]);};
  const read=async(mode,x=2,y=2)=>{await call('glReadBuffer',[mode]);const r=await call('glReadPixels',[x,y,1,1,0x1908,0x1401,512]);equal((await call('glGetError')).value,0,'worker GL error');return r.pixel;};
  try {
    const a=(await call('wglCreateContext',[1],42)).value;
    equal((await call('wglMakeCurrent',[1,a],42)).value,1,'bind');await call('glViewport',[0,0,8,8]);
    await clear(0x404,[1,0,0,1]);await clear(0x405,[0,0,1,1]);await call('glReadBuffer',[0x405]);await call('glColorMask',[0,0,0,0]);await call('glDrawBuffer',[0]);
    await call('glAccum',[0x101,f(.5)]);await call('glReadBuffer',[0x404]);await call('glAccum',[0x100,f(.25)]);
    await call('glAccum',[0x103,f(-.5)]);await call('glAccum',[0x104,f(.25)]);await call('glColorMask',[1,1,1,1]);await call('glDrawBuffer',[0x405]);await call('glAccum',[0x102,f(2)]);
    const exactRGBA=await read(0x405);equal(exactRGBA,[64,128,0,0],'worker independent exact oracle');equal(await read(0x404),[255,0,0,255],'selected source');
    await call('glClearAccum',[.25,.5,.75,1].map(f));await call('glClear',[0x200]);
    for(const mode of [0,0x404,0x405,0x408])for(let mask=0;mask<16;mask++){
      await call('glColorMask',[1,1,1,1]);await clear(0x404,[1,0,0,1]);await clear(0x405,[0,0,1,1]);await call('glDrawBuffer',[mode]);
      await call('glColorMask',[0,1,2,3].map(i=>!!(mask&(1<<i))));await call('glScissor',[2,2,1,1]);await call('glEnable',[0xc11]);
      await call('glAccum',[0x102,f(1)]);await call('glDisable',[0xc11]);
      for(const selected of [0x404,0x405]){const base=selected===0x404?[255,0,0,255]:[0,0,255,255];
        equal(await read(selected),base.map((v,c)=>(mode===selected||mode===0x408)&&(mask&(1<<c))?[64,128,191,255][c]:v),'worker masks/selectors');equal(await read(selected,3,2),base,'worker scissor');}
    }
    await call('glColorMask',[1,1,1,1]);await clear(0x405,[0,0,0,0]);await call('glDrawBuffer',[0x405]);
    const point=Array(19).fill(0);point.splice(0,7,-.375,-.375,0,1,0,0,1);point[14]=1;
    await call(null,[],0,point);await call('glReadBuffer',[0x405]);await call('glAccum',[0x101,f(.5)]);
    await call('glAccum',[0x103,f(-1)]);await call('glAccum',[0x104,f(.75)]);await call('glAccum',[0x102,f(1)]);
    equal(await read(0x405),[64,191,191,64],'worker ordered packed draw before LOAD');
    const b=(await call('wglCreateContext',[1],42)).value;equal((await call('wglMakeCurrent',[1,b],42)).value,1,'context switch');
    await call('glAccum',[0x102,f(1)]);equal(await read(0x405),[64,191,191,64],'worker shared signed storage');
    equal((await call('wglDeleteContext',[a])).value,1,'context deletion');await call('glAccum',[0x102,f(1)]);
    equal(await read(0x405),[64,191,191,64],'worker deletion retains signed storage');
    return {actualBrowserWorker:true,checks,exactRGBA};
  } finally {clearTimeout(guard);worker.terminate();URL.revokeObjectURL(url);}
}
if(typeof module!=='undefined'&&require.main===module)(async()=>{
 const fs=require('fs'),path=require('path'),browser=await require('puppeteer').launch({headless:true,executablePath:process.env.CHROME||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
 try{const page=await browser.newPage();for(const name of ['region-map.generated','gpu-backend','gl-command-stream','mem-utils','gl-compat','gl-render-worker'])await page.addScriptTag({path:path.join(__dirname,'../lib/'+name+'.js')});
  console.log('PASS actual WebGL pixels',JSON.stringify(await page.evaluate(accumulationPixels)));
  const source=['region-map.generated','gpu-backend','gl-command-stream','mem-utils','gl-compat','gl-render-worker'].map(name=>fs.readFileSync(path.join(__dirname,'../lib/'+name+'.js'),'utf8')).join('\n');
  console.log('PASS actual WebGL worker pixels',JSON.stringify(await page.evaluate(accumulationWorkerPixels,source)));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
