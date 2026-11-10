'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),Module=require('node:module'),crypto=require('node:crypto');
const helper=require('./tr3-current-driver.cjs'),root=path.resolve(__dirname,'..');
const source=helper.compose(root),boundSource=helper.composeBound(root),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const run=process.argv[2];if(run){assert.equal(fs.readFileSync(run+'/browser-run.cjs','utf8'),source);assert.equal(fs.readFileSync(run+'/bound-input.cjs','utf8'),boundSource);}
const m=new Module(path.join(root,'scratch/runs/control/bound-input.cjs'));m.filename=path.join(root,'scratch/runs/control/bound-input.cjs');m.paths=module.paths;m._compile(boundSource,m.filename);const bound=m.exports;
(async()=>{
 // Run the actual composed startup caller. Diagnostics may fail or remain
 // pending forever; neither is awaited by the endpoint loop or failure latch.
 const startup=source.slice(source.indexOf(' function launcherDiagnostics('),source.indexOf(' ws=new WebSocket'));
 const latch=source.slice(source.indexOf('let terminalError=null;'),source.indexOf('\nasync function event(v)'));
 for(const diagnosticMode of ['reject','pending'])for(const readyAt of [0,9900,Infinity]){
  let elapsed=0,waits=0,kills=0,spawned;const saved={},sent=[];
  const io=new Proxy({},{get:()=>()=>diagnosticMode==='pending'?new Promise(()=>{}):Promise.reject(Object.assign(Error('diagnostic denied'),{code:'EACCES'}))});
  const out='/actual/run/webgl',active=out+'/chrome-profile/DevToolsActivePort';
  const scope={Error,Date,Map,Set,Buffer,Number,Promise,path,crypto,clearTimeout(){},setTimeout:()=>1,
   process:{ppid:123,kill:(p,s)=>{assert.equal(p,123);assert.equal(s,'SIGTERM');kills++;}},
   cp:{spawn:(exe,args,options)=>{spawned={exe,args,options};return {pid:456,once(){}};}},
   fs:{promises:io,openSync:()=>9,existsSync:p=>{assert.equal(p,active);return elapsed>=readyAt;},readFileSync:(p,enc)=>{assert.equal(p,active);assert.equal(enc,'utf8');if(elapsed<readyAt)throw Error('first endpoint ENOENT');return '12345\n/devtools/browser/control\n';}},
   save:(n,v)=>saved[n]=v,ws:{send:v=>sent.push(v)},out,port:777,deadline:Date.now()+30000,wait:async ms=>{assert.equal(ms,100);elapsed+=ms;waits++;}};
  vm.createContext(scope);vm.runInContext(latch+';globalThis.api={fail,send};',scope);
  try{await vm.runInContext('(async()=>{'+startup+'})()',scope);}catch(e){scope.api.fail(e);}
  assert.equal(spawned.exe,'/usr/bin/google-chrome');
  assert.deepEqual(Array.from(spawned.args),['--headless=new','--no-sandbox','--no-first-run','--no-default-browser-check','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--remote-debugging-port=0','--user-data-dir='+out+'/chrome-profile','about:blank']);
  assert.equal(waits,readyAt===Infinity?100:readyAt/100);assert.equal(kills,readyAt===Infinity?1:0);
  if(readyAt===Infinity){for(const method of ['Runtime.evaluate','Input.dispatchKeyEvent','Page.captureScreenshot','Browser.close'])await assert.rejects(scope.api.send(method),/first endpoint ENOENT/);scope.api.fail(Error('later diagnostic failure'));assert.equal(kills,1);}
  else assert.equal(saved['endpoint.json'].debugPort,12345);
  assert.equal(sent.length,0);
 }
 // Successful read-only observations pin remote bytes and process identity;
 // large executables are statted without reading them into the diagnostic.
 {
  const writes={},reads=[];const contents=p=>Buffer.from(p.endsWith('/cmdline')?'bash\0/remote/wrapper\0':p.endsWith('/children')?'':p.endsWith('/stat')?'456 (bash) S 123':p.endsWith('/wchan')?'do_wait':'remote helper bytes');
  const io={lstat:async()=>({isSymbolicLink:()=>false}),realpath:async p=>p==='/usr/bin/google-chrome'?'/remote/wrapper':p,
   stat:async p=>({size:p.endsWith('/chrome')?1000000:contents(p).length,dev:1,ino:2,isFile:()=>true}),
   open:async p=>{reads.push(p);return {read:async b=>{assert.equal(b.length,65536);const v=contents(p);v.copy(b);return {bytesRead:v.length};},close:async()=>{}};},
   readlink:async()=>'/usr/bin/bash',readdir:async()=>['DevToolsActivePort'],writeFile:async(p,v)=>{writes[p]=JSON.parse(v);}};
  const scope={Buffer,Set,Number,Date};vm.createContext(scope);
  const start=source.indexOf(' function launcherDiagnostics('),end=source.indexOf('\n browser=cp.spawn(',start);
  vm.runInContext(source.slice(start,end)+';globalThis.diagnostics=launcherDiagnostics;',scope);
  const observe=scope.diagnostics({promises:io},path,crypto,'/evidence',456,()=>false);observe(0);
  await new Promise(r=>setImmediate(r));
  assert.equal(writes['/evidence/launcher-identity.json'].launcher.sha256,sha(Buffer.from('remote helper bytes')));
  assert.equal(writes['/evidence/launcher-process-0.json'].rows[0].exe,'/usr/bin/bash');
  assert.deepEqual(writes['/evidence/launcher-process-0.json'].rows[0].cmdline,['bash','/remote/wrapper','']);
  assert(!reads.includes('/remote/chrome'));assert(writes['/evidence/launcher-identity.json'].helpers.some(x=>x.path==='/remote/betterchromium-timezone.sh'&&x.sha256));
 }
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
 console.log(JSON.stringify({passed:true,exactEmittedCaller:true,endpoint100x100ms:true,diagnosticRejectAndPendingCannotDelayCancel:true,altAdmissionExecution:true,independentRelease:true,invalidDurationsZeroEffects:true,staleZeroEffects:true,firstFailureOwningCancel:true,noLaterProtocol:true,currentInstalledWorker:true,originalTR3PE:true,moduleSha256:sha(bytes),exeSha256:sha(pe.buf),browser:false}));
})().catch(e=>{console.error(e);process.exitCode=1;});
