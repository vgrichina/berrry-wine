'use strict';
const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const cp=require('node:child_process');
const local=require('../tools/mdk2-local-runtime.cjs');
const integration=require('../tools/mdk2-construction-driver-integration.cjs');
const run=fs.mkdtempSync(path.join(local.BASE,'mdk2-local-contract-test-'));
after(()=>fs.rmSync(run,{recursive:true,force:true}));
const now=Date.parse('2026-11-04T17:30:00Z');
function release(){return local.createRelease(run,now);}
test('real local host/process release retains 360 seconds and 180 seconds cleanup',()=>{
 const r=release();assert.equal(local.validate(r,run,now),now+360000);
 assert.equal(r.boxId,null);assert.equal(r.expiry,null);assert.equal(r.localIdentity.pid,process.pid);
 assert.equal(Date.parse(r.recoverBy)-Date.parse(r.closeBy),180000);
});
for(const [name,change] of Object.entries({
 'foreign run':r=>r.runDirectory+='/foreign', 'fake box':r=>r.boxId='bx_fake',
 'fake expiry':r=>r.expiry='2026-11-05T00:00:00Z', 'missing authorization':r=>delete r.localAuthorization,
 'wrong assignment':r=>r.assignment='other', 'wrong shutdown owner':r=>r.shutdownOwner='worker',
 'wrong host':r=>r.localIdentity.hostname+='x', 'wrong process':r=>r.localIdentity.pid++,
 'replaced process':r=>r.localIdentity.startTicks+='0', 'changed boot':r=>r.localIdentity.bootId+='x',
 'long browser':r=>r.closeBy=new Date(now+360001).toISOString(),
 'short reserve':r=>r.recoverBy=new Date(now+539999).toISOString(),
 'nonfinite':r=>r.closeBy='unknown', 'future release':r=>r.issuedAt=new Date(now+1).toISOString()
}))test('reject '+name,()=>{const r=release();change(r);assert.throws(()=>local.validate(r,run,now));});
test('original useful-window minimum and absolute launch cutoff cannot be extended',()=>{
 assert.throws(()=>local.validate(release(),run,now+180000),/three-minute/);
 assert.throws(()=>local.createRelease(run,local.HARD_CLOSE-540000),/360\+180/);
});
test('actual original composed source changes exactly obsolete TTL guard and Chrome path',()=>{
 const source=integration.compose(run).source, translated=local.translate(source);
 new vm.Script(require('node:module').wrap(translated));
 const guard="if(release.authorization!=='RUNTIME RELEASE MDK2 TARGET ONWARD'||release.shutdownOwner!=='coordinator'||!release.boxId||Date.parse(release.expiry)<Date.now()+600000)throw Error('fresh authorized finite TTL required');";
 assert.equal(translated.replace(`require(${JSON.stringify(require.resolve('../tools/mdk2-local-runtime.cjs'))}).validate(release,RUN);`,guard)
   .replace("executablePath:'/opt/google/chrome/chrome'","executablePath:'/usr/bin/google-chrome'"),source);
 for(const broken of [source.replace(guard,''),source+guard,source.replace("executablePath:'/usr/bin/google-chrome'",'')])
   assert.throws(()=>local.translate(broken),/anchor changed/);
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
