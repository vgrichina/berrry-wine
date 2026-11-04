#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const bootstrap=require('./test-legacy-generated-normal-reflection-projected');
const ROOT=path.resolve(__dirname,'..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');

// D3D7 FVF order: XYZ (or XYZRHW), NORMAL if present, DIFFUSE,
// SPECULAR, then each texture set. Dimensions use SDK SIZE1=3, SIZE2=0,
// SIZE3=1, SIZE4=2, at bit 16+2*set. No reserved canonical-LVERTEX word.
// The oracle is authored here, without production FVF/matrix/packing helpers.
function layout(position,normal,color,dims){
  const offsets={position:0};let size=position==='XYZ'?12:16;
  if(normal){offsets.normal=size;size+=12;}
  if(color&0x40){offsets.diffuse=size;size+=4;}
  if(color&0x80){offsets.specular=size;size+=4;}
  offsets.texture=dims.map(d=>{const offset=size;size+=d*4;return offset;});
  let fvf=(position==='XYZ'?2:4)|(normal?16:0)|color|(dims.length<<8);
  dims.forEach((d,i)=>{fvf|=({1:3,2:0,3:1,4:2}[d]<<(16+2*i));});
  return {fvf:fvf>>>0,size,offsets,dims};
}
// RGB expectations use only exact 0/1 inputs and saturated endpoints. No
// rounding mode or output-alpha rule is assumed; alpha is recorded separately.
function plan(){
  const base={op:0x401,src:layout('XYZ',true,0xc0,[]),dst:layout('XYZRHW',false,0x40,[])};
  const cases=[
    {...base,label:'material ambient + emissive',enabled:0,ambient:0x00ff0000,
      material:[1,1,1,1, 1,1,0,1, 0,0,0,0, 0,0,1,1, 0],selectors:[0,0,0],colorvertex:0,
      lightDiffuse:[0,1,0,0],lightAmbient:[0,0,0,0],rgb:[[255,0,255],[255,0,255],[255,0,255]]},
    {...base,label:'directional facing tangent away + global/light ambient',enabled:1,ambient:0x000000ff,
      material:[1,1,1,1, 1,1,1,1, 0,0,0,0, 0,0,0,1, 0],selectors:[0,0,0],colorvertex:0,
      lightDiffuse:[0,1,0,0],lightAmbient:[1,0,0,0],rgb:[[255,255,255],[255,0,255],[255,0,255]]},
    {...base,label:'COLOR1 emissive COLOR2 ambient',enabled:0,ambient:0x00ffffff,
      material:[0,0,0,1, 0,0,0,1, 0,0,0,0, 0,0,0,1, 0],selectors:[0,2,1],colorvertex:1,
      lightDiffuse:[0,0,0,0],lightAmbient:[0,0,0,0],rgb:[[255,255,0],[0,255,255],[255,0,255]]}
  ];
  return [...cases,...cases.slice(0,2).flatMap(s=>[0,0x40].map(color=>({...s,label:s.label+'/color'+color,src:layout('XYZ',true,color,[])}))),
    ...[1,2].map(selector=>({...cases[1],label:'directional diffuse COLOR'+selector,
      ambient:0,lightAmbient:[0,0,0,0],lightDiffuse:[1,1,1,0],colorvertex:1,selectors:[selector,0,0],
      rgb:[selector===1?[255,0,0]:[0,255,0],[0,0,0],[0,0,0]]}))];
}
function sourceRecord(state,i){
  const b=new Uint8Array(state.src.size),v=new DataView(b.buffer);
  [[0,0,.5],[0,-1,1],[-2,0,2]][i].forEach((x,c)=>v.setFloat32(c*4,x,true));
  [[0,0,1],[1,0,0],[0,0,-1]][i].forEach((x,c)=>v.setFloat32(12+c*4,x,true));
  if(state.src.offsets.diffuse!==undefined)v.setUint32(state.src.offsets.diffuse,[0xffff0000,0xff00ff00,0xff0000ff][i],true);
  if(state.src.offsets.specular!==undefined)v.setUint32(state.src.offsets.specular,[0xff00ff00,0xff0000ff,0xffff0000][i],true);return Array.from(b);
}
function expectedRecord(state,i){
  const b=new Uint8Array(state.dst.size),v=new DataView(b.buffer);
  [[35,21,.5,1],[51,21,.5,.5],[35,29,.5,.25]][i].forEach((x,c)=>v.setFloat32(c*4,x,true));
  const [r,g,blue]=state.rgb[i];v.setUint32(16,((r<<16)|(g<<8)|blue)>>>0,true);
  return Array.from(b);
}
function lightingCases(){return (async()=>{
  const snapshot=async(p,n)=>Array.from(new Uint8Array(memory.buffer,await wa(p),n));
  const create=async(fvf,n)=>{
    const desc=await guard(16);await words(desc.p,[16,0,fvf,n]);const before=await snapshot(desc.p,16);
    const obj=await acquire(out=>com('CreateVertexBuffer7',d3d,5,desc.p,out,0));
    await desc.check();eq(await snapshot(desc.p,16),before,'descriptor immutable');return obj;
  };
  const locked=async obj=>{
    const p=await guard(4),n=await guard(4);await ok(com('Lock VB7',obj,3,0,p.p,n.p));
    await p.check();await n.check();return {p:await read(p.p),n:await read(n.p)};
  };
  // Public transforms and explicit D3D7 lighting state. No draws execute.
  for(const [type,m] of [[1,[0,1,0,0,-1,0,0,0,0,0,1,0,.125,-.25,.125,1]],
    [2,[1,0,0,0,0,1,0,0,0,0,1,0,-.125,.25,-.125,1]],
    [3,[1,0,0,0,0,1,0,0,0,0,1,2,0,0,0,0]]]){
    await words(matrix,m.map(bits));await ok(com('SetTransform7 '+type,device,11,type,matrix));
    const got=await guard(64);await ok(com('GetTransform7 '+type,device,12,type,got.p));await got.check();
    eq(await snapshot(got.p,64),Array.from(new Uint8Array(Uint32Array.from(m.map(bits)).buffer)),'public matrix round trip');
  }
  await words(viewport,[3,5,64,32,bits(0),bits(1)]);await ok(com('SetViewport7 colored',device,13,viewport));
  const gotViewport=await guard(24);await ok(com('GetViewport7',device,15,gotViewport.p));await gotViewport.check();
  eq(await snapshot(gotViewport.p,24),await snapshot(viewport,24),'public viewport round trip');
  for(const [id,value] of [[137,negative==='lighting-off'?0:1],[28,0],[29,0],[143,0]]){
    await ok(com('SetRenderState7 explicit '+id,device,20,id,value));
    const got=await guard(4);await ok(com('GetRenderState7 explicit '+id,device,21,id,got.p));await got.check();eq(await read(got.p),value,'public render state round trip');
  }
  await tss(11,2);await tss(24,0);
  evidence.outputs=[];
  evidence.setup=[];
  const roundtrip=async(label,setSlot,getSlot,values,index=null)=>{
    const input=await guard(values.length*4),output=await guard(values.length*4);
    await words(input.p,values);const before=await snapshot(input.p,values.length*4);
    await ok(index===null?com('Set'+label,device,setSlot,input.p):com('Set'+label,device,setSlot,index,input.p));
    await input.check();eq(await snapshot(input.p,values.length*4),before,label+' immutable');
    await ok(index===null?com('Get'+label,device,getSlot,output.p):com('Get'+label,device,getSlot,index,output.p));
    await output.check();eq(await snapshot(output.p,values.length*4),before,label+' readback');
    evidence.setup.push({label,values});
  };
  for(const state of config.states){
    const material=state.material.slice();if(negative==='emissive')material[14]=0;
    await roundtrip('Material7',16,17,material.map(bits));
    const direction=negative==='direction'?1:-1;
    const light=[3,...[...state.lightDiffuse,0,0,0,0,...state.lightAmbient,0,0,0,0,0,direction,100,1,1,0,0,0,0].map(bits)];
    eq(light.length,26,'light size');await roundtrip('Light7',18,19,light,0);
    await ok(com('LightEnable7',device,44,0,state.enabled));
    const enabled=await guard(4);await ok(com('GetLightEnable7',device,45,0,enabled.p));await enabled.check();
    eq((await read(enabled.p))!==0,state.enabled!==0,'enable readback');
    for(const [id,value] of [[139,state.ambient],[141,state.colorvertex],[145,state.selectors[0]],[147,state.selectors[1]],[148,negative==='selector'?0:state.selectors[2]]]){
      await ok(com('SetRenderState7 lighting '+id,device,20,id,value));const got=await guard(4);
      await ok(com('GetRenderState7 lighting '+id,device,21,id,got.p));await got.check();eq(await read(got.p),value,'lighting state readback');
    }
    const source=await create(state.src.fvf,5),destination=await create(state.dst.fvf,6),src=await locked(source),dst=await locked(destination);
    eq(src.n,state.src.size*5,'source FVF capacity');eq(dst.n,state.dst.size*6,'destination FVF capacity');
    new Uint8Array(memory.buffer,await wa(src.p),src.n).fill(0xa5);
    for(let i=0;i<3;i++){
      const record=sourceRecord(state,i);
      await bytes(src.p+(1+i)*state.src.size,record);
    }
    const before=await snapshot(src.p,src.n);
    new Uint8Array(memory.buffer,await wa(dst.p),dst.n).fill(0xcd);
    await ok(com('Unlock source',source,4));await ok(com('Unlock destination',destination,4));
    const sentinel=await snapshot(dst.p,dst.n);
    for(const [label,di,count,sv,si,hr] of [['zero',2,0,source,1,0],['src end',2,1,source,5,0x80070057],['dst end',6,1,source,1,0x80070057],['null source',2,1,0,1,0x80004003]]){
      eq(await com('ProcessVertices7 guard '+label,destination,5,state.op,di,count,sv,si,device,0),hr,label);
      const l=await locked(destination);eq(l,dst,'guard Lock');eq(await snapshot(l.p,l.n),sentinel,'guard entire destination unchanged');await ok(com('Unlock guard',destination,4));
    }
    await ok(com('ProcessVertices7',destination,5,negative==='transform-only'?1:state.op,2,3,source,1,device,0));
    const output=await locked(destination);eq(output,dst,'destination Lock stable');
    const actual=await snapshot(output.p,output.n),expected=Array(output.n).fill(0xcd);
    for(let i=0;i<3;i++)expected.splice((2+i)*state.dst.size,state.dst.size,...expectedRecord(state,i));
    const row={state,sourceBefore:before,actual,expected};evidence.outputs.push(row);
    row.observedAlpha=[];
    for(let i=0;i<actual.length;i++){
      const relative=i-2*state.dst.size;
      if(relative>=0&&relative<3*state.dst.size&&relative%state.dst.size===19){row.observedAlpha.push(actual[i]);continue;}
      eq(actual[i],expected[i],'LIGHTING RGB/GEOMETRY ORACLE '+state.label+' byte '+i);
    }
    await ok(com('Unlock readback',destination,4));
    const unchanged=await locked(source);row.sourceAfter=await snapshot(unchanged.p,unchanged.n);
    eq(row.sourceAfter,before,'complete source unchanged');await ok(com('Unlock source check',source,4));
    await com('Release source',source,2);await com('Release destination',destination,2);
  }
})();}
function fixtureSource(){
  let s=bootstrap.fixtureSource();
  const a=s.indexOf('    let currentFVF='),b=s.indexOf("    await ok(com('unbind texture'",a);assert(a>0&&b>a);
  s=s.slice(0,a)+'    await ('+lightingCases.toString()+')();\n'+s.slice(b);
  const replace=(a,b)=>{assert.equal(s.split(a).length,2,'public fixture seam '+a);s=s.replace(a,b);};
  replace('      const code=[],word=n=>code.push',`      await write(stack-256,0x6b73a91d);await write(stack+16,0x39e5c72b);
      const code=[],word=n=>code.push`);
  replace('      evidence.calls.push(row);await result.check();',`      evidence.calls.push(row);await result.check();
      eq(await read(stack-256),0x6b73a91d,label+' lower stack guard');
      eq(await read(stack+16),0x39e5c72b,label+' upper stack guard');row.stackGuards=true;`);
  return s;
}
async function run(modulePath,states,negative=null){
  const routes=new Map([['/legacy-render.wasm',Buffer.isBuffer(modulePath)?modulePath:fs.readFileSync(modulePath)],['/test/binaries/calc.exe',fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'))],['/lib/host-import-sigs.generated.json',fs.readFileSync(path.join(ROOT,'lib/host-import-sigs.generated.json'))]]);
  const context=vm.createContext({WebAssembly,performance,setTimeout,sourceRecord,expectedRecord,fetch:async url=>{assert(routes.has(url));const b=routes.get(url);return {arrayBuffer:async()=>Uint8Array.from(b).buffer,json:async()=>JSON.parse(b)};},document:{createElement:()=>({style:{},getContext:()=>({putImageData(){}})}),body:{append(){}}},ImageData:class{}});
  try{return await vm.runInContext('('+fixtureSource()+')',context)('software',{...bootstrap.config(),queued:false,states,update:null},'()=>[]',negative);}
  catch(e){e.partial=context.legacyTextureEvidence;throw e;}
}
async function main(){
  const dir=process.env.LEGACY_SUPPORTED_LIGHTING_EVIDENCE;if(dir)fs.mkdirSync(dir,{recursive:true});
  const save=(name,data)=>{if(dir)fs.writeFileSync(path.join(dir,name),JSON.stringify(data));};
  const states=process.argv.includes('--baseline')?plan().slice(0,1):plan(),results=[];
  for(const name of ['wine-assembly.wasm','wine-assembly.compat.wasm']){
    const modulePath=path.join(ROOT,'build',name),sha256=hash(fs.readFileSync(modulePath));
    try{const r=await run(modulePath,states);save(name+'.json',r);results.push({name,sha256,cases:r.outputs.length,calls:r.calls.filter(c=>c.stackGuards).length});console.log('PASS computed public ProcessVertices/Lock',JSON.stringify(results.at(-1)));}
    catch(e){save('failure-'+name+'.json',{error:String(e),sha256,partial:e.partial});throw e;}
  }
  if(!process.argv.includes('--baseline'))for(const negative of ['emissive','direction','selector','lighting-off','transform-only']){
    const state=plan()[{emissive:0,direction:1,selector:2,'lighting-off':0,'transform-only':0}[negative]];let failure;
    try{await run(path.join(ROOT,'build/wine-assembly.wasm'),[state],negative);}catch(e){failure=e;}
    assert.match(String(failure),/LIGHTING RGB\/GEOMETRY ORACLE/);assert(failure.partial.calls.some(c=>c.label==='ProcessVertices7'&&c.result===0));
    save('negative-'+negative+'.json',{error:String(failure),partial:failure.partial});console.log('PASS rejected successful public input control',negative);
  }
  save('result.json',{status:'RGB_PASS_ALPHA_CONTRACT_OPEN',results});
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={layout,plan,sourceRecord,expectedRecord,fixtureSource,run};
