#!/usr/bin/env node
'use strict';

// Microsoft DX5 SDK (preserved primary reference):
// dire8c89: PARALLELPOINT acts directional, light position -> geometry origin.
// dire1sxa: position is world-space; direction only affects types 2 and 3.
// dire8l7u: world transforms model coordinates, including its local origin,
// and does not transform lights. Thus L = position - world*(0,0,0,1).
// https://library.thedatadungeon.com/directx5/html/dire8c89.content.htm
// https://library.thedatadungeon.com/directx5/html/dire1sxa.content.htm
// https://library.thedatadungeon.com/directx5/html/dire8l7u.content.htm
// Only rigid worlds here; no inverse-normal or Windows runtime claim.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib');
const fixture=require('./test-legacy-texture-rendered-contract');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
// Literal RGB scalar for each of THREE vertices in ONE DrawPrimitive.
// White diffuse, black ambient/emissive. Axis dot products: 1,0,-1.
// Asymmetric delta=(2,-3,6), length=7: 255*(2,3,6)/7 = (72,109,218).
// Point controls at z=.5, source z=-1.5: d=(sqrt(4.25),2,sqrt(4.25)).
// Point constant RGB=(247,255,247); full80 range4 linear=(120,127,120);
// legacy76 reciprocal linear=(120,127,120). Tolerance: one UNORM byte.
const ORACLE={positions:[[-.5,0,.5],[0,0,.5],[.5,0,.5]],rows:[
  {label:'+x common normals',position:[2,0,0],normal:[1,0,0],rgb:[255,255,255]},
  {label:'-x common normals',position:[-2,0,0],normal:[-1,0,0],rgb:[255,255,255]},
  {label:'+y common normals',position:[0,3,0],normal:[0,1,0],rgb:[255,255,255]},
  {label:'-y common normals',position:[0,-3,0],normal:[0,-1,0],rgb:[255,255,255]},
  {label:'+z common normals',position:[0,0,2],normal:[0,0,1],rgb:[255,255,255]},
  {label:'-z common normals',position:[0,0,-2],normal:[0,0,-1],rgb:[255,255,255]},
  {label:'asymmetric distinct normals',position:[2,-3,6],normals:[[1,0,0],[0,-1,0],[0,0,1]],rgb:[72,109,218]},
  {label:'opposite asymmetric distinct normals',position:[-2,3,-6],normals:[[-1,0,0],[0,1,0],[0,0,-1]],rgb:[72,109,218]},
  {label:'asymmetric opposing normals',position:[2,-3,6],normals:[[-1,0,0],[0,1,0],[0,0,-1]],rgb:[0,0,0]},
  {label:'nonunit normals',position:[2,-3,6],normals:[[7,0,0],[0,-3,0],[0,0,2]],rgb:[72,109,218]},
  {label:'ignore reversed direction',position:[2,-3,6],normals:[[1,0,0],[0,-1,0],[0,0,1]],direction:[2,-3,6],rgb:[72,109,218]},
  {label:'ignore arbitrary direction',position:[2,-3,6],normals:[[1,0,0],[0,-1,0],[0,0,1]],direction:[-19,11,4],rgb:[72,109,218]},
  {label:'ignore short range zero coefficients',position:[2,-3,6],normals:[[1,0,0],[0,-1,0],[0,0,1]],range:.125,atten:[0,0,0],rgb:[72,109,218]},
  {label:'ignore short range large coefficients',position:[2,-3,6],normals:[[1,0,0],[0,-1,0],[0,0,1]],range:.25,atten:[3,7,11],rgb:[72,109,218]},
  {label:'ignore long range polynomial',position:[2,-3,6],normals:[[1,0,0],[0,-1,0],[0,0,1]],range:64,atten:[0,1,0],rgb:[72,109,218]},
  {label:'legacy76 ignores distance',size:76,position:[2,-3,6],normals:[[1,0,0],[0,-1,0],[0,0,1]],range:.125,atten:[3,7,11],rgb:[72,109,218]},
  {label:'inactive80',flags:0,position:[2,-3,6],normal:[0,0,1],rgb:[0,0,0]},
  {label:'legacy76 ignores stale inactive',size:76,flags:0,position:[2,-3,6],normal:[0,0,1],rgb:[218,218,218]},
  {label:'inactive no-specular only',flags:2,position:[2,-3,6],normal:[0,0,1],rgb:[0,0,0]},
  {label:'active no-specular',flags:3,position:[2,-3,6],normal:[0,0,1],rgb:[218,218,218]},
  {label:'translated geometry origin',translation:[.25,-.5,.25],position:[2.25,-3.5,6.25],normals:[[1,0,0],[0,-1,0],[0,0,1]],rgb:[72,109,218]},
  {label:'translated across source negative side',translation:[-.25,0,0],position:[0,0,0],normal:[1,0,0],rgb:[255,255,255]},
  {label:'translated across source positive side',translation:[.25,0,0],position:[0,0,0],normal:[1,0,0],rgb:[0,0,0]},
  {label:'translated across source faces source',translation:[.25,0,0],position:[0,0,0],normal:[-1,0,0],rgb:[255,255,255]},
  {label:'rotated geometry origin',rotate:true,position:[2,-3,6],normals:[[0,-1,0],[-1,0,0],[0,0,1]],rgb:[72,109,218]},
  {label:'rotated translated origin',rotate:true,translation:[.25,-.5,.25],position:[2.25,-3.5,6.25],normals:[[0,-1,0],[-1,0,0],[0,0,1]],rgb:[72,109,218]},
  {label:'legacy rotated translated',size:76,rotate:true,translation:[-.25,.5,-.25],position:[1.75,-2.5,5.75],normals:[[0,-1,0],[-1,0,0],[0,0,1]],range:.125,atten:[3,7,11],rgb:[72,109,218]},
  {label:'point per vertex control',type:1,position:[0,0,-1.5],normal:[0,0,-1],rgb:[247,255,247]},
  {label:'point normalized distance control',type:1,position:[0,0,-1.5],normal:[0,0,-1],range:4,atten:[0,1,0],rgb:[120,127,120]},
  {label:'point legacy reciprocal control',type:1,size:76,position:[0,0,-1.5],normal:[0,0,-1],range:4,atten:[0,1,0],rgb:[120,127,120]},
  {label:'point range control',type:1,position:[0,0,-1.5],normal:[0,0,-1],range:.125,rgb:[0,0,0]},
  {label:'spot inside control',type:2,position:[0,0,-1.5],normal:[0,0,-1],direction:[0,0,7],rgb:[247,255,247]},
  {label:'spot reversed control',type:2,position:[0,0,-1.5],normal:[0,0,-1],direction:[0,0,-7],rgb:[0,0,0]},
  {label:'directional control',type:3,position:[2,-3,6],normal:[0,0,-1],direction:[0,0,7],range:.125,atten:[3,7,11],rgb:[255,255,255]},
  {label:'directional reversed control',type:3,position:[2,-3,6],normal:[0,0,-1],direction:[0,0,-7],rgb:[0,0,0]},
  {label:'restore parallel after types123',position:[2,-3,6],normals:[[1,0,0],[0,-1,0],[0,0,1]],rgb:[72,109,218]}
]};

async function exercise(c,o){
  const {evidence,eq,read,write,wa,words,guard,guid,com,ok,acquire,dd,device,d3d,rt,texture,padding,memory}=c;
  evidence.pixels=[];
  const f=new DataView(new ArrayBuffer(4)),bits=n=>{f.setFloat32(0,n,true);return f.getUint32(0,true);};
  const snapshot=async(p,n)=>Array.from(new Uint8Array(memory.buffer,await wa(p),n));
  const parent=await acquire(async p=>com('QI Direct3D3',dd,0,await guid([0xbb223240,0x11d0e72b,0xaa00b4a9,0x3e99c000]),p));
  const dev=await acquire(async p=>com('QI Device2',device,0,await guid([0x93281501,0x11d08cf8,0xa000ab89,0x294105c9]),p));
  const material=await acquire(p=>com('CreateMaterial3',parent,5,p,0)),m=await guard(80);
  await words(m.p,[80,...[1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0].map(bits),0,0]);
  const mb=await snapshot(m.p,80);await ok(com('SetMaterial3',material,3,m.p));await m.check();
  eq(await snapshot(m.p,80),mb,'material immutable');
  const h=await guard(4);await ok(com('GetHandle material',material,5,dev,h.p));await h.check();
  await ok(com('SetLightState material',dev,25,1,await read(h.p)));
  await ok(com('SetLightState ambient',dev,25,2,0));
  const vp=await guard(24);await words(vp.p,[0,0,8,8,0,bits(1)]);
  await ok(com('SetViewport7 shared device',device,13,vp.p));await vp.check();
  for(const [id,v] of [[7,0],[14,0],[15,0],[22,1],[27,0],[28,0],[29,0],[41,0]])await ok(com('SetRenderState2 '+id,dev,23,id,v));
  const vertices=await guard(96),input=await guard(80),out=await guard(80),matrix=await guard(64);
  const light=await acquire(p=>com('CreateLight3',parent,4,p,0)),lockDesc=await guard(124);
  async function lock(){
    await words(lockDesc.p,Array(31).fill(0));await write(lockDesc.p,124);
    await ok(com('Lock target',rt,25,0,lockDesc.p,1,0));await lockDesc.check();
    eq(await read(lockDesc.p+84),32,'32-bit target');
    return {p:await read(lockDesc.p+36),pitch:await read(lockDesc.p+16)};
  }
  async function transform(id,values){
    await words(matrix.p,values.map(bits));const before=await snapshot(matrix.p,64);
    await ok(com('SetTransform2 '+id,dev,26,id,matrix.p));await matrix.check();
    eq(await snapshot(matrix.p,64),before,'matrix immutable');
  }
  for(const row of o.rows){
    const {label,position,direction=[0,0,1],range=32,atten=[1,0,0],size=80,flags=1,type=4,translation=[0,0,0],rotate=false}=row;
    const [x,y,z]=translation;
    const world=rotate?[0,1,0,0,-1,0,0,0,0,0,1,0,x,y,z,1]:[1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1];
    // Inverse rigid view keeps all three sample points at exact pixels (2,4,6),
    // without canceling world-space lighting. No producer math is used.
    const view=rotate?[0,-1,0,0,1,0,0,0,0,0,1,0,-y,x,-z,1]:[1,0,0,0,0,1,0,0,0,0,1,0,-x,-y,-z,1];
    await transform(1,world);await transform(2,view);
    for(let i=0;i<3;i++)await words(vertices.p+32*i,[...o.positions[i],...(row.normals?.[i]||row.normal),0,0].map(bits));
    const vb=await snapshot(vertices.p,96);
    await words(input.p,[size,type,...[1,1,1,1,...position,...direction,range,1,...atten,.9020536235925247,2.0943951023931953].map(bits),flags]);
    const before=await snapshot(input.p,80);await ok(com('SetLight '+label,light,4,input.p));await input.check();
    eq(await snapshot(input.p,80),before,'light immutable including legacy tail');
    await write(out.p,80);await ok(com('GetLight '+label,light,5,out.p));await out.check();
    eq(await snapshot(out.p,size),before.slice(0,size),'public light roundtrip');
    const l=await lock();for(let yy=0;yy<8;yy++)for(let xx=0;xx<8;xx++)await write(l.p+yy*l.pitch+xx*4,0xffd10bcd);
    await ok(com('Unlock poison',rt,32,0));await ok(com('BeginScene2',dev,10));
    await ok(com('DrawPrimitive2 lit POINTLIST',dev,29,1,1,vertices.p,3,0));await ok(com('EndScene2',dev,11));
    const got=await lock(),samples=[];
    for(const xx of [2,4,6]){const px=await read(got.p+4*got.pitch+xx*4);samples.push([px>>>16&255,px>>>8&255,px&255]);}
    eq(await read(got.p),0xffd10bcd,'undrawn poison retained');
    await ok(com('Unlock pixels',rt,32,0));await vertices.check();eq(await snapshot(vertices.p,96),vb,'vertices immutable');
    evidence.pixels.push({label,want:row.rgb,samples});
  }
  for(const obj of [light,material,dev,parent,device,rt,d3d,texture,padding,dd])await com('Release fixture',obj,2);
  evidence.status='PASS';return evidence;
}
function source(){
  const base=fixture.browserFixture.toString(),seam='  let e,raw,link,manager,port,lastStats,gpu,holding=false,heldRecord;';
  assert(base.includes(seam),'public fixture math seam');
  const s=base.replace(seam,'  host.math_cos=Math.cos;host.math_pow=Math.pow;\n'+seam),i=s.indexOf('    evidence.objects={dd,d3d,texture,padding,rt,device};'),j=s.indexOf('  }finally{',i);
  assert(i>0&&j>i,'public fixture setup seams');
  return s.slice(0,i)+'return await ('+exercise.toString()+')({evidence,eq,read,write,wa,words,guard,guid,com,ok,acquire,dd,device,d3d,rt,texture,padding,memory},config.lightOracle);\n'+s.slice(j);
}
async function run(file){
  const raw=fs.readFileSync(file),bytes=file.endsWith('.gz')?z.gunzipSync(raw):raw,ctx=fixture.offlineContext(bytes);
  let error=null;try{await vm.runInContext('('+source()+')',ctx)('gps',{...fixture.offlineConfig(),lightOracle:ORACLE},'()=>null');}catch(e){error=e.stack;}
  return {moduleSHA256:sha(bytes),oracleSHA256:sha(JSON.stringify(ORACLE)),fixtureSHA256:sha(source()),...JSON.parse(JSON.stringify(ctx.legacyTextureEvidence||{})),error};
}
function inspect(r){
  const failures=(r.pixels||[]).filter(row=>row.samples.some((rgb,i)=>rgb.some(v=>Math.abs(v-row.want[i])>1)));
  if(r.error)failures.push({error:r.error});
  if(r.status!=='PASS'||r.pixels?.length!==ORACLE.rows.length)failures.push({error:'incomplete public draw fixture',status:r.status,checks:r.pixels?.length});
  return {checks:r.pixels?.length||0,samples:(r.pixels?.length||0)*3,calls:r.calls?.length||0,failures:failures.length,examples:failures.slice(0,4)};
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
module.exports={ORACLE,source,run,inspect,main};
