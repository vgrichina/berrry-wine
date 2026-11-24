#!/usr/bin/env node
'use strict';

// Microsoft-authored DX5 D3DLIGHT2 reference (non-unit directions permitted):
// https://library.thedatadungeon.com/directx5/html/dire1sxa.content.htm
// Requested cosine-interpolation equation and half-angle convention:
// https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_04h0.content.htm
// spot=((rho-cos(phi/2))/(cos(theta/2)-cos(phi/2)))^falloff in
// the penumbra; full inside, zero outside. The older DX5 equation image uses
// a different angular-ratio curve and its Phi prose reverses angle ordering.
// This test explicitly covers the requested imover model, 0<theta<phi<pi,
// nonzero directions, full80 ACTIVE; it makes no Windows/Wine oracle claim.
// cos(theta/2)=.9, cos(phi/2)=.5, rho=.8 gives .75, squared=.5625.
// White aligned diffuse gives literal RGB 191/143; normalized distance q=.5
// multiplies these to 95/71. One byte of quantization tolerance is admitted.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib');
const fixture=require('./test-legacy-texture-rendered-contract');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const ORACLE={theta:0.9020536235925247,phi:2.0943951023931953,rows:[
  ['axis',[0,0,1],1,255],['inner nonaxis',[.28,0,.96],1,255],
  ['penumbra',[.6,0,.8],1,191],['penumbra squared',[.6,0,.8],2,143],
  ['outside',[1,0,0],1,0],['reversed',[0,0,-1],1,0],
  ['nonunit axis',[0,0,7],2,255],['nonunit penumbra',[3,0,4],1,191],
  ['nonunit squared',[-3,0,4],2,143],['y penumbra',[0,.6,.8],1,191],
  ['negative y squared',[0,-3,4],2,143],['nonunit outside',[7,0,0],2,0],
  ['distance product',[3,0,4],1,95,2,[0,1,0],4],
  ['distance squared product',[3,0,4],2,71,2,[0,1,0],4],
  ['range excludes axis',[0,0,1],1,0,10],
  ['range excludes penumbra',[3,0,4],1,0,10],
  ['point ignores cone',[0,0,-1],2,255,2,[1,0,0],8,1],
  ['directional ignores range',[0,0,7],2,255,10,[0,0,0],.125,3],
  ['legacy reciprocal linear',[0,0,1],1,127,2,[0,1,0],8,1,76],
  ['legacy reciprocal squared',[0,0,1],1,63,2,[0,0,1],8,1,76],
  ['transition outside',[0,0,-1],1,0],['transition inner',[0,0,1],1,255],
  ['transition penumbra',[3,0,4],1,191],['transition squared',[3,0,4],2,143],
  ['transition point',[0,0,-1],1,255,2,[1,0,0],8,1],
  ['transition spot',[0,0,-1],1,0],
  ['angles widen inner',[3,0,4],1,255,2,[1,0,0],8,2,80,1.590797660368287,2.5],
  ['angles narrow outer',[3,0,4],1,0,2,[1,0,0],8,2,80,.2,.8],
  ['angles restore',[3,0,4],1,191],
  ['distance restore',[3,0,4],2,71,2,[0,1,0],4]
]};

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
  async function set(row){
    const [label,direction,falloff,want,d=2,coeff=[1,0,0],range=8,type=2,size=80,theta=o.theta,phi=o.phi]=row;
    await words(input.p,[size,type,...[1,1,1,1,0,0,.5-d,...direction,range,falloff,...coeff,theta,phi].map(bits),1]);
    const before=await snapshot(input.p,80);
    await ok(com('SetLight '+label,light,4,input.p));await input.check();
    eq(await snapshot(input.p,80),before,'SetLight source bytes including legacy tail');
    await write(out.p,80);await ok(com('GetLight '+label,light,5,out.p));await out.check();
    eq(await read(out.p),size,'GetLight declared size');
    eq((await snapshot(out.p,76)).slice(4),before.slice(4,76),'GetLight cone/direction/distance source');
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
  for(const row of o.rows){await set(row);await draw(row[0],Array(3).fill(row[3]));}
  for(const obj of [light,material,dev,parent,device,rt,d3d,texture,padding,dd])await com('Release fixture',obj,2);
  evidence.status='PASS';return evidence;
}
function source(){
  const base=fixture.browserFixture.toString(),seam='  let e,raw,link,manager,port,lastStats,gpu,holding=false,heldRecord;';
  assert(base.includes(seam),'public fixture host math seam');
  const s=base.replace(seam,'  host.math_cos=Math.cos;host.math_pow=Math.pow;\n'+seam),i=s.indexOf('    evidence.objects={dd,d3d,texture,padding,rt,device};'),j=s.indexOf('  }finally{',i);
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
  if(r.status!=='PASS'||r.pixels?.length!==ORACLE.rows.length)failures.push({error:'incomplete public draw fixture',status:r.status,checks:r.pixels?.length});
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
