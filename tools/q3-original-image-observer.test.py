"""Virtual-clock capture polling; no browser, guest, or second original."""
from pathlib import Path
import gzip
import hashlib
import json
import runpy
import tempfile
import unittest
import zlib

module = runpy.run_path(str(Path(__file__).with_name('q3-original-image-observer.py')))


class ObserverTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.p = Path(self.temp.name)
        self.o = self.p / 'runtime'
        self.o.mkdir()
        self.plan = dict(prepared=self.p, output=self.o)
        self.now = 0
        self.publish_at = None
        self.cap = dict(label='startup', identity=dict(worker='owning-worker', module='exact-module'),
                        sha256=hashlib.sha256(b'full-image').hexdigest())

    def publish(self):
        (self.o / 'startup.png').write_bytes(b'full-image')
        (self.o / 'startup-state.json').write_text('{}')
        (self.o / 'startup-capture.json').write_text(json.dumps(self.cap))

    def sleep(self, delay):
        self.now += delay
        if self.publish_at is not None and self.now >= self.publish_at:
            self.publish()
            self.publish_at = None

    def poll(self, deadline=120):
        return module['poll'](self.plan, 'startup', deadline, 20,
                              clock=lambda: self.now, monotonic=lambda: self.now,
                              sleep=self.sleep)

    def budget(self, deadline):
        compressor = zlib.compressobj(wbits=31)
        data = compressor.compress((json.dumps(dict(startupDeadline=deadline * 1000))+'\n').encode())
        data += compressor.flush(zlib.Z_SYNC_FLUSH)  # Actual live stream, no EOF/footer.
        (self.o / 'startup-browser.jsonl.gz').write_bytes(data)

    def test_delayed_startup_after_old_50_second_cutoff(self):
        self.budget(120)
        self.publish_at = 75
        pending = 0
        while True:
            result = self.poll(480)
            if result['status'] == 'ready':
                break
            pending += 1
            self.assertTrue(result['noRuntimeFault'])
            self.assertEqual(result['owningDeadline'], 120)
            self.assertFalse((self.p / 'caller-cancelled.json').exists())
        self.assertEqual(pending, 3)
        self.assertGreaterEqual(self.now, 75)
        self.assertEqual(result['capture'], self.cap)

    def test_startup_deadline_is_not_extended(self):
        self.budget(51)
        self.now = 50
        with self.assertRaisesRegex(AssertionError, 'deadline expired'):
            self.poll(480)
        self.assertLess(self.now, 51.03)

    def test_runtime_deadline_is_not_extended(self):
        (self.p / 'runtime-identity.json.gz').write_bytes(gzip.compress(b'{"deadline": 1}'))
        with self.assertRaisesRegex(AssertionError, 'deadline expired'):
            self.poll()

    def test_sticky_terminal_precedes_ready_image(self):
        self.publish()
        for base, name in [(self.p, 'caller-cancelled.json'),
                           (self.o, 'first-browser-failure.json'),
                           (self.o, 'first-transport-failure.json'),
                           (self.o, 'first-failure.json')]:
            with self.subTest(name=name):
                path = base / name
                path.write_text('{}')
                with self.assertRaisesRegex(AssertionError, 'native terminal'):
                    self.poll()
                path.unlink()

    def test_wrong_capture_hash_fails(self):
        self.publish()
        (self.o / 'startup.png').write_bytes(b'changed')
        with self.assertRaisesRegex(AssertionError, 'capture SHA'):
            self.poll()

    def test_actual_payload_ready_and_layout_failure_cancel(self):
        root = self.p / 'source'
        tools = root / 'tools'
        tools.mkdir(parents=True)
        prepared = root / 'run/prepared'
        prepared.mkdir(parents=True)
        (prepared / 'lifecycle.json.gz').write_bytes(gzip.compress(
            json.dumps(dict(overallDeadline=__import__('time').time()+480)).encode()))
        output = prepared.parent / 'original/prepared/runtime'
        output.mkdir(parents=True)
        for name in ['startup.png', 'startup-state.json', 'startup-capture.json']:
            self.publish()
            (output / name).write_bytes((self.o / name).read_bytes())
        (tools / 'q3-phase-observer.py').write_text(
            "def layout(root, prepared, phase):\n return dict(prepared=prepared.parent/'original/prepared',output=prepared.parent/'original/prepared/runtime')\n")
        marker = root / 'cancelled'
        (tools / 'q3-native-launch-client.py').write_text(
            "from pathlib import Path\ndef cancel_remote(p,o):\n Path("+repr(str(marker))+").write_text(p+'\\n'+o)\n")
        import subprocess
        code = module['remote_code'](root, prepared, 'startup')
        result = subprocess.run(['python3', '-B', '-c', code], capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)['status'], 'ready')
        self.assertFalse(marker.exists())
        (tools / 'q3-phase-observer.py').write_text("raise RuntimeError('sealed layout failure')\n")
        result = subprocess.run(['python3', '-B', '-c', code], capture_output=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue(marker.exists())
        self.assertEqual(marker.read_text().splitlines(), [str(output.parent), str(output)])

    def test_payload_compiles_without_observer_upload(self):
        code = module['remote_code']('/source', '/source/run/prepared', 'startup')
        compile(code, '<remote>', 'exec')
        self.assertIn('def poll(', code)
        self.assertNotIn('q3-original-image-observer.py', code)


if __name__ == '__main__':
    unittest.main()
