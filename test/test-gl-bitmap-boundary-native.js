'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),req=p=>require(path.join(root,p));
const {bootRenderHarness}=req('test/render-helper');
const {OpenGLHostBridge,CALL_INDEX}=req('lib/gl-compat');
const Stream=req('lib/gl-command-stream');
const table=req('src/api_table.json');
const extraWat=`
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
 (func (export "probe_invoke") (param $thunk i32) (result i32)
   (call $win32_dispatch (i32.div_u
     (i32.sub (local.get $thunk) (global.get $thunk_guest_base)) (i32.const 8)))
   (i32.load (global.get $reg_base)))`;
(async()=>{
 let memory,bridge,encoder=null,manager=null,render=null,producer=null;
 const gdiSurfaces=[];
 const queued=process.argv.includes('--worker');
 const h=await bootRenderHarness({fonts:'none',width:4,height:4,extraWat,
  extraHostOverrides:{gpu_gl_call(op,at,bytes){
   if(op===Stream.WAT_STREAM_FLUSH_OPCODE){
     if(!render)return bridge.replay(Stream.memoryBatch(memory,at,bytes));
     const reply=render.execute({memoryOffset:at,bytes,owner:0,windows:Object.values(renderer.windows),surfaces:gdiSurfaces,softwareFront:e.gl_sw_front()});
     producer.configure(reply.producerConfig);return reply.value;
   }
   // No queued software executor: real synchronous WAT raster path.
   if(op>=0x20000&&op<=0x20006)return encoder ? encoder.call(op,at,bytes) : 0;
   throw Error('unexpected host opcode '+op);
  }}});
 memory=h.memory;const e=h.exports,dv=new DataView(memory.buffer),wa=p=>e.guest_to_wasm(p)>>>0;
 e.init_thread(1,0x400000,0,0,0,0,0);e.heap_init(0x800000);
 const renderer={windows:{42:{hwnd:42,w:4,h:4,clientRect:{w:4,h:4}}},repaint(){}};
 bridge=new OpenGLHostBridge({backend:'software',getMemory:()=>memory.buffer,exports:e,renderer,
   getGdiSurface:id=>{const s=gdiSurfaces.find(s=>s.id===id);return s?{surface:s}:null;}});
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

 const output=e.guest_alloc(128)>>>0,outWa=wa(output),observations=[];
 assert(resolve('glLogicOp'),'stored-width logic operations are available after full native/WebGL acceptance');
 for(const bpp of [16,32])for(const topDown of [false,true]){
  const width=3,height=2,stride=bpp===16?8:12;
  const bmi=e.guest_alloc(40)>>>0,bitsOut=e.guest_alloc(4)>>>0;
  new Uint8Array(memory.buffer,wa(bmi),40).fill(0);
  for(const [at,value]of[[0,40],[4,width],[8,topDown?-height:height]])e.guest_write32(bmi+at,value);
  e.guest_write16(bmi+12,1);e.guest_write16(bmi+14,bpp);
  const bitmap=e.test_call_CreateDIBSection(0,bmi,0,bitsOut,0,0)>>>0;assert(bitmap);
  const bits=wa(e.guest_read32(bitsOut)),dc=e.test_call_CreateCompatibleDC(0)>>>0;assert(dc);
  e.test_call_SelectObject(dc,bitmap);
  gdiSurfaces.push({id:bitmap,width,height,pixels:new Uint8ClampedArray(width*height*4)});
  const context=call('wglCreateContext',[dc]);assert(context);assert.strictEqual(call('wglMakeCurrent',[dc,context]),1);
  call('glViewport',[0,0,width,height]);call('glDisable',[0xbd0]);
  call('glDrawBuffer',[0x404]);call('glReadBuffer',[0x404]);
  const storage=new Uint8Array(memory.buffer,bits,stride*height),words=bpp===16?[0xa8c7,0xa8c7,0xa8c7]:[0x3c283848,0x3c283848,0x3c283848];
  function reset(){storage.fill(0x6d);for(let y=0;y<height;y++)for(let x=0;x<width;x++)dv[bpp===16?'setUint16':'setUint32'](bits+y*stride+x*bpp/8,words[x],true);}
  reset();const before=Uint8Array.from(storage);
  const query=p=>{call('glGetIntegerv',[p,output]);return dv.getInt32(outWa,true);};
  assert.deepStrictEqual([query(0xd52),query(0xd53),query(0xd54),query(0xd55)],bpp===16?[5,5,5,0]:[8,8,8,8]);
  const pixel=()=>{call('glReadPixels',[0,0,1,1,0x1908,0x1401,output]);return Array.from(new Uint8Array(memory.buffer,outWa,4));};
  assert.deepStrictEqual(pixel(),bpp===16?[82,49,58,255]:[40,56,72,60],'literal native read');
  call('glFlush');assert.deepStrictEqual(Uint8Array.from(storage),before,'read-only flush');
  function point(mask){call('glColorMask',mask);call('glColor4f',[0,f(1),0,0]);call('glBegin',[0]);call('glVertex3f',[f(-2/3),f(-.5),0]);call('glEnd');call('glFinish');if(encoder)encoder.fence();}
  point([0,0,0,0]);assert.deepStrictEqual(Uint8Array.from(storage),before,'zero-mask native store');
  point([1,1,1,0]);
  function oneChangedPixel(literal) {
    let changes=0;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
      const actual=dv[bpp===16?'getUint16':'getUint32'](bits+y*stride+x*bpp/8,true);
      if(actual===literal)changes++;else assert.strictEqual(actual,words[x],'untouched literal word');
    }
    assert.strictEqual(changes,1,'one covered point pixel has literal masked result');
    for(let y=0;y<height;y++)for(let i=width*bpp/8;i<stride;i++)assert.strictEqual(storage[y*stride+i],0x6d,'native row padding');
  }
  oneChangedPixel(bpp===16?0x83e0:0x3c00ff00);
  if(bpp===32){reset();point([0,0,0,1]);oneChangedPixel(0x00283848);}
  assert.strictEqual(call('glGetError'),0);observations.push({bpp,topDown,alphaBits:query(0xd55),passed:true});
  call('wglMakeCurrent',[0,0]);call('wglDeleteContext',[context]);
 }
 if(encoder){const stats=encoder.snapshot();assert(stats.glQueued>0);assert.strictEqual(stats.fallbacks,0);console.log('ACTUAL_QUEUED_ZERO_FALLBACK',JSON.stringify(stats));}
 console.log('PASS native bitmap literal import/store/publication queries and masks',JSON.stringify({queued,observations}));
 }finally{if(encoder)encoder.stop();if(manager)await manager.stop();if(render)render.destroy();}
})().catch(e=>{console.error(e);process.exitCode=1;});
