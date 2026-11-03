'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const root=process.env.WINE_ROOT||'/home/user/wine-assembly',req=p=>require(path.join(root,p));
const {bootRenderHarness}=req('test/render-helper');
const Stream=req('lib/gl-command-stream');
const extraWat=`
 (func (export "eval_data") (result i32) (global.get $gl_immediate_wa))
 (func (export "eval_count") (result i32) (i32.div_u (global.get $gl_immediate_floats) (i32.const 28)))
 (func (export "eval_dynamic") (param $p i32) (result i32)
  (local $esp i32) (local $answer i32)
  (local.set $esp (i32.load offset=16 (global.get $reg_base)))
  (call $handle_gpu_api (i32.const 50) (i32.const 1) (local.get $p) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
  (local.set $answer (i32.load (global.get $reg_base)))
  (i32.store offset=16 (global.get $reg_base) (local.get $esp)) (local.get $answer))
 (func (export "eval_pending") (result i32) (global.get $d3dim_worker_pending))
 (func (export "eval_init")
   (global.set $thunk_guest_base (i32.add (global.get $image_base) (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
   (call $update_thunk_end))
 (func (export "eval_regs") (result i32) (global.get $reg_base))
 (func (export "eval_module") (param $name i32) (result i32)
   (call $handle_LoadLibraryA (local.get $name) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "eval_lookup") (param $module i32) (param $name i32) (result i32)
   (call $handle_GetProcAddress (local.get $module) (local.get $name) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "eval_invoke") (param $thunk i32) (result i32)
   (call $win32_dispatch (i32.div_u (i32.sub (local.get $thunk) (global.get $thunk_guest_base)) (i32.const 8))) (i32.load (global.get $reg_base)))(func (export "eval_dc") (result i32)
 (call $handle_GetDC (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
 (drop (call $gdi_dc_set_field (i32.load (global.get $reg_base)) (i32.const 92) (i32.const 42) (i32.const 0)))
 (i32.load (global.get $reg_base)))`;
(async()=>{
 const queued=process.argv.includes('--worker');let encoder=null,manager=null,bridge=null,render=null,producer=null,memory;
 let prebuiltModule=null;const batches=[],cases={},lightingChecks=[],lightingFailures=[];
 const recordModule=bytes=>{
  const sha256=require('crypto').createHash('sha256').update(bytes).digest('hex');
  console.log('EVAL_MODULE_SHA256',sha256,'bytes',bytes.length);
  if(process.env.GL_EVAL_MODULE_OUT)fs.writeFileSync(process.env.GL_EVAL_MODULE_OUT,bytes);
 };
 if(process.env.GL_EVAL_MUTATION){
  const mutation=JSON.parse(fs.readFileSync(process.env.GL_EVAL_MUTATION));let applied=false;
  const bytes=req('test/compile-src').compileSrcWasm((file,source)=>{
   if(file===mutation.file){assert.strictEqual(source.split(mutation.from).length-1,1,'unique mutation');source=source.replace(mutation.from,mutation.to);applied=true;}
   return file==='13-exports.wat'?source+extraWat:source;
  });assert(applied);recordModule(bytes);prebuiltModule=new WebAssembly.Module(bytes);
 }
 if(!prebuiltModule){
  const bytes=req('test/compile-src').compileSrcWasm((file,source)=>file==='13-exports.wat'?source+extraWat:source);
  recordModule(bytes);prebuiltModule=new WebAssembly.Module(bytes);
 }
 const h=await bootRenderHarness({fonts:'none',...(prebuiltModule?{prebuiltModule}:{extraWat}),width:64,height:64,extraHostOverrides:{gpu_gl_call(op,at,bytes){
  if(op===Stream.WAT_STREAM_FLUSH_OPCODE){
   const batch=Stream.memoryBatch(memory,at,bytes);let lifecycle=false;
   Stream.replay(batch,op=>{if(op===48||op===51)lifecycle=true;});
   if(!lifecycle)batches.push(Array.from(new Uint8Array(memory.buffer,at,bytes)));
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
  // Keep whole polygon records and their state in the actual Worker queue.
  encoder=new Encoder({module:h.module,memory,sigs:req('lib/host-import-sigs.generated.json').sigs,getImageBase:()=>e.get_image_base()>>>0,guestToWasm:wa,workerFactory:()=>port,capacity:0x400000,explicitFence:true,strictReady:true});assert(encoder.ready());
 }
 try {
 e.eval_init();const regs=e.eval_regs(),stackGuest=e.guest_alloc(256)>>>0,stack=wa(stackGuest),input=e.guest_alloc(1024)>>>0,output=e.guest_alloc(1024)>>>0;
 function str(s){const p=e.guest_alloc(s.length+1)>>>0;new Uint8Array(memory.buffer,wa(p),s.length+1).set(Buffer.from(s+'\0'));return p;}
 const module=e.eval_module(str('opengl32.dll'));assert(module);const resolved=new Map(),table=req('src/api_table.json');
 function call(name,args=[],float=false,route='static'){
  const key=name+route;
  if(!resolved.has(key)){dv.setUint32(regs+16,stackGuest,true);const p=(route==='dynamic'?e.eval_dynamic(str(name)):e.eval_lookup(module,str(name)))>>>0;assert(p,'real export '+name);assert.strictEqual(dv.getUint32(wa(p)+4,true),table.find(a=>a.name===name).id);resolved.set(key,p);}
  for(let i=0;i<8;i++)dv.setUint32(regs+i*4,0x55660000+i,true);
  dv.setUint32(regs+16,stackGuest,true);new Uint8Array(memory.buffer,stack,256).fill(0xa5);
  dv.setUint32(stack,0x12345678,true);args.forEach((v,i)=>(float===true||Array.isArray(float)&&float.includes(i))?dv.setFloat32(stack+4+i*4,v,true):dv.setUint32(stack+4+i*4,v>>>0,true));
  const before=Buffer.from(new Uint8Array(memory.buffer,stack,256)),value=e.eval_invoke(resolved.get(key))>>>0;
  assert.strictEqual(dv.getUint32(regs+16,true),stackGuest+4*(args.length+1),'stdcall '+name);
  for(let i=1;i<8;i++)if(i!==4)assert.strictEqual(dv.getUint32(regs+i*4,true),0x55660000+i,'register '+name);
  assert.deepStrictEqual(Buffer.from(new Uint8Array(memory.buffer,stack,256)),before,'stack canary '+name);return value;
 }
 const dc=e.eval_dc()>>>0,context=call('wglCreateContext',[dc]);assert(context);assert.strictEqual(call('wglMakeCurrent',[dc,context]),1);e.gl_sw_set_default_size(64,64);
 call('glViewport',[0,0,64,64]);e.gl_mtx_set_mode(0x1701);e.gl_mtx_load_identity();e.gl_mtx_ortho(0,64,0,64,-1,1);e.gl_mtx_set_mode(0x1700);e.gl_mtx_load_identity();
 call('glColor4f',[1,1,1,1],true);call('glClearColor',[0,0,0,1],true);

 const clear=()=>call('glClear',[0x4500]);
 const draw=(mode,pts,flags)=>{call('glBegin',[mode]);pts.forEach((p,i)=>{if(flags)call('glEdgeFlag',[flags[i%flags.length]]);call(p.length===3?'glVertex3f':'glVertex2f',p,true);});call('glEnd');};
 const pixel=(x,y)=>{const entry=e.gl_sw_entry()>>>0,pitch=dv.getUint16(entry+18,true),height=dv.getUint16(entry+14,true),dib=dv.getUint32(entry+20,true);return dv.getUint32(dib+(height-1-y)*pitch+4*x,true)&0xffffff;};
 const region=(x,y,r=1)=>{if(encoder)encoder.fence();let count=0;for(let a=x-r;a<=x+r;a++)for(let b=y-r;b<=y+r;b++)if(a>=0&&a<64&&b>=0&&b<64&&pixel(a,b))count++;return count;};
 const take=name=>{e.gl_wat_stream_flush();if(encoder)encoder.fence();cases[name]=batches.splice(0);
  if(process.env.GL_EVAL_PIXELS&&name!=='setup'){
   const {PNG}=require('pngjs'),png=new PNG({width:64,height:64});
   for(let y=0;y<64;y++)for(let x=0;x<64;x++){const v=pixel(x,63-y),i=(y*64+x)*4;png.data.set([(v>>>16)&255,(v>>>8)&255,v&255,255],i);}
   fs.mkdirSync(process.env.GL_EVAL_PIXELS,{recursive:true});fs.writeFileSync(path.join(process.env.GL_EVAL_PIXELS,name+'.png'),PNG.sync.write(png));
  }
 };
 const query=p=>{call('glGetIntegerv',[p,output]);return dv.getInt32(wa(output),true);};
 const G={v1:0xd97,v14:0xd98,v2:0xdb7,v24:0xdb8,c1:0xd90,c2:0xdb0,n2:0xdb2,auto:0xd80};
 let a;
 const cp=e.guest_alloc(8192)>>>0,vec=e.guest_alloc(64)>>>0;
 const near=(a,b,why,tol=2e-5)=>assert(Math.abs(a-b)<tol,why+': '+a+' != '+b);
 function typed(name,types,values,route='static'){
  const b=new ArrayBuffer(128),v=new DataView(b);let n=0;
  types.forEach((t,i)=>{if(t==='d'){v.setFloat64(n,values[i],true);n+=8;}
   else {if(t==='f')v.setFloat32(n,values[i],true);else v.setInt32(n,values[i],true);n+=4;}});
  return call(name,Array.from(new Uint32Array(b,0,n/4)),false,route);
 }
 function data(values,type='d',at=cp){values.forEach((v,i)=>type==='d'?dv.setFloat64(wa(at)+8*i,v,true):dv.setFloat32(wa(at)+4*i,v,true));return at;}
 function map1(target,values,order,k=3,type='d',domain=[0,1],stride=k,at=cp,route='static'){
  data(values,type,at);typed('glMap1'+type,['i',type,type,'i','i','i'],[target,...domain,stride,order,at],route);
 }
 function map2(target,values,nu,nv,k=3,type='d',domain=[0,1,0,1],us=nv*k,vs=k,route='static'){
  data(values,type);typed('glMap2'+type,['i',type,type,'i','i',type,type,'i','i','i'],[target,domain[0],domain[1],us,nu,domain[2],domain[3],vs,nv,cp],route);
 }
 function getmap(target,q=0xa00,kind='d',n=3){
  call('glGetMap'+kind+'v',[target,q,output]);return Array.from({length:n},(_,i)=>kind==='d'?dv.getFloat64(wa(output)+i*8,true):kind==='f'?dv.getFloat32(wa(output)+i*4,true):dv.getInt32(wa(output)+i*4,true));
 }
 function sample(name,types,values){call('glBegin',[0]);typed(name,types,values);assert.strictEqual(e.eval_count(),1,name+' emits one vertex');
  const a=Array.from(new Float32Array(memory.buffer,e.eval_data(),28));call('glEnd');return a;}
 function coord(dim,u,v=0){return sample('glEvalCoord'+dim+'d',Array(dim).fill('d'),dim===1?[u]:[u,v]);}
 function disableMaps(){for(let i=0;i<9;i++){call('glDisable',[0xd90+i]);call('glDisable',[0xdb0+i]);}call('glDisable',[G.auto]);}
 assert.strictEqual(query(0xd30),8,'MAX_EVAL_ORDER');
 for(let i=0;i<18;i++){const target=(i<9?0xd90:0xdb0)+i%9;assert.strictEqual(call('glIsEnabled',[target]),0);
  assert.deepStrictEqual(getmap(target,0xa01,'i',i<9?1:2),i<9?[1]:[1,1]);}
 assert.deepStrictEqual(getmap(G.v14),[0,0,0]);assert.deepStrictEqual(getmap(G.v14,0xa00,'d',4),[0,0,0,1]);
 assert.deepStrictEqual(getmap(G.c1,0xa00,'d',4),[1,1,1,1]);assert.deepStrictEqual(getmap(G.n2),[0,0,1]);
 assert.deepStrictEqual(getmap(G.v2,0xa02,'d',4),[0,1,0,1]);
 for(const [p,n,expected] of [[0xdd0,2,[0,1]],[0xdd2,4,[0,1,0,1]],[0xdd3,2,[1,1]]]){
  call('glGetDoublev',[p,output]);assert.deepStrictEqual(Array.from({length:n},(_,i)=>dv.getFloat64(wa(output)+8*i,true)),expected);
 }
 // A cubic, with padding that must never become a coefficient. Exact numeric
 // results below are hand-expanded Bernstein polynomials, not encoder output.
 const cubic=[8,8,0,999,8,56,0,999,56,56,0,999,56,8,0,999];
 map1(G.v1,cubic,4,3,'d',[-2,2],4);call('glEnable',[G.v1]);
 assert.deepStrictEqual(getmap(G.v1,0xa00,'d',12),[8,8,0,8,56,0,56,56,0,56,8,0]);
 assert.deepStrictEqual(getmap(G.v1,0xa02,'d',2),[-2,2]);assert.strictEqual(call('glIsEnabled',[G.v1]),1);
 call('glGetBooleanv',[G.v1,output]);assert.strictEqual(dv.getUint8(wa(output)),1);
 for(const t of [0,.125,.25,.5,.875,1,1.25]){
  const a=coord(1,-2+4*t);near(a[0],8+144*t*t-96*t*t*t,'cubic x');near(a[1],8+144*t-144*t*t,'cubic y');
 }
 map1(G.v1,cubic,4,3,'d',[2,-2],4);a=coord(1,1);near(a[0],15.5,'reversed domain');near(a[1],35,'reversed domain y');
 const tiny=2**-40;map1(G.v1,[8,8,0,56,8,0],2,3,'d',[1+tiny,1+2*tiny]);
 typed('glMapGrid1d',['i','d','d'],[3,1+tiny,1+2*tiny]);
 a=sample('glEvalPoint1',['i'],[0]);near(a[0],8,'binary64 grid first endpoint');
 a=sample('glEvalPoint1',['i'],[3]);near(a[0],56,'binary64 grid last endpoint');
 map1(G.v1,cubic,4,3,'d',[-2,2],4);
 // All eight scalar/vector float/double forms and both static/dynamic lookup.
 for(const dim of [1,2])for(const t of ['d','f'])for(const vector of [false,true]){
  if(dim===2){map2(G.v2,[8,8,0,8,56,0,56,8,0,56,56,0],2,2);call('glEnable',[G.v2]);}
  const values=dim===1?[0]:[.5,.25];data(values,t,vec);
  const a=sample('glEvalCoord'+dim+t+(vector?'v':''),vector?['i']:Array(dim).fill(t),vector?[vec]:values);
  near(a[0],32,'numeric variant x');near(a[1],dim===1?44:20,'numeric variant y');
  typed('glEvalCoord'+dim+t+(vector?'v':''),vector?['i']:Array(dim).fill(t),vector?[vec]:values,'dynamic');
 }
 // Coefficient and domain precision survive double ABI and query; integer
 // queries round ordinary real values rather than normalizing them.
 map1(G.v14,[1+2**-40,-2.5,3.5,2],1,4);
 assert.strictEqual(getmap(G.v14,0xa00,'d',4)[0],1+2**-40);
 assert.deepStrictEqual(getmap(G.v14,0xa00,'i',4),[1,-2,4,2]);
 call('glEnable',[G.v14]);a=coord(1,0);near(a[0],1,'vertex4 precedence');near(a[14],2,'homogeneous w');
 call('glDisable',[G.v14]);
 // Highest texture dimension wins; evaluated color/normal/texture values do
 // not change any current state, including exact integer color provenance.
 map1(G.c1,[1,0,0,1,0,1,0,1],2,4);call('glEnable',[G.c1]);
 map1(0xd93,[.2,.8],2,1);map1(0xd96,[.1,.2,.3,.4,.5,.6,.7,.8],2,4);
 call('glEnable',[0xd93]);call('glEnable',[0xd96]);call('glColor4ub',[25,50,75,255]);
 call('glTexCoord4f',[9,8,7,6],true);a=coord(1,.5);
 near(a[3],.5,'evaluated red');near(a[4],.5,'evaluated green');
 [.3,.4,.5,.6].forEach((v,i)=>near(a[[7,8,15,16][i]],v,'texture4'));
 call('glGetFloatv',[0xb00,output]);near(dv.getFloat32(wa(output),true),25/255,'current color preserved');
 call('glGetFloatv',[0xb03,output]);assert.deepStrictEqual(Array.from(new Float32Array(memory.buffer,wa(output),4)),[9,8,7,6]);
 disableMaps();call('glColor4f',[1,1,1,1],true);call('glTexCoord4f',[0,0,0,1],true);
 // Quadratic tensor surface S=(8+48u,8+48v, 6u^2+3v^2).
 const surf=[];for(let i=0;i<3;i++)for(let j=0;j<3;j++)surf.push(8+24*i,8+24*j,(i===2?6:0)+(j===2?3:0));
 map2(G.v2,surf,3,3);call('glEnable',[G.v2]);call('glEnable',[G.auto]);
 a=coord(2,.25,.5);near(a[0],20,'surface x');near(a[1],32,'surface y');near(a[2],1.125,'quadratic z');
 let norm=[-3/48,-3/48,1],len=Math.hypot(...norm);norm.forEach((v,i)=>near(a[9+i],v/len,'analytic normal'));
 // A rational bilinear patch: q=(u/(1+u),v/(1+u),uv/(1+u)).
 map2(G.v24,[0,0,0,1,0,1,0,1,1,0,0,2,1,1,1,2],2,2,4);call('glEnable',[G.v24]);
 a=coord(2,.5,.25);near(a[14],1.5,'rational w');norm=[-.375,-.5,1];len=Math.hypot(...norm);
 norm.forEach((v,i)=>near(a[9+i],v/len,'quotient-rule normal'));
 call('glDisable',[G.v24]);map2(G.n2,[0,1,0],1,1);call('glEnable',[G.n2]);call('glDisable',[G.auto]);
 a=coord(2,.3,.4);assert.deepStrictEqual(a.slice(9,12),[0,1,0]);call('glEnable',[G.auto]);a=coord(2,.3,.4);assert(a[11]>.99,'auto normal overrides map');
 call('glGetFloatv',[0xb02,output]);assert.deepStrictEqual(Array.from(new Float32Array(memory.buffer,wa(output),3)),[0,0,1]);
 // Full 8x8 order and every component fit in one private map. The degree-7
 // Bernstein control points below encode a linear homogeneous plane exactly.
 const maxPatch=[];for(let i=0;i<8;i++)for(let j=0;j<8;j++)maxPatch.push(i/7,j/7,0,1);
 map2(G.v24,maxPatch,8,8,4);call('glEnable',[G.v24]);
 assert.deepStrictEqual(getmap(G.v24,0xa01,'i',2),[8,8]);
 assert.deepStrictEqual(getmap(G.v24,0xa00,'d',256),maxPatch);
 a=coord(2,.125,.875);near(a[0],.125,'order8 surface x');near(a[1],.875,'order8 surface y');
 near(a[11],1,'order8 surface normal');call('glDisable',[G.v24]);
 // All map targets retain canonical coefficient order and independent enables,
 // including index maps on these RGBA drawables. Do not infer map width from
 // the currently selected vertex map.
 for(const base of [0xd90,0xdb0])for(let i=0;i<9;i++){
  if(base===0xdb0&&i===7)continue; // Preserve the quadratic vertex patch above.
  const k=[4,1,3,1,2,3,4,3,4][i],v=Array.from({length:k},(_,j)=>.125*(j+1));
  if(base===0xd90)map1(base+i,v,1,k);else map2(base+i,v,1,1,k);
  assert.deepStrictEqual(getmap(base+i,0xa00,'d',k),v,'map target '+(base+i));
  call('glEnable',[base+i]);assert.strictEqual(call('glIsEnabled',[base+i]),1);
  call('glDisable',[base+i]);assert.strictEqual(call('glIsEnabled',[base+i]),0);
 }
 call('glEnable',[G.v2]);call('glEnable',[G.auto]);
 // Noncontiguous, transposed strides and numeric variants.
 map2(G.v2,[8,8,0,999,56,8,0,999,8,56,0,999,56,56,0,999],2,2,3,'f',[-1,1,2,6],4,8,'dynamic');
 assert.deepStrictEqual(getmap(G.v2,0xa00,'f',12),[8,8,0,8,56,0,56,8,0,56,56,0]);
 a=coord(2,0,3);near(a[0],32,'transposed stride x');near(a[1],20,'transposed stride y');
 map1(G.v1,cubic,4,3,'d',[-2,2],4);call('glEnable',[G.v1]);
 for(const t of ['d','f']){
  typed('glMapGrid1'+t,['i',t,t],[4,-2,2],'dynamic');
  a=sample('glEvalPoint1',['i'],[2]);near(a[0],32,'grid1 midpoint');near(a[1],44,'grid1 midpoint y');
  a=sample('glEvalPoint1',['i'],[0]);near(a[0],8,'grid1 first endpoint');
  a=sample('glEvalPoint1',['i'],[4]);near(a[0],56,'grid1 last endpoint');
  typed('glMapGrid2'+t,['i',t,t,'i',t,t],[4,-1,1,2,2,6],'dynamic');
  a=sample('glEvalPoint2',['i','i'],[1,1]);near(a[0],20,'grid2 x');near(a[1],32,'grid2 y');
  a=sample('glEvalPoint2',['i','i'],[4,2]);near(a[0],56,'grid2 endpoint x');near(a[1],56,'grid2 endpoint y');
 }
 // Accepted maximum order, strict target/order/stride/domain/grid errors,
 // unchanged maps after rejected definitions, and Begin/End restrictions.
 const order8=Array.from({length:8},(_,i)=>[i,2*i,0]).flat();map1(G.v1,order8,8);
 a=coord(1,.3);near(a[0],2.1,'order8 polynomial');near(a[1],4.2,'order8 y');
 const original=getmap(G.v1,0xa00,'d',24),err=()=>call('glGetError');
 for(const [target,domain,stride,order,expected] of [[G.v1,[0,1],3,9,0x501],[G.v1,[0,1],2,2,0x501],[G.v1,[1,1],3,2,0x501],[G.v2,[0,1],3,2,0x500],[G.auto,[0,1],3,2,0x500]]){
  typed('glMap1d',['i','d','d','i','i','i'],[target,...domain,stride,order,0]);assert.strictEqual(err(),expected);assert.deepStrictEqual(getmap(G.v1,0xa00,'d',24),original);
 }
 const saved2=getmap(G.v2,0xa00,'d',12);
 for(const [us,nu,vs,nv,domain] of [[2,2,3,2,[0,1,0,1]],[6,2,2,2,[0,1,0,1]],[6,0,3,2,[0,1,0,1]],[6,2,3,9,[0,1,0,1]],[6,2,3,2,[0,1,2,2]]]){
  typed('glMap2d',['i','d','d','i','i','d','d','i','i','i'],[G.v2,domain[0],domain[1],us,nu,domain[2],domain[3],vs,nv,0]);
  assert.strictEqual(err(),0x501);assert.deepStrictEqual(getmap(G.v2,0xa00,'d',12),saved2,'rejected surface is atomic');
 }
 typed('glMapGrid1f',['i','f','f'],[0,0,1]);assert.strictEqual(err(),0x501);
 typed('glMapGrid2d',['i','d','d','i','d','d'],[4,0,1,0,0,1]);assert.strictEqual(err(),0x501);
 call('glEvalMesh1',[0x1b02,0,2]);assert.strictEqual(err(),0x500);
 call('glEvalMesh2',[0xffff,0,2,0,2]);assert.strictEqual(err(),0x500);
 call('glGetMapdv',[G.auto,0xa00,output]);assert.strictEqual(err(),0x500);
 call('glGetMapdv',[G.v1,0xffff,output]);assert.strictEqual(err(),0x500);
 call('glBegin',[0]);typed('glMapGrid1d',['i','d','d'],[4,0,1]);call('glEnable',[G.v1]);call('glEvalMesh2',[0x1b00,0,1,0,1]);call('glEnd');assert.strictEqual(err(),0x502);
 // Attribute groups and context switches own maps/grids independently.
 map1(G.v1,[8,8,0,56,8,0],2);typed('glMapGrid1d',['i','d','d'],[8,.125,.875]);
 // Rejected stack operations must neither restore nor consume an evaluator
 // frame; an accepted Pop after End still restores the original definition.
 call('glPushAttrib',[0x10000]);map1(G.v1,[7,7,0],1);
 call('glBegin',[0]);call('glPopAttrib');call('glPushAttrib',[0x10000]);call('glEnd');
 assert.strictEqual(err(),0x502);assert.strictEqual(getmap(G.v1)[0],7);
 call('glPopAttrib');assert.strictEqual(getmap(G.v1)[0],8);
 call('glPushAttrib',[0x10000]);map1(G.v1,[9,9,0],1);call('glDisable',[G.v1]);typed('glMapGrid1d',['i','d','d'],[1,0,1]);call('glPopAttrib');
 assert.strictEqual(call('glIsEnabled',[G.v1]),1);assert.deepStrictEqual(getmap(G.v1,0xa01,'i',1),[2]);assert.strictEqual(query(0xdd1),8);
 call('glPushAttrib',[0x2000]);map1(G.v1,[10,10,0],1);call('glDisable',[G.v1]);call('glPopAttrib');
 assert.strictEqual(call('glIsEnabled',[G.v1]),1);assert.strictEqual(getmap(G.v1)[0],10,'ENABLE_BIT excludes coefficients');
 const context2=call('wglCreateContext',[dc]);assert(context2);assert.strictEqual(call('wglCopyContext',[context,context2,0x10000]),1);
 assert.strictEqual(call('wglMakeCurrent',[dc,context2]),1);assert.strictEqual(getmap(G.v1)[0],10);
 map1(G.v1,[12,12,0],1);call('glDisable',[G.v1]);assert.strictEqual(call('wglMakeCurrent',[dc,context]),1);
 assert.strictEqual(getmap(G.v1)[0],10);assert.strictEqual(call('glIsEnabled',[G.v1]),1,'copy did not alias state');
 assert.strictEqual(call('wglCopyContext',[context,context2,0x2000]),1);call('wglMakeCurrent',[dc,context2]);
 assert.strictEqual(getmap(G.v1)[0],12,'enable copy excludes coefficients');assert.strictEqual(call('glIsEnabled',[G.v1]),1);call('wglMakeCurrent',[dc,context]);
 // Lists capture client coefficients and numeric coordinates immediately.
 // Eval commands resolve enables/maps/grid state when replayed, and shared
 // lists remain valid after their defining context is deleted.
 const list=call('glGenLists',[4]);assert(list);
 call('glNewList',[list,0x1300]);map1(G.v1,[14,18,0,46,18,0],2,3,'f');data([.25],'d',vec);
 assert.strictEqual(getmap(G.v1)[0],10,'GetMap executes immediately during list compilation');
 call('glBegin',[0]);call('glEvalCoord1dv',[vec]);call('glEnd');call('glEndList');
 data([999,999,999,999,999,999],'f');data([.9],'d',vec);assert.strictEqual(getmap(G.v1)[0],10,'GL_COMPILE defers map');
 clear();call('glCallList',[list]);assert.strictEqual(getmap(G.v1)[0],14);assert(region(22,18)>0,'list copied pointed coordinates');
 call('glNewList',[list+1,0x1300]);call('glBegin',[0]);typed('glEvalCoord1d',['d'],[.5]);call('glEnd');call('glEndList');
 map1(G.v1,[18,22,0,50,22,0],2);clear();call('glCallList',[list+1]);assert(region(34,22)>0,'list eval uses current map');
 call('glNewList',[list+2,0x1301]);map1(G.v1,[16,26,0,48,26,0],2);call('glEvalMesh1',[0x1b01,0,8]);call('glEndList');assert.strictEqual(getmap(G.v1)[0],16);assert.strictEqual(err(),0);
 clear();call('glCallList',[list+2]);assert(region(32,26)>0,'COMPILE_AND_EXECUTE mesh replays once');assert.strictEqual(err(),0);
 call('glNewList',[list+3,0x1300]);typed('glMapGrid1d',['i','d','d'],[4,0,1]);call('glEvalMesh1',[0x1b00,0,4]);call('glEndList');
 clear();call('glCallList',[list+3]);assert.strictEqual(query(0xdd1),4);assert(region(32,26)>0,'list grid and mesh');
 // New empty namespace may share the established list namespace.
 const shared=call('wglCreateContext',[dc]);assert.strictEqual(call('wglShareLists',[context,shared]),1);
 call('wglMakeCurrent',[dc,shared]);call('glEnable',[G.v1]);call('glCallList',[list]);assert.strictEqual(getmap(G.v1)[0],14);call('wglMakeCurrent',[dc,context]);
 // Native pixels and captured production draw streams for every mesh mode.
 batches.length=0;disableMaps();call('glColor4f',[1,1,1,1],true);call('glPointSize',[3],true);
 map1(G.v1,cubic,4,3,'d',[0,1],4);call('glEnable',[G.v1]);typed('glMapGrid1d',['i','d','d'],[4,0,1]);
 take('setup');
 clear();call('glEvalMesh1',[0x1b00,0,4]);assert(region(32,44)>0);assert.strictEqual(region(32,8),0);take('curvePoint');
 clear();call('glEvalMesh1',[0x1b01,0,4]);assert(region(12,22)>0);take('curveLine');
 const patch=[];for(let i=0;i<3;i++)for(let j=0;j<3;j++)patch.push([8,20,56][i],8+24*j,0);
 map2(G.v2,patch,3,3);call('glEnable',[G.v2]);typed('glMapGrid2f',['i','f','f','i','f','f'],[4,0,1,4,0,1]);take('surfaceSetup');
 for(const [mode,name] of [[0x1b00,'surfacePoint'],[0x1b01,'surfaceLine'],[0x1b02,'surfaceFill']]){
  clear();call('glEvalMesh2',[mode,0,4,0,4]);assert(region(26,32)>0,name+' polynomial center');
  if(mode===0x1b02)assert(region(32,26)>0,'filled interior');else assert.strictEqual(region(32,26),0,'open mesh interior');
  assert.strictEqual(region(26,26)>0,mode!==0x1b00,'vertical strips are present only for LINE/FILL');
  take(name);
 }
 // Reversed index intervals and a zero-height FILL mesh emit no fragments.
 for(const mode of [0x1b00,0x1b01,0x1b02]){
  clear();call('glEvalMesh2',[mode,3,1,0,4]);assert.strictEqual(region(26,32),0,'empty u interval');
  clear();call('glEvalMesh2',[mode,0,4,3,1]);assert.strictEqual(region(26,32),0,'empty v interval');
 }
 clear();call('glEvalMesh2',[0x1b02,0,4,2,2]);assert.strictEqual(region(26,32),0,'zero-height fill');
 batches.length=0;
 // The generated normal must reach actual lighting, and evaluated colors
 // must participate in COLOR_MATERIAL without changing tracked material.
 const vf=values=>data(values,'f',vec),material=(p,v)=>call('glMaterialfv',[0x408,p,vf(v)]);
 call('glMatrixMode',[0x1701]);call('glLoadIdentity');typed('glOrtho',Array(6).fill('d'),[0,64,0,64,-100,100]);call('glMatrixMode',[0x1700]);
 call('glLightModelfv',[0xb53,vf([0,0,0,1])]);call('glLightfv',[0x4000,0x1200,vf([0,0,0,1])]);
 call('glLightfv',[0x4000,0x1201,vf([1,1,1,1])]);call('glLightfv',[0x4000,0x1202,vf([0,0,0,1])]);call('glLightfv',[0x4000,0x1203,vf([0,0,1,0])]);
 material(0x1200,[0,0,0,1]);material(0x1201,[1,1,1,1]);material(0x1202,[0,0,0,1]);material(0x1600,[0,0,0,1]);
 call('glEnable',[0xb50]);call('glEnable',[0x4000]);call('glEnable',[G.auto]);
 map2(G.v2,[8,8,0,8,56,0,56,8,48,56,56,48],2,2);take('normalSetup');
 clear();call('glEvalMesh2',[0x1b02,0,4,0,4]);if(encoder)encoder.fence();
 let red=(pixel(32,32)>>>16)&255;assert(red>=174&&red<=188,'auto normal diffuse pixels '+red);take('normalLit');
 map2(G.n2,[0,0,-1],1,1);call('glEnable',[G.n2]);call('glDisable',[G.auto]);
 clear();call('glEvalMesh2',[0x1b02,0,4,0,4]);assert.strictEqual(region(32,32),0,'normal map changes lighting pixels');take('normalMapped');
 call('glEnable',[G.auto]);call('glColorMaterial',[0x408,0x1201]);call('glEnable',[0xb57]);
 map2(G.c2,[1,0,0,1],1,1,4);call('glEnable',[G.c2]);
 clear();call('glEvalMesh2',[0x1b02,0,4,0,4]);if(encoder)encoder.fence();
 let rgb=pixel(32,32);assert(((rgb>>>16)&255)>=174&&(rgb&0xffff)===0,'evaluator color material pixels');take('colorMaterial');
 call('glDisable',[0xb50]);call('glDisable',[0xb57]);call('glDisable',[G.c2]);
 // Evaluator texcoords use texture unit zero and the ordinary sampler route.
 call('glColor4f',[1,1,1,1],true);call('glGenTextures',[1,output]);const tex=dv.getUint32(wa(output),true);call('glBindTexture',[0xde1,tex]);
 call('glTexParameteri',[0xde1,0x2801,0x2600]);call('glTexParameteri',[0xde1,0x2800,0x2600]);call('glTexEnvi',[0x2300,0x2200,0x1e01]);
 new Uint8Array(memory.buffer,wa(cp),16).set([255,0,0,255,0,255,0,255,0,0,255,255,255,255,255,255]);
 call('glTexImage2D',[0xde1,0,4,2,2,0,0x1908,0x1401,cp]);call('glEnable',[0xde1]);
 map2(0xdb4,[0,0,0,1,1,0,1,1],2,2,2);call('glEnable',[0xdb4]);take('textureSetup');
 clear();call('glEvalMesh2',[0x1b02,0,4,0,4]);if(encoder)encoder.fence();
 assert.deepStrictEqual([[14,14],[48,14],[14,48],[48,48]].map(p=>pixel(...p)),[0xff0000,0x00ff00,0x0000ff,0xffffff],'evaluated texture pixels');take('textured');
 call('glDisable',[0xde1]);
 // Ordinary vertex emission after an evaluator keeps current attributes.
 disableMaps();call('glBegin',[0]);typed('glEvalCoord2d',['d','d'],[.5,.5]);assert.strictEqual(e.eval_count(),0,'disabled vertex map emits nothing');call('glVertex3f',[18,18,0],true);assert.strictEqual(e.eval_count(),1);call('glEnd');
 assert.strictEqual(err(),0);
 call('wglMakeCurrent',[0,0]);assert.strictEqual(call('wglDeleteContext',[context]),1);
 call('wglMakeCurrent',[dc,shared]);call('glCallList',[list]);assert.strictEqual(getmap(G.v1)[0],14,'shared list outlives original context');
 call('glPushAttrib',[0x10000]); // Deletion owns outstanding evaluator frames.
 call('wglMakeCurrent',[0,0]);call('wglDeleteContext',[shared]);call('wglDeleteContext',[context2]);
 if(process.env.GL_EVAL_CAPTURE)fs.writeFileSync(process.env.GL_EVAL_CAPTURE,JSON.stringify(cases));
 if(encoder){assert(encoder.snapshot().glQueued>0,'actual Worker queue used');assert.strictEqual(encoder.snapshot().fallbacks,0,'no native fallback');}
 console.log('PASS GL evaluator family: real resolved ABI, values, analytic/rational normals, grids, lists, context/attrib isolation, errors and all native mesh pixels; route='+ (queued?'Worker':'direct'));
 } finally {encoder?.stop();if(manager)await manager.stop();}
})().catch(error=>{console.error(error);process.exitCode=1;});
