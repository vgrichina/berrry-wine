#!/usr/bin/env node
'use strict';
const assert=require('assert'),path=require('path'),puppeteer=require('puppeteer');
(async()=>{
 const browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-first-run','--no-default-browser-check']});
 try{
  const page=await browser.newPage();
  for(const f of ['gpu-backend.js','d3d9-shader.js','render-clear.js','d3d9-backend.js'])await page.addScriptTag({path:path.join(__dirname,'../lib',f)});
  for(const version of [1,2]){
  const result=await page.evaluate(version=>{
   const canvas=document.createElement('canvas');canvas.width=canvas.height=4;
   const d=new D3D9Backend.Device(canvas,{webglVersion:version}),g=d.gpu,gl=g.gl;
   const a={id:1,width:4,height:4,format:75},b={id:2,width:8,height:7,format:75};
   const vs=new Uint32Array([0xfffe0101,1,0xc00f0000,0x90e40000,0xffff]),ps=new Uint32Array([0xffff0101,1,0x800f0000,0xa0e40000,0xffff]);
   const draw=(state={},attachment=a,reverse=false)=>d.draw({vertexShader:vs,pixelShader:ps,primitive:4,primitiveCount:1,stride:16,
    vertices:new Uint8Array(new Float32Array(reverse?[-1,-1,.5,1,-1,3,.5,1,3,-1,.5,1]:[-1,-1,.5,1,3,-1,.5,1,-1,3,.5,1]).buffer),
    attributes:[{register:0,type:3,offset:0}],pixelConstants:new Float32Array([1,0,0,1]),depthAttachment:attachment,
    state:{cull:1,zenable:false,stencilEnable:true,...state}});
   const clear=(value,attachment=a,rects=null)=>d.clear([0,0,0,1],7,1,rects,attachment,value);
   const check=(value,attachment=a,x=1,y=1)=>{
    d.clear([0,0,0,1],1,1,null,attachment);
    draw({stencilFunc:3,stencilRef:value,stencilWriteMask:0},attachment);
    return g.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4))[0]===255;
   };
   const cases=[],observations=[];
   const observe=(label,passed,actual)=>{observations.push({label,passed,actual});cases.push(passed);};
   observe('requested WebGL version',g.version===version,g.version);
   const rgba=()=>Array.from(g.readPixels(1,1,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4)));
   // MOV oPos,v0; MOV oD0,c0; MOV oT0,c1. Both color and UV linkage are real.
   const colorVS=new Uint32Array([0xfffe0101,1,0xc00f0000,0x90e40000,
    1,0xd00f0000,0xa0e40000,1,0xe00f0000,0xa0e40001,0xffff]);
   const colorConstants=alpha=>new Float32Array([64/255,128/255,192/255,alpha,.5,.5,0,1]);
   // Position-only VS + fixed pixel stage: its unused diffuse alpha must not
   // prevent a colorless stencil-volume pass from linking (Invisible War).
   const volume=(extra={},fixedExtra={},drawExtra={})=>d.draw({vertexShader:vs,pixelShader:null,
    primitive:4,primitiveCount:1,stride:16,
    vertices:new Uint8Array(new Float32Array([-1,-1,.5,1,3,-1,.5,1,-1,3,.5,1]).buffer),
    attributes:[{register:0,type:3,offset:0}],depthAttachment:a,
    fixedFunction:{lighting:false,fog:false,specular:false,textureFactor:0xff7f7f7f,
      stages:[{colorOp:2,colorArg1:3,colorArg2:0,alphaOp:1,texCoordIndex:0,transformFlags:0},{colorOp:1}],...fixedExtra},
    state:{cull:1,zenable:true,zwrite:false,zfunc:1,colorWriteMask:0,
      stencilEnable:true,stencilFunc:8,stencilZFail:4,...extra},...drawExtra});
   clear(9);volume();
   cases.push(g.readPixels(1,1,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4))[0]===0);
   cases.push(check(10)); // depth failure increments stencil, color stays clear
   clear(9);volume({zfunc:8,stencilPass:3,stencilRef:42});cases.push(check(42));
   clear(9);volume({stencilFunc:1,stencilFail:2});cases.push(check(0));
   let missingColorRejected=false;
   try{volume({colorWriteMask:15});}catch(e){missingColorRejected=/d3d_color0/.test(e.message);}
   cases.push(missingColorRejected); // no default color invented for visible draws
   for(const fixedExtra of [{alphaTest:true,alphaFunc:5,alphaRef:128}]){
    let rejected=false;
    try{volume({},fixedExtra);}catch(e){rejected=/d3d_color0/.test(e.message);}
    cases.push(rejected); // possible discard must retain its original fragment stage
   }
   clear(0);volume({colorWriteMask:7,zenable:false,stencilEnable:false});
   const rgb=g.readPixels(1,1,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));
   cases.push(rgb[0]===127&&rgb[1]===127&&rgb[2]===127&&rgb[3]===255);
   d.clear([.25,.25,.25,1],7,1,null,a,0);
   volume({colorWriteMask:7,zenable:false,stencilEnable:false,blend:true,srcblend:9,dstblend:3});
   const blended=g.readPixels(1,1,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));
   cases.push(blended[0]>=62&&blended[0]<=66&&blended[3]===255);
   for(const factor of [5,6,11])for(const slot of ['srcblend','dstblend']){
    let rejected=false;
    try{volume({colorWriteMask:7,blend:true,[slot]:factor});}
    catch(e){rejected=/d3d_color0/.test(e.message);}
    observe(`live diffuse alpha ${slot}=${factor}`,rejected);
   }
   for(const arg of [0,1]){
    let rejected=false;
    try{volume({colorWriteMask:7},{stages:[{colorOp:2,colorArg1:arg,colorArg2:0,
      alphaOp:1,texCoordIndex:0,transformFlags:0},{colorOp:1}]});}
    catch(e){rejected=/d3d_color0/.test(e.message);}
    cases.push(rejected); // diffuse/current RGB is observable even if alpha is masked
   }
   clear(9);
   volume({zenable:false,stencilPass:3,stencilRef:42},{colorKey:true,
    stages:[{colorOp:2,colorArg1:2,colorArg2:0,alphaOp:2,alphaArg1:2,alphaArg2:0,
      texCoordIndex:0,transformFlags:0},{colorOp:1}]},{
    vertexShader:new Uint32Array([0xfffe0101,1,0xc00f0000,0x90e40000,
      1,0xe00f0000,0xa0e40000,1,0xd00f0000,0xa0e40000,0xffff]),vertexConstants:new Float32Array([0,0,0,0]),
    textures:[{width:1,height:1,pixels:new Uint8Array([255,255,255,0])}]});
   cases.push(check(9)); // keyed fragments must not update stencil even with mask=0
   // All three terminate before their nominal RGB op because ARG1 is an
   // unbound TEXTURE. The old 1d5243e rewrite incorrectly made these black.
   for(const colorOp of [2,3,4]){
    const fixed={stages:[{colorOp,colorArg1:2,colorArg2:3,alphaOp:1,
      texCoordIndex:0,transformFlags:0},{colorOp:1}]};
    clear(0);
    volume({colorWriteMask:7,zenable:false,stencilEnable:false},fixed,
      {vertexShader:colorVS,vertexConstants:colorConstants(.75),textures:[]});
    const pixel=rgba();
    observe(`missing texture op=${colorOp} retains diffuse RGB`,
      pixel.every((value,i)=>Math.abs(value-[64,128,192,255][i])<=1),pixel);
    let rejected=false;
    try{volume({colorWriteMask:7,zenable:false,stencilEnable:false},fixed,{textures:[]});}
    catch(e){rejected=/d3d_color0/.test(e.message);}
    observe(`missing texture op=${colorOp} requires live color linkage`,rejected);
   }
   // Discard must suppress all three stencil paths and depth writes. Each
   // discarded case has an otherwise identical passing control, so a no-op
   // draw or a permanently discarded shader cannot satisfy this matrix.
   for(const kind of ['alpha','key'])for(const survives of [false,true])
   for(const [route,routeState,expectedStencil]of [
    ['fail',{stencilFunc:1,stencilFail:2,zfunc:8},0],
    ['zfail',{stencilFunc:8,stencilZFail:4,zfunc:1},10],
    ['pass',{stencilFunc:8,stencilPass:3,stencilRef:42,zfunc:8},42]]){
    clear(9);
    const fixed=kind==='alpha'?{alphaTest:true,alphaFunc:5,alphaRef:128}:
      {colorKey:true,stages:[{colorOp:2,colorArg1:2,colorArg2:3,alphaOp:1,
        texCoordIndex:0,transformFlags:0},{colorOp:1}]};
    volume({colorWriteMask:0,zwrite:true,...routeState},fixed,
      {vertexShader:colorVS,vertexConstants:colorConstants(survives?.75:.25),
       textures:kind==='key'?[{width:1,height:1,pixels:new Uint8Array([255,255,255,survives?255:0])}]:[]});
    observe(`${kind} survives=${survives} stencil ${route}`,check(survives?expectedStencil:9));
    // Probe at the exact same .5 depth: LESS passes only if the prior draw
    // retained clear depth 1. Color clear preserves the depth/stencil buffer.
    d.clear([0,0,0,1],1,1,null,a);
    draw({stencilEnable:false,zenable:true,zwrite:false,zfunc:2});
    const pixel=rgba(),depthWritten=survives&&route==='pass';
    observe(`${kind} survives=${survives} depth ${route}`,pixel[0]===(depthWritten?0:255),pixel);
   }
   for(const [func,expected]of [[1,false],[2,true],[3,false],[4,true],[5,false],[6,true],[7,false],[8,true]]){
    clear(8);draw({stencilFunc:func,stencilRef:7});
    cases.push((g.readPixels(1,1,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4))[0]===255)===expected);
   }
   for(const [op,seed,expected]of [[1,9,9],[2,9,0],[3,9,37],[4,255,255],[5,0,0],[6,15,240],[7,255,0],[8,0,255]]){
    clear(seed);draw({stencilPass:op,stencilRef:37});cases.push(check(expected));
   }
   clear(9);draw({stencilFunc:1,stencilFail:3,stencilRef:42});cases.push(check(42));
   clear(9);draw({zenable:true,zfunc:1,stencilZFail:3,stencilRef:43});cases.push(check(43));
   clear(0xaa);draw({stencilPass:3,stencilRef:0x55,stencilWriteMask:15});cases.push(check(0xa5));
   clear(0xab);draw({stencilFunc:3,stencilRef:0x1b,stencilMask:15,stencilPass:2});cases.push(check(0));
   clear(0);draw({twoSidedStencil:true,stencilPass:3,ccwStencilPass:7,stencilRef:7});cases.push(check(1));
   clear(0);draw({twoSidedStencil:true,stencilPass:3,ccwStencilPass:7,stencilRef:7},a,true);cases.push(check(7));
   clear(12,a);clear(34,b);cases.push(check(12,a));cases.push(check(34,b));
   clear(255,a,[[0,0,2,2]]);cases.push(check(255,a,0,3));cases.push(check(12,a,3,0));
   clear(66);draw({stencilWriteMask:0});clear(77);cases.push(check(77));
   d.present();cases.push(check(77));
   d.releaseDepth(1);cases.push(check(0));
   const errors=[];
   for(const depth of [null,{id:3,width:4,height:4,format:77},{id:4,width:4,height:4,format:80}]){
    try{draw({},depth);errors.push(false);}catch(e){errors.push(true);}
    try{clear(1,depth);errors.push(false);}catch(e){errors.push(true);}
   }
   const error=g.getError();d.destroy();return {version,cases,observations,errors,error};
  },version);
  assert(result.cases.every(Boolean),JSON.stringify(result));assert(result.errors.every(Boolean));assert.strictEqual(result.error,0);
  console.log(JSON.stringify(result));
  }
  console.log('PASS GPU D24S8 stencil: 8 operations, fail/zfail/pass, masks, two-sided winding, oversized identity, rectangular Clear and release');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
