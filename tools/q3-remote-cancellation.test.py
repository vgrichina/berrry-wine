"""Actual generated Q3 parent/prelaunch + composed Node + current native custody.

Local inert protocol/native fixtures only. The transport and remote executor are
separate owned processes: no assumption that transport death kills remote work.
"""
import ast
import gzip
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import threading
import time

ROOT = Path(__file__).resolve().parents[1]
TASK = ROOT/'scratch/runs/20261109-q3-concurrent-owner-gameplay-0052/task.py'
CLIENT = ROOT/'tools/q3-native-launch-client.py'
OUT = Path(sys.argv[1]).resolve()
OUT.mkdir(parents=True, exist_ok=True)
SPEC = importlib.util.spec_from_file_location('q3_client', CLIENT)
m = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(m)
H = lambda b: hashlib.sha256(b).hexdigest()


def until(fn, seconds=10):
    due = time.monotonic()+seconds
    while not fn():
        if time.monotonic() >= due:
            raise AssertionError('bounded fixture observation deadline')
        time.sleep(.005)


def save(path, value):
    with gzip.open(path, 'xb') as f:
        f.write(json.dumps(value).encode())


def scenario(mode, fixed):
    signal_case = mode.startswith('signal-')
    run = OUT/(('fixed-' if fixed else 'old-')+mode)
    run.mkdir()
    prepared = run/'prepared'
    prepared.mkdir()
    fixture = run/'node-fixture'
    fixture.mkdir()
    tag = 'offline-q3-cancel-'+str(os.getpid())+'-'+run.name
    output = ROOT/'scratch/runs/20261108-q3-gl-readiness-gameplay'/tag
    children = []
    logs = []
    # Independent prearmed watchdog is observable before any runtime spawn.
    targets = run/'targets.json'
    targets.write_text('[]')
    done = run/'watchdog-done'
    watchdog_source = '''import sys,time,json,os,signal
from pathlib import Path
r=Path(sys.argv[1]);due=time.monotonic()+80
(r/'watchdog-armed').write_text(str(os.getpid()))
while time.monotonic()<due and not (r/'watchdog-done').exists():time.sleep(.02)
fired=not (r/'watchdog-done').exists()
if fired:
 for row in json.loads((r/'targets.json').read_text()):
  try:
   stat=Path('/proc',str(row['pid']),'stat').read_text().rsplit(')',1)[1].split()[19]
   if stat==row['start']:os.kill(row['pid'],signal.SIGTERM)
  except ProcessLookupError:pass
  except FileNotFoundError:pass
(r/'watchdog-terminal').write_text(json.dumps(dict(fired=fired)))
'''
    watchdog = subprocess.Popen([sys.executable, '-c', watchdog_source, str(run)], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    until(lambda: (run/'watchdog-armed').exists())

    def spawn(argv, label, **kwargs):
        log = gzip.open(run/(label+'.log.gz'), 'xb')
        p = subprocess.Popen(argv, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, **kwargs)
        target = dict(pid=p.pid, start=Path('/proc',str(p.pid),'stat').read_text().rsplit(')',1)[1].split()[19])
        rows=json.loads(targets.read_text()); rows.append(target)
        temp=targets.with_suffix('.tmp');temp.write_text(json.dumps(rows));temp.replace(targets)
        def pump():
            while chunk := p.stdout.read1(65536):
                log.write(chunk);log.flush()
            p.stdout.close();log.close()
        reader = threading.Thread(target=pump)
        reader.start()
        children.append((p,reader,label,target))
        return p

    task = m.compose_task(TASK, H(TASK.read_bytes()))
    task.update(REMOTE=str(ROOT), BASE=run, R=prepared, OUT=str(output))
    task['c'].RUN = str(prepared.relative_to(ROOT))
    task['save'] = lambda name,value: save(run/(name+'.json.gz'), value)
    # Small native fixture supervisor. All generated launch-parent/prelaunch
    # branches, strict barrier and Node consumer are executed without replacement.
    runtime = run/'runtime.py'
    runtime.write_text('''from pathlib import Path
import sys,os,time,json,gzip
root=Path('''+repr(str(ROOT))+''');run=Path(__file__).resolve().parent;R=run/'prepared'
sys.path.insert(0,str(root/'tools'))
from native_kernel_custody import supervise,identity
end=time.time()+90
with gzip.open(R/'runtime-identity.json.gz','xb') as f:f.write(json.dumps(dict(**identity(os.getpid()),deadline=end)).encode())
os.environ.update(Q3_NODE_FIXTURE='preload',Q3_FIXTURE_DIR=str(run/'node-fixture'),Q3_FIXTURE_DELAY='10',Q3_FIXTURE_STALL_CDP='1',Q3_NATIVE_COMPOSITION='1',CASE_TAG='''+repr(tag)+''',BROWSER_DEADLINE=str(int(end*1000)),Q3_EXECUTION_BOUNDARY_OUT=str(R/'execution-boundary.jsonl.gz'))
command=['node','--require',str(root/'tools/q3-native-driver-composition.test.cjs'),'--require',str(root/'tools/q3-native-driver-composition.cjs'),'--require',str(root/'tools/q3-execution-boundary.cjs'),str(root/'scratch/runs/20261108-q3-gl-readiness-gameplay/browser-run.cjs')]
supervise(R,command,deadline=end,cleanup_deadline=end+30,journal_compression='gzip',command_compression='gzip')
''')
    if signal_case:
        # Keep the real runtime/prelaunch pipe open after native drain, forcing
        # many parent pump iterations without changing any production deadline.
        source = runtime.read_text()
        call = "supervise(R,command,deadline=end,cleanup_deadline=end+30,journal_compression='gzip',command_compression='gzip')"
        assert source.count(call) == 1
        runtime.write_text(source.replace(call, "try:\n    "+call+"\nfinally:\n    (run/'runtime-holding-pipe').touch()\n    due=time.monotonic()+5\n    while not (run/'release-runtime-pipe').exists() and time.monotonic()<due:time.sleep(.005)"))
    providers = subprocess.check_output(['node','-e', "const c=require('./tools/q3-native-driver-composition.cjs');console.log(JSON.stringify(c.compose().references))"], cwd=ROOT)
    refs = json.loads(providers)
    for p in (CLIENT, ROOT/'tools/q3-native-driver-composition.cjs', ROOT/'tools/q3-native-driver-composition.test.cjs', ROOT/'tools/q3-native-prelaunch.py', ROOT/'tools/native-startup-barrier.py',runtime):
        if str(p.relative_to(ROOT)) not in {r['path'] for r in refs}:
            refs.append(dict(path=str(p.relative_to(ROOT)),sha256=H(p.read_bytes()),size=p.stat().st_size))
    save(prepared/'runtime-pins.json.gz',dict(files=refs,httpPins=[],commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()))
    remote_launch = None
    remote_requests = []
    trigger = run/'transport-terminal'
    def transport(code, timeout):
        nonlocal remote_launch
        if 'PRELAUNCH_ACTUAL_WAIT' in code:
            # Execute the EXACT generated parent independently from the local
            # transport. Boat connection behavior itself is outside this test.
            save(run/'generated-parent.json.gz',dict(sha256=H(code.encode()),code=code))
            remote_launch = spawn([sys.executable,'-B','-c',code], 'remote-launch')
            return [sys.executable,'-c', 'import pathlib,time,os\np=pathlib.Path('+repr(str(trigger))+')\nwhile not p.exists():time.sleep(.005)\n'+('raise SystemExit(7)' if mode.startswith('exit') else 'os.close(1);os.close(2);time.sleep(.3)')]
        if 't.request(out,c.id,c,55000)' in code:
            if mode=='normal':return [sys.executable,'-B','-c',code]
            remote_requests.append(spawn([sys.executable,'-B','-c',code], 'remote-request-'+str(len(remote_requests))))
            return [sys.executable,'-c','import time;time.sleep(65)']
        # Real cleanup remote operation; separate owned executor and transport.
        return [sys.executable,'-B','-c',code]
    session = m.Session(run/'session',transport)
    if fixed:
        m.bind_remote(task, session)
    else:
        task['remote'] = task['c'].remote = session.remote
    errors = []
    def launch():
        try: task['owned_launch'](['task.py','launch'])
        except BaseException as e: errors.append(str(e))
    launcher = threading.Thread(target=launch)
    launcher.start()
    command_thread = None
    result = {}
    try:
        until(lambda: (output/'ready.json').exists() or (remote_launch and remote_launch.poll() is not None))
        assert (output/'ready.json').exists(), 'actual composed initializer failed; inspect remote logs'
        if mode.endswith('cdp'):(fixture/'arm-terminal').touch()
        def command():
            try: task['owned_command'](['task.py','command',json.dumps(dict(id='pending_remote',action='quit' if mode=='normal' else 'capture',label='later-effect',waitMs=0 if mode.endswith('cdp') else 1500)),None])
            except BaseException as e: errors.append(str(e))
        command_thread = threading.Thread(target=command)
        command_thread.start()
        until(lambda: (output/'consumed-pending_remote').exists())
        if mode.endswith('cdp'):until(lambda: (fixture/'pending-cdp-at').exists())
        began = time.monotonic()
        if mode=='normal':
            command_thread.join(10)
            assert not command_thread.is_alive()
            assert json.loads((output/'reply-0.json').read_text())['ok']
            until(lambda: remote_launch.poll() is not None)
        if signal_case:
            first_signal = getattr(signal, 'SIG'+mode.split('-')[1])
            os.kill(remote_launch.pid, first_signal)
            until(lambda: (prepared/'caller-cancel-sent.json').exists())
            cancellation = (prepared/'caller-cancelled.json').read_bytes()
            failure = (output/'first-failure.json').read_bytes()
            sent = (prepared/'caller-cancel-sent.json').read_bytes()
            # This interval necessarily crosses the .02s pump boundary while
            # requested remains nonempty and the runtime pipe remains open.
            time.sleep(.12)
            assert remote_launch.poll() is None, 'signal parent aborted before child join'
            for sig in (first_signal, signal.SIGHUP, signal.SIGTERM, signal.SIGINT):
                os.kill(remote_launch.pid, sig)
                time.sleep(.03)
                assert remote_launch.poll() is None, 'repeated signal aborted parent'
            assert (prepared/'caller-cancelled.json').read_bytes() == cancellation
            assert (output/'first-failure.json').read_bytes() == failure
            assert (prepared/'caller-cancel-sent.json').read_bytes() == sent
            until(lambda: (run/'runtime-holding-pipe').exists())
            assert not (prepared/'prelaunch-child-actual-wait.json.gz').exists()
            (run/'release-runtime-pipe').touch()
            until(lambda: remote_launch.poll() is not None)
        trigger.touch()
        until(lambda: session.terminal is not None)
        first = dict(session.terminal)
        command_thread.join(3)
        assert not command_thread.is_alive(), 'local pending command cancellation must settle'
        if mode=='normal':
            assert not (output/'later-effect.png').exists()
        elif fixed:
            until(lambda: remote_launch.poll() is not None)
            assert not (output/'later-effect.png').exists(), 'remote effect after cancellation'
            assert not (output/'reply-0.json').exists(), 'no synthetic successful ACK'
            assert (prepared/'caller-cancelled.json').exists()
        else:
            (fixture/'release-cdp').touch()
            until(lambda: (output/'reply-0.json').exists())
            assert (output/'later-effect.png').exists(), 'old control must demonstrate later effect'
            assert remote_launch.poll() is None, 'remote owner continued after local terminal'
            # Test-owned rescue via actual numbered quit; never an original retry.
            rescue="const t=require('./scratch/runs/20261108-q3-gl-readiness-gameplay/transport.cjs');t.request(process.argv[1],'rescue_quit',{action:'quit'},55000).catch(e=>{console.error(e);process.exitCode=1})"
            p=spawn(['node','-e',rescue,str(output)],'rescue-quit');p.wait(timeout=10)
            assert p.returncode==0
            until(lambda: remote_launch.poll() is not None)
        session.close();launcher.join(3)
        assert not launcher.is_alive() and session.terminal==first
        assert all(r['actualWait'] and r['stdioEOF'] for r in session.receipts)
        drain=json.loads((prepared/'kernel-drain.json').read_text())
        assert drain['complete'] and drain['commandLog']['eof'] and not drain['unreaped']
        assert bool(drain['cancellation'])==(fixed and mode!='normal')
        parent_wait=json.loads(gzip.decompress((prepared/'prelaunch-child-actual-wait.json.gz').read_bytes()))
        runtime_wait=json.loads(gzip.decompress((prepared/'runtime-parent-actual-wait.json.gz').read_bytes()))
        assert parent_wait['actualWait'] and parent_wait['stdioEOF']
        assert runtime_wait['actualWait'] and runtime_wait['stdioEOF']
        assert parent_wait['status']==runtime_wait['status']==int(fixed and mode!='normal')
        result=dict(fixed=fixed,mode=mode,elapsed=time.monotonic()-began,laterEffect=(output/'later-effect.png').exists(),firstFailure=first,kernelOwned=len(drain['owned']),kernelReaped=len(drain['reaped']),kernelComplete=drain['complete'],kernelEOF=drain['commandLog']['eof'],sourceCustody=H((ROOT/'tools/native_kernel_custody.py').read_bytes()),parentWait=parent_wait,runtimeWait=runtime_wait)
    finally:
        # Failure rescue: signal ONLY this fixture's actual supervisor; keep its
        # reaper alive for the existing cancellation/drain protocol.
        (run/'release-runtime-pipe').touch()
        ident=prepared/'runtime-identity.json.gz'
        if remote_launch and remote_launch.poll() is None and ident.exists():
            row=json.loads(gzip.decompress(ident.read_bytes()))
            try: os.kill(row['pid'], signal.SIGTERM)
            except ProcessLookupError: pass
        trigger.touch()
        session.close();launcher.join(5)
        if command_thread: command_thread.join(5)
        for p,reader,label,target in children:
            status=p.wait(timeout=70)
            reader.join(3)
            assert not reader.is_alive()
            save(run/(label+'-actual-wait.json.gz'),dict(**target,status=status,actualWait=True,stdoutEOF=not reader.is_alive()))
        done.touch();wo,we=watchdog.communicate(timeout=3)
        save(run/'watchdog-actual-wait.json.gz',dict(pid=watchdog.pid,status=watchdog.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True))
        assert not json.loads((run/'watchdog-terminal').read_text())['fired']
        if output.exists():
            # Only this uniquely owned generated protocol output is recovered.
            import shutil
            for file in output.rglob('*'):
                if file.is_file():
                    dest=run/'consumer'/file.relative_to(output)
                    dest.parent.mkdir(parents=True,exist_ok=True)
                    data=file.read_bytes()
                    if file.suffix=='.gz':dest.write_bytes(data)
                    else:
                        with gzip.open(str(dest)+'.gz','xb') as stream:stream.write(data)
            shutil.rmtree(output)
    save(run/'result.json.gz',result)
    print(run.name,'PASS',json.dumps(result),flush=True)


# Exact generated source refuses bootstrap after sticky prelaunch revocation.
control=OUT/'pre-cancel';control.mkdir();prepared=control/'prepared';prepared.mkdir()
output=control/'output';output.mkdir()
(output/'first-failure.json').write_text('{"earlier":"preserve"}')
task=m.compose_task(TASK,H(TASK.read_bytes()))
task.update(REMOTE=str(ROOT),BASE=control,R=prepared,OUT=str(output))
task['c'].RUN=str(prepared.relative_to(ROOT))
codes=[]
task['remote']=task['c'].remote=lambda label,code,timeout:codes.append(code) or ''
task['owned_launch'](['task.py','launch'])
m.cancel_remote(prepared,output)
first=(prepared/'caller-cancelled.json').read_bytes()
m.cancel_remote(prepared,output)
assert (prepared/'caller-cancelled.json').read_bytes()==first
assert (output/'first-failure.json').read_text()=='{"earlier":"preserve"}'
code=m.compose_remote_launch(codes[0],ROOT,output)
handlers={sig:signal.getsignal(sig) for sig in (signal.SIGTERM,signal.SIGINT,signal.SIGHUP)}
try:exec(compile(code,'<generated-pre-cancel-control>','exec'),{'__name__':'q3_fixture'})
except RuntimeError as error:assert 'cancelled before prelaunch' in str(error)
else:raise AssertionError('cancel-before-parent admitted prelaunch')
finally:
    for sig,handler in handlers.items():signal.signal(sig,handler)
assert not (prepared/'prelaunch-child.json.gz').exists()
try:m.compose_remote_launch('unsupported source',ROOT,output)
except ValueError:pass
else:raise AssertionError('unsupported parent accepted')
print('pre-cancel PASS actual generated source; zero child; first failure sticky; unsupported source refused',flush=True)

modes = ('exit','eof','exit-cdp','eof-cdp','normal','signal-HUP','signal-TERM-cdp','signal-INT')
if '--mode' in sys.argv:
    modes = (sys.argv[sys.argv.index('--mode')+1],)
for mode in modes:
    scenario(mode, '--old' not in sys.argv)
