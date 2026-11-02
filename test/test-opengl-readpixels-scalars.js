'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),req=p=>require(path.join(root,p));
const {bootRenderHarness}=req('test/render-helper');
const {OpenGLHostBridge}=req('lib/gl-compat');
const Stream=req('lib/gl-command-stream');
const table=req('src/api_table.json');
const extraWat=`
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
 const h=await bootRenderHarness({fonts:'none',width:8,height:4,extraWat,
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
 const renderer={windows:{42:{hwnd:42,w:8,h:4,clientRect:{w:8,h:4}}},repaint(){}};
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

 // Expected numbers come from GL1.1 table4.7 applied on paper to k/255.
 // Signed half-integers admit either adjacent integer: no tie mode is invented.
 const samples=[0,51,85,128,170,204,255];
 const scalars=[
  {name:'BYTE',type:0x1400,bytes:1,get:'getInt8',values:[-.5,25,42,63.5,84.5,101.5,127]},
  {name:'UNSIGNED_BYTE',type:0x1401,bytes:1,get:'getUint8',values:[0,51,85,128,170,204,255]},
  {name:'SHORT',type:0x1402,bytes:2,get:'getInt16',values:[-.5,6553,10922,16447.5,21844.5,26213.5,32767]},
  {name:'UNSIGNED_SHORT',type:0x1403,bytes:2,get:'getUint16',values:[0,13107,21845,32896,43690,52428,65535]},
  {name:'INT',type:0x1404,bytes:4,get:'getInt32',values:[-.5,429496729,715827882,1077952575.5,1431655764.5,1717986917.5,2147483647]},
  {name:'UNSIGNED_INT',type:0x1405,bytes:4,get:'getUint32',values:[0,858993459,1431655765,2155905152,2863311530,3435973836,4294967295]},
  {name:'FLOAT',type:0x1406,bytes:4,get:'getUint32',values:[0,0x3e4ccccd,0x3eaaaaab,0x3f008081,0x3f2aaaab,0x3f4ccccd,0x3f800000]},
 ];
 let checks=0,negativeControls=0;
 const dc=e.probe_dc(42)>>>0,context=call('wglCreateContext',[dc]);assert(context);
 assert.strictEqual(call('wglMakeCurrent',[dc,context]),1);
 call('glViewport',[0,0,8,4]);call('glDrawBuffer',[0x405]);call('glReadBuffer',[0x405]);
 const storage=e.guest_alloc(1024)>>>0,storageWa=wa(storage),output=storage+13,outWa=wa(output);
 const bytes=new Uint8Array(memory.buffer,storageWa,1024),out=new DataView(memory.buffer,outWa,900);
 function cleanError(label){assert.strictEqual(call('glGetError'),0,label);checks++;}
 function pack(alignment=1,rowLength=0,skipRows=0,skipPixels=0,swap=0,lsb=0){
  for(const [p,v]of[[0xd05,alignment],[0xd02,rowLength],[0xd03,skipRows],[0xd04,skipPixels],[0xd00,swap],[0xd01,lsb]])call('glPixelStorei',[p,v]);
 }
 function clear(rgba){call('glClearColor',rgba.map(f));call('glClear',[0x4000]);}
 function paint(x,y,rgba){call('glEnable',[0xc11]);call('glScissor',[x,y,1,1]);clear(rgba);call('glDisable',[0xc11]);}
 // Two distinct rows prove lower-left ordering, x/y selection and row packing.
 clear([0,0,0,0]);
 samples.forEach((k,i)=>{paint(i,0,[k/255,k/255,k/255,k/255]);});
 paint(0,1,[.2,1/3,128/255,.8]);paint(1,1,[.8,2/3,1,0]);
 paint(0,2,[0,1,1/3,1]);paint(1,2,[128/255,.2,.8,1/3]);
 function read(x,y,w,h,format,type){bytes.fill(0xa7);call('glReadPixels',[x,y,w,h,format,type,output]);}
 function guards(writes,label){
  const touched=new Set(writes);
  for(let i=0;i<bytes.length;i++)if(!touched.has(i-13))assert.strictEqual(bytes[i],0xa7,label+' untouched byte '+i);
 }
 function inspect(s,offset,expected,swap,label){
  const actual=out[s.get](offset,!swap);
  assert(Number.isFinite(actual)&&Math.abs(actual-expected)<=((expected%1)?0.5:0),
   label+': actual '+actual+', table result '+expected);
  checks++;
 }
 function check(s,rows,pixels,swap,label){
  const touched=[];
  rows.forEach((row,y)=>pixels[y].forEach((pixel,x)=>pixel.forEach((sample,c)=>{
   const offset=row+(x*pixel.length+c)*s.bytes;
   inspect(s,offset,s.values[sample],swap,label);
   for(let b=0;b<s.bytes;b++)touched.push(offset+b);
  })));
  guards(touched,label);cleanError(label);
 }
 pack();
 // Independent source-byte positive controls precede every expanded scalar test.
 read(0,0,7,1,0x1903,0x1401);
 assert.deepStrictEqual(Array.from(new Uint8Array(memory.buffer,outWa,7)),samples);
 guards([0,1,2,3,4,5,6],'source control');cleanError('source control');
 for(const s of scalars)for(const swap of [0,1]){
  pack(1,0,0,0,swap);read(0,0,7,1,0x1903,s.type);
  check(s,[0],[samples.map((_,i)=>[i])],swap,s.name+' black/fractions/white swap='+swap);
 }
 // Literal offsets, independent of production stride computation.
 const layouts=[
  {a:1,rows:{1:[12,21],2:[24,42],4:[48,84]}},
  {a:2,rows:{1:[13,23],2:[24,42],4:[48,84]}},
  {a:4,rows:{1:[15,27],2:[26,46],4:[48,84]}},
  {a:8,rows:{1:[19,35],2:[30,54],4:[52,92]}},
 ];
 const rgb=[[[1,2,3],[5,4,6]],[[0,6,2],[3,1,5]]];
 for(const s of scalars)for(const layout of layouts)for(const swap of [0,1]){
  pack(layout.a,3,1,1,swap);read(0,1,2,2,0x1907,s.type);
  check(s,layout.rows[s.bytes],rgb,swap,s.name+' RGB two rows alignment='+layout.a+' swap='+swap);
 }
 const tightRows={1:[0,8],2:[0,16],4:[0,24]};
 for(const s of scalars){
  pack(8);read(0,1,2,2,0x1907,s.type);check(s,tightRows[s.bytes],rgb,0,s.name+' default row length');
  pack(1);read(0,1,2,1,0x1908,s.type);
  check(s,[0],[[[1,2,3,5],[5,4,6,0]]],0,s.name+' RGBA component order');
  for(const [format,pixels]of[
   [0x1904,[[[2],[4]]]], [0x1905,[[[3],[6]]]], [0x1906,[[[5],[0]]]],
   [0x1909,[[[6],[6]]]], [0x190a,[[[6,5],[6,0]]]],
   [0x80e0,[[[3,2,1],[6,4,5]]]], [0x80e1,[[[3,2,1,5],[6,4,5,0]]]],
  ]){read(0,1,2,1,format,s.type);check(s,[0],pixels,0,s.name+' format '+format);}
 }
 // Luminance also has an unsaturated control: .2+.2+.2 =153/255.
 paint(7,0,[.2,.2,.2,.8]);pack();read(7,0,1,1,0x190a,0x1401);
 assert.deepStrictEqual(Array.from(new Uint8Array(memory.buffer,outWa,2)),[153,204]);guards([0,1],'luminance sum');cleanError('luminance sum');
 // PACK_LSB_FIRST and every UNPACK field must leave scalar output unchanged.
 const short=scalars[2];pack(8,3,1,1,1);read(0,1,2,2,0x1907,short.type);
 const baseline=Buffer.from(bytes);
 for(const [p,v]of[[0xd01,1],[0xcf0,1],[0xcf1,1],[0xcf2,7],[0xcf3,2],[0xcf4,2],[0xcf5,2]])call('glPixelStorei',[p,v]);
 read(0,1,2,2,0x1907,short.type);assert.deepStrictEqual(Buffer.from(bytes),baseline);cleanError('PACK LSB/UNPACK isolation');
 // Negative controls calibrate assertions against wrong byte order and overrun.
 assert.throws(()=>check(short,[30,54],rgb,0,'wrong endian'),assert.AssertionError);negativeControls++;
 bytes[0]=0;assert.throws(()=>check(short,[30,54],rgb,1,'corrupted guard'),assert.AssertionError);negativeControls++;
 pack();
 function noWrite(label,args,error,begin=false){
  bytes.fill(0xa7);if(begin)call('glBegin',[0]);
  call('glReadPixels',args);if(begin)call('glEnd');
  const actual=call('glGetError');assert(bytes.every(x=>x===0xa7),label+' output untouched');
  assert.strictEqual(actual,error,label+' error');assert.strictEqual(call('glGetError'),0,label+' error consumed');checks++;
 }
 for(const args of [[0,0,0,1,0x1908,0x1401,output],[0,0,1,0,0x1908,0x1401,output]])noWrite('zero area',args,0);
 for(const args of [[0,0,-1,1,0x1908,0x1401,output],[0,0,1,-1,0x1908,0x1401,output]])noWrite('negative size',args,0x501);
 noWrite('unknown format',[0,0,1,1,0xdead,0x1401,output],0x500);
 noWrite('unknown scalar',[0,0,1,1,0x1908,0xdead,output],0x500);
 noWrite('DOUBLE is not a ReadPixels scalar',[0,0,1,1,0x1908,0x140a,output],0x500);
 noWrite('RGBA context rejects COLOR_INDEX',[0,0,1,1,0x1900,0x1401,output],0x502);
 noWrite('Begin/End',[0,0,1,1,0x1908,0x1401,output],0x502,true);
 // A queued point proves the native producer/consumer path was exercised.
 call('glColor4f',[f(1),f(0),f(0),f(1)]);call('glBegin',[0]);call('glVertex3f',[f(-.9375),f(.55),f(0)]);call('glEnd');call('glFinish');
 if(queued)encoder.fence();
 // The native point rasterizer places this point in physical row1 (GL row2).
 const entry=e.gl_sw_entry(),bits=dv.getUint32(entry+20,true),pitch=dv.getUint16(entry+18,true);
 assert.strictEqual(dv.getUint32(bits+pitch,true),0xffff0000,'independent native source control');
 read(0,2,1,1,0x1908,0x1401);assert.deepStrictEqual(Array.from(new Uint8Array(memory.buffer,outWa,4)),[255,0,0,255]);guards([0,1,2,3],'native point');cleanError('native point');
 if(queued){encoder.fence();assert(encoder.snapshot().glQueued>=1,'actual queued native point');}
 console.log(JSON.stringify({stage:'scalar-pack-controls',route:queued?'queued':'direct',checks,negativeControls,passed:true}));
 // GL1.1 3.6.3 makes BITMAP legal only with index formats. This is last so
 // baseline logs retain all scalar/PACK/control results before any error defect.
 for(const format of [0x1903,0x1907,0x1908,0x1909,0x190a,0x1902,0xdead])
  noWrite('BITMAP with component/invalid format '+format,[0,0,1,1,format,0x1a00,output],0x500);
 noWrite('index BITMAP still rejected in RGBA context',[0,0,1,1,0x1900,0x1a00,output],0x502);
 assert.strictEqual(call('wglDeleteContext',[context]),1);
 console.log(JSON.stringify({stage:'complete',route:queued?'queued':'direct',checks,negativeControls,passed:true}));
 } finally { if(encoder)encoder.stop();if(manager)await manager.stop();if(render)render.destroy(); }
})().catch(e=>{console.error(e);process.exitCode=1;});

