import hashlib
import pathlib
import tempfile
import unittest
from collector import select, recover, LIMIT, CHUNK


def row(name, data):
    return dict(path=name, bytes=len(data), sha256=hashlib.sha256(data).hexdigest())


class CollectorTests(unittest.TestCase):
    def test_select_before_accounting(self):
        a = dict(path='title.png', bytes=136760, sha256='a'*64)
        b = dict(path='before.png', bytes=171779, sha256='b'*64)
        manifest = [a, b, dict(b, path='practice.png'), dict(b, path='course.png')]
        self.assertEqual(sum(x['bytes'] for x in manifest), 652097)
        chosen = select(manifest, manifest)
        self.assertEqual(chosen, [a, b])
        self.assertEqual(sum(x['bytes'] for x in chosen), 308539)
        # An unselected distinct large file must not prevent exact selection.
        self.assertEqual(select(manifest + [dict(path='other.png', bytes=LIMIT, sha256='c'*64)], [a, b]), [a, b])

    def test_genuinely_oversized_rejected_before_fetch(self):
        rows = [dict(path='a', bytes=LIMIT, sha256='a'*64), dict(path='b', bytes=1, sha256='b'*64)]
        def forbidden(*args):
            self.fail('fetch called before oversized selection rejected')
        with self.assertRaisesRegex(ValueError, 'exceed'):
            recover(rows, rows, {}, '.', forbidden)

    def test_local_reuse_and_exact_chunks(self):
        data = b'x' * (CHUNK + 3)
        a, b = row('existing.png', b'known'), row('runtime.stdout', data)
        calls = []
        with tempfile.TemporaryDirectory(dir=pathlib.Path(__file__).parent) as tmp:
            root = pathlib.Path(tmp)
            (root/'existing.png').write_bytes(b'known')
            def fetch(name, offset, count):
                self.assertEqual(name, 'runtime.stdout')
                self.assertLessEqual(count, CHUNK)
                calls.append((offset, count))
                return data[offset:offset+count]
            result = recover([a,b], [a,b], {'existing.png':root/'existing.png'}, root, fetch)
            self.assertEqual(calls, [(0,CHUNK),(CHUNK,3)])
            self.assertEqual([x['reused'] for x in result], [True,False])
            self.assertEqual((root/'runtime.stdout').read_bytes(), data)

    def test_bad_pins_and_corrupt_local_rejected(self):
        a = row('a', b'good')
        for wanted in [[dict(a, sha256='b'*64)], [dict(a, path='missing')]]:
            with self.assertRaises(ValueError): select([a], wanted)
        with self.assertRaises(ValueError): select([a,dict(a,bytes=5)], [a])
        with self.assertRaises(ValueError): select([dict(a,path='../escape')], [])
        with tempfile.TemporaryDirectory(dir=pathlib.Path(__file__).parent) as tmp:
            p=pathlib.Path(tmp)/'a';p.write_bytes(b'evil')
            with self.assertRaisesRegex(ValueError,'content mismatch'):
                recover([a],[a],{'a':p},tmp,lambda *args:self.fail('redundant fetch'))

if __name__ == '__main__': unittest.main()
