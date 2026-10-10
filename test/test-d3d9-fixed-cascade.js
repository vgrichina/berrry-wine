'use strict';
const assert=require('assert');
const {bootRenderHarness}=require('./render-helper');
const {Device}=require('../lib/d3d9-software-backend');
(async()=>{
 const {exports:e,memory}=await bootRenderHarness({fonts:'none'});
 let compiled=0,freed=0,maxInstructions=0,legacyChecked=false;const live=new Set();
 const native={...e,d3d_fixed_compile_cascade5(...args){const p=e.d3d_fixed_compile_cascade5(...args)>>>0;
  if(p){compiled++;live.add(p);const d=new Uint32Array(memory.buffer,p,8);
   for(const slot of [1,2])if(d[slot]){const count=new Uint32Array(memory.buffer,d[slot],8)[4];assert(count<=128);maxInstructions=Math.max(maxInstructions,count);}
   if(!legacyChecked){
    const original=new Uint32Array(memory.buffer,args[1],args[2]*40),saved=original.slice();
    // Compact in the caller-owned table, compare old/new native IR, restore
    // before returning. The old export must not read the appended ARG0s.
    for(let row=0;row<args[2];row++)original.set(saved.subarray(row*40,row*40+12),row*12);
    const old=e.d3d_fixed_compile_cascade(...args)>>>0;original.set(saved);assert(old,'legacy 48-byte table still compiles');
    try{const bundle=new Uint32Array(memory.buffer,old,8);
     for(const slot of [1,2]){const count=new Uint32Array(memory.buffer,d[slot],8)[4];
      assert.deepStrictEqual(new Uint8Array(memory.buffer,bundle[slot],32+count*128),new Uint8Array(memory.buffer,d[slot],32+count*128),'old table lowering matches new defaults');}
    }finally{e.d3d_fixed_free(old);}
    for(let row=0;row<args[2];row++)original.set(saved.subarray(row*40,row*40+14),row*14);
    const v2=e.d3d_fixed_compile_cascade2(...args)>>>0;original.set(saved);assert(v2,'legacy56 table still compiles');e.d3d_fixed_free(v2);
    for(let row=0;row<args[2];row++)original.set(saved.subarray(row*40,row*40+32),row*32);
    const v3=e.d3d_fixed_compile_cascade3(...args)>>>0;original.set(saved);assert(v3,'legacy128 table still compiles');e.d3d_fixed_free(v3);
    for(let row=0;row<args[2];row++)original.set(saved.subarray(row*40,row*40+34),row*34);
    const v4=e.d3d_fixed_compile_cascade4(...args)>>>0;original.set(saved);assert(v4,'legacy136 table still compiles');e.d3d_fixed_free(v4);legacyChecked=true;
   }
   if(d[2]){const ir=new Uint32Array(memory.buffer,d[2],8),n=ir[4];maxInstructions=Math.max(maxInstructions,n);assert(n<=128,'cascade IR remains within owned instruction arena');
    const packets=new Uint32Array(memory.buffer,d[4]+16,new Uint32Array(memory.buffer,d[4],4)[2]*16);
    if(packets.some((word,i)=>i%16===0&&(word===33||word===34))){
     for(let i=0;i<packets.length;i+=16)if(packets[i]===34)assert(packets[i+3]&8,'fixed TEXBEML private packet marker');
     const flags=ir[7];ir[7]=0;const plain=e.d3d_shader_vm_compile(d[2]);ir[7]=flags;
     if(!(d[5]&48))assert(plain,'low-stage unmarked IR keeps programmable TEXBEM(L)');
     else assert.strictEqual(plain,0,'high-stage TEXBEM(L) requires fixed-origin IR');
     if(plain){try{const p=new Uint32Array(memory.buffer,plain+16,new Uint32Array(memory.buffer,plain,4)[2]*16);
       for(let i=0;i<p.length;i+=16)if(p[i]===34)assert.strictEqual(p[i+3]&8,0,'unmarked IR cannot activate fixed luminance');
      }finally{e.d3d_shader_vm_free(plain);}}
    }
    if(d[5]&32){const flags=ir[7];ir[7]=0;const unmarked=e.d3d_shader_vm_compile(d[2]);ir[7]=flags;
     if(unmarked)e.d3d_shader_vm_free(unmarked);assert.strictEqual(unmarked,0,'six samplers require private fixed-origin IR, never relaxed guest profile');}}}return p;},
  d3d_fixed_free(p){assert(live.delete(p),'one bundle retirement');freed++;e.d3d_fixed_free(p);}};
 const d=new Device({getExports:()=>native,getMemory:()=>memory.buffer,width:4,height:4,fixedCacheBytes:0});
 const identity=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
 const stage=(overrides={})=>({colorOp:2,colorArg1:2,colorArg2:1,alphaOp:2,alphaArg1:2,alphaArg2:1,
  constant:0xff010203,transformFlags:0,texCoordIndex:0,...overrides});
 const texture=(pixels=[50,60,70,80])=>({width:pixels.length/4,height:1,pixels:new Uint8Array(pixels),sampler:{min:1,mag:1,mip:0,addressU:3,addressV:3}});
 function draw(stages,textures=[]){
  const vertices=new Uint8Array(3*64),v=new DataView(vertices.buffer);
  [[-1,1],[1,1],[-1,-1]].forEach(([x,y],i)=>{
   [x,y,.5].forEach((n,j)=>v.setFloat32(i*64+j*4,n,true));vertices.set([128,96,64,192],i*64+12);
   for(let t=0;t<6;t++){v.setFloat32(i*64+16+t*8,t===0?.25:.75,true);v.setFloat32(i*64+20+t*8,.5,true);}
  });
  return {primitive:4,primitiveCount:1,stride:64,vertices,vertexShader:null,pixelShader:null,
   attributes:[{register:0,usage:0,usageIndex:0,type:2,offset:0},{register:5,usage:10,usageIndex:0,type:4,offset:12},
    ...Array.from({length:6},(_,t)=>({register:7+t,usage:5,usageIndex:t,type:1,offset:16+t*8}))],
   state:{zenable:false,cull:1},textures,fixedFunction:{lighting:false,fog:false,specular:false,alphaTest:false,
    textureFactor:0xffabcdef,world:identity,view:identity,projection:identity,stages}};
 }
 const base=d.bytes;
 function run(source,expected,label){d.clear([0,0,0,1],1);assert.strictEqual(d.draw(source),1,label);
  const bgra=d.present().pixels,actual=[bgra[2],bgra[1],bgra[0],bgra[3]];
  actual.forEach((v,i)=>assert(Math.abs(v-expected[i])<=1,`${label}: ${actual} != ${expected}`));
  assert.strictEqual(d.bytes,base,label+' retires allocations');assert.strictEqual(live.size,0);}
 const op=(m,a,b)=>m===2?a:m===3?b:m===4?a*b:m===5?2*a*b:m===6?4*a*b:m===7?a+b:m===8?a+b-.5:m===9?2*(a+b-.5):m===10?a-b:a+b-a*b;
 for(let mode=2;mode<=11;mode++){
  const source=draw([stage({colorArg1:0,alphaArg1:0}),stage({colorOp:mode,colorArg1:1,colorArg2:6,alphaOp:mode,alphaArg1:1,alphaArg2:6,constant:0xa0406080})]);
  const expected=[128,96,64,192].map((a,i)=>Math.round(Math.max(0,Math.min(1,op(mode,a/255,[64,96,128,160][i]/255)))*255));
  run(source,expected,'ordered CURRENT op'+mode);
 }
 run(draw([stage(),...Array.from({length:5},(_,i)=>stage({colorOp:7,colorArg1:1,colorArg2:6,alphaOp:7,alphaArg1:1,alphaArg2:6,constant:0x04010203,texCoordIndex:i+1}))],[texture()]),[55,70,85,100],'six constants and ordered stage chain');
 const split=texture([20,40,60,80,100,120,140,160]);
 run(draw([stage(),stage({colorOp:7,colorArg1:1,colorArg2:2,alphaOp:1,texCoordIndex:5})],[split,split]),[120,160,200,80],'sampler1 uses independent UV5 and alpha CURRENT');
 run(draw([stage({colorArg1:0,alphaArg1:0}),stage(),stage({colorOp:999})]),[128,96,64,192],'null texture terminates before invalid later stage');
 run(draw([stage({colorArg1:0,alphaArg1:0}),{colorOp:1},stage({colorOp:999})]),[128,96,64,192],'COLOROP DISABLE terminates');
 run(draw([stage({colorArg1:0,alphaArg1:0}),stage({colorArg1:1|32|16,alphaArg1:1})]),[63,63,63,192],'CURRENT alpha replication and complement');
 const worst=draw(Array.from({length:6},()=>stage({colorOp:11,colorArg1:0,colorArg2:6,alphaOp:11,alphaArg1:0,alphaArg2:6,constant:0x01010101})));
 run(worst,[128,96,65,192],'bounded maximum arithmetic stage expansion');
 for(const mode of [12,13,14,15,16])for(const modified of [false,true]){
  const tex=texture([128,96,64,128]),source=draw([
   stage({colorArg1:0,alphaArg1:6,constant:0x20404040}),
   stage({colorOp:mode,colorArg1:6|(modified?16:0),colorArg2:2|(modified?16:0),alphaOp:mode,alphaArg1:6,alphaArg2:2,constant:0x40402010})],[null,tex]);
  const factor=(mode===12?192:mode===14?255:mode===16?32:128)/255;
  const expected=[64,32,16,64].map((a,c)=>{
   let x=a/255,y=[128,96,64,128][c]/255;if(modified&&c<3){x=1-x;y=1-y;}
   return Math.round(Math.min(1,mode===15?x+y*(1-factor):x*factor+y*(1-factor))*255);
  });run(source,expected,'blend op'+mode+' modifiers'+modified);
 }
 for(const mode of [18,19,20,21])for(const modified of [false,true]){
  const source=draw([stage({colorArg1:0,alphaArg1:0}),stage({colorOp:mode,colorArg1:6|(modified?16:0),colorArg2:2,alphaOp:2,alphaArg1:2,constant:0x40204060})],[null,texture([128,96,64,128])]);
  const a=[32,64,96].map(v=>modified?1-v/255:v/255),b=[128,96,64].map(v=>v/255),alpha=modified?1-64/255:64/255;
  const expected=a.map((x,c)=>Math.round(Math.min(1,mode===18?x+alpha*b[c]:mode===19?x*b[c]+alpha:mode===20?x+(1-alpha)*b[c]:(1-x)*b[c]+alpha)*255));expected.push(128);
  run(source,expected,'color-only op'+mode);
  source.fixedFunction.stages[1].alphaOp=mode;const before=d.present().pixels;
  assert.throws(()=>d.draw(source),/D3D9 software/);assert.deepStrictEqual(d.present().pixels,before);assert.strictEqual(d.bytes,base);
 }
 for(const mode of [13,15]){
  const source=draw([stage({colorArg1:0,alphaArg1:0}),stage({colorOp:mode,colorArg1:6,colorArg2:1,alphaOp:mode,alphaArg1:6,alphaArg2:1,constant:0x80204060})],
   [null,texture([1,2,3,128])]);
  const factor=128/255,expected=[32,64,96,128].map((a,c)=>Math.round(Math.min(255,(mode===15?a:a*factor)+[128,96,64,192][c]*(1-factor))));
  run(source,expected,'texture alpha factor samples independently of arguments '+mode);
 }
 run(draw([stage({colorArg1:5,alphaArg1:5})]),[0,0,0,0],'TEMP initializes zero');
 run(draw([stage({colorArg1:6,alphaArg1:6,constant:0x40204060,resultArg:5}),stage({colorOp:7,colorArg1:1,colorArg2:5,alphaArg1:5})]),[160,160,160,64],'TEMP route preserves CURRENT');
 run(draw([stage({colorArg1:6,alphaArg1:6,constant:0x40204060,resultArg:5}),
  stage({colorArg1:5|32,alphaArg1:5,resultArg:5}),stage({colorArg1:5,alphaArg1:5})]),[64,64,64,64],'TEMP self-read sees pre-stage RGB and alpha');
 run(draw(Array.from({length:6},(_,i)=>stage({colorOp:11,colorArg1:2,colorArg2:6,alphaOp:11,alphaArg1:2,alphaArg2:6,constant:0x01010101,resultArg:i===5?1:5})),
  Array.from({length:6},()=>texture([128,96,64,192]))),[128,96,65,192],'maximum expansion with five TEMP destinations');
 assert(maxInstructions>64,'TEMP worst case exercises expanded instruction arena');
 for(const bad of [stage({colorArg1:0,resultArg:5}),stage({colorArg1:0,resultArg:0}),stage({colorArg1:0,resultArg:2}),
  stage({colorOp:13,colorArg1:6,colorArg2:1,alphaArg1:6}),stage({colorArg1:1,colorArg2:2,colorOp:7}),stage({transformFlags:1})]){
  const source=draw([bad],bad.transformFlags?[texture()]:[]);const before=d.present().pixels;
  assert.throws(()=>d.draw(source),/D3D9 software/);assert.deepStrictEqual(d.present().pixels,before);assert.strictEqual(d.bytes,base);assert.strictEqual(live.size,0);
 }
 for(const mode of [25,26])for(const modifier of [0,16,32,48]){
  const source=draw([stage({colorArg1:6,alphaArg1:6,constant:0x40204060,resultArg:5}),
   stage({colorOp:mode,colorArg0:2|modifier,colorArg1:5,colorArg2:1,alphaOp:mode,alphaArg0:2|modifier,alphaArg1:1,alphaArg2:5})],
   [null,texture([64,128,192,96])]);
  const expected=[32,64,96,64].map((v,c)=>{
   let zero=[64,128,192,96][modifier&32?3:c]/255;if(modifier&16)zero=1-zero;
   const a=(c===3?192:v)/255,b=(c===3?64:[128,96,64][c])/255;
   return Math.round(255*Math.min(1,mode===25?zero+a*b:zero*a+(1-zero)*b));
  });run(source,expected,'triadic '+mode+' ARG0-only texture and TEMP/CURRENT modifier '+modifier);
 }
 for(const mode of [25,26]){
  const source=draw([stage({colorOp:mode,colorArg1:0,colorArg2:6,alphaOp:mode,alphaArg1:0,alphaArg2:6,constant:0x40204060})]);
  const expected=[128,96,64,192].map((v,c)=>Math.round(255*Math.min(1,mode===25?v/255+v*[32,64,96,64][c]/65025:v*v/65025+(1-v/255)*[32,64,96,64][c]/255)));
  run(source,expected,'triadic default CURRENT ARG0 '+mode);
 }
 for(const mode of [27])for(const key of ['colorOp','alphaOp']){
  const bad=draw([stage({colorArg1:0,alphaArg1:0,[key]:mode})]);const before=d.present().pixels;
  assert.throws(()=>d.draw(bad),/D3D9 software/);assert.deepStrictEqual(d.present().pixels,before);assert.strictEqual(d.bytes,base);
 }
 for(const key of ['colorArg0','alphaArg0']){
  const bad=draw([stage({colorOp:25,colorArg1:0,colorArg2:1,alphaOp:26,alphaArg1:0,alphaArg2:1,[key]:64})]);
  const before=d.present().pixels;assert.throws(()=>d.draw(bad),/D3D9 software/);assert.deepStrictEqual(d.present().pixels,before);assert.strictEqual(d.bytes,base);
 }
 run(draw([stage({colorArg1:0,alphaArg1:0,colorArg0:999,alphaArg0:999})]),[128,96,64,192],'unused ARG0 ignored');
 // Signed-range contract from Microsoft D3DTEXTUREOP + source signed scaling:
 // https://learn.microsoft.com/en-us/windows/win32/direct3d9/d3dtextureop
 // https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx9-graphics-reference-asm-ps-registers-modifiers-signed-scale
 // Independent scalar oracle and ordinary programmable DP3 differential;
 // not evidence of native Windows driver precision or undefined behavior.
 const dotVectors=[[[255,255,255,17],[255,255,255,219]],[[0,0,0,43],[255,255,255,199]],
  [[160,192,224,61],[144,176,208,173]],[[255,128,128,83],[128,255,128,151]]];
 for(const [a,b]of dotVectors)for(const ma of [0,16,32,48])for(const mb of [0,16])for(const channels of ['rgb','a','both']){
  const source=draw([stage({colorOp:channels==='a'?2:24,colorArg1:channels==='a'?0:2|ma,colorArg2:0|mb,
   alphaOp:channels==='rgb'?2:24,alphaArg1:channels==='rgb'?2:2|ma,alphaArg2:0|mb})],[texture(a)]);
  for(let v=0;v<3;v++)source.vertices.set(b,v*64+12);
  const signed=(v,m,c)=>{let n=v[m&32?3:c]/255;if(m&16)n=1-n;return 2*n-1;};
  const dot=Math.max(0,Math.min(1,[0,1,2].reduce((sum,c)=>sum+signed(a,ma,c)*signed(b,mb,c),0))),q=Math.round(dot*255);
  const expected=channels==='rgb'?[q,q,q,a[3]]:channels==='a'?[...b.slice(0,3),q]:[q,q,q,q];
  run(source,expected,`DOT3 ${channels} modifiers ${ma}/${mb} vectors ${a}/${b}`);
  const fixedPixels=d.present().pixels;
  const src=(bank,modifier)=>(0x80000000|bank<<28|(modifier&32?255:228)<<16|(modifier&16?5:4)<<24)>>>0;
  source.pixelShader=new Uint32Array([0xffff0101,66,0xb00f0000,
   8,0x80170001,src(3,ma),src(1,mb),
   1,0x80070000,channels==='a'?0x90e40000:0x80e40001,
   1,0x80080000,channels==='rgb'?0xb0ff0000:0x80aa0001,0xffff]);
  run(source,expected,'ordinary programmable DP3 differential');
  assert.deepStrictEqual(d.present().pixels,fixedPixels,'fixed/programmable full-frame DOT3 parity');
 }
 run(draw([stage({colorOp:24,colorArg1:6,colorArg2:6,alphaArg1:6,constant:0x20404040,resultArg:5}),
  stage({colorArg1:5,alphaArg1:1})]),[190,190,190,192],'DOT3 TEMP routing preserves original CURRENT alpha');
 run(draw([stage({colorArg1:6,alphaArg1:6,constant:0x20404040,resultArg:5}),
  stage({colorOp:24,colorArg1:5,colorArg2:5,alphaOp:24,alphaArg1:5,alphaArg2:5,resultArg:5}),
  stage({colorArg1:5,alphaArg1:5})]),[190,190,190,190],'DOT3 RGB and alpha both read pre-stage TEMP RGB');
 const preTexture=[64,128,192,96],preCurrent=[128,96,64,192];
 for(const channels of ['rgb','a','both'])for(const modifier of [0,16,32,48])for(const bound of [false,true]){
  const pre=stage({colorOp:channels==='a'?2:17,colorArg1:0,colorArg2:999,alphaOp:channels==='rgb'?2:17,alphaArg1:0,alphaArg2:999});
  const next=stage({colorArg1:1|modifier,alphaArg1:1|modifier});
  const effective=preCurrent.map((v,c)=>v*(bound&&(c===3?channels!=='rgb':channels!=='a')?preTexture[c]/255:1));
  const expected=effective.map((v,c)=>{let value=modifier&32?effective[3]:v;return Math.round(modifier&16?255-value:value);});
  run(draw([pre,next],[null,bound?texture(preTexture):null]),expected,`PREMODULATE ${channels} modifier${modifier} bound${bound}`);
  run(draw([pre,next,stage({colorArg1:1,alphaArg1:1})],[null,bound?texture(preTexture):null,texture([1,2,3,4])]),expected,'PREMODULATE expires after immediately next stage');
 }
 run(draw([stage({colorOp:17,colorArg1:0,colorArg2:999,alphaOp:17,alphaArg1:0,alphaArg2:999})]),preCurrent,'PREMODULATE last stage returns ARG1 and ignores ARG2');
 run(draw([stage({colorOp:17,colorArg1:0,alphaOp:17,alphaArg1:0}),stage({colorArg1:1,alphaArg1:1,resultArg:5}),
  stage({colorArg1:1,alphaArg1:1})],[null,texture(preTexture)]),preCurrent,'premultiplied TEMP destination never mutates raw CURRENT');
 run(draw([stage({colorOp:17,colorArg1:0,alphaOp:17,alphaArg1:0}),stage({colorArg1:1,alphaArg1:1,resultArg:5}),
  stage({colorArg1:5,alphaArg1:5})],[null,texture(preTexture)]),preCurrent.map((v,c)=>Math.round(v*preTexture[c]/255)),'premultiplied result retained in TEMP');
 run(draw([stage({colorOp:17,colorArg1:0,alphaOp:17,alphaArg1:0}),
  stage({colorOp:25,colorArg0:1,colorArg1:6,colorArg2:0,alphaOp:25,alphaArg0:1,alphaArg1:6,alphaArg2:0,constant:0})],
  [null,texture(preTexture)]),preCurrent.map((v,c)=>Math.round(v*preTexture[c]/255)),'premodulated CURRENT also reaches triadic ARG0');
 run(draw([stage({colorArg1:0,alphaOp:17,alphaArg1:0}),
  stage({colorOp:16,colorArg1:6,colorArg2:0,alphaOp:1,constant:0x80204060})],[null,texture(preTexture)]),
  [32,64,96].map((v,c)=>Math.round(v*192/255+preCurrent[c]*(1-192/255))).concat(192),
  'implicit CURRENT alpha factor and disabled alpha preserve raw previous result');
 let bumpCases=0;
 for(const bumpStage of [0,1,3,4])for(const programmed of [false,true])for(const c of [
  {name:'u',du:127,dv:0,m:[.5,0,0,0,1,0],expected:[0,255,0,128]},
  {name:'crossU',du:0,dv:127,m:[0,0,.5,0,1,0],expected:[0,255,0,128]},
  {name:'crossV',du:127,dv:0,m:[0,.5,0,0,1,0],expected:[0,0,255,128]},
  {name:'negative',du:128,dv:0,m:[-.5,0,0,0,1,0],expected:[0,255,0,128]},
  {name:'luminance',du:127,dv:0,m:[.5,0,0,0,.5,.25],lum:128,expected:[0,128,0,128]},
  {name:'clampLow',du:127,dv:0,m:[.5,0,0,0,0,-1],lum:128,expected:[0,0,0,128]},
  {name:'clampHigh',du:127,dv:0,m:[.5,0,0,0,0,2],lum:128,expected:[0,255,0,128]},
 ]){
  const stages=Array.from({length:bumpStage},()=>stage({colorArg1:0,alphaArg1:0}));
  stages.push(stage({colorOp:c.lum===undefined?22:23,colorArg1:0,colorArg2:999,alphaArg1:6,constant:0x20404040}),stage());
  const textures=[];textures[bumpStage]={...texture([c.du,c.dv,c.lum??0,0]),format:62};
  textures[bumpStage+1]={...texture([255,0,0,128,0,255,0,128,0,0,255,128,255,255,255,128]),width:2,height:2};
  const source=draw(stages,textures),v=new DataView(source.vertices.buffer);
  for(let i=0;i<3;i++)v.setFloat32(i*64+20,.25,true);
  source.bumpStates=[];source.bumpStates[bumpStage]=new Float32Array(c.m);source.bumpStates[bumpStage+1]=new Float32Array(6);
  if(programmed){
   source.vertexShader=new Uint32Array([0xfffe0101,1,0xc00f0000,0x90e40000,1,0xd00f0000,0x90e40005,
    1,0xe00f0000|bumpStage,0x90e40007,1,0xe00f0000|(bumpStage+1),0x90e40007,0xffff]);
   stages.forEach((s,i)=>s.texCoordIndex=i);
  }
  run(source,c.expected,`fixed bump${bumpStage} programmed${programmed} ${c.name}`);bumpCases++;
  stages[bumpStage+1].colorOp=7;
  run(source,c.expected.map((n,i)=>i===3?n:Math.min(255,n+preCurrent[i])),'bump source stage preserves raw CURRENT color');
  stages[bumpStage+1].alphaArg1=1;run(source,c.expected.map((n,i)=>i===3?32:Math.min(255,n+preCurrent[i])),'bump alpha stage evaluated independently');
  for(const invalidAlpha of [22,23]){stages[bumpStage].alphaOp=invalidAlpha;const before=d.present().pixels;
   assert.throws(()=>d.draw(source),/D3D9 software/);assert.deepStrictEqual(d.present().pixels,before);assert.strictEqual(d.bytes,base);}
  stages[bumpStage].alphaOp=2;
  if(bumpStage===0&&c.lum!==undefined){
   const programmable=structuredClone(source);
   programmable.pixelShader=new Uint32Array([0xffff0101,66,0xb00f0000,68,0xb00f0001,0xb0e40000,1,0x800f0000,0xb0e40001,0xffff]);
   if(programmable.vertexShader)delete programmable.fixedFunction;
   programmable.bumpStates[1]=new Float32Array(c.m);
   const luminance=c.lum/255*c.m[4]+c.m[5];
   run(programmable,[0,255,0,128].map(v=>Math.round(Math.max(0,Math.min(255,v*luminance)))),
    'guest TEXBEML keeps RGBA/unclamped luminance before final framebuffer clamp');
  }
  for(const mutate of [s=>s.textures[bumpStage].format=0,s=>s.bumpStates[bumpStage][0]=NaN,
   s=>s.textures[bumpStage+1].faces=[],s=>s.fixedFunction.stages[bumpStage+1].transformFlags=259]){
   const bad=structuredClone(source);mutate(bad);const before=d.present().pixels;
   assert.throws(()=>d.draw(bad),/D3D9 software/);assert.deepStrictEqual(d.present().pixels,before);assert.strictEqual(d.bytes,base);assert.strictEqual(live.size,0);
  }
 }
 const faceColors=[[255,0,0,255],[0,255,0,255],[0,0,255,255],[255,255,0,255],[0,255,255,255],[255,0,255,255]];
 const directions=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
 const cube={width:1,height:1,faces:faceColors.map(color=>texture(color)),sampler:{min:1,mag:1,mip:0,addressU:3,addressV:3}};
 for(const sampled of [0,1,5])for(const programmed of [false,true])for(let face=0;face<6;face++){
  const stages=Array.from({length:sampled+1},(_,i)=>stage(i===sampled?{texCoordIndex:programmed?sampled:0}:{colorArg1:0,alphaArg1:0}));
  const textures=[];textures[sampled]=cube;const source=draw(stages,textures);
  source.stride=48;source.vertices=new Uint8Array(3*48);const f=new Float32Array(source.vertices.buffer);
  [[-1,1,.5,1],[1,1,.5,1],[-1,-1,.5,1]].forEach((pos,i)=>f.set([...pos,1,1,1,1,...directions[face],1],i*12));
  source.attributes=[{register:0,usage:0,usageIndex:0,type:3,offset:0},{register:1,usage:10,usageIndex:0,type:3,offset:16},{register:2,usage:5,usageIndex:0,type:3,offset:32}];
  if(programmed)source.vertexShader=new Uint32Array([0xfffe0101,1,0xc00f0000,0x90e40000,1,0xd00f0000,0x90e40001,1,0xe00f0000|sampled,0x90e40002,0xffff]);
  run(source,faceColors[face],`cube full XYZ stage${sampled} programmed${programmed} face${face}`);
 }
 const striped=texture([255,0,0,255,0,255,0,255]);
 for(let sampled=0;sampled<6;sampled++)for(const count of [2,3,4]){
  const matrix=identity.slice();matrix[8]=.5;
  const stages=Array.from({length:sampled},()=>stage({colorArg1:0,alphaArg1:0}));
  stages.push(stage({transformFlags:count,transform:matrix}));const textures=[];textures[sampled]=striped;
  const source=draw(stages,textures);
  run(source,[0,255,0,255],`FLOAT2 native _31 translation stage${sampled} COUNT${count}`);
  stages[sampled].transformFlags=0;
  run(source,[255,0,0,255],'untransformed draw following transformed draw has no stale matrix');
 }
 function projected(count,q=[1,4,1],u=[.2,3.2,.2],sampled=0){
  const stages=Array.from({length:sampled},()=>stage({colorArg1:0,alphaArg1:0}));stages.push(stage({transformFlags:256|count,transform:identity.slice()}));
  const textures=[];textures[sampled]=striped;const source=draw(stages,textures);
  source.attributes=source.attributes.slice(0,3);source.attributes[2]={...source.attributes[2],type:3};
  const values=new DataView(source.vertices.buffer);
  for(let v=0;v<3;v++)[u[v],.25,count===3?q[v]:1,count===4?q[v]:1].forEach((n,c)=>values.setFloat32(v*64+16+c*4,n,true));
  return source;
 }
 for(const count of [3,4]){
  for(let sampled=0;sampled<6;sampled++){
   run(projected(count,undefined,undefined,sampled),[255,0,0,255],`projected stage${sampled} COUNT${count}`);
   assert.deepStrictEqual([...d.present().pixels.slice(20,24)],[0,255,0,255],'high-stage postinterpolation projection');
  }
  const source=projected(count);run(source,[255,0,0,255],`projected COUNT${count}`);
  const pixel=d.present().pixels.slice((1*4+1)*4,(1*4+1)*4+4);
  assert.deepStrictEqual([...pixel],[0,255,0,255],'division after interpolation, not per-vertex division');
  source.fixedFunction.stages[0].transformFlags=count;
  run(source,[255,0,0,255],'projection cleared on subsequent unprojected draw');
  for(const divisor of [0,-0,Infinity,NaN,1e-40])
   run(projected(count,[divisor,divisor,divisor],[1,1,1]),[0,0,0,0],`invalid projected divisor ${divisor} COUNT${count}`);
  run(projected(count,[-1,-1,-1],[-.75,-.75,-.75]),[0,255,0,255],'negative finite projected divisor');
 }
 for(const version of [0xffff0101,0xffff0102,0xffff0103])for(const count of [3,4]){
  const ps=new Uint32Array([version,66,0xb00f0000,1,0x800f0000,0xb0e40000,0xffff]);
  const s=projected(count);s.pixelShader=ps;run(s,[255,0,0,255],'mixed projected TEX '+version+' COUNT'+count);
  assert.deepStrictEqual([...d.present().pixels.slice(20,24)],[0,255,0,255],'mixed division is postinterpolation');
  const defined=projected(count);defined.pixelShader=new Uint32Array([version,81,0xa00f0000,0x3f800000,0x3f800000,0x3f800000,0x3f800000,66,0xb00f0000,5,0x800f0000,0xb0e40000,0xa0e40000,0xffff]);
  run(defined,[255,0,0,255],'projected stage0 does not mistake DEFc0 for a texture destination');
  for(const sampled of [1,2,3]){const high=projected(count,undefined,undefined,sampled);
   high.pixelShader=new Uint32Array([version,66,(0xb00f0000+sampled)>>>0,1,0x800f0000,(0xb0e40000+sampled)>>>0,0xffff]);
   run(high,[255,0,0,255],'mixed projected sampler'+sampled);
   assert.deepStrictEqual([...d.present().pixels.slice(20,24)],[0,255,0,255],'high mixed sampler postinterpolation');}
  for(const q of [0,-0,Infinity,NaN,1e-40]){const bad=projected(count,[q,q,q],[1,1,1]);bad.pixelShader=ps;
   run(bad,[0,0,0,0],'mixed projected invalid Q '+q);}
  const negative=projected(count,[-1,-1,-1],[-.75,-.75,-.75]);negative.pixelShader=ps;
  run(negative,[0,255,0,255],'mixed negative Q stays valid');
  negative.pixelShader=new Uint32Array([version,65,0xb00f0000,66,0xb00f0000,1,0x800f0000,0xb0e40000,0xffff]);
  run(negative,[0,0,0,255],'TEXKILL sees original negative X before projected sampling');
  negative.pixelShader=new Uint32Array([version,66,0xb00f0000,65,0xb00f0000,1,0x800f0000,0xb0e40000,0xffff]);
  run(negative,[0,0,0,255],'TEXKILL after TEX still sees original coordinates');
  const other=projected(count);other.textures[1]=striped;other.fixedFunction.stages.push(stage({texCoordIndex:0}));
  other.pixelShader=new Uint32Array([version,66,0xb00f0000,64,0xb00f0001,1,0x800f0000,0xb0e40000,0xffff]);
  run(other,[255,0,0,255],'unprojected TEXCOORD destination remains allowed');
  if(version!==0xffff0101){other.pixelShader=new Uint32Array([version,66,0xb00f0000,69,0xb00f0001,0xb0e40000,1,0x800f0000,0xb0e40000,0xffff]);
   run(other,[255,0,0,255],'unprojected dependent destination remains allowed');}
  for(const opcode of [64,69]){const bad=projected(count,undefined,undefined,opcode===64?0:1);bad.pixelShader=new Uint32Array(opcode===64?[version,64,0xb00f0000,1,0x800f0000,0xb0e40000,0xffff]:[0xffff0102,66,0xb00f0000,69,0xb00f0001,0xb0e40000,1,0x800f0000,0xb0e40001,0xffff]);
   assert.throws(()=>d.draw(bad),/projected TEXCOORD\/dependent/);assert.strictEqual(d.bytes,base);}
  s.fixedFunction.stages[0].transformFlags=count;run(s,[255,0,0,255],'mixed unprojected rebind clears metadata');
 }
 const prepared=d.prepare(projected(3)),ctx=prepared.context,vm=new Uint32Array(memory.buffer,ctx+148,1)[0],sampler=vm+57376;
 const samplerWords=new Uint32Array(memory.buffer,sampler,12);
 assert.strictEqual(samplerWords[10],3,'prepared projection retained in copied sampler');
 assert.strictEqual(e.d3d_shader_vm_bind_projection(vm,0,2),0);assert.strictEqual(samplerWords[10],3,'invalid projection bind is atomic');
 assert.strictEqual(e.d3d_shader_vm_bind_projection(vm,6,3),0);
 const mip=samplerWords[9];assert(mip,'real adapter uses mip descriptor');
 assert.strictEqual(e.d3d_shader_vm_bind_texture_mips(vm,0,mip),1);assert.strictEqual(samplerWords[10],0,'mip rebind clears projection');
 assert.strictEqual(e.d3d_shader_vm_bind_projection(vm,0,4),1);
 assert.strictEqual(e.d3d_shader_vm_bind_texture(vm,0,sampler),1);assert.strictEqual(samplerWords[10],0,'legacy rebind clears projection');
 assert.strictEqual(e.d3d_software_bind_projection(ctx,0,3),1);
 e.d3d_software_step(ctx,1);assert.strictEqual(e.d3d_software_bind_projection(ctx,0,0),0,'projection cannot change after raster starts');
 d.cancel();assert.strictEqual(d.bytes,base);assert.strictEqual(live.size,0);
 const positionT=projected(3,[1,1,1],[.25,.25,.25]);positionT.fixedFunction.stages[0].transformFlags=2;
 positionT.fixedFunction.stages[0].transform[12]=.5;
 positionT.attributes[0]={...positionT.attributes[0],usage:9,type:3};
 const pt=new DataView(positionT.vertices.buffer);
 [[0,0],[4,0],[0,4]].forEach(([x,y],v)=>[x,y,.5,1].forEach((n,c)=>pt.setFloat32(v*64+c*4,n,true)));
 // PositionT needs diffuse moved out of the now-four-component position.
 positionT.attributes[1]={...positionT.attributes[1],offset:32};for(let v=0;v<3;v++)positionT.vertices.set([255,255,255,255],v*64+32);
 run(positionT,[255,0,0,255],'POSITIONT bypasses texture matrix');
 const camera=draw([stage({texCoordIndex:0x20000,transformFlags:2,transform:identity.slice()})],[striped]);
 camera.attributes=camera.attributes.filter(a=>a.usage!==5);
 camera.fixedFunction.world=identity.slice();camera.fixedFunction.world[0]=2;
 camera.fixedFunction.view=identity.slice();camera.fixedFunction.view[12]=1;
 camera.fixedFunction.projection=identity.slice();camera.fixedFunction.projection[0]=.5;camera.fixedFunction.projection[12]=-.5;
 camera.fixedFunction.stages[0].transform[0]=.25;camera.fixedFunction.stages[0].transform[12]=.9;
 run(camera,[0,255,0,255],'camera-position generation uses world/view without input UV');
 for(const generated of [false,true]){
  const stages=Array.from({length:6},(_,i)=>{const matrix=identity.slice();
   if(generated){matrix[0]=matrix[5]=0;matrix[12]=i%2?.75:.25;matrix[13]=.25;}else matrix[8]=i%2?.5:0;
   return stage({colorOp:i?7:2,colorArg1:2,colorArg2:1,alphaOp:i?7:2,alphaArg1:2,alphaArg2:1,
    texCoordIndex:generated?0x20000:0,transformFlags:2,transform:matrix});});
  const source=draw(stages,Array.from({length:6},()=>texture([1,2,3,4,2,3,4,5])));
  if(generated)source.attributes=source.attributes.filter(a=>a.usage!==5);
  run(source,[9,15,21,27],'six simultaneous independent texture matrices, camera generation '+generated);
 }
 function normalDraw(normal=[.75,0,2],reflection=false){
  const source=draw([stage({texCoordIndex:reflection?0x30000:0x10000})],[striped]);
  source.attributes=source.attributes.filter(a=>a.usage!==5);
  source.attributes.push({register:3,usage:3,usageIndex:0,type:2,offset:16});
  const bytes=new DataView(source.vertices.buffer);
  for(let i=0;i<3;i++)normal.forEach((value,c)=>bytes.setFloat32(i*64+16+c*4,value,true));
  return source;
 }
 run(normalDraw(),[0,255,0,255],'camera NORMAL retains unnormalized magnitude');
 {const s=normalDraw();s.pixelShader=new Uint32Array([0xffff0101,66,0xb00f0000,1,0x800f0000,0xb0e40000,0xffff]);
  run(s,[0,255,0,255],'camera NORMAL fixed VS to real programmed PS1.1');}
 {const s=normalDraw();s.fixedFunction.normalizeNormals=true;run(s,[255,0,0,255],'camera NORMAL normalized after transformation');}
 {const s=normalDraw([.75,0,0]);s.fixedFunction.world=identity.slice();s.fixedFunction.world[0]=2;
  s.fixedFunction.projection=identity.slice();s.fixedFunction.projection[0]=.5;
  run(s,[255,0,0,255],'inverse transpose normal, not world normal multiply');}
 {const s=normalDraw([.4,0,0]);s.fixedFunction.world=identity.slice();s.fixedFunction.world[3]=.5;s.fixedFunction.world[12]=1;
  s.fixedFunction.projection=new Float32Array([2,0,0,-1,0,1,0,0,0,0,1,0,-2,0,0,2]);
  run(s,[0,255,0,255],'full4x4 inverse includes non-affine terms before upper3x3');}
 for(const value of [0,1e-30,1e30,Infinity,NaN]){const s=normalDraw([value,0,0]);s.fixedFunction.normalizeNormals=true;
  run(s,[255,0,0,255],'invalid/zero squared normal length deterministiczero '+value);}
 for(const localViewer of [true,false]){const s=normalDraw([0,0,1],true);
  s.fixedFunction.localViewer=localViewer;s.fixedFunction.view=identity.slice();s.fixedFunction.view[14]=10;
  s.fixedFunction.projection=identity.slice();s.fixedFunction.projection[14]=-10;
  s.textures=[{...texture(),faces:Array.from({length:6},(_,i)=>({...texture(i===5?[255,0,0,255]:[0,255,0,255])}))}];
  run(s,localViewer?[255,0,0,255]:[0,255,0,255],'camera reflection localViewer '+localViewer);}
 {const s=normalDraw([0,0,1],true);s.fixedFunction.normalizeNormals=true;
  s.fixedFunction.stages=Array.from({length:6},(_,i)=>{const transform=identity.slice();transform[0]=transform[5]=0;transform[12]=i%2?.75:.25;
   return stage({colorOp:i?7:2,colorArg2:1,alphaOp:i?7:2,alphaArg2:1,texCoordIndex:i%2?0x10000:0x30000,transformFlags:2,transform});});
  s.textures=Array.from({length:6},()=>texture([1,2,3,4,2,3,4,5]));
  run(s,[9,15,21,27],'six-stage shared normal/reflection caches with independent matrices');
  s.fixedFunction.fog=true;s.fixedFunction.fogVertexMode=3;s.fixedFunction.fogStart=0;s.fixedFunction.fogEnd=1;s.fixedFunction.fogColor=0;
  run(s,[5,8,11,27],'fog plus six-stage normal/reflection maximum lowering');}
 {const s=normalDraw([.75,0,0]);s.fixedFunction.stages.push(stage({texCoordIndex:5}));s.textures.push(striped);
  s.attributes.push({register:12,usage:5,usageIndex:5,type:1,offset:56});
  run(s,[0,255,0,255],'NORMAL input packing preserves separate highest UV slot');}
 {const bad=normalDraw();bad.fixedFunction.world=new Float32Array(16);const before=d.present().pixels;
  assert.throws(()=>d.draw(bad),/native fixed/);assert.deepStrictEqual(d.present().pixels,before);assert.strictEqual(d.bytes,base);}
 // Eleven live inputs: position/diffuse, six UVs, PSIZE, NORMAL, SPECULAR.
 {const stages=Array.from({length:6},(_,i)=>stage({colorOp:7,colorArg1:i?1:0,colorArg2:2,alphaOp:2,alphaArg1:i?1:0,texCoordIndex:i}));
  const s=draw(stages,Array.from({length:6},()=>texture([0,0,0,255,16,16,16,255]))),old=s.vertices;
  s.stride=96;s.vertices=new Uint8Array(288);for(let i=0;i<3;i++)s.vertices.set(old.subarray(i*64,i*64+64),i*96);
  s.attributes.push({register:3,usage:3,usageIndex:0,type:2,offset:64},{register:6,usage:10,usageIndex:1,type:4,offset:76},{register:4,usage:4,usageIndex:0,type:0,offset:80});
  const bytes=new DataView(s.vertices.buffer);for(let i=0;i<3;i++){[.5,1,.25].forEach((n,c)=>bytes.setFloat32(i*96+64+c*4,n,true));s.vertices.set([1,2,3,64],i*96+76);bytes.setFloat32(i*96+80,.5,true);}
  const tokens=[0xfffe0101,1,0xc00f0000,0x90e40000,1,0x800f0000,0x90e40005,5,0x800f0000,0x80e40000,0x90e40003,
   5,0x80070000,0x80e40000,0x90000004,1,0xd00f0000,0x80e40000,1,0xc00f0001,0x90ff0006,1,0xc00f0002,0x90000004];
  for(let i=0;i<6;i++)tokens.push(1,(0xe00f0000+i)>>>0,(0x90e40007+i)>>>0);tokens.push(0xffff);s.vertexShader=new Uint32Array(tokens);
  s.fixedFunction.fog=true;s.fixedFunction.fogColor=0xff0000ff;
  const prepared=d.prepare(s);assert.strictEqual(new Uint32Array(memory.buffer,prepared.context+4,1)[0],5);
  assert.strictEqual(new Uint32Array(memory.buffer,prepared.context+120,1)[0],11,'all eleven input lanes retained');d.cancel();
  run(s,[28,32,213,192],'full NORMAL/SPECULAR/PSIZE and six independent UV input packing');
  for(let t=0;t<6;t++){for(let i=0;i<3;i++)bytes.setFloat32(i*96+16+t*8,t===0?.75:.25,true);
   run(s,t===0?[32,36,217,192]:[24,28,209,192],'independent full-input UV'+t);
   for(let i=0;i<3;i++)bytes.setFloat32(i*96+16+t*8,t===0?.25:.75,true);}
  delete s.vertexShader;s.fixedFunction.fogVertexMode=0;s.fixedFunction.stages[0].texCoordIndex=0x10000;
  run(s,[56,48,231,192],'fixed camera NORMAL plus supplied SPECULAR fog and five independent UVs');
  for(let i=0;i<3;i++)bytes.setFloat32(i*96+64,.25,true);
  run(s,[52,44,227,192],'fixed normal remains independent of specular and highest UV inputs');
 }
 const fogDraw=()=>{const s=draw([stage({colorArg1:0,alphaArg1:0})]);s.fixedFunction.fog=true;
  s.fixedFunction.fogColor=0xff0000ff;s.fixedFunction.fogVertexMode=3;s.fixedFunction.fogStart=0;s.fixedFunction.fogEnd=1;return s;};
 const fogColor=factor=>[128*factor,96*factor,64*factor+255*(1-factor),192].map(Math.round);
 {const s=fogDraw();s.fogState={enabled:0,color:0xff0000ff,tableMode:0};
  run(s,[128,96,64,192],'shared disabled state overrides legacy fixed fog enable');
  s.fixedFunction.fog=false;s.fogState.enabled=1;run(s,fogColor(.5),'shared enabled state drives fixed vertex fog lowering');}
 // ps_1_4 too: Black & White 2's vine pass (ps_1_4 + vertex fog) latched the
 // queue on "programmed pixel fog requires PS1.1-1.3".
 for(const version of [0xffff0101,0xffff0102,0xffff0103,0xffff0104]){
  const s=fogDraw();delete s.fixedFunction;s.fogState={enabled:1,color:0xff0000ff,tableMode:0};
  s.vertexShader=new Uint32Array([0xfffe0101,1,0xc00f0000,0x90e40000,1,0xd00f0000,0x90e40005,1,0xc00f0001,0xa0e40000,0xffff]);
  s.vertexConstants=new Float32Array([.25,2,3,4]);s.pixelShader=new Uint32Array([version,1,0x800f0000,0x90e40000,0xffff]);
  run(s,fogColor(.25),'both-programmed raster fog '+version);
  s.state.alphaTest=true;s.state.alphaFunc=5;s.state.alphaRef=200;run(s,[0,0,0,255],'both-programmed fog respects alpha discard');
  s.state.alphaTest=false;s.state.blend=true;s.state.srcblend=5;s.state.dstblend=1;
  run(s,[24,18,156,145],'both-programmed fog precedes alpha framebuffer blend');
  s.state.blend=false;s.fogState.enabled=0;run(s,[128,96,64,192],'shared disabled fog state is authoritative');
  s.fogState.enabled=1;s.fogState.tableMode=4;assert.throws(()=>d.draw(s),/invalid raster fog/);s.fogState.tableMode=0;
  s.vertexShader=new Uint32Array([0xfffe0101,1,0xc00f0000,0x90e40000,1,0xd00f0000,0x90e40005,0xffff]);
  assert.throws(()=>d.draw(s),/requires oFog/);assert.strictEqual(d.bytes,base);
 }
 for(const mode of [1,2,3]){const s=fogDraw();s.fixedFunction.fogVertexMode=mode;s.fixedFunction.fogDensity=1;
  const expected=fogColor(mode===3?.5:Math.exp(mode===1?-.5:-.25));run(s,expected,'native vertex fog mode'+mode);
  for(const version of [0xffff0101,0xffff0102,0xffff0103]){s.pixelShader=new Uint32Array([version,1,0x800f0000,0x90e40000,0xffff]);
   run(s,expected,'native fixed VS fog after programmed PS '+version+' mode'+mode);}}
 for(const mode of [1,2,3])for(const programmed of [false,true]){const s=fogDraw();
  s.fogState={enabled:1,color:0xff0000ff,tableMode:mode,start:0,end:1,density:1,depthMode:0};
  s.fixedFunction.rangeFog=true;s.fixedFunction.fogVertexMode=99; // table precedence ignores vertex state
  if(programmed){delete s.fixedFunction;s.vertexShader=new Uint32Array([0xfffe0101,1,0xc00f0000,0x90e40000,1,0xd00f0000,0x90e40005,0xffff]);
   s.pixelShader=new Uint32Array([0xffff0103,1,0x800f0000,0x90e40000,0xffff]);}
  run(s,fogColor(mode===3?.5:Math.exp(mode===1?-.5:-.25)),'perpixel table mode'+mode+' programmed'+programmed);
  if(programmed)for(const version of [0xffff0101,0xffff0102]){s.pixelShader=new Uint32Array([version,1,0x800f0000,0x90e40000,0xffff]);
    run(s,fogColor(mode===3?.5:Math.exp(mode===1?-.5:-.25)),'table fog PS profile'+version);}
  s.fogState.depthMode=1;assert.throws(()=>d.draw(s),/WFOG is not advertised/);assert.strictEqual(d.bytes,base);
 }
 {const s=fogDraw();s.fogState={enabled:1,color:0xff0000ff,tableMode:3,start:0,end:1,density:1,depthMode:0};
  s.fixedFunction.projection=identity.slice();s.fixedFunction.projection[10]=.5;
  const bytes=new DataView(s.vertices.buffer);[.2,.8,1.4].forEach((z,i)=>bytes.setFloat32(i*64+8,z,true));
  run(s,fogColor(.9),'table fog uses device depth, not camera distance');
  assert.deepStrictEqual([...d.present().pixels.slice(20,24)],[126,65,86,192],'table factor computed after raster depth interpolation');
  s.fogState.start=s.fogState.end=1;const before=d.present().pixels;assert.throws(()=>d.draw(s),/bind_table_fog/);
  assert.deepStrictEqual(d.present().pixels,before);assert.strictEqual(d.bytes,base);}
 {const s=fogDraw();s.fogState={enabled:1,color:0xff0000ff,tableMode:3,start:0,end:1,density:1,depthMode:0};
  s.state.alphaTest=true;s.state.alphaFunc=5;s.state.alphaRef=200;run(s,[0,0,0,255],'table fog preserves alpha-test discard');
  s.state.alphaTest=false;s.state.blend=true;s.state.srcblend=5;s.state.dstblend=1;
  run(s,[48,36,120,145],'table fog precedes framebuffer alpha blending');
  s.pixelShader=new Uint32Array([0xffff0103,64,0xb00f0000,71,0xb00f0001,0xb0e40000,84,0xb00f0002,0xb0e40000,1,0x800f0000,0x90e40000,65535]);
  assert.throws(()=>d.draw(s),/shader-written depth/);assert.strictEqual(d.bytes,base);}
 {const s=fogDraw();s.fixedFunction.rangeFog=true;s.fixedFunction.fogVertexMode=1;
  run(s,fogColor(Math.exp(-1.5)),'range fog uses camera xyz length');}
 {const s=fogDraw();s.state.alphaTest=true;s.state.alphaFunc=5;s.state.alphaRef=200;
  run(s,[0,0,0,255],'fog does not revive alpha-test discarded pixels');s.state.alphaRef=100;
  run(s,fogColor(.5),'fog preserves accepted shader alpha');}
 {const s=fogDraw();s.state.blend=true;s.state.srcblend=5;s.state.dstblend=1;
  run(s,[48,36,120,145],'RGB fog occurs before framebuffer source-alpha blending');}
 {const s=fogDraw();s.fixedFunction.fogVertexMode=0;s.attributes.push({register:6,usage:10,usageIndex:1,type:4,offset:48});
  for(let i=0;i<3;i++)s.vertices.set([1,2,3,64],i*64+48);
  run(s,fogColor(64/255),'supplied specular alpha fog, RGB independent');}
 {const s=fogDraw();s.fixedFunction.fogVertexMode=0;run(s,[0,0,255,192],'missing supplied fog factor defaults zero');}
 {const s=fogDraw();s.vertexShader=new Uint32Array([0xfffe0101,1,0xc00f0000,0x90e40000,1,0xd00f0000,0x90e40005,1,0xc00f0001,0xa0e40000,0xffff]);
  s.vertexConstants=new Float32Array([.25,3,-7,NaN]);s.fixedFunction.fogVertexMode=2;
  run(s,fogColor(.25),'programmed VS oFog drives fixed PS post-fog independent of fog mode');
  s.vertexShader=new Uint32Array([0xfffe0101,1,0xc00f0000,0x90e40000,1,0xd00f0000,0x90e40005,0xffff]);
  assert.throws(()=>d.draw(s),/requires oFog/);assert.strictEqual(d.bytes,base);}
 {const s=fogDraw();s.attributes[0]={register:0,usage:9,usageIndex:0,type:3,offset:0};
  s.attributes[1]={...s.attributes[1],offset:32};s.attributes.push({register:6,usage:10,usageIndex:1,type:4,offset:48});
  const bytes=new DataView(s.vertices.buffer);[[0,0],[4,0],[0,4]].forEach(([x,y],i)=>{
   [x,y,.5,1].forEach((n,c)=>bytes.setFloat32(i*64+c*4,n,true));s.vertices.set([128,96,64,192],i*64+32);s.vertices.set([0,0,0,64],i*64+48);});
  run(s,fogColor(64/255),'POSITIONT supplied factor overrides calculated vertex mode');}
 {const s=fogDraw();s.fixedFunction.stages=Array.from({length:6},(_,i)=>stage({colorOp:i?7:2,alphaOp:i?7:2,texCoordIndex:i}));
  s.textures=Array.from({length:6},()=>texture([1,2,3,4]));run(s,[3,6,137,24],'fog preserves all six full UV outputs');}
 {const s=fogDraw();s.fixedFunction.projection=identity.slice();s.fixedFunction.projection[10]=.5;
  const bytes=new DataView(s.vertices.buffer);[.2,.8,1.4].forEach((z,i)=>bytes.setFloat32(i*64+8,z,true));
  run(s,fogColor(.8),'linear fog computed and clamped at vertices');
  const pixel=d.present().pixels.slice(20,24);assert.deepStrictEqual([...pixel],[169,43,58,192],'interpolate vertex factors, not fog of interpolated camera distance');
  s.fixedFunction.projection=identity;bytes.setFloat32(2*64+8,2.4,true);
  run(s,fogColor(.8),'far-plane clipping retains original fog factors');
  assert.deepStrictEqual([...d.present().pixels.slice(20,24)],[169,43,58,192],'clipped vertex fog interpolation');}
 {const s=fogDraw();s.fixedFunction.fogStart=s.fixedFunction.fogEnd=1;const before=d.present().pixels;
  assert.throws(()=>d.draw(s),/native fixed/);assert.deepStrictEqual(d.present().pixels,before);assert.strictEqual(d.bytes,base);}
 for(const mutation of [s=>s.fixedFunction.stages[0].texCoordIndex=0x40000,s=>s.fixedFunction.stages[0].transformFlags=257,
  s=>s.fixedFunction.stages[0].transform[0]=NaN]){
  const bad=structuredClone(camera);mutation(bad);const before=d.present().pixels;assert.throws(()=>d.draw(bad),/D3D9 software/);
  assert.deepStrictEqual(d.present().pixels,before);assert.strictEqual(d.bytes,base);
 }
 assert(legacyChecked);assert(compiled>=16);assert.strictEqual(compiled,freed);d.destroy();
 console.log(`PASS native fixed six-stage cascade: SIMD color ops2..26, DOT3 differential, PREMODULATE, ${bumpCases} bump cases, cube, COUNT2/3/4 matrices and projected3/4 all6stages, cameraPOS/NORMAL/reflection, rebind/lifetime, maximum ${maxInstructions} IR instructions`);
})().catch(error=>{console.error(error);process.exitCode=1;});
