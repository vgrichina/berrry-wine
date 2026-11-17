#!/usr/bin/env node
'use strict';
// Reuse the published Edit/module proofs; qualify the desktop transport delta.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),os=require('node:os');
const Module=require('node:module'),{isDeepStrictEqual}=require('node:util');
const np=require('./native-proc.cjs');
const ROOT=path.resolve(__dirname,'..');
const M=module.exports;
const TASK=path.resolve(process.env.HL2_TASK_RUN||path.join(ROOT,'scratch/runs/20261117-halflife2-restored-disk-normal-agreement-install'));
const PRIOR=path.join(ROOT,'scratch/runs/20261117-halflife2-startup-ready-agreement-install-progress/working-final5');
const BASE='70e85792eefac2489f655a415490f9e0a5c9297d';
const COMPONENT='63d7b0d0e8d979772a4e527a4d3561b4bdeb3692';
const RETAINED_DIAGNOSTIC_GIT='fe074afb6341bb9b1294924638424184a441ae08';
const EDIT_PROOF=path.join(ROOT,'scratch/runs/20261117-halflife2-native-large-edit-viewport-install');
const DIAGNOSTICS=['tools/halflife2-reviewed-next.js','lib/cli-native-user-windows.js','lib/cli-native-scene.js',
  'test/test-cli-native-capture-refusal-details.cjs','test/test-edit-wrap-resize.js',
  'src/13-exports.wat','src/09c3-wndprocs5-edit.wat','tools/control-variant-gate.js',
  'lib/process-desktop.js','test/test-process-desktop-observation.js','tools/halflife2-input-latency-trace.cjs',
  'test/test-process-desktop-observer-stall.cjs','tools/native-lifecycle-trace.cjs'];
function ok(cond,message){if(!cond){const e=new Error(message||'assertion failed');e.name='AssertionError';throw e;}}
// A fresh module instance per call, like Python's spec_from_file_location.
function load(name){const p=path.join(ROOT,name);delete require.cache[require.resolve(p)];const m=require(p);delete require.cache[require.resolve(p)];return m;}
function read(p){return JSON.parse(fs.readFileSync(p,'utf8'));}
const hex=()=>crypto.randomUUID().replace(/-/g,'');
// /proc/<pid>/fd/<n> on Linux (as the original); the inherited same-number
// descriptor (/dev/fd/<n>) elsewhere. Children receive fds at that number.
const fd_path=fd=>np.linux?`/proc/${process.pid}/fd/${fd}`:`/dev/fd/${fd}`;

function controller_operation(args){
  // Validate the finite call before spawning; clocks here are supervision only.
  const counts={startup:0,capture:1,review:7,bind:1,intent:5};
  ok(args&&args.length&&Object.hasOwn(counts,args[0]),'unsupported controller operation');
  const mode=args[0];ok(args.length===counts[mode]+1,'controller call schema');
  const int=s=>ok(/^\s*[+-]?\d+\s*$/.test(s),'invalid literal for int(): '+s);
  if(mode==='review'){ok(['install','quit'].includes(args[4]),'review kind');int(args[6]);int(args[7]);}
  if(mode==='intent'){ok(['install','quit'].includes(args[5]),'intent kind');int(args[3]);int(args[4]);}
  const inner=mode==='startup'?15:['capture','intent'].includes(mode)?3:1;
  // Import/identity/receipt overhead is outside the unchanged operation clock.
  // Intent also owns the existing bounded independent-release error drain.
  return {operation:mode,innerSeconds:inner,outerSeconds:inner+5,
    watchdogSeconds:inner+12,cancellationDrainSeconds:3};
}

const live=p=>p!=null&&p.exitCode===null&&p.signalCode===null;
async function supervise_controller(run,args,command=null){
  // One owner for helper, independent watchdog, actual wait and both EOFs.
  //
  // The optional command is an authored lifecycle-test seam, never a CLI option.
  // Parent-process death, TERM/INT, helper errors and deadlines share cleanup.
  const bounds=controller_operation(args);run=path.resolve(String(run));
  ok(!fs.existsSync(path.join(run,'PERMANENT-UNKNOWN.json')),'permanent UNKNOWN; no later controller');
  // A local invocation before launch is invalid, not an observation of USER.
  // Refuse it before constructing a supervisor or a permanent runtime latch.
  ok(fs.existsSync(path.join(run,'launch.json'))&&fs.statSync(path.join(run,'launch.json')).isFile(),'native launch receipt is not published');
  // The gltron supervisor port belongs to another group: load it lazily.
  const base=load('tools/gltron-current-supervise.js');
  const write=(...a)=>(base.BASE||require('./boids-current-supervise.js')).write(...a);
  const out=path.join(run,'controller-supervision',args[0]+'-'+hex());
  class ControllerSupervisor extends base.ParentProcessSupervisor{
    spawn(cmd,prefix,env){
      if(prefix==='')env={...env,DELPHI5_RUN:run,DELPHI5_PORT:String(read(path.join(run,'launch.json')).rootPort)};
      const after=p=>{if(prefix==='')write(path.join(this.out,'prepared.json'),{at:np.now()});return p;};
      const p=super.spawn(cmd,prefix,env);
      return p&&typeof p.then==='function'?p.then(after):after(p);
    }
    pump(){
      if(fs.existsSync(path.join(run,'PERMANENT-UNKNOWN.json'))&&!this.signals.length)
        this.requested(os.constants.signals.SIGTERM,null);
      return super.pump();
    }
    async cleanup(){
      // Signal only the direct helper first. Its exception handler drains the
      // prearmed physical release before UNKNOWN; do not kill that release early.
      if(live(this.native)){
        this.native.kill('SIGTERM');
        const end=np.monotonic()+bounds.cancellationDrainSeconds;
        while(live(this.native)&&np.monotonic()<end){await this.pump();await np.sleep(1);}
      }
      return super.cleanup();
    }
  }
  fs.mkdirSync(path.dirname(out),{recursive:true});
  const cmd=command||[process.execPath,path.join(ROOT,'tools/halflife2-reviewed-next.js'),...args];
  const supervisor=new ControllerSupervisor(out,cmd,{preparation:bounds.outerSeconds,runtime:bounds.outerSeconds,
    preparation_watchdog:bounds.watchdogSeconds,runtime_watchdog:bounds.watchdogSeconds,grace:1});
  const started=np.now();
  const rc=await supervisor.run();
  write(path.join(out,'operation.json'),{...bounds,arguments:args,command:cmd});
  let local_refusal=false;
  if(rc===75&&args[0]==='bind'&&command===null){
    try{
      const wait=read(path.join(out,'wait.json'));
      ok(wait.actualWait&&wait.returncode===75&&wait.stdoutEOF&&wait.stderrEOF);
      ok(!(wait.remainingAfterRuntime&&wait.remainingAfterRuntime.length)&&!wait.timedOut&&!(wait.signals&&wait.signals.length));
      ok(wait.watchdogs.every(w=>w.actualWait&&w.returncode===0&&w.stdoutEOF&&w.stderrEOF));
      local_refusal=load('tools/halflife2-reviewed-next.js').verified_local_refusal(run,args[1],started);
    }catch{}
  }
  if(rc&&!local_refusal&&!fs.existsSync(path.join(run,'PERMANENT-UNKNOWN.json'))){
    const pending=path.join(run,'controller-unknown-'+hex()+'.pending');
    fs.writeFileSync(pending,JSON.stringify({name:'controller-supervision',operation:args[0],
      supervisorExitCode:rc,wait:path.join(out,'wait.json'),at:np.now(),noLaterRequests:true}));
    try{fs.linkSync(pending,path.join(run,'PERMANENT-UNKNOWN.json'));}
    catch(e){if(e.code!=='EEXIST')throw e;}
    finally{fs.unlinkSync(pending);}
  }
  for(const [name,stream] of [['stdout',process.stdout],['stderr',process.stderr]]){
    const p=path.join(out,name+'.log');
    if(fs.existsSync(p))stream.write(fs.readFileSync(p,'utf8'));
  }
  return rc;
}

const OWNER_START=Buffer.from('      if (nativeSceneLease) {\n');
const OWNER_END=Buffer.from('      if (reviewedSceneLease) {\n');
const OWNER_BLOCK=Buffer.from(`      if (nativeSceneLease) {
        if (nativeSceneContract === nativeScene.REVIEWED_CONTEXT) {
          current=nativeScene.reviewedOwnerSnapshot(current,controlSnapshot(),nativeSceneLease,instance,threadManager);
        } else {
          const s=controlSnapshot(), main=reviewedWindow(s,s.mainHwnd);
          current.healthy=current.healthy && sameReviewedWindow(main,nativeSceneLease.main) &&
            JSON.stringify(s.nativeProcess)===JSON.stringify(nativeSceneLease.nativeProcess) &&
            JSON.stringify(s.screen)===JSON.stringify(nativeSceneLease.screen);
          current.refs.nativeSceneMainGeneration=main?.generation;
        }
      }
`);
function count(body,needle){let n=0,i=0;while((i=body.indexOf(needle,i))>=0){n++;i+=needle.length;}return n;}
function index(body,needle,from=0){const i=body.indexOf(needle,from);ok(i>=0,'substring not found');return i;}
function reviewed_owner_runner(body){
  // Adopt only the reviewed owner block, not unrelated shared-runner changes.
  body=Buffer.from(body);
  ok(count(body,OWNER_START)===1&&count(body,OWNER_END)===1,'owner block anchors');
  const a=index(body,OWNER_START),z=index(body,OWNER_END,a),old=body.subarray(a,z);
  ok(old.includes('sameReviewedOwner(main,nativeSceneLease.main)'),'unexpected owner block');
  return Buffer.concat([body.subarray(0,a),OWNER_BLOCK,body.subarray(z)]);
}
function assert_original_launchable(run){
  ok(!fs.existsSync(path.join(String(run),'PERMANENT-UNKNOWN.json')),'permanent UNKNOWN; original launch refused');
}

function input_latency_runner(body){
  // Observe the real scheduled queue; retain its ordering and all guard calls.
  body=Buffer.from(body);
  for(const [before,after] of [
    ['        scheduledInput.splice(at, 0, ev);',
     "        scheduledInput.splice(at, 0, ev);\n        globalThis[Symbol.for('wine.hl2.inputLatency')]?.('queue-enqueue',{nonce:ticket.nonce,state:ticket.state,deadline:ticket.deadline});"],
    ['      const ev = scheduledInput.shift();\n      if (ev.guardedTicket)',
     "      const ev = scheduledInput.shift();\n      if(ev.guardedTicket)globalThis[Symbol.for('wine.hl2.inputLatency')]?.('queue-dequeue',{nonce:ev.guardedTicket.nonce,state:ev.guardedTicket.state,deadline:ev.guardedTicket.deadline});\n      if (ev.guardedTicket)"]]){
    const b=Buffer.from(before);
    ok(count(body,b)===1,'pinned scheduled input boundary differs');
    const i=body.indexOf(b);body=Buffer.concat([body.subarray(0,i),Buffer.from(after),body.subarray(i+b.length)]);
  }
  return body;
}

// Compile exact bytes as a fresh CommonJS module (Python exec(compile(...))).
function compile_module(body,filename){
  const m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));
  m._compile(String(body),filename);return m.exports;
}
// Line edit script (Myers O((N+M)D)): [['=',i,j],['-',i],['+',j]...].
function line_ops(A,B){
  const N=A.length,Mx=B.length,max=N+Mx,off=max+1,v=new Int32Array(2*max+3),trace=[];
  let found=N===0&&Mx===0;
  for(let d=0;d<=max&&!found;d++){
    trace.push(v.slice());
    for(let k=-d;k<=d;k+=2){
      let x=k===-d||(k!==d&&v[off+k-1]<v[off+k+1])?v[off+k+1]:v[off+k-1]+1,y=x-k;
      while(x<N&&y<Mx&&A[x]===B[y]){x++;y++;}
      v[off+k]=x;
      if(x>=N&&y>=Mx){found=true;trace.push(v.slice());break;}
    }
  }
  const ops=[];let x=N,y=Mx;
  for(let d=trace.length-2;d>=0&&(x>0||y>0);d--){
    const w=trace[d],k=x-y;
    const pk=k===-d||(k!==d&&w[off+k-1]<w[off+k+1])?k+1:k-1;
    const px=w[off+pk],py=px-pk;
    while(x>px&&y>py){ops.push(['=',--x,--y]);}
    if(d>0){if(x===px)ops.push(['+',--y]);else ops.push(['-',--x]);}
  }
  while(x>0&&y>0)ops.push(['=',--x,--y]);
  return ops.reverse();
}
// difflib.unified_diff over lines (keepends), 3 lines of context.
function unified_diff(a,b,fromfile,tofile,n=3){
  const A=a.split(/(?<=\n)/).filter(s=>s!==''),B=b.split(/(?<=\n)/).filter(s=>s!=='');
  const ops=line_ops(A,B);
  const changes=ops.map((o,i)=>o[0]!=='='?i:-1).filter(i=>i>=0);
  if(!changes.length)return '';
  // Group changes whose gap of equal lines is at most 2n into one hunk.
  const groups=[];let s=changes[0],e=changes[0];
  for(const i of changes.slice(1)){if(i-e-1>2*n){groups.push([s,e]);s=i;}e=i;}
  groups.push([s,e]);
  const pos=i=>{let a=0,b=0;for(let j=0;j<i;j++){if(ops[j][0]!=='+')a++;if(ops[j][0]!=='-')b++;}return [a,b];};
  const range=(start,len)=>len===1?String(start+1):len===0?start+',0':(start+1)+','+len;
  let out=`--- ${fromfile}\n+++ ${tofile}\n`;
  for(const [gs,ge] of groups){
    const lo=Math.max(0,gs-n),hi=Math.min(ops.length-1,ge+n),[a0,b0]=pos(lo);
    let body='',la=0,lb=0;
    for(let i=lo;i<=hi;i++){
      const o=ops[i];
      if(o[0]==='=')body+=' '+A[o[1]],la++,lb++;
      else if(o[0]==='-')body+='-'+A[o[1]],la++;
      else body+='+'+B[o[1]],lb++;
    }
    out+=`@@ -${range(a0,la)} +${range(b0,lb)} @@\n`+body;
  }
  return out;
}

async function main(){
  const m=load('tools/halflife2-current-native.js');m.TASK_RUN=TASK;
  ok(path.dirname(TASK)===path.join(ROOT,'scratch/runs'),'task evidence must stay under scratch/runs');
  ok(process.env.HL2_RUN,'HL2_RUN required');
  m.RUN=process.env.HL2_RUN;fs.mkdirSync(m.RUN,{recursive:true});m.disk();
  const argv=process.argv;
  const RUN=m.RUN,at=n=>path.join(RUN,n);
  if(argv.includes('--original'))assert_original_launchable(RUN);
  const revision=m.git('rev-parse','--verify',process.env.HL2_RESTORED_PIN+'^{commit}').toString().trim();
  ok(revision.length===40,'exact Git commit required');
  const working=process.env.HL2_WORKING_AUTHORED==='1';
  const layout_repair=process.env.HL2_EDIT_LAYOUT_REPAIR==='1';
  ok(!working||!argv.includes('--original'),'working adapter is authored-only');
  for(const name of ['tools/halflife2-current-native.js','tools/halflife2-restored-native.js']){
    if(working&&name==='tools/halflife2-restored-native.js')continue;
    ok(m.git('show',revision+':'+name).equals(fs.readFileSync(path.join(ROOT,name))),'publish adapter first');
  }
  if(working)fs.writeFileSync(at('authored-adapter.patch'),m.git('diff','--binary','--','tools/halflife2-restored-native.js'));
  if(argv.includes('--supervised')){
    const out=at('outer');process.env.HL2_OUTER=out;
    m.save('outer-source-pins.json',{adapterGit:revision,baseGit:BASE,componentGit:COMPONENT,
      nativeSeconds:600,independentWatchdogSeconds:620});
    const parent=m.published('tools/gltron-current-supervise.js',BASE);
    return new parent.ParentProcessSupervisor(out,[process.execPath,__filename,'--child',
      argv.includes('--original')?'--original':'--fixture',
      ...(argv.includes('--diagnostic-qualification')?['--diagnostic-qualification']:[])],
      {preparation:900,runtime:600,preparation_watchdog:920,runtime_watchdog:620,grace:5}).run();
  }
  const h=m.published('tools/vb5cce-original-runtime.js',BASE);
  h.ROOT=ROOT;h.RUN=RUN;h.HEAD=BASE;h.OWN_SOURCES=[];h.install_shutdown_handlers();m.install_shutdown_handlers();
  let pins=read(path.join(PRIOR,'native/runtime-inputs.json'));let manifest=read(path.join(PRIOR,'native/immutable-manifest.json'));
  const fixture=path.join(PRIOR,'outer-fixture'),proof=read(path.join(fixture,'full-native-qualification.json'));
  ok(proof.passed&&proof.mainCPUWorkerOSchild,'prior qualification');
  ok(read(path.join(PRIOR,'native/qualification-reuse.json')).passed,'prior qualification reuse');
  for(const p of [path.join(fixture,'outer/wait.json'),path.join(PRIOR,'native/outer/wait.json')]){
    const w=read(p);ok(w.actualWait&&w.returncode===w.supervisorExitCode&&w.supervisorExitCode===0,'prior outer wait');
    ok(w.stdoutEOF&&w.stderrEOF&&!(w.remainingAfterRuntime&&w.remainingAfterRuntime.length),'prior outer EOF');
    ok(w.watchdogs.every(x=>x.actualWait&&x.returncode===0&&x.stdoutEOF&&x.stderrEOF),'prior watchdog wait');
  }
  const files=await h.sources();
  const components=read(path.join(PRIOR,'native/component-pins.json')).components;
  for(const name of Object.keys(components))files[name]=m.git('show',COMPONENT+':'+name);
  for(const name of Object.keys(pins.sources))
    if(name.startsWith('node_modules/'))files[name]=fs.readFileSync(path.join(ROOT,name));
  ok(isDeepStrictEqual(Object.fromEntries(Object.entries(files).map(([n,b])=>[n,m.sha(b)])),pins.sources),'exact proved source inventory required');
  const sealhelper=compile_module(files['tools/disciples2-current-supervisor.js'],path.join(ROOT,'tools/disciples2-current-supervisor.js'));
  let [pool,index_,rows]=await sealhelper.indexed_sources(files);
  ok(m.sha(pool)===manifest.sourceSHA256&&m.sha(index_)===manifest.sourceIndexSHA256,'proved source pool differs');
  const original_source_sha=m.sha(pool);
  // Reuse exact published Edit bodies/proofs. Adopt only the explicit desktop
  // transport and focused tests in addition to those already proved bodies.
  const changed={};
  for(const name of DIAGNOSTICS){
    const owned=['lib/cli-native-scene.js','tools/halflife2-reviewed-next.js','tools/native-lifecycle-trace.cjs','tools/halflife2-input-latency-trace.cjs'].includes(name);
    const origin=owned?revision:RETAINED_DIAGNOSTIC_GIT;
    const b=working&&owned?fs.readFileSync(path.join(ROOT,name)):m.git('show',origin+':'+name);
    if(name==='lib/cli-native-scene.js')ok(b.equals(fs.readFileSync(path.join(ROOT,name))),'publish scene first');
    changed[name]={before:name in files?m.sha(files[name]):null,after:m.sha(b),sourceGit:origin};files[name]=b;
  }
  const current_runner=working?fs.readFileSync(path.join(ROOT,'test/run.js')):m.git('show',revision+':test/run.js');
  ok(current_runner.subarray(index(current_runner,OWNER_START),index(current_runner,OWNER_END)).equals(OWNER_BLOCK),'runner owner block differs');
  ok(files['test/run.js'].equals(m.git('show',COMPONENT+':test/run.js')),'reviewed owner delta requires exact proved runner');
  const before=m.sha(files['test/run.js']);files['test/run.js']=reviewed_owner_runner(files['test/run.js']);
  changed['test/run.js']={before,after:m.sha(files['test/run.js']),onlyReviewedOwnerBlock:true};
  if(process.env.HL2_INPUT_LATENCY_TRACE==='1'){
    files['test/run.js']=input_latency_runner(files['test/run.js']);
    Object.assign(changed['test/run.js'],{after:m.sha(files['test/run.js']),onlyReviewedOwnerBlock:false,passiveInputQueueTrace:true});
  }
  fs.writeFileSync(at('reviewed-owner-runner.patch'),unified_diff(m.git('show',COMPONENT+':test/run.js').toString(),files['test/run.js'].toString(),'a/test/run.js','b/test/run.js'));
  m.save('reviewed-owner-runner.json',{...changed['test/run.js'],publishedGit:revision,unrelatedRunnerChangesExcluded:true,patchSHA256:m.sha(fs.readFileSync(at('reviewed-owner-runner.patch')))});
  [pool,index_,rows]=await sealhelper.indexed_sources(files);
  manifest={...manifest,sourceSHA256:m.sha(pool),sourceIndexSHA256:m.sha(index_),sources:rows,
    diagnosticGit:revision,diagnosticChanges:changed,unchangedNativeSourceSHA256:original_source_sha};
  const old_body=fs.readFileSync(path.join(PRIOR,'native/module.wasm'));
  ok(m.sha(old_body)===pins.moduleSHA256&&pins.moduleSHA256===proof.moduleSHA256&&proof.moduleSHA256===manifest.moduleSHA256,'prior module differs');
  const source=await h.seal('hl2-restored-source',pool);
  const preload=await h.seal('hl2-restored-preload',files['tools/disciples2-current-native-source-view.cjs']);
  const editpins=read(path.join(EDIT_PROOF,'fixture/runtime-inputs.json'));
  const editproof=read(path.join(EDIT_PROOF,'fixture/diagnostic-qualification.json'));
  ok(editproof.passed&&read(path.join(EDIT_PROOF,'fixture/complete-authored-workflow.json')).passed,'published Edit proof');
  ok(read(path.join(EDIT_PROOF,'fixture/outer/wait.json')).supervisorExitCode===0,'published Edit outer wait');
  // Default reuse is byte-identical. The explicit repair variant recompiles
  // only Edit against this exact graph and records a separate module hash.
  const editNames=['lib/cli-native-user-windows.js','lib/cli-native-scene.js','test/test-cli-native-capture-refusal-details.cjs','test/test-edit-wrap-resize.js','src/13-exports.wat','src/09c3-wndprocs5-edit.wat','tools/control-variant-gate.js'];
  for(const [name,digest] of Object.entries(editpins.sources)){
    if(name.startsWith('src/')||name.startsWith('tools/watx')||editNames.includes(name)){
      if(['lib/cli-native-scene.js','tools/halflife2-reviewed-next.js'].includes(name))continue; // explicit reviewed ownership JS delta above
      if(!(layout_repair&&name==='src/09c3-wndprocs5-edit.wat'))
        ok(m.sha(files[name])===digest,'published Edit/module input differs: '+name);
    }
  }
  let retained=path.join(EDIT_PROOF,'fixture/module.wasm');const retained_body=fs.readFileSync(retained);
  ok(m.sha(retained_body)===editpins.moduleSHA256&&editpins.moduleSHA256===editproof.moduleSHA256,'retained Edit module differs');
  let tested_body=retained_body;
  const retained_repair=process.env.HL2_RETAINED_LAYOUT_REPAIR;
  if(retained_repair){
    ok(layout_repair,'retained repair requires the exact repaired Edit graph');
    const repair=path.resolve(retained_repair);
    ok(!path.relative(path.join(ROOT,'scratch/runs'),repair).startsWith('..'),'retained repair outside scratch/runs');
    const repairpins=read(path.join(repair,'runtime-inputs.json'));
    const repairproof=read(path.join(repair,'layout-repair-module.json'));
    for(const [name,digest] of Object.entries(repairpins.sources))
      if(name.startsWith('src/')||name.startsWith('tools/watx'))
        ok(name in files&&m.sha(files[name])===digest,'retained repair input differs: '+name);
    retained=path.join(repair,'module.wasm');tested_body=fs.readFileSync(retained);
    ok(m.sha(tested_body)===repairpins.moduleSHA256&&repairpins.moduleSHA256===repairproof.moduleSHA256,'retained repair module differs');
    ok(repairproof.otherWATAndCompilerInputsExact,'retained repair inputs');
    ok(repairproof.fixedWATSHA256===m.sha(files['src/09c3-wndprocs5-edit.wat']),'retained repair WAT differs');
    m.save('layout-repair-module.json',{...repairproof,retainedFrom:path.relative(ROOT,repair),
      retainedInputsSHA256:m.sha(fs.readFileSync(path.join(repair,'runtime-inputs.json'))),recompiled:false});
  }else if(layout_repair){
    // Start from the exact proved Edit graph and replace only its wrapping
    // measurement body. Every other WAT/compiler input was checked above.
    ok(m.sha(m.git('show','f1aa883e1c4ce63d433050f7d04f15ace9b1ecff:src/09c3-wndprocs5-edit.wat'))===editpins.sources['src/09c3-wndprocs5-edit.wat'],'repair baseline WAT differs');
    // Python compiled into an unsealed memfd. The compile target here is a
    // private exclusive file passed at the same descriptor number; its bytes
    // are sealed below exactly as the retained module is.
    const target=at('layout-repair-module.compile.pending'),wfd=fs.openSync(target,'wx+');
    try{
      const compile_env={...process.env,NODE_OPTIONS:'--preserve-symlinks --require='+fd_path(preload),
        DISCIPLES2_ROOT:ROOT,DISCIPLES2_SOURCE_FD:fd_path(source),
        DISCIPLES2_SOURCE_SHA256:m.sha(pool),DISCIPLES2_SOURCE_INDEX_SHA256:m.sha(index_),
        DISCIPLES2_PHASE:'compile',DELPHI5_MODULE_FD:fd_path(wfd)};
      const code=`const fs=require('node:fs'),c=require('./tools/watx-closure'),h=require('./tools/region-layout-hash');
const r=c.compileClosure(c.watxSourceClosure(),{tailCalls:true});if(!r.success)throw Error(JSON.stringify(r));
fs.writeFileSync(process.env.DELPHI5_MODULE_FD,h.appendSection(Buffer.from(r.wasmBinary),h.layoutHash(r.regions.regions)));`;
      await h.checked('exact-layout-repair-compile',['node','-e',code],compile_env,[source,wfd]);
      tested_body=fs.readFileSync(target);
    }finally{fs.closeSync(wfd);fs.unlinkSync(target);}
    m.save('layout-repair-module.json',{baselineModuleSHA256:m.sha(retained_body),moduleSHA256:m.sha(tested_body),
      onlyChangedWAT:'src/09c3-wndprocs5-edit.wat',baselineWATSHA256:editpins.sources['src/09c3-wndprocs5-edit.wat'],
      fixedWATSHA256:m.sha(files['src/09c3-wndprocs5-edit.wat']),otherWATAndCompilerInputsExact:true});
  }
  // memfd + F_ADD_SEALS: the runtime helper's seal (CONVENTIONS item 10).
  const module_fd=await h.seal('hl2-native-edit-module',tested_body);
  const body=tested_body;ok(body.subarray(0,4).equals(Buffer.from('\0asm','latin1')),'module magic');
  if(layout_repair&&!retained_repair)fs.writeFileSync(at('module.wasm'),body);
  else fs.linkSync(retained,at('module.wasm'));
  ok(m.sha(fs.readFileSync(at('module.wasm')))===m.sha(body),'linked module differs');
  manifest={...manifest,moduleSHA256:m.sha(body),priorModuleSHA256:m.sha(old_body),
    nativeEditDelta:Object.fromEntries(DIAGNOSTICS.filter(n=>n.startsWith('src/')).map(n=>[n,changed[n]]))};
  const encoded=Buffer.from(stableJSON(manifest));
  // The full input inventory is retained once below; the compile receipt pins
  // those exact bytes rather than writing a second copy of every source hash.
  m.save('immutable-manifest.json',manifest);
  pins={...pins,sources:Object.fromEntries(Object.entries(files).map(([n,b])=>[n,m.sha(b)])),diagnosticGit:revision,diagnosticChanges:changed,moduleSHA256:m.sha(body)};
  m.save('runtime-inputs.json',pins);
  m.save('compile-inputs.json',{gitSHA:revision,sourcesReference:'runtime-inputs.json',
    runtimeInputsSHA256:m.sha(fs.readFileSync(at('runtime-inputs.json'))),
    moduleSHA256:m.sha(body),priorModuleSHA256:m.sha(old_body),nativeEditDelta:manifest.nativeEditDelta,
    retainedModuleReference:path.relative(ROOT,retained),exactPublishedEditProofReuse:!layout_repair,editLayoutRepair:layout_repair});
  fs.writeFileSync(at('diagnostic.patch'),m.git('diff','--binary',COMPONENT,'--',...DIAGNOSTICS));
  fs.mkdirSync(at('desktop-observations'));
  const env={...process.env,NODE_OPTIONS:'--preserve-symlinks --require='+fd_path(preload),
    DISCIPLES2_ROOT:ROOT,DISCIPLES2_SOURCE_FD:fd_path(source),
    DISCIPLES2_SOURCE_SHA256:m.sha(pool),DISCIPLES2_SOURCE_INDEX_SHA256:m.sha(index_),
    DISCIPLES2_PHASE:'runtime',DISCIPLES2_MODULE_FD:fd_path(module_fd),
    DISCIPLES2_MODULE_SHA256:m.sha(body),DISCIPLES2_MANIFEST_SHA256:m.sha(encoded),
    DISCIPLES2_ENTRY_SHA256:m.sha(files['test/run.js']),DISCIPLES2_PRELOAD:fd_path(preload),
    DELPHI5_SOURCE_FD:fd_path(source),DELPHI5_MODULE_FD:fd_path(module_fd),
    DELPHI5_MODULE_SHA256:m.sha(body),WINE_COM_PROTOCOL_DIR:at('children'),
    WINE_PROCESS_DESKTOP_OBSERVE:at('desktop-observations')};
  m.save('qualification-reuse.json',{passed:true,baseGit:BASE,componentGit:COMPONENT,
    adapterGit:revision,moduleSHA256:m.sha(body),sourceSHA256:m.sha(pool),sourceIndexSHA256:m.sha(index_),
    exactSourceInventory:true,sourceCount:Object.keys(files).length,moduleBeforeClock:true,allMediaBeforeClock:true,
    previous:path.relative(ROOT,PRIOR),fullProofSHA256:m.sha(fs.readFileSync(path.join(fixture,'full-native-qualification.json'))),
    coreSuitesRepeated:false,nativeEditDelta:manifest.nativeEditDelta,
    unchangedNativeSourceSHA256:original_source_sha,diagnosticChanges:changed,at:np.now()});
  // Trace only an explicitly requested bounded passive observer. It receives
  // the same sealed source identity as every other runtime helper.
  if(process.env.HL2_LIFECYCLE_TRACE==='1'){
    const trace=at('native-lifecycle');fs.mkdirSync(trace);
    env.WINE_NATIVE_LIFECYCLE_TRACE=trace;
    env.NODE_OPTIONS+=' --require='+path.join(ROOT,'tools/native-lifecycle-trace.cjs');
    const execute=m.execute_native;
    m.execute_native=(argv2,...rest)=>execute([...argv2,'--trace-api=EndDialog,DestroyWindow,PostQuitMessage,ExitProcess,CreateWindowExA,CreateWindowExW,CreateDialogParamA,DialogBoxParamA,CreateProcessA,WinExec,SendMessageA,PostMessageA,DispatchMessageA'],...rest);
  }
  if(process.env.HL2_INPUT_LATENCY_TRACE==='1'){
    env.WINE_HL2_INPUT_LATENCY_TRACE=at('input-latency.json');
    env.NODE_OPTIONS+=' --require='+path.join(ROOT,'tools/halflife2-input-latency-trace.cjs');
  }
  const fds=[source,module_fd];
  try{
    if(argv.includes('--diagnostic-qualification')){
      ok(!argv.includes('--original'),'authored qualification only');
      for(const [name,args] of [
        ['native-startup-wrapper',['node','test/test-halflife2-native-wizard.cjs','--startup',at('native-startup-wrapper')]],
        ['numeric-refusal',['node','test/test-cli-native-capture-refusal-details.cjs']],
        ['captured-next',['node','test/test-halflife2-reviewed-next.cjs']],
        ['scene-context',['node','test/test-cli-native-scene-context.cjs']]])
        await h.checked(name,args,env,fds);
      m.save('diagnostic-qualification.json',{passed:true,diagnosticChanges:changed,
        moduleSHA256:m.sha(body),nativeEditDelta:manifest.nativeEditDelta,unchangedOtherNativeGraph:true,noOriginal:true,
        exactPublishedEditProofReuse:!layout_repair,retainedEditBaseline:path.relative(ROOT,EDIT_PROOF),
        editLayoutRepair:layout_repair,desktopDelta:changed['lib/process-desktop.js']});
    }
    if(argv.includes('--original')){
      // Preparation may have outlived a controller's terminal refusal. Never
      // reserve or start an original after that independently published latch.
      assert_original_launchable(RUN);
      const f=path.join(TASK,'fixture'),w=read(path.join(f,'outer/wait.json'));ok(w.supervisorExitCode===0,'fixture outer wait');
      ok(read(path.join(f,'native-wait.json')).actualWait,'fixture native wait');
      ok(read(path.join(f,'qualification-reuse.json')).adapterGit===revision,'fixture adapter differs');
      ok(read(path.join(f,'diagnostic-qualification.json')).passed,'fixture diagnostic qualification');
      ok(isDeepStrictEqual(read(path.join(f,'diagnostic-qualification.json')).diagnosticChanges,changed),'fixture diagnostic changes differ');
      const workflow=read(path.join(f,'complete-authored-workflow.json'));
      ok(workflow.passed&&workflow.actualCompleteCLIWorkflow&&workflow.noOriginal,'authored workflow');
      ok(workflow.gitSHA===revision&&workflow.moduleSHA256===m.sha(body),'authored workflow identity');
      await m.original(env,source,module_fd,h);
    }else{
      const exe=at('wizard.exe');
      const authored=process.env.HL2_AUTHORED_FIXTURE;
      if(authored){
        const b=fs.readFileSync(authored);
        ok(m.sha(b)===process.env.HL2_AUTHORED_FIXTURE_SHA256,'authored fixture digest');
        fs.writeFileSync(exe,b);
        m.save('authored-input.json',{path:authored,sha256:m.sha(b),bytes:b.length,beforeNativeClock:true});
      }else await h.checked('fixture-create',['node','-e',"require('fs').writeFileSync(process.argv[1],require('./test/test-halflife2-native-wizard.cjs').dialogFixture())",exe],env,fds);
      await m.ready();
      const port=await new Promise((res,rej)=>{const s=require('node:net').createServer();s.on('error',rej);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p));});});
      const invocation=crypto.randomUUID(),start=np.now();
      const seconds=authored?120:8;
      m.save('launch.json',{rootPort:port,deadline:start+seconds,gameplayCutoff:start+seconds-3,reserveSeconds:3});
      const args=['node','test/run.js','--exe='+exe,'--no-build','--threads','--real-ticks','--png-canvas',
        '--control='+port,'--max-seconds='+seconds,'--max-batches=1000000000','--stuck-after=0','--quiet-api','--quiet-blocks',
        '--native-exit-receipt='+at('native-exit.json'),'--native-invocation-token='+invocation];
      if(process.env.HL2_CAPTURE_WORKLOAD_PROFILE==='1'){
        ok(authored&&working,'capture profiling is working authored-only');
        args.push('--cpu-prof-window=0:1000000000:'+at('capture-workload.cpuprofile'));
      }
      await m.execute_native(args,env,fds,h,invocation);
    }
  }finally{
    for(const fd of [...h.OWN_FDS])h.close_owned(fd);
    m.compact_finished_traces();
    m.save('runtime-release.json',{ownDescriptorsClosed:true,at:np.now(),originalMode:argv.includes('--original')});
  }
  return 0;
}
// json.dumps(manifest,sort_keys=True): Python separators and sorted keys.
function stableJSON(v){
  if(Array.isArray(v))return '['+v.map(stableJSON).join(', ')+']';
  if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+': '+stableJSON(v[k])).join(', ')+'}';
  return JSON.stringify(v);
}

Object.assign(module.exports,{ROOT,TASK,PRIOR,BASE,COMPONENT,RETAINED_DIAGNOSTIC_GIT,EDIT_PROOF,DIAGNOSTICS,
  OWNER_START,OWNER_END,OWNER_BLOCK,load,read,controller_operation,supervise_controller,reviewed_owner_runner,
  assert_original_launchable,input_latency_runner,unified_diff,stableJSON,main});
if(require.main===module){
  const done=p=>p.then(rc=>{process.exitCode=rc??0;},e=>{
    if(e?.name==='SystemExit'||e?.name==='ShutdownRequested')process.exitCode=e.exitCode??e.code;
    else{console.error(e);process.exitCode=1;}
  });
  if(process.argv[2]==='--controller')done(M.supervise_controller(process.argv[3],process.argv.slice(4)));
  else done(M.main());
}
