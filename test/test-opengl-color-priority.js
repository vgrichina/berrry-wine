'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const root=process.env.WINE_ROOT||path.resolve(__dirname,'..'),req=p=>require(path.join(root,p));
const {bootRenderHarness}=req('test/render-helper'),{CALL_INDEX:O}=req('lib/gl-compat');
const Stream=req('lib/gl-command-stream');
const extraWat=`
 (func (export "contract_last_error") (result i32) (global.get $last_error))
 (func (export "contract_pending") (result i32) (global.get $d3dim_worker_pending))
 (func (export "contract_init")
   (global.set $thunk_guest_base (i32.add (global.get $image_base) (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
   (call $update_thunk_end))
 (func (export "contract_regs") (result i32) (global.get $reg_base))
 (func (export "contract_module") (param $name i32) (result i32)
   (call $handle_LoadLibraryA (local.get $name) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "contract_lookup") (param $module i32) (param $name i32) (result i32)
   (call $handle_GetProcAddress (local.get $module) (local.get $name) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "contract_invoke") (param $thunk i32) (result i32)
   (call $win32_dispatch (i32.div_u (i32.sub (local.get $thunk) (global.get $thunk_guest_base)) (i32.const 8))) (i32.load (global.get $reg_base)))(func (export "contract_dc") (result i32)
 (call $handle_GetDC (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
 (drop (call $gdi_dc_set_field (i32.load (global.get $reg_base)) (i32.const 92) (i32.const 42) (i32.const 0)))
 (i32.load (global.get $reg_base)))`;
async function run(){
 const baseline=process.env.GL_COLOR_PRIORITY_BASELINE;
 function gate(file,source){
  if(baseline&&['09a8b-handlers-opengl.wat','09b2-dispatch-table.generated.wat'].includes(file))
   source=fs.readFileSync(path.join(baseline,file),'utf8');
  return file==='13-exports.wat'?source+extraWat:source;
 }
 const queued=process.argv.includes('--worker');let owner=0;let encoder=null,manager=null,bridge=null,render=null,producer=null,memory;
 const captures=[],cases=[],events=[]; let prebuiltModule=null;
 const recordModule=bytes=>{const sha=require('crypto').createHash('sha256').update(bytes).digest('hex');console.log('NATIVE_MODULE_SHA256',sha,'bytes',bytes.length);if(process.env.GL_COLOR_PRIORITY_MODULE_OUT)fs.writeFileSync(process.env.GL_COLOR_PRIORITY_MODULE_OUT,bytes);};
 if(process.env.GL_COLOR_PRIORITY_MUTATION){
  const mutation=JSON.parse(fs.readFileSync(process.env.GL_COLOR_PRIORITY_MUTATION));let applied=false;
  const bytes=req('test/compile-src').compileSrcWasm((file,source)=>{
   if(file===mutation.file){assert.strictEqual(source.split(mutation.from).length-1,1,'unique mutation');source=source.replace(mutation.from,mutation.to);applied=true;}
   return gate(file,source);
  });assert(applied);recordModule(bytes);prebuiltModule=new WebAssembly.Module(bytes);
 }
 if(!prebuiltModule){
  const bytes=req('test/compile-src').compileSrcWasm(gate);
  recordModule(bytes);
  prebuiltModule=new WebAssembly.Module(bytes);
 }
 const h=await bootRenderHarness({fonts:'none',...(prebuiltModule?{prebuiltModule}:{extraWat}),width:64,height:64,extraHostOverrides:{gpu_gl_call(op,at,bytes){
  if(op===Stream.WAT_STREAM_FLUSH_OPCODE){
   const batch=Stream.memoryBatch(memory,at,bytes);events.push({owner,batch:Array.from(new Uint8Array(memory.buffer,at,bytes))});
   Stream.replay(batch,(op,aux,c)=>{if(op===Stream.PACKED_DRAW_OPCODE){
    const vertices=Array.from(new Float32Array(c.buffer,c.pointerOffset,c.pointerLength/4));
    const record=new Uint8Array(32+c.pointerLength),v=new DataView(record.buffer);
    const start=c.stackOffset-32;record.set(new Uint8Array(c.buffer,start,32));
    v.setUint32(0,record.length,true);v.setUint32(24,32,true);
    record.set(new Uint8Array(c.buffer,c.pointerOffset,c.pointerLength),32);
    captures.push({vertices,record:Array.from(record)});
   }return 0;});
   if(!render)return bridge.replay(Stream.memoryBatch(memory,at,bytes),owner);
   const reply=render.execute({memoryOffset:at,bytes,owner,windows:Object.values(renderer.windows),softwareFront:e.gl_sw_front()});producer.configure(reply.producerConfig);return reply.value;
  }
  return encoder?encoder.call(op,at,bytes):0;
 }}});
 memory=h.memory;let e=h.exports;const mainExports=e,dv=new DataView(memory.buffer),wa=p=>e.guest_to_wasm(p)>>>0;
 e.init_thread(1,0x400000,0,0,0,0,0);e.heap_init(0x800000);
 const renderer={windows:{42:{hwnd:42,w:64,h:64,clientRect:{w:64,h:64}}},repaint(){}};
 const GL=req('lib/gl-compat');bridge=new GL.OpenGLHostBridge({backend:'software',getMemory:()=>memory.buffer,exports:()=>e,renderer});
 if(queued){const {Worker}=require('worker_threads'),{Manager}=req('lib/render-worker'),{Encoder}=req('lib/d3d-command-stream');
  producer=new (req('lib/gl-software-producer').Producer)(()=>e);
  const consumer=new WebAssembly.Instance(h.module,{host:h.host});consumer.exports.d3dim_worker_init(e.get_image_base()>>>0);
  const Base=GL.OpenGLHostBridge;GL.OpenGLHostBridge=class extends Base {constructor(o){super(o);bridge=this;}};
  try{render=req('lib/gl-render-worker').create({instance:consumer,memory,backend:'software',sendFrame(){}});}finally{GL.OpenGLHostBridge=Base;}
  manager=new Manager({module:h.module,memory,sigs:req('lib/host-import-sigs.generated.json').sigs,imageBase:e.get_image_base()>>>0,workerFactory:()=>new Worker(path.join(root,'lib/d3d-render-worker.js')),reclaimHeap:head=>e.d3d_render_adopt_free_list(head)});
  await manager.ready;const port=manager.createEndpoint({api:'legacy',backend:'software'});await port.ready;
  // Use the production encoder's supported capacity option and require
  // every queued record to render without falling back to the direct path.
  encoder=new Encoder({module:h.module,memory,sigs:req('lib/host-import-sigs.generated.json').sigs,getImageBase:()=>e.get_image_base()>>>0,guestToWasm:wa,workerFactory:()=>port,capacity:0x400000,explicitFence:true,strictReady:true});assert(encoder.ready());
 }
 try {
 e.contract_init();const regs=e.contract_regs(),stackGuest=e.guest_alloc(256)>>>0,stack=wa(stackGuest),input=e.guest_alloc(1024)>>>0,output=e.guest_alloc(1024)>>>0;
 function str(s){const p=e.guest_alloc(s.length+1)>>>0;new Uint8Array(memory.buffer,wa(p),s.length+1).set(Buffer.from(s+'\0'));return p;}
 const module=e.contract_module(str('opengl32.dll'));assert(module);const resolved=new Map(),table=req('src/api_table.json');
 function call(name,args=[],float=false){
  const regs=e.contract_regs();
  if(!resolved.has(name)){dv.setUint32(regs+16,stackGuest,true);const p=e.contract_lookup(module,str(name))>>>0;assert(p,'real export '+name);assert.strictEqual(dv.getUint32(wa(p)+4,true),table.find(a=>a.name===name).id);resolved.set(name,p);}
  for(let i=0;i<8;i++)dv.setUint32(regs+i*4,0x55660000+i,true);
  dv.setUint32(regs+16,stackGuest,true);new Uint8Array(memory.buffer,stack,256).fill(0xa5);
  dv.setUint32(stack,0x12345678,true);args.forEach((v,i)=>(float===true||Array.isArray(float)&&float.includes(i))?dv.setFloat32(stack+4+i*4,v,true):dv.setUint32(stack+4+i*4,v>>>0,true));
  const before=Buffer.from(new Uint8Array(memory.buffer,stack,256)),value=e.contract_invoke(resolved.get(name))>>>0;
  assert.strictEqual(dv.getUint32(regs+16,true),stackGuest+4*(args.length+1),'stdcall '+name);
  for(let i=1;i<8;i++)if(i!==4)assert.strictEqual(dv.getUint32(regs+i*4,true),0x55660000+i,'register '+name);
  assert.deepStrictEqual(Buffer.from(new Uint8Array(memory.buffer,stack,256)),before,'stack canary '+name);return value;
 }
 for(const name of process.env.GL_COLOR_PRIORITY_EXPORT_ONLY?[process.env.GL_COLOR_PRIORITY_EXPORT_ONLY]:['glColor4d','glPrioritizeTextures']) {
  const p=e.contract_lookup(module,str(name))>>>0;assert(p,'real export '+name);
  const w=call('wglGetProcAddress',[str(name)]);assert(w,'WGL export '+name);
 }
 if(process.env.GL_COLOR_PRIORITY_EXPORT_ONLY)return {passed:true};
 const dc=e.contract_dc()>>>0;
 function make(){const c=call('wglCreateContext',[dc]);assert(c);return c;}
 const a=make(),b=make(),u=make();
 const current=c=>assert.strictEqual(call('wglMakeCurrent',[dc,c]),1);
 const error=()=>call('glGetError');
 const get=p=>{call('glGetIntegerv',[p,output]);return dv.getInt32(wa(output),true);};
 const ptr=wa(input),out=wa(output);
 const parameter=(target,p)=>{call('glGetTexParameteriv',[target,p,output]);return dv.getInt32(out,true);};
 const gen=()=>{call('glGenTextures',[1,output]);return dv.getUint32(out,true);};
 const list=(n,color)=>{call('glNewList',[n,0x1300]);call('glColor4f',color,true);call('glEndList');};
 // GLdouble occupies two physical stack words in the actual stdcall ABI.
 const regularCall=call;
 function doubles(name,args){
  const words=[];for(const v of args){const buf=new ArrayBuffer(8),d=new DataView(buf);d.setFloat64(0,v,true);words.push(d.getUint32(0,true),d.getUint32(4,true));}return regularCall(name,words);
 }
 function draw(name,rgb,alpha=255){
  call('glClear',[0x4000]);call('glBegin',[7]);
  for(const [x,y,s,t] of [[8,8,0,0],[56,8,1,0],[56,56,1,1],[8,56,0,1]]){call('glTexCoord2f',[s,t],true);call('glVertex2f',[x,y],true);}call('glEnd');call('glFinish');if(encoder)encoder.fence();
  const entry=e.gl_sw_entry()>>>0,pitch=dv.getUint16(entry+18,true),height=dv.getUint16(entry+14,true),dib=dv.getUint32(entry+20,true);
  assert.strictEqual(dv.getUint32(dib+(height-1-32)*pitch+32*4,true)&0xffffff,rgb,name);
  events.push({owner,check:{name,pixel:[(rgb>>>16)&255,(rgb>>>8)&255,rgb&255,alpha]}});cases.push(name);
 }
 function image(target,name,rgba){
  call('glBindTexture',[target,name]);call('glTexParameteri',[target,0x2801,0x2600]);call('glTexParameteri',[target,0x2800,0x2600]);
  new Uint8Array(memory.buffer,ptr,4).set(rgba);
  if(target===0xde1)call('glTexImage2D',[target,0,0x1908,1,1,0,0x1908,0x1401,input]);
  else call('glTexImage1D',[target,0,0x1908,1,0,0x1908,0x1401,input]);
 }


 const observations=[];
 const checkError=(value,label)=>assert.strictEqual(error(),value,label);
 function setup(c){current(c);call('glViewport',[0,0,64,64]);call('glMatrixMode',[0x1701]);call('glLoadIdentity');doubles('glOrtho',[0,64,0,64,-1,1]);call('glMatrixMode',[0x1700]);call('glLoadIdentity');call('glClearColor',[0,0,0,1],true);call('glDisable',[0xde1]);}
 function color(expected,integers,label){
  for(const [api,width,read,want] of [
   ['glGetFloatv',4,'getFloat32',expected],['glGetDoublev',8,'getFloat64',expected],
   ['glGetIntegerv',4,'getInt32',integers],['glGetBooleanv',1,'getUint8',expected.map(v=>v===0?0:1)]]){
   new Uint8Array(memory.buffer,out,64).fill(0xa7);call(api,[0xb00,output+9]);
   const got=Array.from({length:4},(_,i)=>dv[read](out+9+i*width,true));
   assert.deepStrictEqual(got,want,label+' '+api);
   assert(new Uint8Array(memory.buffer,out,9).every(v=>v===0xa7),'color prefix canary');
   assert(new Uint8Array(memory.buffer,out+9+4*width,55-4*width).every(v=>v===0xa7),'color exact output width');
   observations.push({label,api,got});
  }checkError(0,label+' error');
 }
 const T1=0xde0,T2=0xde1,PR=0x8066;
 function priority(target,want,integer,label){
  for(const [api,reader,value] of [['glGetTexParameterfv','getFloat32',want],['glGetTexParameteriv','getInt32',integer]]){
   new Uint8Array(memory.buffer,out,32).fill(0xc9);call(api,[target,PR,output+9]);
   assert.strictEqual(dv[reader](out+9,true),value,label+' '+api);
   assert(new Uint8Array(memory.buffer,out,9).every(v=>v===0xc9),'priority prefix canary');
   assert(new Uint8Array(memory.buffer,out+13,19).every(v=>v===0xc9),'priority exact4 canary');
   observations.push({label,api,value});
  }
  call('glFinish');if(encoder)encoder.fence();
  const actual=bridge._current().frontend.getTexParameter(PR,target)[0];
  assert.strictEqual(actual,want,label+' actual frontend priority');
  events.push({owner,priority:{target,value:want,label}});checkError(0,label+' error');
 }
 function prioritize(names,values,{np=input+1,vp=input+513}={}){
  names.forEach((n,i)=>dv.setUint32(wa(np+i*4),n,true));values.forEach((v,i)=>dv.setFloat32(wa(vp+i*4),v,true));
  call('glPrioritizeTextures',[names.length,np,vp]);
 }
 function remove(name){dv.setUint32(ptr,name,true);call('glDeleteTextures',[1,input]);}
 setup(a);
 for(const p of [0x60000000,0x61000000,0x60001000,0x63000000,0x64000000,0x63001000])assert(e.test_virtual_map_commit(p,4096));
 assert.notStrictEqual(wa(0x60001000)-wa(0x60000000),4096,'non-affine stack/name pages');
 assert.notStrictEqual(wa(0x63001000)-wa(0x63000000),4096,'non-affine priority pages');
 const write=(p,b)=>b.forEach((v,i)=>dv.setUint8(wa(p+i),v));
 const read=(p,n)=>Buffer.from(Array.from({length:n},(_,i)=>dv.getUint8(wa(p+i))));
 doubles('glColor4d',[1,0,1,.5]);
 const splitStack=0x60000ffb,frame=Buffer.alloc(52,0xa6);frame.writeUInt32LE(0x12345678,8);
 [1,0,1,.5].forEach((v,i)=>frame.writeDoubleLE(v,12+i*8));write(splitStack-8,frame);
 dv.setUint32(regs+16,splitStack,true);e.contract_invoke(resolved.get('glColor4d'));
 assert.strictEqual(dv.getUint32(regs+16,true),splitStack+36,'split double scalar cleanup');
 assert.deepStrictEqual(read(splitStack-8,52),frame,'split double scalar stack canary');
 color([1,0,1,.5],[2147483647,0,2147483647,1073741823],'non-affine physical double frame');
 doubles('glColor4d',[-.25,.5,1.25,.25]);
 color([-.25,.5,1.25,.25],[-536870912,1073741823,2147483647,536870911],'unclamped current doubles');
 // Nonzero low double words detect reading only the high words or integer casts.
 doubles('glColor4d',[.1,.2,.3,.4]);
 color([0.10000000149011612,0.20000000298023224,0.30000001192092896,0.4000000059604645],
  [214748367,429496735,644245119,858993471],'single canonical demotion');
 doubles('glColor4d',[-.25,.5,1.25,1]);draw('double current clamped at draw',0x0080ff);
 doubles('glColor4d',[1,0,0,.25]);call('glEnable',[0xbe2]);call('glBlendFunc',[0x302,0x303]);call('glColorMask',[1,1,1,0]);
 draw('fourth double controls source alpha',0x400000);call('glDisable',[0xbe2]);call('glColorMask',[1,1,1,1]);
 call('glBegin',[7]);doubles('glColor4d',[0,1,0,1]);
 for(const [x,y] of [[8,8],[56,8],[56,56],[8,56]])call('glVertex2f',[x,y],true);
 call('glEnd');color([0,1,0,1],[0,2147483647,0,2147483647],'legal color inside Begin');draw('color set inside Begin green',0x00ff00);
 const cl=call('glGenLists',[1]);call('glNewList',[cl,0x1300]);doubles('glColor4d',[1,0,0,1]);call('glEndList');
 color([0,1,0,1],[0,2147483647,0,2147483647],'compile leaves color unchanged');
 call('glCallList',[cl]);draw('compiled doubles captured despite overwritten stack',0xff0000);
 const ce=call('glGenLists',[1]);call('glNewList',[ce,0x1301]);doubles('glColor4d',[0,0,1,.5]);call('glEndList');
 color([0,0,1,.5],[0,0,2147483647,1073741823],'compile and execute color');
 doubles('glColor4d',[1,0,0,1]);call('glCallList',[ce]);draw('compile and execute color replay blue',0x0000ff,128);
 setup(u);color([1,1,1,1],[2147483647,2147483647,2147483647,2147483647],'context local default color');
 current(a);color([0,0,1,.5],[0,0,2147483647,1073741823],'context local color restored');

 // Empty and negative calls must not inspect either array, including bad pointers.
 call('glPrioritizeTextures',[0,0xfffffff0,0xfffffff0]);checkError(0,'zero count ignores pointers');
 call('glPrioritizeTextures',[-1,0xfffffff0,0xfffffff0]);checkError(0x501,'negative count before pointer read');
 for(const n of [0,1,-1]){call('glBegin',[4]);call('glPrioritizeTextures',[n,0xfffffff0,0xfffffff0]);call('glEnd');checkError(0x502,'Begin rejects count '+n);}
 const t=gen(),one=gen(),reserved=gen();image(T2,t,[255,0,0,255]);image(T1,one,[0,255,0,255]);
 call('glBindTexture',[T2,t]);priority(T2,1,1,'new texture priority');
 const sn=0x60000fff,sv=0x63000ffe,nb=Buffer.alloc(8),vb=Buffer.alloc(8);nb.writeUInt32LE(t);nb.writeUInt32LE(one,4);vb.writeFloatLE(.25);vb.writeFloatLE(.75,4);write(sn,nb);write(sv,vb);
 call('glPrioritizeTextures',[2,sn,sv]);priority(T2,.25,0,'non-affine unaligned names and priorities');priority(T1,.75,1,'non-affine second pair');
 prioritize([t],[-3]);priority(T2,0,0,'clamp negative');
 prioritize([t],[4]);priority(T2,1,1,'clamp above one');
 prioritize([t,t],[.25,.75]);priority(T2,.75,1,'duplicate last wins');
 prioritize([one,t],[.25,.25]);priority(T1,.25,0,'one dimensional by-name');priority(T2,.25,0,'two dimensional by-name');
 call('glBindTexture',[T2,0]);call('glTexParameterf',[T2,PR,.75],[2]);
 prioritize([0,reserved,0x7ffffffd],[0,.25,1]);priority(T2,.75,1,'default name silently ignored');
 assert.strictEqual(call('glIsTexture',[reserved]),0,'reservation not instantiated');assert.strictEqual(call('glIsTexture',[0x7ffffffd]),0,'unused not instantiated');
 call('glActiveTextureARB',[0x84c1]);call('glBindTexture',[T2,t]);prioritize([t],[.75]);priority(T2,.75,1,'unit independent priority');call('glActiveTextureARB',[0x84c0]);
 call('glBindTexture',[T2,t]);priority(T2,.75,1,'binding unit0 unchanged');
 call('glTexParameterf',[T2,PR,.25],[2]);priority(T2,.25,0,'bound setter query consistency');
 // Every-page array validation and non-affine scalar loads are exercised by
 // an unaligned three-page allocation, with ignored names around one live name.
 const wide=e.guest_alloc(20000)>>>0,nwide=2100,wp=wide+1,vp=wide+10001;
 for(let i=0;i<nwide;i++){dv.setUint32(wa(wp+i*4),i===1040?t:0,true);dv.setFloat32(wa(vp+i*4),.75,true);}
 call('glPrioritizeTextures',[nwide,wp,vp]);priority(T2,.75,1,'arrays span more than two pages');
 const pl=call('glGenLists',[1]);call('glNewList',[pl,0x1300]);prioritize([t],[.25]);call('glEndList');
 dv.setUint32(ptr+1,0,true);dv.setFloat32(ptr+513,.75,true);priority(T2,.75,1,'compile leaves priority unchanged');
 call('glCallList',[pl]);priority(T2,.25,0,'list snapshots both arrays');
 const future=0x7654,fl=call('glGenLists',[1]);call('glNewList',[fl,0x1300]);prioritize([future],[.75]);call('glEndList');
 assert.strictEqual(call('glIsTexture',[future]),0,'compile unused name does not instantiate');call('glBindTexture',[T2,future]);call('glCallList',[fl]);priority(T2,.75,1,'list resolves future name at execution');
 const el=call('glGenLists',[1]);call('glNewList',[el,0x1301]);prioritize([future],[.25]);call('glEndList');priority(T2,.25,0,'compile and execute priority');
 prioritize([future],[.75]);call('glCallList',[el]);priority(T2,.25,0,'compile and execute priority replay');
 const zl=call('glGenLists',[1]);call('glNewList',[zl,0x1300]);call('glPrioritizeTextures',[0,0xfffffff0,0xfffffff0]);call('glEndList');
 for(const l of [pl,zl]){call('glBegin',[4]);call('glCallList',[l]);call('glEnd');checkError(0x502,'list priority rejected during Begin '+l);}
 const bad=call('glGenLists',[1]);call('glNewList',[bad,0x1300]);call('glBegin',[4]);call('glPrioritizeTextures',[1,0xfffffff0,0xfffffff0]);call('glEnd');call('glEndList');checkError(0x502,'compile shadow Begin rejects before pointer read');
 call('glCallList',[bad]);checkError(0,'invalid command not compiled');
 call('glBindTexture',[T2,t]);call('glEnable',[T2]);call('glTexEnvi',[0x2300,0x2200,0x1e01]);prioritize([t],[0]);
 call('glAreTexturesResident',[1,wp,output]); // wp begins with ignored zero: error, then actual live control.
 checkError(0x501,'invalid residency name still rejected');dv.setUint32(ptr,t,true);new Uint8Array(memory.buffer,out,32).fill(0xa7);
 assert.strictEqual(call('glAreTexturesResident',[1,input,output+9]),1,'priority zero remains resident');assert(new Uint8Array(memory.buffer,out,32).every(v=>v===0xa7),'all-resident output untouched');
 draw('priority zero preserves red image',0xff0000);
 // Isolated context's same name and shared surviving/retired generations.
 setup(u);image(T2,t,[0,0,255,255]);priority(T2,1,1,'isolated name priority default');prioritize([t],[.75]);
 setup(b);assert.strictEqual(call('wglShareLists',[a,b]),1,'share live namespace');call('glBindTexture',[T2,t]);priority(T2,0,0,'shared namespace priority');
 prioritize([t],[.25]);current(a);priority(T2,.25,0,'shared mutation visible to creator');remove(t);
 current(b);prioritize([t],[.75]);priority(T2,.25,0,'deleted name cannot reprioritize retained binding');call('glEnable',[T2]);call('glTexEnvi',[0x2300,0x2200,0x1e01]);draw('retired generation remains red',0xff0000);
 current(a);image(T2,t,[0,255,0,255]);call('glCallList',[pl]);priority(T2,.25,0,'list resolves reused name new generation');prioritize([t],[.75]);priority(T2,.75,1,'reused name new priority');
 current(b);priority(T2,.25,0,'old generation priority unchanged after reuse');draw('old generation still red after reuse',0xff0000);call('glBindTexture',[T2,t]);priority(T2,.75,1,'rebind sees new generation');draw('new generation green',0x00ff00);
 current(u);priority(T2,.75,1,'isolated priority survives other namespace changes');call('glEnable',[T2]);call('glTexEnvi',[0x2300,0x2200,0x1e01]);draw('isolated generation blue',0x0000ff);
 current(b);assert.strictEqual(call('wglDeleteContext',[a]),1,'delete creator context');prioritize([t],[.25]);priority(T2,.25,0,'shared objects survive creator context');draw('shared image survives creator context',0x00ff00);
 checkError(0,'final GL error');
 let queue=null;if(encoder){encoder.fence();queue=encoder.snapshot();assert(queue.glQueued>0,'actual software queue used');assert.strictEqual(queue.fallbacks,0,'zero queue fallbacks');}
 const result={passed:true,queued,cases,events,observations,queue};
 if(process.env.GL_COLOR_PRIORITY_OUT)fs.writeFileSync(process.env.GL_COLOR_PRIORITY_OUT,JSON.stringify(result));
 console.log('PASS color priority',JSON.stringify({queued,cases:cases.length,queries:observations.length,queue}));return result;
 } finally {encoder?.stop();if(manager)await manager.stop();if(render)render.destroy();else if(bridge)bridge.destroy();}
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={run};
