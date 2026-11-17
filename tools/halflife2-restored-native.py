#!/usr/bin/env python3
"""Reuse the published Edit/module proofs; qualify the desktop transport delta."""
import importlib.util,json,os,pathlib,subprocess,sys,types,time,signal,uuid
ROOT=pathlib.Path(__file__).resolve().parent.parent
TASK=pathlib.Path(os.environ.get('HL2_TASK_RUN',ROOT/'scratch/runs/20261117-halflife2-restored-disk-normal-agreement-install')).resolve()
PRIOR=ROOT/'scratch/runs/20261117-halflife2-startup-ready-agreement-install-progress/working-final5'
BASE='70e85792eefac2489f655a415490f9e0a5c9297d'
COMPONENT='63d7b0d0e8d979772a4e527a4d3561b4bdeb3692'
RETAINED_DIAGNOSTIC_GIT='fe074afb6341bb9b1294924638424184a441ae08'
EDIT_PROOF=ROOT/'scratch/runs/20261117-halflife2-native-large-edit-viewport-install'
DIAGNOSTICS=('tools/halflife2-reviewed-next.py','lib/cli-native-user-windows.js','lib/cli-native-scene.js',
             'test/test-cli-native-capture-refusal-details.cjs','test/test-edit-wrap-resize.js',
             'src/13-exports.wat','src/09c3-wndprocs5-edit.wat','tools/control-variant-gate.js',
             'lib/process-desktop.js','test/test-process-desktop-observation.js',
             'test/test-process-desktop-observer-stall.cjs','tools/native-lifecycle-trace.cjs')
def load(name):
 s=importlib.util.spec_from_file_location(name.replace('/','_'),ROOT/name)
 m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
def read(p):return json.loads(p.read_text())

def controller_operation(args):
 """Validate the finite call before spawning; clocks here are supervision only."""
 counts={'startup':0,'capture':1,'review':7,'bind':1,'intent':5}
 assert args and args[0] in counts,'unsupported controller operation'
 mode=args[0];assert len(args)==counts[mode]+1,'controller call schema'
 if mode=='review':
  assert args[4] in ('install','quit');int(args[6]);int(args[7])
 if mode=='intent':
  assert args[5] in ('install','quit');int(args[3]);int(args[4])
 inner=15 if mode=='startup' else 3 if mode in ('capture','intent') else 1
 # Import/identity/receipt overhead is outside the unchanged operation clock.
 # Intent also owns the existing bounded independent-release error drain.
 return dict(operation=mode,innerSeconds=inner,outerSeconds=inner+5,
             watchdogSeconds=inner+12,cancellationDrainSeconds=3)

def supervise_controller(run,args,command=None):
 """One owner for helper, independent watchdog, actual wait and both EOFs.

 The optional command is an authored lifecycle-test seam, never a CLI option.
 Parent-process death, TERM/INT, helper errors and deadlines share cleanup.
 """
 bounds=controller_operation(args);run=pathlib.Path(run).resolve()
 assert not (run/'PERMANENT-UNKNOWN.json').exists(),'permanent UNKNOWN; no later controller'
 # A local invocation before launch is invalid, not an observation of USER.
 # Refuse it before constructing a supervisor or a permanent runtime latch.
 assert (run/'launch.json').is_file(),'native launch receipt is not published'
 base=load('tools/gltron-current-supervise.py')
 out=run/'controller-supervision'/(args[0]+'-'+uuid.uuid4().hex)
 class ControllerSupervisor(base.ParentProcessSupervisor):
  def spawn(self,cmd,prefix,env):
   if prefix=='':
    env=dict(env,DELPHI5_RUN=str(run),DELPHI5_PORT=str(read(run/'launch.json')['rootPort']))
   p=super().spawn(cmd,prefix,env)
   if prefix=='':base.BASE.write(self.out/'prepared.json',dict(at=time.time()))
   return p
  def pump(self):
   if (run/'PERMANENT-UNKNOWN.json').exists() and not self.signals:
    self.requested(signal.SIGTERM,None)
   super().pump()
  def cleanup(self):
   # Signal only the direct helper first. Its exception handler drains the
   # prearmed physical release before UNKNOWN; do not kill that release early.
   if self.native is not None and self.native.poll() is None:
    self.native.send_signal(signal.SIGTERM)
    end=time.monotonic()+bounds['cancellationDrainSeconds']
    while self.native.poll() is None and time.monotonic()<end:self.pump()
   super().cleanup()
 out.parent.mkdir(parents=True,exist_ok=True)
 cmd=command or [sys.executable,'-B',str(ROOT/'tools/halflife2-reviewed-next.py'),*args]
 supervisor=ControllerSupervisor(out,cmd,preparation=bounds['outerSeconds'],runtime=bounds['outerSeconds'],
     preparation_watchdog=bounds['watchdogSeconds'],runtime_watchdog=bounds['watchdogSeconds'],grace=1)
 rc=supervisor.run()
 base.BASE.write(out/'operation.json',dict(**bounds,arguments=args,command=cmd))
 if rc and not (run/'PERMANENT-UNKNOWN.json').exists():
  pending=run/('controller-unknown-'+uuid.uuid4().hex+'.pending')
  pending.write_text(json.dumps(dict(name='controller-supervision',operation=args[0],
      supervisorExitCode=rc,wait=str(out/'wait.json'),at=time.time(),noLaterRequests=True)))
  try:os.link(pending,run/'PERMANENT-UNKNOWN.json')
  except FileExistsError:pass
  finally:pending.unlink()
 for name,stream in (('stdout',sys.stdout),('stderr',sys.stderr)):
  p=out/(name+'.log')
  if p.exists():stream.write(p.read_text(errors='replace'));stream.flush()
 return rc
OWNER_START=b"      if (nativeSceneLease) {\n"
OWNER_END=b"      if (reviewedSceneLease) {\n"
OWNER_BLOCK=b"""      if (nativeSceneLease) {
        if (nativeSceneContract === nativeScene.REVIEWED_CONTEXT) {
          current=nativeScene.reviewedOwnerSnapshot(current,controlSnapshot(),nativeSceneLease,instance,threadManager);
        } else {
          const s=controlSnapshot(), main=reviewedWindow(s,s.mainHwnd);
          current.healthy=current.healthy && sameReviewedWindow(main,nativeSceneLease.main) &&
            JSON.stringify(s.nativeProcess)===JSON.stringify(nativeSceneLease.nativeProcess) &&
            JSON.stringify(s.screen)===JSON.stringify(nativeSceneLease.screen);
          current.refs.nativeSceneMainGeneration=main?.generation;
        }
      }
"""
def reviewed_owner_runner(body):
 """Adopt only the reviewed owner block, not unrelated shared-runner changes."""
 def block(b):
  assert b.count(OWNER_START)==1 and b.count(OWNER_END)==1
  a=b.index(OWNER_START);z=b.index(OWNER_END,a);return a,z,b[a:z]
 a,z,old=block(body)
 assert b'sameReviewedOwner(main,nativeSceneLease.main)' in old
 return body[:a]+OWNER_BLOCK+body[z:]
def assert_original_launchable(run):
 assert not (pathlib.Path(run)/'PERMANENT-UNKNOWN.json').exists(),'permanent UNKNOWN; original launch refused'

def main():
 m=load('tools/halflife2-current-native.py');m.TASK_RUN=TASK
 assert TASK.parent==ROOT/'scratch/runs','task evidence must stay under scratch/runs'
 m.RUN=pathlib.Path(os.environ['HL2_RUN']);m.RUN.mkdir(parents=True,exist_ok=True);m.disk()
 if '--original' in sys.argv:assert_original_launchable(m.RUN)
 revision=m.git('rev-parse','--verify',os.environ['HL2_RESTORED_PIN']+'^{commit}').decode().strip()
 assert len(revision)==40,'exact Git commit required'
 working=os.environ.get('HL2_WORKING_AUTHORED')=='1'
 layout_repair=os.environ.get('HL2_EDIT_LAYOUT_REPAIR')=='1'
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
  owned=name in ('lib/cli-native-scene.js','tools/halflife2-reviewed-next.py','tools/native-lifecycle-trace.cjs')
  origin=revision if owned else RETAINED_DIAGNOSTIC_GIT
  b=(ROOT/name).read_bytes() if working and owned else m.git('show',origin+':'+name)
  if name=='lib/cli-native-scene.js':assert b==(ROOT/name).read_bytes(),'publish scene first'
  changed[name]=dict(before=m.sha(files[name]) if name in files else None,after=m.sha(b),sourceGit=origin);files[name]=b
 current_runner=(ROOT/'test/run.js').read_bytes() if working else m.git('show',revision+':test/run.js')
 assert current_runner[current_runner.index(OWNER_START):current_runner.index(OWNER_END)]==OWNER_BLOCK
 assert files['test/run.js']==m.git('show',COMPONENT+':test/run.js'),'reviewed owner delta requires exact proved runner'
 before=m.sha(files['test/run.js']);files['test/run.js']=reviewed_owner_runner(files['test/run.js'])
 changed['test/run.js']=dict(before=before,after=m.sha(files['test/run.js']),onlyReviewedOwnerBlock=True)
 import difflib
 (m.RUN/'reviewed-owner-runner.patch').write_text(''.join(difflib.unified_diff(m.git('show',COMPONENT+':test/run.js').decode().splitlines(True),files['test/run.js'].decode().splitlines(True),fromfile='a/test/run.js',tofile='b/test/run.js')))
 m.save('reviewed-owner-runner.json',dict(**changed['test/run.js'],publishedGit=revision,unrelatedRunnerChangesExcluded=True,patchSHA256=m.sha((m.RUN/'reviewed-owner-runner.patch').read_bytes())))
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
 # Default reuse is byte-identical. The explicit repair variant recompiles
 # only Edit against this exact graph and records a separate module hash.
 for name,digest in editpins['sources'].items():
  if name.startswith(('src/','tools/watx')) or name in ('lib/cli-native-user-windows.js','lib/cli-native-scene.js','test/test-cli-native-capture-refusal-details.cjs','test/test-edit-wrap-resize.js','src/13-exports.wat','src/09c3-wndprocs5-edit.wat','tools/control-variant-gate.js'):
   if name in ('lib/cli-native-scene.js','tools/halflife2-reviewed-next.py'):continue # explicit reviewed ownership JS delta above
   if not (layout_repair and name=='src/09c3-wndprocs5-edit.wat'):
    assert m.sha(files[name])==digest,'published Edit/module input differs: '+name
 retained=EDIT_PROOF/'fixture/module.wasm';retained_body=retained.read_bytes()
 assert m.sha(retained_body)==editpins['moduleSHA256']==editproof['moduleSHA256']
 tested_body=retained_body
 retained_repair=os.environ.get('HL2_RETAINED_LAYOUT_REPAIR')
 if retained_repair:
  assert layout_repair,'retained repair requires the exact repaired Edit graph'
  repair=pathlib.Path(retained_repair).resolve()
  assert repair.is_relative_to(ROOT/'scratch/runs')
  repairpins=read(repair/'runtime-inputs.json')
  repairproof=read(repair/'layout-repair-module.json')
  for name,digest in repairpins['sources'].items():
   if name.startswith(('src/','tools/watx')):
    assert name in files and m.sha(files[name])==digest,'retained repair input differs: '+name
  retained=repair/'module.wasm';tested_body=retained.read_bytes()
  assert m.sha(tested_body)==repairpins['moduleSHA256']==repairproof['moduleSHA256']
  assert repairproof['otherWATAndCompilerInputsExact']
  assert repairproof['fixedWATSHA256']==m.sha(files['src/09c3-wndprocs5-edit.wat'])
  assert os.write(module,tested_body)==len(tested_body)
  m.save('layout-repair-module.json',{**repairproof,'retainedFrom':str(repair.relative_to(ROOT)),
      'retainedInputsSHA256':m.sha((repair/'runtime-inputs.json').read_bytes()),'recompiled':False})
 elif layout_repair:
  # Start from the exact proved Edit graph and replace only its wrapping
  # measurement body. Every other WAT/compiler input was checked above.
  assert m.sha(m.git('show','f1aa883e1c4ce63d433050f7d04f15ace9b1ecff:src/09c3-wndprocs5-edit.wat'))==editpins['sources']['src/09c3-wndprocs5-edit.wat']
  compile_env=dict(os.environ,NODE_OPTIONS='--preserve-symlinks --require='+f'/proc/{os.getpid()}/fd/{preload}',
      DISCIPLES2_ROOT=str(ROOT),DISCIPLES2_SOURCE_FD=f'/proc/{os.getpid()}/fd/{source}',
      DISCIPLES2_SOURCE_SHA256=m.sha(pool),DISCIPLES2_SOURCE_INDEX_SHA256=m.sha(index),
      DISCIPLES2_PHASE='compile',DELPHI5_MODULE_FD=f'/proc/{os.getpid()}/fd/{module}')
  code="""const fs=require('node:fs'),c=require('./tools/watx-closure'),h=require('./tools/region-layout-hash');
const r=c.compileClosure(c.watxSourceClosure(),{tailCalls:true});if(!r.success)throw Error(JSON.stringify(r));
fs.writeFileSync(process.env.DELPHI5_MODULE_FD,h.appendSection(Buffer.from(r.wasmBinary),h.layoutHash(r.regions.regions)));"""
  h.checked('exact-layout-repair-compile',['node','-e',code],compile_env,(source,module))
  os.lseek(module,0,0);tested_body=os.read(module,os.fstat(module).st_size)
  m.save('layout-repair-module.json',dict(baselineModuleSHA256=m.sha(retained_body),moduleSHA256=m.sha(tested_body),
      onlyChangedWAT='src/09c3-wndprocs5-edit.wat',baselineWATSHA256=editpins['sources']['src/09c3-wndprocs5-edit.wat'],
      fixedWATSHA256=m.sha(files['src/09c3-wndprocs5-edit.wat']),otherWATAndCompilerInputsExact=True))
 else:assert os.write(module,tested_body)==len(tested_body)
 os.lseek(module,0,0);body=os.read(module,os.fstat(module).st_size)
 import fcntl
 fcntl.fcntl(module,fcntl.F_ADD_SEALS,15);assert body[:4]==b'\0asm'
 if layout_repair and not retained_repair:(m.RUN/'module.wasm').write_bytes(body)
 else:os.link(retained,m.RUN/'module.wasm')
 assert m.sha((m.RUN/'module.wasm').read_bytes())==m.sha(body)
 manifest={**manifest,'moduleSHA256':m.sha(body),'priorModuleSHA256':m.sha(old_body),
           'nativeEditDelta':{n:changed[n] for n in DIAGNOSTICS if n.startswith('src/')}}
 encoded=json.dumps(manifest,sort_keys=True).encode()
 # The full input inventory is retained once below; the compile receipt pins
 # those exact bytes rather than writing a second copy of every source hash.
 m.save('immutable-manifest.json',manifest)
 pins={**pins,'sources':{n:m.sha(b) for n,b in files.items()},'diagnosticGit':revision,'diagnosticChanges':changed,'moduleSHA256':m.sha(body)}
 m.save('runtime-inputs.json',pins)
 m.save('compile-inputs.json',dict(gitSHA=revision,sourcesReference='runtime-inputs.json',
     runtimeInputsSHA256=m.sha((m.RUN/'runtime-inputs.json').read_bytes()),
     moduleSHA256=m.sha(body),priorModuleSHA256=m.sha(old_body),nativeEditDelta=manifest['nativeEditDelta'],
     retainedModuleReference=str(retained.relative_to(ROOT)),exactPublishedEditProofReuse=not layout_repair,editLayoutRepair=layout_repair))
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
 # Trace only an explicitly requested bounded passive observer. It receives
 # the same sealed source identity as every other runtime helper.
 if os.environ.get('HL2_LIFECYCLE_TRACE')=='1':
  trace=m.RUN/'native-lifecycle';trace.mkdir()
  env['WINE_NATIVE_LIFECYCLE_TRACE']=str(trace)
  env['NODE_OPTIONS']+=' --require='+str(ROOT/'tools/native-lifecycle-trace.cjs')
  execute=m.execute_native
  def traced_execute(argv,*args,**kwargs):
   argv=[*argv,'--trace-api=EndDialog,DestroyWindow,PostQuitMessage,ExitProcess,CreateWindowExA,CreateWindowExW,CreateDialogParamA,DialogBoxParamA,CreateProcessA,WinExec,SendMessageA,PostMessageA,DispatchMessageA']
   return execute(argv,*args,**kwargs)
  m.execute_native=traced_execute
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
       exactPublishedEditProofReuse=not layout_repair,retainedEditBaseline=str(EDIT_PROOF.relative_to(ROOT)),
       editLayoutRepair=layout_repair,desktopDelta=changed['lib/process-desktop.js']))
  if '--original' in sys.argv:
   # Preparation may have outlived a controller's terminal refusal. Never
   # reserve or start an original after that independently published latch.
   assert_original_launchable(m.RUN)
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
   if os.environ.get('HL2_CAPTURE_WORKLOAD_PROFILE')=='1':
    assert authored and working,'capture profiling is working authored-only'
    args.append('--cpu-prof-window=0:1000000000:'+str(m.RUN/'capture-workload.cpuprofile'))
   m.execute_native(args,env,(source,module),h,invocation)
 finally:
  for fd in list(h.OWN_FDS):h.close_owned(fd)
  m.compact_finished_traces()
  m.save('runtime-release.json',dict(ownDescriptorsClosed=True,at=time.time(),originalMode='--original' in sys.argv))
 return 0
if __name__=='__main__':
 if len(sys.argv)>1 and sys.argv[1]=='--controller':
  sys.exit(supervise_controller(sys.argv[2],sys.argv[3:]))
 sys.exit(main())
