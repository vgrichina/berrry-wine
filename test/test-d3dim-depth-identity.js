#!/usr/bin/env node
'use strict';
// Public x86 COM surface attachment/target switches, actual queued producer
// and software executor. Microsoft DX5 SDK: Working With Z-Buffers describes
// the attached DirectDraw surface as the storage for depth information:
// https://library.thedatadungeon.com/directx5/html/dire0052.content.htm
// Shared means public detach/reattach between A/B: the current DirectDraw
// attachment model has one parent. Simultaneous multi-parent is not claimed.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const depth=require('./test-d3dim-viewport-depth-clear'),fixture=require('./test-legacy-texture-rendered-contract'),base=require('./test-legacy-projected-webgl');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
// Frozen independent full-frame color/depth masks. All 32x32 pixels have
// the literal pair below; no producer helper computes an expected value.
const CASES=[
  ['A Z1 primed',0xff0b1621,16384],
  ['B shared Z1 rejects',0xff0b1621,16384],
  ['A replacement Z2 passes',0xff20c050,32768],
  ['A restored Z1 rejects',0xff0b1621,16384],
  ['B distinct Z2 rejects',0xff0b1621,32768],
  ['A Z1 nearer',0xff20c050,8192],
  ['B Z2 independent',0xff0b1621,32768],
  ['B shared Z1 nearer rejects',0xff0b1621,8192],
  ['A private fallback',0xff20c050,32768],
  ['A reattached Z1 rejects',0xff0b1621,8192],
  ['A reused Z3 primed',0xff0b1621,49151],
  ['A reused Z3 passes',0xff20c050,32768],
];
function source(){
  let s=depth.source().replace('const depth=await acquire','let depth=await acquire');
  const i=s.indexOf('    await setViewport([0,0,32,32]);'),j=s.indexOf('  }finally{',i);assert(i>0&&j>i);
  s=s.slice(0,i)+`
    const A=rt,B=await surface(32,32,0x2840),Z1=depth;
    const makeZ=()=>acquire(out=>com('Create depth Surface7',dd,6,zdesc.p,out,0));
    const Z2=await makeZ();
    const target=async t=>{rt=t;await ok(com('SetRenderTarget7',device,8,t,0));await setViewport([0,0,32,32]);};
    const attach=(t,z)=>ok(com('AddAttachedSurface7',t,3,z));
    const detach=(t,z)=>ok(com('DeleteAttachedSurface7',t,8,0,z));
    const clear=(flags,z)=>ok(com('Clear7 full',device,10,0,0,flags,C,bits(z),0));
    const snap=async label=>{evidence.phase=label;await draw(C,.5,true);await observe(label);};
    await target(A);await draw(C,.5,true);await clear(3,.25);await snap('A Z1 primed');
    // Initialize B's color/private plane before Z1 is moved to it.
    await target(B);await draw(C,.5,true);await clear(3,1);await snap('B private primed');
    await detach(A,Z1);await attach(B,Z1);depth=Z1;await clear(1,0);await draw(G,.5);await snap('B shared Z1 rejects');
    await attach(A,Z2);await target(A);depth=Z2;await clear(3,.75);await draw(G,.5);await snap('A replacement Z2 passes');
    await detach(B,Z1);await detach(A,Z2);await attach(A,Z1);depth=Z1;await clear(1,0);await draw(G,.5);await snap('A restored Z1 rejects');
    await attach(B,Z2);await target(B);depth=Z2;await clear(1,0);await draw(G,.625);await snap('B distinct Z2 rejects');
    await target(A);depth=Z1;await draw(G,.125);await snap('A Z1 nearer');
    await target(B);depth=Z2;await draw(G,.625);await snap('B Z2 independent');
    await detach(A,Z1);await detach(B,Z2);await attach(B,Z1);depth=Z1;await clear(1,0);await draw(G,.5);await snap('B shared Z1 nearer rejects');
    await target(A);await draw(C,.5,true);await clear(3,.75);await draw(G,.5);await snap('A private fallback');
    await detach(B,Z1);await attach(A,Z1);depth=Z1;await clear(1,0);await draw(G,.5);await snap('A reattached Z1 rejects');
    await detach(A,Z1);await com('Release Z1',Z1,2);await com('Release Z2',Z2,2);
    const Z3=await makeZ();depth=Z3;await attach(A,Z3);await draw(C,.5,true);await clear(3,.75);await snap('A reused Z3 primed');
    await draw(G,.5);await snap('A reused Z3 passes');
    await detach(A,Z3);await com('Release Z3',Z3,2);
    evidence.stats={fallbacks:await raw('d3dim_gps_stat',1),declined:await raw('d3dim_gps_stat',14)};
    for(const obj of [device,B,texture,A,padding,d3d,dd])await com('Release',obj,2);
    evidence.status='PASS';return evidence;
`+s.slice(j);return s;
}
async function run(wasm){
  const raw=fs.readFileSync(wasm),bytes=wasm.endsWith('.gz')?zlib.gunzipSync(raw):raw,context=fixture.offlineContext(bytes);
  const GS=require('../lib/gpu-stream'),Base=require('../lib/gpu-stream-software').Executor,records=[],depthRecords=[];
  context.GpuStreamSoftware={Executor:class extends Base{execute(rec){
    const result=super.execute(rec),label=context.legacyTextureEvidence.phase;
    records.push({label,name:rec.name,fields:{...rec.fields}});
    if(rec.op===GS.OP.READBACK&&this.res.get(rec.fields.rt)?.kind===GS.KIND.RT){
      this.native.idle();const id=this.target.depth,ds=this.native.depthSurfaces.get(id);
      depthRecords.push({label,id,live:this.native.depthSurfaces.size,words:ds?Array.from(new Float32Array(this.native.memory(),ds.wa,1024),v=>Math.round(v*65535)):null});
    }return result;
  }}};
  let error=null;try{await vm.runInContext('('+source()+')',context)('gps',{...base.config(),scene:{method:'device7',owned:true}},'()=>null');}catch(e){error=e.stack;}
  return {wasmSHA256:sha(bytes),fixtureSHA256:sha(source()),oracleSHA256:sha(JSON.stringify(CASES)),records,depthRecords,error,...JSON.parse(JSON.stringify(context.legacyTextureEvidence))};
}
function inspect(r){
  const failures=[];if(r.error)return {failures:[{error:r.error}]};
  assert.equal(r.status,'PASS');assert.equal(r.stats.fallbacks,0);assert.equal(r.stats.declined,0);
  for(const [label,c,z] of CASES){const o=r.observations.find(o=>o.label===label),d=r.depthRecords.find(d=>d.label===label);assert(o&&d?.words,label+' actual public/backend readback');
    for(let i=0;i<1024;i++){
      if(o.pixels[i]!==c)failures.push({label,kind:'color',i,want:c,got:o.pixels[i]});
      if(d.words[i]!==z)failures.push({label,kind:'backend D16',i,want:z,got:d.words[i]});
    }
  }
  assert(r.records.some(r=>r.name==='CLEAR'));assert(r.records.some(r=>r.name==='DRAW_UP'||r.name==='DRAW'));
  assert(r.depthRecords.every(d=>d.live<=5),'bounded depth resources');
  return {cases:CASES.length,failures};
}
async function main(){
  if(process.argv.includes('--plan')){console.log(JSON.stringify({cases:CASES,oracleSHA256:sha(JSON.stringify(CASES)),fixtureSHA256:sha(source())},null,2));return;}
  const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6),wasm=process.argv.find(a=>a.startsWith('--wasm='))?.slice(7);if(out)fs.mkdirSync(out,{recursive:true});
  for(const f of wasm?[wasm]:['build/wine-assembly.wasm','build/wine-assembly.compat.wasm']){const r=await run(f),v=inspect(r);
    if(out)fs.writeFileSync(path.join(out,path.basename(f)+'.json.gz'),zlib.gzipSync(JSON.stringify(r)));
    console.log(JSON.stringify({wasmSHA256:r.wasmSHA256,...v,failures:v.failures.length,examples:v.failures.slice(0,3)}));if(v.failures.length)process.exitCode=1;
  }
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});module.exports={CASES,source,run,inspect};
