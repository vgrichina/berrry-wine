"""Adversarial controls before the one official acquisition attempt."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import json
import struct
import zlib

spec = importlib.util.spec_from_file_location('recovery', Path(__file__).parents[1] / 'tools/recovery/gltron-original-win32-recovery-oct28.py')
r = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r)


class RecoveryGuards(unittest.TestCase):
    def test_rejected_hash_and_size_propagate_without_dependent_sentinel(self):
        with tempfile.TemporaryDirectory() as tmp:
            p, sentinel = Path(tmp)/'bad.exe', Path(tmp)/'download-sentinel'
            for oversized in (False, True):
                with p.open('wb') as f:
                    if oversized:
                        pass  # Empty archives exercise the size/type rejection.
                    else:
                        f.write(b'not the original distribution')
                with self.assertRaisesRegex(ValueError, 'size/type' if oversized else 'SHA256'):
                    r.sequence(lambda: r.verify(p), lambda accepted: sentinel.touch())
                self.assertFalse(sentinel.exists())
            for size, sha in ((r.MAX_ARCHIVE+1, r.SHA256), (1, '0'*64)):
                with self.assertRaisesRegex(ValueError, 'metadata rejected'):
                    r.sequence(lambda: r.metadata_guard(size, sha), lambda accepted: sentinel.touch())
                self.assertFalse(sentinel.exists())

    def test_inno_real_format_and_rounding(self):
        text = 'Listing "GLtron version 0.70" - setup data version 2.0.18\n - "app/gltron.exe" (176 KiB) Adler32 0x95c9d939\nDone.\n'
        self.assertEqual(r.inno_plan(text)['expandedUpperBytes'], 177*1024)
        with tempfile.TemporaryDirectory() as tmp:
            sentinel = Path(tmp)/'extraction-sentinel'
            for bad in (text.replace('app/gltron.exe','app/../escape'),
                        text.replace('176 KiB','13 MiB'),
                        text.replace('2.0.18','6.0.5'),
                        text.replace('Done.','Symlink = /tmp/victim\nDone.'),
                        text.replace('Done.', ' - "app/GLTRON.exe" (1 B) Adler32 0x00000001\nDone.'),
                        text.replace('Done.', '\n'.join(f' - "app/bomb{i}" (12 MiB) Adler32 0x00000001' for i in range(3))+'\nDone.')):
                with self.assertRaises(ValueError):
                    r.sequence(lambda: r.inno_plan(bad),lambda _: sentinel.touch())
                self.assertFalse(sentinel.exists())

    def test_dump_mapping_is_complete_before_any_move(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            raw = folder/'{app}\\data\\x.dat'
            raw.write_bytes(b'data')
            listing = {'files':[{'path':'app/data/x.dat'}]}
            extra = folder/'{app}\\..\\escape'
            extra.write_bytes(b'bad')
            with self.assertRaises(ValueError):
                r.normalize_dump(folder,listing)
            self.assertTrue(raw.exists())
            self.assertFalse((folder/'app').exists())
            extra.unlink()
            r.normalize_dump(folder,listing)
            self.assertEqual((folder/'app/data/x.dat').read_bytes(), b'data')
            self.assertFalse(raw.exists())
            r.normalize_dump(folder,listing)  # interrupted/same-task recovery is idempotent

    def test_pe_rejects_truncated_and_wrong_machine(self):
        import struct
        for data in (b'MZ', b'not a PE'):
            with self.assertRaises(ValueError):
                r.pe_machine(data)
        data = bytearray(128)
        data[:2] = b'MZ'
        struct.pack_into('<I',data,60,64)
        data[64:68] = b'PE\0\0'
        struct.pack_into('<H',data,68,0x8664)
        struct.pack_into('<H',data,88,0x20b)
        with self.assertRaisesRegex(ValueError,'x86 PE32'):
            r.pe_machine(data)

    def test_inventory_rejects_tamper_missing_and_symlink(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            folder = root/'extracted'
            folder.mkdir()
            f = folder/'x'
            listing = {'files':[{'path':'x','upperBytes':4,'adler32':r.zlib.adler32(b'good')}]}
            with self.assertRaisesRegex(ValueError,'incomplete'):
                r.inspect_payload(folder,listing,root)
            f.write_bytes(b'evil')
            with self.assertRaisesRegex(ValueError,'Adler32'):
                r.inspect_payload(folder,listing,root)
            f.unlink()
            f.symlink_to(root/'elsewhere')
            with self.assertRaisesRegex(ValueError,'link'):
                r.inspect_payload(folder,listing,root)
            self.assertFalse((root/'inventory.json').exists())


class AnalysisPublication(unittest.TestCase):
    """Tiny owned fixtures isolate validation; immutable CLI is checked separately."""

    def fixture(self, root):
        folder = root/'extracted/app'
        folder.mkdir(parents=True)
        pe = bytearray(128)
        pe[:2] = b'MZ'
        struct.pack_into('<I', pe, 60, 64)
        pe[64:68] = b'PE\0\0'
        struct.pack_into('<H', pe, 68, 0x14c)
        struct.pack_into('<H', pe, 88, 0x10b)
        (folder/'gltron.exe').write_bytes(pe)
        (root/'inno-list.txt').write_text(
            'Listing "GLtron version 0.70" - setup data version 2.0.18\n'
            f' - "app/gltron.exe" (128 B) Adler32 0x{zlib.adler32(pe):08x}\nDone.\n')
        (root/'unrelated.txt').write_bytes(b'preserve me')
        return folder/'gltron.exe'

    def test_all_validation_failures_leave_no_new_inventory(self):
        for stage in ('hash', 'listing', 'payload', 'pe', 'tool', 'imports', 'closure'):
            for preexisting in (False, True):
                with self.subTest(stage=stage, preexisting=preexisting), tempfile.TemporaryDirectory() as tmp:
                    root = Path(tmp)
                    pe = self.fixture(root)
                    old = b'unrelated existing inventory'
                    if preexisting:
                        (root/'inventory.json').write_bytes(old)
                    if stage == 'listing':
                        (root/'inno-list.txt').write_text('invalid listing')
                    if stage == 'payload':
                        pe.write_bytes(b'tampered')
                    if stage == 'pe':
                        original = pe.read_bytes()
                        data = original.replace(b'MZ', b'XX', 1)
                        pe.write_bytes(data)
                        listing = root/'inno-list.txt'
                        listing.write_text(listing.read_text().replace(
                            f'0x{zlib.adler32(original):08x}', f'0x{zlib.adler32(data):08x}'))
                    text = '' if stage == 'imports' else ' DLL Name: missing.dll\n' if stage == 'closure' else ' DLL Name: KERNEL32.dll\n'
                    with patch.object(r, 'verify', side_effect=ValueError('archive SHA256 rejected') if stage == 'hash' else None), patch.object(r, 'tool', side_effect=ValueError('static tool rejected') if stage == 'tool' else None, return_value=text):
                        with self.assertRaises(ValueError):
                            r.analyze(root/'original.exe')
                    if preexisting:
                        self.assertEqual((root/'inventory.json').read_bytes(), old)
                    else:
                        self.assertFalse((root/'inventory.json').exists())
                    self.assertEqual((root/'unrelated.txt').read_bytes(), b'preserve me')
                    if stage == 'closure':
                        self.assertEqual(json.loads((root/'rejected-closure.json').read_text())['unresolved'], [{'module':'app/gltron.exe', 'dll':'missing.dll'}])
                    self.assertFalse((root/'closure.json').exists())

    def test_success_publishes_consistent_inventory_and_closure(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            pe = self.fixture(root)
            def tool(*args):
                # No output may be published before the last validation step.
                self.assertFalse((root/'inventory.json').exists())
                self.assertFalse((root/'closure.json').exists())
                return ' DLL Name: KERNEL32.dll\n'
            with patch.object(r, 'verify'), patch.object(r, 'tool', side_effect=tool):
                result = r.analyze(root/'original.exe')
            inventory = json.loads((root/'inventory.json').read_text())
            closure = json.loads((root/'closure.json').read_text())
            self.assertEqual(closure, result)
            self.assertEqual(closure['unresolved'], [])
            self.assertEqual(inventory['count'], 1)
            self.assertEqual(inventory['files'][0]['path'], closure['modules'][0]['path'])
            self.assertEqual(inventory['files'][0]['sha256'], r.hashlib.sha256(pe.read_bytes()).hexdigest())
            self.assertEqual(closure['modules'][0]['imports'][0]['resolution'], 'Windows system')

    def test_extraction_inventory_contract_is_preserved(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.fixture(root)
            listing = r.inno_plan((root/'inno-list.txt').read_text())
            inventory = r.inspect_payload(root/'extracted', listing, root)
            self.assertEqual(json.loads((root/'inventory.json').read_text()), inventory)


if __name__ == '__main__':
    unittest.main(verbosity=2)
