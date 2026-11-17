#!/usr/bin/env python3
"""Reuse the exact completed 63d native graph, without recompiling its suites."""
import importlib.util,json,os,pathlib,subprocess,sys,types,time
ROOT=pathlib.Path(__file__).resolve().parent.parent
TASK=ROOT/'scratch/runs/20261117-halflife2-restored-disk-normal-agreement-install'
PRIOR=ROOT/'scratch/runs/20261117-halflife2-startup-ready-agreement-install-progress/working-final5'
BASE='70e85792eefac2489f655a415490f9e0a5c9297d'
COMPONENT='63d7b0d0e8d979772a4e527a4d3561b4bdeb3692'
def load(name):
 s=importlib.util.spec_from_file_location(name.replace('/','_'),ROOT/name)
 m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
def read(p):return json.loads(p.read_text())
def main():
 m=load('tools/halflife2-current-native.py');m.TASK_RUN=TASK
 m.RUN=pathlib.Path(os.environ['HL2_RUN']);m.RUN.mkdir(parents=True,exist_ok=True);m.disk()
 revision=os.environ['HL2_RESTORED_PIN']
 for name in ('tools/halflife2-current-native.py','tools/halflife2-restored-native.py'):
  assert m.git('show',revision+':'+name)==(ROOT/name).read_bytes(),'publish adapter first'
 if '--supervised' in sys.argv:
  out=m.RUN/'outer';os.environ['HL2_OUTER']=str(out)
  m.save('outer-source-pins.json',dict(adapterGit=revision,baseGit=BASE,componentGit=COMPONENT,
      nativeSeconds=600,independentWatchdogSeconds=620))
  parent=m.published('tools/gltron-current-supervise.py',BASE)
  return parent.ParentProcessSupervisor(out,[sys.executable,'-B',__file__,'--child',
      '--original' if '--original' in sys.argv else '--fixture'],preparation=900,runtime=600,
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
 body=(PRIOR/'native/module.wasm').read_bytes()
 assert m.sha(body)==pins['moduleSHA256']==proof['moduleSHA256']==manifest['moduleSHA256']
 source=h.seal('hl2-restored-source',pool);module=h.seal('hl2-restored-module',body)
 preload=h.seal('hl2-restored-preload',files['tools/disciples2-current-native-source-view.cjs'])
 encoded=json.dumps(manifest,sort_keys=True).encode()
 # Preserve paths and bytes without duplicate manifest/module writes.
 for name in ('runtime-inputs.json','immutable-manifest.json','compile-inputs.json','module.wasm'):
  os.link(PRIOR/'native'/name,m.RUN/name)
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
     coreSuitesRepeated=False,at=time.time()))
 try:
  if '--original' in sys.argv:
   f=TASK/'fixture';w=read(f/'outer/wait.json');assert w['supervisorExitCode']==0
   assert read(f/'native-wait.json')['actualWait']
   assert read(f/'qualification-reuse.json')['adapterGit']==revision
   m.original(env,source,module,h)
  else:
   import socket,uuid
   exe=m.RUN/'wizard.exe'
   h.checked('fixture-create',['node','-e',"require('fs').writeFileSync(process.argv[1],require('./test/test-halflife2-native-wizard.cjs').dialogFixture())",str(exe)],env,(source,module))
   m.ready()
   with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
   invocation=str(uuid.uuid4());start=time.time()
   m.save('launch.json',dict(rootPort=port,deadline=start+8,gameplayCutoff=start+5,reserveSeconds=3))
   args=['node','test/run.js','--exe='+str(exe),'--no-build','--threads','--real-ticks','--png-canvas',
       '--control='+str(port),'--max-seconds=8','--max-batches=1000000000','--stuck-after=0','--quiet-api','--quiet-blocks',
       '--native-exit-receipt='+str(m.RUN/'native-exit.json'),'--native-invocation-token='+invocation]
   m.execute_native(args,env,(source,module),h,invocation)
 finally:
  for fd in list(h.OWN_FDS):h.close_owned(fd)
  m.compact_finished_traces()
  m.save('runtime-release.json',dict(ownDescriptorsClosed=True,at=time.time(),originalMode='--original' in sys.argv))
 return 0
if __name__=='__main__':sys.exit(main())
