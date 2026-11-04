#!/usr/bin/env node
'use strict';
// Public D3D7 setup prerequisite only. Computed ProcessVertices colors require
// retained primary lighting equations/alpha/conversion rules; see the note.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const bootstrap=require('./test-legacy-generated-normal-reflection-projected');
const ROOT=path.resolve(__dirname,'..');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function prerequisite(){return (async()=>{
  const snapshot=async(p,n)=>Array.from(new Uint8Array(memory.buffer,await wa(p),n));
  const roundtrip=async(label,setSlot,getSlot,values,index=null)=>{
    const input=await guard(values.length*4),output=await guard(values.length*4);
    await words(input.p,values);const expected=await snapshot(input.p,values.length*4);
    if(negative===label){const changed=values.slice();changed[1]^=1;await words(input.p,changed);}
    const before=await snapshot(input.p,values.length*4);
    await ok(index===null?com('Set'+label,device,setSlot,input.p):com('Set'+label,device,setSlot,index,input.p));
    await input.check();eq(await snapshot(input.p,values.length*4),before,label+' input immutable');
    await ok(index===null?com('Get'+label,device,getSlot,output.p):com('Get'+label,device,getSlot,index,output.p));
    await output.check();const actual=await snapshot(output.p,values.length*4);
    evidence.setup.push({label,index,before,actual});
    // Negative controls alter a successful public Set input, keeping the
    // independent expected material/light bytes unchanged.
    eq(actual,expected,'SETUP ORACLE '+label);
  };
  evidence.setup=[];
  // D3DMATERIAL7: diffuse, ambient, specular, emissive RGBA, then power.
  // Exactly representable, distinct channels and alpha. No computed oracle.
  await roundtrip('Material7',16,17,[.25,.5,.75,.125,.75,.25,.5,1,0,0,0,0,.125,.375,.625,0,0].map(bits));
  // D3DLIGHT7: type; diffuse/specular/ambient RGBA; position; direction;
  // range, falloff, attenuation0/1/2, theta, phi. Unit directional -Z.
  const light=[3,...[.25,.5,.75,0,0,0,0,0,.125,.375,.625,0,0,0,0,0,0,-1,100,1,1,0,0,0,0].map(bits)];
  eq(light.length,26,'D3DLIGHT7 104 bytes');
  await roundtrip('Light7',18,19,light,0);
  for(const enabled of [1,0,1]){
    await ok(com('LightEnable7',device,44,0,enabled));
    const output=await guard(4);await ok(com('GetLightEnable7',device,45,0,output.p));await output.check();
    const actual=await read(output.p);eq(actual===0,enabled===0,'enabled Boolean round trip');
    evidence.setup.push({label:'LightEnable7',enabled,actual});
  }
  for(const [id,value] of [[137,1],[139,0x003571a9],[141,0],[141,1],[145,0],[145,1],[145,2],[147,0],[147,1],[147,2],[148,0],[148,1],[148,2],[29,0],[28,0],[143,0]]){
    await ok(com('SetRenderState7 setup '+id,device,20,id,value));
    const output=await guard(4);await ok(com('GetRenderState7 setup '+id,device,21,id,output.p));await output.check();
    const actual=await read(output.p);eq(actual,value,'render state round trip');evidence.setup.push({label:'RenderState7',id,value,actual});
  }
})();}
function fixtureSource(){
  let s=bootstrap.fixtureSource();
  const a=s.indexOf('    let currentFVF='),b=s.indexOf("    await ok(com('unbind texture'",a);assert(a>0&&b>a);
  s=s.slice(0,a)+'    await ('+prerequisite.toString()+')();\n'+s.slice(b);
  const replace=(a,b)=>{assert.equal(s.split(a).length,2,'public fixture seam '+a);s=s.replace(a,b);};
  replace('      const code=[],word=n=>code.push',`      await write(stack-256,0x6b73a91d);await write(stack+16,0x39e5c72b);
      const code=[],word=n=>code.push`);
  replace('      evidence.calls.push(row);await result.check();',`      evidence.calls.push(row);await result.check();
      eq(await read(stack-256),0x6b73a91d,label+' lower stack guard');
      eq(await read(stack+16),0x39e5c72b,label+' upper stack guard');row.stackGuards=true;`);
  return s;
}
async function run(modulePath,negative=null){
  const routes=new Map([['/legacy-render.wasm',fs.readFileSync(modulePath)],['/test/binaries/calc.exe',fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'))],['/lib/host-import-sigs.generated.json',fs.readFileSync(path.join(ROOT,'lib/host-import-sigs.generated.json'))]]);
  const context=vm.createContext({WebAssembly,performance,setTimeout,fetch:async url=>{assert(routes.has(url));const b=routes.get(url);return {arrayBuffer:async()=>Uint8Array.from(b).buffer,json:async()=>JSON.parse(b)};},document:{createElement:()=>({style:{},getContext:()=>({putImageData(){}})}),body:{append(){}}},ImageData:class{}});
  try{return await vm.runInContext('('+fixtureSource()+')',context)('software',{...bootstrap.config(),queued:false,states:[],update:null},'()=>[]',negative);}
  catch(e){e.partial=context.legacyTextureEvidence;throw e;}
}
async function main(){
  const dir=process.env.LEGACY_COMPUTED_LIGHTING_EVIDENCE;if(dir)fs.mkdirSync(dir,{recursive:true});
  const save=(name,data)=>{if(dir)fs.writeFileSync(path.join(dir,name),JSON.stringify(data));};
  const modules=[];
  for(const name of ['wine-assembly.wasm','wine-assembly.compat.wasm']){
    const p=path.join(ROOT,'build',name),sha256=hash(fs.readFileSync(p));
    try{const r=await run(p);save(name+'.json',r);modules.push({name,sha256,setup:r.setup.length,calls:r.calls.filter(c=>c.stackGuards).length});console.log('PASS public lighting setup prerequisite',JSON.stringify(modules.at(-1)));}
    catch(e){save('failure-'+name+'.json',{error:String(e),partial:e.partial});throw e;}
  }
  for(const negative of ['Material7','Light7']){
    let failure;try{await run(path.join(ROOT,'build/wine-assembly.wasm'),negative);}catch(e){failure=e;}
    assert.match(String(failure),/SETUP ORACLE/);assert(failure.partial.calls.some(c=>c.label==='Get'+negative&&c.result===0));
    save('negative-'+negative+'.json',{error:String(failure),partial:failure.partial});console.log('PASS rejected readback oracle control',negative);
  }
  save('result.json',{status:'PREREQUISITE_PASS_CONTRACT_BLOCKED',modules,computedLightingCases:0,missing:'Primary DX7 lighting equations, alpha and float-to-D3DCOLOR conversion contract unavailable in retained offline references.'});
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={fixtureSource,run};
