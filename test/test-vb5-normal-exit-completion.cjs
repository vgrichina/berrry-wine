#!/usr/bin/env node
'use strict';
// Real OS/native USER completion and fail-closed invocation/wait contract.
//
// No original media. The only delayed request is test-side post-UP observation:
// the native fixture genuinely exits/closes HTTP before that request is attempted.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),net=require('node:net');
const cp=require('node:child_process');
const np=require('../tools/native-proc.cjs');
const ROOT=path.resolve(__dirname,'..');
const RUNTIME='tools/vb5cce-original-runtime.js',CONTROL='tools/vb5cce-reviewed-control.js';
function check(cond,message){if(!cond){const e=new Error(message===undefined?'':typeof message==='string'?message:JSON.stringify(message));e.name='AssertionError';e.code='ERR_ASSERTION';throw e;}}
const isAssertion=e=>!!e&&e.code==='ERR_ASSERTION';
// A fresh module instance, as importlib's spec_from_file_location gave Python.
function fresh(file){const p=path.join(ROOT,file);delete require.cache[require.resolve(p)];return require(p);}
const sleep=np.sleep,now=np.now;
// Python str() of a case value: booleans print as True/False.
const pystr=v=>v===true?'True':v===false?'False':v===null?'None':String(v);
async function supervisor(run,exe,port,worker=false){
  const m=fresh(RUNTIME);m.RUN=run;m.install_shutdown_handlers();
  const w=m.popen([process.execPath,path.join(ROOT,RUNTIME),'watchdog',String(now()+15)],
    {env:{...process.env,DELPHI5_RUN:run},stdin:'ignore',start_new_session:true});
  let p=null,out=null,err=null,outClosed=false,errClosed=false;
  try{
    while(!fs.existsSync(path.join(run,'watchdog-armed.json'))){check(w.exitCode===null&&w.signalCode===null);await sleep(5);}
    out=fs.openSync(path.join(run,'native.stdout.log'),'wx');
    try{
      err=fs.openSync(path.join(run,'native.stderr.log'),'wx');
      const invocation=crypto.randomUUID();
      const argv=worker?['node','test/test-vb5-normal-exit-native.cjs',run]:['node','test/run.js','--exe='+exe,'--no-build','--threads','--real-ticks',
        '--native-exit-receipt='+path.join(run,'native-exit.json'),'--native-invocation-token='+invocation,
        '--control='+port,'--screen=800x600','--png-canvas','--max-seconds=20',
        '--max-batches=100000000','--stuck-after=0','--quiet-api','--quiet-blocks'];
      p=m.popen(argv,{cwd:ROOT,stdout:out,stderr:err,start_new_session:true});
      const info=m.native_identity(p);info.invocationToken=invocation;
      m.save('native-pid.json',info);m.save('current-native-pid.json',info);
      await m.wait_native(p,run,info,18);
    }finally{
      fs.closeSync(out);outClosed=true;
      if(err!==null){fs.closeSync(err);errClosed=true;}
    }
  }finally{
    if(p&&!fs.existsSync(path.join(run,'native-wait.json')))await m.terminate_owned(p);
    m.save('pipeline-closed.json',{at:now()});
    await m.join_watchdog(w);
    m.save('release.json',{nativeOutputClosed:outClosed&&errClosed});
  }
}
async function controller(run,port,kind,mode){
  const m=fresh(CONTROL);m.R=run;m.PORT=port;
  const due=now()+10;
  for(;;){
    try{
      const s=await m.call({action:'snapshot'});
      if(s.modalHwnd!=='0x0')break;
    }catch(e){if(!(m.is_os_error(e)||isAssertion(e)))throw e;}
    check(now()<due);await sleep(10);
  }
  await m.capture('scene');const s=m.read('scene.json').snapshot;
  const b=s.windows.find(w=>w.controlClass===1&&w.controlId===2);check(b);
  m.review('scene','Automated authored native USER contract fixture; no original personal review claim','Cancel',kind,b.hwnd);
  await m.bind('scene');
  if(mode==='cancelled')await m.call({action:'frozen',mode:'on'});
  const original=m.call;
  const delayed_snapshot=async(command,...rest)=>{
    if(mode==='early'&&command.action==='guarded-input'){
      const result=await original(command,...rest);
      process.kill(-m.read('native-pid.json').pid,'SIGTERM');
      return result;
    }
    if(command.action==='snapshot'){
      if(mode==='transport-live'){
        await original({action:'eval',code:'control.close();true'});
        check(m.same_live_invocation(m.read('native-pid.json')));
        return original(command,...rest);
      }
      if(mode==='signal')process.kill(-m.read('native-pid.json').pid,'SIGTERM');
      // Genuine endpoint exit race; no fabricated reply or wait.
      const end=now()+1.5;
      while(!fs.existsSync(path.join(run,'native-wait.json'))&&now()<end)await sleep(5);
      if(['missing-wait','wrong-pid','stale-token','late-wait'].includes(mode)){
        const actual=m.read('native-wait.json');m.save('actual-native-wait.json',actual);
        fs.unlinkSync(path.join(run,'native-wait.json'));
        if(mode==='wrong-pid')m.save('native-wait.json',{...actual,pid:process.pid});
        if(mode==='stale-token')m.save('native-wait.json',{...actual,startToken:'reused'});
        if(mode==='late-wait'){await sleep(3050);m.save('native-wait.json',actual);}
      }
    }
    return original(command,...rest);
  };
  m.call=delayed_snapshot;
  await m.intent('press','scene',b.x+Math.floor(b.w/2),b.y+Math.floor(b.h/2),kind);
}
async function contracts(run){
  const m=fresh(CONTROL);m.R=run;fs.mkdirSync(run);
  const rt=fresh(RUNTIME);
  // Two real OS children: unrelated child stays alive through every refusal.
  const p=rt.popen(['sleep','20'],{start_new_session:true,stdout:'ignore',stderr:'ignore'}),sibling=rt.popen(['sleep','1'],{start_new_session:true,stdout:'ignore',stderr:'ignore'});
  const cases=[];
  const refuses=(op,what)=>{try{op();}catch(e){if(!isAssertion(e))throw e;return true;}throw new Error('AssertionError: '+what);};
  try{
    const info=rt.native_identity(p);check(m.same_live_invocation(info));
    for(const [field,value] of [['startToken','reused'],['bootId','other-boot'],['invocationToken',null]]){
      const bad={...info,[field]:value};
      if(refuses(()=>m.same_live_invocation(bad),field))cases.push(field);
    }
    const start=now(),live=np.monotonic();process.kill(-p.pid,'SIGTERM');
    const rc=await rt.wait(p);check(rc===-15&&!m.same_live_invocation(info));
    const base={...info,actualWait:true,exit:0,disposition:'normal',atWait:now(),atWaitMono:np.monotonic()};
    const target=path.join(run,'native-wait.json');
    check(m.normal_exit(info,live,start)===null);cases.push('missing-wait-not-EOF');
    for(const [field,value] of [['pid',sibling.pid],['startToken','reused'],['invocationToken','late-other'],
        ['actualWait',false],['exit',7],['exit',-11],['signal',15],['disposition','cleanup'],
        ['atWaitMono',live-1],['atWait',start-1]]){
      fs.writeFileSync(target,JSON.stringify({...base,[field]:value}));
      if(refuses(()=>m.normal_exit(info,live,start),field))cases.push(field+'='+pystr(value));
    }
    fs.writeFileSync(target,JSON.stringify(base));
    const exitRecord={...info,contract:'native-process-exit-v1',exitCode:0,atExitMono:live};
    fs.writeFileSync(path.join(run,'native-exit.json'),JSON.stringify(exitRecord));
    check(require('node:util').isDeepStrictEqual(m.normal_exit(info,live,start),base));
    for(const [field,value] of [['exitCode',7],['pid',sibling.pid],['invocationToken','late-other'],['atExitMono',live-1]]){
      fs.writeFileSync(path.join(run,'native-exit.json'),JSON.stringify({...exitRecord,[field]:value}));
      if(refuses(()=>m.normal_exit(info,live,start),'native exit '+field))cases.push('guest-'+field+'='+pystr(value));
    }
    m.save('PERMANENT-UNKNOWN.json',{reason:'cancelled/early-exit/transport-loss terminal latch'});
    refuses(()=>m.normal_exit(info,live,start),'late callback revived UNKNOWN');
    try{await m.call({action:'snapshot'});throw new Error('AssertionError: late callback revived UNKNOWN');}
    catch(e){if(!isAssertion(e))throw e;}
    check(sibling.exitCode===null&&sibling.signalCode===null);
    cases.push('UNKNOWN-no-late-callback-or-request');cases.push('no-sibling-kill');
  }finally{
    if(p.exitCode===null&&p.signalCode===null)process.kill(-p.pid,'SIGTERM');
    await rt.wait(p);check(await rt.wait(sibling,3)===0); // No signal to the sibling, even in cleanup.
  }
  fs.writeFileSync(path.join(run,'results.json'),JSON.stringify({passed:true,cases,actualWaits:[rt.returncode(p),rt.returncode(sibling)]},null,2)+'\n');
}
async function reservePort(){
  const s=net.createServer();
  await new Promise((resolve,reject)=>{s.once('error',reject);s.listen(0,'127.0.0.1',resolve);});
  const port=s.address().port;await new Promise(r=>s.close(r));return port;
}
async function main(run){
  fs.mkdirSync(run,{recursive:true});
  const rt=fresh(RUNTIME);
  await contracts(path.join(run,'contracts'));
  const fixtures=path.join(run,'fixtures');
  const gen=cp.spawnSync('node',['test/test-vb5-normal-exit-native.cjs',fixtures,'--generate'],{cwd:ROOT,stdio:'inherit'});
  check(gen.status===0,'fixture generation failed: '+gen.status);
  const sha=n=>crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,n))).digest('hex');
  const results=[];
  for(const [mode,kind] of [['normal','install'],['normal','game'],['normal','quit'],['nonzero','install'],['crash','install'],
      ['early','install'],['signal','install'],['transport-live','install'],['missing-wait','install'],
      ['wrong-pid','install'],['stale-token','install'],['late-wait','install'],['cancelled','install']]){
    const target=path.join(run,mode+'-'+kind);fs.mkdirSync(target);
    const port=await reservePort();
    const at=now();fs.writeFileSync(path.join(target,'launch.json'),JSON.stringify({deadline:at+240,gameplayCutoff:at+60,reserveSeconds:180,rootPort:port}));
    const sources=Object.fromEntries([CONTROL,'test/test-vb5cce-original-current.cjs'].map(n=>[n,sha(n)]));
    fs.writeFileSync(path.join(target,'runtime-inputs.json'),JSON.stringify({sources}));
    const fixture_mode=['normal','nonzero','crash','early'].includes(mode)?mode:['transport-live','cancelled'].includes(mode)?'live':'normal';
    const outer=rt.popen([process.execPath,__filename,'--supervisor',target,path.join(fixtures,fixture_mode+'.exe'),String(port)],
      {stdin:'ignore',start_new_session:true});
    let ctl=null;
    try{
      ctl=rt.popen([process.execPath,__filename,'--controller',target,String(port),kind,mode],{stdin:'ignore'});
      const [a,b]=await rt.communicate(ctl,15);
      fs.writeFileSync(path.join(target,'controller.stdout.log'),a);fs.writeFileSync(path.join(target,'controller.stderr.log'),b);
      check((rt.returncode(ctl)===0)===(mode==='normal'),b.toString());
      if(mode==='normal'){
        const observation=JSON.parse(fs.readFileSync(path.join(target,'press-observation.json'),'utf8'));check(observation.outcome==='process-exited');
        check(!fs.existsSync(path.join(target,'PERMANENT-UNKNOWN.json')));
      }else{
        check(fs.existsSync(path.join(target,'PERMANENT-UNKNOWN.json')));check(!fs.existsSync(path.join(target,'press-completion.json')));
      }
    }finally{
      if(ctl&&ctl.exitCode===null&&ctl.signalCode===null){ctl.kill('SIGKILL');await rt.communicate(ctl);}
      const [a,b]=await rt.communicate(outer,22);
      fs.writeFileSync(path.join(target,'outer.stdout.log'),a);fs.writeFileSync(path.join(target,'outer.stderr.log'),b);
    }
    check(rt.returncode(outer)===0,fs.readFileSync(path.join(target,'outer.stderr.log'),'utf8'));
    const actual=path.join(target,'actual-native-wait.json');
    const native=JSON.parse(fs.readFileSync(fs.existsSync(actual)?actual:path.join(target,'native-wait.json'),'utf8'));
    const watch=JSON.parse(fs.readFileSync(path.join(target,'watchdog-wait.json'),'utf8'));
    check(native.actualWait&&watch.actualWait&&watch.stdoutEOF&&watch.stderrEOF&&watch.exit===0);
    check(JSON.parse(fs.readFileSync(path.join(target,'release.json'),'utf8')).nativeOutputClosed);
    results.push({mode,kind,native,watchdog:watch,controllerExit:rt.returncode(ctl),
      actualControllerWait:true,controllerBothPipeEOF:true,outerExit:rt.returncode(outer),actualOuterWait:true,outerBothPipeEOF:true});
  }
  fs.writeFileSync(path.join(run,'results.json'),JSON.stringify({passed:true,cases:results},null,2)+'\n');
  const worker=path.join(run,'worker');fs.mkdirSync(worker);
  const p=rt.popen([process.execPath,__filename,'--worker-supervisor',worker],{stdin:'ignore'});
  const [a,b]=await rt.communicate(p,25);
  fs.writeFileSync(path.join(worker,'outer.stdout.log'),a);fs.writeFileSync(path.join(worker,'outer.stderr.log'),b);
  check(rt.returncode(p)===0,b.toString());
  fs.writeFileSync(path.join(worker,'outer-wait.json'),JSON.stringify({exit:rt.returncode(p),actualWait:true,stdoutEOF:true,stderrEOF:true}));
  console.log('PASS normal install/game/quit actual process-exit completion; nonzero/crash UNKNOWN; retained identity/late callbacks/no sibling kills');
}
if(require.main===module){
  const exit=e=>{
    if(e&&e.name==='ShutdownRequested'){process.exitCode=e.code;return;}
    process.stderr.write((e&&e.stack||String(e))+'\n');process.exitCode=1;
  };
  const a=process.argv.slice(2);
  if(a[0]==='--supervisor')supervisor(path.resolve(a[1]),path.resolve(a[2]),Number.parseInt(a[3],10)).catch(exit);
  else if(a[0]==='--worker-supervisor')supervisor(path.resolve(a[1]),null,0,true).catch(exit);
  else if(a[0]==='--controller')controller(path.resolve(a[1]),Number.parseInt(a[2],10),a[3],a[4]).catch(exit);
  else main(path.resolve(a[0])).catch(exit);
}
