'use strict';
// Used by web-controls.cjs, which supplies the existing bounded Chrome runner.
async function exactProbe(workerSource) {
 const tables=LITERAL_TABLES;
 const equal=(a,b,label)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error(label+' actual='+JSON.stringify(a)+' expected='+JSON.stringify(b));};
 const f=x=>{const b=new ArrayBuffer(4),v=new DataView(b);v.setFloat32(0,x,true);return v.getUint32(0,true);};
 function packed(raw,count=1,alpha=0xffffffff,green=raw){
  const out=[];
  for(let i=0;i<count;i++){
   const v=Array(28).fill(0);v[2]=0;v[3]=v[5]=Math.fround(raw/0xffffffff);v[4]=Math.fround(green/0xffffffff);v[6]=Math.fround(alpha/0xffffffff);v[14]=v[16]=v[18]=1;
   for(let c=0;c<4;c++){const n=c===3?alpha:c===1?green:raw;v[19+c*2]=n&65535;v[20+c*2]=n>>>16;}v[27]=32;out.push(...v);
  }return out;
 }
 function bitmapPacked(raw,green=raw){
  const v=Array(19).fill(0);v[3]=v[5]=(raw>>>24)/255;v[4]=(green>>>24)/255;v[6]=1;v[14]=v[16]=v[18]=1;return v;
 }
 const rows=[];
 for(const apiVersion of [1,2])for(const format of ['rgb555','rgb565','rgba8']){
  const bpp=format==='rgba8'?32:16,is565=format==='rgb565';
  const width=1,height=1,stride=4,storage=new Uint8Array(stride).fill(0x6d),view=new DataView(storage.buffer);
  const table=bpp===16?tables.five:tables.eight,level=n=>bpp===16?Math.round(n*255/31):n;
  const seed=table.destination;
  bpp===16?view.setUint16(0,is565?0x9cd3:0x8000+seed*0x421,true):view.setUint32(0,seed*0x1010101,true);
  const surface=new gdiSurfaceLib.GdiSurface({width,height,bpp,stride,storage,topDown:true,masks:is565?[0xf800,0x7e0,31]:undefined});
  const memory=new ArrayBuffer(8192),dv=new DataView(memory),bridge=new OpenGLCompat.OpenGLHostBridge({apiVersion,
   getMemory:()=>memory,exports:{guest_to_wasm:p=>p},getGdiSurface:id=>id===5?{surface}:null,
   createCanvas:(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;}});
  function call(name,args=[]){
   if(OpenGLCompat.CALL_INDEX[name]===undefined)throw Error('production opcode missing: '+name);
   args.forEach((a,i)=>dv.setUint32(4+i*4,a>>>0,true));return bridge.call(OpenGLCompat.CALL_INDEX[name],0,0);
  }
  function draw(raw,count=1,green=raw){
   const v=packed(raw,count,0xffffffff,green),bytes=32+v.length*4;
   new Uint8Array(memory,1024,bytes).fill(0);dv.setUint32(1024,bytes,true);dv.setUint32(1028,0x10002,true);
   dv.setUint32(1032,0,true);dv.setUint32(1044,v.length*4,true);dv.setUint32(1048,32,true);dv.setUint32(1052,1,true);
   new Float32Array(memory,1056,v.length).set(v);bridge.replay(GLCommandStream.memoryBatch(memory,1024,bytes));
  }
  function drawBitmap(raw,green=raw){
   const v=bitmapPacked(raw,green),bytes=32+v.length*4;new Uint8Array(memory,1024,bytes).fill(0);dv.setUint32(1024,bytes,true);dv.setUint32(1028,0x10000,true);dv.setUint32(1032,0x10000,true);dv.setUint32(1044,v.length*4,true);dv.setUint32(1048,32,true);dv.setUint32(1052,1,true);new Float32Array(memory,1056,v.length).set(v);bridge.replay(GLCommandStream.memoryBatch(memory,1024,bytes));
  }
  function read(){call('glReadPixels',[0,0,1,1,0x1908,0x1401,512]);return Array.from(new Uint8Array(memory,512,4));}
  function reset(){call('glClearColor',[f(seed/(bpp===16?31:255)),f(is565?38/63:seed/(bpp===16?31:255)),f(seed/(bpp===16?31:255)),f(bpp===16?1:seed/255)]);call('glClear',[0x4000]);}
  try{
   const ctx=bridge.createBitmapContext(0x80000005);if(!ctx||!bridge.makeCurrent(ctx,0x80000005))throw Error('WebGL context creation '+apiVersion);
   equal(bridge._current().backend.version,apiVersion,'actual requested API version');
   {const gl=bridge._current().backend.gl;equal([gl.RED_BITS,gl.GREEN_BITS,gl.BLUE_BITS,gl.ALPHA_BITS].map(p=>gl.getParameter(p)),format==='rgb555'?[5,5,5,1]:is565?[5,6,5,0]:[8,8,8,8],'actual attachment precision '+format);}
   call('glGetIntegerv',[0xbf0,512]);equal(dv.getUint32(512,true),0x1503,'default COPY');equal(call('glIsEnabled',[0xbf2]),0,'default COLOR disabled');equal(call('glIsEnabled',[0xbf1]),0,'default INDEX disabled');
   call('glLogicOp',[0x1510]);equal(call('glGetError'),0x500,'invalid operation enum');call('glGetIntegerv',[0xbf0,512]);equal(dv.getUint32(512,true),0x1503,'invalid enum preserves COPY');
   call('glViewport',[0,0,1,1]);call('glDisable',[0xbd0]);call('glEnable',[0xbf2]);
   for(let op=0;op<16;op++){
    reset();call('glLogicOp',[0x1500+op]);draw(bpp===16?0x48000000:0x35000000,1,is565?0x54000000:bpp===16?0x48000000:0x35000000);
    const v=level(table.expected[op]),alpha=bpp===16?255:[0,166,89,255,0,166,89,255,0,166,89,255,0,166,89,255][op];
    const g=is565?Math.round(tables.six.expected[op]*255/63):v;
    equal(read(),[v,g,v,alpha],'WebGL'+apiVersion+' '+format+' '+tables.operations[op]);
    equal(call('glGetError'),0,'no feedback/GL error');rows.push({apiVersion,bpp,format,op,expected:[v,g,v,alpha]});
   }
   call('glLogicOp',[0x1506]);const c=bpp===16?tables.exactSourceXor.five:tables.exactSourceXor.eight;
   for(let i=0;i<2;i++){reset();draw(c.raw[i],1,is565?tables.exactSourceXor.six.raw[i]:c.raw[i]);const v=level(c.expected[i]),g=is565?Math.round(tables.exactSourceXor.six.expected[i]*255/63):v;equal(read(),[v,g,v,bpp===16?255:89],'exact integer XOR '+i);}
   for(let op=0;op<16;op++){
    reset();call('glLogicOp',[0x1500+op]);drawBitmap(bpp===16?0x48000000:0x35000000,is565?0x54000000:bpp===16?0x48000000:0x35000000);
    const v=level(table.expected[op]),g=is565?Math.round(tables.six.expected[op]*255/63):v,a=bpp===16?255:[0,166,89,255,0,166,89,255,0,166,89,255,0,166,89,255][op];equal(read(),[v,g,v,a],'bitmap '+tables.operations[op]);rows.push({apiVersion,format,bitmap:true,op});
   }
   call('glLogicOp',[0x150a]);
   for(const count of [1,2,3]){reset();draw(0,count);const v=level((bpp===16?tables.overlapInvert.five:tables.overlapInvert.eight)[count]),g=is565?Math.round(tables.overlapInvert.six[count]*255/63):v;equal(read(),[v,g,v,bpp===16?255:count%2?89:166],'overlap INVERT '+count);}
   call('glLogicOp',[0x1506]);
   for(let mask=0;mask<16;mask++){
    call('glColorMask',[1,1,1,1]);reset();call('glColorMask',[mask&1,(mask>>1)&1,(mask>>2)&1,(mask>>3)&1]);
    draw(bpp===16?0x48000000:0x35000000,1,is565?0x54000000:bpp===16?0x48000000:0x35000000);
    const r=level(mask&1?table.expected[6]:seed),g=is565?Math.round((mask&2?51:38)*255/63):level(mask&2?table.expected[6]:seed),z=level(mask&4?table.expected[6]:seed),a=bpp===16?255:mask&8?89:166;
    equal(read(),[r,g,z,a],'post-logic channel mask '+mask);rows.push({apiVersion,format,mask});
   }
   call('glColorMask',[1,1,1,1]);call('glEnable',[0xbe2]);call('glBlendFunc',[0,0]);call('glLogicOp',[0x1503]);
   reset();draw(0xffffffff);equal(read(),[255,255,255,255],'logic suppresses requested ZERO/ZERO blend');
   equal(call('glIsEnabled',[0xbe2]),1,'requested BLEND preserved');
   call('glDisable',[0xbf2]);call('glEnable',[0xbf1]);call('glLogicOp',[0x150f]);reset();draw(0xffffffff);
   equal(read(),[0,0,0,bpp===16?255:0],'INDEX_LOGIC_OP distinct in RGBA');
   call('glDisable',[0xbf1]);call('glDisable',[0xbe2]);call('glEnable',[0xbf2]);
   call('glLogicOp',[0x1506]);call('glPushAttrib',[0x4000]);call('glLogicOp',[0x150a]);call('glDisable',[0xbf2]);call('glEnable',[0xbf1]);call('glPopAttrib');call('glGetIntegerv',[0xbf0,512]);equal(dv.getUint32(512,true),0x1506,'COLOR attributes mode');equal(call('glIsEnabled',[0xbf2]),1,'COLOR attributes enable');equal(call('glIsEnabled',[0xbf1]),0,'COLOR attributes index');
   call('glPushAttrib',[1]);call('glLogicOp',[0x150a]);call('glDisable',[0xbf2]);call('glEnable',[0xbf1]);call('glPopAttrib');call('glGetIntegerv',[0xbf0,512]);equal(dv.getUint32(512,true),0x150a,'CURRENT retains changed logic mode');equal(call('glIsEnabled',[0xbf2]),0,'CURRENT retains changed enable');equal(call('glIsEnabled',[0xbf1]),1,'CURRENT retains changed index');call('glDisable',[0xbf1]);call('glEnable',[0xbf2]);

   call('glLogicOp',[0x150a]);call('glClearAccum',[0,0,0,0]);call('glClear',[0x200]);call('glAccum',[0x102,f(1)]);
   equal(read(),[0,0,0,bpp===16?255:0],'accum RETURN bypasses logic');
   bridge.flushFrontBuffer();if(bpp===16){equal(storage[2],0x6d,'padding byte2');equal(storage[3],0x6d,'padding byte3');if(!is565)equal(view.getUint16(0,true)&0x8000,0x8000,'X padding bit');}
  }finally{bridge.destroy();}
 }
 for(const apiVersion of [1,2])for(const format of ['rgb555','rgb565']){
  const is565=format==='rgb565',storage=new Uint8Array(8),surface=new gdiSurfaceLib.GdiSurface({width:2,height:2,bpp:16,stride:4,storage,topDown:true,masks:is565?[0xf800,0x7e0,31]:undefined});
  const memory=new ArrayBuffer(8192),dv=new DataView(memory),bridge=new OpenGLCompat.OpenGLHostBridge({apiVersion,getMemory:()=>memory,exports:{guest_to_wasm:p=>p},getGdiSurface:()=>({surface}),createCanvas:(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;}});
  const call=(n,a=[])=>{a.forEach((v,i)=>dv.setUint32(4+i*4,v>>>0,true));return bridge.call(OpenGLCompat.CALL_INDEX[n],0,0);};
  try{
   const ctx=bridge.createBitmapContext(0x80000005);equal(bridge.makeCurrent(ctx,0x80000005),1,'dither context');
   call('glViewport',[0,0,2,2]);call('glClearColor',[f(19/31),f(is565?38/63:19/31),f(19/31),f(1)]);call('glClear',[0x4000]);
   call('glEnable',[0xbd0]);call('glEnable',[0xbf2]);call('glLogicOp',[0x1506]);
   const v=packed(0x07000000,4,0xffffffff,is565?0x03000000:0x07000000);for(let i=0;i<4;i++){v[i*28]=i%2? .5:-.5;v[i*28+1]=i<2?-.5:.5;}
   const bytes=32+v.length*4;dv.setUint32(1024,bytes,true);dv.setUint32(1028,0x10002,true);dv.setUint32(1032,0,true);dv.setUint32(1044,v.length*4,true);dv.setUint32(1048,32,true);dv.setUint32(1052,1,true);new Float32Array(memory,1056,v.length).set(v);bridge.replay(GLCommandStream.memoryBatch(memory,1024,bytes));
   call('glReadPixels',[0,0,2,2,0x1908,0x1401,512]);
   equal(Array.from(new Uint8Array(memory,512,16)),is565?[156,154,156,255,148,158,148,255,148,158,148,255,148,158,148,255]:[156,156,156,255,148,148,148,255,148,148,148,255,148,148,148,255],'source dither before logic '+format);
   equal(call('glGetError'),0,'dither GL error');rows.push({apiVersion,format,ditherBeforeLogic:true});
  }finally{bridge.destroy();}
 }
 for(const apiVersion of [1,2]){
  const memory=new ArrayBuffer(16384),dv=new DataView(memory),renderer={windows:{42:{hwnd:42,w:4,h:4,clientRect:{w:4,h:4}}},repaint(){}};
  const bridge=new OpenGLCompat.OpenGLHostBridge({apiVersion,getMemory:()=>memory,exports:{guest_to_wasm:p=>p},renderer,
   createCanvas:(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;}});
  const call=(name,args=[])=>{if(OpenGLCompat.CALL_INDEX[name]===undefined)throw Error('production opcode missing '+name);args.forEach((v,i)=>dv.setUint32(4+i*4,v>>>0,true));return bridge.call(OpenGLCompat.CALL_INDEX[name],0,0);};
  function clear(mode,n,bits=0x4000){call('glDrawBuffer',[mode]);call('glClearColor',Array(4).fill(f(n/255)));call('glClear',[bits]);}
  function seed(){clear(0x404,166);clear(0x405,60);call('glDrawBuffer',[0x408]);}
  function read(mode){call('glReadBuffer',[mode]);call('glReadPixels',[1,1,1,1,0x1908,0x1401,512]);return Array.from(new Uint8Array(memory,512,4));}
  function draw(count,triangle=false){
   const line=triangle==='line';triangle=triangle===true;
   const v=packed(0x35000000,count*(triangle?3:line?2:1),0x35000000);
   if(triangle)for(let i=0;i<count*3;i++){v[i*28]=[-1,1,0][i%3];v[i*28+1]=[-1,-1,1][i%3];}
   else for(let i=0;i<count*(line?2:1);i++){v[i*28]=line?(i%2?.75:-.75):-.25;v[i*28+1]=-.25;}
   const bytes=32+v.length*4;new Uint8Array(memory,1024,bytes).fill(0);dv.setUint32(1024,bytes,true);dv.setUint32(1028,0x10002,true);
   dv.setUint32(1032,triangle?4:line?1:0,true);dv.setUint32(1044,v.length*4,true);dv.setUint32(1048,32,true);dv.setUint32(1052,1,true);
   new Float32Array(memory,1056,v.length).set(v);bridge.replay(GLCommandStream.memoryBatch(memory,1024,bytes));
  }
  try{
   const ctx=bridge.createContext(42);if(!ctx||!bridge.makeCurrent(ctx,42))throw Error('front/back real WebGL context');
   equal(bridge._current().backend.version,apiVersion,'front/back actual API');call('glViewport',[0,0,4,4]);call('glDisable',[0xbd0]);
   call('glLogicOp',[0x1506]);call('glEnable',[0xbf2]);
   for(const triangle of [false,true,'line'])for(const count of [1,2,3]){
    seed();draw(count,triangle);equal(read(0x404),Array(4).fill(count%2?147:166),'independent FRONT ordered '+count+' triangle='+triangle);
    equal(read(0x405),Array(4).fill(count%2?9:60),'independent BACK ordered '+count+' triangle='+triangle);
    equal(call('glGetError'),0,'front/back feedback/GL error');rows.push({apiVersion,frontback:true,count,triangle});
   }
   seed();call('glClear',[0x500]);call('glEnable',[0xb71]);call('glDepthFunc',[0x201]);call('glEnable',[0xb90]);
   call('glStencilFunc',[0x207,0,255]);call('glStencilOp',[0x1e00,0x1e00,0x1e02]);draw(1);
   equal(read(0x404),Array(4).fill(147),'shared depth front');equal(read(0x405),Array(4).fill(9),'shared depth back');
   call('glDisable',[0xb71]);call('glStencilFunc',[0x202,1,255]);call('glStencilOp',[0x1e00,0x1e00,0x1e00]);draw(1);
   equal(read(0x404),Array(4).fill(166),'stencil once front');equal(read(0x405),Array(4).fill(60),'stencil once back');
   call('glStencilFunc',[0x202,2,255]);draw(1);equal(read(0x405),Array(4).fill(60),'stencil not twice');
   equal(call('glGetError'),0,'front/back final GL error');
  }finally{bridge.destroy();}
 }
 function startWorker(){
  let endpoint;const memory={buffer:new ArrayBuffer(8192)},dv=new DataView(memory.buffer);
  self.onmessage=({data:d})=>{try{
   if(d.init){endpoint=GLRenderWorker.create({instance:{exports:{guest_to_wasm:p=>p}},memory,backend:'webgl',apiVersion:d.apiVersion,sendFrame(){}});self.postMessage({id:d.id,ready:true});return;}
   const n=d.vertices?.length||0,stack=n?0:(d.args.length+1)*4,bytes=32+stack+n*4;
   new Uint8Array(memory.buffer,0,bytes).fill(0);dv.setUint32(0,bytes,true);
   if(!n&&OpenGLCompat.CALL_INDEX[d.name]===undefined)throw Error('production opcode missing '+d.name);
   dv.setUint32(4,n?(d.bitmap?0x10000:0x10002):OpenGLCompat.CALL_INDEX[d.name],true);dv.setUint32(8,n?(d.bitmap?0x10000:d.mode||0):(d.aux||0),true);dv.setUint32(12,stack,true);
   if(n){dv.setUint32(20,n*4,true);dv.setUint32(24,32,true);dv.setUint32(28,1,true);new Float32Array(memory.buffer,32,n).set(d.vertices);}
   else d.args.forEach((a,i)=>dv.setUint32(36+i*4,a>>>0,true));
   const reply=endpoint.execute({memoryOffset:0,bytes,owner:1,surfaces:d.surfaces,windows:d.windows});
   self.postMessage({id:d.id,reply,pixels:Array.from(new Uint8Array(memory.buffer,512,16)),pixel:Array.from(new Uint8Array(memory.buffer,512,4))});
  }catch(error){self.postMessage({id:d.id,error:String(error),stack:error.stack});}};
 }
 for(const apiVersion of [1,2])for(const format of ['rgb555','rgb565','rgba8']){
  const bpp=format==='rgba8'?32:16,is565=format==='rgb565';
  const url=URL.createObjectURL(new Blob([workerSource,'\n('+startWorker.toString()+')();'],{type:'text/javascript'})),worker=new Worker(url);
  let next=0;const pending=new Map();worker.onmessage=({data:d})=>{const p=pending.get(d.id);if(p){pending.delete(d.id);d.error?p.reject(Error(d.error+'\n'+d.stack)):p.resolve(d);}};
  worker.onerror=e=>{for(const p of pending.values())p.reject(Error(e.message));pending.clear();};
  const send=d=>new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});worker.postMessage({...d,id});});
  const call=(name,args=[],extra={})=>send({name,args,...extra});
  try{
   await send({init:true,apiVersion});
   const ctx=await call('wglCreateContext',[1],{aux:0x80000005,surfaces:[{id:5,width:1,height:1,bpp,colorMasks:is565?[0xf800,0x7e0,31]:bpp===16?[0x7c00,0x3e0,31]:[0xff0000,0xff00,255],pixels:new Uint8ClampedArray([0,0,0,255])}]});
   if(!ctx.reply.value)throw Error('actual Worker context creation');
   const bind=await call('wglMakeCurrent',[1,ctx.reply.value],{aux:0x80000005});
   equal(bind.reply.value,1,'actual Worker bind');equal(bind.reply.webglVersion,apiVersion,'actual Worker API version must be evidenced');
   await call('glViewport',[0,0,1,1]);await call('glDisable',[0xbd0]);await call('glEnable',[0xbf2]);
   const table=bpp===16?tables.five:tables.eight,seed=table.destination,level=n=>bpp===16?Math.round(n*255/31):n;
   async function reset(){await call('glClearColor',[f(seed/(bpp===16?31:255)),f(is565?38/63:seed/(bpp===16?31:255)),f(seed/(bpp===16?31:255)),f(bpp===16?1:seed/255)]);await call('glClear',[0x4000]);}
   async function read(){return(await call('glReadPixels',[0,0,1,1,0x1908,0x1401,512])).pixel;}
   for(let op=0;op<16;op++){
    await reset();await call('glLogicOp',[0x1500+op]);await call(null,[],{vertices:packed(bpp===16?0x48000000:0x35000000,1,0xffffffff,is565?0x54000000:bpp===16?0x48000000:0x35000000)});
    const v=level(table.expected[op]),a=bpp===16?255:[0,166,89,255,0,166,89,255,0,166,89,255,0,166,89,255][op];
    const g=is565?Math.round(tables.six.expected[op]*255/63):v;
    equal(await read(),[v,g,v,a],'actual Worker API'+apiVersion+' '+format+' '+tables.operations[op]);
    rows.push({actualBrowserWorker:true,apiVersion,bpp,format,op});
   }
   for(let op=0;op<16;op++){
    await reset();await call('glLogicOp',[0x1500+op]);await call(null,[],{bitmap:true,vertices:bitmapPacked(bpp===16?0x48000000:0x35000000,is565?0x54000000:bpp===16?0x48000000:0x35000000)});
    const v=level(table.expected[op]),g=is565?Math.round(tables.six.expected[op]*255/63):v,a=bpp===16?255:[0,166,89,255,0,166,89,255,0,166,89,255,0,166,89,255][op];equal(await read(),[v,g,v,a],'Worker bitmap '+tables.operations[op]);rows.push({apiVersion,format,actualBrowserWorker:true,bitmap:true,op});
   }
   await call('glLogicOp',[0x1506]);
   {const c=bpp===16?tables.exactSourceXor.five:tables.exactSourceXor.eight;
    for(let i=0;i<2;i++){
     await reset();await call(null,[],{vertices:packed(c.raw[i],1,0xffffffff,is565?tables.exactSourceXor.six.raw[i]:c.raw[i])});
     const v=level(c.expected[i]),g=is565?Math.round(tables.exactSourceXor.six.expected[i]*255/63):v;
     equal(await read(),[v,g,v,bpp===16?255:89],'actual Worker exact integer boundary '+i);
     rows.push({actualBrowserWorker:true,apiVersion,bpp,format,exactBoundary:i});
    }
   }
   await call('glLogicOp',[0x150a]);
   for(const count of [1,2,3]){await reset();await call(null,[],{vertices:packed(0,count)});const v=level((bpp===16?tables.overlapInvert.five:tables.overlapInvert.eight)[count]),g=is565?Math.round(tables.overlapInvert.six[count]*255/63):v;equal(await read(),[v,g,v,bpp===16?255:count%2?89:166],'actual Worker ordered overlap '+count);}
   await call('glLogicOp',[0x1506]);
   for(let mask=0;mask<16;mask++){
    await call('glColorMask',[1,1,1,1]);await reset();await call('glColorMask',[mask&1,(mask>>1)&1,(mask>>2)&1,(mask>>3)&1]);
    await call(null,[],{vertices:packed(bpp===16?0x48000000:0x35000000,1,0xffffffff,is565?0x54000000:bpp===16?0x48000000:0x35000000)});
    equal(await read(),[level(mask&1?table.expected[6]:seed),is565?Math.round((mask&2?51:38)*255/63):level(mask&2?table.expected[6]:seed),level(mask&4?table.expected[6]:seed),bpp===16?255:mask&8?89:166],'Worker channel mask '+mask);
   }
   await call('glColorMask',[1,1,1,1]);await call('glEnable',[0xbe2]);await call('glBlendFunc',[0,0]);await call('glLogicOp',[0x1503]);await reset();await call(null,[],{vertices:packed(0xffffffff)});
   equal(await read(),[255,255,255,255],'Worker logic overrides ZERO blend');equal((await call('glIsEnabled',[0xbe2])).reply.value,1,'Worker requested blend preserved');await call('glDisable',[0xbe2]);
   if(bpp===16){
    const next=await call('wglCreateContext',[1],{aux:0x80000006,surfaces:[{id:6,width:2,height:2,bpp:16,colorMasks:is565?[0xf800,0x7e0,31]:[0x7c00,0x3e0,31],pixels:new Uint8ClampedArray([0,0,0,255,0,0,0,255,0,0,0,255,0,0,0,255])}]});
    equal((await call('wglMakeCurrent',[1,next.reply.value],{aux:0x80000006})).reply.value,1,'Worker dither bind');await call('glViewport',[0,0,2,2]);
    await call('glClearColor',[f(19/31),f(is565?38/63:19/31),f(19/31),f(1)]);await call('glClear',[0x4000]);await call('glEnable',[0xbd0]);await call('glEnable',[0xbf2]);await call('glLogicOp',[0x1506]);
    const v=packed(0x07000000,4,0xffffffff,is565?0x03000000:0x07000000);for(let i=0;i<4;i++){v[i*28]=i%2?.5:-.5;v[i*28+1]=i<2?-.5:.5;}await call(null,[],{vertices:v});
    equal((await call('glReadPixels',[0,0,2,2,0x1908,0x1401,512])).pixels,is565?[156,154,156,255,148,158,148,255,148,158,148,255,148,158,148,255]:[156,156,156,255,148,148,148,255,148,148,148,255,148,148,148,255],'Worker dither before logic');
   }else{
    const next=await call('wglCreateContext',[1],{aux:42,windows:[{hwnd:42,w:4,h:4,clientSize:{w:4,h:4}}]});equal((await call('wglMakeCurrent',[1,next.reply.value],{aux:42})).reply.value,1,'Worker front/back bind');
    await call('glViewport',[0,0,4,4]);await call('glDisable',[0xbd0]);await call('glEnable',[0xbf2]);await call('glLogicOp',[0x1506]);
    for(const triangle of [false,true,'line'])for(const count of [1,2,3]){
     for(const [mode,value] of [[0x404,166],[0x405,60]]){await call('glDrawBuffer',[mode]);await call('glClearColor',Array(4).fill(f(value/255)));await call('glClear',[0x4000]);}await call('glDrawBuffer',[0x408]);
     const line=triangle==='line',tri=triangle===true;const v=packed(0x35000000,count*(tri?3:line?2:1),0x35000000);for(let i=0;i<v.length/28;i++){v[i*28]=tri?[-1,1,0][i%3]:line?(i%2?.75:-.75):-.25;v[i*28+1]=tri?[-1,-1,1][i%3]:-.25;}await call(null,[],{vertices:v,mode:tri?4:line?1:0});
     await call('glReadBuffer',[0x404]);equal((await call('glReadPixels',[1,1,1,1,0x1908,0x1401,512])).pixel,Array(4).fill(count%2?147:166),'Worker independent front overlap');
     await call('glReadBuffer',[0x405]);equal((await call('glReadPixels',[1,1,1,1,0x1908,0x1401,512])).pixel,Array(4).fill(count%2?9:60),'Worker independent back overlap');
    }
   }
   rows.push({actualBrowserWorker:true,apiVersion,format,allMasks:true,blendOverride:true,dither:bpp===16,frontback:bpp===32});
   equal((await call('glGetError')).reply.value,0,'actual Worker final GL error');
  }finally{worker.terminate();URL.revokeObjectURL(url);}
 }
 return rows;
}
