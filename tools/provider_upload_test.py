"""Offline HTTP peer controls, optionally exercising the actual old helper.

python3 tools/provider_upload_test.py --old-helper <retained transport.py>
must FAIL the post-failure dispatch and bounded-memory contracts.
"""
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import importlib.util
from pathlib import Path
import sys
import tempfile
import threading
import time
import tracemalloc
import unittest

from provider_upload import provision_files

OLD = None
RECIPE = None
if '--recipe' in sys.argv:
    i = sys.argv.index('--recipe')
    RECIPE = Path(sys.argv[i+1]).resolve()
    del sys.argv[i:i+2]
if '--old-helper' in sys.argv:
    i = sys.argv.index('--old-helper')
    path = Path(sys.argv[i+1]).resolve()
    del sys.argv[i:i+2]
    sys.path.insert(0, str(path.parent))
    spec = importlib.util.spec_from_file_location('old_transport', path)
    OLD = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(OLD)


@contextmanager
def peer(mode='ok'):
    seen, received = [], {}
    lock = threading.Lock()
    eight, release = threading.Event(), threading.Event()

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def do_PUT(self):
            with lock:
                seen.append(self.path)
                if len(seen) >= 8:
                    eight.set()
            if mode in ('fail', 'fail-stall'):
                if self.path == '/7':
                    eight.wait(3)
                    self.send_response(503)
                    self.send_header('Content-Length', '0')
                    self.end_headers()
                    return
                if mode == 'fail-stall':
                    release.wait(3)
                    return
                time.sleep(.2)  # keep all eight workers busy until first fails
            if mode == 'stall':
                # Never consume the large request: force a blocked socket write.
                release.wait(3)
                return
            size, digest = 0, hashlib.sha256()
            remaining = int(self.headers['Content-Length'])
            while remaining:
                block = self.rfile.read(min(65536, remaining))
                if not block:
                    return
                size += len(block)
                digest.update(block)
                remaining -= len(block)
            received[self.path] = (size, digest.hexdigest())
            self.send_response(302 if mode == 'redirect' else 200)
            self.send_header('Content-Length', '10' if mode == 'response-stall' else '0')
            if mode == 'redirect':
                self.send_header('Location', '/replay')
            self.end_headers()
            if mode == 'response-stall':
                release.wait(3)

    server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    # Explicitly join handlers on close, including stalled controls.
    server.daemon_threads = False
    thread = threading.Thread(target=server.serve_forever, kwargs={'poll_interval': .01})
    thread.start()
    try:
        yield 'http://127.0.0.1:' + str(server.server_port), seen, received
    finally:
        release.set()
        server.shutdown()
        server.server_close()
        thread.join()


class UploadTests(unittest.TestCase):
    def pins(self, root, count=1, size=1):
        pins = []
        for i in range(count):
            path = root / str(i)
            with path.open('wb') as stream:
                stream.truncate(size)  # synthetic sparse input, never game media
            digest = hashlib.sha256()
            with path.open('rb') as stream:
                while block := stream.read(65536):
                    digest.update(block)
            pins.append(dict(path=str(i), size=size, sha256=digest.hexdigest()))
        return pins

    def upload(self, root, pins, base, **kwargs):
        if OLD:
            OLD.ROOT = '/owned'
            OLD.box_id = lambda: 'local-peer'
            OLD.access.api = lambda method, route, body: dict(url=base+'/'+Path(body['path']).name)
            # Exact 0558 production transfer and pool shape, including read_bytes.
            def transfer(pin):
                data = (root/pin['path']).read_bytes()
                assert len(data) == pin['size'] and hashlib.sha256(data).hexdigest() == pin['sha256']
                OLD.upload('/owned/'+pin['path'], data)
            with ThreadPoolExecutor(max_workers=8) as pool:
                list(pool.map(transfer, pins))
        else:
            provision_files(root, pins, '/owned', lambda path: base+'/'+Path(path).name, **kwargs)

    def test_failure_stops_queued_puts_and_settles(self):
        with tempfile.TemporaryDirectory() as directory, peer('fail') as (base, seen, _):
            root = Path(directory)
            pins = self.pins(root, count=24)
            with self.assertRaises(Exception):
                self.upload(root, pins, base)
            self.assertLessEqual(len(seen), 8, 'queued PUTs issued after terminal failure: '+repr(seen))
            self.assertEqual(len(seen), len(set(seen)), 'automatic replay')

    def test_large_stream_is_bounded_and_exact(self):
        with tempfile.TemporaryDirectory() as directory, peer() as (base, seen, received):
            root = Path(directory)
            pins = self.pins(root, size=32*1024*1024)
            tracemalloc.start()
            try:
                self.upload(root, pins, base)
                _, peak = tracemalloc.get_traced_memory()
            finally:
                tracemalloc.stop()
            self.assertEqual(received['/0'], (pins[0]['size'], pins[0]['sha256']))
            print('STREAM_PEAK_BYTES', peak, flush=True)
            self.assertLess(peak, 2*1024*1024)
            self.assertEqual(seen, ['/0'])

    @unittest.skipIf(OLD, 'old socket cap is immutable90s; shortened control tests new helper')
    def test_blocked_write_deadline_no_replay(self):
        with tempfile.TemporaryDirectory() as directory, peer('stall') as (base, seen, _):
            root = Path(directory)
            pins = self.pins(root, count=2, size=16*1024*1024)
            events = []
            began = time.monotonic()
            with self.assertRaises((OSError, TimeoutError)):
                self.upload(root, pins, base, workers=1, timeout=.15, record=events.append)
            self.assertLess(time.monotonic()-began, 1)
            self.assertEqual(seen, ['/0'])
            self.assertEqual([e['event'] for e in events], ['start', 'error'])

    @unittest.skipIf(OLD, 'new active socket cancellation control')
    def test_first_error_interrupts_other_blocked_writers(self):
        with tempfile.TemporaryDirectory() as directory, peer('fail-stall') as (base, seen, _):
            root = Path(directory)
            pins = self.pins(root, count=24, size=8*1024*1024)
            events = []
            began = time.monotonic()
            with self.assertRaises(OSError):
                self.upload(root, pins, base, record=events.append)
            self.assertLess(time.monotonic()-began, 1.5)
            self.assertEqual(len(seen), 8)
            self.assertEqual(len([e for e in events if e['event'] == 'start']), 8)
            self.assertEqual(len([e for e in events if e['event'] == 'error']), 8)

    @unittest.skipIf(OLD, 'new absolute response deadline control')
    def test_detached_response_socket_is_cancelled(self):
        with tempfile.TemporaryDirectory() as directory, peer('response-stall') as (base, seen, _):
            root = Path(directory)
            pins = self.pins(root)
            began = time.monotonic()
            with self.assertRaises((OSError, TimeoutError)):
                self.upload(root, pins, base, timeout=.15)
            self.assertLess(time.monotonic()-began, 1)
            self.assertEqual(seen, ['/0'])

    @unittest.skipIf(OLD, 'new preflight/redirect controls')
    def test_pin_mismatch_has_no_remote_effect(self):
        with tempfile.TemporaryDirectory() as directory, peer() as (base, seen, _):
            root = Path(directory)
            pins = self.pins(root)
            (root/'0').write_bytes(b'changed')
            with self.assertRaises(ValueError):
                self.upload(root, pins, base)
            self.assertEqual(seen, [])

    @unittest.skipIf(OLD, 'new strict no redirect control')
    def test_redirect_is_not_replayed(self):
        with tempfile.TemporaryDirectory() as directory, peer('redirect') as (base, seen, _):
            root = Path(directory)
            with self.assertRaises(OSError):
                self.upload(root, self.pins(root), base)
            self.assertEqual(seen, ['/0'])

    @unittest.skipUnless(RECIPE, 'pass --recipe for actual ignored recovery composition')
    def test_actual_recovery_branch_keeps_barrier_after_all_uploads(self):
        import json
        from unittest.mock import patch
        spec = importlib.util.spec_from_file_location('actual_recovery', RECIPE)
        recipe = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(recipe)
        for mode in ['ok', 'fail']:
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as directory, peer(mode) as (base, seen, _):
                root = Path(directory)
                run = root/'scratch/runs/fixture'
                (run/'native-production').mkdir(parents=True)
                pins = self.pins(root, count=24 if mode == 'fail' else 1)
                (run/'runtime-pins.json').write_text(json.dumps(dict(files=pins)))
                for name in ['boat-created.json', 'lifecycle.json', 'native-production/runtime-pins.json']:
                    (run/name).write_text('{}')
                recipe.ROOT, recipe.R, recipe.RUN = root, run, 'scratch/runs/fixture'
                recipe.barrier = lambda: dict(exact=True)
                recipe.t.box_id = lambda: 'local-peer'
                recipe.t.access.api = lambda method, route, body: dict(url=base+'/'+Path(body['path']).name)
                barriers = []
                def remote(*args):
                    barriers.append(args)
                    return dict(stdout=json.dumps(dict(exact=True)))
                recipe.remote = remote
                with patch.object(sys, 'argv', [str(RECIPE), 'provision']), patch.object(recipe.runpy, 'run_path', return_value={'provision_files': provision_files}):
                    if mode == 'fail':
                        with self.assertRaises(OSError):
                            recipe.main()
                        self.assertEqual(barriers, [])
                        self.assertLessEqual(len(seen), 8)
                    else:
                        recipe.main()
                        self.assertEqual(len(barriers), 1)
                        self.assertEqual(len(seen), 4)
                self.assertTrue((run/'provider-upload-events.jsonl').exists())


if __name__ == '__main__':
    unittest.main(verbosity=2)
