(function(root){
 'use strict';
 const f=a=>new Float32Array(a),identity=()=>f([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
 function draw(){
  const vertices=new Float32Array(3*15);
  [[-1,1,.5],[3,1,.5],[-1,-3,.5]].forEach((p,i)=>vertices.set([...p,0,0,1,.5,.25,.125,.75,.25,.5,.75,.25,0],i*15));
  return {primitive:4,primitiveCount:1,stride:60,vertices:new Uint8Array(vertices.buffer),vertexShader:null,pixelShader:null,textures:[],
   attributes:[{register:0,usage:0,usageIndex:0,type:2,offset:0},{register:3,usage:3,usageIndex:0,type:2,offset:12},
    {register:5,usage:10,usageIndex:0,type:3,offset:24},{register:6,usage:10,usageIndex:1,type:3,offset:40}],
   state:{zenable:false,cull:1},fixedFunction:{lighting:true,specular:false,fog:false,colorVertex:true,diffuseMaterialSource:0,
    ambientMaterialSource:0,emissiveMaterialSource:0,ambientColor:0,normalizeNormals:false,
    world:identity(),view:identity(),projection:identity(),textureFactor:0xffffffff,
    material:{diffuse:f([.5,.25,.125,.75]),ambient:f([0,0,0,0]),emissive:f([0,0,0,0]),specular:f([0,0,0,0]),power:0},
    lights:[{type:3,diffuse:f([1,1,1,0]),ambient:f([0,0,0,0]),direction:f([0,0,-1])}],
    stages:[{colorOp:2,colorArg1:0,colorArg2:1,alphaOp:2,alphaArg1:0,alphaArg2:1,texCoordIndex:0,transformFlags:0,constant:0xffffffff},{colorOp:1}]}};
 }
 function cases(){const out=[];const add=(name,edit,expected)=>{const d=draw();edit(d,d.fixedFunction);out.push({name,draw:d,expected});};
  add('front directional',()=>{},[128,64,32,191]);
  add('back directional',(d,s)=>s.lights[0].direction[2]=1,[0,0,0,191]);
  add('perpendicular',(d,s)=>s.lights[0].direction=f([1,0,0]),[0,0,0,191]);
  for(const normalize of[false,true])add('normal length '+normalize,(d,s)=>{s.normalizeNormals=normalize;const v=new Float32Array(d.vertices.buffer);for(let i=0;i<3;i++)v[i*15+5]=.5;},normalize?[128,64,32,191]:[64,32,16,191]);
  add('light direction normalized',(d,s)=>s.lights[0].direction[2]=-7,[128,64,32,191]);
  add('global ambient and emissive',(d,s)=>{s.lights=[];s.ambientColor=0xff804020;s.material.ambient=f([.5,1,1,0]);s.material.emissive=f([.125,.125,.125,0]);},[96,96,64,191]);
  // No NORMAL element: D3D9 reads N as zero, so the directional light adds
  // nothing and only the ambient and emissive sums reach the vertex.
  add('missing NORMAL lights as zero',(d,s)=>{d.attributes=d.attributes.filter(a=>a.usage!==3);s.ambientColor=0xff804020;s.material.ambient=f([.5,1,1,0]);s.material.emissive=f([.125,.125,.125,0]);},[96,96,64,191]);
  add('light ambient',(d,s)=>{s.lights[0].diffuse.fill(0);s.lights[0].ambient=f([.25,.5,.75,1]);s.material.ambient=f([.5,.5,.5,0]);},[32,64,96,191]);
  add('eight lights',(d,s)=>{s.lights=Array.from({length:8},()=>({type:3,direction:f([0,0,-1]),diffuse:f([.125,.125,.125,1]),ambient:f([0,0,0,0])}));},[128,64,32,191]);
  for(const source of[0,1,2])add('diffuse source '+source,(d,s)=>{s.diffuseMaterialSource=source;s.material.diffuse=f([1,0,0,.5]);},[[255,0,0,128],[128,64,32,191],[64,128,191,64]][source]);
  add('COLORVERTEX off',(d,s)=>{s.diffuseMaterialSource=2;s.colorVertex=false;},[128,64,32,191]);
  add('missing COLOR2 falls back',(d,s)=>{s.diffuseMaterialSource=2;d.attributes=d.attributes.filter(a=>a.register!==6);},[128,64,32,191]);
  add('ambient COLOR2',(d,s)=>{s.lights=[];s.ambientColor=0xffffffff;s.ambientMaterialSource=2;},[64,128,191,191]);
  add('emissive COLOR1',(d,s)=>{s.lights=[];s.emissiveMaterialSource=1;},[128,64,32,191]);
  add('inverse transpose world',(d,s)=>{s.world[10]=2;s.projection[10]=.5;},[64,32,16,191]);
  add('inverse transpose normalized',(d,s)=>{s.world[10]=2;s.projection[10]=.5;s.normalizeNormals=true;},[128,64,32,191]);
  for(const length of[0,1e-30,1e30])add('degenerate direction '+length,(d,s)=>s.lights[0].direction[2]=length,[0,0,0,191]);
  // Point and spot lights (DLT1 ABI2). The light sits 10000 units up +z, so
  // its vector is the directional case's to within f32 noise at every vertex
  // and attenuation, range and the cone are what move the colour.
  const point=(extra={})=>({type:1,diffuse:f([1,1,1,0]),ambient:f([0,0,0,0]),position:f([0,0,1e4]),direction:f([0,0,0]),
   range:1e6,attenuation0:1,attenuation1:0,attenuation2:0,falloff:1,theta:0,phi:0,...extra});
  const spot=(alpha,extra={})=>point({type:2,direction:f([Math.sin(alpha),0,-Math.cos(alpha)]),theta:.2,phi:.6,...extra});
  add('point unattenuated',(d,s)=>s.lights=[point()],[128,64,32,191]);
  add('point constant attenuation',(d,s)=>s.lights=[point({attenuation0:2})],[64,32,16,191]);
  add('point quadratic attenuation',(d,s)=>s.lights=[point({attenuation0:0,attenuation2:4e-8})],[32,16,8,191]);
  add('point all-zero attenuation reads as 1',(d,s)=>s.lights=[point({attenuation0:0})],[128,64,32,191]);
  add('point out of range',(d,s)=>s.lights=[point({range:10})],[0,0,0,191]);
  add('point behind the surface',(d,s)=>s.lights=[point({position:f([0,0,-1e4])})],[0,0,0,191]);
  add('point ambient is attenuated',(d,s)=>{s.lights=[point({attenuation0:2,diffuse:f([0,0,0,0]),ambient:f([.25,.5,.75,1])})];s.material.ambient=f([.5,.5,.5,0]);},[16,32,48,191]);
  add('spot inside the inner cone',(d,s)=>s.lights=[spot(0)],[128,64,32,191]);
  add('spot pointing away',(d,s)=>s.lights=[spot(Math.PI)],[0,0,0,191]);
  add('spot outside the outer cone',(d,s)=>s.lights=[spot(.5)],[0,0,0,191]);
  // rho=cos(.2) between cos(.1) and cos(.3): t=(rho-cos .3)/(cos .1-cos .3)=.6236.
  add('spot penumbra falloff 1',(d,s)=>s.lights=[spot(.2)],[80,40,20,191]);
  add('spot penumbra falloff 2',(d,s)=>s.lights=[spot(.2,{falloff:2})],[50,25,12,191]);
  add('spot penumbra falloff 0',(d,s)=>s.lights=[spot(.2,{falloff:0})],[128,64,32,191]);
  // Specular (DLT1 ABI3 + cascade6). N=(0,0,1), COLOR1=(.25,.5,.75,.25) is the
  // default specular material source; its alpha never participates.
  const lit=(s,extra={})=>{s.specular=true;s.lights.forEach(l=>l.specular=f([1,1,1,1]));Object.assign(s,extra);};
  add('specular front directional',(d,s)=>lit(s,{localViewer:false}),[191,191,223,191]);
  add('specular back directional',(d,s)=>{s.lights[0].direction[2]=1;lit(s);},[0,0,0,191]);
  // L at 1 rad from N: H at .5 rad, (cos .5)^8 = .3518; diffuse cos 1 = .5403.
  add('specular power 8 half vector',(d,s)=>{s.lights[0].direction=f([-Math.sin(1),0,-Math.cos(1)]);s.material.power=8;lit(s,{localViewer:false});},[91,79,85,191]);
  add('specular local viewer power 0',(d,s)=>lit(s,{localViewer:true}),[191,191,223,191]);
  add('specular material source',(d,s)=>{s.material.specular=f([.25,.25,.25,1]);lit(s,{specularMaterialSource:0});},[191,128,96,191]);
  add('specular point light',(d,s)=>{s.lights=[point()];lit(s);},[191,191,223,191]);
  add('specular disabled reads zero',(d,s)=>Object.assign(s.stages[0],{colorArg1:4}),[0,0,0,191]);
  add('unlit specular add',(d,s)=>{s.lighting=false;s.specular=true;},[191,191,223,191]);
  add('unlit D3DTA_SPECULAR',(d,s)=>{s.lighting=false;Object.assign(s.stages[0],{colorArg1:4});},[64,128,191,191]);
  add('eight mixed lights',(d,s)=>s.lights=Array.from({length:8},(_,i)=>i%2?spot(0,{diffuse:f([.125,.125,.125,1])}):
   point({diffuse:f([.125,.125,.125,1])})),[128,64,32,191]);
  return out;
 }
 const api={draw,cases};if(typeof module!=='undefined')module.exports=api;else root.D3D9LightingCases=api;
})(typeof globalThis!=='undefined'?globalThis:this);
