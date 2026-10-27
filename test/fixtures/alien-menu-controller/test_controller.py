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
        # Historical method name retained for the unchanged rejection
        # reproducer's setup. Positive attach semantics are explicitly retired;
        # production positive coverage is now in test_supervised.py.
        self.assert_blocked(self.run_cli(), 'attachment retired')
        self.assertEqual(self.commands(), [])
        for name in ('owner.json', 'admitted-budget.json', 'usage.json', 'sequence-ledger.json'):
            self.assertFalse((self.home/name).exists())

    def test_no_default_approval_sends_nothing(self):
        self.assert_blocked(self.run_cli(approved=False), 'attachment retired')
        self.assertEqual(self.commands(), [])

    def test_changed_config_cannot_grant_attachment(self):
        self.assert_blocked(self.run_cli(), 'attachment retired')
        self.home = self.home/'different-output'
        self.home.mkdir()
        self.budget.update(runId='new-config',startedAt=1070,deadline=1190,capturesUsed=0)
        self.assert_blocked(self.run_cli(), 'attachment retired')
        self.assertEqual(self.commands(), [])


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=False)
    (OUT / 'inherited-limits.json').write_text(json.dumps(dict(executable=sys.executable,
        executableSHA256=hashlib.file_digest(open(sys.executable, 'rb'), 'sha256').hexdigest(),
        limits={name:resource.getrlimit(getattr(resource, 'RLIMIT_'+name)) for name in ('CPU','FSIZE','DATA','AS')},
        productionCLI=str(CLI), productionSHA256=hashlib.sha256(CLI.read_bytes()).hexdigest()), indent=2))
    unittest.main(verbosity=2)
