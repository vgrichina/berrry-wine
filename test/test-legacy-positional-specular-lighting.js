#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const specular=require('./test-legacy-public-specular-lighting');
const bootstrap=require('./test-legacy-generated-normal-reflection-projected');
const ROOT=path.resolve(__dirname,'..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];

// Independent transcription of retained DX7 imover_6muc equation images,
// imover_31us attenuation and imover_04h0 cone equations. No producer helpers.
// Rigid transforms only; no alpha, default-state or nonuniform-scale contract.
function oracle(s,i){
  const unit=v=>{const d=Math.hypot(...v);return d?v.map(x=>x/d):[0,0,0];};
  const dot=(a,b)=>a.reduce((r,x,j)=>r+x*b[j],0);
  const transform=(v,m,w)=>[0,1,2].map(j=>v.reduce((r,x,k)=>r+x*m[k*4+j],w*m[12+j]));
  const world=transform(s.positions[i],s.world,1),camera=transform(world,s.view,1);
  let normal=transform(s.normals[i],s.world,0);if(s.normalize)normal=unit(normal);
  normal=transform(normal,s.view,0);
  const ray=s.position.map((x,j)=>x-world[j]),distance=Math.hypot(...ray),light=unit(ray);
  const eye=s.local?unit(camera.map(x=>-x)):[0,0,-1];
  const halfway=unit(transform(light,s.view,0).map((x,j)=>x+eye[j]));
  const reflect=Math.max(0,Math.min(1,dot(normal,halfway)))**s.power;
  const denominator=s.attenuation[0]+s.attenuation[1]*distance+s.attenuation[2]*distance**2;
  assert(denominator>0,'fixture excludes undefined attenuation denominator');
  let angular=1;
  if(s.type===2){
    const rho=-dot(light,unit(s.direction)),inner=Math.cos(s.theta/2),outer=Math.cos(s.phi/2);
    angular=rho<=outer?0:rho>=inner?1:((rho-outer)/(inner-outer))**s.falloff;
  }
  const attenuation=distance>s.range?0:angular/denominator;
  const factor=s.enabled&&s.specular&&s.power>0?reflect*attenuation:0;
  let color=s.material.slice(8,11);
  if(s.colorvertex&&s.selector===1)color=[[1,0,0],[0,1,0],[0,0,1]][i];
  if(s.colorvertex&&s.selector===2)color=[[0,1,0],[0,0,1],[1,0,0]][i];
  return {position:camera,distance,angular,attenuation,reflect,
    rgb:color.map((x,j)=>255*Math.max(0,Math.min(1,x*s.lightSpecular[j]*factor)))};
}
function plan(){
  const base={...specular.plan()[0],type:1,label:'point displaced orthogonal',position:[1,0,0],
    positions:[[0,0,2],[3,0,4],[0,4,3]],normals:[[0,0,-1],[.6,0,-.8],[0,0,-1]],
    attenuation:[1,0,0],range:100};
  const axial={...base,position:[0,0,0],positions:[[0,0,2],[0,0,4],[0,0,6]],normals:[[0,0,-1],[0,0,-1],[0,0,-1]]};
  const spot={...base,type:2,position:[0,0,0],direction:[0,0,1],positions:[[0,0,5],[3,0,4],[4,0,2]],
    normals:[[0,0,-1],[0,0,-1],[0,0,-1]],theta:2*Math.acos(.9),phi:2*Math.acos(.7)};
  const cases=[base,
    {...base,label:'point displaced local',local:1},
    {...base,label:'point moved light',position:[-2,1,-1]},
    {...base,label:'point constant attenuation',attenuation:[3,0,0]},
    {...axial,label:'point linear attenuation',attenuation:[0,1,0]},
    {...axial,label:'point quadratic attenuation',attenuation:[1,0,.25]},
    {...axial,label:'point mixed attenuation',attenuation:[1,.25,.125]},
    {...axial,label:'point range inside equal outside',range:4},
    {...base,label:'point ignores axis',direction:[1,0,0]},
    {...spot,label:'spot inner penumbra outside orthogonal'},
    {...spot,label:'spot inner penumbra outside local',local:1},
    {...spot,label:'spot falloff squared',falloff:2},
    {...spot,label:'spot distance times angular',attenuation:[1,.2,.04]},
    {...spot,label:'spot moved position',position:[1,1,0],positions:[[1,1,5],[4,1,4],[5,1,2]]},
    {...spot,label:'spot oblique axis',direction:[.6,0,.8]},
    {...spot,label:'spot range inside equal outside',positions:[[0,0,3],[3,0,4],[0,0,6]],range:5},
    {...base,label:'point rigid world local',local:1,world:[0,1,0,0,-1,0,0,0,0,0,1,0,1,0,1,1]},
    {...base,label:'point rigid view orthogonal',view:[0,0,1,0,0,1,0,0,-1,0,0,0,0,0,4,1]},
    {...base,label:'point rigid view local',local:1,view:[0,0,1,0,0,1,0,0,-1,0,0,0,0,0,4,1]},
    {...spot,label:'spot rigid world and view local',local:1,
      world:[0,1,0,0,-1,0,0,0,0,0,1,0,1,0,1,1],
      view:[0,1,0,0,-1,0,0,0,0,0,1,0,0,0,2,1],position:[1,0,1]},
    {...base,label:'point COLOR1 specular',colorvertex:1,selector:1},
    {...spot,label:'spot COLOR2 specular',colorvertex:1,selector:2},
    {...base,label:'point highlights disabled',specular:0},
    {...spot,label:'spot light disabled',enabled:0},
    {...base,label:'point power zero',power:0},
    {...base,label:'point power four',power:4},
    {...base,label:'point normalize normals',normalize:1,normals:[[0,0,-.5],[.3,0,-.4],[0,0,-2]]},
    {...spot,label:'spot fractional power',power:.5},
    {...spot,label:'spot material floats before packing',lightSpecular:[1000,1000,1000,0],
      material:[0,0,0,1,0,0,0,1,.0005,.00075,.00025,1,0,0,0,1,2]}
  ];
  return cases.map(s=>({...s,material:s.material.map((x,i)=>i===16?s.power:x)}));
}
function expectedRecord(s,i){
  const b=new Uint8Array(s.dst.size),v=new DataView(b.buffer),[x,y,z]=oracle(s,i).position;
  [35+16*x/z,21-8*y/z,.5,1/(2*z)].forEach((x,c)=>v.setFloat32(c*4,x,true));
  const [r,g,blue]=oracle(s,i).rgb.map(Math.round);v.setUint32(20,((r<<16)|(g<<8)|blue)>>>0,true);
  return Array.from(b);
}
async function run(modulePath,states){
  const routes=new Map([['/legacy-render.wasm',fs.readFileSync(modulePath)],['/test/binaries/calc.exe',fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'))],['/lib/host-import-sigs.generated.json',fs.readFileSync(path.join(ROOT,'lib/host-import-sigs.generated.json'))]]);
  const context=vm.createContext({WebAssembly,performance,setTimeout,sourceRecord:specular.sourceRecord,expectedRecord,
    fetch:async url=>{assert(routes.has(url));const b=routes.get(url);return {arrayBuffer:async()=>Uint8Array.from(b).buffer,json:async()=>JSON.parse(b)};},
    document:{createElement:()=>({style:{},getContext:()=>({putImageData(){}})}),body:{append(){}}},ImageData:class{}});
  const prepared=states.map(s=>({...s,expectedRGB:s.expectedRGB||[0,1,2].map(i=>oracle(s,i).rgb)}));
  try{return await vm.runInContext('('+specular.fixtureSource()+')',context)('software',{...bootstrap.config(),queued:false,states:prepared,update:null},'()=>[]',null);}
  catch(e){e.partial=context.legacyTextureEvidence;throw e;}
}
function controls(){return [
  ['position',0,s=>s.position=[-2,1,-1]],['local-viewer',1,s=>s.local=0],
  ['constant',3,s=>s.attenuation[0]=1],['linear',4,s=>s.attenuation[1]=.25],
  ['quadratic',5,s=>s.attenuation[2]=0],['range',7,s=>s.range=100],
  ['spot-direction',9,s=>s.direction=[.6,0,.8]],['theta',9,s=>s.theta=2*Math.acos(.8)],
  ['phi',9,s=>s.phi=2*Math.acos(.5)],['falloff',11,s=>s.falloff=1],
  ['spot-type',9,s=>s.type=1],['spot-distance',12,s=>s.attenuation=[1,0,0]],
  ['spot-range',15,s=>s.range=100],['world',16,s=>s.world=identity()],
  ['view',17,s=>s.view=identity()],['material-source',20,s=>s.selector=2],
  ['light-color',0,s=>s.lightSpecular=[0,0,0,0]],['light-enable',0,s=>s.enabled=0],
  ['specular-enable',22,s=>s.specular=1],['power-zero',0,s=>{s.power=0;s.material[16]=0;}],
  ['power',0,s=>{s.power=4;s.material[16]=4;}],['normal',0,s=>s.normals[0]=[1,0,0]]
];}
async function main(){
  const dir=process.env.LEGACY_POSITIONAL_SPECULAR_EVIDENCE;if(dir)fs.mkdirSync(dir,{recursive:true});
  const save=(name,data)=>{if(dir)fs.writeFileSync(path.join(dir,name),JSON.stringify(data));};
  save('plan.json',plan().map(s=>({...s,oracle:[0,1,2].map(i=>oracle(s,i))})));const results=[];
  for(const name of ['wine-assembly.wasm','wine-assembly.compat.wasm']){
    const modulePath=path.join(ROOT,'build',name),sha256=hash(fs.readFileSync(modulePath));
    try{const r=await run(modulePath,plan());save(name+'.json',r);results.push({name,sha256,cases:r.outputs.length,stackCalls:r.calls.filter(c=>c.stackGuards).length});console.log('PASS public positional specular ProcessVertices/Lock',JSON.stringify(results.at(-1)));}
    catch(e){save('failure-'+name+'.json',{error:String(e),sha256,partial:e.partial});throw e;}
    for(const [label,index,change] of controls()){
      const s=structuredClone(plan()[index]);s.expectedRGB=[0,1,2].map(i=>oracle(s,i).rgb);change(s);let failure;
      try{await run(modulePath,[s]);}catch(e){failure=e;}
      assert.match(String(failure),/SPECULAR RGB ORACLE/,'state control '+label);
      assert(failure.partial.calls.some(c=>c.label==='ProcessVertices7'&&c.result===0));
      assert(failure.partial.outputs[0].sourceAfter,'control completed source/Unlock/Release checks');
      save('control-'+name+'-'+label+'.json',{error:String(failure),partial:failure.partial});
      console.log('PASS successful public state control rejected',name,label);
    }
  }
  save('result.json',{status:'POSITIONAL_SPECULAR_RGB_PASS_NO_PRODUCTION_DEFECT',results,controlsPerModule:controls().length,alphaContract:'unasserted'});
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={oracle,plan,expectedRecord,run,controls};
