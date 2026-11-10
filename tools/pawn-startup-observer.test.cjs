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

test('surface snapshot reads owning map, flags, owner and token without changing GPU results',async()=>{
  const buffer=new ArrayBuffer(0x440000),dv=new DataView(buffer);
  const BASE={DX_OBJECTS:0x1000,COM_WRAPPERS:0x90000,GUEST_BASE:0};
  const put=(p,v)=>dv.setUint32(p,v,true),surface=0x426000;
  put(0x423fc0,surface);put(surface+4,2);
  put(BASE.DX_OBJECTS+64,2);put(BASE.DX_OBJECTS+64+28,0x48000000);
  put(BASE.DX_OBJECTS+32,20);put(BASE.DX_OBJECTS+32+8,2);put(BASE.DX_OBJECTS+32+20,0x428000);
  let imports,calls=0;const sentinel=Error('native GPU error');
  const scope={RegionMap:{BASE},console:{log(){}},performance:{now:()=>0},
    WebAssembly:{instantiate:async(m,i)=>{imports=i;return {exports:{
      guest_to_wasm:p=>p,get_image_base:()=>0x400000,get_esp:()=>0x700,
      get_d3d_render_token:()=>77,set_trace_eip_range(){},
    }};}}};
  installPawnObservation(scope,{control:true});
  const receiver={};
  await scope.WebAssembly.instantiate(null,{host:{memory:{buffer},log_eip(){},
    gpu_gl_call:function(...args){assert.equal(this,receiver);calls++;if(args[0]===9)throw sentinel;return -22;}}});
  imports.host.log_eip(0x415012);
  const s=scope.__pawnObservation.records.find(r=>r.kind==='boundary'&&r.pc===0x415012).surfaceState;
  assert.equal(s.slot,2);assert.equal(s.token,77);assert(s.lockable&&s.dcHeld);
  assert.equal(s.owners.length,1);assert.equal(s.owners[0].slot,1);
  assert.equal(imports.host.gpu_gl_call.call(receiver,0x30007,0,77),-22);
  assert.throws(()=>imports.host.gpu_gl_call.call(receiver,9),e=>e===sentinel);
  assert.equal(calls,2);
  assert.equal(scope.__pawnObservation.records.filter(r=>r.kind==='surface-transfer').length,1);
});
