#!/usr/bin/env node
'use strict';

// Microsoft-authored DirectX 5 SDK, Materials (preserved reference):
// https://library.thedatadungeon.com/directx5/html/dire1acu.content.htm
// Equation and diffuse-material alpha, Microsoft DirectX 6 SDK (diffamb.gif):
// https://library.thedatadungeon.com/directx6/devdoc/live/directx/imover_1rj8.content.htm
// With no direct lights: RGB = emissive + material.ambient * scene.ambient.
// No Windows/Wine runtime oracle. The unbound fallback controls describe the
// existing project policy, not Microsoft conformance.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib');
const fixture=require('./test-legacy-texture-rendered-contract');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
// Independent literal inputs and rounded outputs, frozen before source edits.
// .5*(32,64,96) + 255*(1/8,3/16,1/4) = (47.875,79.8125,111.75).
// Aligned light (.25,.5,.75) adds 255*.5*light; diffuse alpha=.5 halves RGB
// when SRCALPHA/INVSRCALPHA blends over black. One UNORM byte is admitted.
const ORACLE={ambient:0x204060,emissive:[.125,.1875,.25],combined:[48,80,112],
  active:[80,144,207],ambientOnly:[16,32,48],emissiveOnly:[32,48,64],
  halfAlpha:[24,40,56],black:[0,0,0],fallbackZ:[255,255,255],fallbackX:[63,63,63],
  normals:[[0,0,-1],[1,0,0],[0,1,0],[0,0,1],[0,0,-7],[0,0,0]],checks:29};

async function exercise(c,o){
  const {evidence,eq,check,read,write,wa,words,guard,guid,com,ok,acquire,dd,device,d3d,rt,texture,padding,memory}=c;
  evidence.pixels=[];
  const f=new DataView(new ArrayBuffer(4)),bits=n=>{f.setFloat32(0,n,true);return f.getUint32(0,true);};
  const snapshot=async(p,n)=>Array.from(new Uint8Array(memory.buffer,await wa(p),n));
  const parent=await acquire(async p=>com('QI Direct3D3',dd,0,await guid([0xbb223240,0x11d0e72b,0xaa00b4a9,0x3e99c000]),p));
  const dev=await acquire(async p=>com('QI Device2',device,0,await guid([0x93281501,0x11d08cf8,0xa000ab89,0x294105c9]),p));
  const vp=await guard(24);await words(vp.p,[0,0,8,8,0,bits(1)]);
  await ok(com('SetViewport7 shared device',device,13,vp.p));await vp.check();
  for(const [id,v] of [[7,0],[14,0],[15,0],[19,5],[20,6],[22,1],[27,0],[28,0],[29,0],[41,0]])
    await ok(com('SetRenderState2 '+id,dev,23,id,v));
  const vertices=await guard(96),lockDesc=await guard(124);
  async function normal(n){
    for(const [i,[x,y]] of [[-1,-1],[3,-1],[-1,3]].entries())
      await words(vertices.p+32*i,[x,y,.5,...n,0,0].map(bits));
  }
  async function draw(label,want,background=0xffd10bcd){
    const before=await snapshot(vertices.p,96);
    async function lock(){
      await words(lockDesc.p,Array(31).fill(0));await write(lockDesc.p,124);
      await ok(com('Lock target',rt,25,0,lockDesc.p,1,0));await lockDesc.check();
      eq(await read(lockDesc.p+84),32,'32-bit target');
      return {p:await read(lockDesc.p+36),pitch:await read(lockDesc.p+16)};
    }
    const l=await lock();for(let y=0;y<8;y++)for(let x=0;x<8;x++)await write(l.p+y*l.pitch+x*4,background);
    await ok(com('Unlock poison',rt,32,0));
    await ok(com('BeginScene2',dev,10));
    await ok(com('DrawPrimitive2 D3DVERTEX',dev,29,4,1,vertices.p,3,0));
    await ok(com('EndScene2',dev,11));
    const got=await lock(),samples=[];
    for(const [x,y] of [[2,2],[4,3],[3,5]]){
      const px=await read(got.p+y*got.pitch+x*4);samples.push([px>>>16&255,px>>>8&255,px&255]);
    }
    await ok(com('Unlock pixels',rt,32,0));await vertices.check();
    eq(await snapshot(vertices.p,96),before,'draw source bytes and guards');
    evidence.pixels.push({label,want,samples});
  }
  // No light object or material has ever been created: preserve shape policy.
  await ok(com('SetLightState material unbound',dev,25,1,0));
  await normal([0,0,-1]);await draw('unconfigured fallback Z',o.fallbackZ);
  await normal([1,0,0]);await draw('unconfigured fallback X',o.fallbackX);
  const material=await acquire(p=>com('CreateMaterial3',parent,5,p,0));
  const m=await guard(80),h=await guard(4);
  async function materialSet(ambient=.5,emissive=o.emissive,alpha=1){
    await words(m.p,[80,...[.5,.5,.5,alpha,ambient,ambient,ambient,1,0,0,0,0,...emissive,0,0].map(bits),0,0]);
    const before=await snapshot(m.p,80);await ok(com('SetMaterial3',material,3,m.p));await m.check();
    eq(await snapshot(m.p,80),before,'material source immutable');
    const out=await guard(80);await write(out.p,80);await ok(com('GetMaterial3',material,4,out.p));await out.check();
    eq(await snapshot(out.p,80),before,'material public roundtrip');
  }
  await materialSet();await ok(com('GetHandle material',material,5,dev,h.p));await h.check();
  const handle=await read(h.p);
  async function state(id,value){
    await ok(com('SetLightState '+id,dev,25,id,value));
    const out=await guard(4);await ok(com('GetLightState '+id,dev,24,id,out.p));await out.check();
    eq(await read(out.p),value,'lightstate public roundtrip');
  }
  await state(1,handle);await state(2,o.ambient);
  for(const n of o.normals){await normal(n);await draw('neverconfigured explicit material '+n,o.combined);}
  await normal([0,0,-1]);
  const input=await guard(80),newLight=()=>acquire(p=>com('CreateLight3',parent,4,p,0));
  async function set(obj,size,flags){
    await words(input.p,[size,3,...[.25,.5,.75,1,0,0,0,0,0,1,100,1,1,0,0,0,0].map(bits),flags]);
    const before=await snapshot(input.p,80);await ok(com('SetLight',obj,4,input.p));await input.check();
    eq(await snapshot(input.p,80),before,'light source immutable');
    const out=await guard(80);await write(out.p,80);await ok(com('GetLight',obj,5,out.p));await out.check();
    eq(await snapshot(out.p,size),before.slice(0,size),'light public roundtrip');
  }
  let light=await newLight();await draw('created never SetLight',o.combined);
  for(const flags of [0,2,1,0,1,3,2]){
    await set(light,80,flags);await draw('full80 transition '+flags,flags&1?o.active:o.combined);
  }
  for(const n of [[1,0,0],[0,0,1]]){await normal(n);await draw('allinactive normal '+n,o.combined);}
  await normal([0,0,-1]);
  await set(light,76,0);await draw('legacy76 ignores stale inactive flag',o.active);
  eq(await com('Release final active light',light,2),0,'final light destroyed');
  await draw('destroyed final active light',o.combined);
  light=await newLight();await set(light,80,0);
  const second=await newLight();await set(second,80,2);await draw('allinactive multiple80',o.combined);
  await materialSet(.5,[0,0,0]);await draw('ambient only zeroactive',o.ambientOnly);
  await materialSet(0);await draw('emissive only zeroactive',o.emissiveOnly);
  await materialSet(0,[0,0,0]);await draw('black despite nonzero diffuse',o.black);
  await materialSet();await state(2,0);await draw('zero scene ambient preserves emission',o.emissiveOnly);await state(2,o.ambient);
  await ok(com('SRCALPHA blend enabled',dev,23,27,1));
  await materialSet(.5,o.emissive,.5);await draw('material half alpha zeroactive',o.halfAlpha,0xff000000);
  await materialSet(.5,o.emissive,0);await draw('material zero alpha zeroactive',o.black,0xff000000);
  await ok(com('blend disabled',dev,23,27,0));
  await state(1,0);await normal([1,0,0]);await draw('unbound allinactive fallback X',o.fallbackX);
  await normal([0,0,-1]);await draw('unbound allinactive fallback Z',o.fallbackZ);
  for(const obj of [second,light,material,dev,parent,device,rt,d3d,texture,padding,dd])await com('Release fixture',obj,2);
  evidence.status='PASS';return evidence;
}
function source(){
  const s=fixture.browserFixture.toString(),i=s.indexOf('    evidence.objects={dd,d3d,texture,padding,rt,device};'),j=s.indexOf('  }finally{',i);
  assert(i>0&&j>i,'public fixture setup seams');
  return s.slice(0,i)+'return await ('+exercise.toString()+')({evidence,eq,check,read,write,wa,words,guard,guid,com,ok,acquire,dd,device,d3d,rt,texture,padding,memory},config.lightOracle);\n'+s.slice(j);
}
async function run(file){
  const raw=fs.readFileSync(file),bytes=file.endsWith('.gz')?z.gunzipSync(raw):raw,ctx=fixture.offlineContext(bytes);
  let error=null;try{await vm.runInContext('('+source()+')',ctx)('gps',{...fixture.offlineConfig(),lightOracle:ORACLE},'()=>null');}catch(e){error=e.stack;}
  return {moduleSHA256:sha(bytes),oracleSHA256:sha(JSON.stringify(ORACLE)),fixtureSHA256:sha(source()),...JSON.parse(JSON.stringify(ctx.legacyTextureEvidence||{})),error};
}
function inspect(r){
  const failures=(r.pixels||[]).filter(row=>row.samples.some(rgb=>rgb.some((v,i)=>Math.abs(v-row.want[i])>1)));
  if(r.error)failures.push({error:r.error});
  if(r.status!=='PASS'||r.pixels?.length!==ORACLE.checks)failures.push({error:'incomplete public draw fixture',status:r.status,checks:r.pixels?.length});
  return {checks:r.pixels?.length||0,calls:r.calls?.length||0,failures:failures.length,examples:failures.slice(0,4)};
}
async function main(){
  if(process.argv.includes('--plan')){console.log(JSON.stringify({oracle:ORACLE,oracleSHA256:sha(JSON.stringify(ORACLE)),fixtureSHA256:sha(source())},null,2));return;}
  const file=process.argv.find(a=>a.startsWith('--wasm='))?.slice(7),out=process.argv.find(a=>a.startsWith('--out='))?.slice(6);
  if(out)fs.mkdirSync(out,{recursive:true});
  for(const f of file?[file]:['build/wine-assembly.wasm','build/wine-assembly.compat.wasm']){
    const r=await run(f),v=inspect(r);if(out)fs.writeFileSync(path.join(out,path.basename(f)+'.json.gz'),z.gzipSync(JSON.stringify(r)));
    console.log(JSON.stringify({moduleSHA256:r.moduleSHA256,oracleSHA256:r.oracleSHA256,...v}));if(v.failures)process.exitCode=1;
  }
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={ORACLE,source,run,inspect};
