'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const context={console,setTimeout,clearTimeout,
 require:require('module').createRequire(require.resolve('../host'))};vm.runInNewContext(fs.readFileSync(__dirname+'/../host.js','utf8')+'\n;globalThis.WineAssembly=WineAssembly;',context);
(async()=>{
 const wine=new context.WineAssembly(),stream={handle:17,generation:1,callback:0x401000,instance:123};let offers=0;
 const link={worker:{},waveRegistrations:new Map([[17,stream]]),offerWaveCallback:async()=>{offers++;return {status:'accepted'};}};
 const backend={link:{},threadLinks:new Map([[1,link]])},thread={state:'active',suspendCount:1,inFlight:false,link,waitStartedAt:77,waitPolls:8};
 wine.running=true;wine.guestWorker=backend;wine.threadManager={threads:new Map([[33,thread]])};wine._wakeStep=()=>{};
 const owner={kind:'worker',backend,slot:1,link:null},registration={handle:17,callback:0x401000,instance:123,owner,retired:false},item={registration,waveHdrGA:0x500000};
 assert.equal((await wine._offerWaveCallback(item)).status,'busy','suspension retains callback for ResumeThread');assert.equal(offers,0);
 thread.suspendCount=0;thread.inFlight=true;assert.equal((await wine._offerWaveCallback(item)).status,'busy');assert.equal(offers,0);
 thread.inFlight=false;thread.parkedWaitDone={result:0};assert.equal((await wine._offerWaveCallback(item)).status,'busy','already consumed wait signal must be completed first');thread.parkedWaitDone=null;
 thread.state='exited';assert.equal((await wine._offerWaveCallback(item)).status,'retired');assert.equal(offers,0);
 thread.state='active';backend.threadLinks.set(1,{...link,worker:{}});assert.equal((await wine._offerWaveCallback(item)).status,'retired','recycled slot cannot inherit registration');assert.equal(offers,0);
 backend.threadLinks.set(1,link);link.waveRegistrations.set(17,{...stream,generation:2});assert.equal((await wine._offerWaveCallback(item)).status,'retired','reopened same handle cannot inherit notification');assert.equal(offers,0);
 const mainLink={worker:{},waveRegistrations:new Map([[17,stream]]),offerWaveCallback:async()=>{throw Error('suspended main must not be offered');}};
 backend.link=mainLink;wine._workerLastSlice={eip:0x401000,yield:1};wine.threadManager.isMainThreadSuspended=()=>true;
 assert.equal((await wine._offerWaveCallback({registration:{handle:17,callback:stream.callback,instance:123,owner:{kind:'worker',backend,slot:0}},waveHdrGA:0x500000})).status,'busy','suspended main Worker retains notification');
 const ex={fire_wave_out_callback_bound:()=>{throw Error('suspended cooperative owner must not run');}};wine.instance={exports:ex};
 assert.equal((await wine._offerWaveCallback({registration:{handle:17,callback:stream.callback,instance:123,owner:{kind:'cooperative',exports:ex,tid:0}},waveHdrGA:0x500000})).status,'busy','suspended cooperative main retains notification');
 console.log('PASS actual browser owner admission: suspended/inflight/consumed wait retained; exited/replaced/reopened owner retired');
})().catch(e=>{console.error(e);process.exitCode=1;});
