#!/usr/bin/env node
'use strict';

// Default is a cheap analytic check. --wasm runs public COM against a shipped
// module, including the physical production Node render Worker, entirely offline.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const vm=require('node:vm'),crypto=require('node:crypto');
const previous=require('./test-legacy-projected-coordinate-contract');
const ROOT=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];

function oracle(colors,state,p){
  const weights=[1-(p.x+p.y)/32,p.x/32,p.y/32];
  const w=state.geomW?[1.1,1.4,1.3]:[1,1,1];
  // Constant texture Q makes independently predivided nonprojected vertices
  // exactly equivalent without modifying geometric w, depth or vertex fog.
  const uv=state.referenceUV;
  const denom=weights.reduce((s,b,i)=>s+b/w[i],0);
  const at=c=>uv.reduce((s,a,i)=>s+weights[i]*a[c]/w[i],0)/denom;
  const wrap=x=>((Math.floor(x*16)%16)+16)%16;
  const texel=colors[0][wrap(at(1))][wrap(at(0))];
  const f=state.fog?weights.reduce((s,b,i)=>s+b*state.factors[i]/255,0):1;
  return texel.map((v,c)=>Math.floor(v*f+state.fogColor[c]*(1-f)));
}
function plan(){
  const colors=previous.plan().colors,states=[];
  const raw=[[.137,.193],[.887,.193],[.137,.943]];
  const matrix=[.5,.125,0,0,.25,.5,0,0,0,0,1,0,.09375,.15625,.5,1];
  const referenceUV=raw.map(([u,v])=>[(.5*u+.25*v+.09375)/.5,(.125*u+.5*v+.15625)/.5]);
  for(const geomW of [false,true])for(const factors of [[96,96,96],[32,128,224]])for(const fog of [false,true]){
    const base={geomW,factors,fog,fogColor:[173,41,219],mip:1,referenceUV,selector:0,
      samples:[{x:4,y:6},{x:8,y:12},{x:12,y:8}],pair:`w${geomW}/${factors}/${fog}`};
    for(const divided of [false,true])states.push({...base,divided,label:base.pair+(divided?'/predivided':'/projected'),
      flags:divided?0:0x103,matrix:divided?identity:matrix,
      sets:Array.from({length:8},()=>divided?referenceUV:raw)});
  }
  return {...require('./test-legacy-projected-webgl').config(),colors,states,spatial:true,tolerance:2,update:null};
}
function fixtureSource(){
  let s=previous.fixtureSource();
  const replace=(a,b)=>{assert.equal(s.split(a).length,2,'fog seam '+a.slice(0,70));s=s.replace(a,b);};
  replace('const middle=config.withNormals?[bits(.3),bits(.6),bits(.7)]:[0,0xffffffff,0];',
    'const middle=[0,0xffffffff,(state.factors[i]<<24)>>>0];');
  replace('const geometry=async state=>{','const geometry=async state=>{await words(indices,[0x10000,2]);');
  replace('const setState=async state=>{',`const setState=async state=>{
      for(const [id,value] of [[28,negative==='fog-off'?0:state.fog?1:0],[34,(state.fogColor[0]<<16)|(state.fogColor[1]<<8)|state.fogColor[2]],[35,0],[140,0]]){
        await ok(com('SetRenderState7 composition',device,20,id,value));
        const out=await guard(4);await ok(com('GetRenderState7 composition',device,21,id,out.p));
        await out.check();eq(await read(out.p),value,'fog state round trip');
      }`);
  replace('await setState({...state,flags:0,selector:0,matrix:identity});',
    `const before=captureHashes(nativeEncoder,evidence);
        await setState({...state,flags:0,selector:0,matrix:identity,fog:!state.fog,fogColor:[5,222,17]});
        await words(vertices,Array(66).fill(0));await words(indices,[0xffffffff,0xffffffff]);
        const after=captureHashes(nativeEncoder,evidence);
        eq(JSON.stringify(after),JSON.stringify(before),'complete held command immutable after public state/source mutation');
        (evidence.immutable||=[]).push({label:state.label,before,after});`);
  return s;
}
function captureHashes(encoder,evidence){return (evidence.pendingNativeIndices||[]).map(index=>{
  const item=encoder.buffers[index];return sha(item.bytes.subarray(0,item.used));
});}
function inspectQueue(encoder,e,memory,evidence){
  for(const index of evidence.pendingNativeIndices||[]){
    const item=encoder.buffers[index];
    for(let offset=0;offset<item.used;){
      const d=item.view,size=d.getUint32(offset,true),type=d.getUint32(offset+12,true);
      assert(size>0&&offset+size<=item.used);assert.equal(d.getUint32(offset+16,true),3);
      const state=evidence.currentState,vertices=[];
      assert.equal(type,state.divided?3:5);
      const stride=type===5?40:32;
      for(let i=0;i<3;i++){
        const p=offset+32+4096+i*stride;
        const v=Array.from({length:stride/4},(_,c)=>c===4||c===5?d.getUint32(p+4*c,true):d.getFloat32(p+4*c,true));
        const z=state.geomW?[.2,.8,.6][i]:.5,w=state.geomW?1+.5*z:1;
        assert(Math.abs(v[3]-1/w)<1e-6,'geometric rhw');
        assert(Math.abs(v[2]-z/w)<1e-6,'geometric depth');
        assert.equal(v[5]>>>24,state.factors[i],'independent fog alpha');
        for(let c=0;c<2;c++)assert(Math.abs(v[6+c]-state.sets[0][i][c])<1e-6,'supplied FLOAT2 preserved');
        vertices.push(v);
      }
      (evidence.records||=[]).push({label:state.label,type,vertices,sha256:sha(item.bytes.subarray(offset,offset+size))});
      offset+=size;
    }
  }
}
async function run(wasm,options,negative=null){
  const bytes=fs.readFileSync(wasm),routes=new Map([['/legacy-render.wasm',bytes],
    ['/test/binaries/calc.exe',fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'))],
    ['/lib/host-import-sigs.generated.json',fs.readFileSync(path.join(ROOT,'lib/host-import-sigs.generated.json'))]]);
  const context=vm.createContext({WebAssembly,performance,setTimeout,inspect(){},inspectQueue,captureHashes,
    NativeStream:require('../lib/d3d-command-stream'),NativeWorker:require('node:worker_threads').Worker,
    nativeWorkerPath:path.join(ROOT,'lib/d3d-render-worker.js'),
    fetch:async url=>{assert(routes.has(url));const b=routes.get(url);return {arrayBuffer:async()=>Uint8Array.from(b).buffer,json:async()=>JSON.parse(b)};},
    document:{createElement:()=>({style:{},getContext:()=>({putImageData(){}})}),body:{append(){}}},ImageData:class{}});
  let failure=null;
  try{await vm.runInContext('('+fixtureSource()+')',context)('software',{...plan(),...options},oracle.toString(),negative);}
  catch(e){failure=e.stack;}
  return {wasm,wasmSHA256:sha(bytes),failure,...JSON.parse(JSON.stringify(context.legacyTextureEvidence))};
}
async function main(){
  new vm.Script('('+fixtureSource()+')');const p=plan();
  for(const s of p.states)for(const t of s.samples)assert.equal(oracle(p.colors,s,t).length,3);
  const wasm=process.argv.find(a=>a.startsWith('--wasm='))?.slice(7);
  if(!wasm){console.log('PASS analytic projection/fog composition plan; use --wasm and --out for public pixels');return;}
  const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6);assert(out,'--out required');fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(out,'expected-plan.json'),JSON.stringify({states:p.states,oracle:oracle.toString()}));
  const summary=[];let immediate;
  for(const queued of [false,true])for(const indexed of [false,true]){
    const r=await run(wasm,{queued,indexed});fs.writeFileSync(path.join(out,`positive-${queued}-${indexed}.json`),JSON.stringify(r));
    assert.equal(r.failure,null);assert.equal(r.status,'PASS');
    const images=r.observations.filter((_,i)=>i%3===0).map(v=>v.dibRGBA);
    if(!immediate)immediate=images;else assert.deepEqual(images,immediate,'indexed and physical Worker full-target parity');
    for(let i=0;i<r.observations.length;i+=6){
      const a=r.observations.slice(i,i+3),b=r.observations.slice(i+3,i+6);
      assert.deepEqual(a.map(v=>v.actual),b.map(v=>v.actual),'projected/predivided identical samples');
      assert.deepEqual(a[0].dibRGBA,b[0].dibRGBA,'complete projected/predivided target equality');
    }
    const fogOn=r.observations.filter(v=>v.state.fog&&!v.state.divided);
    for(const a of fogOn){const b=r.observations.find(v=>!v.state.fog&&!v.state.divided&&v.state.geomW===a.state.geomW&&JSON.stringify(v.state.factors)===JSON.stringify(a.state.factors)&&JSON.stringify(v.sample)===JSON.stringify(a.sample));
      assert.notDeepEqual(a.actual,b.actual,'fog discriminates');}
    if(queued){assert.equal(r.records.length,p.states.length);assert.equal(r.immutable.length,p.states.length);assert.equal(r.transport.fallbacks,0);assert(r.transport.replayCommands>0);}
    summary.push({queued,indexed,pixels:r.observations.length,records:r.records?.length||0});console.log('PASS',JSON.stringify(summary.at(-1)));
  }
  for(const negative of ['ignored','fog-off']){
    const states=[p.states.find(s=>s.fog&&!s.divided&&s.geomW)];
    const r=await run(wasm,{states},negative);fs.writeFileSync(path.join(out,`negative-${negative}.json`),JSON.stringify(r));
    assert(r.failure?.includes('PIXEL ORACLE'),'rendered rejection '+negative+': '+r.failure);
    assert(r.calls.some(c=>c.label==='DrawPrimitive7'&&c.result===0));console.log('PASS successful public draw rejected',negative);
  }
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({status:'PASS',wasm,sha256:sha(fs.readFileSync(wasm)),summary}));
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={plan,oracle,fixtureSource,run};
