#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const mechanics=require('./test-legacy-point-spot-public-lighting');
const publicFixture=require('./test-legacy-supported-computed-lighting');
const bootstrap=require('./test-legacy-generated-normal-reflection-projected');
const ROOT=path.resolve(__dirname,'..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];

// Independent DX7 imover_6muc image transcription: H=norm(norm(VC)-Ld),
// or norm((0,0,-1)-Ld); Rs=(N.H)^p; Sv=Vs*A*Rs*Ls.
// imref_49es explicitly makes p=0 disable highlights. Evaluate positive
// bases and clamp away-facing normals before exponentiation. No output-alpha
// contract, producer helper, or diffuse lighting expectation is used here.
function oracle(s,i){
  const transform=(v,m,w)=>[0,1,2].map(j=>v.reduce((a,x,k)=>a+x*m[k*4+j],w*m[12+j]));
  const unit=v=>{const n=Math.hypot(...v);return n?v.map(x=>x/n):[0,0,0];};
  const p=transform(transform(s.positions[i],s.world,1),s.view,1);
  let n=transform(transform(s.normals[i],s.world,0),s.view,0);
  if(s.normalize)n=unit(n);
  const l=unit(transform(s.direction.map(x=>-x),s.view,0));
  const eye=s.local?unit(p.map(x=>-x)):[0,0,-1];
  const h=unit(eye.map((x,j)=>x+l[j]));
  const d=Math.max(0,Math.min(1,n.reduce((a,x,j)=>a+x*h[j],0)));
  const reflect=s.specular&&s.enabled&&s.power>0?d**s.power:0;
  let color=s.material.slice(8,11);
  if(s.colorvertex&&s.selector===1&&(s.src.fvf&0x40))color=[[1,0,0],[0,1,0],[0,0,1]][i];
  if(s.colorvertex&&s.selector===2&&(s.src.fvf&0x80))color=[[0,1,0],[0,0,1],[1,0,0]][i];
  return {rgb:color.map((v,j)=>Math.max(0,Math.min(1,v*s.lightSpecular[j]*reflect))*255),position:p};
}
function plan(){
  const base={op:0x401,src:publicFixture.layout('XYZ',true,0xc0,[]),dst:publicFixture.layout('XYZRHW',false,0xc0,[]),
    enabled:1,ambient:0,colorvertex:0,selectors:[0,0,0],selector:0,specular:1,local:0,normalize:0,power:2,
    material:[0,0,0,1, 0,0,0,1, 1,1,1,1, 0,0,0,1, 2],
    lightDiffuse:[0,0,0,0],lightAmbient:[0,0,0,0],lightSpecular:[.79,.53,.31,0],
    positions:[[0,0,2],[1,0,2],[0,1,2]],normals:[[0,0,-1],[.6,0,-.8],[0,0,1]],
    type:3,position:[0,0,0],direction:[0,0,1],range:100,falloff:1,attenuation:[1,0,0],theta:0,phi:0,
    world:identity(),view:identity()};
  const cases=[
    {...base,label:'orthogonal power two facing oblique away'},
    {...base,label:'orthogonal power four',power:4},
    {...base,label:'local viewer varies per vertex',local:1},
    {...base,label:'power zero disables',power:0},
    {...base,label:'specular disabled',specular:0},
    {...base,label:'light disabled',enabled:0},
    {...base,label:'COLOR1 source',colorvertex:1,selector:1},
    {...base,label:'COLOR2 source',colorvertex:1,selector:2},
    {...base,label:'COLORVERTEX false ignores COLOR2',colorvertex:0,selector:2},
    {...base,label:'tangent and negative base even power',normals:[[1,0,0],[0,0,1],[0,0,-1]]},
    {...base,label:'unnormalized normals',normals:[[0,0,-.5],[0,0,-2],[0,0,-1]]},
    {...base,label:'normalize normals',normalize:1,normals:[[0,0,-.5],[0,0,-2],[0,0,-1]]},
    {...base,label:'rigid world rotation translation local',local:1,world:[0,1,0,0,-1,0,0,0,0,0,1,0,1,0,1,1]},
    {...base,label:'view rotation translation orthogonal',view:[0,0,1,0,0,1,0,0,-1,0,0,0,0,0,4,1]},
    {...base,label:'view rotation translation local',local:1,view:[0,0,1,0,0,1,0,0,-1,0,0,0,0,0,4,1]},
    {...base,label:'saturate specular',lightSpecular:[4,3,2,0]},
    ...[0,0x40,0x80].map(color=>({...base,label:'FVF color fields '+color,src:publicFixture.layout('XYZ',true,color,[])})),
    {...base,label:'fractional power',power:.5},
    {...base,label:'material specular channel product',material:[0,0,0,1, 0,0,0,1, 0,.5,1,1, 0,0,0,1, 2]},
    {...base,label:'direction normalization',direction:[0,0,7]},
    {...base,label:'material floats multiplied before byte conversion',lightSpecular:[1000,1000,1000,0],
      material:[0,0,0,1, 0,0,0,1, .0005,.00075,.00025,1, 0,0,0,1, 2]}
  ];
  return cases.map(s=>({...s,material:s.material.map((x,i)=>i===16?s.power:x)}));
}
function sourceRecord(s,i){
  const b=new Uint8Array(s.src.size),v=new DataView(b.buffer);
  s.positions[i].forEach((x,c)=>v.setFloat32(c*4,x,true));
  s.normals[i].forEach((x,c)=>v.setFloat32(12+c*4,x,true));
  if(s.src.offsets.diffuse!==undefined)v.setUint32(s.src.offsets.diffuse,[0xffff0000,0xff00ff00,0xff0000ff][i],true);
  if(s.src.offsets.specular!==undefined)v.setUint32(s.src.offsets.specular,[0xff00ff00,0xff0000ff,0xffff0000][i],true);
  return Array.from(b);
}
function expectedRecord(s,i){
  const b=new Uint8Array(s.dst.size),v=new DataView(b.buffer),o=oracle(s,i),[x,y,z]=o.position;
  [35+16*x/z,21-8*y/z,.5,1/(2*z)].forEach((x,c)=>v.setFloat32(c*4,x,true));
  const [r,g,blue]=o.rgb.map(Math.round);v.setUint32(20,((r<<16)|(g<<8)|blue)>>>0,true);
  return Array.from(b);
}
function fixtureSource(){
  let s=mechanics.fixtureSource();
  const replace=(a,b)=>{assert.equal(s.split(a).length,2,'specular fixture seam '+a);s=s.replace(a,b);};
  replace('...state.lightDiffuse,0,0,0,0,...state.lightAmbient','...state.lightDiffuse,...state.lightSpecular,...state.lightAmbient');
  replace('    const material=state.material.slice();',`    for(const [id,m] of [[1,state.world],[2,state.view]]){
      await words(matrix,m.map(bits));const before=await snapshot(matrix,64);
      await ok(com('SetTransform specular '+id,device,11,id,matrix));
      eq(await snapshot(matrix,64),before,'matrix input immutable');
      const got=await guard(64);await ok(com('GetTransform specular '+id,device,12,id,got.p));await got.check();
      eq(await snapshot(got.p,64),before,'matrix readback');
    }
    const material=state.material.slice();`);
  replace('[[139,state.ambient],[141,state.colorvertex]', '[[29,state.specular],[142,state.local],[143,state.normalize],[146,state.selector],[139,state.ambient],[141,state.colorvertex]');
  const a=s.indexOf('    row.observedAlpha=[];'),b=s.indexOf("    await ok(com('Unlock readback'",a);assert(a>0&&b>a);
  s=s.slice(0,a)+`    row.specularOracle=state.expectedRGB;
    for(let i=0;i<actual.length;i++){
      const relative=i-2*state.dst.size,inside=relative>=0&&relative<3*state.dst.size,offset=relative%state.dst.size;
      // Diffuse RGBA and specular/fog alpha are observations only.
      if(inside&&offset>=16){
        if(offset>=20&&offset<=22){
          const value=state.expectedRGB[Math.floor(relative/state.dst.size)][22-offset];
          // Primary equations specify real-valued RGB, not a byte rounding
          // rule. A one-byte envelope admits quantization, never black output.
          if(Math.abs(actual[i]-value)>1)row.oracleFailure='SPECULAR RGB ORACLE '+state.label+' byte '+i+' actual '+actual[i]+' expected '+value;
        }
      }else eq(actual[i],expected[i],'geometry/destination guard byte '+i);
    }
`+s.slice(b);
  return s;
}
async function run(modulePath,states){
  const routes=new Map([['/legacy-render.wasm',fs.readFileSync(modulePath)],['/test/binaries/calc.exe',fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'))],['/lib/host-import-sigs.generated.json',fs.readFileSync(path.join(ROOT,'lib/host-import-sigs.generated.json'))]]);
  const context=vm.createContext({WebAssembly,performance,setTimeout,sourceRecord,expectedRecord,fetch:async url=>{assert(routes.has(url));const b=routes.get(url);return {arrayBuffer:async()=>Uint8Array.from(b).buffer,json:async()=>JSON.parse(b)};},document:{createElement:()=>({style:{},getContext:()=>({putImageData(){}})}),body:{append(){}}},ImageData:class{}});
  const prepared=states.map(s=>({...s,expectedRGB:s.expectedRGB||[0,1,2].map(i=>oracle(s,i).rgb)}));
  try{return await vm.runInContext('('+fixtureSource()+')',context)('software',{...bootstrap.config(),queued:false,states:prepared,update:null},'()=>[]',null);}
  catch(e){e.partial=context.legacyTextureEvidence;throw e;}
}
function controls(){return [
  ['power',0,s=>{s.power=4;s.material[16]=4;}],['power-zero',0,s=>{s.power=0;s.material[16]=0;}],
  ['specular-disable',0,s=>s.specular=0],['specular-enable',4,s=>s.specular=1],
  ['local-viewer',2,s=>s.local=0],['specular-source',6,s=>s.selector=2],
  ['colorvertex',7,s=>s.colorvertex=0],['normalization',10,s=>s.normalize=1],
  ['light-color',0,s=>s.lightSpecular=[0,0,0,0]],['light-enable',0,s=>s.enabled=0],
  ['direction',0,s=>s.direction=[1,0,0]],['view',14,s=>s.view=identity()],['world',12,s=>s.world=identity()]
];}
async function main(){
  const dir=process.env.LEGACY_SPECULAR_EVIDENCE;if(dir)fs.mkdirSync(dir,{recursive:true});
  const save=(name,data)=>{if(dir)fs.writeFileSync(path.join(dir,name),JSON.stringify(data));};
  save('plan.json',plan());const results=[];
  for(const name of ['wine-assembly.wasm','wine-assembly.compat.wasm']){
    const modulePath=path.join(ROOT,'build',name),sha256=hash(fs.readFileSync(modulePath));
    try{const r=await run(modulePath,plan());save(name+'.json',r);results.push({name,sha256,cases:r.outputs.length,stackCalls:r.calls.filter(c=>c.stackGuards).length});console.log('PASS public specular ProcessVertices/Lock',JSON.stringify(results.at(-1)));}
    catch(e){save('failure-'+name+'.json',{error:String(e),sha256,partial:e.partial});throw e;}
    for(const [label,index,change] of controls()){
      const s=structuredClone(plan()[index]);s.expectedRGB=[0,1,2].map(i=>oracle(s,i).rgb);change(s);let failure;
      try{await run(modulePath,[s]);}catch(e){failure=e;}
      assert.match(String(failure),/SPECULAR RGB ORACLE/);assert(failure.partial.calls.some(c=>c.label==='ProcessVertices7'&&c.result===0));
      assert(failure.partial.outputs[0].sourceAfter,'negative completed source/Unlock/Release checks');
      save('negative-'+name+'-'+label+'.json',{error:String(failure),partial:failure.partial});console.log('PASS successful public state control rejected',name,label);
    }
  }
  save('result.json',{status:'SPECULAR_RGB_PASS',results,controlsPerModule:controls().length,alphaContract:'unasserted'});
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={oracle,plan,sourceRecord,expectedRecord,fixtureSource,run,controls};
