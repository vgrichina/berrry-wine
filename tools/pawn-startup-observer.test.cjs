'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {installPawnObservation,pawnReadiness}=require('./pawn-startup-observer.cjs');

test('readiness rejects missing, stopped, detached and terminal owners',()=>{
  const s={isolated:true,apps:[{name:'pawn',running:true,stopped:false}],
    workers:[{url:'/lib/guest-worker.js',observerInstalled:true,closed:false}]};
  assert(pawnReadiness(s).ready);
  assert(!pawnReadiness({...s,apps:[]}).ready);
  assert(!pawnReadiness({...s,apps:[{...s.apps[0],stopped:true}]}).ready);
  assert(!pawnReadiness({...s,workers:[{...s.workers[0],closed:true}]}).ready);
  assert(!pawnReadiness({...s,workers:[{...s.workers[0],terminal:{}}]}).ready);
});

test('factory gate and sticky owner latch preserve native import and post semantics',async()=>{
  const memory={buffer:new ArrayBuffer(0x430000)},ranges=[],messages=[],logs=[];
  let calls=0,ownThis,ownArgs;
  const ex={guest_to_wasm:p=>p,get_image_base:()=>0x400000,get_esp:()=>0x700,
    get_eip:()=>0,get_eax:()=>0x1234,set_trace_eip_range:(...a)=>ranges.push(a)};
  const result={exports:ex};let actual;
  const scope={console:{log:s=>logs.push(s)},performance:{now:()=>0},
    postMessage:function(...a){messages.push(a);return 77;},
    WebAssembly:{instantiate:async(m,i)=>{actual=i;return result;}}};
  installPawnObservation(scope,{control:true});
  const imports={host:{memory,log_eip:function(...a){calls++;ownThis=this;ownArgs=a;return 91;}}};
  assert.equal(await scope.WebAssembly.instantiate('module',imports),result);
  assert.deepEqual(ranges,[[1,0x414ffe,0x41508c]]);
  const receiver={};assert.equal(actual.host.log_eip.call(receiver,0x414ffe,42),91);
  assert.equal(calls,1);assert.equal(ownThis,receiver);assert.deepEqual(ownArgs,[0x414ffe,42]);
  assert.deepEqual(ranges[1],[1,0x4104f6,0x41d200]);
  const transfer=[],msg={t:'sliceDone',seq:7,eip:0,yield:0};
  assert.equal(scope.postMessage(msg,transfer),77);
  assert.equal(messages[0][0],msg);assert.equal(messages[0][1],transfer);
  const terminal=scope.__pawnObservation.terminal;
  assert.equal(terminal.state.eax,0x1234);
  scope.postMessage({t:'error',message:'later'});
  assert.equal(scope.__pawnObservation.terminal,terminal);
  assert.equal(logs.filter(s=>JSON.parse(s.slice('PAWN_OBSERVATION '.length)).kind==='owner-terminal').length,1);
});

test('pending thread-send slices do not falsely latch exit',async()=>{
  const scope={console:{log(){}},performance:{now:()=>0},postMessage(){},
    WebAssembly:{instantiate:async()=>({exports:{set_trace_eip_range(){}}})}};
  installPawnObservation(scope,{control:true});
  await scope.WebAssembly.instantiate(null,{host:{memory:{buffer:new ArrayBuffer(4)},log_eip(){}}});
  scope.postMessage({t:'sliceDone',eip:0,threadSendPending:true});
  assert.equal(scope.__pawnObservation.terminal,null);
});

test('diagnostic sink failures cannot replace broker exceptions or message delivery',async()=>{
  const failure=Error('original broker failure');let delivered=0,wrapped;
  const scope={console:{log(){throw Error('sink');}},performance:{now:()=>0},
    postMessage(){delivered++;return 23;},
    WebAssembly:{instantiate:async(m,i)=>{wrapped=i.host.log_eip;return {exports:{
      set_trace_eip_range(){},get_image_base:()=>0x400000,
    }};}}};
  installPawnObservation(scope,{control:true});
  await scope.WebAssembly.instantiate(null,{host:{memory:{buffer:new ArrayBuffer(4)},
    log_eip(){throw failure;}}});
  assert.throws(()=>wrapped(0x414ffe),e=>e===failure);
  assert.equal(scope.postMessage({t:'error',message:'owner failure'}),23);
  assert.equal(delivered,1);
});
