'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),req=p=>require(path.join(root,p));
const {bootRenderHarness}=req('test/render-helper');
const {OpenGLHostBridge,CALL_INDEX}=req('lib/gl-compat');
const Stream=req('lib/gl-command-stream');
const table=req('src/api_table.json');
const extraWat=`
 (func (export "probe_drawables") (result i32)
   (local $p i32) (local $n i32)
   (local.set $p (global.get $gl_sw_drawables))
   (block $done (loop $scan (br_if $done (i32.eqz (local.get $p)))
     (local.set $n (i32.add (local.get $n) (i32.const 1)))
     (local.set $p (i32.load offset=4 (local.get $p))) (br $scan))) (local.get $n))
 (func (export "probe_init")
   (global.set $thunk_guest_base (i32.add (global.get $image_base)
     (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
   (call $update_thunk_end))
 (func (export "probe_regs") (result i32) (global.get $reg_base))
 (func (export "probe_module") (param $name i32) (result i32)
   (call $handle_LoadLibraryA (local.get $name) (i32.const 0) (i32.const 0)
     (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "probe_lookup") (param $module i32) (param $name i32) (result i32)
   (call $handle_GetProcAddress (local.get $module) (local.get $name)
     (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
   (i32.load (global.get $reg_base)))
 (func (export "probe_thunks") (result i32) (i32.atomic.load (global.get $THUNK_NEXT_SHARED)))
 (func (export "probe_error") (result i32) (global.get $last_error))
 (func (export "probe_dc") (param $hwnd i32) (result i32)
   (call $handle_GetDC (i32.const 0) (i32.const 0) (i32.const 0)
     (i32.const 0) (i32.const 0) (i32.const 0))
   (drop (call $gdi_dc_set_field (i32.load (global.get $reg_base)) (i32.const 92) (local.get $hwnd) (i32.const 0)))
   (i32.load (global.get $reg_base)))
 (func (export "probe_invoke") (param $thunk i32) (result i32)
   (call $win32_dispatch (i32.div_u
     (i32.sub (local.get $thunk) (global.get $thunk_guest_base)) (i32.const 8)))
   (i32.load (global.get $reg_base)))`;
(async()=>{
 let memory,bridge,encoder=null,manager=null,render=null,producer=null;
 const queued=process.argv.includes('--worker');
 const h=await bootRenderHarness({fonts:'none',width:4,height:4,extraWat,
  extraHostOverrides:{gpu_gl_call(op,at,bytes){
   if(op===Stream.WAT_STREAM_FLUSH_OPCODE){
     if(!render)return bridge.replay(Stream.memoryBatch(memory,at,bytes));
     const reply=render.execute({memoryOffset:at,bytes,owner:0,windows:Object.values(renderer.windows),softwareFront:e.gl_sw_front()});
     producer.configure(reply.producerConfig);return reply.value;
   }
   // No queued software executor: real synchronous WAT raster path.
   if(op>=0x20000&&op<=0x20006)return encoder ? encoder.call(op,at,bytes) : 0;
   throw Error('unexpected host opcode '+op);
  }}});
 memory=h.memory;const e=h.exports,dv=new DataView(memory.buffer),wa=p=>e.guest_to_wasm(p)>>>0;
 e.init_thread(1,0x400000,0,0,0,0,0);e.heap_init(0x800000);
 const renderer={windows:{42:{hwnd:42,w:4,h:4,clientRect:{w:4,h:4}}},repaint(){}};
 bridge=new OpenGLHostBridge({backend:'software',getMemory:()=>memory.buffer,exports:e,renderer});
 try {
 if(queued){
   const {Manager}=req('lib/render-worker'),{Encoder}=req('lib/d3d-command-stream');
   const {Worker}=require('worker_threads');
   producer=new (req('lib/gl-software-producer').Producer)(()=>e);
   const consumer=new WebAssembly.Instance(h.module,{host:h.host});
   consumer.exports.d3dim_worker_init(e.get_image_base()>>>0);
   assert.strictEqual(consumer.exports.gl_sw_front(),0,'consumer has independent mutable globals');
   render=req('lib/gl-render-worker').create({instance:consumer,memory,backend:'software',sendFrame(){}});
   manager=new Manager({module:h.module,memory,sigs:req('lib/host-import-sigs.generated.json').sigs,
     imageBase:e.get_image_base()>>>0,workerFactory:()=>new Worker(path.join(root,'lib/d3d-render-worker.js')),
     reclaimHeap:head=>e.d3d_render_adopt_free_list(head)});
   await manager.ready;
   const port=manager.createEndpoint({api:'legacy',backend:'software'});await port.ready;
   encoder=new Encoder({module:h.module,memory,sigs:req('lib/host-import-sigs.generated.json').sigs,
     getImageBase:()=>e.get_image_base()>>>0,guestToWasm:wa,workerFactory:()=>port,explicitFence:true,strictReady:true});
   assert(encoder.ready());
 }
 e.probe_init();const regs=e.probe_regs(),stack=e.guest_alloc(256)>>>0,stackWa=wa(stack);
 function str(s){const p=e.guest_alloc(s.length+1)>>>0;new Uint8Array(memory.buffer,wa(p),s.length+1).set(Buffer.from(s+'\0'));return p;}
 const module=e.probe_module(str('opengl32.dll'))>>>0;assert(module);
 const user32=e.probe_module(str('user32.dll'))>>>0;assert(user32);
 const cache=new Map();function resolve(name){if(!cache.has(name)){
   dv.setUint32(regs+16,stack,true);cache.set(name,e.probe_lookup(name.startsWith('gl')||name.startsWith('wgl')?module:user32,str(name))>>>0);
 }return cache.get(name);}
 function call(name,args=[]){const p=resolve(name);assert(p,'real resolver: '+name);
   const api=table.find(a=>a.name===name);assert.strictEqual(dv.getUint32(wa(p)+4,true),api.id);
   for(let i=0;i<8;i++)dv.setUint32(regs+i*4,0x55660000+i,true);
   dv.setUint32(regs+16,stack,true);new Uint8Array(memory.buffer,stackWa,256).fill(0xa5);
   dv.setUint32(stackWa,0x12345678,true);args.forEach((x,i)=>dv.setUint32(stackWa+4+i*4,x>>>0,true));
   const before=Buffer.from(new Uint8Array(memory.buffer,stackWa,256));
   const value=e.probe_invoke(p)>>>0;
   assert.strictEqual(dv.getUint32(regs+16,true),stack+4*(args.length+1),'stdcall '+name);
   for(let i=1;i<8;i++)if(i!==4)assert.strictEqual(dv.getUint32(regs+i*4,true),0x55660000+i,'register '+name);
   assert.deepStrictEqual(Buffer.from(new Uint8Array(memory.buffer,stackWa,256)),before,'stack '+name);
   return value;
 }
 const f=x=>{dv.setFloat32(stackWa+252,x,true);return dv.getUint32(stackWa+252,true);};
 const observations=[];
 function expect(label,actual,expected){assert.strictEqual(call('glGetError'),0,'valid operation: '+label);let passed=true;try{assert.deepStrictEqual(actual,expected);}catch{passed=false;}
  observations.push({label,actual,expected,passed});console.log(JSON.stringify(observations.at(-1)));}
 for(const name of ['glAccum','glClearAccum'])assert(resolve(name),'implemented signed accumulation resolves: '+name);
 const dc=e.probe_dc(42)>>>0;assert(dc);const context=call('wglCreateContext',[dc]);assert(context);
 assert.strictEqual(call('wglMakeCurrent',[dc,context]),1);
 call('glViewport',[0,0,4,4]);call('glClearColor',[f(1),f(0),f(0),f(1)]);call('glClear',[0x4000]);
 const nativePixel=entry=>dv.getUint32(dv.getUint32(entry+20,true),true)>>>0;
 assert.strictEqual(nativePixel(e.gl_sw_entry()),0xffff0000,'positive control: real WAT clear drew red');
 const output=e.guest_alloc(64)>>>0,outWa=wa(output);
 call('glReadBuffer',[0x405]);new Uint8Array(memory.buffer,outWa,64).fill(0xcc);
 call('glReadPixels',[0,0,1,1,0x1908,0x1401,output]);
 expect('software selected BACK readback after real red clear',Array.from(new Uint8Array(memory.buffer,outWa,4)),[255,0,0,255]);
 assert(new Uint8Array(memory.buffer,outWa+4,60).every(x=>x===0xcc),'readback writes exact output width');
 call('wglSwapBuffers',[dc]);
 assert.strictEqual(nativePixel(e.gl_sw_front()),0xffff0000,'present copied real red to front');
 call('glClearColor',[f(0),f(0),f(1),f(1)]);call('glClear',[0x4000]);
 assert.strictEqual(nativePixel(e.gl_sw_entry()),0xff0000ff,'positive control back blue');
 call('glDrawBuffer',[0x404]);call('glClearColor',[f(0),f(1),f(0),f(1)]);call('glClear',[0x4000]);
 expect('software FRONT clear changes FRONT',nativePixel(e.gl_sw_front()),0xff00ff00);
 expect('software FRONT clear preserves BACK',nativePixel(e.gl_sw_entry()),0xff0000ff);
 call('glDrawBuffer',[0]);call('glClearColor',[f(1),f(1),f(0),f(1)]);call('glClear',[0x4000]);
 expect('software draw NONE preserves BACK',nativePixel(e.gl_sw_entry()),0xff0000ff);
 call('glReadBuffer',[0x404]);call('glReadPixels',[0,0,1,1,0x1908,0x1401,output]);
 expect('software FRONT readback',Array.from(new Uint8Array(memory.buffer,outWa,4)),[0,255,0,255]);
 // One context can bind a different HDC/drawable. The real native handler
 // computes aux for that HDC, but the consumer currently ignores it.
 const c=bridge.contexts.get(context),originalHwnd=c?.hwnd;
 renderer.windows[123]={hwnd:123,w:4,h:4,clientRect:{w:4,h:4}};
 const secondDc=e.probe_dc(123)>>>0;assert(secondDc);
 assert.strictEqual(call('wglMakeCurrent',[secondDc,context]),1);
 if(!queued)expect('consumer applies make-current drawable aux',c.hwnd,123);
 // A real consumer call spy proves selections never reach its backend contract.
 if(!queued){ const invoked=[];const oldBackend=c.frontend.backend;
 c.frontend.backend=new Proxy(oldBackend,{get(t,k){if(['setDrawBuffer','setReadBuffer'].includes(k))return (...args)=>invoked.push([k,...args]);return t[k];}});
 call('glDrawBuffer',[0x404]);call('glReadBuffer',[0x404]);call('glFinish');
 console.log(JSON.stringify({diagnostic:'consumer selector calls observed',invoked}));
 c.frontend.backend=oldBackend; }

 // Both the selected readback and raw attachments must match independently.
 const read=(mode,format=0x1908,type=0x1401,w=1,h=1)=>{call('glReadBuffer',[mode]);
   new Uint8Array(memory.buffer,outWa,64).fill(0xcc);
   call('glReadPixels',[0,0,w,h,format,type,output]);return Array.from(new Uint8Array(memory.buffer,outWa,64));};
 const clear=rgba=>{call('glClearColor',rgba.map(f));call('glClear',[0x4000]);};
 const point=(rgba,z=0)=>{call('glColor4f',rgba.map(f));call('glBegin',[0]);call('glVertex3f',[f(-.875),f(-.625),f(z)]);call('glEnd');call('glFinish');};
 call('glDrawBuffer',[0x405]);clear([1,0,1,1]);
 assert.deepStrictEqual(read(0x405).slice(0,4),[255,0,255,255],'second drawable has its own back');
 assert.strictEqual(call('wglMakeCurrent',[dc,context]),1);
 assert.deepStrictEqual(read(0x404).slice(0,4),[0,255,0,255],'first front survives rebind');
 assert.deepStrictEqual(read(0x405).slice(0,4),[0,0,255,255],'first back survives rebind');
 call('glDrawBuffer',[0x404]);clear([1,0,0,1]);call('glDrawBuffer',[0x405]);clear([0,0,1,1]);
 call('glDrawBuffer',[0x408]);call('glEnable',[0xbe2]);call('glBlendFunc',[0x302,0x303]);
 point([0,1,0,.5]);call('glDisable',[0xbe2]);
 const front=read(0x404).slice(0,4),back=read(0x405).slice(0,4);
 assert(front[0]>=126&&front[0]<=128&&front[1]>=127&&front[1]<=129&&front[2]===0,'front independently blends against red');
 assert(back[0]===0&&back[1]>=127&&back[1]<=129&&back[2]>=126&&back[2]<=128,'back independently blends against blue');
 // A NONE draw still writes depth; a later equal-depth LESS draw must fail.
 call('glDrawBuffer',[0x408]);clear([0,0,1,1]);call('glClear',[0x100]);call('glEnable',[0xb71]);
 assert.deepStrictEqual(read(0x404).slice(0,4),[0,0,255,255]);
 call('glDrawBuffer',[0]);point([1,0,0,1]);
 call('glDrawBuffer',[0x408]);point([0,1,0,1]);call('glDisable',[0xb71]);
 assert.deepStrictEqual(read(0x404).slice(0,4),[0,0,255,255]);
 assert.deepStrictEqual(read(0x405).slice(0,4),[0,0,255,255]);
 // Two color attachments share one stencil decision and update. NONE still
 // updates that attachment, and selection must not double the increment.
 call('glClearStencil',[0]);call('glClear',[0x400]);call('glEnable',[0xb90]);
 call('glStencilFunc',[0x207,0,255]);call('glStencilOp',[0x1e00,0x1e00,0x1e02]);point([1,0,0,1]);
 clear([0,0,1,1]);call('glStencilFunc',[0x202,1,255]);call('glStencilOp',[0x1e00,0x1e00,0x1e00]);point([0,1,0,1]);
 assert.deepStrictEqual(read(0x404).slice(0,4),[0,255,0,255]);assert.deepStrictEqual(read(0x405).slice(0,4),[0,255,0,255]);
 call('glDrawBuffer',[0]);call('glStencilFunc',[0x207,0,255]);call('glStencilOp',[0x1e00,0x1e00,0x1e02]);point([1,0,0,1]);
 call('glDrawBuffer',[0x408]);call('glStencilFunc',[0x202,2,255]);call('glStencilOp',[0x1e00,0x1e00,0x1e00]);point([1,1,0,1]);
 assert.deepStrictEqual(read(0x404).slice(0,4),[255,255,0,255]);assert.deepStrictEqual(read(0x405).slice(0,4),[255,255,0,255]);call('glDisable',[0xb90]);
 for(const mode of [0x404,0x405,0x408]){
   call('glDrawBuffer',[0x408]);call('glColorMask',[1,1,1,1]);clear([0,0,1,1]);
   call('glDrawBuffer',[mode]);call('glColorMask',[1,0,0,0]);call('glScissor',[0,0,1,1]);call('glEnable',[0xc11]);
   clear([1,1,0,0]);call('glDisable',[0xc11]);call('glColorMask',[1,1,1,1]);
   for(const selected of [0x404,0x405]){
     const pixels=read(selected,0x1908,0x1401,2,2);
     assert.deepStrictEqual(pixels.slice(0,4),selected===mode||mode===0x408?[255,0,255,255]:[0,0,255,255]);
     assert.deepStrictEqual(pixels.slice(4,8),[0,0,255,255],'scissor preserves neighboring pixel');
   }
   call('glColorMask',[0,1,0,0]);point([0,1,0,0]);call('glColorMask',[1,1,1,1]);
   for(const selected of [0x404,0x405])assert.deepStrictEqual(read(selected).slice(0,4),selected===mode||mode===0x408?[255,255,255,255]:[0,0,255,255],'selected raster target and mask');
 }
 call('glDrawBuffer',[0x408]);clear([1,.5,0,1]);
 call('glPixelStorei',[0xd05,8]);call('glPixelStorei',[0xd02,3]);call('glPixelStorei',[0xd03,1]);call('glPixelStorei',[0xd04,1]);
 const packed=read(0x404,0x80e0,0x1401);
 assert(packed.slice(0,19).every(x=>x===0xcc));assert.deepStrictEqual(packed.slice(19,22),[0,128,255]);assert(packed.slice(22).every(x=>x===0xcc));
 for(const [p,v]of[[0xd05,1],[0xd02,0],[0xd03,0],[0xd04,0]])call('glPixelStorei',[p,v]);
 const short=read(0x405,0x80e1,0x1403);assert.deepStrictEqual(short.slice(0,8),[0,0,128,128,255,255,255,255]);
 call('glPixelStorei',[0xd00,1]);assert.deepStrictEqual(read(0x405,0x1907,0x1403).slice(0,6),[255,255,128,128,0,0]);call('glPixelStorei',[0xd00,0]);
 assert.deepStrictEqual(read(0x405,0x1906,0x1406).slice(0,4),[0,0,128,63]);
 assert.deepStrictEqual(read(0x405,0x1904,0x1406).slice(0,4),[129,128,0,63]);
 call('glPixelStorei',[0xd00,1]);assert.deepStrictEqual(read(0x405,0x1904,0x1406).slice(0,4),[63,0,128,129]);call('glPixelStorei',[0xd00,0]);
 for(const args of [[0,0,-1,1,0x1908,0x1401,output],[0,0,1,1,0xdead,0x1401,output],[0,0,1,1,0x1908,0xdead,output]]){
   new Uint8Array(memory.buffer,outWa,64).fill(0xcc);call('glReadPixels',args);
   assert.strictEqual(call('glGetError'),args[2]<0?0x501:0x500);assert(new Uint8Array(memory.buffer,outWa,64).every(x=>x===0xcc));
 }
 call('glDrawBuffer',[0]);call('glGetIntegerv',[0xc01,output]);assert.strictEqual(dv.getUint32(outWa,true),0);
 call('glDrawBuffer',[0x407]);assert.strictEqual(call('glGetError'),0x502);
 call('glDrawBuffer',[0x409]);assert.strictEqual(call('glGetError'),0x502);
 call('glReadBuffer',[0]);assert.strictEqual(call('glGetError'),0x500);
 call('glGetIntegerv',[0xc01,output]);assert.strictEqual(dv.getUint32(outWa,true),0,'error preserves selection');
 call('glBegin',[0]);call('glDrawBuffer',[0x404]);call('glEnd');assert.strictEqual(call('glGetError'),0x502);
 new Uint8Array(memory.buffer,outWa,64).fill(0xcc);
 call('glBegin',[0]);call('glReadPixels',[0,0,1,1,0x1908,0x1401,output]);call('glEnd');assert.strictEqual(call('glGetError'),0x502);
 assert(new Uint8Array(memory.buffer,outWa,64).every(x=>x===0xcc));
 call('glNewList',[78,0x1300]);call('glDrawBuffer',[0xdead]);assert.strictEqual(call('glGetError'),0x500);call('glEndList');call('glCallList',[78]);assert.strictEqual(call('glGetError'),0);call('glDeleteLists',[78,1]);
 call('glDrawBuffer',[0x405]);call('glReadBuffer',[0x404]);clear([1,0,0,1]);
 call('glPushAttrib',[0x4000]);call('glDrawBuffer',[0]);call('glReadBuffer',[0x405]);clear([0,1,0,1]);call('glPopAttrib');
 call('glGetIntegerv',[0xc01,output]);assert.strictEqual(dv.getUint32(outWa,true),0x405);
 call('glGetIntegerv',[0xc02,output]);assert.strictEqual(dv.getUint32(outWa,true),0x405,'ReadBuffer belongs to GL_PIXEL_MODE_BIT');
 call('glClear',[0x4000]);assert.deepStrictEqual(read(0x405).slice(0,4),[255,0,0,255],'pop restores clear value');
 call('glNewList',[77,0x1300]);call('glDrawBuffer',[0x404]);call('glClearColor',[f(0),f(1),f(0),f(1)]);call('glClear',[0x4000]);call('glEndList');
 assert.deepStrictEqual(read(0x405).slice(0,4),[255,0,0,255],'compile does not execute');
 call('glCallList',[77]);assert.deepStrictEqual(read(0x404).slice(0,4),[0,255,0,255]);assert.deepStrictEqual(read(0x405).slice(0,4),[255,0,0,255]);
 call('glDeleteLists',[77,1]);
 const another=call('wglCreateContext',[secondDc]);assert(another);assert.strictEqual(call('wglMakeCurrent',[secondDc,another]),1);
 call('glDrawBuffer',[0x405]);clear([0,1,1,1]);
 assert.strictEqual(call('wglMakeCurrent',[dc,context]),1);call('glClear',[0x4000]);
 assert.deepStrictEqual(read(0x404).slice(0,4),[0,255,0,255],'contexts retain their own clear and selector state');
 assert.strictEqual(call('wglDeleteContext',[another]),1);
 assert.strictEqual(call('wglMakeCurrent',[secondDc,context]),1);
 assert.deepStrictEqual(read(0x405).slice(0,4),[0,255,255,255],'context deletion leaves drawable storage');
 renderer.windows[123].clientRect={w:2,h:3};renderer.windows[123].w=2;renderer.windows[123].h=3;
 assert.strictEqual(call('wglMakeCurrent',[secondDc,context]),1);call('glDrawBuffer',[0x408]);clear([1,1,0,1]);
 assert.strictEqual(dv.getUint16(e.gl_sw_entry()+12,true),2);assert.strictEqual(dv.getUint16(e.gl_sw_front()+14,true),3);
 assert.deepStrictEqual(read(0x404).slice(0,4),[255,255,0,255]);assert.deepStrictEqual(read(0x405).slice(0,4),[255,255,0,255]);
 assert.strictEqual(call('wglMakeCurrent',[dc,context]),1);
 assert.deepStrictEqual(read(0x405).slice(0,4),[255,0,0,255],'resizing second drawable preserves first');
 // https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-wglmakecurrent
 assert.strictEqual(call('wglMakeCurrent',[0,context]),0);
 assert.strictEqual(call('wglGetCurrentContext'),0,'failed bind detaches the current context');
 assert.strictEqual(call('wglMakeCurrent',[dc,context]),1);
 assert.deepStrictEqual(read(0x405).slice(0,4),[255,0,0,255],'failed bind preserves drawable storage');
 const window=call('CreateWindowExA',[0,str('STATIC'),str('GL ownership'),0,0,0,4,4,0,0,0,0]);assert(window);
 renderer.windows[window]=h.renderer.windows[window]||{hwnd:window,w:4,h:4,clientRect:{w:4,h:4}};
 const windowDc=e.probe_dc(window)>>>0;
 const beforeDelete=e.probe_drawables();assert.strictEqual(call('wglMakeCurrent',[windowDc,context]),1);
 call('glDrawBuffer',[0x408]);clear([1,0,1,1]);assert.strictEqual(e.probe_drawables(),beforeDelete+1);
 assert.strictEqual(call('SetWindowPos',[window,0,0,0,2,3,0x14]),1);clear([0,0,1,1]);
 assert.strictEqual(dv.getUint16(e.gl_sw_entry()+12,true),2,'native drawable follows client resize without context rebind');
 assert.strictEqual(dv.getUint16(e.gl_sw_front()+14,true),3);
 assert.strictEqual(call('wglMakeCurrent',[dc,context]),1);
 assert.strictEqual(call('DestroyWindow',[window]),1);assert.strictEqual(e.probe_drawables(),beforeDelete,'DestroyWindow retires its attachments');
 assert.deepStrictEqual(read(0x405).slice(0,4),[255,0,0,255]);
 assert.strictEqual(call('glGetError'),0);
 if(queued){encoder.fence();assert(encoder.snapshot().glQueued>=3,'actual native renderer queued points');}

 assert.strictEqual(call('wglDeleteContext',[context]),1);
 assert.strictEqual(observations.filter(x=>!x.passed).length,0);
 console.log('PASS resolved drawable-owned front/back, rebind, independent blend, NONE depth, mask/scissor, pack/formats, contexts/errors/lists/resize; '+(queued?'queued native and software consumer':'direct native and software consumer'));
 } finally { if(encoder)encoder.stop();if(manager)await manager.stop();if(render)render.destroy(); }
})().catch(e=>{console.error(e);process.exitCode=1;});

