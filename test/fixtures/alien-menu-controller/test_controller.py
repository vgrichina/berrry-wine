"""Real orchestration CLI and unchanged serial HTTP controller, no game runtime."""
import hashlib
import http.server
import json
import os
from pathlib import Path
import resource
import subprocess
import sys
import threading
import unittest

ROOT = Path(__file__).resolve().parents[3]
FIX = Path(__file__).parent
CLI = ROOT / 'tools/alien-menu-gameplay-controller.py'
OUT = Path(sys.argv[1]).resolve()
sys.argv = [sys.argv[0], *sys.argv[2:]]


class Case(unittest.TestCase):
    def setUp(self):
        self.home = OUT / self._testMethodName
        self.home.mkdir(parents=True, exist_ok=False)
        self.clock = self.home / 'clock.json'
        self.clock.write_text('{"now":1070}')
        self.frame = self.home / 'menu.png'
        self.frame.write_bytes(b'offline human-reviewed frame identity only')
        self.budget = dict(runId='offline/' + self._testMethodName, startedAt=1000, deadline=1120,
                           startupMaximum=75, actionReserve=30, cleanupReserve=10,
                           captureLimit=8, capturesUsed=5)
        self.frame_info = dict(runId=self.budget['runId'], batch=4722, path=str(self.frame),
                               sha256=hashlib.sha256(self.frame.read_bytes()).hexdigest())
        self.approval = dict(runId=self.budget['runId'], batch=4722, frameSHA256=self.frame_info['sha256'],
                             humanReviewed=True, reviewId='explicit-offline-review', action='New Game', command='click:98:296')
        self.terminal = self.home / 'terminal.json'
        self.requests = []
        self.invocations = []
        self.batch = 4722
        self.mode = ''
        self.input_arrived = threading.Event()
        self.resume = threading.Event()
        case = self

        class Handler(http.server.BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def do_POST(self):
                raw = self.rfile.read(int(self.headers['Content-Length']))
                cmd = json.loads(raw)
                row = dict(commandRaw=raw.decode(), command=cmd, clock=json.loads(case.clock.read_text()))
                case.requests.append(row)
                action = cmd.get('action')
                if 'cmd' in cmd:
                    if case.mode == 'live-owner':
                        case.input_arrived.set()
                        assert case.resume.wait(4), 'live ownership test did not release input ACK'
                    if case.mode == 'uncertain':
                        self.close_connection = True
                        row['responseRaw'] = None
                        return
                    value = dict(batch=case.batch, queued=True)
                elif action == 'step':
                    case.batch += cmd['n']
                    value = dict(batch=case.batch, ran=cmd['n'], steps=cmd['n'], frozen=True)
                    if case.mode == 'wrong-step':
                        value['ran'] -= 1
                    if case.mode == 'slow-after':
                        case.clock.write_text('{"now":1111}')
                elif action == 'snapshot':
                    value = dict(batch=case.batch, quit=False, frozen=dict(frozen=True, credits=0))
                    if case.mode == 'wrong-frozen':
                        value['frozen']['credits'] = 1
                    if case.mode == 'wrong-batch':
                        value['batch'] += 1
                    if case.mode == 'slow-snapshot':
                        case.clock.write_text('{"now":1081}')
                elif action == 'png':
                    value = dict(batch=case.batch, frozen=True, path=cmd['path'], bytes=20)
                    if (case.mode == 'cleanup-reserve' and
                            sum(r['command'].get('action') == 'png' for r in case.requests) == 3):
                        # All three captures finish with exactly ten seconds
                        # left for Quit; no extra menu capture was spent.
                        case.clock.write_text('{"now":1110}')
                else:
                    assert action == 'quit', cmd
                    value = dict(quitting=True)
                response = json.dumps(dict(ok=True, value=value)).encode()
                row['responseRaw'] = response.decode()
                self.send_response(200)
                self.send_header('Content-Length', str(len(response)))
                self.end_headers()
                self.wfile.write(response)

        self.server = http.server.HTTPServer(('127.0.0.1', 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.addCleanup(self.cleanup)

    def cleanup(self):
        self.server.shutdown()
        self.thread.join()
        self.server.server_close()
        (self.home / 'http.json').write_text(json.dumps(self.requests, indent=2) + '\n')
        (self.home / 'cli.json').write_text(json.dumps(self.invocations, indent=2) + '\n')

    def run_cli(self, approved=True, connect=None, background=False, endpoint=None, process=None):
        endpoint = endpoint or 'http://127.0.0.1:%d/ctl' % self.server.server_port
        process = process or dict(pid=os.getpid(), startTicks=Path('/proc/self/stat').read_text().rsplit(') ',1)[1].split()[19], endpoint=endpoint)
        for name, value in [('budget.json', self.budget), ('menu-frame.json', self.frame_info), ('approval.json', self.approval)]:
            (self.home / name).write_text(json.dumps(value))
        (self.home / 'process.json').write_text(json.dumps(process))
        argv = [sys.executable, str(CLI), '--invocation', str(self.home),
                '--endpoint', endpoint,
                '--terminal-file', str(self.terminal), '--after-batches', '128']
        if approved:
            argv.append('--approve-new-game')
        env = dict(os.environ, PYTHONPATH=str(FIX), PYTHONDONTWRITEBYTECODE='1', ALIEN_TEST_CLOCK=str(self.clock))
        if connect is not None:
            env['ALIEN_TEST_CONNECT'] = json.dumps(connect)
        record = dict(argv=argv, environmentOverrides={k:env[k] for k in
            ('PYTHONPATH', 'PYTHONDONTWRITEBYTECODE', 'ALIEN_TEST_CLOCK', 'ALIEN_TEST_CONNECT') if k in env})
        self.invocations.append(record)
        if background:
            return subprocess.Popen(argv, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True), record
        result = subprocess.run(argv, env=env, capture_output=True, text=True, timeout=5)
        record.update(returncode=result.returncode, stdout=result.stdout, stderr=result.stderr)
        return result

    def commands(self):
        return [row['command'] for row in self.requests]

    def assert_blocked(self, result, text):
        self.assertEqual(result.returncode, 1, (result.stdout, result.stderr))
        self.assertIn(text, result.stdout)

    def test_approved_menu_action_then_reserved_evidence_and_quit(self):
        result = self.run_cli()
        self.assertEqual(result.returncode, 0, (result.stdout, result.stderr))
        cmds = self.commands()
        self.assertEqual(cmds[:2], [dict(action='snapshot'), dict(cmd='click:98:296')])
        self.assertEqual([c for c in cmds if 'cmd' in c], [dict(cmd='click:98:296')])
        self.assertEqual([c['n'] for c in cmds if c.get('action') == 'step'], [128, 128])
        self.assertEqual([Path(c['path']).name for c in cmds if c.get('action') == 'png'],
                         ['new-game-response.png', 'mission-observation.png', 'before-quit.png'])
        self.assertEqual(cmds[-1], dict(action='quit'))
        self.assertEqual(json.loads((self.home/'usage.json').read_text())['capturesCharged'], 8)
        self.assertEqual(json.loads(result.stdout)['guestAcceptance'], 'unqualified')
        self.assert_blocked(self.run_cli(), 'existing invocation owner')
        self.assertEqual(self.commands(), cmds)

    def test_slow_startup_stops_before_any_control(self):
        self.clock.write_text('{"now":1076}')
        self.assert_blocked(self.run_cli(), 'startup elapsed 76.000000s exceeds 75.000000s')
        self.assertEqual(self.commands(), [])

    def test_insufficient_action_time_stops_before_any_control(self):
        self.budget['deadline'] = 1105
        self.assert_blocked(self.run_cli(), 'remaining 35.000000s < required 40.000000s')
        self.assertEqual(self.commands(), [])

    def test_insufficient_capture_credits_stops_before_any_control(self):
        self.budget['capturesUsed'] = 6
        self.assert_blocked(self.run_cli(), 'capture credits 2 < required 3')
        self.assertEqual(self.commands(), [])

    def test_no_default_approval_sends_nothing(self):
        self.assert_blocked(self.run_cli(approved=False), 'no explicit approval')
        self.assertEqual(self.commands(), [])

    def test_unreviewed_or_changed_frame_stops_before_control(self):
        self.frame.write_bytes(b'changed')
        self.assert_blocked(self.run_cli(), 'frame identity changed')
        self.assertEqual(self.commands(), [])

    def test_wrong_review_authorization_stops_before_control(self):
        self.approval['humanReviewed'] = False
        self.assert_blocked(self.run_cli(), 'explicit matching human-reviewed')
        self.assertEqual(self.commands(), [])

    def test_wrong_frozen_snapshot_stops_before_input(self):
        self.mode = 'wrong-frozen'
        self.assert_blocked(self.run_cli(), 'snapshot not confirmed frozen/zero-credit/alive')
        self.assertEqual(self.commands(), [dict(action='snapshot')])

    def test_changed_review_batch_stops_before_input(self):
        self.mode = 'wrong-batch'
        self.assert_blocked(self.run_cli(), 'frozen boundary differs from reviewed menu frame')
        self.assertEqual(self.commands(), [dict(action='snapshot')])

    def test_wrong_step_ack_stops_before_capture_and_quit(self):
        self.mode = 'wrong-step'
        self.assert_blocked(self.run_cli(), 'lost/partial/inconsistent step ACK')
        self.assertEqual(self.commands()[-1], dict(action='step', n=128))
        self.assertFalse(any(c.get('action') == 'png' for c in self.commands()))

    def test_uncertain_input_is_durable_and_never_replayed(self):
        self.mode = 'uncertain'
        self.assert_blocked(self.run_cli(), 'RemoteDisconnected')
        ledger = json.loads((self.home / 'sequence-ledger.json').read_text())
        self.assertEqual(ledger['pending']['command'], dict(cmd='click:98:296'))
        self.assertEqual(ledger['status'], 'terminal')
        before = self.commands()
        self.assert_blocked(self.run_cli(), 'existing invocation owner')
        self.assertEqual(self.commands(), before)
        self.assertEqual(sum('cmd' in c for c in before), 1)

    def test_terminal_before_control(self):
        self.terminal.write_text('{"returncode":0,"reason":"already ended"}')
        self.assert_blocked(self.run_cli(), 'known guest terminal receipt')
        self.assertEqual(self.commands(), [])

    def test_terminal_during_connection_stops_at_actual_send_boundary(self):
        self.assert_blocked(self.run_cli(connect=dict(terminal=str(self.terminal))), 'known guest terminal receipt')
        self.assertEqual(self.commands(), [dict(action='snapshot')])
        self.assertTrue(json.loads((self.home/'usage.json').read_text())['inputIssued'])

    def test_time_exhausted_during_connection_stops_before_input(self):
        self.assert_blocked(self.run_cli(connect=dict(now=1081)), 'budget blocker: startup elapsed')
        self.assertEqual(self.commands(), [dict(action='snapshot')])

    def test_action_reserve_checked_again_at_socket_send(self):
        self.budget['deadline'] = 1110
        self.assert_blocked(self.run_cli(connect=dict(now=1074)), 'remaining 36.000000s < required 40.000000s')
        self.assertEqual(self.commands(), [dict(action='snapshot')])

    def test_slow_initial_snapshot_stops_before_input(self):
        self.mode = 'slow-snapshot'
        self.assert_blocked(self.run_cli(), 'startup elapsed')
        self.assertEqual(self.commands(), [dict(action='snapshot')])

    def test_slow_action_stops_without_spending_cleanup_reserve(self):
        self.mode = 'slow-after'
        self.assert_blocked(self.run_cli(), 'remaining 9.000000s < required 10.000000s')
        self.assertEqual(self.commands()[-1], dict(action='step', n=128))
        # A completed step followed by budget refusal cannot be reconnected.
        before = self.commands()
        self.assert_blocked(self.run_cli(), 'existing invocation owner')
        self.assertEqual(self.commands(), before)

    def test_cleanup_reserved_with_last_three_capture_credits(self):
        self.mode = 'cleanup-reserve'
        self.assertEqual(self.run_cli().returncode, 0)
        self.assertEqual(self.commands()[-1], dict(action='quit'))
        self.assertEqual(len([c for c in self.commands() if c.get('action') == 'png']), 3)
        self.assertEqual(self.requests[-1]['clock']['now'], 1110)

    def test_allowance_cannot_be_renewed_after_refusal(self):
        self.budget['deadline'] = 1105
        self.assert_blocked(self.run_cli(), 'remaining 35.000000s')
        self.budget['deadline'] = 1120
        self.assert_blocked(self.run_cli(), 'existing invocation allowance changed')
        self.assertEqual(self.commands(), [])

    def test_second_directory_cannot_replay_issued_input(self):
        self.assertEqual(self.run_cli().returncode, 0)
        before = self.commands()
        original = self.home
        self.home = original / 'second-directory'
        self.home.mkdir()
        try:
            self.assert_blocked(self.run_cli(), 'existing control process owner')
        finally:
            self.home = original
        self.assertEqual(self.commands(), before)

    def test_second_directory_cannot_control_live_owner(self):
        self.mode = 'live-owner'
        first, record = self.run_cli(background=True)
        original = self.home
        try:
            self.assertTrue(self.input_arrived.wait(3))
            before = self.commands()
            self.home = original / 'second-directory'
            self.home.mkdir()
            self.assert_blocked(self.run_cli(), 'existing control process owner')
            self.assertEqual(self.commands(), before)
        finally:
            self.home = original
            self.resume.set()
            stdout, stderr = first.communicate(timeout=5)
            record.update(returncode=first.returncode, stdout=stdout, stderr=stderr)
        self.assertEqual(first.returncode, 0, record)
        self.assertEqual(sum('cmd' in c for c in self.commands()), 1)

    def test_endpoint_spelling_cannot_split_process_ownership(self):
        self.assertEqual(self.run_cli().returncode, 0)
        before = self.commands()
        original = self.home
        self.home = original / 'second-directory'
        self.home.mkdir()
        try:
            alias = 'http://127.0.0.1:0%d/ctl' % self.server.server_port
            self.assert_blocked(self.run_cli(endpoint=alias), 'existing control process owner')
        finally:
            self.home = original
        self.assertEqual(self.commands(), before)

    def test_wrong_process_start_identity_stops_before_control(self):
        process = dict(pid=os.getpid(), startTicks='0', endpoint='http://127.0.0.1:%d/ctl' % self.server.server_port)
        self.assert_blocked(self.run_cli(process=process), 'control process identity changed')
        self.assertEqual(self.commands(), [])

    def test_live_unrelated_process_cannot_claim_endpoint(self):
        process = dict(pid=os.getppid(), startTicks=Path('/proc/%d/stat'%os.getppid()).read_text().rsplit(') ',1)[1].split()[19], endpoint='http://127.0.0.1:%d/ctl' % self.server.server_port)
        self.assert_blocked(self.run_cli(process=process), 'endpoint listener not owned by control process')
        self.assertEqual(self.commands(), [])


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=False)
    (OUT / 'inherited-limits.json').write_text(json.dumps(dict(executable=sys.executable,
        executableSHA256=hashlib.file_digest(open(sys.executable, 'rb'), 'sha256').hexdigest(),
        limits={name:resource.getrlimit(getattr(resource, 'RLIMIT_'+name)) for name in ('CPU','FSIZE','DATA','AS')},
        productionCLI=str(CLI), productionSHA256=hashlib.sha256(CLI.read_bytes()).hexdigest()), indent=2))
    unittest.main(verbosity=2)
