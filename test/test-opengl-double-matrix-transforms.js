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
// Small resolved-handler fixtures exercise double reads across non-affine
// pages and missing-page/allocation atomicity without a production g2w mirror.
function checkSparseDoubles(){
 const {compile}=req('tools/watx');
 const source=fs.readFileSync(path.join(root,'src/09a8b-handlers-opengl.wat'),'utf8')+'\n'+
  fs.readFileSync(path.join(root,'src/09a8c-gl-encoder.wat'),'utf8')+'\n'+fs.readFileSync(path.join(root,'src/03-registers.wat'),'utf8');
 function extract(name){const start=source.indexOf('(func $'+name+' ');assert(start>=0,name);let depth=0;
  for(let i=start;i<source.length;i++){if(source[i]===';'&&source[i+1]===';'){i=source.indexOf('\n',i);continue;}
   if(source[i]==='(')depth++;if(source[i]===')'&&--depth===0)return source.slice(start,i+1);}throw Error(name);}
 const common=extract('gl_alloc_affine')+extract('gl32')+extract('gl64');
 for(const [name,op,count] of [['glLoadMatrixd',34,16],['glTranslated',41,3],['glScaled',40,3]]){
  const original=extract('handle_'+name)+(count===3?extract('gl_double_transform'):'');
  const values=(count===16?[-0,Math.PI,1+2**-24,1+3*2**-24,2**-149,2**-150,1e-300,1e300,-Infinity,NaN,1,2,3,4,5,6]:[-0,Math.PI,2**-149]);
  function boot(mutation='',missing=-1,fail=false){let memory,captured,allocated=0,freed=0;
   const t=p=>(p>>>12)===missing?240:p>=0x50000000?0x8000+(((p-0x50000000)>>>12)*0x2000)+(p&4095):p-0x400000+4096;
   let body=original;
   if(mutation==='stride')body=body.replace(count===16?'(i32.shl (local.get $i) (i32.const 3))':'(local.get $p) (i32.const 8)',count===16?'(i32.shl (local.get $i) (i32.const 2))':'(local.get $p) (i32.const 4)');
   if(mutation==='opcode')body=body.replace('(i32.const '+op+')','(i32.const '+(op+1)+')');
   if(mutation==='conversion')body=body.replace('(f32.demote_f64 (f64.reinterpret_i64 (call $gl64 (local.get $p))))','(f32.reinterpret_i32 (call $gl32 (local.get $p)))');
   if(mutation)assert.notStrictEqual(body,original,'mutation applies');
   const wat=`(memory 8) (export "memory" (memory 0))
    (import "fixture" "g2w" (func $g2w (param i32) (result i32)))
    (import "fixture" "alloc" (func $heap_alloc (param i32) (result i32)))
    (import "fixture" "free" (func $heap_free (param i32)))
    (import "fixture" "encode" (func $gl_wat_encode_call (param i32 i32 i32) (result i32)))
    (global $reg_base i32 (i32.const 256)) (global $image_base i32 (i32.const 4194304))
    (global $GUEST_BASE i32 (i32.const 4096)) (global $NULL_SENTINEL i32 (i32.const 240))
    (global $fault_sync_epoch (mut i32) (i32.const 0))
    (defmacro (g2w-fast $ga) (call $g2w $ga)) ${common} ${body}
    (func (export "invoke") (param $p i32)
     (call $handle_${name} (local.get $p) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))`;
   const binary=compile(wat.replaceAll('(region.end $DIRECT_WINDOW)','(i32.const 65536)'),new Map(),{mode:'production'}).wasmBinary;
   const e=new WebAssembly.Instance(new WebAssembly.Module(binary),{fixture:{g2w:t,alloc:n=>{allocated++;assert.strictEqual(n,count===16?72:16);return fail?0:0x410000;},free:()=>freed++,encode:(opcode,stack,aux)=>{
    assert.strictEqual(opcode,op);assert.strictEqual(aux,0);const v=new DataView(memory.buffer);
    const at=count===16?t(v.getUint32(stack+4,true)):stack+4;
    captured=Array.from(new Float32Array(memory.buffer,at,count));return 0;}}}).exports;
   memory=e.memory;return {e,t,v:new DataView(memory.buffer),captured:()=>captured,allocated:()=>allocated,freed:()=>freed};
  }
  function accept(h){const {v,t,e}=h,p=0x50000ffd,esp=count===16?0x402800:p-4,b=Buffer.alloc(count*8);
   values.forEach((x,i)=>b.writeDoubleLE(x,i*8));[...b].forEach((x,i)=>v.setUint8(t(p+i),x));v.setUint32(272,esp,true);
   e.invoke(p);assert.deepStrictEqual(h.captured(),values.map(Math.fround),name+' non-affine unaligned doubles');
   assert.strictEqual(v.getUint32(272,true),(esp+(count===16?8:28))>>>0);assert.strictEqual(h.freed(),1);}
  accept(boot());for(const mutation of ['stride','opcode',...(count===3?['conversion']:[])])assert.throws(()=>accept(boot(mutation)),assert.AssertionError,name+' negative '+mutation);
  for(const [missing,fail] of [[0x50000,false],[0x50001,false],[-1,true]]){
   const h=boot('',missing,fail),esp=count===16?0x402800:0x50000ff9;h.v.setUint32(272,esp,true);h.v.setUint32(256,0xdeadbeef,true);
   assert.throws(()=>h.e.invoke(0x50000ffd),WebAssembly.RuntimeError);assert.strictEqual(h.captured(),undefined);
   assert.strictEqual(h.v.getUint32(272,true),esp);assert.strictEqual(h.v.getUint32(256,true),0xdeadbeef);
   if(missing>=0)assert.strictEqual(h.allocated(),0,'validate both pages before allocation');
  }
 }
 console.log('PASS sparse double matrix reads, conversion, ABI, failure atomicity and eight mutations');
}
if(!process.env.GL_DOUBLE_MATRIX_BASELINE)checkSparseDoubles();

(async()=>{
 let memory,bridge,encoder=null,manager=null,render=null,producer=null;
 const queued=process.argv.includes('--worker');
 const mutation=process.env.GL_DOUBLE_MATRIX_MUTATION;
 const baseline=process.env.GL_DOUBLE_MATRIX_BASELINE;
 let prebuiltModule;
 if(mutation||baseline){
  let changed=false;
  const bytes=req('test/compile-src').compileSrcWasm((file,source)=>{
   if(file==='13-exports.wat')return source+extraWat;
   if(baseline&&['09a8b-handlers-opengl.wat','09b2-dispatch-table.generated.wat','09a8ca-gl-lists.wat'].includes(file)){changed=true;return fs.readFileSync(path.join(root,'scratch/runs/20261102-gl-double-matrix-implementation/baseline',file),'utf8');}
   if(file!=='09a8b-handlers-opengl.wat'||baseline)return source;
   const anchors={
     stride:['(i32.shl (local.get $i) (i32.const 3))','(i32.shl (local.get $i) (i32.const 2))'],
     opcode:['(i32.const 34) (local.get $stack)','(i32.const 109) (local.get $stack)'],
     scalar:['(local.get $p) (i32.const 8)','(local.get $p) (i32.const 4)'],
     conversion:['(f32.demote_f64 (f64.reinterpret_i64 (call $gl64 (local.get $p))))',
       '(f32.reinterpret_i32 (call $gl32 (local.get $p)))'],
   };
   assert(anchors[mutation],'known mutation');const [from,to]=anchors[mutation];
   // Restrict mutations to the newly implemented functions.
   const start=source.indexOf('(func $handle_glLoadMatrixd '),
     end=source.indexOf(';; glMultMatrixd:',start);
   assert(start>=0&&end>start);const body=source.slice(start,end);
   assert(body.includes(from),'production mutation anchor');changed=true;
   return source.slice(0,start)+body.replace(from,to)+source.slice(end);
  });assert(changed);prebuiltModule=new WebAssembly.Module(bytes);
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


 let checks=0;const matrixEvidence=[],pixelEvidence=[];
 const dc=e.probe_dc(42)>>>0,context=call('wglCreateContext',[dc]);assert(context);
 assert.strictEqual(call('wglMakeCurrent',[dc,context]),1);
 call('glLoadIdentity');console.log(JSON.stringify({stage:'resolved-canonical-control',passed:true}));
 if(baseline){const resolved=['glLoadMatrixd','glTranslated','glScaled'].map(name=>({name,thunk:resolve(name)}));console.log(JSON.stringify({stage:'old-source-resolution',resolved}));assert(resolved.every(x=>x.thunk),'old source cannot resolve the three genuine transforms');}
 const dwords=values=>{const b=Buffer.alloc(values.length*8);values.forEach((x,i)=>b.writeDoubleLE(x,i*8));return Array.from(new Uint32Array(b.buffer,b.byteOffset,values.length*2));};
 const region=e.guest_alloc(8200)>>>0,p=region+4093-(region&4095);
 function put(values){values.forEach((x,i)=>dv.setFloat64(wa(p+i*8),x,true));}
 function load(values){put(values);const before=Buffer.from(new Uint8Array(memory.buffer,wa(p),128));call('glLoadMatrixd',[p]);assert.deepStrictEqual(Buffer.from(new Uint8Array(memory.buffer,wa(p),128)),before);}
 const translate=a=>call('glTranslated',dwords(a)),scale=a=>call('glScaled',dwords(a));
 const top=()=>Array.from(new Float32Array(memory.buffer,e.gl_mtx_top_ptr(),16));
 function matrix(expected,label){const actual=top();assert.deepStrictEqual(actual,expected,label);matrixEvidence.push({label,actual:actual.map(x=>Object.is(x,-0)?'-0':String(x)),expected:expected.map(x=>Object.is(x,-0)?'-0':String(x))});checks++;}
 const I=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
 const A=[1,2,0,0,3,4,0,0,0,0,2,0,-.25,.5,0,1];
 const AT=[1,2,0,0,3,4,0,0,0,0,2,0,-1.5,-1,1.5,1];
 const ATS=[2,4,0,0,1.5,2,0,0,0,0,-2,0,-1.5,-1,1.5,1];
 // Literal noncommuting products, independent of production multiplication.
 for(const [mode,unit] of [[0x1700,0],[0x1701,0],[0x1702,0],[0x1702,1]]){
  call('glActiveTextureARB',[0x84c0+unit]);call('glMatrixMode',[mode]);
  scale([7,8,9]);load(A);matrix(A,'load replaces selected matrix');
  translate([.25,-.5,.75]);matrix(AT,'A*T: postmultiply');
  scale([2,.5,-1]);matrix(ATS,'A*T*S: eight-byte scalars');
  call('glPushMatrix');load(I);matrix(I,'push then replace');call('glPopMatrix');matrix(ATS,'pop restores exact top');
 }
 call('glActiveTextureARB',[0x84c0]);call('glMatrixMode',[0x1700]);
 const special=[-0,Math.PI,1+2**-24,1+3*2**-24,2**-149,2**-150,1e-300,1e300,-Infinity,NaN,-.25,.5,7,8,9,1];
 load(special);matrix(special.map(Math.fround),'f64 conversion tie/subnormal/signed zero/extremes');
 put(Array(16).fill(99));const snapshots=[];
 Stream.replay(Stream.memoryBatch(memory,e.gl_wat_stream_base(),e.gl_wat_stream_used()),(op,aux,c)=>{
  if(op===GL.glLoadMatrixf)snapshots.push(Array.from(new Float32Array(c.buffer,c.pointerOffset,16)));return 0;
 });assert.deepStrictEqual(snapshots.at(-1),special.map(Math.fround),'stream owns converted matrix after source mutation');checks++;

 // Inspect converted scalar payloads too: multiplication may canonicalize -0.
 call('glLoadIdentity');e.gl_wat_stream_flush();
 translate([-0,1+2**-24,2**-149]);scale([Math.PI,1+3*2**-24,2**-150]);
 const converted=[];
 Stream.replay(Stream.memoryBatch(memory,e.gl_wat_stream_base(),e.gl_wat_stream_used()),(op,aux,c)=>{
  if(op===GL.glTranslatef||op===GL.glScalef)converted.push([op,...[4,8,12].map(n=>new DataView(c.buffer).getFloat32(c.stackOffset+n,true))]);return 0;
 });
 assert.deepStrictEqual(converted,[[GL.glTranslatef,-0,1,2**-149],[GL.glScalef,Math.fround(Math.PI),1+2**-22,0]],'scalar converted stream values');checks++;
 // Lists capture pointed values and scalar arguments, but use mode at replay.
 const lists=[];
 for(const mode of [0x1300,0x1301]){
  call('glLoadIdentity');const list=call('glGenLists',[1]);lists.push(list);
  call('glNewList',[list,mode]);load(A);translate([.25,-.5,.75]);scale([2,.5,-1]);call('glEndList');
  matrix(mode===0x1300?I:ATS,'compile timing');put(Array(16).fill(99));
  call('glMatrixMode',[0x1701]);load(I);call('glCallList',[list]);matrix(ATS,'list snapshot and replay mode');
  call('glMatrixMode',[0x1700]);matrix(mode===0x1300?I:ATS,'other stack unchanged');
 }
 // Observe native stack error latches (the current host GetError path does
 // not merge these diagnostic observer errors). Resolved pushes/pops still
 // drive all state changes and ABI checks.
 for(const [mode,limit] of [[0x1700,32],[0x1701,32],[0x1702,32]]){
  call('glMatrixMode',[mode]);load(A);call('glPopMatrix');assert.strictEqual(e.gl_mtx_error(),0x504);e.gl_mtx_clear_error();
  for(let i=1;i<limit;i++)call('glPushMatrix');call('glPushMatrix');assert.strictEqual(e.gl_mtx_error(),0x503);e.gl_mtx_clear_error();matrix(A,'overflow no replacement');
  for(let i=1;i<limit;i++)call('glPopMatrix');matrix(A,'all saved entries unchanged');
 }call('glMatrixMode',[0x1702]);call('glLoadIdentity');call('glMatrixMode',[0x1701]);call('glLoadIdentity');call('glMatrixMode',[0x1700]);
 // Actual direct and queued software framebuffer. Expected mask is derived
 // from clip intervals [0,.5] x [-.75,.25], not a renderer/matrix helper.
 call('glViewport',[0,0,8,8]);call('glDrawBuffer',[0x405]);call('glReadBuffer',[0x405]);call('glPixelStorei',[0xd05,1]);
 const output=e.guest_alloc(264)>>>0,outWa=wa(output),pixelBytes=new Uint8Array(memory.buffer,outWa,264);
 const red=[255,0,0,255],black=[0,0,0,255],empty=Array(8).fill('........');
 const mask=['........','....XX..','....XX..','....XX..','....XX..','........','........','........'];
 function expected(rows){return rows.flatMap(row=>[...row].flatMap(c=>c==='X'?red:black));}
 const clear=()=>{call('glClearColor',[0,0,0,f(1)]);call('glClear',[0x4000]);};
 function pixels(){call('glFinish');if(encoder)encoder.fence();pixelBytes.fill(0xa7);
  call('glReadPixels',[0,0,8,8,0x1908,0x1401,output+4]);
  assert.deepStrictEqual(Array.from(pixelBytes.slice(0,4)),[167,167,167,167]);assert.deepStrictEqual(Array.from(pixelBytes.slice(260)),[167,167,167,167]);
  return Array.from(pixelBytes.slice(4,260));}
 function expect(rows,label){const actual=pixels();assert.deepStrictEqual(actual,expected(rows),label);pixelEvidence.push({label,rgba:actual,expectedMask:rows});checks++;}
 const diagonal=[.5,0,0,0,0,.5,0,0,0,0,1,0,0,0,0,1];
 const transforms=()=>{load(diagonal);translate([.5,-.5,0]);scale([.5,1,1]);};
 const quad=()=>{call('glColor4f',[f(1),0,0,f(1)]);call('glRectf',[-1,-1,1,1].map(f));};
 clear();transforms();quad();expect(mask,'literal transformed quad');
 for(const mode of [0x1300,0x1301]){
  clear();load(I);const list=call('glGenLists',[1]);call('glNewList',[list,mode]);transforms();quad();call('glEndList');
  expect(mode===0x1300?empty:mask,'list definition pixels');put(Array(16).fill(99));
  clear();load(I);call('glCallList',[list]);expect(mask,'list captured transforms/quad');
 }
 // Stronger order control: D*T(1,-.5,0)*S clips x=[.25,.75],
 // whereas D*S*T clips x=[0,.5]. Whole pixel columns distinguish them;
 // the earlier half-sized translation can quantize to the same raster mask.
 const orderMask=['........','.....XX.','.....XX.','.....XX.','.....XX.','........','........','........'];
 clear();load(diagonal);translate([1,-.5,0]);scale([.5,1,1]);quad();expect(orderMask,'noncommuting transform order pixels');
 clear();load(diagonal);scale([.5,1,1]);translate([1,-.5,0]);quad();
 assert.throws(()=>assert.deepStrictEqual(pixels(),expected(orderMask)),assert.AssertionError,'reversed transform order differs');checks++;
 clear();transforms();quad();const actual=pixels(),corrupt=actual.slice();corrupt[(2*8+4)*4]=0;
 assert.throws(()=>assert.deepStrictEqual(corrupt,expected(mask)),assert.AssertionError);
 assert.throws(()=>assert.deepStrictEqual(actual,expected(empty)),assert.AssertionError);checks+=2;
 // Begin errors preserve every pending vertex byte, and list execution rejects
 // server matrix changes at replay time. Finish the caller's real triangle.
 for(const action of [()=>load(A),()=>translate([1,2,3]),()=>scale([2,3,4]),...lists.map(id=>()=>call('glCallList',[id]))]){
  clear();load(I);call('glColor4f',[f(1),0,0,f(1)]);call('glBegin',[4]);call('glVertex2f',[f(-.75),f(-.75)]);
  const count=e.probe_count(),mode=e.probe_mode(),at=e.probe_vertices(),before=Buffer.from(new Uint8Array(memory.buffer,at,count*4));
  action();assert.strictEqual(e.probe_count(),count);assert.strictEqual(e.probe_mode(),mode);
  assert.deepStrictEqual(Buffer.from(new Uint8Array(memory.buffer,at,count*4)),before);matrix(I,'Begin matrix unchanged');
  call('glVertex2f',[f(.75),f(-.75)]);call('glVertex2f',[f(-.75),f(.75)]);call('glEnd');assert.strictEqual(call('glGetError'),0x502);
  const pix=pixels();assert.deepStrictEqual(pix.slice((2*8+2)*4,(2*8+2)*4+4),red);assert.deepStrictEqual(pix.slice((6*8+6)*4,(6*8+6)*4+4),black);checks++;
 }
 for(const action of [()=>load(A),()=>translate([1,2,3]),()=>scale([2,3,4])]){
  const list=call('glGenLists',[1]);load(I);call('glNewList',[list,0x1300]);call('glBegin',[0]);action();
  assert.strictEqual(call('glGetError'),0x502);call('glEnd');call('glEndList');call('glCallList',[list]);matrix(I,'compile shadow Begin rejects matrix');
 }
 for(const bad of [0xffffff81,0xffffffff,0xdead0000]){
  const thunk=resolve('glLoadMatrixd');dv.setUint32(regs+16,stack,true);dv.setUint32(regs,0xdeadbeef,true);dv.setUint32(stackWa+4,bad,true);
  assert.throws(()=>e.probe_invoke(thunk),WebAssembly.RuntimeError);assert.strictEqual(dv.getUint32(regs+16,true),stack);assert.strictEqual(dv.getUint32(regs,true),0xdeadbeef);matrix(I,'bad pointer atomic');
 }
 for(const name of ['glLoadMatrixd','glTranslated','glScaled'])assert(call('wglGetProcAddress',[str(name)]),'WGL resolved '+name);
 for(const name of ['glAccum','glClearAccum','glMap1d','glGetDoublev','wglShareLists']){
  const before=e.probe_thunks();dv.setUint32(regs+16,stack,true);assert.strictEqual(e.probe_lookup(module,str(name)),0,'unsupported '+name);assert.strictEqual(e.probe_error(),127);assert.strictEqual(e.probe_thunks(),before);
 }
 assert.strictEqual(call('glGetError'),0);if(encoder){encoder.fence();assert(encoder.snapshot().glQueued>=1,'actual queued raster');}
 assert.strictEqual(call('wglDeleteContext',[context]),1);
 const result={passed:true,route:queued?'queued':'direct',checks,negativeControls:3,mutation:mutation||null};
 if(process.env.GL_DOUBLE_MATRIX_EVIDENCE)fs.writeFileSync(process.env.GL_DOUBLE_MATRIX_EVIDENCE,JSON.stringify({...result,matrixEvidence,pixelEvidence},null,2));
 console.log(JSON.stringify(result));
 }finally{if(encoder)encoder.stop();if(manager)await manager.stop();if(render)render.destroy();}
})().catch(e=>{console.error(e);process.exitCode=1;});
