'use strict';
// Self-contained authored native USER consumer; never loads FoxBear media.
// Automated fixture reviews do not satisfy the personal workflow gate.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net'),cp=require('node:child_process');
const common=require('../tools/native-supervisor-common.cjs');
const out=path.resolve(process.argv[3]||fs.mkdtempSync(path.join(os.tmpdir(),'foxbear-input-')));
async function body(){
 const a=require('../tools/foxbear-reviewed-run.cjs');fs.mkdirSync(out,{recursive:true});a.R=out;
 const boundaryCase=process.env.FOXBEAR_BOUNDARY_CASE;
 const exe=path.join(out,'authored.exe');
 const animated=!boundaryCase || ['old-paint','new-paint'].includes(boundaryCase);
 fs.writeFileSync(exe,animated ? require('./test-disciples2-native-paint-binding.cjs').fixture('repaint') :
   require('./test-cli-native-button-delivery.cjs').fixture(boundaryCase==='queued-expiry'?10000:0));
 const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
 a.URL='http://127.0.0.1:'+port+'/ctl';Object.assign(process.env,{FOXBEAR_CONTROL_OUT:out,FOXBEAR_CONTROL_URL:a.URL});
 const now=common.now();a.save('launch.json',{at:now,deadline:now+240,gameplayCutoff:now+60,reserveSeconds:180,nativeScene:true,
 bindingContract:boundaryCase==='old-paint'?'native-scene-v1':'native-reviewed-context-v1',
 inputPolicy:{confirmationMs:500,physicalUpMs:1750,observationMs:3000,gameFreshnessSeconds:5,menuFreshnessSeconds:30}});
 assert(common.freeBytes()>1500000000,'actual home disk floor');
 const frozen=process.env.FOXBEAR_NATIVE_MODULE ? require('../tools/blood2-immutable-preparation.cjs').freeze(
   require('../tools/blood2-immutable-preparation.cjs').collect([],{revision:process.env.FOXBEAR_NATIVE_REVISION}),
   fs.readFileSync(process.env.FOXBEAR_NATIVE_MODULE)) : null;
 if(frozen)a.save('frozen-native.json',{revision:process.env.FOXBEAR_NATIVE_REVISION,moduleSHA256:common.sha256(fs.readFileSync(process.env.FOXBEAR_NATIVE_MODULE)),sourceSHA256:frozen.sourceSHA256,indexSHA256:frozen.indexSHA256});
 const watcher=cp.spawn(process.execPath,[__filename,'--watch',out],{stdio:['ignore','pipe','pipe']}),watchWait=common.communicate(watcher);
 while(!fs.existsSync(path.join(out,'disk-watch-armed.json')))await common.sleep(5);
 const p=cp.spawn(process.execPath,['test/run.js','--exe='+exe,'--no-build','--threads','--real-ticks','--live-present','--screen=1024x712','--max-seconds=35','--max-batches=10000000','--control='+port,'--quiet-api','--quiet-blocks','--no-close'],{cwd:path.resolve(__dirname,'..'),env:{...(frozen?frozen.env:process.env),WINE_PUBLIC_INPUT_TRACE:path.join(out,'native-input-trace.jsonl')},stdio:frozen?common.stdioWithFds(frozen.fds):['ignore','pipe','pipe']});
 const waited=common.communicate(p);a.save('native-pid.json',{pid:p.pid,startToken:common.token(p.pid),at:common.now()});
 async function review(name){await a.capture(name);const rr=a.read(name+'.json');a.save(name+'-review.json',{at:common.now(),pngSHA256:rr.pngSHA256,scene:'game',targetHwnd:rr.snapshot.focus,wholeFrame:true,observation:'Automated authored test fixture only'});}
 try{
  const end=Date.now()+15000;for(;;){try{const s=await a.call({action:'snapshot'},.5);if(s.mainHwnd!=='0x0'&&s.focusWindow.live&&s.physicalUp)break;}catch{}assert(Date.now()<end,'authored startup');await common.sleep(25);}
  while(await a.call({action:'eval',code:'Object.keys(renderer.windows).length'})<2){assert(Date.now()<end,'public renderer window publication');await common.sleep(25);}
  await common.sleep(250);
  await review('binding');
  const decoded=require('pngjs').PNG.sync.read(fs.readFileSync(path.join(out,'binding.png'))),colors=new Set();
  for(let i=0;i<decoded.data.length;i+=4)colors.add(decoded.data.readUInt32LE(i));
  // The queued-expiry negative deliberately blocks the first native USER
  // pump, including WM_PAINT. It proves cancellation only, never scene review.
  if(boundaryCase!=='queued-expiry')assert(colors.size>8,'complete native window must be visibly painted before review');
  if(animated){
   await common.sleep(650);await a.capture('advanced');
   const before=a.read('binding.json').pngSHA256,after=common.sha256(fs.readFileSync(path.join(out,'advanced.png')));
   const next=require('pngjs').PNG.sync.read(fs.readFileSync(path.join(out,'advanced.png'))),nextColors=new Set();
   for(let i=0;i<next.data.length;i+=4)nextColors.add(next.data.readUInt32LE(i));
   assert(nextColors.size>8,'advanced reviewed capture must retain the painted native window');
   assert.notEqual(before,after,'actual native GDI animation must change complete encoded paint');
   a.save('animated-paint.json',{before,after,realNativeRepaint:true});
  }
  if(boundaryCase==='old-paint'){
   await assert.rejects(a.bind('binding'),/reviewed native paint changed/);
   assert(a.read('terminal-input-failure.json').noReplay);
   a.save('assertions.json',{pass:true,oldPaintFailed:true,zeroInputs:true});return;
  }
  await a.bind('binding');
  const boundary=process.env.FOXBEAR_BOUNDARY_CASE;
  if(boundary && boundary!=='new-paint'){
   await review('boundarybefore');const rr=a.read('boundarybefore.json'),expiry=rr.at+5;
   if(boundary==='replay'){
    const original=common.postJSON;let sent;
    common.postJSON=async(...args)=>{if(args[1].action==='guarded-input')sent=structuredClone(args[1]);return original(...args);};
    try{await a.pulse('once',['keydown:102'],100,'boundarybefore','Authored one-use reviewed native frame');}finally{common.postJSON=original;}
    assert(a.read('once-down.json')[0].consumed);await assert.rejects(a.call(sent),/nonce/);
    a.fail('duplicate native nonce refused; authored terminal control','replay');
    let calls=0;common.postJSON=async()=>{calls++;throw Error('closed endpoint');};
    try{await assert.rejects(a.capture('afterreplay'),/sticky UNKNOWN/);}finally{common.postJSON=original;}
    assert.equal(calls,0);a.save('boundary-assertions.json',{pass:true,boundary,originalConsumed:true,replayRefused:true,laterEndpointCalls:0});return;
   }
   const post=common.postJSON;let receipt,returnedAt,dispatchAt,calls=0,afterDown=false;
   if(['crossing','expired-delivery'].includes(boundary)){
    // Real elapsed capture age, never an edited capture/review timestamp.
    while(common.now()<expiry-.350)await common.sleep(2);
   }
   if(boundary==='target'){
    const child=rr.snapshot.windows.find(w=>w.live&&w.isChild);assert(child);
    await a.call({action:'eval',code:'instance.exports.set_focus('+parseInt(child.hwnd,16)+');true'});
   }
   common.postJSON=async(...args)=>{
    const cmd=args[1];calls++;
    if(cmd.action==='guarded-input'){
     dispatchAt=common.now();
     if(boundary==='queued-expiry')cmd.guard.deadline=Math.trunc(Date.now()+150);
     if(boundary==='wrong-epoch')cmd.guard.epoch++;
     if(boundary==='wrong-frame')cmd.guard.intent.review.captureId='unretained-native-frame';
     if(boundary==='wrong-hash')cmd.guard.intent.review.pngSHA256='0'.repeat(64);
     if(boundary==='wrong-window')cmd.guard.intent.review.targetHwnd='0x7777';
     if(boundary==='expired-delivery')while(common.now()<expiry+.030)await common.sleep(2);
     const value=await post(...args);receipt=value.value;afterDown=true;
     if(boundary==='crossing')while(common.now()<expiry+.030)await common.sleep(2);
     if(boundary==='late-confirmation')await common.sleep(600);
     if(boundary==='late-up')setTimeout(()=>post(a.URL,{action:'eval',code:'(()=>{const until=Date.now()+1900;while(Date.now()<until){};return true})()'},3).catch(()=>{}),600);
     returnedAt=common.now();return value;
    }
    const v=await post(...args);
    if(boundary==='late-operation'&&afterDown&&cmd.action==='snapshot')await common.sleep(3100);
    return v;
   };
   let result,error;
   try{result=await a.pulse('boundary',['keydown:102'],['crossing','late-up'].includes(boundary)?1000:100,'boundarybefore','Automated compiled-native boundary control');}catch(e){error=e.message;}
   finally{common.postJSON=post;}
   if(boundary==='crossing'){
    if(process.env.FOXBEAR_EXPECT_OLD){assert.match(result,/NOT_SENT/);assert.equal(receipt,undefined);}
    else{
     assert(!error,error);assert(receipt.consumed);assert(receipt.consumedAt<Math.trunc(expiry*1000));
     assert(returnedAt>expiry);assert(returnedAt-dispatchAt<=.5);assert.equal(a.read('boundary-up.json').state,'ACK');
     assert(a.read('boundary-up.json').at-dispatchAt<=1.75);assert(a.read('boundary.json').completedAt<a.read('boundary-operation.json').deadline);
    }
   }else{
    assert(error,'postdispatch fault must close');assert(a.read('terminal-input-failure.json').noReplay);
    if(['expired-delivery','target','queued-expiry'].includes(boundary)){
     assert.equal(receipt.state,'CANCELLED');assert.equal(receipt.consumed,false);assert.equal(receipt.handlerApplied,boundary==='queued-expiry');
     assert.equal(receipt.consumedAt,null);assert.equal(a.read('boundary-up.json').state,'ACK');
    }
    if(boundary==='late-up'){assert.match(error,/independent release failed/);assert.equal(a.read('boundary-up.json').state,'UNKNOWN');}
    if(boundary==='late-confirmation')assert.match(error,/500ms confirmation exceeded/);
    if(boundary==='late-operation')assert.match(error,/3000ms operation completion/);
    let laterCalls=0;common.postJSON=async()=>{laterCalls++;throw Error('closed endpoint called');};
    try{await assert.rejects(a.capture('afterclosed'),/sticky UNKNOWN/);await assert.rejects(a.bind('binding'),/sticky UNKNOWN/);await assert.rejects(a.pulse('again',['keydown:102'],100,'boundarybefore','closed'),/sticky UNKNOWN/);}finally{common.postJSON=post;}
    assert.equal(laterCalls,0);
    if(boundary==='queued-expiry'){
     // Leave the real ten-second guest pump alive past rejection, with no
     // further endpoint request. The exact queued DOWN was purged.
     while(common.now()<now+12)await common.sleep(20);
     const traces=fs.readFileSync(path.join(out,'native-input-trace.jsonl'),'utf8').trim().split('\n').map(s=>JSON.parse(s));
     const rows=traces.flatMap(t=>t.rows||[]);
     assert(rows.some(r=>r.phase==='purge-after'&&r.queue.head.every(e=>e.msg!==0x100)));
     assert(!rows.some(r=>r.phase==='native-input-return-candidate'));
    }
   }
   a.save('boundary-assertions.json',{pass:true,boundary,old:!!process.env.FOXBEAR_EXPECT_OLD,expiry,dispatchAt,returnedAt,receipt,error,result,calls,realElapsedCapture:true});return;
  }
  for(const [name,key]of [['crouch',98],['apple',99],['right',100],['stop',101],['left',102],['jump',103],['quitkey',123]]){
   await a.capture(name+'before');await a.submit({name,key,ms:100,review:name+'before',scene:'game',observation:'Automated authored test fixture only'});
   const down=a.read(name+'-down.json')[0],up=a.read(name+'-up.json');assert(down.consumed&&down.nativeMessage.wParam===key);assert.equal(down.receiptBoundary,'native-input-return');assert.equal(down.nativeMessage.consumption,'owner-user-return');assert.equal(up.state,'ACK');assert(up.at-down.consumedAt/1000<1.75);
  }
  await a.capture('stalebefore');const stale=a.read('stalebefore.json');
  while(common.now()<stale.at+5.030)await common.sleep(10);
  const postStale=common.postJSON;let staleDown=0;common.postJSON=async(...args)=>{if(args[1].action==='guarded-input')staleDown++;return postStale(...args);};
  assert.match(await a.submit({name:'stale',key:99,ms:100,review:'stalebefore',scene:'game',observation:'Automated expired capture test'}),/NOT_SENT/);common.postJSON=postStale;assert.equal(staleDown,0);assert(!fs.existsSync(path.join(out,'stale-armed.json')));assert.equal(a.read('stale-rejection.json').state,'NOT_SENT');
  // A real consumption followed by a deliberately lost reply is terminal.
  await review('lostbefore');const post=common.postJSON;let lost=false;
  common.postJSON=async(...args)=>{const value=await post(...args);if(args[1].action==='guarded-input'){lost=true;throw Error('authored lost ACK after native return');}return value;};
  await assert.rejects(a.pulse('lost',['keydown:99'],100,'lostbefore','authored ACK loss'),/lost ACK/);common.postJSON=post;
  assert(lost&&a.read('terminal-input-failure.json').noReplay);assert.equal(a.read('lost-up.json').state,'ACK');
  let calls=0;common.postJSON=async()=>{calls++;throw Error('closed endpoint called');};
  await assert.rejects(a.capture('afterunknown'),/sticky UNKNOWN/);assert.equal(calls,0);common.postJSON=post;
  a.save('assertions.json',{pass:true,nativeFoxBearNumpadAndF12:true,staleNotSent:true,independentUP:true,lostAckClosed:true,noLaterEndpoint:true});
 }finally{
  p.kill('SIGTERM');const wait=await waited;a.save('native-wait.json',{exit:wait.returncode,actualWait:true,stdoutEOF:p.stdout.readableEnded,stderrEOF:p.stderr.readableEnded,stdout:wait.stdout.toString(),stderr:wait.stderr.toString()});
  const w=await watchWait;a.save('disk-watch-wait.json',{pid:watcher.pid,exit:w.returncode,actualWait:true,stdoutEOF:watcher.stdout.readableEnded,stderrEOF:watcher.stderr.readableEnded});
  if(frozen)frozen.close();
  assert(p.stdout.readableEnded&&p.stderr.readableEnded);assert.equal(wait.returncode,0);assert.equal(w.returncode,0);
 }
}
async function main(){
 if(process.argv[2]==='--watch'){
  const deadline=common.now()+50;common.save(out,'disk-watch-armed.json',{pid:process.pid,deadline,at:common.now()});let min=common.freeBytes(),reason;
  for(;;){min=Math.min(min,common.freeBytes());if(fs.existsSync(path.join(out,'native-wait.json'))){reason='actual-native-wait';break;}
   if(min<1500000000||common.now()>=deadline){reason=min<1500000000?'disk-floor':'finite-deadline';
    if(fs.existsSync(path.join(out,'native-pid.json'))){const p=common.readJSON(path.join(out,'native-pid.json'));if(common.token(p.pid)===p.startToken)try{process.kill(p.pid,'SIGTERM');}catch{}}
    break;}await common.sleep(50);
  }common.save(out,'disk-watch-exit.json',{reason,minFreeBytes:min,at:common.now()});return;
 }
 if(process.argv[2]==='--body')return body();fs.mkdirSync(out,{recursive:true});const r=await require('../tools/native-supervise.cjs').supervise(path.join(out,'containment'),[process.execPath,__filename,'--body',path.join(out,'native')],{deadline:common.now()+55,cleanup_deadline:common.now()+65,grace:2});assert.equal(r.exit,0);assert.equal(r.leaked,false);console.log(JSON.stringify({pass:true,out}));}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
