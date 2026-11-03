'use strict';
// Expected-success contract. Run unchanged against old and new canonical modules.
// Optional controls deliberately violate the SAME assertions; they must fail.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const root=process.cwd(),req=p=>require(path.join(root,p));
const {CALL_INDEX:O,OpenGLHostBridge}=req('lib/gl-compat'),Stream=req('lib/gl-command-stream');
const {REGIONS}=req('lib/region-map.generated');
let sealedBytes;
async function main(queued){
 const bytes=sealedBytes||(sealedBytes=process.env.GL_PUBLICATION_MODULE?fs.readFileSync(process.env.GL_PUBLICATION_MODULE):req('test/compile-src').compileSrcWasm());
 const sha256=crypto.createHash('sha256').update(bytes).digest('hex');
 const module=new WebAssembly.Module(bytes),control=process.env.GL_PUBLICATION_CONTROL||'';
 assert(['','stale','reordered-prefix'].includes(control));
 let memory,e,owner=1,bridge,render,producer,manager,encoder,hold=false,delayDraw=false;
 const batches=[],held=[],observations=[],delayed=[],events=[];
 const h=await req('test/render-helper').bootRenderHarness({fonts:'none',width:64,height:64,prebuiltModule:module,extraHostOverrides:{gpu_gl_call(op,at,used){
  if(op>=0x20000&&op<=0x20006)return encoder?encoder.call(op,at,used):0;
  assert.strictEqual(op,Stream.WAT_STREAM_FLUSH_OPCODE);
  const batch=Stream.memoryBatch(memory,at,used),ops=[];
  events.push({owner,batch:Array.from(new Uint8Array(memory.buffer,at,used))});
  Stream.replay(batch,(op)=>{ops.push(op);return 0;});batches.push({owner,used,ops});
  if(hold&&owner===1){held.push(Uint8Array.from(new Uint8Array(batch.buffer,batch.byteOffset||0,batch.bytes)));return 0;}
  if(!render)return bridge.replay(batch,owner);
  const reply=render.execute({memoryOffset:at,bytes:used,owner,windows:[{hwnd:42,w:64,h:64,clientRect:{w:64,h:64}}],softwareFront:e.gl_sw_front()});
  producer.configure(reply.producerConfig);return reply.value;
 }}});
 memory=h.memory;e=h.exports;const source=e,dv=new DataView(memory.buffer);
 source.init_thread(1,0x400000,0,0,0,0,0);source.heap_init(0x800000);
 bridge=new OpenGLHostBridge({backend:'software',getMemory:()=>memory.buffer,exports:()=>e,renderer:{windows:{42:{hwnd:42,w:64,h:64,clientRect:{w:64,h:64}}},repaint(){}}});
 if(queued){
  const GL=req('lib/gl-compat'),{Worker}=require('worker_threads');
  producer=new (req('lib/gl-software-producer').Producer)(()=>e);
  const consumer=new WebAssembly.Instance(module,{host:h.host});consumer.exports.d3dim_worker_init(0x400000);
  bridge.destroy();const Base=GL.OpenGLHostBridge;
  GL.OpenGLHostBridge=class extends Base{constructor(o){super(o);bridge=this;}};
  try{render=req('lib/gl-render-worker').create({instance:consumer,memory,backend:'software',sendFrame(){}});}finally{GL.OpenGLHostBridge=Base;}
  manager=new (req('lib/render-worker').Manager)({module,memory,sigs:req('lib/host-import-sigs.generated.json').sigs,imageBase:0x400000,
   workerFactory:()=>new Worker(path.join(root,'lib/d3d-render-worker.js')),reclaimHeap:head=>source.d3d_render_adopt_free_list(head)});
  await manager.ready;const port=manager.createEndpoint({api:'legacy',backend:'software'});await port.ready;
  const transport={postMessage(msg){if(delayDraw&&msg.t==='batch')delayed.push(msg);else port.postMessage(msg);},
   set onmessage(fn){port.onmessage=fn;},set onerror(fn){port.onerror=fn;},terminate(){return port.terminate();}};
  encoder=new (req('lib/d3d-command-stream').Encoder)({module,memory,sigs:req('lib/host-import-sigs.generated.json').sigs,
   getImageBase:()=>0x400000,guestToWasm:p=>e.guest_to_wasm(p)>>>0,workerFactory:()=>transport,capacity:0x400000,explicitFence:true,strictReady:true});
  assert(encoder.ready());
  // Save the real submission function; delay only its transport dispatch.
  encoder.publicationTestRelease=()=>{delayDraw=false;for(const msg of delayed.splice(0))port.postMessage(msg);};
 }
 const stack=e.guest_to_wasm(e.guest_alloc(256))>>>0,input=e.guest_alloc(64)>>>0,output=e.guest_alloc(64)>>>0;
 const wa=p=>e.guest_to_wasm(p)>>>0;
 function call(name,args=[],floats=[]){assert(Number.isInteger(O[name]),name);dv.setUint32(stack,0,true);args.forEach((v,i)=>floats.includes(i)?dv.setFloat32(stack+4+i*4,v,true):dv.setUint32(stack+4+i*4,v>>>0,true));return e.gl_wat_encoder_call(O[name],stack,42)>>>0;}
 function state(c){for(let p=dv.getUint32(REGIONS.GL_MTX_BLOCKS.base+12,true);p;p=dv.getUint32(p+4,true))if(dv.getUint32(p,true)===c)return dv.getUint32(p+8,true);throw Error('missing native state '+c);}
 function context(c){for(let p=dv.getUint32(REGIONS.GL_MTX_BLOCKS.base+4,true);p;p=dv.getUint32(p,true))if(dv.getUint32(p+4,true)===c)return p;throw Error('missing native context '+c);}
 const raster=c=>dv.getUint32(context(c)+240,true);
 const resourceIdentity=c=>{const ctx=context(c),tex=dv.getUint32(ctx+760,true);assert(tex);return {context:ctx,state:state(c),raster:raster(c),texture:tex,namespace:dv.getUint32(ctx+968,true),textureNamespace:dv.getUint32(tex+308,true),bindings:[16,20,24,28].map(n=>dv.getUint32(tex+n,true)),objects:dv.getUint32(dv.getUint32(ctx+968,true)+8,true)};};
 const protectedRaster=c=>Buffer.concat([[44,4],[64,1728],[1820,4],[1980,2176]].map(([off,n])=>Buffer.from(new Uint8Array(memory.buffer,raster(c)+off,n))));
 const savedColor=c=>Array.from(new Float32Array(memory.buffer,state(c)+4,4));
 const savedWidth=c=>dv.getFloat32(raster(c)+1812,true);
 const diffuse=c=>Array.from(bridge.contexts.get(c).frontend.lights[0].diffuse);
 const current=c=>assert.strictEqual(call('wglMakeCurrent',[c?123:0,c]),1);
 const color=v=>call('glColor4f',v,[0,1,2,3]);
 const width=v=>call('glLineWidth',[v],[0]);
 const light=v=>{new Float32Array(memory.buffer,wa(input),4).set(v);call('glLightfv',[0x4000,0x1201,input]);};
 const getColor=()=>{call('glGetFloatv',[0xb00,output]);return Array.from(new Float32Array(memory.buffer,wa(output),4));};
 try{
  const a=call('wglCreateContext',[0]),b=call('wglCreateContext',[0]);assert(a&&b&&a!==b);current(a);
  color([1,0,0,1]);width(2);
  call('glVertexPointer',[3,0x1406,0,input]);call('glEnableClientState',[0x8074]);
  call('glBindTexture',[0xde1,37]);call('glPixelStorei',[0xcf5,8]);
  call('glPushAttrib',[5]);current(0);
  const identity=resourceIdentity(a),rasterBefore=protectedRaster(a);
  const protectedBefore=Buffer.from(new Uint8Array(memory.buffer,state(a)+52,96));
  current(a);hold=control==='reordered-prefix';
  color([0,0,1,1]);width(7);light([.25,.5,.75,1]);
  // No source getter, glFlush/glFinish, unbind or other call may repair this.
  assert.deepStrictEqual(savedColor(a),[0,0,1,1],'completed setter publishes CURRENT before any source query');
  assert.strictEqual(savedWidth(a),7,'completed setter publishes width before any source query');
  assert.deepStrictEqual(diffuse(a),[.25,.5,.75,1],'completed setter drains source prefix before any source query');
  assert.strictEqual(source.gl_wat_stream_commands(),0);
  const other=new WebAssembly.Instance(module,{host:h.host}).exports;
  other.init_thread(2,0x400000,0,0,0,0,0);other.heap_init(0x1000000);e=other;owner=2;
  // Each native producer receives the production software-backend configuration.
  // Binding an existing direct-bridge context does not create/enable this instance.
  if(!queued)new (req('lib/gl-software-producer').Producer)(()=>e).configure([1,64,64,0]);
  current(b);
  color([0,1,0,1]);width(3);light([.75,.5,.25,1]);
  if(control==='stale'){new Float32Array(memory.buffer,state(a)+4,4).set([1,0,0,1]);dv.setFloat32(raster(a)+1812,2,true);}
  function observe(){
   // Read shared values from producer 2; never move/rebind source a.
   assert.deepStrictEqual(savedColor(a),[0,0,1,1],'completed source CURRENT must be published while source remains current');
   assert.strictEqual(savedWidth(a),7,'completed source width must be published');
   assert.deepStrictEqual(diffuse(a),[.25,.5,.75,1],'source prefix must reach production frontend before foreign observation');
   assert.strictEqual(source.gl_wat_stream_commands(),0,'completed source prefix drained before unlock');
  }
  observe();assert.deepStrictEqual(savedColor(b),[0,1,0,1]);assert.strictEqual(savedWidth(b),3);
  assert.deepStrictEqual(diffuse(b),[.75,.5,.25,1]);
  assert.deepStrictEqual(Buffer.from(new Uint8Array(memory.buffer,state(a)+52,96)),protectedBefore,'value publication preserves client descriptors and stack identity');
  assert.deepStrictEqual(resourceIdentity(a),identity,'publication preserves resource and storage identities');
  assert.deepStrictEqual(protectedRaster(a),rasterBefore,'publication preserves client UNPACK and saved raster stack frames');
  observations.push({name:'two native producers',source:savedColor(a),width:savedWidth(a),diffuse:diffuse(a),foreign:savedColor(b)});
  events.push({state:{context:a,diffuse:[.25,.5,.75,1]}});
  e=source;owner=1;assert.strictEqual(bridge.currentByOwner.get(1),a,'producer 1 retains current source owner');
  assert.deepStrictEqual(getColor(),[0,0,1,1],'producer 1 native current remains source without rebinding');
  const list=call('glGenLists',[1]);assert(list);
  call('glNewList',[list,0x1300]);color([1,1,0,1]);width(9);light([1,0,0,1]);call('glEndList');
  observe();call('glCallList',[list]);assert.deepStrictEqual(savedColor(a),[1,1,0,1]);assert.strictEqual(savedWidth(a),9);assert.deepStrictEqual(diffuse(a),[1,0,0,1]);
  call('glNewList',[list,0x1301]);color([0,0,1,1]);width(7);light([.25,.5,.75,1]);call('glEndList');observe();
  // Publication does not overwrite the consumer-owned stipple phase.
  dv.setUint32(raster(a)+4156,0x13579,true);width(7);assert.strictEqual(dv.getUint32(raster(a)+4156,true),0x13579);
  call('glViewport',[0,0,64,64]);call('glClearColor',[0,0,0,1],[0,1,2,3]);call('glClear',[0x4000]);call('glPointSize',[3],[0]);
  delayDraw=queued;call('glBegin',[0]);color([0,1,1,1]);call('glVertex3f',[-.5,0,0],[0,1,2]);
  assert.deepStrictEqual(savedColor(a),[0,0,1,1],'incomplete primitive does not publish intermediate state');
  color([0,0,1,1]);call('glVertex3f',[0,0,0],[0,1,2]);call('glEnd');observe();
  if(queued){
   assert(encoder.snapshot().glQueued>0,'actual native draw queued through production encoder');
   encoder._submit();assert.strictEqual(delayed.length,1,'actual Worker draw dispatch deliberately held');
   const item=encoder.buffers.find(item=>item.seq===delayed[0].seq);assert(item);
   const snapshot=Buffer.from(item.bytes.subarray(0,item.used));
   // These later completed calls publish new source values while old draw is leased.
   color([1,0,1,1]);width(11);light([0,1,0,1]);
   call('glScissor',[0,0,1,1]);call('glEnable',[0xc11]);
   assert.deepStrictEqual(Buffer.from(item.bytes.subarray(0,item.used)),snapshot,'publication cannot overwrite leased immutable draw');
   assert.deepStrictEqual(savedColor(a),[1,0,1,1]);assert.strictEqual(savedWidth(a),11);
   observations.push({name:'delayed actual Worker draw',bytes:snapshot.length,sha256:crypto.createHash('sha256').update(snapshot).digest('hex')});
   encoder.publicationTestRelease();
  }
  call('glFinish');if(encoder)encoder.fence();
  const entry=e.gl_sw_entry()>>>0;assert(entry);const pitch=dv.getUint16(entry+18,true),height=dv.getUint16(entry+14,true),dib=dv.getUint32(entry+20,true);
  const pixel=dv.getUint32(dib+(height-1-32)*pitch+32*4,true)>>>0;assert.strictEqual(pixel&0xffffff,0xff,'native center pixel blue');
  events.push({owner:1,check:{name:'published-source blue native draw',pixel:[0,0,255,255]}});
  color([1,0,1,1]);width(11);light([0,1,0,1]);e=other;owner=2;
  assert.deepStrictEqual(getColor(),[0,1,0,1]);assert.deepStrictEqual(savedColor(b),[0,1,0,1]);assert.strictEqual(savedWidth(b),3);assert.deepStrictEqual(diffuse(b),[.75,.5,.25,1]);
  assert.deepStrictEqual(savedColor(a),[1,0,1,1]);assert.strictEqual(savedWidth(a),11);assert.deepStrictEqual(diffuse(a),[0,1,0,1]);
  current(0);e=source;owner=1;
  call('glPopAttrib');assert.deepStrictEqual(savedColor(a),[1,0,0,1],'publication preserves original saved CURRENT frame');
  assert.strictEqual(savedWidth(a),2,'publication preserves original saved LINE frame');
  call('glLogicOp',[0x1506]);dv.setUint32(raster(a)+4156,0x2468a,true);current(0);
  assert.strictEqual(dv.getUint32(raster(a)+4156,true),0x2468a,'full context save preserves consumer phase');
  current(a);call('glGetIntegerv',[0xbf0,output]);assert.strictEqual(dv.getUint32(wa(output),true),0x1506,'logic op restores separately from consumer phase');
  current(0);assert.strictEqual(call('wglDeleteContext',[a]),1);assert.strictEqual(call('wglDeleteContext',[b]),1);
  const worker=encoder?.snapshot();if(worker){assert(worker.replayCommands>0);assert.strictEqual(worker.fallbacks,0);}
  const result={kind:'server-publication-prerequisite',module:{bytes:bytes.length,sha256},control,queued,worker,observations,pixel,batches,events,copySupported:false};
  if(process.env.GL_PUBLICATION_RESULT)fs.writeFileSync(process.env.GL_PUBLICATION_RESULT,JSON.stringify(result,null,2)+'\n');
  console.log('PASS native producer publication',JSON.stringify(result));
 }finally{encoder?.publicationTestRelease();encoder?.stop();if(manager)await manager.stop();if(render)render.destroy();else bridge.destroy();}
}
(async()=>{
 const modes=process.argv.includes('--worker')?[true]:process.argv.includes('--direct')?[false]:[false,true];
 for(const queued of modes)await main(queued);
})().catch(err=>{console.error(err);process.exitCode=1;});
