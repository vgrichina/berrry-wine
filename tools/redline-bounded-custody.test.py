"""Actual bounded custody CLI, late descendants and independent watchdogs."""
import gzip
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('bounded', ROOT/'redline-bounded-custody.py')
bounded = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bounded)
RUN = Path(os.environ['REDLINE_BOUNDED_RUN']).resolve()


class Bounded(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        RUN.mkdir(parents=True)

    def test_source_authentication_and_default_off(self):
        helper, source = bounded.published.load_providers()
        self.assertEqual(bounded.adapt(helper, source, enabled=False), source)
        with self.assertRaisesRegex(ValueError, 'pinned source'):
            bounded.adapt(helper, source+'\n', enabled=True)
        self.assertNotEqual(bounded.adapt(helper, source, enabled=True), source)
        with self.assertRaisesRegex(ValueError, 'explicit bounded custody version'):
            bounded.launch(['wrong'])

    def test_buffer_bound_and_failed_flush(self):
        helper, _ = bounded.published.load_providers()
        run = RUN/'buffer'; run.mkdir()
        observer = bounded.bounded_observer(helper.Observer)(run, None, None)
        with mock.patch.object(bounded.os, 'fsync', wraps=os.fsync) as sync:
            for _ in range(600):
                observer.emit(dict(kind='diagnostic', payload='x'*511))
                self.assertLessEqual(len(observer.buffer), observer.MAX_PENDING_BYTES)
            observer.close()
            self.assertLess(sync.call_count, 10)
        rows = helper.validate((run/'publication-syscalls.ndjson').read_bytes())
        self.assertEqual(len(rows), 602)
        self.assertTrue(rows[-1]['complete'])
        failed = RUN/'failed-flush'; failed.mkdir()
        observer = bounded.bounded_observer(helper.Observer)(failed, None, None)
        with mock.patch.object(bounded.os, 'fsync', side_effect=OSError('durability failure')):
            with self.assertRaisesRegex(OSError, 'durability failure'):
                observer.flush_pending()
        observer.close()

    def actual(self, name, bounds, cancel=False):
        run = RUN/name; run.mkdir()
        deadline = int((time.time()+20)*1000)
        (run/'lifecycle.json').write_text(json.dumps(dict(browserDeadline=deadline)))
        # Python startup fills the small diagnostic budget. The later real
        # fork/exec must still pass durable ownership barriers and be reaped.
        code = """import os,subprocess,sys,time
for i in range(128):
 with open('/dev/null','rb') as f: f.read(1)
subprocess.run([sys.executable,'-c','print("late child")'],check=True)
print('LATE-FORK-JOINED',flush=True)
""" + ('time.sleep(60)' if cancel else '')
        argv = [sys.executable, str(ROOT/'redline-bounded-custody.py'),
                '--bounded-custody='+bounded.VERSION, str(run), '--journal-gzip',
                '--publication-observer='+bounded.published.VERSION, *bounds, '--', sys.executable, '-c', code]
        gate = "import os,sys;assert sys.stdin.readline()=='go\\n';os.execv(sys.argv[1],sys.argv[1:])"
        child = subprocess.Popen([sys.executable, '-c', gate, *argv], stdin=subprocess.PIPE,
                                 stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
        watchcode = "import sys,time,os,signal;print('ARMED',flush=True);time.sleep(30);os.killpg(int(sys.argv[1]),signal.SIGKILL)"
        watcher = subprocess.Popen([sys.executable, '-c', watchcode, str(child.pid)], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        self.assertEqual(watcher.stdout.readline(), b'ARMED\n')
        child.stdin.write(b'go\n'); child.stdin.flush()
        try:
            if cancel:
                due = time.monotonic()+15
                while not (run/'kernel-command.log').exists() or b'LATE-FORK-JOINED' not in (run/'kernel-command.log').read_bytes():
                    self.assertLess(time.monotonic(), due)
                    time.sleep(.02)
                child.terminate()
            stdout, stderr = child.communicate(timeout=28)
        finally:
            if child.poll() is None:
                child.kill(); child.communicate()
            watcher.terminate(); wo, we = watcher.communicate()
            (run/'parent-waits.json').write_text(json.dumps(dict(pid=child.pid, code=child.returncode,
                actualWait=True, stdoutEOF=True, stderrEOF=True, watchdog=dict(pid=watcher.pid,
                code=watcher.returncode, actualWait=True, stdoutEOF=True, stderrEOF=True))))
        (run/'stdout.log').write_bytes(stdout); (run/'stderr.log').write_bytes(stderr)
        self.assertEqual(child.returncode, 1 if cancel else 0, stderr.decode())
        helper, _ = bounded.published.load_providers()
        rows = helper.validate((run/'publication-syscalls.ndjson').read_bytes())
        self.assertFalse(rows[-1]['complete'])
        self.assertIn('record-cap' if '--max-bytes=4096' not in bounds else 'byte-cap', rows[-1]['incompleteReasons'])
        drain = json.loads((run/'kernel-drain.json').read_text())
        self.assertTrue(drain['complete']); self.assertFalse(drain['remaining']); self.assertFalse(drain['unreaped'])
        self.assertGreaterEqual(len(drain['reaped']), 2)
        for task in drain['owned']:
            self.assertTrue(any((r['pid'], r['start']) == (task['pid'], task['start']) for r in drain['reaped']))
            self.assertFalse(Path('/proc', str(task['pid'])).exists())
        journal = [json.loads(l) for l in gzip.decompress((run/'custody.ndjson.gz').read_bytes()).splitlines()]
        self.assertTrue(any(r['kind'] == 'fork-lineage' or
                            (r['kind'] == 'custody' and r['cause'] in ('fork', 'vfork', 'clone')) for r in journal))
        self.assertTrue(any(r['kind'] == 'ptrace-cont-returned' and r.get('actualRequest') == 7 for r in journal))
        self.assertLessEqual(sum(r['kind'] == 'ptrace-syscall-resume-returned' for r in journal), 64,
                             'exhaustion must end syscall stepping, including across the later fork/exec')
        self.assertEqual(drain['exit'], -15 if cancel else 0)
        report = json.loads((run/'publication-validation.json').read_text())
        self.assertNotIn('validationError', report)
        self.assertFalse(report['observerComplete']); self.assertEqual(report['readiness'], 'UNKNOWN')

    def test_record_cap_late_fork(self):
        self.actual('record-cap', ['--max-records=64'])

    def test_minimum_cap_late_fork(self):
        self.actual('minimum-cap', ['--max-records=2'])

    def test_byte_cap_late_fork(self):
        self.actual('byte-cap', ['--max-bytes=4096'])

    def test_cancel_after_cap_late_fork(self):
        self.actual('cancel-after-cap', ['--max-records=64'], cancel=True)


if __name__ == '__main__':
    unittest.main()
