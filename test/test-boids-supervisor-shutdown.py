#!/usr/bin/env python3
"""Real OS child/watchdog/descendant/outer waits; no original game launch."""
import importlib.util, json, os, pathlib, signal, subprocess, sys, time
ROOT = pathlib.Path(__file__).resolve().parent.parent


def module():
    spec = importlib.util.spec_from_file_location('boids', ROOT/'tools/boids-current-supervise.py')
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def native(mode, out):
    m = module()
    if mode == 'exit143':
        sys.exit(143)
    if mode == 'native-signal':
        os.kill(os.getpid(), signal.SIGTERM)
    if mode == 'noisy':
        for _ in range(32):
            os.write(1, b'O'*65536)
            os.write(2, b'E'*65536)
    if mode == 'prep-timeout':
        time.sleep(30)
    if mode in ('descendant', 'repeat', 'watchdog', 'cleanup-deadline'):
        p = subprocess.Popen([sys.executable, '-B', __file__, '--descendant', str(out)])
        m.write(out/'descendant.json', dict(pid=p.pid))
    if mode == 'foreign-pipe':
        # It deliberately has no ownership token. Cleanup must wait for EOF,
        # rather than signal this process based on its group or pipe handles.
        p = subprocess.Popen([sys.executable, '-c', 'import time;time.sleep(.8);print("foreign holder completed",flush=True)'], env={})
        m.write(out/'foreign-holder.json', dict(pid=p.pid))
    if mode in ('watchdog', 'cleanup-deadline', 'repeat'):
        signal.signal(signal.SIGTERM, signal.SIG_IGN)
    if mode == 'late':
        def late(s, f):
            signal.signal(signal.SIGTERM, signal.SIG_IGN)
            time.sleep(.2)
            sys.exit(23)
        signal.signal(signal.SIGTERM, late)
    m.write(out/'prepared.json', dict(pid=os.getpid()))
    while not (out/'runtime-start.json').exists():
        time.sleep(.01)
    if mode in ('normal', 'noisy', 'descendant', 'foreign-pipe', 'missing-eof'):
        sys.exit(0)
    time.sleep(30)


def child(mode, out):
    m = module()
    s = m.Supervisor(out, [sys.executable, '-B', __file__, '--native', mode, str(out)],
                     preparation=2, runtime=.25 if mode in ('timeout', 'late', 'cleanup-deadline') else 4,
                     preparation_watchdog=4, runtime_watchdog=.55 if mode in ('watchdog', 'cleanup-deadline', 'missing-eof') else 6,
                     grace=1 if mode == 'cleanup-deadline' else .35)
    if mode in ('prearm-failure', 'runtime-prearm-failure'):
        spawn = s.spawn
        def fail(command, prefix, env):
            if prefix.startswith('preparation' if mode == 'prearm-failure' else 'runtime'):
                command = [sys.executable, '-c', 'import sys;sys.exit(19)']
            return spawn(command, prefix, env)
        s.spawn = fail
    if mode == 'exception':
        arm = s.arm
        def fault():
            if s.phase == 'runtime':
                raise RuntimeError('injected after native acquired')
            return arm()
        s.arm = fault
    if mode in ('pending-startup', 'watchdog-startup'):
        popen = m.subprocess.Popen
        def pending(*a, **kw):
            p = popen(*a, **kw)
            if ('--native' in a[0] if mode == 'pending-startup' else 'watchdog' in a[0]):
                os.kill(os.getpid(), signal.SIGTERM)
                time.sleep(.05)
            return p
        m.subprocess.Popen = pending
    if mode == 'native-spawn-failure':
        s.command = ['/nonexistent/boids-fixture-executable']
    if mode == 'capture-open-failure':
        spawn = s.spawn
        def capture_fault(command, prefix, env):
            if prefix == '':
                (out/'stdout.log').mkdir()
            return spawn(command, prefix, env)
        s.spawn = capture_fault
    if mode == 'missing-eof':
        pump = m.Capture.pump
        def lose_eof(c):
            pump(c)
            if c.process is s.native:
                c.eof['stderr'] = False
                c.eof_at.pop('stderr', None)
        m.Capture.pump = lose_eof
    sys.exit(s.run())


def wait_file(path, process, seconds=6):
    end = time.monotonic()+seconds
    while not path.exists():
        assert process.poll() is None and time.monotonic() < end, (str(path), process.poll())
        time.sleep(.01)


def main(run):
    run.mkdir(parents=True, exist_ok=False)
    m = module()
    # A sibling shares our group and an almost matching env token: never signal it.
    token = os.urandom(32).hex()
    sibling = subprocess.Popen([sys.executable, '-c', 'import time;time.sleep(60)'],
                               env=dict(os.environ, BOIDS_CURRENT_TOKEN=token+'suffix'))
    pinned = subprocess.Popen([sys.executable, '-c', 'import time;time.sleep(60)'],
                              env=dict(os.environ, BOIDS_CURRENT_TOKEN=token))
    results = []
    try:
        assert not m.signal_owned(os.getpid(), token, signal.SIGKILL)
        assert not m.signal_owned(sibling.pid, token, signal.SIGKILL)
        assert not m.signal_owned(pinned.pid, token, signal.SIGKILL, 'stale-start-token')
        assert [r['pid'] for r in m.scoped(token)] == [pinned.pid]
        real_identity = m.identity
        calls = []
        def changed(pid):
            start, state = real_identity(pid)
            calls.append(pid)
            return (start if len(calls) == 1 else start+'changed'), state
        m.identity = changed
        assert not m.signal_owned(pinned.pid, token, signal.SIGKILL)
        m.identity = real_identity
        assert sibling.poll() is None and pinned.poll() is None
        assert m.signal_owned(pinned.pid, token, signal.SIGTERM, m.identity(pinned.pid)[0])
        assert pinned.wait(timeout=3) == -15
        assert not m.signal_owned(pinned.pid, token, signal.SIGKILL)
        modes = ('normal', 'noisy', 'exit143', 'native-signal', 'descendant', 'foreign-pipe', 'term', 'repeat',
                 'pending-startup', 'watchdog-startup', 'exception', 'prep-timeout', 'timeout', 'late',
                 'prearm-failure', 'runtime-prearm-failure', 'native-spawn-failure', 'capture-open-failure', 'watchdog', 'cleanup-deadline', 'missing-eof')
        for mode in modes:
            out = run/mode
            p = subprocess.Popen([sys.executable, '-B', __file__, '--child', mode, str(out)],
                                 stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            if mode in ('term', 'repeat', 'watchdog'):
                wait_file(out/'runtime-start.json', p)
                if mode == 'watchdog':
                    os.kill(p.pid, signal.SIGSTOP)
                    time.sleep(1.2)
                    os.kill(p.pid, signal.SIGCONT)
                else:
                    os.kill(p.pid, signal.SIGTERM)
                    if mode == 'repeat':
                        for _ in range(8):
                            time.sleep(.02)
                            os.kill(p.pid, signal.SIGTERM)
            a, b = p.communicate(timeout=12)
            (out/'outer.stdout.log').write_bytes(a)
            (out/'outer.stderr.log').write_bytes(b)
            receipt = json.loads((out/'wait.json').read_text())
            expected = (143 if mode in ('exit143', 'native-signal', 'term', 'repeat', 'pending-startup', 'watchdog-startup') else
                        1 if mode in ('exception', 'prearm-failure', 'runtime-prearm-failure', 'native-spawn-failure', 'capture-open-failure', 'missing-eof') else
                        124 if mode in ('prep-timeout', 'timeout', 'late', 'cleanup-deadline') else
                        137 if mode == 'watchdog' else 0)
            assert p.returncode == expected == receipt['supervisorExitCode'], (mode, p.returncode, receipt, b.decode())
            assert receipt['cleanupCount'] == 1 and not receipt['remainingAfterRuntime']
            if mode == 'missing-eof':
                assert receipt['actualWait'] and receipt['returncode'] == 0
                assert receipt['stdoutEOF'] and not receipt['stderrEOF'] and receipt['error']
                assert not (out/'runtime-watchdog-cancel').exists()
                assert json.loads((out/'runtime-watchdog-result.json').read_text())['fired']
            elif mode not in ('prearm-failure', 'native-spawn-failure', 'watchdog-startup'):
                assert receipt['actualWait'] and receipt['stdoutEOF'] and receipt['stderrEOF'], (mode, receipt)
            else:
                assert receipt['nativeWait'] is None and receipt['stdoutEOF'] is None
            for w in receipt['watchdogs']:
                assert w['actualWait'] and w['stdoutEOF'] and w['stderrEOF']
                assert w['returncode'] == (19 if mode.endswith('prearm-failure') and w['phase'] == ('preparation' if mode == 'prearm-failure' else 'runtime') else 0)
                if w['result'] and not w['result']['fired'] and receipt['nativeWait']:
                    if w['phase'] == receipt['phase']:
                        assert w['result']['cancelledAt'] >= receipt['nativeWait']['waitedAt']
                        assert all(w['result']['cancelledAt'] >= at for at in receipt['eofAt'].values())
            if mode == 'late':
                assert receipt['returncode'] == 23
            if mode == 'exit143':
                assert receipt['returncode'] == 143 and receipt['nativeWait']['signal'] is None
            if mode == 'native-signal':
                assert receipt['returncode'] == -15 and receipt['nativeWait']['signal'] == 15
            if mode in ('watchdog', 'cleanup-deadline'):
                assert json.loads((out/'runtime-watchdog-result.json').read_text())['fired']
                assert receipt['returncode'] == -9
            if mode == 'noisy':
                assert (out/'stdout.log').stat().st_size == (out/'stderr.log').stat().st_size == 2097152
            if mode == 'foreign-pipe':
                foreign = json.loads((out/'foreign-holder.json').read_text())['pid']
                assert all(a['pid'] != foreign for a in receipt['cleanupSignals'])
                assert b'foreign holder completed' in (out/'stdout.log').read_bytes()
            assert sibling.poll() is None
            results.append(dict(mode=mode, outerExit=p.returncode, actualOuterWait=True, stdoutEOF=True, stderrEOF=True, receipt=receipt))
            print('PASS', mode, flush=True)
    finally:
        for p in (sibling, pinned):
            if p.poll() is None:
                p.terminate()
            p.wait(timeout=3)
    m.write(run/'results.json', dict(passed=True, cases=results, identityControls=['self', 'sibling token mismatch', 'stale identity', 'exited pid', 'pidfd exact identity'], siblingActualWait=sibling.returncode))


if __name__ == '__main__':
    if sys.argv[1] == '--native':
        native(sys.argv[2], pathlib.Path(sys.argv[3]))
    elif sys.argv[1] == '--child':
        child(sys.argv[2], pathlib.Path(sys.argv[3]))
    elif sys.argv[1] == '--descendant':
        signal.signal(signal.SIGTERM, signal.SIG_IGN)
        time.sleep(30)
    else:
        main(pathlib.Path(sys.argv[1]).resolve())
