'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
async function main(){
 const provenance=require('node:child_process').spawnSync('python3',['-B','-c',String.raw`
import pathlib,json,subprocess,os,tempfile,importlib.util
root=pathlib.Path.cwd();tool=root/'tools/disciples2-current-supervisor.py'
spec=importlib.util.spec_from_file_location('supervisor',tool);s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
pool,index,rows=s.indexed_sources({'test.js':b'one','nested/helper.js':b'two'})
manifest=dict(sourceIndexSHA256=s.digest(index),sources=rows)
s.validate_sources(pool,manifest)
for bad in (pool[:-1],pool+b'junk',pool[:-1]+b'x'):
 try:s.validate_sources(bad,manifest)
 except (AssertionError,ValueError):pass
 else:raise AssertionError('incomplete/corrupt indexed inventory accepted')
evidence=os.environ.get('DISCIPLES2_LAUNCH_TEST_OUT')
with tempfile.TemporaryDirectory() as temporary:
 out=pathlib.Path(evidence or temporary);out.mkdir(parents=True,exist_ok=True)
 base=dict(cwd=str(root),args=['node','-e',"require('fs').writeFileSync(process.env.DISCIPLES2_TEST_MARKER,'executed')"],seconds=220,watchdogGrace=20)
 holderpath=os.environ.get('DISCIPLES2_LAUNCH_HOLDER')
 if holderpath:
  h=json.loads(pathlib.Path(holderpath).read_text());manifest=json.loads(s.holder_bytes(h,'manifestPath'))
  base.update(moduleHolder=holderpath,childInheritance='sealed-node-v1',immutableManifest=dict(manifestSHA256=h['manifestSHA256'],**{k:manifest[k] for k in ('gitSHA','sourceSHA256','moduleSHA256','preloadSHA256')}))
 def run(name,recipe,valid=False):
  d=out/name;d.mkdir();marker=d/'executed';env=os.environ.copy();env['DISCIPLES2_TEST_MARKER']=str(marker)
  (d/'recipe.json').write_text(json.dumps(recipe))
  p=subprocess.run(['python3','-B',str(tool),'run',str(d)],env=env,capture_output=True,timeout=45)
  (d/'tool-wait.json').write_text(json.dumps(dict(exit=p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=p.stdout.decode(),stderr=p.stderr.decode())))
  assert marker.exists()==valid,(name,p.stderr.decode())
  if valid:
   for f in ('native-wait.json','watchdog-wait.json'):
    w=json.loads((d/f).read_text());assert w['exit']==0 and w['actualWait'] and w['stdoutEOF'] and w['stderrEOF'],w
   assert json.loads((d/'runtime-inputs.json').read_text())['sourceSHA256']==manifest['sourceSHA256']
   assert json.loads((d/'inheritance-wait.json').read_text())['exit']==0
  else:
   assert p.returncode!=0 and (d/'prelaunch-refusal.json').exists(),name
   assert not any((d/f).exists() for f in ('native-pid.json','watchdog-armed.json','launch.json')),name
 for field in ('moduleHolder','immutableManifest','childInheritance'):
  recipe=dict(base);recipe.pop(field,None);run('omitted-'+field,recipe)
 if holderpath:
  for name,change in [('missing-holder',dict(moduleHolder=str(out/'absent'))),('manifest-mismatch',dict(immutableManifest=dict(base['immutableManifest'],moduleSHA256='0'*64)))]:run(name,dict(base,**change))
  for name,change in [('stale-holder',dict(startToken='0')),('unsealed-holder',dict(sealed=0)),('descriptor-mismatch',dict(fdPath=h['sourcePath']))]:
   hp=out/(name+'.json');hp.write_text(json.dumps(dict(h,**change)));run(name,dict(base,moduleHolder=str(hp)))
  # Actual production preload rejects omission in both supported child routes.
  for name,code in [('worker-omitted-env',"new (require('worker_threads').Worker)('0',{eval:true,env:{}})"),('worker-omitted-preload',"new (require('worker_threads').Worker)('0',{eval:true,execArgv:[]})"),('process-omitted-env',"require('child_process').spawnSync(process.execPath,['-e','0'],{env:{}})")]:
   d=out/name;d.mkdir();env,fds=s.frozen_inputs(d,base)
   try:
    p=subprocess.run(['node','--require',env['DISCIPLES2_PRELOAD'],'-e',code],cwd=root,env=env,capture_output=True,timeout=20)
    assert p.returncode!=0 and b'sealed child' in p.stderr,(name,p.stderr)
    (d/'wait.json').write_text(json.dumps(dict(exit=p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stderr=p.stderr.decode())))
   finally:
    for fd in fds:os.close(fd)
  run('valid-production-supervisor',base,True)
 print('PASS mandatory sealed admission before native/watchdog spawn'+('; exact live Git holder, manifest and actual Worker/process inheritance' if holderpath else ' (holder-positive not requested)'))
`],{encoding:'utf8',timeout:180000,env:process.env});
 process.stdout.write(provenance.stdout||'');process.stderr.write(provenance.stderr||'');assert.equal(provenance.status,0);
 const closure=require('node:child_process').spawnSync('python3',['-B','-c',String.raw`
import pathlib,json,time,tempfile,os,types,subprocess
path='tools/disciples2-current-controller.py'
def check(source,should_close):
 m=types.ModuleType('fixture');m.__file__=str(pathlib.Path(path).resolve());exec(compile(source,path,'exec'),m.__dict__)
 with tempfile.TemporaryDirectory() as d:
  m.R=pathlib.Path(d);now=time.time();m.save('launch.json',dict(at=now,deadline=now+240,gameplayCutoff=now+60,nativeScene=False))
  stat=pathlib.Path('/proc/'+str(os.getpid())+'/stat').read_text();m.save('native-pid.json',dict(pid=os.getpid(),startToken=stat[stat.rindex(')')+2:].split()[19]))
  m.endpoint_identity=lambda _:None;requests=[]
  def refused(command,timeout=3):
   requests.append(command);raise RuntimeError('reviewed native paint changed')
  m.call=refused
  try:m.bind()
  except RuntimeError:pass
  closed=(m.R/'terminal-input-failure.json').exists()
  assert closed==should_close,(closed,should_close)
  for operation in (lambda:m.capture('later'),lambda:m.bind()):
   try:operation()
   except Exception:pass
  assert len(requests)==(1 if should_close else 2),requests
old=subprocess.check_output(['git','show','68543c27cc4173b085205216c3e2979179f9140f:'+path]).decode()
check(old,False);check(pathlib.Path(path).read_text(),True)
m=types.ModuleType('receipt');m.__file__=str(pathlib.Path(path).resolve());exec(compile(pathlib.Path(path).read_text(),path,'exec'),m.__dict__)
g=dict(owner='one',epoch=1,nonce='finite',deadline=5000);r=dict(**g,state='CONSUMED',consumed=True,consumedAt=4999,receiptBoundary='native-input-return',nativeMessage=dict(msg=513))
m.confirm_receipt(r,g,5)
for patch in (dict(receiptBoundary='host-handler'),dict(nativeMessage=None),dict(consumedAt=5000),dict(consumedAt=5001),dict(owner='replacement'),dict(nonce='replayed'),dict(deadline=6000)):
 try:m.confirm_receipt(dict(r,**patch),g,5)
 except AssertionError:pass
 else:raise AssertionError(patch)
try:m.confirm_receipt(dict(r,consumedAt=4500),g,4.5)
except AssertionError:pass
else:raise AssertionError('capture expiry before operation deadline accepted')
print('PASS historical bind refusal leaves capture request possible; repaired bind failure latches closure, zero later requests')
`],{encoding:'utf8',timeout:10000});
 process.stdout.write(closure.stdout||'');process.stderr.write(closure.stderr||'');assert.equal(closure.status,0);
 const v=await require('../tools/disciples2-current-preflight.cjs').verify();
 assert.equal(v.media.length,128);assert.equal(v.manifestRows,127);assert.equal(v.missing.length,0);
 const {matches}=require('../lib/cli-native-scene');assert(!matches({},{}));
 console.log('PASS 128 original media hashes, 127 manifest sizes/mappings, complete real-DLL graph');
 if(process.env.DISCIPLES2_FIXTURE_OUT){
 const p=require('node:child_process').spawnSync('python3',['-B','-c',String.raw`
import pathlib,json,subprocess,time,os,socket,importlib.util
root=pathlib.Path.cwd();spec=importlib.util.spec_from_file_location('manual',root/'tools/disciples2-current-controller.py')
c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
out=pathlib.Path(os.environ['DISCIPLES2_FIXTURE_OUT']).resolve();out.mkdir(parents=True);c.R=out
with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
c.URL='http://127.0.0.1:'+str(port)+'/ctl'
os.environ.update(DISCIPLES2_CONTROL_URL=c.URL,DISCIPLES2_CONTROL_OUT=str(out))
args=['node','test/run.js','--app=sol','--no-build','--no-threads','--real-ticks','--screen=1024x712','--max-seconds=35','--max-batches=10000000','--control='+str(port),'--quiet-api','--quiet-blocks','--no-close']
h=json.loads(pathlib.Path(os.environ['DISCIPLES2_MODULE_HOLDER']).read_text());manifest=json.loads(pathlib.Path(h['manifestPath']).read_text())
c.save('recipe.json',dict(cwd=str(root),args=args,seconds=220,watchdogGrace=20,nativeScene=True,moduleHolder=os.environ['DISCIPLES2_MODULE_HOLDER'],childInheritance='sealed-node-v1',immutableManifest=dict(manifestSHA256=h['manifestSHA256'],**{k:manifest[k] for k in ('gitSHA','sourceSHA256','moduleSHA256','preloadSHA256')})))
p=subprocess.Popen(['python3','-B','tools/disciples2-current-supervisor.py','durablewait',str(out)],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
try:
 end=time.time()+25
 while True:
  try:
   s=c.call({'action':'snapshot'},1)
   if s['mainHwnd']!='0x0' and s['focusWindow']['live'] and s['physicalUp']:break
  except Exception:pass
  assert time.time()<end,'synthetic fixture startup';time.sleep(.05)
 time.sleep(.3);c.capture('synthetic');rr=c.read('synthetic.json')
 c.save('synthetic-review.json',dict(at=time.time(),pngSHA256=rr['pngSHA256'],observation='Automated public Solitaire fixture; no personal original-game review claim'))
 c.bind('synthetic');c.pulse('finite',['keydown:40'],100,'synthetic','Synthetic current native tuple and tight timing qualification')
 done=c.read('finite-complete.json');assert done['confirmationMs']<=500 and done['physicalUpMs']<=1750
 assert c.read('finite-up.json')['state']=='ACK'
 c.save('assertions.json',dict(currentNativeTuple=True,independentRelease=True,confirmationMs=done['confirmationMs'],physicalUpMs=done['physicalUpMs']))
finally:
 try:c.call({'action':'quit'},2)
 except Exception:pass
 a,b=p.communicate(timeout=15);c.save('fixture-tool-wait.json',dict(pid=p.pid,exit=p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=a.decode(),stderr=b.decode()))
for name in ('native-wait.json','watchdog-wait.json','outer-child-wait.json','outer-wait.json'):
 w=c.read(name);assert w['exit']==0 and w['actualWait'] and w['stdoutEOF'] and w['stderrEOF'],w
print('PASS actual current native scene binding, 500ms confirm /1750ms independent UP, all actual child waits and EOF')
`],{encoding:'utf8',timeout:60000,env:process.env});
 process.stdout.write(p.stdout||'');process.stderr.write(p.stderr||'');assert.equal(p.status,0);
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
