#!/usr/bin/env python3
"""Exercise the GL parent-process guard through the existing real OS controls."""
import importlib.util
import pathlib
import sys
import ctypes
import json
import os
import subprocess
import threading
import time

ROOT = pathlib.Path(__file__).resolve().parent.parent


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


guard = load('gl_parent', ROOT / 'tools/gltron-current-supervise.py')
fixtures = load('os_fixtures', ROOT / 'test/test-boids-supervisor-shutdown.py')
guard.BASE.Supervisor = guard.ParentProcessSupervisor
fixtures.module = lambda: guard.BASE
fixtures.__file__ = __file__


def wait_file(path, child=None):
    end = time.monotonic() + 8
    while not path.exists():
        assert time.monotonic() < end and (child is None or child.poll() is None), str(path)
        time.sleep(.005)


def parent_controls(run):
    run.mkdir(parents=True, exist_ok=False)
    assert ctypes.CDLL(None).prctl(36, 1, 0, 0, 0) == 0  # reap only our adopted children
    results = []
    for repaired in (False, True):
        out = run / ('repaired' if repaired else 'before')
        ready = out.with_name(out.name + '-parent-process-armed.json')
        acquired = []
        def spawn():
            def pdeath():
                assert ctypes.CDLL(None).prctl(1, 15, 0, 0, 0) == 0
            p = subprocess.Popen([sys.executable, '-B', __file__, '--thread-child', str(out), str(int(repaired))],
                                 preexec_fn=pdeath, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            acquired.append(p)
            wait_file(ready, p)
            # Returning retires the actual Linux thread that forked this child.
        t = threading.Thread(target=spawn)
        t.start()
        t.join(timeout=10)
        assert not t.is_alive() and acquired
        p = acquired[0]
        if repaired:
            wait_file(out / 'runtime-start.json', p)
            (out / 'fixture-finish').touch()
        a, b = p.communicate(timeout=10)
        assert p.returncode == (0 if repaired else -15), (repaired, p.returncode, b)
        if repaired:
            owner = json.loads((out / 'parent-process-owner.json').read_text())
            assert owner['inheritedPdeathsig'] == 15 and owner['parentProcessAliveAtJoin']
            assert owner['spawningThreadsAliveAtJoin'] and not any(owner['spawningThreadsAliveAtJoin'].values())
            receipt = json.loads((out / 'wait.json').read_text())
            assert receipt['returncode'] == 0 and receipt['actualWait'] and receipt['stdoutEOF'] and receipt['stderrEOF']
        results.append(dict(repaired=repaired, returncode=p.returncode, actualWait=True, stdoutEOF=True, stderrEOF=True))
    out = run / 'process-death'
    parent = subprocess.Popen([sys.executable, '-B', __file__, '--owner-parent', str(out)],
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    a, b = parent.communicate(timeout=10)
    assert parent.returncode == 0, b
    child = json.loads(out.with_name(out.name + '-child.json').read_text())['pid']
    waited, status = os.waitpid(child, 0)
    assert waited == child and os.waitstatus_to_exitcode(status) == 143
    owner = json.loads((out / 'parent-process-owner.json').read_text())
    receipt = json.loads((out / 'wait.json').read_text())
    assert owner['parentDeathObserved'] and not owner['parentProcessAliveAtJoin']
    assert receipt['supervisorExitCode'] == 143 and receipt['actualWait']
    assert receipt['stdoutEOF'] and receipt['stderrEOF'] and not receipt['remainingAfterRuntime']
    results.append(dict(case='actual parent process death', returncode=143, actualWait=True,
                        stdoutEOF=True, stderrEOF=True, parentActualWait=parent.returncode))
    guard.BASE.write(run / 'results.json', results)
    print('PASS actual spawning thread retirement: before SIGTERM, repaired normal wait+EOF', flush=True)


if __name__ == '__main__':
    if sys.argv[1] == '--parent-controls':
        parent_controls(pathlib.Path(sys.argv[2]).resolve())
    elif sys.argv[1] == '--owner-parent':
        out = pathlib.Path(sys.argv[2])
        def pdeath():
            assert ctypes.CDLL(None).prctl(1, 15, 0, 0, 0) == 0
        p = subprocess.Popen([sys.executable, '-B', __file__, '--thread-child', str(out), '1'], preexec_fn=pdeath)
        wait_file(out / 'runtime-start.json', p)
        guard.BASE.write(out.with_name(out.name + '-child.json'), dict(pid=p.pid))
        os._exit(0)
    elif sys.argv[1] == '--thread-child':
        out, repaired = pathlib.Path(sys.argv[2]), int(sys.argv[3])
        if repaired:
            command = [sys.executable, '-B', __file__, '--held-fixture', str(out)]
            sys.exit(guard.ParentProcessSupervisor(out, command, preparation=3, runtime=4,
                       preparation_watchdog=5, runtime_watchdog=6, grace=.3).run())
        else:
            guard.BASE.write(out.with_name(out.name + '-parent-process-armed.json'), dict(pid=os.getpid()))
            time.sleep(10)
    elif sys.argv[1] == '--held-fixture':
        out = pathlib.Path(sys.argv[2])
        guard.BASE.write(out / 'prepared.json', dict(pid=os.getpid()))
        wait_file(out / 'fixture-finish')
    elif sys.argv[1] == '--native':
        fixtures.native(sys.argv[2], pathlib.Path(sys.argv[3]))
    elif sys.argv[1] == '--child':
        fixtures.child(sys.argv[2], pathlib.Path(sys.argv[3]))
    elif sys.argv[1] == '--descendant':
        import signal
        import time
        signal.signal(signal.SIGTERM, signal.SIG_IGN)
        time.sleep(30)
    else:
        fixtures.main(pathlib.Path(sys.argv[1]).resolve())
