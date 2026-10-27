"""Production-boundary protocol tests; no guest execution or image claims.

AIRSTRIKE_PRODUCTION_RUNNER must name the exact pinned test/run.js. Excerpts
are cut from that file unchanged; the scheduler and renderer are fixtures.
"""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import time
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('bridge', ROOT/'tools/airstrike-observation-bridge.py')
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)


class FrozenDispatch(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base = Path(os.environ['AIRSTRIKE_PROTOCOL_EVIDENCE'])
        cls.base.mkdir(parents=True, exist_ok=True)
        cls.source = os.environ['AIRSTRIKE_PRODUCTION_RUNNER']
        cls.env = dict(os.environ, AIRSTRIKE_EXTRACTION_RECEIPT=str(cls.base/'extractions.json'))
        cls.node = ['/usr/bin/node', '--max-old-space-size=32']
        # Exact executable, flags, env and inherited child limits before Node
        # acceptance. Files are opened before creation, including failed spawn.
        startup = "const fs=require('fs'),c=require('crypto');console.log(JSON.stringify({executable:process.execPath,version:process.version,flags:process.execArgv,limits:fs.readFileSync('/proc/self/limits','utf8'),environmentSHA256:c.createHash('sha256').update(JSON.stringify(Object.entries(process.env).sort())).digest('hex')}))"
        with (cls.base/'startup.stdout').open('wb') as out, (cls.base/'startup.stderr').open('wb') as err:
            result = subprocess.run(cls.node+['-e', startup], env=cls.env, stdout=out,
                                    stderr=err, preexec_fn=bridge.child_limits, timeout=5)
        assert result.returncode == 0

    def exercise(self, mode):
        b = bridge.Bridge(self.node+[str(ROOT/'test/fixtures/airstrike-frozen-dispatch.cjs'),
                                    self.source, mode], ROOT/'tools/airstrike-menu-controller.py',
                          self.base/mode, env=self.env, guest_seconds=3, wall_seconds=4)
        original = b.controller
        completed = []
        def run():
            b.expected_focus = b.focus(b.request('snapshot'))
            b.reviewed_capture = ('initial', b.capture('initial'))
            b.response_deadline = min(time.monotonic()+1, b.guest_deadline)
            original.key('keydown', 27)
            completed.append('keydown')
            # This cannot be sent until matching step, snapshot and input log.
            original.key('keyup', 27)
            completed.append('keyup')
            return {'status': 'protocol-complete-fixture-only'}
        b.controller.run = run
        result = b.run()
        commands = [e['command'] for e in b.events if e['kind']=='dispatch']
        self.assertTrue(result['cleanup']['complete'], result)
        return b, result, commands, completed

    def test_00_production_queue_step_and_frozen_zero_before_next_input(self):
        b, result, commands, completed = self.exercise('normal')
        self.assertEqual(completed, ['keydown', 'keyup'], result)
        self.assertEqual(result['status'], 'protocol-complete-fixture-only')
        events = [e for e in b.events if e['kind']=='frozen-input-complete']
        self.assertEqual(len(events), 2)
        for event in events:
            self.assertTrue(event['inputAck']['value']['queued'])
            self.assertNotIn('logs', event['inputAck']['value'])
            self.assertEqual(event['step']['value']['ran'], 1)
            self.assertEqual(event['snapshot']['value']['frozen']['credits'], 0)
        inputs = [i for i,c in enumerate(commands) if 'cmd' in c]
        self.assertEqual([c.get('action') for c in commands[inputs[0]+1:inputs[1]]],
                         ['step', 'snapshot', 'snapshot'])
        self.assertFalse(any(c.get('action')=='frozen' for c in commands))

    def assert_rejected(self, mode, reason):
        _, result, commands, completed = self.exercise(mode)
        self.assertEqual(completed, [])
        self.assertEqual(result['status'], 'refused')
        self.assertIn(reason, result['reason'])
        self.assertEqual([c['cmd'] for c in commands if 'cmd' in c], ['keydown:27'])
        self.assertEqual(len([c for c in commands if c.get('action')=='step']), 1)

    def test_partial_ack(self):
        self.assert_rejected('partial', 'partial/unmatched')

    def test_stale_frozen_state(self):
        self.assert_rejected('stale', 'frozen-zero snapshot')

    def test_timeout_no_replay(self):
        self.assert_rejected('timeout', 'missing ACK')

    def test_terminal_during_step_is_rejected(self):
        self.assert_rejected('terminal', 'exited before ACK')

    def test_wrong_step_id(self):
        self.assert_rejected('wrong-id', 'unmatched/duplicate ACK')

    def test_missing_actual_input_log(self):
        self.assert_rejected('missing-log', 'actual input execution log')


if __name__ == '__main__':
    unittest.main()
