'use strict';
const assert=require('assert');
const {ThreadManager}=require(process.argv[2]);
const expectOriginal=process.argv.includes('--original');
function fixture(options={}) {
  const m=Object.create(ThreadManager.prototype), s={yield:1,handle:0xe0004,ptr:0,stack:12,...options};
  m.syncView=new Int32Array([0xe0004,3,2,1]);
  m._getSyncIdx=h=>h===0xe0004 ? 0 : -1;
  m._issuedAuthorityEvents=new Set();m._renderSendTargets=new Set();
  m._waitNow=()=>10;m.noteMainSleep=()=>{};m._wakeWaitersSoon=()=>{};
  m.mainInstance={exports:{get_yield_reason:()=>s.yield,get_wait_handle:()=>s.handle,
    get_wait_handles_ptr:()=>s.ptr,get_wait_timeout:()=>0xffffffff,get_wait_stack_bytes:()=>s.stack}};
  m._completeWait=(e,result,bytes)=>{assert.equal(e,m.mainInstance.exports);assert.equal(result,0);assert.equal(bytes,12);s.yield=0;s.completed=(s.completed||0)+1;return 0x1234;};
  return {m,s};
}
{
  const {m,s}=fixture();assert.equal(m.releaseMutex(0xe0004,2),1);
  if(expectOriginal) {assert.equal(m.syncView[2],0);assert.equal(s.completed,undefined);assert.equal(m.waitSingle(0xe0004,0,2),0);console.log('Original reproduces release/reacquire before main polls');}
  else {assert.equal(m.syncView[2],1);assert.equal(m.syncView[3],1);assert.equal(s.completed,1);assert.equal(m.waitSingle(0xe0004,0,2),0x102);assert.equal(m.waitSingle(0xe0004,0,1),0);assert.equal(m.syncView[3],2);assert.equal(m.releaseMutex(0xe0004,1),1);assert.equal(m.syncView[3],1);assert.equal(m.releaseMutex(0xe0004,1),1);assert.equal(m.waitSingle(0xe0004,0,2),0);}
}
for(const settings of [{yield:0},{handle:0xe0005},{ptr:0x4000},{stack:20}]) {
  const {m,s}=fixture(settings);assert.equal(m.releaseMutex(0xe0004,2),1);assert.equal(s.completed,undefined);assert.equal(m.syncView[2],0);
}
{
  const {m,s}=fixture();m.workerBackend={};assert.equal(m.releaseMutex(0xe0004,2),1);assert.equal(s.completed,undefined);
}
{
  const {m,s}=fixture();m.syncView[3]=2;assert.equal(m.releaseMutex(0xe0004,2),1);assert.equal(m.syncView[3],1);assert.equal(m.syncView[2],2);assert.equal(s.completed,undefined);
  assert.equal(m.releaseMutex(0xe0004,1),0);assert.equal(m.releaseMutex(0xe0005,2),-1);assert.equal(m.syncView[2],2);
}
console.log('PASS: release ownership/recursion/errors; worker and nonmatching waits unchanged; ordinary main completion boundary');
