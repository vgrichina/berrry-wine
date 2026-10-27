"""Real mutation/consumption across the production ledger's observation boundaries."""
import hashlib
import contextlib
import mmap
import importlib.util
import json
import os
import pathlib
import struct
import tempfile
import unittest
from unittest import mock

R = pathlib.Path(__file__).resolve().parents[1]
s = importlib.util.spec_from_file_location('accounting', os.environ.get('RICOCHET_ACCOUNTING_SOURCE', str(R/'tools/ricochet/runtime-accounting.py')))
A = importlib.util.module_from_spec(s)
s.loader.exec_module(A)
RESULTS = []


class SameSizeTests(unittest.TestCase):
    def exercise(self, change, phase, prior=False):
        start_fds = len(os.listdir('/proc/self/fd'))
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            p = root/'continue.json'
            p.write_bytes(b'{}')
            frozen = root/'zz-input'
            frozen.write_bytes(b'input')
            initial = p.stat()
            writer = os.open(p, os.O_RDWR)
            ledger = A.RuntimeAccounting([root], ephemeral_files={p:24*1048576},
                immutable_files={frozen:hashlib.sha256(b'input').hexdigest()}, ceiling=256*1048576)
            if prior:
                ledger.sample()
            calls, scans, actions = [], [], []
            original_open, original_read, original_scan = os.open, os.read, os.scandir
            monitor_class = getattr(A, '_ControlChanges', None)
            original_check = None if monitor_class is None else monitor_class.check

            def action():
                if actions:
                    return
                actions.append((change, phase))
                if change == 'rename':
                    p.rename(root/'outside-name')
                elif change == 'rename-return':
                    other = root/'outside-name'
                    p.rename(other)
                    other.rename(p)
                    p.unlink()
                elif change == 'link':
                    os.link(p, root/'linked')
                    p.unlink()
                elif change == 'link-return':
                    other = root/'linked'
                    os.link(p, other)
                    other.unlink()
                    p.unlink()
                elif change == 'swap':
                    replacement = root/'replacement'
                    replacement.write_bytes(b'[]')
                    replacement.replace(p)
                    p.unlink()
                elif change == 'symlink':
                    p.unlink()
                    p.symlink_to(frozen)
                elif change in ('mmap', 'mmap-unlinked'):
                    if change == 'mmap-unlinked':
                        p.unlink()
                    with mmap.mmap(writer, 2) as view:
                        view[:] = b'[]'
                        view.flush()
                    os.utime(writer, ns=(initial.st_atime_ns, initial.st_mtime_ns))
                    if change == 'mmap':
                        p.unlink()
                elif change == 'none':
                    # Real consuming reader: parse/read the exact published file,
                    # close it, and consume the name without writing its inode.
                    self.assertEqual(p.read_bytes(), b'{}')
                    p.unlink()
                else:
                    if change == 'after-unlink':
                        p.unlink()
                    value = {'grow':b'[]more', 'shrink':b'[', 'same':b'[]',
                             'restore':b'[]', 'after-unlink':b'[]'}[change]
                    os.ftruncate(writer, len(value))
                    os.pwrite(writer, value, 0)
                    if change == 'restore':
                        os.pwrite(writer, b'{}', 0)
                    os.utime(writer, ns=(initial.st_atime_ns, initial.st_mtime_ns))
                    if change != 'after-unlink':
                        p.unlink()

            def opening(name, flags, *args, **kw):
                control = name == p.name and kw.get('dir_fd') is not None
                if control:
                    calls.append(1)
                    if phase == 'before-first' and len(calls) == 1:
                        action()
                    if phase == 'before-second' and len(calls) == 2:
                        action()
                fd = original_open(name, flags, *args, **kw)
                if control and ((phase == 'after-first' and len(calls) == 1) or
                                (phase == 'after-second' and len(calls) == 2)):
                    action()
                return fd

            def scanning(fd):
                scans.append(1)
                if phase == 'final-scan' and len(scans) == 2:
                    action()
                return original_scan(fd)

            def reading(fd, length):
                if phase == 'read' and os.fstat(fd).st_ino == frozen.stat().st_ino:
                    action()
                return original_read(fd, length)

            def checking(monitor):
                if phase == 'final-writer':
                    action()
                return original_check(monitor)

            try:
                monitor_patch = contextlib.nullcontext() if monitor_class is None else mock.patch.object(monitor_class, 'check', checking)
                with mock.patch.object(os, 'open', opening), mock.patch.object(os, 'read', reading), \
                     mock.patch.object(os, 'scandir', scanning), monitor_patch:
                    if change == 'none':
                        result = ledger.sample()
                        self.assertGreaterEqual(result['bytes'], 24*1048576)
                        self.assertEqual(ledger.receipt['lastBytes'], result['bytes'])
                    else:
                        with self.assertRaises((A.AccountingError, OSError)) as caught:
                            ledger.sample()
                        if change != 'symlink':
                            self.assertIsInstance(caught.exception, A.AccountingError)
                        self.assertIsNone(ledger.receipt['lastBytes'])
                        self.assertEqual(ledger.receipt['samples'], int(prior))
                        self.assertEqual(ledger.receipt['failures'], 1)
                self.assertEqual(actions, [(change, phase)])
                RESULTS.append(dict(change=change, phase=phase, prior=prior,
                    error=None if change == 'none' else str(caught.exception),
                    receipt=dict(ledger.receipt), actions=actions))
            finally:
                os.close(writer)
        self.assertEqual(len(os.listdir('/proc/self/fd')), start_fds)

    def test_all_mutation_boundaries(self):
        for phase in ('before-first', 'after-first', 'read', 'before-second', 'after-second', 'final-scan', 'final-writer'):
            for change in ('grow', 'shrink', 'same', 'restore', 'mmap', 'mmap-unlinked', 'after-unlink', 'rename', 'rename-return', 'link', 'swap', 'symlink'):
                with self.subTest(phase=phase, change=change):
                    self.exercise(change, phase)

    def test_real_consumers(self):
        for phase in ('before-first', 'after-first', 'read', 'before-second', 'after-second', 'final-scan', 'final-writer'):
            with self.subTest(phase=phase):
                self.exercise('none', phase)

    def test_original_exact_attack(self):
        self.exercise('same', 'before-second')

    def test_original_write_restore_attack(self):
        self.exercise('restore', 'before-second')

    def test_previous_success_cleared(self):
        self.exercise('same', 'before-second', prior=True)

    def test_watch_failure_and_overflow_close_descriptors(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = pathlib.Path(tmp)/'continue.json'
            p.write_bytes(b'{}')
            start = len(os.listdir('/proc/self/fd'))
            for failure in ('watch', 'overflow'):
                ledger = A.RuntimeAccounting([p.parent], ephemeral_files={p:65536}, ceiling=1048576)
                original = os.read
                def reading(fd, n):
                    if fd == ledger.control_changes.fd:
                        return struct.pack('iIII', -1, 0x4000, 0, 0)
                    return original(fd, n)
                patch = mock.patch.object(A._ControlChanges, 'watch', side_effect=A.AccountingError('watch failed')) if failure == 'watch' else mock.patch.object(os, 'read', reading)
                with patch, self.assertRaises(A.AccountingError):
                    ledger.sample()
                self.assertIsNone(ledger.receipt['lastBytes'])
                self.assertEqual(len(os.listdir('/proc/self/fd')), start)


if __name__ == '__main__':
    try:
        unittest.main(verbosity=2)
    finally:
        if os.environ.get('RICOCHET_ACCEPT_OPS'):
            target = pathlib.Path(os.environ['RICOCHET_ACCEPT_OPS'])/'same-size-cases.json'
            target.write_text(json.dumps(RESULTS, indent=2))
