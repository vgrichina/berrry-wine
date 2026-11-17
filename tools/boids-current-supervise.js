#!/usr/bin/env node
'use strict';
// One-shot supervisor: real waits/pipe EOF, token scope and pinned identities.
//
// Node port of the former tools/boids-current-supervise.py; same CLI, files,
// JSON receipts, exit codes, signals and deadlines:
//   node tools/boids-current-supervise.js OUT COMMIT BACKEND MODE [FIXTURE...]
//   node tools/boids-current-supervise.js watchdog OUT TOKEN SECONDS PHASE
//
// TERM records intent without throwing across the pending startup window.
// All acquired children belong to one cleanup path. No process-group signalling.
//
// Port notes. Node has no pidfd_open / pidfd_send_signal: a pin is the start
// token from tools/native-proc.cjs, re-read after the scope check and
// immediately before each process.kill, so a reused numeric PID is never
// signalled. Scope on Linux is the BOIDS_CURRENT_TOKEN entry in
// /proc/<pid>/environ, exactly as before. macOS will not show another
// process's environment, so there the scope is the native child's own process
// group (it is spawned as a session leader): adopt() records that leader per
// token, and the independent watchdog adopts it from OUT/process.json. Each
// process in scope is still signalled individually, never through killpg.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),os=require('node:os');
const np=require('./native-proc.cjs');
const M=module.exports;
const SELF=__filename;
const SIG=os.constants.signals;
const TOKEN_VAR='BOIDS_CURRENT_TOKEN';

const gone=e=>!!e&&['ESRCH','ENOENT'].includes(e.code);
const denied=e=>!!e&&['EPERM','EACCES'].includes(e.code);
function error(name,message){const e=new Error(message);e.name=name;return e;}
// Python repr(exc) for the receipts' error field.
function repr(e){
  if(!(e instanceof Error))return String(e);
  return (e.name||'Error')+'('+JSON.stringify(String(e.message))+')';
}
const exists=p=>fs.existsSync(p);
const touch=p=>fs.closeSync(fs.openSync(p,'a'));
const readJSON=p=>JSON.parse(fs.readFileSync(p,'utf8'));
// Popen.poll(): null while running, exit status, or -signal.
function poll(p){
  if(p.exitCode!==null)return p.exitCode;
  if(p.signalCode!==null)return -SIG[p.signalCode];
  return null;
}
async function waitProc(p,seconds){
  const end=np.monotonic()+seconds;
  while(poll(p)===null&&np.monotonic()<end)await np.sleep(5);
  return poll(p);
}

function write(p,value){
  p=String(p);
  const pending=p+'.pending';
  fs.writeFileSync(pending,JSON.stringify(value,null,2)+'\n');
  fs.renameSync(pending,p);
}

// (startToken, state); throws code ESRCH once the process is gone.
function identity(pid){return [np.token(pid),np.state(pid)];}

// macOS scope: token -> Map(group leader pid -> leader start token).
const GROUPS=new Map();
function adopt(token,pid,startToken){
  if(!GROUPS.has(token))GROUPS.set(token,new Map());
  GROUPS.get(token).set(Number(pid),startToken);
}
// A recorded group is void once its leader PID carries another start token and
// leads its own group again (the original group had to empty for that reuse).
function validGroups(token,table){
  const groups=GROUPS.get(token),valid=new Set();
  if(!groups)return valid;
  for(const [leader,start] of groups){
    const row=table.find(r=>r.pid===leader);
    if(row&&row.startToken!==start&&row.pgid===leader){groups.delete(leader);continue;}
    valid.add(leader);
  }
  return valid;
}
function adoptRecorded(out,token){
  if(np.linux)return;
  try{const p=readJSON(path.join(String(out),'process.json'));adopt(token,p.pid,p.startToken);}catch{}
}
function inScope(pid,token,table){
  if(np.linux)return np.environ(pid).includes(TOKEN_VAR+'='+token);
  const valid=validGroups(token,table||np.processes());
  return valid.has(np.pgid(pid));
}

function signal_owned(pid,token,sig,expected=null){
  // Verify scope after pinning identity; never signal a reused numeric PID.
  if(pid===process.pid)return false;
  try{
    const [before,state]=M.identity(pid);
    if(state==='Z'||(expected!==null&&expected!==undefined&&before!==expected))return false;
    const owned=inScope(pid,token);
    const [after,state2]=M.identity(pid);
    if(before!==after||state2==='Z'||!owned)return false;
    process.kill(pid,sig);
    return true;
  }catch(e){
    if(gone(e))return false;
    throw e;
  }
}

function scoped(token,sig=null){
  const found=[];
  const table=np.processes();
  const valid=np.linux?null:validGroups(token,table);
  for(const r of table){
    if(r.pid===process.pid)continue;
    try{
      if(r.state==='Z')continue;
      if(np.linux?!np.environ(r.pid).includes(TOKEN_VAR+'='+token):!valid.has(r.pgid))continue;
      const row={pid:r.pid,startToken:r.startToken};
      if(sig!==null&&sig!==undefined){row.sent=M.signal_owned(row.pid,token,sig,r.startToken);row.signal=sig;}
      found.push(row);
    }catch(e){if(!gone(e)&&!denied(e))throw e;}
  }
  return found;
}

function watchdog(out,token,seconds,phase){
  out=String(out);seconds=Number(seconds);
  const end=np.monotonic()+seconds;
  write(path.join(out,phase+'-watchdog-armed.json'),{pid:process.pid,armedAt:np.now(),seconds,independent:true});
  while(np.monotonic()<end){
    if(exists(path.join(out,phase+'-watchdog-cancel'))){
      write(path.join(out,phase+'-watchdog-result.json'),{fired:false,cancelledAt:np.now()});
      return;
    }
    np.sleepSync(20);
  }
  const sent=[];
  const until=np.monotonic()+.5;
  while(np.monotonic()<until){
    adoptRecorded(out,token);
    sent.push(...M.scoped(token,SIG.SIGKILL));
    np.sleepSync(20);
  }
  write(path.join(out,phase+'-watchdog-result.json'),{fired:true,signals:sent,endedAt:np.now()});
}

// Drain both pipes to <prefix>{stdout,stderr}.log. Bytes are written as they
// arrive; EOF is observed (eof/eof_at) only by pump(), once, like the
// original's selector loop, so every EOF decision is made at a pump.
class Capture{
  constructor(child,out,prefix){
    this.process=child;
    this.eof={stdout:false,stderr:false};
    this.eof_at={};this.bytes={stdout:0,stderr:0};
    this.files={};this.errors=[];
    this._ended={stdout:false,stderr:false};this._seen={stdout:false,stderr:false};
    for(const name of Object.keys(this.eof)){
      try{this.files[name]=fs.openSync(path.join(String(out),prefix+name+'.log'),'w');}
      catch(e){this.errors.push(repr(e));this.files[name]=fs.openSync(os.devNull,'w');}
      const pipe=child[name];
      pipe.on('data',b=>{
        this.bytes[name]+=b.length;
        try{for(let off=0;off<b.length;)off+=fs.writeSync(this.files[name],b,off);}
        catch(e){
          this.errors.push(repr(e));
          try{fs.closeSync(this.files[name]);}catch{}
          this.files[name]=fs.openSync(os.devNull,'w');
        }
      });
      pipe.on('end',()=>{this._ended[name]=true;});
      pipe.on('error',e=>{this.errors.push(repr(e));});
    }
  }
  pump(){
    for(const name of Object.keys(this.eof)){
      if(this._ended[name]&&!this._seen[name]){this._seen[name]=true;this.eof[name]=true;this.eof_at[name]=np.now();}
    }
  }
  close(){
    for(const name of Object.keys(this.eof)){
      const pipe=this.process[name];
      if(pipe&&!this._ended[name])pipe.destroy();
    }
    for(const name of Object.keys(this.files)){
      if(this.files[name]===null)continue;
      try{fs.closeSync(this.files[name]);}catch(e){this.errors.push(repr(e));}
      this.files[name]=null;
    }
  }
}

// subprocess.Popen(..., stdout=PIPE, stderr=PIPE, env=env, start_new_session=True).
// Exported so a test can wrap it, as the original's tests wrapped Popen.
function popen(command,env){
  const p=cp.spawn(command[0],command.slice(1),{stdio:['inherit','pipe','pipe'],env,detached:true});
  p.on('error',()=>{});
  if(p.pid===undefined){
    for(const s of [p.stdout,p.stderr])if(s)s.destroy();
    throw error('FileNotFoundError','cannot execute: '+command[0]);
  }
  return p;
}

class Supervisor{
  constructor(out,command,{preparation=240,runtime=300,preparation_watchdog=260,runtime_watchdog=320,grace=5}={}){
    this.out=String(out);this.command=command;
    this.preparation=preparation;this.runtime=runtime;this.grace=grace;
    this.watch_seconds={preparation:preparation_watchdog,runtime:runtime_watchdog};
    this.token=crypto.randomBytes(32).toString('hex');
    this.native=null;
    this.watches=[];this.captures=[];this.signals=[];this.actions=[];
    this.phase='preparation';this.error=null;this.timed=false;this.cleaned=false;
    this.exit=null;
  }
  requested(signum,frame){
    if(this.signals.length<16)this.signals.push({signal:signum,at:np.now()});
  }
  async pump(){
    for(const c of this.captures)c.pump();
    await np.sleep(10);
  }
  spawn(command,prefix,env){
    const p=M.popen(command,env);
    // Register before any subsequent fallible operation.
    if(prefix==='')this.native=p;
    else this.watches.push([this.phase,p]);
    this.captures.push(new M.Capture(p,this.out,prefix));
    const start=M.identity(p.pid)[0];
    if(prefix==='')adopt(this.token,p.pid,start);
    write(path.join(this.out,prefix+'process.json'),{pid:p.pid,startToken:start});
    if(this.captures[this.captures.length-1].errors.length)
      throw error('RuntimeError','pipe log open failed: '+JSON.stringify(this.captures[this.captures.length-1].errors));
    return p;
  }
  async arm(){
    const env={...process.env};
    delete env[TOKEN_VAR];
    const p=this.spawn([process.execPath,SELF,'watchdog',this.out,this.token,
      String(this.watch_seconds[this.phase]),this.phase],this.phase+'-watchdog-',env);
    // Python runs a signal handler between bytecodes; Node runs it from the
    // event loop. Let a request already delivered during the spawn land first.
    await new Promise(r=>setImmediate(r));
    const end=np.monotonic()+5;
    const armed=path.join(this.out,this.phase+'-watchdog-armed.json');
    while(!exists(armed)){
      if(this.signals.length)return false;
      if(poll(p)!==null||np.monotonic()>=end)throw error('RuntimeError',this.phase+' watchdog did not arm');
      await this.pump();
    }
    if(readJSON(armed).pid!==p.pid)throw error('RuntimeError','watchdog identity mismatch');
    return true;
  }
  async cleanup(){
    if(this.cleaned)throw error('RuntimeError','duplicate cleanup');
    this.cleaned=true;
    const end=np.monotonic()+this.grace;
    let c;
    for(;;){
      this.actions.push(...M.scoped(this.token,np.monotonic()<end?SIG.SIGTERM:SIG.SIGKILL));
      await this.pump();
      c=this.captures.find(x=>x.process===this.native);
      if((this.native===null||poll(this.native)!==null)&&(!c||Object.values(c.eof).every(Boolean))&&!M.scoped(this.token).length)break;
      if(np.monotonic()>=end+5){
        this.error=this.error||'native cleanup wait/EOF deadline';
        break;
      }
    }
    let native_wait=null;
    if(this.native!==null){
      const rc=await waitProc(this.native,.1);
      native_wait=rc!==null?{pid:this.native.pid,returncode:rc,signal:rc<0?-rc:null,actualWait:true,waitedAt:np.now()}
        :{pid:this.native.pid,returncode:null,actualWait:false};
    }
    // Independent deadlines stay armed until native wait AND observed EOF.
    const native_closed=(this.native===null||!!(native_wait&&native_wait.actualWait&&c&&Object.values(c.eof).every(Boolean)))&&!M.scoped(this.token).length;
    if(native_closed)
      for(const [phase] of this.watches)touch(path.join(this.out,phase+'-watchdog-cancel'));
    const waits=[];
    for(const [phase,p] of this.watches){
      const due=np.monotonic()+(native_closed?6:this.watch_seconds[phase]+2);
      while(poll(p)===null&&np.monotonic()<due)await this.pump();
      if(poll(p)===null){
        p.kill('SIGKILL'); // unreaped direct child; its PID cannot have been reused
        this.error=this.error||'watchdog join deadline';
      }
      const rc=await waitProc(p,1);
      waits.push(rc!==null?{phase,pid:p.pid,returncode:rc,actualWait:true,waitedAt:np.now()}
        :{phase,pid:p.pid,returncode:null,actualWait:false});
    }
    const due=np.monotonic()+1;
    while(!this.captures.every(x=>Object.values(x.eof).every(Boolean))&&np.monotonic()<due)await this.pump();
    for(const x of this.captures){
      x.close();
      if(x.errors.length)this.error=this.error||'pipe capture error: '+JSON.stringify(x.errors);
    }
    for(const row of waits){
      const w=this.captures.find(x=>x.process.pid===row.pid);
      row.stdoutEOF=w?w.eof.stdout:null;row.stderrEOF=w?w.eof.stderr:null;
      row.pipeBytes=w?w.bytes:null;row.eofAt=w?w.eof_at:null;
      const result=path.join(this.out,row.phase+'-watchdog-result.json');
      row.result=exists(result)?readJSON(result):null;
      write(path.join(this.out,row.phase+'-wait.json'),row);
    }
    c=this.captures.find(x=>x.process===this.native);
    const last=waits.length?waits[waits.length-1]:{};
    const rc=native_wait?native_wait.returncode:null;
    const remaining=M.scoped(this.token);
    const failed=this.error||!native_wait||!native_wait.actualWait||
      !waits.every(x=>x.actualWait&&x.returncode===0&&x.stdoutEOF&&x.stderrEOF&&x.result!==null)||
      !c||!Object.values(c.eof).every(Boolean)||remaining.length;
    this.exit=this.signals.length?128+this.signals[0].signal:this.timed?124:this.error?1:
      rc?(rc<0?128-rc:rc):failed?1:0;
    write(path.join(this.out,'wait.json'),{pid:this.native?this.native.pid:null,returncode:rc,
      nativeWait:native_wait,actualWait:!!(native_wait&&native_wait.actualWait),timedOut:this.timed,
      phase:this.phase,stdoutEOF:c?c.eof.stdout:null,stderrEOF:c?c.eof.stderr:null,
      pipeBytes:c?c.bytes:null,eofAt:c?c.eof_at:null,
      watchdogs:waits,watchdogReturncode:last.returncode??null,watchdogStdoutEOF:last.stdoutEOF??null,
      watchdogStderrEOF:last.stderrEOF??null,signals:this.signals,error:this.error,cleanupCount:1,
      cleanupSignals:this.actions,remainingAfterRuntime:remaining,supervisorExitCode:this.exit,
      cause:this.signals.length?'signal request':this.timed?'native deadline':this.error?'supervisor error':'native completion',endedAt:np.now()});
  }
  async run(){
    fs.mkdirSync(path.dirname(path.resolve(this.out)),{recursive:true});
    fs.mkdirSync(this.out); // exist_ok=False
    // signal.signal() replaces the handler: hold the existing listeners aside.
    const old={};
    for(const s of ['SIGTERM','SIGINT']){
      const handler=()=>this.requested(SIG[s],null);
      old[s]={handler,listeners:process.listeners(s)};
      process.removeAllListeners(s);process.on(s,handler);
    }
    const prepared=path.join(this.out,'prepared.json');
    try{
      // Fail before launching children if this process cannot be identified.
      const self=M.identity(process.pid);
      write(path.join(this.out,'supervisor-identity.json'),{pid:process.pid,startToken:self[0],token:this.token});
      if(await this.arm()&&!this.signals.length){
        const p=this.spawn(this.command,'',{...process.env,[TOKEN_VAR]:this.token});
        let end=np.monotonic()+this.preparation;
        const lastWatch=()=>this.watches[this.watches.length-1][1];
        write(path.join(this.out,'preparation-armed.json'),{pid:p.pid,watchdogPid:lastWatch().pid,seconds:this.preparation,startedAt:np.now()});
        while(!exists(prepared)&&poll(p)===null&&!this.signals.length&&np.monotonic()<end){
          if(poll(lastWatch())!==null)throw error('RuntimeError','preparation watchdog exited before native completion');
          await this.pump();
        }
        this.timed=np.monotonic()>=end;
        if(poll(p)===0&&!exists(prepared))throw error('RuntimeError','native exited before preparation');
        if(exists(prepared)&&poll(p)===null&&!this.signals.length&&!this.timed){
          this.phase='runtime';
          if(await this.arm()&&!this.signals.length){
            touch(path.join(this.out,'preparation-watchdog-cancel'));
            const started=np.now();
            end=np.monotonic()+this.runtime;
            write(path.join(this.out,'native-armed.json'),{pid:p.pid,watchdogPid:lastWatch().pid,startedAt:started,seconds:this.runtime,deadline:started+this.runtime});
            write(path.join(this.out,'runtime-start.json'),{deadline:Math.trunc((started+this.runtime)*1000)});
            while(poll(p)===null&&!this.signals.length&&np.monotonic()<end){
              if(this.watches.some(([,w])=>{const r=poll(w);return r!==null&&r!==0;}))
                throw error('RuntimeError','watchdog failed during runtime');
              if(poll(lastWatch())===0&&!exists(path.join(this.out,'runtime-watchdog-result.json')))
                throw error('RuntimeError','runtime watchdog exited without deadline/cancel receipt');
              await this.pump();
            }
            this.timed=np.monotonic()>=end;
          }
        }
      }
    }catch(e){
      this.error=repr(e);
    }finally{
      try{await this.cleanup();}
      finally{
        for(const s of Object.keys(old)){
          process.removeListener(s,old[s].handler);
          for(const l of old[s].listeners)process.on(s,l);
        }
      }
    }
    return this.exit;
  }
}

async function main(argv=process.argv.slice(2)){
  const [out,commit,backend,mode,...fixture]=argv;
  if(mode===undefined)throw error('ValueError','usage: boids-current-supervise.js OUT COMMIT BACKEND MODE [FIXTURE...]');
  return new M.Supervisor(out,['node','tools/boids-current-run.cjs',out,commit,backend,mode,...fixture]).run();
}

Object.assign(M,{SELF,TOKEN_VAR,write,identity,adopt,signal_owned,scoped,watchdog,Capture,popen,Supervisor,main,poll,repr});

if(require.main===module){
  const a=process.argv.slice(2);
  if(a[0]==='watchdog'){watchdog(a[1],a[2],a[3],a[4]);process.exit(0);}
  main().then(rc=>process.exit(rc??0),e=>{console.error(e&&e.stack||e);process.exit(1);});
}
