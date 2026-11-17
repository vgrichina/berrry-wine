'use strict';
// Real delayed startup, deadline, cancellation, drain and join regressions.
// Ported from test-halflife2-controller-supervision.py.
// Not portable from Python: prctl(PR_SET_CHILD_SUBREAPER) and waitpid() of the
// adopted owner after its parent dies have no Node API. The parent-death case
// therefore waits (by start token) for the orphaned owner to exit and no
// longer asserts its exit status (Python: 143); parentDeathObserved remains.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process'),os=require('node:os');
const ROOT=path.resolve(__dirname,'..');
const np=require(path.join(ROOT,'tools/native-proc.cjs'));
function load(name){const p=path.join(ROOT,'tools',name);delete require.cache[require.resolve(p)];const m=require(p);delete require.cache[require.resolve(p)];return m;}

async function helper(run,kase){
  const r=run,start=np.monotonic(),m=load('halflife2-reviewed-next.js');
  if(kase==='error'){process.stderr.write('helper error\n');return 7;}
  if(kase==='timeout'||kase==='cancel'){
    process.on('SIGTERM',()=>{});
    for(;;){fs.appendFileSync(path.join(r,'polls'),'poll\n');await np.sleep(20);}
  }
  if(kase==='cancel-release'){
    const child=cp.spawn(process.execPath,[__filename,'release-child'],{stdio:['ignore','pipe','pipe']});
    child.stdout.resume();child.stderr.resume();
    const closed=new Promise(res=>child.on('close',c=>res(c)));
    let cancelled=null;process.on('SIGTERM',()=>{cancelled??=128+os.constants.signals.SIGTERM;});
    fs.writeFileSync(path.join(r,'release-armed'),'');
    const end=np.monotonic()+30;
    try{while(cancelled===null&&np.monotonic()<end)await np.sleep(10);}
    finally{
      const exit=await Promise.race([closed,np.sleep(2000).then(()=>{throw new Error('release child timeout');})]);
      fs.writeFileSync(path.join(r,'release-wait.json'),JSON.stringify({actualWait:true,stdoutEOF:true,stderrEOF:true,exit}));
    }
    return cancelled??0;
  }
  const call=(command,timeout)=>{
    assert.deepEqual(command,{action:'native-startup-readiness'});assert(0<timeout&&timeout<=1);
    const ready=kase==='delayed'&&np.monotonic()-start>=9;
    return {contract:'native-startup-readiness-v1',ready,failures:ready?[]:['main.visible'],
      snapshot:{mainHwnd:'0x1',modalHwnd:'0x0',focus:'0x2',focusTopLevel:'0x1'},ordinaryOwner:{}};
  };
  const save=(name,value)=>fs.writeFileSync(path.join(r,name),JSON.stringify(value));
  const model={R:r,time:{time:np.now,sleep:s=>np.sleep(s*1000)},reserve:()=>null,identity:()=>({same:'actor'}),
    read:n=>JSON.parse(fs.readFileSync(path.join(r,n),'utf8')),call,save,PORT:123};
  try{await m.startup(model);}
  catch(e){save('PERMANENT-UNKNOWN.json',{error:String(e&&e.message||e),at:np.now(),noLaterRequests:true});return 1;}
  process.stdout.write('startup complete\n');process.stderr.write('stderr drained\n');
  return 0;
}
function supervise(run,kase){
  const m=load('halflife2-restored-native.js');
  return m.supervise_controller(run,['startup'],[process.execPath,__filename,'helper',run,kase]);
}
const globOne=(dir,file)=>{const d=path.join(dir,'controller-supervision');if(!fs.existsSync(d))return [];return fs.readdirSync(d).map(n=>path.join(d,n,file)).filter(f=>fs.existsSync(f));};
async function main(out){
  fs.mkdirSync(path.dirname(path.resolve(out)),{recursive:true});fs.mkdirSync(out);
  const m=load('halflife2-restored-native.js');
  assert.equal(m.controller_operation(['startup']).innerSeconds,15);
  assert.equal(m.controller_operation(['capture','image']).innerSeconds,3);
  assert.equal(m.controller_operation(['intent','next','image','20','30','install']).innerSeconds,3);
  assert(m.controller_operation(['review','image','personal review','Next >','install','0x1','20','30']));
  for(const args of [[],['startup','extra'],['intent','next','image','20','30'],['intent','next','image','20','30','game'],['capture']])
    assert.throws(()=>m.controller_operation(args),/^AssertionError/,JSON.stringify(args));
  const results=[];
  for(const kase of ['delayed','unready','error','timeout','cancel','cancel-release','parent-death']){
    const r=path.join(out,kase);fs.mkdirSync(r);fs.writeFileSync(path.join(r,'launch.json'),JSON.stringify({rootPort:123,deadline:np.now()+90,gameplayCutoff:np.now()+60}));
    let cmd=[process.execPath,__filename,'supervise',r,kase==='parent-death'?'cancel':kase];
    if(kase==='parent-death')cmd=[process.execPath,__filename,'intermediate',path.join(r,'owner-pid'),...cmd];
    const p=cp.spawn(cmd[0],cmd.slice(1),{stdio:['ignore','pipe','pipe']});
    let a='',b='';p.stdout.on('data',d=>a+=d);p.stderr.on('data',d=>b+=d);
    const closed=new Promise(res=>p.on('close',res));
    let adopted=null;
    if(kase.startsWith('cancel')||kase==='parent-death'){
      const end=np.monotonic()+10;
      while(!globOne(r,'runtime-start.json').length||(kase==='cancel-release'&&!fs.existsSync(path.join(r,'release-armed')))){assert(np.monotonic()<end);await np.sleep(10);}
      p.kill(kase==='parent-death'?'SIGKILL':'SIGTERM');
    }
    const timer=setTimeout(()=>p.kill('SIGKILL'),35000);await closed;clearTimeout(timer);
    if(kase==='parent-death'){
      const pid=Number(fs.readFileSync(path.join(r,'owner-pid'),'utf8')),token=np.token(pid),end=np.monotonic()+35;
      while(token!==null&&np.alive(pid,token)){assert(np.monotonic()<end,'adopted owner did not exit');await np.sleep(20);}
      adopted={pid,actualWait:false,exit:null,observedExit:true};
    }
    const waitFile=globOne(r,'wait.json')[0];assert(waitFile,'no supervisor wait.json; outer stderr: '+b);
    const w=JSON.parse(fs.readFileSync(waitFile,'utf8'));
    assert(w.actualWait&&w.stdoutEOF&&w.stderrEOF&&!(w.remainingAfterRuntime&&w.remainingAfterRuntime.length),JSON.stringify(w));
    assert(w.watchdogs.every(v=>v.actualWait&&v.stdoutEOF&&v.stderrEOF&&v.returncode===0),JSON.stringify(w));
    assert.equal(p.exitCode===0,kase==='delayed',JSON.stringify([kase,a,b,w]));
    assert.equal(fs.existsSync(path.join(r,'PERMANENT-UNKNOWN.json')),kase!=='delayed');
    if(kase==='delayed'){const ready=JSON.parse(fs.readFileSync(path.join(r,'startup-ready.json')));assert(8<ready.completedAt-ready.startedAt&&ready.completedAt-ready.startedAt<15);}
    if(kase==='unready')assert(!w.timedOut&&JSON.parse(fs.readFileSync(path.join(r,'PERMANENT-UNKNOWN.json'))).error.includes('startup readiness UNKNOWN'));
    if(kase==='timeout')assert(w.timedOut);
    if(kase==='cancel-release')assert.equal(JSON.parse(fs.readFileSync(path.join(r,'release-wait.json'))).exit,0);
    if(kase==='parent-death'){
      const owner=JSON.parse(fs.readFileSync(globOne(r,'parent-process-owner.json')[0],'utf8'));
      assert(owner.parentDeathObserved);
    }
    const polls=()=>fs.existsSync(path.join(r,'polls'))?fs.readFileSync(path.join(r,'polls')):null;
    const count=polls();await np.sleep(100);const again=polls();
    assert(count===null?again===null:count.equals(again),'polling survived UNKNOWN');
    if(kase!=='delayed')await assert.rejects(m.supervise_controller(r,['startup'],[process.execPath,__filename,'must-not-spawn']),e=>e.name==='AssertionError','UNKNOWN replay admitted');
    results.push({case:kase,outerActualWait:true,outerStdoutEOF:true,outerStderrEOF:true,adoptedOwnerWait:adopted,wait:w});
  }
  fs.writeFileSync(path.join(out,'proof.json'),JSON.stringify({passed:true,results},null,2));
  console.log('PASS delayed 9s startup, unchanged 15s unready limit, errors, outer timeout, cancellation, independent release drain, actual waits/both EOF and terminal UNKNOWN');
}
if(require.main===module){
  const finish=p=>Promise.resolve(p).then(rc=>{process.exitCode=rc??0;},e=>{if(e&&(e.name==='SystemExit'||e.name==='ShutdownRequested'))process.exitCode=e.exitCode??e.code;else{console.error(e);process.exitCode=1;}});
  const [mode,...rest]=process.argv.slice(2);
  if(mode==='helper')finish(helper(...rest));
  else if(mode==='supervise')finish(supervise(...rest));
  else if(mode==='release-child')setTimeout(()=>console.log('release EOF'),600);
  else if(mode==='must-not-spawn')throw new Error('must not spawn');
  else if(mode==='intermediate'){
    // Spawn the owner, publish its pid, then wait to be killed (the parent death).
    const c=cp.spawn(rest[1],rest.slice(2),{stdio:'ignore'});fs.writeFileSync(rest[0],String(c.pid));setTimeout(()=>{},60000);
  }else finish(main(mode));
}
