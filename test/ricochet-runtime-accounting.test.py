#!/usr/bin/env python3
"""SOURCE/TEST ONLY. No guest or network operations."""
import ast
import hashlib
import importlib.util
import json
import os
import pathlib
import runpy
import sys
import tempfile
import time
import unittest
from unittest import mock

R = pathlib.Path(__file__).resolve().parents[1]
D = R/'docs/reviews/ricochet-consumed-control-accounting-repair-oct27'
SOURCE = R/'docs/reviews/ricochet-measured-cpu-round-gameplay-oct27/remote-tools/remote-supervisor.py'

def module(name, p):
    spec = importlib.util.spec_from_file_location(name, p)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

A = module('accounting', R/'tools/ricochet/runtime-accounting.py')
I = module('integration', D/'integrate.py')
MIB = 1048576


class AccountingTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.h = pathlib.Path(self.tmp.name)
        self.serial = self.h/'serial'
        self.serial.mkdir()
        self.control = self.serial/'continue.json'
        self.retained = self.h/'retained.bin'
        self.retained.write_bytes(b'x'*8192)

    def ledger(self, **kw):
        return A.RuntimeAccounting([self.h], ephemeral_files={self.control: 65536},
                                   ceiling=kw.pop('ceiling', MIB), **kw)

    def consume_on_stat(self, target=None):
        target = target or self.control
        real = os.stat
        consumed = []
        def racing(path, *args, **kw):
            if path == target.name and kw.get('dir_fd') is not None and not consumed:
                target.unlink()
                consumed.append(str(target))
            return real(path, *args, **kw)
        return racing, consumed

    def test_00_exact_transformed_production_boundary(self):
        self.control.write_text('{}')
        (self.h/'guest').mkdir()
        # First prove the unchanged pinned production check's causal failure.
        tree=ast.parse(SOURCE.read_bytes())
        check=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='check')
        class Paths:
            @staticmethod
            def Path(p):
                return self.h/'unused' if str(p)=='/tmp/ricochet-cleanup-round-play-oct27' else pathlib.Path(p)
        g=dict(H=self.h,E=self.h/'guest',pathlib=Paths)
        exec(compile(ast.Module(body=[check],type_ignores=[]),str(SOURCE),'exec'),g)
        real=pathlib.Path.stat;hits=[]
        def original_race(p,*args,**kw):
            if p==self.control:
                hits.append(True)
                if len(hits)==2:p.unlink()
            return real(p,*args,**kw)
        with mock.patch.object(pathlib.Path,'stat',original_race),self.assertRaises(FileNotFoundError):
            g['check']()
        self.assertEqual(len(hits),2)
        self.assertEqual(self.retained.stat().st_size,8192)
        self.control.write_text('{}')
        other = self.h.parent/(self.h.name+'-other')
        other.mkdir()
        self.addCleanup(other.rmdir)
        # Run the COMPLETE transformed production entry, including its real
        # initializer/check/supervisor. Only remote-child is a tiny no-guest
        # process fixture; the historical cutoff clock is frozen for this test.
        for dest,source in [('runtime-accounting.py',R/'tools/ricochet/runtime-accounting.py'),
                            ('trusted-supervisor.py',SOURCE.parent/'trusted-supervisor.py')]:
            (self.h/dest).write_bytes(source.read_bytes())
        (self.h/'remote-child.py').write_text('import sys;assert sys.argv[1]=="guest"\n')
        pins={str(p):hashlib.sha256(p.read_bytes()).hexdigest()
              for p in [self.retained,self.h/'runtime-accounting.py',
                        self.h/'trusted-supervisor.py',self.h/'remote-child.py']}
        candidate = I.transform(SOURCE.read_bytes(), pins, str(other))
        runner=self.h/'remote-supervisor.py';runner.write_bytes(candidate)
        racing, consumed = self.consume_on_stat()
        with mock.patch.object(os,'stat',racing),mock.patch.object(sys,'argv',[str(runner),'guest']),mock.patch.dict(os.environ),mock.patch.object(time,'time',return_value=0):
            runpy.run_path(str(runner),run_name='__main__')
        receipt=json.loads((self.h/'guest/supervision.json').read_text())
        self.assertIsNone(receipt['stopReason'])
        self.assertEqual(receipt['exit'],0)
        self.assertTrue(receipt['cleanupComplete'])
        self.assertEqual(consumed,[str(self.control)])
        self.assertGreaterEqual(receipt['accounting']['lastBytes'],24*MIB+self.retained.stat().st_blocks*512)
        self.assertGreaterEqual(receipt['accounting']['samples'],2)
        self.assertEqual(candidate.count(b'rss_limit=3221225472,cpu_limit=300,wall_limit=180,output_limit=2097152'),1)
        self.assertIn(b"if time.time()>=1793093400:return 'guest-cutoff'",candidate)

    def test_consumption_after_descriptor_open(self):
        self.control.write_text('{}')
        ledger = self.ledger()
        # Unlink after open and descriptor accounting, before path validation.
        real_stat = os.stat
        hit = []
        def racing(path,*args,**kw):
            if path==self.control.name and kw.get('dir_fd') is not None:
                hit.append(True)
                if len(hit)==2:self.control.unlink()
            return real_stat(path,*args,**kw)
        with mock.patch.object(os,'stat',racing):
            result = ledger.sample()
        self.assertGreaterEqual(result['bytes'],65536+8192)

    def test_consumption_immediately_after_open(self):
        self.control.write_text('{}')
        ledger=self.ledger();real=os.open;done=[]
        def racing(name,*args,**kw):
            fd=real(name,*args,**kw)
            if name==self.control.name and not done:
                self.control.unlink();done.append(True)
            return fd
        with mock.patch.object(os,'open',racing):r=ledger.sample()
        self.assertGreaterEqual(r['bytes'],65536+8192)

    def test_missing_retained_between_enumeration_and_stat_rejects(self):
        ledger = self.ledger()
        racing,_ = self.consume_on_stat(self.retained)
        with mock.patch.object(os,'stat',racing),self.assertRaises(A.AccountingError):
            ledger.sample()

    def test_missing_retained_between_samples_rejects(self):
        ledger=self.ledger();ledger.sample();self.retained.unlink()
        with self.assertRaises(A.AccountingError):ledger.sample()

    def test_immutable_change_and_missing_reject(self):
        pins={self.retained:hashlib.sha256(self.retained.read_bytes()).hexdigest()}
        ledger=self.ledger(immutable_files=pins);ledger.sample()
        self.retained.write_bytes(b'y'*8192)
        with self.assertRaises(A.AccountingError):ledger.sample()
        ledger=self.ledger(immutable_files=pins);self.retained.unlink()
        with self.assertRaises(A.AccountingError):ledger.sample()

    def test_immutable_metadata_only_change_rejects(self):
        pins={self.retained:hashlib.sha256(self.retained.read_bytes()).hexdigest()}
        ledger=self.ledger(immutable_files=pins);ledger.sample()
        self.retained.chmod(0o600)
        with self.assertRaises(A.AccountingError):ledger.sample()

    def test_live_growth_and_peak_ceiling(self):
        ledger=self.ledger(ceiling=128*1024);first=ledger.sample()['bytes']
        self.retained.write_bytes(b'x'*32768)
        self.assertGreater(ledger.sample()['bytes'],first)
        self.retained.write_bytes(b'x'*(128*1024))
        with self.assertRaisesRegex(A.AccountingError,'ceiling'):ledger.sample()
        self.assertGreater(ledger.receipt['peakBytes'],128*1024)
        self.assertIsNone(ledger.receipt['lastBytes'])

    def test_growth_during_descriptor_sample_charged(self):
        ledger=self.ledger();real=os.open;done=[]
        def growing(name,*args,**kw):
            fd=real(name,*args,**kw)
            if name==self.retained.name and not done:
                self.retained.write_bytes(b'z'*32768);done.append(True)
            return fd
        with mock.patch.object(os,'open',growing):r=ledger.sample()
        self.assertGreaterEqual(r['sizes'][self.retained],32768)

    def test_sparse_logical_growth_above_cap_rejects(self):
        with self.retained.open('r+b') as f:f.truncate(2*MIB)
        with self.assertRaises(A.AccountingError):self.ledger().sample()

    def test_unexpected_replacement_between_samples(self):
        ledger=self.ledger();ledger.sample();replacement=self.h/'new'
        replacement.write_bytes(b'x'*8192);replacement.replace(self.retained)
        with self.assertRaises(A.AccountingError):ledger.sample()

    def test_replace_between_stat_and_open_rejects(self):
        replacement=self.h/'replacement';replacement.write_text('new')
        real=os.open;done=[]
        def racing(name,*args,**kw):
            if name==self.retained.name and not done:
                replacement.replace(self.retained);done.append(True)
            return real(name,*args,**kw)
        with mock.patch.object(os,'open',racing),self.assertRaises(A.AccountingError):
            self.ledger().sample()

    def test_replace_after_descriptor_open_rejects(self):
        replacement=self.h/'replacement';replacement.write_text('new')
        real=os.stat;done=[]
        def racing(name,*args,**kw):
            if name==self.retained.name and kw.get('dir_fd') is not None:
                done.append(True)
                if len(done)==2:replacement.replace(self.retained)
            return real(name,*args,**kw)
        with mock.patch.object(os,'stat',racing),self.assertRaises(A.AccountingError):
            self.ledger().sample()

    def test_symlink_and_hardlink_confinement(self):
        for kind in ('symlink','hardlink'):
            with self.subTest(kind=kind):
                p=self.serial/'bad'
                if kind=='symlink':p.symlink_to(self.retained)
                else:os.link(self.retained,p)
                with self.assertRaises(A.AccountingError):self.ledger().sample()
                p.unlink()

    def test_control_link_and_replacement_races(self):
        for kind in ('symlink','hardlink','replacement'):
            with self.subTest(kind=kind):
                self.control.write_text('{}')
                replacement=self.h/'replacement';replacement.write_text('new')
                real=os.open;done=[]
                def racing(name,*args,**kw):
                    if name==self.control.name and not done:
                        self.control.unlink()
                        if kind=='symlink':self.control.symlink_to(self.retained)
                        elif kind=='hardlink':os.link(self.retained,self.control)
                        else:replacement.replace(self.control)
                        done.append(True)
                    return real(name,*args,**kw)
                with mock.patch.object(os,'open',racing),self.assertRaises((A.AccountingError,OSError)):
                    self.ledger().sample()
                self.control.unlink()
                if replacement.exists():replacement.unlink()

    def test_control_reservation_and_recreation(self):
        ledger=self.ledger();base=ledger.sample()['bytes']
        self.control.write_text('{}');self.assertEqual(base,ledger.sample()['bytes'])
        self.control.unlink();self.assertEqual(base,ledger.sample()['bytes'])
        self.control.write_text('{"id":2}');self.assertEqual(base,ledger.sample()['bytes'])
        self.control.write_bytes(b'x'*65537)
        with self.assertRaisesRegex(A.AccountingError,'reservation'):ledger.sample()

    def test_root_and_parent_symlink_rejected(self):
        alias=self.h/'alias';alias.symlink_to(self.serial,target_is_directory=True)
        with self.assertRaises(OSError):A.RuntimeAccounting([alias],ephemeral_files={},ceiling=MIB)
        with self.assertRaises(OSError):A.RuntimeAccounting([alias/'nested'],ephemeral_files={},ceiling=MIB)

    def test_mandatory_root_replacement_rejected(self):
        ledger=self.ledger();moved=self.h.parent/(self.h.name+'-moved')
        self.h.rename(moved);self.h.mkdir()
        try:
            with self.assertRaises(A.AccountingError):ledger.sample()
        finally:
            self.h.rmdir();moved.rename(self.h)

    def test_bounds_and_configuration(self):
        with self.assertRaises(A.AccountingError):self.ledger(max_entries=1).sample()
        with self.assertRaises(ValueError):self.ledger(max_seconds=2)
        with self.assertRaises(ValueError):A.RuntimeAccounting([self.h,self.serial],ephemeral_files={},ceiling=MIB)
        with self.assertRaises(ValueError):A.RuntimeAccounting([self.h],ephemeral_files={self.h.parent/'outside':1},ceiling=MIB)

    def test_integration_rejects_wrong_source_or_missing_closure(self):
        with self.assertRaises(AssertionError):I.transform(SOURCE.read_bytes()+b'\n',{'x':'0'*64})
        with self.assertRaises(AssertionError):I.transform(SOURCE.read_bytes(),{})

    def test_unchanged_supervisor_enforces_cpu_wall_rss_and_cleanup(self):
        p=R/'docs/reviews/ricochet-measured-cpu-round-gameplay-oct27/remote-tools/trusted-supervisor.py'
        self.assertEqual(hashlib.sha256(p.read_bytes()).hexdigest(),
                         '9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85')
        supervisor=module('trusted_fixture',p)
        cases=[('wall deadline','import time;time.sleep(2)',dict(wall_limit=.04)),
               ('aggregate CPU limit','while True: pass',dict(cpu_limit=.04)),
               ('aggregate RSS limit','import time;x=bytearray(40*1048576);time.sleep(2)',dict(rss_limit=32*MIB))]
        for expected,code,limits in cases:
            with self.subTest(expected=expected):
                out=self.h/'fixture.stdout';err=self.h/'fixture.stderr'
                cmd=['bash','-c','exec "$@" >"'+str(out)+'" 2>"'+str(err)+'"','capture',sys.executable,'-S','-c',code]
                r=supervisor.supervise(cmd,rss_limit=96*MIB,**limits) if 'rss_limit' not in limits else supervisor.supervise(cmd,**limits)
                self.assertEqual(r['stopReason'],expected)
                self.assertTrue(r['cleanupComplete'])
                self.assertTrue(out.exists() and err.exists())

    def test_accounting_rejection_cleans_synthetic_guest_tree(self):
        # A tiny Python tree substitutes for a guest. No game/Node/runtime starts.
        p=R/'docs/reviews/ricochet-measured-cpu-round-gameplay-oct27/remote-tools/trusted-supervisor.py'
        supervisor=module('trusted_cleanup',p)
        ledger=self.ledger(ceiling=128*1024);ledger.sample()
        out=self.h/'synthetic.stdout';err=self.h/'synthetic.stderr'
        code=('import subprocess,sys,time,pathlib;'
              'subprocess.Popen([sys.executable,"-S","-c","import time;time.sleep(5)"]);'
              'time.sleep(.06);pathlib.Path(sys.argv[1]).write_bytes(b"x"*131072);time.sleep(5)')
        cmd=['bash','-c','exec "$@" >"'+str(out)+'" 2>"'+str(err)+'"','capture',sys.executable,'-S','-c',code,str(self.retained)]
        def check():
            if self.retained.stat().st_size>8192:ledger.sample()
        r=supervisor.supervise(cmd,rss_limit=96*MIB,wall_limit=2,check=check)
        self.assertIn('runtime storage ceiling',r['stopReason'])
        self.assertTrue(r['cleanupComplete'])
        self.assertGreaterEqual(len(r['owned']),2)
        for pid,start in r['owned']:
            row=supervisor.snapshot().get(pid)
            self.assertTrue(row is None or row['start']!=start)


if __name__=='__main__':
    unittest.main(verbosity=2)
