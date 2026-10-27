#!/usr/bin/env python3
"""Replay actual production control receipts against the unchanged controller CLI.

No guest, compiled module, historical runner, renderer or initializer is executed.
These focused tests establish dispatch/consumption separation and safe refusal;
they do not explain the unmeasured SDL prerequisite or qualify gameplay.
"""
import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest

ROOT = Path(__file__).resolve().parents[1]
CONTROLLER = ROOT/'tools/airstrike-menu-controller.py'
BRIDGE = ROOT/'tools/airstrike-observation-bridge.py'
FIXTURE = ROOT/'test/fixtures/airstrike-startup-boundary/receipt-replay.json'
PINS = {CONTROLLER: 'a3425f91a36eef1ed1413e6ddb3cb814617a924d8a1e23cb78a00c65b951c662',
        BRIDGE: 'a7c07110c128c9a521b9e05affdbf6fa86fff672e228680d5a7d5b15cbbb924e'}


def fixture():
    for path, expected in PINS.items():
        assert hashlib.sha256(path.read_bytes()).hexdigest() == expected, path
    return json.loads(FIXTURE.read_text())


def transcript(f):
    initial, startup, remaining = f['observations']
    click, down, up = f['responses']
    return [dict(observation=initial), click, dict(observation=startup), down, up,
            dict(observation=remaining)]


def cli(name, messages):
    base = Path(os.environ.get('AIRSTRIKE_BOUNDARY_EVIDENCE', tempfile.gettempdir()))
    directory = Path(tempfile.mkdtemp(prefix=name+'-', dir=base))
    data = ''.join(json.dumps(value)+'\n' for value in messages).encode()
    (directory/'stdin.ndjson').write_bytes(data)
    started = time.monotonic()
    # Keep diagnostics distinct from child creation, including failed spawn.
    with (directory/'stdout').open('wb') as out, (directory/'stderr').open('wb') as err:
        result = subprocess.run([sys.executable, '-B', str(CONTROLLER)], input=data,
                                stdout=out, stderr=err, timeout=5, check=False)
    commands = [json.loads(line) for line in (directory/'stdout').read_text().splitlines()]
    diagnostic = (directory/'stderr').read_text()
    receipt = dict(kind='OFFLINE retained production-protocol replay, actual Controller CLI',
                   exit=result.returncode, commands=commands, diagnostic=diagnostic,
                   wallSeconds=time.monotonic()-started, controllerSHA256=PINS[CONTROLLER],
                   fixtureSHA256=hashlib.sha256(FIXTURE.read_bytes()).hexdigest(),
                   processReaped=True, guestInvocations=0)
    (directory/'receipt.json').write_text(json.dumps(receipt, indent=2)+'\n')
    return result.returncode, commands, diagnostic


class RetainedReproducer(unittest.TestCase):
    def test_unchanged_receipts_stop_at_startup(self):
        f = fixture()
        code, commands, diagnostic = cli('unchanged', transcript(f))
        self.assertEqual(code, 2)
        self.assertEqual(commands, f['expectedCommands'])
        self.assertIn('insufficient-observation', diagnostic)
        self.assertFalse(any(c['cmd'] in ('keydown:27', 'keydown:40', 'keydown:13')
                             for c in commands))


class RejectingControls(unittest.TestCase):
    def exercise(self, name, mutate, count=2):
        f = fixture()
        messages = transcript(f)
        mutate(messages)
        code, commands, diagnostic = cli(name, messages)
        self.assertEqual(code, 2)
        self.assertEqual(commands, f['expectedCommands'][:count])
        self.assertIn('refused', diagnostic)
        self.assertFalse(any(c['cmd'] in ('keydown:27', 'keydown:40', 'keydown:13')
                             for c in commands))

    def test_queue_ack_alone_cannot_release_or_navigate(self):
        self.exercise('queue-only', lambda m: m[3].pop('completion'))

    def test_partial_step_cannot_release_or_navigate(self):
        self.exercise('partial-step', lambda m: m[3]['completion']['step']['value'].update(ran=0))

    def test_nonzero_credits_cannot_release_or_navigate(self):
        self.exercise('credits', lambda m: m[3]['completion']['snapshot']['value']['frozen'].update(credits=1))

    def test_wrong_input_identity_cannot_release_or_navigate(self):
        self.exercise('identity', lambda m: m[3]['completion'].update(inputId='airstrike-stale'))

    def test_no_dispatch_log_cannot_release_or_navigate(self):
        self.exercise('no-dispatch', lambda m: m[3]['completion'].update(logs=[]))

    def test_stale_startup_cannot_send_space(self):
        self.exercise('stale-startup', lambda m: m[2]['observation'].update(after=None), count=1)

    def test_still_obscured_cannot_send_space(self):
        self.exercise('still-obscured', lambda m: m[2]['observation'].update(unobscured=False), count=1)


class BridgeBoundary(unittest.TestCase):
    def setUp(self):
        self.f = fixture()
        spec = importlib.util.spec_from_file_location('actual_airstrike_bridge', BRIDGE)
        self.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.module)

    def exercise(self, mutate=None):
        b = self.module.Bridge.__new__(self.module.Bridge)
        b.module = self.module.load_controller(CONTROLLER)
        b.dispatch_snapshot = self.f['responses'][0]['completion']['snapshot']['value']
        b.response_deadline = time.monotonic()+1
        b.guest_deadline = b.response_deadline
        c = copy.deepcopy(self.f['responses'][1]['completion'])
        if mutate:
            mutate(c)
        b.logs = {'stdout': bytearray(('\n'.join(c['logs'])+'\n').encode())}
        b.input_log_start = 0
        calls, events = [], []

        def request(action, deadline, **kw):
            calls.append(dict(action=action, **kw))
            return c['step' if action == 'step' else 'snapshot']

        b.request_ack = request
        b.event = lambda kind, **values: events.append(dict(kind=kind, **values))
        command = self.f['expectedCommands'][1]
        result = b.complete_frozen(command, dict(ack=self.f['responses'][1]['ack']))
        return result, calls, events

    def test_actual_bridge_completion_is_only_dispatch_evidence(self):
        result, calls, events = self.exercise()
        self.assertEqual(calls, [dict(action='step', n=1), dict(action='snapshot')])
        self.assertEqual(result, self.f['responses'][1])
        self.assertEqual(events[0]['kind'], 'frozen-input-complete')
        # The real production payload has no guest/SDL consumption attestation.
        self.assertNotIn('consumed', result['completion'])

    def test_actual_bridge_stops_on_partial_step(self):
        with self.assertRaisesRegex(self.module.Stop, 'partial/unmatched'):
            self.exercise(lambda c: c['step']['value'].update(ran=0))

    def test_actual_bridge_stops_on_pending_credit(self):
        with self.assertRaisesRegex(self.module.Stop, 'frozen-zero'):
            self.exercise(lambda c: c['snapshot']['value']['frozen'].update(credits=1))


if __name__ == '__main__':
    unittest.main()
