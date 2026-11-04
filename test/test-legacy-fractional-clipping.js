#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const vm=require('node:vm'),crypto=require('node:crypto'),zlib=require('node:zlib');
const previous=require('./test-legacy-clipped-depth-fog');
const ROOT=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');

// The reference keeps homogeneous intersections and evaluates at D3D's integer
// pixel centres. No rounded vertex or scanline endpoint enters this oracle.
// Texture planes U/w,V/w,Q/w survive clipping; supplied fog is affine within
// each clipped fan triangle (including geometric, rather than texture, w).
function oracle(colors,scene,p,details=false){
  let winner=null,depth=1;
  for(const state of scene.layers){
    let poly=state.zs.map((z,i)=>{
      const w=state.geomW?1+.5*z:1,[x,y]=[[0,0],[32,0],[0,32]][i];
      const [u,v]=state.sets[0][i],[qu,qv,q0]=state.qCoefficients;
      return {h:[(x/16-1)*w,(1-y/16)*w,z,w],
        a:[.5*u+.25*v+.09375,.125*u+.5*v+.15625,qu*u+qv*v+q0,state.factors[i]]};
    });
    if(scene.winding)poly=[poly[0],poly[2],poly[1]];
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
      const texel=[wrap(uv[0]),wrap(uv[1])],tex=colors[0][texel[1]][texel[0]];
      const f=state.fog?b.reduce((sum,v,j)=>sum+v*tri[j].a[3]/255,0):1;
      depth=z;winner={layer:state.name,depth:z,uv,texel,f,screen:s,barycentric:b,
        rgb:tex.map((v,c)=>Math.floor(v*f+state.fogColor[c]*(1-f)))};
    }
  }
  return details?winner:winner?.rgb||[11,22,33];
}
function plan(){
  const inherited=previous.plan(),states=[];
  // Retained witness, nearby intersections on either side, integral control,
  // and an unclipped control. Both Q fields and both geometric w fields.
  for(const zs of [[-.5,.8,.6],[-.49,.8,.6],[-.51,.8,.6],[-.5,.5,1.5],[.2,.8,.6]])
    for(const q of [0.75,0.125])for(const geomW of [false,true])for(const winding of [false,true]){
      const original=inherited.states.find(s=>s.qCoefficients[0]===q&&s.geomW===geomW&&s.factors[0]===96&&!s.reverse);
      const layers=original.layers.map(l=>({...l,winding,fog:false,...(l.name==='clipped'?{zs}: {})}));
      states.push({...original,winding,fog:false,layers,label:`z${zs}/q${q}/w${geomW}/wind${winding}`,
        samples:[{x:8,y:12},{x:9,y:12},{x:8,y:13},{x:16,y:4},{x:5,y:6},{x:1,y:1},{x:28,y:28}]});
    }
  // Constant fog makes the historical RGB witness explicit; varying fog tests
  // the clipped fan, without conflating texture Q with geometric rhw.
  for(const geomW of [false,true])for(const varying of [false,true])for(const winding of [false,true]){
    const original=states.find(s=>s.label.startsWith('z-0.5,0.8,0.6/q0.125/w'+geomW)&&s.winding===winding);
    states.push({...original,label:original.label+'/fog'+varying,fog:true,
      layers:original.layers.map(l=>({...l,fog:true,...(l.name==='clipped'?{factors:varying?[32,128,224]:[96,96,96]}:{})}))});
  }
  return {...inherited,states,tolerance:2};
}
function fixtureSource(){
  let s=previous.fixtureSource();
  const replace=(a,b)=>{assert.equal(s.split(a).length,2,'fractional seam '+a.slice(0,80));s=s.replace(a,b);};
  replace('for(const [i,[x,y]] of [[-1,1],[1,1],[-1,-1]].entries()){',
    `for(const [slot,i] of (state.winding?[0,2,1]:[0,1,2]).entries()){
        const [x,y]=[[-1,1],[1,1],[-1,-1]][i];`);
  replace('vertices+i*88','vertices+slot*88');
  // Capture all observations even on the old broken modules. Host assertions
  // below remain strict; this is not a generated-coordinate exemption.
  replace('else close(actual,expected,label);',"else row.pixelMatch=actual.every((v,i)=>Math.abs(v-expected[i])<=(state.fog?config.tolerance:0));");
  return s;
}
async function run(wasm,options={}){
  const bytes=fs.readFileSync(wasm),pe=fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'));
  const routes=new Map([['/legacy-render.wasm',bytes],['/test/binaries/calc.exe',pe],
    ['/lib/host-import-sigs.generated.json',fs.readFileSync(path.join(ROOT,'lib/host-import-sigs.generated.json'))]]);
  const context=vm.createContext({WebAssembly,performance,setTimeout,inspect(){},
    inspectQueue(encoder,e,memory,evidence){
      const records=[];
      const indices=(evidence.pendingNativeIndices||[]).slice(),pending=encoder.buffers[encoder.current];
      if(pending.used&&!pending.seq&&!indices.includes(encoder.current))indices.push(encoder.current);
      for(const index of indices){const item=encoder.buffers[index];for(let offset=0;offset<item.used;){
        const d=item.view,size=d.getUint32(offset,true);assert(size>0&&offset+size<=item.used);
        assert.equal(d.getUint32(offset+12,true),5);assert.equal(d.getUint32(offset+16,true),3);
        const layer=evidence.currentState.layers[records.length];assert(layer);
        const vertices=[];
        for(let slot=0;slot<3;slot++){
          const i=(layer.winding?[0,2,1]:[0,1,2])[slot],p=offset+32+4096+slot*40;
          const v=Array.from({length:10},(_,c)=>c===4||c===5?d.getUint32(p+4*c,true):d.getFloat32(p+4*c,true));
          const w=layer.geomW?1+.5*layer.zs[i]:1;
          assert(Math.abs(v[2]-layer.zs[i]/w)<1e-6);assert(Math.abs(v[3]-1/w)<1e-6);
          for(let c=0;c<2;c++)assert(Math.abs(v[6+c]-layer.sets[0][i][c])<1e-6);
          assert.equal(v[5]>>>24,layer.factors[i]);vertices.push(v);
        }
        for(const [off,value] of [[284,1],[312,1],[348,2],[368,layer.fog?1:0]])assert.equal(d.getUint32(offset+32+off,true),value);
        const matrix=Array.from({length:16},(_,i)=>d.getFloat32(offset+32+3136+4*i,true));
        assert.deepEqual(matrix,layer.matrix);
        records.push({vertices,matrix,sha256:sha(item.bytes.subarray(offset,offset+size))});offset+=size;
      }}
      assert.equal(records.length,2);(evidence.records||=[]).push(records);
    },
    captureHashes(encoder,evidence){return encoder.buffers.filter(b=>b.used).map(b=>sha(b.bytes.subarray(0,b.used)));},
    NativeStream:require('../lib/d3d-command-stream'),NativeWorker:require('node:worker_threads').Worker,
    nativeWorkerPath:path.join(ROOT,'lib/d3d-render-worker.js'),
    fetch:async url=>{assert(routes.has(url));const b=routes.get(url);return {arrayBuffer:async()=>Uint8Array.from(b).buffer,json:async()=>JSON.parse(b)};},
    document:{createElement:()=>({style:{},getContext:()=>({putImageData(){}})}),body:{append(){}}},ImageData:class{}});
  let failure=null;
  try{await vm.runInContext('('+fixtureSource()+')',context)('software',{...plan(),...options},oracle.toString(),null);}
  catch(e){failure=e.stack;}
  return {wasm,wasmSHA256:sha(bytes),calcSHA256:sha(pe),failure,...JSON.parse(JSON.stringify(context.legacyTextureEvidence))};
}
async function main(){
  const p=plan();new vm.Script('('+fixtureSource()+')');
  const witness=p.states.find(s=>s.label==='z-0.5,0.8,0.6/q0.125/wfalse/windfalse/fogfalse');
  const detail=oracle(p.colors,witness,{x:8,y:12},true);
  assert.deepEqual(detail.texel,[8,10]);assert.deepEqual(detail.rgb,[115,34,147]);
  assert(Math.abs(detail.depth-.2375)<1e-12);
  // Causal alternative, not an expected-pixel convention: snapping P=(0,160/11)
  // to (0,15) gives the B->P row-12 edge x=6.4. Assigning its attributes to
  // x=6 changes the original-vertex weights at x=8 to the following values.
  const displaced=[(6/7*.8)*(6/11),6/7*.2+1/7*.625,(6/7*.8)*(5/11)+1/7*.375];
  const fields=witness.sets[0].map(([u,v])=>[.5*u+.25*v+.09375,.125*u+.875*v+.21875]);
  const sum=c=>displaced.reduce((s,b,i)=>s+b*fields[i][c],0),wrongU=sum(0)/sum(1);
  assert(Math.abs(wrongU-.5632495507094604)<1e-12);
  assert.equal(Math.floor(wrongU*16),9,'rounded endpoint moves to the wrong texture column');
  const control=p.states.find(s=>s.label==='z0.2,0.8,0.6/q0.125/wfalse/windfalse');
  assert.deepEqual(oracle(p.colors,control,{x:5,y:6}),[20,25,30]);
  assert.deepEqual(oracle(p.colors,control,{x:5.5,y:6.5}),[60,25,65],
    'unclipped control discriminates integer from half-integer sample centres');
  // Unit-w clipping cannot change an interior attribute field. Evaluate the
  // authored triangle directly, independent of the polygon's fan diagonal.
  for(const s of p.states.filter(s=>!s.geomW&&!s.fog))for(const sample of s.samples){
    const hit=oracle(p.colors,s,sample,true);if(hit?.layer!=='clipped')continue;
    const raw={...s,layers:s.layers.filter(l=>l.name==='clipped').map(l=>({...l,zs:[.2,.8,.6]}))};
    assert.deepEqual(oracle(p.colors,raw,sample),hit.rgb,'clipping preserves the texture field');
  }
  const wasm=process.argv.find(a=>a.startsWith('--wasm='))?.slice(7);
  if(!wasm){console.log('PASS independent fractional clipping plan ONLY',detail);return;}
  const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6);assert(out);fs.mkdirSync(out,{recursive:true});
  const characterize=process.argv.includes('--characterize'),summary=[];let images;
  for(const queued of [false,true])for(const indexed of [false,true]){
    const r=await run(wasm,{queued,indexed});
    fs.writeFileSync(path.join(out,`pixels-${queued}-${indexed}.json.gz`),zlib.gzipSync(JSON.stringify(r)));
    assert.equal(r.failure,null);assert.equal(r.status,'PASS');assert.equal(r.observations.length,p.states.length*7);
    const mismatch=r.observations.filter(o=>!o.pixelMatch).map(o=>({label:o.label,actual:o.actual,expected:o.expected}));
    const next=r.observations.filter((_,i)=>i%7===0).map(o=>o.dibRGBA);
    if(images)assert.deepEqual(next,images,'full immediate/indexed/physical Worker target parity');else images=next;
    const windingDifferences=[];
    for(let i=0;i<p.states.length;i+=2){
      let pixels=0;for(let j=0;j<next[i].length;j+=4)
        if(next[i].slice(j,j+3).some((v,c)=>v!==next[i+1][j+c]))pixels++;
      windingDifferences.push({label:p.states[i].label,pixels});
      if(!characterize&&!p.states[i].fog){
        assert.equal(pixels,0,'complete textured target winding invariance');
        for(let k=0;k<7;k++)assert.deepEqual(r.observations[i*7+k].actual,
          r.observations[(i+1)*7+k].actual,'interior texture winding invariance');
      }
    }
    if(queued){assert.equal(r.transport.fallbacks,0);assert.equal(r.transport.replayCommands,p.states.length*2);
      assert.equal(r.transport.fences,p.states.length);assert.equal(r.immutable.length,p.states.length);
      assert.equal(r.records.length,p.states.length);}
    summary.push({queued,indexed,draws:r.drawCount,pixels:r.observations.length,mismatch,windingDifferences});
    console.log(JSON.stringify({queued,indexed,draws:r.drawCount,pixels:r.observations.length,mismatches:mismatch.length,first:mismatch[0]}));
    fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({status:summary.some(s=>s.mismatch.length)?'PIXEL_MISMATCH':'PASS',
      wasm,wasmSHA256:r.wasmSHA256,characterize,summary},null,2));
    if(!characterize)assert.deepEqual(mismatch,[],'continuous geometric pixel oracle');
  }
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={plan,oracle,fixtureSource,run};
