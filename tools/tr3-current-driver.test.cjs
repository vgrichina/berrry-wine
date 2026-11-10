'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),Module=require('node:module'),crypto=require('node:crypto');
const helper=require('./tr3-current-driver.cjs'),root=path.resolve(__dirname,'..');
const source=helper.compose(root),boundSource=helper.composeBound(root),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const run=process.argv[2];if(run){assert.equal(fs.readFileSync(run+'/browser-run.cjs','utf8'),source);assert.equal(fs.readFileSync(run+'/bound-input.cjs','utf8'),boundSource);}
const m=new Module(path.join(root,'scratch/runs/control/bound-input.cjs'));m.filename=path.join(root,'scratch/runs/control/bound-input.cjs');m.paths=module.paths;m._compile(boundSource,m.filename);const bound=m.exports;
(async()=>{
 // Admission and the actual independently released executor agree for Jump.
 require('./native-key-controls.cjs').validate('Alt',50);
 const wire=[];const held=await bound.hold({send:async(m,p)=>wire.push(p),session:'page',keys:['Alt'],holdMs:50,sample:async()=>{await new Promise(r=>setTimeout(r,90));return {};}});
 assert.deepEqual(wire.map(p=>({...p})),[{type:'keyDown',key:'Alt',code:'AltLeft',windowsVirtualKeyCode:18},{type:'keyUp',key:'Alt',code:'AltLeft',windowsVirtualKeyCode:18}]);
 assert(held.releaseAt-held.started<85);assert.equal(held.samples[0].whollyDuringHold,false);
 let invalidEffects=0;for(const ms of [0,49,2001,3500,-1,100.5])await assert.rejects(bound.hold({send:()=>invalidEffects++,session:'p',keys:['Alt'],holdMs:ms,sample:async()=>({})}));assert.equal(invalidEffects,0);
 // Execute the exact emitted action, through ordinary admission and hold.
 const begin=source.indexOf('async function execute(c,markDispatch)'),end=source.indexOf('\n(async()=>{',begin);
 for(const stale of [false,true]){
  const effects=[],latest={label:'before',sha256:'image'};
  const scope={require:n=>n==='./ordinary-keys.cjs'?require('./native-key-controls.cjs'):require(n),assert,Date,deadline:Date.now()+10000,latest,
   fs:{readFileSync:()=>JSON.stringify({...latest,review:'standing Lara at terrain edge'})},sha:()=>latest.sha256,out:'.',pageSession:'p',
   bound,save(){},log(){},send:async(m,p)=>effects.push(p.type),wait:async()=>{},capture:async()=>effects.push('capture'),
   chain:{nativeMode:false,admit:async(r,f)=>{if(stale)throw Error('stale');return f({live:{identity:{}}});},progress:async()=>({})}};
  vm.createContext(scope);vm.runInContext(source.slice(begin,end)+';globalThis.execute=execute;',scope);
  const result=scope.execute({action:'key',key:'Alt',holdMs:50,waitMs:0,id:'jump',label:'after',reviewRef:'before'},()=>{});
  if(stale)await assert.rejects(result,/stale/);else await result;
  assert.deepEqual(effects,stale?[]:['keyDown','keyUp','capture']);
 }
 // Exact emitted failure latch blocks every later kind of protocol request.
 const a=source.indexOf('let terminalError=null;'),b=source.indexOf('\nasync function event(v)',a);let kills=0;const sent=[];
 const scope={Error,Date,Map,clearTimeout(){},setTimeout:()=>1,save(){},process:{ppid:123,kill:(pid,s)=>{assert.equal(pid,123);assert.equal(s,'SIGTERM');kills++;}},ws:{send:v=>sent.push(v)}};
 vm.createContext(scope);vm.runInContext(source.slice(a,b)+';globalThis.api={fail,send,evaluate};',scope);scope.api.fail(Error('first failure'));
 for(const method of ['Runtime.evaluate','Input.dispatchKeyEvent','Page.captureScreenshot','Browser.close'])await assert.rejects(scope.api.send(method),/first failure/);
 scope.api.fail(Error('second'));assert.equal(kills,1);assert.equal(sent.length,0);
 // Execute the current production Worker installation with the current module,
 // load the original TR3 PE, then read the unchanged caller owner sampler.
 const bytes=fs.readFileSync(root+'/build/wine-assembly.wasm'),mod=new WebAssembly.Module(bytes),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),imports={host:{memory}};
 for(const i of WebAssembly.Module.imports(mod))if(i.kind==='function')imports.host[i.name]=()=>0;
 const worker={WebAssembly,selectedModule:mod,built:{imports},instance:null,memory,crypto,endpointIdentity:1,workerSlot:0};vm.createContext(worker);
 const original=fs.readFileSync(root+'/lib/guest-worker.js','utf8'),x=original.indexOf('const result = await WebAssembly.instantiate(selectedModule, built.imports);'),y=original.indexOf('if (quake2LoadObservation) instance =',x);
 assert(x>=0&&y>x);await vm.runInContext('(async()=>{'+original.slice(x,y)+'})()',worker);
 const e=worker.instance.exports,pe=require('../lib/pe').readPE(path.join(root,require('../lib/apps.js').APPS.tomb_raider_3_demo.exe));
 new Uint8Array(memory.buffer).set(pe.buf,e.get_staging());assert(e.load_pe(pe.buf.length));
 const owner=vm.runInContext(bound.WORKER_READ,worker);assert.equal(owner.endpointIdentity,1);assert.equal(owner.slot,0);assert.equal(vm.runInContext(bound.WORKER_READ,worker).instance,owner.instance);
 const installed=worker.instance;worker.instance={exports:e};assert.notEqual(vm.runInContext(bound.WORKER_READ,worker).instance,owner.instance);worker.instance=installed;
 console.log(JSON.stringify({passed:true,exactEmittedCaller:true,altAdmissionExecution:true,independentRelease:true,invalidDurationsZeroEffects:true,staleZeroEffects:true,firstFailureOwningCancel:true,noLaterProtocol:true,currentInstalledWorker:true,originalTR3PE:true,moduleSha256:sha(bytes),exeSha256:sha(pe.buf),browser:false}));
})().catch(e=>{console.error(e);process.exitCode=1;});
