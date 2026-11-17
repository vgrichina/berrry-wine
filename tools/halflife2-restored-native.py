#!/usr/bin/env python3
"""Reuse the published Edit/module proofs; qualify the desktop transport delta."""
import importlib.util,json,os,pathlib,subprocess,sys,types,time
ROOT=pathlib.Path(__file__).resolve().parent.parent
TASK=pathlib.Path(os.environ.get('HL2_TASK_RUN',ROOT/'scratch/runs/20261117-halflife2-restored-disk-normal-agreement-install')).resolve()
PRIOR=ROOT/'scratch/runs/20261117-halflife2-startup-ready-agreement-install-progress/working-final5'
BASE='70e85792eefac2489f655a415490f9e0a5c9297d'
COMPONENT='63d7b0d0e8d979772a4e527a4d3561b4bdeb3692'
EDIT_PROOF=ROOT/'scratch/runs/20261117-halflife2-native-large-edit-viewport-install'
DIAGNOSTICS=('lib/cli-native-user-windows.js','lib/cli-native-scene.js',
             'test/test-cli-native-capture-refusal-details.cjs','test/test-edit-wrap-resize.js',
             'src/13-exports.wat','src/09c3-wndprocs5-edit.wat','tools/control-variant-gate.js',
             'lib/process-desktop.js','test/test-process-desktop-observation.js',
             'test/test-process-desktop-observer-stall.cjs')
def load(name):
 s=importlib.util.spec_from_file_location(name.replace('/','_'),ROOT/name)
 m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
def read(p):return json.loads(p.read_text())
def main():
 m=load('tools/halflife2-current-native.py');m.TASK_RUN=TASK
 assert TASK.parent==ROOT/'scratch/runs','task evidence must stay under scratch/runs'
 m.RUN=pathlib.Path(os.environ['HL2_RUN']);m.RUN.mkdir(parents=True,exist_ok=True);m.disk()
 revision=os.environ['HL2_RESTORED_PIN']
 working=os.environ.get('HL2_WORKING_AUTHORED')=='1'
 assert not working or '--original' not in sys.argv,'working adapter is authored-only'
 for name in ('tools/halflife2-current-native.py','tools/halflife2-restored-native.py'):
  if working and name=='tools/halflife2-restored-native.py':continue
  assert m.git('show',revision+':'+name)==(ROOT/name).read_bytes(),'publish adapter first'
 if working:(m.RUN/'authored-adapter.patch').write_bytes(m.git('diff','--binary','--','tools/halflife2-restored-native.py'))
 if '--supervised' in sys.argv:
  out=m.RUN/'outer';os.environ['HL2_OUTER']=str(out)
  m.save('outer-source-pins.json',dict(adapterGit=revision,baseGit=BASE,componentGit=COMPONENT,
      nativeSeconds=600,independentWatchdogSeconds=620))
  parent=m.published('tools/gltron-current-supervise.py',BASE)
  return parent.ParentProcessSupervisor(out,[sys.executable,'-B',__file__,'--child',
      '--original' if '--original' in sys.argv else '--fixture',
      *(['--diagnostic-qualification'] if '--diagnostic-qualification' in sys.argv else [])],preparation=900,runtime=600,
      preparation_watchdog=920,runtime_watchdog=620,grace=5).run()
 h=m.published('tools/vb5cce-original-runtime.py',BASE)
 h.ROOT,h.RUN,h.HEAD=ROOT,m.RUN,BASE;h.OWN_SOURCES=();h.install_shutdown_handlers()
 pins=read(PRIOR/'native/runtime-inputs.json');manifest=read(PRIOR/'native/immutable-manifest.json')
 fixture=PRIOR/'outer-fixture';proof=read(fixture/'full-native-qualification.json')
 assert proof['passed'] and proof['mainCPUWorkerOSchild']
 assert read(PRIOR/'native/qualification-reuse.json')['passed']
 for p in (fixture/'outer/wait.json',PRIOR/'native/outer/wait.json'):
  w=read(p);assert w['actualWait'] and w['returncode']==w['supervisorExitCode']==0
  assert w['stdoutEOF'] and w['stderrEOF'] and not w['remainingAfterRuntime']
  assert all(x['actualWait'] and x['returncode']==0 and x['stdoutEOF'] and x['stderrEOF'] for x in w['watchdogs'])
 files=h.sources()
 components=read(PRIOR/'native/component-pins.json')['components']
 for name in components:files[name]=m.git('show',COMPONENT+':'+name)
 for name in pins['sources']:
  if name.startswith('node_modules/'):files[name]=(ROOT/name).read_bytes()
 assert {n:m.sha(b) for n,b in files.items()}==pins['sources'],'exact proved source inventory required'
 sealhelper=types.ModuleType('sealed');sealhelper.__file__=str(ROOT/'tools/disciples2-current-supervisor.py')
 exec(compile(files['tools/disciples2-current-supervisor.py'],sealhelper.__file__,'exec'),sealhelper.__dict__)
 pool,index,rows=sealhelper.indexed_sources(files)
 assert m.sha(pool)==manifest['sourceSHA256'] and m.sha(index)==manifest['sourceIndexSHA256']
 original_source_sha=m.sha(pool)
 # Reuse exact published Edit bodies/proofs. Adopt only the explicit desktop
 # transport and focused tests in addition to those already proved bodies.
 changed={}
 for name in DIAGNOSTICS:
  b=(ROOT/name).read_bytes()
  if not working:assert m.git('show',revision+':'+name)==b,'publish diagnostic first'
  changed[name]=dict(before=m.sha(files[name]) if name in files else None,after=m.sha(b));files[name]=b
 pool,index,rows=sealhelper.indexed_sources(files)
 manifest={**manifest,'sourceSHA256':m.sha(pool),'sourceIndexSHA256':m.sha(index),'sources':rows,
           'diagnosticGit':revision,'diagnosticChanges':changed,'unchangedNativeSourceSHA256':original_source_sha}
 old_body=(PRIOR/'native/module.wasm').read_bytes()
 assert m.sha(old_body)==pins['moduleSHA256']==proof['moduleSHA256']==manifest['moduleSHA256']
 source=h.seal('hl2-restored-source',pool)
 module=os.memfd_create('hl2-native-edit-module',os.MFD_ALLOW_SEALING);h.OWN_FDS.add(module)
 preload=h.seal('hl2-restored-preload',files['tools/disciples2-current-native-source-view.cjs'])
 editpins=read(EDIT_PROOF/'fixture/runtime-inputs.json')
 editproof=read(EDIT_PROOF/'fixture/diagnostic-qualification.json')
 assert editproof['passed'] and read(EDIT_PROOF/'fixture/complete-authored-workflow.json')['passed']
 assert read(EDIT_PROOF/'fixture/outer/wait.json')['supervisorExitCode']==0
 # Every WAT/compiler input is identical to the retained tested module. No
 # recompile, new module attribution, or duplicate media/source archive.
 for name,digest in editpins['sources'].items():
  if name.startswith(('src/','tools/watx')) or name in DIAGNOSTICS[:7]:
   assert m.sha(files[name])==digest,'published Edit/module input differs: '+name
 retained=EDIT_PROOF/'fixture/module.wasm';retained_body=retained.read_bytes()
 assert m.sha(retained_body)==editpins['moduleSHA256']==editproof['moduleSHA256']
 assert os.write(module,retained_body)==len(retained_body)
 os.lseek(module,0,0);body=os.read(module,os.fstat(module).st_size)
 import fcntl
 fcntl.fcntl(module,fcntl.F_ADD_SEALS,15);assert body[:4]==b'\0asm'
 os.link(retained,m.RUN/'module.wasm')
 assert m.sha((m.RUN/'module.wasm').read_bytes())==m.sha(body)
 manifest={**manifest,'moduleSHA256':m.sha(body),'priorModuleSHA256':m.sha(old_body),
           'nativeEditDelta':{n:changed[n] for n in DIAGNOSTICS if n.startswith('src/')}}
 encoded=json.dumps(manifest,sort_keys=True).encode()
 # Preserve paths and bytes without duplicate manifest/module writes.
 m.save('compile-inputs.json',dict(gitSHA=revision,sources={n:m.sha(b) for n,b in files.items()},
     moduleSHA256=m.sha(body),priorModuleSHA256=m.sha(old_body),nativeEditDelta=manifest['nativeEditDelta'],
     retainedModuleReference=str(retained.relative_to(ROOT)),exactPublishedEditProofReuse=True))
 m.save('immutable-manifest.json',manifest)
 pins={**pins,'sources':{n:m.sha(b) for n,b in files.items()},'diagnosticGit':revision,'diagnosticChanges':changed,'moduleSHA256':m.sha(body)}
 m.save('runtime-inputs.json',pins)
 (m.RUN/'diagnostic.patch').write_bytes(m.git('diff','--binary',COMPONENT,'--',*DIAGNOSTICS))
 (m.RUN/'desktop-observations').mkdir()
 env=dict(os.environ,NODE_OPTIONS='--preserve-symlinks --require='+f'/proc/{os.getpid()}/fd/{preload}',
     DISCIPLES2_ROOT=str(ROOT),DISCIPLES2_SOURCE_FD=f'/proc/{os.getpid()}/fd/{source}',
     DISCIPLES2_SOURCE_SHA256=m.sha(pool),DISCIPLES2_SOURCE_INDEX_SHA256=m.sha(index),
     DISCIPLES2_PHASE='runtime',DISCIPLES2_MODULE_FD=f'/proc/{os.getpid()}/fd/{module}',
     DISCIPLES2_MODULE_SHA256=m.sha(body),DISCIPLES2_MANIFEST_SHA256=m.sha(encoded),
     DISCIPLES2_ENTRY_SHA256=m.sha(files['test/run.js']),DISCIPLES2_PRELOAD=f'/proc/{os.getpid()}/fd/{preload}',
     DELPHI5_SOURCE_FD=f'/proc/{os.getpid()}/fd/{source}',DELPHI5_MODULE_FD=f'/proc/{os.getpid()}/fd/{module}',
     DELPHI5_MODULE_SHA256=m.sha(body),WINE_COM_PROTOCOL_DIR=str(m.RUN/'children'),
     WINE_PROCESS_DESKTOP_OBSERVE=str(m.RUN/'desktop-observations'))
 m.save('qualification-reuse.json',dict(passed=True,baseGit=BASE,componentGit=COMPONENT,
     adapterGit=revision,moduleSHA256=m.sha(body),sourceSHA256=m.sha(pool),sourceIndexSHA256=m.sha(index),
     exactSourceInventory=True,sourceCount=len(files),moduleBeforeClock=True,allMediaBeforeClock=True,
     previous=str(PRIOR.relative_to(ROOT)),fullProofSHA256=m.sha((fixture/'full-native-qualification.json').read_bytes()),
     coreSuitesRepeated=False,nativeEditDelta=manifest['nativeEditDelta'],
     unchangedNativeSourceSHA256=original_source_sha,diagnosticChanges=changed,at=time.time()))
 try:
  if '--diagnostic-qualification' in sys.argv:
   assert '--original' not in sys.argv,'authored qualification only'
   for name,args in (
       ('native-startup-wrapper',['node','test/test-halflife2-native-wizard.cjs','--startup',str(m.RUN/'native-startup-wrapper')]),
       ('numeric-refusal',['node','test/test-cli-native-capture-refusal-details.cjs']),
       ('captured-next',['node','test/test-halflife2-reviewed-next.cjs']),
       ('scene-context',['node','test/test-cli-native-scene-context.cjs'])):
    h.checked(name,args,env,(source,module))
   m.save('diagnostic-qualification.json',dict(passed=True,diagnosticChanges=changed,
       moduleSHA256=m.sha(body),nativeEditDelta=manifest['nativeEditDelta'],unchangedOtherNativeGraph=True,noOriginal=True,
       exactPublishedEditProofReuse=str(EDIT_PROOF.relative_to(ROOT)),desktopDelta=changed['lib/process-desktop.js']))
  if '--original' in sys.argv:
   f=TASK/'fixture';w=read(f/'outer/wait.json');assert w['supervisorExitCode']==0
   assert read(f/'native-wait.json')['actualWait']
   assert read(f/'qualification-reuse.json')['adapterGit']==revision
   assert read(f/'diagnostic-qualification.json')['passed']
   assert read(f/'diagnostic-qualification.json')['diagnosticChanges']==changed
   workflow=read(f/'complete-authored-workflow.json')
   assert workflow['passed'] and workflow['actualCompleteCLIWorkflow'] and workflow['noOriginal']
   assert workflow['gitSHA']==revision and workflow['moduleSHA256']==m.sha(body)
   m.original(env,source,module,h)
  else:
   import socket,uuid
   exe=m.RUN/'wizard.exe'
   authored=os.environ.get('HL2_AUTHORED_FIXTURE')
   if authored:
    body=pathlib.Path(authored).read_bytes()
    assert m.sha(body)==os.environ['HL2_AUTHORED_FIXTURE_SHA256']
    exe.write_bytes(body)
    m.save('authored-input.json',dict(path=authored,sha256=m.sha(body),bytes=len(body),beforeNativeClock=True))
   else:
    h.checked('fixture-create',['node','-e',"require('fs').writeFileSync(process.argv[1],require('./test/test-halflife2-native-wizard.cjs').dialogFixture())",str(exe)],env,(source,module))
   m.ready()
   with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
   invocation=str(uuid.uuid4());start=time.time()
   seconds=120 if authored else 8
   m.save('launch.json',dict(rootPort=port,deadline=start+seconds,gameplayCutoff=start+seconds-3,reserveSeconds=3))
   args=['node','test/run.js','--exe='+str(exe),'--no-build','--threads','--real-ticks','--png-canvas',
       '--control='+str(port),'--max-seconds='+str(seconds),'--max-batches=1000000000','--stuck-after=0','--quiet-api','--quiet-blocks',
       '--native-exit-receipt='+str(m.RUN/'native-exit.json'),'--native-invocation-token='+invocation]
   m.execute_native(args,env,(source,module),h,invocation)
 finally:
  for fd in list(h.OWN_FDS):h.close_owned(fd)
  m.compact_finished_traces()
  m.save('runtime-release.json',dict(ownDescriptorsClosed=True,at=time.time(),originalMode='--original' in sys.argv))
 return 0
if __name__=='__main__':sys.exit(main())
