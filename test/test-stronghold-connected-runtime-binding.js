'use strict';
// Named fresh binding and actual composed-entry contracts. No original or Chrome.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const cp=require('node:child_process'),api=require('../tools/stronghold-local-runtime.cjs');
const route=require('../tools/stronghold-route-recognition-handoff.cjs'),base=require('../tools/stronghold-preset-driver-attachment.cjs');
async function offlineCoverageContract(){
 const run=path.resolve(process.env.STRONGHOLD_COVERAGE_RUN);fs.mkdirSync(run,{recursive:true});
 api.requireLocalFlock();
 const seal='scratch/runs/20261105-stronghold-prompt-review-gameplay/first-failure.json',sealed=fs.readFileSync(seal);
 assert.equal(base.hash(sealed),'ee7426e75089303d14cc4799c46daf0561d584c45bb2537c65a6935cdafffe72');
 const manifest=api.offlineCoveragePins(),pins=path.join(run,'offline-pins.json');
 assert.equal(manifest.files.length,2429);assert.equal(manifest.offlineCoverageBinding.originalExecutionAuthorized,false);
 api.verifyOfflineCoveragePins(manifest);fs.writeFileSync(pins,JSON.stringify(manifest,null,2));
 assert.throws(()=>api.verifyFreshRuntimePins(JSON.parse(fs.readFileSync('scratch/runs/20261105-stronghold-prompt-review-gameplay/runtime-pins.json'))),/fresh runtime closure/);
 assert.throws(()=>api.acceptedRuntimePins(),/unknown runtime dependency mismatch/);
 assert.throws(()=>api.binding(run,pins),/cannot authorize original execution/);
 assert.throws(()=>api.createRelease({run,pins,nonce:'a'.repeat(64)}),/cannot authorize original execution/);
 for(const mutate of [p=>p.files.pop(),p=>p.files.push(p.files[0]),p=>p.files[0].sha256='0'.repeat(64),
  p=>p.offlineCoverageBinding.originalExecutionAuthorized=true,p=>p.offlineCoverageBinding.sourceIdentity.gitSHA='0'.repeat(40),
  p=>p.offlineCoverageBinding.originalPinsSHA256='0'.repeat(64)]){
  const changed=structuredClone(manifest);mutate(changed);assert.throws(()=>api.verifyOfflineCoveragePins(changed),/offline coverage closure/);
 }
 const p=route.prepare({run,pins});new vm.Script(p.source);new vm.Script(p.route);
 assert(p.source.includes('createHostPresentationController'));assert(p.source.includes('validateRelease'));
 assert(p.source.includes('installTransportEvidence'));assert(p.source.includes('personalReview'));
 assert.equal(p.evidence.setupTransitionDiagnostic.readinessGranted,false);assert.equal(p.evidence.setupTransitionDiagnostic.pixelsAccepted,false);
 const worker=base.hash(require('../tools/stronghold-owning-callback-observer.cjs').workerSource({observeSource:'',options:{targetId:'coverage',sessionId:'fixture',expectedWorkerURL:'http://fixture/lib/guest-worker.js'}}));
 const nativeSpawn=cp.ChildProcess.prototype.spawn;let spawns=0;
 cp.ChildProcess.prototype.spawn=function(){spawns++;throw Error('OFFLINE SPAWN FORBIDDEN');};
 const {startStaticServer}=require('./static-server');let server,httpResponses=0,port;
 try{
  server=await startStaticServer({root:path.resolve('.'),port:0});port=server.address().port;
  // Exercise the production server's complete selected closure without a browser.
  for(const row of manifest.files){
   const response=await fetch('http://127.0.0.1:'+port+'/'+row.path),bytes=Buffer.from(await response.arrayBuffer());
   assert.equal(response.status,200,row.path);assert.equal(base.hash(bytes),row.sha256,row.path);httpResponses++;
  }
 }finally{
  if(server)await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  cp.ChildProcess.prototype.spawn=nativeSpawn;
 }
 assert.equal(spawns,0);assert.equal(server.listening,false);assert.equal(base.hash(fs.readFileSync(seal)),base.hash(sealed));
 const result={pass:true,httpResponses,port,serverClosed:true,spawns,originalExecutions:0,historicalFirstFailureUnchanged:true,
  selectedCompositionSHA256:base.hash(p.source),workerSourceSHA256:worker,offlineLaunchRejected:true,readinessGranted:false,pixelsAccepted:false,gameplay:false};
 fs.writeFileSync(path.join(run,'offline-contract-result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}
if(process.env.STRONGHOLD_COVERAGE_RUN){offlineCoverageContract().catch(e=>{console.error(e.stack);process.exitCode=1;});return;}
if(!process.env.STRONGHOLD_CONNECTED_RUN){
 // The ordinary unit tier must not acquire a shared runtime or issue a dated
 // original authorization. The complete fresh-entry fixture is explicit.
 const historical=fs.readFileSync('scratch/runs/20261104-stronghold-setup-transition-onward/runtime-pins.json');
 assert.equal(base.hash(historical),api.ORIGINAL_PINS_SHA);
 assert.throws(()=>api.acceptedRuntimePins(),/unknown runtime dependency mismatch/);
 assert.equal(api.diagnosticScene(Buffer.from('image identity alone'),'unknown'),'unknown');
 assert.equal(api.diagnosticScene(Buffer.from('image identity alone'),'unknown',{
  status:'proved-setup-in-progress',sha256:base.hash(Buffer.from('image identity alone')),
  readinessGranted:false,pixelsAccepted:false,gameplay:false}),'unknown');
 console.log('PASS immutable historical closure stays rejected; image identity and incomplete provenance remain unknown; full fresh entry requires explicit owned run/flock');
 return;
}
const run=path.resolve(process.env.STRONGHOLD_CONNECTED_RUN||'scratch/runs/20261105-stronghold-connected-original-gameplay/connected-contract');
fs.mkdirSync(run,{recursive:true});
const original=fs.readFileSync('scratch/runs/20261104-stronghold-setup-transition-onward/runtime-pins.json');
assert.equal(base.hash(original),api.ORIGINAL_PINS_SHA);
assert.throws(()=>api.acceptedRuntimePins(),/unknown runtime dependency mismatch/);
const fresh=api.freshRuntimePins(),pins=path.join(run,'runtime-pins.json');
assert.equal(fresh.files.length,2429);assert.equal(fresh.files.filter(r=>r.path.startsWith('test/binaries/')).length,1856);
assert.equal(fresh.freshRuntimeBinding.assignment,'stronghold-landed-startup-original-1135 user task');
assert.throws(()=>api.verifyFreshRuntimePins(JSON.parse(fs.readFileSync('scratch/runs/20261105-stronghold-prompt-review-gameplay/runtime-pins.json'))),/fresh runtime closure/);
assert.equal(fresh.freshRuntimeBinding.originalPinsSHA256,base.hash(original));
assert.equal(fresh.commit,cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim());
assert.equal(api.verifyFreshRuntimePins(fresh),fresh);
fs.writeFileSync(pins,JSON.stringify(fresh));
const unchanged=JSON.parse(original).files.filter(r=>r.path.startsWith('test/binaries/'));
assert.deepEqual(fresh.files.filter(r=>r.path.startsWith('test/binaries/')),unchanged);
let negatives=0;
for(const mutate of [p=>p.files.pop(),p=>p.files.push(p.files[0]),p=>p.files[0].sha256='0'.repeat(64),
 p=>p.files[0].bytes++,p=>delete p.freshRuntimeBinding,p=>p.freshRuntimeBinding.assignment='foreign',
 p=>p.freshRuntimeBinding.originalPinsSHA256='0'.repeat(64),p=>p.freshRuntimeBinding.amendments.pop(),
 p=>p.freshRuntimeBinding.sourceIdentity.gitSHA='0'.repeat(40),p=>p.freshRuntimeBinding.sourceIdentity.relevantDiffSHA256='0'.repeat(64),
 p=>p.files.find(r=>r.path==='build/wine-assembly.wasm').sha256='0'.repeat(64),
 p=>p.files.find(r=>r.path==='build/wine-assembly.compat.wasm').sha256='0'.repeat(64)]){
 const p=structuredClone(fresh);mutate(p);assert.throws(()=>api.verifyFreshRuntimePins(p),/fresh runtime closure/);negatives++;
}
const read=fs.readFileSync;
for(const file of ['host.js','lib/renderer.js','lib/guest-worker.js','tools/stronghold-owning-callback-observer.cjs','build/wine-assembly.wasm','build/wine-assembly.compat.wasm',base.MEDIA]){
 let seen=false;fs.readFileSync=function(name,...args){const bytes=Reflect.apply(read,this,[name,...args]);
  if(typeof name==='string'&&path.resolve(name)===path.resolve(file)){seen=true;const b=Buffer.from(bytes);b[0]^=1;return b;}return bytes;};
 try{assert.throws(()=>api.freshRuntimePins(),/unknown fresh runtime dependency mismatch/);assert(seen);negatives++;}finally{fs.readFileSync=read;}
}
const now=Date.now(),nonce='a'.repeat(64),release=api.createRelease({run,pins,nonce,now});
assert.equal(api.validateRelease(release,{run,pins,nonce,now}),release);
for(const mutate of [r=>r.assignment='foreign',r=>r.authorization='foreign',r=>r.freshLocalDiagnosticAuthorized=false,
 r=>r.shutdownOwner='worker',r=>r.kind='leased-box',r=>r.boxId='fake',r=>r.identity.pid++,r=>r.identity.startTicks+='0',
 r=>r.identity.bootId='foreign',r=>r.nonce='b'.repeat(64),r=>r.binding.modules[0].sha256='0'.repeat(64),
 r=>r.binding.pinsSHA256='0'.repeat(64),r=>r.closeBy=Infinity,r=>r.closeBy=now,r=>r.closeBy=r.issuedAt+720001,
 r=>r.chromeCutoff=api.CUTOFF+1,r=>r.cleanupBy=api.CLEANUP+1,r=>r.issuedAt=now+1]){
 const r=structuredClone(release);mutate(r);assert.throws(()=>api.validateRelease(r,{run,pins,nonce,now}));negatives++;
}
assert.throws(()=>api.validateRelease(release,{run,pins,nonce,now:now+60001}));negatives++;
const board=fs.readFileSync('messageboard.txt','utf8'),ownership=api.assertRuntimeOwnership();
assert.equal(ownership.release.dependencies.length,3);
for(const d of ownership.release.dependencies){
 assert.throws(()=>api.requireRuntimeRelease(board.replace(d.fileRelease,'')),/release/);
 assert.throws(()=>api.requireRuntimeRelease(board.replace(d.fileRelease,d.fileRelease.replace('ALLBUILDSFINISHED','pending'))),/release/);
 assert.throws(()=>api.requireRuntimeRelease(board+'\n'+new Date().toISOString()+' '+d.worker+' OWN newer'),/release/);
 negatives+=3;
}
// Reject chronological release inversion even when every exact FINAL exists.
{
 const [cpu,rf]=ownership.release.dependencies;
 const reversed=board.replace(rf.fileRelease,rf.fileRelease.replace(rf.fileRelease.split(' ')[0],new Date(cpu.releasedAt-1).toISOString()));
 assert.throws(()=>api.requireRuntimeRelease(reversed),/release/);negatives++;
}
assert.equal(api.diagnosticScene(Buffer.from('arbitrary pixels'),'unknown'),'unknown');
const p=route.prepare({run,pins});new vm.Script(p.source);new vm.Script(p.route);
assert.equal(p.evidence.setupTransitionDiagnostic.readinessGranted,false);
assert.equal(p.evidence.setupTransitionDiagnostic.pixelsAccepted,false);
assert.equal(p.evidence.setupTransitionDiagnostic.gameplay,false);
assert.equal(p.evidence.bounds.perACK,64);assert.equal(p.evidence.bounds.navigation,16384);
assert.equal(p.evidence.bounds.arrival,3072);assert.equal(p.evidence.bounds.route,4096);
assert(p.source.includes('personalReview'));assert(!p.source.includes('await browser.close()'));
fs.writeFileSync(path.join(run,'composition.json'),JSON.stringify(p.evidence,null,2));
fs.writeFileSync(path.join(run,'runtime-release.json'),JSON.stringify(p.createRelease()));
const saveLine=p.source.split('\n').find(line=>line.startsWith('const save='));assert(saveLine);
const start=p.source.indexOf('async function main(){'),initEnd=p.source.indexOf('  const pins=',start);
assert(start>=0&&initEnd>start);
const init=p.source.slice(start,initEnd)+'return true;\n}main();';
const bootstrap=path.join(run,'bootstrap-order'),scope={require,fs,path,RUN:run,OUT:bootstrap};
async function inputContracts(){
 const fatal=Error('earliest passive host fault');let commands=0,begins=0,delivered=0;
 const a=p.source.indexOf("if(c.action!=='quit')await hostPresentation.check();await presetAttachment.begin(c,i);"),b=p.source.indexOf('await presetAttachment.success(c);',a);
 assert(a>0&&b>a);
 await assert.rejects(vm.runInNewContext('(async()=>{'+p.source.slice(a,b)+'})()',{
  c:{action:'route-arrival'},i:14,hostPresentation:{check:async()=>{throw fatal;}},
  presetAttachment:{begin:async()=>{begins++;}},mailboxDispatch:async()=>{commands++;}}),e=>e===fatal);
 assert.equal(commands,0);assert.equal(begins,0);
 const t=p.source.indexOf('function installTransportEvidence(p){'),u=p.source.indexOf('\nasync function main()',t);
 assert(t>0&&u>t);
 const page={evaluate:async()=>{delivered++;},mouse:Object.fromEntries(['move','down','up'].map(k=>[k,async()=>{delivered++;}]))};
 const install=vm.runInNewContext(p.source.slice(t,u)+';installTransportEvidence',{
  hostPresentation:{check:async()=>{throw fatal;}},presetAttachment:{active:false,beforeStep:async()=>{}},
  commandLive:()=>{},navigationSteps:0,log:()=>{},state:async()=>({})});
 install(page);await assert.rejects(page.evaluate('WineFrozen.step',64),e=>e===fatal);
 for(const action of ['move','down','up'])await assert.rejects(page.mouse[action](),e=>e===fatal);
 assert.equal(delivered,0);
 const observeStart=p.source.indexOf("  if(c.action==='observe'){"),observeEnd=p.source.indexOf("  if(c.action==='step'){",observeStart);
 assert(observeStart>0&&observeEnd>observeStart);
 const out=path.join(run,'input-contracts');fs.mkdirSync(out);fs.writeFileSync(path.join(out,'occupied.png'),'fixture');
 for(const name of [undefined,null,42,'bad/name','occupied']){
  let steps=0,shots=0;
  await assert.rejects(vm.runInNewContext('(async()=>{'+p.source.slice(observeStart,observeEnd)+'})()',{
   require,c:{action:'observe',n:64,name},i:0,OUT:out,closing:false,deadline:Date.now()+40000,
   command:async()=>{steps++;},freshShot:async()=>{shots++;}}),/fresh capture name required/);
  assert.equal(steps,0);assert.equal(shots,0);
 }
 const batch=[{action:'observe',n:256,name:'startup-0256'},{action:'shot',name:'startup-0256-complete'},
  ...[2304,4352,6400,8448].map(n=>({action:'observe',n:2048,name:'startup-'+n}))];
 fs.writeFileSync(path.join(run,'startup-batch.json'),JSON.stringify(batch,null,2));
 const ack=JSON.parse(fs.readFileSync('scratch/runs/20261104-stronghold-repaired-entry-original-gameplay/browser/step-0-0.json'));
 const assertAck=require('../scratch/runs/20261104-stronghold-explicit-idle-input/native-start-boundary.cjs').assertAck;
 const ca=p.source.indexOf('async function command(c,i){'),cb=p.source.indexOf('let gameplayNumber=',ca);assert(ca>0&&cb>ca);
 let steps=0,acks=0,preSteps=0,shots=0;const names=[];
 const fixture={require,fs,path,OUT:out,RUN:out,Date,closing:false,halted:false,navigationSteps:0,deadline:Date.now()+40000,activeReplyDeadline:Date.now()+39000,
  held:new Set(),mouseHeld:new Set(),nativeDriver:null,sha:base.hash,log:()=>{},save:()=>{},hostPresentation:{check:async()=>{}},
  commandLive:()=>{},state:async()=>({main:{tick:{steps}}}),assertAck,
  presetAttachment:{active:false,beforeStep:async()=>{preSteps++;},ack:async(result,n)=>{assert.equal(result.requested,n);assert.equal(result.ran,n);acks++;}},
  freshShot:async name=>{api.validateCaptureCommand({action:'shot',name},out);fs.writeFileSync(path.join(out,name+'.png'),'OFFLINE CAPTURE MARKER');names.push(name);},
  page:{evaluate:async(fn,n)=>{assert(String(fn).includes('WineFrozen.step'));steps+=n;return {...structuredClone(ack),steps,guests:ack.guests.map(g=>({...g,steps}))};},
   screenshot:async()=>{shots++;return Buffer.from('OFFLINE CAPTURE MARKER');},mouse:{move:async()=>{},down:async()=>{},up:async()=>{}}}};
 const context=vm.createContext(fixture);
 vm.runInContext(p.source.slice(ca,cb)+p.source.slice(t,u)+'installTransportEvidence(page);',context);
 for(const [i,c]of batch.entries()){context.c=c;context.i=i;await vm.runInContext('command(c,i)',context);}
 assert.equal(steps,8448);assert.equal(acks,132);assert.equal(preSteps,acks);assert.equal(shots,1);assert.equal(names.length,5);
 assert.equal(fixture.navigationSteps,steps);
 fs.writeFileSync(path.join(run,'input-contracts.json'),JSON.stringify({pass:true,actualComposedCommand:true,actualTransport:true,
  terminalHostBeforeDelivery:true,invalidCaptureBeforeSteps:true,steps,acks,perACK:64,navigationCap:16384,batchCommands:batch.length,
  ordinaryInputReadiness:false,chromeSpawns:0,originalExecutions:0},null,2));
}
// Validation is real; bootstrap uses this exact preparation's process/nonce.
(async()=>{
 await inputContracts();
 assert.equal(await vm.runInNewContext(saveLine+'\n'+init,scope),true);
 assert(fs.statSync(path.join(bootstrap,'commands')).isDirectory());
 await assert.rejects(vm.runInNewContext(saveLine+'\n'+init,{...scope}),/one original launch only/);
 api.lifecycleForRun(run).restore();
 const {EventEmitter}=require('node:events');
 for(const [code,signal]of [[0,null],[1,null],[null,'SIGKILL']]){
  const child=Object.assign(new EventEmitter(),{pid:process.pid,exitCode:null,signalCode:null});let disconnected=false;
  const browser={process:()=>child,disconnect:()=>{disconnected=true;},target:()=>({createCDPSession:async()=>({send:async method=>{
   assert.equal(method,'Browser.close');setTimeout(()=>{child.exitCode=code;child.signalCode=signal;child.emit('exit',code,signal);},1);
  }})})};
  if(code===0)assert.deepEqual(await api.normalClose(browser,{timeoutMs:1000}),{pid:process.pid,code,signal});
  else await assert.rejects(api.normalClose(browser,{timeoutMs:1000}),/abnormal/);
  assert(disconnected);assert.equal(child.listenerCount('exit'),0);
 }
 // Use a different run so its single-entry latch and lifecycle recorder are fresh.
 const entry=path.join(run,'actual-entry');fs.mkdirSync(entry);const entryPins=path.join(entry,'runtime-pins.json');fs.writeFileSync(entryPins,JSON.stringify(fresh));
 const e=route.prepare({run:entry,pins:entryPins});fs.writeFileSync(path.join(entry,'runtime-release.json'),JSON.stringify(e.createRelease()));
 const puppeteer={launch:null},serverAPI=require('./static-server'),startServer=serverAPI.startStaticServer;
 const spawn=cp.spawn,nativeSpawn=cp.ChildProcess.prototype.spawn;let attempts=0,nativeAttempts=0,launches=0,httpResponses=0,server,port;
 cp.spawn=()=>{attempts++;throw Error('OFFLINE SPAWN FORBIDDEN');};
 cp.ChildProcess.prototype.spawn=function(){nativeAttempts++;throw Error('OFFLINE NATIVE SPAWN FORBIDDEN');};
 serverAPI.startStaticServer=async options=>{server=await startServer(options);port=server.address().port;return server;};
 puppeteer.launch=async()=>{
  launches++;assert(fs.existsSync(path.join(entry,'browser/runtime-ownership.json')));assert(api.lifecycleForRun(entry));
  for(const row of fresh.files){
   const response=await fetch('http://127.0.0.1:'+port+'/'+row.path);const bytes=Buffer.from(await response.arrayBuffer());
   assert.equal(response.status,200,row.path);assert.equal(base.hash(bytes),row.sha256,row.path);
   assert.equal(response.headers.get('cross-origin-opener-policy'),'same-origin');
   assert.equal(response.headers.get('cross-origin-embedder-policy'),'require-corp');assert.match(response.headers.get('cache-control'),/no-store/);httpResponses++;
  }
  throw Error('OFFLINE MOCK LAUNCH SENTINEL');
 };
 globalThis.__strongholdOfflinePuppeteer=puppeteer;
 const cut=e.source.lastIndexOf('main().catch(');assert(cut>0);
 const composed=base.replaceOnce(e.source.slice(0,cut),"const puppeteer=require('puppeteer');","const puppeteer=globalThis.__strongholdOfflinePuppeteer;");
 const caller=route.compileClosure(composed+'\nmodule.exports={main,close};',e.driver,e.route,e.evidence.retainedClosure);
 try{await assert.rejects(caller.main(),/OFFLINE MOCK LAUNCH SENTINEL/);assert.equal(launches,1);assert(server.listening);assert.equal(api.lifecycleForRun(entry).children.length,0);}
 finally{await caller.close('offline mocked launch complete');api.lifecycleForRun(entry).restore();cp.spawn=spawn;cp.ChildProcess.prototype.spawn=nativeSpawn;serverAPI.startStaticServer=startServer;delete globalThis.__strongholdOfflinePuppeteer;}
 assert.equal(server.listening,false);assert.equal(attempts,0);assert.equal(nativeAttempts,0);assert.equal(httpResponses,fresh.files.length);
 assert.equal(base.hash(fs.readFileSync('scratch/runs/20261104-stronghold-setup-transition-onward/runtime-pins.json')),api.ORIGINAL_PINS_SHA);
 const result={pass:true,originalExecutions:0,chromeSpawns:0,actualComposedEntry:true,filesystemRows:fresh.files.length,httpResponses,
  negatives,serverClosed:!server.listening,port,historicalClosureUnchanged:true,readinessGranted:false,pixelsAccepted:false,gameplay:false};
 fs.writeFileSync(path.join(run,'result-contract.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exitCode=1;});
