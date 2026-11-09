"""Offline HTTP/TLS peer controls and the actual Q3 provision function.

python3 tools/q3-provider-upload.test.py --old-helper <retained client.py>
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
import os
import ssl
import subprocess

import runpy
provision_files = runpy.run_path(str(Path(__file__).with_name('q3-provider-upload.py')))['provision_files']

OLD = None
if '--old-helper' in sys.argv:
    i = sys.argv.index('--old-helper')
    path = Path(sys.argv[i+1]).resolve()
    del sys.argv[i:i+2]
    sys.path.insert(0, str(path.parent))
    spec = importlib.util.spec_from_file_location('old_transport', path)
    OLD = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(OLD)


@contextmanager
def peer(mode='ok', tls=False):
    seen, received = [], {}
    connections = set()
    peer.connections = connections
    lock = threading.Lock()
    lanes, release = threading.Event(), threading.Event()

    class Handler(BaseHTTPRequestHandler):
        protocol_version = 'HTTP/1.1'

        def setup(self):
            super().setup()
            connections.add(self.client_address)

        def log_message(self, *args):
            pass

        def do_PUT(self):
            with lock:
                seen.append(self.path)
                if len(seen) >= 2:
                    lanes.set()
            if mode in ('fail', 'fail-stall'):
                if self.path == '/1':
                    lanes.wait(3)
                    self.send_response(503)
                    self.send_header('Content-Length', '0')
                    self.end_headers()
                    return
                if mode == 'fail-stall':
                    release.wait(3)
                    return
                time.sleep(.2)  # keep both lanes busy until first fails
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
            if mode == 'response-stall':
                self.protocol_version = 'HTTP/1.0'  # detached response socket
            self.send_response(302 if mode == 'redirect' else 200)
            self.send_header('Content-Length', '10' if mode == 'response-stall' else '0')
            if mode == 'redirect':
                self.send_header('Location', '/replay')
            self.end_headers()
            if mode == 'response-stall':
                release.wait(3)

    server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    certdir = tempfile.TemporaryDirectory()
    previous_cert = os.environ.get('SSL_CERT_FILE')
    if tls:
        cert, key = Path(certdir.name)/'cert.pem', Path(certdir.name)/'key.pem'
        subprocess.run(['openssl','req','-x509','-newkey','rsa:2048','-nodes','-days','1',
                        '-subj','/CN=localhost','-addext','subjectAltName=IP:127.0.0.1',
                        '-keyout',str(key),'-out',str(cert)],check=True,capture_output=True)
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(cert,key)
        server.socket = context.wrap_socket(server.socket,server_side=True)
        os.environ['SSL_CERT_FILE'] = str(cert)
    # Explicitly join handlers on close, including stalled controls.
    server.daemon_threads = False
    thread = threading.Thread(target=server.serve_forever, kwargs={'poll_interval': .01})
    thread.start()
    try:
        yield ('https' if tls else 'http')+'://127.0.0.1:' + str(server.server_port), seen, received
    finally:
        release.set()
        server.shutdown()
        server.server_close()
        thread.join()
        if previous_cert is None:
            os.environ.pop('SSL_CERT_FILE',None)
        else:
            os.environ['SSL_CERT_FILE'] = previous_cert
        certdir.cleanup()


class UploadTests(unittest.TestCase):
    def test_https_held_write_and_held_response_are_absolute(self):
        for mode in ['stall','response-stall','fail-stall']:
            with tempfile.TemporaryDirectory() as directory, peer(mode,tls=True) as (base,seen,_):
                root=Path(directory);pins=self.pins(root,count=12,size=8*1024*1024)
                events=[];began=time.monotonic()
                with self.assertRaises(OSError):
                    self.upload(root,pins,base,timeout=.25,record=events.append)
                self.assertLess(time.monotonic()-began,1.5)
                self.assertLessEqual(len(seen),2)
                self.assertEqual(len(seen),len(set(seen)))
                self.assertTrue(any(e['event']=='error' for e in events))

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
            self.assertLessEqual(len(seen), 2, 'queued Q3 PUTs issued after terminal failure: '+repr(seen))
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
            self.assertEqual(len(seen), 2)
            self.assertEqual(len([e for e in events if e['event'] == 'start']), 2)
            self.assertEqual(len([e for e in events if e['event'] == 'error']), 2)

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

    def test_q3_actual_provision_barrier_and_terminal(self):
        import ast, gzip, json
        from types import SimpleNamespace
        source = Path(__file__).with_name('q3-native-inputs')/'control.py'
        module = ast.parse(source.read_text())
        fn = next(x for x in module.body if isinstance(x, ast.FunctionDef) and x.name == 'provision')
        for mode in ['ok', 'fail-stall']:
            with tempfile.TemporaryDirectory() as directory, peer(mode) as (base, seen, _):
                root = Path(directory); run = root/'run'; run.mkdir()
                pins = self.pins(root, count=24, size=8*1024*1024 if mode != 'ok' else 1)
                (root/'tools').mkdir()
                (root/'tools/q3-provider-upload.py').symlink_to(Path(__file__).with_name('q3-provider-upload.py').resolve())
                for p in [root/'runtime-pins.json.gz', run/'runtime-pins.json.gz', run/'lifecycle.json.gz']:
                    p.write_bytes(b'{}')
                barriers = []; urls = []
                def api(method, route, body):
                    urls.append(body['path']);return {'url': base+'/'+Path(body['path']).name}
                env = dict(Path=Path, ROOT=root, BASE=root, R=run, REMOTE='/owned', RUN='run', H=lambda b:hashlib.sha256(b).hexdigest(),
                           validate=lambda:dict(files=pins), box=lambda:'q3-local', c=SimpleNamespace(access=SimpleNamespace(api=api)),
                           gzip=gzip,json=json,remote=lambda *args:barriers.append(args))
                exec(compile(ast.Module(body=[fn], type_ignores=[]), str(source), 'exec'), env)
                if mode == 'ok':
                    env['provision']();self.assertEqual(len(barriers),2)
                    self.assertEqual(len(urls),27)
                else:
                    with self.assertRaises(OSError):env['provision']()
                    self.assertEqual(barriers,[]);self.assertEqual(len(urls),2)
                self.assertTrue((run/'uploads.jsonl.gz').exists())

    def test_reuses_one_connection_without_replay(self):
        with tempfile.TemporaryDirectory() as directory, peer() as (base, seen, received):
            root=Path(directory);pins=self.pins(root,count=20)
            # Actual accepted socket addresses distinguish connection reuse.
            self.upload(root,pins,base,workers=1)
            self.assertEqual(len(seen),20);self.assertEqual(len(received),20)
            self.assertEqual(len(peer.connections),1)


if __name__ == '__main__':
    unittest.main(verbosity=2)
