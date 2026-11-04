#!/usr/bin/env node
'use strict';
// Reuse the accepted direct-path setup and independent analytic oracle, but
// replace every submitted draw with a buffer acquired/locked through COM.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const accepted=require('./test-legacy-transformed-float34');
const ROOT=path.resolve(__dirname,'..');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function fixtureSource(){
  let s=accepted.fixtureSource();
  const replace=(a,b)=>{assert.equal(s.split(a).length,2,'VB fixture seam '+a.slice(0,60));s=s.replace(a,b);};
  replace('let currentFVF=0;const geometry=async state=>{','let vb=0,vbData=0,vbSize=0;let currentFVF=0;const geometry=async state=>{');
  replace("      if(negative==='ignored')await tss(24,0);","      if(negative==='indices')await words(indices,[0x10000,2]);\n      if(negative==='ignored')await tss(24,0);");
  replace('    };\n    const setState=async state=>{',`      if(vb)await ok(com('Release old VB',vb,2));
      const stride=24+4*layout.reduce((a,b)=>a+b,0),desc=await guard(16);
      await words(desc.p,[16,0,currentFVF,6]);
      vb=await acquire(out=>com('CreateVertexBuffer7',d3d,5,desc.p,out,0));await desc.check();
      const ptr=await guard(4),size=await guard(4);
      await ok(com('Lock VB7',vb,3,0,ptr.p,size.p));await ptr.check();await size.check();
      vbData=await read(ptr.p);vbSize=await read(size.p);
      // Invalid FVF count 9 has a different allocation; draw must reject it.
      if(!state.overrideFVF)eq(vbSize,6*stride,'public dimensional VB byte size');
      new Uint8Array(memory.buffer,await wa(vbData),vbSize).fill(0xa5);
      new Uint8Array(memory.buffer,await wa(vbData+2*stride),3*stride).set(new Uint8Array(memory.buffer,await wa(vertices),3*stride));
      if(config.indexed){
        // Store v1,poison,v2,v0 and fetch 3,0,2. Omitting the index lookup
        // includes the poison record; this is not a cyclic triangle control.
        for(let i=0;i<3;i++)new Uint8Array(memory.buffer,await wa(vbData+(2+[3,0,2][i])*stride),stride)
          .set(new Uint8Array(memory.buffer,await wa(vertices+i*stride),stride));
        await words(indices,[3,2]);
      }
      await ok(com('Unlock VB7',vb,4));
      evidence.vertexBuffers=(evidence.vertexBuffers||0)+1;
    };
    const setState=async state=>{`);
  s=s.replaceAll("com('DrawIndexedPrimitive7',device,26,4,currentFVF,vertices,3,indices,3,0)","com('DrawIndexedPrimitiveVB7',device,32,4,vb,2,config.queued?0xffffffff:4,indices,3,0)");
  s=s.replaceAll("com('DrawPrimitive7',device,25,4,currentFVF,vertices,3,0)","com('DrawPrimitiveVB7',device,31,4,vb,2,3,0)");
  s=s.replaceAll("com('DrawIndexedPrimitive7 invalid',device,26,4,currentFVF,vertices,3,indices,3,0)","com('DrawIndexedPrimitiveVB7 invalid',device,32,4,vb,2,3,indices,3,0)");
  s=s.replaceAll("com('DrawPrimitive7 invalid',device,25,4,currentFVF,vertices,3,0)","com('DrawPrimitiveVB7 invalid',device,31,4,vb,2,3,0)");
  replace('        inspectQueue(nativeEncoder,e,memory,evidence);',`        // The queued command must own bytes even after the public VB is reused.
        const mutationPtr=await guard(4),mutationSize=await guard(4);
        await ok(com('Lock VB7 pending reuse',vb,3,0,mutationPtr.p,mutationSize.p));
        await mutationPtr.check();await mutationSize.check();
        eq(await read(mutationPtr.p),vbData,'VB reuse pointer');eq(await read(mutationSize.p),vbSize,'VB reuse size');
        new Uint8Array(memory.buffer,await wa(vbData),vbSize).fill(0);
        await ok(com('Unlock VB7 pending reuse',vb,4));
        await words(indices,[0,0]);
        inspectQueue(nativeEncoder,e,memory,evidence);`);
  replace("    await ok(com('unbind texture',device,35,0,0));","    await ok(com('Release final VB',vb,2));\n    await ok(com('unbind texture',device,35,0,0));");
  replace('      const base=config.states[0];evidence.rejected=[];',`      const base=config.states[0];evidence.rejected=[];
      await setState(base);await geometry(base);
      const before=Array.from(new Uint8Array(memory.buffer,await wa(vbData),vbSize));
      await ok(com('Clear7 guard',device,10,0,0,1,0xff0b1621,bits(1),0));
      await ok(com('BeginScene7 guard',device,5));
      for(const [label,start,count,buffer] of [['past end',6,3,vb],['zero count',2,0,vb],['null VB',2,3,0]]){
        await ok(com('DrawPrimitiveVB7 guard '+label,device,31,4,buffer,start,count,0));
        await ok(com('DrawIndexedPrimitiveVB7 guard '+label,device,32,4,buffer,start,count,indices,3,0));
      }
      await ok(com('DrawIndexedPrimitiveVB7 null indices',device,32,4,vb,2,3,0,3,0));
      await words(indices,[0x10000,3]);
      await ok(com('DrawIndexedPrimitiveVB7 invalid index',device,32,4,vb,2,3,indices,3,0));
      await ok(com('EndScene7 guard',device,6));
      const l=await lock(rt);
      for(let y=0;y<32;y++)for(let x=0;x<32;x++)eq((await read(l.pointer+y*l.pitch+x*4))&0xffffff,0x0b1621,'guard did not rasterize');
      await unlock(rt);
      eq(Array.from(new Uint8Array(memory.buffer,await wa(vbData),vbSize)),before,'guard leaves full VB unchanged');
      evidence.guardDraws=8;
      await words(indices,[0x10000,2]);`);
  assert(!s.includes("com('DrawPrimitive7'"));
  return s;
}
function inspectQueue(encoder,e,memory,evidence){
  let checked=0;
  for(const index of evidence.pendingNativeIndices||[])for(let offset=0;offset<encoder.buffers[index].used;){
    const d=encoder.buffers[index].view,size=d.getUint32(offset,true),type=d.getUint32(offset+12,true),n=d.getUint32(offset+16,true);
    assert(size>0);assert([5,6].includes(type));assert.equal(d.getUint32(offset+24,true),n*40);
    const state=evidence.currentState,m=state.matrix.slice(),count=state.flags&255;
    if(type===5)for(let r=0;r<4;r++)m[r*4+2]=state.matrix[r*4+count-1];
    for(let c=0;c<16;c++)assert(Math.abs(d.getFloat32(offset+32+3136+c*4,true)-m[c])<1e-5,'immutable matrix '+c);
    for(let i=0;i<n;i++)for(let c=0;c<4;c++){
      const a=state.sets[state.selector][i],expected=a[c]??(c===3?1:0);
      assert(Math.abs(d.getFloat32(offset+32+4096+i*40+24+c*4,true)-expected)<1e-6,'immutable selected coordinate '+i+'/'+c);
    }
    checked++;offset+=size;
  }
  assert(checked);evidence.ownedExtendedRecords=(evidence.ownedExtendedRecords||0)+checked;
}
async function run(config,negative=null){
  const routes=new Map([['/legacy-render.wasm',fs.readFileSync(path.join(ROOT,'build/wine-assembly.wasm'))],
    ['/test/binaries/calc.exe',fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'))],
    ['/lib/host-import-sigs.generated.json',fs.readFileSync(path.join(ROOT,'lib/host-import-sigs.generated.json'))]]);
  const context=vm.createContext({WebAssembly,performance,setTimeout,
    NativeStream:require('../lib/d3d-command-stream'),NativeWorker:require('node:worker_threads').Worker,
    nativeWorkerPath:path.join(ROOT,'lib/d3d-render-worker.js'),inspectQueue,
    fetch:async url=>{assert(routes.has(url));const b=routes.get(url);return {arrayBuffer:async()=>Uint8Array.from(b).buffer,json:async()=>JSON.parse(b)};},
    document:{createElement:()=>({style:{},getContext:()=>({putImageData(){}})}),body:{append(){}}},ImageData:class{}});
  try{return await vm.runInContext('('+fixtureSource()+')',context)('software',config,accepted.oracle.toString(),negative);}
  catch(error){error.partial=context.legacyTextureEvidence;throw error;}
}
async function main(){
  const dir=process.env.LEGACY_VB_EVIDENCE;assert(dir,'LEGACY_VB_EVIDENCE directory required');fs.mkdirSync(dir,{recursive:true});
  const config=accepted.config(),results=[];
  // All dimensions 3/4, mixed offsets/selectors, ordinary/projected COUNT2-4,
  // geometric w and mip gradients. No direct-path rerun is hidden here.
  if(process.argv.includes('--baseline'))config.states=config.states.slice(0,1);
  try{
    for(const queued of process.argv.includes('--baseline')?[false]:[false,true])for(const indexed of [false,true]){
      const result=await run({...config,queued,indexed});results.push(result);
      fs.writeFileSync(path.join(dir,`positive-${queued}-${indexed}.json`),JSON.stringify(result));
      console.log('PASS public VB '+JSON.stringify({queued,indexed,draws:result.drawCount,pixels:result.observations.length}));
    }
    if(!process.argv.includes('--baseline')){
      const defaults=require('./test-legacy-coordinate-dimensions').plan().states.filter(s=>s.dimension<=2||s.flags===0);
      for(const indexed of [false,true]){
        const result=await run({...config,states:defaults,indexed,queued:false});
        fs.writeFileSync(path.join(dir,'defaults-'+indexed+'.json'),JSON.stringify(result));
        console.log('PASS FLOAT1/2 and disabled VB '+JSON.stringify({indexed,draws:result.drawCount,pixels:result.observations.length}));
      }
    }
    for(const negative of ['selector','drop-z','drop-w','wrong-default','component']){
      const witness=accepted.controls().witnesses[negative];let failure;
      try{await run({...config,states:config.states.filter(s=>s.label===witness)},negative);}catch(e){failure=e;}
      assert.match(String(failure),/PIXEL ORACLE/);assert(failure.partial.calls.some(c=>c.label==='DrawPrimitiveVB7'&&c.result===0));
      fs.writeFileSync(path.join(dir,'negative-'+negative+'.json'),JSON.stringify({error:String(failure),partial:failure.partial}));
      console.log('PASS negative '+negative);
    }
    {
      let failure;
      try{await run({...config,indexed:true,states:config.states.slice(0,1)},'indices');}catch(e){failure=e;}
      assert.match(String(failure),/PIXEL ORACLE/);assert(failure.partial.calls.some(c=>c.label==='DrawIndexedPrimitiveVB7'&&c.result===0));
      fs.writeFileSync(path.join(dir,'negative-indices.json'),JSON.stringify({error:String(failure),partial:failure.partial}));
      console.log('PASS negative indices');
    }
    fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify({status:'PASS',wasm:hash(fs.readFileSync(path.join(ROOT,'build/wine-assembly.wasm'))),cells:results.map(r=>({draws:r.drawCount,pixels:r.observations.length,records:r.ownedExtendedRecords}))}));
  }catch(error){fs.writeFileSync(path.join(dir,'first-failure.json'),JSON.stringify({error:String(error),partial:error.partial}));throw error;}
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={fixtureSource,run,inspectQueue};
