'use strict';
// Real shipped CPU/WebCrypto, real host compile/init, actual caller admission.
// All guest entry, Worker transport and browser services are inert.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const vm=require('node:vm'),Module=require('node:module'),{webcrypto}=require('node:crypto');
const cp=require('node:child_process'),{once}=require('node:events');
const adapter=require('./redline-current-startup.cjs');
const root=path.resolve(__dirname,'..'),base=path.resolve(process.env.REDLINE_CURRENT_STARTUP_RUN);
assert(process.env.REDLINE_CURRENT_STARTUP_RUN,'unique test run required');fs.mkdirSync(base,{recursive:true});
const memory=process.argv.includes('--memory');
function replace(source,before,after){assert.equal(source.split(before).length,2);return source.replace(before,after);}
// Used to prove the actual candidate before the pinned admission file is released.
function admissionCandidate(source){
 source=replace(source,'const SELECTED = Object.freeze({','const LEGACY_SELECTED = Object.freeze({');
 source=replace(source,'function install({WineAssembly, scope = globalThis, deadline}) {',`function install({WineAssembly, scope = globalThis, deadline, version}) {
    let SELECTED = LEGACY_SELECTED;
    if (version !== undefined) {
      const current = typeof module === 'object' && module.exports
        ? require('./redline-current-startup-v1.js') : scope.RedlineCurrentStartupV1;
      if (!current || version !== current.version || version !== 'redline-startup-3e491c08-v1')
        throw Error('Redline startup: unknown version');
      SELECTED = current.SELECTED;
    }`);
 return replace(source,'return Object.freeze({install, SELECTED});','return Object.freeze({install, SELECTED: LEGACY_SELECTED});');
}
const original=fs.readFileSync(path.join(root,'lib/redline-startup-admission.js'),'utf8');
const candidate=memory?admissionCandidate(cp.execFileSync('git',['show','da4dd40e20398492156bb254b531afc80b350f2c:lib/redline-startup-admission.js'],{encoding:'utf8'})):original;
function load(source,filename,requireFn){const m=new Module(filename,module);m.filename=filename;m.paths=module.paths;if(requireFn)m.require=requireFn;m._compile(source,filename);return m.exports;}
const admission=load(candidate,path.join(root,'lib/redline-startup-admission.js'));
const bytes=fs.readFileSync(path.join(root,'build/wine-assembly.wasm'));
assert.equal(adapter.sha(bytes),adapter.SELECTED.sha256);assert.equal(bytes.length,adapter.SELECTED.bytes);
function install(version=adapter.version,deadline=Date.now()+10000){const scope={crypto:webcrypto,WINE_THREADS:true,crossOriginIsolated:true};return admission.install({WineAssembly:{},scope,deadline,version});}
function owner(module){const link={module,worker:{},endpointIdentity:'e',slot:0};return {_wasmModule:module,instance:{},memory:{},guestWorker:{module,link}};}
function proof(api){return {...api.status(),...adapter.SELECTED,workerTarget:'t',workerInstance:'i'};}
async function deadlineControl(){
 // Compile the real selected CPU before advancing this isolated test clock.
 // A 250ms wall budget can expire in compilation under shared-host load and
 // never exercise the parked-owner deadline this control is meant to cover.
 let now=Date.now(),expire;const deadline=now+10000,m={exports:{}};
 vm.runInNewContext(candidate,{module:m,require:n=>require(path.resolve(root,'lib',n)),
  Date:{now:()=>now},WebAssembly,ArrayBuffer,Uint8Array,
  setTimeout(fn,ms){assert.equal(ms,deadline-now);expire=fn;return 1;},clearTimeout(){} });
 const api=m.exports.install({WineAssembly:{},scope:{crypto:webcrypto,WINE_THREADS:true,crossOriginIsolated:true},deadline,version:adapter.version});
 const module=await api.compile(bytes),parked=api.park(owner(module));
 const observed=parked.catch(e=>e);assert.equal(api.status().phase,'parked');assert.equal(typeof expire,'function');
 now=deadline;expire();assert.match((await observed).message,/deadline expired/);
 assert.equal(api.status().phase,'refused');assert.throws(()=>api.release(proof(api)),/deadline expired/);
}
function fixtures(){
 let source=fs.readFileSync(path.join(__dirname,'redline-startup.test.cjs'),'utf8');
 source=source.replace("const pins={commit:'fixture',files:","const pins={startupVersion:"+JSON.stringify(adapter.version)+",commit:'fixture',files:");
 source=source.replace("'host.js','tools/redline-browser-run.cjs'","'lib/redline-current-startup-v1.js','tools/redline-current-startup.cjs','host.js','tools/redline-browser-run.cjs'");
 source=source.replace("'tools/redline-chrome-startup.cjs','tools/redline-key-delivery.cjs'","'tools/redline-chrome-startup.cjs','tools/redline-key-delivery.cjs','tools/redline-native-trace.cjs','tools/q3-input-wire-observation.cjs','tools/redline-startup-boundary.cjs','scratch/runs/20261109-redline-distinct-label-training-1235/prepare-caller.cjs'");
 source=source.replace("if(n==='./redline-chrome-startup.cjs')return {observeStartup:()=>({}),","if(n==='./redline-startup-boundary.cjs')return {...require(n),writeDiagnostic(){},observeStartup:()=>({}),publicationSnapshot:()=>({fixture:true}),portPublication:async()=>({debugPort:1234,browserPath:'/fixture'})};if(n==='./redline-chrome-startup.cjs')return {observeStartup:()=>({}),");
 source=source.replace('await vm.runInContext(caller,driver);',"try{await vm.runInContext(caller,driver);}catch(e){throw Error(e.stack+JSON.stringify([...saved]));}");
 source=source.replace('module.exports={productionFixtureSuite};','module.exports={composed,pageFixture};');
 const mockFs={...fs,readFileSync:(file,...args)=>path.resolve(String(file))===path.join(root,'lib/redline-startup-admission.js')?(typeof args[0]==='string'?candidate:Buffer.from(candidate)):fs.readFileSync(file,...args)};
 return load(source,path.join(__dirname,'redline-startup.test.cjs'),name=>{
  if(name==='node:fs')return mockFs;
  if(name==='../lib/redline-startup-admission.js')return {...admission,SELECTED:adapter.SELECTED};
  return require(name);
 });
}
async function main(){
 if(process.argv[2]==='--outer-runner'){
  const publication=require('./redline-current-publication.cjs'),run=process.argv[3];
  const child=publication.launch({run,publicationVersion:publication.version,startupVersion:adapter.version,deadline:Number(process.env.BROWSER_DEADLINE),options:{stdio:'inherit',env:process.env}});
  const exit=once(child,'exit'),close=once(child,'close');const [code,signal]=await exit;await close;assert.equal(code,0);assert.equal(signal,null);return;
 }
 assert(Object.isFrozen(adapter.SELECTED));
 const oldSource=cp.execFileSync('git',['show','da4dd40e20398492156bb254b531afc80b350f2c:lib/redline-startup-admission.js'],{encoding:'utf8'});
 assert.equal(candidate,admissionCandidate(oldSource),'only the declared selector changes shared admission');
 const legacyAPI=load(oldSource,path.join(root,'lib/redline-startup-admission.js'));
 const baseline=legacyAPI.install({WineAssembly:{},scope:{crypto:webcrypto},deadline:Date.now()+1000});
 const currentDefault=admission.install({WineAssembly:{},scope:{crypto:webcrypto},deadline:Date.now()+1000});
 assert.deepEqual(currentDefault.status(),baseline.status(),'legacy default status parity');
 for(const selected of [{...adapter.SELECTED,sha256:'0'.repeat(64)},{...adapter.SELECTED,bytes:1}]){
  let evaluated=false;await assert.rejects(adapter.launch({version:adapter.version,selected,deadline:Date.now()+1000,evaluate:()=>{evaluated=true;}}));assert(!evaluated);
 }
 await assert.rejects(adapter.launch({version:'wrong'}),/unknown Redline startup version/);
 const scope={crypto:webcrypto,WINE_THREADS:true,crossOriginIsolated:true},page=vm.createContext({...scope,ArrayBuffer,Uint8Array,WebAssembly,setTimeout,clearTimeout});
 vm.runInContext(candidate,page);assert.throws(()=>page.RedlineStartupAdmission.install({WineAssembly:{},scope,deadline:Date.now()+1000,version:adapter.version}),/unknown version/);
 const old=admission.install({WineAssembly:{},scope:{crypto:webcrypto},deadline:Date.now()+1000});
 assert.equal(old.status().selected.sha256,'a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295');
 await assert.rejects(old.compile(bytes),/selected module mismatch/);
 assert.throws(()=>install('wrong-version'),/unknown version/);
 assert.throws(()=>install(adapter.version,Date.now()+21000),/20000ms/);
 const rows=[];
 await deadlineControl();rows.push('deadline');console.log('PASS actual current CPU barrier deadline after parked owner');
 for(const mode of ['positive','wrong-hash','wrong-size','duplicate-compile','owner','endpoint','module','duplicate-release','sticky']){
  const api=install(adapter.version,Date.now()+10000);
  if(mode==='wrong-hash'||mode==='wrong-size'){
   const b=Buffer.from(bytes);if(mode==='wrong-hash')b[b.length-1]^=1;
   await assert.rejects(api.compile(mode==='wrong-size'?b.subarray(0,-1):b),/module mismatch/);
  }else {
   const module=await api.compile(bytes);assert(module instanceof WebAssembly.Module);
   if(mode==='duplicate-compile'){await assert.rejects(api.compile(bytes),/compile reused/);}
   else {
    const wine=owner(module),parked=api.park(wine),observed=parked.catch(e=>e);
    const p=proof(api);
    if(mode==='sticky'){
     api.abort('first-failure');api.abort('later');assert.throws(()=>api.release(p),/first-failure/);await observed;assert.match(api.status().failure,/first-failure/);
    }else if(['owner','endpoint','module'].includes(mode)){
     if(mode==='owner')wine.guestWorker.link.worker={};
     if(mode==='endpoint')wine.guestWorker.link.endpointIdentity='changed';
     if(mode==='module')wine._wasmModule=await WebAssembly.compile(new Uint8Array([0,97,115,109,1,0,0,0]));
     assert.throws(()=>api.release(p),/owner changed/);await observed;
    }else {api.release(p);await parked;if(mode==='duplicate-release')assert.throws(()=>api.release(p),/one parked release/);}
   }
  }
  rows.push(mode);console.log('PASS actual current CPU barrier '+mode);
 }
 const {composed}=fixtures(),caller=fs.readFileSync(path.join(__dirname,'redline-browser-run.cjs'),'utf8');
 const historical=await composed(caller);assert.equal(historical.page.originalEntries,0);assert.equal(historical.exitCode,1);console.log('HISTORICAL FAIL on actual current CPU');
 const integrated=adapter.integrate(caller);
 for(const mode of ['positive','source-compile','wrong-compile-bytes','wrong-live-bytes','no-bytecode','wrong-endpoint','owner-race','foreign-module','worker-failure','detached','cleanup-failure','duplicate-module','wrong-slot','flag-race','missing-worker','late-arm','flags-conflict']){
  const r=await composed(integrated,mode),good=['positive','source-compile'].includes(mode);
  assert.equal(r.exitCode,good?0:1,mode+JSON.stringify([...r.saved]));assert.equal(r.page.originalEntries,good?1:0,mode);
  if(good){assert(r.events.indexOf('bytecode-read')<r.events.indexOf('original-loadExe'));assert.equal(r.page.compiles,1);assert.equal(r.saved.get('startup-admission.json').nativeQualified,false);}
  else {const after=r.events.slice(r.events.indexOf('first-terminal-failure')+1);assert(!after.some(e=>e==='Runtime.evaluate'||e==='Page.captureScreenshot'||e.startsWith('Input.')));if(r.page.worker)assert.equal(r.page.cleanups,1);}
  rows.push('caller-'+mode);console.log('PASS retained caller/current page '+mode);
 }
 await preparation(composed);
 assert.equal(adapter.integrate(require('./redline-startup-boundary.cjs').integrate()).includes('version:pins.startupVersion'),true);
 fs.writeFileSync(path.join(base,'result.json'),JSON.stringify({passed:true,memory,rows,selected:adapter.SELECTED,nativeQualified:false,cancellationBrowserEOF:'UNKNOWN',noNativeAttempt:true},null,2));
}
async function preparation(composed){
 const publication=require('./redline-current-publication.cjs'),current=require('./redline-current-module.cjs');
 const read=fs.readFileSync;
 if(memory)fs.readFileSync=function(file,...args){return path.resolve(String(file))===path.join(root,'lib/redline-startup-admission.js')?(typeof args[0]==='string'?candidate:Buffer.from(candidate)):read.call(this,file,...args);};
 try {
  const run=path.join(base,'prepared'),options={publicationVersion:publication.version,startupVersion:adapter.version};
  for(const bad of [{startupVersion:adapter.version},{...options,startupVersion:'wrong'},{...options,publicationVersion:'wrong'}]){
   const dest=path.join(base,'must-not-exist');assert.throws(()=>current.prepare(dest,bad));assert(!fs.existsSync(dest));
  }
  const plan=current.prepare(run,options);assert.equal(plan.startupVersion,adapter.version);assert.equal(plan.nativeReady,false);
  const pins=publication.prelaunch(run,publication.version,adapter.version);
  for(const name of ['lib/redline-current-startup-v1.js','tools/redline-current-startup.cjs','lib/redline-startup-admission.js'])assert.equal(pins.files.filter(p=>p.path===name).length,1);
  assert.throws(()=>publication.prelaunch(run,publication.version,'wrong'));
  // The generated staged caller executes its authentic imports and authentication.
  // Stop only at the final Module boundary, then execute that exact program using
  // the inert services and actual host/worker admission fixture above.
  const compile=Module.prototype._compile,env={...process.env};let controller;
  process.env.REDLINE_RUN=run;process.env.REDLINE_NATIVE_FIXTURE='1';process.env.REDLINE_NATIVE_TRACE='1';process.env.REDLINE_STARTUP_BOUNDARY='1';
  Module.prototype._compile=function(source,filename){if(filename===path.join(__dirname,'redline-browser-run.cjs')){controller=source;return;}return compile.call(this,source,filename);};
  try{require(path.join(run,'publication-caller.cjs'));}finally{Module.prototype._compile=compile;for(const k of Object.keys(process.env))if(!(k in env))delete process.env[k];Object.assign(process.env,env);}
  assert(controller);assert.match(controller,/version:pins.startupVersion/);
  // Same selected launch expression in the full outer trace/startup composition.
  const plain=fs.readFileSync(path.join(__dirname,'redline-browser-run.cjs'),'utf8');
  assert(controller.includes(adapter.integrate(plain).slice(adapter.integrate(plain).indexOf("await require(root+'/tools/redline-current-startup.cjs')"),adapter.integrate(plain).indexOf(' await evaluate(`window.__nativeMouseEvents'))));
  // This suite's browser/filesystem services use /inert-run. Capture only the
  // new diagnostic writer there; the staged CLI suite exercises real files.
  const phases=publication.phases,phaseRows=[];let r;
  publication.phases=(run,label)=>phases(run,label,(name,value)=>phaseRows.push({name,...value}));
  try{r=await composed(controller);}finally{publication.phases=phases;}
  assert.equal(r.exitCode,0);assert.equal(r.page.originalEntries,1);
  assert(phaseRows.some(r=>r.phase==='browser-launch-begin'));
  for(const name of ['lib/redline-current-startup-v1.js','tools/redline-current-startup.cjs','lib/redline-startup-admission.js'])for(const kind of ['missing','changed']){
   const previous=fs.readFileSync;
   fs.readFileSync=function(file,...args){if(path.resolve(String(file))===path.join(root,name)){if(kind==='missing')throw Error('missing provider');const bytes=Buffer.from(previous.call(this,file));bytes[bytes.length-1]^=1;return typeof args[0]==='string'?bytes.toString():bytes;}return previous.call(this,file,...args);};
   let spawned=false;
   try{assert.throws(()=>publication.launch({run,publicationVersion:publication.version,startupVersion:adapter.version,deadline:Date.now()+20000,spawn:()=>{spawned=true;}}));assert(!spawned);}finally{fs.readFileSync=previous;}
  }
  if(!memory){
   const cliRun=path.join(base,'cli-prepared');
   const cli=await child([path.join(__dirname,'redline-current-module.cjs'),'--prepare',cliRun,'--publication-version',publication.version,'--startup-version',adapter.version],{});
   assert.equal(JSON.parse(cli.stdout).startupVersion,adapter.version);
   const env={REDLINE_RUN:cliRun,REDLINE_NATIVE_FIXTURE:'1',REDLINE_NATIVE_TRACE:'1',REDLINE_STARTUP_BOUNDARY:'1',DRIVER_PREFLIGHT:'1',BROWSER_DEADLINE:String(Date.now()+40000)};
   const preflight=await child([cliRun+'/publication-caller.cjs'],env);assert.equal(JSON.parse(preflight.stdout).chromiumStarted,false);
   // Initial deadline for this separate offline custody preflight; validation
   // is syscall-stepped and the program exits before server/Chrome creation.
   env.BROWSER_DEADLINE=String(Date.now()+120000);
   const outer=await child([__filename,'--outer-runner',cliRun],env);
   const custody=cliRun+'/publication-custody',drain=JSON.parse(fs.readFileSync(custody+'/kernel-drain.json'));
   assert.equal(drain.remaining.length,0);assert.equal(drain.unreaped.length,0);
   for(const p of drain.owned)assert(drain.reaped.some(r=>r.pid===p.pid&&r.start===p.start));
   const retrieval=require('./redline-publication-caller.cjs').retrieve(custody);assert.equal(retrieval.custodyComplete,true);assert.equal(retrieval.publication,'UNKNOWN');
   fs.writeFileSync(path.join(base,'actual-cli-outer.json'),JSON.stringify({cli,preflight,outer,owned:drain.owned.length,reaped:drain.reaped.length,retrieval},null,2));
   // Compress completed own journal only after retrieval and verify recovery.
   const journal=custody+'/publication-syscalls.ndjson',raw=fs.readFileSync(journal),gzip=require('node:zlib').gzipSync(raw);
   fs.writeFileSync(journal+'.gz',gzip);assert.deepEqual(require('node:zlib').gunzipSync(fs.readFileSync(journal+'.gz')),raw);
   fs.writeFileSync(path.join(base,'journal-recovery.json'),JSON.stringify({path:journal,bytes:raw.length,sha256:adapter.sha(raw),gzip:journal+'.gz',gzipSHA256:adapter.sha(gzip),recipe:'gzip -dc GZIP > ORIGINAL; verify SHA-size'}));fs.unlinkSync(journal);
   console.log('PASS actual CLI and outer custody preflight, actual wait/separate EOF; no Chrome');
  }
  fs.writeFileSync(path.join(base,'preparation.json'),JSON.stringify({passed:true,providers:pins.files.length,startupVersion:pins.startupVersion,generatedCallerExecuted:true,finalModuleCaptured:true,nativeReady:false}));
  console.log('PASS actual production preparation, generated caller imports, selector, missing/changed prelaunch controls');
 }finally{fs.readFileSync=read;}
}
async function child(args,env){
 const p=cp.spawn(process.execPath,args,{env:{...process.env,...env},stdio:['ignore','pipe','pipe']});
 const exit=once(p,'exit'),close=once(p,'close');let stdout='',stderr='',stdoutEOF=false,stderrEOF=false;
 p.stdout.on('data',b=>stdout+=b);p.stderr.on('data',b=>stderr+=b);p.stdout.once('end',()=>stdoutEOF=true);p.stderr.once('end',()=>stderrEOF=true);
 const [code,signal]=await exit;await close;assert.equal(code,0,stderr);assert.equal(signal,null);assert(stdoutEOF&&stderrEOF);
 return {code,signal,stdout,stderr,actualWait:true,stdoutEOF,stderrEOF};
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={main};
