"""Q3's authenticated custody adapter: batch until the existing CONT barrier.

The published supervisor still owns all identities, waits and releases. Every
executable CONT retains its complete, fsynced journal prefix. Logging each
intermediate stop separately used to fsync repeatedly with Chrome stopped.
Irreversible retirement, saturation, failure and finalization stay unchanged.
"""
import hashlib
from pathlib import Path
import time
import types

PROVIDER_SHA = '3448afd4c5ec4ea691c584a6cfde3a61b72f5c9143458189c1035f374c4c6240'
VERSION = 'q3-startup-custody-prefix-v1'


def candidate(source):
    if hashlib.sha256(source.encode()).hexdigest() != PROVIDER_SHA:
        raise ValueError('Q3 published custody drift')
    before = 'defer=retirement or diagnostic)'
    if source.count(before) != 1:
        raise ValueError('Q3 custody log seam')
    # There is no userspace admission between these records. The unchanged
    # supervisor flushes the entire ordered prefix immediately before CONT.
    return source.replace(before, 'defer=True)')


def load():
    filename = Path(__file__).with_name('native_kernel_custody.py')
    module = types.ModuleType('q3_startup_custody_prefix')
    module.__file__ = str(filename)
    exec(compile(candidate(filename.read_text()), str(filename), 'exec'), module.__dict__)
    return module


def supervise(run, command, **options):
    module = load()
    # Timing is observation of this tracer's journal service, not browser or
    # wire timing. Bound retained detail while retaining aggregate totals.
    write = module.Journal.write
    timing = dict(version=VERSION, clock='Python monotonic_ns', writes=0,
                  totalNs=0, maxNs=0, samples=[])

    def measured(journal, data):
        start = time.monotonic_ns()
        try:
            return write(journal, data)
        finally:
            elapsed = time.monotonic_ns() - start
            timing['writes'] += 1
            timing['totalNs'] += elapsed
            timing['maxNs'] = max(timing['maxNs'], elapsed)
            if len(timing['samples']) < 1024:
                timing['samples'].append(dict(startNs=start, elapsedNs=elapsed,
                                              bytes=len(data), journal=journal.path.name))
    module.Journal.write = measured
    try:
        return module.supervise(run, command, **options)
    finally:
        # An observation failure must not replace the supervisor's first error.
        try:
            import json
            with (Path(run)/'q3-custody-service.json').open('x') as stream:
                json.dump(timing, stream)
        except Exception:
            pass
