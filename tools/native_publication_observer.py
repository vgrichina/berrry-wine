"""Offline candidate adapter for the existing custody owner; default OFF.

No wait or attach operation lives here. candidate() transforms only the pinned
published collector in memory. Integration into shared source requires a fresh
ownership/release gate. Linux x86-64 only; observations are not publication proof.
"""
import ctypes
import hashlib
import json
import os
import platform
from pathlib import Path

COLLECTOR_SHA256 = '3448afd4c5ec4ea691c584a6cfde3a61b72f5c9143458189c1035f374c4c6240'
SYSCALL, GET_SYSCALL_INFO = 24, 0x420e
PATH_ARGS = {2: (0,), 257: (1,), 82: (0, 1), 264: (1, 3), 316: (1, 3)}


class Observer:
    def __init__(self, run, ptrace, identity, *, max_records=4096, max_bytes=4*1024*1024):
        if platform.machine() != 'x86_64':
            raise ValueError('observer requires Linux x86_64 syscall ABI')
        if not 2 <= max_records <= 65536 or not 4096 <= max_bytes <= 64*1024*1024:
            raise ValueError('invalid observer bounds')
        self.trace, self.identity = ptrace, identity
        self.file = open(Path(run)/'publication-syscalls.ndjson', 'xb', buffering=0)
        self.limit, self.byte_limit = max_records, max_bytes
        self.count = self.size = 0
        self.digest = '0'*64
        self.pending = {}
        self.reasons = set()
        self.active = set()
        self.emit(dict(kind='begin', abi='linux-x86_64', maxRecords=max_records,
                       maxBytes=max_bytes, observationOnly=True))

    def emit(self, row):
        if self.count >= self.limit-1:
            self.reasons.add('record-cap'); return
        row = dict(row, observerSequence=self.count+1, previousSha256=self.digest)
        data = (json.dumps(row, sort_keys=True)+'\n').encode()
        if self.size+len(data) > self.byte_limit-2048:
            self.reasons.add('byte-cap'); return
        self._write(data)

    def _write(self, data):
        offset = 0
        while offset < len(data):
            written = self.file.write(data[offset:])
            if not written: raise OSError('observer short write')
            offset += written
        os.fsync(self.file.fileno())
        self.digest = hashlib.sha256(data).hexdigest()
        self.count += 1; self.size += len(data)

    def lifecycle(self, kind, row, sequence):
        if kind == 'custody':
            if len(self.active) < self.limit: self.active.add((row['pid'], row['start']))
            else: self.reasons.add('identity-cap')
        if kind in ('cancellation-sent', 'failure', 'identity-unavailable-before-wait',
                    'identity-unavailable-before-resume', 'exec-identity-transfer'):
            self.reasons.add(kind)
        if kind in ('custody', 'fork-lineage', 'wait-consumed', 'reaped', 'adopted-reaped',
                    'kernel-event-message', 'exec-identity-transfer', 'cancellation-sent', 'failure',
                    'ptrace-cont-returned', 'ptrace-syscall-resume-returned',
                    'identity-unavailable-before-wait', 'identity-unavailable-before-resume'):
            # Raw consumed status retains signals, exec/exit event and actual wait.
            self.emit(dict(kind='custody-event', event=kind, custodySequence=sequence, raw=row))
        if kind == 'reaped':
            key = (row['pid'], row['start'])
            self.active.discard(key)
            if self.pending.pop(key, None): self.reasons.add('unreturned-syscall')

    def path(self, pid, address):
        data = bytearray()
        try:
            for offset in range(0, 512, ctypes.sizeof(ctypes.c_long)):
                # PEEKDATA can legitimately return -1, unlike other requests.
                libc = ctypes.CDLL(None, use_errno=True); libc.ptrace.restype = ctypes.c_long
                ctypes.set_errno(0)
                word = libc.ptrace(2, pid, ctypes.c_void_p(address+offset), None)
                error = ctypes.get_errno()
                if word == -1 and error: raise OSError(error, os.strerror(error))
                chunk = (word & ((1<<64)-1)).to_bytes(8, 'little')
                if b'\0' in chunk:
                    data.extend(chunk.split(b'\0', 1)[0])
                    return dict(bytesHex=data.hex(), terminated=True)
                data.extend(chunk)
            self.reasons.add('path-cap')
            return dict(bytesHex=data.hex(), terminated=False)
        except OSError as error:
            self.reasons.add('path-unreadable')
            return dict(bytesHex=data.hex(), terminated=False, errno=error.errno)

    def stop(self, pid, start, custody_sequence, wait_sequence, status):
        if self.count >= self.limit-1 or 'byte-cap' in self.reasons:
            self.reasons.add('record-cap' if self.count >= self.limit-1 else 'byte-cap'); return
        key = (pid, start)
        if self.identity(pid)['start'] != start:
            self.reasons.add('identity-ambiguity'); return
        buf = ctypes.create_string_buffer(88)
        try: length = self.trace(GET_SYSCALL_INFO, pid, 88, ctypes.addressof(buf))
        except OSError as error:
            self.reasons.add('syscall-info-unavailable')
            self.emit(dict(kind='syscall-error', pid=pid, start=start, errno=error.errno,
                           custodySequence=custody_sequence, waitSequence=wait_sequence)); return
        raw = buf.raw[:min(length, 88)]
        op = raw[0] if raw else 0
        base = dict(pid=pid, start=start, custodySequence=custody_sequence,
                    waitSequence=wait_sequence, waitStatus=status, rawHex=raw.hex(), rawLength=length)
        if len(raw) < 24 or int.from_bytes(raw[4:8], 'little') != 0xc000003e:
            self.reasons.add('unsupported-syscall-abi')
            self.emit(dict(base, kind='unsupported-syscall-abi')); return
        if op == 1 and len(raw) >= 80:
            nr = int.from_bytes(raw[24:32], 'little')
            args = [int.from_bytes(raw[n:n+8], 'little') for n in range(32, 80, 8)]
            if key in self.pending: self.reasons.add('unreturned-syscall')
            paths = {str(i): self.path(pid, args[i]) for i in PATH_ARGS.get(nr, ())}
            fd = None
            if nr in (1, 3):
                try: fd = dict(number=args[0], link=os.readlink('/proc/%s/fd/%s' % (pid, args[0])), snapshotOnly=True)
                except OSError as error: fd = dict(number=args[0], errno=error.errno, snapshotOnly=True)
            self.pending[key] = dict(nr=nr, entry=self.count+1)
            self.emit(dict(base, kind='entry', nr=nr, arguments=args, paths=paths, fd=fd))
        elif op == 2 and len(raw) >= 33:
            pending = self.pending.pop(key, None)
            if pending is None: self.reasons.add('unpaired-return')
            result = int.from_bytes(raw[24:32], 'little', signed=True)
            self.emit(dict(base, kind='return', entrySequence=pending['entry'] if pending else None,
                           nr=pending['nr'] if pending else None, result=result,
                           isError=bool(raw[32]), errno=-result if raw[32] else None))
        else:
            self.reasons.add('unsupported-syscall-info')
            self.emit(dict(base, kind='unsupported-syscall-info'))

    def close(self):
        if self.pending: self.reasons.add('unreturned-syscall')
        if self.active: self.reasons.add('unreaped-identities')
        # exit_group/exit have no syscall return; never invent one.
        row = dict(kind='end', observerSequence=self.count+1, previousSha256=self.digest,
                   complete=not self.reasons, incompleteReasons=sorted(self.reasons),
                   observationOnly=True, pendingCount=len(self.pending), activeCount=len(self.active))
        try: self._write((json.dumps(row, sort_keys=True)+'\n').encode())
        finally: self.file.close()


def validate(data):
    """Reject truncation/loss/reorder. Integrity is not syscall/publication success."""
    if len(data) > 64*1024*1024: raise ValueError('record stream exceeds bound')
    previous = '0'*64; rows = []
    for sequence, line in enumerate(data.splitlines(keepends=True), 1):
        if sequence > 65536: raise ValueError('record count exceeds bound')
        if not line.endswith(b'\n'): raise ValueError('truncated record')
        row = json.loads(line)
        if row['observerSequence'] != sequence or row['previousSha256'] != previous:
            raise ValueError('lost/reordered record')
        previous = hashlib.sha256(line).hexdigest(); rows.append(row)
    if not rows or rows[0]['kind'] != 'begin' or rows[-1]['kind'] != 'end':
        raise ValueError('missing durable boundaries')
    return rows


def candidate(source, *, enabled=False, max_records=4096, max_bytes=4*1024*1024):
    """Return source only. Caller compiles it in memory; never writes collector."""
    if hashlib.sha256(source.encode()).hexdigest() != COLLECTOR_SHA256:
        raise ValueError('collector is not exact published pinned source')
    if not enabled: return source
    def replace(old, new):
        nonlocal source
        if source.count(old) != 1: raise ValueError('collector anchor mismatch')
        source = source.replace(old, new)
    replace('    journal = Journal(run, journal_compression)\n    retirement = False\n',
            '    journal = Journal(run, journal_compression)\n'
            '    from native_publication_observer import Observer, SYSCALL\n'
            f'    observer = Observer(run, ptrace, identity, max_records={max_records!r}, max_bytes={max_bytes!r})\n'
            '    retirement = False\n')
    replace('        return sequence\n', '        observer.lifecycle(kind, value, sequence)\n        return sequence\n')
    replace('            ptrace(request, task, data=data)\n',
            '            actual_request = SYSCALL if request == CONT and task not in exiting else request\n'
            '            ptrace(actual_request, task, data=data)\n')
    replace("                log('ptrace-cont-returned', pid=task, start=owned[task]['start'],\n",
            "                log('ptrace-cont-returned' if actual_request == CONT else 'ptrace-syscall-resume-returned', pid=task, start=owned[task]['start'], actualRequest=actual_request,\n")
    replace("                                 pid=task, start=row['start'], request=request, data=data,\n",
            "                                 pid=task, start=row['start'], request=request, actualRequest=actual_request, data=data,\n")
    replace('                if not trace_task(SETOPTIONS, task, OPTIONS): continue',
            '                if not trace_task(SETOPTIONS, task, OPTIONS | 1): continue')
    replace('            if awaiting_lineage:\n',
            '            if sig == (signal.SIGTRAP | 128) and event == 0:\n'
            '                assert not awaiting_lineage, "unlinked syscall stop"\n'
            '                observer.stop(task, row["start"], owned[task]["registeredSequence"], consumed_waits[task]["sequence"], status)\n'
            '                resumes[task] = (owned[task]["start"], 0, None)\n'
            '                continue\n'
            '            if awaiting_lineage:\n')
    replace('            journal.close()\n', '            journal.close()\n            observer.close()\n')
    return source
