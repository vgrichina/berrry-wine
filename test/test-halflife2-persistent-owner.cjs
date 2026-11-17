'use strict';
// Real process route tests, including transient parent return and parent death.
// Ported from test-halflife2-persistent-owner.py.
// Not portable from Python (no Node API): prctl(PR_SET_CHILD_SUBREAPER) and
// waitpid() of the orphaned owner, outer child and watchdog; pidfd_open /
// pidfd_send_signal; and the /proc/<outer>/fdinfo scan proving the supervisor
// holds a pidfd for the dedicated parent. Orphans are instead pinned by start
// token and observed until exit (their exit status is not available), signals
// are sent only while the token matches, and actualParentPidfds is null.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');
const OWNER=path.join(ROOT,'tools/halflife2-persistent-owner.js');
const np=require(path.join(ROOT,'tools/native-proc.cjs'));
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
async function until(fn,seconds=15){
  const end=np.monotonic()+seconds;
  while(!fn()){assert(np.monotonic()<end,'condition deadline');await np.sleep(10);}
}
const token=pid=>np.token(pid);
function pinnedAlive(pid,start){try{return np.token(pid)===start&&np.alive(pid);}catch{return false;}}
async function outer(out,seconds){
  const m=require(path.join(ROOT,'tools/gltron-current-supervise.js'));
  return new m.ParentProcessSupervisor(out,[process.execPath,__filename,'fixture-native',out,seconds],
    {preparation:10,runtime:15,preparation_watchdog:12,runtime_watchdog:17}).run();
}
async function run(out,native_mode=false){
  fs.mkdirSync(path.dirname(path.resolve(out)),{recursive:true});fs.mkdirSync(out);
  if(native_mode){
    const route=require(OWNER);
    const worker=Number(process.env.HL2_WORKER_PID);const [,anchoridentity]=route.anchor(worker,token(worker));
    fs.writeFileSync(path.join(out,'witness-worker-pin.json'),JSON.stringify(anchoridentity));
  }
  const results=[];
  const cases=[['healthy',native_mode?'8':'2'],['owner-death',native_mode?'100':'10']];
  if(!native_mode)cases.push(['deadline','20']);
  for(const [mode,seconds] of cases){
    const r=path.join(out,mode);fs.mkdirSync(r);const o=path.join(r,'owner'),native=native_mode?path.join(r,'outer-fixture/outer'):path.join(r,'outer');
    const worker=native_mode?Number(process.env.HL2_WORKER_PID):process.pid;
    const command=native_mode?[process.execPath,'tools/halflife2-current-native.js','--supervised']:[process.execPath,__filename,'outer',native,seconds];
    if(native_mode&&process.env.HL2_WORKING==='1')command.push('--working-qualification');
    const args=[process.execPath,OWNER,'owner',o,String(worker),token(worker),native_mode?'1000':mode==='deadline'?'10':'25',...command];
    const env={...process.env,HL2_RUN:path.join(r,'outer-fixture'),HL2_FIXTURE_SECONDS:seconds};
    // A separate transient launcher returns only after the safe handover.
    const launcher=cp.spawnSync(process.execPath,[__filename,'launcher',path.join(o,'worker-owner-armed.json'),...args],{timeout:10000,env,cwd:ROOT});
    assert.equal(launcher.status,0,String(launcher.stderr));
    const pid=Number(String(launcher.stdout).trim()),start=token(pid);
    await until(()=>fs.existsSync(path.join(native,'runtime-start.json')),120);
    if(native_mode)await until(()=>{const f=path.join(r,'outer-fixture/native.stdout.log');return fs.existsSync(f)&&fs.readFileSync(f,'utf8').includes('[CreateDialog]');},20);
    const armed=read(path.join(path.dirname(native),'outer-parent-process-armed.json')),identity=read(path.join(o,'worker-owner-armed.json'));
    assert(armed.pid===pid&&armed.startToken===start);
    // Launcher is actually waited/reaped; healthy dedicated parent still alive.
    assert(pinnedAlive(pid,start),'dedicated parent not alive');
    fs.writeFileSync(path.join(r,'tool-return-proof.json'),JSON.stringify({launcherActualWait:true,launcherExit:launcher.status,ownerAlive:true,ownerPid:pid,ownerStartToken:start,actualOuterParent:armed,actualParentPidfds:null,worker:identity}));
    if(mode==='owner-death'){assert(pinnedAlive(pid,start));process.kill(pid,'SIGKILL');}
    await until(()=>!pinnedAlive(pid,start),native_mode?1100:60);
    const adopted=[];
    if(mode==='owner-death'){
      await until(()=>fs.existsSync(path.join(native,'wait.json')));
      await until(()=>fs.existsSync(path.join(o,'owner-watchdog-result.json')));
      for(const child of [read(path.join(o,'outer-child.json')).pid,read(path.join(o,'owner-watchdog-armed.json')).pid]){
        let t=null;try{t=token(child);}catch{}
        if(t!==null)await until(()=>!pinnedAlive(child,t));
        adopted.push({pid:child,actualWait:false,observedExit:true,exit:null});
      }
    }
    const w=read(path.join(native,'wait.json'));
    assert(w.actualWait&&w.stdoutEOF&&w.stderrEOF&&!(w.remainingAfterRuntime&&w.remainingAfterRuntime.length));
    assert(w.watchdogs.every(x=>x.actualWait&&x.stdoutEOF&&x.stderrEOF&&x.returncode===0));
    if(native_mode){
      const nw=read(path.join(r,'outer-fixture/native-wait.json')),release=read(path.join(r,'outer-fixture/runtime-release.json'));
      assert(nw.actualWait&&nw.stdoutEOF&&nw.stderrEOF);
      assert(release.ownDescriptorsClosed&&release.compactorJoined&&!release.compactionErrors.length);
      if(mode==='owner-death')assert(nw.hostCleanup&&nw.exit===0);
    }
    const parent=read(path.join(native,'parent-process-owner.json'));
    assert.equal(parent.parentDeathObserved,mode==='owner-death');
    if(mode==='healthy'){
      const ow=read(path.join(o,'owner-outer-wait.json'));assert(ow.actualWait&&ow.stdoutEOF&&ow.stderrEOF&&ow.returncode===0);
      assert(read(path.join(o,'owner-watchdog-wait.json')).actualWait);
    }
    if(mode==='deadline'){
      assert(read(path.join(o,'owner-watchdog-result.json')).fired);
      assert(read(path.join(o,'owner-outer-wait.json')).actualWait&&w.supervisorExitCode===143);
    }
    results.push({mode,ownerActualWait:false,ownerObservedExit:true,ownerExit:null,adoptedActualWaits:adopted,parent,outer:w});
  }
  fs.writeFileSync(path.join(out,'proof.json'),JSON.stringify({passed:true,realNative:native_mode,componentGit:process.env.HL2_COMPONENT_PIN??null,transientLauncherActuallyReturned:true,unchangedActualParentSupervisor:true,results},null,2));
  console.log('PASS dedicated waiting owner survives transient launcher; actual parent death cancels and joins child and watchdogs with both EOF');
}
if(require.main===module){
  const finish=p=>Promise.resolve(p).then(rc=>{process.exitCode=rc??0;},e=>{if(e&&e.name==='SystemExit')process.exitCode=e.exitCode;else{console.error(e);process.exitCode=1;}});
  const a=process.argv.slice(2);
  if(a[0]==='outer')finish(outer(a[1],a[2]));
  else if(a[0]==='fixture-native'){fs.writeFileSync(path.join(a[1],'prepared.json'),'{}');setTimeout(()=>console.log('fixture native completion'),Number(a[2])*1000);}
  else if(a[0]==='launcher')finish((async()=>{
    const p=cp.spawn(a[2],a.slice(3),{stdio:'ignore',detached:true});const end=np.monotonic()+5;
    while(!fs.existsSync(a[1])){assert(p.exitCode===null&&np.monotonic()<end);await np.sleep(5);}
    p.unref();console.log(p.pid);
  })());
  else finish(a[0]==='--native'?run(a[1],true):run(a[0]));
}
