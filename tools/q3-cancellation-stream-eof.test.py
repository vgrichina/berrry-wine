"""Offline actual generated Q3 parent + actual prelaunch; real inert children.

No native supervisor, browser, guest, network or Boat. Fresh output argument is
mandatory. Delayed/incomplete streams are inherited by real descendant writers.
"""
import ctypes
import gzip
import hashlib
import json
import os
from pathlib import Path
import runpy
import signal
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(sys.argv[1]).resolve()
OUT.mkdir(exist_ok=False)
assert OUT.is_relative_to(ROOT/'scratch/runs')
H = lambda b: hashlib.sha256(b).hexdigest()
HELPER = ROOT/'tools/q3-cancellation-stream-eof.py'
PRELAUNCH = ROOT/'tools/q3-native-prelaunch.py'
TASK = ROOT/'scratch/runs/20261109-q3-concurrent-owner-gameplay-0052/task.py'
BASE = '94e041a439783b0df355eb58744ecf521249dc1f'
OLD = subprocess.check_output(['git', 'show', BASE+':tools/q3-native-prelaunch.py'], cwd=ROOT, text=True)
assert 'stderr=subprocess.STDOUT' in OLD and 'stdoutEOF' not in OLD
PRIOR = ROOT/'scratch/runs/20261109-q3-joined-console-native-1250'
retained = json.loads(gzip.decompress((PRIOR/'prepared/cancellation-generated-parent.json.gz').read_bytes()))
assert H(retained['code'].encode()) == retained['sha256']
prior_pins = json.loads(gzip.decompress((PRIOR/'runtime-pins.json.gz').read_bytes()))
assert next(p['sha256'] for p in prior_pins['files'] if p['path']=='tools/q3-native-prelaunch.py') == H(OLD.encode())
owner = runpy.run_path(str(ROOT/'tools/q3-native-launch-client.py'))
helper = runpy.run_path(str(HELPER))
# Orphaned retained writers become OUR children, so cleanup uses actual waitpid.
assert ctypes.CDLL(None, use_errno=True).prctl(36, 1, 0, 0, 0) == 0


def save(path, value):
    with gzip.open(path, 'xb') as f:
        f.write(json.dumps(value).encode())


def read(path):
    return json.loads(gzip.decompress(path.read_bytes()))


def until(fn, seconds=10):
    due = time.monotonic()+seconds
    while not fn():
        assert time.monotonic()<due, 'bounded offline fixture deadline'
        time.sleep(.005)


def require(waits):
    assert waits and all(v['actualWait'] and v.get('stdoutEOF') and v.get('stderrEOF') for v in waits), 'separate EOF required'


# Independent deadline guard, armed before the first process-under-test exists.
watch = OUT/'watch'
watch.mkdir()
(watch/'targets').write_text('[]')
watchdog = subprocess.Popen([sys.executable, '-c', '''import os,sys,time,json,signal
from pathlib import Path
r=Path(sys.argv[1]);due=time.monotonic()+100
(r/'armed').touch()
while time.monotonic()<due and not (r/'done').exists():time.sleep(.02)
fired=not (r/'done').exists()
if fired:
 for pid in json.loads((r/'targets').read_text()):
  try:os.killpg(pid,signal.SIGKILL)
  except ProcessLookupError:pass
(r/'terminal').write_text(json.dumps(dict(fired=fired)))
''', str(watch)], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
until(lambda: (watch/'armed').exists())


def scenario(mode, fixed):
    run=OUT/(('new-' if fixed else 'old-')+mode)
    run.mkdir();prepared=run/'prepared';prepared.mkdir();output=run/'output';output.mkdir()
    runtime=run/'runtime.py'
    # Match actual runtime's imports/identity-before-arm shape, but never invoke
    # custody or an application. Signal exit retains the first failure bytes.
    runtime.write_text('''from pathlib import Path
import os,sys,time,json,gzip,signal,subprocess
r=Path(__file__).resolve().parent;p=r/'prepared'
def identity(pid):
 s=Path('/proc',str(pid),'stat').read_text();return dict(pid=pid,start=s.rsplit(')',1)[1].split()[19])
me=identity(os.getpid())
with gzip.open(p/'runtime-identity.json.gz','xb') as f:f.write(json.dumps(me).encode())
(p/'kernel-armed.json').write_text(json.dumps(dict(supervisor=me['pid'],supervisorStart=me['start'])))
def terminal(s,f):
 (r/'term-observed').touch()
 if 'held' in '''+repr(mode)+''':
  while not (r/'release').exists():time.sleep(.005)
 sys.exit(1)
signal.signal(signal.SIGTERM,terminal)
os.write(1,b'stdout-before\\n');os.write(2,b'stderr-before\\n')
# More than a pipe buffer on BOTH streams exercises concurrent drain.
os.write(1,b'O'*131072);os.write(2,b'E'*131072)
mode='''+repr(mode)+'''
if mode.startswith('cancellation'):
 (r/'ready').touch()
 while True:time.sleep(.01)
if mode in ('delayed-stdout','delayed-stderr','incomplete-stream'):
 fd=2 if mode=='delayed-stderr' else 1
 code="from pathlib import Path;import sys,time,os;r=Path(sys.argv[1]);(r/'writer-ready').touch();\\nwhile not (r/'release').exists():time.sleep(.005)\\nos.write(int(sys.argv[2]),b'writer-final\\\\n')"
 w=subprocess.Popen([sys.executable,'-c',code,str(r),str(fd)],stdout=None if fd==1 else subprocess.DEVNULL,stderr=None if fd==2 else subprocess.DEVNULL)
 (r/'writer-identity').write_text(json.dumps(identity(w.pid)))
(r/'runtime-exiting').write_text(json.dumps(me))
''')
    task=owner['compose_task'](TASK,H(TASK.read_bytes()))
    task.update(REMOTE=str(ROOT),BASE=run,R=prepared,OUT=str(output))
    task['c'].RUN=str(prepared.relative_to(ROOT))
    codes=[]
    task['c'].remote=task['remote']=lambda label,code,timeout:codes.append(code) or ''
    task['owned_launch'](['task.py','launch'])
    assert len(codes)==1
    code=codes[0]
    expected=['python3','-B',str(PRELAUNCH),str(ROOT),str(prepared),str(runtime)]
    assert code.count(repr(expected))==1, 'exact actual generated invocation'
    # Compare against the ACTUAL retained 1250 cancellation parent, changing
    # only run/root/output paths. The generated composition must be identical.
    historical_root='/home/user/q3-joined-console-1250'
    historical_base=historical_root+'/scratch/runs/20261109-q3-joined-console-native-1250/cancellation'
    normalized=retained['code'].replace(historical_base+'/prepared',str(prepared)).replace(historical_base+'/runtime.py',str(runtime))
    normalized=normalized.replace(historical_root+'/scratch/runs/20261108-q3-gl-readiness-gameplay/joined-console-1250-cancellation',str(output)).replace(historical_root,str(ROOT))
    assert owner['compose_remote_launch'](code,ROOT,output)==normalized
    if not fixed:
        # Execute the exact Git baseline wrapper in memory. No source snapshot.
        bootstrap='import sys;sys.argv='+repr(expected[2:])+';exec(compile('+repr(OLD)+','+repr(str(PRELAUNCH)) +",'exec'),{'__name__':'__main__','__file__':"+repr(str(PRELAUNCH))+'})'
        code=code.replace(repr(expected),repr([sys.executable,'-B','-c',bootstrap]))
    compose=helper['compose_remote_launch'] if fixed else owner['compose_remote_launch']
    expected_code=compose(code,ROOT,output)
    if fixed:
        class Session:
            launch_label='sole-original-launch'
            def remote(self,label,actual,timeout):
                assert label==self.launch_label
                assert actual==expected_code
                return actual
        session=Session()
        helper['bind_remote'](task,session)
        code=task['remote'](session.launch_label,code,600)
        assert 'cancel_remote' in session.cancel_code
    else:code=expected_code
    save(run/'generated-parent.json.gz',dict(code=code,sha256=H(code.encode()),baseline=BASE,fixtureRuntimeSHA=H(runtime.read_bytes())))
    providers=runpy.run_path(str(PRELAUNCH))['composition_providers'](ROOT)
    paths={PRELAUNCH,runtime,HELPER,ROOT/'tools/q3-native-launch-client.py',ROOT/'tools/native-startup-barrier.py',ROOT/'tools/native_kernel_custody.py',ROOT/'tools/q3-native-driver-composition.cjs',*(ROOT/p for p in providers)}
    pins=dict(files=[dict(path=str(p.relative_to(ROOT)),size=p.stat().st_size,sha256=H(p.read_bytes())) for p in sorted(paths)])
    pe=next(p for p in pins['files'] if p['path']=='test/binaries/calc.exe')
    pins['httpPins']=[dict(url='/test/binaries/calc.exe',size=pe['size'],sha256=pe['sha256'])]
    save(prepared/'runtime-pins.json.gz',pins)
    process=subprocess.Popen([sys.executable,'-B','-c',code],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
    targets=json.loads((watch/'targets').read_text());targets.append(process.pid);(watch/'targets').write_text(json.dumps(targets))
    receipts=[prepared/'prelaunch-child-actual-wait.json.gz',prepared/'runtime-parent-actual-wait.json.gz']
    writer=None
    try:
        if mode.startswith('cancellation'):
            until(lambda:(run/'ready').exists() or process.poll() is not None)
            assert (run/'ready').exists()
            (output/'first-failure.json').write_text('{"first":"sticky"}')
            os.kill(process.pid,signal.SIGHUP)
            until(lambda:(prepared/'caller-cancel-sent.json').exists())
            original=(prepared/'caller-cancelled.json').read_bytes()
            if mode=='cancellation-held':
                until(lambda:(run/'term-observed').exists())
                sent=(prepared/'caller-cancel-sent.json').read_bytes()
                for sig in (signal.SIGHUP,signal.SIGTERM,signal.SIGINT):
                    os.kill(process.pid,sig)
                    time.sleep(.04)
                    assert process.poll() is None
                    assert not any(p.exists() for p in receipts)
                assert (prepared/'caller-cancelled.json').read_bytes()==original
                assert (prepared/'caller-cancel-sent.json').read_bytes()==sent
                (run/'release').touch()
        elif mode!='normal':
            until(lambda:(run/'writer-ready').exists() or process.poll() is not None)
            assert (run/'writer-ready').exists()
            writer=json.loads((run/'writer-identity').read_text())
            until(lambda:(run/'runtime-exiting').exists())
            runtime_id=json.loads((run/'runtime-exiting').read_text())
            def runtime_exited():
                p=Path('/proc',str(runtime_id['pid']),'stat')
                return not p.exists() or p.read_text().rsplit(')',1)[1].split()[0]=='Z'
            until(runtime_exited)
            time.sleep(.15 if mode!='incomplete-stream' else .35)
            assert process.poll() is None, 'retained writer must delay outer exit'
            assert not any(p.exists() for p in receipts), 'child exit cannot establish EOF'
            # One stream is deliberately incomplete. No receipt means the same
            # production acceptance predicate cannot accept this interval.
            try:require([read(p) for p in receipts if p.exists()])
            except AssertionError:pass
            else:raise AssertionError('incomplete stream admitted')
            assert os.waitpid(writer['pid'],os.WNOHANG)==(0,0), 'writer still live'
            (run/'release').touch()
        so,se=process.communicate(timeout=10)
        save(run/'generated-parent-actual-wait.json.gz',dict(pid=process.pid,status=process.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=so.decode(),stderr=se.decode()))
        assert process.returncode==int(mode.startswith('cancellation')),se.decode()
        if writer:
            pid,status=os.waitpid(writer['pid'],0)
            assert pid==writer['pid'] and os.waitstatus_to_exitcode(status)==0
            save(run/'writer-actual-wait.json.gz',dict(**writer,status=0,actualWait=True))
        waits=[read(p) for p in receipts]
        try:require(waits)
        except AssertionError:
            assert not fixed, waits
            outcome='expected combined-EOF FAIL'
        else:
            assert fixed, waits
            outcome='separate-EOF PASS'
        assert all(v['actualWait'] and v['stdioEOF'] for v in waits)
        log=gzip.decompress((prepared/'runtime-parent.log.gz').read_bytes())
        assert b'stdout-before\n' in log and b'stderr-before\n' in log
        assert log.count(b'O')==131072 and log.count(b'E')==131072
        if writer:assert b'writer-final\n' in log
        if mode.startswith('cancellation'):
            assert (prepared/'caller-cancelled.json').read_bytes()==original
            assert (output/'first-failure.json').read_text()=='{"first":"sticky"}'
            assert not list(output.glob('reply*')) and not list(output.glob('*.png'))
        save(run/'result.json.gz',dict(mode=mode,fixed=fixed,outcome=outcome,waits=waits,incompleteRejected=mode in ('delayed-stdout','delayed-stderr','incomplete-stream','cancellation-held'),scope='offline inert runtime; native cancellation NOT_PROVEN'))
        print(run.name,outcome,flush=True)
    finally:
        (run/'release').touch()
        if process.poll() is None:
            os.killpg(process.pid,signal.SIGKILL)
            process.communicate(timeout=5)


try:
    for mode in ('normal','cancellation','cancellation-held','delayed-stdout','delayed-stderr','incomplete-stream'):
        for fixed in (False,True):scenario(mode,fixed)
    # Fail closed before spawn for malformed composition; bind uses existing
    # client call sites and never changes the input/command implementation.
    try:helper['compose_remote_launch']('unsupported',ROOT,OUT)
    except ValueError:pass
    else:raise AssertionError('unsupported composition admitted')
finally:
    (watch/'done').touch()
    so,se=watchdog.communicate(timeout=5)
    assert watchdog.returncode==0 and not json.loads((watch/'terminal').read_text())['fired']
    save(OUT/'watchdog-actual-wait.json.gz',dict(pid=watchdog.pid,status=watchdog.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True))
print('PASS actual generated old/new parent and actual prelaunch; real waits and retained per-stream writers',flush=True)
