'use strict';
// Offline contract/composition tests: no Chrome or original game attempt.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const api=require('../tools/stronghold-local-runtime.cjs'),base=require('../tools/stronghold-preset-driver-attachment.cjs');
const run=path.resolve(process.env.STRONGHOLD_CONTRACT_RUN||'scratch/runs/20261104-stronghold-current-runtime-binding/contract-test');
fs.mkdirSync(run,{recursive:true});
const pins=path.join(run,'pins.json');
const accepted=api.acceptedRuntimePins();
assert.equal(accepted.files.length,2429);assert.equal(accepted.runtimeBinding.amendments.length,5);
assert.equal(accepted.files.filter(r=>r.path.startsWith('test/binaries/')).length,1856);
assert.deepEqual(api.verifyAcceptedRuntimePins(accepted),accepted);
assert.throws(()=>api.acceptedRuntimePins(Buffer.from('{}')),/stale original/);
for(const change of [p=>p.files.pop(),p=>p.files[0].sha256='0'.repeat(64),p=>p.runtimeBinding.amendments.pop(),p=>p.files.push(p.files[0])]){
 const p=structuredClone(accepted);change(p);assert.throws(()=>api.verifyAcceptedRuntimePins(p),/closure/);
}
// Inject changed reads without changing any shared dependency on disk. This
// separately tests both wrong module variants and an unnamed source change.
const nativeRead=fs.readFileSync;
for(const file of ['build/wine-assembly.wasm','build/wine-assembly.compat.wasm','src/09ab-handlers-d3dim-core.wat','lib/guest-worker.js','tools/stronghold-owning-callback-observer.cjs']){
 let seen=false;
 fs.readFileSync=function(name,...args){const bytes=Reflect.apply(nativeRead,this,[name,...args]);if(typeof name==='string'&&path.resolve(name)===path.resolve(file)){seen=true;const changed=Buffer.from(bytes);changed[0]^=1;return changed;}return bytes;};
 try{assert.throws(()=>api.acceptedRuntimePins(),/unknown runtime dependency mismatch/);assert(seen);}finally{fs.readFileSync=nativeRead;}
}
console.log('PASS exact 2429-row closure, five named amendments, 1856 unchanged media; stale manifest/row deletion/duplicate/wrong pair/changed dependency negatives; no shared file mutation');
fs.writeFileSync(pins,JSON.stringify({files:['build/wine-assembly.wasm','build/wine-assembly.compat.wasm'].map(file=>({path:file,sha256:base.hash(fs.readFileSync(file))}))}));
const nonce='a'.repeat(64),now=Date.parse('2026-11-04T17:45:00Z');
const actualOwn='2026-11-04T23:51:39+00:00 mdk2-accepted-runtime-binding OWN tools/mdk2-local-runtime.cjs docs/re-notes/mdk2-accepted-runtime-binding-20261104.md';
const actualRelease='2026-11-05T00:01:00Z mdk2-accepted-runtime-binding LOCAL HEAVY RELEASE mdk2-accepted-runtime-binding-2350 offline fixture only';
const actualFileRelease='2026-11-05T00:02:00Z mdk2-accepted-runtime-binding RELEASE tools/mdk2-local-runtime.cjs docs/re-notes/mdk2-accepted-runtime-binding-20261104.md';
const fixtureBoard=actualOwn+'\n'+actualRelease+'\n'+actualFileRelease,fixtureNow=Date.parse('2026-11-05T00:03:00Z');
assert.equal(api.requireRuntimeRelease(fixtureBoard,fixtureNow).row,actualRelease);
for(const board of [actualRelease,fixtureBoard.replaceAll('mdk2-accepted-runtime-binding','someone'),fixtureBoard.replace('-2350 offline','-2350-extra offline'),fixtureBoard.replace('00:01:00','00:04:00'),fixtureBoard.replace('23:51:39','23:51:38'),actualOwn+'\n'+actualRelease,fixtureBoard.replace('00:02:00','00:00:59'),fixtureBoard.replace('00:02:00','00:04:00'),fixtureBoard.replace('binding RELEASE','binding FOREIGN'),fixtureBoard+'\n'+actualOwn.replace('2026-11-04T23:51:39+00:00','2026-11-05T00:02:01Z')])assert.throws(()=>api.requireRuntimeRelease(board,fixtureNow),/release/);
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
reject('previous named observation assignment',r=>r.assignment='stronghold-named-observation-gameplay user task');
reject('foreign assignment',r=>r.assignment='foreign');
reject('previous quiet RPC assignment',r=>r.assignment='stronghold-quiet-rpc-original-gameplay-2230 user task');
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
assert.equal(api.CUTOFF,Date.parse('2026-11-05T00:55:00Z'));
assert.equal(api.CLEANUP,Date.parse('2026-11-05T00:58:00Z'));
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
assert(p.source.includes('createHostPresentationController({page:()=>page,save,deadline:()=>deadline})'));
assert(p.source.includes('const presentationBefore=await hostPresentation.token();'));
assert(p.source.indexOf('await hostPresentation.capture(presentationBefore,sha(png),name)')<p.source.indexOf('await presetAttachment.capture(name,sha(png),current)'));
assert.deepEqual(p.evidence.hostPresentation,{passive:true,normalCallsOnly:true,endpointSlot:0,maxRecords:2048,maxBytes:1048576,
 operationToUpload:'unknown without unique cross-realm RPC identity',readinessGranted:false,pixelsAccepted:false});
assert.deepEqual(p.evidence.callbackObserver.passiveDraw,{entry:0x4292c0,returnInstruction:0x42a20e,
 returnEvidence:'byte-pinned epilogue block plus saved caller/ESP return; block-level hook',
 sameHistory:true,presentation:'pending',hostRelation:null,readinessGranted:false,pixelsAccepted:false});
// A sampled native fade endpoint cannot widen the pixel classifier.
assert.equal(api.diagnosticScene(fs.readFileSync(path.join('scratch/runs/20261104-stronghold-quiet-rpc-original-gameplay/browser/route-native-boundary-3.png')),'unknown',
 {fade692e18:0,direction690e54:0,drawReturned:true}),'unknown');
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
 // Run the serialized page hook through the production Node controller.
 // A plain page VM supplies a host; there is no browser, Worker or render call
 // by the controller. The producer below owns its own normal pipeline.
 {
  const memory={buffer:new ArrayBuffer(1024)},canvas={},display={},sid=0x200001,hwnd=65537,saved=[];
  const presentation={canvas,directDraw:true,targetHwnd:hwnd,version:0,surface:{storage:new Uint8Array(memory.buffer),storageOffset:64}};
  const renderer={canvas:display,windows:{[hwnd]:{_backCanvas:canvas}},ctx:{canvas:display,drawImage(){}},
   _immutablePublicationSequence:0,repaint(){this.ctx.drawImage(canvas);this._immutablePublicationSequence++;}};
  const imports={gdi_surface_upload(){presentation.version++;return 1;}};
  const broker={serveCall(m){return imports.gdi_surface_upload(...m.args);}};
  const instance={},wine={memory,instance,processId:1000,renderer,_hostImports:imports,guestWorker:{broker},hostCtx:{sharedGdi:{surfacePresentations:new Map([[sid,presentation]])}}};
  Object.assign(renderer.windows[hwnd],{wasm:instance,wasmMemory:memory,processId:1000});
  const scope=vm.createContext({wine,performance,Date,TextEncoder,setTimeout,clearTimeout,Promise});
  const controller=api.createHostPresentationController({page:()=>({evaluate:async s=>vm.runInContext(s,scope)}),
   save:(name,value)=>saved.push({name,value:structuredClone(value)}),deadline:()=>Date.now()+10000});
  assert.equal(await controller.token(),null);await controller.start('controller-target/controller-session');
  await assert.rejects(controller.start('controller-target/controller-session'),/occupied/);
  assert.equal(renderer._immutablePublicationSequence,0,'install never forces a render');
  broker.serveCall({slot:0,args:[sid,0,0,4,4]});renderer.repaint();
  await controller.capture(await controller.token(),'c'.repeat(64),'controller-shot');
  await controller.link({epoch:'controller-target/controller-session',status:'running',records:[],fault:null});
  assert.equal(saved.at(-1).value.link.operationCompletion,null);assert.equal(saved.at(-1).value.link.readinessGranted,false);
  const last=saved.at(-1).value.host.records.at(-1);assert.equal(last.kind,'capture-bracket');assert.equal(last.sha256,'c'.repeat(64));
  await controller.finish('fixture-terminal');assert.equal(await controller.token(),null);
  assert.equal(imports.gdi_surface_upload.name,'gdi_surface_upload');assert.equal(renderer._immutablePublicationSequence,1);
  console.log('PASS production host presentation controller serialized page VM; exact capture bracket, passive lifecycle and no readiness grant');
 }
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
  const reportNames=new Set(fs.readdirSync(out).filter(n=>/^preset-attachment-\d+\.json(?:\.gz)?$/.test(n)).map(n=>n.replace(/\.gz$/,'')));
  const reports=[...reportNames].map(n=>JSON.parse(base.retained(path.join(out,n)))).filter(r=>r.report?.records);
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
 // The new original reached an unrecognized partial setup frame. Replay the
 // exact capture and composed arrival branch, without restarting that runtime.
 const transitionRun=path.resolve('scratch/runs/20261104-stronghold-quiet-rpc-original-gameplay');
 const transitionFile=path.join(transitionRun,'browser/route-native-boundary-8.png');
 if(fs.existsSync(transitionFile)){
  const {PNG}=require('pngjs'),bytes=fs.readFileSync(transitionFile),png=PNG.sync.read(bytes);
  const route=require('../tools/stronghold-route-recognition-handoff.cjs');
  const nav=route.compileClosure(base.retained(route.WRAPPER).toString(),route.WRAPPER,'');
  assert.equal(nav.scene(bytes),'unknown','retained recognizers reproduce the actual first fault');
  assert.equal(api.diagnosticScene(bytes,'unknown'),'setup-transition-observation');
  for(const known of ['choose-type','actual-scene20-observation','zephyr-ready'])assert.equal(api.diagnosticScene(bytes,known),known);
  let negatives=0;
  for(const [x,y]of [[10,194],[869,861],[153,419],[84,733],[620,500]]){
   const changed={...png,data:Buffer.from(png.data)};changed.data[(y*png.width+x)*4]^=1;
   assert.equal(api.diagnosticScene(PNG.sync.write(changed),'unknown'),'unknown');negatives++;
  }
  const toolbar={...png,data:Buffer.from(png.data)};toolbar.data[(50*png.width+50)*4]^=1;
  assert.equal(api.diagnosticScene(PNG.sync.write(toolbar),'unknown'),'setup-transition-observation');
  const alpha={...png,data:Buffer.from(png.data)};alpha.data[(300*png.width+300)*4+3]=254;
  assert.throws(()=>api.diagnosticScene(PNG.sync.write(alpha),'unknown'),/opaque/);
  assert.throws(()=>api.diagnosticScene(PNG.sync.write(new PNG({width:800,height:600})),'unknown'),/geometry/);
  for(const name of ['route-native-boundary-3','route-native-boundary-6','route-native-boundary-7']){
   assert.equal(api.diagnosticScene(fs.readFileSync(path.join(transitionRun,'browser',name+'.png')),'unknown'),'unknown');negatives++;
  }
  const actualState=JSON.parse(base.retained(path.join(transitionRun,'browser/route-native-boundary-8.json'))).state;
  const captureStart=p.route.indexOf(' const capture=async()=>{'),captureEnd=p.route.indexOf(' const sample=',captureStart);
  const scope={require,physical:{capture:async()=>({png:bytes,state:actualState})},sha256:base.hash,scene:nav.scene,fail:m=>{throw Error(m);}};
  const cap=await vm.runInNewContext(p.route.slice(captureStart,captureEnd)+'capture()',scope);
  assert.equal(cap.scene,'setup-transition-observation');
  const old=require('../tools/stronghold-owning-callback-observer.cjs').prepare({run,pins}).route;
  const arrival=(source,value,arrived=512)=>{
   const a=source.indexOf(' const acceptArrival=cap=>{'),b=source.indexOf(' const receipt=',a);assert(a>0&&b>a);
   return vm.runInNewContext("let continuation='arrival',arrival="+arrived+",shellSamples=0,last;"+source.slice(a,b)+'acceptArrival(cap);({continuation,last});',{require,cap:value,fail:m=>{throw Error(m);}});
  };
  assert.throws(()=>arrival(old,{scene:'unknown'}),/first unexpected natural scene: unknown/);
  assert.equal(arrival(p.route,cap).continuation,'arrival');
  assert.throws(()=>arrival(p.route,{scene:'unknown'}),/first unexpected/);
  assert.throws(()=>arrival(p.route,cap,3072),/arrival diagnostic cap/);
  assert.throws(()=>arrival(p.route,{scene:'actual-scene20-observation'}),/no readiness grant/);
  const report=JSON.parse(base.retained(path.join(transitionRun,'browser/preset-attachment-80.json'))).report;
  assert.equal(report.fault,null);assert.deepEqual(report.pending,[]);
  for(const kind of ['setup-return','callback-return','custom-path-completed'])assert(report.records.some(r=>r.kind===kind));
  assert.equal(report.blocks,40092338);assert.equal(report.limits.maxBoundaries,50000000);
  assert.deepEqual(actualState.main.inputQueue,[]);assert.equal(actualState.main.mouseButtonsMask,0);
  assert.equal(actualState.main.activeInput,null);assert.equal(actualState.main.lastInput,null);assert.equal(actualState.main.tick.tickMs,16);
  assert.throws(()=>api.assertMailboxCommandReady(transitionRun,{command:{action:'route-arrival'}}),/terminal/);
  assert(p.route.includes("if(continuation!=='preset')fail('fresh later review required before preset')"));
  console.log('PASS actual partial-setup fault OLD unknown/rejects NEW exact whole-game observation/arrival only; '+negatives+' pixel/scene negatives, alpha/geometry/cap/readiness/terminal guards; native returns and drained release retained');
 }
 // Replay this assignment's first fault through the real capture and arrival
 // functions. A different opacity of the same partial layout is observation
 // only; even these exact pixels cannot advance to a preset gesture.
 const onwardRun=path.resolve('scratch/runs/20261104-stronghold-setup-transition-onward');
 const onwardCapture=path.join(onwardRun,'browser/route-native-boundary-10.png');
 if(fs.existsSync(onwardCapture)){
  const {PNG}=require('pngjs'),bytes=fs.readFileSync(onwardCapture),png=PNG.sync.read(bytes);
  const nav=require('../tools/stronghold-route-recognition-handoff.cjs').originalNavigation();
  const oldDiagnostic=vm.runInNewContext('('+api.diagnosticScene.toString().replace('SETUP_TRANSITIONS.includes(base.hash(pixels))','base.hash(pixels)===SETUP_TRANSITION')+')',{require,base,Buffer,SETUP_TRANSITION:api.SETUP_TRANSITION});
  assert.equal(nav.scene(bytes),'unknown');assert.equal(oldDiagnostic(bytes,'unknown'),'unknown');
  assert.equal(api.diagnosticScene(bytes,'unknown'),'setup-transition-observation');
  assert(Object.isFrozen(api.SETUP_TRANSITIONS));assert.equal(api.SETUP_TRANSITIONS.length,2);
  let negatives=0;
  for(const [x,y]of [[10,194],[869,861],[153,419],[84,733],[620,500],[150,240],[80,610]]){
   const changed={...png,data:Buffer.from(png.data)};changed.data[(y*png.width+x)*4]^=1;
   assert.equal(api.diagnosticScene(PNG.sync.write(changed),'unknown'),'unknown');negatives++;
  }
  const toolbar={...png,data:Buffer.from(png.data)};toolbar.data[(50*png.width+50)*4]^=1;
  assert.equal(api.diagnosticScene(PNG.sync.write(toolbar),'unknown'),'setup-transition-observation');
  const alpha={...png,data:Buffer.from(png.data)};alpha.data[(300*png.width+300)*4+3]=254;
  assert.throws(()=>api.diagnosticScene(PNG.sync.write(alpha),'unknown'),/opaque/);
  assert.throws(()=>api.diagnosticScene(PNG.sync.write(new PNG({width:800,height:600})),'unknown'),/geometry/);
  for(const known of ['choose-type','actual-scene20-observation','zephyr-ready'])assert.equal(api.diagnosticScene(bytes,known),known);
  const state=JSON.parse(base.retained(path.join(onwardRun,'browser/route-native-boundary-10.json'))).state;
  const a=p.route.indexOf(' const capture=async()=>{'),b=p.route.indexOf(' const sample=',a);
  const cap=await vm.runInNewContext(p.route.slice(a,b)+'capture()',{require,physical:{capture:async()=>({png:bytes,state})},sha256:base.hash,scene:nav.scene,fail:m=>{throw Error(m);}});
  assert.equal(cap.scene,'setup-transition-observation');
  const arrival=(value,arrived=1024)=>{
   const a=p.route.indexOf(' const acceptArrival=cap=>{'),b=p.route.indexOf(' const receipt=',a);
   return vm.runInNewContext("let continuation='arrival',arrival="+arrived+",shellSamples=0,last;"+p.route.slice(a,b)+'acceptArrival(cap);({continuation,last});',{require,cap:value,fail:m=>{throw Error(m);}});
  };
  assert.throws(()=>arrival({...cap,scene:oldDiagnostic(bytes,'unknown')}),/first unexpected natural scene: unknown/);
  assert.equal(arrival(cap).continuation,'arrival');
  assert.throws(()=>arrival(cap,3072),/arrival diagnostic cap/);
  assert.throws(()=>arrival({...cap,scene:'actual-scene20-observation'}),/no readiness grant/);
  assert.throws(()=>api.assertMailboxCommandReady(onwardRun,{command:{action:'route-arrival'}}),/terminal/);
  const report=JSON.parse(base.retained(path.join(onwardRun,'browser/preset-attachment-133.json'))).report;
  assert.equal(report.blocks,39098384);assert.equal(report.fault,null);assert.deepEqual(report.pending,[]);
  assert.deepEqual(report.limits,{maxMs:360000,maxRecords:2048,maxBytes:1048576,maxBoundaries:50000000});
  for(const kind of ['setup-return','callback-return','custom-path-completed'])assert(report.records.some(r=>r.kind===kind));
  assert.deepEqual(state.main.inputQueue,[]);assert.equal(state.main.mouseButtonsMask,0);
  assert.equal(state.main.activeInput,null);assert.equal(state.main.lastInput,null);assert.equal(state.main.tick.tickMs,16);
  console.log('PASS current partial-setup first-fault OLD unknown/rejects NEW exact second identity/arrival only; '+negatives+' pixel negatives, alpha/geometry/precedence/terminal/cap/readiness guards and continuous39098384 native history');
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
 fs.writeFileSync(entryPins,process.env.STRONGHOLD_OFFLINE_PINS?fs.readFileSync(process.env.STRONGHOLD_OFFLINE_PINS):JSON.stringify(api.acceptedRuntimePins()));
 const entryScript=path.join(entryRun,'mock-entry.cjs');
 fs.writeFileSync(entryScript,`
 const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
 const api=require(${JSON.stringify(require.resolve('../tools/stronghold-local-runtime.cjs'))});
 const route=require(${JSON.stringify(require.resolve('../tools/stronghold-route-recognition-handoff.cjs'))});
 // Fixture clock keeps this offline entry test executable after the original
 // authorization expires. Production deadline/admission code is unchanged.
 const wallNow=Date.now;if(!process.env.STRONGHOLD_REQUIRE_CURRENT_RELEASE)Date.now=()=>${fixtureNow};
 const run=__dirname,pins=path.join(run,'pins.json');
 const p=route.prepare({run,pins});
 assert.equal(p.evidence.callbackObserver.passiveDraw.readinessGranted,false);
 assert.equal(p.evidence.callbackObserver.passiveDraw.presentation,'pending');
 fs.writeFileSync(path.join(run,'runtime-release.json'),JSON.stringify(p.createRelease()));
 const ownership=api.assertRuntimeOwnership;
 api.assertRuntimeOwnership=()=>({offlineFixtureRelease:!process.env.STRONGHOLD_REQUIRE_CURRENT_RELEASE,release:api.requireRuntimeRelease(process.env.STRONGHOLD_REQUIRE_CURRENT_RELEASE?fs.readFileSync('messageboard.txt','utf8'):${JSON.stringify(fixtureBoard)},process.env.STRONGHOLD_REQUIRE_CURRENT_RELEASE?Date.now():${fixtureNow}),flock:api.requireLocalFlock(${JSON.stringify(testLock)})});
 const cp=require('node:child_process'),spawn=cp.spawn,nativeSpawn=cp.ChildProcess.prototype.spawn;let spawnAttempts=0,nativeSpawnAttempts=0;
 cp.spawn=()=>{spawnAttempts++;throw Error('OFFLINE SPAWN FORBIDDEN');};
 cp.ChildProcess.prototype.spawn=function(){nativeSpawnAttempts++;throw Error('OFFLINE NATIVE SPAWN FORBIDDEN');};
 const puppeteer={launch:null},serverAPI=require(${JSON.stringify(require.resolve('./static-server.js'))}),start=serverAPI.startStaticServer;
 let launches=0,server,port;
 let httpResponses=0;
 puppeteer.launch=async()=>{launches++;assert(api.lifecycleForRun(run));assert(fs.existsSync(path.join(run,'browser/runtime-ownership.json')));
  const rows=JSON.parse(fs.readFileSync(pins)).files;
  for(const row of rows){const response=await fetch('http://127.0.0.1:'+port+'/'+row.path),bytes=Buffer.from(await response.arrayBuffer());assert.equal(response.status,200,row.path);assert.equal(require(${JSON.stringify(require.resolve('../tools/stronghold-preset-driver-attachment.cjs'))}).hash(bytes),row.sha256,row.path);assert.equal(response.headers.get('cross-origin-opener-policy'),'same-origin');assert.equal(response.headers.get('cross-origin-embedder-policy'),'require-corp');assert.match(response.headers.get('cache-control'),/no-store/);httpResponses++;}
  fs.writeFileSync(path.join(run,'http-closure.json'),JSON.stringify({rows:rows.length,httpResponses,allMatched:true}));
  throw Error('OFFLINE MOCK LAUNCH SENTINEL');};
 serverAPI.startStaticServer=async options=>{server=await start(options);port=server.address().port;return server;};
 (async()=>{const cut=p.source.lastIndexOf('main().catch(');
 globalThis.__strongholdOfflinePuppeteer=puppeteer;
 const composed=p.source.slice(0,cut).replace("const puppeteer=require('puppeteer');","const puppeteer=globalThis.__strongholdOfflinePuppeteer;");
 assert.notEqual(composed,p.source.slice(0,cut));
 const caller=route.compileClosure(composed+'\\nmodule.exports={main,close};',p.driver,p.route,p.evidence.retainedClosure);
 try{await assert.rejects(caller.main(),/OFFLINE MOCK LAUNCH SENTINEL/);assert.equal(launches,1);assert(server.listening);assert.equal(api.lifecycleForRun(run).children.length,0);}
 finally{await caller.close('offline mocked launch complete');api.lifecycleForRun(run).restore();api.assertRuntimeOwnership=ownership;cp.spawn=spawn;cp.ChildProcess.prototype.spawn=nativeSpawn;delete globalThis.__strongholdOfflinePuppeteer;serverAPI.startStaticServer=start;Date.now=wallNow;}
 assert.equal(server.listening,false);assert.equal(spawnAttempts,0);assert.equal(nativeSpawnAttempts,0);
 const rows=fs.readFileSync(path.join(run,'chrome-lifecycle.jsonl'),'utf8').trim().split('\\n').map(JSON.parse);
 assert.deepEqual(rows.map(r=>r.kind),['installed','launch-request','recorder-restored']);
 console.log(JSON.stringify({pass:true,actualComposedEntry:true,filesystemPins:JSON.parse(fs.readFileSync(pins)).files.length,httpResponses,launchSentinels:launches,chromeSpawns:0,spawnAttempts,nativeSpawnAttempts,serverClosed:!server.listening,port,privateFlock:true}));
 })().catch(e=>{console.error(e);process.exitCode=1;});
 `);
 const composed=execFileSync('flock',['-n',testLock,process.execPath,entryScript],{encoding:'utf8',timeout:180000});
 assert.match(composed,/"actualComposedEntry":true/);console.log(composed.trim());
 delete actual.authorization;fs.writeFileSync(path.join(run,'runtime-release.json'),JSON.stringify(actual));
 await assert.rejects(vm.runInNewContext(guarded,{require,fs,path,RUN:run}),/authorization/);
 console.log(JSON.stringify({pass:true,negativeContracts:negatives,actualChildRejected:true,retainedHelpers:30,bounds:p.evidence.bounds}));
})().catch(e=>{console.error(e);process.exitCode=1;});
