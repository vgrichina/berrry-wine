"""Focused final-reopen consistency checks; local fixtures only."""
import importlib.util
import os
import pathlib
import tempfile
import unittest
from unittest import mock

R = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('accounting', R/'tools/ricochet/runtime-accounting.py')
A = importlib.util.module_from_spec(spec)
spec.loader.exec_module(A)
MIB = 1048576


class FinalReopenTests(unittest.TestCase):
    def exercise(self, phase, change, *, unlink=False, prior_sample=False):
        with tempfile.TemporaryDirectory() as temp:
            root = pathlib.Path(temp)
            serial = root/'serial'
            serial.mkdir()
            control = serial/'continue.json'
            control.write_bytes(b'{}')
            ledger = A.RuntimeAccounting([root], ephemeral_files={control:24*MIB}, ceiling=256*MIB)
            if prior_sample:
                ledger.sample()
            real_open, real_stat, real_fstat = os.open, os.stat, os.fstat
            calls, mutations, control_fds = [], [], set()
            initial = control.stat()

            def mutate():
                if mutations:
                    return
                mutations.append(phase)
                if change == 'grow':
                    control.write_bytes(b'{"changedDuringFinalReopen":true}')
                elif change == 'same-size':
                    control.write_bytes(b'[]')
                    os.utime(control, ns=(initial.st_atime_ns, initial.st_mtime_ns+1000000))
                elif change == 'mode':
                    control.chmod(0o600 if initial.st_mode & 0o077 else 0o644)
                if unlink:
                    control.unlink()

            def opening(name, flags, *args, **kwargs):
                is_control = name == 'continue.json' and kwargs.get('dir_fd') is not None
                if is_control:
                    calls.append(name)
                    if len(calls) == 2 and phase == 'before-open':
                        mutate()
                fd = real_open(name, flags, *args, **kwargs)
                if is_control:
                    control_fds.add(fd)
                    if len(calls) == 2 and phase == 'after-open':
                        mutate()
                return fd

            def stating(name, *args, **kwargs):
                if (name == 'continue.json' and kwargs.get('dir_fd') is not None
                        and len(calls) == 2 and phase == 'named-stat'):
                    mutate()
                return real_stat(name, *args, **kwargs)

            with mock.patch.object(os, 'open', opening), mock.patch.object(os, 'stat', stating):
                if change == 'none':
                    result = ledger.sample()
                    self.assertGreaterEqual(result['bytes'], 24*MIB)
                    self.assertLessEqual(result['bytes'], 256*MIB)
                    self.assertEqual(result['sizes'][control], 2)
                    self.assertEqual(ledger.receipt['lastBytes'], result['bytes'])
                else:
                    with self.assertRaisesRegex(A.AccountingError, 'control version changed'):
                        ledger.sample()
                    self.assertIsNone(ledger.receipt['lastBytes'])
                    self.assertEqual(ledger.receipt['samples'], int(prior_sample))
                    self.assertEqual(ledger.receipt['failures'], 1)
            self.assertEqual(len(calls), 2)
            self.assertEqual(mutations, [phase])
            if not unlink:
                self.assertEqual(control.stat().st_ino, initial.st_ino)
            for fd in control_fds | set(ledger.control_fds.values()):
                with self.assertRaises(OSError):
                    real_fstat(fd)

    def test_same_inode_growth_before_final_open(self):
        self.exercise('before-open', 'grow')

    def test_same_size_rewrite_before_final_open(self):
        self.exercise('before-open', 'same-size')

    def test_mode_change_after_final_open(self):
        self.exercise('after-open', 'mode')

    def test_growth_at_final_named_stat(self):
        self.exercise('named-stat', 'grow')

    def test_mutation_then_consumption_rejects(self):
        self.exercise('after-open', 'grow', unlink=True)

    def test_failure_clears_previous_accepted_receipt(self):
        self.exercise('before-open', 'grow', prior_sample=True)

    def test_unchanged_reopen_accepts(self):
        self.exercise('before-open', 'none')

    def test_consumption_after_final_open_accepts(self):
        self.exercise('after-open', 'none', unlink=True)


if __name__ == '__main__':
    unittest.main()
