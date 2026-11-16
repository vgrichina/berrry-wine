'use strict';
// Exercise Device uploads with private VS2 lowering; public admission stays closed.
const assert=require('assert'),path=require('path'),puppeteer=require('puppeteer');
(async()=>{
 const browser=await puppeteer.launch({headless:true,
  executablePath:process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--no-first-run','--no-default-browser-check']});
 try{
  const page=await browser.newPage();
  for(const file of ['gpu-backend.js','d3d9-shader.js','render-clear.js','d3d9-backend.js'])
   await page.addScriptTag({path:path.join(__dirname,'../lib',file)});
  const results=await page.evaluate(()=>{
   const saved=D3D9Shader.compileNativeIR;
   // Test-only hook: no production token or native-IR gate is changed.
   D3D9Shader.compileNativeIR=ir=>D3D9Shader.compileIR(ir,{experimentalVS20:true});
   const results=[];
   try{for(const apiVersion of [1,2]){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=8;
    const device=new D3D9Backend.Device(canvas,{webglVersion:apiVersion}),g=device.gpu,gl=g.gl;
    const ir={irVersion:1,stage:'vertex',version:0xfffe0200,instructions:[
     [1,0xc00f0000,0x90e40000], // oPos=v0
     [1,0x800f0000,0xa0e40000], // r0=c0
     [40,0xe0e4080f], [38,0xf0e4000f],
     [2,0x80010000,0x80e40000,0xa0000001], // red += c1.x
     [39], [43], [1,0xd00f0000,0x80e40000],
    ].map(([opcode,...args],offset)=>({opcode,args,offset:offset+1}))};
    // ps1.x tokens lower only through WAT (09af1), absent from this page; the
    // pixel stage rides the same test hook as the projected ps_1_4 subset.
    const draw={vertexShader:ir,pixelShader:{irVersion:1,stage:'pixel',version:0xffff0104,
     instructions:[{opcode:1,args:[0x800f0000,0x90e40000],offset:1}]},
     primitive:4,primitiveCount:1,stride:16,
     vertices:new Uint8Array(new Float32Array([-1,-1,.25,1,3,-1,.25,1,-1,3,.25,1]).buffer),
     attributes:[{register:0,type:3,offset:0}],
     vertexConstants:new Float32Array([.125,.25,.5,1,.125,0,0,0]),
     state:{cull:1,zenable:false}};
    const ints=new Int32Array(64),bools=new Uint32Array(16);
    ints.set([3,-2147483648,2147483647,-1],60);bools[15]=0x80000000;
    const read=()=>Array.from(g.readPixels(4,4,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4)));
    const pixels=[];
    device.draw({...draw,vertexIntegerConstants:ints,vertexBooleanConstants:bools});pixels.push(read());
    ints[60]=1;
    device.draw({...draw,vertexIntegerConstants:ints,vertexBooleanConstants:bools});pixels.push(read());
    device.draw({...draw,vertexBooleanConstants:bools});pixels.push(read()); // missing i clears stale3/1
    device.draw({...draw,vertexIntegerConstants:ints});pixels.push(read()); // missing b clears true
    // Invalid banks, even unused PS banks, and dynamic REP domains must fail
    // before attachment binding or any other GPU method can have side effects.
    const invalids=[];
    for(const field of ['vertexIntegerConstants','pixelIntegerConstants','vertexBooleanConstants','pixelBooleanConstants']){
     const Type=field.includes('Integer')?Int32Array:Uint32Array,len=field.includes('Integer')?64:16;
     for(const value of [null,[],new Type(len-1),new Type(len+1),new Float32Array(len)])
      invalids.push({...draw,[field]:value});
    }
    for(const count of [-1,256]){const bank=ints.slice();bank[60]=count;invalids.push({...draw,vertexIntegerConstants:bank});}
    const loop={...ir,instructions:ir.instructions.map(ins=>ins.opcode===38
     ? {...ins,opcode:27,args:[0xf0e40800,0xf0e4000f]}
     : ins.opcode===39?{...ins,opcode:29}:ins)};
    const loopShader=D3D9Shader.compileIR(loop,{experimentalVS20:true});
    const loopRanges=loopShader.integerUniformRanges;
    for(const [component,value] of [[0,-1],[0,256],[1,-1],[1,256],[2,-129],[2,128],[3,-1],[3,1]]){
     const bank=new Int32Array(64);bank.set([1,0,1,0],60);bank[60+component]=value;
     invalids.push({...draw,vertexShader:loop,vertexIntegerConstants:bank});
    }
    let rejected=0,sideEffects=0;
    const originalGPU=device.gpu,originalBind=device.bindDepth;
    device.bindDepth=()=>{sideEffects++;throw Error('unexpected bindDepth');};
    device.gpu=new Proxy(g,{get(target,key){const value=target[key];return typeof value==='function'?()=>{sideEffects++;throw Error('unexpected GPU call');}:value;}});
    for(const bad of invalids){try{device.draw(bad);}catch(e){if(/typed constants|integer uniform range/.test(e.message))rejected++;else throw e;}}
    device.gpu=originalGPU;device.bindDepth=originalBind;
    // Legal endpoint domains, including unused start/stride for zero trips.
    for(const tuple of [[0,255,-128,0],[1,0,127,0],[255,255,-128,0]]){
     const bank=new Int32Array(64);bank.set(tuple,60);
     device.draw({...draw,vertexShader:loop,vertexIntegerConstants:bank});
    }
    // Late definitions override even an invalid API loop count; they produce
    // neither a uniform nor a range requirement for the shadowed register.
    const defined={...ir,instructions:[...ir.instructions,
     {opcode:48,offset:20,args:[0xf00f000f,2,0,0,0]},
     {opcode:47,offset:21,args:[0xe00f080f,1]}]};
    ints[60]=256;
    device.draw({...draw,vertexShader:defined,vertexIntegerConstants:ints});pixels.push(read());
    const error=g.getError();device.destroy();
    results.push({apiVersion,actualVersion:g.version,pixels,rejected,total:invalids.length,sideEffects,error,loopRanges});
   }}finally{D3D9Shader.compileNativeIR=saved;}
   return results;
  });
  for(const r of results){assert.strictEqual(r.actualVersion,r.apiVersion);assert.strictEqual(r.error,0);
   assert.strictEqual(r.rejected,r.total);assert.strictEqual(r.sideEffects,0);
   for(const [component,min,max] of [[0,0,255],[1,0,255],[2,-128,127],[3,0,0]])
    assert(r.loopRanges.some(range=>range.name==='d3d_vs_i15'&&range.component===component&&range.min===min&&range.max===max));
   for(const [i,red] of [128,64,32,32,96].entries())
    [red,64,128,255].forEach((value,lane)=>assert(Math.abs(r.pixels[i][lane]-value)<=1,JSON.stringify(r)));
  }
  console.log('PASS typed GPU banks, updates/defaults, DEF override, pre-side-effect rejection on WebGL1/2');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
