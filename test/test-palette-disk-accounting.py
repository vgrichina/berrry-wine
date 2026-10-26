#!/usr/bin/env python3
"""Offline controls at the shared ledger and retained production callback boundary."""
import ast
import errno
import importlib.util
import json
import os
import pathlib
import shutil
import tempfile
import types
import unittest
from unittest import mock

P = pathlib.Path
ROOT = P(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('supervisor', ROOT/'test/helpers/palette-browser-supervisor.py')
sup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sup)
M = 1048576
WRAPPER = ROOT/'test/fixtures/gl-transient-accounting/remote-run.py'


def callback(root, source=None):
    """Execute the EXACT retained functions and ledger initializer, no guest code."""
    tree = ast.parse(WRAPPER.read_text() if source is None else source)
    nodes = [n for n in tree.body if
             isinstance(n, ast.FunctionDef) and n.name in ('alloc', 'check') or
             isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'disk' for t in n.targets)]
    ns = dict(H=root, P=P, M=M, sup=sup, shutil=shutil, future=352*M,
              accounting=dict(samples=0, peakProjected=0, minFree=None, minMem=None))
    exec(compile(ast.Module(body=nodes, type_ignores=[]), str(WRAPPER), 'exec'), ns)
    return ns


class Accounting(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = P(self.temp.name)
        self.tmp = self.root/'tmp'
        self.tmp.mkdir()
        self.required = self.root/'required'
        self.required.write_bytes(b'r'*16384)

    def ledger(self, **kw):
        return sup.AllocatedDisk([self.root], transient_roots=[self.tmp], **kw)

    def victim(self, kind):
        p = self.tmp/'SingletonSocket'
        if kind == 'dir':
            p.mkdir()
        elif kind == 'symlink':
            p.symlink_to('/outside/Chromium/socket')
        else:
            p.write_bytes(b'x'*4096)
        return p

    def disappearing(self, victim, *, action=None, repeat=False):
        original = os.stat
        fired = []
        def stat(name, *a, **kw):
            fd = kw.get('dir_fd')
            parent = P(os.readlink('/proc/self/fd/'+str(fd))) if fd is not None else None
            if parent == victim.parent and name == victim.name and (repeat or not fired):
                fired.append(True)
                if action:
                    action()
                else:
                    victim.rmdir() if victim.is_dir() else victim.unlink()
            return original(name, *a, **kw)
        return mock.patch.object(sup.os, 'stat', stat), fired

    def test_production_discovery_races(self):
        for kind in ('file', 'symlink', 'dir'):
            with self.subTest(kind=kind):
                v = self.victim(kind)
                ns = callback(self.root)
                patch, fired = self.disappearing(v)
                with patch:
                    self.assertIsNone(ns['check']())
                self.assertEqual(len(fired), 1)
                self.assertEqual(ns['disk'].receipt['retries'], 1)
                expected = sum(p.lstat().st_blocks*512 for p in [self.root,self.tmp,self.required])
                self.assertEqual(ns['accounting']['peakProjected'], expected+352*M)

    def test_production_cap_and_headroom(self):
        ns = callback(self.root)
        with mock.patch.object(shutil, 'disk_usage', return_value=types.SimpleNamespace(free=2982150144+352*M-1)):
            self.assertEqual(ns['check'](), 'remote free floor')
        ns['future'] = 1024*M
        self.assertEqual(ns['check'](), 'complete remote disk cap')
        self.assertEqual(ns['disk'].ceiling, 1024*M)

    def test_production_omitted_accounting_hook_is_detected(self):
        # Same discovery race must actually fire at the production callback.
        source = WRAPPER.read_text().replace('used=alloc(H);', 'used=0;')
        v = self.victim('file')
        ns = callback(self.root, source)
        patch, fired = self.disappearing(v)
        with patch:
            ns['check']()
        self.assertFalse(fired)
        self.assertLess(ns['accounting']['peakProjected'], self.required.stat().st_blocks*512+352*M)

    def test_omitted_transient_wiring_rejects_same_reproducer(self):
        source = WRAPPER.read_text().replace('transient_roots=[H/\'tmp\']', 'transient_roots=[]')
        v = self.victim('file')
        ns = callback(self.root, source)
        patch, fired = self.disappearing(v)
        with patch, self.assertRaises(sup.AccountingUnknown):
            ns['check']()
        self.assertTrue(fired)

    def test_shared_check_and_positive_wal_once(self):
        with tempfile.TemporaryDirectory() as w:
            wal = P(w)/'wal'
            wal.write_bytes(b'x'*4096)
            baseline = wal.stat().st_blocks*512
            check = sup.accounting_check(dict(roots=[str(self.root)],transientRoots=[str(self.tmp)],reserve=8*M,future=M,walBaseline={str(wal):baseline}))
            v = self.victim('symlink')
            patch, fired = self.disappearing(v)
            with patch:
                self.assertIsNone(check())
            before = check.receipt['peakBytes']
            wal.write_bytes(b'x'*16384)
            self.assertIsNone(check())
            self.assertEqual(check.receipt['peakBytes']-before, wal.stat().st_blocks*512-baseline)
            wal.write_bytes(b'x')
            self.assertIsNone(check())
            with self.assertRaisesRegex(ValueError, 'once'):
                sup.accounting_check(dict(roots=[str(self.root)],reserve=8*M,future=0,walBaseline={str(self.required):0}))

    def test_io_faults_preserved(self):
        for e in (PermissionError(errno.EACCES,'denied'), OSError(errno.EIO,'I/O')):
            v = self.tmp/'bad'
            v.write_bytes(b'x')
            ledger = self.ledger()
            def fault():
                raise e
            patch, fired = self.disappearing(v, action=fault)
            with patch, self.assertRaises(type(e)) as seen:
                ledger.allocated()
            self.assertEqual(seen.exception.errno, e.errno)
            self.assertEqual(ledger.receipt['unknown'], 1)
            self.assertIsNone(ledger.receipt['lastBytes'])

    def test_unverified_enoent_is_unknown(self):
        v = self.victim('file')
        ledger = self.ledger()
        def fault():
            raise FileNotFoundError(errno.ENOENT, 'injected without mutation')
        patch, _ = self.disappearing(v, action=fault)
        with patch, self.assertRaisesRegex(sup.AccountingUnknown, 'unverified'):
            ledger.allocated()

    def test_missing_required_root_and_transient_root(self):
        for p in (self.tmp, self.required):
            if p == self.tmp:
                ledger = self.ledger()
                p.rmdir()
            else:
                ledger = sup.AllocatedDisk([p])
                p.unlink()
            with self.assertRaises(FileNotFoundError):
                ledger.allocated()
        with self.assertRaises(FileNotFoundError):
            self.ledger()

    def test_required_disappearance_does_not_retry_or_zero(self):
        ledger = self.ledger()
        patch, fired = self.disappearing(self.required)
        with patch, self.assertRaises(sup.AccountingUnknown):
            ledger.allocated()
        self.assertTrue(fired)
        self.assertEqual(ledger.receipt['retries'], 0)

    def test_root_replacement_and_symlink_ancestors(self):
        ledger = self.ledger()
        self.tmp.rename(self.root/'old-tmp')
        self.tmp.mkdir()
        with self.assertRaisesRegex(sup.AccountingUnknown,'root changed'):
            ledger.allocated()
        alias = self.root/'alias'
        alias.symlink_to(self.tmp, target_is_directory=True)
        for root in (alias,alias/'child'):
            with self.assertRaises(OSError):
                sup.AllocatedDisk([root])
        with self.assertRaises(ValueError):
            sup.AllocatedDisk([self.root/'..'/self.root.name])
        with self.assertRaises(ValueError):
            sup.AllocatedDisk([self.root],transient_roots=[self.root])

    def test_symlinks_are_charged_without_following(self):
        v = self.victim('symlink')
        ledger = self.ledger()
        expected = sum(p.lstat().st_blocks*512 for p in [self.root,self.tmp,self.required,v])
        self.assertEqual(ledger.allocated(),expected)
        v.unlink()
        v.symlink_to(self.root, target_is_directory=True)
        self.assertEqual(ledger.allocated(),sum(p.lstat().st_blocks*512 for p in [self.root,self.tmp,self.required,v]))

    def test_directory_replaced_with_escape_cannot_be_followed(self):
        v = self.victim('dir')
        ledger = self.ledger()
        original = os.open
        fired = []
        def opening(name,*a,**kw):
            if name == v.name and kw.get('dir_fd') is not None and not fired:
                fired.append(True)
                v.rmdir()
                v.symlink_to('/etc',target_is_directory=True)
            return original(name,*a,**kw)
        with mock.patch.object(os,'open',opening), self.assertRaises(OSError):
            ledger.allocated()
        self.assertTrue(fired)

    def test_open_disappearance_retries(self):
        v = self.victim('dir')
        ledger = self.ledger()
        original = os.open
        fired = []
        def opening(name,*a,**kw):
            if name == v.name and kw.get('dir_fd') is not None and not fired:
                fired.append(True);v.rmdir()
            return original(name,*a,**kw)
        with mock.patch.object(os,'open',opening):
            self.assertGreaterEqual(ledger.allocated(),self.required.stat().st_blocks*512)
        self.assertEqual(ledger.receipt['retries'],1)

    def test_endless_churn_is_unknown(self):
        v = self.victim('file')
        ledger = self.ledger()
        n = []
        def churn():
            n.append(True)
            v.write_bytes(b'changed' * (len(n)+1))
        patch, _ = self.disappearing(v, action=churn, repeat=True)
        with patch, self.assertRaisesRegex(sup.AccountingUnknown,'consistency unknown'):
            ledger.allocated()
        self.assertEqual(ledger.receipt['retries'],3)
        self.assertEqual(ledger.receipt['samples'],0)
        self.assertIsNone(ledger.receipt['lastBytes'])

    def test_bounds_and_ceiling(self):
        for options in (dict(max_entries=2),dict(ceiling=1),dict(max_seconds=1e-12)):
            with self.subTest(options=options),self.assertRaises(sup.AccountingUnknown):
                self.ledger(**options).allocated()
        (self.tmp/'a').mkdir()
        (self.tmp/'a'/'b').write_text('x')
        with self.assertRaisesRegex(sup.AccountingUnknown,'traversal bound'):
            self.ledger(max_depth=1).allocated()

    def test_required_data_mutation_is_unknown(self):
        ledger = self.ledger()
        original = os.stat
        fired = []
        def changing(name, *a, **kw):
            value = original(name, *a, **kw)
            if name == self.required.name and kw.get('dir_fd') is not None and not fired:
                fired.append(True)
                self.required.write_bytes(b'changed')
            return value
        with mock.patch.object(os, 'stat', changing), self.assertRaises(sup.AccountingUnknown):
            ledger.allocated()

    def test_required_deletion_between_samples_is_unknown(self):
        ledger = self.ledger()
        ledger.allocated()
        self.required.unlink()
        with self.assertRaisesRegex(sup.AccountingUnknown, 'between samples'):
            ledger.allocated()

    def test_required_file_versions_at_actual_callbacks(self):
        for boundary in ('production', 'shared'):
            for mutation in ('truncate', 'rewrite', 'chmod'):
                with self.subTest(boundary=boundary, mutation=mutation):
                    self.required.write_bytes(b'r'*16384)
                    if boundary == 'production':
                        check = callback(self.root)['check']
                    else:
                        check = sup.accounting_check(dict(roots=[str(self.root)],
                            transientRoots=[str(self.tmp)], reserve=8*M,
                            future=0, walBaseline={}))
                    self.assertIsNone(check())
                    before = self.required.stat()
                    # Give the filesystem's ctime clock a distinct tick. A
                    # metadata inventory cannot detect an all-metadata-equal
                    # rewrite; this control must actually change a version.
                    sup.time.sleep(.02)
                    if mutation == 'chmod':
                        self.required.chmod(before.st_mode ^ 0o100)
                    else:
                        self.required.write_bytes(b'' if mutation == 'truncate' else b'z'*16384)
                        # A writer restoring mtime must still fail on ctime/version.
                        os.utime(self.required, ns=(before.st_atime_ns, before.st_mtime_ns))
                    self.assertEqual(self.required.stat().st_ino, before.st_ino)
                    self.assertNotEqual(sup.AllocatedDisk._version(before),
                                        sup.AllocatedDisk._version(self.required.stat()))
                    with self.assertRaisesRegex(sup.AccountingUnknown, 'file version'):
                        check()

    def test_partial_retry_preserves_first_observed_file_version(self):
        # Before any successful sample, a retry must not reset a version that
        # was observed in a discarded partial walk at the production boundary.
        ns = callback(self.root)
        ledger = ns['disk']
        charge = ledger._charge
        fired = []
        def changing(s, depth, p):
            charge(s, depth, p)
            if p == self.required and not fired:
                fired.append(True)
                self.required.write_bytes(b'')
                raise sup._TransientMutation(str(self.tmp))
        with mock.patch.object(ledger, '_charge', changing), self.assertRaisesRegex(sup.AccountingUnknown, 'file version'):
            ns['check']()
        self.assertEqual(ledger.receipt['retries'], 1)
        self.assertEqual(ledger.receipt['samples'], 0)
        self.assertIsNone(ledger.receipt['lastBytes'])

    def test_mandatory_directory_namespace_and_transient_churn(self):
        ns = callback(self.root)
        check = ns['check']
        self.assertIsNone(check())
        # A directory timestamp change alone is not an input version change.
        for p in (self.root, self.tmp):
            s = p.stat()
            os.utime(p, ns=(s.st_atime_ns, s.st_mtime_ns+1000000))
        v = self.tmp/'new'
        v.write_bytes(b'x'*8192)
        self.assertIsNone(check())
        v.unlink()
        self.assertIsNone(check())
        # The mandatory namespace is frozen independently of timestamps.
        s = self.root.stat()
        (self.root/'unregistered-input').write_bytes(b'n')
        os.utime(self.root, ns=(s.st_atime_ns, s.st_mtime_ns))
        with self.assertRaisesRegex(sup.AccountingUnknown, 'namespace changed'):
            check()

    def test_mutable_file_policy_cannot_cover_namespace_or_replacement(self):
        for options in (dict(mutable_file_roots=[self.tmp]),
                        dict(mutable_file_roots=[self.required])):
            with self.assertRaises(ValueError):
                self.ledger(**options)
        with self.assertRaisesRegex(sup.AccountingUnknown, 'not a regular file'):
            sup.AllocatedDisk([self.tmp], mutable_file_roots=[self.tmp])
        ledger = sup.AllocatedDisk([self.required], mutable_file_roots=[self.required])
        ledger.allocated()
        self.required.rename(self.root/'old')
        self.required.write_bytes(b'r')
        with self.assertRaises(sup.AccountingUnknown):
            ledger.allocated()

    def test_required_replacement_between_samples_is_unknown(self):
        ledger = self.ledger()
        ledger.allocated()
        self.required.rename(self.root/'old-required')
        self.required.write_text('replacement')
        with self.assertRaisesRegex(sup.AccountingUnknown, 'replaced'):
            ledger.allocated()

    def test_partial_retry_cannot_lose_required_inventory(self):
        ledger = self.ledger()
        v = self.victim('file')
        # A prior observed required entry cannot disappear behind a tmp retry.
        ledger.allocated()
        def remove_both():
            self.required.unlink()
            v.unlink()
        patch, _ = self.disappearing(v, action=remove_both)
        with patch, self.assertRaises(sup.AccountingUnknown):
            ledger.allocated()

    def test_transient_root_symlink_replacement_is_rejected(self):
        ledger = self.ledger()
        self.tmp.rmdir()
        self.tmp.symlink_to('/etc', target_is_directory=True)
        with self.assertRaises(OSError):
            ledger.allocated()

    def test_shared_cap_headroom_memory(self):
        config = dict(roots=[str(self.root)], reserve=8*M, future=0, walBaseline={})
        check = sup.accounting_check(config)
        with mock.patch.object(shutil, 'disk_usage',return_value=types.SimpleNamespace(free=2982150144+8*M-1)):
            self.assertEqual(check(), 'projected host disk floor')
        original = P.read_text
        def read(p,*a,**kw):
            return 'MemAvailable: 1 kB\n' if p == P('/proc/meminfo') else original(p,*a,**kw)
        with mock.patch.object(P,'read_text',read):
            self.assertEqual(check(),'host memory remainder')
        config['future'] = 64*M
        self.assertEqual(sup.accounting_check(config)(), 'aggregate disk limit')

    def test_filesystem_escape_is_unknown(self):
        v = self.victim('file')
        ledger = self.ledger()
        original = os.stat
        def foreign(name,*a,**kw):
            s = original(name,*a,**kw)
            if name == v.name and kw.get('dir_fd') is not None:
                fields = {k:getattr(s,k) for k in dir(s) if k.startswith('st_')}
                fields['st_dev'] += 1
                return types.SimpleNamespace(**fields)
            return s
        with mock.patch.object(os,'stat',foreign), self.assertRaisesRegex(sup.AccountingUnknown,'crossed filesystem'):
            ledger.allocated()

    def test_final_root_validation_deadline_and_root_count(self):
        ledger = self.ledger()
        original = ledger._validate_roots
        clock = [0]
        calls = []
        def validate():
            calls.append(True)
            if len(calls) == 2:
                clock[0] = 2
            return original()
        with mock.patch.object(sup.time,'monotonic',lambda:clock[0]), mock.patch.object(ledger,'_validate_roots',validate), self.assertRaisesRegex(sup.AccountingUnknown,'time bound'):
            ledger.allocated()
        with self.assertRaisesRegex(ValueError,'root inventory bound'):
            self.ledger(max_entries=1)


if __name__ == '__main__':
    unittest.main(verbosity=2)
