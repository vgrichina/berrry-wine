#!/usr/bin/env node
'use strict';
// Native qualification by default; --original is a separately assigned pipeline.
//
// Never builds or changes shared outputs. Runtime sources and module are sealed
// in memory; only Git identities, hashes and helper diffs persist in evidence.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const cp=require('node:child_process'),net=require('node:net'),zlib=require('node:zlib');
const np=require('./native-proc.cjs');
const M=module.exports;

M.ROOT=path.resolve(__dirname,'..');
M.RUN=process.env.DELPHI5_RUN||path.join(M.ROOT,'scratch/runs/20261116-vb5cce-reviewed-context-install-ide');
M.HEAD=cp.execFileSync('git',['rev-parse',process.env.DELPHI5_GIT||'HEAD'],{cwd:M.ROOT}).toString().trim();
M.OWN_FDS=new Set();
M.ORIGINAL_STARTED=false;
M.MEDIA=path.join(M.ROOT,'test/binaries/candidates/vb5cce-original');
M.SUPPORT_PACKAGE=path.join(M.ROOT,'test/binaries/win98-games-a-d/Colin-Mcrae-Rally2-demo-D3D/extracted/dx7aeng.exe');
M.SUPPORT_PACKAGE_SHA256='564de93dcc50691480332e2ccb5565908760b295faa70f8c68854f69dad87189';
M.CFGMGR32_SHA256='572387372791a7bc8d336fbbb6af6a9651a627124599f862ac2bd235145b7b80';
M.SUPPORT_MOUNTS=[];
M.OWN_SOURCES=['tools/vb5cce-original-runtime.js','test/run.js',
  'lib/installed-dll-closure.js','test/test-installed-dll-closure.cjs','test/test-vb5-runtime-shutdown.cjs',
  'src/09a9-comctl32.wat','src/api_table.json','src/01b-api-hashes.generated.wat',
  'src/09b2-dispatch-table.generated.wat','tools/gen_api_table.js','test/test-image-list-icons.js'];
// The Python original asserted every *.py OWN_SOURCES entry (helpers executed
// from the working tree, outside the sealed loader) equals its HEAD blob. Those
// helpers are now JS; these are the former-.py helper names that keep the check.
M.PUBLISHED_HELPERS=new Set(['tools/vb5cce-original-runtime.js','tools/vb5cce-reviewed-control.js',
  'test/test-vb5-normal-exit-completion.cjs','test/test-vb5-runtime-shutdown.cjs',
  'tools/caesar3-current-native.js','tools/caesar3-persistent-owner.js','tools/caesar3-reviewed-modal.js',
  'tools/halflife2-current-native.js','tools/halflife2-persistent-owner.js','tools/halflife2-restored-native.js',
  'tools/halflife2-reviewed-next.js','tools/neverhood-original-current-control.js','tools/neverhood-original-current-runtime.js',
  'test/test-caesar3-persistent-owner.cjs','test/test-caesar3-reviewed-modal.cjs','test/test-halflife2-age-input-latency.cjs',
  'test/test-halflife2-controller-supervision.cjs','test/test-halflife2-launch-preconditions.cjs',
  'test/test-halflife2-persistent-owner.cjs','test/test-halflife2-receipt-clock.cjs',
  'test/test-halflife2-restored-native.cjs','test/test-neverhood-runtime-lifecycle.cjs']);
// Python read sys.argv at call time; callers may set M.ARGV (sys.argv shape,
// script name first) instead of mutating process.argv.
M.ARGV=null;
const argv=()=>M.ARGV??process.argv.slice(1);
const flag=f=>argv().includes(f);

function check(cond,message){if(!cond){const e=new Error(message||'');e.name='AssertionError';e.code='ERR_ASSERTION';throw e;}}
class TimeoutExpired extends Error{constructor(what,timeout){super(`Command '${what}' timed out after ${timeout} seconds`);this.name='TimeoutExpired';this.timeout=timeout;}}
// Python SystemExit(128+signum) raised by the signal handler.
class ShutdownRequested extends Error{constructor(code){super('ShutdownRequested('+code+')');this.name='ShutdownRequested';this.code=code;this.exitCode=code;}}
const sleep=np.sleep,now=np.now,monotonic=np.monotonic;
const R=(...p)=>path.join(String(M.RUN),...p);
const rel=(from,to)=>path.relative(String(from),String(to));
// Descriptor path a child can open. Linux keeps the original /proc/<pid>/fd
// form; elsewhere the descriptor is inherited at the same number (pass_fds).
const fd_path=fd=>np.linux?`/proc/${process.pid}/fd/${fd}`:`/dev/fd/${fd}`;

// Shutdown: a signal cannot raise inside running JS, so it rejects one shared
// promise that every interruptible wait races. Later signals are ignored.
let shutdownReject,ownSignalHandlers=[];
const shutdownPromise=new Promise((_,reject)=>{shutdownReject=reject;});shutdownPromise.catch(()=>{});
M.SHUTDOWN_SIGNAL=null;
const interruptible=p=>{p.catch(()=>{});return Promise.race([p,shutdownPromise]);};
function shutdown_signal(signum){
  // Complete joins and descriptor release even if the launcher repeats TERM.
  for(const [sig,fn] of ownSignalHandlers)process.off(sig,fn);
  ownSignalHandlers=[['SIGTERM',()=>{}],['SIGINT',()=>{}]];
  for(const [sig,fn] of ownSignalHandlers)process.on(sig,fn);
  if(M.SHUTDOWN_SIGNAL===null){M.SHUTDOWN_SIGNAL=signum;shutdownReject(new ShutdownRequested(128+signum));}
}
function install_shutdown_handlers(){
  for(const [sig,fn] of ownSignalHandlers)process.off(sig,fn);
  ownSignalHandlers=[['SIGTERM',()=>M.shutdown_signal(os.constants.signals.SIGTERM)],['SIGINT',()=>M.shutdown_signal(os.constants.signals.SIGINT)]];
  for(const [sig,fn] of ownSignalHandlers)process.on(sig,fn);
}

// Popen.returncode / wait helpers for a Node ChildProcess.
const exited=p=>p.exitCode!==null||p.signalCode!==null;
const returncode=p=>p.exitCode!==null?p.exitCode:p.signalCode!==null?-os.constants.signals[p.signalCode]:null;
function waitExit(p,timeout=null){
  if(exited(p))return Promise.resolve(true);
  return new Promise(resolve=>{
    let timer=null;const on=()=>{if(timer)clearTimeout(timer);resolve(true);};
    p.once('exit',on);
    // Unref'd: the live child keeps the loop alive; a lost race must not.
    if(timeout!==null)timer=setTimeout(()=>{p.off('exit',on);resolve(exited(p));},Math.max(0,timeout)*1000).unref();
  });
}
async function wait(p,timeout=null){
  if(!await waitExit(p,timeout))throw new TimeoutExpired(p.spawnargs.join(' '),timeout);
  return returncode(p);
}
function killpg(pid,sig){try{process.kill(-pid,sig);}catch(e){if(e.code!=='ESRCH')throw e;}}
async function terminate_owned(p){
  if(!exited(p))killpg(p.pid,'SIGTERM');
  if(await waitExit(p,10))return returncode(p);
  killpg(p.pid,'SIGKILL');
  return wait(p,10);
}
// Popen.communicate(timeout): both pipes to EOF and the actual exit.
function collect(p){
  if(!p.vb5_out){
    const o=p.vb5_out={stdout:[],stderr:[]};
    o.closed=new Promise(resolve=>{
      let n=0;const total=(p.stdout?1:0)+(p.stderr?1:0)+1,done=()=>{if(++n===total)resolve();};
      for(const k of ['stdout','stderr'])if(p[k]){
        if(p[k].destroyed||p[k].closed){done();continue;}
        p[k].on('data',b=>o[k].push(b));p[k].on('close',done);
      }
      if(exited(p))done();else p.once('exit',done);
    });
  }
  return p.vb5_out;
}
async function communicate(p,timeout=null){
  const o=collect(p);let timer;
  const ok=await Promise.race([o.closed.then(()=>true),
    timeout===null?new Promise(()=>{}):new Promise(r=>{timer=setTimeout(()=>r(false),Math.max(0,timeout)*1000).unref();})]);
  clearTimeout(timer);
  if(!ok)throw new TimeoutExpired(p.spawnargs.join(' '),timeout);
  return [Buffer.concat(o.stdout),Buffer.concat(o.stderr)];
}
// subprocess pass_fds: each descriptor is inherited at its own number.
function stdioWith(base,fds=[]){
  const stdio=[...base];
  for(const fd of fds){while(stdio.length<=fd)stdio.push('ignore');stdio[fd]=fd;}
  return stdio;
}
// Pipes are collected from spawn time: Node discards unread child output at
// exit, where Python's pipe kept it for a later communicate().
function popen(args,{cwd,env,pass_fds=[],start_new_session=false,stdout='pipe',stderr='pipe',stdin='inherit',collect:keep=true}={}){
  const p=cp.spawn(args[0],args.slice(1),{cwd,env,detached:start_new_session,stdio:stdioWith([stdin,stdout,stderr],pass_fds)});
  if(keep)collect(p);
  return p;
}
function start_native(args,out,err,opts={}){
  // Drain both native pipes while retaining the actual EOF observations.
  // Readers finish before their output files close. Process exit alone does
  // not establish pipe EOF: an inherited writer can outlive the direct child.
  const p=popen(args,{...opts,stdout:'pipe',stderr:'pipe',collect:false});
  const capture={stdoutEOF:false,stderrEOF:false,errors:[],threads:[]};
  p.vb5_capture=capture;
  const fdOf=t=>typeof t==='number'?t:t.fd;
  for(const [pipe,target,key] of [[p.stdout,out,'stdoutEOF'],[p.stderr,err,'stderrEOF']]){
    capture.threads.push(new Promise(resolve=>{
      pipe.on('data',body=>{try{fs.writeSync(fdOf(target),body);}catch(e){capture.errors.push(String(e));pipe.destroy();}});
      pipe.on('end',()=>{capture[key]=true;});
      pipe.on('error',e=>capture.errors.push(String(e)));
      pipe.on('close',resolve);
    }));
  }
  return p;
}
async function join_native_output(p){
  const capture=p.vb5_capture;
  if(capture===undefined||capture===null)return {outputMode:'regular files; no pipe EOF claim'};
  let joined=false,timer;
  await Promise.race([Promise.all(capture.threads).then(()=>{joined=true;}),new Promise(r=>{timer=setTimeout(r,10000).unref();})]);
  clearTimeout(timer);
  return {outputMode:'drained native pipes',stdoutEOF:capture.stdoutEOF,
    stderrEOF:capture.stderrEOF,outputErrors:capture.errors,readersJoined:joined};
}
async function wait_native(p,target,info,timeout=null){
  let normal=false,rc,failure=null;
  try{
    rc=await interruptible(wait(p,timeout));normal=true;
  }catch(e){failure=e;}
  // poll/absence is never represented as a join: always call wait.
  rc=await M.terminate_owned(p);
  const output=await M.join_native_output(p);
  M.publish(path.join(String(target),'native-wait.json'),{...info,exit:rc,actualWait:true,
    disposition:normal?'normal':'cleanup',...output,atWait:now(),atWaitMono:monotonic()});
  if(p.vb5_capture)check(output.stdoutEOF&&output.stderrEOF&&output.readersJoined&&!output.outputErrors.length,'native output drain incomplete');
  if(failure)throw failure;
  return rc;
}
async function join_watchdog(w){
  let a,b;
  try{[a,b]=await communicate(w,10);}
  catch(e){if(!(e instanceof TimeoutExpired))throw e;await M.terminate_owned(w);[a,b]=await communicate(w,10);}
  M.save('watchdog-wait.json',{pid:w.pid,exit:returncode(w),actualWait:true,
    stdoutEOF:true,stderrEOF:true,stdout:a.toString('utf8'),stderr:b.toString('utf8')});
}

const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function publish(file,value){
  file=String(file);
  const pending=path.join(path.dirname(file),path.basename(file)+'.'+process.pid+'.pending');
  const fd=fs.openSync(pending,'wx');
  try{fs.writeSync(fd,JSON.stringify(value,null,2)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  fs.linkSync(pending,file);fs.unlinkSync(pending);
}
function save(name,value){M.publish(R(name),value);}
// memfd_create + F_ADD_SEALS(15) have no Node API: the disciples2 helper owns
// the sealed descriptor primitive (required lazily so unit modes load without it).
function disciples2(){return require('./disciples2-current-supervisor.cjs');}
function seal(name,body){
  const fd=disciples2().seal(name,body);
  M.OWN_FDS.add(fd);
  return fd;
}
function close_owned(fd){fs.closeSync(fd);M.OWN_FDS.delete(fd);}
function compact_closed_observations(){
  // Desktop observations are bounded per native actor, but a full sequence
  // of authored tests creates many actors. Preserve every byte losslessly
  // after its actual process has gone; never compress an active writer.
  const dir=R('desktop-observations');
  const names=(fs.existsSync(dir)?fs.readdirSync(dir):[]).filter(n=>/^desktop-.*\.trace$/.test(n)).sort();
  for(const name of names){
    const p=path.join(dir,name),parts=name.split('-');
    if(parts.length<4||!/^\d+$/.test(parts[1])||np.exists(Number(parts[1])))continue;
    const body=fs.readFileSync(p),digest=sha(body),target=p.slice(0,-'.trace'.length)+'.trace.gz';
    const encoded=zlib.gzipSync(body); // Node's gzip header carries mtime 0.
    if(fs.existsSync(target))check(zlib.gunzipSync(fs.readFileSync(target)).equals(body));
    else{
      const fd=fs.openSync(target,'wx');
      try{fs.writeSync(fd,encoded);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
    }
    check(sha(zlib.gunzipSync(fs.readFileSync(target)))===digest);
    const fd=fs.openSync(R('observation-recovery.jsonl'),'a');
    try{
      fs.writeSync(fd,JSON.stringify({path:rel(M.RUN,p),gzip:rel(M.RUN,target),
        sha256:digest,bytes:body.length,gzipBytes:fs.statSync(target).size,
        writerAbsent:true,restore:'gzip -dc gzip > path; verify sha256'})+'\n');
      fs.fsyncSync(fd);
    }finally{fs.closeSync(fd);}
    fs.unlinkSync(p);
  }
}
function genuine_setupapi_support(){
  // The exact NT SetupAPI from this package statically imports CFGMGR32.
  // Keep both original PE bodies intact. Nothing is installed or copied into
  // the media directory; the native loader binds and attaches the companion.
  check(sha(fs.readFileSync(M.SUPPORT_PACKAGE))===M.SUPPORT_PACKAGE_SHA256);
  const cfg=cp.execFileSync('7z',['e','-so',String(M.SUPPORT_PACKAGE),'cfgmgr32.dll'],{cwd:M.ROOT,maxBuffer:1<<26});
  check(cfg.length===41984&&sha(cfg)===M.CFGMGR32_SHA256);
  const fd=M.seal('vb5-genuine-cfgmgr32',cfg);
  M.SUPPORT_MOUNTS.push('--vfs-mount='+fd_path(fd)+'=c:\\cfgmgr32.dll');
  M.save('genuine-support.json',{package:rel(M.ROOT,M.SUPPORT_PACKAGE),
    packageSHA256:M.SUPPORT_PACKAGE_SHA256,member:'cfgmgr32.dll',sha256:M.CFGMGR32_SHA256,
    size:cfg.length,seals:15,guestPath:'c:\\cfgmgr32.dll',modified:false});
  return fd;
}
const token=pid=>np.token(pid);
function native_identity(p){
  return {pid:p.pid,startToken:np.token(p.pid),invocationToken:crypto.randomUUID(),bootId:np.bootId()};
}
function git(args,opts={}){return cp.execFileSync('git',args,{cwd:M.ROOT,maxBuffer:1<<30,...opts});}
function sources(){
  let names=git(['ls-tree','-r','--name-only',M.HEAD]).toString().split('\n').filter(Boolean);
  names=names.filter(n=>['.js','.cjs','.json','.wat','.watx','.py'].some(x=>n.endsWith(x))&&
    (['src/','lib/','tools/','fonts/','test/'].some(x=>n.startsWith(x))||n==='host.js')&&!n.startsWith('test/binaries/'));
  const out=git(['cat-file','--batch'],{input:names.map(n=>M.HEAD+':'+n+'\n').join('')});
  const files={};let at=0;
  for(const name of names){
    const nl=out.indexOf(10,at),header=out.subarray(at,nl).toString().split(' ');
    check(header.length===3&&header[1]==='blob');
    const size=Number(header[2]);files[name]=out.subarray(nl+1,nl+1+size);
    check(out[nl+1+size]===10);at=nl+2+size;
  }
  // Qualification can test this worker's explicit patch in memory. An original
  // always requires one exact published tree and never consumes this overlay.
  const working=flag('--working-qualification');
  check(!(working&&['--original','--passive-original','--installed-original'].some(flag)));
  for(const name of M.OWN_SOURCES){
    if(working)files[name]=fs.readFileSync(path.join(M.ROOT,name));
    else if(M.PUBLISHED_HELPERS.has(name))check(files[name]&&files[name].equals(fs.readFileSync(path.join(M.ROOT,name))),'publish helper before sealing: '+name);
  }
  return files;
}
async function checked(name,args,env,fds,expected=0){
  const p=popen(args,{cwd:M.ROOT,env,pass_fds:fds,start_new_session:true});
  let timedOut=false,a,b;
  try{
    try{[a,b]=await interruptible(communicate(p,180));}
    catch(e){
      if(!(e instanceof TimeoutExpired))throw e;
      timedOut=true;
      killpg(p.pid,'SIGTERM');
      try{[a,b]=await communicate(p,10);}
      catch(t){if(!(t instanceof TimeoutExpired))throw t;killpg(p.pid,'SIGKILL');[a,b]=await communicate(p);}
    }
  }catch(e){
    await M.terminate_owned(p);[a,b]=await communicate(p,10);
    fs.writeFileSync(R(name+'.stdout.log'),a);fs.writeFileSync(R(name+'.stderr.log'),b);
    M.save(name+'-wait.json',{pid:p.pid,exit:returncode(p),actualWait:true,stdoutEOF:true,stderrEOF:true,interrupted:true});
    throw e;
  }
  fs.writeFileSync(R(name+'.stdout.log'),a);fs.writeFileSync(R(name+'.stderr.log'),b);
  M.save(name+'-wait.json',{pid:p.pid,exit:returncode(p),actualWait:true,stdoutEOF:true,stderrEOF:true,expected,timedOut});
  M.compact_closed_observations();
  check(!timedOut&&returncode(p)===expected,name+' failed; original not authorized by qualification');
}
async function watchdog(deadline){
  M.save('watchdog-armed.json',{pid:process.pid,at:now(),deadline,independent:true,prearmed:true});
  while(now()<deadline){
    if(fs.existsSync(R('pipeline-closed.json'))){
      M.save('watchdog-exit.json',{at:now(),reason:'actual native wait'});return;
    }
    await sleep(50);
  }
  const info=JSON.parse(fs.readFileSync(R('current-native-pid.json'),'utf8'));
  const sent=[];
  for(const sig of ['SIGTERM','SIGKILL']){
    try{
      if(np.token(info.pid)===info.startToken){np.killpg(info.pid,sig);sent.push(os.constants.signals[sig]);}
    }catch(e){if(!['ENOENT','ESRCH'].includes(e.code))throw e;}
    if(sig==='SIGTERM')await sleep(3000);
  }
  M.save('watchdog-exit.json',{at:now(),reason:'independent fixed deadline',signals:sent});
}
// json.dumps(value, sort_keys=True): Python's default separators and ASCII escapes.
function pyjson(v){
  if(v===null||v===undefined)return 'null';
  if(v===true)return 'true';if(v===false)return 'false';
  if(typeof v==='number')return Number.isInteger(v)?String(v):JSON.stringify(v);
  if(typeof v==='string')return JSON.stringify(v).replace(/[\u007f-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
  if(Array.isArray(v))return '['+v.map(pyjson).join(', ')+']';
  return '{'+Object.keys(v).sort().map(k=>pyjson(k)+': '+pyjson(v[k])).join(', ')+'}';
}
async function reservePort(){
  const s=net.createServer();
  await new Promise((resolve,reject)=>{s.once('error',reject);s.listen(0,'127.0.0.1',resolve);});
  const port=s.address().port;await new Promise(r=>s.close(r));return port;
}
function readFd(fd){
  const size=fs.fstatSync(fd).size,b=Buffer.alloc(size);let at=0;
  while(at<size){const n=fs.readSync(fd,b,at,size-at,at);if(!n)break;at+=n;}
  return b.subarray(0,at);
}
function walk(dir,out=[]){
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p,out);else if(e.isFile())out.push(p);}
  return out;
}
async function run(){
  fs.mkdirSync(String(M.RUN),{recursive:true});
  const passive=flag('--passive-original');
  const installed=flag('--installed-original');
  const original=flag('--original')||installed||passive;
  const head=ref=>git(['rev-parse',ref]).toString().trim();
  if(installed){
    const prepared={};for(const ref of ['HEAD','origin/main'])prepared[ref]=head(ref);
    check(Object.values(prepared).every(v=>v===M.HEAD),'prepare from CURRENT published main');
    M.save('preparation-published-main.json',{gitSHA:M.HEAD,refs:prepared,at:now(),
      policy:'owner199: retain exact published preparation through unrelated later publication'});
  }
  check(!(original&&flag('--baseline-paint')));
  if(original){
    check(!process.env.VB5_DIALOG_MODES&&!process.env.DELPHI5_NATIVE_MODES,'original requires full default qualification');
    const body=fs.readFileSync(path.join(M.MEDIA,'vb5ccein.exe'));
    check(body.length===7479944&&sha(body)==='022af94b651cd9d31e0676a6819dd5085940893f1ecc4abaa85b48c30de6f318');
    check(sha(fs.readFileSync(path.join(M.MEDIA,'setupapi.dll')))==='51f2682279e28386aa9c0eb8ba4f8ac3000c9ff75cf7e2456e8cdd9f0c544159');
  }
  check(np.freeBytes()>1500000000);
  check(cp.spawnSync('git',['merge-base','--is-ancestor','c8f308b84',M.HEAD],{cwd:M.ROOT}).status===0);
  const files=M.sources();
  // Reuse the published indexed fail-closed loader; it validates each exact
  // source body on demand and preserves sealed child inheritance. The Python
  // original executed the HEAD blob; the JS helper is required from the working
  // tree only when its bytes equal that published blob.
  const helperName='tools/disciples2-current-supervisor.cjs';
  check(files[helperName]&&files[helperName].equals(fs.readFileSync(path.join(M.ROOT,helperName))),'publish helper before sealing: '+helperName);
  const helper=disciples2();
  for(const p of walk(path.join(M.ROOT,'node_modules/pngjs')))
    if(['.js','.json'].includes(path.extname(p)))files[rel(M.ROOT,p)]=fs.readFileSync(p);
  const indexed=await helper.indexedSources(files);
  const [pool,index,rows]=Array.isArray(indexed)?indexed:[indexed.pool,indexed.index,indexed.rows];
  const source=M.seal('vb5-source',pool);
  const preload=M.seal('vb5-preload',files['tools/disciples2-current-native-source-view.cjs']);
  const patches=[];
  for(const name of flag('--working-qualification')?M.OWN_SOURCES:[]){
    const tracked=cp.spawnSync('git',['cat-file','-e',M.HEAD+':'+name],{cwd:M.ROOT,stdio:'ignore'}).status===0;
    const diff=cp.spawnSync('git',tracked?['diff','--binary',M.HEAD,'--',name]:['diff','--no-index','--binary','--','/dev/null',name],{cwd:M.ROOT,maxBuffer:1<<30});
    check([0,1].includes(diff.status));patches.push(diff.stdout);
  }
  fs.writeFileSync(R('owned-helpers.patch'),Buffer.concat(patches));
  if(!flag('--working-qualification')){
    // Retain relevant excluded WIP as a diff, never apply it to the source
    // pool. Recovery of a published run uses Git alone (empty owned patch).
    fs.writeFileSync(R('excluded-worktree.patch'),git(['diff','--binary',M.HEAD,'--','src','lib','tools','host.js','test/run.js']));
  }
  fs.mkdirSync(R('desktop-observations'),{recursive:true});
  const env={...process.env};check(!env.NODE_OPTIONS);
  // The Python original compiled into an unsealed memfd and sealed it after the
  // child wrote it. The helper only creates sealed descriptors, so the compile
  // writes a private exclusive file that is read, removed and then sealed.
  const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'delphi5-module-'));
  const compiled=path.join(scratch,'module.wasm');fs.closeSync(fs.openSync(compiled,'wx',0o600));
  Object.assign(env,{NODE_OPTIONS:'--preserve-symlinks --require='+fd_path(preload),
    DISCIPLES2_ROOT:M.ROOT,DISCIPLES2_SOURCE_FD:fd_path(source),
    DISCIPLES2_SOURCE_SHA256:sha(pool),DISCIPLES2_SOURCE_INDEX_SHA256:sha(index),DISCIPLES2_PHASE:'compile',
    DELPHI5_SOURCE_FD:fd_path(source),DELPHI5_MODULE_FD:compiled,
    DELPHI5_MODULE_SHA256:sha(Buffer.alloc(0)),WINE_COM_PROTOCOL_DIR:R('children'),
    WINE_PROCESS_DESKTOP_OBSERVE:R('desktop-observations')});
  // Compile exact Git bytes directly into our descriptor, never shared outputs.
  const compile_code=`const fs=require('node:fs');
const {watxSourceClosure,compileClosure}=require('./tools/watx-closure');
const {layoutHash,appendSection}=require('./tools/region-layout-hash');
const r=compileClosure(watxSourceClosure(),{tailCalls:true});
if(!r.success)throw Error(JSON.stringify(r));
fs.writeFileSync(process.env.DELPHI5_MODULE_FD,appendSection(Buffer.from(r.wasmBinary),layoutHash(r.regions.regions)));
`;
  let body;
  try{
    await M.checked('exact-git-compile',['node','-e',compile_code],env,[source]);
    body=fs.readFileSync(compiled);
  }finally{fs.rmSync(scratch,{recursive:true,force:true});}
  check(body.subarray(0,4).equals(Buffer.from([0,0x61,0x73,0x6d])));
  const module=M.seal('delphi5-module',body);
  env.DELPHI5_MODULE_FD=fd_path(module);
  fs.writeFileSync(R('module.wasm'),body);
  check(sha(fs.readFileSync(R('module.wasm')))===sha(body));
  env.DELPHI5_MODULE_SHA256=sha(body);
  const hashes=()=>Object.fromEntries(Object.entries(files).map(([n,b])=>[n,sha(b)]));
  M.save('compile-inputs.json',{gitSHA:M.HEAD,sources:hashes(),moduleSHA256:sha(body),
    workingQualification:flag('--working-qualification')});
  const manifest={gitSHA:M.HEAD,sourceSHA256:sha(pool),sourceIndexSHA256:sha(index),moduleSHA256:sha(body),
    preloadSHA256:sha(files['tools/disciples2-current-native-source-view.cjs']),sources:rows,foreignWIPAdopted:false};
  const encoded=Buffer.from(pyjson(manifest));M.seal('vb5-manifest',encoded);
  Object.assign(env,{DISCIPLES2_PHASE:'runtime',DISCIPLES2_MODULE_FD:fd_path(module),
    DISCIPLES2_MODULE_SHA256:sha(body),DISCIPLES2_MANIFEST_SHA256:sha(encoded),
    DISCIPLES2_ENTRY_SHA256:sha(files['test/run.js']),DISCIPLES2_PRELOAD:fd_path(preload)});
  M.save('immutable-manifest.json',manifest);
  env.DELPHI5_SOURCE_FD=fd_path(source);
  M.save('runtime-inputs.json',{gitSHA:M.HEAD,moduleSHA256:sha(body),moduleBytes:body.length,moduleSeals:15,sourceSeals:15,
    sources:hashes(),foreignWIPAdopted:false,
    recovery:'Git plus owned-helpers.patch; exact compileClosure tailCalls and layout stamp',ownModuleDescriptor:module});
  await helper.inheritanceProbe(String(M.RUN),{childInheritance:'sealed-node-v1',args:['node'],cwd:M.ROOT},env);
  const fds=[source,module],node=(...a)=>['node',...a];
  const shutdownTest=['runtime-shutdown',[process.execPath,'test/test-vb5-runtime-shutdown.cjs',R('shutdown-qualification')]];
  const nestedOwned=['native-nested-owned',node('test/test-vb5-nested-owned-modal.cjs',R('nested-qualification'))];
  const firstDialog=['first-dialog',node('test/test-vb5cce-original-current.cjs','--first-dialog',R('first-dialog'))];
  const dialogbox=['native-dialogbox',node('test/test-vb5-native-dialog-identity.cjs',R('dialogbox-qualification'))];
  const ck=([name,args],...rest)=>M.checked(name,args,env,fds,...rest);
  if(flag('--comctl-only')){
    await M.checked('image-list-apis',node('test/test-image-list-icons.js'),env,fds);
    return;
  }
  if(installed||flag('--closure-only')||flag('--complete-qualification')){
    await M.checked('authentic-dll-closure',node('test/test-installed-dll-closure.cjs',R('authentic-dll-closure')),env,fds);
    if(flag('--closure-only'))return;
  }
  if(flag('--installed-qualification')||flag('--modal-fence-only')||flag('--complete-qualification')||installed){
    await M.checked('modal-invocation-fence',node('test/test-vb5-modal-invocation-fence.cjs',R('modal-invocation-fence')),env,fds);
    if(flag('--modal-fence-only'))return;
    await M.checked('common-control-state',node('test/test-vb5-installed-native.cjs',R('common-control-state'),'--state'),env,fds);
    await M.checked('nested-common',node('test/test-vb5-installed-native.cjs',R('nested-common'),'--nested'),env,fds);
    await M.checked('installed-scope',node('test/test-vb5-installed-native.cjs',R('installed-scope'),'--run'),env,fds);
    const readJSON=p=>JSON.parse(fs.readFileSync(R(p),'utf8'));
    const proof=readJSON('installed-scope/qualification.json');
    const state=readJSON('common-control-state/state-proof.json');
    const nested=readJSON('nested-common/nested-proof.json');
    const fence=readJSON('modal-invocation-fence/modal-fence-proof.json');
    check(proof.passed&&proof.boundary===null&&proof.nativeQuit);
    check(state.nestingBoundary===null&&nested.passed&&fence.passed);
    M.save('installed-protocol-qualification.json',{passed:true,nativeProtocolQualified:true,
      fullQualificationPending:true,personalOriginalReviewRequired:true,originalStarted:false});
    if(!installed&&!flag('--complete-qualification'))return;
  }
  if(flag('--normal-exit-only')){
    await M.checked('normal-exit',[process.execPath,'test/test-vb5-normal-exit-completion.cjs',R('normal-exit')],env,fds);
    await ck(shutdownTest);
    await ck(nestedOwned);
    await ck(dialogbox);
    await M.checked('native-controller',node('test/test-vb5cce-original-current.cjs',R('native-qualification')),env,fds);
    return;
  }
  if(flag('--repair-only')){
    await ck(nestedOwned);
    await ck(shutdownTest);
    await M.checked('native-context-guards',node('test/test-cli-native-scene-context.cjs','--unit'),env,fds);
    await M.checked('vb-context-guards',node('test/test-vb5cce-original-current.cjs','--unit'),env,fds);
    await M.checked('native-button-guards',node('test/test-vb5-native-dialog-identity.cjs','--unit'),env,fds);
    await ck(firstDialog);
    await ck(dialogbox);
    return;
  }
  if(flag('--nested-only')||flag('--nested-worker-only')){
    await M.checked('native-nested-owned',node('test/test-vb5-nested-owned-modal.cjs',R('nested-qualification'),
      ...(flag('--nested-worker-only')?['--worker']:[])),env,fds);
    return;
  }
  if(flag('--shutdown-only')){
    await ck(shutdownTest);
    return;
  }
  if(original||flag('--setupapi-only')){
    const cfgfd=M.genuine_setupapi_support();
    env.VB5_CFGMGR32=fd_path(cfgfd);
    await M.checked('genuine-setupapi',node('test/test-vb5-genuine-setupapi.cjs',R('setupapi-native'),'--run'),env,[source,module,cfgfd]);
    if(flag('--setupapi-only'))return;
  }
  if(flag('--progress-state-only')){
    await M.checked('native-progress-state',node('test/test-vb5-native-progress.cjs','--state',R('state-qualification')),env,fds);
    return;
  }
  if(flag('--progress-observe-only')){
    await M.checked('native-progress-observe',node('test/test-vb5-native-progress.cjs','--observe',R('observe-qualification')),env,fds);
    return;
  }
  if(flag('--progress-only')){
    await M.progress_qualify(env,source,module);
    return;
  }
  if(flag('--regressions-only')){
    await ck(firstDialog);
    await M.qualify(env,files,source,module,false);
    return;
  }
  if(flag('--dialogbox-only')){
    await ck(dialogbox);
    return;
  }
  if(flag('--first-dialog-only')||original){
    await ck(firstDialog);
    if(flag('--first-dialog-only'))return;
  }
  if(flag('--baseline-paint')){
    env.DELPHI5_NATIVE_MODES='paint-queued-fault';
    await M.checked('native-paint-baseline',node('test/test-delphi5-after-desktop.cjs',R('native-qualification')),env,fds,1);
    M.save('baseline.json',{expectedFailure:true,unmodifiedGitHost:true,originalStarted:false});
    return;
  }
  // Real Worker regression before/after: only the before child reads the old receive.
  if(!passive){
    if(original){
      await ck(nestedOwned);
      await ck(shutdownTest);
    }
    await M.qualify(env,files,source,module);
  }
  if(installed||flag('--complete-qualification')){
    M.save('complete-native-qualification.json',{passed:true,gitSHA:M.HEAD,moduleSHA256:sha(body),
      fullSourceSHA256:sha(pool),nativeProtocolAndFullRegression:true,originalStarted:false,
      personalFreshFrameRequired:true,immutableIntentLimitsMs:{confirmation:500,physicalUp:1750,completion:3000}});
  }
  if(!original)return;
  let installed_inputs=null;
  if(installed)installed_inputs=M.prepare_installed();
  while(!fs.existsSync(R('original-go.json')))await interruptible(sleep(100));
  if(installed){
    const later={};for(const ref of ['HEAD','origin/main'])later[ref]=head(ref);
    for(const value of Object.values(later))
      check(cp.spawnSync('git',['merge-base','--is-ancestor',M.HEAD,value],{cwd:M.ROOT}).status===0,'published preparation left main graph');
    for(const [fd,expected] of [[source,sha(pool)],[module,sha(body)]]){
      // F_GET_SEALS has no Node API; the disciples2 helper answers when it can.
      if(typeof helper.get_seals==='function')check(helper.get_seals(fd)===15);
      check(sha(readFd(fd))===expected,'sealed runtime changed');
    }
    for(const name of ['tools/vb5cce-original-runtime.js','tools/vb5cce-reviewed-control.js','test/test-vb5cce-original-current.cjs'])
      check(files[name]&&fs.readFileSync(path.join(M.ROOT,name)).equals(files[name]),'prepared helper changed: '+name);
    M.save('prepared-execution-boundary.json',{gitSHA:M.HEAD,laterRefs:later,
      sourceSHA256:sha(pool),moduleSHA256:sha(body),sameSealedRuntime:true,
      sourceRefresh:false,helperPins:true,mainGraph:true,at:now()});
  }
  const started=now(),native_seconds=passive?120:installed?1800:2400,watchdog_seconds=passive?140:installed?1820:2420;
  const reserve_seconds=passive?0:installed?180:240;
  const deadline=started+native_seconds;
  M.save('pipeline-launch.json',{at:started,deadline,watchdogDeadline:started+watchdog_seconds,
    reserveSeconds:reserve_seconds,gameplayCutoff:deadline-reserve_seconds,
    winver:'nt4',secondPipeline:false,passiveDiagnostic:passive,inputsAuthorized:!passive});
  const w=popen([process.execPath,__filename,'watchdog',String(started+watchdog_seconds)],{stdin:'ignore',start_new_session:true});
  collect(w);
  try{
    while(!fs.existsSync(R('watchdog-armed.json'))){check(!exited(w));await sleep(10);}
    await M.original_pipeline(env,source,module,started,deadline,passive,installed?installed_inputs:null);
  }finally{
    M.save('pipeline-closed.json',{at:now(),originalStarted:M.ORIGINAL_STARTED});
    await M.join_watchdog(w);
  }
}
async function qualify(env,files,source,module,include_progress=true){
  const fds=[source,module],node=(...a)=>['node',...a],R2=p=>R(p);
  await M.checked('normal-exit',[process.execPath,'test/test-vb5-normal-exit-completion.cjs',R2('normal-exit')],env,fds);
  // The legacy source-view test intentionally replaces NODE_OPTIONS with its
  // own unsealed loader. The indexed inheritance probe above qualifies this
  // runtime's loader; retain both actual desktop transport tests here.
  await M.checked('transport-after',node('--test','--test-name-pattern=desktop','test/test-delphi5-original-install.cjs'),env,fds);
  await M.checked('native-context-guards',node('test/test-cli-native-scene-context.cjs','--unit'),env,fds);
  await M.checked('vb-context-guards',node('test/test-vb5cce-original-current.cjs','--unit'),env,fds);
  await M.checked('native-button-guards',node('test/test-vb5-native-dialog-identity.cjs','--unit'),env,fds);
  if(include_progress)await M.progress_qualify(env,source,module);
  await M.checked('native-pointer-mapping',node('test/test-cli-native-pointer-coordinates.cjs','--native',R2('mapping-qualification')),env,fds);
  await M.checked('native-dialogbox',node('test/test-vb5-native-dialog-identity.cjs',R2('dialogbox-qualification')),env,fds);
  await M.checked('native-controller',node('test/test-vb5cce-original-current.cjs',R2('native-qualification')),env,fds);
  const admission=JSON.parse(fs.readFileSync(R('native-qualification/vb-original-admission.json'),'utf8'));
  M.save('qualification.json',{passed:admission.safeForVBOriginal,generatedTestsPassed:true,
    admission,at:now(),originalStarted:false});
  check(admission.safeForVBOriginal,admission.blocker);
}
async function progress_qualify(env,source,module){
  const fds=[source,module],node=(...a)=>['node',...a];
  await M.checked('native-progress-guards',node('test/test-vb5-native-progress.cjs','--review-unit'),env,fds);
  await M.checked('native-progress-state',node('test/test-vb5-native-progress.cjs','--state',R('state-qualification')),env,fds);
  await M.checked('native-progress-dialogs',node('test/test-vb5-native-progress.cjs','--native',R('progress-qualification')),env,fds);
  await M.checked('native-progress-refusals',node('test/test-vb5-native-progress.cjs','--refusals',R('progress-refusals')),env,fds);
}
function prepare_installed(){
  // Previously authenticated installer output. Pin the complete verification
  // manifest, then rehash every original blob/registry/provenance byte before
  // creating this invocation's writable overlay. The old endpoint is closed.
  const manifest_path=path.join(M.ROOT,'scratch/runs/20261117-vb5-native-common-dialog-focus-state-repair/authentic-recovery-manifest.json');
  const body=fs.readFileSync(manifest_path);
  check(sha(body)==='7b162aeb1206c40382f915c57ede6b74461a1a3414acd09184f5518854eb20bb');
  const m=JSON.parse(body);check(m.passed&&m.records===258&&m.files===86&&m.registryEntries===836);
  for(const item of [...Object.values(m.provenance),...m.blobs]){
    const actual=fs.readFileSync(path.join(M.ROOT,item.path));
    check(actual.length===item.bytes&&sha(actual)===item.sha256,item.path);
  }
  const index_item=m.provenance['original-published/guest-overlay/index.json'];
  const registry_item=m.provenance['original-published/guest-registry.json'];
  const index=JSON.parse(fs.readFileSync(path.join(M.ROOT,index_item.path)));
  check(index.records.length===258);
  check(JSON.parse(fs.readFileSync(path.join(M.ROOT,registry_item.path))).length===836);
  const overlay=R('guest-overlay');fs.mkdirSync(path.join(overlay,'blobs'),{recursive:true});
  fs.writeFileSync(path.join(overlay,'index.json'),fs.readFileSync(path.join(M.ROOT,index_item.path)));
  // Opaque store blobs are immutable and replaced with fresh UUIDs. Symlinks
  // reference existing verified media; cleanup unlinks only our references.
  for(const item of m.blobs){
    const target=path.join(M.ROOT,item.path);fs.symlinkSync(target,path.join(overlay,'blobs',path.basename(target)));
  }
  fs.writeFileSync(R('guest-registry.json'),fs.readFileSync(path.join(M.ROOT,registry_item.path)));
  const guest='c:\\program files\\vb5cce\\vb5cce.exe';
  const sample='c:\\program files\\vb5cce\\samples\\axbutton\\axbutton.vbp';
  const exe=m.blobs.find(item=>item.guest.toLowerCase()===guest);check(exe);
  const sample_item=m.blobs.find(item=>item.guest.toLowerCase()===sample);check(sample_item);
  M.save('authentic-installed-recovery.json',{passed:true,manifest:rel(M.ROOT,manifest_path),
    manifestSHA256:sha(body),records:258,blobCount:86,registryEntries:836,exe,sample:sample_item,
    provenance:m.provenance,blobs:m.blobs,originalInvocationsBeforeThisTask:0,
    oldUnknown:'closed; no endpoint request/rebind/replay',mediaCopied:false,registryEdited:false});
  return [path.join(M.ROOT,exe.path),guest,sample];
}
async function original_pipeline(env,source,module,started,deadline,passive,installed_inputs=null){
  const reserve_seconds=passive?0:installed_inputs?180:240;
  for(let stage=0;stage<(passive||installed_inputs?1:3);stage++){
    if(stage){
      while(!fs.existsSync(R(`stage-${stage}-go.json`))){
        if(fs.existsSync(R('stop-pipeline.json'))||now()>=deadline-240)return;
        await interruptible(sleep(50));
      }
    }
    check(now()<deadline-reserve_seconds);
    let exe,guest,cwd,extra;
    if(installed_inputs){
      let sample;[exe,guest,sample]=installed_inputs;cwd='C:\\Program Files\\VB5CCE\\';
      extra=['--reg-import='+R('guest-registry.json'),'--args="'+sample+'"'];
    }else if(stage===0){
      exe=path.join(M.MEDIA,'vb5ccein.exe');guest='C:\\vb5ccein.exe';cwd='C:\\';extra=['--vfs-include=setupapi.dll'];
    }else{
      const request=JSON.parse(fs.readFileSync(R(`stage-${stage}-go.json`),'utf8'));
      guest=request.guest;check(guest.toLowerCase().startsWith('c:\\'));
      exe=path.join(R('guest-overlay'),guest.slice(3).replaceAll('\\','/'));
      check(fs.existsSync(exe)&&fs.statSync(exe).isFile());
      cwd=request.cwd;extra=['--reg-import='+R('guest-registry.json')];
      if(request.args)extra.push('--args='+request.args);
    }
    const port=await reservePort(),childport=await reservePort();
    check(port!==childport);
    const target=R(`stage-${stage}`);fs.mkdirSync(target);
    fs.writeFileSync(path.join(target,'runtime-inputs.json'),fs.readFileSync(R('runtime-inputs.json')));
    const invocation=crypto.randomUUID();
    const args=['node','test/run.js','--exe='+exe,'--exe-guest-path='+guest,'--cwd='+cwd,
      '--native-exit-receipt='+path.join(target,'native-exit.json'),'--native-invocation-token='+invocation,
      '--winver=nt4','--no-build','--wasm='+fd_path(module),
      '--overlay-dir='+R('guest-overlay'),'--overlay-flush-ms=0',
      '--reg-export='+R('guest-registry.json'),'--spawn-processes','--threads',
      '--control='+port,'--max-seconds='+Math.max(1,Math.trunc(deadline-now())),
      '--max-batches=1000000000','--stuck-after=0','--real-ticks',
      '--quiet-api','--quiet-blocks','--png-canvas',
      '--trace-api=LoadLibraryA,LoadLibraryExA,GetProcAddress,GetModuleHandleA,GetModuleFileNameA,GetFileVersionInfoSizeA,GetFileVersionInfoA,VerQueryValueA,MessageBoxA','--trace-to=20000',
      '--pipe-child-args=--control='+childport+' --winver=nt4 --threads --real-ticks --png-canvas',...M.SUPPORT_MOUNTS,...extra];
    M.publish(path.join(target,'launch.json'),{args,at:started,deadline,
      gameplayCutoff:deadline-reserve_seconds,reserveSeconds:reserve_seconds,
      rootPort:port,childPort:childport,winver:'nt4',passiveDiagnostic:passive});
    const out=fs.openSync(path.join(target,'native.stdout.log'),'wx');let err=null,rc;
    try{
      err=fs.openSync(path.join(target,'native.stderr.log'),'wx');
      const p=M.start_native(args,out,err,{cwd:M.ROOT,env,pass_fds:[source,module],start_new_session:true});
      const info=M.native_identity(p);
      info.invocationToken=invocation;
      try{
        M.ORIGINAL_STARTED=true;
        M.publish(path.join(target,'native-pid.json'),info);
        // Stage replacement is one complete atomic watchdog identity.
        const pending=R('current-native-pid.pending');
        fs.writeFileSync(pending,JSON.stringify(info));fs.renameSync(pending,R('current-native-pid.json'));
        if(passive){
          while(!exited(p)){
            if(fs.existsSync(path.join(target,'PERMANENT-UNKNOWN.json'))||fs.existsSync(path.join(target,'diagnostic.json'))){
              killpg(p.pid,'SIGTERM');break;
            }
            await interruptible(sleep(10));
          }
        }
        rc=await M.wait_native(p,target,info);
      }finally{
        // Exceptions before entering wait must also reap the child.
        if(!fs.existsSync(path.join(target,'native-wait.json'))){
          await M.terminate_owned(p);
          M.publish(path.join(target,'native-wait.json'),{...info,exit:returncode(p),actualWait:true,
            disposition:'cleanup',...await M.join_native_output(p),
            atWait:now(),atWaitMono:monotonic()});
        }
      }
    }finally{
      fs.closeSync(out);if(err!==null)fs.closeSync(err);
    }
    if(fs.existsSync(path.join(target,'PERMANENT-UNKNOWN.json'))||rc!==0)return;
  }
}

Object.assign(M,{TimeoutExpired,ShutdownRequested,shutdown_signal,install_shutdown_handlers,interruptible,
  returncode,wait,communicate,popen,terminate_owned,start_native,join_native_output,wait_native,join_watchdog,
  sha,publish,save,seal,close_owned,compact_closed_observations,genuine_setupapi_support,fd_path,token,
  native_identity,sources,checked,watchdog,run,qualify,progress_qualify,prepare_installed,original_pipeline,pyjson});

async function main(){
  const args=process.argv.slice(2);
  if(args.length>0&&args[0]==='watchdog'){await M.watchdog(Number(args[1]));return;}
  M.install_shutdown_handlers();
  let success=false,failure=null;
  try{
    await M.run();
    if(M.SHUTDOWN_SIGNAL!==null)throw new ShutdownRequested(128+M.SHUTDOWN_SIGNAL);
    success=true;
  }catch(e){failure=e;}
  finally{
    for(const fd of [...M.OWN_FDS])M.close_owned(fd);
    if(fs.existsSync(String(M.RUN)))M.save('runtime-release.json',{at:now(),supervisor:process.pid,success,
      ownDescriptorsClosed:true,originalStarted:M.ORIGINAL_STARTED,box:null});
  }
  if(failure)throw failure;
}
// Python exit status: SystemExit(code) -> code; any other exception -> 1 + traceback.
M.exit_with=e=>{
  if(e instanceof ShutdownRequested){process.exitCode=e.code;return;}
  process.stderr.write((e&&e.stack||String(e))+'\n');process.exitCode=1;
};
if(require.main===module)main().catch(M.exit_with);
