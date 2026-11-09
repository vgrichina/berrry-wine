"""Nox-only, bounded observation of the unchanged published kernel supervisor.

Measure synchronous journal/fsync service and actual ptrace return times. No timers,
extra waits, logger processes, or changes to custody/admission/deadlines. The
measurements include descheduling during calls, not isolated device latency.
"""
import hashlib
import json
import time
import types
from pathlib import Path

PROVIDER_SHA = '3448afd4c5ec4ea691c584a6cfde3a61b72f5c9143458189c1035f374c4c6240'
LIMIT = 4096


def load():
    filename = Path(__file__).with_name('native_kernel_custody.py')
    source = filename.read_bytes()
    if hashlib.sha256(source).hexdigest() != PROVIDER_SHA:
        raise ValueError('Nox published custody drift')
    module = types.ModuleType('nox_observed_custody')
    module.__file__ = str(filename)
    exec(compile(source, str(filename), 'exec'), module.__dict__)
    return module


def supervise(run, command, **options):
    module = load()
    timing = dict(version=1, observationalOnly=True, providerSha256=PROVIDER_SHA,
                  clock='Linux CLOCK_MONOTONIC / monotonic_ns',
                  startedNs=time.monotonic_ns(), wallTime=time.time(), limit=LIMIT,
                  writes=0, writeNs=0, maxWriteNs=0, writeSamples=[],
                  fsyncCalls=0, fsyncNs=0, fsyncSamples=[], droppedFsync=0,
                  ptraceCalls=0, ptraceSamples=[], droppedWrites=0, droppedPtrace=0)
    write, ptrace, original_os = module.Journal.write, module.ptrace, module.os

    def measured_fsync(fd):
        begin = time.monotonic_ns()
        failed = False
        try:
            return original_os.fsync(fd)
        except BaseException:
            failed = True
            raise
        finally:
            end = time.monotonic_ns()
            timing['fsyncCalls'] += 1
            timing['fsyncNs'] += end - begin
            if len(timing['fsyncSamples']) < LIMIT:
                timing['fsyncSamples'].append(dict(beginNs=begin, endNs=end, fd=fd, failed=failed))
            else:
                timing['droppedFsync'] += 1

    class ObservedOS:
        # Isolate the observation to this supervisor, leaving the process-wide
        # os module and every operation other than this call unchanged.
        def __getattr__(self, name):
            return getattr(original_os, name)

        fsync = staticmethod(measured_fsync)

    module.os = ObservedOS()

    def measured_write(journal, data):
        begin = time.monotonic_ns()
        failed = False
        try:
            return write(journal, data)
        except BaseException:
            failed = True
            raise
        finally:
            end = time.monotonic_ns()
            timing['writes'] += 1
            timing['writeNs'] += end - begin
            timing['maxWriteNs'] = max(timing['maxWriteNs'], end - begin)
            if len(timing['writeSamples']) < LIMIT:
                timing['writeSamples'].append(dict(beginNs=begin, endNs=end,
                    bytes=len(data), journal=journal.path.name, failed=failed))
            else:
                timing['droppedWrites'] += 1

    def measured_ptrace(request, pid, addr=0, data=0):
        begin = time.monotonic_ns()
        failed = False
        try:
            return ptrace(request, pid, addr, data)
        except BaseException:
            failed = True
            raise
        finally:
            end = time.monotonic_ns()
            timing['ptraceCalls'] += 1
            if len(timing['ptraceSamples']) < LIMIT:
                timing['ptraceSamples'].append(dict(beginNs=begin, endNs=end,
                    request=request, pid=pid, data=data if request == module.CONT else None,
                    failed=failed))
            else:
                timing['droppedPtrace'] += 1

    module.Journal.write = measured_write
    module.ptrace = measured_ptrace
    try:
        return module.supervise(run, command, **options)
    finally:
        timing['finishedNs'] = time.monotonic_ns()
        # Observation must preserve the supervisor's first error, including a
        # sticky journal failure or deadline refusal. Nothing here admits work.
        try:
            with (Path(run) / 'nox-custody-timing.json').open('x') as stream:
                json.dump(timing, stream)
        except Exception:
            pass
