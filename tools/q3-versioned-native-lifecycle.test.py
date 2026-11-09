"""Actual CLI -> owning prelaunch -> generated custody runtime -> staged Node.

DRIVER_PREFLIGHT is the consumer's existing pre-browser exit. No provider read,
Git, import, runtime, supervisor or subprocess is replaced in the positive run.
"""
from pathlib import Path
import gzip, hashlib, json, os, runpy, signal, subprocess, sys, time

ROOT=Path(__file__).resolve().parents[1]
OUT=Path(sys.argv[1]).resolve();OUT.mkdir()
assert OUT.is_relative_to(ROOT/'scratch/runs')
VERSION='q3-current-foreign-a16fc87d4-44fc9a134-v1'
old=ROOT/'scratch/runs/20261109-q3-current-checkpoint-native-progress-1585'
H=lambda b:hashlib.sha256(b).hexdigest()
children=[]
watch=OUT/'watch';watch.mkdir();(watch/'targets').write_text('[]')
w=subprocess.Popen([sys.executable,'-B','-c', '''from pathlib import Path
import json,os,signal,sys,time
r=Path(sys.argv[1]);due=time.monotonic()+180
(r/'armed').write_text(json.dumps(dict(pid=os.getpid(),deadline=due)))
while time.monotonic()<due and not (r/'done').exists():time.sleep(.02)
fired=not (r/'done').exists()
if fired:
 for pid in json.loads((r/'targets').read_text()):
  try:os.killpg(pid,signal.SIGKILL)
  except ProcessLookupError:pass
(r/'terminal').write_text(json.dumps(dict(fired=fired)))
''',str(watch)],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
due=time.monotonic()+5
while not (watch/'armed').exists():assert time.monotonic()<due;time.sleep(.01)

def call(label,args,env=None):
 p=subprocess.Popen(args,cwd=ROOT,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
 children.append(p);(watch/'targets').write_text(json.dumps([p.pid]))
 so,se=p.communicate(timeout=45)
 (OUT/(label+'.json.gz')).write_bytes(gzip.compress(json.dumps(dict(argv=args,status=p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=so.decode(),stderr=se.decode())).encode(),mtime=0))
 return p.returncode,so,se

try:
 inputs=[]
 for name in ['control.py','physical_gate.py','cancellation_gate.py']:
  # Run-specific inputs only; production runtime wrappers are generated.
  p=OUT/name;p.write_bytes((old/name).read_bytes());inputs.append(str(p.relative_to(ROOT)))
 p=OUT/'phase-input.py';p.write_bytes((old/'phase-input.py').read_bytes());inputs.append(str(p.relative_to(ROOT)))
 args=['node','tools/q3-current-module.cjs','--prepare',str(OUT/'prepared'),'--foreign-closure-version',VERSION,'--checkpoint-observer-version','q3-checkpoint-b993419a5-v1','--native-lifecycle-version','q3-native-lifecycle-foreign-v1','--caller',str(p.relative_to(ROOT))]
 for name in inputs:args+=['--input',name]
 rc,so,se=call('prepare',args);assert rc==0,se.decode();seal=json.loads(so)
 raw=gzip.decompress((OUT/'prepared/runtime-pins.json.gz').read_bytes());pins=json.loads(raw)
 assert H(raw)==seal['manifestSHA256']
 generated=(ROOT/seal['caller']).read_text()
 assert "out=REMOTE+'/'+str((phasebase/'prepared/runtime').relative_to(ROOT))" in generated
 assert "helper['observe_checkpoint'](task,session,session.remote)" in generated
 pre=runpy.run_path(str(ROOT/'tools/q3-native-prelaunch.py'))
 pre['require_composition'](ROOT,pins)
 legacy=dict(pins);legacy.pop('foreignClosureVersion')
 try:pre['require_composition'](ROOT,legacy)
 except ValueError as e:assert 'pin mismatch' in str(e)
 else:raise AssertionError('demonstrated historical prelaunch mismatch absent')
 for version in ['unknown',None]:
  bad=dict(pins)
  if version is None:bad.pop('foreignClosureVersion')
  else:bad['foreignClosureVersion']=version
  try:pre['require_composition'](ROOT,bad)
  except ValueError:pass
  else:raise AssertionError('foreign selector bypass')
 # Git is unavailable to the genuine staged caller, including the actual
 # custody child. Any attempted invocation leaves an observable marker.
 binpath=OUT/'bin';binpath.mkdir();git=binpath/'git'
 git.write_text('#!/bin/sh\necho forbidden >> "'+str(OUT/'git-attempted')+'"\nexit 97\n');git.chmod(0o755)
 env={**os.environ,'PATH':str(binpath)+os.pathsep+os.environ['PATH'],'DRIVER_PREFLIGHT':'1'}
 (OUT/'prepared/lifecycle.json.gz').write_bytes(gzip.compress(json.dumps(dict(overallDeadline=time.time()+1500,manifestSHA256=seal['manifestSHA256'],immutable=True)).encode()))
 for phase in ['cancellation','original']:
  runtime=OUT/phase/'runtime.py';run=OUT/phase/'prepared';run.mkdir()
  (run/'runtime-pins.json.gz').write_bytes((OUT/'prepared/runtime-pins.json.gz').read_bytes())
  for pin in pins['files']:
   b=(ROOT/pin['path']).read_bytes();assert H(b)==pin['sha256'] and len(b)==pin['size']
  check=run/'check';check.mkdir();(check/'runtime-pins.json.gz').write_bytes((run/'runtime-pins.json.gz').read_bytes())
  rc,so,se=call(phase+'-check',['python3','-B','tools/q3-native-prelaunch.py',str(ROOT),str(check),str(runtime),'--check-only'],env)
  assert rc==0,se.decode()
  assert json.loads(so)==dict(checkOnly=True,importsBound=True,spawn=False)
  rc,so,se=call(phase+'-actual-parent',['python3','-B','tools/q3-native-prelaunch.py',str(ROOT),str(run),str(runtime)],env)
  assert rc==0,se.decode()
  wait=json.loads(gzip.decompress((run/'runtime-parent-actual-wait.json.gz').read_bytes()))
  assert wait['actualWait'] and wait['stdoutEOF'] and wait['stderrEOF'] and wait['status']==0
  drain=json.loads((run/'kernel-drain.json').read_bytes())
  assert drain['complete'] and not drain['unreaped']
  assert not (run/'runtime/first-browser-failure.json').exists()
  # The actual consumer preflight is in the custody command journal.
  log=gzip.decompress((run/'kernel-command.log.gz').read_bytes()).decode()
  assert '"chromiumStarted":false' in log or '"chromiumStarted": false' in log,log
  assert not (OUT/'git-attempted').exists()
  print('PASS actual production prelaunch/custody/staged caller',phase,flush=True)
 # Rewritten manifest + rewritten seal cannot retarget the preparing digest.
 forged=OUT/'forged';forged.mkdir();bad=json.loads(raw);bad['files'][0]['sha256']='0'*64
 (forged/'runtime-pins.json.gz').write_bytes(gzip.compress(json.dumps(bad).encode()))
 rc,so,se=call('forged-independent-digest',['node','tools/q3-current-foreign-closure-v1.cjs','--check-staged',str(forged),VERSION,seal['manifestSHA256']],env)
 assert rc!=0 and b'independent prepared manifest SHA' in se
 (OUT/'result.json').write_text(json.dumps(dict(passed=True,actualCLI=True,actualPrelaunch=True,actualCustody=True,gitFree=True,nativeReady=False,browserEOF='UNKNOWN',providers=len(pins['files'])),indent=2))
finally:
 for p in children:
  if p.poll() is None:os.killpg(p.pid,signal.SIGKILL)
  p.communicate(timeout=5)
 (watch/'done').touch();so,se=w.communicate(timeout=5)
 (watch/'wait.json').write_text(json.dumps(dict(status=w.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True)))
 assert not json.loads((watch/'terminal').read_text())['fired']
