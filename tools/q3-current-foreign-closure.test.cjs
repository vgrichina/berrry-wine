'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const cp=require('node:child_process'),crypto=require('node:crypto'),z=require('node:zlib');
const Module=require('node:module'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),route=require('./q3-current-foreign-closure-v1.cjs');
const current=require('./q3-current-module.cjs'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
if(['--runtime-probe','--runtime-preflight'].includes(process.argv[2])){
 const preflight=process.argv[2]==='--runtime-preflight';
 const run=process.argv[3],digest=process.argv[4],seen=new Set(),read=fs.readFileSync;
 const pins=route.staged(run,route.version,digest),by=new Map(pins.files.map(p=>[path.join(root,p.path),p]));
 for(const n of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'])cp[n]=()=>{throw Error('Git/process effect forbidden in actual runtime');};
 fs.readFileSync=function(file,...args){
  const name=path.resolve(String(file));
  if(name.startsWith(root+'/')&&/\.(?:c?js|py)$/.test(name)){
   const p=by.get(name);assert(p,'unstaged runtime import: '+name);
   const b=read.call(this,file);assert.equal(b.length,p.size);assert.equal(hash(b),p.sha256);seen.add(p.path);
  }
  return read.call(this,file,...args);
 };
 let compiled=0;
 const compile=Module.prototype._compile;
 Module.prototype._compile=function(source,name){
  if(!preflight&&name===path.join(root,'scratch/runs/20261108-q3-gl-readiness-gameplay/browser-run.cjs')){
   new vm.Script(source,{filename:name});
   assert(source.includes('catch(error){observeTerminal(error);throw error;}'));
   assert(source.includes('cancellationCheckpoint')&&source.includes('q3-startup.cjs'));
   assert(source.includes('},20000);pending.set'));
   assert(source.includes(JSON.stringify(path.join(run,'runtime-pins.json.gz'))),'actual current staged pins replace retained manifest');
   assert(source.includes('out='+JSON.stringify(path.join(run,'runtime'))),'unique runtime output');
   compiled++;return;
  }
  return compile.call(this,source,name);
 };
 process.env.Q3_EXECUTION_BOUNDARY_OUT=path.join(run,preflight?'runtime-preflight.jsonl.gz':'runtime-probe.jsonl.gz');
 if(preflight){process.env.DRIVER_PREFLIGHT='1';process.env.BROWSER_DEADLINE=String(Date.now()+60000);}
 require(path.join(run,'q3-runtime-caller.cjs'));
 assert.equal(compiled,1);assert(seen.has('tools/q3-execution-boundary.cjs'));
 console.log(JSON.stringify({passed:true,compiled,sourcePath:process.argv[1],reads:[...seen],gitFree:true,browserStarted:false,nativeReady:false}));
}else{
 (async()=>{
 const out=path.resolve(process.argv[2]);assert(out.startsWith(root+'/scratch/runs/'));fs.mkdirSync(out,{recursive:true});
 const options={checkpointObserverVersion:current.checkpointObserverVersion,foreignClosureVersion:route.version};
 assert.throws(()=>current.validate(),/Q3 migration provider: tools\/q3-native-prelaunch.py/);
 assert.throws(()=>current.validate({checkpointObserverVersion:current.checkpointObserverVersion}),/provider size: lib\/quake2-browser-load-observer.js/);
 assert.throws(()=>require('./q3-native-driver-composition.cjs').compose(),/Q3 provider changed: lib\/redline-startup-admission.js/);
 let negatives=3;
 for(const option of [{foreignClosureVersion:'unknown'},{...options,checkpointObserverVersion:'unknown'},{...options,skipValidation:true}]){assert.throws(()=>current.validate(option));negatives++;}
 // Real production CLI prepares the current bytes; no Git read substitution.
 const run=path.join(out,'prepared');
 const cli=cp.execFileSync(process.execPath,[path.join(__dirname,'q3-current-module.cjs'),'--prepare',run,'--foreign-closure-version',route.version],{cwd:root,encoding:'utf8'});
 const seal=JSON.parse(cli),raw=z.gunzipSync(fs.readFileSync(run+'/runtime-pins.json.gz')),pins=JSON.parse(raw);
 assert.equal(seal.manifestSHA256,hash(raw));assert.equal(pins.moduleVersion,route.version);
 assert.equal(pins.files.length,new Set(pins.files.map(p=>p.path)).size);
 route.staged(run,route.version,seal.manifestSHA256);
 cp.execFileSync(process.execPath,[path.join(__dirname,'q3-current-foreign-closure-v1.cjs'),'--check-staged',run,route.version,seal.manifestSHA256],{cwd:root});
 // Every selected provider, both CPU mirrors and unrelated drift refuse before
 // any generated output or production Module compilation can occur.
 for(const name of [...Object.keys(route.authorities),'build/wine-assembly.wasm','build/wine-assembly.compat.wasm','lib/browser-input.js','tools/q3-native-driver-composition.cjs']){
  for(const mode of ['missing','changed']){
   const read=fs.readFileSync,target=path.join(root,name),dest=path.join(out,'refuse-'+negatives);
   fs.readFileSync=function(file,...args){if(path.resolve(String(file))===target){if(mode==='missing')throw Error('missing '+name);const b=Buffer.concat([read.call(this,file),Buffer.from('\n')]);return typeof args[0]==='string'?b.toString(args[0]):b;}return read.call(this,file,...args);};
   try{assert.throws(()=>current.prepare(dest,{foreignClosureVersion:route.version}));assert(!fs.existsSync(dest));assert.throws(()=>route.staged(run,route.version,seal.manifestSHA256));negatives++;}finally{fs.readFileSync=read;}
  }
 }
 assert.throws(()=>route.staged(run,'wrong',seal.manifestSHA256));assert.throws(()=>route.staged(run,route.version,'0'.repeat(64)));negatives+=2;
 // Forged manifest SHA/size and omission cannot be promoted by its own seal.
 for(const mutate of [p=>p.files.splice(p.files.findIndex(p=>p.path===route.dependencies[0]),1),p=>p.files.find(p=>p.path===route.dependencies[0]).sha256='0'.repeat(64),p=>p.files.find(p=>p.path===route.dependencies[0]).size++]){
  const forged=JSON.parse(raw);mutate(forged);const bytes=z.gzipSync(JSON.stringify(forged)),read=fs.readFileSync;
  fs.readFileSync=function(file,...args){return String(file)===run+'/runtime-pins.json.gz'?bytes:read.call(this,file,...args);};
  try{
   assert.throws(()=>route.staged(run,route.version,seal.manifestSHA256),/independent prepared manifest SHA/);
   assert.throws(()=>route.staged(run,route.version,hash(z.gunzipSync(bytes))),'repinned manifest without original generated caller must refuse');negatives++;
  }finally{fs.readFileSync=read;}
 }
 const m=route.composition(route.version),result=m.compose();
 for(const [name,digest] of Object.entries(require('./q3-native-driver-composition.cjs').providers))assert.equal(m.providers[name],name==='lib/redline-startup-admission.js'?route.authorities[name][1]:digest,'only published admission pin changes');
 for(const source of [result.source,result.fixtureSource,result.controlsSource])new vm.Script(source);
 let bound;m.compileBoundInput(result,{_compile(source,name){bound=source;assert(name.endsWith('/bound-input.cjs'));new vm.Script(source);}},path.join(root,path.dirname(m.consumerPath),'bound-input.cjs'),out);
 assert(bound.includes('physicalSource:')&&bound.includes('peekKeyDownState'));
 assert(result.fixtureSource.includes('WINE_REDLINE_STARTUP'));
 assert(result.source.includes('catch(error){observeTerminal(error);throw error;}'));
 // Genuine dispatcher behavior: no selector still authenticates the old CPU
 // and refuses this current CPU before compilation. Explicit selection imports
 // the staged policy, hashes the actual EXE/CPU, then reaches inert compile/
 // attach seams. No browser, guest execution or readiness is implied.
 const legacy='a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295';
 const core=require('../lib/quake2-owning-load-core.js');let compiled=0,attached=0,imported=0;
 const context=vm.createContext({URL,Uint8Array,crypto:crypto.webcrypto,
  self:{location:{href:'https://inert/lib/guest-worker.js'}},
  Quake2OwningLoadCore:{...core,attach(options){assert.equal(hash(options.canonicalBytes),core.EXE_SHA);attached++;return {snapshot:()=>({})};}},
  fetch:async url=>{const bytes=fs.readFileSync(path.join(root,new URL(url).pathname));return {ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};},
  WebAssembly:{compile:async bytes=>{assert.equal(hash(bytes),current.SELECTED.sha256);compiled++;return {};}}
 });
 context.importScripts=url=>{assert.equal(new URL(url).pathname,'/lib/quake2-current-browser-policy-v1.js');imported++;vm.runInContext(fs.readFileSync(path.join(root,'lib/quake2-current-browser-policy-v1.js'),'utf8'),context);};
 vm.runInContext(fs.readFileSync(path.join(root,'lib/quake2-browser-load-observer.js'),'utf8'),context);
 assert.equal(context.Quake2BrowserLoadObserver.CPU_SHA,legacy);
 const observation={version:'offline',slot:0,getExports:()=>({}),getMemory:()=>null,nativeWrites:[]};
 await assert.rejects(context.Quake2BrowserLoadObserver.prepare(observation),/canonical PATHHASH build\/wine-assembly.wasm/);
 assert.equal(compiled,0);assert.equal(attached,0);assert.equal(imported,0);
 context.self.location.href+='?q2BrowserPolicy=wrong';await assert.rejects(context.Quake2BrowserLoadObserver.prepare(observation),/unsupported Q2/);
 context.self.location.href='https://inert/lib/guest-worker.js?q2BrowserPolicy=quake2-current-primary-3e491c08-v1';
 const observed=await context.Quake2BrowserLoadObserver.prepare(observation);assert.equal(observed.observer.snapshot().binding.sha256,current.SELECTED.sha256);
 assert.equal(compiled,1);assert.equal(attached,1);assert.equal(imported,1);
 assert.equal(require('../lib/redline-startup-admission.js').SELECTED.sha256,legacy);
 const q3scope=vm.createContext({});vm.runInContext(require('./q3-startup.cjs').admissionSource(),q3scope);
 assert.equal(q3scope.RedlineStartupAdmission.SELECTED.sha256,current.SELECTED.sha256);
 // The old checkpoint remains available inside the new authenticated closure.
 const checkpoint=current.validate(options);assert.equal(checkpoint.checkpointObserverVersion,current.checkpointObserverVersion);
 for(const name of route.dependencies)assert(checkpoint.httpPins.some(p=>p.url==='/'+name));
 const runtime=JSON.parse(cp.execFileSync(process.execPath,[__filename,'--runtime-probe',run,seal.manifestSHA256],{cwd:root,encoding:'utf8',timeout:15000}));
 const preflight=JSON.parse(cp.execFileSync(process.execPath,[__filename,'--runtime-preflight',run,seal.manifestSHA256],{cwd:root,encoding:'utf8',timeout:15000}));
 assert.equal(preflight.passed,true);assert.equal(preflight.pins,pins.files.length);assert.equal(preflight.chromiumStarted,false);
 const cliPreflight=JSON.parse(cp.execFileSync(process.execPath,[path.join(__dirname,'q3-current-foreign-closure-v1.cjs'),'--run-staged',run,route.version,seal.manifestSHA256],{cwd:root,encoding:'utf8',env:{...process.env,DRIVER_PREFLIGHT:'1',BROWSER_DEADLINE:String(Date.now()+60000),Q3_EXECUTION_BOUNDARY_OUT:path.join(run,'cli-preflight.jsonl.gz')},timeout:15000}));
 assert.equal(cliPreflight.passed,true);assert.equal(cliPreflight.pins,pins.files.length);
 fs.writeFileSync(out+'/result.json',JSON.stringify({passed:true,negatives,providers:pins.files.length,checkpointProviders:checkpoint.files.length,actualCLI:true,actualRelativeCaller:true,runtime,preflight,cliPreflight,defaultDriftRefused:true,nativeReady:false},null,2));
 console.log('PASS actual production CLI/current staged closure/generated relative caller, Git-free real Module compile; '+negatives+' refusal controls');
 })().catch(error=>{console.error(error);process.exitCode=1;});
}
