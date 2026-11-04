#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const previous=require('./test-legacy-generated-coordinate-contract');
const ROOT=path.resolve(__dirname,'..');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
// Independent authored rational values. Camera P=(-1,1,1/2), (1,1,1/2),
// (-1,-1,1/2), with length 3/2. Unit camera normals=(-4/5,3/5,0),
// (-3/5,0,4/5), (0,4/5,3/5). V points from the vertex toward the eye.
// R=2(N.V)N-V; texture u=Rx/2+Rz/8+3/8, v=Ry/2+Rz/4+7/16.
const reflection=[[62/75,-34/75,1/3],[38/75,2/3,41/75],[-2/3,-2/15,11/15]];
const transformed=[[83/100,353/1200],[209/300,363/400],[2/15,133/240]];
const oracle=previous.oracle;
function config(){
  const c=previous.config(),states=[];
  for(const color of [0,0x40,0x80,0xc0])for(const selector of [0,7]){
    states.push({label:`reflection/color${color}/wrap${selector}/COUNT2`,mode:3,color,selector,flags:2,mip:1,expectedUV:transformed});
  }
  for(const flags of [0,3,4])for(const color of [0,0xc0])states.push({label:`reflection/color${color}/flags${flags}`,mode:3,color,selector:7,flags,mip:1,
    expectedUV:flags?transformed:reflection.map(v=>v.slice(0,2))});
  for(const color of [0,0x40])states.push({label:`reflection/color${color}/lighting`,mode:3,color,selector:7,flags:2,mip:1,lighting:true,expectedUV:transformed});
  for(const color of [0,0xc0])states.push({label:`reflection/color${color}/normalize`,mode:3,color,selector:7,flags:2,mip:1,normalize:true,expectedUV:transformed});
  // Bypass neighbors use their own supplied coordinates despite a nonidentity
  // texture matrix. They are not the predecessor normal-loss positive suite.
  states.push({label:'reflection/XYZRHW-bypass',mode:3,color:0xc0,selector:2,flags:2,mip:1,tl:true,
    expectedUV:Array.from({length:3},()=>[.53125,.59375])});
  states.push({label:'supplied/XYZRHW-bypass',mode:0,color:0xc0,selector:2,flags:2,mip:1,tl:true,
    expectedUV:Array.from({length:3},()=>[.53125,.59375])});
  states.push({label:'supplied/XYZ-disabled-transform',mode:0,color:0x40,selector:2,flags:0,mip:1,
    expectedUV:Array.from({length:3},()=>[.53125,.59375])});
  for(const s of states){
    const candidates=Array.from({length:18},(_,x)=>Array.from({length:18},(_,y)=>({x:x+4,y:y+4}))).flat().filter(p=>p.x+p.y<28);
    s.samples=candidates.filter(p=>[-.0625,0,.0625].every(dx=>[-.0625,0,.0625].every(dy=>JSON.stringify(oracle(c.colors,s,p))===JSON.stringify(oracle(c.colors,s,{x:p.x+dx,y:p.y+dy}))))).slice(0,3);
    assert.equal(s.samples.length,3);
  }
  return {...c,states};
}
function fixtureSource(){
  let s=previous.fixtureSource();
  const replace=(a,b)=>{assert.equal(s.split(a).length,2,'reflection seam '+a);s=s.replace(a,b);};
  replace('[[1.25,1.125,.3125],[1.25,-.875,.3125],[-.75,1.125,.3125]]','[[-.25,-.625,.3125],[-.25,1.375,.3125],[1.75,-.625,.3125]]');
  replace('[[.6,.8,.6],[-.6,.2,.8],[0,-.8,.6]]','[[-.6,-.8,0],[0,-.6,.8],[-.8,0,.6]]');
  replace('const view=identity.slice();view[12]', 'const view=identity.slice();view[0]=view[5]=-1;view[12]');
  replace('      const texture=[.5', '      const projection=identity.slice();\n      const texture=[.5');
  replace('[3,identity],[16,texture]', '[3,projection],[16,texture]');
  replace('const normal=negative', 'let normal=negative');
  replace('        const supplied=[.1875', '        if(state.normalize)normal=normal.map(x=>2*x);\n        const supplied=[.1875');
  replace("      if(negative==='matrix')texture.splice(0,16,...identity);",`      if(negative==='matrix')texture.splice(0,16,...identity);
      if(negative==='camera'){view[12]+=.75;projection[12]=-.75;}
      if(negative==='texture-z')texture[8]=texture[9]=0;`);
  replace("      await tss(11,(state.mode<<16)|state.selector);await tss(24,state.flags);",`      await tss(11,((negative==='normal-mode'?1:state.mode)<<16)|state.selector);await tss(24,state.flags);
      await ok(com('SetRenderState7 local viewer',device,20,142,1));`);
  replace("device,20,143,0)","device,20,143,state.normalize?1:0)");
  return s;
}
function captureQueue(encoder,evidence){
  return (evidence.pendingNativeIndices||[]).map(index=>{
    const item=encoder.buffers[index],d=item.view;
    for(let offset=0;offset<item.used;){
      const size=d.getUint32(offset,true),n=d.getUint32(offset+16,true);
      assert(size>0&&offset+size<=item.used);assert.equal(d.getUint32(offset+12,true),3);assert.equal(n,3);
      assert.equal(d.getUint32(offset+24,true),32*n);
      const vertices=Array.from({length:3},(_,i)=>Array.from({length:8},(_,c)=>c===4||c===5?d.getUint32(offset+32+4096+i*32+4*c,true):d.getFloat32(offset+32+4096+i*32+4*c,true)));
      for(let i=0;i<3;i++)for(let c=0;c<2;c++)assert(Math.abs(vertices[i][6+c]-evidence.currentState.expectedUV[i][c])<1e-6,'owned reflection UV');
      const label=evidence.currentState.label;
      if(!(evidence.captured||=[]).some(r=>r.label===label))evidence.captured.push({label,type:3,bytes:size,sha256:hash(new Uint8Array(item.buffer,offset,size)),vertices});
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
  const dir=process.env.LEGACY_REFLECTION_EVIDENCE;assert(dir,'LEGACY_REFLECTION_EVIDENCE required');fs.mkdirSync(dir,{recursive:true});
  const c=config(),cells=[];
  fs.writeFileSync(path.join(dir,'expected-plan.json'),JSON.stringify({oracle:oracle.toString(),reflection,states:c.states.map(s=>({state:s,pixels:s.samples.map(p=>oracle(c.colors,s,p))}))}));
  try{
    for(const vb of [false,true])for(const indexed of [false,true])for(const queued of [false,true]){
      const r=await run({...c,vb,indexed,queued});fs.writeFileSync(path.join(dir,`positive-${vb}-${indexed}-${queued}.json`),JSON.stringify(r));
      cells.push({vb,indexed,queued,draws:r.drawCount,pixels:r.observations.length,records:r.ownedRecords||0});console.log('PASS reflection COM',JSON.stringify(cells.at(-1)));
    }
    for(const negative of ['normal-bytes','matrix','supplied','normal-mode','camera','texture-z']){
      let failure;try{await run({...c,states:[c.states[1]]},negative);}catch(e){failure=e;}
      assert.match(String(failure),/PIXEL ORACLE/);assert(failure.partial.calls.some(c=>c.label==='DrawPrimitive7'&&c.result===0));
      fs.writeFileSync(path.join(dir,`negative-${negative}.json`),JSON.stringify({error:String(failure),partial:failure.partial}));console.log('PASS rejected successful draw negative',negative);
    }
    fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify({status:'PASS',cells,wasm:hash(fs.readFileSync(path.join(ROOT,'build/wine-assembly.wasm')))}));
  }catch(e){fs.writeFileSync(path.join(dir,'first-failure.json'),JSON.stringify({error:String(e),wasm:hash(fs.readFileSync(path.join(ROOT,'build/wine-assembly.wasm'))),partial:e.partial}));throw e;}
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={config,oracle,fixtureSource,run};
