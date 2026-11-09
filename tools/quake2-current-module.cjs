'use strict';
// Explicit published Q2 CPU/caller version; retained manifests stay immutable.
// Import does not select modules, prepare pins, allocate, or launch.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),assert=require('node:assert/strict'),vm=require('node:vm'),Module=require('node:module');
const root=path.resolve(__dirname,'..'),version="quake2-1495-published-5c8780318-writer-e5eff70be-f977ebf7c-v2";
const browserModuleVersion=version+'-browser-1605-v1';
// Exact published narrow browser implementation. Historical v2 continues to
// enforce its original provider pins and browser behavior.
const browserPolicyCommit='a16fc87d477d8891a741e1a214cfc89f5a924ac4';
// Runtime mirrors of the published browser implementation, never learned
// from runtime pins. The preparer cross-checks them against the Git authority.
const browserProviders=Object.freeze({
 'lib/quake2-browser-load-observer.js':'45cd7e009fa5718fff4ad6c8a7080f439eae993292fab63b920c2eb49a2f4fb6',
 'lib/quake2-current-browser-policy-v1.js':'3a5498e183a04444c5a55888a7cbfac482ef93dc209b7781c5f16633263ffbe2',
 'tools/quake2-current-browser-policy.cjs':'2a46d2471fdafcb4a685281ccf5aa4c1f6d43321df475207493089f1b33852a7'
});
const historical="scratch/runs/20261109-quake2-rejected-frame-native-progress-1265/runtime-pins.json",historicalSHA='af301be22ff45b1595eae654e5406f712152ef5ec80b524d3179c8f49d0b7553';
const authorities=Object.freeze({
  "host.js": "5c8780318",
  "lib/drakan-observer-worker.js": "a331104e9",
  "lib/guest-thread-host.js": "5c8780318",
  "lib/guest-worker.js": "5c8780318",
  "lib/region-map.generated.js": "5c8780318",
  "src/00-regions.wat": "5c8780318",
  "src/03-registers.wat": "5c8780318",
  "src/05b-string-ops.wat": "5c8780318",
  "src/13-exports.wat": "5c8780318",
  "tools/native_kernel_custody.py": "f977ebf7c",
  "tools/quake2-native-driver-composition.cjs": "e5eff70be",
  "tools/quake2-passive-attack.cjs": "43ec0e8cd",
  "tools/quake2-native-witness-install.cjs": "e5eff70be",
  "tools/quake2-shared-writer-witness.cjs": "e5eff70be",
  "tools/quake2-frame-writer-witness.cjs": "19f6794f4",
  "tools/quake2-owning-load-witness.cjs": "e65895936"
});
const modules=Object.freeze({'build/wine-assembly.wasm':'3e491c0840bb7771328738a0d160b4bbaa3d7ab72074cbd38a7b41e5d7e8ec18','build/wine-assembly.compat.wasm':'ecb45716b1ee7fc5218b1670dd270b19c7664ee30d000b3360a12786a1c21eaf'});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),read=n=>fs.readFileSync(path.join(root,n));
const git=a=>cp.execFileSync('git',a,{cwd:root,maxBuffer:32*1024*1024});
function published(commit){
 const sha=git(['rev-parse',commit+'^{commit}']).toString().trim();
 git(['merge-base','--is-ancestor',sha,'HEAD']);git(['merge-base','--is-ancestor',sha,'origin/main']);return sha;
}
function writerClosure(files){
 // Import actual caller dependencies in memory using ONLY declared local
 // providers. The shared checkout must not hide an unstaged transitive import.
 // This neither starts a Worker/browser nor arms the observer.
 const declared=new Map(files.map(p=>[p.path,p])),cache=new Map();
 const builtins=new Set(Module.builtinModules.flatMap(n=>[n,'node:'+n]));
 const declaredFS={...fs,readFileSync(file,options){
  const name=path.relative(root,path.resolve(root,String(file))),pin=declared.get(name);
  assert(pin,'undeclared Q2 writer file read: '+name);
  const bytes=read(name);assert.equal(bytes.length,pin.size,'writer file size: '+name);assert.equal(hash(bytes),pin.sha256,'writer file SHA: '+name);
  const encoding=typeof options==='string'?options:options?.encoding;return encoding?bytes.toString(encoding):bytes;
 }};
 function load(name){
  if(cache.has(name))return cache.get(name).exports;
  const pin=declared.get(name);assert(pin,'undeclared Q2 writer dependency: '+name);
  const bytes=read(name);assert.equal(bytes.length,pin.size,'writer closure provider size: '+name);assert.equal(hash(bytes),pin.sha256,'writer closure provider SHA: '+name);
  const m={exports:{}};cache.set(name,m);
  if(name.endsWith('.json')){m.exports=JSON.parse(bytes);return m.exports;}
  const filename=path.join(root,name);
  function localRequire(request){
   if(request==='fs'||request==='node:fs')return declaredFS;
   if(builtins.has(request))return require(request);
   assert(request.startsWith('.')||path.isAbsolute(request),'undeclared Q2 writer package: '+request);
   const base=path.relative(root,path.resolve(path.dirname(filename),request));
   const target=[base,base+'.js',base+'.cjs',base+'.json',base+'/index.js'].find(n=>declared.has(n));
   assert(target,'undeclared Q2 writer dependency: '+base);return load(target);
  }
  vm.runInThisContext(Module.wrap(bytes.toString()),{filename})(m.exports,localRequire,m,filename,path.dirname(filename));return m.exports;
 }
 const helper=load('tools/quake2-native-witness-install.cjs');assert.equal(typeof helper.createChain,'function');
 const shared=load('tools/quake2-shared-writer-witness.cjs');
 // Exercise the metadata setup constructor through the real binary witness.
 // Its returned page source is compiled, never evaluated or armed here.
 const page=shared.pageSource({globalName:'__q2DeclaredWriterClosure',identity:{processId:1,endpoint:1},installationToken:'offline-closure-check'});
 new vm.Script(page);return [...cache.keys()];
}
function validate(options={}){
 assert(Object.keys(options).every(k=>['moduleVersion','browserPolicyVersion'].includes(k)),'unsupported Q2 module validation option');
 const {moduleVersion,browserPolicyVersion}=options;
 const browser=moduleVersion===browserModuleVersion;
 assert(moduleVersion===version||browser,'explicit supported Q2 module version required');
 const policy=browser?require('./quake2-current-browser-policy.cjs'):null;
 if(browser)assert.equal(browserPolicyVersion,policy.version,'explicit Q2 browser policy version required');
 else assert.equal(browserPolicyVersion,undefined,'browser policy requires explicit browser module version');
 const selectedAuthorities={...authorities};
 if(browser){
  assert(browserPolicyCommit,'published Q2 browser policy authority required');
  for(const name of [policy.observer,policy.provider,'tools/quake2-current-browser-policy.cjs'])selectedAuthorities[name]=browserPolicyCommit;
 }
 const raw=read(historical);assert.equal(hash(raw),historicalSHA,'historical Q2 pinset integrity');
 const prior=JSON.parse(raw),seen=new Set(),changes=[],files=[];
 const cpuCommit=published('5c8780318');
 const sourcePaths=git(['ls-tree','-r','--name-only',cpuCommit,'--','src','tools/watx-src','tools/watx.js','tools/watx-closure.js','tools/build-compile-wat.js']).toString().trim().split('\n');
 for(const n of sourcePaths)assert.equal(hash(read(n)),hash(git(['show',cpuCommit+':'+n])),'published Q2 build source: '+n);
 const commits={};
 for(const c of new Set(Object.values(selectedAuthorities)))commits[c]=published(c);
 const pin=(name,b)=>({path:name,size:b.length,sha256:hash(b)});
 for(const before of prior.files){
  const n=before.path;assert(!seen.has(n),'duplicate historical Q2 provider');seen.add(n);
  const actual=pin(n,read(n));
  if(selectedAuthorities[n]){
   const expected=git(['show',commits[selectedAuthorities[n]]+':'+n]);
   assert.equal(actual.size,expected.length,'published Q2 provider size: '+n);
   assert.equal(actual.sha256,hash(expected),'published Q2 provider SHA: '+n);
   if(browserProviders[n]&&browser)assert.equal(actual.sha256,browserProviders[n],'published Q2 browser runtime mirror: '+n);
  }else if(modules[n])assert.equal(actual.sha256,modules[n],'published Q2 module SHA: '+n);
  else{assert.equal(actual.size,before.size,'unexplained Q2 provider size: '+n);assert.equal(actual.sha256,before.sha256,'unexplained Q2 provider SHA: '+n);}
  if(actual.sha256!==before.sha256)changes.push({before,after:actual,publishedCommit:selectedAuthorities[n]?commits[selectedAuthorities[n]]:cpuCommit});
  files.push(actual);
 }
 for(const [n,c] of Object.entries(selectedAuthorities))if(!seen.has(n)){
  const b=read(n),expected=git(['show',commits[c]+':'+n]);
  assert.equal(hash(b),hash(expected),'new published Q2 provider: '+n);files.push(pin(n,b));seen.add(n);
  if(browserProviders[n]&&browser)assert.equal(hash(b),browserProviders[n],'new published Q2 browser runtime mirror: '+n);
 }
 for(const n of Object.keys(modules))assert(seen.has(n),'missing historical Q2 module');
 const composed=require('./quake2-native-driver-composition.cjs').compose({custodyVersion:'publishedf977ebf7c'});
 for(const ref of composed.references)assert(files.some(p=>p.path===ref.path&&p.sha256===ref.sha256&&p.size===ref.size),'actual Q2 caller provider omitted: '+ref.path);
 const writerDependencies=writerClosure(files);
 const httpPins=prior.httpPins.map(p=>{
  const before=prior.files.find(f=>f.path===p.url.slice(1)),after=files.find(f=>f.path===p.url.slice(1));
  assert(before&&after,'HTTP Q2 provider required');assert.equal(p.sha256,before.sha256,'historical HTTP Q2 SHA');assert.equal(p.size,before.size,'historical HTTP Q2 size');
  return {...p,size:after.size,sha256:after.sha256};
 });
 if(browser){
  const p=files.find(p=>p.path===policy.provider);
  assert(!httpPins.some(p=>p.url==='/'+policy.provider),'duplicate Q2 browser policy HTTP pin');
  httpPins.push({url:'/'+p.path,size:p.size,sha256:p.sha256});
  for(const name of ['tools/quake2-current-module.cjs','tools/quake2-staged-closure-gameplay.cjs']){
   assert(!files.some(p=>p.path===name),'duplicate Q2 preparer provider');files.push(pin(name,read(name)));
  }
 }
 return {version:browser?browserModuleVersion:version,...(browser?{browserPolicyVersion,publishedBrowserPolicyCommit:commits[browserPolicyCommit]}:{}),files,httpPins,changes,writerDependencies,publishedModuleCommit:cpuCommit,historical:{path:historical,sha256:historicalSHA,commit:prior.commit},
  sourcePolicy:'Current bytes only; exact enumerated published changes. No historical Git provider substitution.',
  nativeQualification:false};
}
module.exports={validate,writerClosure,version,browserModuleVersion,browserPolicyCommit,browserProviders,historical,historicalSHA,authorities,modules};

