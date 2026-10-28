#!/usr/bin/env python3
"""Focused hostile-archive/sequence/PE fixtures. Run under external supervisor."""
import importlib.util
import os
from pathlib import Path
import stat
import struct
import subprocess
import sys
import tempfile
import unittest
import zipfile

RECIPE = Path(__file__).resolve().parents[1] / 'tools/recovery/tuxracer-original-win32-recovery-oct28.py'
spec = importlib.util.spec_from_file_location('recovery', RECIPE)
r = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r)


class RecoveryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='tux-fixture-', dir=Path(__file__).resolve().parents[2])
        self.addCleanup(self.temp.cleanup)
        self.d = Path(self.temp.name)

    def archive(self, entries, compression=zipfile.ZIP_STORED):
        p = self.d / 'fixture.zip'
        with zipfile.ZipFile(p, 'w', compression=compression) as z:
            for name, data in entries:
                z.writestr(name, data)
        return p

    def reject_metadata_without_write(self, archive, limit, pattern=None):
        sentinel = self.d / 'extraction-sentinel'
        with self.assertRaisesRegex(r.Rejected, pattern or '.'):
            r.guarded(lambda: r.metadata(archive, limit),
                      lambda: sentinel.write_text('BAD'))
        self.assertFalse(sentinel.exists())

    def test_rejection_propagates_to_exit_and_never_downloads(self):
        bad = self.d / 'bad'
        bad.write_bytes(b'bad')
        sentinel = self.d / 'download-sentinel'
        # Actual production sequencing wrapper; external supervisor owns child.
        for maximum, expected in ((2, r.digest(bad)), (3, '0'*64)):
            code = ('import importlib.util,pathlib;'
                    f's=importlib.util.spec_from_file_location("r",{str(RECIPE)!r});'
                    'r=importlib.util.module_from_spec(s);s.loader.exec_module(r);'
                    f'r.guarded(lambda:r.pin({str(bad)!r},{expected!r},{maximum}),'
                    f'lambda:pathlib.Path({str(sentinel)!r}).write_text("BAD"))')
            child = subprocess.run([sys.executable, '-c', code], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=5)
            self.assertNotEqual(child.returncode, 0)
            self.assertIn(b'Rejected', child.stderr)
            self.assertFalse(sentinel.exists())

    def test_real_pin_is_immutable_and_precedes_destination(self):
        p = self.archive([('data/file', b'test')])
        target = self.d / 'extracted'
        with self.assertRaisesRegex(r.Rejected, 'SHA256 mismatch'):
            r.extract(p, target, 100)
        self.assertFalse(target.exists())
        self.assertEqual(r.SHA256, '1497e326af9aa591243f4ff1083d4d99de7dc5f0396e37f45ca7bf4f98823c34')

    def test_all_metadata_admitted_before_write(self):
        p = self.archive([('good', b'123'), ('late', b'456')])
        self.reject_metadata_without_write(p, 5, 'aggregate')
        self.assertEqual(r.metadata(p, 6)['expandedBytes'], 6)
        self.assertEqual(sorted(x.name for x in self.d.iterdir()), ['fixture.zip'])

    def test_hostile_paths_and_collisions(self):
        for path in ('../escape', '/absolute', 'a/../escape', 'a\\escape', 'C:escape', 'con.txt', 'a./f', 'a//f'):
            with self.subTest(path=path):
                self.reject_metadata_without_write(self.archive([(path, b'x')]), 100)
        for entries in ([('A.dll', b'1'), ('a.DLL', b'2')], [('a', b'1'), ('a/b', b'2')]):
            self.reject_metadata_without_write(self.archive(entries), 100)

    def test_symlink_special_and_unsupported_compression(self):
        for mode in (stat.S_IFLNK | 0o777, stat.S_IFIFO | 0o600):
            i = zipfile.ZipInfo('link');i.create_system = 3;i.external_attr = mode << 16
            self.reject_metadata_without_write(self.archive([(i, b'target')]), 100)
        self.reject_metadata_without_write(self.archive([('f', b'x')], zipfile.ZIP_BZIP2), 100)

    def test_executable_prefix_and_directory_bounds(self):
        p = self.archive([('f', b'x')]);data = p.read_bytes()
        p.write_bytes(b'MZ'+data)
        with self.assertRaisesRegex(r.Rejected, 'prefix'):
            r.metadata(p, 100)
        data = bytearray(data);at = data.rfind(b'PK\x05\x06')
        struct.pack_into('<L', data, at+12, r.MAX_METADATA+1);p.write_bytes(data)
        with self.assertRaisesRegex(r.Rejected, 'metadata'):
            r.metadata(p, 100)

    def test_bounded_pe_imports_and_windows_classification(self):
        b = bytearray(1024);b[:2] = b'MZ';struct.pack_into('<L', b, 60, 128)
        b[128:132] = b'PE\0\0';struct.pack_into('<HH', b, 132, 0x14c, 1)
        struct.pack_into('<H', b, 148, 224);opt=152
        struct.pack_into('<H', b, opt, 0x10b);struct.pack_into('<L', b, opt+92, 16)
        struct.pack_into('<LL', b, opt+104, 0x1000, 60)
        struct.pack_into('<LLLL', b, opt+224+8, 512, 0x1000, 512, 512)
        struct.pack_into('<5L', b, 512, 0, 0, 0, 0x1080, 0)
        struct.pack_into('<5L', b, 532, 0, 0, 0, 0x1090, 0)
        b[640:653] = b'KERNEL32.DLL\0';b[656:667] = b'GLUT32.dll\0'
        (self.d/'tuxracer.exe').write_bytes(b)
        report=r.pe(self.d/'tuxracer.exe')
        self.assertEqual(report['machine'], '0x14c')
        self.assertEqual(report['imports'], ['glut32.dll', 'kernel32.dll'])
        inventory={'files':[{'path':'tuxracer.exe'},{'path':'other/GLUT32.DLL'}]}
        # Only EXE is parsed here; closure matching itself is verified on actual archive.
        self.assertIn('kernel32', r.SYSTEM)
        struct.pack_into('<L', b, 524, 0xffffffff);(self.d/'bad.exe').write_bytes(b)
        with self.assertRaisesRegex(r.Rejected, 'RVA'):
            r.pe(self.d/'bad.exe')


if __name__ == '__main__':
    unittest.main(verbosity=2)
