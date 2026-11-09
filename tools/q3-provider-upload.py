"""Q3 pinned streaming services: no replay, terminal abort.

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
print('{"q3StreamReady":1}',flush=True)
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
    # Documented argv form: -- terminates CLI flags; each command argument keeps
    # its quoting. Never interpret the CLI's own JSON errors as remote stdout.
    argv = command if command is not None else ['boat', '--no-update', 'ssh', sandbox,
            '--', 'python3', '-B', '-c', SSH_RECEIVER, remote_root]
    record(dict(event='command', argv=argv, transport='ssh', at=time.time()))
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
    last_reply = b''
    diagnostics_truncated = False

    def pump(data=None, reply=False):
        nonlocal last_reply, diagnostics_truncated
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
                        overflow = len(stderr) + len(b) > CHUNK
                        stderr.extend(b[:CHUNK-len(stderr)])
                        if overflow:
                            diagnostics_truncated = True
                            raise ValueError('SSH stderr exceeds bound')
                    else:
                        overflow = len(stdout) + len(b) > 4096
                        stdout.extend(b[:4096-len(stdout)])
                        if overflow:
                            diagnostics_truncated = True
                            raise ValueError('SSH response exceeds bound')
            if reply and b'\n' in stdout:
                line, _, rest = stdout.partition(b'\n')
                stdout[:] = rest
                last_reply = bytes(line)
                sel.register(p.stdin, selectors.EVENT_WRITE)
                value = json.loads(line)
                if isinstance(value, dict) and ('error' in value or value.get('event') == 'error'):
                    raise ValueError('Boat CLI/remote error envelope; remote effects UNKNOWN; no retry')
                return value

    try:
        # Admit no file body until the actual receiver has started. A CLI auth,
        # status or session envelope cannot satisfy this exact remote greeting.
        phase = 'receiver-ready'
        if pump(reply=True) != {'q3StreamReady': 1}:
            raise ValueError('SSH receiver readiness refusal')
        record(dict(event='receiver-ready', reply=last_reply.decode(), at=time.time()))
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
                record(dict(event='pin-ack', reply=last_reply.decode(), at=time.time()))
                record(dict(event='end',path=pin['path'],sent=sent,elapsed=time.monotonic()-began,remoteVerified=True))
        deadline = time.monotonic() + timeout
        phase = 'session-eof'
        pump(b'{"done":true}\n')
        if pump(reply=True) != {'done': True}:
            raise ValueError('SSH missing session seal')
        record(dict(event='session-seal', reply=last_reply.decode(), at=time.time()))
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
        # Retain the returned envelope and independent stderr even on malformed
        # JSON, early EOF, authentication refusal or kill. All fields are capped.
        record(dict(event='actual-wait',status=p.returncode,stdoutEOF=True,stderrEOF=True,actualWait=True,
                    phase=phase,lastReply=last_reply.decode('utf-8',errors='replace'),
                    stdoutRemainder=(bytes(stdout)+so)[:4096].decode('utf-8',errors='replace'),
                    stderr=(bytes(stderr)+se)[:CHUNK].decode('utf-8',errors='replace'),
                    diagnosticsTruncated=diagnostics_truncated or len(stdout)+len(so)>4096 or len(stderr)+len(se)>CHUNK))


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
                    *, workers=2, timeout=30, cancel=None):
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
            cancel_done = threading.Event()
            cancel_thread = None
            reusable = False
            phase, sent = 'local-pin', 0
            began = time.monotonic()
            expired = threading.Event()
            try:
                with source(pin).open('rb') as stream:
                    import os
                    st=os.fstat(stream.fileno())
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
                    if cancel is not None:
                        def cancelled():
                            while not cancel_done.wait(.02):
                                if cancel.is_set():
                                    fail(InterruptedError('PUT cancellation/EOF; remote effects UNKNOWN; no retry'));return
                        cancel_thread = threading.Thread(target=cancelled)
                        cancel_thread.start()
                    phase = 'connect'
                    if connection.sock is None:
                        connection.connect()
                    with lock:
                        active[connection] = connection.sock

                    def check():
                        if expired.is_set() or stopped.is_set() or (cancel is not None and cancel.is_set()):
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
                    after=os.fstat(stream.fileno())
                    if (st.st_dev,st.st_ino,st.st_size,st.st_mtime_ns,st.st_ctime_ns)!=(after.st_dev,after.st_ino,after.st_size,after.st_mtime_ns,after.st_ctime_ns) or (size, digest.hexdigest()) != (pin['size'], pin['sha256']):
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
                    if expired.is_set() or stopped.is_set() or (cancel is not None and cancel.is_set()):
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
                cancel_done.set()
                if cancel_thread is not None:cancel_thread.join()
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


# Raw file ranges, never an archive. Each PUT keeps the original absolute cap.
HTTP_PART = 4 * 1024 * 1024


def assembly_code(remote_root, pin, parts, part_root):
    import json
    return '''import os,json,hashlib
from pathlib import Path
root=Path(%r).resolve();pin=json.loads(%r);parts=json.loads(%r);directory=Path(%r)
path=root/pin['path']
assert not Path(pin['path']).is_absolute() and '..' not in Path(pin['path']).parts and path.resolve().is_relative_to(root)
assert len(parts)>0 and len({p['path'] for p in parts})==len(parts)
assert {p.name for p in directory.iterdir()}=={p['path'] for p in parts},'chunk coverage'
offset=0
for i,p in enumerate(parts):
 assert p['path']==str(i) and p['offset']==offset and 0<p['size']<=4194304,'chunk order'
 offset+=p['size']
assert offset==pin['size'],'chunk coverage'
path.parent.mkdir(parents=True,exist_ok=True);tmp=path.with_name(path.name+'.q3-assembly-'+directory.name)
try:
 whole=hashlib.sha256();size=0
 with tmp.open('xb') as out:
  for p in parts:
   h=hashlib.sha256();n=0
   with (directory/p['path']).open('rb') as f:
    before=os.fstat(f.fileno())
    while b:=f.read(65536):
     n+=len(b);assert n<=p['size'],'chunk grew';h.update(b);whole.update(b);out.write(b);size+=len(b)
    after=os.fstat(f.fileno())
   assert (before.st_ino,before.st_size,before.st_mtime_ns,before.st_ctime_ns)==(after.st_ino,after.st_size,after.st_mtime_ns,after.st_ctime_ns),'chunk mutation'
   assert (n,h.hexdigest())==(p['size'],p['sha256']),'chunk integrity'
  out.flush();os.fsync(out.fileno())
 assert (size,whole.hexdigest())==(pin['size'],pin['sha256']),'whole integrity'
 os.replace(tmp,path)
 fd=os.open(path.parent,os.O_RDONLY|os.O_DIRECTORY)
 try:os.fsync(fd)
 finally:os.close(fd)
 h=hashlib.sha256();n=0
 with path.open('rb') as f:
  while b:=f.read(65536):h.update(b);n+=len(b)
 assert (n,h.hexdigest())==(pin['size'],pin['sha256']),'published integrity'
 print(json.dumps(pin,sort_keys=True))
finally:tmp.unlink(missing_ok=True)
''' % (remote_root, json.dumps(pin), json.dumps(parts), part_root)


def provision_chunked_files(root, pins, remote_root, upload_url, remote,
                            record=lambda event: None, *, timeout=30, cancel=None):
    """No retry/resume. A remote error is terminal before any later operation.

    Reopen-independent remote SHA/size ACKs precede every phase barrier. Source
    descriptor identity/timestamps and whole hash cover the exact ordered ranges.
    Only one bounded raw range is staged locally, removed before return/raise.
    """
    import json
    import os
    import tempfile
    import uuid
    if not 0 < timeout <= 30:
        raise ValueError('chunk deadline exceeds strict cap')
    root = Path(root).resolve()
    pins = list(pins)
    if len({p['path'] for p in pins}) != len(pins):
        raise ValueError('duplicate provider')
    def source(pin):
        rel=Path(pin['path']);p=root/rel
        if rel.is_absolute() or '..' in rel.parts or not p.resolve().is_relative_to(root):
            raise ValueError('provider outside root')
        return p
    def stamp(stream):
        s=os.fstat(stream.fileno())
        return s.st_dev,s.st_ino,s.st_size,s.st_mtime_ns,s.st_ctime_ns
    def check():
        if cancel is not None and cancel.is_set():
            raise InterruptedError('chunk cancelled/EOF; remote effects UNKNOWN; no retry')
    for pin in pins:
        with source(pin).open('rb') as f:verify(f,pin)
    session=uuid.uuid4().hex
    try:
        for index,pin in enumerate(pins):
            check()
            if pin['size'] <= HTTP_PART:
                continue
            part_root=remote_root+'/.q3-chunks/'+session+'/'+str(index)
            parts=[];whole=hashlib.sha256();offset=0
            with source(pin).open('rb') as stream, tempfile.TemporaryDirectory(prefix='q3-raw-range-') as temp:
                before=stamp(stream);verify(stream,pin)
                record(dict(event='file-start',path=pin['path'],size=pin['size']))
                while offset < pin['size']:
                    check();n=min(HTTP_PART,pin['size']-offset);h=hashlib.sha256()
                    part=dict(path=str(len(parts)),offset=offset,size=n)
                    local=Path(temp)/part['path']
                    with local.open('xb') as out:
                        remaining=n
                        while remaining:
                            b=stream.read(min(CHUNK,remaining))
                            if not b:raise EOFError('source truncated')
                            h.update(b);whole.update(b);out.write(b);remaining-=len(b)
                    part['sha256']=h.hexdigest()
                    if stamp(stream)!=before:raise ValueError('source descriptor mutated')
                    record(dict(event='chunk-ready',file=pin['path'],**part))
                    provision_files(temp,[part],part_root,upload_url,record,workers=1,timeout=timeout,cancel=cancel)
                    local.unlink();parts.append(part);offset+=n
                if stream.read(1) or stamp(stream)!=before or whole.hexdigest()!=pin['sha256']:
                    raise ValueError('source descriptor/whole integrity changed')
            check()
            reply=remote('chunk-assembly-'+str(index),assembly_code(remote_root,pin,parts,part_root),timeout)
            if json.loads(reply)!=pin:raise ValueError('assembly pin refusal')
            record(dict(event='assembled',path=pin['path'],parts=len(parts),size=offset,remoteVerified=True))
        check()
        small=[p for p in pins if p['size']<=HTTP_PART]
        provision_files(root,small,remote_root,upload_url,record,workers=2,timeout=timeout,cancel=cancel)
        # Independent fresh descriptor reads cover small PUTs and assembled files.
        for index in range(0,len(pins),64):
            check();batch=pins[index:index+64]
            code='import json,hashlib\nfrom pathlib import Path\nroot=Path('+repr(remote_root)+')\npins=json.loads('+repr(json.dumps(batch))+')\nfor p in pins:\n h=hashlib.sha256();n=0\n with (root/p["path"]).open("rb") as f:\n  while b:=f.read(65536):h.update(b);n+=len(b)\n assert (n,h.hexdigest())==(p["size"],p["sha256"]),p["path"]\nprint(json.dumps(pins,sort_keys=True))'
            if json.loads(remote('final-pin-reread-'+str(index),code,timeout))!=batch:
                raise ValueError('final remote pin refusal')
        record(dict(event='all-remote-verified',files=len(pins)))
    except BaseException as error:
        record(dict(event='error',error=str(error),remoteEffects='UNKNOWN',noRetry=True))
        raise
