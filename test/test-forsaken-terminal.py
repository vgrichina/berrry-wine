"""Actual process waits distinguish a retired owner from an acknowledged UP.

Uses the production HTTP fixture and supervisor; no game state is simulated.
"""
import importlib.util
import json
import os
import pathlib
import signal
import subprocess
import sys
import threading
import time
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('controls', ROOT/'test/test-forsaken-controller.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
base.R = base.R.resolve()
c = base.control


class Terminal(base.Controller):
    def exercise(self, mode):
        self.start('terminal-'+mode)
        c.capture('fresh')
        c.save('fresh-review.json', dict(at=time.time(), pngSHA256=c.read('fresh.json')['pngSHA256']))
        errors = []

        def terminate():
            try:
                intent=base.waitfile(self.out/'final-intent.json')
                end=time.monotonic()+5
                while True:
                    try:status=c.call({'action':'guarded-status','nonce':intent['nonces'][0]})
                    except RuntimeError as error:
                        if 'unknown guarded nonce' not in str(error):raise
                        status={'consumed':False}  # Intent precedes actual guard registration.
                    if status.get('consumed'):break
                    assert time.monotonic()<end,'actual guarded consumption deadline'
                    time.sleep(.01)
                info = c.read('native-pid.json')
                self.assertEqual(base.supervise.token(info['pid']), info['startToken'])
                if mode in ('normal', 'nonfinal'):
                    c.call({'action': 'quit'})
                else:
                    os.kill(info['pid'], signal.SIGTERM if mode == 'term' else signal.SIGKILL)
            except BaseException as error:
                errors.append(error)

        t = threading.Thread(target=terminate)
        t.start()
        try:
            if mode == 'normal':
                c.pulse('final', ['keydown:13'], 400, 'fresh', 'reviewed terminal fixture', final=True)
            else:
                with self.assertRaises(Exception):
                    c.pulse('final', ['keydown:13'], 400, 'fresh', 'reviewed terminal fixture', final=mode!='nonfinal')
        finally:
            t.join(5)
            a, b = self.p.communicate(timeout=10)
            c.save('fixture-tool-wait.json', dict(exit=self.p.returncode, actualWait=True,
                   stdoutEOF=True, stderrEOF=True, stdout=a.decode(), stderr=b.decode()))
        self.assertFalse(t.is_alive())
        self.assertFalse(errors, errors)
        info = c.read('native-pid.json')
        wait = c.read('native-wait.json')
        self.assertEqual(wait['pid'], info['pid'])
        self.assertEqual(wait['startToken'], info['startToken'])
        self.assertTrue(wait['actualWait'] and wait['stdoutEOF'] and wait['stderrEOF'])
        up = c.read('final-up.json')
        self.assertNotEqual(up['state'], 'ACK', 'process termination cannot acknowledge physical UP')
        if mode == 'normal':
            self.assertEqual(wait['exit'], 0)
            self.assertEqual(up['state'], 'OWNER_EXITED')
            self.assertFalse(up['physicalUpACK'])
            self.assertEqual(up['nativeWait'], wait)
            self.assertGreaterEqual(up['at'], wait['at'])
            self.assertEqual(c.read('final-release-wait.json')['exit'], 0)
            self.assertTrue(c.read('terminal-owner-exited.json')['noReplay'])
            self.assertFalse((self.out/'terminal-input-failure.json').exists())
        else:
            self.assertEqual(wait['exit'], {'term': -15, 'kill': -9, 'nonfinal': 0}[mode])
            self.assertEqual(up['state'], 'UNKNOWN')
            self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
            self.assertNotEqual(c.read('final-release-wait.json')['exit'], 0)
            self.assertFalse((self.out/'terminal-owner-exited.json').exists())
        with self.assertRaises(AssertionError):
            c.capture('closed')
        self.assertFalse((self.out/'closed.png').exists())
        if mode == 'normal':
            self.assertFalse((self.out/'terminal-input-failure.json').exists(),
                             'retired-owner refusal must retain its distinct terminal state')
        for p in self.out.glob('*.png'):
            p.unlink()

    def test_normal_actual_wait_is_distinct_from_ack(self):
        self.exercise('normal')

    def test_term_is_unknown(self):
        self.exercise('term')

    def test_kill_is_unknown(self):
        self.exercise('kill')

    def test_nonfinal_exit_retains_unknown(self):
        self.exercise('nonfinal')


class Identity(unittest.TestCase):
    def test_wait_includes_identity_and_both_late_pipe_eofs(self):
        out = base.R/'terminal-late-pipes'
        out.mkdir()
        code = """import os,time,sys
if os.fork()==0:
 time.sleep(.5);print('late-out',flush=True)
 time.sleep(.4);print('late-err',file=sys.stderr,flush=True);os._exit(0)
print('parent-exit',flush=True)
"""
        base.save(out, 'recipe.json', dict(args=[sys.executable, '-u', '-c', code],
                  cwd=str(out), seconds=4))
        p = subprocess.Popen([sys.executable, '-B', str(base.SUPERVISOR), 'outerwait', str(out)],
                             stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        info = base.waitfile(out/'native-pid.json')
        time.sleep(.2)
        self.assertFalse((out/'native-wait.json').exists(), 'wait receipt must await both pipe EOFs')
        c.R = out
        self.assertIsNone(c.exited_owner(info), 'process exit before pipe EOF is insufficient')
        a, b = p.communicate(timeout=8)
        base.save(out, 'fixture-tool-wait.json', dict(exit=p.returncode, actualWait=True,
                  stdoutEOF=True, stderrEOF=True, stdout=a.decode(), stderr=b.decode()))
        wait = base.waitfile(out/'native-wait.json')
        self.assertEqual(wait['startToken'], info['startToken'])
        self.assertEqual(wait['pid'], info['pid'])
        self.assertTrue(wait['actualWait'] and wait['stdoutEOF'] and wait['stderrEOF'])
        self.assertIn('late-out', (out/'native.stdout.log').read_text())
        self.assertIn('late-err', (out/'native.stderr.log').read_text())
        c.R = out
        self.assertEqual(c.exited_owner(info), wait)
        self.assertIsNone(c.exited_owner({**info, 'startToken': 'wrong'}))
        self.assertIsNone(c.exited_owner({**info, 'pid': info['pid']+1}))
        # These are explicitly invalid synthetic receipts derived from the
        # retained actual wait; the original evidence is never overwritten.
        for field, value in [('actualWait', False), ('stdoutEOF', False),
                             ('stderrEOF', False), ('startToken', 'wrong'),
                             ('drainErrors', ['fixture error']), ('exit', -9)]:
            invalid = base.R/('terminal-invalid-'+field)
            invalid.mkdir()
            base.save(invalid, 'native-pid.json', info)
            base.save(invalid, 'native-wait.json', {**wait, field: value})
            base.save(invalid, 'synthetic-negative.json', dict(invalidField=field, actualWaitClaim=False))
            c.R = invalid
            self.assertIsNone(c.exited_owner(info), field)

        c.R = out
        original_call = c.call
        def closed_endpoint(*args, **kwargs):
            raise ConnectionRefusedError('synthetic closed endpoint; actual native wait retained')
        c.call = closed_endpoint
        try:
            with self.assertRaises(Exception):
                c.release('no-down-ack', 'unconsumed-owner', time.time()+.02, final=True)
        finally:
            c.call = original_call
        self.assertEqual(c.read('no-down-ack-up.json')['state'], 'UNKNOWN')

    def test_port_closure_alone_has_no_terminal_evidence(self):
        out = base.R/'terminal-no-wait'
        out.mkdir()
        c.R = out
        self.assertIsNone(c.exited_owner(dict(pid=os.getpid(), startToken=base.supervise.token(os.getpid()))))


if __name__ == '__main__':
    suite = unittest.TestSuite()
    for cls in (Terminal, Identity):
        for name in cls.__dict__:
            if name.startswith('test_'):
                suite.addTest(cls(name))
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    raise SystemExit(not result.wasSuccessful())
