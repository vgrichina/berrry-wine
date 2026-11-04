'use strict';
const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const cp=require('node:child_process');
const {createRequire}=require('node:module');
const local=require('../tools/mdk2-local-runtime.cjs');
const integration=require('../tools/mdk2-construction-driver-integration.cjs');
const run=fs.mkdtempSync(path.join(local.BASE,'mdk2-local-contract-test-'));
after(()=>fs.rmSync(run,{recursive:true,force:true}));
const now=Date.parse('2026-11-04T17:50:00Z');
test('actual Python review rejects contradictory menu classification before approval: old fail/new pass',()=>{
 const results=[];
 for(const repaired of [false,true]){
  const tmp=fs.mkdtempSync(path.join(local.BASE,'mdk2-review-preflight-'));
  after(()=>fs.rmSync(tmp,{recursive:true,force:true}));
  const r=release();r.runDirectory=tmp;
  fs.writeFileSync(path.join(tmp,'runtime-release.json'),JSON.stringify(r));local.prepareTransport(tmp);
  const sources=integration.controllerSources(tmp);
  const preflight=sources['control.py'].split('\n').find(line=>line.includes('preflightMenuReview'));
  assert(preflight);
  fs.writeFileSync(path.join(tmp,'control.py'),repaired?sources['control.py']:sources['control.py'].replace(preflight+'\n',''));
  const browser=path.join(tmp,'browser'),recovered=path.join(tmp,'recovered/browser');
  fs.mkdirSync(path.join(browser,'commands'),{recursive:true});fs.mkdirSync(recovered,{recursive:true});
  const png=Buffer.from('explicit offline review fixture: no game pixels'),sha=integration.sha(png);
  const put=(file,value)=>fs.writeFileSync(file,JSON.stringify(value));
  fs.writeFileSync(path.join(browser,'fixture.png'),png);
  put(path.join(browser,'commands/0.json'),{action:'shot',name:'fixture'});put(path.join(browser,'reply-0.json'),{i:0,ok:true});
  put(path.join(browser,'inspection-state.json'),{status:'awaiting-inspection',capture:'fixture',sha256:sha,steps:0,command:0,session:'fixture'});
  put(path.join(recovered,'fixture.json'),{sha256:sha,state:{main:{frozen:{steps:0}}}});
  const native=path.join(local.BASE,'20261104-mdk2-adequate-lifetime-menu/native-menu.cjs');
  fs.writeFileSync(path.join(tmp,'native-menu.cjs'),`require(${JSON.stringify(native)}).ready(JSON.parse(require('fs').readFileSync(process.argv[4])),process.argv[2]);`);
  const fields={screen:'main-menu',selection:'none',transitioning:true,controllerIconHighlighted:false,newGameLabelVisible:false,legalOverlayVisible:false};
  const child=cp.spawnSync('python3',[path.join(tmp,'local-control.py'),'control.py','review','fixture',JSON.stringify(fields),'native-menu','observe'],{cwd:local.ROOT,encoding:'utf8',timeout:10000});
  assert.notEqual(child.status,0);assert.match(child.stderr,/wrong native selection/);
  const approval=fs.existsSync(path.join(browser,'inspection-approval.json'));
  assert.equal(approval,!repaired,'contradictory review must not be published');
  results.push({repaired,status:child.status,approval,stderr:child.stderr});
 }
 const honest={screen:'main-menu',selection:'New Game',transitioning:false,controllerIconHighlighted:true,newGameLabelVisible:true,legalOverlayVisible:false};
 assert.doesNotThrow(()=>local.preflightMenuReview('observe',honest));
 if(process.env.MDK2_LOCAL_TEST_EVIDENCE)fs.writeFileSync(path.join(process.env.MDK2_LOCAL_TEST_EVIDENCE,'review-preflight-before-after.json'),JSON.stringify({fixtureOnly:true,results},null,2));
});
test('actual installed launch timeout: old absent-Browser cleanup fails; late owned endpoint cleanup closes normally',async()=>{
 const r=createRequire(require.resolve('puppeteer')),core=r.resolve('puppeteer-core');
 const launcherPath=path.join(path.dirname(core),'node/BrowserLauncher.js');
 const {BrowserLauncher}=await import(launcherPath);
 const diagnosticRun=fs.mkdtempSync(path.join(local.BASE,'mdk2-late-endpoint-test-'));
 const tap=local.traceOwnedLifecycle(diagnosticRun,process.execPath);
 assert.equal(local.lifecycleForRun(diagnosticRun),tap);
 let owned,browser;
 class Launcher extends BrowserLauncher {
  async computeLaunchArguments(){return {executablePath:process.execPath,userDataDir:path.join(diagnosticRun,'chrome-profile'),isTempUserDataDir:false,
   args:['-e',"setTimeout(()=>process.stderr.write('DevTools listening on ws://127.0.0.1:12345/devtools/browser/ab'),100);setTimeout(()=>process.stderr.write('cd\\n'),200);process.stdin.once('data',()=>process.exit(0));setInterval(()=>{},1000)",'--','--user-data-dir='+path.join(diagnosticRun,'chrome-profile')]};}
  async cleanUserDataDir(){}
  async createCdpSocketConnection(process,options){owned=process;return super.createCdpSocketConnection(process,options);}
 }
 const launcher=new Launcher({},'chrome');
 try {
  await assert.rejects(async()=>{browser=await launcher.launch({timeout:20,handleSIGINT:false,handleSIGTERM:false,handleSIGHUP:false});},/Timed out/);
  assert.equal(browser,undefined);
  // This is the evidenced old caller's exact cleanup: no Browser => no close.
  if(browser)await browser.close();
  assert.equal(owned.nodeProcess.exitCode,null,'old cleanup leaves the actual launch child running');
  let connections=0;
  const result=await local.closeUnreturnedLaunch(tap,{deadline:Date.now()+3000,connect:async options=>{
   connections++;assert.equal(options.browserWSEndpoint,'ws://127.0.0.1:12345/devtools/browser/abcd');
   const connected=new (require('node:events').EventEmitter)();connected.pages=async()=>[];
   connected.close=async()=>{owned.nodeProcess.stdin.write('quit\n');await owned.hasClosed();connected.emit('disconnected');};
   connected.disconnect=()=>{};return connected;
  }});
  assert.deepEqual(result,{pid:owned.nodeProcess.pid,code:0,signal:null});assert.equal(connections,1);
  await assert.rejects(local.closeUnreturnedLaunch(tap,{deadline:Date.now()+1000,connect:async()=>{throw Error('no retry');}}),/one launch-failure/);
  const rows=fs.readFileSync(tap.file,'utf8').trim().split('\n').map(JSON.parse);
  assert(rows.some(e=>e.kind==='launch-failure-cleanup-normal'));
  assert(rows.some(e=>e.kind==='spawn'&&e.command===process.execPath&&e.args.includes('--user-data-dir='+path.join(diagnosticRun,'chrome-profile'))));
  assert(!rows.some(e=>['process.kill','child.kill'].includes(e.kind)&&e.signal!==0),'no deliberate signal or fallback needed');
  if(process.env.MDK2_LATE_ENDPOINT_RESULT)fs.writeFileSync(process.env.MDK2_LATE_ENDPOINT_RESULT,JSON.stringify({fixtureOnly:true,actualLauncherPath:launcherPath,sha256:integration.sha(fs.readFileSync(launcherPath)),oldCleanupLeavesLiveChild:true,result,rows},null,2));
 }finally{
  if(owned&&owned.nodeProcess.exitCode===null&&owned.nodeProcess.signalCode===null)owned.nodeProcess.stdin.write('quit\n');
  if(owned)await owned.hasClosed();tap.restore();fs.rmSync(diagnosticRun,{recursive:true,force:true});
 }
 assert.throws(()=>local.lifecycleForRun(diagnosticRun),/not installed/);
});
test('launch-failure normal cleanup rejects stale identity, foreign endpoints, ambiguous history, abnormal exit and expired reserve',async()=>{
 const self=local.identity(),logs=[];
 const make=(change={})=>({record:(kind,data)=>logs.push({kind,...data}),ownedLaunch:()=>({child:{pid:process.pid,exitCode:null,signalCode:null},identity:self,stderr:'',...change})});
 const never=async()=>{throw Error('must never connect');};
 await assert.rejects(local.closeUnreturnedLaunch(make(),{deadline:Date.now()-1,connect:never}),/finite 60 second/);
 await assert.rejects(local.closeUnreturnedLaunch(make(),{deadline:Date.now()+60001,connect:never}),/finite 60 second/);
 await assert.rejects(local.closeUnreturnedLaunch(make({identity:{...self,startTicks:'foreign'}}),{deadline:Date.now()+1000,connect:never}),/gone or replaced/);
 await assert.rejects(local.closeUnreturnedLaunch(make({stderr:'DevTools listening on ws://foreign:12345/devtools/browser/abcd\n'}),{deadline:Date.now()+30,connect:never}),/cleanup deadline/);
 await assert.rejects(local.closeUnreturnedLaunch(make({stderr:'DevTools listening on ws://127.0.0.1:1/devtools/browser/abcd\nDevTools listening on ws://127.0.0.1:2/devtools/browser/abcd\n'}),{deadline:Date.now()+1000,connect:never}),/ambiguous/);
 await assert.rejects(local.closeUnreturnedLaunch(make({child:{pid:process.pid,exitCode:null,signalCode:'SIGKILL'}}),{deadline:Date.now()+1000,connect:never}),/already exited/);
 assert(!logs.some(e=>e.kind==='launch-failure-cleanup-normal'));
});
test('actual caller recovers installed rejected-launch producer immediately and preserves first fault',async()=>{
 const r=createRequire(require.resolve('puppeteer')),core=r.resolve('puppeteer-core');
 const {BrowserLauncher}=await import(path.join(path.dirname(core),'node/BrowserLauncher.js'));
 const dir=fs.mkdtempSync(path.join(local.BASE,'mdk2-actual-caller-test-'));
 const tap=local.traceOwnedLifecycle(dir,process.execPath);let owned,launches=0,connections=0;
 class Launcher extends BrowserLauncher {
  async computeLaunchArguments(){return {executablePath:process.execPath,userDataDir:path.join(dir,'chrome-profile'),isTempUserDataDir:false,
   args:['-e',"setTimeout(()=>process.stderr.write('DevTools listening on ws://127.0.0.1:12345/devtools/browser/abcd\\n'),150);process.stdin.once('data',()=>process.exit(0));setInterval(()=>{},1000)",'--','--user-data-dir='+path.join(dir,'chrome-profile')]};}
  async cleanUserDataDir(){}
  async createCdpSocketConnection(process,options){owned=process;return super.createCdpSocketConnection(process,options);}
 }
 const launcher=new Launcher({},'chrome');
 try {
  const api={launch:options=>{launches++;return launcher.launch(options);},connect:async options=>{
   connections++;assert.equal(options.browserWSEndpoint,'ws://127.0.0.1:12345/devtools/browser/abcd');
   const browser=new (require('node:events').EventEmitter)();browser.pages=async()=>[];
   browser.close=async()=>{owned.nodeProcess.stdin.write('quit\n');await owned.hasClosed();browser.emit('disconnected');};
   browser.disconnect=()=>{};return browser;
  }};
  await assert.rejects(local.launchOwned(api,tap,{timeout:20,handleSIGINT:false,handleSIGTERM:false,handleSIGHUP:false}),/Timed out/);
  assert.equal(launches,1);assert.equal(connections,1);assert.equal(owned.nodeProcess.exitCode,0);assert.equal(owned.nodeProcess.signalCode,null);
  const rows=fs.readFileSync(tap.file,'utf8').trim().split('\n').map(JSON.parse);
  assert(rows.some(e=>e.kind==='launch-failure-cleanup-normal'));assert(!rows.some(e=>['process.kill','child.kill','caller-cleanup-failure'].includes(e.kind)));
 }finally{
  if(owned&&owned.nodeProcess.exitCode===null&&owned.nodeProcess.signalCode===null)owned.nodeProcess.stdin.write('quit\n');
  if(owned)await owned.hasClosed();tap.restore();fs.rmSync(dir,{recursive:true,force:true});
 }
});
test('actual launch caller observes normal own closure independently of historical require filename',async()=>{
 const dir=fs.mkdtempSync(path.join(local.BASE,'mdk2-caller-closure-test-'));
 const tap=local.traceOwnedLifecycle(dir,process.execPath),EventEmitter=require('node:events');
 const child=cp.spawn(process.execPath,['-e',"process.stdin.once('data',()=>process.exit(0));console.log('ready');setInterval(()=>{},1000)",'--','--user-data-dir='+path.join(dir,'chrome-profile')],{stdio:['pipe','pipe','pipe']});
 const exit=new Promise((resolve,reject)=>{child.once('exit',(code,signal)=>resolve({code,signal}));child.once('error',reject);});
 const page=new EventEmitter(),browser=new EventEmitter();let launches=0,closes=0;
 browser.process=()=>child;browser.newPage=async()=>page;
 browser.close=async()=>{closes++;page.emit('framedetached');page.emit('close');child.stdin.write('quit\n');await exit;browser.emit('disconnected');};
 try {
  await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);});
  await assert.rejects(local.launchOwned({launch:async()=>({process:()=>({pid:child.pid})}),connect:async()=>{throw Error('foreign browser never connects');}},tap,{}),/observed owned child/);
  const returned=await local.launchOwned({launch:async()=>{launches++;return browser;},connect:async()=>{throw Error('no recovery on normal launch');}},tap,{});
  assert.equal(returned,browser);tap.watchBrowser(browser);tap.watchBrowser(browser);
  const actualPage=await returned.newPage();assert.equal(actualPage,page);tap.watchPage(page);tap.watchPage(page);
  await returned.close();assert.deepEqual(await exit,{code:0,signal:null});assert.equal(launches,1);assert.equal(closes,1);
  const rows=fs.readFileSync(tap.file,'utf8').trim().split('\n').map(JSON.parse);
  for(const kind of ['spawn','browser.close-called','browser.close-resolved','frame-detached','page-close','browser-disconnected','exit'])assert.equal(rows.filter(r=>r.kind===kind).length,1,kind);
  assert(!rows.some(r=>['process.kill','child.kill','launch-failure-cleanup-begin'].includes(r.kind)));
 }finally{
  if(child.exitCode===null&&child.signalCode===null)child.stdin.write('quit\n');await exit;tap.restore();fs.rmSync(dir,{recursive:true,force:true});
 }
});
test('installed Puppeteer close path distinguishes orderly own child from CDP-failure SIGKILL fallback',async()=>{
 const r=createRequire(require.resolve('puppeteer'));
 const core=r.resolve('puppeteer-core'),browsers=createRequire(core).resolve('@puppeteer/browsers');
 const launcherPath=path.join(path.dirname(core),'node/BrowserLauncher.js');
 const processPath=path.join(path.dirname(browsers),'launch.js');
 const {BrowserLauncher}=await import(launcherPath),{launch}=await import(processPath);
 const rows=[];
 for(const failedCDP of [false,true]){
  const diagnosticRun=fs.mkdtempSync(path.join(local.BASE,'mdk2-lifecycle-test-'));
  const tap=local.traceOwnedLifecycle(diagnosticRun,process.execPath);
  assert.throws(()=>local.traceOwnedLifecycle(diagnosticRun,process.execPath),/EEXIST/,'never overwrite lifecycle records');
  assert.throws(()=>tap.watchBrowser({process:()=>({pid:-1})}),/owned child/);
  const events=[],start=performance.now();
  const record=(kind,data={})=>events.push({kind,at:new Date().toISOString(),ms:performance.now()-start,...data});
  // The real installed launcher/process implementation with an owned Node
  // child. This proves the mechanism, not the cause of historical Chrome loss.
  const owned=launch({executablePath:process.execPath,args:['-e',
   "process.stdin.once('data',()=>process.exit(0));console.log('ready');setInterval(()=>{},1000)",
   '--','--user-data-dir='+path.join(diagnosticRun,'chrome-profile')],
   env:process.env,handleSIGINT:false,handleSIGTERM:false,handleSIGHUP:false});
  const child=owned.nodeProcess,kill=process.kill;
  assert.throws(()=>tap.watchBrowser({process:()=>({pid:child.pid})}),/owned child/,'PID alone never binds a browser');
  await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);});
  record('spawn',{pid:child.pid,identity:local.identity(child.pid)});
  child.once('exit',(code,signal)=>record('exit',{code,signal}));
  process.kill=function(pid,signal){
   assert([child.pid,-child.pid].includes(pid),'fixture must never signal foreign processes');
   record('process.kill',{pid,signal,stack:new Error('kill caller').stack});
   return Reflect.apply(kill,this,[pid,signal]);
  };
  try{
   const launcher=new BrowserLauncher({},'chrome');
   const browser=new (require('node:events').EventEmitter)();
   browser.process=()=>child;
   browser.close=()=>launcher.closeBrowser(owned,{async closeBrowser(){
    record('Browser.close-request');
    if(failedCDP){record('Browser.close-rejected');throw Error('fixture CDP disconnected');}
    child.stdin.write('quit\n');
   }});
   tap.watchBrowser(browser);child.once('exit',()=>browser.emit('disconnected'));
   const page=new (require('node:events').EventEmitter)();tap.watchPage(page);
   page.emit('framedetached');page.emit('error',Error('fixture page crash'));page.emit('close');
   await browser.close();
  }finally{process.kill=kill;await owned.close();tap.restore();}
  record('closed',{code:child.exitCode,signal:child.signalCode});
  if(failedCDP){
   assert.equal(child.signalCode,'SIGKILL');
   assert(events.some(e=>e.kind==='process.kill'&&e.pid===-child.pid&&e.signal==='SIGKILL'&&/BrowserLauncher.closeBrowser/.test(e.stack)));
  }else{assert.equal(child.exitCode,0);assert.equal(child.signalCode,null);assert(!events.some(e=>e.signal==='SIGKILL'));}
  const diagnostic=fs.readFileSync(tap.file,'utf8').trim().split('\n').map(line=>JSON.parse(line));
  for(const kind of ['observer-installed','spawn','browser.close-called','exit','browser-disconnected','browser.close-resolved','frame-detached','page-error','page-close','observer-restored'])assert(diagnostic.some(r=>r.kind===kind),kind);
  if(failedCDP)assert(diagnostic.some(r=>r.kind==='process.kill'&&r.signal==='SIGKILL'&&r.pid===-child.pid&&/BrowserLauncher.closeBrowser/.test(r.stack)));
  rows.push({failedCDP,events,diagnostic});
  fs.rmSync(diagnosticRun,{recursive:true,force:true});
 }
 if(process.env.MDK2_LIFECYCLE_RESULT)fs.writeFileSync(process.env.MDK2_LIFECYCLE_RESULT,JSON.stringify({fixtureOnly:true,
  sources:[launcherPath,processPath].map(p=>({path:p,sha256:integration.sha(fs.readFileSync(p))})),rows},null,2));
});
function release(){return local.createRelease(run,now);}
test('startup assignment renews real local host/process release to 720 seconds and 180 seconds cleanup',()=>{
 const r=release();assert.equal(local.validate(r,run,now),now+720000);
 assert.equal(r.assignment,'20261104-mdk2-measured-native-boundary-gameplay');
 assert.equal(r.boxId,null);assert.equal(r.expiry,null);assert.equal(r.localIdentity.pid,process.pid);
 assert.equal(Date.parse(r.recoverBy)-Date.parse(r.closeBy),180000);
});
for(const [name,change] of Object.entries({
 'foreign run':r=>r.runDirectory+='/foreign', 'fake box':r=>r.boxId='bx_fake',
 'fake expiry':r=>r.expiry='2026-11-05T00:00:00Z', 'missing authorization':r=>delete r.localAuthorization,
 'wrong assignment':r=>r.assignment='other', 'wrong shutdown owner':r=>r.shutdownOwner='worker',
 'wrong host':r=>r.localIdentity.hostname+='x', 'wrong process':r=>r.localIdentity.pid++,
 'replaced process':r=>r.localIdentity.startTicks+='0', 'changed boot':r=>r.localIdentity.bootId+='x',
 'missing nonce':r=>delete r.nonce, 'malformed nonce':r=>r.nonce='fake',
 'missing candidate':r=>delete r.candidate, 'foreign driver':r=>r.candidate.driverSHA256='0'.repeat(64),
 'foreign local':r=>r.candidate.localSHA256='0'.repeat(64),
 'prior assignment release':r=>r.assignment='20261104-mdk2-bounded-trace-driver-repair',
 'long browser':r=>r.closeBy=new Date(now+720001).toISOString(),
 'short reserve':r=>r.recoverBy=new Date(now+899999).toISOString(),
 'nonfinite':r=>r.closeBy='unknown', 'future release':r=>r.issuedAt=new Date(now+1).toISOString()
}))test('reject '+name,()=>{const r=release();change(r);assert.throws(()=>local.validate(r,run,now));});
test('original useful-window minimum and absolute launch cutoff cannot be extended',()=>{
 assert.equal(local.validate(release(),run,now+539999),now+720000);
 assert.throws(()=>local.validate(release(),run,now+540000),/three-minute/);
 assert.throws(()=>local.createRelease(run,local.HARD_CLOSE-900000),/720\+180/);
});
test('renewed dated assignment retains exact absolute close and recovery bounds',()=>{
 assert.equal(local.HARD_CLOSE,Date.parse('2026-11-04T23:50:00Z'));
 assert.equal(local.HARD_RECOVER,Date.parse('2026-11-04T23:53:00Z'));
 const r=release();r.recoverBy=new Date(local.HARD_RECOVER+1).toISOString();
 assert.throws(()=>local.validate(r,run,now),/cleanup reserve/);
 const late=local.createRelease(run,local.HARD_CLOSE-900001);
 assert.equal(local.validate(late,run,local.HARD_CLOSE-900001),local.HARD_CLOSE-180001);
});
test('one launch and fresh nonce bind each new local contract',()=>{
 assert.notEqual(release().nonce,release().nonce);
 fs.mkdirSync(path.join(run,'browser'));
 try{assert.throws(()=>release(),/one original launch/);}finally{fs.rmdirSync(path.join(run,'browser'));}
});
test('actual entry admits only the renewed validated local assignment before original deadline seam',()=>{
 const finite=require(path.join(local.BASE,'20261104-mdk2-fresh-pending-scene/finite-deadline.cjs'));
 const original=finite.browserDeadline, originalNow=Date.now;
 let reached=0;
 finite.browserDeadline=()=>{reached++;throw Error('original deadline reached; no bootstrap');};
 Date.now=()=>now;
 try{
  for(const assignment of ['20261104-mdk2-bounded-trace-driver-repair',local.ASSIGNMENT]){
   const r=release();r.assignment=assignment;
   fs.writeFileSync(path.join(run,'runtime-release.json'),JSON.stringify(r));
   assert.throws(()=>integration.run(run),assignment===local.ASSIGNMENT?/original deadline reached/:/assignment|Expected values/);
  }
  assert.equal(reached,1);
  assert(!fs.existsSync(path.join(run,'browser')));
  assert(!fs.existsSync(path.join(run,'author.py')));
 }finally{finite.browserDeadline=original;Date.now=originalNow;fs.unlinkSync(path.join(run,'runtime-release.json'));}
});
test('actual composed source retains original guards under explicit local identity and tighter finite caps',()=>{
 const source=integration.compose(run).source, translated=local.translate(source);
 assert(translated.includes('deadline-180000'));
 assert(translated.includes('recoveryReserveMs:180000'));
 new vm.Script(require('node:module').wrap(translated));
 const guard="if(release.authorization!=='RUNTIME RELEASE MDK2 TARGET ONWARD'||release.shutdownOwner!=='coordinator'||!release.boxId||Date.parse(release.expiry)<Date.now()+600000)throw Error('fresh authorized finite TTL required');";
 const tool=JSON.stringify(require.resolve('../tools/mdk2-local-runtime.cjs'));
 assert.equal(translated.replace(`require(${tool}).validate(release,RUN);`,guard)
   .replace("executablePath:'/opt/google/chrome/chrome'","executablePath:'/usr/bin/google-chrome'")
   .replace('protocolTimeout:40000,timeout:30000','protocolTimeout:60000,timeout:30000')
   .replace(`await require(${tool}).within(()=>command(c,i),40000,()=>{halted=true;void close('local 40 second command deadline');});`,'await command(c,i);')
   .replace(`browser=await require(${tool}).launchOwned(puppeteer,require(${tool}).lifecycleForRun(RUN),`,'browser=await puppeteer.launch(')
   .replace(`  await require(${tool}).within(async()=>{\n  browser=await puppeteer.launch(`,'  browser=await puppeteer.launch(')
   .replace("  if(closing){await browser.close();throw Error('local bootstrap closed');}\n  page=await browser.newPage();",'  page=await browser.newPage();')
   .replace('  if(closing)throw Error(\'local bootstrap closed\');\n  await page.click(\'button[onclick="launchApp()"]\');','  await page.click(\'button[onclick="launchApp()"]\');')
   .replace("\n  },60000,()=>{halted=true;void close('local 60 second bootstrap deadline');});",''),source);
 for(const broken of [source.replace(guard,''),source+guard,source.replace("executablePath:'/usr/bin/google-chrome'",'')])
   assert.throws(()=>local.translate(broken),/anchor changed/);
});
test('local additive deadline returns actual result, preserves first fault and rejects timed-out operation',async()=>{
 assert.equal(await local.within(()=>7,100),7);
 await assert.rejects(local.within(()=>{throw Error('concrete first fault');},100),/concrete first fault/);
 let closed=false;
 await assert.rejects(local.within(()=>new Promise(()=>{}),5,()=>{closed=true;}),/local operation deadline/);
 assert.equal(closed,true);
 await assert.rejects(local.within(()=>{throw Error('must not start');},0),/local bootstrap deadline/);
});
test('real Python local transport validates actual process and forbids remote/detached transport',()=>{
 const tmp=fs.mkdtempSync(path.join(run,'transport-test-'));
 try {
  const r=release();r.runDirectory=tmp;
  fs.writeFileSync(path.join(tmp,'runtime-release.json'),JSON.stringify(r));
  fs.writeFileSync(path.join(tmp,'local-transport.py'),local.transportSource);
  // Use Python argv, not shell quoting, for the positive transport process.
  const code="import importlib.util; s=importlib.util.spec_from_file_location('io',"+JSON.stringify(tmp+'/local-transport.py')+"); io=importlib.util.module_from_spec(s);s.loader.exec_module(io);assert io.allocation()['pid']=="+process.pid+";assert io.remote(\"printf local-ok\")['stdout']=='local-ok'\nfor cmd,detach in [('ssh host',False),('true',True)]:\n try:io.remote(cmd,detach=detach)\n except AssertionError:pass\n else:raise AssertionError('transport allowed')\n";
  cp.execFileSync('python3',['-c',code]);
  r.localIdentity.startTicks+='0';fs.writeFileSync(path.join(tmp,'runtime-release.json'),JSON.stringify(r));
  assert.throws(()=>cp.execFileSync('python3',['-c',code],{stdio:'pipe'}));
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
test('install requires real inherited exclusive local lock before release or composition changes',()=>{
 assert.throws(()=>local.install(run),/lock required/);
 assert(!fs.existsSync(path.join(run,'runtime-release.json')));
});
test('exact current GL predecessor heavy release excludes mentions, prior release and other owners',()=>{
 const good='2026-11-04T21:23:30+00:00 stronghold-fresh-complete-entry-gameplay-nov04 LOCAL HEAVY RELEASE original stopped';
 assert.equal(local.heavyRelease(good),good);
 const coordinated='2026-11-04T21:23:30.552949+00:00 coordinator LOCAL HEAVY RELEASE stronghold-fresh-complete-entry-gameplay-nov04: MDK may proceed';
 assert.equal(local.heavyRelease(coordinated),coordinated);
 assert.equal(local.heavyRelease(coordinated.replace('coordinator','stronghold-fresh-complete')),coordinated.replace('coordinator','stronghold-fresh-complete'));
 for(const line of [good.replace(' LOCAL HEAVY RELEASE',' RELEASE'),
   good.replace('stronghold-fresh-complete-entry-gameplay-nov04','mdk2-installed-original waiting stronghold-fresh-complete-entry-gameplay-nov04'),
   good.replace('21:23:30','20:58:26'),good.replace('2026-11-04','2026-11-05'),
   good.replace('stronghold-fresh-complete-entry-gameplay-nov04','stronghold-customgame-drain'),
   coordinated.replace('coordinator LOCAL','mdk2-bounded-review waiting coordinator LOCAL'),
   coordinated.replace('stronghold-fresh-complete-entry-gameplay-nov04:','other-task:')])
   assert.throws(()=>local.heavyRelease(line),/release/i);
});
test('actual local install makes the mandatory owning lifecycle tap ready before the composed launch caller',()=>{
 const script=path.join(run,'install-caller.cjs'),lock=path.join(run,'private-runtime.lock');
 // A private real flock avoids interfering with a successor's heavy runtime.
 // Only that pathname, the test clock and board input change in this fixture.
 fs.writeFileSync(script,`const fs=require('fs'),assert=require('assert/strict'),Module=require('module');
 const filename=${JSON.stringify(require.resolve('../tools/mdk2-local-runtime.cjs'))};
 const [mode,dir]=process.argv.slice(2);Date.now=()=>Date.parse('2026-11-04T21:24:00Z');
 let source=mode==='old'?require('child_process').execFileSync('git',['show','6055aa7e43d7c3505b6796d447663366e3b85146:tools/mdk2-local-runtime.cjs'],{encoding:'utf8'}):fs.readFileSync(filename,'utf8');
 source=source.replaceAll('/tmp/wine-local-runtime.lock',${JSON.stringify(lock)});
 const originalRead=fs.readFileSync;
 fs.readFileSync=function(file,...args){if(file===${JSON.stringify(path.join(local.ROOT,'messageboard.txt'))})return mode==='old'?'2026-11-04T20:50:07.552949+00:00 coordinator LOCAL HEAVY RELEASE stronghold-customgame-drain-cause-nov04: explicit fixture only':'2026-11-04T21:23:30Z coordinator LOCAL HEAVY RELEASE stronghold-fresh-complete-entry-gameplay-nov04: explicit fixture only';return Reflect.apply(originalRead,this,[file,...args]);};
 const m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(require('path').dirname(filename));m._compile(source,filename);
 const installed=m.exports.install(dir),tap=m.exports.lifecycleForRun(dir);
 assert.equal(installed.lifecycle,tap);assert.throws(()=>tap.ownedLaunch(),/exactly one/);
 const rows=fs.readFileSync(dir+'/chrome-lifecycle.jsonl','utf8').trim().split('\\n').map(JSON.parse);
 assert.equal(rows[0].kind,'observer-installed');assert(!rows.some(r=>r.kind==='spawn'));
 installed.restore();console.log('PASS install -> lifecycleForRun ready before any launch; no Chrome');
 `);
 const results={};
 for(const mode of ['old','fixed']){
   const dir=fs.mkdtempSync(path.join(local.BASE,'mdk2-install-caller-test-'));
   try{
    const r=cp.spawnSync('bash',['-c','exec 9>"$1"; flock -n -x 9 || exit; export WINE_LOCAL_RUNTIME_LOCK_FD=9; exec "$2" "$3" "$4" "$5"','mdk2-install-test',lock,process.execPath,script,mode,dir],{encoding:'utf8',cwd:local.ROOT});
    results[mode]={status:r.status,stdout:r.stdout,stderr:r.stderr};
    if(mode==='old'){assert.notEqual(r.status,0);assert.match(r.stderr,/owned lifecycle recorder not installed/);}
    else assert.equal(r.status,0,r.stderr);
   }finally{fs.rmSync(dir,{recursive:true,force:true});}
 }
 if(process.env.MDK2_LOCAL_TEST_EVIDENCE)fs.writeFileSync(path.join(process.env.MDK2_LOCAL_TEST_EVIDENCE,'install-caller-before-after.json'),JSON.stringify(results,null,2));
});
test('actual composed entry creates run, installs release/recorder and calls mocked Puppeteer with zero Chrome',()=>{
 const script=path.join(run,'composed-entry.cjs'),lock=path.join(run,'composed-runtime.lock');
 const dir=fs.mkdtempSync(path.join(local.BASE,'mdk2-composed-entry-test-'));fs.rmdirSync(dir);
 fs.writeFileSync(script,`'use strict';
 const fs=require('fs'),path=require('path'),Module=require('module'),cp=require('child_process');
 const filename=${JSON.stringify(require.resolve('../tools/mdk2-local-runtime.cjs'))},dir=${JSON.stringify(dir)};
 const originalRead=fs.readFileSync;
 fs.readFileSync=function(file,...args){if(file===${JSON.stringify(path.join(local.ROOT,'messageboard.txt'))})return '2026-11-04T21:23:30Z coordinator LOCAL HEAVY RELEASE stronghold-fresh-complete-entry-gameplay-nov04: explicit fixture only';return Reflect.apply(originalRead,this,[file,...args]);};
 Date.now=()=>Date.parse('2026-11-04T21:24:00Z');
 const source=fs.readFileSync(filename,'utf8').replaceAll('/tmp/wine-local-runtime.lock',${JSON.stringify(lock)});
 const m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));require.cache[filename]=m;m._compile(source,filename);
 const local=m.exports,load=Module._load,puppeteer=require('puppeteer'),events=[];
 const mocked={...puppeteer,launch:async options=>{events.push({kind:'launch-boundary',options,recorder:local.lifecycleForRun(dir).file});throw Error('ZERO_CHROME_BOUNDARY');}};
 Module._load=function(name,...args){return name==='puppeteer'?mocked:Reflect.apply(load,this,[name,...args]);};
 const spawn=cp.spawn;cp.spawn=function(command,...args){if(/chrome/i.test(String(command))){events.push({kind:'forbidden-chrome-spawn'});throw Error('forbidden Chrome spawn');}return Reflect.apply(spawn,this,[command,...args]);};
 const servers=require(${JSON.stringify(path.join(local.ROOT,'test/static-server.js'))}),start=servers.startStaticServer;
 servers.startStaticServer=async options=>{const s=await start(options);events.push({kind:'listen',port:s.address().port});s.once('close',()=>events.push({kind:'close'}));return s;};
 process.on('exit',code=>fs.writeFileSync(dir+'/entry-result.json',JSON.stringify({code,events})));
 local.start(dir).catch(error=>{console.error(error.stack);process.exitCode=1;});
 `);
 try {
  const result=cp.spawnSync('flock',['-x',lock,'bash','-c','exec 9>"$1"; export WINE_LOCAL_RUNTIME_LOCK_FD=9; exec "$2" "$3"','mdk2-composed',lock,process.execPath,script],{cwd:local.ROOT,encoding:'utf8',timeout:60000});
  assert.equal(result.status,1,result.stderr);assert.equal(result.signal,null);
  const evidence=JSON.parse(fs.readFileSync(path.join(dir,'entry-result.json')));
  assert.equal(evidence.events.filter(r=>r.kind==='launch-boundary').length,1);
  assert.equal(evidence.events.filter(r=>r.kind==='listen').length,2);
  assert.equal(evidence.events.filter(r=>r.kind==='close').length,2);
  assert(!evidence.events.some(r=>r.kind==='forbidden-chrome-spawn'));
  const failure=JSON.parse(fs.readFileSync(path.join(dir,'browser/bootstrap-failure.json')));
  assert.match(failure.error,/ZERO_CHROME_BOUNDARY/);
  assert.match(failure.error,/launchOwned/,'actual caller must reach Puppeteer');
  assert(!fs.existsSync(path.join(dir,'chrome-profile')));
  const rows=fs.readFileSync(path.join(dir,'chrome-lifecycle.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(rows[0].kind,'observer-installed');assert(!rows.some(r=>r.kind==='spawn'));
  const release=JSON.parse(fs.readFileSync(path.join(dir,'runtime-release.json')));
  assert.equal(release.assignment,local.ASSIGNMENT);
  if(process.env.MDK2_LOCAL_TEST_EVIDENCE)fs.writeFileSync(path.join(process.env.MDK2_LOCAL_TEST_EVIDENCE,'composed-entry-boundary.json'),JSON.stringify({evidence,failure,rows,release},null,2));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('actual original Python child: run-root hook reproduces operator collision; isolated hook fixes it',()=>{
 // Small generated controller inputs only. No browser, command spool or game.
 const tmp=fs.mkdtempSync(path.join(run,'python-child-'));
 try {
  const r=release();r.runDirectory=tmp;
  fs.writeFileSync(path.join(tmp,'runtime-release.json'),JSON.stringify(r));
  local.prepareTransport(tmp);
  const originals=integration.controllerSources(tmp);
  for(const name of ['operator.py','control.py','author.py','next.py'])fs.writeFileSync(path.join(tmp,name),originals[name]);
  // Reproduce the precise failed startup shape without entering any controller.
  fs.writeFileSync(path.join(tmp,'sitecustomize.py'),local.siteSource);
  const broken=cp.spawnSync('python3',[path.join(tmp,'control.py'),'remote','printf child-ok'],
    {encoding:'utf8',cwd:local.ROOT,env:{...process.env,PYTHONPATH:tmp}});
  assert.notEqual(broken.status,0);assert.match(broken.stderr,/partially initialized module 'operator'/);
  fs.unlinkSync(path.join(tmp,'sitecustomize.py'));
  const fixed=cp.spawnSync('python3',[path.join(tmp,'control.py'),'remote','printf child-ok'],
    {encoding:'utf8',cwd:local.ROOT,env:{...process.env,PYTHONPATH:path.join(tmp,'python-hooks')}});
  assert.equal(fixed.status,0,fixed.stderr);assert.equal(JSON.parse(fixed.stdout).stdout,'child-ok');
  // Also exercise the actual run-local bootstrap, which sets that child environment.
  const bootstrap=cp.spawnSync('python3',[path.join(tmp,'local-control.py'),'control.py','remote','printf bootstrap-ok'],
    {encoding:'utf8',cwd:local.ROOT});
  assert.equal(bootstrap.status,0,bootstrap.stderr);assert.equal(JSON.parse(bootstrap.stdout).stdout,'bootstrap-ok');
  assert.equal(fs.readFileSync(path.join(tmp,'operator.py'),'utf8'),originals['operator.py']);
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
