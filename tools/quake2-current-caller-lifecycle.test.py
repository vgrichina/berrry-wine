"""Full current Q2 caller/preflight integration without Chrome or Boat.

The local Boat adapter executes the actual retained launch branch and barrier.
Q2_CURRENT_LIFECYCLE_KERNEL=1 retains the actual kernel supervisor; otherwise
that boundary is an explicit waited Node seam. Pins come from production prepare
unchanged, with no provider refreshes. EOF and terminal semantics remain real.
"""
import gzip
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import selectors
import subprocess
import sys
import threading
import time

ROOT = Path(__file__).resolve().parents[1]
SELF = Path(__file__).resolve()
TASK = ROOT/'scratch/runs/20261109-quake2-current-policy-guard-door-1645/control.py'


def caller():
    spec = importlib.util.spec_from_file_location('current_caller', ROOT/'tools/quake2-native-launch-client.py')
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def parent(run):
    m = caller()
    original = m.supervise_caller
    def supervise(directory, command, deadline):
        argv = json.loads(command[-1])
        assert argv[1:3] == ['--require', str(ROOT/'tools/quake2-current-browser-policy.cjs')]
        assert os.environ['QUAKE2_CURRENT_BROWSER_COMPOSITION'] == '1'
        assert os.environ.get('QUAKE2_NATIVE_COMPOSITION') != '1'
        if os.environ.get('Q2_CURRENT_LIFECYCLE_KERNEL') == '1':
            return original(directory, command, deadline)
        # The production launch.py supervisor supplies these two variables.
        # Preserve that setup when replacing its kernel boundary in this test.
        env = {**os.environ, 'BROWSER_DEADLINE': str(json.loads((directory/'lifecycle.json').read_text())['browserDeadline']),
               'RENDER_BACKEND': 'webgl'}
        p = subprocess.Popen(argv, cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        out, err = p.communicate(timeout=15)
        for name, data in [('stdout', out), ('stderr', err)]:
            (directory/('preflight-node.'+name)).write_bytes(data)
        receipt = dict(pid=p.pid, status=p.returncode, actualWait=True,
                       stdoutEOF=True, stderrEOF=True, stdioEOF=True, kernelCustody='NOT_TESTED')
        (directory/'caller-parent-wait.json').write_text(json.dumps(receipt))
        return receipt
    m.supervise_caller = supervise
    return m.remote_parent(run)


def boat(args):
    assert args[-3:-1] == ['python3', '-c']
    code = args[-1]
    # Preserve the actual remote-parent selection; replace only its executable
    # boundary so that the explicit test-only supervisor seam is local.
    before = '["python3",root+"/tools/quake2-native-launch-client.py","--remote-parent",r]'
    if '--remote-parent' in code:
        assert code.count(before) == 1
        code = code.replace(before, repr([sys.executable, str(SELF), '--parent'])+'+[r]')
    p = subprocess.Popen([sys.executable, '-c', code], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    out, err = p.communicate(timeout=25)
    run = Path(os.environ['Q2_CURRENT_LIFECYCLE_RUN'])
    (run/('executor-'+str(os.getpid())+'.json')).write_text(json.dumps(dict(
        child=p.pid, status=p.returncode, actualWait=True, stdoutEOF=True, stderrEOF=True)))
    print(json.dumps(dict(stdout=out.decode(), stderr=err.decode(), exitCode=p.returncode)), flush=True)
    return 0


def harness(run):
    m = caller()
    original = m.compose_task
    def compose(task, sha):
        result = original(task, sha)
        result.update(R=Path(run), ROOT=ROOT, REMOTE=str(ROOT), RUN=str(Path(run).relative_to(ROOT)))
        result['t'].box_id = lambda: 'OFFLINE-NO-BOX'
        return result
    m.compose_task = compose
    sys.argv = [str(ROOT/'tools/quake2-native-launch-client.py'), '--task', str(TASK),
                '--task-sha256', hashlib.sha256(TASK.read_bytes()).hexdigest(), '--evidence', run+'/client']
    return m.main()


def test(run, pins):
    run.mkdir(parents=True, exist_ok=False)
    raw = pins.read_bytes()
    (run/'runtime-pins.json').write_bytes(raw)
    (run/'lifecycle.json').write_text(json.dumps(dict(browserDeadline=int((time.time()+60)*1000))))
    spec = importlib.util.spec_from_file_location('barrier', ROOT/'tools/native-startup-barrier.py')
    barrier = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(barrier)
    barrier.publish(ROOT, run/'runtime-pins.json', run/'remote-barrier.json')
    bin_dir = run/'bin'
    bin_dir.mkdir()
    shim = bin_dir/'boat'
    shim.write_text('#!'+sys.executable+'\nimport os,sys\nos.execv(sys.executable,'+
                    repr([sys.executable, str(SELF), '--boat'])+'+sys.argv[1:])\n')
    shim.chmod(0o755)
    git = bin_dir/'git'
    git.write_text('#!'+sys.executable+'\nimport os\nfrom pathlib import Path\n'
                   'Path(os.environ["Q2_CURRENT_LIFECYCLE_RUN"],"forbidden-git").touch()\n'
                   'raise SystemExit(74)\n')
    git.chmod(0o755)
    env = {**os.environ, 'PATH': str(bin_dir)+os.pathsep+os.environ['PATH'],
           'Q2_CURRENT_LIFECYCLE_RUN': str(run), 'Q2_PHASE': 'fixture', 'DRIVER_PREFLIGHT': '1'}
    p = subprocess.Popen([sys.executable, '-B', str(SELF), '--harness', str(run)],
                         stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)
    output = bytearray()
    try:
        with selectors.DefaultSelector() as poll:
            poll.register(p.stdout, selectors.EVENT_READ)
            due = time.monotonic()+5
            while b'OWNED_INPUT_READY' not in output:
                assert time.monotonic() < due, bytes(output)
                if poll.select(.02):
                    b = os.read(p.stdout.fileno(), 65536)
                    assert b, bytes(output)
                    output.extend(b)
        assert not (run/'caller-parent-wait.json').exists()
        p.stdin.write(b'{"start":true}\n')
        p.stdin.flush()
        # Keep stdin open while the real launch exits at preflight. An exit
        # without a quit ACK must terminate the owning caller, even status 0.
        streams = {}
        def drain(name, stream):
            streams[name] = stream.read()
        readers = [threading.Thread(target=drain, args=(name, stream))
                   for name, stream in [('stdout', p.stdout), ('stderr', p.stderr)]]
        for reader in readers: reader.start()
        p.wait(timeout=30)
        p.stdin.close()
        for reader in readers:
            reader.join(timeout=5)
            assert not reader.is_alive()
        output.extend(streams['stdout'])
        stderr = streams['stderr']
        (run/'caller.stdout').write_bytes(output)
        (run/'caller.stderr').write_bytes(stderr)
        assert p.returncode == 1, (output, stderr)
        kernel_mode = os.environ.get('Q2_CURRENT_LIFECYCLE_KERNEL') == '1'
        if kernel_mode:
            preflight = json.loads(gzip.decompress((run/'kernel-command.log.gz').read_bytes()))
            kernel = json.loads((run/'kernel-drain.json').read_text())
            assert kernel['complete'] and len(kernel['owned']) == len(kernel['reaped'])
            assert not any(kernel[k] for k in ['remaining', 'unreaped', 'unresolvedPtrace', 'unresolvedLineage', 'unresolvedResumes'])
            assert json.loads((run/'supervisor-terminal.json').read_text())['lockReleased']
        else:
            preflight = json.loads((run/'preflight-node.stdout').read_text())
        assert preflight['passed'] and not preflight['chromiumStarted'] and not preflight['originalStarted']
        observed = json.loads((run/'observed-composition.json').read_text())
        assert all(observed[k] for k in ['fixture', 'wire', 'health', 'preflight'])
        assert observed['flags']['QUAKE2_NATIVE_WRITER_WITNESS'] == '1'
        terminal = json.loads((run/'client/first-terminal.json').read_text())
        assert terminal['noReplay']
        assert terminal['reason'].startswith('owned launch transport'), terminal
        cleanup = json.loads((run/'client/cleanup.json').read_text())
        assert cleanup['localComplete']
        assert cleanup['children']
        for receipt in cleanup['children']:
            assert receipt['actualWait'] and receipt['stdoutEOF'] and receipt['stderrEOF']
            assert not Path('/proc', str(receipt['pid'])).exists()
            assert (run/('executor-'+str(receipt['pid'])+'.json')).exists()
        node = json.loads((run/'caller-parent-wait.json').read_text())
        generated = json.loads((run/'generated-parent-actual-wait.json').read_text())
        for receipt in [node, generated]:
            assert receipt['actualWait'] and receipt['stdoutEOF'] and receipt['stderrEOF']
            assert receipt['status'] == 0 and not Path('/proc', str(receipt['pid'])).exists()
        assert not list(run.glob('original/commands/*.json'))
        assert not list(run.rglob('*.png'))
        assert not (run/'forbidden-git').exists(), 'staged runtime must not use Git'
        assert (run/'runtime-pins.json').read_bytes() == raw
        result = dict(passed=True, actualProductionCLI=True, actualRetainedLaunch=True,
                      actualBarrier=True, actualRemoteParent=True, currentPolicyFixturePreflight=True,
                      pinsUnchanged=True, runtimeGitForbidden=True, outerActualWait=True, separateEOF=True,
                      terminal=terminal, actualKernelDrain=kernel_mode, nativeCustody='NOT_TESTED', chromeStarted=False,
                      nativeQualification=False)
        (run/'result.json').write_text(json.dumps(result, indent=2))
        print(json.dumps(result))
    finally:
        if p.poll() is None:
            p.terminate()
            p.communicate(timeout=5)


if __name__ == '__main__':
    if sys.argv[1] == '--parent': raise SystemExit(parent(sys.argv[2]))
    if sys.argv[1] == '--boat': raise SystemExit(boat(sys.argv[2:]))
    if sys.argv[1] == '--harness': raise SystemExit(harness(sys.argv[2]))
    test(Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve())
