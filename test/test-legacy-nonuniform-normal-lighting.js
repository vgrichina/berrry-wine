#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const fixture=require('./test-legacy-public-specular-lighting');
const bootstrap=require('./test-legacy-generated-normal-reflection-projected');
const ROOT=path.resolve(__dirname,'..');
const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const scale=(x,y=x,z=x)=>[x,0,0,0,0,y,0,0,0,0,z,0,0,0,0,1];
const unit=v=>{const l=Math.hypot(...v);return l?v.map(x=>x/l):[0,0,0];};
const tx=(v,m,w=0)=>[0,1,2].map(j=>v.reduce((a,x,k)=>a+x*m[4*k+j],w*m[12+j]));
// Independent arithmetic, never a producer helper. Forward world transport is
// a CHARACTERIZATION hypothesis under nonuniform scale, not a DX7 guarantee.
// The SDK's explicit camera-space normalization contract is asserted separately.
function oracle(s,i,{stage='camera',inverse=false}={}){
  let n=s.normals[i];
  if(s.normalize&&stage==='input')n=unit(n);
  let world=s.world;
  if(inverse){
    // Test worlds are diagonal scale or rigid; inverse-transpose candidate.
    world=world.slice();for(const j of [0,5,10])if(world[j])world[j]=1/world[j];
  }
  n=tx(n,world);
  const worldNormal=s.normalize?unit(n):n;
  const diffuseFactor=Math.max(0,Math.min(1,worldNormal.reduce((a,x,j)=>a+x*unit(s.direction.map(x=>-x))[j],0)));
  if(s.normalize&&stage==='world')n=unit(n);
  n=tx(n,s.view);
  if(s.normalize&&stage==='camera')n=unit(n);
  const light=unit(tx(s.direction.map(x=>-x),s.view));
  const p=tx(tx(s.positions[i],s.world,1),s.view,1);
  const eye=s.local?unit(p.map(x=>-x)):[0,0,-1];
  const half=unit(light.map((x,j)=>x+eye[j]));
  const d=Math.max(0,Math.min(1,n.reduce((a,x,j)=>a+x*half[j],0)));
  return {rgb:s.lightSpecular.slice(0,3).map(x=>255*x*d**s.power),diffuse:s.lightDiffuse.slice(0,3).map(x=>255*x*diffuseFactor),position:p,normal:n};
}
function plan(){
  const base={...fixture.plan()[0],positions:[[0,0,2],[.25,0,2],[0,.25,2]],
    normals:[[.6,0,-.8],[.3,0,-.4],[0,0,-1]],direction:[0,0,1],
    material:[1,1,1,1, 0,0,0,1, 1,1,1,1, 0,0,0,1, 2],lightDiffuse:[.23,.37,.61,0]};
  const cases=[];
  for(const [label,world,view] of [
    ['identity',identity(),identity()],
    ['uniform world half',scale(.5),identity()],
    ['nonuniform world',scale(2,1,.5),identity()],
    ['rigid world rotation',[0,1,0,0,-1,0,0,0,0,0,1,0,0,0,0,1],identity()],
    ['uniform view half',identity(),scale(.5)],
    ['nonuniform world uniform view',scale(2,1,.5),scale(.5)],
    ['rigid view rotation',identity(),[0,1,0,0,-1,0,0,0,0,0,1,0,0,0,0,1]],
    ['world translation',[1,0,0,0,0,1,0,0,0,0,1,0,.25,.5,1,1],identity()]
  ])for(const normalize of [0,1])cases.push({...base,label:label+' normalize '+normalize,world,view,normalize});
  // Repeat identity after scaled states to detect stale transform/normal state.
  cases.push({...base,label:'identity restored',world:identity(),view:identity(),normalize:0});
  return cases;
}
async function run(modulePath,states){
  const routes=new Map([['/legacy-render.wasm',fs.readFileSync(modulePath)],['/test/binaries/calc.exe',fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'))],['/lib/host-import-sigs.generated.json',fs.readFileSync(path.join(ROOT,'lib/host-import-sigs.generated.json'))]]);
  const context=vm.createContext({WebAssembly,performance,setTimeout,sourceRecord:fixture.sourceRecord,expectedRecord:fixture.expectedRecord,
    fetch:async url=>{assert(routes.has(url));const b=routes.get(url);return {arrayBuffer:async()=>Uint8Array.from(b).buffer,json:async()=>JSON.parse(b)};},
    document:{createElement:()=>({style:{},getContext:()=>({putImageData(){}})}),body:{append(){}}},ImageData:class{}});
  let source=fixture.fixtureSource();
  const seam='        if(offset>=20&&offset<=22){';assert.equal(source.split(seam).length,2);
  source=source.replace(seam,`        if(offset>=16&&offset<=18){
          const value=state.expectedDiffuse[Math.floor(relative/state.dst.size)][18-offset];
          if(Math.abs(actual[i]-value)>1)row.oracleFailure='DIFFUSE RGB ORACLE '+state.label+' byte '+i+' actual '+actual[i]+' expected '+value;
        }
${seam}`);
  try{return await vm.runInContext('('+source+')',context)('software',{...bootstrap.config(),queued:false,states:states.map(s=>({...s,expectedRGB:s.expectedRGB||[0,1,2].map(i=>oracle(s,i).rgb),expectedDiffuse:s.expectedDiffuse||[0,1,2].map(i=>oracle(s,i).diffuse)})),update:null},'()=>[]',null);}
  catch(e){e.partial=context.legacyTextureEvidence;throw e;}
}
async function main(){
  const dir=process.env.LEGACY_NONUNIFORM_EVIDENCE;if(dir)fs.mkdirSync(dir,{recursive:true});
  const save=(n,d)=>{if(dir)fs.writeFileSync(path.join(dir,n),JSON.stringify(d));};
  save('plan.json',plan());const results=[];
  for(const name of ['wine-assembly.wasm','wine-assembly.compat.wasm']){
    const modulePath=path.join(ROOT,'build',name),sha256=crypto.createHash('sha256').update(fs.readFileSync(modulePath)).digest('hex');
    // Baseline mode retains both variants' completed failing public calls.
    if(process.env.LEGACY_NONUNIFORM_BASELINE){
      for(const s of plan()){
        try{const r=await run(modulePath,[s]);save(name+'-'+s.label+'.json',{sha256,r});console.log('BASELINE PASS',name,s.label);}
        catch(e){save(name+'-'+s.label+'.json',{sha256,error:String(e),partial:e.partial});console.log('BASELINE MISMATCH',name,s.label,String(e));}
      }
      continue;
    }
    const r=await run(modulePath,plan());save(name+'.json',{sha256,r});
    results.push({name,sha256,cases:r.outputs.length,guardedCalls:r.calls.filter(c=>c.stackGuards).length});
    console.log('PASS public normal lighting',JSON.stringify(results.at(-1)));
    // Stale numeric oracle with changed public inputs; all calls must succeed,
    // and source/Unlock/Release/geometry/stack guards must complete first.
    const controls=[
      ['normalize-on',4,s=>s.normalize=1],['normalize-off',5,s=>s.normalize=0],
      ['world-scale',5,s=>s.world=identity()],['view-scale',8,s=>s.view=identity()],
      ['normal-length',0,s=>s.normals=s.normals.map(n=>n.map(x=>x*.5))],
      ['rotation',6,s=>s.world=[0,0,-1,0,0,1,0,0,1,0,0,0,0,0,4,1]]
    ];
    for(const [label,index,change] of controls){
      const s=structuredClone(plan()[index]);s.expectedRGB=[0,1,2].map(i=>oracle(s,i).rgb);change(s);
      // Rotation control changes geometry too; supply its new geometric oracle.
      let failure;try{await run(modulePath,[s]);}catch(e){failure=e;}
      assert.match(String(failure),/SPECULAR RGB ORACLE/);
      assert(failure.partial.calls.some(c=>c.label==='ProcessVertices7'&&c.result===0));
      assert(failure.partial.outputs[0].sourceAfter);
      save('negative-'+name+'-'+label+'.json',{error:String(failure),partial:failure.partial});
    }
    // Wrong candidate models must be numerically distinguishable by >1 byte.
    for(const [label,index,options] of [['input-normalization',5,{stage:'input'}],['world-normalization',9,{stage:'world'}],['inverse-world',5,{inverse:true}]]){
      const s=structuredClone(plan()[index]);s.expectedRGB=[0,1,2].map(i=>oracle(s,i,options).rgb);
      let failure;try{await run(modulePath,[s]);}catch(e){failure=e;}
      assert.match(String(failure),/SPECULAR RGB ORACLE/);assert(failure.partial.outputs[0].sourceAfter);
      save('candidate-'+name+'-'+label+'.json',{error:String(failure),partial:failure.partial});
    }
  }
  save('result.json',{results,controlsPerModule:9,worldNonuniform:'forward characterization only; exact DX7 transport unresolved',alpha:'unasserted'});
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={oracle,plan,run};
