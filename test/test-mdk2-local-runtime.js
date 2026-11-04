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
 assert.equal(r.assignment,'20261104-mdk2-startup-timing-onward');
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
 assert.equal(local.HARD_CLOSE,Date.parse('2026-11-04T20:00:00Z'));
 assert.equal(local.HARD_RECOVER,Date.parse('2026-11-04T20:03:00Z'));
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
