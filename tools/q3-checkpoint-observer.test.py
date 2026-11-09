"""Offline real generated caller/prelaunch, finite independent watchdog."""
import gzip
import hashlib
import json
import os
from pathlib import Path
import runpy
import signal
import subprocess
import sys
import threading
import time

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(sys.argv[1]).resolve(); OUT.mkdir(exist_ok=False)
assert OUT.is_relative_to(ROOT/'scratch/runs')
m = runpy.run_path(str(ROOT/'tools/q3-checkpoint-observer.py'))
owner = runpy.run_path(str(ROOT/'tools/q3-native-launch-client.py'))
H = lambda b: hashlib.sha256(b).hexdigest()
watch = OUT/'watch'; watch.mkdir(); (watch/'targets').write_text('[]')
w = subprocess.Popen([sys.executable, '-c', '''import json,os,signal,sys,time
from pathlib import Path
r=Path(sys.argv[1]);due=time.monotonic()+75
(r/'armed').write_text(str(os.getpid()))
while time.monotonic()<due and not (r/'done').exists():time.sleep(.01)
fired=not (r/'done').exists()
if fired:
 for p in json.loads((r/'targets').read_text()):
  try:os.killpg(p,signal.SIGKILL)
  except ProcessLookupError:pass
(r/'terminal').write_text(json.dumps(dict(fired=fired)))
''',str(watch)],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
def until(fn):
    due=time.monotonic()+5
    while not fn():
        assert time.monotonic()<due
        time.sleep(.005)
until(lambda:(watch/'armed').exists())
processes=[]
def save(p,v):p.write_bytes(gzip.compress(json.dumps(v).encode(),mtime=0))
def rows(p):return [json.loads(s) for s in p.read_text().splitlines()]
try:
    # Actual retained task branch, only inert runtime and local transport.
    for mode in ('normal','cancel-missing','cancel-partial','damaged-journal','diagnostic-cap'):
        r=OUT/mode;r.mkdir();run=r/'prepared';run.mkdir();out=r/'output';out.mkdir()
        runtime=r/'runtime.py'
        runtime.write_text('''from pathlib import Path
import gzip,json,os,signal,sys,time
r=Path(__file__).parent;p=r/'prepared';o=r/'output'
me=dict(pid=os.getpid(),start=Path('/proc',str(os.getpid()),'stat').read_text().rsplit(')',1)[1].split()[19])
(p/'runtime-identity.json.gz').write_bytes(gzip.compress(json.dumps(me).encode()))
(p/'kernel-armed.json').write_text(json.dumps(dict(supervisor=me['pid'],supervisorStart=me['start'])))
(o/'process.json').write_text(json.dumps(dict(pid=os.getpid(),inert=True)))
(o/'startup-browser.jsonl.gz').write_bytes(gzip.compress(b'{"kind":"inert-readiness-wait"}\\n'))
os.write(1,b'output-before');os.write(2,b'error-before')
signal.signal(signal.SIGTERM,lambda *_:sys.exit(3))
mode='''+repr(mode)+'''
if mode=='cancel-partial':(o/'cancellation-ready.json').write_text('{')
(r/'ready').touch()
if mode!='normal':
 n=0
 while True:
  if mode=='diagnostic-cap':
   n+=1;(o/'process.json').write_text(json.dumps(dict(pid=os.getpid(),inert=True,sequence=n)))
  time.sleep(.005)
''')
        task=owner['compose_task'](ROOT/'scratch/runs/20261109-q3-concurrent-owner-gameplay-0052/task.py',H((ROOT/'scratch/runs/20261109-q3-concurrent-owner-gameplay-0052/task.py').read_bytes()))
        task.update(REMOTE=str(ROOT),BASE=r,R=run,OUT=str(out));task['c'].RUN=str(run.relative_to(ROOT))
        codes=[];task['c'].remote=task['remote']=lambda label,code,timeout:codes.append(code) or ''
        task['owned_launch'](['task.py','launch']);assert len(codes)==1
        composed=m['compose_remote_launch'](codes[0],ROOT,out)
        class Session:
            launch_label='sole-original-launch'
            def remote(self,label,code,timeout):
                assert code==composed
                return code
        session=Session();m['bind_remote'](task,session)
        assert task['remote'](session.launch_label,codes[0],600)==composed
        save(r/'generated-parent.json.gz',dict(code=composed,sha256=H(composed.encode())))
        pre=runpy.run_path(str(ROOT/'tools/q3-native-prelaunch.py'))
        paths={ROOT/'tools/q3-native-prelaunch.py',runtime,ROOT/'tools/q3-checkpoint-observer.py',ROOT/'tools/q3-current-module.cjs',ROOT/'tools/q3-cancellation-stream-eof.py',ROOT/'tools/q3-native-launch-client.py',ROOT/'tools/native-startup-barrier.py',ROOT/'tools/native_kernel_custody.py',ROOT/'tools/q3-native-driver-composition.cjs',*(ROOT/p for p in pre['composition_providers'](ROOT))}
        pins=dict(files=[dict(path=str(p.relative_to(ROOT)),size=p.stat().st_size,sha256=H(p.read_bytes())) for p in sorted(paths)])
        pe=next(p for p in pins['files'] if p['path']=='test/binaries/calc.exe');pins['httpPins']=[dict(url='/test/binaries/calc.exe',size=pe['size'],sha256=pe['sha256'])]
        save(run/'runtime-pins.json.gz',pins)
        if mode=='damaged-journal':(run/'checkpoint-launch.ndjson').write_text('preexisting damage')
        p=subprocess.Popen([sys.executable,'-B','-c',composed],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True);processes.append(p)
        (watch/'targets').write_text(json.dumps([p.pid for p in processes]))
        if mode.startswith('cancel'):
            until(lambda:(r/'ready').exists() or p.poll() is not None);assert (r/'ready').exists()
            (run/'caller-cancelled.json').write_text('{"first":"sticky"}')
            first=(run/'caller-cancelled.json').read_bytes()
        so,se=p.communicate(timeout=12)
        save(r/'actual-wait.json.gz',dict(status=p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=so.decode(),stderr=se.decode()))
        assert rows(run/'checkpoint-spawn.ndjson')[0]['kind']=='prelaunch-spawn-intent'
        if mode in ('damaged-journal','diagnostic-cap'):
            failure=rows(run/'checkpoint-diagnostic-wait.ndjson')[-1]
            assert failure['actualWait'] and failure['stdoutEOF'] and failure['stderrEOF']
            assert p.returncode!=0 and b'diagnostic failed; actual drain completed' in se
            if mode=='damaged-journal':assert (run/'checkpoint-launch.ndjson').read_text()=='preexisting damage'
            else:assert rows(run/'checkpoint-launch.ndjson')[-1]['kind']=='diagnostic-cap'
        else:
            rs=rows(run/'checkpoint-launch.ndjson');assert rs[0]['kind']=='prelaunch-spawn-observed'
            assert rs[-1]['kind']=='prelaunch-actual-wait'
            assert rs[-1]['actualWait'] and rs[-1]['stdoutEOF'] and rs[-1]['stderrEOF']
            assert rs[-1]['browserEOF']=='UNKNOWN'
            assert any(x.get('path','').endswith('process.json') and x['observation']['state']=='published' for x in rs)
            if mode.startswith('cancel'):
                assert (run/'caller-cancelled.json').read_bytes()==first
                assert (run/'caller-cancel-sent.json').exists()
            for name in ('prelaunch-child-actual-wait.json.gz','runtime-parent-actual-wait.json.gz'):
                v=json.loads(gzip.decompress((run/name).read_bytes()));assert v['actualWait'] and v['stdoutEOF'] and v['stderrEOF']
        print(mode,'PASS',flush=True)
    r=OUT/'spawn-failure';r.mkdir()
    try:m['spawn'](r,['/deliberately-absent-q3-inert']);assert False
    except FileNotFoundError:pass
    assert rows(r/'checkpoint-spawn.ndjson')[-1]['kind']=='prelaunch-spawn-failed'
    # Missing vs partial/failed publications and original exists-only false ready.
    for mode in ('missing','partial','failure','cancel','shape','ready','late','fifo','symlink','oversize','gzip-damage'):
        r=OUT/('wait-'+mode);r.mkdir();out=r/'output';out.mkdir();run=r/'run';run.mkdir();p=out/'cancellation-ready.json'
        good=dict(at='inert',nativeQualified=False,waitMs=10000)
        if mode=='partial':p.write_text('{')
        if mode=='failure':(out/'first-browser-failure.json').write_text('{');p.write_text(json.dumps(good))
        if mode=='cancel':(run/'caller-cancelled.json').write_text('{');p.write_text(json.dumps(good))
        if mode=='shape':p.write_text('{}')
        if mode in ('ready','late'):p.write_text(json.dumps(good))
        if mode=='fifo':os.mkfifo(p)
        if mode=='symlink':p.symlink_to('/dev/zero')
        if mode=='oversize':p.write_bytes(b'X'*65537)
        if mode=='gzip-damage':
            q=out/'bad.json.gz';q.write_bytes(b'\x1f\x8b');assert m['publication'](q)['state']=='partial-or-damaged'
        j=m['Journal'](r/'observer.ndjson')
        began=time.monotonic()
        try:
            value=m['wait_checkpoint'](run,out,began+(.2 if mode=='ready' else -.01 if mode=='late' else .04),j,poll=.005)
            assert mode=='ready' and value==good
        except (RuntimeError,TimeoutError,ValueError):assert mode!='ready'
        finally:j.close()
        assert time.monotonic()-began<1
        if mode in ('partial','failure'):
            retained=ROOT/'scratch/runs/20261109-q3-changed-control-native-progress-1475/prepared/cancellation-native-checkpoint-command.json.gz'
            old=json.loads(gzip.decompress(retained.read_bytes()))['code']
            original='/home/user/wine-assembly/scratch/runs/20261108-q3-gl-readiness-gameplay/changed-control-1475-cancellation'
            assert old.count(original)==1
            old=old.replace(original,str(out))
            pold=subprocess.Popen([sys.executable,'-B','-c',old],stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
            processes.append(pold);(watch/'targets').write_text(json.dumps([p.pid for p in processes]))
            so,se=pold.communicate(timeout=3)
            assert pold.returncode==0, se.decode()
            assert so.decode().strip()==p.read_text() # Actual retained poll falsely accepts partial/failure.
            save(r/'old-observer-actual-wait.json.gz',dict(status=pold.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=so.decode(),expectedFalseReady=True))
            assert rows(r/'observer.ndjson')[-1]['kind']!='checkpoint-observed'

        print('wait',mode,'PASS',flush=True)
    # Execute the actual caller adapter's remote observer code, not a mock CDP.
    from types import SimpleNamespace
    for mode in ('ready','cancel'):
        r=OUT/('caller-observer-'+mode);r.mkdir();o=r/'output';o.mkdir()
        good=dict(at='inert',nativeQualified=False,waitMs=10000)
        (o/'cancellation-ready.json').write_text(json.dumps(good))
        if mode=='cancel':(r/'caller-cancelled.json').write_text('{"first":"sticky"}')
        class Caller:
            first=None
            def check(self):
                if self.first:raise RuntimeError(self.first)
            def fail(self,error):
                if not self.first:self.first=error
                return RuntimeError(self.first)
        caller=Caller()
        def local_remote(label,code,timeout):
            assert label=='cancellation-native-checkpoint' and timeout==70
            assert 'deadline=time.monotonic()+60' in code
            p=subprocess.Popen([sys.executable,'-B','-c',code],stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
            processes.append(p);(watch/'targets').write_text(json.dumps([p.pid for p in processes]))
            so,se=p.communicate(timeout=5)
            save(r/'actual-wait.json.gz',dict(status=p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stderr=se.decode()))
            if p.returncode:raise RuntimeError(se.decode())
            return so.decode()
        task=dict(REMOTE=str(ROOT),c=SimpleNamespace(RUN=str(r.relative_to(ROOT))),OUT=str(o))
        try:
            assert m['observe_checkpoint'](task,caller,local_remote)==good
            assert mode=='ready'
        except RuntimeError:
            assert mode=='cancel' and caller.first
            first=caller.first;caller.fail('later terminal');assert caller.first==first
        assert rows(r/'checkpoint-observer.ndjson')[-1]['kind']==('checkpoint-observed' if mode=='ready' else 'checkpoint-terminal')
    j=m['Journal'](OUT/'cap.ndjson')
    try:
        for _ in range(130):j.emit('test')
        assert False
    except RuntimeError:pass
    assert len(rows(OUT/'cap.ndjson'))==128 and (OUT/'cap.ndjson').stat().st_size<1048576
    try:m['compose_remote_launch']('drift',ROOT,OUT);assert False
    except ValueError:pass
finally:
    for p in processes:
        if p.poll() is None:os.killpg(p.pid,signal.SIGKILL)
        p.communicate(timeout=5)
    (watch/'done').touch();so,se=w.communicate(timeout=5)
    save(watch/'actual-wait.json.gz',dict(status=w.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True))
    assert not json.loads((watch/'terminal').read_text())['fired']
print('PASS independent sibling watchdog joined; all owned children actually waited; browser/kernel EOF never inferred',flush=True)
