#!/usr/bin/env node
'use strict';

// Microsoft-authored DirectX 5 SDK, D3DLIGHT2, dvAttenuation0..2:
// https://library.thedatadungeon.com/directx5/html/dire1sxa.content.htm
// q=(range-distance)/range, intensity=a0+a1*q+a2*q*q. This is distinct
// from D3DLIGHT's reciprocal polynomial. These literal RGB expectations
// precede execution and never call or inspect a production lighting helper.
// White diffuse, black ambient/emissive, aligned unit normal, range=8:
// d=1,2,4,6,8 gives q=7/8,3/4,1/2,1/4,0. Quantization tolerance is one
// byte; exact geometry and COM stack/guards are checked separately.
// Coincident positions, zero/nonfinite ranges and negative dark lights are
// outside this test's contract. No Wine or Windows runtime oracle is used.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib');
const fixture=require('./test-legacy-texture-rendered-contract');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const ORACLE={distances:[1,2,4,6,8,10],linear:[223,191,127,63,0,0],
  quadratic:[195,143,63,15,0,0],constant:[255,255,255,255,255,0],
  legacyLinear:[255,127,63,42,31,0],legacyQuadratic:[255,63,15,7,3,0],
  mixed:[63,127,0],combined:[95,95,95],amplified:[127,127,127],
  repeated:[127,191,127,143,255,127],directional:[0,0,255]};

async function exercise(c,o){
  const {evidence,eq,check,read,write,wa,words,guard,guid,com,ok,acquire,dd,device,d3d,rt,texture,padding,memory}=c;
  evidence.pixels=[];
  const f=new DataView(new ArrayBuffer(4)),bits=n=>{f.setFloat32(0,n,true);return f.getUint32(0,true);};
  const snapshot=async(p,n)=>Array.from(new Uint8Array(memory.buffer,await wa(p),n));
  const parent=await acquire(async p=>com('QI Direct3D3',dd,0,await guid([0xbb223240,0x11d0e72b,0xaa00b4a9,0x3e99c000]),p));
  const dev=await acquire(async p=>com('QI Device2',device,0,await guid([0x93281501,0x11d08cf8,0xa000ab89,0x294105c9]),p));
  const material=await acquire(p=>com('CreateMaterial3',parent,5,p,0));
  const m=await guard(80);
  await words(m.p,[80,...[1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0].map(bits),0,0]);
  const mb=await snapshot(m.p,80);await ok(com('SetMaterial3',material,3,m.p));
  await m.check();eq(await snapshot(m.p,80),mb,'material source bytes');
  const h=await guard(4);await ok(com('GetHandle material',material,5,dev,h.p));await h.check();
  await ok(com('SetLightState material',dev,25,1,await read(h.p)));
  await ok(com('SetLightState ambient',dev,25,2,0));
  const vp=await guard(24);await words(vp.p,[0,0,8,8,0,bits(1)]);
  await ok(com('SetViewport7 shared device',device,13,vp.p));await vp.check();
  for(const [id,v] of [[7,0],[14,0],[15,0],[22,1],[27,0],[28,0],[29,0],[41,0]])
    await ok(com('SetRenderState2 '+id,dev,23,id,v));
  // One exact world position projects to (4,4). POINTLIST exercises the real
  // public lit-geometry draw and pixel path without distance interpolation.
  const vertices=await guard(32);await words(vertices.p,[0,0,.5,0,0,-1,0,0].map(bits));
  const sourceBytes=await snapshot(vertices.p,32),input=await guard(80),out=await guard(80);
  const light=await acquire(p=>com('CreateLight3',parent,4,p,0));
  async function set(obj,size,type,d,coeff,range=8,color=[1,1,1]){
    await words(input.p,[size,type,...[...color,1,0,0,.5-d,0,0,1,range,1,...coeff,0,0].map(bits),1]);
    const before=await snapshot(input.p,80);
    await ok(com('SetLight',obj,4,input.p));await input.check();
    eq(await snapshot(input.p,80),before,'SetLight source including legacy tail');
    await write(out.p,80);await ok(com('GetLight',obj,5,out.p));await out.check();
    eq(await read(out.p),size,'GetLight declared size');
    eq((await snapshot(out.p,76)).slice(4),before.slice(4,76),'GetLight coefficient/position bytes');
    if(size===80)eq(await read(out.p+76),1,'ACTIVE retained');
  }
  const lockDesc=await guard(124);
  async function lock(){
    await words(lockDesc.p,Array(31).fill(0));await write(lockDesc.p,124);
    await ok(com('Lock target',rt,25,0,lockDesc.p,1,0));await lockDesc.check();
    eq(await read(lockDesc.p+84),32,'32-bit target');
    return {p:await read(lockDesc.p+36),pitch:await read(lockDesc.p+16)};
  }
  async function draw(label,want){
    const l=await lock();for(let y=0;y<8;y++)for(let x=0;x<8;x++)await write(l.p+y*l.pitch+x*4,0xffd10bcd);
    await ok(com('Unlock poison',rt,32,0));await ok(com('BeginScene2',dev,10));
    await ok(com('DrawPrimitive2 lit POINTLIST',dev,29,1,1,vertices.p,1,0));
    await ok(com('EndScene2',dev,11));
    const got=await lock(),px=await read(got.p+4*got.pitch+4*4);
    eq(await read(got.p),0xffd10bcd,'undrawn pixel unchanged');
    await ok(com('Unlock pixels',rt,32,0));await vertices.check();
    eq(await snapshot(vertices.p,32),sourceBytes,'draw source bytes');
    evidence.pixels.push({label,want,samples:[[px>>>16&255,px>>>8&255,px&255]]});
  }
  for(const type of [1,2])for(const [name,coeff] of [['linear',[0,1,0]],['quadratic',[0,0,1]],['constant',[1,0,0]]])
    for(let i=0;i<o.distances.length;i++){
      await set(light,80,type,o.distances[i],coeff);
      await draw('full80 type'+type+' '+name+' d'+o.distances[i],Array(3).fill(o[name][i]));
    }
  for(const size of [76,77,78,79])for(const [name,coeff] of [['legacyLinear',[0,1,0]],['legacyQuadratic',[0,0,1]]])
    for(let i=0;i<o.distances.length;i++){
      await set(light,size,1,o.distances[i],coeff);
      await draw('legacy'+size+' '+name+' d'+o.distances[i],Array(3).fill(o[name][i]));
    }
  await set(light,80,1,4,[.125,.25,.5]);await draw('combined polynomial',o.combined);
  await set(light,80,1,4,[2,0,0],8,[.25,.25,.25]);await draw('factor greater than one',o.amplified);
  // Same light alternates sizes, coefficients and ranges. No cached state or
  // stale extended flags may determine the next public draw's color.
  const transitions=[[80,[0,1,0],4],[80,[0,1,0],8],[76,[0,1,0],8],
    [80,[0,0,1],8],[80,[1,0,0],8],[80,[0,1,0],4]];
  for(let i=0;i<transitions.length;i++){
    const [size,coeff,range]=transitions[i];await set(light,size,1,2,coeff,range);
    await draw('repeated SetLight '+i,Array(3).fill(o.repeated[i]));
  }
  const other=await acquire(p=>com('CreateLight3',parent,4,p,0));
  for(const swap of [false,true]){
    await set(light,swap?80:76,1,4,[0,1,0],8,swap?[0,1,0]:[1,0,0]);
    await set(other,swap?76:80,1,4,[0,1,0],8,swap?[1,0,0]:[0,1,0]);
    await draw('mixed76/80 swap'+swap,o.mixed);
  }
  eq(await com('Release mixed light',other,2),0,'mixed light destroyed');
  for(const size of [76,80]){
    await set(light,size,3,100,[0,0,0],.125,[0,0,1]);await draw('directional'+size,o.directional);
  }
  for(const obj of [light,material,dev,parent,device,rt,d3d,texture,padding,dd])await com('Release fixture',obj,2);
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
  if(r.status!=='PASS'||r.pixels?.length!==96)failures.push({error:'incomplete public draw fixture',status:r.status,checks:r.pixels?.length});
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
