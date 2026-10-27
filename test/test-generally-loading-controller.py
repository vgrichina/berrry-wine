#!/usr/bin/env python3
"""Targeted non-game protocol tests. NODE must be the startup-qualified binary.

Run via the task's shared one-permit pool and trusted resource supervisor.
Evidence is retained in --evidence; no compiled module is needed or rebuilt.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import select
import subprocess
import sys
import threading
import time
import unittest

ROOT = Path(__file__).resolve().parents[1]
HELPER = ROOT / 'tools/generally-loading-controller.py'
FIXTURE = ROOT / 'test/fixtures/generally-loading-protocol.cjs'
NODE = '/usr/local/bin/node'
parser = argparse.ArgumentParser()
parser.add_argument('--evidence', required=True)
parser.add_argument('--group', choices=('repro', 'acceptance', 'hardening', 'total'), required=True)
args = parser.parse_args()
EVIDENCE = Path(args.evidence)
EVIDENCE.mkdir(parents=True, exist_ok=True)


def read_json(path):
    return json.loads(path.read_text())


def rows(path):
    return [json.loads(x) for x in path.read_text().splitlines()] if path.exists() else []


def spawn_fixture(directory, mode):
    err = (directory / 'fixture.stderr').open('wb')
    process = subprocess.Popen([NODE, '--max-old-space-size=512', str(FIXTURE),
                                str(ROOT / 'test/run.js'), mode, str(directory / 'fixture.jsonl')],
                               stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=err)
    err.close()
    return process


def cleanup(directory, processes):
    result = []
    for process in processes:
        if process.poll() is None:
            process.terminate()
        try:
            process.wait(timeout=2)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=2)
        result.append(dict(pid=process.pid, exit=process.returncode, alive=process.poll() is None))
    (directory / 'cleanup.json').write_text(json.dumps(result, indent=2))


def scenario(name, mode='normal', *, total=2501, timeout=.15, deadline=2,
             pending=False, mailbox=False, next_id=12):
    directory = EVIDENCE / name
    directory.mkdir()
    state = directory / 'cursor.json'
    state.write_text(json.dumps(dict(next=next_id, pending=pending,
                                     request={'action': 'step', 'n': 100000, 'id': 12} if pending else None)))
    fixture = spawn_fixture(directory, mode)
    capture = directory / 'capture.bin'
    after = [{'action': 'png', 'path': str(capture)},
             {'action': 'input-message', 'hwnd': 1, 'msg': 256, 'wParam': 38, 'lParam': 0}]
    command = [sys.executable, '-B', str(HELPER), '--state', str(state),
               '--receipt', str(directory / 'receipt.json'), '--total', str(total),
               '--timeout-seconds', str(timeout), '--deadline-seconds', str(deadline),
               '--after', json.dumps(after)]
    if mailbox:
        (directory / 'requests').mkdir()
        (directory / 'replies').mkdir()
        command += ['--mailbox', str(directory)]
    else:
        command += ['--stdio']
    cerr = (directory / 'controller.stderr').open('wb')
    controller = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=cerr)
    cerr.close()
    (directory / 'command.json').write_text(json.dumps(command))
    stopped = threading.Event()
    forwarded = []
    bridge_errors = []

    def to_fixture():
        try:
            if mailbox:
                seen = set()
                while not stopped.is_set():
                    for path in sorted((directory / 'requests').glob('*.json')):
                        if path.name in seen:
                            continue
                        seen.add(path.name)
                        fixture.stdin.write(path.read_bytes() + b'\n')
                        fixture.stdin.flush()
                    stopped.wait(.001)
            else:
                for line in controller.stdout:
                    fixture.stdin.write(line)
                    fixture.stdin.flush()
        except (OSError, ValueError) as error:
            bridge_errors.append(str(error))

    def from_fixture():
        try:
            for line in fixture.stdout:
                forwarded.append(line.decode())
                if mailbox:
                    ack = json.loads(line[6:])
                    name = f"{ack['id']:04}.json"
                    request = read_json(directory / 'requests' / name)
                    dest = directory / 'replies' / name
                    tmp = dest.with_suffix('.tmp')
                    tmp.write_text(json.dumps(dict(request=request, reply=ack)))
                    tmp.replace(dest)
                else:
                    controller.stdin.write(line)
                    controller.stdin.flush()
        except (OSError, ValueError) as error:
            bridge_errors.append(str(error))
        finally:
            if not mailbox:
                try:
                    controller.stdin.close()
                except OSError:
                    pass

    threads = [threading.Thread(target=f, daemon=True) for f in (to_fixture, from_fixture)]
    for thread in threads:
        thread.start()
    try:
        code = controller.wait(timeout=max(6, deadline + 5))
    finally:
        stopped.set()
        cleanup(directory, [controller, fixture])
        for thread in threads:
            thread.join(timeout=2)
        (directory / 'wire-acks.json').write_text(json.dumps(forwarded))
        (directory / 'bridge-errors.json').write_text(json.dumps(bridge_errors))
    assert not any(thread.is_alive() for thread in threads), 'leaked bridge thread'
    return directory, code


class Reproducer(unittest.TestCase):
    def test_01_unchanged_oversized_request12_has_no_completion_ack(self):
        directory = EVIDENCE / 'original-oversized'
        directory.mkdir()
        fixture = spawn_fixture(directory, 'normal')
        request = dict(action='step', n=100000, id=12)
        (directory / 'request.json').write_text(json.dumps(request))
        try:
            fixture.stdin.write((json.dumps(request) + '\n').encode())
            fixture.stdin.flush()
            # Wait for the exact production fixture to be ready before timing.
            until = time.monotonic() + 2
            while not any('request' in x for x in rows(directory / 'fixture.jsonl')):
                self.assertLess(time.monotonic(), until)
                time.sleep(.002)
            start = time.monotonic()
            ready = select.select([fixture.stdout], [], [], .12)[0]
            self.assertFalse(ready, 'oversized step unexpectedly completed')
            self.assertIsNone(fixture.poll())
            (directory / 'result.json').write_text(json.dumps(dict(
                reproduced=True, request=request, ackAbsent=True,
                scaledResponseAllowance=.12, elapsed=time.monotonic()-start,
                productionCallerAllowance=38, productionBridgeAllowance=40,
                historicalReceiptSHA256='931290508de71df0dd3fd9cc6402286ed152c50cbc004bb27a7aadf2801cbdd8',
                explanation='same request and exact production completion boundary; only batch cost/allowance scaled; no game')))
        finally:
            cleanup(directory, [fixture])
        self.assertEqual([x['request'] for x in rows(directory / 'fixture.jsonl') if 'request' in x], [request])


class Acceptance(unittest.TestCase):
    def assert_stopped(self, name, mode, **kwargs):
        directory, code = scenario(name, mode, **kwargs)
        self.assertEqual(code, 1, (directory / 'controller.stderr').read_text())
        self.assertFalse(read_json(directory / 'receipt.json')['ok'])
        requests = [x['request'] for x in rows(directory / 'fixture.jsonl') if 'request' in x]
        self.assertFalse(any(x.get('action') in ('png', 'input-message') for x in requests))
        ids = [x['id'] for x in requests]
        self.assertEqual(len(ids), len(set(ids)), 'request replay')
        self.assertTrue(all(not x['alive'] for x in read_json(directory / 'cleanup.json')))
        return directory, requests

    def check_pass(self, name, mailbox=False, total=2501):
        # Nominal success uses the real caller allowance, not a subsecond
        # scheduling assumption. Fault cases keep their explicit scaled limits.
        directory, code = scenario(name, mailbox=mailbox, total=total, timeout=38, deadline=20)
        self.assertEqual(code, 0, (directory / 'controller.stderr').read_text())
        receipt = read_json(directory / 'receipt.json')
        self.assertEqual(receipt['completed'], total)
        requests = [x['request'] for x in rows(directory / 'fixture.jsonl') if 'request' in x]
        self.assertEqual([x['id'] for x in requests], list(range(12, 12 + len(requests))))
        steps = [x['n'] for x in requests if x['action'] == 'step']
        self.assertEqual(sum(steps), total)
        self.assertLessEqual(max(steps), 1000)
        for i, event in enumerate(receipt['events']):
            request, reply = event['request'], event['reply']
            self.assertIs(reply['ok'], True)
            self.assertEqual(reply['id'], request['id'])
            if request['action'] == 'step':
                self.assertEqual(reply['value']['ran'], request['n'])
                self.assertEqual(reply['value']['steps'], request['n'])
                self.assertEqual(receipt['events'][i+1]['request']['action'], 'snapshot')
            if request['action'] in ('step', 'png', 'input-message'):
                previous = receipt['events'][i-1]
                self.assertEqual(previous['request']['action'], 'snapshot')
                self.assertIs(previous['reply']['value']['frozen']['frozen'], True)
                self.assertEqual(previous['reply']['value']['frozen']['credits'], 0)
        self.assertTrue((directory / 'capture.bin').exists())
        self.assertFalse(read_json(directory / 'cursor.json')['pending'])
        return directory

    def test_02_mailbox_production_entry_and_nonmultiple_total(self):
        self.check_pass('mailbox', mailbox=True)

    def test_03_stdio_preserves_original_requested_total100000(self):
        self.check_pass('total100000', total=100000)

    def test_04_rejected_acks_stop(self):
        for mode in ('missing', 'delayed', 'duplicate', 'wrong-id', 'negative',
                     'wrong-count', 'wrong-steps', 'wrong-batch', 'not-frozen',
                     'credits', 'quit', 'snapshot-batch', 'exit'):
            with self.subTest(mode=mode):
                self.assert_stopped(mode, mode)

    def test_05_global_deadline_is_not_reset_per_chunk(self):
        directory, requests = self.assert_stopped('global-deadline', 'normal',
                                                  total=100000, timeout=.5, deadline=.15)
        self.assertGreater(sum(x.get('n', 0) for x in requests), 1000)
        self.assertLess(sum(x.get('n', 0) for x in requests), 100000)
        self.assertIn('deadline', read_json(directory / 'receipt.json')['error'])

    def test_06_historical_uncertain_request12_cannot_be_replayed(self):
        directory, requests = self.assert_stopped('uncertain12', 'normal', pending=True, next_id=13)
        self.assertEqual(requests, [])
        self.assertIn('no replay', read_json(directory / 'receipt.json')['error'])

    def test_07_cannot_expand_original_timeout(self):
        directory, requests = self.assert_stopped('expanded-timeout', 'normal', timeout=40)
        self.assertEqual(requests, [])


class Hardening(unittest.TestCase):
    def test_08a_mailbox_terminal_blocks_dispatch(self):
        directory = EVIDENCE / 'mailbox-terminal'
        directory.mkdir()
        (directory / 'terminal.json').write_text('{"returncode":7}')
        command = [sys.executable, '-B', str(HELPER), '--mailbox', str(directory),
                   '--state', str(directory / 'cursor.json'), '--receipt', str(directory / 'receipt.json'),
                   '--total', '100000', '--deadline-seconds', '1']
        (directory / 'command.json').write_text(json.dumps(command))
        with (directory / 'controller.stdout').open('wb') as out, (directory / 'controller.stderr').open('wb') as err:
            result = subprocess.run(command, input=b'', stdout=out, stderr=err, timeout=2)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(list((directory / 'requests').iterdir()), [])
        self.assertIn('terminal', read_json(directory / 'receipt.json')['error'])
        self.assertTrue(read_json(directory / 'cursor.json')['failed'])

    def test_08_rejected_cursors_forbid_restart_and_later_input(self):
        # Reuse completed acceptance evidence: no unchanged group is rerun.
        original = EVIDENCE.parent / 'acceptance'
        for name in ('missing', 'delayed', 'duplicate', 'wrong-id', 'negative',
                     'wrong-count', 'wrong-steps', 'wrong-batch', 'not-frozen',
                     'credits', 'quit', 'snapshot-batch', 'exit', 'global-deadline', 'uncertain12'):
            with self.subTest(name=name):
                directory = EVIDENCE / name
                directory.mkdir()
                cursor = read_json(original / name / 'cursor.json')
                state = directory / 'cursor.json'
                state.write_text(json.dumps(cursor))
                command = read_json(original / name / 'command.json')
                command[command.index('--state') + 1] = str(state)
                command[command.index('--receipt') + 1] = str(directory / 'receipt.json')
                with (directory / 'controller.stdout').open('wb') as out, (directory / 'controller.stderr').open('wb') as err:
                    result = subprocess.run(command, input=b'', stdout=out, stderr=err, timeout=2)
                self.assertEqual(result.returncode, 1)
                self.assertEqual((directory / 'controller.stdout').read_bytes(), b'')
                self.assertIn('no replay', read_json(directory / 'receipt.json')['error'])

    def test_09_one_outstanding_and_frozen_zero_at_every_dispatch(self):
        original = EVIDENCE.parent / 'acceptance'
        for name in ('mailbox', 'total100000'):
            with self.subTest(name=name):
                outstanding = None
                trace = rows(original / name / 'fixture.jsonl')
                for event in trace:
                    if 'request' in event:
                        self.assertIsNone(outstanding, 'more than one outstanding request')
                        outstanding = event['request']['id']
                        self.assertEqual(event['before']['frozen']['credits'], 0)
                        self.assertIs(event['before']['frozen']['frozen'], True)
                    if 'ack' in event:
                        self.assertEqual(event['ack']['id'], outstanding)
                        outstanding = None
                self.assertIsNone(outstanding)


suite = (unittest.TestSuite([Acceptance('test_03_stdio_preserves_original_requested_total100000')])
         if args.group == 'total' else unittest.defaultTestLoader.loadTestsFromTestCase(
             {'repro': Reproducer, 'acceptance': Acceptance, 'hardening': Hardening}[args.group]))
result = unittest.TextTestRunner(verbosity=2).run(suite)
manifest = dict(group=args.group, pass_=result.wasSuccessful(), tests=result.testsRun,
                failures=len(result.failures), errors=len(result.errors),
                source='1e4fdb06f64e5f14ddec582111dfe7ecb71df6ba',
                pins={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest()
                      for p in (HELPER, FIXTURE, Path(__file__), ROOT / 'test/run.js')})
(EVIDENCE / 'group.json').write_text(json.dumps(manifest, indent=2))
sys.exit(0 if result.wasSuccessful() else 1)
