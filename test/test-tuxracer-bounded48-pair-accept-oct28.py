#!/usr/bin/env python3
"""Independent static acceptance; synthetic fixtures never satisfy the original pin.

Usage: python3 SCRIPT FRESH_OUTPUT [MUTATED_RECIPE]
All fixture-stage calls use an explicitly isolated digest seam. CLI pin checks
are separate, unpatched production subprocesses. No original media is opened.
"""
import contextlib
import hashlib
import importlib.util
import json
import pathlib
import struct
import subprocess
import sys
import unittest
from unittest.mock import patch
import zipfile

P = pathlib.Path
OUT = P(sys.argv[1]); OUT.mkdir()
RECIPE = P(sys.argv[2]) if len(sys.argv) > 2 else P(__file__).resolve().parents[1] / 'tools/recovery/tuxracer-original-win32-recovery-oct28.py'
MUTATION = len(sys.argv) > 2
if not MUTATION:
    assert hashlib.sha256(RECIPE.read_bytes()).hexdigest() == '567a716c33e97d9c8547a02c77ff10dc1839308afb45c3fe9848effb60a3134d'
spec = importlib.util.spec_from_file_location('candidate', RECIPE)
r = importlib.util.module_from_spec(spec); spec.loader.exec_module(r)
sys.argv = sys.argv[:1]


def pe(dll=b'KERNEL32.dll'):
    b = bytearray(1024); b[:2] = b'MZ'
    struct.pack_into('<L', b, 60, 128); b[128:132] = b'PE\0\0'
    struct.pack_into('<HH', b, 132, 0x14c, 1)
    struct.pack_into('<H', b, 148, 224)
    struct.pack_into('<H', b, 152, 0x10b)
    struct.pack_into('<L', b, 244, 16)
    struct.pack_into('<LL', b, 256, 0x1000, 40)
    struct.pack_into('<LLLL', b, 384, 512, 0x1000, 512, 512)
    struct.pack_into('<5L', b, 512, 0, 0, 0, 0x1080, 0)
    b[640:640+len(dll)+1] = dll + b'\0'
    return bytes(b)


class Acceptance(unittest.TestCase):
    def setup_case(self, label, old):
        d = OUT / label; d.mkdir()
        if old:
            (d/'inventory.json').write_bytes(b'old inventory')
            (d/'closure.json').write_bytes(b'old closure')
        return d

    def archive(self, d, entries):
        p = d/'fixture.zip'
        with zipfile.ZipFile(p, 'w') as z:
            for n, b in entries: z.writestr(n, b)
        return p

    def call(self, d, entries, dest='payload'):
        fixture = self.archive(d, entries)
        original_pin = r.pin
        args = [str(RECIPE), 'extract', str(fixture), str(d/dest), '--max-expanded-bytes', '8192']
        with patch.object(r, 'pin', side_effect=lambda p: original_pin(p, expected=r.digest(fixture))), patch.object(sys, 'argv', args):
            with (d/(dest+'.stdout')).open('w') as o, (d/(dest+'.stderr')).open('w') as e, contextlib.redirect_stdout(o), contextlib.redirect_stderr(e):
                try: r.main()
                except Exception as ex:
                    e.write(type(ex).__name__ + ': ' + str(ex) + '\n')
                    raise

    def state(self, d):
        return {n: (d/n).read_bytes() if (d/n).exists() else None for n in ('inventory.json', 'closure.json')}

    def unchanged_failure(self, d, before, dest='payload'):
        self.assertEqual(self.state(d), before)
        self.assertFalse((d/dest).exists())
        self.assertEqual((d/(dest+'.stdout')).read_bytes(), b'')
        self.assertFalse(list(d.glob('.tuxracer-stage-*')))

    def test_00_exact_stage_counterexamples(self):
        # Same malformed-PE and unresolved/literal shapes as the unchanged
        # historical stage reproducer, now against exact candidate main().
        for label, entries, error in [
            ('missing', [('app.exe', pe(b'MISSING.dll')), ('tuxracer_init.tcl', b'source missing.tcl')], 'unresolved.*missing.dll'),
            ('malformed', [('app.exe', b'broken'), ('tuxracer_init.tcl', b'source missing.tcl')], 'MZ'),
        ]:
            d = self.setup_case('boundary-'+label, True); before = self.state(d)
            with self.assertRaisesRegex(r.Rejected, error): self.call(d, entries)
            self.unchanged_failure(d, before)

    def test_01_production_identity_guard(self):
        d = self.setup_case('production-guard', False)
        p = self.archive(d, [('app.exe', pe())])
        cmd = [sys.executable, str(RECIPE), 'extract', str(p), str(d/'payload'), '--max-expanded-bytes', '8192']
        with (d/'cli.stdout').open('wb') as o, (d/'cli.stderr').open('wb') as e:
            c = subprocess.run(cmd, stdout=o, stderr=e, timeout=15)
        (d/'command.json').write_text(json.dumps({'command':cmd, 'exit':c.returncode})+'\n')
        self.assertNotEqual(c.returncode, 0)
        self.assertIn('SHA256 mismatch', (d/'cli.stderr').read_text())
        self.assertFalse((d/'payload').exists())
        self.assertEqual(self.state(d), {'inventory.json':None, 'closure.json':None})

    def test_02_validation_preserves_absent_and_old_pairs(self):
        cases = [
            ('bad-exe', [('app.exe', b'bad')], 'MZ'),
            ('bad-dll', [('app.exe', pe(b'child.dll')), ('child.dll', b'bad')], 'MZ'),
            ('unresolved', [('app.exe', pe(b'missing.dll'))], 'unresolved.*missing.dll'),
            ('literal', [('app.exe', pe()), ('init.tcl', b'source {missing.tcl}')], 'missing literal.*missing.tcl'),
        ]
        for old in (False, True):
            for label, entries, error in cases:
                with self.subTest(old=old, label=label):
                    d = self.setup_case(label+'-'+str(old), old); before = self.state(d)
                    with self.assertRaisesRegex(r.Rejected, error): self.call(d, entries)
                    self.unchanged_failure(d, before)

    def test_03_complete_closure_two_generations(self):
        for old in (False, True):
            d = self.setup_case('generations-'+str(old), old)
            for gen in ('one', 'two'):
                self.call(d, [('app.exe', pe(b'child.dll')), ('child.dll', pe()), ('init.tcl', b'source data/child.tcl'), ('data/child.tcl', ('# '+gen).encode())], dest=gen)
                inv = json.loads((d/'inventory.json').read_text())
                clo = json.loads((d/'closure.json').read_text())
                self.assertTrue(inv['complete'])
                self.assertEqual(inv['original']['sha256'], hashlib.sha256((d/'fixture.zip').read_bytes()).hexdigest())
                for item in inv['files']:
                    data = (d/gen/item['path']).read_bytes()
                    self.assertEqual(item['bytes'], len(data))
                    self.assertEqual(item['sha256'], hashlib.sha256(data).hexdigest())
                self.assertEqual(set(clo['modules']), {'app.exe','child.dll'})
                self.assertTrue(all(not m['unresolved'] for m in clo['modules'].values()))
                self.assertEqual(clo['literalSources']['checked'][0]['literal'], 'data/child.tcl')
                self.assertEqual((d/gen/'data/child.tcl').read_text(), '# '+gen)
            self.assertEqual((d/'one/data/child.tcl').read_text(), '# one')

    def test_04_ordinary_publication_failure(self):
        for old in (False, True):
            for target in ('inventory.json', 'closure.json'):
                d = self.setup_case('rollback-'+str(old)+'-'+target, old)
                before = self.state(d); real = r.os.replace
                def fail_new(src, dst):
                    if P(src).name == 'new-'+target:
                        raise OSError('independent ordinary publication failure '+target)
                    return real(src, dst)
                with patch.object(r.os, 'replace', side_effect=fail_new):
                    with self.assertRaisesRegex(OSError, 'independent ordinary publication failure'):
                        self.call(d, [('app.exe', pe())])
                self.unchanged_failure(d, before)

    def test_05_failed_next_generation_preserves_first(self):
        d = self.setup_case('generation-failure', False)
        self.call(d, [('app.exe', pe()), ('init.tcl', b'# first')], 'one')
        before = self.state(d)
        first = {str(p.relative_to(d/'one')): p.read_bytes() for p in (d/'one').rglob('*') if p.is_file()}
        real = r.os.replace
        def fail(src, dst):
            if P(src).name == 'new-closure.json': raise OSError('second generation failure')
            return real(src, dst)
        with patch.object(r.os, 'replace', side_effect=fail):
            with self.assertRaisesRegex(OSError, 'second generation failure'):
                self.call(d, [('app.exe', pe()), ('init.tcl', b'# second')], 'two')
        self.unchanged_failure(d, before, 'two')
        self.assertEqual(first, {str(p.relative_to(d/'one')):p.read_bytes() for p in (d/'one').rglob('*') if p.is_file()})


unittest.main(verbosity=2)
