'use strict';
// Authored controls only. Synthetic attestation here never authorizes an original.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const cp=require('node:child_process'),net=require('node:net'),crypto=require('node:crypto');
const {once}=require('node:events'),{startControlSession}=require('./control-session');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function reuseProofUnits(){
 const code=String.raw`import runpy,tempfile,pathlib,json,copy
f=runpy.run_path('tools/caesar3-current-native.py')['verify_native_proof']
sources={'owned.py':'abc','broker.js':'def'};module='module'
wait=dict(exit=0,actualWait=True,stdoutEOF=True,stderrEOF=True)
pins=dict(sources=sources,moduleSHA256=module,sourceSeals=15,moduleSeals=15,foreignWIPAdopted=False,gitSHA='published')
outer=dict(actualWait=True,nativeWait=dict(actualWait=True),returncode=0,supervisorExitCode=0,stdoutEOF=True,stderrEOF=True,timedOut=False,remainingAfterRuntime=[],watchdogs=[dict(actualWait=True,returncode=0,stdoutEOF=True,stderrEOF=True,result=dict(fired=False))]*2)
records={'runtime-inputs.json':pins,'compile-inputs.json':dict(sources=sources,moduleSHA256=module,workingQualification=False),'qualification.json':dict(passed=True,originalStarted=False,gitSHA='published',moduleSHA256=module),'runtime-release.json':dict(success=True,descriptorsClosed=True),'authored-native-wait.json':wait,'outer-native-printable-wait.json':wait,'inheritance-wait.json':wait,'authored/assertions.json':dict(pass_=True),'outer/wait.json':outer}
records['authored/assertions.json']={'pass':True}
def write(root,rows):
 for n,v in rows.items():
  p=root/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v))
with tempfile.TemporaryDirectory() as d:
 root=pathlib.Path(d);write(root,records);assert f(root,sources,module)
 for s,m in [(dict(sources,extra='x'),module),({'owned.py':'changed','broker.js':'def'},module),(sources,'changed')]:
  try:f(root,s,m)
  except AssertionError:pass
  else:raise AssertionError('changed graph accepted')
 for name,field,value in [('runtime-inputs.json','sourceSeals',0),('compile-inputs.json','workingQualification',True),('qualification.json','gitSHA','different'),('authored-native-wait.json','actualWait',False),('outer-native-printable-wait.json','stderrEOF',False),('runtime-release.json','descriptorsClosed',False),('outer/wait.json','remainingAfterRuntime',[123]),('outer/wait.json','returncode',143)]:
  rows=copy.deepcopy(records);rows[name][field]=value;write(root,rows)
  try:f(root,sources,module)
  except AssertionError:pass
  else:raise AssertionError(name+' '+field+' accepted')
print('PASS native proof reuse: exact graph, module, seals, published identity, actual waits, EOF, closure and empty parent scope')`;
 return cp.execFileSync('python3',['-B','-c',code],{encoding:'utf8'});
}
async function keyboard(out){
 fs.mkdirSync(out);const save=(n,v)=>fs.writeFileSync(path.join(out,n),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
 const image=path.join(out,'keyboard.exe');fs.writeFileSync(image,require('./test-cli-native-button-delivery.cjs').fixture(0));
 const reservation=net.createServer();await new Promise(r=>reservation.listen(0,'127.0.0.1',r));const port=reservation.address().port;await new Promise(r=>reservation.close(r));
 const wd=cp.spawn(process.execPath,['-e',`let p;const t=setTimeout(()=>{if(p)try{process.kill(-p,'SIGTERM')}catch{};process.exit(2)},30000);console.log('ARMED');process.stdin.on('data',b=>p=+b);process.stdin.on('end',()=>clearTimeout(t));`]);
 let wo='',we='';wd.stdout.on('data',b=>wo+=b);wd.stderr.on('data',b=>we+=b);const ww=once(wd,'close');
 while(!wo.includes('ARMED'))await pause(2);save('watchdog-arm.json',{pid:wd.pid,beforeNative:true,seconds:30});
 const s=startControlSession(['test/run.js','--exe='+image,'--no-build','--threads','--real-ticks','--screen=800x600','--control-stdin','--control='+port,'--max-seconds=25','--max-batches=100000000','--stuck-after=0','--quiet-api','--quiet-blocks','--no-close'],{spawnOptions:{detached:true}});
 wd.stdin.write(String(s.child.pid));let release,rw;
 try{
  let snap;const end=Date.now()+15000;do{snap=await s.send({action:'snapshot'});if(snap.focusWindow?.live&&snap.windows.length>=2)break;assert(Date.now()<end);await pause(20);}while(true);
  const capture=await s.send({action:'native-reviewed-capture',path:path.join(out,'keyboard.png')});save('capture.json',capture);
  const review={contract:capture.contract,captureId:capture.captureId,pngSHA256:capture.pngSHA256,reviewed:true,reviewedAt:Date.now(),scope:'menu',targetHwnd:snap.focus};
  const owner=await s.send({action:'guarded-bind',reviewedScene:review});
  release=cp.spawn(process.execPath,['-e',`console.log('ARMED');setTimeout(async()=>{try{const sent=Date.now(),r=await fetch('http://127.0.0.1:${port}/ctl',{method:'POST',signal:AbortSignal.timeout(250),body:JSON.stringify({action:'guarded-release',owner:${JSON.stringify(owner.owner)}})});console.log(JSON.stringify({sent,at:Date.now(),reply:await r.json()}))}catch(e){console.error(e);process.exitCode=1}},200);`]);
  let ro='',re='';release.stdout.on('data',b=>ro+=b);release.stderr.on('data',b=>re+=b);rw=once(release,'close');
  while(!ro.includes('ARMED'))await pause(2);
  const start=Date.now(),receipt=await s.send({action:'guarded-input',cmd:'keydown:27',guard:{...owner,nonce:crypto.randomUUID(),reviewed:true,deadline:start+500,intent:{review}}});
  save('down.json',{start,at:Date.now(),receipt});assert.equal(receipt.state,'CONSUMED');assert.equal(receipt.receiptBoundary,'native-input-return');assert.equal(receipt.nativeMessage.msg,0x100);assert(Date.now()<start+500);
  const [exit,signal]=await rw;save('release-wait.json',{exit,signal,actualWait:true,stdoutEOF:release.stdout.readableEnded,stderrEOF:release.stderr.readableEnded,stdout:ro,stderr:re});assert.equal(exit,0);assert(Date.now()<start+1750);
  s.child.stdin.end();assert.equal(await s.exited,0);assert(Date.now()<start+3000);save('assertions.json',{pass:true,keyboardNativeConsumed:true,nativeEscapeUpQuit:true,independentUp:true,syntheticAuthoredAttestation:true});
 }finally{
  if(s.child.exitCode===null&&s.child.signalCode===null)process.kill(-s.child.pid,'SIGTERM');await s.exited;
  if(release&&release.exitCode===null){release.kill();await rw;}
  save('native-wait.json',{pid:s.child.pid,exit:s.child.exitCode,signal:s.child.signalCode,actualWait:true,stdoutEOF:s.child.stdout.readableEnded,stderrEOF:s.child.stderr.readableEnded});fs.writeFileSync(path.join(out,'native.log'),s.output());
  wd.stdin.end();const [exit,signal]=await ww;save('watchdog-wait.json',{exit,signal,actualWait:true,stdoutEOF:wd.stdout.readableEnded,stderrEOF:wd.stderr.readableEnded,stdout:wo,stderr:we});assert.equal(exit,0);
 }
}
function controllerFixture(){
 // Authored native quit waits briefly in its own ordinary guest execution so
 // its exit is causally after the independently observed physical-UP ACK.
 // This is fixture code only; the controller's immutable deadlines stay fixed.
 const b=require('./test-cli-native-button-delivery.cjs').fixture(0),raw=r=>r-0x1000+0x400;
 const u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];
 const quit=Buffer.from([0x68,0,0,0,0,0xff,0x15,...u32(0x401320)]),at=b.indexOf(quit);
 assert(at>=raw(0x2400)&&at<raw(0x2800));
 const guestAt=0x400000+at-0x400+0x1000,stub=0x402d00;
 const code=Buffer.from([0x68,...u32(50),0xff,0x15,...u32(0x401204),...quit,0xe9,...u32(guestAt+quit.length-(stub+11+quit.length+5))]);
 code.copy(b,raw(0x2d00));b.fill(0x90,at,at+quit.length);b[at]=0xe9;b.writeInt32LE(stub-guestAt-5,at+1);return b;
}
function initialPumpFixture(){
 const b=controllerFixture(),raw=r=>r-0x1000+0x400,u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];
 // Delay only the first ordinary pump with the existing real GetTickCount.
 // No original code, real clock, API implementation or deadline is changed.
 const wait=[0xff,0x15,...u32(0x40120c),0x89,0xc3,0xff,0x15,...u32(0x40120c),0x29,0xd8,0x3d,...u32(4000),0x72,0xf1];
 const at=raw(0x2c00),pump=Buffer.from(b.subarray(at+wait.length,at+wait.length+26));
 assert.equal(pump[0],0x68);assert.equal(pump[25],0x00);
 const resume=0x402c00+wait.length+26+5+b.readInt32LE(at+wait.length+27);
 const prefix=[0x83,0x3d,...u32(0x403630),1,0x74,10+wait.length,0xc7,0x05,...u32(0x403630),...u32(1)];
 const code=Buffer.from([...prefix,...wait,...pump,0xe9,...u32(resume-(0x402e00+prefix.length+wait.length+pump.length+5))]);
 code.copy(b,raw(0x2e00));b[at]=0xe9;b.writeInt32LE(0x402e00-0x402c05,at+1);return b;
}
function slowFrameFixture(){
 const b=controllerFixture(),s=titleConsumerFixture('slow-frame'),raw=r=>r-0x1000+0x400;
 for(const [a,z] of [[0x1334,0x133c],[0x1d00,0x1d80],[0x2c00,0x3000]])s.copy(b,raw(a),raw(a),raw(z));
 return b;
}
async function reviewedController(out,late=false,printable=false,personal=false,stale=false,fault=null){
 fs.mkdirSync(out);const save=(n,v)=>{
  const target=path.join(out,n),pending=target+'.'+process.pid+'.pending';
  fs.writeFileSync(pending,JSON.stringify(v,null,2)+'\n',{flag:'wx',flush:true});
  fs.linkSync(pending,target);fs.unlinkSync(pending);
 };
 fs.copyFileSync(path.join(out,personal?'../runtime-inputs.json':'../../runtime-inputs.json'),path.join(out,'runtime-inputs.json'));
 const image=path.join(out,'reviewed.exe');fs.writeFileSync(image,fault?.startsWith('slow-')?slowFrameFixture():fault==='initial-pump'?initialPumpFixture():printable?require('../tools/native-printable-fixture.cjs').fixture():controllerFixture());
 const reservation=net.createServer();await new Promise(r=>reservation.listen(0,'127.0.0.1',r));const port=reservation.address().port;await new Promise(r=>reservation.close(r));
 const invocationToken=crypto.randomUUID(),start=Date.now()/1000;
 save('launch.json',{at:start,deadline:start+240,gameplayCutoff:start+60,reserveSeconds:180,rootPort:port,inputReadinessRequired:fault==='initial-pump'});
 const wd=cp.spawn(process.execPath,['-e',`let p;const t=setTimeout(()=>{if(p)try{process.kill(-p,'SIGTERM')}catch{};process.exit(2)},${personal?120000:35000});console.log('ARMED');process.stdin.on('data',b=>p=+b);process.stdin.on('end',()=>clearTimeout(t));`]);
 let wo='',we='';wd.stdout.on('data',b=>wo+=b);wd.stderr.on('data',b=>we+=b);const ww=once(wd,'close');
 while(!wo.includes('ARMED'))await pause(2);save('watchdog-arm.json',{pid:wd.pid,beforeNative:true,seconds:personal?120:35});
 const s=startControlSession(['test/run.js','--exe='+image,'--public-consumer-trace='+path.join(out,'public-consumers.jsonl'),'--native-exit-receipt='+path.join(out,'native-exit.json'),'--native-invocation-token='+invocationToken,'--no-build','--threads','--real-ticks','--screen=800x600','--control-stdin','--control='+port,'--max-seconds='+ (personal?115:30),'--max-batches=100000000','--stuck-after=0','--quiet-api','--quiet-blocks','--no-close'],{spawnOptions:{detached:true}});
 wd.stdin.write(String(s.child.pid));
 const st=fs.readFileSync('/proc/'+s.child.pid+'/stat','utf8'),info={pid:s.child.pid,startToken:st.slice(st.lastIndexOf(')')+2).split(' ')[19],invocationToken,bootId:fs.readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim()};save('native-pid.json',info);
 let hostCleanup=false;
 s.child.once('close',(exit,signal)=>save('native-wait.json',{...info,exit,signal,actualWait:true,hostCleanup,disposition:hostCleanup?'cleanup':'normal',atWait:Date.now()/1000,atWaitMono:Number(process.hrtime.bigint())/1e9,stdoutEOF:s.child.stdout.readableEnded,stderrEOF:s.child.stderr.readableEnded}));
 let seq=0;
 async function control(args,expected=0){
  const c=cp.spawn('python3',['-B','tools/caesar3-current-native.py','control',...args],{env:{...process.env,CAESAR3_RUN:out},timeout:7000});let a='',b='';c.stdout.on('data',v=>a+=v);c.stderr.on('data',v=>b+=v);const [exit,signal]=await once(c,'close');
  save('controller-'+(++seq)+'-wait.json',{args,pid:c.pid,exit,signal,actualWait:true,stdoutEOF:c.stdout.readableEnded,stderrEOF:c.stderr.readableEnded,stdout:a,stderr:b});
  if(expected===0)assert.equal(exit,0,a+b);else assert.notEqual(exit,0);
 }
 try{
  let snap;const end=Date.now()+15000;do{snap=await s.send({action:'snapshot'});if(snap.focusWindow?.live&&snap.windows.length>=2)break;assert(Date.now()<end);await pause(20);}while(true);
  if(personal){
   save('personal-ready.json',{at:Date.now(),hwnd:snap.mainHwnd,originalStarted:false});
   const due=Date.now()+100000;
   while(!fs.existsSync(path.join(out,'stop-personal.json')) && s.child.exitCode===null && !fs.existsSync(path.join(out,'PERMANENT-UNKNOWN.json'))){assert(Date.now()<due);await pause(10);}
   save('personal-finished.json',{at:Date.now(),originalStarted:false});return;
  }
  if(fault?.startsWith('slow-')){
   await control(['capture','before']);
   await control(['review','before','Authored ordinary slow-frame USER window; finite pointer phase.','Fixture','game',snap.mainHwnd]);await control(['bind','before']);
   // Align only an authored test with its ordinary empty public USER return. No
   // pump, idle notification, callback, clock or guest state is forced.
   let seen=fs.readFileSync(path.join(out,'public-consumers.jsonl'),'utf8').length;
   const due=Date.now()+3000;
   while(true){const log=fs.readFileSync(path.join(out,'public-consumers.jsonl'),'utf8');
    const rows=log.slice(seen).trim().split('\n').filter(Boolean).map(l=>JSON.parse(l));seen=log.length;
    if(rows.some(v=>v.phase==='input-poll-return'&&v.name==='PeekMessageA'&&v.threadId===1&&v.eax===0))break;
    assert(Date.now()<due);await pause(2);
   }
   if(fault==='slow-combined'){
    await control(['intent','combined','before','500','220','game'],1);
    assert(fs.existsSync(path.join(out,'PERMANENT-UNKNOWN.json')));
    assert.equal(JSON.parse(fs.readFileSync(path.join(out,'combined-down.json'))).receipt.consumed,false);
    const requests=fs.readFileSync(path.join(out,'requests.jsonl'),'utf8');await control(['capture','forbidden'],1);
    assert.equal(fs.readFileSync(path.join(out,'requests.jsonl'),'utf8'),requests);
    save('assertions.json',{pass:true,combinedMoveDownExpired500:true,noFalseACK:true,permanentUNKNOWN:true,zeroLaterRequests:true,syntheticAuthoredAttestation:true});
   }else{
    await control(['hover-intent','arrive','before','500','220','game']);
    const receipt=JSON.parse(fs.readFileSync(path.join(out,'arrive-down.json'))).receipt;
    assert.equal(receipt.nativeMessage.msg,0x200);assert(receipt.consumed);
    // Let the authored application's own next ordinary frame run. This is
    // not permission for another original action: it gets a new review.
    await pause(400);await control(['capture','settled']);
    await control(['review-intent','click','settled','500','220','game','Authored separate arrival completed; same coordinate press.','Fixture',snap.mainHwnd]);
    const got=JSON.parse(fs.readFileSync(path.join(out,'click-down.json'))).receipt;assert(got.consumed);assert.equal(got.nativeMessage.msg,0x201);
    // Ordinary callbacks can complete after the immediate receipt capture.
    await pause(400);const final=await s.send({action:'snapshot'});
    assert.equal(final.windows.find(w=>w.hwnd===snap.mainHwnd).title,'UP after DOWN');
    save('assertions.json',{pass:true,separateNativeMoveAndDown:true,ordinary350msFrames:true,noForcedPumpIdleOrCallback:true,freshReviewForPress:true,actualUPAfterDOWNCaption:true,nativeConfirmation500:true,independentUP1750:true,aggregate3000:true,syntheticAuthoredAttestation:true});
   }
  }else if(fault==='initial-pump'){
   await control(['capture','too-early'],1);
   assert(!fs.existsSync(path.join(out,'too-early.png')));assert(!fs.existsSync(path.join(out,'PERMANENT-UNKNOWN.json')));
   assert(!fs.existsSync(path.join(out,'input-owner.json')));
   assert(fs.readFileSync(path.join(out,'requests.jsonl'),'utf8').trim().split('\n').every(l=>JSON.parse(l).action==='snapshot'));
   const due=Date.now()+15000;
   while(!fs.readFileSync(path.join(out,'public-consumers.jsonl'),'utf8').includes('input-poll-return')){assert(Date.now()<due);await pause(20);}
   await control(['ready']);await control(['capture','ready']);
   await control(['review','ready','Authored first pump now returned; complete native fixture.','Fixture','game',snap.mainHwnd]);await control(['bind','ready']);
   await control(['intent','click','ready','500','220','game']);
   assert.equal(JSON.parse(fs.readFileSync(path.join(out,'click-observed.json'))).snapshot.windows.find(w=>w.hwnd===snap.mainHwnd).title,'UP after DOWN');
   save('assertions.json',{pass:true,firstPumpDelayedMs:4000,prePumpZeroCapture:true,prePumpZeroBind:true,prePumpZeroDown:true,ordinaryOwnerPollObserved:true,nativeConfirmation500:true,independentUP1750:true,aggregate3000:true,syntheticAuthoredAttestation:true});
  }else if(fault){
   await control(['capture','before']);
   await control(['review','before','Authored deadline negative only, complete native scene.','Fixture','game',snap.mainHwnd]);
   await control(['bind','before']);
   let monitor,monitorWait;
   if(fault==='physical-up'){
    // Stop only the authored fixture's independently armed release process.
    // Resume it after the fixed 1750ms bound, allowing cleanup and actual join.
    monitor=cp.spawn(process.execPath,['-e',`const fs=require('node:fs');const d=${JSON.stringify(out)};let stopped=false;const timer=setInterval(()=>{try{const a=JSON.parse(fs.readFileSync(d+'/refused-release-arm.json')),i=JSON.parse(fs.readFileSync(d+'/refused-intent.json'));if(stopped)return;stopped=true;process.kill(a.pid,'SIGSTOP');console.log(JSON.stringify({stoppedAt:Date.now(),pid:a.pid}));clearInterval(timer);setTimeout(()=>{process.kill(a.pid,'SIGCONT');console.log(JSON.stringify({resumedAt:Date.now(),deadline:i.physicalUpDeadline*1000}))},Math.max(0,i.at*1000+1850-Date.now()))}catch{}},1);setTimeout(()=>{clearInterval(timer)},6000);`]);
    let mo='',me='';monitor.stdout.on('data',b=>mo+=b);monitor.stderr.on('data',b=>me+=b);
    monitorWait=once(monitor,'close').then(([exit,signal])=>{save('fault-monitor-wait.json',{exit,signal,actualWait:true,stdoutEOF:monitor.stdout.readableEnded,stderrEOF:monitor.stderr.readableEnded,stdout:mo,stderr:me});assert.equal(exit,0);assert(mo.includes('resumedAt'));});
   }else{
    const code=fault==='confirmation'
     ? "(()=>{const p=process.mainModule.require('node:http').ServerResponse.prototype,raw=p.end;p.end=function(b,...a){let v;try{v=JSON.parse(String(b))}catch{};if(v?.value?.consumed===true){setTimeout(()=>raw.call(this,b,...a),600);return this}return raw.call(this,b,...a)};return true})()"
     : "(()=>{const raw=renderer.canvas.toBufferSync.bind(renderer.canvas);renderer.canvas.toBufferSync=(...a)=>{const end=performance.now()+2900;while(performance.now()<end){}return raw(...a)};return true})()";
    await s.send({action:'eval',code});
   }
   await control(['intent','refused','before','500','220','game'],1);
   if(monitorWait)await monitorWait;
   assert(fs.existsSync(path.join(out,'PERMANENT-UNKNOWN.json')));assert(!fs.existsSync(path.join(out,'refused-completion.json')));
   const before=fs.readFileSync(path.join(out,'requests.jsonl'),'utf8');
   await control(['capture','forbidden'],1);await control(['bind','before'],1);
   assert.equal(fs.readFileSync(path.join(out,'requests.jsonl'),'utf8'),before);
   save('assertions.json',{pass:true,deadlineFault:fault,limitMs:{confirmation:500,'physical-up':1750,aggregate:3000}[fault],permanentUNKNOWN:true,zeroLaterRequests:true,syntheticAuthoredAttestation:true});
  }else if(stale){
   await control(['capture','before']);
   await control(['review','before','Authored binding only; complete native scene.','Fixture','install',snap.mainHwnd]);
   await control(['bind','before']);await control(['capture','stale']);
   await pause(15050);
   const before=fs.readFileSync(path.join(out,'requests.jsonl'),'utf8');
   await control(['review-intent','refused','stale','500','220','game','Authored stale scene; must refuse before any effect.','Fixture',snap.mainHwnd],1);
   assert(fs.existsSync(path.join(out,'PERMANENT-UNKNOWN.json')));
   assert(!fs.existsSync(path.join(out,'refused-intent.json')));assert(!fs.existsSync(path.join(out,'refused-down.json')));
   await control(['capture','forbidden'],1);await control(['bind','stale'],1);
   assert.equal(fs.readFileSync(path.join(out,'requests.jsonl'),'utf8'),before);
   save('assertions.json',{pass:true,actualElapsedFreshnessRefused:true,permanentUNKNOWN:true,zeroDown:true,zeroLaterRequests:true});
  }else if(late){
   // Only this authored fixture delays its encoder. Guest clock and code stay ordinary.
   await s.send({action:'eval',code:"(()=>{const raw=renderer.canvas.toBufferSync.bind(renderer.canvas);renderer.canvas.toBufferSync=(...a)=>{const end=performance.now()+3010;while(performance.now()<end){}return raw(...a)};return true})()"});
   await control(['capture','late'],1);assert(fs.existsSync(path.join(out,'PERMANENT-UNKNOWN.json')));assert(!fs.existsSync(path.join(out,'late.png')));
   const before=fs.readFileSync(path.join(out,'requests.jsonl'),'utf8');
   await control(['capture','forbidden'],1);await control(['bind','late'],1);
   assert.equal(fs.readFileSync(path.join(out,'requests.jsonl'),'utf8'),before);
   save('assertions.json',{pass:true,nativeLateCaptureRefused:true,permanentUNKNOWN:true,zeroLaterRequests:true});
  }else{
   await control(['capture','before']);
   await control(['review','before','Authored test only: complete ordinary USER window, finite left press.','Fixture','install',snap.mainHwnd]);
   await control(['bind','before']);
   if(printable)await control(['intent','click','before','-2','67','install','67']);
   else{
    await control(['capture','fresh']);
    // Real elapsed native transport tolerance, never a rewritten timestamp.
    await pause(10000);
    await control(['review-intent','click','fresh','500','220','game','Authored test only: complete USER window, one finite left press.','Fixture',snap.mainHwnd]);
    const timing=JSON.parse(fs.readFileSync(path.join(out,'click-intent.json'))).latency;
    assert(timing.captureAgeAtIntentMs>=10000&&timing.captureAgeAtIntentMs<15000);assert(timing.personalReviewAt>=timing.captureCompletedAt);
   }
   const rr=JSON.parse(fs.readFileSync(path.join(out,'click-observed.json')));
   assert.equal(rr.snapshot.windows.find(w=>w.hwnd===snap.mainHwnd).title,printable?'DCU':'UP after DOWN');
   if(printable){
    const receipt=JSON.parse(fs.readFileSync(path.join(out,'click-down.json'))).receipt;
    assert.deepEqual(receipt.nativeMessages.map(p=>p.msg),[0x100,0x102]);
    save('assertions.json',{pass:true,exactController:true,nativePhysicalAndCharacter:true,publicCaption:'DCU',syntheticAuthoredAttestation:true});
    return;
   }
   await control(['review','click-observed','Authored test only: release completed, ordinary Escape key route exits fixture.','Escape','quit',rr.snapshot.focus]);
   await control(['intent','quit','click-observed','-1','27','quit']);
   assert(JSON.parse(fs.readFileSync(path.join(out,'quit-native-quit.json'))).proven);
   save('assertions.json',{pass:true,exactController:true,nativePointer:true,nativeKeyboard:true,nativeQuit:true,syntheticAuthoredAttestation:true});
  }
 }finally{
  if(s.child.exitCode===null&&s.child.signalCode===null){hostCleanup=true;process.kill(-s.child.pid,'SIGTERM');}await s.exited;
  fs.writeFileSync(path.join(out,'native.log'),s.output());wd.stdin.end();const [exit,signal]=await ww;save('watchdog-wait.json',{exit,signal,actualWait:true,stdoutEOF:wd.stdout.readableEnded,stderrEOF:wd.stderr.readableEnded,stdout:wo,stderr:we});assert.equal(exit,0);
 }
}
async function main(out){
 fs.mkdirSync(out,{recursive:true});
 fs.writeFileSync(path.join(out,'proof-reuse-units.log'),reuseProofUnits());
 require('./test-disciples2-native-paint-binding.cjs').contextUnits();
 require('./test-cli-native-pointer-coordinates.cjs').units();require('./test-cli-native-pointer-coordinates.cjs').contextUnits();
 require('./test-cli-native-button-delivery.cjs').units();await require('./test-cli-native-button-delivery.cjs').transportUnits();
 // Real elapsed encoder delay: a late capture cannot publish a retained image.
 const registry=require('../lib/cli-native-scene').createReviewedContexts();
 let wrote=false;const m={hwnd:'0x1',generation:'1',processId:1000,threadId:1,live:true,visible:true,isChild:false,owner:'0x0',parent:'0x0',controlClass:0,style:0,screenX:0,screenY:0,w:800,h:600};
 const snapshot={mainHwnd:m.hwnd,windows:[m],modalHwnd:'0x0',focus:m.hwnd,focusTopLevel:m.hwnd,focusWindow:m,capture:'0x0',physicalUp:true,nativeProcess:{pid:1,executable:'authored'},screen:{w:800,h:600},eip:'0x402000'};
 const started=Date.now();assert.throws(()=>registry.capture(()=>snapshot,()=>{const until=performance.now()+3010;while(performance.now()<until){}return Buffer.from('late authored encoder');},()=>{wrote=true;}),/observation expired/);assert(!wrote);
 fs.writeFileSync(path.join(out,'late-capture.json'),JSON.stringify({refused:true,wrote:false,elapsedMs:Date.now()-started}));
 await require('./test-cli-native-pointer-coordinates.cjs').native(path.join(out,'mapping'));
 await keyboard(path.join(out,'keyboard'));
 require('./test-native-printable-input.cjs').units();
 for(const worker of [false,true])await require('./test-native-printable-input.cjs').native(path.join(out,worker?'printable-CPUWorker':'printable-cooperative'),{worker});
 await require('./test-native-printable-input.cjs').ownerNative(out);
 await consumerDiagnostic(path.join(out,'consumer'));
 await controllerFixtures(out);
 await adapterShutdown(path.join(out,'adapter-shutdown'));
 fs.writeFileSync(path.join(out,'assertions.json'),JSON.stringify({pass:true,originalStarted:false,sealedManifest:globalThis.__disciples2Manifest}));
}
async function adapterShutdown(out){
 fs.mkdirSync(out,{recursive:true});
 const fixture=path.join(out,'authored.exe');fs.writeFileSync(fixture,controllerFixture());
 const adapterSHA=crypto.createHash('sha256').update(fs.readFileSync('tools/caesar3-current-native.py')).digest('hex');
 for(const [name,sig,status] of [['term','SIGTERM',143],['int','SIGINT',130]]){
  const dir=path.join(out,name);fs.mkdirSync(dir);
  const code=String.raw`import runpy,os,sys,pathlib,hashlib,time,uuid
assert hashlib.sha256(pathlib.Path('tools/caesar3-current-native.py').read_bytes()).hexdigest()==sys.argv[2]
m=runpy.run_path('tools/caesar3-current-native.py')
h=m['published_module']('tools/vb5cce-original-runtime.py',os.environ['CAESAR3_PINNED_REVISION'])
h.install_shutdown_handlers()
args=['node','test/run.js','--exe='+sys.argv[1],'--no-build','--threads','--real-ticks','--wasm='+os.environ['DELPHI5_MODULE_FD'],'--no-close','--max-seconds=20','--max-batches=1000000000','--stuck-after=0','--quiet-api','--quiet-blocks']
m['execute_native'](args,os.environ.copy(),(),0,str(uuid.uuid4()),time.time()+25)`;
  const c=cp.spawn('python3',['-B','-c',code,fixture,adapterSHA],{env:{...process.env,CAESAR3_RUN:dir}});
  let stdout='',stderr='';c.stdout.on('data',b=>stdout+=b);c.stderr.on('data',b=>stderr+=b);const done=once(c,'close');
  try{
   const due=Date.now()+15000;
   while(!fs.existsSync(path.join(dir,'native.stdout.log'))||!fs.readFileSync(path.join(dir,'native.stdout.log'),'utf8').includes('[CreateWindow]')){
    assert(c.exitCode===null&&c.signalCode===null,stdout+stderr);assert(Date.now()<due,'incremental native stdout before cancellation');await pause(10);
   }
   c.kill(sig);const [exit,signal]=await done;assert.equal(exit,status,stderr);assert.equal(signal,null);
   const w=JSON.parse(fs.readFileSync(path.join(dir,'native-wait.json'))),watch=JSON.parse(fs.readFileSync(path.join(dir,'watchdog-wait.json')));
   assert(w.actualWait&&w.stdoutEOF&&w.stderrEOF&&w.hostCleanup&&w.interrupted&&w.nativeQuit===false);
   assert.equal(w.exit,0);assert(watch.actualWait&&watch.stdoutEOF&&watch.stderrEOF);assert.equal(watch.exit,0);
   fs.writeFileSync(path.join(dir,'assertions.json'),JSON.stringify({pass:true,signal:sig,adapterExit:exit,nativeWait:w,watchdogWait:watch,incrementalOutputBeforeSignal:true,originalStarted:false}));
  }finally{
   if(c.exitCode===null&&c.signalCode===null){c.kill('SIGTERM');await done;}
   fs.writeFileSync(path.join(dir,'adapter-wait.json'),JSON.stringify({exit:c.exitCode,signal:c.signalCode,actualWait:true,stdoutEOF:c.stdout.readableEnded,stderrEOF:c.stderr.readableEnded,stdout,stderr}));
  }
 }
}
async function controllerFixtures(out){
 fs.mkdirSync(out,{recursive:true});
 await reviewedController(path.join(out,'controller'));
 await reviewedController(path.join(out,'printable-controller'),false,true);
 await reviewedController(path.join(out,'late-controller'),true);
 await reviewedController(path.join(out,'stale-controller'),false,false,false,true);
 for(const fault of ['confirmation','physical-up','aggregate'])await reviewedController(path.join(out,fault+'-negative'),false,false,false,false,fault);
 fs.writeFileSync(path.join(out,'controllers-passed.json'),JSON.stringify({pass:true,originalStarted:false}));
}
async function hoverFixtures(out){
 fs.mkdirSync(out,{recursive:true});
 await reviewedController(path.join(out,'combined'),false,false,false,false,'slow-combined');
 await reviewedController(path.join(out,'separate'),false,false,false,false,'slow-hover');
 fs.writeFileSync(path.join(out,'assertions.json'),JSON.stringify({pass:true,originalStarted:false,syntheticAuthoredAttestation:true}));
}
async function inputReadinessFixture(out){
 fs.mkdirSync(out,{recursive:true});
 const trace=path.join(out,'observer-limit.jsonl');
 const code=String.raw`const {observePublicConsumers}=require('./test/public-consumer-observer');
let b=Buffer.alloc(65536),sp=0x1000,generation=1n;
let e={get_image_base:()=>0,get_esp:()=>sp,get_current_thread_id:()=>1,get_eax:()=>0,get_yield_reason:()=>0,get_yield_flag:()=>0,
get_focus_hwnd:()=>0x10001,get_main_hwnd:()=>0x10001,get_process_id:()=>7,wnd_lookup_generation:()=>generation,get_window_thread:()=>1,wnd_lookup_live:()=>1,modal_dialog_hwnd:()=>0,dialogbox_hwnd:()=>0,get_capture_hwnd:()=>0};
const h={log(){},log_api_exit(){}};observePublicConsumers(h,()=>e,()=>b.buffer,x=>x,process.argv[1]);
function call(name,args,mutate=()=>{}){b.fill(0,0x100,0x200);b.write(name,0x100);sp=0x1000;for(let i=0;i<args.length;i++)b.writeUInt32LE(args[i],sp+4+i*4);h.log(0x100,name.length);sp+=4*(args.length+1);mutate();h.log_api_exit()}
for(let i=0;i<5000;i++)call('GetTickCount',[]);
call('PeekMessageA',[0x2000,0,0x100,0x201,0]);
call('PeekMessageA',[0x2000,0,0,0,0],()=>generation++);generation=1n;
call('PeekMessageA',[0x2000,0,0,0,0],()=>e={...e});
call('PeekMessageA',[0x2000,0,0,0,0],()=>b=Buffer.alloc(65536));
call('PeekMessageA',[0x2000,0,0,0,0]);`;
 cp.execFileSync(process.execPath,['-e',code,trace]);
 const rows=fs.readFileSync(trace,'utf8').trim().split('\n').map(l=>JSON.parse(l)),polls=rows.filter(r=>r.phase==='input-poll-return');
 assert.equal(polls.length,1);assert(rows.find(r=>r.phase==='summary').seen>=8192);assert.equal(polls[0].receipt,false);
 const unit=String.raw`import runpy,pathlib,json,sys,copy,time
f=runpy.run_path('tools/caesar3-current-native.py')['public_input_ready'];r=pathlib.Path(sys.argv[1]);p=json.loads((r/'observer-limit.jsonl').read_text().splitlines()[-2])
(r/'launch.json').write_text(json.dumps(dict(at=time.time()-60)))
s=dict(focus='0x10001',mainHwnd='0x10001',modalHwnd='0x0',capture='0x0',physicalUp=True,focusWindow=dict(threadId=1,processId=7,generation='1',live=True),windows=[dict(hwnd='0x10001',threadId=1,processId=7,generation='1',live=True)])
def write(v):(r/'public-consumers.jsonl').write_text(json.dumps(v)+'\n')
write(p);assert f(r,s)
for field,value in [('threadId',2),('phase','handler-exit'),('yieldFlag',1),('yieldReason',1),('doneSp',0),('at',0),('at',time.time()*1000-3100),('name','GetAsyncKeyState'),('sameInstanceMemory',False)]:
 q=copy.deepcopy(p);q[field]=value;write(q);assert f(r,s) is None,field
for i,value in [(0,0),(1,0x10002),(2,0x100),(3,0x201)]:
 q=copy.deepcopy(p);q['args'][i]=value;write(q);assert f(r,s) is None,str(i)
for field,value in [('processId',8),('threadId',2),('focusThread',2),('focus',0x10002),('focusGeneration','2'),('mainGeneration','2'),('main',0x10002),('modal',0x10002),('capture',0x10001),('live',False),('memoryBytes',0)]:
 q=copy.deepcopy(p);q['actor'][field]=value;write(q);assert f(r,s) is None,field
write(p)
for field,value in [('modalHwnd','0x10002'),('capture','0x10001'),('physicalUp',False)]:
 q=copy.deepcopy(s);q[field]=value;assert f(r,q) is None,field
(r/'public-consumers.jsonl').unlink()
print('PASS current USER poll survives trace cap; stale/foreign actor/generation/target/filter/yield/stack/memory/modal/capture/non-poll refused')`;
 const text=cp.execFileSync('python3',['-B','-c',unit,out],{encoding:'utf8'});fs.writeFileSync(path.join(out,'readiness-units.log'),text);
 await reviewedController(path.join(out,'native'),false,false,false,false,'initial-pump');
}
// Authored consumer diagnostic also runs in full qualification. Running it alone
// never qualifies or authorizes an original-game launch.
// Authored x86 records API returns; no original private memory is inspected.
function titleConsumerFixture(mode){
 assert(['title','slow-frame','get-only','peek-delayed','busy-title','peek-only','filtered','async','none','sibling'].includes(mode));
 const b=require('./test-cli-native-button-delivery.cjs').fixture(0);
 const raw=r=>r-0x1000+0x400,u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];
 for(const [r,n] of [[0x1334,'PeekMessageA'],[0x1338,'GetAsyncKeyState']]){
  const str=r===0x1334?0x1d00:0x1d40;b.writeUInt32LE(str,raw(r));b.write(n+'\0',raw(str+2));
 }
 b.writeUInt32LE(0,raw(0x133c));
 function asm(rva,work){
  const a=[],labels=new Map(),fix=[];const emit=(...x)=>a.push(...x),push=n=>emit(0x68,...u32(n));
  const call=p=>emit(0xff,0x15,...u32(p)),label=n=>labels.set(n,a.length);
  const jump=(n,c)=>{emit(...(c?[0x0f,c]:[0xe9]));fix.push([a.length,n]);emit(0,0,0,0);};
  work({emit,push,call,label,jump});const code=Buffer.from(a);
  for(const [o,n]of fix){assert(labels.has(n));code.writeInt32LE(labels.get(n)-o-4,o);}
  assert(code.length<0x400);b.fill(0,raw(rva),raw(rva+0x400));code.copy(b,raw(rva));
 }
 asm(0x2c00,({emit,push,call,label,jump})=>{
  label('pump');
  if(mode==='busy-title'){
   // Bounded real interpreter work before the next ordinary USER pump.
   // The existing GetTickCount clock is observed, never altered or flushed.
   call(0x40120c);emit(0x89,0xc3);label('busy');call(0x40120c);
   emit(0xff,0x05,...u32(0x403718),0x29,0xd8,0xa3,...u32(0x40371c),0x3d,...u32(1500));jump('busy',0x82);
  }
  if(mode==='title'||mode==='slow-frame'||mode==='get-only'||mode==='peek-delayed'||mode==='busy-title'||mode==='peek-only'||mode==='filtered'){
   if(mode!=='get-only'){
   // Caesar's public import pattern: PeekMessage(NULL,0,0,PM_NOREMOVE),
   // followed by GetMessage/TranslateMessage/DispatchMessage on success.
   for(const n of [0,mode==='filtered'?0x400:0,mode==='filtered'?0x400:0,0,0x403640])push(n);call(0x401334);
   emit(0x85,0xc0);jump('idle',0x84);
   emit(0xff,0x05,...u32(0x403700));
   if(mode==='peek-delayed'){
    emit(0x81,0x3d,...u32(0x403644),...u32(0x100));jump('get',0x85);
    call(0x40120c);emit(0x89,0xc3);label('delay');call(0x40120c);
    emit(0x29,0xd8,0x3d,...u32(1500));jump('delay',0x82);
   }
   if(mode==='peek-only'){emit(0x81,0x3d,...u32(0x403644),...u32(0x100));jump('idle',0x84);}
   }
   {
    label('get');for(const n of [0,0,0,0x403640])push(n);call(0x40130c);
    emit(0x85,0xc0);jump('exit',0x84);
    emit(0xff,0x05,...u32(0x403704));
    push(0x403640);call(0x401310);push(0x403640);call(0x401314);
    if(mode==='slow-frame')jump('pump');
   }
  }else if(mode==='async'){
   push(65);call(0x401338);emit(0xa9,...u32(1));jump('idle',0x84);
   // The actual native API returned this press's low bit, exactly once.
   emit(0xa3,...u32(0x40370c),0xff,0x05,...u32(0x403708));
  }
  label('idle');
  if(mode==='slow-frame'){
   // Real bounded interpreter work between frames; observe the existing
   // GetTickCount exactly as the delayed-first-pump fixture does.
   call(0x40120c);emit(0x89,0xc3);label('frame-work');call(0x40120c);
   emit(0x29,0xd8,0x3d,...u32(350));jump('frame-work',0x82);
  }else{push(5);call(0x401204);}
  jump('pump');
  label('exit');push(0);call(0x401200);emit(0xcc);
 });
 asm(0x2800,({emit,push,call,label,jump})=>{
  label('pump');emit(0xff,0x05,...u32(0x403710));
  if(mode==='sibling'){
   for(const n of [1,0,0,0,0x4036a0])push(n);call(0x401334);
   emit(0x85,0xc0);jump('idle',0x84);emit(0xff,0x05,...u32(0x403714));
  }
  label('idle');push(5);call(0x401204);jump('pump');
 });
 return b;
}
function consumerUnits(){
 const {createGuardedInput}=require('../lib/cli-guarded-input');const checks=[];
 for(const mode of ['normal','wrongthread','wrongactor','wrongmemory','lookalike','cancel','late','context','owner','retired']){
  let clock=1000,healthy=true,context=1;const buffer={},queue=[],refs={queue,buffer,tid:1,actorExports:{get_window_thread:()=>1}};
  const g=createGuardedInput({nativeDelivery:true,nativeProofRequired:true,now:()=>clock,monotonic:()=>clock,
   snapshot:()=>({healthy,refs}),captureDelivery:()=>context,validateDelivery:c=>c===context,cleanup:()=>{}});
  const owner=g.bind(),t=g.prepare({...owner,nonce:mode,reviewed:true,deadline:1500},{action:'keydown',code:65});
  const edge={hwnd:1,msg:0x100,wParam:65,lParam:1};g.consume(t,()=>queue.push(edge));
  assert.equal(g.delivered(edge),false,'host dequeue cannot confirm strict native contract');
  assert.equal(g.dequeued({...edge}),0,'lookalike object cannot acquire intent token');
  const token=g.dequeued(edge);assert(token>0);assert(!t.consumed);assert.equal(g.token(edge),token);
  const proof={buffer,actorExports:refs.actorExports,threadId:1,hwnd:1,msg:0x100,wParam:65,lParam:1,apiKind:2,remove:0};
  if(mode==='wrongactor')proof.actorExports={};if(mode==='wrongthread')proof.threadId=2;if(mode==='wrongmemory')proof.buffer={};
  if(mode==='lookalike')proof.lParam=2;if(mode==='cancel')g.release(owner.owner);
  if(mode==='late')clock=1500;if(mode==='context')context=2;if(mode==='owner')g.bind();if(mode==='retired')healthy=false;
  assert.equal(g.nativeConsumed(token,proof),mode==='normal');
  if(mode==='normal'){
   assert.equal(t.nativeMessage.nonce,mode);assert.equal(t.nativeMessage.consumption,'owner-user-return');
   assert.equal(t.nativeMessage.remove,false);assert(g.nativeConsumed(token,{...proof,remove:1}));
   const at=t.consumedAt;g.release(owner.owner);clock=2600;
   assert(g.nativeValid(token,buffer));assert(g.nativeConsumed(token,{...proof,apiKind:1,remove:1}));assert.equal(t.consumedAt,at);
   assert(!g.nativeValid(token,{}));healthy=false;assert(!g.nativeValid(token,buffer));
  }else assert(!t.consumed);
  g.close();checks.push(mode);
 }
 return checks;
}
async function consumerDiagnostic(out){
 fs.mkdirSync(out,{recursive:true});const results=[];const baseline=process.env.C3_HOST_BOUNDARY_BASELINE==='1',unitChecks=baseline?[]:consumerUnits();
 for(const mode of baseline?['filtered','sibling']:['get-only','title','title-pointer','peek-delayed','busy-title','peek-only','filtered','async','none','sibling']){
  const dir=path.join(out,mode);fs.mkdirSync(dir);
  const save=(n,v)=>fs.writeFileSync(path.join(dir,n),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
  const bytes=titleConsumerFixture(mode==='title-pointer'?'title':mode),exe=path.join(dir,'consumer.exe');fs.writeFileSync(exe,bytes);
  save('source.json',{gitSHA:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
   moduleSHA256:crypto.createHash('sha256').update(fs.readFileSync(process.env.C3_CONSUMER_WASM||'build/wine-assembly.wasm')).digest('hex'),
   fixtureSHA256:crypto.createHash('sha256').update(bytes).digest('hex'),mode,originalStarted:false});
  const wd=cp.spawn(process.execPath,['-e',`let p;const t=setTimeout(()=>{console.log('FIRED');if(p)try{process.kill(-p,'SIGTERM')}catch{}},25000);console.log('ARMED');process.stdin.on('data',b=>p=+b);process.stdin.on('end',()=>clearTimeout(t));`]);
  let wo='',we='';wd.stdout.on('data',b=>wo+=b);wd.stderr.on('data',b=>we+=b);const ww=once(wd,'close');
  while(!wo.includes('ARMED'))await pause(2);save('watchdog-arm.json',{pid:wd.pid,beforeNative:true,seconds:25});
  const reservation=net.createServer();await new Promise(r=>reservation.listen(0,'127.0.0.1',r));const port=reservation.address().port;await new Promise(r=>reservation.close(r));
  const s=startControlSession(['test/run.js','--exe='+exe,'--no-build','--threads','--real-ticks','--screen=800x600',
   '--wasm='+(process.env.C3_CONSUMER_WASM||'build/wine-assembly.wasm'),'--control-stdin','--control='+port,'--max-seconds=20','--max-batches=10000000','--stuck-after=0','--trace-thread',
   '--quiet-api','--quiet-blocks','--no-close','--public-consumer-trace='+path.join(dir,'public-consumers.jsonl')],{spawnOptions:{detached:true,env:{...process.env,WINE_PUBLIC_INPUT_TRACE:path.join(dir,'public-input.jsonl')}}});
  wd.stdin.write(String(s.child.pid));let release,rw;
  const observed=()=>s.send({action:'eval',code:`(()=>{const e=instance.exports;return {peekReturns:e.guest_read32(0x403700)>>>0,getReturns:e.guest_read32(0x403704)>>>0,asyncPressReturns:e.guest_read32(0x403708)>>>0,asyncResult:e.guest_read32(0x40370c)>>>0,siblingProgress:e.guest_read32(0x403710)>>>0,siblingMessages:e.guest_read32(0x403714)>>>0,busyReads:e.guest_read32(0x403718)>>>0,busyElapsed:e.guest_read32(0x40371c)>>>0}})()`});
  try{
   let snap;const due=Date.now()+10000;
   do{snap=await s.send({action:'snapshot'});if(snap.focusWindow?.live&&snap.windows.length>=2)break;assert(Date.now()<due);await pause(20);}while(true);
   const before=await observed(),owner=await s.send({action:'guarded-bind'}),nonce=crypto.randomUUID();
   // Independent physical release is armed before this finite intent.
   release=cp.spawn(process.execPath,['-e',`const http=require('node:http');console.log('ARMED');setTimeout(()=>{const sent=Date.now(),r=http.request('http://127.0.0.1:${port}/ctl',{method:'POST'},res=>{let b='';res.on('data',v=>b+=v);res.on('end',()=>console.log(JSON.stringify({sent,at:Date.now(),reply:JSON.parse(b)})))});r.on('error',e=>{console.error(e);process.exitCode=1});r.setTimeout(250,()=>r.destroy(Error('UP timeout')));r.end(JSON.stringify({action:'guarded-release',owner:${JSON.stringify(owner.owner)}}))},1400);`]);
   let ro='',re='';release.stdout.on('data',b=>ro+=b);release.stderr.on('data',b=>re+=b);rw=once(release,'close');
   while(!ro.includes('ARMED'))await pause(2);
   const releaseTask=(async()=>{await rw;assert.equal(release.exitCode,0);return JSON.parse(ro.trim().split('\n').at(-1));})();
   const start=Date.now(),receipt=await s.send({action:'guarded-input',cmd:mode==='title-pointer'?'mousedown:500:220':'keydown:65',guard:{...owner,nonce,reviewed:true,deadline:start+500}});
   const returnedAt=Date.now();let after=await observed();const up=await releaseTask;
   if(mode==='peek-delayed'){
    while(after.getReturns<=before.getReturns){assert(Date.now()<start+2800);await pause(10);after=await observed();}
   }
   save('intent.json',{nonce,start,deadline:start+500,returnedAt,receipt,before,after,up});
   save('release-wait.json',{exit:release.exitCode,signal:release.signalCode,actualWait:true,stdoutEOF:release.stdout.readableEnded,stderrEOF:release.stderr.readableEnded,stdout:ro,stderr:re});
   assert(after.siblingProgress>before.siblingProgress,'unrelated actual CPUWorker progresses');
   assert(up.reply.ok&&up.reply.value.released);assert(up.at<start+1750,'independent physical UP deadline');
   assert(Date.now()<start+3000,'finite diagnostic completion');
   assert(s.output().includes('spawned WORKER thread'),'actual CPUWorker required');
   if(mode==='get-only'||mode==='title'||mode==='title-pointer'){assert(receipt.consumed);assert(returnedAt<start+500);assert(after.getReturns>before.getReturns);}
   if(mode==='peek-delayed'){assert(receipt.consumed);assert.equal(receipt.nativeMessage.apiKind,2);assert.equal(receipt.nativeMessage.remove,false);assert(after.getReturns>before.getReturns);}
   if(mode==='peek-only'){assert(receipt.consumed);assert(after.peekReturns>before.peekReturns);assert.equal(after.getReturns,before.getReturns);}
   if(mode==='async'){assert(!receipt.consumed);assert(after.asyncPressReturns>before.asyncPressReturns);assert.equal(after.asyncResult,0x8001);}
   if(mode==='none')assert(!receipt.consumed);
   if(mode==='busy-title'){assert(!receipt.consumed);assert(after.busyReads>before.busyReads);assert(after.busyElapsed<1500);}
   if(mode==='sibling'||mode==='filtered'){assert.equal(receipt.consumed,baseline);assert.equal(after.getReturns,before.getReturns);}
   if(receipt.consumed&&!baseline){assert.equal(receipt.nativeMessage.consumption,'owner-user-return');assert.equal(receipt.nativeMessage.nonce,nonce);assert(receipt.nativeMessage.token>0);assert.equal(receipt.nativeMessage.threadId,snap.focusWindow.threadId);}
   const row={mode,receipt,before,after,elapsedMs:returnedAt-start,
    diagnosis:mode==='peek-only'?'exact owner PM_NOREMOVE return; no claim of removal':mode==='filtered'?'filtered query cannot acknowledge excluded edge':mode==='sibling'?'sibling cannot acknowledge owner edge':mode==='async'?'actual native async press return has no intent confirmation route':mode==='none'?'nonconsumer correctly unconfirmed':mode==='busy-title'?'bounded interpreter work still active at confirmation deadline':'title-style Peek/Get native positive',
    safeForOriginal:false};save('diagnosis.json',row);results.push(row);
  }finally{
   if(s.child.exitCode===null&&s.child.signalCode===null)process.kill(-s.child.pid,'SIGTERM');await s.exited;
   if(release&&release.exitCode===null){release.kill();await rw;}
   save('native-wait.json',{pid:s.child.pid,exit:s.child.exitCode,signal:s.child.signalCode,actualWait:true,stdoutEOF:s.child.stdout.readableEnded,stderrEOF:s.child.stderr.readableEnded,hostCleanup:true,nativeQuit:false});
   // Join the independent watchdog before checking trace assertions too.
   // An assertion failure must not leave its stdin keeping this process alive.
   fs.writeFileSync(path.join(dir,'native.log'),s.output());wd.stdin.end();const [exit,signal]=await ww;
   save('watchdog-wait.json',{exit,signal,actualWait:true,stdoutEOF:wd.stdout.readableEnded,stderrEOF:wd.stderr.readableEnded,stdout:wo,stderr:we});assert.equal(exit,0);
   const observations=fs.readFileSync(path.join(dir,'public-consumers.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
   assert(observations.length<=8192+4096+1,'bounded public observer including passive readiness records');
   assert(observations.some(r=>r.phase==='entry'&&r.name==='CreateWindowExA'&&r.threadId===1),'observe startup before intent');
   assert(observations.filter(r=>r.phase==='handler-exit').every(r=>r.receipt===false&&r.callbackReturn==='unmeasured'),'public observation cannot invent receipt');
   assert.equal(observations.at(-1).phase,'summary');
   save('observer-assertions.json',{pass:true,rows:observations.length,startupObserved:true,neverReceipt:true});
  }
 }
 fs.writeFileSync(path.join(out,'diagnostic.json'),JSON.stringify({diagnosticCompleted:true,baseline,contractPassed:!baseline,safeForOriginal:false,originalStarted:false,unitChecks,results},null,2)+'\n');
}
function textFixture(){
 const b=titleConsumerFixture('title'),raw=r=>r-0x1000+0x400,u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];
 const a=[],labels=new Map(),fix=[];const emit=(...v)=>a.push(...v),push=n=>emit(0x68,...u32(n));
 const label=n=>labels.set(n,a.length),jump=(n,c)=>{emit(...(c?[0x0f,c]:[0xe9]));fix.push([a.length,n]);emit(0,0,0,0);};
 emit(0x55,0x89,0xe5,0x81,0x7d,12,...u32(0x100));jump('char',0x85);
 emit(0x83,0x7d,16,67);jump('default',0x85);push(0x403200);jump('text');
 label('char');emit(0x81,0x7d,12,...u32(0x102));jump('default',0x85);
 emit(0x83,0x7d,16,67);jump('default',0x85);push(0x403240);
 label('text');emit(0xff,0x75,8,0xff,0x15,...u32(0x40131c),0x31,0xc0,0xc9,0xc2,16,0);
 label('default');for(const n of [20,16,12,8])emit(0xff,0x75,n);emit(0xff,0x15,...u32(0x401318),0xc9,0xc2,16,0);
 const code=Buffer.from(a);for(const[o,n]of fix)code.writeInt32LE(labels.get(n)-o-4,o);assert(code.length<0x400);
 b.fill(0,raw(0x2400),raw(0x2800));code.copy(b,raw(0x2400));
 b.write('KEYDOWN C only\0',raw(0x3200));b.write('WM_CHAR C observed\0',raw(0x3240));return b;
}
async function textBoundary(out){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(path.join(out,n),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
 const exe=path.join(out,'text.exe'),bytes=textFixture();fs.writeFileSync(exe,bytes);
 const wd=cp.spawn(process.execPath,['-e',`let p;const t=setTimeout(()=>{console.log('FIRED');if(p)try{process.kill(-p,'SIGTERM')}catch{}},25000);console.log('ARMED');process.stdin.on('data',b=>p=+b);process.stdin.on('end',()=>clearTimeout(t));`]);
 let wo='',we='';wd.stdout.on('data',b=>wo+=b);wd.stderr.on('data',b=>we+=b);const ww=once(wd,'close');
 while(!wo.includes('ARMED'))await pause(2);save('watchdog-arm.json',{pid:wd.pid,beforeNative:true,seconds:25});
 const reservation=net.createServer();await new Promise(r=>reservation.listen(0,'127.0.0.1',r));const port=reservation.address().port;await new Promise(r=>reservation.close(r));
 const s=startControlSession(['test/run.js','--exe='+exe,'--no-build','--threads','--real-ticks','--screen=800x600','--control-stdin','--control='+port,'--max-seconds=20','--max-batches=10000000','--stuck-after=0','--quiet-api','--quiet-blocks','--trace-thread','--no-close',
  '--trace-api=PeekMessageA,GetMessageA,TranslateMessage,DispatchMessageA','--trace-to=10000','--public-consumer-trace='+path.join(out,'public-consumers.jsonl')],{spawnOptions:{detached:true}});
 wd.stdin.write(String(s.child.pid));let release,rw;
 try{
  let snap;const due=Date.now()+10000;
  do{snap=await s.send({action:'snapshot'});if(snap.focusWindow?.live&&snap.windows.length>=2)break;assert(Date.now()<due);await pause(20);}while(true);
  const owner=await s.send({action:'guarded-bind'});
  release=cp.spawn(process.execPath,['-e',`const http=require('node:http');console.log('ARMED');setTimeout(()=>{const sent=Date.now(),r=http.request('http://127.0.0.1:${port}/ctl',{method:'POST'},res=>{let b='';res.on('data',v=>b+=v);res.on('end',()=>console.log(JSON.stringify({sent,at:Date.now(),reply:JSON.parse(b)})))});r.on('error',e=>{console.error(e);process.exitCode=1});r.setTimeout(250,()=>r.destroy(Error('UP timeout')));r.end(JSON.stringify({action:'guarded-release',owner:${JSON.stringify(owner.owner)}}))},1400);`]);
  let ro='',re='';release.stdout.on('data',b=>ro+=b);release.stderr.on('data',b=>re+=b);rw=once(release,'close');
  while(!ro.includes('ARMED'))await pause(2);save('release-arm.json',{pid:release.pid,beforeDown:true});
  const start=Date.now(),nonce=crypto.randomUUID();
  const down=await s.send({action:'guarded-input',cmd:'keydown:67',guard:{...owner,nonce,reviewed:true,deadline:start+500}});
  assert(down.consumed&&Date.now()<start+500);assert.equal(down.nativeMessage.msg,0x100);
  await rw;assert.equal(release.exitCode,0);const up=JSON.parse(ro.trim().split('\n').at(-1));
  save('release-wait.json',{pid:release.pid,exit:release.exitCode,actualWait:true,stdoutEOF:release.stdout.readableEnded,stderrEOF:release.stderr.readableEnded,stdout:ro,stderr:re});
  assert(up.reply.ok&&up.reply.value.released&&up.at<start+1750);
  const caption=async()=>{const v=await s.send({action:'snapshot'});return v.windows.find(w=>w.hwnd===v.mainHwnd).title;};
  let text;do{text=await caption();if(text==='KEYDOWN C only')break;assert(Date.now()<start+2800);await pause(10);}while(true);
  save('keydown.json',{start,down,up,at:Date.now(),caption:text,physicalKeyIsNotCharacter:true});
  await assert.rejects(s.send({action:'guarded-input',cmd:'keypress:67',guard:{...owner,nonce:crypto.randomUUID(),reviewed:true,deadline:Date.now()+500}}),/unsupported guarded input/);
  assert.equal(await caption(),'KEYDOWN C only');
  // Unarmed reference on authored code only: proves WM_CHAR and its real
  // native callback work. This is deliberately NOT a guarded confirmation.
  await s.send({cmd:'keypress:67'});const charDue=Date.now()+3000;
  do{text=await caption();if(text==='WM_CHAR C observed')break;assert(Date.now()<charDue);await pause(10);}while(true);
  assert(s.output().includes('spawned WORKER thread'));
  save('assertions.json',{pass:true,originalStarted:false,actualCPUWorker:true,fixtureSHA256:crypto.createHash('sha256').update(bytes).digest('hex'),
   physicalKeydownConfirmed:true,physicalKeydownProducesNoCharacter:true,guardedCharacterRefusedBeforeEffect:true,
   ordinaryNativeWMCharCallbackPositive:true,characterReceiptQualified:false,referenceCaption:text});
 }finally{
  if(s.child.exitCode===null&&s.child.signalCode===null)process.kill(-s.child.pid,'SIGTERM');await s.exited;
  if(release&&release.exitCode===null){release.kill();await rw;}
  save('native-wait.json',{pid:s.child.pid,exit:s.child.exitCode,signal:s.child.signalCode,actualWait:true,stdoutEOF:s.child.stdout.readableEnded,stderrEOF:s.child.stderr.readableEnded,hostCleanup:true,nativeQuit:false});
  fs.writeFileSync(path.join(out,'native.log'),s.output());wd.stdin.end();const[exit,signal]=await ww;
  save('watchdog-wait.json',{exit,signal,actualWait:true,stdoutEOF:wd.stdout.readableEnded,stderrEOF:wd.stderr.readableEnded,stdout:wo,stderr:we});assert.equal(exit,0);
 }
}
if(require.main===module)(process.argv[2]==='--adapter-shutdown'?adapterShutdown(path.resolve(process.argv[3])):process.argv[2]==='--hover-fixtures'?hoverFixtures(path.resolve(process.argv[3])):process.argv[2]==='--input-readiness-fixture'?inputReadinessFixture(path.resolve(process.argv[3])):process.argv[2]==='--controller-fixtures'?controllerFixtures(path.resolve(process.argv[3])):process.argv[2]==='--personal-fixture'?reviewedController(path.resolve(process.argv[3]),false,false,true):process.argv[2]==='--text-diagnostic'?textBoundary(path.resolve(process.argv[3])):process.argv[2]==='--consumer-diagnostic'?consumerDiagnostic(path.resolve(process.argv[3])):main(path.resolve(process.argv[2]))).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={keyboard,main,titleConsumerFixture,consumerDiagnostic,consumerUnits,textFixture,textBoundary,reuseProofUnits};
