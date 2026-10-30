"""Focused current-main caller integration; no mount/browser execution."""
import builtins
import hashlib
import pathlib
import tempfile
import unittest
from unittest import mock
import test_namespace_wire as accepted

CALLER = accepted.SOURCE.parents[1] / 'toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py'


class Integration(unittest.TestCase):
    def test_production_option_boundary(self):
        accepted.Acceptance('test_api_validation_and_propagation').test_api_validation_and_propagation()

    def probe_forwarding(self, caller):
        with tempfile.TemporaryDirectory(dir=CALLER.parents[2]) as work:
            backend = mock.Mock(return_value={})
            with mock.patch.object(caller, 'validate_receipt'), mock.patch.object(caller, 'load_backend', return_value=backend), mock.patch.object(caller, 'evaluate', return_value={}):
                caller.qualify(domain='tiny-fixture', receipt='unused', command=['/bin/true'], work=work, namespace_evidence=64, **caller.MAX_LIMITS)
            self.assertEqual(backend.call_args.kwargs.get('namespace_evidence', 0), 64)

    def test_removed_forwarding_is_rejected(self):
        caller = accepted.load(CALLER, 'integrated_caller')
        self.probe_forwarding(caller)
        source = CALLER.read_bytes()
        hook = b"            evidence['namespace_evidence'] = namespace_evidence"
        self.assertEqual(source.count(hook), 1)
        mutant = type(caller)('removed_forwarding')
        mutant.__file__ = str(CALLER)
        exec(compile(source.replace(hook, b'            pass # rejected removed forwarding'), str(CALLER), 'exec'), mutant.__dict__)
        with self.assertRaises(AssertionError):
            self.probe_forwarding(mutant)

    def test_transitive_source_identity(self):
        caller = accepted.load(CALLER, 'integrated_caller')
        real_read = pathlib.Path.read_bytes
        with mock.patch.object(builtins, 'compile', wraps=builtins.compile) as compiled:
            self.assertTrue(callable(caller.load_backend()))
        adapter = caller.ROOT / 'test/toyvm-kernel-profile-accounting-backend-oct28/supervise_accounted.py'
        self.assertTrue(any(c.args[0] == adapter.read_bytes() and c.args[1] == str(adapter) for c in compiled.call_args_list))
        for relative, expected in caller.BACKEND_PINS.items():
            path = caller.ROOT / 'test' / relative
            self.assertEqual(hashlib.sha256(real_read(path)).hexdigest(), expected)
            def changed(p, target=path):
                data = real_read(p)
                return data + b'\n# changed source\n' if p == target else data
            with self.subTest(relative=relative), mock.patch.object(pathlib.Path, 'read_bytes', changed):
                with self.assertRaisesRegex(RuntimeError, 'accepted backend identity mismatch'):
                    caller.load_backend()
        report = caller.qualify(domain='browser', receipt='unused', command=[], work='unused')
        self.assertFalse(report['accepted'])
        self.assertFalse(report['browserAllowed'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
