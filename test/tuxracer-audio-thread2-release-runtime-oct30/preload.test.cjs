'use strict';
const vm=require('vm'),fs=require('fs'),assert=require('assert');
const calls=[];let exitHandler;
class ThreadManager {
  constructor() { this.syncView=new Int32Array([0xe0004,3,2,1]); this.threads=new Map();
    this.mainInstance={exports:{get_wait_handle:()=>0xe0004}}; }
  _getSyncIdx(h) { return h===0xe0004 ? 0 : -1; }
  currentWin32ThreadId() { return 2; }
  waitSingle(...args) { calls.push(['wait',this,args]);return 0x102; }
  releaseMutex(...args) { calls.push(['release',this,args]);this.syncView[2]=0;this.syncView[3]=0;return 1; }
  runSlice(...args) { calls.push(['slice',this,args]);return {steps:7,blocks:3,threadsRun:1}; }
}
const saved=[];const mod={prototype:{_compile(s,f){saved.push([s,f]);return 19;}}};
const context={require:n=> n==='fs' ? {writeFileSync:(...a)=>saved.push(a)} : n==='module' ? mod : n==='path' ? require('path') : {ThreadManager},
  __dirname:'/owned',process:{cwd:()=>'/runtime',on:(n,f)=>{assert.equal(n,'exit');exitHandler=f;}},console};
vm.runInNewContext(fs.readFileSync(__dirname+'/boundary-preload.cjs','utf8'),context);
const m=new ThreadManager();const waitArgs=[0xe0004,0,1,{id:8}];
assert.equal(m.waitSingle(...waitArgs),0x102);assert.equal(calls.length,1);assert.equal(calls[0][1],m);assert.deepEqual(calls[0][2],waitArgs);
assert.equal(m.releaseMutex(0xe0004,2),1);assert.equal(calls.length,2);assert.equal(m.syncView[2],0);
assert.equal(m.runSlice(37).steps,7);assert.equal(calls.length,3);
assert.equal(context.__audioBoundarySnapshot().counts['releaseMutex:917508:2:1'],1);
const marker='dv.setUint32(waveHdrWA + 16, (flags | 1) & ~0x10, true);';
const source=marker+'const submission=_trackWaveOutHeader(handle, waveHdrWA, waveHdrGA);';
assert.equal(mod.prototype._compile(source,'/runtime/lib/host-audio.js'),19);
assert(saved[0][0].includes("__audioBoundary('wave-done'"));
assert.throws(()=>mod.prototype._compile(marker,'/runtime/lib/host-audio.js'),/marker identity/);
exitHandler();assert.equal(JSON.parse(saved[1][1]).observationOnly,true);
console.log('PASS: original calls, receivers, args and results preserved; exact audio markers required; trace persisted');
