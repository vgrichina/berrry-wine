#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const previous=require('./test-legacy-projected-webgl');
const expanded=require('./test-legacy-projected-coordinate-contract');
const ROOT=path.resolve(__dirname,'..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
// Expected coordinates are authored independently of the FVF decoder. The
// rational interpolation and analytic mip rule are retained from the audit.
function oracle(colors,state,sample,details=false){
  const weights=[1-(sample.x+sample.y)/32,sample.x/32,sample.y/32];
  const active=[0x102,0x103,0x104].includes(state.flags),count=state.flags&255;
  const h=state.sets[state.selector].map((supplied,i)=>{
    const a=[supplied[0],supplied.length>1?supplied[1]:0,0,1];
    const m=state.matrix;
    const b=active?[0,1,2,3].map(c=>a.reduce((sum,x,j)=>sum+x*m[4*j+c],0)):a;
    const w=state.geomW?1+.5*[.2,.8,.6][i]:1;
    return [b[0]/w,b[1]/w,(active?b[count-1]:1)/w];
  });
  const p=[0,1,2].map(c=>h.reduce((sum,a,i)=>sum+weights[i]*a[c],0)),Q=p[2];
  const gradients=[1,2].map(i=>[0,1].map(c=>16*((h[i][c]-h[0][c])/32*Q-p[c]*(h[i][2]-h[0][2])/32)/(Q*Q)));
  const rho=Math.max(...gradients.map(g=>Math.hypot(...g)));
  const level=state.mip===1?0:Math.max(0,Math.min(4,Math.floor(Math.log2(rho)+.5)));
  if(details)return {level,rho,uv:[p[0]/Q,p[1]/Q]};
  const grid=colors[level],n=grid.length,wrap=x=>((Math.floor(x*n)%n)+n)%n;
  return grid[wrap(p[1]/Q)][wrap(p[0]/Q)].slice();
}
function fvf(dimensions){return dimensions.reduce((f,d,i)=>(f|([0,3,0,1,2][d]<<(16+2*i)))>>>0,0xe2|(dimensions.length<<8));}
function plan(){
  const colors=previous.plan().colors,states=[];
  // The selected set is preceded by every other dimension; sets 0 and 7
  // exercise both ends. Equal total strides isolate different set offsets.
  for(const dimensions of [[1,2,3,4,1,3,4,2],[4,3,2,1,4,2,3,1]])for(const selector of [0,1,2,3,7]){
    const dimension=dimensions[selector];
    const sets=dimensions.map((d,s)=>[[.137+s*.031,.193+s*.027,.337+s*.019,.719+s*.023],
      [.887+s*.031,.193+s*.027,.537+s*.019,.919+s*.023],
      [.137+s*.031,.943+s*.027,.737+s*.019,1.119+s*.023]].map(a=>a.slice(0,d)));
    for(const flags of dimension<=2?[0,0x102,0x103,0x104]:[0])for(const scale of flags?[1,16]:[1]){
      const matrix=[scale,.75,.5,.375, .25,.25,.375,.625, 7,11,13,17, .093,.3125,.625,.4375];
      for(const geomW of [false,true])states.push({label:`dims${dimensions.join('')}/TEX${selector}/FLOAT${dimension}/flags${flags}/scale${scale}/w${geomW}`,
        dimensions,dimension,sets,selector,flags,matrix,geomW,mip:scale===1?1:2,filter:1,fvf:fvf(dimensions)});
    }
  }
  const candidates=Array.from({length:17},(_,x)=>Array.from({length:17},(_,y)=>({x:x+5,y:y+5}))).flat().filter(p=>p.x+p.y<29);
  for(const state of states){state.samples=candidates.filter(s=>[state,{...state,flags:0}].every(control=>[-.0625,0,.0625].every(dx=>[-.0625,0,.0625].every(dy=>
    JSON.stringify(oracle(colors,control,s))===JSON.stringify(oracle(colors,control,{x:s.x+dx,y:s.y+dy})))))).slice(0,3);
    assert.equal(state.samples.length,3,state.label);}
  return {colors,states,spatial:true,tolerance:2,update:null};
}
function config(){return {...previous.config(),...plan()};}
function fixtureSource(){
  let source=expanded.fixtureSource();
  const replace=(a,b)=>{assert.equal(source.split(a).length,2,'dimension seam '+a.slice(0,70));source=source.replace(a,b);};
  replace('const vertices=await alloc(264)','const vertices=await alloc(480)');
  // Bounded ownership: the immediate Device7 path is the tested contract.
  source=source.replaceAll('(config.withNormals?0x812:0x8e2)','currentFVF');
  replace('const geometry=async state=>{',`let currentFVF=0;const geometry=async state=>{
      const layout=state.dimensions.slice();
      if(negative==='default-v')layout[state.selector]=2;
      currentFVF=layout.reduce((f,d,i)=>(f|([0,3,0,1,2][d]<<(16+2*i)))>>>0,0xe2|(layout.length<<8));
      if(negative==='layout')currentFVF=(currentFVF^(3<<16)^(3<<18))>>>0;
      if(state.overrideFVF)currentFVF=state.overrideFVF;`);
  replace('const coords=state.sets.flatMap(set=>{','const coords=state.sets.flatMap((set,setIndex)=>{');
  replace('await words(vertices+i*88,','await words(vertices+i*(24+4*layout.reduce((a,b)=>a+b,0)),');
  // Negative controls still use real successful public Draws. They change
  // authored bytes or selector, never expected pixels or production code.
  {const start=source.indexOf("          if(negative!=='early')return set[i];"),end=source.indexOf('        });',start);
    assert(start>0&&end>start);source=source.slice(0,start)+"          return negative==='default-v'&&setIndex===state.selector?[set[i][0],.28125]:set[i];\n"+source.slice(end);}
  replace('if(negative===\'component\'){',"if(negative==='default-w'){for(let c=0;c<4;c++)m[12+c]=0;}\n      if(negative==='component'){");
  // Out-of-range selector and texture-count words are rejected. Transformed
  // FLOAT3/4 input used to be rejected here too; it is now supported and its
  // pixels are owned by test-legacy-transformed-float34.js.
  replace("    await ok(com('unbind texture',device,35,0,0));",`    if(!negative){
      const base=config.states[0];await geometry(base);await setState({...base,flags:0});
      const invalid=[{...base,selector:8},{...base,overrideFVF:0x9e2}];
      evidence.rejected=[];
      for(const state of invalid){await geometry(state);await setState(state);
        await ok(com('BeginScene7 invalid',device,5));
        const result=await (config.indexed?com('DrawIndexedPrimitive7 invalid',device,26,4,currentFVF,vertices,3,indices,3,0):
          com('DrawPrimitive7 invalid',device,25,4,currentFVF,vertices,3,0));
        eq(result>>>0,0x80070057,'unsupported supplied input fails');
        await ok(com('EndScene7 invalid',device,6));evidence.rejected.push({fvf:currentFVF,selector:state.selector,flags:state.flags,result});
      }
    }
    await ok(com('unbind texture',device,35,0,0));`);
  return source;
}
function controls(){
  const p=plan();new vm.Script('('+fixtureSource()+')');
  assert.deepEqual([...new Set(p.states.map(s=>s.dimension))].sort(),[1,2,3,4]);
  assert.equal(p.tolerance,2);
  assert.equal(fvf([1,2,3,4]),0x9304e2);
  const witnesses={};
  for(const fault of ['selector','default-v','default-w','component','layout']){
    const candidates=p.states.filter(s=>(fault!=='default-v'||s.dimension===1)&&(fault!=='component'||s.flags>=0x102)&&(fault!=='layout'||(s.selector===1&&s.dimensions[0]===1)));
    const state=candidates.find(s=>s.samples.some(sample=>{
      let wrong;
      if(fault==='selector')wrong={...s,selector:(s.selector+1)%8};
      if(fault==='default-v')wrong={...s,sets:s.sets.map(set=>set.map(a=>a.length===1?[a[0],.28125]:a))};
      if(fault==='layout')wrong={...s,sets:s.sets.map((set,i)=>i===1?set.map(a=>[a[1]]):set)};
      if(fault==='component'){const m=s.matrix.slice(),c=(s.flags&255)-1,other=c===3?2:3;for(let r=0;r<4;r++)m[4*r+c]=s.matrix[4*r+other];wrong={...s,matrix:m};}
      if(fault==='default-w')wrong={...s,matrix:s.matrix.map((x,i)=>i>=12?0:x)};
      return oracle(p.colors,s,sample).some((v,i)=>Math.abs(v-oracle(p.colors,wrong,sample)[i])>2);
    }));assert(state,'independent pixel witness '+fault);witnesses[fault]=state.label;
  }
  return {status:'PLAN PASS; no drawn pixels',states:p.states.length,tolerance:2,witnesses,
    boundary:'FLOAT1/2 supplied projected COUNT2/3/4; FLOAT3/4 disabled transform; invalid selector/count rejected'};
}
// Node pixels through public COM: the WAT rasterizer ('software') and the WAT
// GPU stream producer drained into lib/gpu-stream-software.js ('gps'). The
// browser WebGL/Worker runtime and its served lib/d3dim-gpu.js went with the
// deleted JS executor. GAP (lib/src): the software GPU backend refuses every
// D3DTTFF_PROJECTED draw the producer emits ('shader exceeds native VM
// implementation'), so gps runs the unprojected states unless
// LEGACY_PROJECTED_GPS_ALL=1.
const NEGATIVES=['selector','default-v','default-w','component','layout'];
async function offline(){
  const p=plan(),results=[],source=fixtureSource();
  const gpsStates=process.env.LEGACY_PROJECTED_GPS_ALL==='1'?p.states:p.states.filter(s=>!(s.flags&0x100));
  for(const mode of ['software','gps'])for(const indexed of [false,true]){
    const result=await previous.runFixture(source,mode,{...config(),states:mode==='gps'?gpsStates:p.states,indexed},oracle.toString());
    assert.equal(result.status,'PASS');results.push(result);
    console.log('PASS '+JSON.stringify({mode,indexed,observations:result.observations.length,rejected:result.rejected?.length}));
  }
  for(const mode of ['software','gps'])for(const negative of NEGATIVES){
    const witness=controls().witnesses[negative],states=p.states.filter(s=>s.label===witness);
    if(mode==='gps'&&!gpsStates.includes(states[0]))continue;
    const cfg={...config(),states};let error;
    try{await previous.runFixture(source,mode,cfg,oracle.toString(),negative);}catch(e){error=String(e);}
    assert.match(error||'',/PIXEL ORACLE/);assert(cfg.lastEvidence.calls.some(c=>c.label==='DrawPrimitive7'&&c.result===0));
    results.push({mode,negative,error,partial:cfg.lastEvidence});
    console.log('PASS negative '+mode+' '+negative);
  }
  return results;
}

if(require.main===module){
 if(process.argv.includes('--plan'))console.log(JSON.stringify(controls(),null,2));
 else offline().then(results=>{const out=process.env.LEGACY_PROJECTED_EVIDENCE; if(out){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'offline.json'),JSON.stringify(results));}console.log('OFFLINE PASS '+results.length);}).catch(e=>{console.error(e);process.exitCode=1;});
}
module.exports={oracle,plan,config,fvf,fixtureSource,controls,offline};
