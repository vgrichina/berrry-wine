'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),req=p=>require(path.join(root,p));
const {bootRenderHarness}=req('test/render-helper');
const {OpenGLHostBridge}=req('lib/gl-compat');
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
 const queued=process.argv.includes('--worker');
 const mutation=process.env.GL_RECT_MUTATION;
 let prebuiltModule;
 if(mutation){
  let changed=false;
  const bytes=req('test/compile-src').compileSrcWasm((file,source)=>{
   if(file==='13-exports.wat')return source+extraWat;
   if(file!=='09a8b-handlers-opengl.wat')return source;
   const from=mutation==='corner'?'(local.get $x2) (local.get $y1)':
    '(i32.shr_s (i32.shl (call $gl16 (local.get $p)) (i32.const 16)) (i32.const 16))';
   const to=mutation==='corner'?'(local.get $x1) (local.get $y1)':'(call $gl16 (local.get $p))';
   assert(source.includes(from),'production mutation anchor');changed=true;return source.replace(from,to);
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
   const value=e.probe_invoke(p)>>>0;
   assert.strictEqual(dv.getUint32(regs+16,true),stack+4*(args.length+1),'stdcall '+name);
   for(let i=1;i<8;i++)if(i!==4)assert.strictEqual(dv.getUint32(regs+i*4,true),0x55660000+i,'register '+name);
   assert.deepStrictEqual(Buffer.from(new Uint8Array(memory.buffer,stackWa,256)),before,'stack '+name);
   return value;
 }
 const f=x=>{dv.setFloat32(stackWa+252,x,true);return dv.getUint32(stackWa+252,true);};


 // Pixel expectations below are literal viewport masks, independent of the
 // production polygon decomposition, conversion and rasterizer.
 let checks=0;
 const dc=e.probe_dc(42)>>>0,context=call('wglCreateContext',[dc]);assert(context);
 assert.strictEqual(call('wglMakeCurrent',[dc,context]),1);
 call('glViewport',[0,0,8,8]);call('glDrawBuffer',[0x405]);call('glReadBuffer',[0x405]);
 call('glPixelStorei',[0xd05,1]);
 const output=e.guest_alloc(264)>>>0,outWa=wa(output);
 const pixelBytes=new Uint8Array(memory.buffer,outWa,264);
 const black=[0,0,0,255],red=[255,0,0,255],green=[0,255,0,255],white=[255,255,255,255];
 const middle=['........','........','..XXXX..','..XXXX..','..XXXX..','..XXXX..','........','........'];
 const doubleMask=['........','........','........','..XXXXX.','..XXXXX.','..XXXXX.','........','........'];
 const shifted=['........','...XXXX.','...XXXX.','...XXXX.','...XXXX.','........','........','........'];
 const empty=Array(8).fill('........');
 const color=c=>call('glColor4f',c.map(x=>f(x/255)));
 const identity=()=>{call('glMatrixMode',[0x1700]);call('glLoadIdentity');};
 const scale=n=>call('glScalef',[f(n),f(n),f(1)]);
 const clear=()=>{call('glClearColor',[f(0),f(0),f(0),f(1)]);call('glClear',[0x4000]);};
 function pixels(){call('glFinish');if(encoder)encoder.fence();pixelBytes.fill(0xa7);
  call('glReadPixels',[0,0,8,8,0x1908,0x1401,output+4]);
  assert.deepStrictEqual(Array.from(pixelBytes.slice(0,4)),[167,167,167,167]);
  assert.deepStrictEqual(Array.from(pixelBytes.slice(260)),[167,167,167,167]);
  return Array.from(pixelBytes.slice(4,260));}
 function expected(mask,rgba){const out=[];for(const row of mask)for(const c of row)out.push(...(c==='X'?rgba:black));return out;}
 function expect(mask,rgba,label){assert.deepStrictEqual(pixels(),expected(mask,rgba),label);checks++;}
 function error(n,label){assert.strictEqual(call('glGetError'),n,label);checks++;}
 const rects=[
  {name:'glRectf',kind:'f',values:[-.5,-.5,.5,.5],s:1},
  {name:'glRectd',kind:'d',values:[-.5,-.25,.75,.5],s:1,mask:doubleMask},
  {name:'glRectdv',kind:'d',vector:true,values:[-.5,-.25,.75,.5],s:1,mask:doubleMask},
  {name:'glRectfv',kind:'f',vector:true,values:[-.5,-.5,.5,.5],s:1},
  {name:'glRecti',kind:'i',values:[-2147483648,-2147483648,2147483647,2147483647],s:2**-32},
  {name:'glRectiv',kind:'i',vector:true,values:[-2147483648,-2147483648,2147483647,2147483647],s:2**-32},
  {name:'glRects',kind:'s',values:[-32768,-32768,32767,32767],s:2**-16},
  {name:'glRectsv',kind:'s',vector:true,values:[-32768,-32768,32767,32767],s:2**-16},
 ];
 const widths={s:2,i:4,f:4,d:8},setters={s:'setInt16',i:'setInt32',f:'setFloat32',d:'setFloat64'};
 function rectangle(r,values=r.values,junk=false){
  const width=widths[r.kind],put=(at,x)=>dv[setters[r.kind]](at,x,true);
  if(r.vector){
   if(!r.p){
    const region=e.guest_alloc(8200)>>>0;
    // Both vectors are unaligned; first straddles a real guest page.
    r.p=region+4095-(region&4095);r.q=r.p+35;
   }
   values.forEach((x,i)=>put(wa((i<2?r.p:r.q)+(i%2)*width),x));
   const before=[r.p,r.q].map(p=>Buffer.from(new Uint8Array(memory.buffer,wa(p),width*2)));
   call(r.name,[r.p,r.q]);
   [r.p,r.q].forEach((p,i)=>assert.deepStrictEqual(Buffer.from(new Uint8Array(memory.buffer,wa(p),width*2)),before[i],r.name+' source unchanged'));
  }else{
   const b=new ArrayBuffer(width===8?32:16),v=new DataView(b);
   values.forEach((x,i)=>{
    if(r.kind==='s'){v.setUint32(i*4,junk?0xabcd0000:0,true);v.setInt16(i*4,x,true);}
    else v[setters[r.kind]](i*width,x,true);
   });call(r.name,Array.from(new Uint32Array(b)));
  }
 }
 function erasePointers(r){if(r.vector)for(const p of[r.p,r.q])new Uint8Array(memory.buffer,wa(p),widths[r.kind]*2).fill(0);}
 // glRectf remains the first genuine pixel control, including on old source.
 for(const r of rects){
  identity();scale(r.s);clear();color(red);rectangle(r);
  expect(r.mask||middle,red,r.name+' signed/width/direct pixels');error(0,r.name);
  const list=call('glGenLists',[1]);r.list=list;
  clear();call('glNewList',[list,0x1300]);rectangle(r);call('glEndList');
  expect(empty,red,r.name+' COMPILE defers execution');erasePointers(r);
  color(green);call('glCallList',[list]);
  expect(r.mask||middle,green,r.name+' list snapshots values/replay current color');
  clear();call('glNewList',[list,0x1301]);color(red);rectangle(r);call('glEndList');
  expect(r.mask||middle,red,r.name+' COMPILE_AND_EXECUTE');
  clear();erasePointers(r);call('glCallList',[list]);expect(r.mask||middle,red,r.name+' repeated list replay');error(0,r.name+' lists');
  if(r.name==='glRectf')console.log(JSON.stringify({stage:'glRectf-positive-control',passed:true,route:queued?'queued':'direct'}));
 }
 // The signed low16 bits are authoritative even when scalar DWORD upper bits
 // contain unrelated data. Other negative/positive endpoints are checked too.
 for(const r of rects.filter(r=>r.kind==='s'||r.kind==='i')){
  identity();scale(.5);clear();color(red);rectangle(r,[-1,-1,1,1],r.kind==='s');
  expect(middle,red,r.name+' +/-1 and scalar upper-word junk');
 }
 // Reversed corners retain geometric ordering and signed winding.
 const small={name:'glRecti',kind:'i',values:[-1,-1,1,1],s:.5};
 identity();scale(.5);call('glEnable',[0xb44]);call('glCullFace',[0x405]);call('glFrontFace',[0x901]);
 for(const [a,mask]of[[[-1,-1,1,1],middle],[[1,-1,-1,1],empty],[[1,1,-1,-1],middle]]){
  clear();rectangle(small,a);expect(mask,red,'winding '+a);
 }call('glDisable',[0xb44]);
 clear();rectangle(small,[0,-1,0,1]);expect(empty,red,'zero-width rectangle');
 // Preserve canonical behavior for horizontal degenerate geometry too. The
 // existing software scanline path can produce a row here; fixing polygon
 // degeneracy belongs to the rasterizer, outside these ABI aliases.
 clear();rectangle({name:'glRectf',kind:'f'},[-1,0,1,0]);const canonicalDegenerate=pixels();
 clear();rectangle(small,[-1,0,1,0]);assert.deepStrictEqual(pixels(),canonicalDegenerate,'horizontal degenerate glRectf parity');checks++;
 // Server transforms are read at replay, after pointers and caller stack changed.
 const normalized=rects.find(r=>r.name==='glRectfv'),transformList=call('glGenLists',[1]);
 identity();call('glTranslatef',[f(-.5),f(0),f(0)]);
 call('glNewList',[transformList,0x1300]);rectangle(normalized);call('glEndList');erasePointers(normalized);
 identity();call('glTranslatef',[f(.25),f(-.25),f(0)]);clear();color(green);call('glCallList',[transformList]);
 expect(shifted,green,'list replay modelview transform and current color');
 // Texture coordinates remain current attributes of every rectangle vertex.
 identity();const texels=e.guest_alloc(8)>>>0;
 new Uint8Array(memory.buffer,wa(texels),8).set([255,0,0,255,0,255,0,255]);
 call('glBindTexture',[0xde1,71]);call('glPixelStorei',[0xcf5,1]);
 call('glTexParameteri',[0xde1,0x2800,0x2600]);call('glTexParameteri',[0xde1,0x2801,0x2600]);
 call('glTexImage2D',[0xde1,0,0x1908,2,1,0,0x1908,0x1401,texels]);
 call('glEnable',[0xde1]);color(white);
 const attrList=call('glGenLists',[1]);
 call('glTexCoord2f',[f(.25),f(.5)]);call('glNewList',[attrList,0x1300]);rectangle(normalized);call('glEndList');
 for(const [s,c]of[[.25,red],[.75,green]]){clear();call('glTexCoord2f',[f(s),f(.5)]);call('glCallList',[attrList]);expect(middle,c,'replay current texture '+s);}
 call('glDisable',[0xde1]);
 // Current normal controls real fixed-function lighting, including list replay.
 const vector=e.guest_alloc(16)>>>0,vec=a=>new Float32Array(memory.buffer,wa(vector),4).set(a);
 vec([0,0,1,0]);call('glLightfv',[0x4000,0x1203,vector]);
 vec([1,1,1,1]);call('glLightfv',[0x4000,0x1201,vector]);
 vec([0,0,0,1]);call('glLightModelfv',[0xb53,vector]);call('glMaterialfv',[0x408,0x1200,vector]);
 call('glMaterialfv',[0x408,0x1600,vector]);vec([0,1,0,1]);call('glMaterialfv',[0x408,0x1201,vector]);
 call('glEnable',[0xb50]);call('glEnable',[0x4000]);
 for(const [z,c]of[[1,green],[-1,black]]){clear();call('glNormal3f',[f(0),f(0),f(z)]);call('glCallList',[attrList]);expect(middle,c,'replay current normal '+z);}
 call('glDisable',[0xb50]);call('glDisable',[0x4000]);error(0,'attribute pixels');
 // Direct and list misuse must preserve caller primitive bytes, count and mode.
 identity();color(red);
 for(const r of rects)for(const replay of[false,true]){
  clear();call('glBegin',[4]);call('glVertex2f',[f(-.75),f(-.75)]);
  const count=e.probe_count(),mode=e.probe_mode(),at=e.probe_vertices();
  const pending=Buffer.from(new Uint8Array(memory.buffer,at,count*4));
  if(replay)call('glCallList',[r.list]);else rectangle(r);
  assert.strictEqual(e.probe_count(),count,r.name+' pending count');assert.strictEqual(e.probe_mode(),mode,r.name+' pending mode');
  assert.deepStrictEqual(Buffer.from(new Uint8Array(memory.buffer,at,count*4)),pending,r.name+' pending bytes');
  call('glVertex2f',[f(.75),f(-.75)]);call('glVertex2f',[f(-.75),f(.75)]);call('glEnd');error(0x502,r.name+' invalid Begin replay='+replay);
  const p=pixels();assert.deepStrictEqual(p.slice((2*8+2)*4,(2*8+2)*4+4),red,'caller triangle interior');
  assert.deepStrictEqual(p.slice((6*8+6)*4,(6*8+6)*4+4),black,'caller triangle exterior');checks++;
 }
 // Retain existing shadow-Begin compilation behavior of the canonical command.
 for(const r of rects){const id=call('glGenLists',[1]);clear();call('glNewList',[id,0x1300]);call('glBegin',[7]);rectangle(r);
  error(0x502,r.name+' compile shadow Begin');call('glEnd');call('glEndList');call('glCallList',[id]);expect(empty,red,r.name+' rejected compile draws nothing');error(0,r.name+' shadow clean');}
 // Same pixel assertions reject independently wrong masks and corrupted pixels.
 clear();rectangle(normalized);const actual=pixels();
 assert.throws(()=>assert.deepStrictEqual(actual,expected(empty,red)),assert.AssertionError);
 const corrupt=actual.slice();corrupt[(3*8+3)*4]=0;
 assert.throws(()=>assert.deepStrictEqual(corrupt,expected(middle,red)),assert.AssertionError);
 // Bad/wrapped second vectors trap before any rectangle or stdcall result is
 // committed. A valid first vector must not leak a partial primitive.
 for(const r of rects.filter(r=>r.vector)){
  const thunk=resolve(r.name),count=e.probe_count(),mode=e.probe_mode();
  dv.setUint32(regs+16,stack,true);dv.setUint32(regs,0xdeadbeef,true);
  dv.setUint32(stackWa+4,r.p,true);dv.setUint32(stackWa+8,0xffffffff,true);
  assert.throws(()=>e.probe_invoke(thunk),WebAssembly.RuntimeError,r.name+' pointer wrap');
  assert.strictEqual(dv.getUint32(regs+16,true),stack);assert.strictEqual(dv.getUint32(regs,true),0xdeadbeef);
  assert.strictEqual(e.probe_count(),count);assert.strictEqual(e.probe_mode(),mode);checks++;
 }
 const aliases=rects.map(r=>r.name);
 for(const name of aliases){assert(call('wglGetProcAddress',[str(name)]),'WGL real alias '+name);}
 const rejected=['glRect','glRectx','glrecti','wglShareLists'];
 for(const name of rejected){const before=e.probe_thunks();dv.setUint32(regs+16,stack,true);
  assert.strictEqual(e.probe_lookup(module,str(name)),0,'static rejects '+name);
  // Known unavailable APIs set ERROR_PROC_NOT_FOUND; unknown names only promise NULL.
  if(table.some(a=>a.name===name))assert.strictEqual(e.probe_error(),127,name);
  assert.strictEqual(e.probe_thunks(),before,'no thunk allocated');
  assert.strictEqual(call('wglGetProcAddress',[str(name)]),0,'WGL rejects '+name);}
 if(encoder){encoder.fence();assert(encoder.snapshot().glQueued>=1,'actual queued raster execution');}
 error(0,'final');assert.strictEqual(call('wglDeleteContext',[context]),1);
 console.log(JSON.stringify({stage:'complete',passed:true,route:queued?'queued':'direct',aliases,checks,negativeControls:2,mutation:mutation||null}));
 }finally{if(encoder)encoder.stop();if(manager)await manager.stop();if(render)render.destroy();}
})().catch(e=>{console.error(e);process.exitCode=1;});

