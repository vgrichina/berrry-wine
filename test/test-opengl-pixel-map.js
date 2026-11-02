'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),req=p=>require(path.join(root,p));
const {bootRenderHarness}=req('test/render-helper');
if(process.env.GL_PIXEL_MAP_JS_MUTATION){
 const key=process.env.GL_PIXEL_MAP_JS_MUTATION,filename=path.join(root,'lib/gl-compat.js');
 const alternatives={
  component:['      return value;\n    }\n    _mapIndex(value)', '      return 0;\n    }\n    _mapIndex(value)'],
  index:['return this.pixelMaps.slice(2,6).map(map=>map[index&(map.length-1)]);','return [0,0,0,0];'],
  capture:['const owned=!get&&capture&&capture.pointerGuest===pointer&&!capture.pointerBorrowed&&capture.pointerOffset;','const owned=!this._pixelMapIgnoreCapture&&!get&&capture&&capture.pointerGuest===pointer&&!capture.pointerBorrowed&&capture.pointerOffset;'],
 };
 assert(alternatives[key],'known JS control');let source=fs.readFileSync(filename,'utf8');
 const [from,to]=alternatives[key];assert(source.includes(from),'JS source control anchor');source=source.replace(from,to);
 const Module=require('module'),replacement=new Module(filename,module);replacement.filename=filename;
 replacement.paths=Module._nodeModulePaths(path.dirname(filename));replacement._compile(source,filename);require.cache[filename]=replacement;
 console.error('JS_SOURCE_CONTROL_LOADED '+key);
}
const {OpenGLHostBridge,CALL_INDEX:GL}=req('lib/gl-compat');
const Stream=req('lib/gl-command-stream');
const table=req('src/api_table.json');
const extraWat=`
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
 (func (export "probe_sparse_page") (param $p i32) (result i32)
   (call $virtual_map_commit (local.get $p) (i32.const 4096)))
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
let prebuiltModule;
const mutation=process.env.GL_PIXEL_MAP_MUTATION,old=process.env.GL_PIXEL_MAP_OLD;
if(mutation||old){let changed=0;
 const edits={
  default:['09a8b-handlers-opengl.wat','gl_pixel_maps','(i32.const 1))\n        (local.set $i','(i32.const 2))\n        (local.set $i'],
  normalize:['09a8b-handlers-opengl.wat','gl_pixel_map_set','(f64.const 4294967295)','(f64.const 65535)'],
  shortWidth:['09a8b-handlers-opengl.wat','gl_pixel_map_get','(call $gs8 (i32.add (local.get $out) (i32.const 1))','(call $gs32 (i32.add (local.get $out) (i32.const 1))'],
  mapOrder:['09a8b-handlers-opengl.wat','gl_transfer_channel','(f64.nearest (f64.mul','(f64.floor (f64.mul'],
  mapConsumer:['09a8b-handlers-opengl.wat','gl_transfer_channel','(return (f32.demote_f64 (call $gl_pixel_map_value (local.get $map) (local.get $index))))','(return (f32.const 0))'],
  indexConsumer:['09a8b-handlers-opengl.wat','gl_pixel_index_rgba','(local.set $index (call $gl_pixel_index_transfer (local.get $value)))','(local.set $index (i32.const 0))'],
  stencilRound:['09a8b-handlers-opengl.wat','gl_pixel_map_set','(f64.nearest (local.get $v))','(f64.trunc (local.get $v))'],
  power:['09a8b-handlers-opengl.wat','gl_pixel_map_validate','(i32.lt_u (local.get $map) (i32.const 6))','(i32.const 0)'],
  outputAtomic:['09a8b-handlers-opengl.wat','gl_pixel_map_get','    (call $gl_1d_span (local.get $out)','    (call $gs8 (local.get $out) (i32.const 0))\n    (call $gl_1d_span (local.get $out)'],
  listCapture:['09a8ca-gl-lists.wat','gl_list_intercept','(local.get $length))\n          (i32.store','(i32.const 0))\n          (i32.store'],
 };
 const bytes=req('test/compile-src').compileSrcWasm((file,source)=>{
  if(file==='13-exports.wat')return source+extraWat;
  if(old){const p=path.join(old,file);if(fs.existsSync(p)){changed++;return fs.readFileSync(p,'utf8');}return source;}
  assert(edits[mutation],'known mutation');const[f,fn,from,to]=edits[mutation];if(file!==f)return source;
  const a=source.indexOf('(func $'+fn+' '),end=source.indexOf('\n  (func ',a+8),b=end<0?source.length:end;
  assert(a>=0);const body=source.slice(a,b);assert(body.includes(from),'mutation anchor '+mutation);changed++;
  return source.slice(0,a)+body.replace(from,to)+source.slice(b);
 });assert(changed);prebuiltModule=new WebAssembly.Module(bytes);console.error('SOURCE_CONTROL_COMPILED',mutation||'old-source');
}

// Resolve and execute the real stdcall ABI, including output byte canaries.
(async()=>{
 let memory,bridge,encoder=null,manager=null,render=null,producer=null;
 const queued=process.argv.includes('--worker');
 const h=await bootRenderHarness({...(prebuiltModule ? {prebuiltModule} : {extraWat}),fonts:'none',width:8,height:8,
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
   const moduleGL=req('lib/gl-compat'),BaseBridge=moduleGL.OpenGLHostBridge;
   moduleGL.OpenGLHostBridge=class extends BaseBridge {constructor(options){super(options);bridge=this;}};
   try {render=req('lib/gl-render-worker').create({instance:consumer,memory,backend:'software',sendFrame(){}});}
   finally {moduleGL.OpenGLHostBridge=BaseBridge;}
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
 const dc=e.probe_dc(42)>>>0,context=call('wglCreateContext',[dc]);assert(context);
 assert.strictEqual(call('wglMakeCurrent',[dc,context]),1);
 const names=['glPixelMapfv','glPixelMapuiv','glPixelMapusv','glGetPixelMapfv','glGetPixelMapuiv','glGetPixelMapusv'];
 if(process.env.GL_PIXEL_MAP_GETTERS_FIRST)names.sort((a,b)=>Number(b.startsWith('glGet'))-Number(a.startsWith('glGet')));
 for(const name of names){assert(resolve(name),'genuine native resolver '+name);assert(call('wglGetProcAddress',[str(name)]),'dynamic resolver '+name);}
 const input=e.guest_alloc(2048)>>>0,output=e.guest_alloc(2048)>>>0,at=output+19;
 let checks=0;const observations=[];
 const literal=(label,got,want)=>{assert.deepStrictEqual(got,want,label);checks++;observations.push({label,got});};
 const error=(want,label)=>literal(label,call('glGetError'),want);
 function write(p,values,kind='fv'){
  values.forEach((v,i)=>{const width=kind==='usv'?2:4,d=new DataView(new ArrayBuffer(width));d[kind==='fv'?'setFloat32':kind==='usv'?'setUint16':'setUint32'](0,v,true);for(let b=0;b<width;b++)dv.setUint8(wa(p+i*width+b),d.getUint8(b));});
 }
 function set(map,values,kind='fv',p=input){write(p,values,kind);call('glPixelMap'+kind,[map,values.length,p]);error(0,'set '+kind+' '+map.toString(16));}
 function get(map,want,kind='fv',label='map literal'){
  new Uint8Array(memory.buffer,wa(output),2048).fill(0xa7);call('glGetPixelMap'+kind,[map,at]);
  const width=kind==='usv'?2:4,got=want.map((_,i)=>{const d=new DataView(new ArrayBuffer(width));for(let b=0;b<width;b++)d.setUint8(b,dv.getUint8(wa(at+i*width+b)));return d[kind==='fv'?'getFloat32':kind==='usv'?'getUint16':'getUint32'](0,true);});
  literal(label+' '+kind+' '+map.toString(16),got,want);
  literal('leading output canary',Array.from(new Uint8Array(memory.buffer,wa(output),19)),Array(19).fill(0xa7));
  assert(new Uint8Array(memory.buffer,wa(at)+want.length*width,2048-19-want.length*width).every(b=>b===0xa7),'exact map width '+kind);checks++;
  error(0,'get error');
 }
 function size(map,want){for(const name of ['glGetIntegerv','glGetFloatv','glGetDoublev','glGetBooleanv']){
  call(name,[map-0xc70+0xcb0,at]);const got=name==='glGetDoublev'?dv.getFloat64(wa(at),true):name==='glGetFloatv'?dv.getFloat32(wa(at),true):name==='glGetBooleanv'?dv.getUint8(wa(at)):dv.getInt32(wa(at),true);literal('size '+name,got,name==='glGetBooleanv'?1:want);
 }}
 call('glGetIntegerv',[0xd34,at]);literal('max table size',dv.getInt32(wa(at),true),256);
 for(let map=0xc70;map<=0xc79;map++){size(map,1);for(const k of ['fv','uiv','usv'])get(map,[0],k,'initial zero');}
 // Default transfer is identity even though all initial table entries are zero.
 call('glGetIntegerv',[0xd10,at]);literal('default map disabled',dv.getInt32(wa(at),true),0);
 new Uint8Array(memory.buffer,wa(input),4).set([17,83,149,211]);
 call('glBindTexture',[0xde0,899]);call('glTexImage1D',[0xde0,0,0x1908,1,0,0x1908,0x1401,input]);
 call('glGetTexImage',[0xde0,0,0x1908,0x1401,at]);literal('default transfer identity',Array.from(new Uint8Array(memory.buffer,wa(at),4)),[17,83,149,211]);error(0,'identity upload');
 // Pixel store byte order and skips do not modify table buffers.
 call('glPixelStorei',[0xcf0,1]);call('glPixelStorei',[0xcf4,7]);call('glPixelStorei',[0xd00,1]);call('glPixelStorei',[0xd04,7]);
 set(0xc76,[.125,.875]);get(0xc76,[.125,.875]);
 call('glPixelStorei',[0xcf0,0]);call('glPixelStorei',[0xcf4,0]);call('glPixelStorei',[0xd00,0]);call('glPixelStorei',[0xd04,0]);
 // Every map and every setter conversion; unsigned index inputs are numeric.
 for(let map=0xc70;map<=0xc79;map++){
  if(map===0xc70){set(map,[-2.25,.25,1.75,16777218]);get(map,[-2.25,.25,1.75,16777218]);}
  else if(map===0xc71){set(map,[-2.25,.25,1.75,16777218]);get(map,[-2,0,2,16777218]);}
  else {set(map,[-2,.25,.75,2]);get(map,[0,.25,.75,1]);get(map,[0,16384,49151,65535],'usv');get(map,[0,1073741824,3221225471,4294967295],'uiv');}
  set(map,[0,1,65534,65535],'usv');get(map,map<0xc72?[0,1,65534,65535]:[0,Math.fround(1/65535),Math.fround(65534/65535),1]);
  set(map,[0,16777217,2147483648,4294967295],'uiv');get(map,map<0xc72?[0,16777216,2147483648,4294967296]:[0,Math.fround(16777217/4294967295),.5,1]);size(map,4);
 }
 // Accept the complete implementation maximum, retaining the last literal value.
 const maximum=Array(256).fill(.25);maximum[255]=.875;set(0xc76,maximum);get(0xc76,maximum);size(0xc76,256);
 // Defined unsigned query endpoints also apply to index-valued maps.
 for(const map of [0xc70,0xc71]){set(map,[0,1]);get(map,[0,65535],'usv');get(map,[0,4294967295],'uiv');}
 for(let map=0xc70;map<=0xc79;map++){
  for(const n of [0,-1,257,0x7fffffff]){call('glPixelMapfv',[map,n,0xffffffff]);error(0x501,'invalid size before input');}
  if(map<0xc76){call('glPixelMapfv',[map,3,input]);call('glGetIntegerv',[map-0xc70+0xcb0,at]);literal('power-of-two state atomicity',dv.getInt32(wa(at),true),map<0xc72?2:4);error(0x501,'indexed power-of-two rule');call('glPixelMapfv',[map,3,0xffffffff]);error(0x501,'power before input');}
  else {set(map,[.125,.5,.875]);get(map,[.125,.5,.875]);size(map,3);}
 }
 for(const bad of [0,0xc6f,0xc7a,0xffffffff])for(const name of names){
  new Uint8Array(memory.buffer,wa(output),2048).fill(0xa7);
  call(name,name.startsWith('glGet')?[bad,at]:[bad,4,0xffffffff]);error(0x500,'invalid map '+name);
  assert(new Uint8Array(memory.buffer,wa(output),2048).every(b=>b===0xa7),'invalid enum output atomic');checks++;
 }
 set(0xc76,[.25,.75]);
 for(const name of names){
  new Uint8Array(memory.buffer,wa(output),2048).fill(0xa7);
  call('glBegin',[0]);call(name,name.startsWith('glGet')?[0xc76,at]:[0xc76,2,0xffffffff]);call('glEnd');
  error(0x502,'BeginEnd map error '+name);
  assert(new Uint8Array(memory.buffer,wa(output),2048).every(b=>b===0xa7),'Begin output unchanged '+name);checks++;
 }get(0xc76,[.25,.75]);
 // Sparse element/page boundary handling, complete span validation, no partial writes.
 const sparse=0x6e000000;assert(e.probe_sparse_page(sparse));assert(e.probe_sparse_page(sparse+0x1000));
 for(const kind of ['fv','uiv','usv']){
  const values=kind==='fv'?[.125,.875]:kind==='uiv'?[0,4294967295]:[0,65535];set(0xc76,values,kind,sparse+4095);get(0xc76,kind==='fv'?[.125,.875]:[0,1]);
 }
 const hole=0x6e010000;assert(e.probe_sparse_page(hole));
 for(const kind of ['fv','uiv','usv']){
  set(0xc76,[.125,.875]);dv.setUint8(wa(hole+4095),0x6a);
  assert.throws(()=>call('glPixelMap'+kind,[0xc76,2,hole+4095]),WebAssembly.RuntimeError,'input unmapped suffix');
  get(0xc76,[.125,.875],'fv','input fault leaves map');size(0xc76,2);
  dv.setUint8(wa(hole+4095),0x6a);assert.throws(()=>call('glGetPixelMap'+kind,[0xc76,hole+4095]),WebAssembly.RuntimeError);
  literal('output fault atomic',dv.getUint8(wa(hole+4095)),0x6a);
 }
 // A rejected size must preserve the preceding table as well as its length.
 call('glPixelMapfv',[0xc76,0,0xffffffff]);error(0x501,'zero size atomic');get(0xc76,[.125,.875]);size(0xc76,2);
 // Restore flags/scales, but never the tables or sizes (GL1.1 table6.16).
 set(0xc76,[.125,.875]);call('glPixelTransferi',[0xd10,1]);call('glPushAttrib',[0x20]);
 set(0xc76,[.25,.5,.75]);call('glPixelTransferi',[0xd10,0]);call('glPixelTransferf',[0xd14,f(.5)]);call('glPopAttrib');
 get(0xc76,[.25,.5,.75],'fv','map excluded from pixel attributes');size(0xc76,3);call('glGetIntegerv',[0xd10,at]);literal('map enable restored',dv.getInt32(wa(at),true),1);
 call('glGetFloatv',[0xd14,at]);literal('scale restored',dv.getFloat32(wa(at),true),1);
 call('glPushAttrib',[0xfffff]);set(0xc76,[.375,.625]);call('glPopAttrib');get(0xc76,[.375,.625],'fv','map excluded from all attributes');
 call('glPushClientAttrib',[0xffffffff]);set(0xc76,[.125,.875]);call('glPopClientAttrib');get(0xc76,[.125,.875],'fv','map excluded from client attributes');
 const second=call('wglCreateContext',[dc]);assert(second);call('wglMakeCurrent',[dc,second]);for(let map=0xc70;map<=0xc79;map++){get(map,[0]);size(map,1);}set(0xc76,[.25,.75]);
 call('wglMakeCurrent',[dc,context]);get(0xc76,[.125,.875],'fv','context isolation');call('wglDeleteContext',[second]);
 // Client bytes copied into list; server map state changes only at execution.
 for(const kind of ['fv','uiv','usv']){
  set(0xc76,[.125,.875]);const values=kind==='fv'?[.25,.75]:kind==='uiv'?[0,4294967295]:[0,65535];write(input,values,kind);
  call('glNewList',[701,0x1300]);call('glPixelMap'+kind,[0xc76,2,input]);get(0xc76,[.125,.875],'fv','compile query immediate');call('glEndList');write(input,[0,0],kind);
  call('glCallList',[701]);get(0xc76,kind==='fv'?[.25,.75]:[0,1],'fv','list owns source');
 }
 set(0xc76,[.125,.875]);write(input,[.25,.75]);call('glNewList',[702,0x1301]);call('glPixelMapfv',[0xc76,2,input]);get(0xc76,[.25,.75],'fv','compile execute setter');call('glEndList');
 write(input,[.875,.125]);call('glNewList',[703,0x1300]);call('glBegin',[0]);for(const kind of ['fv','uiv','usv'])get(0xc76,kind==='fv'?[.25,.75]:kind==='uiv'?[1073741824,3221225471]:[16384,49151],kind,'compile Begin query immediate');call('glPixelMapfv',[0xc76,2,0xffffffff]);call('glEnd');call('glEndList');error(0x502,'compile Begin rejects map');call('glCallList',[703]);get(0xc76,[.25,.75],'fv','rejected map absent from list');
 // Nonidentity actual consumers, literal independently computed pixels.
 const T1=0xde0,T2=0xde1,RGBA=0x1908,U8=0x1401;
 const bytes=(p,a)=>a.forEach((v,i)=>dv.setUint8(wa(p+i),v));
 function image(target,want,label){
  new Uint8Array(memory.buffer,wa(output),2048).fill(0xa7);call('glGetTexImage',[target,0,RGBA,U8,at]);
  literal(label,Array.from(new Uint8Array(memory.buffer,wa(at),want.length)),want);error(0,label+' error');
  call('glFinish');const frontend=bridge.contexts.get(context).frontend;
  const tex=frontend._textureState(target===T1?frontend._texture1D():frontend._boundTexture()).levels.get(0);
  literal(label+' command consumer',Array.from(tex.pixels),want);
 }
 call('glPixelStorei',[0xd05,1]);call('glPixelStorei',[0xcf5,1]);
 for(const kind of ['fv','uiv','usv']){
  for(let c=0;c<4;c++)set(0xc76+c,kind==='fv'?[1,.25]:kind==='uiv'?[4294967295,1073741824]:[65535,16384],kind);
  call('glBindTexture',[T1,900]);bytes(input,[0,255,0,255]);
  call('glTexImage1D',[T1,0,RGBA,1,0,RGBA,U8,input]);image(T1,[255,64,255,64],'typed map component consumer '+kind);
 }
 for(let c=0;c<4;c++)set(0xc76+c,c===0?[1,.5,0]:c===1?[0,.25,.75,1]:c===2?[.75,.25]:[.5,1]);
 call('glBindTexture',[T1,901]);bytes(input,[0,64,64,0,160,192,192,255]);call('glTexImage1D',[T1,0,RGBA,2,0,RGBA,U8,input]);image(T1,[255,64,191,128,128,191,64,255],'RGBA map upload1D');
 call('glBindTexture',[T2,902]);bytes(input,[0,64,64,0,160,192,192,255]);call('glTexImage2D',[T2,0,RGBA,2,1,0,RGBA,U8,input]);image(T2,[255,64,191,128,128,191,64,255],'RGBA map upload2D');
 bytes(input,[255,0,255,255]);call('glTexSubImage1D',[T1,0,1,1,RGBA,U8,input]);image(T1,[255,64,191,128,0,0,64,255],'RGBA map sub1D');
 call('glTexSubImage2D',[T2,0,1,0,1,1,RGBA,U8,input]);image(T2,[255,64,191,128,0,0,64,255],'RGBA map sub2D');
 call('glPixelTransferf',[0xd14,f(2)]);call('glPixelTransferf',[0xd15,f(-.25)]);write(input,[.35,0,0,1]);call('glTexImage1D',[T1,0,RGBA,1,0,RGBA,0x1406,input]);image(T1,[128,0,191,255],'scale bias before map nearest');
 call('glPixelTransferf',[0xd14,f(1)]);call('glPixelTransferf',[0xd15,f(0)]);
 // Pixel transfer does not remap the rasterization of ordinary clear/draws.
 call('glClearColor',[f(.625),f(.75),f(.25),f(1)]);call('glClear',[0x4000]);call('glReadBuffer',[0x405]);
 call('glReadPixels',[0,0,1,1,RGBA,U8,at]);literal('mapped framebuffer read',Array.from(new Uint8Array(memory.buffer,wa(at),4)),[128,191,191,255]);error(0,'mapped read error');
 call('glCopyTexImage1D',[T1,0,RGBA,0,0,1,0]);image(T1,[128,191,191,255],'mapped copy1D');
 call('glCopyTexImage2D',[T2,0,RGBA,0,0,1,1,0]);image(T2,[128,191,191,255],'mapped copy2D');
 call('glClearColor',[f(1),f(0),f(1),f(0)]);call('glClear',[0x4000]);call('glCopyTexSubImage1D',[T1,0,0,0,0,1]);image(T1,[0,0,64,128],'mapped copySub1D');
 call('glCopyTexSubImage2D',[T2,0,0,0,0,0,1,1]);image(T2,[0,0,64,128],'mapped copySub2D');
 // Indexed upload ignores MAP_COLOR and RGBA scales; four independently sized maps.
 for(const kind of ['fv','uiv','usv']){
  const maximum=kind==='fv'?1:kind==='uiv'?4294967295:65535;
  for(let c=0;c<4;c++)set(0xc72+c,c%2?[maximum,0]:[0,maximum],kind);
  bytes(input,[0,1]);call('glTexImage1D',[T1,0,RGBA,2,0,0x1900,U8,input]);image(T1,[0,255,0,255,255,0,255,0],'typed indexed map consumer '+kind);
 }
 set(0xc72,[0,.25,.5,1]);set(0xc73,[1,0]);set(0xc74,[.75]);set(0xc75,[0,.25,.5,.75,1,.75,.5,.25]);
 call('glPixelTransferi',[0xd10,0]);call('glPixelTransferf',[0xd14,f(0)]);call('glPixelTransferf',[0xd15,f(1)]);
 bytes(input,[0,1,2,3]);call('glTexImage1D',[T1,0,RGBA,4,0,0x1900,U8,input]);image(T1,[0,255,191,0,64,0,191,64,128,255,191,128,255,0,191,191],'indexed map upload');
 call('glPixelTransferi',[0xd12,1]);call('glPixelTransferi',[0xd13,1]);bytes(input,[0,1]);call('glTexImage2D',[T2,0,RGBA,2,1,0,0x1900,U8,input]);image(T2,[64,0,191,64,255,0,191,191],'index shift offset before lookup');
 call('glPixelTransferi',[0xd12,0]);call('glPixelTransferi',[0xd13,0]);
 for(const [type,kind] of [[0x1400,'byte'],[0x1402,'usv'],[0x1404,'uiv']]){
  if(kind==='byte')bytes(input,[255,2]);else write(input,[-1,2],kind);
  call('glTexImage1D',[T1,0,RGBA,2,0,0x1900,type,input]);image(T1,[255,0,191,64,128,255,191,128],'signed index numeric '+type);
 }
 call('glPixelStorei',[0xcf0,1]);bytes(input,[0,1,0,2]);call('glTexImage1D',[T1,0,RGBA,2,0,0x1900,0x1403,input]);image(T1,[64,0,191,64,128,255,191,128],'unsigned short numeric swapped');call('glPixelStorei',[0xcf0,0]);
 call('glPixelTransferi',[0xd12,-1]);call('glPixelTransferi',[0xd13,0]);write(input,[16777218,4294967294],'uiv');call('glTexImage1D',[T1,0,RGBA,2,0,0x1900,0x1405,input]);image(T1,[64,0,191,64,255,0,191,64],'uint index exact bits and zero-fill shift');
 call('glPixelTransferi',[0xd12,0]);write(input,[.75,1.75]);call('glTexImage1D',[T1,0,RGBA,2,0,0x1900,0x1406,input]);image(T1,[64,0,191,64,128,255,191,128],'float index nearest');
 bytes(input,[0x58]);call('glPixelStorei',[0xcf4,1]);call('glTexImage1D',[T1,0,RGBA,2,0,0x1900,0x1a00,input]);image(T1,[64,0,191,64,0,255,191,0],'bitmap index MSB skip');
 call('glPixelStorei',[0xcf1,1]);bytes(input,[0x02]);call('glTexImage2D',[T2,0,RGBA,2,1,0,0x1900,0x1a00,input]);image(T2,[64,0,191,64,0,255,191,0],'bitmap index LSB skip');
 call('glPixelStorei',[0xcf4,0]);call('glPixelStorei',[0xcf1,0]);call('glPixelTransferf',[0xd14,f(1)]);call('glPixelTransferf',[0xd15,f(0)]);
 // List captures unmapped indices; table lookup occurs during execution.
 bytes(input,[1]);call('glNewList',[710,0x1300]);call('glTexImage1D',[T1,0,RGBA,1,0,0x1900,U8,input]);call('glEndList');bytes(input,[0]);set(0xc72,[1,.5,.25,0]);call('glCallList',[710]);image(T1,[128,0,191,64],'indexed list execution map');
 // Stream captures setter bytes and preserves ordering with a subsequent read.
 if(process.env.GL_PIXEL_MAP_JS_MUTATION==='capture')bridge._pixelMapIgnoreCapture=true;
 write(input,[0,1]);call('glPixelMapfv',[0xc76,2,input]);write(input,[1,0]);call('glPixelTransferi',[0xd10,1]);call('glReadPixels',[0,0,1,1,RGBA,U8,at]);literal('queued setter owns input',Array.from(new Uint8Array(memory.buffer,wa(at),4)),[255,0,64,128]);error(0,'queued mapped read');
 // RGBA framebuffer color-index queries remain errors, and stencil readback remains an explicit unsupported path.
 call('glReadPixels',[0,0,1,1,0x1900,U8,at]);error(0x502,'no color-index framebuffer mode');
 call('glPixelTransferi',[0xd10,0]);call('glFinish');
 call('glDeleteLists',[701,10]);call('wglMakeCurrent',[0,0]);call('wglDeleteContext',[context]);
 console.log(JSON.stringify({passed:true,queued,checks}));
 if(process.env.GL_PIXEL_MAP_EVIDENCE)fs.writeFileSync(process.env.GL_PIXEL_MAP_EVIDENCE,JSON.stringify({passed:true,queued,checks,observations},null,2));
 } finally {if(encoder)encoder.stop();if(manager)await manager.stop();if(render)render.destroy();}
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
