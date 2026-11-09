'use strict';
// Redline-only preparation and outer launch wiring. Published providers retain
// their own implementation, syscall ownership, deadlines and retrieval checks.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),version='redline-current-publication-daa44c07c-v1';
const cpu='5c8780318afbbe0e5a4e7c64190f2e0abde21cd0';
const published={
 'tools/native_kernel_custody.py':'f977ebf7c28977d7d95eb404f43db2209d163dde',
 'tools/native_publication_launch.py':'d0a9965a8',
 'tools/native_publication_observer.py':'d54aa57e3',
 'tools/redline-native-trace.cjs':'06a42152c',
 'tools/q3-input-wire-observation.cjs':'0da998bf82af29497178e2df7614e0b7e2cb9cc5',
 'tools/redline-publication-caller.cjs':'daa44c07c',
 'tools/redline-publication-snapshots.py':'daa44c07c',
 'tools/redline-startup-boundary.cjs':'8fd1a5421'
};
for(const name of ['host.js','lib/guest-thread-host.js','lib/guest-worker.js','lib/region-map.generated.js',
 'src/00-regions.wat','src/03-registers.wat','src/05b-string-ops.wat','src/13-exports.wat'])published[name]=cpu;
const builds={
 'build/wine-assembly.wasm':{size:2186068,sha256:'3e491c0840bb7771328738a0d160b4bbaa3d7ab72074cbd38a7b41e5d7e8ec18'},
 'build/wine-assembly.compat.wasm':{size:2188714,sha256:'ecb45716b1ee7fc5218b1670dd270b19c7664ee30d000b3360a12786a1c21eaf'}
};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=n=>fs.readFileSync(path.join(root,n));
const pin=(name,b)=>({path:name,size:b.length,sha256:sha(b)});
const git=args=>cp.execFileSync('git',args,{cwd:root,maxBuffer:32*1024*1024});
// Write-once milestones survive cancellation without waiting for cleanup.
// Elapsed time is process-local; these records do not attribute syscall cost.
function phases(run,label,write=(name,value)=>require('./redline-startup-boundary.cjs').writeDiagnostic(path.join(run,name),value)){
 const started=performance.now();let sequence=0;
 return (phase,detail={})=>{
  assert(sequence<64,'bounded production phase records');
  write(label+'-phase-'+process.pid+'-'+String(sequence++).padStart(2,'0')+'.json',
   {phase,pid:process.pid,unixMs:Date.now(),elapsedMs:performance.now()-started,browserDeadline:Number(process.env.BROWSER_DEADLINE),...detail});
 };
}
function prebrowserSource(source){
 source=require('./redline-command-trace.cjs').integrate(source);
 source=require('./redline-menu-planning.cjs').integrate(source);
 const replace=(a,b)=>{assert.equal(source.split(a).length,2,'actual prebrowser phase seam: '+a);source=source.replace(a,b);};
 replace("if(ws?.readyState===1){const n=++id;","if(!firstFailure&&ws?.readyState===1){const n=++id;");
 replace("const pins=JSON.parse(fs.readFileSync(run+'/runtime-pins.json'));","const prebrowserPhase=require('./redline-current-publication.cjs').phases(run,'browser');prebrowserPhase('provider-validation-begin');const pins=JSON.parse(fs.readFileSync(run+'/runtime-pins.json'));");
 replace('const start=Date.now(),deadline=',"prebrowserPhase('provider-validation-end',{providers:pins.files.length,bytes:pins.files.reduce((n,p)=>n+p.size,0)});const start=Date.now(),deadline=");
 replace("serverAcquisition=require(root+'/test/static-server.js')","prebrowserPhase('server-acquisition-begin');serverAcquisition=require(root+'/test/static-server.js')");
 replace("await serverAcquisition;assert(!closing,", "await serverAcquisition;prebrowserPhase('server-acquisition-end');assert(!closing,");
 replace('const httpProof=[];for(const pin of pins.httpPins){',"prebrowserPhase('http-validation-begin');const httpProof=[];for(const pin of pins.httpPins){prebrowserPhase('http-pin-begin',{url:pin.url,bytes:pin.size});");
 replace("httpProof.push({...pin,status:r.status,actualSha256:sha(b)});", "httpProof.push({...pin,status:r.status,actualSha256:sha(b)});prebrowserPhase('http-pin-end',{url:pin.url,bytes:b.length});");
 replace("assert(!closing,'runtime terminal before browser creation');", "prebrowserPhase('http-validation-end');assert(!closing,'runtime terminal before browser creation');prebrowserPhase('browser-launch-begin');");
 return source;
}
function optin(selected){assert.equal(selected,version,'unknown Redline current publication version');}
function validate(selected,startupVersion){
 optin(selected);if(startupVersion!==undefined)require('./redline-current-startup.cjs').optin(startupVersion);
 const legacy=require('./redline-current-module.cjs'),raw=read(legacy.historical);
 assert.equal(sha(raw),legacy.historicalSHA,'historical pinset integrity');
 const prior=JSON.parse(raw),expected=Object.fromEntries(Object.entries(builds).map(([name,p])=>[name,{path:name,...p}])),seen=new Set(),explainedDrift=[];
 if(startupVersion!==undefined)Object.assign(expected,require('./redline-current-startup.cjs').admissionPins());
 expected['tools/redline-menu-planning.cjs']=pin('tools/redline-menu-planning.cjs',read('tools/redline-menu-planning.cjs'));
 expected['tools/redline-command-trace.cjs']=pin('tools/redline-command-trace.cjs',read('tools/redline-command-trace.cjs'));
 for(const p of prior.files){assert(!seen.has(p.path),'duplicate historical pin');seen.add(p.path);}
 for(const commit of new Set([cpu,...Object.values(published),'06a42152c','d7459f3f6','daa44c07c']))
  for(const target of ['HEAD','origin/main'])git(['merge-base','--is-ancestor',commit,target]);
 const sources=git(['ls-tree','-r','--name-only',cpu,'--','src','tools/watx-src','tools/watx.js','tools/watx-closure.js','tools/build-compile-wat.js']).toString().trim().split('\n');
 for(const name of sources)assert.equal(sha(read(name)),sha(git(['show',cpu+':'+name])),'published build source: '+name);
 for(const [name,commit] of Object.entries(published))expected[name]=pin(name,git(['show',commit+':'+name]));
 for(const name of Object.keys(builds))assert(seen.has(name),'build requires historical pin');
 const files=prior.files.map(p=>{
  const actual=pin(p.path,read(p.path));assert.deepEqual(actual,expected[p.path]??p,'provider drift: '+p.path);
  if(expected[p.path])explainedDrift.push({before:p,after:actual,reason:'Exact published '+(published[p.path]??cpu)+' for explicit '+version});
  return actual;
 });
 for(const [name,want] of Object.entries(expected))if(!seen.has(name)){
  assert.deepEqual(pin(name,read(name)),want,'published transitive provider: '+name);files.push(want);
 }
 // Check the shipped adapter's independent digest pins as well as Git provenance.
 require('./redline-publication-caller.cjs').verify();
 const httpPins=prior.httpPins.map(p=>{
  const before=prior.files.find(f=>f.path===p.url.slice(1)),after=files.find(f=>f.path===p.url.slice(1));
  assert(before&&after,'HTTP provider');assert.equal(p.size,before.size);assert.equal(p.sha256,before.sha256);
  return {...p,size:after.size,sha256:after.sha256};
 });
 for(const name of ['tools/redline-current-module.cjs','tools/redline-current-publication.cjs','tools/redline-bounded-custody.py']){
  assert(!files.some(p=>p.path===name),'unique preparer pin');files.push(pin(name,read(name)));
 }
 return {files,httpPins,moduleVersion:version,publicationVersion:version,...(startupVersion!==undefined?{startupVersion}:{}),publishedModuleCommit:cpu,
  historicalPinset:{path:legacy.historical,sha256:legacy.historicalSHA,commit:prior.commit},explainedDrift};
}
const bridges=['bound-input.cjs','ordinary-keys.cjs','native-mouse.cjs','relative-input.cjs','keyboard-bridge.cjs','transport.cjs'];
function closureSHA(files){return sha(Buffer.from(JSON.stringify([...files].sort((a,b)=>a.path.localeCompare(b.path)))));}
function callerSource(run,digest,startupVersion){
 return "'use strict';\nrequire("+JSON.stringify('./'+path.relative(run,path.join(__dirname,'redline-current-publication.cjs')))+").runCaller(__dirname,"+JSON.stringify(version)+","+JSON.stringify(digest)+(startupVersion!==undefined?","+JSON.stringify(startupVersion):"")+");\n";
}
function prepare(run,selected,startupVersion){
 optin(selected);run=path.resolve(run);assert(!fs.existsSync(run),'fresh task-owned run required');
 const pins=validate(selected,startupVersion),prior=path.dirname(require('./redline-native-trace.cjs').generatedPath);
 const inputs=bridges.map(name=>[name,"'use strict';\nmodule.exports=require("+JSON.stringify('./'+path.relative(run,path.join(root,prior,name)))+");\n"]);
 for(const [name,source] of inputs)pins.files.push(pin(path.relative(root,path.join(run,name)),Buffer.from(source)));
 const caller=callerSource(run,closureSHA(pins.files),startupVersion);inputs.push(['publication-caller.cjs',caller]);
 pins.files.push(pin(path.relative(root,path.join(run,'publication-caller.cjs')),Buffer.from(caller)));
 pins.files.sort((a,b)=>a.path.localeCompare(b.path));pins.commit=git(['rev-parse','HEAD']).toString().trim();
 const bytes=Buffer.from(JSON.stringify(pins,null,2));
 const plan={offlinePrepared:true,nativeAttemptAuthorized:false,fixtureOnly:true,moduleVersion:version,
  publicationVersion:version,...(startupVersion!==undefined?{startupVersion}:{}),providers:pins.files.length,manifestSHA256:sha(bytes),traceDurationSeconds:10,
  commands:[{key:',',holdMs:600,waitMs:0},'ordinary joined quit'],
  argv:[process.execPath,path.join(__dirname,'redline-current-publication.cjs'),'--fixture',run,version,...(startupVersion!==undefined?[startupVersion]:[])],
  env:{REDLINE_RUN:run,REDLINE_NATIVE_TRACE:'1',REDLINE_STARTUP_BOUNDARY:'1',BROWSER_DEADLINE:'REQUIRED future immutable deadline; existing <30min cap'},
  prerequisite:'Separate native authorization and prearmed independent watchdog required',nativeReady:false};
 // All authentication and generation finish before any destination write.
 fixtureSource(selected,startupVersion);require('./redline-startup-boundary.cjs').integrate();
 fs.mkdirSync(run,{recursive:true});
 for(const [name,source] of inputs)fs.writeFileSync(path.join(run,name),source,{flag:'wx',mode:0o444});
 fs.writeFileSync(path.join(run,'runtime-pins.json'),bytes,{flag:'wx',mode:0o444});
 fs.writeFileSync(path.join(run,'replacement-pinset-seal.json'),JSON.stringify({moduleVersion:version,manifestSHA256:sha(bytes),providers:pins.files.length}),{flag:'wx',mode:0o444});
 fs.writeFileSync(path.join(run,'experiment-plan.json'),JSON.stringify(plan,null,2),{flag:'wx',mode:0o444});
 return plan;
}
function prelaunch(run,selected,startupVersion){
 optin(selected);run=path.resolve(run);const versioned=validate(selected,startupVersion);
 const raw=fs.readFileSync(path.join(run,'runtime-pins.json')),pins=JSON.parse(raw);
 const seal=JSON.parse(fs.readFileSync(path.join(run,'replacement-pinset-seal.json')));
 assert.equal(seal.manifestSHA256,sha(raw),'sealed actual staged manifest');
 assert.equal(pins.publicationVersion,version);assert.equal(pins.moduleVersion,version);assert.equal(pins.startupVersion,startupVersion);
 const expected=[...versioned.files];
 const prior=path.dirname(require('./redline-native-trace.cjs').generatedPath);
 for(const name of bridges)expected.push(pin(path.relative(root,path.join(run,name)),Buffer.from("'use strict';\nmodule.exports=require("+JSON.stringify('./'+path.relative(run,path.join(root,prior,name)))+");\n")));
 expected.push(pin(path.relative(root,path.join(run,'publication-caller.cjs')),Buffer.from(callerSource(run,closureSHA(expected),startupVersion))));
 assert.deepEqual(pins.files,expected.sort((a,b)=>a.path.localeCompare(b.path)),'authenticated narrow staged closure');
 assert.deepEqual(pins.httpPins,versioned.httpPins,'authenticated HTTP pins');
 for(const p of pins.files)assert.deepEqual(pin(p.path,read(p.path)),p,'staged provider before spawn: '+p.path);
 return pins;
}
function launch({run,publicationVersion,startupVersion,deadline,options,spawn}={}){
 prelaunch(run,publicationVersion,startupVersion);
 assert(Number.isFinite(deadline)&&deadline>Date.now()&&deadline-Date.now()<30*60000,'original browser deadline');
 const custody=path.join(run,'publication-custody');assert(!fs.existsSync(custody),'fresh custody run');
 fs.mkdirSync(custody);fs.writeFileSync(path.join(custody,'lifecycle.json'),JSON.stringify({browserDeadline:deadline}),{flag:'wx'});
 const adapter=require('./redline-publication-caller.cjs');
 return adapter.launch({run:custody,observerVersion:adapter.version,argv:[process.execPath,path.join(run,'publication-caller.cjs')],options,spawn:(...args)=>boundedCustodySpawn(spawn??cp.spawn,...args)});
}
// The published launcher/observer/collector stay byte-exact. Only this explicit
// authenticated current route uses bounded syscall diagnostics. Retrieval still
// runs the published snapshot validator and reports capped observations incomplete.
function boundedCustodySpawn(spawn,exe,argv,options){
 assert.equal(argv[0],path.join(__dirname,'native_publication_launch.py'),'published custody command');
 return spawn(exe,[path.join(__dirname,'redline-bounded-custody.py'),'--bounded-custody=redline-bounded-custody-v1',...argv.slice(1)],options);
}
// The preparing parent authenticates Git provenance and passes this exact digest
// independently of the staged files. Never derive the trusted digest from a
// mutable manifest/seal inside the runtime. This also runs before each spawn.
function stagedPrelaunch(run,selected,startupVersion,manifestSHA256){
 optin(selected);require('./redline-current-startup.cjs').optin(startupVersion);
 assert.match(manifestSHA256??'',/^[a-f0-9]{64}$/,'independent prepared manifest SHA required');
 run=path.resolve(run);const raw=fs.readFileSync(path.join(run,'runtime-pins.json'));
 assert.equal(sha(raw),manifestSHA256,'independent prepared manifest SHA mismatch');
 const pins=JSON.parse(raw),seal=JSON.parse(fs.readFileSync(path.join(run,'replacement-pinset-seal.json')));
 assert.equal(seal.manifestSHA256,manifestSHA256);assert.equal(seal.providers,pins.files.length);
 assert.equal(pins.publicationVersion,selected);assert.equal(pins.moduleVersion,selected);assert.equal(pins.startupVersion,startupVersion);
 const seen=new Set();for(const p of pins.files){assert(!seen.has(p.path),'unique staged provider');seen.add(p.path);assert.deepEqual(pin(p.path,read(p.path)),p,'staged production provider: '+p.path);}
 const caller=path.relative(root,path.join(run,'publication-caller.cjs'));
 assert(seen.has(caller),'prepared owning caller required');
 assert.equal(fs.readFileSync(path.join(run,'publication-caller.cjs'),'utf8'),callerSource(run,closureSHA(pins.files.filter(p=>p.path!==caller)),startupVersion),'prepared owning caller digest');
 require('./redline-publication-caller.cjs').verify();return pins;
}
function stagedLaunch({run,publicationVersion,startupVersion,manifestSHA256,deadline,options,spawn}={}){
 stagedPrelaunch(run,publicationVersion,startupVersion,manifestSHA256);
 assert(Number.isFinite(deadline)&&deadline>Date.now()&&deadline-Date.now()<30*60000,'original browser deadline');
 const custody=path.join(run,'publication-custody');assert(!fs.existsSync(custody),'fresh custody run');
 fs.mkdirSync(custody);fs.writeFileSync(path.join(custody,'lifecycle.json'),JSON.stringify({browserDeadline:deadline}),{flag:'wx'});
 const adapter=require('./redline-publication-caller.cjs');
 return adapter.launch({run:custody,observerVersion:adapter.version,argv:[process.execPath,path.join(run,'publication-caller.cjs')],options,spawn:(...args)=>boundedCustodySpawn(spawn??cp.spawn,...args)});
}
function fixtureSource(selected,startupVersion,manifestSHA256){
 optin(selected);let source=require('./redline-startup-boundary.cjs').fixtureSource();
 const before="cp.spawn(process.execPath,[path.join(__dirname,'redline-startup-boundary.cjs'),'--caller'],{detached:true,env:{...process.env,REDLINE_NATIVE_FIXTURE:'1'},stdio:['ignore','pipe','pipe']})";
 assert.equal(source.split(before).length,2,'actual controller outer launch seam');
 if(manifestSHA256!==undefined){require('./redline-current-startup.cjs').optin(startupVersion);assert.match(manifestSHA256,/^[a-f0-9]{64}$/);}
 source=source.replace(before,"require('./redline-current-publication.cjs')."+(manifestSHA256!==undefined?'stagedLaunch':'launch')+"({run,publicationVersion:"+JSON.stringify(version)+(startupVersion!==undefined?",startupVersion:"+JSON.stringify(startupVersion):"")+(manifestSHA256!==undefined?",manifestSHA256:"+JSON.stringify(manifestSHA256):"")+",deadline,options:{detached:true,env:{...process.env,REDLINE_NATIVE_FIXTURE:'1'},stdio:['ignore','pipe','pipe']}})");
 const automaticReview="transport.publish(out+'/'+capture.label+'-review.json',{...capture,review:'Synthetic fixture control; verify authenticated owner and ordinary input release.'});";
 assert.equal(source.split(automaticReview).length,2,'one synthetic review site');
 source=source.replace(automaticReview,"while(!fs.existsSync(out+'/'+capture.label+'-review.json')){check();await wait(25);}const reviewed=JSON.parse(fs.readFileSync(out+'/'+capture.label+'-review.json'));assert.equal(reviewed.sha256,capture.sha256,'reviewed exact returned image');assert(reviewed.review?.trim(),'explicit image review required');");
 source=source.replace('const child=',"const controllerPhase=require('./redline-current-publication.cjs').phases(run,'controller');controllerPhase('validated-launch-begin');const child=");
 source=source.replace("watchdog.stdin.write(child.pid+'\\n');","controllerPhase('custody-spawn-returned',{childPID:child.pid});watchdog.stdin.write(child.pid+'\\n');");
 const joined="assert.equal(watched.code,0,'independent watchdog must be explicitly disarmed and joined');";
 assert.equal(source.split(joined).length,2,'actual controller joined retrieval seam');
 // Preserve cleanup checks and retrieval, without replacing the caught error.
 source=source.replace('let failure,receipt;','let failure,receipt;const cleanupErrors=[];');
 const caught='}catch(e){failure=e;';assert.equal(source.split(caught).length,2);
 source=source.replace(caught,caught+"try{save('fixture-first-error.json',{error:e.stack??String(e),unixMs:Date.now(),browserDeadline:deadline,nativeReadiness:'UNKNOWN',browserEOF:'UNKNOWN'});}catch(writeError){cleanupErrors.push(writeError);}");
 source=source.replace(joined,"try{"+joined+"}catch(e){cleanupErrors.push(e);}try{save('publication-retrieval.json',require('./redline-publication-caller.cjs').retrieve(run+'/publication-custody'));}catch(e){cleanupErrors.push(e);}");
 source=source.replace('finally{\n  receipt=await exit;', 'finally{\n  try{receipt=await exit;');
 source=source.replace('if(streamFailure)throw streamFailure;\n }',"if(streamFailure)cleanupErrors.push(streamFailure);\n  }catch(e){cleanupErrors.push(e);}\n  if(cleanupErrors.length)try{save('fixture-cleanup-errors.json',{errors:cleanupErrors.map(e=>e.stack??String(e)),firstError:failure?.stack??null});}catch(e){cleanupErrors.push(e);}\n }");
 source=source.replace('if(failure)throw failure;', 'if(failure)throw failure;if(cleanupErrors.length)throw cleanupErrors[0];');
 new(require('node:vm').Script)(source);return source;
}
function runCaller(run,selected,digest,startupVersion){
 // The generated small caller binds the complete authenticated provider list.
 // Parent prelaunch checks Git provenance before custody; inside custody check
 // those sealed bytes directly, without spawning Git/source-compiler children.
 optin(selected);const phase=phases(run,'caller');phase('caller-enter');
 try{
 phase('closure-validation-begin');const raw=fs.readFileSync(path.join(run,'runtime-pins.json')),pins=JSON.parse(raw);
 assert.equal(pins.moduleVersion,version);assert.equal(pins.publicationVersion,version);assert.equal(pins.startupVersion,startupVersion);
 assert.equal(sha(raw),JSON.parse(fs.readFileSync(path.join(run,'replacement-pinset-seal.json'))).manifestSHA256);
 const caller=path.relative(root,path.join(run,'publication-caller.cjs'));
 assert.equal(pins.files.filter(p=>p.path===caller).length,1);
 assert.equal(closureSHA(pins.files.filter(p=>p.path!==caller)),digest,'generated authenticated closure digest');
 for(const p of pins.files)assert.deepEqual(pin(p.path,read(p.path)),p,'actual caller pinned bytes: '+p.path);
 phase('closure-validation-end',{providers:pins.files.length,bytes:pins.files.reduce((n,p)=>n+p.size,0)});
 assert.equal(path.resolve(process.env.REDLINE_RUN),path.resolve(run));
 assert.equal(process.env.REDLINE_NATIVE_FIXTURE,'1');assert.equal(process.env.REDLINE_NATIVE_TRACE,'1');assert.equal(process.env.REDLINE_STARTUP_BOUNDARY,'1');
 phase('source-composition-begin');const source=require('./redline-startup-boundary.cjs').integrate();
 const actual=prebrowserSource(startupVersion!==undefined?require('./redline-current-startup.cjs').integrate(source):source);
 phase('source-composition-end');phase('browser-program-evaluation-begin');
 compile(actual,'redline-browser-run.cjs');phase('browser-program-evaluation-returned');
 }catch(e){try{require('./redline-startup-boundary.cjs').writeDiagnostic(path.join(run,'caller-first-error.json'),{error:e.stack??String(e),unixMs:Date.now(),browserDeadline:Number(process.env.BROWSER_DEADLINE)});}catch{}throw e;}
}
function compile(source,name){const Module=require('node:module'),filename=path.join(__dirname,name),m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(__dirname);m._compile(source,filename);}
module.exports={version,published,builds,validate,prepare,prelaunch,launch,stagedPrelaunch,stagedLaunch,fixtureSource,runCaller,phases,prebrowserSource};
if(require.main===module){
 const [mode,run,selected,startupVersion,manifestSHA256]=process.argv.slice(2);optin(selected);
 if(mode==='--prepare')console.log(JSON.stringify(prepare(run,selected,startupVersion)));
 else if(mode==='--staged-fixture'){
  stagedPrelaunch(run,selected,startupVersion,manifestSHA256);assert.equal(path.resolve(process.env.REDLINE_RUN),path.resolve(run));
  compile(fixtureSource(selected,startupVersion,manifestSHA256),'redline-native-fixture.cjs');
 }
 else {assert.equal(mode,'--fixture','explicit fixture mode');prelaunch(run,selected,startupVersion);assert.equal(path.resolve(process.env.REDLINE_RUN),path.resolve(run));compile(fixtureSource(selected,startupVersion),'redline-native-fixture.cjs');}
}
