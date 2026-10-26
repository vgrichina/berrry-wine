#!/usr/bin/env python3
"""Bounded readback of an already frozen file; never sends guest controls.

Executor.start(code, remaining) must return a job with nonblocking poll() and
bounded cancel(). poll returns the complete *raw API response*, or None while
pending. Each job owns one stateless read-only request; no retries are allowed.
SubprocessExecutor implements this contract without unkillable worker threads.
"""
import base64
import sys
import hashlib
import json
import math
import os
import pathlib
import re
import signal
import subprocess
import tempfile
import time

CHUNK = 4500
RESPONSE_LIMIT = 8192
ARTIFACT_LIMIT = 2 * 1024 * 1024
MAX_ACTIVE = 4


class ReadbackError(RuntimeError):
    pass


def _check(ok, message):
    if not ok:
        raise ReadbackError(message)


def _identity_code(path):
    # repr is Python literal encoding, never shell interpolation. The transport
    # must separately quote the entire Python program (see controller fixture).
    return ('import os,stat,json,hashlib,base64\n'
            f'p={str(path)!r}\n'
            'f=open(p,"rb");s=os.fstat(f.fileno())\n'
            'assert stat.S_ISREG(s.st_mode)\n'
            'identity=[s.st_dev,s.st_ino,s.st_size,s.st_mtime_ns,s.st_ctime_ns]\n')


def _metadata_code(path):
    return (_identity_code(path) +
            f'assert s.st_size<={ARTIFACT_LIMIT}\n'
            'h=hashlib.sha256();left=s.st_size\n'
            'while left:\n'
            ' b=f.read(min(8192,left));assert b;h.update(b);left-=len(b)\n'
            'digest=h.hexdigest()\n'
            't=os.fstat(f.fileno());u=os.stat(p)\n'
            'assert identity==[t.st_dev,t.st_ino,t.st_size,t.st_mtime_ns,t.st_ctime_ns]\n'
            'assert identity==[u.st_dev,u.st_ino,u.st_size,u.st_mtime_ns,u.st_ctime_ns]\n'
            'print(json.dumps(dict(bytes=s.st_size,identity=identity,sha256=digest)))\n')


def _chunk_code(path, identity, offset, length):
    return (_identity_code(path) +
            f'assert identity=={identity!r}\n'
            f'f.seek({offset});b=f.read({length})\n'
            f'assert len(b)=={length}\n'
            't=os.fstat(f.fileno());u=os.stat(p)\n'
            'assert identity==[t.st_dev,t.st_ino,t.st_size,t.st_mtime_ns,t.st_ctime_ns]\n'
            'assert identity==[u.st_dev,u.st_ino,u.st_size,u.st_mtime_ns,u.st_ctime_ns]\n'
            'print(base64.b64encode(b).decode("ascii"))\n')


def _response(raw):
    _check(isinstance(raw, bytes) and len(raw) <= RESPONSE_LIMIT, 'API response ceiling')
    try:
        j = json.loads(raw)
    except (ValueError, UnicodeError) as e:
        raise ReadbackError('invalid API JSON') from e
    _check(isinstance(j, dict) and type(j.get('exitCode')) is int and j['exitCode'] == 0,
           'transport exit/denial')
    _check(j.get('success') is True and j.get('timedOut') is False and
           j.get('launcherFailed') is False and j.get('oomKilled') is False and
           j.get('signal') is None, 'API failure metadata')
    _check(j.get('stdoutTruncated') is False and j.get('stderrTruncated') is False,
           'truncated or missing transport metadata')
    _check(isinstance(j.get('stdout'), str) and j.get('stderr') == '', 'transport stderr/schema')
    return j['stdout']


def _metadata(raw):
    try:
        j = json.loads(_response(raw))
    except (ValueError, UnicodeError) as e:
        raise ReadbackError('invalid artifact metadata') from e
    _check(isinstance(j, dict), 'metadata object')
    n = j.get('bytes'); identity = j.get('identity'); digest = j.get('sha256')
    _check(type(n) is int and 0 <= n <= ARTIFACT_LIMIT, 'artifact size ceiling')
    _check(isinstance(identity, list) and len(identity) == 5 and
           all(type(x) is int and x >= 0 for x in identity) and identity[2] == n,
           'invalid immutable identity')
    _check(isinstance(digest, str) and re.fullmatch('[0-9a-f]{64}', digest), 'invalid SHA256')
    return j


def readback(executor, source, destination, *, deadline, concurrency=MAX_ACTIVE):
    """Publish only a complete immutable, digest-verified artifact before deadline.

    deadline uses time.monotonic(). At most concurrency jobs exist (no backlog
    of futures). Offsets and expected lengths come solely from validated size.
    On any failure, cancel all owned jobs and unlink only our private temp file.
    The caller must serialize guest controls and freeze the source beforehand.
    """
    _check(type(concurrency) is int and 1 <= concurrency <= MAX_ACTIVE, 'concurrency ceiling')
    _check(isinstance(deadline, (int, float)) and math.isfinite(deadline), 'invalid deadline')
    active = {}; temporary = None; f = None
    def remaining():
        left = deadline - time.monotonic()
        _check(left > 0, 'readback deadline')
        return left
    def start(code, slot):
        job = executor.start(code, remaining())
        active[job] = slot
        return job
    def finish(job):
        remaining()
        raw = job.poll()
        remaining()
        if raw is not None:
            # Also clean up owned descendants after a successful response.
            job.cancel()
            del active[job]
        return raw
    def one(code):
        job = start(code, None)
        while True:
            raw = finish(job)
            if raw is not None:
                return raw
            time.sleep(min(.002, remaining()))
    try:
        before = _metadata(one(_metadata_code(source)))
        size = before['bytes']
        destination = pathlib.Path(destination)
        destination.parent.mkdir(parents=True, exist_ok=True)
        fd, temporary = tempfile.mkstemp(prefix='.'+destination.name+'.readback-', dir=destination.parent)
        f = os.fdopen(fd, 'w+b')
        offset = 0; completed = 0; peak = 0
        while offset < size or active:
            while offset < size and len(active) < concurrency:
                length = min(CHUNK, size-offset)
                start(_chunk_code(source, before['identity'], offset, length), (offset, length))
                offset += length; peak = max(peak, len(active))
            progress = False
            for job, (off, length) in list(active.items()):
                raw = finish(job)
                if raw is None:
                    continue
                text = _response(raw)
                # print(base64) adds exactly one newline; reject whitespace,
                # noncanonical padding, short/long chunks and non-ASCII input.
                _check(text.endswith('\n'), 'missing chunk terminator')
                try:
                    encoded = text[:-1].encode('ascii')
                    b = base64.b64decode(encoded, validate=True)
                except (ValueError, UnicodeError) as e:
                    raise ReadbackError('invalid strict base64') from e
                _check(base64.b64encode(b) == encoded and len(b) == length, 'chunk length/encoding')
                f.seek(off); _check(f.write(b) == length, 'local short write')
                completed += 1; progress = True
            if not progress and active:
                time.sleep(min(.002, remaining()))
        after = _metadata(one(_metadata_code(source)))
        _check(before == after, 'immutable metadata changed')
        f.flush(); f.seek(0)
        digest = hashlib.file_digest(f, 'sha256').hexdigest()
        _check(os.fstat(f.fileno()).st_size == size and digest == before['sha256'], 'final size/SHA256')
        os.fsync(f.fileno()); f.close(); f = None
        remaining()
        os.replace(temporary, destination); temporary = None
        return dict(before, chunks=completed, maxActive=peak)
    finally:
        # cancel is bounded, including SIGKILL/reap for owned subprocess jobs.
        # Attempt every cleanup even if a particular executor's cancel fails.
        errors = []
        for job in list(active):
            try:
                job.cancel()
            except Exception as e:
                errors.append(e)
        if f is not None:
            f.close()
        if temporary is not None:
            pathlib.Path(temporary).unlink(missing_ok=True)
        if errors:
            raise ReadbackError('owned reader cleanup failed') from errors[0]


# Run the exact embedded owner with only its required standard-library imports.
# -S avoids site initialization for each of up to four concurrent owners.
_TRANSPORT_SUPERVISOR = r'''
import ctypes,os,select,signal,sys,time

def _supervise_transport(control_fd, argv):
    """Linux per-request subreaper; session changes cannot transfer ownership.

    Never set subreaper state in the importing application. Only this dedicated
    process adopts orphaned descendants, so waitpid/children never name another
    request's children. A private control pipe also closes when the caller dies.
    """
    libc = ctypes.CDLL(None, use_errno=True)
    if libc.prctl(36, 1, 0, 0, 0) != 0:  # PR_SET_CHILD_SUBREAPER
        raise OSError(ctypes.get_errno(), 'transport subreaper unavailable')
    child = None; status = None
    try:
        if select.select([control_fd], [], [], 0)[0]:
            return 1  # Caller canceled during supervisor startup.
        child = os.fork()
        if child == 0:
            os.close(control_fd)
            try: os.execvp(argv[0], argv)
            finally: os._exit(127)
        while True:
            pid, raw_status = os.waitpid(child, os.WNOHANG)
            if pid:
                status = os.waitstatus_to_exitcode(raw_status)
                break
            if select.select([control_fd], [], [], .002)[0]:
                break
    finally:
        # Kill only direct children. Killing a parent reparents even double-fork
        # descendants here; repeat until waitpid confirms no owned child exists.
        # pidfds bind signals to an identity rather than a reusable numeric PID.
        children = f'/proc/self/task/{os.getpid()}/children'
        def owned():
            with open(children) as f: return f.read().split()
        while True:
            try:
                pid, _ = os.waitpid(-1, os.WNOHANG)
            except ChildProcessError:
                break
            if pid:
                continue
            for pid in map(int, owned()):
                try:
                    fd = os.pidfd_open(pid)
                except ProcessLookupError:
                    continue
                try:
                    if str(pid) in owned():
                        signal.pidfd_send_signal(fd, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                finally:
                    os.close(fd)
            time.sleep(.001)
        os.close(control_fd)
    return status if status is not None and status >= 0 else 1


raise SystemExit(_supervise_transport(int(sys.argv[1]), sys.argv[2:]))
'''


class _ProcessJob:
    def __init__(self, argv):
        # Fail closed where identity-safe Linux ownership is unavailable.
        _check(sys.platform == 'linux' and hasattr(os, 'pidfd_open') and
               hasattr(signal, 'pidfd_send_signal'), 'transport ownership unavailable')
        control_read, self.control_write = os.pipe()
        try:
            self.process = subprocess.Popen(
                [sys.executable, '-S', '-c', _TRANSPORT_SUPERVISOR,
                 str(control_read), *argv],
                stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                stderr=subprocess.PIPE, start_new_session=True,
                pass_fds=(control_read,))
        except BaseException:
            os.close(self.control_write)
            raise
        finally:
            os.close(control_read)
        self.buffers = [bytearray(), bytearray()]
        self.streams = [self.process.stdout, self.process.stderr]
        self.eof = set(); self.closed = False
        for stream in self.streams:
            os.set_blocking(stream.fileno(), False)

    def poll(self):
        for i, stream in enumerate(self.streams):
            if i in self.eof:
                continue
            # One bounded read per stream per poll; never accumulate unbounded
            # output and never block on a child holding a pipe open.
            try:
                b = os.read(stream.fileno(), RESPONSE_LIMIT+1)
            except BlockingIOError:
                continue
            if not b:
                self.eof.add(i)
            self.buffers[i].extend(b)
            _check(sum(map(len, self.buffers)) <= RESPONSE_LIMIT, 'full API output ceiling')
        status = self.process.poll()
        if status is None or len(self.eof) != 2:
            return None
        _check(status == 0 and not self.buffers[1], 'API process error/denial')
        return bytes(self.buffers[0])

    def cancel(self):
        if self.closed:
            return
        # EOF asks the dedicated owner to kill/reap every descendant. Do not
        # kill that owner first: it retains children across setsid/double-fork.
        os.close(self.control_write)
        try:
            self.process.wait(timeout=.25)
        finally:
            for stream in self.streams:
                stream.close()
            self.closed = True


class SubprocessExecutor:
    """argv_factory(code, remaining) returns structured argv, with no local shell.

    No retry, alternate route, guest controls or global process monkeypatching.
    This must only be used where parallel read-only calls are permitted.
    """
    def __init__(self, argv_factory):
        self.argv_factory = argv_factory

    def start(self, code, remaining):
        return _ProcessJob(self.argv_factory(code, remaining))
