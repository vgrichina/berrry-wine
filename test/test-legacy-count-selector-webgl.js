#!/usr/bin/env node
'use strict';

// Expanded public COM fixture (the projected-coordinate-contract plan plus the
// owning-Worker captured-matrix fault seam), consumed by
// test-legacy-generated-coordinate-contract.js. The default run renders it in
// node through the WAT rasterizer ('software') and the WAT GPU stream producer
// into lib/gpu-stream-software.js ('gps'); --plan runs the analytic and
// isolated captured-matrix controls. The browser WebGL runner, its served
// lib/d3dim-gpu.js and the lib/d3d9-fixed.js repair controls went with the
// deleted JS executor.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const contract=require('./test-legacy-projected-coordinate-contract');
const previous=require('./test-legacy-projected-webgl');
const ROOT=path.resolve(__dirname,'..');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const sourceCommit='a62801c2f653b738a9ba6fa052c91b9d7c673d52';
// Published source-seal.json from the worker that built and tested the repair.
// Keep these exact: matching a different locally available module is not proof.
const modulePins={
  'wine-assembly.wasm':'129a71a01a5fbc8b07d6fa242a5a3ebc6a29f5aed9fb4b6a47d9318a764c1f52',
  'wine-assembly.compat.wasm':'3fde0fc42ecd0d9d5096d0b9eb83cd3086cb74aab8ac3f7b9f3fd15f5783fe6a',
};
const acceptedPositive={commit:'bf257f136ffaa4cddb89a7335a090e983f6e4fab',
  run:'20261104-legacy-repaired-quotient-webgl',
  resultSHA256:'da6582bac3cddcde051165dbc46c28f2f3c9a6ce825d39e7509f403cec0f890f',
  cells:16,draws:3712,observations:10648};
function faultCases(remaining=false){
  const cases=[];
  for(const version of [1,2])for(const count of [2,3,4])
    for(const fault of ['ignored','selector','component','early','lod','captured-matrix'])
      cases.push(['wine-assembly.wasm',fault==='captured-matrix'?'worker':'webgl',version,false,fault,count]);
  return remaining?cases.slice(5):cases;
}

function controls(){
  assert.equal(faultCases().length,36);
  assert.equal(faultCases(true).length,31);
  assert.deepEqual(faultCases(true)[0],['wine-assembly.wasm','worker',1,false,'captured-matrix',2]);
  assert.deepEqual(faultCases(true).slice(1),faultCases().slice(6));
  const p=contract.plan();
  assert.equal(p.tolerance,2);
  assert.equal(p.states.length,155);
  new vm.Script('('+contract.fixtureSource()+')');
  new vm.Script('('+fixtureSource()+')');
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
  assert(!source.includes('d3dimSoftwareDrawCallsCompleted'),'retired D3DIM software-draw evidence is gone');
  return {status:'PLAN ONLY; no GL pixels',sourceCommit,tolerance:p.tolerance,states:p.states.length,
    capturedMatrixRepair:capturedMatrixControls(),fixtureSHA256:hash(source),oracleSHA256:hash(contract.oracle.toString()),counts,
    faults:['ignored','selector','component','early','lod','captured-matrix'],
    capturedMatrixFault:'held owned matrix replaced before actual owning Worker GL delivery'};
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

function config(){return {...previous.config(),...contract.plan()};}
const oracle=contract.oracle;
// Runs in a delayed owning-Worker callback, outside the public COM setup scope.
// Keep its identity matrix local so delivery never depends on fixture locals.
function corruptCapturedMatrices(buffer,bytes){
  const d=new DataView(buffer);let changed=0;
  for(let offset=0;offset<bytes;){
    const size=d.getUint32(offset,true);
    assertRecord(size>0&&offset+size<=bytes);
    if(d.getUint32(offset+12,true)===4){
      new Uint8Array(buffer,offset+32+3136,64).set(new Uint8Array(new Float32Array(
        [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]).buffer));
      changed++;
    }offset+=size;
  }
  return changed;
  function assertRecord(ok){if(!ok)throw new Error('captured record size');}
}
function capturedMatrixControls(){
  // Execute the exact callback helper in an isolated realm with no identity
  // binding, using framed held type-3/type-4 records and byte guards.
  const mutate=vm.runInNewContext('('+corruptCapturedMatrices.toString()+')');
  const recordSize=3296,buffer=new SharedArrayBuffer(recordSize*2),bytes=new Uint8Array(buffer);
  bytes.fill(0xa5);const d=new DataView(buffer);
  for(let i=0;i<2;i++){d.setUint32(i*recordSize,recordSize,true);d.setUint32(i*recordSize+12,i?4:3,true);}
  const before=bytes.slice(),offset=recordSize+32+3136;
  assert.equal(mutate(buffer,bytes.length),1);
  assert.deepEqual(Array.from(new Float32Array(buffer,offset,16)),[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
  assert.deepEqual(bytes.slice(0,offset),before.slice(0,offset));
  assert.deepEqual(bytes.slice(offset+64),before.slice(offset+64));
  assert.throws(()=>mutate(buffer,bytes.length-1),/captured record size/);
  // The old identity scope failure must still reject before changing bytes.
  const referenceError=name=>error=>error.name==='ReferenceError'&&error.message===name+' is not defined';
  const identityLiteral='[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]';
  const helper=corruptCapturedMatrices.toString();
  assert.equal(helper.split(identityLiteral).length,2);
  const oldMutate=vm.runInNewContext('('+helper.replace(identityLiteral,'identity')+')');
  bytes.set(before);
  assert.throws(()=>oldMutate(buffer,bytes.length),referenceError('identity'));
  assert.deepEqual(bytes,before);
  // Execute the emitted lexical declarations too. The wrapper gained queue
  // and transport instrumentation after this isolated regression was written;
  // a hand-built context omitted those locals and failed before fault delivery.
  // Strict mode also refuses accidental globals from init assignments.
  const source=fixtureSource(),start=source.indexOf('port.postMessage=message=>{'),
    end=source.indexOf('        return port;',start),
    declarations=source.indexOf('  const held=[];'),worker=source.indexOf("  if(mode==='worker') {",declarations);
  assert(declarations>0&&worker>declarations&&start>worker&&end>start);
  const prefix=source.slice(declarations,worker),wrapper=source.slice(start,end);
  const omissionSeams={transport:['const transport=evidence.transport={batches:[],holds:[]};',''],
    queueBuffers:['let queueBuffers,queueControl;','let queueControl;'],
    queueControl:['let queueBuffers,queueControl;','let queueBuffers;'],
    heldPackets:['const heldPackets=[];','']};
  const isolated=omit=>{
    let locals=prefix;
    if(omit){const [from,to]=omissionSeams[omit];assert.equal(locals.split(from).length,2);locals=locals.replace(from,to);}
    const delivered=[],context=vm.createContext({port:{},post:m=>delivered.push(m),
      holding:false,negative:'captured-matrix',evidence:{},heldRecord:{messages:[]},check:assert});
    const scope=vm.runInContext("'use strict';\n"+locals+wrapper+
      ';({held,heldPackets:typeof heldPackets===\'undefined\'?null:heldPackets,transport:typeof transport===\'undefined\'?null:transport, get buffers(){return queueBuffers;},get control(){return queueControl;},transportSnapshot})',context);
    return {context,scope,delivered};
  };
  const control=new SharedArrayBuffer(32),controls=new Int32Array(control);
  controls[3]=7;controls[1]=6;
  const untouched=new SharedArrayBuffer(bytes.length),buffers=[untouched,buffer];
  const init={t:'init',buffers,control},batch={t:'batch',seq:7,index:1,bytes:bytes.length,commands:2};
  const {context,scope,delivered}=isolated();
  context.port.postMessage(init);
  assert.equal(scope.buffers,buffers);assert.equal(scope.control.buffer,control);
  assert.equal(scope.transportSnapshot().submitted,7);assert.equal(scope.transportSnapshot().completed,6);
  context.port.postMessage(batch); // Immediate delivery records transport, never corrupts.
  assert.deepEqual(bytes,before);assert.equal(scope.held.length,0);
  context.holding=true;
  const heldBatch={...batch,seq:8},fence={t:'fence'};
  context.port.postMessage(heldBatch);context.port.postMessage(fence);
  assert.equal(scope.held.length,2);assert.equal(scope.heldPackets.length,1);
  assert.equal(scope.heldPackets[0],heldBatch);assert.deepEqual(context.heldRecord.messages,['batch','fence']);
  assert.equal(scope.transport.batches.length,2);
  for(const [i,row] of scope.transport.batches.entries()){
    assert.equal(row.sequence,7+i);assert.equal(row.index,1);assert.equal(row.commands,2);
    assert.deepEqual(Array.from(row.header),Array.from(new Uint32Array(buffer,0,8)));
  }
  assert.deepEqual(delivered,[init,batch]);assert.deepEqual(bytes,before);
  context.holding=false;for(const send of scope.held.splice(0))send();
  assert.equal(context.evidence.corruptedCapturedMatrices,1);
  assert.deepEqual(delivered,[init,batch,heldBatch,fence]);
  assert.deepEqual(Array.from(new Float32Array(buffer,offset,16)),[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
  assert.deepEqual(bytes.slice(0,offset),before.slice(0,offset));
  assert.deepEqual(bytes.slice(offset+64),before.slice(offset+64));
  assert(new Uint8Array(untouched).every(byte=>byte===0),'only the selected endpoint buffer changes');
  // Remove each real binding in memory: these must fail in the exact wrapper,
  // before held delivery or matrix mutation, rather than passing a parse check.
  for(const omit of Object.keys(omissionSeams)){
    bytes.set(before);const broken=isolated(omit);
    assert.throws(()=>{
      broken.context.port.postMessage(init);broken.context.holding=true;
      broken.context.port.postMessage(heldBatch);
    },referenceError(omit));
    assert.equal(broken.scope.held.length,0);assert.deepEqual(bytes,before);
    assert.equal(broken.context.evidence.corruptedCapturedMatrices,undefined);
  }
  return {status:'PASS strict isolated emitted locals/wrapper; immediate and held/drained delivery; type-4 matrix only; guards intact',
    rejectedMissingBindings:[...Object.keys(omissionSeams),'identity'],pixels:'NONE; isolated transport regression only'};
}
function fixtureSource(){
  let source=contract.fixtureSource();
  const replace=(a,b)=>{assert.equal(source.split(a).length,2,'browser seam '+a);source=source.replace(a,b);};
  replace('  const held=[];', '  const held=[];let endpointBuffers;'+corruptCapturedMatrices.toString());
  replace("if(holding&&(message.t==='batch'||held.length))held.push(()=>post(message));else post(message);",`if(message.t==='init')endpointBuffers=message.buffers;
          if(holding&&(message.t==='batch'||held.length))held.push(()=>{
            if(negative==='captured-matrix'&&message.t==='batch'){
              check(endpointBuffers,'captured endpoint buffers');
              const changed=corruptCapturedMatrices(endpointBuffers[message.index],message.bytes);
              evidence.corruptedCapturedMatrices=(evidence.corruptedCapturedMatrices||0)+changed;
            }post(message);
          });else post(message);`);
  replace('await setState(next);heldRecord.liveChangedBeforeDrain=true;',
    'await setState({...next,selector:(old.selector+1)%8});heldRecord.liveChangedBeforeDrain=true;');
  replace("await draw();for(const sample of next.samples)await observe('next '+next.label,sample,next);",
    "await setState(next);await draw();for(const sample of next.samples)await observe('next '+next.label,sample,next);");
  return source;
}
// GAP (lib/src): lib/d3d9-software-backend.js refuses every D3DTTFF_PROJECTED
// draw the producer emits, so gps renders only the unprojected transition
// controls unless LEGACY_PROJECTED_GPS_ALL=1. The invalid 0x101/0x203 flag
// words are pre-existing WAT deviations (see the coordinate contract).
async function offline(){
  const results=[],source=fixtureSource();
  const invalid=s=>process.env.LEGACY_PROJECTED_INVALID_FLAGS!=='1'&&(s.flags===0x101||s.flags===0x203);
  for(const mode of ['software','gps']){
    const states=config().states.filter(s=>!invalid(s)&&(mode!=='gps'||process.env.LEGACY_PROJECTED_GPS_ALL==='1'||![0x102,0x103,0x104].includes(s.flags)));
    const result=await previous.runFixture(source,mode,{...config(),states},oracle.toString());
    assert.equal(result.status,'PASS');results.push({mode,observations:result.observations.length});
    console.log('PASS '+JSON.stringify(results.at(-1)));
  }
  return results;
}
if(require.main===module){
  if(process.argv.includes('--plan'))console.log(JSON.stringify(controls(),null,2));
  else if(process.argv.includes('--modules')){const p=prerequisites();console.log(JSON.stringify(p,null,2));if(!p.modules.every(m=>m.match))process.exitCode=2;}
  else offline().catch(e=>{console.error(e);process.exitCode=1;});
}
module.exports={controls,prerequisites,modulePins,sourceCommit,fixtureSource,config,oracle,offline,corruptCapturedMatrices,capturedMatrixControls,faultCases,acceptedPositive};
