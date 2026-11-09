'use strict';
// Explicit Q3 integration of four reviewed, published foreign providers.
// Preparation uses Git provenance. The sealed runtime uses only exact bytes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const cp=require('node:child_process'),assert=require('node:assert/strict'),Module=require('node:module');
const root=path.resolve(__dirname,'..'),version='q3-current-foreign-a16fc87d4-44fc9a134-v1';
const authorities=Object.freeze({
 'lib/quake2-browser-load-observer.js':['a16fc87d477d8891a741e1a214cfc89f5a924ac4','45cd7e009fa5718fff4ad6c8a7080f439eae993292fab63b920c2eb49a2f4fb6'],
 'lib/quake2-current-browser-policy-v1.js':['a16fc87d477d8891a741e1a214cfc89f5a924ac4','3a5498e183a04444c5a55888a7cbfac482ef93dc209b7781c5f16633263ffbe2'],
 'lib/redline-startup-admission.js':['44fc9a134e0f77bfb3056673326a1475b32f6b9f','bd39c71fb2a331554d74568cca1916fb0750fa19a11bef1614d66456735a875f'],
 'lib/redline-current-startup-v1.js':['44fc9a134e0f77bfb3056673326a1475b32f6b9f','3b32d2e7c24fb0718f05022d47a8884bbe7e93ea0568c6868829563463cadd50']
});
const dependencies=Object.freeze(['lib/quake2-current-browser-policy-v1.js','lib/redline-current-startup-v1.js']);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=n=>fs.readFileSync(path.join(root,n));
const pin=(name,b)=>({path:name,size:b.length,sha256:hash(b)});
function optin(selected){assert.equal(selected,version,'explicit Q3 foreign closure version');}
function providerPins(){
 const pins={};
 for(const [name,[commit,digest]] of Object.entries(authorities)){
  for(const target of ['HEAD','origin/main'])cp.execFileSync('git',['merge-base','--is-ancestor',commit,target],{cwd:root});
  const published=cp.execFileSync('git',['show',commit+':'+name],{cwd:root});
  assert.equal(hash(published),digest,'fixed foreign authority: '+name);
  pins[name]=pin(name,published);
 }
 return pins;
}
function closureSHA(files){return hash(Buffer.from(JSON.stringify([...files].sort((a,b)=>a.path.localeCompare(b.path)))));}
function callerSource(run,digest){
 return "'use strict';\nrequire("+JSON.stringify('./'+path.relative(run,__filename))+").runCaller(__dirname,"+JSON.stringify(version)+","+JSON.stringify(digest)+");\n";
}
function checkFiles(pins){
 assert.deepEqual(pins.publishedForeignProviders,authorities,'explicit published foreign authorities');
 const seen=new Set();
 for(const p of pins.files){
  assert(typeof p.path==='string'&&!path.isAbsolute(p.path)&&!p.path.split('/').includes('..'),'relative staged provider');
  assert(!seen.has(p.path),'duplicate staged provider');seen.add(p.path);
  assert.deepEqual(pin(p.path,read(p.path)),p,'staged provider: '+p.path);
 }
 for(const [name,[,digest]] of Object.entries(authorities))assert.equal(pins.files.find(p=>p.path===name)?.sha256,digest,'fixed runtime foreign authority: '+name);
 for(const p of pins.httpPins){const f=pins.files.find(f=>f.path===p.url.slice(1));assert(f,'staged HTTP provider');assert.equal(p.size,f.size);assert.equal(p.sha256,f.sha256);}
}
function staged(run,selected,manifestSHA256){
 optin(selected);assert.match(manifestSHA256??'',/^[a-f0-9]{64}$/,'independent prepared manifest SHA required');
 const raw=require('node:zlib').gunzipSync(fs.readFileSync(path.join(run,'runtime-pins.json.gz')));
 assert.equal(hash(raw),manifestSHA256,'independent prepared manifest SHA');
 const pins=JSON.parse(raw);assert.equal(pins.moduleVersion,version);assert.equal(pins.foreignClosureVersion,version);
 checkFiles(pins);
 const caller=path.relative(root,path.join(run,'q3-runtime-caller.cjs'));
 assert.equal(pins.runtimeCaller,caller,'actual generated caller');
 assert.equal(read(caller).toString(),callerSource(run,closureSHA(pins.files.filter(p=>p.path!==caller))),'authenticated generated caller');
 return pins;
}
function composition(selected,run,outputDirectory){
 optin(selected);
 const name='tools/q3-native-driver-composition.cjs',filename=path.join(root,name),source=read(name).toString();
 assert.equal(hash(Buffer.from(source)),require('./q3-current-module.cjs').migration[name],'authenticated Q3 command-boundary composition');
 const before="'lib/redline-startup-admission.js': 'afcb3bae5807a0b08e8d49262af33c1c64ecfa601717173b630658198de185e2'";
 assert.equal(source.split(before).length,2,'unique foreign admission pin seam');
 assert.equal(hash(read('lib/redline-startup-admission.js')),authorities['lib/redline-startup-admission.js'][1],'published Q3 admission');
 const m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));
 // An explicit versioned loader, never filesystem/Git read substitution. All
 // command, physical admission, checkpoint, fixture and deadline code stays.
 let transformed=source.replace(before,"'lib/redline-startup-admission.js': '"+authorities['lib/redline-startup-admission.js'][1]+"'");
 const diagnosticSeam='  return {source, fixtureSource, controlsSource, retainedSource, references, hook:';
 assert.equal(transformed.split(diagnosticSeam).length,2,'unique current startup diagnostics seam');
 transformed=transformed.replace(diagnosticSeam,"  source=require('./q3-current-module.cjs').composeStartupDiagnostics(source);\n"+diagnosticSeam);
 if(run!==undefined){
  run=path.resolve(run);assert(run.startsWith(root+'/scratch/runs/'),'owned runtime directory required');
  const seam='  return {source, fixtureSource, controlsSource, retainedSource, references, hook:';
  assert.equal(transformed.split(seam).length,2,'owning composition return seam');
  const pins="const pins=JSON.parse(fs.readFileSync(run+'/runtime-pins.json'));";
  const output="out=run+'/'+(process.env.CASE_TAG||(process.env.NO_ORIGINAL?'production-preflight':process.env.WEBGL_QUALIFY?'webgl-qualify':process.env.TR2_GENERATED?'generated-v2':'original'))";
  transformed=transformed.replace(seam,
   '  source=replaceOnce(source,'+JSON.stringify(pins)+','+JSON.stringify("const pins=JSON.parse(require('node:zlib').gunzipSync(fs.readFileSync("+JSON.stringify(path.join(run,'runtime-pins.json.gz'))+")));")+');\n'+
   '  source=replaceOnce(source,'+JSON.stringify(output)+','+JSON.stringify('out='+JSON.stringify(outputDirectory??path.join(run,'runtime')))+');\n'+seam);
 }
 m._compile(transformed,filename);
 return m.exports;
}
function runCaller(run,selected,digest){
 optin(selected);run=path.resolve(run);
 const raw=require('node:zlib').gunzipSync(fs.readFileSync(path.join(run,'runtime-pins.json.gz'))),pins=JSON.parse(raw);
 assert.equal(pins.foreignClosureVersion,version);assert.equal(pins.moduleVersion,version);
 const caller=path.relative(root,path.join(run,'q3-runtime-caller.cjs'));
 assert.equal(pins.runtimeCaller,caller);assert.equal(closureSHA(pins.files.filter(p=>p.path!==caller)),digest,'generated closure digest');
 checkFiles(pins);
 assert.equal(read(caller).toString(),callerSource(run,digest),'generated relative import caller');
 assert.equal(process.env.Q3_NATIVE_COMPOSITION,undefined,'versioned route owns composition preload');
 assert(process.env.Q3_EXECUTION_BOUNDARY_OUT?.endsWith('.jsonl.gz'),'execution preload output required');
 let output;
 if(process.env.Q3_NATIVE_PHASE!==undefined){
  assert.equal(pins.nativeLifecycleVersion,'q3-native-lifecycle-foreign-v1','explicit owning native lifecycle');
  assert(['cancellation','original'].includes(process.env.Q3_NATIVE_PHASE),'explicit native phase');
  output=path.join(path.dirname(run),process.env.Q3_NATIVE_PHASE,'prepared/runtime');
 }
 const m=composition(selected,run,output);
 process.argv[1]=path.join(root,m.consumerPath);
 m.install();
 if(output!==undefined){
  // Cache the inert historical export before the legacy hook guard is set.
  // Only the versioned composition above is installed; guards then bind the
  // unchanged pointer/diagnostic/wire hooks to this genuine consumer.
  require('./q3-native-driver-composition.cjs');
  process.env.Q3_NATIVE_COMPOSITION='1';
  try{
   if(process.env.Q3_NATIVE_PHASE==='original')require('./q3-menu-pointer-control.cjs');
   require('./q3-native-input-cause-diagnostic.cjs');
   require('./q3-input-wire-observation.cjs');
  }finally{delete process.env.Q3_NATIVE_COMPOSITION;}
 }
 // Install below the expression-transforming wrapper: hashes here identify
 // the bytes actually handed to the native WHATWG send implementation.
 const transportFile=process.env.Q3_EXECUTION_BOUNDARY_OUT.replace(/\.jsonl\.gz$/,'-transport.jsonl.gz');
 const transportFD=fs.openSync(transportFile,'wx',0o600),zlib=require('node:zlib');
 globalThis.WebSocket=require('./q3-current-module.cjs').installTransportDiagnostics({WebSocket:globalThis.WebSocket,
  write:row=>fs.writeSync(transportFD,zlib.gzipSync(JSON.stringify(row)+'\n'))});
 process.once('exit',()=>fs.closeSync(transportFD));
 require('./q3-execution-boundary.cjs');
 require(path.join(root,m.consumerPath));
}
module.exports={version,authorities,dependencies,optin,providerPins,closureSHA,callerSource,staged,composition,runCaller};
if(require.main===module){
 const [mode,run,selected,digest]=process.argv.slice(2);
 assert(['--check-staged','--run-staged'].includes(mode),'explicit staged runtime mode');
 staged(path.resolve(run),selected,digest);
 if(mode==='--run-staged')require(path.join(path.resolve(run),'q3-runtime-caller.cjs'));
 else console.log(JSON.stringify({passed:true,offlinePrepared:true,nativeReady:false}));
}
