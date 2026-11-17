#!/usr/bin/env python3
"""Observe the real adapter's actual subprocess cleanup and exact trigger."""
import importlib.util,json,pathlib,sys,types,os
s=importlib.util.spec_from_file_location('adapter','tools/halflife2-current-native.py')
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
out=pathlib.Path(sys.argv[1]);out.mkdir(parents=True)
for case,free in [('floor',1499999744),('stop',2000000000),('unknown',2000000000),('normal',2000000000)]:
 m.RUN=out/case;m.RUN.mkdir()
 if case=='stop':(m.RUN/'stop-native.json').write_text('{}')
 if case=='unknown':(m.RUN/'PERMANENT-UNKNOWN.json').write_text('{}')
 stat=m.os.statvfs
 m.os.statvfs=lambda p:types.SimpleNamespace(f_bavail=free,f_frsize=1)
 helper=types.SimpleNamespace(native_identity=lambda p:dict(pid=p.pid),terminate_owned=lambda p:p.wait(timeout=10))
 try:
  try:m.execute_native([sys.executable,'-c',"import time;print('authored stdout',flush=True);time.sleep(.1)"],os.environ,(),helper,'fixture')
  except SystemExit as e:assert case!='normal' and e.code==143
 finally:m.os.statvfs=stat
 w=json.loads((m.RUN/'native-wait.json').read_text());assert w['actualWait'] and w['stdoutEOF'] and w['stderrEOF']
 if case=='normal':assert not w['hostCleanup'] and not (m.RUN/'native-cleanup-trigger.json').exists()
 else:
  t=json.loads((m.RUN/'native-cleanup-trigger.json').read_text())
  assert t['freeBytes']==free and t['diskFloor']==(case=='floor')
  assert t['reason']=={'floor':'disk-floor','stop':'stop-requested','unknown':'permanent-unknown'}[case]
  assert w['hostCleanup'] and not w['nativeQuit']
print('PASS exact disk/stop/UNKNOWN trigger, native actual wait and both EOF; normal closure distinct')
