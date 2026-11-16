'use strict';
const assert=require('assert'),path=require('path'),puppeteer=require('puppeteer');
const {bootRenderHarness}=require('./render-helper');
const {Device}=require('../lib/d3d9-software-backend');
(async()=>{
 const {exports:e,memory}=await bootRenderHarness({fonts:'none'});
 const software=new Device({getExports:()=>e,getMemory:()=>memory.buffer,width:16,height:16});
 const vs=[0xfffe0101,1,0xc00f0000,0x90e40000,1,0xd00f0000,0x90e40005,0xffff],ps=[0xffff0101,1,0x800f0000,0x90e40000,0xffff];
 const cases=[];
 const points=[[[2,2],[14,2],[2,14]],[[2,2],[14,2],[2,14]],[[2,2],[14,2],[2,14]],[[2,2],[14,2],[2,14]],
  [[-8,2],[14,2],[2,14]],[[2,2],[14,2],[2,14]],[[8,8],[13,10],[3,4]]];
 for(const [dx,dy]of [[6,3],[3,6],[-3,6],[-6,3],[-6,-3],[-3,-6],[3,-6],[6,-3]])
  for(let last=0;last<2;last++)points.push([[8,8],[8+dx,8+dy],[3,4]]);
 for(let i=0;i<points.length;i++){
  const vertices=new Float32Array(points[i].flatMap(([x,y])=>[x/8-1,1-y/8,.5,1,1,0,0,1]));
  const draw={primitive:4,primitiveCount:1,stride:32,vertices:new Uint8Array(vertices.buffer),vertexShader:new Uint32Array(vs),pixelShader:new Uint32Array(ps),
   attributes:[{register:0,usage:0,usageIndex:0,type:3,offset:0},{register:5,usage:10,usageIndex:0,type:3,offset:16}],
   state:{fillMode:i===2?1:2,cull:i===3?2:1,zenable:false,lastPixel:i<7?i!==1:!!(i&1)},textures:[]};
  if(i===6){
   const values=new Float32Array(points[i].flatMap(([x,y],j)=>{const w=[1,2,.5][j];return [(x/8-1)*w,(1-y/8)*w,.5*w,w,j===0?1:0,j===1?1:0,j===2?1:0,1];}));
   draw.vertices=new Uint8Array(values.buffer);
  }
  if(i===5)draw.vertices=new Uint8Array(new Float32Array([-0.75,.75,-.5,1,1,0,0,1,.75,.75,.5,1,1,0,0,1,-.75,-.75,.5,1,1,0,0,1]).buffer);
  software.clear([0,0,0,1],1);software.draw(draw);
  cases.push({draw:{...draw,vertices:Array.from(draw.vertices),vertexShader:vs,pixelShader:ps},pixels:Array.from(software.present().pixels)});
 }
 for(const [fillMode,z] of [[1,.5],[2,.5],[1,2]]){
  const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
  const vertices=new Float32Array([2,2,z,1,1,0,0,1,14,2,z,1,1,0,0,1,2,14,z,1,1,0,0,1]);
  const draw={...cases[0].draw,vertices:new Uint8Array(vertices.buffer),vertexShader:null,pixelShader:null,
   attributes:[{register:0,usage:9,usageIndex:0,type:3,offset:0},{register:5,usage:10,usageIndex:0,type:3,offset:16}],
   state:{fillMode,cull:1,zenable:false,lastPixel:true},fixedFunction:{lighting:false,fog:false,specular:false,alphaTest:false,
    world:identity,view:identity,projection:identity,textureFactor:0xffffffff,stages:[{colorOp:1,colorArg1:2,colorArg2:0,
     alphaOp:1,alphaArg1:2,alphaArg2:0,constant:0xffffffff,transformFlags:0,texCoordIndex:0}]}};
  software.clear([0,0,0,1],1);software.draw(draw);
  cases.push({draw:{...draw,vertices:Array.from(draw.vertices)},pixels:Array.from(software.present().pixels)});
 }
 for(const source of [4,5,6]){
  const draw={...cases[source].draw,vertices:new Uint8Array(cases[source].draw.vertices),vertexShader:new Uint32Array(vs),pixelShader:new Uint32Array(ps)};
  const view=new DataView(draw.vertices.buffer);
  for(let vertex=0;vertex<3;vertex++)for(let channel=0;channel<4;channel++)view.setFloat32(vertex*32+16+channel*4,channel===3?.5:vertex===channel?1:0,true);
  draw.state={...draw.state,blend:true,srcblend:5,dstblend:6};
  software.clear([0,0,0,1],1);software.draw(draw);
  cases.push({draw:{...draw,vertices:Array.from(draw.vertices),vertexShader:vs,pixelShader:ps},pixels:Array.from(software.present().pixels),tolerance:1});
 }
 for(const sprite of [false,true]){
  const vertexShader=[...vs.slice(0,-1),1,0xe00f0000,0x90e40000,1,0xc0010002,0x90ff0005,0xffff];
  const pixelShader=[0xffff0101,64,0xb00f0000,1,0x800f0000,0xb0e40000,0xffff];
  const vertices=new Float32Array([[2.4,2.4,.2],[6.4,2.4,.8],[2.4,6.4,2]].flatMap(([x,y,size])=>[x/8-1,1-y/8,.5,1,1,0,0,size]));
  const draw={...cases[2].draw,vertices:new Uint8Array(vertices.buffer),vertexShader:new Uint32Array(vertexShader),pixelShader:new Uint32Array(pixelShader),
   state:{fillMode:1,cull:1,zenable:false,pointSize:0,pointSizeMin:0,pointSizeMax:16,pointSprite:sprite}};
  software.clear([0,0,0,1],1);software.draw(draw);
  cases.push({draw:{...draw,vertices:Array.from(draw.vertices),vertexShader,pixelShader},pixels:Array.from(software.present().pixels),tolerance:1});
 }
 for(const transformed of [false,true]){
  const source=cases[23].draw,identity=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
  const vertices=new Float32Array([[2.4,2.4],[14.4,2.4],[2.4,14.4]].flatMap(([x,y])=>[transformed?x:x/8-1,transformed?y:1-y/8,.5,1,1,0,0,1]));
  const draw={...source,vertices:new Uint8Array(vertices.buffer),attributes:source.attributes.map(a=>({...a,usage:a.usage===9&&!transformed?0:a.usage})),
   fixedFunction:{...source.fixedFunction,world:identity,view:identity,projection:identity},
   state:{fillMode:1,cull:1,zenable:false,pointScale:true,pointSize:.2,pointSizeMin:0,pointSizeMax:16,pointScaleA:1,pointScaleB:2,pointScaleC:3}};
  software.clear([0,0,0,1],1);software.draw(draw);
  assert.strictEqual(new Uint32Array(software.present().pixels.buffer).filter(v=>v===0xffff0000).length,transformed?0:3,'attenuation changes subpixel coverage; POSITIONT ignores scaling');
  cases.push({draw:{...draw,vertices:Array.from(draw.vertices)},pixels:Array.from(software.present().pixels)});
 }
 for(const [transformed,scale] of [[false,false],[true,false],[false,true]]){
  const source=cases[23].draw,identity=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
  const vertices=new Float32Array([[2.4,2.4,.2],[6.4,2.4,1],[2.4,6.4,2]].flatMap(([x,y,size])=>[transformed?x:x/8-1,transformed?y:1-y/8,.5,1,1,0,0,1,size]));
  const draw={...source,stride:36,vertices:new Uint8Array(vertices.buffer),attributes:[
   {register:0,usage:transformed?9:0,usageIndex:0,type:3,offset:0},{register:5,usage:10,usageIndex:0,type:3,offset:16},
   {register:4,usage:4,usageIndex:0,type:0,offset:32}],
   fixedFunction:{...source.fixedFunction,world:identity,view:identity,projection:identity},
   state:{fillMode:1,cull:1,zenable:false,pointSize:0,pointSizeMin:0,pointSizeMax:16,pointScale:scale,pointScaleA:1,pointScaleB:2,pointScaleC:3}};
  software.clear([0,0,0,1],1);software.draw(draw);
  assert.strictEqual(new Uint32Array(software.present().pixels.buffer).filter(v=>v===0xffff0000).length,scale?3:2,'pervertex attenuation uses PSIZE rather than POINTSIZE=0');
  cases.push({draw:{...draw,vertices:Array.from(draw.vertices)},pixels:Array.from(software.present().pixels)});
 }
 software.destroy();
 const browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-first-run','--no-default-browser-check']});
 try{
  const page=await browser.newPage();page.on('console',message=>console.error('browser:',message.text()));
  for(const f of ['gpu-backend.js','d3d9-shader.js','render-clear.js','d3d9-backend.js'])await page.addScriptTag({path:path.join(__dirname,'../lib',f)});
  const results=await page.evaluate(cases=>{
   const canvas=document.createElement('canvas');canvas.width=canvas.height=16;const d=new D3D9Backend.Device(canvas,{webglVersion:2}),g=d.gpu,gl=g.gl;
   const result=[];
   for(const fixture of cases){const draw={...fixture.draw,vertices:new Uint8Array(fixture.draw.vertices),vertexShader:fixture.draw.vertexShader&&new Uint32Array(fixture.draw.vertexShader),pixelShader:fixture.draw.pixelShader&&new Uint32Array(fixture.draw.pixelShader)};
    if(draw.fixedFunction)for(const key of ['world','view','projection'])draw.fixedFunction[key]=new Float32Array(Object.values(draw.fixedFunction[key]));
    d.clear([0,0,0,1],1);d.draw(draw);const rgba=g.readPixels(0,0,16,16,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(1024)),bgra=[];
    for(let y=0;y<16;y++)for(let x=0;x<16;x++){const p=((15-y)*16+x)*4;bgra.push(rgba[p+2],rgba[p+1],rgba[p],rgba[p+3]);}
    result.push(bgra);
   }
   const large=new Float32Array(65536*8);large.set([-.75,.75,.5,1,1,0,0,1],0);large.set([.75,.75,.5,1,1,0,0,1],8);large.set([-.75,-.75,.5,1,1,0,0,1],65535*8);
   const solid={...cases[0].draw,vertices:new Uint8Array(large.buffer),vertexShader:new Uint32Array(cases[0].draw.vertexShader),pixelShader:new Uint32Array(cases[0].draw.pixelShader),indices:new Uint16Array([0,1,65535]),state:{fillMode:3,cull:1,zenable:false}};
   d.clear([0,0,0,1],1);d.draw(solid);
   const sentinel=Array.from(g.readPixels(4,11,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4)));
   d.destroy();return {result,sentinel};
  },cases);
  assert.deepStrictEqual(results.sentinel,[255,0,0,255],'INDEX16 vertex65535 is not primitive restart; solid draw restores divisor state');
  results.result.forEach((pixels,i)=>{
   if(i===6||cases[i].tolerance)pixels.forEach((v,n)=>assert(Math.abs(v-cases[i].pixels[n])<=1,'native/GPU interpolation case '+i+' pixel '+n+': GPU '+pixels.slice(n&~3,(n&~3)+4)+' native '+cases[i].pixels.slice(n&~3,(n&~3)+4)));
   else assert.deepStrictEqual(pixels,cases[i].pixels,'native/GPU outline case '+i);
  });
  console.log('PASS actual native/GPU outline pixels: original edges, LASTPIXEL, points, cull and clip-cap suppression');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
