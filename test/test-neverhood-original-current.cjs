'use strict';
// Generated native USER fixture only. No original media or review claims.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const cp=require('node:child_process'),net=require('node:net');
const {startControlSession}=require('./control-session');
if(process.argv[2]==='--watchdog-observation'){
 const parentCommand=fs.readFileSync(`/proc/${process.ppid}/cmdline`,'utf8').split('\0');
 assert(path.basename(parentCommand[0])==='timeout'&&parentCommand.includes('30s'),'independent timeout parent required');
 fs.writeFileSync(path.join(path.dirname(process.argv[3]),'watchdog-observation-armed.json'),JSON.stringify({
  at:Date.now(),parentPid:process.ppid,parentCommand,independent:true,beforeAuthoredNativeSpawn:true},null,2)+'\n',{flag:'wx'});
 const code=`import importlib.util,pathlib,subprocess,sys,json,time,threading,signal,os
from unittest.mock import patch
s=importlib.util.spec_from_file_location('runtime','tools/neverhood-original-current-runtime.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
base=pathlib.Path(sys.argv[1]);base.mkdir()
for name in ('disk-floor','deadline'):
 out=base/name;out.mkdir()
 p=subprocess.Popen([sys.executable,'-c','import time;time.sleep(60)'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
 m.save(out,'native-pid.json',dict(pid=p.pid,startToken=m.H.token(p.pid)))
 waited={}
 def wait():
  a,b=p.communicate();waited.update(exit=p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True)
 thread=threading.Thread(target=wait);thread.start()
 try:
  fake=type('Disk',(),dict(f_bavail=1499999999 if name=='disk-floor' else 1500000000,f_frsize=1))()
  with patch.object(m.os,'statvfs',return_value=fake):m.watchdog(out,time.time()+(30 if name=='disk-floor' else -.01))
  thread.join(2);assert not thread.is_alive()
  assert waited['exit']==-signal.SIGTERM and waited['actualWait'] and waited['stdoutEOF'] and waited['stderrEOF']
  m.save(out,'authored-native-wait.json',waited)
  trigger=json.loads((out/'watchdog-trigger.json').read_text());end=json.loads((out/'watchdog-exit.json').read_text())
  assert trigger['reason']==name and trigger['freeBytes']==fake.f_bavail
  assert trigger['deadlineElapsed']==(name=='deadline') and not trigger['nativeQuit']
  assert end['signals'][0]['delivered'] and not end['signals'][1]['delivered']
 finally:
  if p.poll() is None:os.killpg(p.pid,signal.SIGKILL)
  thread.join()
out=base/'wait-completed';out.mkdir();m.save(out,'native-wait.json',{'actualWait':True})
m.watchdog(out,time.time()+30)
assert json.loads((out/'watchdog-exit.json').read_text())['reason']=='actual-native-wait'
assert not (out/'watchdog-trigger.json').exists()
print('PASS exact authored disk-floor/deadline triggers, real native TERM/wait/both EOF, no later KILL, completed wait sends no signal')`;
 const p=cp.spawnSync('python3',['-B','-c',code,process.argv[3]],{cwd:path.resolve(__dirname,'..'),encoding:'utf8',timeout:30000});
 process.stdout.write(p.stdout||'');process.stderr.write(p.stderr||'');assert.equal(p.status,0);return;
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
 const code=`import importlib.util,pathlib,tempfile,os,json,time,hashlib
os.environ.update(NEVERHOOD_CURRENT_RUN='/unused',NEVERHOOD_CURRENT_PORT='1')
s=importlib.util.spec_from_file_location('control','tools/neverhood-original-current-control.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
w=dict(hwnd='0x123',live=True,visible=True,generation='1',processId=1,threadId=1,isChild=True,controlClass=1,style=0x50000000,nativeTextAvailable=True,textBytes='4f4b',title='OK',parent='0x100',buttonFlags=0)
r=dict(targetHwnd='0x123',kind='install',visibleLabel='OK');rr=dict(snapshot=dict(windows=[w],physicalUp=True,capture='0x0'))
assert m.button(rr,r)==w
assert m.presented(dict(modalHwnd='0x0',windows=[]))
modal=dict(hwnd='0x200',live=True,visible=False,isChild=False,processId=1,threadId=1)
assert not m.presented(dict(modalHwnd='0x200',windows=[modal]))
modal['visible']=True
assert m.presented(dict(modalHwnd='0x200',windows=[modal]))
assert m.presented(dict(modalHwnd='0x200',windows=[modal]),w)
for k in ('processId','threadId'):
 modal[k]=2
 assert not m.presented(dict(modalHwnd='0x200',windows=[modal]),w)
 modal[k]=1
for key,value in [('isChild',False),('controlClass',16),('style',0x58000000),('title','Exit'),('generation',''),('nativeTextAvailable',False)]:
 old=w[key];w[key]=value
 try:m.button(rr,r)
 except AssertionError:pass
 else:raise AssertionError(key)
 w[key]=old
with tempfile.TemporaryDirectory() as d:
 m.R=pathlib.Path(d);m.save('PERMANENT-UNKNOWN.json',{})
 m.identity=lambda:(_ for _ in ()).throw(AssertionError('network identity after UNKNOWN'))
 for cleanup in (True,False):
  try:m.call({'action':'snapshot'},cleanup=cleanup)
  except AssertionError as e:assert 'permanent UNKNOWN' in str(e)
  else:raise AssertionError('postUNKNOWN')
 assert not (m.R/'requests.jsonl').exists()
runtime=importlib.util.spec_from_file_location('runtime','tools/neverhood-original-current-runtime.py');rt=importlib.util.module_from_spec(runtime);runtime.loader.exec_module(rt)
assert rt.POLICY==dict(confirmationMs=500,physicalUpMs=1750,observationMs=3000,gameFreshnessSeconds=15,menuFreshnessSeconds=30)
from unittest.mock import patch
recipe=dict(seconds=900,watchdogGrace=20,reserveSeconds=90,inputPolicy=rt.POLICY,childInheritance='sealed-node-v1',cwd=str(rt.ROOT),originalPipelineOrdinal=1,args=['node','test/run.js','--iso=existing','--iso-drive=D','--iso-exe=SETUP95.EXE','--max-seconds=900','--real-ticks','--threads','--spawn-processes','--no-build'])
rt.validate_recipe(recipe)
for k,v in [('seconds',2400),('reserveSeconds',240),('watchdogGrace',30)]:
 bad=dict(recipe);bad[k]=v
 try:rt.validate_recipe(bad)
 except AssertionError:pass
 else:raise AssertionError('accepted obsolete clock '+k)
with patch('importlib.machinery.SourceFileLoader.exec_module',side_effect=AssertionError('mutable path re-read')):
 assert callable(rt.helper().seal)
original_read=pathlib.Path.read_bytes
for borrowed in (rt.HELPER,):
 def changed_read(p):
  body=original_read(p)
  return body+b'\\n# unpublished' if p==rt.ROOT/borrowed else body
 with patch.object(pathlib.Path,'read_bytes',changed_read):
  try:rt.helper()
  except AssertionError as e:assert 'unpublished borrowed helper' in str(e)
  else:raise AssertionError('executed unpublished helper')
# No physical fixture modules exist: resolve only inventoried, verified bytes.
bodies={'lib/neverhood-sealed-fixture.js':b"module.exports=require('./neverhood-sealed-value.json').value",'lib/neverhood-sealed-value.json':b'{"value":73}',
 'test/neverhood-sealed-python-child.py':b"print(73)",
 'test/neverhood-sealed-python.py':b"import importlib.util,pathlib,subprocess,sys; p=pathlib.Path(__file__).with_name('neverhood-sealed-python-child.py'); s=importlib.util.spec_from_file_location('child',p); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); assert p.read_bytes()==b'print(73)'; assert pathlib.Path('lib/neverhood-sealed-fixture.js').read_bytes().startswith(b'module.exports='); import json; assert json.loads(pathlib.Path('lib/neverhood-sealed-value.json').read_bytes())['value']==73; assert pathlib.Path('test/test-vb5cce-original-current.cjs').read_bytes()==b'SEALED_CJS_HASH'; r=subprocess.run([sys.executable,'-B',str(p)],capture_output=True); assert r.returncode==0,r.stderr; assert r.stdout.strip()==b'73'; print('PYTHON_INHERITANCE_PASS')"}
bodies['test/test-vb5cce-original-current.cjs']=b'SEALED_CJS_HASH'
pool,index,rows=rt.H.indexed_sources(bodies);source=rt.H.seal('resolver-test-source',pool)
preload=rt.H.seal('resolver-test-preload',(rt.ROOT/rt.PRELOAD).read_bytes());module=rt.H.seal('resolver-test-module',b'\\0asm')
env=dict(os.environ,DISCIPLES2_ROOT=str(rt.ROOT),DISCIPLES2_PHASE='runtime',DISCIPLES2_SOURCE_FD=f'/proc/{os.getpid()}/fd/{source}',DISCIPLES2_SOURCE_SHA256=rt.H.digest(pool),DISCIPLES2_SOURCE_INDEX_SHA256=rt.H.digest(index),DISCIPLES2_MODULE_FD=f'/proc/{os.getpid()}/fd/{module}',DISCIPLES2_MODULE_SHA256=rt.H.digest(b'\\0asm'),DISCIPLES2_MANIFEST_SHA256='a'*64)
prepath=f'/proc/{os.getpid()}/fd/{preload}';env['NODE_OPTIONS']='--preserve-symlinks --require='+prepath
env['NEVERHOOD_FROZEN_PYTHON']=rt.FROZEN_PYTHON
code="""const a=require('node:assert/strict'),cp=require('node:child_process'),{Worker}=require('node:worker_threads');const req=\"require('./lib/neverhood-sealed-fixture')\";a.equal(eval(req),73);a.throws(()=>require('./lib/neverhood-not-in-source-inventory'),{code:'MODULE_NOT_FOUND'});const c=cp.spawnSync(process.execPath,['-e','console.log('+req+')'],{env:process.env});a.equal(c.status,0,c.stderr.toString());a.equal(c.stdout.toString().trim(),'73');new Worker(\"require('node:worker_threads').parentPort.postMessage(\"+req+\")\",{eval:true}).on('message',n=>a.equal(n,73));"""
code+="const py=cp.spawnSync('python3',['-B','test/neverhood-sealed-python.py'],{env:process.env});a.equal(py.status,0,py.stderr.toString());a.match(py.stdout.toString(),/PYTHON_INHERITANCE_PASS/);a.throws(()=>cp.spawnSync('python3',['-B','test/neverhood-unsealed-python.py']),/unsealed Python child/);"
p=rt.subprocess.run(['node','-e',code],env=env,capture_output=True)
assert p.returncode==0,p.stderr
with tempfile.TemporaryDirectory() as d:
 out=pathlib.Path(d)
 result=rt.checked(out,'frozen-python',['python3','-B','test/neverhood-sealed-python.py'],env)
 assert b'PYTHON_INHERITANCE_PASS' in result
for fd in (source,preload,module):os.close(fd)
print('PASS native BUTTON/obsolete clock/UNKNOWN guards; borrowed helper refusal; sealed missing-path main/Worker/OSchild JS+JSON resolution, unknown source refused')`;
 const p=cp.spawnSync('python3',['-B','-c',code],{cwd:path.resolve(__dirname,'..'),encoding:'utf8'});
 process.stdout.write(p.stdout);process.stderr.write(p.stderr);assert.equal(p.status,0);process.exit(0);
}
if(process.argv[2]==='--admission'){
 const code=`import importlib.util,pathlib,json,sys,copy,os
s=importlib.util.spec_from_file_location('runtime','tools/neverhood-original-current-runtime.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
base=pathlib.Path(sys.argv[1]);base.mkdir();original=json.loads(pathlib.Path(sys.argv[2]).read_text())
cases=[('valid',None),('missing-holder','moduleHolder'),('missing-manifest','immutableManifest'),('missing-inheritance','childInheritance'),('wrong-reserve','reserveSeconds'),('wrong-source','sourceSHA256'),('wrong-holder','holder'),('unsealed-holder','unsealed')]
for name,fault in cases:
 out=base/name;out.mkdir();r=copy.deepcopy(original)
 if fault in ('moduleHolder','immutableManifest','childInheritance'):r.pop(fault)
 elif fault=='reserveSeconds':r[fault]=180
 elif fault=='sourceSHA256':r['immutableManifest'][fault]='0'*64
 elif fault in ('holder','unsealed'):
  holder=json.loads(pathlib.Path(r['moduleHolder']).read_text())
  if fault=='holder':holder['startToken']='wrong'
  else:
   raw=os.memfd_create('unsealed-negative',os.MFD_ALLOW_SEALING);os.write(raw,b'{}')
   holder.update(pid=os.getpid(),startToken=m.H.token(os.getpid()),manifestPath=f'/proc/{os.getpid()}/fd/{raw}')
  path=out/'fake-holder.json';path.write_text(json.dumps(holder));r['moduleHolder']=str(path)
 try:m.run(out,r,only_admit=True);passed=True
 except (AssertionError,KeyError,StopIteration):passed=False
 assert passed==(fault is None),name
 assert not (out/'native-pid.json').exists() and not (out/'watchdog-armed.json').exists()
 if fault:assert json.loads((out/'prelaunch-refusal.json').read_text())['originalLaunched'] is False
 if fault=='unsealed':os.close(raw)
print('PASS exact original admission path: valid sealed Worker/process inheritance and seven pre-spawn fail-closed refusals')`;
 const p=cp.spawnSync('python3',['-B','-c',code,...process.argv.slice(3)],{cwd:path.resolve(__dirname,'..'),encoding:'utf8',timeout:120000});
 process.stdout.write(p.stdout);process.stderr.write(p.stderr);assert.equal(p.status,0);process.exit(0);
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
fs.writeFileSync(image,fixture,{flag:'wx'});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const save=(n,v)=>fs.writeFileSync(path.join(out,n),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
async function main(){
 const modes=process.env.NEVERHOOD_NATIVE_MODES?.split(',')||['positive','game-positive','game-aged-positive','game-stale-fault','repaint-positive','transition-hidden-positive','transition-hidden-timeout','focus-fault','owner-fault','semantic-fault','stale-fault','child-caption-fault'];
 for(const [index,mode] of modes.entries()){
  const run=path.join(out,mode);fs.mkdirSync(run);
  fs.copyFileSync(path.join(out,'../runtime-inputs.json'),path.join(run,'runtime-inputs.json'));
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
  const s=startControlSession(['test/run.js','--exe='+image,'--no-build','--spawn-processes','--threads','--real-ticks','--screen=800x600','--control-stdin','--control='+port,'--max-seconds=60','--max-batches=100000000','--stuck-after=0','--quiet-api','--quiet-blocks','--no-close'],{cwd:root,spawnOptions:{detached:true}});
  const send=s.send;let requests=0;
  s.send=command=>{
    assert(!fs.existsSync(path.join(run,'PERMANENT-UNKNOWN.json')),'permanent UNKNOWN; fixture sends no later requests');
    requests++;fs.appendFileSync(path.join(run,'fixture-requests.jsonl'),JSON.stringify({at:Date.now(),action:command.action})+'\n');return send(command);
  };
  s.child.once('close',(exit,signal)=>{const target=path.join(run,'native-wait.json'),pending=target+'.pending';fs.writeFileSync(pending,JSON.stringify({pid:s.child.pid,exit,signal,actualWait:true,stdoutEOF:s.child.stdout.readableEnded,stderrEOF:s.child.stderr.readableEnded}),{flag:'wx'});fs.renameSync(pending,target);});
  watchdog.stdin.write(String(s.child.pid));
  const stat=fs.readFileSync('/proc/'+s.child.pid+'/stat','utf8');
  fs.writeFileSync(path.join(run,'native-pid.json'),JSON.stringify({pid:s.child.pid,startToken:stat.slice(stat.lastIndexOf(')')+2).split(' ')[19]}));
  let controllerRuns=0;
  const controller=async(args,expected=0)=>{
    const startedAt=Date.now();
    const p=await new Promise(resolve=>{
      const child=cp.spawn('python3',['-B','tools/neverhood-original-current-control.py',...args],{cwd:root,env:{...process.env,NEVERHOOD_CURRENT_RUN:run,NEVERHOOD_CURRENT_PORT:String(port)},timeout:7000});
      let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
      child.on('close',(status,signal)=>resolve({pid:child.pid,status,signal,stdout,stderr,actualWait:true,
        stdoutEOF:child.stdout.readableEnded,stderrEOF:child.stderr.readableEnded,startedAt,waitedAt:Date.now()}));
    });
    const prefix=(++controllerRuns)+'-'+args.join('-').replace(/[^a-z0-9-]/gi,'_').slice(0,100);
    fs.writeFileSync(path.join(run,prefix+'.log'),p.stdout+p.stderr);
    fs.writeFileSync(path.join(run,prefix+'-wait.json'),JSON.stringify({...p,stdout:undefined,stderr:undefined,args}));
    assert(p.stdoutEOF&&p.stderrEOF,'controller pipes must drain before its result');
    if(expected===0)assert.equal(p.status,0,p.stdout+p.stderr);else assert.notEqual(p.status,0,'fault must fail');
    return p;
  };
  try{
    let scene;const due=Date.now()+15000;
    do{scene=await s.send({action:'snapshot'});if(scene.modalHwnd!=='0x0')break;assert(Date.now()<due);await pause(30);}while(true);
    if(mode.startsWith('transition-hidden-')){
      // Authored lifecycle injection only: use the actual next native modal's
      // visibility bit. The original application is never modified or resumed.
      const proof=path.join(run,'native-visibility-transition.json');
      await s.send({action:'eval',code:`(()=>{const e=instance.exports,first=e.modal_dialog_hwnd();const timer=setInterval(()=>{const h=e.modal_dialog_hwnd();if(!h||h===first)return;clearInterval(timer);const style=e.wnd_get_style_export(h);e.wnd_set_style_export(h,style&~0x10000000);renderer.showWindow(h,0);const p={authoredOnly:true,hwnd:h,hiddenAt:Date.now(),restored:false};console.log('NV_NATIVE_VISIBILITY '+JSON.stringify(p));${mode==='transition-hidden-positive'?`setTimeout(()=>{e.wnd_set_style_export(h,style);renderer.showWindow(h,1);renderer.repaint();p.restored=true;p.shownAt=Date.now();console.log('NV_NATIVE_VISIBILITY '+JSON.stringify(p));},650);`:''}},1);return true})()`});
    }
    if(!['positive','game-positive','game-aged-positive','repaint-positive','transition-hidden-positive','transition-hidden-timeout'].includes(mode)){
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
      for(const args of [['capture','after-unknown'],['bind','fault-scene'],['intent','retry','fault-scene','215','139','install']])await controller(args,1);
      assert.equal(requests,count);assert.equal(fs.readFileSync(path.join(run,'requests.jsonl'),'utf8'),ledger);
      save(mode+'-terminal.json',{permanentUNKNOWN:true,laterRequests:0,rebindReplayRetry:false,hostTeardownOnly:true});
    }else{
      let generation;
      for(let i=0;i<2;i++){
        const controls=await s.send({action:'eval',code:'(()=>{const e=instance.exports,h=e.modal_dialog_hwnd(),out=[];for(let s=0;(s=e.wnd_next_child_slot(h,s))!==-1;s++){const c=e.wnd_slot_hwnd(s);out.push({id:e.ctrl_get_id(c),x:e.wnd_window_screen_x(c),y:e.wnd_window_screen_y(c),w:e.wnd_screen_w(c),h:e.wnd_screen_h(c)})}return out})()'});
        const b=controls.find(x=>x.id===1);assert(b);
        const name='scene'+i;await controller(['capture',name]);
        const record=JSON.parse(fs.readFileSync(path.join(run,name+'.json')));
        const modal=record.snapshot.windows.find(w=>w.hwnd===record.snapshot.modalHwnd);
        assert.equal(modal.title,'Native controller: '+(i?'second':'first'));
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
        if(!i)await controller(['bind',name]);
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
            assert.equal(ledger.trim().split('\n').map(JSON.parse).filter(r=>r.action==='native-reviewed-capture').length,1);
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
    save(mode+'-native-wait.json',{pid:s.child.pid,exit:s.child.exitCode,signal:s.child.signalCode,actualWait:true,stdoutEOF:s.child.stdout.readableEnded,stderrEOF:s.child.stderr.readableEnded,nativeQuit:['positive','game-positive','game-aged-positive','repaint-positive','transition-hidden-positive'].includes(mode)&&s.child.exitCode===0,hostTeardown:!['positive','game-positive','game-aged-positive','repaint-positive','transition-hidden-positive'].includes(mode)});
    watchdog.stdin.end();const w=await wclosed;save(mode+'-watchdog-wait.json',{pid:watchdog.pid,...w,actualWait:true,stdoutEOF:watchdog.stdout.readableEnded,stderrEOF:watchdog.stderr.readableEnded,stdout:ws,stderr:we});
    assert.equal(w.exit,0,'independent watchdog must close normally');
  }
 }
 save('neverhood-native-admission.json',{generatedTestsPassed:true,safeForNeverhoodOriginal:true,actualNativeButtonTargets:true,childCaptionChangeRefused:true,originalStarted:false});
 console.log('PASS actual native two-dialog transition/independent UP/ExitProcess, focus/owner/semantic/stale faults, repaint admitted and permanent UNKNOWN zero later requests');
}
main().catch(e=>{console.error(e);process.exitCode=1;});

