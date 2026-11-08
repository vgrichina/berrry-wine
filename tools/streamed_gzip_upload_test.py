"""Real HTTP PUT sink controls; no persistent decompressed fixture files."""
import ast
import builtins
import gzip
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import urllib.request
from unittest.mock import patch

from streamed_gzip_upload import CHUNK, upload_gzip, validate, validated_chunks
from darkstone_streamed_restore import canonical_pair, restore_pair, FINAL

ROOT = Path(__file__).resolve().parents[1]
SERVER = r'''
from http.server import BaseHTTPRequestHandler, HTTPServer
import hashlib,json,socket
records={}
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*a):pass
 def do_PUT(self):
  if self.headers.get('Transfer-Encoding') or not self.headers.get('Content-Length'):
   self.send_error(411);return
  if self.path.endswith('/disconnect'):
   self.connection.shutdown(socket.SHUT_RDWR);self.connection.close();return
  n=int(self.headers['Content-Length']);h=hashlib.sha256();total=0
  limit=n//2 if self.path.endswith('/partial') else n
  while total<limit:
   b=self.rfile.read(min(65536,limit-total))
   if not b:break
   total+=len(b);h.update(b)
  records[self.path]=dict(size=total,sha256=h.hexdigest(),length=n)
  if self.path.endswith('/error'):self.send_error(503);return
  if self.path.endswith('/redirect'):
   self.send_response(307);self.send_header('Location','/replayed');self.end_headers();return
  self.send_response(200);self.end_headers()
 def do_GET(self):
  b=json.dumps(records).encode();self.send_response(200)
  self.send_header('Content-Length',str(len(b)));self.end_headers();self.wfile.write(b)
s=HTTPServer(('127.0.0.1',0),Handler)
print(s.server_port,flush=True);s.serve_forever()
'''


def pin(data):
    return dict(size=len(data), sha256=hashlib.sha256(data).hexdigest())


class StreamTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = subprocess.Popen([sys.executable, '-u', '-c', SERVER],
                                      stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        cls.base = 'http://127.0.0.1:' + cls.server.stdout.readline().decode().strip()

    @classmethod
    def tearDownClass(cls):
        cls.server.terminate()
        try:
            out, err = cls.server.communicate(timeout=3)
        except subprocess.TimeoutExpired:
            cls.server.kill()
            cls.server.communicate(timeout=3)
            raise AssertionError('sink missed bounded TERM drain')
        assert cls.server.returncode == -15, cls.server.returncode
        assert not out and not err, (out, err)
        print('SINK actual terminal WAIT=-15; pipes drained; no children spawned', flush=True)

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=os.environ.get('STREAM_TEST_TMP'))
        self.addCleanup(self.temp.cleanup)
        self.source = Path(self.temp.name) / 'source.gz'
        self.data = b'bounded transport fixture\x00' * 10000
        self.compressed = gzip.compress(self.data, mtime=0)
        self.source.write_bytes(self.compressed)
        self.rawpin, self.zippin = pin(self.data), pin(self.compressed)
        self.route = '/' + self.id().split('.')[-1]
        self.remote_calls = 0

    def records(self):
        with urllib.request.urlopen(self.base, timeout=2) as response:
            return json.load(response)

    def remote(self):
        self.remote_calls += 1
        return self.records()[self.route]

    def upload(self, **kwargs):
        return upload_gzip(self.source, self.rawpin, self.zippin,
                           lambda: self.base + self.route, self.remote, timeout=2, **kwargs)

    def test_real_put_exact_length_no_chunked(self):
        receipt = self.upload()
        self.assertTrue(receipt['accepted'])
        self.assertEqual(self.remote_calls, 1)
        self.assertEqual(self.records()[self.route]['length'], len(self.data))
        self.assertLessEqual(max(map(len, validated_chunks(self.source, self.rawpin, self.zippin))), CHUNK)

    def test_corruption_truncation_crc_footer_trailing_and_oversize_before_url(self):
        cases = [self.compressed[:-1], self.compressed[:-8],
                 self.compressed[:-8] + bytes([self.compressed[-8] ^ 1]) + self.compressed[-7:],
                 self.compressed[:-4] + b'\x00' * 4,
                 self.compressed + b'garbage', self.compressed + self.compressed,
                 gzip.compress(self.data + b'oversize', mtime=0)]
        for blob in cases:
            with self.subTest(size=len(blob)):
                self.source.write_bytes(blob)
                with self.assertRaises((ValueError, __import__('zlib').error)):
                    upload_gzip(self.source, self.rawpin, pin(blob),
                                lambda: self.fail('URL requested before validation'), self.remote)
        self.assertEqual(self.remote_calls, 0)

    def test_wrong_raw_or_compressed_pins(self):
        for raw, zipped in [(dict(self.rawpin, sha256='0'*64), self.zippin),
                            (dict(self.rawpin, size=len(self.data)+1), self.zippin),
                            (self.rawpin, dict(self.zippin, sha256='0'*64)),
                            (self.rawpin, dict(self.zippin, size=1))]:
            with self.assertRaises(ValueError):
                validate(self.source, raw, zipped)

    def test_remote_wrong_hash_length_missing_unknown(self):
        for observed in [dict(self.rawpin, sha256='0'*64), dict(self.rawpin, size=1), {}]:
            with self.assertRaises(ValueError):
                upload_gzip(self.source, self.rawpin, self.zippin,
                            lambda: self.base+self.route, lambda: observed, timeout=2)
        def unknown():
            raise RuntimeError('UNKNOWN hash result; no replay')
        with self.assertRaisesRegex(RuntimeError, 'UNKNOWN'):
            upload_gzip(self.source, self.rawpin, self.zippin,
                        lambda: self.base+self.route, unknown, timeout=2)

    def test_real_partial_sink_2xx_is_not_acceptance(self):
        self.route += '/partial'
        with self.assertRaisesRegex(ValueError, 'remote HASH/length'):
            self.upload()
        self.assertLess(self.records()[self.route]['size'], len(self.data))

    def test_disconnect_error_redirect_no_remote_acceptance_or_replay(self):
        for ending in ['/disconnect', '/error', '/redirect']:
            self.route = '/' + self.id().split('.')[-1] + ending
            with self.assertRaises(Exception):
                self.upload()
        self.assertEqual(self.remote_calls, 0)
        self.assertNotIn('/replayed', self.records())

    def test_source_changed_after_preflight_not_accepted(self):
        def changed_url():
            # Equal-length body with broken CRC: server may have all expected
            # bytes, but the second validation must refuse before remote HASH.
            blob = bytearray(self.compressed)
            blob[-8] ^= 1
            self.source.write_bytes(blob)
            return self.base+self.route
        with self.assertRaises(Exception):
            upload_gzip(self.source, self.rawpin, self.zippin, changed_url, self.remote, timeout=2)
        self.assertEqual(self.remote_calls, 0)

    def test_exact_final1910_consumer_real_transport_without_localcopy(self):
        pair = canonical_pair(ROOT)
        self.assertEqual(set(pair), set(FINAL))
        parent = self
        class Access:
            def api(self, method, route, body):
                parent.assertEqual(method, 'POST')
                parent.assertTrue(route.endswith('/files/upload-url'))
                return dict(url=parent.base+body['path'])
        class Transport:
            ROOT = '/owned-fixture'
            RUN = 'fresh-final1910'
            access = Access()
            @staticmethod
            def box_id():return 'fixture-no-box'
            def remote(self, label, code):
                # The fixture's HASH endpoint reads the actual bytes consumed
                # by the real HTTP sink, independently of the sender's digest.
                name = label.removeprefix('streamed-restore-')
                path = self.ROOT+'/'+self.RUN+'/checkpoint/'+name
                parent.assertIn(repr(path), code)
                return dict(stdout=json.dumps(parent.records()[path]))
        real_open = builtins.open
        def readonly(file, mode='r', *args, **kwargs):
            self.assertFalse(any(x in mode for x in 'wax+'), (file, mode))
            return real_open(file, mode, *args, **kwargs)
        before = set(Path(self.temp.name).iterdir())
        with patch('builtins.open', readonly), patch.object(Path, 'write_bytes', side_effect=AssertionError('local stage')):
            result = restore_pair(ROOT, Transport(), '/owned-fixture/fresh-final1910/checkpoint')
        self.assertEqual(result['avoidedLocalCopyBytes'], 4546657)
        self.assertEqual(result['localDecompressedStageBytes'], 0)
        self.assertEqual(before, set(Path(self.temp.name).iterdir()))
        self.assertFalse(result['reloaded'])
        print('FINAL1910 real PUT + independent sink HASH: '+json.dumps(result, sort_keys=True), flush=True)

    def test_exact_old_prepare_loop_attempts_4546657_local_bytes(self):
        old = ROOT/'scratch/runs/20261108-darkstone-bat-response-1940/prepare.py'
        tree = ast.parse(old.read_text())
        loop = next(node for node in tree.body if isinstance(node, ast.For)
                    and ast.unparse(node.iter) == "prov['files']")
        pair = canonical_pair(ROOT)
        prov = dict(files=[dict(name=name, source=str(source.relative_to(ROOT)), **raw)
                          for name, (source, raw, zipped) in pair.items()])
        attempted = {}
        def capture_write(target, data):
            attempted[target.name] = pin(data)
            return len(data)
        # Execute the historical local-copy loop, intercepting its durable
        # writes. No predecessor file is changed and no raw copy is created.
        with patch.object(Path, 'write_bytes', capture_write):
            exec(compile(ast.Module(body=[loop], type_ignores=[]), str(old), 'exec'),
                 dict(root=ROOT, r=Path(self.temp.name), prov=prov, gzip=gzip,
                      h=lambda b: hashlib.sha256(b).hexdigest()))
        self.assertEqual(sum(v['size'] for v in attempted.values()), 4546657)
        self.assertEqual({k:(v['size'],v['sha256']) for k,v in attempted.items()}, FINAL)
        self.assertEqual(list(Path(self.temp.name).iterdir()), [self.source])
        print('CAUSAL exact old prepare AST attempts 4546657 local stage bytes; '
              'new adapter under write prohibition streams same pair with 0', flush=True)

    def test_adapter_refuses_unowned_destination_before_transport(self):
        class Transport:
            ROOT='/owned'; RUN='new'
        with self.assertRaises(ValueError):
            restore_pair(ROOT, Transport(), '/old/checkpoint')


if __name__ == '__main__':
    unittest.main(verbosity=2)
