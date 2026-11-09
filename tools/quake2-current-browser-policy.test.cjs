'use strict';
// Offline proof: real canonical files and WebCrypto; compile and owning attach
// are inert. No browser endpoint, guest execution or native admission implied.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const policy=require('./quake2-current-browser-policy.cjs'),current=require('./quake2-current-module.cjs');
const root=path.resolve(__dirname,'..'),read=n=>fs.readFileSync(path.join(root,n));
const core=require('../lib/quake2-owning-load-core.js');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function proof({source='lib/quake2-current-browser-policy-v1.js',policyVersion=policy.version,slot=0,damage,nativeWrites=true,workerPolicy,missingProvider=false,duplicatePolicy=false,workerBranch=false,enabled=true,conflictingModule=false}={}){
 const requests=[],compiled=[],attached=[],digested=[];
 const getExports=()=>{throw Error('inert exports');},getMemory=()=>{throw Error('inert memory');};
 const context=vm.createContext({URL,Uint8Array,crypto:{subtle:{digest:async(algorithm,bytes)=>{digested.push(bytes);return crypto.webcrypto.subtle.digest(algorithm,bytes);}}},
  self:{location:{href:'https://q2.invalid/lib/guest-worker.js?v=dev'+(workerPolicy===undefined?'':'&q2BrowserPolicy='+encodeURIComponent(workerPolicy))+(duplicatePolicy?'&q2BrowserPolicy='+encodeURIComponent(policy.version):'')}},
  Quake2OwningLoadCore:{EXE:core.EXE,EXE_SHA:core.EXE_SHA,attach(options){attached.push(options);return {snapshot:()=>({offline:true})};}},
  WebAssembly:{compile:async bytes=>{compiled.push(bytes);return {inertModule:true};}},
  fetch:async(url,options)=>{const u=new URL(url),name=u.pathname.slice(1);requests.push({name,options});const bytes=Uint8Array.from(read(name));if(damage===name)bytes[bytes.length-1]^=1;return {ok:true,arrayBuffer:async()=>bytes.buffer};}});
 context.location=context.self.location;context.self=context;
 context.importScripts=(...urls)=>{for(const url of urls){
  const u=new URL(url,context.self.location.href);assert.equal(u.searchParams.get('v'),'dev');
  if(u.pathname==='/lib/quake2-owning-load-core.js')continue; // inert attach seam above
  if(u.pathname==='/lib/quake2-browser-load-observer.js'){vm.runInContext(text,context);continue;}
  if(missingProvider)throw Error('policy provider absent');assert.equal(u.pathname,'/lib/quake2-current-browser-policy-v1.js');
  vm.runInContext(read(u.pathname.slice(1)).toString(),context);
 }};
 let text=read(source).toString();
 if(source===policy.observer&&process.env.Q2_POLICY_CANDIDATE_PATCH){
  for(const [before,after] of JSON.parse(fs.readFileSync(process.env.Q2_POLICY_CANDIDATE_PATCH))){assert.equal(text.split(before).length,2);text=text.replace(before,after);}
 }
 vm.runInContext(text,context);
 const browser=source===policy.provider?context.Quake2CurrentBrowserPolicyV1:context.Quake2BrowserLoadObserver;
 let result,error;try{
  if(workerBranch){
   const worker=read('lib/guest-worker.js').toString();
   const begin=worker.indexOf('      let quake2BrowserBinding=null;'),end=worker.indexOf('      const built = GuestRpc.createWorkerImports',begin);assert(begin>0&&end>begin);
   const urlBegin=worker.indexOf('const versionedWorkerUrl ='),urlEnd=worker.indexOf('\n};',urlBegin)+3;assert(urlBegin>0&&urlEnd>urlBegin);
   Object.assign(context,{IS_WEB_WORKER:true,SOURCE_VERSION:'dev',workerSlot:slot,msg:{quake2LoadObservation:enabled,quake2NativeWriteObservation:nativeWrites,drakanModuleBytes:conflictingModule},instance:{exports:{inertExports:true}},memory:{buffer:new ArrayBuffer(0)}});
   vm.runInContext(worker.slice(urlBegin,urlEnd),context);
   result=await vm.runInContext('(async()=>{'+worker.slice(begin,end)+'return quake2BrowserBinding;})()',context);
  }else result=await browser.prepare({version:'dev',slot,getExports,getMemory,nativeWrites,policyVersion});
 }catch(e){error=e;}
 if(result){
  assert.equal(compiled.length,1);assert.equal(attached.length,1);
  assert.equal(compiled[0],digested[1],'compile receives the identical authenticated CPU byte object');
  assert.equal(attached[0].canonicalBytes,digested[0],'attach receives the identical authenticated EXE byte object');
  assert.equal(hash(compiled[0]),current.modules['build/wine-assembly.wasm']);
  if(workerBranch){assert.equal(attached[0].getExports(),context.instance.exports);assert.equal(attached[0].getMemory(),context.memory.buffer);}
  else{assert.equal(attached[0].getExports,getExports);assert.equal(attached[0].getMemory,getMemory);}
  assert.equal(attached[0].nativeWrites,nativeWrites);
  assert.equal(hash(attached[0].canonicalBytes),core.EXE_SHA);
  assert.equal(result.observer.snapshot().binding.sha256,hash(compiled[0]));
 }else{assert.equal(compiled.length,0);assert.equal(attached.length,0);}
 return {result,error,requests,context};
}
(async()=>{
 const old=await proof({source:policy.observer});assert.match(String(old.error),/canonical PATHHASH build\/wine-assembly.wasm/);
 for(const nativeWrites of [false,true]){
  const p=await proof({nativeWrites});assert(p.result);assert.equal(p.result.observer.snapshot().binding.policyVersion,policy.version);
  assert.deepEqual(p.requests.map(r=>r.name),[core.EXE,'build/wine-assembly.wasm']);
  for(const r of p.requests){assert.equal(r.options.cache,'no-store');assert.equal(r.options.credentials,'same-origin');}
 }
 for(const options of [{slot:1},{policyVersion:'wrong'},{damage:core.EXE},{damage:'build/wine-assembly.wasm'}])assert((await proof(options)).error);
 if(old.context.Quake2BrowserLoadObserver.CURRENT_POLICY_VERSION){
  assert((await proof({source:policy.observer,workerPolicy:policy.version})).result,'actual owning observer routes to current policy');
  const bad=await proof({source:policy.observer,workerPolicy:'wrong'});assert(bad.error);assert.equal(bad.requests.length,0);
  for(const options of [{missingProvider:true},{duplicatePolicy:true},{slot:1}]){
   const refused=await proof({source:policy.observer,workerPolicy:policy.version,...options});assert(refused.error);assert.equal(refused.requests.length,0);
  }
  const worker=await proof({source:policy.observer,workerPolicy:policy.version,workerBranch:true});assert.ifError(worker.error);assert(worker.result,'actual guest-worker opt-in branch');
  const workerWithoutWrites=await proof({source:policy.observer,workerPolicy:policy.version,workerBranch:true,nativeWrites:false});assert.ifError(workerWithoutWrites.error);assert(workerWithoutWrites.result);
  for(const options of [{conflictingModule:true},{slot:1}])assert((await proof({source:policy.observer,workerPolicy:policy.version,workerBranch:true,...options})).error);
  const off=await proof({source:policy.observer,workerPolicy:policy.version,workerBranch:true,enabled:false});assert.equal(off.result,null);assert.equal(off.requests.length,0);
 }
 const composed=policy.compose({browserPolicyVersion:policy.version,custodyVersion:'publishedf977ebf7c'});
 new vm.Script(composed.source);
 // Execute the function emitted in the actual caller's launch expression.
 const seam=composed.source.slice(composed.source.indexOf('('+policy.selectWorkerPolicy.toString()),composed.source.indexOf("shell.launchApp('quake2_demo');"));
 const sandbox=vm.createContext({URL,location:{href:'https://q2.invalid/'},WineAssembly:{versionedUrl:p=>p+'?v=dev'}});
 vm.runInContext(seam,sandbox);
 assert.equal(new URL(sandbox.WineAssembly.versionedUrl('lib/guest-worker.js')).searchParams.get('q2BrowserPolicy'),policy.version);
 assert.equal(sandbox.WineAssembly.versionedUrl('lib/d3d-render-worker.js'),'lib/d3d-render-worker.js?v=dev');
 assert.throws(()=>policy.compose({browserPolicyVersion:'wrong'}),/explicit Q2 browser policy version/);
 console.log(JSON.stringify({passed:true,actualProductionCallerComposed:true,actualGuestWorkerOptInBranch:!!old.context.Quake2BrowserLoadObserver.CURRENT_POLICY_VERSION,oldPreparePATHHASH:true,currentPrepareSameAuthenticatedBytesCompiled:true,owningAttach:true,primary:true,compatBrowserSelectionSupported:false,compatArtifactSHA256:hash(read('build/wine-assembly.compat.wasm')),nativeQualification:false}));
})().catch(e=>{console.error(e);process.exitCode=1;});
