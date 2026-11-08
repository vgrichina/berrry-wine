"""Real-kernel census/reap race witnesses, without a browser or game."""
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

import native_custody_reaper as reaper


class ReaperTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.journal = Path(self.temp.name) / 'custody.jsonl'
        self.children = []

    def tearDown(self):
        for pid in self.children:
            try:
                os.kill(pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            try:
                os.waitpid(pid, 0)
            except ChildProcessError:
                pass
        self.temp.cleanup()

    def child(self, code=0, live=False):
        pid = os.fork()
        if not pid:
            if live:
                signal.pause()
            os._exit(code)
        self.children.append(pid)
        if not live:
            os.waitid(os.P_PID, pid, os.WEXITED | os.WNOWAIT)
        return pid

    def test_child_missed_by_census_registered_before_exact_reap(self):
        owned = {}
        pid = self.child(7)
        before = reaper.identity(pid)
        def register(row):
            self.assertTrue(Path('/proc', str(pid)).exists())
            owned[(row['pid'], row['start'])] = row
        def consume(target, flags):
            proof = json.loads(self.journal.read_text().splitlines()[-1])
            self.assertEqual(proof['phase'], 'before-reap')
            self.assertEqual(proof['start'], before['start'])
            self.assertIn((target, before['start']), owned)
            return os.waitpid(target, flags)
        rows = reaper.reap_exited_children(self.journal, register, waitpid=consume)
        self.assertEqual(rows[0]['pid'], pid)
        self.assertEqual(os.waitstatus_to_exitcode(rows[0]['status']), 7)
        self.assertFalse(Path('/proc', str(pid)).exists())
        self.assertEqual([r['phase'] for r in map(json.loads, self.journal.read_text().splitlines())],
                         ['before-reap', 'reaped'])

    def test_registration_failure_does_not_reap(self):
        pid = self.child()
        def refuse(row):
            raise RuntimeError('registration failed')
        with self.assertRaisesRegex(RuntimeError, 'registration failed'):
            reaper.reap_exited_children(self.journal, refuse)
        self.assertEqual(os.waitid(os.P_PID, pid, os.WEXITED | os.WNOWAIT).si_pid, pid)
        self.assertFalse(self.journal.exists())

    def test_fsync_failure_does_not_reap(self):
        pid = self.child()
        with mock.patch.object(reaper.os, 'fsync', side_effect=OSError('disk failure')):
            with self.assertRaisesRegex(OSError, 'disk failure'):
                reaper.reap_exited_children(self.journal, lambda row: None)
        self.assertEqual(os.waitid(os.P_PID, pid, os.WEXITED | os.WNOWAIT).si_pid, pid)

    def test_identity_failure_does_not_reap(self):
        pid = self.child()
        with mock.patch.object(reaper, 'identity', side_effect=OSError('identity unavailable')):
            with self.assertRaisesRegex(OSError, 'identity unavailable'):
                reaper.reap_exited_children(self.journal, lambda row: None)
        self.assertEqual(os.waitid(os.P_PID, pid, os.WEXITED | os.WNOWAIT).si_pid, pid)

    def test_live_child_nonblocking(self):
        self.child(live=True)
        self.assertEqual(reaper.reap_exited_children(self.journal, lambda row: None), [])
        self.assertFalse(self.journal.exists())

    def test_signal_status_and_repeat_empty(self):
        pid = self.child(live=True)
        os.kill(pid, signal.SIGTERM)
        os.waitid(os.P_PID, pid, os.WEXITED | os.WNOWAIT)
        rows = reaper.reap_exited_children(self.journal, lambda row: None)
        self.assertEqual(os.waitstatus_to_exitcode(rows[0]['status']), -signal.SIGTERM)
        self.assertEqual(reaper.reap_exited_children(self.journal, lambda row: None), [])

    def test_burst_all_identities_and_receipts(self):
        pids = {self.child(i % 8) for i in range(32)}
        registered = []
        rows = reaper.reap_exited_children(self.journal, registered.append)
        self.assertEqual({r['pid'] for r in registered}, pids)
        self.assertEqual({r['pid'] for r in rows}, pids)
        self.assertEqual(len(self.journal.read_text().splitlines()), 64)

    def test_adopted_double_fork(self):
        # Isolate subreaper state from the test runner.
        code = '''
import ctypes,os,sys,time
from pathlib import Path
assert ctypes.CDLL(None).prctl(36,1,0,0,0)==0
sys.path.insert(0,sys.argv[1]);import native_custody_reaper as m
pid=os.fork()
if pid==0:
 child=os.fork()
 if child==0:os._exit(9)
 os._exit(0)
os.waitid(os.P_PID,pid,os.WEXITED|os.WNOWAIT)
owned={};rows=[]
def register(row):owned[str(row['pid'])+':'+row['start']]=row
due=time.monotonic()+5
while time.monotonic()<due and len(rows)<2:
 rows.extend(m.reap_exited_children(journal=Path(sys.argv[2]),register=register));time.sleep(.001)
assert len(rows)==2,(rows,owned)
assert len(owned)==2
assert all(v['ppid']==os.getpid() for v in rows)
assert sorted(os.waitstatus_to_exitcode(v['status']) for v in rows)==[0,9]
print('PASS adopted double-fork identities before reap')
'''
        result = subprocess.run([sys.executable, '-c', code, str(Path(__file__).resolve().parent), str(self.journal)],
                                capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == '__main__':
    unittest.main()
