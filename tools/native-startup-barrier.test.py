"""Exercise the real queue boundary; refusal must precede any request side effect."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("barrier", Path(__file__).with_name("native-startup-barrier.py"))
barrier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(barrier)


class StartupBoundary(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.manifest = self.root / "pins.json"
        self.receipt = self.root / "ready.json"
        self.request = self.root / "request.json"
        self.provider = self.root / "browser.cjs"
        self.data = b"original browser launcher"
        self.pins = dict(files=[dict(path="browser.cjs", size=len(self.data), sha256=hashlib.sha256(self.data).hexdigest())])
        self.manifest.write_text(json.dumps(self.pins))

    def queue(self):
        barrier.require(self.root, self.manifest, self.receipt)
        with self.request.open("x") as f:
            f.write("one launch")

    def ready(self):
        self.provider.write_bytes(self.data)
        barrier.publish(self.root, self.manifest, self.receipt)

    def refused(self):
        with self.assertRaises((OSError, ValueError)):
            self.queue()
        self.assertFalse(self.request.exists())

    def test_observed_race_no_receipt_even_if_some_providers_exist(self):
        self.provider.write_bytes(self.data)
        self.refused()

    def test_missing_provider_cannot_publish(self):
        with self.assertRaises(FileNotFoundError):
            barrier.publish(self.root, self.manifest, self.receipt)
        self.assertFalse(self.receipt.exists())
        self.refused()

    def test_valid_staging_allows_one_request_only(self):
        self.ready()
        self.queue()
        with self.assertRaises(FileExistsError):
            self.queue()

    def test_changed_same_size_provider_is_refused(self):
        self.ready()
        self.provider.write_bytes(b"x" * len(self.data))
        self.refused()

    def test_removed_provider_is_refused(self):
        self.ready()
        self.provider.unlink()
        self.refused()

    def test_changed_manifest_generation_is_refused(self):
        self.ready()
        self.manifest.write_text(json.dumps(self.pins, indent=2))
        self.refused()

    def test_partial_receipt_is_refused(self):
        self.provider.write_bytes(self.data)
        self.receipt.write_text('{"version":')
        self.refused()

    def test_cannot_overwrite_earlier_receipt(self):
        self.ready()
        with self.assertRaises(FileExistsError):
            barrier.publish(self.root, self.manifest, self.receipt)

    def test_empty_manifest_refused(self):
        self.manifest.write_text('{"files":[]}')
        with self.assertRaises(ValueError):
            barrier.publish(self.root, self.manifest, self.receipt)

    def test_escape_and_duplicate_refused(self):
        self.provider.write_bytes(self.data)
        for files in [[dict(self.pins['files'][0], path='../escape')], self.pins['files'] * 2]:
            self.manifest.write_text(json.dumps(dict(files=files)))
            with self.assertRaises((ValueError, OSError)):
                barrier.publish(self.root, self.manifest, self.receipt)
        self.assertFalse(self.receipt.exists())

    def test_parent_rechecks_before_consuming_request(self):
        self.ready()
        self.queue()
        self.provider.write_bytes(b"incomplete upload")
        with self.assertRaises(ValueError):
            barrier.require(self.root, self.manifest, self.receipt)
            self.request.rename(self.root / 'consumed.json')
        self.assertTrue(self.request.exists())
        self.assertFalse((self.root / 'consumed.json').exists())


if __name__ == '__main__':
    unittest.main()
