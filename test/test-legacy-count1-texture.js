#!/usr/bin/env node
'use strict';
// DX7 explicitly excludes 1-D output: COUNT1 observations are characterization,
// never a guessed native pixel contract. Supported neighboring states use an
// independent authored-vector oracle and successful-draw negative controls.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const packed=require('./test-legacy-transformed-float34'),vb=require('./test-legacy-dimensional-vertex-buffer'),strided=require('./test-legacy-strided-dimensions');
const ROOT=path.resolve(__dirname,'..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function oracle(colors,s,p){
  if(s.unsupported)return null;
  const weights=[1-(p.x+p.y)/32,p.x/32,p.y/32];
  const h=s.sets[s.selector].map((a,i)=>{
    const v=[a[0],a[1]??0,a[2]??0,a[3]??1];
    const b=[0,1,2,3].map(c=>v.reduce((n,x,r)=>n+x*s.matrix[r*4+c],0));
    const w=1+.5*[.2,.8,.6][i];
    return [b[0]/w,b[1]/w,((s.flags&256)?b[(s.flags&255)-1]:1)/w];
  });
  const q=[0,1,2].map(c=>h.reduce((n,a,i)=>n+weights[i]*a[c],0));
  const wrap=x=>((Math.floor(x*16)%16)+16)%16;
  return colors[0][wrap(q[1]/q[2])][wrap(q[0]/q[2])].slice();
}
function config(){
  const base=packed.config(),states=[];
  for(const dimension of [1,2,3,4]){
    const dimensions=[4,dimension,2,3],selector=1;
    const sets=dimensions.map((d,j)=>[[.137+j*.031,.193+j*.027,.337+j*.019,.719+j*.023],
      [.887+j*.031,.193+j*.027,.537+j*.019,.919+j*.023],[.137+j*.031,.943+j*.027,.737+j*.019,1.119+j*.023]].map(a=>a.slice(0,d)));
    for(const flags of [1,0x101,2,0x103]){
      const unsupported=(flags&255)===1;
      const s={dimensions,dimension,selector,sets,flags,geomW:true,mip:1,tl:false,defaultStride:false,
        matrix:[1,.75,.5,.375,.25,.25,.375,.625,.1875,.3125,.4375,.5625,.093,.3125,.625,.4375],
        unsupported,generated:unsupported,label:`FLOAT${dimension}/set1/flags${flags}`};
      const candidates=Array.from({length:18},(_,x)=>Array.from({length:18},(_,y)=>({x:x+4,y:y+4}))).flat().filter(p=>p.x+p.y<29);
      s.samples=unsupported?[{x:4,y:6},{x:9,y:7},{x:6,y:13}]:candidates.filter(p=>[-.0625,0,.0625].every(dx=>[-.0625,0,.0625].every(dy=>JSON.stringify(oracle(base.colors,s,p))===JSON.stringify(oracle(base.colors,s,{x:p.x+dx,y:p.y+dy}))))).slice(0,3);
      assert.equal(s.samples.length,3);states.push(s);
    }
  }
  return {...base,states,update:null};
}
function fixtureSource(route){
  let s={packed,vb,strided}[route].fixtureSource();
  const replace=(a,b)=>{assert.equal(s.split(a).length,2,'COUNT1 seam '+a.slice(0,65));s=s.replace(a,b);};
  replace("if(state.generated)row.boundary='generated-coordinate prerequisite characterization ONLY; no pixel oracle';",
    "if(state.unsupported)row.boundary='DX7 unsupported 1-D output; observed pixels only, no native expectation';");
  // Do not rerun unchanged guard/invalid-count matrices from accepted suites.
  const start=s.indexOf('    if(!negative){\n      const base=config.states[0];evidence.rejected=[];'),end=s.indexOf("    await ok(com('"+(route==='vb'?'Release final VB':'unbind texture')+"'",start);
  assert(start>0&&end>start);s=s.slice(0,start)+s.slice(end);
  replace("      if(negative==='ignored')await tss(24,0);\n      if(negative==='selector')", "      if(negative==='count')await tss(24,0x102);\n      if(negative==='ignored')await tss(24,0);\n      if(negative==='selector')");
  // Capture complete owned bytes before live matrix/selector/flag mutation.
  replace('        await setState({...state,flags:0,selector:0,matrix:identity});',
    '        evidence.beforeMutation=captureQueue(nativeEncoder,evidence);\n        await setState({...state,flags:0,selector:0,matrix:identity});');
  if(route==='packed')replace('let currentFVF=0;const geometry=async state=>{','let currentFVF=0;const geometry=async state=>{await words(indices,[0x10000,2]);');
  if(route==='packed')replace('        inspectQueue(nativeEncoder,e,memory,evidence);',
    '        new Uint8Array(memory.buffer,await wa(vertices),480).fill(0);await words(indices,[0,0]);\n        inspectQueue(nativeEncoder,e,memory,evidence);');
  return s;
}
function captureQueue(encoder,evidence){return (evidence.pendingNativeIndices||[]).map(i=>Array.from(new Uint8Array(encoder.buffers[i].buffer||encoder.buffers[i].view.buffer,0,encoder.buffers[i].used)));}
function inspectQueue(encoder,e,memory,evidence){
  const after=captureQueue(encoder,evidence);
  assert.deepEqual(after,evidence.beforeMutation,'complete queued record immutable after caller data/state mutation');
  const records=[],state=evidence.currentState;
  for(const i of evidence.pendingNativeIndices||[])for(let off=0;off<encoder.buffers[i].used;){
    const d=encoder.buffers[i].view,size=d.getUint32(off,true),type=d.getUint32(off+12,true),n=d.getUint32(off+16,true),stride=[5,6].includes(type)?40:32;
    assert(size>0);const coords=[];
    for(let v=0;v<n;v++){
      const row=Array.from({length:stride===40?4:2},(_,c)=>d.getFloat32(off+32+4096+v*stride+24+c*4,true));
      row.forEach((x,c)=>assert(Math.abs(x-(state.sets[state.selector][v][c]??(c===3?1:0)))<1e-6,'retained supplied component'));
      coords.push(row);
    }
    records.push({type,n,coords,bytes:Array.from(new Uint8Array(d.buffer,off,size))});off+=size;
  }
  assert(records.length);(evidence.ownedRecords||=[]).push({label:state.label,records});delete evidence.beforeMutation;
}
async function run(route,cfg,negative=null){
  const routes=new Map([['/legacy-render.wasm',fs.readFileSync(path.join(ROOT,'build/wine-assembly.wasm'))],['/test/binaries/calc.exe',fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'))],['/lib/host-import-sigs.generated.json',fs.readFileSync(path.join(ROOT,'lib/host-import-sigs.generated.json'))]]);
  const context=vm.createContext({WebAssembly,performance,setTimeout,NativeStream:require('../lib/d3d-command-stream'),NativeWorker:require('node:worker_threads').Worker,nativeWorkerPath:path.join(ROOT,'lib/d3d-render-worker.js'),inspectQueue,captureQueue,
    fetch:async url=>{assert(routes.has(url));const b=routes.get(url);return {arrayBuffer:async()=>Uint8Array.from(b).buffer,json:async()=>JSON.parse(b)};},document:{createElement:()=>({style:{},getContext:()=>({putImageData(){}})}),body:{append(){}}},ImageData:class{}});
  try{return await vm.runInContext('('+fixtureSource(route)+')',context)('software',cfg,oracle.toString(),negative);}catch(e){e.partial=context.legacyTextureEvidence;throw e;}
}
async function main(){
  const dir=process.env.LEGACY_COUNT1_EVIDENCE;assert(dir,'LEGACY_COUNT1_EVIDENCE required');fs.mkdirSync(dir,{recursive:true});const cfg=config(),summary=[],direct=new Map();
  fs.writeFileSync(path.join(dir,'expected-plan.json'),JSON.stringify({contract:'DX7 1-D output unsupported; COUNT1 expected pixels null; no mandated HRESULT',oracle:oracle.toString(),states:cfg.states.map(s=>({state:s,expected:s.samples.map(p=>oracle(cfg.colors,s,p))}))}));
  try{
    for(const route of ['packed','vb','strided'])for(const queued of [false,true])for(const indexed of [false,true]){
      const result=await run(route,{...cfg,queued,indexed});
      const unsupported=result.observations.filter(o=>o.state.unsupported);assert.equal(unsupported.length,24);assert(unsupported.every(o=>o.expected===null));
      const images=Array.from(result.observations,o=>Array.from(o.dibRGBA));
      if(queued)assert.deepEqual(images,direct.get(route+'/'+indexed),'held physical Worker equals immediate full Lock arrays, including unsupported observations');
      else direct.set(route+'/'+indexed,images);
      fs.writeFileSync(path.join(dir,`${route}-${queued}-${indexed}.json`),JSON.stringify(result));
      const row={route,queued,indexed,draws:result.drawCount,unsupportedPixels:unsupported.length,oraclePixels:result.observations.length-unsupported.length,held:result.ownedRecords?.length||0};summary.push(row);console.log('PASS '+JSON.stringify(row));
    }
    for(const negative of ['count','component','default-w']){
      const state=cfg.states.find(s=>s.dimension===1&&s.flags===0x103);let failure;
      try{await run('packed',{...cfg,states:[state]},negative);}catch(e){failure=e;}
      assert.match(String(failure),/PIXEL ORACLE/);assert(failure.partial.calls.some(c=>c.label==='DrawPrimitive7'&&c.result===0));
      fs.writeFileSync(path.join(dir,'negative-'+negative+'.json'),JSON.stringify({error:String(failure),partial:failure.partial}));console.log('PASS negative '+negative);
    }
    fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify({status:'PASS characterization; COUNT1 native pixels unsupported',wasm:hash(fs.readFileSync(path.join(ROOT,'build/wine-assembly.wasm'))),summary}));
  }catch(e){fs.writeFileSync(path.join(dir,'first-failure.json'),JSON.stringify({error:String(e),partial:e.partial}));throw e;}
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={config,oracle,fixtureSource,run};
