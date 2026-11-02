'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),req=p=>require(path.join(root,p));
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
 // Semantic controls compile the actual current tree with a single changed
 // production expression. Saved-old controls replace exact source fragments.
 let prebuiltModule;
 const mutation=process.env.GL_BOOLEAN_POINTER_MUTATION,old=process.env.GL_BOOLEAN_POINTER_OLD;
 if(mutation||old){let changed=0;
  const B=GL.glGetBooleanv,P=GL.glGetPointerv;
  const edits={
   listState:['09a8e-gl-state.wat','gl_native_query_value','    (if (call $gl_transfer_valid', '    (if (i32.and (i32.eq (local.get $p) (i32.const 0xb00)) (i32.ne (i32.load offset=12 (call $gl_list_context)) (i32.const 0))) (then (return (f64.const 0))))\n    (if (call $gl_transfer_valid'],
   sign:['09a8e-gl-state.wat','gl_native_query','(f64.ne (local.get $v) (f64.const 0))','(f64.gt (local.get $v) (f64.const 0))'],
   nan:['09a8e-gl-state.wat','gl_native_query','(f64.ne (local.get $v) (f64.const 0))','(i32.and (f64.ne (local.get $v) (f64.const 0)) (f64.eq (local.get $v) (local.get $v)))'],
   integer:['09a8e-gl-state.wat','gl_native_query','(f64.ne (local.get $v) (f64.const 0))','(i32.ne (i32.trunc_sat_f64_s (local.get $v)) (i32.const 0))'],
   width:['09a8e-gl-state.wat','gl_native_query','(call $gs8 (i32.add (local.get $out) (local.get $i))','(call $gs32 (i32.add (local.get $out) (local.get $i))'],
   stride:['09a8e-gl-state.wat','gl_native_query','(call $gs8 (i32.add (local.get $out) (local.get $i))','(call $gs8 (i32.add (local.get $out) (i32.shl (local.get $i) (i32.const 2)))'],
   guest:['09a8e-gl-state.wat','gl_pointer_query','(local.set $value (global.get $gl_vp_guest))','(local.set $value (call $g2w (global.get $gl_vp_guest)))'],
   pointer:['09a8e-gl-state.wat','gl_pointer_query','(local.set $value (global.get $gl_cp_guest))','(local.set $value (i32.const 0))'],
   unit:['09a8e-gl-state.wat','gl_pointer_query','(global.get $gl_client_tex_unit)))','(i32.load offset=4 (call $gl_mtx_block))))'],
   null:['09a8e-gl-state.wat','gl_pointer_query','(local.set $value (global.get $gl_np_guest))','(local.set $value (select (global.get $gl_np_guest) (i32.const 1) (global.get $gl_np_guest)))'],
   begin:['09a8e-gl-state.wat','gl_pointer_query','(if (i32.ge_s (global.get $gl_immediate_mode) (i32.const 0))','(if (i32.const 0)'],
   atomic:['09a8e-gl-state.wat','gl_pointer_query','    (loop $validate_pointer_output','    (call $gs8 (local.get $out) (local.get $value))\n    (loop $validate_pointer_output'],
   pointerWidth:['09a8e-gl-state.wat','gl_pointer_query','(call $gs32 (local.get $out) (local.get $value))','(call $gs8 (local.get $out) (local.get $value))'],
   restore:['09a8cb-gl-bitmap.wat','gl_bitmap_intercept','(global.set $gl_vp_guest (i32.load offset=52 (local.get $p)))','(global.set $gl_vp_guest (i32.load offset=64 (local.get $p)))'],
   booleanAtomic:['09a8e-gl-state.wat','gl_native_query','    (loop $validate','    (call $gs8 (local.get $out) (i32.const 0))\n    (loop $validate'],
   context:['09a8e-gl-state.wat','gl_state_context_changed','(global.set $gl_vp_guest (i32.load offset=72 (local.get $p)))','(global.set $gl_vp_guest (i32.load offset=84 (local.get $p)))'],
  };
  const bytes=req('test/compile-src').compileSrcWasm((file,source)=>{
   if(file==='13-exports.wat')return source+extraWat;
   if(old){const p=path.join(old,file);if(fs.existsSync(p)){changed++;return fs.readFileSync(p,'utf8');}return source;}
   assert(edits[mutation],'known semantic mutation');const [f,fn,from,to]=edits[mutation];if(file!==f)return source;
   const start=source.indexOf('(func $'+fn+' '),end=source.indexOf('\n  (func ',start+8);assert(start>=0,'mutation function');
   const body=source.slice(start,end<0?undefined:end);assert(body.includes(from),'mutation anchor '+mutation);changed++;
   return source.slice(0,start)+body.replace(from,to)+(end<0?'':source.slice(end));
  });assert(changed,'source control applied');prebuiltModule=new WebAssembly.Module(bytes);console.error('SOURCE_CONTROL_COMPILED',mutation||'old-source');
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
 const dc=e.probe_dc(42)>>>0,context=call('wglCreateContext',[dc]);assert(context);
 assert.strictEqual(call('wglMakeCurrent',[dc,context]),1);
 const out=e.guest_alloc(256)>>>0,ow=wa(out),at=out+19;
 let checks=0;const expected=[];
 const fill=()=>new Uint8Array(memory.buffer,ow,256).fill(0xa7);
 function query(name,p,want){
  fill();call(name,[p,at]);
  const width=name==='glGetBooleanv'?1:name==='glGetDoublev'?8:4;
  const got=want.map((_,i)=>name==='glGetBooleanv'?dv.getUint8(wa(at+i)):
   name==='glGetPointerv'?dv.getUint32(wa(at+i*width),true):
   name==='glGetDoublev'?dv.getFloat64(wa(at+i*width),true):
   name==='glGetFloatv'?dv.getFloat32(wa(at+i*width),true):dv.getInt32(wa(at+i*width),true));
  assert.deepStrictEqual(got,want,name+' literal '+p.toString(16));
  assert(new Uint8Array(memory.buffer,ow,19).every(b=>b===0xa7),'leading byte canary '+name);
  assert(new Uint8Array(memory.buffer,wa(at)+want.length*width,256-19-want.length*width).every(b=>b===0xa7),'exact output width '+name);
  assert.strictEqual(call('glGetError'),0,'query error '+name);checks++;expected.push({name,p,got});
 }
 const b=(p,w)=>query('glGetBooleanv',p,w),p=(name,w)=>query('glGetPointerv',name,[w]);
 function rejected(name,pname,error=0x500,output=at){fill();call(name,[pname,output]);
  assert(new Uint8Array(memory.buffer,ow,256).every(v=>v===0xa7),'error writes nothing '+name);
  assert.strictEqual(call('glGetError'),error,'query GL error '+name);checks++;}
 for(const name of (process.argv.includes('--pointer-first')?['glGetPointerv','glGetBooleanv']:['glGetBooleanv','glGetPointerv'])){
  assert(resolve(name),'genuine native resolver '+name);
  const resolved=call('wglGetProcAddress',[str(name)])>>>0;assert(resolved,'wgl resolver '+name);
  assert.strictEqual(dv.getUint32(wa(resolved)+4,true),table.find(a=>a.name===name).id);
  cache.set(name,resolved);
 }
 // Defaults and each supported array, including unset NULL and disabled arrays.
 for(const n of [0x808e,0x808f,0x8090,0x8092])p(n,0);
 for(const n of [0x8074,0x8075,0x8076,0x8078])b(n,[0]);
 b(0xb00,[1,1,1,1]);b(0xb02,[0,0,1]);b(0xb03,[0,0,0,1]);
 b(0xba2,[0,0,1,1]);b(0xb70,[0,1]);b(0xc22,[0,0,0,0]);b(0xb73,[1]);b(0xbc2,[0]);
 for(const n of [0xba0,0xba3,0xba4,0xba5,0xd31,0xd32,0xd33,0xd35,0xd36,0xd38,0xd39,0xd3b,0x84e0,0x84e1,0x84e2])b(n,[1]);
 for(const n of [0xbb0,0xbb1,0xb30,0xb33,0xb32])b(n,[0]);
 for(const n of [0xd52,0xd53,0xd54,0xd55,0xd56,0xd57,0xd58,0xd59,0xd5a,0xd5b,0xc31,0xc32])b(n,[1]);
 for(const n of [0xc33,0xc00,0xb90,0xbe2,0xbc0,0xb71,0xb44,0xc11,0xb60,0xb50,0xb57,0xde0,0xde1,
  0x4000,0x4001,0x4002,0x4003,0x4004,0x4005,0x4006,0x4007,0x3000,0x3005])b(n,[0]);
 b(0xb53,[1,1,1,1]);b(0xb66,[0,0,0,0]);b(0xb80,[0,0,0,0]);b(0xc23,[1,1,1,1]);
 for(const n of [0xb93,0xb98,0xb11,0xb21,0xb45,0xb46,0xbc1,0xb74,0xb72,0xc01,0xc02,0xb54,0xb65,0xb62,0xb64,0xb08])b(n,[1]);
 b(0xb63,[0]);b(0xb97,[0]);
 for(const n of [0x807a,0x807b,0x807e,0x8081,0x8082,0x8088,0x8089])b(n,[1]);
 for(const n of [0x807c,0x807f,0x8083,0x808a])b(n,[0]);
 // Accepted transfer/readback prerequisites add native scalar query state.
 for(const n of [0xd00,0xd01,0xd02,0xd03,0xd04,0xd10,0xd11,0xd12,0xd13,0xd15,0xd19,0xd1b,0xd1d,0xd1f])b(n,[0]);
 for(const n of [0xd05,0xd14,0xd18,0xd1a,0xd1c,0xd1e])b(n,[1]);
 call('glPixelTransferf',[0xd14,f(-.125)]);b(0xd14,[1]);query('glGetDoublev',0xd14,[-.125]);
 call('glPixelTransferf',[0xd15,f(-0)]);b(0xd15,[0]);
 call('glPixelTransferi',[0xd12,-7]);b(0xd12,[1]);query('glGetIntegerv',0xd12,[-7]);
 call('glPixelTransferf',[0xd14,f(1)]);call('glPixelTransferi',[0xd12,0]);
 call('glColor4f',[0,-0,-.25,.125].map(f));b(0xb00,[0,0,1,1]);
 query('glGetFloatv',0xb00,[0,-0,-.25,.125]);query('glGetDoublev',0xb00,[0,-0,-.25,.125]);
 // The existing current-color store preserves NaN; only equality with zero
 // decides boolean conversion. No integer truncation, normalization or sign test.
 call('glColor4f',[NaN,-0,2**-149,-(2**-149)].map(f));b(0xb00,[1,0,1,1]);
 call('glNormal3f',[0,-0,-.125].map(f));b(0xb02,[0,0,1]);
 call('glTexCoord4f',[-0,.125,-.125,0].map(f));b(0xb03,[0,1,1,0]);
 call('glColorMask',[0,128,255,0]);b(0xc23,[0,1,1,0]);
 call('glViewport',[-7,0,0,11]);b(0xba2,[1,0,0,1]);query('glGetIntegerv',0xba2,[-7,0,0,11]);
 call('glScissor',[0,-3,0,9]);b(0xc10,[0,1,0,1]);
 const doubles=xs=>xs.flatMap(x=>{const z=Buffer.alloc(8);z.writeDoubleLE(x);return [z.readUInt32LE(),z.readUInt32LE(4)];});
 call('glDepthRange',doubles([0,.125]));b(0xb70,[0,1]);
 call('glStencilMask',[0x80000000]);b(0xb98,[1]);query('glGetIntegerv',0xb98,[-2147483648]);
 call('glStencilMask',[0]);b(0xb98,[0]);
 call('glListBase',[0x80000000]);b(0xb32,[1]);call('glListBase',[0]);b(0xb32,[0]);
 call('glEnable',[0xbe2]);b(0xbe2,[1]);call('glDisable',[0xbe2]);b(0xbe2,[0]);
 // Host-owned exact values must be current without an explicit flush. Tiny
 // nonzero clear depth must not become false through a binary32 temporary.
 call('glClearColor',[0,.125,-0,.25].map(f));b(0xc22,[0,1,0,1]);
 call('glClearDepth',doubles([2**-1000]));b(0xb73,[1]);query('glGetDoublev',0xb73,[2**-1000]);
 call('glClearDepth',doubles([-0]));b(0xb73,[0]);
 call('glAlphaFunc',[0x207,f(.125)]);b(0xbc2,[1]);call('glAlphaFunc',[0x207,f(0)]);b(0xbc2,[0]);
 call('glClearAccum',[0,-0,-.125,.25].map(f));b(0xb80,[0,0,1,1]);
 const matrix=e.guest_alloc(64)>>>0;
 [0,-0,.125,-.125,1,0,-1,2,0,3,0,-4,5,0,6,1].forEach((v,i)=>dv.setFloat32(wa(matrix)+4*i,v,true));
 call('glMatrixMode',[0x1700]);call('glLoadMatrixf',[matrix]);
 const mb=[0,0,1,1,1,0,1,1,0,1,0,1,1,0,1,1];b(0xba6,mb);
 call('glMatrixMode',[0x1701]);call('glLoadIdentity');b(0xba7,[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
 call('glMatrixMode',[0x1702]);call('glActiveTextureARB',[0x84c0]);call('glLoadMatrixf',[matrix]);b(0xba8,mb);
 call('glActiveTextureARB',[0x84c1]);call('glLoadIdentity');b(0xba8,[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
 call('glActiveTextureARB',[0x84c0]);b(0xba8,mb);
 // Address identity must not depend on mapping, contents, enable or draw.
 const drawablesBefore=e.probe_drawables(),verticesBefore=e.probe_count();
 call('glVertexPointer',[3,0x1406,16,0xdeadbeef]);p(0x808e,0xdeadbeef);
 call('glNormalPointer',[0x1406,12,0x81234567]);p(0x808f,0x81234567);
 call('glColorPointer',[4,0x1401,4,0xffffffff]);p(0x8090,0xffffffff);
 call('glClientActiveTextureARB',[0x84c0]);call('glTexCoordPointer',[2,0x1406,0,0xfedcba98]);p(0x8092,0xfedcba98);
 call('glClientActiveTextureARB',[0x84c1]);p(0x8092,0);call('glTexCoordPointer',[3,0x1402,8,0x12345679]);p(0x8092,0x12345679);
 call('glActiveTextureARB',[0x84c1]);call('glClientActiveTextureARB',[0x84c0]);p(0x8092,0xfedcba98);
 call('glActiveTextureARB',[0x84c0]);call('glClientActiveTextureARB',[0x84c1]);p(0x8092,0x12345679);
 for(const n of [0x8074,0x8075,0x8076,0x8078]){call('glEnableClientState',[n]);b(n,[1]);}
 p(0x808e,0xdeadbeef);p(0x808f,0x81234567);p(0x8090,0xffffffff);
 assert.strictEqual(e.probe_drawables(),drawablesBefore,'pointer queries allocate no drawable');
 assert.strictEqual(e.probe_count(),verticesBefore,'pointer queries produce no vertices');
 // Client-array snapshots include pointer words, enable bits and active unit.
 call('glPushClientAttrib',[2]);b(0xbb1,[1]);
 for(const n of [0x8074,0x8075,0x8076,0x8078]){call('glDisableClientState',[n]);b(n,[0]);}
 call('glVertexPointer',[2,0x1406,0,0]);call('glNormalPointer',[0x1406,0,0]);call('glColorPointer',[3,0x1406,0,0]);
 call('glTexCoordPointer',[4,0x1406,0,0]);p(0x8092,0);p(0x808e,0);p(0x808f,0);p(0x8090,0);
 call('glClientActiveTextureARB',[0x84c0]);call('glTexCoordPointer',[4,0x1406,0,0]);
 call('glPushClientAttrib',[2]);call('glVertexPointer',[2,0x1406,0,0x76543210]);p(0x808e,0x76543210);
 call('glPopClientAttrib');p(0x808e,0);call('glPopClientAttrib');b(0xbb1,[0]);
 p(0x808e,0xdeadbeef);p(0x808f,0x81234567);p(0x8090,0xffffffff);p(0x8092,0x12345679);
 query('glGetIntegerv',0x84e1,[0x84c1]);
 for(const n of [0x8074,0x8075,0x8076,0x8078])b(n,[1]);
 call('glClientActiveTextureARB',[0x84c0]);p(0x8092,0xfedcba98);
 call('glPushClientAttrib',[1]);call('glVertexPointer',[3,0x1406,0,0x76543210]);call('glPopClientAttrib');p(0x808e,0x76543210);
 call('glPushClientAttrib',[0]);call('glNormalPointer',[0x1406,0,0x23456789]);call('glPopClientAttrib');p(0x808f,0x23456789);
 call('glPushAttrib',[0xffffffff]);call('glColorPointer',[4,0x1401,0,0xabcdef01]);call('glPopAttrib');p(0x8090,0xabcdef01);
 call('glPushClientAttrib',[2]);call('glVertexPointer',[3,0x1406,0,0x13579bdf]);
 const other=call('wglCreateContext',[dc]);assert(other);call('wglMakeCurrent',[dc,other]);
 for(const n of [0x808e,0x808f,0x8090,0x8092])p(n,0);
 b(0xb00,[1,1,1,1]);b(0xbb1,[0]);call('glClientActiveTextureARB',[0x84c1]);p(0x8092,0);
 call('glTexCoordPointer',[2,0x1406,0,0xaabbccdd]);p(0x8092,0xaabbccdd);
 call('glColor4f',[0,0,f(.5),0]);b(0xb00,[0,0,1,0]);
 call('wglMakeCurrent',[dc,context]);b(0xbb1,[1]);p(0x808e,0x13579bdf);call('glPopClientAttrib');p(0x808e,0x76543210);p(0x808f,0x23456789);p(0x8090,0xabcdef01);p(0x8092,0xfedcba98);
 call('glClientActiveTextureARB',[0x84c1]);p(0x8092,0x12345679);
 call('wglMakeCurrent',[dc,other]);p(0x8092,0xaabbccdd);b(0xb00,[0,0,1,0]);
 call('wglMakeCurrent',[dc,context]);call('wglDeleteContext',[other]);
 // Invalid/unsupported names do not fabricate selection, feedback or extension state.
 for(const n of [0xdeadbeef,0x808e,0x8092,0xc40,0xd70,0x8894,0x8b8d,0xdf0,0xdf1,0xdf2,0xdf3,0xdf4,0xdf5,0xdf6,0xdf7,0xdf8])rejected('glGetBooleanv',n);
 for(const n of [0xdeadbeef,0x808e-1,0x8091,0x8093,0xdf0,0xdf3,0x8894,0xba6])rejected('glGetPointerv',n);
 for(const name of ['glGetBooleanv','glGetPointerv'])rejected(name,0xdeadbeef,0x500,0x44000000);
 call('glBegin',[0]);
 // GetError itself is illegal during Begin; read it only after End.
 for(const [name,n] of [['glGetBooleanv',0xba6],['glGetBooleanv',0xc22],['glGetPointerv',0x808e],['glGetBooleanv',0xdeadbeef],['glGetPointerv',0xdeadbeef]]){
  fill();call(name,[n,at]);assert(new Uint8Array(memory.buffer,ow,256).every(v=>v===0xa7),'executed Begin query leaves output unchanged');checks++;
 }
 call('glEnd');assert.strictEqual(call('glGetError'),0x502);
 // Gets are immediate inside GL_COMPILE, including a shadow Begin. They
 // observe executed server state and current client pointers, never record output.
 call('glColor4f',[0,f(.25),0,f(1)]);
 const list=call('glGenLists',[3]);call('glNewList',[list,0x1300]);
 call('glColor4f',[f(1),0,0,f(1)]);b(0xb00,[0,1,0,1]);b(0xc22,[0,1,0,1]);
 call('glPixelTransferf',[0xd15,f(.25)]);b(0xd15,[0]);
 call('glVertexPointer',[3,0x1406,0,0xcafebabe]);p(0x808e,0xcafebabe);
 call('glBegin',[0]);b(0xb00,[0,1,0,1]);b(0xc22,[0,1,0,1]);p(0x808e,0xcafebabe);call('glEnd');call('glEndList');
 call('glVertexPointer',[3,0x1406,0,0x10203040]);
 fill();call('glCallList',[list]);assert(new Uint8Array(memory.buffer,ow,256).every(v=>v===0xa7),'Get output not recorded');
 b(0xd15,[1]);query('glGetDoublev',0xd15,[.25]);
 b(0xb00,[1,0,0,1]);p(0x808e,0x10203040);call('glVertexPointer',[3,0x1406,0,0xcafebabe]);
 call('glNewList',[list+1,0x1301]);call('glColor4f',[0,0,f(1),f(1)]);b(0xb00,[0,0,1,1]);p(0x808e,0xcafebabe);
 call('glBegin',[0]);fill();call('glGetBooleanv',[0xb00,at]);call('glGetPointerv',[0x808e,at]);
 assert(new Uint8Array(memory.buffer,ow,256).every(v=>v===0xa7));call('glEnd');assert.strictEqual(call('glGetError'),0x502);call('glEndList');
 fill();call('glCallList',[list+1]);assert(new Uint8Array(memory.buffer,ow,256).every(v=>v===0xa7));
 // Nonaffine output pages and exact page-end writes. Boolean16 and pointer4
 // must validate exactly their widths, atomically, before touching output.
 const sparse=0x42000000;
 for(const addr of [sparse,0x43000000,sparse+4096,0x44000000])assert.strictEqual(e.probe_sparse_page(addr)>>>0,addr);
 assert.notStrictEqual(wa(sparse+4096),wa(sparse)+4096,'nonaffine pages');
 function spanQuery(name,n,addr,bytes){
  for(let i=-9;i<bytes.length+9;i++)dv.setUint8(wa(addr+i),0xb6);
  call(name,[n,addr]);assert.deepStrictEqual(Array.from({length:bytes.length},(_,i)=>dv.getUint8(wa(addr+i))),bytes,'sparse literal '+name);
  for(const i of [-9,-1,bytes.length,bytes.length+8])assert.strictEqual(dv.getUint8(wa(addr+i)),0xb6,'sparse canary');
  assert.strictEqual(call('glGetError'),0);checks++;
 }
 spanQuery('glGetBooleanv',0xba6,sparse+4093,mb);
 spanQuery('glGetBooleanv',0xc22,sparse+4095,[0,1,0,1]);
 spanQuery('glGetPointerv',0x808e,sparse+4094,[0xbe,0xba,0xfe,0xca]);
 const exact=0x44000000;
 dv.setUint8(wa(exact+4094),0xb6);call('glGetBooleanv',[0xba0,exact+4095]);
 assert.strictEqual(dv.getUint8(wa(exact+4095)),1);assert.strictEqual(dv.getUint8(wa(exact+4094)),0xb6);checks++;
 call('glGetPointerv',[0x808e,exact+4092]);assert.strictEqual(dv.getUint32(wa(exact+4092),true),0xcafebabe);checks++;
 function atomicTrap(name,n,addr,available){
  for(let i=available ? -9 : 0;i<available;i++)dv.setUint8(wa(addr+i),0xb6);
  const thunk=resolve(name);dv.setUint32(regs+16,stack,true);dv.setUint32(stackWa,0x12345678,true);
  dv.setUint32(stackWa+4,n,true);dv.setUint32(stackWa+8,addr,true);
  assert.throws(()=>e.probe_invoke(thunk),n===0xc22 ? RangeError : WebAssembly.RuntimeError,'invalid span traps '+name);
  assert.strictEqual(dv.getUint32(regs+16,true),stack,'trap keeps ESP');
  for(let i=available ? -9 : 0;i<available;i++)assert.strictEqual(dv.getUint8(wa(addr+i)),0xb6,'atomic output validation '+name);checks++;
 }
 atomicTrap('glGetBooleanv',0xba6,exact+4093,3);atomicTrap('glGetPointerv',0x808e,exact+4094,2);
 atomicTrap('glGetBooleanv',0xba6,0xfffffff8,0);atomicTrap('glGetPointerv',0x808e,0xfffffffe,0);
 // The query paths themselves need no draw; only this final small rectangle
 // proves that --worker actually exercises an independently instantiated queue.
 call('glViewport',[0,0,8,8]);call('glDepthRange',doubles([0,1]));
 for(const mode of [0x1700,0x1701]){call('glMatrixMode',[mode]);call('glLoadIdentity');}
 call('glColorMask',[1,1,1,1]);call('glDisable',[0xc11]);call('glDisable',[0xb90]);
 call('glColor4f',[f(1),0,0,f(1)]);call('glRectf',[-1,-1,1,1].map(f));call('glClearColor',[0,f(.5),0,0]);b(0xc22,[0,1,0,0]);
 if(encoder){encoder.fence();assert(encoder.snapshot().glQueued>=1,'actual queued draw');}
 assert.strictEqual(call('glGetError'),0);
 // A host exception aborts replay before its stream reset. End this harness
 // after verifying its failure, as a guest memory fault is terminal.
 atomicTrap('glGetBooleanv',0xc22,exact+4094,2);
 const result={passed:true,route:queued?'queued':'direct',checks,expected};
 console.log(JSON.stringify({passed:true,route:result.route,checks}));
 if(process.env.GL_BOOLEAN_POINTER_EVIDENCE)fs.writeFileSync(process.env.GL_BOOLEAN_POINTER_EVIDENCE,JSON.stringify(result,null,2));
 }finally{if(encoder)encoder.stop();if(manager)await manager.stop();if(render)render.destroy();}
})().catch(error=>{console.error(error);process.exitCode=1;});
