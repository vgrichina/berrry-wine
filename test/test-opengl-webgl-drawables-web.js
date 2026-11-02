#!/usr/bin/env node
'use strict';
function runDrawableTests() {
  const results=[];
  const equal=(actual,expected,label,tolerance=0)=>{
    const ok=Array.isArray(expected)?Array.isArray(actual)&&actual.length===expected.length&&actual.every((v,i)=>Math.abs(v-expected[i])<=tolerance):actual===expected;
    if(!ok)throw Error(`${label}: ${JSON.stringify(actual)} expected ${JSON.stringify(expected)}`);
  };
  for(const apiVersion of [1,2]) {
    const memory=new ArrayBuffer(4096),dv=new DataView(memory),windows={42:{hwnd:42,w:8,h:8,clientRect:{w:8,h:8}},123:{hwnd:123,w:8,h:8,clientRect:{w:8,h:8}}};
    const renderer={windows,repaint(){},mergeGpuLayerIntoBackCanvas(){}};
    const bridge=new OpenGLCompat.OpenGLHostBridge({apiVersion,getMemory:()=>memory,exports:{guest_to_wasm:p=>p},renderer,
      createCanvas:(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;}});
    let checks=0;
    const check=(a,b,label,t=0)=>{equal(a,b,`v${apiVersion} ${label}`,t);checks++;};
    const f=x=>{dv.setFloat32(4000,x,true);return dv.getUint32(4000,true);};
    const call=(name,args=[])=>{args.forEach((v,i)=>dv.setUint32(4+i*4,v>>>0,true));return bridge.call(OpenGLCompat.CALL_INDEX[name],0,0);};
    const error=()=>call('glGetError');
    const select=mode=>{call('glDrawBuffer',[mode]);check(error(),0,'draw selection '+mode);};
    const pixel=(mode,x=2,y=2)=>{call('glReadBuffer',[mode]);call('glReadPixels',[x,y,1,1,0x1908,0x1401,512]);check(error(),0,'selected read');return Array.from(new Uint8Array(memory,512,4));};
    const clear=(mode,color,bits=0x4000)=>{select(mode);call('glClearColor',color.map(f));call('glClear',[bits]);check(error(),0,'clear');};
    const draw=(color=[0,1,0,1],z=0,bitmap=false)=>{
      const context=bridge._current(),v=new Float32Array(19);
      v.set(bitmap?[2,2,z,...color]:[-.375,-.375,z,...color]);v[14]=1;
      if(bitmap)context.backend.drawBitmapPoints(v,false,0x207,0);
      else{context.frontend.enqueuePacked(0,v);context.frontend.flushPendingDraw();}
      check(error(),0,bitmap?'bitmap draw':'point draw');
    };
    try {
      const a=bridge.createContext(42);check(!!a,true,'create');check(bridge.makeCurrent(a,42),1,'bind');
      call('glViewport',[0,0,8,8]);
      // Invalid setters must preserve authoritative context state across both
      // presentation paths, even when the execution-device cache was cleared.
      for(const [setter,args,expectedError] of [
        ['glBlendFunc',[0xdead,0],0x500],['glViewport',[0,0,-1,8],0x501],
        ['glScissor',[0,0,-1,8],0x501],['glDepthFunc',[0xdead],0x500],
        ['glCullFace',[0xdead],0x500],['glFrontFace',[0xdead],0x500],['glLineWidth',[f(0)],0x501],
      ]) for(const swap of [false,true]) {
        clear(0x408,[0,0,1,1]);select(0x405);
        call('glViewport',[1,1,4,4]);call('glBlendFunc',[0x302,0x303]);call('glEnable',[0xbe2]);
        call('glScissor',[2,2,1,1]);call('glEnable',[0xc11]);
        call(setter,args);check(error(),expectedError,'invalid '+setter);
        if(swap)bridge.present();else bridge.flushFrontBuffer();
        const v=new Float32Array(6*19);
        [[-1,-1],[1,-1],[1,1],[-1,-1],[1,1],[-1,1]].forEach(([x,y],i)=>{
          v.set([x,y,0,0,1,0,.5],i*19);v[i*19+14]=1;
        });
        const context=bridge._current();context.frontend.enqueuePacked(4,v);context.frontend.flushPendingDraw();
        // Read both pixels before asserting: the old failure is actual color
        // loss, not merely a cache/capability introspection discrepancy.
        const inside=pixel(0x405),outside=pixel(0x405,3,2);
        check(inside,[0,128,128,191],setter+' present inside '+swap+' pixels '+JSON.stringify({inside,outside}),1);
        check(outside,[0,0,255,255],setter+' present scissor '+swap);
        check(Array.from(context.backend.gl.getParameter(0xba2)),[1,1,4,4],setter+' viewport');
        check(context.backend.gl.isEnabled(0xbe2),true,setter+' blend retained');
        check(context.backend.gl.isEnabled(0xc11),true,setter+' scissor retained');
        call('glDisable',[0xbe2]);call('glDisable',[0xc11]);call('glViewport',[0,0,8,8]);
      }
      clear(0x405,[0,0,1,1]);clear(0x404,[1,0,0,1]);
      check(pixel(0x404),[255,0,0,255],'FRONT read');check(pixel(0x405),[0,0,255,255],'BACK read');
      clear(0,[0,1,0,1]);check(pixel(0x405),[0,0,255,255],'NONE preserves back');check(pixel(0x404),[255,0,0,255],'NONE preserves front');
      select(0x408);call('glEnable',[0xbe2]);call('glBlendFunc',[0x302,0x303]);draw([0,1,0,.5]);call('glDisable',[0xbe2]);
      check(pixel(0x404),[128,128,0,191],'BOTH independent front blend',1);check(pixel(0x405),[0,128,128,191],'BOTH independent back blend',1);
      clear(0x408,[0,0,0,1],0x4500);call('glEnable',[0xb71]);call('glDepthFunc',[0x201]);call('glEnable',[0xb90]);
      call('glStencilFunc',[0x207,0,255]);call('glStencilOp',[0x1e00,0x1e00,0x1e02]);draw([1,0,0,1],-.5);
      check(pixel(0x404),[255,0,0,255],'shared depth front first');check(pixel(0x405),[255,0,0,255],'shared depth back first');
      call('glStencilFunc',[0x202,1,255]);call('glStencilOp',[0x1e00,0x1e00,0x1e00]);draw([0,1,0,1],.5);
      check(pixel(0x405),[255,0,0,255],'shared depth rejected second draw');call('glDisable',[0xb71]);draw([0,1,0,1]);
      check(pixel(0x404),[0,255,0,255],'stencil increment exactly once front');check(pixel(0x405),[0,255,0,255],'stencil increment exactly once back');
      call('glStencilFunc',[0x202,2,255]);draw([1,1,1,1]);check(pixel(0x404),[0,255,0,255],'stencil not twice');call('glDisable',[0xb90]);
      clear(0x408,[0,0,0,0],0x4500);select(0);call('glEnable',[0xb71]);call('glEnable',[0xb90]);call('glStencilFunc',[0x207,3,255]);call('glStencilOp',[0x1e00,0x1e00,0x1e01]);draw([1,1,1,1],-.5);
      check(pixel(0x404),[0,0,0,0],'NONE color');select(0x408);call('glStencilFunc',[0x202,3,255]);call('glStencilOp',[0x1e00,0x1e00,0x1e00]);draw([1,0,0,1],.5);check(pixel(0x405),[0,0,0,0],'NONE writes depth');call('glDisable',[0xb71]);draw([0,0,1,1]);check(pixel(0x404),[0,0,255,255],'NONE writes stencil');call('glDisable',[0xb90]);
      clear(0x408,[0,0,1,1]);call('glColorMask',[1,1,0,0]);call('glEnable',[0xc11]);call('glScissor',[2,2,1,1]);clear(0x408,[1,1,0,0]);
      check(pixel(0x404),[255,255,255,255],'masked scissor front');check(pixel(0x405,3,2),[0,0,255,255],'scissor outside');call('glDisable',[0xc11]);call('glColorMask',[1,1,1,1]);
      select(0x404);call('glReadBuffer',[0x404]);call('glPushAttrib',[0x4000]);select(0x405);call('glReadBuffer',[0x405]);call('glPopAttrib');draw([1,0,1,1]);check(pixel(0x404),[255,0,255,255],'attrib draw selection');
      select(0x408);draw([0,1,1,1],.5,true);check(pixel(0x404),[0,255,255,255],'bitmap BOTH front');check(pixel(0x405),[0,255,255,255],'bitmap BOTH back');
      const textured=bridge._current().frontend;
      textured.bindTexture(3);textured.texImage(0,0x1908,1,1,0,0x1908,0x1401,new Uint8Array([255,255,255,255]));
      for(const [key,value] of [[0x2801,0x2601],[0x2800,0x2601],[0x2802,0x2900],[0x2803,0x2900]])textured.texParameter(key,value);
      textured.texBorderColor([1,0,0,0]);textured.setTextureMode(0x1e01);textured.setEnabled(0xde1,true);
      const border=new Float32Array(19);border.set([-.375,-.375,0,1,1,1,1,0,.5]);border[14]=1;border[16]=1;border[18]=1;
      textured.enqueuePacked(0,border);textured.flushPendingDraw();check(error(),0,'border shader MRT');
      check(pixel(0x404),[255,128,128,128],'border FRONT output',2);check(pixel(0x405),[255,128,128,128],'border BACK output',2);
      textured.setEnabled(0xde1,false);
      for(const [mode,expected] of [[0x401,0x502],[0x403,0x502],[0x407,0x502],[0x409,0x502],[0xdead,0x500]]){call('glDrawBuffer',[mode]);check(error(),expected,'invalid draw '+mode);}
      for(const [mode,expected] of [[0,0x500],[0x408,0x500],[0x401,0x502]]){call('glReadBuffer',[mode]);check(error(),expected,'invalid read '+mode);}
      // A second context sees the same images but starts with independent state.
      clear(0x404,[1,0,0,1]);clear(0x405,[0,0,1,1]);call('glColorMask',[1,0,0,0]);call('glViewport',[1,1,4,4]);
      const double=x=>{dv.setFloat64(3992,x,true);return [dv.getUint32(3992,true),dv.getUint32(3996,true)];};
      call('glDepthRange',[...double(.2),...double(.8)]);
      const b=bridge.createContext(42);check(!!b,true,'second context');check(bridge.makeCurrent(b,42),1,'bind shared drawable');
      check(pixel(0x404),[255,0,0,255],'shared front');check(pixel(0x405),[0,0,255,255],'shared back');
      clear(0x405,[0,1,0,1]);check(bridge.makeCurrent(a,123),1,'cross drawable bind');clear(0x405,[0,0,1,1]);
      check(bridge.makeCurrent(b,42),1,'return shared');check(pixel(0x405),[0,255,0,255],'other drawable unchanged');
      check(bridge.makeCurrent(a,42),1,'restore context state');check(Array.from(bridge._current().backend.gl.getParameter(0xba2)),[1,1,4,4],'viewport restore');
      check(Array.from(bridge._current().backend.gl.getParameter(0xb70)),[.2,.8],'depth range after second context probe',.000001);
      call('glClearColor',[f(1),f(1),f(1),f(1)]);call('glClear',[0x4000]);check(pixel(0x405),[255,255,0,255],'mask restore');
      call('glBlendFunc',[0x302,0x303]);call('glBlendFunc',[0xdead,0]);
      check(bridge.makeCurrent(b,42),1,'switch after raw GL error');check(error(),0,'raw error belongs to original context');
      check(bridge.makeCurrent(a,42),1,'return to errored context');check(error(),0x500,'original context retains raw error');
      check(bridge._current().backend.gl.getParameter(0x80c9),0x302,'invalid blend preserves context source');
      check(bridge._current().backend.gl.getParameter(0x80c8),0x303,'invalid blend preserves context destination');
      check(bridge.deleteContext(a),1,'delete context');check(bridge.makeCurrent(b,42),1,'surviving context');check(pixel(0x405),[255,255,0,255],'delete preserves drawable');
      check(bridge.deleteContext(b),1,'last context delete');const c=bridge.createContext(42);check(bridge.makeCurrent(c,42),1,'new context retained drawable');check(pixel(0x405),[255,255,0,255],'new context sees retained pixels');
      clear(0x404,[1,0,0,1]);clear(0x405,[0,0,1,1]);bridge.flushFrontBuffer();
      const image=()=>Array.from(windows[42]._gpuFrameLayer.canvas.getContext('2d').getImageData(2,2,1,1).data);
      check(image(),[255,0,0,255],'flush presents front');bridge.present();check(image(),[0,0,255,255],'swap presents back');check(pixel(0x405),[255,0,0,255],'swap exchanges images');
      check(bridge.makeCurrent(c,123),1,'second drawable retained');call('glColorMask',[1,1,1,1]);clear(0x405,[0,1,1,1]);bridge.present();
      check(image(),[0,0,255,255],'independent presentation snapshot');
      windows[42].clientRect={w:10,h:6};check(bridge.makeCurrent(c,42),1,'resized bind');check([bridge._current().drawable.width,bridge._current().drawable.height],[10,6],'size');
      clear(0x408,[1,0,1,1]);check(pixel(0x404,9,5),[255,0,255,255],'resized front');check(pixel(0x405,9,5),[255,0,255,255],'resized back');
      check(bridge.makeCurrent(c,123),1,'unresized bind');check(pixel(0x404),[0,255,255,255],'resize isolates other drawable');
      // Replace the window object with the same numeric handle: stale pixels
      // must not survive the destroyed window's identity.
      windows[42]={hwnd:42,w:8,h:8,clientRect:{w:8,h:8}};check(bridge.makeCurrent(c,42),1,'reused HWND');check(pixel(0x404),[0,0,0,0],'reused HWND new storage');
      check(bridge.makeCurrent(c,999),0,'invalid drawable');check(bridge._current().hwnd,42,'failed bind preserves target');
      windows[999]={hwnd:999,w:50000,h:50000,clientRect:{w:50000,h:50000}};
      check(bridge.makeCurrent(c,999),0,'allocation failure bind');check(bridge._current().hwnd,42,'allocation failure preserves target');
      check(bridge.makeCurrent(9999,123),0,'invalid context');check(bridge.makeCurrent(0),1,'unbind');check(bridge._current(),undefined,'no current context');check(bridge.makeCurrent(c,42),1,'rebind after unbind');
      // Bitmap drawables have one front image and import canonical GDI pixels
      // before a masked/scissored clear as well as before geometry.
      const canonical=new Uint8ClampedArray(8*8*4);for(let i=0;i<canonical.length;i+=4)canonical.set([0,0,255,255],i);
      bridge.options.getGdiSurface=id=>id===5?{surface:{width:8,height:8,
        rgbaRect(){return canonical.slice();},
        writeRgbaRect(x,y,w,h,pixels){for(let row=0;row<h;row++)canonical.set(pixels.subarray(row*w*4,(row+1)*w*4),((y+row)*8+x)*4);}}}:null;
      const bitmap=bridge.createBitmapContext(0x80000005);check(!!bitmap,true,'bitmap create');check(bridge.makeCurrent(bitmap,0x80000005),1,'bitmap bind');
      check(pixel(0x404),[0,0,255,255],'bitmap imports GDI on read');
      call('glDrawBuffer',[0x405]);check(error(),0x502,'single buffer BACK rejected');
      call('glReadBuffer',[0x405]);check(error(),0x502,'single buffer BACK read rejected');
      call('glEnable',[0xc11]);call('glScissor',[2,2,1,1]);clear(0x404,[1,0,0,1]);bridge.flushFrontBuffer();
      check(Array.from(canonical.slice((5*8+2)*4,(5*8+2)*4+4)),[255,0,0,255],'bitmap publishes clear');
      check(Array.from(canonical.slice(0,4)),[0,0,255,255],'bitmap retains GDI outside scissor');
      call('glDisable',[0xc11]);check(bridge.makeCurrent(c,42),1,'restore window');
      const gl=bridge._current().backend.gl,ext=gl.getExtension('WEBGL_debug_renderer_info');
      results.push({apiVersion,checks,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),error:error()});
    } finally {if(bridge.destroy)bridge.destroy();else for(const handle of [...bridge.contexts.keys()])bridge.deleteContext(handle);}
  }
  if(typeof GLRenderWorker!=='undefined'){
    const memory={buffer:new ArrayBuffer(4096)},view=new DataView(memory.buffer),frames=[];
    const endpoint=GLRenderWorker.create({instance:{exports:{guest_to_wasm:p=>p}},memory,backend:'webgl',sendFrame:frame=>frames.push(frame)});
    let windows=[{hwnd:42,w:8,h:8,generation:1,clientSize:{w:8,h:8}},{hwnd:123,w:8,h:8,generation:1,clientSize:{w:8,h:8}}];
    const execute=(name,args=[],aux=0)=>{
      const stackBytes=(args.length+1)*4,bytes=32+stackBytes;
      new Uint8Array(memory.buffer,0,bytes).fill(0);view.setUint32(0,bytes,true);view.setUint32(4,OpenGLCompat.CALL_INDEX[name],true);view.setUint32(8,aux>>>0,true);view.setUint32(12,stackBytes,true);
      args.forEach((value,i)=>view.setUint32(36+i*4,value>>>0,true));
      return endpoint.execute({windows,memoryOffset:0,bytes,owner:1}).value;
    };
    const f=x=>{view.setFloat32(4000,x,true);return view.getUint32(4000,true);};
    const read=mode=>{execute('glReadBuffer',[mode]);execute('glReadPixels',[2,2,1,1,0x1908,0x1401,512]);equal(execute('glGetError'),0,'worker read error');return Array.from(new Uint8Array(memory.buffer,512,4));};
    try{
      const a=execute('wglCreateContext',[1],42);equal(!!a,true,'worker create');equal(execute('wglMakeCurrent',[1,a],42),1,'worker bind');
      execute('glDrawBuffer',[0x404]);execute('glClearColor',[f(1),0,0,f(1)]);execute('glClear',[0x4000]);
      execute('glDrawBuffer',[0x405]);execute('glClearColor',[0,0,f(1),f(1)]);execute('glClear',[0x4000]);
      equal(read(0x404),[255,0,0,255],'worker FRONT');equal(read(0x405),[0,0,255,255],'worker BACK');
      equal(execute('wglMakeCurrent',[1,a],123),1,'worker rebind');execute('glDrawBuffer',[0x408]);execute('glClearColor',[0,f(1),0,f(1)]);execute('glClear',[0x4000]);equal(read(0x404),[0,255,0,255],'worker BOTH');
      equal(execute('wglMakeCurrent',[1,a],42),1,'worker return');equal(read(0x405),[0,0,255,255],'worker drawable isolation');
      execute('gpuPresent');equal(frames.length,1,'worker presentation');
      const canvas=new OffscreenCanvas(8,8),ctx=canvas.getContext('2d');ctx.drawImage(frames[0].bitmap,0,0);frames[0].bitmap.close();equal(Array.from(ctx.getImageData(2,2,1,1).data),[0,0,255,255],'worker frame pixel');
      windows[0]={...windows[0],generation:2};equal(read(0x404),[0,0,0,0],'worker HWND generation reset');
      windows=windows.filter(w=>w.hwnd!==42);execute('wglMakeCurrent',[0,0]);
      results.push({workerEndpoint:true,checks:13});
    }finally{endpoint.destroy();}
  }
  return results;
}
async function runDrawableWorkerTests(source) {
  function startConsumer() {
    const memory={buffer:new ArrayBuffer(4096)},v=new DataView(memory.buffer),frames=[];
    const endpoint=GLRenderWorker.create({instance:{exports:{guest_to_wasm:p=>p}},memory,backend:'webgl',sendFrame(frame){
      const canvas=new OffscreenCanvas(frame.width,frame.height),ctx=canvas.getContext('2d');ctx.drawImage(frame.bitmap,0,0);frame.bitmap.close();
      frames.push(Array.from(ctx.getImageData(2,2,1,1).data));
    }});
    const windows=[{hwnd:42,w:8,h:8,clientSize:{w:8,h:8},generation:1},{hwnd:123,w:8,h:8,clientSize:{w:8,h:8},generation:1}];
    self.onmessage=({data})=>{try{
      const {id,name,args=[],aux=0,packed}=data,stackBytes=packed?0:(args.length+1)*4,bytes=32+stackBytes+(packed?packed.length*4:0);
      new Uint8Array(memory.buffer,0,bytes).fill(0);v.setUint32(0,bytes,true);v.setUint32(4,packed?0x10000:OpenGLCompat.CALL_INDEX[name],true);v.setUint32(8,aux>>>0,true);v.setUint32(12,stackBytes,true);
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
    const a=(await call('wglCreateContext',[1],42)).value;equal(!!a,true,'create');equal((await call('wglMakeCurrent',[1,a],42)).value,1,'bind');await call('glViewport',[0,0,8,8]);
    await clear(0x408,[0,0,1,1]);await call('glDrawBuffer',[0x405]);
    await call('glEnable',[0xbe2]);await call('glBlendFunc',[0x302,0x303]);
    await call('glEnable',[0xc11]);await call('glScissor',[2,2,1,1]);
    await call('glBlendFunc',[0xdead,0]);equal((await call('glGetError')).value,0x500,'worker rejected blend setter');
    await call('gpuPresent');
    const retained=new Float32Array(2*19);
    for(let i=0;i<2;i++){retained.set([-.375+i*.25,-.375,0,0,1,0,.5],i*19);retained[i*19+14]=1;}
    await call(null,[],0,Array.from(retained));
    const inside=await read(0x405),outside=await read(0x405,3,2);
    equal(inside,[0,128,128,191],'worker invalid setter/present blend',1);
    equal(outside,[0,0,255,255],'worker invalid setter/present scissor');
    await call('glDisable',[0xbe2]);await call('glDisable',[0xc11]);
    await clear(0x404,[1,0,0,1]);await clear(0x405,[0,0,1,1]);equal(await read(0x404),[255,0,0,255],'front');equal(await read(0x405),[0,0,255,255],'back');
    await call('glDrawBuffer',[0x408]);await call('glEnable',[0xbe2]);await call('glBlendFunc',[0x302,0x303]);
    const point=Array(19).fill(0);point.splice(0,7,-.375,-.375,0,0,1,0,.5);point[14]=1;
    await call(null,[],0,point);await call('glDisable',[0xbe2]);equal(await read(0x404),[128,128,0,191],'front blend',1);equal(await read(0x405),[0,128,128,191],'back blend',1);
    const b=(await call('wglCreateContext',[1],42)).value;equal((await call('wglMakeCurrent',[1,b],42)).value,1,'second context bind');equal(await read(0x404),[128,128,0,191],'shared image',1);
    equal((await call('wglDeleteContext',[a])).value,1,'delete first');equal((await call('wglMakeCurrent',[1,b],123)).value,1,'different drawable');await clear(0x408,[0,1,1,1]);equal(await read(0x404),[0,255,255,255],'second front');
    equal((await call('wglMakeCurrent',[1,b],42)).value,1,'return');equal(await read(0x405),[0,128,128,191],'first retained',1);
    await clear(0x405,[.25,.5,.75,1]);
    const presentation=await call('gpuPresent');equal(presentation.frames.at(-1),[64,128,191,255],'worker bitmap frame',1);
    return {actualBrowserWorker:true,checks};
  } finally {clearTimeout(guard);worker.terminate();URL.revokeObjectURL(url);}
}

if(typeof module!=='undefined') {
  module.exports=runDrawableTests;module.exports.worker=runDrawableWorkerTests;
  if(require.main===module)(async()=>{
    const path=require('path'),browser=await require('puppeteer').launch({headless:true,executablePath:process.env.CHROME||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
    try{const page=await browser.newPage();for(const name of ['region-map.generated','gpu-backend','gl-command-stream','mem-utils','gl-compat','gl-render-worker'])await page.addScriptTag({path:path.join(__dirname,`../lib/${name}.js`)});
      const direct=await page.evaluate(runDrawableTests);
      const fs=require('fs'),source=['region-map.generated','gpu-backend','gl-command-stream','mem-utils','gl-compat','gl-render-worker'].map(name=>fs.readFileSync(path.join(__dirname,`../lib/${name}.js`),'utf8')).join('\n');
      const worker=await page.evaluate(runDrawableWorkerTests,source);
      console.log('PASS',JSON.stringify([...direct,worker]));
    }finally{await browser.close();}
  })().catch(e=>{console.error(e);process.exitCode=1;});
} else {globalThis.runDrawableTests=runDrawableTests;globalThis.runDrawableWorkerTests=runDrawableWorkerTests;}
