'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const root=process.env.WINE_ROOT||'/home/user/wine-assembly',req=p=>require(path.join(root,p));
const {bootRenderHarness}=req('test/render-helper');
const Stream=req('lib/gl-command-stream');
const extraWat=`
 (func (export "ci_sparse_page") (param $p i32) (result i32)
   (call $virtual_map_commit (local.get $p) (i32.const 4096)))
 (func (export "sf_dynamic") (param $p i32) (result i32)
  (local $esp i32) (local $answer i32)
  (local.set $esp (i32.load offset=16 (global.get $reg_base)))
  (call $handle_gpu_api (i32.const 50) (i32.const 1) (local.get $p) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
  (local.set $answer (i32.load (global.get $reg_base)))
  (i32.store offset=16 (global.get $reg_base) (local.get $esp)) (local.get $answer))
 (func (export "sf_pending") (result i32) (global.get $d3dim_worker_pending))
 (func (export "sf_init")
   (global.set $thunk_guest_base (i32.add (global.get $image_base) (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
   (call $update_thunk_end))
 (func (export "sf_regs") (result i32) (global.get $reg_base))
 (func (export "sf_module") (param $name i32) (result i32)
   (call $handle_LoadLibraryA (local.get $name) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "sf_lookup") (param $module i32) (param $name i32) (result i32)
   (call $handle_GetProcAddress (local.get $module) (local.get $name) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "sf_invoke") (param $thunk i32) (result i32)
   (call $win32_dispatch (i32.div_u (i32.sub (local.get $thunk) (global.get $thunk_guest_base)) (i32.const 8))) (i32.load (global.get $reg_base)))(func (export "sf_dc") (result i32)
 (call $handle_GetDC (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
 (drop (call $gdi_dc_set_field (i32.load (global.get $reg_base)) (i32.const 92) (i32.const 42) (i32.const 0)))
 (i32.load (global.get $reg_base)))`;
(async()=>{
 const queued=process.argv.includes('--worker');let encoder=null,manager=null,bridge=null,render=null,producer=null,memory;
 let forceNoRaster=false;let prebuiltModule=null;const batches=[],cases={};
 const recordModule=bytes=>{
  const sha256=require('crypto').createHash('sha256').update(bytes).digest('hex');
  console.log('CI_MODULE_SHA256',sha256,'bytes',bytes.length);
  if(process.env.GL_CI_MODULE_OUT)fs.writeFileSync(process.env.GL_CI_MODULE_OUT,bytes);
 };
 if(process.env.GL_CI_MUTATION){
  const mutation=JSON.parse(fs.readFileSync(process.env.GL_CI_MUTATION));let applied=false;
  const bytes=req('test/compile-src').compileSrcWasm((file,source)=>{
   if(file===mutation.file){assert.strictEqual(source.split(mutation.from).length-1,1,'unique mutation');source=source.replace(mutation.from,mutation.to);applied=true;}
   return file==='13-exports.wat'?source+extraWat:source;
  });assert(applied);recordModule(bytes);prebuiltModule=new WebAssembly.Module(bytes);
 }
 if(!prebuiltModule){
  const bytes=process.env.GL_CI_MODULE?fs.readFileSync(process.env.GL_CI_MODULE):req('test/compile-src').compileSrcWasm((file,source)=>file==='13-exports.wat'?source+extraWat:source);
  recordModule(bytes);prebuiltModule=new WebAssembly.Module(bytes);
 }
 const h=await bootRenderHarness({fonts:'none',...(prebuiltModule?{prebuiltModule}:{extraWat}),width:64,height:64,extraHostOverrides:{gpu_gl_call(op,at,bytes){
  if(op===Stream.WAT_STREAM_FLUSH_OPCODE){
   const batch=Stream.memoryBatch(memory,at,bytes);let lifecycle=false;
   Stream.replay(batch,op=>{if(op===48||op===51)lifecycle=true;});
   if(!lifecycle)batches.push(Array.from(new Uint8Array(memory.buffer,at,bytes)));
   if(!render)return bridge.replay(Stream.memoryBatch(memory,at,bytes));
   const reply=render.execute({memoryOffset:at,bytes,owner:0,windows:Object.values(renderer.windows),softwareFront:e.gl_sw_front()});producer.configure(forceNoRaster?[0,0,0,0]:reply.producerConfig);return reply.value;
  }
  return encoder?encoder.call(op,at,bytes):0;
 }}});
 memory=h.memory;const e=h.exports,dv=new DataView(memory.buffer),wa=p=>e.guest_to_wasm(p)>>>0;
 e.init_thread(1,0x400000,0,0,0,0,0);e.heap_init(0x800000);
 const renderer={windows:{42:{hwnd:42,w:64,h:64,clientRect:{w:64,h:64}}},repaint(){}};
 const GL=req('lib/gl-compat');bridge=new GL.OpenGLHostBridge({backend:'software',getMemory:()=>memory.buffer,exports:e,renderer});
 if(queued){const {Worker}=require('worker_threads'),{Manager}=req('lib/render-worker'),{Encoder}=req('lib/d3d-command-stream');
  producer=new (req('lib/gl-software-producer').Producer)(()=>e);
  const consumer=new WebAssembly.Instance(h.module,{host:h.host});consumer.exports.d3dim_worker_init(e.get_image_base()>>>0);
  const Base=GL.OpenGLHostBridge;GL.OpenGLHostBridge=class extends Base {constructor(o){super(o);bridge=this;}};
  try{render=req('lib/gl-render-worker').create({instance:consumer,memory,backend:'software',sendFrame(){}});}finally{GL.OpenGLHostBridge=Base;}
  manager=new Manager({module:h.module,memory,sigs:req('lib/host-import-sigs.generated.json').sigs,imageBase:e.get_image_base()>>>0,workerFactory:()=>new Worker(path.join(root,'lib/d3d-render-worker.js')),reclaimHeap:head=>e.d3d_render_adopt_free_list(head)});
  await manager.ready;const port=manager.createEndpoint({api:'legacy',backend:'software'});await port.ready;
  // Keep whole polygon records and their state in the actual Worker queue.
  encoder=new Encoder({module:h.module,memory,sigs:req('lib/host-import-sigs.generated.json').sigs,getImageBase:()=>e.get_image_base()>>>0,guestToWasm:wa,workerFactory:()=>port,capacity:0x400000,explicitFence:true,strictReady:true});assert(encoder.ready());
 }
 try {
 e.sf_init();const regs=e.sf_regs(),stackGuest=e.guest_alloc(256)>>>0,stack=wa(stackGuest),input=e.guest_alloc(1024)>>>0,output=e.guest_alloc(1024)>>>0;
 function str(s){const p=e.guest_alloc(s.length+1)>>>0;new Uint8Array(memory.buffer,wa(p),s.length+1).set(Buffer.from(s+'\0'));return p;}
 const module=e.sf_module(str('opengl32.dll'));assert(module);const resolved=new Map(),table=req('src/api_table.json');
 function call(name,args=[],float=false,route='static'){
  const key=name+route;
  if(!resolved.has(key)){dv.setUint32(regs+16,stackGuest,true);const p=(route==='dynamic'?e.sf_dynamic(str(name)):e.sf_lookup(module,str(name)))>>>0;assert(p,'real export '+name);assert.strictEqual(dv.getUint32(wa(p)+4,true),table.find(a=>a.name===name).id);resolved.set(key,p);}
  for(let i=0;i<8;i++)dv.setUint32(regs+i*4,0x55660000+i,true);
  dv.setUint32(regs+16,stackGuest,true);new Uint8Array(memory.buffer,stack,256).fill(0xa5);
  dv.setUint32(stack,0x12345678,true);args.forEach((v,i)=>(float===true||Array.isArray(float)&&float.includes(i))?dv.setFloat32(stack+4+i*4,v,true):dv.setUint32(stack+4+i*4,v>>>0,true));
  const before=Buffer.from(new Uint8Array(memory.buffer,stack,256)),value=e.sf_invoke(resolved.get(key))>>>0;
  assert.strictEqual(dv.getUint32(regs+16,true),stackGuest+4*(args.length+1),'stdcall '+name);
  for(let i=1;i<8;i++)if(i!==4)assert.strictEqual(dv.getUint32(regs+i*4,true),0x55660000+i,'register '+name);
  assert.deepStrictEqual(Buffer.from(new Uint8Array(memory.buffer,stack,256)),before,'stack canary '+name);return value;
 }
 const dc=e.sf_dc()>>>0,context=call('wglCreateContext',[dc]);assert(context);assert.strictEqual(call('wglMakeCurrent',[dc,context]),1);e.gl_sw_set_default_size(64,64);
 call('glViewport',[0,0,64,64]);e.gl_mtx_set_mode(0x1701);e.gl_mtx_load_identity();e.gl_mtx_ortho(0,64,0,64,-1,1);e.gl_mtx_set_mode(0x1700);e.gl_mtx_load_identity();
 call('glColor4f',[1,1,1,1],true);call('glClearColor',[0,0,0,1],true);

 const clear=()=>call('glClear',[0x4500]);
 const draw=(mode,pts,flags)=>{call('glBegin',[mode]);pts.forEach((p,i)=>{if(flags)call('glEdgeFlag',[flags[i%flags.length]]);call(p.length===3?'glVertex3f':'glVertex2f',p,true);});call('glEnd');};
 const pixel=(x,y)=>{const entry=e.gl_sw_entry()>>>0,pitch=dv.getUint16(entry+18,true),height=dv.getUint16(entry+14,true),dib=dv.getUint32(entry+20,true);return dv.getUint32(dib+(height-1-y)*pitch+4*x,true)&0xffffff;};
 const region=(x,y,r=1)=>{if(encoder)encoder.fence();let count=0;for(let a=x-r;a<=x+r;a++)for(let b=y-r;b<=y+r;b++)if(a>=0&&a<64&&b>=0&&b<64&&pixel(a,b))count++;return count;};
 const take=name=>{e.gl_wat_stream_flush();if(encoder)encoder.fence();cases[name]=batches.splice(0);
  if(process.env.GL_CI_PIXELS&&name!=='setup'){
   const {PNG}=require('pngjs'),png=new PNG({width:64,height:64});
   for(let y=0;y<64;y++)for(let x=0;x<64;x++){const v=pixel(x,63-y),i=(y*64+x)*4;png.data.set([(v>>>16)&255,(v>>>8)&255,v&255,255],i);}
   fs.mkdirSync(process.env.GL_CI_PIXELS,{recursive:true});fs.writeFileSync(path.join(process.env.GL_CI_PIXELS,name+'.png'),PNG.sync.write(png));
  }
 };
 const query=p=>{call('glGetIntegerv',[p,output]);return dv.getInt32(wa(output),true);};


 const err=()=>call('glGetError');
 const q=(p,name='glGetFloatv')=>{new Uint8Array(memory.buffer,wa(output),32).fill(0xcd);call(name,[p,output]);
  const width=name==='glGetDoublev'?8:name==='glGetBooleanv'?1:4;
  assert.strictEqual(dv.getUint8(wa(output)+width),0xcd,'query canary '+name);
  return name==='glGetDoublev'?dv.getFloat64(wa(output),true):name==='glGetBooleanv'?dv.getUint8(wa(output)):name==='glGetIntegerv'?dv.getInt32(wa(output),true):dv.getFloat32(wa(output),true);
 };
 const current=()=>q(0xb01);
 const words=v=>{const a=new ArrayBuffer(8),d=new DataView(a);d.setFloat64(0,v,true);return [d.getUint32(0,true),d.getUint32(4,true)];};
 const ptr=()=>{call('glGetPointerv',[0x8091,output]);return dv.getUint32(wa(output),true);};
 assert.strictEqual(current(),1,'default current index');assert.strictEqual(q(0xc20),0);
 assert.strictEqual(q(0xc21,'glGetIntegerv'),-1);assert.strictEqual(q(0xd51,'glGetIntegerv'),0,'RGBA has no index planes');
 assert.strictEqual(q(0x8085,'glGetIntegerv'),0x1406);assert.strictEqual(q(0x8086),0);assert.strictEqual(ptr(),0);
 // Exact independent expectations, both lookup routes, physical double stack.
 const formats=[['d',0x140a,8,-17.625],['f',0x1406,4,-6.25],['i',0x1404,4,-1234567],['s',0x1402,2,-32123],['ub',0x1401,1,251]];
 for(const route of ['static','dynamic'])for(const [kind,type,width,value] of formats){
  const raw=kind==='d'?words(value):[kind==='s'?0xa5a50000|(value&65535):kind==='ub'?0xa5a50000|value:value];
  call('glIndex'+kind,raw,kind==='f',route);assert.strictEqual(current(),Math.fround(value),'typed scalar '+kind);
  const p=wa(input)+3;
  if(kind==='d')dv.setFloat64(p,value,true);else if(kind==='f')dv.setFloat32(p,value,true);else if(width===4)dv.setInt32(p,value,true);else if(width===2)dv.setInt16(p,value,true);else dv.setUint8(p,value);
  call('glIndex'+kind+'v',[input+3],false,route);assert.strictEqual(current(),Math.fround(value),'unaligned vector '+kind);
 }
 call('glIndexf',[-2.75],true);assert.strictEqual(q(0xb01,'glGetDoublev'),-2.75);assert.strictEqual(q(0xb01,'glGetIntegerv'),-3);assert.strictEqual(q(0xb01,'glGetBooleanv'),1);
 for(const v of [-2147483648,2147483647,16777217]){call('glIndexi',[v]);assert.strictEqual(current(),Math.fround(v),'integer index has no color normalization');}
 for(const v of [-0,1+2**-24,1+3*2**-24,-123.875]){call('glIndexd',words(v));assert(Object.is(current(),Math.fround(v)),'double current-attribute precision and signed zero');}
 for(const v of [0,255]){call('glIndexub',[0xbabe0000|v]);assert.strictEqual(current(),v,'unsigned byte low eight bits');}
 call('glIndexi',[0]);assert.strictEqual(q(0xb01,'glGetBooleanv'),0);
 // Nonaffine guest pages: a vector and an array element straddle a boundary.
 const sparse=0x42000000;
 for(const p of [sparse,0x43000000,sparse+4096])assert.strictEqual(e.ci_sparse_page(p)>>>0,p);
 assert.notStrictEqual(wa(sparse+4096),wa(sparse)+4096);
 const cross=sparse+4093,bytes=new Uint8Array(8),bd=new DataView(bytes.buffer);bd.setFloat64(0,-72.625,true);
 bytes.forEach((b,i)=>dv.setUint8(wa(cross+i),b));call('glIndexdv',[cross]);assert.strictEqual(current(),-72.625);
 call('glIndexPointer',[0x140a,0,cross]);call('glEnableClientState',[0x8077]);call('glArrayElement',[0]);assert.strictEqual(current(),-72.625);call('glDisableClientState',[0x8077]);
 call('glClearIndex',[-12.5],true);call('glIndexMask',[0x87654321]);assert.strictEqual(q(0xc20),-12.5);assert.strictEqual(q(0xc21,'glGetIntegerv')>>>0,0x87654321);
 assert.strictEqual(q(0xc21,'glGetDoublev'),0x87654321);assert.strictEqual(q(0xc21,'glGetFloatv'),Math.fround(0x87654321));assert.strictEqual(q(0xc21,'glGetBooleanv'),1);
 // Index setters leave RGBA color and RGBA clear/mask untouched.
 call('glIndexi',[123]);call('glGetFloatv',[0xb00,output]);assert.deepStrictEqual(Array.from({length:4},(_,i)=>dv.getFloat32(wa(output)+4*i,true)),[1,1,1,1]);
 call('glIndexMask',[0]);take('setup');clear();draw(4,[[8,8],[56,8],[32,56]]);assert(region(32,24)>0);take('before');
 call('glBegin',[0]);call('glIndexf',[-99.25],true);call('glClearIndex',[8],true);call('glIndexMask',[7]);call('glIndexPointer',[0x1406,0,input]);call('glEnd');
 assert.strictEqual(err(),0x502);assert.strictEqual(current(),-99.25);assert.strictEqual(q(0xc20),-12.5);assert.strictEqual(q(0xc21,'glGetIntegerv'),0);
 new Uint8Array(memory.buffer,wa(output),16).fill(0xcd);call('glBegin',[0]);call('glGetDoublev',[0xb01,output]);call('glEnd');assert.strictEqual(err(),0x502);assert(new Uint8Array(memory.buffer,wa(output),16).every(b=>b===0xcd),'invalid query leaves output untouched');
 call('glEnableClientState',[0x8077]);assert.strictEqual(call('glIsEnabled',[0x8077]),1);assert.strictEqual(q(0x8077,'glGetBooleanv'),1);
 for(const [kind,type,width,value] of formats){
  const base=input+1,step=width+5;
  for(const [i,v] of [[0,11],[1,value]]){const p=wa(base)+i*step;if(kind==='d')dv.setFloat64(p,v,true);else if(kind==='f')dv.setFloat32(p,v,true);else if(width===4)dv.setInt32(p,v,true);else if(width===2)dv.setInt16(p,v,true);else dv.setUint8(p,v);}
  call('glIndexPointer',[type,step,base]);assert.strictEqual(ptr(),base);assert.strictEqual(q(0x8085),type);assert.strictEqual(q(0x8086),step);
  call('glArrayElement',[1]);assert.strictEqual(current(),Math.fround(value),'array format '+kind);
 }
 // Null/unmapped pointer specification is legal and does not read memory.
 call('glIndexPointer',[0x140a,7,0]);assert.strictEqual(ptr(),0);
 for(const type of [0x1400,0x1403,0x1405,0x9999]){call('glIndexPointer',[type,0,input]);assert.strictEqual(err(),0x500);assert.strictEqual(ptr(),0);assert.strictEqual(q(0x8085),0x140a);}
 call('glIndexPointer',[0x1406,-1,input]);assert.strictEqual(err(),0x501);assert.strictEqual(q(0x8086),7);
 call('glIndexPointer',[0x1406,0,input]);dv.setFloat32(wa(input),-7.5,true);
 call('glPushClientAttrib',[2]);call('glIndexPointer',[0x1402,13,input+9]);call('glDisableClientState',[0x8077]);call('glPopClientAttrib');
 assert.strictEqual(ptr(),input);assert.strictEqual(q(0x8085),0x1406);assert.strictEqual(q(0x8086),0);assert.strictEqual(call('glIsEnabled',[0x8077]),1);
 call('glArrayElement',[0]);assert.strictEqual(current(),-7.5);
 call('glPushClientAttrib',[1]);call('glIndexPointer',[0x1406,4,input+4]);call('glPopClientAttrib');assert.strictEqual(ptr(),input+4,'pixel-store bit excludes arrays');
 call('glDisableClientState',[0x8077]);call('glArrayElement',[0]);assert.strictEqual(current(),-7.5);
 call('glEnableClientState',[0x8077]);call('glInterleavedArrays',[0x2a21,0,input]);assert.strictEqual(call('glIsEnabled',[0x8077]),0,'interleaved arrays disable index');call('glDisableClientState',[0x8074]);
 // Server attribute groups and raster position capture are separate.
 call('glIndexf',[14.5],true);call('glRasterPos2f',[20,20],true);assert.strictEqual(q(0xb05),14.5);
 call('glPushAttrib',[1]);call('glIndexf',[-7.5],true);call('glRasterPos2f',[30,30],true);call('glClearIndex',[42.5],true);call('glIndexMask',[0x12345678]);call('glPopAttrib');
 assert.strictEqual(current(),14.5);assert.strictEqual(q(0xb05),14.5);assert.strictEqual(q(0xc20),42.5);assert.strictEqual(q(0xc21,'glGetIntegerv'),0x12345678);
 call('glPushAttrib',[0x4000]);call('glIndexf',[3.5],true);call('glClearIndex',[-3.25],true);call('glIndexMask',[0]);call('glPopAttrib');
 assert.strictEqual(current(),3.5);assert.strictEqual(q(0xc20),42.5);assert.strictEqual(q(0xc21,'glGetIntegerv'),0x12345678);
 // Display lists own converted vector and array values, not client pointers.
 const list=call('glGenLists',[1]);dv.setFloat64(wa(input),-25.125,true);
 call('glNewList',[list,0x1300]);call('glIndexdv',[input]);call('glClearIndex',[9.5],true);call('glIndexMask',[0xaabbccdd]);call('glEndList');
 assert.strictEqual(current(),3.5);assert.strictEqual(q(0xc20),42.5);
 dv.setFloat64(wa(input),100,true);call('glCallList',[list]);assert.strictEqual(current(),-25.125);assert.strictEqual(q(0xc20),9.5);assert.strictEqual(q(0xc21,'glGetIntegerv')>>>0,0xaabbccdd);
 const arrayList=call('glGenLists',[1]);dv.setInt16(wa(input),-1234,true);call('glNewList',[arrayList,0x1300]);
 call('glIndexPointer',[0x1402,0,input]);call('glEnableClientState',[0x8077]);assert.strictEqual(ptr(),input);call('glArrayElement',[0]);call('glEndList');assert.strictEqual(current(),-25.125);
 dv.setInt16(wa(input),88,true);call('glDisableClientState',[0x8077]);call('glCallList',[arrayList]);assert.strictEqual(current(),-1234);
 call('glNewList',[arrayList,0x1301]);call('glIndexs',[-23]);call('glEndList');assert.strictEqual(current(),-23);
 // Selection and RGBA feedback continue to use RGBA attributes.
 call('glSelectBuffer',[128,output]);call('glRenderMode',[0x1c02]);call('glInitNames');call('glPushName',[17]);draw(4,[[8,8],[56,8],[32,56]]);
 assert.strictEqual(call('glRenderMode',[0x1c00]),1);assert.strictEqual(dv.getUint32(wa(output)+12,true),17);take('selection');
 // Both draw-array routes consume independent index arrays in selection mode.
 call('glRenderMode',[0x1c02]);call('glInitNames');call('glPushName',[19]);
 for(const [i,v] of [32,32,40,40].entries())dv.setFloat32(wa(input)+4*i,v,true);
 dv.setInt16(wa(input)+64,-32,true);dv.setInt16(wa(input)+66,77,true);dv.setUint8(wa(input)+80,1);
 call('glVertexPointer',[2,0x1406,0,input]);call('glEnableClientState',[0x8074]);call('glIndexPointer',[0x1402,0,input+64]);call('glEnableClientState',[0x8077]);
 call('glDrawArrays',[0,0,2]);call('glDrawElements',[0,1,0x1401,input+80]);
 assert.strictEqual(call('glRenderMode',[0x1c00]),1);assert.strictEqual(dv.getUint32(wa(output)+12,true),19);
 call('glDisableClientState',[0x8074]);call('glDisableClientState',[0x8077]);
 call('glFeedbackBuffer',[128,0x602,output]);call('glRenderMode',[0x1c01]);call('glIndexi',[-999]);draw(0,[[32,32,0]]);
 assert.strictEqual(call('glRenderMode',[0x1c00]),8);
 assert.deepStrictEqual(Array.from({length:4},(_,i)=>dv.getFloat32(wa(output)+16+4*i,true)),[1,1,1,1],'RGBA feedback color');
 assert.strictEqual(current(),-999);take('feedback');
 // Fresh contexts and sharing retain private index state; copy selects server groups.
 const ctx2=call('wglCreateContext',[dc]);assert.strictEqual(call('wglShareLists',[context,ctx2]),1);
 call('wglMakeCurrent',[dc,ctx2]);assert.strictEqual(current(),1);assert.strictEqual(q(0xc20),0);assert.strictEqual(q(0xc21,'glGetIntegerv'),-1);assert.strictEqual(ptr(),0);
 call('glIndexPointer',[0x1401,17,input+15]);call('glIndexi',[77]);call('wglMakeCurrent',[dc,context]);assert.strictEqual(current(),-999);assert.strictEqual(q(0x8085),0x1402);
 assert.strictEqual(call('wglCopyContext',[context,ctx2,1|0x4000]),1);call('wglMakeCurrent',[dc,ctx2]);
 assert.strictEqual(current(),-999);assert.strictEqual(q(0xc20),9.5);assert.strictEqual(q(0xc21,'glGetIntegerv')>>>0,0xaabbccdd);assert.strictEqual(ptr(),input+15,'server copy excludes client pointer');
 call('glCallList',[list]);assert.strictEqual(current(),-25.125);call('wglMakeCurrent',[dc,context]);assert.strictEqual(current(),-999,'shared list does not share current index');take('contexts');
 call('glIndexMask',[0]);call('glIndexi',[-123]);call('glClearIndex',[999],true);clear();draw(4,[[8,8],[56,8],[32,56]]);
 if(encoder)assert(e.sf_pending(),'ordinary RGBA draw queued');assert(region(32,24)>0,'RGBA draw ignores index mask');take('restored');
 assert.strictEqual(err(),0);
 call('wglMakeCurrent',[0,0]);call('wglDeleteContext',[context]);call('wglDeleteContext',[ctx2]);
 if(process.env.GL_CI_CAPTURE)fs.writeFileSync(process.env.GL_CI_CAPTURE,JSON.stringify(cases));
 if(encoder){const stats=encoder.snapshot();assert.strictEqual(stats.glQueued,2);assert.strictEqual(stats.fallbacks,0);console.log('CI_WORKER',JSON.stringify(stats));}
 console.log('PASS color-index: public resolved ABI/canaries, typed state, arrays, queries, attributes, lists, context sharing/copy, feedback and RGBA pixels; '+(queued?'Worker':'direct'));
 } finally {encoder?.stop();if(manager)await manager.stop();}
})().catch(error=>{console.error(error);process.exitCode=1;});
