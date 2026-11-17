#!/usr/bin/env node
'use strict';
// Dedicated waiting launch owner, pinned to one actual task worker process.
//
// The outer remains the normal ParentProcessSupervisor. No unsafe-ancestor mode.
// The independent watchdog is armed before launching that outer.
//
// Node has no pidfd_open / pidfd_send_signal / prctl (CONVENTIONS item 10): a
// "pin" is the process's recorded start token, polled every 20ms, and a signal
// is sent only while the numeric PID still carries that token. The original
// imported boids-current-supervise.py only for identity/write/Capture; those
// three small primitives are reproduced here so this owner does not depend on
// the other group's port.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const assert=require('node:assert/strict');
const NP=require('./native-proc.cjs');
const ROOT=path.resolve(__dirname,'..');

// boids identity(pid): (startToken, state).
function identity(pid){return [NP.token(pid),NP.state(pid)];}
// boids write(): complete pending file, then atomic replace.
function write(p,value){
  const pending=p+'.pending';
  fs.writeFileSync(pending,JSON.stringify(value,null,2)+'\n');fs.renameSync(pending,p);
}
// boids Capture: drain both pipes to <prefix>{stdout,stderr}.log and record EOF.
// Node streams are event driven, so pump() has nothing to poll.
class Capture{
  constructor(child,out,prefix){
    this.eof={stdout:false,stderr:false};this.eof_at={};this.bytes={stdout:0,stderr:0};this.errors=[];this.files={};
    for(const name of ['stdout','stderr']){
      try{this.files[name]=fs.openSync(path.join(out,prefix+name+'.log'),'w');}
      catch(e){this.errors.push(String(e));this.files[name]=null;}
      child[name].on('data',b=>{this.bytes[name]+=b.length;if(this.files[name]!==null)try{fs.writeSync(this.files[name],b);}catch(e){this.errors.push(String(e));}});
      child[name].on('end',()=>{this.eof[name]=true;this.eof_at[name]=NP.now();});
    }
  }
  pump(){}
  close(){for(const name of Object.keys(this.files)){if(this.files[name]!==null){try{fs.closeSync(this.files[name]);}catch(e){this.errors.push(String(e));}this.files[name]=null;}}}
}
const SIG=os.constants.signals;
// pidfd_send_signal equivalent: refuse a reused numeric PID.
function send(pid,expected,sig){
  try{if(NP.token(pid)!==expected)return false;process.kill(pid,sig);return true;}
  catch(e){if(e.code==='ESRCH')return false;throw e;}
}

function pin(pid,expected){
  const [before,state]=identity(pid);
  assert(before===expected&&state!=='Z','owner identity unavailable');
  // pidfd_open replacement: the start token is the pin (CONVENTIONS 10).
  assert(identity(pid)[0]===expected);
  // poll(): true once the pinned process has exited (or its PID was reused).
  const poll=()=>{try{const [t,s]=identity(pid);return t!==expected||s==='Z'||s==='X';}catch{return true;}};
  assert(!poll());
  return [{pid,startToken:expected},poll];
}

function anchor(pid,expected){
  // Require the named worker to be an actual ancestor at startup. Pin, then
  // check the worker survived the handover.
  let ancestor=process.ppid;const chain=[];
  while(ancestor>1){
    chain.push(ancestor);
    if(ancestor===pid)break;
    ancestor=NP.parentPid(ancestor);
  }
  assert(chain.includes(pid),'worker must be an actual ancestor');
  const [fd,poll]=pin(pid,expected);
  // prctl(PR_GET/SET_PDEATHSIG) has no Node API (CONVENTIONS 10). A Node
  // launcher cannot set one on this process either, so nothing is inherited
  // and nothing needs clearing; the inherited value is recorded as unobservable.
  assert(!poll(),'worker died during safe handover');
  return [fd,poll,{pid,startToken:expected,pidfd:null,ancestorChain:chain,inheritedPdeathsig:null,clearedPdeathsig:0}];
}

async function watchdog(out,pid,token,seconds){
  const [,dead]=pin(pid,token);const end=NP.monotonic()+seconds;
  write(path.join(out,'owner-watchdog-armed.json'),{pid:process.pid,ownerPid:pid,ownerStartToken:token,seconds,independent:true,at:NP.now()});
  let fired=false;
  while(true){
    await NP.sleep(20); // poll.poll(20)
    if(dead())break;
    if(fs.existsSync(path.join(out,'owner-watchdog-cancel')))break;
    if(NP.monotonic()>=end){send(pid,token,'SIGTERM');fired=true;break;}
  }
  write(path.join(out,'owner-watchdog-result.json'),{fired,ownerDead:dead(),at:NP.now()});
}

function collect(child){
  const r={stdout:'',stderr:'',exit:null};
  child.stdout.on('data',b=>r.stdout+=b);child.stderr.on('data',b=>r.stderr+=b);
  r.closed=new Promise(res=>child.once('close',(code,signal)=>{r.exit=code??-SIG[signal];res(r.exit);}));
  return r;
}
const timeout=(p,ms)=>Promise.race([p,NP.sleep(ms).then(()=>{throw Object.assign(Error('timed out'),{code:'ETIMEDOUT'});})]);

async function owner(out,worker,token,seconds,command){
  fs.mkdirSync(out,{recursive:true});
  const [fd,poll,ident]=anchor(worker,token);
  const requests=[];
  for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>requests.push(SIG[sig]));
  write(path.join(out,'worker-owner-armed.json'),{...ident,ownerPid:process.pid,ownerStartToken:identity(process.pid)[0],at:NP.now()});
  const w=cp.spawn(process.execPath,[__filename,'watchdog',out,String(process.pid),identity(process.pid)[0],String(seconds)],{stdio:['ignore','pipe','pipe']});
  const wr=collect(w);
  let c=null,cr=null,capture=null,cpin=null;
  try{
    const due=NP.monotonic()+5;
    while(!fs.existsSync(path.join(out,'owner-watchdog-armed.json'))){
      assert(wr.exit===null&&NP.monotonic()<due);await NP.sleep(5);
    }
    assert(!poll());
    c=cp.spawn(command[0],command.slice(1),{cwd:ROOT,stdio:['inherit','pipe','pipe'],detached:true});
    cr={exit:null};cr.closed=new Promise(res=>c.once('exit',(code,signal)=>{cr.exit=code??-SIG[signal];res(cr.exit);}));
    const ctoken=identity(c.pid)[0];cpin=pin(c.pid,ctoken);capture=new Capture(c,out,'outer-');
    write(path.join(out,'outer-child.json'),{pid:c.pid,startToken:ctoken,pidfd:null,args:command,at:NP.now()});
    let cancelled=false;
    while(cr.exit===null){
      capture.pump();
      if((poll()||requests.length)&&!cancelled){
        send(c.pid,ctoken,'SIGTERM');cancelled=true;
        write(path.join(out,'owner-cancellation.json'),{workerDied:poll(),signals:requests,at:NP.now()});
      }
      await NP.sleep(10);
    }
    const rc=await cr.closed;const end=NP.monotonic()+15;
    while(!Object.values(capture.eof).every(Boolean)&&NP.monotonic()<end){capture.pump();await NP.sleep(5);}
    write(path.join(out,'owner-outer-wait.json'),{pid:c.pid,returncode:rc,actualWait:true,stdoutEOF:capture.eof.stdout,stderrEOF:capture.eof.stderr,workerAlive:!poll(),at:NP.now()});
    assert(Object.values(capture.eof).every(Boolean),'outer EOF missing');
    return rc;
  }finally{
    if(c!==null&&cr.exit===null){
      send(c.pid,cpin[0].startToken,'SIGTERM');
      await timeout(cr.closed,20000);
    }
    fs.closeSync(fs.openSync(path.join(out,'owner-watchdog-cancel'),'a'));
    await timeout(wr.closed,10000);
    write(path.join(out,'owner-watchdog-wait.json'),{pid:w.pid,returncode:wr.exit,actualWait:true,stdoutEOF:true,stderrEOF:true,stdout:wr.stdout,stderr:wr.stderr});
    if(capture)capture.close();
  }
}

module.exports={ROOT,identity,write,Capture,pin,anchor,watchdog,owner};
if(require.main===module){
  const a=process.argv.slice(2);
  (a[0]==='watchdog'?watchdog(a[1],Number(a[2]),a[3],Number(a[4])):owner(a[1],Number(a[2]),a[3],Number(a[4]),a.slice(5)).then(rc=>{process.exitCode=rc&255;}))
    .catch(e=>{console.error(e&&e.stack||e);process.exitCode=1;});
}
