'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),req=p=>require(path.join(root,p));
const {bootRenderHarness}=req('test/render-helper');
const {OpenGLHostBridge,CALL_INDEX:GL}=req('lib/gl-compat');
const Stream=req('lib/gl-command-stream');
const table=req('src/api_table.json');
const extraWat=`
 (func (export "probe_texture") (result i32) (i32.load offset=760 (call $gl_list_context)))
 (func (export "probe_context") (result i32) (call $gl_list_context))
 (func (export "probe_block") (result i32) (call $gl_mtx_block))
 (func (export "probe_list_commands") (result i32)
   (local $p i32) (local $n i32)
   (local.set $p (i32.load offset=16 (call $gl_list_context)))
   (block $done (loop $walk (br_if $done (i32.eqz (local.get $p)))
     (local.set $n (i32.add (local.get $n) (i32.const 1)))
     (local.set $p (i32.load (local.get $p))) (br $walk))) (local.get $n))
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
 const queued=process.argv.includes('--worker'),mutation=process.env.GL_TEXTURE_COPY_MUTATION,baseline=process.env.GL_TEXTURE_COPY_BASELINE;
 let prebuiltModule;
 if(mutation||baseline){let changed=false;
  const bytes=req('test/compile-src').compileSrcWasm((file,source)=>{
   if(file==='13-exports.wat')return source+extraWat;
   if(baseline&&fs.existsSync(path.join(baseline,file))){changed=true;return fs.readFileSync(path.join(baseline,file),'utf8');}
   if(baseline)return source;
   const edits={
    source:['09a8b-handlers-opengl.wat','gl_texture_copy_execute','(local.set $x (i32.load','(local.set $x (i32.add (i32.const 1) (i32.load'],
    current:['09a8b-handlers-opengl.wat','gl_texture_get_image','(local.set $component (i32.const 0))','(local.set $pixel (i32.const 0))\n        (local.set $component (i32.const 0))'],
    destination:['09a8b-handlers-opengl.wat','gl_2d_store','(local.set $x (i32.add (i32.load offset=12 (local.get $s)) (local.get $border)))','(local.set $x (i32.const 0))'],
    transfer:['09a8b-handlers-opengl.wat','gl_transfer_channel','(local.set $p (call $gl_transfer_state))','(return (local.get $value))\n    (local.set $p (call $gl_transfer_state))'],
    pack:['09a8b-handlers-opengl.wat','gl_texture_get_image','(i32.load offset=16 (local.get $pack))','(i32.const 0)'],
    list:['09a8ca-gl-lists.wat','gl_list_intercept','(local.get $length))\n          (i32.store','(i32.const 0))\n          (i32.store'],
    readbuffer:['09a8b-handlers-opengl.wat','gl_texture_read_framebuffer','(local.set $lease (call $gl_sw_read_surface))','(drop (call $gl_sw_read_surface))\n    (local.set $lease (i32.or (global.get $gl_sw_rt) (select (i32.const 0x40000000) (i32.const 0) (global.get $gl_sw_flip_y))))'],
    snapshot:['09a8g-gl-raster.wat','gl_sw_worker_try','(global.get $gl_2d_draw_slots) (i32.const 720))','(global.get $gl_2d_draw_slots) (i32.const 0))'],
   };
   assert(edits[mutation],'known semantic mutation');const [target,fn,from,to]=edits[mutation];if(file!==target)return source;
   const a=Math.max(source.indexOf('(func $'+fn+' '),source.indexOf('(func $'+fn+'\n')),end=source.indexOf('\n  (func ',a+8),b=end<0?source.length:end;
   assert(a>=0,'mutation function');let body=source.slice(a,b);assert(body.includes(from),'mutation anchor '+mutation);
   if(mutation==='source')body=body.replace('(local.get $x) (local.get $y) (local.get $w) (local.get $h) (i32.add (local.get $g)', '(i32.const 0) (local.get $y) (local.get $w) (local.get $h) (i32.add (local.get $g)');
   else body=body.replace(from,to);
   assert(body!==source.slice(a,b),'mutation applied');changed=true;return source.slice(0,a)+body+source.slice(b);
  });assert(changed,'source control applied');prebuiltModule=new WebAssembly.Module(bytes);
  console.error('SOURCE_CONTROL_COMPILED',mutation||'old-source');
 }
 const h=await bootRenderHarness({...(prebuiltModule?{prebuiltModule}:{extraWat}),fonts:'none',width:8,height:8,
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
   let value;try{value=e.probe_invoke(p)>>>0;}catch(error){console.error("resolved call failed",name,args);throw error;}
   assert.strictEqual(dv.getUint32(regs+16,true),stack+4*(args.length+1),'stdcall '+name);
   for(let i=1;i<8;i++)if(i!==4)assert.strictEqual(dv.getUint32(regs+i*4,true),0x55660000+i,'register '+name);
   assert.deepStrictEqual(Buffer.from(new Uint8Array(memory.buffer,stackWa,256)),before,'stack '+name);
   return value;
 }
 const f=x=>{dv.setFloat32(stackWa+252,x,true);return dv.getUint32(stackWa+252,true);};



 let checks=0;const observations=[];
 const dc=e.probe_dc(42)>>>0,context=call('wglCreateContext',[dc]);assert(context);
 assert.strictEqual(call('wglMakeCurrent',[dc,context]),1);
 const names=['glCopyTexImage1D','glCopyTexImage2D','glCopyTexSubImage1D','glCopyTexSubImage2D','glGetTexImage','glPixelTransferf','glPixelTransferi'];
 for(const name of names){assert(call('wglGetProcAddress',[str(name)]),'dynamic texture '+name);assert(resolve(name),'system texture '+name);checks++;}
// Full-source dynamically resolved guest stdcall texture fixture.
const T1=0xde0,T2=0xde1,RGBA=0x1908,U8=0x1401;
const input=e.guest_alloc(512)>>>0,output=e.guest_alloc(4096)>>>0;
const write=(p,a)=>{for(let i=0;i<a.length;i++)dv.setUint8(wa(p+i),a[i]);};
const read=(p,n)=>Array.from({length:n},(_,i)=>dv.getUint8(wa(p+i)));
const literal=(label,actual,want)=>{assert.deepStrictEqual(actual,want,label);observations.push({label,actual,expected:want});checks++;};
const error=(want,label)=>literal(label,call('glGetError'),want);
function get(target,level,want,label,format=RGBA,type=U8){
 write(output,Array(4096).fill(0xa7));call('glGetTexImage',[target,level,format,type,output+8]);
 error(0,label+' error');literal(label,read(output+8,want.length),want);
 literal(label+' prefix',read(output,8),Array(8).fill(0xa7));
 literal(label+' suffix',read(output+8+want.length,8),Array(8).fill(0xa7));
}
const source=[10,20,30,40, 50,60,70,80, 90,100,110,120, 130,140,150,160,
 170,180,190,200, 210,220,230,240, 250,15,25,35, 45,55,65,75];
call('glPixelStorei',[0xcf5,1]);call('glPixelStorei',[0xd05,1]);
call('glBindTexture',[T2,71]);write(input,source);
call('glTexImage2D',[T2,0,RGBA,4,2,0,RGBA,U8,input]);get(T2,0,source,'current uploaded2D');
write(input,[1,2,3,4,5,6,7,8]);
call('glTexSubImage2D',[T2,0,1,1,2,1,RGBA,U8,input]);
get(T2,0,[10,20,30,40,50,60,70,80,90,100,110,120,130,140,150,160,
 170,180,190,200,1,2,3,4,5,6,7,8,45,55,65,75],'actual subimage');
write(input,[11,22,33,44,55,66,77,88]);
call('glTexImage2D',[T2,2,RGBA,2,1,0,RGBA,U8,input]);
get(T2,2,[11,22,33,44,55,66,77,88],'independent level2');
call('glBindTexture',[T1,72]);write(input,[12,23,34,45,56,67,78,89]);
call('glTexImage1D',[T1,1,RGBA,2,0,RGBA,U8,input]);
get(T1,1,[12,23,34,45,56,67,78,89],'current uploaded1D');
// Unsigned-byte 2D uploads canonicalize as RGBA8: BGR/BGRA swizzle, RGB
// alpha fill and unpack row length/skips/alignment must match the float path.
call('glBindTexture',[T2,73]);write(input,[1,2,3,4,5,6,7,8]);
call('glTexImage2D',[T2,0,RGBA,2,1,0,0x80e1,U8,input]);
get(T2,0,[3,2,1,4,7,6,5,8],'BGRA unsigned-byte upload');
write(input,[9,10,11,12]);
call('glTexSubImage2D',[T2,0,1,0,1,1,0x80e1,U8,input]);
get(T2,0,[3,2,1,4,11,10,9,12],'BGRA unsigned-byte subimage');
write(input,[1,2,3,4,5,6]);
call('glTexImage2D',[T2,0,RGBA,2,1,0,0x80e0,U8,input]);
get(T2,0,[3,2,1,255,6,5,4,255],'BGR unsigned-byte upload');
write(input,Array.from({length:48},(_,i)=>i));
call('glPixelStorei',[0xcf5,4]);call('glPixelStorei',[0xcf2,4]);
call('glPixelStorei',[0xcf3,1]);call('glPixelStorei',[0xcf4,1]);
// Row pitch ceil(4*3/4)*4 = 12, first texel at 1*12 + 1*3 = 15.
call('glTexImage2D',[T2,0,RGBA,2,2,0,0x1907,U8,input]);
call('glPixelStorei',[0xcf2,0]);call('glPixelStorei',[0xcf3,0]);call('glPixelStorei',[0xcf4,0]);call('glPixelStorei',[0xcf5,1]);
get(T2,0,[15,16,17,255,18,19,20,255,27,28,29,255,30,31,32,255],'RGB unsigned-byte unpack row length/skips/alignment');
// GL1.1 table6.1: unlike sampler expansion, G/B of L/LA/I are zero.
for(const [internal,data,want] of [
 [0x1909,[64,23,34,128],[64,0,0,255]],
 [0x190a,[65,23,34,129],[65,0,0,129]],
 [0x1906,[66,23,34,130],[0,0,0,130]],
 [0x8049,[67,23,34,131],[67,0,0,255]],
 [0x1907,[68,23,34,132],[68,23,34,255]],
]){write(input,data);call('glTexImage1D',[T1,0,internal,1,0,RGBA,U8,input]);get(T1,0,want,'table6.1 '+internal);}
function tile(x,y,w,h,color){call('glScissor',[x,y,w,h]);call('glClearColor',color.map(v=>f(v/255)));call('glClear',[0x4000]);}
call('glEnable',[0xc11]);call('glDrawBuffer',[0x405]);
tile(0,0,8,8,[0,0,0,255]);
tile(1,2,1,1,[255,0,0,255]);tile(2,2,1,1,[0,255,0,255]);
tile(1,3,1,1,[0,0,255,255]);tile(2,3,1,1,[255,255,0,255]);
call('glDrawBuffer',[0x404]);tile(1,2,2,2,[255,0,255,255]);call('glDisable',[0xc11]);
call('glReadBuffer',[0x405]);call('glBindTexture',[T2,73]);
call('glCopyTexImage2D',[T2,0,RGBA,1,2,2,2,0]);
get(T2,0,[255,0,0,255,0,255,0,255,0,0,255,255,255,255,0,255],'back nonuniform copy');
call('glReadBuffer',[0x404]);call('glCopyTexSubImage2D',[T2,0,1,0,1,2,1,2]);
get(T2,0,[255,0,0,255,255,0,255,255,0,0,255,255,255,0,255,255],'selected front subcopy with offsets');
call('glReadBuffer',[0x405]);call('glBindTexture',[T1,74]);
call('glCopyTexImage1D',[T1,0,RGBA,1,3,2,0]);
get(T1,0,[0,0,255,255,255,255,0,255],'1D copies one selected row');
call('glCopyTexSubImage1D',[T1,0,1,1,2,1]);
get(T1,0,[0,0,255,255,255,0,0,255],'1D subcopy source and destination offsets');
// Get is immediate in COMPILE; framebuffer copy is deferred until CallList.
call('glNewList',[501,0x1300]);call('glCopyTexImage1D',[T1,1,RGBA,1,2,2,0]);
get(T1,0,[0,0,255,255,255,0,0,255],'immediate get in list');call('glEndList');
call('glEnable',[0xc11]);call('glDrawBuffer',[0x405]);tile(1,2,2,1,[0,255,255,255]);call('glDisable',[0xc11]);
call('glCallList',[501]);get(T1,1,[0,255,255,255,0,255,255,255],'copy reads at execution');
// No output changes for errors; bad enums must win over invalid output memory.
for(const [args,want] of [[[0x8063,0,RGBA,U8,0],0x500],[[T1,12,RGBA,U8,0],0x501],
 [[T1,0,0x1902,U8,0],0x500],[[T1,0,RGBA,0x1a00,0],0x500]]){
 call('glGetTexImage',args);error(want,'invalid get');
}
call('glBegin',[0]);call('glGetTexImage',[T1,0,RGBA,U8,0]);call('glEnd');error(0x502,'get BeginEnd');
call('glNewList',[506,0x1300]);call('glBegin',[0]);call('glGetTexImage',[T1,0,RGBA,U8,0xffffffff]);error(0x502,'get compiling BeginEnd');call('glEnd');call('glEndList');call('glDeleteLists',[506,1]);

// Literal pack layout includes untouched prefix, row padding and row skips.
call('glBindTexture',[T2,75]);write(input,[255,0,128,255,0,255,64,128,32,16,8,4,1,2,3,4]);
call('glTexImage2D',[T2,0,RGBA,2,2,0,RGBA,U8,input]);
call('glPixelStorei',[0xd05,8]);call('glPixelStorei',[0xd02,3]);
call('glPixelStorei',[0xd03,1]);call('glPixelStorei',[0xd04,1]);
write(output,Array(128).fill(0xa7));call('glGetTexImage',[T2,0,0x1907,U8,output]);
literal('pack skip first row',read(output,19),Array(19).fill(0xa7));
literal('pack RGB row0',read(output+19,6),[255,0,128,0,255,64]);
literal('pack padding',read(output+25,10),Array(10).fill(0xa7));
literal('pack RGB row1',read(output+35,6),[32,16,8,1,2,3]);
literal('pack exact end',read(output+41,8),Array(8).fill(0xa7));
for(const [key,value] of [[0xd05,1],[0xd02,0],[0xd03,0],[0xd04,0]])call('glPixelStorei',[key,value]);
write(input,[0,255,128,255]);call('glBindTexture',[T1,76]);call('glTexImage1D',[T1,0,RGBA,1,0,RGBA,U8,input]);
get(T1,0,[0,0,255,255,128,128,255,255],'unsigned short exact',RGBA,0x1403);
call('glPixelStorei',[0xd00,1]);
get(T1,0,[0,0,255,255,128,128,255,255],'short swap per component',RGBA,0x1403);
write(input,[1,2,3,4]);call('glTexImage1D',[T1,0,RGBA,1,0,RGBA,U8,input]);
get(T1,0,[1,1,2,2,3,3,4,4],'short swap repeated bytes',RGBA,0x1403);
get(T1,0,[0,128,1,0,1,129,2,2],'signed short swap distinguishes byte order',RGBA,0x1402);
// Uint32 channels have four exact repeated bytes for an8-bit stored channel.
get(T1,0,[1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4],'uint32 exact width',RGBA,0x1405);
call('glPixelStorei',[0xd00,0]);write(input,[0,255,0,255]);
call('glTexImage1D',[T1,0,RGBA,1,0,RGBA,U8,input]);
get(T1,0,[0,127,0,127],'signed byte normalized',RGBA,0x1400);
get(T1,0,[0,0,0,0,0,0,128,63,0,0,0,0,0,0,128,63],'float exact',RGBA,0x1406);
// GL_CLIENT_PIXEL_STORE_BIT owns pack state; server pixel attributes do not.
call('glPixelStorei',[0xd04,1]);call('glPushClientAttrib',[1]);call('glPixelStorei',[0xd04,2]);call('glPopClientAttrib');
write(output,Array(24).fill(0xa7));call('glGetTexImage',[T1,0,RGBA,U8,output]);
literal('client pop restores actual pack offset',read(output,12),[167,167,167,167,0,255,0,255,167,167,167,167]);
call('glPushAttrib',[0x20]);call('glPixelStorei',[0xd04,2]);call('glPopAttrib');
write(output,Array(24).fill(0xa7));call('glGetTexImage',[T1,0,RGBA,U8,output]);
literal('server pop leaves actual pack offset',read(output,16),[167,167,167,167,167,167,167,167,0,255,0,255,167,167,167,167]);call('glPixelStorei',[0xd04,0]);
// Supplied1D end borders survive full reads and negative subregion addressing.
write(input,[1,2,3,4,10,20,30,40,50,60,70,80,5,6,7,8]);
call('glTexImage1D',[T1,0,RGBA,4,1,RGBA,U8,input]);
get(T1,0,[1,2,3,4,10,20,30,40,50,60,70,80,5,6,7,8],'border included');
call('glReadBuffer',[0x404]);call('glCopyTexSubImage1D',[T1,0,-1,1,2,1]);
get(T1,0,[255,0,255,255,10,20,30,40,50,60,70,80,5,6,7,8],'negative offset modifies border');
// Exact atomic error behavior: unchanged texture data and dimensions.
for(const [api,args,code] of [
 ['glCopyTexImage1D',[T2,0,RGBA,1,2,2,0],0x500],
 ['glCopyTexImage2D',[T1,0,RGBA,1,2,2,2,0],0x500],
 ['glCopyTexImage1D',[T1,-1,RGBA,1,2,2,0],0x501],
 ['glCopyTexImage1D',[T1,12,RGBA,1,2,2,0],0x501],
 ['glCopyTexImage1D',[T1,0,4,1,2,2,0],0x500],
 ['glCopyTexImage1D',[T1,0,RGBA,1,2,3,0],0x501],
 ['glCopyTexImage1D',[T1,0,RGBA,1,2,2,2],0x501],
 ['glCopyTexSubImage1D',[T1,0,-2,1,2,1],0x501],
 ['glCopyTexSubImage1D',[T1,0,2,1,2,2],0x501],
 ['glCopyTexSubImage1D',[T1,0,0,1,2,-1],0x501],
]){call(api,args);error(code,api+' invalid '+args);get(T1,0,[255,0,255,255,10,20,30,40,50,60,70,80,5,6,7,8],'atomic rejected '+api);}
// Undefined source regions: call is legal; intentionally no pixel oracle.
call('glCopyTexImage1D',[T1,2,RGBA,-1,-1,2,0]);error(0,'undefined framebuffer region is not GL error');

// Transfer setters are real guest exports, including list and attribute state.
const tf=(name,value)=>call('glPixelTransferf',[name,f(value)]);
const ti=(name,value)=>call('glPixelTransferi',[name,value]);
const queryTransfer=(name,want)=>{write(output,Array(24).fill(0xa7));call('glGetFloatv',[name,output+8]);literal('transfer query '+name,dv.getFloat32(wa(output+8),true),want);literal('transfer scalar width',read(output+12,8),Array(8).fill(0xa7));};
for(const [name,value] of [[0xd10,0],[0xd11,0],[0xd12,0],[0xd13,0],
 [0xd14,1],[0xd15,0],[0xd18,1],[0xd19,0],[0xd1a,1],[0xd1b,0],[0xd1c,1],[0xd1d,0],[0xd1e,1],[0xd1f,0]])queryTransfer(name,value);
// Integer pname state must preserve its actual32-bit value, not round throughf32.
ti(0xd13,16777217);call('glGetIntegerv',[0xd13,output]);literal('integer transfer precision',dv.getInt32(wa(output),true),16777217);ti(0xd13,0);
// Actual framebuffer copies: transfer before component selection/storage.
tf(0xd14,.5);tf(0xd15,.25);ti(0xd18,0);tf(0xd19,.5);tf(0xd1a,-1);tf(0xd1b,1);
queryTransfer(0xd14,.5);queryTransfer(0xd19,.5);
call('glReadBuffer',[0x404]);call('glBindTexture',[T1,81]);
call('glCopyTexImage1D',[T1,0,RGBA,1,2,2,0]);
get(T1,0,[191,128,0,255,191,128,0,255],'copy applies nonidentity transfer');
// Get does not apply current transfer; changing it cannot alter stored bytes.
ti(0xd14,0);ti(0xd18,1);ti(0xd1a,1);tf(0xd15,0);tf(0xd19,0);tf(0xd1b,0);
get(T1,0,[191,128,0,255,191,128,0,255],'get skips transfer');
// Server pixel attributes restore transfer; client attributes do not.
ti(0xd14,1);call('glPushAttrib',[0x20]);tf(0xd14,.25);call('glPopAttrib');queryTransfer(0xd14,1);
call('glPushClientAttrib',[1]);tf(0xd14,.5);call('glPopClientAttrib');queryTransfer(0xd14,.5);
ti(0xd14,1);
// Float source values must survive until transfer BEFOREclamp and quantize.
const floats=Buffer.alloc(16);[-1,2,.5,.25].forEach((v,i)=>floats.writeFloatLE(v,i*4));write(input,floats);
tf(0xd15,1);tf(0xd18,.25);tf(0xd1a,2);tf(0xd1c,2);
call('glTexImage1D',[T1,0,RGBA,1,0,RGBA,0x1406,input]);
get(T1,0,[0,128,255,128],'float upload transfer before clamp');
for(const [name,value] of [[0xd15,0],[0xd18,1],[0xd1a,1],[0xd1c,1]])tf(name,value);
// Compile input is owned; transfer applies at execution, not compilation.
write(input,[200,100,50,255]);call('glNewList',[502,0x1300]);
call('glTexImage1D',[T1,0,RGBA,1,0,RGBA,U8,input]);call('glEndList');write(input,[1,2,3,4]);
tf(0xd14,.5);call('glCallList',[502]);get(T1,0,[100,100,50,255],'list input ownership/execution transfer');ti(0xd14,1);
// MAP_COLOR uses the actual initial one-elementzero tables; unsupported
// PixelMap setters stay unavailable, so no fabricated noninitial map values.
ti(0xd10,1);call('glCopyTexImage1D',[T1,0,RGBA,1,2,2,0]);get(T1,0,[0,0,0,0,0,0,0,0],'initial RGBA transfer maps');ti(0xd10,0);
for(const bad of [0xd0f,0xd16,0xd17,0xd20]){tf(bad,.5);error(0x500,'transfer invalid pname');}
call('glBegin',[0]);ti(0xd14,0);call('glEnd');error(0x502,'transfer BeginEnd atomic');queryTransfer(0xd14,1);
// Restore defaults before subsequent framebuffer/raster/list regressions.

// Bordered 2D levels include supplied border texels in GetTexImage, and
// negative subregion coordinates address that actual border storage.
call('glBindTexture',[T2,1501]);
const border2d=Array.from({length:16},(_,i)=>[i+1,i+21,i+41,255-i]).flat();write(input,border2d);
call('glTexImage2D',[T2,0,RGBA,4,4,1,RGBA,U8,input]);get(T2,0,border2d,'2D supplied border');
for(const[pname,want]of[[0x1000,4],[0x1001,4],[0x1003,RGBA],[0x1005,1]]){call('glGetTexLevelParameteriv',[T2,0,pname,output]);literal('2D actual level metadata '+pname,dv.getInt32(wa(output),true),want);}
call('glReadBuffer',[0x404]);call('glCopyTexSubImage2D',[T2,0,-1,-1,1,2,1,1]);
const borderEdited=[255,0,255,255,...border2d.slice(4)];get(T2,0,borderEdited,'2D negative border copy');
for(const args of [[T2,0,-2,0,1,2,1,1],[T2,0,2,0,1,2,2,1],[T2,0,0,2,1,2,1,2],[T2,0,0,0,1,2,-1,1],[T2,12,0,0,1,2,1,1]]){
 call('glCopyTexSubImage2D',args);error(0x501,'2D invalid bounds');get(T2,0,borderEdited,'2D rejected subcopy atomic');
}
call('glBegin',[0]);call('glCopyTexImage2D',[T2,0,RGBA,1,2,2,2,0]);call('glEnd');error(0x502,'2D copy BeginEnd');get(T2,0,borderEdited,'BeginEnd copy atomic');
// Client ownership for both dimensions: list compilation captures source
// rows, while the server transfer state is evaluated at list execution.
call('glBindTexture',[T2,1502]);write(input,[200,100,50,255,80,60,40,128]);
call('glNewList',[504,0x1300]);call('glTexImage2D',[T2,1,RGBA,2,1,0,RGBA,U8,input]);call('glEndList');write(input,[1,2,3,4,5,6,7,8]);
tf(0xd14,.5);call('glCallList',[504]);get(T2,1,[100,100,50,255,40,60,40,128],'2D list source ownership and transfer');ti(0xd14,1);
// Bounds are checked again against the texture bound at list execution.
for(const[target,image,sub,args]of[[T1,'glTexImage1D','glCopyTexSubImage1D',[T1,0,1,1,2,2]],[T2,'glTexImage2D','glCopyTexSubImage2D',[T2,0,1,0,1,2,2,1]]]){
 call('glBindTexture',[target,target===T1?1503:1504]);write(input,[17,29,43,71,53,67,79,83]);
 call(image,target===T1?[target,0,RGBA,2,0,RGBA,U8,input]:[target,0,RGBA,2,1,0,RGBA,U8,input]);
 call('glNewList',[505,0x1300]);call(sub,args);call('glEndList');error(0,'compile defers image bounds');
 call('glCallList',[505]);error(0x501,'playback current image bounds');get(target,0,[17,29,43,71,53,67,79,83],'playback invalid subcopy atomic');
 call('glDeleteLists',[505,1]);
}
call('glBindTexture',[T2,1502]);
// Nonuniform packed scalar source, with row padding and byte swapping.
call('glPixelStorei',[0xcf5,8]);call('glPixelStorei',[0xcf2,3]);call('glPixelStorei',[0xcf3,1]);call('glPixelStorei',[0xcf4,1]);call('glPixelStorei',[0xcf0,1]);
const unpack=Buffer.alloc(96,0xe7);for(const [at,values] of [[30,[0x1111,0x2222,0x3333,0x4444,0x5555,0x6666]],[54,[0x7777,0x8888,0x9999,0xaaaa,0xbbbb,0xcccc]]])values.forEach((v,i)=>unpack.writeUInt16BE(v,at+i*2));
write(input,unpack);call('glTexImage2D',[T2,0,RGBA,2,2,0,0x1907,0x1403,input]);
get(T2,0,[17,34,51,255,68,85,102,255,119,136,153,255,170,187,204,255],'2D unpack rows skips alignment and swap');
for(const [p,v] of [[0xcf5,1],[0xcf2,0],[0xcf3,0],[0xcf4,0],[0xcf0,0]])call('glPixelStorei',[p,v]);

// Render from copied storage, then copy that produced framebuffer. This checks
// actual upload consumption and queue ordering independently of texture queries.
for(const mode of [0x1700,0x1701,0x1702]){call('glMatrixMode',[mode]);call('glLoadIdentity');}
call('glMatrixMode',[0x1700]);call('glViewport',[0,0,8,8]);
for(const cap of [0xb50,0xb71,0xbe2,0xc11])call('glDisable',[cap]);
call('glDrawBuffer',[0x405]);call('glReadBuffer',[0x405]);
call('glClearColor',[f(0),f(0),f(0),f(1)]);call('glClear',[0x4000]);
call('glEnable',[0xc11]);
for(const [x,y,c] of [[3,2,[1,0,0,1]],[4,2,[0,1,0,1]],[3,3,[0,0,1,1]],[4,3,[1,1,0,1]]]){
 call('glScissor',[x,y,1,1]);call('glClearColor',c.map(f));call('glClear',[0x4000]);
}call('glDisable',[0xc11]);
call('glBindTexture',[T2,1601]);call('glCopyTexImage2D',[T2,0,RGBA,3,2,2,2,0]);
for(const target of [T1,T2])for(const pname of [0x2800,0x2801])call('glTexParameteri',[target,pname,0x2600]);
call('glEnable',[T2]);call('glDisable',[T1]);call('glTexEnvi',[0x2300,0x2200,0x1e01]);call('glColor4f',[f(1),f(1),f(1),f(1)]);
function quad(cs,ct){call('glBegin',[7]);for(const [x,y,s,t] of [[-1,-1,0,0],[1,-1,1,0],[1,1,1,1],[-1,1,0,1]]){call('glTexCoord2f',[f(cs===undefined?s:cs),f(ct===undefined?t:ct)]);call('glVertex2f',[f(x),f(y)]);}call('glEnd');}
function framebuffer(want,label){call('glReadPixels',[0,0,8,8,RGBA,U8,output]);literal(label,read(output,256),want);error(0,label+' error');}
const red=[255,0,0,255],green=[0,255,0,255],blue=[0,0,255,255],yellow=[255,255,0,255];
call('glEnable',[0xc11]);for(const [x,y,u,v] of [[0,0,.25,.25],[4,0,.75,.25],[0,4,.25,.75],[4,4,.75,.75]]){call('glScissor',[x,y,4,4]);quad(u,v);}call('glDisable',[0xc11]);
framebuffer(Array.from({length:64},(_,i)=>i<32?(i%8<4?red:green):(i%8<4?blue:yellow)).flat(),'copied2D rendered quadrants');
call('glBindTexture',[T1,1602]);for(const pname of [0x2800,0x2801])call('glTexParameteri',[T1,pname,0x2600]);call('glCopyTexImage1D',[T1,0,RGBA,3,1,2,0]);
get(T1,0,[255,0,0,255,0,255,0,255],'copy waits for actual queued textured draw');
call('glDisable',[T2]);call('glEnable',[T1]);call('glEnable',[0xc11]);for(const [x,u] of [[0,.25],[4,.75]]){call('glScissor',[x,0,4,8]);quad(u,9);}call('glDisable',[0xc11]);
framebuffer(Array.from({length:64},(_,i)=>i%8<4?red:green).flat(),'copied1D rendered columns');
// Unit and context bindings own separate objects; image contents survive an
// attribute pop on that same object rather than becoming historical data.
call('glDisable',[T1]);call('glActiveTextureARB',[0x84c1]);call('glBindTexture',[T2,1603]);
write(input,[17,29,43,71]);call('glTexImage2D',[T2,0,RGBA,1,1,0,RGBA,U8,input]);
call('glActiveTextureARB',[0x84c0]);get(T2,0,[255,0,0,255,0,255,0,255,0,0,255,255,255,255,0,255],'unit0 retained');
call('glPushAttrib',[0x40000]);write(input,[19,31,47,73]);call('glTexSubImage2D',[T2,0,1,1,1,1,RGBA,U8,input]);
call('glBindTexture',[T2,1604]);call('glPopAttrib');
get(T2,0,[255,0,0,255,0,255,0,255,0,0,255,255,19,31,47,73],'attribute restores binding but keeps actual edits');
call('glActiveTextureARB',[0x84c1]);get(T2,0,[17,29,43,71],'unit1 retained');call('glActiveTextureARB',[0x84c0]);
const secondContext=call('wglCreateContext',[dc]);assert(secondContext);assert.strictEqual(call('wglMakeCurrent',[dc,secondContext]),1);
call('glBindTexture',[T2,1601]);write(input,[23,37,53,79]);call('glTexImage2D',[T2,0,RGBA,1,1,0,RGBA,U8,input]);get(T2,0,[23,37,53,79],'same name separate context');
tf(0xd14,.25);assert.strictEqual(call('wglMakeCurrent',[dc,context]),1);queryTransfer(0xd14,1);
get(T2,0,[255,0,0,255,0,255,0,255,0,0,255,255,19,31,47,73],'first context retained actual data');
call('wglDeleteContext',[secondContext]);
// ReadBuffer belongs to PIXEL_MODE, DrawBuffer belongs to COLOR_BUFFER.
call('glReadBuffer',[0x404]);call('glDrawBuffer',[0x405]);call('glPushAttrib',[0x20]);
call('glReadBuffer',[0x405]);call('glDrawBuffer',[0x404]);call('glPopAttrib');
function queryInt(pname,want,label){call('glGetIntegerv',[pname,output]);literal(label,dv.getInt32(wa(output),true),want);}
queryInt(0xc02,0x404,'PIXEL_MODE restores read');queryInt(0xc01,0x404,'PIXEL_MODE leaves draw');
call('glPushAttrib',[0x4000]);call('glReadBuffer',[0x405]);call('glDrawBuffer',[0x405]);call('glPopAttrib');
queryInt(0xc02,0x405,'COLOR_BUFFER leaves read');queryInt(0xc01,0x404,'COLOR_BUFFER restores draw');
call('glDrawBuffer',[0x405]);
// Transfer is applied to ReadPixels and skipped by GetTexImage.
tf(0xd14,.5);tf(0xd19,.25);call('glReadPixels',[1,1,1,1,RGBA,U8,output]);
literal('ReadPixels nonidentity transfer',read(output,4),[128,64,0,255]);ti(0xd14,1);tf(0xd19,0);
// A list's full copy executes against the then-current framebuffer every time.
call('glBindTexture',[T2,1610]);call('glNewList',[503,0x1301]);call('glCopyTexImage2D',[T2,0,RGBA,1,1,1,1,0]);call('glEndList');
get(T2,0,red,'COMPILE_AND_EXECUTE copy');
call('glClearColor',[f(0),f(0),f(1),f(1)]);call('glClear',[0x4000]);call('glCallList',[503]);get(T2,0,blue,'copy list re-reads current framebuffer');
// Deletion releases storage and reusing its name creates an undefined object.
dv.setUint32(wa(input),1610,true);call('glDeleteTextures',[1,input]);call('glBindTexture',[T2,1610]);
write(output,Array(16).fill(0xa5));call('glGetTexImage',[T2,0,RGBA,U8,output]);literal('deleted name has no image',read(output,16),Array(16).fill(0xa5));

call('glBindTexture',[T2,1501]);for(const pname of [0x2800,0x2801])call('glTexParameteri',[T2,pname,0x2600]);
call('glEnable',[T2]);call('glDisable',[T1]);quad(.25,.25);
framebuffer(Array(64).fill([6,26,46,250]).flat(),'supplied 2D border uses interior normalized coordinates');call('glDisable',[T2]);

const sparseLiteral=(actual,want,label)=>literal(label,actual,want);
for(const p of [0x60000000,0x61000000,0x60001000,0x62000000,0x62002000,0x65000000])assert(e.test_virtual_map_commit(p,4096));
assert.notStrictEqual(wa(0x60001000)-wa(0x60000000),4096,'non-affine neighboring output pages');
call('glPixelStorei',[0xd05,1]);call('glPixelStorei',[0xd02,0]);call('glPixelStorei',[0xd03,0]);call('glPixelStorei',[0xd04,0]);
call('glBindTexture',[0xde0,140]);write(input,Buffer.from([17,29,43,71]));call('glTexImage1D',[0xde0,0,0x1908,1,0,0x1908,0x1401,input]);
write(0x65000ffc,Buffer.alloc(4,0xa5));call('glGetTexImage',[0xde0,0,0x1908,0x1401,0x65000ffc]);sparseLiteral(Array.from(read(0x65000ffc,4)),[17,29,43,71],'exact four-byte output at page end');
write(0x65000fff,Buffer.from([0xa5]));call('glGetTexImage',[0xde0,0,0x1903,0x1401,0x65000fff]);sparseLiteral(Array.from(read(0x65000fff,1)),[17],'exact one-byte output at page end');
write(0x60000ffd,Buffer.alloc(4,0xa5));call('glGetTexImage',[0xde0,0,0x1908,0x1401,0x60000ffd]);sparseLiteral(Array.from(read(0x60000ffd,4)),[17,29,43,71],'non-affine output crosses page');
// All seven public stdcall adapters gather an unaligned frame spanning
// nonadjacent guest pages and preserve every non-result register.
function sparseCall(name,args,at=0x60000ff5){
 const thunk=resolve(name),buf=Buffer.alloc(4*(args.length+1));buf.writeUInt32LE(0x12345678);args.forEach((v,i)=>buf.writeUInt32LE(v>>>0,4+i*4));write(at,buf);
 for(let i=0;i<8;i++)dv.setUint32(regs+i*4,0x55660000+i,true);dv.setUint32(regs+16,at,true);
 e.probe_invoke(thunk);assert.strictEqual(dv.getUint32(regs+16,true),at+buf.length,'sparse stdcall '+name);
 for(let i=1;i<8;i++)if(i!==4)assert.strictEqual(dv.getUint32(regs+i*4,true),0x55660000+i);
 literal('sparse frame preserved '+name,read(at,buf.length),[...buf]);
}
sparseCall('glCopyTexImage1D',[T1,3,RGBA,2,3,1,0]);
sparseCall('glCopyTexSubImage1D',[T1,3,0,2,3,1]);
get(T1,3,[6,26,46,250],'sparse-frame 1D copy data');
sparseCall('glCopyTexImage2D',[T2,3,RGBA,2,3,1,1,0]);
sparseCall('glCopyTexSubImage2D',[T2,3,0,0,2,3,1,1]);
get(T2,3,[6,26,46,250],'sparse-frame 2D copy data');
sparseCall('glGetTexImage',[T1,3,RGBA,U8,0x65000ffc]);literal('sparse-frame getter data',read(0x65000ffc,4),[6,26,46,250]);
sparseCall('glPixelTransferf',[0xd14,f(1)]);sparseCall('glPixelTransferi',[0xd13,0]);
for(const[name,args]of[['glGetTexImage',[T1,3,RGBA,U8,output]],['glCopyTexImage2D',[T2,3,RGBA,2,3,1,1,0]]]){
 const thunk=resolve(name),at=0x65000ff8;write(at,[0,0,0,0,0,0,0,0]);dv.setUint32(regs+16,at,true);
 assert.throws(()=>e.probe_invoke(thunk),WebAssembly.RuntimeError,'inaccessible sparse call frame');assert.strictEqual(dv.getUint32(regs+16,true),at,'frame fault preserves ESP');
}
// Metadata errors reject without touching an inaccessible output pointer.
for(const [args,expected] of [
 [[0x8063,0,0x1908,0x1401,0xffffffff],0x500],
 [[0xde0,-1,0x1908,0x1401,0xffffffff],0x501],
 [[0xde0,12,0x1908,0x1401,0xffffffff],0x501],
 [[0xde0,0,0x1902,0x1401,0xffffffff],0x500],
 [[0xde0,0,0x1908,0x1a00,0xffffffff],0x500],
]){call('glGetTexImage',args);error(expected,'invalid get rejects before output');}
call('glTexImage1D',[0xde0,0,0x1908,2048,0,0x1908,0x1401,0]);
write(0x62000004,Buffer.alloc(4092,0xa5));write(0x62002000,Buffer.alloc(4,0xa5));
const beforeUsed=e.gl_wat_stream_used();
assert.throws(()=>call('glGetTexImage',[0xde0,0,0x1908,0x1401,0x62000004]),WebAssembly.RuntimeError,'unmapped interior output page');
sparseLiteral(Array.from(read(0x62000004,4092)),Array(4092).fill(0xa5),'pack fault preserves all earlier output');
sparseLiteral(Array.from(read(0x62002000,4)),[0xa5,0xa5,0xa5,0xa5],'pack fault preserves later output');
assert.strictEqual(e.gl_wat_stream_used(),beforeUsed,'get fault does not emit records');
// Empty undefined image writes nothing and does not require a valid pointer.
call('glBindTexture',[0xde0,141]);call('glGetTexImage',[0xde0,0,0x1908,0x1401,0xffffffff]);error(0,'empty texture getter');

 if(queued){encoder.fence();assert(encoder.snapshot().glQueued>0,'real queue used');}
 error(0,'final error');const result={passed:true,route:queued?'queued':'direct',exports:names,checks,observations};
 if(process.env.GL_TEXTURE_COPY_EVIDENCE)fs.writeFileSync(process.env.GL_TEXTURE_COPY_EVIDENCE,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{if(encoder)encoder.stop();if(manager)await manager.stop();if(render)render.destroy();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
