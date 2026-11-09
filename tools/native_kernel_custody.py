"""Linux ptrace custody: fork events stop children before they run; peek before reap.
No /proc sampling is used to discover descendants. Autoattached tasks await their
kernel fork/vfork/clone lineage before userspace resumes. Irreversible exit retirement
can finish without that lineage; unresolved receipts remain explicit at drain.
Nonleader exec retirement requires the consumed EXEC former-TID kernel message;
the transferred obligation closes only on the successor's actual terminal wait.
"""
import ctypes, errno, gzip, hashlib, json, os, signal, sys, time
from pathlib import Path

TRACEME, CONT, SETOPTIONS, GETEVENTMSG = 0, 7, 0x4200, 0x4201
OPTIONS = 2 | 4 | 8 | 16 | 64 | (1 << 20) # fork/vfork/clone/exec/exit/EXITKILL
WALL = 0x40000000
libc = ctypes.CDLL(None, use_errno=True)
libc.ptrace.restype = ctypes.c_long

def ptrace(request, pid, addr=0, data=0):
    result = libc.ptrace(request, pid, ctypes.c_void_p(addr), ctypes.c_void_p(data))
    if result == -1:
        e = ctypes.get_errno()
        raise OSError(e, os.strerror(e), str(pid))
    return result

def identity(pid):
    p = Path('/proc') / str(pid)
    stat = (p / 'stat').read_text(); fields = stat[stat.rfind(')') + 2:].split()
    status = (p / 'status').read_text().splitlines()
    return dict(pid=pid, start=fields[19], ppid=int(fields[1]), state=fields[0],
                tgid=int(next(s.split()[1] for s in status if s.startswith('Tgid:'))))

class Journal:
    """Flush compressed bytes from the first record; hash the original bytes."""
    def __init__(self, run, compression, name='custody.ndjson'):
        if compression not in (None, 'gzip'):
            raise ValueError('journal_compression must be None or gzip')
        self.path = run / (name + ('.gz' if compression else ''))
        self.raw = open(self.path, 'wb')
        self.stream = gzip.GzipFile(filename='', fileobj=self.raw, mode='wb', mtime=0) if compression else self.raw
        self.sha = hashlib.sha256(); self.size = 0

    def append(self, value):
        data = (json.dumps(value)+'\n').encode('utf-8')
        self.write(data)

    def write(self, data):
        self.stream.write(data); self.stream.flush()
        self.raw.flush(); os.fsync(self.raw.fileno())
        self.sha.update(data); self.size += len(data)

    def close(self):
        # GzipFile.close writes CRC32/ISIZE but does not close fileobj.
        try:
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
    exec_transfers = {}
    exit_stops = {}
    journal = Journal(run, journal_compression)
    def log(kind, **value):
        nonlocal sequence
        sequence += 1
        journal.append(dict(sequence=sequence, at=time.time(), kind=kind, **value))
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
        row['registeredSequence'] = log('custody', **row)
        owned[pid] = row
    def trace_task(request, task, data=0):
        try:
            ptrace(request, task, data=data)
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
            # A queued CONT belongs to the stop already consumed. Group exit
            # or de_thread can replace it with a new EXIT/EXEC stop while the
            # resume is queued. Consume that real status before CONT: otherwise
            # we silently release an unrecorded stop (and lose EXEC's required
            # leader EXIT binding). Pending creators still take precedence.
            if superseding is not None:
                return superseding
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
            os.execvp(command[0], command)
        except BaseException:
            os._exit(127)
    if write_fd is not None: os.close(write_fd)
    register(pid, os.getpid(), 'initial-traceme-barrier')
    armed = False
    try:
        while True:
            # WNOWAIT explicitly leaves even adopted zombies in /proc until their
            # PID/start/current PPID and custody are durably logged below.
            if time.time() > cleanup_deadline:
                log('cleanup-deadline', deadline=cleanup_deadline)
                raise TimeoutError('immutable cleanup deadline')
            if not cancellation and time.time() >= deadline:
                cancellation.append(dict(signal=None, cause='runtime-deadline'))
            if cancellation:
                if cancel_at is None:
                    cancel_at = time.monotonic()
                    log('cancellation', **cancellation[0], cleanupDeadline=cleanup_deadline)
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
            fork_wait = peek and peek.si_code == os.CLD_TRAPPED and peek.si_status in (
                (1 << 8)|signal.SIGTRAP, (2 << 8)|signal.SIGTRAP, (3 << 8)|signal.SIGTRAP)
            if cancellation and not fork_wait:
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
            if peek is None and resumes:
                # Cancellation does not waive the creator barrier. A linked
                # creator can immediately exit_group, and delivery of a fatal
                # signal can replace other creators' pending kernel messages.
                # Scan before every queued CONT, including signal delivery.
                # Cancellation signals above also follow that same scan.
                task, (start, deliver, parent) = next(iter(resumes.items()))
                del resumes[task]
                try:
                    assert identity(task)['start'] == start, 'PID reused before resume'
                except (ProcessLookupError, FileNotFoundError):
                    # A dying thread can lose /proc before its terminal wait.
                    # Keep the actual ptrace/terminal obligation, as below.
                    log('identity-unavailable-before-resume', pid=task, start=start)
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
            got, status = os.waitpid(task, os.WNOHANG|WALL)
            if got == 0 and not terminal:
                log('stop-peek-superseded', pid=task, start=row['start'], beforeConsumeSequence=before)
                continue
            assert got == task, ('peek/consume mismatch', task, got)
            if os.WIFEXITED(status) or os.WIFSIGNALED(status):
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
            elif event in (1, 2, 3):
                child = ctypes.c_ulong()
                if not trace_task(GETEVENTMSG, task, ctypes.addressof(child)): continue
                register(child.value, task, {1:'fork',2:'vfork',3:'clone'}[event])
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
                    # Only these two kernel-bound identities change roles.
                    # Sibling EXIT stops and terminal waits remain mandatory.
                    pending.pop(former.value, None); resumes.pop(former.value, None)
                    parked.discard(former.value); exiting.discard(former.value)
                    exiting.discard(task)
            deliver = 0 if event or sig in (signal.SIGTRAP, signal.SIGSTOP) else sig
            if event == 6:
                trace_task(CONT, task, deliver)
            else:
                resumes[task] = (owned[task]['start'], deliver, None)
    except BaseException as error:
        failure = repr(error)
        log('failure', error=repr(error))
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
        complete = drained and not (unreaped or pending or parked or remaining or unresolved or resumes)
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
