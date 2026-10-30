#!/usr/bin/env python3
"""Source-only Linux SOCK_SEQPACKET fixture; calls the production serve loop."""
import contextlib
import copy
import errno
import importlib.util
import json
import pathlib
import socket
import tempfile
import threading
import unittest

SOURCE = pathlib.Path(__file__).with_name('fuse_backend.py')
spec = importlib.util.spec_from_file_location('production_fuse_backend', SOURCE)
production = importlib.util.module_from_spec(spec)
spec.loader.exec_module(production)


class Wire:
    def __init__(self, backend):
        self.backend = backend
        self.temp = tempfile.TemporaryDirectory(prefix='wire-', dir=SOURCE.parents[3])
        self.status = pathlib.Path(self.temp.name) / 's'
        server, self.client = socket.socketpair(socket.AF_UNIX, socket.SOCK_SEQPACKET)
        self.client.settimeout(2)
        backend.fd = server.detach()
        self.errors = []
        self.unique = 0
        self.thread = threading.Thread(target=self.run, daemon=True)
        self.thread.start()
        assert self.call(26, payload=production.pack('4I', 7, 31, 0, 0))[0] == 0

    def run(self):
        try:
            self.backend.serve(self.status)
        except BaseException as error:
            self.errors.append(error)

    def call(self, op, ino=1, payload=b''):
        self.unique += 1
        # Deliberately sensitive credentials in header; evidence must omit them.
        packet = production.pack('2I2Q4I', 40 + len(payload), op,
                                 self.unique, ino, 987654, 876543, 765432, 0) + payload
        self.client.sendall(packet)
        raw = self.client.recv(131072)
        length, error, unique = production.unpack('IiQ', raw)
        assert length == len(raw) and unique == self.unique
        return error, raw[16:]

    def state(self):
        # INIT reply proves serve has bound/listened and entered dispatch.
        with socket.socket(socket.AF_UNIX) as conn:
            conn.settimeout(2)
            conn.connect(str(self.status))
            chunks = []
            while True:
                part = conn.recv(4096)
                if not part:
                    return json.loads(b''.join(chunks))
                chunks.append(part)

    def mkdir(self, name, parent=1):
        error, answer = self.call(9, parent, production.pack('2I', 0o700, 0) + name + b'\0')
        assert error == 0
        return production.unpack('Q', answer)[0]

    def create(self, name, parent=1):
        error, answer = self.call(35, parent, production.pack('4I', 0, 0o600, 0, 0) + name + b'\0')
        assert error == 0
        return production.unpack('Q', answer)[0]

    def rename(self, old, new, *, op=12, parent=1, newdir=1, flags=0):
        prefix = production.pack('Q', newdir)
        if op == 45:
            prefix += production.pack('2I', flags, 0)
        return self.call(op, parent, prefix + old + b'\0' + new + b'\0')[0]

    def close(self):
        self.client.shutdown(socket.SHUT_WR)
        self.thread.join(3)
        self.client.close()
        assert not self.thread.is_alive(), 'serve failed to stop on wire EOF'
        self.temp.cleanup()
        assert not self.errors, repr(self.errors)


class ServeTests(unittest.TestCase):
    @contextlib.contextmanager
    def wire(self, **options):
        backend = production.Backend('/unused-source-only', 1048576, 65536, 16384, **options)
        wire = Wire(backend)
        try:
            yield wire
        finally:
            wire.close()

    def test_production_boundary_baseline(self):
        with self.wire() as w:
            self.assertEqual(w.call(26, payload=production.pack('4I', 7, 31, 0, 0))[0], 0)
            ino = w.create(b'original')
            self.assertEqual(w.rename(b'original', b'renamed'), 0)
            error, answer = w.call(1, payload=b'renamed\0')
            self.assertEqual(error, 0)
            self.assertEqual(production.unpack('Q', answer)[0], ino)
            self.assertEqual(w.rename(b'missing', b'other', op=45), -errno.ENOENT)
            self.assertEqual(w.call(18, ino, production.pack('Q', ino))[0], 0)
            self.assertEqual(w.state()['openHandles'], 0)

    def verify_enabled_callbacks(self):
        with self.wire(rename_evidence_limit=8) as w:
            self.assertEqual(w.state()['renameEvidence']['records'], [])
            child = w.create(b'private-source-credential')
            self.assertEqual(w.rename(b'private-source-credential', b'private-target'), 0)
            first = w.unique
            # RENAME2 flag rejection still proves actual backend callback entry.
            self.assertEqual(w.rename(b'private-target', b'x', op=45, flags=1), -errno.EOPNOTSUPP)
            second = w.unique
            self.assertEqual(w.rename(b'absent', b'x', op=45), -errno.ENOENT)
            third = w.unique
            # A malformed payload reaches the handler and is translated to EIO.
            self.assertEqual(w.call(12, payload=b'bad')[0], -errno.EIO)
            fourth = w.unique
            self.assertEqual(w.call(3, child)[0], 0)
            expected = [
                dict(opcode=12, unique=first, inode=1, errno=0, callbackCount=1),
                dict(opcode=45, unique=second, inode=1, errno=errno.EOPNOTSUPP, callbackCount=2),
                dict(opcode=45, unique=third, inode=1, errno=errno.ENOENT, callbackCount=3),
                dict(opcode=12, unique=fourth, inode=1, errno=errno.EIO, callbackCount=4)]
            snapshot = w.state()['renameEvidence']
            self.assertEqual(snapshot['callbackCount'], 4, 'serve callback evidence missing')
            self.assertEqual(snapshot, dict(limit=8, callbackCount=4,
                                           countSaturated=False, records=expected))
            encoded = json.dumps(snapshot)
            for private in ('private', '987654', '876543', '765432', 'bad', 'payload', 'uid', 'gid', 'pid'):
                self.assertNotIn(private, encoded)
            return snapshot

    def test_enabled_callbacks(self):
        self.verify_enabled_callbacks()

    def test_nonroot_rename2_success(self):
        with self.wire(rename_evidence_limit=2) as w:
            parent = w.mkdir(b'private-directory')
            child = w.create(b'private-file', parent)
            self.assertEqual(w.rename(b'private-file', b'private-renamed',
                                      op=45, parent=parent, newdir=parent), 0)
            evidence = w.state()['renameEvidence']
            self.assertEqual(evidence['records'], [
                dict(opcode=45, unique=w.unique, inode=parent, errno=0, callbackCount=1)])
            error, answer = w.call(1, parent, b'private-renamed\0')
            self.assertEqual((error, production.unpack('Q', answer)[0]), (0, child))

    def test_disabled_parity_and_namespace_resources(self):
        results = []
        for options in ({}, dict(rename_evidence_limit=0), dict(rename_evidence_limit=8)):
            with self.wire(**options) as w:
                replies = []
                child = w.create(b'file')
                directory = w.mkdir(b'dir')
                nested = w.mkdir(b'nested', directory)
                other = w.create(b'other')
                def reject(old, new, expected, **kwargs):
                    before = copy.deepcopy(w.backend.nodes)
                    resources = {k: w.state()[k] for k in ('live','peak','written','inodes','openHandles','failure')}
                    reply = w.rename(old, new, **kwargs)
                    replies.append(reply)
                    self.assertEqual(reply, -expected)
                    after = copy.deepcopy(w.backend.nodes)
                    self.assertEqual(before, after)
                    self.assertEqual(resources, {k: w.state()[k] for k in resources})
                reject(b'file', b'dir', errno.EISDIR)
                reject(b'dir', b'file', errno.ENOTDIR, op=45)
                reject(b'dir', b'x', errno.EINVAL, newdir=nested)
                reject(b'file', b'x', errno.ENOTDIR, parent=other)
                reject(b'file', b'x', errno.ENOTDIR, newdir=other, op=45)
                reject(b'file', b'x', errno.ENOENT, newdir=999)
                replies.append(w.rename(b'file', b'other', op=45))
                self.assertEqual(replies[-1], 0)
                # Replaced open file remains charged until its last release.
                self.assertIn(other, w.backend.nodes)
                self.assertEqual(w.call(18, other, production.pack('Q', other))[0], 0)
                self.assertNotIn(other, w.backend.nodes)
                self.assertEqual(w.call(18, child, production.pack('Q', child))[0], 0)
                error, answer = w.call(1, payload=b'other\0')
                self.assertEqual((error, production.unpack('Q', answer)[0]), (0, child))
                state = w.state()
                if not options.get('rename_evidence_limit'):
                    self.assertNotIn('renameEvidence', state)
                    self.assertFalse(hasattr(w.backend, 'rename_evidence'))
                    self.assertFalse(hasattr(w.backend, 'rename_callbacks'))
                else:
                    self.assertEqual(state.pop('renameEvidence')['callbackCount'], 7)
                results.append((replies, state, w.backend.nodes))
        self.assertEqual(results[0], results[1])
        self.assertEqual(results[0], results[2])

    def test_retention_and_counter_bounds(self):
        for limit in (1, 3, 64):
            with self.wire(rename_evidence_limit=limit) as w:
                # Max uint64 unique/inode values remain numeric and bounded.
                w.unique = 0xffffffffffffffff - 1
                self.assertEqual(w.call(45, 0xffffffffffffffff, production.pack('Q2I', 1, 1, 0) + b'x\0y\0')[0], -errno.EOPNOTSUPP)
                self.assertEqual(w.state()['renameEvidence']['records'][0]['unique'], 0xffffffffffffffff)
                self.assertEqual(w.state()['renameEvidence']['records'][0]['inode'], 0xffffffffffffffff)
                w.unique = 0
                for _ in range(80):
                    self.assertEqual(w.rename(b'absent', b'x'), -errno.ENOENT)
                evidence = w.state()['renameEvidence']
                self.assertEqual(evidence['callbackCount'], 81)
                self.assertEqual(len(evidence['records']), limit)
                self.assertEqual([r['callbackCount'] for r in evidence['records']], list(range(82-limit,82)))
                self.assertLess(len(json.dumps(evidence)), 12000)
                # Exercise saturation without sending 2**64 requests.
                w.backend.rename_callbacks = 0xffffffffffffffff - 1
                for _ in range(2):
                    self.assertEqual(w.rename(b'absent', b'x', op=45), -errno.ENOENT)
                evidence = w.state()['renameEvidence']
                self.assertEqual(evidence['callbackCount'], 0xffffffffffffffff)
                self.assertTrue(evidence['countSaturated'])
                self.assertEqual(evidence['records'][-1]['callbackCount'], 0xffffffffffffffff)
                # Returned state cannot mutate retained evidence.
                evidence['records'][-1]['errno'] = 999
                self.assertEqual(w.state()['renameEvidence']['records'][-1]['errno'], errno.ENOENT)

    def test_invalid_limits(self):
        for limit in (-1, 65, 1.5, '3', True, None):
            with self.subTest(limit=limit), self.assertRaises(ValueError):
                production.Backend('/unused', rename_evidence_limit=limit)

    def test_cli_preserves_positional_contract(self):
        from unittest import mock
        for quotas in ([], ['12288'], ['12288','12000'], ['12288','12000','8000']):
            for optional in ([], ['--rename-evidence=3'], ['--rename-evidence=0']):
                seen = []
                def serve(backend, status):
                    seen.append((backend, status))
                with mock.patch.object(production.Backend, 'mount', autospec=True) as mount, mock.patch.object(production.Backend, 'serve', serve):
                    production.main(['/unused', '/unused-status'] + quotas + optional)
                    mount.assert_called_once()
                backend, status = seen[0]
                expected = [32768,65536,16384]
                expected[:len(quotas)] = map(int, quotas)
                self.assertEqual([backend.live_limit, backend.write_limit, backend.file_limit], expected)
                self.assertEqual(status, '/unused-status')
                self.assertEqual(backend.rename_evidence_limit, 3 if optional == ['--rename-evidence=3'] else 0)
        import io
        for optional in (['--rename-evidence=65'], ['--rename-evidence=-1'], ['--rename-evidence=no'], ['--unknown'], ['1','2','3','4']):
            with contextlib.redirect_stderr(io.StringIO()), mock.patch.object(production.Backend, 'mount') as mount, self.assertRaises(SystemExit) as exit:
                production.main(['/unused', '/unused-status'] + optional)
            self.assertEqual(exit.exception.code, 2)
            mount.assert_not_called()

    def test_rejecting_removal_control(self):
        import types
        from unittest import mock
        source = SOURCE.read_text()
        hook = '                        self.record_rename_callback(op,unique,ino,error)\n'
        self.assertEqual(source.count(hook), 1)
        mutant = types.ModuleType('removed_serve_hook')
        exec(compile(source.replace(hook, ''), str(SOURCE) + ':removed-hook', 'exec'), mutant.__dict__)
        with mock.patch.dict(globals(), production=mutant):
            with self.assertRaises(AssertionError) as rejected:
                self.verify_enabled_callbacks()
        self.assertIn('serve callback evidence missing', str(rejected.exception))


if __name__ == '__main__':
    unittest.main(verbosity=2)
