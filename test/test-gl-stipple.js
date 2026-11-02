'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const root=process.env.WINE_ROOT||'/home/user/wine-assembly',req=p=>require(path.join(root,p));
const {bootRenderHarness}=req('test/render-helper'),{CALL_INDEX:O}=req('lib/gl-compat');
const Stream=req('lib/gl-command-stream');
const extraWat=`
 (func (export "stipple_pending") (result i32) (global.get $d3dim_worker_pending))
 (func (export "stipple_init")
   (global.set $thunk_guest_base (i32.add (global.get $image_base) (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
   (call $update_thunk_end))
 (func (export "stipple_regs") (result i32) (global.get $reg_base))
 (func (export "stipple_module") (param $name i32) (result i32)
   (call $handle_LoadLibraryA (local.get $name) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "stipple_lookup") (param $module i32) (param $name i32) (result i32)
   (call $handle_GetProcAddress (local.get $module) (local.get $name) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "stipple_invoke") (param $thunk i32) (result i32)
   (call $win32_dispatch (i32.div_u (i32.sub (local.get $thunk) (global.get $thunk_guest_base)) (i32.const 8))) (i32.load (global.get $reg_base)))(func (export "stipple_dc") (result i32)
 (call $handle_GetDC (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
 (drop (call $gdi_dc_set_field (i32.load (global.get $reg_base)) (i32.const 92) (i32.const 42) (i32.const 0)))
 (i32.load (global.get $reg_base)))`;
(async()=>{
 const fallback=process.argv.includes('--worker-fallback');
 const queued=fallback||process.argv.includes('--worker');let encoder=null,manager=null,bridge=null,render=null,producer=null,memory;
 let prebuiltModule=null;
 if(process.env.GL_STIPPLE_MUTATION){
  const mutation=JSON.parse(fs.readFileSync(process.env.GL_STIPPLE_MUTATION));let applied=false;
  const bytes=req('test/compile-src').compileSrcWasm((file,source)=>{
   if(file===mutation.file){assert.strictEqual(source.split(mutation.from).length-1,1,'unique mutation');source=source.replace(mutation.from,mutation.to);applied=true;}
   return file==='13-exports.wat'?source+extraWat:source;
  });assert(applied);prebuiltModule=new WebAssembly.Module(bytes);
 }
 const h=await bootRenderHarness({fonts:'none',...(prebuiltModule?{prebuiltModule}:{extraWat}),width:64,height:64,extraHostOverrides:{gpu_gl_call(op,at,bytes){
  if(op===Stream.WAT_STREAM_FLUSH_OPCODE){
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
  // A maximum2MiB GL record plus its state exceeds the default2MiB queue.
  // Use the production encoder's supported capacity option so the chunk
  // continuation test also renders on the worker instead of its fallback.
  encoder=new Encoder({module:h.module,memory,sigs:req('lib/host-import-sigs.generated.json').sigs,getImageBase:()=>e.get_image_base()>>>0,guestToWasm:wa,workerFactory:()=>port,capacity:0x400000,explicitFence:true,strictReady:true});assert(encoder.ready());
 }
 try {
 e.stipple_init();const regs=e.stipple_regs(),stackGuest=e.guest_alloc(256)>>>0,stack=wa(stackGuest),input=e.guest_alloc(1024)>>>0,output=e.guest_alloc(1024)>>>0;
 function str(s){const p=e.guest_alloc(s.length+1)>>>0;new Uint8Array(memory.buffer,wa(p),s.length+1).set(Buffer.from(s+'\0'));return p;}
 const module=e.stipple_module(str('opengl32.dll'));assert(module);const resolved=new Map(),table=req('src/api_table.json');
 function call(name,args=[],float=false){
  if(!resolved.has(name)){dv.setUint32(regs+16,stackGuest,true);const p=e.stipple_lookup(module,str(name))>>>0;assert(p,'real export '+name);assert.strictEqual(dv.getUint32(wa(p)+4,true),table.find(a=>a.name===name).id);resolved.set(name,p);}
  for(let i=0;i<8;i++)dv.setUint32(regs+i*4,0x55660000+i,true);
  dv.setUint32(regs+16,stackGuest,true);new Uint8Array(memory.buffer,stack,256).fill(0xa5);
  dv.setUint32(stack,0x12345678,true);args.forEach((v,i)=>(float===true||Array.isArray(float)&&float.includes(i))?dv.setFloat32(stack+4+i*4,v,true):dv.setUint32(stack+4+i*4,v>>>0,true));
  const before=Buffer.from(new Uint8Array(memory.buffer,stack,256)),value=e.stipple_invoke(resolved.get(name))>>>0;
  assert.strictEqual(dv.getUint32(regs+16,true),stackGuest+4*(args.length+1),'stdcall '+name);
  for(let i=1;i<8;i++)if(i!==4)assert.strictEqual(dv.getUint32(regs+i*4,true),0x55660000+i,'register '+name);
  assert.deepStrictEqual(Buffer.from(new Uint8Array(memory.buffer,stack,256)),before,'stack canary '+name);return value;
 }
 const dc=e.stipple_dc()>>>0,context=call('wglCreateContext',[dc]);assert(context);assert.strictEqual(call('wglMakeCurrent',[dc,context]),1);e.gl_sw_set_default_size(64,64);
 call('glViewport',[0,0,64,64]);e.gl_mtx_set_mode(0x1701);e.gl_mtx_load_identity();e.gl_mtx_ortho(0,64,0,64,-1,1);e.gl_mtx_set_mode(0x1700);e.gl_mtx_load_identity();
 call('glColor4f',[1,1,1,1],true);call('glClearColor',[0,0,0,1],true);
 const clear=()=>call('glClear',[0x4500]);
 const draw=(mode,pts)=>{call('glBegin',[mode]);for(const p of pts)call('glVertex2f',p,true);call('glEnd');};
 const pixel=(x,y)=>{if(encoder)encoder.fence();const entry=e.gl_sw_entry()>>>0,pitch=dv.getUint16(entry+18,true),height=dv.getUint16(entry+14,true),dib=dv.getUint32(entry+20,true);return dv.getUint32(dib+(height-1-y)*pitch+4*x,true)&0xffffff;};
 const bits=(xs,y)=>xs.map(x=>pixel(x,y)?'1':'0').join('');
 const xs=Array.from({length:8},(_,i)=>i+4);
 clear();call('glLineStipple',[2,5]);call('glEnable',[0xb24]);draw(1,[[4,10],[12,10]]);
 assert.strictEqual(bits(xs,9),'11001100','literal factor2 line raster; saved old must fail here');
 clear();call('glLineStipple',[1,3]);draw(1,[[4,10],[9,10],[9,10],[14,10]]);
 assert.strictEqual(bits(Array.from({length:10},(_,i)=>i+4),9),'1100011000','independent segments reset');
 clear();draw(3,[[4,10],[9,10],[14,10]]);
 assert.strictEqual(bits(Array.from({length:10},(_,i)=>i+4),9),'1100000000','connected segments carry');
 clear();draw(3,[[4,10],[9,10]]);draw(3,[[9,10],[14,10]]);
 assert.strictEqual(bits(Array.from({length:10},(_,i)=>i+4),9),'1100011000','separate Begin resets');
 clear();call('glLineStipple',[1,1]);draw(1,[[4,10],[24,10]]);
 assert.strictEqual(bits(Array.from({length:20},(_,i)=>i+4),9),'10000000000000001000','pattern wraps at16');
 clear();call('glLineStipple',[1,5]);draw(1,[[12,10],[4,10]]);
 assert.strictEqual(bits([12,11,10,9,8,7,6,5],9),'10100000','reverse follows generating direction');
 clear();draw(1,[[10,4],[10,12]]);
 assert.strictEqual([3,4,5,6,7,8,9,10].map(y=>pixel(10,y)?'1':'0').join(''),'10100000','y major advances per row');
 clear();draw(1,[[4,10],[12,18]]);
 assert.strictEqual(xs.map((x,i)=>pixel(x,9+i)?'1':'0').join(''),'10100000','diagonal advances major columns');
 clear();call('glLineWidth',[3],true);draw(1,[[4,10],[12,10]]);
 for(const y of [8,9,10])assert.strictEqual(bits(xs,y),'10100000','wide line repeats same column counter');call('glLineWidth',[1],true);
 clear();call('glLineStipple',[1,0x1111]);draw(2,[[4,10],[9,10],[9,15],[4,15]]);
 assert.strictEqual(bits([4,5,6,7,8],9),'10001','loop first edge');assert.strictEqual([10,11,12,13,14].map(y=>pixel(9,y-1)?'1':'0').join(''),'00010','loop second edge carries');
 clear();call('glLineStipple',[1,3]);call('glScissor',[9,0,5,64]);call('glEnable',[0xc11]);draw(3,[[4,10],[9,10],[14,10]]);call('glDisable',[0xc11]);
 assert.strictEqual(bits([9,10,11,12,13],9),'00000','rejected first segment still advances');
 // Client arrays use the same strip lowering and reset contract.
 const array=e.guest_alloc(24)>>>0;new Float32Array(memory.buffer,wa(array),6).set([4,10,9,10,14,10]);
 call('glVertexPointer',[2,0x1406,0,array]);call('glEnableClientState',[0x8074]);clear();call('glDrawArrays',[3,0,3]);
 assert.strictEqual(bits(Array.from({length:10},(_,i)=>i+4),9),'1100000000','DrawArrays strip carries');call('glDisableClientState',[0x8074]);
 const indices=e.guest_alloc(6)>>>0;new Uint16Array(memory.buffer,wa(indices),3).set([0,1,2]);
 call('glEnableClientState',[0x8074]);clear();call('glDrawElements',[3,3,0x1403,indices]);call('glDisableClientState',[0x8074]);
 assert.strictEqual(bits(Array.from({length:10},(_,i)=>i+4),9),'1100000000','DrawElements strip carries');
 // A long zero-length prefix crosses the native2MiB command boundary. The
 // final pair must retain the phase accumulated before the continuation.
 clear();
 let enqueueGl,chunkCalls=0;
 if(fallback){
  enqueueGl=encoder.enqueueGl;
  // Exercise the real native fenced fallback after the first queued chunk.
  encoder.enqueueGl=function(...args){if(++chunkCalls===2){this.stats.fallbacks++;return 0;}return enqueueGl.apply(this,args);};
 }
 call('glBegin',[3]);call('glVertex2f',[4,10],true);for(let i=0;i<14000;i++)call('glVertex2f',[9,10],true);
 call('glVertex2f',[14,10],true);call('glEnd');
 if(fallback){encoder.enqueueGl=enqueueGl;assert.strictEqual(chunkCalls,2,'queued prefix then native fallback');}
 assert.strictEqual(bits(Array.from({length:10},(_,i)=>i+4),9),'1100000000','large strip command continuation');
 call('glDisable',[0xb24]);
 // canonical asymmetric rows: window (x,y) modulo32. Literal expected bits
 // are independent of the bit-address arithmetic in production.
 const mask=new Uint8Array(128);mask.set([128,0,0,1]);mask.set([64,0,0,2],4);mask.set([0,0,0,128],124);
 new Uint8Array(memory.buffer,wa(input),128).set(mask);call('glPolygonStipple',[input]);call('glEnable',[0xb42]);
 clear();draw(7,[[0,0],[64,0],[64,64],[0,64]]);
 assert.strictEqual(bits([0,1,24,30,31,32,33,56,62,63],32),'1000110001','polygon row0 repeated at y32');
 assert.strictEqual(bits([0,1,24,30,31,32,33,56,62,63],33),'0101001010','polygon row1 orientation');
 assert.strictEqual(bits([20,23,24,25,31,32,55,56,57],31),'001000010','polygon row31 distinct');
 call('glViewport',[5,7,48,48]);call('glScissor',[30,32,4,1]);call('glEnable',[0xc11]);clear();draw(7,[[0,0],[64,0],[64,64],[0,64]]);
 assert.strictEqual(bits([30,31,32,33],32),'0110','window anchoring survives viewport/scissor offsets');
 call('glDisable',[0xc11]);call('glViewport',[0,0,64,64]);
 const get=()=>{new Uint8Array(memory.buffer,wa(output),512).fill(0xa5);call('glGetPolygonStipple',[output]);return Array.from(new Uint8Array(memory.buffer,wa(output),512));};
 const query=p=>{call('glGetIntegerv',[p,output]);return dv.getInt32(wa(output),true);};
 assert.strictEqual(query(0xb25),3);assert.strictEqual(query(0xb26),1);assert.strictEqual(call('glIsEnabled',[0xb42]),1);
 call('glLineStipple',[-20,0x12340005]);assert.strictEqual(query(0xb26),1);assert.strictEqual(query(0xb25),5);
 call('glLineStipple',[999,3]);assert.strictEqual(query(0xb26),256);
 // Each attribute bit owns only its specified enable/parameters or mask.
 call('glPushAttrib',[4]);call('glLineStipple',[7,8]);call('glEnable',[0xb24]);call('glDisable',[0xb42]);call('glPopAttrib');
 assert.strictEqual(query(0xb26),256);assert.strictEqual(query(0xb25),3);assert.strictEqual(call('glIsEnabled',[0xb24]),0);assert.strictEqual(call('glIsEnabled',[0xb42]),0);
 call('glEnable',[0xb42]);call('glPushAttrib',[8]);call('glDisable',[0xb42]);call('glEnable',[0xb24]);call('glPopAttrib');
 assert.strictEqual(call('glIsEnabled',[0xb42]),1);assert.strictEqual(call('glIsEnabled',[0xb24]),1);
 call('glPushAttrib',[16]);new Uint8Array(memory.buffer,wa(input),128).fill(0);call('glPolygonStipple',[input]);call('glDisable',[0xb42]);call('glPopAttrib');
 assert.strictEqual(call('glIsEnabled',[0xb42]),0);assert.deepStrictEqual(get().slice(0,128),Array.from(mask));
 call('glEnable',[0xb42]);call('glPushAttrib',[0x2000]);call('glDisable',[0xb42]);call('glDisable',[0xb24]);call('glLineStipple',[6,9]);call('glPopAttrib');
 assert.strictEqual(call('glIsEnabled',[0xb42]),1);assert.strictEqual(call('glIsEnabled',[0xb24]),1);assert.strictEqual(query(0xb26),6);assert.strictEqual(query(0xb25),9);
 // Context defaults and saved attribute frames belong to the context.
 call('glPushAttrib',[4|16]);call('glLineStipple',[2,5]);const context2=call('wglCreateContext',[dc]);assert(context2);call('wglMakeCurrent',[dc,context2]);
 assert.strictEqual(query(0xb26),1);assert.strictEqual(query(0xb25),65535);assert.strictEqual(call('glIsEnabled',[0xb24]),0);assert(get().slice(0,128).every(v=>v===255));
 call('glLineStipple',[3,7]);call('wglMakeCurrent',[dc,context]);assert.strictEqual(query(0xb26),2);call('glPopAttrib');assert.strictEqual(query(0xb26),6);assert.deepStrictEqual(get().slice(0,128),Array.from(mask));
 call('wglDeleteContext',[context2]);call('glDisable',[0xb24]);new Uint8Array(memory.buffer,wa(input),128).set(mask);
 let got=get();assert.deepStrictEqual(got.slice(0,128),Array.from(mask),'get canonical mask');assert(got.slice(128).every(v=>v===0xa5));
 call('glPixelStorei',[0xd02,40]);call('glPixelStorei',[0xd05,8]);call('glPixelStorei',[0xd03,1]);call('glPixelStorei',[0xd04,3]);
 got=get();assert.deepStrictEqual(got.slice(8,13),[176,0,0,0,37],'MSB pack nonbyte offset preserves bits');assert.deepStrictEqual(got.slice(16,21),[168,0,0,0,69]);assert.deepStrictEqual(got.slice(13,16),[165,165,165]);
 call('glPixelStorei',[0xd01,1]);got=get();assert.deepStrictEqual(got.slice(8,13),[13,0,0,0,164]);assert.deepStrictEqual(got.slice(16,21),[21,0,0,0,162]);
 for(const [p,v]of[[0xd01,0],[0xd02,0],[0xd05,4],[0xd03,0],[0xd04,0]])call('glPixelStorei',[p,v]);
 // Independent literal input layouts test UNPACK in both bit orders.
 for(const lsb of [0,1]){
  const source=new Uint8Array(memory.buffer,wa(input),512);source.fill(0);
  source.set(lsb?[13,0,0,0,164]:[176,0,0,0,37],8);
  source.set(lsb?[21,0,0,0,162]:[168,0,0,0,69],16);
  source.set(lsb?[5,0,0,8,160]:[160,0,0,16,5],256);
  for(const [p,v]of[[0xcf0,1],[0xcf1,lsb],[0xcf2,40],[0xcf3,1],[0xcf4,3],[0xcf5,8]])call('glPixelStorei',[p,v]);
  call('glPixelTransferi',[0xd10,1]);call('glPixelTransferf',[0xd14,0],[1]);
  call('glPolygonStipple',[input]);assert.deepStrictEqual(get().slice(0,128),Array.from(mask),'literal UNPACK skip/stride/order, ignores swaps and transfers');
 }
 call('glPixelTransferi',[0xd10,0]);call('glPixelTransferf',[0xd14,1],[1]);
 for(const [p,v]of[[0xcf0,0],[0xcf1,0],[0xcf2,0],[0xcf3,0],[0xcf4,0],[0xcf5,4]])call('glPixelStorei',[p,v]);
 new Uint8Array(memory.buffer,wa(input),128).set(mask);
 // List mask owns compilation-time UNPACK input; source overwrite and changed
 // unpack state at replay cannot alter it.
 const list=call('glGenLists',[1]);call('glNewList',[list,0x1300]);call('glPolygonStipple',[input]);call('glEndList');new Uint8Array(memory.buffer,wa(input),128).fill(0);
 call('glPixelStorei',[0xcf1,1]);call('glPixelStorei',[0xcf3,3]);call('glCallList',[list]);got=get();assert.deepStrictEqual(got.slice(0,128),Array.from(mask),'list canonical owned capture');
 call('glBegin',[1]);call('glLineStipple',[2,0]);call('glPolygonStipple',[input]);call('glGetPolygonStipple',[output]);call('glEnd');assert.strictEqual(call('glGetError'),0x502,'invalid operation sticky');assert.strictEqual(call('glGetError'),0);
 const unchangedMask=get().slice(0,128),unchangedLine=[query(0xb26),query(0xb25)];
 for(const [name,args]of[['glLineStipple',[8,0]],['glPolygonStipple',[input]],['glGetPolygonStipple',[output]],['glEnable',[0xb24]],['glDisable',[0xb42]]]){
  const enabled=[call('glIsEnabled',[0xb24]),call('glIsEnabled',[0xb42])];new Uint8Array(memory.buffer,wa(output),128).fill(0xa5);
  call('glBegin',[1]);call(name,args);call('glEnd');assert.strictEqual(call('glGetError'),0x502,name+' Begin error');assert.strictEqual(call('glGetError'),0);
  if(name==='glGetPolygonStipple')assert(new Uint8Array(memory.buffer,wa(output),128).every(v=>v===0xa5),'rejected getter preserves output');
  assert.deepStrictEqual([query(0xb26),query(0xb25)],unchangedLine,'rejected line state');assert.deepStrictEqual(get().slice(0,128),unchangedMask,'rejected mask state');assert.deepStrictEqual([call('glIsEnabled',[0xb24]),call('glIsEnabled',[0xb42])],enabled,'rejected enable state');
 }
 for(const [p,v]of[[0xcf1,0],[0xcf3,0]])call('glPixelStorei',[p,v]);
 // Compile-only setters are deferred, queries execute immediately, including
 // inside a compile-only Begin/End; rejected setters never enter the list.
 const list2=call('glGenLists',[1]);call('glLineStipple',[1,3]);call('glNewList',[list2,0x1300]);call('glLineStipple',[2,5]);
 assert.strictEqual(query(0xb26),1);call('glGetPolygonStipple',[output]);call('glBegin',[1]);call('glLineStipple',[7,0]);
 call('glEnable',[0xb42]);call('glGetPolygonStipple',[output]);call('glEnd');call('glEndList');
 assert.strictEqual(call('glGetError'),0x502);assert.strictEqual(call('glGetError'),0);call('glCallList',[list2]);assert.strictEqual(query(0xb26),2);assert.strictEqual(query(0xb25),5);
 call('glNewList',[list2,0x1301]);call('glLineStipple',[4,0x10009]);assert.strictEqual(query(0xb26),4);call('glEndList');call('glLineStipple',[1,3]);call('glCallList',[list2]);assert.strictEqual(query(0xb26),4);assert.strictEqual(query(0xb25),9);
 // Polygon stipple rejects fragments before depth/stencil updates. A farther
 // blue quad fills the holes while the surviving nearer red pixels remain.
 clear();call('glEnable',[0xb42]);call('glEnable',[0xb71]);call('glDepthFunc',[0x201]);call('glColor4f',[1,0,0,1],true);
 draw(7,[[0,0],[64,0],[64,64],[0,64]]);call('glDisable',[0xb42]);call('glColor4f',[0,0,1,1],true);
 call('glBegin',[7]);for(const [x,y]of[[0,0],[64,0],[64,64],[0,64]])call('glVertex3f',[x,y,-.5],true);call('glEnd');
 assert.strictEqual(pixel(31,32),0xff0000,'surviving fragment writes nearer red');assert.strictEqual(pixel(30,32),0x0000ff,'discarded fragment leaves depth for blue');
 call('glDisable',[0xb71]);call('glColor4f',[1,1,1,1],true);
 // A zero polygon mask has no effect on points or lines.
 new Uint8Array(memory.buffer,wa(input),128).fill(0);call('glPolygonStipple',[input]);call('glEnable',[0xb42]);clear();draw(1,[[4,10],[12,10]]);
 assert.strictEqual(bits(xs,9),'11111111','polygon stipple ignores lines');draw(0,[[20,20]]);assert.strictEqual(pixel(20,19),0xffffff,'polygon stipple ignores points');
 if(encoder){assert(encoder.snapshot().glQueued>0,'actual shared software queue used');assert.strictEqual(encoder.snapshot().fallbacks,fallback?1:0,'only the requested production fallback occurred');}
 // Deleting a context must finish writes to its leased continuation cell.
 call('glEnable',[0xb24]);draw(3,[[4,10],[9,10],[14,10]]);
 if(queued&&!fallback)assert.strictEqual(e.stipple_pending(),1,'context still owns queued work');
 assert.strictEqual(call('wglDeleteContext',[context]),1);
 assert.strictEqual(e.stipple_pending(),0,'context phase cell released after consumer fence');
 console.log(JSON.stringify({pass:true,queued,fallback,literals:true}));
 }finally{encoder?.stop();if(manager)await manager.stop();}
})().catch(e=>{console.error(e);process.exitCode=1;});
