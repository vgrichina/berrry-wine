'use strict';
// Offline contract/composition tests: no Chrome or original game attempt.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const api=require('../tools/stronghold-local-runtime.cjs'),base=require('../tools/stronghold-preset-driver-attachment.cjs');
const run=path.resolve(process.env.STRONGHOLD_CONTRACT_RUN||'scratch/runs/20261104-stronghold-named-observation-gameplay/contract-test');
fs.mkdirSync(run,{recursive:true});
const pins=path.join(run,'pins.json');
fs.writeFileSync(pins,JSON.stringify({files:['build/wine-assembly.wasm','build/wine-assembly.compat.wasm'].map(file=>({path:file,sha256:base.hash(fs.readFileSync(file))}))}));
const nonce='a'.repeat(64),now=Date.parse('2026-11-04T17:45:00Z');
const actualOwn='2026-11-04T21:47:12+00:00 mdk2-honest-menu OWN tools/mdk2-local-runtime.cjs docs/re-notes/mdk2-honest-menu-medium-gameplay-20261104.md';
const actualRelease='2026-11-04T21:49:05+00:00 mdk2-honest-menu LOCAL HEAVY RELEASE mdk2-honest-menu-medium-gameplay-nov04 offline fixture only';
const fixtureBoard=actualOwn+'\n'+actualRelease,fixtureNow=Date.parse('2026-11-04T21:50:00Z');
assert.equal(api.requireRuntimeRelease(fixtureBoard,fixtureNow).row,actualRelease);
for(const line of [actualRelease,fixtureBoard.replaceAll('mdk2-honest-menu','someone'),fixtureBoard.replace('LOCAL HEAVY RELEASE mdk2-honest-menu-medium-gameplay-nov04','LOCAL HEAVY RELEASE mdk2-measured-native-boundary-gameplay-nov04'),fixtureBoard.replace('21:49:05','21:47:11'),fixtureBoard.replace('21:49:05','22:53:05'),fixtureBoard.replace('21:47:12','21:47:11'),actualOwn+'\n2026-11-04T21:49:00Z stronghold waiting '+actualRelease,actualOwn+'\n'+actualRelease.replace('mdk2-honest-menu LOCAL','mdk2-measured-native LOCAL'),actualOwn+'\n'+actualRelease.replace('-nov04 offline','-nov04-extra offline')])assert.throws(()=>api.requireRuntimeRelease(line,fixtureNow),/release/);
assert.throws(()=>api.requireRuntimeRelease(fixtureBoard+'\n'+actualOwn.replace('21:47:12','21:49:06'),fixtureNow),/release/,'fresh later OWN invalidates earlier release');
const lockProbe="const a=require('./tools/stronghold-local-runtime.cjs');console.log(JSON.stringify(a.requireLocalFlock(process.argv[1])))";
const testLock=path.join(run,'offline-runtime.lock');fs.writeFileSync(testLock,'');
assert.throws(()=>execFileSync(process.execPath,['-e',lockProbe,testLock],{stdio:'pipe'}),/Command failed/);
const locked=JSON.parse(execFileSync('flock',['-n',testLock,process.execPath,'-e',lockProbe,testLock],{encoding:'utf8'}));assert.equal(locked.path,testLock);assert(Number.isInteger(locked.pid));
const release=api.createRelease({run,pins,nonce,now});
assert.equal(api.validateRelease(release,{run,pins,nonce,now}),release);
assert.equal(release.identity.pid,process.pid);assert.equal(release.identity.hostname,require('os').hostname());
const negatives=[];
function reject(name,mutate,pattern=/required|identity|binding|deadline|authorization/){
 const r=structuredClone(release),o={run,pins,nonce,now};mutate(r,o);
 assert.throws(()=>api.validateRelease(r,o),pattern,name);negatives.push(name);
}
reject('missing authorization',r=>delete r.authorization);
reject('missing current authorization',r=>delete r.freshLocalDiagnosticAuthorized);
reject('foreign assignment',r=>r.assignment='foreign');
reject('previous repaired entry assignment',r=>r.assignment='stronghold-repaired-entry-original-gameplay user task');
reject('previous fresh complete assignment',r=>r.assignment='stronghold-fresh-complete-entry-gameplay user task');
reject('expired predecessor authorization',r=>r.assignment='stronghold-portable-local-runtime user task');
reject('previous title assignment',r=>r.assignment='stronghold-title-recognition-onward user task');
reject('previous menu assignment',r=>r.assignment='stronghold-menu-recognition-onward user task');
reject('previous ChooseType assignment',r=>r.assignment='stronghold-choosetype-recognition-onward user task');
reject('previous route assignment',r=>r.assignment='stronghold-route-recognition-handoff user task');
reject('previous observation-only assignment',r=>r.assignment='stronghold-current-hover-diagnostic user task');
reject('previous missed-review assignment',r=>r.assignment='stronghold-repaired-hover-native-onward user task');
reject('previous owning-discovery assignment',r=>r.assignment='stronghold-acknowledged-menu-onward user task');
reject('previous startup assignment',r=>r.assignment='stronghold-unique-owner-onward user task');
reject('foreign shutdown owner',r=>r.shutdownOwner='worker');
reject('box as local',r=>r.kind='leased-box');
reject('fake box ID',r=>r.boxId='bx_local');
reject('box TTL in local',r=>r.expiry='2026-11-05T00:00:00Z');
reject('foreign process',r=>r.identity.pid++);
reject('recycled process',r=>r.identity.startTicks+='0');
reject('foreign boot',r=>r.identity.bootId='foreign');
reject('foreign host',r=>r.identity.hostname='foreign');
reject('foreign checkout',r=>r.identity.root='/foreign');
reject('foreign run',r=>r.binding.run+='/foreign');
reject('foreign pins',r=>r.binding.pins+='.foreign');
reject('stale manifest',r=>r.binding.pinsSHA256='0'.repeat(64));
reject('stale module',r=>r.binding.modules[0].sha256='0'.repeat(64));
reject('stale nonce',r=>r.nonce='b'.repeat(64));
reject('missing nonce',(_,o)=>delete o.nonce);
reject('stale issue',(_,o)=>o.now+=60001);
reject('future issue',r=>r.issuedAt++);
reject('expired',r=>r.closeBy=now);
reject('infinite deadline',r=>r.closeBy=Infinity);
reject('extended browser cap',r=>r.closeBy=r.issuedAt+720001);
reject('extended cutoff',r=>r.chromeCutoff=api.CUTOFF+1);
reject('extended cleanup',r=>{r.cleanupBy=api.CLEANUP+1;r.expiresAt=r.cleanupBy;});
reject('insufficient runtime reserve',r=>r.chromeCutoff=r.issuedAt+719999);
reject('insufficient cleanup reserve',r=>{r.cleanupBy=r.issuedAt+899999;r.expiresAt=r.cleanupBy;});
reject('expired process contract',r=>r.expiresAt=now);
assert.equal(api.CUTOFF,Date.parse('2026-11-04T23:50:00Z'));
assert.equal(api.CLEANUP,Date.parse('2026-11-04T23:53:00Z'));
const lastStart=api.createRelease({run,pins,nonce,now:api.CUTOFF-720000});
assert.equal(lastStart.closeBy,api.CUTOFF);assert.equal(lastStart.cleanupBy-lastStart.closeBy,180000);
assert.throws(()=>api.createRelease({run,pins,nonce,now:api.CUTOFF-719999}),/deadline/);
const child=execFileSync(process.execPath,['-e',`const a=require('./tools/stronghold-local-runtime.cjs');try{a.validateRelease(${JSON.stringify(release)},${JSON.stringify({run,pins,nonce,now})});process.exit(9)}catch(e){if(!/identity/.test(e.message))throw e;console.log('foreign actual child rejected')}`],{encoding:'utf8'}).trim();
assert.equal(child,'foreign actual child rejected');
// The unchanged predecessor's leased-box branch must reject this local record.
const original=base.retained(path.resolve(base.ORIGINAL)).toString();
const boxStart=original.indexOf("  if(release.authorization!=="),boxEnd=original.indexOf("  if(fs.existsSync(OUT))",boxStart);
assert(boxStart>0&&boxEnd>boxStart);
assert.throws(()=>vm.runInNewContext(original.slice(boxStart,boxEnd),{release,Date:{now:()=>now,parse:Date.parse}}),/fresh authorized finite TTL/);
// Replay the actual command6 transport boundary without any game, pixels or
// fabricated scene acceptance. The previous client silently queued command7
// before command6's second review/ACK; the new client must expose and reject it.
const actualRun=path.resolve('scratch/runs/20261104-stronghold-repaired-hover-native-onward');
if(fs.existsSync(path.join(actualRun,'browser/cleanup.json'))){
 const status=api.mailboxStatus(actualRun);
 assert(status.terminal);assert.deepEqual(status.pending,[7]);
 assert.equal(status.review.scene,'main-menu');assert.equal(status.review.capture,'title-boundary-2.png');
 assert.equal(status.review.receiptPresent,false);
 assert.throws(()=>api.assertMailboxCommandReady(actualRun),/terminal; review main-menu/);
 const fixture=path.join(run,'review-mailbox'),out=path.join(fixture,'browser');
 fs.mkdirSync(path.join(out,'commands'),{recursive:true});fs.mkdirSync(path.join(fixture,'reviews'),{recursive:true});
 const write=(name,value)=>fs.writeFileSync(path.join(out,name),JSON.stringify(value));
 const second=JSON.parse(fs.readFileSync(path.join(actualRun,'browser/review-required.json')));
 const first=fs.readFileSync(path.join(actualRun,'personal-capture-inspections.jsonl'),'utf8').trim().split('\n').map(JSON.parse).find(r=>r.scene==='title-dialog');
 // Reset only this owned offline fixture; never an original attempt.
 for(const name of fs.readdirSync(out))if(/^reply-\d+\.json$/.test(name))fs.unlinkSync(path.join(out,name));
 for(const name of fs.readdirSync(path.join(out,'commands')))fs.unlinkSync(path.join(out,'commands',name));
 for(const name of fs.readdirSync(path.join(fixture,'reviews')))fs.unlinkSync(path.join(fixture,'reviews',name));
 write('ready.json',{fixtureOnly:true});
 for(let i=0;i<=6;i++){
  write('commands/'+i+'.json',JSON.parse(fs.readFileSync(path.join(actualRun,'browser/commands',i+'.json'))));
  if(i<6)write('reply-'+i+'.json',{i,ok:true,fixtureOnly:true});
 }
 write('review-required.json',first);
 const client=path.resolve('scratch/runs/20261104-stronghold-first-script-cause-onward/command.cjs');
 const actualClientBlocked=scene=>{
  assert.throws(()=>execFileSync(process.execPath,[client,JSON.stringify({action:'menu-crusader'}),fixture],{stdio:'pipe'}),
   error=>error.status===1&&error.stderr.toString().includes('pending command 6; review '+scene));
  assert(!fs.existsSync(path.join(out,'commands/7.json')),'actual client must leave no queued input');
 };
 actualClientBlocked('title-dialog');
 const testNow=Date.parse(first.at);
 assert.equal(api.mailboxStatus(fixture,{now:testNow}).review.scene,'title-dialog');
 assert.throws(()=>api.assertMailboxCommandReady(fixture,{now:testNow}),/pending command 6; review title-dialog/);
 const legacyNext=fs.readdirSync(path.join(out,'commands')).filter(f=>/^\d+\.json$/.test(f)).length;
 assert.equal(legacyNext,7);write('commands/'+legacyNext+'.json',{action:'menu-crusader',fixtureOnly:true});
 assert.deepEqual(api.mailboxStatus(fixture).pending,[6,7],'old client queues prematurely');
 fs.unlinkSync(path.join(out,'commands/7.json'));
 fs.writeFileSync(path.join(fixture,'reviews',first.requestId+'.json'),JSON.stringify({fixtureOnly:true}));
 actualClientBlocked('title-dialog');
 assert.throws(()=>api.assertMailboxCommandReady(fixture),/pending command 6/,'receipt alone is not command ACK');
 write('review-required.json',second);
 // Identical frozen pixels must name the current command's fresh capture,
 // rather than an older startup capture. Reuse authentic bytes unchanged.
 const actualPNG=fs.readFileSync(path.join(actualRun,'browser/title-boundary-2.png'));
 for(const [name,age]of [['a-older.png',2],['z-current.png',1]]){
  const file=path.join(out,name);fs.writeFileSync(file,actualPNG);
  fs.utimesSync(file,new Date(Date.parse(second.at)-age*1000),new Date(Date.parse(second.at)-age*1000));
 }
 assert.equal(api.mailboxStatus(fixture).review.capture,'z-current.png');
 const legacyCapture=fs.readdirSync(out).filter(n=>n.endsWith('.png')).find(n=>base.hash(fs.readFileSync(path.join(out,n)))===second.sha256);
 assert.equal(legacyCapture,'a-older.png','old first-match display selects stale filename');
 actualClientBlocked('main-menu');
 assert.equal(api.mailboxStatus(fixture,{now:Date.parse(second.at)}).review.receiptPresent,false);
 const premature=JSON.parse(fs.readFileSync(path.join(actualRun,'browser/commands/7.json'))).replyDeadline*1000-39000;
 assert.equal(api.mailboxStatus(fixture,{now:premature}).review.remainingMs,13094);
 assert.throws(()=>api.assertMailboxCommandReady(fixture),/pending command 6; review main-menu/);
 fs.writeFileSync(path.join(fixture,'reviews',second.requestId+'.json'),JSON.stringify({fixtureOnly:true}));
 actualClientBlocked('main-menu');
 assert.throws(()=>api.assertMailboxCommandReady(fixture),/pending command 6/);
 write('reply-6.json',{i:6,ok:true,fixtureOnly:true});
 assert.equal(api.assertMailboxCommandReady(fixture),7);
 execFileSync(process.execPath,[client,JSON.stringify({action:'menu-crusader'}),fixture],{stdio:'pipe'});
 assert.equal(JSON.parse(fs.readFileSync(path.join(out,'commands/7.json'))).action,'menu-crusader');
 fs.unlinkSync(path.join(out,'commands/7.json'));
 write('reply-6.json',{i:6,ok:false,error:'command/review deadline',fixtureOnly:true});
 assert.throws(()=>api.assertMailboxCommandReady(fixture),/terminal/);
 write('reply-6.json',{i:6,ok:true,fixtureOnly:true});write('cleanup.json',{fixtureOnly:true});
 assert.throws(()=>api.assertMailboxCommandReady(fixture),/terminal/);
 fs.unlinkSync(path.join(out,'cleanup.json'));
 write('review-required.json',{...second,requestId:'../foreign'});
 assert.throws(()=>api.mailboxStatus(fixture),/invalid original review request/);
 console.log('PASS actual two-review title handoff and old premature enqueue/new pending-review rejection; ACK, terminal and foreign-request negatives (offline transport only)');
}
const p=api.prepare({run,pins});new vm.Script(p.source);new vm.Script(p.route);
const cut=p.source.lastIndexOf('main().catch(');assert(cut>10000);
base.compileClosure(p.source.slice(0,cut),p.driver,p.route,p.evidence.retainedClosure);
assert.equal(p.evidence.retainedClosure.length,30);
assert.deepEqual(p.evidence.bounds,{navigation:16384,route:4096,arrival:3072,stability:768,perACK:64,commandMs:40000,chromeMs:720000});
assert(p.source.includes('installBeforeFirstScript'));assert(p.source.includes('activeReplyDeadline>Date.now()+40000'));
assert(p.source.includes('fresh authorized finite TTL required')===false);
assert(p.source.includes('one original launch only'));assert(p.source.includes('stale capture-bound review'));
assert(p.source.includes('executablePath:"/opt/google/chrome/chrome"'));
assert(p.route.includes('shellSamples>=4'));assert(p.route.includes('assertHistoricalShell(cap.png)'));
assert(p.route.includes('arrival===3072'));assert(p.route.includes('diagnostic scene20 observed; no readiness grant'));
// Execute the composed entry's actual guards, ending before its first side effect.
const start=p.source.indexOf('async function main(){'),end=p.source.indexOf("  if(fs.existsSync(OUT))throw Error('one original launch only');",start);
assert(start>0&&end>start);
fs.writeFileSync(path.join(run,'runtime-release.json'),JSON.stringify(release));
const guarded=p.source.slice(start,end)+'return true;\n}main();';
// The embedded random nonce must reject another preparation's release.
(async()=>{
 // Replay the actual failed observation command, including the composed loop.
 // Before the repair it advances every step before discovering a bad name.
 const observeStart=p.source.indexOf("  if(c.action==='observe'){");
 const observeEnd=p.source.indexOf("  if(c.action==='step'){",observeStart);
 assert(observeStart>0&&observeEnd>observeStart);
 const observe=p.source.slice(observeStart,observeEnd);
 const validation=`    require(${JSON.stringify(require.resolve('../tools/stronghold-local-runtime.cjs'))}).validateCaptureCommand(c,OUT);\n`;
 const oldObserve=base.replaceOnce(observe,validation,'');
 const captureOut=path.join(run,'capture-validation');fs.mkdirSync(captureOut,{recursive:true});
 fs.writeFileSync(path.join(captureOut,'occupied.png'),'offline collision marker');
 async function observeFixture(source,c){
  let steps=0,captures=0;
  const scope={require,c,i:0,OUT:captureOut,closing:false,deadline:Date.now()+40000,
   command:async event=>{assert.equal(event.action,'step');steps+=event.n;},
   freshShot:async()=>{captures++;throw Error('offline capture boundary sentinel');}};
  const promise=vm.runInNewContext('(async()=>{'+source+'})()',scope);
  await assert.rejects(promise,/fresh capture name required|offline capture boundary sentinel/);
  return {steps,captures};
 }
 const failedPath=path.resolve('scratch/runs/20261104-stronghold-repaired-entry-original-gameplay/browser/commands/4.json');
 const failedCommand=fs.existsSync(failedPath)?JSON.parse(fs.readFileSync(failedPath,'utf8')):{action:'observe',n:2048};
 assert.equal(failedCommand.action,'observe');assert.equal(failedCommand.name,undefined);
 assert.deepEqual(await observeFixture(oldObserve,failedCommand),{steps:2048,captures:1});
 for(const name of [undefined,null,42,'bad/name','occupied']){
  assert.deepEqual(await observeFixture(observe,{action:'observe',n:64,name}),{steps:0,captures:0});
 }
 for(const action of ['observe','shot']){
  assert.throws(()=>api.validateCaptureCommand({action},captureOut),/before execution/);
  assert.throws(()=>api.validateCaptureCommand({action,name:'occupied'},captureOut),/before execution/);
  api.validateCaptureCommand({action,name:'fresh-valid'},captureOut);
 }
 const clientRun=path.join(run,'capture-client');fs.mkdirSync(path.join(clientRun,'browser/commands'),{recursive:true});
 fs.writeFileSync(path.join(clientRun,'browser/ready.json'),'{}');
 assert.throws(()=>api.assertMailboxCommandReady(clientRun,{command:failedCommand}),/before execution/);
 assert.equal(fs.readdirSync(path.join(clientRun,'browser/commands')).length,0);
 assert.equal(api.assertMailboxCommandReady(clientRun,{command:{action:'observe',name:'fresh-valid'}}),0);
 console.log('PASS actual failed observe replay: old advances2048 then capture, repaired missing/invalid/duplicate name rejects before steps/capture; mailbox preflight leaves no command');
 // Replay the entire intended startup batch through the composed command and
 // transport functions. This is an offline browser/ACK fixture, never gameplay.
 const batchPath=process.env.STRONGHOLD_STARTUP_BATCH;
 if(batchPath){
  const batchBytes=fs.readFileSync(batchPath),batch=JSON.parse(batchBytes),names=new Set();
  const batchOut=path.join(run,'startup-batch-'+Date.now());fs.mkdirSync(batchOut);
  const a=p.source.indexOf('async function command(c,i){'),b=p.source.indexOf('let gameplayNumber=',a);
  const t=p.source.indexOf('function installTransportEvidence(p){'),u=p.source.indexOf('async function main(){',t);
  assert(a>0&&b>a&&t>0&&u>t);
  let steps=0,preSteps=0,acks=0,shots=0,validations=0;const captured=[];
  const ackTemplate=JSON.parse(fs.readFileSync('scratch/runs/20261104-stronghold-repaired-entry-original-gameplay/browser/step-0-0.json'));
  const scope={require,fs,path,OUT:batchOut,RUN:batchOut,Date,closing:false,halted:false,navigationSteps:0,deadline:Date.now()+40000,activeReplyDeadline:Date.now()+39000,
   held:new Set(),mouseHeld:new Set(),nativeDriver:null,sha:base.hash,log:()=>{},save:()=>{},
   commandLive:()=>{},state:async()=>({main:{tick:{steps}}}),
   assertAck:require('../scratch/runs/20261104-stronghold-explicit-idle-input/native-start-boundary.cjs').assertAck,
   presetAttachment:{active:false,beforeStep:async()=>{preSteps++;},ack:async(result,n)=>{assert.equal(result.requested,n);assert.equal(result.ran,n);acks++;}},
   freshShot:async name=>{api.validateCaptureCommand({action:'shot',name},batchOut);fs.writeFileSync(path.join(batchOut,name+'.png'),'OFFLINE CAPTURE MARKER');captured.push(name);},
   page:{evaluate:async(fn,n)=>{assert(String(fn).includes('WineFrozen.step'));steps+=n;return {...structuredClone(ackTemplate),steps,guests:ackTemplate.guests.map(g=>({...g,steps}))};},screenshot:async()=>{shots++;return Buffer.from('OFFLINE CAPTURE MARKER');},mouse:{move:async()=>{},down:async()=>{},up:async()=>{}}}};
  // Independent spawn prohibition protects this full batch replay too.
  const cp=require('node:child_process'),spawn=cp.spawn;let spawns=0;cp.spawn=()=>{spawns++;throw Error('OFFLINE SPAWN FORBIDDEN');};
  try{
   const context=vm.createContext(scope);
   vm.runInContext(p.source.slice(a,b)+p.source.slice(t,u)+'installTransportEvidence(page);',context);
   for(const [i,c]of batch.entries()){
    assert(['observe','shot'].includes(c.action));assert.equal(typeof c.name,'string');assert(!names.has(c.name));names.add(c.name);
    api.validateCaptureCommand(c,batchOut);validations++;
    context.c=c;context.i=i;await vm.runInContext('command(c,i)',context);
   }
   assert.equal(steps,batch.reduce((n,c)=>n+(c.action==='observe'?c.n:0),0));
   assert.equal(acks,steps/64);assert.equal(preSteps,acks);assert.equal(shots,batch.filter(c=>c.action==='shot').length);
   assert.equal(fs.readdirSync(batchOut).filter(n=>n.endsWith('.png')).length,batch.length);
   assert.equal(scope.navigationSteps,steps);assert.equal(spawns,0);
   const result={pass:true,offlineOnly:true,batchPath:path.resolve(batchPath),batchSHA256:base.hash(batchBytes),commands:batch.length,validations,steps,acks,uniqueCaptureNames:[...names],actualComposedCommand:true,actualTransportFunction:true,chromeSpawns:0,spawnAttempts:spawns};
   fs.writeFileSync(path.join(run,'startup-batch-preflight.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
  }finally{cp.spawn=spawn;}
 }
 // Reuse this assignment's original first-fault evidence if present. A native
 // setup entry and host release receipt cannot certify the missing returns or
 // a drained release. The runtime must remain terminal before another enqueue.
 const faultRun=path.resolve('scratch/runs/20261104-stronghold-named-observation-gameplay');
 const faultFile=path.join(faultRun,'browser/reply-11.json');
 if(fs.existsSync(faultFile)){
  const out=path.join(faultRun,'browser'),fault=JSON.parse(fs.readFileSync(faultFile));
  assert.equal(fault.ok,false);assert.match(fault.error,/command\/review deadline/);
  assert.throws(()=>api.assertMailboxCommandReady(faultRun,{command:{action:'observe',name:'forbidden-after-fault'}}),/terminal/);
  const reports=fs.readdirSync(out).filter(n=>/^preset-attachment-\d+\.json$/.test(n)).map(n=>JSON.parse(fs.readFileSync(path.join(out,n)))).filter(r=>r.report?.records);
  const report=reports.sort((a,b)=>b.report.sequence-a.report.sequence)[0].report;
  assert.equal(report.limits.maxBoundaries,50000000);assert.equal(report.limits.maxMs,360000);
  assert(report.records.some(r=>r.kind==='callback-entry'&&r.argument===2));
  assert(report.records.some(r=>r.kind==='callback-branch'&&r.argument===2));
  assert(report.records.some(r=>r.kind==='scene-request-return'&&r.state.requestedScene===20));
  assert(report.records.some(r=>r.kind==='setup-entry'));
  assert(!report.records.some(r=>['setup-return','callback-return','custom-path-completed'].includes(r.kind)));
  assert.deepEqual(report.pending.map(r=>r.name),['callback','setup']);
  const final=JSON.parse(fs.readFileSync(path.join(out,'final-state.json'))).main;
  assert.equal(final.mouseButtonsMask,0);assert.equal(final.inputQueue.length,1);assert.equal(final.inputQueue[0].msg,514);
  console.log('PASS retained original first-fault replay: callback2/request20/setup-entry observed, missing returns and queued release remain unproved; terminal prevents more commands');
 }
 const {EventEmitter}=require('node:events');
 async function closureFixture(code,signal,timeout=false){
  const child=Object.assign(new EventEmitter(),{pid:process.pid,exitCode:null,signalCode:null}),events=[];let disconnected=false;
  const browser={process:()=>child,disconnect:()=>{disconnected=true;},target:()=>({createCDPSession:async()=>({send:async method=>{
   assert.equal(method,'Browser.close');if(!timeout)setTimeout(()=>{child.exitCode=code;child.signalCode=signal;child.emit('exit',code,signal);},1);
  }})})};
  const result=api.normalClose(browser,{timeoutMs:timeout?10:1000,record:r=>events.push(r)});
  if(timeout)await assert.rejects(result,/deadline/);
  else if(signal!==null||code!==0)await assert.rejects(result,/abnormal/);
  else assert.deepEqual(await result,{pid:process.pid,code:0,signal:null});
  assert(events[0].startTicks);
  assert(disconnected);assert.equal(child.listenerCount('exit'),0);return events;
 }
 await closureFixture(0,null);await closureFixture(null,'SIGKILL');await closureFixture(1,null);await closureFixture(null,null,true);
 assert(!p.source.includes('await browser.close()'));
 await assert.rejects(vm.runInNewContext(guarded,{require,fs,path,RUN:run}),/nonce/);
 // Use this exact preparation's nonce and actual process, without launching.
 const embedded=JSON.parse(p.source.match(/nonce:("[a-f0-9]{64}")/)[1]);
 const actual=api.createRelease({run,pins,nonce:embedded,now});
 const testRequire=id=>id===require.resolve('../tools/stronghold-local-runtime.cjs')
  ?{...api,install:()=>({offlineFixture:true}),assertRuntimeOwnership:()=>({offlineFixture:true}),validateRelease:(r,o)=>api.validateRelease(r,{...o,now})}:require(id);
 fs.writeFileSync(path.join(run,'runtime-release.json'),JSON.stringify(actual));
 assert.equal(await vm.runInNewContext(guarded,{require:testRequire,fs,path,RUN:run,save:()=>{}}),true);
 // Execute the actual entry through its first real filesystem writes. A
 // mocked save in the admission test above cannot prove directory ordering.
 const initEnd=p.source.indexOf('  const pins=',start);assert(initEnd>end);
 const init=p.source.slice(start,initEnd)+'return true;\n}main();';
 const output=path.join(run,'bootstrap-order');
 if(fs.existsSync(output))fs.rmSync(output,{recursive:true}); // Owned offline fixture only.
 const saveSource=p.source.split('\n').find(line=>line.startsWith('const save='));assert(saveSource);
 const scope={require:testRequire,fs,path,RUN:run,OUT:output};
 const logLine="  save('runtime-ownership.json',runtimeOwnership);";
 const withoutLog=base.replaceOnce(init,logLine,'');
 const oldOrder=base.replaceOnce(withoutLog,"  if(fs.existsSync(OUT))",logLine+"\n  if(fs.existsSync(OUT))");
 await assert.rejects(vm.runInNewContext(saveSource+'\n'+oldOrder,scope),/ENOENT/);
 assert.equal(fs.existsSync(output),false);
 assert.equal(await vm.runInNewContext(saveSource+'\n'+init,{...scope}),true);
 assert(fs.statSync(path.join(output,'commands')).isDirectory());
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(output,'runtime-ownership.json'))),{offlineFixture:true});
 await assert.rejects(vm.runInNewContext(saveSource+'\n'+init,{...scope}),/one original launch only/);
 console.log('PASS actual bootstrap filesystem old save-before-mkdir fails, repaired entry creates directory then receipt; fresh-entry latch preserved; no server/Chrome');
 // Run the entire composed entry in a fresh filesystem under a real private
 // ancestor flock. Only the unavailable external release signal and Chrome
 // are fixtures; preparation, installation, release binding, HTTP and cleanup
 // execute normally. Inject the module binding explicitly: Puppeteer's ESM
 // namespace rejects assignment even though its descriptor says writable.
 const actualPuppeteer=require('puppeteer'),actualLaunch=actualPuppeteer.launch;
 assert.equal(Reflect.set(actualPuppeteer,'launch',()=>{}),false);
 assert.equal(actualPuppeteer.launch,actualLaunch);
 // Forbid child spawning as a separate guard against a broken injection.
 const entryRun=path.join(run,'composed-'+Date.now());fs.mkdirSync(entryRun);
 const entryPins=path.join(entryRun,'pins.json');
 fs.copyFileSync(process.env.STRONGHOLD_OFFLINE_PINS||pins,entryPins);
 const entryScript=path.join(entryRun,'mock-entry.cjs');
 fs.writeFileSync(entryScript,`
 const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
 const api=require(${JSON.stringify(require.resolve('../tools/stronghold-local-runtime.cjs'))});
 const route=require(${JSON.stringify(require.resolve('../tools/stronghold-route-recognition-handoff.cjs'))});
 const run=__dirname,pins=path.join(run,'pins.json');
 const p=route.prepare({run,pins});
 fs.writeFileSync(path.join(run,'runtime-release.json'),JSON.stringify(p.createRelease()));
 const ownership=api.assertRuntimeOwnership;
 api.assertRuntimeOwnership=()=>({offlineFixtureRelease:true,release:api.requireRuntimeRelease(${JSON.stringify(fixtureBoard)},${fixtureNow}),flock:api.requireLocalFlock(${JSON.stringify(testLock)})});
 const cp=require('node:child_process'),spawn=cp.spawn;let spawnAttempts=0;cp.spawn=()=>{spawnAttempts++;throw Error('OFFLINE SPAWN FORBIDDEN');};
 const puppeteer={launch:null},serverAPI=require(${JSON.stringify(require.resolve('./static-server.js'))}),start=serverAPI.startStaticServer;
 let launches=0,server,port;
 puppeteer.launch=async()=>{launches++;assert(api.lifecycleForRun(run));assert(fs.existsSync(path.join(run,'browser/runtime-ownership.json')));throw Error('OFFLINE MOCK LAUNCH SENTINEL');};
 serverAPI.startStaticServer=async options=>{server=await start(options);port=server.address().port;return server;};
 (async()=>{const cut=p.source.lastIndexOf('main().catch(');
 globalThis.__strongholdOfflinePuppeteer=puppeteer;
 const composed=p.source.slice(0,cut).replace("const puppeteer=require('puppeteer');","const puppeteer=globalThis.__strongholdOfflinePuppeteer;");
 assert.notEqual(composed,p.source.slice(0,cut));
 const caller=route.compileClosure(composed+'\\nmodule.exports={main,close};',p.driver,p.route,p.evidence.retainedClosure);
 try{await assert.rejects(caller.main(),/OFFLINE MOCK LAUNCH SENTINEL/);assert.equal(launches,1);assert(server.listening);assert.equal(api.lifecycleForRun(run).children.length,0);}
 finally{await caller.close('offline mocked launch complete');api.lifecycleForRun(run).restore();api.assertRuntimeOwnership=ownership;cp.spawn=spawn;delete globalThis.__strongholdOfflinePuppeteer;serverAPI.startStaticServer=start;}
 assert.equal(server.listening,false);assert.equal(spawnAttempts,0);
 const rows=fs.readFileSync(path.join(run,'chrome-lifecycle.jsonl'),'utf8').trim().split('\\n').map(JSON.parse);
 assert.deepEqual(rows.map(r=>r.kind),['installed','launch-request','recorder-restored']);
 console.log(JSON.stringify({pass:true,actualComposedEntry:true,filesystemPins:JSON.parse(fs.readFileSync(pins)).files.length,launchSentinels:launches,chromeSpawns:0,spawnAttempts,serverClosed:!server.listening,port,privateFlock:true}));
 })().catch(e=>{console.error(e);process.exitCode=1;});
 `);
 const composed=execFileSync('flock',['-n',testLock,process.execPath,entryScript],{encoding:'utf8',timeout:60000});
 assert.match(composed,/"actualComposedEntry":true/);console.log(composed.trim());
 delete actual.authorization;fs.writeFileSync(path.join(run,'runtime-release.json'),JSON.stringify(actual));
 await assert.rejects(vm.runInNewContext(guarded,{require,fs,path,RUN:run}),/authorization/);
 console.log(JSON.stringify({pass:true,negativeContracts:negatives,actualChildRejected:true,retainedHelpers:30,bounds:p.evidence.bounds}));
})().catch(e=>{console.error(e);process.exitCode=1;});
