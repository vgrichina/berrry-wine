#!/usr/bin/env node
'use strict';
// Actual native CLI + independent watchdog + outer signal/error/timeout joins.
//
// Uses the production shutdown functions, not process absence as a wait oracle.
// No original media is launched. Each regular output file is closed explicitly.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const cp=require('node:child_process');
const np=require('../tools/native-proc.cjs');
const ROOT=path.resolve(__dirname,'..');
const RUNTIME=path.join(ROOT,'tools/vb5cce-original-runtime.js');
function check(cond,message){if(!cond){const e=new Error(message===undefined?'':typeof message==='string'?message:JSON.stringify(message));e.name='AssertionError';e.code='ERR_ASSERTION';throw e;}}
// A fresh module instance, as importlib's spec_from_file_location gave Python.
function fresh(){delete require.cache[require.resolve(RUNTIME)];return require(RUNTIME);}
const sleep=np.sleep;
async function child(mode,run,exe){
  const m=fresh();m.RUN=run;m.install_shutdown_handlers();m.seal('shutdown-fixture',Buffer.from('owned'));
  const w=m.popen([process.execPath,RUNTIME,'watchdog',String(np.now()+4)],
    {env:{...process.env,DELPHI5_RUN:run},stdin:'ignore',start_new_session:true});
  let p=null,success=false,out=null,err=null,outClosed=false,errClosed=false;
  try{
    while(!fs.existsSync(path.join(run,'watchdog-armed.json'))){check(w.exitCode===null&&w.signalCode===null);await sleep(10);}
    out=fs.openSync(path.join(run,'native.stdout.log'),'wx');
    try{
      err=fs.openSync(path.join(run,'native.stderr.log'),'wx');
      p=m.start_native(['node','test/run.js','--exe='+exe,'--no-build','--threads','--real-ticks',
        '--max-seconds=30','--max-batches=100000000','--stuck-after=0','--quiet-api','--quiet-blocks'],
        out,err,{cwd:ROOT,start_new_session:true});
      const info={pid:p.pid,startToken:m.token(p.pid)};m.save('current-native-pid.json',info);
      try{
        if(mode!=='normal'){
          const due=np.now()+3;
          while(!fs.readFileSync(path.join(run,'native.stdout.log'),'utf8').includes('[MessageBox]')){
            check(p.exitCode===null&&p.signalCode===null&&np.now()<due);await m.interruptible(sleep(10));
          }
        }
        m.save('ready.json',{pid:process.pid,native:p.pid,mode});
        if(mode==='error')throw new Error('injected outer exception');
        if(mode==='term')process.kill(process.pid,'SIGTERM');
        if(mode==='eof')p.kill('SIGTERM');
        await m.wait_native(p,run,info,mode==='timeout'?.1:8);
      }finally{
        if(!fs.existsSync(path.join(run,'native-wait.json'))){
          await m.terminate_owned(p);m.publish(path.join(run,'native-wait.json'),{...info,exit:m.returncode(p),actualWait:true,...await m.join_native_output(p)});
        }
      }
    }finally{
      // Native's regular descriptors close on unwinding before watchdog join.
      fs.closeSync(out);outClosed=true;
      if(err!==null){fs.closeSync(err);errClosed=true;}
    }
    success=true;
  }finally{
    m.save('pipeline-closed.json',{actualNativeWait:fs.existsSync(path.join(run,'native-wait.json'))});
    await m.join_watchdog(w);
    for(const fd of [...m.OWN_FDS])m.close_owned(fd);
    m.save('runtime-release.json',{success,ownDescriptorsClosed:m.OWN_FDS.size===0,
      nativeOutputClosed:outClosed&&errClosed});
  }
}
async function main(run){
  fs.mkdirSync(run,{recursive:false});
  // The actual live PID remains untouched; a closed actor is losslessly
  // recoverable before its original observation file is removed.
  const m=fresh();m.RUN=run;
  const obs=path.join(run,'desktop-observations');fs.mkdirSync(obs);
  const live=path.join(obs,`desktop-${process.pid}-1-live.trace`);fs.writeFileSync(live,'live-writer');
  const closed=path.join(obs,'desktop-2147483647-1-closed.trace'),body=Buffer.from('closed-native-observation\0'.repeat(4096));fs.writeFileSync(closed,body);
  m.compact_closed_observations();
  check(fs.readFileSync(live,'utf8')==='live-writer'&&!fs.existsSync(closed));
  check(zlib.gunzipSync(fs.readFileSync(closed+'.gz')).equals(body));
  const row=JSON.parse(fs.readFileSync(path.join(run,'observation-recovery.jsonl'),'utf8'));
  check(row.sha256===crypto.createHash('sha256').update(body).digest('hex')&&row.writerAbsent);
  m.compact_closed_observations();check(fs.readFileSync(live,'utf8')==='live-writer');
  const exe=path.join(run,'modal.exe'),normal=path.join(run,'normal.exe');
  fs.writeFileSync(exe,require('./test-sims-child-mount-native.cjs').untitledModal());
  const b=require('../tools/kernel32-native-fixture').makeFixture();
  b.fill(0,0xb00,0xb20);b.writeUInt32LE(0x1a00,0xb00);b.write('ExitProcess\0',0xc02);b.set([0x6a,0,0xff,0x15,0,0x19,0x40,0],0x1200);
  fs.writeFileSync(normal,b);
  const results=[];
  for(const mode of ['normal','term','error','timeout','eof','watchdog']){
    const target=path.join(run,mode);fs.mkdirSync(target);
    const p=m.popen([process.execPath,__filename,'--child',mode,target,mode==='normal'?normal:exe],{stdin:'ignore',start_new_session:true});
    let a,e;
    try{[a,e]=await m.communicate(p,20);}
    catch(t){if(t instanceof m.TimeoutExpired){try{process.kill(-p.pid,'SIGKILL');}catch{}[a,e]=await m.communicate(p);}throw t;}
    fs.writeFileSync(path.join(target,'outer.stdout.log'),a);fs.writeFileSync(path.join(target,'outer.stderr.log'),e);
    const expected=mode==='term'?143:['error','timeout'].includes(mode)?1:0;
    check(m.returncode(p)===expected,[mode,m.returncode(p),e.toString()]);
    const readJSON=n=>JSON.parse(fs.readFileSync(path.join(target,n),'utf8'));
    const native=readJSON('native-wait.json'),watch=readJSON('watchdog-wait.json'),release=readJSON('runtime-release.json');
    check(native.actualWait&&watch.actualWait&&watch.stdoutEOF&&watch.stderrEOF);
    check(native.stdoutEOF&&native.stderrEOF&&native.readersJoined&&!native.outputErrors.length);
    check(watch.exit===0&&release.ownDescriptorsClosed&&release.nativeOutputClosed);
    if(mode==='normal')check(native.exit===0);
    if(mode==='watchdog')check(readJSON('watchdog-exit.json').reason==='independent fixed deadline');
    results.push({mode,outerExit:m.returncode(p),actualOuterWait:true,stdoutEOF:true,stderrEOF:true,native,watchdog:watch,release});
  }
  fs.writeFileSync(path.join(run,'results.json'),JSON.stringify({passed:true,cases:results},null,2)+'\n');
  console.log('PASS actual native/watchdog/outer TERM143/error/timeout/EOF/deadline joins and descriptor release');
}
if(require.main===module){
  const exit=require(RUNTIME).exit_with;
  if(process.argv[2]==='--child')child(process.argv[3],path.resolve(process.argv[4]),path.resolve(process.argv[5])).catch(e=>{
    // The child's own module instance owns the ShutdownRequested class.
    if(e&&e.name==='ShutdownRequested'){process.exitCode=e.code;return;}exit(e);
  });
  else main(path.resolve(process.argv[2])).catch(exit);
}
