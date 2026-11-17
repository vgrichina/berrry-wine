#!/usr/bin/env node
'use strict';
// Exercise the GL parent-process guard through the existing real OS controls.
// Node port of the former test/test-gltron-outer-lifecycle.py:
//   node test/test-gltron-outer-lifecycle.cjs RUN_DIR                    (boids fixture suite, GL supervisor)
//   node test/test-gltron-outer-lifecycle.cjs --parent-controls RUN_DIR
//
// Not portable (no Node API): prctl(PR_SET_PDEATHSIG / PR_SET_CHILD_SUBREAPER)
// and waitpid() of an adopted child. The original's "before" case (a child
// whose PDEATHSIG fires when its spawning thread retires) cannot be built, and
// the supervisor records inheritedPdeathsig 0 rather than 15. The repaired
// normal route and the actual parent-process death remain; the orphaned
// supervisor is observed by start token until it exits, and its exit code is
// read from its own wait.json receipt instead of waitpid.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..');
const np=require(path.join(ROOT,'tools/native-proc.cjs'));
const guard=require(path.join(ROOT,'tools/gltron-current-supervise.js'));
const fixtures=require('./test-boids-supervisor-shutdown.cjs');
fixtures.configure({module:()=>guard.BASE,Supervisor:guard.ParentProcessSupervisor,file:__filename});
const readJSON=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const live=p=>p.exitCode===null&&p.signalCode===null;

async function wait_file(p,child=null){
  const end=np.monotonic()+8;
  while(!fs.existsSync(p)){
    assert(np.monotonic()<end&&(child===null||live(child)),p);
    await np.sleep(5);
  }
}
function communicate(p,seconds){
  const a=[],b=[];p.stdout.on('data',d=>a.push(d));p.stderr.on('data',d=>b.push(d));
  return new Promise((res,rej)=>{
    const t=setTimeout(()=>{p.kill('SIGKILL');rej(new Error('communicate timeout'));},seconds*1000);
    p.on('close',()=>{clearTimeout(t);res([Buffer.concat(a),Buffer.concat(b)]);});
  });
}

async function parent_controls(run){
  fs.mkdirSync(path.dirname(run),{recursive:true});fs.mkdirSync(run);
  const results=[];
  {
    const out=path.join(run,'repaired');
    const ready=out+'-parent-process-armed.json';
    const p=cp.spawn(process.execPath,[__filename,'--thread-child',out,'1'],{stdio:['ignore','pipe','pipe']});
    const done=communicate(p,10);
    await wait_file(ready,p);
    await wait_file(path.join(out,'runtime-start.json'),p);
    fs.closeSync(fs.openSync(path.join(out,'fixture-finish'),'a'));
    const [,b]=await done;
    assert.equal(p.exitCode,0,b.toString());
    const owner=readJSON(path.join(out,'parent-process-owner.json'));
    assert(owner.inheritedPdeathsig===0&&owner.parentProcessAliveAtJoin);
    assert(!Object.values(owner.spawningThreadsAliveAtJoin).some(Boolean));
    const receipt=readJSON(path.join(out,'wait.json'));
    assert(receipt.returncode===0&&receipt.actualWait&&receipt.stdoutEOF&&receipt.stderrEOF);
    results.push({repaired:true,returncode:p.exitCode,actualWait:true,stdoutEOF:true,stderrEOF:true});
  }
  const out=path.join(run,'process-death');
  const parent=cp.spawn(process.execPath,[__filename,'--owner-parent',out],{stdio:['ignore','pipe','pipe']});
  const [,b]=await communicate(parent,10);
  assert.equal(parent.exitCode,0,b.toString());
  const child=readJSON(out+'-child.json');
  const end=np.monotonic()+10;
  for(;;){
    let t=null;try{t=np.token(child.pid);}catch{}
    if(t!==child.startToken||!np.alive(child.pid))break;
    assert(np.monotonic()<end,'orphaned supervisor did not exit');await np.sleep(20);
  }
  const owner=readJSON(path.join(out,'parent-process-owner.json'));
  const receipt=readJSON(path.join(out,'wait.json'));
  assert(owner.parentDeathObserved&&!owner.parentProcessAliveAtJoin);
  assert(receipt.supervisorExitCode===143&&receipt.actualWait);
  assert(receipt.stdoutEOF&&receipt.stderrEOF&&!receipt.remainingAfterRuntime.length);
  results.push({case:'actual parent process death',returncode:receipt.supervisorExitCode,actualWait:false,observedExit:true,
    stdoutEOF:true,stderrEOF:true,parentActualWait:parent.exitCode});
  guard.BASE.write(path.join(run,'results.json'),results);
  console.log('PASS repaired normal wait+EOF; actual parent process death observed, cancelled, joined');
}

if(require.main===module){
  const a=process.argv.slice(2);
  const fail=e=>{console.error(e&&e.stack||e);process.exit(1);};
  if(a[0]==='--parent-controls')parent_controls(path.resolve(a[1])).catch(fail);
  else if(a[0]==='--owner-parent'){
    const out=a[1];
    const p=cp.spawn(process.execPath,[__filename,'--thread-child',out,'1'],{stdio:'inherit'});
    wait_file(path.join(out,'runtime-start.json'),p).then(()=>{
      guard.BASE.write(out+'-child.json',{pid:p.pid,startToken:np.token(p.pid)});
      process.exit(0);
    },fail);
  }else if(a[0]==='--thread-child'){
    const out=a[1];
    const command=[process.execPath,__filename,'--held-fixture',out];
    new guard.ParentProcessSupervisor(out,command,{preparation:3,runtime:4,preparation_watchdog:5,runtime_watchdog:6,grace:.3})
      .run().then(rc=>process.exit(rc),fail);
  }else if(a[0]==='--held-fixture'){
    const out=a[1];
    guard.BASE.write(path.join(out,'prepared.json'),{pid:process.pid});
    wait_file(path.join(out,'fixture-finish')).then(()=>process.exit(0),fail);
  }else if(a[0]==='--native')fixtures.native(a[1],a[2]).catch(fail);
  else if(a[0]==='--child')fixtures.child(a[1],a[2]).catch(fail);
  else if(a[0]==='--descendant'){process.on('SIGTERM',()=>{});setTimeout(()=>{},30000);}
  else if(a[0]==='--foreign')setTimeout(()=>console.log('foreign holder completed'),800);
  else if(a[0]==='--sleep')setTimeout(()=>{},60000);
  else if(a[0]==='--exit')process.exit(Number(a[1]));
  else if(a[0])fixtures.main(path.resolve(a[0])).catch(fail);
  else{console.error('usage: test-gltron-outer-lifecycle.cjs [--parent-controls] RUN_DIR');process.exit(2);}
}
