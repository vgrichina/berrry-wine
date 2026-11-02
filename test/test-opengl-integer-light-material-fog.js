'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),req=p=>require(path.join(root,p));
const {bootRenderHarness}=req('test/render-helper');
const {OpenGLHostBridge,CALL_INDEX:GL}=req('lib/gl-compat');
const Stream=req('lib/gl-command-stream');
const table=req('src/api_table.json');
const extraWat=`
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
 const queued=process.argv.includes('--worker'),mutation=process.env.GL_INTEGER_LMF_MUTATION,baseline=process.env.GL_INTEGER_LMF_BASELINE;
 let prebuiltModule;
 if(mutation||baseline){let changed=false;
  const bytes=req('test/compile-src').compileSrcWasm((file,source)=>{
   if(file==='13-exports.wat')return source+extraWat;
   if(baseline&&fs.existsSync(path.join(baseline,file))){changed=true;return fs.readFileSync(path.join(baseline,file),'utf8');}
   if(baseline)return source;
   const edits={
    range:['09a8ca-gl-lists.wat','(f32.gt (local.get $v) (f32.const 128))) (then (local.set $error (i32.const 0x501)))','(f32.gt (local.get $v) (f32.const 129))) (then (local.set $error (i32.const 0x501)))'],
    arity:['09a8b-handlers-opengl.wat','(i32.const 0x1204)) (then (return (i32.const 3)))','(i32.const 0x1204)) (then (return (i32.const 4)))'],
    capture:['09a8ca-gl-lists.wat','(call $gl_copy_from_guest (i32.add (local.get $p) (i32.const 24))','(call $gl_copy_from_guest (i32.add (local.get $p) (i32.const 28))'],
    signed:['09a8b-handlers-opengl.wat','(f64.convert_i32_s (local.get $raw))','(f64.convert_i32_u (local.get $raw))'],
    bias:['09a8b-handlers-opengl.wat','(f64.const 4294967295)','(f64.const 2147483647)'],
    numeric:['09a8b-handlers-opengl.wat','(else (f32.convert_i32_s (local.get $raw)))','(else (f32.div (f32.convert_i32_s (local.get $raw)) (f32.const 2147483647)))'],
    clamp:['09a8f-gl-matrix.wat','(f32.min (f32.const 1) (f32.max (f32.const 0) (f32.load (i32.add (local.get $values) (i32.shl (local.get $i) (i32.const 2))))))','(f32.load (i32.add (local.get $values) (i32.shl (local.get $i) (i32.const 2))))'],
    bool:['09a8f-gl-matrix.wat','(f32.ne (f32.load (local.get $values)) (f32.const 0))','(f32.gt (f32.load (local.get $values)) (f32.const 0))'],
    material:['09a8f-gl-matrix.wat','(local.set $offset (i32.const 16))','(local.set $offset (i32.const 32))'],
    attenuation:['09a8g-gl-raster.wat','(local.set $factor (call $gl_lmf_light_factor (local.get $b) (local.get $i) (i32.add (local.get $t) (i32.const 32)) (local.get $w)))','(local.set $factor (f32.const 1))'],
    local:['09a8g-gl-raster.wat','(if (i32.load offset=11192 (local.get $b))','(if (i32.const 0)'],
    spot:['09a8g-gl-raster.wat','(f32.ne (f32.load offset=16 (local.get $p)) (f32.const 180))','(i32.const 0)'],
    snapshot:['09a8g-gl-raster.wat','(memory.copy (i32.add (local.get $blk) (i32.const 10832))\n      (i32.add (local.get $snap) (i32.const 1096)) (i32.const 384))','(memory.copy (i32.add (local.get $blk) (i32.const 10832))\n      (i32.add (local.get $snap) (i32.const 1096)) (i32.const 0))'],
    back:['09a8g-gl-raster.wat','(select (i32.const 11088) (i32.const 8880) (global.get $gl_sw_reverse_normal))','(i32.const 8880)'],
   };
   assert(edits[mutation],'known mutation');const [fileName,from,to]=edits[mutation];if(file!==fileName)return source;
   assert(source.includes(from),'mutation anchor '+mutation);changed=true;return source.replace(from,to);
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
 const names=['glFogiv','glLightModelf','glLightModeliv','glLighti','glLightiv','glMaterialiv'];
 const vec=e.guest_alloc(64)>>>0,query=e.guest_alloc(64)>>>0,b=e.probe_block();
 const write=(p,values)=>values.forEach((v,i)=>{const bits=v>>>0;for(let j=0;j<4;j++)dv.setUint8(wa(p+i*4+j),bits>>>(j*8));});
 const read=(p,n)=>Buffer.from(Array.from({length:n},(_,i)=>dv.getUint8(wa(p+i))));
 const vector=(name,args,values,p=vec)=>{write(p,values);return call(name,[...args,p]);};
 const floats=(name,args,values,p=vec)=>vector(name,args,values.map(f),p);
 const state=(off,n=1)=>Array.from({length:n},(_,i)=>dv.getFloat32(b+off+i*4,true));
 function eq(actual,expected,label){assert.deepStrictEqual(actual,expected,label);checks++;observations.push({label,actual,expected});}
 function close(actual,expected,label,tol=1e-6){assert.strictEqual(actual.length,expected.length);actual.forEach((x,i)=>assert(Math.abs(x-expected[i])<=tol,label+' '+i+': '+x+' != '+expected[i]));checks++;observations.push({label,actual,expected});}
 const queryState=(p,n,kind='glGetFloatv')=>{new Uint8Array(memory.buffer,wa(query),64).fill(0xa7);call(kind,[p,query+8]);
  assert(read(query,8).every(x=>x===167));assert(read(query+8+n*4,56-n*4).every(x=>x===167));
  return Array.from({length:n},(_,i)=>kind==='glGetFloatv'?dv.getFloat32(wa(query+8+i*4),true):dv.getInt32(wa(query+8+i*4),true));};
 const error=(want,label)=>eq(call('glGetError'),want,label);
 for(const name of names){assert(call('wglGetProcAddress',[str(name)]),'WGL support '+name);assert(resolve(name),'DLL support '+name);}
 const color=[-2147483648,0,123456789,2147483647];
 const colorLiteral=[-1,2.3283064365386963e-10,0.057489048689603806,1];
 for(const name of [0x1200,0x1201,0x1202]){vector('glLightiv',[0x4000,name],color);eq(state(8368+(name-0x1200+1)*16,4),colorLiteral,'light signed normalized color '+name);}
 for(const name of [0x1200,0x1201,0x1202,0x1600,0x1602]){if(name===0x1602)floats('glMaterialfv',[0x405,0x1201],[.75,.5,.25,1]);vector('glMaterialiv',[0x408,name],color);
  const off=name===0x1600?48:name===0x1602?0:(name-0x1200)*16;
  eq(state(8880+off,4),colorLiteral,'front signed normalized material '+name);eq(state(11088+off,4),colorLiteral,'back signed normalized material '+name);
  if(name===0x1602){eq(state(8896,4),colorLiteral,'front ambient and diffuse');eq(state(11104,4),colorLiteral,'back ambient and diffuse');}}
 vector('glLightModeliv',[0xb53],color);eq(queryState(0xb53,4),colorLiteral,'model signed normalized ambient');
 eq(queryState(0xb53,4,'glGetIntegerv'),[-2147483648,0,123456791,2147483647],'normalized signed integer query conversion');
 call('glGetDoublev',[0xb53,query]);eq(Array.from({length:4},(_,i)=>dv.getFloat64(wa(query)+i*8,true)),colorLiteral,'double query promotes stored state');
 vector('glFogiv',[0xb66],color);eq(queryState(0xb66,4),[0,...colorLiteral.slice(1)],'fog signed conversion then clamp');
 for(const [input,want] of [
  [[-1073741824,1073741824,-1,1],[-.5,.5,-2.3283064365386963e-10,6.984919309616089e-10]],
  [[-2147483647,2147483646,16777217,-16777217],[-1,1,0.007812500931322575,-0.0078125]],
 ]){vector('glLightiv',[0x4007,0x1201],input);eq(state(8368+7*64+32,4),want,'literal intermediate signed color');}
 for(const pname of [0xb51,0xb52])for(const value of [0,1,-1,-2147483648,2147483647]){
  vector('glLightModeliv',[pname],[value]);eq(queryState(pname,1),[Number(value!==0)],'integer model bool '+pname+'/'+value);
 }
 for(const pname of [0xb51,0xb52])for(const value of [-.125,0,.125,-Infinity,Infinity,NaN]){
  call('glLightModelf',[pname,f(value)]);eq(queryState(pname,1),[Number(value!==0)],'float model bool '+pname+'/'+value);
 }
 for(const [pname,value] of [[0x1205,128],[0x1206,180],[0x1207,17],[0x1208,123456789],[0x1209,2147483647]]){
  call('glLighti',[0x4000,pname,value]);eq(state(10832+(pname-0x1202)*4),[Math.fround(value)],'scalar light numeric '+pname);
  vector('glLightiv',[0x4007,pname],[value]);eq(state(10832+7*32+(pname-0x1202)*4),[Math.fround(value)],'vector scalar light numeric '+pname);
 }
 vector('glMaterialiv',[0x404,0x1601],[128]);eq(state(8944),[128],'shininess numeric');
 vector('glMaterialiv',[0x405,0x1603],[-2147483648,17,2147483647]);eq(state(11156,3),[-2147483648,17,2147483648],'color indexes numeric');
 for(const [pname,value] of [[0xb65,0x2601],[0xb62,17],[0xb63,-2147483648],[0xb64,2147483647],[0xb61,-123456789]]){
  vector('glFogiv',[pname],[value]);eq(queryState(pname,1),[Math.fround(value)],'fog enum/numeric '+pname);
 }
 // Established float routes retain their values and receive matching ranges.
 floats('glLightModelfv',[0xb53],[-2,.25,3,1]);eq(queryState(0xb53,4),[-2,.25,3,1],'float ambient remains unclamped');
 floats('glLightfv',[0x4003,0x1201],[-2,.25,3,1]);eq(state(8368+3*64+32,4),[-2,.25,3,1],'float light color remains unclamped');
 floats('glMaterialfv',[0x405,0x1202],[-2,.25,3,1]);eq(state(11120,4),[-2,.25,3,1],'float back material remains unclamped');
 floats('glFogfv',[0xb66],[-2,.25,3,1]);eq(queryState(0xb66,4),[0,.25,1,1],'float fog clamps at specification');
 call('glMaterialf',[0x405,0x1601,f(19.5)]);eq(state(11152),[19.5],'float shininess retains fraction and face');
 call('glLightf',[0x4003,0x1208,f(.125)]);eq(state(10832+3*32+24),[.125],'float attenuation retains fraction');
 call('glLightf',[0x4003,0x1206,f(90.5)]);error(0x501,'float cutoff invalid gap');
 call('glMaterialf',[0x405,0x1601,f(128.5)]);error(0x501,'float shininess out of range');
 // Model and scalar extension state is private to each real WGL context.
 const originalAmbient=queryState(0xb53,4),originalLocal=queryState(0xb51,1),originalTwo=queryState(0xb52,1);
 const second=call('wglCreateContext',[dc]);assert(second&&second!==context);call('wglMakeCurrent',[dc,second]);
 eq(queryState(0xb51,1),[0],'new context local-viewer default');eq(queryState(0xb52,1),[0],'new context two-side default');eq(queryState(0xb61,1),[0],'new context fog-index default');
 vector('glLightModeliv',[0xb53],[2147483647,0,0,2147483647]);call('glLightModelf',[0xb51,f(1)]);call('wglMakeCurrent',[dc,context]);
 eq(queryState(0xb53,4),originalAmbient,'ambient context isolation');eq(queryState(0xb51,1),originalLocal,'local-viewer context isolation');eq(queryState(0xb52,1),originalTwo,'two-side context isolation');call('wglDeleteContext',[second]);
 // Modelview, not the selected matrix mode, transforms position/direction.
 call('glMatrixMode',[0x1700]);call('glLoadIdentity');call('glTranslatef',[3,-4,5].map(f));call('glScalef',[2,3,4].map(f));
 call('glMatrixMode',[0x1701]);call('glLoadIdentity');call('glScalef',[9,8,7].map(f));
 vector('glLightiv',[0x4001,0x1203],[-17,3,5,2]);eq(state(8368+64,4),[-28,1,30,2],'position numeric plus modelview at specification');
 vector('glLightiv',[0x4001,0x1204],[-17,3,5]);eq(state(10832+32,3),[-34,9,20],'direction numeric modelview upper 3x3');
 floats('glLightfv',[0x4001,0x1203],[-17,3,5,2]);eq(state(8368+64,4),[-28,1,30,2],'preserved float position');
 for(const mode of [0x1701,0x1700]){call('glMatrixMode',[mode]);call('glLoadIdentity');}
 // Sparse argument frames, split i32s and vectors, and bytes between backing pages.
 for(const p of [0x60000000,0x61000000,0x60001000,0x63000000,0x64000000,0x63001000])assert(e.test_virtual_map_commit(p,4096));
 assert.notStrictEqual(wa(0x60001000)-wa(0x60000000),4096);assert.notStrictEqual(wa(0x63001000)-wa(0x63000000),4096);
 new Uint8Array(memory.buffer,wa(0x61000000),4096).fill(0x7f);new Uint8Array(memory.buffer,wa(0x64000000),4096).fill(0x7e);
 function sparse(name,args,values){const at=0x60000ff9,p=0x63000ffd,thunk=resolve(name);
  const a=[...args];if(values){write(p-8,[0x6b6b6b6b,0x6b6b6b6b,...values,0x6c6c6c6c,0x6c6c6c6c]);a.push(p);}
  write(at-8,[0xa7a7a7a7,0xa7a7a7a7,0x12345678,...a,0xa8a8a8a8,0xa8a8a8a8]);
  const before=read(at-8,(a.length+5)*4),vb=values?read(p-8,(values.length+4)*4):null;
  dv.setUint32(regs+16,at,true);e.probe_invoke(thunk);eq(dv.getUint32(regs+16,true),at+(a.length+1)*4,'sparse stdcall '+name);
  eq(read(at-8,before.length),before,'sparse frame canaries '+name);if(vb)eq(read(p-8,vb.length),vb,'sparse vector canaries '+name);
 }
 sparse('glFogiv',[0xb66],color);eq(queryState(0xb66,4),[0,...colorLiteral.slice(1)],'sparse fog color');
 sparse('glLightModelf',[0xb51,f(-.125)]);eq(queryState(0xb51,1),[1],'sparse float bool');
 sparse('glLightModeliv',[0xb53],color);eq(queryState(0xb53,4),colorLiteral,'sparse model color');
 sparse('glLighti',[0x4000,0x1208,17]);eq(state(10856),[17],'sparse scalar attenuation');
 sparse('glLightiv',[0x4000,0x1204],[-7,11,17]);eq(state(10832,3),[-7,11,17],'sparse direction exact three');
 sparse('glMaterialiv',[0x405,0x1603],[-7,11,17]);eq(state(11156,3),[-7,11,17],'sparse indexes exact three');
 assert(new Uint8Array(memory.buffer,wa(0x61000000),4096).every(x=>x===127));assert(new Uint8Array(memory.buffer,wa(0x64000000),4096).every(x=>x===126));
 // Exactly the required arity at the final mapped byte; extra reads must trap.
 assert(e.test_virtual_map_commit(0x65000000,4096));assert.strictEqual(wa(0x65001000),240);
 for(const [name,args,values] of [
  ['glFogiv',[0xb66],color],['glLightModeliv',[0xb53],color],['glLightiv',[0x4000,0x1201],color],['glMaterialiv',[0x408,0x1600],color],
  ['glFogiv',[0xb62],[3]],['glLightModeliv',[0xb51],[-1]],['glLightiv',[0x4000,0x1204],[0,0,-1]],
  ['glLightiv',[0x4000,0x1206],[90]],['glMaterialiv',[0x404,0x1601],[17]],['glMaterialiv',[0x405,0x1603],[3,5,7]],
 ]){const at=0x65001000-values.length*4;assert.doesNotThrow(()=>vector(name,args,values,at),'exact arity without overread '+name);error(0,'exact arity '+name+'/'+args.at(-1));}
 function snapshot(){return Buffer.concat([Buffer.from(new Uint8Array(memory.buffer,b+8352,640)),Buffer.from(new Uint8Array(memory.buffer,b+10832,384))]);}
 function bad(name,at,args,label){const thunk=resolve(name);if(args)write(at+4,args);dv.setUint32(regs+16,at,true);dv.setUint32(regs,0xdeadbeef,true);
  const before=snapshot(),used=e.gl_wat_stream_used(),lists=e.probe_list_commands(),mode=e.probe_mode(),count=e.probe_count();
  assert.throws(()=>e.probe_invoke(thunk),WebAssembly.RuntimeError,label);eq(snapshot(),before,label+' atomic state');
  eq(dv.getUint32(regs+16,true),at,label+' ESP');eq(dv.getUint32(regs,true),0xdeadbeef,label+' EAX');
  eq([e.gl_wat_stream_used(),e.probe_list_commands(),e.probe_mode(),e.probe_count()],[used,lists,mode,count],label+' command/list/vertices');
 }
 for(const [name,args,n] of [['glFogiv',[0xb66],4],['glLightModeliv',[0xb53],4],['glLightiv',[0x4000,0x1204],3],['glMaterialiv',[0x408,0x1603],3]]){
  bad(name,stack,[...args,0x65001000],'missing first '+name);bad(name,stack,[...args,0x65001000-n*4+1],'missing final '+name);bad(name,stack,[...args,0xffffffff],'wrapping vector '+name);
 }
 for(const name of names)bad(name,0x65000ffa,null,'malformed stdcall frame '+name);
 const invalidCalls=[
  ['glFogiv',[0xdead,0xffffffff],0x500],['glLightModelf',[0xb53,f(1)],0x500],['glLightModeliv',[0xdead,0xffffffff],0x500],
  ['glLighti',[0x4000,0x1203,1],0x500],['glLightiv',[0x4008,0x1203,0xffffffff],0x500],['glMaterialiv',[0xdead,0x1200,0xffffffff],0x500],['glMaterialiv',[0x404,0x1604,0xffffffff],0x500],['glLightiv',[0x3fff,0x1203,0xffffffff],0x500],
 ];
 for(const [name,args,err] of invalidCalls){const prior=snapshot();call(name,args);error(err,'invalid enum '+name);eq(snapshot(),prior,'invalid enum no mutation '+name);}
 for(const [name,args,value,err] of [
  ['glFogiv',[0xb62],-1,0x501],['glFogiv',[0xb65],0xdead,0x500],
  ['glLightiv',[0x4000,0x1205],-1,0x501],['glLightiv',[0x4000,0x1205],129,0x501],
  ['glLightiv',[0x4000,0x1206],91,0x501],['glLightiv',[0x4000,0x1206],179,0x501],
  ['glLightiv',[0x4000,0x1207],-1,0x501],['glLightiv',[0x4000,0x1208],-1,0x501],['glLightiv',[0x4000,0x1209],-1,0x501],
  ['glMaterialiv',[0x408,0x1601],-1,0x501],['glMaterialiv',[0x408,0x1601],129,0x501],
 ]){const prior=snapshot();vector(name,args,[value]);error(err,'invalid value '+name+'/'+args.at(-1)+'/'+value);eq(snapshot(),prior,'rejected value retains all state');}
 for(const [name,args] of [['glLighti',[0x4000,0x1205,-1]],['glLighti',[0x4000,0x1206,91]],['glLighti',[0x4000,0x1207,-1]],['glLighti',[0x4000,0x1208,-1]],['glLighti',[0x4000,0x1209,-1]]]){call(name,args);error(0x501,'scalar invalid value');}
 for(const [name,args] of [['glFogiv',[0xb66,0xffffffff]],['glLightModelf',[0xb51,f(1)]],['glLightModeliv',[0xb53,0xffffffff]],['glLighti',[0x4000,0x1205,0]],['glLightiv',[0x4000,0x1203,0xffffffff]]]){
  call('glBegin',[0]);const prior=snapshot();call(name,args);call('glEnd');error(0x502,'Begin forbidden '+name);eq(snapshot(),prior,'Begin retains lighting/fog state');}
 // Lists own parameter values, but position/direction transforms run at playback.
 for(const mode of [0x1300,0x1301]){
  const id=call('glGenLists',[1]),beforeCompile=snapshot();call('glNewList',[id,mode]);
  vector('glFogiv',[0xb63],[-17]);vector('glLightModeliv',[0xb53],color);call('glLightModelf',[0xb51,f(-.125)]);
  call('glLighti',[0x4000,0x1208,3]);vector('glLightiv',[0x4002,0x1203],[1,2,3,1]);vector('glLightiv',[0x4002,0x1204],[1,2,3]);
  vector('glMaterialiv',[0x405,0x1602],color);call('glEndList');if(mode===0x1300)eq(snapshot(),beforeCompile,'COMPILE defers all six families');write(vec,[99,99,99,99]);
  call('glMatrixMode',[0x1700]);call('glLoadIdentity');call('glTranslatef',[4,5,6].map(f));call('glScalef',[2,3,4].map(f));call('glCallList',[id]);
  eq(queryState(0xb63,1),[-17],'list fog scalar captured '+mode);eq(queryState(0xb53,4),colorLiteral,'list model ambient captured '+mode);
  eq(queryState(0xb51,1),[1],'list float boolean '+mode);eq(state(10856),[3],'list scalar light numeric '+mode);
  eq(state(8368+128,4),[6,11,18,1],'list position execution-time transform '+mode);eq(state(10832+64,3),[2,6,12],'list direction execution-time transform '+mode);
  eq(state(11088,4),colorLiteral,'list back material values '+mode);eq(state(11104,4),colorLiteral,'list back ambient/diffuse '+mode);
  call('glLoadIdentity');call('glDeleteLists',[id,1]);error(0,'list family errors '+mode);
 }
 // Nested lists preserve vector ownership and execute child state changes.
 const child=call('glGenLists',[2]);call('glNewList',[child,0x1300]);vector('glFogiv',[0xb64],[23]);
 vector('glMaterialiv',[0x404,0x1601],[31]);call('glEndList');call('glNewList',[child+1,0x1300]);call('glCallList',[child]);call('glEndList');
 write(vec,[91,91,91,91]);call('glCallList',[child+1]);eq(queryState(0xb64,1),[23],'nested list captured fog');eq(state(8944),[31],'nested list captured material');
 call('glDeleteLists',[child,2]);
 // Errors during compilation do not add a command and cannot execute later.
 const rejectedList=call('glGenLists',[1]);call('glNewList',[rejectedList,0x1300]);const savedState=snapshot(),savedCommands=e.probe_list_commands();
 vector('glLightiv',[0x4000,0x1206],[91]);error(0x501,'compile rejects invalid cutoff immediately');eq(e.probe_list_commands(),savedCommands,'invalid list command omitted');
 call('glEndList');call('glCallList',[rejectedList]);eq(snapshot(),savedState,'invalid compiled command never executes');call('glDeleteLists',[rejectedList,1]);
 // Literal pixel oracles use the real native rasterizer and its queued snapshot.
 call('glViewport',[0,0,8,8]);call('glDisable',[0xb44]);call('glDisable',[0xb71]);call('glDisable',[0xde1]);call('glDisable',[0xb57]);
 call('glMatrixMode',[0x1701]);call('glLoadIdentity');call('glMatrixMode',[0x1700]);call('glLoadIdentity');
 call('glClearColor',[0,0,0,1].map(f));call('glEnable',[0xb50]);call('glEnable',[0x4000]);call('glEnable',[0xba1]);
 for(let i=1;i<8;i++)call('glDisable',[0x4000+i]);
 function material(p,v,face=0x408){return vector('glMaterialiv',[face,p],v);}
 function light(p,v){return vector('glLightiv',[0x4000,p],v);}
 function reset(){call('glEnable',[0xb50]);call('glEnable',[0x4000]);call('glDisable',[0xb60]);vector('glLightModeliv',[0xb53],[0,0,0,0]);call('glLightModelf',[0xb51,f(0)]);call('glLightModelf',[0xb52,f(0)]);
  material(0x1200,[0,0,0,0]);material(0x1201,[2147483647,2147483647,2147483647,2147483647]);material(0x1202,[0,0,0,0]);material(0x1600,[0,0,0,0]);material(0x1601,[0]);
  light(0x1200,[0,0,0,0]);light(0x1201,[2147483647,0,0,2147483647]);light(0x1202,[0,0,0,0]);light(0x1203,[0,0,1,0]);light(0x1204,[0,0,-1]);
  call('glLighti',[0x4000,0x1205,0]);call('glLighti',[0x4000,0x1206,180]);call('glLighti',[0x4000,0x1207,1]);call('glLighti',[0x4000,0x1208,0]);call('glLighti',[0x4000,0x1209,0]);call('glNormal3f',[0,0,1].map(f));}
 function point(){call('glBegin',[0]);call('glVertex3f',[0,0,0].map(f));call('glEnd');}
 const output=e.guest_alloc(8*8*4)>>>0;
 function pixel(want,label,tolerance=1){call('glReadPixels',[0,0,8,8,0x1908,0x1401,output]);if(encoder)encoder.fence();
  const all=new Uint8Array(memory.buffer,wa(output),256),matches=[];for(let i=0;i<64;i++)if(all[i*4]||all[i*4+1]||all[i*4+2])matches.push(Array.from(all.slice(i*4,i*4+4)));
  assert(matches.length,label+' has drawn pixels');matches.forEach(actual=>close(actual,want,label,tolerance));}
 reset();call('glClear',[0x4000]);point();pixel([255,0,0,255],'integer diffuse red');
 reset();light(0x1203,[0,0,2,1]);call('glLighti',[0x4000,0x1207,2]);call('glLighti',[0x4000,0x1208,1]);call('glLighti',[0x4000,0x1209,1]);call('glClear',[0x4000]);point();pixel([32,0,0,255],'attenuation 1/(2+2+4)');
 reset();light(0x1203,[0,0,1,1]);light(0x1204,[0,1,-1]);call('glLighti',[0x4000,0x1206,60]);call('glLighti',[0x4000,0x1205,2]);call('glClear',[0x4000]);point();pixel([128,0,0,255],'spot cos45 squared');
 reset();light(0x1203,[0,0,1,1]);light(0x1204,[0,1,0]);call('glLighti',[0x4000,0x1206,90]);call('glLighti',[0x4000,0x1205,0]);call('glClear',[0x4000]);point();pixel([255,0,0,255],'spot cutoff 90 boundary exponent zero');
 reset();material(0x1600,[0,0,2147483647,2147483647]);light(0x1203,[0,0,1,1]);light(0x1204,[0,1,0]);call('glLighti',[0x4000,0x1206,30]);call('glClear',[0x4000]);point();pixel([0,0,255,255],'spot cutoff removes light preserving emission');
 reset();material(0x1201,[0,0,0,2147483647]);material(0x1202,[2147483647,2147483647,2147483647,2147483647]);material(0x1601,[2]);light(0x1201,[0,0,0,0]);light(0x1202,[2147483647,0,0,2147483647]);
 call('glTranslatef',[.5,0,-.5].map(f));call('glLightModelf',[0xb51,f(1)]);call('glClear',[0x4000]);point();pixel([218,0,0,255],'local viewer half-vector squared',2);call('glLoadIdentity');
 reset();call('glDisable',[0x4000]);material(0x1600,[2147483647,0,0,2147483647],0x404);material(0x1600,[0,2147483647,0,2147483647],0x405);call('glLightModelf',[0xb52,f(-.25)]);
 call('glClear',[0x4000]);call('glBegin',[4]);for(const v of [[-1,-1,0],[0,1,0],[1,-1,0]])call('glVertex3f',v.map(f));call('glEnd');pixel([0,255,0,255],'two-sided back emission');
 reset();call('glDisable',[0xb50]);call('glColor4f',[1,0,0,1].map(f));call('glEnable',[0xb60]);vector('glFogiv',[0xb65],[0x2601]);vector('glFogiv',[0xb63],[-1]);vector('glFogiv',[0xb64],[1]);vector('glFogiv',[0xb66],[0,0,2147483647,2147483647]);
 call('glClear',[0x4000]);point();pixel([128,0,128,255],'integer linear fog half red half blue');

 // Material changes are legal within a primitive and light only subsequent
 // vertices. Both colors must survive native pending-vertex lighting and queue.
 reset();call('glDisable',[0x4000]);call('glClear',[0x4000]);call('glBegin',[0]);
 material(0x1600,[2147483647,0,0,2147483647]);call('glVertex3f',[-.5,0,0].map(f));
 material(0x1600,[0,2147483647,0,2147483647]);call('glVertex3f',[.5,0,0].map(f));call('glEnd');
 call('glReadPixels',[0,0,8,8,0x1908,0x1401,output]);if(encoder)encoder.fence();
 const changedPixels=[];for(let i=0;i<64;i++){const c=Array.from(new Uint8Array(memory.buffer,wa(output)+i*4,4));if(c[0]||c[1]||c[2])changedPixels.push(c);}
 eq(changedPixels,[[255,0,0,255],[0,255,0,255]],'material inside Begin colors following vertices');
 // Host replay consumes canonical arities and uploads the extended lighting
 // uniforms. Native pixels above remain the rendering oracle.
 const {FixedFunctionGL}=req('lib/gl-compat');
 const backend={gl:{},uniforms:new Map(),createProgram(){return{attributes:{},uniforms:{}};},createBuffer(){return{};},
  createTexture(){return{};},setTextureParameter(){},setUniform(_p,n,_k,v){this.uniforms.set(n,v);},bindTexture(){},useProgram(){}};
 const frontend=new FixedFunctionGL(backend);
 frontend.setLightModel(0xb51,[-.125]);frontend.setLightModel(0xb52,[-1]);
 frontend.setMaterial(0x1602,[.25,.5,.75,1],0x405);frontend.setMaterial(0x1601,[128],0x405);
 frontend.setLight(0x4000,0x1204,[0,1,-1]);frontend.setLight(0x4000,0x1205,[17]);frontend.setLight(0x4000,0x1206,[60]);
 frontend.setLight(0x4000,0x1207,[2]);frontend.setLight(0x4000,0x1208,[3]);frontend.setLight(0x4000,0x1209,[4]);
 frontend._applyUniforms();
 eq(backend.uniforms.get('uLocalViewer'),1,'host local-viewer uniform');eq(backend.uniforms.get('uTwoSide'),1,'host two-side uniform');
 eq(Array.from(backend.uniforms.get('uBackAmbient')),[.25,.5,.75,1],'host back ambient');eq(backend.uniforms.get('uBackShininess'),128,'host shininess numeric');
 eq(Array.from(backend.uniforms.get('uLightFactors[0]')).slice(0,4),[17,2,3,4],'host spotlight and attenuation numeric');
 close(Array.from(backend.uniforms.get('uLightSpot[0]')).slice(0,4),[0,1,-1,.5],'host direction and cutoff');
 error(0,'final errors');
 if(encoder){encoder.fence();assert(encoder.snapshot().glQueued>0,'actual queue used');}
 call('wglDeleteContext',[context]);
 const result={passed:true,route:queued?'queued':'direct',checks,missingImplemented:names.length,mutation:mutation||null,observations};
 if(process.env.GL_INTEGER_LMF_EVIDENCE)fs.writeFileSync(process.env.GL_INTEGER_LMF_EVIDENCE,JSON.stringify(result,null,2));console.log(JSON.stringify({...result,observations:observations.length}));
 }finally{if(encoder)encoder.stop();if(manager)await manager.stop();if(render)render.destroy();}
})().catch(e=>{console.error(e);process.exitCode=1;});
