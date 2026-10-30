#!/usr/bin/env python3
"""CREATE/MKDIR production serve evidence; local wire, never mounted acceptance."""
import copy
import errno
import json
import types
import unittest
import test_namespace_wire as namespace

production = namespace.production
MAX = namespace.MAX


class CreateMkdirTests(unittest.TestCase):
    def boundary(self, module=production, limit=64, explicit=True):
        with namespace.wire(limit, module=module, explicit=explicit, rename=2) as w:
            expected = []
            observations = []

            def call(op, parent, payload, error=0, identity=None):
                before = copy.deepcopy(w.backend.nodes)
                state_before = namespace.stable(w)
                if identity is not None:
                    w.unique = identity - 1
                reply = w.call(op, parent, payload)
                self.assertEqual(reply[0], -error)
                if error:
                    self.assertEqual(w.backend.nodes, before)
                    self.assertEqual(namespace.stable(w), state_before)
                expected.append(dict(opcode=op, unique=w.unique, inode=parent,
                                     errno=error, callbackCount=len(expected)+1))
                state = w.state()
                if limit:
                    self.assertEqual(state.pop('namespaceEvidence'), dict(
                        limit=limit, callbackCount=len(expected), countSaturated=False,
                        records=expected[-limit:]), 'CREATE/MKDIR serve observation missing or misplaced')
                else:
                    self.assertNotIn('namespaceEvidence', state)
                    self.assertFalse(hasattr(w.backend, 'namespace_callbacks'))
                    self.assertFalse(hasattr(w.backend, 'namespace_evidence'))
                observations.append((reply, json.dumps(state), copy.deepcopy(w.backend.nodes)))
                return reply[1]

            directory = production.pack('2I', 0o700, 0)
            regular = production.pack('4I', 0, 0o600, 0, 0)
            parent = production.unpack('Q', call(9, 1, directory+b'private-dir,alpha\0', identity=MAX))[0]
            child = production.unpack('Q', call(35, parent, regular+b'private-file,beta\0', identity=0))[0]
            secret = b'Q7z!secret-content,delta'
            self.assertEqual(w.call(16, child, production.pack('2QI', child, 0, len(secret))+b'\0'*20+secret)[0], 0)
            # Errors arise from real handlers, with no mocked or forced failures.
            for op, prefix in ((9, directory), (35, regular)):
                call(op, parent, prefix+b'private-file,beta\0', errno.EEXIST, identity=7)
                call(op, child, prefix+b'private-name,gamma\0', errno.ENOTDIR)
                call(op, MAX, prefix+b'private-name,gamma\0', errno.ENOENT, identity=MAX)
                call(op, parent, prefix+b'..\0', errno.EINVAL, identity=0)
            before = w.state().get('namespaceEvidence')
            self.assertEqual(w.call(3, child)[0], 0)
            self.assertEqual(w.call(15, child, production.pack('2QI', child, 0, len(secret)))[1], secret)
            self.assertEqual(w.rename(b'absent', b'private-other'), -errno.ENOENT)
            self.assertEqual(w.call(999)[0], -errno.EOPNOTSUPP)
            self.assertEqual(w.state().get('namespaceEvidence'), before)
            self.assertEqual(w.state()['renameEvidence']['callbackCount'], 1)
            self.assertEqual(w.call(18, child, production.pack('Q', child))[0], 0)
            final = w.state()
            self.assertEqual((final['live'], final['inodes'], final['written'], final['openHandles'], final['failure']),
                             (16384, 3, len(secret), 0, None))
            encoded = json.dumps(final)
            for private in ('private-', 'Q7z!', 'secret-content', '987654', '876543', '765432', 'unused-namespace'):
                self.assertNotIn(private, encoded)
            if limit:
                for record in final['namespaceEvidence']['records']:
                    self.assertEqual(set(record), {'opcode', 'unique', 'inode', 'errno', 'callbackCount'})
                    self.assertTrue(all(type(v) is int and 0 <= v <= MAX for v in record.values()))
            return observations

    def test_00_production_boundary(self):
        self.boundary()

    def test_default_off_byte_shape_and_behavior_parity(self):
        self.assertEqual(self.boundary(limit=0, explicit=False), self.boundary(limit=0))
        self.assertEqual(self.boundary(limit=0), self.boundary())

    def test_fifo_saturation_and_error_translation(self):
        for limit in range(1, 65):
            with self.subTest(limit=limit), namespace.wire(limit) as w:
                expected = []
                for count in range(1, limit+3):
                    op = 9 if count % 2 else 35
                    prefix = production.pack('2I', 0o700, 0) if op == 9 else production.pack('4I', 0, 0o600, 0, 0)
                    self.assertEqual(w.call(op, MAX, prefix+b'private-missing,parent\0')[0], -errno.ENOENT)
                    expected.append(dict(opcode=op, unique=w.unique, inode=MAX,
                                         errno=errno.ENOENT, callbackCount=count))
                    self.assertEqual(w.state()['namespaceEvidence']['records'], expected[-limit:])
                w.backend.namespace_callbacks = MAX-1
                for op in (9, 35, 9):
                    # Truncated real dispatch translates struct.error to EIO.
                    self.assertEqual(w.call(op, 1, b'')[0], -errno.EIO)
                    ev = w.state()['namespaceEvidence']
                    self.assertTrue(ev['countSaturated'])
                    self.assertEqual(ev['callbackCount'], MAX)
                    self.assertEqual(ev['records'][-1], dict(opcode=op, unique=w.unique, inode=1,
                                                            errno=errno.EIO, callbackCount=MAX))
                ev['records'][-1]['errno'] = 999
                self.assertEqual(w.state()['namespaceEvidence']['records'][-1]['errno'], errno.EIO)

    def test_distinguishing_create_mkdir_filter_mutations(self):
        source = namespace.SOURCE.read_text()
        original = 'self.namespace_evidence_limit and op in (9,10,11,35)'
        self.assertEqual(source.count(original), 1)
        for ops in ('10,11', '9,10,11', '10,11,35'):
            with self.subTest(ops=ops):
                mutant = types.ModuleType('missing_create_or_mkdir')
                exec(compile(source.replace(original, 'self.namespace_evidence_limit and op in ('+ops+')'),
                             str(namespace.SOURCE), 'exec'), mutant.__dict__)
                with self.assertRaisesRegex(AssertionError, 'CREATE/MKDIR serve observation missing or misplaced'):
                    self.boundary(module=mutant)


if __name__ == '__main__':
    unittest.main(verbosity=2)
