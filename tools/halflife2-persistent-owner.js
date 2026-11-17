#!/usr/bin/env node
'use strict';
// Dedicated waiting launch owner, pinned to one actual task worker process.
//
// The outer remains the normal ParentProcessSupervisor. No unsafe-ancestor mode.
// The independent watchdog is armed before launching that outer.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),os=require('node:os');
const np=require('./native-proc.cjs');
const ROOT=path.resolve(__dirname,'..');
const M=module.exports;
// The lifecycle helpers come from the boids supervisor port (another group);
// load lazily so this module can be required before that port lands.
const B=()=>require('./boids-current-supervise.js');
function ok(cond,message){if(!cond){const e=new Error(message||'assertion failed');e.name='AssertionError';throw e;}}
const SIGTERM=os.constants.signals.SIGTERM;

// Python pinned a pidfd and polled it for POLLIN (process exit). Node has no
// pidfd_open: the pin is the recorded start token, polled every call. A pin
// is "signalled" once the process is gone or its numeric PID was reused.
function pin(pid,expected){
  const [before,state]=B().identity(pid);
  ok(before===expected&&state!=='Z','owner identity unavailable');
  ok(B().identity(pid)[0]===expected,'owner identity unavailable');
  const p={pid,expected,
    poll(){try{return np.token(pid)!==expected||!np.alive(pid);}catch{return true;}},
    // pidfd_send_signal: never signal a PID whose start token changed.
    signal(sig){if(!p.poll())process.kill(pid,sig);}};
  ok(!p.poll(),'owner died while pinning');
  return p;
}

function anchor(pid,expected){
  // Require the named worker to be an actual ancestor at startup. Pin before
  // clearing the inherited spawning-thread policy, then check for the race.
  let ancestor=process.ppid;const chain=[];
  while(ancestor>1){
    chain.push(ancestor);
    if(ancestor===pid)break;
    ancestor=np.parentPid(ancestor);
  }
  ok(chain.includes(pid),'worker must be an actual ancestor');
  const fd=pin(pid,expected);
  // Python read PR_GET_PDEATHSIG and cleared it with PR_SET_PDEATHSIG(0).
  // Node exposes no prctl and never sets a parent-death signal on its own
  // spawns, so the inherited policy is recorded as 0 and nothing is cleared.
  const inherited=0;
  ok([0,SIGTERM].includes(inherited),'unsupported inherited PDEATHSIG');
  ok(!fd.poll(),'worker died during safe handover');
  return [fd,{pid,startToken:expected,pidfd:null,pin:'start-token-poll',ancestorChain:chain,inheritedPdeathsig:inherited,clearedPdeathsig:0}];
}

async function watchdog(out,pid,token,seconds){
  const fd=pin(pid,token),end=np.monotonic()+seconds;
  B().write(path.join(out,'owner-watchdog-armed.json'),{pid:process.pid,ownerPid:pid,ownerStartToken:token,seconds,independent:true,at:np.now()});
  let fired=false;
  // poll.poll(20): 20ms token polls stand in for the pidfd readiness wait.
  while(!fd.poll()){
    await np.sleep(20);
    if(fs.existsSync(path.join(out,'owner-watchdog-cancel')))break;
    if(np.monotonic()>=end){fd.signal('SIGTERM');fired=true;break;}
  }
  B().write(path.join(out,'owner-watchdog-result.json'),{fired,ownerDead:fd.poll(),at:np.now()});
}

const exited=c=>c.exitCode!==null||c.signalCode!==null;
const returncode=c=>c.exitCode!==null?c.exitCode:-os.constants.signals[c.signalCode];
function collect(child){
  const r={stdout:[],stderr:[]};
  child.stdout.on('data',b=>r.stdout.push(b));child.stderr.on('data',b=>r.stderr.push(b));
  r.closed=new Promise(res=>child.on('close',()=>res()));
  return r;
}
const waitClose=(promise,seconds)=>Promise.race([promise.then(()=>true),np.sleep(seconds*1000).then(()=>false)]);

async function owner(out,worker,token,seconds,command){
  fs.mkdirSync(out,{recursive:true});
  const [fd,identity]=anchor(worker,token);
  const requests=[];
  for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>requests.push(os.constants.signals[sig]));
  const self=B().identity(process.pid)[0];
  B().write(path.join(out,'worker-owner-armed.json'),{...identity,ownerPid:process.pid,ownerStartToken:self,at:np.now()});
  const w=cp.spawn(process.execPath,[__filename,'watchdog',out,String(process.pid),self,String(seconds)],{stdio:['ignore','pipe','pipe']});
  const wout=collect(w);
  let c=null,capture=null,cfd=null;
  try{
    const due=np.monotonic()+5;
    while(!fs.existsSync(path.join(out,'owner-watchdog-armed.json'))){
      ok(!exited(w)&&np.monotonic()<due,'owner watchdog did not arm');await np.sleep(5);
    }
    ok(!fd.poll(),'worker died before launch');
    c=cp.spawn(command[0],command.slice(1),{cwd:ROOT,stdio:['inherit','pipe','pipe'],detached:true});
    cfd=pin(c.pid,B().identity(c.pid)[0]);capture=new (B().Capture)(c,out,'outer-');
    B().write(path.join(out,'outer-child.json'),{pid:c.pid,startToken:B().identity(c.pid)[0],pidfd:null,args:command,at:np.now()});
    let cancelled=false;
    while(!exited(c)){
      await capture.pump();
      if((fd.poll()||requests.length)&&!cancelled){
        cfd.signal('SIGTERM');cancelled=true;
        B().write(path.join(out,'owner-cancellation.json'),{workerDied:fd.poll(),signals:requests,at:np.now()});
      }
      await np.sleep(10);
    }
    const rc=returncode(c),end=np.monotonic()+15;
    while(!Object.values(capture.eof).every(Boolean)&&np.monotonic()<end){await capture.pump();await np.sleep(5);}
    B().write(path.join(out,'owner-outer-wait.json'),{pid:c.pid,returncode:rc,actualWait:true,stdoutEOF:capture.eof.stdout,stderrEOF:capture.eof.stderr,workerAlive:!fd.poll(),at:np.now()});
    ok(Object.values(capture.eof).every(Boolean),'outer EOF missing');
    return rc;
  }finally{
    if(c!==null&&!exited(c)){
      cfd.signal('SIGTERM');
      await waitClose(new Promise(r=>c.once('exit',r)),20);
    }
    fs.closeSync(fs.openSync(path.join(out,'owner-watchdog-cancel'),'a'));
    ok(await waitClose(wout.closed,10),'owner watchdog join deadline');
    B().write(path.join(out,'owner-watchdog-wait.json'),{pid:w.pid,returncode:returncode(w),actualWait:true,stdoutEOF:true,stderrEOF:true,
      stdout:Buffer.concat(wout.stdout).toString(),stderr:Buffer.concat(wout.stderr).toString()});
    if(capture)await capture.close();
  }
}

Object.assign(module.exports,{ROOT,pin,anchor,watchdog,owner});
if(require.main===module){
  const a=process.argv.slice(2);
  const done=p=>p.then(rc=>{process.exit(rc??0);},e=>{console.error(e);process.exit(1);});
  if(a[0]==='watchdog')done(M.watchdog(a[1],Number(a[2]),a[3],Number(a[4])));
  else done(M.owner(a[1],Number(a[2]),a[3],Number(a[4]),a.slice(5)));
}
