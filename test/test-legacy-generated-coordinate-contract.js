#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const base=require('./test-legacy-count-selector-webgl');
const ROOT=path.resolve(__dirname,'..');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
// Rigid world rotation: (x,y,z)->(-y,x,z), then translation
// (.25,-.5,.125). View translates (-.125,.25,.0625).
// Authored object positions below give camera positions (-1,1,z), etc.
// Normals rotate without either translation; texture u=.5*nx+.125*nz+.375,
// v=.5*ny+.25*nz+.4375. No production matrix/vertex helper is used here.
function oracle(colors,s,p){
  const weights=[1-(p.x+p.y)/32,p.x/32,p.y/32];
  const uv=s.expectedUV;
  const u=uv.reduce((a,v,i)=>a+weights[i]*v[0],0),v=uv.reduce((a,v,i)=>a+weights[i]*v[1],0);
  const wrap=a=>((Math.floor(a*16)%16)+16)%16;
  return colors[0][wrap(v)][wrap(u)].slice();
}
function config(){
  const c=require('./test-legacy-projected-webgl').config();
  // Unique texels make the oracle discriminate a missing normal/matrix/z.
  c.colors[0]=Array.from({length:16},(_,y)=>Array.from({length:16},(_,x)=>[16+x*13,17+y*13,19+((x*3+y*5)%16)*13]));
  const states=[];
  for(const mode of [2,1])for(const color of [0,0x40,0x80,0xc0])for(const selector of [0,7])for(const flags of (mode===1&&color===0x40?[0,2,3,4]:[2])){
    const expectedUV=flags===0?[[-.8,.6],[-.2,-.6],[.8,0]]:mode===2?[[-.0625,1.0625],[.9375,1.0625],[-.0625,.0625]]:
      [[.05,.8875],[.375,.3375],[.85,.5875]];
    const s={label:`mode${mode}/color${color}/wrap${selector}/count${flags}`,mode,color,selector,flags,mip:1,expectedUV};
    const candidates=Array.from({length:16},(_,x)=>Array.from({length:16},(_,y)=>({x:x+5,y:y+5}))).flat().filter(p=>p.x+p.y<28);
    s.samples=candidates.filter(p=>[-.0625,0,.0625].every(dx=>[-.0625,0,.0625].every(dy=>JSON.stringify(oracle(c.colors,s,p))===JSON.stringify(oracle(c.colors,s,{x:p.x+dx,y:p.y+dy}))))).slice(0,3);
    assert.equal(s.samples.length,3);states.push(s);
  }
  for(const color of [0,0x40]){
    const s=states.find(s=>s.mode===1&&s.color===color&&s.selector===7&&s.flags===2);
    states.push({...s,label:s.label+'/lighting',lighting:true});
  }
  for(const mode of [1,2])states.push({label:`XYZRHW-bypass-mode${mode}`,mode,color:0xc0,selector:2,flags:2,mip:1,tl:true,
    expectedUV:Array.from({length:3},()=>[.53125,.59375]),samples:[{x:5,y:5},{x:7,y:6},{x:8,y:9}]});
  return {...c,states,update:null,tolerance:0};
}
function fixtureSource(){
  let s=base.fixtureSource();
  const replace=(a,b)=>{assert.equal(s.split(a).length,2,'generated seam '+a.slice(0,80));s=s.replace(a,b);};
  s=s.replace("if(mode==='software'&&args[0]===0x20000&&!nativeEncoder)inspect(e,memory,args[1],evidence);",'');
  const start=s.indexOf('    const geometry=async state=>{'),end=s.indexOf('    const describe=async()=>{',start);
  assert(start>0&&end>start);
  replace(s.slice(start,end),`    let currentFVF=0,vb=0,vbData=0,vbSize=0,sourceBefore=[],vbBefore=[],stride=0;
    const geometry=async state=>{
      currentFVF=(state.tl?0x304:0x312)|state.color;
      stride=(state.tl?40:48)+(state.color&0x40?4:0)+(state.color&0x80?4:0);
      for(let i=0;i<3;i++){
        const position=[[1.25,1.125,.3125],[1.25,-.875,.3125],[-.75,1.125,.3125]][i];
        const normal=negative==='normal-bytes'?[0,0,0]:[[.6,.8,.6],[-.6,.2,.8],[0,-.8,.6]][i];
        const supplied=[.1875,.21875,.34375,.40625,.53125,.59375];
        const head=state.tl?[[0,0,.5,1],[32,0,.5,1],[0,32,.5,1]][i]:[...position,...normal];
        await words(vertices+i*stride,[...head.map(bits),...(state.color&0x40?[0xffffffff]:[]),...(state.color&0x80?[0xff000000]:[]),...supplied.map(bits)]);
      }
      sourceBefore=Array.from(new Uint8Array(memory.buffer,await wa(vertices),3*stride));
      await words(indices,[0x10000,2]);
      if(config.vb){
        if(vb)await ok(com('Release old VB',vb,2));
        const desc=await guard(16);await words(desc.p,[16,0,currentFVF,5]);
        vb=await acquire(out=>com('CreateVertexBuffer7',d3d,5,desc.p,out,0));await desc.check();
        const ptr=await guard(4),size=await guard(4);
        await ok(com('Lock VB7',vb,3,0,ptr.p,size.p));await ptr.check();await size.check();
        vbData=await read(ptr.p);vbSize=await read(size.p);eq(vbSize,5*stride,'VB byte size');
        new Uint8Array(memory.buffer,await wa(vbData),vbSize).fill(0xa5);
        new Uint8Array(memory.buffer,await wa(vbData+2*stride),3*stride).set(new Uint8Array(memory.buffer,await wa(vertices),3*stride));
        vbBefore=Array.from(new Uint8Array(memory.buffer,await wa(vbData),vbSize));
        await ok(com('Unlock VB7',vb,4));
      }
    };
    const setState=async state=>{
      const world=[0,1,0,0,-1,0,0,0,0,0,1,0,.25,-.5,.125,1];
      const view=identity.slice();view[12]=-.125;view[13]=.25;view[14]=.0625;
      const texture=[.5,0,0,0,0,.5,0,0,.125,.25,1,0,.375,.4375,0,1];
      if(negative==='matrix')texture.splice(0,16,...identity);
      if(state.mutate){world.splice(0,16,...identity);view.splice(0,16,...identity);texture.splice(0,16,...identity);}
      for(const [type,m] of [[1,world],[2,view],[3,identity],[16,texture]]){
        await words(matrix,m.map(bits));await ok(com('SetTransform7 generated '+type,device,11,type,matrix));
      }
      await tss(11,(state.mode<<16)|state.selector);await tss(24,state.flags);
      await ok(com('SetRenderState7 no normal normalization',device,20,143,0));
      await ok(com('SetRenderState7 lighting',device,20,137,state.lighting?1:0));
      if(state.lighting){
        const material=await alloc(68);await words(material,Array(17).fill(0));await write(material,bits(1));
        await ok(com('SetMaterial7 force normal conversion',device,16,material));
      }
      if(negative==='supplied')await tss(11,0);
      for(const [id,v] of [[16,1],[17,1],[18,1],[13,1],[14,1]])await tss(id,v);
    };
`);
  s=s.replaceAll('(config.withNormals?0x812:0x8e2)','currentFVF');
  replace('      await draw();\n      if(config.queued){',`      await draw();
      eq(Array.from(new Uint8Array(memory.buffer,await wa(vertices),3*stride)),sourceBefore,'direct source immutable');
      if(config.vb)eq(Array.from(new Uint8Array(memory.buffer,await wa(vbData),vbSize)),vbBefore,'complete VB immutable');
      if(config.queued){`);
  replace('        await setState({...state,flags:0,selector:0,matrix:identity});',`        const beforeMutation=captureQueue(nativeEncoder,evidence);
        await setState({...state,mode:2,flags:0,selector:0,mutate:true});
        eq(captureQueue(nativeEncoder,evidence),beforeMutation,'state mutation preserves owned bytes');`);
  replace("await ok(config.indexed\n      ?com('DrawIndexedPrimitive7',device,26,4,currentFVF,vertices,3,indices,3,0)\n      :com('DrawPrimitive7',device,25,4,currentFVF,vertices,3,0));",`await ok(config.vb?(config.indexed
      ?com('DrawIndexedPrimitiveVB7',device,32,4,vb,2,3,indices,3,0)
      :com('DrawPrimitiveVB7',device,31,4,vb,2,3,0)):(config.indexed
      ?com('DrawIndexedPrimitive7',device,26,4,currentFVF,vertices,3,indices,3,0)
      :com('DrawPrimitive7',device,25,4,currentFVF,vertices,3,0)));`);
  replace('        inspectQueue(nativeEncoder,e,memory,evidence);',`        const records=captureQueue(nativeEncoder,evidence);
        if(config.vb){
          const ptr=await guard(4),size=await guard(4);await ok(com('Lock pending VB reuse',vb,3,0,ptr.p,size.p));
          await ptr.check();await size.check();eq(await read(ptr.p),vbData,'reuse pointer');
          new Uint8Array(memory.buffer,await wa(vbData),vbSize).fill(0);await ok(com('Unlock pending VB reuse',vb,4));
        }
        new Uint8Array(memory.buffer,await wa(vertices),264).fill(0);await words(indices,[0,0]);
        eq(captureQueue(nativeEncoder,evidence),records,'immutable queued bytes');
        evidence.ownedRecords=(evidence.ownedRecords||0)+records.length;`);
  replace("    await ok(com('unbind texture',device,35,0,0));","    if(vb)await ok(com('Release final VB',vb,2));\n    await ok(com('unbind texture',device,35,0,0));");
  return s;
}
function captureQueue(encoder,evidence){
  return (evidence.pendingNativeIndices||[]).map(index=>{
    const item=encoder.buffers[index],d=item.view;
    for(let offset=0;offset<item.used;){
      const size=d.getUint32(offset,true),n=d.getUint32(offset+16,true);
      assert(size>0);assert.equal(d.getUint32(offset+12,true),3,'owned generated TL type');
      assert.equal(d.getUint32(offset+24,true),32*n,'owned generated vertex bytes');assert.equal(n,3);
      for(let i=0;i<3;i++)for(let c=0;c<2;c++)assert(Math.abs(d.getFloat32(offset+32+4096+i*32+24+c*4,true)-evidence.currentState.expectedUV[i][c])<1e-6,'owned selected generated coordinate');
      const label=evidence.currentState.label;
      if(!(evidence.captured||=[]).some(r=>r.label===label))evidence.captured.push({label,type:3,bytes:size,
        sha256:hash(new Uint8Array(item.buffer,offset,size)),vertices:Array.from({length:3},(_,i)=>
          Array.from({length:8},(_,c)=>c===4||c===5?d.getUint32(offset+32+4096+i*32+4*c,true):d.getFloat32(offset+32+4096+i*32+4*c,true)))});
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
  const dir=process.env.LEGACY_GENERATED_EVIDENCE;assert(dir,'LEGACY_GENERATED_EVIDENCE required');fs.mkdirSync(dir,{recursive:true});
  const c=config();fs.writeFileSync(path.join(dir,'expected-plan.json'),JSON.stringify({oracle:oracle.toString(),states:c.states.map(s=>({state:s,pixels:s.samples.map(p=>oracle(c.colors,s,p))}))}));
  const cells=[];
  try{
    for(const vb of [false,true])for(const indexed of [false,true])for(const queued of [false,true]){
      const r=await run({...c,vb,indexed,queued});fs.writeFileSync(path.join(dir,`positive-${vb}-${indexed}-${queued}.json`),JSON.stringify(r));
      cells.push({vb,indexed,queued,draws:r.drawCount,pixels:r.observations.length,records:r.ownedRecords||0});
      console.log('PASS generated-coordinate COM',JSON.stringify(cells.at(-1)));
    }
    for(const negative of ['normal-bytes','matrix','supplied']){
      const state=c.states.find(s=>s.mode===1&&s.color===0x40&&s.flags===2&&s.selector===7);
      let failure;try{await run({...c,states:[state]},negative);}catch(e){failure=e;}
      assert.match(String(failure),/PIXEL ORACLE/);assert(failure.partial.calls.some(c=>c.label==='DrawPrimitive7'&&c.result===0));
      fs.writeFileSync(path.join(dir,`negative-${negative}.json`),JSON.stringify({error:String(failure),partial:failure.partial}));console.log('PASS rejected successful draw negative',negative);
    }
    fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify({status:'PASS',cells,wasm:hash(fs.readFileSync(path.join(ROOT,'build/wine-assembly.wasm')))}));
  }
  catch(e){fs.writeFileSync(path.join(dir,'first-failure.json'),JSON.stringify({error:String(e),wasm:hash(fs.readFileSync(path.join(ROOT,'build/wine-assembly.wasm'))),partial:e.partial}));throw e;}
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={config,oracle,fixtureSource,run};
