'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const root=process.env.WINE_ROOT||'/home/user/wine-assembly',req=p=>require(path.join(root,p));
const {bootRenderHarness}=req('test/render-helper');
const Stream=req('lib/gl-command-stream');
const extraWat=`
 (func (export "edge_dynamic") (param $p i32) (result i32)
  (local $esp i32) (local $answer i32)
  (local.set $esp (i32.load offset=16 (global.get $reg_base)))
  (call $handle_gpu_api (i32.const 50) (i32.const 1) (local.get $p) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
  (local.set $answer (i32.load (global.get $reg_base)))
  (i32.store offset=16 (global.get $reg_base) (local.get $esp)) (local.get $answer))
 (func (export "edge_pending") (result i32) (global.get $d3dim_worker_pending))
 (func (export "edge_init")
   (global.set $thunk_guest_base (i32.add (global.get $image_base) (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
   (call $update_thunk_end))
 (func (export "edge_regs") (result i32) (global.get $reg_base))
 (func (export "edge_module") (param $name i32) (result i32)
   (call $handle_LoadLibraryA (local.get $name) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "edge_lookup") (param $module i32) (param $name i32) (result i32)
   (call $handle_GetProcAddress (local.get $module) (local.get $name) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "edge_invoke") (param $thunk i32) (result i32)
   (call $win32_dispatch (i32.div_u (i32.sub (local.get $thunk) (global.get $thunk_guest_base)) (i32.const 8))) (i32.load (global.get $reg_base)))(func (export "edge_dc") (result i32)
 (call $handle_GetDC (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
 (drop (call $gdi_dc_set_field (i32.load (global.get $reg_base)) (i32.const 92) (i32.const 42) (i32.const 0)))
 (i32.load (global.get $reg_base)))`;
(async()=>{
 const queued=process.argv.includes('--worker');let encoder=null,manager=null,bridge=null,render=null,producer=null,memory;
 let prebuiltModule=null;const batches=[],cases={},lightingChecks=[],lightingFailures=[];
 const recordModule=bytes=>{
  const sha256=require('crypto').createHash('sha256').update(bytes).digest('hex');
  console.log('EDGE_MODULE_SHA256',sha256,'bytes',bytes.length);
  if(process.env.GL_EDGE_MODULE_OUT)fs.writeFileSync(process.env.GL_EDGE_MODULE_OUT,bytes);
 };
 if(process.env.GL_EDGE_MUTATION){
  const mutation=JSON.parse(fs.readFileSync(process.env.GL_EDGE_MUTATION));let applied=false;
  const bytes=req('test/compile-src').compileSrcWasm((file,source)=>{
   if(file===mutation.file){assert.strictEqual(source.split(mutation.from).length-1,1,'unique mutation');source=source.replace(mutation.from,mutation.to);applied=true;}
   return file==='13-exports.wat'?source+extraWat:source;
  });assert(applied);recordModule(bytes);prebuiltModule=new WebAssembly.Module(bytes);
 }
 if(!prebuiltModule){
  const bytes=req('test/compile-src').compileSrcWasm((file,source)=>file==='13-exports.wat'?source+extraWat:source);
  recordModule(bytes);prebuiltModule=new WebAssembly.Module(bytes);
 }
 const h=await bootRenderHarness({fonts:'none',...(prebuiltModule?{prebuiltModule}:{extraWat}),width:64,height:64,extraHostOverrides:{gpu_gl_call(op,at,bytes){
  if(op===Stream.WAT_STREAM_FLUSH_OPCODE){
   const batch=Stream.memoryBatch(memory,at,bytes);let lifecycle=false;
   Stream.replay(batch,op=>{if(op===48||op===51)lifecycle=true;});
   if(!lifecycle)batches.push(Array.from(new Uint8Array(memory.buffer,at,bytes)));
   if(!render)return bridge.replay(Stream.memoryBatch(memory,at,bytes));
   const reply=render.execute({memoryOffset:at,bytes,owner:0,windows:Object.values(renderer.windows),softwareFront:e.gl_sw_front()});producer.configure(reply.producerConfig);return reply.value;
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
 e.edge_init();const regs=e.edge_regs(),stackGuest=e.guest_alloc(256)>>>0,stack=wa(stackGuest),input=e.guest_alloc(1024)>>>0,output=e.guest_alloc(1024)>>>0;
 function str(s){const p=e.guest_alloc(s.length+1)>>>0;new Uint8Array(memory.buffer,wa(p),s.length+1).set(Buffer.from(s+'\0'));return p;}
 const module=e.edge_module(str('opengl32.dll'));assert(module);const resolved=new Map(),table=req('src/api_table.json');
 function call(name,args=[],float=false,route='static'){
  const key=name+route;
  if(!resolved.has(key)){dv.setUint32(regs+16,stackGuest,true);const p=(route==='dynamic'?e.edge_dynamic(str(name)):e.edge_lookup(module,str(name)))>>>0;assert(p,'real export '+name);assert.strictEqual(dv.getUint32(wa(p)+4,true),table.find(a=>a.name===name).id);resolved.set(key,p);}
  for(let i=0;i<8;i++)dv.setUint32(regs+i*4,0x55660000+i,true);
  dv.setUint32(regs+16,stackGuest,true);new Uint8Array(memory.buffer,stack,256).fill(0xa5);
  dv.setUint32(stack,0x12345678,true);args.forEach((v,i)=>(float===true||Array.isArray(float)&&float.includes(i))?dv.setFloat32(stack+4+i*4,v,true):dv.setUint32(stack+4+i*4,v>>>0,true));
  const before=Buffer.from(new Uint8Array(memory.buffer,stack,256)),value=e.edge_invoke(resolved.get(key))>>>0;
  assert.strictEqual(dv.getUint32(regs+16,true),stackGuest+4*(args.length+1),'stdcall '+name);
  for(let i=1;i<8;i++)if(i!==4)assert.strictEqual(dv.getUint32(regs+i*4,true),0x55660000+i,'register '+name);
  assert.deepStrictEqual(Buffer.from(new Uint8Array(memory.buffer,stack,256)),before,'stack canary '+name);return value;
 }
 const dc=e.edge_dc()>>>0,context=call('wglCreateContext',[dc]);assert(context);assert.strictEqual(call('wglMakeCurrent',[dc,context]),1);e.gl_sw_set_default_size(64,64);
 call('glViewport',[0,0,64,64]);e.gl_mtx_set_mode(0x1701);e.gl_mtx_load_identity();e.gl_mtx_ortho(0,64,0,64,-1,1);e.gl_mtx_set_mode(0x1700);e.gl_mtx_load_identity();
 call('glColor4f',[1,1,1,1],true);call('glClearColor',[0,0,0,1],true);

 const clear=()=>call('glClear',[0x4500]);
 const draw=(mode,pts,flags)=>{call('glBegin',[mode]);pts.forEach((p,i)=>{if(flags)call('glEdgeFlag',[flags[i%flags.length]]);call(p.length===3?'glVertex3f':'glVertex2f',p,true);});call('glEnd');};
 const pixel=(x,y)=>{const entry=e.gl_sw_entry()>>>0,pitch=dv.getUint16(entry+18,true),height=dv.getUint16(entry+14,true),dib=dv.getUint32(entry+20,true);return dv.getUint32(dib+(height-1-y)*pitch+4*x,true)&0xffffff;};
 const region=(x,y,r=1)=>{if(encoder)encoder.fence();let count=0;for(let a=x-r;a<=x+r;a++)for(let b=y-r;b<=y+r;b++)if(a>=0&&a<64&&b>=0&&b<64&&pixel(a,b))count++;return count;};
 const take=name=>{e.gl_wat_stream_flush();if(encoder)encoder.fence();cases[name]=batches.splice(0);
  if(process.env.GL_EDGE_PIXELS&&name!=='setup'){
   const {PNG}=require('pngjs'),png=new PNG({width:64,height:64});
   for(let y=0;y<64;y++)for(let x=0;x<64;x++){const v=pixel(x,63-y),i=(y*64+x)*4;png.data.set([(v>>>16)&255,(v>>>8)&255,v&255,255],i);}
   fs.mkdirSync(process.env.GL_EDGE_PIXELS,{recursive:true});fs.writeFileSync(path.join(process.env.GL_EDGE_PIXELS,name+'.png'),PNG.sync.write(png));
  }
 };
 const query=p=>{call('glGetIntegerv',[p,output]);return dv.getInt32(wa(output),true);};
 assert.strictEqual(query(0xb43),1,'initial current edge TRUE');
 const square=[[8,8],[24,8],[24,24],[8,24]],tri=[[8,8],[24,8],[8,24]];
 for(const route of ['static','dynamic']){
  call('glEdgeFlag',[0],false,route);assert.strictEqual(query(0xb43),0,route+' scalar FALSE');
  call('glEdgeFlag',[2],false,route);assert.strictEqual(query(0xb43),1,route+' noncanonical boolean');
  call('glEdgeFlag',[256],false,route);assert.strictEqual(query(0xb43),0,'scalar byte ABI');
  new Uint8Array(memory.buffer,wa(input),4).set([128,0,0,0]);
  call('glEdgeFlagv',[input],false,route);assert.strictEqual(query(0xb43),1,route+' vector normalization');
  call('glEdgeFlagPointer',[3,input],false,route);assert.strictEqual(query(0x808c),3,'pointer stride');
 }
 call('glEdgeFlag',[1]);call('glPushAttrib',[1]);call('glEdgeFlag',[0]);call('glPopAttrib');assert.strictEqual(query(0xb43),1,'CURRENT_BIT');
 call('glPushAttrib',[8]);call('glEdgeFlag',[0]);call('glPopAttrib');assert.strictEqual(query(0xb43),0,'POLYGON_BIT excludes current');
 call('glEdgeFlagPointer',[3,input]);call('glEnableClientState',[0x8079]);call('glPushClientAttrib',[2]);call('glEdgeFlagPointer',[0,input+1]);call('glDisableClientState',[0x8079]);call('glPopClientAttrib');
 assert.strictEqual(query(0x808c),3);assert.strictEqual(call('glIsEnabled',[0x8079]),1);
 call('glGetPointerv',[0x8093,output]);assert.strictEqual(dv.getUint32(wa(output),true),input);
 call('glEdgeFlagPointer',[-1,input+10]);assert.strictEqual(call('glGetError'),0x501);assert.strictEqual(query(0x808c),3);
 call('glBegin',[0]);call('glEdgeFlagPointer',[1,input]);call('glEnd');assert.strictEqual(call('glGetError'),0x502);
 call('glDisableClientState',[0x8079]);call('glEdgeFlag',[1]);call('glPolygonMode',[0x408,0x1b01]);take('setup');
 clear();draw(4,tri,[1]);assert(region(16,8)>0);assert(region(8,16)>0);take('triangleTrue');
 clear();draw(4,tri,[0]);assert.strictEqual(region(16,8),0);assert.strictEqual(region(8,16),0);take('triangleFalse');
 clear();draw(4,tri,[0,1,0]);assert.strictEqual(region(16,8),0);assert(region(16,16)>0);assert.strictEqual(region(8,16),0);take('triangleMixed');
 clear();draw(7,square,[1]);assert.strictEqual(region(16,16),0,'quad triangulation seam absent');assert(region(16,8)>0);take('quadTrue');
 clear();draw(9,square,[0,1,0,1]);assert.strictEqual(region(16,16),0,'polygon seam absent');assert.strictEqual(region(16,8),0);assert(region(24,16)>0);take('polygonMixed');
 // Clip in depth so the new boundary lies inside the screen. A line exactly
 // on a side clip plane may have no WebGL fragment coverage.
 const depthClipped=[[8,8,-2],[24,8,0],[24,24,0],[8,24,-2]];
 clear();draw(9,depthClipped,[0]);assert(region(16,16)>0,'clip-created boundary');assert.strictEqual(region(24,16),0,'surviving false original edge');assert.strictEqual(region(20,16),0,'no clipped triangulation seam');take('clippedFalse');
 clear();draw(7,depthClipped,[0]);assert(region(16,16)>0);assert.strictEqual(region(20,16),0);take('clippedQuadFalse');
 call('glEnable',[0xb44]);call('glCullFace',[0x405]);
 clear();draw(9,[[8,8],[16,8],[24,8],[24,24],[8,24]],[1]);assert(region(16,24)>0,'collinear first three retain front face');take('collinearFront');
 clear();draw(9,[[-8,24],[24,24],[24,8],[-8,8]],[0]);assert.strictEqual(region(0,16),0,'clipped back polygon culled');take('clippedBackCull');
 call('glDisable',[0xb44]);
 [1,0,0,-16].forEach((v,i)=>dv.setFloat64(wa(input)+8*i,v,true));call('glClipPlane',[0x3000,input]);call('glEnable',[0x3000]);
 clear();draw(9,square,[0]);assert(region(16,16)>0,'user plane creates boundary');assert.strictEqual(region(24,16),0);take('userClipFalse');call('glDisable',[0x3000]);
 call('glPolygonMode',[0x408,0x1b00]);call('glPointSize',[3],true);
 clear();draw(4,tri,[0,1,0]);assert.strictEqual(region(8,8),0);assert(region(24,8)>0);assert.strictEqual(region(8,24),0);take('pointMixed');
 clear();draw(9,[[-8,8],[24,8],[24,24],[-8,24]],[0]);assert(region(0,24)>0,'new outgoing clip boundary POINT');assert.strictEqual(region(0,8),0,'false outgoing original edge POINT');assert.strictEqual(region(0,16),0,'no clipping seam POINT');take('clippedPointFalse');
 call('glPolygonMode',[0x408,0x1b01]);
 // Packed and strided arrays, reordered by unsigned-short indices.
 const array=e.guest_alloc(32)>>>0;new Float32Array(memory.buffer,wa(array),8).set(square.flat());
 const indices=e.guest_alloc(8)>>>0;new Uint16Array(memory.buffer,wa(indices),4).set([2,3,0,1]);
 call('glVertexPointer',[2,0x1406,0,array]);call('glEnableClientState',[0x8074]);call('glEnableClientState',[0x8079]);
 new Uint8Array(memory.buffer,wa(input),12).set([0,99,99,2,99,99,0,99,99,128,99,99]);
 call('glEdgeFlagPointer',[3,input]);clear();call('glDrawElements',[7,4,0x1403,indices]);
 new Uint8Array(memory.buffer,wa(input),12).fill(0); // queued record owns its edge values
 assert.strictEqual(region(16,8),0);assert(region(24,16)>0);assert.strictEqual(region(16,24),0);assert(region(8,16)>0);assert.strictEqual(region(16,16),0);take('indexedStrided');
 new Uint8Array(memory.buffer,wa(input),4).set([1,0,1,0]);call('glEdgeFlagPointer',[0,input]);clear();call('glDrawArrays',[7,0,4]);
 assert(region(16,8)>0);assert.strictEqual(region(24,16),0);assert(region(16,24)>0);assert.strictEqual(region(8,16),0);take('packedArrays');
 call('glEdgeFlag',[1]);call('glArrayElement',[1]);assert.strictEqual(query(0xb43),0,'ArrayElement applies edge without Begin vertex');
 const arrayList=call('glGenLists',[1]);call('glNewList',[arrayList,0x1300]);call('glBegin',[7]);for(let i=0;i<4;i++)call('glArrayElement',[i]);call('glEnd');call('glEndList');
 new Uint8Array(memory.buffer,wa(input),4).fill(0);call('glEdgeFlag',[0]);clear();call('glCallList',[arrayList]);
 assert(region(16,8)>0);assert.strictEqual(region(24,16),0);assert(region(16,24)>0);assert.strictEqual(region(8,16),0);take('arrayListSnapshot');
 call('glDisableClientState',[0x8074]);call('glDisableClientState',[0x8079]);
 // Vector list owns its byte. Pointer setup executes at compile time and is absent from playback.
 const list=call('glGenLists',[1]);new Uint8Array(memory.buffer,wa(input),1)[0]=0;call('glEdgeFlag',[1]);call('glNewList',[list,0x1300]);call('glEdgeFlagv',[input]);call('glEdgeFlagPointer',[5,input]);call('glEndList');
 assert.strictEqual(query(0xb43),1);assert.strictEqual(query(0x808c),5);new Uint8Array(memory.buffer,wa(input),1)[0]=1;
 call('glEdgeFlagPointer',[7,input+1]);call('glCallList',[list]);assert.strictEqual(query(0xb43),0);assert.strictEqual(query(0x808c),7);
 clear();draw(7,square);assert.strictEqual(region(16,8),0);take('listVectorFalse');
 call('glNewList',[list,0x1301]);call('glEdgeFlag',[2]);call('glEndList');assert.strictEqual(query(0xb43),1);
 call('glEdgeFlag',[0]);call('glCallList',[list]);assert.strictEqual(query(0xb43),1,'compile-and-execute replay');
 // Flags do not affect strips/fans, filled polygons or independent line/point primitives.
 for(const [name,mode,pts]of[['strip',5,[[8,8],[24,8],[8,24],[24,24]]],['fan',6,square],['quadStrip',8,[[8,8],[24,8],[8,24],[24,24]]]]){
  clear();draw(mode,pts,[0]);assert(region(16,8)>0,name+' ignores user flags');take(name);
 }
 clear();draw(1,[[8,8],[24,8]],[0]);assert(region(16,8)>0);take('independentLines');
 clear();draw(0,[[16,16]],[0]);assert(region(16,16)>0);take('independentPoints');
 call('glPolygonMode',[0x408,0x1b02]);clear();draw(7,square,[0]);assert(region(16,16)>0);take('fillFalse');
 // Two independent oracles: distinct face emissions select the material;
 // diffuse light and an asymmetric normal also detect a missing normal flip.
 // All setters and vertices below go through the original opengl32 thunks.
 const vec=values=>{values.forEach((v,i)=>dv.setFloat32(wa(input)+4*i,v,true));return input;};
 const material=(face,p,values)=>call('glMaterialfv',[face,p,vec(values)]);
 call('glLightModelfv',[0xb53,vec([0,0,0,1])]);
 for(const p of [0x1200,0x1201,0x1202,0x1600])material(0x408,p,[0,0,0,1]);
 material(0x404,0x1600,[64/255,0,0,1]);material(0x405,0x1600,[0,0,128/255,1]);
 call('glLightfv',[0x4000,0x1200,vec([0,0,0,1])]);
 call('glLightfv',[0x4000,0x1201,vec([1,1,1,1])]);
 call('glLightfv',[0x4000,0x1202,vec([0,0,0,1])]);
 call('glNormal3f',[.6,0,.8],true);call('glLightModeli',[0xb52,1]);call('glEnable',[0xb50]);
 call('glPointSize',[3],true);call('glShadeModel',[0x1d01]);
 // z=x/8-2 puts the near clip at x=8 in the same plane. The first
 // three vertices remain collinear, and the clipped polygon has visible area.
 const fixtures=[
  ['ortho',[[8,8,0],[16,8,0],[24,8,0],[24,24,0],[8,24,0]],false],
  ['near',[[0,8,-2],[12,8,-.5],[24,8,1],[24,24,1],[0,24,-2]],false],
  // Frustum near=1 far=10, plane z=-x-1. The first vertex has W=-1,
  // the second W=0. Near clipping leaves x>=0: projected area is CCW.
  // A negative/zero-W divide of the original polygon is not an oracle.
  ['eye',[[-2,-.5,1],[-1,-.5,0],[2,-.5,-3],[2,.5,-3],[-2,.5,1]],true]
 ];
 const lightingMeta=[];
 for(const [fixture,vertices,perspective] of fixtures){
  call('glMatrixMode',[0x1701]);call('glLoadIdentity');
  if(perspective){
   // Load the frustum matrix explicitly; the scalar helper uses 32-bit slots.
   const matrix=e.guest_alloc(64)>>>0;
   new Float32Array(memory.buffer,wa(matrix),16).set([1,0,0,0,0,1,0,0,0,0,-11/9,-1,0,0,-20/9,0]);
   call('glLoadMatrixf',[matrix]);
  }else{
   const matrix=e.guest_alloc(64)>>>0;
   new Float32Array(memory.buffer,wa(matrix),16).set([1/32,0,0,0,0,1/32,0,0,0,0,-1,0,-1,-1,0,1]);
   call('glLoadMatrixf',[matrix]);
  }
  call('glMatrixMode',[0x1700]);
  for(const mode of [0x1b01,0x1b00])for(const winding of [1,-1])for(const frontCCW of [true,false])for(const light of [0,1,-1]){
   const front=(winding===1)===frontCCW;
   call('glFrontFace',[frontCCW?0x901:0x900]);call('glPolygonMode',[0x408,mode]);
   material(0x404,0x1201,[0,.5,0,1]);material(0x405,0x1201,[0,.25,0,1]);
   call(light?'glEnable':'glDisable',[0x4000]);
   if(light)call('glLightfv',[0x4000,0x1203,vec([0,0,light,0])]);
   const expected=front?[64,light===1?102:0,0]:[0,light===-1?51:0,128];
   // Reverse while retaining a collinear leading triple, then rotate by two.
   const base=winding===1?vertices:[vertices[2],vertices[1],vertices[0],vertices[4],vertices[3]];
   let reference=null;
   for(const rotate of [0,2]){
    const pts=base.slice(rotate).concat(base.slice(0,rotate));
    const name=`lighting_${fixture}_${mode}_${winding}_${frontCCW}_${light}_${rotate}`;
    clear();draw(9,pts,[1]);call('glFinish');if(encoder)encoder.fence();
    const colors=new Map(),mask=new Uint8Array(64*64);
    for(let y=0;y<64;y++)for(let x=0;x<64;x++){
     const rgb=pixel(x,y);if(rgb){colors.set(rgb,(colors.get(rgb)||0)+1);mask[y*64+x]=1;}
    }
    const actual=Array.from(colors,([rgb,count])=>({rgb:[rgb>>>16,(rgb>>>8)&255,rgb&255],count}));
    const ok=actual.length>0&&actual.every(c=>c.rgb.every((v,i)=>Math.abs(v-expected[i])<=1));
    const coverage=actual.reduce((n,c)=>n+c.count,0);
    // Raster endpoints can round differently after clipping; a cyclic rotation
    // must still preserve visible coverage to within a few boundary fragments.
    const pixelDifferences=reference===null?0:mask.reduce((n,v,i)=>n+(v!==reference[i]),0);
    const same=pixelDifferences<=8;
    if(!ok||!same)lightingFailures.push({name,expected,actual,pixelDifferences});
    reference=mask;lightingChecks.push({name,expected,actual,coverage,pixelDifferences,ok,same});
    lightingMeta.push({name,expected});take(name);
   }
  }
 }
 cases.__lighting=lightingMeta;
 call('glDisable',[0xb50]);call('glDisable',[0x4000]);call('glFrontFace',[0x901]);
 const context2=call('wglCreateContext',[dc]);call('glEdgeFlag',[0]);call('wglMakeCurrent',[dc,context2]);assert.strictEqual(query(0xb43),1,'new context default');
 call('glEdgeFlagPointer',[0,input]);call('wglMakeCurrent',[dc,context]);assert.strictEqual(query(0xb43),0);assert.strictEqual(query(0x808c),7,'context pointer restore');
 assert.strictEqual(call('wglCopyContext',[context,context2,1]),1);call('wglMakeCurrent',[dc,context2]);assert.strictEqual(query(0xb43),0,'copy CURRENT edge state');
 call('glEdgeFlag',[1]);call('wglMakeCurrent',[dc,context]);assert.strictEqual(call('wglCopyContext',[context,context2,8]),1);call('wglMakeCurrent',[dc,context2]);assert.strictEqual(query(0xb43),1,'copy POLYGON excludes current edge');
 call('wglMakeCurrent',[dc,context]);
 call('wglDeleteContext',[context2]);
 assert.strictEqual(call('glGetError'),0,'no ignored errors');
 if(process.env.GL_EDGE_CAPTURE)fs.writeFileSync(process.env.GL_EDGE_CAPTURE,JSON.stringify(cases));
 if(encoder){assert(encoder.snapshot().glQueued>0,'actual Worker queue used');assert.strictEqual(encoder.snapshot().fallbacks,0,'no silent native fallback');}
 console.log(JSON.stringify({pass:lightingFailures.length===0,queued,transport:encoder?.snapshot(),cases:Object.keys(cases),resolved:resolved.size,lightingChecks,lightingFailures}));
 assert.strictEqual(lightingChecks.length,144,'complete two-sided fixture matrix');
 assert.deepStrictEqual(lightingFailures,[],'two-sided boundary lighting and cyclic equivalence');
 }finally{encoder?.stop();if(manager)await manager.stop();}
})().catch(e=>{console.error(e);process.exitCode=1;});

