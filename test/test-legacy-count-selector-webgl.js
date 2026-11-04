#!/usr/bin/env node
'use strict';

// Admission check for the expanded public projected fixture. This program
// deliberately does not launch Chrome: a retained COUNT3 module cannot supply
// evidence for the COUNT2/4 repair. --plan is analytic; --preflight checks the
// actual retained binaries and gives a concrete prerequisite failure.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const contract=require('./test-legacy-projected-coordinate-contract');
const previous=require('./test-legacy-projected-webgl');
const ROOT=path.resolve(__dirname,'..');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const sourceCommit='5fa5519eb55e6b2fc83fae4ef12a218e7efc9a7e';
// Published source-seal.json from the worker that built and tested the repair.
// Keep these exact: matching a different locally available module is not proof.
const modulePins={
  'wine-assembly.wasm':'129a71a01a5fbc8b07d6fa242a5a3ebc6a29f5aed9fb4b6a47d9318a764c1f52',
  'wine-assembly.compat.wasm':'3fde0fc42ecd0d9d5096d0b9eb83cd3086cb74aab8ac3f7b9f3fd15f5783fe6a',
};

function controls(){
  const p=contract.plan();
  assert.equal(p.tolerance,2);
  assert.equal(p.states.length,155);
  new vm.Script('('+contract.fixtureSource()+')');
  new vm.Script('('+previous.fixtureSource()+')');
  const counts={};
  for(const count of [2,3,4]){
    const states=p.states.filter(s=>s.label.startsWith('COUNT'+count+'/'));
    assert.equal(states.length,48);
    assert.deepEqual([...new Set(states.map(s=>s.selector))],[0,1,2,7]);
    const levels=[...new Set(states.filter(s=>s.mip===2).flatMap(s=>s.samples.map(t=>
      contract.oracle(p.colors,s,t,true).level)))].sort();
    assert([1,2,3,4].every(level=>levels.includes(level)),'nonzero mips for every count');
    const clip=p.states.find(s=>s.clip&&s.flags===0x100+count);
    assert.deepEqual(contract.oracle(p.colors,clip,{x:1,y:1}),[11,22,33]);
    for(const state of states)for(const sample of state.samples){
      for(const flags of [state.flags,0]){
        const control={...state,flags};
        const expected=contract.oracle(p.colors,control,sample);
        for(const dx of [-.0625,0,.0625])for(const dy of [-.0625,0,.0625])
          assert.deepEqual(contract.oracle(p.colors,control,{x:sample.x+dx,y:sample.y+dy}),expected);
      }
    }
    counts[count]={states:states.length,selectors:[0,1,2,7],levels};
  }
  const source=contract.fixtureSource();
  for(const fault of ['ignored','selector','component','early','lod'])
    assert(source.includes("negative==='"+fault+"'"),'public fault seam '+fault);
  assert(source.includes('liveChangedBeforeDrain=true'),'held Worker mutation retained');
  assert(source.includes('d3dimSoftwareDrawCallsCompleted'),'owning Worker software exclusion retained');
  return {status:'PLAN ONLY; no GL pixels',sourceCommit,tolerance:p.tolerance,states:p.states.length,
    fixtureSHA256:hash(source),oracleSHA256:hash(contract.oracle.toString()),counts,
    faults:['ignored','selector','component','early','lod','captured-matrix'],
    capturedMatrixFault:'native captured-record injection exists in exported contract run; browser adaptation unexecuted'};
}

function prerequisites(root=ROOT){
  const modules=Object.entries(modulePins).map(([name,expected])=>{
    const file=path.join(root,'build',name),exists=fs.existsSync(file);
    const actual=exists?hash(fs.readFileSync(file)):null;
    return {path:file,expectedSHA256:expected,actualSHA256:actual,match:actual===expected};
  });
  const rebuild=['src/main.watx','tools/build-compile-wat.js','tools/watx-closure.js','tools/watx.js',
    'tools/watx-src/compiler-parser.js','tools/watx-src/compiler-stages.js',
    'tools/watx-src/compiler-codegen.js','tools/watx-src/compiler.js'];
  const missingRebuildInputs=rebuild.filter(name=>!fs.existsSync(path.join(root,name)));
  const ready=modules.every(m=>m.match);
  return {status:ready?'MODULE PREREQUISITES PASS; no browser or pixels':'BLOCKED BEFORE CHROME: expanded-contract modules unavailable',
    sourceCommit,modules,missingRebuildInputs,browserLaunched:false,
    next:ready?'Run the expanded fixture using the real browser harness and six adapted rendered faults.':
      'Provide exact retained repaired modules or a reproducible remote build with its required inputs; do not render the stale COUNT3 modules.'};
}

if(require.main===module){
  try{
    const result=process.argv.includes('--preflight')?{plan:controls(),...prerequisites()}:controls();
    console.log(JSON.stringify(result,null,2));
    if(result.modules&&!result.modules.every(m=>m.match))process.exitCode=2;
  }catch(error){console.error(error);process.exitCode=1;}
}
module.exports={controls,prerequisites,modulePins,sourceCommit};
