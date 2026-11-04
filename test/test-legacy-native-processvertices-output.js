#!/usr/bin/env node
'use strict';
// Actual shipped-module x86 COM execution. No draw or host texgen substitute.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const accepted=require('./test-legacy-generated-normal-reflection-projected');
const ROOT=path.resolve(__dirname,'..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');

// Authored rigid transforms give these camera vectors. This oracle does not
// call any production matrix, lighting, packing, or renderer helper.
function expectedVector(mode,i){
  return (mode===1?[[-4/5,3/5,0],[-3/5,0,4/5],[0,4/5,3/5]]:
    [[62/75,-34/75,1/3],[38/75,2/3,41/75],[-2/3,-2/15,11/15]])[i];
}
function plan(){
  const states=[];
  for(const mode of [1,3])for(const selector of [0,2,7])for(const flags of [0,2])for(const op of [1,0x401])
    states.push({label:`mode${mode}/selector${selector}/count${flags}/op${op}`,mode,selector,flags,op,src:[1,3,4],dst:[2,2,2]});
  // Existing canonical-UV output cannot encode generated z/w. These cases
  // characterize that boundary; they are not a D3D7 dimensional parity claim.
  for(const mode of [1,3])for(const flags of [0,2,3,4])
    states.push({label:`boundary/mode${mode}/count${flags}`,mode,selector:2,flags,op:0x401,src:[4,1,3,2],dst:[1,2,3,4],boundary:true});
  for(const mode of [1,3])states.push({label:`mode${mode}/no supplied texture sets`,mode,selector:7,flags:2,op:0x401,src:[],dst:[2,2]});
  states.push({...states.find(s=>s.mode===3&&s.flags===2),label:'reflection/normalized',normalize:true});
  return states;
}
function nativeCases(){return (async()=>{
  const snapshot=async(p,n)=>Array.from(new Uint8Array(memory.buffer,await wa(p),n));
  const create=async(fvf,n)=>{
    const desc=await guard(16);await words(desc.p,[16,0,fvf,n]);
    const before=await snapshot(desc.p,16);
    const obj=await acquire(out=>com('CreateVertexBuffer7',d3d,5,desc.p,out,0));
    await desc.check();eq(await snapshot(desc.p,16),before,'descriptor immutable');return obj;
  };
  const locked=async obj=>{
    const p=await guard(4),n=await guard(4);await ok(com('Lock VB7',obj,3,0,p.p,n.p));
    await p.check();await n.check();return {p:await read(p.p),n:await read(n.p)};
  };
  const fvf=(base,dims)=>dims.reduce((f,d,i)=>(f|([0,3,0,1,2][d]<<(16+2*i)))>>>0,base|(dims.length<<8));
  evidence.outputs=[];
  for(const state of config.states){
    const world=[0,1,0,0,-1,0,0,0,0,0,1,0,.25,-.5,.125,1];
    const view=[-1,0,0,0,0,-1,0,0,0,0,1,0,-.125,.25,.0625,1];
    const projection=identity.slice();projection[11]=2;projection[15]=0;
    const texture=[.25,0,.5,.375,0,.25,-.25,-.125,.125,.25,.75,.5,.5,.375,.75,.75];
    if(negative==='matrix')texture.splice(0,16,...identity);
    for(const [type,m] of [[1,world],[2,view],[3,projection],[16,texture]]){
      await words(matrix,m.map(bits));await ok(com('SetTransform7 '+type,device,11,type,matrix));
      const got=await guard(64);await ok(com('GetTransform7 '+type,device,12,type,got.p));await got.check();
      eq(await snapshot(got.p,64),Array.from(new Uint8Array(Uint32Array.from(m.map(bits)).buffer)),'public transform round trip');
    }
    await tss(11,((negative==='normal-mode'?1:state.mode)<<16)|state.selector);await tss(24,state.flags);
    for(const [id,value] of [[11,((negative==='normal-mode'?1:state.mode)<<16)|state.selector],[24,state.flags]]){
      const got=await guard(4);await ok(com('GetTextureStageState7',device,36,0,id,got.p));await got.check();eq(await read(got.p),value,'public selector/flags round trip');
    }
    await ok(com('SetRenderState7 NORMALIZENORMALS',device,20,143,state.normalize?1:0));
    await ok(com('SetRenderState7 LOCALVIEWER',device,20,142,1));
    const sf=fvf(0x12,state.src),df=fvf(0x4,state.dst),ss=24+4*state.src.reduce((a,b)=>a+b,0),ds=16+4*state.dst.reduce((a,b)=>a+b,0);
    const source=await create(sf,5),destination=await create(df,6),src=await locked(source),dst=await locked(destination);
    eq(src.n,ss*5,'source FVF capacity');eq(dst.n,ds*6,'destination FVF capacity');
    const sourceView=new Uint8Array(memory.buffer,await wa(src.p),src.n);sourceView.fill(0xa5);
    for(let i=0;i<3;i++){
      const p=[[-.25,-.625,.3125],[-.5,1.625,.4375],[2.25,-1.125,.5625]][i];
      const n=[[-.6,-.8,0],[0,-.6,.8],[-.8,0,.6]][i].map(v=>negative==='normal-bytes'?0:v*(state.normalize?2:1));
      const tex=state.src.flatMap((d,set)=>Array.from({length:d},(_,c)=>(16*set+4*i+c+1)/64));
      await words(src.p+(1+i)*ss,[...p,...n,...tex].map(bits));
    }
    const before=await snapshot(src.p,src.n);
    new Uint8Array(memory.buffer,await wa(dst.p),dst.n).fill(0xcd);
    await ok(com('Unlock source',source,4));await ok(com('Unlock destination',destination,4));
    const sentinel=await snapshot(dst.p,dst.n);
    for(const [label,di,count,sv,si,hr] of [['zero',2,0,source,1,0],['src end',2,1,source,5,0x80070057],['dst end',6,1,source,1,0x80070057],['null source',2,1,0,1,0x80004003]]){
      eq(await com('ProcessVertices7 guard '+label,destination,5,state.op,di,count,sv,si,device,0),hr,label);
      const l=await locked(destination);eq(l,dst,'guard Lock');eq(await snapshot(l.p,l.n),sentinel,'guard entire destination unchanged');await ok(com('Unlock guard',destination,4));
    }
    await ok(com('ProcessVertices7',destination,5,state.op,2,3,source,1,device,0));
    // Mutating public state after processing must not affect Lock output.
    await tss(11,0);await tss(24,0);await words(matrix,identity.map(bits));await ok(com('SetTransform7 after PV',device,11,16,matrix));
    const output=await locked(destination);eq(output,dst,'destination Lock stable');
    const actual=await snapshot(output.p,output.n),expected=new Uint8Array(output.n);expected.fill(0xcd);
    const ev=new DataView(expected.buffer),av=new DataView(Uint8Array.from(actual).buffer);
    const floating=[];
    for(let i=0;i<3;i++){
      const z=[.5,.625,.75][i],w=2*z,xy=[[0,0],[32,0],[0,32]][i];
      let offset=(2+i)*ds;
      for(const value of [...xy,z/w,1/w]){ev.setFloat32(offset,value,true);floating.push(offset);offset+=4;}
      const [x,y,vz]=expectedVector(state.mode,i);
      const uv=state.flags===0?[x,y]:[x/4+vz/8+.5,y/4+vz/4+.375];
      // Native legacy implementation emits the same canonical pair to each
      // declared set; missing higher components are its 0,1 defaults.
      for(const dim of state.dst)for(let c=0;c<dim;c++,offset+=4){
        ev.setFloat32(offset,c<2?uv[c]:(c===3?1:0),true);floating.push(offset);
      }
    }
    const row={state,sf,df,ss,ds,sourceBefore:before,actual,expected:Array.from(expected)};evidence.outputs.push(row);
    for(const off of floating)check(Math.abs(av.getFloat32(off,true)-ev.getFloat32(off,true))<2e-6,'NATIVE OUTPUT ORACLE '+state.label+' offset '+off+' actual '+av.getFloat32(off,true)+' expected '+ev.getFloat32(off,true));
    const written=new Set(floating.flatMap(o=>[o,o+1,o+2,o+3]));
    for(let i=0;i<actual.length;i++)if(!written.has(i))eq(actual[i],expected[i],'full output bounds '+i);
    await ok(com('Unlock readback',destination,4));
    const unchanged=await locked(source);row.sourceAfter=await snapshot(unchanged.p,unchanged.n);
    eq(row.sourceAfter,before,'complete source unchanged');await ok(com('Unlock source check',source,4));
    await com('Release source',source,2);await com('Release destination',destination,2);
  }
})();}
function fixtureSource(){
  let s=accepted.fixtureSource();
  const a=s.indexOf('    let currentFVF='),b=s.indexOf("    await ok(com('unbind texture'",a);
  assert(a>0&&b>a);
  s=s.slice(0,a)+'    await ('+nativeCases.toString()+')();\n'+s.slice(b);
  const replace=(a,b)=>{assert.equal(s.split(a).length,2,'public fixture seam '+a);s=s.replace(a,b);};
  replace('      const code=[],word=n=>code.push',`      await write(stack-256,0x6b73a91d);await write(stack+16,0x39e5c72b);
      const code=[],word=n=>code.push`);
  replace('      evidence.calls.push(row);await result.check();',`      evidence.calls.push(row);await result.check();
      eq(await read(stack-256),0x6b73a91d,label+' lower stack guard');
      eq(await read(stack+16),0x39e5c72b,label+' upper stack guard');
      row.stackGuards=true;`);
  // The original cleanup has no draws/queue in this fixture.
  return s;
}
async function run(modulePath,states,negative=null){
  const routes=new Map([['/legacy-render.wasm',fs.readFileSync(modulePath)],['/test/binaries/calc.exe',fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'))],['/lib/host-import-sigs.generated.json',fs.readFileSync(path.join(ROOT,'lib/host-import-sigs.generated.json'))]]);
  const context=vm.createContext({WebAssembly,performance,setTimeout,expectedVector,fetch:async url=>{assert(routes.has(url));const b=routes.get(url);return {arrayBuffer:async()=>Uint8Array.from(b).buffer,json:async()=>JSON.parse(b)};},document:{createElement:()=>({style:{},getContext:()=>({putImageData(){}})}),body:{append(){}}},ImageData:class{}});
  try{return await vm.runInContext('('+fixtureSource()+')',context)('software',{...accepted.config(),queued:false,states,update:null},'()=>[]',negative);}
  catch(e){e.partial=context.legacyTextureEvidence;throw e;}
}
async function main(){
  const dir=process.env.LEGACY_NATIVE_PV_EVIDENCE;if(dir)fs.mkdirSync(dir,{recursive:true});
  const save=(name,data)=>{if(dir)fs.writeFileSync(path.join(dir,name),JSON.stringify(data));};
  const states=process.argv.includes('--baseline')?plan().slice(0,1):plan(),results=[];
  for(const name of ['wine-assembly.wasm','wine-assembly.compat.wasm']){
    const modulePath=path.join(ROOT,'build',name),sha256=hash(fs.readFileSync(modulePath));
    try{const r=await run(modulePath,states);save(name+'.json',r);results.push({name,sha256,cases:r.outputs.length,calls:r.calls.length});console.log('PASS native public ProcessVertices/Lock',JSON.stringify(results.at(-1)));}
    catch(e){save('failure-'+name+'.json',{error:String(e),sha256,partial:e.partial});throw e;}
  }
  if(!process.argv.includes('--baseline'))for(const negative of ['normal-bytes','matrix','normal-mode']){
    const state=plan().find(s=>s.mode===3&&s.flags===2);let failure;
    try{await run(path.join(ROOT,'build/wine-assembly.wasm'),[state],negative);}catch(e){failure=e;}
    assert.match(String(failure),/NATIVE OUTPUT ORACLE/);assert(failure.partial.calls.some(c=>c.label==='ProcessVertices7'&&c.result===0));
    save('negative-'+negative+'.json',{error:String(failure),partial:failure.partial});console.log('PASS rejected native output negative',negative);
  }
  save('result.json',{status:'PASS',results});
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={plan,expectedVector,fixtureSource,run};
