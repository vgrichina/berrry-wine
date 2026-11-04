#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const vm=require('node:vm'),crypto=require('node:crypto');
const previous=require('./test-legacy-variable-q-fog');
const ROOT=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');

// Independent homogeneous near/far clipping, followed by screen barycentrics.
// Texture U,V,Q use rational interpolation; device Z and fog are affine.
function oracle(colors,scene,p,details=false){
  let winner=null,depth=1;
  for(const state of scene.layers){
    let poly=state.zs.map((z,i)=>{
      const w=state.geomW?1+.5*z:1,[x,y]=[[0,0],[32,0],[0,32]][i];
      const [u,v]=state.sets[0][i],[qu,qv,q0]=state.qCoefficients;
      return {h:[(x/16-1)*w,(1-y/16)*w,z,w],
        a:[.5*u+.25*v+.09375,.125*u+.5*v+.15625,qu*u+qv*v+q0,state.factors[i]]};
    });
    for(const plane of [v=>v.h[2],v=>v.h[3]-v.h[2]]){
      const out=[];
      for(let i=0;i<poly.length;i++){
        const a=poly[(i+poly.length-1)%poly.length],b=poly[i],da=plane(a),db=plane(b);
        if((da<0)!==(db<0)){
          const t=da/(da-db),mix=(a,b)=>a.map((v,j)=>v+t*(b[j]-v));
          out.push({h:mix(a.h,b.h),a:mix(a.a,b.a)});
        }
        if(db>=0)out.push(b);
      }
      poly=out;
    }
    const screen=v=>[16*(v.h[0]/v.h[3]+1),16*(1-v.h[1]/v.h[3])];
    for(let i=1;i+1<poly.length;i++){
      const tri=[poly[0],poly[i],poly[i+1]],s=tri.map(screen);
      const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
      const area=cross(s[0],s[1],s[2]),point=[p.x,p.y];
      const b=[cross(s[1],s[2],point)/area,cross(s[2],s[0],point)/area,cross(s[0],s[1],point)/area];
      if(b.some(v=>v< -1e-9))continue;
      const z=b.reduce((sum,v,j)=>sum+v*tri[j].h[2]/tri[j].h[3],0);
      if(z>=depth)continue;
      const sum=c=>b.reduce((sum,v,j)=>sum+v*tri[j].a[c]/tri[j].h[3],0);
      const uv=[sum(0)/sum(2),sum(1)/sum(2)],wrap=v=>((Math.floor(v*16)%16)+16)%16;
      const tex=colors[0][wrap(uv[1])][wrap(uv[0])];
      const f=state.fog?b.reduce((sum,v,j)=>sum+v*tri[j].a[3]/255,0):1;
      depth=z;winner={layer:state.name,depth:z,uv,f,rgb:tex.map((v,c)=>Math.floor(v*f+state.fogColor[c]*(1-f)))};
    }
  }
  return details?winner:winner?.rgb||[11,22,33];
}
function plan(){
  const inherited=previous.plan(),base=inherited.states.find(s=>s.fog&&s.geomW&&s.factors[0]===32),states=[];
  for(const qState of inherited.states.filter(s=>s.fog&&s.geomW&&s.factors[0]===32))
    for(const geomW of [false,true])for(const varyingFog of [false,true])for(const reverse of [false,true]){
    // Near intersections are exactly (16,0)/(0,8) at unit w and
    // (20,0)/(0,14) at varying w: isolate composition from coordinate rounding.
    const front={...qState,name:'clipped',geomW,zs:[-.5,.5,1.5],factors:varyingFog?[32,128,224]:[96,96,96]};
    const back={...base,name:'occluder',geomW,zs:[.35,.35,.35],factors:[224,80,160],
      sets:base.sets.map(set=>set.map(([u,v])=>[u+.31,v+.17]))};
    const behind={...back,qCoefficients:qState.qCoefficients,matrix:qState.matrix};
    states.push({...front,label:`q${qState.qCoefficients}/w${geomW}/varyFog${varyingFog}/reverse${reverse}`,reverse,
      layers:reverse?[behind,front]:[front,behind],samples:[{x:1,y:1},{x:16,y:4},{x:8,y:12},{x:4,y:22},{x:28,y:28}]});
  }
  return {...inherited,states};
}
function fixtureSource(){
  let s=previous.fixtureSource();
  const replace=(a,b)=>{assert.equal(s.split(a).length,2,'boundary seam '+a.slice(0,90));s=s.replace(a,b);};
  replace('const device=await acquire',`const zd=await alloc(124);await words(zd,Array(31).fill(0));
    for(const [off,v] of [[0,124],[4,0x1007],[8,32],[12,32],[72,32],[76,0x400],[84,16],[104,0x20000]])await write(zd+off,v);
    const depthSurface=await acquire(out=>com('Create depth Surface7',dd,6,zd,out,0));
    await ok(com('AddAttachedSurface7 depth',rt,3,depthSurface));
    evidence.depthSurface=depthSurface;
    const device=await acquire`);
  replace("const z=state.clip&&negative!=='unclipped'&&i===0?-.5:state.geomW?[.2,.8,.6][i]:.5;",
    "const z=negative==='unclipped'&&state.name==='clipped'&&i===0?.2:state.zs[i];");
  replace('const setState=async state=>{',`const setState=async state=>{
    for(const [id,value] of [[7,state.mutated||negative==='depth-off'?0:1],[14,state.mutated?0:1],[23,state.mutated?8:2]])
      await ok(com('SetRenderState7 depth',device,20,id,value));`);
  replace('matrix:identity,fog:!state.fog', 'matrix:identity,mutated:true,fog:!state.fog');
  replace("negative==='fog-off'?0:state.fog?1:0", "negative==='fog-off'&&state.name==='clipped'?0:state.fog?1:0");
  s=s.replaceAll("negative!=='early'", "(negative!=='early'||state.name!=='clipped')");
  s=s.replaceAll("if(negative==='early'){", "if(negative==='early'&&state.name==='clipped'){");
  const start=s.indexOf('    const draw=async()=>{'),end=s.indexOf('    const preview=',start);
  assert(start>0&&end>start);
  s=s.slice(0,start)+`    const draw=async()=>{
      await ok(com('Clear7 color and depth',device,10,0,0,3,0xff0b1621,bits(1),0));
      await ok(com('BeginScene7',device,5));
      for(const layer of evidence.currentState.layers){
        await setState(layer);await geometry(layer);
        if(negative==='ignored'&&layer.name==='clipped')await tss(24,0);
        await ok(config.indexed
          ?com('DrawIndexedPrimitive7',device,26,4,0x8e2,vertices,3,indices,3,0)
          :com('DrawPrimitive7',device,25,4,0x8e2,vertices,3,0));drawCount++;
      }
      await ok(com('EndScene7',device,6));
    };
`+s.slice(end);
  replace('if(nativeEncoder){evidence.transport=nativeEncoder.snapshot();',
    "await com('Release depth Surface7',depthSurface,2);if(nativeEncoder){evidence.transport=nativeEncoder.snapshot();");
  return s;
}
function queueIndices(encoder,evidence){
  const indices=(evidence.pendingNativeIndices||[]).slice(),item=encoder.buffers[encoder.current];
  if(item.used&&!item.seq&&!indices.includes(encoder.current))indices.push(encoder.current);
  return indices;
}
function captureHashes(encoder,evidence){return queueIndices(encoder,evidence).map(i=>{
  const b=encoder.buffers[i];return sha(b.bytes.subarray(0,b.used));
});}
function inspectQueue(encoder,e,memory,evidence){
  const records=[];
  for(const index of queueIndices(encoder,evidence)){
    const item=encoder.buffers[index];
    for(let offset=0;offset<item.used;){
      const d=item.view,size=d.getUint32(offset,true),type=d.getUint32(offset+12,true),count=d.getUint32(offset+16,true);
      assert(size>0&&offset+size<=item.used);assert.equal(type,5);
      const matrix=Array.from({length:16},(_,i)=>d.getFloat32(offset+32+3136+4*i,true));
      assert.deepEqual(matrix,evidence.currentState.matrix);
      for(const [off,value] of [[284,1],[312,1],[348,2],[368,1]])
        assert.equal(d.getUint32(offset+32+off,true),value,'retained depth/write/LESS/fog state');
      const vertices=Array.from({length:count},(_,i)=>Array.from({length:10},(_,c)=>
        c===4||c===5?d.getUint32(offset+32+4096+i*40+c*4,true):d.getFloat32(offset+32+4096+i*40+c*4,true)));
      const layer=evidence.currentState.layers[records.length];assert(layer);assert.equal(count,3);
      for(let i=0;i<3;i++){
        const w=layer.geomW?1+.5*layer.zs[i]:1;
        assert(Math.abs(vertices[i][2]-layer.zs[i]/w)<1e-6,'retained geometric depth');
        assert(Math.abs(vertices[i][3]-1/w)<1e-6,'retained geometric rhw');
        assert.equal(vertices[i][5]>>>24,layer.factors[i],'retained fog alpha');
        for(let c=0;c<2;c++)assert(Math.abs(vertices[i][6+c]-layer.sets[0][i][c])<1e-6,'retained FLOAT2');
      }
      if(evidence.negative==='captured-matrix'){
        const identity=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
        item.bytes.set(new Uint8Array(identity.buffer),offset+32+3136);
      }
      records.push({type,count,matrix,vertices,depth:{enable:1,write:1,func:2},
        sha256:sha(item.bytes.subarray(offset,offset+size))});offset+=size;
    }
  }
  assert.equal(records.length,2,'both held and buffered production draws inspected');
  (evidence.records||=[]).push({label:evidence.currentState.label,records});
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
  return {wasm,wasmSHA256:sha(bytes),calcSHA256:sha(pe),failure,...JSON.parse(JSON.stringify(context.legacyTextureEvidence))};
}
async function main(){
  const p=plan();new vm.Script('('+fixtureSource()+')');
  for(const s of p.states){
    const owners=s.samples.map(t=>oracle(p.colors,s,t,true)?.layer);
    assert(owners.includes('clipped')&&owners.includes('occluder')&&owners.includes(undefined));
    for(const t of s.samples)assert.deepEqual(oracle(p.colors,s,t),oracle(p.colors,{...s,layers:s.layers.slice().reverse()},t));
  }
  const wasm=process.argv.find(a=>a.startsWith('--wasm='))?.slice(7);
  if(!wasm){console.log('PASS independent clipped/depth rational plan ONLY');return;}
  const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6);assert(out);fs.mkdirSync(out,{recursive:true});
  const summary=[];let images;
  for(const queued of [false,true])for(const indexed of [false,true]){
    const r=await run(wasm,{queued,indexed});fs.writeFileSync(path.join(out,`positive-${queued}-${indexed}.json`),JSON.stringify(r));
    assert.equal(r.failure,null);assert.equal(r.status,'PASS');assert.equal(r.observations.length,p.states.length*5);
    const next=r.observations.filter((_,i)=>i%5===0).map(o=>o.dibRGBA);
    if(images)assert.deepEqual(next,images,'full target immediate/indexed/physical Worker parity');else images=next;
    for(let i=0;i<next.length;i+=2)assert.deepEqual(next[i],next[i+1],'complete reverse-order depth equality');
    if(queued){assert.equal(r.records.length,p.states.length);assert.equal(r.immutable.length,p.states.length);
      assert.equal(r.transport.fallbacks,0);assert.equal(r.transport.replayCommands,p.states.length*2);
      assert.equal(r.transport.fences,p.states.length);assert(r.immutable.every(v=>v.before.length===2));}
    summary.push({queued,indexed,draws:r.drawCount,pixels:r.observations.length,records:r.records?.length||0});console.log('PASS',summary.at(-1));
  }
  for(const negative of ['depth-off','unclipped','ignored','early','fog-off','captured-matrix']){
    const r=await run(wasm,{states:p.states,queued:negative==='captured-matrix'},negative);
    fs.writeFileSync(path.join(out,`negative-${negative}.json`),JSON.stringify(r));
    assert(r.failure?.includes('PIXEL ORACLE'),'pixel rejection '+negative+': '+r.failure);
    assert(r.calls.some(c=>c.label==='DrawPrimitive7'&&c.result===0));assert(r.calls.some(c=>c.label==='Lock Surface7'&&c.result===0));
    console.log('PASS rendered rejection',negative);
  }
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({status:'PASS',wasm,summary}));
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={plan,oracle,fixtureSource,run};
