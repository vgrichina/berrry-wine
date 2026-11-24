#!/usr/bin/env node
'use strict';

// Primary layout: Microsoft legacy d3dtypes.h D3DLIGHT / D3DLIGHT2:
// https://raw.githubusercontent.com/microsoft/win32metadata/main/generation/WinSDK/RecompiledIdlHeaders/um/d3dtypes.h
// x86 pack(4): 76-byte D3DLIGHT, 80-byte D3DLIGHT2, dwFlags at 76;
// ACTIVE=1, NO_SPECULAR=2. No Windows reference run exists. Existing project
// policy is zero-on-allocation and prefix replacement: a later 76-byte setter
// preserves the extended tail. Sizes below 4 retain the old 76-byte fallback.
// This test covers storage only, not flag effects on rendering.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const fixture=require('./test-legacy-texture-rendered-contract');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
// Independent literal IEEE words, including every legacy field through phi.
// Expected bytes never come from a production structure or lighting helper.
const LEGACY=[76,3,0x3f800000,0x3f000000,0x3e800000,0x3f800000,0x40000000,0x40400000,0x40800000,0,0,0xbf800000,0x42c80000,0x3f800000,0x3f800000,0x3e800000,0x3d800000,0x3f000000,0x3f800000];
const EXTENDED=[80,2,0x3e800000,0x3f000000,0x3f800000,0x3f000000,0x41000000,0x41100000,0x41200000,0x3f800000,0,0,0x43480000,0x40000000,0x3f000000,0x3e000000,0x3c800000,0x3e800000,0x3f400000,3];
const ORACLE={LEGACY,EXTENDED,sizes:[4,5,7,8,24,55,75,76,77,78,79,80,81,96,0xffffffff,0,1,2,3],guard:0xa5};

async function exercise(c,o){
  const {evidence,eq,check,read,alloc,wa,words,guid,com,ok,acquire,dd,device,d3d,rt,texture,padding,memory}=c;
  evidence.storage=[];
  const octets=ws=>ws.flatMap(w=>[w&255,(w>>>8)&255,(w>>>16)&255,w>>>24]);
  eq(o.LEGACY.length*4,76,'literal legacy layout');eq(o.EXTENDED.length*4,80,'literal extended layout');
  const legacy=octets(o.LEGACY),extended=octets(o.EXTENDED);
  const parentIID=await guid([0xbb223240,0x11d0e72b,0xaa00b4a9,0x3e99c000]);
  const parent=await acquire(p=>com('QI Direct3D3',dd,0,parentIID,p));
  const newLight=()=>acquire(p=>com('CreateLight3',parent,4,p,0));
  const A=await newLight(),B=await newLight();check(A!==B,'distinct public lights');
  const models=new Map([[A,null],[B,null]]);
  const input=await alloc(112),out=await alloc(112);
  const writeBytes=async(p,b)=>new Uint8Array(memory.buffer,await wa(p),b.length).set(b);
  const readBytes=async(p,n)=>Array.from(new Uint8Array(memory.buffer,await wa(p),n));
  const filled=()=>Array(112).fill(o.guard);
  // Independent public contract boundary, deliberately including unaligned
  // declared lengths and the existing invalid-size fallback.
  const count=size=>size<4?76:Math.min(size,80);
  async function set(obj,bytes,size,label){
    const before=filled();before.splice(8,bytes.length,...bytes);
    before.splice(8,4,...octets([size]));await writeBytes(input,before);
    await ok(com('SetLight '+label,obj,4,input+8));
    eq(await readBytes(input,112),before,'setter source and guards unchanged');
    const model=(models.get(obj)||Array(80).fill(0)).slice();
    model.splice(0,count(size),...before.slice(8,8+count(size)));models.set(obj,model);
  }
  async function get(obj,size,label){
    const before=filled();before.splice(8,4,...octets([size]));await writeBytes(out,before);
    await ok(com('GetLight '+label,obj,5,out+8));
    const expected=before.slice(),model=models.get(obj),n=count(size);
    expected.splice(8,n,...(model?model.slice(0,n):[...octets([n]),...Array(n-4).fill(0)]));
    evidence.storage.push({label,size,object:obj,got:await readBytes(out,112),want:expected});
  }
  await get(A,80,'fresh extended');await get(B,76,'fresh legacy');
  await ok(com('GetLight NULL',A,5,0));
  // NULL setter has always allocated zero backing; it remains successful.
  await ok(com('SetLight NULL',A,4,0));models.set(A,Array(80).fill(0));await get(A,80,'after NULL setter');
  await set(A,legacy,76,'legacy first');await get(A,80,'legacy first zero tail');
  await set(B,extended,80,'distinct extended');await get(A,80,'other light untouched');await get(B,80,'extended flags both');
  for(const flags of [1,2,3,0,2,1,3]){
    const bytes=extended.slice();bytes.splice(76,4,...octets([flags]));
    await set(A,bytes,80,'flags '+flags);await get(A,80,'flags '+flags);await get(A,76,'legacy read after flags');
    await set(A,legacy,76,'legacy prefix after flags');await get(A,80,'legacy preserves flags '+flags);
    await get(B,80,'distinct retained flags');
  }
  for(const size of o.sizes){
    await set(A,extended,size,'declared '+size);
    for(const outputSize of [4,7,75,76,77,79,80,96,0,3])await get(A,outputSize,'boundary '+size+'/'+outputSize);
  }
  // QueryInterface returns a public alias and retains the same storage.
  const iid=await guid([0x4417c142,0x11cf33ad,0x00006f81,0x6e1520c0]);
  const alias=await acquire(p=>com('QI Light alias',A,0,iid,p));models.set(alias,models.get(A));
  eq(await com('AddRef alias',alias,1),3,'shared refcount');
  eq(await com('Release nonfinal A',A,2),2,'nonfinal release');await get(alias,80,'alias retained storage');
  eq(await com('Release alias extra',alias,2),1,'remaining reference');
  await set(alias,extended,80,'alias update');await get(alias,80,'alias update read');
  eq(await com('Release final alias',alias,2),0,'final release');
  eq(await com('Release B',B,2),0,'distinct final release');
  for(let i=0;i<4;i++){
    const obj=await newLight();models.set(obj,null);await get(obj,80,'recreate clean '+i);
    await set(obj,legacy,76,'recreate legacy '+i);await get(obj,80,'recreate zero tail '+i);
    eq(await com('Release recreated',obj,2),0,'recreated final release');
  }
  // Readable invalid-this uses the existing zero-sentinel entry policy.
  const invalid=await alloc(8);await words(invalid,[await read(alias),0xffffffff]);
  // Keep only the NULL-output characterization: no new invalid-pointer or
  // invalid-object validation is introduced by the backing-size fix.
  await ok(com('invalid-this NULL GetLight',invalid,5,0));
  for(const obj of [parent,device,rt,d3d,texture,padding,dd])await com('Release fixture',obj,2);
  evidence.status='PASS';return evidence;
}
function source(){
  const s=fixture.browserFixture.toString(),i=s.indexOf('    evidence.objects={dd,d3d,texture,padding,rt,device};'),j=s.indexOf('  }finally{',i);
  assert(i>0&&j>i,'public fixture setup seams');
  return s.slice(0,i)+'return await ('+exercise.toString()+')({evidence,eq,check,read,alloc,wa,words,guid,com,ok,acquire,dd,device,d3d,rt,texture,padding,memory},config.storageOracle);\n'+s.slice(j);
}
async function run(file){
  const raw=fs.readFileSync(file),bytes=file.endsWith('.gz')?zlib.gunzipSync(raw):raw,ctx=fixture.offlineContext(bytes);
  let error=null;try{await vm.runInContext('('+source()+')',ctx)('gps',{...fixture.offlineConfig(),storageOracle:ORACLE},'()=>null');}catch(e){error=e.stack;}
  return {moduleSHA256:sha(bytes),oracleSHA256:sha(JSON.stringify(ORACLE)),fixtureSHA256:sha(source()),...JSON.parse(JSON.stringify(ctx.legacyTextureEvidence||{})),error};
}
function inspect(r){
  const failures=(r.storage||[]).filter(m=>JSON.stringify(m.got)!==JSON.stringify(m.want));
  if(r.error)failures.push({error:r.error});
  if(r.status!=='PASS'||r.storage?.length!==234)failures.push({error:'incomplete public COM fixture',status:r.status,checks:r.storage?.length});
  return {checks:r.storage?.length||0,calls:r.calls?.length||0,failures:failures.length,examples:failures.slice(0,2)};
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
