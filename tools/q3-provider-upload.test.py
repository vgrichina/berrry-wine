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

    def test_reuses_one_connection_without_replay(self):
        with tempfile.TemporaryDirectory() as directory, peer() as (base, seen, received):
            root=Path(directory);pins=self.pins(root,count=20)
            # Actual accepted socket addresses distinguish connection reuse.
            self.upload(root,pins,base,workers=1)
            self.assertEqual(len(seen),20);self.assertEqual(len(received),20)
            self.assertEqual(len(peer.connections),1)


class SSHProvisionTests(unittest.TestCase):
    def test_actual_consumer_large_and_terminal_controls(self):
        import ast, gzip, json
        from unittest.mock import patch
        from types import SimpleNamespace
        source=Path(__file__).with_name('q3-native-inputs')/'control.py'
        legacy=source.read_text();a=legacy.index(' def url(path):',legacy.index('def provision():'));b=legacy.index(' for phase in',a)
        legacy=legacy[:a]+" with gzip.open(R/'uploads.jsonl.gz','xb') as f:\n  def record(event):f.write((json.dumps(event)+'\\n').encode());f.flush()\n  runpy.run_path(str(ROOT/'tools/q3-provider-upload.py'))['provision_ssh_files'](ROOT,files,REMOTE,box(),record)\n"+legacy[b:]
        fn=next(x for x in ast.parse(legacy).body if isinstance(x,ast.FunctionDef) and x.name=='provision')
        receiver=runpy.run_path(str(Path(__file__).with_name('q3-provider-upload.py')))['SSH_RECEIVER']
        real_popen=subprocess.Popen
        before_ready=('heldready','refusal','wrapper','wrappedstdout','bigstdout','bigstderr')
        for mode in ['large','heldwriter',*before_ready,'malformed','wrongack','exitstatus','mutation','cancel','eof']:
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as directory:
                root=Path(directory)/'local';root.mkdir();dest=Path(directory)/'remote';dest.mkdir()
                run=root/'run';run.mkdir();(root/'tools').mkdir()
                (root/'tools/q3-provider-upload.py').symlink_to(Path(__file__).with_name('q3-provider-upload.py').resolve())
                payload=root/'pak0.pk3'
                with payload.open('wb') as f:f.truncate(46853694)
                pins=[dict(path='pak0.pk3',size=payload.stat().st_size,sha256=hashlib.sha256(payload.read_bytes()).hexdigest())]
                for p in [root/'runtime-pins.json.gz',run/'runtime-pins.json.gz',run/'lifecycle.json.gz']:p.write_bytes(b'{}')
                barriers=[];processes=[];cancel=threading.Event()
                def spawn(argv,**kw):
                    self.assertEqual(argv[:4],['boat','--no-update','ssh','q3-local'])
                    self.assertEqual(argv[4:9],['--','python3','-B','-c',receiver])
                    self.assertEqual(argv[9],str(dest))
                    script=receiver
                    ready='print(\'{"q3StreamReady":1}\',flush=True);'
                    if mode=='heldwriter':script=ready+'import time;time.sleep(20)'
                    if mode=='heldready':script='import time;time.sleep(20)'
                    if mode=='refusal':script='raise SystemExit(23)'
                    if mode=='wrapper':script='import sys;print(\'{"event":"error","error":"authentication refused"}\',flush=True);print("CLI stderr marker",file=sys.stderr,flush=True);raise SystemExit(19)'
                    if mode=='wrappedstdout':script='import json;print(json.dumps(dict(stdout=\'{"q3StreamReady":1}\\n\',exitCode=0)),flush=True)'
                    if mode=='bigstdout':script='import sys;sys.stdout.write("X"*131072);sys.stdout.flush()'
                    if mode=='bigstderr':script='import sys;sys.stderr.write("E"*131072);sys.stderr.flush()'
                    if mode=='malformed':script=receiver.replace("print(json.dumps(pin,separators=(',',':')),flush=True)","print('malformed ack',flush=True)")
                    if mode=='wrongack':script=receiver.replace("print(json.dumps(pin,separators=(',',':')),flush=True)","print('{}',flush=True)")
                    if mode=='exitstatus':script=receiver+'\nraise SystemExit(7)'
                    if mode=='eof':script=ready+'import sys;sys.stdin.buffer.read(1024)'
                    child=real_popen([sys.executable,'-B','-c',script,str(dest)],**kw);processes.append(child)
                    return child
                actual=runpy.run_path(str(Path(__file__).with_name('q3-provider-upload.py')))['provision_ssh_files']
                def transfer(*args):
                    record=args[4]
                    def observed(event):
                        record(event)
                        if event['event']=='start' and mode=='mutation':
                            with payload.open('r+b') as f:f.write(b'X')
                        if event['event']=='start' and mode=='cancel':cancel.set()
                    if mode=='large':tracemalloc.start()
                    try:
                        return actual(*args[:4],observed,timeout=.3 if mode in ('heldwriter','heldready') else 5,cancel=cancel)
                    finally:
                        if mode=='large':
                            _,peak=tracemalloc.get_traced_memory();tracemalloc.stop()
                            print('SSH_ACTUAL_CONSUMER_PEAK_BYTES',peak,flush=True)
                            self.assertLess(peak,2*1024*1024)
                original_run=runpy.run_path
                def load(path):
                    if str(path).endswith('q3-provider-upload.py'):return {'provision_ssh_files':transfer}
                    return original_run(path)
                env=dict(Path=Path,ROOT=root,BASE=root,R=run,REMOTE=str(dest),RUN='run',H=lambda b:hashlib.sha256(b).hexdigest(),
                         validate=lambda:dict(files=pins),box=lambda:'q3-local',gzip=gzip,json=json,os=os,remote=lambda *args:barriers.append(args))
                exec(compile(ast.Module(body=[fn],type_ignores=[]),str(source),'exec'),env)
                began=time.monotonic()
                with patch('subprocess.Popen',spawn),patch('runpy.run_path',load):
                    if mode=='large':env['provision']();self.assertEqual(len(barriers),2)
                    else:
                        with self.assertRaises((OSError,ValueError,EOFError)):env['provision']()
                        self.assertEqual(barriers,[])
                self.assertLess(time.monotonic()-began,8)
                self.assertEqual(len(processes),1)
                self.assertIsNotNone(processes[0].returncode)
                events=[json.loads(x) for x in gzip.decompress((run/'uploads.jsonl.gz').read_bytes()).splitlines()]
                self.assertEqual(events[-1]['event'],'actual-wait')
                self.assertTrue(events[-1]['stdoutEOF'] and events[-1]['stderrEOF'])
                if mode=='large':
                    self.assertEqual(events[0]['event'],'command')
                    self.assertEqual([e['reply'] for e in events if e['event']=='receiver-ready'],['{"q3StreamReady":1}'])
                    self.assertEqual(len([e for e in events if e['event']=='pin-ack']),4)
                    self.assertEqual([e['reply'] for e in events if e['event']=='session-seal'],['{"done":true}'])
                    self.assertEqual(hashlib.sha256((dest/'pak0.pk3').read_bytes()).hexdigest(),pins[0]['sha256'])
                    self.assertEqual((dest/'pak0.pk3').stat().st_size,46853694)
                    self.assertEqual(len([e for e in events if e['event']=='end']),4)
                else:
                    self.assertEqual(len([e for e in events if e['event']=='start']),0 if mode in before_ready else 4 if mode=='exitstatus' else 1)
                    if mode!='exitstatus':self.assertFalse(any(e['event']=='end' for e in events))
                    if mode=='exitstatus':self.assertEqual(events[-1]['status'],7)
                    if mode=='wrapper':
                        self.assertIn('authentication refused',events[-1]['lastReply'])
                        self.assertIn('CLI stderr marker',events[-1]['stderr'])
                        self.assertEqual(events[-1]['phase'],'receiver-ready')
                    if mode=='malformed':self.assertEqual(events[-1]['lastReply'],'malformed ack')
                    if mode=='wrongack':self.assertEqual(events[-1]['lastReply'],'{}')
                    if mode in ('bigstdout','bigstderr'):
                        self.assertTrue(events[-1]['diagnosticsTruncated'])
                        self.assertLessEqual(len(events[-1]['stdoutRemainder']),4096)
                        self.assertLessEqual(len(events[-1]['stderr']),65536)
                print('SSH_CONTROL',json.dumps(dict(mode=mode,status=events[-1]['status'],
                      phase=events[-1]['phase'],starts=sum(e['event']=='start' for e in events),
                      barriers=len(barriers),actualWait=events[-1]['actualWait'],
                      stdoutEOF=events[-1]['stdoutEOF'],stderrEOF=events[-1]['stderrEOF'],
                      lastReply=events[-1]['lastReply'],diagnosticsTruncated=events[-1]['diagnosticsTruncated'])),flush=True)


class ChunkConsumerTests(unittest.TestCase):
    def test_actual_consumer_chunks_integrity_and_terminal_controls(self):
        import ast, gzip, json, re
        from types import SimpleNamespace
        from unittest.mock import patch
        source=Path(__file__).with_name('q3-native-inputs')/'control.py'
        fn=next(x for x in ast.parse(source.read_text()).body if isinstance(x,ast.FunctionDef) and x.name=='provision')
        actual=runpy.run_path(str(Path(__file__).with_name('q3-provider-upload.py')))['provision_chunked_files']
        media=Path(__file__).resolve().parents[1]/'test/binaries/candidates/quake-3-arena-demo-installer/installed/demoq3/pak0.pk3'
        for mode in ['actual-media','missing','duplicate','truncated','swapped','corrupt','order','coverage',
                     'heldwriter','refusal','cancel','cancel-eof','mutation','wrong-final','source-mismatch']:
            with self.subTest(mode=mode), tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parents[1]/'scratch/runs') as directory:
                root=Path(directory)/'local';root.mkdir();dest=Path(directory)/'remote';dest.mkdir()
                run=root/'run';run.mkdir();(root/'tools').mkdir()
                payload=root/'pak0.pk3'
                if mode=='actual-media':os.link(media,payload)
                else:
                    with payload.open('wb') as f:
                        for j in range(65):f.write(bytes([j])*65536)
                h=hashlib.sha256()
                with payload.open('rb') as f:
                    while b:=f.read(65536):h.update(b)
                pin=dict(path='pak0.pk3',size=payload.stat().st_size,sha256=h.hexdigest());pins=[pin]
                for p in [root/'runtime-pins.json.gz',run/'runtime-pins.json.gz',run/'lifecycle.json.gz']:p.write_bytes(b'{}')
                if mode=='source-mismatch':payload.write_bytes(b'bad')
                requests=[];barriers=[];remote_calls=[];cancel=threading.Event();release=threading.Event()
                class Handler(BaseHTTPRequestHandler):
                    protocol_version='HTTP/1.1'
                    def log_message(self,*args):pass
                    def do_PUT(self):
                        requests.append(self.path)
                        if mode in ('heldwriter','cancel','cancel-eof'):
                            if mode in ('cancel','cancel-eof'):cancel.set()
                            release.wait(2);return
                        if mode=='refusal':
                            self.send_response(503);self.send_header('Content-Length','0');self.end_headers();return
                        path=dest/self.path.lstrip('/');path.parent.mkdir(parents=True,exist_ok=True)
                        remaining=int(self.headers['Content-Length'])
                        with path.open('wb') as f:
                            while remaining:
                                b=self.rfile.read(min(65536,remaining))
                                if not b:return
                                f.write(b);remaining-=len(b)
                        self.send_response(200);self.send_header('Content-Length','0');self.end_headers()
                server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
                thread=threading.Thread(target=server.serve_forever,kwargs={'poll_interval':.01});thread.start()
                base='http://127.0.0.1:'+str(server.server_port)
                def remote(label,code,timeout):
                    if label.startswith('fresh-remote-check-'):barriers.append(label);return ''
                    remote_calls.append(label)
                    if label.startswith('chunk-assembly'):
                        chunkdir=next((dest/'.q3-chunks').glob('*/*'));files=sorted(chunkdir.iterdir(),key=lambda p:int(p.name))
                        if mode=='missing':files[0].unlink()
                        if mode=='truncated':files[0].write_bytes(b'')
                        if mode=='corrupt':
                            with files[0].open('r+b') as f:f.write(b'!')
                        if mode=='swapped':
                            tmp=chunkdir/'swap';files[0].rename(tmp);files[1].rename(files[0]);tmp.rename(files[1])
                        if mode in ('duplicate','order','coverage'):
                            match=re.search(r"parts=json.loads\((.*?)\);directory=",code)
                            old=ast.literal_eval(match.group(1));parts=json.loads(old)
                            if mode=='duplicate':parts.append(parts[0])
                            if mode=='order':parts.reverse()
                            if mode=='coverage':parts[-1]['offset']+=1
                            code=code.replace(repr(old),repr(json.dumps(parts)))
                    p=subprocess.run([sys.executable,'-B','-c',code],capture_output=True,text=True,timeout=timeout)
                    if p.returncode:raise OSError('remote refusal: '+p.stderr[-400:])
                    return '{}' if mode=='wrong-final' else p.stdout
                original=runpy.run_path
                def transfer(*args):
                    observed=args[-1]
                    def record(event):
                        observed(event)
                        if mode=='mutation' and event['event']=='chunk-ready':
                            with payload.open('r+b') as f:f.write(b'!')
                    return actual(*args[:-1],record,timeout=.2 if mode in ('heldwriter','cancel','cancel-eof') else 5,cancel=cancel)
                def load(path):
                    return {'provision_chunked_files':transfer} if str(path).endswith('q3-provider-upload.py') else original(path)
                env=dict(Path=Path,ROOT=root,BASE=root,R=run,REMOTE=str(dest),RUN='run',H=lambda b:hashlib.sha256(b).hexdigest(),
                         validate=lambda:dict(files=pins),box=lambda:'q3-local',gzip=gzip,json=json,os=os,remote=remote,
                         c=SimpleNamespace(access=SimpleNamespace(api=lambda method,route,body:dict(url=base+body['path'][len(str(dest)):]))))
                exec(compile(ast.Module(body=[fn],type_ignores=[]),str(source),'exec'),env)
                began=time.monotonic()
                try:
                    with patch('runpy.run_path',load):
                        if mode=='actual-media':env['provision']();self.assertEqual(len(barriers),2)
                        else:
                            with self.assertRaises((OSError,ValueError,EOFError)):env['provision']()
                            self.assertEqual(barriers,[])
                finally:release.set();server.shutdown();server.server_close();thread.join()
                events=[json.loads(x) for x in gzip.decompress((run/'uploads.jsonl.gz').read_bytes()).splitlines()]
                self.assertEqual(len(requests),len(set(requests)))
                if mode=='actual-media':
                    self.assertEqual(pin['size'],46853694);self.assertEqual(pin['sha256'],'e77abad2466f45a0a7ea018445528f9b95a0fe7789fa1abc1a7718bbf0754b08')
                    self.assertEqual(len([e for e in events if e['event']=='chunk-ready']),12)
                    self.assertTrue(all(e['size']<=4194304 for e in events if e['event']=='start'))
                else:self.assertFalse(any(e['event']=='all-remote-verified' for e in events))
                if mode in ('heldwriter','refusal','cancel','cancel-eof'):
                    self.assertEqual(len(requests),1);self.assertEqual(remote_calls,[])
                    self.assertLess(time.monotonic()-began,2)
                print('CHUNK_ACTUAL_CONSUMER',json.dumps(dict(mode=mode,puts=len(requests),remote=remote_calls,barriers=barriers)),flush=True)


if __name__ == '__main__':
    unittest.main(verbosity=2)
