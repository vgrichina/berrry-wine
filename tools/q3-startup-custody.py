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
import json
import os

PROVIDER_SHA = '3448afd4c5ec4ea691c584a6cfde3a61b72f5c9143458189c1035f374c4c6240'
VERSION = 'q3-startup-custody-input-service-v2'


def candidate(source):
    if hashlib.sha256(source.encode()).hexdigest() != PROVIDER_SHA:
        raise ValueError('Q3 published custody drift')
    before = 'defer=retirement or diagnostic)'
    if source.count(before) != 1:
        raise ValueError('Q3 custody log seam')
    # There is no userspace admission between these records. The unchanged
    # supervisor flushes the entire ordered prefix immediately before CONT.
    source = source.replace(before, 'defer=True)')
    begin = source.index('        # Bound each pump')
    end = source.index('    wait_flags =', begin)
    # Command bytes have no admission semantics. Batch within the existing
    # 1 MiB journal bound, and yield without disk service when a real kernel
    # wait becomes ready. close() still durably flushes every byte. Custody
    # records and every executable CONT barrier are completely unchanged.
    return source[:begin] + '''        def stop_ready():
            try:
                return os.waitid(os.P_ALL, 0, os.WEXITED|os.WSTOPPED|os.WNOHANG|os.WNOWAIT|WALL) is not None
            except ChildProcessError:
                return False
        for _ in range(16):
            if stop_ready(): return
            if len(command_log.pending) + 65536 > command_log.MAX_PENDING_BYTES: break
            try: data = os.read(read_fd, 65536)
            except BlockingIOError: break
            if not data:
                output_eof = True
                break
            command_log.pending.extend(data)
            command_log.pending_records += 1
        if not stop_ready(): command_log.flush_pending()
''' + source[end:]


def load():
    filename = Path(__file__).with_name('native_kernel_custody.py')
    module = types.ModuleType('q3_startup_custody_prefix')
    module.__file__ = str(filename)
    exec(compile(candidate(filename.read_text()), str(filename), 'exec'), module.__dict__)
    return module


def supervise(run, command, **options):
    module = load()
    run = Path(run)
    # Input-phase evidence is armed by the actual reviewed fixture caller.
    # No record capacity or role sampling is spent on startup. This observes
    # real waited tasks and syscall entries; it cannot establish a browser's
    # semantic request dependency by itself.
    phase = dict(limit=512, records=[], dropped=0, armed=None, error=None)
    arm = run / 'input-service-arm.json'
    def observe(kind, **fields):
        try:
            if phase['armed'] is None:
                if not arm.exists(): return
                phase['armed'] = json.loads(arm.read_bytes())
            now = time.monotonic_ns()
            if now > int(phase['armed']['monotonicNs']) + 5_000_000_000: return
            if len(phase['records']) >= phase['limit']:
                phase['dropped'] += 1
                return
            phase['records'].append(dict(kind=kind, monotonicNs=now,
                                         epochNs=time.time_ns(), **fields))
        except Exception as error:
            phase['error'] = phase['error'] or repr(error)

    def role(pid):
        try:
            row = module.identity(pid)
            proc = Path('/proc', str(pid))
            row.update(cmdline=proc.joinpath('cmdline').read_bytes().replace(b'\0', b' ').decode(errors='replace'),
                       comm=proc.joinpath('comm').read_text().strip(),
                       wchan=proc.joinpath('wchan').read_text().strip())
            return row
        except OSError as error:
            return dict(pid=pid, unavailable=repr(error))

    trace, waitpid, sync = module.ptrace, module.os.waitpid, module.os.fsync
    def traced(request, pid, addr=0, data=0):
        active = arm.exists()
        error = None
        if active and request == module.CONT:
            observe('CONT-entry', task=role(pid), signal=data)
        try:
            return trace(request, pid, addr, data)
        except BaseException as failure:
            error = repr(failure)
            raise
        finally:
            if active and request == module.CONT: observe('CONT-return', pid=pid, error=error)
    def waited(pid, flags):
        result = waitpid(pid, flags)
        if result[0] and arm.exists():
            observe('waitpid-return', task=role(result[0]), status=result[1])
        return result
    def synced(fd):
        start = time.monotonic_ns()
        epoch = time.time_ns()
        error = None
        observe('fsync-entry', fd=fd)
        try: return sync(fd)
        except BaseException as failure:
            error = repr(failure)
            raise
        finally:
            observe('fsync-return', fd=fd, startMonotonicNs=start, startEpochNs=epoch,
                    elapsedNs=time.monotonic_ns()-start, error=error)
    module.ptrace = traced
    module.os.waitpid = waited
    module.os.fsync = synced
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
        module.os.waitpid = waitpid
        module.os.fsync = sync
        # An observation failure must not replace the supervisor's first error.
        try:
            with (Path(run)/'q3-custody-service.json').open('x') as stream:
                json.dump(timing, stream)
            with (Path(run)/'q3-input-service.json').open('x') as stream:
                json.dump(phase, stream)
        except Exception:
            pass
