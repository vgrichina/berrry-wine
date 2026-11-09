"""Offline real pipe failures through the actual retained launch/command caller."""
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
TASK = ROOT/'scratch/runs/20261109-q3-concurrent-owner-gameplay-0052/task.py'
spec = importlib.util.spec_from_file_location('owned_q3', ROOT/'tools/q3-native-launch-client.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
OUT = Path(sys.argv[1]).resolve()
OUT.mkdir(parents=True, exist_ok=True)
try:
    m.compose_task(TASK, '0'*64)
except ValueError as error:
    assert str(error) == 'retained task SHA mismatch'
else:
    raise AssertionError('stale task source accepted')


def until(check, timeout=3):
    end = time.monotonic()+timeout
    while not check():
        assert time.monotonic() < end, 'fixture deadline'
        time.sleep(.005)


def scenario(name, failure, pending):
    directory = OUT/name
    directory.mkdir()
    runtime = directory/'runtime'
    (runtime/'commands').mkdir(parents=True)
    (runtime/'execution-window.json').write_text(json.dumps(dict(
        browserStop=time.strftime('%Y-%m-%dT%H:%M:%S', time.gmtime(time.time()+180))+'Z')))
    task = m.compose_task(TASK, hashlib.sha256(TASK.read_bytes()).hexdigest())
    task['REMOTE'] = str(ROOT)
    task['OUT'] = str(runtime)
    requests = []
    task['save'] = lambda name, value: (directory/(name+'.json')).write_text(json.dumps(value))
    def transport(code, timeout):
        if 'PRELAUNCH_ACTUAL_WAIT' in code:
            assert 'tools/q3-native-prelaunch.py' in code
            # Real owned launch process, open stdout/stderr, until commanded to exit.
            return [sys.executable, '-c', 'import signal,time,pathlib,os\n'
                    'signal.signal(signal.SIGPIPE,signal.SIG_DFL)\n'
                    'p=pathlib.Path('+repr(str(directory/'exit'))+')\n'
                    'while not p.exists(): time.sleep(.005)\n'
                    + ('os.kill(os.getpid(),signal.SIGPIPE)' if failure == 'SIGPIPE' else 'raise SystemExit('+str(failure)+')')]
        # Execute the real retained command sender's Node argv. Only the Boat/
        # remote Python subprocess.run shell is removed, avoiding a test orphan.
        tree = ast.parse(code)
        call = tree.body[1].value
        assert isinstance(call, ast.Call) and ast.unparse(call.func) == 'subprocess.run'
        argv = ast.literal_eval(call.args[0])
        assert argv[:2] == ['node', '-e'] and 't.request(out,c.id,c,55000)' in argv[2]
        requests.append(code)
        return argv
    session = m.Session(directory/'session', transport)
    task['remote'] = task['c'].remote = session.remote
    launch_errors = []
    def launch():
        try: task['owned_launch'](['task.py', 'launch'])
        except BaseException as error: launch_errors.append(str(error))
    launcher = threading.Thread(target=launch)
    launcher.start()
    until(lambda: session.started.is_set())
    errors = []
    def command(identifier):
        # Same guard as the production session, before running the real branch.
        session.check()
        return task['owned_command'](['task.py', 'command', json.dumps(dict(
            id=identifier, action='key', key='ArrowDown', holdMs=100, waitMs=0, label=identifier)), None])
    def first():
        try: command('pending_down')
        except BaseException as error: errors.append(str(error))
    worker = None
    try:
        if pending:
            worker = threading.Thread(target=first)
            worker.start()
            until(lambda: (runtime/'commands/0.json').exists())
            assert len(requests) == 1
        began = time.monotonic()
        (directory/'exit').touch()
        until(lambda: session.terminal is not None)
        first_failure = dict(session.terminal)
        if worker:
            worker.join(2)
            assert not worker.is_alive() and errors
        elapsed = time.monotonic()-began
        assert time.monotonic()-began < 1, 'pending must settle promptly, not at 55s ACK cap'
        for later in ('later_down', 'later_capture'):
            try: command(later)
            except m.TerminalFailure: pass
            else: raise AssertionError('later command accepted')
        until(lambda: (session.evidence/'cleanup.json').exists())
        assert session.terminal == first_failure
        assert len(requests) == (1 if pending else 0)
        assert not (runtime/'commands/1.json').exists()
        assert not (runtime/'reply-0.json').exists(), 'no fabricated ACK'
        assert not (directory/'requested-later_down.json').exists()
    finally:
        receipts = session.close()
        launcher.join(3)
        if worker: worker.join(3)
    assert not launcher.is_alive()
    assert all(r['actualWait'] and r['stdioEOF'] for r in receipts)
    assert receipts[0]['status'] == (-signal.SIGPIPE if failure == 'SIGPIPE' else failure)
    assert all(not Path('/proc', str(r['pid'])).exists() for r in receipts)
    (directory/'result.json').write_text(json.dumps(dict(elapsedSeconds=elapsed,requests=len(requests),firstFailure=first_failure,receipts=receipts)))
    print(name, 'PASS real composed caller; actual wait/EOF; no later request')


for failure in ('SIGPIPE', 7, 0):
    for pending in (True, False):
        scenario(str(failure)+('-pending' if pending else '-before-next'), failure, pending)

# Normal transport flow uses the actual sender and actual numbered ACK consumer.
directory = OUT/'success'
directory.mkdir()
task = m.compose_task(TASK, hashlib.sha256(TASK.read_bytes()).hexdigest())
runtime = directory/'runtime'
(runtime/'commands').mkdir(parents=True)
(runtime/'execution-window.json').write_text(json.dumps(dict(
    browserStop=time.strftime('%Y-%m-%dT%H:%M:%S', time.gmtime(time.time()+180))+'Z')))
task['REMOTE'], task['OUT'] = str(ROOT), str(runtime)
task['save'] = lambda name, value: None
stop = directory/'exit'
def transport(code, timeout):
    if 'PRELAUNCH_ACTUAL_WAIT' in code:
        return [sys.executable, '-c', 'import pathlib,time,json\np=pathlib.Path('+repr(str(stop))+')\nwhile not p.exists():time.sleep(.005)\nprint(json.dumps(dict(stdout="normal completion",exitCode=0)))']
    return ast.literal_eval(ast.parse(code).body[1].value.args[0])
session = m.Session(directory/'session', transport)
task['remote'] = task['c'].remote = session.remote
launch_results = []
def successful_launch():
    try: task['owned_launch'](['task.py','launch'])
    except m.TerminalFailure as error: launch_results.append(str(error))
launcher = threading.Thread(target=successful_launch)
launcher.start()
until(session.started.is_set)
# Actual transport.consume writes the ACK; fixture execute marks ordinary dispatch.
consumer = subprocess.Popen(['node', '-e', "const t=require('./scratch/runs/20261108-q3-gl-readiness-gameplay/transport.cjs');const fs=require('fs');const out=process.argv[1];(async()=>{for(let n=0;n<2;n++){while(!fs.existsSync(out+'/commands/'+n+'.json'))await new Promise(r=>setTimeout(r,5));await t.consume(out,n,async(c,mark)=>{mark();fs.appendFileSync(out+'/down',c.key+'\\n')});}})().catch(e=>{console.error(e);process.exitCode=1})",str(runtime)],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
try:
    for identifier in ('first','second'):
        session.check()
        task['owned_command'](['task.py','command',json.dumps(dict(id=identifier,action='key',key='ArrowDown',holdMs=100,waitMs=0,label=identifier)),None])
    stdout, stderr = consumer.communicate(timeout=3)
    assert consumer.returncode == 0, stderr
    assert (runtime/'down').read_text() == 'ArrowDown\nArrowDown\n'
    stop.touch()
    launcher.join(3)
finally:
    if consumer.poll() is None: consumer.kill()
    consumer.communicate(timeout=3)
    receipts = session.close()
    launcher.join(3)
assert not launcher.is_alive() and len(launch_results) == 1
assert session.terminal, 'even successful transport exit closes admission before caller continuation'
assert all(r['actualWait'] and r['stdioEOF'] for r in receipts)
assert all(json.loads((runtime/f'reply-{n}.json').read_text())['ok'] for n in (0,1))
print('success PASS two real numbered requests/ACKs; launch actual wait0 EOF; all children awaited')

# EOF is independently observable even before the actual child wait completes.
# The command is still the real retained request sender; only launch is a pipe
# fixture. No helper descendant can be orphaned by this case.
directory = OUT/'early-eof'
directory.mkdir()
trigger = directory/'eof'
def early_eof_transport(code, timeout):
    return [sys.executable, '-c', 'import pathlib,time,os\np=pathlib.Path('+repr(str(trigger))+')\nwhile not p.exists():time.sleep(.005)\nos.close(1);os.close(2);time.sleep(1)']
session = m.Session(directory/'session', early_eof_transport)
errors = []
def launch_eof():
    try: session.remote('sole-original-launch', 'fixture', 2)
    except m.TerminalFailure as error: errors.append(str(error))
launcher = threading.Thread(target=launch_eof)
launcher.start()
until(session.started.is_set)
trigger.touch()
until(lambda: session.terminal is not None)
assert 'EOF' in session.terminal['reason']
assert session.launch.process.poll() is None, 'EOF did not fabricate a child wait'
try: session.remote('later_down', 'must not spawn', 2)
except m.TerminalFailure: pass
else: raise AssertionError('EOF allowed later command')
receipts = session.close()
launcher.join(3)
assert not launcher.is_alive() and len(receipts) == 1
assert receipts[0]['actualWait'] and receipts[0]['stdioEOF']
print('early EOF PASS admission closed before exit; actual child awaited at cleanup')

# A separate, explicitly test-owned child holds launch stdout after SIGPIPE.
# Exit must close admission immediately; the short local cleanup cap must keep
# missing EOF false. The test parent later waits the writer, without upgrading
# the failed cleanup receipt.
directory = OUT/'held-pipe'
directory.mkdir()
trigger = directory/'exit'
def held_transport(code, timeout):
    return [sys.executable, '-c', 'import signal,time,pathlib,os\nsignal.signal(signal.SIGPIPE,signal.SIG_DFL)\np=pathlib.Path('+repr(str(trigger))+')\nwhile not p.exists():time.sleep(.005)\nos.kill(os.getpid(),signal.SIGPIPE)']
session = m.Session(directory/'session', held_transport, cleanup_seconds=.1)
errors = []
def launch_held():
    try: session.remote('sole-original-launch', 'fixture', 2)
    except m.TerminalFailure as error: errors.append(str(error))
launcher = threading.Thread(target=launch_held)
launcher.start()
until(session.started.is_set)
fd = os.open('/proc/'+str(session.launch.process.pid)+'/fd/1', os.O_WRONLY)
try:
    writer = subprocess.Popen([sys.executable,'-c','import time;time.sleep(.5);print("late pipe output")'], stdout=fd, stderr=subprocess.PIPE)
finally:
    os.close(fd)
try:
    trigger.touch()
    until(lambda: session.terminal is not None)
    assert writer.poll() is None
    assert session.launch.process.poll() == -signal.SIGPIPE
    try: session.remote('later_down', 'must not spawn', 2)
    except m.TerminalFailure: pass
    else: raise AssertionError('exit before EOF allowed request')
    began = time.monotonic()
    receipts = session.close()
    assert time.monotonic()-began < .4
    assert receipts[0]['actualWait'] and not receipts[0]['stdioEOF']
    assert not json.loads((session.evidence/'cleanup.json').read_text())['localComplete']
finally:
    stdout, stderr = writer.communicate(timeout=3)
    launcher.join(3)
assert not launcher.is_alive()
(directory/'writer-wait.json').write_text(json.dumps(dict(pid=writer.pid,status=writer.returncode,actualWait=True,stdioEOF=True)))
assert not Path('/proc',str(writer.pid)).exists()
assert not json.loads((session.evidence/'cleanup.json').read_text())['localComplete']
print('held pipe PASS SIGPIPE observed before EOF; bounded cleanup incomplete; writer actually awaited')
