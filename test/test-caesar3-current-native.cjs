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
async function reviewedController(out,late=false){
 fs.mkdirSync(out);const save=(n,v)=>fs.writeFileSync(path.join(out,n),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
 fs.copyFileSync(path.join(out,'../../runtime-inputs.json'),path.join(out,'runtime-inputs.json'));
 const image=path.join(out,'reviewed.exe');fs.writeFileSync(image,controllerFixture());
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
 await consumerDiagnostic(path.join(out,'consumer'));
 await reviewedController(path.join(out,'controller'));
 await reviewedController(path.join(out,'late-controller'),true);
 fs.writeFileSync(path.join(out,'assertions.json'),JSON.stringify({pass:true,originalStarted:false,sealedManifest:globalThis.__disciples2Manifest}));
}
// Authored consumer diagnostic also runs in full qualification. Running it alone
// never qualifies or authorizes an original-game launch.
// Authored x86 records API returns; no original private memory is inspected.
function titleConsumerFixture(mode){
 assert(['title','get-only','peek-delayed','busy-title','peek-only','filtered','async','none','sibling'].includes(mode));
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
  if(mode==='title'||mode==='get-only'||mode==='peek-delayed'||mode==='busy-title'||mode==='peek-only'||mode==='filtered'){
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
   }
  }else if(mode==='async'){
   push(65);call(0x401338);emit(0xa9,...u32(1));jump('idle',0x84);
   // The actual native API returned this press's low bit, exactly once.
   emit(0xa3,...u32(0x40370c),0xff,0x05,...u32(0x403708));
  }
  label('idle');push(5);call(0x401204);jump('pump');
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
   '--quiet-api','--quiet-blocks','--no-close'],{spawnOptions:{detached:true,env:{...process.env,WINE_PUBLIC_INPUT_TRACE:path.join(dir,'public-input.jsonl')}}});
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
   fs.writeFileSync(path.join(dir,'native.log'),s.output());wd.stdin.end();const [exit,signal]=await ww;
   save('watchdog-wait.json',{exit,signal,actualWait:true,stdoutEOF:wd.stdout.readableEnded,stderrEOF:wd.stderr.readableEnded,stdout:wo,stderr:we});assert.equal(exit,0);
  }
 }
 fs.writeFileSync(path.join(out,'diagnostic.json'),JSON.stringify({diagnosticCompleted:true,baseline,contractPassed:!baseline,safeForOriginal:false,originalStarted:false,unitChecks,results},null,2)+'\n');
}
if(require.main===module)(process.argv[2]==='--consumer-diagnostic'?consumerDiagnostic(path.resolve(process.argv[3])):main(path.resolve(process.argv[2]))).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={keyboard,main,titleConsumerFixture,consumerDiagnostic,consumerUnits};
