#!/usr/bin/env python3
"""Tiny synthetic PE fixtures only; never execute or acquire original media."""
import importlib.util
import json
import struct
import sys
import tempfile
import unittest
import zlib
from pathlib import Path
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[1]/'tools/recovery/gltron-original-win32-recovery-oct28.py'
spec = importlib.util.spec_from_file_location('recovery', SOURCE)
r = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r)


class Publication(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root/'extracted/app').mkdir(parents=True)
        self.data = bytearray(128)
        self.data[:2] = b'MZ'
        struct.pack_into('<I', self.data, 60, 64)
        self.data[64:68] = b'PE\0\0'
        struct.pack_into('<H', self.data, 68, 0x14c)
        struct.pack_into('<H', self.data, 88, 0x10b)
        self.update()

    def update(self):
        (self.root/'extracted/app/gltron.exe').write_bytes(self.data)
        (self.root/'inno-list.txt').write_text(
            'Listing "GLtron version 0.70" - setup data version 2.0.18\n'
            f' - "app/gltron.exe" (128 B) Adler32 0x{zlib.adler32(self.data):08x}\nDone.\n')

    def analyze(self, imports=' DLL Name: KERNEL32.dll\n', module=r):
        with patch.object(module, 'verify'), patch.object(module, 'tool', return_value=imports):
            return module.analyze(self.root/'original.exe')

    def pair(self):
        return {name: (self.root/name).read_bytes() if (self.root/name).exists() else None
                for name in ('inventory.json', 'closure.json')}

    def assert_clean(self):
        self.assertFalse(list(self.root.glob('.analysis-pair-*')))

    def test_success_and_successful_reanalysis(self):
        self.analyze()
        before = self.pair()
        self.data[-1] = 1
        self.update()
        result = self.analyze(' DLL Name: USER32.dll\n')
        after = self.pair()
        self.assertTrue(all(after.values()))
        self.assertTrue(all(before[k] != after[k] for k in before))
        self.assertEqual(json.loads(after['closure.json']), result)
        self.assert_clean()

    def rejection(self, module=r, existing=False):
        if existing:
            self.analyze(module=module)
        before = self.pair()
        self.data[-1] = 2
        self.update()
        with self.assertRaisesRegex(ValueError, 'rejected-closure.json'):
            self.analyze(' DLL Name: rejected-B.dll\n', module)
        self.assertEqual(before, self.pair())
        rejected = json.loads((self.root/'rejected-closure.json').read_bytes())
        self.assertEqual(rejected['unresolved'][0]['dll'], 'rejected-B.dll')
        self.assert_clean()

    def test_unresolved_fresh(self):
        self.rejection()

    def test_unresolved_existing(self):
        self.rejection(existing=True)

    def test_checksum_and_malformed_pe_preserve_pair(self):
        for existing in (False, True):
            if existing:
                self.analyze()
            before = self.pair()
            for kind in ('checksum', 'PE'):
                with self.subTest(existing=existing, kind=kind):
                    if kind == 'checksum':
                        (self.root/'extracted/app/gltron.exe').write_bytes(b'tamper')
                    else:
                        self.data[:2] = b'XX'
                        self.update()
                    with self.assertRaises(ValueError):
                        self.analyze()
                    self.assertEqual(before, self.pair())
                    self.data[:2] = b'MZ'
                    self.update()

    def test_stage_write_errors(self):
        for existing in (False, True):
            if existing:
                self.analyze()
            before = self.pair()
            # Each prepared file write, including the backups, may fail.
            for fail_at in range(1, 5 if existing else 3):
                count = 0
                write = Path.write_bytes

                def faulty(path, content):
                    nonlocal count
                    if path.parent.name.startswith('.analysis-pair-'):
                        count += 1
                        if count == fail_at:
                            # A partial staged write must not affect publication.
                            write(path, content[:1])
                            raise OSError('injected stage write error')
                    return write(path, content)

                with self.subTest(existing=existing, fail_at=fail_at):
                    with patch.object(Path, 'write_bytes', faulty):
                        with self.assertRaisesRegex(OSError, 'stage write'):
                            self.analyze()
                    self.assertEqual(before, self.pair())
                    self.assert_clean()

    def test_replace_errors(self):
        for existing in (False, True):
            if existing:
                self.analyze()
            before = self.pair()
            self.data[-1] += 1
            self.update()
            for fail_at in (1, 2):
                count = 0
                replace = r.os.replace

                def faulty(src, dst):
                    nonlocal count
                    count += 1
                    if count == fail_at:
                        raise OSError('injected replace error')
                    return replace(src, dst)

                with self.subTest(existing=existing, fail_at=fail_at):
                    with patch.object(r.os, 'replace', faulty):
                        with self.assertRaisesRegex(OSError, 'replace error'):
                            self.analyze()
                    self.assertEqual(before, self.pair())
                    self.assert_clean()

    def test_weakened_mixed_generation_mutation_is_rejected(self):
        text = SOURCE.read_text()
        needle = "    if result['unresolved']:\n"
        self.assertEqual(text.count(needle), 1)
        mutant = text.replace(needle,
            "    (root/'closure.json').write_text(json.dumps(result,indent=2))\n" + needle)
        from types import ModuleType
        module = ModuleType('mixed_generation_mutant')
        exec(compile(mutant, str(SOURCE)+'[mutation]', 'exec'), module.__dict__)
        with self.assertRaises(AssertionError):
            self.rejection(module=module, existing=True)

    def test_rollback_failure_retains_recovery_and_cause(self):
        self.analyze()
        before = self.pair()
        self.data[-1] = 3
        self.update()
        count = 0
        replace = r.os.replace

        def faulty(src, dst):
            nonlocal count
            count += 1
            if count >= 2:
                raise OSError('injected persistent replace failure')
            return replace(src, dst)

        with patch.object(r.os, 'replace', faulty):
            with self.assertRaisesRegex(RuntimeError, 'rollback failed; recovery in') as error:
                self.analyze()
        self.assertIsInstance(error.exception.__cause__, OSError)
        stages = list(self.root.glob('.analysis-pair-*'))
        self.assertEqual(len(stages), 1)
        self.assertEqual((stages[0]/'inventory.json.old').read_bytes(), before['inventory.json'])
        self.assertEqual((stages[0]/'closure.json.old').read_bytes(), before['closure.json'])
        # Demonstrate the explicit manual recovery after the filesystem recovers.
        for name in before:
            replace(stages[0]/(name+'.old'), self.root/name)
        self.assertEqual(before, self.pair())


if __name__ == '__main__':
    unittest.main(verbosity=2)
