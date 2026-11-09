#!/usr/bin/env python3
"""Redline's explicit bounded diagnostic adapter for exact published custody.

Ownership admission still persists the complete journal prefix before CONT.
Syscall stops of already admitted tasks carry diagnostics, not new ownership.
Those diagnostics use bounded batches; exhaustion returns to ordinary custody
without claiming a complete syscall observation. Intermediate custody records
also batch until the existing executable-CONT barrier, as in the authenticated
Q3 durable-prefix repair. No closure check or executable barrier is changed.
"""
import hashlib
import time
import json
import os
from pathlib import Path
import sys

import native_publication_launch as published

VERSION = 'redline-bounded-custody-v1'
LAUNCHER_SHA = '3dc65b811a9b73a85fa5c4f9482d8a063865d397994e8160e08c51985f5f7d89'


class StartupService:
    """Bounded passive service timings; no periodic IO or extra ptrace stops.

    Roles are snapshots at consumed waits, never ownership/lineage evidence.
    Call durations include descheduling; thread CPU is retained separately.
    """
    current = None
    MAX_RECORDS = 32768
    MAX_BYTES = 8 * 1024 * 1024

    def __init__(self, run):
        self.run = Path(run)
        self.rows = []
        self.size = self.dropped = 0
        self.context = {}
        self.totals = {}
        StartupService.current = self

    def retain(self, row):
        data = json.dumps(row, separators=(',', ':'))
        if len(self.rows) >= self.MAX_RECORDS or self.size + len(data) > self.MAX_BYTES:
            self.dropped += 1
            return
        self.rows.append(row)
        self.size += len(data)

    def call(self, name, fn, *args, **kwargs):
        start = time.monotonic_ns(); cpu = time.thread_time_ns()
        error = None
        try:
            return fn(*args, **kwargs)
        except BaseException as e:
            error = type(e).__name__
            raise
        finally:
            end = time.monotonic_ns(); cost = time.thread_time_ns() - cpu
            total = self.totals.setdefault(name, dict(calls=0, wallNs=0, cpuNs=0))
            total['calls'] += 1; total['wallNs'] += end-start; total['cpuNs'] += cost
            self.retain(dict(kind='service', service=name, beginNs=start, endNs=end,
                             cpuNs=cost, error=error, **self.context))

    @classmethod
    def sync(cls, fd):
        current = cls.current
        if current is None:
            return os.fsync(fd)
        return current.call('fsync', os.fsync, fd)

    def role(self, task, start, sequence, status):
        self.context = dict(pid=task, start=start, waitSequence=sequence, waitStatus=status)
        begin = time.monotonic_ns()
        p = Path('/proc') / str(task)
        role = {}
        try:
            # Snapshot is bound to the already consumed identity, with a second
            # start-time read. A vanished task retains the failed read explicitly.
            role['comm'] = (p/'comm').read_text()[:64].strip()
            role['exe'] = os.readlink(p/'exe')[:512]
            role['cmdlineHex'] = (p/'cmdline').read_bytes()[:2048].hex()
            stat = (p/'stat').read_text()
            role['observedStart'] = stat[stat.rfind(')')+2:].split()[19]
            role['identityMatches'] = role['observedStart'] == start
        except OSError as e:
            role['errno'] = e.errno
        self.retain(dict(kind='role', beginNs=begin, endNs=time.monotonic_ns(),
                         snapshotOnly=True, **self.context, **role))

    def close(self):
        value = dict(version=1, clock='monotonic_ns; thread_time_ns',
                     anchor=dict(monotonicNs=time.monotonic_ns(), unixNs=time.time_ns()),
                     rows=self.rows, totals=self.totals, dropped=self.dropped,
                     maxRecords=self.MAX_RECORDS, maxBytes=self.MAX_BYTES,
                     observationOnly=True, durationsIncludeDescheduling=True)
        data = json.dumps(value).encode()
        # Only finalization writes this separate diagnostic. No diagnostic IO
        # is inserted before CONT or into the durable custody prefix.
        with (self.run/'startup-service.json').open('xb') as out:
            out.write(data)
            out.flush()
            os.fsync(out.fileno())
        StartupService.current = None


def adapt(helper, source, **options):
    candidate = helper.candidate(source, **options)
    if not options.get('enabled'):
        return candidate

    def replace(before, after):
        nonlocal candidate
        if candidate.count(before) != 1:
            raise ValueError('bounded custody anchor mismatch: '+before)
        candidate = candidate.replace(before, after)

    replace("diagnostic = kind in ('wait-consumed', 'kernel-event-message',\n"
            "                              'creation-peek-message', 'ptrace-cont-returned')",
            "diagnostic = kind in ('wait-consumed', 'kernel-event-message',\n"
            "                              'creation-peek-message', 'ptrace-cont-returned',\n"
            "                              'ptrace-syscall-resume-returned') or (\n"
            "            kind == 'before-consume' and value.get('siStatus') == (signal.SIGTRAP | 128))")
    replace('actual_request = SYSCALL if request == CONT and task not in exiting else request',
            'actual_request = SYSCALL if request == CONT and task not in exiting and not observer.exhausted() else request')
    # helper.candidate first authenticates the exact shared provider. There is
    # no executable admission between these intermediate records and the
    # full-prefix barriers. Journal saturation still synchronously flushes;
    # sticky errors and finalization remain byte identical.
    replace('defer=retirement or diagnostic)', 'defer=True)')
    # First observation may already be an unlinked irreversible EXIT. Its new
    # custody identity must be durable too, even though it cannot execute guest
    # userspace. Flush every actual CONT outside the ESRCH-catching try block.
    # Pure syscall stepping keeps the existing bounded diagnostic behavior.
    replace('    def trace_task(request, task, data=0):\n'
            '        try:\n'
            '            actual_request = SYSCALL if request == CONT and task not in exiting and not observer.exhausted() else request\n',
            '    def trace_task(request, task, data=0):\n'
            '        actual_request = SYSCALL if request == CONT and task not in exiting and not observer.exhausted() else request\n'
            '        if actual_request == CONT:\n'
            '            journal.flush_pending()\n'
            '            observer.flush_pending()\n'
            '        try:\n')
    replace('                journal.flush_pending() # ordered durable prefix before executable userspace',
            '                # Pure syscall continuation admits no new owned identity.\n'
            '                # Every other release retains the published durable barrier.\n'
            '                if consumed_waits[task]["status"] != ((signal.SIGTRAP | 128) << 8 | 0x7f):\n'
            '                    journal.flush_pending()\n'
            '                    observer.flush_pending()')
    # Inline the lane-only observer into the authenticated generated consumer.
    # No shared module is changed and all existing barriers remain in place.
    replace('def supervise(run, command,', 'class StartupService:' + Path(__file__).read_text().split('\nclass StartupService:', 1)[1].split('\ndef adapt(', 1)[0]+'\ndef supervise(run, command,')
    replace('    journal = Journal(run, journal_compression)\n',
            '    service = StartupService(run)\n'
            '    journal = Journal(run, journal_compression)\n')
    replace('            self.stream.write(data); self.stream.flush()\n            self.raw.flush(); os.fsync(self.raw.fileno())',
            '            self.stream.write(data); self.stream.flush()\n            self.raw.flush(); StartupService.sync(self.raw.fileno())')
    replace('\n    retirement = False\n', '\n    observer.service = service\n    retirement = False\n')
    replace('    def trace_task(request, task, data=0):\n',
            '    def trace_task(request, task, data=0):\n'
            '        service.context = dict(pid=task, start=owned[task]["start"], request=request, waitSequence=consumed_waits.get(task, {}).get("sequence"))\n')
    replace('                # Pure syscall continuation admits no new owned identity.\n',
            '                service.context = dict(pid=task, start=start, waitSequence=consumed_waits[task]["sequence"])\n'
            '                # Pure syscall continuation admits no new owned identity.\n')
    replace('            peek = priority_wait()\n',
            '            peek = service.call("priority-wait", priority_wait)\n')
    replace('            ptrace(actual_request, task, data=data)\n',
            '            service.context = dict(pid=task, start=owned[task]["start"], request=actual_request, waitSequence=consumed_waits.get(task, {}).get("sequence"))\n'
            '            service.call("ptrace", ptrace, actual_request, task, data=data)\n')
    replace('            if os.WIFEXITED(status) or os.WIFSIGNALED(status):\n',
            '            service.role(task, row["start"], consumed_waits[task]["sequence"], status)\n'
            '            if os.WIFEXITED(status) or os.WIFSIGNALED(status):\n')
    replace('        finally:\n            for sig, handler in handlers.items(): signal.signal(sig, handler)\n',
            '        finally:\n            for sig, handler in handlers.items(): signal.signal(sig, handler)\n'
            '            try: service.close()\n'
            '            except BaseException:\n'
            '                if journal_error is None and command_error is None: raise\n')
    return candidate


def bounded_observer(original):
    class BoundedObserver(original):
        MAX_PENDING_BYTES = 64 * 1024
        MAX_PENDING_RECORDS = 256

        def __init__(self, *args, **kwargs):
            self.buffer = bytearray()
            self.buffer_records = 0
            super().__init__(*args, **kwargs)

        def exhausted(self):
            return self.count >= self.limit-1 or 'byte-cap' in self.reasons

        def flush_pending(self):
            if not self.buffer:
                return
            offset = 0
            while offset < len(self.buffer):
                n = self.file.write(self.buffer[offset:])
                if not n:
                    raise OSError('observer short write')
                offset += n
            service = getattr(self, 'service', None)
            if service is None:
                os.fsync(self.file.fileno())
            else:
                service.call('observer-fsync', os.fsync, self.file.fileno())
            self.buffer.clear()
            self.buffer_records = 0

        def _write(self, data):
            if len(self.buffer)+len(data) > self.MAX_PENDING_BYTES:
                self.flush_pending()
            self.buffer.extend(data)
            self.buffer_records += 1
            self.digest = hashlib.sha256(data).hexdigest()
            self.count += 1
            self.size += len(data)
            if self.buffer_records >= self.MAX_PENDING_RECORDS or b'"kind": "end"' in data:
                self.flush_pending()

        def lifecycle(self, kind, row, sequence):
            super().lifecycle(kind, row, sequence)
            if kind in ('custody', 'fork-lineage', 'exec-identity-transfer'):
                self.flush_pending()

    return BoundedObserver


def launch(argv):
    if not argv or argv.pop(0) != '--bounded-custody='+VERSION:
        raise ValueError('explicit bounded custody version required')
    if hashlib.sha256(Path(published.__file__).read_bytes()).hexdigest() != LAUNCHER_SHA:
        raise ValueError('published launcher drift')
    # load_providers authenticates both published providers before execution.
    helper, source = published.load_providers()
    candidate = helper.candidate
    helper.Observer = bounded_observer(helper.Observer)
    def transformed(text, **options):
        from types import SimpleNamespace
        return adapt(SimpleNamespace(candidate=candidate), text, **options)
    helper.candidate = transformed
    published.load_providers = lambda: (helper, source)
    run = Path(argv[0]).resolve()
    with (run/'bounded-custody-adapter.json').open('x') as stream:
        json.dump(dict(version=VERSION, sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                       publishedLauncherSHA256=LAUNCHER_SHA, observerPendingBytes=64*1024,
                       observerPendingRecords=256, syscallCapReturnsToOrdinaryCustody=True,
                       ownershipAdmissionDurable=True, custodyPrefixBatched=True,
                       everyActualContDurable=True), stream)
    return published.launch(argv)


if __name__ == '__main__':
    try:
        sys.exit(launch(sys.argv[1:]))
    except Exception as error:
        print(type(error).__name__+': '+str(error), file=sys.stderr)
        sys.exit(1)
