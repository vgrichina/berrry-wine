'use strict';
// Full transaction qualification: literal selected/all state, atomic failures,
// isolation, immutable actual native Worker draws and resolved public stdcall.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const root=process.cwd(),req=p=>require(path.join(root,p));
const {CALL_INDEX:O,OpenGLHostBridge}=req('lib/gl-compat'),Stream=req('lib/gl-command-stream');
async function main(){
 const publicRoute=process.argv.includes('--public')||(!process.env.GL_COPY_MODULE&&!process.argv.includes('--native'));
 const extraWat=`
 (func (export "copy_lookup") (param $library i32) (param $name i32) (result i32)
   (local $module i32) (local $thunk i32)
   (global.set $thunk_guest_base (i32.add (global.get $image_base) (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
   (call $update_thunk_end)
   (call $handle_LoadLibraryA (local.get $library) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
   (local.set $module (i32.load (global.get $reg_base)))
   (call $handle_GetProcAddress (local.get $module) (local.get $name) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
   (local.set $thunk (i32.load (global.get $reg_base)))
   (call $handle_gpu_api (i32.const 50) (i32.const 1) (local.get $name) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
   (if (i32.eqz (local.get $thunk)) (then (return (i32.const 0))))
   (if (i32.eqz (i32.load (global.get $reg_base))) (then (unreachable)))
   (if (i32.ne (i32.load offset=4 (call $g2w (local.get $thunk)))
     (i32.load offset=4 (call $g2w (i32.load (global.get $reg_base))))) (then (unreachable)))
   (local.get $thunk))
 (func (export "copy_regs") (result i32) (global.get $reg_base))
 (func (export "copy_invoke") (param $thunk i32) (result i32)
   (call $win32_dispatch (i32.div_u (i32.sub (local.get $thunk) (global.get $thunk_guest_base)) (i32.const 8)))
   (i32.load (global.get $reg_base)))`;
 const bytes=publicRoute?req('test/compile-src').compileSrcWasm((file,text)=>file==='13-exports.wat'?text+extraWat:text):process.env.GL_COPY_MODULE?fs.readFileSync(process.env.GL_COPY_MODULE):req('test/compile-src').compileSrcWasm();
 if(process.env.GL_COPY_MODULE_OUT)fs.writeFileSync(process.env.GL_COPY_MODULE_OUT,bytes);
 console.log('TRANSACTION_MODULE',bytes.length,crypto.createHash('sha256').update(bytes).digest('hex'));
 const module=new WebAssembly.Module(bytes);
 const queued=process.argv.includes('--worker');
 let memory,e,owner=1,drawTarget=42,bridge,render,producer,manager,encoder,delay=false;const events=[],captures=[],delayed=[];
 const h=await req('test/render-helper').bootRenderHarness({fonts:'none',width:64,height:64,prebuiltModule:module,
  extraHostOverrides:{gpu_gl_call(op,at,used){
   if(op>=0x20000&&op<=0x20006)return encoder?encoder.call(op,at,used):0;
   assert.strictEqual(op,Stream.WAT_STREAM_FLUSH_OPCODE);
   const batch=Stream.memoryBatch(memory,at,used);Stream.replay(batch,op=>{events.push({owner,op});return 0;});
   captures.push({owner,bytes:Array.from(new Uint8Array(memory.buffer,at,used))});
   if(!render)return bridge.replay(batch,owner);
   const reply=render.execute({memoryOffset:at,bytes:used,owner,windows:[42,43].map(hwnd=>({hwnd,w:64,h:64,clientRect:{w:64,h:64}})),softwareFront:e.gl_sw_front()});
   producer.configure(reply.producerConfig);return reply.value;}}});
 memory=h.memory;e=h.exports;const source=e,dv=new DataView(memory.buffer);
 source.init_thread(1,0x400000,0,0,0,0,0);source.heap_init(0x800000);
 bridge=new OpenGLHostBridge({backend:'software',getMemory:()=>memory.buffer,exports:()=>e,
  renderer:{windows:Object.fromEntries([42,43].map(hwnd=>[hwnd,{hwnd,w:64,h:64,clientRect:{w:64,h:64}}])),repaint(){}}});
 if(queued){
  const GL=req('lib/gl-compat'),{Worker}=require('worker_threads');
  producer=new(req('lib/gl-software-producer').Producer)(()=>e);
  const consumer=new WebAssembly.Instance(module,{host:h.host});consumer.exports.d3dim_worker_init(0x400000);
  bridge.destroy();const Base=GL.OpenGLHostBridge;
  GL.OpenGLHostBridge=class extends Base{constructor(options){super(options);bridge=this;}};
  try{render=req('lib/gl-render-worker').create({instance:consumer,memory,backend:'software',sendFrame(){}});}finally{GL.OpenGLHostBridge=Base;}
  manager=new(req('lib/render-worker').Manager)({module,memory,sigs:req('lib/host-import-sigs.generated.json').sigs,imageBase:0x400000,
   workerFactory:()=>new Worker(path.join(root,'lib/d3d-render-worker.js')),reclaimHeap:head=>source.d3d_render_adopt_free_list(head)});
  await manager.ready;const port=manager.createEndpoint({api:'legacy',backend:'software'});await port.ready;
  const transport={postMessage(msg){if(delay&&msg.t==='batch')delayed.push(msg);else port.postMessage(msg);},
   set onmessage(fn){port.onmessage=fn;},set onerror(fn){port.onerror=fn;},terminate(){return port.terminate();}};
  encoder=new(req('lib/d3d-command-stream').Encoder)({module,memory,sigs:req('lib/host-import-sigs.generated.json').sigs,
   getImageBase:()=>0x400000,guestToWasm:p=>e.guest_to_wasm(p)>>>0,workerFactory:()=>transport,capacity:0x400000,explicitFence:true,strictReady:true});
  assert(encoder.ready());encoder.releaseHeld=()=>{delay=false;for(const msg of delayed.splice(0))port.postMessage(msg);};
 }
 const stackGuest=e.guest_alloc(256)>>>0,stack=e.guest_to_wasm(stackGuest)>>>0,out=e.guest_alloc(256)>>>0,wa=p=>e.guest_to_wasm(p)>>>0;
 const publicThunks=new Map();
 function publicCopy(){
  if(!publicThunks.has(e)) {
   const str=s=>{const p=e.guest_alloc(s.length+1)>>>0;new Uint8Array(memory.buffer,e.guest_to_wasm(p),s.length+1).set(Buffer.from(s+'\0'));return p;};
   const thunk=e.copy_lookup(str('opengl32.dll'),str('wglCopyContext'))>>>0;
   assert(thunk,'qualified public copy must resolve through both lookup paths');publicThunks.set(e,thunk);
  }
  const regs=e.copy_regs();for(let i=0;i<8;i++)dv.setUint32(regs+i*4,0x55660000+i,true);
  dv.setUint32(regs+16,stackGuest,true);
  const before=Buffer.from(new Uint8Array(memory.buffer,stack,256));
  const value=e.copy_invoke(publicThunks.get(e))>>>0;
  assert.strictEqual(dv.getUint32(regs+16,true),stackGuest+16,'copy stdcall');
  for(let i=1;i<8;i++)if(i!==4)assert.strictEqual(dv.getUint32(regs+i*4,true),0x55660000+i,'copy register isolation');
  assert.deepStrictEqual(Buffer.from(new Uint8Array(memory.buffer,stack,256)),before,'copy guest stack canary');return value;
 }
 function call(name,args=[],floats=[]){assert(Number.isInteger(typeof name==='number'?name:O[name]),name);dv.setUint32(stack,0,true);
  args.forEach((v,i)=>floats.includes(i)?dv.setFloat32(stack+4+i*4,v,true):dv.setUint32(stack+4+i*4,v>>>0,true));
  if(publicRoute&&name===0x10005)return publicCopy();
  return e.gl_wat_encoder_call(typeof name==='number'?name:O[name],stack,drawTarget)>>>0;}
 const bind=c=>assert.strictEqual(call('wglMakeCurrent',[c?123:0,c]),1);
 const query=(p,n=1)=>{new Uint32Array(memory.buffer,wa(out),n).fill(0xdeadbeef);call('glGetIntegerv',[p,out]);return Array.from(new Uint32Array(memory.buffer,wa(out),n));};
 try {
  const a=call('wglCreateContext',[0]),b=call('wglCreateContext',[0]);assert(a&&b&&a!==b);bind(a);
  const other=new WebAssembly.Instance(module,{host:h.host}).exports;
  other.init_thread(2,0x400000,0,0,0,0,0);other.heap_init(0x1000000);
  const checkpoints=[],leases=[],checks=[],eq=(name,actual,expected)=>{assert.deepStrictEqual(actual,expected,name);checks.push({name,actual,expected});};
  const switchTo=(p,id)=>{e=p;owner=id;drawTarget=42;if(!queued)new(req('lib/gl-software-producer').Producer)(()=>e).configure([1,64,64,0]);};
  const q=(p,n=1)=>{new Uint8Array(memory.buffer,wa(out),n*8).fill(0xa5);call('glGetDoublev',[p,out]);return Array.from({length:n},(_,i)=>dv.getFloat64(wa(out)+i*8,true));};
  const setup=(src)=>{
   call('glColor4f',src?[0,0,1,1]:[1,0,0,1],[0,1,2,3]);
   call('glNormal3f',src?[.25,.5,.75]:[0,0,1],[0,1,2]);call('glTexCoord2f',src?[.25,.75]:[.5,.5],[0,1]);
   call('glPointSize',[src?5:2],[0]);call('glLineWidth',[src?7:3],[0]);
   call('glLineStipple',src?[3,0xa5a5]:[2,0x5a5a]);
   call('glPolygonMode',[0x404,src?0x1b01:0x1b02]);call('glPolygonMode',[0x405,src?0x1b00:0x1b02]);
   call('glPolygonOffset',src?[2,4096]:[0,0],[0,1]);call('glCullFace',[src?0x404:0x405]);call('glFrontFace',[src?0x900:0x901]);
   call('glPixelTransferf',[0xd14,src?2:1],[1]);call('glPixelZoom',src?[2,-1]:[1,1],[0,1]);call('glReadBuffer',[src?0x404:0x405]);
   call('glColorMaterial',[src?0x404:0x408,src?0x1202:0x1602]);
   call('glShadeModel',[src?0x1d00:0x1d01]);
   new Float32Array(memory.buffer,wa(out),4).set(src?[.5,.25,.125,1]:[.125,.5,.25,1]);call('glLightModelfv',[0xb53,out]);
   call('glFogi',[0xb65,src?0x2601:0x800]);call('glFogf',[0xb62,src?2:1],[1]);
   new Float32Array(memory.buffer,wa(out),4).set(src?[0,1,1,1]:[1,0,1,1]);call('glFogfv',[0xb66,out]);
   call('glDepthFunc',[src?0x206:0x201]);call('glDepthMask',[src?0:1]);
   call('glClearDepth',[0,src?0:0x3ff00000]);
   call('glClearAccum',src?[1,0,-1,1]:[0,0,0,0],[0,1,2,3]);
   call('glStencilMask',[src?0x35:0xff]);call('glStencilFunc',[src?0x202:0x207,src?3:0,src?0x7f:0xff]);
   call('glStencilOp',src?[0x1e01,0x1e02,0x1e03]:[0x1e00,0x1e00,0x1e00]);call('glClearStencil',[src?5:0]);
   call('glViewport',src?[1,2,48,50]:[3,4,40,42]);
   call('glMatrixMode',[0x1700]);call('glLoadIdentity');call('glTranslatef',src?[.25,0,0]:[.5,0,0],[0,1,2]);call('glPushMatrix');
   call('glMatrixMode',[src?0x1701:0x1700]);
   call('glClearColor',src?[0,1,0,1]:[0,0,0,1],[0,1,2,3]);
   call('glBlendFunc',src?[0x302,0x303]:[1,0]);call('glAlphaFunc',[src?0x204:0x207,0],[1]);
   call('glColorMask',src?[1,0,1,0]:[1,1,1,1]);call('glDrawBuffer',[src?0x404:0x405]);
   for(let i=0;i<5;i++)call('glHint',[0xc50+i,src?0x1102:0x1100]);call('glListBase',[src?17:3]);
   call('glTexEnvi',[0x2300,0x2200,src?0x1e01:0x2100]);
   call('glScissor',src?[2,3,27,29]:[4,5,31,33]);
   for(const cap of [0xb71,0xbe2,0xb50,0xb60,0xb90,0xc11,0xb24,0xb42,0xba1,0xb10,0xb20,0xb41,0x8037,0xd97])call(src?'glEnable':'glDisable',[cap]);
  };
  switchTo(other,2);bind(b);setup(false);bind(0);
  switchTo(source,1);setup(true);
  eq('source completed native prefix before foreign copy',source.gl_wat_stream_commands(),0);
  const probes=[
   [1,0xb00,4,[0,0,1,1],[1,0,0,1]],[1,0xb02,3,[.25,.5,.75],[0,0,1]],[1,0xb03,4,[.25,.75,0,1],[.5,.5,0,1]],
   [2,0xb11,1,[5],[2]],[4,0xb21,1,[7],[3]],[4,0xb25,1,[0xa5a5],[0x5a5a]],
   [8,0xb40,2,[0x1b01,0x1b00],[0x1b02,0x1b02]],
   [8,0x8038,1,[2],[0]],[8,0x2a00,1,[4096],[0]],
   [0x2002,0xb10,1,[1],[0]],[0x2004,0xb20,1,[1],[0]],[0x2008,0xb41,1,[1],[0]],[0x2008,0x8037,1,[1],[0]],[(0x10000 | 0x2000),0xd97,1,[1],[0]],
   [8,0xb45,1,[0x404],[0x405]],[8,0xb46,1,[0x900],[0x901]],
   [32,0xd14,1,[2],[1]],[32,0xd16,1,[2],[1]],[32,0xd17,1,[-1],[1]],[32,0xc02,1,[0x404],[0x405]],
   [64,0xb53,4,[.5,.25,.125,1],[.125,.5,.25,1]],[64,0xb54,1,[0x1d00],[0x1d01]],[64,0xb55,1,[0x404],[0x408]],[64,0xb56,1,[0x1202],[0x1602]],
   [128,0xb66,4,[0,1,1,1],[1,0,1,1]],[128,0xb65,1,[0x2601],[0x800]],[128,0xb62,1,[2],[1]],
   [256,0xb74,1,[0x206],[0x201]],[256,0xb72,1,[0],[1]],[256,0xb73,1,[0],[1]],
   [512,0xb80,4,[1,0,-1,1],[0,0,0,0]],
   [1024,0xb98,1,[0x35],[0xff]],[1024,0xb92,1,[0x202],[0x207]],[1024,0xb91,1,[5],[0]],[1024,0xb94,1,[0x1e01],[0x1e00]],[1024,0xb95,1,[0x1e02],[0x1e00]],[1024,0xb96,1,[0x1e03],[0x1e00]],
   [2048,0xba2,4,[1,2,48,50],[3,4,40,42]],
   [4096,0xba0,1,[0x1701],[0x1700]],
   [16384,0xc22,4,[0,1,0,1],[0,0,0,1]],[16384,0xc23,4,[1,0,1,0],[1,1,1,1]],
   [16384,0xc01,1,[0x404],[0x405]],[16384,0xbe1,1,[0x302],[1]],
   [32768,0xc50,1,[0x1102],[0x1100]],[32768,0xc51,1,[0x1102],[0x1100]],[32768,0xc52,1,[0x1102],[0x1100]],[32768,0xc53,1,[0x1102],[0x1100]],[32768,0xc54,1,[0x1102],[0x1100]],[131072,0xb32,1,[17],[3]],
   [524288,0xc10,4,[2,3,27,29],[4,5,31,33]]];
  const copy=mask=>call(0x10005,[a,b,mask]);
  switchTo(other,2);
  for(const mask of [0,1,2,4,8,16,32,64,128,256,512,1024,2048,4096,8192,16384,32768,65536,131072,262144,524288,0x8041,0xfffff]){
   eq('source remains current to foreign producer before copy',bridge.currentByOwner.get(1),a);
   eq('copy caller remains unbound before copy',bridge.currentByOwner.get(2),0);
   eq('full-mask transaction success '+mask,copy(mask),1);
   eq('copy preserves source binding',bridge.currentByOwner.get(1),a);eq('copy leaves caller unbound',bridge.currentByOwner.get(2),0);
   bind(b);
   for(const [group,p,n,src,dst] of probes)eq('selected/unselected query mask='+mask+' pname='+p,q(p,n),mask&group?src:dst);
   eq('modelview stack remains two deep',q(0xba3),[2]);
   const matrix=q(0xba6,16);eq('destination matrix contents remain owned',matrix[12],.5);
   call('glMatrixMode',[0x1700]);call('glPopMatrix');setup(false);bind(0);
  }
  const callerContext=call('wglCreateContext',[0]);bind(callerContext);
  call('glColor4f',[1,0,1,1],[0,1,2,3]);call('glPointSize',[3],[0]);
  eq('copy with distinct caller current succeeds',copy(1),1);
  eq('distinct caller binding survives copy',bridge.currentByOwner.get(2),callerContext);
  eq('foreign source binding survives distinct caller copy',bridge.currentByOwner.get(1),a);
  eq('distinct caller color remains magenta',q(0xb00,4),[1,0,1,1]);eq('distinct caller point size stays three',q(0xb11),[3]);
  bind(b);eq('copy from distinct caller still installs destination blue',q(0xb00,4),[0,0,1,1]);bind(0);
  const {REGIONS}=req('lib/region-map.generated');
  function destinationBytes(key=b){
   const blocks=[];let context=0;
   for(let p=dv.getUint32(REGIONS.GL_MTX_BLOCKS.base+4,true);p;p=dv.getUint32(p,true))if(dv.getUint32(p+4,true)===key){context=p;break;}
   assert(context);blocks.push([context,1028],[dv.getUint32(context+240,true),4192],[dv.getUint32(context+760,true),312]);
   for(const [head,bytes] of [[12,392],[16,11216]])for(let p=dv.getUint32(REGIONS.GL_MTX_BLOCKS.base+head,true);p;p=dv.getUint32(p+4,true))if(dv.getUint32(p,true)===key){blocks.push([dv.getUint32(p+8,true),bytes]);break;}
   return Buffer.concat(blocks.filter(([p])=>p).map(([p,n])=>Buffer.from(new Uint8Array(memory.buffer,p,n))));
  }
  for(const [name,args] of [['zero source',[0,b,1]],['invalid source',[0xffff,b,1]],['zero target',[a,0,1]],['invalid target',[a,0xffff,1]],['unknown mask',[a,b,0x100000]],['mixed invalid mask',[a,b,0x100001]]]){
   const before=destinationBytes();eq(name,call(0x10005,args),0);eq(name+' Win32 error',e.test_get_last_error(),name.includes('mask')?87:6);eq(name+' leaves destination bytes unchanged',destinationBytes(),before);
  }
  bind(b);let beforeBytes=destinationBytes();eq('current caller destination rejected',copy(1),0);eq('current target bytes unchanged',destinationBytes(),beforeBytes);bind(0);
  switchTo(source,1);beforeBytes=destinationBytes(a);eq('foreign current destination rejected',call(0x10005,[b,a,0xfffff]),0);eq('foreign current destination all value blocks unchanged',destinationBytes(a),beforeBytes);
  switchTo(other,2);eq('final native error',call('glGetError'),0);
  // Fresh contexts make pixel expectations independent of the state sweep.
  switchTo(source,1);const c=call('wglCreateContext',[0]);drawTarget=43;const d=call('wglCreateContext',[0]);
  switchTo(other,2);drawTarget=43;bind(d);
  call('glColor4f',[1,0,0,1],[0,1,2,3]);call('glClearColor',[0,0,0,1],[0,1,2,3]);
  call('glClear',[0x4000]);call('glPushAttrib',[1]);
  // Destination owns a client vertex descriptor and an existing matrix stack.
  const vertices=e.guest_alloc(48)>>>0;
  call('glVertexPointer',[3,0x1406,12,vertices]);call('glEnableClientState',[0x8074]);call('glPushClientAttrib',[2]);
  call('glMatrixMode',[0x1700]);call('glPushMatrix');bind(0);
  switchTo(source,1);bind(c);call('glClearColor',[1,1,0,1],[0,1,2,3]);call('glClear',[0x4000]);
  call('glViewport',[8,8,48,48]);call('glScissor',[16,16,32,32]);call('glEnable',[0xc11]);
  call('glClearColor',[0,1,0,1],[0,1,2,3]);call('glColor4f',[0,0,1,1],[0,1,2,3]);
  eq('pixel source prefix published before foreign transaction',source.gl_wat_stream_commands(),0);
  switchTo(other,2);drawTarget=43;eq('pixel source remains current',bridge.currentByOwner.get(1),c);
  eq('pixel copy into unbound destination',call(0x10005,[c,d,0xfffff]),1);
  eq('pixel copy preserves producer current',bridge.currentByOwner.get(1),c);
  eq('pixel copy preserves caller unbound',bridge.currentByOwner.get(2),0);bind(d);
  eq('client vertex array remains enabled',q(0x8074),[1]);
  eq('client vertex descriptor remains owned',q(0x807a),[3]);
  call('glGetPointerv',[0x808e,out]);eq('all-mask copy preserves exact client pointer',dv.getUint32(wa(out),true),vertices);
  eq('destination matrix stack preserved by pixel copy',q(0xba3),[2]);
  call('glClear',[0x4000]);delay=queued;
  call('glBegin',[4]);for(const v of [[-.8,-.8,0],[.8,-.8,0],[0,.8,0]])call('glVertex3f',v,[0,1,2]);call('glEnd');
  if(queued){
   encoder._submit();eq('one actual held native draw batch',delayed.length,1);
   const item=encoder.buffers.find(item=>item.seq===delayed[0].seq);assert(item);
   const before=Buffer.from(item.bytes.subarray(0,item.used));
   switchTo(source,1);call('glColor4f',[1,0,1,1],[0,1,2,3]);call('glScissor',[0,0,1,1]);call('glViewport',[0,0,1,1]);
   eq('foreign source mutations preserve full delayed native lease',Buffer.from(item.bytes.subarray(0,item.used)),before);
   leases.push({name:'copied destination draw with later source mutation',bytes:before.length,payload:Array.from(before),sha256:crypto.createHash('sha256').update(before).digest('hex'),immutable:true});
   switchTo(other,2);drawTarget=43;encoder.releaseHeld();
  }
  call('glFinish');if(encoder)encoder.fence();
  const pixel=(x,y)=>{const entry=e.gl_sw_entry()>>>0,pitch=dv.getUint16(entry+18,true),height=dv.getUint16(entry+14,true),dib=dv.getUint32(entry+20,true);return dv.getUint32(dib+(height-1-y)*pitch+x*4,true)&0xffffff;};
  eq('copied current color renders independent blue center',pixel(32,32),255);
  eq('copied clear color renders independent green scissor corner',pixel(17,46),65280);
  eq('copied scissor keeps outside destination black',pixel(8,32),0);
  checkpoints.push({name:'copied server state draw',captureEnd:captures.length,owner:2,current:d,pixels:[{x:32,y:32,rgba:[0,0,255,255]},{x:17,y:46,rgba:[0,255,0,255]},{x:8,y:32,rgba:[0,0,0,255]}]});
  switchTo(source,1);call('glFinish');if(encoder)encoder.fence();eq('copy and destination rendering preserve separate source drawable yellow',pixel(32,32),16776960);
  switchTo(other,2);drawTarget=43;
  call('glVertexPointer',[3,0x1406,12,vertices+12]);call('glPopClientAttrib');call('glGetPointerv',[0x808e,out]);eq('destination owns saved client attrib frame',dv.getUint32(wa(out),true),vertices);
  call('glPopAttrib');eq('destination pre-copy attrib stack remains independent',q(0xb00,4),[1,0,0,1]);
  call('glPopMatrix');eq('destination pre-copy matrix frame independently pops',q(0xba3),[1]);
  eq('pixel destination error',call('glGetError'),0);
  // Equal names resolve in the destination namespace; images/lists stay owned.
  switchTo(source,1);const ta=call('wglCreateContext',[0]),tb=call('wglCreateContext',[0]);
  const image=(name,rgba,filter)=>{call('glBindTexture',[0xde1,name]);
   call('glTexParameteri',[0xde1,0x2800,filter]);call('glTexParameteri',[0xde1,0x2801,filter]);
   new Uint8Array(memory.buffer,wa(out),4).set(rgba);call('glTexImage2D',[0xde1,0,0x1908,1,1,0,0x1908,0x1401,out]);};
  const list=color=>{call('glNewList',[31,0x1300]);call('glColor4f',color,[0,1,2,3]);call('glEndList');};
  switchTo(other,2);bind(tb);image(7,[255,0,0,255],0x2600);image(9,[0,255,0,255],0x2600);list([1,0,1,1]);
  call('glPixelStorei',[0xcf5,1]);call('glPixelStorei',[0xd05,2]);
  call('glMatrixMode',[0x1702]);call('glTranslatef',[.5,0,0],[0,1,2]);call('glMatrixMode',[0x1700]);bind(0);
  switchTo(source,1);bind(ta);image(7,[0,0,255,255],0x2601);list([0,1,1,1]);
  call('glEnable',[0xde1]);call('glTexEnvi',[0x2300,0x2200,0x1e01]);
  call('glViewport',[0,0,64,64]);eq('texture source prefix complete',source.gl_wat_stream_commands(),0);
  switchTo(other,2);eq('texture all-server transaction',call(0x10005,[ta,tb,0xfffff]),1);bind(tb);
  eq('destination texture name resolves locally',q(0x8069),[7]);
  call('glGetTexParameterfv',[0xde1,0x2801,out]);eq('texture sampler copied',dv.getFloat32(wa(out),true),0x2601);
  call('glGetTexImage',[0xde1,0,0x1908,0x1401,out]);eq('destination texture image unchanged',Array.from(new Uint8Array(memory.buffer,wa(out),4)),[255,0,0,255]);
  eq('other destination texture preserved',call('glIsTexture',[9]),1);
  eq('unpack client state independent',q(0xcf5),[1]);eq('pack client state independent',q(0xd05),[2]);
  eq('texture matrix remains destination owned',q(0xba8,16)[12],.5);
  call('glCallList',[31]);eq('same-name list remains destination owned',q(0xb00,4),[1,0,1,1]);
  call('glClearColor',[0,0,0,1],[0,1,2,3]);call('glClear',[0x4000]);call('glBegin',[4]);
  for(const v of [[-.8,-.8,0],[.8,-.8,0],[0,.8,0]]){call('glTexCoord2f',[.5,.5],[0,1]);call('glVertex3f',v,[0,1,2]);}call('glEnd');call('glFinish');if(encoder)encoder.fence();
  eq('copied binding samples destination red image',pixel(32,32),16711680);
  checkpoints.push({name:'texture namespace isolation',captureEnd:captures.length,owner:2,current:tb,pixels:[{x:32,y:32,rgba:[255,0,0,255]}]});
  eq('texture copy preserves source producer',bridge.currentByOwner.get(1),ta);
  eq('texture destination error',call('glGetError'),0);
  // Copied polygon bias must affect depth; the second pass also requires
  // the copied FALSE depth-write mask, rather than merely a retained query.
  switchTo(source,1);const za=call('wglCreateContext',[0]),zb=call('wglCreateContext',[0]);
  switchTo(other,2);bind(zb);call('glClearColor',[0,0,0,1],[0,1,2,3]);
  dv.setFloat64(wa(out),.6,true);call('glClearDepth',[dv.getUint32(wa(out),true),dv.getUint32(wa(out)+4,true)]);call('glClear',[0x4100]);
  call('glClearDepth',[0,0x3ff00000]);bind(0);
  switchTo(source,1);bind(za);call('glViewport',[0,0,64,64]);
  call('glEnable',[0xb71]);call('glEnable',[0x8037]);call('glDepthFunc',[0x204]);call('glDepthMask',[0]);
  dv.setFloat64(wa(out),.6,true);call('glClearDepth',[dv.getUint32(wa(out),true),dv.getUint32(wa(out)+4,true)]);
  // Use slope bias for an identical threshold on native 16-bit and WebGL
  // 24-bit depth attachments; the unit term is implementation dependent.
  call('glPolygonOffset',[32,0],[0,1]);
  switchTo(other,2);eq('depth and polygon selected copy',call(0x10005,[za,zb,8|256|2048]),1);bind(zb);
  // The destination attachment was seeded before copying. Clear must honor
  // the copied FALSE mask; no destination setter repairs it after the copy.
  call('glClear',[0x4100]);
  const triangle=(z,color)=>{call('glColor4f',color,[0,1,2,3]);call('glBegin',[4]);for(const v of [[-.8,-.8,z-.2],[.8,-.8,z+.2],[0,.8,z]])call('glVertex3f',v,[0,1,2]);call('glEnd');};
  triangle(0,[0,0,1,1]);call('glFinish');if(encoder)encoder.fence();
  eq('copied polygon offset passes independent GREATER threshold',pixel(32,32),255);
  checkpoints.push({name:'polygon offset depth threshold',captureEnd:captures.length,owner:2,current:zb,pixels:[{x:32,y:32,rgba:[0,0,255,255]}]});
  triangle(-.02,[0,1,0,1]);call('glFinish');if(encoder)encoder.fence();
  eq('copied depth write FALSE permits second farther pass',pixel(32,32),65280);
  checkpoints.push({name:'copied depth write isolation',captureEnd:captures.length,owner:2,current:zb,pixels:[{x:32,y:32,rgba:[0,255,0,255]}]});
  eq('depth copy destination error',call('glGetError'),0);
  // Legal current/material changes inside an unfinished primitive are also
  // completed state setters. The foreign caller must never read an old prefix.
  switchTo(source,1);const ba=call('wglCreateContext',[0]),bb=call('wglCreateContext',[0]);
  switchTo(other,2);bind(bb);bind(0);switchTo(source,1);bind(ba);call('glViewport',[0,0,64,64]);call('glEnable',[0xb50]);
  new Float32Array(memory.buffer,wa(out),4).set([0,0,0,1]);call('glLightModelfv',[0xb53,out]);
  call('glColor4f',[1,0,0,1],[0,1,2,3]);call('glBegin',[4]);call('glColor4f',[0,0,1,1],[0,1,2,3]);
  new Float32Array(memory.buffer,wa(out),4).set([0,1,0,1]);call('glMaterialfv',[0x408,0x1600,out]);
  switchTo(other,2);bind(0);eq('copy legal setters while foreign source primitive unfinished',call(0x10005,[ba,bb,1|64|2048]),1);bind(bb);
  eq('current inside source Begin published before foreign copy',q(0xb00,4),[0,0,1,1]);
  eq('material inside source Begin published to consumer',Array.from(bridge.contexts.get(bb).frontend.material.emission),[0,1,0,1]);
  eq('foreign primitive source remains current',bridge.currentByOwner.get(1),ba);
  call('glClear',[0x4000]);call('glBegin',[4]);for(const v of [[-.8,-.8,0],[.8,-.8,0],[0,.8,0]])call('glVertex3f',v,[0,1,2]);call('glEnd');call('glFinish');if(encoder)encoder.fence();
  eq('copied unfinished source material independently renders green',pixel(32,32),65280);
  checkpoints.push({name:'completed setters inside foreign Begin',captureEnd:captures.length,owner:2,current:bb,pixels:[{x:32,y:32,rgba:[0,255,0,255]}]});
  switchTo(source,1);call('glEnd');eq('foreign primitive still owned by source',call('glGetError'),0);switchTo(other,2);
  // Never-bound destinations have keyed defaults, with no temporary bind
  // used to manufacture a snapshot before the selected/all transaction.
  for(const mask of [1|2048,0xfffff]) {
   const virgin=call('wglCreateContext',[0]);bind(0);
   eq('copy into never-bound destination '+mask,call(0x10005,[ba,virgin,mask]),1);
   eq('virgin copy preserves foreign current source',bridge.currentByOwner.get(1),ba);
   eq('virgin copy leaves caller unbound',bridge.currentByOwner.get(2),0);bind(virgin);
   eq('virgin selected current color',q(0xb00,4),[0,0,1,1]);eq('virgin viewport',q(0xba2,4),[0,0,64,64]);
   eq('virgin owned modelview remains identity',q(0xba6,16),[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
   eq('virgin owned modelview stack depth',q(0xba3),[1]);eq('virgin client vertex array remains disabled',q(0x8074),[0]);
   eq('virgin default line width',q(0xb21),[1]);eq('virgin default error',call('glGetError'),0);
  }
  // Inject a second host allocation failure after native/host plans each
  // contain an unlinked object. Nothing from either partial plan may escape.
  switchTo(source,1);const fa=call('wglCreateContext',[0]),fb=call('wglCreateContext',[0]);
  switchTo(other,2);bind(fb);call('glBindTexture',[0xde0,0]);call('glBindTexture',[0xde1,0]);bind(0);
  switchTo(source,1);bind(fa);call('glBindTexture',[0xde0,101]);call('glBindTexture',[0xde1,102]);
  switchTo(other,2);const failed=bridge.contexts.get(fb),oldCreate=failed.backend.createTexture,oldDelete=failed.backend.deleteTexture;
  let allocations=0,deletes=0;failed.backend.createTexture=()=>{if(++allocations===2)throw Error('injected prepare allocation failure');return oldCreate();};
  failed.backend.deleteTexture=t=>{deletes++;return oldDelete(t);};
  let nativeContext=0;for(let p=dv.getUint32(REGIONS.GL_MTX_BLOCKS.base+4,true);p;p=dv.getUint32(p,true))if(dv.getUint32(p+4,true)===fb){nativeContext=p;break;}
  const textureBlock=dv.getUint32(nativeContext+760,true),namespace=dv.getUint32(textureBlock+308,true),head=dv.getUint32(namespace+8,true);
  const savedBindings=Buffer.from(new Uint8Array(memory.buffer,textureBlock+16,56));
  eq('injected prepare fails atomically',call(0x10005,[fa,fb,262144]),0);
  eq('injected prepare Win32 allocation error',e.test_get_last_error(),8);
  eq('abort releases first staged host object',deletes,1);eq('abort clears host plan',bridge._copyPlan,null);
  eq('abort preserves native namespace head',dv.getUint32(namespace+8,true),head);
  eq('abort preserves native bindings and environment',Buffer.from(new Uint8Array(memory.buffer,textureBlock+16,56)),savedBindings);
  eq('abort preserves host namespace',failed.frontend.textures.size,0);
  failed.backend.createTexture=oldCreate;failed.backend.deleteTexture=oldDelete;
  eq('clean transaction after failed prepare',call(0x10005,[fa,fb,262144]),1);bind(fb);
  eq('prepared missing 1D object installed',call('glIsTexture',[101]),1);eq('prepared missing 2D object installed',call('glIsTexture',[102]),1);
  eq('successful commit clears host plan',bridge._copyPlan,null);eq('fault test destination error',call('glGetError'),0);
  call('glNewList',[0,0x1300]);bind(0);switchTo(source,1);call('glHint',[0xc55,0x1102]);
  switchTo(other,2);eq('all-mask copy with pending distinct GL errors',call(0x10005,[fa,fb,0xfffff]),1);bind(fb);
  eq('destination GL error not copied or consumed',call('glGetError'),0x501);
  switchTo(source,1);eq('source GL error not consumed',call('glGetError'),0x500);switchTo(other,2);
  const worker=encoder?.snapshot();if(worker){assert(worker.replayCommands>0);eq('actual Worker zero fallback',worker.fallbacks,0);assert.strictEqual(leases.length,1);}
  const result={kind:'complete-context-transaction',queued,module:{bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')},checks,captures,checkpoints,leases,worker,copySupported:publicRoute?true:null,publicRoute};
  if(process.env.GL_COPY_RESULT)fs.writeFileSync(process.env.GL_COPY_RESULT,JSON.stringify(result,null,2)+'\n');
  console.log('PASS complete context transaction',checks.length);
 } finally {encoder?.releaseHeld();encoder?.stop();if(manager)await manager.stop();if(render)render.destroy();else bridge.destroy();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
