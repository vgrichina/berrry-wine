#!/usr/bin/env python3
"""Offline production caller/adapter boundary fixtures. No mount or workload."""
import builtins
import contextlib
import copy
import hashlib
import io
import json
import pathlib
import tempfile
import types
import unittest
from unittest.mock import patch

REPO = pathlib.Path(__file__).resolve().parents[2]
CALLER = REPO/'test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py'
ADAPTER = 'toyvm-kernel-profile-accounting-backend-oct28/supervise_accounted.py'
BACKEND = REPO/'test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py'
FORWARD = "        server_argv.extend(['--rename-evidence',str(rename_evidence)])"
MISSING = 'backend RENAME evidence missing after enabled forwarding'


def load(path, name):
    module = types.ModuleType(name)
    module.__file__ = str(path)
    exec(compile(path.read_bytes(), str(path), 'exec'), module.__dict__)
    return module


class Boundary(unittest.TestCase):
    def setUp(self):
        self.caller = load(CALLER, 'production_caller')
        self.backend = load(BACKEND, 'production_backend')
        self.temp = tempfile.TemporaryDirectory(prefix='.rename-option-', dir=REPO)
        self.addCleanup(self.temp.cleanup)
        self.root = pathlib.Path(self.temp.name)
        self.work = self.root/'work'
        self.work.mkdir()
        self.args = dict(domain='tiny-fixture', receipt=self.root/'receipt.json',
                         command=['/bin/true'], work=self.work, **self.caller.MAX_LIMITS)
        self.launches = []
        self.supervisor_calls = []
        self.verified_supervisor = []

    def execute_boundary(self, limit=0, *, mutant=False, cli=False, explicit=True):
        caller = self.caller
        if mutant:
            # Mutant is executable source, not a mock: repin only this controlled
            # fixture so rejection must come from forwarding behavior, not identity.
            for relative, expected in caller.BACKEND_PINS.items():
                data = (REPO/'test'/relative).read_bytes()
                self.assertEqual(hashlib.sha256(data).hexdigest(), expected)
                if relative == ADAPTER:
                    source = data.decode()
                    self.assertEqual(source.count(FORWARD), 1)
                    data = source.replace(FORWARD, '        pass  # forwarding-removal mutant').encode()
                dest = self.root/'test'/relative
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(data)
                caller.BACKEND_PINS[relative] = hashlib.sha256(data).hexdigest()
            caller.ROOT = self.root
        adapter = caller.load_backend()
        self.assertEqual(adapter.__code__.co_filename, str(caller.ROOT/'test'/ADAPTER))
        state = {}
        owner = self

        class Server:
            returncode = None
            def poll(self): return self.returncode
            def terminate(self): self.returncode = -15
            def communicate(self, **kw): return b'', b''

        def popen(argv, **kw):
            self.launches.append(list(argv))
            self.assertEqual(argv[:2], [adapter.__globals__['sys'].executable, '-B'])
            self.assertEqual(pathlib.Path(argv[2]).name, 'fuse_backend.py')
            def serve(backend, status):
                # Synthetic callback records establish bound/receipt transport;
                # actual dispatch loop is independently covered by wire tests.
                for unique in range(70):
                    backend.record_rename_callback(12, unique+1, 1, 0)
                state.update(backend.state())
                pathlib.Path(status).touch()
            with patch.object(self.backend.Backend, 'mount'), patch.object(self.backend.Backend, 'serve', serve):
                self.backend.main(argv[3:])  # actual backend CLI parser and constructor
            return Server()

        def supervise(argv, **limits):
            self.supervisor_calls.append((argv, limits))
            self.assertIsNone(limits['check']())
            return dict(cleanupComplete=True, stopReason=None, cpuSeconds=0,
                        wallSeconds=0, peakRSS=4096, exit=0, output=b'fixture')

        def execute_supervisor(code, namespace):
            # Execute verified production bytes, then replace only its workload
            # boundary. Browser __main__ and real child execution never run.
            builtins.exec(code, namespace)
            namespace['supervise'] = supervise

        def compile_supervisor(source, filename, mode, **kw):
            self.verified_supervisor.append(hashlib.sha256(source).hexdigest())
            return builtins.compile(source, filename, mode, **kw)

        class Socket:
            def __enter__(self): return self
            def __exit__(self, *a): pass
            def settimeout(self, value): pass
            def connect(self, path): self.data = json.dumps(state).encode()
            def recv(self, count):
                data, self.data = self.data[:count], self.data[count:]
                return data

        fake_subprocess = types.SimpleNamespace(Popen=popen, PIPE=-1,
            TimeoutExpired=TimeoutError, run=lambda *a, **k: owner.fail('unexpected unmount'))
        fake_socket = types.SimpleNamespace(socket=lambda *a: Socket(), AF_UNIX=1)
        with patch.dict(adapter.__globals__, subprocess=fake_subprocess, socket=fake_socket,
                        exec=execute_supervisor, compile=compile_supervisor), \
                patch.object(caller, 'load_backend', return_value=adapter), \
                patch.object(caller, 'validate_receipt'):
            if cli:
                argv = ['--domain', 'tiny-fixture', '--receipt', str(self.args['receipt']),
                        '--work', str(self.work)]
                for key, value in caller.MAX_LIMITS.items():
                    argv += ['--'+key.replace('_', '-'), str(value)]
                if explicit: argv += ['--rename-evidence', str(limit)]
                argv += ['--', '/bin/true']
                out = io.StringIO()
                with contextlib.redirect_stdout(out): self.assertEqual(caller.main(argv), 0)
                report = json.loads(out.getvalue())
            else:
                report = caller.qualify(**self.args, **({'rename_evidence': limit} if explicit else {}))
        self.assertTrue(report['accepted'], report)
        self.assertFalse(report['browserAllowed'])
        self.assertEqual(report['browserAllowanceRemaining'], caller.BROWSER_ALLOWANCE)
        self.assertEqual(self.verified_supervisor, [adapter.__globals__['PIN']])
        self.assertEqual(len(self.launches), 1)
        self.assertEqual(len(self.supervisor_calls), 1)
        launch = self.launches[0]
        self.assertEqual(launch[3:8], [str(self.work/'domain'), str(self.work/'status.sock'),
                                      '1048576', '1048576', '1048576'])
        self.assertNotIn('rename_evidence', self.supervisor_calls[0][1])
        fs = report['backendReceipt']['filesystem']
        self.assertEqual(fs, state)
        self.assertEqual(report['backendReceipt']['filesystemCleanup']['serverExit'], -15)
        if limit:
            self.assertIn('renameEvidence', fs, MISSING)
            evidence = fs['renameEvidence']
            self.assertEqual(evidence['limit'], limit)
            self.assertEqual(evidence['callbackCount'], 70)
            self.assertEqual(len(evidence['records']), limit)
            self.assertEqual(evidence['records'][0]['callbackCount'], 71-limit)
            self.assertEqual(evidence['records'][-1]['callbackCount'], 70)
            self.assertEqual(launch[8:], ['--rename-evidence', str(limit)])
        else:
            self.assertNotIn('renameEvidence', fs)
            self.assertEqual(launch[8:], [])
        return report

    def test_01_exact_production_enabled_boundary(self):
        self.execute_boundary(3)

    def test_default_disabled_boundary(self):
        self.execute_boundary(explicit=False)

    def test_explicit_zero_disabled_boundary(self):
        self.execute_boundary(0)

    def test_cli_enabled_upper_bound(self):
        self.execute_boundary(64, cli=True)

    def test_cli_default(self):
        self.execute_boundary(cli=True, explicit=False)

    def test_forwarding_removal_mutant_rejected(self):
        with self.assertRaisesRegex(AssertionError, MISSING):
            self.execute_boundary(3, mutant=True)
        self.assertEqual(len(self.launches), 1)
        self.assertEqual(len(self.supervisor_calls), 1)

    def test_invalid_api_inputs_before_load_or_spawn(self):
        for value in [True, False, -1, 65, 1.0, float('nan'), float('inf'), '2', None, [], 10**1000]:
            with self.subTest(value=repr(value)[:40]):
                with patch.object(self.caller, 'load_backend') as load_backend:
                    report = self.caller.qualify(**self.args, rename_evidence=value)
                    self.assertFalse(report['accepted'])
                    self.assertIn('rename evidence limit must be an integer from 0 to 64', report['error'])
                    load_backend.assert_not_called()
                adapter = self.caller.load_backend()
                with patch.dict(adapter.__globals__, subprocess=types.SimpleNamespace(Popen=lambda *a, **k: self.fail('spawned'))):
                    with self.assertRaisesRegex(ValueError, 'rename evidence limit must be an integer from 0 to 64'):
                        adapter(['/bin/true'], self.work, rename_evidence=value)

    def test_invalid_cli_before_qualify(self):
        for value in ['true', 'False', 'nan', 'inf', '-1', '65', '1.0']:
            with self.subTest(value=value), patch.object(self.caller, 'qualify') as qualify:
                with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit) as exit:
                    argv = ['--domain', 'tiny-fixture', '--receipt', 'unused', '--work', str(self.work),
                            '--rename-evidence', value]
                    for key, maximum in self.caller.MAX_LIMITS.items():
                        argv += ['--'+key.replace('_', '-'), str(maximum)]
                    self.caller.main(argv)
                self.assertEqual(exit.exception.code, 2)
                qualify.assert_not_called()

    def test_receipt_retained_without_weakening_acceptance(self):
        evidence = dict(limit=1, callbackCount=1, countSaturated=False,
                        records=[dict(opcode=12, unique=1, inode=1, errno=0, callbackCount=1)])
        result = dict(filesystem=dict(live=0, peak=0, written=0, failure=None,
                                     openHandles=0, renameEvidence=evidence),
                      cleanupComplete=False, filesystemCleanup=dict(remainingMounts=[], unmountExit=None, serverExit=-15),
                      stopReason=None, cpuSeconds=0, wallSeconds=0, peakRSS=4096, exit=0, output=b'fixture')
        before = copy.deepcopy(result)
        report = self.caller.evaluate(result, self.caller.MAX_LIMITS)
        self.assertFalse(report['accepted'])
        self.assertEqual(report['backendReceipt']['filesystem']['renameEvidence'], evidence)
        self.assertEqual(result, before)


if __name__ == '__main__':
    unittest.main(verbosity=2)
