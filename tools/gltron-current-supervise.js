#!/usr/bin/env node
'use strict';
// Native GL lifecycle with process-scoped parent ownership.
//
// Node port of the former tools/gltron-current-supervise.py; same CLI, files,
// JSON receipts and exit codes:
//   node tools/gltron-current-supervise.js OUT COMMIT
//   node tools/gltron-current-supervise.js watchdog OUT TOKEN SECONDS PHASE
//
// PR_SET_PDEATHSIG belongs to the spawning *thread*: a command runner's
// transient spawn thread can exit while its process is still alive. The
// original replaced that inherited notification with a pinned parent-process
// pidfd. Node exposes neither prctl nor pidfd_open and never sets a
// parent-death signal on its own spawns, so the inherited policy is recorded as
// 0 and nothing is cleared; the parent is pinned by PID and start token and its
// death is observed as getppid() (process.ppid, read live) leaving that PID — a
// reparent happens only when the parent process itself has exited. Ordinary
// signal handling, the independent deadlines, native waits and separate pipe
// EOFs are the boids supervisor's, unchanged.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const np=require('./native-proc.cjs');
const M=module.exports;
const SIG=os.constants.signals;
const CHROME='/opt/google/chrome/chrome';

// A private instance of the boids lifecycle, as the original loaded its own
// copy with importlib: scoped() is replaced below without touching other users.
function privateBase(){
  const file=require.resolve('./boids-current-supervise.js');
  const prior=require.cache[file];
  delete require.cache[file];
  try{return require(file);}
  finally{if(prior)require.cache[file]=prior;else delete require.cache[file];}
}
const BASE=privateBase();
const TOKEN_SCOPED=BASE.scoped;
let ACTIVE_SCOPE=null;

const skip=e=>!!e&&['ENOENT','ESRCH','EPERM','EACCES'].includes(e.code);
const readJSON=p=>JSON.parse(fs.readFileSync(p,'utf8'));
function ok(cond,message){if(!cond){const e=new Error(message||'assertion failed');e.name='AssertionError';throw e;}}
const isChrome=pid=>fs.realpathSync(`/proc/${pid}/exe`)===CHROME;

// Pin explicitly owned Chrome descendants as well as the native token.
//
// Chrome rewrites environ. A kernel session inherited from our exclusively
// native child, exact browser binary and unique profile are independently
// verifiable. A foreign pipe holder in that session is excluded. Signal each
// pinned process separately; never broadcast to a process group.
//
// Linux only (/proc, /opt/google/chrome/chrome). Elsewhere no process can match
// that binary, so the scope is the token scope alone, as on a Linux host
// without that browser.
class NativeSessionScope{
  constructor(out,token){
    this.path=path.join(String(out),'native-session.json');
    this.token=token;
  }
  rows(sig=null){
    if(!np.linux||!fs.existsSync(this.path))return [];
    const root=readJSON(this.path);
    try{
      if(BASE.identity(root.pid)[0]!==root.startToken)return []; // session leader PID has been reused
    }catch(e){if(!skip(e))throw e;} // original leader reaped; its session still owns descendants
    const browserPath=path.join(path.dirname(this.path),'browser-session.json');
    const profile='--user-data-dir='+path.join(fs.realpathSync(path.dirname(this.path)),'profile');
    if(!fs.existsSync(browserPath)){
      // Puppeteer detaches Chrome into its own session; Chrome rewrites both
      // environ and argv. Pin the actual direct child while its kernel parent
      // relation is still observable, before any signal.
      for(const name of fs.readdirSync('/proc')){
        if(!/^\d+$/.test(name))continue;
        try{
          const pid=Number(name);
          if(np.parentPid(pid)!==root.pid||np.sid(pid)!==pid)continue;
          if(!isChrome(pid)||!fs.readFileSync(`/proc/${pid}/cmdline`).includes(Buffer.from(profile)))continue;
          const before=BASE.identity(pid)[0];
          // pidfd_open has no Node API: re-read identity and kernel relations.
          if(BASE.identity(pid)[0]!==before||np.parentPid(pid)!==root.pid||np.sid(pid)!==pid)continue;
          const candidate=path.join(path.dirname(browserPath),`browser-session-${process.pid}.candidate`);
          BASE.write(candidate,{pid,startToken:before,native:root,profile,pinnedAt:np.now(),ownership:'observed direct native child, exact Chrome/profile, own session'});
          try{fs.linkSync(candidate,browserPath);} // atomic first owner
          catch(e){if(e.code!=='EEXIST')throw e;}
          finally{fs.unlinkSync(candidate);}
          break;
        }catch(e){if(!skip(e))throw e;}
      }
    }
    if(!fs.existsSync(browserPath))return [];
    const browser=readJSON(browserPath);
    try{
      if(BASE.identity(browser.pid)[0]!==browser.startToken)return [];
    }catch(e){if(!skip(e))throw e;}
    const rows=[];
    for(const name of fs.readdirSync('/proc')){
      if(!/^\d+$/.test(name)||Number(name)===process.pid)continue;
      try{
        const pid=Number(name);
        const [before,state]=BASE.identity(pid);
        if(state==='Z'||Number(before)<Number(browser.startToken)||np.sid(pid)!==browser.pid)continue;
        if(!isChrome(pid))continue;
        const [after,state2]=BASE.identity(pid);
        if(before!==after||state2==='Z'||np.sid(pid)!==browser.pid)continue;
        const row={pid,startToken:before,ownership:'exact Chrome binary and pinned browser child session'};
        if(sig!==null&&sig!==undefined){
          process.kill(pid,sig);
          Object.assign(row,{sent:true,signal:sig});
        }
        rows.push(row);
      }catch(e){if(!skip(e))throw e;}
    }
    return rows;
  }
}

function scoped(token,sig=null){
  let rows=[];
  if(ACTIVE_SCOPE!==null&&ACTIVE_SCOPE.token===token)rows=ACTIVE_SCOPE.rows(sig);
  const known=new Set(rows.map(r=>r.pid));
  rows.push(...TOKEN_SCOPED(token,sig).filter(r=>!known.has(r.pid)));
  return rows;
}
BASE.scoped=scoped;

function spawningThreads(parent){
  if(!np.linux)return [];
  const threads=[];
  for(const task of fs.readdirSync(`/proc/${parent}/task`)){
    try{
      if(fs.readFileSync(`/proc/${parent}/task/${task}/children`,'utf8').split(/\s+/).includes(String(process.pid)))threads.push(Number(task));
    }catch(e){if(e.code!=='ENOENT')throw e;}
  }
  return threads;
}

class ParentProcessSupervisor extends BASE.Supervisor{
  spawn(command,prefix,env){
    // Existing arm() keeps all startup/deadline behavior. Substitute only the
    // watchdog entry point so its independent scope includes Chrome.
    if(prefix.endsWith('-watchdog-')&&command.length>2&&command[2]==='watchdog'){
      command=[...command];
      command[1]=__filename;
    }
    const p=super.spawn(command,prefix,env);
    if(prefix===''){
      // os.getsid(pid)==pid; macOS exposes no session id, and a setsid child
      // is also its own process-group leader.
      ok((np.linux?np.sid(p.pid):np.pgid(p.pid))===p.pid);
      BASE.write(path.join(this.out,'native-session.json'),{pid:p.pid,startToken:BASE.identity(p.pid)[0],token:this.token});
    }
    return p;
  }
  async run(){
    ACTIVE_SCOPE=new NativeSessionScope(this.out,this.token);
    const parent=process.ppid;
    // PR_GET_PDEATHSIG has no Node API; Node never sets one on spawn.
    const inherited=0;
    // Do not silently change a caller's unrelated parent-death policy.
    if(![0,SIG.SIGTERM].includes(inherited))throw Object.assign(new Error('unsupported inherited parent-death signal'),{name:'RuntimeError'});
    const threads=spawningThreads(parent);
    this.parent_owner={pid:parent,startToken:BASE.identity(parent)[0],
      spawningThreads:threads,inheritedPdeathsig:inherited,
      mechanism:'pinned parent process start token and live getppid',armedAt:np.now(),
      parentDeathObserved:false};
    // Pin and arm before running; the pin is the parent PID process.ppid reports.
    this._parent_poll=()=>process.ppid!==parent;
    BASE.write(path.resolve(this.out)+'-parent-process-armed.json',this.parent_owner);
    try{
      return await super.run();
    }finally{
      this.parent_owner.parentProcessAliveAtJoin=!this._parent_poll();
      this.parent_owner.spawningThreadsAliveAtJoin=Object.fromEntries(threads.map(t=>[String(t),fs.existsSync(`/proc/${parent}/task/${t}`)]));
      BASE.write(path.join(this.out,'parent-process-owner.json'),this.parent_owner);
    }
  }
  async pump(){
    // Observe ownership while the native parent is alive. This is OS
    // lifecycle observation only; it sends no browser or guest request.
    if(!fs.existsSync(path.join(this.out,'browser-session.json')))ACTIVE_SCOPE.rows();
    if(this._parent_poll()&&!this.parent_owner.parentDeathObserved){
      Object.assign(this.parent_owner,{parentDeathObserved:true,observedAt:np.now()});
      this.requested(SIG.SIGTERM,null);
    }
    return super.pump();
  }
}

async function main(argv=process.argv.slice(2)){
  if(argv[0]==='watchdog'){
    const [out,token,seconds,phase]=argv.slice(1);
    ACTIVE_SCOPE=new NativeSessionScope(out,token);
    BASE.watchdog(out,token,seconds,phase);
    return 0;
  }
  if(argv.length!==2||argv.some(a=>a.startsWith('-'))){
    process.stderr.write('usage: gltron-current-supervise.js [-h] out commit\n');
    return 2;
  }
  const [out,commit]=argv;
  return new ParentProcessSupervisor(out,['node','tools/gltron-current-native-capture.cjs',out,commit],
    {runtime:300,runtime_watchdog:320}).run();
}

Object.assign(M,{BASE,TOKEN_SCOPED,NativeSessionScope,scoped,ParentProcessSupervisor,main,
  write:BASE.write,identity:BASE.identity,Supervisor:BASE.Supervisor,Capture:BASE.Capture});
Object.defineProperty(M,'ACTIVE_SCOPE',{get:()=>ACTIVE_SCOPE,set:v=>{ACTIVE_SCOPE=v;},enumerable:true});

if(require.main===module)
  main().then(rc=>process.exit(rc??0),e=>{console.error(e&&e.stack||e);process.exit(1);});
