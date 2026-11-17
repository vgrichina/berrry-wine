'use strict';
// Generated native USER fixture only. No original media or review claims.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const cp=require('node:child_process'),net=require('node:net');
const {startControlSession}=require('./control-session');
if(process.argv[2]==='--watchdog-observation'){
 const proc=require('../tools/native-proc.cjs');
 // The parent's argv: /proc cmdline on Linux, ps elsewhere (space-split).
 const parentCommand=proc.linux?fs.readFileSync(`/proc/${process.ppid}/cmdline`,'utf8').split('\0'):
  cp.execFileSync('ps',['-o','command=','-p',String(process.ppid)],{encoding:'utf8'}).trim().split(/\s+/);
 assert(path.basename(parentCommand[0])==='timeout'&&parentCommand.includes('30s'),'independent timeout parent required');
 fs.writeFileSync(path.join(path.dirname(process.argv[3]),'watchdog-observation-armed.json'),JSON.stringify({
  at:Date.now(),parentPid:process.ppid,parentCommand,independent:true,beforeAuthoredNativeSpawn:true},null,2)+'\n',{flag:'wx'});
 const m=require('../tools/neverhood-original-current-runtime.js');
 (async()=>{
  const base=path.resolve(process.argv[3]);fs.mkdirSync(base);
  for(const name of ['disk-floor','deadline']){
   const out=path.join(base,name);fs.mkdirSync(out);
   const p=cp.spawn(process.execPath,['-e','setTimeout(()=>{},60000)'],{stdio:['ignore','pipe','pipe'],detached:true});
   m.save(out,'native-pid.json',{pid:p.pid,startToken:proc.token(p.pid)});
   const waited={};p.stdout.resume();p.stderr.resume();
   const thread=new Promise(r=>p.once('close',(code,signal)=>{Object.assign(waited,{exit:code??-require('node:os').constants.signals[signal],actualWait:true,stdoutEOF:true,stderrEOF:true});r();}));
   const free=name==='disk-floor'?1499999999:1500000000,original=m.free_bytes;
   try{
    m.free_bytes=()=>free;
    try{await m.watchdog(out,Date.now()/1000+(name==='disk-floor'?30:-.01));}finally{m.free_bytes=original;}
    await Promise.race([thread,proc.sleep(2000)]);assert('exit' in waited,'native wait did not finish');
    assert(waited.exit===-15&&waited.actualWait&&waited.stdoutEOF&&waited.stderrEOF);
    m.save(out,'authored-native-wait.json',waited);
    const trigger=JSON.parse(fs.readFileSync(path.join(out,'watchdog-trigger.json'))),end=JSON.parse(fs.readFileSync(path.join(out,'watchdog-exit.json')));
    assert(trigger.reason===name&&trigger.freeBytes===free);
    assert(trigger.deadlineElapsed===(name==='deadline')&&!trigger.nativeQuit);
    assert(end.signals[0].delivered&&!end.signals[1].delivered);
   }finally{
    if(!('exit' in waited))try{proc.killpg(p.pid,'SIGKILL');}catch{}
    await thread;
   }
  }
  const out=path.join(base,'wait-completed');fs.mkdirSync(out);m.save(out,'native-wait.json',{actualWait:true});
  await m.watchdog(out,Date.now()/1000+30);
  assert(JSON.parse(fs.readFileSync(path.join(out,'watchdog-exit.json'))).reason==='actual-native-wait');
  assert(!fs.existsSync(path.join(out,'watchdog-trigger.json')));
  console.log('PASS exact authored disk-floor/deadline triggers, real native TERM/wait/both EOF, no later KILL, completed wait sends no signal');
 })().catch(e=>{console.error(e&&e.stack||e);process.exitCode=1;});
 return;
}
if(process.argv[2]==='--desktop-participants'){
 const {ProcessDesktop,readProcessDesktopObservations:read}=require('../lib/process-desktop');
 const directory=process.env.WINE_PROCESS_DESKTOP_OBSERVE;
 assert(directory&&fs.statSync(directory).isDirectory(),'observations prearmed');
 (async()=>{
  const desktop=new ProcessDesktop({endpoint:null});
  try{
   assert.equal(desktop.observeDirectory,directory);
   const child=cp.spawnSync(process.execPath,['-e',`
    const {ProcessDesktop}=require('./lib/process-desktop');
    (async()=>{const d=new ProcessDesktop();try{
     if(d.observeDirectory!==process.env.WINE_PROCESS_DESKTOP_OBSERVE)throw Error('child observations absent');
     d.call({op:'poll',limit:7});
     console.log(JSON.stringify({pid:process.pid,client:d.observationClient,seq:d.observationSequence,
      manifest:globalThis.__disciples2Manifest}));
    }finally{await d.close()}})().catch(e=>{console.error(e);process.exitCode=1});
   `],{cwd:path.resolve(__dirname,'..'),env:desktop.environment(process.env),encoding:'utf8',timeout:15000});
   assert.equal(child.status,0,child.stderr);assert(!child.signal);
   const identity=JSON.parse(child.stdout.trim());assert.notEqual(identity.pid,process.pid);
   assert.equal(identity.manifest,globalThis.__disciples2Manifest);
   await new Promise(r=>setTimeout(r,20));
   const records=read(directory),phases=records.filter(r=>r.client===identity.client&&r.seq===identity.seq);
   for(const phase of ['main-submission','bridge-receipt','socket-write','authority-receipt','handler-completion',
    'reply-write','bridge-frame-receipt','shared-notification','main-return'])assert(phases.some(r=>r.phase===phase),phase);
   assert(phases.filter(r=>['main-submission','bridge-receipt','main-return'].includes(r.phase)).every(r=>r.pid===identity.pid));
   assert(phases.filter(r=>['authority-receipt','handler-completion','reply-write'].includes(r.phase)).every(r=>r.pid===process.pid));
   for(const [pid,roles] of [[process.pid,['desktop-main','desktop-client','desktop-authority']],
    [identity.pid,['desktop-main','desktop-client']]])for(const role of roles){
     const row=records.find(r=>r.phase==='identity'&&r.pid===pid&&r.role===role);
     assert(row&&row.osTid>0&&row.preloads.some(p=>p.sha256?.length===64),`${pid} ${role}`);
   }
   fs.writeFileSync(path.join(directory,'inherited-route.json'),JSON.stringify({passed:true,parentPid:process.pid,
    child:identity,childWait:{exit:child.status,signal:child.signal,actualWait:true,stdoutEOF:true,stderrEOF:true},
    phases:phases.map(r=>({phase:r.phase,pid:r.pid,threadId:r.threadId,role:r.role})),timeoutMs:3000},null,2)+'\n',{flag:'wx'});
   console.log('PASS prearmed actual main/client/authority and inherited OS child, nine correlated poll phases, same sealed manifest');
  }finally{await desktop.close()}
 })().catch(e=>{console.error(e);process.exitCode=1});
 return;
}
if(process.argv[2]==='--installed-provenance'){
 const preflight=require('../tools/neverhood-original-current-preflight.cjs');
 const originalRead=fs.readFileSync,originalWrite=fs.writeFileSync;
 // Exercise actual installed provenance while refusing any attempted write.
 fs.writeFileSync=()=>{throw Error('read-only provenance attempted a write');};
 try{
  const report=preflight.verifyInstalled();
  assert.equal(report.verifiedBlobs,58);assert.equal(report.completeCD.files.length,257);
  assert.equal(report.shortcut.target.toLowerCase(),'c:\\program files\\dreamworks interactive\\neverhood\\setup95.exe');
  assert.equal(report.shortcut.args,'');assert.equal(report.shortcut.workingDir,'');
  assert.equal(report.registryCompleteness.authenticInstalledLaunchReady,false);
  assert.deepEqual(report.registryCompleteness.missingPersistedValues,['Data Drive','Installed Directory','Run File']);
  assert.equal(report.registryCompleteness.originalPublicWriteObservations.length,3);
  for(const artifact of ['original/guest-registry.json','original/guest-overlay/blobs/85ee1e7c-0854-41e0-aab9-2c7456205704.bin']){
   fs.readFileSync=function(file,...args){
    const bytes=originalRead.call(this,file,...args);
    if(String(file).endsWith(artifact)){
     const bad=Buffer.from(bytes);bad[0]^=1;return bad;
    }
    return bytes;
   };
   assert.throws(()=>preflight.verifyInstalled(),/AssertionError/,'tampered '+artifact+' must be refused');
   fs.readFileSync=originalRead;
  }
 }finally{fs.readFileSync=originalRead;fs.writeFileSync=originalWrite;}
 console.log('PASS actual installed 65 records/58 blob hashes/full257 CD/shortcut; missing persisted paths refuse readiness; zero writes; corrupt registry and generated shortcut refused');
 process.exit(0);
}
if(process.argv[2]==='--unit'){
 // This unit constructs the installer profile's 900/920/90 recipe. An outer
 // installed-shortcut qualification must not silently select a different unit.
 delete process.env.NEVERHOOD_INSTALLED_SHORTCUT;
 Object.assign(process.env,{NEVERHOOD_CURRENT_RUN:'/unused',NEVERHOOD_CURRENT_PORT:'1'});
 process.chdir(path.resolve(__dirname,'..'));
 const os=require('node:os'),crypto=require('node:crypto'),Module=require('node:module');
 const m=require('../tools/neverhood-original-current-control.js');
 const rejects=async(f,check,why)=>{
  try{await f();}catch(e){if(check)check(e);return e;}
  throw new assert.AssertionError({message:why});
 };
 const isAssert=e=>{if(!(e instanceof assert.AssertionError))throw e;};
 const has=text=>e=>{isAssert(e);assert(e.message.includes(text),e.message);};
 const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'nh-unit-'));
 const now=()=>Date.now()/1000;
 (async()=>{
  const w={hwnd:'0x123',live:true,visible:true,generation:'1',processId:1,threadId:1,isChild:true,controlClass:1,style:0x50000000,nativeTextAvailable:true,textBytes:'4f4b',title:'OK',parent:'0x100',buttonFlags:0};
  const r={targetHwnd:'0x123',kind:'install',visibleLabel:'OK'},rr={snapshot:{windows:[w],physicalUp:true,capture:'0x0'}};
  assert.equal(m.button(rr,r),w);
  assert(m.presented({modalHwnd:'0x0',windows:[]}));
  const modal={hwnd:'0x200',live:true,visible:false,isChild:false,processId:1,threadId:1};
  assert(!m.presented({modalHwnd:'0x200',windows:[modal]}));
  modal.visible=true;
  assert(m.presented({modalHwnd:'0x200',windows:[modal]}));
  assert(m.presented({modalHwnd:'0x200',windows:[modal]},w));
  for(const k of ['processId','threadId']){modal[k]=2;assert(!m.presented({modalHwnd:'0x200',windows:[modal]},w));modal[k]=1;}
  for(const [key,value]of [['isChild',false],['controlClass',16],['style',0x58000000],['title','Exit'],['generation',''],['nativeTextAvailable',false]]){
   const old=w[key];w[key]=value;
   await rejects(()=>m.button(rr,r),isAssert,key);
   w[key]=old;
  }
  const originalIdentity=m.identity;
  {
   m.R=tmp();m.save('PERMANENT-UNKNOWN.json',{});
   m.identity=()=>{throw new assert.AssertionError({message:'network identity after UNKNOWN'});};
   for(const cleanup of [true,false])await rejects(()=>m.call({action:'snapshot'},{cleanup}),has('permanent UNKNOWN'),'postUNKNOWN');
   assert(!fs.existsSync(path.join(m.R,'requests.jsonl')));
   m.identity=originalIdentity;
  }
  {
   // A real independently waited OS process has exited before release. The
   // identity check must refuse transport, and its wait must never become UP ACK.
   m.R=tmp();
   const p=cp.spawn(process.execPath,['-e','setTimeout(()=>process.exit(0),200)'],{stdio:['ignore','pipe','pipe']});
   p.stdout.resume();p.stderr.resume();
   m.save('native-pid.json',{pid:p.pid,startToken:require('../tools/native-proc.cjs').token(p.pid)});
   const exit=await new Promise(res=>p.once('close',res));assert.equal(exit,0);
   m.save('native-wait.json',{pid:p.pid,exit,actualWait:true,stdoutEOF:true,stderrEOF:true});
   m.save('launch.json',{rootPort:1});
   await rejects(()=>m.release('exited','original-owner',now(),now()+1.75),null,'dead owner acknowledged UP');
   const up=m.read('exited-up.json');assert(!up.physicalUpACK&&up.outcome==='OWNER_EXITED');
   assert(up.ownerWait.actualWait&&up.ownerWait.exit===0);
   assert(!fs.existsSync(path.join(m.R,'requests.jsonl')));
  }
  {
   m.R=tmp();
   m.identity=()=>({pid:1,startToken:'fixture'});
   const image=Buffer.from('unit only; native PNG path exercised separately');fs.writeFileSync(path.join(m.R,'expired.png'),image);
   const sha=crypto.createHash('sha256').update(image).digest('hex');
   const rr={at:now()-31,completedAt:now()-30,target:m.identity(),port:1,captureId:'unit-capture',pngSHA256:sha,snapshot:{windows:[w],physicalUp:true,capture:'0x0'}};
   m.save('expired.json',rr);
   m.save('expired-review.json',{at:now()-30,rawCompleteScene:true,observation:'unit',visibleLabel:'OK',kind:'install',targetHwnd:'0x123',pngSHA256:sha});
   let operation=m.local_operation();
   // Any transport since entry, even read-only, forbids this typed outcome.
   fs.writeFileSync(path.join(m.R,'requests.jsonl'),'{"action":"snapshot"}\n');
   await rejects(()=>m.reviewed('expired',operation),has('publication'),'transport accepted for recovery');
   assert(!fs.existsSync(path.join(m.R,'expired-refused.json')));
   fs.unlinkSync(path.join(m.R,'requests.jsonl'));
   for(const artifact of ['pending-intent.json','pending-release-arm.json','pending-child-arm.json','bind-intent.json','child-bind-intent.json']){
    m.save(artifact,{});
    await rejects(()=>m.local_operation(),has('pending'),'pending publication accepted '+artifact);
    fs.unlinkSync(path.join(m.R,artifact));
   }
   operation=m.local_operation();
   await rejects(()=>m.reviewed('expired',operation),e=>{if(!(e instanceof m.RefusedBeforeDispatch))throw e;},'expired image was not typed');
   const refusal=m.read('expired-refused.json');assert.equal(refusal.invalidatedNonce,operation.nonce);
   // A fresh review cannot revive this capture, even after a new operation.
   await rejects(()=>m.review('expired','new words','OK','install','0x123'),has('invalidated'),'old image restamped');
   m.save('other-old.json',rr);fs.writeFileSync(path.join(m.R,'other-old.png'),image);
   await rejects(()=>m.review('other-old','new words','OK','install','0x123'),has('fresh native capture'),'pre-refusal capture reviewed');
   await rejects(()=>m.release('no-new-intent','owner',now()),e=>{if(e.code!=='ENOENT')isAssert(e);},'release without a fresh reviewed intent');
   assert(!fs.existsSync(path.join(m.R,'requests.jsonl')));
   m.identity=originalIdentity;
  }
  {
   m.R=tmp();m.reserve=()=>({gameplayCutoff:now()+30});
   m.identity=()=>({pid:1,startToken:'fixture'});
   m.call=async()=>({contract:'native-startup-readiness-v1',ready:true,failures:[],ordinaryOwner:{healthy:true,actorContext:false}});
   await rejects(()=>m.startup(),isAssert,'startup accepted wrong native actor');
   assert(fs.existsSync(path.join(m.R,'PERMANENT-UNKNOWN.json'))&&!fs.existsSync(path.join(m.R,'startup-ready.json')));
  }
  const rt=require('../tools/neverhood-original-current-runtime.js');
  assert.deepEqual(rt.POLICY,{confirmationMs:500,physicalUpMs:1750,observationMs:3000,gameFreshnessSeconds:15,menuFreshnessSeconds:30});
  const recipe={seconds:900,watchdogGrace:20,reserveSeconds:90,inputPolicy:rt.POLICY,childInheritance:'sealed-node-v1',cwd:rt.ROOT,originalPipelineOrdinal:1,args:['node','test/run.js','--iso=existing','--iso-drive=D','--iso-exe=SETUP95.EXE','--max-seconds=900','--real-ticks','--threads','--spawn-processes','--no-build']};
  rt.validate_recipe(recipe);
  for(const [k,v]of [['seconds',2400],['reserveSeconds',240],['watchdogGrace',30]])
   await rejects(()=>rt.validate_recipe({...recipe,[k]:v}),isAssert,'accepted obsolete clock '+k);
  console.log('PASS native BUTTON/presentation/UNKNOWN/expired-image/startup-actor guards; obsolete clocks refused');
  // The borrowed helper is compiled from published bytes, never re-read
  // through the mutable module loader.
  {
   const ext=Module._extensions['.js'];
   Module._extensions['.js']=()=>{throw new assert.AssertionError({message:'mutable path re-read'});};
   try{assert.equal(typeof rt.helper().seal,'function');}finally{Module._extensions['.js']=ext;}
   const originalRead=fs.readFileSync;
   fs.readFileSync=function(p,...rest){const body=originalRead.call(fs,p,...rest);
    return path.resolve(String(p))===path.join(rt.ROOT,rt.HELPER)?Buffer.concat([Buffer.from(body),Buffer.from('\n// unpublished')]):body;};
   try{await rejects(()=>rt.helper(),has('unpublished borrowed helper'),'executed unpublished helper');}
   finally{fs.readFileSync=originalRead;}
  }
  // No physical fixture modules exist: resolve only inventoried, verified bytes.
  // The sealed Node child route replaces the removed sealed-Python route: a
  // non-existent inventoried script runs, reads inventoried bytes, launches its
  // own non-existent inventoried child, and an on-disk uninventoried source is refused.
  // Off Linux a /dev/fd/N descriptor path only exists in a process that holds
  // N, so every sealed Node child is handed the source/module/preload fds at
  // the same numbers (Linux /proc/<pid>/fd paths work either way).
  const KEEP="const keep=[process.env.DISCIPLES2_SOURCE_FD,process.env.DISCIPLES2_MODULE_FD,(process.env.NODE_OPTIONS.match(/--require=(\\S+)/)||[])[1]].map(p=>/\\/dev\\/fd\\/(\\d+)$/.exec(p||'')).filter(Boolean).map(x=>+x[1]);const stdio=['ignore','pipe','pipe'];for(const fd of keep){while(stdio.length<fd)stdio.push('ignore');stdio[fd]=fd;}";
  const bodies={'lib/neverhood-sealed-fixture.js':Buffer.from("module.exports=require('./neverhood-sealed-value.json').value"),'lib/neverhood-sealed-value.json':Buffer.from('{"value":73}'),
   'test/neverhood-sealed-node-child.cjs':Buffer.from('console.log(73)'),
   'test/neverhood-sealed-node.cjs':Buffer.from("const a=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process');"+KEEP+
    "a.equal(fs.readFileSync('test/neverhood-sealed-node-child.cjs','utf8'),'console.log(73)');"+
    "a(fs.readFileSync('lib/neverhood-sealed-fixture.js','utf8').startsWith('module.exports='));"+
    "a.equal(JSON.parse(fs.readFileSync('lib/neverhood-sealed-value.json')).value,73);"+
    "a.equal(fs.readFileSync('test/test-vb5cce-original-current.cjs','utf8'),'SEALED_CJS_HASH');"+
    "const r=cp.spawnSync(process.execPath,['-e',\"require('./test/neverhood-sealed-node-child.cjs')\"],{stdio});"+
    "a.equal(r.status,0,String(r.stderr));a.equal(String(r.stdout).trim(),'73');"+
    "a.throws(()=>require('./tools/native-proc.cjs'),/unsealed runtime input/);"+
    "console.log('NODE_INHERITANCE_PASS');"),
   'test/test-vb5cce-original-current.cjs':Buffer.from('SEALED_CJS_HASH')};
  const [pool,index]=rt.H.indexed_sources(bodies);const source=rt.H.seal('resolver-test-source',pool);
  const preload=rt.H.seal('resolver-test-preload',fs.readFileSync(path.join(rt.ROOT,rt.PRELOAD))),module=rt.H.seal('resolver-test-module',Buffer.from('\0asm'));
  const env={...process.env,DISCIPLES2_ROOT:rt.ROOT,DISCIPLES2_PHASE:'runtime',DISCIPLES2_SOURCE_FD:rt.fdPath(source),DISCIPLES2_SOURCE_SHA256:rt.H.digest(pool),DISCIPLES2_SOURCE_INDEX_SHA256:rt.H.digest(index),DISCIPLES2_MODULE_FD:rt.fdPath(module),DISCIPLES2_MODULE_SHA256:rt.H.digest(Buffer.from('\0asm')),DISCIPLES2_MANIFEST_SHA256:'a'.repeat(64)};
  env.NODE_OPTIONS='--preserve-symlinks --require='+rt.fdPath(preload);
  const fds=[source,preload,module];
  let code="const a=require('node:assert/strict'),cp=require('node:child_process'),{Worker}=require('node:worker_threads');"+KEEP+"const req=\"require('./lib/neverhood-sealed-fixture')\";a.equal(eval(req),73);a.throws(()=>require('./lib/neverhood-not-in-source-inventory'),{code:'MODULE_NOT_FOUND'});const c=cp.spawnSync(process.execPath,['-e','console.log('+req+')'],{env:process.env,stdio});a.equal(c.status,0,c.stderr.toString());a.equal(c.stdout.toString().trim(),'73');new Worker(\"require('node:worker_threads').parentPort.postMessage(\"+req+\")\",{eval:true}).on('message',n=>a.equal(n,73));";
  code+="const sealed=cp.spawnSync(process.execPath,['-e',\"require('./test/neverhood-sealed-node.cjs')\"],{env:process.env,stdio});a.equal(sealed.status,0,sealed.stderr.toString());a.match(sealed.stdout.toString(),/NODE_INHERITANCE_PASS/);a.throws(()=>require('./tools/native-proc.cjs'),/unsealed runtime input/);";
  const p=cp.spawnSync(process.execPath,['-e',code],{env,stdio:rt.stdioWith(['ignore','pipe','pipe'],fds)});
  assert.equal(p.status,0,String(p.stderr));
  {
   const out=tmp();
   const result=await rt.checked(out,'sealed-node',[process.execPath,'-e',"require('./test/neverhood-sealed-node.cjs')"],env,240,fds);
   assert(result.includes('NODE_INHERITANCE_PASS'));
  }
  for(const fd of fds)fs.closeSync(fd);
  console.log('PASS native BUTTON/obsolete clock/UNKNOWN guards; borrowed helper refusal; sealed missing-path main/Worker/OSchild JS+JSON resolution, unknown source refused');
 })().then(()=>process.exit(0),e=>{console.error(e&&e.stack||e);process.exit(1);});
 return;
}
if(process.argv[2]==='--admission'){
 process.chdir(path.resolve(__dirname,'..'));
 const m=require('../tools/neverhood-original-current-runtime.js'),os=require('node:os'),crypto=require('node:crypto');
 (async()=>{
  const base=path.resolve(process.argv[3]);fs.mkdirSync(base);const original=JSON.parse(fs.readFileSync(process.argv[4],'utf8'));
  const cases=[['valid',null],['missing-holder','moduleHolder'],['missing-manifest','immutableManifest'],['missing-inheritance','childInheritance'],['wrong-reserve','reserveSeconds'],['wrong-source','sourceSHA256'],['wrong-holder','holder'],['unsealed-holder','unsealed']];
  for(const [name,fault]of cases){
   const out=path.join(base,name);fs.mkdirSync(out);const r=structuredClone(original);let raw=null;
   if(['moduleHolder','immutableManifest','childInheritance'].includes(fault))delete r[fault];
   else if(fault==='reserveSeconds')r[fault]=180;
   else if(fault==='sourceSHA256')r.immutableManifest[fault]='0'.repeat(64);
   else if(fault==='holder'||fault==='unsealed'){
    const holder=JSON.parse(fs.readFileSync(r.moduleHolder,'utf8'));
    if(fault==='holder')holder.startToken='wrong';
    else{
     // An ordinary writable (never sealed) descriptor: an unlinked file.
     const file=path.join(os.tmpdir(),'unsealed-negative-'+crypto.randomUUID());
     raw=fs.openSync(file,'wx+');fs.unlinkSync(file);fs.writeSync(raw,'{}');
     Object.assign(holder,{pid:process.pid,startToken:require('../tools/native-proc.cjs').token(process.pid),manifestPath:m.fdPath(raw)});
    }
    const p=path.join(out,'fake-holder.json');fs.writeFileSync(p,JSON.stringify(holder));r.moduleHolder=p;
   }
   let passed;
   try{await m.run(out,r,true);passed=true;}catch{passed=false;}
   assert.equal(passed,fault===null,name);
   assert(!fs.existsSync(path.join(out,'native-pid.json'))&&!fs.existsSync(path.join(out,'watchdog-armed.json')));
   if(fault)assert.equal(JSON.parse(fs.readFileSync(path.join(out,'prelaunch-refusal.json'),'utf8')).originalLaunched,false);
   if(raw!==null)fs.closeSync(raw);
  }
  console.log('PASS exact original admission path: valid sealed Worker/process inheritance and seven pre-spawn fail-closed refusals');
 })().then(()=>process.exit(0),e=>{console.error(e&&e.stack||e);process.exit(1);});
 return;
}
const out=path.resolve(process.argv[2]),root=path.resolve(__dirname,'..');
fs.mkdirSync(out,{recursive:true});
const image=path.join(out,'generated-context.exe');
const fixture=require('./test-cli-native-scene-context.cjs').fixture(),raw=r=>r-0x1000+0x200;
// The old fixture reused both strings: two generations could produce identical
// pictures. Distinguish real guest-created scenes without altering runtime paint.
const calls=Buffer.from([0x68,0x10,0,0,0,0x68,0x40,0x25,0x40,0,0x68,0x80,0x25,0x40,0]);
const first=fixture.indexOf(calls),second=fixture.indexOf(calls,first+1);assert(first>=0&&second>first);
fixture.write('Native controller: first\0',raw(0x2540));
fixture.writeUInt32LE(0x402700,second+6);fixture.writeUInt32LE(0x402780,second+11);
fixture.write('Native controller: second\0',raw(0x2700));
fixture.write('Second native modal. OK exits the generated fixture.\0',raw(0x2780));
require('./test-neverhood-child-handoff.cjs').releaseBeforeExit(fixture);
fs.writeFileSync(image,fixture,{flag:'wx'});
function delayedStartupFixture(delayMs){
 const b=Buffer.from(fixture),u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];
 // Authored real GetTickCount loop then ShowWindow. Uncapped CLI Sleep
 // intentionally uses batch time; do not alter the production clock policy.
 b.writeUInt32LE(0x1c00,raw(0x1904));b.write('GetTickCount\0',raw(0x1c02));
 b.writeUInt32LE(0x1c20,raw(0x1954));b.write('ShowWindow\0',raw(0x1c22));
 const style=b.indexOf(Buffer.from([0x68,0,0,0,0x90]),raw(0x2000));assert(style>=0);
 b.writeUInt32LE(0x80000000,style+1);
 const create=b.indexOf(Buffer.from([0xff,0x15,0x48,0x19,0x40,0,0x89,0xc6]),style);assert(create>style);
 const at=create+8,extra=Buffer.from([0xff,0x15,...u32(0x401904),0x50,
   0xff,0x15,...u32(0x401904),0x2b,0x04,0x24,0x3d,...u32(delayMs),0x72,0xf0,0x83,0xc4,4,
   0x6a,1,0x56,0xff,0x15,...u32(0x401954)]);
 b.copy(b,at+extra.length,at,raw(0x2500)-extra.length);extra.copy(b,at);return b;
}
function delayedDialogFixture(transition=false){
 const b=require('./test-vb5-native-dialog-identity.cjs').fixture({simpleButton:true}),u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];
 b.writeUInt32LE(0x1af0,raw(0x1904));b.fill(0,raw(0x1af2),raw(0x1b00));b.write('GetTickCount\0',raw(0x1af2));
 const callback=Buffer.from(b.subarray(raw(0x2300),raw(0x2400)));
 const delay=Buffer.from([0x81,0x7c,0x24,8,...u32(0x110),0x75,26,
   0xff,0x15,...u32(0x401904),0x50,0xff,0x15,...u32(0x401904),
   0x2b,0x04,0x24,0x3d,...u32(transition?900:3800),0x72,0xf0,0x83,0xc4,4]);
 Buffer.concat([delay,callback]).copy(b,raw(0x2300),0,0x100);
 if(transition){
   const boxCall=fixture.indexOf(Buffer.from([0xff,0x15,0x4c,0x19,0x40,0]),first);
   const entry=Buffer.concat([fixture.subarray(raw(0x2000),boxCall+6),
     Buffer.from([0x6a,0,0x68,...u32(0x402300),0x56,0x6a,1,0x68,...u32(0x400000),
       0xff,0x15,...u32(0x401950),0x6a,0,0xff,0x15,...u32(0x401900)])]);
   b.fill(0,raw(0x2000),raw(0x2300));entry.copy(b,raw(0x2000));
   b.write('Native controller: first\0',raw(0x2540));
 }
 return b;
}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const save=(n,v)=>fs.writeFileSync(path.join(out,n),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
async function main(){
 const modes=process.env.NEVERHOOD_NATIVE_MODES?.split(',')||['positive','game-positive','game-aged-positive','game-stale-fault','stale-intent-recovery','repaint-positive','transition-hidden-positive','transition-hidden-timeout','focus-fault','owner-fault','semantic-fault','stale-fault','child-caption-fault'];
 for(const [index,mode] of modes.entries()){
  const run=path.join(out,mode);fs.mkdirSync(run);
  const startupMode=mode.startsWith('startup-');
  const atomicMode=mode.startsWith('atomic-');
  const nativeImage=startupMode||atomicMode?path.join(run,'delayed-show.exe'):image;
  if(startupMode)fs.writeFileSync(nativeImage,delayedStartupFixture(mode==='startup-never-visible'?60000:3800),{flag:'wx'});
  if(atomicMode)fs.writeFileSync(nativeImage,delayedDialogFixture(mode==='atomic-transition-positive'),{flag:'wx'});
  const inventoryBytes=fs.readFileSync(path.join(out,'../runtime-inputs.json'));
  const inventory=JSON.parse(inventoryBytes),crypto=require('node:crypto');
  // One complete sealed inventory per run; each generated controller needs
  // only its two executed controller pins, not thousands of duplicate source rows.
  fs.writeFileSync(path.join(run,'runtime-inputs.json'),JSON.stringify({gitSHA:inventory.gitSHA,moduleSHA256:inventory.moduleSHA256,
    completeInventorySHA256:crypto.createHash('sha256').update(inventoryBytes).digest('hex'),
    completeInventory:'../../runtime-inputs.json',sources:inventory.sources.filter(r=>[
      'tools/neverhood-original-current-control.js','tools/neverhood-original-current-runtime.js'].includes(r.path))}));
  // Ask the OS for a fresh local port rather than sharing a fixed fixture
  // range with other workers. The PID/socket identity check still refuses
  // any intervening bind; it never contacts or retries a foreign listener.
  const reservation=net.createServer();
  await new Promise((resolve,reject)=>{reservation.once('error',reject);reservation.listen(0,'127.0.0.1',resolve);});
  const port=reservation.address().port;
  await new Promise((resolve,reject)=>reservation.close(error=>error?reject(error):resolve()));
  const start=Date.now()/1000;
  // Fixture budget is 240s so the identical 180s reserve remains applicable.
  fs.writeFileSync(path.join(run,'launch.json'),JSON.stringify({deadline:start+240,gameplayCutoff:start+60,reserveSeconds:180,rootPort:port}));
  const watchdog=cp.spawn(process.execPath,['-e',`let pid;const timer=setTimeout(()=>{if(pid)try{process.kill(-pid,'SIGTERM')}catch{};process.exit(2)},65000);console.log('ARMED');process.stdin.on('data',b=>pid=Number(b));process.stdin.on('end',()=>clearTimeout(timer));`],{stdio:['pipe','pipe','pipe']});
  let ws='',we='';watchdog.stdout.on('data',b=>ws+=b);watchdog.stderr.on('data',b=>we+=b);
  const wclosed=new Promise(resolve=>watchdog.on('close',(exit,signal)=>resolve({exit,signal})));
  while(!ws.includes('ARMED'))await pause(5);
  fs.writeFileSync(path.join(run,'watchdog-armed.json'),JSON.stringify({pid:watchdog.pid,at:Date.now(),prearmed:true,deadlineMs:65000,stdout:ws}));
  const s=startControlSession(['test/run.js','--exe='+nativeImage,'--no-build','--spawn-processes','--threads','--real-ticks','--screen=800x600','--control-stdin','--control='+port,'--max-seconds=60','--max-batches=100000000','--stuck-after=0','--quiet-api','--quiet-blocks','--no-close'],{cwd:root,spawnOptions:{detached:true}});
  const send=s.send;let requests=0;
  s.send=command=>{
    assert(!fs.existsSync(path.join(run,'PERMANENT-UNKNOWN.json')),'permanent UNKNOWN; fixture sends no later requests');
    requests++;fs.appendFileSync(path.join(run,'fixture-requests.jsonl'),JSON.stringify({at:Date.now(),action:command.action})+'\n');return send(command);
  };
  s.child.once('close',(exit,signal)=>{const target=path.join(run,'native-wait.json'),pending=target+'.pending';fs.writeFileSync(pending,JSON.stringify({pid:s.child.pid,exit,signal,actualWait:true,stdoutEOF:s.child.stdout.readableEnded,stderrEOF:s.child.stderr.readableEnded}),{flag:'wx'});fs.renameSync(pending,target);});
  watchdog.stdin.write(String(s.child.pid));
  fs.writeFileSync(path.join(run,'native-pid.json'),JSON.stringify({pid:s.child.pid,startToken:require('../tools/native-proc.cjs').token(s.child.pid)}));
  let controllerRuns=0;
  const controller=async(args,expected=0)=>{
    const startedAt=Date.now();
    const p=await new Promise(resolve=>{
      const child=cp.spawn(process.execPath,['tools/neverhood-original-current-control.js',...args],{cwd:root,env:{...process.env,NEVERHOOD_CURRENT_RUN:run,NEVERHOOD_CURRENT_PORT:String(port)},timeout:7000});
      let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
      child.on('close',(status,signal)=>resolve({pid:child.pid,status,signal,stdout,stderr,actualWait:true,
        stdoutEOF:child.stdout.readableEnded,stderrEOF:child.stderr.readableEnded,startedAt,waitedAt:Date.now()}));
    });
    const prefix=(++controllerRuns)+'-'+args.join('-').replace(/[^a-z0-9-]/gi,'_').slice(0,100);
    fs.writeFileSync(path.join(run,prefix+'.log'),p.stdout+p.stderr);
    fs.writeFileSync(path.join(run,prefix+'-wait.json'),JSON.stringify({...p,stdout:undefined,stderr:undefined,args}));
    assert(p.stdoutEOF&&p.stderrEOF,'controller pipes must drain before its result');
    if(expected===0||expected===3)assert.equal(p.status,expected,p.stdout+p.stderr);else assert.notEqual(p.status,0,'fault must fail');
    return p;
  };
  try{
    if(mode==='atomic-hidden-repro'||mode==='atomic-hidden-positive'){
      let hidden;const end=Date.now()+10000;
      do{hidden=await s.send({action:'native-startup-readiness'});if(hidden.failures.includes('modal.visible'))break;assert(Date.now()<end);await pause(5);}while(true);
      if(mode==='atomic-hidden-repro'){
        await assert.rejects(s.send({action:'native-reviewed-capture',path:path.join(run,'refused.png')}),/modal.visible/);
        assert(!fs.existsSync(path.join(run,'refused.png')));
        fs.writeFileSync(path.join(run,'PERMANENT-UNKNOWN.json'),JSON.stringify({reason:'authored modal.visible native refusal',noLaterRequests:true}));
      }else{
        const file=path.join(run,'atomic.png'),started=Date.now();let cap,polls=0;
        do{cap=await s.send({action:'native-presentation-capture',path:file});polls++;
          if(cap.contract!=='native-presentation-pending-v1')break;
          assert(cap.pending&&!fs.existsSync(file));assert(Date.now()-started<5000);await pause(5);
        }while(true);
        assert(polls>1);assert.equal(cap.contract,'native-reviewed-context-v1');assert(cap.completedAt-cap.startedAt<3000);
        assert(require('pngjs').PNG.sync.read(fs.readFileSync(file)).width===800);
      }
      save(mode+'-proof.json',{passed:true,authoredNativeDialog:true,actualHiddenWM_INITDIALOG:true,unchangedRefusal:true,pendingAllocatesNoPNG:true,zeroBindInput:true,noRefusedCaptureRetry:true});continue;
    }
    if(startupMode){
      const first=await s.send({action:'native-startup-readiness'});assert.equal(first.ready,false);
      if(mode==='startup-never-visible'){
        const launch=JSON.parse(fs.readFileSync(path.join(run,'launch.json')));launch.gameplayCutoff=Date.now()/1000+4;launch.deadline=launch.gameplayCutoff+launch.reserveSeconds;
        fs.writeFileSync(path.join(run,'launch.json'),JSON.stringify(launch));
        await controller(['startup'],1);
        const ledger=fs.readFileSync(path.join(run,'requests.jsonl'),'utf8');
        assert(ledger.trim().split('\n').every(l=>JSON.parse(l).action==='native-startup-readiness'));
        for(const args of [['startup'],['capture','later'],['bind','later']])await controller(args,1);
        assert.equal(fs.readFileSync(path.join(run,'requests.jsonl'),'utf8'),ledger);
        save(mode+'-proof.json',{passed:true,zeroCaptureBindInput:true,permanentUNKNOWN:true,laterHTTP:0});continue;
      }
      await controller(['startup']);
      const ready=JSON.parse(fs.readFileSync(path.join(run,'startup-ready.json')));
      assert(ready.completedAt-ready.startedAt>3);assert(ready.native.ordinaryOwner.actorContext);
      const ledger=fs.readFileSync(path.join(run,'requests.jsonl'),'utf8');
      assert(ledger.trim().split('\n').every(l=>JSON.parse(l).action==='native-startup-readiness'));
      save(mode+'-proof.json',{passed:true,guestGetTickCountDelayMs:3800,actualShowWindow:true,zeroCaptureBindInputBeforeReady:true,separateStartupSeconds:ready.completedAt-ready.startedAt,captureDeadlineMs:3000});
    }
    let scene;const due=Date.now()+15000;
    do{scene=await s.send({action:'snapshot'});if(scene.modalHwnd!=='0x0')break;assert(Date.now()<due);await pause(30);}while(true);
    if(mode.startsWith('transition-hidden-')){
      // Authored lifecycle injection only: use the actual next native modal's
      // visibility bit. The original application is never modified or resumed.
      const proof=path.join(run,'native-visibility-transition.json');
      await s.send({action:'eval',code:`(()=>{const e=instance.exports,first=e.modal_dialog_hwnd();const timer=setInterval(()=>{const h=e.modal_dialog_hwnd();if(!h||h===first)return;clearInterval(timer);const style=e.wnd_get_style_export(h);e.wnd_set_style_export(h,style&~0x10000000);renderer.showWindow(h,0);const p={authoredOnly:true,hwnd:h,hiddenAt:Date.now(),restored:false};console.log('NV_NATIVE_VISIBILITY '+JSON.stringify(p));${mode==='transition-hidden-positive'?`setTimeout(()=>{e.wnd_set_style_export(h,style);renderer.showWindow(h,1);renderer.repaint();p.restored=true;p.shownAt=Date.now();console.log('NV_NATIVE_VISIBILITY '+JSON.stringify(p));},650);`:''}},1);return true})()`});
    }
    const staleRecovery=['stale-fault','game-stale-fault','stale-intent-recovery'].includes(mode);
    if(staleRecovery){
      await controller(['capture','expired-scene']);
      const rr=JSON.parse(fs.readFileSync(path.join(run,'expired-scene.json')));
      const kind=mode==='stale-fault'?'install':'game';
      const target=rr.snapshot.windows.find(w=>w.isChild&&w.controlClass===1&&w.controlId===1).hwnd;
      await controller(['review','expired-scene','Authored native fixture complete whole image','OK',kind,target]);
      if(mode==='stale-intent-recovery')await controller(['bind','expired-scene']);
      const ledger=fs.readFileSync(path.join(run,'requests.jsonl'),'utf8');
      const launch=fs.readFileSync(path.join(run,'launch.json'),'utf8');
      const image=fs.readFileSync(path.join(run,'expired-scene.json'),'utf8');
      const review=fs.readFileSync(path.join(run,'expired-scene-review.json'),'utf8');
      await pause(Math.max(0,(rr.at+(kind==='game'?15.05:30.05))*1000-Date.now()));
      const args=mode==='stale-intent-recovery'?['intent','expired-action','expired-scene','215','139',kind]:['bind','expired-scene'];
      const refused=await controller(args,3);
      assert.equal(JSON.parse(refused.stdout).outcome,'REFUSED_BEFORE_DISPATCH');
      assert(!fs.existsSync(path.join(run,'PERMANENT-UNKNOWN.json')));
      assert(!fs.existsSync(path.join(run,'expired-action-intent.json')));
      assert(!fs.existsSync(path.join(run,'expired-action-release-arm.json')));
      assert.equal(fs.readFileSync(path.join(run,'requests.jsonl'),'utf8'),ledger);
      assert.equal(fs.readFileSync(path.join(run,'launch.json'),'utf8'),launch);
      assert.equal(fs.readFileSync(path.join(run,'expired-scene.json'),'utf8'),image);
      assert.equal(fs.readFileSync(path.join(run,'expired-scene-review.json'),'utf8'),review);
      await controller(['review','expired-scene','Cannot restamp an invalidated capture','OK',kind,target],1);
      assert.equal(fs.readFileSync(path.join(run,'requests.jsonl'),'utf8'),ledger);
      save(mode+'-recovery-proof.json',{passed:true,typedRefusal:true,zeroTransportIntentArm:true,oldCaptureReviewImmutable:true,originalClocksUnchanged:true,invalidatedOldReview:true,explicitFreshCaptureAndReviewRequired:true});
    }
    if(!staleRecovery&&!['atomic-transition-positive','startup-delayed-visible','positive','game-positive','game-aged-positive','repaint-positive','transition-hidden-positive','transition-hidden-timeout'].includes(mode)){
      await s.send({action:'frozen',mode:'on'});
      await controller(['capture','fault-scene']);
      const rr=JSON.parse(fs.readFileSync(path.join(run,'fault-scene.json')));scene=rr.snapshot;
      await controller(['review','fault-scene','Generated NT4 native fixture fault; complete raw image retained','OK',mode==='game-stale-fault'?'game':'install',scene.focus]);
      if(mode==='stale-fault'||mode==='game-stale-fault'){
        await pause(Math.max(0,(rr.at+(mode==='game-stale-fault'?15.05:30.05))*1000-Date.now()));
        await controller(['bind','fault-scene'],1);
      }else{
        await controller(['bind','fault-scene']);
        const owner=JSON.parse(fs.readFileSync(path.join(run,'input-owner.json'))),nonce='fresh-'+mode;
        const review=JSON.parse(fs.readFileSync(path.join(run,'fault-scene-review.json')));
        const q=await s.send({action:'guarded-input',cmd:'mousedown:215:139',guard:{...owner,nonce,reviewed:true,deadline:Date.now()+500,intent:{review:{contract:'native-reviewed-context-v1',captureId:rr.captureId,pngSHA256:rr.pngSHA256,reviewed:true,reviewedAt:review.at*1000,scope:'menu',targetHwnd:review.targetHwnd}}}});
        assert(!q.consumed);
        const code=mode==='child-caption-fault'?`(()=>{const h=instance.exports.get_focus_hwnd(),p=instance.exports.native_user_text_ptr(h);new Uint8Array(memory.buffer)[p]=88;return true})()`:mode==='focus-fault'?'instance.exports.set_focus(instance.exports.get_main_hwnd());true':mode==='owner-fault'?'renderer.handleMouseDown=renderer.handleMouseDown.bind(renderer);true':"(()=>{const h=instance.exports.modal_dialog_hwnd(),p=instance.exports.wnd_lookup_title(h);new Uint8Array(memory.buffer)[p]=88;renderer.setWindowText(h,'Changed semantic caption');return true})()";
        await s.send({action:'eval',code});
        await s.send({action:'step',n:1});
        const r=await s.send({action:'guarded-status',nonce});
        assert.equal(r.state,'CANCELLED');assert(!r.consumed);
        const after=await s.send({action:'snapshot'});assert(after.physicalUp);assert.equal(after.modalHwnd,scene.modalHwnd);
        if(mode==='child-caption-fault')assert.notEqual(after.windows.find(w=>w.hwnd===after.focus).title,scene.windows.find(w=>w.hwnd===scene.focus).title);
        if(mode==='semantic-fault')assert.notEqual(after.windows.find(w=>w.hwnd===after.modalHwnd).title,scene.windows.find(w=>w.hwnd===scene.modalHwnd).title);
        save(mode+'.json',{receipt:r,physicalUp:after.physicalUp,modalUnchanged:true,semanticChange:mode==='semantic-fault'});
        // Caller closes locally after the consume-time refusal, without any
        // second bind or further native request.
        fs.writeFileSync(path.join(run,'PERMANENT-UNKNOWN.json'),JSON.stringify({name:mode,at:Date.now()/1000,noLaterRequests:true,receipt:r}),{flag:'wx'});
      }
      assert(fs.existsSync(path.join(run,'PERMANENT-UNKNOWN.json')));
      const count=requests,ledger=fs.readFileSync(path.join(run,'requests.jsonl'),'utf8');
      for(const args of [['startup'],['capture','after-unknown'],['bind','fault-scene'],['intent','retry','fault-scene','215','139','install'],['review','fault-scene','No UNKNOWN recovery','OK','install',scene.focus],['release','forbidden','owner',String(Date.now()/1000)]])await controller(args,1);
      assert.equal(requests,count);assert.equal(fs.readFileSync(path.join(run,'requests.jsonl'),'utf8'),ledger);
      save(mode+'-terminal.json',{permanentUNKNOWN:true,laterRequests:0,rebindReplayRetry:false,hostTeardownOnly:true});
    }else{
      let generation;
      for(let i=0;i<2;i++){
        const current=await s.send({action:'snapshot'});
        const b=current.windows.find(w=>w.isChild&&w.controlClass===1&&w.controlId===1&&w.parent===current.modalHwnd);assert(b);
        const name='scene'+i;await controller(['capture',name]);
        const record=JSON.parse(fs.readFileSync(path.join(run,name+'.json')));
        if(startupMode&&!i){
          const ready=JSON.parse(fs.readFileSync(path.join(run,'startup-ready.json')));
          assert(record.at>=ready.completedAt);assert(record.completedAt-record.at<3);
        }
        const modal=record.snapshot.windows.find(w=>w.hwnd===record.snapshot.modalHwnd);
        assert.equal(modal.title,i&&mode==='atomic-transition-positive'?'Native DialogBox outer':'Native controller: '+(i?'second':'first'));
        const png=require('pngjs').PNG.sync.read(fs.readFileSync(path.join(run,name+'.png')));
        assert.equal(png.width,800);assert.equal(png.height,600);
        const colors=new Set();for(let y=modal.y;y<modal.y+modal.h;y++)for(let x=modal.x;x<modal.x+modal.w;x++)colors.add(png.data.readUInt32LE((y*png.width+x)*4));
        assert(colors.size>8,'modal must have visible rendered content');
        if(i)assert.notEqual(record.pngSHA256,JSON.parse(fs.readFileSync(path.join(run,'scene0.json'))).pngSHA256,'distinct native dialog must have distinct paint');
        if(i)assert.notEqual(modal.generation,generation);generation=modal.generation;
        let description='Automated generated native USER protocol fixture; no personal original review claim';
        if(process.env.NEVERHOOD_PERSONAL_FIXTURE_REVIEW==='1'){
          const personal=path.join(run,name+'-personal.json'),due=record.at*1000+29000;
          while(!fs.existsSync(personal)){assert(Date.now()<due,'personal complete fixture review expired');await pause(10);}
          const reviewed=JSON.parse(fs.readFileSync(personal));
          assert.equal(reviewed.pngSHA256,record.pngSHA256);assert(reviewed.at>=record.completedAt&&reviewed.at<=Date.now()/1000);
          description=reviewed.observation;assert(description.length>20);
        }
        const inputKind=i?'quit':mode.startsWith('game-')?'game':'install';
        await controller(['review',name,description,'OK',inputKind,record.snapshot.windows.find(w=>w.isChild&&w.controlClass===1&&w.controlId===1&&w.title==='OK').hwnd]);
        if(!i&&mode==='game-aged-positive')await pause(Math.max(0,record.at*1000+10000-Date.now()));
        if(mode==='repaint-positive'){
          await s.send({action:'eval',code:`renderer.colors.desktop='${i?"#335522":"#552233"}';renderer.repaint();true`});
          const current=await s.send({action:'png',path:path.join(run,name+'-repaint.png')});
          const hash=require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(run,name+'-repaint.png'))).digest('hex');
          assert.notEqual(hash,record.pngSHA256,'same-target repaint must actually change full PNG');
          save(name+'-repaint-proof.json',{original:record.pngSHA256,current:hash,unchangedTarget:true});
        }
        if(!i&&!fs.existsSync(path.join(run,'input-owner.json')))await controller(['bind',name]);
        await controller(['intent','press'+i,name,String(b.x+Math.floor(b.w/2)),String(b.y+Math.floor(b.h/2)),inputKind],mode==='transition-hidden-timeout'&&!i?1:0);
        if(!i&&mode==='game-aged-positive'){
          const down=JSON.parse(fs.readFileSync(path.join(run,'press0-down.json')));
          const age=down.receipt.consumedAt-record.at*1000;
          assert(age>=10000&&age<15000);save('game-age-proof.json',{captureToNativeDownMs:age,scope:'game',honestTimes:true});
        }
        if(!i&&mode.startsWith('transition-hidden-')){
          const pending=JSON.parse(fs.readFileSync(path.join(run,'press0-pending-presentation.json')));
          assert.equal(pending.snapshot.windows.find(w=>w.hwnd===pending.snapshot.modalHwnd).visible,false);
          const up=JSON.parse(fs.readFileSync(path.join(run,'press0-up.json')));assert(up.physicalUpACK);
          const visibility=[...s.output().matchAll(/^NV_NATIVE_VISIBILITY (.+)$/gm)].map(m=>JSON.parse(m[1])).at(-1);assert(visibility);fs.writeFileSync(path.join(run,'native-visibility-transition.json'),JSON.stringify(visibility),{flag:'wx'});
          if(mode==='transition-hidden-timeout'){
            assert(fs.existsSync(path.join(run,'PERMANENT-UNKNOWN.json')));
            assert(!fs.existsSync(path.join(run,'press0-after.png')),'unpresented modal must never be captured');
            const ledger=fs.readFileSync(path.join(run,'requests.jsonl'),'utf8');
            assert.equal(ledger.trim().split('\n').map(JSON.parse).filter(r=>r.action==='native-presentation-capture').length,1);
            await controller(['capture','after-unknown'],1);
            assert.equal(fs.readFileSync(path.join(run,'requests.jsonl'),'utf8'),ledger,'UNKNOWN sends no later HTTP');
            assert.equal(visibility.restored,false);save(mode+'-timeout.json',{nativePendingObserved:true,noInvalidCapture:true,independentPhysicalUp:true,permanentUNKNOWN:true,laterRequests:0});break;
          }
          const complete=JSON.parse(fs.readFileSync(path.join(run,'press0-completion.json')));
          const observation=JSON.parse(fs.readFileSync(path.join(run,'press0-observation.json')));
          assert(visibility.restored&&observation.at*1000>=visibility.shownAt);
          assert(complete.elapsedMs<3000);assert(observation.image.snapshot.physicalUp);
        }
      }
      if(mode!=='transition-hidden-timeout'){
        const end=Date.now()+4000;while(s.child.exitCode===null){assert(Date.now()<end,'native ExitProcess not observed');await pause(20);}
        assert.equal(s.child.exitCode,0);save(mode+'-positive.json',{nativeExit:0,ordinaryNativeUser:true,twoGenerations:true});
      }
    }
  }catch(error){
    const terminal=path.join(run,'PERMANENT-UNKNOWN.json');
    if(!fs.existsSync(terminal))fs.writeFileSync(terminal,JSON.stringify({name:'fixture',error:String(error),at:Date.now()/1000,noLaterRequests:true}),{flag:'wx'});
    throw error;
  }finally{
    // UNKNOWN forbids even the historical generic teardown request. Host
    // process-group termination is distinct from ordinary guest native Quit.
    if(s.child.exitCode===null)try{process.kill(-s.child.pid,'SIGTERM');}catch(error){if(error.code!=='ESRCH')throw error;}
    await s.exited;
    fs.writeFileSync(path.join(run,'native.log'),s.output());
    const nativeQuitModes=['stale-fault','game-stale-fault','stale-intent-recovery','startup-delayed-visible','positive','game-positive','game-aged-positive','repaint-positive','transition-hidden-positive'];
    save(mode+'-native-wait.json',{pid:s.child.pid,exit:s.child.exitCode,signal:s.child.signalCode,actualWait:true,stdoutEOF:s.child.stdout.readableEnded,stderrEOF:s.child.stderr.readableEnded,nativeQuit:nativeQuitModes.includes(mode)&&s.child.exitCode===0,hostTeardown:!nativeQuitModes.includes(mode)});
    if(['stale-fault','game-stale-fault','stale-intent-recovery'].includes(mode)&&s.child.exitCode===0){
      const expired=JSON.parse(fs.readFileSync(path.join(run,'expired-scene.json'))),fresh=JSON.parse(fs.readFileSync(path.join(run,'scene0.json')));
      const refusal=JSON.parse(fs.readFileSync(path.join(run,'expired-scene-refused.json'))),review=JSON.parse(fs.readFileSync(path.join(run,'scene0-review.json')));
      assert(fresh.captureId!==expired.captureId&&fresh.at>refusal.at&&review.at>=fresh.completedAt);
      assert(fs.existsSync(path.join(run,'press0-completion.json'))&&fs.existsSync(path.join(run,'press1-completion.json')));
      save(mode+'-fresh-action-proof.json',{passed:true,explicitNewNativeCaptureId:fresh.captureId,newReviewAfterCapture:true,independentUP:true,nativeQuit:true,exit:0});
    }
    watchdog.stdin.end();const w=await wclosed;save(mode+'-watchdog-wait.json',{pid:watchdog.pid,...w,actualWait:true,stdoutEOF:watchdog.stdout.readableEnded,stderrEOF:watchdog.stderr.readableEnded,stdout:ws,stderr:we});
    assert.equal(w.exit,0,'independent watchdog must close normally');
  }
 }
 if(modes.some(mode=>mode.startsWith('startup-'))){
  save('initial-presentation-qualification.json',{passed:true,modes,authoredOnly:true,originalStarted:false,
    scope:'separate passive public USER/ordinary actor startup; actual guest delayed ShowWindow; unchanged capture3000 and input guards; permanent UNKNOWN'});
  console.log('PASS focused authored native modes: '+modes.join(', '));
 }else{
  save('neverhood-native-admission.json',{generatedTestsPassed:true,safeForNeverhoodOriginal:true,actualNativeButtonTargets:true,childCaptionChangeRefused:true,originalStarted:false});
  console.log('PASS actual native two-dialog transition/independent UP/ExitProcess, focus/owner/semantic/stale faults, repaint admitted and permanent UNKNOWN zero later requests');
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;});

