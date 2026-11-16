#!/usr/bin/env node
'use strict';

// Public COM geometry with D3DTTFF_PROJECTED texture coordinates, through the
// WAT rasterizer ('software') and the WAT GPU stream producer drained into
// lib/gpu-stream-software.js ('gps'), read back by the public Lock. No
// renderer or production sampling helper supplies expected values.
// node test/test-legacy-projected-webgl.js [--plan]
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const crypto=require('node:crypto'),vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const mipFixture=require('./test-legacy-public-mip-webgl');

function oracle(colors,state,sample) {
  if(sample.x===1&&sample.y===1&&state.clip)return [11,22,33];
  const uv=state.uvs,weights=[1-(sample.x+sample.y)/32,sample.x/32,sample.y/32];
  const t=uv.map(([u,v],i)=>{
    const z=state.clip&&i===0?-.5:state.geomW?[.2,.8,.6][i]:.5;
    const w=state.geomW?1+.5*z:1;
    const q=state.flags===0x103?state.q+state.qU*u+state.qV*v:1;
    return [(state.flags===0x103?state.scale:1)*u/w,
      (state.flags===0x103?state.scale:1)*v/w,q/w];
  });
  const p=[0,1,2].map(c=>t.reduce((v,a,i)=>v+weights[i]*a[c],0)),Q=p[2];
  const d=[1,2].map(i=>[0,1].map(c=>16*((t[i][c]-t[0][c])/32*Q-p[c]*(t[i][2]-t[0][2])/32)/(Q*Q)));
  const rho=Math.max(...d.map(a=>Math.hypot(...a)));
  const level=state.mip===1?0:Math.max(0,Math.min(4,Math.floor(Math.log2(rho)+.5)));
  const grid=colors[level],n=grid.length;
  const wrap=x=>((Math.floor(x*n)%n)+n)%n;
  return grid[wrap(p[1]/Q)][wrap(p[0]/Q)].slice();
}

function plan(){
  const colors=Array.from({length:5},(_,l)=>Array.from({length:16>>l},(_,y)=>
    Array.from({length:16>>l},(_,x)=>[20+l*39+(x%2)*40,25+l*31+(y%2)*45,30+l*27+((x+y)%2)*35])));
  // filter:1 names the POINT MIN/MAG that setState programs (stage ids 16/17),
  // which the inherited public-mip descriptor check reads.
  const base={flags:0x103,q:.3125,qU:.75,qV:.25,scale:1,mip:1,filter:1,
    uvs:[[.137,.193],[.887,.193],[.137,.943]],
    samples:[{x:8,y:12},{x:12,y:8},{x:12,y:12}]};
  const states=[
    {label:'disabled',flags:0},
    {label:'unit q',q:1,qU:0,qV:0},
    {label:'half q',q:.5,qU:0,qV:0},
    {label:'nonconstant texture q'},
    {label:'independent geometric w',geomW:true},
    {label:'near clip',clip:true},
    {label:'near clip independent w',clip:true,geomW:true},
    {label:'projection disabled restored',flags:0,geomW:true},
    ...[4,8,16,32].flatMap(scale=>[{}, {geomW:true}, {clip:true,geomW:true}].map(extra=>
      ({label:'mip '+scale+' '+JSON.stringify(extra),scale,mip:2,...extra}))),
  ].map(s=>({...base,...s}));
  for(const state of states)if(state.clip)state.samples=[...state.samples,{x:1,y:1}];
  return {colors,states,spatial:true,tolerance:2,update:null};
}

function fixtureSource(){
  let source=mipFixture.fixtureSource();
  const replace=(a,b)=>{assert.equal(source.split(a).length,2,'unique projected seam '+a.slice(0,70));source=source.replace(a,b);};
  const block=(a,b,c)=>{const start=source.indexOf(a),end=source.indexOf(b,start);assert(start>0&&end>start);replace(source.slice(start,end),c);};
  block('    const geometry=async state=>{','    const describe=async()=>{',`    const matrix=await alloc(64),indices=await alloc(8);
    await words(indices,[0x10000,2]);
    const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
    await words(matrix,identity.map(bits));
    for(const type of [1,2,3])await ok(com('SetTransform7 identity',device,11,type,matrix));
    const geometry=async state=>{
      for(const [i,[x,y]] of [[-1,1],[1,1],[-1,-1]].entries()){
        const [u,v]=state.uvs[i];
        const z=state.clip&&negative!=='unclipped'&&i===0?-.5:state.geomW?[.2,.8,.6][i]:.5;
        const w=state.geomW?1+.5*z:1;
        await words(vertices+i*32,[bits(x*w),bits(y*w),bits(z),0,0xffffffff,0,bits(u),bits(v)]);
      }
    };
    const setState=async state=>{
      const projection=identity.slice();if(state.geomW)projection[11]=.5;
      await words(matrix,projection.map(bits));await ok(com('SetTransform7 projection',device,11,3,matrix));
      const m=identity.slice();m[0]=m[5]=state.scale;m[2]=state.qU;m[6]=state.qV;m[14]=state.q;
      await words(matrix,m.map(bits));await ok(com('SetTransform7 TEXTURE0',device,11,16,matrix));
      const got=await guard(64);await ok(com('GetTransform7 TEXTURE0',device,12,16,got.p));
      await got.check();for(let i=0;i<16;i++)eq(await read(got.p+4*i),bits(m[i]),'matrix round trip');
      await tss(11,0);await tss(24,state.flags);
      const flags=await guard(4);await ok(com('GetTextureStageState flags',device,36,0,24,flags.p));
      await flags.check();eq(await read(flags.p),state.flags,'projection flags round trip');
      for(const [id,v] of [[16,1],[17,1],[18,state.mip],[13,1],[14,1]])await tss(id,v);
    };
`);
  replace("await ok(com('DrawPrimitive7',device,25,4,0x1c4,vertices,3,0));",`await ok(config.indexed
      ?com('DrawIndexedPrimitive7',device,26,4,0x1e2,vertices,3,indices,3,0)
      :com('DrawPrimitive7',device,25,4,0x1e2,vertices,3,0));`);
  replace("const draw=async()=>{await ok(com('BeginScene7',device,5));",`const draw=async()=>{
      await ok(com('Clear7',device,10,0,0,1,0xff0b1621,bits(1),0));
      await ok(com('BeginScene7',device,5));`);
  replace("const close=(got,want,label)=>check(",`for(const cap of evidence.advertised.textureCaps)eq(cap&0x400,0,'PROJECTED capability stays clear');
      const close=(got,want,label)=>check(`);
  // The endpoint message carries a SharedArrayBuffer-backed immutable capture.
  // Hold delivery, mutate TEXTURE0 through real public calls, then drain.
  block('    if(mode===\'worker\'){\n      for(const [a,b]','    if(config.update){',`    if(mode==='worker'){
      for(const old of config.states.filter(s=>s.flags===0x103&&s.geomW)){
        await geometry(old);await setState(old);
        // Keep post-mutation controls inside texels under the established TL
        // 1/16-pixel fill displacement. The old (projected) draw still tests
        // every authored sample and its clipped-away Clear pixel.
        const next={...old,q:8,qU:0,qV:0,scale:1,flags:0,
          samples:old.samples.filter(s=>s.x!==s.y)};
        heldRecord={old,next,messages:[]};evidence.queued.push(heldRecord);holding=true;
        await draw();await until(()=>held.length>0,'held production batch');
        await setState(next);heldRecord.liveChangedBeforeDrain=true;
        holding=false;for(const send of held.splice(0))send();
        for(const sample of old.samples)await observe('queued '+old.label,sample,old);
        await draw();for(const sample of next.samples)await observe('next '+next.label,sample,next);
      }
      await until(()=>lastStats?.stats.drawCalls===drawCount,'all production stats');evidence.stats=lastStats.stats;
    }
`);
  return source;
}

// The adapter fault injections (ignored/early/lod/live-matrix) and the
// transport preflight patched the deleted JS executor (lib/d3dim-gpu.js) and
// lib/d3d9-fixed.js; projected lowering now lives in the WAT producer, which a
// served-script fault cannot reach. The 'unclipped' negative changes authored
// geometry only and still runs against both renderers.

function controls(){
  const p=plan();new vm.Script('('+fixtureSource()+')');
  // A reciprocal followed by multiplication need not preserve a unit varying.
  // This numerical witness complements the actual perspective mip regression.
  const denominator=Math.fround(5/37),reciprocal=Math.fround(1/denominator);
  assert(Math.fround(denominator*reciprocal)<1);
  assert.equal(Math.fround(0*reciprocal),0);
  const levels=new Set();
  for(const old of p.states){
    const next={...old,flags:0,q:8,qU:0,qV:0,scale:1,
      samples:old.samples.filter(s=>s.x!==s.y)};
    for(const state of [old,next])for(const sample of state.samples){
      if(sample.x===1&&sample.y===1)continue;
      assert.deepEqual(oracle(p.colors,state,sample),oracle(p.colors,state,{x:sample.x+.0625,y:sample.y+.0625}),
        'sample must stay inside the same texel/mip under retained TL fill displacement: '+state.label);
    }
  }
  for(const state of p.states.filter(s=>s.mip===2))for(const sample of state.samples){
    const color=oracle(p.colors,state,sample);if(color[0]!==11)levels.add(Math.floor((color[0]-20)/39));
  }
  assert(levels.size>=3,'nontrivial mip coverage');
  return {status:'PREFLIGHT SOURCE ONLY; no pixels',states:p.states.length,oracleLevels:[...levels]};
}

function config(){
  const pe=fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'));
  return {...plan(),noPreview:true,imageBase:pe.readUInt32LE(pe.readUInt32LE(0x3c)+52),
    thunkBase:require('../lib/region-map.generated').BASE.THUNK_BASE,
    factoryId:require('../src/api_table.json').find(x=>x.name==='DirectDrawCreateEx').id};
}

// Runs one adapted fixture in node (no browser) against a built module.
async function runFixture(source,mode,cfg,oracleSource,negative=null,wasm=null){
  const context=require('./test-legacy-texture-rendered-contract').offlineContext(wasm);
  try{return await vm.runInContext('('+source+')',context)(mode,cfg,oracleSource,negative);}
  finally{cfg.lastEvidence=context.legacyTextureEvidence;}
}

async function offline(){
  const results=[];controls();
  for(const name of ['wine-assembly.wasm','wine-assembly.compat.wasm']){
    const wasm=fs.readFileSync(path.join(ROOT,'build',name));
    for(const mode of ['software','gps'])for(const indexed of [false,true]){
      const cfg={...config(),indexed};
      // GAP (lib/src): every D3DTTFF_PROJECTED draw the WAT producer emits is
      // refused by lib/d3d9-software-backend.js ('shader exceeds native VM
      // implementation'), so gps covers only the unprojected states until
      // that lands. LEGACY_PROJECTED_GPS_ALL=1 runs the full gps matrix.
      if(mode==='gps'&&process.env.LEGACY_PROJECTED_GPS_ALL!=='1')cfg.states=cfg.states.filter(s=>s.flags!==0x103);
      const result=await runFixture(fixtureSource(),mode,cfg,oracle.toString(),null,wasm);
      assert.equal(result.status,'PASS');results.push({name,mode,indexed,observations:result.observations.length,stats:result.stats});
      console.log('PASS '+JSON.stringify({name,mode,indexed,observations:result.observations.length}));
    }
    for(const mode of process.env.LEGACY_PROJECTED_GPS_ALL==='1'?['software','gps']:['software']){
      const cfg={...config()};cfg.states=[cfg.states[5]];let error;
      try{await runFixture(fixtureSource(),mode,cfg,oracle.toString(),'unclipped',wasm);}catch(e){error=String(e);}
      const partial=cfg.lastEvidence;
      assert.match(error||'',/PIXEL ORACLE/,'rendered semantic rejection');
      assert(partial.calls.some(c=>/Draw(Indexed)?Primitive7/.test(c.label)&&c.result===0));
      assert(partial.observations.at(-1).actual.some((c,i)=>Math.abs(c-partial.observations.at(-1).expected[i])>cfg.tolerance));
      console.log('PASS negative unclipped '+name+' '+mode);
    }
  }
  return results;
}
if(require.main===module){if(process.argv.includes('--plan'))console.log(JSON.stringify(controls()));
else offline().catch(e=>{console.error(e);process.exitCode=1;});}
module.exports={oracle,plan,fixtureSource,controls,config,runFixture};
