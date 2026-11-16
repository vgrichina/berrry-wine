#!/usr/bin/env node
'use strict';

// Public x86 COM fixture. --plan is analytic only; default runs real WASM
// WAT software and gps (lib/gpu-stream-software.js) pixels, offline.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const vm=require('node:vm'),crypto=require('node:crypto');
const previous=require('./test-legacy-projected-webgl');
const ROOT=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');

function oracle(colors,state,sample,details=false) {
  if(state.generated)return null; // characterization has no pixel correctness claim
  if(sample.x===1&&sample.y===1&&state.clip)return [11,22,33];
  const weights=[1-(sample.x+sample.y)/32,sample.x/32,sample.y/32];
  const active=[0x102,0x103,0x104].includes(state.flags);
  const t=state.sets[state.selector].map(([u,v],i)=>{
    const m=state.matrix,a=[u,v,0,1];
    const out=active?[0,1,2,3].map(c=>a.reduce((s,x,j)=>s+x*m[4*j+c],0)):[u,v,0,1];
    const w=state.geomW?1+.5*(state.clip&&i===0?-.5:[.2,.8,.6][i]):1;
    const q=active?out[(state.flags&255)-1]:1;
    return [out[0]/w,out[1]/w,q/w];
  });
  const p=[0,1,2].map(c=>t.reduce((v,a,i)=>v+weights[i]*a[c],0)),Q=p[2];
  const d=[1,2].map(i=>[0,1].map(c=>16*((t[i][c]-t[0][c])/32*Q-p[c]*(t[i][2]-t[0][2])/32)/(Q*Q)));
  const rho=Math.max(...d.map(a=>Math.hypot(...a)));
  const level=state.mip===1?0:Math.max(0,Math.min(4,Math.floor(Math.log2(rho)+.5)));
  if(details)return {level,rho,uv:[p[0]/Q,p[1]/Q]};
  const grid=colors[level],n=grid.length,wrap=x=>((Math.floor(x*n)%n)+n)%n;
  return grid[wrap(p[1]/Q)][wrap(p[0]/Q)].slice();
}

function plan(){
  const colors=previous.plan().colors,states=[];
  const sets=Array.from({length:8},(_,s)=>[[.137+s*.031,.193+s*.027],[.887+s*.031,.193+s*.027],[.137+s*.031,.943+s*.027]]);
  for(const count of [2,3,4])for(const selector of [0,1,2,7]){
    for(const scale of [1,4,8,16,32,64]){
      // Off-axis numerator, translation, distinct y/z/w divisors. No matrix
      // component can accidentally substitute for another without detection.
      const matrix=[scale,.125,.75,.375, .25,scale,.25,.625, 0,0,1,0, .093,.157,.3125,.4375];
      if(count===2){matrix[1]=.75;matrix[5]=.25;matrix[13]=.3125;}
      for(const geomW of [false,true])states.push({label:`COUNT${count}/TEX${selector}/scale${scale}/w${geomW}`,
        flags:0x100+count,selector,sets,matrix,geomW,mip:scale===1?1:2,filter:1,
        samples:[{x:8,y:12},{x:12,y:8},{x:12,y:12}]});
    }
  }
  const base=states.find(s=>s.flags===0x104&&s.selector===7&&s.geomW);
  // Invalid flag words are characterization controls: legacy setter stores
  // them, but they must not enter the valid projected path or retain old q.
  for(const flags of [0x104,0,0x100,0x101,0x105,0x203,0x104,0])
    states.push({...base,label:'transition '+flags,flags});
  for(const count of [2,3,4])states.push({...base,label:'clip COUNT'+count,flags:0x100+count,clip:true,
    samples:[{x:8,y:12},{x:12,y:8},{x:1,y:1}]});
  // Preselect interior samples stable under the established TL 1/16-pixel
  // fill displacement, so this same authored fixture can later render in GL.
  // Clipped Clear samples are retained separately. Tolerance stays two bytes.
  const candidates=[[8,12],[12,8],[12,12],[9,11],[11,9],[10,12],[12,10],[9,10],[10,9],[8,10],[10,8]];
  for(const state of states){
    const samples=candidates.map(([x,y])=>({x,y})).filter(s=>{
      return [state,{...state,flags:0}].every(control=>{
        const expected=JSON.stringify(oracle(colors,control,s));
        return [-.0625,0,.0625].every(dx=>[-.0625,0,.0625].every(dy=>
          JSON.stringify(oracle(colors,control,{x:s.x+dx,y:s.y+dy}))===expected));
      });
    }).slice(0,state.clip?2:3);
    assert.equal(samples.length,state.clip?2:3,'stable interior samples '+state.label);
    state.samples=state.clip?[...samples,{x:1,y:1}]:samples;
  }
  return {colors,states,spatial:true,tolerance:2,update:null};
}

function fixtureSource(){
  let source=previous.fixtureSource();
  const replace=(a,b)=>{assert.equal(source.split(a).length,2,'coordinate seam '+a.slice(0,80));source=source.replace(a,b);};
  replace('const vertices=await alloc(96)','const vertices=await alloc(264)');
  replace('const [u,v]=state.uvs[i];','const [u,v]=state.sets[state.selector&7][i];');
  replace('await words(vertices+i*32,[bits(x*w),bits(y*w),bits(z),0,0xffffffff,0,bits(u),bits(v)]);',
    `const coords=state.sets.flatMap(set=>set[i]);
        const middle=config.withNormals?[bits(.3),bits(.6),bits(.7)]:[0,0xffffffff,0];
        await words(vertices+i*88,[bits(x*w),bits(y*w),bits(z),...middle,...coords.map(bits)]);`);
  replace('const m=identity.slice();m[0]=m[5]=state.scale;m[2]=state.qU;m[6]=state.qV;m[14]=state.q;',
    `const m=state.matrix.slice();
      if(negative==='component'){
        const c=(state.flags&255)-1,other=c===3?2:3;
        for(let r=0;r<4;r++)m[r*4+c]=state.matrix[r*4+other];
      }
      if(negative==='early'){m.splice(0,16,...identity);m[14]=1;}`);
  replace('await tss(11,0);await tss(24,state.flags);',`await tss(11,state.selector);await tss(24,state.flags);
      const sel=await guard(4);await ok(com('GetTextureStageState selector',device,36,0,11,sel.p));
      await sel.check();eq(await read(sel.p),state.selector,'selector round trip');`);
  source=source.replaceAll('4,0x1e2,vertices,3','4,(config.withNormals?0x812:0x8e2),vertices,3');
  replace('close(actual,expected,label);',`if(state.generated)row.boundary='generated-coordinate prerequisite characterization ONLY; no pixel oracle';
      else close(actual,expected,label);`);
  replace('for(const state of config.states){await setState(state);await geometry(state);await draw();',
    `for(const state of config.states){evidence.currentState=state;await setState(state);await geometry(state);
      if(negative==='ignored')await tss(24,0);
      if(negative==='selector')await tss(11,(state.selector+1)%8);
      if(negative==='early')await tss(24,0x103);
      if(negative==='lod')await tss(18,1);
      await draw();`);
  replace("for(const old of config.states.filter(s=>s.flags===0x103&&s.geomW))", "for(const old of config.states.filter(s=>[0x102,0x103,0x104].includes(s.flags)&&s.geomW))");
  replace('const next={...old,q:8,qU:0,qV:0,scale:1,flags:0,', 'const next={...old,matrix:identity,flags:0,');
  replace('const coords=state.sets.flatMap(set=>set[i]);',`const coords=state.sets.flatMap(set=>{
          if(negative!=='early')return set[i];
          const a=[...set[i],0,1],m=state.matrix;
          const t=[0,1,2,3].map(c=>a.reduce((s,x,j)=>s+x*m[4*j+c],0)),q=t[(state.flags&255)-1];
          return [t[0]/q,t[1]/q];
        });`);
  return source;
}

// The production-adapter recording (inspect: lib/d3dim-gpu.js + lib/d3d9-fixed.js
// compiling each captured draw) and the physical native-queue arm
// (d3d-command-stream Encoder + d3dim_gpu_state_override + the captured-matrix
// fault) probed the deleted JS executor and are gone. Pixels still come from
// public COM through the WAT rasterizer ('software') and the WAT GPU stream
// producer drained into lib/gpu-stream-software.js ('gps').
async function run(wasm,options={},negative=null,mode='software'){
  const bytes=fs.readFileSync(wasm),pe=fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'));
  const source=fixtureSource(),c={...previous.config(),...plan(),...options};
  let failure;
  try{await previous.runFixture(source,mode,c,oracle.toString(),negative,bytes);}catch(e){failure=e.stack;}
  return {wasm:path.relative(ROOT,wasm),mode,wasmSHA256:sha(bytes),calcSHA256:sha(pe),fixtureSHA256:sha(source),
    failure:failure||null,...JSON.parse(JSON.stringify(c.lastEvidence))};
}

async function main(){
  new vm.Script('('+fixtureSource()+')');
  const p=plan(),levels={};
  for(const count of [2,3,4]){
    levels[count]=[...new Set(p.states.filter(s=>s.flags===0x100+count&&s.mip===2)
      .flatMap(s=>s.samples.filter(t=>t.x!==1).map(t=>oracle(p.colors,s,t,true).level)))].sort();
    assert([1,2,3,4].every(l=>levels[count].includes(l)),'independent mip levels COUNT'+count);
  }
  if(process.argv.includes('--plan')){console.log(JSON.stringify({status:'PLAN ONLY',states:p.states.length,levels}));return;}
  const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6);
  const wasm=process.argv.find(a=>a.startsWith('--wasm='))?.slice(7)||'build/wine-assembly.wasm';
  const results=[];
  const save=()=>{if(out){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'observed.json'),JSON.stringify(results,null,2)+'\n');}};
  // GAP (lib/src): lib/d3d9-software-backend.js refuses every D3DTTFF_PROJECTED
  // draw the producer emits ('shader exceeds native VM implementation'), so the
  // gps arm keeps only the non-projected transition controls until that lands.
  // LEGACY_PROJECTED_GPS_ALL=1 runs gps on the full matrix.
  const projected=s=>[0x102,0x103,0x104].includes(s.flags);
  // PRE-EXISTING (src, also at HEAD b7c07b54f's build): the WAT renderer still
  // applies TEXTURE0 to the invalid flag words 0x101 and 0x203 (rendered
  // [20,70,65] where the identity oracle wants untransformed UVs), in software
  // and gps alike. LEGACY_PROJECTED_INVALID_FLAGS=1 keeps those two controls.
  const invalid=s=>process.env.LEGACY_PROJECTED_INVALID_FLAGS!=='1'&&(s.flags===0x101||s.flags===0x203);
  for(const mode of ['software','gps'])for(const indexed of [false,true]){
    const states=(mode==='gps'&&process.env.LEGACY_PROJECTED_GPS_ALL!=='1'?plan().states.filter(s=>!projected(s)):plan().states).filter(s=>!invalid(s));
    const r=await run(path.resolve(ROOT,wasm),{states,indexed},null,mode);results.push(r);
    save();
    assert.equal(r.failure,null);assert.equal(r.status,'PASS');
    console.log(JSON.stringify({wasm:r.wasm,mode,indexed,pixels:r.observations.length,status:r.status}));
  }
  for(const count of [2,3,4])for(const negative of ['ignored','selector','component','early','lod']){
    const states=plan().states.filter(s=>s.flags===0x100+count&&s.selector===7&&s.geomW);
    const r=await run(path.resolve(ROOT,wasm),{states},negative);results.push(r);save();
    assert(r.failure?.includes('PIXEL ORACLE'),'fault must reject rendered pixels: '+negative+' '+r.failure);
    assert(r.calls.some(c=>c.label==='DrawPrimitive7'&&c.result===0),'fault preserves public Draw success');
    console.log(JSON.stringify({count,negative,status:'RENDERED REJECTION PASS',failure:r.failure.split('\n')[0]}));
  }
  const base=plan().states.find(s=>s.flags===0x103&&s.selector===7&&s.geomW);
  for(const withNormals of [false,true]){
    const states=[1,2,3].map(mode=>({...base,label:'TCI mode '+mode+' normals '+withNormals,
      selector:(mode<<16)|7,generated:true,samples:[{x:8,y:12}]}));
    const r=await run(path.resolve(ROOT,wasm),{states,withNormals});results.push(r);save();
    assert.equal(r.failure,null);assert.equal(r.observations.length,3);
    assert(r.observations.every(o=>o.expected===null),'no generated pixel correctness claim');
    console.log(JSON.stringify({withNormals,status:'GENERATED PREREQUISITES CHARACTERIZED; pixels UNQUALIFIED'}));
  }
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={plan,oracle,fixtureSource,run};
