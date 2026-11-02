'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const root=process.env.WINE_ROOT||'/home/user/wine-assembly',req=p=>require(path.join(root,p));
const {bootRenderHarness}=req('test/render-helper');
const {OpenGLHostBridge,CALL_INDEX:GL}=req('lib/gl-compat');
const Stream=req('lib/gl-command-stream');
const table=req('src/api_table.json');
const extraWat=`
 (func (export "probe_mode") (result i32) (global.get $gl_immediate_mode))
 (func (export "probe_count") (result i32) (global.get $gl_immediate_floats))
 (func (export "probe_vertices") (result i32) (global.get $gl_immediate_wa))
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
 (func (export "probe_sparse_page") (param $p i32) (result i32)
   (call $virtual_map_commit (local.get $p) (i32.const 4096)))
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
let prebuiltModule;
if(process.env.GL_RASTER_OLD||process.env.GL_RASTER_MUTATION){
 const old=process.env.GL_RASTER_OLD,mutation=process.env.GL_RASTER_MUTATION?JSON.parse(fs.readFileSync(process.env.GL_RASTER_MUTATION,'utf8')):null;
 let applied=false;
 const bytes=req('test/compile-src').compileSrcWasm((file,source)=>{
  if(old&&fs.existsSync(path.join(old,file)))source=fs.readFileSync(path.join(old,file),'utf8');
  if(mutation&&file===mutation.file){assert.strictEqual(source.split(mutation.from).length-1,1,'unique semantic mutation');source=source.replace(mutation.from,mutation.to);applied=true;}
  return file==='13-exports.wat'?source+extraWat:source;
 });
 assert(!mutation||applied,'semantic mutation applied');prebuiltModule=new WebAssembly.Module(bytes);
 console.log(JSON.stringify({compiled:true,control:mutation?.name||'saved-old-source'}));
}
// Resolve and execute the real stdcall ABI, including output byte canaries.
(async()=>{
 let memory,bridge,encoder=null,manager=null,render=null,producer=null;
 const queued=process.argv.includes('--worker');
 const h=await bootRenderHarness({...(prebuiltModule ? {prebuiltModule} : {extraWat}),fonts:'none',width:8,height:8,
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
 const renderer={windows:{42:{hwnd:42,w:8,h:8,clientRect:{w:8,h:8}}},repaint(){}};
 bridge=new OpenGLHostBridge({backend:'software',getMemory:()=>memory.buffer,exports:e,renderer});
 try {
 if(queued){
   const {Manager}=req('lib/render-worker'),{Encoder}=req('lib/d3d-command-stream');
   const {Worker}=require('worker_threads');
   producer=new (req('lib/gl-software-producer').Producer)(()=>e);
   const consumer=new WebAssembly.Instance(h.module,{host:h.host});
   consumer.exports.d3dim_worker_init(e.get_image_base()>>>0);
   assert.strictEqual(consumer.exports.gl_sw_front(),0,'consumer has independent mutable globals');
   const moduleGL=req('lib/gl-compat'),BaseBridge=moduleGL.OpenGLHostBridge;
   moduleGL.OpenGLHostBridge=class extends BaseBridge {constructor(options){super(options);bridge=this;}};
   try {render=req('lib/gl-render-worker').create({instance:consumer,memory,backend:'software',sendFrame(){}});}
   finally {moduleGL.OpenGLHostBridge=BaseBridge;}
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
   let value;try{value=e.probe_invoke(p)>>>0;}catch(error){console.error("resolved call failed",name,args);throw error;}
   assert.strictEqual(dv.getUint32(regs+16,true),stack+4*(args.length+1),'stdcall '+name);
   for(let i=1;i<8;i++)if(i!==4)assert.strictEqual(dv.getUint32(regs+i*4,true),0x55660000+i,'register '+name);
   assert.deepStrictEqual(Buffer.from(new Uint8Array(memory.buffer,stackWa,256)),before,'stack '+name);
   return value;
 }
 const f=x=>{dv.setFloat32(stackWa+252,x,true);return dv.getUint32(stackWa+252,true);};
 const dc=e.probe_dc(42)>>>0,context=call('wglCreateContext',[dc]);assert(context);
 assert.strictEqual(call('wglMakeCurrent',[dc,context]),1);

 // Real resolved guest calls, literal independent pixel expectations.
 const names=['glDrawPixels','glCopyPixels','glPixelZoom','glPixelStoref'];
 for(const name of names){assert(resolve(name),'static '+name);if(!process.env.GL_RASTER_OLD)assert(call('wglGetProcAddress',[str(name)]),'dynamic '+name);}
 const input=e.guest_alloc(1024)>>>0,output=e.guest_alloc(1024)>>>0;
 const RGBA=0x1908,U8=0x1401;
 let checks=0;const observations=[];
 const literal=(label,got,want)=>{assert.deepStrictEqual(got,want,label);checks++;observations.push({label,got});};
 const error=(want,label)=>literal(label,call('glGetError'),want);
 const put=values=>new Uint8Array(memory.buffer,wa(input),values.length).set(values);
 function read(x,y,w,h){call('glReadPixels',[x,y,w,h,RGBA,U8,output]);return Array.from(new Uint8Array(memory.buffer,wa(output),w*h*4));}
 function clear(){call('glDisable',[0xc11]);call('glDisable',[0xb71]);call('glDisable',[0xbc0]);call('glDisable',[0xbe2]);call('glDisable',[0xb90]);call('glColorMask',[1,1,1,1]);call('glClearColor',[f(0),f(0),f(0),f(1)]);call('glClear',[0x4500]);}
 const red=[255,0,0,255],green=[0,255,0,255],blue=[0,0,255,255],white=[255,255,255,255],black=[0,0,0,255];
 call('glViewport',[0,0,8,8]);call('glPixelStorei',[0xcf5,1]);call('glPixelStorei',[0xd05,1]);
 clear();put([...red,...green,...blue,...white]);call('glRasterPos2f',[f(-.5),f(-.5)]);call('glDrawPixels',[2,2,RGBA,U8,input]);
 literal('asymmetric lower-left image',read(2,2,2,2),[...red,...green,...blue,...white]);error(0,'draw clean');
 clear();call('glPixelZoom',[f(2),f(2)]);call('glDrawPixels',[2,2,RGBA,U8,input]);
 literal('positive zoom literal',read(2,2,4,4),[...red,...red,...green,...green,...red,...red,...green,...green,...blue,...blue,...white,...white,...blue,...blue,...white,...white]);
 clear();call('glPixelZoom',[f(-1),f(-1)]);call('glDrawPixels',[2,2,RGBA,U8,input]);
 literal('negative zoom literal',read(0,0,2,2),[...white,...blue,...green,...red]);
 clear();call('glPixelZoom',[f(0),f(1)]);call('glDrawPixels',[2,2,RGBA,U8,input]);literal('zero zoom draws nothing',read(2,2,2,2),[...black,...black,...black,...black]);
 call('glPixelZoom',[f(1),f(1)]);call('glRasterPos2f',[f(2),f(2)]);call('glDrawPixels',[2,2,RGBA,U8,input]);literal('invalid raster position draws nothing',read(2,2,2,2),[...black,...black,...black,...black]);
 call('glRasterPos2f',[f(-.5),f(-.5)]);
 // Copy source is snapshotted before any overlapping destination writes.
 clear();put([...red,...green,...blue,...white]);call('glDrawPixels',[4,1,RGBA,U8,input]);call('glRasterPos2f',[f(-.25),f(-.5)]);call('glCopyPixels',[2,2,3,1,0x1800]);
 literal('horizontal overlapping copy',read(2,2,4,1),[...red,...red,...green,...blue]);error(0,'copy clean');
 // Rejected calls precede guest pointer access; baseline framebuffer retained.
 const before=read(2,2,4,1);
 for(const args of [[-1,1,RGBA,U8,0xffffffff],[1,-1,RGBA,U8,0xffffffff]]){call('glDrawPixels',args);error(0x501,'negative dimension before input');literal('rejected draw atomic',read(2,2,4,1),before);}
 call('glDrawPixels',[1,1,RGBA,0x1a00,0xffffffff]);error(0x500,'bitmap only index');
 for(const name of names){call('glBegin',[0]);call(name,name==='glDrawPixels'?[1,1,RGBA,U8,0xffffffff]:name==='glCopyPixels'?[0,0,1,1,0x1800]:name==='glPixelZoom'?[f(2),f(2)]:[0xcf5,f(8)]);call('glEnd');error(0x502,'Begin End '+name);}
 // PixelStoref boolean conversion must happen before integer rounding.
 call('glPixelStoref',[0xcf0,f(.125)]);call('glGetIntegerv',[0xcf0,output]);literal('float boolean nonzero',dv.getInt32(wa(output),true),1);
 call('glPixelStoref',[0xcf0,f(0)]);call('glPixelStoref',[0xcf5,f(3.75)]);call('glGetIntegerv',[0xcf5,output]);literal('float nearest alignment',dv.getInt32(wa(output),true),4);
 call('glPixelStoref',[0xcf5,f(3)]);error(0x501,'invalid rounded alignment');call('glGetIntegerv',[0xcf5,output]);literal('invalid store atomic',dv.getInt32(wa(output),true),4);
 call('glPixelStoref',[0xcf5,f(1)]);
 // Compile captures client values, execution consumes current zoom/raster state.
 put(red);call('glNewList',[991,0x1300]);call('glDrawPixels',[1,1,RGBA,U8,input]);call('glEndList');put(green);
 // Reuse freed temporary allocations; an illegally borrowed capture must fail.
 for(let i=0;i<32;i++){const p=e.guest_alloc(64)>>>0;new Uint8Array(memory.buffer,wa(p),64).fill(0);}
 clear();call('glRasterPos2f',[f(-.5),f(-.5)]);call('glPixelZoom',[f(2),f(1)]);call('glCallList',[991]);literal('list owns pixels uses execution zoom',read(2,2,2,1),[...red,...red]);
// Independent depth, stencil, conversion and context oracles.
// Each oracle is a literal color image, avoiding comparison to another raster API.
clear();call('glPixelZoom',[f(1),f(1)]);call('glRasterPos2f',[f(-.5),f(-.5)]);
// Stencil bypasses alpha/depth/stencil fragment tests but honors scissor/mask.
call('glStencilMask',[255]);call('glClearStencil',[0xa0]);call('glClear',[0x400]);
call('glStencilMask',[15]);call('glEnable',[0xbc0]);call('glAlphaFunc',[0x200,f(1)]);
call('glEnable',[0xb71]);call('glDepthFunc',[0x200]);call('glEnable',[0xb90]);call('glStencilFunc',[0x200,0,255]);
put([0x15,0x26]);call('glDrawPixels',[2,1,0x1901,U8,input]);
call('glDisable',[0xbc0]);call('glDisable',[0xb71]);call('glStencilMask',[255]);call('glStencilOp',[0x1e00,0x1e00,0x1e00]);
call('glStencilFunc',[0x202,0xa5,255]);put([...white,...white]);call('glDrawPixels',[2,1,RGBA,U8,input]);
literal('stencil mask with fragment-test bypass',read(2,2,2,1),[...white,...black]);
// Fractional stencil indices take the integer part, while index-to-color uses nearest.
call('glDisable',[0xb90]);call('glClearStencil',[0]);call('glClear',[0x400]);
dv.setFloat32(wa(input),1.75,true);call('glDrawPixels',[1,1,0x1901,0x1406,input]);
call('glEnable',[0xb90]);call('glStencilFunc',[0x202,1,255]);put(red);call('glDrawPixels',[1,1,RGBA,U8,input]);
literal('stencil fractional integer part',read(2,2,1,1),red);
// Draw depth uses raster color and the image's depth, independent of raster Z.
clear();call('glColor4f',[f(1),f(0),f(0),f(1)]);call('glRasterPos3f',[f(-.5),f(-.5),f(.8)]);
call('glEnable',[0xb71]);call('glDepthMask',[1]);call('glDepthFunc',[0x207]);
dv.setFloat32(wa(input),.25,true);dv.setFloat32(wa(input)+4,.75,true);
call('glDrawPixels',[2,1,0x1902,0x1406,input]);
call('glColor4f',[f(0),f(1),f(0),f(1)]);call('glRasterPos3f',[f(-.5),f(-.5),f(0)]);
call('glDepthFunc',[0x201]);put([...green,...green]);call('glDrawPixels',[2,1,RGBA,U8,input]);
literal('depth source and raster color',read(2,2,2,1),[...red,...green]);
// Depth transfer clamps after scale/bias; depth testing remains active.
clear();call('glColor4f',[f(1),f(0),f(0),f(1)]);call('glRasterPos2f',[f(-.5),f(-.5)]);
call('glEnable',[0xb71]);call('glDepthFunc',[0x207]);
call('glPixelTransferf',[0xd1e,f(2)]);call('glPixelTransferf',[0xd1f,f(-.5)]);
dv.setFloat32(wa(input),.25,true);dv.setFloat32(wa(input)+4,.75,true);call('glDrawPixels',[2,1,0x1902,0x1406,input]);
call('glPixelTransferf',[0xd1e,f(1)]);call('glPixelTransferf',[0xd1f,f(0)]);
call('glRasterPos3f',[f(-.5),f(-.5),f(0)]);call('glDepthFunc',[0x201]);put([...green,...green]);call('glDrawPixels',[2,1,RGBA,U8,input]);
literal('depth scale bias clamp',read(2,2,2,1),[...red,...green]);
// Copy depth snapshot must survive overlapping destinations.
clear();call('glEnable',[0xb71]);call('glDepthFunc',[0x207]);call('glRasterPos2f',[f(-.5),f(-.5)]);call('glColorMask',[0,0,0,0]);
for(const [i,v] of [.25,.75,.25,.75].entries())dv.setFloat32(wa(input)+4*i,v,true);
call('glDrawPixels',[4,1,0x1902,0x1406,input]);call('glRasterPos2f',[f(-.25),f(-.5)]);call('glCopyPixels',[2,2,3,1,0x1801]);
call('glColorMask',[1,1,1,1]);call('glDepthFunc',[0x201]);call('glRasterPos3f',[f(-.5),f(-.5),f(0)]);put([...white,...white,...white,...white]);call('glDrawPixels',[4,1,RGBA,U8,input]);
literal('overlap depth snapshot',read(2,2,4,1),[...black,...black,...white,...black]);
// Pixel-store conversion with padded rows and skips, literal RGB source values.
clear();call('glRasterPos2f',[f(-.5),f(-.5)]);call('glPixelStoref',[0xcf5,f(4)]);
call('glPixelStoref',[0xcf2,f(3)]);call('glPixelStoref',[0xcf3,f(1)]);call('glPixelStoref',[0xcf4,f(1)]);
new Uint8Array(memory.buffer,wa(input),64).fill(0xee);
new Uint8Array(memory.buffer,wa(input)+15,6).set([255,0,0,0,255,0]);
new Uint8Array(memory.buffer,wa(input)+27,6).set([0,0,255,255,255,255]);
call('glDrawPixels',[2,2,0x1907,U8,input]);literal('padded skipped RGB rows',read(2,2,2,2),[...red,...green,...blue,...white]);
for(const pname of [0xcf2,0xcf3,0xcf4])call('glPixelStorei',[pname,0]);call('glPixelStorei',[0xcf5,1]);
// Attribute restoration is per context; zoom is pixel-mode state.
call('glPixelZoom',[f(-2),f(.5)]);call('glPushAttrib',[0x20]);call('glPixelZoom',[f(3),f(4)]);call('glPopAttrib');
for(const [pname,want] of [[0xd16,-2],[0xd17,.5]]){call('glGetFloatv',[pname,output]);literal('pixel-mode zoom restore '+pname,dv.getFloat32(wa(output),true),want);}
const context2=call('wglCreateContext',[dc]);assert(context2);call('wglMakeCurrent',[dc,context2]);
for(const pname of [0xd16,0xd17]){call('glGetFloatv',[pname,output]);literal('new context unit zoom '+pname,dv.getFloat32(wa(output),true),1);}
call('wglMakeCurrent',[dc,context]);call('wglDeleteContext',[context2]);
call('glPixelZoom',[f(1),f(1)]);call('glColor4f',[f(1),f(1),f(1),f(1)]);

// Scalar formats and types, including byte swapping and bitmap bit order.
clear();call('glRasterPos2f',[f(-.5),f(-.5)]);
for(const [format,values,want] of [[0x1903,[255],red],[0x1904,[255],green],[0x1905,[255],blue],[0x1906,[128],[0,0,0,128]],[0x1909,[128],[128,128,128,255]],[0x190a,[128,64],[128,128,128,64]],[0x80e0,[255,0,0],blue],[0x80e1,[255,0,0,64],[0,0,255,64]]]){
 put(values);call('glDrawPixels',[1,1,format,U8,input]);literal('component format '+format,read(2,2,1,1),want);
}
for(const [type,bytes,setter,max] of [[0x1400,1,'setInt8',127],[0x1402,2,'setInt16',32767],[0x1403,2,'setUint16',65535],[0x1404,4,'setInt32',2147483647],[0x1405,4,'setUint32',4294967295],[0x1406,4,'setFloat32',1]]){
 for(let i=0;i<4;i++)dv[setter](wa(input)+i*bytes,i===0||i===3?max:(type===0x1400?-128:type===0x1402?-32768:type===0x1404?-2147483648:0),true);
 call('glDrawPixels',[1,1,RGBA,type,input]);literal('scalar conversion '+type,read(2,2,1,1),red);
}
put([128,0,0,0,0,0,255,255]);call('glPixelStoref',[0xcf0,f(.25)]);call('glDrawPixels',[1,1,RGBA,0x1403,input]);literal('swapped ushort source',read(2,2,1,1),[128,0,0,255]);call('glPixelStorei',[0xcf0,0]);
for(const [type,bytes,setter,min,max] of [[0x1400,1,'setInt8',-128,127],[0x1401,1,'setUint8',0,255],[0x1402,2,'setInt16',-32768,32767],[0x1403,2,'setUint16',0,65535],[0x1404,4,'setInt32',-2147483648,2147483647],[0x1405,4,'setUint32',0,4294967295],[0x1406,4,'setFloat32',0,1]]){
 clear();call('glRasterPos2f',[f(-.5),f(-.5)]);call('glEnable',[0xb71]);call('glDepthFunc',[0x207]);call('glColorMask',[0,0,0,0]);dv[setter](wa(input),min,true);dv[setter](wa(input)+bytes,max,true);call('glDrawPixels',[2,1,0x1902,type,input]);call('glColorMask',[1,1,1,1]);call('glDepthFunc',[0x201]);put([...white,...white]);call('glDrawPixels',[2,1,RGBA,U8,input]);literal('depth scalar conversion '+type,read(2,2,2,1),[...black,...white]);
 clear();call('glStencilMask',[255]);call('glClearStencil',[0]);call('glClear',[0x400]);dv[setter](wa(input),17,true);dv[setter](wa(input)+bytes,34,true);call('glDrawPixels',[2,1,0x1901,type,input]);call('glEnable',[0xb90]);call('glStencilFunc',[0x202,17,255]);put([...white,...white]);call('glDrawPixels',[2,1,RGBA,U8,input]);literal('stencil scalar indices '+type,read(2,2,2,1),[...white,...black]);
}
clear();call('glClearStencil',[0]);call('glClear',[0x400]);put([0x40]);call('glDrawPixels',[2,1,0x1901,0x1a00,input]);call('glEnable',[0xb90]);call('glStencilFunc',[0x202,1,255]);put([...white,...white]);call('glDrawPixels',[2,1,RGBA,U8,input]);literal('bitmap stencil indices',read(2,2,2,1),[...black,...white]);clear();
// Component maps apply after scale/bias, and at display-list execution time.
for(let i=0;i<2;i++)dv.setFloat32(wa(input)+4*i,i,true);for(const map of [0xc76,0xc77,0xc78,0xc79])call('glPixelMapfv',[map,2,input]);
call('glPixelTransferf',[0xd10,f(1)]);call('glPixelTransferf',[0xd14,f(2)]);call('glPixelTransferf',[0xd15,f(-.5)]);
put([200,0,0,255]);call('glDrawPixels',[1,1,RGBA,U8,input]);call('glPixelTransferf',[0xd14,f(1)]);call('glPixelTransferf',[0xd15,f(0)]);call('glPixelTransferf',[0xd10,f(0)]);literal('scale bias then component map',read(2,2,1,1),red);
// Index input is supported in an RGBA context; no color-index framebuffer claim.
for(const [map,values] of [[0xc72,[0,1]],[0xc73,[1,0]],[0xc74,[0,0]],[0xc75,[1,1]]]){values.forEach((v,i)=>dv.setFloat32(wa(input)+4*i,v,true));call('glPixelMapfv',[map,2,input]);}
put([0,1]);call('glDrawPixels',[2,1,0x1900,U8,input]);literal('index to RGBA maps',read(2,2,2,1),[...green,...red]);
put([0x40]);call('glDrawPixels',[2,1,0x1900,0x1a00,input]);literal('MSB bitmap indices',read(2,2,2,1),[...green,...red]);
call('glPixelStoref',[0xcf1,f(.125)]);put([2]);call('glDrawPixels',[2,1,0x1900,0x1a00,input]);literal('LSB bitmap indices',read(2,2,2,1),[...green,...red]);call('glPixelStorei',[0xcf1,0]);
// Stencil map and overlapping copy use a complete source snapshot.
clear();call('glClearStencil',[0]);call('glClear',[0x400]);
[3,7].forEach((v,i)=>dv.setUint32(wa(input)+4*i,v,true));call('glPixelMapuiv',[0xc71,2,input]);call('glPixelTransferi',[0xd11,1]);
put([0,1,0,1]);call('glDrawPixels',[4,1,0x1901,U8,input]);call('glPixelTransferi',[0xd11,0]);
call('glRasterPos2f',[f(-.25),f(-.5)]);call('glCopyPixels',[2,2,3,1,0x1802]);call('glRasterPos2f',[f(-.5),f(-.5)]);
call('glEnable',[0xb90]);call('glStencilFunc',[0x202,7,255]);put([...white,...white,...white,...white]);call('glDrawPixels',[4,1,RGBA,U8,input]);literal('stencil map and overlap snapshot',read(2,2,4,1),[...black,...black,...white,...black]);
// Clipping uses the drawable, independent of viewport after raster capture.
clear();call('glRasterPos2f',[f(-.5),f(-.5)]);call('glViewport',[0,0,1,1]);put([...red,...green,...blue,...white]);call('glDrawPixels',[2,2,RGBA,U8,input]);literal('no viewport clipping',read(2,2,2,2),[...red,...green,...blue,...white]);call('glViewport',[0,0,8,8]);
clear();call('glEnable',[0xc11]);call('glScissor',[3,2,1,1]);put([...red,...green]);call('glDrawPixels',[2,1,RGBA,U8,input]);literal('scissor ownership',read(2,2,2,1),[...black,...green]);
clear();call('glEnable',[0xbc0]);call('glAlphaFunc',[0x204,f(.5)]);put([255,0,0,64,0,255,0,255]);call('glDrawPixels',[2,1,RGBA,U8,input]);literal('alpha fragment test',read(2,2,2,1),[...black,...green]);
clear();call('glEnable',[0xbe2]);call('glBlendFunc',[0x302,0x303]);put([255,0,0,128]);call('glDrawPixels',[1,1,RGBA,U8,input]);literal('blend fragment operation',read(2,2,1,1),[128,0,0,191]);
clear();call('glClearColor',[f(0),f(1),f(0),f(64/255)]);call('glClear',[0x4000]);call('glEnable',[0xbe2]);call('glBlendFunc',[0x304,0]);put([255,0,0,128]);call('glDrawPixels',[1,1,RGBA,U8,input]);literal('destination alpha blend factor',read(2,2,1,1),[64,0,0,32]);
clear();call('glClearColor',[f(0),f(1),f(0),f(64/255)]);call('glClear',[0x4000]);call('glEnable',[0xbe2]);call('glBlendFunc',[0x308,1]);put([255,0,0,128]);call('glDrawPixels',[1,1,RGBA,U8,input]);literal('source alpha saturate RGBA factors',read(2,2,1,1),[128,255,0,192]);
// Floating source remains unclamped until scale/bias is applied.
clear();call('glPixelTransferf',[0xd14,f(.5)]);call('glPixelTransferf',[0xd15,f(-.5)]);
[1.5,0,0,1].forEach((v,i)=>dv.setFloat32(wa(input)+4*i,v,true));call('glDrawPixels',[1,1,RGBA,0x1406,input]);call('glPixelTransferf',[0xd14,f(1)]);call('glPixelTransferf',[0xd15,f(0)]);literal('floating transfer before clamp',read(2,2,1,1),[64,0,0,255]);
// A captured raster position can paint outside its old viewport, with fractional zoom.
clear();call('glRasterPos2f',[f(-.5),f(-.5)]);call('glPixelZoom',[f(1.5),f(1)]);put([...red,...green]);call('glDrawPixels',[2,1,RGBA,U8,input]);literal('fractional zoom half-open centers',read(2,2,3,1),[...red,...green,...green]);call('glPixelZoom',[f(1),f(1)]);
clear();call('glPixelZoom',[f(-1.5),f(1)]);put([...red,...green]);call('glDrawPixels',[2,1,RGBA,U8,input]);literal('negative zoom boundary centers',read(0,2,2,1),[...red,...red]);call('glPixelZoom',[f(1),f(1)]);
// Zoom is a list command; rejected calls inside compilation never enter it.
call('glNewList',[993,0x1300]);call('glPixelZoom',[f(-1),f(2)]);call('glDrawPixels',[-1,1,RGBA,U8,0xffffffff]);call('glEndList');error(0x501,'compile rejects malformed draw');
call('glGetFloatv',[0xd16,output]);literal('compile zoom deferred',dv.getFloat32(wa(output),true),1);call('glCallList',[993]);call('glGetFloatv',[0xd16,output]);literal('zoom list execution',dv.getFloat32(wa(output),true),-1);call('glDeleteLists',[993,1]);call('glPixelZoom',[f(1),f(1)]);
// Transfer is captured as commands/state, never baked into owned image data.
clear();call('glRasterPos2f',[f(-.5),f(-.5)]);put([64,0,0,255]);call('glNewList',[994,0x1300]);call('glDrawPixels',[1,1,RGBA,U8,input]);call('glEndList');
call('glPixelTransferf',[0xd14,f(4)]);call('glCallList',[994]);call('glPixelTransferf',[0xd14,f(1)]);literal('list transfer at execution',read(2,2,1,1),red);call('glDeleteLists',[994,1]);
clear();put([64,0,0,255]);call('glDrawPixels',[1,1,RGBA,U8,input]);call('glRasterPos2f',[f(-.25),f(-.5)]);call('glPixelTransferf',[0xd14,f(2)]);call('glCopyPixels',[2,2,1,1,0x1800]);call('glPixelTransferf',[0xd14,f(1)]);literal('copy color transfer exactly once',read(3,2,1,1),[128,0,0,255]);
// Texture and fog use the captured raster attributes for each pixel fragment.
clear();call('glBindTexture',[0xde1,777]);put([255,255,0,255]);call('glTexImage2D',[0xde1,0,RGBA,1,1,0,RGBA,U8,input]);call('glTexParameteri',[0xde1,0x2801,0x2600]);call('glTexParameteri',[0xde1,0x2800,0x2600]);call('glTexEnvi',[0x2300,0x2200,0x1e01]);
call('glTexCoord2f',[f(.5),f(.5)]);call('glRasterPos2f',[f(-.5),f(-.5)]);call('glEnable',[0xde1]);put(white);call('glDrawPixels',[1,1,RGBA,U8,input]);literal('raster texcoord texture operation',read(2,2,1,1),[255,255,0,255]);call('glDisable',[0xde1]);call('glBindTexture',[0xde1,0]);dv.setUint32(wa(input),777,true);call('glDeleteTextures',[1,input]);
clear();call('glFogi',[0xb65,0x2601]);call('glFogf',[0xb63,f(0)]);call('glFogf',[0xb64,f(1)]);[0,0,1,0].forEach((v,i)=>dv.setFloat32(wa(input)+4*i,v,true));call('glFogfv',[0xb66,input]);call('glEnable',[0xb60]);call('glRasterPos3f',[f(0),f(0),f(.5)]);put(red);call('glDrawPixels',[1,1,RGBA,U8,input]);literal('raster distance fog operation',read(4,4,1,1),[127,0,127,255]);call('glDisable',[0xb60]);
clear();call('glRasterPos2f',[f(-.5),f(-.5)]);
// Front/back read selection is independent of destination selection.
clear();call('glDrawBuffer',[0x404]);put(red);call('glDrawPixels',[1,1,RGBA,U8,input]);call('glReadBuffer',[0x404]);call('glDrawBuffer',[0x405]);call('glRasterPos2f',[f(-.25),f(-.5)]);call('glCopyPixels',[2,2,1,1,0x1800]);call('glReadBuffer',[0x405]);literal('front read back draw',read(3,2,1,1),red);
call('glReadBuffer',[0x404]);literal('copy preserves source front',read(2,2,1,1),red);call('glDrawBuffer',[0x405]);call('glReadBuffer',[0x405]);
// Sparse client input crosses genuinely nonaffine guest pages.
clear();call('glRasterPos2f',[f(-.5),f(-.5)]);const sparse=0x6e200000;assert(e.probe_sparse_page(sparse));assert(e.probe_sparse_page(sparse+4096));
[...red,...green].forEach((v,i)=>dv.setUint8(wa(sparse+4093+i),v));call('glDrawPixels',[2,1,RGBA,U8,sparse+4093]);literal('sparse client image',read(2,2,2,1),[...red,...green]);
const hole=0x6e210000;assert(e.probe_sparse_page(hole));const kept=read(2,2,2,1);assert.throws(()=>call('glDrawPixels',[2,1,RGBA,U8,hole+4093]),WebAssembly.RuntimeError);literal('late unreadable client span atomicity',read(2,2,2,1),kept);
// PixelStoref is immediate during list compilation. Copy reads on execution.
call('glNewList',[992,0x1300]);call('glPixelStoref',[0xcf5,f(8)]);call('glCopyPixels',[2,2,1,1,0x1800]);call('glEndList');call('glGetIntegerv',[0xcf5,output]);literal('storef immediate during list compile',dv.getInt32(wa(output),true),8);call('glPixelStorei',[0xcf5,1]);
put(blue);call('glDrawPixels',[1,1,RGBA,U8,input]);call('glRasterPos2f',[f(-.25),f(-.5)]);call('glCallList',[992]);literal('copy list reads at execution',read(3,2,1,1),blue);call('glGetIntegerv',[0xcf5,output]);literal('storef excluded from replay',dv.getInt32(wa(output),true),1);call('glDeleteLists',[992,1]);
clear();call('glRasterPos2f',[f(-.5),f(-.5)]);error(0,'extended oracles clean');

 call('glDeleteLists',[991,1]);call('glFinish');error(0,'fixture finish');
 call('wglMakeCurrent',[0,0]);call('wglDeleteContext',[context]);
 console.log(JSON.stringify({passed:true,queued,checks}));
 if(process.env.GL_RASTER_EVIDENCE)fs.writeFileSync(process.env.GL_RASTER_EVIDENCE,JSON.stringify({passed:true,queued,checks,observations},null,2));
 } finally {if(encoder)encoder.stop();if(manager)await manager.stop();if(render)render.destroy();}
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
