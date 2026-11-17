'use strict';
// Authored controls only. Synthetic attestation here never authorizes an original.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const cp=require('node:child_process'),net=require('node:net'),crypto=require('node:crypto');
const {once}=require('node:events'),{startControlSession}=require('./control-session');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
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
async function reviewedController(out,late=false){
 fs.mkdirSync(out);const save=(n,v)=>fs.writeFileSync(path.join(out,n),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
 fs.copyFileSync(path.join(out,'../../runtime-inputs.json'),path.join(out,'runtime-inputs.json'));
 const image=path.join(out,'reviewed.exe');fs.writeFileSync(image,require('./test-cli-native-button-delivery.cjs').fixture(0));
 const reservation=net.createServer();await new Promise(r=>reservation.listen(0,'127.0.0.1',r));const port=reservation.address().port;await new Promise(r=>reservation.close(r));
 const invocationToken=crypto.randomUUID(),start=Date.now()/1000;
 save('launch.json',{at:start,deadline:start+240,gameplayCutoff:start+60,reserveSeconds:180,rootPort:port});
 const wd=cp.spawn(process.execPath,['-e',`let p;const t=setTimeout(()=>{if(p)try{process.kill(-p,'SIGTERM')}catch{};process.exit(2)},35000);console.log('ARMED');process.stdin.on('data',b=>p=+b);process.stdin.on('end',()=>clearTimeout(t));`]);
 let wo='',we='';wd.stdout.on('data',b=>wo+=b);wd.stderr.on('data',b=>we+=b);const ww=once(wd,'close');
 while(!wo.includes('ARMED'))await pause(2);save('watchdog-arm.json',{pid:wd.pid,beforeNative:true,seconds:35});
 const s=startControlSession(['test/run.js','--exe='+image,'--native-exit-receipt='+path.join(out,'native-exit.json'),'--native-invocation-token='+invocationToken,'--no-build','--threads','--real-ticks','--screen=800x600','--control-stdin','--control='+port,'--max-seconds=30','--max-batches=100000000','--stuck-after=0','--quiet-api','--quiet-blocks','--no-close'],{spawnOptions:{detached:true}});
 wd.stdin.write(String(s.child.pid));
 const st=fs.readFileSync('/proc/'+s.child.pid+'/stat','utf8'),info={pid:s.child.pid,startToken:st.slice(st.lastIndexOf(')')+2).split(' ')[19],invocationToken,bootId:fs.readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim()};save('native-pid.json',info);
 s.child.once('close',(exit,signal)=>save('native-wait.json',{...info,exit,signal,actualWait:true,disposition:'normal',atWait:Date.now()/1000,atWaitMono:Number(process.hrtime.bigint())/1e9,stdoutEOF:s.child.stdout.readableEnded,stderrEOF:s.child.stderr.readableEnded}));
 let seq=0;
 async function control(args,expected=0){
  const c=cp.spawn('python3',['-B','tools/caesar3-current-native.py','control',...args],{env:{...process.env,CAESAR3_RUN:out},timeout:7000});let a='',b='';c.stdout.on('data',v=>a+=v);c.stderr.on('data',v=>b+=v);const [exit,signal]=await once(c,'close');
  save('controller-'+(++seq)+'-wait.json',{args,pid:c.pid,exit,signal,actualWait:true,stdoutEOF:c.stdout.readableEnded,stderrEOF:c.stderr.readableEnded,stdout:a,stderr:b});
  if(expected===0)assert.equal(exit,0,a+b);else assert.notEqual(exit,0);
 }
 try{
  let snap;const end=Date.now()+15000;do{snap=await s.send({action:'snapshot'});if(snap.focusWindow?.live&&snap.windows.length>=2)break;assert(Date.now()<end);await pause(20);}while(true);
  if(late){
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
   await control(['bind','before']);await control(['intent','click','before','500','220','install']);
   const rr=JSON.parse(fs.readFileSync(path.join(out,'click-observed.json')));
   assert.equal(rr.snapshot.windows.find(w=>w.hwnd===snap.mainHwnd).title,'UP after DOWN');
   await control(['review','click-observed','Authored test only: release completed, ordinary Escape key route exits fixture.','Escape','quit',rr.snapshot.focus]);
   await control(['intent','quit','click-observed','-1','27','quit']);
   assert(JSON.parse(fs.readFileSync(path.join(out,'quit-native-quit.json'))).proven);
   save('assertions.json',{pass:true,exactController:true,nativePointer:true,nativeKeyboard:true,nativeQuit:true,syntheticAuthoredAttestation:true});
  }
 }finally{
  if(s.child.exitCode===null&&s.child.signalCode===null)process.kill(-s.child.pid,'SIGTERM');await s.exited;
  fs.writeFileSync(path.join(out,'native.log'),s.output());wd.stdin.end();const [exit,signal]=await ww;save('watchdog-wait.json',{exit,signal,actualWait:true,stdoutEOF:wd.stdout.readableEnded,stderrEOF:wd.stderr.readableEnded,stdout:wo,stderr:we});assert.equal(exit,0);
 }
}
async function main(out){
 fs.mkdirSync(out,{recursive:true});
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
 await reviewedController(path.join(out,'controller'));
 await reviewedController(path.join(out,'late-controller'),true);
 fs.writeFileSync(path.join(out,'assertions.json'),JSON.stringify({pass:true,originalStarted:false,sealedManifest:globalThis.__disciples2Manifest}));
}
if(require.main===module)main(path.resolve(process.argv[2])).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={keyboard,main};
