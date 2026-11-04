#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const previous=require('./test-legacy-generated-reflection-contract');
const ROOT=path.resolve(__dirname,'..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
// Independent camera normals and mirror directions. Camera positions are
// (-1,1,1/2), (5/4,5/4,5/8), (-3/2,-3/2,3/4); their lengths
// are 3/2,15/8,9/4. Projection w=2*z is independent of texture q.
const normal=[[-4/5,3/5,0],[-3/5,0,4/5],[0,4/5,3/5]];
const reflection=[[62/75,-34/75,1/3],[38/75,2/3,41/75],[-2/3,-2/15,11/15]];
const geometricW=[1,5/4,3/2];
function oracle(colors,s,p,early=false){
  const normal=[[-4/5,3/5,0],[-3/5,0,4/5],[0,4/5,3/5]],
    reflection=[[62/75,-34/75,1/3],[38/75,2/3,41/75],[-2/3,-2/15,11/15]],geometricW=[1,5/4,3/2];
  const weights=[1-(p.x+p.y)/32,p.x/32,p.y/32];
  let uv;
  if(s.expectedUV)uv=s.expectedUV[0];
  else {
    const values=(s.mode===1?normal:reflection).map(([x,y,z],i)=>{
      const u=x/4+z/8+1/2,v=y/4+z/4+3/8;
      const q=s.flags===0x103?x/2-y/4+3*z/4+3/4:3*x/8-y/8+z/2+3/4;
      return early?[u/q/geometricW[i],v/q/geometricW[i],1/geometricW[i]]:[u/geometricW[i],v/geometricW[i],q/geometricW[i]];
    });
    const sum=c=>values.reduce((a,v,i)=>a+weights[i]*v[c],0);
    uv=[sum(0)/sum(2),sum(1)/sum(2)];
  }
  const wrap=v=>((Math.floor(v*16)%16)+16)%16;
  return colors[0][wrap(uv[1])][wrap(uv[0])].slice();
}
function config(){
  const c=previous.config(),states=[];
  for(const mode of [1,3]){
    for(const flags of [0x103,0x104])for(const color of [0,0x40,0x80,0xc0])
      states.push({label:`mode${mode}-PROJECTED${flags&255}/color${color}`,mode,selector:7,flags,color,mip:1});
    states.push({...states.find(s=>s.mode===mode&&s.color===0x40),label:`mode${mode}-PROJECTED3/lighting`,lighting:true});
  }
  states.push({...states.find(s=>s.mode===3&&s.color===0xc0),label:'reflection-PROJECTED3/normalize',normalize:true});
  for(const [mode,tl,flags] of [[1,true,0x103],[3,true,0x104],[0,true,0x103],[0,false,0]])
    states.push({label:`bypass/mode${mode}/tl${tl}`,mode,tl,flags,color:0xc0,selector:2,mip:1,
      expectedUV:Array.from({length:3},()=>[.53125,.59375])});
  for(const s of states){
    const candidates=Array.from({length:20},(_,x)=>Array.from({length:20},(_,y)=>({x:x+4,y:y+4}))).flat().filter(p=>p.x+p.y<28);
    s.samples=candidates.filter(p=>(s.expectedUV||JSON.stringify(oracle(c.colors,s,p))!==JSON.stringify(oracle(c.colors,s,p,true)))&&[-.0625,0,.0625].every(dx=>[-.0625,0,.0625].every(dy=>JSON.stringify(oracle(c.colors,s,p))===JSON.stringify(oracle(c.colors,s,{x:p.x+dx,y:p.y+dy}))))).slice(0,3);
    assert.equal(s.samples.length,3);
  }
  return {...c,states};
}
function fixtureSource(){
  let s=previous.fixtureSource();
  const replace=(a,b)=>{assert.equal(s.split(a).length,2,'projected seam '+a);s=s.replace(a,b);};
  replace('[[-.25,-.625,.3125],[-.25,1.375,.3125],[1.75,-.625,.3125]]','[[-.25,-.625,.3125],[-.5,1.625,.4375],[2.25,-1.125,.5625]]');
  replace('const projection=identity.slice();','const projection=identity.slice();projection[11]=2;projection[15]=0;');
  replace('const texture=[.5,0,0,0,0,.5,0,0,.125,.25,1,0,.375,.4375,0,1];',
    'const texture=[.25,0,.5,.375,0,.25,-.25,-.125,.125,.25,.75,.5,.5,.375,.75,.75];');
  replace('const supplied=[.1875,.21875,.34375,.40625,.53125,.59375];',`const supplied=[.1875,.21875,.34375,.40625,.53125,.59375];
        if(negative==='early'){
          const normal=[[-4/5,3/5,0],[-3/5,0,4/5],[0,4/5,3/5]],reflection=[[62/75,-34/75,1/3],[38/75,2/3,41/75],[-2/3,-2/15,11/15]];
          const [x,y,z]=(state.mode===1?normal:reflection)[i];
          const q=x/2-y/4+3*z/4+3/4;
          supplied[0]=(x/4+z/8+1/2)/q;supplied[1]=(y/4+z/4+3/8)/q;
        }`);
  replace("      if(negative==='supplied')await tss(11,0);",`      if(negative==='supplied')await tss(11,0);
      if(negative==='early'){await tss(11,0);await tss(24,0);}`);
  replace("      if(negative==='early')await tss(24,0x103);",'');
  replace("      if(negative==='texture-z')texture[8]=texture[9]=0;",`      if(negative==='texture-z')texture[8]=texture[9]=0;
      if(negative==='constant-q'){texture[2]=texture[6]=texture[10]=texture[3]=texture[7]=texture[11]=0;texture[14]=texture[15]=1;}
      `);
  return s;
}
function captureQueue(encoder,evidence){
  return (evidence.pendingNativeIndices||[]).map(index=>{
    const item=encoder.buffers[index],d=item.view,s=evidence.currentState;
    for(let offset=0;offset<item.used;){
      const size=d.getUint32(offset,true),n=d.getUint32(offset+16,true),type=d.getUint32(offset+12,true),stride=type===5?40:32;
      assert(size>0&&offset+size<=item.used);assert.equal(n,3);
      if(!process.env.LEGACY_NORMAL_REFLECTION_PROJECTED_BASELINE)assert.equal(type,s.expectedUV?3:5,'owned projected type');assert.equal(d.getUint32(offset+24,true),stride*n);
      const vertices=Array.from({length:3},(_,i)=>Array.from({length:stride/4},(_,c)=>c===4||c===5?d.getUint32(offset+32+4096+i*stride+4*c,true):d.getFloat32(offset+32+4096+i*stride+4*c,true)));
      if(!process.env.LEGACY_NORMAL_REFLECTION_PROJECTED_BASELINE)for(let i=0;i<3;i++)for(let c=0;c<(s.expectedUV?2:4);c++)
        assert(Math.abs(vertices[i][6+c]-(s.expectedUV?s.expectedUV[i][c]:[...(s.mode===1?normal:reflection)[i],1][c]))<1e-6,'owned generated input');
      for(let i=0;i<3;i++)assert(Math.abs(vertices[i][3]-(s.tl?1:1/geometricW[i]))<1e-6,'independent geometric rhw');
      if(!(evidence.captured||=[]).some(r=>r.label===s.label))evidence.captured.push({label:s.label,type,bytes:size,sha256:hash(new Uint8Array(item.buffer,offset,size)),vertices});
      offset+=size;
    }
    return Array.from(new Uint8Array(item.buffer,0,item.used));
  });
}
async function run(c,negative=null){
  const routes=new Map([['/legacy-render.wasm',fs.readFileSync(path.join(ROOT,'build/wine-assembly.wasm'))],['/test/binaries/calc.exe',fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'))],['/lib/host-import-sigs.generated.json',fs.readFileSync(path.join(ROOT,'lib/host-import-sigs.generated.json'))]]);
  const context=vm.createContext({WebAssembly,performance,setTimeout,captureQueue,NativeStream:require('../lib/d3d-command-stream'),NativeWorker:require('node:worker_threads').Worker,nativeWorkerPath:path.join(ROOT,'lib/d3d-render-worker.js'),fetch:async url=>{assert(routes.has(url));const b=routes.get(url);return {arrayBuffer:async()=>Uint8Array.from(b).buffer,json:async()=>JSON.parse(b)};},document:{createElement:()=>({style:{},getContext:()=>({putImageData(){}})}),body:{append(){}}},ImageData:class{}});
  try{return await vm.runInContext('('+fixtureSource()+')',context)('software',c,oracle.toString(),negative);}
  catch(e){e.partial=context.legacyTextureEvidence;throw e;}
}
async function main(){
  const dir=process.env.LEGACY_NORMAL_REFLECTION_PROJECTED_EVIDENCE;assert(dir,'LEGACY_NORMAL_REFLECTION_PROJECTED_EVIDENCE required');fs.mkdirSync(dir,{recursive:true});
  const c=config(),cells=[];
  fs.writeFileSync(path.join(dir,'expected-plan.json'),JSON.stringify({oracle:oracle.toString(),normal,reflection,geometricW,states:c.states.map(s=>({state:s,pixels:s.samples.map(p=>oracle(c.colors,s,p))}))}));
  for(const mode of (process.env.LEGACY_NORMAL_REFLECTION_PROJECTED_BASELINE?[1,3]:[null]))
  for(const vb of [false,true])for(const indexed of [false,true])for(const queued of [false,true]){
    try{
      const r=await run({...c,vb,indexed,queued,states:mode?c.states.filter(s=>s.mode===mode&&!s.tl).slice(0,1):c.states});
      fs.writeFileSync(path.join(dir,`positive-${mode}-${vb}-${indexed}-${queued}.json`),JSON.stringify(r));
      cells.push({vb,indexed,queued,draws:r.drawCount,pixels:r.observations.length,records:r.ownedRecords||0});console.log('PASS normal/reflection projected COM',JSON.stringify(cells.at(-1)));
    }catch(e){fs.writeFileSync(path.join(dir,`failure-${mode}-${vb}-${indexed}-${queued}.json`),JSON.stringify({error:String(e),wasm:hash(fs.readFileSync(path.join(ROOT,'build/wine-assembly.wasm'))),partial:e.partial}));if(!process.env.LEGACY_NORMAL_REFLECTION_PROJECTED_BASELINE)throw e;}
  }
  if(process.env.LEGACY_NORMAL_REFLECTION_PROJECTED_BASELINE)return;
  for(const mode of [1,3])for(const negative of ['normal-bytes','matrix','supplied','constant-q','texture-z','early',...(mode===3?['normal-mode']:[])]){
    let failure;try{await run({...c,states:[c.states.find(s=>s.mode===mode&&s.flags===0x103)]},negative);}catch(e){failure=e;}
    assert.match(String(failure),/PIXEL ORACLE/);assert(failure.partial.calls.some(c=>c.label==='DrawPrimitive7'&&c.result===0));
    if(negative==='early')assert.deepEqual(Array.from(failure.partial.observations[0].actual),mode===1?[55,30,201]:[107,82,201],'early division reproduces distinct baseline');
    fs.writeFileSync(path.join(dir,`negative-${mode}-${negative}.json`),JSON.stringify({error:String(failure),partial:failure.partial}));console.log('PASS rejected successful draw negative',mode,negative);
  }
  fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify({status:'PASS',cells,wasm:hash(fs.readFileSync(path.join(ROOT,'build/wine-assembly.wasm')))}));
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={config,oracle,fixtureSource,run};
