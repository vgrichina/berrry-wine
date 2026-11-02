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
 const queued=process.argv.includes('--worker'),mutation=process.env.GL_LIGHT_MATERIAL_QUERY_MUTATION,baseline=process.env.GL_LIGHT_MATERIAL_QUERY_BASELINE;
 let prebuiltModule;
 if(mutation||baseline){let changed=false;
  const bytes=req('test/compile-src').compileSrcWasm((file,source)=>{
   if(file==='13-exports.wat')return source+extraWat;
   if(baseline&&fs.existsSync(path.join(baseline,file))){changed=true;return fs.readFileSync(path.join(baseline,file),'utf8');}
   if(baseline)return source;
   const edits={
    normalized:['09a8b-handlers-opengl.wat','(if (call $gl_lmf_color (local.get $family) (local.get $name)) (then\n              (local.set $v','(if (i32.const 0) (then\n              (local.set $v'],
    numeric:['09a8b-handlers-opengl.wat','(if (call $gl_lmf_color (local.get $family) (local.get $name)) (then\n              (local.set $v','(if (i32.const 1) (then\n              (local.set $v'],
    pname:['09a8b-handlers-opengl.wat','(i32.eq (local.get $name) (i32.const 0x1602))','(i32.const 0)'],
    scalar:['09a8b-handlers-opengl.wat','(i32.trunc_sat_f64_s (f64.nearest (local.get $v)))','(i32.trunc_sat_f64_s (local.get $v))'],
    bias:['09a8b-handlers-opengl.wat','(f64.sub (f64.mul (local.get $v) (f64.const 4294967295)) (f64.const 1))','(f64.mul (local.get $v) (f64.const 4294967294))'],
    back:['09a8b-handlers-opengl.wat','(select (i32.const 11088) (i32.const 8880)','(select (i32.const 8880) (i32.const 8880)'],
    position:['09a8b-handlers-opengl.wat','(i32.const 0x1203)) (then\n              (local.set $src','(i32.const 0x1202)) (then\n              (local.set $src'],
    direction:['09a8b-handlers-opengl.wat','(i32.const 0x1204)) (then\n                (local.set $src','(i32.const 0x1205)) (then\n                (local.set $src'],
    width:['09a8b-handlers-opengl.wat','(br_if $values (i32.lt_u (local.get $i) (local.get $n)))','(br_if $values (i32.le_u (local.get $i) (local.get $n)))'],
    validation:['09a8b-handlers-opengl.wat','(call $gl_texcoord_check (local.get $out) (i32.shl (local.get $n) (i32.const 2)))','(call $gl_texcoord_check (local.get $out) (i32.const 1))'],
    begin:['09a8b-handlers-opengl.wat','(if (i32.ge_s (global.get $gl_immediate_mode) (i32.const 0))','(if (i32.const 0)'],
    compile:['09a8b-handlers-opengl.wat','(if (i32.eqz (local.get $error)) (then','(if (i32.and (i32.eqz (local.get $error)) (i32.eqz (i32.load offset=12 (local.get $ctx)))) (then'],
    face:['09a8b-handlers-opengl.wat','(i32.eq (local.get $target) (i32.const 0x405)))))','(i32.eq (local.get $target) (i32.const 0x408)))))'],
   };
   assert(edits[mutation],'known mutation');const [fileName,from,to]=edits[mutation];if(file!==fileName)return source;
   const at=source.indexOf('(func $handle_gl_lighting_query ');assert(at>=0,'query function');
   const body=source.slice(at);assert(body.includes(from),'mutation anchor '+mutation);changed=true;
   return source.slice(0,at)+body.replace(from,to);
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
 const names=['glGetLightfv','glGetLightiv','glGetMaterialfv','glGetMaterialiv'];
 for(const name of names)assert(call('wglGetProcAddress',[str(name)]),'dynamic query '+name);
 const vector=e.guest_alloc(64)>>>0,output=e.guest_alloc(64)>>>0;
 const bytes=(a,integer=false)=>{const b=Buffer.alloc(a.length*4);a.forEach((v,i)=>integer?b.writeInt32LE(v,i*4):b.writeFloatLE(v,i*4));return b;};
 const write=(p,b)=>{for(let i=0;i<b.length;i++)dv.setUint8(wa(p+i),b[i]);};
 const read=(p,n)=>Buffer.from(Array.from({length:n},(_,i)=>dv.getUint8(wa(p+i))));
 const set=(material,target,pname,a,integer=false)=>{write(vector,bytes(a,integer));call(material?(integer?'glMaterialiv':'glMaterialfv'):(integer?'glLightiv':'glLightfv'),[target,pname,vector]);};
 function query(name,target,pname,want,label,at=output+8){
  write(at-8,Buffer.alloc(40,0xa7));call(name,[target,pname,at]);
  const b=read(at,want.length*4),got=want.map((_,i)=>name.endsWith('iv')?b.readInt32LE(i*4):b.readFloatLE(i*4));
  assert.deepStrictEqual(got,want,label+' '+name);
  assert(read(at-8,8).every(v=>v===0xa7),label+' prefix');assert(read(at+want.length*4,32-want.length*4).every(v=>v===0xa7),label+' exact width');
  observations.push({label,name,actual:got,expected:want});checks++;
 }
 const both=(material,target,pname,floats,ints,label)=>{query(material?'glGetMaterialfv':'glGetLightfv',target,pname,floats,label);query(material?'glGetMaterialiv':'glGetLightiv',target,pname,ints,label);};
 // Independent GL1.1 table defaults, including light0 versus every other light.
 for(let l=0;l<8;l++){
  both(false,0x4000+l,0x1200,[0,0,0,1],[0,0,0,2147483647],'default ambient light'+l);
  for(const p of [0x1201,0x1202])both(false,0x4000+l,p,l?[0,0,0,1]:[1,1,1,1],l?[0,0,0,2147483647]:[2147483647,2147483647,2147483647,2147483647],'default color light'+l+'/'+p);
  both(false,0x4000+l,0x1203,[0,0,1,0],[0,0,1,0],'default position'+l);
  both(false,0x4000+l,0x1204,[0,0,-1],[0,0,-1],'default direction'+l);
  for(const [p,v] of [[0x1205,0],[0x1206,180],[0x1207,1],[0x1208,0],[0x1209,0]])both(false,0x4000+l,p,[v],[v],'default scalar'+l+'/'+p);
 }
 for(const face of [0x404,0x405]){
  both(true,face,0x1200,[0.20000000298023224,0.20000000298023224,0.20000000298023224,1],[429496735,429496735,429496735,2147483647],'default material ambient');
  both(true,face,0x1201,[0.800000011920929,0.800000011920929,0.800000011920929,1],[1717986943,1717986943,1717986943,2147483647],'default material diffuse');
  for(const p of [0x1202,0x1600])both(true,face,p,[0,0,0,1],[0,0,0,2147483647],'default material color');
  both(true,face,0x1601,[0],[0],'default shininess');both(true,face,0x1603,[0,1,1],[0,1,1],'default indexes');
 }
 for(const material of [false,true])for(const pname of material?[0x1200,0x1201,0x1202,0x1600]:[0x1200,0x1201,0x1202]){
  const target=material?0x404:0x4003;
  set(material,target,pname,[-1,0,.25,1]);both(material,target,pname,[-1,0,.25,1],[-2147483648,0,536870911,2147483647],'float signed normalized color');
  set(material,target,pname,[-.5,.5,.75,-.25]);both(material,target,pname,[-.5,.5,.75,-.25],[-1073741824,1073741823,1610612735,-536870912],'float intermediate color');
  set(material,target,pname,[-2147483648,0,1073741824,2147483647],true);
  both(material,target,pname,[-1,2.3283064365386963e-10,.5,1],[-2147483648,0,1073741823,2147483647],'integer normalized color stored as float');
 }
 // Numeric position and direction are stored in eye coordinates at setter time.
 // M=[2,1,0;0,3,0;0,0,4] with translation [5,-2,7]. Direction ignores translation.
 call('glMatrixMode',[0x1700]);write(vector,bytes([2,0,0,0,1,3,0,0,0,0,4,0,5,-2,7,1]));call('glLoadMatrixf',[vector]);
 set(false,0x4002,0x1203,[1.25,-2.5,3,2]);set(false,0x4002,0x1204,[1.25,-2.5,-3]);
 call('glLoadIdentity');call('glMatrixMode',[0x1701]);call('glScalef',[f(9),f(9),f(9)]);
 both(false,0x4002,0x1203,[10,-11.5,26,2],[10,-12,26,2],'stored transformed float position');
 both(false,0x4002,0x1204,[0,-7.5,-12],[0,-8,-12],'stored transformed float direction');
 call('glMatrixMode',[0x1700]);call('glTranslatef',[f(5),f(-2),f(7)]);
 set(false,0x4002,0x1203,[-3,2,1,1],true);set(false,0x4002,0x1204,[-3,2,-1],true);call('glLoadIdentity');
 both(false,0x4002,0x1203,[2,0,8,1],[2,0,8,1],'stored transformed integer position');
 both(false,0x4002,0x1204,[-3,2,-1],[-3,2,-1],'numeric integer direction');
 for(const [p,values] of [[0x1205,[[0,0],[128,128],[12.75,13]]],[0x1206,[[0,0],[90,90],[180,180],[45.25,45]]],[0x1207,[[0,0],[3.75,4]]],[0x1208,[[0,0],[2.25,2]]],[0x1209,[[0,0],[8.75,9]]]])for(const [v,integerResult] of values){
  set(false,0x4005,p,[v]);both(false,0x4005,p,[v],[integerResult],'scalar light '+p+'/'+v);
 }
 for(const [p,v] of [[0x1205,128],[0x1206,90],[0x1207,3],[0x1208,4],[0x1209,5]]){set(false,0x4006,p,[v],true);both(false,0x4006,p,[v],[v],'integer light scalar '+p);}
 set(false,0x4006,0x1209,[4294967296]);both(false,0x4006,0x1209,[4294967296],[2147483647],'oversize numeric saturates');
 for(const [v,integerResult] of [[0,0],[128,128],[11.75,12]]){set(true,0x405,0x1601,[v]);both(true,0x405,0x1601,[v],[integerResult],'shininess range '+v);}
 set(true,0x404,0x1603,[-3.75,2.25,9.75]);both(true,0x404,0x1603,[-3.75,2.25,9.75],[-4,2,10],'numeric material indexes');
 set(true,0x405,0x1603,[-9,7,4],true);both(true,0x405,0x1603,[-9,7,4],[-9,7,4],'integer indexes');
 set(true,0x404,0x1601,[37],true);set(false,0x4005,0x1205,[56],true);both(true,0x404,0x1601,[37],[37],'integer shininess');both(false,0x4005,0x1205,[56],[56],'integer exponent');
 set(true,0x404,0x1201,[.25,.5,.75,1]);set(true,0x405,0x1201,[1,.75,.5,.25]);
 both(true,0x404,0x1201,[.25,.5,.75,1],[536870911,1073741823,1610612735,2147483647],'front independent');
 both(true,0x405,0x1201,[1,.75,.5,.25],[2147483647,1610612735,1073741823,536870911],'back independent');
 const second=call('wglCreateContext',[dc]);call('wglMakeCurrent',[dc,second]);
 both(false,0x4005,0x1205,[0],[0],'new context light default');both(true,0x404,0x1601,[0],[0],'new context material default');
 set(true,0x404,0x1601,[77]);set(false,0x4005,0x1205,[99]);call('wglMakeCurrent',[dc,context]);
 both(true,0x404,0x1601,[37],[37],'restored context material');both(false,0x4005,0x1205,[56],[56],'restored context light');
 const unchanged=()=>{both(true,0x404,0x1601,[37],[37],'invalid call keeps material');both(false,0x4005,0x1205,[56],[56],'invalid call keeps light');};
 for(const name of names){const material=name.includes('Material');
  for(const [target,p] of material?[[0x408,0x1601],[0,0x1601],[0x404,0x1602],[0x404,0x1203],[0x404,0x1205],[0x404,0xdead]]:[[0x3fff,0x1205],[0x4008,0x1205],[0x4000,0x1601],[0x4000,0xdead]]){
   write(output,Buffer.alloc(64,0x6b));call(name,[target,p,output+8]);assert.strictEqual(call('glGetError'),0x500,'invalid enum '+name);assert(read(output,64).every(v=>v===0x6b));checks++;
   call(name,[target,p,0x65001000]);assert.strictEqual(call('glGetError'),0x500,'invalid enum ignores output');checks++;
  }
  write(output,Buffer.alloc(64,0x6b));call('glBegin',[0]);call(name,[material?0x404:0x4005,material?0x1601:0x1205,output+8]);call('glEnd');assert.strictEqual(call('glGetError'),0x502);assert(read(output,64).every(v=>v===0x6b));checks++;
 }
 for(const [material,target,p,a] of [[true,0x404,0x1601,[-1]],[true,0x404,0x1601,[129]],[false,0x4005,0x1205,[-1]],[false,0x4005,0x1205,[129]],[false,0x4005,0x1206,[91]],[false,0x4005,0x1207,[-1]]]){
  for(const integer of [false,true]){set(material,target,p,a,integer);assert.strictEqual(call('glGetError'),0x501);unchanged();}
 }
 // Each query runs immediately during compilation; none adds a list command.
 // A compiled Begin does not execute. Setters capture values and transform at playback.
 for(const mode of [0x1300,0x1301]){
  set(false,0x4005,0x1205,[56]);set(true,0x404,0x1601,[37]);const id=call('glGenLists',[1]);call('glNewList',[id,mode]);
  set(false,0x4005,0x1205,[24]);set(true,0x404,0x1601,[83]);
  for(const name of names)query(name,name.includes('Material')?0x404:0x4005,name.includes('Material')?0x1601:0x1205,[mode===0x1300?(name.includes('Material')?37:56):(name.includes('Material')?83:24)],'compile immediate query');
  assert.strictEqual(e.probe_list_commands(),2,'Get does not record');
  if(mode===0x1300){call('glBegin',[0]);query('glGetLightiv',0x4005,0x1205,[56],'shadow Begin query executes');call('glEnd');}
  call('glEndList');write(output,Buffer.alloc(64,0x71));set(false,0x4005,0x1205,[67]);set(true,0x404,0x1601,[69]);call('glCallList',[id]);assert(read(output,64).every(v=>v===0x71),'playback never writes old output');
  both(false,0x4005,0x1205,[24],[24],'list setter execution');both(true,0x404,0x1601,[83],[83],'list material execution');
 }
 call('glMatrixMode',[0x1700]);call('glLoadIdentity');call('glTranslatef',[f(1),f(2),f(3)]);
 const transformed=call('glGenLists',[1]);call('glNewList',[transformed,0x1300]);set(false,0x4004,0x1203,[2,3,4,1]);call('glEndList');
 call('glLoadIdentity');call('glTranslatef',[f(5),f(-2),f(7)]);call('glCallList',[transformed]);
 both(false,0x4004,0x1203,[7,1,11,1],[7,1,11,1],'list transforms setter at execution');call('glLoadIdentity');
 // Nonaffine sparse frame and output. The physical neighbor is an unrelated page.
 for(const p of [0x60000000,0x61000000,0x60001000,0x63000000,0x64000000,0x63001000,0x65000000])assert(e.test_virtual_map_commit(p,4096));
 assert.notStrictEqual(wa(0x60001000)-wa(0x60000000),4096);assert.notStrictEqual(wa(0x63001000)-wa(0x63000000),4096);
 new Uint8Array(memory.buffer,wa(0x61000000),4096).fill(0x7f);new Uint8Array(memory.buffer,wa(0x64000000),4096).fill(0x7e);
 for(const name of names){const material=name.includes('Material'),target=material?0x404:0x4004,pname=material?0x1603:0x1203;
  const want=material?[-3.75,2.25,9.75]:[7,1,11,1],ints=material?[-4,2,10]:want;
  query(name,target,pname,name.endsWith('iv')?ints:want,'split output',0x63000ffd);
  const at=0x60000ff9,out=0x63000fff,frame=Buffer.alloc(32,0xa7);frame.writeUInt32LE(0x12345678,8);frame.writeUInt32LE(target,12);frame.writeUInt32LE(pname,16);frame.writeUInt32LE(out,20);write(at-8,frame);write(out-8,Buffer.alloc(40,0x6b));
  dv.setUint32(regs+16,at,true);e.probe_invoke(resolve(name));assert.strictEqual(dv.getUint32(regs+16,true),at+16);assert.deepStrictEqual(read(at-8,32),frame,'split frame unchanged');
  const actual=read(out,want.length*4);assert.deepStrictEqual(want.map((_,i)=>name.endsWith('iv')?actual.readInt32LE(i*4):actual.readFloatLE(i*4)),name.endsWith('iv')?ints:want,'split frame values');checks++;
  // Every supported arity can end exactly at a sparse page boundary.
  for(const [p,values] of material?[[0x1601,[83]],[0x1603,[-3.75,2.25,9.75]],[0x1201,[.25,.5,.75,1]]]:[[0x1205,[0]],[0x1204,[0,0,-1]],[0x1203,[7,1,11,1]]]){
   const end=0x65001000,base=end-values.length*4;write(base-8,Buffer.alloc(values.length*4+8,0x4b));call(name,[target,p,base]);assert(read(base-8,8).every(v=>v===0x4b),'boundary prefix');checks++;
  }
 }
 function bad(name,at,args,label){const thunk=resolve(name);if(args){const frame=Buffer.alloc(16);frame.writeUInt32LE(0x12345678);args.forEach((x,i)=>frame.writeUInt32LE(x>>>0,4+i*4));write(at,frame);}
  for(let i=0;i<8;i++)dv.setUint32(regs+i*4,0x55660000+i,true);dv.setUint32(regs+16,at,true);dv.setUint32(regs,0xdeadbeef,true);
  const before=read(output,64),stored=Buffer.from(new Uint8Array(memory.buffer,e.probe_block(),11216)),used=e.gl_wat_stream_used();assert.throws(()=>e.probe_invoke(thunk),WebAssembly.RuntimeError,label);
  assert.strictEqual(dv.getUint32(regs+16,true),at,label+' ESP');assert.strictEqual(dv.getUint32(regs,true),0xdeadbeef,label+' EAX');assert.deepStrictEqual(read(output,64),before,label+' output');assert.strictEqual(e.gl_wat_stream_used(),used,label+' stream');assert.deepStrictEqual(Buffer.from(new Uint8Array(memory.buffer,e.probe_block(),11216)),stored,label+' stored state');checks++;
 }
 for(const name of names){const material=name.includes('Material'),target=material?0x404:0x4004,p=material?0x1201:0x1203;
  for(const out of [0x65001000,0x65000ff8,0xfffffff8]){write(0x65000ff8,Buffer.alloc(8,0x69));bad(name,stack,[target,p,out],'malformed output '+name);assert(read(0x65000ff8,8).every(v=>v===0x69),'partial output atomic');}
  for(const at of [0x64fffffc,0x65000ff4,0x65000ffa,0xfffffff8])bad(name,at,null,'malformed frame '+name);
 }
 assert(new Uint8Array(memory.buffer,wa(0x61000000),4096).every(x=>x===0x7f));assert(new Uint8Array(memory.buffer,wa(0x64000000),4096).every(x=>x===0x7e));
 both(false,0x4004,0x1203,[7,1,11,1],[7,1,11,1],'malformed calls preserve light');both(true,0x404,0x1601,[83],[83],'malformed calls preserve material');
 // Exercise the actual queued drawing route around native synchronous queries.
 call('glClearColor',[0,0,0,f(1)]);call('glClear',[0x4000]);call('glBegin',[4]);for(const v of [[-.5,-.5],[.5,-.5],[0,.5]])call('glVertex2f',v.map(f));call('glEnd');call('glFinish');
 if(queued){encoder.fence();assert(encoder.snapshot().glQueued>0,'real queue used');}
 assert.strictEqual(call('glGetError'),0);
 const result={passed:true,route:queued?'queued':'direct',exports:names,checks,observations};
 if(process.env.GL_LIGHT_MATERIAL_QUERY_EVIDENCE)fs.writeFileSync(process.env.GL_LIGHT_MATERIAL_QUERY_EVIDENCE,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{if(encoder)encoder.stop();if(manager)await manager.stop();if(render)render.destroy();}
})().catch(error=>{console.error(error.stack||error);process.exit(1);});
