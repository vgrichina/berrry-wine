#!/usr/bin/env python3
"""Independent candidate acceptance: parser rejection must not invent dispatch.

Only local production-wire behavior is covered. No mount or kernel claim.
"""
import errno
import types
import unittest
import test_namespace_wire as retained
import test_rename_wire as transport

production = transport.production
SOURCE = transport.SOURCE


class IndependentAcceptance(unittest.TestCase):
    def reject_before_dispatch(self, module=production):
        # A structurally complete header advertises the wrong packet length.
        # Credentials/name are private; opcode/identity alone cannot prove dispatch.
        for opcode, identity in ((10, 0), (11, (1 << 64) - 1)):
            with self.subTest(opcode=opcode, identity=identity):
                backend = module.Backend('/unused-independent', 1048576, 65536,
                                         16384, namespace_evidence_limit=64)
                w = transport.Wire(backend)  # Real INIT reaches serve first.
                try:
                    before = backend.state()
                    packet = module.pack('2I2Q4I', 999, opcode, identity, 1,
                                         987654, 876543, 765432, 0) + b'private-undispatched\0'
                    w.client.sendall(packet)
                    w.thread.join(3)
                    self.assertFalse(w.thread.is_alive())
                    self.assertEqual(len(w.errors), 1)
                    self.assertIsInstance(w.errors[0], RuntimeError)
                    self.assertEqual(str(w.errors[0]), 'FUSE request truncated')
                    self.assertEqual(backend.state(), before)
                    self.assertEqual(backend.state()['namespaceEvidence']['callbackCount'], 0)
                    self.assertEqual(backend.state()['namespaceEvidence']['records'], [])
                finally:
                    w.errors.clear()  # Expected parser rejection already asserted.
                    w.close()

    def test_parser_rejection_has_no_callback(self):
        self.reject_before_dispatch()

    def test_rejects_fabricated_undispatched_callback(self):
        source = SOURCE.read_text()
        old = "                        if length!=len(raw):raise RuntimeError('FUSE request truncated')"
        new = "                        self.record_namespace_callback(op,unique,ino,0)\n" + old
        self.assertEqual(source.count(old), 1)
        mutated = types.ModuleType('premature_namespace_recording')
        exec(compile(source.replace(old, new, 1), str(SOURCE), 'exec'), mutated.__dict__)
        # Run the unchanged oracle against the mutant; both adverse identities
        # are covered above. Capture the first mutant rejection with failfast.
        class Probe(IndependentAcceptance):
            def runTest(probe):
                probe.reject_before_dispatch(module=mutated)
        result = unittest.TestResult()
        result.failfast = True
        Probe().run(result)
        self.assertTrue(result.failures, 'oracle accepted fabricated callback')
        self.assertFalse(result.errors, repr(result.errors))

    def test_status_snapshot_cannot_mutate_callback_records(self):
        # The public state API must return detached numeric records.
        with retained.wire(1) as w:
            self.assertEqual(w.call(10, 1, b'private-missing\0')[0], -errno.ENOENT)
            original = w.backend.state()['namespaceEvidence']
            snapshot = w.backend.state()
            snapshot['namespaceEvidence']['records'][0]['errno'] = 0
            snapshot['namespaceEvidence']['records'].clear()
            self.assertEqual(w.state()['namespaceEvidence'], original)
            self.assertEqual(w.call(3)[0], 0)
            self.assertEqual(w.state()['namespaceEvidence'], original)


if __name__ == '__main__':
    unittest.main(verbosity=2)
