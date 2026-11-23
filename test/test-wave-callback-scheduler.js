'use strict';
// Runs the actual host _runThreaded step, replacing only transport/environment.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const {ThreadManager}=require('../lib/thread-manager');
const source='../host.js';
const context={console,setTimeout,clearTimeout,performance,
 require:require('module').createRequire(require.resolve('../host'))};
vm.runInNewContext(fs.readFileSync(__dirname+'/'+source,'utf8')+'\n;globalThis.WineAssembly=WineAssembly;',context);
async function oneStep(pending,yieldReason) {
 const wine=new context.WineAssembly(), calls={slice:0,resolve:0,complete:0,load:0};
 let finish;const completed=new Promise(resolve=>{finish=resolve;});
 const timer=setTimeout(()=>finish(new Error('actual step failed to finish within 1000ms')),1000);
 // No sibling threads: only the main Worker transport and sync-table export
 // need stand-ins; host-step lifetime and wait resolution use the real manager.
 const memory={buffer:new SharedArrayBuffer(65536)};
 wine.guestWorker={link:{_waveOffer:pending?{token:1}:null,completeWait:async()=>{calls.complete++;}},slice:async()=>{calls.slice++;return result;}};
 const manager=wine.threadManager=new ThreadManager(null,memory,{exports:{get_sync_table:()=>0}},null,{workerBackend:wine.guestWorker});
 const resolveMainWorkerWait=manager.resolveMainWorkerWait.bind(manager);
 manager.resolveMainWorkerWait=(...args)=>{calls.resolve++;return resolveMainWorkerWait(...args);};
 const result={eip:0x401000,yield:yieldReason,blocks:0,ms:0,waitHandle:manager.createEvent(false,true),waitStackBytes:12};
 wine._workerLastSlice=result;
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
