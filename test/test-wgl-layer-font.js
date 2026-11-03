'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const root=process.env.WINE_ROOT||'/home/user/wine-assembly',req=p=>require(path.join(root,p));
const {bootRenderHarness}=req('test/render-helper');
const Stream=req('lib/gl-command-stream');
const extraWat=`
 (func (export "wf_error") (result i32) (global.get $last_error))
 (func (export "wf_lock") (result i32) (i32.atomic.load (region.addr $GL_MTX_BLOCKS 8)))
 (func (export "wf_command") (param $name i32) (result i32)
   (local $slot i32)
   (local.set $slot (call $gl_list_slot (call $gl_list_context) (local.get $name)))
   (if (result i32) (local.get $slot) (then (i32.load (local.get $slot))) (else (i32.const 0))))

 (func (export "ci_sparse_page") (param $p i32) (result i32)
   (call $virtual_map_commit (local.get $p) (i32.const 4096)))
 (func (export "sf_dynamic") (param $p i32) (result i32)
  (local $esp i32) (local $answer i32)
  (local.set $esp (i32.load offset=16 (global.get $reg_base)))
  (call $handle_gpu_api (i32.const 50) (i32.const 1) (local.get $p) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
  (local.set $answer (i32.load (global.get $reg_base)))
  (i32.store offset=16 (global.get $reg_base) (local.get $esp)) (local.get $answer))
 (func (export "sf_pending") (result i32) (global.get $d3dim_worker_pending))
 (func (export "sf_init")
   (global.set $thunk_guest_base (i32.add (global.get $image_base) (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
   (call $update_thunk_end))
 (func (export "sf_regs") (result i32) (global.get $reg_base))
 (func (export "sf_module") (param $name i32) (result i32)
   (call $handle_LoadLibraryA (local.get $name) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "sf_lookup") (param $module i32) (param $name i32) (result i32)
   (call $handle_GetProcAddress (local.get $module) (local.get $name) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "sf_invoke") (param $thunk i32) (result i32)
   (call $win32_dispatch (i32.div_u (i32.sub (local.get $thunk) (global.get $thunk_guest_base)) (i32.const 8))) (i32.load (global.get $reg_base)))(func (export "sf_dc") (result i32)
 (call $handle_GetDC (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
 (drop (call $gdi_dc_set_field (i32.load (global.get $reg_base)) (i32.const 92) (i32.const 42) (i32.const 0)))
 (i32.load (global.get $reg_base)))`;
// Independent on-disk font readers: these do not call emulator font helpers.
function bitmapFixture(file) {
 const b=fs.readFileSync(path.join(root,'fonts',file)),ne=b.readUInt32LE(60);
 let p=ne+b.readUInt16LE(ne+36),shift=b.readUInt16LE(p);p+=2;
 while(b.readUInt16LE(p)){
  const type=b.readUInt16LE(p),n=b.readUInt16LE(p+2);p+=8;
  for(let i=0;i<n;i++,p+=12)if(type===0x8008){
   const start=b.readUInt16LE(p)*2**shift,f=b.subarray(start),h=f.readUInt16LE(88),ascent=f.readUInt16LE(74),first=f[95];
   return code=>{const at=148+(code-first)*6,w=f.readUInt16LE(at),off=f.readUInt32LE(at+2),pixels=[];
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)if((f[off+(x>>3)*h+y]>>(7-(x&7)))&1)pixels.push([x,ascent-1-y]);
    return {w,h,ascent,pixels};};
  }
 }throw Error('no bitmap strike');
}
function outlineFixture() {
 const b=fs.readFileSync(path.join(root,'fonts/subset/LiberationSans-Regular.ttf')),t={};
 for(let i=0;i<b.readUInt16BE(4);i++){const p=12+16*i;t[b.toString('ascii',p,p+4)]=b.readUInt32BE(p+8);}
 const em=b.readUInt16BE(t.head+18),long=b.readInt16BE(t.head+50),nh=b.readUInt16BE(t.hhea+34);
 const cm=t.cmap;let cmap;
 for(let i=0;i<b.readUInt16BE(cm+2);i++){const p=cm+4+i*8,o=cm+b.readUInt32BE(p+4);if(b.readUInt16BE(o)===4)cmap=o;}
 assert(cmap,'format 4 cmap');
 const gid=code=>{const n=b.readUInt16BE(cmap+6)/2,end=cmap+14,start=end+2*n+2,delta=start+2*n,range=delta+2*n;
  for(let i=0;i<n;i++)if(code<=b.readUInt16BE(end+2*i)){
   if(code<b.readUInt16BE(start+2*i))return 0;
   const d=b.readInt16BE(delta+2*i),r=b.readUInt16BE(range+2*i);
   if(!r)return (code+d)&65535;
   const g=b.readUInt16BE(range+2*i+r+2*(code-b.readUInt16BE(start+2*i)));return g?(g+d)&65535:0;
  }return 0;};
 const offset=g=>t.glyf+(long?b.readUInt32BE(t.loca+4*g):2*b.readUInt16BE(t.loca+2*g));
 function contours(g,depth=0){assert(depth<16);const at=offset(g);if(at===offset(g+1))return [];
  const n=b.readInt16BE(at);
  if(n<0){let p=at+10,all=[],flags;
   do{flags=b.readUInt16BE(p);const sub=b.readUInt16BE(p+2);p+=4;let x,y;
    assert(flags&2,'XY composite fixture');if(flags&1){x=b.readInt16BE(p);y=b.readInt16BE(p+2);p+=4;}else{x=b.readInt8(p);y=b.readInt8(p+1);p+=2;}
    let a=1,d=1,c=0,e=0;const f2=()=>{const v=b.readInt16BE(p)/16384;p+=2;return v;};
    if(flags&8)a=d=f2();else if(flags&64){a=f2();d=f2();}else if(flags&128){a=f2();c=f2();e=f2();d=f2();}
    all.push(...contours(sub,depth+1).map(cs=>cs.map(q=>({x:a*q.x+c*q.y+x,y:e*q.x+d*q.y+y,on:q.on}))));
   }while(flags&32);return all;
  }
  const ends=Array.from({length:n},(_,i)=>b.readUInt16BE(at+10+2*i)),count=ends.at(-1)+1;
  let p=at+10+2*n;p+=2+b.readUInt16BE(p);const flags=[];
  while(flags.length<count){const f=b[p++];flags.push(f);if(f&8){let r=b[p++];while(r--)flags.push(f);}}
  const pts=flags.map(f=>({on:!!(f&1)}));
  for(const [axis,short,same] of [['x',2,16],['y',4,32]]){let value=0;for(let i=0;i<count;i++){
   const f=flags[i];if(f&short){const d=b[p++];value+=(f&same)?d:-d;}else if(!(f&same)){value+=b.readInt16BE(p);p+=2;}pts[i][axis]=value;
  }}let start=0;return ends.map(end=>{const c=pts.slice(start,end+1);start=end+1;return c;});
 }
 function glyph(code){const g=gid(code),at=offset(g),cs=contours(g),segments=[];
  const add=(a,z)=>segments.push([[a.x/em,a.y/em],[z.x/em,z.y/em]]);
  for(const c of cs){const mid=(a,z)=>({x:(a.x+z.x)/2,y:(a.y+z.y)/2,on:true}),s=c[0].on?c[0]:c.at(-1).on?c.at(-1):mid(c.at(-1),c[0]);
   const walk=c[0].on?c.slice(1):c.at(-1).on?c.slice(0,-1):c.slice();walk.push(s);
   let prev=s;
   for(let i=0;i<walk.length;i++){const q=walk[i];if(q.on){add(prev,q);prev=q;}else{
    const next=walk[i+1],end=next.on?next:mid(q,next);let a=prev;
    // Fine fixed sampling provides an independent shape/area oracle, unrelated
    // to the implementation's adaptive subdivision and slab tessellation.
    for(let k=1;k<=256;k++){const u=k/256,v=1-u,z={x:v*v*prev.x+2*u*v*q.x+u*u*end.x,y:v*v*prev.y+2*u*v*q.y+u*u*end.y};add(a,z);a=z;}
    prev=end;if(next.on)i++;
   }}
  }
  const bbox=at===offset(g+1)?[0,0,0,0]:[2,4,6,8].map(i=>b.readInt16BE(at+i)/em);
  const advance=b.readUInt16BE(t.hmtx+4*Math.min(g,nh-1))/em;
  return {segments,metrics:[bbox[2]-bbox[0],bbox[3]-bbox[1],bbox[0],bbox[3],advance,0],area:Math.abs(segments.reduce((sum,[[x,y],[u,v]])=>sum+(x*v-u*y)/2,0))};
 }
 return {em,glyph};
}
function shapeChecks(glyph,scale=48,dx=8,dy=8){const checks=[];
 for(let y=1;y<63;y++)for(let x=1;x<63;x++){
  const a=(x+.5-dx)/scale,b=(y+.5-dy)/scale;let winding=0,dist=Infinity;
  for(const [[u,v],[r,s]] of glyph.segments){const vx=r-u,vy=s-v,len=vx*vx+vy*vy,tt=len?Math.max(0,Math.min(1,((a-u)*vx+(b-v)*vy)/len)):0;
   dist=Math.min(dist,Math.hypot(a-u-tt*vx,b-v-tt*vy));
   if(v<=b&&s>b&&(r-u)*(b-v)-(a-u)*(s-v)>0)winding++;
   if(s<=b&&v>b&&(r-u)*(b-v)-(a-u)*(s-v)<0)winding--;
  }if(dist>.035)checks.push([x,y,winding!==0]);
 }assert(checks.some(c=>c[2])&&checks.some(c=>!c[2]));return checks;
}
(async()=>{
 const queued=process.argv.includes('--worker');let encoder=null,manager=null,bridge=null,render=null,producer=null,memory;
 let forceNoRaster=false;let prebuiltModule=null;const batches=[],cases={};
 const recordModule=bytes=>{
  const sha256=require('crypto').createHash('sha256').update(bytes).digest('hex');
  console.log('WGL_FONT_MODULE_SHA256',sha256,'bytes',bytes.length);
  if(process.env.WGL_FONT_MODULE_OUT)fs.writeFileSync(process.env.WGL_FONT_MODULE_OUT,bytes);
 };
 if(process.env.WGL_FONT_MUTATION){
  const mutation=JSON.parse(fs.readFileSync(process.env.WGL_FONT_MUTATION));let applied=false;
  const bytes=req('test/compile-src').compileSrcWasm((file,source)=>{
   if(file===mutation.file){assert.strictEqual(source.split(mutation.from).length-1,1,'unique mutation');source=source.replace(mutation.from,mutation.to);applied=true;}
   return file==='13-exports.wat'?source+extraWat:source;
  });assert(applied);recordModule(bytes);prebuiltModule=new WebAssembly.Module(bytes);
 }
 if(!prebuiltModule){
  const bytes=process.env.WGL_FONT_MODULE?fs.readFileSync(process.env.WGL_FONT_MODULE):req('test/compile-src').compileSrcWasm((file,source)=>file==='13-exports.wat'?source+extraWat:source);
  recordModule(bytes);prebuiltModule=new WebAssembly.Module(bytes);
 }
 const h=await bootRenderHarness({fonts:'all',...(prebuiltModule?{prebuiltModule}:{extraWat}),width:64,height:64,extraHostOverrides:{gpu_gl_call(op,at,bytes){
  if(op===Stream.WAT_STREAM_FLUSH_OPCODE){
   const batch=Stream.memoryBatch(memory,at,bytes);let lifecycle=false;
   Stream.replay(batch,op=>{if(op===48||op===51)lifecycle=true;});
   if(!lifecycle)batches.push(Array.from(new Uint8Array(memory.buffer,at,bytes)));
   if(!render)return bridge.replay(Stream.memoryBatch(memory,at,bytes));
   const reply=render.execute({memoryOffset:at,bytes,owner:0,windows:Object.values(renderer.windows),softwareFront:e.gl_sw_front()});producer.configure(forceNoRaster?[0,0,0,0]:reply.producerConfig);return reply.value;
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
 e.sf_init();const regs=e.sf_regs(),stackGuest=e.guest_alloc(256)>>>0,stack=wa(stackGuest),input=e.guest_alloc(1024)>>>0,output=e.guest_alloc(1024)>>>0;
 function str(s){const p=e.guest_alloc(s.length+1)>>>0;new Uint8Array(memory.buffer,wa(p),s.length+1).set(Buffer.from(s+'\0'));return p;}
 const module=e.sf_module(str('opengl32.dll')),gdiModule=e.sf_module(str('gdi32.dll'));assert(module);const resolved=new Map(),table=req('src/api_table.json');
 function call(name,args=[],float=false,route='static'){
  const key=name+route;
  if(!resolved.has(key)){dv.setUint32(regs+16,stackGuest,true);const p=(route==='dynamic'?e.sf_dynamic(str(name)):e.sf_lookup(/^(?:gl|wgl)/.test(name)?module:gdiModule,str(name)))>>>0;assert(p,'real export '+name);assert.strictEqual(dv.getUint32(wa(p)+4,true),table.find(a=>a.name===name).id);resolved.set(key,p);}
  for(let i=0;i<8;i++)dv.setUint32(regs+i*4,0x55660000+i,true);
  dv.setUint32(regs+16,stackGuest,true);new Uint8Array(memory.buffer,stack,256).fill(0xa5);
  dv.setUint32(stack,0x12345678,true);args.forEach((v,i)=>(float===true||Array.isArray(float)&&float.includes(i))?dv.setFloat32(stack+4+i*4,v,true):dv.setUint32(stack+4+i*4,v>>>0,true));
  const before=Buffer.from(new Uint8Array(memory.buffer,stack,256)),value=e.sf_invoke(resolved.get(key))>>>0;
  assert.strictEqual(e.wf_lock(),0,'object lock released after '+name);
  assert.strictEqual(dv.getUint32(regs+16,true),stackGuest+4*(args.length+1),'stdcall '+name);
  for(let i=1;i<8;i++)if(i!==4)assert.strictEqual(dv.getUint32(regs+i*4,true),0x55660000+i,'register '+name);
  assert.deepStrictEqual(Buffer.from(new Uint8Array(memory.buffer,stack,256)),before,'stack canary '+name);return value;
 }
 const dc=e.sf_dc()>>>0;assert.strictEqual(call('SetPixelFormat',[dc,1,0]),1);const context=call('wglCreateLayerContext',[dc,0]);assert(context);assert.strictEqual(call('wglMakeCurrent',[dc,context]),1);e.gl_sw_set_default_size(64,64);
 call('glViewport',[0,0,64,64]);e.gl_mtx_set_mode(0x1701);e.gl_mtx_load_identity();e.gl_mtx_ortho(0,64,0,64,-1,1);e.gl_mtx_set_mode(0x1700);e.gl_mtx_load_identity();
 call('glColor4f',[1,1,1,1],true);call('glClearColor',[0,0,0,1],true);

 const clear=()=>call('glClear',[0x4500]);
 const draw=(mode,pts,flags)=>{call('glBegin',[mode]);pts.forEach((p,i)=>{if(flags)call('glEdgeFlag',[flags[i%flags.length]]);call(p.length===3?'glVertex3f':'glVertex2f',p,true);});call('glEnd');};
 const pixel=(x,y)=>{const entry=e.gl_sw_entry()>>>0,pitch=dv.getUint16(entry+18,true),height=dv.getUint16(entry+14,true),dib=dv.getUint32(entry+20,true);return dv.getUint32(dib+(height-1-y)*pitch+4*x,true)&0xffffff;};
 const region=(x,y,r=1)=>{if(encoder)encoder.fence();let count=0;for(let a=x-r;a<=x+r;a++)for(let b=y-r;b<=y+r;b++)if(a>=0&&a<64&&b>=0&&b<64&&pixel(a,b))count++;return count;};
 const take=name=>{e.gl_wat_stream_flush();if(encoder)encoder.fence();cases[name]=batches.splice(0);
  if(process.env.WGL_FONT_PIXELS&&name!=='setup'){
   const {PNG}=require('pngjs'),png=new PNG({width:64,height:64});
   for(let y=0;y<64;y++)for(let x=0;x<64;x++){const v=pixel(x,63-y),i=(y*64+x)*4;png.data.set([(v>>>16)&255,(v>>>8)&255,v&255,255],i);}
   fs.mkdirSync(process.env.WGL_FONT_PIXELS,{recursive:true});fs.writeFileSync(path.join(process.env.WGL_FONT_PIXELS,name+'.png'),PNG.sync.write(png));
  }
 };
 const query=p=>{call('glGetIntegerv',[p,output]);return dv.getInt32(wa(output),true);};

 const err=()=>call('glGetError'),alloc=n=>{const p=e.guest_alloc(n)>>>0;assert(p);return p;};
 const mem=(p,n)=>new Uint8Array(memory.buffer,wa(p),n);
 const wide=s=>{const p=alloc((s.length+1)*2);mem(p,(s.length+1)*2).set(Buffer.from(s+'\0','utf16le'));return p;};
 const font=(face,height=-24)=>call('CreateFontW',[height,0,0,0,400,0,0,0,0,0,0,0,0,wide(face)]);
 function commands(name){let p=e.wf_command(name)>>>0;const out=[];while(p>2){assert(out.length<1000000);out.push({op:dv.getUint32(p+4,true),words:[12,16,20].map(i=>dv.getUint32(p+i,true)),v:[12,16,20].map(i=>dv.getFloat32(p+i,true)),p});p=dv.getUint32(p,true);}return out;}
 const raster=(x,y)=>call('glRasterPos2f',[x,y],true);
 const rasterValue=()=>{call('glGetFloatv',[0xb07,output]);return [0,1,2,3].map(i=>dv.getFloat32(wa(output)+4*i,true));};
 const bitmap=bitmapFixture('System.fon'),tt=outlineFixture();
 const system=call('GetStockObject',[13]);assert(system);call('SelectObject',[dc,system]);
 const sourceDc=call('CreateCompatibleDC',[0]);assert(sourceDc);call('SelectObject',[sourceDc,system]);
 const second=call('wglCreateContext',[dc]);assert(second&&second!==context);
 assert.strictEqual(call('wglShareLists',[context,second]),1);
 // Real context creation, rejection and stdcall on both resolution routes.
 for(const route of ['static','dynamic']){
  const ordinary=call('wglCreateLayerContext',[dc,0],false,route);assert(ordinary&&ordinary!==context);assert.strictEqual(call('wglMakeCurrent',[dc,ordinary]),1);assert.strictEqual(call('wglGetCurrentContext'),ordinary);assert.strictEqual(call('wglMakeCurrent',[dc,context]),1);assert.strictEqual(call('wglDeleteContext',[ordinary]),1);
  for(const plane of [-2147483648,-1,1,16,2147483647]){
   assert.strictEqual(call('wglCreateLayerContext',[dc,plane],false,route),0);assert.strictEqual(e.wf_error(),87);
  }
  assert.strictEqual(call('wglCreateLayerContext',[0x1234,0],false,route),0);assert.strictEqual(e.wf_error(),6);
 }
 // Capture a glyph from a different DC, using its selected font.
 for(const [code,list] of [[65,100],[103,101],[32,102],[0,103]])assert.strictEqual(call('wglUseFontBitmapsA',[sourceDc,code,1,list]),1);
 for(const [code,list] of [[65,100],[103,101],[32,102]]){
  const fixture=bitmap(code),cs=commands(list);assert.strictEqual(cs.length,1);assert.strictEqual(cs[0].op,131);
  const p=cs[0].p,w=dv.getUint32(p+12,true),h=dv.getUint32(p+16,true),xo=dv.getFloat32(p+20,true),yo=dv.getFloat32(p+24,true);
  assert.strictEqual(dv.getFloat32(p+28,true),fixture.w,'independent FNT cell advance');
  const actual=[];for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(dv.getUint8(p+88+y*w+x))actual.push([x-xo,y-yo]);
  assert.deepStrictEqual(actual.sort((a,b)=>a[1]-b[1]||a[0]-b[0]),fixture.pixels.sort((a,b)=>a[1]-b[1]||a[0]-b[0]),'independent FNT pixels and bitmap origin '+code);
 }
 assert.strictEqual(commands(103).length,0,'undefined glyph is an empty list');assert.strictEqual(call('glIsList',[103]),1);
 // Unpack state is irrelevant to generated lists and must remain intact.
 for(const [p,v] of [[0xcf5,8],[0xcf2,127],[0xcf3,9],[0xcf4,5],[0xcf1,1]])call('glPixelStorei',[p,v]);
 assert.strictEqual(call('wglUseFontBitmapsA',[sourceDc,65,1,104],false,'dynamic'),1);
 for(const [p,v] of [[0xcf5,8],[0xcf2,127],[0xcf3,9],[0xcf4,5],[0xcf1,1]])assert.strictEqual(query(p),v);
 for(const [p,v] of [[0xcf5,4],[0xcf2,0],[0xcf3,0],[0xcf4,0],[0xcf1,0]])call('glPixelStorei',[p,v]);
 take('setup');clear();raster(8,24);
 if(process.env.WGL_FONT_SUPPRESS){const p=commands(100)[0].p;new Uint8Array(memory.buffer,p+88,dv.getUint32(p+84,true)).fill(0);}
 call('glCallList',[100]);call('glCallList',[101]);call('glCallList',[102]);
 const advance=bitmap(65).w+bitmap(103).w+bitmap(32).w;
 assert.deepStrictEqual(rasterValue(),[8+advance,24,.5,1],'glyph cell advances and empty-ink space');
 if(encoder)encoder.fence();const expected=new Set();
 for(const [code,dx] of [[65,8],[103,8+bitmap(65).w]])for(const [x,y] of bitmap(code).pixels)expected.add((24+y)*64+dx+x);
 const bitmapChecks=[];for(let y=0;y<64;y++)for(let x=0;x<64;x++){
  const yes=expected.has(y*64+x);assert.strictEqual(pixel(x,y)!==0,yes,'independent bitmap glyph pixel '+x+','+y);bitmapChecks.push([x,y,yes]);
 }take('bitmap');cases.bitmapChecks=bitmapChecks;
 // Preserve a pre-existing GL error; WGL font construction doesn't consume it.
 call('glIndexPointer',[0x9999,0,input]);assert.strictEqual(call('wglUseFontBitmapsA',[dc,65,1,104]),1);assert.strictEqual(err(),0x500);
 for(const args of [[0x1234,65,1,100],[dc,0xffffffff,2,100],[dc,65,2,0xffffffff],[dc,65,1,0]])assert.strictEqual(call('wglUseFontBitmapsA',args),0);
 assert.strictEqual(call('wglUseFontBitmapsA',[dc,65,0,100]),1);
 const old=commands(100).map(c=>c.p);
 call('glNewList',[400,0x1300]);assert.strictEqual(call('wglUseFontBitmapsA',[dc,65,1,100]),0);call('glEndList');
 call('glBegin',[1]);assert.strictEqual(call('wglUseFontBitmapsA',[dc,65,1,100]),0);call('glEnd');
 assert.deepStrictEqual(commands(100).map(c=>c.p),old,'invalid construction preserves old list');assert.strictEqual(err(),0);
 // TrueType selected into the font DC supplies a visibly different bitmap.
 const arial=font('Arial');assert(arial);call('SelectObject',[sourceDc,arial]);
 assert.strictEqual(call('wglUseFontBitmapsA',[sourceDc,65,1,105]),1);assert.notDeepStrictEqual(commands(105).map(c=>c.words),commands(100).map(c=>c.words));
 assert.strictEqual(call('wglUseFontBitmapsA',[dc,32,96,500]),1,'complete contiguous ANSI bitmap range');
 for(let code=32;code<128;code++){const cs=commands(500+code-32);assert.strictEqual(cs.length,1);assert.strictEqual(dv.getFloat32(cs[0].p+28,true),bitmap(code).w,'range glyph advance '+code);}
 // Outline metrics and filled shape derive independently from the sfnt file.
 const outline=(code,list,dev=0,depth=0,format=1,out=output,route='static')=>call('wglUseFontOutlinesA',[sourceDc,code,1,list,dev,depth,format,out],[4,5],route);
 function checkMetrics(code){const want=tt.glyph(code).metrics;const actual=want.map((_,i)=>dv.getFloat32(wa(output)+4*i,true));
  want.forEach((v,i)=>assert(Math.abs(actual[i]-v)<1e-6,'independent outline metrics '+code+'/'+i+': '+actual[i]+' vs '+v));assert.strictEqual(dv.getUint8(wa(output)+24),0xcd);return actual;
 }
 function capArea(cs,z){let mode=-1,vertices=[],sum=0;for(const c of cs){if(c.op===21){mode=c.words[0];vertices=[];}else if(c.op===22)mode=-1;
  else if(c.op===30&&mode===4&&Math.abs(c.v[2]-z)<1e-6){vertices.push(c.v);if(vertices.length===3){const [a,b,c]=vertices;sum+=((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2;vertices=[];}}}return sum;}
 for(const [code,list] of [[65,200],[79,201],[103,202],[233,203],[32,204]]){
  mem(output,64).fill(0xcd);assert.strictEqual(outline(code,list),1);const metrics=checkMetrics(code),cs=commands(list);
  assert.strictEqual(cs.at(-1).op,41);assert.deepStrictEqual(cs.at(-1).v,[Math.fround(metrics[4]),Math.fround(metrics[5]),0]);
  assert(Math.abs(capArea(cs,0)-tt.glyph(code).area)<.001,'cap area, including holes/composites '+code);
 }
 mem(output,128).fill(0xcd);assert.strictEqual(call('wglUseFontOutlinesA',[sourceDc,64,4,600,0,0,1,output],[4,5]),1,'contiguous outline range');
 for(let j=0;j<4;j++){const want=tt.glyph(64+j).metrics;want.forEach((v,i)=>assert(Math.abs(dv.getFloat32(wa(output)+24*j+4*i,true)-v)<1e-6,'range outline metric'));assert.strictEqual(commands(600+j).at(-1).op,41);}
 assert(mem(output,128).subarray(96).every(v=>v===0xcd),'range metric canary');
 assert.strictEqual(outline(79,205,.05,0,0,0,'dynamic'),1);const coarse=commands(205).filter(c=>c.op===30).length;
 assert.strictEqual(outline(79,206,0,0,0,0),1);const fine=commands(206).filter(c=>c.op===30).length;
 assert(fine>coarse,'deviation changes actual curve geometry');assert(!commands(206).some(c=>c.op===63),'line lists contain no normals');
 assert.strictEqual(outline(79,207,0,.25,1,0),1);const extruded=commands(207);
 assert(Math.abs(capArea(extruded,0)-tt.glyph(79).area)<.001);assert(Math.abs(capArea(extruded,-.25)+tt.glyph(79).area)<.001,'back cap winding');
 assert(extruded.some(c=>c.op===30&&c.v[2]===-.25));assert(extruded.some(c=>c.op===21&&c.words[0]===7),'real side quads');
 for(const c of extruded.filter(c=>c.op===63))assert(Math.abs(Math.hypot(...c.v)-1)<1e-6,'unit polygon normals');
 assert.strictEqual(outline(79,208,0,.25,0,0),1);assert(commands(208).some(c=>c.op===30&&c.v[2]===-.25),'extruded line geometry');
 // Replacing a bitmap list with outlines retires old commands and changes type.
 assert.strictEqual(outline(65,104),1);assert(!commands(104).some(c=>c.op===131));
 for(const code of [65,79,103,233]){
  const list={65:200,79:201,103:202,233:203}[code];clear();call('glLoadIdentity');call('glTranslatef',[8,8,0],true);call('glScalef',[48,48,1],true);
  call('glCallList',[list]);if(encoder)encoder.fence();const checks=shapeChecks(tt.glyph(code));
  for(const [x,y,yes] of checks)assert.strictEqual(pixel(x,y)!==0,yes,'independent outline glyph '+code+' pixel '+x+','+y);
  take('outline'+code);cases['outline'+code+'Checks']=checks;
  call('glGetFloatv',[0xba6,output]);assert(Math.abs(dv.getFloat32(wa(output)+48,true)-(8+48*tt.glyph(code).metrics[4]))<1e-5,'list final modelview translation');
 }
 // Oblique extrusion has an independently computed silhouette: project each
 // nonzero-winding font interval through a negative-z segment. Its left edge
 // extends by depth*sin(60), unlike a flat glyph or a substituted rectangle.
 clear();call('glLoadIdentity');call('glTranslatef',[24,8,0],true);call('glScalef',[48,48,1],true);call('glRotatef',[60,0,1,0],true);call('glCallList',[207]);
 if(encoder)encoder.fence();const extrusionChecks=[],glyphO=tt.glyph(79),cos=.5,sin=Math.sqrt(3)/2;
 const minY=Math.min(...glyphO.segments.flatMap(s=>s.map(p=>p[1]))),maxY=Math.max(...glyphO.segments.flatMap(s=>s.map(p=>p[1])));
 for(let y=10;y<42;y++){
  const yy=(y+.5-8)/48,xs=[];
  if(yy<minY+2/48||yy>maxY-2/48)continue; // Exclude cap silhouette extrema as well as horizontal boundaries.
  for(const [[x0,y0],[x1,y1]] of glyphO.segments)if((y0<=yy&&y1>yy)||(y1<=yy&&y0>yy))xs.push([x0+(yy-y0)*(x1-x0)/(y1-y0),y1>y0?1:-1]);
  xs.sort((a,b)=>a[0]-b[0]);let winding=0,left;const intervals=[];
  for(const [xx,d] of xs){if(!winding)left=xx;winding+=d;if(!winding)intervals.push([24+48*(cos*left-.25*sin),24+48*cos*xx]);}
  for(let x=1;x<63;x++){
   const distances=intervals.flatMap(([a,b])=>[Math.abs(x+.5-a),Math.abs(x+.5-b)]);
   if(distances.length&&Math.min(...distances)>2){const yes=intervals.some(([a,b])=>x+.5>a&&x+.5<b);assert.strictEqual(pixel(x,y)!==0,yes,'oblique extrusion silhouette '+x+','+y);extrusionChecks.push([x,y,yes]);}
  }
 }
 assert(extrusionChecks.some(([x,,yes])=>x<22&&yes),'negative-z geometry extends left of flat glyph');take('extrusion');cases.extrusionChecks=extrusionChecks;
 // Lines must reach the outline and preserve a clear counter; actual pixels
 // accompany the independent segment-count/deviation checks above.
 clear();call('glLoadIdentity');call('glTranslatef',[8,8,0],true);call('glScalef',[48,48,1],true);call('glCallList',[206]);
 if(encoder)encoder.fence();assert(region(25,24,2)===0,'line counter remains empty');let linePixels=0;for(let y=0;y<64;y++)for(let x=0;x<64;x++)if(pixel(x,y))linePixels++;assert(linePixels>30&&linePixels<250,'real contour line pixels');take('lines');
 // Bad format, negative/nonfinite tolerances/depth, ranges, DC and current state.
 const outlineOld=commands(200).map(c=>c.p);mem(output,64).fill(0xcd);
 for(const [dev,depth,fmt] of [[-1,0,1],[NaN,0,1],[Infinity,0,1],[0,-1,1],[0,NaN,1],[0,Infinity,1],[0,0,-1],[0,0,2]])assert.strictEqual(outline(65,200,dev,depth,fmt),0);
 assert.strictEqual(call('wglUseFontOutlinesA',[0x1234,65,1,200,0,0,1,output],[4,5]),0);assert.strictEqual(e.wf_error(),6);
 for(const [first,count,base] of [[65535,2,200],[65,2,0xffffffff],[65,1,0]])assert.strictEqual(call('wglUseFontOutlinesA',[sourceDc,first,count,base,0,0,1,output],[4,5]),0);
 assert(mem(output,64).every(v=>v===0xcd),'rejected outlines leave metrics untouched');assert.deepStrictEqual(commands(200).map(c=>c.p),outlineOld);
 // A real subdivision-limit failure occurs after earlier glyphs were staged.
 // It must publish neither those definitions nor metrics, and retain GL errors.
 for(const base of [200,800]){
  mem(output,256).fill(0xcd);if(base===200)call('glIndexPointer',[0x9999,0,input]);
  assert.strictEqual(call('wglUseFontOutlinesA',[sourceDc,32,6,base,2**-50,0,1,output],[4,5]),0,'bounded subdivision failure');assert.strictEqual(e.wf_error(),8);
  assert.strictEqual(err(),base===200?0x500:0);assert(mem(output,256).every(v=>v===0xcd));
  assert.deepStrictEqual(commands(200).map(c=>c.p),outlineOld,'staged failure retains prior definitions');assert.strictEqual(call('glIsList',[800]),0);
 }
 call('SelectObject',[sourceDc,system]);assert.strictEqual(outline(65,200),0,'raster font cannot supply contours');call('SelectObject',[sourceDc,arial]);
 call('glNewList',[400,0x1300]);assert.strictEqual(outline(65,200),0);call('glEndList');
 call('glBegin',[1]);assert.strictEqual(outline(65,200),0);call('glEnd');assert.strictEqual(err(),0);
 call('wglMakeCurrent',[0,0]);assert.strictEqual(outline(65,200),0);assert.strictEqual(call('wglUseFontBitmapsA',[sourceDc,65,1,100]),0);
 call('wglMakeCurrent',[dc,second]);assert.strictEqual(call('glIsList',[200]),1,'shared font lists');
 assert.strictEqual(call('wglDeleteContext',[context]),1,'shared glyphs survive source context deletion');
 e.gl_sw_set_default_size(64,64);call('glViewport',[0,0,64,64]);e.gl_mtx_set_mode(0x1701);e.gl_mtx_load_identity();e.gl_mtx_ortho(0,64,0,64,-1,1);e.gl_mtx_set_mode(0x1700);call('glColor4f',[1,1,1,1],true);
 clear();call('glLoadIdentity');raster(8,24);call('glCallList',[100]);if(encoder)encoder.fence();assert(pixel(10,30)!==0||region(12,30,4)>0,'shared bitmap still draws');take('shared');
 const third=call('wglCreateContext',[dc]);call('wglMakeCurrent',[dc,third]);assert.strictEqual(call('glIsList',[200]),0,'unshared namespace');
 assert.strictEqual(call('wglUseFontOutlinesA',[sourceDc,32,6,800,2**-50,0,1,output],[4,5]),0);assert.strictEqual(e.wf_error(),8);assert.strictEqual(err(),0);
 call('wglMakeCurrent',[dc,second]);assert.strictEqual(call('wglShareLists',[second,third]),1,'failed font construction leaves destination namespace empty');
 call('glDeleteLists',[200,1]);assert.strictEqual(call('glIsList',[200]),0);assert.strictEqual(outline(65,200),1,'delete and recreate');
 assert.strictEqual(call('DeleteDC',[sourceDc]),1);assert.strictEqual(call('DeleteObject',[arial]),1);assert.strictEqual(err(),0);
 clear();call('glLoadIdentity');call('glTranslatef',[8,8,0],true);call('glScalef',[48,48,1],true);call('glCallList',[200]);if(encoder)encoder.fence();
 for(const [x,y,yes] of shapeChecks(tt.glyph(65)))assert.strictEqual(pixel(x,y)!==0,yes,'glyph survives font/DC deletion');take('retired-font');
 call('wglMakeCurrent',[0,0]);call('wglDeleteContext',[second]);call('wglDeleteContext',[third]);
 if(process.env.WGL_FONT_CAPTURE)fs.writeFileSync(process.env.WGL_FONT_CAPTURE,JSON.stringify(cases));
 if(encoder){const stats=encoder.snapshot();assert(stats.glQueued>0,'actual glyph draws queued');assert.strictEqual(stats.fallbacks,0);console.log('WGL_FONT_WORKER',JSON.stringify(stats));}
 console.log('PASS WGL real layer0, FNT bitmap pixels/origins/advances, sfnt outline metrics/area/holes/composites/deviation/extrusion/normals/pixels, public resolved stdcall/canaries, rejection, list replacement/sharing/lifetime; '+(queued?'Worker':'direct'));
 }finally{encoder?.stop();if(manager)await manager.stop();}
})().catch(error=>{console.error(error);process.exitCode=1;});
