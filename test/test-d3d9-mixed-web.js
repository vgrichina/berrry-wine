#!/usr/bin/env node
'use strict';
const assert=require('assert'),path=require('path'),puppeteer=require('puppeteer');
(async()=>{
 const browser=await puppeteer.launch({headless:true,
  executablePath:process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--no-first-run','--no-default-browser-check']});
 try{
  const page=await browser.newPage();
  for(const file of['gpu-backend.js','d3d9-shader.js','render-clear.js','d3d9-backend.js'])
   await page.addScriptTag({path:path.join(__dirname,'../lib',file)});
  const results=await page.evaluate(()=>{
   const result=[];
   for(const version of[1,2]){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=8;
    const d=new D3D9Backend.Device(canvas,{webglVersion:version}),g=d.gpu,gl=g.gl;
    const identity=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
    const stage={colorOp:4,colorArg1:2,colorArg2:0,alphaOp:2,alphaArg1:2,alphaArg2:0,texCoordIndex:0,transformFlags:0};
    const fixed={lighting:false,fog:false,specular:false,world:identity,view:identity,projection:identity,
     stages:[stage,{colorOp:1,texCoordIndex:1,transformFlags:0}]};
    const vertices=new Float32Array([-1,-1,.5,1,.25,.5,.75,1,.5,.5,0,1,
      3,-1,.5,1,.25,.5,.75,1,.5,.5,0,1,-1,3,.5,1,.25,.5,.75,1,.5,.5,0,1]);
    const draw={primitive:4,primitiveCount:1,stride:48,vertices:new Uint8Array(vertices.buffer),
     attributes:[{register:0,usage:0,usageIndex:0,type:3,offset:0},
      {register:1,usage:10,usageIndex:0,type:3,offset:16},{register:2,usage:5,usageIndex:0,type:3,offset:32}],
     textures:[{width:1,height:1,pixels:new Uint8Array([200,100,80,255]),sampler:{addressU:3,addressV:3,min:1,mag:1}}],
     fixedFunction:fixed,state:{cull:1,zenable:false}};
    const ps=new Uint32Array([0xffff0101,66,0xb00f0000,5,0x800f0000,0xb0e40000,0x90e40000,0xffff]);
    const vs=new Uint32Array([0xfffe0101,1,0xc00f0000,0x90e40000,1,0xd00f0000,0xa0e40000,
      1,0xe00f0000,0xa0e40001,0xffff]);
    const read=()=>Array.from(g.readPixels(3,3,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4)));
    draw.pixelShader=ps;
    // Inactive fixed pixel color operations must not reject a programmed PS.
    draw.fixedFunction={...fixed,stages:[{...stage,colorOp:999},fixed.stages[1]]};
    d.draw(draw);const fixedVertex=read();
    draw.state={...draw.state,alphaTest:true,alphaFunc:5,alphaRef:255};
    d.clear([0,0,0,1],1);d.draw(draw);const programmedAlphaRejected=read();
    const cached=d.programs.size;
    draw.state.alphaRef=0;d.draw(draw);const alphaUniform=read(),sameCache=cached===d.programs.size;
    delete draw.state.alphaTest;delete draw.state.alphaFunc;delete draw.state.alphaRef;
    draw.pixelShader=null;draw.vertexShader=vs;
    draw.vertexConstants=new Float32Array([.5,.25,1,1,.5,.5,0,1]);
    // No fixed vertex transforms/lighting are evaluated for a programmed VS.
    draw.fixedFunction={...fixed,lighting:true,world:null,view:null,projection:null};
    d.draw(draw);const fixedPixel=read();
    draw.fixedFunction={...draw.fixedFunction,alphaTest:true,alphaFunc:5,alphaRef:255};
    d.clear([0,0,0,1],1);d.draw(draw);const alphaRejected=read();
    draw.fixedFunction=fixed;draw.vertexShader=null;draw.pixelShader=null;
    d.draw(draw);const bothFixed=read();
    draw.pixelShader=new Uint32Array([0xffff0101,0x1234,0xffff]);
    let invalidRejected=false;try{d.draw(draw);}catch(error){invalidRejected=true;}
    const afterInvalid=read();
    draw.pixelShader=null;
    const extra={...stage,colorOp:7,colorArg1:1,colorArg2:6,constant:0xff0a141e,alphaArg1:1,texCoordIndex:1};
    draw.fixedFunction={...fixed,stages:[stage,extra,{colorOp:1},{colorOp:999}]};
    d.draw(draw);const cascade=read();
    draw.fixedFunction={...fixed,stages:[{...stage,colorOp:2,colorArg1:6,constant:0xff0a141e},
      {...extra,constant:0xff28323c},{colorOp:1}]};
    d.draw(draw);const separateConstants=read();
    const texture1={width:2,height:1,pixels:new Uint8Array([10,20,30,255,40,50,60,255]),sampler:{addressU:3,addressV:3,min:1,mag:1}};
    draw.textures[1]=texture1;
    draw.fixedFunction={...fixed,stages:[stage,{...extra,colorArg2:2},{colorOp:1}]};
    d.draw(draw);const defaultCoordinates=read();
    draw.attributes.push({register:3,usage:5,usageIndex:1,type:3,offset:32});
    d.draw(draw);const separateCoordinates=read();
    draw.vertexShader=new Uint32Array([...vs.slice(0,-1),1,0xe00f0001,0xa0e40001,0xffff]);
    d.draw(draw);const mixedCascade=read();
    draw.vertexShader=null;draw.textures[1]=null;
    draw.fixedFunction={...fixed,stages:[stage,{...extra,colorArg1:2},{colorOp:999}]};
    d.draw(draw);const nullTerminates=read();
    draw.textures[5]=texture1;
    const sixStages=[stage,...Array.from({length:4},(_,i)=>({...extra,constant:0xff010203,texCoordIndex:i+1})),
      {...extra,colorArg2:2,texCoordIndex:1}];
    draw.fixedFunction={...fixed,stages:sixStages};
    d.draw(draw);const sixStageCascade=read();
    draw.fixedFunction={...fixed,stages:[...sixStages,extra]};
    let seventhRejected=false;try{d.draw(draw);}catch(error){seventhRejected=/six-stage/.test(error.message);}
    const afterSeventh=read();
    const blendVertices=vertices.slice();for(let v=0;v<3;v++)blendVertices[v*12+7]=.25;
    draw.vertices=new Uint8Array(blendVertices.buffer);
    draw.textures[1]={width:1,height:1,pixels:new Uint8Array([128,96,64,128]),sampler:{addressU:3,addressV:3,min:1,mag:1}};
    const blendOps=[];
    for(const mode of[12,13,14,15,16]){
      draw.fixedFunction={...fixed,textureFactor:0x40000000,stages:[
        {...stage,colorOp:2,colorArg1:0,alphaOp:2,alphaArg1:6,constant:0xc0000000},
        {...extra,colorOp:mode,colorArg1:6,colorArg2:2,alphaOp:mode,alphaArg1:6,alphaArg2:2,constant:0xff204060},
        {colorOp:1}]};
      d.draw(draw);blendOps.push({mode,pixel:read()});
    }
    const colorOps=[];
    for(const mode of[18,19,20,21]){
      const operation={...extra,colorOp:mode,colorArg1:6,colorArg2:2,alphaOp:2,alphaArg1:2,constant:0x40204060};
      draw.fixedFunction={...fixed,stages:[stage,operation,{colorOp:1}]};
      d.draw(draw);const pixel=read();
      draw.fixedFunction={...fixed,stages:[stage,{...operation,alphaOp:mode},{colorOp:1}]};
      let rejected=false;try{d.draw(draw);}catch(error){rejected=/color-only/.test(error.message);}
      colorOps.push({mode,pixel,rejected,after:read()});
    }
    draw.fixedFunction={...fixed,stages:[
      {...stage,colorOp:2,colorArg1:6,alphaOp:2,alphaArg1:6,constant:0xff204060,resultArg:5},
      {...extra,colorOp:7,colorArg1:1,colorArg2:5,alphaOp:2,alphaArg1:5,resultArg:1},{colorOp:1}]};
    d.draw(draw);const temporaryRoute=read();
    draw.fixedFunction={...fixed,stages:[{...stage,colorOp:2,colorArg1:5,alphaOp:2,alphaArg1:5,resultArg:1},{colorOp:1}]};
    d.draw(draw);const temporaryDefault=read();
    draw.fixedFunction={...fixed,stages:[{...stage,resultArg:5},{colorOp:1}]};
    let finalTemporaryRejected=false;try{d.draw(draw);}catch(error){finalTemporaryRejected=/write CURRENT/.test(error.message);}
    draw.textures[0]=draw.textures[1];
    const triadic=[];
    for(const mode of[25,26])for(const third of[3,2,19,35]){
      draw.fixedFunction={...fixed,textureFactor:0x204080c0,stages:[
        {...stage,colorOp:mode,colorArg1:6,colorArg2:0,colorArg0:third,
          alphaOp:mode,alphaArg1:6,alphaArg2:0,alphaArg0:3,constant:0x40204060},{colorOp:1}]};
      d.draw(draw);triadic.push({mode,third,pixel:read()});
    }
    const dot3=[];
    for(const source of[6,2])for(const channels of['rgb','alpha','both'])for(const modifier of[0,16,32,48])for(const constant of[0x40c0a080,0x40ffffff,0x40000000]){
      draw.textures[0]={width:1,height:1,pixels:new Uint8Array([constant>>>16&255,constant>>>8&255,constant&255,constant>>>24]),
        sampler:{addressU:3,addressV:3,min:1,mag:1}};
      draw.fixedFunction={...fixed,textureFactor:0xa0c0c0c0,stages:[
        {...stage,colorOp:channels==='alpha'?2:24,colorArg1:source|modifier,colorArg2:3,
          alphaOp:channels==='rgb'?2:24,alphaArg1:source|modifier,alphaArg2:3,constant,resultArg:5},
        {...extra,colorOp:2,colorArg1:5,alphaOp:2,alphaArg1:5},{colorOp:1}]};
      d.draw(draw);dot3.push({source,channels,modifier,constant,pixel:read()});
    }
    const premod=[];
    for(const channels of['rgb','alpha','both'])for(const modifier of[0,16,32,48])for(const textured of[false,true]){
      draw.textures[1]=textured?{width:1,height:1,pixels:new Uint8Array([128,96,64,32]),sampler:{addressU:3,addressV:3,min:1,mag:1}}:null;
      draw.fixedFunction={...fixed,stages:[
        {...stage,colorOp:channels==='alpha'?2:17,colorArg1:6,alphaOp:channels==='rgb'?2:17,alphaArg1:6,constant:0x804060c0},
        {...extra,colorOp:2,colorArg1:1|modifier,alphaOp:2,alphaArg1:1|modifier},{colorOp:1}]};
      d.draw(draw);premod.push({channels,modifier,textured,pixel:read()});
    }
    // The effect belongs only to the next stage; a later CURRENT read must
    // not multiply by that later stage's texture a second time.
    draw.textures[2]={width:1,height:1,pixels:new Uint8Array([0,0,0,0]),sampler:{addressU:3,addressV:3,min:1,mag:1}};
    draw.fixedFunction.stages[2]={...extra,texCoordIndex:2,colorOp:2,colorArg1:1,alphaOp:2,alphaArg1:1};
    draw.fixedFunction.stages.push({colorOp:1});d.draw(draw);const premodNoLeak=read();
    draw.fixedFunction={...fixed,stages:[
      {...stage,colorOp:17,colorArg1:6,alphaOp:17,alphaArg1:6,constant:0x804060c0},
      {...extra,colorOp:2,colorArg1:1,alphaOp:2,alphaArg1:1,resultArg:5},
      {...extra,texCoordIndex:2,colorOp:2,colorArg1:1,alphaOp:2,alphaArg1:1},{colorOp:1}]};
    d.draw(draw);const premodTemporary=read();
    result.push({version,fixedVertex,fixedPixel,bothFixed,alphaRejected,programmedAlphaRejected,alphaUniform,sameCache,invalidRejected,afterInvalid,
      cascade,separateConstants,defaultCoordinates,separateCoordinates,mixedCascade,nullTerminates,sixStageCascade,seventhRejected,afterSeventh,blendOps,
      temporaryRoute,temporaryDefault,finalTemporaryRejected,colorOps,triadic,dot3,premod,premodNoLeak,premodTemporary,error:g.getError()});d.destroy();
   }
   return result;
  });
  for(const r of results){
   assert.strictEqual(r.error,0);assert(r.invalidRejected,'bound invalid shader must not fall back');
   assert.deepStrictEqual(r.fixedVertex,[50,50,60,255]);
   assert.deepStrictEqual(r.fixedPixel,[100,25,80,255]);
   assert.deepStrictEqual(r.bothFixed,[50,50,60,255]);
   assert.deepStrictEqual(r.alphaRejected,[0,0,0,255]);
   assert.deepStrictEqual(r.programmedAlphaRejected,[0,0,0,255]);
   assert.deepStrictEqual(r.alphaUniform,r.fixedVertex);assert(r.sameCache,'alpha reference is a uniform, not shader specialization');
   assert.deepStrictEqual(r.afterInvalid,r.bothFixed);
   assert.deepStrictEqual(r.cascade,[60,70,90,255]);
   assert.deepStrictEqual(r.separateConstants,[50,70,90,255]);
   assert.deepStrictEqual(r.defaultCoordinates,[60,70,90,255]);
   assert.deepStrictEqual(r.separateCoordinates,[90,100,120,255]);
   assert.deepStrictEqual(r.mixedCascade,[140,75,140,255]);
   assert.deepStrictEqual(r.nullTerminates,r.bothFixed);
   assert.deepStrictEqual(r.sixStageCascade,[94,108,132,255]);
   assert(r.seventhRejected);assert.deepStrictEqual(r.afterSeventh,r.sixStageCascade);
   for(const {mode,pixel} of r.blendOps){
    const factor=({12:.25,13:128/255,14:64/255,15:128/255,16:192/255})[mode];
    const x=[32,64,96,255],y=[128,96,64,128];
    const expected=x.map((a,c)=>Math.min(255,Math.round(a*(mode===15?1:factor)+y[c]*(1-factor))));
    pixel.forEach((value,c)=>assert(Math.abs(value-expected[c])<=1,`WebGL${r.version} blend op${mode} channel${c}: ${pixel} expected${expected}`));
   }
   [96,192,255,255].forEach((value,c)=>assert(Math.abs(r.temporaryRoute[c]-value)<=1,
    'TEMP write preserves pre-stage CURRENT (one UNORM rounding step allowed)'));
   assert.deepStrictEqual(r.temporaryDefault,[0,0,0,0],'TEMP starts at zero for each pixel');
   assert(r.finalTemporaryRejected);
   for(const {mode,pixel,rejected,after} of r.colorOps){
    const a=64/255,x=[32,64,96].map(v=>v/255),y=[128,96,64].map(v=>v/255);
    const expected=x.map((v,c)=>Math.round(255*Math.min(1,({18:v+a*y[c],19:v*y[c]+a,
      20:v+(1-a)*y[c],21:(1-v)*y[c]+a})[mode])));
    expected.push(128);
    pixel.forEach((value,c)=>assert(Math.abs(value-expected[c])<=1,`WebGL${r.version} colorop${mode}: ${pixel} expected${expected}`));
    assert(rejected);assert.deepStrictEqual(after,pixel,'invalid alpha operation must not draw');
   }
   for(const {mode,third,pixel} of r.triadic){
    const x=[32,64,96,64].map(v=>v/255),y=[.25,.5,.75,.25];
    let z=(third===2?[128,96,64,128]:[64,128,192,32]).map(v=>v/255);
    if(third&32)z.fill(z[3]);if(third&16)z=z.map(v=>1-v);
    z[3]=32/255; // ALPHAARG0 is independent of COLORARG0 and its modifiers.
    const expected=x.map((v,c)=>Math.round(255*Math.min(1,mode===25?z[c]+v*y[c]:z[c]*v+(1-z[c])*y[c])));
    pixel.forEach((value,c)=>assert(Math.abs(value-expected[c])<=1,`WebGL${r.version} triadic${mode} ARG0=${third}: ${pixel} expected${expected}`));
   }
   for(const {source,channels,modifier,constant,pixel} of r.dot3){
    let a=[constant>>>16&255,constant>>>8&255,constant&255,constant>>>24].map(v=>v/255);
    if(modifier&32)a.fill(a[3]);if(modifier&16)a=a.map(v=>1-v);
    const dot=Math.max(0,Math.min(1,a.slice(0,3).reduce((sum,v)=>sum+(2*v-1)*(2*192/255-1),0)));
    const expected=a.map((v,c)=>Math.round(255*((c===3?channels!=='rgb':channels!=='alpha')?dot:v)));
    pixel.forEach((value,c)=>assert(Math.abs(value-expected[c])<=1,
      `WebGL${r.version} DOT3 source${source} ${channels}/${modifier}/${constant.toString(16)}: ${pixel} expected${expected}`));
   }
   for(const {channels,modifier,textured,pixel} of r.premod){
    let expected=[64,96,192,128].map((v,c)=>v/255*(textured&&(c===3?channels!=='rgb':channels!=='alpha')?[128,96,64,32][c]/255:1));
    if(modifier&32)expected.fill(expected[3]);if(modifier&16)expected=expected.map(v=>1-v);
    expected=expected.map(v=>Math.round(v*255));
    pixel.forEach((value,c)=>assert(Math.abs(value-expected[c])<=1,`WebGL${r.version} PREMOD ${channels}/${modifier}/${textured}: ${pixel} expected${expected}`));
   }
   assert.deepStrictEqual(r.premodNoLeak,r.premod.at(-1).pixel,'PREMOD expires after the next stage');
   assert.deepStrictEqual(r.premodTemporary,[64,96,192,128],'PREMOD TEMP write leaves stored CURRENT unchanged');
  }
  console.log('PASS WebGL1/2 mixed fixed/programmed stages, ordered texture cascade, independent constants/coordinates, termination, alpha and no fallback');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
