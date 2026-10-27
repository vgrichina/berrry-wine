"""Offline HTTP tests. No emulator/guest/Node/Boat invocation."""
import ast
import contextlib
import hashlib
import http.server
import importlib.util
import json
import os
from pathlib import Path
import socket
import shutil
import struct
import subprocess
import sys
import tempfile
import threading
import time
import unittest
import zlib

HERE = Path(__file__).resolve().parent
TOOL = Path(os.environ.get('ENIGMA_CONTROLLER_UNDER_TEST', HERE.parents[2] / 'tools/enigma-frozen-gameplay-controller.py'))
spec = importlib.util.spec_from_file_location('controller', TOOL)
ctl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ctl)


def png():
    def chunk(kind, value):
        return struct.pack('>I', len(value)) + kind + value + struct.pack('>I', zlib.crc32(kind + value))
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 640, 480, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress((b'\0' + b'\0' * 1920) * 480)) + chunk(b'IEND', b''))


class FakeProduction:
    def __init__(self, *, batch=0, cap=20000, rate=5000, latency=0, fault=None, real_delay=False,
                 host='127.0.0.1'):
        self.batch, self.cap, self.rate = batch, cap, rate
        self.latency, self.fault, self.real_delay = latency, fault, real_delay
        self.now = time.time()
        self.commands, self.events = [], []
        self.terminal = False
        self.in_step = False
        self.credits = 0
        self.frames = []
        self.on_capture = None
        self.png = png()
        owner = self

        class Handler(http.server.BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def do_POST(self):
                cmd = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
                owner.commands.append(cmd)
                owner.events.append(dict(command=cmd, batch=owner.batch, time=owner.now))
                if owner.terminal:
                    self.connection.close()
                    return
                delay = owner.latency
                action = cmd.get('action')
                if action == 'step':
                    assert not owner.in_step
                    owner.in_step = True
                    owner.credits = cmd['n']
                    delay += cmd['n'] / owner.rate
                    owner.batch += cmd['n']
                    if owner.batch >= owner.cap or owner.fault == 'disconnect':
                        owner.terminal = True
                        owner.now += delay
                        self.connection.shutdown(socket.SHUT_RDWR)
                        self.connection.close()
                        return
                    value = dict(batch=owner.batch, ran=cmd['n'], steps=cmd['n'], frozen=True)
                    if owner.fault == 'wrong-ack':
                        value['ran'] -= 1
                    if owner.fault == 'wrong-ack-batch':
                        value['batch'] += 1
                    owner.credits = 0
                    owner.in_step = False
                elif action == 'snapshot':
                    value = dict(batch=owner.batch, quit=False, yieldReason=0,
                                 frozen=dict(frozen=True, tickMs=200, credits=owner.credits, recording=False))
                    if owner.batch > 0 and owner.fault == 'wrong-frozen':
                        value['frozen']['credits'] = 1
                    if owner.batch > 0 and owner.fault == 'wrong-snapshot-batch':
                        value['batch'] += 1
                    if owner.fault == 'quit-snapshot':
                        value['quit'] = True
                elif action == 'png':
                    assert owner.credits == 0 and not owner.in_step
                    Path(cmd['path']).write_bytes(owner.png)
                    value = dict(batch=owner.batch, frozen=True, bytes=len(owner.png), path=cmd['path'])
                    owner.frames.append((owner.batch, cmd['path']))
                    if owner.on_capture:
                        owner.on_capture(cmd['path'], owner.batch, owner.png)
                elif action == 'quit':
                    value = dict(quitting=True)
                    owner.terminal = True
                elif 'cmd' in cmd:
                    assert owner.credits == 0 and not owner.in_step
                    if owner.fault == 'click-disconnect':
                        owner.terminal = True
                        self.connection.shutdown(socket.SHUT_RDWR)
                        self.connection.close()
                        return
                    value = dict(queued=True, batch=owner.batch)
                else:
                    raise AssertionError(cmd)
                owner.now += delay
                if owner.real_delay:
                    time.sleep(delay)
                data = json.dumps(dict(ok=True, value=value)).encode()
                self.send_response(200)
                self.send_header('Content-Length', str(len(data)))
                self.end_headers()
                try:
                    self.wfile.write(data)
                except BrokenPipeError:
                    pass

        class Server(http.server.HTTPServer):
            address_family = socket.AF_INET6 if ':' in host else socket.AF_INET
        self.server = Server((host, 0), Handler)
        self.host = host
        self.thread = threading.Thread(target=self.server.serve_forever, kwargs={'poll_interval': .01}, daemon=True)

    def __enter__(self):
        # Each distinct process really holds this listening socket through an
        # inherited FD. The parent services HTTP and records wire evidence.
        # This models listener ownership, not execution of a production guest.
        # Do not substitute an unrelated idle PID: that was the rejected fixture.
        self.process = subprocess.Popen([sys.executable, '-S', '-c', 'import time; time.sleep(120)'],
                                        pass_fds=(self.server.fileno(),),
                                        stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                                        stderr=subprocess.DEVNULL)
        self.thread.start()
        return self

    def __exit__(self, *args):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        if self.process.poll() is None:
            self.process.terminate()
        self.process.wait(timeout=5)

    def config(self, directory, **updates):
        host = self.host if ':' not in self.host else '[' + self.host + ']'
        c = dict(url=f'http://{host}:{self.server.server_port}/ctl',
                 evidence_dir=str(directory / 'evidence'), terminal_path=str(directory / 'terminal.json'),
                 pid=self.process.pid, process_start_ticks=ctl.process_identity(self.process.pid),
                 started_at=self.now, deadline_at=self.now + 110, max_batches=self.cap,
                 checkpoint_batches=4096, checkpoint_seconds=35, after_action_batches=256,
                 after_action_seconds=8, cleanup_batches=1, cleanup_seconds=1,
                 review_seconds=0, request_timeout=.1, max_captures=8, capture_bytes=2097152,
                 width=640, height=480, supervisor_limits=dict(cpu=90, wall=120, physical=134217728,
                                                             file=25165824, output=2097152))
        c.update(updates)
        return c


def legacy_drive(fake, source):
    """Execute original AST functions and original 35s loop, without top-level launch.

    Only the environment (HTTP target, evidence sink, clock, process probe) is
    supplied. No scheduling/function text is edited or reconstructed.
    """
    import urllib.request
    class Process:
        def poll(self):
            return None
    class Clock:
        def monotonic(self):
            return fake.now
        def time(self):
            return fake.now
    class Trace:
        def write(self, value):
            pass
        def flush(self):
            pass
    # The unchanged control function pins port18127. Instead of replacing its
    # source, inject urllib with a Request factory forwarding the same payload
    # to this private offline HTTP server. The original raw ACK checks execute.
    class Request:
        @staticmethod
        def Request(url, **kw):
            return urllib.request.Request(f'http://127.0.0.1:{fake.server.server_port}/ctl', **kw)
        urlopen = staticmethod(urllib.request.urlopen)
    tree = ast.parse(source)
    functions = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in ('control', 'snapshot', 'step')]
    attempt = next(n for n in tree.body if isinstance(n, ast.Try))
    loop = next(n for n in attempt.body if isinstance(n, ast.While) and ast.unparse(n.test) == 'time.monotonic() - start < 35')
    env = dict(pathlib=Path, json=json, time=Clock(), p=Process(), reason='running', trace=Trace(),
               requests=0, pending=False, batch=0, steps=0, total=0, start=fake.now,
               urllib=type('URL', (), {'request': Request}), s=None)
    exec(compile(ast.Module(body=functions, type_ignores=[]), 'unchanged-operate-functions', 'exec'), env)
    env['snapshot']()
    env['step'](1)
    try:
        exec(compile(ast.Module(body=[loop], type_ignores=[]), 'unchanged-operate-35s-loop', 'exec'), env)
    except Exception as ex:
        return dict(batch=env['batch'], steps=env['steps'], error=repr(ex), pending=env['pending'])
    raise AssertionError('original unexpectedly reached capture checkpoint')


def scheduler_unit_controller(config, *, clock=time.time, sleep=time.sleep):
    """Private scheduler unit harness, NOT production authority/entry evidence.

    The public constructor refuses attachment. Production handoff correctness
    is tested separately by test_supervised.py with real launched child state.
    """
    class UnitOwner:
        def __init__(self):
            self.config = config
            self.listener = ctl.ListenerIdentity(config)
        def live(self):
            ctl.require(not Path(config['terminal_path']).exists(), 'terminal-supervisor')
        def budget(self):
            return dict(cpu_left=config.get('test_cpu_left', 90), wall_left=config['deadline_at']-clock())
        def record(self, row):
            pass
        def close(self):
            pass
    driver = object.__new__(ctl.Controller)
    driver._initialize(UnitOwner(), clock=clock, sleep=sleep)
    return driver


class ControllerTests(unittest.TestCase):
    def retain(self, directory):
        root = os.environ.get('ENIGMA_TEST_EVIDENCE_DIR')
        if root:
            target = Path(root)/self._testMethodName
            shutil.copytree(directory/'evidence', target)

    def run_driver(self, fake, **kw):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        directory = Path(tmp.name)
        config = fake.config(directory, **kw)
        driver = scheduler_unit_controller(config, clock=lambda: fake.now, sleep=lambda n: setattr(fake, 'now', fake.now + n))
        result = driver.run()
        return driver, result, directory

    def test_fast_actual_driver_captures_before_20000_cap(self):
        with FakeProduction() as fake:
            d, status, directory = self.run_driver(fake)
            self.assertEqual(status, 'NO_REVIEWED_ACTION_NO_INPUT')
            self.assertEqual(fake.frames[0][0], 4097)
            self.assertLess(fake.events[-1]['time'] - d.c['started_at'], 4)
            self.assertFalse(d.clicked)
            self.assertFalse(any('cmd' in c for c in fake.commands))
            self.assertEqual(fake.commands[-1], {'action': 'quit'})
            self.retain(directory)
            trace = [json.loads(x) for x in (directory/'evidence/requests.jsonl').read_text().splitlines()]
            for i, row in enumerate(trace):
                if row['request'].get('action') == 'step':
                    self.assertEqual(trace[i+1]['request'], {'action': 'snapshot'})
                    ack = json.loads(row['originalResponse'])['value']
                    snap = json.loads(trace[i+1]['originalResponse'])['value']
                    self.assertEqual(ack['batch'], snap['batch'])
                    self.assertEqual(snap['frozen']['credits'], 0)

    def test_slower_response_time_checkpoint_first(self):
        with FakeProduction(rate=10, latency=.1) as fake:
            d, status, _ = self.run_driver(fake, checkpoint_seconds=1, checkpoint_batches=10000)
            self.assertEqual(status, 'NO_REVIEWED_ACTION_NO_INPUT')
            self.assertLess(fake.frames[0][0], 10001)
            self.assertEqual(fake.frames[0][0], 257)
            self.assertLess(d.batch, fake.cap)

    def test_last31_clips_both_checkpoint_and_reserve(self):
        with FakeProduction(batch=19969) as fake:
            d, status, _ = self.run_driver(fake, after_action_batches=2, checkpoint_batches=13)
            self.assertEqual(status, 'NO_REVIEWED_ACTION_NO_INPUT')
            self.assertEqual([x['n'] for x in fake.commands if x.get('action') == 'step'], [1, 13])
            self.assertEqual(d.batch, 19983)
        with FakeProduction(batch=19969) as fake:
            d, status, _ = self.run_driver(fake, after_action_batches=2)
            self.assertEqual(status, 'NO_REVIEWED_ACTION_NO_INPUT')
            self.assertEqual([x['n'] for x in fake.commands if x.get('action') == 'step'], [1, 26])
            self.assertEqual(d.batch, 19996)

    def test_zero_one_and_insufficient_reserve_no_step(self):
        for remaining in (0, 1, 31):
            with self.subTest(remaining=remaining), FakeProduction(batch=20000-remaining) as fake:
                d, status, _ = self.run_driver(fake)
                self.assertIn('exhausted-budget', status)
                self.assertFalse(any(c.get('action') in ('step', 'png') or 'cmd' in c for c in fake.commands))

    def test_wrong_completion_and_uncertain_no_replay(self):
        for fault in ('wrong-ack', 'wrong-ack-batch', 'wrong-frozen', 'wrong-snapshot-batch', 'disconnect', 'quit-snapshot'):
            with self.subTest(fault=fault), FakeProduction(fault=fault) as fake:
                d, status, directory = self.run_driver(fake)
                self.assertTrue(d.failed, status)
                self.assertFalse(any(c.get('action') in ('png', 'quit') or 'cmd' in c for c in fake.commands))
                self.assertLessEqual(sum(c.get('action') == 'step' for c in fake.commands), 1)
                before = len(fake.commands)
                with self.assertRaises(ctl.Refusal):
                    d.request({'action': 'step', 'n': 1})
                with self.assertRaisesRegex(ctl.Refusal, 'existing-guest-attachment-retired'):
                    ctl.Controller(d.c, clock=lambda: fake.now)
                self.assertEqual(before, len(fake.commands))
                if fault == 'disconnect':
                    self.assertTrue(d.pending)

    def test_terminal_refuses_all_wire(self):
        with FakeProduction() as fake:
            with tempfile.TemporaryDirectory() as tmp:
                config = fake.config(Path(tmp))
                Path(config['terminal_path']).write_text('{}')
                with self.assertRaisesRegex(ctl.Refusal, 'terminal-supervisor'):
                    scheduler_unit_controller(config, clock=lambda: fake.now)
                self.assertEqual(fake.commands, [])

    def test_reviewed_action_then_capture_and_cleanup_reserve(self):
        with FakeProduction(batch=19969) as fake, tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            decision = directory/'decision.json'
            def authorize(path, batch, raw):
                if path.endswith('menu-candidate.png'):
                    decision.write_text(json.dumps(dict(safeStartGame=True, reviewed=True,
                        frameSHA256=hashlib.sha256(raw).hexdigest(), batch=batch, x=10, y=20)))
            fake.on_capture = authorize
            config = fake.config(directory, after_action_batches=2, decision_path=str(decision))
            d = scheduler_unit_controller(config, clock=lambda: fake.now)
            self.assertEqual(d.run(), 'ACTION_ACKNOWLEDGED_REQUIRES_REVIEW')
            self.assertEqual(len(fake.frames), 2)
            self.assertEqual(fake.frames[0][0], 19996)
            self.assertEqual(fake.frames[1][0], 19998)
            self.assertLess(fake.batch + config['cleanup_batches'], fake.cap)
            click = next(i for i, c in enumerate(fake.commands) if 'cmd' in c)
            self.assertEqual(fake.commands[click-1], {'action': 'snapshot'})
            self.assertEqual(fake.commands[click+1], {'action': 'step', 'n': 1})
            self.assertEqual(fake.commands[-1], {'action': 'quit'})
            self.retain(directory)

    def test_stale_review_refuses_click(self):
        with FakeProduction() as fake, tempfile.TemporaryDirectory() as tmp:
            decision = Path(tmp)/'decision.json'
            decision.write_text(json.dumps(dict(safeStartGame=True, reviewed=True, frameSHA256='stale', batch=4097, x=1, y=2)))
            d = scheduler_unit_controller(fake.config(Path(tmp), decision_path=str(decision)), clock=lambda: fake.now)
            self.assertEqual(d.run(), 'unreviewed-or-stale-frame')
            self.assertFalse(any('cmd' in c for c in fake.commands))

    def test_time_and_capture_reserves_fail_before_input(self):
        with FakeProduction() as fake:
            d, status, _ = self.run_driver(fake, deadline_at=fake.now + 1)
            self.assertIn('exhausted-budget', status)
            self.assertFalse(any(c.get('action') == 'step' for c in fake.commands))
        with FakeProduction() as fake, tempfile.TemporaryDirectory() as tmp:
            with self.assertRaisesRegex(ctl.Refusal, 'before-after-captures'):
                scheduler_unit_controller(fake.config(Path(tmp), max_captures=1), clock=lambda: fake.now)
            self.assertEqual(fake.commands, [])

    def test_cli_config_attachment_retired(self):
        with FakeProduction(real_delay=True) as fake, tempfile.TemporaryDirectory() as tmp:
            config = fake.config(Path(tmp))
            path = Path(tmp)/'config.json'
            path.write_text(json.dumps(config))
            p = subprocess.run([sys.executable, str(TOOL), '--config', str(path)], capture_output=True, text=True, timeout=5)
            self.assertEqual(p.returncode, 1, p.stderr+p.stdout)
            self.assertIn('existing-guest-attachment-retired', p.stdout)
            self.assertEqual(fake.commands, [])
            self.assertFalse(Path(config['evidence_dir']).exists())

    def test_actual_slow_http_reaches_time_checkpoint_before_batch_checkpoint(self):
        with FakeProduction(rate=100000, latency=.02, real_delay=True) as fake, tempfile.TemporaryDirectory() as tmp:
            config = fake.config(Path(tmp), checkpoint_batches=10000, checkpoint_seconds=.03, request_timeout=.2)
            d = scheduler_unit_controller(config)
            self.assertEqual(d.run(), 'NO_REVIEWED_ACTION_NO_INPUT')
            self.assertEqual(fake.frames[0][0], 1)
            self.assertLess(fake.frames[0][0], 10001)

    def test_expired_aggregate_and_past_checkpoint_do_not_reset_allowance(self):
        with FakeProduction() as fake, tempfile.TemporaryDirectory() as tmp:
            with self.assertRaisesRegex(ctl.Refusal, 'aggregate-time'):
                scheduler_unit_controller(fake.config(Path(tmp), started_at=fake.now-110, deadline_at=fake.now), clock=lambda: fake.now)
            self.assertEqual(fake.commands, [])
        with FakeProduction() as fake:
            d, status, _ = self.run_driver(fake, started_at=fake.now-40, deadline_at=fake.now+70)
            self.assertEqual(status, 'NO_REVIEWED_ACTION_NO_INPUT')
            self.assertEqual(fake.frames[0][0], 1)

    def test_review_terminal_or_consumed_time_no_click(self):
        for fault in ('terminal', 'time'):
            with self.subTest(fault=fault), FakeProduction() as fake, tempfile.TemporaryDirectory() as tmp:
                directory = Path(tmp)
                decision = directory/'decision.json'
                config = fake.config(directory, decision_path=str(decision))
                def authorize(path, batch, raw):
                    decision.write_text(json.dumps(dict(safeStartGame=True, reviewed=True,
                        frameSHA256=hashlib.sha256(raw).hexdigest(), batch=batch, x=1, y=2)))
                    if fault == 'terminal':
                        Path(config['terminal_path']).write_text('{}')
                    else:
                        fake.now = config['deadline_at'] - .1
                fake.on_capture = authorize
                d = scheduler_unit_controller(config, clock=lambda: fake.now)
                d.run()
                self.assertTrue(d.failed)
                self.assertFalse(any('cmd' in c for c in fake.commands))

    def test_uncertain_click_never_replays_or_steps(self):
        with FakeProduction(fault='click-disconnect') as fake, tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            decision = directory/'decision.json'
            def authorize(path, batch, raw):
                decision.write_text(json.dumps(dict(safeStartGame=True, reviewed=True,
                    frameSHA256=hashlib.sha256(raw).hexdigest(), batch=batch, x=1, y=2)))
            fake.on_capture = authorize
            d = scheduler_unit_controller(fake.config(directory, decision_path=str(decision)), clock=lambda: fake.now)
            d.run()
            self.assertTrue(d.pending)
            self.assertTrue(d.failed)
            self.assertFalse(d.clicked)
            self.assertEqual(sum('cmd' in c for c in fake.commands), 1)
            self.assertIn('cmd', fake.commands[-1])

    def test_capture_credit_exact_two_and_dimensions(self):
        with FakeProduction() as fake:
            d, status, _ = self.run_driver(fake, max_captures=2)
            self.assertEqual(status, 'NO_REVIEWED_ACTION_NO_INPUT')
            self.assertEqual(d.captures, 1)
        with FakeProduction() as fake:
            fake.png = fake.png[:16] + (1).to_bytes(4, 'big') + fake.png[20:]
            d, status, _ = self.run_driver(fake)
            self.assertTrue(d.failed)
            self.assertEqual(status, 'invalid-capture')
            self.assertFalse(any('cmd' in c for c in fake.commands))


class BeforeRegression(unittest.TestCase):
    def test_original_capture_precedes_ceiling(self):
        source = (HERE/'original-operate.py').read_text()
        self.assertEqual(hashlib.sha256(source.encode()).hexdigest(), '61c62560161fbe7f5ed4850eb9f66cf84b74e76b6e0ded27495c533ae3cb8f58')
        with FakeProduction() as fake:
            result = legacy_drive(fake, source)
            self.assertEqual(result['batch'], 19969)
            self.assertEqual(result['steps'], 79)
            self.assertTrue(result['pending'])
            self.assertEqual(fake.commands[-1], {'action': 'step', 'n': 256})
            self.assertGreater(len(fake.frames), 0, f'unchanged original overshoots remaining31 before capture: {result}')


if __name__ == '__main__':
    unittest.main(defaultTest='ControllerTests', verbosity=2)
