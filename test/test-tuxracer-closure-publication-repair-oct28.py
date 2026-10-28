#!/usr/bin/env python3
"""Synthetic fixtures only: main() pin seam is NOT a production SHA bypass.

Run with a fresh owned output directory. Optional second arg is a mutation-only
recipe path. The unchanged independent rejection test is deliberately untouched.
"""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import struct
import sys
import unittest
from unittest.mock import patch
import zipfile

OUT = Path(sys.argv[1]); OUT.mkdir()
RECIPE = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parents[1] / 'tools/recovery/tuxracer-original-win32-recovery-oct28.py'
sys.argv = sys.argv[:1]
spec = importlib.util.spec_from_file_location('r', RECIPE)
r = importlib.util.module_from_spec(spec); spec.loader.exec_module(r)


def image(dll=b'KERNEL32.dll'):
    b = bytearray(1024); b[:2] = b'MZ'
    struct.pack_into('<L', b, 60, 128); b[128:132] = b'PE\0\0'
    struct.pack_into('<HH', b, 132, 0x14c, 1)
    struct.pack_into('<H', b, 148, 224); opt = 152
    struct.pack_into('<H', b, opt, 0x10b); struct.pack_into('<L', b, opt+92, 16)
    struct.pack_into('<LL', b, opt+104, 0x1000, 40)
    struct.pack_into('<LLLL', b, opt+224+8, 512, 0x1000, 512, 512)
    struct.pack_into('<5L', b, 512, 0, 0, 0, 0x1080, 0)
    b[640:640+len(dll)+1] = dll+b'\0'
    return b


class Publication(unittest.TestCase):
    def setUp(self):
        self.d = OUT / self._testMethodName; self.d.mkdir()
        self.dest = self.d / 'extracted'
        self.inv = self.d / 'inventory.json'; self.clo = self.d / 'closure.json'
        self.old = {self.inv: b'OLD INVENTORY', self.clo: b'OLD CLOSURE'}
        for p, b in self.old.items(): p.write_bytes(b)

    def archive(self, exe=None, script=b'# no external references', extra=()):
        p = self.d / 'fixture.zip'
        with zipfile.ZipFile(p, 'w') as z:
            z.writestr('app.exe', image() if exe is None else exe)
            z.writestr('init.tcl', script)
            for n, b in extra: z.writestr(n, b)
        return p

    def stage(self, fixture):
        # Synthetic fixture ONLY. Original pin function still checks fixture hash.
        real = r.pin
        with patch.object(r, 'pin', side_effect=lambda p: real(p, expected=r.digest(fixture))), patch.object(sys, 'argv', [str(RECIPE), 'extract', str(fixture), str(self.dest), '--max-expanded-bytes', '8192']):
            with (self.d/'stage.stdout').open('w') as o, (self.d/'stage.stderr').open('w') as e, contextlib.redirect_stdout(o), contextlib.redirect_stderr(e):
                try: r.main()
                except BaseException as error:
                    e.write(type(error).__name__ + ': ' + str(error) + '\n')
                    raise

    def preserved(self):
        for p, b in self.old.items(): self.assertEqual(p.read_bytes(), b)
        self.assertFalse(self.dest.exists())
        self.assertFalse(list(self.d.glob('.tuxracer-stage-*')))

    def test_success_and_preexisting_reports(self):
        self.stage(self.archive(script=b'source {data/child.tcl}', extra=[('data/child.tcl', b'# leaf')]))
        self.assertTrue(json.loads(self.inv.read_text())['complete'])
        c = json.loads(self.clo.read_text())
        self.assertEqual(c['modules']['app.exe']['windows'], ['kernel32.dll'])
        self.assertEqual(c['literalSources']['checked'][0]['literal'], 'data/child.tcl')
        self.assertFalse(list(self.d.glob('.tuxracer-stage-*')))

    def test_missing_dll(self):
        with self.assertRaisesRegex(r.Rejected, 'unresolved.*missing.dll'):
            self.stage(self.archive(exe=image(b'MISSING.dll')))
        self.preserved()

    def test_missing_literal(self):
        with self.assertRaisesRegex(r.Rejected, 'missing literal.*missing.tcl'):
            self.stage(self.archive(script=b'source "missing.tcl"'))
        self.preserved()

    def test_missing_literal_with_encoding(self):
        with self.assertRaisesRegex(r.Rejected, 'missing literal.*missing.tcl'):
            self.stage(self.archive(script=b'source -encoding utf-8 missing.tcl'))
        self.preserved()

    def test_non_i386_pe(self):
        b = image(); struct.pack_into('<H', b, 132, 0x8664)
        with self.assertRaisesRegex(r.Rejected, 'unsupported PE'):
            self.stage(self.archive(exe=b))
        self.preserved()

    def test_malformed_pe(self):
        with self.assertRaisesRegex(r.Rejected, 'MZ'):
            self.stage(self.archive(exe=b'broken'))
        self.preserved()

    def test_bundled_dll_must_validate(self):
        with self.assertRaisesRegex(r.Rejected, 'MZ'):
            self.stage(self.archive(exe=image(b'bundled.dll'), extra=[('bundled.dll', b'broken')]))
        self.preserved()

    def test_valid_bundled_dll(self):
        self.stage(self.archive(exe=image(b'bundled.dll'), extra=[('bundled.dll', image())]))
        self.assertEqual(json.loads(self.clo.read_text())['modules']['app.exe']['bundled'], ['bundled.dll'])

    def test_dynamic_unknown(self):
        self.stage(self.archive(script=b'source $data_dir/missing.tcl\nsource [file join $root computed.tcl]'))
        c = json.loads(self.clo.read_text())
        self.assertEqual(len(c['literalSources']['unknown']), 2)
        self.assertIn('runtime unknown', c['scope'])

    def test_preexisting_destination(self):
        self.dest.mkdir(); sentinel = self.dest/'keep'; sentinel.write_bytes(b'user data')
        with self.assertRaisesRegex(r.Rejected, 'destination exists'):
            self.stage(self.archive())
        self.assertEqual(sentinel.read_bytes(), b'user data')
        for p, b in self.old.items(): self.assertEqual(p.read_bytes(), b)

    def test_publication_failure_rolls_back_old_pair(self):
        fixture = self.archive(); real = r.os.replace
        def fail_second(src, dst):
            if Path(src).name == 'new-closure.json': raise OSError('injected closure publication failure')
            return real(src, dst)
        with patch.object(r.os, 'replace', side_effect=fail_second):
            with self.assertRaisesRegex(OSError, 'injected closure'):
                self.stage(fixture)
        self.preserved()

    def test_publication_failure_without_old_reports(self):
        for p in self.old: p.unlink()
        fixture = self.archive(); real = r.os.replace
        def fail_second(src, dst):
            if Path(src).name == 'new-closure.json': raise OSError('injected write failure')
            return real(src, dst)
        with patch.object(r.os, 'replace', side_effect=fail_second):
            with self.assertRaisesRegex(OSError, 'injected write'): self.stage(fixture)
        self.assertFalse(self.inv.exists()); self.assertFalse(self.clo.exists()); self.assertFalse(self.dest.exists())

    def test_production_pin_unmodified(self):
        fixture = self.archive()
        with self.assertRaisesRegex(r.Rejected, 'SHA256 mismatch'):
            r.publish_extract(fixture, self.dest, 8192)
        self.preserved()
        self.assertEqual(r.SHA256, '1497e326af9aa591243f4ff1083d4d99de7dc5f0396e37f45ca7bf4f98823c34')

    def test_staged_report_write_failure(self):
        fixture = self.archive(); real = Path.write_text
        def fail_write(path, *args, **kw):
            if path.name == 'new-closure.json': raise OSError('injected staged write')
            return real(path, *args, **kw)
        with patch.object(Path, 'write_text', fail_write):
            with self.assertRaisesRegex(OSError, 'injected staged write'): self.stage(fixture)
        self.preserved()

    def test_cleanup_failure_after_commit_is_warning(self):
        fixture = self.archive()
        with patch.object(r.shutil, 'rmtree', side_effect=OSError('injected cleanup')):
            self.stage(fixture)
        self.assertTrue(json.loads(self.inv.read_text())['complete'])
        self.assertIn('staging cleanup pending', (self.d/'stage.stderr').read_text())
        for p in self.d.glob('.tuxracer-stage-*'): r.shutil.rmtree(p)


if __name__ == '__main__':
    unittest.main(verbosity=2)
