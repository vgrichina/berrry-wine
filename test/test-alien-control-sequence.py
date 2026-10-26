#!/usr/bin/env python3
"""Offline regression: real /ctl transport, prior failure, durable no-replay.

No guest, Wasm, browser, Boat or game assets are loaded. Callback injection is
at the real production HTTP dispatch boundary. The historical fixture is never
authorized as a runtime plan.
"""
import argparse
import copy
import importlib.util
import json
import os
from pathlib import Path
import select
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(os.environ.get('ALIEN_CONTROL_ROOT', Path(__file__).resolve().parents[1]))
HELPER = ROOT / 'test/helpers/alien-control-sequence.py'
RECIPE = ROOT / 'test/alien-gameplay-sequence.py'
FIX = ROOT / 'test/fixtures/alien-control-sequence'
NODE = '/home/user/.nvm/versions/node/v24.18.1/bin/node'
spec = importlib.util.spec_from_file_location('control', HELPER)
control = importlib.util.module_from_spec(spec)
spec.loader.exec_module(control)


def body(value):
    return json.dumps({'ok': True, 'value': value}).encode()


def snapshot(batch):
    return dict(batch=batch, quit=False, frozen=dict(frozen=True, credits=0), yieldReason=16)


# Independent command/response oracle. Every request is the real ctl.py shape.
PLAN = [dict(action='snapshot'), dict(action='step', n=256), dict(action='snapshot'),
        dict(action='png', path='/tmp/offline-frame.png'),
        dict(action='eval', code='ctx.renderWaitAttribution'), dict(cmd='keypress:13'),
        dict(action='snapshot'), dict(action='step', n=50), dict(action='snapshot'), dict(action='quit')]
VALUES = [snapshot(4650), dict(batch=4906, ran=256, steps=256, frozen=True), snapshot(4906),
          dict(batch=4906, frozen=True, path='/tmp/offline-frame.png', bytes=20), None,
          dict(batch=4906, queued=True), snapshot(4906),
          dict(batch=4956, ran=50, steps=50, frozen=True), snapshot(4956), dict(quitting=True)]


class Case(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='alien-ctl-', dir=os.environ.get('TMPDIR'))
        self.addCleanup(self.temp.cleanup)
        self.home = Path(self.temp.name)
        self.ledger = self.home / 'ledger.json'
        self.terminal = self.home / 'guest-terminal.json'

    def state(self):
        return json.loads(self.ledger.read_text())

    def cli(self, *args):
        return subprocess.run([sys.executable, str(RECIPE), *map(str, args)], capture_output=True, timeout=10)

    def cli_run(self, plan, endpoint):
        path = self.home / 'plan.json'
        path.write_text(json.dumps(dict(commands=plan)))
        return self.cli('--allow-control', '--plan', path, '--ledger', self.ledger,
            '--run-id', 'offline-injected', '--endpoint', endpoint, '--terminal-file', self.terminal)

    def entry_run(self, plan, endpoint):
        # Same tracked main/argv/parser/HTTP code, without an idle nested Python
        # process. Historical failure above separately verifies OS-process restart.
        import contextlib
        import io
        entry_spec = importlib.util.spec_from_file_location('entry', RECIPE)
        entry = importlib.util.module_from_spec(entry_spec)
        entry_spec.loader.exec_module(entry)
        path = self.home / 'plan.json'
        path.write_text(json.dumps(dict(commands=plan)))
        with contextlib.redirect_stdout(io.StringIO()):
            return entry.main(['--allow-control', '--plan', str(path), '--ledger', str(self.ledger),
                '--run-id', 'offline-injected', '--endpoint', endpoint, '--terminal-file', str(self.terminal)])

    def server(self, responses):
        sends = self.home / 'sends.jsonl'
        config = self.home / 'server.json'
        config.write_text(json.dumps(dict(sends=str(sends), responses=responses)))
        process = subprocess.Popen([NODE, '--max-old-space-size=64', str(FIX / 'control-server.cjs'), str(config)],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        def cleanup():
            process.terminate()
            try:
                process.communicate(timeout=2)
            except subprocess.TimeoutExpired:
                process.kill()
                process.communicate(timeout=2)
        self.addCleanup(cleanup)
        # Bound the ready wait without changing inherited execution limits.
        import time
        end = time.monotonic()+5
        while time.monotonic() < end:
            if not select.select([process.stdout], [], [], .1)[0]:
                continue
            line = process.stdout.readline()
            if line.startswith('{'):
                return 'http://127.0.0.1:'+str(json.loads(line)['port'])+'/ctl', sends
            if process.poll() is not None:
                break
        self.fail('production control server did not listen')


class Production(Case):
    def test_historical_failure_owns_entire_recipe_and_durable_latch(self):
        historical = json.loads((FIX / 'historical-boundary.json').read_text())
        original = historical['sourceRecords']['48']
        confirmed = json.loads(original['api']['stdout'])['value']
        self.assertEqual(confirmed['batch'], 4650)
        self.assertEqual(historical['outcome']['terminalBatch'], 4754)
        self.assertFalse(historical['outcome']['partialFinalStep']['acknowledged'])
        endpoint, sends = self.server([dict(value=confirmed), dict(hang=True)])
        result = self.cli_run(historical['commands'], endpoint)
        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertEqual([json.loads(s) for s in sends.read_text().splitlines()], historical['commands'][:2])
        self.assertEqual(self.state()['status'], 'terminal')
        self.assertEqual(self.state()['lastAcknowledgedBatch'], 4650)
        self.assertEqual(self.state()['pending']['command'], dict(action='step', n=256))
        before = sends.read_bytes()
        # This is a new OS process: every attempted action is blocked, including quit.
        for command in historical['commands']:
            result = self.cli_run([command], endpoint)
            self.assertNotEqual(result.returncode, 0)
        self.assertEqual(sends.read_bytes(), before)
        result = self.cli('--collect', self.ledger, FIX / 'historical-boundary.json')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(len(json.loads(result.stdout)), 2)
        self.assertEqual(sends.read_bytes(), before)

    def test_normal_real_http_recipe_once_in_order(self):
        endpoint, sends = self.server([dict(value=value) for value in VALUES])
        self.assertEqual(self.entry_run(PLAN, endpoint), 0)
        self.assertEqual([json.loads(s) for s in sends.read_text().splitlines()], PLAN)
        self.assertEqual(self.state()['next'], len(PLAN))
        self.assertEqual(self.state()['guestAcceptance'], 'unqualified')
        self.assertEqual(self.state()['status'], 'terminal')  # quit ACK closes sends
        self.assertEqual(self.state()['lastFrozenBatch'], 4956)
        self.assertNotEqual(self.entry_run(PLAN, endpoint), 0)
        self.assertEqual(len(sends.read_text().splitlines()), len(PLAN))

    def test_historical_plan_is_never_runtime_authorized(self):
        endpoint, sends = self.server([])
        result = self.cli('--allow-control', '--plan', FIX / 'historical-boundary.json',
            '--ledger', self.ledger, '--run-id', 'forbidden', '--endpoint', endpoint,
            '--terminal-file', self.terminal)
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(sends.exists())


class Boundaries(Case):
    def test_every_command_boundary_and_response_failure(self):
        failures = [TimeoutError('lost ACK'), ConnectionError('terminal transport'),
            b'', b'{"ok":true,"value":', b'[]', b'{"ok":false,"error":"guest failed"}',
            b'{"ok":true}', b'{"ok":1,"value":null}', b'x'*8193,
            b'{"ok":true,"ok":false,"value":null}', b'{"ok":true,"value":NaN}',
            b'{"ok":true,"timedOut":true,"value":null}']
        for boundary in range(len(PLAN)):
            for mode, failure in enumerate(failures):
                with self.subTest(boundary=boundary, mode=mode):
                    ledger = self.home / ('l-'+str(boundary)+'-'+str(mode))
                    sends = []
                    def transport(command):
                        # Assert durable intent existed BEFORE actual dispatch.
                        state = json.loads(ledger.read_text())
                        self.assertEqual(state['status'], 'uncertain')
                        self.assertEqual(state['pending'], dict(index=len(sends), command=command))
                        index = len(sends)
                        sends.append(command)
                        if index == boundary:
                            if isinstance(failure, BaseException):
                                raise failure
                            return failure
                        return body(VALUES[index])
                    with self.assertRaises(control.ControlStopped):
                        control.Controller(ledger, 'injected', transport).run(PLAN)
                    self.assertEqual(sends, PLAN[:boundary+1])
                    self.assertEqual(json.loads(ledger.read_text())['status'], 'terminal')
                    for command in PLAN:
                        with self.assertRaises(control.ControlStopped):
                            control.Controller(ledger, 'injected', transport).run([command])
                    self.assertEqual(sends, PLAN[:boundary+1])

    def test_step_and_snapshot_completion_are_not_transport_acks(self):
        cases = [(1, dict(batch=4906, ran=104, steps=256, frozen=True)),
                 (1, dict(batch=4906, ran=256, steps=104, frozen=True)),
                 (1, dict(batch=4754, ran=256, steps=256, frozen=True)),
                 (1, dict(batch=4906, ran=256, steps=256, frozen=False)),
                 (2, dict(batch=4906, quit=False, frozen=dict(frozen=True, credits=1))),
                 (2, snapshot(4907)), (2, dict(batch=4906, quit=False, frozen=True)),
                 (3, dict(batch=4906, path='wrong', bytes=20, frozen=True)),
                 (3, dict(batch=4907, path='/tmp/offline-frame.png', bytes=20, frozen=True)),
                 (5, {}), (5, dict(batch=4906, queued=False)),
                 (5, dict(batch=4907, queued=True)), (9, {})]
        for index, (boundary, value) in enumerate(cases):
            ledger = self.home / ('bad-ack-'+str(index)); sends = []
            def transport(command):
                i = len(sends); sends.append(command)
                return body(value if i == boundary else VALUES[i])
            with self.assertRaises(control.ControlStopped):
                control.Controller(ledger, 'bad-ack', transport).run(PLAN)
            self.assertEqual(sends, PLAN[:boundary+1])

    def test_terminal_file_partial_progress_separate_from_last_ack(self):
        sends = []
        def transport(command):
            sends.append(command)
            if len(sends) == 2:
                self.terminal.write_text(json.dumps(dict(reason='guest-wall-or-cutoff', returncode=0, batch=4754)))
                raise TimeoutError('no ACK for256')
            return body(snapshot(4650))
        with self.assertRaises(control.ControlStopped):
            control.Controller(self.ledger, 'historical-injected', transport, self.terminal).run(PLAN)
        state = self.state()
        self.assertEqual(state['lastAcknowledgedBatch'], 4650)
        self.assertEqual(state['lastFrozenBatch'], 4650)
        self.assertEqual(state['terminalObserved']['batch'], 4754)
        self.assertEqual(sends, PLAN[:2])

    def test_known_guest_terminal_before_each_send_even_exit_zero(self):
        for boundary in range(len(PLAN)):
            ledger = self.home / ('terminal-'+str(boundary)); sends = []
            if boundary == 0:
                self.terminal.write_text('{"returncode":0,"reason":"wall"}')
            else:
                self.terminal.unlink(missing_ok=True)
            def transport(command):
                i = len(sends); sends.append(command)
                if len(sends) == boundary:
                    self.terminal.write_text('{"returncode":0,"reason":"wall"}')
                return body(VALUES[i])
            with self.assertRaises(control.ControlStopped):
                control.Controller(ledger, 'known-terminal', transport, self.terminal).run(PLAN)
            self.assertEqual(sends, PLAN[:boundary])

    def test_guest_terminal_in_response_latches(self):
        for fields in [dict(quit=True), dict(yieldReason=2), dict(stopped=True), dict(terminal=True), dict(quitting=True)]:
            ledger = self.home / ('reported-'+next(iter(fields))); sends = []
            def transport(command):
                sends.append(command)
                return body(dict(snapshot(4650), **fields))
            with self.assertRaises(control.ControlStopped):
                control.Controller(ledger, 'guest-terminal', transport).run(PLAN)
            self.assertEqual(sends, PLAN[:1])
            self.assertEqual(json.loads(ledger.read_text())['status'], 'terminal')

    def test_abrupt_exit_preserves_pre_dispatch_uncertainty(self):
        script = ('import importlib.util,os; s=importlib.util.spec_from_file_location("c",'+repr(str(HELPER))+');'
            'c=importlib.util.module_from_spec(s);s.loader.exec_module(c);'
            'c.Controller('+repr(str(self.ledger))+',"crash",lambda command:os._exit(17)).run('+repr(PLAN)+')')
        result = subprocess.run([sys.executable, '-c', script], capture_output=True, timeout=5)
        self.assertEqual(result.returncode, 17, result.stderr)
        self.assertEqual(self.state()['status'], 'uncertain')
        sends = []
        with self.assertRaises(control.ControlStopped):
            control.Controller(self.ledger, 'crash', lambda c: sends.append(c)).run(PLAN)
        self.assertEqual(sends, [])

    def test_complete_no_quit_is_still_one_shot_and_bounded(self):
        plan = PLAN[:-1]; sends = []
        def transport(command):
            i = len(sends); sends.append(command); return body(VALUES[i])
        state = control.Controller(self.ledger, 'complete', transport).run(plan)
        self.assertEqual(state['status'], 'complete')
        self.assertEqual(state['lastAcknowledgedBatch'], 4956)
        self.assertLess(self.ledger.stat().st_size, control.MAX_LEDGER)
        self.assertEqual(len(state['receipts']), len(plan))
        with self.assertRaises(control.ControlStopped):
            control.Controller(self.ledger, 'complete', transport).run(plan)
        self.assertEqual(sends, plan)

    def test_invalid_plan_and_corrupt_ledger_send_nothing(self):
        for i, plan in enumerate([[], [dict(action='step', n=256)], [dict(action='resume')],
                    [dict(cmd='run 256')], [dict(action='quit'), dict(action='snapshot')]]):
            sends = []; ledger = self.home / ('invalid-'+str(i))
            with self.assertRaises(control.ControlStopped):
                control.Controller(ledger, 'invalid', lambda c: sends.append(c)).run(plan)
            self.assertEqual(sends, [])
        self.ledger.write_text('{broken')
        sends = []
        with self.assertRaises(Exception):
            control.Controller(self.ledger, 'corrupt', lambda c: sends.append(c)).run(PLAN)
        self.assertEqual(sends, [])


def mutations():
    # Keep the regression itself byte-identical. Change actual helper/recipe
    # controls in a bounded temporary source copy, then run the SAME test.
    cases = [('durable-existing-ledger', HELPER, 'if self.path.exists():', 'if False:', 'unit'),
             ('pre-dispatch-wal', HELPER, 'self._store(state)\n                    raw =', 'pass\n                    raw =', 'unit'),
             ('step-ran-ack', HELPER, "or value['ran'] != n", 'or False', 'unit'),
             ('production-recipe-wiring', RECIPE, 'controller.run(commands)',
              "dict(status='complete',next=0,lastAcknowledgedBatch=None,lastFrozenBatch=None,terminalObserved=None,guestAcceptance='unqualified')", 'production')]
    with tempfile.TemporaryDirectory(prefix='alien-mutations-', dir=os.environ.get('TMPDIR')) as name:
        root = Path(name)
        for label, target, before, after, group in cases:
            if root.exists():
                shutil.rmtree(root)
            for path in [HELPER, RECIPE, ROOT/'lib/control-server.js', *FIX.glob('*')]:
                dest = root / path.relative_to(ROOT)
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(path, dest)
            dest = root / target.relative_to(ROOT)
            source = dest.read_text()
            assert source.count(before) == 1, label
            dest.write_text(source.replace(before, after))
            if group == 'production':
                # Replace the mutation driver rather than retaining an idle
                # extra Python process beside Node + the real CLI regression.
                os.execve(sys.executable, [sys.executable, __file__, '--group', group,
                    '--expect-rejection', label], dict(os.environ, ALIEN_CONTROL_ROOT=str(root)))
            result = subprocess.run([sys.executable, __file__, '--group', group],
                env=dict(os.environ, ALIEN_CONTROL_ROOT=str(root)), capture_output=True, timeout=30)
            assert result.returncode != 0, 'omitted control escaped unchanged regression: '+label
            print(json.dumps(dict(omitted=label, unchangedRegressionRejected=True,
                                  returncode=result.returncode, outputBytes=len(result.stdout)+len(result.stderr))), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--group', choices=['production', 'unit', 'mutations'], required=True)
    parser.add_argument('--expect-rejection', help='mutation harness only; preserve test assertions')
    args = parser.parse_args()
    if args.group == 'mutations':
        mutations()
    else:
        suite = unittest.defaultTestLoader.loadTestsFromTestCase(Production if args.group == 'production' else Boundaries)
        result = unittest.TextTestRunner(verbosity=2).run(suite)
        if args.expect_rejection:
            print(json.dumps(dict(omitted=args.expect_rejection,
                unchangedRegressionRejected=not result.wasSuccessful(),
                failures=len(result.failures), errors=len(result.errors))), flush=True)
            raise SystemExit(result.wasSuccessful())
        raise SystemExit(not result.wasSuccessful())
