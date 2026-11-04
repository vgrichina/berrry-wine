#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const accepted=require('./test-legacy-transformed-float34');
const ROOT=path.resolve(__dirname,'..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
// Author expectations from independent vectors, never from strided/FVF bytes.
function oracle(colors,s,p,details=false){
  const weights=[1-(p.x+p.y)/32,p.x/32,p.y/32];
  const active=!s.tl&&s.flags!==0,projected=active&&!!(s.flags&256),count=s.flags&255;
  const h=s.sets[s.selector].map((a,i)=>{
    const v=[a[0],a[1]??0,a[2]??0,a[3]??1];
    const b=active?[0,1,2,3].map(c=>v.reduce((n,x,r)=>n+x*s.matrix[r*4+c],0)):v;
    const w=s.geomW?1+.5*[.2,.8,.6][i]:1;
    return [b[0]/w,b[1]/w,(projected?b[count-1]:1)/w];
  });
  const q=[0,1,2].map(c=>h.reduce((n,a,i)=>n+weights[i]*a[c],0));
  const uv=[q[0]/q[2],q[1]/q[2]];
  if(details)return uv;
  const wrap=x=>((Math.floor(x*16)%16)+16)%16;
  return colors[0][wrap(uv[1])][wrap(uv[0])].slice();
}
function config(){
  const base=accepted.config(),states=[];
  for(const dimensions of [[1,2,3,4],[4,3,2,1],[2,1,4,3,1,2,3,4]])for(const selector of [0,1,2,3,dimensions.length-1].filter((x,i,a)=>a.indexOf(x)===i)){
    const dimension=dimensions[selector];
    const sets=dimensions.map((d,j)=>[[.137+j*.031,.193+j*.027,.337+j*.019,.719+j*.023],
      [.887+j*.031,.193+j*.027,.537+j*.019,.919+j*.023],[.137+j*.031,.943+j*.027,.737+j*.019,1.119+j*.023]].map(a=>a.slice(0,d)));
    for(const tl of [false,true])for(const defaultStride of [false,true])for(const flags of tl?[0,3]:[0,2,3,4,0x102,0x103,0x104]){
      const geomW=!defaultStride,matrix=[1,.75,.5,.375,.25,.25,.375,.625,.1875,.3125,.4375,.5625,.093,.3125,.625,.4375];
      const s={dimensions,dimension,selector,sets,tl,defaultStride,flags,geomW,matrix,mip:1,
        label:`strided${dimensions.join('')}/set${selector}/FLOAT${dimension}/TL${tl}/default${defaultStride}/flags${flags}`};
      const candidates=Array.from({length:18},(_,x)=>Array.from({length:18},(_,y)=>({x:x+4,y:y+4}))).flat().filter(p=>p.x+p.y<29);
      s.samples=candidates.filter(p=>[-.0625,0,.0625].every(dx=>[-.0625,0,.0625].every(dy=>JSON.stringify(oracle(base.colors,s,p))===JSON.stringify(oracle(base.colors,s,{x:p.x+dx,y:p.y+dy}))))).slice(0,3);
      assert.equal(s.samples.length,3);states.push(s);
    }
  }
  for(const flags of [0,3,0x104]){
    const source=states.find(s=>!s.tl&&s.flags===flags&&s.dimension===4&&!s.defaultStride);
    states.push({...source,label:source.label+'/alias',alias:true,sets:source.sets.map((a,j)=>j===0?source.sets[source.selector]:a)});
    const matrix=source.matrix.slice();matrix[12]=.101;matrix[13]=.319;
    states.push({...source,matrix,label:source.label+'/null-texture',nullTexture:true,sets:source.sets.map((a,j)=>j===source.selector?a.map(()=>[0,0,0,1]):a)});
  }
  return {...base,states,update:null};
}
function fixtureSource(){
  let s=accepted.fixtureSource();
  const replace=(a,b)=>{assert.equal(s.split(a).length,2,'strided seam '+a.slice(0,60));s=s.replace(a,b);};
  const a=s.indexOf('    let currentFVF=0;const geometry=async state=>{'),b=s.indexOf('    const setState=async state=>{',a);
  assert(a>0&&b>a);
  s=s.slice(0,a)+String.raw`
    const strided=await guard(96);let currentFVF=0,inputArrays=[],currentCount=0;
    const geometry=async state=>{
      const dims=state.dimensions;
      currentFVF=dims.reduce((f,d,i)=>(f|([0,3,0,1,2][d]<<(16+2*i)))>>>0,(state.tl?0xc4:0xc2)|(dims.length<<8));
      if(state.overrideFVF)currentFVF=state.overrideFVF;
      currentCount=config.indexed?4:3;
      inputArrays=[];await words(strided.p,Array(24).fill(0));
      const order=config.indexed?[1,1,2,0]:[0,1,2];
      const array=async(field,width,value)=>{
        const step=width+(state.defaultStride?0:12),g=await guard(step*(currentCount+2));
        const view=new DataView(memory.buffer,await wa(g.p),step*(currentCount+2));
        for(let i=0;i<currentCount;i++)value(view,(i+1)*step,order[i]);
        // Indexed poison must be omitted by actual nonzero 3,0,2 lookup.
        if(config.indexed)for(let c=0;c<width;c+=4)view.setFloat32(2*step+c,0,true);
        await words(strided.p+field*8,[g.p+step,state.defaultStride?0:step]);
        inputArrays.push({g,n:step*(currentCount+2),before:Array.from(new Uint8Array(memory.buffer,await wa(g.p),step*(currentCount+2)))});
      };
      await array(0,state.tl?16:12,(v,o,i)=>{
        const z=state.geomW?[.2,.8,.6][i]:.5,w=state.geomW?1+.5*z:1;
        const xy=state.tl?[[0,0],[32,0],[0,32]][i]:[[-w,w],[w,w],[-w,-w]][i];
        [xy[0],xy[1],state.tl?z/w:z,...(state.tl?[1/w]:[])].forEach((x,c)=>v.setFloat32(o+4*c,x,true));
      });
      await array(2,4,(v,o)=>v.setUint32(o,0xffffffff,true));
      await array(3,4,(v,o)=>v.setUint32(o,0xff000000,true));
      for(let j=0;j<dims.length;j++)await array(4+j,4*dims[j],(v,o,i)=>{
        const values=state.sets[j][i].slice();
        if(j===state.selector){if(negative==='drop-z')values[2]=0;if(negative==='drop-w')values[3]=1;}
        for(let c=0;c<dims[j];c++)v.setFloat32(o+c*4,values[c],true);
      });
      if(negative==='stride')await write(strided.p+36+state.selector*8,8);
      if(state.alias)await words(strided.p+32,[await read(strided.p+32+8*state.selector),await read(strided.p+36+8*state.selector)]);
      if(state.nullTexture)await write(strided.p+32+8*state.selector,0);
      await words(indices,config.indexed?[3,2]:[0x10000,2]);
      if(negative==='indices')await words(indices,[0x10000,2]);
    };
    const verifyInputs=async()=>{
      await strided.check();
      for(const x of inputArrays){await x.g.check();eq(Array.from(new Uint8Array(memory.buffer,await wa(x.g.p),x.n)),x.before,'full strided input immutable');}
      evidence.inputChecks=(evidence.inputChecks||0)+inputArrays.length;
    };
`+s.slice(b);
  s=s.replaceAll("com('DrawIndexedPrimitive7',device,26,4,currentFVF,vertices,3,indices,3,0)","com('DrawIndexedPrimitiveStrided7',device,30,4,currentFVF,strided.p,currentCount,indices,3,0)");
  s=s.replaceAll("com('DrawPrimitive7',device,25,4,currentFVF,vertices,3,0)","com('DrawPrimitiveStrided7',device,29,4,currentFVF,strided.p,currentCount,0)");
  replace("      await ok(com('EndScene7',device,6));};","      await ok(com('EndScene7',device,6));await verifyInputs();};");
  replace('        inspectQueue(nativeEncoder,e,memory,evidence);',String.raw`
        for(const x of inputArrays)new Uint8Array(memory.buffer,await wa(x.g.p),x.n).fill(0);
        await words(strided.p,Array(24).fill(0));await words(indices,[0,0]);
        inspectQueue(nativeEncoder,e,memory,evidence);`);
  // Own only strided validation. Packed/VB/PV evidence is reused by hash.
  const c=s.indexOf('    if(!negative){\n      const base=config.states[0];evidence.rejected=[];'),d=s.indexOf("    await ok(com('unbind texture'",c);
  assert(c>0&&d>c);
  s=s.slice(0,c)+String.raw`
    if(!negative){
      const base=config.states[0];evidence.rejected=[];
      for(const state of [{...base,selector:8},{...base,overrideFVF:0x9c2}]){
        await geometry(state);await setState(state);await ok(com('BeginScene invalid',device,5));
        const result=await(config.indexed?com('Strided invalid',device,30,4,currentFVF,strided.p,currentCount,indices,3,0):com('Strided invalid',device,29,4,currentFVF,strided.p,currentCount,0));
        eq(result>>>0,0x80070057,'invalid supplied selector/count');await verifyInputs();
        await ok(com('EndScene invalid',device,6));evidence.rejected.push({result});
      }
      await geometry(base);await setState(base);
      await ok(com('Clear guard',device,10,0,0,1,0xff0b1621,bits(1),0));
      await ok(com('BeginScene guard',device,5));
      for(const [label,p,n,ix,ni] of [['zero',strided.p,0,indices,3],['null',0,3,indices,3],['oversize',strided.p,0xffffffff,indices,3],['multiply-wrap',strided.p,0x80000001,indices,3]]){
        await ok(com('Strided guard '+label,device,29,4,currentFVF,p,n,0));
        await ok(com('Indexed strided guard '+label,device,30,4,currentFVF,p,n,ix,ni,0));
      }
      await ok(com('Indexed strided guard null indices',device,30,4,currentFVF,strided.p,currentCount,0,3,0));
      await words(indices,[0xffff,0xffff]);
      await ok(com('Indexed strided guard invalid indices',device,30,4,currentFVF,strided.p,currentCount,indices,3,0));
      await ok(com('EndScene guard',device,6));await verifyInputs();
      const g=await lock(rt);
      for(let y=0;y<32;y++)for(let x=0;x<32;x++)eq((await read(g.pointer+y*g.pitch+x*4))&0xffffff,0x0b1621,'guard leaves clear pixels');
      await unlock(rt);evidence.guardDraws=10;
    }
`+s.slice(d);
  return s;
}
function inspectQueue(encoder,e,memory,evidence){
  const state=evidence.currentState,rows=[];
  for(const index of evidence.pendingNativeIndices||[])for(let off=0;off<encoder.buffers[index].used;){
    const d=encoder.buffers[index].view,size=d.getUint32(off,true),type=d.getUint32(off+12,true),n=d.getUint32(off+16,true),stride=[5,6].includes(type)?40:32;
    assert(size>0);assert.equal(type,state.tl?3:state.flags?(state.flags&256?5:6):3);
    const coords=[];
    for(let i=0;i<n;i++){
      const got=Array.from({length:stride===40?4:2},(_,c)=>d.getFloat32(off+32+4096+i*stride+24+c*4,true));
      for(let c=0;c<got.length;c++)assert(Math.abs(got[c]-(state.sets[state.selector][i][c]??(c===3?1:0)))<1e-6,'owned strided component');
      coords.push(got);
    }
    const matrix=Array.from({length:16},(_,c)=>d.getFloat32(off+32+3136+c*4,true));
    if(!state.tl&&state.flags)for(let c=0;c<16;c++){
      const source=type===5&&c%4===2?4*Math.floor(c/4)+(state.flags&255)-1:c;
      assert(Math.abs(matrix[c]-state.matrix[source])<1e-5,'owned strided matrix');
    }
    rows.push({type,n,coords,matrix,bytes:Array.from(new Uint8Array(d.buffer,off+32+4096,n*stride))});off+=size;
  }
  assert(rows.length);(evidence.ownedStridedRecords||=[]).push({label:state.label,rows});
}
async function run(cfg,negative=null){
  const routes=new Map([['/legacy-render.wasm',fs.readFileSync(path.join(ROOT,'build/wine-assembly.wasm'))],['/test/binaries/calc.exe',fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'))],['/lib/host-import-sigs.generated.json',fs.readFileSync(path.join(ROOT,'lib/host-import-sigs.generated.json'))]]);
  const context=vm.createContext({WebAssembly,performance,setTimeout,NativeStream:require('../lib/d3d-command-stream'),NativeWorker:require('node:worker_threads').Worker,nativeWorkerPath:path.join(ROOT,'lib/d3d-render-worker.js'),inspectQueue,
    fetch:async url=>{assert(routes.has(url));const b=routes.get(url);return {arrayBuffer:async()=>Uint8Array.from(b).buffer,json:async()=>JSON.parse(b)};},document:{createElement:()=>({style:{},getContext:()=>({putImageData(){}})}),body:{append(){}}},ImageData:class{}});
  try{return await vm.runInContext('('+fixtureSource()+')',context)('software',cfg,oracle.toString(),negative);}catch(e){e.partial=context.legacyTextureEvidence;throw e;}
}
async function main(){
  const dir=process.env.LEGACY_STRIDED_EVIDENCE;assert(dir,'LEGACY_STRIDED_EVIDENCE required');fs.mkdirSync(dir,{recursive:true});
  const cfg=config(),baseline=process.argv.includes('--baseline');
  fs.writeFileSync(path.join(dir,'expected-plan.json'),JSON.stringify({oracle:oracle.toString(),states:cfg.states.map(state=>({state,uv:state.samples.map(p=>oracle(cfg.colors,state,p,true)),pixels:state.samples.map(p=>oracle(cfg.colors,state,p))}))}));
  try{
    for(const queued of baseline?[false]:[false,true])for(const indexed of baseline?[false]:[false,true]){
      const states=baseline?[cfg.states.find(s=>s.dimension===3&&!s.tl&&s.flags===3&&!s.defaultStride)]:cfg.states;
      const result=await run({...cfg,states,queued,indexed});
      fs.writeFileSync(path.join(dir,`positive-${queued}-${indexed}.json`),JSON.stringify(result));console.log('PASS strided '+JSON.stringify({queued,indexed,draws:result.drawCount,pixels:result.observations.length,held:result.ownedStridedRecords?.length}));
    }
    if(!baseline)for(const negative of ['selector','drop-z','drop-w','stride','indices']){
      const state=cfg.states.find(s=>!s.tl&&s.dimension===(negative==='drop-w'?4:3)&&s.flags===3&&!s.defaultStride);
      let failure;try{await run({...cfg,states:[state],indexed:negative==='indices'},negative);}catch(e){failure=e;}
      assert.match(String(failure),/PIXEL ORACLE/);assert(failure.partial.calls.some(c=>/PrimitiveStrided7$/.test(c.label)&&c.result===0));
      fs.writeFileSync(path.join(dir,'negative-'+negative+'.json'),JSON.stringify({error:String(failure),partial:failure.partial}));console.log('PASS negative '+negative);
    }
    fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify({status:'PASS',states:cfg.states.length,wasm:hash(fs.readFileSync(path.join(ROOT,'build/wine-assembly.wasm')))}));
  }catch(e){fs.writeFileSync(path.join(dir,'first-failure.json'),JSON.stringify({error:String(e),wasm:hash(fs.readFileSync(path.join(ROOT,'build/wine-assembly.wasm'))),partial:e.partial}));throw e;}
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={config,oracle,fixtureSource,run};
