#!/usr/bin/env python3
"""Finite regular-file writes and an independent aggregate pipe/capture budget.

Linux subreaper owns orphaned descendants. On overflow/deadline/group residue,
TERM then KILL the entire session group and waitpid every adopted descendant.
The retained prefix of an overflow log is evidence of FAILURE, never success.
"""
import ctypes, errno, json, os, pathlib, selectors, signal, subprocess, sys, time

FILE_LIMIT = 24 * 1024 * 1024
LOG_LIMIT = 512 * 1024

def run(argv, log, seconds=600):
    if ctypes.CDLL(None, use_errno=True).prctl(36, 1, 0, 0, 0) != 0:
        raise OSError(ctypes.get_errno(), 'PR_SET_CHILD_SUBREAPER')
    hard = __import__('resource').getrlimit(__import__('resource').RLIMIT_FSIZE)[1]
    if hard != __import__('resource').RLIM_INFINITY and hard < FILE_LIMIT:
        raise RuntimeError('external file-size hard limit prevents authorized 24MiB configuration')
    command = ['/usr/bin/prlimit', '--cpu='+str(seconds), '--fsize='+str(FILE_LIMIT), '--', *argv]
    start = time.monotonic()
    child = subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                             stderr=subprocess.STDOUT, start_new_session=True)
    selector = selectors.DefaultSelector()
    selector.register(child.stdout, selectors.EVENT_READ)
    seen = saved = 0
    failure = None
    term_at = None
    reaped = []
    with open(log, 'xb') as output:
        while selector.get_map() or child.poll() is None:
            now = time.monotonic()
            if now-start >= seconds and failure is None:
                failure = 'wall deadline'
            if failure and term_at is None:
                try: os.killpg(child.pid, signal.SIGTERM)
                except ProcessLookupError: pass
                term_at = now
            if term_at is not None and now-term_at >= 5:
                try: os.killpg(child.pid, signal.SIGKILL)
                except ProcessLookupError: pass
            for key, _ in selector.select(0.05):
                data = os.read(key.fd, 16384)
                if not data:
                    selector.unregister(key.fileobj)
                    continue
                seen += len(data)
                keep = data[:max(0, LOG_LIMIT-saved)]
                output.write(keep)
                saved += len(keep)
                if seen > LOG_LIMIT and failure is None:
                    failure = 'aggregate stdout/stderr capture exceeded 524288 bytes'
        status = child.wait()
    # A child may exit leaving a quiet descendant with closed pipes. Reject it,
    # terminate the group and reap all adopted descendants before returning.
    try:
        os.killpg(child.pid, 0)
        if failure is None: failure = 'descendant group survived command exit'
        os.killpg(child.pid, signal.SIGTERM)
        deadline = time.monotonic()+5
    except ProcessLookupError:
        deadline = time.monotonic()
    while True:
        try:
            pid, result = os.waitpid(-1, os.WNOHANG)
        except ChildProcessError:
            break
        if pid:
            reaped.append([pid, result])
            continue
        if time.monotonic() >= deadline:
            try: os.killpg(child.pid, signal.SIGKILL)
            except ProcessLookupError: pass
        time.sleep(0.01)
    return dict(argv=command, exit=status if not failure else 125, childExit=status,
                failure=failure, observedBytes=seen, capturedBytes=saved,
                logLimit=LOG_LIMIT, fileLimit=FILE_LIMIT, seconds=seconds,
                elapsed=time.monotonic()-start, adoptedReaped=reaped, groupReaped=True)

if __name__ == '__main__':
    log, receipt, *argv = sys.argv[1:]
    try: result = run(argv, log)
    except Exception as error: result = dict(exit=125, failure=str(error))
    pathlib.Path(receipt).write_text(json.dumps(result, separators=(',', ':'))+'\n')
    sys.exit(result['exit'] if result['exit'] >= 0 else 128-result['exit'])
