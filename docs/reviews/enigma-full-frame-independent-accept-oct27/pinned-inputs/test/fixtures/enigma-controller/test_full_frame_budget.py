"""Production --launch-config review accounting, with controlled latency only."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

HERE = Path(__file__).resolve().parent


class FullFrameBudgetTests(unittest.TestCase):
    def case(self, name, allowance=34, slots=(.25, 33.75), **latency):
        root = Path(os.environ.get('ENIGMA_REVIEW_EVIDENCE', tempfile.mkdtemp())) / name
        plan = None if slots is None else dict(checkpoint_seconds=list(slots), progress_seconds=45)
        env = dict(os.environ, **{k: str(v) for k, v in latency.items()})
        p = subprocess.run([sys.executable, str(HERE/'full-frame-boundary.py'),
                            '--boundary', str(root), str(allowance), json.dumps(plan)],
                           env=env, capture_output=True, timeout=20)
        root.parent.mkdir(parents=True, exist_ok=True)
        (root.parent/(name+'.stdout')).write_bytes(p.stdout)
        (root.parent/(name+'.stderr')).write_bytes(p.stderr)
        self.assertEqual(p.returncode, 0, p.stderr.decode())
        r = json.loads((root/'boundary.json').read_text())
        self.assertEqual(r['supervisor']['remainingOwnedLive'], [])
        wire = [json.loads(x)['command'] for x in (root/'wire.jsonl').read_text().splitlines()]
        if r['outcome']['failed']:
            self.assertEqual(r['outcome']['status'], 'exhausted-budget: review-reservation')
        else:
            self.assertEqual(wire[-1], dict(action='quit'))
        clicks = [x for x in wire if 'cmd' in x]
        self.assertEqual(len(clicks), int(r['outcome']['clicked']))
        return r

    def test_capture_read_and_persistence_cannot_steal_later_slot(self):
        cases = [dict(FRAME_READ_SECONDS=2),
                 dict(FRAME_READ_SECONDS=0, FRAME_CAPTURE_SECONDS=2),
                 dict(FRAME_READ_SECONDS=0, FRAME_PERSIST_SECONDS=2),
                 dict(FRAME_READ_SECONDS=0, FRAME_PERSIST_SECONDS=2, FRAME_PERSIST_TARGET='phase.json'),
                 dict(FRAME_READ_SECONDS=0, FRAME_PERSIST_SECONDS=2, FRAME_PERSIST_TARGET='review-001.json')]
        for i, latency in enumerate(cases):
            with self.subTest(latency=latency):
                r = self.case('slot-'+str(i), **latency)
                self.assertFalse(r['outcome']['clicked'], r)
                self.assertGreaterEqual(r['outcome']['reviewSecondsUsed'], 2)
                self.assertEqual(len(r['reviews']), 1)

    def test_full_read_and_persistence_debit_cumulative_without_plan(self):
        for i, latency in enumerate([dict(FRAME_READ_SECONDS=2),
                dict(FRAME_READ_SECONDS=0, FRAME_PERSIST_SECONDS=2),
                dict(FRAME_READ_SECONDS=0, FRAME_PERSIST_SECONDS=2, FRAME_PERSIST_TARGET='review-001.json')]):
            with self.subTest(latency=latency):
                r = self.case('cumulative-'+str(i), allowance=1, slots=None, **latency)
                self.assertFalse(r['outcome']['clicked'], r)
                self.assertGreaterEqual(r['outcome']['reviewSecondsUsed'], 2)

    def test_sufficient_slots_full_read_and_all_evidence_click_once(self):
        for i, latency in enumerate([dict(FRAME_READ_SECONDS=2),
                dict(FRAME_READ_SECONDS=.3, FRAME_CAPTURE_SECONDS=.3, FRAME_PERSIST_SECONDS=.3),
                dict(FRAME_READ_SECONDS=.3, FRAME_PERSIST_SECONDS=.3, FRAME_PERSIST_TARGET='review-001.json')]):
            with self.subTest(latency=latency):
                r = self.case('adequate-'+str(i), slots=(4, 30), **latency)
                self.assertTrue(r['outcome']['clicked'], r)
                self.assertEqual(r['exit'], 0)
                self.assertGreaterEqual(r['outcome']['reviewSecondsUsed'], float(latency['FRAME_READ_SECONDS']))


if __name__ == '__main__':
    unittest.main()
