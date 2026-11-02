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
 const queued=process.argv.includes('--worker'),mutation=process.env.GL_TYPED_TEXCOORD_MUTATION,baseline=process.env.GL_TYPED_TEXCOORD_BASELINE;
 let prebuiltModule;
 if(mutation||baseline){let changed=false;
  const bytes=req('test/compile-src').compileSrcWasm((file,source)=>{
   if(file==='13-exports.wat')return source+extraWat;
   if(baseline&&['09a8b-handlers-opengl.wat','09a8e-gl-state.wat','09b2-dispatch-table.generated.wat'].includes(file)){changed=true;return fs.readFileSync(path.join(baseline,file),'utf8');}
   if(baseline)return source;
   const edits={
    attrib:['09a8e-gl-state.wat','(if (i32.and (i32.load offset=68 (local.get $p)) (i32.const 1)) (then\n          (global.set $gl_tex_s','(if (i32.const 1) (then\n          (global.set $gl_tex_s'],
    stride:['09a8b-handlers-opengl.wat','(then (i32.const 8)) (else (i32.const 4))))','(then (i32.const 4)) (else (i32.const 4))))'],
    signed:['09a8b-handlers-opengl.wat','(f32.convert_i32_s (call $gl32 (local.get $p))))','(f32.convert_i32_u (call $gl32 (local.get $p))))'],
    normalized:['09a8b-handlers-opengl.wat','(f32.convert_i32_s (call $gl32 (local.get $p))))','(f32.div (f32.convert_i32_s (call $gl32 (local.get $p))) (f32.const 2147483647)))'],
    defaults:['09a8b-handlers-opengl.wat','(local.set $q (f32.const 1))','(local.set $q (f32.const 0))'],
    dimensions:['09a8b-handlers-opengl.wat','(i32.ge_u (local.get $components) (i32.const 3))','(i32.ge_u (local.get $components) (i32.const 4))'],
    list:['09a8b-handlers-opengl.wat','(drop (call $gl_wat_encode_call (i32.const 120) (local.get $stack) (i32.const 0)))','(drop (call $gl_state_intercept (i32.const 120) (local.get $stack)))'],
    projective:['09a8g-gl-raster.wat','(f32.store (local.get $qp) (call $gl_sw_mtx_row (local.get $m) (i32.const 12)\n      (local.get $s) (local.get $t) (local.get $r) (local.get $q)))','(f32.store (local.get $qp) (f32.const 1))'],
    conversion:['09a8b-handlers-opengl.wat','(f32.demote_f64 (f64.reinterpret_i64 (call $gl64 (local.get $p))))','(f32.reinterpret_i32 (call $gl32 (local.get $p)))'],
   };
   if(!edits[mutation])throw Error('unknown mutation '+mutation);
   const [target,from,to]=edits[mutation];if(file!==target)return source;
   // Component-reader mutations and family-adapter mutations are bounded to
   // their own function region so unrelated callers retain production source.
   const start=source.indexOf(mutation==='projective'?'(func $gl_sw_tex_transform_homogeneous ':mutation==='attrib'?'(func $gl_state_intercept ':mutation==='signed'||mutation==='normalized'||mutation==='conversion'?'(func $gl_rect_component ':'(func $handle_glTexCoord_typed ');
   assert(start>=0,'mutation function exists');const body=source.slice(start);assert(body.includes(from),'mutation anchor '+mutation);
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
 const names=`glTexCoord1d glTexCoord1dv glTexCoord1f glTexCoord1fv glTexCoord1i glTexCoord1iv glTexCoord1s glTexCoord1sv
 glTexCoord2iv glTexCoord2s glTexCoord2sv
 glTexCoord3d glTexCoord3dv glTexCoord3f glTexCoord3fv glTexCoord3i glTexCoord3iv glTexCoord3s glTexCoord3sv
 glTexCoord4d glTexCoord4dv glTexCoord4i glTexCoord4iv glTexCoord4s glTexCoord4sv`.trim().split(/\s+/);
 const metadata=name=>{const [,n,kind,v]=/^glTexCoord([1234])([dfis])(v?)$/.exec(name);return {n:+n,kind,vector:!!v};};
 const vec=e.guest_alloc(80)>>>0,query=e.guest_alloc(48)>>>0;
 const bytes=(values,kind,scalar=false)=>{const width=kind==='d'?8:kind==='s'&&!scalar?2:4,b=Buffer.alloc(width*values.length);
  values.forEach((v,i)=>{if(kind==='d')b.writeDoubleLE(v,i*width);else if(kind==='f')b.writeFloatLE(v,i*width);
   else if(kind==='s'&&!scalar)b.writeInt16LE(v,i*width);else b.writeInt32LE(v|0,i*width);});return b;};
 const write=(p,b)=>{for(let i=0;i<b.length;i++)dv.setUint8(wa(p+i),b[i]);};
 const words=b=>Array.from({length:b.length/4},(_,i)=>b.readUInt32LE(i*4));
 const typed=(name,values,p=vec)=>{const m=metadata(name);assert.strictEqual(values.length,m.n);
  if(m.vector){write(p,bytes(values,m.kind));return call(name,[p]);}return call(name,words(bytes(values,m.kind,true)));};
 const current=(expected,label,unit=0)=>{
  call('glActiveTextureARB',[0x84c0+unit]);new Uint8Array(memory.buffer,wa(query),48).fill(0xa7);
  call('glGetFloatv',[0xb03,query+8]);const got=Array.from({length:4},(_,i)=>dv.getFloat32(wa(query+8+i*4),true));
  assert.deepStrictEqual(got,expected,label);assert.deepStrictEqual(Array.from(new Uint8Array(memory.buffer,wa(query),8)),Array(8).fill(0xa7));
  assert.deepStrictEqual(Array.from(new Uint8Array(memory.buffer,wa(query+24),24)),Array(24).fill(0xa7));
  observations.push({label,actual:got,expected});checks++;
 };
 const seed=()=>call('glTexCoord4f',[9,8,7,6].map(f));
 const unit1=[-.25,.5,-.75,2];call('glMultiTexCoord4fARB',[0x84c1,...unit1.map(f)]);
 // Independent literal four-component expectations: no production conversion
 // helper, renderer, or API-availability predicate computes these values.
 const samples={
  d:[[-1.25,Math.PI,1.000000059604645,-0],[-1.25,3.1415927410125732,1.0000001192092896,-0]],
  f:[[-.25,.75,-2.5,4],[-.25,.75,-2.5,4]],
  i:[[-2147483648,2147483647,-17,123456789],[-2147483648,2147483648,-17,123456792]],
  s:[[-32768,32767,-17,12345],[-32768,32767,-17,12345]]
 };
 const full=(a,n)=>n===1?[a[0],0,0,1]:n===2?[a[0],a[1],0,1]:n===3?[a[0],a[1],a[2],1]:a;
 for(const name of names){const {n,kind}=metadata(name),[input,want]=samples[kind];
  assert(call('wglGetProcAddress',[str(name)]),'WGL real availability '+name);seed();call('glActiveTextureARB',[0x84c1]);
  typed(name,input.slice(0,n));current(unit1,'unit one preserved '+name,1);current(full(want,n),name+' signed/default/f64 literal');
 }
 call('glTexCoord4s',[0x12348000,0x56787fff,0x3141ffff,0x27180011]);current([-32768,32767,-1,17],'scalar shorts ignore high padding bits');
 // Negative zero and f64 values adjacent to f32 rounding ties, with finite
 // under/overflow: native doubles are not read as floats or truncated ints.
 for(const [name,input,want] of [
  ['glTexCoord4dv',[-0,1e-300,1e300,1.0000000596046448],[-0,0,Infinity,1]],
  ['glTexCoord4d',[1.000000059604645,-1e-300,-1e300,0.10000000000000002],[1.0000001192092896,-0,-Infinity,0.10000000149011612]],
  ['glTexCoord4iv',[0,1,-1,16777217],[0,1,-1,16777216]],
  ['glTexCoord4sv',[0,1,-1,17],[0,1,-1,17]],
  ['glTexCoord4dv',[NaN,Infinity,-Infinity,-0],[NaN,Infinity,-Infinity,-0]],
 ]){typed(name,input);current(want,name+' explicit conversion boundary');}
 // Real sparse backing: adjacent guest pages map to physically separated
 // pages because an unrelated committed guest page was allocated between them.
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
 for(const name of names){const {n,kind}=metadata(name),[input,want]=samples[kind];seed();sparse(name,input.slice(0,n));current(full(want,n),'actual sparse stack/vector '+name);}
 sparse('glTexCoord1sv',[-32768],0x60000ff9,0x63000fff);current([-32768,0,0,1],'split single short vector');
 sparse('glTexCoord4s',[-32768,32767,-1,17],0x60000ffb);current([-32768,32767,-1,17],'split low short in scalar slot');
 // A pointer word split between the two real sparse pages is independently
 // translated as well as the pointed-to elements.
 sparse('glTexCoord4dv',[1.25,-2.5,3.75,4],0x60000ffa);current([1.25,-2.5,3.75,4],'split pointer slot');
 // Faults trap before current attributes, display-list record, EAX or ESP
 // can change. Exercise the first and last vector pages, pointer slot and wrap.
 assert(e.test_virtual_map_commit(0x65000000,4096));assert.strictEqual(wa(0x65001000),240);
 const seedLiteral=[9,8,7,6];
 function bad(name,at,args,label,seedBefore=true){if(seedBefore)seed();const thunk=resolve(name);if(args)write(at+4,bytes(args,'i',true));
  for(let i=0;i<8;i++)dv.setUint32(regs+i*4,0x55660000+i,true);dv.setUint32(regs+16,at,true);dv.setUint32(regs,0xdeadbeef,true);
  const used=e.gl_wat_stream_used(),vertices=e.probe_count();
  assert.throws(()=>e.probe_invoke(thunk),WebAssembly.RuntimeError,label);assert.strictEqual(dv.getUint32(regs+16,true),at,label+' ESP');assert.strictEqual(dv.getUint32(regs,true),0xdeadbeef,label+' EAX');
  for(let i=1;i<8;i++)if(i!==4)assert.strictEqual(dv.getUint32(regs+i*4,true),0x55660000+i,label+' GPR');
  assert.strictEqual(e.gl_wat_stream_used(),used,label+' no command');assert.strictEqual(e.probe_count(),vertices,label+' no vertex');
  current(seedLiteral,label+' atomic');
 }
 for(const name of names.filter(x=>x.endsWith('v'))){const {n,kind}=metadata(name),size=n*(kind==='d'?8:kind==='s'?2:4);
  bad(name,stack,[0x65001000],'missing first vector '+name);
  if(size>1)bad(name,stack,[0x65001000-size+1],'missing final vector '+name);
  bad(name,stack,[0xffffffff],'wrapping vector '+name);
 }
 bad('glTexCoord4dv',0x65000ffa,null,'missing pointer word tail');
 bad('glTexCoord4d',0x65000fe0,null,'missing scalar final double');
 bad('glTexCoord4d',0xffffffec,null,'wrapping scalar stack');
 bad('glTexCoord1sv',0xfffffffc,null,'wrapping pointer frame');
 assert(new Uint8Array(memory.buffer,wa(0x61000000),4096).every(x=>x===0x7f),'interposed stack page untouched');
 assert(new Uint8Array(memory.buffer,wa(0x64000000),4096).every(x=>x===0x7e),'interposed vector page untouched');
 // Context storage, default initialization, attribute-stack masks and deletion.
 typed('glTexCoord4sv',[-3,5,-7,9]);const context2=call('wglCreateContext',[dc]);assert(context2);
 call('wglMakeCurrent',[dc,context2]);current([0,0,0,1],'new context default');typed('glTexCoord3d',[1.25,-2.5,3.75]);
 call('wglMakeCurrent',[dc,context]);current([-3,5,-7,9],'original context restored');
 call('glPushAttrib',[1]);typed('glTexCoord1iv',[-17]);call('glMultiTexCoord4fARB',[0x84c1,...[3,4,5,6].map(f)]);call('glPopAttrib');current([-3,5,-7,9],'CURRENT_BIT restores all four');current(unit1,'CURRENT_BIT restores unit one',1);call('glActiveTextureARB',[0x84c0]);
 call('glPushAttrib',[0x40000]);typed('glTexCoord2sv',[3,-4]);call('glPopAttrib');current([3,-4,0,1],'unrelated attrib leaves current');
 call('glPushAttrib',[0xfffff]);typed('glTexCoord4d',[1,2,3,4]);call('glPopAttrib');current([3,-4,0,1],'ALL_ATTRIB_BITS restores all four');
 call('wglMakeCurrent',[dc,context2]);current([1.25,-2.5,3.75,1],'second context restored');
 call('wglDeleteContext',[context]);const fresh=call('wglCreateContext',[dc]);assert(fresh);call('wglMakeCurrent',[dc,fresh]);current([0,0,0,1],'deleted context cannot leak values');
 // Every family is legal inside Begin and captures vertex attributes immediately.
 const packed=()=>{const p=e.probe_vertices(),n=e.probe_count();return Array.from(new Float32Array(memory.buffer,p+n*4-19*4,19));};
 for(const name of names){const {n,kind}=metadata(name),[input,want]=samples[kind];call('glBegin',[0]);typed(name,input.slice(0,n));call('glVertex3f',[0,0,0]);
  const vertex=packed();assert.deepStrictEqual([vertex[7],vertex[8],vertex[15],vertex[16]],full(want,n),'Begin packed current '+name);
  assert.deepStrictEqual([vertex[9],vertex[13],vertex[17],vertex[18]],[0,0,0,1],'fresh unit one default');call('glEnd');assert.strictEqual(call('glGetError'),0);checks++;}
 // Internal DrawArrays/DrawElements snapshots preserve all current texture
 // components while assembling vertices from client arrays. Primitive modes
 // zero and four are deliberately not GL_CURRENT_BIT masks.
 const positions=e.guest_alloc(40)>>>0,texArray=e.guest_alloc(56)>>>0,indices=e.guest_alloc(8)>>>0;
 write(positions,bytes([0,0,-.5,-.5,.5,-.5],'f'));write(texArray,bytes([1,2,3,4,5,6,7,8,9,10,11,12],'f'));write(indices,Buffer.from([0,0,1,0,2,0]));
 call('glVertexPointer',[2,0x1406,0,positions]);call('glTexCoordPointer',[4,0x1406,0,texArray]);call('glEnableClientState',[0x8074]);call('glEnableClientState',[0x8078]);
 typed('glTexCoord4sv',[-3,5,-7,9]);call('glDrawArrays',[0,0,1]);current([-3,5,-7,9],'internal point array preserves typed current');
 call('glDrawElements',[4,3,0x1403,indices]);current([-3,5,-7,9],'internal triangle elements preserve typed current');
 call('glDisableClientState',[0x8074]);call('glDisableClientState',[0x8078]);
 // Compile and compile-and-execute for every family. Overwrite both vector and
 // scalar source storage and reuse the adapter allocation before list replay.
 const snapshotList=[];
 for(const name of names)for(const mode of [0x1300,0x1301]){const {n,kind}=metadata(name),[input,want]=samples[kind];seed();const id=call('glGenLists',[1]);
  call('glNewList',[id,mode]);typed(name,input.slice(0,n));call('glEndList');current(mode===0x1300?seedLiteral:full(want,n),'list timing '+name+'/'+mode);
  write(vec,Buffer.alloc(80,0x5e));typed('glTexCoord4d',[44,33,22,11]);call('glCallList',[id]);current(full(want,n),'list captured values '+name+'/'+mode);snapshotList.push(id);
 }
 const nested=call('glGenLists',[1]);call('glNewList',[nested,0x1300]);call('glCallList',[snapshotList[0]]);call('glEndList');seed();call('glCallList',[nested]);current([-1.25,0,0,1],'nested typed list');
 call('glBegin',[0]);call('glCallList',[snapshotList[0]]);call('glVertex3f',[0,0,0]);const listedVertex=packed();assert.deepStrictEqual([listedVertex[7],listedVertex[8],listedVertex[15],listedVertex[16]],[-1.25,0,0,1],'list replay legal inside Begin');call('glEnd');assert.strictEqual(call('glGetError'),0);checks++;
 // A malformed source during compilation cannot add a partial current command.
 seed();const atomicList=call('glGenLists',[1]);call('glNewList',[atomicList,0x1300]);typed('glTexCoord4sv',[1,2,3,4]);bad('glTexCoord4dv',stack,[0x65000ff9],'bad vector list',false);call('glEndList');
 seed();call('glCallList',[atomicList]);current([1,2,3,4],'bad vector list record atomic');
 // Independently expected projective textured pixels, through real resolved
 // stdcall setters and production renderer/readback. 8x8 red|blue texture:
 // s=3x, q=1+2x gives s/q=1/2 at x=1/4, so literal RRBBBBBB.
 call('glViewport',[0,0,8,8]);call('glDrawBuffer',[0x405]);call('glReadBuffer',[0x405]);call('glPixelStorei',[0xd05,1]);call('glPixelStorei',[0xcf5,1]);
 call('glActiveTextureARB',[0x84c0]);call('glMatrixMode',[0x1700]);call('glLoadIdentity');call('glMatrixMode',[0x1701]);call('glLoadIdentity');call('glMatrixMode',[0x1702]);call('glLoadIdentity');
 call('glBindTexture',[0xde1,17]);call('glTexParameteri',[0xde1,0x2800,0x2600]);call('glTexParameteri',[0xde1,0x2801,0x2600]);
 const tex=e.guest_alloc(8)>>>0;write(tex,Buffer.from([255,0,0,0,0,255]));call('glTexImage2D',[0xde1,0,0x1907,2,1,0,0x1907,0x1401,tex]);call('glEnable',[0xde1]);call('glTexEnvi',[0x2300,0x2200,0x1e01]);
 const output=e.guest_alloc(264)>>>0,pix=new Uint8Array(memory.buffer,wa(output),264);
 function pixels(row,label){call('glFinish');if(encoder)encoder.fence();pix.fill(0xa7);call('glReadPixels',[0,0,8,8,0x1908,0x1401,output+4]);
  const red=[255,0,0,255],blue=[0,0,255,255],want=Array.from({length:8},()=>[...row].flatMap(c=>c==='R'?red:blue)).flat();
  assert.deepStrictEqual([...pix.slice(0,4)],Array(4).fill(167));assert.deepStrictEqual([...pix.slice(260)],Array(4).fill(167));
  assert.deepStrictEqual([...pix.slice(4,260)],want,label);observations.push({label,row,rgba:[...pix.slice(4,260)]});checks++;
 }
 const quad=(name,left,right)=>{call('glBegin',[7]);for(const [x,y] of [[-1,-1],[1,-1],[1,1],[-1,1]]){typed(name,x<0?left:right);call('glVertex2f',[f(x),f(y)]);}call('glEnd');};
 for(const name of ['glTexCoord4d','glTexCoord4dv','glTexCoord4i','glTexCoord4iv','glTexCoord4s','glTexCoord4sv']){
  call('glClearColor',[0,0,0,f(1)]);call('glClear',[0x4000]);quad(name,[0,0,0,1],[3,0,0,3]);pixels('RRBBBBBB','literal projective '+name);
 }
 // r participates in the texture matrix; a 3-component setter resets q to one.
 const matrix=e.guest_alloc(64)>>>0;write(matrix,bytes([1,0,0,0,0,1,0,0,1,0,1,0,0,0,0,1],'f'));call('glLoadMatrixf',[matrix]);
 quad('glTexCoord4dv',[0,0,0,1],[0,0,3,3]);pixels('RRBBBBBB','literal r and q projective');
 for(const name of ['glTexCoord3d','glTexCoord3dv','glTexCoord3f','glTexCoord3fv','glTexCoord3i','glTexCoord3iv','glTexCoord3s','glTexCoord3sv']){
  typed('glTexCoord4dv',[0,0,0,7]);quad(name,[0,0,0],[0,0,1]);pixels('RRRRBBBB','literal r plus default q '+name);
 }
 call('glLoadIdentity');
 for(const name of ['glTexCoord1d','glTexCoord1dv','glTexCoord1f','glTexCoord1fv','glTexCoord1i','glTexCoord1iv','glTexCoord1s','glTexCoord1sv']){
  typed('glTexCoord4dv',[0,0,0,7]);quad(name,[0],[1]);pixels('RRRRBBBB','literal 1D dimensional defaults '+name);
 }
 for(const name of ['glTexCoord2iv','glTexCoord2s','glTexCoord2sv']){typed('glTexCoord4dv',[0,0,0,7]);quad(name,[0,0],[1,0]);pixels('RRRRBBBB','literal 2D dimensional defaults '+name);}
 for(const mode of [0x1300,0x1301]){const id=call('glGenLists',[1]);call('glNewList',[id,mode]);quad('glTexCoord4dv',[0,0,0,1],[3,0,0,3]);call('glEndList');write(vec,Buffer.alloc(80,0x57));
  call('glClear',[0x4000]);call('glCallList',[id]);pixels('RRBBBBBB','literal list projective '+mode);}
 for(const name of ['glGetBooleanv','glTexParameteriv','glGetMapiv']){assert.strictEqual(call('wglGetProcAddress',[str(name)]),0,'unsupported control '+name);assert.strictEqual(resolve(name),0,'static unsupported control '+name);checks++;}
 assert.strictEqual(call('glGetError'),0);if(encoder){encoder.fence();assert(encoder.snapshot().glQueued>0,'actual queue used');}
 call('wglDeleteContext',[context2]);call('wglDeleteContext',[fresh]);
 const result={passed:true,route:queued?'queued':'direct',checks,missingImplemented:names.length,mutation:mutation||null,observations};
 if(process.env.GL_TYPED_TEXCOORD_EVIDENCE)fs.writeFileSync(process.env.GL_TYPED_TEXCOORD_EVIDENCE,JSON.stringify(result,null,2));console.log(JSON.stringify({...result,observations:observations.length}));
 }finally{if(encoder)encoder.stop();if(manager)await manager.stop();if(render)render.destroy();}
})().catch(e=>{console.error(e);process.exitCode=1;});
