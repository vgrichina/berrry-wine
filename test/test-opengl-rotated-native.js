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

(async()=>{
 let memory,bridge,encoder=null,manager=null,render=null,producer=null;
 const queued=process.argv.includes('--worker'),mutation=process.env.GL_ROTATED_MUTATION,baseline=process.env.GL_ROTATED_BASELINE;
 let prebuiltModule;
 if(mutation||baseline){let changed=false;
  const bytes=req('test/compile-src').compileSrcWasm((file,source)=>{
   if(file==='13-exports.wat')return source+extraWat;
   if(baseline&&['09a8b-handlers-opengl.wat','09b2-dispatch-table.generated.wat','09a8ca-gl-lists.wat','09a8f-gl-matrix.wat'].includes(file)){changed=true;return fs.readFileSync(path.join(baseline,file),'utf8');}
   if(baseline)return source;
   const edits={
    degrees:['09a8f-gl-matrix.wat','(f64.const 180)))','(f64.const 1)))'],
    stride:['09a8b-handlers-opengl.wat','(local.get $p) (i32.const 24))))','(local.get $p) (i32.const 20))))'],
    order:['09a8f-gl-matrix.wat','(call $gl_mtx_mul_into (local.get $scratch) (local.get $top) (local.get $m))','(call $gl_mtx_mul_into (local.get $scratch) (local.get $m) (local.get $top))'],
    axis:['09a8f-gl-matrix.wat','(local.set $x (f64.div (local.get $x) (local.get $len)))','(local.set $x (local.get $x))'],
    begin:['09a8ca-gl-lists.wat','(i32.or (i32.eq (local.get $op) (i32.const 39)) (i32.eq (local.get $op) (i32.const 90)))','(i32.const 0)'],
    capture:['09a8ca-gl-lists.wat','(i32.shl (i32.add (call $gl_arg_words (local.get $op)) (i32.const 1)) (i32.const 2)))','(i32.const 20))'],
    cleanup:['09a8b-handlers-opengl.wat','(i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36))))','(i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))'],
   };
   if(!edits[mutation])throw Error('unknown mutation '+mutation);const [target,from,to]=edits[mutation];if(file!==target)return source;
   if(file==='09a8b-handlers-opengl.wat'){const start=source.indexOf('(func $handle_glRotated ');assert(start>=0);const body=source.slice(start);assert(body.includes(from),'rotation mutation anchor '+mutation);changed=true;return source.slice(0,start)+body.replace(from,to);}
   assert(source.includes(from),'mutation anchor '+mutation);changed=true;return source.replace(from,to);
  });assert(changed,'mutation applied');prebuiltModule=new WebAssembly.Module(bytes);
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
 const dwords=values=>{const b=Buffer.alloc(values.length*8);values.forEach((x,i)=>b.writeDoubleLE(x,i*8));return Array.from(new Uint32Array(b.buffer,b.byteOffset,values.length*2));};
 const rotate=a=>call('glRotated',dwords(a));
 const top=()=>Array.from(new Float32Array(memory.buffer,e.gl_mtx_top_ptr(),16));
 function matrix(expected,label,tol=1e-6){const actual=top();actual.forEach((v,i)=>assert(Math.abs(v-expected[i])<=tol,label+'['+i+']: '+v+' != '+expected[i]));
  if(!queued&&e.probe_mode()<0){call('glFinish');const host=Array.from(bridge.contexts.get(context).frontend._matrix());host.forEach((v,i)=>assert(Math.abs(v-expected[i])<=tol,'host '+label+'['+i+']: '+v+' != '+expected[i]));}
  observations.push({label,actual,expected});checks++;}
 const I=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
 // Literal column-major matrices; none uses a production rotation/multiply helper.
 const R60=[.5555555556,.6884613803,-.4662391581,0,-.4662391581,.7222222222,.5108973568,0,.6884613803,-.0664529124,.7222222222,0,0,0,0,1];
 const R120=[0,1,0,0,0,0,1,0,1,0,0,0,0,0,0,1];
 const R180=[-.7777777778,.4444444444,.4444444444,0,.4444444444,-.1111111111,.8888888889,0,.4444444444,.8888888889,-.1111111111,0,0,0,0,1];
 const A=[2,0,0,0,0,3,0,0,0,0,4,0,.25,-.5,.75,1];
 const AR=[0,3,0,0,0,0,4,0,2,0,0,0,.25,-.5,.75,1];
 const ap=e.guest_alloc(128)>>>0;function load(a){a.forEach((v,i)=>dv.setFloat64(wa(ap)+i*8,v,true));call('glLoadMatrixd',[ap]);}

 // Real VM page records deliberately separate adjacent guest stack pages.
 for(const page of [0x60000000,0x61000000,0x60001000])assert(e.test_virtual_map_commit(page,4096));
 assert.notStrictEqual(wa(0x60001000)-wa(0x60000000),4096,'actual non-affine sparse stack');
 new Uint8Array(memory.buffer,wa(0x61000000),4096).fill(0x7f);
 const sparseStack=0x60000ff9,rotateThunk=resolve('glRotated');
 const frame=Buffer.alloc(52,0xa7);frame.writeUInt32LE(0x12345678,8);[60,1,2,2].forEach((v,i)=>frame.writeDoubleLE(v,12+i*8));
 for(let i=0;i<frame.length;i++)dv.setUint8(wa(sparseStack-8+i),frame[i]);
 load(I);for(let i=0;i<8;i++)dv.setUint32(regs+i*4,0x55660000+i,true);dv.setUint32(regs+16,sparseStack,true);
 e.probe_invoke(rotateThunk);assert.strictEqual(dv.getUint32(regs+16,true),sparseStack+36,'sparse ABI 32 argument bytes + return');
 for(let i=1;i<8;i++)if(i!==4)assert.strictEqual(dv.getUint32(regs+i*4,true),0x55660000+i,'sparse register canary');
 assert.deepStrictEqual(Buffer.from(Array.from({length:52},(_,i)=>dv.getUint8(wa(sparseStack-8+i)))),frame,'sparse stack and adjacent canaries');
 matrix(R60,'resolved actual non-affine double stack');
 // An absent final source page must fail before changing GL/register state.
 assert(e.test_virtual_map_commit(0x62000000,4096));assert.strictEqual(wa(0x62001000),240);
 const badStack=0x62000fe0;new Uint8Array(memory.buffer,wa(badStack),32).fill(0x5a);load(I);
 dv.setUint32(regs+16,badStack,true);dv.setUint32(regs,0xdeadbeef,true);
 assert.throws(()=>e.probe_invoke(rotateThunk),WebAssembly.RuntimeError);assert.strictEqual(dv.getUint32(regs+16,true),badStack);assert.strictEqual(dv.getUint32(regs,true),0xdeadbeef);matrix(I,'missing last double page atomic');
 const selected=[[0x1700,0],[0x1701,0],[0x1702,0],[0x1702,1]];
 // Each top is set to a different literal; test selection does not modify others.
 for(let i=0;i<selected.length;i++){const [mode,unit]=selected[i];call('glActiveTextureARB',[0x84c0+unit]);call('glMatrixMode',[mode]);load(I);}
 for(const [mode,unit] of selected){
  call('glActiveTextureARB',[0x84c0+unit]);call('glMatrixMode',[mode]);load(I);rotate([60,1,2,2]);matrix(R60,'selected '+mode+'/'+unit+' normalized arbitrary axis');
  call('glPushMatrix');load(A);rotate([120,1,1,1]);matrix(AR,'A*R selected '+mode+'/'+unit);call('glPopMatrix');matrix(R60,'pop selected '+mode+'/'+unit);
 }
 for(const [mode,unit] of selected){call('glActiveTextureARB',[0x84c0+unit]);call('glMatrixMode',[mode]);matrix(R60,'other stacks isolated');load(I);}
 call('glActiveTextureARB',[0x84c0]);call('glMatrixMode',[0x1700]);
 for(const [args,expected,label] of [
  [[120,1,1,1],R120,'120 degrees cyclic axis'],[[180,1,2,2],R180,'180 degrees oblique axis'],
  [[60,6,12,12],R60,'nonunit axis'],[[60,1e300,2e300,2e300],R60,'finite huge double axis'],
  [[60,1e-300,2e-300,2e-300],R60,'finite tiny double axis'],
  [[-90,0,0,7],[0,-1,0,0,1,0,0,0,0,0,1,0,0,0,0,1],'negative degrees'],
  [[90,0,0,-7],[0,-1,0,0,1,0,0,0,0,0,1,0,0,0,0,1],'negative axis']
 ]){load(I);rotate(args);matrix(expected,label);}
 load(I);rotate([90+2**-20,0,0,1]);const precise=top();
 assert(Math.abs(precise[0]-(-1.664475668405365e-8))<1e-12,'angle retained as f64 before trig');checks++;
 load(A);rotate([60,0,0,0]);matrix(A,'zero axis leaves selected matrix unchanged');
 load(I);call('glRotatef',[60,1,2,2].map(f));matrix(R60,'float spelling shares native matrix behavior');
 load(A);call('glRotatef',[60,0,0,0].map(f));matrix(A,'float zero axis consistent');
 // Stream owns full doubles, including values too tiny/large for f32.
 e.gl_wat_stream_flush();load(I);const scalars=[60,1e-300,2e-300,2e-300];rotate(scalars);
 const payload=[];Stream.replay(Stream.memoryBatch(memory,e.gl_wat_stream_base(),e.gl_wat_stream_used()),(op,aux,c)=>{
  if(op===GL.glRotated){const v=new DataView(c.buffer);payload.push([4,12,20,28].map(n=>v.getFloat64(c.stackOffset+n,true)));}return 0;});
 assert.deepStrictEqual(payload,[scalars],'encoder owns four full double values');checks++;
 // List definitions consume values now and select their destination at replay.
 const lists=[];
 for(const mode of [0x1300,0x1301]){load(I);const list=call('glGenLists',[1]);lists.push(list);
  call('glNewList',[list,mode]);rotate([60,1,2,2]);call('glEndList');matrix(mode===0x1300?I:R60,'list definition timing');
  rotate([17,5,6,7]); // overwrite original caller stack and free-list scratch.
  call('glMatrixMode',[0x1701]);load(I);call('glCallList',[list]);matrix(R60,'list captured values and replay selection');
  call('glMatrixMode',[0x1700]);load(I);
 }
 const nested=call('glGenLists',[1]);call('glNewList',[nested,0x1300]);call('glCallList',[lists[0]]);call('glEndList');call('glCallList',[nested]);matrix(R60,'nested list rotation');
 // Illegal rotation must reject before any matrix/vertex observer runs.
 for(const action of [()=>rotate([60,1,2,2]),()=>rotate([60,0,0,0]),()=>call('glRotatef',[60,1,2,2].map(f)),...lists.map(id=>()=>call('glCallList',[id]))]){
  load(I);call('glBegin',[4]);call('glVertex2f',[f(-.75),f(-.75)]);
  const count=e.probe_count(),mode=e.probe_mode(),at=e.probe_vertices(),before=Buffer.from(new Uint8Array(memory.buffer,at,count*4));
  assert.doesNotThrow(action,'illegal rotation returns GL error without trap');assert.strictEqual(e.probe_count(),count);assert.strictEqual(e.probe_mode(),mode);assert.deepStrictEqual(Buffer.from(new Uint8Array(memory.buffer,at,count*4)),before);matrix(I,'Begin matrix atomic');
  call('glVertex2f',[f(.75),f(-.75)]);call('glVertex2f',[f(-.75),f(.75)]);call('glEnd');assert.strictEqual(call('glGetError'),0x502);checks++;
 }
 for(const mode of [0x1300,0x1301]){const id=call('glGenLists',[1]);load(I);call('glNewList',[id,mode]);call('glBegin',[0]);rotate([60,1,2,2]);
  assert.strictEqual(call('glGetError'),0x502);call('glEnd');call('glEndList');call('glCallList',[id]);matrix(I,'list shadow Begin rejects rotation');}
 // Literal framebuffer coverage: asymmetric rectangle gives geometric order evidence.
 for(const [mode,unit] of selected){call('glActiveTextureARB',[0x84c0+unit]);call('glMatrixMode',[mode]);load(I);}
 call('glActiveTextureARB',[0x84c0]);call('glMatrixMode',[0x1700]);
 call('glViewport',[0,0,8,8]);call('glDrawBuffer',[0x405]);call('glReadBuffer',[0x405]);call('glPixelStorei',[0xd05,1]);
 const output=e.guest_alloc(264)>>>0,pix=new Uint8Array(memory.buffer,wa(output),264);
 const empty=['........','........','........','........','........','........','........','........'];
 const rotated=['........','........','..XX....','..XX....','..XX....','..XX....','........','........'];
 const red=[255,0,0,255],black=[0,0,0,255];
 function pixels(rows,label){call('glFinish');if(encoder)encoder.fence();pix.fill(0xa7);call('glReadPixels',[0,0,8,8,0x1908,0x1401,output+4]);
  assert.deepStrictEqual([...pix.slice(0,4)],[167,167,167,167]);assert.deepStrictEqual([...pix.slice(260)],[167,167,167,167]);
  const expected=rows.flatMap(row=>[...row].flatMap(c=>c==='X'?red:black));assert.deepStrictEqual([...pix.slice(4,260)],expected,label);observations.push({label,rgba:[...pix.slice(4,260)],expectedMask:rows});checks++;}
 const clear=()=>{call('glClearColor',[0,0,0,f(1)]);call('glClear',[0x4000]);};
 const rect=(bottom=0)=>{call('glColor4f',[f(1),0,0,f(1)]);call('glRectf',[-.5,bottom,.5,.5].map(f));};
 clear();load(I);rotate([90,0,0,2]);rect();pixels(rotated,'90 degree real asymmetric quad');
 // Literal inverse-rotated vertices land on x[-.5,0], y[-.5,.5].
 // This avoids coupling geometric pixel expectations to integer vertex rounding.
 const quad=vertices=>{call('glColor4f',[f(1),0,0,f(1)]);call('glBegin',[7]);for(const v of vertices)call('glVertex3f',v.map(f));call('glEnd');};
 clear();load(I);rotate([45,0,0,3]);quad([[-0.7071067811865475, 0.0, 0], [-0.35355339059327373, -0.35355339059327373, 0], [0.35355339059327373, 0.35355339059327373, 0], [0.0, 0.7071067811865475, 0]]);pixels(rotated,'45 degree literal vertices and pixels');
 clear();load(I);rotate([60,1,2,2]);quad([[-0.62200846795, -0.12799153205, -0.31100423395000004], [-0.34423069015, -0.3611111111, 0.0332264562], [0.34423069015, 0.3611111111, -0.0332264562], [0.06645291235, 0.59423069015, -0.37745714635]]);pixels(rotated,'60 degree oblique literal vertices and pixels');
 clear();load(I);rotate([180,1,1,0]);rect();pixels(['........','........','....XX..','....XX..','....XX..','....XX..','........','........'],'180 degree diagonal axis pixels');

 for(const mode of [0x1300,0x1301]){clear();load(I);const id=call('glGenLists',[1]);call('glNewList',[id,mode]);rotate([90,0,0,2]);rect();call('glEndList');pixels(mode===0x1300?empty:rotated,'list compile pixels');
  rotate([17,1,2,3]);clear();load(I);call('glCallList',[id]);pixels(rotated,'list snapshot real pixels');}
 // T*R and R*T move in different directions: literal masks below.
 clear();load(I);call('glTranslated',dwords([.5,0,0]));rotate([90,0,0,1]);rect();pixels(['........','........','....XX..','....XX..','....XX..','....XX..','........','........'],'T*R pixel order');
 clear();load(I);rotate([90,0,0,1]);call('glTranslated',dwords([.5,0,0]));rect();pixels(['........','........','........','........','..XX....','..XX....','..XX....','..XX....'],'R*T pixel order');
 assert(call('wglGetProcAddress',[str('glRotated')]),'WGL real availability remains');
 assert.strictEqual(call('glGetError'),0);if(encoder){encoder.fence();assert(encoder.snapshot().glQueued>0,'actual queue used');}
 assert.strictEqual(call('wglDeleteContext',[context]),1);
 const result={passed:true,route:queued?'queued':'direct',checks,mutation:mutation||null,observations};
 if(process.env.GL_ROTATED_EVIDENCE)fs.writeFileSync(process.env.GL_ROTATED_EVIDENCE,JSON.stringify(result,null,2));console.log(JSON.stringify({...result,observations:observations.length}));
 }finally{if(encoder)encoder.stop();if(manager)await manager.stop();if(render)render.destroy();}
})().catch(e=>{console.error(e);process.exitCode=1;});
