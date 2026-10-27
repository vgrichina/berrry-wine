"""Actual CLI original-process authority boundaries, local HTTP only.

Run each method in a fresh Python process: the fake server process is the
original guest identity and must not regain authority between test methods.
"""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import threading
import http.server
import unittest

spec = importlib.util.spec_from_file_location('original_fixture', Path(__file__).with_name('test_controller.py'))
f = importlib.util.module_from_spec(spec)
spec.loader.exec_module(f)


class OwnerCase(f.Case):
    def alternate(self):
        server = http.server.HTTPServer(('127.0.0.1', 0), self.server.RequestHandlerClass)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        def cleanup():
            server.shutdown()
            thread.join()
            server.server_close()
        self.addCleanup(cleanup)
        return 'http://127.0.0.1:%d/ctl' % server.server_port

    def fresh(self, name):
        self.home = self.home / name
        self.home.mkdir()

    def test_simultaneous_ports_one_owner(self):
        endpoint = self.alternate()
        original = self.home
        self.mode = 'live-owner'
        first, r1 = self.run_cli(background=True)
        self.fresh('competitor')
        second, r2 = self.run_cli(background=True, endpoint=endpoint)
        self.home = original
        try:
            self.assertTrue(self.input_arrived.wait(3))
            # One process holds the input ACK; the competitor must exit without
            # snapshot, step, capture, click or Quit. No ordering assumption.
            import time
            until = time.monotonic() + 2
            while first.poll() is None and second.poll() is None and time.monotonic() < until:
                threading.Event().wait(.01)
            self.assertEqual(sorted([first.poll() is None, second.poll() is None]), [False, True])
            self.assertEqual(self.commands(), [dict(action='snapshot'), dict(cmd='click:98:296')])
        finally:
            self.resume.set()
            for p, record in ((first, r1), (second, r2)):
                out, err = p.communicate(timeout=5)
                record.update(returncode=p.returncode, stdout=out, stderr=err)
        self.assertEqual(sorted([first.returncode, second.returncode]), [0, 1])
        self.assertEqual(sum('cmd' in c for c in self.commands()), 1)
        self.assertEqual(sum(c.get('action') == 'quit' for c in self.commands()), 1)

    def refused_reentry(self, mode):
        endpoint = self.alternate()
        if mode == 'budget':
            self.budget['deadline'] = 1105
        elif mode == 'terminal':
            self.terminal.write_text('{"returncode":0}')
        elif mode == 'uncertain':
            self.mode = 'uncertain'
        result = self.run_cli()
        self.assertEqual(result.returncode, 0 if mode == 'complete' else 1, result.stdout)
        before = self.commands()
        self.fresh('renewed-authority')
        self.budget.update(runId='different-config', startedAt=1070, deadline=1190, capturesUsed=0)
        self.frame_info['runId'] = self.approval['runId'] = self.budget['runId']
        self.terminal = self.home / 'new-terminal.json'
        self.mode = ''
        self.assert_blocked(self.run_cli(endpoint=endpoint), 'existing control process owner')
        self.assertEqual(self.commands(), before)
        self.assertFalse((self.home / 'sequence-ledger.json').exists())
        self.assertFalse((self.home / 'usage.json').exists())

    def test_exit_cannot_renew(self): self.refused_reentry('complete')
    def test_uncertainty_cannot_renew(self): self.refused_reentry('uncertain')
    def test_terminal_cannot_renew(self): self.refused_reentry('terminal')
    def test_budget_refusal_cannot_renew(self): self.refused_reentry('budget')

    def test_alias_path_address_fail_closed(self):
        self.assertEqual(self.run_cli().returncode, 0)
        before = self.commands()
        endpoint = self.alternate()
        for i, url in enumerate((endpoint.replace('/ctl','/other'), endpoint.replace('127.0.0.1','localhost'), endpoint.replace('127.0.0.1','127.0.0.2'), endpoint.replace(':', ':', 1).replace('/ctl','/ctl?q=1'), endpoint.replace('/ctl','/ctl#alias'), endpoint.replace(':%d'%int(endpoint.split(':')[2].split('/')[0]), ':0'+endpoint.split(':')[2].split('/')[0]))):
            self.fresh('alias-%d' % i)
            result = self.run_cli(endpoint=url)
            self.assertEqual(result.returncode, 1, result.stdout)
            self.assertEqual(self.commands(), before)

    def legacy_claim(self, start):
        import hashlib
        directory = Path('/tmp') / ('wine-ops-alien-menu-owners-' + str(os.getuid()))
        directory.mkdir(mode=0o700, exist_ok=True)
        identity = dict(bootId=Path('/proc/sys/kernel/random/boot_id').read_text().strip(),
                        pid=os.getpid(), startTicks=start, endpoint='http://127.0.0.1:1/ctl')
        key = hashlib.sha256(json.dumps(identity, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
        path = directory / (key + '.json')
        path.write_text(json.dumps(dict(identity=identity, invocation=str(self.home), legacy=True)))
        (self.home / 'legacy-claim.json').write_bytes(path.read_bytes())
        return path

    def test_legacy_listener_claim_cannot_renew(self):
        start = Path('/proc/self/stat').read_text().rsplit(') ',1)[1].split()[19]
        self.legacy_claim(start)
        self.assert_blocked(self.run_cli(endpoint=self.alternate()), 'existing control process owner')
        self.assertEqual(self.commands(), [])

    def test_reused_pid_old_start_does_not_block_new_process(self):
        self.legacy_claim('0')
        self.assertEqual(self.run_cli().returncode, 0)
        self.assertEqual(self.commands()[-1], dict(action='quit'))

    def test_distinct_original_process_allowed(self):
        self.assertEqual(self.run_cli().returncode, 0)
        destination = self.home / 'distinct-process'
        result = subprocess.run([sys.executable, str(Path(__file__).with_name('test_controller.py')),
                                 str(destination), 'Case.test_approved_menu_action_then_reserved_evidence_and_quit'],
                                capture_output=True, text=True, timeout=6)
        (self.home/'distinct-process-result.json').write_text(json.dumps(dict(argv=result.args, exit=result.returncode, stdout=result.stdout, stderr=result.stderr)))
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == '__main__':
    f.OUT.mkdir(parents=True, exist_ok=False)
    unittest.main(verbosity=2)
