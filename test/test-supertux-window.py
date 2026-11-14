"""Real HTTP/production-guard regressions; no guest or game-progress claim.

python3 -B test/test-supertux-window.py
SUPERTUX_TEST_OUT optionally selects the evidence directory.
"""
import importlib.util
import json
import os
import pathlib
import subprocess
import sys
import tempfile
import time
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('supertux_control', ROOT / 'tools/supertux-controller.py')
control = importlib.util.module_from_spec(spec)
spec.loader.exec_module(control)
OUT = pathlib.Path(os.environ['SUPERTUX_TEST_OUT']) if 'SUPERTUX_TEST_OUT' in os.environ else pathlib.Path(
    tempfile.mkdtemp(prefix='supertux-window-', dir=ROOT / 'scratch/runs'))


class Window(unittest.TestCase):
    def setUp(self):
        self.out = OUT / self._testMethodName
        self.out.mkdir(parents=True)
        self.p = subprocess.Popen(['node', str(ROOT / 'test/fixtures/supertux-window.cjs')],
                                  stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        ready = json.loads(self.p.stdout.readline())
        self.assertEqual(ready['fixturePid'], self.p.pid)
        control.R, control.URL = self.out, ready['url']
        os.environ.update(SUPERTUX_CONTROL_OUT=str(self.out), SUPERTUX_CONTROL_URL=control.URL)
        self.assertEqual(control.call({'action': 'snapshot'})['fixturePid'], self.p.pid)
        stat = pathlib.Path(f'/proc/{self.p.pid}/stat').read_text()
        control.save('native-pid.json', dict(pid=self.p.pid, startToken=stat[stat.rindex(')')+2:].split()[19]))
        control.save('launch.json', dict(deadline=time.time()+55))
        control.save('input-owner.json', control.call({'action': 'guarded-bind'}))
        control.save('lease-snapshot.json', dict(mainHwnd='0x1', screen=dict(w=1, h=1)))

    def tearDown(self):
        try:
            control.call({'action': 'quit'})
        finally:
            if self.p.poll() is None:
                try:
                    stdout, stderr = self.p.communicate(timeout=5)
                except subprocess.TimeoutExpired:
                    self.p.terminate()
                    stdout, stderr = self.p.communicate(timeout=5)
            else:
                stdout, stderr = self.p.communicate()
            control.save('fixture-wait.json', dict(exit=self.p.returncode, actualWait=True,
                         stdoutEOF=True, stderrEOF=True, stdout=stdout.decode(), stderr=stderr.decode()))
            for image in self.out.glob('*.png'):
                image.unlink()
        self.assertEqual(self.p.returncode, 0)

    def test_before_arm_and_fresh_complete_window(self):
        for name, age, milliseconds in [('tiny', 11.85, 850), ('longer', 11.1, 1000)]:
            control.capture(name)
            time.sleep(age)
            self.assertIn('NOT_SENT', control.pulse(name, [39], milliseconds, name, 'reviewed synthetic scene'))
            refusal = control.read(name+'-rejection.json')
            self.assertEqual((refusal['state'], refusal['lease']), ('NOT_SENT', 'VALID'))
            self.assertTrue(refusal['positivelyUnsent'])
            self.assertLess(refusal['remainingSeconds'], milliseconds/1000)
            self.assertFalse((self.out/(name+'-armed.json')).exists())
        self.assertFalse((self.out/'terminal-input-failure.json').exists())
        control.capture('fresh')
        control.pulse('complete', [39], 150, 'fresh', 'fresh unique reviewed complete window')
        receipt = control.read('complete-down.json')[0]
        fired = control.read('complete-release-fired.json')
        self.assertEqual(fired['source'], 'consumed-pulse')
        self.assertGreaterEqual(fired['at']-receipt['consumedAt']/1000, .15)
        self.assertEqual(control.read('complete-release-wait.json')['exit'], 0)
        self.assertLess(control.read('complete-up.json')['at'], control.read('complete-operation.json')['deadline'])
        self.assertNotEqual(control.read('complete-intent.json')['nonces'], control.read('longer-intent.json')['nonces'])
        progress = control.read('complete-progress.json')
        self.assertGreater(progress['postProgress']['batch'], progress['afterRelease']['batch'])

    def test_actual_startup_race_stays_terminal(self):
        control.capture('fresh')
        original = subprocess.Popen
        def delayed(args, **kw):
            if len(args) > 3 and args[3] == 'release':
                args = [sys.executable, '-B', '-c',
                        "import time,runpy,sys;time.sleep(2.4);p=sys.argv[1];sys.argv=sys.argv[1:];runpy.run_path(p,run_name='__main__')",
                        *args[2:]]
            return original(args, **kw)
        try:
            control.subprocess.Popen = delayed
            with self.assertRaisesRegex(AssertionError, 'insufficient complete window after arm'):
                control.pulse('race', [39], 1000, 'fresh', 'actual delayed child startup fixture')
        finally:
            control.subprocess.Popen = original
        self.assertTrue((self.out/'race-armed.json').exists())
        self.assertFalse((self.out/'race-down.json').exists())
        self.assertFalse((self.out/'race-rejection.json').exists())
        self.assertTrue(control.read('terminal-input-failure.json')['noReplay'])
        self.assertEqual(control.read('race-up.json')['state'], 'ACK')
        self.assertEqual(control.read('race-release-wait.json')['exit'], 0)
        with self.assertRaisesRegex(AssertionError, 'sticky'):
            control.capture('forbidden')

    def test_dropped_ack_independent_up_no_replay(self):
        control.capture('fresh')
        with self.assertRaises(Exception):
            control.pulse('dropped', [32], 60, 'fresh', 'dropped consumption ACK fixture')
        nonce = control.read('dropped-intent.json')['nonces'][0]
        self.assertEqual(control.call({'action': 'guarded-status', 'nonce': nonce})['state'], 'UNKNOWN')
        self.assertTrue(control.read('terminal-input-failure.json')['noReplay'])
        self.assertEqual(control.read('dropped-release-fired.json')['source'], 'fallback')
        self.assertEqual(control.read('dropped-up.json')['state'], 'ACK')
        self.assertEqual(control.read('dropped-release-wait.json')['exit'], 0)
        with self.assertRaisesRegex(AssertionError, 'sticky'):
            control.pulse('replay-forbidden', [39], 60, 'fresh', 'must remain terminal')
        self.assertFalse((self.out/'replay-forbidden-intent.json').exists())


if __name__ == '__main__':
    unittest.main(verbosity=2)
