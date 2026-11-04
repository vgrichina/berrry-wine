#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const accepted=require('./test-legacy-transformed-float34');
const vbFixture=require('./test-legacy-dimensional-vertex-buffer');
const ROOT=path.resolve(__dirname,'..');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function fixtureSource(){
  let s=vbFixture.fixtureSource();
  const replace=(a,b)=>{assert.equal(s.split(a).length,2,a.slice(0,80));s=s.replace(a,b);};
  replace('let vb=0,vbData=0,vbSize=0;', 'let sourceVB=0,vb=0,vbData=0,vbSize=0;');
  const start=s.indexOf("      if(vb)await ok(com('Release old VB'"),end=s.indexOf('    const setState=async state=>{',start);
  assert(start>0&&end>start);
  s=s.slice(0,start)+String.raw`
      if(sourceVB)await ok(com('Release old source',sourceVB,2));
      if(vb)await ok(com('Release old destination',vb,2));
      const stride=24+4*layout.reduce((a,b)=>a+b,0);
      const dstLayout=state.dstDimensions||layout;
      const dstStride=20+4*dstLayout.reduce((a,b)=>a+b,0);
      const dstFVF=dstLayout.reduce((f,d,i)=>(f|([0,3,0,1,2][d]<<(16+2*i)))>>>0,0x44|(dstLayout.length<<8));
      const create=async(fvf,n)=>{
        const desc=await guard(16);await words(desc.p,[16,0,fvf,n]);
        const obj=await acquire(out=>com('CreateVertexBuffer7',d3d,5,desc.p,out,0));await desc.check();return obj;
      };
      const locked=async obj=>{
        const p=await guard(4),n=await guard(4);await ok(com('Lock VB7',obj,3,0,p.p,n.p));
        await p.check();await n.check();return {p:await read(p.p),n:await read(n.p)};
      };
      const srcCapacity=state.destinationClamp?7:6,dstCapacity=state.destinationClamp?7:8;
      sourceVB=await create(currentFVF,srcCapacity);vb=await create(dstFVF,dstCapacity);
      const src=await locked(sourceVB),dst=await locked(vb);
      eq(src.n,srcCapacity*stride,'source capacity');eq(dst.n,dstCapacity*dstStride,'destination capacity');
      vbData=dst.p;vbSize=dst.n;
      const bytes=(p,n)=>new Uint8Array(memory.buffer,awaitUnused,n);
      const sourceBytes=new Uint8Array(memory.buffer,await wa(src.p),src.n);
      sourceBytes.fill(0xa5);
      const order=config.indexed?[1,1,2,0]:[0,1,2,0];
      for(let i=0;i<4;i++)sourceBytes.set(new Uint8Array(memory.buffer,await wa(vertices+order[i]*stride),stride),(2+i)*stride);
      const sourceBefore=Array.from(sourceBytes);
      new Uint8Array(memory.buffer,await wa(dst.p),dst.n).fill(0xcd);
      await ok(com('Unlock source',sourceVB,4));await ok(com('Unlock destination',vb,4));
      const before=Array.from(new Uint8Array(memory.buffer,await wa(dst.p),dst.n));
      // Real public guards must leave the complete allocation unchanged.
      for(const [label,di,n,sv,si,result] of [
        ['zero',3,0,sourceVB,2,0],['source end',3,1,sourceVB,srcCapacity,0x80070057],
        ['destination end',dstCapacity,1,sourceVB,2,0x80070057],['null source',3,1,0,2,0x80004003]]){
        eq((await com('ProcessVertices7 guard '+label,vb,5,0x401,di,n,sv,si,device,0))>>>0,result,label);
        eq(Array.from(new Uint8Array(memory.buffer,await wa(dst.p),dst.n)),before,'guard full destination');
      }
      for(const invalidSource of [false,true]){
        const invalid=await create(((invalidSource?currentFVF:dstFVF)&~0xf00)|0x900,1);
        const target=invalidSource?vb:invalid,source=invalidSource?invalid:sourceVB;
        eq((await com('ProcessVertices7 invalid texture count',target,5,0x401,0,1,source,0,device,0))>>>0,0x80070057,'invalid texture count');
        eq(Array.from(new Uint8Array(memory.buffer,await wa(dst.p),dst.n)),before,'invalid count leaves destination');
        await ok(com('Release invalid VB',invalid,2));
      }
      await ok(com('ProcessVertices7',vb,5,0x401,3,0xffffffff,sourceVB,2,device,0));
      const readback=await locked(vb);eq(readback,dst,'public destination readback');
      const actual=Array.from(new Uint8Array(memory.buffer,await wa(dst.p),dst.n));
      const expected=new Uint8Array(dst.n);expected.fill(0xcd);const view=new DataView(expected.buffer);
      for(let i=0;i<4;i++){
        const vi=order[i],z=state.geomW?[.2,.8,.6][vi]:.5,w=state.geomW?1+.5*z:1;
        const xy=[[0,0],[32,0],[0,32]][vi],at=(3+i)*dstStride;
        for(const [c,v] of [xy[0],xy[1],z/w,1/w].entries())view.setFloat32(at+c*4,v,true);
        view.setUint32(at+16,0xffffffff,true);
        let off=at+20;
        for(let set=0;set<dstLayout.length;set++)for(let c=0;c<dstLayout[set];c++,off+=4)
          view.setFloat32(off,state.sets[set]?.[vi]?.[c]??(c===3?1:0),true);
      }
      evidence.processBytes=evidence.processBytes||[];
      evidence.processBytes.push({label:state.label,srcFVF:currentFVF,dstFVF,srcStride:stride,dstStride,actual,expected:Array.from(expected)});
      // Float position arithmetic may round; texture components and all guards
      // are exact authored float bytes, independent of production packing.
      for(let i=0;i<dst.n;i++){
        const inPosition=i>=3*dstStride&&i<7*dstStride&&(i%dstStride)<16;
        if(!inPosition)eq(actual[i],expected[i],'PV BYTE ORACLE '+state.label+' byte '+i);
      }
      const av=new DataView(Uint8Array.from(actual).buffer);
      for(let i=0;i<4;i++)for(let c=0;c<4;c++)check(Math.abs(av.getFloat32((3+i)*dstStride+c*4,true)-view.getFloat32((3+i)*dstStride+c*4,true))<1e-5,'PV position '+i+'/'+c);
      eq(Array.from(new Uint8Array(memory.buffer,await wa(src.p),src.n)),sourceBefore,'ProcessVertices leaves full source immutable');
      await ok(com('Unlock readback',vb,4));
      // Shift an overlapping range forward in the same source allocation.
      // Its position fields transform as usual; every set must read pre-call
      // bytes even after the preceding output overwrote the next input.
      await ok(com('ProcessVertices7 overlap',sourceVB,5,0x401,3,3,sourceVB,2,device,0));
      const overlap=await locked(sourceVB),overlapBytes=Array.from(new Uint8Array(memory.buffer,await wa(overlap.p),overlap.n));
      eq(overlapBytes.slice(0,3*stride),sourceBefore.slice(0,3*stride),'overlap prefix untouched');
      for(let i=0;i<3;i++)eq(overlapBytes.slice((3+i)*stride+24,(4+i)*stride),sourceBefore.slice((2+i)*stride+24,(3+i)*stride),'overlap full original texture sets');
      await ok(com('Unlock overlap',sourceVB,4));
      if(config.indexed)await words(indices,[3,2]);
      evidence.vertexBuffers=(evidence.vertexBuffers||0)+2;
    };
    `+s.slice(end);
  s=s.replace('      const bytes=(p,n)=>new Uint8Array(memory.buffer,awaitUnused,n);\n','');
  s=s.replaceAll('device,32,4,vb,2,config.queued?0xffffffff:4','device,32,4,vb,3,config.queued?0xffffffff:4');
  s=s.replaceAll('device,31,4,vb,2,3,0','device,31,4,vb,3,3,0');
  // Original VB fixture's postlude tests draw validation already qualified by
  // its accepted evidence. The producer's own public guards are above.
  const a=s.indexOf('    if(!negative){\n      const base=config.states[0];evidence.rejected=[];'),b=s.indexOf("    await ok(com('Release final VB'",a);
  assert(a>0&&b>a);s=s.slice(0,a)+s.slice(b);
  replace("    await ok(com('Release final VB',vb,2));","    await ok(com('Release final source',sourceVB,2));\n    await ok(com('Release final VB',vb,2));");
  return s;
}
function inspectQueue(encoder,e,memory,evidence){
  let checked=0;
  for(const index of evidence.pendingNativeIndices||[])for(let offset=0;offset<encoder.buffers[index].used;){
    const d=encoder.buffers[index].view,size=d.getUint32(offset,true),n=d.getUint32(offset+16,true);
    assert(size>0);assert.equal(d.getUint32(offset+12,true),3);assert.equal(d.getUint32(offset+24,true),32*n);
    const state=evidence.currentState;
    for(let i=0;i<n;i++)for(let c=0;c<2;c++)assert(Math.abs(d.getFloat32(offset+32+4096+i*32+24+4*c,true)-(state.sets[state.selector][i][c]??0))<1e-6,'owned processed UV');
    checked++;offset+=size;
  }
  assert(checked);evidence.ownedProcessedRecords=(evidence.ownedProcessedRecords||0)+checked;
}
async function run(config,negative=null){
  const routes=new Map([['/legacy-render.wasm',fs.readFileSync(path.join(ROOT,'build/wine-assembly.wasm'))],['/test/binaries/calc.exe',fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'))],['/lib/host-import-sigs.generated.json',fs.readFileSync(path.join(ROOT,'lib/host-import-sigs.generated.json'))]]);
  const context=vm.createContext({WebAssembly,performance,setTimeout,NativeStream:require('../lib/d3d-command-stream'),NativeWorker:require('node:worker_threads').Worker,nativeWorkerPath:path.join(ROOT,'lib/d3d-render-worker.js'),inspectQueue,
    fetch:async url=>{assert(routes.has(url));const b=routes.get(url);return {arrayBuffer:async()=>Uint8Array.from(b).buffer,json:async()=>JSON.parse(b)};},document:{createElement:()=>({style:{},getContext:()=>({putImageData(){}})}),body:{append(){}}},ImageData:class{}});
  try{return await vm.runInContext('('+fixtureSource()+')',context)('software',config,accepted.oracle.toString(),negative);}
  catch(error){error.partial=context.legacyTextureEvidence;throw error;}
}
async function main(){
  const dir=process.env.LEGACY_PV_EVIDENCE;assert(dir,'LEGACY_PV_EVIDENCE required');fs.mkdirSync(dir,{recursive:true});
  const config=accepted.config();
  config.states=require('./test-legacy-coordinate-dimensions').plan().states.filter(s=>s.flags===0);
  // Different dimensional declarations exercise truncation and the standard
  // absent-component defaults while selected UV remains independently known.
  const extra=config.states.filter(s=>s.selector===2&&!s.geomW).map(s=>({...s,
    label:s.label+'/destination-dimensions',destinationClamp:true,
    dstDimensions:s.dimensions.map((d,i)=>i===s.selector?d:([2,3,4,1][d-1]))}));
  config.states.push(...extra);
  const missing=config.states.find(s=>s.selector===2&&!s.geomW);
  config.states.push({...missing,label:missing.label+'/missing-source-sets',
    dimensions:missing.dimensions.slice(0,4),sets:missing.sets.slice(0,4),dstDimensions:missing.dimensions});
  if(process.argv.includes('--baseline'))config.states=config.states.slice(0,1);
  const results=[];
  try{
    for(const queued of process.argv.includes('--baseline')?[false]:[false,true])for(const indexed of [false,true]){
      const result=await run({...config,queued,indexed});results.push(result);
      fs.writeFileSync(path.join(dir,'positive-'+queued+'-'+indexed+'.json'),JSON.stringify(result));
      console.log('PASS public ProcessVertices '+JSON.stringify({queued,indexed,draws:result.drawCount,pixels:result.observations.length,bytes:result.processBytes.length}));
    }
    if(!process.argv.includes('--baseline'))for(const negative of ['drop-z','drop-w','selector','indices']){
      const state=config.states.find(s=>s.dimension===(negative==='drop-w'?4:3)&&!s.geomW);
      let failure;try{await run({...config,states:[state],indexed:negative==='indices'},negative);}catch(e){failure=e;}
      assert.match(String(failure),negative.startsWith('drop')?/PV BYTE ORACLE/:/PIXEL ORACLE/);
      assert(failure.partial.calls.some(c=>c.label==='ProcessVertices7'&&c.result===0));
      fs.writeFileSync(path.join(dir,'negative-'+negative+'.json'),JSON.stringify({error:String(failure),partial:failure.partial}));
      console.log('PASS semantic negative '+negative);
    }
    fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify({status:'PASS',wasm:hash(fs.readFileSync(path.join(ROOT,'build/wine-assembly.wasm'))),cells:results.map(r=>({draws:r.drawCount,pixels:r.observations.length,records:r.ownedProcessedRecords}))}));
  }catch(error){fs.writeFileSync(path.join(dir,'first-failure.json'),JSON.stringify({error:String(error),wasm:hash(fs.readFileSync(path.join(ROOT,'build/wine-assembly.wasm'))),partial:error.partial}));throw error;}
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={fixtureSource,run,inspectQueue};
