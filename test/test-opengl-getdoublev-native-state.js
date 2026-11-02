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
// Resolve and execute the real stdcall ABI, including output byte canaries.
(async()=>{
 let memory,bridge,encoder=null,manager=null,render=null,producer=null;
 const queued=process.argv.includes('--worker');
 const h=await bootRenderHarness({extraWat,fonts:'none',width:8,height:8,
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
 const dc=e.probe_dc(42)>>>0,context=call('wglCreateContext',[dc]);assert(context);
 assert.strictEqual(call('wglMakeCurrent',[dc,context]),1);
 const out=e.guest_alloc(256)>>>0,ow=wa(out),at=out+19;
 const expected=[];let checks=0;
 function query(name,p,want){
  new Uint8Array(memory.buffer,ow,256).fill(0xa7);
  call(name,[p,at]);const width=name==='glGetDoublev'?8:4;
  const got=want.map((_,i)=>name==='glGetDoublev'?dv.getFloat64(wa(at+i*width),true):
   name==='glGetFloatv'?dv.getFloat32(wa(at+i*width),true):dv.getInt32(wa(at+i*width),true));
  assert.deepStrictEqual(got,want,name+' '+p.toString(16));
  assert(new Uint8Array(memory.buffer,ow,19).every(b=>b===0xa7),'leading canary');
  assert(new Uint8Array(memory.buffer,wa(at)+want.length*width,256-19-want.length*width).every(b=>b===0xa7),'trailing canary');
  assert.strictEqual(call('glGetError'),0,'no query error');checks++;expected.push({name,p,got});
 }
 const q=(p,want)=>query('glGetDoublev',p,want);
 const doubles=xs=>xs.flatMap(x=>{const b=Buffer.alloc(8);b.writeDoubleLE(x);return [b.readUInt32LE(),b.readUInt32LE(4)];});
 function noWrite(p,error=0x500){new Uint8Array(memory.buffer,ow,256).fill(0xa7);call('glGetDoublev',[p,at]);
  assert(new Uint8Array(memory.buffer,ow,256).every(b=>b===0xa7));return error;}
 if(process.argv.includes('--legacy-gap')||process.argv.includes('--legacy-integer-gap')){
  if(!process.argv.includes('--legacy-integer-gap')){
   call('glViewport',[-3,5,17,19]);query('glGetFloatv',0xba2,[-3,5,17,19]);
  }
  call('glMatrixMode',[0x1702]);query('glGetIntegerv',0xba0,[0x1702]);
  console.log(JSON.stringify({passed:true,route:queued?'queued':'direct',legacyChecks:checks}));return;
 }
 assert(resolve('glGetDoublev'),'genuine native resolver');
 q(0xba2,[0,0,8,8]);q(0xc10,[0,0,8,8]);
 for(const p of [0xd52,0xd53,0xd54,0xd55,0xd57])q(p,[8]);
 q(0xd56,[16]);q(0xc31,[1]);q(0xc32,[1]);q(0xc33,[0]);q(0xc00,[0]);
 for(const p of [0xb90,0xbe2,0xbc0,0xb71,0xb44,0xc11,0xb60,0xb50,0xb57,0xde1,
   0x4000,0x4001,0x4002,0x4003,0x4004,0x4005,0x4006,0x4007])q(p,[0]);
 for(const [p,v] of [[0xbe1,1],[0xbe0,0],[0xbc1,0x207],[0xb74,0x201],[0xb72,1],
   [0xb45,0x405],[0xb46,0x901],[0xb11,1],[0xb21,1],[0xb65,0x800],
   [0xb62,1],[0xb63,0],[0xb64,1],[0xbb0,0],[0xbb1,0],[0xb30,0],[0xb33,0],
   [0xb32,0],[0xb08,1],[0xc01,0x405],[0xc02,0x405]])q(p,[v]);
 q(0xb66,[0,0,0,0]);q(0xb53,[0.20000000298023224,0.20000000298023224,0.20000000298023224,1]);
 q(0xb93,[4294967295]);q(0xb98,[4294967295]);
 for(const p of [0x807a,0x8081,0x8088])q(p,[4]);
 for(const p of [0x807b,0x807e,0x8082,0x8089])q(p,[0x1406]);
 for(const p of [0x807c,0x807f,0x8083,0x808a,0x8074,0x8075,0x8076,0x8078])q(p,[0]);
 const wglDouble=call('wglGetProcAddress',[str('glGetDoublev')]);assert(wglDouble);
 assert.strictEqual(dv.getUint32(wa(wglDouble)+4,true),dv.getUint32(wa(resolve('glGetDoublev'))+4,true));
 cache.set('glGetDoublev',wglDouble);q(0xba0,[0x1700]);
 call('glMatrixMode',[0x1700]);call('glLoadIdentity');
 call('glTranslated',doubles([2,-3,4]));call('glScaled',doubles([2,3,-4]));
 q(0xba6,[2,0,0,0,0,3,0,0,0,0,-4,0,2,-3,4,1]);q(0xba0,[0x1700]);q(0xba3,[1]);
 call('glPushMatrix');q(0xba3,[2]);call('glPopMatrix');q(0xba3,[1]);
 call('glMatrixMode',[0x1701]);call('glLoadIdentity');call('glOrtho',doubles([-2,6,-4,4,1,9]));
 q(0xba7,[.25,0,0,0,0,.25,0,0,0,0,-.25,0,-.5,0,-1.25,1]);
 call('glMatrixMode',[0x1702]);call('glActiveTextureARB',[0x84c0]);call('glLoadIdentity');call('glTranslated',doubles([.5,-.25,2]));
 call('glActiveTextureARB',[0x84c1]);call('glLoadIdentity');call('glScaled',doubles([4,.5,-2]));
 q(0xba8,[4,0,0,0,0,.5,0,0,0,0,-2,0,0,0,0,1]);q(0x84e0,[0x84c1]);
 call('glActiveTextureARB',[0x84c0]);q(0xba8,[1,0,0,0,0,1,0,0,0,0,1,0,.5,-.25,2,1]);
 // Real sparse guest pages with an intervening physical allocation. One
 // binary64 component straddles the nonadjacent page boundary.
 const sparse=0x42000000;
 for(const p of [sparse,0x43000000,sparse+4096])assert.strictEqual(e.probe_sparse_page(p)>>>0,p);
 assert.notStrictEqual(wa(sparse+4096),wa(sparse)+4096,'physical pages are nonadjacent');
 const split=sparse+4093, literal=[1,0,0,0,0,1,0,0,0,0,1,0,.5,-.25,2,1];
 for(let i=-9;i<137;i++)dv.setUint8(wa(split+i),0xa7);
 call('glGetDoublev',[0xba8,split]);
 const splitBytes=Buffer.from(Array.from({length:128},(_,i)=>dv.getUint8(wa(split+i))));
 assert.deepStrictEqual(literal.map((_,i)=>splitBytes.readDoubleLE(i*8)),literal);
 for(const i of [-9,-1,128,136])assert.strictEqual(dv.getUint8(wa(split+i)),0xa7);checks++;
 assert.strictEqual(e.probe_sparse_page(0x44000000)>>>0,0x44000000);
 const missing=0x44000ffd;
 for(let i=-9;i<3;i++)dv.setUint8(wa(missing+i),0xb6);
 dv.setUint32(regs+16,stack,true);dv.setUint32(stackWa,0x12345678,true);
 dv.setUint32(stackWa+4,0xba8,true);dv.setUint32(stackWa+8,missing,true);
 assert.throws(()=>e.probe_invoke(resolve('glGetDoublev')),WebAssembly.RuntimeError);
 assert.strictEqual(dv.getUint32(regs+16,true),stack,'trap preserves stack');
 for(let i=-9;i<3;i++)assert.strictEqual(dv.getUint8(wa(missing+i)),0xb6,'validate before any write');checks++;
 call('glColor4f',[-.25,.5,.75,1].map(f));q(0xb00,[-.25,.5,.75,1]);
 call('glColor4f',[.1,.5,.75,1].map(f));q(0xb00,[0.10000000149011612,.5,.75,1]);
 call('glColor4f',[-.25,.5,.75,1].map(f));
 call('glNormal3f',[.5,-.25,.75].map(f));q(0xb02,[.5,-.25,.75]);
 call('glTexCoord4f',[2,-3,.5,4].map(f));q(0xb03,[2,-3,.5,4]);
 call('glMultiTexCoord4fARB',[0x84c1,...[-.5,.25,3,2].map(f)]);
 call('glActiveTextureARB',[0x84c1]);q(0xb03,[-.5,.25,3,2]);
 call('glColorMask',[0,1,255,0]);q(0xc23,[0,1,1,0]);
 call('glViewport',[-3,5,17,19]);q(0xba2,[-3,5,17,19]);
 call('glDepthRange',doubles([-.5,2]));q(0xb70,[0,1]);
 call('glDepthRange',doubles([.75,.25]));q(0xb70,[.75,.25]);
 call('glScissor',[1,2,3,4]);q(0xc10,[1,2,3,4]);
 call('glEnable',[0xbe2]);q(0xbe2,[1]);call('glDisable',[0xbe2]);q(0xbe2,[0]);
 call('glBlendFunc',[0x302,0x303]);q(0xbe1,[0x302]);q(0xbe0,[0x303]);
 call('glBlendFunc',[1,0]);
 call('glPointSize',[f(2.5)]);q(0xb11,[2.5]);call('glLineWidth',[f(1.5)]);q(0xb21,[1.5]);
 call('glPointSize',[f(1)]);call('glLineWidth',[f(1)]);
 call('glBindTexture',[0xde1,17]);q(0x8069,[17]);
 call('glActiveTextureARB',[0x84c0]);q(0x8069,[0]);call('glBindTexture',[0xde1,29]);q(0x8069,[29]);
 call('glActiveTextureARB',[0x84c1]);q(0x8069,[17]);
 call('glStencilMask',[0x80000001]);q(0xb98,[2147483649]);
 call('glStencilFunc',[0x204,73,0xffffffff]);q(0xb93,[4294967295]);q(0xb97,[73]);
 call('glClearAccum',[-.25,.5,.75,-1].map(f));q(0xb80,[-.25,.5,.75,-1]);
 for(const p of [0xd58,0xd59,0xd5a,0xd5b])q(p,[32]);
 call('glPixelStorei',[0xcf5,8]);q(0xcf5,[8]);q(0x84e2,[2]);q(0xd31,[8]);
 q(0xd33,[2048]);q(0xb31,[64]);
 for(const p of [0xd36,0xd38,0xd39])q(p,[32]);q(0xd35,[16]);q(0xd3b,[16]);
 call('glMatrixMode',[0xdead]);assert.strictEqual(call('glGetError'),0x500);q(0xba0,[0x1702]);
 call('glActiveTextureARB',[0x84c2]);assert.strictEqual(call('glGetError'),0x500);q(0x84e0,[0x84c1]);
 call('glViewport',[0,0,-1,9]);assert.strictEqual(call('glGetError'),0x501);q(0xba2,[-3,5,17,19]);
 call('glScissor',[0,0,9,-1]);assert.strictEqual(call('glGetError'),0x501);q(0xc10,[1,2,3,4]);
 call('glClientActiveTextureARB',[0x84c1]);q(0x84e1,[0x84c1]);
 call('glTexCoordPointer',[3,0x1406,24,out]);q(0x8088,[3]);q(0x8089,[0x1406]);q(0x808a,[24]);
 call('glEnableClientState',[0x8078]);q(0x8078,[1]);
 call('glClientActiveTextureARB',[0x84c0]);q(0x8088,[4]);q(0x808a,[0]);q(0x8078,[0]);
 query('glGetIntegerv',0xb98,[-2147483647]);
 query('glGetIntegerv',0xb70,[1610612735,536870911]);
 query('glGetFloatv',0xba2,[-3,5,17,19]);query('glGetIntegerv',0xba0,[0x1702]);
 for(const p of [0xdeadbeef,0x8b8d,0x8894]){noWrite(p);assert.strictEqual(call('glGetError'),0x500);}
 call('glBegin',[0]);noWrite(0xba6);noWrite(0xdeadbeef);call('glEnd');assert.strictEqual(call('glGetError'),0x502);
 // Host state must be observed without an explicit stream flush before query.
 call('glClearColor',[.125,.25,.5,.75].map(f));q(0xc22,[.125,.25,.5,.75]);
 call('glClearDepth',doubles([.125]));q(0xb73,[.125]);
 call('glClearDepth',doubles([.125+2**-40]));q(0xb73,[.125+2**-40]);
 call('glAlphaFunc',[0x204,f(.375)]);q(0xbc2,[.375]);
 call('glClearColor',[-.5,2,.25,.5].map(f));q(0xc22,[0,1,.25,.5]);
 call('glClearDepth',doubles([2]));q(0xb73,[1]);
 call('glAlphaFunc',[0x207,f(-.25)]);q(0xbc2,[0]);
 call('glClearColor',[.125,.25,.5,.75].map(f));
 call('glClearDepth',doubles([.125]));
 const other=call('wglCreateContext',[dc]);assert.strictEqual(call('wglMakeCurrent',[dc,other]),1);
 q(0xba0,[0x1700]);q(0xb00,[1,1,1,1]);q(0xb02,[0,0,1]);q(0xb03,[0,0,0,1]);
 q(0xc22,[0,0,0,0]);q(0xb73,[1]);q(0xb80,[0,0,0,0]);
 assert.strictEqual(call('wglMakeCurrent',[dc,context]),1);q(0xba0,[0x1702]);q(0xb00,[-.25,.5,.75,1]);
 call('wglDeleteContext',[other]);
 const list=call('glGenLists',[1]);call('glNewList',[list,0x1300]);
 call('glColor4f',[1,0,0,1].map(f));q(0xb00,[-.25,.5,.75,1]);call('glEndList');
 call('glCallList',[list]);q(0xb00,[1,0,0,1]);
 // Get executes immediately even while a list records a Begin/End pair.
 call('glNewList',[list+1,0x1300]);call('glBegin',[0]);q(0xb00,[1,0,0,1]);
 q(0xc22,[.125,.25,.5,.75]);call('glEnd');call('glEndList');
 new Uint8Array(memory.buffer,ow,256).fill(0xb6);call('glCallList',[list]);
 assert(new Uint8Array(memory.buffer,ow,256).every(b=>b===0xb6),'query never recorded output pointer');
 for(const n of ['glMap1d','wglShareLists'])assert.strictEqual(call('wglGetProcAddress',[str(n)]),0);
 assert.strictEqual(call('glGetError'),0);
 // A real queued draw ensures the worker route is exercised, and host query
 // replay must consume the preceding setters synchronously.
 call('glDisable',[0xc11]);call('glDisable',[0xb90]);call('glDisable',[0xde1]);
 call('glActiveTextureARB',[0x84c0]);call('glDisable',[0xde1]);
 call('glColorMask',[1,1,1,1]);call('glDrawBuffer',[0x405]);call('glReadBuffer',[0x405]);
 call('glViewport',[0,0,8,8]);call('glDepthRange',doubles([0,1]));
 for(const mode of [0x1700,0x1701]){call('glMatrixMode',[mode]);call('glLoadIdentity');}
 call('glClearColor',[0,0,0,f(1)]);call('glClear',[0x4000]);
 call('glColor4f',[f(1),0,0,f(1)]);call('glRectf',[-1,-1,1,1].map(f));
 call('glClearColor',[.5,.25,.125,1].map(f));q(0xc22,[.5,.25,.125,1]);
 call('glPixelStorei',[0xd05,1]);new Uint8Array(memory.buffer,ow,256).fill(0xa7);
 call('glReadPixels',[4,4,1,1,0x1908,0x1401,at]);
 assert.deepStrictEqual(Array.from(new Uint8Array(memory.buffer,wa(at),4)),[255,0,0,255]);
 assert(new Uint8Array(memory.buffer,ow,19).every(b=>b===0xa7));
 assert(new Uint8Array(memory.buffer,wa(at)+4,233).every(b=>b===0xa7));
 if(encoder){encoder.fence();assert(encoder.snapshot().glQueued>=1,'actual queued draw');}
 console.log(JSON.stringify({passed:true,route:queued?'queued':'direct',checks}));
 if(process.env.GL_GETDOUBLE_EVIDENCE)fs.writeFileSync(process.env.GL_GETDOUBLE_EVIDENCE,JSON.stringify({queued,checks,expected},null,2));
 }finally{if(encoder)encoder.stop();if(manager)await manager.stop();if(render)render.destroy();}
})().catch(error=>{console.error(error);process.exitCode=1;});
