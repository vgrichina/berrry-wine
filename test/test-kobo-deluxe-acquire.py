#!/usr/bin/env python3
"""Local-only sequencing tests; no downloaded PE or real network execution."""
import importlib.util
import io
import json
import pathlib
import tempfile
import unittest
import urllib.error
from unittest.mock import patch

SCRIPT = pathlib.Path(__file__).resolve().parents[1] / 'tools/kobo-deluxe-acquire.py'
spec = importlib.util.spec_from_file_location('kobo_acquire', SCRIPT)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
URL = 'https://olofson.net/kobodl/download/KoboDeluxe-0.5.1-Win32-bin.zip'


class Response(io.BytesIO):
    def __init__(self, content=b'', headers=None, url=URL):
        super().__init__(content)
        self.headers = headers or {}
        self.url = url
        self.status = 200


class Tests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='kobo-deluxe-', dir=SCRIPT.parents[2])
        self.addCleanup(self.temp.cleanup)
        self.root = pathlib.Path(self.temp.name)
        self.dest = self.root/'original.zip'

    def test_actual_child_exit_and_sentinel(self):
        mod.self_test(self.root)
        r = json.loads((self.root/'sequence-negative.json').read_text())
        self.assertEqual(set(r), {'metadata', 'bytes'})
        self.assertTrue(all(x['exit_code'] != 0 and x['sentinel_absent'] for x in r.values()))

    def test_head_403_no_get(self):
        with patch.object(mod.urllib.request, 'urlopen', side_effect=urllib.error.HTTPError(URL, 403, 'Forbidden', {}, None)) as req:
            with self.assertRaises(urllib.error.HTTPError):
                mod.acquire(URL, self.dest, 64)
        self.assertEqual(req.call_count, 1)
        self.assertFalse(self.dest.exists())
        r = json.loads(self.dest.with_name('original.zip.failure.json').read_text())
        self.assertEqual(r['http_status'], 403)

    def test_metadata_overflow_no_get(self):
        with patch.object(mod.urllib.request, 'urlopen', return_value=Response(headers={'Content-Length':'65'})) as req:
            with self.assertRaisesRegex(ValueError, 'byte guard'):
                mod.acquire(URL, self.dest, 64)
        self.assertEqual(req.call_count, 1)
        self.assertFalse(self.dest.exists())

    def test_stream_overflow_without_length(self):
        with patch.object(mod.urllib.request, 'urlopen', side_effect=[Response(), Response(b'x'*65)]):
            with self.assertRaisesRegex(ValueError, 'byte guard'):
                mod.acquire(URL, self.dest, 64)
        self.assertLessEqual(self.dest.stat().st_size, 64)
        self.assertFalse(self.dest.with_name('original.zip.receipt.json').exists())

    def test_digest_rejection(self):
        with patch.object(mod.urllib.request, 'urlopen', side_effect=[Response(), Response(b'fixture')]):
            with self.assertRaisesRegex(ValueError, 'SHA256 mismatch'):
                mod.acquire(URL, self.dest, 64, '0'*64)
        self.assertFalse(self.dest.with_name('original.zip.receipt.json').exists())

    def test_bounded_success(self):
        import hashlib
        digest = hashlib.sha256(b'fixture').hexdigest()
        with patch.object(mod.urllib.request, 'urlopen', side_effect=[Response(headers={'Content-Length':'7'}), Response(b'fixture')]):
            r = mod.acquire(URL, self.dest, 64, digest)
        self.assertEqual(r['sha256'], digest)
        self.assertEqual(r['bytes'], 7)
        self.assertTrue(self.dest.with_name('original.zip.receipt.json').exists())


if __name__ == '__main__':
    unittest.main()
