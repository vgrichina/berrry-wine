#!/usr/bin/env python3
"""Deterministic integrity races at the real host controller boundaries.

Synthetic ACKs isolate disk ordering; production extraction is tested separately.
No guest, compiler, runner semantics changes or historical cursor reuse.
"""
import argparse
import sys
import contextlib
import io
import os
from unittest.mock import patch
import importlib.util
import json
from pathlib import Path
import tempfile
import time
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('controller', ROOT / 'tools/generally-loading-controller.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


TEMP_ROOT = None


class Transactions(unittest.TestCase):
    def scenario(self, boundary):
        with tempfile.TemporaryDirectory(prefix='generally-cursor-transaction-', dir=TEMP_ROOT) as tmp:
            root = Path(tmp)
            m.atomic(root / 'cursor', dict(next=61, pending=False))
            box = m.Mailbox(root)
            ctl = m.LoadingController(box, root / 'cursor', deadline=time.monotonic() + 5, timeout=.03)
            original = m.atomic
            mutated = False
            reservations = []

            def mutate():
                nonlocal mutated
                path = box.replies / '0061.json'
                path.write_bytes(path.read_bytes() + b' ')
                mutated = True

            def atomic(path, value):
                path = Path(path)
                if path == ctl.path and value.get('request', {}).get('id') == 63:
                    reservations.append(value.copy())
                original(path, value)
                if path.parent == box.requests:
                    if boundary == 'after-dispatch' and value['id'] == 63:
                        mutate()
                        return
                    original(box.replies / path.name,
                             dict(request=value, reply=dict(id=value['id'], ok=True, value={})))
                elif boundary == 'reservation' and path == ctl.path and value.get('request', {}).get('id') == 63 and not mutated:
                    mutate()
                elif boundary == 'journal' and path == box.journal_path and value.get('pending', {}).get('id') == 63 and not mutated:
                    mutate()

            m.atomic = atomic
            try:
                ctl.request(dict(action='snapshot'))
                ctl.request(dict(action='step', n=1))
                if boundary == 'before-reservation':
                    mutate()
                expected = 'timeout' if boundary == 'after-dispatch' else 'consumed ACK changed'
                with self.assertRaisesRegex(m.Refusal, expected):
                    ctl.request(dict(action='snapshot'))
                cursor = json.loads(ctl.path.read_text())
                self.assertTrue(mutated)
                if boundary == 'before-reservation':
                    self.assertEqual(reservations, [], 'known uncertainty must precede reservation')
                self.assertTrue(cursor['failed'])
                self.assertTrue(cursor['pending'])
                self.assertEqual(cursor['next'], 64 if boundary == 'after-dispatch' else 63)
                self.assertEqual(cursor.get('request', {}).get('id'), 63 if boundary == 'after-dispatch' else None)
                self.assertEqual(sorted(p.name for p in box.requests.iterdir()),
                                 ['0061.json', '0062.json'] + (['0063.json'] if boundary == 'after-dispatch' else []))
                box.poison()
                self.assertEqual(json.loads(box.journal_path.read_text())['status'], 'poisoned')
                with self.assertRaisesRegex(m.Refusal, 'uncertain/failed cursor'):
                    ctl.request(dict(action='snapshot'))
                with self.assertRaisesRegex(m.Refusal, 'uncertain/failed cursor'):
                    m.LoadingController(box, ctl.path, deadline=time.monotonic() + 1)
            finally:
                m.atomic = original
                box.close()

    def test_stdio_unsolicited_ack_during_reservation(self):
        with tempfile.TemporaryDirectory(prefix='generally-stdio-reservation-', dir=TEMP_ROOT) as tmp:
            state = Path(tmp) / 'cursor'
            m.atomic(state, dict(next=63, pending=False))
            reader, writer = os.pipe()
            original = m.atomic

            def atomic(path, value):
                original(path, value)
                if value.get('request', {}).get('id') == 63:
                    os.write(writer, b'[ctl] unsolicited\n')

            output = io.StringIO()
            try:
                with os.fdopen(reader) as stream, patch.object(m.sys, 'stdin', stream), contextlib.redirect_stdout(output):
                    ctl = m.LoadingController(m.Stdio(), state, deadline=time.monotonic() + 1)
                    with patch.object(m, 'atomic', atomic), self.assertRaisesRegex(m.Refusal, 'unsolicited'):
                        ctl.request(dict(action='snapshot'))
                self.assertEqual(output.getvalue(), '')
                cursor = json.loads(state.read_text())
                self.assertEqual(cursor, dict(next=63, pending=True, failed=True))
            finally:
                os.close(writer)

    def test_known_uncertainty_before_reservation(self):
        self.scenario('before-reservation')

    def test_mutation_during_durable_cursor_write(self):
        self.scenario('reservation')

    def test_mutation_during_durable_journal_write(self):
        self.scenario('journal')

    def test_uncertainty_after_dispatch_retains_pending(self):
        self.scenario('after-dispatch')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--evidence', required=True, type=Path)
    args, remaining = parser.parse_known_args()
    TEMP_ROOT = args.evidence
    TEMP_ROOT.mkdir(parents=True, exist_ok=False)
    unittest.main(argv=[sys.argv[0], *remaining], verbosity=2)
