'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const current=require('./quake2-current-module.cjs'),guard=require('./quake2-staged-closure-gameplay.cjs');
const root=path.resolve(__dirname,'..'),read=n=>fs.readFileSync(path.join(root,n));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 if(current.browserPolicyCommit){
  const policy=require('./quake2-current-browser-policy.cjs');
  const options={moduleVersion:current.browserModuleVersion,browserPolicyVersion:policy.version};
  const run=process.env.Q2_POLICY_TEST_RUN;assert(run,'owned Q2_POLICY_TEST_RUN required');
  const closure=guard.validate(options);
  assert.equal(closure.browserBinding.sha256,current.modules['build/wine-assembly.wasm']);
  assert.equal(closure.browserBinding.browserPolicyVersion,policy.version);
  assert.equal(closure.files.find(p=>p.path==='build/wine-assembly.compat.wasm').sha256,current.modules['build/wine-assembly.compat.wasm']);
  assert.equal(closure.httpPins.find(p=>p.url==='/'+policy.provider).sha256,hash(read(policy.provider)));
  // Historical v2 refuses the changed observer. It does not silently repin;
  // the browser's no-selector behavior is separately tested as old PATHHASH.
  assert.throws(()=>current.validate({moduleVersion:current.version}),/unexplained Q2 provider/);
  for(const bad of [{moduleVersion:'unknown'}, {moduleVersion:current.browserModuleVersion}, {...options,browserPolicyVersion:'wrong'}, {...options,CPU_SHA:'0'.repeat(64)}])assert.throws(()=>guard.validate(bad));
  for(const name of [policy.observer,policy.provider]){
   assert.throws(()=>guard.browserBinding(closure.files.filter(p=>p.path!==name),undefined,policy.version),/undeclared Q2 browser provider/);
  }
  const actualRead=fs.readFileSync;
  const failures=[];
  for(const name of [policy.observer,policy.provider,'tools/quake2-current-browser-policy.cjs','build/wine-assembly.wasm','build/wine-assembly.compat.wasm'])for(const mode of ['missing','changed']){
   fs.readFileSync=function(file,...args){
    if(path.resolve(String(file))===path.join(root,name)){
     if(mode==='missing')throw Object.assign(Error('missing '+name),{code:'ENOENT'});
     const b=Buffer.from(actualRead.call(this,file));b[b.length-1]^=1;return b;
    }
    return actualRead.call(this,file,...args);
   };
   const refused=path.resolve(run,'refused-'+failures.length);
   try{assert.throws(()=>guard.prepare(refused,options));assert(!fs.existsSync(refused));failures.push({name,mode});}finally{fs.readFileSync=actualRead;}
  }
  const destination=path.resolve(run,'prepared');
  const pins=guard.prepare(destination,options);
  assert.equal(pins.preload,'tools/quake2-current-browser-policy.cjs');
  assert.equal(pins.runtimeEnvironment.QUAKE2_CURRENT_BROWSER_COMPOSITION,'1');
  assert.equal(pins.browserPolicyVersion,policy.version);
  assert.throws(()=>guard.prepare(destination,options),/fresh task-owned/);
  // A forged manifest cannot repin either CPU or any browser policy source.
  // Corruption stays in memory; runtime validation performs no Git or compile.
  for(const name of Object.keys({...current.modules,...current.browserProviders})){
   const bytes=Buffer.from(read(name));bytes[bytes.length-1]^=1;
   const forged=structuredClone(pins),pin=forged.files.find(p=>p.path===name);pin.sha256=hash(bytes);
   assert.throws(()=>guard.runtimeBinding(forged,n=>n===name?bytes:read(n)),/published Q2 runtime policy SHA/);
  }
  // Exercise the real preload registration with the real manifest. The
  // module compile hook is inert; no consumer/server/Chrome is executed.
  const Module=require('node:module'),composition=require('./quake2-native-driver-composition.cjs');
  const oldExtension=Module._extensions['.cjs'],oldArg=process.argv[1],oldEnv={...process.env};
  const childProcess=require('node:child_process'),oldExec=childProcess.execFileSync;
  try{
   process.env.QUAKE2_NATIVE_RUN=destination;Object.assign(process.env,pins.runtimeEnvironment);delete process.env.QUAKE2_NATIVE_COMPOSITION;
   process.argv[1]=path.join(root,composition.consumerPath);
   childProcess.execFileSync=function(command,...args){assert.notEqual(command,'git','staged runtime must not require Git');return oldExec.call(this,command,...args);};
   for(const mode of ['wrong-version','wrong-module-version','wrong-authority','missing-provider','damaged-pin']){
    const bad=structuredClone(pins);
    if(mode==='wrong-version')bad.browserPolicyVersion='wrong';
    else if(mode==='wrong-module-version')bad.moduleVersion='wrong';
    else if(mode==='wrong-authority')bad.publishedBrowserPolicyCommit='wrong';
    else if(mode==='missing-provider')bad.files=bad.files.filter(p=>p.path!==policy.provider);
    else bad.files.find(p=>p.path===policy.provider).sha256='0'.repeat(64);
    fs.readFileSync=function(file,...args){return path.resolve(String(file))===path.join(destination,'runtime-pins.json')?Buffer.from(JSON.stringify(bad)):actualRead.call(this,file,...args);};
    try{assert.throws(()=>policy.install());assert.equal(Module._extensions['.cjs'],oldExtension);}finally{fs.readFileSync=actualRead;}
   }
   policy.install();let generated;
   Module._extensions['.cjs']({_compile(source){generated=source;}},process.argv[1]);
   assert(generated.includes('q2BrowserPolicy'));new vm.Script(generated);
  }finally{
   Module._extensions['.cjs']=oldExtension;process.argv[1]=oldArg;
   childProcess.execFileSync=oldExec;
   for(const key of Object.keys(process.env))if(!(key in oldEnv))delete process.env[key];Object.assign(process.env,oldEnv);
  }
  console.log(JSON.stringify({passed:true,actualPreparer:true,actualPreloadRegistration:true,actualRuntimeWithoutGit:true,forgedRuntimeRepinsRefused:true,exactPublishedBrowserPolicy:current.browserPolicyCommit,failures,defaultV2ProviderDriftRefused:true,primaryBrowserOnly:true,compatStagedAuthenticated:true,nativeQualification:false}));
  return;
 }
 const closure=current.validate({moduleVersion:current.version});
 // Actual 1575 failure: the preparer accepts current CPUs, but the actual
 // browser prepare refuses their canonical bytes before compile/attachment.
 const requests=[];let compiled=0,attached=0;
 const core=require('../lib/quake2-owning-load-core.js');
 const context=vm.createContext({URL,Uint8Array,crypto:crypto.webcrypto,
  self:{location:{href:'http://q2.invalid/lib/guest-worker.js?v=dev'}},
  Quake2OwningLoadCore:{EXE:core.EXE,EXE_SHA:core.EXE_SHA,attach(){attached++;throw Error('unexpected attachment');}},
  WebAssembly:{compile(){compiled++;throw Error('unexpected compile');}},
  fetch:async(url,options)=>{const u=new URL(url),name=u.pathname.slice(1);requests.push({name,version:u.searchParams.get('v'),options});const b=read(name);return {ok:true,arrayBuffer:async()=>Uint8Array.from(b).buffer};}});
 vm.runInContext(read('lib/quake2-browser-load-observer.js').toString(),context,{timeout:1000});
 const observer=context.Quake2BrowserLoadObserver;
 assert.equal(observer.CPU_SHA,'a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295');
 assert.equal(hash(read(observer.CPU_PATH)),current.modules[observer.CPU_PATH]);
 await assert.rejects(observer.prepare({version:'dev',slot:0,getExports(){throw Error('no exports');},getMemory(){throw Error('no memory');},nativeWrites:true}),/Quake II canonical PATHHASH build\/wine-assembly.wasm/);
 assert.equal(compiled,0);assert.equal(attached,0);
 assert.deepEqual(requests.map(r=>r.name),[core.EXE,observer.CPU_PATH]);
 for(const r of requests){assert.equal(r.version,'dev');assert.equal(r.options.cache,'no-store');assert.equal(r.options.credentials,'same-origin');}
 assert.throws(()=>guard.validate({moduleVersion:current.version}),/Q2 browser canonical CPU disagrees with staged module/);
 assert.throws(()=>guard.validate(),/explicit supported Q2 module version/);
 assert.throws(()=>guard.browserBinding(closure.files.filter(p=>p.path!=='lib/quake2-browser-load-observer.js')),/undeclared Q2 browser provider/);
 assert.throws(()=>guard.browserBinding(closure.files.map(p=>p.path==='lib/quake2-browser-load-observer.js'?{...p,sha256:'0'.repeat(64)}:p)),/Q2 browser provider SHA/);
 assert.throws(()=>guard.browserBinding(closure.files.filter(p=>p.path!==observer.CPU_PATH)),/undeclared Q2 browser CPU/);
 // Authored policy control only: exact bytes are still required, and the guard
 // never obtains authority to replace the production observer's historical pin.
 const cpu=Buffer.from('authored policy control'),source=Buffer.from(`globalThis.Quake2BrowserLoadObserver=Object.freeze({prepare(){},CPU_PATH:'control.wasm',CPU_SHA:'${hash(cpu)}'});`);
 const fixtures=new Map([['lib/quake2-browser-load-observer.js',source],['control.wasm',cpu]]);
 const pins=[...fixtures].map(([name,b])=>({path:name,size:b.length,sha256:hash(b)}));
 assert.equal(guard.browserBinding(pins,n=>fixtures.get(n)).sha256,hash(cpu));
 assert.throws(()=>guard.browserBinding(pins,n=>n==='control.wasm'?Buffer.from('changed policy control'):fixtures.get(n)),/Q2 browser provider size/);
 console.log(JSON.stringify({passed:true,oldByteClosureAccepted:true,actualBrowserPrepareRefused:true,newPreallocationGuardRefused:true,compiled,attached,requests:requests.map(r=>r.name),nativeQualification:false,providersUnchanged:true}));
})().catch(e=>{console.error(e);process.exitCode=1;});
