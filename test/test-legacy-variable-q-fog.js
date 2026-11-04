#!/usr/bin/env node
'use strict';

// Offline public x86 COM pixels; no per-vertex predivision equivalence claim.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const vm=require('node:vm'),crypto=require('node:crypto');
const previous=require('./test-legacy-projection-fog-composition');
const ROOT=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');

function oracle(colors,state,p){
  const b=[1-(p.x+p.y)/32,p.x/32,p.y/32];
  const w=state.geomW?[1.1,1.4,1.3]:[1,1,1];
  // Authored coefficients, independent of the production transform/sampler.
  // The geometric perspective denominator cancels between U and Q (and V/Q).
  const h=state.sets[0].map(([u,v])=>[.5*u+.25*v+.09375,
    .125*u+.5*v+.15625,state.qCoefficients[0]*u+state.qCoefficients[1]*v+state.qCoefficients[2]]);
  const sum=c=>h.reduce((s,t,i)=>s+b[i]*t[c]/w[i],0);
  const uv=[sum(0)/sum(2),sum(1)/sum(2)];
  const wrap=x=>((Math.floor(x*16)%16)+16)%16;
  const texel=colors[0][wrap(uv[1])][wrap(uv[0])];
  const f=state.fog?b.reduce((s,v,i)=>s+v*state.factors[i]/255,0):1;
  return texel.map((v,c)=>Math.floor(v*f+state.fogColor[c]*(1-f)));
}

function plan(){
  const inherited=previous.plan(),states=[];
  const raw=[[.137,.193],[.887,.193],[.137,.943]];
  for(const qCoefficients of [[.75,.25,.3125],[.125,.875,.21875]])
    for(const geomW of [false,true])for(const factors of [[96,96,96],[32,128,224]])for(const fog of [false,true]){
      const [qu,qv,q0]=qCoefficients;
      const matrix=[.5,.125,qu,0,.25,.5,qv,0,0,0,1,0,.09375,.15625,q0,1];
      states.push({label:`q${qCoefficients}/w${geomW}/f${factors}/fog${fog}`,qCoefficients,
        geomW,factors,fog,fogColor:[173,41,219],mip:1,selector:0,flags:0x103,matrix,
        sets:Array.from({length:8},()=>raw),samples:[{x:4,y:6},{x:8,y:12},{x:6,y:4}]});
    }
  return {...inherited,states};
}

function fixtureSource(){return previous.fixtureSource();}
function captureHashes(encoder,evidence){return (evidence.pendingNativeIndices||[]).map(index=>{
  const item=encoder.buffers[index];return sha(item.bytes.subarray(0,item.used));
});}
function inspectQueue(encoder,e,memory,evidence){
  for(const index of evidence.pendingNativeIndices||[]){
    const item=encoder.buffers[index];
    for(let offset=0;offset<item.used;){
      const d=item.view,size=d.getUint32(offset,true),type=d.getUint32(offset+12,true);
      assert(size>0&&offset+size<=item.used);assert.equal(type,5);assert.equal(d.getUint32(offset+16,true),3);
      const state=evidence.currentState,vertices=[];
      for(let i=0;i<3;i++){
        const p=offset+32+4096+i*40;
        const v=Array.from({length:10},(_,c)=>c===4||c===5?d.getUint32(p+4*c,true):d.getFloat32(p+4*c,true));
        const z=state.geomW?[.2,.8,.6][i]:.5,w=state.geomW?1+.5*z:1;
        assert(Math.abs(v[3]-1/w)<1e-6,'unchanged geometric rhw');
        assert(Math.abs(v[2]-z/w)<1e-6,'unchanged geometric z/w');
        assert.equal(v[5]>>>24,state.factors[i],'retained vertex fog alpha');
        for(let c=0;c<2;c++)assert(Math.abs(v[6+c]-state.sets[0][i][c])<1e-6,'retained supplied FLOAT2');
        vertices.push(v);
      }
      const matrix=Array.from({length:16},(_,i)=>d.getFloat32(offset+32+3136+4*i,true));
      assert.deepEqual(matrix,state.matrix,'retained texture matrix');
      (evidence.records||=[]).push({label:state.label,type,vertices,matrix,sha256:sha(item.bytes.subarray(offset,offset+size))});
      if(evidence.negative==='captured-matrix'){
        // Replace only the already captured state: successful replay must now
        // fail the pixel oracle even though the live public mutation succeeded.
        const identity=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
        item.bytes.set(new Uint8Array(identity.buffer),offset+32+3136);
      }
      offset+=size;
    }
  }
}

async function run(wasm,options={},negative=null){
  const bytes=fs.readFileSync(wasm),pe=fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'));
  const routes=new Map([['/legacy-render.wasm',bytes],['/test/binaries/calc.exe',pe],
    ['/lib/host-import-sigs.generated.json',fs.readFileSync(path.join(ROOT,'lib/host-import-sigs.generated.json'))]]);
  const context=vm.createContext({WebAssembly,performance,setTimeout,inspect(){},inspectQueue,captureHashes,
    NativeStream:require('../lib/d3d-command-stream'),NativeWorker:require('node:worker_threads').Worker,
    nativeWorkerPath:path.join(ROOT,'lib/d3d-render-worker.js'),
    fetch:async url=>{assert(routes.has(url));const b=routes.get(url);return {arrayBuffer:async()=>Uint8Array.from(b).buffer,json:async()=>JSON.parse(b)};},
    document:{createElement:()=>({style:{},getContext:()=>({putImageData(){}})}),body:{append(){}}},ImageData:class{}});
  let failure=null;
  try{await vm.runInContext('('+fixtureSource()+')',context)('software',{...plan(),...options},oracle.toString(),negative);}
  catch(e){failure=e.stack;}
  return {wasm,wasmSHA256:sha(bytes),calcSHA256:sha(pe),fixtureSHA256:sha(fixtureSource()),failure,
    ...JSON.parse(JSON.stringify(context.legacyTextureEvidence))};
}

async function main(){
  const p=plan();new vm.Script('('+fixtureSource()+')');
  for(const s of p.states){
    const qs=s.sets[0].map(([u,v])=>s.qCoefficients[0]*u+s.qCoefficients[1]*v+s.qCoefficients[2]);
    assert(qs.every(q=>q>0));assert(new Set(qs).size===3,'varying texture q');
    for(const t of s.samples)assert.equal(oracle(p.colors,s,t).length,3);
    if(!s.fog)assert(new Set(s.samples.map(t=>JSON.stringify(oracle(p.colors,s,t)))).size>1,
      'nonsolid texture discriminator in every q/w configuration');
  }
  // Independently spell out the inequivalent early-divide result at a known
  // witness. This check also runs in the cheap default invocation.
  const witness=p.states.find(s=>s.fog&&s.geomW&&s.factors[0]===32),p0={x:4,y:6};
  const b=[22/32,4/32,6/32],w=[1.1,1.4,1.3],uvs=witness.sets[0];
  const denominator=b.reduce((s,v,i)=>s+v/w[i],0);
  const early=[0,1].map(c=>uvs.reduce((s,[u,v],i)=>s+b[i]/w[i]*
    (c===0?.5*u+.25*v+.09375:.125*u+.5*v+.15625)/(.75*u+.25*v+.3125),0)/denominator);
  const tex=p.colors[0][Math.floor(early[1]*16)%16][Math.floor(early[0]*16)%16];
  const f=b.reduce((s,v,i)=>s+v*witness.factors[i]/255,0);
  const wrong=tex.map((v,c)=>Math.floor(v*f+witness.fogColor[c]*(1-f)));
  assert.notDeepEqual(wrong,oracle(p.colors,witness,p0),'early division must change rendered expectation');
  const wasm=process.argv.find(a=>a.startsWith('--wasm='))?.slice(7);
  if(!wasm){console.log('PASS analytic varying-q/fog plan ONLY; --wasm and --out establish public pixels');return;}
  const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6);assert(out,'--out required');fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(out,'expected-plan.json'),JSON.stringify({states:p.states,oracle:oracle.toString()}));
  const summary=[];let immediate;
  for(const queued of [false,true])for(const indexed of [false,true]){
    const r=await run(wasm,{queued,indexed});fs.writeFileSync(path.join(out,`positive-${queued}-${indexed}.json`),JSON.stringify(r));
    assert.equal(r.failure,null);assert.equal(r.status,'PASS');
    assert.equal(r.observations.length,p.states.length*3);
    const images=r.observations.filter((_,i)=>i%3===0).map(v=>v.dibRGBA);
    if(!immediate)immediate=images;else assert.deepEqual(images,immediate,'indexed/physical Worker complete-target parity');
    for(const a of r.observations.filter(v=>v.state.fog)){
      const b=r.observations.find(v=>!v.state.fog&&v.state.geomW===a.state.geomW&&
        JSON.stringify(v.state.qCoefficients)===JSON.stringify(a.state.qCoefficients)&&
        JSON.stringify(v.state.factors)===JSON.stringify(a.state.factors)&&JSON.stringify(v.sample)===JSON.stringify(a.sample));
      assert.notDeepEqual(a.actual,b.actual,'fog-on/off discriminator');
    }
    if(queued){assert.equal(r.records.length,p.states.length);assert.equal(r.immutable.length,p.states.length);
      assert.equal(r.transport.fallbacks,0);assert(r.transport.replayCommands>0);}
    summary.push({queued,indexed,draws:p.states.length,pixels:r.observations.length,records:r.records?.length||0});
    console.log('PASS',JSON.stringify(summary.at(-1)));
  }
  for(const negative of ['ignored','early','fog-off','captured-matrix']){
    const states=[p.states.find(s=>s.fog&&s.geomW&&s.factors[0]===32)];
    const r=await run(wasm,{states,queued:negative==='captured-matrix'},negative);
    fs.writeFileSync(path.join(out,`negative-${negative}.json`),JSON.stringify(r));
    assert(r.failure?.includes('PIXEL ORACLE'),'rendered rejection '+negative+': '+r.failure);
    assert(r.calls.some(c=>c.label==='DrawPrimitive7'&&c.result===0),'successful public draw');
    assert(r.calls.some(c=>c.label==='Lock Surface7'&&c.result===0),'successful public readback');
    console.log('PASS successful public draw rejected',negative);
  }
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({status:'PASS',wasm,sha256:sha(fs.readFileSync(wasm)),summary}));
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={plan,oracle,fixtureSource,run};
