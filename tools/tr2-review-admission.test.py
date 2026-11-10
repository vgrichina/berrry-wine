"""Offline authored transport states; no browser, box, input or model review."""
import base64
import copy
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('delivery', Path(__file__).with_name('tr2-review-admission.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
ROOT = Path(__file__).resolve().parents[1]
PRIOR = ROOT/'scratch/runs/20261110-tr2-visible-target-margin-0415'


class Delivery(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(dir=ROOT/'scratch/runs/20261110-tr2-review-admission-latency-0432')
        self.r = Path(self.tmp.name)
        self.out = self.r/'webgl'
        self.out.mkdir()
        self.capture = json.loads((PRIOR/'review/webgl/world-first-capture.json').read_bytes())
        for suffix in m.SUFFIXES:
            (self.out/('world-first'+suffix)).write_bytes((PRIOR/'review/webgl'/('world-first'+suffix)).read_bytes())
        (self.out/'latest.json').write_text(json.dumps(self.capture))
        # This wire stub observes exact remote JS ordering. No game protocol.
        (self.r/'transport.cjs').write_text("""const fs=require('fs'),assert=require('assert/strict');
exports.publish=(p,v)=>fs.writeFileSync(p,JSON.stringify(v),{flag:'wx'});
exports.request=async(out,id,c)=>{const r=JSON.parse(fs.readFileSync(out+'/'+c.reviewRef+'-review.json'));
assert.equal(r.review,'OFFLINE authored control');assert.equal(r.at,'2026-11-10T04:22:56.690Z');
assert.equal(c.review,undefined);fs.writeFileSync(out+'/dispatch-proof',JSON.stringify(r));return {ok:true,id};};""")

    def tearDown(self):
        self.tmp.cleanup()

    def packet(self, command=None):
        p = subprocess.run(['python3', '-c', m.remote_source(self.out, command)], capture_output=True, text=True, check=True)
        v = json.loads(p.stdout)
        return v, Path(v['packet']['path']).read_bytes()

    def test_exact_remote_packet_and_capture_clock(self):
        v, b = self.packet()
        capture = m.unpack(b, self.r/'delivery', v['packet'])
        self.assertEqual(capture, self.capture)
        self.assertFalse((self.out/'dispatch-proof').exists())
        self.assertFalse((self.out/'world-first-review.json').exists())

    def test_review_before_request(self):
        self.packet(dict(id='offline', action='key', reviewRef='world-first', review={**self.capture, 'review':'OFFLINE authored control'}))
        self.assertEqual(json.loads((self.out/'dispatch-proof').read_bytes())['identity'], self.capture['identity'])

    def test_corruption_members_and_traversal_refused(self):
        v, b = self.packet()
        cases = []
        a = json.loads(b); a['files'][0]['sha256'] = '0'*64; cases.append(a)
        a = json.loads(b); a['files'][0]['size'] += 1; cases.append(a)
        a = json.loads(b); a['files'][0]['name'] = '../escape'; cases.append(a)
        a = json.loads(b); a['files'].reverse(); cases.append(a)
        a = json.loads(b); a['label'] = '../escape'; cases.append(a)
        for a in cases:
            data = json.dumps(a).encode()
            with self.assertRaises(AssertionError):
                m.unpack(data, self.r/'refused', dict(size=len(data), sha256=m.digest(data)))
            self.assertFalse((self.r/'refused').exists())
        with self.assertRaises(AssertionError):
            m.unpack(b+b' ', self.r/'refused', v['packet'])

    def test_actual_drive_single_download(self):
        calls = []
        test = self
        class Transport:
            ROOT = str(test.r)
            RUN = ''
            def remote(self, label, code, timeout):
                calls.append('exec')
                return dict(stdout=subprocess.check_output(['python3', '-c', code], text=True))
            def download(self, path, destination, pin):
                calls.extend(['download-url', 'GET'])
                b = Path(path).read_bytes()
                assert len(b) == pin['size'] and m.digest(b) == pin['sha256']
                destination.write_bytes(b)
        v = m.drive(self.r, Transport(), None)
        self.assertEqual(calls, ['exec', 'download-url', 'GET'])
        self.assertEqual(v['captureAt'], self.capture['at'])
        self.assertEqual(Path(v['image']).read_bytes(), (self.out/'world-first.png').read_bytes())
        self.assertFalse((self.out/'world-first-review.json').exists())


if __name__ == '__main__':
    unittest.main()
