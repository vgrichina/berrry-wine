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
