'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const root=process.env.WINE_ROOT||path.resolve(__dirname,'..'),req=p=>require(path.join(root,p));
const {bootRenderHarness}=req('test/render-helper'),{CALL_INDEX:O}=req('lib/gl-compat');
const Stream=req('lib/gl-command-stream');
const extraWat=`
 (func (export "shared_last_error") (result i32) (global.get $last_error))
 (func (export "shared_pending") (result i32) (global.get $d3dim_worker_pending))
 (func (export "shared_init")
   (global.set $thunk_guest_base (i32.add (global.get $image_base) (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
   (call $update_thunk_end))
 (func (export "shared_regs") (result i32) (global.get $reg_base))
 (func (export "shared_module") (param $name i32) (result i32)
   (call $handle_LoadLibraryA (local.get $name) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "shared_lookup") (param $module i32) (param $name i32) (result i32)
   (call $handle_GetProcAddress (local.get $module) (local.get $name) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "shared_invoke") (param $thunk i32) (result i32)
   (call $win32_dispatch (i32.div_u (i32.sub (local.get $thunk) (global.get $thunk_guest_base)) (i32.const 8))) (i32.load (global.get $reg_base)))(func (export "shared_dc") (result i32)
 (call $handle_GetDC (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
 (drop (call $gdi_dc_set_field (i32.load (global.get $reg_base)) (i32.const 92) (i32.const 42) (i32.const 0)))
 (i32.load (global.get $reg_base)))`;
async function run(){
 const candidate=process.argv.includes('--candidate');
 const shareId=req('src/api_table.json').findIndex(a=>a.name==='wglShareLists');
 function gate(file,source){
  if(candidate && file==='09b2-dispatch-table.generated.wat'){
   source=source.replace('(func $wgl_api_available (param $id i32) (result i32)',`(func $wgl_api_available (param $id i32) (result i32) (if (i32.eq (local.get $id) (i32.const ${shareId})) (then (return (i32.const 1))))`);
   source=source.replace('(func $gl_dynamic_api_unsupported (param $id i32) (result i32)',`(func $gl_dynamic_api_unsupported (param $id i32) (result i32) (if (i32.eq (local.get $id) (i32.const ${shareId})) (then (return (i32.const 0))))`);
  }
  return file==='13-exports.wat'?source+extraWat:source;
 }
 const queued=process.argv.includes('--worker');let owner=0;let encoder=null,manager=null,bridge=null,render=null,producer=null,memory,delay=false;
 const captures=[],cases=[],events=[],delayed=[],leases=[],mutations=[]; let prebuiltModule=null,moduleIdentity;
 const recordModule=bytes=>{const sha=require('crypto').createHash('sha256').update(bytes).digest('hex');moduleIdentity={sha256:sha,bytes:bytes.length};console.log('NATIVE_MODULE_SHA256',sha,'bytes',bytes.length);if(process.env.GL_SHARED_OBJECTS_MODULE_OUT)fs.writeFileSync(process.env.GL_SHARED_OBJECTS_MODULE_OUT,bytes);};
 if(process.env.GL_SHARED_OBJECTS_MUTATION){
  const mutation=JSON.parse(fs.readFileSync(process.env.GL_SHARED_OBJECTS_MUTATION));let applied=false;
  const bytes=req('test/compile-src').compileSrcWasm((file,source)=>{
   if(file===mutation.file){assert.strictEqual(source.split(mutation.from).length-1,1,'unique mutation');source=source.replace(mutation.from,mutation.to);applied=true;}
   return gate(file,source);
  });assert(applied);recordModule(bytes);prebuiltModule=new WebAssembly.Module(bytes);
 }
 if(!prebuiltModule){
  const bytes=req('test/compile-src').compileSrcWasm(gate);
  recordModule(bytes);
  prebuiltModule=new WebAssembly.Module(bytes);
 }
 const h=await bootRenderHarness({fonts:'none',...(prebuiltModule?{prebuiltModule}:{extraWat}),width:64,height:64,extraHostOverrides:{gpu_gl_call(op,at,bytes){
  if(op===Stream.WAT_STREAM_FLUSH_OPCODE){
   const batch=Stream.memoryBatch(memory,at,bytes);events.push({owner,batch:Array.from(new Uint8Array(memory.buffer,at,bytes))});
   Stream.replay(batch,(op,aux,c)=>{if(op===Stream.PACKED_DRAW_OPCODE){
    const vertices=Array.from(new Float32Array(c.buffer,c.pointerOffset,c.pointerLength/4));
    const record=new Uint8Array(32+c.pointerLength),v=new DataView(record.buffer);
    const start=c.stackOffset-32;record.set(new Uint8Array(c.buffer,start,32));
    v.setUint32(0,record.length,true);v.setUint32(24,32,true);
    record.set(new Uint8Array(c.buffer,c.pointerOffset,c.pointerLength),32);
    captures.push({vertices,record:Array.from(record)});
   }return 0;});
   if(!render)return bridge.replay(Stream.memoryBatch(memory,at,bytes),owner);
   const reply=render.execute({memoryOffset:at,bytes,owner,windows:Object.values(renderer.windows),softwareFront:e.gl_sw_front()});producer.configure(reply.producerConfig);return reply.value;
  }
  return encoder?encoder.call(op,at,bytes):0;
 }}});
 memory=h.memory;let e=h.exports;const mainExports=e,dv=new DataView(memory.buffer),wa=p=>e.guest_to_wasm(p)>>>0;
 e.init_thread(1,0x400000,0,0,0,0,0);e.heap_init(0x800000);
 const renderer={windows:{42:{hwnd:42,w:64,h:64,clientRect:{w:64,h:64}}},repaint(){}};
 const GL=req('lib/gl-compat');bridge=new GL.OpenGLHostBridge({backend:'software',getMemory:()=>memory.buffer,exports:()=>e,renderer});
 if(queued){const {Worker}=require('worker_threads'),{Manager}=req('lib/render-worker'),{Encoder}=req('lib/d3d-command-stream');
  producer=new (req('lib/gl-software-producer').Producer)(()=>e);
  const consumer=new WebAssembly.Instance(h.module,{host:h.host});consumer.exports.d3dim_worker_init(e.get_image_base()>>>0);
  const Base=GL.OpenGLHostBridge;GL.OpenGLHostBridge=class extends Base {constructor(o){super(o);bridge=this;}};
  try{render=req('lib/gl-render-worker').create({instance:consumer,memory,backend:'software',sendFrame(){}});}finally{GL.OpenGLHostBridge=Base;}
  manager=new Manager({module:h.module,memory,sigs:req('lib/host-import-sigs.generated.json').sigs,imageBase:e.get_image_base()>>>0,workerFactory:()=>new Worker(path.join(root,'lib/d3d-render-worker.js')),reclaimHeap:head=>e.d3d_render_adopt_free_list(head)});
  await manager.ready;const port=manager.createEndpoint({api:'legacy',backend:'software'});await port.ready;
  // Use the production encoder's supported capacity option and require
  // every queued record to render without falling back to the direct path.
  const transport={postMessage(msg){if(delay&&msg.t==='batch')delayed.push(msg);else port.postMessage(msg);},
   set onmessage(fn){port.onmessage=fn;},set onerror(fn){port.onerror=fn;},terminate(){return port.terminate();}};
  encoder=new Encoder({module:h.module,memory,sigs:req('lib/host-import-sigs.generated.json').sigs,getImageBase:()=>e.get_image_base()>>>0,guestToWasm:wa,workerFactory:()=>transport,capacity:0x400000,explicitFence:true,strictReady:true});assert(encoder.ready());
  encoder.releaseHeld=()=>{delay=false;for(const msg of delayed.splice(0))port.postMessage(msg);};
 }
 try {
 e.shared_init();const regs=e.shared_regs(),stackGuest=e.guest_alloc(256)>>>0,stack=wa(stackGuest),input=e.guest_alloc(1024)>>>0,output=e.guest_alloc(1024)>>>0;
 function str(s){const p=e.guest_alloc(s.length+1)>>>0;new Uint8Array(memory.buffer,wa(p),s.length+1).set(Buffer.from(s+'\0'));return p;}
 const module=e.shared_module(str('opengl32.dll'));assert(module);const resolved=new Map(),table=req('src/api_table.json');
 function call(name,args=[],float=false){
  const regs=e.shared_regs();
  if(!resolved.has(name)){dv.setUint32(regs+16,stackGuest,true);const p=e.shared_lookup(module,str(name))>>>0;assert(p,'real export '+name);assert.strictEqual(dv.getUint32(wa(p)+4,true),table.find(a=>a.name===name).id);resolved.set(name,p);}
  for(let i=0;i<8;i++)dv.setUint32(regs+i*4,0x55660000+i,true);
  dv.setUint32(regs+16,stackGuest,true);new Uint8Array(memory.buffer,stack,256).fill(0xa5);
  dv.setUint32(stack,0x12345678,true);args.forEach((v,i)=>(float===true||Array.isArray(float)&&float.includes(i))?dv.setFloat32(stack+4+i*4,v,true):dv.setUint32(stack+4+i*4,v>>>0,true));
  const before=Buffer.from(new Uint8Array(memory.buffer,stack,256)),value=e.shared_invoke(resolved.get(name))>>>0;
  assert.strictEqual(dv.getUint32(regs+16,true),stackGuest+4*(args.length+1),'stdcall '+name);
  for(let i=1;i<8;i++)if(i!==4)assert.strictEqual(dv.getUint32(regs+i*4,true),0x55660000+i,'register '+name);
  assert.deepStrictEqual(Buffer.from(new Uint8Array(memory.buffer,stack,256)),before,'stack canary '+name);return value;
 }
 const dc=e.shared_dc()>>>0;
 function make(){const c=call('wglCreateContext',[dc]);assert(c);return c;}
 const a=make(),b=make(),u=make();
 const current=c=>assert.strictEqual(call('wglMakeCurrent',[dc,c]),1);
 const error=()=>call('glGetError');
 const get=p=>{call('glGetIntegerv',[p,output]);return dv.getInt32(wa(output),true);};
 const ptr=wa(input),out=wa(output);
 const parameter=(target,p)=>{call('glGetTexParameteriv',[target,p,output]);return dv.getInt32(out,true);};
 const gen=()=>{call('glGenTextures',[1,output]);return dv.getUint32(out,true);};
 const list=(n,color)=>{call('glNewList',[n,0x1300]);call('glColor4f',color,true);call('glEndList');};
 // GLdouble occupies two physical stack words in the actual stdcall ABI.
 const regularCall=call;
 function doubles(name,args){
  const words=[];for(const v of args){const buf=new ArrayBuffer(8),d=new DataView(buf);d.setFloat64(0,v,true);words.push(d.getUint32(0,true),d.getUint32(4,true));}return regularCall(name,words);
 }
 function draw(name,rgb,beforeFinish){
  call('glClear',[0x4000]);call('glBegin',[7]);
  for(const [x,y,s,t] of [[8,8,0,0],[56,8,1,0],[56,56,1,1],[8,56,0,1]]){call('glTexCoord2f',[s,t],true);call('glVertex2f',[x,y],true);}call('glEnd');if(beforeFinish)beforeFinish();call('glFinish');if(encoder)encoder.fence();
  const entry=e.gl_sw_entry()>>>0,pitch=dv.getUint16(entry+18,true),height=dv.getUint16(entry+14,true),dib=dv.getUint32(entry+20,true);
  assert.strictEqual(dv.getUint32(dib+(height-1-32)*pitch+32*4,true)&0xffffff,rgb,name);
  events.push({owner,check:{name,pixel:[(rgb>>>16)&255,(rgb>>>8)&255,rgb&255,255]}});cases.push(name);
 }
 function image(target,name,rgba){
  call('glBindTexture',[target,name]);call('glTexParameteri',[target,0x2801,0x2600]);call('glTexParameteri',[target,0x2800,0x2600]);
  new Uint8Array(memory.buffer,ptr,4).set(rgba);
  if(target===0xde1)call('glTexImage2D',[target,0,0x1908,1,1,0,0x1908,0x1401,input]);
  else call('glTexImage1D',[target,0,0x1908,1,0,0x1908,0x1401,input]);
 }
 current(a);
 if(process.argv.includes('--old-control')){assert.strictEqual(call('wglShareLists',[a,b]),1,'unchanged old actual resolved wglShareLists');throw Error('Unexpected old acceptance');}
 // List indexes and texture names overlap in independently created contexts.
 const l=call('glGenLists',[1]);assert(l);list(l,[1,0,0,1]);const t=gen();assert(t);image(0xde1,t,[255,0,0,255]);
 call('glListBase',[17]);call('glEnable',[0xbe2]);
 current(u);assert.strictEqual(call('glIsList',[l]),0);assert.strictEqual(call('glIsTexture',[t]),0);
 assert.strictEqual(call('glGenLists',[1]),l);assert.strictEqual(gen(),t);
 list(l,[0,0,1,1]);image(0xde1,t,[0,0,255,255]);
 current(b);call('glListBase',[29]);call('glColor4f',[0,1,0,1],true);assert.strictEqual(get(0xb32),29);
 assert.strictEqual(call('wglShareLists',[a,b]),1);assert.strictEqual(get(0xb32),29);assert.strictEqual(call('glIsEnabled',[0xbe2]),0);
 assert.strictEqual(call('glIsList',[l]),1,'shared list visibility');assert.strictEqual(call('glIsTexture',[t]),1,'shared texture visibility');assert.strictEqual(get(0x8069),0,'binding remains local');
 assert.strictEqual(call('glGenLists',[1]),l+1,'shared list reservations');assert.strictEqual(gen(),t+1,'shared texture reservations');
 // Context b sees preexisting images, current color remains context-local.
 call('glViewport',[0,0,64,64]);call('glMatrixMode',[0x1701]);call('glLoadIdentity');doubles('glOrtho',[0,64,0,64,-1,1]);call('glMatrixMode',[0x1700]);call('glLoadIdentity');call('glClearColor',[0,0,0,1],true);
 call('glCallList',[l]);draw('shared list red',0xff0000);
 list(l,[0,1,0,1]);current(a);call('glDisable',[0xbe2]);call('glViewport',[0,0,64,64]);call('glMatrixMode',[0x1701]);call('glLoadIdentity');doubles('glOrtho',[0,64,0,64,-1,1]);call('glMatrixMode',[0x1700]);call('glLoadIdentity');call('glClearColor',[0,0,0,1],true);
 call('glCallList',[l]);draw('cross-context list redefinition green',0x00ff00);
 call('glEnable',[0xde1]);call('glTexEnvi',[0x2300,0x2200,0x1e01]);draw('shared texture red',0xff0000);
 current(b);call('glEnable',[0xde1]);call('glTexEnvi',[0x2300,0x2200,0x1e01]);call('glBindTexture',[0xde1,t]);
 new Uint8Array(memory.buffer,ptr,4).set([0,255,0,255]);call('glTexSubImage2D',[0xde1,0,0,0,1,1,0x1908,0x1401,input]);call('glTexParameteri',[0xde1,0x2802,0x2900]);
 current(a);assert.strictEqual(parameter(0xde1,0x2802),0x2900);draw('shared texture subimage green',0x00ff00);
 // Default object zero is independent even in a shared group.
 image(0xde1,0,[255,0,0,255]);current(b);image(0xde1,0,[0,0,255,255]);current(a);draw('default texture a red',0xff0000);current(b);draw('default texture b blue',0x0000ff);
 // Both dimensions use one shared named namespace, with immutable dimension.
 const one=gen();image(0xde0,one,[255,255,0,255]);current(a);call('glBindTexture',[0xde0,one]);call('glDisable',[0xde1]);call('glEnable',[0xde0]);draw('shared 1D yellow',0xffff00);
 call('glBindTexture',[0xde1,one]);assert.strictEqual(error(),0x502,'dimension collision');assert.strictEqual(get(0x8068),one);
 current(b);new Uint8Array(memory.buffer,ptr,4).set([0,255,255,255]);call('glBindTexture',[0xde0,one]);call('glTexSubImage1D',[0xde0,0,0,1,0x1908,0x1401,input]);
 current(a);draw('cross-context 1D cyan',0x00ffff);
 // Deleting a name leaves b's old binding alive. Reusing it creates a new object.
 call('glDisable',[0xde0]);call('glEnable',[0xde1]);call('glBindTexture',[0xde1,t]);current(b);call('glBindTexture',[0xde1,t]);current(a);
 dv.setUint32(ptr,t,true);call('glDeleteTextures',[1,input]);assert.strictEqual(call('glIsTexture',[t]),0);assert.strictEqual(get(0x8069),0);
 image(0xde1,t,[255,0,255,255]);current(b);assert.strictEqual(get(0x8069),t);draw('deleted shared texture old binding green',0x00ff00);
 current(b);call('glPushAttrib',[0x40000]);call('glBindTexture',[0xde1,t]);draw('saved deleted binding replaced magenta',0xff00ff);
 call('glPopAttrib');draw('attribute stack retains deleted generation green',0x00ff00);
 current(a);draw('reused texture name magenta',0xff00ff);current(b);call('glBindTexture',[0xde1,t]);draw('rebind reused name magenta',0xff00ff);
 call('glPushAttrib',[0x40000]);call('glTexParameteri',[0xde1,0x2802,0x2900]);current(a);assert.strictEqual(parameter(0xde1,0x2802),0x2900,'shared parameter write');
 current(b);call('glPopAttrib');current(a);assert.strictEqual(parameter(0xde1,0x2802),0x2901,'attribute restore publishes shared object parameters');current(b);
 call('glDeleteLists',[l,1]);current(a);assert.strictEqual(call('glIsList',[l]),0,'cross-context deletion');
 // Failed operations cannot change either group or a pending GL error.
 call('glNewList',[0,0x1300]);
 assert.strictEqual(call('wglShareLists',[a,0x7fffffff]),0,'invalid target');assert.strictEqual(e.shared_last_error(),6);assert.strictEqual(error(),0x501,'WGL failure preserves pending GL error');
 assert.strictEqual(call('wglShareLists',[0x7fffffff,b]),0,'invalid source');assert.strictEqual(e.shared_last_error(),6);
 assert.strictEqual(call('wglShareLists',[a,a]),1,'same group idempotent');
 assert.strictEqual(call('wglShareLists',[a,u]),0,'nonempty destination');assert.strictEqual(e.shared_last_error(),87);current(u);assert.strictEqual(call('glIsList',[l]),1);assert.strictEqual(call('glIsTexture',[t]),1);
 // EndList publishes into the shared namespace even if another context
 // deletes its reserved slot while the first context is compiling.
 current(a);const pending=call('glGenLists',[1]);call('glNewList',[pending,0x1300]);call('glColor4f',[0,1,0,1],true);
 current(b);call('glDeleteLists',[pending,1]);assert.strictEqual(call('glIsList',[pending]),0);
 current(a);call('glEndList');current(b);assert.strictEqual(call('glIsList',[pending]),1);
 // Group membership and objects survive deletion of the original source.
 current(b);assert.strictEqual(call('wglDeleteContext',[a]),1);draw('source destroyed shared texture survives',0xff00ff);assert.strictEqual(call('glIsTexture',[one]),1);assert.strictEqual(call('glIsList',[pending]),1);
 const c=make();assert.strictEqual(call('wglShareLists',[b,c]),1);current(c);assert.strictEqual(call('glIsTexture',[t]),1);assert.strictEqual(call('wglDeleteContext',[b]),1);assert.strictEqual(call('glIsTexture',[one]),1);assert.strictEqual(call('glIsList',[pending]),1);
 call('glBindTexture',[0xde1,t]);call('glEnable',[0xde1]);call('glTexEnvi',[0x2300,0x2200,0x1e01]);call('glViewport',[0,0,64,64]);call('glMatrixMode',[0x1701]);call('glLoadIdentity');doubles('glOrtho',[0,64,0,64,-1,1]);call('glMatrixMode',[0x1700]);call('glLoadIdentity');call('glClearColor',[0,0,0,1],true);draw('last sharing context retains image',0xff00ff);
 assert.strictEqual(call('wglDeleteContext',[c]),1);const fresh=make();current(fresh);assert.strictEqual(call('glIsTexture',[t]),0);assert.strictEqual(call('glIsList',[l]),0);assert.strictEqual(gen(),1,'fresh namespace after final destruction');
 assert.strictEqual(error(),0);call('wglDeleteContext',[fresh]);call('wglDeleteContext',[u]);
 // A second native instance has its own Wasm globals and thread state over
 // the same process memory. Sharing must work across that producer boundary.
 const p=make();current(p);const lp=call('glGenLists',[1]);list(lp,[1,0,0,1]);const tp=gen();image(0xde1,tp,[0,255,0,255]);
 assert.strictEqual(call('wglMakeCurrent',[0,0]),1);
 const other=new WebAssembly.Instance(h.module,{host:h.host}).exports;
 other.init_thread(2,0x400000,0,0,0,0,0);other.heap_init(0x1000000);other.shared_init();e=other;owner=2;
 const q=make(),isolated=make();current(isolated);assert.strictEqual(call('glIsTexture',[tp]),0);assert.strictEqual(call('glIsList',[lp]),0);
 current(q);assert.strictEqual(call('wglShareLists',[p,q]),1,'separate native producers share');assert.strictEqual(call('glIsList',[lp]),1);assert.strictEqual(call('glIsTexture',[tp]),1);
 call('glViewport',[0,0,64,64]);call('glMatrixMode',[0x1701]);call('glLoadIdentity');doubles('glOrtho',[0,64,0,64,-1,1]);call('glMatrixMode',[0x1700]);call('glLoadIdentity');call('glClearColor',[0,0,0,1],true);
 call('glCallList',[lp]);draw('separate native producer shared list red',0xff0000);
 call('glBindTexture',[0xde1,tp]);call('glEnable',[0xde1]);call('glTexEnvi',[0x2300,0x2200,0x1e01]);draw('separate native producer shared image green',0x00ff00);
 e=mainExports;owner=0;current(p);new Uint8Array(memory.buffer,ptr,4).set([0,255,255,255]);
 const mutationStart=events.length;
 call('glTexSubImage2D',[0xde1,0,0,0,1,1,0x1908,0x1401,input]);
 // Observe the completed prefix without another source call. Native shared
 // pixels alone cannot detect an upload left in this producer's private stream.
 for(const event of events.slice(mutationStart))if(event.batch){
  const bytes=Uint8Array.from(event.batch);
  Stream.replay(Stream.memoryBatch(bytes.buffer,0,bytes.length),(op,aux,c)=>{
   if(op===O._glTexSubImage2D)mutations.push({owner:event.owner,opcode:op,
    pixels:Array.from(new Float32Array(c.buffer,c.pointerOffset,c.pointerLength/4))});return 0;
  });
 }
 assert.deepStrictEqual(mutations,[{owner:0,opcode:O._glTexSubImage2D,pixels:[0,1,1,1]}],
  'completed cross-producer mutation publishes immutable cyan upload before consumer draw');
 e=other;owner=2;draw('separate native producer shared mutation cyan',0x00ffff);
 if(encoder){
  // Delay an actual render-Worker batch only after the original visibility
  // check. Later source calls and overwritten staging bytes cannot alter it.
  call('glClear',[0x4000]);delay=true;
  draw('delayed Worker retains shared cyan image',0x00ffff,()=>{
   encoder._submit();assert.strictEqual(delayed.length,1,'one actual held Worker batch');
   const item=encoder.buffers.find(item=>item.seq===delayed[0].seq);assert(item);
   const before=Buffer.from(item.bytes.subarray(0,item.used));
   new Uint8Array(memory.buffer,ptr,16).fill(0xa5);
   e=mainExports;owner=0;call('glColor4f',[1,0,1,1],true);call('glLineWidth',[3],true);
   assert.deepStrictEqual(Buffer.from(item.bytes.subarray(0,item.used)),before,'later source calls preserve full native Worker lease');
   leases.push({payload:Array.from(before),bytes:before.length,sha256:require('crypto').createHash('sha256').update(before).digest('hex'),immutable:true});
   e=other;owner=2;encoder.releaseHeld();
  });
 }
 assert.strictEqual(call('wglDeleteContext',[p]),0,'another thread current context cannot be destroyed');assert.strictEqual(e.shared_last_error(),170);assert.strictEqual(call('glIsTexture',[tp]),1);
 assert.strictEqual(call('wglMakeCurrent',[dc,p]),0,'cannot make another thread context current');assert.strictEqual(e.shared_last_error(),170);assert.strictEqual(call('wglGetCurrentContext'),0,'failed make-current releases caller');current(q);
 e=mainExports;owner=0;assert.strictEqual(call('wglMakeCurrent',[0,0]),1);e=other;owner=2;assert.strictEqual(call('wglDeleteContext',[p]),1);draw('producer source destroyed image cyan',0x00ffff);
 assert.strictEqual(call('glIsList',[lp]),1);assert.strictEqual(call('wglMakeCurrent',[0,0]),1);e=mainExports;owner=0;current(q);draw('migrated context keeps image and projection cyan',0x00ffff);call('wglDeleteContext',[q]);call('wglDeleteContext',[isolated]);assert.strictEqual(error(),0);e=mainExports;owner=0;
 if(encoder){assert(encoder.snapshot().glQueued>0,'production GL queue used');assert.strictEqual(encoder.snapshot().fallbacks,0,'no direct fallback');}
 const result={queued,cases,events,module:moduleIdentity,mutations,leases,worker:encoder?.snapshot()||null};
 if(process.env.GL_SHARED_OBJECTS_OUT)fs.writeFileSync(process.env.GL_SHARED_OBJECTS_OUT,JSON.stringify(result));
 console.log('PASS shared objects',JSON.stringify({queued,cases:cases.length}));
 return result;
 } finally {encoder?.releaseHeld();encoder?.stop();if(manager)await manager.stop();if(render)render.destroy();else if(bridge)bridge.destroy();}
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={run};
