#!/usr/bin/env python3
"""Original Wise startup, with a published sealed graph and finite native life.

Qualification never runs WiseMain. --original is a single ordinary executable
startup after complete authored controls and own outer lifecycle proof.
"""
import gzip,hashlib,json,os,pathlib,re,signal,socket,subprocess,sys,threading,time,types,uuid
ROOT=pathlib.Path(__file__).resolve().parent.parent
TASK_RUN=ROOT/'scratch/runs/20261117-halflife2-persistent-owner-normal-installer-progress'
RUN=pathlib.Path(os.environ.get('HL2_RUN',TASK_RUN/'native'))
MEDIA=ROOT/'scratch/media/half-life-2-demo-original.exe'
DLL=ROOT/'scratch/runs/20261117-halflife2-original-demo-startup-gameplay/WISE0132.dll'
OWN=('tools/halflife2-current-native.py','tools/halflife2-reviewed-next.py',
     'test/test-halflife2-reviewed-next.cjs','test/test-halflife2-native-wizard.cjs')
PREVIOUS=ROOT/'scratch/runs/20261117-halflife2-fixed-wrapper-normal-install-progress/repair-working/outer-fixture'
COMPONENTS=('tools/halflife2-current-native.py','tools/halflife2-persistent-owner.py','test/test-halflife2-persistent-owner.py')
CORE_FIXTURE=ROOT/'scratch/runs/20261117-vb5-real-comctl-startup-ide-sample/installed-published'
NATIVE_SECONDS,WATCHDOG_SECONDS=600,620
COMPACTION_LOCK=threading.Lock()

def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
def sha(b):return hashlib.sha256(b).hexdigest()
def published(name,revision):
 m=types.ModuleType(name.replace('/','_'));m.__file__=str(ROOT/name)
 exec(compile(git('show',revision+':'+name),m.__file__,'exec'),m.__dict__);return m
def save(name,value):
 p=RUN/name;t=p.with_name(p.name+'.'+str(os.getpid())+'.pending')
 with t.open('x') as f:json.dump(value,f,indent=2);f.write('\n');f.flush();os.fsync(f.fileno())
 os.link(t,p);t.unlink()
def disk():
 s=os.statvfs('/home');free=s.f_bavail*s.f_frsize
 assert free>1500000000;return free

def compact_finished_traces():
 with COMPACTION_LOCK:_compact_finished_traces()

def _compact_finished_traces():
 # Per-process desktop traces are fixed-size mappings. Compress only after
 # that writer is absent; retain every byte, its hash and a recovery recipe.
 for p in (RUN/'desktop-observations').glob('*.trace'):
  match=re.match(r'desktop-(\d+)-',p.name)
  if not match or pathlib.Path('/proc',match[1]).exists():continue
  body=p.read_bytes();encoded=gzip.compress(body,mtime=0)
  assert gzip.decompress(encoded)==body
  target=p.with_suffix('.trace.gz')
  with target.open('xb') as f:f.write(encoded)
  assert gzip.decompress(target.read_bytes())==body
  row=dict(path=str(p.relative_to(RUN)),gzip=str(target.relative_to(RUN)),
      sha256=sha(body),gzipSHA256=sha(encoded),bytes=len(body),writerAbsent=True,
      recovery='gzip -dk '+str(target.relative_to(RUN)))
  with (RUN/'desktop-trace-recovery.jsonl').open('a') as f:f.write(json.dumps(row)+'\n')
  p.unlink()
 # Tests copy this immutable receipt into each child directory. Preserve all
 # paths and bytes while sharing storage for exact copies of the root receipt.
 reference=RUN/'runtime-inputs.json'
 if reference.exists():
  body=reference.read_bytes();inode=reference.stat().st_ino
  for p in RUN.rglob('runtime-inputs.json'):
   if p.stat().st_ino==inode or p.read_bytes()!=body:continue
   temporary=p.with_name(p.name+'.link')
   os.link(reference,temporary);os.replace(temporary,p)
   assert p.read_bytes()==body
   with (RUN/'runtime-metadata-dedup.jsonl').open('a') as f:
    f.write(json.dumps(dict(path=str(p.relative_to(RUN)),sha256=sha(body),bytes=len(body),byteIdentical=True))+'\n')

def supervised():
 RUN.mkdir(parents=True,exist_ok=True);disk()
 revision=os.environ.get('HL2_PIN') or git('rev-parse','origin/main').decode().strip()
 assert git('merge-base','--is-ancestor',revision,'origin/main')==b''
 working='--working-qualification' in sys.argv;original='--original' in sys.argv
 assert not (working and original)
 if original:
  route=json.loads((TASK_RUN/'route-native/proof.json').read_text())
  assert route['passed'] and route['realNative'] and route['componentGit']==os.environ['HL2_COMPONENT_PIN']
  assert not (TASK_RUN/'original-installer-invocation.json').exists(),'original allowance already reserved'
  assert git('show',os.environ['HL2_COMPONENT_PIN']+':'+OWN[0])==pathlib.Path(__file__).read_bytes()
  assert (RUN.parent/'outer-fixture/outer/wait.json').exists(),'own outer adapter must be proved first'
  proof=json.loads((RUN.parent/'outer-fixture/outer/wait.json').read_text())
  assert proof['supervisorExitCode']==0 and proof['returncode']==0
  pins=json.loads((RUN.parent/'outer-fixture/outer-source-pins.json').read_text())
  assert pins['adapterSHA256']==sha(pathlib.Path(__file__).read_bytes())
  revision=pins['gitSHA']
  assert git('merge-base','--is-ancestor',revision,'origin/main')==b''
  assert git('show',os.environ['HL2_COMPONENT_PIN']+':'+OWN[0])==pathlib.Path(__file__).read_bytes()
 for name in ('tools/gltron-current-supervise.py','tools/boids-current-supervise.py'):
  assert git('show',revision+':'+name)==(ROOT/name).read_bytes()
 save('outer-source-pins.json',dict(gitSHA=revision,sources={n:sha(git('show',revision+':'+n)) for n in ('tools/gltron-current-supervise.py','tools/boids-current-supervise.py')},adapterSHA256=sha(pathlib.Path(__file__).read_bytes()),workingAuthoredOnly=working,preparationSeconds=900,preparationWatchdogSeconds=920,nativeSeconds=600,independentWatchdogSeconds=620))
 os.environ['HL2_REVISION']=revision;os.environ['HL2_OUTER']=str(RUN/'outer')
 command=[sys.executable,'-B',str(pathlib.Path(__file__).resolve()),'--original' if original else '--outer-fixture']
 if working:command.append('--working-qualification')
 m=published('tools/gltron-current-supervise.py',revision)
 return m.ParentProcessSupervisor(RUN/'outer',command,preparation=900,runtime=600,preparation_watchdog=920,runtime_watchdog=620,grace=5).run()

def ready():
 out=pathlib.Path(os.environ['HL2_OUTER']);assert out==RUN/'outer'
 (out/'prepared.json').write_text(json.dumps(dict(at=time.time(),compiledAndQualified=True,mediaBeforeClock=True)))
 due=time.monotonic()+5
 while not (out/'runtime-start.json').exists():assert time.monotonic()<due;time.sleep(.005)
 arm=json.loads((out/'native-armed.json').read_text());assert arm['seconds']==600
 save('preclock-proof.json',dict(prepared=True,outerNative=arm,independentWatchdog=json.loads((out/'runtime-watchdog-armed.json').read_text()),at=time.time()))

def qualified_graph(env,revision):
 fixture=RUN.parent/'outer-fixture'
 proof=json.loads((fixture/'full-native-qualification.json').read_text())
 manifest=json.loads((fixture/'immutable-manifest.json').read_text())
 inputs=json.loads((fixture/'runtime-inputs.json').read_text())
 wait=json.loads((fixture/'outer/wait.json').read_text())
 assert proof['passed'] and proof['mainCPUWorkerOSchild'] and proof['gitSHA']==revision
 assert manifest['gitSHA']==inputs['gitSHA']==revision
 assert proof['moduleSHA256']==env['DISCIPLES2_MODULE_SHA256']==sha((fixture/'module.wasm').read_bytes())
 assert manifest['sourceSHA256']==env['DISCIPLES2_SOURCE_SHA256']
 assert inputs['sources']==json.loads((RUN/'runtime-inputs.json').read_text())['sources']
 assert wait['actualWait'] and wait['returncode']==wait['supervisorExitCode']==0
 assert wait['stdoutEOF'] and wait['stderrEOF'] and not wait['remainingAfterRuntime']
 assert all(w['actualWait'] and w['returncode']==0 and w['stdoutEOF'] and w['stderrEOF'] for w in wait['watchdogs'])
 return dict(passed=True,gitSHA=revision,moduleSHA256=env['DISCIPLES2_MODULE_SHA256'],
     sourceSHA256=env['DISCIPLES2_SOURCE_SHA256'],
     proofSHA256=sha((fixture/'full-native-qualification.json').read_bytes()),
     actualOuterWaitSHA256=sha((fixture/'outer/wait.json').read_bytes()),
     freshSealedInheritance=True,identicalCompleteSourceMap=True,
     sourceRefresh=False,qualificationRepeated=False,at=time.time())

def reusable_core(files,module_hash,fixture=CORE_FIXTURE):
 """Reuse the completed native core only under exact material identities.

 The two explicitly changed components receive focused fresh qualification:
 scene freshness policy and the sealed loader's source resolver/inheritance.
 All other lib/src/host/runner/shared-control bytes must match the old proof.
 """
 proof=json.loads((fixture/'complete-native-qualification.json').read_text())
 inputs=json.loads((fixture/'runtime-inputs.json').read_text())
 assert proof['passed'] and proof['nativeProtocolAndFullRegression'] and not proof['originalStarted']
 assert proof['moduleSHA256']==inputs['moduleSHA256']==module_hash==sha((fixture/'module.wasm').read_bytes())
 # Reuse completed component tests, not the later VB original's host stop.
 # This adapter's own outer lifecycle is qualified freshly below.
 waits={}
 for p in fixture.glob('*-wait.json'):
  if p.name=='watchdog-wait.json':continue
  w=json.loads(p.read_text())
  assert w['actualWait'] and w['exit']==0 and w['stdoutEOF'] and w['stderrEOF'],p.name
  waits[p.name]=sha(p.read_bytes())
 assert {'inheritance-wait.json','native-controller-wait.json','runtime-shutdown-wait.json','native-dialogbox-wait.json'}<=waits.keys()
 refreshed=('lib/cli-native-scene.js','tools/disciples2-current-native-source-view.cjs')
 material={n:sha(b) for n,b in files.items() if n.startswith(('src/','lib/')) or n in
     ('host.js','test/run.js','tools/vb5cce-original-runtime.py','tools/vb5cce-reviewed-control.py')}
 previous={n for n in inputs['sources'] if n.startswith(('src/','lib/')) or n in
     ('host.js','test/run.js','tools/vb5cce-original-runtime.py','tools/vb5cce-reviewed-control.py')}
 assert set(material)==previous,'native component inventory changed'
 for n,h in material.items():
  if n not in refreshed:assert inputs['sources'].get(n)==h,'native core changed: '+n
 return dict(passed=True,moduleSHA256=module_hash,proofGit=proof['gitSHA'],
     proofSHA256=sha((fixture/'complete-native-qualification.json').read_bytes()),
     componentWaitSHA256=waits,priorOriginalLifecycleReused=False,freshOwnOuterRequired=True,
     materialSourcePins=material,freshComponentTests=list(refreshed),
     unchangedNativeCoreReused=True,fixture=str(fixture.relative_to(ROOT)))

def original(env,source,module,helper):
 disk()
 assert MEDIA.stat().st_size==787701212
 h=hashlib.sha256()
 with MEDIA.open('rb') as f:
  while b:=f.read(1024*1024):h.update(b)
 assert h.hexdigest()=='24205fa8cb6bfab70a82dd713f0addc7cfb0b3c4df40441ebea0320dcb3b441c'
 save('media.json',dict(path=str(MEDIA.relative_to(ROOT)),bytes=MEDIA.stat().st_size,sha256=h.hexdigest(),unchanged=True,beforeNativeClock=True,scriptModified=False))
 ready()
 with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
 invocation=str(uuid.uuid4());start=time.time();deadline=start+600
 argv=['node','test/run.js','--exe='+str(MEDIA),'--exe-guest-path=C:\\half-life-2-demo-original.exe','--cwd=C:\\',
 '--no-build','--threads','--spawn-processes','--real-ticks','--png-canvas',
 '--overlay-dir='+str(RUN/'guest-overlay'),'--overlay-flush-ms=0','--reg-export='+str(RUN/'guest-registry.json'),
 '--native-exit-receipt='+str(RUN/'native-exit.json'),'--native-invocation-token='+invocation,
 '--control='+str(port),'--max-seconds=600','--max-batches=1000000000','--stuck-after=0','--quiet-api','--quiet-blocks']
 save('launch.json',dict(args=argv,rootPort=port,at=start,deadline=deadline,gameplayCutoff=deadline-30,reserveSeconds=30,nativeSeconds=600,watchdogSeconds=620,ordinaryStartup=True,inputsAuthorized=True,scriptModified=False))
 with (TASK_RUN/'original-installer-invocation.json').open('x') as f:
  json.dump(dict(at=time.time(),run=str(RUN),invocationToken=invocation,
      args=argv,gitSHA=helper.HEAD,moduleSHA256=env['DISCIPLES2_MODULE_SHA256'],
      ordinaryStartup=True,allowanceReserved=True),f)
 execute_native(argv,env,(source,module),helper,invocation,original=True)

def execute_native(argv,env,fds,helper,invocation,original=False):
 """Own the actual process wait and both drains, including outer cancellation."""
 p=subprocess.Popen(argv,cwd=ROOT,env=env,pass_fds=fds,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
 if original:helper.ORIGINAL_STARTED=True
 info=helper.native_identity(p);info['invocationToken']=invocation;save('native-pid.json',info)
 ends={};threads=[]
 def drain(pipe,name):
  with (RUN/('native.'+name+'.log')).open('xb') as f:
   while b:=pipe.read1(65536):f.write(b);f.flush()
  ends[name]=True
 for name in ('stdout','stderr'):
  t=threading.Thread(target=drain,args=(getattr(p,name),name));t.start();threads.append(t)
 cleanup=False
 try:
  while p.poll() is None:
   s=os.statvfs('/home')
   if (RUN/'PERMANENT-UNKNOWN.json').exists() or (RUN/'stop-native.json').exists() or s.f_bavail*s.f_frsize<=1500000000:
    cleanup=True;os.killpg(p.pid,signal.SIGTERM);break
   time.sleep(.02)
 except BaseException:
  cleanup=True;raise
 finally:
  rc=helper.terminate_owned(p) if cleanup else p.wait()
  for t in threads:t.join(timeout=10)
  save('native-wait.json',dict(**info,exit=rc,actualWait=True,stdoutEOF=ends.get('stdout',False),stderrEOF=ends.get('stderr',False),atWait=time.time(),atWaitMono=time.monotonic(),disposition='cleanup' if cleanup else 'normal',hostCleanup=cleanup,nativeQuit=False))
  assert ends.get('stdout') and ends.get('stderr'),'native output EOF missing'
  if rc:raise SystemExit(rc if rc>0 else 128-rc)

def run():
 RUN.mkdir(parents=True,exist_ok=True);disk()
 revision=os.environ['HL2_REVISION'];working='--working-qualification' in sys.argv;requested='--original' in sys.argv
 assert not(working and requested)
 assert git('merge-base','--is-ancestor',revision,'origin/main')==b''
 helper=published('tools/vb5cce-original-runtime.py',revision)
 helper.ROOT,helper.RUN,helper.HEAD=ROOT,RUN,revision;helper.OWN_SOURCES=()
 component=os.environ['HL2_COMPONENT_PIN']
 assert git('merge-base','--is-ancestor',component,'origin/main')==b''
 base_sources=helper.sources
 def composed_sources():
  files=base_sources()
  for name in OWN+COMPONENTS:
   body=(ROOT/name).read_bytes() if working and name in COMPONENTS else git('show',component+':'+name)
   assert body==(ROOT/name).read_bytes(),'published component changed: '+name
   files[name]=body
  # Every unchanged component must match the completed repaired wrapper proof.
  old=json.loads((PREVIOUS/'runtime-inputs.json').read_text())
  current={n:sha(b) for n,b in files.items()}
  changed=set(COMPONENTS)
  assert {n:h for n,h in current.items() if n not in changed}=={n:h for n,h in old['sources'].items() if n not in changed and not n.startswith('node_modules/')},'unchanged graph differs'
  patches=git('diff','--binary',revision,component,'--',*COMPONENTS) if not working else git('diff','--binary',revision,'--',*COMPONENTS)
  if working:
   for name in COMPONENTS:
    if subprocess.run(['git','cat-file','-e',revision+':'+name],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode:
     patch=subprocess.run(['git','diff','--no-index','--binary','--','/dev/null',name],cwd=ROOT,capture_output=True);assert patch.returncode==1;patches+=patch.stdout
  (RUN/'composed-components.patch').write_bytes(patches)
  save('component-pins.json',dict(baseGit=revision,componentGit=component,components={n:current[n] for n in COMPONENTS},previousProof=str(PREVIOUS),unchangedGraphExact=True))
  return files
 helper.sources=composed_sources
 # Calling an imported helper bypasses its __main__ shutdown installation.
 # Unwind our native wait/drains and descriptor cleanup on outer TERM/INT.
 helper.install_shutdown_handlers()
 if not working:assert git('show',os.environ['HL2_COMPONENT_PIN']+':'+OWN[0])==pathlib.Path(__file__).read_bytes()
 if hasattr(helper,'compact_closed_observations'):
  shared_compact=helper.compact_closed_observations
  def serialized_shared_compact():
   with COMPACTION_LOCK:shared_compact()
  helper.compact_closed_observations=serialized_shared_compact
 checked=helper.checked
 def checked_and_compact(*args,**kwargs):
  try:return checked(*args,**kwargs)
  finally:compact_finished_traces()
 helper.checked=checked_and_compact
 def qualify(env,files,source,module,**unused):
  if requested:
   save('qualification-reuse.json',qualified_graph(env,revision))
   original(env,source,module,helper)
   return
  old=json.loads((PREVIOUS/'full-native-qualification.json').read_text())
  assert old['passed'] and old['moduleSHA256']==env['DISCIPLES2_MODULE_SHA256']
  wait=json.loads((PREVIOUS/'outer/wait.json').read_text())
  assert wait['actualWait'] and wait['stdoutEOF'] and wait['stderrEOF'] and wait['supervisorExitCode']==0
  save('qualification-reuse.json',dict(previous=str(PREVIOUS),fullWrapperSHA256=sha((PREVIOUS/'wizard-next/wrapper/proof.json').read_bytes()),shutdownSHA256=sha((PREVIOUS/'adapter-shutdown/proof.json').read_bytes()),allUnchangedSourcesExact=True,moduleSHA256=env['DISCIPLES2_MODULE_SHA256'],freshRouteOnly=True))
  helper.checked('route-fixture-create',['node','-e',"require('fs').writeFileSync(process.argv[1],require('./test/test-halflife2-native-wizard.cjs').dialogFixture())",str(RUN/'route-wizard.exe')],env,(source,module))
  save('full-native-qualification.json',dict(passed=True,gitSHA=revision,moduleSHA256=env['DISCIPLES2_MODULE_SHA256'],mainCPUWorkerOSchild=True,fullSourceSealed=True,originalStarted=False,reusedUnchangedWrapper=True))
  ready()
  with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
  invocation=str(uuid.uuid4())
  argv=['node','test/run.js','--native-invocation-token='+invocation,'--control='+str(port),'--native-exit-receipt='+str(RUN/'native-exit.json'),'--exe='+str(RUN/'route-wizard.exe'),'--no-build','--threads','--real-ticks','--png-canvas','--max-seconds='+os.environ.get('HL2_FIXTURE_SECONDS','8'),'--max-batches=1000000000','--stuck-after=0','--quiet-api','--quiet-blocks']
  execute_native(argv,env,(source,module),helper,invocation)
 helper.qualify=qualify
 sys.argv=[__file__,*(['--working-qualification'] if working else [])]
 stopped=threading.Event();compaction_errors=[]
 def compact_loop():
  while not stopped.wait(1):
   try:compact_finished_traces()
   except BaseException as error:compaction_errors.append(repr(error));return
 compactor=threading.Thread(target=compact_loop,name='hl2-closed-evidence',daemon=True)
 compactor.start()
 try:helper.run()
 finally:
  stopped.set();compactor.join(timeout=10)
  for fd in list(helper.OWN_FDS):helper.close_owned(fd)
  compact_finished_traces()
  save('runtime-release.json',dict(ownDescriptorsClosed=True,at=time.time(),originalMode=requested,originalStarted=helper.ORIGINAL_STARTED,compactorJoined=not compactor.is_alive(),compactionErrors=compaction_errors))
  assert not compactor.is_alive() and not compaction_errors

if __name__=='__main__':
 if '--supervised' in sys.argv:sys.exit(supervised())
 else:run()
