'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),req=p=>require(path.join(root,p));
const {bootRenderHarness}=req('test/render-helper');
const {OpenGLHostBridge,CALL_INDEX:GL}=req('lib/gl-compat');
const Stream=req('lib/gl-command-stream');
const table=req('src/api_table.json');
const extraWat=`
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
 let memory,bridge,encoder=null,manager=null,render=null,producer=null;const captures=[];
 const queued=process.argv.includes('--worker'),mutation=process.env.GL_CLIP_MUTATION,baseline=process.env.GL_CLIP_BASELINE;
 let prebuiltModule;
 if(mutation||baseline){let changed=false;
  const bytes=req('test/compile-src').compileSrcWasm((file,source)=>{
   if(file==='13-exports.wat')return source+extraWat;
   if(baseline&&fs.existsSync(path.join(baseline,file))){changed=true;return fs.readFileSync(path.join(baseline,file),'utf8');}
   if(baseline)return source;
   const edits={
    precision:['09a8e-gl-state.wat','$gl_clip_eye_plane','(f64.load (i32.add (local.get $a)\n            (i32.add (i32.mul (local.get $i) (i32.const 40)) (i32.const 32))))','(f64.promote_f32 (f32.demote_f64 (f64.load (i32.add (local.get $a)\n            (i32.add (i32.mul (local.get $i) (i32.const 40)) (i32.const 32))))))'],
    transform:['09a8e-gl-state.wat','$gl_clip_eye_plane','(f64.div (f64.load (i32.add (local.get $ak) (local.get $j))) (local.get $n))','(f64.mul (f64.load (i32.add (local.get $ak) (local.get $j))) (local.get $n))'],
    enabled:['09a8g-gl-raster.wat','$gl_sw_draw','(i32.load offset=192 (call $gl_clip_state))','(i32.const 0)'],
    index:['09a8b-handlers-opengl.wat','$handle_gl_clip','(i32.const 6))','(i32.const 5))'],
    width:['09a8b-handlers-opengl.wat','$handle_gl_clip','(br_if $output (i32.lt_u (local.get $i) (i32.const 32)))','(br_if $output (i32.lt_u (local.get $i) (i32.const 24)))'],
    begin:['09a8b-handlers-opengl.wat','$handle_gl_clip','(i32.ge_s (global.get $gl_immediate_mode) (i32.const 0))','(i32.ge_s (global.get $gl_immediate_mode) (i32.const 1))'],
    attrib:['09a8cb-gl-bitmap.wat','$gl_bitmap_intercept','(i32.and (local.get $mask) (i32.const 0x1000))','(i32.and (local.get $mask) (i32.const 0))'],
    list:['09a8ca-gl-lists.wat','$gl_list_intercept','(i32.load offset=8 (local.get $stack)) (i32.const 32))','(i32.load offset=8 (local.get $stack)) (i32.const 16))'],
    snapshot:['09a8g-gl-raster.wat','$gl_sw_worker_try','(call $gl_clip_state) (i32.const 200))','(call $gl_clip_state) (i32.const 192))'],
   };
   assert(edits[mutation],'known mutation');const [f,fn,from,to]=edits[mutation];if(file!==f)return source;
   const at=source.indexOf('(func '+fn+' ');assert(at>=0,'mutation function '+fn);const body=source.slice(at);assert(body.includes(from),'mutation anchor '+mutation);changed=true;return source.slice(0,at)+body.replace(from,to);
  });assert(changed,'source control applied');prebuiltModule=new WebAssembly.Module(bytes);
  console.error('SOURCE_CONTROL_COMPILED',mutation||'old-source');
 }
 const h=await bootRenderHarness({...(prebuiltModule?{prebuiltModule}:{extraWat}),fonts:'none',width:8,height:8,
  extraHostOverrides:{gpu_gl_call(op,at,bytes){
   if(op===Stream.WAT_STREAM_FLUSH_OPCODE){
     Stream.replay(Stream.memoryBatch(memory,at,bytes),(op,aux,capture)=>{
       if(op===148){const d=new DataView(capture.buffer);
        assert.strictEqual(capture.pointerLength,32,'captured GLdouble equation width');
        assert.strictEqual(capture.pointerBorrowed,false,'owned plane input');
        captures.push({plane:d.getUint32(capture.stackOffset+4,true),values:Array.from({length:4},(_,i)=>d.getFloat64(capture.pointerOffset+8*i,true))});
       }return 0;
     });
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
 for(const name of ['glClipPlane','glGetClipPlane'])assert(call('wglGetProcAddress',[str(name)]),'dynamic export '+name);
 const vector=e.guest_alloc(128)>>>0,output=e.guest_alloc(128)>>>0;
 const bytes=a=>{const b=Buffer.alloc(a.length*8);a.forEach((v,i)=>b.writeDoubleLE(v,8*i));return b;};
 const write=(p,b)=>{for(let i=0;i<b.length;i++)dv.setUint8(wa(p+i),b[i]);};
 const read=(p,n)=>Buffer.from(Array.from({length:n},(_,i)=>dv.getUint8(wa(p+i))));
 function plane(i,a,at=vector){write(at,bytes(a));call('glClipPlane',[0x3000+i,at]);}
 function equation(i,want,label,at=output+8){
  write(at-8,Buffer.alloc(48,0xa7));call('glGetClipPlane',[0x3000+i,at]);
  const b=read(at,32),got=[0,1,2,3].map(i=>b.readDoubleLE(i*8));
  if (/inverse transpose|list owns|list reexecution/.test(label)) {
   got.forEach((v,i)=>assert(Math.abs(v-want[i])<=1e-12,label+' component '+i+': '+v+' expected '+want[i]));
  } else assert.deepStrictEqual(got,want,label);
  assert(read(at-8,8).every(x=>x===0xa7),label+' prefix');assert(read(at+32,8).every(x=>x===0xa7),label+' exact binary64 width');
  observations.push({label,actual:got,expected:want});checks++;
 }
 const identity=mode=>{call('glMatrixMode',[mode]);call('glLoadIdentity');};
 const load=(mode,a)=>{call('glMatrixMode',[mode]);a.forEach((v,i)=>dv.setFloat32(wa(vector)+4*i,v,true));call('glLoadMatrixf',[vector]);};
 function enable(i,on=true){call(on?'glEnable':'glDisable',[0x3000+i]);}
 function disabled(){for(let i=0;i<6;i++)enable(i,false);}
 function scalar(name,p,want){write(output,Buffer.alloc(16,0xa5));call(name,[p,output+4]);const got=name==='glGetDoublev'?read(output+4,8).readDoubleLE():name==='glGetFloatv'?read(output+4,4).readFloatLE():read(output+4,4).readInt32LE();assert.strictEqual(got,want,name+'/'+p);checks++;}
 for(let i=0;i<6;i++){equation(i,[0,0,0,0],'default equation '+i);assert.strictEqual(call('glIsEnabled',[0x3000+i]),0);}
 for(const n of ['glGetIntegerv','glGetFloatv','glGetDoublev'])scalar(n,0xd32,6);
 for(let i=0;i<6;i++){
  plane(i,[1.0000000000000002,-1.0000000000000002,16777217,-16777217]);equation(i,[1.0000000000000002,-1.0000000000000002,16777217,-16777217],'unrounded binary64 '+i);
  enable(i);assert.strictEqual(call('glIsEnabled',[0x3000+i]),1);
  for(const n of ['glGetIntegerv','glGetFloatv','glGetDoublev'])scalar(n,0x3000+i,1);
  enable(i,false);
 }
 // Literal products of [1,2,3,4] by each modelview, including a projective
 // bottom row and a pivot permutation. Matrix mode at setter is irrelevant.
 for(const [matrix,input,label] of [
  [[2,0,0,0,1,4,0,0,0,0,8,0,3,-2,5,1],[2,9,24,18],'affine'],
  [[2,0,0,.5,1,4,0,0,0,0,8,0,3,-2,5,1],[4,9,24,18],'projective'],
  [[0,1,0,0,1,0,0,0,0,0,0,1,0,0,1,0],[2,1,4,3],'pivot']]){
  load(0x1700,matrix);identity(0x1701);identity(0x1702);plane(3,input);identity(0x1700);equation(3,[1,2,3,4],label+' setter-time inverse transpose');
 }
 // Contexts retain equations, enable bits and attribute frames independently.
 plane(0,[1,2,3,4]);enable(0);call('glPushAttrib',[0x1000]);plane(0,[4,3,2,1]);enable(0,false);
 const fresh=call('wglCreateContext',[dc]);assert(fresh);call('wglMakeCurrent',[dc,fresh]);
 for(let i=0;i<6;i++){equation(i,[0,0,0,0],'fresh context '+i);assert.strictEqual(call('glIsEnabled',[0x3000+i]),0);}
 plane(0,[7,8,9,10]);enable(1);call('wglMakeCurrent',[dc,context]);call('glPopAttrib');equation(0,[1,2,3,4],'TRANSFORM_BIT equation');assert.strictEqual(call('glIsEnabled',[0x3000]),1);
 for(const [mask,want,enabled] of [[0x2000,[4,3,2,1],1],[0x1,[4,3,2,1],0],[0xfffff,[1,2,3,4],1]]){
  plane(0,[1,2,3,4]);enable(0);call('glPushAttrib',[mask]);plane(0,[4,3,2,1]);enable(0,false);call('glPopAttrib');equation(0,want,'attribute mask '+mask);assert.strictEqual(call('glIsEnabled',[0x3000]),enabled);
 }
 call('wglMakeCurrent',[dc,fresh]);equation(0,[7,8,9,10],'other context unchanged');assert.strictEqual(call('glIsEnabled',[0x3001]),1);call('wglMakeCurrent',[dc,context]);disabled();
 for(const mode of [0x1300,0x1301]){
  identity(0x1700);plane(0,[1,0,0,0]);const list=call('glGenLists',[1]);call('glNewList',[list,mode]);plane(0,[2,4,8,16]);
  const n=e.probe_list_commands();assert.strictEqual(n,1);equation(0,mode===0x1300?[1,0,0,0]:[2,4,8,16],'query immediate in compile '+mode);assert.strictEqual(e.probe_list_commands(),n);
  if(mode===0x1300){call('glBegin',[0]);equation(0,[1,0,0,0],'query ignores shadow Begin');call('glEnd');}
  call('glEndList');write(vector,Buffer.alloc(64,0x5a));write(output,Buffer.alloc(128,0xb9));
  call('glTranslatef',[f(3),f(-2),f(5)]);call('glCallList',[list]);assert(read(output,128).every(x=>x===0xb9),'no query replay');identity(0x1700);equation(0,[2,4,8,-22],'list owns original doubles and transforms at execution '+mode);
  call('glTranslatef',[f(1),f(1),f(1)]);call('glCallList',[list]);identity(0x1700);equation(0,[2,4,8,2],'list reexecution transform '+mode);
 }
 // Split frame, input doubles and output doubles across separately backed pages.
 for(const p of [0x60000000,0x61000000,0x60001000,0x63000000,0x64000000,0x63001000,0x65000000])assert(e.test_virtual_map_commit(p,4096));
 assert.notStrictEqual(wa(0x60001000)-wa(0x60000000),4096);assert.notStrictEqual(wa(0x63001000)-wa(0x63000000),4096);
 for(const [p,v]of[[0x61000000,0x7f],[0x64000000,0x7e]])new Uint8Array(memory.buffer,wa(p),4096).fill(v);
 function sparse(name,args,at){const thunk=resolve(name),frame=Buffer.alloc(12,0xa7);frame.writeUInt32LE(0x12345678);args.forEach((v,i)=>frame.writeUInt32LE(v>>>0,4+4*i));write(at,frame);dv.setUint32(regs+16,at,true);e.probe_invoke(thunk);assert.strictEqual(dv.getUint32(regs+16,true),at+12);assert.deepStrictEqual(read(at,12),frame);checks++;}
 write(0x63000ffd,bytes([-3,2,-7,9]));sparse('glClipPlane',[0x3002,0x63000ffd],0x60000ffa);equation(2,[-3,2,-7,9],'sparse split setter');equation(2,[-3,2,-7,9],'sparse split output',0x63000ffd);
 sparse('glGetClipPlane',[0x3002,0x63000ffd],0x60000ffa);assert.deepStrictEqual(read(0x63000ffd,32),bytes([-3,2,-7,9]));
 write(0x65000fe0,bytes([4,3,2,1]));call('glClipPlane',[0x3005,0x65000fe0]);call('glGetClipPlane',[0x3005,0x65000fe0]);assert.deepStrictEqual(read(0x65000fe0,32),bytes([4,3,2,1]));checks++;
 const state=()=>Buffer.from(new Uint8Array(memory.buffer,e.probe_context()+768,200));
 function reject(name,args,code,label){const before=state(),used=e.gl_wat_stream_used(),count=e.probe_list_commands();write(output,Buffer.alloc(128,0xa9));assert.doesNotThrow(()=>call(name,args),label+' rejects before inaccessible pointer');assert.deepStrictEqual(state(),before,label+' state');assert.strictEqual(e.gl_wat_stream_used(),used,label+' stream');assert.strictEqual(e.probe_list_commands(),count,label+' list');assert(read(output,128).every(x=>x===0xa9));assert.strictEqual(call('glGetError'),code,label+' error');checks++;}
 for(const cap of [0x2fff,0x3006,0x3007,0xffffffff])for(const name of ['glClipPlane','glGetClipPlane'])reject(name,[cap,0xffffffff],0x500,'invalid plane '+cap+'/'+name);
 for(const name of ['glEnable','glDisable','glIsEnabled'])reject(name,[0x3006],0x500,'invalid enable index '+name);
 for(const name of ['glGetFloatv','glGetIntegerv','glGetDoublev'])reject(name,[0x3006,0xffffffff],0x500,'invalid query plane '+name);
 call('glBegin',[0]);call('glVertex3f',[0,0,0]);const vertexCount=e.probe_count();
 for(const name of ['glClipPlane','glGetClipPlane'])reject(name,[0x3000,0xffffffff],0x502,'Begin setter/getter '+name);
 for(const name of ['glEnable','glDisable','glIsEnabled'])reject(name,[0x3000],0x502,'Begin enable '+name);
 assert.strictEqual(e.probe_count(),vertexCount);call('glEnd');
 const rejectedList=call('glGenLists',[1]);call('glNewList',[rejectedList,0x1300]);call('glBegin',[0]);reject('glClipPlane',[0x3000,0xffffffff],0x502,'compile Begin');call('glEnd');call('glEndList');
 function bad(name,args,label,frame=stack){const thunk=resolve(name);if(args){const b=Buffer.alloc(12);args.forEach((v,i)=>b.writeUInt32LE(v>>>0,4+4*i));write(frame,b);}const before=state(),used=e.gl_wat_stream_used(),count=e.probe_list_commands();dv.setUint32(regs+16,frame,true);dv.setUint32(regs,0xdeadbeef,true);assert.throws(()=>e.probe_invoke(thunk),WebAssembly.RuntimeError,label);assert.strictEqual(dv.getUint32(regs+16,true),frame);assert.strictEqual(dv.getUint32(regs,true),0xdeadbeef);assert.deepStrictEqual(state(),before,label+' state');assert.strictEqual(e.gl_wat_stream_used(),used);assert.strictEqual(e.probe_list_commands(),count);checks++;}
 for(const name of ['glClipPlane','glGetClipPlane'])for(const p of [0x65001000,0x65000fe1,0xffffffff]){
  new Uint8Array(memory.buffer,wa(0x65000fe0),32).fill(0xb8);bad(name,[0x3000,p],'bad span '+name+'/'+p);assert(read(0x65000fe0,32).every(x=>x===0xb8),'atomic partial output');
 }
 for(const name of ['glClipPlane','glGetClipPlane']){bad(name,null,'truncated frame '+name,0x65000ff5);bad(name,null,'wrapped frame '+name,0xfffffff8);}
 for(const [p,v]of[[0x61000000,0x7f],[0x64000000,0x7e]])assert(new Uint8Array(memory.buffer,wa(p),4096).every(x=>x===v));
 // Literal pixel oracles use public calls exclusively, on both real routes.
 call('glViewport',[0,0,8,8]);identity(0x1700);identity(0x1701);identity(0x1702);
 call('glClearColor',[0,0,0,f(1)]);call('glColor4f',[f(1),f(1),f(1),f(1)]);
 const clear=()=>call('glClear',[0x4000]);
 function pixel(x,y,want,label){write(output,Buffer.alloc(16));call('glReadPixels',[x,y,1,1,0x1908,0x1401,output]);const got=Array.from(read(output,4));assert.deepStrictEqual(got,want,label);observations.push({label,actual:got,expected:want});checks++;}
 const white=[255,255,255,255],black=[0,0,0,255];
 function draw(mode,vertices){call('glBegin',[mode]);for(const v of vertices)call('glVertex4f',[...v.slice(0,3).map(f),f(v[3]===undefined?1:v[3])]);call('glEnd');}
 const quad=[[-1,-1,0],[1,-1,0],[1,1,0],[-1,1,0]];
 for(let i=0;i<6;i++) {disabled();plane(i,[1,0,0,0]);enable(i);clear();draw(7,quad);pixel(6,4,white,'independent plane '+i+' accepted');pixel(1,4,black,'independent plane '+i+' rejected');}
 disabled();
 for(const [i,eq]of[[0,[1,0,0,.5]],[1,[-1,0,0,.5]],[2,[0,1,0,.5]],[3,[0,-1,0,.5]],[4,[0,0,1,.5]],[5,[0,0,-1,.5]]]){plane(i,eq);enable(i);}
 clear();draw(7,quad);pixel(4,4,white,'six enabled planes intersection');pixel(0,4,black,'six planes left reject');pixel(4,0,black,'six planes bottom reject');disabled();
 plane(0,[1,0,0,0]);enable(0);clear();draw(7,quad);pixel(6,4,white,'crossing quad accepted half');pixel(1,4,black,'crossing quad rejected half');
 for(const [mode,vertices]of[[4,[quad[0],quad[1],quad[2],quad[0],quad[2],quad[3]]],[5,[quad[0],quad[1],quad[3],quad[2]]],[6,quad],[8,[quad[0],quad[1],quad[3],quad[2]]],[9,quad]]){
  clear();draw(mode,vertices);pixel(6,4,white,'crossing polygon mode '+mode);pixel(1,4,black,'polygon rejected half '+mode);
 }
 for(const [mode,vertices]of[[0,[[-.5,0,0],[.5,0,0]]],[1,[[-1,0,0],[1,0,0]]],[2,[[-1,0,0],[1,0,0]]],[3,[[-1,0,0],[1,0,0]]]]){
  clear();draw(mode,vertices);pixel(6,3,white,'point/line accepted '+mode);pixel(2,3,black,'point/line rejected '+mode);
 }
 for(const [mode,vertices]of[[0,[[-.5,0,0]]],[1,[[-.9,0,0],[-.2,0,0]]],[4,[[-.9,-.5,0],[-.2,-.5,0],[-.2,.5,0]]]]){
  clear();draw(mode,vertices);for(const x of [1,3,6])pixel(x,3,black,'fully rejected primitive '+mode+'/'+x);
 }
 // Two independent halfspaces, the legal final plane and setter-time MV.
 call('glPointSize',[f(3)]);clear();draw(0,[[-.0625,0,0]]);pixel(4,3,black,'wide point rejected by center');
 clear();draw(0,[[.0625,0,0]]);pixel(3,3,white,'accepted point keeps footprint across plane');call('glPointSize',[f(1)]);
 plane(5,[0,1,0,0]);enable(5);clear();draw(7,quad);pixel(6,6,white,'two planes intersection');pixel(6,1,black,'plane five clips lower half');pixel(1,6,black,'plane zero clips left half');enable(5,false);
 call('glMatrixMode',[0x1700]);call('glTranslatef',[f(.5),0,0]);plane(0,[1,0,0,0]);identity(0x1700);clear();draw(7,quad);pixel(7,4,white,'transformed plane retains eye equation');pixel(5,4,black,'setter translation shifts cut');
 // Homogeneous w contributes to the equation and changes interpolation.
 plane(0,[1,0,0,-.25]);clear();draw(7,quad.map(([x,y,z])=>[x*2,y*2,z,2]));pixel(6,4,white,'projective vertex accepted');pixel(4,4,black,'homogeneous equation uses w');
 plane(0,[1,0,0,0]);clear();call('glRectf',[f(-1),f(-1),f(1),f(1)]);pixel(6,4,white,'rectangle uses shared clipper');pixel(1,4,black,'rectangle clipped');
 // Arrays and display-list geometry enter the same packed primitive path.
 const vertices=e.guest_alloc(48)>>>0;quad.forEach((v,i)=>v.forEach((x,j)=>dv.setFloat32(wa(vertices)+12*i+4*j,x,true)));
 call('glVertexPointer',[3,0x1406,0,vertices]);call('glEnableClientState',[0x8074]);clear();call('glDrawArrays',[7,0,4]);pixel(6,4,white,'DrawArrays crossing');pixel(1,4,black,'DrawArrays rejected');
 const indices=e.guest_alloc(8)>>>0;write(indices,Buffer.from([0,1,2,3]));clear();call('glDrawElements',[7,4,0x1401,indices]);pixel(6,4,white,'DrawElements crossing');pixel(1,4,black,'DrawElements rejected');call('glDisableClientState',[0x8074]);
 const list=call('glGenLists',[1]);call('glNewList',[list,0x1300]);plane(0,[-1,0,0,0]);draw(7,quad);call('glEndList');plane(0,[1,0,0,0]);clear();call('glCallList',[list]);pixel(1,4,white,'display-list plane clips subsequent listed geometry');pixel(6,4,black,'display-list geometry rejected');
 plane(0,[1,0,0,0]);call('glRasterPos2f',[f(-.5),0]);scalar('glGetIntegerv',0xb08,0);call('glRasterPos2f',[f(.5),0]);scalar('glGetIntegerv',0xb08,1);
 // Immutable queued snapshot: change plane state while accepted work is pending.
 clear();draw(7,quad);enable(0,false);plane(0,[-1,0,0,0]);pixel(6,4,white,'queued earlier equation snapshot');pixel(1,4,black,'queued earlier enables snapshot');
 call('glFlush');assert(captures.some(x=>x.values[2]===16777217),'stream owns exact doubles');assert.strictEqual(call('glGetError'),0);
 if(queued){encoder.fence();assert(encoder.snapshot().glQueued>0,'real queue used');}
 const result={passed:true,route:queued?'queued':'direct',checks,observations};if(process.env.GL_CLIP_EVIDENCE)fs.writeFileSync(process.env.GL_CLIP_EVIDENCE,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 } finally {if(encoder)encoder.stop();if(manager)await manager.stop();if(render)render.destroy();}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
