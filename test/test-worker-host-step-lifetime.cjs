'use strict';
const assert=require('node:assert/strict');
const {ThreadManager}=require('../lib/thread-manager');
function fixture(){
 const m=Object.create(ThreadManager.prototype),backend={};
 Object.assign(m,{workerBackend:backend,workerFreeRun:true,serialSlices:false,
  _freeRunSliceSize:1000,_freeRunStepAt:Date.now()-1000,_waitNow:Date.now,
  threads:new Map([[1,{parkedWait:{}}]]),workerSyncState:()=>({}),_workerSkipReason:()=>null});
 return {m,backend};
}
{
 const {m}=fixture();let slices=0,live=true;
 m._freeRunDispatch=()=>slices++;
 assert.equal(m.offerSatisfiedWaiters(),0,'stale absent host step stays stopped');
 const end=m.beginWorkerHostStep(()=>live),originalAt=m._freeRunStepAt;
 assert.equal(m.offerSatisfiedWaiters(),1,'active long rendezvous still offers satisfied waiters');
 assert.equal(slices,1);assert.equal(m._freeRunStepAt,originalAt,'activity never renews a clock');
 live=false;assert.equal(m.offerSatisfiedWaiters(),0,'paused host refuses immediately');
 live=true;m.workerBackend._stopping=true;assert.equal(m.offerSatisfiedWaiters(),0);
 delete m.workerBackend._stopping;m.workerBackend._stopped=true;assert.equal(m.offerSatisfiedWaiters(),0);
 delete m.workerBackend._stopped;
 const backend=m.workerBackend;m.workerBackend={};assert.equal(m.offerSatisfiedWaiters(),0,'replacement backend cannot inherit activity');
 m.workerBackend=backend;assert.throws(()=>m.beginWorkerHostStep(()=>true),/already active/);
 end();assert.equal(m.offerSatisfiedWaiters(),0,'completion ends activity');
 const next=m.beginWorkerHostStep(()=>true);end();assert.equal(m.offerSatisfiedWaiters(),1,'old completion cannot end a new step');
 next();assert.equal(m.offerSatisfiedWaiters(),0);
 m._freeRunStepAt=Date.now();assert.equal(m.offerSatisfiedWaiters(),1,'existing recent-step fallback retained');
}
async function continuation(){
 const {m}=fixture(),thread={};m.threads=new Map([[1,thread]]);
 let runs=0,release;const done=new Promise(resolve=>release=resolve);
 m._runWorkerThread=async()=>{runs++;if(runs===1)await done;else m.workerFreeRun=false;};
 const end=m.beginWorkerHostStep(()=>true);
 m._freeRunDispatch(1,thread,1000,{});release();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(runs,2,'ordinary completion redispatches past stale step while rendezvous is active');
 assert.equal(thread.freeRunPending,false);end();
}
continuation().then(()=>console.log('PASS explicit host-step lifetime; redispatch and satisfied waits; pause/stop/replacement/end/idempotent cleanup; no clock renewal'))
 .catch(e=>{console.error(e);process.exitCode=1;});
