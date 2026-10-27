"""Pinned control versions survive pathname consumption; Python/local fixtures only."""
import importlib.util
import os
import pathlib
import tempfile
import unittest
from unittest import mock

SOURCE = pathlib.Path(os.environ.get('RICOCHET_ACCOUNTING_SOURCE',
    str(pathlib.Path(__file__).resolve().parents[1]/'tools/ricochet/runtime-accounting.py')))
spec = importlib.util.spec_from_file_location('accounting', SOURCE)
A = importlib.util.module_from_spec(spec)
spec.loader.exec_module(A)
MIB = 1048576


class PinnedUnlinkedVersionTests(unittest.TestCase):
    def exercise(self, change, phase='before-second', prior=False):
        with tempfile.TemporaryDirectory() as temp:
            root = pathlib.Path(temp)
            control = root/'continue.json'
            control.write_bytes(b'{}')
            initial = control.stat()
            ledger = A.RuntimeAccounting([root], ephemeral_files={control:24*MIB}, ceiling=256*MIB)
            if prior:
                ledger.sample()
            real_open, real_scandir = os.open, os.scandir
            opens, scans, actions, failed_opens = [], [], [], []

            def consume():
                actions.append(change)
                if change == 'grow':
                    control.write_bytes(b'{"changedDuringFinalReopen":true}')
                elif change == 'rewrite':
                    control.write_bytes(b'[]')
                    os.utime(control, ns=(initial.st_atime_ns, initial.st_mtime_ns+1000000))
                elif change == 'mode':
                    control.chmod(0o600 if initial.st_mode & 0o077 else 0o644)
                control.unlink()
                observed = os.fstat(ledger.control_fds[control])
                self.assertEqual(observed.st_ino, initial.st_ino)
                self.assertEqual(observed.st_nlink, 0)
                if change == 'grow':
                    self.assertEqual(observed.st_size, 33)

            def opening(name, flags, *args, **kwargs):
                is_control = name == 'continue.json' and kwargs.get('dir_fd') is not None
                if is_control:
                    opens.append(name)
                    if len(opens) == 2 and phase == 'before-second':
                        consume()
                try:
                    fd = real_open(name, flags, *args, **kwargs)
                except FileNotFoundError:
                    if is_control:
                        failed_opens.append(len(opens))
                    raise
                if is_control and len(opens) == 2 and phase == 'after-second':
                    consume()
                return fd

            def scanning(fd):
                scans.append(fd)
                if len(scans) == 2 and phase == 'before-final':
                    consume()
                return real_scandir(fd)

            if phase == 'absent':
                control.unlink()
            with mock.patch.object(os, 'open', opening), mock.patch.object(os, 'scandir', scanning):
                accepted = None
                if change != 'none':
                    with self.assertRaisesRegex(A.AccountingError, 'control version changed'):
                        accepted = ledger.sample()
                    self.assertIsNone(accepted)
                    self.assertIsNone(ledger.receipt['lastBytes'])
                    self.assertEqual(ledger.receipt['samples'], int(prior))
                    self.assertEqual(ledger.receipt['failures'], 1)
                else:
                    accepted = ledger.sample()
                    self.assertGreaterEqual(accepted['bytes'], 24*MIB)
                    self.assertLessEqual(accepted['bytes'], 256*MIB)
                    self.assertEqual(ledger.receipt['lastBytes'], accepted['bytes'])
            if phase == 'before-second':
                self.assertEqual(failed_opens, [2])
            if phase != 'absent':
                self.assertEqual(actions, [change])
            for fd in ledger.control_fds.values():
                with self.assertRaises(OSError):
                    os.fstat(fd)

    def test_grow_then_unlink_before_real_second_open(self):
        self.exercise('grow')

    def test_rewrite_then_unlink_before_real_second_open(self):
        self.exercise('rewrite')

    def test_mode_then_unlink_before_real_second_open(self):
        self.exercise('mode')

    def test_consumed_inode_mutation_before_final_enumeration(self):
        self.exercise('grow', 'before-final')

    def test_consumed_inode_rewrite_before_final_enumeration(self):
        self.exercise('rewrite', 'before-final')

    def test_consumed_inode_mode_before_final_enumeration(self):
        self.exercise('mode', 'before-final')

    def test_rejection_clears_previously_accepted_receipt(self):
        self.exercise('grow', prior=True)

    def test_unchanged_unlink_before_real_second_open(self):
        self.exercise('none')

    def test_unchanged_unlink_after_real_second_open(self):
        self.exercise('none', 'after-second')

    def test_unchanged_consumed_before_final_enumeration(self):
        self.exercise('none', 'before-final')

    def test_absent_control(self):
        self.exercise('none', 'absent')


if __name__ == '__main__':
    unittest.main()
