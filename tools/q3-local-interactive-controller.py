"""Own the local retained Q3 interactive caller, without changing its protocol.

python3 -B tools/q3-local-interactive-controller.py --caller RUN/q3-checkpoint-caller.py
  --caller-sha256 SHA --evidence NEW_DIRECTORY

Keep a pipe writer or canonical terminal open. Only complete newline-terminated
input is forwarded, byte for byte; EOF is cancellation, never detach. This entry
replaces retained interactive.py. It does not authorize a native run or replay.
Local waits and EOF never establish remote custody or normal browser close.
"""
import argparse
from contextlib import ExitStack
import gzip
import hashlib
import json
import os
from pathlib import Path
import select
import selectors
import stat
import subprocess
import sys
import time


def preflight(stream, poll):
    """Reject unsupported/EOF stdin before Popen; retain any available bytes."""
    fd = stream.fileno()
    mode = os.fstat(fd).st_mode
    if not (stat.S_ISFIFO(mode) or os.isatty(fd)):
        raise ValueError('controller stdin requires a live pipe or terminal')
    poll.register(stream, selectors.EVENT_READ, 2)  # EPERM is a setup failure.
    # poll HUP catches even a closed writer with unread buffered commands.
    probe = select.poll()
    probe.register(fd, select.POLLIN | select.POLLHUP | select.POLLERR)
    events = probe.poll(0)
    if any(mask & (select.POLLHUP | select.POLLERR | select.POLLNVAL) for _, mask in events):
        raise ValueError('controller stdin EOF during preflight')
    if events:
        data = os.read(fd, 65536)
        if not data:
            raise ValueError('controller stdin EOF during preflight')
        return data
    return b''


def control(argv, evidence, stream=None, emit=None, cleanup_seconds=75):
    """Preflight, spawn once, then finally close input, drain and actually wait.

    Closing the caller's pipe first gives its existing sticky cancellation and
    cleanup path time to run. The local cleanup cap never extends guest/runtime
    deadlines. A forced local exit leaves remote custody UNKNOWN.
    """
    stream = sys.stdin if stream is None else stream
    emit = (lambda index, data: os.write(index+1, data)) if emit is None else emit
    evidence = Path(evidence)
    evidence.mkdir(parents=True, exist_ok=False)
    child = None
    eof = [False, False]
    first = None
    target = {}
    logs = []
    forced = False

    def fail(error):
        nonlocal first
        if first is None:
            first = dict(at=time.time(), reason=str(error), noReplay=True,
                         noLaterInputCapture=True, remoteCustody='UNKNOWN')
            try:
                (evidence/'first-terminal.json').write_text(json.dumps(first))
            except OSError:
                pass  # Evidence failure must never bypass the actual wait.

    with ExitStack() as stack:
        poll = stack.enter_context(selectors.DefaultSelector())
        try:
            pending = preflight(stream, poll)
            # Every fallible setup operation precedes the sole spawn.
            for name in ('stdout', 'stderr'):
                logs.append(stack.enter_context(gzip.open(evidence/('controller.'+name+'.gz'), 'xb')))
            child = subprocess.Popen(argv, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                     stderr=subprocess.PIPE, bufsize=0)
            target = dict(pid=child.pid, start='UNKNOWN')
            target['start'] = Path('/proc', str(child.pid), 'stat').read_text().rsplit(')', 1)[1].split()[19]
            for index, output in enumerate((child.stdout, child.stderr)):
                os.set_blocking(output.fileno(), False)
                poll.register(output, selectors.EVENT_READ, index)
            # Nonblocking writes keep a stalled caller from hiding failure/EOF.
            os.set_blocking(child.stdin.fileno(), False)
            outgoing = b''
            while child.poll() is None and not any(eof):
                events = poll.select(.02)
                # Observe child output/EOF before admitting input in this batch.
                for key, _ in sorted(events, key=lambda pair: pair[0].data):
                    if key.data == 2:
                        if any(eof) or child.poll() is not None:
                            break
                        chunk = os.read(key.fd, 65536)
                        if not chunk:
                            raise EOFError('controller stdin EOF')
                        pending += chunk
                    else:
                        chunk = os.read(key.fd, 65536)
                        if chunk:
                            logs[key.data].write(chunk)
                            logs[key.data].flush()
                            emit(key.data, chunk)
                        else:
                            eof[key.data] = True
                            poll.unregister(key.fileobj)
                if any(eof) or child.poll() is not None:
                    break
                # Never forward a partial line or a read-ahead TextIO buffer.
                boundary = pending.rfind(b'\n')+1
                outgoing += pending[:boundary]
                pending = pending[boundary:]
                if outgoing:
                    try:
                        written = os.write(child.stdin.fileno(), outgoing)
                        outgoing = outgoing[written:]
                    except BlockingIOError:
                        pass
        except BaseException as error:
            fail(error)
        finally:
            if child is not None:
                # Even exceptions in identity lookup, registration, or sinks
                # after Popen must pass through this actual parent's wait.
                try:
                    child.stdin.close()
                    due = time.monotonic()+cleanup_seconds
                    outputs = (child.stdout, child.stderr)
                    for output in outputs:
                        os.set_blocking(output.fileno(), False)
                    while not all(eof) or child.poll() is None:
                        for index, output in enumerate(outputs):
                            if eof[index]:
                                continue
                            try:
                                chunk = os.read(output.fileno(), 65536)
                            except BlockingIOError:
                                continue
                            if not chunk:
                                eof[index] = True
                            else:
                                try:
                                    logs[index].write(chunk)
                                    logs[index].flush()
                                    if first is None:
                                        emit(index, chunk)
                                except BaseException as error:
                                    fail(error)
                        if time.monotonic() >= due:
                            fail('controller local cleanup deadline; remote custody UNKNOWN')
                            forced = True
                            if child.poll() is None:
                                child.kill()
                            break
                        time.sleep(.005)
                except BaseException as error:
                    fail(error)
                finally:
                    if child.poll() is None:
                        child.kill()
                        forced = True
                    status = child.wait()
                    # Drain bytes remaining after kill without inventing EOF
                    # if an unrelated descendant still holds an output pipe.
                    for index, output in enumerate((child.stdout, child.stderr)):
                        if not eof[index]:
                            try:
                                while True:
                                    chunk = os.read(output.fileno(), 65536)
                                    if not chunk:
                                        eof[index] = True
                                        break
                                    logs[index].write(chunk)
                            except BlockingIOError:
                                pass
                            except BaseException as error:
                                fail(error)
                        output.close()
                    if status != 0:
                        fail('controller child exit: '+str(status))
                    if not all(eof):
                        fail('controller output EOF incomplete')
                    receipt = dict(**target, status=status, actualWait=True,
                                   stdoutEOF=eof[0], stderrEOF=eof[1], forced=forced,
                                   remoteCustody='UNKNOWN')
                    (evidence/'controller-actual-wait.json').write_text(json.dumps(receipt))
    return int(first is not None)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--caller', type=Path, required=True)
    parser.add_argument('--caller-sha256', required=True)
    parser.add_argument('--evidence', type=Path, required=True)
    args = parser.parse_args()
    if hashlib.sha256(args.caller.read_bytes()).hexdigest() != args.caller_sha256:
        raise ValueError('retained interactive caller SHA mismatch')
    return control([sys.executable, '-B', str(args.caller.resolve()), 'launch', 'original'], args.evidence)


if __name__ == '__main__':
    raise SystemExit(main())
