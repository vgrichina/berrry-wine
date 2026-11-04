#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const mechanics=require('./test-legacy-supported-computed-lighting');
const bootstrap=require('./test-legacy-generated-normal-reflection-projected');
const ROOT=path.resolve(__dirname,'..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
// DX7 SDK imref_5fdw.content.htm, anchored paragraphs, and imref_192c:
// COLOR2=2. Independent literals, never inferred from configured lighting.
const defaults=Object.freeze([
  {name:'SPECULARENABLE',id:29,value:0,alternate:1},
  {name:'LOCALVIEWER',id:142,value:1,alternate:0},
  {name:'NORMALIZENORMALS',id:143,value:0,alternate:1},
  {name:'COLORVERTEX',id:141,value:1,alternate:0},
  {name:'SPECULARMATERIALSOURCE',id:146,value:2,alternate:1}
]);
function audit(){return (async()=>{
  const expected=config.defaults.map(s=>s.value),changed=config.defaults.map(s=>s.alternate);
  evidence.readbacks=[];evidence.controls=[];evidence.mismatches=[];
  const get=async(object,phase)=>{
    const values=[];
    for(const state of config.defaults){
      const out=await guard(4);
      // Different nonvalid output poison on every query; a silent-success
      // getter cannot pass either the defaults or the setter controls.
      const poison=(0xdeaf0000+evidence.readbacks.length*16+values.length)>>>0;
      await write(out.p,poison);
      await ok(com('GetRenderState7 '+phase+' '+state.name,object,21,state.id,out.p));
      await out.check();const value=await read(out.p);check(value!==poison,'getter wrote output');values.push(value);
    }
    evidence.readbacks.push({object,phase,values,outputGuards:true});return values;
  };
  const fresh=async(object,phase)=>{
    const actual=await get(object,phase);
    config.defaults.forEach((s,i)=>{if(actual[i]!==s.value)evidence.mismatches.push({phase,name:s.name,id:s.id,actual:actual[i],expected:s.value});});
    return actual;
  };
  const set=async(object,index,value)=>{
    const s=config.defaults[index];await ok(com('SetRenderState7 '+s.name,object,20,s.id,value));
  };
  // First operations on each newly acquired Device7 are these getters.
  const originalA=await fresh(device,'A immediately after CreateDevice');
  // Vary one state at a time and verify every state, distinguishing state IDs
  // as well as values. Keep mismatches deferred until all public controls run.
  const currentA=originalA.slice();
  for(let i=0;i<config.defaults.length;i++){
    await set(device,i,changed[i]);currentA[i]=changed[i];
    const actual=await get(device,'A setter control '+i);eq(actual,currentA,'setter exact readback and neighboring states');
    check(actual[i]!==expected[i],'changed state rejects documented default');
    evidence.controls.push({name:config.defaults[i].name,actual:actual[i],staleDefault:expected[i],rejected:true});
  }
  const deviceB=await acquire(out=>com('CreateDevice7 B',d3d,4,hal,rt,out));
  check(deviceB!==device,'two distinct acquired devices');evidence.objects.deviceB=deviceB;
  const originalB=await fresh(deviceB,'B immediately after CreateDevice with A changed');
  eq(await get(device,'A after creating B'),changed,'creating B preserves A');
  // All selector enum values and both Boolean values roundtrip. Mutations of
  // B cannot affect A. Mutations/restoration of A cannot affect B.
  const currentB=originalB.slice();
  for(let i=0;i<config.defaults.length;i++)for(const value of (config.defaults[i].id===146?[0,1,2]:[0,1])){
    await set(deviceB,i,value);currentB[i]=value;
    eq(await get(deviceB,'B roundtrip '+i+'/'+value),currentB,'B exact roundtrip');
    eq(await get(device,'A isolation '+i+'/'+value),changed,'B setter preserves A');
  }
  for(let i=0;i<config.defaults.length;i++)await set(device,i,expected[i]);
  eq(await get(device,'A restored'),expected,'A explicit defaults roundtrip');
  eq(await get(deviceB,'B after restoring A'),currentB,'A setter preserves B');
  await com('Release B',deviceB,2);
  eq(await get(device,'A after releasing B'),expected,'B release preserves A');
  for(const [name,obj] of Object.entries({device,texture,rt,padding,d3d,dd}))await com('Release '+name,obj,2);
  check(evidence.calls.every(c=>c.stackGuards),'every public call has stack guards');
  if(evidence.mismatches.length)throw Error('FRESH DEFAULT ORACLE '+JSON.stringify(evidence.mismatches));
  evidence.status='FRESH_DEVICE_DEFAULTS_PASS';return evidence;
})();}
function fixtureSource(){
  // Reuse only the existing real public x86 COM/bootstrap and guard mechanics.
  // Cut away all configured state/rendering code immediately after creation.
  const s=mechanics.fixtureSource(),start=s.indexOf('    evidence.objects={dd,d3d,texture,padding,rt,device};'),end=s.lastIndexOf('  }finally{');
  assert(start>0&&end>start,'fresh-device fixture seams');
  const prefix=s.slice(0,start);
  assert(!/com\('(?:SetRenderState|SetMaterial|SetLight|LightEnable)/.test(prefix),'no lighting setters before audit');
  return prefix+'    evidence.objects={dd,d3d,texture,padding,rt,device};\n    return await ('+audit.toString()+')();\n'+s.slice(end);
}
async function run(modulePath){
  const routes=new Map([['/legacy-render.wasm',fs.readFileSync(modulePath)],['/test/binaries/calc.exe',fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'))],['/lib/host-import-sigs.generated.json',fs.readFileSync(path.join(ROOT,'lib/host-import-sigs.generated.json'))]]);
  const context=vm.createContext({WebAssembly,performance,setTimeout,fetch:async url=>{assert(routes.has(url));const b=routes.get(url);return {arrayBuffer:async()=>Uint8Array.from(b).buffer,json:async()=>JSON.parse(b)};}});
  try{return await vm.runInContext('('+fixtureSource()+')',context)('software',{...bootstrap.config(),defaults},'()=>[]');}
  catch(e){e.partial=context.legacyTextureEvidence;throw e;}
}
async function main(){
  const dir=process.env.LEGACY_FRESH_DEFAULTS_EVIDENCE;if(dir)fs.mkdirSync(dir,{recursive:true});
  const save=(name,data)=>{if(dir)fs.writeFileSync(path.join(dir,name),JSON.stringify(data,null,2)+'\n');};
  const results=[];let failed=false;
  for(const name of ['wine-assembly.wasm','wine-assembly.compat.wasm']){
    const modulePath=path.join(ROOT,'build',name),sha256=hash(fs.readFileSync(modulePath));
    try{const r=await run(modulePath);save(name+'.json',r);results.push({name,sha256,calls:r.calls.length,readbacks:r.readbacks.length,controls:r.controls.length});console.log('PASS public fresh Device7 defaults',JSON.stringify(results.at(-1)));}
    catch(e){failed=true;save('failure-'+name+'.json',{error:String(e),sha256,partial:e.partial});console.error(name,String(e));results.push({name,sha256,error:String(e)});}
  }
  save('result.json',{status:failed?'FAIL':'PASS',defaults,results});assert(!failed,'fresh device defaults failed (see retained readbacks)');
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={defaults,fixtureSource,run};
