"""Pinned file PUTs: bounded memory, no replay, stop dispatch on first failure.

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
                    *, workers=8, timeout=90):
    """Join every worker before return/raise; never publish a closure here.

    At most workers files/connections and workers*CHUNK body bytes are live.
    Socket timeout remains <=90s; an absolute per-PUT watchdog also prevents
    dribbling peers from extending that cap. Test callers may shorten it.
    upload_url(path) must itself be bounded and must not retry ambiguous calls.
    record is called under a lock; signed URLs are deliberately never recorded.
    """
    if not 0 < timeout <= 90 or not 1 <= workers <= 8:
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
        while True:
            with lock:
                if stopped.is_set():
                    return
                pin = next(pending, None)
                if pin is None:
                    return
            connection = timer = response = None
            began = time.monotonic()
            expired = threading.Event()
            try:
                with source(pin).open('rb') as stream:
                    verify(stream, pin)
                    if stopped.is_set():
                        return
                    url = urlsplit(upload_url(remote_root + '/' + pin['path']))
                    if url.scheme not in ('http', 'https') or not url.hostname or url.username or url.fragment:
                        raise ValueError('invalid PUT URL')
                    cls = http.client.HTTPSConnection if url.scheme == 'https' else http.client.HTTPConnection
                    connection = cls(url.hostname, url.port, timeout=timeout)
                    with lock:
                        if stopped.is_set():
                            return
                        active[connection] = None
                        record(dict(event='start', path=pin['path'], size=pin['size'], at=time.time()))
                    began = time.monotonic()

                    def deadline():
                        expired.set()
                        fail(TimeoutError('PUT deadline; remote effects UNKNOWN; no retry'))

                    timer = threading.Timer(timeout, deadline)
                    timer.start()
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
                    target = url.path or '/'
                    if url.query:
                        target += '?' + url.query
                    connection.putrequest('PUT', target)
                    connection.putheader('Content-Type', 'application/octet-stream')
                    connection.putheader('Content-Length', str(pin['size']))
                    connection.endheaders()
                    digest, size = hashlib.sha256(), 0
                    for block in chunks(stream):
                        check()
                        size += len(block)
                        if size > pin['size']:
                            raise ValueError('provider grew during PUT')
                        digest.update(block)
                        connection.send(block)
                    if (size, digest.hexdigest()) != (pin['size'], pin['sha256']):
                        raise ValueError('provider changed during PUT')
                    check()
                    response = connection.getresponse()
                    if not 200 <= response.status < 300:
                        raise OSError('PUT HTTP ' + str(response.status) + '; remote effects UNKNOWN; no retry')
                    # Drain with a bounded buffer and the same absolute deadline.
                    # HTTP/1.0 may detach the socket into response.fp on headers.
                    while response.read(CHUNK):
                        if time.monotonic() - began >= timeout or stopped.is_set():
                            raise TimeoutError('PUT response deadline; remote effects UNKNOWN; no retry')
                    if expired.is_set() or stopped.is_set():
                        raise OSError('PUT cancelled; remote effects UNKNOWN; no retry')
                    response.close()
                    with lock:
                        record(dict(event='end', path=pin['path'], at=time.time(), elapsed=time.monotonic()-began))
            except Exception as error:
                fail(error)
                with lock:
                    record(dict(event='error', path=pin['path'], at=time.time(), error=str(error), remoteEffects='UNKNOWN'))
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
                    connection.close()

    with ThreadPoolExecutor(max_workers=workers) as pool:
        results = [pool.submit(worker) for _ in range(workers)]
        for result in results:
            result.result()
    if failures:
        raise failures[0]
