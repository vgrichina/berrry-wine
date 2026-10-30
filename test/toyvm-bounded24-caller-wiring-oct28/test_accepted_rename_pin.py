#!/usr/bin/env python3
"""Offline caller-pin regression. Never starts FUSE, a workload, or a browser."""
import builtins
import copy
import hashlib
import importlib.util
from importlib._bootstrap_external import _code_to_timestamp_pyc
import pathlib
import tempfile
import types
import unittest
from unittest.mock import patch

REPO = pathlib.Path(__file__).resolve().parents[2]
CALLER = REPO / 'test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py'
ADAPTER = 'toyvm-kernel-profile-accounting-backend-oct28/supervise_accounted.py'
PINS = {
    ADAPTER: 'e7aaa8cdbbd0871918918de090b57585c8ed0ba21e7510583fabc745359c124e',
    'toyvm-kernel-profile-accounting-backend-oct28/confine.py': '0b10df6497f359f9684f1dbb0752eba3816d0e6568c492c39f62ba3a3f2076d8',
    'toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py': '13bf42f071f5eb84542286f35faf2dc814aaf63bf1bcfe7bb306e3e2f7f4f963',
    'toyvm-transient-profile-accounting-repair-oct28/pinned-supervisor.py': '9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85',
}


def caller():
    module = types.ModuleType('caller_regression')
    module.__file__ = str(CALLER)
    exec(compile(CALLER.read_bytes(), str(CALLER), 'exec'), module.__dict__)
    return module


def good_result():
    return dict(filesystem=dict(live=4096, peak=4096, written=0,
                                failure=None, openHandles=0),
                cleanupComplete=True,
                filesystemCleanup=dict(remainingMounts=[], unmountExit=None, serverExit=-15),
                stopReason=None, cpuSeconds=0, wallSeconds=0, peakRSS=4096,
                exit=0, output=b'ok')


class CallerPins(unittest.TestCase):
    def setUp(self):
        self.module = caller()
        # Fixtures remain inside this task's repo, including temporary cache files.
        self.temp = tempfile.TemporaryDirectory(prefix='.caller-pin-fixture-', dir=REPO)
        self.addCleanup(self.temp.cleanup)
        self.root = pathlib.Path(self.temp.name)
        for relative, expected in PINS.items():
            source = (REPO / 'test' / relative).read_bytes()
            self.assertEqual(hashlib.sha256(source).hexdigest(), expected)
            dest = self.root / 'test' / relative
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(source)

    def test_exact_production_pair(self):
        self.assertEqual(self.module.BACKEND_PINS, PINS)
        function = self.module.load_backend()
        self.assertEqual(function.__name__, 'supervise_accounted')
        self.assertEqual(function.__code__.co_filename, str(REPO / 'test' / ADAPTER))

    def test_each_pin_rejects_before_execution_and_restores(self):
        self.module.ROOT = self.root
        for relative in PINS:
            with self.subTest(source=relative):
                path = self.root / 'test' / relative
                source = path.read_bytes()
                path.write_bytes(source + b'\n# altered pinned source\n')
                # A missed pin must fail the test even if a later import fails.
                with patch.object(self.module, 'compile', create=True,
                                  side_effect=AssertionError('unverified execution')) as compiled:
                    with self.assertRaisesRegex(RuntimeError, '^accepted backend identity mismatch: '):
                        try:
                            self.module.load_backend()
                        except RuntimeError as error:
                            self.assertEqual(str(error), 'accepted backend identity mismatch: ' + relative)
                            raise
                    compiled.assert_not_called()
                path.write_bytes(source)
                self.assertTrue(callable(self.module.load_backend()))
        # Distinguish pin enforcement from rejecting any changed file.
        (self.root / 'test' / 'unrelated.py').write_text('raise AssertionError("decoy")\n')
        self.assertTrue(callable(self.module.load_backend()))

    def test_verified_bytes_ignore_valid_poisoned_cache(self):
        self.module.ROOT = self.root
        path = self.root / 'test' / ADAPTER
        source = path.read_bytes()
        stat = path.stat()
        cache = pathlib.Path(importlib.util.cache_from_source(str(path)))
        cache.parent.mkdir()
        poison = compile('raise AssertionError("POISONED CACHE EXECUTED")', str(path), 'exec')
        cache.write_bytes(_code_to_timestamp_pyc(poison, int(stat.st_mtime), len(source)))
        # Show that this cache is valid and executable by an ordinary source loader.
        spec = importlib.util.spec_from_file_location('poison_control', path)
        ordinary = importlib.util.module_from_spec(spec)
        with self.assertRaisesRegex(AssertionError, 'POISONED CACHE EXECUTED'):
            spec.loader.exec_module(ordinary)
        compiled_sources = []

        def checked_compile(data, filename, mode, **kwargs):
            compiled_sources.append(data)
            # Simulate replacement after validation: caller must execute its buffer.
            path.write_bytes(b'raise AssertionError("SECOND READ EXECUTED")\n')
            return builtins.compile(data, filename, mode, **kwargs)

        with patch.object(self.module, 'compile', checked_compile, create=True):
            function = self.module.load_backend()
        self.assertEqual(compiled_sources, [source])
        self.assertEqual(function.__name__, 'supervise_accounted')
        self.assertEqual(function.__code__.co_filename, str(path))

    def test_backend_evidence_stays_disabled_by_default(self):
        path = REPO / 'test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py'
        source = path.read_bytes()
        self.assertEqual(hashlib.sha256(source).hexdigest(), PINS[str(path.relative_to(REPO / 'test'))])
        module = types.ModuleType('backend_default_only')
        module.__file__ = str(path)
        exec(compile(source, str(path), 'exec'), module.__dict__)
        backend = module.Backend(self.root)
        self.assertEqual(backend.rename_evidence_limit, 0)
        self.assertFalse(hasattr(backend, 'rename_evidence'))
        self.assertFalse(hasattr(backend, 'rename_callbacks'))
        self.assertNotIn('renameEvidence', backend.state())


class CallerGates(unittest.TestCase):
    def setUp(self):
        self.module = caller()
        self.temp = tempfile.TemporaryDirectory(prefix='.caller-gates-', dir=REPO)
        self.addCleanup(self.temp.cleanup)
        self.work = pathlib.Path(self.temp.name) / 'work'
        self.work.mkdir()
        self.receipt = pathlib.Path(self.temp.name) / 'receipt.json'
        self.receipt.write_text('{}')
        self.args = dict(domain='tiny-fixture', receipt=self.receipt,
                         command=['/bin/true'], work=self.work, **self.module.MAX_LIMITS)

    def test_real_browser_and_receipt_gates_precede_backend(self):
        for domain, expected in [('browser', 'unqualified browser/domain'),
                                 ('tiny-fixture', 'cancellation receipt identity mismatch')]:
            with self.subTest(domain=domain), patch.object(self.module, 'load_backend') as load:
                report = self.module.qualify(**dict(self.args, domain=domain))
                self.assertFalse(report['accepted'])
                self.assertFalse(report['browserAllowed'])
                self.assertFalse(report['cleanupComplete'])
                self.assertIn(expected, report['error'])
                load.assert_not_called()

    def test_resource_and_work_gates_precede_backend(self):
        # Only the historical receipt is stubbed; these isolate later caller gates.
        cases = []
        for key, maximum in self.module.MAX_LIMITS.items():
            cases.append((dict(self.args, **{key: maximum + 1}), 'unsupported quota/resource limit: ' + key))
        missing = dict(self.args)
        del missing['rss_limit']
        cases += [(missing, 'all quota/resource limits must be explicit'),
                  (dict(self.args, command=[]), 'nonempty argv command required'),
                  (dict(self.args, file_limit=8192, live_limit=4096), 'file quota exceeds live quota')]
        for args, expected in cases:
            with self.subTest(expected=expected), patch.object(self.module, 'validate_receipt'), patch.object(self.module, 'load_backend') as load:
                report = self.module.qualify(**args)
                self.assertFalse(report['accepted'])
                self.assertIn(expected, report['error'])
                load.assert_not_called()
        (self.work / 'occupied').touch()
        with patch.object(self.module, 'validate_receipt'), patch.object(self.module, 'load_backend') as load:
            report = self.module.qualify(**self.args)
            self.assertIn('fresh empty owned work directory required', report['error'])
            load.assert_not_called()

    def test_dispatch_does_not_opt_in_to_evidence(self):
        # Synthetic receipt/result proves argument forwarding only, not live acceptance.
        with patch.object(self.module, 'validate_receipt'), patch.object(self.module, 'load_backend') as load:
            load.return_value.return_value = good_result()
            report = self.module.qualify(**self.args)
        self.assertTrue(report['accepted'])
        self.assertFalse(report['browserAllowed'])
        load.return_value.assert_called_once_with(
            ['/bin/true'], self.work, backend='synchronous-fuse', **self.module.MAX_LIMITS)

    def test_authoritative_result_gates(self):
        good = good_result()
        self.assertTrue(self.module.evaluate(good, self.module.MAX_LIMITS)['accepted'])
        mutations = [
            ('filesystem', dict(good['filesystem'], written=1048577)),
            ('filesystem', dict(good['filesystem'], openHandles=1)),
            ('filesystem', dict(good['filesystem'], failure='quota')),
            ('cleanupComplete', False),
            ('filesystemCleanup', dict(good['filesystemCleanup'], remainingMounts=['mount'])),
            ('stopReason', 'limit'), ('exit', 1), ('cpuSeconds', 91),
            ('wallSeconds', float('nan')), ('peakRSS', 128*1024**2 + 1),
            ('output', b'x' * 65537),
        ]
        for key, value in mutations:
            with self.subTest(key=key, value_type=type(value).__name__):
                result = copy.deepcopy(good)
                result[key] = value
                self.assertFalse(self.module.evaluate(result, self.module.MAX_LIMITS)['accepted'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
