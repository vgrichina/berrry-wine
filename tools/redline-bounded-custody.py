#!/usr/bin/env python3
"""Redline's explicit bounded diagnostic adapter for exact published custody.

Ownership admission still persists the complete journal prefix before CONT.
Syscall stops of already admitted tasks carry diagnostics, not new ownership.
Those diagnostics use bounded batches; exhaustion returns to ordinary custody
without claiming a complete syscall observation. No closure check is changed.
"""
import hashlib
import json
import os
from pathlib import Path
import sys

import native_publication_launch as published

VERSION = 'redline-bounded-custody-v1'
LAUNCHER_SHA = '3dc65b811a9b73a85fa5c4f9482d8a063865d397994e8160e08c51985f5f7d89'


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
    replace('                journal.flush_pending() # ordered durable prefix before executable userspace',
            '                # Pure syscall continuation admits no new owned identity.\n'
            '                # Every other release retains the published durable barrier.\n'
            '                if consumed_waits[task]["status"] != ((signal.SIGTRAP | 128) << 8 | 0x7f):\n'
            '                    journal.flush_pending()\n'
            '                    observer.flush_pending()')
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
            os.fsync(self.file.fileno())
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
                       ownershipAdmissionDurable=True), stream)
    return published.launch(argv)


if __name__ == '__main__':
    try:
        sys.exit(launch(sys.argv[1:]))
    except Exception as error:
        print(type(error).__name__+': '+str(error), file=sys.stderr)
        sys.exit(1)
