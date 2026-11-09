'use strict';
// Q2 preallocation check. Byte-complete staging alone does not establish that
// the owning browser observer accepts the CPU selected by the preparer.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const current=require('./quake2-current-module.cjs'),root=path.resolve(__dirname,'..');
const observerPath='lib/quake2-browser-load-observer.js';
const policy=require('./quake2-current-browser-policy.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function browserBinding(files,read=name=>fs.readFileSync(path.join(root,name)),browserPolicyVersion){
 const declared=new Map(files.map(p=>[p.path,p]));
 function bytes(name){
  const pin=declared.get(name);assert(pin,'undeclared Q2 browser provider: '+name);
  const b=read(name);assert.equal(b.length,pin.size,'Q2 browser provider size: '+name);assert.equal(hash(b),pin.sha256,'Q2 browser provider SHA: '+name);return b;
 }
 const context=vm.createContext({});
 // Read policy from the actual provider without calling prepare, compiling a
 // CPU, attaching an observer, starting a Worker or changing any provider.
 vm.runInContext(bytes(observerPath).toString(),context,{filename:observerPath,timeout:1000});
 let observer=context.Quake2BrowserLoadObserver;
 if(browserPolicyVersion!==undefined){
  assert.equal(browserPolicyVersion,policy.version,'explicit Q2 browser policy version required');
  assert.equal(observer.CURRENT_POLICY_VERSION,browserPolicyVersion,'owning browser policy route missing');
  vm.runInContext(bytes(policy.provider).toString(),context,{filename:policy.provider,timeout:1000});
  observer=context.Quake2CurrentBrowserPolicyV1;
  assert.equal(observer.POLICY_VERSION,browserPolicyVersion,'owning browser policy version mismatch');
 }
 assert(observer&&typeof observer.prepare==='function','Q2 browser prepare missing');
 const pin=declared.get(observer.CPU_PATH);assert(pin,'undeclared Q2 browser CPU: '+observer.CPU_PATH);
 bytes(observer.CPU_PATH);
 assert.equal(observer.CPU_SHA,pin.sha256,'Q2 browser canonical CPU disagrees with staged module: '+observer.CPU_PATH);
 return {path:observer.CPU_PATH,sha256:pin.sha256,size:pin.size,observerPath,...(browserPolicyVersion?{browserPolicyVersion,policyProvider:policy.provider}:{})};
}
function validatePublished(options){
 const closure=current.validate(options);
 return {...closure,browserBinding:browserBinding(closure.files,undefined,closure.browserPolicyVersion)};
}
function validate(options){
 if(process.env.QUAKE2_CURRENT_BROWSER_COMPOSITION==='1'){
  // The explicit production preload calls this entrypoint on the staged
  // runtime, which has no Git repository. Preparation always takes the
  // published validator below, even if a launch environment was inherited.
  assert.deepEqual(options,{moduleVersion:current.browserModuleVersion,browserPolicyVersion:policy.version},'explicit Q2 runtime validation options');
  assert.equal(process.env.QUAKE2_BROWSER_POLICY_VERSION,policy.version,'explicit Q2 runtime policy required');
  assert.equal(path.resolve(process.argv[1]||''),path.join(root,require('./quake2-native-driver-composition.cjs').consumerPath),'actual Q2 runtime consumer required');
  assert(process.env.QUAKE2_NATIVE_RUN,'fresh staged Q2 run required');
  return runtimeBinding(JSON.parse(fs.readFileSync(path.join(process.env.QUAKE2_NATIVE_RUN,'runtime-pins.json'))));
 }
 return validatePublished(options);
}
function runtimeBinding(pins,read=name=>fs.readFileSync(path.join(root,name))){
 // Runtime staging has no Git repository. The trusted preparer supplies this
 // manifest; fixed source/CPU mirrors below additionally prevent policy/hash
 // substitution even when checking a damaged manifest offline.
 assert.equal(pins.moduleVersion,current.browserModuleVersion,'staged Q2 browser module version required');
 assert.equal(pins.browserPolicyVersion,policy.version,'staged Q2 browser policy version required');
 assert.equal(pins.publishedBrowserPolicyCommit,current.browserPolicyCommit,'staged Q2 browser authority required');
 assert.equal(Object.keys(current.browserProviders).length,3,'published Q2 browser runtime mirrors required');
 const seen=new Set();
 for(const pin of pins.files){
  assert(typeof pin.path==='string'&&!path.isAbsolute(pin.path)&&!pin.path.split('/').includes('..')&&!seen.has(pin.path),'invalid/duplicate Q2 runtime provider');seen.add(pin.path);
  const b=read(pin.path);assert.equal(b.length,pin.size,'Q2 runtime provider size: '+pin.path);assert.equal(hash(b),pin.sha256,'Q2 runtime provider SHA: '+pin.path);
 }
 for(const [name,sha256] of Object.entries({...current.modules,...current.browserProviders})){
  const pin=pins.files.find(p=>p.path===name);assert(pin,'missing Q2 runtime policy provider: '+name);assert.equal(pin.sha256,sha256,'published Q2 runtime policy SHA: '+name);
 }
 const binding=browserBinding(pins.files,read,pins.browserPolicyVersion);
 return {...pins,version:current.browserModuleVersion,browserBinding:binding};
}
function prepare(destination,options){
 destination=path.resolve(destination);assert(!fs.existsSync(destination),'fresh task-owned destination required');
 const closure=validatePublished(options);
 const composed=policy.compose({browserPolicyVersion:closure.browserPolicyVersion,custodyVersion:'publishedf977ebf7c'});
 for(const ref of composed.references)assert(closure.files.some(p=>p.path===ref.path&&p.sha256===ref.sha256&&p.size===ref.size),'staged actual Q2 caller provider required: '+ref.path);
 const pins={commit:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:root}).toString().trim(),...closure,
  moduleVersion:closure.version,observationFlags:{WINE_QUAKE2_LOAD_OBSERVATION:true,WINE_QUAKE2_NATIVE_WRITE_OBSERVATION:true},
  runtimeEnvironment:{QUAKE2_CURRENT_BROWSER_COMPOSITION:'1',QUAKE2_BROWSER_POLICY_VERSION:policy.version,QUAKE2_NATIVE_CUSTODY_VERSION:'publishedf977ebf7c',QUAKE2_NATIVE_WRITER_WITNESS:'1'},
  preload:'tools/quake2-current-browser-policy.cjs',
  consumerPreflight:{tool:'tools/quake2-staged-closure-gameplay.cjs',argument:'--consumer-preflight',input:'runtime-pins.json'}};
 fs.mkdirSync(destination,{recursive:true});
 fs.writeFileSync(path.join(destination,'runtime-pins.json'),JSON.stringify(pins,null,2),{flag:'wx',mode:0o444});
 return pins;
}
function consumerPreflight(manifest){
 // The provisioner passes a manifest FILE, not its containing directory.
 // Keep this boundary in the production CLI so preallocation and the staged
 // check exercise the same consumer and argument contract.
 manifest=path.resolve(manifest);
 assert.equal(path.basename(manifest),'runtime-pins.json','explicit runtime-pins.json file required');
 assert(fs.statSync(manifest).isFile(),'runtime manifest must be a file');
 const run=path.dirname(manifest),pins=JSON.parse(fs.readFileSync(manifest));
 runtimeBinding(pins);
 assert.equal(pins.preload,'tools/quake2-current-browser-policy.cjs','explicit current browser preload required');
 assert.equal(pins.runtimeEnvironment.QUAKE2_NATIVE_WRITER_WITNESS,'1');
 assert.equal(pins.runtimeEnvironment.QUAKE2_NATIVE_CUSTODY_VERSION,'publishedf977ebf7c');
 const loaded=current.writerClosure(pins.files);
 assert(loaded.includes('tools/quake2-owning-load-witness.cjs'));
 const composed=policy.compose({browserPolicyVersion:policy.version,custodyVersion:'publishedf977ebf7c'});
 assert(composed.source.includes('q2BrowserPolicy'));
 for(const p of composed.references)assert(pins.files.some(f=>f.path===p.path&&f.size===p.size&&f.sha256===p.sha256),'actual caller reference: '+p.path);
 const helper='scratch/runs/20261109-quake2-current-policy-guard-door-1645/';
 const hooks=['health-preload.cjs','native-fixture.cjs','observer-preload.cjs'].map(n=>helper+n);
 for(const name of hooks)assert(pins.files.some(p=>p.path===name),'undeclared consumer hook: '+name);
 const env={...process.env,...pins.runtimeEnvironment,QUAKE2_NATIVE_RUN:run,QUAKE2_STAGED_ROOT:root,Q2_INPUT_WIRE:'1',DRIVER_PREFLIGHT:'1',BROWSER_DEADLINE:String(Date.now()+90000)};
 delete env.QUAKE2_NATIVE_COMPOSITION;delete env.NODE_OPTIONS;
 const args=hooks.flatMap((name,i)=>i===1?['--require',root+'/'+pins.preload,'--require',root+'/'+name]:['--require',root+'/'+name]);
 args.push(root+'/'+require('./quake2-native-driver-composition.cjs').consumerPath);
 const result=require('node:child_process').spawnSync(process.execPath,args,{cwd:root,env,encoding:'utf8',timeout:15000});
 fs.writeFileSync(run+'/consumer-preflight.stdout',result.stdout??'');fs.writeFileSync(run+'/consumer-preflight.stderr',result.stderr??'');
 assert.equal(result.status,0,result.stderr||String(result.error));
 const receipt=JSON.parse(result.stdout);assert(receipt.passed&&!receipt.chromiumStarted&&!receipt.originalStarted);
 const observed=JSON.parse(fs.readFileSync(run+'/observed-composition.json'));
 assert(observed.fixture&&observed.wire&&observed.health&&observed.preflight);
 assert.equal(observed.flags.QUAKE2_BROWSER_POLICY_VERSION,policy.version);
 return {passed:true,manifest,loaded,actualConsumer:receipt,observed,generatedSHA:hash(composed.source),chromeStarted:false,nativeQualification:false};
}
module.exports={validate,browserBinding,prepare,runtimeBinding,consumerPreflight};
if(require.main===module){
 try{
  if(process.argv[2]==='--consumer-preflight'){
   assert.equal(process.argv.length,4,'one runtime manifest file required');
   console.log(JSON.stringify(consumerPreflight(process.argv[3])));return;
  }
  const args=process.argv.slice(2),preparing=args[0]==='--prepare';if(preparing)args.shift();
  const destination=preparing?args.shift():null,moduleVersion=args.shift(),browserPolicyVersion=args.shift();
  assert.equal(args.length,0,'unexpected Q2 preparation argument');
  const v=preparing?prepare(destination,{moduleVersion,browserPolicyVersion}):validate({moduleVersion,browserPolicyVersion});
  console.log(JSON.stringify({passed:true,version:v.version,browserBinding:v.browserBinding,nativeQualification:false,allocationAllowedByThisCheck:true}));
 }
 catch(e){console.error(JSON.stringify({passed:false,error:e.message,allocationAllowedByThisCheck:false,nativeQualification:false}));process.exitCode=1;}
}
