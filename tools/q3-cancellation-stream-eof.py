"""Separate pipe closure for the existing Q3 cancellation launch composition.

CLI arguments are the existing q3-native-launch-client.py arguments. No new
launch, command, input or cleanup budget: only its generated parent's pipe pump
and wait receipt change. Pin this helper alongside prelaunch before staging.
"""
import gzip
import json
import os
from pathlib import Path
import runpy
import selectors
import signal
import time


def client(root):
    return runpy.run_path(str(Path(root)/'tools/q3-native-launch-client.py'))


def drain_streams(process, log, tick=lambda: None):
    """Return only after a real wait and an empty read on EACH actual pipe.

    A child exit is not EOF: descendants may retain either writer. No timeout,
    poll result, closed local reader or combined EOF is promoted to closure.
    Keep the existing .02s polling and 16 * 65536-byte pumping bound.
    """
    eof = {'stdoutEOF': False, 'stderrEOF': False}
    with selectors.DefaultSelector() as poll:
        for name, stream in [('stdoutEOF', process.stdout), ('stderrEOF', process.stderr)]:
            os.set_blocking(stream.fileno(), False)
            poll.register(stream, selectors.EVENT_READ, name)
        while process.poll() is None or not all(eof.values()):
            tick()
            if all(eof.values()):
                time.sleep(.02)
                continue
            ready = poll.select(.02)
            for key, _ in ready:
                for _ in range(16 // len(ready)):
                    try:
                        chunk = os.read(key.fd, 65536)
                    except BlockingIOError:
                        break
                    if not chunk:
                        eof[key.data] = True
                        poll.unregister(key.fileobj)
                        break
                    log.write(chunk)
                    log.flush()
    status = process.wait()
    process.stdout.close()
    process.stderr.close()
    return dict(status=status, actualWait=True, stdioEOF=all(eof.values()), **eof)


def drain_remote(process, run, log, requested, output, owner):
    """Same sticky cancellation and identity-bound TERM as the existing pump."""
    run = Path(run)
    signalled = None

    def tick():
        nonlocal signalled
        if requested:
            owner['cancel_remote'](run, output)
        if (run/'caller-cancelled.json').exists() and signalled is None:
            try:
                runtime = json.loads(gzip.decompress((run/'runtime-identity.json.gz').read_bytes()))
                armed = json.loads((run/'kernel-armed.json').read_bytes())
                stat = Path('/proc', str(runtime['pid']), 'stat').read_text()
                start = stat.rsplit(')', 1)[1].split()[19]
                if (armed['supervisor'], armed['supervisorStart']) != (runtime['pid'], runtime['start']):
                    raise owner['TerminalFailure']('remote supervisor binding mismatch; no signal')
                if start != runtime['start']:
                    raise owner['TerminalFailure']('remote supervisor identity changed; no signal')
                os.kill(runtime['pid'], signal.SIGTERM)
                signalled = dict(pid=runtime['pid'], start=start, signal=signal.SIGTERM)
                with (run/'caller-cancel-sent.json').open('x') as marker:
                    json.dump(dict(at=time.time(), **signalled, remoteCustody='UNKNOWN'), marker)
            except (FileNotFoundError, ProcessLookupError, EOFError, gzip.BadGzipFile, json.JSONDecodeError):
                pass
    return drain_streams(process, log, tick)


def compose_remote_launch(code, root, output):
    """Reuse the actual existing cancellation wrapper; refuse shape drift."""
    owner = client(root)
    code = owner['compose_remote_launch'](code, root, output)
    pump = " status=_q3['drain_remote'](p,r,log,_q3_signals,"+repr(str(output))+");p.stdout.close()"
    wait = 'status=status,actualWait=True,stdioEOF=True,parent=parent'
    merged = 'stdout=subprocess.PIPE,stderr=subprocess.STDOUT'
    if any(code.count(part) != 1 for part in (pump, wait, merged)):
        raise ValueError('unsupported Q3 separate-stream launch parent')
    helper = str(Path(root)/'tools/q3-cancellation-stream-eof.py')
    code = code.replace(pump, " _q3_eof=runpy.run_path("+repr(helper)+")\n _q3_wait=_q3_eof['drain_remote'](p,r,log,_q3_signals,"+repr(str(output))+",_q3)\n status=_q3_wait['status']")
    code = code.replace(merged, 'stdout=subprocess.PIPE,stderr=subprocess.PIPE')
    code = code.replace(wait, '**_q3_wait,parent=parent')
    compile(code, '<q3-separate-stream-parent>', 'exec')
    return code


def bind_remote(task, session):
    owner = client(task['REMOTE'])
    owner['bind_remote'].__globals__['compose_remote_launch'] = compose_remote_launch
    owner['bind_remote'](task, session)


if __name__ == '__main__':
    owner = client(Path(__file__).resolve().parents[1])
    owner['main'].__globals__['compose_remote_launch'] = compose_remote_launch
    raise SystemExit(owner['main']())
