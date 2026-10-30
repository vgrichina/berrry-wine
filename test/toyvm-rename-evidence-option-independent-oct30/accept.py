#!/usr/bin/env python3
"""Independent offline acceptance. Run only through the assigned task ops.py.

Real caller -> verified adapter -> backend CLI/constructor/state. Process, socket,
mount and workload boundaries are synthetic; no mounted callback claim is made.
"""
import argparse
import builtins
import contextlib
import copy
import hashlib
import io
import json
import pathlib
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parents[1]
OWNED = REPO.parent
DISPATCH = pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/toyvm-rename-evidence-option-independent-accept-oct30-dispatch.json')
CANDIDATE = 'bacb4b61b85acf9aa148212a122dd024cd13295a'
CALLER = 'test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py'
ADAPTER = 'toyvm-kernel-profile-accounting-backend-oct28/supervise_accounted.py'
BACKEND = 'toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py'
SUPERVISOR = 'toyvm-transient-profile-accounting-repair-oct28/pinned-supervisor.py'
MISSING = 'independent oracle: enabled adapter omitted backend renameEvidence'
OBSERVATIONS = []


def pin(path):
    data = path.read_bytes()
    return dict(bytes=len(data), sha256=hashlib.sha256(data).hexdigest())


def load(path, name):
    m = types.ModuleType(name)
    m.__file__ = str(path)
    exec(compile(path.read_bytes(), str(path), 'exec', dont_inherit=True), m.__dict__)
    return m


def preflight():
    assert pathlib.Path.cwd().resolve() == REPO == pathlib.Path('/tmp/toyvm-rename-evidence-option-independent-accept-oct30/repo')
    dispatch = json.loads(DISPATCH.read_bytes())
    assert dispatch['candidate'] == CANDIDATE and dispatch['ownedRepo'] == str(REPO)
    for name, expected in dispatch['sourcePins'].items():
        assert pin(REPO/name) == expected, name
    for name, key in [('ops.py', 'taskSupervisorPin'), ('limit_contract.py', 'limitModulePin')]:
        assert pin(OWNED/name) == dispatch[key], name
    canonical = pathlib.Path(dispatch['canonicalReceipt'])
    assert pin(canonical) == dispatch['canonicalReceiptPin']
    receipt = json.loads(canonical.read_bytes())
    assert receipt['commit'] == receipt['publication']['remoteSHA'] == CANDIDATE
    assert receipt['publication']['remoteVerified'] and receipt['publication']['strictSSH']
    assert not receipt['publication']['mainIntegrated']
    startup = json.loads((OWNED/'prelaunch-controls.json').read_bytes())
    assert startup['PASS'] and startup['inheritedDATA'] == [-1, -1]
    assert startup['pythonChild'] == [128*1048576]*2
    assert all(x == 'REJECTED BEFORE SPAWN' for x in startup['controls'].values())
    # Source identity was verified above before importing either production module.
    caller = load(REPO/CALLER, 'preflight_caller')
    for relative, expected in caller.BACKEND_PINS.items():
        assert pin(REPO/'test'/relative)['sha256'] == expected
    return dict(candidate=CANDIDATE, dispatchPin=pin(DISPATCH),
                sourcePins=dispatch['sourcePins'], canonicalReceiptPin=pin(canonical),
                controls='unchanged ops.py + original-parent prelaunch receipt',
                node='not used', mount='not applicable: no runtime/mount argv',
                rootRefReceipt='/home/user/wine-assembly/scratch/usage-watch/toyvm-rename-evidence-option-independent-accept-oct30/root-ref-digest.json')


class Independent(unittest.TestCase):
    def setUp(self):
        self.caller = load(REPO/CALLER, 'independent_caller')
        self.backend = load(REPO/'test'/BACKEND, 'independent_backend')
        self.tmp = tempfile.TemporaryDirectory(prefix='fixture-', dir=HERE)
        self.addCleanup(self.tmp.cleanup)
        self.root = pathlib.Path(self.tmp.name)
        self.work = self.root/'work'
        self.work.mkdir()
        # Exercise real receipt validator with a deliberately synthetic, repinned
        # cancellation fixture; never describe it as a historical/runtime receipt.
        self.receipt = self.root/'cancellation.json'
        self.receipt.write_text(json.dumps(dict(
            task='toyvm-capture-cancellation-qualification-oct28',
            tests=dict(browserExecutionAccepted=False),
            runtime=dict(remainingCPU=35.353183, remainingWall=101.495550694, capturesRemaining=1))))
        self.caller.RECEIPT_SHA256 = pin(self.receipt)['sha256']
        self.args = dict(domain='tiny-fixture', receipt=self.receipt,
                         command=['/bin/true', 'comma,name'], work=self.work,
                         **self.caller.MAX_LIMITS)
        self.launches = []
        self.guest = []
        self.compiled = []

    def cli(self, value=None):
        argv = ['--domain', 'tiny-fixture', '--receipt', str(self.receipt), '--work', str(self.work)]
        for key, val in self.caller.MAX_LIMITS.items():
            argv += ['--'+key.replace('_', '-'), str(val)]
        if value is not None:
            argv += ['--rename-evidence', str(value)]
        return argv+['--', *self.args['command']]

    def boundary(self, value=None, *, cli=False, mutant=False, snapshot_bytes=None):
        c = self.caller
        if mutant:
            original = b"        server_argv.extend(['--rename-evidence',str(rename_evidence)])"
            for relative, expected in c.BACKEND_PINS.copy().items():
                data = (REPO/'test'/relative).read_bytes()
                self.assertEqual(hashlib.sha256(data).hexdigest(), expected)
                if relative == ADAPTER:
                    self.assertEqual(data.count(original), 1)
                    data = data.replace(original, b'        pass  # independent forwarding-removal mutant')
                path = self.root/'test'/relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(data)
                c.BACKEND_PINS[relative] = hashlib.sha256(data).hexdigest()
            c.ROOT = self.root
        real_loader = c.load_backend
        state = {}
        owner = self

        class Server:
            returncode = None
            def poll(self): return self.returncode
            def terminate(self): self.returncode = -15
            def communicate(self, **kw): return b'', b''

        def launch(argv, **kw):
            self.launches.append(list(argv))
            self.assertEqual(argv[:3], [sys.executable, '-B', str(c.ROOT/'test'/BACKEND)])
            self.assertEqual(argv[3:8], [str(self.work/'domain'), str(self.work/'status.sock'), '1048576', '1048576', '1048576'])
            def serve(b, status):
                # Constructor and record retention are production code, but the
                # callback invocations here are synthetic, not FUSE dispatch.
                for n in range(80):
                    b.record_rename_callback(12 if n % 2 else 45, n+101, 1, 0)
                state.update(b.state())
                pathlib.Path(status).touch()
            with patch.object(self.backend.Backend, 'mount'), patch.object(self.backend.Backend, 'serve', serve):
                self.backend.main(argv[3:])
            return Server()

        class Socket:
            def __enter__(self): return self
            def __exit__(self, *exc): pass
            def settimeout(self, value): owner.assertEqual(value, .5)
            def connect(self, path):
                owner.assertEqual(path, str(owner.work/'status.sock'))
                self.data = json.dumps(state).encode()
                if snapshot_bytes is not None:
                    owner.assertLessEqual(len(self.data), snapshot_bytes)
                    self.data += b' '*(snapshot_bytes-len(self.data))
            def recv(self, n):
                owner.assertEqual(n, 8192)
                part, self.data = self.data[:n], self.data[n:]
                return part

        def supervise(argv, **limits):
            self.guest.append((argv, limits))
            self.assertEqual(argv, [sys.executable, '-B', str(c.ROOT/'test/toyvm-kernel-profile-accounting-backend-oct28/confine.py'), str(self.work/'domain'), *self.args['command']])
            self.assertNotIn('rename_evidence', limits)
            self.assertIsNone(limits['check']())
            return dict(exit=0, output=b'offline', cleanupComplete=True, stopReason=None,
                        cpuSeconds=0, wallSeconds=0, peakRSS=4096)

        def checked_compile(data, filename, mode, **kwargs):
            self.assertEqual(hashlib.sha256(data).hexdigest(), c.BACKEND_PINS[SUPERVISOR])
            self.compiled.append(hashlib.sha256(data).hexdigest())
            return builtins.compile(data, filename, mode, **kwargs)

        def controlled_exec(code, namespace):
            builtins.exec(code, namespace)
            namespace['supervise'] = supervise

        def loader():
            # Execute the real loader on every call; only the OS boundaries of
            # its actual returned adapter are substituted after verified import.
            adapter = real_loader()
            self.assertEqual(adapter.__code__.co_filename, str(c.ROOT/'test'/ADAPTER))
            adapter.__globals__.update(
                subprocess=types.SimpleNamespace(Popen=launch, PIPE=-1, TimeoutExpired=TimeoutError,
                    run=lambda *a, **k: self.fail('unexpected unmount/process')),
                socket=types.SimpleNamespace(AF_UNIX=1, socket=lambda *a: Socket()),
                compile=checked_compile, exec=controlled_exec)
            return adapter

        with patch.object(c, 'load_backend', loader):
            if cli:
                out = io.StringIO()
                with contextlib.redirect_stdout(out):
                    rc = c.main(self.cli(value))
                result = json.loads(out.getvalue())
                self.assertEqual(rc, 0 if result['accepted'] else 1)
            else:
                result = c.qualify(**self.args, **({} if value is None else dict(rename_evidence=value)))
        self.assertEqual(len(self.launches), 1)
        self.assertEqual(len(self.guest), 1)
        self.assertEqual(self.compiled, [c.BACKEND_PINS[SUPERVISOR]])
        self.assertFalse(result['browserAllowed'])
        self.assertEqual(result['browserAllowanceRemaining'], c.BROWSER_ALLOWANCE)
        if snapshot_bytes and snapshot_bytes > 8192:
            self.assertFalse(result['accepted'])
            self.assertIn('filesystem backend receipt too large', result['error'])
            self.assertTrue(result['filesystemCleanupComplete'])
            self.assertFalse(result['cleanupComplete'])
        else:
            self.assertTrue(result['accepted'], result)
            self.assertEqual(result['backendReceipt']['filesystem'], state)
            self.assertEqual(result['backendReceipt']['filesystemCleanup']['serverExit'], -15)
            if value:
                self.assertIn('renameEvidence', state, MISSING)
                evidence = state['renameEvidence']
                self.assertEqual(evidence['limit'], value)
                self.assertEqual(evidence['callbackCount'], 80)
                self.assertFalse(evidence['countSaturated'])
                self.assertEqual(len(evidence['records']), value)
                self.assertEqual([r['callbackCount'] for r in evidence['records']], list(range(81-value, 81)))
                self.assertEqual(self.launches[0][8:], ['--rename-evidence', str(value)])
            else:
                self.assertNotIn('renameEvidence', state)
                self.assertEqual(self.launches[0][8:], [])
        OBSERVATIONS.append(dict(value=value, cli=cli, snapshotBytes=snapshot_bytes,
                                 accepted=result['accepted'], syntheticCallbacks=80,
                                 actualAdapter=True, supervisorPin=self.compiled[0]))
        return result

    def test_00_production_boundary(self):
        self.boundary(3)

    def test_defaults_and_bounds(self):
        # Separate clean fixtures per call, since the real caller requires empty work.
        for cli in [False, True]:
            for value in [None, 0, 1, 32, 64]:
                with self.subTest(cli=cli, value=value):
                    case = Independent('test_00_production_boundary')
                    case.setUp()
                    try: case.boundary(value, cli=cli)
                    finally: case.doCleanups()

    def test_invalid_api_before_load_and_adapter_spawn(self):
        adapter = self.caller.load_backend()
        values = [True, False, -1, 65, 1.0, 0.0, float('nan'), float('inf'), -float('inf'), '1', None, [], {}, 10**1000]
        for value in values:
            with self.subTest(value=repr(value)[:30]):
                with patch.object(self.caller, 'load_backend') as loader, patch.object(self.caller, 'validate_receipt') as receipt:
                    r = self.caller.qualify(**self.args, rename_evidence=value)
                    self.assertFalse(r['accepted'])
                    self.assertIn('rename evidence limit must be an integer from 0 to 64', r['error'])
                    loader.assert_not_called()
                    receipt.assert_not_called()
                with patch.dict(adapter.__globals__, subprocess=types.SimpleNamespace(Popen=lambda *a, **kw: self.fail('invalid input spawned'))):
                    with self.assertRaisesRegex(ValueError, '^rename evidence limit must be an integer from 0 to 64$'):
                        adapter(self.args['command'], self.work, rename_evidence=value)

    def test_malformed_cli_before_qualify(self):
        for value in ['true', 'False', '1.0', 'nan', 'inf', '-inf', '-1', '65', '', '1,2', '0x10', '1e0']:
            with self.subTest(value=value), patch.object(self.caller, 'qualify') as qualify:
                with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit) as error:
                    self.caller.main(self.cli(value))
                self.assertEqual(error.exception.code, 2)
                qualify.assert_not_called()

    def test_mutant_reaches_adapter_then_missing_evidence(self):
        with self.assertRaisesRegex(AssertionError, MISSING):
            self.boundary(4, mutant=True)
        self.assertEqual(len(self.launches), 1)
        self.assertEqual(len(self.guest), 1)
        self.assertEqual(len(self.compiled), 1)
        self.assertEqual(self.launches[0][8:], [])
        OBSERVATIONS.append(dict(mutant='repinned executable forwarding-removal',
                                 reason=MISSING, backendLaunches=1, supervisorCalls=1,
                                 unchangedBackend=pin(self.root/'test'/BACKEND) == pin(REPO/'test'/BACKEND)))

    def test_snapshot_exact_8192(self):
        self.boundary(64, snapshot_bytes=8192)

    def test_snapshot_8193_rejected(self):
        self.boundary(64, snapshot_bytes=8193)

    def test_receipt_validation_not_bypassed(self):
        # A correct fixture passes; changing bytes after pinning must stop before load.
        self.caller.validate_receipt(self.receipt)
        self.receipt.write_text('{}')
        with patch.object(self.caller, 'load_backend') as loader:
            result = self.caller.qualify(**self.args, rename_evidence=1)
        self.assertIn('cancellation receipt identity mismatch', result['error'])
        self.assertFalse(result['accepted'])
        loader.assert_not_called()

    def test_pin_denials_before_compile_or_spawn(self):
        c = self.caller
        c.ROOT = self.root
        for relative in c.BACKEND_PINS:
            dest = self.root/'test'/relative
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes((REPO/'test'/relative).read_bytes())
        for relative in c.BACKEND_PINS:
            with self.subTest(relative=relative):
                dest = self.root/'test'/relative
                original = dest.read_bytes()
                dest.write_bytes(original+b'\n# independent tamper control\n')
                with patch.object(c, 'compile', create=True) as compiler:
                    with self.assertRaisesRegex(RuntimeError, '^accepted backend identity mismatch: '):
                        c.load_backend()
                    compiler.assert_not_called()
                dest.write_bytes(original)
        adapter = c.load_backend()
        supervisor = self.root/'test'/SUPERVISOR
        supervisor.write_bytes(supervisor.read_bytes()+b'\n# tamper\n')
        with patch.dict(adapter.__globals__, subprocess=types.SimpleNamespace(Popen=lambda *a, **kw: self.fail('unverified supervisor spawned'))):
            with self.assertRaisesRegex(RuntimeError, '^supervisor identity mismatch$'):
                adapter(self.args['command'], self.work, rename_evidence=1)

    def test_evidence_does_not_relax_authoritative_gates(self):
        good = dict(filesystem=dict(live=0, peak=0, written=0, failure=None, openHandles=0,
                    renameEvidence=dict(limit=1, callbackCount=1, countSaturated=False, records=[])),
                    cleanupComplete=True, filesystemCleanup=dict(remainingMounts=[], unmountExit=None, serverExit=-15),
                    stopReason=None, exit=0, output=b'fixture', cpuSeconds=0, wallSeconds=0, peakRSS=4096)
        self.assertTrue(self.caller.evaluate(good, self.caller.MAX_LIMITS)['accepted'])
        variants = [('cleanupComplete', False), ('exit', True), ('exit', 1), ('stopReason', 'quota'),
                    ('output', b'x'*65537), ('cpuSeconds', float('nan')), ('wallSeconds', float('inf')),
                    ('peakRSS', 128*1048576+1), ('filesystem', dict(good['filesystem'], live=1048577)),
                    ('filesystem', dict(good['filesystem'], openHandles=1)),
                    ('filesystemCleanup', dict(good['filesystemCleanup'], remainingMounts=['mounted']))]
        for key, value in variants:
            data = copy.deepcopy(good)
            data[key] = value
            before = copy.deepcopy(data)
            report = self.caller.evaluate(data, self.caller.MAX_LIMITS)
            self.assertFalse(report['accepted'], key)
            # Nonfinite float equality is unsuitable for comparing whole objects.
            self.assertEqual(report['backendReceipt']['filesystem'], data['filesystem'])
            self.assertEqual(data['filesystem'], before['filesystem'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('phase', choices=['preflight', 'boundary', 'remaining', 'pins'])
    args = parser.parse_args()
    report = preflight()
    if args.phase != 'preflight':
        if args.phase == 'boundary':
            names = ['test_00_production_boundary']
        elif args.phase == 'pins':
            names = ['test_pin_denials_before_compile_or_spawn']
        else:
            names = [n for n in unittest.defaultTestLoader.getTestCaseNames(Independent)
                     if n not in ('test_00_production_boundary', 'test_pin_denials_before_compile_or_spawn')]
        result = unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite(Independent(n) for n in names))
        report.update(tests=result.testsRun, success=result.wasSuccessful(),
                      failures=len(result.failures), errors=len(result.errors), observations=OBSERVATIONS)
    else:
        report['success'] = True
    (HERE/(args.phase+'-report.json')).write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(dict(phase=args.phase, success=report['success'], tests=report.get('tests', 0))))
    return 0 if report['success'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
