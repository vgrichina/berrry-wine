"""Q3 pinned PUT service: two streaming lanes, no replay, terminal abort.

The caller owns URL authorization and the final remote hash/closure barrier.
An unsuccessful PUT has UNKNOWN remote effects, including on cancellation.
"""
from concurrent.futures import ThreadPoolExecutor
import hashlib
import http.client
from pathlib import Path
import socket
import threading
import time
from urllib.parse import urlsplit

CHUNK = 65536

# The authenticated SSH channel carries framed individual files, never an archive.
# A receiver publishes only a fully verified file; ambiguous sessions never retry.
SSH_RECEIVER = r'''
import sys,json,hashlib,os
from pathlib import Path
root=Path(sys.argv[1]).resolve()
while True:
 line=sys.stdin.buffer.readline(4097)
 if not line or len(line)>4096: raise RuntimeError('missing/big frame')
 pin=json.loads(line)
 if pin=={'done':True}:
  print('{"done":true}',flush=True)
  if sys.stdin.buffer.read(1): raise RuntimeError('trailing bytes')
  break
 rel=Path(pin['path']);path=root/rel
 if rel.is_absolute() or '..' in rel.parts or not path.resolve().is_relative_to(root): raise ValueError('outside root')
 path.parent.mkdir(parents=True,exist_ok=True)
 tmp=path.with_name(path.name+'.q3-part-'+str(os.getpid()))
 try:
  h=hashlib.sha256();remaining=pin['size']
  with tmp.open('xb') as f:
   while remaining:
    b=sys.stdin.buffer.read(min(65536,remaining))
    if not b: raise EOFError('partial file')
    f.write(b);h.update(b);remaining-=len(b)
   f.flush();os.fsync(f.fileno())
  if h.hexdigest()!=pin['sha256']: raise ValueError('remote pin mismatch')
  os.replace(tmp,path)
  # Independent final descriptor read before acknowledging publication.
  h=hashlib.sha256();size=0
  with path.open('rb') as f:
   while b:=f.read(65536): h.update(b);size+=len(b)
  if (size,h.hexdigest())!=(pin['size'],pin['sha256']): raise ValueError('final remote mismatch')
  print(json.dumps(pin,separators=(',',':')),flush=True)
 finally:
  tmp.unlink(missing_ok=True)
'''


def provision_ssh_files(root, pins, remote_root, sandbox, record=lambda event: None,
                        *, timeout=30, cancel=None, command=None):
    """One bounded authenticated SSH stream; no replay on any partial failure.

    command is an injected peer argv for actual-consumer pipe failure tests.
    Production always uses the sandbox CLI's authenticated, non-TTY SSH path.
    Each file has the original absolute 30s cap, including final remote reread.
    """
    import json
    import os
    import selectors
    import shlex
    import signal
    import subprocess
    if not 0 < timeout <= 30:
        raise ValueError('SSH deadline exceeds strict cap')
    root = Path(root).resolve()
    pins = list(pins)
    if len({p['path'] for p in pins}) != len(pins):
        raise ValueError('duplicate provider')

    def source(pin):
        rel = Path(pin['path'])
        path = root / rel
        if rel.is_absolute() or '..' in rel.parts or not path.resolve().is_relative_to(root):
            raise ValueError('provider outside root')
        return path

    for pin in pins:
        with source(pin).open('rb') as stream:
            verify(stream, pin)
    argv = command if command is not None else ['boat', '--no-update', 'ssh', sandbox,
            'python3 -B -c ' + shlex.quote(SSH_RECEIVER) + ' ' + shlex.quote(remote_root)]
    p = subprocess.Popen(argv, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                         stderr=subprocess.PIPE, start_new_session=True)
    stderr = bytearray()
    stdout = bytearray()
    sel = selectors.DefaultSelector()
    for stream, event in [(p.stdin, selectors.EVENT_WRITE),
                          (p.stdout, selectors.EVENT_READ), (p.stderr, selectors.EVENT_READ)]:
        os.set_blocking(stream.fileno(), False)
        sel.register(stream, event)
    deadline = time.monotonic() + timeout
    phase, sent = 'connect', 0

    def pump(data=None, reply=False):
        view = memoryview(data) if data is not None else None
        if reply:
            sel.unregister(p.stdin)
        while (view is not None and len(view)) or reply:
            if cancel is not None and cancel.is_set():
                raise InterruptedError('SSH cancelled; remote effects UNKNOWN; no retry')
            left = deadline - time.monotonic()
            if left <= 0:
                raise TimeoutError('SSH deadline; remote effects UNKNOWN; no retry')
            for key, _ in sel.select(min(left, .05)):
                stream = key.fileobj
                if stream is p.stdin:
                    if view is not None and len(view):
                        n = os.write(stream.fileno(), view[:CHUNK])
                        view = view[n:]
                else:
                    b = os.read(stream.fileno(), CHUNK)
                    if not b:
                        sel.unregister(stream)
                        if stream is p.stdout:
                            raise EOFError('SSH peer EOF; remote effects UNKNOWN; no retry')
                    elif stream is p.stderr:
                        stderr.extend(b)
                        if len(stderr) > CHUNK:
                            raise ValueError('SSH stderr exceeds bound')
                    else:
                        stdout.extend(b)
                        if len(stdout) > 4096:
                            raise ValueError('SSH response exceeds bound')
            if reply and b'\n' in stdout:
                line, _, rest = stdout.partition(b'\n')
                stdout[:] = rest
                sel.register(p.stdin, selectors.EVENT_WRITE)
                return json.loads(line)

    try:
        for pin in pins:
            deadline = time.monotonic() + timeout
            began = time.monotonic()
            sent, phase = 0, 'local-pin'
            with source(pin).open('rb') as stream:
                verify(stream, pin)
                before = os.fstat(stream.fileno())
                record(dict(event='start', path=pin['path'], size=pin['size'], at=time.time(), transport='ssh'))
                phase = 'frame'
                pump((json.dumps(pin, separators=(',', ':'))+'\n').encode())
                digest, size = hashlib.sha256(), 0
                phase = 'body-write'
                for block in chunks(stream):
                    digest.update(block);size += len(block)
                    if size > pin['size']:
                        raise ValueError('provider grew during SSH')
                    pump(block);sent += len(block)
                after = os.fstat(stream.fileno())
                if (size, digest.hexdigest()) != (pin['size'], pin['sha256']) or (before.st_size,before.st_mtime_ns,before.st_ctime_ns)!=(after.st_size,after.st_mtime_ns,after.st_ctime_ns):
                    raise ValueError('provider changed during SSH')
                phase = 'remote-sha-size'
                if pump(reply=True) != pin:
                    raise ValueError('SSH remote final pin refusal')
                record(dict(event='end',path=pin['path'],sent=sent,elapsed=time.monotonic()-began,remoteVerified=True))
        deadline = time.monotonic() + timeout
        phase = 'session-eof'
        pump(b'{"done":true}\n')
        if pump(reply=True) != {'done': True}:
            raise ValueError('SSH missing session seal')
        sel.unregister(p.stdin);p.stdin.close();p.stdin=None
        so,se=p.communicate(timeout=max(.001,deadline-time.monotonic()))
        if p.returncode or so or stdout or len(stderr)+len(se)>CHUNK:
            raise OSError('SSH final exit/refusal; no retry')
    except BaseException as error:
        record(dict(event='error',phase=phase,completeChunksSent=sent,error=str(error),remoteEffects='UNKNOWN'))
        raise
    finally:
        try:
            os.killpg(p.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        # Always drain both pipes and perform an actual wait, even cancellation.
        if p.stdin is not None:
            p.stdin.close();p.stdin=None
        so,se=p.communicate()
        sel.close()
        record(dict(event='actual-wait',status=p.returncode,stdoutEOF=True,stderrEOF=True,actualWait=True))


def chunks(stream):
    while block := stream.read(CHUNK):
        yield block


def verify(stream, pin):
    digest, size = hashlib.sha256(), 0
    for block in chunks(stream):
        digest.update(block)
        size += len(block)
    if (size, digest.hexdigest()) != (pin['size'], pin['sha256']):
        raise ValueError('provider pin mismatch: ' + pin['path'])
    stream.seek(0)


def provision_files(root, pins, remote_root, upload_url, record=lambda event: None,
                    *, workers=2, timeout=30):
    """Join every worker before return/raise; never publish a closure here.

    At most workers files/connections and workers*CHUNK body bytes are live.
    Socket timeout remains <=30s; an absolute per-PUT watchdog also prevents
    dribbling peers from extending that cap. Test callers may shorten it.
    upload_url(path) must itself be bounded and must not retry ambiguous calls.
    record is called under a lock; signed URLs are deliberately never recorded.
    """
    if not 0 < timeout <= 30 or not 1 <= workers <= 2:
        raise ValueError('upload limits exceed strict caps')
    root = Path(root).resolve()
    pins = list(pins)
    if len({p['path'] for p in pins}) != len(pins):
        raise ValueError('duplicate provider')

    def source(pin):
        path = root / pin['path']
        if Path(pin['path']).is_absolute() or '..' in Path(pin['path']).parts or not path.resolve().is_relative_to(root):
            raise ValueError('provider outside root')
        return path

    # No URL requests until every local source is verified. Recheck on the same
    # descriptor used for PUT, and hash again while sending to reject mutation.
    for pin in pins:
        with source(pin).open('rb') as stream:
            verify(stream, pin)
    lock = threading.RLock()
    stopped = threading.Event()
    active, failures = {}, []
    pending = iter(pins)

    def abort(connection):
        # close alone in another thread does not reliably wake a blocking recv.
        sock = active.get(connection) or connection.sock
        if sock is not None:
            try:
                sock.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass

    def fail(error):
        with lock:
            if not failures:
                failures.append(error)
            stopped.set()
            for connection in active:
                abort(connection)

    def worker():
        connection, origin = None, None
        while True:
            with lock:
                if stopped.is_set():
                    if connection is not None:
                        connection.close()
                    return
                pin = next(pending, None)
                if pin is None:
                    if connection is not None:
                        connection.close()
                    return
            timer = response = None
            reusable = False
            phase, sent = 'local-pin', 0
            began = time.monotonic()
            expired = threading.Event()
            try:
                with source(pin).open('rb') as stream:
                    verify(stream, pin)
                    if stopped.is_set():
                        return
                    phase = 'authorize'
                    url = urlsplit(upload_url(remote_root + '/' + pin['path']))
                    if url.scheme not in ('http', 'https') or not url.hostname or url.username or url.fragment:
                        raise ValueError('invalid PUT URL')
                    cls = http.client.HTTPSConnection if url.scheme == 'https' else http.client.HTTPConnection
                    new_origin = (url.scheme, url.hostname, url.port)
                    if origin != new_origin or connection is None or connection.sock is None:
                        if connection is not None:
                            connection.close()
                        connection = cls(url.hostname, url.port, timeout=timeout)
                        origin = new_origin
                    with lock:
                        if stopped.is_set():
                            return
                        active[connection] = None
                        record(dict(event='start', path=pin['path'], size=pin['size'], at=time.time(), reused=connection.sock is not None))
                    began = time.monotonic()

                    def deadline():
                        expired.set()
                        fail(TimeoutError('PUT deadline; remote effects UNKNOWN; no retry'))

                    timer = threading.Timer(timeout, deadline)
                    timer.start()
                    phase = 'connect'
                    if connection.sock is None:
                        connection.connect()
                    with lock:
                        active[connection] = connection.sock

                    def check():
                        if expired.is_set() or stopped.is_set():
                            raise OSError('PUT cancelled; remote effects UNKNOWN; no retry')
                        remaining = timeout - (time.monotonic() - began)
                        if remaining <= 0:
                            raise TimeoutError('PUT deadline; remote effects UNKNOWN; no retry')
                        connection.sock.settimeout(remaining)

                    check()
                    phase = 'headers'
                    target = url.path or '/'
                    if url.query:
                        target += '?' + url.query
                    connection.putrequest('PUT', target)
                    connection.putheader('Content-Type', 'application/octet-stream')
                    connection.putheader('Content-Length', str(pin['size']))
                    connection.endheaders()
                    digest, size = hashlib.sha256(), 0
                    phase = 'body-write'
                    for block in chunks(stream):
                        check()
                        size += len(block)
                        if size > pin['size']:
                            raise ValueError('provider grew during PUT')
                        digest.update(block)
                        connection.send(block)
                        sent += len(block)
                    if (size, digest.hexdigest()) != (pin['size'], pin['sha256']):
                        raise ValueError('provider changed during PUT')
                    check()
                    phase = 'response-headers'
                    response = connection.getresponse()
                    if not 200 <= response.status < 300:
                        raise OSError('PUT HTTP ' + str(response.status) + '; remote effects UNKNOWN; no retry')
                    # Drain with a bounded buffer and the same absolute deadline.
                    # HTTP/1.0 may detach the socket into response.fp on headers.
                    response_size = 0
                    phase = 'response-body'
                    while block := response.read(CHUNK):
                        response_size += len(block)
                        if response_size > CHUNK:
                            raise ValueError('PUT response exceeds 64KiB; remote effects UNKNOWN')
                        if time.monotonic() - began >= timeout or stopped.is_set():
                            raise TimeoutError('PUT response deadline; remote effects UNKNOWN; no retry')
                    if expired.is_set() or stopped.is_set():
                        raise OSError('PUT cancelled; remote effects UNKNOWN; no retry')
                    reusable = not response.will_close and connection.sock is not None
                    response.close()
                    with lock:
                        record(dict(event='end', path=pin['path'], at=time.time(), elapsed=time.monotonic()-began, sent=sent))
            except Exception as error:
                fail(error)
                with lock:
                    record(dict(event='error', path=pin['path'], at=time.time(), error=str(error), phase=phase, completeChunksSent=sent, elapsed=time.monotonic()-began, remoteEffects='UNKNOWN'))
                return
            finally:
                if timer is not None:
                    timer.cancel()
                    timer.join()
                if response is not None:
                    response.close()
                if connection is not None:
                    with lock:
                        active.pop(connection, None)
                    if not reusable or stopped.is_set():
                        connection.close()

    with ThreadPoolExecutor(max_workers=workers) as pool:
        results = [pool.submit(worker) for _ in range(workers)]
        for result in results:
            result.result()
    if failures:
        raise failures[0]
