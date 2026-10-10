#!/usr/bin/env node
'use strict';
// Private-profile integration, not public PS1.4 capability acceptance.
const assert=require('assert'),path=require('path'),puppeteer=require('puppeteer');
const IR=require('../lib/d3d-shader-ir');
const {bootRenderHarness}=require('./render-helper');
(async()=>{
 const {exports:e,memory}=await bootRenderHarness({fonts:'none',extraWat:`
  (func (export "scan14") (param $p i32) (param $n i32) (param $o i32) (result i32)
    (call $d3d_ir_scan14 (local.get $p) (local.get $n) (local.get $o)))`});
 e.d3dim_worker_init(0x400000);
 const words=new Uint32Array(memory.buffer),floats=new Float32Array(memory.buffer),programs=[];
 const alloc=n=>e.guest_to_wasm(e.guest_alloc(n))>>>0;
 const d=(bank,index=0,mask=15,shift=0)=>(0x80000000|bank<<28|mask<<16|shift<<24|index)>>>0;
 const s=(bank,index=0,swizzle=228,modifier=0)=>(0x80000000|bank<<28|swizzle<<16|modifier<<24|index)>>>0;
 function shader(code,private14=false){
  const p=alloc(code.length*4);words.set(code,p/4);let ir;
  // ps_1_4 is public (D3D9-PUBLIC-PS14): the native compile runs scan14 and
  // writes the real header flags (coissue sets bit 1), so no hand-built IR.
  ir=e.d3d_shader_ir_compile(p,code.length)>>>0;
  assert(ir,`native compile${private14?' (ps_1_4)':''}: ${e.d3d_shader_ir_error()} at ${e.d3d_shader_ir_error_offset()}`);
  // Carry the serialized IR itself: production compileNativeIR lowers from
  // these bytes, never from the JS projection. A plain array survives the
  // page boundary; the page rebuilds the Uint8Array.
  const result={...IR.read(memory.buffer,ir),nativeBytes:Array.from(new Uint8Array(memory.buffer,ir,words[ir/4+6]))};
  const program=e.d3d_shader_vm_compile(ir);assert(program,'same IR compiles into SIMD threaded code');programs.push(program);
  e.d3d_shader_ir_free(ir);e.d3d_shader_ir_free(p);return result;
 }
 const vs=shader([0xfffe0101,1,d(4),s(1),1,d(5),s(1,1),1,d(6),s(1,2),1,d(6,5),s(1,3),65535]);
 const bodies=[
  [66,d(0,5),s(3,5),1,d(0),s(0,5)],
  [64,d(0,5,7),s(3,5),65533,66,d(0),s(0,5)],
  [64,d(0,5,7),s(3,5),89,d(0,5,3),s(0,5),s(0,5),65533,66,d(0),s(0,5)],
  [64,d(0,5,7),s(3,5),65,d(0,5),1,d(0),s(1)],
  [64,d(0,5,7),s(3,5),65533,87,d(0,5),1,d(0),s(1)],
  // CND is component-wise in 1.4, not an alpha-replicated predicate.
  [66,d(0,5),s(3,5),80,d(0),s(1),s(1),s(0,5)],
  // PHASE preserves RGB; explicitly initialize the lost alpha before reading it.
  [66,d(0,5),s(3,5),65533,1,d(0,5,8),s(1,0,255),1,d(0),s(0,5)],
  [66,d(0,5),s(3,5,244,10),1,d(0),s(0,5)],
  [64,d(0,5,7),s(3,5),65533,66,d(0),s(0,5,228,9)],
  // BEM permits normal source and instruction modifiers, despite its .rg mask.
  [64,d(0,5,7),s(3,5),89,d(0,5,3,15),s(0,5),s(0,5,228,1),65533,66,d(0),s(0,5)],
  ...Array.from({length:3},()=>[64,d(0,5,7),s(3,5),65533,87,d(0,5),1,d(0),s(1)]),
  // Coissue: one RGB + alpha pair (D3D9-PUBLIC-PS14; the VM used to refuse it).
  [81,d(2,0),0x3f800000,0,0,0,81,d(2,1),0,0,0,0x3f000000,1,d(0,0,7),s(2,0),0x40000001,d(0,0,8),s(2,1)],
 ];
 const shaders=bodies.map(body=>shader([0xffff0104,...body,65535],true));
 const coordinates=shaders.map((_,i)=>i===3?[-.75,.25,1,1]:i===4?[.25,.5,1,1]:i===7?[.375,.125,1,.5]:i===8?[.375,.125,.5,1]:i===9?[.375,.125,1,1]:i===10?[.25,0,1,1]:i===11?[-.25,.5,1,1]:i===12?[.75,.5,1,1]:[.75,.25,1,1]);
 const depthCases=shaders.map((_,i)=>i===4||(i>=10&&i<13));
 const expected=[[0,255,0,255],[0,255,0,255],[255,0,0,255],[0,0,0,255],[255,0,0,255],
  [255,255,0,255],[0,255,0,255],[0,255,0,255],[0,255,0,255],
  [255,0,0,255],[0,0,0,255],[255,0,0,255],[0,0,0,255],[255,0,0,128]];
 const input=alloc(384),color=alloc(256),depth=alloc(256),desc=alloc(128),texels=alloc(8),texture=alloc(36),bump=alloc(28);
 words.set([0xff0000ff,0xff00ff00],texels/4);
 words.set([texels,2,1,8,0,3,3,1,0],texture/4);words[bump/4]=1;floats.set([-1,0,0,0,0,0],bump/4+1);
 const nativePixels=[],nativeFrames=[];
 for(let i=0;i<shaders.length;i++){
  for(const [v,p]of[[-1,-1,.8,1],[3,-1,.8,1],[-1,3,.8,1]].entries()){
   const values=Array(32).fill(0);values.splice(0,16,...p,1,0,0,1,.1,.1,0,1,...coordinates[i]);
   floats.set(values,input/4+v*32);
  }
  words.fill(0xff000000,color/4,color/4+64);floats.fill(.6,depth/4,depth/4+64);words.fill(0,desc/4,desc/4+32);
  words.set([0x44535031,3,8,8,color,32,depth,32,input,3,128,0,3,programs[0],programs[i+1],0,0,0,0,0,0,8,8],desc/4);
  floats[desc/4+24]=1;words.set([depthCases[i]?3:0,2,15,1,0,6,0x76543],desc/4+25);
  const ctx=e.d3d_software_create(desc);assert(ctx,`native context ${i}`);
  try{
   assert.strictEqual(e.d3d_software_bind_texture(ctx,0,texture),1);
   assert.strictEqual(e.d3d_software_bind_texture(ctx,5,texture),1);
   assert.strictEqual(e.d3d_software_bind_bump(ctx,5,bump),1);
   if(depthCases[i])assert.strictEqual(e.d3d_software_bind_depth_format(ctx,80),1);
   let status=1,steps=0;while(status===1&&steps++<1000)status=e.d3d_software_step(ctx,1);
   assert.strictEqual(status,0,`bounded native completion ${i}`);
   const bgra=new Uint8Array(memory.buffer,color+(5*8+2)*4,4);
   nativePixels.push([bgra[2],bgra[1],bgra[0],bgra[3]]);
   const frame=Array.from(new Uint8Array(memory.buffer,color,256));
   for(let p=0;p<frame.length;p+=4)[frame[p],frame[p+2]]=[frame[p+2],frame[p]];
   nativeFrames.push(frame);
   assert.deepStrictEqual(frame,Array.from({length:64},()=>expected[i]).flat(),`native full coverage ${i}`);
  }finally{e.d3d_software_free(ctx);}
 }
 assert.deepStrictEqual(nativePixels,expected,'native SIMD raster oracle');
 for(const program of programs)e.d3d_shader_vm_free(program);
 for(const p of[input,color,depth,desc,texels,texture,bump])e.d3d_shader_ir_free(p);
 const browser=await puppeteer.launch({headless:true,
  executablePath:process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--no-first-run','--no-default-browser-check']});
 try{
  const page=await browser.newPage();
  for(const file of['d3d-shader-ir.js','gpu-backend.js','d3d9-shader.js','d3d9-fixed.js','d3d9-backend.js'])
   await page.addScriptTag({path:path.join(__dirname,'../lib',file)});
  const results=await page.evaluate(({vs,shaders,coordinates,depthCases})=>{
   const bytes=x=>({...x,nativeBytes:Uint8Array.from(x.nativeBytes)});vs=bytes(vs);shaders=shaders.map(bytes);
   const results=[];
   for(const version of[1,2]){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=8;
    const d=new D3D9Backend.Device(canvas,{webglVersion:version}),g=d.gpu,gl=g.gl;
    const image={width:2,height:1,pixels:new Uint8Array([255,0,0,255,0,255,0,255]),sampler:{addressU:3,addressV:3,min:1,mag:1}};
    const draw={vertexShader:vs,primitive:4,primitiveCount:1,stride:64,
     attributes:[0,1,2,3].map(register=>({register,type:3,offset:register*16})),
     textures:[image,null,null,null,null,image],bumpStates:[null,null,null,null,null,[-1,0,0,0,0,0]],
     state:{cull:1,zenable:false}};
    const pixels=[],frames=[];
    for(let i=0;i<shaders.length;i++){
     const uv=coordinates[i];
     const vertices=[[-1,-1,.8,1],[3,-1,.8,1],[-1,3,.8,1]].flatMap(p=>[...p,1,0,0,1,.1,.1,0,1,...uv]);
     draw.vertices=new Uint8Array(new Float32Array(vertices).buffer);draw.pixelShader=shaders[i];
     draw.state.zenable=depthCases[i];draw.state.zfunc=2;
     draw.depthAttachment=depthCases[i]?{id:1,width:8,height:8,format:80}:null;
     d.clear([0,0,0,1],depthCases[i]?3:1,.6,null,draw.depthAttachment);d.draw(draw);
     pixels.push(Array.from(g.readPixels(2,2,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4))));
     const bottomUp=g.readPixels(0,0,8,8,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(256)),frame=[];
     for(let y=7;y>=0;y--)frame.push(...bottomUp.subarray(y*32,(y+1)*32));
     frames.push(frame);
    }
    results.push({version,pixels,frames,error:g.getError()});d.destroy();
   }
   return results;
  },{vs,shaders,coordinates,depthCases});
  for(const r of results){
   assert.strictEqual(r.error,0);assert.deepStrictEqual(r.pixels,nativePixels,`WebGL${r.version} matches actual SIMD raster`);
   assert.deepStrictEqual(r.frames,nativeFrames,`WebGL${r.version} full framebuffer matches SIMD raster`);
  }
  console.log(`PASS public PS1.4 native IR -> software/WebGL1/WebGL2: ${shaders.length} differential frames including BEM modifiers, CND, phase, projection and depth boundaries`);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
