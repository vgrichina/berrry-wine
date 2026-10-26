#!/usr/bin/env python3
"""Small production-adapter four-request cleanup regression; no Boat execution.

Run separately from the unittest suite to retain the lightweight test allocation
including the execution pool, supervisor and all four owners/transports.
"""
import json
import os
import pathlib
import signal
import sys
import tempfile
import time

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'test/fixtures/ricochet-serial-controller'))
import read as adapter
import work


def run():
    with tempfile.TemporaryDirectory() as td:
        root = pathlib.Path(td)
        source = root / 'frozen'; source.write_bytes(b'x' * (work.capture.CHUNK * 6))
        destination = root / 'destination'; destination.write_bytes(b'old')
        pidfile = root / 'pids'
        original = work.python_argv; original_root = adapter.R
        calls = []
        def argv(code, remaining):
            original(code, remaining)
            calls.append(code)
            if 'f.seek(' in code:
                program = ('import os,time\n'
                           f'with open({str(pidfile)!r},"a") as f:f.write(str(os.getpid())+"\\n")\n'
                           'time.sleep(30)\n')
            else:
                program = ('import io,contextlib,json\ns=io.StringIO()\n'
                           f'with contextlib.redirect_stdout(s):exec({code!r},{{}})\n'
                           'j=dict(exitCode=0,success=True,timedOut=False,launcherFailed=False,\n'
                           'oomKilled=False,signal=None,stdoutTruncated=False,stderrTruncated=False,stderr="")\n'
                           'j["stdout"]=s.getvalue();print(json.dumps(j))\n')
            return [sys.executable, '-S', '-c', program]
        work.python_argv = argv; adapter.R = str(root)
        started = time.monotonic()
        try:
            try:
                adapter.readfile('frozen', destination, deadline=started + .5)
            except work.capture.ReadbackError as e:
                assert 'deadline' in str(e), str(e)
            else:
                raise AssertionError('deadline was not enforced')
            elapsed = time.monotonic() - started
            assert .5 <= elapsed < .8, elapsed
            assert len(calls) == 5, len(calls)
            pids = list(map(int, pidfile.read_text().split()))
            assert len(pids) == 4, pids
            assert all(not pathlib.Path('/proc', str(pid)).exists() for pid in pids), pids
            assert destination.read_bytes() == b'old'
            assert not list(root.glob('.*.readback-*'))
            return dict(elapsed=elapsed, pids=pids, descendantsAbsent=True, requests=len(calls))
        finally:
            work.python_argv = original; adapter.R = original_root
            if pidfile.exists():
                for pid in map(int, pidfile.read_text().split()):
                    try: os.kill(pid, signal.SIGKILL)
                    except ProcessLookupError: pass


if __name__ == '__main__':
    print(json.dumps(run()))
