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
 const queued=process.argv.includes('--worker'),mutation=process.env.GL_TEXTURE_STATE_QUERY_MUTATION,baseline=process.env.GL_TEXTURE_STATE_QUERY_BASELINE;
 let prebuiltModule;
 if(mutation||baseline){let changed=false;
  const bytes=req('test/compile-src').compileSrcWasm((file,source)=>{
   if(file==='13-exports.wat')return source+extraWat;
   if(baseline&&fs.existsSync(path.join(baseline,file))){changed=true;return fs.readFileSync(path.join(baseline,file),'utf8');}
   if(baseline)return source;
   const edits={
    decode:['09a8b-handlers-opengl.wat','$handle_gl_texture_set','(f64.const 4294967295)','(f64.const 2147483647)'],
    bias:['09a8b-handlers-opengl.wat','$gl_texture_query','(f64.const 4294967295)','(f64.const 4294967294)'],
    numeric:['09a8b-handlers-opengl.wat','$gl_texture_query','(if (local.get $color) (then','(if (i32.const 1) (then'],
    unit:['09a8b-handlers-opengl.wat','$gl_texture_env','(i32.load offset=4 (call $gl_mtx_block))','(i32.const 0)'],
    bound:['09a8b-handlers-opengl.wat','$gl_texture_query','(i32.load (call $gl_texture_binding (local.get $b) (local.get $target)))','(i32.add (local.get $b) (i32.const 136))'],
    defaults:['09a8b-handlers-opengl.wat','$gl_texture_object_init','(i32.const 0x2702)','(i32.const 0x2600)'],
    clamp:['09a8b-handlers-opengl.wat','$gl_texture_clamp','(f32.min (f32.const 1) (f32.max (f32.const 0) (local.get $v)))','(local.get $v)'],
    width:['09a8b-handlers-opengl.wat','$gl_texture_query','(i32.lt_u (local.get $i) (local.get $n))','(i32.le_u (local.get $i) (local.get $n))'],
    validation:['09a8b-handlers-opengl.wat','$gl_texture_query','(call $gl_texcoord_check (local.get $out) (i32.shl (local.get $n) (i32.const 2)))','(call $gl_texcoord_check (local.get $out) (i32.const 1))'],
    begin:['09a8b-handlers-opengl.wat','$gl_texture_query','(if (i32.ge_s (global.get $gl_immediate_mode) (i32.const 0))','(if (i32.const 0)'],
    compile:['09a8b-handlers-opengl.wat','$gl_texture_query','(if (local.get $error) (then','(if (i32.or (local.get $error) (i32.ne (i32.load offset=12 (local.get $ctx)) (i32.const 0))) (then'],
    pixel:['09a8b-handlers-opengl.wat','$gl_texture_combine','(else (if (result i32) (i32.eq (local.get $mode) (i32.const 0xbe2))','(else (if (result i32) (i32.eq (local.get $mode) (i32.const 0xffff))'],
   };
   assert(edits[mutation],'known mutation');const [fileName,func,from,to]=edits[mutation];if(file!==fileName)return source;
   const at=source.indexOf('(func '+func+' ');assert(at>=0,'mutation function '+func);
   const body=source.slice(at);assert(body.includes(from),'mutation anchor '+mutation);changed=true;
   return source.slice(0,at)+body.replace(from,to);
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
 const names=['glTexEnvfv','glTexEnviv','glGetTexEnvfv','glGetTexEnviv','glGetTexParameteriv'];
 for(const name of names){assert(call('wglGetProcAddress',[str(name)]),'dynamic texture '+name);assert(resolve(name),'system texture '+name);checks++;}
 const vector=e.guest_alloc(64)>>>0,output=e.guest_alloc(64)>>>0;
 const bytes=(a,integer=false)=>{const b=Buffer.alloc(a.length*4);a.forEach((v,i)=>integer?b.writeInt32LE(v,i*4):b.writeFloatLE(v,i*4));return b;};
 const write=(p,b)=>{for(let i=0;i<b.length;i++)dv.setUint8(wa(p+i),b[i]);};
 const read=(p,n)=>Buffer.from(Array.from({length:n},(_,i)=>dv.getUint8(wa(p+i))));
 const setEnv=(p,a,integer=false,at=vector)=>{write(at,bytes(a,integer));call(integer?'glTexEnviv':'glTexEnvfv',[0x2300,p,at]);};
 function query(name,target,pname,want,label,at=output+8){
  write(at-8,Buffer.alloc(40,0xa7));call(name,[target,pname,at]);
  const b=read(at,want.length*4),got=want.map((_,i)=>name.endsWith('iv')?b.readInt32LE(i*4):b.readFloatLE(i*4));
  assert.deepStrictEqual(got,want,label+' '+name);
  assert(read(at-8,8).every(v=>v===0xa7),label+' prefix');assert(read(at+want.length*4,32-want.length*4).every(v=>v===0xa7),label+' exact width');
  observations.push({label,name,actual:got,expected:want});checks++;
 }
 const env=(p,fv,iv,label)=>{query('glGetTexEnvfv',0x2300,p,fv,label);query('glGetTexEnviv',0x2300,p,iv,label);};
 const param=(target,p,fv,iv,label)=>{query('glGetTexParameterfv',target,p,fv,label);query('glGetTexParameteriv',target,p,iv,label);};
 // Literal GL1.1 table6.11/12 defaults, independent of setters/host state.
 for(const unit of [0,1]){
  call('glActiveTextureARB',[0x84c0+unit]);env(0x2200,[0x2100],[0x2100],'default env mode '+unit);env(0x2201,[0,0,0,0],[0,0,0,0],'default env color '+unit);
  for(const target of [0xde0,0xde1])for(const [p,v] of [[0x2800,0x2601],[0x2801,0x2702],[0x2802,0x2901],[0x2803,0x2901],[0x8066,1],[0x8067,1]])param(target,p,[v],[v],'default parameter '+unit+'/'+target+'/'+p);
  for(const target of [0xde0,0xde1])param(target,0x1004,[0,0,0,0],[0,0,0,0],'default border '+unit+'/'+target);
 }
 call('glActiveTextureARB',[0x84c0]);
 // All four modes through scalar/vector and float/integer setters.
 for(const mode of [0x2100,0x2101,0x1e01,0xbe2]){
  setEnv(0x2200,[mode],true);env(0x2200,[mode],[mode],'integer vector mode');
  setEnv(0x2200,[mode]);env(0x2200,[mode],[mode],'float vector mode');
  call('glTexEnvi',[0x2300,0x2200,mode]);env(0x2200,[mode],[mode],'integer scalar mode');
  call('glTexEnvf',[0x2300,0x2200,f(mode+.125)]);env(0x2200,[mode],[mode],'float scalar enum rounding');
 }
 for(const [input,fv,iv] of [
  [[-2,.25,.75,3],[0,.25,.75,1],[0,536870911,1610612735,2147483647]],
  [[.5,.125,.875,0],[.5,.125,.875,0],[1073741823,268435455,1879048191,0]],
 ]){setEnv(0x2201,input);env(0x2201,fv,iv,'clamped float environment');}
 for(const [input,fv,iv] of [
  [[-2147483648,0,1073741824,2147483647],[0,2.3283064365386963e-10,.5,1],[0,0,1073741823,2147483647]],
  [[536870912,1610612736,-1,2147483646],[.25,.75,0,1],[536870911,1610612735,0,2147483647]],
 ]){setEnv(0x2201,input,true);env(0x2201,fv,iv,'signed integer environment normalization');}
 // Each legal filter/wrap value; all established setter forms feed native queries.
 for(const target of [0xde0,0xde1]){
  for(const [p,values] of [[0x2800,[0x2600,0x2601]],[0x2801,[0x2600,0x2601,0x2700,0x2701,0x2702,0x2703]],[0x2802,[0x2900,0x2901]],[0x2803,[0x2900,0x2901]]])for(const v of values){
   call('glTexParameteri',[target,p,v]);param(target,p,[v],[v],'integer scalar parameter');
   call('glTexParameterf',[target,p,f(v+.125)]);param(target,p,[v],[v],'float scalar parameter');
   write(vector,bytes([v+.125]));call('glTexParameterfv',[target,p,vector]);param(target,p,[v],[v],'float vector parameter');
  }
  for(const [input,fv,iv] of [[-.5,0,0],[.25,.25,0],[.75,.75,1],[1.5,1,1]]){
   call('glTexParameterf',[target,0x8066,f(input)]);param(target,0x8066,[fv],[iv],'priority is ordinary numeric');
   write(vector,bytes([input]));call('glTexParameterfv',[target,0x8066,vector]);param(target,0x8066,[fv],[iv],'vector priority');
  }
  call('glTexParameteri',[target,0x8066,-7]);param(target,0x8066,[0],[0],'negative integer priority');call('glTexParameteri',[target,0x8066,5]);param(target,0x8066,[1],[1],'positive integer priority');
  write(vector,bytes([-1,.25,.75,2]));call('glTexParameterfv',[target,0x1004,vector]);param(target,0x1004,[0,.25,.75,1],[0,536870911,1610612735,2147483647],'bound border color');
 }
 call('glTexParameteri',[0xde1,0x2801,0x2702]);
 // Names instantiate only at BindTexture, targets retain dimensionality.
 assert.strictEqual(call('glIsTexture',[77]),0,'lookup does not instantiate');call('glBindTexture',[0xde1,77]);assert.strictEqual(call('glIsTexture',[77]),1);
 param(0xde1,0x2801,[0x2702],[0x2702],'new object defaults');call('glTexParameteri',[0xde1,0x2802,0x2900]);
 call('glBindTexture',[0xde1,78]);param(0xde1,0x2802,[0x2901],[0x2901],'different object');call('glTexParameteri',[0xde1,0x2801,0x2600]);
 call('glActiveTextureARB',[0x84c1]);call('glBindTexture',[0xde1,77]);param(0xde1,0x2802,[0x2900],[0x2900],'same object shared across units');
 setEnv(0x2201,[1,.5,0,.25]);env(0x2201,[1,.5,0,.25],[2147483647,1073741823,0,536870911],'unit1 env');setEnv(0x2200,[0x2101]);
 call('glActiveTextureARB',[0x84c0]);env(0x2201,[.25,.75,0,1],[536870911,1610612735,0,2147483647],'unit0 env isolation');env(0x2200,[0xbe2],[0xbe2],'unit0 mode isolation');param(0xde1,0x2801,[0x2600],[0x2600],'unit0 binding isolation');
 call('glBindTexture',[0xde0,77]);assert.strictEqual(call('glGetError'),0x502,'object dimension mismatch');param(0xde0,0x1004,[0,.25,.75,1],[0,536870911,1610612735,2147483647],'dimension mismatch unchanged');
 const other=call('wglCreateContext',[dc]);call('wglMakeCurrent',[dc,other]);env(0x2200,[0x2100],[0x2100],'fresh context env');env(0x2201,[0,0,0,0],[0,0,0,0],'fresh context color');assert.strictEqual(call('glIsTexture',[77]),0,'context object isolation');
 call('glBindTexture',[0xde1,77]);param(0xde1,0x2802,[0x2901],[0x2901],'same name other context');setEnv(0x2201,[.5,1,.25,0]);call('glTexParameteri',[0xde1,0x2801,0x2703]);call('wglMakeCurrent',[dc,context]);
 env(0x2201,[.25,.75,0,1],[536870911,1610612735,0,2147483647],'context restored color');param(0xde1,0x2801,[0x2600],[0x2600],'context restored object');
 // TEXTURE_BIT restores bound object parameters as well as bindings/envs.
 call('glPushAttrib',[0x40000]);setEnv(0x2201,[.5,.5,.5,.5]);call('glTexParameteri',[0xde1,0x2801,0x2701]);call('glBindTexture',[0xde1,77]);call('glTexParameteri',[0xde1,0x2802,0x2901]);
 call('glActiveTextureARB',[0x84c1]);setEnv(0x2201,[0,0,1,1]);call('glPopAttrib');
 env(0x2201,[.25,.75,0,1],[536870911,1610612735,0,2147483647],'texture attrib env');param(0xde1,0x2801,[0x2600],[0x2600],'texture attrib bound parameter');
 call('glActiveTextureARB',[0x84c1]);env(0x2201,[1,.5,0,.25],[2147483647,1073741823,0,536870911],'texture attrib unit1 color');param(0xde1,0x2802,[0x2900],[0x2900],'texture attrib unit1 parameter');
 call('glActiveTextureARB',[0x84c0]);call('glPushAttrib',[0x100]);setEnv(0x2201,[0,1,0,1]);call('glPopAttrib');env(0x2201,[0,1,0,1],[0,2147483647,0,2147483647],'other attribute mask leaves texture');
 // Immediate Get during COMPILE, including a shadow Begin; input vectors snapshot.
 const list=call('glGenLists',[1]);call('glNewList',[list,0x1300]);setEnv(0x2201,[.125,.5,.875,1]);setEnv(0x2200,[0x1e01]);
 env(0x2201,[0,1,0,1],[0,2147483647,0,2147483647],'compile queries immediate');call('glBegin',[4]);env(0x2200,[0xbe2],[0xbe2],'shadow Begin queries immediate');call('glEnd');call('glEndList');write(vector,bytes([1,0,0,0]));call('glCallList',[list]);
 env(0x2201,[.125,.5,.875,1],[268435455,1073741823,1879048191,2147483647],'list input snapshot');env(0x2200,[0x1e01],[0x1e01],'list mode snapshot');
 const plist=call('glGenLists',[1]);call('glNewList',[plist,0x1300]);write(vector,bytes([.375,.625,.25,1]));call('glTexParameterfv',[0xde1,0x1004,vector]);call('glEndList');write(vector,bytes([1,1,1,0]));call('glCallList',[plist]);param(0xde1,0x1004,[.375,.625,.25,1],[805306367,1342177279,536870911,2147483647],'parameter list snapshot');
 // No query is recorded: replay must not write into the earlier output pointer.
 const getlist=call('glGenLists',[1]);call('glNewList',[getlist,0x1300]);query('glGetTexEnviv',0x2300,0x2200,[0x1e01],'query list immediate');query('glGetTexParameteriv',0xde1,0x2801,[0x2600],'parameter query list immediate');call('glEndList');write(output,Buffer.alloc(64,0x5a));call('glCallList',[getlist]);assert(read(output,64).every(v=>v===0x5a),'Get not recorded');
 // Illegal enums and executed Begin reject atomically, with sticky GL errors.
 const snapshot=()=>{const p=e.probe_texture();return Buffer.concat([Buffer.from(new Uint8Array(memory.buffer,p,192)),...Array.from({length:4},(_,i)=>Buffer.from(new Uint8Array(memory.buffer,dv.getUint32(p+16+i*4,true),56)))]);};
 for(const [name,args] of [
  ['glTexEnvfv',[0xde1,0x2201,0xfffffff0]],['glTexEnviv',[0x2300,0x9999,0xfffffff0]],['glTexEnvi',[0x2300,0x2201,0]],['glTexEnvf',[0x2300,0x2200,f(42)]],
  ['glTexParameteri',[0xde1,0x8067,1]],['glTexParameterfv',[0xde1,0x9999,0xfffffff0]],['glTexParameterf',[0xde1,0x1004,f(.5)]],
  ['glGetTexEnvfv',[0xde1,0x2201,0xfffffff0]],['glGetTexEnviv',[0x2300,0x2800,0xfffffff0]],['glGetTexParameteriv',[0x8064,0x2800,0xfffffff0]],['glGetTexParameteriv',[0xde1,0x1005,0xfffffff0]],['glGetTexParameteriv',[0xde1,0x813a,0xfffffff0]],
 ]){const state=snapshot(),used=e.gl_wat_stream_used();call(name,args);assert.deepStrictEqual(snapshot(),state,'invalid call atomic '+name);assert.strictEqual(e.gl_wat_stream_used(),used,'invalid call no stream '+name);assert.strictEqual(call('glGetError'),0x500,name+' INVALID_ENUM');checks++;}
 write(output,Buffer.alloc(64,0x59));call('glBegin',[4]);const beginState=snapshot(),beginCount=e.probe_count();
 for(const name of ['glGetTexEnvfv','glGetTexEnviv','glGetTexParameteriv']){
  call(name,[name.includes('Parameter')?0xde1:0x2300,name.includes('Parameter')?0x1004:0x2201,output]);
  assert(read(output,64).every(v=>v===0x59),'Begin query preserves output '+name);checks++;
 }
 for(const name of names){call(name,[name.includes('Parameter')?0xde1:0x2300,name.includes('Parameter')?0x1004:0x2201,0xfffffff0]);assert.deepStrictEqual(snapshot(),beginState,'Begin atomic '+name);assert.strictEqual(e.probe_count(),beginCount);}
 call('glEnd');assert.strictEqual(call('glGetError'),0x502,'Begin error survives all calls');
 // Nonaffine sparse vectors, output, frame, and exact scalar/vector extents.
 for(const p of [0x60000000,0x61000000,0x60001000,0x63000000,0x64000000,0x63001000,0x65000000])assert(e.test_virtual_map_commit(p,4096));
 assert.notStrictEqual(wa(0x60001000)-wa(0x60000000),4096);assert.notStrictEqual(wa(0x63001000)-wa(0x63000000),4096);
 new Uint8Array(memory.buffer,wa(0x61000000),4096).fill(0x7f);new Uint8Array(memory.buffer,wa(0x64000000),4096).fill(0x7e);
 setEnv(0x2201,[-2147483648,0,1073741824,2147483647],true,0x60000ffd);env(0x2201,[0,2.3283064365386963e-10,.5,1],[0,0,1073741823,2147483647],'split integer input');
 setEnv(0x2201,[.25,.5,.75,1],false,0x60000fff);query('glGetTexEnvfv',0x2300,0x2201,[.25,.5,.75,1],'split float output',0x63000ffd);query('glGetTexEnviv',0x2300,0x2201,[536870911,1073741823,1610612735,2147483647],'split integer output',0x63000fff);
 for(const [name,target,pname,values,integer] of [['glTexEnvfv',0x2300,0x2201,[.25,.5,.75,1],false],['glTexEnviv',0x2300,0x2201,[536870912,1073741824,1610612736,2147483647],true],['glTexParameterfv',0xde1,0x1004,[.25,.5,.75,1],false]]){
  const end=0x65001000;for(const [p,a] of [[pname,values],[name.includes('Parameter')?0x2801:0x2200,[name.includes('Parameter')?0x2600:0x2100]]]){write(end-a.length*4,bytes(a,integer));call(name,[target,p,end-a.length*4]);checks++;}
 }
 for(const [name,target,pname,want] of [['glGetTexEnvfv',0x2300,0x2201,[.25,.5,.75,1]],['glGetTexEnviv',0x2300,0x2201,[536870911,1073741823,1610612735,2147483647]],['glGetTexParameteriv',0xde1,0x1004,[536870911,1073741823,1610612735,2147483647]]]){
  const at=0x60000ff9,out=0x63000fff,frame=Buffer.alloc(32,0xa7);frame.writeUInt32LE(0x12345678,8);frame.writeUInt32LE(target,12);frame.writeUInt32LE(pname,16);frame.writeUInt32LE(out,20);write(at-8,frame);write(out-8,Buffer.alloc(40,0x6b));
  dv.setUint32(regs+16,at,true);e.probe_invoke(resolve(name));assert.strictEqual(dv.getUint32(regs+16,true),at+16);assert.deepStrictEqual(read(at-8,32),frame);const actual=read(out,16);assert.deepStrictEqual(want.map((_,i)=>name.endsWith('iv')?actual.readInt32LE(i*4):actual.readFloatLE(i*4)),want,'split frame values');checks++;
  for(const [p,n] of [[pname,4],[name.includes('Parameter')?0x2800:0x2200,1]]){write(0x65001000-n*4-8,Buffer.alloc(n*4+8,0x4b));call(name,[target,p,0x65001000-n*4]);assert(read(0x65001000-n*4-8,8).every(v=>v===0x4b));checks++;}
 }
 function bad(name,at,args,label){const thunk=resolve(name);if(args){const frame=Buffer.alloc(16);frame.writeUInt32LE(0x12345678);args.forEach((x,i)=>frame.writeUInt32LE(x>>>0,4+i*4));write(at,frame);}
  for(let i=0;i<8;i++)dv.setUint32(regs+i*4,0x55660000+i,true);dv.setUint32(regs+16,at,true);dv.setUint32(regs,0xdeadbeef,true);
  const before=read(output,64),state=snapshot(),stored=Buffer.from(new Uint8Array(memory.buffer,e.probe_block(),11216)),used=e.gl_wat_stream_used();assert.throws(()=>e.probe_invoke(thunk),WebAssembly.RuntimeError,label);
  assert.strictEqual(dv.getUint32(regs+16,true),at,label+' ESP');assert.strictEqual(dv.getUint32(regs,true),0xdeadbeef,label+' EAX');assert.deepStrictEqual(read(output,64),before,label+' output');assert.strictEqual(e.gl_wat_stream_used(),used,label+' stream');assert.deepStrictEqual(snapshot(),state,label+' texture state');assert.deepStrictEqual(Buffer.from(new Uint8Array(memory.buffer,e.probe_block(),11216)),stored,label+' stored state');checks++;
 }
 for(const name of names){const target=name.includes('Parameter')?0xde1:0x2300,p=name.includes('Parameter')?0x1004:0x2201;
  for(const at of [0x65001000,0x65000ff8,0xfffffff8]){write(0x65000ff8,Buffer.alloc(8,0x69));bad(name,stack,[target,p,at],'malformed payload '+name);assert(read(0x65000ff8,8).every(v=>v===0x69),'partial atomic');}
  for(const at of [0x64fffffc,0x65000ff4,0x65000ffa,0xfffffff8])bad(name,at,null,'malformed frame '+name);
 }
 assert(new Uint8Array(memory.buffer,wa(0x61000000),4096).every(x=>x===0x7f));assert(new Uint8Array(memory.buffer,wa(0x64000000),4096).every(x=>x===0x7e));
 // Real textured pixels for all modes; old environments cannot pass BLEND.
 call('glActiveTextureARB',[0x84c1]);call('glDisable',[0xde1]);call('glActiveTextureARB',[0x84c0]);
 call('glMatrixMode',[0x1700]);call('glLoadIdentity');call('glMatrixMode',[0x1701]);call('glLoadIdentity');call('glMatrixMode',[0x1702]);call('glLoadIdentity');call('glMatrixMode',[0x1700]);call('glViewport',[0,0,8,8]);call('glDisable',[0xb50]);call('glDisable',[0xb71]);call('glDisable',[0xbe2]);
 call('glBindTexture',[0xde1,91]);call('glTexParameteri',[0xde1,0x2800,0x2600]);call('glTexParameteri',[0xde1,0x2801,0x2600]);call('glEnable',[0xde1]);call('glPixelStorei',[0xcf5,1]);call('glTexCoord2f',[f(.5),f(.5)]);
 const pixel=e.guest_alloc(4)>>>0,rgba=e.guest_alloc(256)>>>0;
 function draw(){call('glBegin',[7]);for(const v of [[-1,-1],[1,-1],[1,1],[-1,1]])call('glVertex2f',v.map(f));call('glEnd');}
 function framebuffer(want,label){call('glFinish');if(queued)encoder.fence();call('glReadPixels',[0,0,8,8,0x1908,0x1401,rgba]);const got=read(rgba,256);for(let i=0;i<64;i++)assert.deepStrictEqual([...got.subarray(i*4,i*4+4)],want,label+' fullframe pixel'+i);observations.push({label,pixel:want});checks++;}
 write(pixel,Buffer.from([64,128,192,128]));call('glTexImage2D',[0xde1,0,0x1908,1,1,0,0x1908,0x1401,pixel]);call('glColor4f',[f(128/255),f(64/255),f(32/255),f(192/255)]);setEnv(0x2201,[1,0,1,1]);
 for(const [mode,want] of [[0x1e01,[64,128,192,128]],[0x2100,[32,32,24,96]],[0x2101,[96,96,112,192]],[0xbe2,[160,32,200,96]]]){setEnv(0x2200,[mode]);draw();framebuffer(want,'RGBA environment mode '+mode);}
 // RGB REPLACE preserves fragment alpha (table3.10).
 write(pixel,Buffer.from([64,128,192]));call('glTexImage2D',[0xde1,0,0x1907,1,1,0,0x1907,0x1401,pixel]);setEnv(0x2200,[0x1e01]);draw();framebuffer([64,128,192,192],'RGB replace alpha');
 // The remaining defined GL1.1 base-format rows; DECAL is undefined here.
 for(const [internal,format,data,expected] of [
  [0x1909,0x1909,[64],[[64,64,64,192],[32,16,8,192],[160,48,88,192]]],
  [0x190a,0x190a,[64,128],[[64,64,64,128],[32,16,8,96],[160,48,88,96]]],
  [0x1906,0x1906,[128],[[128,64,32,128],[128,64,32,96],[128,64,32,96]]],
  [0x8049,0x1909,[64],[[64,64,64,64],[32,16,8,48],[160,48,88,208]]],
 ]){
  write(pixel,Buffer.from(data));call('glTexImage2D',[0xde1,0,internal,1,1,0,format,0x1401,pixel]);setEnv(0x2201,[1,0,1,1]);
  for(const [i,mode] of [0x1e01,0x2100,0xbe2].entries()){setEnv(0x2200,[mode]);draw();framebuffer(expected[i],'base format '+internal+' mode '+mode);}
 }
 // Queued environment is captured at each draw, before a later setter changes it.
 write(pixel,Buffer.from([255,255,255,255]));call('glTexImage2D',[0xde1,0,0x1908,1,1,0,0x1908,0x1401,pixel]);setEnv(0x2200,[0xbe2]);setEnv(0x2201,[1,0,0,1]);draw();setEnv(0x2201,[0,1,0,1]);framebuffer([255,0,0,192],'draw environment snapshot');
 call('glActiveTextureARB',[0x84c1]);call('glBindTexture',[0xde1,92]);call('glTexParameteri',[0xde1,0x2800,0x2600]);call('glTexParameteri',[0xde1,0x2801,0x2600]);call('glTexImage2D',[0xde1,0,0x1908,1,1,0,0x1908,0x1401,pixel]);call('glEnable',[0xde1]);setEnv(0x2200,[0xbe2]);setEnv(0x2201,[0,0,1,1]);draw();setEnv(0x2201,[1,1,0,1]);framebuffer([0,0,255,192],'unit1 draw environment snapshot');call('glDisable',[0xde1]);call('glActiveTextureARB',[0x84c0]);
 write(vector,bytes([91],true));call('glDeleteTextures',[1,vector]);assert.strictEqual(call('glIsTexture',[91]),0);param(0xde1,0x2801,[0x2702],[0x2702],'deleted bound object uses default');
 call('glBindTexture',[0xde1,91]);param(0xde1,0x2801,[0x2702],[0x2702],'rebound name fresh parameters');
 if(queued){encoder.fence();assert(encoder.snapshot().glQueued>0,'real queue used');}
 assert.strictEqual(call('glGetError'),0);
 const result={passed:true,route:queued?'queued':'direct',exports:names,checks,observations};
 if(process.env.GL_TEXTURE_STATE_QUERY_EVIDENCE)fs.writeFileSync(process.env.GL_TEXTURE_STATE_QUERY_EVIDENCE,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{if(encoder)encoder.stop();if(manager)await manager.stop();if(render)render.destroy();}
})().catch(error=>{console.error(error.stack||error);process.exit(1);});
