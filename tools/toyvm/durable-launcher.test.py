#!/usr/bin/env python3
"""Real Linux process tests; optional evidence directory is kept, never archived."""
import ctypes
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time

SCRIPT = Path(__file__).with_name('durable-launcher.py').resolve()
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('durable_launcher', SCRIPT)
launcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(launcher)


def until(predicate, seconds=10):
    deadline = time.monotonic() + seconds
    while not predicate():
        assert time.monotonic() < deadline, 'bounded test wait expired'
        time.sleep(.01)


def fixture(mode, directory):
    directory = Path(directory)
    with (directory / 'executions').open('a') as f:
        f.write('once\n')
        f.flush()
        os.fsync(f.fileno())
    # This independently scheduled child is armed before the in-flight marker.
    release = os.fork()
    if release == 0:
        time.sleep(.3)
        (directory / 'released').write_text('keys up')
        print('release late stdout', flush=True)
        print('release late stderr', file=sys.stderr, flush=True)
        os._exit(0)
    launcher.publish(directory / 'release-armed.json', dict(pid=release))
    (directory / 'in-flight').touch()
    if mode == 'error':
        time.sleep(.1)
        print('deliberate supervisor error', file=sys.stderr, flush=True)
        return 23  # release remains active, is adopted, drains, and is waited
    if mode == 'timeout':
        # A session-escaping orphan ignores TERM and holds both pipes open.
        orphan = os.fork()
        if orphan == 0:
            os.setsid()
            signal.signal(signal.SIGTERM, signal.SIG_IGN)
            (directory / 'orphan-ready').write_text(str(os.getpid()))
            while True:
                time.sleep(1)
        launcher.publish(directory / 'orphan.json', dict(pid=orphan))
        signal.signal(signal.SIGTERM, signal.SIG_IGN)
    pid, status = os.waitpid(release, 0)
    launcher.publish(directory / 'release-wait.json', dict(pid=pid, rawStatus=status,
                                                          actualWaitpid=True))
    if mode == 'timeout':
        while True:
            time.sleep(1)
    if mode == 'orphan':
        orphan = os.fork()
        if orphan == 0:
            os.setsid()
            time.sleep(.4)
            print('orphan late stdout', flush=True)
            print('orphan late stderr', file=sys.stderr, flush=True)
            os._exit(17)
        launcher.publish(directory / 'orphan.json', dict(pid=orphan))
    time.sleep(.2)
    if mode == 'healthy':
        # Both streams exceed pipe capacity; serial draining would deadlock.
        sys.stdout.write('o' * 131072)
        sys.stdout.flush()
        sys.stderr.write('e' * 131072)
        sys.stderr.flush()
    print('supervisor final stdout', flush=True)
    print('supervisor final stderr', file=sys.stderr, flush=True)
    return 0


def check_stream(directory, label, stream):
    receipt = launcher.read(directory / (label + '-' + stream + '-eof.json'))
    data = (directory / (label + '-' + stream + '.log')).read_bytes()
    assert receipt['separateEOF'] and receipt['size'] == len(data)
    assert receipt['sha256'] == hashlib.sha256(data).hexdigest()
    return data


def run_tests(root):
    assert ctypes.CDLL(None).prctl(36, 1, 0, 0, 0) == 0
    results = []
    try:
        for mode in ['healthy', 'error', 'orphan', 'timeout']:
            directory = root / mode
            argv = [sys.executable, str(Path(__file__).resolve()), '--fixture', mode, str(directory)]
            bound = 1.2 if mode == 'timeout' else 5
            client = subprocess.Popen([sys.executable, str(SCRIPT), 'run', str(directory),
                                       str(bound), '--', *argv], start_new_session=True,
                                      stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            until(lambda: (directory / 'in-flight').exists())
            assert (directory / 'armed.json').exists()
            assert (directory / 'release-armed.json').exists()
            launcher.submit(directory, argv, bound)  # in-flight duplicate
            if mode == 'healthy':
                # Kill the entire submitting group during active work.
                os.killpg(client.pid, signal.SIGTERM)
            out, err = client.communicate(timeout=10)
            launcher.submit(directory, argv, bound)  # retry after submitter loss
            launcher.publish(directory / 'client-result.json', dict(
                actualParentWait=True, returnCode=client.returncode,
                stdout=out.decode(), stderr=err.decode(), stdoutEOF=True, stderrEOF=True))
            until(lambda: (directory / 'outcome.json').exists())
            result = launcher.observe(directory)
            assert result['custodyComplete']
            expected = {'healthy': 0, 'error': 23, 'orphan': 0, 'timeout': 124}[mode]
            assert result['returnCode'] == expected, result
            assert client.returncode == (-15 if mode == 'healthy' else expected)
            owner = launcher.read(directory / 'owner-launched.json')['pid']
            # After the client dies/exits, this test subreaper adopts the owner.
            waited = []
            until(lambda: reap_owner(owner, waited))
            assert waited[0][0] == owner and os.waitstatus_to_exitcode(waited[0][1]) == 0
            launcher.publish(directory / 'owner-wait.json', dict(
                pid=owner, rawStatus=waited[0][1], actualWaitpid=True, actualParent=os.getpid()))
            terminal = launcher.read(directory / 'watchdog-terminal.json')
            assert terminal['children'] == []
            assert terminal['deadlineExpired'] == (mode == 'timeout')
            for label in ['command', 'watchdog']:
                wait = launcher.read(directory / (label + '-wait.json'))
                assert wait['actualParentWait']
                assert not Path('/proc/%d' % wait['pid']).exists()
                for stream in ['stdout', 'stderr']:
                    data = check_stream(directory, label, stream)
                    if label == 'command':
                        assert b'release late ' + stream.encode() in data
            assert (directory / 'released').read_text() == 'keys up'
            release_pid = launcher.read(directory / 'release-armed.json')['pid']
            if mode == 'error':
                release = launcher.read(directory / ('adopted-%d-wait.json' % release_pid))
            else:
                release = launcher.read(directory / 'release-wait.json')
            assert release['actualWaitpid'] and release['rawStatus'] == 0
            assert not Path('/proc/%d' % release_pid).exists()
            if mode in ['timeout', 'orphan']:
                orphan = launcher.read(directory / 'orphan.json')['pid']
                actual = [v for v in terminal['adopted'] if v['pid'] == orphan]
                assert len(actual) == 1 and actual[0]['actualWaitpid']
                assert actual[0]['returnCode'] == (-9 if mode == 'timeout' else 17)
                assert launcher.read(directory / ('adopted-%d-wait.json' % orphan)) == actual[0]
                assert not Path('/proc/%d' % orphan).exists()
            # Identical request after client loss and after completion: no replay.
            launcher.submit(directory, argv, bound)
            assert (directory / 'executions').read_text() == 'once\n'
            try:
                launcher.submit(directory, ['different'], bound)
                raise AssertionError('identity conflict accepted')
            except ValueError:
                pass
            results.append(dict(mode=mode, passed=True, returnCode=expected,
                                clientReturnCode=client.returncode))
        reserved = root / 'reserved'
        reserved.mkdir()
        try:
            launcher.submit(reserved, ['never-run'], 1)
            raise AssertionError('unknown reservation replayed')
        except RuntimeError:
            pass
        launcher.publish(root / 'results.json', dict(passed=True, cases=results,
                                                    unknownReservationNoReplay=True))
        assert launcher.descendants(os.getpid()) == []
        print('durable launcher PASS: client-group TERM, independent release, error, '
              'timeout, escaped orphan, actual waits, separate EOF, no replay')
    finally:
        # Only descendants of this test process; never clean foreign work.
        launcher.signal_tree(signal.SIGKILL)
        while True:
            try:
                os.waitpid(-1, 0)
            except ChildProcessError:
                break


def reap_owner(owner, waited):
    pid, status = os.waitpid(owner, os.WNOHANG)
    if pid:
        waited.append((pid, status))
    return bool(pid)


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '--fixture':
        sys.exit(fixture(sys.argv[2], sys.argv[3]))
    if len(sys.argv) > 1:
        root = Path(sys.argv[1]).resolve()
        root.mkdir()
        run_tests(root)
    else:
        with tempfile.TemporaryDirectory(prefix='durable-launcher-') as temp:
            run_tests(Path(temp))
