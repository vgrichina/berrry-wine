#!/usr/bin/env node
'use strict';
// Local Caesar III qualification; one original only after exact Git proof.
//
// The game clock begins after compilation, sealed inheritance and authored USER
// controls. No old endpoint, save, source checkout or media copy is used.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const crypto=require('node:crypto'),net=require('node:net'),util=require('node:util');
const assert=require('node:assert/strict');
const NP=require('./native-proc.cjs');
const M=module.exports;

const ROOT=path.resolve(__dirname,'..');
// Module state callers override (c.RUN=run), read through M.
M.RUN=process.env.CAESAR3_RUN||path.join(ROOT,'scratch/runs/20261117-caesar3-current-native-assignment2-food');
const NATIVE_SECONDS=Number.parseInt(process.env.CAESAR3_NATIVE_SECONDS||'1200',10);
assert([600,1200].includes(NATIVE_SECONDS),'only owner-authorized ordinary durations');
const WATCHDOG_SECONDS=NATIVE_SECONDS+20,QUIT_RESERVE=180;
const GAME_FRESHNESS_SECONDS=15,MENU_FRESHNESS_SECONDS=30;
const COMPONENTS=['tools/caesar3-current-native.js','lib/host-imports.js',
  'tools/disciples2-current-native-source-view.cjs'];
const REPAIR_PROOF=path.join(ROOT,'scratch/runs/20261117-caesar3-reviewed-hover-city-construction/repair-outer');
const SIG=os.constants.signals;
const SELF=path.join(ROOT,'tools/caesar3-current-native.js');

// Python SystemExit(n): the CLI exits with n, no traceback.
class SystemExit extends Error{constructor(code){super('SystemExit: '+code);this.name='SystemExit';this.exitCode=code;}}
const isAssert=e=>e?.code==='ERR_ASSERTION';
const same=(a,b)=>util.isDeepStrictEqual(a,b);
// Python truthiness of a JSON value.
function truthy(v){
  if(v===undefined||v===null||v===false||v===0||v==='')return false;
  if(Array.isArray(v))return v.length>0;
  if(typeof v==='object')return Object.keys(v).length>0;
  return true;
}
// Python == between JSON values, where .get() of a missing key is None.
const eq=(a,b)=>same(a===undefined?null:a,b===undefined?null:b);
const run_path=n=>path.join(String(M.RUN),n);
const readJSON=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const now=NP.now;

function component_revision(base){
  return git('rev-parse',process.env.CAESAR3_COMPONENT_REVISION||base).toString().trim();
}

// Reuse owner tests only when the adapter is byte-identical. The Python era
// (1e585c16b) also accepted a changed adapter whose lifecycle/input function
// bodies matched c268de57's Python ones; a JS adapter cannot match Python
// bodies, so only the exact hash binds now.
function verify_owner_adapter(route){
  assert(route.adapterSHA256===sha(fs.readFileSync(__filename)),'owner proof adapter identity differs');
}

// Python ast top-level FunctionDef source segments. The JS sources keep each
// top-level function's closing brace alone in column 0.
function bodies(source){
  const lines=source.split('\n'),out={};
  for(let i=0;i<lines.length;i++){
    const m=/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/.exec(lines[i]);
    if(!m)continue;
    let j=i;const open=(lines[i].match(/{/g)||[]).length,close=(lines[i].match(/}/g)||[]).length;
    if(open===0||open!==close)while(j<lines.length&&lines[j]!=='}')j++; // one-line bodies stand alone
    out[m[1]]=lines.slice(i,j+1).join('\n');i=j;
  }
  return out;
}

function verify_components(reference,sources,module_sha){
  // Reuse the completed repaired controls by exact bytes, excluding this adapter.
  //
  // This adapter's composition and actual native owner lifecycle are tested
  // separately. Its controller and native execution bodies must remain exact.
  const old=readJSON(path.join(reference,'runtime-inputs.json'));
  // Only the separately reproduced delayed-primary coverage repair joins the
  // sealed graph. No other current host or foreign worktree source is adopted.
  assert(sources['lib/host-imports.js']===sha(git('show','d1120f026:lib/host-imports.js')));
  const loader='tools/disciples2-current-native-source-view.cjs';
  const expected=process.argv.includes('--working-qualification')?fs.readFileSync(path.join(ROOT,loader)):git('show',component_revision(old.gitSHA)+':'+loader);
  assert(sources[loader]===sha(expected),'selected pinned loader differs');
  const without=o=>Object.fromEntries(Object.entries(o).filter(([n])=>!COMPONENTS.includes(n)));
  assert(same(without(sources),without(old.sources)),'unchanged component graph differs');
  assert(old.moduleSHA256===module_sha&&module_sha===sha(fs.readFileSync(path.join(reference,'module.wasm'))));
  assert(old.sourceSeals===15&&old.moduleSeals===15&&!old.foreignWIPAdopted);
  for(const name of ['authored-native-wait.json','outer-native-printable-wait.json','inheritance-wait.json']){
    const w=readJSON(path.join(reference,name));
    assert(w.exit===0&&w.actualWait&&w.stdoutEOF&&w.stderrEOF);
  }
  assert(readJSON(path.join(reference,'authored/assertions.json')).pass);
  assert(readJSON(path.join(reference,'runtime-release.json')).success);
  const outer=readJSON(path.join(reference,'outer/wait.json'));
  assert(outer.actualWait&&outer.stdoutEOF&&outer.stderrEOF&&outer.supervisorExitCode===0&&!truthy(outer.remainingAfterRuntime));
  assert(outer.watchdogs.every(w=>w.actualWait&&w.stdoutEOF&&w.stderrEOF&&w.returncode===0));
  // Historic pin: the original compared against aa25b83f8's Python adapter. The
  // JS port compares the same functions against that revision's JS adapter.
  const prior=git('show','aa25b83f8:tools/caesar3-current-native.js').toString();
  const current=fs.readFileSync(__filename,'utf8');
  const before=bodies(prior),after=bodies(current);
  for(const name of ['original','execute_native','public_input_ready','controller'])
    assert(before[name]===after[name],'native execution/controller changed: '+name);
  return {passed:true,reference:String(reference),referenceGit:old.gitSHA,moduleSHA256:module_sha,
    unchangedComponentsExact:true,excludedComponents:[...COMPONENTS],
    originalWaitsReused:false,proofSHA256:sha(fs.readFileSync(path.join(reference,'qualification.json')))};
}

function sha(body){return crypto.createHash('sha256').update(body).digest('hex');}
function save(name,value){
  const target=run_path(name);
  const pending=target+'.'+process.pid+'.pending';
  const fd=fs.openSync(pending,'wx');
  try{fs.writeSync(fd,JSON.stringify(value,null,2)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  fs.linkSync(pending,target);fs.unlinkSync(pending);
}
function git(...args){return cp.execFileSync('git',args,{cwd:ROOT,maxBuffer:1<<30,stdio:['ignore','pipe','pipe']});}
// CONVENTIONS 9: the original exec'd `git show <revision>:<name>`. The JS port
// loads a fresh instance of the working-tree .js only when its bytes are that
// published Git object.
function published_module(name,revision){
  name=name.replace(/\.py$/,'.js');
  const file=path.join(ROOT,name);
  assert(git('show',revision+':'+name).equals(fs.readFileSync(file)),'published module differs from working tree: '+name);
  delete require.cache[require.resolve(file)];
  const m=require(file);delete require.cache[require.resolve(file)];
  return m;
}
function free_disk(){
  assert(NP.freeBytes()>1500000000);
}
async function outer_ready(media_before_clock=false){
  const outer=process.env.CAESAR3_OUTER_RUN;
  if(!outer)return;
  assert(path.dirname(outer)===String(M.RUN)&&path.basename(outer)==='outer');
  fs.writeFileSync(path.join(outer,'prepared.json'),JSON.stringify({at:now(),compiledAndQualified:true,mediaBeforeClock:media_before_clock}),{flag:'wx'});
  const due=NP.monotonic()+5;
  while(!fs.existsSync(path.join(outer,'runtime-start.json'))){
    assert(NP.monotonic()<due,'outer runtime watchdog did not prearm');
    await NP.sleep(5);
  }
  const ready=readJSON(path.join(outer,'native-armed.json'));
  assert(ready.seconds===NATIVE_SECONDS);
}
function is_ancestor(revision){
  // git merge-base --is-ancestor: exit 0 and empty output, else a raised error.
  return git('merge-base','--is-ancestor',revision,'origin/main').length===0;
}

async function supervised(){
  // Reuse the GL worker's published process-parent ownership repair.
  //
  // This adds an outer OS lifecycle boundary; guest clocks, input receipts,
  // native deadline and independent release are unchanged.
  const argv=process.argv;
  fs.mkdirSync(M.RUN,{recursive:true});free_disk();
  const revision=git('rev-parse',process.env.CAESAR3_PINNED_REVISION||'HEAD').toString().trim();
  assert(is_ancestor(revision),'choose a published main graph');
  const working=argv.includes('--working-qualification');
  assert(!working||argv.includes('--outer-fixture'));
  const names=['tools/gltron-current-supervise.js','tools/boids-current-supervise.js',
    'tools/caesar3-current-native.js'];
  for(const name of names){
    if(working&&name==='tools/caesar3-current-native.js')continue;
    const pin=COMPONENTS.includes(name)?component_revision(revision):revision;
    assert(git('show',pin+':'+name).equals(fs.readFileSync(path.join(ROOT,name))),'publish exact supervisor before use: '+name);
  }
  assert(argv.includes('--original')!==argv.includes('--outer-fixture'));
  fs.writeFileSync(run_path('outer-owned-helper.patch'),git('diff','--binary',revision,'--','tools/caesar3-current-native.js'));
  save('outer-source-pins.json',{gitSHA:revision,sources:Object.fromEntries(names.map(n=>[n,sha(fs.readFileSync(path.join(ROOT,n)))])),workingAuthoredOnly:working,
    preparationSeconds:240,runtimeSeconds:NATIVE_SECONDS,independentRuntimeWatchdogSeconds:WATCHDOG_SECONDS});
  // Lazy: the GL supervisor is another group's port (CONVENTIONS 10).
  const m=published_module('tools/gltron-current-supervise.js',revision);
  process.env.CAESAR3_OUTER_RUN=run_path('outer');
  process.env.CAESAR3_PINNED_REVISION=revision;
  const command=[process.execPath,SELF,argv.includes('--original')?'--original':'--outer-fixture'];
  if(working)command.push('--working-qualification');
  // Python keyword arguments become one options object.
  return await new m.ParentProcessSupervisor(run_path('outer'),command,{preparation:240,runtime:NATIVE_SECONDS,
    preparation_watchdog:260,runtime_watchdog:WATCHDOG_SECONDS,grace:5}).run();
}
function token(pid){return NP.token(pid);}
async function watchdog(deadline){
  save('watchdog-armed.json',{pid:process.pid,independent:true,deadline,at:now()});
  while(now()<deadline){
    if(fs.existsSync(run_path('native-wait.json'))){
      save('watchdog-exit.json',{reason:'actual native wait',at:now()});return;
    }
    await NP.sleep(20);
  }
  const p=readJSON(run_path('native-pid.json'));
  const sent=[];
  for(const sig of ['SIGTERM','SIGKILL']){
    try{
      if(token(p.pid)===p.startToken){
        NP.killpg(p.pid,sig);sent.push(SIG[sig]);
      }
    }catch(e){if(!['ESRCH','ENOENT'].includes(e.code))throw e;}
    if(sig==='SIGTERM')await NP.sleep(3000);
  }
  save('watchdog-exit.json',{reason:'immutable deadline',signals:sent,at:now()});
}
function media_inventory(){
  const media=path.join(ROOT,'test/binaries/candidates/caesar-3-demo/installed');
  const files=[];
  (function walk(dir){
    for(const e of fs.readdirSync(dir,{withFileTypes:true})){
      const p=path.join(dir,e.name);
      if(e.isDirectory())walk(p);else if(fs.statSync(p).isFile())files.push(p);
    }
  })(media);
  // pathlib sorts by path components.
  const parts=p=>path.relative(ROOT,p).split(path.sep);
  files.sort((a,b)=>{const x=parts(a),y=parts(b);for(let i=0;i<Math.min(x.length,y.length);i++)if(x[i]!==y[i])return x[i]<y[i]?-1:1;return x.length-y.length;});
  return files.map(p=>({path:path.relative(ROOT,p),size:fs.statSync(p).size,sha256:sha(fs.readFileSync(p))}));
}

function verify_native_proof(reference,sources,module_sha){
  // Reuse completed native evidence only for the identical executed graph.
  //
  // An unrelated main publication changes the Git label, not these source bytes.
  // Fresh compilation, sealed inheritance and media prehash still run each time.
  const read=n=>readJSON(path.join(String(reference),n));
  const pins=read('runtime-inputs.json'),compiled=read('compile-inputs.json');
  assert(same(pins.sources,compiled.sources)&&same(compiled.sources,sources),'native proof source graph differs');
  assert(pins.moduleSHA256===compiled.moduleSHA256&&compiled.moduleSHA256===module_sha,'native proof module differs');
  assert(pins.sourceSeals===15&&pins.moduleSeals===15&&!pins.foreignWIPAdopted);
  assert(!compiled.workingQualification,'native proof must be published');
  const q=read('qualification.json');
  assert(q.passed&&!q.originalStarted&&q.gitSHA===pins.gitSHA&&q.moduleSHA256===module_sha);
  assert(read('runtime-release.json').success&&read('runtime-release.json').descriptorsClosed);
  for(const name of ['authored-native-wait.json','outer-native-printable-wait.json','inheritance-wait.json']){
    const w=read(name);
    assert(w.exit===0&&w.actualWait&&w.stdoutEOF&&w.stderrEOF,'incomplete native proof: '+name);
  }
  assert(read('authored/assertions.json').pass);
  const outer=read('outer/wait.json');
  assert(outer.actualWait&&outer.nativeWait.actualWait&&outer.returncode===outer.supervisorExitCode&&outer.supervisorExitCode===0);
  assert(outer.stdoutEOF&&outer.stderrEOF&&!outer.timedOut&&!truthy(outer.remainingAfterRuntime));
  assert(outer.watchdogs.length===2);
  for(const w of outer.watchdogs)
    assert(w.actualWait&&w.returncode===0&&w.stdoutEOF&&w.stderrEOF&&!w.result.fired);
  return {gitSHA:pins.gitSHA,moduleSHA256:module_sha,sourceCount:Object.keys(sources).length,
    nativeProofSHA256:sha(fs.readFileSync(path.join(String(reference),'qualification.json'))),
    parentProofSHA256:sha(fs.readFileSync(path.join(String(reference),'outer/wait.json')))};
}

async function free_port(){
  const s=net.createServer();await new Promise((res,rej)=>{s.once('error',rej);s.listen(0,'127.0.0.1',res);});
  const port=s.address().port;await new Promise(res=>s.close(res));return port;
}

async function original(env,source,module){
  free_disk();
  const pins=media_inventory();
  assert(pins.length===114,'complete installed recursive media inventory required before clocks');
  assert(pins.find(p=>p.path.endsWith('/c3.exe')).sha256==='d7c73f21d3837b1fc465a6035f4fea6ab5a7eddf62907c72c4dd076a5193d236');
  save('media.json',{files:pins,recursive:true,beforeNativeClock:true,at:now()});
  await outer_ready(true);
  const port=await free_port();
  const start=now(),deadline=start+NATIVE_SECONDS;
  const invocation=crypto.randomUUID();
  const args=['node','test/run.js','--app=caesar3_demo','--no-build','--threads','--real-ticks',
    '--native-exit-receipt='+run_path('native-exit.json'),'--native-invocation-token='+invocation,
    '--screen=800x600','--control='+port,'--max-seconds='+NATIVE_SECONDS,
    '--max-batches=1000000000','--stuck-after=0','--quiet-api','--quiet-blocks','--png-canvas',
    '--public-consumer-trace='+run_path('public-consumers.jsonl'),
    '--trace-api=GetMessageA,PeekMessageA,WaitMessage,DispatchMessageA,GetAsyncKeyState,GetKeyState,GetCursorPos,DirectInputCreateA,IDirectInputDevice_GetDeviceState,IDirectInputDevice_GetDeviceData',
    '--trace-input-dispatch'];
  save('launch.json',{at:start,deadline,gameplayCutoff:deadline-QUIT_RESERVE,
    inputReadinessRequired:true,
    reserveSeconds:QUIT_RESERVE,rootPort:port,args,nativeSeconds:NATIVE_SECONDS,
    watchdogSeconds:WATCHDOG_SECONDS,nativeScene:true,bindingContract:'native-reviewed-context-v1',
    inputPolicy:{confirmationMs:500,physicalUpMs:1750,observationMs:3000,
      gameFreshnessSeconds:GAME_FRESHNESS_SECONDS,menuFreshnessSeconds:MENU_FRESHNESS_SECONDS}});
  await M.execute_native(args,env,[source,module],port,invocation,start+WATCHDOG_SECONDS);
  assert(same(media_inventory(),pins),'recursive media paths, sizes or hashes changed');
  save('media-after.json',{unchanged:true,files:pins.length});
}

// Shutdown requests (TERM/INT) as Python's ShutdownRequested(128+signum) raised
// into the waiting main thread. The published vb5cce helper's
// install_shutdown_handlers() owns the process handlers and records the signal
// in its SHUTDOWN_SIGNAL; whoever installed them sets M.shutdown_helper, and
// every execute_native wait polls it.
M.shutdown_helper=null;
function pending_shutdown(){
  const h=M.shutdown_helper;
  return h&&h.SHUTDOWN_SIGNAL!==null&&h.SHUTDOWN_SIGNAL!==undefined?new h.ShutdownRequested(128+h.SHUTDOWN_SIGNAL):null;
}
// Popen(pass_fds=...): each inherited descriptor keeps its number in the child.
function stdio_with(fds,first){
  const stdio=[...first];
  for(const fd of fds||[]){
    if(!Number.isInteger(fd))continue;
    while(stdio.length<fd)stdio.push('ignore');
    stdio[fd]=fd;
  }
  return stdio;
}
// A child joined with its actual exit status (negative signal, like Popen).
function spawn_joined(command,args,options){
  const p=cp.spawn(command,args,options);
  const j={p,pid:p.pid,returncode:null,stdout:[],stderr:[]};
  j.exited=new Promise(res=>p.once('exit',(code,signal)=>{j.returncode=code??-SIG[signal];res(j.returncode);}));
  j.closed=new Promise(res=>p.once('close',()=>res(j.returncode)));
  p.once('error',e=>{j.error=e;});
  return j;
}
const within=(promise,seconds)=>{let t;return Promise.race([promise.then(()=>true),new Promise(res=>{t=setTimeout(()=>res(false),seconds*1000);})]).finally(()=>clearTimeout(t));};
function killpg_quiet(pid,sig){try{NP.killpg(pid,sig);}catch(e){if(e.code!=='ESRCH')throw e;}}

async function execute_native(args,env,fds,port,invocation,deadline){
  // Join the native process, both pipes and watchdog even on outer TERM/INT.
  const w=spawn_joined(process.execPath,[SELF,'watchdog',String(deadline)],
    {stdio:['inherit','pipe','pipe'],detached:true,env:{...process.env,CAESAR3_RUN:String(M.RUN)}});
  w.p.stdout.on('data',b=>w.stdout.push(b));w.p.stderr.on('data',b=>w.stderr.push(b));
  let p=null,cleanup=false,info={};const ends={},drains=[];
  const interrupt=()=>{const e=pending_shutdown();if(e)throw e;};
  try{
    while(!fs.existsSync(run_path('watchdog-armed.json'))){
      assert(w.returncode===null);interrupt();await NP.sleep(10);
    }
    const native_env={...env,WINE_PUBLIC_INPUT_TRACE:run_path('public-input.jsonl')};
    p=spawn_joined(args[0],args.slice(1),{cwd:ROOT,env:native_env,stdio:stdio_with(fds,['inherit','pipe','pipe']),detached:true});
    info={pid:p.pid,startToken:token(p.pid),port,invocationToken:invocation,bootId:NP.bootId()};
    save('native-pid.json',info);
    for(const name of ['stdout','stderr']){
      const fd=fs.openSync(run_path('native.'+name+'.log'),'wx');
      const stream=p.p[name];
      stream.on('data',b=>fs.writeSync(fd,b));
      drains.push(new Promise(res=>{
        stream.once('end',()=>{ends[name]=true;});
        stream.once('close',()=>{fs.closeSync(fd);res();});
      }));
    }
    while(p.returncode===null){
      if(fs.existsSync(run_path('PERMANENT-UNKNOWN.json'))||fs.existsSync(run_path('stop-native.json'))){
        cleanup=true;
        save('native-cancellation.json',{at:now(),nativeQuit:false,
          reason:fs.existsSync(run_path('PERMANENT-UNKNOWN.json'))?'permanent UNKNOWN':'explicit host cleanup'});
        NP.killpg(p.pid,'SIGTERM');break;
      }
      interrupt();
      await NP.sleep(20);
    }
    const due=NP.monotonic()+10;
    while(p.returncode===null&&NP.monotonic()<due){interrupt();await NP.sleep(20);}
    if(p.returncode===null){killpg_quiet(p.pid,'SIGKILL');await p.exited;}
    const rc=p.returncode;
    interrupt();await Promise.all(drains);interrupt();
    save('native-wait.json',{...info,exit:rc,actualWait:true,stdoutEOF:ends.stdout??false,
      stderrEOF:ends.stderr??false,atWait:now(),atWaitMono:NP.monotonic(),
      disposition:rc===0&&!cleanup?'normal':'cleanup',hostCleanup:cleanup});
  }finally{
    if(p!==null&&p.returncode===null){
      cleanup=true;
      killpg_quiet(p.pid,'SIGTERM');
      if(!await within(p.exited,10)){killpg_quiet(p.pid,'SIGKILL');}
    }
    if(p!==null)await p.exited; // poll/absence never substitutes for wait
    await Promise.all(drains);
    if(!fs.existsSync(run_path('native-wait.json'))){
      save('native-wait.json',{...info,actualWait:p!==null,
        exit:p===null?null:p.returncode,stdoutEOF:ends.stdout??false,
        stderrEOF:ends.stderr??false,atWait:now(),atWaitMono:NP.monotonic(),
        disposition:'cleanup',hostCleanup:true,nativeQuit:false,interrupted:true});
    }
    if(!await within(w.closed,10)){
      try{w.p.kill('SIGTERM');}catch{}
      if(!await within(w.closed,5))throw Object.assign(Error('watchdog communicate timed out'),{code:'ETIMEDOUT'});
    }
    save('watchdog-wait.json',{pid:w.pid,exit:w.returncode,actualWait:true,
      stdoutEOF:true,stderrEOF:true,stdout:Buffer.concat(w.stdout).toString(),stderr:Buffer.concat(w.stderr).toString()});
  }
}
function public_input_ready(run,snapshot){
  // First unfiltered USER poll of this native focus actor, not a receipt.
  //
  // A painted loading screen can precede the application's first message pump.
  // Observe public API returns only; never call a guest API or infer pixels.
  const launch=readJSON(path.join(String(run),'launch.json'));
  const focus=snapshot.focusWindow,target=parseInt(snapshot.focus,16);
  const main=(snapshot.windows??[]).find(w=>eq(w.hwnd,snapshot.mainHwnd))??null;
  if(!(truthy(main)&&truthy(focus.live)&&truthy(main.live)&&eq(focus.processId,main.processId)
    &&eq(focus.threadId,main.threadId)&&snapshot.modalHwnd==='0x0'
    &&snapshot.capture==='0x0'&&truthy(snapshot.physicalUp)))return null;
  const p=path.join(String(run),'public-consumers.jsonl');
  if(!fs.existsSync(p))return null;
  const lines=fs.readFileSync(p,'utf8').split('\n');
  for(let i=lines.length-1;i>=0;i--){
    let r;
    try{r=JSON.parse(lines[i]);}
    catch{continue;} // an active writer's incomplete last row
    if(r===null||typeof r!=='object')continue;
    const a=r.args??[];
    const actor=r.actor??{};
    const t=now();
    if(r.phase==='input-poll-return'&&['GetMessageA','GetMessageW','PeekMessageA','PeekMessageW'].includes(r.name)
      &&r.sameInstanceMemory===true&&actor.live===true&&(actor.memoryBytes??0)>0
      &&eq(actor.processId,focus.processId)&&eq(actor.threadId,focus.threadId)
      &&eq(actor.focusThread,focus.threadId)&&eq(actor.focus,target)
      &&eq(actor.focusGeneration,focus.generation)
      &&eq(actor.main,parseInt(main.hwnd,16))&&eq(actor.mainGeneration,main.generation)
      &&eq(actor.modal,actor.capture)&&eq(actor.capture,0)
      &&eq(r.threadId,focus.threadId)&&[4,5].includes(a.length)&&truthy(a[0])&&(eq(a[1],0)||eq(a[1],target))
      &&eq(a.slice(2,4),[0,0])&&!truthy(r.yieldFlag)&&!truthy(r.yieldReason)
      &&eq(r.doneSp,(r.sp??0)+4*(a.length+1))&&(r.name.startsWith('Peek')||truthy(r.eax))
      &&Math.max(launch.at*1000,t*1000-3000)<=(r.at??0)&&(r.at??0)<=t*1000)return r;
  }
  return null;
}

async function controller(){
  // One personally reviewed intent, with an independently forked UP.
  //
  // Reuse the published controller's identity, immutable review and release
  // implementation from the recorded Git object, without reading foreign WIP.
  // A completed frame is an observation for the next personal review, never
  // automatic proof of a game objective or permission for another input.
  const argv=process.argv.slice(1); // Python sys.argv: [script,'control',mode,...]
  const invoked_at=now();
  const inputs=readJSON(run_path('runtime-inputs.json'));
  const m=published_module('tools/vb5cce-reviewed-control.js',inputs.gitSHA);
  m.R=String(M.RUN);m.PORT=readJSON(run_path('launch.json')).rootPort;
  m.sourcecheck=function sourcecheck(){
    assert(sha(fs.readFileSync(__filename))===inputs.sources['tools/caesar3-current-native.js']);
  };
  m.reviewed=function reviewed(scene){
    // Caesar's explicit owner policy; preserve every inherited review and
    // invocation check without modifying the shared VB/NV controller.
    const rr=m.read(scene+'.json'),r=m.read(scene+'-review.json');
    const freshness=r.kind==='game'?GAME_FRESHNESS_SECONDS:MENU_FRESHNESS_SECONDS;
    assert(0<=now()-rr.at&&now()-rr.at<freshness&&0<=now()-r.at&&now()-r.at<freshness);
    assert(same(rr.target,m.identity())&&rr.port===m.PORT&&truthy(r.rawCompleteScene)&&truthy(r.observation)&&truthy(r.visibleLabel));
    assert(r.pngSHA256===rr.pngSHA256&&rr.pngSHA256===sha(fs.readFileSync(run_path(scene+'.png'))));
    return [rr,r];
  };
  const mode=argv[2];
  if(['ready','capture'].includes(mode)&&truthy(m.read('launch.json').inputReadinessRequired)){
    m.reserve();const snap=await m.call({action:'snapshot'},.5);
    const poll=public_input_ready(M.RUN,snap);
    if(!poll){
      console.log(JSON.stringify({ready:false,reason:'owner has not returned an unfiltered public USER poll',
        captured:false,intents:0,downs:0}));
      throw new SystemExit(3);
    }
    if(mode==='ready'){
      console.log(JSON.stringify({ready:true,publicPoll:poll,deliveryReceipt:false}));return;
    }
  }
  if(mode==='capture')return await m.capture(argv[3]);
  if(mode==='review')return m.review(...argv.slice(3,8));
  if(mode==='bind')return await m.bind(argv[3]);
  assert(['intent','review-intent','hover-intent','review-hover-intent'].includes(mode));
  const hover=['hover-intent','review-hover-intent'].includes(mode);
  const [name,scene,xs,ys,kind]=argv.slice(3,8);assert(argv.slice(3,8).length===5);
  const x=int(xs),y=int(ys);
  const offset=mode.startsWith('review-')?11:8;
  const char_code=x===-2?int(argv[offset]):null;
  if(x===-2)assert(kind!=='quit'&&32<=char_code&&char_code<=126&&1<=y&&y<=255);
  if(hover)assert(x>=0&&y>=0&&kind!=='quit');
  let child=null;
  try{
    if(mode.startsWith('review-')){
      // A single explicitly supplied personal review and finite intent.
      // Retain the original capture clock; never recapture or replay.
      m.reserve(kind==='quit');
      m.review(scene,argv[8],argv[9],kind,argv[10]);
    }
    const launch=m.reserve(kind==='quit');
    let rr,r;
    try{[rr,r]=m.reviewed(scene);}
    catch(e){
      if(!isAssert(e))throw e;
      throw new assert.AssertionError({message:'personal review preflight refused before intent/DOWN; immutable scene/review clocks and identity retained'});
    }
    assert(['install','game','quit'].includes(kind)&&r.kind===kind);
    const snap=rr.snapshot;
    const target=snap.windows.find(w=>w.hwnd===snap.mainHwnd);
    if(target===undefined)throw new Error('StopIteration: main window absent');
    assert(target.controlClass===0&&snap.focus===snap.mainHwnd);
    assert(snap.modalHwnd==='0x0'&&snap.nativeMessageBox===null&&snap.nativeDialogBox===null);
    if(kind!=='quit')assert(!fs.existsSync(run_path('quit-phase.json'))&&now()+3<launch.gameplayCutoff);
    const owner=m.read('input-owner.json'),start=now(),nonce=crypto.randomUUID();
    const invocation={...rr.target};assert(same(invocation,m.identity())&&m.same_live_invocation(invocation));
    save(name+'-intent.json',{scene,x,y,charCode:char_code,kind,nonce,at:start,
      action:hover?'mousemove':x<0?'keydown':'mousedown',
      confirmationDeadline:start+.5,physicalUpDeadline:start+1.75,observationDeadline:start+3,
      latency:{controllerInvokedAt:invoked_at,captureStartedAt:rr.at,
        captureCompletedAt:rr.completedAt,personalReviewAt:r.at,
        preflightMs:(start-invoked_at)*1000,captureAgeAtIntentMs:(start-rr.at)*1000}});
    child=new m.ArmedRelease(name,owner.owner,start+1.4);
    assert(await child.readable(.15),'independent release not prearmed');
    const arm=JSON.parse(await child.readline());save(name+'-release-arm.json',arm);assert(arm.armed);
    const command=hover?`mousemove:${x}:${y}`:x===-2?`keytext:${y}:${char_code}`:x===-1?`keydown:${y}`:`mousedown:${x}:${y}`;
    const freshness=kind==='game'?GAME_FRESHNESS_SECONDS:MENU_FRESHNESS_SECONDS;
    const guard={...owner,nonce,reviewed:true,intent:{review:m.native_review(rr,r)},
      deadline:Math.trunc(Math.min(start+.5,Math.min(rr.at,r.at)+freshness)*1000)};
    m.reserve(kind==='quit');assert(now()<start+.5);
    const receipt=await m.call({action:'guarded-input',cmd:command,guard},Math.max(.001,start+.5-now()));
    save(name+'-down.json',{at:now(),receipt});
    assert(now()<start+.5&&receipt.state==='CONSUMED'&&truthy(receipt.consumed),'confirmation UNKNOWN');
    assert(receipt.receiptBoundary==='native-input-return');
    if(receipt.receiptBoundary==='native-input-return'){
      const proof=receipt.nativeMessage;
      assert(proof.consumption==='owner-user-return'&&proof.nonce===nonce&&proof.token>0);
      assert([1,2,3].includes(proof.apiKind)&&proof.threadId>0);
      // The native token already pins the exact mapped client lParam;
      // reviewed canvas coordinates need not equal client coordinates.
      if(hover)assert(proof.msg===0x200&&proof.hwnd===parseInt(target.hwnd,16)&&proof.wParam===0);
      if(x===-2){
        const pair=receipt.nativeMessages;assert(pair.length===2);
        assert(same(pair.map(p=>p.msg),[0x100,0x102]));
        assert(same(pair.map(p=>p.wParam),[y,char_code])&&eq(pair[0].lParam,pair[1].lParam));
        assert(!eq(pair[0].token,pair[1].token));
        assert(pair.every(p=>p.consumption==='owner-user-return'&&p.nonce===nonce&&p.token>0&&
          [1,2,3].includes(p.apiKind)&&p.threadId===proof.threadId&&p.hwnd===proof.hwnd));
      }
    }
    assert(['owner','epoch','nonce','deadline'].every(k=>eq(receipt[k],guard[k])));
    assert(start*1000<=receipt.consumedAt&&receipt.consumedAt<guard.deadline);
    save(name+'-up-at.json',{at:receipt.consumedAt/1000+.1});
    const [a,b]=await child.communicate(Math.max(.001,start+1.75-now()));
    save(name+'-release-wait.json',{pid:child.pid,exit:child.returncode,actualWait:true,
      stdoutEOF:true,stderrEOF:true,stdout:a.toString(),stderr:b.toString()});
    const up=m.read(name+'-up.json');assert(child.returncode===0&&truthy(up.physicalUpACK)&&up.at<start+1.75);
    assert(up.reply.owner===owner.owner&&receipt.consumedAt/1000<=up.sentAt&&up.sentAt<=up.at);
    if(kind==='quit'){
      while(m.normal_exit(invocation,up.monotonic,start)===null){
        assert(now()<start+3);await NP.sleep(5);
      }
      save(name+'-native-quit.json',{proven:true,nativeWait:m.read('native-wait.json'),nativeExit:m.read('native-exit.json')});
    }else{
      const at=now(),image=run_path(name+'-observed.png');
      const reply=await m.call({action:'native-reviewed-capture',path:image},Math.max(.001,start+3-now()));
      assert(now()<start+3&&reply.contract==='native-reviewed-context-v1');
      save(name+'-observed.json',{at:reply.startedAt/1000,completedAt:reply.completedAt/1000,
        target:invocation,port:m.PORT,snapshot:reply.snapshot,image:reply,captureId:reply.captureId,
        pngSHA256:sha(fs.readFileSync(image)),captureRequestedAt:at,semanticOutcome:'awaiting personal review'});
    }
    save(name+'-completion.json',{at:now(),elapsedMs:(now()-start)*1000,
      limitsMs:{confirmation:500,physicalUp:1750,aggregate:3000},automaticObjectiveClaim:false});
    assert(now()<start+3);
  }catch(e){
    try{
      if(child){
        let a,b;
        try{[a,b]=await child.communicate(2);}
        catch(t){if(!(t instanceof m.TimeoutExpired))throw t;child.kill();[a,b]=await child.communicate();}
        if(!fs.existsSync(run_path(name+'-release-wait.json')))
          save(name+'-release-wait.json',{pid:child.pid,exit:child.returncode,actualWait:true,
            stdoutEOF:true,stderrEOF:true,stdout:a.toString(),stderr:b.toString()});
      }
    }finally{m.fail(name,e);}
    throw e;
  }
}
// Python int(): decimal integer text only.
function int(v){const s=String(v).trim();if(!/^[+-]?\d+$/.test(s))throw new Error(`ValueError: invalid literal for int() with base 10: '${v}'`);return Number.parseInt(s,10);}

async function run(){
  fs.mkdirSync(M.RUN,{recursive:true});free_disk();
  const argv=process.argv;
  const requested=argv.includes('--original');
  const text_diagnostic=argv.includes('--text-diagnostic');
  const modal_fixture=argv.includes('--modal-fixture');
  const personal_fixture=argv.includes('--personal-fixture');
  const controller_fixtures=argv.includes('--controller-fixtures');
  const readiness_fixture=argv.includes('--input-readiness-fixture');
  const hover_fixture=argv.includes('--hover-fixtures');
  const shutdown_fixture=argv.includes('--adapter-shutdown');
  const outer_fixture=argv.includes('--outer-fixture');
  const diagnostic=argv.includes('--consumer-diagnostic')||text_diagnostic||personal_fixture||controller_fixtures||readiness_fixture||hover_fixture||shutdown_fixture||modal_fixture;
  const working=argv.includes('--working-qualification');
  const baseline=argv.includes('--consumer-baseline');
  assert(!baseline||(working&&diagnostic),'baseline is authored working diagnosis only');
  assert(!(requested&&working),'original requires published Git-only helpers');
  assert(!(requested&&diagnostic),'consumer diagnosis never authorizes an original');
  const revision=process.env.CAESAR3_PINNED_REVISION||git('rev-parse','HEAD').toString().trim();
  assert(is_ancestor(revision));
  // The imported supervisor body comes from Git, never the shared worktree.
  const helper=published_module('tools/vb5cce-original-runtime.js',revision);
  helper.ROOT=ROOT;helper.RUN=String(M.RUN);helper.HEAD=revision;
  // Importing the helper bypasses its main-guard signal-handler installation.
  helper.install_shutdown_handlers();M.shutdown_helper=helper;
  helper.OWN_SOURCES=['tools/caesar3-current-native.js','test/test-caesar3-current-native.cjs',
    'test/run.js','lib/cli-guarded-input.js','lib/cli-input-owner.js','lib/cli-native-printable.js',
    'tools/native-printable-fixture.cjs','test/test-native-printable-input.cjs'];
  if(working){
    // Only our leased files may overlay the sealed published graph.
    helper.OWN_SOURCES=['tools/caesar3-current-native.js','test/test-caesar3-current-native.cjs',
      'lib/cli-native-scene.js','test/test-disciples2-native-paint-binding.cjs','test/public-consumer-observer.js'];
  }
  if(baseline)helper.OWN_SOURCES=['test/test-caesar3-current-native.cjs'];
  const composed=process.env.CAESAR3_COMPONENT_REVISION;
  if(composed){
    assert(revision===git('rev-parse','c993e385c').toString().trim(),'explicit reviewed base required');
    assert(is_ancestor(composed));
    helper.OWN_SOURCES=[];
    const base_sources=helper.sources;
    helper.sources=function component_sources(...rest){
      const finish=files=>{
        // Historic pin: the original repair test at aa25b83f8.
        files['test/test-caesar3-current-native.cjs']=git('show','aa25b83f8:test/test-caesar3-current-native.cjs');
        for(const name of COMPONENTS){
          const pin=name==='lib/host-imports.js'?'d1120f026':composed;
          const body=working&&name!=='lib/host-imports.js'?fs.readFileSync(path.join(ROOT,name)):git('show',pin+':'+name);
          // Host bytes are selected from Git, independent of mutable main.
          // The adapter itself still executes from its published on-disk body.
          if(name===COMPONENTS[0])
            assert(body.equals(fs.readFileSync(path.join(ROOT,name))),'published component changed: '+name);
          files[name]=body;
        }
        const patch=working?git('diff','--binary',revision,'--',...COMPONENTS,'test/test-caesar3-current-native.cjs'):git('diff','--binary',revision,composed,'--',...COMPONENTS,'test/test-caesar3-current-native.cjs');
        fs.writeFileSync(run_path('composed-components.patch'),patch);
        save('component-pins.json',{baseGit:revision,componentGit:composed,workingAuthoredOnly:working,
          components:Object.fromEntries(COMPONENTS.map(n=>[n,sha(files[n])])),repairTestGit:'aa25b83f8'});
        return files;
      };
      const files=base_sources.apply(helper,rest);
      return files&&typeof files.then==='function'?files.then(finish):finish(files);
    };
  }
  if(!working)
    assert(git('show',component_revision(revision)+':tools/caesar3-current-native.js').equals(fs.readFileSync(__filename)));
  const node=process.execPath;
  const done=async(name,args,env,source,module,extra)=>{
    await helper.checked(name,args,env,[source,module]);
    save('diagnostic-completion.json',{completed:true,originalStarted:false,...extra,
      gitSHA:revision,moduleSHA256:env.DISCIPLES2_MODULE_SHA256});
  };
  helper.qualify=async function qualify(env,files,source,module){
    if(diagnostic){
      if(modal_fixture){
        await helper.checked('modal-fixture',[node,'test/test-caesar3-reviewed-modal.cjs',
          run_path('modal')],{...env,CAESAR3_TEST_INPUTS:run_path('runtime-inputs.json')},[source,module]);
        save('diagnostic-completion.json',{completed:true,originalStarted:false,
          gitSHA:revision,moduleSHA256:env.DISCIPLES2_MODULE_SHA256});
        return;
      }
      if(shutdown_fixture)return await done('adapter-shutdown',['node','test/test-caesar3-current-native.cjs',
        '--adapter-shutdown',run_path('adapter-shutdown')],env,source,module,{});
      if(hover_fixture)return await done('hover-fixtures',['node','test/test-caesar3-current-native.cjs',
        '--hover-fixtures',run_path('hover')],env,source,module,{safeForOriginal:false});
      if(readiness_fixture)return await done('input-readiness-fixture',['node','test/test-caesar3-current-native.cjs',
        '--input-readiness-fixture',run_path('readiness')],env,source,module,{safeForOriginal:false});
      if(controller_fixtures)return await done('controller-fixtures',['node','test/test-caesar3-current-native.cjs',
        '--controller-fixtures',run_path('authored')],env,source,module,{safeForOriginal:false});
      if(personal_fixture)return await done('personal-fixture',['node','test/test-caesar3-current-native.cjs',
        '--personal-fixture',run_path('personal')],env,source,module,{safeForOriginal:false});
      if(text_diagnostic)return await done('text-diagnostic',['node','test/test-caesar3-current-native.cjs',
        '--text-diagnostic',run_path('text')],env,source,module,{characterReceiptQualified:false});
      if(baseline)env.C3_HOST_BOUNDARY_BASELINE='1';
      await helper.checked('consumer-diagnostic',['node','test/test-caesar3-current-native.cjs',
        '--consumer-diagnostic',run_path('consumer')],env,[source,module]);
      save('diagnostic-completion.json',{completed:true,contractPassed:readJSON(run_path('consumer/diagnostic.json')).contractPassed,
        safeForOriginal:false,originalStarted:false,gitSHA:revision,
        moduleSHA256:env.DISCIPLES2_MODULE_SHA256,at:now()});
      return;
    }
    // Native controls invoke only sealed JS. No mutable external controller
    // or original-game startup test is launched as a fixture.
    const hashed=()=>Object.fromEntries(Object.entries(files).map(([n,b])=>[n,sha(b)]));
    if(composed){
      const proof=verify_components(REPAIR_PROOF,hashed(),env.DISCIPLES2_MODULE_SHA256);
      save('component-proof-reuse.json',proof);
    }
    const reference=requested?process.env.CAESAR3_NATIVE_PROOF:null;
    if(composed){
      // composed graphs reuse the component proof above
    }else if(reference){
      const proof=verify_native_proof(reference,hashed(),env.DISCIPLES2_MODULE_SHA256);
      assert(is_ancestor(proof.gitSHA));
      save('native-proof-reuse.json',{...proof,reference,freshInheritance:true,at:now()});
    }else{
      await helper.checked('authored-native',['node','test/test-caesar3-current-native.cjs',run_path('authored')],env,[source,module]);
    }
    save('qualification.json',{passed:true,gitSHA:revision,originalStarted:false,
      moduleSHA256:env.DISCIPLES2_MODULE_SHA256,at:now()});
    if(outer_fixture){
      await outer_ready();
      if(composed){
        await helper.checked('owner-fixture-create',['node','-e',"require('fs').writeFileSync(process.argv[1],require('./test/test-cli-native-button-delivery.cjs').fixture(0))",run_path('owner-fixture.exe')],env,[source,module]);
        const port=await free_port();
        const invocation=crypto.randomUUID();
        const seconds=process.env.CAESAR3_FIXTURE_SECONDS||'8';
        const args=['node','test/run.js','--exe='+run_path('owner-fixture.exe'),'--control='+port,
          '--native-invocation-token='+invocation,'--native-exit-receipt='+run_path('native-exit.json'),
          '--no-build','--threads','--real-ticks','--max-seconds='+seconds,'--max-batches=1000000000',
          '--stuck-after=0','--quiet-api','--quiet-blocks'];
        await M.execute_native(args,env,[source,module],port,invocation,now()+WATCHDOG_SECONDS);
      }else{
        await helper.checked('outer-native-printable',['node','test/test-native-printable-input.cjs',run_path('outer-native')],env,[source,module]);
      }
    }
    if(requested){
      assert(is_ancestor(revision),'chosen published main graph retired');
      assert(git('show',component_revision(revision)+':tools/caesar3-current-native.js').equals(fs.readFileSync(__filename)),'chosen helper changed; no original');
      if(composed){
        const route=readJSON(process.env.CAESAR3_OWNER_PROOF);
        assert(route.passed&&route.realNative&&route.transientLauncherActuallyReturned);
        verify_owner_adapter(route);
        assert(route.ownerSHA256===sha(fs.readFileSync(path.join(ROOT,'tools/caesar3-persistent-owner.js'))));
      }
      await original(env,source,module);
    }
  };
  // Its --original option is intentionally not forwarded: this wrapper owns
  // the single Caesar invocation, media identity and fixed native deadline.
  // (Python swapped sys.argv; the JS helper reads its sys.argv from helper.ARGV.)
  helper.ARGV=[__filename];
  if(working)helper.ARGV.push('--working-qualification');
  let success=false;
  try{
    await helper.run();
    const stop=pending_shutdown();if(stop)throw stop;
    success=true;
  }finally{
    for(const fd of [...helper.OWN_FDS])helper.close_owned(fd);
    save('runtime-release.json',{success,descriptorsClosed:true,at:now(),box:null});
    helper.ARGV=null;
  }
}

Object.assign(M,{ROOT,NATIVE_SECONDS,WATCHDOG_SECONDS,QUIT_RESERVE,GAME_FRESHNESS_SECONDS,MENU_FRESHNESS_SECONDS,
  COMPONENTS,REPAIR_PROOF,SystemExit,component_revision,verify_components,sha,save,git,published_module,free_disk,
  outer_ready,supervised,token,watchdog,media_inventory,verify_native_proof,original,execute_native,
  public_input_ready,controller,run});
if(require.main===module){
  const a=process.argv[2];
  (a==='supervised'?supervised().then(rc=>{process.exitCode=(rc??0)&255;})
    :a==='watchdog'?watchdog(Number(process.argv[3]))
    :a==='control'?controller()
    :run()).catch(e=>{
      const code=e?.exitCode;
      if(Number.isInteger(code)){process.exitCode=code;return;}
      process.stderr.write((e&&e.stack||String(e))+'\n');process.exitCode=1;
    });
}
