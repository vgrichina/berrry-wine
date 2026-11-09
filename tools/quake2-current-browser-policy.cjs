'use strict';
// Q2-only adapter for the actual retained production caller. No launch on
// import. It selects a policy on the owning Worker's URL, never a caller hash.
const assert=require('node:assert/strict'),path=require('node:path'),Module=require('node:module');
const composition=require('./quake2-native-driver-composition.cjs');
const version='quake2-current-primary-3e491c08-v1';
const provider='lib/quake2-current-browser-policy-v1.js';
const observer='lib/quake2-browser-load-observer.js';
function selectWorkerPolicy(policyVersion){
 if(policyVersion!=='quake2-current-primary-3e491c08-v1')throw Error('unsupported Q2 browser policy version');
 const original=WineAssembly.versionedUrl;
 WineAssembly.versionedUrl=function(source){
  const value=original.call(this,source);
  if(source!=='lib/guest-worker.js')return value;
  const url=new URL(value,location.href);
  if(url.searchParams.has('q2BrowserPolicy'))throw Error('Q2 browser policy already selected');
  url.searchParams.set('q2BrowserPolicy',policyVersion);return url.href;
 };
}
function compose({browserPolicyVersion,...options}={}){
 assert.equal(browserPolicyVersion,version,'explicit Q2 browser policy version required');
 assert(Object.keys(options).every(k=>k==='custodyVersion'),'unsupported Q2 browser composition option');
 const result=composition.compose(options);
 const seam='shell.launchApp(\'quake2_demo\');';
 const source=composition.replaceOnce(result.source,seam,`(${selectWorkerPolicy.toString()})(${JSON.stringify(version)});${seam}`);
 return {...result,source,browserPolicyVersion};
}
function install(){
 assert.equal(process.env.QUAKE2_BROWSER_POLICY_VERSION,version,'explicit Q2 browser policy version required');
 // Validate and bind every provider before registering the actual caller.
 assert(process.env.QUAKE2_NATIVE_COMPOSITION!=='1','use only the versioned Q2 browser preload');
 const closure=require('./quake2-staged-closure-gameplay.cjs').validate({moduleVersion:require('./quake2-current-module.cjs').browserModuleVersion,browserPolicyVersion:version});
 const fs=require('node:fs'),root=path.resolve(__dirname,'..');
 const run=path.resolve(process.env.QUAKE2_NATIVE_RUN||'');
 assert(process.env.QUAKE2_NATIVE_RUN&&run!==path.dirname(path.join(root,composition.consumerPath)),'fresh staged Q2 run required');
 const pins=JSON.parse(fs.readFileSync(path.join(run,'runtime-pins.json')));
 assert.equal(pins.browserPolicyVersion,version,'staged Q2 browser policy version required');
 assert.equal(pins.moduleVersion,closure.version,'staged Q2 browser module version required');
 assert.equal(pins.publishedBrowserPolicyCommit,closure.publishedBrowserPolicyCommit,'staged Q2 browser authority required');
 for(const ref of closure.files)assert(pins.files.some(p=>p.path===ref.path&&p.sha256===ref.sha256&&p.size===ref.size),'staged Q2 browser policy provider required: '+ref.path);
 // Reuse all existing lifecycle/input loader hooks; replace only its result
 // for the retained consumer. Physical admission remains in that consumer.
 composition.install();
 const previous=Module._extensions['.cjs']||Module._extensions['.js'];
 const result=compose({browserPolicyVersion:version,custodyVersion:process.env.QUAKE2_NATIVE_CUSTODY_VERSION});
 Module._extensions['.cjs']=function(module,filename){
  if(filename===path.join(root,composition.consumerPath))return module._compile(result.source,filename);
  return previous(module,filename);
 };
 return closure;
}
module.exports={version,provider,observer,compose,selectWorkerPolicy,install};
if(require.main!==module&&process.env.QUAKE2_CURRENT_BROWSER_COMPOSITION==='1')install();
