"""Offline actual CLI/custody tests. No browser, Box or native application."""
import gzip
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
import unittest
from unittest import mock

import native_publication_launch as launcher
from native_publication_observer_test import C

ROOT = Path(__file__).resolve().parent
RUN = Path(os.environ.get('LAUNCH_RUN', 'scratch/runs/20261109-redline-publication-observer-launcher-1505')).resolve()


class CLI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        RUN.mkdir(parents=True, exist_ok=True)
        cls.tmp = tempfile.TemporaryDirectory()
        cls.base = Path(cls.tmp.name)
        src = cls.base/'writer.c'; src.write_text(C)
        cls.exe = cls.base/'writer'
        subprocess.run(['cc', '-Wall', '-Werror', '-O0', str(src), '-o', str(cls.exe)], check=True)
        (RUN/'compiler.json').write_text(json.dumps(dict(
            command=['cc', '-Wall', '-Werror', '-O0', str(src), '-o', str(cls.exe)],
            version=subprocess.check_output(['cc', '--version'], text=True).splitlines()[0],
            input='C constant in native_publication_observer_test.py at d54aa57e3',
            sourceSha256=hashlib.sha256(C.encode()).hexdigest(),
            executableSha256=hashlib.sha256(cls.exe.read_bytes()).hexdigest())))

    @classmethod
    def tearDownClass(cls): cls.tmp.cleanup()

    def execute(self, name, command, options=(), cancel=False, expected=0, deadline_seconds=8):
        run = RUN/name
        run.mkdir() # Never overwrite a previous run's evidence.
        deadline = (time.time()+deadline_seconds)*1000
        (run/'lifecycle.json').write_text(json.dumps(dict(browserDeadline=deadline)))
        argv = [sys.executable, str(ROOT/'native_publication_launch.py'), str(run), *options, '--', *command]
        # Gate the exec until an independent sibling watchdog is observably armed.
        gate = 'import os,sys; assert sys.stdin.readline()=="go\\n"; os.execv(sys.argv[1],sys.argv[1:])'
        child = subprocess.Popen([sys.executable, '-c', gate, *argv], stdin=subprocess.PIPE,
                                 stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        watchdog_code = '''import os,signal,sys,time
print('ARMED',flush=True)
time.sleep(15)
try: os.kill(int(sys.argv[1]),signal.SIGTERM)
except ProcessLookupError: pass
time.sleep(3)
try: os.kill(int(sys.argv[1]),signal.SIGKILL)
except ProcessLookupError: pass
'''
        watchdog = subprocess.Popen([sys.executable, '-c', watchdog_code, str(child.pid)],
                                    stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        self.assertEqual(watchdog.stdout.readline().strip(), 'ARMED')
        (run/'watchdog-armed.json').write_text(json.dumps(dict(pid=watchdog.pid, target=child.pid, finiteSeconds=18, command=argv)))
        child.stdin.write(b'go\n'); child.stdin.flush()
        try:
            if cancel:
                until = time.monotonic()+4
                while not (run/'kernel-armed.json').exists() and time.monotonic()<until: time.sleep(.005)
                self.assertTrue((run/'kernel-armed.json').exists())
                child.send_signal(signal.SIGTERM)
            out, err = child.communicate(timeout=21)
            (run/'cli.stdout').write_bytes(out); (run/'cli.stderr').write_bytes(err)
            self.assertEqual(child.returncode, expected, err.decode())
        finally:
            if child.poll() is None: child.kill(); child.communicate(timeout=3)
            watchdog.terminate(); wo, we = watchdog.communicate(timeout=3)
            (run/'watchdog-wait.json').write_text(json.dumps(dict(actualRootWait=child.returncode,
                rootStdoutEOF=True, rootStderrEOF=True, watchdogActualWait=watchdog.returncode,
                watchdogSeparateEOF=True, watchdogOutput=wo, watchdogError=we)))
        self.assertTrue((run/'publication-launch.json').exists())
        metadata = json.loads((run/'publication-launch.json').read_text())
        self.assertEqual(metadata['command'], command)
        self.assertEqual(metadata['browserDeadline'], deadline)
        self.assertEqual(metadata['cleanupDeadline'], deadline+30000)
        drain = json.loads((run/'kernel-drain.json').read_text())
        self.assertTrue(drain['complete']); self.assertFalse(drain['remaining']); self.assertFalse(drain['unreaped'])
        self.assertTrue(drain['reaped'])
        for row in drain['owned']:
            self.assertIn((row['pid'], row['start']), {(r['pid'], r['start']) for r in drain['reaped']})
            self.assertFalse(Path('/proc', str(row['pid'])).exists())
        report = json.loads((run/'publication-validation.json').read_text())
        self.assertNotIn('validationError', report)
        self.assertEqual(report['readiness'], 'UNKNOWN')
        self.assertFalse((run/'native-startup-trace.json').exists())
        return run, report

    def test_actual_writer_modes_and_gzip(self):
        for mode in ('same', 'rename', 'failedopen', 'failedwrite', 'failedrename', 'childexec'):
            with self.subTest(mode=mode):
                target = self.base/('port-'+mode)
                if mode == 'failedopen': target.write_bytes(b'existing')
                run, report = self.execute(mode, [str(self.exe), mode, str(target)],
                    ['--journal-gzip', '--publication-observer='+launcher.VERSION])
                self.assertTrue(report['custodyIntegrity']['gzipCRCChecked'])
                self.assertTrue(report['observerIntegrity']['valid'])
                self.assertFalse(report['observerComplete'])
                self.assertIn('unreturned-syscall', report['observerIncompleteReasons'])
                output = (run/'kernel-command.log').read_bytes()
                for key, expected in (('failedopen', b'open=-1 errno=20'), ('failedwrite', b'write=-1 errno=9'),
                                      ('failedrename', b'rename=-1 errno=2')):
                    if mode == key: self.assertIn(expected, output)
                records = [json.loads(x) for x in (run/'publication-syscalls.ndjson').read_text().splitlines()]
                returns = [r for r in records if r['kind']=='return']
                if mode.startswith('failed'):
                    expected_errno = dict(failedopen=20, failedwrite=9, failedrename=2)[mode]
                    self.assertTrue(any(r['result']==-expected_errno and r['errno']==expected_errno for r in returns))
                elif mode in ('same', 'rename', 'childexec'):
                    self.assertEqual(target.read_bytes(), b'9222\n/devtools/browser/inert\n')
                (run/'target-observation.json').write_text(json.dumps(dict(exists=target.exists(), bytesHex=target.read_bytes().hex() if target.exists() else None)))

    def test_default_off_literal_argv_and_failure_parity(self):
        values = ['$(touch SHOULD_NOT_EXIST)', '; exit 92', 'a b', '"quoted"', '*', '--journal-gzip']
        code = 'import json,sys;print(json.dumps(sys.argv[1:]))'
        command = [sys.executable, '-c', code, *values]
        run, report = self.execute('literal-off', command)
        self.assertEqual(json.loads((run/'kernel-command.log').read_text()), values)
        self.assertFalse((run/'publication-syscalls.ndjson').exists())
        helper, source = launcher.load_providers()
        self.assertEqual(helper.candidate(source), source)
        meta = json.loads((run/'publication-launch.json').read_text())
        self.assertEqual(meta['candidateSha256'], launcher.COLLECTOR_SHA)
        for enabled in (False, True):
            run, report = self.execute('exit7-'+str(enabled), [sys.executable, '-c', 'raise SystemExit(7)'],
                ['--publication-observer='+launcher.VERSION] if enabled else [], expected=1)
            self.assertEqual(report['actualRootExit'], 7)
            self.assertEqual(report['collectorFailure'], 'AssertionError(7)')

    def test_cancel_deadline_and_caps(self):
        for enabled in (False, True):
            _, report = self.execute('cancel-'+str(enabled), [str(self.exe), 'cancel', 'unused'],
                ['--publication-observer='+launcher.VERSION] if enabled else [], cancel=True, expected=1)
            self.assertIn('InterruptedError', report['collectorFailure'])
        for name, option, reason in (('cap', '--max-records=12', 'record-cap'),
                                     ('bytecap', '--max-bytes=4096', 'byte-cap')):
            run, report = self.execute(name, [str(self.exe), 'same', str(self.base/name)],
                ['--publication-observer='+launcher.VERSION, option])
            self.assertIn(reason, report['observerIncompleteReasons'])
            data = (run/'publication-syscalls.ndjson').read_bytes()
            if name=='cap': self.assertLessEqual(len(data.splitlines()), 12)
            else: self.assertLessEqual(len(data), 4096)
        _, report = self.execute('immutable-deadline', [str(self.exe), 'cancel', 'unused'],
            ['--publication-observer='+launcher.VERSION], expected=1, deadline_seconds=.8)
        self.assertIn('runtime-deadline', report['collectorFailure'])

    def test_pre_spawn_refusals_and_record_validation(self):
        helper, source = launcher.load_providers()
        # Execute the real CLI under a negative-only read fault: no provider files edited.
        for filename in ('native_kernel_custody.py', 'native_publication_observer.py'):
            run = RUN/('refuse-'+filename); run.mkdir()
            marker = run/'SHOULD_NOT_SPAWN'
            wrapper = '''import pathlib,runpy,sys
original=pathlib.Path.read_bytes
def read(path):
 data=original(path)
 return data+b'\\n' if path.name==filename else data
pathlib.Path.read_bytes=read
filename=sys.argv.pop(1)
sys.argv=sys.argv[1:]
runpy.run_path(sys.argv[0],run_name='__main__')
'''
            command = [sys.executable, '-c', wrapper, filename, str(ROOT/'native_publication_launch.py'),
                str(run), '--publication-observer='+launcher.VERSION, '--',
                sys.executable, '-c', 'from pathlib import Path;Path('+repr(str(marker))+').touch()']
            result = subprocess.run(command, capture_output=True, timeout=5)
            (run/'refusal.json').write_text(json.dumps(dict(command=command, exit=result.returncode,
                stderr=result.stderr.decode(), markerExists=marker.exists())))
            self.assertEqual(result.returncode, 1)
            self.assertIn(b'drift', result.stderr)
            self.assertFalse(marker.exists()); self.assertFalse((run/'kernel-armed.json').exists())
        with mock.patch.object(launcher.os, 'fork', side_effect=AssertionError('forbidden spawn')):
            with self.assertRaisesRegex(ValueError, 'unknown observer version'):
                launcher.launch(['unused', '--publication-observer=unknown', '--', '/bin/true'])
            original = Path.read_bytes
            for filename in ('native_kernel_custody.py', 'native_publication_observer.py'):
                def drift(path):
                    data = original(path)
                    return data+b'\n' if path.name == filename else data
                with mock.patch.object(Path, 'read_bytes', drift):
                    with self.assertRaisesRegex(ValueError, 'drift'):
                        launcher.launch(['unused', '--', '/bin/true'])
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp)/'empty.gz'; p.write_bytes(gzip.compress(b''))
            self.assertFalse(launcher.artifact(p)['valid'])
            p.write_bytes(gzip.compress(b'bytes')[:-2]); self.assertFalse(launcher.artifact(p)['valid'])
        # Damage real retained CLI records, including custody references (rehash chain).
        run, _ = self.execute('validation-records', [str(self.exe), 'same', str(self.base/'validation')],
            ['--journal-gzip', '--publication-observer='+launcher.VERSION])
        data = (run/'publication-syscalls.ndjson').read_bytes()
        for damaged in (data[:-3], b'\n'.join(data.splitlines()[:-1])+b'\n'):
            with self.assertRaises(ValueError): helper.validate(damaged)
        observer_path = run/'publication-syscalls.ndjson'
        actual = observer_path.read_bytes()
        try:
            rows = [json.loads(line) for line in actual.splitlines()]
            entry = next(row for row in rows if row['kind']=='entry')
            entry['waitSequence'] = entry['custodySequence']
            previous = '0'*64; changed = []
            for row in rows:
                row['previousSha256'] = previous
                line = (json.dumps(row, sort_keys=True)+'\n').encode()
                previous = hashlib.sha256(line).hexdigest(); changed.append(line)
            observer_path.write_bytes(b''.join(changed))
            helper.validate(observer_path.read_bytes()) # chain alone cannot prove custody
            with self.assertRaisesRegex(ValueError, 'wait mismatch'):
                launcher.validate_run(run, helper, True)
        finally: observer_path.write_bytes(actual)
        original = (run/'custody.ndjson.gz').read_bytes()
        try:
            (run/'custody.ndjson.gz').write_bytes(gzip.compress(b'{}\n'))
            with self.assertRaises((ValueError, KeyError)):
                launcher.validate_run(run, helper, True)
        finally: (run/'custody.ndjson.gz').write_bytes(original)


if __name__ == '__main__': unittest.main()
