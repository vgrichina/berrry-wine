#!/usr/bin/env node
'use strict';
// No emulator compilation or guest execution. Compile only five byte-exact
// production clear/range functions against one page of private memory.
const assert=require('assert'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
if(process.env.WINE_CLEAR_BASELINE==='1'){
  const Module=require('module'),load=Module._extensions['.js'];
  Module._extensions['.js']=(m,file)=>{
    if(['d3d9-host.js','d3d9-backend.js','d3d9-software-backend.js','d3d9-render-worker.js']
      .some(n=>file===path.join(root,'lib',n))){
      const source=require('child_process').execFileSync('git',['show',
        'f6571101e38985b3fa34d328f2ccadd9735a7573:lib/'+path.basename(file)],
        {cwd:root,stdio:['ignore','pipe','ignore'],maxBuffer:262144}).toString();
      return m._compile(source,file);
    }
    return load(m,file);
  };
}
const Clear=require('../lib/render-clear'),Stream=require('../lib/d3d-command-stream');
const {Device:Software}=require('../lib/d3d9-software-backend');
const {Device:GPU}=require('../lib/d3d9-backend');
const {Bridge}=require('../lib/d3d9-host'),Worker=require('../lib/d3d9-render-worker');
const O=Stream.OPCODES,sha=s=>crypto.createHash('sha256').update(s).digest('hex');
function extract(source,name){
  const start=source.indexOf('(func $'+name+' ');assert(start>=0,name);
  let level=0,string=false,comment=false;
  for(let i=start;i<source.length;i++){
    const c=source[i];
    if(comment){if(c==='\n')comment=false;continue;}
    if(!string&&c===';'&&source[i+1]===';'){comment=true;continue;}
    if(c==='"'&&source[i-1]!=='\\')string=!string;
    if(!string){if(c==='(')level++;if(c===')'&&!--level)return source.slice(start,i+1);}
  }
  throw Error('unterminated function '+name);
}
function native(){
  // Historical excerpt compiler identities, not moving build compiler pins.
  // Recover its five Git objects in memory instead of copying an old checkout.
  const compilerCommit='f6571101e38985b3fa34d328f2ccadd9735a7573';
  const compiler=path.resolve(process.env.WINE_CLEAR_COMPILER||path.join(root,'tools/watx.js'));
  const pins=require('./support/d3d9-clear-excerpt-pins.json');
  const compilerRoot=path.dirname(path.dirname(compiler)),inputs=new Map();
  for(const [file,pin]of Object.entries(pins.compiler)){
    const bytes=process.env.WINE_CLEAR_COMPILER
      ?fs.readFileSync(path.join(compilerRoot,file))
      :require('child_process').execFileSync('git',['show',compilerCommit+':'+file],
        {cwd:root,maxBuffer:1048576});
    assert.strictEqual(bytes.length,pin.bytes,file);assert.strictEqual(sha(bytes),pin.sha256,file);
    assert.strictEqual(crypto.createHash('sha1').update('blob '+bytes.length)
      .update(Buffer.from([0])).update(bytes).digest('hex'),pin.blob,file);
    inputs.set(path.join(compilerRoot,file),bytes);
  }
  assert(inputs.has(compiler),'compiler override must name the pinned tools/watx.js');
  // Execute the pinned loader with reads restricted to those verified bytes.
  // Keep this private: no global require/fs replacement or source-tree archive.
  const Module=require('module'),loader=new Module(compiler,module);
  const nativeRequire=Module.createRequire(compiler);
  loader.filename=compiler;
  loader.require=id=>id==='fs'?{readFileSync(file,encoding){
    const bytes=inputs.get(path.resolve(file));assert(bytes,'unpinned compiler input: '+file);
    return encoding?bytes.toString(encoding):bytes;
  }}:nativeRequire(id);
  loader._compile(inputs.get(compiler).toString('utf8'),compiler);
  const parts=[['src/09ag-d3d-shader-vm.wat','d3d_shader_vm_range'],
    ...['d3d_software_clear','d3d_software_clear_masked','d3d_software_clear_stencil','d3d_software_quantize_depth']
      .map(n=>['src/09ah-d3d-software.wat',n])];
  const slices=parts.map(([file,name])=>({file,name,text:extract(fs.readFileSync(path.join(root,file),'utf8'),name)}));
  for(const s of slices){const pin=pins.functions[s.name];assert.strictEqual(sha(s.text),pin.sha256,s.name);assert.strictEqual(Buffer.byteLength(s.text),pin.bytes,s.name);}
  const source='(memory 1 1)\n(export "memory" (memory 0))\n'+slices.map(s=>s.text).join('\n')+'\n';
  assert(Buffer.byteLength(source)<8192,'bounded native excerpt');
  const r=loader.exports.compile(source,new Map(),{mode:'production',standardWat:true,runtimeBuiltins:false,strictDeclarations:true});
  assert(r.success,r.error||r.message);const bytes=Buffer.from(r.wasmBinary);
  const e=new WebAssembly.Instance(new WebAssembly.Module(bytes)).exports;
  for(const name of parts.slice(1).map(p=>p[1]))assert.strictEqual(typeof e[name],'function',name);
  return {e,receipt:{compiler,compilerCommit,compilerSource:process.env.WINE_CLEAR_COMPILER?'verified override':'Git objects in memory',sourceBytes:Buffer.byteLength(source),sourceSHA256:sha(source),moduleBytes:bytes.length,moduleSHA256:sha(bytes)}};
}
const {e,receipt}=native(),memory=e.memory.buffer;
const color={id:7,width:4,height:4,format:21},other={...color,id:8};
const depth={id:11,width:4,height:4,format:80};
function software(){
  // Fixed allocations replace unrelated heap/program initialization. Every
  // clear, metadata check, quantization and pixel store uses production code.
  const d=Object.create(Software.prototype);
  Object.assign(d,{width:4,height:4,pitch:16,format:21,active:null,destroyed:false,
    options:{getExports:()=>e,getMemory:()=>memory},target:{wa:1024,bytes:64},depth:{wa:2048,bytes:64},
    colorSurfaces:new Map([[7,{...color,wa:4096,pitch:16,bytes:64}],
      [8,{...other,wa:8192,pitch:16,bytes:64}]]),depthSurfaces:new Map([[11,{...depth,wa:12288,pitch:16}]]),queries:new Map()});
  return d;
}
const sw=software(),pixel=(wa,x,y)=>Array.from(new Uint8Array(memory,wa+y*16+x*4,4));
function reset(){
  for(const wa of [1024,4096,8192])for(let i=0;i<16;i++)new Uint8Array(memory,wa+i*4,4).set([11,22,33,44]);
  for(const wa of [2048,12288])new Float32Array(memory,wa,16).fill(.75);
}
const input={color:[1,.5,.25,.75],flags:3,depth:.25,rects:[[-2,1,3,9]],colorMask:5,
  colorAttachment:color,depthAttachment:depth};
const desc=Clear.create(input,4,4);
assert.deepStrictEqual(desc.rects,[[0,1,3,4]]);
reset();assert.deepStrictEqual(sw.execute({opcode:O.CLEAR,payload:desc}),{value:1,complete:true});
assert.deepStrictEqual(pixel(4096,1,2),[64,22,255,44],
  'production CLEAR must preserve disabled green/alpha channels');
assert.deepStrictEqual(pixel(4096,3,2),[11,22,33,44]);
assert.deepStrictEqual(pixel(8192,1,2),[11,22,33,44],'other attachment preserved');
const quantized=Math.fround(16384/65535);
assert.strictEqual(new Float32Array(memory,12288+2*16+4,1)[0],quantized);
assert.strictEqual(new Float32Array(memory,12288+2*16+12,1)[0],.75);
assert.strictEqual(new Float32Array(memory,2048+2*16+4,1)[0],.75,'default depth untouched');

// Immutable owner snapshot, including every nested rectangle and attachment.
input.color.fill(0);input.rects[0].fill(0);color.id=99;depth.format=75;
assert.deepStrictEqual(desc.color,[1,.5,.25,.75]);assert.strictEqual(desc.colorAttachment.id,7);
assert.strictEqual(desc.depthAttachment.format,80);color.id=7;depth.format=80;
for(const x of [desc,desc.color,desc.rects,...desc.rects,desc.colorAttachment,desc.depthAttachment])assert(Object.isFrozen(x));
assert.throws(()=>{desc.rects[0][0]=2;},TypeError);

// The actual queue and software command executor order clears between DRAW
// observation markers. Draw rasterization is deliberately outside this test.
function ordered(payload=desc,order=['before','clear','after']){
  reset();const observed=[];
  const q=new Stream.CommandQueue({deviceId:1,consumer:{execute(c){
    if(c.opcode===O.DRAW){observed.push([c.payload.label,pixel(4096,1,2),new Float32Array(memory,12288+36,1)[0]]);return {value:1,complete:true};}
    return sw.execute(c);
  }}});
  for(const item of order){const r=q.submit(item==='clear'?O.CLEAR:O.DRAW,item==='clear'?payload:{label:item});assert.strictEqual(r.status,'completed');}
  return observed;
}
const expectOrder=observed=>assert.deepStrictEqual(observed,[['before',[11,22,33,44],.75],['after',[64,22,255,44],quantized]]);
expectOrder(ordered());
for(const [name,p]of Object.entries({flags:{...desc,flags:2},attachment:{...desc,colorAttachment:other},
  rectangle:{...desc,rects:[[0,0,1,1]]},mask:{...desc,colorMask:15},
  depthAttachment:{...desc,depthAttachment:undefined},depth:{...desc,depth:.5}}))
  assert.throws(()=>expectOrder(ordered(p)),assert.AssertionError,name+' rejecting oracle');
assert.throws(()=>expectOrder(ordered(desc,['clear','before','after'])),assert.AssertionError,'order rejecting oracle');

// Absent depth is legal for color and illegal for requested depth/stencil.
reset();sw.execute({opcode:O.CLEAR,payload:Clear.create({color:[0,1,0,1],flags:1,depthAttachment:null},4,4)});
assert.deepStrictEqual(pixel(1024,0,0),[0,255,0,255]);
assert.strictEqual(new Float32Array(memory,2048,1)[0],.75);
for(const p of [{...desc,flags:8},{...desc,depthAttachment:null},
  {...desc,origin:'bottom-left'},{...desc,rects:[[-1,0,3,4]]},
  {...desc,width:3},{...desc,depth:1.01},{...desc,flags:4},
  Object.fromEntries(Object.entries(desc).filter(([k])=>k!=='depthAttachment')),
  {...desc,depthAttachment:{...depth,id:0}},{...desc,kind:'unknown'}])
  assert.match(String(sw.execute({opcode:O.CLEAR,payload:p}).value.error),/clear:/);
reset();sw.clear([1,1,1,1],0);assert.deepStrictEqual(pixel(1024,1,2),[11,22,33,44]);
sw.clear([1,1,1,1],3,1,[]);assert.deepStrictEqual(pixel(1024,1,2),[11,22,33,44]);
sw.clear([1,1,1,1],3,1,[[1,1,1,3]]);assert.deepStrictEqual(pixel(1024,1,2),[11,22,33,44]);
assert.throws(()=>sw.clear([1,1,1,1],1,1,[[-1,0,3,4]]),/rectangle/);
assert.strictEqual(new Float32Array(memory,2048,1)[0],.75);
// Existing positional ABI and raw16/65535 values are not reciprocal encoded.
sw.clear([0,0,0,0],2,32768/65535);assert.strictEqual(new Float32Array(memory,2048,1)[0],Math.fround(32768/65535));
const stencilDepth={id:12,width:4,height:4,format:75};
sw.depthSurfaces.set(12,{...stencilDepth,wa:16384,pitch:16,stencil:16448});
sw.clear([0,0,0,0],4,1,[[1,1,3,3]],stencilDepth,0x1234);
assert.strictEqual(new Uint8Array(memory)[16448+5],0x34);
assert.strictEqual(new Uint8Array(memory)[16448],0);
assert.throws(()=>sw.clear([0,0,0,0],4,1,null,null,1),/stencil/);

function gpu(){
  const events=[],d=Object.create(GPU.prototype),gl={SCISSOR_TEST:1,COLOR_BUFFER_BIT:2,DEPTH_BUFFER_BIT:4,STENCIL_BUFFER_BIT:8,
    clearDepth:z=>events.push(['depth',z]),clearStencil:s=>events.push(['stencil',s]),
    colorMask:(...a)=>events.push(['mask',...a]),isContextLost:()=>false};
  d.gpu={gl,canvas:{width:4,height:4},renderHeight:4,
    bindColorResource:(...a)=>events.push(['bindColor',...a]),bindRenderTarget:(...a)=>events.push(['bindDefault',...a]),
    setDepthMask:v=>events.push(['depthMask',v]),setStencilMask:v=>events.push(['stencilMask',v]),
    setCapability:(...a)=>events.push(['capability',...a]),setScissor:(...a)=>events.push(['scissor',...a]),
    clear:(...a)=>events.push(['clear',...a])};
  d.colorTargets=new Map([[7,{...desc.colorAttachment,revision:1}],[8,{...other,revision:1}]]);d.depthTargets=new Map();
  return {d,events};
}
const {d:gd,events}=gpu();gd.clearCommand(desc);
assert.deepStrictEqual(events,[['bindColor',7,{key:11,width:4,height:4,bits:16}],['depthMask',true],
  ['mask',true,false,true,false],['capability',1,true],['scissor',0,0,3,3],
  ['clear',[1,.5,.25,.75],6,.25,undefined]]);
assert.strictEqual(gd.colorTargets.get(7).revision,2);
events.length=0;gd.clear([1,0,0,1],1,1,[[1,0,3,1]],null);
assert.deepStrictEqual(events.at(-2),['scissor',1,3,2,1]);
assert.deepStrictEqual(events.at(-1),['clear',[1,0,0,1],2,1,undefined]);

// Authentic host memory-descriptor producer -> CommandQueue -> software and
// host GPU consumers. No guest/native API execution is implied by this fixture.
const guest=new ArrayBuffer(131072),v=new DataView(guest),put=(p,n)=>v.setUint32(p,n,true);
const address=256,program=1024,state=32768,dep=40000,rect=42000;
put(address,1);put(address+4,program);put(address+12,4);put(address+16,4);put(address+40,state);
put(address+44,3);put(address+48,0x80402010);v.setFloat32(address+52,.5,true);
put(address+56,1);put(address+60,rect);[-3,-2,5,5].forEach((n,i)=>v.setInt32(rect+i*4,n,true));
put(program+21752,dep);put(program+21728,1);put(program+21732,1);put(program+21736,3);put(program+21740,2);
put(state+256+174*4,1);put(program+22016,1);[0,0,3,4].forEach((n,i)=>put(program+22000+i*4,n));
put(dep+8,1);put(dep+12,0xd3d90005);put(dep+20,4);put(dep+24,4);put(dep+28,80);put(dep+36,11);
const bridge=new Bridge({backend:'software',getMemory:()=>guest,guestToWasm:p=>p});
const entry={kind:'software',device:sw},published=[];
entry.queue=new Stream.CommandQueue({deviceId:1,consumer:{execute(c){published.push(c);return bridge._execute(entry,c);}}});
bridge.devices.set(1,entry);reset();assert.strictEqual(bridge.call(0x30003,address,0),1,String(bridge.lastError));
const p=published[0].payload;assert.strictEqual(p.kind,Clear.KIND);assert.deepStrictEqual(p.rects,[[1,1,3,3]]);
assert(Object.isFrozen(p)&&Object.isFrozen(p.depthAttachment));
assert.deepStrictEqual(pixel(1024,1,1),[16,32,64,128]);assert.deepStrictEqual(pixel(1024,0,1),[11,22,33,44]);
put(rect,3);put(dep+36,18);assert.strictEqual(p.depthAttachment.id,11);assert.deepStrictEqual(p.rects,[[1,1,3,3]]);
// Same immutable payload passes the synchronous host GPU and worker routes.
const g2=gpu();bridge._execute({device:g2.d,kind:'webgl'},{opcode:O.CLEAR,payload:p});
assert.deepStrictEqual(g2.events.at(-2),['scissor',1,1,2,2]);
class WorkerDevice{constructor(){const x=gpu();Object.assign(this,x.d);this.events=x.events;}clearCommand(p){return GPU.prototype.clearCommand.call(this,p);}}
Object.setPrototypeOf(WorkerDevice.prototype,GPU.prototype);
const endpoint=Worker.create({backend:'webgl',options:{GPUDevice:WorkerDevice,createCanvas:()=>({})}});
endpoint.execute({deviceId:1,generation:1,opcode:O.RESOURCE_CREATE,payload:{kind:'device',backend:'webgl',width:4,height:4}});
assert.deepStrictEqual(endpoint.execute({deviceId:1,generation:1,opcode:O.CLEAR,payload:p}),{value:1,complete:true});
assert.throws(()=>endpoint.execute({deviceId:1,generation:1,opcode:O.CLEAR,payload:{...p,flags:9}}),/flags/);
// Scissor and viewport may have a legal empty intersection.
put(dep+36,11);put(program+22000,0);put(program+22004,0);put(program+22008,1);put(program+22012,1);
assert.strictEqual(bridge.call(0x30003,address,0),1);assert.deepStrictEqual(published.at(-1).payload.rects,[]);
// Named color target identity, D3D9's all-channel Clear despite draw masks,
// and absent-depth legality also pass through the real memory producer.
const col=44000;
put(program+22020,col);put(program+21752,0);put(address+44,1);put(address+56,0);put(address+60,0);
put(program+21736,0);put(state+256+174*4,0);put(state+256+168*4,0);
put(col+8,1);put(col+12,0xd3d90006);put(col+20,4);put(col+24,4);put(col+28,21);put(col+36,7);
entry.colors=new Set([7]);reset();assert.strictEqual(bridge.call(0x30003,address,0),1);
const named=published.at(-1).payload;
assert.strictEqual(named.colorAttachment.id,7);assert.strictEqual(named.depthAttachment,null);
assert.strictEqual(named.colorMask,15);assert.deepStrictEqual(pixel(4096,0,0),[16,32,64,128]);
const publishedCount=published.length;put(address+44,2);
assert.strictEqual(bridge.call(0x30003,address,0),-1);assert.match(String(bridge.lastError),/depth attachment/);
assert.strictEqual(published.length,publishedCount,'invalid absent-depth clear never enters the queue');
assert.strictEqual(require('../tools/test-tiers').classifyTest('test-d3d9-clear-contract.js'),'unit');
(async()=>{
  reset();let release;const gate=new Promise(resolve=>{release=resolve;});
  const q=new Stream.CommandQueue({deviceId:2,consumer:{execute(c){
    if(c.opcode===O.DRAW)return {value:1,completion:gate};
    return sw.execute(c);
  }}});
  q.submit(O.DRAW,{});
  const mutable=structuredClone(desc),r=q.submit(O.CLEAR,mutable);
  mutable.color.fill(0);mutable.rects[0].fill(0);mutable.colorAttachment.id=8;mutable.depthAttachment.id=18;
  release();await r.completion;
  assert.deepStrictEqual(pixel(4096,1,2),[64,22,255,44],'queued owner mutation cannot alter clear');
  assert.strictEqual(new Float32Array(memory,12288+36,1)[0],quantized);
  console.log('PASS D3D9 clear: native excerpt pixels/depth/stencil, immutable host/queue snapshots, GPU command mocks, seven semantic rejecting controls');
  console.log(JSON.stringify(receipt));
})().catch(error=>{console.error(error);process.exitCode=1;});
