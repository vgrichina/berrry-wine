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
 for(const diagnosticMode of ['reject','pending'])for(const scenario of ['early','edge','late','foreign','malformed','file','file-early','none','terminal']){
  let elapsed=0,waits=0,kills=0,spawned,listener,emitted=false,logWrites=0;const saved={},sent=[];
  const uuid='12345678-1234-1234-1234-123456789abc',url='ws://127.0.0.1:12345/devtools/browser/'+uuid;
  const io=new Proxy({},{get:()=>()=>diagnosticMode==='pending'?new Promise(()=>{}):Promise.reject(Object.assign(Error('diagnostic denied'),{code:'EACCES'}))});
  const out='/actual/run/webgl',active=out+'/chrome-profile/DevToolsActivePort';
  function emit(){if(emitted||!listener)return;emitted=true;
   const line=scenario==='foreign'?'DevTools listening on ws://192.0.2.1:12345/devtools/browser/'+uuid:scenario==='malformed'?'DevTools listening on '+url+'?foreign=1':'DevTools listening on '+url;
   // Real stream chunks may split a line; only its completed arrival counts.
   listener(Buffer.from(line.slice(0,12)));listener(Buffer.from(line.slice(12)+'\n'));
  }
  const scope={Error,Date,Map,Set,Buffer,Number,Promise,path,crypto,assert,performance:{now:()=>elapsed},clearTimeout(){},setTimeout:()=>1,
   process:{ppid:123,kill:(p,s)=>{assert.equal(p,123);assert.equal(s,'SIGTERM');kills++;}},
   cp:{spawn:(exe,args,options)=>{spawned={exe,args,options};return {pid:456,once(){},stderr:{on:(event,f)=>{assert.equal(event,'data');listener=f;},once(){}}};}},
   fs:{promises:io,openSync:()=>9,writeSync:()=>logWrites++,closeSync(){},existsSync:p=>{assert.equal(p,active);return scenario==='file-early'||scenario==='file'&&elapsed>=9900;},readFileSync:(p,enc)=>{assert.equal(p,active);assert.equal(enc,'utf8');if(!scenario.startsWith('file'))throw Error('first endpoint ENOENT');return '12345\n/devtools/browser/'+uuid+'\n';}},
   save:(n,v)=>saved[n]=v,ws:{send:v=>sent.push(v)},out,port:777,deadline:Date.now()+30000,wait:async ms=>{assert.equal(ms,100);if(scenario==='early')emit();elapsed+=ms;waits++;
    if((scenario==='edge'&&elapsed===9900)||(scenario==='late'&&elapsed===10000)||(['foreign','malformed'].includes(scenario)&&elapsed===100))emit();
    if(scenario==='terminal'&&elapsed===100)scope.api.fail(Error('first terminal cancellation'));
   }};
  vm.createContext(scope);vm.runInContext(latch+';globalThis.api={fail,send};',scope);
  try{await vm.runInContext('(async()=>{'+startup+'})()',scope);}catch(e){scope.api.fail(e);}
  assert.equal(spawned.exe,'/usr/bin/google-chrome');
  assert.deepEqual(Array.from(spawned.args),['--headless=new','--no-sandbox','--no-first-run','--no-default-browser-check','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--remote-debugging-port=0','--user-data-dir='+out+'/chrome-profile','about:blank']);
  assert.equal(spawned.options.stdio[2],'pipe');
  const success=['early','edge','file','file-early'].includes(scenario);
  assert.equal(waits,scenario==='file-early'?0:['edge','file'].includes(scenario)?99:['terminal','early'].includes(scenario)?1:100);
  assert.equal(kills,success?0:1);
  if(!success){for(const method of ['Runtime.evaluate','Input.dispatchKeyEvent','Page.captureScreenshot','Browser.close'])await assert.rejects(scope.api.send(method),/first (endpoint ENOENT|terminal cancellation)/);scope.api.fail(Error('later diagnostic failure'));assert.equal(kills,1);}
  else {assert.equal(saved['endpoint.json'].debugPort,12345);assert.equal(saved['endpoint.json'].websocketUrl,url);assert.equal(saved['endpoint.json'].source,scenario.startsWith('file')?'current-profile-file':'owned-chrome-stderr');}
  if(scenario==='edge')assert.equal(saved['endpoint.json'].elapsedMs,9900);
  if(scenario==='late'){assert.equal(saved['stderr-readiness-0.json'].elapsedMs,10000);assert.equal(saved['stderr-readiness-0.json'].timely,false);}
  const before=JSON.stringify(saved);listener(Buffer.from('DevTools listening on '+url+'\n'));assert.equal(JSON.stringify(saved),before,'no late readiness effects');
  assert.equal(sent.length,0);
 }
 // Exercise the exact emitted observer against hostile lines and a foreign
 // stream. Only complete, canonical browser endpoints on its child count.
 {
  let elapsed=0,callback,end;const saved={};
  const scope={Buffer,Date,Number,performance:{now:()=>elapsed}};vm.createContext(scope);
  const start=source.indexOf(' function ownedStderrReadiness('),endSource=source.indexOf('\n let readinessStarted;',start);
  vm.runInContext(source.slice(start,endSource)+';globalThis.observe=ownedStderrReadiness;',scope);
  const uuid='12345678-1234-1234-1234-123456789abc',url='ws://127.0.0.1:12345/devtools/browser/'+uuid;
  const child={pid:456,stderr:{on:(n,f)=>callback=f,once:(n,f)=>end=f}};
  const observer=scope.observe(child,{openSync:()=>1,writeSync(){},closeSync(){}},'/run',(n,v)=>saved[n]=v,()=>false,()=>0);
  const foreign=new (require('node:events').EventEmitter)();foreign.emit('data',Buffer.from('DevTools listening on '+url+'\n'));assert.equal(foreign.listenerCount('data'),0);assert.equal(observer.endpoint,null);
  for(const candidate of [url+'?q=1',url+'#x',url+' trailing',url.replace(':12345',':65536'),url.replace(':12345',':0'),url.replace('ws:','wss:'),url.replace('127.0.0.1','127.0.0.1.evil'),url.replace('127.0.0.1','user@127.0.0.1'),url.replace('/browser/','/page/'),url.replace(uuid,'stale')])callback(Buffer.from('DevTools listening on '+candidate+'\n'));
  callback(Buffer.from('x'.repeat(4097)+'DevTools listening on '+url+'\n'));
  assert.equal(observer.endpoint,null);
  callback(Buffer.from('DevTools listening on '+url));assert.equal(observer.endpoint,null);
  elapsed=10000;callback(Buffer.from('\n'));assert.equal(observer.endpoint,null,'completion arrival owns the clock');
  elapsed=9900;callback(Buffer.from('DevTools listening on '+url+'\r\n'));
  assert.equal(observer.endpoint.websocketUrl,url);assert.equal(observer.endpoint.elapsedMs,9900);assert.equal(observer.endpoint.pid,456);assert(Number.isFinite(Date.parse(observer.endpoint.at)));
  observer.close();const before=JSON.stringify(saved);callback(Buffer.from('DevTools listening on '+url+'\n'));assert.equal(JSON.stringify(saved),before);end();
 }
 // Successful read-only observations pin remote bytes and process identity;
 // large executables are statted without reading them into the diagnostic.
 {
  const writes={},reads=[];const contents=p=>Buffer.from(p.endsWith('/cmdline')?'bash\0/remote/wrapper\0':p.endsWith('/children')?'':p.endsWith('/stat')?'456 (bash) S 123':p.endsWith('/wchan')?'do_wait':'remote helper bytes');
  const io={lstat:async()=>({isSymbolicLink:()=>false}),realpath:async p=>p==='/usr/bin/google-chrome'?'/remote/wrapper':p,
   stat:async p=>({size:p.endsWith('/chrome')?1000000:contents(p).length,dev:1,ino:2,isFile:()=>true}),
   open:async p=>{reads.push(p);return {read:async b=>{assert.equal(b.length,65536);const v=contents(p);v.copy(b);return {bytesRead:v.length};},close:async()=>{}};},
   readlink:async()=>'/usr/bin/bash',readdir:async()=>['DevToolsActivePort'],writeFile:async(p,v)=>{writes[p]=JSON.parse(v);}};
  const scope={Buffer,Set,Number,Date,performance:{now:()=>0}};vm.createContext(scope);
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
 vm.createContext(scope);vm.runInContext(source.slice(a,b)+';ws=globalThis.ws;globalThis.api={fail,send,evaluate};',scope);const inflight=scope.api.send('Runtime.evaluate');const rejected=assert.rejects(inflight,/first failure/);scope.api.fail(Error('first failure'));await rejected;
 for(const method of ['Runtime.evaluate','Input.dispatchKeyEvent','Page.captureScreenshot','Browser.close'])await assert.rejects(scope.api.send(method),/first failure/);
 scope.api.fail(Error('second'));assert.equal(kills,1);assert.equal(sent.length,1);
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
 console.log(JSON.stringify({passed:true,exactEmittedCaller:true,endpoint100x100ms:true,ownedStderrArrivalClock:true,earlyAndLateStderr:true,foreignAndMalformedRefused:true,fileFallback:true,terminalStopsReadiness:true,pendingCDPRejected:true,diagnosticRejectAndPendingCannotDelayCancel:true,altAdmissionExecution:true,independentRelease:true,invalidDurationsZeroEffects:true,staleZeroEffects:true,firstFailureOwningCancel:true,noLaterProtocol:true,currentInstalledWorker:true,originalTR3PE:true,moduleSha256:sha(bytes),exeSha256:sha(pe.buf),browser:false}));
})().catch(e=>{console.error(e);process.exitCode=1;});
