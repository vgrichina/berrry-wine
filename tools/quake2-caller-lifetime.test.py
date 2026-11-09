"""Offline production CLI + retained 0425 branches, real pipes and children.

The Boat executable is replaced with a local Python executor. Only the remote
startup barrier and the supervisor workload are fixture adapters; the CLI,
retained launch/request branches, revocation, parent and Node sender are real.
No browser, box, guest, media copy or network is used.
"""
import ast
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import selectors
import signal
import subprocess
import sys
import time
import types

ROOT = Path(__file__).resolve().parents[1]
SELF = Path(__file__).resolve()
TASK = ROOT/'scratch/runs/20261109-quake2-live-attack-combat-0425/control.py'
BASE = '6fe9107fbd7babb6e26c959cb32606b7c330d6e3'


def module(old=False):
    spec = importlib.util.spec_from_file_location('caller', ROOT/'tools/quake2-native-launch-client.py')
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    if old:
        base = os.environ['Q2_LIFETIME_BASE']
        exec(compile(subprocess.check_output(['git', 'show', base+':tools/quake2-native-launch-client.py'], cwd=ROOT),
                     str(ROOT/'tools/quake2-native-launch-client.py'), 'exec'), m.__dict__)
        shared = types.ModuleType('baseline_shared')
        shared.__file__ = str(ROOT/'tools/q3-native-launch-client.py')
        exec(compile(subprocess.check_output(['git', 'show', base+':tools/q3-native-launch-client.py'], cwd=ROOT),
                     shared.__file__, 'exec'), shared.__dict__)
        m.shared, m.Session, m.TerminalFailure = shared, shared.Session, shared.TerminalFailure
    return m


def until(check, seconds=4):
    end = time.monotonic()+seconds
    while not check():
        assert time.monotonic() < end, 'fixture deadline'
        time.sleep(.005)


def child(run):
    run = Path(run)
    signal.alarm(8)  # Failsafe for a broken fixture/controller, never game time.
    def stop(*_):
        (run/'workload-cancelled').touch()
        raise SystemExit(0)
    signal.signal(signal.SIGTERM, stop)
    (run/'workload-started').write_text(str(os.getpid()))
    while not (run/'allow-bootstrap').exists():
        time.sleep(.005)
    # An observable automatic setup effect, deliberately behind a startup gate.
    (run/'bootstrap').touch()
    while True:
        time.sleep(.005)


def parent(run):
    m = module()
    original = m.shared.Child
    def substitute(argv, *args):
        assert argv[1].endswith('/0105/launch.py') or argv[1].endswith('guard-route-0105/launch.py')
        return original([sys.executable, str(SELF), '--child', run], *args)
    m.shared.Child = substitute
    return m.remote_parent(run)


def boat(args):
    assert args[-3:-1] == ['python3', '-c']
    # This fixture's transport remains the actual parent of its local remote
    # interpreter through cancellation, so it can retain its wait separately.
    signal.signal(signal.SIGTERM, lambda *_: None)
    code = args[-1]
    if '--remote-parent' in code:
        tree = ast.parse(code)
        calls = [n for n in ast.walk(tree) if isinstance(n, ast.Call)
                 and ast.unparse(n.func) == 'subprocess.Popen']
        assert len(calls) == 1
        calls[0].args[0] = ast.parse(repr([sys.executable, str(SELF), '--parent'])+'+[r]', mode='eval').body
        # Only the barrier's require call is removed; the production branch
        # still calls and actually waits its adapted remote parent.
        tree.body = [n for n in tree.body if not (isinstance(n, ast.Expr)
            and isinstance(n.value, ast.Call) and ast.unparse(n.value.func) == "b['require']")]
        code = ast.unparse(ast.fix_missing_locations(tree))
    p = subprocess.run([sys.executable, '-c', code], capture_output=True, text=True, timeout=8)
    # Every interpreter actually waited its own request/parent subprocess.
    # Record the interpreter wait and both pipe EOFs, not inferred custody.
    run = Path(os.environ['Q2_FIXTURE_RUN'])
    (run/('executor-'+str(os.getpid())+'.json')).write_text(json.dumps(dict(
        status=p.returncode, actualWait=True, stdoutEOF=True, stderrEOF=True)))
    print(json.dumps(dict(stdout=p.stdout, stderr=p.stderr, exitCode=p.returncode)), flush=True)
    return 0


def harness(run):
    m = module(old=bool(os.environ.get('Q2_LIFETIME_BASE')))
    original = m.compose_task
    def compose(task, sha):
        result = original(task, sha)
        result.update(R=Path(run), REMOTE=str(ROOT), RUN=str(Path(run).relative_to(ROOT)))
        result['t'].box_id = lambda: 'OFFLINE-NO-BOX'
        return result
    m.compose_task = compose
    sys.argv = ['quake2-native-launch-client.py', '--task', str(TASK), '--task-sha256',
                hashlib.sha256(TASK.read_bytes()).hexdigest(), '--evidence', run+'/client']
    return m.main()


if len(sys.argv) > 1 and sys.argv[1].startswith('--'):
    mode, args = sys.argv[1], sys.argv[2:]
    if mode == '--child': child(*args)
    elif mode == '--parent': raise SystemExit(parent(*args))
    elif mode == '--boat': raise SystemExit(boat(args))
    elif mode == '--harness': raise SystemExit(harness(*args))
    raise SystemExit(0)


OUT = Path(sys.argv[1]).resolve()
OUT.mkdir(parents=True, exist_ok=True)
bin_dir = OUT/'bin'
bin_dir.mkdir()
shim = bin_dir/'boat'
shim.write_text('#!'+sys.executable+'\nimport os,sys\nos.execv(sys.executable,'+
                repr([sys.executable, str(SELF), '--boat'])+'+sys.argv[1:])\n')
shim.chmod(0o755)


def scenario(name):
    run = OUT/name
    run.mkdir()
    (run/'lifecycle.json').write_text(json.dumps(dict(browserDeadline=int((time.time()+8)*1000))))
    runtime = run/'original'
    (runtime/'commands').mkdir(parents=True)
    (runtime/'execution-window.json').write_text(json.dumps(dict(browserStop=
        time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(time.time()+180)))))
    p = subprocess.Popen([sys.executable, '-B', str(SELF), '--harness', str(run)],
        stdin=subprocess.DEVNULL if name == 'devnull-eof' else subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        env={**os.environ, 'PATH': str(bin_dir)+os.pathsep+os.environ['PATH'], 'Q2_FIXTURE_RUN': str(run)})
    output = bytearray()
    def line(expected):
        with selectors.DefaultSelector() as poll:
            poll.register(p.stdout, selectors.EVENT_READ)
            due = time.monotonic()+4
            while expected not in output:
                assert time.monotonic() < due, (name, bytes(output))
                if poll.select(.02):
                    b = os.read(p.stdout.fileno(), 65536)
                    assert b, (name, p.poll(), bytes(output))
                    output.extend(b)
    consumer = None
    try:
        line(b'OWNED_INPUT_READY')
        assert not (run/'workload-started').exists(), 'no launch before explicit input setup'
        if name not in ('immediate-eof', 'devnull-eof', 'missing-start'):
            p.stdin.write(b'{"start":true}\n'); p.stdin.flush()
            line(b'OWNED_LAUNCH_STARTED')
            until(lambda: (run/'workload-started').exists())
            if name == 'open-setup-command':
                assert p.poll() is None
                (run/'allow-bootstrap').touch()
                until(lambda: (run/'bootstrap').exists())
                # Actual production Node sender and numbered ACK consumer.
                js = "const fs=require('fs'),t=require('./tools/quake2-native-transport.cjs'),r=process.argv[1];(async()=>{while(!fs.existsSync(r+'/commands/0.json'))await new Promise(r=>setTimeout(r,5));await t.consume(r,0,async(c,mark)=>mark());})().catch(e=>{console.error(e);process.exitCode=1});"
                consumer = subprocess.Popen(['node', '-e', js, str(runtime)], cwd=ROOT,
                                            stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                p.stdin.write(b'{"command":{"id":"setup_capture","action":"capture","label":"setup","waitMs":0}}\n')
                p.stdin.flush()
                line(b'commandComplete')
                _, err = consumer.communicate(timeout=3)
                assert consumer.returncode == 0, err
                assert json.loads((runtime/'reply-0.json').read_text())['ok']
            elif name == 'eof-pending-command':
                p.stdin.write(b'{"command":{"id":"pending_capture","action":"capture","label":"pending","waitMs":0}}\n')
                p.stdin.flush()
                until(lambda: (runtime/'commands/0.json').exists())
        began = time.monotonic()
        if name == 'missing-start':
            p.stdin.write(b'{"command":{"action":"capture"}}\n');p.stdin.flush()
            until(lambda: (run/'client/first-terminal.json').exists())
        elif p.stdin:
            p.stdin.close(); p.stdin = None
        out, err = p.communicate(timeout=5)
        output.extend(out)
        assert p.returncode == 1, (output, err)
        terminal = json.loads((run/'client/first-terminal.json').read_text())
        assert terminal['reason'] == ('explicit start message required before launch' if name == 'missing-start' else 'caller stdin EOF'), terminal
        assert terminal['noReplay'] and terminal['remoteCustody'] == 'UNKNOWN'
        if name in ('immediate-eof', 'devnull-eof', 'missing-start'):
            assert not (run/'workload-started').exists()
            assert not list((run/'client').glob('*.wait.json'))
        else:
            until(lambda: (run/'caller-parent-wait.json').exists())
            remote = json.loads((run/'caller-parent-wait.json').read_text())
            assert remote['actualWait'] and remote['stdoutEOF'] and remote['stderrEOF'], remote
            assert (run/'workload-cancelled').exists()
            assert not Path('/proc', str(remote['pid'])).exists()
            if name != 'open-setup-command':
                (run/'allow-bootstrap').touch()  # A late readiness event cannot resume work.
                assert not (run/'bootstrap').exists()
            assert (run/'caller-cancelled.json').exists()
        cleanup = json.loads((run/'client/cleanup.json').read_text())
        assert cleanup['localComplete'], cleanup
        for receipt in cleanup['children']:
            assert receipt['actualWait'] and receipt['stdoutEOF'] and receipt['stderrEOF']
            assert not Path('/proc', str(receipt['pid'])).exists()
            assert (run/('executor-'+str(receipt['pid'])+'.json')).exists(), 'transport must actually wait remote interpreter'
        assert not (runtime/'commands/1.json').exists()
        if name == 'eof-pending-command':
            assert not (runtime/'reply-0.json').exists(), 'no invented ACK'
            fault = json.loads((runtime/'first-failure.json').read_text())
            assert fault['source'] == 'caller input revocation'
        assert not list(runtime.glob('*.png'))
        (run/'caller-stdout.log').write_bytes(output)
        (run/'caller-stderr.log').write_bytes(err)
        (run/'result.json').write_text(json.dumps(dict(status=p.returncode, actualWait=True,
            stdoutEOF=True, stderrEOF=True, elapsed=time.monotonic()-began, cleanup=cleanup)))
        print(name, 'PASS production CLI, actual0425 branches, real children/waits/separate EOF')
    finally:
        if p.poll() is None:
            p.kill()
            p.communicate(timeout=3)
        if consumer and consumer.poll() is None:
            consumer.kill(); consumer.communicate(timeout=3)


for name in ('immediate-eof', 'devnull-eof', 'missing-start', 'eof-during-startup', 'eof-pending-command', 'open-setup-command'):
    scenario(name)

# Execute the old production main from Git, without a source snapshot. The
# same real remote-parent/workload adapter demonstrates why killing the local
# transport alone cannot prevent automatic setup after stdin EOF.
run = OUT/'old-failure'
run.mkdir()
(run/'lifecycle.json').write_text(json.dumps(dict(browserDeadline=int((time.time()+8)*1000))))
base = BASE
p = subprocess.Popen([sys.executable, '-B', str(SELF), '--harness', str(run)],
    stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    env={**os.environ, 'PATH': str(bin_dir)+os.pathsep+os.environ['PATH'], 'Q2_LIFETIME_BASE': base, 'Q2_FIXTURE_RUN': str(run)})
try:
    until(lambda: (run/'workload-started').exists())
    p.stdin.close(); p.stdin = None
    until(lambda: (run/'client/first-terminal.json').exists())
    first = json.loads((run/'client/first-terminal.json').read_text())
    (run/'allow-bootstrap').touch()
    until(lambda: (run/'bootstrap').exists())
    assert not (run/'caller-cancelled.json').exists()
    module().cancel_remote(run)  # Test-owned rescue, never historical execution.
    stdout, stderr = p.communicate(timeout=5)
    until(lambda: (run/'caller-parent-wait.json').exists())
    (run/'result.json').write_text(json.dumps(dict(base=base, oldFAIL=True,
        reason=first['reason'], bootstrapAfterTerminal=True, actualWait=True,
        status=p.returncode, stdoutEOF=True, stderrEOF=True)))
    print('old production main FAIL as expected: automatic setup after caller EOF; new cases PASS')
finally:
    module().cancel_remote(run)
    if p.poll() is None:
        p.kill(); p.communicate(timeout=3)

# Cancellation preceding a late remote launch is sticky and prevents any spawn.
m = module()
run = OUT/'cancel-before-parent'
run.mkdir()
m.cancel_remote(run)
receipt = m.supervise_caller(run, [sys.executable, '-c', 'raise RuntimeError("must not spawn")'], time.time()+1)
assert receipt['prevented'] and receipt['children'] == []
(run/'original').mkdir()
first = '{"source":"earlier fixture fault"}'
(run/'original/first-failure.json').write_text(first)
m.cancel_remote(run)
assert (run/'original/first-failure.json').read_text() == first
print('cancel-before-parent PASS no spawn after remote revocation')
