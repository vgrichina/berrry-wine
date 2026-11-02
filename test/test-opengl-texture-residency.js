'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const root=process.env.WINE_ROOT||path.resolve(__dirname,'..'),req=p=>require(path.join(root,p));
const {bootRenderHarness}=req('test/render-helper'),{CALL_INDEX:O}=req('lib/gl-compat');
const Stream=req('lib/gl-command-stream');
const extraWat=`
 (func (export "residency_last_error") (result i32) (global.get $last_error))
 (func (export "residency_pending") (result i32) (global.get $d3dim_worker_pending))
 (func (export "residency_init")
   (global.set $thunk_guest_base (i32.add (global.get $image_base) (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
   (call $update_thunk_end))
 (func (export "residency_regs") (result i32) (global.get $reg_base))
 (func (export "residency_module") (param $name i32) (result i32)
   (call $handle_LoadLibraryA (local.get $name) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "residency_lookup") (param $module i32) (param $name i32) (result i32)
   (call $handle_GetProcAddress (local.get $module) (local.get $name) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "residency_invoke") (param $thunk i32) (result i32)
   (call $win32_dispatch (i32.div_u (i32.sub (local.get $thunk) (global.get $thunk_guest_base)) (i32.const 8))) (i32.load (global.get $reg_base)))(func (export "residency_dc") (result i32)
 (call $handle_GetDC (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
 (drop (call $gdi_dc_set_field (i32.load (global.get $reg_base)) (i32.const 92) (i32.const 42) (i32.const 0)))
 (i32.load (global.get $reg_base)))`;
async function run(){
 const baseline=process.env.GL_TEXTURE_RESIDENCY_BASELINE;
 function gate(file,source){
  if(baseline&&['09a8b-handlers-opengl.wat','09b2-dispatch-table.generated.wat'].includes(file))
   source=fs.readFileSync(path.join(baseline,file),'utf8');
  return file==='13-exports.wat'?source+extraWat:source;
 }
 const queued=process.argv.includes('--worker');let owner=0;let encoder=null,manager=null,bridge=null,render=null,producer=null,memory;
 const captures=[],cases=[],events=[]; let prebuiltModule=null;
 const recordModule=bytes=>{const sha=require('crypto').createHash('sha256').update(bytes).digest('hex');console.log('NATIVE_MODULE_SHA256',sha,'bytes',bytes.length);if(process.env.GL_TEXTURE_RESIDENCY_MODULE_OUT)fs.writeFileSync(process.env.GL_TEXTURE_RESIDENCY_MODULE_OUT,bytes);};
 if(process.env.GL_TEXTURE_RESIDENCY_MUTATION){
  const mutation=JSON.parse(fs.readFileSync(process.env.GL_TEXTURE_RESIDENCY_MUTATION));let applied=false;
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
  encoder=new Encoder({module:h.module,memory,sigs:req('lib/host-import-sigs.generated.json').sigs,getImageBase:()=>e.get_image_base()>>>0,guestToWasm:wa,workerFactory:()=>port,capacity:0x400000,explicitFence:true,strictReady:true});assert(encoder.ready());
 }
 try {
 e.residency_init();const regs=e.residency_regs(),stackGuest=e.guest_alloc(256)>>>0,stack=wa(stackGuest),input=e.guest_alloc(1024)>>>0,output=e.guest_alloc(1024)>>>0;
 function str(s){const p=e.guest_alloc(s.length+1)>>>0;new Uint8Array(memory.buffer,wa(p),s.length+1).set(Buffer.from(s+'\0'));return p;}
 const module=e.residency_module(str('opengl32.dll'));assert(module);const resolved=new Map(),table=req('src/api_table.json');
 function call(name,args=[],float=false){
  const regs=e.residency_regs();
  if(!resolved.has(name)){dv.setUint32(regs+16,stackGuest,true);const p=e.residency_lookup(module,str(name))>>>0;assert(p,'real export '+name);assert.strictEqual(dv.getUint32(wa(p)+4,true),table.find(a=>a.name===name).id);resolved.set(name,p);}
  for(let i=0;i<8;i++)dv.setUint32(regs+i*4,0x55660000+i,true);
  dv.setUint32(regs+16,stackGuest,true);new Uint8Array(memory.buffer,stack,256).fill(0xa5);
  dv.setUint32(stack,0x12345678,true);args.forEach((v,i)=>(float===true||Array.isArray(float)&&float.includes(i))?dv.setFloat32(stack+4+i*4,v,true):dv.setUint32(stack+4+i*4,v>>>0,true));
  const before=Buffer.from(new Uint8Array(memory.buffer,stack,256)),value=e.residency_invoke(resolved.get(name))>>>0;
  assert.strictEqual(dv.getUint32(regs+16,true),stackGuest+4*(args.length+1),'stdcall '+name);
  for(let i=1;i<8;i++)if(i!==4)assert.strictEqual(dv.getUint32(regs+i*4,true),0x55660000+i,'register '+name);
  assert.deepStrictEqual(Buffer.from(new Uint8Array(memory.buffer,stack,256)),before,'stack canary '+name);return value;
 }
 const dc=e.residency_dc()>>>0;
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
 function draw(name,rgb){
  call('glClear',[0x4000]);call('glBegin',[7]);
  for(const [x,y,s,t] of [[8,8,0,0],[56,8,1,0],[56,56,1,1],[8,56,0,1]]){call('glTexCoord2f',[s,t],true);call('glVertex2f',[x,y],true);}call('glEnd');call('glFinish');if(encoder)encoder.fence();
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

 const observations=[];
 function query(names,want,expectedError,label,{count=names.length,pointer=input+1,via='static'}={}){
  names.forEach((n,i)=>dv.setUint32(wa(pointer+i*4),n,true));
  new Uint8Array(memory.buffer,out,64).fill(0xa7);
  const saved=resolved.get('glAreTexturesResident');
  if(via==='wgl'){
   const thunk=call('wglGetProcAddress',[str('glAreTexturesResident')]);assert(thunk,'WGL residency export');
   assert.strictEqual(dv.getUint32(wa(thunk)+4,true),table.find(a=>a.name==='glAreTexturesResident').id);
   resolved.set('glAreTexturesResident',thunk);
  }
  const value=call('glAreTexturesResident',[count,pointer,output+9]);
  if(saved)resolved.set('glAreTexturesResident',saved);
  assert.strictEqual(value,want,'residency return '+label);
  // Success requires NO GLboolean writes. On error our deterministic choice
  // is also no writes (the specification calls invalid-name output undefined).
  assert(new Uint8Array(memory.buffer,out,64).every(v=>v===0xa7),'residences untouched byte canaries '+label);
  assert.strictEqual(error(),expectedError,'residency error '+label);
  observations.push({label,n:count,names,value,error:expectedError,outputHex:Buffer.from(new Uint8Array(memory.buffer,out,64)).toString('hex')});
 }
 function resident(target,label){
  for(const name of ['glGetTexParameteriv','glGetTexParameterfv']){
   new Uint8Array(memory.buffer,out,32).fill(0xc9);call(name,[target,0x8067,output+9]);
   assert.strictEqual(name.endsWith('iv')?dv.getInt32(wa(output+9),true):dv.getFloat32(wa(output+9),true),1,'bound resident '+label);
   assert(new Uint8Array(memory.buffer,out,9).every(v=>v===0xc9));assert(new Uint8Array(memory.buffer,out+13,19).every(v=>v===0xc9),'resident scalar exact4');
  }
 }
 function setup(c){current(c);call('glViewport',[0,0,64,64]);call('glMatrixMode',[0x1701]);call('glLoadIdentity');doubles('glOrtho',[0,64,0,64,-1,1]);call('glMatrixMode',[0x1700]);call('glLoadIdentity');call('glClearColor',[0,0,0,1],true);call('glTexEnvi',[0x2300,0x2200,0x1e01]);call('glEnable',[0xde1]);}
 setup(a);
 query([],1,0,'empty ignores both pointers',{pointer:0xfffffff0});
 query([],0,0x501,'negative ignores both pointers',{count:-1,pointer:0xfffffff0});
 assert.strictEqual(call('glAreTexturesResident',[0,0xfffffff0,0xfffffff0]),1,'zero dereferences neither pointer');assert.strictEqual(error(),0);
 assert.strictEqual(call('glAreTexturesResident',[-1,0xfffffff0,0xfffffff0]),0,'negative dereferences neither pointer');assert.strictEqual(error(),0x501);
 for(const via of ['static','wgl']){
  query([0],0,0x501,'default name '+via,{via});
  query([0x7ffffffd],0,0x501,'unused name '+via,{via});
 }
 const t=gen(),one=gen(),incomplete=gen();
 assert(t&&one&&incomplete);
 query([t],0,0x501,'generated reservation is not object');
 call('glBindTexture',[0xde1,incomplete]);query([incomplete],1,0,'incomplete object is resident');
 image(0xde1,t,[255,0,0,255]);image(0xde0,one,[0,255,0,255]);call('glBindTexture',[0xde1,t]);
 resident(0xde1,'uploaded 2D');resident(0xde0,'uploaded 1D');
 call('glTexParameterf',[0xde1,0x8066,0]);query([t],1,0,'zero priority does not evict');
 dv.setUint32(ptr,t,true);assert.strictEqual(call('glAreTexturesResident',[1,input,0xfffffff0]),1,'all resident does not access output pointer');assert.strictEqual(error(),0);
 for(const via of ['static','wgl'])query([t,one,incomplete,t],1,0,'all resident '+via,{via});
 query([t,0,one],0,0x501,'mixed valid and default');query([t,0x7ffffffd,one],0,0x501,'mixed valid and unused');
 // No hidden eviction after a query; image bytes remain available and draw.
 call('glGetTexImage',[0xde1,0,0x1908,0x1401,output]);assert.deepStrictEqual(Array.from(new Uint8Array(memory.buffer,out,4)),[255,0,0,255],'retained literal image');
 draw('resident 2D image red',0xff0000);
 call('glActiveTextureARB',[0x84c1]);call('glBindTexture',[0xde1,t]);resident(0xde1,'unit1');query([t,one],1,0,'residency independent of unit');call('glActiveTextureARB',[0x84c0]);
 call('glBindTexture',[0xde1,0]);resident(0xde1,'default object');query([0],0,0x501,'default object only via GetTexParameter');query([t],1,0,'unbound named object');call('glBindTexture',[0xde1,t]);
 // Executed Begin rejects before touching either client array, including n0.
 call('glBegin',[4]);new Uint8Array(memory.buffer,out,64).fill(0xa7);
 for(const n of [0,1,-1])assert.strictEqual(call('glAreTexturesResident',[n,0xfffffff0,0xfffffff0]),0,'begin returns false');
 call('glEnd');assert.strictEqual(error(),0x502,'begin error');assert(new Uint8Array(memory.buffer,out,64).every(v=>v===0xa7));
 // The first error survives a later query error; errors are context-local.
 call('glTexParameteri',[0xdead,0x2801,0x2600]);dv.setUint32(ptr,0,true);assert.strictEqual(call('glAreTexturesResident',[1,input,output]),0);assert.strictEqual(error(),0x500,'sticky first error');
 dv.setUint32(ptr,0,true);call('glAreTexturesResident',[1,input,output]);current(u);assert.strictEqual(error(),0,'isolated errors');current(a);assert.strictEqual(error(),0x501,'original context error retained');
 // Immediate queries during COMPILE (including its shadow Begin) are never
 // replayed. Deleting the queried name after EndList detects accidental capture.
 const transient=gen();call('glBindTexture',[0xde1,transient]);const listName=call('glGenLists',[1]);call('glNewList',[listName,0x1300]);
 query([transient],1,0,'compile immediate');call('glBegin',[4]);query([transient],1,0,'compile shadow Begin immediate');call('glEnd');call('glEndList');
 dv.setUint32(ptr,transient,true);call('glDeleteTextures',[1,input]);call('glCallList',[listName]);assert.strictEqual(error(),0,'query not recorded');query([transient],0,0x501,'deleted compile-time object');
 call('glBindTexture',[0xde1,t]);
 // Context u has its own same numeric name and backing; b joins a's group.
 setup(u);query([t],0,0x501,'unshared name invisible');image(0xde1,t,[0,0,255,255]);query([t],1,0,'isolated same name resident');draw('isolated name blue',0x0000ff);
 setup(b);assert.strictEqual(call('wglShareLists',[a,b]),1,'share residency namespace');query([t,one,incomplete],1,0,'shared objects');call('glBindTexture',[0xde1,t]);draw('shared resident red',0xff0000);
 current(a);dv.setUint32(ptr,t,true);call('glDeleteTextures',[1,input]);query([t],0,0x501,'deleted name');
 current(b);query([t],0,0x501,'shared deletion removes name');resident(0xde1,'retained deleted binding');draw('deleted generation remains backed red',0xff0000);
 current(u);query([t],1,0,'isolated name survives foreign deletion');draw('isolated still blue',0x0000ff);
 current(a);image(0xde1,t,[0,255,0,255]);query([t],1,0,'reused name new object');draw('rebound generation green',0x00ff00);
 current(b);query([t],1,0,'reused name visible through sharing');resident(0xde1,'old binding after reuse');draw('old generation still red',0xff0000);
 call('glBindTexture',[0xde1,t]);draw('new generation green',0x00ff00);
 assert.strictEqual(error(),0);
 if(encoder){encoder.fence();assert(encoder.snapshot().glQueued>0,'production GL queue used');assert.strictEqual(encoder.snapshot().fallbacks,0,'zero queue fallbacks');}
 const result={passed:true,queued,cases,events,observations,policy:'No separate working set; live named objects retain backing until deletion.'};
 if(process.env.GL_TEXTURE_RESIDENCY_OUT)fs.writeFileSync(process.env.GL_TEXTURE_RESIDENCY_OUT,JSON.stringify(result));
 console.log('PASS texture residency',JSON.stringify({queued,cases:cases.length,queries:observations.length}));return result;
 } finally {encoder?.stop();if(manager)await manager.stop();if(render)render.destroy();else if(bridge)bridge.destroy();}
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={run};
