#!/usr/bin/env node
'use strict';
// Original Wise startup, with a published sealed graph and finite native life.
//
// Qualification never runs WiseMain. --original is a single ordinary executable
// startup after complete authored controls and own outer lifecycle proof.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const zlib=require('node:zlib'),net=require('node:net'),os=require('node:os');
const np=require('./native-proc.cjs');
const ROOT=path.resolve(__dirname,'..');
const M=module.exports;
const TASK_RUN=path.join(ROOT,'scratch/runs/20261117-halflife2-startup-ready-agreement-install-progress');
const MEDIA=path.join(ROOT,'scratch/media/half-life-2-demo-original.exe');
const DLL=path.join(ROOT,'scratch/runs/20261117-halflife2-original-demo-startup-gameplay/WISE0132.dll');
const OWN=['tools/halflife2-current-native.js','tools/halflife2-reviewed-next.js',
  'test/test-halflife2-reviewed-next.cjs','test/test-halflife2-native-wizard.cjs'];
const PREVIOUS=path.join(ROOT,'scratch/runs/20261117-halflife2-fixed-wrapper-normal-install-progress/repair-working/outer-fixture');
const COMPONENTS=['tools/halflife2-current-native.js','tools/halflife2-persistent-owner.js','test/test-halflife2-persistent-owner.cjs',
  'tools/halflife2-reviewed-next.js','test/test-halflife2-reviewed-next.cjs','test/run.js',
  'lib/cli-native-scene.js','lib/cli-native-user-windows.js',
  'test/test-cli-native-capture-refusal-details.cjs','test/test-halflife2-native-wizard.cjs'];
const PRIOR_TASK=path.join(ROOT,'scratch/runs/20261117-halflife2-persistent-owner-normal-installer-progress');
const CORE_FIXTURE=path.join(ROOT,'scratch/runs/20261117-vb5-real-comctl-startup-ide-sample/installed-published');
const NATIVE_SECONDS=600,WATCHDOG_SECONDS=620;
const FLOOR=1500000000;

function ok(cond,message){if(!cond){const e=new Error(message||'assertion failed');e.name='AssertionError';throw e;}}
class SystemExit extends Error{constructor(code){super('SystemExit('+code+')');this.name='SystemExit';this.exitCode=code;}}
const readJSON=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const exists=p=>fs.existsSync(p);
const rel=(from,p)=>path.relative(from,p);

function git(...args){return cp.execFileSync('git',args,{cwd:ROOT,maxBuffer:1<<30});}
function sha(b){return crypto.createHash('sha256').update(b).digest('hex');}
// A fresh, independent instance of a sibling module (Python's
// spec_from_file_location/exec per call), so overrides stay local to it.
function fresh(name){const p=path.join(ROOT,name);delete require.cache[require.resolve(p)];const m=require(p);delete require.cache[require.resolve(p)];return m;}
// Python executed `git show <revision>:<name>.py`. The Node port loads the
// working-tree .js counterpart as a fresh module (CONVENTIONS item 9); every
// caller that pinned bytes to a revision still asserts that equality itself.
function published(name,revision){return fresh(name);}
function save(name,value){
  const p=path.join(M.RUN,name),t=p+'.'+process.pid+'.pending';
  const fd=fs.openSync(t,'wx');
  try{fs.writeSync(fd,JSON.stringify(value,null,2)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  fs.linkSync(t,p);fs.unlinkSync(t);
}
// Free bytes under the evidence filesystem (/home on Linux, as the original).
function free_bytes(){return np.freeBytes();}
function disk(){const free=M.free_bytes();ok(free>FLOOR,'disk floor');return free;}

// Python serialized the background compactor thread with a lock. Node runs the
// periodic compactor on the same event loop and compaction is synchronous, so
// the critical section cannot interleave; the flag only refuses re-entry.
let compacting=false;
function compact_finished_traces(){
  if(compacting)return;compacting=true;
  try{_compact_finished_traces();}finally{compacting=false;}
}
function walk(dir,out=[]){
  let names=[];try{names=fs.readdirSync(dir,{withFileTypes:true});}catch{return out;}
  for(const d of names){const p=path.join(dir,d.name);if(d.isDirectory())walk(p,out);else out.push(p);}
  return out;
}
function _compact_finished_traces(){
  const RUN=M.RUN;
  // Per-process desktop traces are fixed-size mappings. Compress only after
  // that writer is absent; retain every byte, its hash and a recovery recipe.
  const dir=path.join(RUN,'desktop-observations');
  let names=[];try{names=fs.readdirSync(dir).filter(n=>n.endsWith('.trace'));}catch{}
  for(const n of names){
    const p=path.join(dir,n),match=/^desktop-(\d+)-/.exec(n);
    if(!match||np.exists(Number(match[1])))continue;
    const body=fs.readFileSync(p),encoded=zlib.gzipSync(body);
    ok(zlib.gunzipSync(encoded).equals(body),'trace gzip round trip');
    const target=p+'.gz';
    fs.writeFileSync(target,encoded,{flag:'wx'});
    ok(zlib.gunzipSync(fs.readFileSync(target)).equals(body),'trace gzip readback');
    const row={path:rel(RUN,p),gzip:rel(RUN,target),
      sha256:sha(body),gzipSHA256:sha(encoded),bytes:body.length,writerAbsent:true,
      recovery:'gzip -dk '+rel(RUN,target)};
    fs.appendFileSync(path.join(RUN,'desktop-trace-recovery.jsonl'),JSON.stringify(row)+'\n');
    fs.unlinkSync(p);
  }
  // Tests copy this immutable receipt into each child directory. Preserve all
  // paths and bytes while sharing storage for exact copies of the root receipt.
  const reference=path.join(RUN,'runtime-inputs.json');
  if(exists(reference)){
    const body=fs.readFileSync(reference),inode=fs.statSync(reference).ino;
    for(const p of walk(RUN).filter(p=>path.basename(p)==='runtime-inputs.json')){
      if(fs.statSync(p).ino===inode||!fs.readFileSync(p).equals(body))continue;
      const temporary=p+'.link';
      fs.linkSync(reference,temporary);fs.renameSync(temporary,p);
      ok(fs.readFileSync(p).equals(body),'deduplicated receipt differs');
      fs.appendFileSync(path.join(RUN,'runtime-metadata-dedup.jsonl'),
        JSON.stringify({path:rel(RUN,p),sha256:sha(body),bytes:body.length,byteIdentical:true})+'\n');
    }
  }
}

function isAncestor(revision){return cp.spawnSync('git',['merge-base','--is-ancestor',revision,'origin/main'],{cwd:ROOT}).status===0;}

async function supervised(){
  const RUN=M.RUN;
  fs.mkdirSync(RUN,{recursive:true});disk();
  let revision=process.env.HL2_PIN||git('rev-parse','origin/main').toString().trim();
  ok(isAncestor(revision),'revision is not published');
  const working=process.argv.includes('--working-qualification'),original=process.argv.includes('--original');
  ok(!(working&&original),'working qualification never starts an original');
  const self=fs.readFileSync(__filename);
  if(original){
    const route=readJSON(path.join(PRIOR_TASK,'route-native/proof.json'));
    ok(route.passed&&route.realNative&&route.componentGit.startsWith('9945c2998'),'persistent route proof');
    // Historic pin: 9945c2998 holds the Python lifecycle components only.
    for(const name of ['tools/halflife2-persistent-owner.js','tools/gltron-current-supervise.js','tools/boids-current-supervise.js'])
      ok(git('show','9945c2998:'+name).equals(fs.readFileSync(path.join(ROOT,name))),'lifecycle component changed: '+name);
    ok(!exists(path.join(TASK_RUN,'original-installer-invocation.json')),'original allowance already reserved');
    ok(git('show',process.env.HL2_COMPONENT_PIN+':'+OWN[0]).equals(self),'published adapter differs');
    ok(exists(path.join(path.dirname(RUN),'outer-fixture/outer/wait.json')),'own outer adapter must be proved first');
    const proof=readJSON(path.join(path.dirname(RUN),'outer-fixture/outer/wait.json'));
    ok(proof.supervisorExitCode===0&&proof.returncode===0,'own outer adapter proof failed');
    const pins=readJSON(path.join(path.dirname(RUN),'outer-fixture/outer-source-pins.json'));
    ok(pins.adapterSHA256===sha(self),'adapter changed since outer proof');
    revision=pins.gitSHA;
    ok(isAncestor(revision),'revision is not published');
    ok(git('show',process.env.HL2_COMPONENT_PIN+':'+OWN[0]).equals(self),'published adapter differs');
  }
  for(const name of ['tools/gltron-current-supervise.js','tools/boids-current-supervise.js'])
    ok(git('show',revision+':'+name).equals(fs.readFileSync(path.join(ROOT,name))),'supervisor differs from '+revision+': '+name);
  save('outer-source-pins.json',{gitSHA:revision,sources:Object.fromEntries(['tools/gltron-current-supervise.js','tools/boids-current-supervise.js'].map(n=>[n,sha(git('show',revision+':'+n))])),adapterSHA256:sha(self),workingAuthoredOnly:working,preparationSeconds:900,preparationWatchdogSeconds:920,nativeSeconds:600,independentWatchdogSeconds:620});
  process.env.HL2_REVISION=revision;process.env.HL2_OUTER=path.join(RUN,'outer');
  const command=[process.execPath,__filename,original?'--original':'--outer-fixture'];
  if(working)command.push('--working-qualification');
  const m=published('tools/gltron-current-supervise.js',revision);
  return new m.ParentProcessSupervisor(path.join(RUN,'outer'),command,{preparation:900,runtime:600,preparation_watchdog:920,runtime_watchdog:620,grace:5}).run();
}

async function ready(){
  const RUN=M.RUN,out=process.env.HL2_OUTER;ok(path.resolve(out)===path.resolve(RUN,'outer'),'outer directory differs');
  fs.writeFileSync(path.join(out,'prepared.json'),JSON.stringify({at:np.now(),compiledAndQualified:true,mediaBeforeClock:true}));
  const due=np.monotonic()+5;
  while(!exists(path.join(out,'runtime-start.json'))){ok(np.monotonic()<due,'outer runtime did not start');await np.sleep(5);}
  const arm=readJSON(path.join(out,'native-armed.json'));ok(arm.seconds===600,'outer native clock differs');
  save('preclock-proof.json',{prepared:true,outerNative:arm,independentWatchdog:readJSON(path.join(out,'runtime-watchdog-armed.json')),at:np.now()});
}

function waitsOK(wait){
  ok(wait.actualWait&&wait.returncode===wait.supervisorExitCode&&wait.supervisorExitCode===0,'outer wait failed');
  ok(wait.stdoutEOF&&wait.stderrEOF&&!(wait.remainingAfterRuntime&&wait.remainingAfterRuntime.length),'outer wait EOF/remaining');
  ok(wait.watchdogs.every(w=>w.actualWait&&w.returncode===0&&w.stdoutEOF&&w.stderrEOF),'watchdog wait failed');
}
function qualified_graph(env,revision){
  const fixture=path.join(path.dirname(M.RUN),'outer-fixture');
  const proof=readJSON(path.join(fixture,'full-native-qualification.json'));
  const manifest=readJSON(path.join(fixture,'immutable-manifest.json'));
  const inputs=readJSON(path.join(fixture,'runtime-inputs.json'));
  const wait=readJSON(path.join(fixture,'outer/wait.json'));
  ok(proof.passed&&proof.mainCPUWorkerOSchild&&proof.gitSHA===revision,'qualification proof');
  ok(manifest.gitSHA===inputs.gitSHA&&inputs.gitSHA===revision,'manifest revision');
  ok(proof.moduleSHA256===env.DISCIPLES2_MODULE_SHA256&&env.DISCIPLES2_MODULE_SHA256===sha(fs.readFileSync(path.join(fixture,'module.wasm'))),'module differs');
  ok(manifest.sourceSHA256===env.DISCIPLES2_SOURCE_SHA256,'source pool differs');
  ok(require('node:util').isDeepStrictEqual(inputs.sources,readJSON(path.join(M.RUN,'runtime-inputs.json')).sources),'source map differs');
  waitsOK(wait);
  return {passed:true,gitSHA:revision,moduleSHA256:env.DISCIPLES2_MODULE_SHA256,
    sourceSHA256:env.DISCIPLES2_SOURCE_SHA256,
    proofSHA256:sha(fs.readFileSync(path.join(fixture,'full-native-qualification.json'))),
    actualOuterWaitSHA256:sha(fs.readFileSync(path.join(fixture,'outer/wait.json'))),
    freshSealedInheritance:true,identicalCompleteSourceMap:true,
    sourceRefresh:false,qualificationRepeated:false,at:np.now()};
}

const PASSIVE=Buffer.from("    if (cmd.action === 'native-startup-readiness')\n      return nativeScene.startupReadiness(controlSnapshot(),cliInputSnapshot(),instance,threadManager);\n");
function count(body,needle){let n=0,i=0;while((i=body.indexOf(needle,i))>=0){n++;i+=needle.length;}return n;}
function without(body,needle){const parts=[];let i=0,j;while((j=body.indexOf(needle,i))>=0){parts.push(body.subarray(i,j));i=j+needle.length;}parts.push(body.subarray(i));return Buffer.concat(parts);}
const CORE_NAMES=['host.js','test/run.js','tools/vb5cce-original-runtime.js','tools/vb5cce-reviewed-control.js'];
const isCore=n=>n.startsWith('src/')||n.startsWith('lib/')||CORE_NAMES.includes(n);

function reusable_core(files,module_hash,fixture=CORE_FIXTURE){
  // Reuse the completed native core only under exact material identities.
  //
  // The two explicitly changed components receive focused fresh qualification:
  // scene freshness policy and the sealed loader's source resolver/inheritance.
  // All other lib/src/host/runner/shared-control bytes must match the old proof.
  const proof=readJSON(path.join(fixture,'complete-native-qualification.json'));
  const inputs=readJSON(path.join(fixture,'runtime-inputs.json'));
  ok(proof.passed&&proof.nativeProtocolAndFullRegression&&!proof.originalStarted,'core proof');
  ok(proof.moduleSHA256===inputs.moduleSHA256&&inputs.moduleSHA256===module_hash&&module_hash===sha(fs.readFileSync(path.join(fixture,'module.wasm'))),'core module differs');
  // Reuse completed component tests, not the later VB original's host stop.
  // This adapter's own outer lifecycle is qualified freshly below.
  const waits={};
  for(const n of fs.readdirSync(fixture).filter(n=>n.endsWith('-wait.json')).sort()){
    if(n==='watchdog-wait.json')continue;
    const body=fs.readFileSync(path.join(fixture,n)),w=JSON.parse(body);
    ok(w.actualWait&&w.exit===0&&w.stdoutEOF&&w.stderrEOF,n);
    waits[n]=sha(body);
  }
  ok(['inheritance-wait.json','native-controller-wait.json','runtime-shutdown-wait.json','native-dialogbox-wait.json'].every(n=>n in waits),'component waits missing');
  const refreshed=['lib/cli-native-scene.js','tools/disciples2-current-native-source-view.cjs'];
  const material=Object.fromEntries(Object.entries(files).filter(([n])=>isCore(n)).map(([n,b])=>[n,sha(b)]));
  const previous=new Set(Object.keys(inputs.sources).filter(isCore));
  ok(Object.keys(material).length===previous.size&&Object.keys(material).every(n=>previous.has(n)),'native component inventory changed');
  for(const [n,h] of Object.entries(material)){
    if(n==='test/run.js'&&inputs.sources[n]!==h){
      ok(count(files[n],PASSIVE)===1,'runner passive readiness missing');
      ok(sha(without(files[n],PASSIVE))===inputs.sources[n],'runner changed beyond passive readiness');
    }else if(!refreshed.includes(n))ok(inputs.sources[n]===h,'native core changed: '+n);
  }
  return {passed:true,moduleSHA256:module_hash,proofGit:proof.gitSHA,
    proofSHA256:sha(fs.readFileSync(path.join(fixture,'complete-native-qualification.json'))),
    componentWaitSHA256:waits,priorOriginalLifecycleReused:false,freshOwnOuterRequired:true,
    materialSourcePins:material,freshComponentTests:refreshed,
    unchangedNativeCoreReused:true,fixture:rel(ROOT,fixture)};
}

// socket.bind(('127.0.0.1',0)) then close: an ephemeral loopback port.
function free_port(){return new Promise((res,rej)=>{const s=net.createServer();s.on('error',rej);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p));});});}
async function file_sha(p){const h=crypto.createHash('sha256');for await(const b of fs.createReadStream(p,{highWaterMark:1<<20}))h.update(b);return h.digest('hex');}

async function original(env,source,module,helper){
  const RUN=M.RUN;
  disk();
  ok(fs.statSync(MEDIA).size===787701212,'media size');
  const digest=await file_sha(MEDIA);
  ok(digest==='24205fa8cb6bfab70a82dd713f0addc7cfb0b3c4df40441ebea0320dcb3b441c','media digest');
  save('media.json',{path:rel(ROOT,MEDIA),bytes:fs.statSync(MEDIA).size,sha256:digest,unchanged:true,beforeNativeClock:true,scriptModified:false});
  await ready();
  const port=await free_port();
  const invocation=crypto.randomUUID(),start=np.now(),deadline=start+600;
  const argv=['node','test/run.js','--exe='+MEDIA,'--exe-guest-path=C:\\half-life-2-demo-original.exe','--cwd=C:\\',
    '--no-build','--threads','--spawn-processes','--real-ticks','--png-canvas',
    '--overlay-dir='+path.join(RUN,'guest-overlay'),'--overlay-flush-ms=0','--reg-export='+path.join(RUN,'guest-registry.json'),
    '--native-exit-receipt='+path.join(RUN,'native-exit.json'),'--native-invocation-token='+invocation,
    '--control='+port,'--max-seconds=600','--max-batches=1000000000','--stuck-after=0','--quiet-api','--quiet-blocks'];
  save('launch.json',{args:argv,rootPort:port,at:start,deadline,gameplayCutoff:deadline-30,reserveSeconds:30,nativeSeconds:600,watchdogSeconds:620,ordinaryStartup:true,inputsAuthorized:true,scriptModified:false});
  fs.writeFileSync(path.join(TASK_RUN,'original-installer-invocation.json'),JSON.stringify({at:np.now(),run:RUN,invocationToken:invocation,
    args:argv,gitSHA:helper.HEAD,moduleSHA256:env.DISCIPLES2_MODULE_SHA256,
    ordinaryStartup:true,allowanceReserved:true}),{flag:'wx'});
  await M.execute_native(argv,env,[source,module],helper,invocation,true);
}

// Python's pass_fds keeps each descriptor at the same number in the child.
// Node does the same when the parent fd sits at that stdio index.
function stdio_with(fds){
  const stdio=['inherit','pipe','pipe'];
  for(const fd of fds||[]){while(stdio.length<fd)stdio.push('ignore');stdio[fd]=fd;}
  return stdio;
}
const returncode=c=>c.exitCode!==null?c.exitCode:-os.constants.signals[c.signalCode];
const waitExit=c=>c.exitCode!==null||c.signalCode!==null?Promise.resolve(returncode(c)):new Promise(r=>c.once('exit',()=>r(returncode(c))));

// TERM/INT during a native wait. Python's helper handler raised
// ShutdownRequested(128+signum) in the waiting thread; here it is a recorded
// request the wait loop turns into the same exception.
let shutdown_signal=null;
function install_shutdown_handlers(){
  for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>{shutdown_signal??=os.constants.signals[sig];});
}
function pending_shutdown(){if(shutdown_signal!==null)throw new SystemExit(128+shutdown_signal);}

async function execute_native(argv,env,fds,helper,invocation,original=false){
  // Own the actual process wait and both drains, including outer cancellation.
  const RUN=M.RUN;
  const p=cp.spawn(argv[0],argv.slice(1),{cwd:ROOT,env,stdio:stdio_with(fds),detached:true});
  await new Promise((res,rej)=>{p.once('spawn',res);p.once('error',rej);});
  if(original)helper.ORIGINAL_STARTED=true;
  const info=await helper.native_identity(p);info.invocationToken=invocation;save('native-pid.json',info);
  const ends={};
  const drains=['stdout','stderr'].map(name=>new Promise(res=>{
    const fd=fs.openSync(path.join(RUN,'native.'+name+'.log'),'wx');
    p[name].on('data',b=>fs.writeSync(fd,b));
    p[name].on('end',()=>{ends[name]=true;});
    p[name].on('close',()=>{fs.closeSync(fd);res();});
  }));
  let cleanup=false,rc;
  try{
    while(p.exitCode===null&&p.signalCode===null){
      pending_shutdown();
      const unknown=exists(path.join(RUN,'PERMANENT-UNKNOWN.json')),stop=exists(path.join(RUN,'stop-native.json'));
      const free=M.free_bytes();
      if(unknown||stop||free<=FLOOR){
        save('native-cleanup-trigger.json',{at:np.now(),freeBytes:free,floorBytes:FLOOR,
          permanentUnknown:unknown,stopRequested:stop,diskFloor:free<=FLOOR,
          reason:unknown?'permanent-unknown':stop?'stop-requested':'disk-floor'});
        cleanup=true;try{np.killpg(p.pid,'SIGTERM');}catch(e){if(e.code!=='ESRCH')throw e;}break;
      }
      await np.sleep(20);
    }
  }catch(e){cleanup=true;throw e;}
  finally{
    rc=cleanup?await helper.terminate_owned(p):await waitExit(p);
    await Promise.race([Promise.all(drains),np.sleep(10000)]);
    save('native-wait.json',{...info,exit:rc,actualWait:true,stdoutEOF:ends.stdout??false,stderrEOF:ends.stderr??false,atWait:np.now(),atWaitMono:np.monotonic(),disposition:cleanup?'cleanup':'normal',hostCleanup:cleanup,nativeQuit:false});
  }
  ok(ends.stdout&&ends.stderr,'native output EOF missing');
  if(rc)throw new SystemExit(rc>0?rc:128-rc);
}

async function run(){
  const RUN=M.RUN;
  fs.mkdirSync(RUN,{recursive:true});disk();
  const revision=process.env.HL2_REVISION,working=process.argv.includes('--working-qualification'),requested=process.argv.includes('--original');
  ok(!(working&&requested),'working qualification never starts an original');
  ok(isAncestor(revision),'revision is not published');
  const helper=M.published('tools/vb5cce-original-runtime.js',revision);
  helper.ROOT=ROOT;helper.RUN=RUN;helper.HEAD=revision;helper.OWN_SOURCES=[];
  const component=process.env.HL2_COMPONENT_PIN;
  ok(isAncestor(component),'component is not published');
  const base_sources=helper.sources;
  // The helper's run() calls M.sources() synchronously.
  function composed_sources(){
    const files=base_sources();
    for(const name of [...OWN,...COMPONENTS]){
      const current=fs.readFileSync(path.join(ROOT,name));
      const body=working&&COMPONENTS.includes(name)?current:git('show',component+':'+name);
      ok(body.equals(current),'published component changed: '+name);
      files[name]=body;
    }
    // Every unchanged component must match the completed repaired wrapper proof.
    const old=readJSON(path.join(PREVIOUS,'runtime-inputs.json'));
    const current=Object.fromEntries(Object.entries(files).map(([n,b])=>[n,sha(b)]));
    const changed=new Set(COMPONENTS);
    const a=Object.fromEntries(Object.entries(current).filter(([n])=>!changed.has(n)));
    const b=Object.fromEntries(Object.entries(old.sources).filter(([n])=>!changed.has(n)&&!n.startsWith('node_modules/')));
    ok(require('node:util').isDeepStrictEqual(a,b),'unchanged graph differs');
    ok(count(files['test/run.js'],PASSIVE)===1,'runner passive startup command missing');
    ok(sha(without(files['test/run.js'],PASSIVE))===old.sources['test/run.js'],'runner changed beyond passive startup command');
    let patches=working?git('diff','--binary',revision,'--',...COMPONENTS):git('diff','--binary',revision,component,'--',...COMPONENTS);
    if(working){
      for(const name of COMPONENTS){
        if(cp.spawnSync('git',['cat-file','-e',revision+':'+name],{cwd:ROOT,stdio:'ignore'}).status){
          const patch=cp.spawnSync('git',['diff','--no-index','--binary','--','/dev/null',name],{cwd:ROOT,maxBuffer:1<<30});
          ok(patch.status===1,'new component patch');patches=Buffer.concat([patches,patch.stdout]);
        }
      }
    }
    fs.writeFileSync(path.join(RUN,'composed-components.patch'),patches);
    save('component-pins.json',{baseGit:revision,componentGit:component,components:Object.fromEntries(COMPONENTS.map(n=>[n,current[n]])),previousProof:PREVIOUS,unchangedGraphExact:true});
    return files;
  }
  helper.sources=composed_sources;
  // Calling an imported helper bypasses its main-guard shutdown installation.
  // Unwind our native wait/drains and descriptor cleanup on outer TERM/INT.
  helper.install_shutdown_handlers();install_shutdown_handlers();
  if(!working)ok(git('show',process.env.HL2_COMPONENT_PIN+':'+OWN[0]).equals(fs.readFileSync(__filename)),'published adapter differs');
  if(typeof helper.compact_closed_observations==='function'){
    // Python serialized this with the compaction lock; see compact_finished_traces.
    const shared_compact=helper.compact_closed_observations;
    helper.compact_closed_observations=(...args)=>shared_compact(...args);
  }
  const checked=helper.checked;
  helper.checked=async(...args)=>{try{return await checked(...args);}finally{compact_finished_traces();}};
  async function qualify(env,files,source,module){
    if(requested){
      save('qualification-reuse.json',qualified_graph(env,revision));
      await original(env,source,module,helper);
      return;
    }
    const old=readJSON(path.join(PREVIOUS,'full-native-qualification.json'));
    ok(old.passed&&old.moduleSHA256===env.DISCIPLES2_MODULE_SHA256,'previous qualification module differs');
    const wait=readJSON(path.join(PREVIOUS,'outer/wait.json'));
    ok(wait.actualWait&&wait.stdoutEOF&&wait.stderrEOF&&wait.supervisorExitCode===0,'previous outer wait');
    save('qualification-reuse.json',{previous:PREVIOUS,fullWrapperSHA256:sha(fs.readFileSync(path.join(PREVIOUS,'wizard-next/wrapper/proof.json'))),shutdownSHA256:sha(fs.readFileSync(path.join(PREVIOUS,'adapter-shutdown/proof.json'))),allUnchangedSourcesExact:true,moduleSHA256:env.DISCIPLES2_MODULE_SHA256,freshRouteOnly:true});
    ok(files['lib/cli-native-user-windows.js'].equals(git('show','762ce2c29:lib/cli-native-user-windows.js')),'user windows changed');
    // The changed scene receives fresh passive/context/control-refusal proofs;
    // its capture clock, registry and consume-time verification remain exact.
    const old_scene=git('show','762ce2c29:lib/cli-native-scene.js').toString('latin1');
    const contexts=s=>s.split('function createReviewedContexts').slice(1).join('function createReviewedContexts').split('module.exports=')[0];
    ok(contexts(files['lib/cli-native-scene.js'].toString('latin1'))===contexts(old_scene),'reviewed contexts changed');
    await helper.checked('capture-refusal-diagnostics',['node','test/test-cli-native-capture-refusal-details.cjs','--native',path.join(RUN,'capture-refusal-diagnostics')],env,[source,module]);
    await helper.checked('captured-next-guards',['node','test/test-halflife2-reviewed-next.cjs'],env,[source,module]);
    await helper.checked('passive-startup-wrapper',['node','test/test-halflife2-native-wizard.cjs','--startup',path.join(RUN,'passive-startup-wrapper')],env,[source,module]);
    save('persistent-route-reuse.json',{passed:true,routeProofSHA256:sha(fs.readFileSync(path.join(PRIOR_TASK,'route-native/proof.json'))),
      inheritedTERMProofSHA256:sha(fs.readFileSync(path.join(PRIOR_TASK,'inherited-term-route-verified/proof.json'))),
      unchangedLifecycle:Object.fromEntries(['tools/halflife2-persistent-owner.js','tools/gltron-current-supervise.js','tools/boids-current-supervise.js'].map(n=>[n,sha(files[n])])),
      freshOwnOuterRequired:true,diagnosticOnlyOriginalAttempt:true});
    await helper.checked('route-fixture-create',['node','-e',"require('fs').writeFileSync(process.argv[1],require('./test/test-halflife2-native-wizard.cjs').dialogFixture())",path.join(RUN,'route-wizard.exe')],env,[source,module]);
    save('full-native-qualification.json',{passed:true,gitSHA:revision,moduleSHA256:env.DISCIPLES2_MODULE_SHA256,mainCPUWorkerOSchild:true,fullSourceSealed:true,originalStarted:false,reusedUnchangedWrapper:true});
    await ready();
    const port=await free_port();
    const invocation=crypto.randomUUID();
    const argv=['node','test/run.js','--native-invocation-token='+invocation,'--control='+port,'--native-exit-receipt='+path.join(RUN,'native-exit.json'),'--exe='+path.join(RUN,'route-wizard.exe'),'--no-build','--threads','--real-ticks','--png-canvas','--max-seconds='+(process.env.HL2_FIXTURE_SECONDS||'8'),'--max-batches=1000000000','--stuck-after=0','--quiet-api','--quiet-blocks'];
    await M.execute_native(argv,env,[source,module],helper,invocation);
  }
  helper.qualify=qualify;
  process.argv=[process.argv[0],__filename,...(working?['--working-qualification']:[])];
  // Python ran this on a daemon thread every second; the first error stops it.
  const compaction_errors=[];
  const compactor=setInterval(()=>{
    try{compact_finished_traces();}catch(error){compaction_errors.push(String(error?.stack||error));clearInterval(compactor);}
  },1000);
  try{await helper.run();}
  finally{
    clearInterval(compactor);
    for(const fd of [...helper.OWN_FDS])helper.close_owned(fd);
    compact_finished_traces();
    save('runtime-release.json',{ownDescriptorsClosed:true,at:np.now(),originalMode:requested,originalStarted:helper.ORIGINAL_STARTED,compactorJoined:true,compactionErrors:compaction_errors});
    ok(!compaction_errors.length,'trace compaction failed');
  }
}

Object.assign(module.exports,{ROOT,TASK_RUN,RUN:process.env.HL2_RUN||path.join(TASK_RUN,'native'),MEDIA,DLL,OWN,PREVIOUS,COMPONENTS,
  PRIOR_TASK,CORE_FIXTURE,NATIVE_SECONDS,WATCHDOG_SECONDS,SystemExit,git,sha,fresh,published,save,free_bytes,disk,
  compact_finished_traces,supervised,ready,qualified_graph,reusable_core,original,stdio_with,
  install_shutdown_handlers,pending_shutdown,execute_native,run});
function exitWith(p){
  return p.then(rc=>{process.exitCode=rc??0;},e=>{
    if(e?.name==='SystemExit'||e?.name==='ShutdownRequested')process.exitCode=e.exitCode??e.code;
    else{console.error(e);process.exitCode=1;}
  });
}
if(require.main===module){
  if(process.argv.includes('--supervised'))exitWith(M.supervised());
  else exitWith(M.run());
}
