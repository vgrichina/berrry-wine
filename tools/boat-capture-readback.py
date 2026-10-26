#!/usr/bin/env python3
"""Bounded readback of an already frozen file; never sends guest controls.

Executor.start(code, remaining) must return a job with nonblocking poll() and
bounded cancel(). poll returns the complete *raw API response*, or None while
pending. Each job owns one stateless read-only request; no retries are allowed.
SubprocessExecutor implements this contract without unkillable worker threads.
"""
import base64
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
            # Also close process-group descendants after a successful response.
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


class _ProcessJob:
    def __init__(self, argv):
        self.process = subprocess.Popen(argv, stdin=subprocess.DEVNULL,
                                        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                        start_new_session=True)
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
        try:
            os.killpg(self.process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
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
