'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const root=process.env.WINE_ROOT||path.resolve(__dirname,'..'),req=p=>require(path.join(root,p));
const {bootRenderHarness}=req('test/render-helper'),{CALL_INDEX:O}=req('lib/gl-compat');
const Stream=req('lib/gl-command-stream');
const extraWat=`
 (func (export "interleaved_pending") (result i32) (global.get $d3dim_worker_pending))
 (func (export "interleaved_init")
   (global.set $thunk_guest_base (i32.add (global.get $image_base) (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
   (call $update_thunk_end))
 (func (export "interleaved_regs") (result i32) (global.get $reg_base))
 (func (export "interleaved_module") (param $name i32) (result i32)
   (call $handle_LoadLibraryA (local.get $name) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "interleaved_lookup") (param $module i32) (param $name i32) (result i32)
   (call $handle_GetProcAddress (local.get $module) (local.get $name) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "interleaved_invoke") (param $thunk i32) (result i32)
   (call $win32_dispatch (i32.div_u (i32.sub (local.get $thunk) (global.get $thunk_guest_base)) (i32.const 8))) (i32.load (global.get $reg_base)))(func (export "interleaved_dc") (result i32)
 (call $handle_GetDC (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
 (drop (call $gdi_dc_set_field (i32.load (global.get $reg_base)) (i32.const 92) (i32.const 42) (i32.const 0)))
 (i32.load (global.get $reg_base)))`;
async function run(){
 const queued=process.argv.includes('--worker');let encoder=null,manager=null,bridge=null,render=null,producer=null,memory;
 const captures=[],cases=[]; let prebuiltModule=null;
 const recordModule=bytes=>{const sha=require('crypto').createHash('sha256').update(bytes).digest('hex');console.log('NATIVE_MODULE_SHA256',sha,'bytes',bytes.length);if(process.env.GL_INTERLEAVED_MODULE_OUT)fs.writeFileSync(process.env.GL_INTERLEAVED_MODULE_OUT,bytes);};
 if(process.env.GL_INTERLEAVED_MUTATION){
  const mutation=JSON.parse(fs.readFileSync(process.env.GL_INTERLEAVED_MUTATION));let applied=false;
  const bytes=req('test/compile-src').compileSrcWasm((file,source)=>{
   if(file===mutation.file){assert.strictEqual(source.split(mutation.from).length-1,1,'unique mutation');source=source.replace(mutation.from,mutation.to);applied=true;}
   return file==='13-exports.wat'?source+extraWat:source;
  });assert(applied);recordModule(bytes);prebuiltModule=new WebAssembly.Module(bytes);
 }
 if(!prebuiltModule){
  const bytes=req('test/compile-src').compileSrcWasm((file,source)=>file==='13-exports.wat'?source+extraWat:source);
  recordModule(bytes);
  prebuiltModule=new WebAssembly.Module(bytes);
 }
 const h=await bootRenderHarness({fonts:'none',...(prebuiltModule?{prebuiltModule}:{extraWat}),width:64,height:64,extraHostOverrides:{gpu_gl_call(op,at,bytes){
  if(op===Stream.WAT_STREAM_FLUSH_OPCODE){
   const batch=Stream.memoryBatch(memory,at,bytes);
   Stream.replay(batch,(op,aux,c)=>{if(op===Stream.PACKED_DRAW_OPCODE){
    const vertices=Array.from(new Float32Array(c.buffer,c.pointerOffset,c.pointerLength/4));
    const record=new Uint8Array(32+c.pointerLength),v=new DataView(record.buffer);
    const start=c.stackOffset-32;record.set(new Uint8Array(c.buffer,start,32));
    v.setUint32(0,record.length,true);v.setUint32(24,32,true);
    record.set(new Uint8Array(c.buffer,c.pointerOffset,c.pointerLength),32);
    captures.push({vertices,record:Array.from(record)});
   }return 0;});
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
  // Use the production encoder's supported capacity option and require
  // every queued record to render without falling back to the direct path.
  encoder=new Encoder({module:h.module,memory,sigs:req('lib/host-import-sigs.generated.json').sigs,getImageBase:()=>e.get_image_base()>>>0,guestToWasm:wa,workerFactory:()=>port,capacity:0x400000,explicitFence:true,strictReady:true});assert(encoder.ready());
 }
 try {
 e.interleaved_init();const regs=e.interleaved_regs(),stackGuest=e.guest_alloc(256)>>>0,stack=wa(stackGuest),input=e.guest_alloc(1024)>>>0,output=e.guest_alloc(1024)>>>0;
 function str(s){const p=e.guest_alloc(s.length+1)>>>0;new Uint8Array(memory.buffer,wa(p),s.length+1).set(Buffer.from(s+'\0'));return p;}
 const module=e.interleaved_module(str('opengl32.dll'));assert(module);const resolved=new Map(),table=req('src/api_table.json');
 function call(name,args=[],float=false){
  if(!resolved.has(name)){dv.setUint32(regs+16,stackGuest,true);const p=e.interleaved_lookup(module,str(name))>>>0;assert(p,'real export '+name);assert.strictEqual(dv.getUint32(wa(p)+4,true),table.find(a=>a.name===name).id);resolved.set(name,p);}
  for(let i=0;i<8;i++)dv.setUint32(regs+i*4,0x55660000+i,true);
  dv.setUint32(regs+16,stackGuest,true);new Uint8Array(memory.buffer,stack,256).fill(0xa5);
  dv.setUint32(stack,0x12345678,true);args.forEach((v,i)=>(float===true||Array.isArray(float)&&float.includes(i))?dv.setFloat32(stack+4+i*4,v,true):dv.setUint32(stack+4+i*4,v>>>0,true));
  const before=Buffer.from(new Uint8Array(memory.buffer,stack,256)),value=e.interleaved_invoke(resolved.get(name))>>>0;
  assert.strictEqual(dv.getUint32(regs+16,true),stackGuest+4*(args.length+1),'stdcall '+name);
  for(let i=1;i<8;i++)if(i!==4)assert.strictEqual(dv.getUint32(regs+i*4,true),0x55660000+i,'register '+name);
  assert.deepStrictEqual(Buffer.from(new Uint8Array(memory.buffer,stack,256)),before,'stack canary '+name);return value;
 }
 const dc=e.interleaved_dc()>>>0,context=call('wglCreateContext',[dc]);assert(context);assert.strictEqual(call('wglMakeCurrent',[dc,context]),1);e.gl_sw_set_default_size(64,64);
 call('glViewport',[0,0,64,64]);e.gl_mtx_set_mode(0x1701);e.gl_mtx_load_identity();e.gl_mtx_ortho(0,64,0,64,-1,1);e.gl_mtx_set_mode(0x1700);e.gl_mtx_load_identity();
 call('glColor4f',[1,1,1,1],true);call('glClearColor',[0,0,0,1],true);
 if(process.argv.includes('--old-control')){
  console.log('UNCHANGED_OLD actual opengl32.dll export invocation');
  call('glInterleavedArrays',[0x2a20,0,input]);
  call('glGetPointerv',[0x808e,output]);
  assert.strictEqual(dv.getUint32(wa(output),true),input,'unchanged old must set literal vertex pointer');
  throw Error('Unexpected old implementation acceptance');
 }
 const pixel=(x,y)=>{call('glFinish');if(encoder)encoder.fence();const entry=e.gl_sw_entry()>>>0,pitch=dv.getUint16(entry+18,true),height=dv.getUint16(entry+14,true),dib=dv.getUint32(entry+20,true);return dv.getUint32(dib+(height-1-y)*pitch+4*x,true)&0xffffff;};
 // Independent literal fixture data comes from GL1.1 table2.5 audit,
 // not the native implementation. Expected vertex/pixel values are explicit.
 const formats=JSON.parse(fs.readFileSync(path.join(__dirname,'helpers/gl-interleaved-layouts.json'))).layouts;
 const query=p=>{call('glGetIntegerv',[p,output]);return dv.getInt32(wa(output),true);};
 const pointer=p=>{call('glGetPointerv',[p,output]);return dv.getUint32(wa(output),true);};
 const enable=p=>call('glIsEnabled',[p]);
 const desc={vertex:[0x8074,0x808e,0x807a,0x807b,0x807c],normal:[0x8075,0x808f,null,0x807e,0x807f],color:[0x8076,0x8090,0x8081,0x8082,0x8083],texture:[0x8078,0x8092,0x8088,0x8089,0x808a]};
 const state=()=>Object.values(desc).map(([cap,p,s,t,d])=>[enable(cap),pointer(p),s?query(s):3,query(t),query(d)]);
 for(const [i,layout] of formats.entries())for(const extra of [0,20])for(const unit of [0,1]){
  const stride=layout.packedStrideBytes+extra,base=e.guest_alloc(8*stride+64)>>>0;
  call('glClientActiveTextureARB',[0x84c0+unit]);
  // Other unit must retain its descriptor and enable through every format.
  call('glClientActiveTextureARB',[0x84c0+(1-unit)]);call('glTexCoordPointer',[3,0x1406,28,base+16]);call('glEnableClientState',[0x8078]);
  const other=state().at(-1);call('glClientActiveTextureARB',[0x84c0+unit]);
  for(const [name,args] of [['glVertexPointer',[4,0x1406,80,base+4]],['glNormalPointer',[0x1406,80,base+8]],['glColorPointer',[4,0x1406,80,base+12]],['glTexCoordPointer',[4,0x1406,80,base+16]]])call(name,args);
  for(const cap of [0x8074,0x8075,0x8076,0x8077,0x8078,0x8079])call('glEnableClientState',[cap]);
  const before=state();call('glInterleavedArrays',[0x2a20+i,extra?stride:0,base]);
  const after=state();
  for(const [j,[semantic,d]] of Object.entries(desc).entries()){
   const a=layout.arrays.find(a=>a.semantic===semantic);
   if(a)assert.deepStrictEqual(after[j],[1,base+a.offsetBytes,a.components,a.type==='FLOAT'?0x1406:0x1401,stride],layout.format+' '+semantic);
   else assert.deepStrictEqual(after[j],[0,...before[j].slice(1)],layout.format+' absent descriptor untouched');
  }
  for(const cap of [0x8074,0x8075,0x8076,0x8077,0x8078,0x8079]){
   const expected=enable(cap);call('glGetBooleanv',[cap,output]);assert.strictEqual(dv.getUint8(wa(output)),expected);
   call('glGetFloatv',[cap,output]);assert.strictEqual(dv.getFloat32(wa(output),true),expected);
   call('glGetDoublev',[cap,output]);assert.strictEqual(dv.getFloat64(wa(output),true),expected);
  }
  for(const cap of [0x8077,0x8079])assert.strictEqual(enable(cap),0,'edge/index disabled');
  call('glClientActiveTextureARB',[0x84c0+(1-unit)]);assert.deepStrictEqual(state().at(-1),other,'other unit preserved');call('glClientActiveTextureARB',[0x84c0+unit]);
 }
 // Capture independent copies of native packed records at gpu_gl_call;
 // the production software/worker routes also execute the records.

 const close=(a,b,label)=>{assert.strictEqual(a.length,b.length,label+' length');a.forEach((v,i)=>assert(Math.abs(v-b[i])<1e-6,label+' component'+i+': '+v+' vs '+b[i]));};
 const positions=[[8,8],[56,8],[32,56]];
 call('glClientActiveTextureARB',[0x84c1]);call('glDisableClientState',[0x8078]);call('glTexCoord4f',[0,0,0,1],true);call('glClientActiveTextureARB',[0x84c0]);
 for(const [i,layout] of formats.entries())for(const padding of [0,20])for(const [indexed,viaList] of [[false,false],[true,false],[false,true]]){
  const stride=layout.packedStrideBytes+padding,base=e.guest_alloc(stride*5+64)>>>0;
  new Uint8Array(memory.buffer,wa(base),stride*5+64).fill(0xa5);
  const vertex=layout.arrays.find(a=>a.semantic==='vertex'),four=vertex.components===4;
  // Independent semantic expectations: derive presence from format spelling,
  // never from implementation or a decoded copy of emitted layout metadata.
  const name=layout.format,hasColor=name.includes('C'),hasNormal=name.includes('N3F'),hasTexture=name.includes('T');
  const ub=name.includes('C4UB'),c3=name.includes('C3F'),t4=name.includes('T4F');
  const expectedColor=hasColor?(ub?[1,64/255,128/255,192/255]:[.25,.5,.75,c3?1:.875]):[.125,.25,.5,.75];
  const expectedNormal=hasNormal?[.25,.5,.75]:[-.25,-.5,1];
  const expectedTexture=hasTexture?[.25,.5,t4?.75:0,t4?2:1]:[.125,.25,.5,1];
  call('glColor4f',[.125,.25,.5,.75],true);call('glNormal3f',[-.25,-.5,1],true);call('glTexCoord4f',[.125,.25,.5,1],true);
  call('glInterleavedArrays',[0x2a20+i,padding?stride:0,base]);
  // Write AFTER setup. Eager copying in InterleavedArrays is a semantic bug.
  for(let j=0;j<3;j++)for(const a of layout.arrays){
   const values=a.semantic==='vertex'?[positions[j][0]*(four?2:1),positions[j][1]*(four?2:1),0,2]:a.semantic==='color'?(ub?[255,64,128,192]:[.25,.5,.75,.875]):a.semantic==='normal'?[.25,.5,.75]:[.25,.5,.75,2];
   for(let k=0;k<a.components;k++)a.type==='UNSIGNED_BYTE'?dv.setUint8(wa(base)+(j+1)*stride+a.offsetBytes+k,values[k]):dv.setFloat32(wa(base)+(j+1)*stride+a.offsetBytes+k*4,values[k],true);
  }
  const index=e.guest_alloc(8)>>>0;new Uint16Array(memory.buffer,wa(index),4).set([0,3,1,2]);
  call('glClear',[0x4500]);const ownedList=viaList?call('glGenLists',[1]):0;if(viaList)call('glNewList',[ownedList,0x1300]);
  if(indexed)call('glDrawElements',[4,3,0x1403,index+2]);else call('glDrawArrays',[4,1,3]);
  if(viaList)call('glEndList');
  // Overwrite all source and index bytes before any host/worker flush.
  new Uint8Array(memory.buffer,wa(base),stride*5+64).fill(0);new Uint8Array(memory.buffer,wa(index),8).fill(0xff);
  if(viaList){call('glCallList',[ownedList]);call('glDeleteLists',[ownedList,1]);}
  call('glFinish');const actual=captures.pop();assert(actual,'native packed draw observed');
  const order=indexed?[2,0,1]:[0,1,2];
  const expected=order.flatMap(j=>[positions[j][0]*(four?2:1),positions[j][1]*(four?2:1),0,...expectedColor,expectedTexture[0],expectedTexture[1],...expectedNormal,0,0,four?2:1,expectedTexture[2],expectedTexture[3],0,1]);
  close(actual.vertices,expected,name+' '+(indexed?'indexed':'first1')+' stride'+stride);
  cases.push({name:name+'-'+padding+'-'+(viaList?'list':indexed?'elements':'arrays'),record:actual.record,rgb:expectedColor.slice(0,3).map(v=>Math.round(v*255))});
  // Interior is unambiguously inside all orientations of the same triangle.
  const rgb=pixel(32,20),channels=[rgb>>>16,(rgb>>>8)&255,rgb&255];
  expectedColor.slice(0,3).forEach((v,k)=>assert(Math.abs(channels[k]-Math.round(v*255))<=1,name+' literal interior color'+k));
  assert.strictEqual(pixel(2,2),0,name+' outside triangle stays black');
 }
 // A vertex-only triangle with overlapping records: literal floats generate
 // (8,8), (8,56), (56,8) at a4-byte step. Its interior at(16,16) is red.
 const overlap=e.guest_alloc(32)>>>0;
 new Float32Array(memory.buffer,wa(overlap),4).set([8,8,56,8]);
 call('glColor4f',[1,0,0,1],true);
 call('glInterleavedArrays',[0x2a20,4,overlap]);
 call('glClear',[0x4500]);call('glDrawArrays',[4,0,3]);
 assert.strictEqual(pixel(16,16),0xff0000,'literal overlapping record geometry');
 // Setup stores addresses without translating client memory. Even a wholly
 // unmapped address is legal until consumption. Query preserves x86 identity.
 const saved=state();call('glInterleavedArrays',[0x2a2d,0,0xdead0000]);
 assert.strictEqual(pointer(0x808e),0xdead002c);
 call('glPushClientAttrib',[2]);call('glInterleavedArrays',[0x2a20,0,0]);call('glPopClientAttrib');
 assert.strictEqual(pointer(0x808e),0xdead002c,'client pop restores descriptor');
 const noRead=state();
 for(const [format,stride,error]of [[0x2a1f,0,0x500],[0x2a2e,0,0x500],[0x2a20,-1,0x501],[0x2a2d,-2147483648,0x501]]){
  call('glInterleavedArrays',[format,stride,0xffffffff]);assert.strictEqual(call('glGetError'),error);assert.strictEqual(call('glGetError'),0);
  assert.deepStrictEqual(state(),noRead,'invalid setup leaves every descriptor/enable intact');
 }
 call('glBegin',[4]);call('glInterleavedArrays',[0x2a21,0,overlap]);call('glEnd');
 assert.strictEqual(call('glGetError'),0x502);assert.deepStrictEqual(state(),noRead,'Begin/End rejection preserves client state');
 // Server attribute masks cannot restore client-array setup.
 call('glInterleavedArrays',[0x2a20,4,overlap]);call('glPushAttrib',[0xffffffff]);call('glInterleavedArrays',[0x2a21,20,overlap+4]);call('glPopAttrib');
 assert.strictEqual(pointer(0x808e),overlap+4);assert.strictEqual(query(0x807c),20);
 // Two independent context stacks, deletion and clean recreation.
 call('glPushClientAttrib',[2]);call('glInterleavedArrays',[0x2a20,4,overlap]);
 const ctx2=call('wglCreateContext',[dc]);assert(ctx2&&ctx2!==context);call('wglMakeCurrent',[dc,ctx2]);
 assert.strictEqual(enable(0x8074),0);assert.strictEqual(pointer(0x808e),0);assert.strictEqual(query(0xbb1),0);
 call('glInterleavedArrays',[0x2a21,36,overlap+12]);call('glPushClientAttrib',[2]);
 call('wglMakeCurrent',[dc,context]);assert.strictEqual(pointer(0x808e),overlap);assert.strictEqual(query(0xbb1),1);
 call('glPopClientAttrib');assert.strictEqual(pointer(0x808e),overlap+4);
 call('wglMakeCurrent',[dc,ctx2]);assert.strictEqual(pointer(0x808e),overlap+12);assert.strictEqual(query(0xbb1),1);
 call('wglMakeCurrent',[dc,context]);assert.strictEqual(call('wglDeleteContext',[ctx2]),1);
 const ctx3=call('wglCreateContext',[dc]);call('wglMakeCurrent',[dc,ctx3]);assert.strictEqual(enable(0x8074),0);assert.strictEqual(pointer(0x808e),0);assert.strictEqual(query(0xbb1),0);
 call('wglMakeCurrent',[dc,context]);call('wglDeleteContext',[ctx3]);
 // Both list modes execute setup immediately and store no pointer setter.
 for(const listMode of [0x1300,0x1301]){
  const list=call('glGenLists',[1]);call('glNewList',[list,listMode]);call('glInterleavedArrays',[0x2a20,4,overlap]);
  assert.strictEqual(pointer(0x808e),overlap,'list setup executes at compile time');call('glEndList');
  call('glInterleavedArrays',[0x2a21,20,overlap+4]);call('glCallList',[list]);
  assert.strictEqual(pointer(0x808e),overlap+4,'list replay must not restore client pointer');call('glDeleteLists',[list,1]);
 }
 // A compiling Begin also rejects setup, even when GL_COMPILE does not
 // execute the primitive immediately. Neither list mode may change client state.
 for(const mode of [0x1300,0x1301]){
  const before=state(),id=call('glGenLists',[1]);call('glNewList',[id,mode]);call('glBegin',[4]);
  call('glInterleavedArrays',[0x2a2d,60,overlap]);call('glEnd');call('glEndList');
  assert.strictEqual(call('glGetError'),0x502,'compiling Begin rejects setup');
  assert.deepStrictEqual(state(),before,'compiling Begin preserves descriptors');call('glDeleteLists',[id,1]);
 }
 // Client stacks execute during compilation too, independently of replay.
 const list=call('glGenLists',[1]);call('glNewList',[list,0x1300]);call('glPushClientAttrib',[2]);call('glInterleavedArrays',[0x2a20,4,overlap]);call('glPopClientAttrib');call('glEndList');
 assert.strictEqual(pointer(0x808e),overlap+4);call('glCallList',[list]);assert.strictEqual(pointer(0x808e),overlap+4);assert.strictEqual(query(0xbb1),0);
 // Owned compile-time array values, but replay-time transforms/current state.
 const listData=e.guest_alloc(128)>>>0,indexData=e.guest_alloc(16)>>>0;
 const listFixture=()=>{
  new Uint8Array(memory.buffer,wa(listData),128).fill(0);
  [[8,8],[56,8],[32,56]].forEach((p,i)=>{
   new Uint8Array(memory.buffer,wa(listData)+i*12,4).set([255,0,0,255]);
   dv.setFloat32(wa(listData)+i*12+4,p[0],true);dv.setFloat32(wa(listData)+i*12+8,p[1],true);
  });
  new Uint16Array(memory.buffer,wa(indexData),3).set([2,0,1]);
 };
 for(const mode of [0x1300,0x1301])for(const route of ['arrays','elements','element']){
  listFixture();const list=call('glGenLists',[1]);
  call('glNewList',[list,mode]);call('glInterleavedArrays',[0x2a22,0,listData]);
  if(route==='arrays')call('glDrawArrays',[4,0,3]);
  if(route==='elements')call('glDrawElements',[4,3,0x1403,indexData]);
  if(route==='element'){call('glBegin',[4]);for(const i of [0,1,2])call('glArrayElement',[i]);call('glEnd');}
  call('glEndList');
  // Destroy both data and index sources, then install unrelated client state.
  new Uint8Array(memory.buffer,wa(listData),128).fill(0);new Uint8Array(memory.buffer,wa(indexData),16).fill(0xff);
  call('glInterleavedArrays',[0x2a21,36,listData+64]);const beforeReplay=state();
  call('glClear',[0x4500]);call('glCallList',[list]);
  assert.strictEqual(pixel(32,20),0xff0000,route+' list owns color/position values '+mode);
  assert.deepStrictEqual(state(),beforeReplay,'list replay leaves client setup alone');
  call('glMatrixMode',[0x1700]);call('glPushMatrix');call('glTranslatef',[4,0,0],true);
  call('glClear',[0x4500]);call('glCallList',[list]);
  assert.strictEqual(pixel(9,9),0,'list array positions transform at replay');assert.strictEqual(pixel(32,20),0xff0000);
  call('glPopMatrix');call('glDeleteLists',[list,1]);
 }
 // Disabled color array means replay takes the then-current server color.
 const verts=e.guest_alloc(24)>>>0;new Float32Array(memory.buffer,wa(verts),6).set([8,8,56,8,32,56]);
 call('glColor4f',[1,0,0,1],true);const listNoColor=call('glGenLists',[1]);
 call('glNewList',[listNoColor,0x1300]);call('glInterleavedArrays',[0x2a20,0,verts]);call('glDrawArrays',[4,0,3]);call('glEndList');
 new Uint8Array(memory.buffer,wa(verts),24).fill(0);call('glColor4f',[0,0,1,1],true);call('glClear',[0x4500]);call('glCallList',[listNoColor]);
 assert.strictEqual(pixel(32,20),0x0000ff,'disabled list arrays leave replay current attributes live');

 if(encoder){assert(encoder.snapshot().glQueued>0,'actual production shared GL raster queue used');assert.strictEqual(encoder.snapshot().fallbacks,0,'queued coverage has no fallback');}
 assert.strictEqual(call('glGetError'),0,'no unconsumed GL error');
 new Float32Array(memory.buffer,wa(verts),6).set([8,8,56,8,32,56]);
 call('glInterleavedArrays',[0x2a20,0,verts]);call('glDrawArrays',[4,0,3]);
 if(queued)assert.strictEqual(e.interleaved_pending(),1,'context owns unfenced queued draw');
 assert.strictEqual(call('wglDeleteContext',[context]),1);assert.strictEqual(e.interleaved_pending(),0,'deletion fences owned queued draw');
 console.log(JSON.stringify({pass:true,queued,formats:formats.length,cases:cases.length}));return cases;
 }finally{encoder?.stop();if(manager)await manager.stop();}
}
function negativeControls(web=false) {
 const {spawnSync}=require('child_process'),os=require('os');
 const controls=JSON.parse(fs.readFileSync(path.join(__dirname,'helpers/gl-interleaved-layouts.json'))).negativeControls;
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'interleaved-controls-'));
 try {for(const control of controls.filter(c=>(c.name.endsWith('pixels'))===web)){
  const file=path.join(dir,control.name+'.json');fs.writeFileSync(file,JSON.stringify(control.mutation));
  const env={...process.env};delete env.GL_INTERLEAVED_MODULE_OUT;
  env[web?'GL_INTERLEAVED_WEB_MUTATION':'GL_INTERLEAVED_MUTATION']=file;
  const result=spawnSync(process.execPath,[path.join(__dirname,web?'test-gl-interleaved-web.js':'test-gl-interleaved.js')],{env,encoding:'utf8',timeout:180000});
  const log=(result.stdout||'')+(result.stderr||'');
  assert.strictEqual(result.status,1,control.name+' must fail: '+log);
  assert(log.includes(control.assertion),control.name+' must hit its semantic assertion: '+log);
  console.log(JSON.stringify({negativeControl:control.name,expectedFailure:true,assertion:control.assertion}));
 }} finally {fs.rmSync(dir,{recursive:true,force:true});}
}
module.exports={run,negativeControls};
if(require.main===module){if(process.argv.includes('--negative-controls'))negativeControls();else run().catch(e=>{console.error(e);process.exitCode=1;});}
