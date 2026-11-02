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
 const queued=process.argv.includes('--worker'),mutation=process.env.GL_RASTER_POSITION_MUTATION,baseline=process.env.GL_RASTER_POSITION_BASELINE;
 let prebuiltModule;
 if(mutation||baseline){let changed=false;
  const bytes=req('test/compile-src').compileSrcWasm((file,source)=>{
   if(file==='13-exports.wat')return source+extraWat;
   if(baseline&&['09a8b-handlers-opengl.wat','09a8cb-gl-bitmap.wat','09a8ca-gl-lists.wat','09a8e-gl-state.wat','09a8g-gl-raster.wat','09b2-dispatch-table.generated.wat'].includes(file)){changed=true;return fs.readFileSync(path.join(baseline,file),'utf8');}
   if(baseline)return source;
   const edits={
    defaults:['09a8b-handlers-opengl.wat','(local.set $q (f32.const 1))','(local.set $q (f32.const 0))','$handle_glRasterPos_typed'],
    dimensions:['09a8b-handlers-opengl.wat','(i32.ge_u (local.get $components) (i32.const 3))','(i32.ge_u (local.get $components) (i32.const 4))','$handle_glRasterPos_typed'],
    stride:['09a8b-handlers-opengl.wat','(then (i32.const 8)) (else (i32.const 4))))','(then (i32.const 4)) (else (i32.const 4))))','$handle_glRasterPos_typed'],
    signed:['09a8b-handlers-opengl.wat','(f32.convert_i32_s (call $gl32 (local.get $p))))','(f32.convert_i32_u (call $gl32 (local.get $p))))','$gl_rect_component'],
    normalized:['09a8b-handlers-opengl.wat','(f32.convert_i32_s (call $gl32 (local.get $p))))','(f32.div (f32.convert_i32_s (call $gl32 (local.get $p))) (f32.const 2147483647)))','$gl_rect_component'],
    conversion:['09a8b-handlers-opengl.wat','(f32.demote_f64 (f64.reinterpret_i64 (call $gl64 (local.get $p))))','(f32.reinterpret_i32 (call $gl32 (local.get $p)))','$gl_rect_component'],
    clip:['09a8cb-gl-bitmap.wat','(f32.le (f32.abs','(f32.ge (f32.abs','$gl_bitmap_raster_pos'],
    w:['09a8cb-gl-bitmap.wat','(f32.store offset=56 (local.get $ctx) (local.get $w))','(f32.store offset=56 (local.get $ctx) (f32.const 1))','$gl_bitmap_raster_pos'],
    lighting:['09a8cb-gl-bitmap.wat','(if (i32.and (local.get $caps) (i32.const 128))','(if (i32.const 0)','$gl_bitmap_raster_pos'],
    normal:['09a8g-gl-raster.wat','(if (local.get $normal_ready)','(if (i32.const 0)','$gl_sw_light_evaluate'],
    texture:['09a8cb-gl-bitmap.wat','(call $gl_mtx_stack_top (local.get $b) (i32.const 2)) (local.get $v))','(call $gl_mtx_stack_top (local.get $b) (i32.const 0)) (local.get $v))','$gl_bitmap_raster_pos'],
    texgen:['09a8cb-gl-bitmap.wat','(call $gl_raster_texgen (local.get $ctx) (i32.const 0)', '(call $gl_raster_texgen (local.get $ctx) (i32.const 1)','$gl_bitmap_raster_pos'],
    list:['09a8b-handlers-opengl.wat','(drop (call $gl_wat_encode_call (i32.const 146) (local.get $stack) (i32.const 0)))','(drop (call $gl_bitmap_intercept (i32.const 146) (local.get $stack)))','$handle_glRasterPos_typed'],
    attrib:['09a8cb-gl-bitmap.wat','(if (i32.and (local.get $mask) (i32.const 1))\n        (then (memory.copy (i32.add (local.get $ctx) (i32.const 40))','(if (i32.const 1)\n        (then (memory.copy (i32.add (local.get $ctx) (i32.const 40))','$gl_bitmap_intercept'],
   };
   if(!edits[mutation])throw Error('unknown mutation '+mutation);
   const [target,from,to,func]=edits[mutation];if(file!==target)return source;
   const start=source.indexOf('(func '+func+' ');assert(start>=0,'mutation function exists');
   const body=source.slice(start);assert(body.includes(from),'mutation anchor '+mutation);
   changed=true;return source.slice(0,start)+body.replace(from,to);
  });assert(changed,'mutation applied');prebuiltModule=new WebAssembly.Module(bytes);
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
 const names=`glRasterPos2d glRasterPos2dv glRasterPos2f glRasterPos2fv glRasterPos2i glRasterPos2iv glRasterPos2s glRasterPos2sv
 glRasterPos3d glRasterPos3dv glRasterPos3f glRasterPos3fv glRasterPos3i glRasterPos3iv glRasterPos3s glRasterPos3sv
 glRasterPos4d glRasterPos4dv glRasterPos4f glRasterPos4fv glRasterPos4i glRasterPos4iv glRasterPos4s glRasterPos4sv`.split(/\s+/);
 const metadata=name=>{const [,n,kind,v]=/^glRasterPos([234])([dfis])(v?)$/.exec(name);return {n:+n,kind,vector:!!v};};
 const vec=e.guest_alloc(80)>>>0,query=e.guest_alloc(64)>>>0;
 const bytes=(values,kind,scalar=false)=>{const width=kind==='d'?8:kind==='s'&&!scalar?2:4,b=Buffer.alloc(width*values.length);
  values.forEach((v,i)=>{if(kind==='d')b.writeDoubleLE(v,i*width);else if(kind==='f')b.writeFloatLE(v,i*width);
   else if(kind==='s'&&!scalar)b.writeInt16LE(v,i*width);else b.writeInt32LE(v|0,i*width);});return b;};
 const write=(p,b)=>{for(let i=0;i<b.length;i++)dv.setUint8(wa(p+i),b[i]);};
 const words=b=>Array.from({length:b.length/4},(_,i)=>b.readUInt32LE(i*4));
 const typed=(name,values,p=vec)=>{const m=metadata(name);assert.strictEqual(values.length,m.n);
  if(m.vector){write(p,bytes(values,m.kind));return call(name,[p]);}return call(name,words(bytes(values,m.kind,true)));};
 function get(p,n=4,kind='f') {const width=kind==='d'?8:4;new Uint8Array(memory.buffer,wa(query),64).fill(0xa7);
  call(kind==='d'?'glGetDoublev':kind==='i'?'glGetIntegerv':'glGetFloatv',[p,query+8]);
  const a=Array.from({length:n},(_,i)=>kind==='d'?dv.getFloat64(wa(query+8+i*width),true):kind==='i'?dv.getInt32(wa(query+8+i*width),true):dv.getFloat32(wa(query+8+i*width),true));
  assert(new Uint8Array(memory.buffer,wa(query),8).every(x=>x===0xa7),'query prefix canary');
  assert(new Uint8Array(memory.buffer,wa(query+8+n*width),56-n*width).every(x=>x===0xa7),'query tail canary');return a;
 }
 const check=(p,want,label,kind='f')=>{const got=get(p,want.length,kind);assert.deepStrictEqual(got,want,label);observations.push({label,actual:got,expected:want});checks++;};
 const pos=(want,label)=>{check(0xb08,[1],label+' valid','i');check(0xb07,want,label);};
 const matrix=e.guest_alloc(64)>>>0;
 const load=(mode,a)=>{call('glMatrixMode',[mode]);write(matrix,bytes(a,'f'));call('glLoadMatrixf',[matrix]);};
 const identity=mode=>{call('glMatrixMode',[mode]);call('glLoadIdentity');};
 const depth=(n,z)=>call('glDepthRange',words(bytes([n,z],'d',true)));
 const seed=()=>typed('glRasterPos4dv',[0,0,0,1]);
 const color=(r,g,b,a=1)=>call('glColor4f',[r,g,b,a].map(f));
 for(const name of names)assert(call('wglGetProcAddress',[str(name)]),'resolved raster symbol '+name);
 check(0xb07,[0,0,0,1],'initial raster position');check(0xb04,[1,1,1,1],'initial raster color');
 check(0xb06,[0,0,0,1],'initial raster texture');check(0xb09,[0],'initial distance');check(0xb05,[1],'RGBA raster index remains one');
 call('wglMakeCurrent',[0,0]);for(const name of names)typed(name,Array(metadata(name).n).fill(0));call('wglMakeCurrent',[dc,context]);
 check(0xb07,[0,0,0,1],'no-context raster calls leave context untouched');
 call('glViewport',[0,0,8,8]);identity(0x1700);identity(0x1701);
 const samples={d:[-.5,.25,.5,2],f:[-.5,.25,.5,2],i:[-1,0,1,2],s:[-1,0,1,2]};
 const wants={d:{2:[2,5,.5,1],3:[2,5,.75,1],4:[3,4.5,.625,2]},f:{2:[2,5,.5,1],3:[2,5,.75,1],4:[3,4.5,.625,2]},
 i:{2:[0,4,.5,1],3:[0,4,1,1],4:[2,4,.75,2]},s:{2:[0,4,.5,1],3:[0,4,1,1],4:[2,4,.75,2]}};
 for(const name of names){const {n,kind}=metadata(name);assert(call('wglGetProcAddress',[str(name)]),'WGL availability '+name);
  seed();const count=e.probe_count(),used=e.gl_wat_stream_used();typed(name,samples[kind].slice(0,n));pos(wants[kind][n],name+' literal dimension/signed');
  assert.strictEqual(e.probe_count(),count,'raster call emits no vertex');assert.strictEqual(e.gl_wat_stream_used(),used,'raster call emits no draw');
 }
 // Short scalar padding is ignored. Non-normalized integer extrema and f64
 // rounding are independently observed after a tiny modelview scale.
 load(0x1700,[1/32768,0,0,0,0,1/32768,0,0,0,0,1/32768,0,0,0,0,1]);
 call('glRasterPos4s',[0x12348000,0x56787fff,0x3141ffff,2]);pos([2,5.99993896484375,.49999237060546875,2],'padded signed scalar short');
 load(0x1700,[1/2147483648,0,0,0,0,1/2147483648,0,0,0,0,1/2147483648,0,0,0,0,1]);
 typed('glRasterPos4iv',[-2147483648,2147483647,16777217,2]);pos([2,6,.501953125,2],'literal GLint extrema and f32 rounding');
 load(0x1700,[.25,0,0,0,0,.25,0,0,0,0,.25,0,0,0,0,1]);
 typed('glRasterPos3dv',[1.000000059604645,-1.25,Math.PI]);pos([5,2.75,.892699122428894,1],'literal binary64 demotion');
 identity(0x1700);
 // Sparse pages are deliberately non-affine: interposed backing allocations
 // prevent accidentally reading the physical byte after a translated pointer.
 for(const p of [0x60000000,0x61000000,0x60001000,0x63000000,0x64000000,0x63001000])assert(e.test_virtual_map_commit(p,4096));
 assert.notStrictEqual(wa(0x60001000)-wa(0x60000000),4096);assert.notStrictEqual(wa(0x63001000)-wa(0x63000000),4096);
 new Uint8Array(memory.buffer,wa(0x61000000),4096).fill(0x7f);new Uint8Array(memory.buffer,wa(0x64000000),4096).fill(0x7e);
 function sparse(name,values,at=0x60000ff9,vectorAt=0x63000ffd){const {kind,vector}=metadata(name),thunk=resolve(name);
  const a=vector?(write(vectorAt,bytes(values,kind)),bytes([vectorAt],'i',true)):bytes(values,kind,true);
  const frame=Buffer.alloc(a.length+20,0xa7);frame.writeUInt32LE(0x12345678,8);a.copy(frame,12);write(at-8,frame);
  const vb=vector?Buffer.concat([Buffer.alloc(8,0x6b),bytes(values,kind),Buffer.alloc(8,0x6c)]):null;if(vector)write(vectorAt-8,vb);
  for(let i=0;i<8;i++)dv.setUint32(regs+i*4,0x55660000+i,true);dv.setUint32(regs+16,at,true);
  e.probe_invoke(thunk);assert.strictEqual(dv.getUint32(regs+16,true),at+4+a.length,'sparse cleanup '+name);assert.strictEqual(dv.getUint32(regs,true),0);
  for(let i=1;i<8;i++)if(i!==4)assert.strictEqual(dv.getUint32(regs+i*4,true),0x55660000+i);
  assert.deepStrictEqual(Buffer.from(Array.from({length:frame.length},(_,i)=>dv.getUint8(wa(at-8+i)))),frame,'sparse frame canary '+name);
  if(vector)assert.deepStrictEqual(Buffer.from(Array.from({length:vb.length},(_,i)=>dv.getUint8(wa(vectorAt-8+i)))),vb,'vector retained '+name);
 }
 const aliases=names.filter(n=>n!=='glRasterPos2f');assert.strictEqual(aliases.length,23);
 for(const name of aliases){const {n,kind}=metadata(name);sparse(name,samples[kind].slice(0,n));pos(wants[kind][n],'sparse '+name);}
 sparse('glRasterPos4dv',[-.5,.25,.5,2],0x60000ffa);pos([3,4.5,.625,2],'split pointer slot');
 sparse('glRasterPos3sv',[-1,0,1],0x60000ffb,0x63000fff);pos([0,4,1,1],'split short scalar/vector');
 assert(e.test_virtual_map_commit(0x65000000,4096));assert.strictEqual(wa(0x65001000),240);
 function bad(name,at,args,label,seedBefore=true){if(seedBefore)seed();const thunk=resolve(name);if(args)write(at+4,bytes(args,'i',true));
  for(let i=0;i<8;i++)dv.setUint32(regs+i*4,0x55660000+i,true);dv.setUint32(regs+16,at,true);dv.setUint32(regs,0xdeadbeef,true);
  const used=e.gl_wat_stream_used(),vertices=e.probe_count();
  assert.throws(()=>e.probe_invoke(thunk),WebAssembly.RuntimeError,label);assert.strictEqual(dv.getUint32(regs+16,true),at,label+' ESP');assert.strictEqual(dv.getUint32(regs,true),0xdeadbeef,label+' EAX');
  for(let i=1;i<8;i++)if(i!==4)assert.strictEqual(dv.getUint32(regs+i*4,true),0x55660000+i,label+' GPR');
  assert.strictEqual(e.gl_wat_stream_used(),used,label+' no command');assert.strictEqual(e.probe_count(),vertices,label+' no vertex');pos([4,4,.5,1],label+' atomic');
 }
 for(const name of aliases.filter(x=>x.endsWith('v'))){const {n,kind}=metadata(name),size=n*(kind==='d'?8:kind==='s'?2:4);
  bad(name,stack,[0x65001000],'missing first '+name);bad(name,stack,[0x65001000-size+1],'missing last '+name);bad(name,stack,[0xffffffff],'wrap '+name);
 }
 bad('glRasterPos4f',0x64fffffc,[0,0,0,f(1)],'missing return word');
 bad('glRasterPos4dv',0x65000ffa,null,'missing pointer tail');bad('glRasterPos4d',0x65000fe0,null,'missing scalar final double');
 bad('glRasterPos4d',0xffffffec,null,'wrapping scalar');bad('glRasterPos2sv',0xfffffffc,null,'wrapping pointer frame');
 assert(new Uint8Array(memory.buffer,wa(0x61000000),4096).every(x=>x===0x7f));assert(new Uint8Array(memory.buffer,wa(0x64000000),4096).every(x=>x===0x7e));
 for(const getter of ['glGetFloatv','glGetIntegerv','glGetDoublev'])for(const pname of [0xb04,0xb06,0xb07]){
  const at=0x65000ff8;new Uint8Array(memory.buffer,wa(at),8).fill(0xa9);
  assert.throws(()=>call(getter,[pname,at]),WebAssembly.RuntimeError,'raster query validates whole output '+getter+'/'+pname);
  assert(new Uint8Array(memory.buffer,wa(at),8).every(x=>x===0xa9),'malformed query is atomic');checks++;
 }
 // Named stacks, non-affine homogeneous modelview and projection. Leave the
 // texture stack selected so accidentally using the current matrix fails.
 load(0x1700,[2,0,0,1,0,1,0,0,0,0,1,0,0,0,0,1]);
 load(0x1701,[.5,0,0,0,0,1,0,0,0,0,.5,0,.25,-.25,0,1]);
 call('glViewport',[10,20,80,40]);depth(.25,.75);identity(0x1702);
 typed('glRasterPos4d',[.5,.25,.5,1.5]);pos([70,37.5,.53125,2],'homogeneous named stacks/viewport/depth');
 check(0xb09,[.5728219747543335],'dehomogenized eye Euclidean distance');
 check(0xb07,[70,37.5,.53125,2],'double raster query','d');
 identity(0x1700);identity(0x1701);call('glViewport',[0,0,8,8]);depth(0,1);
 for(const v of [[2,0,0,1],[-2,0,0,1],[0,2,0,1],[0,-2,0,1],[0,0,2,1],[0,0,-2,1],[0,0,0,-1],[1,0,0,0],[0,0,0,0],[NaN,0,0,1]]){
  seed();typed('glRasterPos4dv',v);check(0xb08,[0],'homogeneous clip '+v,'i');
  // Invalid bit is defined. Other associated values are indeterminate in GL.
  const p=get(0xb07);call('glBitmap',[0,0,0,0,f(17),f(19),0]);assert.deepStrictEqual(get(0xb07),p,'invalid bitmap cannot advance');
 }
 for(const v of [[1,0,0,1],[-1,0,0,1],[0,1,0,1],[0,-1,0,1],[0,0,1,1],[0,0,-1,1]]){typed('glRasterPos4fv',v);check(0xb08,[1],'inclusive clip boundary '+v,'i');}
 depth(1,0);typed('glRasterPos3f',[0,0,.5]);pos([4,4,.25,1],'reversed depth range');depth(-2,3);check(0xb70,[0,1],'depth range clamps');depth(0,1);
 // Each named matrix stack has ordinary push/pop behavior for raster calls.
 identity(0x1700);call('glPushMatrix');call('glTranslatef',[f(.25),0,0]);
 identity(0x1701);call('glPushMatrix');call('glScalef',[f(.5),f(1),f(1)]);
 typed('glRasterPos3dv',[-.5,.25,.5]);pos([3.5,5,.75,1],'pushed modelview/projection stacks');
 call('glPopMatrix');typed('glRasterPos3dv',[-.5,.25,.5]);pos([3,5,.75,1],'projection stack pop');
 call('glMatrixMode',[0x1700]);call('glPopMatrix');typed('glRasterPos3dv',[-.5,.25,.5]);pos([2,5,.75,1],'modelview stack pop');
 // Color and texture associated data are snapshots. Texture enable does not
 // alter capture; all four coordinates survive the texture matrix.
 color(2,-1,.5,.25);call('glTexCoord4f',[.25,.5,.75,2].map(f));
 load(0x1702,[2,0,0,.5,0,3,0,0,1,0,4,0,.25,0,0,1]);
 call('glEnable',[0xde1]);seed();check(0xb04,[1,0,.5,.25],'clamped raster current color');check(0xb06,[1.75,1.5,3,2.125],'full homogeneous raster texture');
 call('glDisable',[0xde1]);color(0,1,0);call('glTexCoord4f',[9,8,7,6].map(f));identity(0x1702);
 check(0xb04,[1,0,.5,.25],'raster color snapshot');check(0xb06,[1.75,1.5,3,2.125],'raster texture snapshot');
 call('glActiveTextureARB',[0x84c1]);call('glMultiTexCoord4fARB',[0x84c1,...[.5,.25,.75,2].map(f)]);load(0x1702,[1,0,0,0,0,1,0,0,0,0,1,0,1,0,0,1]);seed();check(0xb06,[2.5,.25,.75,2],'unit-one raster texture');
 call('glActiveTextureARB',[0x84c0]);check(0xb06,[9,8,7,6],'unit-zero raster texture isolated');
 typed('glRasterPos3dv',[0,0,2]);call('glPushAttrib',[1]);seed();call('glPopAttrib');check(0xb08,[0],'CURRENT_BIT restores invalid raster bit','i');seed();
 call('glPushAttrib',[1]);typed('glRasterPos3dv',[-.5,.25,.5]);call('glPopAttrib');pos([4,4,.5,1],'CURRENT_BIT raster restore');check(0xb06,[9,8,7,6],'CURRENT_BIT texture restore');check(0xb09,[0],'CURRENT_BIT distance restore');check(0xb04,[0,1,0,1],'CURRENT_BIT color restore');
 call('glPushAttrib',[0x40000]);typed('glRasterPos3dv',[-.5,.25,.5]);call('glPopAttrib');pos([2,5,.75,1],'unrelated attrib preserves raster change');
 const context2=call('wglCreateContext',[dc]);call('wglMakeCurrent',[dc,context2]);check(0xb07,[0,0,0,1],'new context raster default');check(0xb06,[0,0,0,1],'new context raster texture default');check(0xb04,[1,1,1,1],'new context raster color default');check(0xb09,[0],'new context raster distance default');check(0xb08,[1],'new context raster valid default','i');
 seed();call('glPushClientAttrib',[1]);seed();call('glPopClientAttrib');assert.strictEqual(call('glGetError'),0,'default viewport cannot clobber client stack');
 call('wglMakeCurrent',[dc,context]);pos([2,5,.75,1],'context raster restored');check(0xb06,[9,8,7,6],'context raster texture restored');
 call('wglDeleteContext',[context2]);const fresh=call('wglCreateContext',[dc]);call('wglMakeCurrent',[dc,fresh]);check(0xb07,[0,0,0,1],'deleted context values discarded');call('wglMakeCurrent',[dc,context]);
 // Every alias records source VALUES and transforms at execution. The list
 // does not capture the matrix, viewport, lighting or current color.
 identity(0x1700);identity(0x1701);identity(0x1702);color(1,0,0);
 const lists=[];
 for(const name of names)for(const mode of [0x1300,0x1301]){const {n,kind}=metadata(name);seed();const id=call('glGenLists',[1]);
  call('glNewList',[id,mode]);typed(name,samples[kind].slice(0,n));call('glEndList');pos(mode===0x1300?[4,4,.5,1]:wants[kind][n],'list timing '+name+'/'+mode);
  write(vec,Buffer.alloc(80,0x5e));seed();call('glCallList',[id]);pos(wants[kind][n],'owned list values '+name+'/'+mode);lists.push(id);
 }
 call('glViewport',[10,20,16,8]);color(0,0,1);call('glCallList',[lists[0]]);pos([14,25,.5,1],'list uses execution viewport');check(0xb04,[0,0,1,1],'list uses execution color');
 call('glMatrixMode',[0x1700]);call('glTranslatef',[f(.25),0,0]);call('glCallList',[lists[0]]);pos([16,25,.5,1],'list uses execution matrix');identity(0x1700);call('glViewport',[0,0,8,8]);
 for(const name of names){seed();call('glBegin',[0]);const count=e.probe_count();typed(name,samples[metadata(name).kind].slice(0,metadata(name).n));
  assert.strictEqual(e.probe_count(),count,'Begin cannot emit raster vertex '+name);assert.strictEqual(e.probe_mode(),0,'Begin survives');call('glEnd');assert.strictEqual(call('glGetError'),0x502);pos([4,4,.5,1],'Begin atomic '+name);
 }
 seed();call('glBegin',[0]);call('glCallList',[lists[0]]);call('glEnd');assert.strictEqual(call('glGetError'),0x502);pos([4,4,.5,1],'Begin list replay atomic');
 const atomic=call('glGenLists',[1]);seed();call('glNewList',[atomic,0x1300]);typed('glRasterPos3sv',[-1,0,1]);bad('glRasterPos4dv',stack,[0x65000ff9],'malformed list source',false);call('glEndList');seed();call('glCallList',[atomic]);pos([0,4,1,1],'malformed call adds no list record');
 const illegal=call('glGenLists',[1]);seed();call('glNewList',[illegal,0x1300]);call('glBegin',[0]);typed('glRasterPos4dv',[0,0,0,1]);call('glEnd');call('glEndList');assert.strictEqual(call('glGetError'),0x502);call('glCallList',[illegal]);pos([4,4,.5,1],'recorded Begin rejects raster');
 // Pixel evidence uses the real bitmap fragment path and readback. Raster
 // position/color/depth are frozen while fragment tests use draw-time state.
 const bitmapBits=e.guest_alloc(8)>>>0,output=e.guest_alloc(264)>>>0;
 write(bitmapBits,Buffer.from([0x80]));call('glPixelStorei',[0xcf5,1]);call('glPixelStorei',[0xd05,1]);call('glDrawBuffer',[0x405]);call('glReadBuffer',[0x405]);
 const bitmap=()=>call('glBitmap',[1,1,0,0,0,0,bitmapBits]);
 const readPixel=(x,y,want,label)=>{call('glFinish');if(encoder)encoder.fence();new Uint8Array(memory.buffer,wa(output),264).fill(0xa7);
  call('glReadPixels',[x,y,1,1,0x1908,0x1401,output+4]);const got=Array.from(new Uint8Array(memory.buffer,wa(output+4),4));
  assert.deepStrictEqual(got,want,label);assert(new Uint8Array(memory.buffer,wa(output),4).every(x=>x===0xa7));assert(new Uint8Array(memory.buffer,wa(output+8),256).every(x=>x===0xa7));
  observations.push({label,pixel:[x,y],actual:got,expected:want});checks++;};
 call('glClearColor',[0,0,0,f(1)]);call('glClear',[0x4000]);color(1,0,0);typed('glRasterPos4dv',[-1,-.5,0,2]);
 color(0,1,0);bitmap();readPixel(2,3,[255,0,0,255],'captured red at literal projected bitmap pixel');readPixel(1,3,[0,0,0,255],'adjacent pixel untouched');
 call('glEnable',[0xb71]);call('glDepthFunc',[0x201]);call('glClearDepth',words(bytes([1],'d',true)));call('glClear',[0x4100]);
 color(0,1,0);typed('glRasterPos3d',[-.5,-.25,-.5]);bitmap();color(0,0,1);typed('glRasterPos4dv',[-1,-.5,1,2]);bitmap();readPixel(2,3,[0,255,0,255],'farther raster bitmap fails depth');
 typed('glRasterPos3sv',[-1,0,2]);bitmap();readPixel(2,3,[0,255,0,255],'clipped bitmap cannot write');call('glDisable',[0xb71]);
 // Isolated directional diffuse: material is green, N.z=.5. The raster
 // color must be computed now and survive later normal/material/light changes.
 const vector=e.guest_alloc(16)>>>0,lightVec=a=>write(vector,bytes(a,'f'));
 lightVec([0,0,1,0]);call('glLightfv',[0x4000,0x1203,vector]);lightVec([1,1,1,1]);call('glLightfv',[0x4000,0x1201,vector]);
 lightVec([0,0,0,1]);call('glLightModelfv',[0xb53,vector]);call('glMaterialfv',[0x408,0x1200,vector]);call('glMaterialfv',[0x408,0x1600,vector]);
 lightVec([0,1,0,1]);call('glMaterialfv',[0x408,0x1201,vector]);call('glEnable',[0xb50]);call('glEnable',[0x4000]);call('glDisable',[0xb57]);
 call('glEnable',[0xc11]);call('glScissor',[0,0,1,1]);
 call('glNormal3f',[0,0,f(.5)]);color(1,0,0);typed('glRasterPos3dv',[-.5,-.25,0]);check(0xb04,[0,.5,0,1],'lit raster color uses material and current normal');
 check(0xb00,[1,0,0,1],'lit raster does not mutate current color');check(0xb02,[0,0,.5],'raster inverse transpose does not mutate current normal');
 assert.strictEqual(call('glIsEnabled',[0xc11]),1,'raster lighting preserves fragment capabilities');call('glDisable',[0xc11]);

 call('glNormal3f',[0,0,f(1)]);lightVec([1,0,0,1]);call('glMaterialfv',[0x408,0x1201,vector]);call('glDisable',[0x4000]);bitmap();readPixel(2,3,[0,128,0,255],'lit raster color snapshot pixel');
 call('glEnable',[0x4000]);lightVec([0,1,0,1]);call('glMaterialfv',[0x408,0x1201,vector]);call('glNormal3f',[0,0,f(.5)]);call('glMatrixMode',[0x1700]);call('glScalef',[f(1),f(1),f(2)]);
 typed('glRasterPos3dv',[-.5,-.25,0]);check(0xb04,[0,.25,0,1],'inverse transpose raster normal');bitmap();readPixel(2,3,[0,64,0,255],'inverse transpose raster lighting pixel');
 load(0x1700,[1,0,0,0,0,1,0,0,0,0,1,.5,0,0,.25,1]);
 typed('glRasterPos3dv',[-.5,-.25,0]);check(0xb04,[0,.5714285969734192,0,1],'full inverse transpose under non-affine modelview');
 bitmap();readPixel(2,3,[0,146,0,255],'non-affine modelview lit raster pixel');
 call('glMatrixMode',[0x1700]);call('glLoadIdentity');call('glScalef',[f(1),f(1),f(2)]);
 call('glEnable',[0xba1]);typed('glRasterPos3dv',[-.5,-.25,0]);check(0xb04,[0,1,0,1],'raster lighting GL_NORMALIZE');call('glDisable',[0xba1]);identity(0x1700);
 call('glEnable',[0xb57]);color(.25,.5,.75,.5);call('glNormal3f',[0,0,f(1)]);seed();check(0xb04,[.25,.5,.75,.5],'raster COLOR_MATERIAL contract');
 call('glDisable',[0xb57]);call('glDisable',[0xb50]);
 // Texture coordinates are captured even with texturing disabled. Changing
 // the current coordinate and texture matrix after RasterPos cannot move its sample.
 call('glActiveTextureARB',[0x84c0]);identity(0x1702);color(1,1,1);
 const texels=e.guest_alloc(8)>>>0;write(texels,Buffer.from([0,0,255,255,255,255,0,255]));
 call('glBindTexture',[0xde1,37]);call('glTexImage2D',[0xde1,0,0x1908,2,1,0,0x1908,0x1401,texels]);
 call('glTexParameteri',[0xde1,0x2800,0x2600]);call('glTexParameteri',[0xde1,0x2801,0x2600]);call('glTexEnvi',[0x2300,0x2200,0x1e01]);
 call('glTexCoord4f',[f(1.5),f(1),0,f(2)]);typed('glRasterPos3dv',[-.5,-.25,0]);check(0xb06,[1.5,1,0,2],'bitmap homogeneous texture capture');
 call('glTexCoord2f',[0,0]);call('glMatrixMode',[0x1702]);call('glTranslatef',[f(.5),0,0]);call('glEnable',[0xde1]);
 bitmap();readPixel(2,3,[255,255,0,255],'bitmap captured S/Q samples yellow once');call('glDisable',[0xde1]);identity(0x1702);
 // Default eye-linear S/T planes, explicit object/eye planes, independent
 // enables and two units are part of vertex-equivalent raster texgen.
 call('glTexCoord4f',[f(.9),f(.8),f(.7),f(2)]);call('glEnable',[0xc60]);call('glEnable',[0xc61]);
 typed('glRasterPos4dv',[-.5,-.25,0,2]);check(0xb06,[-.5,-.25,Math.fround(.7),2],'default eye-linear planes');check(0xb03,[Math.fround(.9),Math.fround(.8),Math.fround(.7),2],'raster texgen does not mutate current texture');
 lightVec([2,0,0,1]);call('glTexGenfv',[0x2000,0x2501,vector]);call('glTexGeni',[0x2000,0x2500,0x2401]);
 typed('glRasterPos4dv',[-.5,-.25,0,2]);check(0xb06,[1,-.25,Math.fround(.7),2],'object-linear uses homogeneous object w');
 call('glMatrixMode',[0x1700]);call('glTranslatef',[f(.25),0,0]);lightVec([1,0,0,0]);call('glTexGenfv',[0x2000,0x2502,vector]);
 call('glTexGenf',[0x2000,0x2500,f(0x2400)]);identity(0x1700);call('glTranslatef',[f(.5),0,0]);
 typed('glRasterPos4dv',[-.5,-.25,0,2]);check(0xb06,[0,-.25,Math.fround(.7),2],'eye plane captured through inverse modelview');identity(0x1700);
 call('glPushAttrib',[0x40000]);call('glDisable',[0xc60]);call('glTexGeni',[0x2001,0x2500,0x2401]);call('glPopAttrib');
 typed('glRasterPos4dv',[-.5,-.25,0,2]);check(0xb06,[-1,-.25,Math.fround(.7),2],'TEXTURE_BIT restores texgen planes modes enables');
 call('wglMakeCurrent',[dc,fresh]);call('glViewport',[0,0,8,8]);call('glEnable',[0xc60]);call('glEnable',[0xc61]);
 typed('glRasterPos4dv',[-.5,-.25,0,2]);check(0xb06,[-.5,-.25,0,1],'new context owns default eye planes and current texture');
 call('wglMakeCurrent',[dc,context]);check(0xb06,[-1,-.25,Math.fround(.7),2],'context switch restores raster texture and texgen');
 for(const mode of [0x1300,0x1301]){call('glTexGeni',[0x2000,0x2500,0x2401]);lightVec([2,0,0,1]);
  const list=call('glGenLists',[1]);call('glNewList',[list,mode]);call('glTexGenfv',[0x2000,0x2501,vector]);typed('glRasterPos4dv',[-.5,-.25,0,2]);call('glEndList');
  lightVec([99,98,97,96]);call('glCallList',[list]);check(0xb06,[1,-.25,Math.fround(.7),2],'list owns texgen plane values '+mode);
 }
 call('glTexGeni',[0x2000,0x2500,0x2400]);typed('glRasterPos4dv',[-.5,-.25,0,2]);
 call('glActiveTextureARB',[0x84c1]);call('glTexGeni',[0x2000,0x2500,0x2401]);call('glEnable',[0xc60]);
 typed('glRasterPos4dv',[-.5,-.25,0,2]);check(0xb06,[1.5,.25,.75,2],'unit-one texgen and matrix independent');call('glDisable',[0xc60]);
 call('glActiveTextureARB',[0x84c0]);check(0xb06,[-1,-.25,Math.fround(.7),2],'unit-zero texgen remains isolated');
 call('glDisable',[0xc60]);call('glDisable',[0xc61]);
 // A single enabled sphere coordinate is generated, with the other preserved.
 call('glNormal3f',[f(.577),f(.577),f(.577)]);call('glTexCoord4f',[f(.1),f(.25),0,f(1)]);
 call('glTexGeni',[0x2000,0x2500,0x2402]);call('glEnable',[0xc60]);typed('glRasterPos3dv',[0,0,-.5]);
 const sphere=get(0xb06);assert(sphere[0]>.78&&sphere[0]<.80);assert.strictEqual(sphere[1],.25);checks++;
 call('glDisable',[0xc60]);call('glTexGeni',[0x2000,0x2500,0x2400]);
 // Fog consumes the captured Euclidean eye distance at draw time. Here x=.5,
 // y=0,z=0 gives distance .5 while |z|=0 and clip w=1 would disagree.
 color(1,0,0,.5);typed('glRasterPos3dv',[.5,0,0]);check(0xb09,[.5],'captured bitmap fog distance');
 lightVec([0,0,1,0]);call('glFogfv',[0xb66,vector]);call('glFogi',[0xb65,0x2601]);call('glFogf',[0xb63,0]);call('glFogf',[0xb64,f(1)]);call('glEnable',[0xb60]);
 // The software fragment lerp truncates 255 * .5 to 127 in RGB; alpha stays128.
 bitmap();readPixel(6,4,[127,0,127,128],'bitmap fog uses captured Euclidean distance and preserves raster alpha');call('glDisable',[0xb60]);
 if(queued){encoder.fence();assert(encoder.snapshot().glQueued>0,'real queue used');}
 // Native raster lighting also runs when software rasterization is off,
 // as it is for the WebGL frontend. It must use native context capabilities.
 e.gl_sw_set_enabled(0);identity(0x1700);call('glNormal3f',[0,0,f(1)]);
 lightVec([0,1,0,1]);call('glMaterialfv',[0x408,0x1201,vector]);
 call('glEnable',[0x4000]);call('glEnable',[0xb50]);color(1,0,0);
 typed('glRasterPos4dv',[0,0,0,1]);check(0xb04,[0,1,0,1],'native raster lighting with software backend disabled');
 assert.strictEqual(e.gl_sw_enabled(),0,'raster capture cannot enable a backend');
 assert.strictEqual(call('glGetError'),0);
 const result={passed:true,route:queued?'queued':'direct',aliases:23,checks,observations};
 if(process.env.GL_RASTER_POSITION_EVIDENCE)fs.writeFileSync(process.env.GL_RASTER_POSITION_EVIDENCE,JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
 } finally {if(encoder)encoder.stop();if(manager)await manager.stop();if(render)render.destroy();}
})().catch(error=>{console.error(error.stack||error);process.exit(1);});
