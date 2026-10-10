#!/usr/bin/env node
'use strict';
const assert=require('assert'),path=require('path'),puppeteer=require('puppeteer');
(async()=>{
 const browser=await puppeteer.launch({headless:true,
  executablePath:process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--no-first-run','--no-default-browser-check']});
 try{
  const page=await browser.newPage();
  for(const file of['gpu-backend.js','d3d9-shader.js','d3d9-fixed.js','d3d9-backend.js'])
   await page.addScriptTag({path:path.join(__dirname,'../lib',file)});
  const results=await page.evaluate(()=>{
   const results=[],identity=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
   for(const version of[1,2]){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=8;
    const device=new D3D9Backend.Device(canvas,{webglVersion:version}),gpu=device.gpu,gl=gpu.gl;
    try{
     const stage={colorOp:2,colorArg1:2,colorArg2:1,alphaOp:2,alphaArg1:2,alphaArg2:1,texCoordIndex:0,transformFlags:0};
     const draw={primitive:4,primitiveCount:1,stride:32,attributes:[
      {register:0,usage:0,usageIndex:0,type:3,offset:0},{register:2,usage:5,usageIndex:0,type:3,offset:16}],
      textures:[{width:2,height:1,pixels:new Uint8Array([255,0,0,255,0,255,0,255]),sampler:{addressU:3,addressV:3,min:1,mag:1}}],
      state:{cull:1,zenable:false},fixedFunction:{lighting:false,fog:false,specular:false,
       world:identity,view:identity,projection:identity,stages:[stage,{colorOp:1}]}};
     const positions=[[-1,-1,.5,1],[3,-1,.5,1],[-1,3,.5,1]];
     const setUV=uvs=>{draw.vertices=new Uint8Array(new Float32Array(positions.flatMap((p,i)=>[...p,...uvs[i]])).buffer);};
     const read=()=>Array.from(gpu.readPixels(5,5,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4)));
     const mixedGenerated=[];
     const checkMixed=expected=>{
      for(const profile of[1,2,3]){
       draw.pixelShader=new Uint32Array([(0xffff0100|profile)>>>0,66,0xb00f0000,1,0x800f0000,0xb0e40000,0xffff]);
       device.draw(draw);mixedGenerated.push({profile,pixel:read(),expected});
      }
      draw.pixelShader=null;
     };
     setUV(Array(3).fill([.25,.25,.5,1]));device.draw(draw);const disabled=read();
     for(let mask=0;mask<16;mask++){
      draw.state.colorWriteMask=mask;
      device.clear([.2,.4,.6,.8],1);device.draw(draw);
      const expected=[255,0,0,255].map((c,i)=>mask&(1<<i)?c:[51,102,153,204][i]);
      if(String(read())!==String(expected))throw new Error(`WebGL${version} color write mask ${mask}: ${read()} expected ${expected}`);
     }
     draw.state.colorWriteMask=16;const beforeMaskRejection=read();
     let badMaskRejected=false;try{device.draw(draw);}catch(error){badMaskRejected=/color write mask/.test(error.message);}
     if(!badMaskRejected||String(read())!==String(beforeMaskRejection))throw new Error('invalid color mask changed pixels');
     delete draw.state.colorWriteMask;
     const texcoordAlpha=[];
     setUV(Array(3).fill([.25,.25,.5,.25]));
     for(const profile of[1,2,3]){
      draw.pixelShader=new Uint32Array([(0xffff0100|profile)>>>0,64,0xb00f0000,1,0x800f0000,0xb0e40000,0xffff]);
      device.draw(draw);texcoordAlpha.push(read());
     }
     draw.pixelShader=null;setUV(Array(3).fill([.25,.25,.5,1]));
     const translate=identity.slice();translate[12]=.5;stage.transform=translate;stage.transformFlags=2;
     device.draw(draw);const translated=read(),cache=device.programs.size;
     translate[12]=0;device.draw(draw);const uniformChanged=read(),sameCache=cache===device.programs.size;
     // Microsoft texture-scrolling example: FLOAT2 UV translation is _31/_32.
     // Keep a padded stride, but declare only two components so GL supplies z=0.
     draw.attributes[1].type=1;translate[8]=.5;
     device.draw(draw);const float2Translated=read();
     draw.pixelShader=new Uint32Array([0xffff0101,66,0xb00f0000,1,0x800f0000,0xb0e40000,0xffff]);
     const mixedTransforms=[];
     for(const flags of[2,3,4]){
      stage.transformFlags=flags;device.draw(draw);mixedTransforms.push(read());
     }
     const mixedCache=device.programs.size;
     translate[8]=0;device.draw(draw);const mixedUniformChanged=read(),mixedCacheStable=mixedCache===device.programs.size;
     translate[8]=.5;
     stage.transformFlags=257;
     let mixedProjectionRejected=false;try{device.draw(draw);}catch(error){mixedProjectionRejected=/projected texture profile/.test(error.message);}
     draw.pixelShader=null;stage.transformFlags=2;
     translate[8]=0;device.draw(draw);const float2Identity=read();
     draw.attributes[1].type=3;
     stage.transformFlags=259;
     setUV(Array(3).fill([.375,.125,.5,1]));device.draw(draw);const projectedZ=read();
     checkMixed(projectedZ);
     draw.fixedFunction.stages[1]={texCoordIndex:0,transformFlags:0,colorOp:1};
     draw.pixelShader=new Uint32Array([0xffff0101,64,0xb00f0001,66,0xb00f0000,
      5,0x800f0000,0xb0e40000,0xb0e40001,0xffff]);
     device.draw(draw);const projectedWithUnprojectedCoord=read();draw.pixelShader=null;
     draw.textures[1]={width:2,height:1,pixels:new Uint8Array([255,255,0,255,0,255,255,255]),sampler:{addressU:3,addressV:3,min:1,mag:1}};
     draw.pixelShader=new Uint32Array([0xffff0101,66,0xb00f0000,69,0xb00f0001,0xb0e40000,
      1,0x800f0000,0xb0e40001,0xffff]);
     device.draw(draw);const projectedWithUnprojectedDependent=read();draw.pixelShader=null;
     stage.transformFlags=260;
     setUV(Array(3).fill([.375,.125,1,.5]));device.draw(draw);const projectedW=read();
     checkMixed(projectedW);
     setUV(Array(3).fill([-.375,-.125,1,-.5]));device.draw(draw);const projectedNegative=read();
     draw.pixelShader=new Uint32Array([0xffff0101,65,0xb00f0000,66,0xb00f0000,1,0x800f0000,0xb0e40000,0xffff]);
     device.clear([.2,.4,.6,1],1);device.draw(draw);const projectedKill=read();
     setUV(Array(3).fill([.375,.125,1,-.5]));device.draw(draw);const projectedKillIgnoresQ=read();
     draw.pixelShader=null;
     const invalidProjection=[];
     for(const flags of[259,260])for(const divisor of[0,-0,Infinity,NaN,1e-30]){
      stage.transformFlags=flags;
      const uv=[divisor===1e-30?1e30:.375,.125,1,1];uv[flags===259?2:3]=divisor;
      setUV(Array(3).fill(uv));device.draw(draw);invalidProjection.push(read());
      checkMixed([0,0,0,0]);
     }
     stage.transformFlags=259;
     setUV([[.1,.1,1,1],[3.6,.4,4,1],[.1,.1,1,1]]);device.draw(draw);const fragmentDivide=read();
     checkMixed(fragmentDivide);
     draw.pixelShader=new Uint32Array([0xffff0101,64,0xb00f0000,1,0x800f0000,0xb0e40000,0xffff]);
     let projectedDependentRejected=false;
     try{device.draw(draw);}catch(error){projectedDependentRejected=/projected dependent texture/.test(error.message);}
     const afterProjectedRejection=read();draw.pixelShader=null;
     // Six projected varyings and distinct matrices together; small colors
     // keep saturation from hiding a missing or duplicated stage.
     for(const flags of[259,260]){
      setUV(Array(3).fill(flags===259?[.1,.1,.5,1]:[.1,.1,1,.5]));
      const sixStages=Array.from({length:6},(_,i)=>{
       const transform=identity.slice();transform[12]=i%2?(flags===259?.25:.5):0;
       return {...stage,colorOp:i?7:2,alphaOp:2,texCoordIndex:0,transformFlags:flags,transform};
      });
      const sixDraw={...draw,textures:Array.from({length:6},()=>({width:2,height:1,
       pixels:new Uint8Array([16,0,0,255,0,32,0,255]),sampler:{addressU:3,addressV:3,min:1,mag:1}})),
       fixedFunction:{...draw.fixedFunction,stages:sixStages}};
      device.draw(sixDraw);
      if(String(read())!=='48,96,0,255')throw new Error(`WebGL${version} six-stage projection ${flags}: ${read()}`);
      const sixCache=device.programs.size;
      sixStages[5].transform[12]=0;device.draw(sixDraw);
      if(String(read())!=='64,64,0,255')throw new Error(`WebGL${version} six-stage matrix update ${flags}: ${read()}`);
      if(device.programs.size!==sixCache)throw new Error('six-stage matrix update changed shader cache');
     }
     // Vertex fog is evaluated before interpolation; blending changes RGB only.
     const fogDraw={primitive:4,primitiveCount:1,stride:48,
      vertices:new Uint8Array(new Float32Array(positions.flatMap(p=>[...p,1,0,0,.5,0,0,0,.25])).buffer),
      attributes:[{register:0,usage:0,usageIndex:0,type:3,offset:0},
       {register:1,usage:10,usageIndex:0,type:3,offset:16},{register:2,usage:10,usageIndex:1,type:3,offset:32}],
      state:{cull:1,zenable:false},textures:[],fixedFunction:{lighting:false,fog:true,fogColor:0x000000ff,
       fogVertexMode:0,fogStart:0,fogEnd:1,fogDensity:.5,
       world:identity,view:identity,projection:identity,stages:[{colorOp:1}]}};
     const fogPixel=factor=>{
      device.draw(fogDraw);const pixel=read(),expected=[factor*255,0,(1-factor)*255,127.5];
      if(pixel.some((c,i)=>Math.abs(c-expected[i])>1))throw new Error(`WebGL${version} fog ${JSON.stringify(fogDraw.fixedFunction)}: ${pixel} expected ${expected}`);
      if(!fogDraw.vertexShader)for(const profile of[1,2,3,4]){
       fogDraw.pixelShader=new Uint32Array([(0xffff0100|profile)>>>0,1,0x800f0000,0x90e40000,0xffff]);
       device.draw(fogDraw);const mixed=read();
       if(mixed.some((c,i)=>Math.abs(c-expected[i])>1))throw new Error(`WebGL${version} mixed fog ps1.${profile}: ${mixed} expected ${expected}`);
       fogDraw.pixelShader=null;
      }
     };
     fogPixel(.25);
     fogDraw.fixedFunction.alphaTest=true;fogDraw.fixedFunction.alphaFunc=5;fogDraw.fixedFunction.alphaRef=200;
     for(const profile of[0,1,2,3,4]){
      fogDraw.pixelShader=profile?new Uint32Array([(0xffff0100|profile)>>>0,1,0x800f0000,0x90e40000,0xffff]):null;
      device.clear([.2,.4,.6,1],1);device.draw(fogDraw);
      if(String(read())!=='51,102,153,255')throw new Error(`WebGL${version} fog alpha rejection ps${profile}`);
     }
     fogDraw.pixelShader=null;fogDraw.fixedFunction.alphaRef=0;fogPixel(.25);
     fogDraw.fixedFunction.alphaTest=false;
     for(const mode of[1,2,3]){
      fogDraw.fixedFunction.fogVertexMode=mode;
      fogPixel(mode===3?.5:Math.exp(mode===1?-.25:-.0625));
     }
     const fogCache=device.programs.size;
     fogDraw.fixedFunction.fogEnd=2;fogPixel(.75);
     if(device.programs.size!==fogCache)throw new Error('fog constants changed shader cache');
     fogDraw.fixedFunction.world=identity.slice();fogDraw.fixedFunction.world[12]=fogDraw.fixedFunction.world[13]=-1;
     fogDraw.fixedFunction.projection=identity.slice();fogDraw.fixedFunction.projection[12]=fogDraw.fixedFunction.projection[13]=1;
     fogDraw.fixedFunction.rangeFog=true;fogDraw.fixedFunction.fogEnd=4;
     fogPixel(1-Math.sqrt(8.25)/4);
     fogDraw.fixedFunction.rangeFog=false;fogPixel(.875);
     fogDraw.fixedFunction.world=identity;fogDraw.fixedFunction.projection=identity;
     fogDraw.fixedFunction.view=identity.slice();fogDraw.fixedFunction.view[14]=-.75;
     fogDraw.fixedFunction.projection=identity.slice();fogDraw.fixedFunction.projection[10]=0;
     fogDraw.fixedFunction.fogEnd=1;fogPixel(.75); // abs(camera Z), not object/projected Z
     fogDraw.fixedFunction.view=identity;
     fogDraw.vertices=new Uint8Array(new Float32Array(positions.flatMap((p,i)=>
      [p[0],p[1],i===1?2:0,1,1,0,0,.5,0,0,0,.25])).buffer);
     // At this pixel the second vertex has weight5/16. Its factor clamps
     // to zero before interpolation; fog from interpolated Z would be wrong.
     fogPixel(11/16);
     fogDraw.attributes[0].usage=9;
     fogDraw.vertices=new Uint8Array(new Float32Array([[0,0,.5,1],[16,0,.5,1],[0,16,.5,1]]
      .flatMap(p=>[...p,1,0,0,.5,0,0,0,.25])).buffer);
     fogPixel(.25); // POSITIONT uses supplied specular alpha even with LINEAR selected
     fogDraw.fixedFunction.rangeFog=true;fogDraw.fixedFunction.fogVertexMode=999;
     for(const mode of[1,2,3]){
      fogDraw.fixedFunction.fogTableMode=mode;
      fogPixel(mode===3?.5:Math.exp(mode===1?-.25:-.0625));
     }
     const tableCache=device.programs.size;
     fogDraw.fixedFunction.fogEnd=2;fogPixel(.75);
     if(device.programs.size!==tableCache)throw new Error('table fog uniforms changed shader cache');
     fogDraw.fixedFunction.fogEnd=1;
     fogDraw.attributes[0].usage=0;fogDraw.fixedFunction.projection=identity;
     fogDraw.vertices=new Uint8Array(new Float32Array(positions.flatMap((p,i)=>
      [p[0],p[1],i===1?1:0,1,1,0,0,.5,0,0,0,.25])).buffer);
     fogDraw.fixedFunction.fogTableMode=2;fogDraw.fixedFunction.fogDensity=1;
     fogPixel(Math.exp(-Math.pow(5/16,2))); // formula after depth interpolation
     fogDraw.fixedFunction.fogDensity=.5;
     fogDraw.fixedFunction.fogTableMode=4;
     let tableFogRejected=false;try{device.draw(fogDraw);}catch(error){tableFogRejected=/invalid raster fog state/.test(error.message);}
     if(!tableFogRejected)throw new Error('invalid table fog mode must reject');
     fogDraw.fixedFunction.fogTableMode=0;fogDraw.attributes[0].usage=0;
     fogDraw.vertices=new Uint8Array(new Float32Array(positions.flatMap(p=>[...p,1,0,0,.5,0,0,0,.25])).buffer);
     fogDraw.vertexShader=new Uint32Array([0xfffe0101,
      1,0xc00f0000,0x90e40000,1,0xd00f0000,0x90e40001,1,0xd00f0001,0x90e40002,
      1,0xc00f0001,0xa0e40000,0xffff]);
     // Only oFog.x is consumed; clamp before rasterization, ignore fixed mode.
     fogDraw.fixedFunction.fogVertexMode=999;
     for(const factor of[-1,.25,2]){
      fogDraw.vertexConstants=new Float32Array([factor,123,-456,.9]);fogPixel(Math.max(0,Math.min(1,factor)));
     }
     const savedFixedFog=fogDraw.fixedFunction;
     fogDraw.fixedFunction=undefined;fogDraw.fogState={enabled:true,color:0x000000ff,tableMode:0};
     for(const profile of[1,2,3]){
      fogDraw.pixelShader=new Uint32Array([(0xffff0100|profile)>>>0,1,0x800f0000,0x90e40000,0xffff]);
      for(const factor of[-1,.25,2]){
       fogDraw.vertexConstants=new Float32Array([factor,123,-456,.9]);fogPixel(Math.max(0,Math.min(1,factor)));
      }
     }
     fogDraw.vertexConstants=new Float32Array([.25,0,0,0]);
     const bothFogCache=device.programs.size;
     fogDraw.fogState.color=0xff00ff00;device.draw(fogDraw);
     if(read().some((c,i)=>Math.abs(c-[64,191,0,128][i])>1))throw new Error('both-programmed fog color uniform');
     fogDraw.fogState.color=0xff0000ff;fogPixel(.25);
     if(device.programs.size!==bothFogCache)throw new Error('both-programmed fog color changed shader cache');
     // Explicit disabled shared state overrides stale legacy fog metadata.
     fogDraw.fixedFunction=savedFixedFog;fogDraw.fogState.enabled=false;fogPixel(1);
     fogDraw.fogState.enabled=true;fogDraw.fixedFunction=undefined;
     fogDraw.state.alphaTest=true;fogDraw.state.alphaFunc=5;fogDraw.state.alphaRef=200;
     device.clear([.2,.4,.6,1],1);device.draw(fogDraw);
     if(String(read())!=='51,102,153,255')throw new Error('both-programmed fog discarded alpha');
     fogDraw.state.alphaRef=0;fogPixel(.25);delete fogDraw.state.alphaTest;
     fogDraw.pixelShader=null;fogDraw.fixedFunction=savedFixedFog;delete fogDraw.fogState;
     fogDraw.vertexShader=new Uint32Array([0xfffe0101,1,0xc00f0000,0x90e40000,
      1,0xd00f0000,0x90e40001,0xffff]);
     let missingFogRejected=false;try{device.draw(fogDraw);}catch(error){missingFogRejected=/oFog output/.test(error.message);}
     if(!missingFogRejected)throw new Error('missing oFog must not silently produce an arbitrary factor');
     fogDraw.fixedFunction=undefined;
     fogDraw.fogState={enabled:true,color:0x000000ff,tableMode:3,start:0,end:1,density:.5,depthMode:0};
     for(const profile of[1,2,3]){
      fogDraw.pixelShader=new Uint32Array([(0xffff0100|profile)>>>0,1,0x800f0000,0x90e40000,0xffff]);
      fogPixel(.5); // table mode does not require a vertex shader oFog output
     }
     for(const bad of[{depthMode:1},{end:0},{density:Infinity,tableMode:1}]){
      const valid=fogDraw.fogState;fogDraw.fogState={...valid,...bad};const before=read();
      let rejected=false;try{device.draw(fogDraw);}catch(error){rejected=/WFOG|table fog parameters/.test(error.message);}
      if(!rejected||String(before)!==String(read()))throw new Error('invalid table fog changed pixels');
      fogDraw.fogState=valid;
     }
     // XYZRHW bypasses the matrix; projection remains a raster operation.
     stage.transformFlags=2;stage.transform=null;draw.attributes[0].usage=9;
     draw.vertices=new Uint8Array(new Float32Array([[0,0,.5,1],[16,0,.5,1],[0,16,.5,1]]
      .flatMap(p=>[...p,.25,.25,.5,1])).buffer);
     device.draw(draw);const positionT=read();
     draw.attributes[0].usage=0;setUV(Array(3).fill([.25,.25,.5,1]));
     let badMatrix=false;try{device.draw(draw);}catch(error){badMatrix=/texture matrix/.test(error.message);}
     stage.transform=identity;stage.transformFlags=257;
     let badCount=false;try{device.draw(draw);}catch(error){badCount=/transform flags/.test(error.message);}
     // Camera-space z comes from both WORLD and VIEW, not projection or UV3.
     stage.texCoordIndex=0x20003;stage.transformFlags=2;
     stage.transform=identity.slice();stage.transform[0]=0;stage.transform[8]=1;
     draw.fixedFunction.world=identity.slice();draw.fixedFunction.world[14]=.25;
     draw.fixedFunction.view=identity.slice();draw.fixedFunction.view[14]=.25;
     draw.fixedFunction.projection=identity.slice();draw.fixedFunction.projection[10]=0;
     positions.forEach(p=>{p[2]=.1;});setUV(Array(3).fill([.1,.1,0,1]));
     device.draw(draw);const generatedCamera=read();
     checkMixed(generatedCamera);
     draw.fixedFunction.world=identity;draw.fixedFunction.view=identity;
     device.draw(draw);const generatedIdentity=read();
     stage.texCoordIndex=0x10000;
     draw.attributes[1].usage=3;setUV(Array(3).fill([0,0,1,0]));
     draw.fixedFunction.world=identity.slice();draw.fixedFunction.world[10]=4;
     draw.fixedFunction.view=identity.slice();draw.fixedFunction.view[10]=2;
     device.draw(draw);const generatedNormal=read(),normalCache=device.programs.size;
     draw.fixedFunction.world=identity;draw.fixedFunction.view=identity;
     device.draw(draw);const normalIdentity=read(),normalCacheStable=normalCache===device.programs.size;
     checkMixed(normalIdentity);
     draw.fixedFunction.world=identity.slice();draw.fixedFunction.world[10]=4;
     draw.fixedFunction.normalizeNormals=true;device.draw(draw);const normalized=read();
     checkMixed(normalized);
     setUV(Array(3).fill([0,0,0,0]));device.draw(draw);const zeroNormal=read();
     checkMixed(zeroNormal);
     const normalEdges=[];
     for(const z of[1e-30,1e30,Infinity,NaN]){
      setUV(Array(3).fill([0,0,z,0]));device.draw(draw);normalEdges.push(read());
      checkMixed([255,0,0,255]);
     }
     setUV(Array(3).fill([0,0,1,0]));
     // Full 4x4 inverse matters: z/w block [[1,.5],[-3,1]] has
     // inverse-transpose zz=.4, whereas inverting only the 3x3 gives1.
     draw.fixedFunction.normalizeNormals=false;
     draw.fixedFunction.world=identity.slice();draw.fixedFunction.world[11]=-3;draw.fixedFunction.world[14]=.5;
     device.draw(draw);const nonAffineNormal=read();
     draw.fixedFunction.world=identity.slice();
     draw.fixedFunction.world[10]=0;
     let singularNormal=false;try{device.draw(draw);}catch(error){singularNormal=/singular normal/.test(error.message);}
     draw.fixedFunction.world=identity;stage.texCoordIndex=0x30000;
     draw.fixedFunction.world=identity.slice();draw.fixedFunction.world[0]=draw.fixedFunction.world[5]=.001;
     draw.fixedFunction.projection=identity.slice();draw.fixedFunction.projection[0]=draw.fixedFunction.projection[5]=1000;
     stage.transform=identity.slice();stage.transform[0]=0;stage.transform[8]=.4;stage.transform[12]=.5;
     draw.fixedFunction.localViewer=true;device.draw(draw);const localReflection=read();
     checkMixed(localReflection);
     draw.fixedFunction.localViewer=false;device.draw(draw);const distantReflection=read();
     checkMixed(distantReflection);
     stage.transformFlags=0;
     const faces=[[255,0,0,255],[0,255,0,255],[0,0,255,255],[255,255,0,255],[0,255,255,255],[255,0,255,255]]
      .map(c=>({width:1,height:1,pixels:new Uint8Array(c)}));
     draw.textures[0]={width:1,height:1,pixels:faces[0].pixels,faces,sampler:{addressU:3,addressV:3,min:1,mag:1}};
     device.draw(draw);const distantCube=read();
     draw.fixedFunction.localViewer=true;device.draw(draw);const localCube=read();
     stage.texCoordIndex=0x40000;
     let unsupportedGeneration=false;try{device.draw(draw);}catch(error){unsupportedGeneration=/generated texture/.test(error.message);}
     results.push({version,disabled,texcoordAlpha,translated,float2Translated,float2Identity,mixedTransforms,mixedGenerated,mixedProjectionRejected,mixedUniformChanged,mixedCacheStable,uniformChanged,sameCache,projectedZ,projectedWithUnprojectedCoord,projectedWithUnprojectedDependent,projectedW,projectedNegative,projectedKill,projectedKillIgnoresQ,invalidProjection,fragmentDivide,projectedDependentRejected,afterProjectedRejection,positionT,badMatrix,badCount,generatedCamera,generatedIdentity,generatedNormal,normalIdentity,normalCacheStable,normalized,zeroNormal,normalEdges,nonAffineNormal,singularNormal,localReflection,distantReflection,distantCube,localCube,unsupportedGeneration,error:gpu.getError()});
    }finally{device.destroy();}
   }
   return results;
  });
  for(const r of results){
   assert.strictEqual(r.error,0);assert(r.sameCache&&r.badMatrix&&r.badCount&&r.unsupportedGeneration&&r.normalCacheStable&&r.singularNormal);
   r.texcoordAlpha.forEach((p,i)=>assert.deepStrictEqual(p,[64,64,128,255],`WebGL${r.version} TEXCOORD ps1.${i+1} alpha`));
   assert.deepStrictEqual(r.projectedKill,[51,102,153,255],'TEXKILL reads original XYZ, not divided UV');
   assert.deepStrictEqual(r.projectedKillIgnoresQ,[255,0,0,255],'TEXKILL ignores negative Q');
   assert.deepStrictEqual(r.projectedWithUnprojectedCoord,[0,32,0,255],'projection on t0 does not reject unprojected TEXCOORD t1');
   assert.deepStrictEqual(r.projectedWithUnprojectedDependent,[0,255,255,255],'unprojected TEXREG2AR consumes the projected TEX sample');
   assert.deepStrictEqual(r.distantCube,[0,255,255,255],`WebGL${r.version} distant reflection +Z`);
   assert.deepStrictEqual(r.localCube,[255,0,255,255],`WebGL${r.version} local reflection -Z`);
   r.invalidProjection.forEach((p,i)=>assert.deepStrictEqual(p,[0,0,0,0],`WebGL${r.version} invalid projection ${i}`));
   r.normalEdges.forEach((p,i)=>assert.deepStrictEqual(p,[255,0,0,255],`WebGL${r.version} normal edge ${i}`));
   assert(r.mixedProjectionRejected,'unsupported projected COUNT1 remains explicitly gated');
   assert(r.projectedDependentRejected);assert.deepStrictEqual(r.afterProjectedRejection,r.fragmentDivide);
   assert(r.mixedCacheStable);assert.deepStrictEqual(r.mixedUniformChanged,[255,0,0,255]);
   r.mixedGenerated.forEach(({pixel,expected},i)=>assert.deepStrictEqual(pixel,expected,`WebGL${r.version} mixed generated coordinates ${i}`));
   r.mixedTransforms.forEach((p,i)=>assert.deepStrictEqual(p,[0,255,0,255],`WebGL${r.version} mixed COUNT${i+2}`));
   for(const name of['disabled','uniformChanged','float2Identity','positionT','generatedIdentity','generatedNormal','zeroNormal','nonAffineNormal','localReflection'])assert.deepStrictEqual(r[name],[255,0,0,255],`WebGL${r.version} ${name}`);
   for(const name of['translated','float2Translated','projectedZ','projectedW','projectedNegative','fragmentDivide','generatedCamera','normalIdentity','normalized','distantReflection'])assert.deepStrictEqual(r[name],[0,255,0,255],`WebGL${r.version} ${name}`);
  }
  console.log('PASS WebGL1/2 fixed texture transforms, uniform cache, fragment projection and POSITIONT bypass');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
