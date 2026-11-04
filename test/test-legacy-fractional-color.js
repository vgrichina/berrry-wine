#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const vm=require('node:vm'),crypto=require('node:crypto'),zlib=require('node:zlib');
const previous=require('./test-legacy-fractional-clipping');
const ROOT=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');

// Independent homogeneous polygon clipping. Colours remain packed bytes at
// generated vertices, as required by the existing legacy TL representation.
// Raster interpolation is affine screen-space Gouraud, separate from U/V/Q/w.
// This continuous geometry convention does not specify D3D7 intermediate
// precision. test-legacy-color-precision.js independently resolves the two
// integer-boundary diagnostics without treating ideal-real bytes as required.
function oracle(colors,scene,p,details=false){
  const unpack=n=>[n>>>16&255,n>>>8&255,n&255,n>>>24];
  let winner=null,depth=1;
  for(const state of scene.layers){
    let poly=state.manual||state.zs.map((z,i)=>{
      const w=state.geomW?1+.5*z:1,[x,y]=[[0,0],[32,0],[0,32]][i];
      return {h:[(x/16-1)*w,(1-y/16)*w,z,w],c:unpack(state.diffuse[i]),f:state.factors[i]};
    });
    const order=state.order||[0,1,2];if(!state.manual)poly=order.map(i=>poly[i]);
    for(const plane of [v=>v.h[2],v=>v.h[3]-v.h[2]]){
      const out=[];
      for(let i=0;i<poly.length;i++){
        const a=poly[(i+poly.length-1)%poly.length],b=poly[i],da=plane(a),db=plane(b);
        if((da<0)!==(db<0)){
          const t=da/(da-db),mix=(a,b)=>a.map((v,j)=>v+t*(b[j]-v));
          out.push({h:mix(a.h,b.h),c:mix(a.c,b.c).map(v=>Math.floor(v+1e-12)),f:Math.floor(a.f+t*(b.f-a.f)+1e-12)});
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
      const channels=[0,1,2,3].map(c=>b.reduce((sum,v,j)=>sum+v*tri[j].c[c],0));
      const diffuse=channels.map(v=>Math.floor(v+1e-10));
      if(state.alphaTest&&diffuse[3]<=100)continue;
      const f=state.fog?b.reduce((sum,v,j)=>sum+v*tri[j].f/255,0):1;
      const rgb=diffuse.slice(0,3).map((v,c)=>state.fog?Math.floor(v*f+state.fogColor[c]*(1-f)+1e-10):v);
      depth=z;winner={layer:state.name,depth:z,channels,f,rgb,screen:s,barycentric:b,vertices:tri};
    }
  }
  return details?winner:winner?.rgb||[11,22,33];
}
function plan(){
  const inherited=previous.plan(),base=inherited.states[0],states=[];
  const fields=[[0xff103050,0xffe028b0,0xff4080e0],[0xff406080,0xff406080,0xff406080]];
  for(const zs of [[.2,.8,.6],[-.5,.5,.5],[-.5,.8,.6],[.2,1.3,.6],[-.5,.5,1.5],[.2,2.7,.6],[0,4,0]])
    for(const geomW of [false,true])for(const order of [[0,1,2],[0,2,1],[1,2,0]])
      for(const constant of [false,true])for(const fog of [false,true]){
        const diffuse=fields[constant?1:0];
        const layers=base.layers.map(l=>({...l,order,geomW,fog,
          diffuse:l.name==='clipped'?diffuse:[0xff31465b,0xff31465b,0xff31465b],
          factors:constant?[96,96,96]:[32,128,224],...(l.name==='clipped'?{zs}: {})}));
        states.push({...base,order,geomW,constant,fog,diffuse,layers,
          label:`z${zs}/w${geomW}/order${order}/constant${constant}/fog${fog}`,
          samples:[{x:8,y:12},{x:9,y:12},{x:8,y:13},{x:16,y:4},{x:5,y:6},{x:1,y:1},{x:28,y:28}]});
      }
  // Feed independently generated, byte-packed intersections back through the
  // public XYZRHW path. These controls separate clipping from rasterization.
  for(const geomW of [false,true])for(const fog of [false,true]){
    const s=states.find(s=>s.geomW===geomW&&s.fog===fog&&!s.constant&&s.label.startsWith('z-0.5,0.8,0.6/'));
    const manual=oracle(inherited.colors,s,{x:16,y:4},true).vertices;
    states.push({...s,label:s.label+'/manualTL',layers:s.layers.map(l=>l.name==='clipped'?{...l,manual}:l)});
  }
  for(const geomW of [false,true])for(const order of [[0,1,2],[0,2,1]]){
    const s=states.find(s=>s.geomW===geomW&&!s.fog&&!s.constant&&s.label.startsWith('z-0.5,0.8,0.6/')&&''+s.order===''+order);
    states.push({...s,label:s.label+'/alphaTest',layers:s.layers.map(l=>l.name==='clipped'?{...l,alphaTest:true,
      diffuse:l.diffuse.map((c,i)=>((c&0xffffff)|([32,192,128][i]<<24))>>>0)}:l)});
  }
  const otherQ=inherited.states.find(s=>s.qCoefficients[0]!==base.qCoefficients[0]);
  for(const geomW of [false,true])for(const fog of [false,true]){
    const s=states.find(s=>s.geomW===geomW&&s.fog===fog&&!s.constant&&s.label.startsWith('z-0.5,0.8,0.6/'));
    states.push({...s,label:s.label+'/otherTextureQ',layers:s.layers.map(l=>({...l,
      qCoefficients:otherQ.qCoefficients,matrix:otherQ.matrix}))});
  }
  return {...inherited,states,tolerance:0};
}
function fixtureSource(){
  let s=previous.fixtureSource();
  const replace=(a,b)=>{assert.equal(s.split(a).length,2,'colour seam '+a);s=s.replace(a,b);};
  replace('(state.winding?[0,2,1]:[0,1,2])','(state.order||[0,1,2])');
  replace('const middle=[0,0xffffffff,(state.factors[i]<<24)>>>0];',
    "const middle=[0,negative==='constant-diffuse'?0xff406080:state.diffuse[i],((state.factors[i]<<24)|0x132739)>>>0];");
  replace('await words(vertices+slot*88,[bits(x*w),bits(y*w),bits(z),...middle,...coords.map(bits)]);',
    `if(state.manual){
          const v=state.manual[slot],pack=c=>((c[3]<<24)|(c[0]<<16)|(c[1]<<8)|c[2])>>>0;
          await words(vertices+slot*88,[bits(16*(v.h[0]/v.h[3]+1)),bits(16*(1-v.h[1]/v.h[3])),
            bits(v.h[2]/v.h[3]),bits(1/v.h[3]),pack(v.c),((v.f<<24)|0x132739)>>>0,...coords.map(bits)]);
        }else await words(vertices+slot*88,[bits(x*w),bits(y*w),bits(z),...middle,...coords.map(bits)]);`);
  s=s.replaceAll('4,0x8e2,vertices,3','4,layer.manual?0x8c4:0x8e2,vertices,3');
  replace('await tss(11,state.selector);await tss(24,state.flags);',
    `await tss(1,2);await tss(2,0);await tss(4,2);await tss(5,0);
      await ok(com('Gouraud shade',device,20,9,2));
      for(const [id,value] of [[15,negative==='alpha-off'?0:state.alphaTest?1:0],[24,100],[25,5],[29,0]])
        await ok(com('Colour interpolation state',device,20,id,value));
      await tss(11,state.selector);await tss(24,state.flags);`);
  return s;
}
async function run(wasm,options={},negative=null){
  const bytes=fs.readFileSync(wasm),pe=fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'));
  const routes=new Map([['/legacy-render.wasm',bytes],['/test/binaries/calc.exe',pe],
    ['/lib/host-import-sigs.generated.json',fs.readFileSync(path.join(ROOT,'lib/host-import-sigs.generated.json'))]]);
  const context=vm.createContext({WebAssembly,performance,setTimeout,inspect(){},
    inspectQueue(encoder,e,memory,evidence){
      const records=[],indices=(evidence.pendingNativeIndices||[]).slice(),pending=encoder.buffers[encoder.current];
      if(pending.used&&!pending.seq&&!indices.includes(encoder.current))indices.push(encoder.current);
      for(const index of indices){const item=encoder.buffers[index];for(let offset=0;offset<item.used;){
        const d=item.view,size=d.getUint32(offset,true);assert(size>0&&offset+size<=item.used);
        const layer=evidence.currentState.layers[records.length];assert(layer);const vertices=[];
        assert.equal(d.getUint32(offset+12,true),layer.manual?3:5);assert.equal(d.getUint32(offset+16,true),3);
        for(let slot=0;slot<3;slot++){
          const i=layer.order[slot],p=offset+32+4096+slot*(layer.manual?32:40);
          const v=Array.from({length:layer.manual?8:10},(_,c)=>c===4||c===5?d.getUint32(p+4*c,true):d.getFloat32(p+4*c,true));
          const mv=layer.manual?.[slot],w=mv?mv.h[3]:layer.geomW?1+.5*layer.zs[i]:1;
          assert(Math.abs(v[2]-(mv?mv.h[2]:layer.zs[i])/w)<1e-6);assert(Math.abs(v[3]-1/w)<1e-6);
          const c=mv?.c,packed=c?((c[3]<<24)|(c[0]<<16)|(c[1]<<8)|c[2])>>>0:layer.diffuse[i];
          assert.equal(v[4],packed);assert.equal(v[5],(((mv?mv.f:layer.factors[i])<<24)|0x132739)>>>0);
          for(let c=0;c<2;c++)assert(Math.abs(v[6+c]-layer.sets[0][i][c])<1e-6);
          vertices.push(v);
        }
        for(const [off,value] of [[284,1],[292,2],[312,1],[348,2],[368,layer.fog?1:0]])assert.equal(d.getUint32(offset+32+off,true),value);
        for(const [off,value] of [[316,layer.alphaTest?1:0],[352,100],[356,5],[372,0]])assert.equal(d.getUint32(offset+32+off,true),value);
        const matrix=Array.from({length:16},(_,i)=>d.getFloat32(offset+32+3136+4*i,true));
        assert.deepEqual(matrix,layer.manual?[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]:layer.matrix);
        records.push({vertices,matrix,sha256:sha(item.bytes.subarray(offset,offset+size))});offset+=size;
      }}
      assert.equal(records.length,2);(evidence.records||=[]).push(records);
    },
    captureHashes(encoder){return encoder.buffers.filter(b=>b.used).map(b=>sha(b.bytes.subarray(0,b.used)));},
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
  const witness=p.states.find(s=>s.geomW&&!s.constant&&!s.fog&&s.label.startsWith('z-0.5,0.8,0.6/'));
  assert.deepEqual(oracle(p.colors,witness,{x:16,y:4}),[104,51,131]);
  // The old rounded triangle is R=(17,0), B=(32,0), P=(0,19).
  // At y=4 the edges are 13.421... and 25.263..., snapped to 13 and 25.
  // Byte packing at both edges and the span then explains the exact defect.
  const R=[96,44,116],B=[224,40,176],P=[37,84,145];
  const mix=(a,b,t)=>a.map((v,i)=>Math.floor(v+t*(b[i]-v)));
  const old=mix(mix(R,P,4/19),mix(B,P,4/19),3/12);
  assert.deepEqual(old,[108,51,133]);
  assert.notDeepEqual(old,oracle(p.colors,witness,{x:16,y:4}));
  const reversed={...witness,layers:witness.layers.map(l=>({...l,order:[0,2,1]}))};
  assert.deepEqual(oracle(p.colors,reversed,{x:16,y:4}),[100,54,133],
    'homogeneous clipping + byte packing + affine screen colour is NOT generally winding invariant');
  const control=p.states[0];
  assert.deepEqual(oracle(p.colors,control,{x:1,y:1}),[24,50,87]);
  assert.notDeepEqual(oracle(p.colors,control,{x:1.5,y:1.5}),[24,50,87],'integer sample-centre discriminator');
  for(const geomW of [false,true]){
    const s=p.states.find(s=>s.geomW===geomW&&!s.constant&&!s.fog&&s.label.startsWith('z0.2,2.7,0.6/'));
    const hit=oracle(p.colors,s,{x:1,y:1},true);
    assert.equal(hit.layer,'clipped');
    assert(hit.vertices.some(v=>Math.abs(v.h[2]-v.h[3])<1e-12),'actual homogeneous far intersection for each geometric w field');
  }
  const wasm=process.argv.find(a=>a.startsWith('--wasm='))?.slice(7);
  if(!wasm){console.log('PASS homogeneous packed-colour plan ONLY',p.states.length);return;}
  const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6);assert(out);fs.mkdirSync(out,{recursive:true});
  const characterize=process.argv.includes('--characterize'),summary=[];let images,moduleSHA;
  for(const queued of [false,true])for(const indexed of [false,true]){
    const r=await run(wasm,{queued,indexed});
    fs.writeFileSync(path.join(out,`pixels-${queued}-${indexed}.json.gz`),zlib.gzipSync(JSON.stringify(r)));
    assert.equal(r.failure,null);assert.equal(r.status,'PASS');assert.equal(r.observations.length,p.states.length*7);
    if(moduleSHA)assert.equal(r.wasmSHA256,moduleSHA);else moduleSHA=r.wasmSHA256;
    const mismatch=r.observations.filter(o=>!o.pixelMatch).map(o=>({label:o.label,sample:o.sample,actual:o.actual,expected:o.expected}));
    const next=r.observations.filter((_,i)=>i%7===0).map(o=>o.dibRGBA);
    if(images)assert.deepEqual(next,images,'full immediate/indexed/physical Worker target parity');else images=next;
    const manualControlDifferences=[];
    for(const o of r.observations.filter(o=>o.label.includes('/manualTL/16,4'))){
      const authored=r.observations.find(v=>v.label===o.label.replace('/manualTL',''));
      if(JSON.stringify(o.actual)!==JSON.stringify(authored.actual))
        manualControlDifferences.push({label:o.label,manual:o.actual,authored:authored.actual});
    }
    for(let i=0;i<p.states.length;i++){
      const s=p.states[i];
      if(s.label.endsWith('/otherTextureQ')){
        const j=p.states.findIndex(v=>v.label===s.label.replace('/otherTextureQ',''));
        assert.deepEqual(next[i],next[j],'texture Q cannot change Gouraud colour or geometric depth/fog');
      }else if(s.constant&&''+s.order==='0,1,2'){
        for(const order of [[0,2,1],[1,2,0]]){
          const j=p.states.findIndex(v=>v.label===s.label.replace('order0,1,2','order'+order));
          assert.deepEqual(next[i],next[j],'complete constant-colour/fog winding control');
        }
      }
    }
    if(queued){assert.equal(r.transport.fallbacks,0);assert.equal(r.transport.replayCommands,p.states.length*2);
      assert.equal(r.transport.fences,p.states.length);assert.equal(r.immutable.length,p.states.length);assert.equal(r.records.length,p.states.length);}
    summary.push({queued,indexed,draws:r.drawCount,pixels:r.observations.length,mismatch,manualControlDifferences});
    console.log(JSON.stringify({queued,indexed,draws:r.drawCount,pixels:r.observations.length,mismatches:mismatch.length,first:mismatch[0]}));
    fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({status:summary.some(s=>s.mismatch.length)?'PIXEL_MISMATCH':'PASS',wasm,wasmSHA256:r.wasmSHA256,characterize,summary},null,2));
    if(!characterize){
      assert.deepEqual(mismatch,[],'geometric colour oracle');
      assert.deepEqual(manualControlDifferences,[],'independently packed public TL intersection control');
    }
  }
  if(!characterize)for(const negative of ['constant-diffuse','fog-off','alpha-off']){
    const s=p.states.find(s=>s.geomW&&!s.constant&&s.label.startsWith('z-0.5,0.8,0.6/')&&
      (negative==='fog-off'?s.fog:negative==='alpha-off'?s.label.endsWith('/alphaTest'):!s.fog));
    const r=await run(wasm,{states:[s]},negative);
    fs.writeFileSync(path.join(out,`negative-${negative}.json.gz`),zlib.gzipSync(JSON.stringify(r)));
    assert.equal(r.failure,null);assert(r.observations.some(o=>!o.pixelMatch),'rendered negative '+negative);
    assert(r.calls.some(c=>c.label==='DrawPrimitive7'&&c.result===0));
    assert(r.calls.some(c=>c.label==='Lock Surface7'&&c.result===0));
    console.log('PASS rendered rejection',negative);
  }
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={plan,oracle,fixtureSource,run};
