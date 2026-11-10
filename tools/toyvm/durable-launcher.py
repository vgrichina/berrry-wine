#!/usr/bin/env python3
"""Linux durable, once-only subprocess custody (stdlib only).

  python3 tools/toyvm/durable-launcher.py run RUN_DIR SECONDS -- COMMAND ...
  python3 tools/toyvm/durable-launcher.py status RUN_DIR

RUN_DIR is an immutable request identity, not a reusable output directory.
Retrying the identical command only observes its outcome. A reserved request
without an outcome is UNKNOWN: never delete its reservation to retry work.
Requires Linux /proc, prctl subreaping, and Python pidfd signal support.
The detached actual parent owns the watchdog wait and both outer pipe drains.
The watchdog is a subreaper with a prearmed deadline and owns command custody,
including descendants that leave the command process group. EOF and wait are
separate records; neither is inferred from PID absence. No restart/replay.
"""
import ctypes
import hashlib
import json
import math
import os
from pathlib import Path
import signal
import subprocess
import sys
import threading
import time
import uuid


def publish(path, value):
    """Publish immutable JSON, including directory durability; no partial reads."""
    path = Path(path)
    temp = path.with_name('.' + path.name + '.' + uuid.uuid4().hex)
    try:
        with temp.open('x') as f:
            json.dump(value, f, sort_keys=True)
            f.flush()
            os.fsync(f.fileno())
        os.link(temp, path)
        fd = os.open(path.parent, os.O_DIRECTORY)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)
    finally:
        temp.unlink(missing_ok=True)


def read(path):
    return json.loads(Path(path).read_text())


def drains(directory, label, child):
    errors = []

    def drain(name, pipe):
        try:
            digest = hashlib.sha256()
            size = 0
            with (directory / (label + '-' + name + '.log')).open('xb') as f:
                while data := pipe.read(65536):
                    f.write(data)
                    digest.update(data)
                    size += len(data)
                f.flush()
                os.fsync(f.fileno())
            pipe.close()
            publish(directory / (label + '-' + name + '-eof.json'), dict(
                pid=child.pid, separateEOF=True, size=size,
                sha256=digest.hexdigest(), at=time.time()))
        except Exception as error:
            errors.append(repr(error))

    threads = [threading.Thread(target=drain, args=(name, pipe))
               for name, pipe in [('stdout', child.stdout), ('stderr', child.stderr)]]
    for thread in threads:
        thread.start()

    def finish():
        for thread in threads:
            thread.join()
        if errors:
            raise RuntimeError(errors)
    return finish


def waited(directory, label, pid, code, **extra):
    publish(directory / (label + '-wait.json'), dict(
        pid=pid, actualParent=os.getpid(), actualParentWait=True,
        returnCode=code, at=time.time(), **extra))


def descendants(pid):
    """Only this subreaper's tree; include zombies and separate sessions."""
    result = []
    try:
        children = Path('/proc/%d/task/%d/children' % (pid, pid)).read_text().split()
    except FileNotFoundError:
        return result
    for text in children:
        child = int(text)
        result.append(child)
        result.extend(descendants(child))
    return result


def signal_tree(sig):
    # pidfds prevent recycled PID signaling. Children can reparent to this
    # subreaper during enumeration; the next iteration visits them again.
    for pid in reversed(descendants(os.getpid())):
        try:
            fd = os.pidfd_open(pid)
        except ProcessLookupError:
            continue
        try:
            if pid in descendants(os.getpid()):
                signal.pidfd_send_signal(fd, sig)
        except ProcessLookupError:
            pass
        finally:
            os.close(fd)


def watchdog(directory):
    if ctypes.CDLL(None, use_errno=True).prctl(36, 1, 0, 0, 0) != 0:
        raise OSError(ctypes.get_errno(), 'PR_SET_CHILD_SUBREAPER')
    request = read(directory / 'request.json')
    start = time.monotonic()
    deadline = start + request['seconds']
    grace = request['graceSeconds']
    # This durable record precedes starting any requested work.
    publish(directory / 'armed.json', dict(
        pid=os.getpid(), parent=os.getppid(), at=time.time(),
        seconds=request['seconds'], graceSeconds=grace,
        monotonicDeadline=deadline))
    try:
        child = subprocess.Popen(request['argv'], cwd=request['cwd'],
                                 stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                 stderr=subprocess.PIPE, start_new_session=True)
    except OSError as error:
        publish(directory / 'spawn-error.json', dict(error=repr(error)))
        return 125
    publish(directory / 'command-launched.json', dict(pid=child.pid, parent=os.getpid()))
    finish = drains(directory, 'command', child)
    expired = False
    cleanup = None
    adopted = []
    code = None
    while True:
        # Popen owns the direct child wait. Never consume it with waitpid(-1).
        if code is None:
            code = child.poll()
            if code is not None:
                waited(directory, 'command', child.pid, code)
                cleanup = time.monotonic()
        if code is not None:
            while True:
                try:
                    pid, status = os.waitpid(-1, os.WNOHANG)
                except ChildProcessError:
                    break
                if pid == 0:
                    break
                receipt = dict(pid=pid, rawStatus=status,
                               returnCode=os.waitstatus_to_exitcode(status),
                               actualWaitpid=True, actualParent=os.getpid())
                publish(directory / ('adopted-%d-wait.json' % pid), receipt)
                adopted.append(receipt)
            if not descendants(os.getpid()):
                break
        now = time.monotonic()
        if now >= deadline and not expired:
            expired = True
            cleanup = now if cleanup is None else cleanup
            publish(directory / 'deadline.json', dict(at=time.time(), expired=True))
        # A successful parent cannot leave daemonized children/pipe holders.
        # Allow a grace interval for ordinary late writes/reaping on parent exit.
        if expired or (cleanup is not None and now >= cleanup + grace):
            signal_tree(signal.SIGKILL if now >= cleanup + grace else signal.SIGTERM)
        time.sleep(.01)
    finish()
    publish(directory / 'watchdog-terminal.json', dict(
        commandReturnCode=code, deadlineExpired=expired, adopted=adopted,
        children=[], elapsedSeconds=time.monotonic() - start))
    return 124 if expired else (code if code >= 0 else 128 - code)


def owner(directory):
    # This process, unlike the submitting client, owns the watchdog's actual
    # wait. All inherited terminal descriptors were replaced by submit().
    signal.signal(signal.SIGHUP, signal.SIG_IGN)
    child = subprocess.Popen([sys.executable, str(Path(__file__).resolve()),
                              '_watchdog', str(directory)],
                             stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                             stderr=subprocess.PIPE, start_new_session=True)
    publish(directory / 'watchdog-launched.json', dict(pid=child.pid, parent=os.getpid()))
    finish = drains(directory, 'watchdog', child)
    code = child.wait()
    waited(directory, 'watchdog', child.pid, code)
    finish()
    publish(directory / 'outcome.json', dict(
        returnCode=code, actualWatchdogWait=True, stdoutEOF=True, stderrEOF=True,
        custodyComplete=(directory / 'watchdog-terminal.json').exists(), at=time.time()))


def submit(directory, argv, seconds, grace=1):
    directory = Path(directory).resolve()
    if not argv or not math.isfinite(seconds) or seconds <= 0 or not math.isfinite(grace) or grace <= 0:
        raise ValueError('nonempty command and finite positive bounds required')
    request = dict(argv=argv, seconds=seconds, graceSeconds=grace, cwd=os.getcwd())
    try:
        directory.mkdir()
    except FileExistsError:
        # A client dying between mkdir and publication leaves UNKNOWN, never
        # an invitation to execute twice. A concurrent submit may retry reading.
        if not (directory / 'request.json').exists():
            raise RuntimeError('UNKNOWN reserved request; do not replay')
        if read(directory / 'request.json') != request:
            raise ValueError('request identity conflict')
        return
    publish(directory / 'request.json', request)
    with (directory / 'owner.stdout').open('xb') as out, (directory / 'owner.stderr').open('xb') as err:
        child = subprocess.Popen([sys.executable, str(Path(__file__).resolve()),
                                  '_owner', str(directory)], stdin=subprocess.DEVNULL,
                                 stdout=out, stderr=err, start_new_session=True,
                                 close_fds=True)
    publish(directory / 'owner-launched.json', dict(pid=child.pid, parent=os.getpid()))


def observe(directory):
    directory = Path(directory)
    if (directory / 'outcome.json').exists():
        return read(directory / 'outcome.json')
    return dict(state='UNKNOWN_OR_RUNNING', replayAllowed=False)


def main():
    action, directory = sys.argv[1:3]
    directory = Path(directory).resolve()
    if action == '_owner':
        owner(directory)
    elif action == '_watchdog':
        return watchdog(directory)
    elif action == 'status':
        print(json.dumps(observe(directory)))
    elif action == 'run':
        seconds = float(sys.argv[3])
        if sys.argv[4] != '--':
            raise ValueError('expected -- COMMAND ...')
        submit(directory, sys.argv[5:], seconds)
        while not (directory / 'outcome.json').exists():
            time.sleep(.05)
        result = observe(directory)
        print(json.dumps(result))
        return result['returnCode']
    else:
        raise ValueError('unknown action')
    return 0


if __name__ == '__main__':
    sys.exit(main())
