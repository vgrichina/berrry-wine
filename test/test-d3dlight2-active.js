#!/usr/bin/env node
'use strict';

// Microsoft d3dtypes.h (x86 pack(4)): D3DLIGHT=76, D3DLIGHT2=80,
// dwFlags@76, D3DLIGHT_ACTIVE=1:
// https://raw.githubusercontent.com/microsoft/win32metadata/main/generation/WinSDK/RecompiledIdlHeaders/um/d3dtypes.h
// Microsoft-authored DirectX 5 SDK reference, preserved mirror: an absent
// ACTIVE flag means the light is ignored. No Windows runtime reference exists.
// https://library.thedatadungeon.com/directx5/html/dire1sxa.content.htm
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib');
const fixture=require('./test-legacy-texture-rendered-contract');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
// Frozen, independent simple directional-light oracle: N=(0,0,-1),
// direction=(0,0,1), material diffuse=ambient=.5, emissive=(1,2,3)/16,
// ambient RGB=(32,64,96)/255. Baseline light=(1,1,1)/8;
// switched light=(1,2,3)/4. RGB=255*(emissive+.5*ambient+.5*sum(lights)).
// Literal rounded RGB below admits one byte of float/UNORM quantization.
// Four small lights=(1,1,1)/16 give (64,96,128). A fifth must be excluded.
const ORACLE={active:[80,144,207],inactive:[48,80,112],four:[64,96,128],
  baseline:[.125,.125,.125],switched:[.25,.5,.75],small:[.0625,.0625,.0625],ambient:0x204060};

async function exercise(c,o){
  const {evidence,eq,check,read,write,alloc,wa,words,guard,guid,com,ok,acquire,dd,device,d3d,rt,texture,padding,memory}=c;
  evidence.pixels=[];
  const f=new DataView(new ArrayBuffer(4)),bits=n=>{f.setFloat32(0,n,true);return f.getUint32(0,true);};
  const snapshot=async(p,n)=>Array.from(new Uint8Array(memory.buffer,await wa(p),n));
  const parent=await acquire(async p=>com('QI Direct3D3',dd,0,await guid([0xbb223240,0x11d0e72b,0xaa00b4a9,0x3e99c000]),p));
  const dev=await acquire(async p=>com('QI Device2',device,0,await guid([0x93281501,0x11d08cf8,0xa000ab89,0x294105c9]),p));
  const material=await acquire(p=>com('CreateMaterial3',parent,5,p,0));
  const m=await guard(80);
  await words(m.p,[80,...[.5,.5,.5,1,.5,.5,.5,1,0,0,0,0,.0625,.125,.1875,0,0].map(bits),0,0]);
  const mb=await snapshot(m.p,80);await ok(com('SetMaterial3',material,3,m.p));
  await m.check();eq(await snapshot(m.p,80),mb,'material source bytes');
  const h=await guard(4);await ok(com('GetHandle material',material,5,dev,h.p));await h.check();
  await ok(com('SetLightState material',dev,25,1,await read(h.p)));
  await ok(com('SetLightState ambient',dev,25,2,o.ambient));
  const vp=await guard(24);await words(vp.p,[0,0,8,8,0,bits(1)]);
  await ok(com('SetViewport7 shared device',device,13,vp.p));await vp.check();
  for(const [id,v] of [[7,0],[14,0],[15,0],[22,1],[27,0],[28,0],[29,0],[41,0]])
    await ok(com('SetRenderState2 '+id,dev,23,id,v));
  const vertices=await guard(96);
  for(const [i,[x,y]] of [[-1,-1],[3,-1],[-1,3]].entries())
    await words(vertices.p+32*i,[x,y,.5,0,0,-1,0,0].map(bits));
  const sourceBytes=await snapshot(vertices.p,96);
  const input=await guard(80);
  const newLight=()=>acquire(p=>com('CreateLight3',parent,4,p,0));
  async function set(obj,size,flags,color,label){
    await words(input.p,[size,3,...[...color,1,0,0,0,0,0,1,100,1,1,0,0,0,0].map(bits),flags]);
    const before=await snapshot(input.p,80);
    await ok(com('SetLight '+label,obj,4,input.p));await input.check();
    eq(await snapshot(input.p,80),before,'SetLight source and declared-size tail immutable');
    const out=await guard(80);await write(out.p,80);await ok(com('GetLight '+label,obj,5,out.p));await out.check();
    eq(await read(out.p),size,'GetLight declared size');
    if(size===80)eq(await read(out.p+76),flags,'GetLight flags');
  }
  const lockDesc=await guard(124);
  async function draw(label,want){
    // Poison the real target via public Lock, so missing geometry cannot pass.
    async function lock(){
      await words(lockDesc.p,Array(31).fill(0));await write(lockDesc.p,124);
      await ok(com('Lock target',rt,25,0,lockDesc.p,1,0));await lockDesc.check();
      eq(await read(lockDesc.p+84),32,'32-bit target');
      return {p:await read(lockDesc.p+36),pitch:await read(lockDesc.p+16)};
    }
    const l=await lock();for(let y=0;y<8;y++)for(let x=0;x<8;x++)await write(l.p+y*l.pitch+x*4,0xffd10bcd);
    await ok(com('Unlock poison',rt,32,0));
    await ok(com('BeginScene2',dev,10));
    await ok(com('DrawPrimitive2 D3DVERTEX',dev,29,4,1,vertices.p,3,0));
    await ok(com('EndScene2',dev,11));
    const got=await lock(),samples=[];
    for(const [x,y] of [[2,2],[4,3],[3,5]]){
      const px=await read(got.p+y*got.pitch+x*4);samples.push([px>>>16&255,px>>>8&255,px&255]);
    }
    await ok(com('Unlock pixels',rt,32,0));await vertices.check();
    eq(await snapshot(vertices.p,96),sourceBytes,'draw source bytes and guards');
    evidence.pixels.push({label,want,samples});
  }
  // A real active baseline prevents the legacy zero-light fallback from
  // hiding ignored-light failures. That fallback is deliberately unchanged.
  let a=await newLight(),baseline=await newLight();
  await set(baseline,80,1,o.baseline,'baseline');
  for(const flags of [1,0,1,2,3,0,1]){
    await set(a,80,flags,o.switched,'transition '+flags);
    await draw('transition '+flags,flags&1?o.active:o.inactive);
  }
  // A legacy write must not consult stale extended flags, even at size 79.
  for(const size of [76,77,78,79]){
    await set(a,80,0,o.switched,'inactive before legacy');
    await set(a,size,0,o.switched,'legacy prefix '+size);await draw('legacy '+size,o.active);
  }
  const iid=await guid([0x4417c142,0x11cf33ad,0x00006f81,0x6e1520c0]);
  const alias=await acquire(p=>com('QI Light alias',a,0,iid,p));
  eq(await com('Release original',a,2),1,'alias retains light');
  for(const flags of [0,1,0]){await set(alias,80,flags,o.switched,'alias '+flags);await draw('alias '+flags,flags?o.active:o.inactive);}
  eq(await com('Release final alias',alias,2),0,'alias destroyed');await draw('destroyed target',o.inactive);
  for(let i=0;i<3;i++){
    a=await newLight();await draw('fresh uninitialized '+i,o.inactive);
    await set(a,80,0,o.switched,'recreate inactive');await draw('recreate inactive '+i,o.inactive);
    await set(a,76,0,o.switched,'recreate legacy');await draw('recreate legacy '+i,o.active);
    eq(await com('Release recreated',a,2),0,'destroy recreated');
  }
  eq(await com('Release baseline',baseline,2),0,'baseline destroyed');
  // Four initialized inactive early slots must leave room for four active
  // later slots. Legacy76 and full80 callers share the same capacity.
  const early=[],late=[];
  for(let i=0;i<4;i++){const obj=await newLight();early.push(obj);await set(obj,80,2,o.switched,'early inactive '+i);}
  for(let i=0;i<5;i++){
    const obj=await newLight();late.push(obj);
    await set(obj,i%2?76:80,i===4?1:3,i===4?o.switched:o.small,'late '+i);
  }
  await draw('four active capacity mixed76/80 fifth excluded',o.four);
  for(const obj of [...early,...late])eq(await com('Release capacity light',obj,2),0,'capacity final release');
  for(const obj of [material,dev,parent,device,rt,d3d,texture,padding,dd])await com('Release fixture',obj,2);
  evidence.status='PASS';return evidence;
}
function source(){
  const s=fixture.browserFixture.toString(),i=s.indexOf('    evidence.objects={dd,d3d,texture,padding,rt,device};'),j=s.indexOf('  }finally{',i);
  assert(i>0&&j>i,'public fixture setup seams');
  return s.slice(0,i)+'return await ('+exercise.toString()+')({evidence,eq,check,read,write,alloc,wa,words,guard,guid,com,ok,acquire,dd,device,d3d,rt,texture,padding,memory},config.lightOracle);\n'+s.slice(j);
}
async function run(file){
  const raw=fs.readFileSync(file),bytes=file.endsWith('.gz')?z.gunzipSync(raw):raw,ctx=fixture.offlineContext(bytes);
  let error=null;try{await vm.runInContext('('+source()+')',ctx)('gps',{...fixture.offlineConfig(),lightOracle:ORACLE},'()=>null');}catch(e){error=e.stack;}
  return {moduleSHA256:sha(bytes),oracleSHA256:sha(JSON.stringify(ORACLE)),fixtureSHA256:sha(source()),...JSON.parse(JSON.stringify(ctx.legacyTextureEvidence||{})),error};
}
function inspect(r){
  const failures=(r.pixels||[]).filter(row=>row.samples.some(rgb=>rgb.some((v,i)=>Math.abs(v-row.want[i])>1)));
  if(r.error)failures.push({error:r.error});
  if(r.status!=='PASS'||r.pixels?.length!==25)failures.push({error:'incomplete public draw fixture',status:r.status,checks:r.pixels?.length});
  return {checks:r.pixels?.length||0,calls:r.calls?.length||0,failures:failures.length,examples:failures.slice(0,3)};
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
