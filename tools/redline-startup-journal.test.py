"""Redline's actual transformed supervisor: durable releases and slow storage.

No Chrome. Uses real fork/exec/wait/ptrace, plus the shared failure models
against this adapter's generated code; the shared providers remain read-only.
"""
import gzip
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import types
import unittest
import zlib
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('bounded', ROOT/'redline-bounded-custody.py')
bounded = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bounded)
OUT = Path(os.environ['REDLINE_JOURNAL_RUN']).resolve()


def load(legacy=False, cap=2):
    helper, source = bounded.published.load_providers()
    helper.Observer = bounded.bounded_observer(helper.Observer)
    generated = bounded.adapt(helper, source, enabled=True, max_records=cap)
    if legacy:
        assert generated.count('defer=True)') == 1
        generated = generated.replace('defer=True)', 'defer=retirement or diagnostic)')
    sys.modules['native_publication_observer'] = helper
    module = types.ModuleType('redline_actual_custody')
    exec(compile(generated, '<redline-actual-custody>', 'exec'), module.__dict__)
    return module


class StartupJournal(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        OUT.mkdir(parents=True)

    def test_actual_executable_release_order(self):
        for cap in (2, 64):
            kernel = load(cap=cap)
            run = OUT/('durable-'+str(cap)); run.mkdir()
            rows = []; last = {}; barriers = []; pure = []; retiring = []
            append = kernel.Journal.append; trace = kernel.ptrace; wait = os.waitpid
            def observed(journal, value, **options):
                result = append(journal, value, **options)
                rows.append(dict(value))
                return result
            def consumed(pid, flags):
                result = wait(pid, flags)
                if result[0]: last[pid] = result[1]
                return result
            def resume(request, pid, addr=0, data=0):
                if request in (kernel.CONT, 24):
                    durable = [json.loads(s) for s in zlib.decompressobj(31).decompress(
                        (run/'custody.ndjson.gz').read_bytes()).splitlines()]
                    status = last[pid]
                    if status >> 16 == 6:
                        self.assertTrue(any(r['kind']=='custody' and r['pid']==pid for r in durable))
                        retiring.append(pid)
                    elif status == (0x85 << 8 | 0x7f):
                        pure.append(pid)
                    else:
                        self.assertEqual(durable, rows, 'complete durable ordered prefix before executable release')
                        barriers.append(dict(pid=pid, request=request, sequence=len(rows)))
                return trace(request, pid, addr, data)
            with patch.object(kernel.Journal, 'append', observed), patch.object(kernel, 'ptrace', resume), patch.object(kernel.os, 'waitpid', consumed):
                kernel.supervise(run, [sys.executable, '-c',
                    'import os;p=os.fork();os.execl("/bin/true","true") if p==0 else os.waitpid(p,0)'],
                    deadline=time.time()+15, cleanup_deadline=time.time()+20, journal_compression='gzip')
            self.assertTrue(barriers); self.assertTrue(retiring)
            if cap == 64: self.assertTrue(pure)
            final = [json.loads(s) for s in gzip.decompress((run/'custody.ndjson.gz').read_bytes()).splitlines()]
            self.assertEqual(final, rows)
            drain = json.loads((run/'kernel-drain.json').read_text())
            self.assertTrue(drain['complete']); self.assertEqual(len(drain['owned']),len(drain['reaped']))
            (run/'barriers.json').write_text(json.dumps(dict(barriers=barriers, pureSyscallReleases=len(pure), irreversibleReleases=len(retiring))))

    def test_sticky_failure_final_sync_and_bounded_pressure(self):
        spec = importlib.util.spec_from_file_location('controls', ROOT/'native_kernel_custody_test.py')
        controls = importlib.util.module_from_spec(spec); spec.loader.exec_module(controls)
        controls.kernel = load()
        names = ['test_bounded_ordered_batches_and_oversize_record_preserve_all_bytes',
                 'test_failed_sync_is_sticky_at_saturation_admission_and_finalization',
                 'test_final_sync_failure_cannot_accept_fully_reaped_run',
                 'test_gzip_footer_requires_its_own_successful_final_sync']
        result = unittest.TestResult()
        unittest.TestSuite(controls.RetirementService(n) for n in names).run(result)
        (OUT/'failure-controls.json').write_text(json.dumps(dict(tests=result.testsRun, errors=result.errors, failures=result.failures)))
        self.assertTrue(result.wasSuccessful(), result.errors+result.failures)

    def test_slow_storage_causal_control(self):
        pressure = []
        for legacy in (True, False):
            kernel = load(legacy=legacy)
            run = OUT/('old' if legacy else 'batched'); run.mkdir()
            sync = os.fsync; calls = []
            def slow(fd):
                calls.append(time.monotonic_ns()); time.sleep(.012); return sync(fd)
            begin = time.monotonic()
            with patch.object(kernel.os, 'fsync', side_effect=slow):
                kernel.supervise(run, [sys.executable, '-c',
                    'import os;ps=[]\nfor i in range(12):\n p=os.fork()\n if p==0:os.execl("/bin/true","true")\n ps.append(p)\nfor p in ps:os.waitpid(p,0)'],
                    deadline=time.time()+20, cleanup_deadline=time.time()+25, journal_compression='gzip')
            elapsed = time.monotonic()-begin
            drain = json.loads((run/'kernel-drain.json').read_text())
            self.assertTrue(drain['complete']); self.assertEqual(len(drain['owned']),13); self.assertEqual(len(drain['reaped']),13)
            pressure.append(dict(legacy=legacy, fsyncs=len(calls), elapsed=elapsed, owned=13, reaped=13))
        (OUT/'pressure.json').write_text(json.dumps(pressure, indent=2))
        self.assertLess(pressure[1]['fsyncs'], pressure[0]['fsyncs']*.7)
        self.assertLess(pressure[1]['elapsed'], pressure[0]['elapsed']*.8)


if __name__ == '__main__':
    unittest.main(verbosity=2)
