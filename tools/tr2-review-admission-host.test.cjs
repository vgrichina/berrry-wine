'use strict';
// Exact page-host installation and retained capture/admission chain, offline.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const RenderWorker=require('../lib/render-worker'),crypto=require('node:crypto');
(async()=>{
 const bytes=fs.readFileSync('build/wine-assembly.wasm'),wasmModule=new WebAssembly.Module(bytes);
 const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),imports={host:{memory}};
 for(const i of WebAssembly.Module.imports(wasmModule))if(i.kind==='function')imports.host[i.name]=()=>0;
 const host=fs.readFileSync('host.js','utf8'),a=host.indexOf('    this.instance = await WebAssembly.instantiate(wasmModule, imports);'),b=host.indexOf('    if (this._watAppRequested',a);
 assert(a>0&&b>a);const owner={_d3dimWriterObservation:null};
 await vm.runInNewContext('(async function(){'+host.slice(a,b)+'}).call(owner)',{owner,WebAssembly,wasmModule,imports,RenderWorker});
 assert.equal(typeof owner.instance.exports.run,'function');assert.equal(owner.instance.exports.get_image_base(),0);
 // The actual chain's native startup path reads real installed host/Worker
 // object identity through its unmodified serialized expressions.
 const bound=require('../scratch/runs/20261110-tr2-visible-target-margin-0415/bound-input.cjs');
 const worker={instance:owner.instance,endpointIdentity:7,workerSlot:0,crypto};
 vm.createContext(worker);
 const link={endpointIdentity:7,slot:0,module:wasmModule,worker:{}},renderer={peekKeyDownState:()=>0};
 const wine={running:true,_stopped:false,renderer,processId:1000,guestWorker:{link},instance:owner.instance};
 const page={runningApps:[{name:'tomb_raider_2_demo',wine}],crossOriginIsolated:true,document:{getElementById:()=>renderer},crypto};
 vm.createContext(page);
 const hash=crypto.createHash('sha256').update(bytes).digest('hex');
 const workers=new Map([['worker',{targetId:'worker',sessionId:'worker',url:'guest-worker.js',scripts:[{scriptId:1,bytecodeAvailable:true,sha256:hash}]}]]);
 let clock=1000,dispatch=0,wire=[];
 const chain=bound.createChain({evaluate:async(s,id)=>vm.runInContext(s,id==='worker'?worker:page),send:async m=>{wire.push(m);if(m==='Debugger.getScriptSource')return {bytecode:bytes.toString('base64')};clock+=996;return {data:Buffer.from('offline pixels').toString('base64')};},workers,pageSession:'page',app:'tomb_raider_2_demo',expectedModules:[hash],now:()=>clock});
 const shot=await chain.capture('offline');assert.equal(Date.parse(shot.capture.at),1000);assert.equal(Date.parse(shot.capture.completedAt),1996);
 const review={...shot.capture,review:'OFFLINE authored control'};
 await chain.admit(review,r=>{assert.equal(r.ageMs,996);dispatch++;});assert.equal(dispatch,1);
 clock=13001;await assert.rejects(chain.admit(review,()=>dispatch++),/stale/);assert.equal(dispatch,1);
 assert.equal(wire.filter(m=>m==='Page.captureScreenshot').length,1);
 console.log(JSON.stringify({passed:true,actualHostInstallation:true,actualChain:true,originalCaptureTimestamp:true,staleZeroDispatch:true,native:false}));
})().catch(e=>{console.error(e);process.exitCode=1;});
