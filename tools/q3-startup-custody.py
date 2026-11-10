"""Q3's authenticated custody adapter: durable release cohorts.

The published supervisor still owns all identities, waits and releases. Every
CONT requires the ordered prefix through every admission/identity/wait record.
Only results of already authorized releases may trail that durable frontier.
They remain ordered, bounded, sticky on failure, and durable at the next
required barrier or finalization. Ready stops share one durable release cohort.
"""
import hashlib
from pathlib import Path
import time
import types
import json
import os

# Retain deferred queue bookkeeping and cancellation recording verbatim.
# No queue operation supplies authority to execute a task.
PROVIDER_SHA = 'f8e6e8be352a20f668185c907fdcf4308f5cb93f8c6b8297fada063fc8140b77'
VERSION = 'q3-startup-custody-release-cohorts-v4'


def subcall_observer():
    """Bounded maker-side clocks; no telemetry I/O during journal service."""
    evidence = dict(limit=8192, records=[], dropped=0, totals={},
                    clocks=['monotonic_ns', 'thread_time_ns', 'time_ns'])

    def call(journal, stage, function, *args):
        start = time.monotonic_ns()
        cpu = time.thread_time_ns()
        epoch = time.time_ns()
        error = None
        try:
            return function(*args)
        except BaseException as failure:
            error = repr(failure)
            raise
        finally:
            end = time.monotonic_ns()
            end_cpu = time.thread_time_ns()
            total = evidence['totals'].setdefault(stage, dict(calls=0, wallNs=0, cpuNs=0, errors=0))
            total['calls'] += 1
            total['wallNs'] += end-start
            total['cpuNs'] += end_cpu-cpu
            total['errors'] += error is not None
            if len(evidence['records']) < evidence['limit']:
                evidence['records'].append(dict(journal=journal.path.name, stage=stage,
                    startNs=start, startEpochNs=epoch, wallNs=end-start,
                    cpuNs=end_cpu-cpu, error=error))
            else:
                evidence['dropped'] += 1
    return evidence, call


def candidate(source):
    if hashlib.sha256(source.encode()).hexdigest() != PROVIDER_SHA:
        raise ValueError('Q3 published custody drift')
    before = 'defer=retirement or diagnostic)'
    if source.count(before) != 1:
        raise ValueError('Q3 custody log seam')
    # There is no userspace admission between these records.
    source = source.replace(before, 'defer=True)')
    seam = '    def trace_task(request, task, data=0):\n'
    if source.count(seam) != 1:
        raise ValueError('Q3 common CONT barrier seam')
    source = source.replace(seam, seam + '        if request == CONT: journal.release_barrier()\n')
    replacements = {
        '            self.stream.write(data); self.stream.flush()\n            self.raw.flush(); os.fsync(self.raw.fileno())\n':
        """            _q3_subcall(self, 'stream.write', self.stream.write, data)
            _q3_subcall(self, 'stream.flush', self.stream.flush)
            _q3_subcall(self, 'raw.flush', self.raw.flush)
            _q3_subcall(self, 'fsync', os.fsync, self.raw.fileno())
""",
        '        self.error = None\n': '        self.error = None\n        self.release_required = False\n',
        "        data = (json.dumps(value)+'\\n').encode('utf-8')\n":
        """        # These are outcomes, never authority to run a stopped task. All
        # consumed waits (including terminal), identity, lineage, intents and
        # failures require a durable ordered prefix before another CONT.
        required = value.get('kind') not in ('ptrace-cont-returned', 'parked-child-release',
                                            'parked-child-release-pending')
        data = (json.dumps(value)+'\\n').encode('utf-8')
""",
        '        self.pending.extend(data); self.pending_records += 1\n':
        '        self.pending.extend(data); self.pending_records += 1\n        self.release_required |= required\n',
        '    def flush_pending(self):\n':
        """    def release_barrier(self):
        # Always consult sticky failure, even when the cohort is certified.
        if self.error is not None: raise OSError('journal service failed: '+self.error)
        if self.release_required: self.flush_pending()

    def flush_pending(self):
""",
        '            self.pending.clear(); self.pending_records = 0\n':
        '            self.pending.clear(); self.pending_records = 0\n            self.release_required = False\n',
        '            if peek is None and not resumes:\n':
        '            if peek is None:\n',
        '                if peek is None:\n                    pump_output()\n':
        '                if peek is None and not resumes:\n                    pump_output()\n',
        '                del resumes[task]\n': '',
        '                journal.flush_pending() # ordered durable prefix before executable userspace\n':
        '''                journal.release_barrier() # ordered durable prefix before executable userspace
                # Storage service may have blocked after the earlier scan.
                # A running creator can now have a pending fork event, or this
                # task's consumed stop can have been replaced by EXIT/EXEC.
                # Keep this resume queued so priority_wait checks it too; only
                # normal waitpid + GETEVENTMSG may bind the new kernel event.
                if priority_wait() is not None: continue
                del resumes[task]
''',
    }
    for old, new in replacements.items():
        if source.count(old) != 1: raise ValueError('Q3 release cohort seam: '+repr(old))
        source = source.replace(old, new)
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
    module.q3_subcalls, module._q3_subcall = subcall_observer()
    exec(compile(candidate(filename.read_text()), str(filename), 'exec'), module.__dict__)
    return module


def supervise(run, command, **options):
    module = load()
    run = Path(run)
    # Input-phase evidence is armed by the actual reviewed fixture caller.
    # No record capacity or role sampling is spent on startup. This observes
    # real waited tasks and syscall entries; it cannot establish a browser's
    # semantic request dependency by itself.
    inner, inner_call = subcall_observer()
    marker = types.SimpleNamespace(path=Path('input-service'))
    def measured_call(stage, function, *args):
        return inner_call(marker, stage, function, *args)

    phase = dict(limit=512, records=[], dropped=0, armed=None, error=None)
    arm = run / 'input-service-arm.json'
    def observe(kind, task_pid=None, **fields):
        try:
            if phase['armed'] is None:
                if not measured_call('phase.arm-exists', arm.exists): return
                phase['armed'] = json.loads(measured_call('phase.arm-read', arm.read_bytes))
            now = time.monotonic_ns()
            if now > int(phase['armed']['monotonicNs']) + 5_000_000_000: return
            if len(phase['records']) >= phase['limit']:
                phase['dropped'] += 1
                return
            # Resolve roles only for retained, in-window observations. A stale
            # arm file is not permission to keep reading /proc after expiry.
            if task_pid is not None:
                fields['task'] = measured_call('phase.role', role, task_pid)
            phase['records'].append(dict(kind=kind, monotonicNs=now,
                                         epochNs=time.time_ns(), **fields))
            return True
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
        active = False
        error = None
        if request == module.CONT:
            active = observe('CONT-entry', task_pid=pid, signal=data)
        try:
            return trace(request, pid, addr, data)
        except BaseException as failure:
            error = repr(failure)
            raise
        finally:
            if active and request == module.CONT: observe('CONT-return', pid=pid, error=error)
    def waited(pid, flags):
        result = waitpid(pid, flags)
        if result[0]:
            observe('waitpid-return', task_pid=result[0], status=result[1])
        return result
    inner['syncCallable'] = dict(module=getattr(sync, '__module__', None),
        name=getattr(sync, '__qualname__', None), builtin=isinstance(sync, types.BuiltinFunctionType))
    def synced(fd):
        start = time.monotonic_ns()
        epoch = time.time_ns()
        error = None
        measured_call('fsync.observe-entry', lambda: observe('fsync-entry', fd=fd))
        try: return measured_call('fsync.real', sync, fd)
        except BaseException as failure:
            error = repr(failure)
            raise
        finally:
            measured_call('fsync.observe-return', lambda: observe('fsync-return', fd=fd,
                startMonotonicNs=start, startEpochNs=epoch,
                elapsedNs=time.monotonic_ns()-start, error=error))
    module.ptrace = traced
    module.os.waitpid = waited
    module.os.fsync = synced
    # Timing is observation of this tracer's journal service, not browser or
    # wire timing. Bound retained detail while retaining aggregate totals.
    write = module.Journal.write
    timing = dict(version=VERSION, clock='Python monotonic_ns', writes=0,
                  totalNs=0, maxNs=0, samples=[], subcalls=module.q3_subcalls, inner=inner)

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
