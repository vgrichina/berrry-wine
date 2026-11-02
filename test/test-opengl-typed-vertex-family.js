'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),req=p=>require(path.join(root,p));
const {bootRenderHarness}=req('test/render-helper');
const {OpenGLHostBridge,CALL_INDEX:GL}=req('lib/gl-compat');
const Stream=req('lib/gl-command-stream');
const table=req('src/api_table.json');
const extraWat=`
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
 const queued=process.argv.includes('--worker'),mutation=process.env.GL_TYPED_VERTEX_MUTATION,baseline=process.env.GL_TYPED_VERTEX_BASELINE;
 let prebuiltModule;
 if(mutation||baseline){let changed=false;
  const bytes=req('test/compile-src').compileSrcWasm((file,source)=>{
   if(file==='13-exports.wat')return source+extraWat;
   if(baseline&&['09a8b-handlers-opengl.wat','09b2-dispatch-table.generated.wat'].includes(file)){changed=true;return fs.readFileSync(path.join(baseline,file),'utf8');}
   if(baseline)return source;
   const edits={
    stride:['09a8b-handlers-opengl.wat','(then (i32.const 8)) (else (i32.const 4))))','(then (i32.const 4)) (else (i32.const 4))))'],
    signed:['09a8b-handlers-opengl.wat','(f32.convert_i32_s (call $gl32 (local.get $p))))','(f32.convert_i32_u (call $gl32 (local.get $p))))'],
    normalized:['09a8b-handlers-opengl.wat','(f32.convert_i32_s (call $gl32 (local.get $p))))','(f32.div (f32.convert_i32_s (call $gl32 (local.get $p))) (f32.const 2147483647)))'],
    short:['09a8b-handlers-opengl.wat','(i32.shr_s (i32.shl (call $gl16 (local.get $p)) (i32.const 16)) (i32.const 16))','(call $gl16 (local.get $p))'],
    defaults:['09a8b-handlers-opengl.wat','(local.set $w (f32.const 1))','(local.set $w (f32.const 0))'],
    z:['09a8b-handlers-opengl.wat','(local $x f32) (local $y f32) (local $z f32) (local $w f32)','(local $x f32) (local $y f32) (local $z f32) (local $w f32)\n    (local.set $z (f32.const 1))'],
    dimensions:['09a8b-handlers-opengl.wat','(i32.ge_u (local.get $components) (i32.const 3))','(i32.ge_u (local.get $components) (i32.const 4))'],
    w:['09a8b-handlers-opengl.wat','(f32.store offset=16 (local.get $stack) (local.get $w))','(f32.store offset=16 (local.get $stack) (f32.const 1))'],
    list:['09a8b-handlers-opengl.wat','(drop (call $gl_wat_encode_call (i32.const 118) (local.get $stack) (i32.const 0)))','(drop (call $gl_state_intercept (i32.const 118) (local.get $stack)))'],
    conversion:['09a8b-handlers-opengl.wat','(f32.demote_f64 (f64.reinterpret_i64 (call $gl64 (local.get $p))))','(f32.reinterpret_i32 (call $gl32 (local.get $p)))'],
    attributes:['09a8c-gl-encoder.wat','(f32.store offset=12 (local.get $p) (global.get $gl_color_r))','(f32.store offset=12 (local.get $p) (f32.const 1))'],
   };
   if(!edits[mutation])throw Error('unknown mutation '+mutation);
   const [target,from,to]=edits[mutation];if(file!==target)return source;
   const component=['signed','normalized','short','conversion'].includes(mutation);
   const start=source.indexOf(mutation==='attributes'?'(func $gl_append_vertex4 ':component?'(func $gl_rect_component ':'(func $handle_glVertex_typed ');
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
 const names=`glVertex2iv glVertex2s glVertex2sv glVertex3dv glVertex3i glVertex3iv glVertex3s glVertex3sv
 glVertex4d glVertex4dv glVertex4i glVertex4iv glVertex4s glVertex4sv`.trim().split(/\s+/);
 const metadata=name=>{const [,n,kind,v]=/^glVertex([234])([dis])(v?)$/.exec(name);return {n:+n,kind,vector:!!v};};
 const vec=e.guest_alloc(80)>>>0,query=e.guest_alloc(48)>>>0;
 const bytes=(values,kind,scalar=false)=>{const width=kind==='d'?8:kind==='s'&&!scalar?2:4,b=Buffer.alloc(width*values.length);
  values.forEach((v,i)=>{if(kind==='d')b.writeDoubleLE(v,i*width);
   else if(kind==='s'&&!scalar)b.writeInt16LE(v,i*width);else b.writeInt32LE(v|0,i*width);});return b;};
 const write=(p,b)=>{for(let i=0;i<b.length;i++)dv.setUint8(wa(p+i),b[i]);};
 const read=(p,n)=>Buffer.from(Array.from({length:n},(_,i)=>dv.getUint8(wa(p+i))));
 const words=b=>Array.from({length:b.length/4},(_,i)=>b.readUInt32LE(i*4));
 const typed=(name,values,p=vec)=>{const m=metadata(name);assert.strictEqual(values.length,m.n);
  if(m.vector){write(p,bytes(values,m.kind));return call(name,[p]);}return call(name,words(bytes(values,m.kind,true)));};
 const attributes=[.25,.5,.75,1,.125,.25,-.25,.5,-.75,.375,.5];
 const seed=()=>{call('glColor4f',[.25,.5,.75,1].map(f));call('glNormal3f',[-.25,.5,-.75].map(f));
  call('glTexCoord4f',[.125,.25,.5,2].map(f));call('glMultiTexCoord4fARB',[0x84c1,...[.375,.5,.75,4].map(f)]);};
 seed();
 const packed=(index=-1)=>{const n=e.probe_count()/19;assert(n>0);if(index<0)index=n-1;
  return Array.from(new Float32Array(memory.buffer,e.probe_vertices()+index*76,19));};
 function expectVertex(want,label,index=-1){const v=packed(index),actual=[v[0],v[1],v[2],v[14]];
  assert.deepStrictEqual(actual,want,label+' position');assert.deepStrictEqual(v.slice(3,14),attributes,label+' current attributes');
  assert.deepStrictEqual(v.slice(15),[.5,2,.75,4],label+' homogeneous texture attributes');
  observations.push({label,actual,expected:want});checks++;
 }
 function current(label){for(const [pname,want] of [[0xb00,[.25,.5,.75,1]],[0xb02,[-.25,.5,-.75]],[0xb03,[.125,.25,.5,2]]]){
  new Uint8Array(memory.buffer,wa(query),48).fill(0xa7);call('glGetFloatv',[pname,query+8]);
  assert.deepStrictEqual(Array.from({length:want.length},(_,i)=>dv.getFloat32(wa(query+8+i*4),true)),want,label+' query '+pname);
  assert(read(query,8).every(x=>x===167));assert(read(query+8+want.length*4,40-want.length*4).every(x=>x===167));
 }checks++;}
 const samples={
  d:[[-1.25,Math.PI,1.000000059604645,-0],[-1.25,3.1415927410125732,1.0000001192092896,-0]],
  i:[[-2147483648,2147483647,-17,123456789],[-2147483648,2147483648,-17,123456792]],
  s:[[-32768,32767,-17,12345],[-32768,32767,-17,12345]]
 };
 const full=(a,n)=>n===2?[a[0],a[1],0,1]:n===3?[a[0],a[1],a[2],1]:a;
 for(const name of names){const {n,kind}=metadata(name),[input,want]=samples[kind];
  assert(call('wglGetProcAddress',[str(name)]),'WGL real availability '+name);call('glBegin',[0]);
  typed(name,input.slice(0,n));assert.strictEqual(e.probe_count(),19);expectVertex(full(want,n),name+' literal signed/default/f64');call('glEnd');current(name);
 }
 call('glBegin',[0]);call('glVertex4s',[0x12348000,0x56787fff,0x3141ffff,0x27180011]);expectVertex([-32768,32767,-1,17],'scalar shorts ignore high padding');call('glEnd');
 for(const [name,input,want] of [
  ['glVertex4dv',[-0,1e-300,1e300,1.0000000596046448],[-0,0,Infinity,1]],
  ['glVertex4d',[1.000000059604645,-1e-300,-1e300,0.10000000000000002],[1.0000001192092896,-0,-Infinity,0.10000000149011612]],
  ['glVertex4iv',[0,1,-1,16777217],[0,1,-1,16777216]],
  ['glVertex4sv',[0,1,-1,17],[0,1,-1,17]],
  ['glVertex4dv',[NaN,Infinity,-Infinity,-0],[NaN,Infinity,-Infinity,-0]],
 ]){call('glBegin',[0]);typed(name,input);expectVertex(want,name+' conversion boundary');call('glEnd');}
 // Outside Begin follows the canonical vertex path and contributes no vertex.
 for(const name of names){const {n,kind}=metadata(name);const count=e.probe_count();typed(name,samples[kind][0].slice(0,n));assert.strictEqual(e.probe_count(),count);assert.strictEqual(e.probe_mode(),-1);}
 assert.strictEqual(call('glGetError'),0);current('outside Begin');
 // Adjacent guest pages have nonadjacent physical backing, with untouched
 // interposed pages. Both vector elements and stack/pointer slots may split.
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
  assert.deepStrictEqual(read(at-8,frame.length),frame,'sparse frame canary '+name);if(vector)assert.deepStrictEqual(read(vectorAt-8,vb.length),vb,'vector canary '+name);
 }
 for(const name of names){const {n,kind}=metadata(name),[input,want]=samples[kind];call('glBegin',[0]);sparse(name,input.slice(0,n));expectVertex(full(want,n),'sparse stack/vector '+name);call('glEnd');}
 for(const [name,input,at,p] of [['glVertex2sv',[-32768,32767],0x60000ff9,0x63000fff],['glVertex4s',[-32768,32767,-1,17],0x60000ffb,0x63000ffd],['glVertex4dv',[1.25,-2.5,3.75,4],0x60000ffa,0x63000ffd]]){
  call('glBegin',[0]);sparse(name,input,at,p);expectVertex(full(input,metadata(name).n),'split element or pointer '+name);call('glEnd');
 }
 assert(e.test_virtual_map_commit(0x65000000,4096));assert.strictEqual(wa(0x65001000),240);
 function bad(name,at,args,label){const thunk=resolve(name);if(args)write(at+4,bytes(args,'i',true));
  for(let i=0;i<8;i++)dv.setUint32(regs+i*4,0x55660000+i,true);dv.setUint32(regs+16,at,true);dv.setUint32(regs,0xdeadbeef,true);
  const used=e.gl_wat_stream_used(),vertices=e.probe_count(),mode=e.probe_mode(),lists=e.probe_list_commands(),prior=Buffer.from(new Uint8Array(memory.buffer,e.probe_vertices(),vertices*4));
  const frame=at===stack?read(stack,256):null;
  assert.throws(()=>e.probe_invoke(thunk),WebAssembly.RuntimeError,label);assert.strictEqual(dv.getUint32(regs+16,true),at,label+' ESP');assert.strictEqual(dv.getUint32(regs,true),0xdeadbeef,label+' EAX');
  for(let i=1;i<8;i++)if(i!==4)assert.strictEqual(dv.getUint32(regs+i*4,true),0x55660000+i,label+' GPR');
  assert.strictEqual(e.gl_wat_stream_used(),used,label+' no command');assert.strictEqual(e.probe_count(),vertices,label+' no vertex');assert.strictEqual(e.probe_mode(),mode,label+' Begin');
  assert.strictEqual(e.probe_list_commands(),lists,label+' no list record');assert.deepStrictEqual(Buffer.from(new Uint8Array(memory.buffer,e.probe_vertices(),vertices*4)),prior,label+' prior vertices');
  if(frame)assert.deepStrictEqual(read(stack,256),frame,label+' frame canaries');checks++;
 }
 call('glBegin',[0]);typed('glVertex4sv',[1,2,3,4]);
 for(const name of names.filter(x=>x.endsWith('v'))){const {n,kind}=metadata(name),size=n*(kind==='d'?8:kind==='s'?2:4);
  bad(name,stack,[0x65001000],'missing first '+name);bad(name,stack,[0x65001000-size+1],'missing final '+name);bad(name,stack,[0xffffffff],'wrap '+name);
 }
 bad('glVertex4dv',0x65000ffa,null,'missing pointer slot tail');bad('glVertex4d',0x65000fe0,null,'missing last double');
 bad('glVertex4d',0xffffffec,null,'wrapping scalar stack');bad('glVertex2sv',0xfffffffc,null,'wrapping pointer frame');
 bad('glVertex3i',0x64fffffe,[0,0,0],'missing return word with readable arguments');
 for(const name of names.filter(x=>!x.endsWith('v'))){const {n,kind}=metadata(name),size=n*(kind==='d'?8:4);
  bad(name,0x65001000-size-3,null,'missing final scalar frame byte '+name);bad(name,0xfffffff8,null,'wrapping scalar frame '+name);
 }
 expectVertex([1,2,3,4],'prior vertex retained after malformed calls');call('glEnd');current('malformed atomic attrs');
 assert(new Uint8Array(memory.buffer,wa(0x61000000),4096).every(x=>x===0x7f));assert(new Uint8Array(memory.buffer,wa(0x64000000),4096).every(x=>x===0x7e));
 // All shapes capture values, with no pointer lifetime or synthetic-stack
 // dependency. Replay the vertex-only lists within the caller's Begin.
 const listIds=[];
 for(const name of names)for(const mode of [0x1300,0x1301]){const {n,kind}=metadata(name),[input,want]=samples[kind],id=call('glGenLists',[1]);
  const before=e.probe_count();call('glNewList',[id,mode]);typed(name,input.slice(0,n));call('glEndList');assert.strictEqual(e.probe_count(),before,'compile outside Begin');
  write(vec,Buffer.alloc(80,0x5e));typed('glVertex4d',[44,33,22,11]);
  call('glBegin',[0]);call('glCallList',[id]);assert.strictEqual(e.probe_count(),19,'one captured vertex '+name);expectVertex(full(want,n),'list value '+name+'/'+mode);call('glEnd');listIds.push(id);
 }
 const nested=call('glGenLists',[1]);call('glNewList',[nested,0x1300]);call('glCallList',[listIds[0]]);call('glEndList');call('glBegin',[0]);call('glCallList',[nested]);expectVertex([-2147483648,2147483648,0,1],'nested list vertex');call('glEnd');
 // A vertex-only list captures coordinates at compilation but takes current
 // attributes at replay. Both times are checked with different literal values.
 const lateAttrs=call('glGenLists',[1]);call('glNewList',[lateAttrs,0x1300]);typed('glVertex4dv',[1,2,3,4]);call('glEndList');write(vec,Buffer.alloc(80,0x55));
 call('glColor4f',[.75,.25,.5,1].map(f));call('glNormal3f',[1,0,0].map(f));call('glTexCoord4f',[2,3,4,5].map(f));call('glMultiTexCoord4fARB',[0x84c1,...[6,7,8,9].map(f)]);
 call('glBegin',[0]);call('glCallList',[lateAttrs]);const late=packed();assert.deepStrictEqual([late[0],late[1],late[2],late[14]],[1,2,3,4]);
 assert.deepStrictEqual(late.slice(3,14),[.75,.25,.5,1,2,3,1,0,0,6,7]);assert.deepStrictEqual(late.slice(15),[4,5,8,9]);call('glEnd');checks++;seed();
 for(const mode of [0x1300,0x1301]){const id=call('glGenLists',[1]);call('glNewList',[id,mode]);call('glBegin',[4]);typed('glVertex2sv',[-1,-1]);typed('glVertex3iv',[1,-1,0]);typed('glVertex4dv',[0,1,0,1]);call('glEnd');call('glEndList');
  assert.strictEqual(e.probe_mode(),-1);call('glCallList',[id]);assert.strictEqual(e.probe_mode(),-1);checks++;
 }
 for(const name of names)for(const mode of [0x1300,0x1301]){const {n,kind}=metadata(name),[input,want]=samples[kind],id=call('glGenLists',[1]),before=e.probe_count();
  call('glNewList',[id,mode]);call('glBegin',[0]);typed(name,input.slice(0,n));assert.strictEqual(e.probe_count(),mode===0x1300?before:19,'compile/execute timing '+name);
  if(mode===0x1301)expectVertex(full(want,n),'compile-and-execute immediate '+name);call('glEnd');call('glEndList');
 }
 const atomic=call('glGenLists',[1]);call('glNewList',[atomic,0x1300]);typed('glVertex4sv',[1,2,3,4]);bad('glVertex4dv',stack,[0x65000ff9],'malformed compilation');call('glEndList');
 call('glBegin',[0]);call('glCallList',[atomic]);assert.strictEqual(e.probe_count(),19);expectVertex([1,2,3,4],'malformed list atomic');call('glEnd');
 // Nested Begin must not terminate or reset an existing primitive.
 call('glBegin',[4]);typed('glVertex2sv',[-1,-1]);assert.throws(()=>call('glBegin',[0]),WebAssembly.RuntimeError);assert.strictEqual(e.probe_mode(),4);assert.strictEqual(e.probe_count(),19);
 typed('glVertex3iv',[1,-1,0]);typed('glVertex4sv',[0,1,0,1]);assert.strictEqual(e.probe_count(),57);call('glEnd');
 // Literal pixel expectations on an 8x8 software drawable. Position w=1|3
 // gives texture s = u/(3-2u); s=.5 at u=.75, hence RRRRRRBB.
 call('glViewport',[0,0,8,8]);call('glDrawBuffer',[0x405]);call('glReadBuffer',[0x405]);call('glPixelStorei',[0xd05,1]);call('glPixelStorei',[0xcf5,1]);
 call('glActiveTextureARB',[0x84c0]);call('glMatrixMode',[0x1700]);call('glLoadIdentity');call('glMatrixMode',[0x1701]);call('glLoadIdentity');call('glMatrixMode',[0x1702]);call('glLoadIdentity');
 call('glColor4f',[1,1,1,1].map(f));call('glClearColor',[0,0,0,f(1)]);
 const tex=e.guest_alloc(8)>>>0;write(tex,Buffer.from([255,0,0,0,0,255]));
 call('glBindTexture',[0xde1,17]);call('glTexParameteri',[0xde1,0x2800,0x2600]);call('glTexParameteri',[0xde1,0x2801,0x2600]);call('glTexImage2D',[0xde1,0,0x1907,2,1,0,0x1907,0x1401,tex]);call('glEnable',[0xde1]);call('glTexEnvi',[0x2300,0x2200,0x1e01]);
 const output=e.guest_alloc(264)>>>0,pix=new Uint8Array(memory.buffer,wa(output),264),palette={R:[255,0,0,255],B:[0,0,255,255],K:[0,0,0,255],G:[0,255,0,255]};
 function pixels(rows,label){call('glFinish');if(encoder)encoder.fence();pix.fill(0xa7);call('glReadPixels',[0,0,8,8,0x1908,0x1401,output+4]);
  const want=rows.flatMap(row=>[...row].flatMap(c=>palette[c]));assert.strictEqual(want.length,256);
  assert.deepStrictEqual([...pix.slice(0,4)],Array(4).fill(167));assert.deepStrictEqual([...pix.slice(260)],Array(4).fill(167));
  if(Buffer.compare(Buffer.from(pix.slice(4,260)),Buffer.from(want))!==0)console.error('PIXEL_DIAGNOSTIC',label,Array.from({length:8},(_,y)=>Array.from({length:8},(_,x)=>{const c=[...pix.slice(4+(y*8+x)*4,8+(y*8+x)*4)];return Object.keys(palette).find(k=>palette[k].every((v,i)=>v===c[i]))||'?';}).join('')));
  assert.deepStrictEqual([...pix.slice(4,260)],want,label);
  observations.push({label,rows,rgba:[...pix.slice(4,260)]});checks++;
 }
 const quad=(name,wl=1,wr=3,zl=0,zr=0,sr=1)=>{const n=metadata(name).n;call('glBegin',[7]);for(const [x,y] of [[-1,-1],[1,-1],[1,1],[-1,1]]){
  const w=x<0?wl:wr;call('glTexCoord2f',[f(x<0?0:sr),f(.5)]);typed(name,[x*w,y*w,(x<0?zl:zr)*w,w].slice(0,n));}call('glEnd');};
 for(const name of names.filter(x=>metadata(x).n===4)){
  call('glClear',[0x4000]);quad(name);pixels(Array(8).fill('RRRRRRBB'),'literal projective '+name);
  call('glClear',[0x4000]);quad(name,2,2);pixels(Array(8).fill('RRRRBBBB'),'literal homogeneous scale '+name);
  // Near/far signed clip distances -1|3 cut at u=.25. Constant red
  // isolates strict clipped coverage; varying-w texture interpolation is
  // independently checked above, without clipped scanline UV quantization.
  for(const z of [-1.5,1.5]){call('glClear',[0x4000]);quad(name,2,2,z,-z/3,0);pixels(Array(8).fill('KKRRRRRR'),'literal clipped homogeneous '+name+'/'+z);}
 }
 // Every two/three component family must supply z=0,w=1 after an explicit
 // projective setter; literal green coverage also catches integer normalization.
 call('glDisable',[0xde1]);call('glColor4f',[0,f(1),0,f(1)]);
 for(const name of names.filter(x=>metadata(x).n<4)){typed('glVertex4sv',[7,9,11,13]);call('glClear',[0x4000]);quad(name,1,1);pixels(Array(8).fill('GGGGGGGG'),'literal dimensional defaults '+name);}
 // Primitive boundaries: an incomplete triangle is discarded and cannot join
 // the next Begin. Two individually incomplete primitives leave black pixels.
 call('glClear',[0x4000]);call('glBegin',[4]);typed('glVertex2sv',[-1,-1]);typed('glVertex3iv',[1,-1,0]);call('glEnd');call('glBegin',[4]);typed('glVertex4dv',[0,1,0,1]);call('glEnd');pixels(Array(8).fill('KKKKKKKK'),'incomplete primitives do not join');
 call('glBegin',[4]);typed('glVertex2sv',[-1,-1]);typed('glVertex3iv',[1,-1,0]);typed('glVertex4dv',[0,1,0,1]);call('glEnd');
 // Screen vertices (0,8),(8,8),(4,0); readback row r uses screen y=7-r.
 // Nearest integer edges and exclusive right give [1+floor(r/2),8-ceil(r/2)).
 pixels(['KGGGGGGG','KGGGGGGK','KKGGGGGK','KKGGGGKK','KKKGGGKK','KKKGGKKK','KKKKGKKK','KKKKKKKK'],'literal mixed typed triangle');
 // Full projective primitive lists preserve Begin/End and typed values.
 call('glEnable',[0xde1]);call('glColor4f',[1,1,1,1].map(f));
 for(const mode of [0x1300,0x1301]){const id=call('glGenLists',[1]);call('glNewList',[id,mode]);quad('glVertex4dv');call('glEndList');write(vec,Buffer.alloc(80,0x57));call('glClear',[0x4000]);call('glCallList',[id]);pixels(Array(8).fill('RRRRRRBB'),'literal projective list '+mode);}
 for(const name of ['glMap1d']){assert.strictEqual(call('wglGetProcAddress',[str(name)]),0);assert.strictEqual(resolve(name),0);}
 assert.strictEqual(call('glGetError'),0);if(encoder){encoder.fence();assert(encoder.snapshot().glQueued>0,'actual queue used');}
 call('wglDeleteContext',[context]);
 const result={passed:true,route:queued?'queued':'direct',checks,missingImplemented:names.length,mutation:mutation||null,observations};
 if(process.env.GL_TYPED_VERTEX_EVIDENCE)fs.writeFileSync(process.env.GL_TYPED_VERTEX_EVIDENCE,JSON.stringify(result,null,2));console.log(JSON.stringify({...result,observations:observations.length}));
 }finally{if(encoder)encoder.stop();if(manager)await manager.stop();if(render)render.destroy();}
})().catch(e=>{console.error(e);process.exitCode=1;});
