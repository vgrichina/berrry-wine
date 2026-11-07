'use strict';
// Runs the actual host _runThreaded step, replacing only transport/environment.
// The control uses the immutable host snapshot immediately before this guard.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source='../host.js';
const context={console,setTimeout,clearTimeout,performance};
vm.runInNewContext(fs.readFileSync(__dirname+'/'+source,'utf8')+'\n;globalThis.WineAssembly=WineAssembly;',context);
async function oneStep(pending,yieldReason) {
 const wine=new context.WineAssembly(), calls={slice:0,resolve:0,complete:0,load:0};
 let finish;const completed=new Promise(resolve=>{finish=resolve;});
 const timer=setTimeout(()=>finish(new Error('actual step failed to finish within 1000ms')),1000);
 const result={eip:0x401000,yield:yieldReason,blocks:0,ms:0,waitHandle:0xe0001,waitStackBytes:12};
 wine._workerLastSlice=result;
 wine.guestWorker={link:{_waveOffer:pending?{token:1}:null,completeWait:async()=>{calls.complete++;}},slice:async()=>{calls.slice++;return result;}};
 wine.threadManager={backend:'worker',startPendingWorkers:async()=>0,runWorkerSlices:async()=>0,workerSyncState:()=>({}),publishWorkerThunkState:()=>{},resolveMainWorkerWait:()=>{calls.resolve++;return {result:0,waitStackBytes:12};}};
 for(const name of ['_frozenRegister','_installVisibilityPause','_installInputWake','_beginGuestTickBatch','_presentAtBoundary']) wine[name]=()=>{};
 wine._maybePauseForHidden=()=>false;
 wine._pumpWaveCallbacksAtBoundary=async()=>{};
 wine._handleLoadLibraryThreaded=async()=>{calls.load++;};
 wine._scheduleStep=()=>{wine.running=false;finish();};
 const errors=[];wine.logToUI=x=>errors.push(x);wine.stop=()=>{wine.running=false;finish(new Error(errors.join('\n')));};
 wine._runThreaded(1000);
 const error=await completed;clearTimeout(timer);if(error)throw error;
 assert.equal(errors.length,0,errors.join('\n'));return calls;
}
(async()=>{
 const ambiguous=await oneStep(true,1);
 assert.equal(ambiguous.resolve,0,'pending offer must not poll/consume the interrupted wait');
 assert.equal(ambiguous.complete,0,'pending offer must not complete stale wait over callback ESP');
 assert.equal(ambiguous.slice,0,'ambiguous offer must not run the owner');
 assert.equal((await oneStep(true,5)).load,0,'no stale loader action during unresolved offer');
 const normal=await oneStep(false,1);
 assert.equal(normal.slice,1);assert.equal(normal.resolve,1);assert.equal(normal.complete,1,'normal signaled wait still completes');
 console.log('PASS actual scheduler step: ambiguous offer preserves interrupted frame; normal wait still completes');
})().catch(error=>{console.error(error);process.exitCode=1;});
