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
 const queued=process.argv.includes('--worker'),mutation=process.env.GL_TEXGEN_MUTATION,baseline=process.env.GL_TEXGEN_BASELINE;
 let prebuiltModule;
 if(mutation||baseline){let changed=false;
  const bytes=req('test/compile-src').compileSrcWasm((file,source)=>{
   if(file==='13-exports.wat')return source+extraWat;
   if(baseline&&fs.existsSync(path.join(baseline,file))){changed=true;return fs.readFileSync(path.join(baseline,file),'utf8');}
   if(baseline)return source;
   const edits={
    encoder:['09a8c-gl-encoder.wat','$gl_pointer_length','(if (i32.eq (local.get $op) (i32.const 85)) (then (local.set $arg (i32.const 2))','(if (i32.eq (local.get $op) (i32.const 83)) (then (local.set $arg (i32.const 2))'],
    signed:['09a8b-handlers-opengl.wat','$handle_glTexGen_typed','(f64.convert_i32_s (call $gl32','(f64.convert_i32_u (call $gl32'],
    double:['09a8b-handlers-opengl.wat','$handle_glTexGen_typed','(f32.demote_f64 (local.get $v))','(f32.const 0)'],
    round:['09a8b-handlers-opengl.wat','$handle_glGetTexGen_typed','(i32.trunc_sat_f64_s (f64.nearest (local.get $v)))','(i32.trunc_sat_f64_s (local.get $v))'],
    width:['09a8b-handlers-opengl.wat','$handle_glGetTexGen_typed','(select (i32.const 8) (i32.const 4) (i32.eqz (local.get $kind)))','(i32.const 4)'],
    unit:['09a8b-handlers-opengl.wat','$handle_glGetTexGen_typed','(i32.load offset=4 (call $gl_mtx_block))','(i32.const 0)'],
    queryBegin:['09a8b-handlers-opengl.wat','$handle_glGetTexGen_typed','(if (i32.ge_s (global.get $gl_immediate_mode) (i32.const 0))','(if (i32.const 0)'],
    compile:['09a8b-handlers-opengl.wat','$handle_glGetTexGen_typed','(i32.and (i32.eqz (local.get $error)) (i32.ne (local.get $ctx) (i32.const 0)))','(i32.and (i32.eqz (local.get $error)) (i32.eqz (i32.load offset=12 (local.get $ctx))))'],
    validation:['09a8b-handlers-opengl.wat','$handle_glGetTexGen_typed','(call $gl_texcoord_check (local.get $out) (i32.mul (local.get $n) (local.get $stride)))','(call $gl_texcoord_check (local.get $out) (i32.const 1))'],
    arity:['09a8b-handlers-opengl.wat','$gl_texgen_count','(then (return (i32.const 4)))','(then (return (i32.const 1)))'],
    eye:['09a8cb-gl-bitmap.wat','$gl_raster_texgen_state','(call $gl_raster_eye_plane (call $gl_mtx_block) (local.get $p) (local.get $src))','(call $gl_copy_from_guest (local.get $p) (local.get $src) (i32.const 16))'],
    object:['09a8cb-gl-bitmap.wat','$gl_raster_texgen_state','(select (i32.const 84) (i32.const 20) (i32.eq (local.get $pname) (i32.const 0x2502)))','(select (i32.const 20) (i32.const 84) (i32.eq (local.get $pname) (i32.const 0x2502)))'],
    list:['09a8ca-gl-lists.wat','$gl_list_intercept','(if (i32.eq (local.get $op) (i32.const 85)) (then\n          (call $gl_copy_from_guest (i32.add (local.get $p) (i32.const 24))','(if (i32.eq (local.get $op) (i32.const 85)) (then\n          (call $gl_copy_from_guest (i32.add (local.get $p) (i32.const 28))'],
    defaults:['09a8cb-gl-bitmap.wat','$gl_raster_texgen_init','(i32.const 0x2400)','(i32.const 0x2401)'],
    raster:['09a8cb-gl-bitmap.wat','$gl_raster_texgen','(i32.const 84) (i32.const 20)','(i32.const 20) (i32.const 84)'],
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
       if(op===83||op===84||op===85){const d=new DataView(capture.buffer),coord=d.getUint32(capture.stackOffset+4,true),pname=d.getUint32(capture.stackOffset+8,true);
        const expected=op===85?(pname===0x2500?4:16):0;
        assert.strictEqual(capture.pointerLength,expected,'texgen opcode-specific captured width');
        assert.strictEqual(capture.pointerBorrowed,false,'texgen payload owned');
        const values=expected?Array.from({length:expected/4},(_,i)=>d.getFloat32(capture.pointerOffset+4*i,true)):[];
        captures.push({op,coord,pname,values});
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
 const names=['glTexGend','glTexGendv','glTexGeniv','glGetTexGendv','glGetTexGenfv','glGetTexGeniv'];
 for(const name of names)assert(call('wglGetProcAddress',[str(name)]),'dynamic export '+name);
 const vector=e.guest_alloc(128)>>>0,output=e.guest_alloc(96)>>>0;
 const bytes=(a,kind='f')=>{const b=Buffer.alloc(a.length*(kind==='d'?8:4));a.forEach((v,i)=>kind==='d'?b.writeDoubleLE(v,i*8):kind==='i'?b.writeInt32LE(v,i*4):b.writeFloatLE(v,i*4));return b;};
 const write=(p,b)=>{for(let i=0;i<b.length;i++)dv.setUint8(wa(p+i),b[i]);};
 const read=(p,n)=>Buffer.from(Array.from({length:n},(_,i)=>dv.getUint8(wa(p+i))));
 const dwords=v=>{const b=bytes([v],'d');return [b.readUInt32LE(0),b.readUInt32LE(4)];};
 function set(name,c,p,a,at=vector){const k=name.includes('Gend')?'d':name.includes('Geni')?'i':'f';
  if(name.endsWith('v')){write(at,bytes(a,k));return call(name,[c,p,at]);}
  return call(name,[c,p,...(k==='d'?dwords(a[0]):[k==='f'?f(a[0]):a[0]])]);
 }
 function query(name,c,p,want,label,at=output+8){const k=name.endsWith('dv')?'d':name.endsWith('iv')?'i':'f',stride=k==='d'?8:4;
  write(at-8,Buffer.alloc(56,0xa7));call(name,[c,p,at]);const b=read(at,want.length*stride);
  const got=want.map((_,i)=>k==='d'?b.readDoubleLE(i*stride):k==='i'?b.readInt32LE(i*stride):b.readFloatLE(i*stride));
  assert.deepStrictEqual(got,want,label+' '+name);
  assert(read(at-8,8).every(x=>x===0xa7),label+' prefix');assert(read(at+want.length*stride,48-want.length*stride).every(x=>x===0xa7),label+' exact width');
  observations.push({label,name,actual:got,expected:want});checks++;
 }
 const all=(c,p,a,label,ints=a)=>{for(const n of names.slice(3))query(n,c,p,n.endsWith('iv')?ints:a,label);};
 const identity=mode=>{call('glMatrixMode',[mode]);call('glLoadIdentity');};
 const load=(mode,a)=>{call('glMatrixMode',[mode]);write(vector,bytes(a));call('glLoadMatrixf',[vector]);};
 const defaults=()=>{for(let c=0;c<4;c++){
  all(0x2000+c,0x2500,[0x2400],'default mode '+c);
  for(const p of [0x2501,0x2502])all(0x2000+c,p,c===0?[1,0,0,0]:c===1?[0,1,0,0]:[0,0,0,0],'default plane '+c+'/'+p);
 }};
 for(const u of [0x84c0,0x84c1]){call('glActiveTextureARB',[u]);defaults();}call('glActiveTextureARB',[0x84c0]);
 // Literal transport oracle also distinguishes scalar opcode83 from vector85.
 for(const name of ['glTexGendv','glTexGeniv','glTexGenfv']){
  set(name,0x2000,0x2501,[-3,2,-7,9]);write(vector,Buffer.alloc(64));call('glFlush');
  assert.deepStrictEqual(captures.filter(x=>x.op===85&&x.pname===0x2501).at(-1).values,[-3,2,-7,9],'stream owns converted plane '+name);checks++;
 }
 set('glTexGeni',0x2000,0x2500,[0x2401]);call('glFlush');assert.strictEqual(captures.at(-1).op,83,'scalar integer opcode has no pointed payload');checks++;
 // Every mode setter, including accepted scalar integer and float entry points.
 for(const name of ['glTexGend','glTexGendv','glTexGeniv','glTexGeni','glTexGenf','glTexGenfv'])for(let c=0;c<4;c++)for(const mode of [0x2400,0x2401,...(c<2?[0x2402]:[])]){
  set(name,0x2000+c,0x2500,[mode]);all(0x2000+c,0x2500,[mode],name+' mode '+c);
 }
 for(const name of ['glTexGendv','glTexGeniv','glTexGenfv'])for(let c=0;c<4;c++)for(const p of [0x2501,0x2502]){
  identity(0x1700);const a=name==='glTexGeniv'?[-3,2,-7,9]:[-1.25,2.75,-3.5,4.25];set(name,0x2000+c,p,a);
  all(0x2000+c,p,a,name+' signed numeric plane '+c+'/'+p,name==='glTexGeniv'?a:[-1,3,-4,4]);
 }
 set('glTexGendv',0x2000,0x2501,[1.0000000596046448,-1.0000000596046448,16777217,-16777217]);
 all(0x2000,0x2501,[1,-1,16777216,-16777216],'binary64 narrowed canonical storage');
 set('glTexGeniv',0x2000,0x2501,[-2147483648,2147483647,16777217,-16777217]);
 all(0x2000,0x2501,[-2147483648,2147483648,16777216,-16777216],'signed integer plane and saturated query',[-2147483648,2147483647,16777216,-16777216]);
 set('glTexGendv',0x2000,0x2501,[1e30,-1e30,2.5,-2.5]);
 all(0x2000,0x2501,[Math.fround(1e30),Math.fround(-1e30),2.5,-2.5],'query nearest and saturation',[2147483647,-2147483648,2,-2]);
 // Literal row-vector products: [1,2,3,4]*M = supplied. The bottom
 // row .5 makes the second matrix non-affine and defeats affine-only inverses.
 for(const [matrix,plane,label] of [
  [[2,0,0,0,1,4,0,0,0,0,8,0,3,-2,5,1],[2,9,24,18],'nonidentity'],
  [[2,0,0,.5,1,4,0,0,0,0,8,0,3,-2,5,1],[4,9,24,18],'non-affine']]){
  for(const name of ['glTexGendv','glTexGeniv','glTexGenfv']){
   load(0x1700,matrix);identity(0x1702);set(name,0x2002,0x2502,plane);identity(0x1700);
   all(0x2002,0x2502,[1,2,3,4],name+' '+label+' setter-time inverse');
   set(name,0x2002,0x2501,plane);all(0x2002,0x2501,plane,name+' object untransformed');
  }
 }
 // Both units, independent contexts, and TEXTURE_BIT restore planes/modes/enables.
 const fresh=call('wglCreateContext',[dc]);assert(fresh);
 set('glTexGendv',0x2003,0x2501,[7,8,9,10]);set('glTexGend',0x2003,0x2500,[0x2401]);
 call('glEnable',[0xc63]);call('glPushAttrib',[0x40000]);
 set('glTexGeniv',0x2003,0x2501,[-7,-8,-9,-10]);set('glTexGend',0x2003,0x2500,[0x2400]);call('glDisable',[0xc63]);
 call('glActiveTextureARB',[0x84c1]);set('glTexGeniv',0x2003,0x2501,[11,12,13,14]);
 call('glPopAttrib');all(0x2003,0x2501,[7,8,9,10],'TEXTURE_BIT plane restoration');all(0x2003,0x2500,[0x2401],'TEXTURE_BIT mode restoration');assert.strictEqual(call('glIsEnabled',[0xc63]),1);
 call('glActiveTextureARB',[0x84c1]);all(0x2003,0x2501,[0,0,0,0],'TEXTURE_BIT restores second unit');
 set('glTexGeniv',0x2003,0x2501,[11,12,13,14]);call('glActiveTextureARB',[0x84c0]);all(0x2003,0x2501,[7,8,9,10],'unit zero isolation');
 call('wglMakeCurrent',[dc,fresh]);defaults();set('glTexGendv',0x2003,0x2501,[21,22,23,24]);
 call('wglMakeCurrent',[dc,context]);all(0x2003,0x2501,[7,8,9,10],'context zero isolated');call('glActiveTextureARB',[0x84c1]);all(0x2003,0x2501,[11,12,13,14],'context retains unit one');call('glActiveTextureARB',[0x84c0]);
 // Lists own values, transform eye coefficients at execution and never own queries.
 for(const mode of [0x1300,0x1301])for(const name of ['glTexGendv','glTexGeniv','glTexGenfv']){
  identity(0x1700);set('glTexGeniv',0x2000,0x2502,[1,0,0,0]);
  const list=call('glGenLists',[1]);call('glNewList',[list,mode]);set(name,0x2000,0x2502,[2,4,8,16]);
  const recorded=e.probe_list_commands();assert.strictEqual(recorded,1,'one captured setter');
  all(0x2000,0x2502,mode===0x1300?[1,0,0,0]:[2,4,8,16],'query immediate during compilation');
  assert.strictEqual(e.probe_list_commands(),recorded,'query never captured');
  if(mode===0x1300){call('glBegin',[0]);all(0x2000,0x2502,[1,0,0,0],'query during shadow Begin');call('glEnd');}
  call('glEndList');write(vector,Buffer.alloc(64,0x5a));
  write(output,Buffer.alloc(96,0xb9));call('glTranslatef',[f(3),f(-2),f(5)]);call('glCallList',[list]);assert(read(output,96).every(x=>x===0xb9),'list never replays query');identity(0x1700);all(0x2000,0x2502,[2,4,8,-22],'list executes eye inverse '+mode+'/'+name);
  call('glTranslatef',[f(1),f(1),f(1)]);call('glCallList',[list]);identity(0x1700);all(0x2000,0x2502,[2,4,8,2],'list reexecution transforms copied input');
 }
 for(const name of ['glTexGend','glTexGendv','glTexGeniv','glTexGeni','glTexGenf','glTexGenfv']){
  set('glTexGeni',0x2000,0x2500,[0x2400]);const list=call('glGenLists',[1]);call('glNewList',[list,0x1300]);set(name,0x2000,0x2500,[0x2401]);call('glEndList');
  write(vector,Buffer.alloc(64));all(0x2000,0x2500,[0x2400],'compiled scalar/vector mode deferred');call('glCallList',[list]);all(0x2000,0x2500,[0x2401],'mode list owns input '+name);
 }
 // Non-affine sparse backing for frames, vectors and outputs, including split
 // pointer and double slots. Canary pages must remain entirely unchanged.
 for(const p of [0x60000000,0x61000000,0x60001000,0x63000000,0x64000000,0x63001000])assert(e.test_virtual_map_commit(p,4096));
 assert.notStrictEqual(wa(0x60001000)-wa(0x60000000),4096);assert.notStrictEqual(wa(0x63001000)-wa(0x63000000),4096);
 new Uint8Array(memory.buffer,wa(0x61000000),4096).fill(0x7f);new Uint8Array(memory.buffer,wa(0x64000000),4096).fill(0x7e);
 function sparse(name,args,at){const thunk=resolve(name),frame=Buffer.alloc(4*(args.length+1)+16,0xa7);frame.writeUInt32LE(0x12345678,8);args.forEach((v,i)=>frame.writeUInt32LE(v>>>0,12+4*i));write(at-8,frame);
  for(let i=0;i<8;i++)dv.setUint32(regs+4*i,0x55660000+i,true);dv.setUint32(regs+16,at,true);
  try{e.probe_invoke(thunk);}catch(error){console.error('sparse resolved call failed',name,args,at);throw error;}assert.strictEqual(dv.getUint32(regs+16,true),at+4*(args.length+1),'sparse stdcall '+name);assert.strictEqual(dv.getUint32(regs,true),0);
  for(let i=1;i<8;i++)if(i!==4)assert.strictEqual(dv.getUint32(regs+4*i,true),0x55660000+i);
  assert.deepStrictEqual(read(at-8,frame.length),frame,'sparse stack intact '+name);
 }
 for(const [name,k] of [['glTexGendv','d'],['glTexGeniv','i'],['glTexGenfv','f']]){
  const at=0x63000ffd,b=bytes([-3,2,-7,9],k);write(at-8,Buffer.concat([Buffer.alloc(8,0x6b),b,Buffer.alloc(8,0x6c)]));const before=read(at-8,b.length+16);
  sparse(name,[0x2001,0x2501,at],0x60000ff2);assert.deepStrictEqual(read(at-8,b.length+16),before,'sparse input retained');all(0x2001,0x2501,[-3,2,-7,9],'sparse vector '+name);
 }
 sparse('glTexGend',[0x2001,0x2500,...dwords(0x2401)],0x60000ff2);all(0x2001,0x2500,[0x2401],'split scalar double');
 sparse('glTexGeni',[0x2001,0x2500,0x2401],0x60000ff2);all(0x2001,0x2500,[0x2401],'split legacy scalar integer');
 sparse('glTexGenf',[0x2001,0x2500,f(0x2400)],0x60000ff2);all(0x2001,0x2500,[0x2400],'split legacy scalar float');
 for(const n of names.slice(3)){
  query(n,0x2001,0x2501,[-3,2,-7,9],'sparse query '+n,0x63000ffd);
  sparse(n,[0x2001,0x2501,0x63000ffd],0x60000ff2);
  const stride=n.endsWith('dv')?8:4,b=read(0x63000ffd,stride*4),got=[0,1,2,3].map(i=>n.endsWith('dv')?b.readDoubleLE(i*stride):n.endsWith('iv')?b.readInt32LE(i*stride):b.readFloatLE(i*stride));assert.deepStrictEqual(got,[-3,2,-7,9],'sparse getter frame '+n);checks++;
 }
 // Pname-specific arity: a mode input/output ends at the final mapped byte.
 assert(e.test_virtual_map_commit(0x65000000,4096));assert.strictEqual(wa(0x65001000),240);
 for(const [name,k,size] of [['glTexGendv','d',8],['glTexGeniv','i',4],['glTexGenfv','f',4]]){
  write(0x65001000-size,bytes([0x2400],k));call(name,[0x2001,0x2500,0x65001000-size]);all(0x2001,0x2500,[0x2400],'mode reads exactly one '+name);
 }
 for(const name of names.slice(3)){const size=name.endsWith('dv')?8:4;call(name,[0x2001,0x2500,0x65001000-size]);const b=read(0x65001000-size,size);assert.strictEqual(size===8?b.readDoubleLE():name.endsWith('iv')?b.readInt32LE():b.readFloatLE(),0x2400);checks++;}
 const state=()=>Buffer.from(new Uint8Array(memory.buffer,e.probe_context()+384,296));
 function reject(name,args,code,label){const before=state(),used=e.gl_wat_stream_used(),count=e.probe_list_commands();write(output,Buffer.alloc(96,0xa9));call(name,args);
  assert.deepStrictEqual(state(),before,label+' canonical state');assert.strictEqual(e.gl_wat_stream_used(),used,label+' stream');assert.strictEqual(e.probe_list_commands(),count,label+' list');assert(read(output,96).every(x=>x===0xa9),label+' output');assert.strictEqual(call('glGetError'),code,label+' error');checks++;
 }
 for(const name of ['glTexGend','glTexGendv','glTexGeniv','glTexGeni','glTexGenf','glTexGenfv']){
  const k=name.includes('Gend')?'d':name.includes('Geni')?'i':'f',scalar=!name.endsWith('v');
  const args=(c,p,v)=>{if(!scalar){write(vector,bytes([v,2,3,4],k));return [c,p,vector];}return [c,p,...(k==='d'?dwords(v):[k==='f'?f(v):v])];};
  reject(name,args(0x1fff,0x2500,0x2400),0x500,name+' invalid coord');reject(name,args(0x2000,0xffff,0x2400),0x500,name+' invalid pname');
  for(const v of [0x2403,...(k!=='i'?[9216.5,NaN,Infinity]:[])])reject(name,args(0x2000,0x2500,v),0x500,name+' invalid mode '+v);
  for(const c of [0x2002,0x2003])reject(name,args(c,0x2500,0x2402),0x500,name+' sphere illegal R/Q');
  if(scalar)for(const p of [0x2501,0x2502])reject(name,args(0x2000,p,7),0x500,name+' scalar plane');
  call('glBegin',[0]);reject(name,args(0x2000,0x2500,0x2401),0x502,name+' Begin/End');call('glEnd');
  const list=call('glGenLists',[1]);call('glNewList',[list,0x1300]);reject(name,args(0x2000,0x2500,0x2403),0x500,name+' compile invalid enum');call('glBegin',[0]);reject(name,args(0x2000,0x2500,0x2400),0x502,name+' compile Begin');call('glEnd');call('glEndList');
 }
 for(const name of ['glTexGendv','glTexGeniv','glTexGenfv']){reject(name,[0x2004,0x2501,0xffffffff],0x500,'invalid coordinate ignores pointer '+name);reject(name,[0x2000,0x2503,0xffffffff],0x500,'invalid pname ignores pointer '+name);}
 for(const name of names.slice(3)){
  reject(name,[0x2004,0x2500,output+8],0x500,name+' invalid coord');reject(name,[0x2000,0x2503,output+8],0x500,name+' invalid pname');
  call('glBegin',[0]);reject(name,[0x2000,0x2501,output+8],0x502,name+' Begin');call('glEnd');
 }
 function bad(name,args,label,frame=stack){const thunk=resolve(name);if(args){write(frame,Buffer.alloc(4*(args.length+1)));args.forEach((v,i)=>write(frame+4+4*i,bytes([v|0],'i')));}
  const before=state(),used=e.gl_wat_stream_used(),count=e.probe_list_commands();dv.setUint32(regs+16,frame,true);dv.setUint32(regs,0xdeadbeef,true);
  assert.throws(()=>e.probe_invoke(thunk),WebAssembly.RuntimeError,label);assert.strictEqual(dv.getUint32(regs+16,true),frame,label+' ESP');assert.strictEqual(dv.getUint32(regs,true),0xdeadbeef,label+' EAX');
  assert.deepStrictEqual(state(),before,label+' state');assert.strictEqual(e.gl_wat_stream_used(),used,label+' stream');assert.strictEqual(e.probe_list_commands(),count,label+' list');checks++;
 }
 for(const [name,size] of [['glTexGendv',32],['glTexGeniv',16],['glTexGenfv',16]])for(const p of [0x65001000,0x65001000-size+1,0xffffffff])bad(name,[0x2000,0x2501,p],'bad vector '+name+'/'+p);
 for(const name of names.slice(3))for(const p of [0x65001000,0x65000ff9,0xffffffff]){
  new Uint8Array(memory.buffer,wa(0x65000ff0),16).fill(0xb8);bad(name,[0x2000,0x2501,p],'bad output '+name+'/'+p);assert(new Uint8Array(memory.buffer,wa(0x65000ff0),16).every(x=>x===0xb8),'atomic partial output');
 }
 bad('glTexGend',null,'missing final double',0x65000fef);bad('glTexGendv',null,'missing pointer slot',0x65000ff2);bad('glGetTexGendv',null,'wrapped query frame',0xfffffff8);
 assert(new Uint8Array(memory.buffer,wa(0x61000000),4096).every(x=>x===0x7f));assert(new Uint8Array(memory.buffer,wa(0x64000000),4096).every(x=>x===0x7e));
 // RasterPos and the bitmap fragment path consume the same canonical planes.
 call('glViewport',[0,0,8,8]);identity(0x1700);identity(0x1701);identity(0x1702);call('glActiveTextureARB',[0x84c0]);
 for(const cap of [0xc60,0xc61,0xc62,0xc63,0xb50,0xb60,0xb71])call('glDisable',[cap]);
 call('glColor4f',[f(1),f(1),f(1),f(1)]);call('glTexCoord4f',[f(.1),f(.2),f(.3),f(2)]);
 set('glTexGeniv',0x2000,0x2501,[1,0,0,1]);set('glTexGend',0x2000,0x2500,[0x2401]);call('glEnable',[0xc60]);
 set('glTexGendv',0x2001,0x2502,[0,1,0,1]);set('glTexGendv',0x2001,0x2500,[0x2400]);call('glEnable',[0xc61]);
 call('glRasterPos4f',[f(-.5),f(-.25),0,f(2)]);
 function raster(want,label){write(output,Buffer.alloc(16));call('glGetFloatv',[0xb06,output]);const b=read(output,16),got=want.map((_,i)=>b.readFloatLE(i*4));assert.deepStrictEqual(got,want,label);observations.push({label,actual:got,expected:want});checks++;}
 raster([1.5,1.75,Math.fround(.3),2],'object homogeneous w and stored eye coefficients');
 // Change both plane families and matrix after RasterPos: bitmap uses snapshot.
 const texels=e.guest_alloc(8)>>>0,bits=e.guest_alloc(1)>>>0;write(texels,Buffer.from([0,0,255,255,255,255,0,255]));write(bits,Buffer.from([0x80]));
 call('glPixelStorei',[0xcf5,1]);call('glPixelStorei',[0xd05,1]);call('glDrawBuffer',[0x405]);call('glReadBuffer',[0x405]);
 call('glBindTexture',[0xde1,37]);call('glTexImage2D',[0xde1,0,0x1908,2,1,0,0x1908,0x1401,texels]);call('glTexParameteri',[0xde1,0x2800,0x2600]);call('glTexParameteri',[0xde1,0x2801,0x2600]);call('glTexEnvi',[0x2300,0x2200,0x1e01]);call('glEnable',[0xde1]);
 set('glTexGeniv',0x2000,0x2501,[0,0,0,0]);set('glTexGendv',0x2001,0x2502,[0,0,0,0]);call('glTexCoord4f',[0,0,0,f(1)]);call('glMatrixMode',[0x1702]);call('glTranslatef',[f(.5),0,0]);
 call('glClearColor',[0,0,0,f(1)]);call('glClear',[0x4000]);call('glBitmap',[1,1,0,0,0,0,bits]);
 function pixel(x,y,want,label){call('glReadPixels',[x,y,1,1,0x1908,0x1401,output]);const got=Array.from(read(output,4));assert.deepStrictEqual(got,want,label);observations.push({label,actual:got,expected:want});checks++;}
 pixel(3,3,[255,255,0,255],'stored texgen S/Q samples literal yellow bitmap pixel');pixel(2,3,[0,0,0,255],'adjacent bitmap pixel untouched');
 raster([1.5,1.75,Math.fround(.3),2],'bitmap retains generated coordinate snapshot');
 call('glDisable',[0xde1]);identity(0x1702);identity(0x1700);
 // R/Q participate in generated raster coordinates, including captured eye plane.
 for(const [c,p,a] of [[0x2000,0x2501,[1,0,0,1]],[0x2001,0x2501,[0,1,0,1]],[0x2002,0x2501,[0,0,2,1]],[0x2003,0x2501,[0,0,0,2]]]){
  set('glTexGeniv',c,p,a);set('glTexGend',c,0x2500,[0x2401]);call('glEnable',[0xc60+c-0x2000]);
 }
 call('glRasterPos4f',[f(-.5),f(-.25),f(.5),f(2)]);raster([1.5,1.75,3,4],'S T R Q object planes generate raster coordinates');
 load(0x1700,[2,0,0,.5,1,4,0,0,0,0,8,0,3,-2,5,1]);set('glTexGendv',0x2002,0x2502,[4,9,24,18]);identity(0x1700);set('glTexGend',0x2002,0x2500,[0x2400]);
 call('glRasterPos4f',[f(-.5),f(-.25),f(.5),f(2)]);raster([1.5,1.75,8.5,4],'stored non-affine eye plane drives raster R');
 call('glActiveTextureARB',[0x84c1]);identity(0x1702);set('glTexGeniv',0x2000,0x2501,[2,0,0,1]);set('glTexGend',0x2000,0x2500,[0x2401]);call('glEnable',[0xc60]);call('glRasterPos4f',[f(-.5),f(-.25),0,f(2)]);raster([1,0,0,1],'second unit raster uses its own plane');
 call('glActiveTextureARB',[0x84c0]);raster([1.5,1.75,7,4],'unit zero raster remains independent');
 assert.strictEqual(call('glGetError'),0);
 if(queued){encoder.fence();assert(encoder.snapshot().glQueued>0,'real queue used');}
 const result={passed:true,route:queued?'queued':'direct',aliases:6,checks,observations};
 if(process.env.GL_TEXGEN_EVIDENCE)fs.writeFileSync(process.env.GL_TEXGEN_EVIDENCE,JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
 } finally {if(encoder)encoder.stop();if(manager)await manager.stop();if(render)render.destroy();}
})().catch(error=>{console.error(error.stack||error);process.exit(1);});
