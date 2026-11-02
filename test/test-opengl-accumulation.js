'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),req=p=>require(path.join(root,p));
const {bootRenderHarness}=req('test/render-helper');
const {OpenGLHostBridge,CALL_INDEX}=req('lib/gl-compat');
const Stream=req('lib/gl-command-stream');
const table=req('src/api_table.json');
const extraWat=`
 (func (export "probe_depth") (result i32) (load.field DxObject misc1 (global.get $gl_sw_zbuf)))
 (func (export "probe_stencil") (result i32) (global.get $gl_stencil_pixels))
 (func (export "probe_delete_drawable") (param $key i32) (call $gl_sw_delete_drawable (local.get $key)))
 (func (export "probe_pfd") (param $p i32) (param $n i32) (drop (call $gdi_pixel_format_write (local.get $p) (local.get $n))))
 (func (export "probe_accum") (result i32) (global.get $gl_accum_pixels))
 (func (export "probe_accum_format") (param $fmt i32) (call $dx_surf_fmt_set (global.get $gl_sw_rt) (local.get $fmt)))
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
 const gdiSurfaces=[];
 const queued=process.argv.includes('--worker');
 const mutation=process.env.GL_ACCUM_MUTATION, internal=process.env.GL_ACCUM_INTERNAL, baseline=process.env.GL_ACCUM_BASELINE;
 let prebuiltModule=null;
 if(mutation||internal||baseline){
  let changed=!mutation;
  const bytes=req('test/compile-src').compileSrcWasm((file,source)=>{
   if(file==='13-exports.wat')return source+(baseline?extraWat.replace('(global.get $gl_accum_pixels)','(i32.const 0)'):extraWat);
   if(baseline){const p=path.join(root,'scratch/runs/20261102-mdk2-accum-implementation-remote/baseline/src',file);return fs.existsSync(p)?fs.readFileSync(p,'utf8'):source;}
   if(internal&&file==='09b2-dispatch-table.generated.wat'){
    for(const [name,result] of [['wgl_api_available',1],['gl_dynamic_api_unsupported',0]]){
     const from='(func $'+name+' (param $id i32) (result i32)';assert(source.includes(from));
     source=source.replace(from,from+'\n (if (i32.or (i32.eq (local.get $id) (i32.const 4209)) (i32.eq (local.get $id) (i32.const 4214))) (then (return (i32.const '+result+'))))');
    }
    return source;
   }
   if(file!=='09a8g-gl-raster.wat'||!mutation)return source;
   const at=source.indexOf('(func $gl_accum_sw ');assert(at>=0);const prefix=source.slice(0,at);let body=source.slice(at);
   const rules={unsigned:['(f32.store (local.get $p) (f32.demote_f64 (local.get $value)))','(f32.store (local.get $p) (f32.demote_f64 (f64.max (f64.const 0) (local.get $value))))'],
    source:['(call $gl_sw_read_surface)','(global.get $gl_sw_rt)'],
    noop:['(call $d3dim_worker_fence)','(return (i32.const 1)) (call $d3dim_worker_fence)']};
   assert(rules[mutation],'known mutation');const [from,to]=rules[mutation];assert(body.includes(from),'mutation anchor');changed=true;return prefix+body.replace(from,to);
  });
  assert(changed);prebuiltModule=new WebAssembly.Module(bytes);
 }
 const h=await bootRenderHarness({fonts:'none',width:4,height:4,...(prebuiltModule?{prebuiltModule}:{extraWat}),
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
 const observations=[];
 function expect(label,actual,expected){assert.deepStrictEqual(actual,expected,label);
  observations.push({label,actual,expected});}

 const dc=e.probe_dc(42)>>>0, context=call('wglCreateContext',[dc]);assert(context);
 assert.strictEqual(call('wglMakeCurrent',[dc,context]),1);
 call('glViewport',[0,0,4,4]);
 const output=e.guest_alloc(256)>>>0,outWa=wa(output);
 const clear=(mode,rgba)=>{call('glDrawBuffer',[mode]);call('glClearColor',rgba.map(f));call('glClear',[0x4000]);};
 const accum=(op,value)=>call('glAccum',[op,f(value)]);
 const read=(mode,x=0,y=0)=>{call('glReadBuffer',[mode]);new Uint8Array(memory.buffer,outWa,256).fill(0xcc);
   call('glReadPixels',[x,y,1,1,0x1908,0x1401,output]);assert.strictEqual(call('glGetError'),0);
   assert(new Uint8Array(memory.buffer,outWa+4,252).every(x=>x===0xcc));return Array.from(new Uint8Array(memory.buffer,outWa,4));};
 const signed=(x=0,y=0)=>Array.from(new Float32Array(memory.buffer,e.probe_accum()+((3-y)*4+x)*16,4));
 const q=(pname,float=false,n=1)=>{new Uint8Array(memory.buffer,outWa,256).fill(0xcc);
   call(float?'glGetFloatv':'glGetIntegerv',[pname,output]);
   assert(new Uint8Array(memory.buffer,outWa+n*4,256-n*4).every(x=>x===0xcc));
   return Array.from({length:n},(_,i)=>float?dv.getFloat32(outWa+i*4,true):dv.getInt32(outWa+i*4,true));};
 // Independent exact arithmetic oracle: dyadic rationals, no implementation helper.
 clear(0x404,[1,0,0,1]);clear(0x405,[0,0,1,1]);call('glReadBuffer',[0x405]);call('glColorMask',[0,0,0,0]);call('glDrawBuffer',[0]);accum(0x101,.5);
 call('glReadBuffer',[0x404]);accum(0x100,.25);accum(0x103,-.5);accum(0x104,.25);
 expect('signed extended storage, independent exact oracle',signed(),[.125,.25,0,-.125]);
 call('glColorMask',[1,1,1,1]);call('glDrawBuffer',[0x405]);accum(0x102,2);
 expect('RETURN exact oracle',read(0x405),[64,128,0,0]);expect('source retained',read(0x404),[255,0,0,255]);
 for(let p=0xd58;p<=0xd5b;p++){assert.deepStrictEqual(q(p),[32]);assert.deepStrictEqual(q(p,true),[32]);}
 call('glClearAccum',[-2,.5,2,-.25].map(f));assert.deepStrictEqual(q(0xb80,true,4),[-1,.5,1,-.25]);
 assert.deepStrictEqual(q(0xb80,false,4),[-2147483648,1073741823,2147483647,-536870912]);
 call('glPushAttrib',[0x200]);call('glClearAccum',[.25,-.5,.125,-1].map(f));
 call('glPushAttrib',[0x4000]);call('glClearAccum',[.5,0,0,0].map(f));call('glPopAttrib');
 assert.deepStrictEqual(q(0xb80,true,4),[.5,0,0,0],'color group does not restore accumulation clear');call('glPopAttrib');
 assert.deepStrictEqual(q(0xb80,true,4),[-1,.5,1,-.25]);
 call('glColorMask',[0,0,0,0]);call('glDrawBuffer',[0]);call('glClear',[0x200]);assert.deepStrictEqual(signed(),[-1,.5,1,-.25]);
 call('glClear',[0x201]);assert.strictEqual(call('glGetError'),0x501);assert.deepStrictEqual(signed(),[-1,.5,1,-.25],'invalid clear is atomic');
 call('glColorMask',[1,1,1,1]);call('glDrawBuffer',[0x405]);accum(0x102,1);assert.deepStrictEqual(read(0x405),[0,128,255,0]);
 // Distinct destinations, every write mask, scissor and NONE/BOTH.
 call('glClearAccum',[.25,.5,.75,1].map(f));call('glClear',[0x200]);
 for(const mode of [0,0x404,0x405,0x408])for(let mask=0;mask<16;mask++){
   call('glColorMask',[1,1,1,1]);clear(0x404,[1,0,0,1]);clear(0x405,[0,0,1,1]);
   call('glDrawBuffer',[mode]);call('glColorMask',[0,1,2,3].map(i=>!!(mask&(1<<i))));
   call('glScissor',[1,1,1,1]);call('glEnable',[0xc11]);accum(0x102,1);call('glDisable',[0xc11]);
   for(const selected of [0x404,0x405]){
     const base=selected===0x404?[255,0,0,255]:[0,0,255,255];
     const wanted=base.map((v,c)=>(mode===selected||mode===0x408)&&(mask&(1<<c))?[64,128,191,255][c]:v);
     expect('selected/scissored RETURN mode='+mode+' mask='+mask+' buffer='+selected,read(selected,1,1),wanted);
     expect('scissor neighbor mode='+mode+' mask='+mask+' buffer='+selected,read(selected,0,1),base);
   }
 }
 call('glColorMask',[1,1,1,1]);call('glDrawBuffer',[0x405]);
 // Every operation, including clear, intersects the physical scissor rectangle.
 for(const [operation,scale,inside] of [[0x101,.5,[.5,0,0,.5]],[0x100,.5,[.75,.5,.75,1.5]],
   [0x103,-1,[-.25,-.5,-.75,-1]],[0x104,-.5,[-.25,0,.25,.5]],[-1,0,[-.5,.25,-.25,1]]]){
  call('glClearAccum',[.25,.5,.75,1].map(f));call('glClear',[0x200]);clear(0x404,[1,0,0,1]);call('glReadBuffer',[0x404]);
  call('glScissor',[1,1,1,1]);call('glEnable',[0xc11]);
  if(operation===-1){call('glClearAccum',[-.5,.25,-.25,1].map(f));call('glClear',[0x200]);}else accum(operation,scale);
  call('glDisable',[0xc11]);assert.deepStrictEqual(signed(1,1),inside);assert.deepStrictEqual(signed(0,1),[.25,.5,.75,1]);
 }
 // Pixel packing is guest readback state and must not enter LOAD.
 for(const [p,v] of [[0xd05,8],[0xd02,7],[0xd03,2],[0xd04,1]])call('glPixelStorei',[p,v]);
 clear(0x404,[0,0,1,1]);call('glReadBuffer',[0x404]);accum(0x101,.5);assert.deepStrictEqual(signed(),[0,0,.5,.5]);
 for(const [p,v] of [[0xd05,4],[0xd02,0],[0xd03,0],[0xd04,0]])call('glPixelStorei',[p,v]);
 // Actual 16-bit fields normalize at their own widths, including missing alpha.
 const rt=e.gl_sw_entry(),pitch=dv.getUint16(rt+18,true),pixels=dv.getUint32(rt+20,true);
 for(const [fmt,raw,wanted] of [[1,0x0821,[1/31,1/63,1/31,1]],[2,0x8421,[1/31,1/31,1/31,1]],
   [3,0x8421,[1/31,1/31,1/31,1]],[4,0x1234,[2/15,3/15,4/15,1/15]]]){
  dv.setUint16(rt+16,16,true);e.probe_accum_format(fmt);
  for(let y=0;y<4;y++)for(let x=0;x<4;x++)dv.setUint16(pixels+y*pitch+x*2,raw,true);
  call('glReadBuffer',[0x405]);accum(0x101,1);assert.deepStrictEqual(signed(),wanted.map(Math.fround),'actual component widths fmt='+fmt);
  call('glColorMask',[1,1,1,1]);call('glDrawBuffer',[0x405]);accum(0x102,1);assert.strictEqual(dv.getUint16(pixels+3*pitch,true),raw,'format roundtrip');
 }
 dv.setUint16(rt+16,32,true);e.probe_accum_format(5);
 call('glClearAccum',[.25,.5,.75,1].map(f));call('glClear',[0x200]);
 // RETURN bypasses fragment tests and blend; unrelated attachments survive.
 call('glClearDepth',[0,0x3fd00000]);call('glClearStencil',[37]);call('glClear',[0x500]);
 const depth=Buffer.from(new Uint8Array(memory.buffer,e.probe_depth(),32));
 const stencil=Buffer.from(new Uint8Array(memory.buffer,e.probe_stencil(),16));
 for(const cap of [0xbc0,0xb71,0xb90,0xbe2])call('glEnable',[cap]);
 call('glAlphaFunc',[0x200,f(1)]);call('glDepthFunc',[0x200]);call('glStencilFunc',[0x200,0,255]);call('glBlendFunc',[0,0]);
 accum(0x102,1);assert.deepStrictEqual(read(0x405),[64,128,191,255]);
 assert.deepStrictEqual(Buffer.from(new Uint8Array(memory.buffer,e.probe_depth(),32)),depth);
 assert.deepStrictEqual(Buffer.from(new Uint8Array(memory.buffer,e.probe_stencil(),16)),stencil);
 for(const cap of [0xbc0,0xb71,0xb90,0xbe2])call('glDisable',[cap]);
 // Compile snapshots scalars, evaluates source at replay, and defers execution errors.
 call('glClearAccum',[0,0,0,0]);call('glClear',[0x200]);
 call('glNewList',[91,0x1300]);accum(0x101,.5);accum(0x104,-.25);call('glEndList');assert.deepStrictEqual(signed(),[0,0,0,0]);
 clear(0x404,[0,1,0,1]);call('glReadBuffer',[0x404]);call('glCallList',[91]);assert.deepStrictEqual(signed(),[-.25,.25,-.25,.25]);
 call('glNewList',[92,0x1300]);accum(0xdead,1);assert.strictEqual(call('glGetError'),0);call('glEndList');call('glCallList',[92]);assert.strictEqual(call('glGetError'),0x500);
 call('glBegin',[0]);accum(0x104,1);call('glClearAccum',[1,1,1,1].map(f));call('glEnd');assert.strictEqual(call('glGetError'),0x502);
 assert.deepStrictEqual(q(0xb80,true,4),[0,0,0,0],'Begin rejects clear state mutation');
 call('glNewList',[93,0x1301]);accum(0x104,.125);call('glEndList');assert.deepStrictEqual(signed(),[-.125,.375,-.125,.375]);call('glCallList',[93]);assert.deepStrictEqual(signed(),[0,.5,0,.5]);
 // Lists preserve the caller's Begin and capture clear scalars independently.
 const savedSigned=signed();call('glBegin',[0]);call('glCallList',[93]);call('glEnd');
 assert.strictEqual(call('glGetError'),0x502);assert.deepStrictEqual(signed(),savedSigned);
 const savedClear=q(0xb80,true,4);call('glNewList',[94,0x1300]);call('glClearAccum',[-.25,.75,.5,-1].map(f));
 assert.deepStrictEqual(q(0xb80,true,4),savedClear,'query immediate during COMPILE');call('glEndList');
 call('glCallList',[94]);assert.deepStrictEqual(q(0xb80,true,4),[-.25,.75,.5,-1]);
 // Drawable/context ownership and clear state.
 renderer.windows[123]={hwnd:123,w:4,h:4,clientRect:{w:4,h:4}};const secondDc=e.probe_dc(123)>>>0;
 assert.strictEqual(call('wglMakeCurrent',[secondDc,context]),1);call('glClearAccum',[.5,0,0,-.5].map(f));call('glClear',[0x200]);const otherPointer=e.probe_accum();
 assert.strictEqual(call('wglMakeCurrent',[dc,context]),1);assert.deepStrictEqual(signed(),[0,.5,0,.5]);const firstPointer=e.probe_accum();
 const secondContext=call('wglCreateContext',[dc]);assert.strictEqual(call('wglMakeCurrent',[dc,secondContext]),1);
 assert.deepStrictEqual(signed(),[0,.5,0,.5]);assert.deepStrictEqual(q(0xb80,true,4),[0,0,0,0]);call('glClearAccum',[-.5,.25,0,1].map(f));
 assert.strictEqual(call('wglMakeCurrent',[dc,context]),1);assert.deepStrictEqual(q(0xb80,true,4),[.5,0,0,-.5]);call('wglDeleteContext',[secondContext]);assert.strictEqual(e.probe_accum(),firstPointer);
 assert.strictEqual(call('wglMakeCurrent',[secondDc,context]),1);assert.strictEqual(e.probe_accum(),otherPointer);assert.deepStrictEqual(signed(),[.5,0,0,-.5]);
 renderer.windows[123].clientRect={w:2,h:3};renderer.windows[123].w=2;renderer.windows[123].h=3;
 call('glClear',[0x200]);assert.deepStrictEqual(Array.from(new Float32Array(memory.buffer,e.probe_accum(),4)),[.5,0,0,-.5]);
 assert.strictEqual(call('wglMakeCurrent',[dc,context]),1);assert.deepStrictEqual(signed(),[0,.5,0,.5]);
 // Queued geometry is an actual producer/worker operation before LOAD.
 clear(0x405,[0,0,0,0]);call('glColor4f',[f(1),f(0),f(0),f(1)]);call('glBegin',[0]);call('glVertex3f',[f(-.875),f(-.75),f(0)]);call('glEnd');
 call('glReadBuffer',[0x405]);accum(0x101,.5);assert.deepStrictEqual(signed(),[.5,0,0,.5],'LOAD fences prior actual geometry');
 accum(0x103,-1);accum(0x104,.75);accum(0x102,1);assert.deepStrictEqual(read(0x405),[64,191,191,64]);
 if(queued){encoder.fence();assert(encoder.snapshot().glQueued>0,'actual renderer queue used');}
 // Actual Win32 destruction and client resize retire only that attachment.
 const win=call('CreateWindowExA',[0,str('STATIC'),str('Signed accumulation'),0,0,0,4,4,0,0,0,0]);assert(win);
 renderer.windows[win]=h.renderer.windows[win]||{hwnd:win,w:4,h:4,clientRect:{w:4,h:4}};
 const winDc=e.probe_dc(win)>>>0,beforeCount=e.probe_drawables();assert.strictEqual(call('wglMakeCurrent',[winDc,context]),1);
 call('glClearAccum',[.125,.25,-.5,1].map(f));call('glClear',[0x200]);assert.strictEqual(e.probe_drawables(),beforeCount+1);
 assert.strictEqual(call('SetWindowPos',[win,0,0,0,2,3,0x14]),1);call('glClear',[0x200]);
 assert.strictEqual(dv.getUint16(e.gl_sw_entry()+12,true),2);assert.strictEqual(dv.getUint16(e.gl_sw_entry()+14,true),3);
 assert.deepStrictEqual(Array.from(new Float32Array(memory.buffer,e.probe_accum(),4)),[.125,.25,-.5,1]);
 assert.strictEqual(call('wglMakeCurrent',[dc,context]),1);assert.strictEqual(call('DestroyWindow',[win]),1);
 assert.strictEqual(e.probe_drawables(),beforeCount);assert.deepStrictEqual(signed(),[.25,.75,.75,.25]);
 // A bitmap drawable borrows canonical DIB bytes, with GL's bottom origin.
 const bmi=e.guest_alloc(40)>>>0,bitsOut=e.guest_alloc(4)>>>0;
 new Uint8Array(memory.buffer,wa(bmi),40).fill(0);
 for(const [offset,value] of [[0,40],[4,4],[8,-4]])e.guest_write32(bmi+offset,value);
 e.guest_write16(bmi+12,1);e.guest_write16(bmi+14,32);
 const bitmap=e.test_call_CreateDIBSection(0,bmi,0,bitsOut,0,0)>>>0;assert(bitmap);
 const bitmapBits=wa(e.guest_read32(bitsOut)),bitmapDc=e.test_call_CreateCompatibleDC(0)>>>0;assert(bitmapDc);
 const previousBitmap=e.test_call_SelectObject(bitmapDc,bitmap)>>>0;
 for(let i=0;i<16;i++)dv.setUint32(bitmapBits+i*4,0xff0000ff,true);
 gdiSurfaces.push({id:bitmap,width:4,height:4,pixels:new Uint8ClampedArray(64)});
 const bitmapContext=call('wglCreateContext',[bitmapDc]);assert(bitmapContext);
 assert.strictEqual(call('wglMakeCurrent',[bitmapDc,bitmapContext]),1);
 call('glReadBuffer',[0x404]);call('glDrawBuffer',[0]);accum(0x101,.5);accum(0x103,-1);accum(0x104,.75);
 assert.deepStrictEqual(signed(),[.75,.75,.25,.25]);
 call('glColorMask',[1,0,1,0]);call('glDrawBuffer',[0x404]);call('glScissor',[1,1,1,1]);call('glEnable',[0xc11]);accum(0x102,1);call('glDisable',[0xc11]);
 expect('bitmap RETURN',read(0x404,1,1),[191,0,64,255]);expect('bitmap neighbor',read(0x404,0,1),[0,0,255,255]);
 assert.strictEqual(dv.getUint32(bitmapBits+(2*4+1)*4,true),0xffbf0040,'RETURN writes canonical DIB pixels');
 assert.strictEqual(call('wglMakeCurrent',[dc,context]),1);call('wglDeleteContext',[bitmapContext]);
 e.test_call_SelectObject(bitmapDc,previousBitmap);const bitmapNodeCount=e.probe_drawables();
 assert.strictEqual(e.test_call_DeleteObject(bitmap),1);assert.strictEqual(e.probe_drawables(),bitmapNodeCount-1,'DIB deletion retires signed attachment');
 assert.deepStrictEqual(signed(),[.25,.75,.75,.25],'DIB deletion preserves window attachment');
 // Prefix PFD writes report truthful component storage without overruns.
 for(let n=0;n<=44;n++){
  new Uint8Array(memory.buffer,outWa,256).fill(0xcc);e.probe_pfd(outWa,n);
  const bytes=new Uint8Array(memory.buffer,outWa,256);assert(bytes.slice(Math.min(n,40)).every(x=>x===0xcc));
  for(let i=18;i<23&&i<n;i++)assert.strictEqual(bytes[i],i===18?128:32);
 }
 e.probe_delete_drawable(123);assert.strictEqual(call('wglMakeCurrent',[secondDc,context]),1);
 accum(0x104,.125);assert.deepStrictEqual(Array.from(new Float32Array(memory.buffer,e.probe_accum(),4)),[.125,.125,.125,.125],'deleted drawable gets fresh attachment');
 e.gl_sw_reset();assert.strictEqual(e.probe_accum(),0);assert.strictEqual(e.probe_drawables(),0);
 assert.strictEqual(call('glGetError'),0);call('wglDeleteContext',[context]);
 if(process.env.GL_ACCUM_EVIDENCE)fs.writeFileSync(process.env.GL_ACCUM_EVIDENCE,JSON.stringify({passed:true,route:queued?'queued':'direct',observations},null,2));
 console.log('PASS resolved signed accumulation exact oracle, masks/selectors/scissor, clear/queries/attributes, lists/errors/lifecycle and '+(queued?'queued':'direct')+' software');
 }finally{if(encoder)encoder.stop();if(manager)await manager.stop();if(render)render.destroy();}
})().catch(e=>{console.error(e);process.exitCode=1;});
