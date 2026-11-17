#!/usr/bin/env node
'use strict';
// Real OS child/watchdog/descendant/outer waits; no original game launch.
// Node port of the former test/test-boids-supervisor-shutdown.py:
//   node test/test-boids-supervisor-shutdown.cjs RUN_DIR
// (--native/--child/--descendant/... are the fixture's own child modes.)
//
// Port notes: Python wrapped subprocess.Popen; the supervisor's spawn goes
// through the exported popen(), which is wrapped here instead. On macOS the
// supervisor scope is the native's process group (another process's
// environment is not readable there), so the token-scoped `pinned` control is
// a group leader adopted for the token, and the foreign pipe holder is started
// in its own session: it still holds the native's pipes without the token,
// and cleanup must still wait for its EOF rather than signal it.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),os=require('node:os');
const assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..');
const np=require(path.join(ROOT,'tools/native-proc.cjs'));
// The GL lifecycle test reruns these fixtures through its own supervisor.
const H={module:()=>require(path.join(ROOT,'tools/boids-current-supervise.js')),Supervisor:null,file:__filename};
function configure(o){Object.assign(H,o);}
const exists=p=>fs.existsSync(p);
const readJSON=p=>JSON.parse(fs.readFileSync(p,'utf8'));
function writeAll(fd,b){
  for(let off=0;off<b.length;){
    try{off+=fs.writeSync(fd,b,off);}
    catch(e){if(e.code!=='EAGAIN')throw e;np.sleepSync(1);}
  }
}

async function native(mode,out){
  const m=H.module();
  if(mode==='exit143')process.exit(143);
  if(mode==='native-signal')process.kill(process.pid,'SIGTERM');
  if(mode==='noisy'){
    const o=Buffer.alloc(65536,'O'),e=Buffer.alloc(65536,'E');
    for(let i=0;i<32;i++){writeAll(1,o);writeAll(2,e);}
  }
  if(mode==='prep-timeout')await np.sleep(30000);
  if(['descendant','repeat','watchdog','cleanup-deadline'].includes(mode)){
    const p=cp.spawn(process.execPath,[H.file,'--descendant',out],{stdio:'inherit'});
    m.write(path.join(out,'descendant.json'),{pid:p.pid});
  }
  if(mode==='foreign-pipe'){
    // It deliberately has no ownership token. Cleanup must wait for EOF,
    // rather than signal this process based on its group or pipe handles.
    const p=cp.spawn(process.execPath,[H.file,'--foreign'],{stdio:'inherit',env:{},detached:!np.linux});
    m.write(path.join(out,'foreign-holder.json'),{pid:p.pid});
  }
  if(['watchdog','cleanup-deadline','repeat'].includes(mode))process.on('SIGTERM',()=>{});
  if(mode==='late'){
    const late=()=>{
      process.on('SIGTERM',()=>{});process.removeListener('SIGTERM',late);
      np.sleepSync(200);process.exit(23);
    };
    process.on('SIGTERM',late);
  }
  m.write(path.join(out,'prepared.json'),{pid:process.pid});
  while(!exists(path.join(out,'runtime-start.json')))await np.sleep(10);
  if(['normal','noisy','descendant','foreign-pipe','missing-eof'].includes(mode))process.exit(0);
  await np.sleep(30000);
  process.exit(0);
}

async function child(mode,out){
  const m=H.module();
  const S=H.Supervisor||m.Supervisor;
  const s=new S(out,[process.execPath,H.file,'--native',mode,out],{
    preparation:2,runtime:['timeout','late','cleanup-deadline'].includes(mode)?.25:4,
    preparation_watchdog:4,runtime_watchdog:['watchdog','cleanup-deadline','missing-eof'].includes(mode)?.55:6,
    grace:mode==='cleanup-deadline'?1:.35});
  if(mode==='prearm-failure'||mode==='runtime-prearm-failure'){
    const spawn=s.spawn.bind(s);
    s.spawn=(command,prefix,env)=>{
      if(prefix.startsWith(mode==='prearm-failure'?'preparation':'runtime'))command=[process.execPath,H.file,'--exit','19'];
      return spawn(command,prefix,env);
    };
  }
  if(mode==='exception'){
    const arm=s.arm.bind(s);
    s.arm=()=>{
      if(s.phase==='runtime')throw Object.assign(new Error('injected after native acquired'),{name:'RuntimeError'});
      return arm();
    };
  }
  if(mode==='pending-startup'||mode==='watchdog-startup'){
    const popen=m.popen;
    m.popen=(command,env)=>{
      const p=popen(command,env);
      if(mode==='pending-startup'?command.includes('--native'):command.includes('watchdog')){
        process.kill(process.pid,'SIGTERM');
        np.sleepSync(50);
      }
      return p;
    };
  }
  if(mode==='native-spawn-failure')s.command=['/nonexistent/boids-fixture-executable'];
  if(mode==='capture-open-failure'){
    const spawn=s.spawn.bind(s);
    s.spawn=(command,prefix,env)=>{
      if(prefix==='')fs.mkdirSync(path.join(out,'stdout.log'));
      return spawn(command,prefix,env);
    };
  }
  if(mode==='missing-eof'){
    const pump=m.Capture.prototype.pump;
    m.Capture.prototype.pump=function(){
      pump.call(this);
      if(this.process===s.native){this.eof.stderr=false;delete this.eof_at.stderr;}
    };
  }
  process.exit(await s.run());
}

async function wait_file(p,proc,seconds=6){
  const end=np.monotonic()+seconds;
  while(!exists(p)){
    assert(proc.exitCode===null&&proc.signalCode===null&&np.monotonic()<end,JSON.stringify([p,proc.exitCode]));
    await np.sleep(10);
  }
}
function collect(p){
  const a=[],b=[];p.stdout.on('data',d=>a.push(d));p.stderr.on('data',d=>b.push(d));
  const closed=new Promise(r=>p.on('close',()=>r()));
  return async seconds=>{
    let timer;
    const ok=await Promise.race([closed.then(()=>true),new Promise(r=>{timer=setTimeout(()=>r(false),seconds*1000);})]);
    clearTimeout(timer);
    if(!ok){p.kill('SIGKILL');throw new Error('communicate timeout');}
    return [Buffer.concat(a),Buffer.concat(b)];
  };
}
const returncode=p=>p.exitCode!==null?p.exitCode:p.signalCode?-os.constants.signals[p.signalCode]:null;

async function main(run){
  fs.mkdirSync(path.dirname(run),{recursive:true});fs.mkdirSync(run);
  const m=H.module();
  // A sibling shares our group and an almost matching env token: never signal it.
  const token=crypto.randomBytes(32).toString('hex');
  const sibling=cp.spawn(process.execPath,[H.file,'--sleep'],{stdio:'ignore',env:{...process.env,BOIDS_CURRENT_TOKEN:token+'suffix'}});
  const pinned=cp.spawn(process.execPath,[H.file,'--sleep'],{stdio:'ignore',env:{...process.env,BOIDS_CURRENT_TOKEN:token},detached:!np.linux});
  if(!np.linux)m.adopt(token,pinned.pid,np.token(pinned.pid));
  const exited=p=>new Promise(r=>{if(returncode(p)!==null)r();else p.once('exit',()=>r());});
  const results=[];
  try{
    const K=os.constants.signals;
    assert(!m.signal_owned(process.pid,token,K.SIGKILL));
    assert(!m.signal_owned(sibling.pid,token,K.SIGKILL));
    assert(!m.signal_owned(pinned.pid,token,K.SIGKILL,'stale-start-token'));
    assert.deepEqual(m.scoped(token).map(r=>r.pid),[pinned.pid]);
    const real_identity=m.identity,calls=[];
    m.identity=pid=>{const [start,state]=real_identity(pid);calls.push(pid);return [calls.length===1?start:start+'changed',state];};
    assert(!m.signal_owned(pinned.pid,token,K.SIGKILL));
    m.identity=real_identity;
    assert(returncode(sibling)===null&&returncode(pinned)===null);
    assert(m.signal_owned(pinned.pid,token,K.SIGTERM,m.identity(pinned.pid)[0]));
    await Promise.race([exited(pinned),np.sleep(3000)]);
    assert.equal(returncode(pinned),-15);
    assert(!m.signal_owned(pinned.pid,token,K.SIGKILL));
    const modes=['normal','noisy','exit143','native-signal','descendant','foreign-pipe','term','repeat',
      'pending-startup','watchdog-startup','exception','prep-timeout','timeout','late',
      'prearm-failure','runtime-prearm-failure','native-spawn-failure','capture-open-failure','watchdog','cleanup-deadline','missing-eof'];
    for(const mode of modes){
      const out=path.join(run,mode);
      const p=cp.spawn(process.execPath,[H.file,'--child',mode,out],{stdio:['ignore','pipe','pipe']});
      const communicate=collect(p);
      if(['term','repeat','watchdog'].includes(mode)){
        await wait_file(path.join(out,'runtime-start.json'),p);
        if(mode==='watchdog'){
          process.kill(p.pid,'SIGSTOP');
          await np.sleep(1200);
          process.kill(p.pid,'SIGCONT');
        }else{
          process.kill(p.pid,'SIGTERM');
          if(mode==='repeat')for(let i=0;i<8;i++){await np.sleep(20);process.kill(p.pid,'SIGTERM');}
        }
      }
      const [a,b]=await communicate(12);
      fs.writeFileSync(path.join(out,'outer.stdout.log'),a);
      fs.writeFileSync(path.join(out,'outer.stderr.log'),b);
      const receipt=readJSON(path.join(out,'wait.json'));
      const expected=['exit143','native-signal','term','repeat','pending-startup','watchdog-startup'].includes(mode)?143:
        ['exception','prearm-failure','runtime-prearm-failure','native-spawn-failure','capture-open-failure','missing-eof'].includes(mode)?1:
        ['prep-timeout','timeout','late','cleanup-deadline'].includes(mode)?124:
        mode==='watchdog'?137:0;
      assert(returncode(p)===expected&&expected===receipt.supervisorExitCode,JSON.stringify([mode,returncode(p),receipt,b.toString()]));
      assert(receipt.cleanupCount===1&&!receipt.remainingAfterRuntime.length);
      if(mode==='missing-eof'){
        assert(receipt.actualWait&&receipt.returncode===0);
        assert(receipt.stdoutEOF&&!receipt.stderrEOF&&receipt.error);
        assert(!exists(path.join(out,'runtime-watchdog-cancel')));
        assert(readJSON(path.join(out,'runtime-watchdog-result.json')).fired);
      }else if(!['prearm-failure','native-spawn-failure','watchdog-startup'].includes(mode)){
        assert(receipt.actualWait&&receipt.stdoutEOF&&receipt.stderrEOF,JSON.stringify([mode,receipt]));
      }else{
        assert(receipt.nativeWait===null&&receipt.stdoutEOF===null);
      }
      for(const w of receipt.watchdogs){
        assert(w.actualWait&&w.stdoutEOF&&w.stderrEOF);
        assert.equal(w.returncode,mode.endsWith('prearm-failure')&&w.phase===(mode==='prearm-failure'?'preparation':'runtime')?19:0);
        if(w.result&&!w.result.fired&&receipt.nativeWait&&w.phase===receipt.phase){
          assert(w.result.cancelledAt>=receipt.nativeWait.waitedAt);
          assert(Object.values(receipt.eofAt).every(at=>w.result.cancelledAt>=at));
        }
      }
      if(mode==='late')assert.equal(receipt.returncode,23);
      if(mode==='exit143')assert(receipt.returncode===143&&receipt.nativeWait.signal===null);
      if(mode==='native-signal')assert(receipt.returncode===-15&&receipt.nativeWait.signal===15);
      if(mode==='watchdog'||mode==='cleanup-deadline'){
        assert(readJSON(path.join(out,'runtime-watchdog-result.json')).fired);
        assert.equal(receipt.returncode,-9);
      }
      if(mode==='noisy'){
        assert(fs.statSync(path.join(out,'stdout.log')).size===2097152&&fs.statSync(path.join(out,'stderr.log')).size===2097152);
      }
      if(mode==='foreign-pipe'){
        const foreign=readJSON(path.join(out,'foreign-holder.json')).pid;
        assert(receipt.cleanupSignals.every(x=>x.pid!==foreign));
        assert(fs.readFileSync(path.join(out,'stdout.log')).includes('foreign holder completed'));
      }
      assert(returncode(sibling)===null);
      results.push({mode,outerExit:returncode(p),actualOuterWait:true,stdoutEOF:true,stderrEOF:true,receipt});
      console.log('PASS',mode);
    }
  }finally{
    for(const p of [sibling,pinned]){
      if(returncode(p)===null)p.kill('SIGTERM');
      await Promise.race([exited(p),np.sleep(3000)]);
    }
  }
  m.write(path.join(run,'results.json'),{passed:true,cases:results,identityControls:['self','sibling token mismatch','stale identity','exited pid','start-token exact identity'],siblingActualWait:returncode(sibling)});
}

module.exports={configure,native,child,main,wait_file};
if(require.main===module){
  const a=process.argv.slice(2);
  const fail=e=>{console.error(e&&e.stack||e);process.exit(1);};
  if(a[0]==='--native')native(a[1],a[2]).catch(fail);
  else if(a[0]==='--child')child(a[1],a[2]).catch(fail);
  else if(a[0]==='--descendant'){process.on('SIGTERM',()=>{});setTimeout(()=>{},30000);}
  else if(a[0]==='--foreign')setTimeout(()=>console.log('foreign holder completed'),800);
  else if(a[0]==='--sleep')setTimeout(()=>{},60000);
  else if(a[0]==='--exit')process.exit(Number(a[1]));
  else if(a[0])main(path.resolve(a[0])).catch(fail);
  else{console.error('usage: test-boids-supervisor-shutdown.cjs RUN_DIR');process.exit(2);}
}
