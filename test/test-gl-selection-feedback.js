'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const root=process.env.WINE_ROOT||'/home/user/wine-assembly',req=p=>require(path.join(root,p));
const {bootRenderHarness}=req('test/render-helper');
const Stream=req('lib/gl-command-stream');
const extraWat=`
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
  console.log('SF_MODULE_SHA256',sha256,'bytes',bytes.length);
  if(process.env.GL_SF_MODULE_OUT)fs.writeFileSync(process.env.GL_SF_MODULE_OUT,bytes);
 };
 if(process.env.GL_SF_MUTATION){
  const mutation=JSON.parse(fs.readFileSync(process.env.GL_SF_MUTATION));let applied=false;
  const bytes=req('test/compile-src').compileSrcWasm((file,source)=>{
   if(file===mutation.file){assert.strictEqual(source.split(mutation.from).length-1,1,'unique mutation');source=source.replace(mutation.from,mutation.to);applied=true;}
   return file==='13-exports.wat'?source+extraWat:source;
  });assert(applied);recordModule(bytes);prebuiltModule=new WebAssembly.Module(bytes);
 }
 if(!prebuiltModule){
  const bytes=process.env.GL_SF_MODULE?fs.readFileSync(process.env.GL_SF_MODULE):req('test/compile-src').compileSrcWasm((file,source)=>file==='13-exports.wat'?source+extraWat:source);
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
  if(process.env.GL_SF_PIXELS&&name!=='setup'){
   const {PNG}=require('pngjs'),png=new PNG({width:64,height:64});
   for(let y=0;y<64;y++)for(let x=0;x<64;x++){const v=pixel(x,63-y),i=(y*64+x)*4;png.data.set([(v>>>16)&255,(v>>>8)&255,v&255,255],i);}
   fs.mkdirSync(process.env.GL_SF_PIXELS,{recursive:true});fs.writeFileSync(path.join(process.env.GL_SF_PIXELS,name+'.png'),PNG.sync.write(png));
  }
 };
 const query=p=>{call('glGetIntegerv',[p,output]);return dv.getInt32(wa(output),true);};

 const err=()=>call('glGetError'),mode=m=>call('glRenderMode',[m])|0;
 const sel=0x1c02,feed=0x1c01,renderMode=0x1c00;
 const read=(n,at=output)=>Array.from({length:n},(_,i)=>dv.getUint32(wa(at)+4*i,true));
 const floats=n=>Array.from({length:n},(_,i)=>dv.getFloat32(wa(output)+4*i,true));
 const near=(a,b,why,tol=2e-5)=>assert(Math.abs(a-b)<=tol,why+': '+a+' != '+b);
 const initbuf=()=>new Uint8Array(memory.buffer,wa(output),1024).fill(0xcd);
 const depth=z=>Math.round(z*0xffffffff)>>>0;
 take('setup');clear();draw(4,[[8,8],[56,8],[32,56]]);assert(region(32,24)>0);take('before');
 initbuf();assert.strictEqual(mode(sel),0);assert.strictEqual(err(),0x502,'buffer must be defined');assert.strictEqual(query(0xc40),renderMode);
 call('glSelectBuffer',[-1,output]);assert.strictEqual(err(),0x501);
 call('glSelectBuffer',[256,output]);assert.strictEqual(query(0xdf4),256);
 call('glGetPointerv',[0xdf3,input]);assert.strictEqual(read(1,input)[0],output);
 assert.strictEqual(mode(sel),0);assert.strictEqual(query(0xd37),64);
 for(const [name,bytes,get] of [['glGetBooleanv',1,()=>dv.getUint8(wa(input))],['glGetFloatv',4,()=>dv.getFloat32(wa(input),true)],['glGetDoublev',8,()=>dv.getFloat64(wa(input),true)]]){
  new Uint8Array(memory.buffer,wa(input),16).fill(0xcd);call(name,[0xc40,input]);assert.strictEqual(get(),name==='glGetBooleanv'?1:sel);assert.strictEqual(dv.getUint8(wa(input)+bytes),0xcd,'query width '+name);
 }
 call('glInitNames');call('glPushName',[0x87654321]);call('glPushName',[7]);
 // Near/far clipping changes BOTH extrema: the unclipped endpoints are outside.
 draw(1,[[16,16,2],[48,48,-2]]);
 call('glLoadName',[8]);draw(4,[[-100,8,0],[100,8,.5],[32,80,-.5]]);
 call('glPopName');draw(0,[[1000,20,0]]);
 assert.strictEqual(mode(renderMode),2);
 const records=read(10);assert.deepStrictEqual(records.slice(0,5),[2,0,0xffffffff,0x87654321,7]);
 assert.strictEqual(records[5],2);
 // At x=64 the lower edge has object z=.41; at y=64 the upper-left
 // edge has z=-7/18. Their window-depth extrema are .295 and 25/36.
 assert(Math.abs(records[6]-depth(.295))<512,'clipped triangle minimum depth');assert(Math.abs(records[7]-depth(25/36))<512,'clipped triangle maximum depth');assert.deepStrictEqual(records.slice(8),[0x87654321,8]);
 assert.strictEqual(query(0xd70),0,'RenderMode clears names');
 take('selection');assert.strictEqual(cases.selection.length,0,'no geometry reaches render backend');
 // Names outside selection are ignored, errors are still required within Begin.
 call('glPopName');call('glLoadName',[4]);assert.strictEqual(err(),0);
 mode(sel);call('glLoadName',[1]);assert.strictEqual(err(),0x502);call('glPopName');assert.strictEqual(err(),0x504);
 for(let i=0;i<64;i++)call('glPushName',[i]);call('glPushName',[64]);assert.strictEqual(err(),0x503);assert.strictEqual(query(0xd70),64);
 assert.strictEqual(mode(sel),0,'same-mode call resets counters and names');assert.strictEqual(query(0xd70),0);
 call('glBegin',[0]);call('glRenderMode',[renderMode]);assert.strictEqual(err(),0x502);call('glPushName',[1]);assert.strictEqual(err(),0x502);call('glVertex3f',[32,32,0],true);call('glEnd');
 assert.strictEqual(mode(renderMode),1,'empty name stack still records hits');assert.deepStrictEqual(read(3),[0,depth(.5),depth(.5)]);
 // SelectBuffer while active is rejected without touching pointer or hit state.
 mode(sel);call('glPushName',[9]);draw(0,[[32,32,0]]);call('glSelectBuffer',[1,input]);assert.strictEqual(err(),0x502);assert.strictEqual(mode(0x1234),0);assert.strictEqual(err(),0x500);assert.strictEqual(mode(renderMode),1);assert.deepStrictEqual(read(4),[1,depth(.5),depth(.5),9]);
 // Partial records fill exactly the available words; adjacent canaries survive.
 initbuf();call('glSelectBuffer',[2,output]);mode(sel);call('glPushName',[12]);draw(0,[[32,32,0]]);assert.strictEqual(mode(renderMode),-1);assert.deepStrictEqual(read(3),[1,depth(.5),0xcdcdcdcd]);call('glSelectBuffer',[256,output]);mode(sel);assert.strictEqual(mode(renderMode),0,'overflow reset');
 // RasterPos itself causes a selection hit, bitmap movement does not.
 mode(sel);call('glPushName',[11]);call('glRasterPos3f',[20,22,.5],true);call('glBitmap',[0,0,0,0,4,5,0],[2,3,4,5]);assert.strictEqual(mode(renderMode),1);assert.deepStrictEqual(read(4),[1,depth(.25),depth(.25),11]);
 // Culling precedes hits, polygon mode does not change selection geometry.
 call('glEnable',[0xb44]);call('glCullFace',[0x408]);mode(sel);draw(4,[[8,8],[56,8],[32,56]]);assert.strictEqual(mode(renderMode),0);call('glDisable',[0xb44]);
 call('glPolygonMode',[0x408,0x1b00]);mode(sel);draw(4,[[-100,8],[100,8],[32,80]]);assert.strictEqual(mode(renderMode),1);call('glPolygonMode',[0x408,0x1b02]);
 // Selection/feedback must also work on a producer with software raster off.
 forceNoRaster=true;e.gl_sw_set_enabled(0);assert.strictEqual(e.gl_sw_enabled(),0);
 call('glEnable',[0xb44]);call('glCullFace',[0x404]);call('glFrontFace',[0x901]);
 mode(sel);assert.strictEqual(e.gl_sw_enabled(),0);draw(4,[[8,8],[56,8],[32,56]]);assert.strictEqual(mode(renderMode),0,'WebGL producer front culling');
 call('glFrontFace',[0x900]);mode(sel);call('glPushName',[23]);draw(4,[[8,8],[56,8],[32,56]]);assert.strictEqual(mode(renderMode),1,'WebGL producer winding');assert.deepStrictEqual(read(4),[1,depth(.5),depth(.5),23]);
 call('glDisable',[0xb44]);call('glFrontFace',[0x901]);call('glCullFace',[0x405]);
 call('glColor4f',[.3,.5,.7,.9],true);call('glTexCoord4f',[.1,.2,.3,2],true);call('glFeedbackBuffer',[256,0x604,output]);
 mode(feed);draw(0,[[16,24,.5]]);assert.strictEqual(mode(renderMode),13);const noRaster=floats(13);[1793,16,24,.25,1,.3,.5,.7,.9,.1,.2,.3,2].forEach((v,i)=>near(noRaster[i],v,'WebGL producer full feedback'));
 call('glEnable',[0xb50]);call('glEnable',[0x4000]);mode(feed);draw(0,[[32,32,0]]);assert.strictEqual(mode(renderMode),13);near(floats(13)[5],.84,'WebGL producer lighting');call('glDisable',[0xb50]);call('glDisable',[0x4000]);
 forceNoRaster=false;e.gl_sw_set_enabled(1);
 // Array draws enter the same primitive sink, including indexed clipping.
 const vertices=[-32,16,0,32,16,0,32,48,0];vertices.forEach((v,i)=>dv.setFloat32(wa(input)+4*i,v,true));
 call('glVertexPointer',[3,0x1406,0,input]);call('glEnableClientState',[0x8074]);
 mode(sel);call('glPushName',[0xfedcba98]);call('glDrawArrays',[4,0,3]);assert.strictEqual(mode(renderMode),1);assert.strictEqual(read(4)[3],0xfedcba98);
 const indices=input+128;[2,0,1].forEach((v,i)=>dv.setUint16(wa(indices)+2*i,v,true));
 call('glFeedbackBuffer',[256,0x600,output]);mode(feed);call('glDrawElements',[4,3,0x1403,indices]);assert.strictEqual(mode(renderMode),10);assert.deepStrictEqual(floats(2),[1795,4]);
 call('glDisableClientState',[0x8074]);
 // Reversed depth ranges preserve actual window-depth extrema.
 const doubles=(...values)=>{const b=Buffer.alloc(values.length*8);values.forEach((v,i)=>b.writeDoubleLE(v,i*8));return Array.from({length:values.length*2},(_,i)=>b.readUInt32LE(i*4));};
 call('glDepthRange',doubles(.8,.2));mode(sel);draw(1,[[16,16,.5],[48,48,-.5]]);assert.strictEqual(mode(renderMode),1);
 const reversed=read(3);assert(Math.abs(reversed[1]-depth(.35))<256);assert(Math.abs(reversed[2]-depth(.65))<256);call('glDepthRange',doubles(0,1));
 // Clear changes no framebuffer in either non-render mode.
 for(const m of [sel,feed]){if(m===feed)call('glFeedbackBuffer',[256,0x600,output]);mode(m);clear();assert.strictEqual(mode(renderMode),0);assert(region(32,24)>0,'clear suppressed in mode '+m);}
 // Each of the five feedback types has an independent numeric layout oracle.
 call('glColor4f',[.2,.4,.6,.8],true);call('glTexCoord4f',[.25,.5,.75,2],true);
 for(const [type,count] of [[0x600,2],[0x601,3],[0x602,7],[0x603,11],[0x604,12]]){
  initbuf();call('glFeedbackBuffer',[256,type,output]);assert.strictEqual(mode(feed),0);
  call('glPassThrough',[42.25],true,'dynamic');draw(0,[[16.25,24.5,.5]]);
  assert.strictEqual(mode(renderMode),3+count);
  const a=floats(3+count);assert.deepStrictEqual(a.slice(0,3),[1792,42.25,1793]);near(a[3],16.25,'window x');near(a[4],24.5,'window y');
  if(type!==0x600)near(a[5],.25,'window z');
  if(type===0x604)near(a[6],1,'clip w');
  if(type>=0x602){const start=type===0x604?7:6;[.2,.4,.6,.8].forEach((v,i)=>near(a[start+i],v,'color'));
   if(type>=0x603)[.25,.5,.75,2].forEach((v,i)=>near(a[start+4+i],v,'texture'));}
 }
 // Homogeneous vertex w, transformed texture coordinates and depth range.
 call('glMatrixMode',[0x1702]);call('glLoadIdentity');call('glScalef',[2,3,4],true);call('glMatrixMode',[0x1700]);
 call('glFeedbackBuffer',[256,0x604,output]);mode(feed);call('glBegin',[0]);call('glVertex4f',[32,48,1,2],true);call('glEnd');assert.strictEqual(mode(renderMode),13);
 const hom=floats(13);near(hom[1],16,'homogeneous x');near(hom[2],24,'homogeneous y');near(hom[3],.25,'homogeneous z');near(hom[4],2,'clip w');[.5,1.5,3,2].forEach((v,i)=>near(hom[9+i],v,'matrix texture'));
 call('glMatrixMode',[0x1702]);call('glLoadIdentity');call('glMatrixMode',[0x1700]);
 // Texgen uses the current vertex and normal, including sphere mapping.
 call('glTexGeni',[0x2000,0x2500,0x2402]);call('glTexGeni',[0x2001,0x2500,0x2402]);call('glEnable',[0xc60]);call('glEnable',[0xc61]);call('glNormal3f',[0,0,1],true);
 mode(feed);draw(0,[[32,0,0]]);assert.strictEqual(mode(renderMode),13);const sphere=floats(13);near(sphere[9],.5+1/(2*Math.sqrt(2)),'sphere s');near(sphere[10],.5,'sphere t');call('glDisable',[0xc60]);call('glDisable',[0xc61]);
 // Lighting is evaluated before feedback, independently of raster coverage.
 call('glEnable',[0xb50]);call('glEnable',[0x4000]);mode(feed);draw(0,[[32,32,0]]);assert.strictEqual(mode(renderMode),13);const lit=floats(13);near(lit[5],.84,'default lit red');near(lit[6],.84,'default lit green');near(lit[7],.84,'default lit blue');call('glDisable',[0xb50]);call('glDisable',[0x4000]);
 // Clipped line has interpolated attributes; connected segments reset only once.
 call('glFeedbackBuffer',[256,0x602,output]);mode(feed);call('glBegin',[1]);call('glColor3f',[2,0,0],true);call('glVertex3f',[-32,32,0],true);call('glColor3f',[0,0,1],true);call('glVertex3f',[32,32,0],true);call('glEnd');assert.strictEqual(mode(renderMode),15);
 const line=floats(15);assert.strictEqual(line[0],1799);near(line[1],0,'clipped line x');near(line[4],.5,'interpolated red');near(line[6],.5,'interpolated blue');
 call('glFeedbackBuffer',[256,0x600,output]);mode(feed);draw(3,[[8,8],[24,24],[40,8]]);assert.strictEqual(mode(renderMode),10);assert.strictEqual(floats(10)[0],1799);assert.strictEqual(floats(10)[5],1794);
 mode(feed);draw(2,[[8,8],[24,24],[40,8]]);assert.strictEqual(mode(renderMode),15);assert.deepStrictEqual([floats(15)[0],floats(15)[5],floats(15)[10]],[1799,1794,1794],'closed loop token continuity');
 mode(feed);draw(1,[[8,8],[24,24],[24,24],[40,8]]);assert.strictEqual(mode(renderMode),10);assert.deepStrictEqual([floats(10)[0],floats(10)[5]],[1799,1799],'independent line resets');
 // Preserve logical quads, strips, fans and polygons through feedback.
 for(const [topology,points,counts] of [
  [7,[[8,8],[56,8],[56,56],[8,56]],[4]],
  [8,[[8,8],[8,56],[32,8],[32,56],[56,8],[56,56]],[4,4]],
  [5,[[8,8],[8,56],[56,8],[56,56]],[3,3]],
  [6,[[32,32],[8,8],[56,8],[56,56]],[3,3]],
  [9,[[8,8],[56,8],[56,56],[32,60],[8,56]],[5]]]){
  mode(feed);draw(topology,points);const n=mode(renderMode),expected=counts.reduce((a,c)=>a+2+2*c,0);assert.strictEqual(n,expected,'topology '+topology);
  const a=floats(n);let off=0;for(const count of counts){assert.strictEqual(a[off],1795);assert.strictEqual(a[off+1],count);off+=2+2*count;}
 }
 // Clip a triangle to a nontrivial quad. No triangulation diagonal is fed back.
 mode(feed);draw(4,[[-32,16],[32,16],[32,48]]);const polyCount=mode(renderMode);assert.strictEqual(polyCount,10);assert.deepStrictEqual(floats(2),[1795,4]);
 // An explicitly zero-sized viewport remains a valid feedback transform.
 call('glViewport',[11,13,0,0]);mode(feed);draw(0,[[32,32,0]]);assert.strictEqual(mode(renderMode),3);assert.deepStrictEqual(floats(3),[1793,11,13]);call('glViewport',[0,0,64,64]);
 // User clip plane rejects and intersects real primitives.
 dv.setFloat64(wa(input),1,true);dv.setFloat64(wa(input)+8,0,true);dv.setFloat64(wa(input)+16,0,true);dv.setFloat64(wa(input)+24,-24,true);
 call('glClipPlane',[0x3000,input]);call('glEnable',[0x3000]);mode(feed);draw(1,[[8,32],[40,32]]);assert.strictEqual(mode(renderMode),5);near(floats(5)[1],24,'user clipped x');call('glDisable',[0x3000]);
 // Polygon mode and edge flags feed points/lines after clipping.
 call('glPolygonMode',[0x408,0x1b01]);mode(feed);draw(4,[[8,8],[56,8],[32,56]],[1,0,1]);assert.strictEqual(mode(renderMode),10);assert.strictEqual(floats(10)[0],1799);assert.strictEqual(floats(10)[5],1794);call('glPolygonMode',[0x408,0x1b02]);call('glEdgeFlag',[1]);
 call('glPolygonMode',[0x408,0x1b00]);mode(feed);draw(4,[[8,8],[56,8],[32,56]],[1,0,1]);assert.strictEqual(mode(renderMode),6);assert.deepStrictEqual(floats(6),[1793,8,8,1793,32,56]);call('glPolygonMode',[0x408,0x1b02]);call('glEdgeFlag',[1]);
 // Raster tokens are emitted once per command, including all-zero bitmaps.
 mode(feed);call('glRasterPos3f',[12,14,0],true);call('glBitmap',[0,0,0,0,2,3,0],[2,3,4,5]);
 call('glDrawPixels',[0,0,0x1908,0x1401,0]);call('glCopyPixels',[0,0,0,0,0x1800]);
 assert.strictEqual(mode(renderMode),9);assert.deepStrictEqual(floats(9),[1796,12,14,1797,14,17,1798,14,17]);
 // Invalid transitions preserve old mode and buffered output.
 mode(feed);call('glFeedbackBuffer',[3,0x600,input]);assert.strictEqual(err(),0x502);call('glBegin',[0]);call('glPassThrough',[1],true);assert.strictEqual(err(),0x502);call('glEnd');call('glPassThrough',[7],true);assert.strictEqual(mode(renderMode),2);
 call('glFeedbackBuffer',[-1,0x600,output]);assert.strictEqual(err(),0x501);call('glFeedbackBuffer',[4,0x999,output]);assert.strictEqual(err(),0x500);
 initbuf();call('glFeedbackBuffer',[2,0x601,output]);mode(feed);draw(0,[[32,32,0]]);assert.strictEqual(mode(renderMode),-1);assert.deepStrictEqual(floats(2),[1793,32]);assert.strictEqual(read(3)[2],0xcdcdcdcd);
 call('glFeedbackBuffer',[0,0x600,output]);mode(feed);call('glPassThrough',[1],true);assert.strictEqual(mode(renderMode),-1);
 call('glFeedbackBuffer',[256,0x600,output]);
 // Direct transitions return the OLD mode's count and reset the NEW mode.
 mode(sel);call('glPushName',[71]);draw(0,[[32,32,0]]);assert.strictEqual(mode(feed),1);assert.strictEqual(read(4)[3],71);
 call('glPassThrough',[6.5],true);assert.strictEqual(mode(sel),2);assert.deepStrictEqual(floats(2),[1792,6.5]);assert.strictEqual(query(0xd70),0);assert.strictEqual(mode(renderMode),0);
 // Invalid RasterPos suppresses pixel feedback and bitmap movement.
 mode(feed);call('glRasterPos3f',[1000,14,0],true);call('glBitmap',[0,0,0,0,2,3,0],[2,3,4,5]);call('glDrawPixels',[0,0,0x1908,0x1401,0]);assert.strictEqual(mode(renderMode),0);
 // Lists compile name/marker commands; buffer definitions and RenderMode execute
 // immediately and are absent from replay. Geometry uses execution-time state.
 const list=call('glGenLists',[1]);call('glNewList',[list,0x1300]);call('glPushName',[33]);call('glPassThrough',[9.5],true);draw(4,[[8,8],[56,8],[32,56]]);call('glEndList');
 mode(sel);call('glCallList',[list]);assert.strictEqual(mode(renderMode),1);assert.strictEqual(read(4)[3],33);
 mode(feed);call('glCallList',[list]);assert.strictEqual(mode(renderMode),10);assert.deepStrictEqual(floats(4),[1792,9.5,1795,3]);
 // Buffer definitions and RenderMode execute during COMPILE, not replay.
 const immediateList=call('glGenLists',[1]);call('glNewList',[immediateList,0x1300]);
 call('glSelectBuffer',[128,output]);assert.strictEqual(query(0xdf4),128);assert.strictEqual(mode(sel),0);assert.strictEqual(query(0xc40),sel);assert.strictEqual(mode(renderMode),0);
 call('glEndList');call('glSelectBuffer',[256,output]);call('glCallList',[immediateList]);assert.strictEqual(query(0xdf4),256);assert.strictEqual(query(0xc40),renderMode);
 // Finish the mode replay capture before native context-copy transactions.
 take('feedback');
 const ctx2=call('wglCreateContext',[dc]);assert.strictEqual(call('wglShareLists',[context,ctx2]),1);call('wglMakeCurrent',[dc,ctx2]);
 call('glViewport',[0,0,64,64]);e.gl_mtx_set_mode(0x1701);e.gl_mtx_load_identity();e.gl_mtx_ortho(0,64,0,64,-1,1);e.gl_mtx_set_mode(0x1700);e.gl_mtx_load_identity();
 call('glFeedbackBuffer',[256,0x600,input]);mode(feed);call('glCallList',[list]);assert.strictEqual(mode(renderMode),10);assert.strictEqual(dv.getFloat32(wa(input),true),1792,'shared list uses destination feedback buffer');
 assert.strictEqual(query(0xc40),renderMode);assert.strictEqual(query(0xdf4),0);assert.strictEqual(mode(sel),0);assert.strictEqual(err(),0x502);
 call('wglMakeCurrent',[dc,context]);mode(sel);call('glPushName',[91]);draw(0,[[32,32,0]]);call('wglMakeCurrent',[dc,ctx2]);call('glSelectBuffer',[256,input]);mode(sel);call('glPushName',[92]);draw(0,[[24,24,0]]);
 call('wglMakeCurrent',[dc,context]);assert.strictEqual(mode(renderMode),1);assert.strictEqual(read(4)[3],91);
 call('wglMakeCurrent',[dc,ctx2]);assert.strictEqual(mode(renderMode),1);assert.strictEqual(read(4,input)[3],92);call('wglMakeCurrent',[dc,context]);
 // Server state copy and attribute stacks exclude this client state.
 mode(sel);call('glPushName',[73]);draw(0,[[32,32,0]]);call('glPushAttrib',[0xfffff]);call('glPopAttrib');
 assert.strictEqual(call('wglCopyContext',[context,ctx2,0xfffff]),1);assert.strictEqual(query(0xc40),sel);assert.strictEqual(query(0xd70),1);
 assert.strictEqual(mode(renderMode),1);assert.strictEqual(read(4)[3],73);
 call('wglMakeCurrent',[dc,ctx2]);assert.strictEqual(query(0xc40),renderMode);assert.strictEqual(query(0xdf4),256);assert.strictEqual(query(0xd70),0);call('wglMakeCurrent',[dc,context]);
 take('contexts');
 // Ordinary rendering resumes and must really reach both native/Worker and WebGL.
 call('glColor4f',[1,1,1,1],true);clear();draw(4,[[8,8],[56,8],[32,56]]);
 if(encoder)assert(e.sf_pending(),'ordinary draw actually queued before mode transition');
 mode(sel);call('glPushName',[99]);draw(0,[[32,32,0]]);assert.strictEqual(mode(renderMode),1);assert.strictEqual(read(4)[3],99);
 assert(region(32,24)>0,'ordinary render restored');take('restored');
 assert.strictEqual(err(),0);
 call('wglMakeCurrent',[0,0]);call('wglDeleteContext',[context]);call('wglDeleteContext',[ctx2]);
 if(process.env.GL_SF_CAPTURE)fs.writeFileSync(process.env.GL_SF_CAPTURE,JSON.stringify(cases));
 if(encoder){const stats=encoder.snapshot();assert.strictEqual(stats.glQueued,2,'only the before/after ordinary triangles enter the actual Worker queue');assert.strictEqual(stats.fallbacks,0);console.log('SF_WORKER',JSON.stringify(stats));}
 console.log('PASS selection/feedback: resolved ABI, clipped depth/name records, five formats, tokens, lists, contexts, errors, overflow and rendering restoration; '+(queued?'Worker':'direct'));
 } finally {encoder?.stop();if(manager)await manager.stop();}
})().catch(error=>{console.error(error);process.exitCode=1;});

