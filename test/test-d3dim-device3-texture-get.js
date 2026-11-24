#!/usr/bin/env node
'use strict';

// Legacy declarations (Device2/3/7 vtable order and TEXTURE0..7 = 16..23):
// https://github.com/microsoft/win32metadata/blob/main/generation/WinSDK/RecompiledIdlHeaders/um/d3d.h
// https://github.com/microsoft/win32metadata/blob/main/generation/WinSDK/RecompiledIdlHeaders/um/d3dtypes.h
// Per-stage matrix semantics are also documented at:
// https://learn.microsoft.com/en-us/windows/win32/direct3d9/texture-coordinate-transformations
// That newer document supplies no legacy invalid-argument HRESULT oracle.
// NULL, unknown-type and Begin/End checks below preserve existing behavior.
// No Windows reference run exists. All calls use public x86 COM vtables in
// the actual production module, including creation; no injected WAT exports.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const fixture=require('./test-legacy-texture-rendered-contract');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
// Independent literal IEEE-754 words. No implementation matrix helper or
// runtime readback computes an expected matrix. Frozen before original runs.
const I=[0x3f800000,0,0,0,0,0x3f800000,0,0,0,0,0x3f800000,0,0,0,0,0x3f800000];
const MATRICES=[
 [0x40000000,0x3f800000,0,0,0,0x40400000,0,0,0,0,0x40800000,0,0x40a00000,0x40c00000,0x40e00000,0x3f800000],
 [0x40400000,0,0x3f800000,0,0,0x40800000,0,0,0,0,0x40a00000,0,0x40c00000,0x40e00000,0x41000000,0x3f800000],
 [0x40800000,0,0,0,0x3f800000,0x40a00000,0,0,0,0,0x40c00000,0,0x40e00000,0x41000000,0x41100000,0x3f800000],
 [0x40a00000,0,0,0,0,0x40c00000,0x3f800000,0,0,0,0x40e00000,0,0x41000000,0x41100000,0x41200000,0x3f800000],
 [0x40c00000,0,0,0,0,0x40e00000,0,0,0x3f800000,0,0x41000000,0,0x41100000,0x41200000,0x41300000,0x3f800000],
 [0x40e00000,0,0,0,0,0x41000000,0,0,0,0x3f800000,0x41100000,0,0x41200000,0x41300000,0x41400000,0x3f800000],
 [0x41000000,0x40000000,0,0,0,0x41100000,0,0,0,0,0x41200000,0,0x41300000,0x41400000,0x41500000,0x3f800000],
 [0x41100000,0,0x40000000,0,0,0x41200000,0,0,0,0,0x41300000,0,0x41400000,0x41500000,0x41600000,0x3f800000],
];
const W=[0x40000000,0,0,0,0,0x3f800000,0,0,0,0,0x3f800000,0,0,0,0,0x3f800000];
const V=[0x3f800000,0,0,0,0,0x40400000,0,0,0,0,0x3f800000,0,0,0,0,0x3f800000];
const P=[0x3f800000,0,0,0,0,0x3f800000,0,0,0,0,0x40800000,0,0,0,0,0x3f800000];
const WVP=[0x40000000,0,0,0,0,0x40400000,0,0,0,0,0x40800000,0,0,0,0,0x3f800000];
// Translation on the LEFT of stage 0: [1,2,3,1] * stage0 => [7,13,19,1].
const T=[0x3f800000,0,0,0,0,0x3f800000,0,0,0,0,0x3f800000,0,0x3f800000,0x40000000,0x40400000,0x3f800000];
const PRODUCT=[0x40000000,0x3f800000,0,0,0,0x40400000,0,0,0,0,0x40800000,0,0x40e00000,0x41500000,0x41980000,0x3f800000];
const ORACLE={I,MATRICES,W,V,P,WVP,T,PRODUCT};

async function exercise(c,o){
  const {evidence,eq,check,raw,read,alloc,wa,words,guard,guid,com,ok,acquire,dd,hal,surface,device,d3d,rt,texture,padding}=c;
  evidence.matrices=[];evidence.controls=[];
  const input=await guard(64),out=await guard(64);
  const targets=[{version:7,device,d3d,rt,set:11,get:12,mul:14}];
  for(const version of [2,3,3]){
    const iid=await guid(version===2?[0x6aae1ec1,0x11d0662a,0xaa009d88,0x6ab7bb00]:[0xbb223240,0x11d0e72b,0xaa00b4a9,0x3e99c000]);
    const parent=await acquire(p=>com('QI Direct3D'+version,dd,0,iid,p));
    const target=await surface(8,8,0x2840);
    const dev=await acquire(p=>com('CreateDevice'+version,parent,8,hal,target,p,...(version===3?[0]:[])));
    targets.push({version,device:dev,d3d:parent,rt:target,set:version===2?26:25,get:version===2?27:26,mul:version===2?28:27});
  }
  evidence.targets=targets;
  const call=(t,method,type,p)=>com('Device'+t.version+' '+method,t.device,t[method],type,p);
  const set=async(t,type,m,method='set')=>{await words(input.p,m);await ok(call(t,method,type,input.p));await input.check();};
  async function get(t,type,want,label){
    await words(out.p,Array(16).fill(0xa5a5a5a5));await ok(call(t,'get',type,out.p));await out.check();
    const row=evidence.calls.at(-1);
    eq(await read(row.target+4),t.version===3?1172:t.version===2?1341:1359,'published getter thunk API identity');
    const got=[];for(let i=0;i<16;i++)got.push(await read(out.p+4*i));
    evidence.matrices.push({version:t.version,device:t.device,type,label,got,want});
  }
  const all=async(t,ms,label)=>{for(let s=0;s<8;s++)await get(t,16+s,ms[s],label);};
  for(const t of targets){
    await all(t,Array(8).fill(o.I),'initial identity');
    for(let s=0;s<8;s++)await set(t,16+s,o.MATRICES[s]);
    await all(t,o.MATRICES,'eight independent stages');
    for(const [type,m] of [[1,o.W],[2,o.V],[3,o.P]])await set(t,type,m);
    // Unknown type 0 already maps to scratch slot 3; characterize this legacy
    // behavior without defining any new validation or WORLD1..3 behavior.
    await set(t,0,o.T);await get(t,0,o.T,'existing unknown type scratch');
    await all(t,o.MATRICES,'scratch poison');
    for(let s=0;s<8;s++)await set(t,16+s,o.I,'mul');
    await all(t,o.MATRICES,'Multiply identity all stages');
    await set(t,16,o.T,'mul');
    await all(t,[o.PRODUCT,...o.MATRICES.slice(1)],'noncommuting multiply stage0');
    for(const [type,m] of [[1,o.W],[2,o.V],[3,o.P]])await get(t,type,m,'WVP preserved');
    await ok(call(t,'get',16,0));
    evidence.controls.push({label:'NULL output success',version:t.version});
    await set(t,16,o.MATRICES[0]);
  }
  // Two separately created Device3 objects stay independent, even when both
  // have all eight matrices live. Read the untouched object after each write.
  const A=targets[2],B=targets[3];
  for(let s=0;s<8;s++)await set(B,16+s,o.MATRICES[7-s]);
  await all(A,o.MATRICES,'distinct device A');await all(B,[...o.MATRICES].reverse(),'distinct device B');
  // A real public untransformed draw rebuilds composite slot 3 from W/V/P.
  // Texture transforms are disabled; this is a matrix lifecycle witness.
  const viewport=await acquire(p=>com('CreateViewport3',A.d3d,6,p,0));
  const vp=await alloc(44),bits=n=>{const d=new DataView(new ArrayBuffer(4));d.setFloat32(0,n,true);return d.getUint32(0,true);};
  await words(vp,[44,0,0,8,8,bits(-1),bits(1),bits(2),bits(2),0,bits(1)]);
  await ok(com('AddViewport3',A.device,5,viewport));await ok(com('SetViewport2',viewport,17,vp));
  await ok(com('SetCurrentViewport3',A.device,12,viewport));
  for(const [id,v] of [[7,0],[14,0],[15,0],[22,1],[27,0],[28,0],[137,0]])await ok(com('render state3',A.device,22,id,v));
  const vertices=await alloc(96);
  for(const [i,[x,y]] of [[-.2,.2],[.2,.2],[-.2,-.2]].entries())await words(vertices+32*i,[bits(x),bits(y),bits(.1),0,0xffffffff,0,0,0]);
  await ok(com('BeginScene3',A.device,9));
  await ok(com('DrawPrimitive3 rebuild',A.device,28,4,0x1e2,vertices,3,0));
  await ok(com('EndScene3',A.device,10));
  await get(A,0,o.WVP,'public draw rebuilt composite');
  await all(A,o.MATRICES,'after composite rebuild');await all(B,[...o.MATRICES].reverse(),'other device after rebuild');
  // Existing immediate-mode rejection must neither copy bytes nor lose ESP.
  await ok(com('BeginScene3 immediate',A.device,9));await ok(com('Begin3',A.device,16,4,0x1c4,0));
  await words(out.p,Array(16).fill(0xa5a5a5a5));
  const hr=await call(A,'get',16,out.p);eq(hr,0x80070057,'existing immediate rejection');
  for(let i=0;i<16;i++)eq(await read(out.p+4*i),0xa5a5a5a5,'immediate output untouched');await out.check();
  eq(await com('End3 empty',A.device,20,0),0x80070057,'existing empty End rejection');await ok(com('EndScene3 immediate',A.device,10));
  await all(A,o.MATRICES,'after immediate End');
  // A readable invalid-this object (out-of-range slot) preserves success and
  // leaves the output alone. Invoke the published Device3 vtable on it.
  const invalid=await alloc(8);await words(invalid,[await read(A.device),0xffffffff]);
  await words(out.p,Array(16).fill(0xa5a5a5a5));await ok(com('invalid Device3 state',invalid,A.get,16,out.p));
  for(let i=0;i<16;i++)eq(await read(out.p+4*i),0xa5a5a5a5,'invalid state output untouched');await out.check();
  check(new Set(targets.map(t=>t.device)).size===4,'four distinct public devices');
  await ok(com('DeleteViewport3',A.device,6,viewport));await com('Release viewport',viewport,2);
  for(const t of targets)for(const obj of [t.device,t.rt,t.d3d])await com('Release',obj,2);
  for(const obj of [texture,padding,dd])await com('Release',obj,2);
  evidence.status='PASS';return evidence;
}
function source(){
  const s=fixture.browserFixture.toString(),i=s.indexOf('    evidence.objects={dd,d3d,texture,padding,rt,device};'),j=s.indexOf('  }finally{',i);
  assert(i>0&&j>i,'public fixture setup seams');
  return s.slice(0,i)+'return await ('+exercise.toString()+')({evidence,eq,check,raw,read,alloc,wa,words,guard,guid,com,ok,acquire,dd,hal,surface,device,d3d,rt,texture,padding},config.matrixOracle);\n'+s.slice(j);
}
async function run(file){
  const raw=fs.readFileSync(file),bytes=file.endsWith('.gz')?zlib.gunzipSync(raw):raw,ctx=fixture.offlineContext(bytes);
  let error=null;try{await vm.runInContext('('+source()+')',ctx)('gps',{...fixture.offlineConfig(),matrixOracle:ORACLE},'()=>null');}catch(e){error=e.stack;}
  return {moduleSHA256:sha(bytes),oracleSHA256:sha(JSON.stringify(ORACLE)),fixtureSHA256:sha(source()),...JSON.parse(JSON.stringify(ctx.legacyTextureEvidence||{})),error};
}
function inspect(r){
  const failures=(r.matrices||[]).filter(m=>JSON.stringify(m.got)!==JSON.stringify(m.want));
  if(r.error)failures.push({error:r.error});
  if(r.status!=='PASS'||r.matrices?.length!==217||r.calls?.length!==370)failures.push({error:'incomplete public COM fixture',status:r.status,checks:r.matrices?.length,calls:r.calls?.length});
  return {checks:r.matrices?.length||0,calls:r.calls?.length||0,failures:failures.length,examples:failures.slice(0,3)};
}
async function main(){
  if(process.argv.includes('--plan')){console.log(JSON.stringify({oracle:ORACLE,oracleSHA256:sha(JSON.stringify(ORACLE)),fixtureSHA256:sha(source())},null,2));return;}
  const file=process.argv.find(a=>a.startsWith('--wasm='))?.slice(7),out=process.argv.find(a=>a.startsWith('--out='))?.slice(6);
  if(out)fs.mkdirSync(out,{recursive:true});
  for(const f of file?[file]:['build/wine-assembly.wasm','build/wine-assembly.compat.wasm']){
    const r=await run(f),v=inspect(r);if(out)fs.writeFileSync(path.join(out,path.basename(f)+'.json.gz'),zlib.gzipSync(JSON.stringify(r)));
    console.log(JSON.stringify({moduleSHA256:r.moduleSHA256,oracleSHA256:r.oracleSHA256,...v}));if(v.failures)process.exitCode=1;
  }
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={ORACLE,source,run,inspect};
