'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),req=p=>require(path.join(root,p));
const {bootRenderHarness}=req('test/render-helper');
const {OpenGLHostBridge,CALL_INDEX:GL}=req('lib/gl-compat');
const Stream=req('lib/gl-command-stream');
const table=req('src/api_table.json');
const extraWat=`
 (func (export "probe_pointer") (param $op i32) (param $s i32) (result i64) (call $gl_pointer_length (local.get $op) (local.get $s)))
 (func (export "probe_texture") (result i32) (i32.load offset=760 (call $gl_list_context)))
 (func (export "probe_context") (result i32) (call $gl_list_context))
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
 const queued=process.argv.includes('--worker');
 let prebuiltModule;
 if(process.env.GL_TEXTURE_1D_MUTATION){let changed=false;const mutation=process.env.GL_TEXTURE_1D_MUTATION;
  const edits={
   conversion:['09a8b-handlers-opengl.wat','gl_1d_component','(f64.const 1))\n        (f64.sub','(f64.const 0))\n        (f64.sub'],
   subimage:['09a8b-handlers-opengl.wat','gl_1d_store','(local.set $x (i32.add (local.get $x) (local.get $b)))','(local.set $x (i32.const 0))'],
   complete:['09a8b-handlers-opengl.wat','gl_1d_complete','(i32.ne (i32.load offset=4 (local.get $p)) (i32.add (local.get $n) (i32.shl (local.get $border) (i32.const 1))))','(i32.const 0)'],
   filter:['09a8b-handlers-opengl.wat','gl_1d_sample','(local.get $level) (local.get $s) (local.get $linear)))','(i32.const 0) (local.get $s) (local.get $linear)))'],
   wrap:['09a8b-handlers-opengl.wat','gl_1d_level_sample','(f32.sub (local.get $s) (f32.floor (local.get $s)))','(local.get $s)'],
   target:['09a8b-handlers-opengl.wat','gl_1d_selected','(i32.and (i32.load (global.get $gl_sw_st)) (select (i32.const 0x80000) (i32.const 1) (local.get $unit)))','(i32.const 0)'],
   unit:['09a8b-handlers-opengl.wat','gl_1d_capture','(i32.shl (local.get $unit) (i32.const 3))','(i32.shl (local.get $unit) (i32.const 2))'],
   border:['09a8b-handlers-opengl.wat','gl_1d_tap','(local.set $b (i32.load offset=8 (local.get $p)))','(local.set $b (i32.const 0))'],
   width:['09a8b-handlers-opengl.wat','gl_1d_level_value','(return (i32.load offset=4 (local.get $p)))','(return (i32.const 1))'],
   begin:['09a8b-handlers-opengl.wat','gl_1d_validate','(local.set $error (i32.const 0x502))','(local.set $error (i32.const 0x500))'],
   attrib:['09a8b-handlers-opengl.wat','gl_texture_attributes','(i32.load offset=224 (local.get $p))','(i32.const 0)'],
   list:['09a8ca-gl-lists.wat','gl_list_intercept','(i32.shl (i32.load offset=16 (local.get $stack)) (i32.const 2)))\n          (i32.store','(i32.const 0))\n          (i32.store'],
   snapshot:['09a8g-gl-raster.wat','gl_sw_worker_try','(global.get $gl_1d_draw) (i32.const 112))','(global.get $gl_1d_draw) (i32.const 0))'],
  };
  assert(edits[mutation],'known semantic mutation');
  const bytes=req('test/compile-src').compileSrcWasm((file,source)=>{
   if(file==='13-exports.wat')return source+extraWat;
   const[f,fn,from,to]=edits[mutation];if(file!==f)return source;
   const a=Math.max(source.indexOf('(func $'+fn+' '),source.indexOf('(func $'+fn+'\n')),b=source.indexOf('\n  (func ',a+8);assert(a>=0,'mutation function');const body=source.slice(a,b<0?undefined:b);assert(body.includes(from),'mutation anchor '+mutation);changed=true;return source.slice(0,a)+body.replace(from,to)+(b<0?'':source.slice(b));
  });assert(changed);prebuiltModule=new WebAssembly.Module(bytes);console.error('SOURCE_CONTROL_COMPILED',mutation);
 }
 if(process.env.GL_TEXTURE_1D_BASELINE){let changed=false;
  const baseline=process.env.GL_TEXTURE_1D_BASELINE;
  const bytes=req('test/compile-src').compileSrcWasm((file,source)=>{
   if(file==='13-exports.wat')return source+extraWat;
   if(fs.existsSync(path.join(baseline,file))){changed=true;return fs.readFileSync(path.join(baseline,file),'utf8');}return source;
  });assert(changed);prebuiltModule=new WebAssembly.Module(bytes);console.error('SOURCE_CONTROL_COMPILED old-source');
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
 const names=['glTexImage1D','glTexSubImage1D','glTexParameteriv'];
 for(const name of names){assert(call('wglGetProcAddress',[str(name)]),'dynamic '+name);assert(resolve(name),'system '+name);checks++;}
 for(const[op,words]of[[149,8],[150,7]]){dv.setUint32(stackWa+16,7,true);dv.setUint32(stackWa+words*4,0x12345678,true);assert.strictEqual(e.probe_pointer(op,stackWa),0x1c12345678n,'owned exact width*4 canonical encoder payload');checks++;}
 const pixels=e.guest_alloc(8192)>>>0,output=e.guest_alloc(512)>>>0,vector=e.guest_alloc(64)>>>0;
 const write=(p,b)=>{for(let i=0;i<b.length;i++)dv.setUint8(wa(p+i),b[i]);};
 const read=(p,n)=>Buffer.from(Array.from({length:n},(_,i)=>dv.getUint8(wa(p+i))));
 function ints(a){const b=Buffer.alloc(a.length*4);a.forEach((x,i)=>b.writeInt32LE(x,i*4));return b;}
 function floats(a){const b=Buffer.alloc(a.length*4);a.forEach((x,i)=>b.writeFloatLE(x,i*4));return b;}
 function err(want,label){assert.strictEqual(call('glGetError'),want,label);checks++;}
 function integer(pname,want,label){write(output,Buffer.alloc(12,0xa6));call('glGetIntegerv',[pname,output+4]);assert.strictEqual(read(output+4,4).readInt32LE(),want,label);assert.deepStrictEqual([...read(output,4)],[166,166,166,166]);assert.deepStrictEqual([...read(output+8,4)],[166,166,166,166]);checks++;}
 function level(target,l,pname,want,label){write(output,Buffer.alloc(12,0xa6));call('glGetTexLevelParameteriv',[target,l,pname,output+4]);assert.strictEqual(read(output+4,4).readInt32LE(),want,label);assert.deepStrictEqual([...read(output,4)],[166,166,166,166]);assert.deepStrictEqual([...read(output+8,4)],[166,166,166,166]);checks++;}
 function image(data,{level=0,width=data.length/4,border=0,internal=0x1908,format=0x1908,type=0x1401,target=0xde0}={}){write(pixels,Buffer.from(data));call('glTexImage1D',[target,level,internal,width,border,format,type,pixels]);err(0,'image valid');}
 function parameter(pname,value){call('glTexParameteri',[0xde0,pname,value]);}
 for(const unit of [0,1]){call('glActiveTextureARB',[0x84c0+unit]);integer(0x8068,0,'default1d binding');integer(0xde0,0,'default1d enable');assert.strictEqual(call('glIsEnabled',[0xde0]),0);}
 call('glActiveTextureARB',[0x84c0]);
 // Resolving names must not create texture objects.
 assert.strictEqual(call('glIsTexture',[1001]),0);call('glBindTexture',[0xde0,1001]);assert.strictEqual(call('glIsTexture',[1001]),1);
 call('glBindTexture',[0xde1,1001]);err(0x502,'object cannot change target');integer(0x8069,0,'2d unchanged after target mismatch');integer(0x8068,1001,'1d binding intact');
 parameter(0x2800,0x2600);parameter(0x2801,0x2600);
 image([255,0,0,255,0,255,0,255,0,0,255,255,255,255,255,255]);
 level(0xde0,0,0x1000,4,'real width4');level(0xde0,0,0x1001,1,'height1');level(0xde0,0,0x1003,0x1908,'internal');level(0xde0,0,0x1005,0,'border0');
 call('glEnable',[0xde0]);integer(0xde0,1,'1d enabled');assert.strictEqual(call('glIsEnabled',[0xde0]),1);
 call('glDisable',[0xde1]);call('glViewport',[0,0,8,8]);
 for(const mode of [0x1700,0x1701,0x1702]){call('glMatrixMode',[mode]);call('glLoadIdentity');}
 call('glMatrixMode',[0x1700]);call('glDisable',[0xb50]);call('glDisable',[0xb71]);call('glDisable',[0xbe2]);call('glTexEnvi',[0x2300,0x2200,0x1e01]);call('glColor4f',[f(1),f(1),f(1),f(1)]);
 function draw(s0=0,s1=1,t0=-9,t1=17){call('glBegin',[7]);for(const[x,y,s,t]of[[-1,-1,s0,t0],[1,-1,s1,t0],[1,1,s1,t1],[-1,1,s0,t1]]){call('glTexCoord2f',[f(s),f(t)]);call('glVertex2f',[f(x),f(y)]);}call('glEnd');}
 function frame(columns,label,tolerance=0){call('glFinish');if(queued)encoder.fence();call('glReadPixels',[0,0,8,8,0x1908,0x1401,output]);const got=read(output,256);for(let y=0;y<8;y++)for(let x=0;x<8;x++)for(let c=0;c<4;c++)assert(Math.abs(got[(y*8+x)*4+c]-columns[x][c])<=tolerance,label+' pixel '+x+','+y+' component'+c+' got'+got[(y*8+x)*4+c]+' expected'+columns[x][c]);observations.push({label,expected:columns,pixels:[...got]});checks++;}
 const red=[255,0,0,255],green=[0,255,0,255],blue=[0,0,255,255],white=[255,255,255,255];
 draw();frame([red,red,green,green,blue,blue,white,white],'nontrivial1d width4 ignores T');
 // The homogeneous texture coordinate is S/Q; R and T do not enter 1D sampling.
 call('glBegin',[7]);for(const[x,y,u]of[[-1,-1,0],[1,-1,2],[1,1,2],[-1,1,0]]){call('glTexCoord4f',[f(u),f(600),f(-7),f(2)]);call('glVertex2f',[f(x),f(y)]);}call('glEnd');frame([red,red,green,green,blue,blue,white,white],'projective S divided by Q');
 // Source bytes are overwritten before drawing. Upload ownership must hold.
 write(pixels,Buffer.alloc(16,19));draw();frame([red,red,green,green,blue,blue,white,white],'upload owns canonical payload');
 write(pixels,Buffer.from([255,255,0,255]));call('glTexSubImage1D',[0xde0,0,1,1,0x1908,0x1401,pixels]);write(pixels,Buffer.alloc(4,0));draw();frame([red,red,[255,255,0,255],[255,255,0,255],blue,blue,white,white],'subimage edits exact texel');
 // Invalid commands leave the image and rendered pixels intact.
 for(const args of [[0xde0,0,-1,1,0x1908,0x1401,pixels],[0xde0,0,4,1,0x1908,0x1401,pixels],[0xde0,0,1,0x7fffffff,0x1908,0x1401,pixels]]){call('glTexSubImage1D',args);err(0x501,'invalid sub bounds');}
 draw();frame([red,red,[255,255,0,255],[255,255,0,255],blue,blue,white,white],'invalid bounds atomic');
 // Repeat uses S only, including negative coordinates.
 image([255,0,0,255,0,255,0,255,0,0,255,255,255,255,255,255]);draw(-1,1);frame([red,green,blue,white,red,green,blue,white],'repeat negative S');
 parameter(0x2802,0x8370);draw(-1,1);frame([white,blue,green,red,red,green,blue,white],'accepted mirrored repeat extension');parameter(0x2802,0x812f);draw(-1,1);frame([red,red,red,red,red,green,blue,white],'accepted clamp to edge extension');parameter(0x2802,0x2901);
 // A second enabled target has precedence, with independent binding/storage.
 call('glBindTexture',[0xde1,1002]);write(pixels,Buffer.from([31,63,95,255]));call('glTexImage2D',[0xde1,0,0x1908,1,1,0,0x1908,0x1401,pixels]);call('glTexParameteri',[0xde1,0x2801,0x2600]);call('glTexParameteri',[0xde1,0x2800,0x2600]);call('glEnable',[0xde1]);draw();frame(Array(8).fill([31,63,95,255]),'2d target precedence');call('glDisable',[0xde1]);draw();frame([red,red,green,green,blue,blue,white,white],'1d returns after disabling2d');
 // Signed byte normalization follows table2.6, including the +1 bias.
 image([128,255,0,127],{width:4,internal:0x1909,format:0x1909,type:0x1400});draw();frame([[0,0,0,255],[0,0,0,255],[0,0,0,255],[0,0,0,255],[1,1,1,255],[1,1,1,255],[255,255,255,255],[255,255,255,255]],'signed component conversion');
 write(pixels,floats([0,.25,.5,1]));call('glTexImage1D',[0xde0,0,0x8049,4,0,0x1909,0x1406,pixels]);draw();frame([[0,0,0,0],[0,0,0,0],[64,64,64,64],[64,64,64,64],[128,128,128,128],[128,128,128,128],[255,255,255,255],[255,255,255,255]],'float intensity conversion');
 // Every GL1.1 base/sized internal format selects its specified components.
 const sizedFamilies=[[[1,0x1909,0x803f,0x8040,0x8041,0x8042],[64,64,64,255],0x8060],[[2,0x190a,0x8043,0x8044,0x8045,0x8046,0x8047,0x8048],[64,64,64,96],0x8060],[[3,0x1907,0x2a10,0x804f,0x8050,0x8051,0x8052,0x8053,0x8054],[64,128,192,255],0x805c],[[4,0x1908,0x8055,0x8056,0x8057,0x8058,0x8059,0x805a,0x805b],[64,128,192,96],0x805f],[[0x1906,0x803b,0x803c,0x803d,0x803e],[255,255,255,96],0x805f],[[0x8049,0x804a,0x804b,0x804c,0x804d],[64,64,64,64],0x8061]];
 for(const[formats,want,component]of sizedFamilies)for(const internal of formats){image([64,128,192,96],{internal});level(0xde0,0,0x1003,internal,'requested internal retained');level(0xde0,0,component,8,'chosen component precision');draw();frame(Array(8).fill(want),'internal format '+internal);}
 // Single-component external formats insert zero RGB and unit alpha as specified.
 for(const[format,data,want]of[[0x1903,[64],[64,0,0,255]],[0x1904,[64],[0,64,0,255]],[0x1905,[64],[0,0,64,255]],[0x1906,[64],[0,0,0,64]],[0x1909,[64],[64,64,64,255]],[0x190a,[64,96],[64,64,64,96]],[0x1907,[64,128,192],[64,128,192,255]],[0x1900,[173],[0,0,0,0]]]){image(data,{width:1,format});draw();frame(Array(8).fill(want),'external format '+format);}
 // All component types use numerical normalization, rather than byte aliases.
 for(const[type,bytes,want]of[[0x1402,[0,128,255,127],[0,255]],[0x1403,[0,0,255,255],[0,255]],[0x1404,[0,0,0,128,255,255,255,127],[0,255]],[0x1405,[0,0,0,0,255,255,255,255],[0,255]],[0x1406,[0,0,128,62,0,0,64,63],[64,191]]]){image(bytes,{width:2,format:0x1909,internal:0x1909,type});draw();frame([...Array(4).fill([want[0],want[0],want[0],255]),...Array(4).fill([want[1],want[1],want[1],255])],'component type '+type);}
 call('glTexImage1D',[0xde0,0,0x1908,0,0,0x1908,0x1401,0xffffffff]);err(0,'zero width consumes no pixels');level(0xde0,0,0x1000,0,'zero width defined');draw();frame(Array(8).fill(white),'empty image incomplete');
 call('glTexImage1D',[0xde0,0,0x1908,4,0,0x1908,0x1401,0]);err(0,'null pixels allocate real storage');level(0xde0,0,0x1000,4,'null pixels retain dimensions');
 image(red);parameter(0x2802,0x2900);parameter(0x2800,0x2601);parameter(0x2801,0x2601);write(vector,ints([0,0,2147483647,2147483647]));call('glTexParameteriv',[0xde0,0x1004,vector]);draw();frame([[143,0,112,255],[175,0,80,255],[207,0,48,255],[239,0,16,255],[239,0,16,255],[207,0,48,255],[175,0,80,255],[143,0,112,255]],'object border linear width1',1);
 // Supplied end borders are texels, distinct from the object's border color.
 image([255,255,0,255,255,0,0,255,0,0,255,255,0,255,255,255],{width:4,border:1});
 parameter(0x2802,0x2900);parameter(0x2800,0x2601);parameter(0x2801,0x2601);
 draw();frame([[255,96,0,255],[255,32,0,255],[223,0,32,255],[159,0,96,255],[96,0,159,255],[32,0,223,255],[0,32,255,255],[0,96,255,255]],'supplied end border linear',1);
 write(pixels,Buffer.from([0,255,0,255]));call('glTexSubImage1D',[0xde0,0,-1,1,0x1908,0x1401,pixels]);draw();frame([[159,96,0,255],[223,32,0,255],[223,0,32,255],[159,0,96,255],[96,0,159,255],[32,0,223,255],[0,32,255,255],[0,96,255,255]],'subimage edits supplied left border',1);
 call('glTexSubImage1D',[0xde0,0,-2,1,0x1908,0x1401,0xffffffff]);err(0x501,'border subimage bounds');
 // Mip-level selection uses the derivative of S, despite constant/huge T.
 parameter(0x2802,0x2901);parameter(0x2800,0x2600);parameter(0x2801,0x2700);
 for(const[l,w,c]of[[0,8,red],[1,4,green],[2,2,blue],[3,1,white]])image(Array(w).fill(c).flat(),{level:l,width:w});
 for(const[span,c]of[[1,red],[2,green],[4,blue],[8,white]]){draw(0,span,4000,-8000);frame(Array(8).fill(c),'mip derivative span'+span);}
 parameter(0x2801,0x2702);draw(0,Math.SQRT2);frame(Array(8).fill([128,128,0,255]),'linear mip level blend',1);
 for(const filter of [0x2700,0x2701,0x2702,0x2703]){parameter(0x2801,filter);draw(0,4);frame(Array(8).fill(blue),'min filter '+filter);}
 parameter(0x2801,0x2600);draw(0,4);frame(Array(8).fill(red),'nonmipmap nearest minification');parameter(0x2801,0x2601);draw(0,4);frame(Array(8).fill(red),'nonmipmap linear minification');parameter(0x2801,0x2702);
 // Inconsistent required levels disable texturing; fixing them restores it.
 image(Array(2).fill(green).flat(),{level:1,width:2});draw(0,2);frame(Array(8).fill(white),'incomplete1d disabled');
 image(Array(4).fill(green).flat(),{level:1,width:4});parameter(0x2801,0x2700);draw(0,2);frame(Array(8).fill(green),'complete1d restored');
 // Client unpack addressing: aligned source row, skipped row and pixel.
 parameter(0x2801,0x2600);parameter(0x2800,0x2600);
 call('glPixelStorei',[0xcf5,8]);call('glPixelStorei',[0xcf2,3]);call('glPixelStorei',[0xcf3,1]);call('glPixelStorei',[0xcf4,1]);
 write(pixels,Buffer.alloc(64,17));write(pixels+19,Buffer.from([255,0,0,0,255,0,0,0,255,255,255,255]));
 call('glTexImage1D',[0xde0,0,0x1907,4,0,0x1907,0x1401,pixels]);draw();frame([red,red,green,green,blue,blue,white,white],'unpack aligned row and skips');
 for(const[p,v]of[[0xcf5,4],[0xcf2,0],[0xcf3,0],[0xcf4,0]])call('glPixelStorei',[p,v]);
 call('glPixelStorei',[0xcf0,1]);call('glPushClientAttrib',[1]);call('glPixelStorei',[0xcf0,0]);call('glPopClientAttrib');integer(0xcf0,1,'client unpack swap restored');const swapped=Buffer.alloc(16);[0,.25,.5,1].forEach((x,i)=>swapped.writeFloatBE(x,i*4));write(pixels,swapped);
 call('glTexImage1D',[0xde0,0,0x1909,4,0,0x1909,0x1406,pixels]);draw();frame([[0,0,0,255],[0,0,0,255],[64,64,64,255],[64,64,64,255],[128,128,128,255],[128,128,128,255],white,white],'unpack swap each float');call('glPixelStorei',[0xcf0,0]);
 // Proxy dimensions are recorded without accessing the inaccessible data.
 call('glTexImage1D',[0x8063,0,0x1908,8,0,0x1908,0x1401,0xffffffff]);err(0,'proxy ignores pointer');level(0x8063,0,0x1000,8,'proxy supported width');
 call('glTexImage1D',[0x8063,0,0x1908,4096,0,0x1908,0x1401,0xffffffff]);err(0,'proxy overlarge no error');level(0x8063,0,0x1000,0,'proxy unsupported width zero');level(0x8063,0,0x1003,0,'proxy unsupported internal zero');
 const proxyList=call('glGenLists',[1]);call('glNewList',[proxyList,0x1300]);call('glTexImage1D',[0x8063,0,0x1908,8,0,0x1908,0x1401,0xffffffff]);level(0x8063,0,0x1000,8,'proxy immediate during compilation');call('glEndList');call('glTexImage1D',[0x8063,0,0x1908,4,0,0x1908,0x1401,0xffffffff]);call('glCallList',[proxyList]);level(0x8063,0,0x1000,4,'proxy omitted from list');
 call('glTexImage1D',[0x8063,0,0x1908,0,1,0x1908,0x1401,0xffffffff]);err(0,'proxy null width border1 no data');level(0x8063,0,0x1005,1,'null proxy retains legal border');
 const beginList=call('glGenLists',[1]);call('glNewList',[beginList,0x1300]);call('glBegin',[4]);call('glTexImage1D',[0xde0,0,0x1908,4,0,0x1908,0x1401,0xffffffff]);err(0x502,'compiled Begin rejects image before pointer');call('glTexImage1D',[0x8063,0,0x1908,8,0,0x1908,0x1401,0xffffffff]);err(0,'proxy executes outside unexecuted compile-only Begin');level(0x8063,0,0x1000,8,'immediate proxy inside compile-only Begin');call('glEnd');call('glEndList');
 // Images and subimage inputs are copied at list compilation time.
 call('glBindTexture',[0xde0,1003]);parameter(0x2800,0x2600);parameter(0x2801,0x2600);
 const list=call('glGenLists',[1]);call('glNewList',[list,0x1300]);
 write(pixels,Buffer.from([255,0,0,255,0,255,0,255,0,0,255,255,255,255,255,255]));call('glTexImage1D',[0xde0,0,0x1908,4,0,0x1908,0x1401,pixels]);
 write(pixels,Buffer.from([255,255,0,255]));call('glTexSubImage1D',[0xde0,0,1,1,0x1908,0x1401,pixels]);call('glEndList');write(pixels,Buffer.alloc(16,0));
 level(0xde0,0,0x1000,0,'compile leaves image undefined');call('glCallList',[list]);draw();frame([red,red,[255,255,0,255],[255,255,0,255],blue,blue,white,white],'list input snapshots');
 // Integer vectors retain their compile-time values and exact arity in lists.
 const parameterList=call('glGenLists',[1]);write(vector,ints([0,1073741824,2147483647,-2147483648]));call('glNewList',[parameterList,0x1300]);call('glTexParameteriv',[0xde0,0x1004,vector]);call('glEndList');write(vector,ints([2147483647,0,0,2147483647]));call('glCallList',[parameterList]);call('glGetTexParameterfv',[0xde0,0x1004,output]);assert.deepStrictEqual([...Array(4)].map((_,i)=>read(output+4*i,4).readFloatLE()),[2.3283064365386963e-10,.5,1,0],'integer vector list snapshot');checks++;
 // Attribute restoration returns bindings, enables and object parameters.
 call('glPushAttrib',[0x40000]);call('glDisable',[0xde0]);call('glBindTexture',[0xde0,1004]);parameter(0x2800,0x2601);call('glPopAttrib');integer(0x8068,1003,'attribute binding restored');integer(0xde0,1,'attribute enable restored');draw();frame([red,red,[255,255,0,255],[255,255,0,255],blue,blue,white,white],'attribute sampler restored');
 call('glPushAttrib',[0x2000]);call('glDisable',[0xde0]);call('glPopAttrib');integer(0xde0,1,'enable bit restores1d');
 // Unit isolation: unit one has its own binding and enable.
 call('glActiveTextureARB',[0x84c1]);integer(0x8068,0,'unit1 default binding');integer(0xde0,0,'unit1 default enable');call('glBindTexture',[0xde0,1005]);parameter(0x2801,0x2600);parameter(0x2800,0x2600);image([17,34,51,255]);call('glTexEnvi',[0x2300,0x2200,0x1e01]);call('glEnable',[0xde0]);draw();frame(Array(8).fill([17,34,51,255]),'unit1 own1d image');call('glDisable',[0xde0]);call('glActiveTextureARB',[0x84c0]);integer(0x8068,1003,'unit0 binding isolated');integer(0xde0,1,'unit0 enable isolated');
 const second=call('wglCreateContext',[dc]);assert(second);assert.strictEqual(call('wglMakeCurrent',[dc,second]),1);integer(0x8068,0,'new context default binding');integer(0xde0,0,'new context disabled');assert.strictEqual(call('glIsTexture',[1003]),0,'name not shared');assert.strictEqual(call('wglMakeCurrent',[dc,context]),1);integer(0x8068,1003,'original context restored');integer(0xde0,1,'original context enable restored');
 // Exact vector widths: scalar pnames consume4B, border color consumes16B.
 for(const p of [0x60000000,0x61000000,0x60001000,0x62000000,0x62002000,0x65000000])assert(e.test_virtual_map_commit(p,4096));
 assert.notStrictEqual(wa(0x60001000)-wa(0x60000000),4096,'non-affine neighboring guest pages');
 write(0x65000ffc,ints([0x2600]));call('glTexParameteriv',[0xde0,0x2800,0x65000ffc]);err(0,'one-element vector at page end');
 write(0x65000ff0,ints([0,1073741824,2147483647,-2147483648]));call('glTexParameteriv',[0xde0,0x1004,0x65000ff0]);err(0,'four-element vector at page end');
 call('glGetTexParameterfv',[0xde0,0x1004,output]);assert.deepStrictEqual([...Array(4)].map((_,i)=>read(output+4*i,4).readFloatLE()),[2.3283064365386963e-10,.5,1,0],'signed integer border normalization');
 write(vector,ints([1]));call('glTexParameteriv',[0xde0,0x8066,vector]);call('glGetTexParameterfv',[0xde0,0x8066,output]);assert.strictEqual(read(output,4).readFloatLE(),1,'priority integer is numeric');
 write(0x60000ffd,ints([0x2600]));call('glTexParameteriv',[0xde0,0x2801,0x60000ffd]);err(0,'split scalar vector');
 write(0x60000fff,ints([536870912,1073741824,1610612736,2147483647]));call('glTexParameteriv',[0xde0,0x1004,0x60000fff]);call('glGetTexParameterfv',[0xde0,0x1004,output]);assert.deepStrictEqual([...Array(4)].map((_,i)=>read(output+4*i,4).readFloatLE()),[.25,.5,.75,1],'split border vector');
 function malformed(name,args,label){
  const used=e.gl_wat_stream_used(),count=e.probe_list_commands();
  assert.throws(()=>call(name,args),WebAssembly.RuntimeError,label);
  assert.strictEqual(dv.getUint32(regs+16,true),stack,label+' ESP unchanged');
  assert.strictEqual(e.gl_wat_stream_used(),used,label+' stream atomic');assert.strictEqual(e.probe_list_commands(),count,label+' list atomic');checks++;
 }
 malformed('glTexParameteriv',[0xde0,0x1004,0x65000ffc],'four-wide input requires16B');
 // Endpoints map, middle does not: check every consumed source page.
 malformed('glTexImage1D',[0xde0,0,0x1908,2048,0,0x1908,0x1401,0x62000004],'unmapped interior source page');
 image([255,0,0,255,0,255,0,255,0,0,255,255,255,255,255,255]);
 // Fully mapped but non-affine input crosses the boundary bytewise.
 write(0x60000ff9,Buffer.from([255,0,0,255,0,255,0,255,0,0,255,255,255,255,255,255]));call('glTexImage1D',[0xde0,0,0x1908,4,0,0x1908,0x1401,0x60000ff9]);draw();frame([red,red,green,green,blue,blue,white,white],'split non-affine image pixels');
 // Enums/values and BeginEnd reject before inaccessible data is touched.
 for(const[name,args,error]of[
  ['glTexImage1D',[0xde1,0,0x1908,4,0,0x1908,0x1401,0xffffffff],0x500],
  ['glTexImage1D',[0xde0,-1,0x1908,4,0,0x1908,0x1401,0xffffffff],0x501],
  ['glTexImage1D',[0xde0,0,0x1908,3,0,0x1908,0x1401,0xffffffff],0x501],
  ['glTexImage1D',[0xde0,0,0x1908,4,2,0x1908,0x1401,0xffffffff],0x501],
  ['glTexImage1D',[0xde0,0,0x1908,4,0,0x1902,0x1401,0xffffffff],0x500],
  ['glTexImage1D',[0xde0,0,0x1908,4,0,0x1908,0x1a00,0xffffffff],0x500],
  ['glTexParameteriv',[0xde0,0x1234,0xffffffff],0x500],
 ]){const used=e.gl_wat_stream_used();call(name,args);err(error,name+' invalid metadata');assert.strictEqual(e.gl_wat_stream_used(),used,'invalid no stream');}
 call('glBegin',[4]);const beginCount=e.probe_count();
 for(const[name,args]of[['glTexImage1D',[0xde0,0,0x1908,4,0,0x1908,0x1401,0xffffffff]],['glTexSubImage1D',[0xde0,0,0,4,0x1908,0x1401,0xffffffff]],['glTexParameteriv',[0xde0,0x1004,0xffffffff]]]){call(name,args);assert.strictEqual(e.probe_count(),beginCount,'Begin vertex count preserved');}
 call('glEnd');err(0x502,'BeginEnd rejects uploads and parameter');draw();frame([red,red,green,green,blue,blue,white,white],'invalid commands preserve image');
 if(queued){encoder.fence();assert(encoder.snapshot().glQueued>0,'real queue used');}
 err(0,'final error');const result={passed:true,route:queued?'queued':'direct',exports:names,checks,observations};
 if(process.env.GL_TEXTURE_1D_EVIDENCE)fs.writeFileSync(process.env.GL_TEXTURE_1D_EVIDENCE,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{if(encoder)encoder.stop();if(manager)await manager.stop();if(render)render.destroy();}
})().catch(error=>{console.error(error.stack||error);process.exit(1);});
