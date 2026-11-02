'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),req=p=>require(path.join(root,p));
const {bootRenderHarness}=req('test/render-helper');
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
{
 const {FixedFunctionGL,constants:C}=req('lib/gl-compat');let uniformNames;
 const values=new Map();const frontend=new FixedFunctionGL({gl:{},
  createProgram(v,f,a,u){uniformNames=u;return {uniforms:{}};},
  createBuffer:()=>({}),createTexture:()=>({}),bindTexture(){},
  setUniform(p,n,k,v){values.set(n,v);}});
 assert(uniformNames.includes('uNormalizeEnabled'));
 frontend._applyUniforms();assert.strictEqual(values.get('uNormalizeEnabled'),0,'frontend default normalization');
 frontend.setEnabled(C.NORMALIZE,true);frontend._applyUniforms();assert.strictEqual(values.get('uNormalizeEnabled'),1);
 frontend.pushAttrib(0x1000);frontend.setEnabled(C.NORMALIZE,false);frontend._applyUniforms();
 assert.strictEqual(values.get('uNormalizeEnabled'),0);frontend.popAttrib();frontend._applyUniforms();
 assert.strictEqual(values.get('uNormalizeEnabled'),1,'frontend TRANSFORM_BIT normalization');
 frontend.pushAttrib(0x40);frontend.setEnabled(C.NORMALIZE,false);frontend.popAttrib();frontend._applyUniforms();
 assert.strictEqual(values.get('uNormalizeEnabled'),0,'frontend unrelated mask normalization');
}
// Resolve and execute the real stdcall ABI, including output byte canaries.
(async()=>{
 let memory,bridge,encoder=null,manager=null,render=null,producer=null;
 const queued=process.argv.includes('--worker');
 let prebuiltModule;
 const mutation=process.env.GL_TYPED_NORMAL_MUTATION, baseline=process.env.GL_TYPED_NORMAL_BASELINE;
 if(mutation||baseline){let changed=false;
  const bytes=req('test/compile-src').compileSrcWasm((file,source)=>{
   if(file==='13-exports.wat')return source+extraWat;
   if(baseline&&['09a8e-gl-state.wat','09b2-dispatch-table.generated.wat'].includes(file)){
    changed=true;return fs.readFileSync(path.join(baseline,file),'utf8');
   }
   if(file==='09a8g-gl-raster.wat'&&['normalize-always','inverse-determinant'].includes(mutation)){
    const from=mutation==='normalize-always'
      ? '(if (i32.and (i32.load (global.get $gl_sw_st)) (i32.const 0x400000))'
      : '(then (f32.div (f32.const 1) (local.get $det)))';
    const to=mutation==='normalize-always'?'(if (i32.const 1)':'(then (f32.const 1))';
    assert(source.includes(from));changed=true;return source.replace(from,to);
   }
   if(file==='09a8e-gl-state.wat'&&mutation==='attribute-mask'){
    const from='(if (i32.and (i32.load offset=68 (local.get $p)) (i32.const 1))';
    assert(source.includes(from));changed=true;return source.replace(from,'(if (i32.const 1)');
   }
   if(file==='09a8e-gl-state.wat'&&mutation){
    const start=source.indexOf('  (func $gl_normal_typed_component');assert(start>=0);
    let body=source.slice(start),from,to;
    if(mutation==='double-stride'){from='(i32.const 4) (i32.or';to='(i32.const 4) (i32.and';}
    if(mutation==='double-conversion'){from='(f32.demote_f64 (f64.reinterpret_i64 (call $gl64 (local.get $p))))';to='(f32.reinterpret_i32 (call $gl32 (local.get $p)))';}
    if(mutation==='integer-raw'){from='(call $gl_color_integer_component (local.get $p) (local.get $bits) (i32.const 1))';to='(f32.convert_i32_s (call $gl32 (local.get $p)))';}
    if(mutation==='normal-opcode'){from='(i32.const 63) (local.get $stack)';to='(i32.const 23) (local.get $stack)';}
    if(mutation==='list-bypass'){from='(drop (call $gl_wat_encode_call (i32.const 63) (local.get $stack) (i32.const 0)))';to='(drop (call $gl_state_intercept (i32.const 63) (local.get $stack)))';}
    if(mutation==='begin-reject'){from='(local.set $esp (i32.load offset=16 (global.get $reg_base)))';to='(if (i32.ge_s (global.get $gl_immediate_mode) (i32.const 0)) (then (unreachable))) '+from;}
    if(from){assert(body.includes(from),mutation);changed=true;return source.slice(0,start)+body.replace(from,to);}
   }
   if(file==='09a8b-handlers-opengl.wat'&&['signed-zero','integer-precision','signed-denominator'].includes(mutation)){
    const start=source.indexOf('(func $gl_color_integer_component'),end=source.indexOf('  ;; The generator',start);
    let body=source.slice(start,end),from,to;
    if(mutation==='signed-zero'){from='(f64.const 1))))';to='(f64.const 0))))';}
    if(mutation==='integer-precision'){from='(f64.convert_i32_s (local.get $c))';to='(f64.promote_f32 (f32.convert_i32_s (local.get $c)))';}
    if(mutation==='signed-denominator'){from='(local.get $den))))';to='(f64.const 127))))';}
    assert(body.includes(from),mutation);changed=true;return source.slice(0,start)+body.replace(from,to)+source.slice(end);
   }
   if(file==='09a8c-gl-encoder.wat'&&mutation==='lighting-normal'){
    const from='(f32.store offset=44 (local.get $p) (global.get $gl_normal_z))';assert(source.includes(from));changed=true;
    return source.replace(from,'(f32.store offset=44 (local.get $p) (f32.const 1))');
   }
   return source;
  });assert(changed,'source control applied');prebuiltModule=new WebAssembly.Module(bytes);console.error('SOURCE_CONTROL_COMPILED',mutation||'old-source');
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
 e.probe_init();const regs=e.probe_regs(),defaultStack=e.guest_alloc(512)>>>0;let stack=defaultStack,stackWa=wa(stack);
 function str(s){const p=e.guest_alloc(s.length+1)>>>0;new Uint8Array(memory.buffer,wa(p),s.length+1).set(Buffer.from(s+'\0'));return p;}
 const module=e.probe_module(str('opengl32.dll'))>>>0;assert(module);
 const user32=e.probe_module(str('user32.dll'))>>>0;assert(user32);
 const cache=new Map();function resolve(name){if(!cache.has(name)){
   dv.setUint32(regs+16,stack,true);cache.set(name,e.probe_lookup(name.startsWith('gl')||name.startsWith('wgl')?module:user32,str(name))>>>0);
 }return cache.get(name);}
 function stackBytes(){return Buffer.from(Array.from({length:256},(_,i)=>dv.getUint8(wa(stack+i))));}
 function writeStack(offset,value){const b=Buffer.alloc(4);b.writeUInt32LE(value>>>0);for(let i=0;i<4;i++)dv.setUint8(wa(stack+offset+i),b[i]);}
 function call(name,args=[]){const p=resolve(name);assert(p,'real resolver: '+name);
   const api=table.find(a=>a.name===name);assert.strictEqual(dv.getUint32(wa(p)+4,true),api.id);
   for(let i=0;i<8;i++)dv.setUint32(regs+i*4,0x55660000+i,true);
   dv.setUint32(regs+16,stack,true);for(let i=0;i<256;i++)dv.setUint8(wa(stack+i),0xa5);
   writeStack(0,0x12345678);args.forEach((x,i)=>writeStack(4+i*4,x));
   const before=stackBytes();
   let value;try{value=e.probe_invoke(p)>>>0;}catch(error){console.error("resolved call failed",name,args);throw error;}
   assert.strictEqual(dv.getUint32(regs+16,true),stack+4*(args.length+1),'stdcall '+name);
   for(let i=1;i<8;i++)if(i!==4)assert.strictEqual(dv.getUint32(regs+i*4,true),0x55660000+i,'register '+name);
   assert.deepStrictEqual(stackBytes(),before,'stack '+name);
   return value;
 }
 const f=x=>{const b=Buffer.alloc(4);b.writeFloatLE(x);return b.readUInt32LE();};
 const dc=e.probe_dc(42)>>>0,context=call('wglCreateContext',[dc]);assert(context);
 assert.strictEqual(call('wglMakeCurrent',[dc,context]),1);
 const out=e.guest_alloc(256)>>>0,vector=e.guest_alloc(64)>>>0;
 let checks=0;const evidence=[];
 const doubles=xs=>xs.flatMap(x=>{const b=Buffer.alloc(8);b.writeDoubleLE(x);return [b.readUInt32LE(),b.readUInt32LE(4)];});
 const shapes=[['b',8],['s',16],['i',32],['d',64]].flatMap(([s,bits])=>[0,1].map(v=>({name:'glNormal3'+s+(v?'v':''),bits,v})));
 // Literal IEEE binary32 results from the GL endpoint-linear contract.
 // Do not derive the oracle through any renderer or conversion helper.
 const cases={
  8:[[[ -128,127,0],[-1,1,0.003921568859368563]],[[64,-64,-1],[0.5058823823928833,-0.49803921580314636,-0.003921568859368563]]],
  16:[[[-32768,32767,0],[-1,1,0.000015259021893143654]],[[16384,-16384,-1],[0.5000228881835938,-0.49999237060546875,-0.000015259021893143654]]],
  32:[[[-2147483648,2147483647,0],[-1,1,2.3283064365386963e-10]],[[16777217,1073741887,-1073741889],[0.007812500931322575,0.5,-0.5000000596046448]],[[1073741888,-1,1],[0.5000000596046448,-2.3283064365386963e-10,6.984919309616089e-10]]],
  64:[[[.5,-.25,2],[.5,-.25,2]],[[1+2**-24,1+3*2**-24,-0],[1,1.000000238418579,-0]],[[2**-149,2**-150,1e-300],[1.401298464324817e-45,0,0]],[[Math.PI,1e300,-1e300],[3.1415927410125732,Infinity,-Infinity]]]
 };
 function normal(expected,label){
  for(const [q,width] of [['glGetFloatv',4],['glGetDoublev',8]]){
   new Uint8Array(memory.buffer,wa(out),256).fill(0xb7);call(q,[0xb02,out+9]);
   const got=expected.map((_,i)=>width===8?dv.getFloat64(wa(out+9+i*width),true):dv.getFloat32(wa(out+9+i*width),true));
   assert.deepStrictEqual(got,expected,label+' '+q);
   assert(new Uint8Array(memory.buffer,wa(out),9).every(x=>x===0xb7));
   assert(new Uint8Array(memory.buffer,wa(out)+9+3*width,256-9-3*width).every(x=>x===0xb7));
  }assert.strictEqual(call('glGetError'),0,label+' error');checks++;evidence.push({label,expected:expected.map(x=>Object.is(x,-0)?'-0':String(x))});
 }
 function bytes(bits,values){const b=Buffer.alloc(3*bits/8);values.forEach((x,i)=>{
  if(bits===8)b.writeInt8(x,i);if(bits===16)b.writeInt16LE(x,i*2);
  if(bits===32)b.writeInt32LE(x,i*4);if(bits===64)b.writeDoubleLE(x,i*8);
 });return b;}
 function put(at,b){for(let i=0;i<b.length;i++)dv.setUint8(wa(at+i),b[i]);}
 function invoke(shape,values,at=vector){
  if(shape.v){const b=bytes(shape.bits,values);put(at,b);const saved=Buffer.from(b);call(shape.name,[at]);
   assert.deepStrictEqual(Buffer.from(Array.from({length:b.length},(_,i)=>dv.getUint8(wa(at+i)))),saved,'vector read only');
  }else call(shape.name,shape.bits===64?doubles(values):values.map(x=>shape.bits===8?(x&255)|0x76543200:shape.bits===16?(x&65535)|0x76540000:x));
 }
 normal([0,0,1],'initial normal');
 for(const shape of shapes){
  const p=call('wglGetProcAddress',[str(shape.name)]);assert(p,shape.name+' WGL resolver');
  assert.strictEqual(dv.getUint32(wa(p)+4,true),dv.getUint32(wa(resolve(shape.name))+4,true),'both resolvers agree');
  cache.set(shape.name,p);
  for(const [values,want] of cases[shape.bits]){invoke(shape,values);normal(want,shape.name+' conversion');}
 }
 // GLdouble vectors permit ordinary x86 four-byte alignment as well as
 // eight-byte alignment; both still consume full eight-byte elements.
 for(const offset of [0,4]){
  const at=((vector+7)&~7)+offset;assert.strictEqual(at&7,offset);
  invoke(shapes[7],[.125,-.5,2],at);normal([.125,-.5,2],'double vector alignment '+offset);
 }
 for(const alignment of [0,4]){
  stack=((defaultStack+7)&~7)+alignment;stackWa=wa(stack);
  invoke(shapes[6],[.125,-.5,2]);normal([.125,-.5,2],'scalar double stack alignment '+alignment);
 }
 stack=defaultStack;stackWa=wa(stack);
 // Existing float forms share the same state used by the new family.
 call('glNormal3f',[.25,-.5,.75].map(f));normal([.25,-.5,.75],'float compatibility');
 put(vector,Buffer.from(new Float32Array([-.25,.5,-.75]).buffer));call('glNormal3fv',[vector]);normal([-.25,.5,-.75],'float vector compatibility');
 const sparse=0x42000000;
 for(const p of [sparse,0x43000000,sparse+4096])assert.strictEqual(e.probe_sparse_page(p)>>>0,p);
 assert.notStrictEqual(wa(sparse+4096),wa(sparse)+4096,'nonaffine source pages');
 // Offset 4093 splits both four- and eight-byte components, plus packed shorts.
 for(const shape of shapes.filter(s=>s.v)){
  const [values,want]=cases[shape.bits][0],at=sparse+(shape.bits===8?4095:4093),b=bytes(shape.bits,values);
  put(at-1,Buffer.alloc(b.length+2,0xa6));invoke(shape,values,at);normal(want,shape.name+' sparse vector');
  assert.strictEqual(dv.getUint8(wa(at-1)),0xa6);assert.strictEqual(dv.getUint8(wa(at+b.length)),0xa6);
 }
 // A nonaffine stdcall stack contains the real return address and every arg.
 for(const p of [0x45000000,0x46000000,0x45001000])assert.strictEqual(e.probe_sparse_page(p)>>>0,p);
 assert.notStrictEqual(wa(0x45001000),wa(0x45000000)+4096);
 stack=0x45000ff9;stackWa=wa(stack);
 for(const shape of shapes){
  const [values,want]=cases[shape.bits][1];invoke(shape,values);
  // Query uses the ordinary stack: this case targets the typed setter ABI.
  stack=defaultStack;stackWa=wa(stack);normal(want,shape.name+' sparse stdcall');
  stack=0x45000ff9;stackWa=wa(stack);
 }
 stack=defaultStack;stackWa=wa(stack);
 // Current normals belong to their context and GL_CURRENT_BIT, rather than
 // the host bridge's frontend state or a process-wide typed-normal cache.
 call('glNormal3d',doubles([.25,-.5,2]));
 const other=call('wglCreateContext',[dc]);assert.strictEqual(call('wglMakeCurrent',[dc,other]),1);normal([0,0,1],'second initial');
 call('glNormal3i',[-2147483648,0,2147483647]);normal([-1,2.3283064365386963e-10,1],'second context');
 assert.strictEqual(call('wglMakeCurrent',[dc,context]),1);normal([.25,-.5,2],'first restored');
 call('glPushAttrib',[1]);invoke(shapes[0],[-128,127,0]);call('glPopAttrib');normal([.25,-.5,2],'CURRENT_BIT restores');
 call('glPushAttrib',[0x40000]);call('glNormal3d',doubles([2,3,4]));call('glPopAttrib');normal([2,3,4],'unrelated attrib preserves normal');
 assert.strictEqual(call('wglMakeCurrent',[dc,other]),1);normal([-1,2.3283064365386963e-10,1],'second survives');
 assert.strictEqual(call('wglMakeCurrent',[dc,context]),1);call('wglDeleteContext',[other]);
 // Compile and compile-and-execute each shape. Mutating original vector bytes
 // and stack slots after definition cannot change a captured normal.
 let listId=200;
 for(const shape of shapes)for(const mode of [0x1300,0x1301]){
  const id=listId++,[values,want]=cases[shape.bits][1];
  call('glNormal3f',[.25,.5,.75].map(f));call('glNewList',[id,mode]);invoke(shape,values);call('glEndList');
  normal(mode===0x1300?[.25,.5,.75]:want,shape.name+' compile timing');
  put(vector,Buffer.alloc(32,0x7f));call('glNormal3d',doubles([3,4,5]));call('glCallList',[id]);normal(want,shape.name+' list snapshot');
  // Replaying a normal list is legal within a caller primitive and preserves
  // all vertices already emitted, as do direct typed calls.
  call('glBegin',[4]);call('glVertex2f',[-.75,-.75].map(f));
  const count=e.probe_count(),at=e.probe_vertices(),saved=Buffer.from(new Uint8Array(memory.buffer,at,count*4));
  call('glCallList',[id]);invoke(shape,values);
  assert.strictEqual(e.probe_mode(),4);assert.strictEqual(e.probe_count(),count);
  assert.deepStrictEqual(Buffer.from(new Uint8Array(memory.buffer,at,count*4)),saved,'normal retains pending vertices');
  call('glVertex2f',[.75,-.75].map(f));call('glVertex2f',[-.75,.75].map(f));call('glEnd');
  normal(want,shape.name+' Begin and list legal');call('glDeleteLists',[id,1]);
 }
 // Compile a primitive containing each typed normal, then render it at replay.
 const primitive=listId++;call('glNewList',[primitive,0x1300]);call('glBegin',[0]);
 for(const shape of shapes){invoke(shape,cases[shape.bits][0][0]);call('glVertex2f',[0,0]);}
 call('glEnd');call('glEndList');call('glCallList',[primitive]);assert.strictEqual(call('glGetError'),0);
 // Isolate diffuse lighting: black ambient and emission, white directional
 // light at +Z, green material. With normalization disabled output is N.z.
 const vec=a=>put(vector,Buffer.from(new Float32Array(a).buffer));
 vec([0,0,1,0]);call('glLightfv',[0x4000,0x1203,vector]);
 vec([1,1,1,1]);call('glLightfv',[0x4000,0x1201,vector]);
 vec([0,0,0,1]);call('glLightModelfv',[0xb53,vector]);call('glMaterialfv',[0x408,0x1200,vector]);call('glMaterialfv',[0x408,0x1600,vector]);
 vec([0,1,0,1]);call('glMaterialfv',[0x408,0x1201,vector]);
 call('glEnable',[0xb50]);call('glEnable',[0x4000]);call('glDisable',[0xb57]);
 assert.strictEqual(call('glIsEnabled',[0xba1]),0,'NORMALIZE defaults disabled');
 call('glViewport',[0,0,8,8]);call('glDrawBuffer',[0x405]);call('glReadBuffer',[0x405]);call('glClearColor',[0,0,0,f(1)]);
 const pixels=[];
 function lit(shape,values,want,label,replay=false){
  call('glClear',[0x4000]);
  if(replay){const id=listId++;call('glNewList',[id,0x1300]);invoke(shape,values);call('glEndList');put(vector,Buffer.alloc(32,0xff));call('glCallList',[id]);call('glDeleteLists',[id,1]);}
  else invoke(shape,values);
  call('glRectf',[-.75,-.75,.75,.75].map(f));
  call('glReadPixels',[3,3,1,1,0x1908,0x1401,out]);
  const got=Array.from(new Uint8Array(memory.buffer,wa(out),4));assert.deepStrictEqual(got,want,label);
  assert.strictEqual(call('glGetError'),0);checks++;pixels.push({label,got,expected:want});
 }
 for(const shape of shapes){
  const max=shape.bits===8?127:shape.bits===16?32767:shape.bits===32?2147483647:1;
  const min=shape.bits===8?-128:shape.bits===16?-32768:shape.bits===32?-2147483648:-1;
  lit(shape,[0,0,max],[0,255,0,255],shape.name+' lit endpoint');
  lit(shape,[0,0,min],[0,0,0,255],shape.name+' negative endpoint');
  const mid=shape.bits===8?64:shape.bits===16?16384:shape.bits===32?1073741888:.5;
  lit(shape,[0,0,mid],[0,shape.bits===8?129:128,0,255],shape.name+' diffuse intermediate');
  lit(shape,[0,0,mid],[0,shape.bits===8?129:128,0,255],shape.name+' captured lighting',true);
 }
 // Normalization is a lighting operation, never a setter operation.
 call('glEnable',[0xba1]);assert.strictEqual(call('glIsEnabled',[0xba1]),1);lit(shapes[6],[0,0,.25],[0,255,0,255],'normalized double normal');
 normal([0,0,.25],'normal query remains unnormalized');
 call('glPushAttrib',[0x1000]);call('glDisable',[0xba1]);
 lit(shapes[6],[0,0,.25],[0,64,0,255],'TRANSFORM_BIT temporary normalization disabled');
 call('glPopAttrib');assert.strictEqual(call('glIsEnabled',[0xba1]),1);
 lit(shapes[6],[0,0,.25],[0,255,0,255],'TRANSFORM_BIT restores normalization');
 call('glPushAttrib',[0x40]);call('glDisable',[0xba1]);call('glPopAttrib');
 assert.strictEqual(call('glIsEnabled',[0xba1]),0,'LIGHTING_BIT preserves normalization');
 call('glDisable',[0xba1]);
 call('glMatrixMode',[0x1700]);call('glScalef',[1,1,2].map(f));
 lit(shapes[6],[0,0,.5],[0,64,0,255],'inverse transpose transformed normal');
 normal([0,0,.5],'normal query remains untransformed');call('glLoadIdentity');
 // Two disjoint quads in one primitive preserve their per-vertex normals.
 // Their interiors contain pixels (1,1) and (6,6) in the explicit 8x8 viewport.
 call('glClear',[0x4000]);call('glBegin',[4]);
 for(const [lo,hi,z] of [[-.9,-.4,1],[.3,.9,.25]]){
  call('glNormal3d',doubles([0,0,z]));
  for(const [x,y] of [[lo,lo],[hi,lo],[hi,hi],[lo,lo],[hi,hi],[lo,hi]])call('glVertex2f',[x,y].map(f));
 }
 call('glEnd');
 for(const [x,y,want] of [[1,1,[0,255,0,255]],[6,6,[0,64,0,255]]]){
  call('glReadPixels',[x,y,1,1,0x1908,0x1401,out]);assert.deepStrictEqual(Array.from(new Uint8Array(memory.buffer,wa(out),4)),want,'per vertex normal');checks++;
 }
 // Invalid sparse source cannot partially change the current normal.
 assert.strictEqual(e.probe_sparse_page(0x47000000)>>>0,0x47000000);
 call('glNormal3d',doubles([.25,.5,.75]));
 for(const shape of shapes.filter(s=>s.v)){
  const p=resolve(shape.name);dv.setUint32(regs+16,stack,true);writeStack(0,0x12345678);writeStack(4,0x47000fff);
  dv.setUint32(regs,0xdeadbeef,true);
  assert.throws(()=>e.probe_invoke(p),WebAssembly.RuntimeError,'missing vector page '+shape.name);
  assert.strictEqual(dv.getUint32(regs+16,true),stack,'failed read preserves ESP');
  assert.strictEqual(dv.getUint32(regs,true),0xdeadbeef,'failed read preserves EAX');
  normal([.25,.5,.75],shape.name+' failed source atomicity');
 }
 // Wrapped vectors and missing pointer-slot pages fail before observing values.
 for(const shape of shapes.filter(s=>s.v)){
  const p=resolve(shape.name);dv.setUint32(regs+16,stack,true);writeStack(4,0xfffffffe);
  assert.throws(()=>e.probe_invoke(p),WebAssembly.RuntimeError,'wrapped vector '+shape.name);
  normal([.25,.5,.75],shape.name+' wrapped source atomicity');
  // First two pointer bytes are mapped; the following page is absent.
  put(0x47000ffe,Buffer.from([0,0]));dv.setUint32(regs+16,0x47000ffa,true);
  dv.setUint32(regs,0xdeadbeef,true);
  assert.throws(()=>e.probe_invoke(p),WebAssembly.RuntimeError,'missing pointer slot '+shape.name);
  assert.strictEqual(dv.getUint32(regs+16,true),0x47000ffa,'failed pointer read preserves ESP');
  assert.strictEqual(dv.getUint32(regs,true),0xdeadbeef,'failed pointer read preserves EAX');
  normal([.25,.5,.75],shape.name+' failed pointer slot atomicity');
 }
 if(queued){encoder.fence();assert(encoder.snapshot().glQueued>0,'real queue used');}
 assert.strictEqual(call('glGetError'),0);
 const result={passed:true,route:queued?'queued':'direct',checks,currentNormals:evidence,pixels};
 if(process.env.GL_TYPED_NORMAL_EVIDENCE)fs.writeFileSync(process.env.GL_TYPED_NORMAL_EVIDENCE,JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
 } finally {if(encoder)encoder.stop();if(manager)await manager.stop();if(render)render.destroy();}
})().catch(error=>{console.error(error.stack||error);process.exit(1);});
