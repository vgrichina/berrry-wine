'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {installUserReturnObserver:install,userReturnOverlay}=require('../tools/hexen2-startup-trace.cjs');
function fixture(record) {
  const buffer=new SharedArrayBuffer(1024),bytes=new Uint8Array(buffer),encoder=new TextEncoder();
  bytes.set(encoder.encode('ExitProcess\0'),0);
  const sentinel={},failure=Error('original callback'),events=[];
  let current=null,retired=false;
  const h={log:function(...args){events.push(['log',this,args]);retired=true;return sentinel;}};
  const scope={withActor:function(slot,name,fn){const previous=current;current={slot,name};try{return fn();}finally{current=previous;}}};
  const owner={memory:{buffer},instance:{exports:{guest_read32:p=>{assert(!retired,'snapshot before retirement');return p;}}}};
  const args=[9,1,80,2,0,...[1,2,3,4,5,6,7,8,9,10],128];
  let oldCalls=0;
  // Reproduce the original installation order: a diagnostic wrapper is lost.
  h.input_consumed=()=>{oldCalls++;return 77;};
  Object.defineProperty(h,'browserInputScope',{value:scope});
  h.input_consumed=function(...a){events.push(['consumed',this,a,current]);if(a[0]===-1)throw failure;return sentinel;};
  return {h,scope,owner,args,sentinel,failure,events,oldCalls:()=>oldCalls,current:()=>current,record};
}
test('old wrapper overwritten; final observer survives registration, SharedArrayBuffer, scoped return and retirement',()=>{
  const rows=[],f=fixture(r=>rows.push(r));install(f.h,f.owner,f.record);
  const descriptor=Object.getOwnPropertyDescriptor(f.h,'browserInputScope');
  assert.equal(descriptor.value,f.scope);assert.equal(descriptor.enumerable,false);
  const receiver={};
  const returned=f.scope.withActor(7,'input_consumed',()=>f.h.input_consumed.apply(receiver,f.args));
  assert.equal(returned,f.sentinel);assert.equal(f.oldCalls(),0);assert.equal(f.current(),null);
  assert.equal(f.events[0][1],receiver);assert.deepEqual(f.events[0][2],f.args);
  const actual=rows.find(r=>r.kind==='native-user-return');
  assert.equal(actual.result,f.sentinel);assert.deepEqual(actual.actor,{slot:7,name:'input_consumed'});
  assert.equal(actual.apiKind,2);assert.equal(actual.remove,0);assert.equal(actual.token,9);
  assert.equal(f.scope.withActor(7,'log',()=>f.h.log.call(receiver,0,12,200,0x44efcf,...Array(8).fill(0))),f.sentinel);
  const exit=rows.find(r=>r.kind==='guest-pre-exit');
  assert.equal(exit.words.length,64);assert.equal(exit.words[63],452);assert.equal(exit.return,0x44efcf);
  assert.deepEqual(exit.actor,{slot:7,name:'log'});assert.equal(exit.calls.length,1);
  assert.equal(f.events[1][1],receiver);assert.equal(f.current(),null);
});
test('nested actor scopes and original exceptions are exact; diagnostic error stops only logging',()=>{
  const rows=[],f=fixture(r=>rows.push(r));install(f.h,f.owner,f.record);
  f.scope.withActor(2,'outer',()=>{
    assert.throws(()=>f.scope.withActor(7,'input_consumed',()=>f.h.input_consumed(-1)),e=>e===f.failure);
    assert.deepEqual(f.current(),{slot:2,name:'outer'});
    f.h.input_consumed(...f.args);
  });
  assert.deepEqual(rows.at(-1).actor,{slot:2,name:'outer'});assert.equal(f.current(),null);
  // Invalid shared-memory metadata cannot prevent the original log callback.
  assert.equal(f.h.log(2000,12),f.sentinel);
  assert.equal(rows.at(-1).kind,'observer-stop');const count=rows.length;
  assert.equal(f.h.input_consumed(...f.args),f.sentinel);assert.equal(rows.length,count);
  const g=fixture(()=>{throw Error('writer failed');});install(g.h,g.owner,g.record);
  assert.equal(g.h.input_consumed(...g.args),g.sentinel);
});
test('finite event bound stops observation while original callbacks continue',()=>{
  const rows=[],f=fixture(r=>rows.push(r));install(f.h,f.owner,f.record);
  for(let i=0;i<160;i++)assert.equal(f.h.input_consumed(...f.args),f.sentinel);
  assert.equal(rows.length,129);assert.equal(rows.at(-1).kind,'observer-stop');assert.equal(f.events.length,160);
});
test('overlay uses actual final factory return after later registration and wrappers',()=>{
  const source=fs.readFileSync(require.resolve('../host.js'),'utf8'),patched=userReturnOverlay(source);
  assert(patched.indexOf('(function installUserReturnObserver')>patched.indexOf('h.input_consumed='));
  assert(patched.indexOf('(function installUserReturnObserver')>patched.indexOf('for (const [name, fn] of Object.entries(h))'));
  new vm.Script(patched);
  assert.throws(()=>userReturnOverlay(source.replace('h.input_consumed=','h.different=')),/installation point/);
  // Execute the same generated injection at a real late-assignment factory.
  const ret='    return { host: h, gdi: base.gdi, __captureWin16FarFault: captureWin16FarFault };';
  const fixtureSource=`(()=>{const h={log(){return 42},input_consumed(){throw Error('overwritten')}};
    const base={gdi:{}},captureWin16FarFault=null;
    Object.defineProperty(h,'browserInputScope',{value:{withActor(s,n,fn){return fn()}}});
    h.input_consumed=()=>73;
    for (const [name, fn] of Object.entries(h)) if(typeof fn==='function')h[name]=function(...a){return fn.apply(this,a)};
${ret}})()`;
  const rows=[],buffer=new SharedArrayBuffer(1024);
  const result=vm.runInNewContext(userReturnOverlay(fixtureSource),{self:{memory:{buffer}},TextDecoder,Uint8Array,DataView,Date,console:{log:(tag,row)=>rows.push(JSON.parse(row))}});
  assert.equal(result.host.input_consumed(9,1,80,2,0,...Array(10).fill(1),128),73);
  assert.equal(rows.at(-1).kind,'native-user-return');assert.equal(rows.at(-1).result,73);
});
test('Worker observes its actual EAX and caller after the callback, retains idle returns and pre-exit stack',()=>{
  const {installWorkerUserObserver,workerUserReturnOverlay}=require('../tools/hexen2-startup-trace.cjs');
  const buffer=new SharedArrayBuffer(1024),rows=[],events=[],receiver={},failure=Error('original log');
  let eax=1,name='GetMessageA';
  const setName=n=>{name=n;new Uint8Array(buffer).fill(0,0,128);new Uint8Array(buffer).set(new TextEncoder().encode(n));};
  const h={log:function(...a){events.push([this,...a]);if(a[0]===999)throw failure;return 17;},log_api_exit:function(...a){events.push([this,...a]);return 19;}};
  const e={get_esp:()=>200,get_eax:()=>eax,get_eip:()=>0x439a99,guest_read32:p=>p===200?0x439a97:p};
  installWorkerUserObserver(h,{buffer},()=>e,3,r=>rows.push(r));
  for(const value of [1,0]){eax=value;setName('GetMessageA');assert.equal(h.log.call(receiver,0,name.length),17);assert.equal(h.log_api_exit.call(receiver,77),19);}
  setName('ExitProcess');assert.equal(h.log.call(receiver,0,name.length),17);
  const exit=rows.at(-1);assert.equal(exit.kind,'worker-pre-exit');assert.equal(exit.words.length,64);
  assert.deepEqual(exit.returns.map(r=>r.eax),[1,0]);assert.equal(exit.returns[1].eip,0x439a99);
  assert.equal(exit.entry.return,0x439a97);assert.equal(exit.slot,3);assert(events.every(r=>r[0]===receiver));
  assert.throws(()=>h.log(999,12),err=>err===failure);
  const patched=workerUserReturnOverlay(fs.readFileSync(require.resolve('../lib/guest-rpc.js'),'utf8'));
  new vm.Script(patched);assert(patched.includes('(function installWorkerUserObserver'));
});
