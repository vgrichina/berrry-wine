"""Offline actual control.py branches and real request subprocess failures."""
import ast
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
TASK = ROOT/'scratch/runs/20261109-quake2-observed-guard-route-0105/control.py'
spec = importlib.util.spec_from_file_location('q2_client', ROOT/'tools/quake2-native-launch-client.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
OUT = Path(sys.argv[1]).resolve()
OUT.mkdir(parents=True, exist_ok=True)


def until(check, timeout=3):
    end = time.monotonic()+timeout
    while not check():
        assert time.monotonic() < end, 'fixture deadline'
        time.sleep(.005)


def scenario(failure, pending):
    directory = OUT/(str(failure)+('-pending' if pending else '-next'))
    runtime = directory/'runtime/original'
    (runtime/'commands').mkdir(parents=True)
    (runtime/'execution-window.json').write_text(json.dumps(dict(
        browserStop=time.strftime('%Y-%m-%dT%H:%M:%S', time.gmtime(time.time()+180))+'Z')))
    task = m.compose_task(TASK, hashlib.sha256(TASK.read_bytes()).hexdigest())
    task['ROOT'], task['REMOTE'], task['RUN'] = ROOT, str(ROOT), str(runtime.parent.relative_to(ROOT))
    task['R'] = directory
    (directory/'review').mkdir()
    capture = dict(label='tunnel', sha256='reviewed-fixture')
    (directory/'review/tunnel-capture.json').write_text(json.dumps(capture))
    requests = []
    def transport(code, timeout):
        if '--remote-parent' in code:
            assert 'quake2-native-launch-client.py' in code
            after = {'SIGPIPE':'os.kill(os.getpid(),signal.SIGPIPE)',
                     'SIGTERM':'os.kill(os.getpid(),signal.SIGTERM)',
                     'stdoutEOF':'os.close(1);time.sleep(1)',
                     'stderrEOF':'os.close(2);time.sleep(1)'}.get(str(failure), 'raise SystemExit('+str(failure)+')')
            return [sys.executable, '-c', 'import os,time,pathlib,signal\nsignal.signal(signal.SIGPIPE,signal.SIG_DFL)\np=pathlib.Path('+repr(str(directory/'trigger'))+')\nwhile not p.exists():time.sleep(.005)\n'+after]
        tree = ast.parse(code)
        call = tree.body[1].value
        assert isinstance(call, ast.Call) and ast.unparse(call.func) == 'subprocess.run'
        argv = ast.literal_eval(call.args[0])
        assert argv[:2] == ['node', '-e'] and 't.request(out,s.command.id,s.command,50000)' in argv[2]
        assert 'tools/quake2-native-transport.cjs' in argv[2]
        requests.append(code)
        return argv
    caller = m.Caller(task, directory/'client', transport)
    launch_errors, errors = [], []
    def launch():
        try: caller.launch()
        except BaseException as e: launch_errors.append(str(e))
    launcher = threading.Thread(target=launch)
    launcher.start()
    until(caller.session.started.is_set)
    def request(identifier):
        caller.request(dict(command=dict(id=identifier, action='combo', keys=['ArrowUp','Control'],
            holdMs=100, waitMs=0, label=identifier, reviewRef='tunnel'), review='personally inspected tunnel fixture'))
    def first():
        try: request('pending_crouch')
        except BaseException as e: errors.append(str(e))
    worker = None
    try:
        if pending:
            worker = threading.Thread(target=first)
            worker.start()
            until(lambda: (runtime/'commands/0.json').exists())
        began = time.monotonic()
        (directory/'trigger').touch()
        until(lambda: caller.session.terminal is not None)
        first_terminal = dict(caller.session.terminal)
        if worker:
            worker.join(2)
            assert not worker.is_alive() and errors
        elapsed = time.monotonic()-began
        assert elapsed < 1, 'must cancel pending real Node request before ACK cap'
        (directory/'review/tunnel-capture.json').unlink()  # Later review must not even be read.
        for identifier in ('later_crouch', 'later_capture', 'later_quit'):
            try: request(identifier)
            except m.TerminalFailure: pass
            else: raise AssertionError('later request accepted')
        assert caller.session.terminal == first_terminal
        until(lambda: (caller.session.evidence/'cleanup.json').exists())
        assert len(requests) == int(pending)
        assert not (runtime/'commands/1.json').exists()
        assert not (runtime/'reply-0.json').exists(), 'no invented ACK'
        assert not (directory/'request-later_crouch.json.gz').exists()
        if 'EOF' in str(failure): assert 'EOF' in first_terminal['reason']
    finally:
        receipts = caller.session.close()
        launcher.join(3)
        if worker: worker.join(3)
    assert not launcher.is_alive()
    assert all(r['actualWait'] and r['stdoutEOF'] and r['stderrEOF'] for r in receipts)
    if str(failure).startswith('SIG'):
        assert receipts[0]['status'] == -getattr(signal, str(failure))
    elif isinstance(failure, int): assert receipts[0]['status'] == failure
    assert all(not Path('/proc', str(r['pid'])).exists() for r in receipts)
    (directory/'result.json').write_text(json.dumps(dict(elapsedSeconds=elapsed, firstTerminal=first_terminal, receipts=receipts)))
    print(directory.name, 'PASS actual retained caller and Node sender; sticky UNKNOWN; actual wait/separate EOF')


try: m.compose_task(TASK, '0'*64)
except ValueError: pass
else: raise AssertionError('unreviewed caller hash accepted')
for failure in ('SIGPIPE', 'SIGTERM', 143, 0, 'stdoutEOF', 'stderrEOF'):
    for pending in (False, True): scenario(failure, pending)

for bad_command in (False, True):
    directory = OUT/('sender-failure' if bad_command else 'success')
    runtime = directory/'runtime/original'
    (runtime/'commands').mkdir(parents=True)
    (runtime/'execution-window.json').write_text(json.dumps(dict(
        browserStop=time.strftime('%Y-%m-%dT%H:%M:%S', time.gmtime(time.time()+180))+'Z')))
    task = m.compose_task(TASK, hashlib.sha256(TASK.read_bytes()).hexdigest())
    task['ROOT'], task['REMOTE'], task['RUN'], task['R'] = ROOT, str(ROOT), str(runtime.parent.relative_to(ROOT)), directory
    def transport(code, timeout):
        if '--remote-parent' in code:
            return [sys.executable, '-c', 'import pathlib,time,json\np=pathlib.Path('+repr(str(directory/'stop'))+')\nwhile not p.exists():time.sleep(.005)\nprint(json.dumps(dict(stdout="normal completion",exitCode=0)))']
        return ast.literal_eval(ast.parse(code).body[1].value.args[0])
    caller = m.Caller(task, directory/'client', transport)
    launch_errors = []
    def launch():
        try: caller.launch()
        except BaseException as e: launch_errors.append(str(e))
    launcher = threading.Thread(target=launch)
    launcher.start()
    until(caller.session.started.is_set)
    consumer = None
    try:
        if bad_command:
            # The actual Node sender rejects a malformed command in production
            # validation. Its real nonzero wait closes the whole local session.
            (directory/'review').mkdir()
            (directory/'review/startup-capture.json').write_text(json.dumps(dict(label='startup',sha256='reviewed fixture')))
            try: caller.request(dict(command=dict(id='bad_sender', action='key', key='NOT_A_KEY', holdMs=50, waitMs=0, reviewRef='startup'), review='personally inspected fixture'))
            except m.TerminalFailure: pass
            else: raise AssertionError('failed sender accepted')
            assert caller.session.terminal
            assert not (runtime/'commands/0.json').exists()
        else:
            js="const fs=require('fs'),t=require('./tools/quake2-native-transport.cjs'),out=process.argv[1];(async()=>{while(!fs.existsSync(out+'/commands/0.json'))await new Promise(r=>setTimeout(r,5));await t.consume(out,0,async(c,mark)=>{mark();});})().catch(e=>{console.error(e);process.exitCode=1});"
            consumer = subprocess.Popen(['node','-e',js,str(runtime)], cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            caller.request(dict(command=dict(id='normal_capture',action='capture',label='capture',waitMs=0),review=None))
            out, err = consumer.communicate(timeout=3)
            assert consumer.returncode == 0, err
            assert json.loads((runtime/'reply-0.json').read_text())['ok']
            (directory/'stop').touch()
            launcher.join(3)
    finally:
        if consumer:
            if consumer.poll() is None: consumer.kill()
            consumer.communicate(timeout=3)
        receipts = caller.session.close()
        launcher.join(3)
    assert not launcher.is_alive()
    assert all(r['actualWait'] and r['stdoutEOF'] and r['stderrEOF'] for r in receipts)
    if bad_command: assert receipts[1]['status'] == 1
    else: assert receipts[0]['status'] == 0
    (directory/'result.json').write_text(json.dumps(dict(receipts=receipts,firstTerminal=caller.session.terminal)))
    print(directory.name, 'PASS actual caller, real Node sender, actual wait/separate EOF')

# Retained wrapper must actually wait a failing child and record both EOFs.
# This executes the real run-command.py without changing its retained bytes.
# Its R binding is compiled to a unique evidence directory before execution.
source = TASK.with_name('run-command.py').read_text()
tree = ast.parse(source)
for node in tree.body:
    if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'R' for t in node.targets):
        node.value = ast.Call(func=ast.Name(id='Path', ctx=ast.Load()), args=[ast.Constant(str(OUT))], keywords=[])
wrapper = OUT/'wrapper-input.py'
wrapper.write_text(ast.unparse(ast.fix_missing_locations(tree)))
p = subprocess.run([sys.executable, str(wrapper), 'actual-wrapper', sys.executable, '-c',
                    'import sys;print("out");print("err",file=sys.stderr);raise SystemExit(143)'], capture_output=True, timeout=3)
assert p.returncode == 143
import gzip
receipt = json.loads(gzip.decompress((OUT/'actual-wrapper-exit.json.gz').read_bytes()))
assert receipt['actualWait'] and receipt['stdoutEOF'] and receipt['stderrEOF'] and receipt['returnCode'] == 143
wrapper.unlink()  # Tiny transformed input is reproducible from the recorded caller SHA.
print('actual retained run-command wrapper PASS child143 actual wait and distinct stdout/stderr EOF')
