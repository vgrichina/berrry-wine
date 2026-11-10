"""Linux ptrace custody: fork events stop children before they run; peek before reap.
No /proc sampling is used to discover descendants. Autoattached tasks await their
kernel fork/vfork/clone lineage before userspace resumes. Irreversible exit retirement
can finish without that lineage; unresolved receipts remain explicit at drain.
Nonleader exec retirement requires the consumed EXEC former-TID kernel message;
the transferred obligation closes only on the successor's actual terminal wait.
"""
import ctypes, errno, gzip, hashlib, json, os, signal, sys, time
from pathlib import Path

TRACEME, CONT, SYSCALL, SETOPTIONS, GETEVENTMSG = 0, 7, 24, 0x4200, 0x4201
OPTIONS = 1 | 2 | 4 | 8 | 16 | 64 | 128 | (1 << 20) # TRACESYSGOOD/fork/vfork/clone/exec/exit/seccomp/EXITKILL
WALL = 0x40000000
libc = ctypes.CDLL(None, use_errno=True)
libc.ptrace.restype = ctypes.c_long

def ptrace(request, pid, addr=0, data=0):
    result = libc.ptrace(request, pid, ctypes.c_void_p(addr), ctypes.c_void_p(data))
    if result == -1:
        e = ctypes.get_errno()
        raise OSError(e, os.strerror(e), str(pid))
    return result

def install_creation_gate():
    """Inherited kernel entry barriers, before any command code can execute.

    Only clone/fork/vfork and destructive exec/exit_group enter the serial
    gate. Other syscalls run normally. TRACE is inherited across exec/clone;
    an unsupported ABI fails closed rather than bypassing coordination.
    """
    class Filter(ctypes.Structure):
        _fields_ = [('code', ctypes.c_ushort), ('jt', ctypes.c_ubyte),
                    ('jf', ctypes.c_ubyte), ('k', ctypes.c_uint)]
    class Program(ctypes.Structure):
        _fields_ = [('length', ctypes.c_ushort), ('filters', ctypes.POINTER(Filter))]
    # Separate ABI paths avoid serializing unrelated blocking syscalls whose
    # numbers overlap creation calls on the other ABI.
    def calls(numbers):
        block = [(0x20,0,0,0)]
        for nr in numbers:
            block += [(0x15,0,1,nr), (0x06,0,0,0x7ff00000)]
        return block
    compat = calls((2,11,120,190,252,358,435)) + [(0x06,0,0,0x7fff0000)]
    native = calls((56,57,58,59,231,322,435))
    native += [(0x45,0,1,0x40000000), (0x06,0,0,0x80000000),
               (0x06,0,0,0x7fff0000)]
    ins = [(0x20,0,0,4), (0x15,len(compat)+2,0,0xc000003e),
           (0x15,1,0,0x40000003), (0x06,0,0,0x80000000)] + compat + native
    filters = (Filter * len(ins))(*(Filter(*v) for v in ins))
    program = Program(len(ins), filters)
    assert libc.prctl(38, 1, 0, 0, 0) == 0, 'no_new_privs required'
    assert libc.prctl(22, 2, ctypes.byref(program), 0, 0) == 0, 'seccomp gate required'

def identity(pid):
    p = Path('/proc') / str(pid)
    stat = (p / 'stat').read_text(); fields = stat[stat.rfind(')') + 2:].split()
    status = (p / 'status').read_text().splitlines()
    return dict(pid=pid, start=fields[19], ppid=int(fields[1]), state=fields[0],
                tgid=int(next(s.split()[1] for s in status if s.startswith('Tgid:'))))

class Journal:
    """Ordered durable barriers with a bounded irreversible-retirement batch.

    Only records that cannot admit executable userspace may be deferred. A
    later admission record flushes the entire prefix before CONT. Saturation
    applies synchronous backpressure; final close must persist every byte.
    No worker/thread is inherited across the traced fork.
    """
    MAX_PENDING_BYTES = 1024 * 1024
    MAX_PENDING_RECORDS = 4096
    def __init__(self, run, compression, name='custody.ndjson'):
        if compression not in (None, 'gzip'):
            raise ValueError('journal_compression must be None or gzip')
        self.path = run / (name + ('.gz' if compression else ''))
        self.raw = open(self.path, 'wb')
        self.stream = gzip.GzipFile(filename='', fileobj=self.raw, mode='wb', mtime=0) if compression else self.raw
        self.sha = hashlib.sha256(); self.size = 0
        self.pending = bytearray(); self.pending_records = 0
        self.error = None

    def append(self, value, *, defer=False):
        data = (json.dumps(value)+'\n').encode('utf-8')
        if self.error is not None: raise OSError('journal service failed: '+self.error)
        if len(self.pending) + len(data) > self.MAX_PENDING_BYTES or self.pending_records >= self.MAX_PENDING_RECORDS:
            self.flush_pending()
        if len(data) > self.MAX_PENDING_BYTES:
            self.write(data)
            return
        self.pending.extend(data); self.pending_records += 1
        if not defer: self.flush_pending()

    def flush_pending(self):
        if self.error is not None: raise OSError('journal service failed: '+self.error)
        if self.pending:
            self.write(self.pending)
            self.pending.clear(); self.pending_records = 0

    def write(self, data):
        if self.error is not None: raise OSError('journal service failed: '+self.error)
        try:
            self.stream.write(data); self.stream.flush()
            self.raw.flush(); os.fsync(self.raw.fileno())
        except BaseException as error:
            self.error = repr(error)
            raise
        self.sha.update(data); self.size += len(data)

    def close(self):
        # GzipFile.close writes CRC32/ISIZE but does not close fileobj.
        try:
            self.flush_pending()
            if self.stream is not self.raw: self.stream.close()
            self.raw.flush(); os.fsync(self.raw.fileno())
        finally:
            self.raw.close()

def supervise(run, command, *, deadline, cleanup_deadline, journal_compression=None,
              command_compression=None):
    run = Path(run).resolve(); run.mkdir(parents=True, exist_ok=True)
    assert time.time() < deadline < cleanup_deadline, "expired or invalid immutable deadlines"
    if command_compression not in (None, 'gzip'):
        raise ValueError('command_compression must be None or gzip')
    assert libc.prctl(36, 1, 0, 0, 0) == 0, 'subreaper required'
    owned = {}; reaped = []; parked = set(); exit_retired = set(); root_status = None; sequence = 0
    pending = {}
    exiting = set()
    resumes = {}
    gate_owner = None
    gate_waiting = set()
    exec_transfers = {}
    exit_stops = {}
    consumed_waits = {} # one latest real wait per owned task, diagnostic only
    journal = Journal(run, journal_compression)
    retirement = False
    def log(kind, **value):
        nonlocal sequence
        sequence += 1
        # Diagnostic records share the bounded journal batch. Existing
        # admission barriers still flush the full prefix before CONT.
        diagnostic = kind in ('wait-consumed', 'kernel-event-message',
                              'creation-peek-message', 'ptrace-cont-returned',
                              'fork-parent-release', 'parked-child-release-queued',
                              'parked-child-release')
        # Queue bookkeeping cannot execute a task. Avoid an extra synchronous
        # write for each enqueue/release while other tasks await queue service.
        # Custody and before-consume remain durable; the full ordered prefix,
        # including these records, still flushes before every executable CONT.
        journal.append(dict(sequence=sequence, at=time.time(), kind=kind, **value),
                       defer=retirement or diagnostic)
        return sequence
    def write(name, value):
        (run / name).write_text(json.dumps(value, indent=2))
    def settled():
        receipts = {(r['pid'], r['start']) for r in reaped}
        # A former TID has no separate terminal wait after de_thread. Its
        # obligation follows the explicit kernel binding to the TGID's *real*
        # terminal receipt. Do not put a synthetic wait in reaped.
        return receipts | {(t['formerPid'], t['formerStart']) for t in exec_transfers.values()
                           if (t['pid'], t['start']) in receipts}
    def register(pid, parent, cause):
        if pid in owned:
            assert owned[pid]['cause'] == 'kernel-autoattach-stop', 'duplicate fork event'
            if not any(r['pid'] == pid for r in reaped):
                assert owned[pid]['start'] == identity(pid)['start'], 'PID reused while in custody'
            else:
                # A terminated child can be reaped before the parent's still-pending
                # fork event. Bind that kernel event to its retained receipt;
                # refuse an observed reuse rather than registering it anew.
                assert pid in exit_retired, 'late lineage without exit retirement'
                try:
                    assert owned[pid]['start'] == identity(pid)['start'], 'PID reused before late lineage'
                except (ProcessLookupError, FileNotFoundError):
                    pass
            owned[pid].update(parentCustodian=parent, cause=cause)
            log('fork-lineage', pid=pid, start=owned[pid]['start'], parentCustodian=parent, cause=cause)
            return
        row = identity(pid)
        row.update(parentCustodian=parent, cause=cause)
        owned[pid] = row
        row['registeredSequence'] = log('custody', **row)
    def trace_task(request, task, data=0):
        try:
            # A gated syscall retains exclusive entry through its actual exit
            # stop, including failed clone/exec. Creation events are consumed
            # and bound before that exit; EXIT/EXEC retirement stays unchanged.
            operation = SYSCALL if request == CONT and task == gate_owner and task not in exiting else request
            ptrace(operation, task, data=data)
            if request == GETEVENTMSG:
                log('kernel-event-message', pid=task, start=owned[task]['start'],
                    waitSequence=consumed_waits[task]['sequence'],
                    waitStatus=consumed_waits[task]['status'],
                    kernelMessage=ctypes.c_ulong.from_address(data).value)
            elif request == CONT:
                log('ptrace-cont-returned', pid=task, start=owned[task]['start'],
                    signal=data, operation=operation, waitSequence=consumed_waits[task]['sequence'])
            return True
        except OSError as error:
            if error.errno != errno.ESRCH:
                raise
            # ESRCH also means "not in ptrace-stop". It proves neither death
            # nor identity retirement. Keep custody until a real terminal wait
            # is consumed; another stop may supersede this one during exit/exec.
            row = owned[task]
            pending[task] = dict(pid=task, start=row['start'], request=request,
                                 data=data, sequence=log('ptrace-esrch-pending',
                                 pid=task, start=row['start'], request=request, data=data,
                                 custodySequence=row['registeredSequence']))
            return False
    # Handlers only latch cancellation, including repeated/group signals during
    # drain. Never raise or perform journal I/O from a signal handler.
    cancellation = []; cancel_at = None; sent = set(); failure = None; drained = False
    def request_cancel(signum, frame):
        if not cancellation: cancellation.append(dict(signal=signum, cause='supervisor-signal'))
    def record_cancellation():
        nonlocal cancel_at
        # A signal can latch at any bytecode boundary. Initialize and persist
        # at each use, rather than assuming the loop's earlier guard ran.
        if cancellation and cancel_at is None:
            cancel_at = time.monotonic()
            log('cancellation', **cancellation[0], cleanupDeadline=cleanup_deadline)
    handlers = {sig: signal.signal(sig, request_cancel) for sig in (signal.SIGTERM, signal.SIGINT, signal.SIGHUP)}
    # Drain command output in this same event loop: no logger process outside
    # custody, no thread across fork, and no raw disk staging. The write end is
    # blocking so a producer cannot silently lose bytes to EAGAIN.
    command_log = Journal(run, 'gzip', 'kernel-command.log') if command_compression else None
    read_fd, write_fd = os.pipe2(os.O_CLOEXEC) if command_log else (None, None)
    if read_fd is not None: os.set_blocking(read_fd, False)
    output_eof = False
    def pump_output():
        nonlocal output_eof
        if read_fd is None or output_eof: return
        # Bound each pump so a prolific writer cannot starve waits/deadlines.
        for _ in range(16):
            try: data = os.read(read_fd, 65536)
            except BlockingIOError: break
            if not data:
                output_eof = True
                break
            command_log.write(data)
    wait_flags = os.WEXITED|os.WSTOPPED|os.WNOHANG|os.WNOWAIT|WALL
    def exit_wait():
        for task in list(exiting):
            try: value = os.waitid(os.P_PID, task, wait_flags)
            except ChildProcessError: continue # never a retirement receipt
            if value: return value
        return None
    def priority_wait():
        # P_ALL has no FIFO/fairness guarantee. In particular, a joined thread
        # remains in /proc until its tracer consumes the final wait. Do not put
        # that wait behind unrelated creation stops (or a command-log fsync).
        # During cancellation, first preserve any *actual pending* fork message
        # before a fatal group signal can replace the creator's event stop.
        if not cancellation:
            value = exit_wait()
            if value: return value
        if cancellation or parked or resumes:
            superseding = None
            retirement_wait = None
            for task, row in list(owned.items()):
                if task in exec_transfers: continue
                if any(r['pid'] == task for r in reaped): continue
                try: value = os.waitid(os.P_PID, task, wait_flags)
                except ChildProcessError: continue
                if value and value.si_code == os.CLD_TRAPPED and value.si_status in (
                        (1 << 8)|signal.SIGTRAP, (2 << 8)|signal.SIGTRAP,
                        (3 << 8)|signal.SIGTRAP):
                    return value
                if value and task in resumes and superseding is None:
                    superseding = value
                if value and retirement_wait is None and (
                        value.si_code in (os.CLD_EXITED, os.CLD_KILLED, os.CLD_DUMPED) or
                        (value.si_code == os.CLD_TRAPPED and value.si_status == ((6 << 8)|signal.SIGTRAP))):
                    retirement_wait = value
            # A queued CONT belongs to the stop already consumed. Group exit
            # or de_thread can replace it with a new EXIT/EXEC stop while the
            # resume is queued. Consume that real status before CONT: otherwise
            # we silently release an unrecorded stop (and lose EXEC's required
            # leader EXIT binding). Pending creators still take precedence.
            if superseding is not None:
                return superseding
            # exit_group/de_thread can hold the gate owner's completion behind
            # sibling EXIT stops. A queued gate entry suppresses P_ALL, so scan
            # every owned task for irreversible retirement, not only tasks with
            # a queued CONT or an EXIT stop already consumed. Keep the gate held:
            # selecting a real wait does not admit another gated syscall. Pending
            # creation messages above still precede every retirement/CONT.
            if retirement_wait is not None:
                return retirement_wait
        if gate_owner is not None:
            try: value = os.waitid(os.P_PID, gate_owner, wait_flags)
            except ChildProcessError: value = None
            if value and value.si_status not in (261, 517, 773): return value
        return exit_wait() if cancellation else None
    # Parent never uses Popen.poll()/wait(): those can reap an unrecorded child.
    pid = os.fork()
    if pid == 0:
        try:
            for sig, handler in handlers.items(): signal.signal(sig, handler)
            os.setsid()
            if command_log:
                os.close(read_fd)
                # Do not flush the forked BufferedWriter: its copied gzip
                # header buffer would be appended a second time to the file.
                os.close(command_log.raw.fileno())
                fd = write_fd
            else:
                fd = os.open(run / 'kernel-command.log', os.O_WRONLY|os.O_CREAT|os.O_TRUNC, 0o600)
            os.dup2(fd, 1); os.dup2(fd, 2); os.close(fd)
            ptrace(TRACEME, 0); os.kill(os.getpid(), signal.SIGSTOP)
            install_creation_gate()
            os.execvp(command[0], command)
        except BaseException:
            os._exit(127)
    if write_fd is not None: os.close(write_fd)
    armed = False
    try:
        register(pid, os.getpid(), 'initial-traceme-barrier')
        while True:
            retirement = False
            # WNOWAIT retains the real status and /proc identity for the
            # observation below. Registration/admission is durable; terminal
            # observations join the bounded ordered retirement batch.
            if time.time() > cleanup_deadline:
                log('cleanup-deadline', deadline=cleanup_deadline)
                raise TimeoutError('immutable cleanup deadline')
            if not cancellation and time.time() >= deadline:
                cancellation.append(dict(signal=None, cause='runtime-deadline'))
            record_cancellation()
            peek = priority_wait()
            if peek is None and not resumes:
                try:
                    peek = os.waitid(os.P_ALL, 0, wait_flags)
                except ChildProcessError:
                    # ECHILD or /proc absence cannot retire a recorded identity.
                    assert {(r['pid'], r['start']) for r in owned.values()} == settled(), 'unreaped custody at ECHILD'
                    assert not pending, ('unresolved ptrace ESRCH', pending)
                    assert not resumes, ('unresolved queued resumes', resumes)
                    if command_log and not output_eof:
                        pump_output()
                        time.sleep(.001)
                        continue
                    drained = True
                    break
                # Output durability can block on storage. Consume an already
                # pending kernel stop first: an EXIT stop still holds the
                # child's pipe writers open and withholds its parent's SIGCHLD.
                # Never put up to sixteen output fsyncs ahead of that stop.
                if peek is None:
                    pump_output()
            # Consume an observed wait before issuing more cancellation work.
            # A fatal group signal can make every sibling's EXIT stop ready;
            # broadcasting (and durably logging) all remaining signals first
            # can exhaust cleanup while withholding those real waits and EOF.
            if cancellation and peek is None and gate_owner is None:
                record_cancellation()
                sig = signal.SIGKILL if time.monotonic()-cancel_at >= .25 else signal.SIGTERM
                retired = {r['pid'] for r in reaped}
                for target, registered in list(owned.items()):
                    if target in exec_transfers: continue
                    if target in retired or (target, sig) in sent: continue
                    try:
                        if identity(target)['start'] != registered['start']:
                            raise AssertionError('PID reused during cancellation')
                        os.kill(target, sig)
                        log('cancellation-sent', pid=target, start=registered['start'], signal=sig)
                    except (ProcessLookupError, FileNotFoundError):
                        log('cancellation-identity-unavailable', pid=target, start=registered['start'], signal=sig)
                    sent.add((target, sig))
                    # Re-scan kernel stops/deadlines between signals, including
                    # when one signal has already terminated the whole group.
                    break
            if peek is None and resumes:
                # Cancellation does not waive the creator barrier. A linked
                # creator can immediately exit_group, and delivery of a fatal
                # signal can replace other creators' pending kernel messages.
                # Scan before every queued CONT, including signal delivery.
                # Cancellation signals above also follow that same scan.
                eligible = [(t,v) for t,v in resumes.items()
                            if t not in gate_waiting or gate_owner in (None,t)]
                if not eligible:
                    time.sleep(.001)
                    continue
                task, (start, deliver, parent) = eligible[0]
                if task in gate_waiting and gate_owner is None:
                    gate_owner = task
                    log('syscall-gate-acquired', pid=task)
                del resumes[task]
                try:
                    assert identity(task)['start'] == start, 'PID reused before resume'
                except (ProcessLookupError, FileNotFoundError):
                    # A dying thread can lose /proc before its terminal wait.
                    # Keep the actual ptrace/terminal obligation, as below.
                    log('identity-unavailable-before-resume', pid=task, start=start)
                journal.flush_pending() # ordered durable prefix before executable userspace
                released = trace_task(CONT, task, deliver)
                if parent is not None:
                    log('parked-child-release' if released else 'parked-child-release-pending',
                        pid=task, parent=parent)
                continue
            if peek is None:
                time.sleep(.001); continue
            task = peek.si_pid
            assert task not in exec_transfers, ('unexpected wait for transferred TID', task)
            resumes.pop(task, None) # a newer real stop supersedes a queued CONT
            unlinked = task not in owned
            if unlinked:
                # A fatal group signal can supersede the initial autoattach
                # SIGSTOP before its first observation. The kernel's EXIT stop
                # still retains /proc identity and permits only irreversible
                # retirement below, after consuming/validating that real stop
                # and GETEVENTMSG. No lineage or userspace admission is inferred.
                assert peek.si_code == os.CLD_TRAPPED and peek.si_status in (
                    signal.SIGSTOP, (6 << 8) | signal.SIGTRAP
                ), ('unexpected unlinked task', task, peek)
                register(task, None, 'kernel-autoattach-stop')
            # The registered identity is already durable. EXIT CONT can only
            # finish irreversible death; terminal waitpid is the real receipt.
            # Keep their ordered evidence in the bounded batch, without disk
            # service on every stop/reap. All other stops remain sync barriers.
            retirement = peek.si_code in (os.CLD_EXITED, os.CLD_KILLED, os.CLD_DUMPED) or (
                peek.si_code == os.CLD_TRAPPED and peek.si_status == ((6 << 8)|signal.SIGTRAP))
            awaiting_lineage = owned[task]['cause'] == 'kernel-autoattach-stop'
            try:
                row = identity(task)
            except (ProcessLookupError, FileNotFoundError):
                # Some dead threads lose /proc before their wait receipt. Use
                # the durable registration, never absence as a synthetic exit.
                row = dict(owned[task])
                log('identity-unavailable-before-wait', pid=task, start=row['start'])
            assert row['start'] == owned[task]['start'], 'PID reused while in custody'
            terminal = peek.si_code in (os.CLD_EXITED, os.CLD_KILLED, os.CLD_DUMPED)
            if terminal:
                before = log('before-reap', **row, custodySequence=owned[task]['registeredSequence'],
                             siCode=peek.si_code, siStatus=peek.si_status)
            else:
                # A concurrent signal can supersede a peeked stop. Retain the
                # identity before waitpid even if its next status is terminal.
                before = log('before-consume', **row, custodySequence=owned[task]['registeredSequence'],
                             siCode=peek.si_code, siStatus=peek.si_status)
            # Preserve a pending creator message even if a fatal signal
            # replaces this peek before waitpid. This observation cannot
            # register a child or authorize CONT; only consumed events do.
            if peek.si_code == os.CLD_TRAPPED and peek.si_status in (261, 517, 773):
                observed_message = ctypes.c_ulong()
                try:
                    ptrace(GETEVENTMSG, task, data=ctypes.addressof(observed_message))
                except OSError as error:
                    log('creation-peek-message', pid=task, start=row['start'],
                        beforeConsumeSequence=before, peekStatus=peek.si_status,
                        kernelMessage=None, errno=error.errno, observationalOnly=True)
                else:
                    log('creation-peek-message', pid=task, start=row['start'],
                        beforeConsumeSequence=before, peekStatus=peek.si_status,
                        kernelMessage=observed_message.value, errno=None, observationalOnly=True)
            got, status = os.waitpid(task, os.WNOHANG|WALL)
            if got == 0 and not terminal:
                log('stop-peek-superseded', pid=task, start=row['start'], beforeConsumeSequence=before)
                continue
            assert got == task, ('peek/consume mismatch', task, got)
            # WNOWAIT is an observation, not the consumed status: a fatal
            # signal may supersede it. Retain both without inferring lineage.
            consumed_waits[task] = dict(status=status, sequence=log('wait-consumed',
                pid=task, start=row['start'], waitStatus=status,
                beforeConsumeSequence=before, peekCode=peek.si_code, peekStatus=peek.si_status))
            if os.WIFEXITED(status) or os.WIFSIGNALED(status):
                gate_waiting.discard(task)
                if gate_owner == task:
                    log('syscall-gate-terminal', pid=task)
                    gate_owner = None
                exiting.discard(task)
                parked.discard(task)
                previous = next((r for r in reaped if r['pid'] == task), None)
                if previous is not None:
                    # A tracer's terminal wait releases the zombie to its real
                    # parent. If that parent exits without waiting, subreaper
                    # adoption delivers a second, distinct wait obligation.
                    # This is not PID reuse, nor permission to ignore duplicates.
                    assert (previous['start'] == row['start'] and
                            previous['terminalParent'] != os.getpid() and
                            row['ppid'] == os.getpid() and row['tgid'] == task and
                            previous['status'] == status and
                            'adoptionSequence' not in previous), 'duplicate terminal receipt'
                    previous['adoptionSequence'] = log('adopted-reaped', pid=task,
                        start=row['start'], status=status, beforeReapSequence=before,
                        tracerReapSequence=previous['sequence'], previousParent=previous['terminalParent'],
                        terminalParent=row['ppid'])
                    continue
                reaped.append(dict(pid=task, start=row['start'], beforeReapSequence=before,
                                   sequence=log('reaped', pid=task, start=row['start'], status=status,
                                                terminalParent=row['ppid']), status=status,
                                   terminalParent=row['ppid']))
                for transfer in exec_transfers.values():
                    if (transfer['pid'], transfer['start']) == (task, row['start']):
                        transfer['reapSequence'] = reaped[-1]['sequence']
                        log('exec-transfer-reconciled', pid=task, start=row['start'],
                            transferSequence=transfer['sequence'], reapSequence=transfer['reapSequence'])
                if task in pending:
                    receipt = pending.pop(task)
                    log('ptrace-esrch-reconciled', pid=task, start=row['start'],
                        pendingSequence=receipt['sequence'], reapSequence=reaped[-1]['sequence'])
                if task == pid: root_status = os.waitstatus_to_exitcode(status)
                continue
            assert os.WIFSTOPPED(status), status
            sig = os.WSTOPSIG(status); event = status >> 16
            if awaiting_lineage:
                if event == 6:
                    # Group termination can replace the creating task's pending
                    # fork/clone event (including SIGTERM delivered to a sibling).
                    # PTRACE_EVENT_EXIT is irreversible, regardless of its cause:
                    # CONT finishes death without running unlinked userspace.
                    # Require the consumed kernel EXIT stop and its exit message,
                    # never a signal-delivery stop or sampled TGID inference.
                    assert sig == signal.SIGTRAP, ('invalid EXIT stop', task, status)
                    exit_status = ctypes.c_ulong()
                    if not trace_task(GETEVENTMSG, task, ctypes.addressof(exit_status)): continue
                    assert exit_status.value <= 0xffff and (os.WIFEXITED(exit_status.value) or os.WIFSIGNALED(exit_status.value)), ('invalid kernel exit status', task, exit_status.value)
                    log('unlinked-exit-retirement', **row, exitStatus=exit_status.value,
                        custodySequence=owned[task]['registeredSequence'], lineageResolved=False)
                    exit_retired.add(task); parked.discard(task); exiting.add(task)
                    trace_task(CONT, task)
                    continue
                # The child initial stop may be delivered before its parent's
                # fork event. Keep it stopped until kernel lineage is consumed.
                parked.add(task); log('parked-autoattach', pid=task)
                continue
            if not armed:
                assert task == pid and sig == signal.SIGSTOP
                if not trace_task(SETOPTIONS, task, OPTIONS): continue
                write('kernel-armed.json', dict(pid=pid, supervisor=os.getpid(), supervisorStart=identity(os.getpid())['start'], deadline=deadline,
                      cleanupDeadline=cleanup_deadline, kind='kernel fork barrier; external deadline watchdog required',
                      armedBeforeCustodian=True, command=command, custodySequence=owned[pid]['registeredSequence']))
                log('watchdog-barrier-released', pid=pid)
                armed = True
            elif event == 7:
                assert sig == signal.SIGTRAP, ('invalid SECCOMP stop', task, status)
                gate_waiting.add(task)
                log('syscall-gate-entry', pid=task)
            elif sig == (signal.SIGTRAP | 0x80):
                assert gate_owner == task, ('syscall exit without gate', task)
                log('syscall-gate-exit', pid=task)
                gate_waiting.discard(task)
                gate_owner = None
            elif event in (1, 2, 3):
                child = ctypes.c_ulong()
                if not trace_task(GETEVENTMSG, task, ctypes.addressof(child)): continue
                register(child.value, task, {1:'fork',2:'vfork',3:'clone'}[event])
                if gate_owner == task:
                    # Binding is now consumed. vfork must allow the child's
                    # exec while its creator remains blocked in the syscall.
                    log('syscall-gate-creation-bound', pid=task, child=child.value)
                    gate_waiting.discard(task)
                    gate_owner = None
                if child.value in parked:
                    parked.remove(child.value)
                    resumes[child.value] = (owned[child.value]['start'], 0, task)
                    log('parked-child-release-queued',
                        pid=child.value, parent=task)
                log('fork-parent-release', pid=task, child=child.value)
            elif event == 6:
                exit_stops[task] = log('pre-exit-stop', **row, custodySequence=owned[task]['registeredSequence'])
                exiting.add(task)
            elif event == 4:
                assert sig == signal.SIGTRAP, ('invalid EXEC stop', task, status)
                former = ctypes.c_ulong()
                if not trace_task(GETEVENTMSG, task, ctypes.addressof(former)): continue
                if former.value not in (0, task):
                    old = owned.get(former.value)
                    assert old is not None, ('exec former TID not in custody', task, former.value)
                    assert (row['tgid'] == task and old['tgid'] == task and
                            old['cause'] != 'kernel-autoattach-stop' and
                            former.value not in exec_transfers and
                            not any(r['pid'] in (task, former.value) for r in reaped) and
                            task in exiting), ('unbound nonleader exec', task, former.value)
                    # Linux keeps the leader's /proc start time when replacing
                    # it with the execing thread. The ordinary identity check
                    # above still applies; GETEVENTMSG never authorizes reuse.
                    assert identity(task)['start'] == row['start'], 'PID reused at exec binding'
                    try:
                        assert identity(former.value)['start'] == old['start'], 'former TID reused at exec binding'
                    except (ProcessLookupError, FileNotFoundError):
                        pass # disappearance is not the binding evidence
                    transfer = dict(pid=task, start=row['start'], formerPid=former.value,
                        formerStart=old['start'], custodySequence=owned[task]['registeredSequence'],
                        formerCustodySequence=old['registeredSequence'], beforeConsumeSequence=before,
                        leaderExitSequence=exit_stops[task],
                        kernelEvent=event, kernelMessage=former.value, waitStatus=status,
                        pendingPtrace=pending.get(former.value), queuedResume=resumes.get(former.value))
                    transfer['sequence'] = log('exec-identity-transfer', **transfer)
                    exec_transfers[former.value] = transfer
                    if gate_owner == former.value:
                        gate_owner = task
                        gate_waiting.discard(former.value)
                        gate_waiting.add(task)
                    # Only these two kernel-bound identities change roles.
                    # Sibling EXIT stops and terminal waits remain mandatory.
                    pending.pop(former.value, None); resumes.pop(former.value, None)
                    parked.discard(former.value); exiting.discard(former.value)
                    exiting.discard(task)
                if gate_owner == task:
                    log('syscall-gate-exec-bound', pid=task)
                    gate_waiting.discard(task)
                    gate_owner = None
            deliver = 0 if event or sig in (signal.SIGTRAP, signal.SIGSTOP, signal.SIGTRAP | 0x80) else sig
            if event == 6:
                trace_task(CONT, task, deliver)
            else:
                resumes[task] = (owned[task]['start'], deliver, None)
    except BaseException as error:
        failure = repr(error)
        # A failed logger must never prevent containment, nor a later successful
        # close conceal an earlier write/fsync error.
        try: log('failure', error=repr(error))
        except BaseException: pass
        for task, row in owned.items():
            if task in exec_transfers: continue
            try:
                if identity(task)['start'] == row['start']: os.kill(task, signal.SIGKILL)
            except (ProcessLookupError, FileNotFoundError): pass
        raise
    finally:
        remaining=[]
        for task,row in owned.items():
            if task in exec_transfers: continue
            try:
                if identity(task)['start']==row['start']: remaining.append(identity(task))
            except (ProcessLookupError,FileNotFoundError): pass
        unreaped=[row for row in owned.values() if (row['pid'], row['start']) not in settled()]
        unresolved=[row for row in owned.values() if row['cause']=='kernel-autoattach-stop']
        complete = drained and not (unreaped or pending or parked or remaining or unresolved or resumes or gate_owner is not None or gate_waiting)
        journal_error = None
        command_error = None
        if command_log:
            try:
                pump_output()
                command_log.close()
            except BaseException as error:
                command_error = repr(error)
            finally:
                os.close(read_fd)
        try:
            # ECHILD/output finalization can observe a signal after the last
            # loop guard. Persist it even when no further signal is needed.
            record_cancellation()
            journal.close()
        except BaseException as error:
            journal_error = repr(error)
        try:
            write('kernel-drain.json',dict(exit=root_status,owned=list(owned.values()),reaped=reaped,
                  complete=complete and journal_error is None and command_error is None,
                  failure=failure, cancellation=cancellation,
                  commandLog=(dict(path=command_log.path.name, closed=command_error is None,
                      eof=output_eof, error=command_error, originalBytes=command_log.size,
                      originalSha256=command_log.sha.hexdigest()) if command_log else None),
                  journal=dict(path=journal.path.name, closed=journal_error is None, error=journal_error,
                               originalBytes=journal.size, originalSha256=journal.sha.hexdigest()),
                  remaining=remaining,unreaped=unreaped,unresolvedPtrace=list(pending.values()),
                  execTransfers=list(exec_transfers.values()),
                  kernelEventEvidenceVersion=1,
                  syscallGate=dict(owner=gate_owner, waiting=sorted(gate_waiting)),
                  unresolvedResumes=[dict(pid=task,start=value[0],signal=value[1]) for task,value in resumes.items()],
                  finishedAt=time.time(),deadline=deadline,cleanupDeadline=cleanup_deadline,
                  custody='ptrace fork/vfork/clone barriers + waitid WNOWAIT before waitpid',
                  kernelForkLineage=True,kernelForkLineageComplete=not unresolved,
                  unresolvedLineage=unresolved,untracedCloneFlagsAudited=False))
        finally:
            for sig, handler in handlers.items(): signal.signal(sig, handler)
        if journal_error: raise OSError('journal finalization failed: '+journal_error)
        if command_error: raise OSError('command log finalization failed: '+command_error)
    assert not unreaped, unreaped
    assert not pending, pending
    assert not parked, parked
    assert not remaining, remaining
    assert not unresolved, ('unresolved kernel lineage', unresolved)
    assert gate_owner is None and not gate_waiting, ('unsettled syscall gate', gate_owner, gate_waiting)
    if cancellation: raise InterruptedError('supervised cancellation: '+repr(cancellation[0]))
    assert root_status == 0, root_status

if __name__ == '__main__':
    # Deadlines are assigned before allocation and never extended at startup.
    run=Path(sys.argv[1]).resolve()
    life=json.loads((run/'lifecycle.json').read_text())
    command=sys.argv[2:]
    compression='gzip' if command and command[0]=='--journal-gzip' else None
    if compression: command=command[1:]
    supervise(run, command, deadline=life['browserDeadline']/1000,
              cleanup_deadline=life['browserDeadline']/1000+30, journal_compression=compression)
