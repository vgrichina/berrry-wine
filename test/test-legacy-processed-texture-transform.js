#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const producer=require('./test-legacy-processvertices-dimensional');
const accepted=require('./test-legacy-transformed-float34');
const ROOT=path.resolve(__dirname,'..');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');

// Legacy supplied-coordinate copy characterization, not D3D8/9's generated
// output-set allocation contract. An XYZRHW draw bypasses texture matrices.
// Expected pixels use only the authored post-process UV and geometric RHW.
function oracle(colors,state,sample){
  const weights=[1-(sample.x+sample.y)/32,sample.x/32,sample.y/32];
  let q=0,u=0,v=0;
  for(let i=0;i<3;i++){
    const rhw=1/(state.geomW?1+.5*[.2,.8,.6][i]:1);
    const a=state.sets[state.selector][i],k=weights[i]*rhw;
    q+=k;u+=k*a[0];v+=k*(a[1]??0);
  }
  const grid=colors[0],n=grid.length,wrap=x=>((Math.floor(x*n)%n)+n)%n;
  return grid[wrap(v/q)][wrap(u/q)].slice();
}
function config(){
  const base=accepted.config(),states=[];
  const supplied=require('./test-legacy-coordinate-dimensions').plan().states.filter(s=>s.flags===0);
  for(const s of supplied)for(const flags of [0,2,3,4]){
    const matrix=s.geomW?[2,.5,.25,.75, .5,3,.75,.25, .25,.75,2,.5, .375,.625,.5,2]:s.matrix;
    states.push({...s,flags,matrix,mip:1,label:s.label+'/legacy-PV-count'+flags});
  }
  // Preserve predecessor truncation/default behavior under active transforms;
  // these are bounded compatibility cells, not native padding conformance.
  for(const s of supplied.filter(s=>s.selector===2&&!s.geomW))states.push({...s,flags:3,
    label:s.label+'/legacy-PV-dst-layout',destinationClamp:true,
    dstDimensions:s.dimensions.map((d,i)=>i===s.selector?d:[2,3,4,1][d-1])});
  const missing=supplied.find(s=>s.selector===2&&!s.geomW);
  states.push({...missing,flags:4,label:missing.label+'/legacy-PV-missing-sets',
    dimensions:missing.dimensions.slice(0,4),sets:missing.sets.slice(0,4),dstDimensions:missing.dimensions});
  for(const s of states){
    const candidates=Array.from({length:18},(_,x)=>Array.from({length:18},(_,y)=>({x:x+4,y:y+4}))).flat().filter(p=>p.x+p.y<29);
    s.samples=candidates.filter(p=>[-.0625,0,.0625].every(dx=>[-.0625,0,.0625].every(dy=>
      JSON.stringify(oracle(base.colors,s,p))===JSON.stringify(oracle(base.colors,s,{x:p.x+dx,y:p.y+dy}))))).slice(0,3);
    assert.equal(s.samples.length,3);
  }
  return {...base,states,update:null};
}
function fixtureSource(){
  let s=producer.fixtureSource();
  // This deliberately incorrect public input transformation must be rejected
  // by the preauthored full byte oracle, before drawing can hide the error.
  const seam='      const sourceBefore=Array.from(sourceBytes);';
  assert.equal(s.split(seam).length,2);
  s=s.replace(seam,`      if(negative==='pretransform'){
        const view=new DataView(memory.buffer,await wa(src.p),src.n);
        const off=24+4*layout.slice(0,state.selector).reduce((a,b)=>a+b,0);
        for(let i=0;i<4;i++){
          const at=(2+i)*stride+off,dim=layout[state.selector];
          const a=[0,1,2,3].map(c=>c<dim?view.getFloat32(at+c*4,true):(c===3?1:0));
          for(let c=0;c<dim;c++)view.setFloat32(at+c*4,a.reduce((v,x,j)=>v+x*state.matrix[4*j+c],0),true);
        }
      }
`+seam);
  return s;
}
async function run(cfg,negative=null){
  const routes=new Map([['/legacy-render.wasm',fs.readFileSync(path.join(ROOT,'build/wine-assembly.wasm'))],['/test/binaries/calc.exe',fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'))],['/lib/host-import-sigs.generated.json',fs.readFileSync(path.join(ROOT,'lib/host-import-sigs.generated.json'))]]);
  const context=vm.createContext({WebAssembly,performance,setTimeout,NativeStream:require('../lib/d3d-command-stream'),NativeWorker:require('node:worker_threads').Worker,nativeWorkerPath:path.join(ROOT,'lib/d3d-render-worker.js'),inspectQueue:producer.inspectQueue,
    fetch:async url=>{assert(routes.has(url));const b=routes.get(url);return {arrayBuffer:async()=>Uint8Array.from(b).buffer,json:async()=>JSON.parse(b)};},document:{createElement:()=>({style:{},getContext:()=>({putImageData(){}})}),body:{append(){}}},ImageData:class{}});
  try{return await vm.runInContext('('+fixtureSource()+')',context)('software',cfg,oracle.toString(),negative);}
  catch(error){error.partial=context.legacyTextureEvidence;throw error;}
}
async function main(){
  const dir=process.env.LEGACY_PROCESSED_EVIDENCE;assert(dir,'LEGACY_PROCESSED_EVIDENCE required');fs.mkdirSync(dir,{recursive:true});
  const cfg=config(),results=[];
  // Save independent expected coordinates/pixels before executing the module.
  fs.writeFileSync(path.join(dir,'expected-plan.json'),JSON.stringify({oracle:oracle.toString(),states:cfg.states.map(s=>({state:s,uv:s.sets[s.selector].map(a=>[a[0],a[1]??0]),pixels:s.samples.map(p=>oracle(cfg.colors,s,p))}))}));
  try{
    for(const queued of [false,true])for(const indexed of [false,true]){
      const result=await run({...cfg,queued,indexed});results.push(result);
      fs.writeFileSync(path.join(dir,`positive-${queued}-${indexed}.json`),JSON.stringify(result));
      console.log('PASS public processed texture '+JSON.stringify({queued,indexed,draws:result.drawCount,pixels:result.observations.length,bytes:result.processBytes.length,records:result.ownedProcessedRecords||0}));
    }
    for(const negative of ['pretransform','drop-z','drop-w','selector','indices']){
      const state=cfg.states.find(s=>s.flags===3&&!s.geomW&&s.dimension===(negative==='drop-w'?4:3));
      let failure;try{await run({...cfg,states:[state],indexed:negative==='indices'},negative);}catch(e){failure=e;}
      assert.match(String(failure),['selector','indices'].includes(negative)?/PIXEL ORACLE/:/PV BYTE ORACLE/);
      assert(failure.partial.calls.some(c=>c.label==='ProcessVertices7'&&c.result===0));
      fs.writeFileSync(path.join(dir,'negative-'+negative+'.json'),JSON.stringify({error:String(failure),partial:failure.partial}));
      console.log('PASS semantic negative '+negative);
    }
    fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify({status:'PASS',wasm:hash(fs.readFileSync(path.join(ROOT,'build/wine-assembly.wasm'))),states:cfg.states.length,cells:results.map(r=>({draws:r.drawCount,pixels:r.observations.length,records:r.ownedProcessedRecords||0}))}));
  }catch(error){fs.writeFileSync(path.join(dir,'first-failure.json'),JSON.stringify({error:String(error),partial:error.partial}));throw error;}
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={config,oracle,fixtureSource,run};
