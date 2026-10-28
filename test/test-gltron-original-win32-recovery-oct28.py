"""Adversarial controls before the one official acquisition attempt."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

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


if __name__ == '__main__':
    unittest.main(verbosity=2)
