"""Opt-in Q3 owning-parent diagnostic adapter. No deadline or custody changes.

compose_remote_launch/bind_remote substitute for q3-cancellation-stream-eof's
same APIs. Stage and pin this NEW provider explicitly in a future reviewed
closure; existing migration manifests are not modified. wait_checkpoint replaces
only the caller's exists/read polling, using its already fixed monotonic deadline.
Publication snapshots are observations, never readiness/CDP/custody receipts.
"""
import gzip
import hashlib
import json
import math
import os
from pathlib import Path
import runpy
import stat
import time

LIMIT = 65536


def publication(path):
    """Bounded nonblocking, no-follow read; absent/partial/damage stay distinct."""
    try:
        fd = os.open(path, os.O_RDONLY | os.O_NONBLOCK | os.O_NOFOLLOW)
    except FileNotFoundError:
        return dict(state='missing')
    except OSError as error:
        return dict(state='unreadable', errno=error.errno)
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode):
            return dict(state='nonregular')
        raw = os.read(fd, LIMIT + 1)
        if len(raw) > LIMIT or info.st_size > LIMIT:
            return dict(state='oversize', size=info.st_size)
    finally:
        os.close(fd)
    value = dict(size=len(raw), sha256=hashlib.sha256(raw).hexdigest())
    try:
        if str(path).endswith('.gz'):
            # Bound decompression too, including multi-member gzip inputs.
            import io
            with gzip.GzipFile(fileobj=io.BytesIO(raw)) as stream:
                data = stream.read(LIMIT + 1)
            if len(data) > LIMIT:
                return dict(state='expanded-oversize', **value)
        else:
            data = raw
        text = data.decode('utf8')
        if '.jsonl' in str(path):
            if not text.endswith('\n'):
                return dict(state='partial', **value)
            rows = [json.loads(line) for line in text.splitlines()]
            parsed = rows[-1] if rows else None
        else:
            parsed = json.loads(text)
        if not isinstance(parsed, dict):
            return dict(state='invalid-shape', **value)
        return dict(state='published', value=parsed, **value)
    except (ValueError, UnicodeError, EOFError, OSError):
        return dict(state='partial-or-damaged', **value)


class Journal:
    """Append-only fsynced, exclusive journal: 128 records and <= 1 MiB total."""
    def __init__(self, path):
        self.fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        self.count = self.size = 0
        self.last = {}
        self.closed = False

    def emit(self, kind, **data):
        if self.closed:
            raise RuntimeError('diagnostic journal closed')
        row = dict(sequence=self.count, at=time.time(), monotonic=time.monotonic(),
                   kind=kind, **data)
        raw = (json.dumps(row, separators=(',', ':'))+'\n').encode()
        if self.count >= 127 or self.size + len(raw) > 1000000:
            raw = (json.dumps(dict(sequence=self.count, kind='diagnostic-cap',
                                  completeness='INCOMPLETE'))+'\n').encode()
            os.write(self.fd, raw); os.fsync(self.fd)
            self.close()
            raise RuntimeError('Q3 checkpoint diagnostic cap; no replay')
        # Regular-file writes can be short. A damaged journal is never success.
        while raw:
            written = os.write(self.fd, raw)
            if written <= 0:
                raise OSError('short diagnostic write')
            self.size += written
            raw = raw[written:]
        os.fsync(self.fd)
        self.count += 1

    def snapshot(self, run, output):
        for base, names in ((Path(run), ('runtime-target.json.gz', 'kernel-armed.json',
                                        'caller-cancelled.json', 'caller-cancel-sent.json')),
                            (Path(output), ('process.json', 'startup-browser.jsonl.gz',
                                            'endpoint.json', 'startup-admission.json',
                                            'first-browser-failure.json', 'cancellation-ready.json'))):
            for name in names:
                key = str(base/name)
                value = publication(base/name)
                if self.last.get(key) != value:
                    self.emit('publication-observed', path=key, observation=value,
                              readiness='UNKNOWN', browserEOF='UNKNOWN')
                    self.last[key] = value

    def close(self):
        if not self.closed:
            os.close(self.fd)
            self.closed = True


def wait_checkpoint(run, output, deadline, journal, check=lambda: None, poll=.02):
    """Absolute caller deadline, first failure/cancel checked BEFORE checkpoint.

    Return the raw checkpoint object only; caller's existing qualification and
    physical gate remain mandatory. Partial publication never counts as ready.
    """
    if not math.isfinite(deadline) or not math.isfinite(poll) or poll <= 0:
        raise ValueError('finite checkpoint deadline/poll required')
    journal.emit('checkpoint-observer-start', deadline=deadline)
    while True:
        check()  # Existing owning Session.check, not a second terminal authority.
        journal.snapshot(run, output)
        for base, name in ((run, 'caller-cancelled.json'),
                           (output, 'first-browser-failure.json'),
                           (output, 'first-failure.json')):
            observed = publication(Path(base)/name)
            if observed['state'] != 'missing':
                journal.emit('checkpoint-terminal', reason=name, observation=observed)
                raise RuntimeError('Q3 checkpoint terminal: '+name+'; no replay')
        if time.monotonic() >= deadline:
            observed = publication(Path(output)/'cancellation-ready.json')
            journal.emit('checkpoint-observation-deadline', checkpoint=observed,
                         browserReadiness='UNKNOWN', browserEOF='UNKNOWN')
            raise TimeoutError('Q3 checkpoint observation deadline: '+observed['state']+'; no replay')
        observed = publication(Path(output)/'cancellation-ready.json')
        if observed['state'] == 'published':
            # Publication alone cannot qualify native cancellation.
            value = observed['value']
            if (value.get('nativeQualified') is not False or value.get('waitMs') != 10000
                    or not isinstance(value.get('at'), str)):
                journal.emit('checkpoint-invalid', observation=observed)
                raise ValueError('invalid Q3 checkpoint publication; no replay')
            check()
            if time.monotonic() >= deadline:
                continue
            journal.emit('checkpoint-observed', observation=observed, nativeQualified=False)
            return value
        time.sleep(min(poll, max(0, deadline-time.monotonic())))


def spawn(run, argv, **options):
    """At the actual owning Popen boundary, before any child exists."""
    import subprocess
    journal = Journal(Path(run)/'checkpoint-spawn.ndjson')
    try:
        journal.emit('prelaunch-spawn-intent', argv=argv, parent=os.getpid())
        try:
            child = subprocess.Popen(argv, **options)
        except BaseException as error:
            journal.emit('prelaunch-spawn-failed', error=str(error))
            raise
        # Do not perform fallible diagnostic I/O after acquiring ownership of a
        # child here. drain_remote owns its wait and subsequent observations.
        return child
    finally:
        journal.close()


def drain_remote(process, run, log, requested, output, owner):
    helper = runpy.run_path(str(Path(__file__).with_name('q3-cancellation-stream-eof.py')))
    original = helper['drain_streams']
    journal = None
    failures = []
    def diagnostic(kind=None, **data):
        try:
            if kind:
                journal.emit(kind, **data)
            else:
                journal.snapshot(run, output)
        except BaseException as error:
            if not failures:
                failures.append(error)
                owner['cancel_remote'](run, output)
    try:
        try:
            journal = Journal(Path(run)/'checkpoint-launch.ndjson')
            diagnostic('prelaunch-spawn-observed', pid=process.pid,
                       start=Path('/proc', str(process.pid), 'stat').read_text().rsplit(')', 1)[1].split()[19])
        except BaseException as error:
            failures.append(error)
            owner['cancel_remote'](run, output)
        def drain(child, stream, tick=lambda: None):
            def progression():
                tick()  # Preserve original identity-bound cancellation and sole wait.
                if not failures:
                    diagnostic()
            return original(child, stream, progression)
        helper['drain_remote'].__globals__['drain_streams'] = drain
        result = helper['drain_remote'](process, run, log, requested, output, owner)
        if not failures:
            diagnostic()  # Final publication can race the last pipe read.
        if not failures:
            diagnostic('prelaunch-actual-wait', **result, browserEOF='UNKNOWN')
        # A diagnostic failure revokes input immediately, but never abandons the
        # owning drain/actual wait. Report it after existing custody settles.
        if failures:
            receipt = Journal(Path(run)/'checkpoint-diagnostic-wait.ndjson')
            try:
                receipt.emit('diagnostic-failed-after-actual-wait', **result,
                             firstError=str(failures[0]), browserEOF='UNKNOWN')
            finally:
                receipt.close()
            raise RuntimeError('Q3 checkpoint diagnostic failed; actual drain completed: '+str(failures[0]))
        return result
    finally:
        if journal:
            journal.close()


def compose_remote_launch(code, root, output):
    """Compose the actual generated parent, refuse drift; no active file edits."""
    helper = runpy.run_path(str(Path(root)/'tools/q3-cancellation-stream-eof.py'))
    code = helper['compose_remote_launch'](code, root, output)
    before = "_q3_eof=runpy.run_path("+repr(str(Path(root)/'tools/q3-cancellation-stream-eof.py'))+")"
    if code.count(before) != 1:
        raise ValueError('unsupported Q3 checkpoint launch parent')
    code = code.replace(before, "_q3_eof=runpy.run_path("+repr(str(Path(root)/'tools/q3-checkpoint-observer.py'))+")")
    spawn_call = 'p=subprocess.Popen('
    if code.count(spawn_call) != 1:
        raise ValueError('unsupported Q3 checkpoint spawn boundary')
    code = code.replace(spawn_call, "p=runpy.run_path("+repr(str(Path(root)/'tools/q3-checkpoint-observer.py'))+")['spawn'](r,")
    compile(code, '<q3-checkpoint-parent>', 'exec')
    return code


def bind_remote(task, session):
    owner = runpy.run_path(str(Path(task['REMOTE'])/'tools/q3-native-launch-client.py'))
    owner['bind_remote'].__globals__['compose_remote_launch'] = compose_remote_launch
    owner['bind_remote'](task, session)


def checkpoint_code(root, run, output):
    """Actual caller replacement for retained1475's remote checkpoint poll.

    Same 60s checkpoint observation / 70s transport cap; neither is the browser
    readiness deadline. Keep the run-scoped cancellation channel and owning
    Session.check at the caller. This code starts no process and emits no CDP.
    """
    return ("import runpy,time,json\nfrom pathlib import Path\n"
            "m=runpy.run_path("+repr(str(Path(root)/'tools/q3-checkpoint-observer.py'))+")\n"
            "deadline=time.monotonic()+60\n"
            "j=m['Journal'](Path("+repr(str(run))+ ")/'checkpoint-observer.ndjson')\n"
            "try:\n v=m['wait_checkpoint']("+repr(str(run))+","+repr(str(output))+",deadline,j)\n"
            " print(json.dumps(v),flush=True)\nfinally:j.close()\n")


def observe_checkpoint(task, session, remote):
    """Use alongside bind_remote; preserve the owning first terminal."""
    session.check()
    code = checkpoint_code(task['REMOTE'], Path(task['REMOTE'])/task['c'].RUN, task['OUT'])
    try:
        result = json.loads(remote('cancellation-native-checkpoint', code, 70))
        session.check()
        return result
    except BaseException as error:
        raise session.fail(str(error)) from error
