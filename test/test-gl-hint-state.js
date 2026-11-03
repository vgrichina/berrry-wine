'use strict';
// Independent GL1.1 hint state, public queries, lists, masked attributes,
// cross-producer publication and immutable real Worker draws. Copy stays unavailable.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const root=process.cwd(),req=p=>require(path.join(root,p));
const {CALL_INDEX:O,OpenGLHostBridge}=req('lib/gl-compat'),Stream=req('lib/gl-command-stream');
async function main(){
 const bytes=process.env.GL_HINT_MODULE?fs.readFileSync(process.env.GL_HINT_MODULE):req('test/compile-src').compileSrcWasm();
 const module=new WebAssembly.Module(bytes);
 const queued=process.argv.includes('--worker');
 let memory,e,owner=1,bridge,render,producer,manager,encoder,delay=false;const events=[],captures=[],delayed=[];
 const h=await req('test/render-helper').bootRenderHarness({fonts:'none',width:64,height:64,prebuiltModule:module,
  extraHostOverrides:{gpu_gl_call(op,at,used){
   if(op>=0x20000&&op<=0x20006)return encoder?encoder.call(op,at,used):0;
   assert.strictEqual(op,Stream.WAT_STREAM_FLUSH_OPCODE);
   const batch=Stream.memoryBatch(memory,at,used);Stream.replay(batch,op=>{events.push({owner,op});return 0;});
   captures.push({owner,bytes:Array.from(new Uint8Array(memory.buffer,at,used))});
   if(!render)return bridge.replay(batch,owner);
   const reply=render.execute({memoryOffset:at,bytes:used,owner,windows:[{hwnd:42,w:64,h:64,clientRect:{w:64,h:64}}],softwareFront:e.gl_sw_front()});
   producer.configure(reply.producerConfig);return reply.value;}}});
 memory=h.memory;e=h.exports;const source=e,dv=new DataView(memory.buffer);
 source.init_thread(1,0x400000,0,0,0,0,0);source.heap_init(0x800000);
 bridge=new OpenGLHostBridge({backend:'software',getMemory:()=>memory.buffer,exports:()=>e,
  renderer:{windows:{42:{hwnd:42,w:64,h:64,clientRect:{w:64,h:64}}},repaint(){}}});
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
 const stack=e.guest_to_wasm(e.guest_alloc(256))>>>0,out=e.guest_alloc(256)>>>0,wa=p=>e.guest_to_wasm(p)>>>0;
 function call(name,args=[],floats=[]){assert(Number.isInteger(O[name]),name);dv.setUint32(stack,0,true);
  args.forEach((v,i)=>floats.includes(i)?dv.setFloat32(stack+4+i*4,v,true):dv.setUint32(stack+4+i*4,v>>>0,true));
  return e.gl_wat_encoder_call(O[name],stack,42)>>>0;}
 const bind=c=>assert.strictEqual(call('wglMakeCurrent',[c?123:0,c]),1);
 const query=(p,n=1)=>{new Uint32Array(memory.buffer,wa(out),n).fill(0xdeadbeef);call('glGetIntegerv',[p,out]);return Array.from(new Uint32Array(memory.buffer,wa(out),n));};
 try {
  const a=call('wglCreateContext',[0]),b=call('wglCreateContext',[0]);assert(a&&b&&a!==b);bind(a);
  const other=new WebAssembly.Instance(module,{host:h.host}).exports;
  other.init_thread(2,0x400000,0,0,0,0,0);other.heap_init(0x1000000);
  e=other;owner=2;if(!queued)new(req('lib/gl-software-producer').Producer)(()=>e).configure([1,64,64,0]);bind(b);bind(0);e=source;owner=1;
  const checks=[],checkpoints=[],leases=[];
  const eq=(name,actual,expected)=>{assert.deepStrictEqual(actual,expected,name);checks.push({name,actual,expected});};
  const targets=[0xc50,0xc51,0xc52,0xc53,0xc54];
  const hints=()=>targets.map(p=>query(p)[0]);
  const setHints=values=>values.forEach((v,i)=>call('glHint',[targets[i],v]));
  const err=()=>call('glGetError');
  const defaults=[0x1100,0x1100,0x1100,0x1100,0x1100];
  const first=[0x1102,0x1101,0x1100,0x1102,0x1101],second=[0x1101,0x1102,0x1101,0x1100,0x1102];
  eq('five initial DONT_CARE modes',hints(),defaults);
  for(const target of targets)for(const mode of [0x1100,0x1101,0x1102]){
    call('glHint',[target,mode]);eq('legal target/mode error',err(),0);eq('retained target mode',query(target),[mode]);
    for(const [name,width] of [['glGetBooleanv',1],['glGetFloatv',4],['glGetDoublev',8]]){
      new Uint8Array(memory.buffer,wa(out),16).fill(0xa5);call(name,[target,out]);
      const actual=width===1?dv.getUint8(wa(out)):width===4?dv.getFloat32(wa(out),true):dv.getFloat64(wa(out),true);
      eq(name+' exact hint enum',actual,width===1?1:mode);eq(name+' writes one value only',dv.getUint8(wa(out)+width),0xa5);
    }
  }
  setHints(first);
  for(const args of [[0xc4f,0x1102],[0xc55,0x1102],[0xffffffff,0x1102],[0xc50,0x10ff],[0xc54,0x1103],[0xc51,0xffffffff]]){
    call('glHint',args);eq('invalid target/mode error',err(),0x500);eq('invalid target/mode preserves five values',hints(),first);
  }
  call('glHint',[0xc55,0x1103]);call('glHint',[0xc50,0x1101]);eq('successful setter preserves pending enum error',err(),0x500);first[0]=0x1101;
  call('glBegin',[4]);call('glHint',[0xc50,0x1102]);call('glEnd');eq('Begin rejects hint setter',err(),0x502);eq('Begin hint state unchanged',hints(),first);
  new Uint32Array(memory.buffer,wa(out),1).fill(0xdeadbeef);
  call('glBegin',[4]);call('glGetIntegerv',[0xc50,out]);call('glEnd');eq('Begin rejects hint query',err(),0x502);eq('Begin query leaves output untouched',dv.getUint32(wa(out),true),0xdeadbeef);
  const list=call('glGenLists',[1]);call('glNewList',[list,0x1300]);setHints(second);eq('query during compile observes live state',hints(),first);call('glEndList');
  eq('compile does not execute hints',hints(),first);call('glCallList',[list]);eq('list replay hints',hints(),second);
  call('glNewList',[list,0x1301]);setHints(first);call('glEndList');eq('compile execute hints',hints(),first);
  call('glNewList',[list,0x1300]);call('glHint',[0xc55,0x1102]);call('glHint',[0xc50,0x1103]);call('glEndList');eq('invalid compile hints report error',err(),0x500);
  call('glCallList',[list]);eq('rejected commands absent from list',err(),0);eq('invalid compile state unchanged',hints(),first);
  call('glNewList',[list,0x1300]);call('glBegin',[4]);call('glHint',[0xc50,0x1102]);call('glEnd');call('glEndList');eq('compile Begin rejects hint',err(),0x502);call('glCallList',[list]);eq('compile Begin no invalid retained command',err(),0);eq('compile Begin preserves hints',hints(),first);
  call('glPushAttrib',[0x8000]);setHints(second);call('glLineWidth',[7],[0]);call('glPopAttrib');eq('HINT_BIT restores only hint values',hints(),first);eq('HINT_BIT leaves line width changed',query(0xb21),[7]);
  call('glPushAttrib',[4]);setHints(second);call('glPopAttrib');eq('LINE_BIT leaves hint changes live',hints(),second);
  call('glPushAttrib',[0xfffff]);setHints(first);call('glPopAttrib');eq('ALL_ATTRIB_BITS includes hints',hints(),second);
  call('glPushAttrib',[0x8000]);setHints(first);call('glPushAttrib',[0x8000]);setHints(defaults);call('glPopAttrib');eq('nested hint inner frame',hints(),first);call('glPopAttrib');eq('nested hint outer frame',hints(),second);
  call('glPushClientAttrib',[0xffffffff]);setHints(first);call('glPopClientAttrib');eq('client attributes do not restore server hints',hints(),first);
  // Foreign observation occurs before a source query, flush, finish or rebind.
  setHints(first);assert.strictEqual(source.gl_wat_stream_commands(),0);
  e=other;owner=2;eq('source remains current to producer1',bridge.currentByOwner.get(1),a);eq('producer2 stays unbound',bridge.currentByOwner.get(2),0);
  eq('completed frontend hint values visible abroad',Array.from(bridge.contexts.get(a).frontend.hints),first);
  const {REGIONS}=req('lib/region-map.generated');let context=0;
  for(let p=dv.getUint32(REGIONS.GL_MTX_BLOCKS.base+4,true);p;p=dv.getUint32(p,true))if(dv.getUint32(p+4,true)===a){context=p;break;}
  assert(context);eq('shared native completed hint values visible abroad',Array.from(new Uint32Array(memory.buffer,context+1008,5)),first);
  bind(b);eq('destination initial hints independent',hints(),defaults);setHints(second);call('glPushAttrib',[0x8000]);setHints(defaults);bind(0);
  e=source;owner=1;eq('foreign changes preserve source values',hints(),first);call('glPushAttrib',[0x8000]);setHints(defaults);bind(0);
  e=other;owner=2;bind(b);call('glPopAttrib');eq('destination owns saved hint frame',hints(),second);bind(0);
  e=source;owner=1;bind(a);call('glPopAttrib');eq('source owns saved hint frame',hints(),first);
  e=other;owner=2;const retired=call('wglCreateContext',[0]);bind(retired);setHints(second);call('glPushAttrib',[0x8000]);setHints(first);bind(0);eq('delete unbound context with saved hint frame',call('wglDeleteContext',[retired]),1);
  const fresh=call('wglCreateContext',[0]);bind(fresh);eq('new context cannot inherit retired hints or frames',hints(),defaults);bind(0);eq('delete fresh context',call('wglDeleteContext',[fresh]),1);e=source;owner=1;
  call('glViewport',[0,0,64,64]);call('glClearColor',[0,0,0,1],[0,1,2,3]);call('glColor4f',[0,0,1,1],[0,1,2,3]);
  const draw=(name,expectedHints,hold=false)=>{
    call('glClear',[0x4000]);delay=queued&&hold;call('glBegin',[4]);for(const v of [[-.8,-.8,0],[.8,-.8,0],[0,.8,0]])call('glVertex3f',v,[0,1,2]);call('glEnd');
    if(queued&&hold){
      encoder._submit();assert.strictEqual(delayed.length,1);const item=encoder.buffers.find(item=>item.seq===delayed[0].seq);assert(item);
      const before=Buffer.from(item.bytes.subarray(0,item.used));setHints(second);
      assert.deepStrictEqual(Buffer.from(item.bytes.subarray(0,item.used)),before,'hint mutation preserves actual leased native draw');leases.push({name,bytes:before.length,sha256:crypto.createHash('sha256').update(before).digest('hex'),payload:Array.from(before),immutable:true});encoder.releaseHeld();
    }
    call('glFinish');if(encoder)encoder.fence();
    const entry=e.gl_sw_entry()>>>0,pitch=dv.getUint16(entry+18,true),height=dv.getUint16(entry+14,true),dib=dv.getUint32(entry+20,true);
    eq(name+' actual native blue pixel',dv.getUint32(dib+(height-1-32)*pitch+32*4,true)&0xffffff,255);
    checkpoints.push({name,captureEnd:captures.length,expectedHints:expectedHints.slice(),expectedPixel:[0,0,255,255]});
  };
  setHints(first);draw('advisory hints preserve rendering',first);draw('delayed immutable draw across later hint mutation',queued?second:first,true);
  setHints(second);draw('subsequent independently mutated hints',second);
  eq('final hint error',err(),0);
  const worker=encoder?.snapshot();if(worker){assert(worker.replayCommands>0);eq('actual Worker zero fallback',worker.fallbacks,0);assert.strictEqual(leases.length,1);}
  const result={kind:'hint-state-prerequisite',queued,module:{bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')},checks,checkpoints,leases,captures,worker,copySupported:false};
  if(process.env.GL_HINT_RESULT)fs.writeFileSync(process.env.GL_HINT_RESULT,JSON.stringify(result,null,2)+'\n');
  console.log('PASS hint state',JSON.stringify({...result,captures:captures.length}));
 } finally {encoder?.releaseHeld();encoder?.stop();if(manager)await manager.stop();if(render)render.destroy();else bridge.destroy();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
