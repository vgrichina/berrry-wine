'use strict';
// Focused native compilation, never bootRenderHarness/full application compile.
// An 8 MiB arena replaces only the guest allocator/address map. Production IR,
// SIMD VM, fixed compiler and raster functions are compiled without rewriting.
// The arena deliberately does not model heap reuse or qualify resource lifetime.
const assert=require('assert'),fs=require('fs'),path=require('path');
const {compile}=require('../tools/watx');
const IR=require('../lib/d3d-shader-ir'),Shader=require('../lib/d3d9-shader');
const {Device:Software}=require('../lib/d3d9-software-backend');
const allocator=`(memory 128 128)(export "memory" (memory 0))
 (global $cursor (mut i32) (i32.const 65536))
 (func $heap_alloc (export "guest_alloc") (param $n i32) (result i32)
  (local $p i32)(local.set $p (global.get $cursor))
  (global.set $cursor (i32.and (i32.add (i32.add (local.get $p) (local.get $n)) (i32.const 15)) (i32.const -16)))
  (if (i32.gt_u (global.get $cursor) (i32.const 8388608)) (then (unreachable))) (local.get $p))
 (func $heap_free (export "guest_free") (param $p i32))
 (func $heap_shrink (param $p i32)(param $n i32)(result i32)(i32.const 1))
 (func $g2w (export "guest_to_wasm") (param $p i32)(result i32)(local.get $p))
 (func $w2g (param $p i32)(result i32)(local.get $p))`;
async function boot(){
 const source=allocator+['09af-d3d-shader-ir.wat','09af1-d3d-shader-canon.wat','09ag-d3d-shader-vm.wat',
  '09ah-d3d-software.wat','09aj-d3d-fixed.wat'].map(p=>fs.readFileSync(path.join(__dirname,'../src',p),'utf8')).join('\n');
 const r=compile(source,new Map(),{simd:true});
 assert(r.success,r.error);assert(WebAssembly.validate(r.wasmBinary));
 console.log('fragment module',r.wasmBinary.length,'bytes sha256',require('crypto').createHash('sha256').update(r.wasmBinary).digest('hex'),'memory=8388608');
 const {instance}=await WebAssembly.instantiate(r.wasmBinary),e=instance.exports;
 return {e:{...e,guest_map_alloc:e.guest_alloc,guest_map_free:()=>1,d3d_render_coalesce_heap:()=>0},memory:e.memory};
}
function snapshot(color=[1,.5,.25,.5],z=.5,rhw=1){
 const vertices=Float32Array.from([[0,0],[4,0],[0,4]].flatMap(([x,y])=>[x,y,z,rhw,...color,.25,.25,0,1]));
 return {primitive:4,primitiveCount:1,stride:48,vertices:new Uint8Array(vertices.buffer),
  attributes:[[0,9,3,0],[5,10,3,16],[7,5,3,32]].map(([register,usage,type,offset])=>({register,usage,usageIndex:0,type,offset})),
  viewport:{x:0,y:0,width:4,height:4,minZ:0,maxZ:1},
  textures:[{width:1,height:1,pixels:Uint8Array.from([128,64,255,128]),sampler:{addressU:3,addressV:3,min:1,mag:1,mip:0}}],
  state:{zenable:true,zwrite:true,zfunc:2,blend:false,cull:1,fillMode:3,colorWriteMask:15},
  fixedFunction:{lighting:false,fog:false,specular:false,alphaTest:false,colorKey:false,textureFactor:0xff123456,
   stages:[{colorOp:4,colorArg1:2,colorArg2:0,alphaOp:4,alphaArg1:2,alphaArg2:0,
    constant:0xffabcdef,transformFlags:0,texCoordIndex:0,resultArg:1},{colorOp:1}]}};
}
function native(draw,e,memory){return IR.fixedPositionT(()=>e,()=>memory.buffer,draw);}
function pixel(d,x=1,y=1){const p=d.present().pixels;return Array.from(p.slice((y*4+x)*4,(y*4+x)*4+4));}
function near(actual,expected,label){assert(actual.every((v,i)=>Math.abs(v-expected[i])<=1),`${label}: ${actual} != ${expected}`);}
module.exports={boot};
if(require.main===module)(async()=>{
 const {e,memory}=await boot();
 let frees=0,descriptors=0;
 const producer={...e,guest_free(p){frees++;e.guest_free(p);},d3d_fixed_compile_positiont(p){descriptors++;return e.d3d_fixed_compile_positiont(p);}};
 const s=snapshot(),n=native(s,producer,memory);assert(n);assert.strictEqual(frees,1);
 assert.strictEqual(n.constants,'embedded-def');
 const def=(ir,index)=>{
  const row=ir.instructions.find(i=>i.opcode===81&&(i.args[0]&2047)===index);
  assert(row);return Array.from(new Float32Array(Uint32Array.from(row.args.slice(1)).buffer));
 };
 assert.deepStrictEqual(def(n.vertex,0),[.5,-.5,1,0],'independent viewport scale DEF binding');
 const original=n.vertex.nativeBytes.slice();
 // Differential against the existing native compiler, not a second emitter.
 const desc=e.guest_alloc(288),w=new Uint32Array(memory.buffer,desc,72),f=new Float32Array(memory.buffer,desc,72);
 w.fill(0);w.set([0x44465831,1,15,0,5,7,4,2,0,4,2,0,0xff123456,0xffabcdef,1,0,0,0,0,4,4]);f[22]=1;
 const bundle=e.d3d_fixed_compile(desc),reference=IR.readFixedBundle(memory.buffer,bundle);
 assert.deepStrictEqual(n.vertex.nativeBytes,reference.vertex.nativeBytes);
 assert.deepStrictEqual(n.pixel.nativeBytes,reference.pixel.nativeBytes);
 w.fill(0);e.d3d_fixed_free(bundle);assert.deepStrictEqual(n.vertex.nativeBytes,original,'copied IR survives producer storage reuse');
 assert.throws(()=>Shader.compileNativeIR(n.vertex),/guest profile/,'fixed origin must not enter guest path');
 assert.throws(()=>Shader.compileNativeFixedIR({...n.vertex,nativeBytes:reference.vertex.nativeBytes.map((b,i)=>i===28?0:b)}),/origin/);
 // Pixel IR reaches GLSL only as core IR (09af1, since bd12cd470): the raw
 // ps1.x-shaped fixed pixel IR is rejected, its WAT canonical form compiles.
 assert.throws(()=>Shader.compileNativeFixedIR(n.pixel),/invalid D3D shader IR|core IR/,'raw fixed pixel IR must be canonicalized');
 const corePixel=IR.canonicalBytes(e,()=>memory.buffer,n.pixel.nativeBytes);assert.strictEqual(corePixel.flags,12);
 const vs=Shader.compileNativeFixedIR(n.vertex),ps=Shader.compileNativeFixedIR(corePixel);
 assert(vs.source.includes('gl_Position'));assert(ps.source.includes('texture2D'));
 assert.deepStrictEqual(vs.uniforms,[],'viewport constants are native DEF, not JS uniform bindings');
 assert(!ps.uniforms.some(u=>/d3d_ps_c/.test(u)),'fixed constants never bind guest banks');
 // Unsupported admission must not allocate or silently migrate mixed stages.
 const rejects=[d=>d.fixedFunction.stages[0].colorOp=2,d=>d.fixedFunction.fog=true,
  d=>d.fixedFunction.lighting=true,d=>d.fixedFunction.stages[1].colorOp=4,
  d=>d.fixedFunction.stages[0].transformFlags=2,d=>d.textures[0].faces=[],
  d=>d.pixelShader={},d=>d.attributes[0].usage=0,d=>d.state.fillMode=2,
  d=>d.fixedFunction.stages[0].alphaArg2=1,d=>d.attributes[2].register=0];
 for(const edit of rejects){const d=snapshot();edit(d);assert.strictEqual(native(d,producer,memory),null);}
 assert.strictEqual(descriptors,1,'unsupported profiles do not invoke native producer');
 assert.strictEqual(native(s,{...e,d3d_fixed_compile_positiont:undefined},memory),null,'older native artifacts preserve existing fallback');
 // Native admission is also authoritative if a descriptor is supplied directly.
 w.set([0x44465831,1,15,0,5,7,4,2,0,4,2,0,0,0,1,0,0,0,0,4,4]);f[22]=1;
 for(const slot of [2,6,7,8,9,10,11,14,15,16]){const old=w[slot];w[slot]=999;assert.strictEqual(e.d3d_fixed_compile_positiont(desc),0);w[slot]=old;}
 for(const [min,max] of [[.2,.8],[.5,.5],[0,.8],[.2,1]]){
  f[21]=min;f[22]=max;assert.strictEqual(e.d3d_fixed_compile_positiont(desc),0,'native nonidentity depth rejects');
 }
 f[21]=0;f[22]=1;
 const d=new Software({getExports:()=>e,getMemory:()=>memory.buffer,width:4,height:4,fixedCacheBytes:0,maxBytes:2*1024*1024});
 const fallbackPrograms=d.fixedPrograms;
 d.fixedPrograms=()=>{throw Error('duplicate software fixed interpretation');};
 const draw=(input)=>{input.nativeFixed=native(input,e,memory);return d.draw(input);};
 s.vertexConstants=new Float32Array(1024).fill(NaN);s.pixelConstants=new Float32Array(32).fill(NaN);
 d.clear([0,0,0,1],3,1);draw(s);
 near(pixel(d),[64,32,128,64],'independent texture * diffuse RGBA expected BGRA');
 // Rejecting semantic control: changing MUL to ADD must fail that same oracle.
 const corrupted={...n,pixel:{...n.pixel,nativeBytes:n.pixel.nativeBytes.slice()}};
 const cv=new DataView(corrupted.pixel.nativeBytes.buffer);
 let changed=false;
 for(let i=0;i<cv.getUint32(16,true);i++){const at=32+i*128;if(cv.getUint32(at,true)===5){cv.setUint32(at,2,true);changed=true;break;}}
 assert(changed);d.clear([0,0,0,1],3,1);d.draw({...s,nativeFixed:corrupted});
 assert.throws(()=>near(pixel(d),[64,32,128,64],'reject ADD/MUL semantic mismatch'),assert.AssertionError);
 // Depth/order: near red writes, far green is rejected; then disable depth and
 // alpha blend blue over red. State remains outside shader IR, in the queue.
 d.clear([0,0,0,1],3,1);
 const solid=(rgba,z)=>{const a=snapshot(rgba,z);a.textures[0].pixels.fill(255);return a;};
 draw(solid([1,0,0,1],.25));draw(solid([0,1,0,1],.75));near(pixel(d),[0,0,255,255],'depth preserves earlier near draw');
 const alpha=solid([0,0,1,.5],.75);Object.assign(alpha.state,{zenable:false,blend:true,srcblend:5,dstblend:6,blendop:1});
 draw(alpha);near(pixel(d),[128,0,128,191],'ordinary blend in submission order');
 // Perspective/viewport DEF rebind and immutability; a compile after moving
 // viewport must alter native constants, leaving the first packet unchanged.
 const moved=snapshot();moved.viewport={x:1,y:1,width:2,height:2,minZ:0,maxZ:1};
 const movedVertices=new Float32Array(moved.vertices.buffer);
 for(const [i,x,y] of [[0,1,1],[12,3,1],[24,1,3]]){movedVertices[i]=x;movedVertices[i+1]=y;}
 const next=native(moved,e,memory);assert.notDeepStrictEqual(next.vertex.nativeBytes,n.vertex.nativeBytes);
 assert.deepStrictEqual(n.vertex.nativeBytes,original);
 // Unequal RHW must affect interpolation. Independent barycentric weights at
 // (1,1) in a 4x4 right triangle are (.5,.25,.25); multiply by RHW (1,.5,.25).
 const perspective=solid([1,0,0,1],.5),vf=new Float32Array(perspective.vertices.buffer);
 vf.set([0,1,0,1],16);vf.set([0,0,1,1],28);vf[15]=.5;vf[27]=.25;
 d.clear([0,0,0,1],3,1);draw(perspective);
 near(pixel(d),[255/11,255*2/11,255*8/11,255],'RHW perspective is shared native arithmetic');
 // Compare all native pixels to the preserved software fallback as well as
 // the independent oracles above. Viewport offsets/depth range and FLOAT2 UV
 // exercise descriptor bindings rather than a second JS shader interpreter.
 const legacy=new Software({getExports:()=>e,getMemory:()=>memory.buffer,width:4,height:4,fixedCacheBytes:0,maxBytes:2*1024*1024});
 const compare=[snapshot(),perspective,moved,snapshot()];
 compare[3].attributes[2].type=1;
 for(const input of compare){
  d.clear([0,0,0,1],3,1);legacy.clear([0,0,0,1],3,1);
  draw(input);const fallback={...input};delete fallback.nativeFixed;legacy.draw(fallback);
  assert.deepStrictEqual(d.present().pixels,legacy.present().pixels,'shared clip IR matches native screen-space fallback pixels');
 }
 // Independent review regressions: ordinary producer -> software draw must
 // preserve all pixels AND the explicit depth decision. Nonidentity viewport
 // depth takes the old screen-space fallback; default remains shared native IR.
 const depthCases=[[.5,0,1,1,true],[.1,.2,.8,1,true],[.9,.2,.8,1,true],
  [.25,.5,.5,.4,true],[.75,.5,.5,.6,false]];
 d.fixedPrograms=fallbackPrograms;
 let depthCompiles=0,depthAllocations=0;
 const depthProducer={...e,guest_alloc(n){depthAllocations++;return e.guest_alloc(n);},
  d3d_fixed_compile_positiont(p){depthCompiles++;return e.d3d_fixed_compile_positiont(p);}};
 for(const [z,minZ,maxZ,clearDepth,red] of depthCases){
  const input=solid([1,0,0,1],z);Object.assign(input.viewport,{minZ,maxZ});
  input.nativeFixed=native(input,depthProducer,memory);
  assert.strictEqual(!!input.nativeFixed,minZ===0&&maxZ===1,'honest shared admission/fallback');
  d.clear([0,0,0,1],3,clearDepth);legacy.clear([0,0,0,1],3,clearDepth);
  d.draw(input);const fallback={...input};delete fallback.nativeFixed;legacy.draw(fallback);
  const expected=red?[0,0,255,255]:[0,0,0,255];
  assert.deepStrictEqual(pixel(d),expected,'corrected independent POSITIONT depth oracle');
  assert.deepStrictEqual(pixel(legacy),expected,'established screen-depth oracle');
  assert.deepStrictEqual(d.present().pixels,legacy.present().pixels,'all depth-control pixels match');
 }
 assert.strictEqual(depthCompiles,1,'four regressions fall back before native allocation/compile');
 assert.strictEqual(depthAllocations,1);
 for(const z of [-.1,1.1,NaN])assert.strictEqual(native(solid([1,0,0,1],z),depthProducer,memory),null,'default viewport must not introduce depth clipping');
 assert.strictEqual(depthCompiles,1);
 assert.strictEqual(depthAllocations,1);
 legacy.destroy();
 d.destroy();
 console.log('PASS shared POSITIONT native IR: differential bytes/DEF, immutable snapshots, 11 existing fallback profiles, 10 existing + 4 depth native rejects, five corrected depth pixel controls, out-of-range depth fallback, native pixels/depth/blend and rejecting ADD control; production GPU recording only (no GPU pixels)');
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
