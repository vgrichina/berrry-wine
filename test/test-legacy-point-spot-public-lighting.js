#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const publicFixture=require('./test-legacy-supported-computed-lighting');
const bootstrap=require('./test-legacy-generated-normal-reflection-projected');
const ROOT=path.resolve(__dirname,'..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');

// Reuse public x86 COM/guard mechanics, never a producer lighting helper.
// The literal RGB tables below are independently audited from SDK equations.
function plan(){
  const base={op:0x401,src:publicFixture.layout('XYZ',true,0xc0,[]),dst:publicFixture.layout('XYZRHW',false,0x40,[]),
    enabled:1,ambient:0,colorvertex:0,selectors:[0,0,0],
    material:[1,1,1,1, 1,1,1,1, 0,0,0,0, 0,0,0,1, 0],
    positions:[[0,0,1],[0,0,3],[0,0,9]],normals:[[0,0,-1],[0,0,-1],[0,0,-1]],
    type:1,position:[0,0,0],direction:[0,0,1],range:10,falloff:1,attenuation:[1,0,0],theta:2*Math.acos(.9),phi:2*Math.acos(.7),
    lightDiffuse:[.79,0,0,0],lightAmbient:[0,.79,0,0]};
  const gray=values=>values.map(v=>[v,v,0]);
  const cases=[
    {...base,label:'point constant',attenuation:[3,0,0],rgb:gray([67,67,67])},
    {...base,label:'point linear distance',attenuation:[0,1,0],rgb:gray([201,67,22])},
    {...base,label:'point constant plus linear',attenuation:[2,1,0],rgb:gray([67,40,18])},
    {...base,label:'point quadratic',positions:[[0,0,1],[0,0,2],[0,0,4]],attenuation:[1,0,2],rgb:gray([67,22,6])},
    {...base,label:'point range equal inside outside',range:3,attenuation:[0,1,0],rgb:gray([201,67,0])},
    {...base,label:'directional ignores position range attenuation',type:3,direction:[0,0,1],position:[77,88,99],range:.25,attenuation:[3,7,11],rgb:gray([201,201,201])},
    {...base,label:'point COLOR1 diffuse COLOR2 ambient',colorvertex:1,selectors:[1,2,0],attenuation:[0,1,0],
      rgb:[[201,201,0],[0,0,0],[0,0,0]]},
    {...base,label:'point COLOR2 diffuse COLOR1 ambient',colorvertex:1,selectors:[2,1,0],attenuation:[0,1,0],
      rgb:[[0,0,0],[0,67,0],[22,0,0]]}
  ];
  const spot={...base,type:2,positions:[[0,0,5],[3,0,4],[4,0,2]],lightDiffuse:[0,.73,0,0],lightAmbient:[.801,0,0,0]};
  cases.push({...spot,label:'spot inner penumbra outside',rgb:[[204,186,0],[102,74,0],[0,0,0]]},
    {...spot,label:'spot falloff squared',falloff:2,rgb:[[204,186,0],[51,37,0],[0,0,0]]},
    {...spot,label:'spot distance times cone',lightDiffuse:[0,.71,0,0],attenuation:[3,0,0],rgb:[[68,60,0],[34,24,0],[0,0,0]]},
    {...spot,label:'spot range exclusion',range:4,rgb:[[0,0,0],[0,0,0],[0,0,0]]});
  return cases;
}
function sourceRecord(state,i){
  const b=new Uint8Array(state.src.size),v=new DataView(b.buffer);
  state.positions[i].forEach((x,c)=>v.setFloat32(c*4,x,true));
  state.normals[i].forEach((x,c)=>v.setFloat32(12+c*4,x,true));
  v.setUint32(24,[0xffff0000,0xff00ff00,0xff0000ff][i],true);
  v.setUint32(28,[0xff00ff00,0xff0000ff,0xffff0000][i],true);
  return Array.from(b);
}
function expectedRecord(state,i){
  const b=new Uint8Array(state.dst.size),v=new DataView(b.buffer),[x,y,z]=state.positions[i];
  [35+16*x/z,21-8*y/z,.5,1/(2*z)].forEach((x,c)=>v.setFloat32(c*4,x,true));
  const [r,g,blue]=state.rgb[i];v.setUint32(16,((r<<16)|(g<<8)|blue)>>>0,true);
  return Array.from(b);
}
function fixtureSource(){
  let s=publicFixture.fixtureSource();
  const replace=(a,b)=>{assert.equal(s.split(a).length,2,'public fixture seam '+a);s=s.replace(a,b);};
  // Exact shipped pure math import implementations (lib/host-imports.js).
  // The Wasm producer still owns all lighting/attenuation/color arithmetic.
  replace('  let e,raw,link,manager,port,lastStats,gpu,holding=false,heldRecord;',
    '  host.math_cos=Math.cos;host.math_pow=Math.pow;\n  let e,raw,link,manager,port,lastStats,gpu,holding=false,heldRecord;');
  replace('[0,1,0,0,-1,0,0,0,0,0,1,0,.125,-.25,.125,1]','[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]');
  replace('[1,0,0,0,0,1,0,0,0,0,1,0,-.125,.25,-.125,1]','[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]');
  replace('const light=[3,...[...state.lightDiffuse,0,0,0,0,...state.lightAmbient,0,0,0,0,0,direction,100,1,1,0,0,0,0].map(bits)];',
    'const light=[state.type,...[...state.lightDiffuse,0,0,0,0,...state.lightAmbient,...state.position,...state.direction,state.range,state.falloff,...state.attenuation,state.theta,state.phi].map(bits)];');
  // A negative still completes all source, geometry and destination guards.
  // Defer only RGB disagreement until after public Unlock/Release checks.
  replace("      eq(actual[i],expected[i],'LIGHTING RGB/GEOMETRY ORACLE '+state.label+' byte '+i);",
    "      if(relative>=0&&relative<3*state.dst.size&&relative%state.dst.size>=16){if(actual[i]!==expected[i])row.oracleFailure='LIGHTING RGB/GEOMETRY ORACLE '+state.label+' byte '+i;}else eq(actual[i],expected[i],'geometry/destination guard byte '+i);");
  replace("    await com('Release source',source,2);await com('Release destination',destination,2);",
    "    await com('Release source',source,2);await com('Release destination',destination,2);\n    if(row.oracleFailure)throw Error(row.oracleFailure);");
  return s;
}
async function run(modulePath,states){
  const routes=new Map([['/legacy-render.wasm',fs.readFileSync(modulePath)],['/test/binaries/calc.exe',fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'))],['/lib/host-import-sigs.generated.json',fs.readFileSync(path.join(ROOT,'lib/host-import-sigs.generated.json'))]]);
  const context=vm.createContext({WebAssembly,performance,setTimeout,sourceRecord,expectedRecord,fetch:async url=>{assert(routes.has(url));const b=routes.get(url);return {arrayBuffer:async()=>Uint8Array.from(b).buffer,json:async()=>JSON.parse(b)};},document:{createElement:()=>({style:{},getContext:()=>({putImageData(){}})}),body:{append(){}}},ImageData:class{}});
  try{return await vm.runInContext('('+fixtureSource()+')',context)('software',{...bootstrap.config(),queued:false,states,update:null},'()=>[]',null);}
  catch(e){e.partial=context.legacyTextureEvidence;throw e;}
}
// Each control succeeds through public Set/Get and ProcessVertices, but must
// fail the original, unchanged RGB oracle. Controls run on BOTH shipped modules.
function controls(){return [
  ['type',1,s=>s.type=3],['position',1,s=>s.position=[0,0,-2]],
  ['range',4,s=>s.range=10],['constant',0,s=>s.attenuation[0]=1],
  ['linear',1,s=>s.attenuation[1]=3],['quadratic',3,s=>s.attenuation[2]=0],
  ['direction',8,s=>s.direction=[0,0,-1]],
  ['theta',8,s=>s.theta=2*Math.acos(.8)],['phi',8,s=>s.phi=2*Math.acos(.5)],
  ['falloff',9,s=>s.falloff=1],['spot-type',8,s=>s.type=1],
  ['diffuse-source',6,s=>s.selectors[0]=2],['ambient-source',6,s=>s.selectors[1]=1],
  ['diffuse-light',1,s=>s.lightDiffuse=[0,0,0,0]],['ambient-light',1,s=>s.lightAmbient=[0,0,0,0]],
  ['enabled',1,s=>s.enabled=0],['spot-range',11,s=>s.range=6]
];}
async function main(){
  const dir=process.env.LEGACY_POINT_SPOT_EVIDENCE;if(dir)fs.mkdirSync(dir,{recursive:true});
  const save=(name,data)=>{if(dir)fs.writeFileSync(path.join(dir,name),JSON.stringify(data));};
  const results=[];save('plan.json',plan());
  for(const name of ['wine-assembly.wasm','wine-assembly.compat.wasm']){
    const modulePath=path.join(ROOT,'build',name),sha256=hash(fs.readFileSync(modulePath));
    try{const r=await run(modulePath,plan());save(name+'.json',r);results.push({name,sha256,cases:r.outputs.length,calls:r.calls.filter(c=>c.stackGuards).length});console.log('PASS public point/spot ProcessVertices/Lock',JSON.stringify(results.at(-1)));}
    catch(e){save('failure-'+name+'.json',{error:String(e),sha256,partial:e.partial});throw e;}
    for(const [negative,index,change] of controls()){
      const state=structuredClone(plan()[index]);change(state);let failure;
      try{await run(modulePath,[state]);}catch(e){failure=e;}
      assert.match(String(failure),/LIGHTING RGB\/GEOMETRY ORACLE/);assert(failure.partial.calls.some(c=>c.label==='ProcessVertices7'&&c.result===0));
      save('negative-'+name+'-'+negative+'.json',{error:String(failure),partial:failure.partial});console.log('PASS rejected successful public input control',name,negative);
    }
  }
  save('result.json',{status:'POINT_SPOT_RGB_PASS_ALPHA_CONTRACT_OPEN',results,controlsPerModule:controls().length});
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={plan,sourceRecord,expectedRecord,fixtureSource,run,controls};
