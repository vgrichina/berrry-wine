'use strict';
// Independent period GL server state, raster, lighting and immutable Worker
// contract. This does not exercise or qualify wglCopyContext.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const root=process.cwd(),req=p=>require(path.join(root,p));
const {CALL_INDEX:O,OpenGLHostBridge}=req('lib/gl-compat'),Stream=req('lib/gl-command-stream');
async function main(){
 const bytes=process.env.GL_PERIOD_MODULE?fs.readFileSync(process.env.GL_PERIOD_MODULE):req('test/compile-src').compileSrcWasm();
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
  e=other;owner=2;
  if(!queued)new(req('lib/gl-software-producer').Producer)(()=>e).configure([1,64,64,0]);
  bind(b);bind(0);e=source;owner=1;
  const checks=[],cases=[],leases=[];
  const eq=(name,actual,expected)=>{assert.deepStrictEqual(actual,expected,name);checks.push({name,actual,expected});};
  const err=()=>call('glGetError');
  const vec=(values)=>{values.forEach((v,i)=>dv.setFloat32(wa(out)+i*4,v,true));return out;};
  const color=v=>call('glColor4f',v,[0,1,2,3]);
  const material=(face,p,v)=>call('glMaterialfv',[face,p,vec(v)]);
  const getMaterial=(face,p)=>Array.from(new Float32Array(memory.buffer,e.gl_mtx_material_ptr(p===0x1600?3:p-0x1200)+(face===0x405?2208:0),4));
  const selector=()=>[...query(0xb55),...query(0xb56),...query(0xb57)];
  eq('default independent polygon modes',query(0xb40,2),[0x1b02,0x1b02]);
  eq('default color material selectors and disabled state',selector(),[0x408,0x1602,0]);
  eq('default IsEnabled color material',call('glIsEnabled',[0xb57]),0);
  for(const [name,Type] of [['glGetFloatv',Float32Array],['glGetDoublev',Float64Array],['glGetBooleanv',Uint8Array]]){
    new Uint8Array(memory.buffer,wa(out),32).fill(0xa5);call(name,[0xb40,out]);
    eq(name+' polygon pair',Type===Float64Array?[0,1].map(i=>dv.getFloat64(wa(out)+8*i,true)):Array.from(new Type(memory.buffer,wa(out),2)),Type===Uint8Array?[1,1]:[0x1b02,0x1b02]);
  }
  for(const face of [0x404,0x405,0x408])for(const mode of [0x1b00,0x1b01,0x1b02]) {
    call('glPolygonMode',[face,mode]);eq('legal polygon mode error',err(),0);
    const q=query(0xb40,2);eq('selected polygon face',q[face===0x405?1:0],mode);
    if(face===0x408)eq('both polygon faces',q,[mode,mode]);
  }
  for(const face of [0x404,0x405,0x408])for(const parameter of [0x1200,0x1201,0x1202,0x1600,0x1602]) {
    call('glColorMaterial',[face,parameter]);eq('legal color material selection',selector(),[face,parameter,0]);eq('legal material error',err(),0);
  }
  for(const [name,args] of [['glPolygonMode',[0x400,0x1b01]],['glPolygonMode',[0x404,0x1b03]],
      ['glColorMaterial',[0x400,0x1202]],['glColorMaterial',[0x404,0x1601]]]) {
    const before=[...query(0xb40,2),...selector()];call(name,args);eq('invalid enum',err(),0x500);
    eq('invalid setter preserves all period state',[...query(0xb40,2),...selector()],before);
  }
  const before=[...query(0xb40,2),...selector()];
  call('glBegin',[4]);call('glPolygonMode',[0x408,0x1b00]);call('glColorMaterial',[0x404,0x1600]);call('glEnable',[0xb57]);call('glEnd');
  eq('Begin errors',err(),0x502);
  call('glBegin',[4]);call('glIsEnabled',[0xb57]);call('glEnd');eq('IsEnabled Begin rejection',err(),0x502);
  new Uint32Array(memory.buffer,wa(out),2).fill(0xdeadbeef);
  call('glBegin',[4]);call('glGetIntegerv',[0xb40,out]);call('glEnd');eq('getter Begin rejection',err(),0x502);
  eq('illegal getter preserves output',Array.from(new Uint32Array(memory.buffer,wa(out),2)),[0xdeadbeef,0xdeadbeef]);eq('Begin errors preserve state',[...query(0xb40,2),...selector()],before);
  const list=call('glGenLists',[1]);assert(list);
  call('glNewList',[list,0x1300]);call('glPolygonMode',[0x404,0x1b01]);call('glPolygonMode',[0x405,0x1b00]);
  call('glColorMaterial',[0x404,0x1202]);call('glEndList');
  eq('compile preserves caller state',[...query(0xb40,2),...selector()],before);
  const badList=call('glGenLists',[1]);
  call('glNewList',[badList,0x1300]);call('glPolygonMode',[0x404,0x1b03]);call('glColorMaterial',[0x405,0x1601]);
  call('glEndList');eq('invalid enum while compiling',err(),0x500);
  call('glCallList',[badList]);eq('invalid compiled commands are absent',err(),0);
  eq('invalid compilation preserves state',[...query(0xb40,2),...selector()],before);
  call('glCallList',[list]);eq('list replay independent face modes',query(0xb40,2),[0x1b01,0x1b00]);
  eq('list replay selectors',selector(),[0x404,0x1202,0]);
  call('glBegin',[4]);call('glCallList',[list]);call('glEnd');eq('list replay Begin rejection',err(),0x502);
  call('glPushAttrib',[8|64]);call('glPolygonMode',[0x408,0x1b02]);call('glColorMaterial',[0x405,0x1600]);call('glEnable',[0xb57]);call('glPopAttrib');
  eq('polygon and lighting attrib restore',[...query(0xb40,2),...selector()],[0x1b01,0x1b00,0x404,0x1202,0]);
  call('glPushAttrib',[0x2000]);call('glPolygonMode',[0x408,0x1b02]);call('glColorMaterial',[0x405,0x1600]);call('glEnable',[0xb57]);call('glPopAttrib');
  eq('enable attrib restores enable only',[...query(0xb40,2),...selector()],[0x1b02,0x1b02,0x405,0x1600,0]);
  call('glPushAttrib',[8]);call('glColorMaterial',[0x404,0x1200]);call('glPopAttrib');
  eq('polygon attrib preserves changed lighting selector',selector(),[0x404,0x1200,0]);
  call('glActiveTextureARB',[0x84c0]);call('glPushAttrib',[64]);
  call('glActiveTextureARB',[0x84c1]);call('glPointSize',[5],[0]);call('glFogi',[0xb61,7]);call('glEnable',[0xb44]);call('glPopAttrib');
  eq('lighting attrib preserves active texture',query(0x84e0),[0x84c1]);
  eq('lighting attrib preserves point size',query(0xb11),[5]);
  eq('lighting attrib preserves fog index',query(0xb61),[7]);
  eq('lighting attrib preserves unrelated culling enable',call('glIsEnabled',[0xb44]),1);call('glDisable',[0xb44]);
  call('glActiveTextureARB',[0x84c0]);
  // Foreign publication is inspected before a source query/rebind. Context b
  // retains its defaults and owns its own stack/client/resource identities.
  call('glPolygonMode',[0x404,0x1b01]);call('glPolygonMode',[0x405,0x1b00]);call('glColorMaterial',[0x404,0x1202]);
  assert.strictEqual(source.gl_wat_stream_commands(),0);
  e=other;owner=2;
  eq('source remains current',bridge.currentByOwner.get(1),a);eq('foreign destination remains unbound',bridge.currentByOwner.get(2),0);
  eq('published frontend independent polygon modes',bridge.contexts.get(a).frontend.polygonModes,[0x1b01,0x1b00]);
  bind(b);eq('destination defaults independent',[...query(0xb40,2),...selector()],[0x1b02,0x1b02,0x408,0x1602,0]);
  call('glPolygonMode',[0x408,0x1b00]);bind(0);e=source;owner=1;
  eq('foreign changes preserve source',[...query(0xb40,2),...selector()],[0x1b01,0x1b00,0x404,0x1202,0]);
  call('glViewport',[0,0,64,64]);call('glClearColor',[0,0,0,1],[0,1,2,3]);call('glPointSize',[3],[0]);
  function pixel(x,y) {
    const entry=e.gl_sw_entry()>>>0;assert(entry);
    const pitch=dv.getUint16(entry+18,true),height=dv.getUint16(entry+14,true),dib=dv.getUint32(entry+20,true);
    return dv.getUint32(dib+(height-1-y)*pitch+x*4,true)>>>0;
  }
  function draw(name,expected,{reverse=false,topology=4,hold=false,clipped=false,samples=[]}={}) {
    call('glClear',[0x4000]);
    let vertices=(topology===7||topology===2||topology===9)?[[-.8,-.8,0],[.8,-.8,0],[.8,.8,0],[-.8,.8,0]]:[[-.8,-.8,0],[.8,-.8,0],[0,.8,0]];
    if(clipped){vertices[0]=[-2,-.8,0];if(topology===7)vertices[3]=[-2,.8,0];}
    if(reverse)vertices=vertices.slice().reverse();
    delay=queued&&hold;call('glBegin',[topology]);for(const v of vertices)call('glVertex3f',v,[0,1,2]);call('glEnd');
    if(queued&&hold) {
      assert(encoder.snapshot().glQueued>0);encoder._submit();assert.strictEqual(delayed.length,1);
      const item=encoder.buffers.find(item=>item.seq===delayed[0].seq),before=Buffer.from(item.bytes.subarray(0,item.used));
      call('glPolygonMode',[0x408,0x1b02]);call('glColorMaterial',[0x405,0x1600]);call('glEnable',[0xb57]);color([1,0,0,1]);
      assert.deepStrictEqual(Buffer.from(item.bytes.subarray(0,item.used)),before,'later polygon/material mutations preserve immutable lease');
      leases.push({name,bytes:before.length,sha256:crypto.createHash('sha256').update(before).digest('hex'),immutable:true});encoder.releaseHeld();
    }
    call('glFinish');if(encoder)encoder.fence();
    let colored=0;for(let y=0;y<64;y++)for(let x=0;x<64;x++)if(pixel(x,y)&0xffffff)colored++;
    const actual=pixel(32,32)&0xffffff;eq(name+' center',actual,expected);
    const sampleResults=samples.map(([x,y,expected])=>{const actual=pixel(x,y)&0xffffff;eq(name+' sample '+x+','+y,actual,expected);return {x,y,expected,actual};});
    const raster=Buffer.alloc(64*64*4);for(let y=0;y<64;y++)for(let x=0;x<64;x++)raster.writeUInt32LE(pixel(x,y)&0xffffff,(y*64+x)*4);
    cases.push({name,actual,expected,colored,rasterSha256:crypto.createHash('sha256').update(raster).digest('hex'),samples:sampleResults,captureEnd:captures.length});
    return colored;
  }
  color([0,0,1,1]);call('glPolygonMode',[0x408,0x1b01]);
  assert(draw('both line triangle',0)>30,'wireframe boundary is drawn');
  call('glPolygonMode',[0x408,0x1b00]);const points=draw('both point triangle',0);assert(points>0&&points<64,'point footprints are drawn');
  call('glPolygonMode',[0x404,0x1b01]);call('glPolygonMode',[0x405,0x1b02]);
  draw('front line',0);draw('back fill',255,{reverse:true});
  call('glFrontFace',[0x900]);draw('front-face winding switch',255);call('glFrontFace',[0x901]);
  call('glEnable',[0xb44]);call('glCullFace',[0x404]);eq('front culling before polygon lowering',draw('culled front line',0),0);call('glDisable',[0xb44]);
  call('glPolygonMode',[0x408,0x1b01]);assert(draw('clipped wireframe boundary',0,{clipped:true})>30);
  assert(draw('quad outside boundary without diagonal',0,{topology:7})>50);
  call('glLineStipple',[1,0x1f0f]);call('glEnable',[0xb24]);
  const loopPixels=draw('stipple independent line loop',0,{topology:2});
  eq('quad boundary preserves logical polygon stipple phase',draw('stipple quad boundary',0,{topology:7}),loopPixels);
  eq('polygon boundary preserves logical polygon stipple phase',draw('stipple polygon boundary',0,{topology:9}),loopPixels);
  const stippled=cases.slice(-3);eq('logical polygon stipple raster matches independent loop',stippled.slice(1).map(c=>c.rasterSha256),[stippled[0].rasterSha256,stippled[0].rasterSha256]);
  call('glDisable',[0xb24]);
  call('glPolygonMode',[0x408,0x1b00]);draw('clipped quad point vertices',0,{topology:7,clipped:true,samples:[[0,25,0]]});
  call('glPolygonMode',[0x408,0x1b01]);
  draw('delayed original wireframe',0,{hold:true});call('glDisable',[0xb57]);
  // Emission is an independent lighting oracle with no diffuse or ambient
  // contribution. Its result therefore cannot pass through the old default
  // AMBIENT_AND_DIFFUSE implementation.
  call('glPolygonMode',[0x408,0x1b02]);call('glLightModelfv',[0xb53,vec([0,0,0,1])]);
  for(const p of [0x1200,0x1201,0x1202,0x1600])material(0x408,p,[0,0,0,1]);
  call('glEnable',[0xb50]);call('glLightModeli',[0xb52,1]);
  call('glColorMaterial',[0x404,0x1600]);color([0,0,1,1]);call('glEnable',[0xb57]);
  eq('enabled IsEnabled color material',call('glIsEnabled',[0xb57]),1);
  eq('tracked native emission',Array.from(new Float32Array(memory.buffer,e.gl_mtx_material_ptr(3),4)),[0,0,1,1]);
  eq('native retained front material',getMaterial(0x404,0x1600),[0,0,1,1]);
  eq('native retained back material',getMaterial(0x405,0x1600),[0,0,0,1]);
  draw('front tracked emission',255);draw('back untracked emission',0,{reverse:true});
  call('glPolygonMode',[0x404,0x1b01]);assert(draw('front lit wireframe',0)>30);
  call('glPolygonMode',[0x404,0x1b00]);const litPoints=draw('front lit points',0);assert(litPoints>0&&litPoints<64);
  call('glPolygonMode',[0x404,0x1b02]);
  call('glColorMaterial',[0x405,0x1600]);call('glColor4ub',[0,255,0,255]);
  draw('back tracked emission',0xff00,{reverse:true});draw('front retained independent emission',255);
  draw('delayed original back material',0xff00,{reverse:true,hold:true});
  color([0,1,0,1]);
  call('glDisable',[0xb57]);color([1,0,0,1]);draw('disabled tracking retains back material',0xff00,{reverse:true});
  eq('disabled tracking native material retains green',getMaterial(0x405,0x1600),[0,1,0,1]);
  call('glPushAttrib',[64]);
  material(0x408,0x1600,[1,0,0,1]);call('glLightModelfv',[0xb53,vec([1,1,1,1])]);
  call('glLightfv',[0x4000,0x1201,vec([1,0,0,1])]);call('glEnable',[0x4000]);call('glLightModeli',[0xb52,0]);
  call('glPopAttrib');draw('lighting attrib restores front emission',255);draw('lighting attrib restores back emission',0xff00,{reverse:true});
  for(const [parameter,ambient,light] of [[0x1200,[1,1,1,1],false],[0x1201,[0,0,0,1],true],[0x1202,[0,0,0,1],true],[0x1602,[1,1,1,1],false]]) {
    for(const p of [0x1200,0x1201,0x1202,0x1600])material(0x408,p,[0,0,0,1]);
    call('glLightModelfv',[0xb53,vec(ambient)]);call(light?'glEnable':'glDisable',[0x4000]);
    call('glColorMaterial',[0x404,parameter]);color([0,0,1,1]);call('glEnable',[0xb57]);
    draw('lighting parameter '+parameter.toString(16),255);call('glDisable',[0xb57]);
  }
  for(const face of [0x404,0x405,0x408])for(const parameter of [0x1200,0x1201,0x1202,0x1600,0x1602]) {
    call('glDisable',[0xb57]);
    for(const p of [0x1200,0x1201,0x1202,0x1600])material(0x408,p,[0,0,0,1]);
    const ambient=parameter===0x1200||parameter===0x1602,light=parameter===0x1201||parameter===0x1202;
    call('glLightModelfv',[0xb53,vec(ambient?[1,1,1,1]:[0,0,0,1])]);call(light?'glEnable':'glDisable',[0x4000]);
    call('glColorMaterial',[face,parameter]);color([0,0,1,1]);call('glEnable',[0xb57]);
    call('glNormal3f',[0,0,1],[0,1,2]);draw('face '+face.toString(16)+' parameter '+parameter.toString(16)+' front',face===0x405?0:255);
    call('glNormal3f',[0,0,-1],[0,1,2]);draw('face '+face.toString(16)+' parameter '+parameter.toString(16)+' back',face===0x404?0:255,{reverse:true});
    call('glDisable',[0xb57]);
  }
  call('glNormal3f',[0,0,1],[0,1,2]);
  eq('final no GL error',err(),0);
  const worker=encoder?.snapshot();if(worker){assert(worker.replayCommands>0);eq('actual Worker zero fallback',worker.fallbacks,0);assert(leases.length);}
  const result={kind:'period-polygon-color-material',queued,module:{bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')},checks,cases,leases,captures,worker,copySupported:false};
  if(process.env.GL_PERIOD_RESULT)fs.writeFileSync(process.env.GL_PERIOD_RESULT,JSON.stringify(result,null,2)+'\n');
  console.log('PASS period polygon/color-material',JSON.stringify({...result,captures:captures.length}));
 } finally {encoder?.releaseHeld();encoder?.stop();if(manager)await manager.stop();if(render)render.destroy();else bridge.destroy();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
