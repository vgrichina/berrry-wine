#!/usr/bin/env python3
"""Independent source-only acceptance of numeric RENAME callback evidence.

Run from repository root. No mounts, guests, browser, or direct handle calls.
The pinned existing Wire supplies AF_UNIX SOCK_SEQPACKET and status transport;
all assertions and additional cases below belong to this independent review.
"""
import contextlib
import errno
import hashlib
import importlib.util
import json
import pathlib
import types
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py'
FIXTURE = SOURCE.with_name('test_rename_wire.py')
PINS = {SOURCE: '13bf42f071f5eb84542286f35faf2dc814aaf63bf1bcfe7bb306e3e2f7f4f963',
        FIXTURE: '1a43a9305f1b3d92957ef03c34caec6eb0990dc03f2f23c0d20f0ca53b9fa751'}
for path, digest in PINS.items():
    assert hashlib.sha256(path.read_bytes()).hexdigest() == digest, str(path)
spec = importlib.util.spec_from_file_location('independent_wire_transport', FIXTURE)
transport = importlib.util.module_from_spec(spec)
spec.loader.exec_module(transport)
production = transport.production
MAX = (1 << 64) - 1


class Acceptance(unittest.TestCase):
    @contextlib.contextmanager
    def wire(self, limit=0, module=production):
        b = module.Backend('/unused-independent', 1048576, 65536, 16384,
                           rename_evidence_limit=limit)
        w = transport.Wire(b)
        try:
            yield w
        finally:
            w.close()

    def assert_record(self, w, op, parent, error, count):
        # The reply has already verified length/unique; status must reflect it
        # immediately, without sleeps or another FUSE request to flush a hook.
        evidence = w.state()['renameEvidence']
        self.assertEqual(evidence['callbackCount'], count, 'serve evidence hook missing')
        self.assertEqual(evidence['records'][-1],
                         dict(opcode=op, unique=w.unique, inode=parent,
                              errno=-error, callbackCount=count))

    def boundary(self, module=production):
        with self.wire(4, module) as w:
            a = w.mkdir(b'private-parent')
            b = w.mkdir(b'private-target')
            child = w.create(b'private-source-\xff', a)
            # Nonmonotonic and repeated request IDs are opaque uint64 identities.
            for count, op, unique, src, dst, old, new, expected in [
                (1, 45, MAX, a, b, b'private-source-\xff', b'private-moved', 0),
                (2, 12, 9, b, a, b'private-moved', b'private-back', 0),
                (3, 45, 9, a, b, b'private-absent', b'private-x', -errno.ENOENT),
                (4, 12, 0, a, child, b'private-back', b'private-x', -errno.ENOTDIR)]:
                w.unique = unique - 1
                self.assertEqual(w.rename(old, new, op=op, parent=src, newdir=dst), expected)
                self.assert_record(w, op, src, expected, count)
            # inode is the old parent, not the destination or renamed child.
            self.assertEqual([r['inode'] for r in w.state()['renameEvidence']['records']],
                             [a, b, a, a])
            self.assertEqual(w.call(1, a, b'private-back\0')[0], 0)
            before = w.state()['renameEvidence']
            self.assertEqual(before['callbackCount'], 4)
            encoded = json.dumps(w.state())
            for token in ('private-', '987654', '876543', '765432', 'unused-independent'):
                self.assertNotIn(token, encoded)

    def test_00_production_boundary(self):
        self.boundary()

    def test_all_retention_limits_and_saturation(self):
        # Every allowed enabled limit, eviction at N+1, mixed opcodes and an
        # intervening non-rename. Check full retained sequence, not just length.
        for limit in range(1, 65):
            with self.subTest(limit=limit), self.wire(limit) as w:
                expected = []
                for count in range(1, limit + 3):
                    op = 12 if count % 2 else 45
                    w.unique = 10000 - count
                    error = w.rename(b'secret-missing', b'secret-target', op=op)
                    self.assertEqual(error, -errno.ENOENT)
                    expected.append(dict(opcode=op, unique=w.unique, inode=1,
                                         errno=errno.ENOENT, callbackCount=count))
                    self.assertEqual(w.call(3)[0], 0)
                    ev = w.state()['renameEvidence']
                    self.assertEqual(ev, dict(limit=limit, callbackCount=count,
                                              countSaturated=False, records=expected[-limit:]))
                # Seed only the numeric counter after a status roundtrip:
                # all measured transitions still cross the real serve boundary.
                w.backend.rename_callbacks = MAX - 1
                for op in (45, 12, 45):
                    self.assertEqual(w.rename(b'absent', b'x', op=op), -errno.ENOENT)
                    self.assert_record(w, op, 1, -errno.ENOENT, MAX)
                    self.assertTrue(w.state()['renameEvidence']['countSaturated'])
                self.assertEqual(len(w.state()['renameEvidence']['records']), limit)

    def test_malformed_payload_and_disabled_exact_parity(self):
        runs = []
        for limit in (0, 8):
            with self.wire(limit) as w:
                observations = []
                count = 0
                # All binary-prefix truncations, plus absent second name.
                # RENAME2 zero-filled short flags produce EIO, not flags rejection.
                for op, sizes in ((12, range(8)), (45, range(16))):
                    for size in sizes:
                        error, answer = w.call(op, payload=b'\0' * size)
                        self.assertEqual((error, answer), (-errno.EIO, b''))
                        count += 1
                        state = w.state()
                        if limit:
                            self.assert_record(w, op, 1, error, count)
                            state.pop('renameEvidence')
                        else:
                            self.assertNotIn('renameEvidence', state)
                            self.assertFalse(hasattr(w.backend, 'rename_callbacks'))
                            self.assertFalse(hasattr(w.backend, 'rename_evidence'))
                        observations.append((error, answer, state))
                for op in (12, 45):
                    prefix = production.pack('Q', 1) + (b'\0' * 8 if op == 45 else b'')
                    error, answer = w.call(op, payload=prefix + b'private-single-name')
                    self.assertEqual((error, answer), (-errno.EIO, b''))
                    count += 1
                    state = w.state()
                    if limit:
                        self.assert_record(w, op, 1, error, count)
                        state.pop('renameEvidence')
                    self.assertNotIn('private-single-name', json.dumps(state))
                    observations.append((error, answer, state))
                # Dispatch survives malformed callback data and records a later
                # success with the right errno instead of stale EIO.
                w.create(b'private-after-error')
                self.assertEqual(w.rename(b'private-after-error', b'private-success'), 0)
                if limit:
                    self.assert_record(w, 12, 1, 0, count + 1)
                runs.append(observations)
        self.assertEqual(runs[0], runs[1])

    def test_removed_hook_rejected_at_boundary(self):
        text = SOURCE.read_text()
        hook = '                        self.record_rename_callback(op,unique,ino,error)\n'
        self.assertEqual(text.count(hook), 1)
        mutant = types.ModuleType('independent_removed_hook')
        exec(compile(text.replace(hook, ''), str(SOURCE) + ':removed-hook', 'exec'),
             mutant.__dict__)
        with self.assertRaisesRegex(AssertionError, 'serve evidence hook missing'):
            self.boundary(mutant)


if __name__ == '__main__':
    unittest.main(verbosity=2)
