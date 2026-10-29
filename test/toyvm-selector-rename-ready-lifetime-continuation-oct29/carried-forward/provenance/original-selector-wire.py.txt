#!/usr/bin/env python3
"""Exact production serve loop, local packet transport; no kernel acceptance."""
import sys
import gc
import errno
import copy
import hashlib
import json
import os
from pathlib import Path
import socket
import struct
import tempfile
import threading
import time

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
SOURCE = REPO / 'test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py'
PIN = 'f25724c57b163417b07b6775a9bb05985a5ae8968498887d5e64e56fbf70ae4e'


def load(text, filename):
    ns = {'__name__': 'wire_backend', '__file__': str(filename)}
    exec(compile(text, str(filename), 'exec'), ns)
    return ns


def snapshot(b):
    return copy.deepcopy({k: v for k, v in vars(b).items() if k != 'operations'})


def request(flags, size):
    # Same poisoned retained reproducer: valid=2056, size=4097.
    body = bytearray(b'\xa5' * 88)
    body[:4] = flags.to_bytes(4, 'little')
    body[16:24] = size.to_bytes(8, 'little')
    return bytes(body)


def setup(cls):
    import stat
    b = cls(str(HERE / 'never-mounted'), 65536, 65536, 32768)
    ino = b.create(1, b'target', stat.S_IFREG | 0o640)
    other = b.create(1, b'witness', stat.S_IFREG | 0o600)
    b.nodes[ino]['data'] = bytearray((n * 73 + 9) % 256 for n in range(17))
    b.nodes[other]['data'] = bytearray(b'witness-data')
    b.nodes[ino]['opens'] = 2
    b.nodes[other]['opens'] = 1
    b.handles = 3
    b.written = 29
    b.live = 20480
    b.peak = 24576
    return b, ino


E = HERE / 'results'
E.mkdir(exist_ok=True)
assert E.is_absolute() and E.is_dir()


def jsonable(value):
    if isinstance(value, bytes) or isinstance(value, bytearray):
        return {'bytesHex': value.hex()}
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, dict):
        return {str(k): jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [jsonable(v) for v in value]
    return value


def persist(name, record):
    (E / (name + '.json')).write_text(json.dumps(jsonable(record), indent=2) + '\n')


def descriptors():
    live, vanished = {}, []
    for fd in sorted(os.listdir('/proc/self/fd'), key=int):
        try:
            target = os.readlink('/proc/self/fd/' + fd)
        except OSError as exc:
            # listdir's scanning descriptor is already closed; no broad ignore.
            if exc.errno != errno.ENOENT:
                raise
            vanished.append(fd)
            continue
        info = Path('/proc/self/fdinfo/' + fd).read_text()
        live[fd] = {'target': target, 'fdinfo': info}
    return {'live': live, 'vanishedReadlinkENOENT': vanished}


def identities(snapshot):
    return {fd: row['target'] for fd, row in snapshot['live'].items()}


def serve_owned(t):
    # Copy scalar identities only; never retain a frame or selector reference.
    frame = sys._current_frames()[t.ident]
    while frame and frame.f_code.co_name != 'serve':
        frame = frame.f_back
    assert frame is not None
    return {'transport': frame.f_locals['self'].fd,
            'control': frame.f_locals['control'].fileno(),
            'selector': frame.f_locals['sel'].fileno()}


def exchange(cls, flags, name, *, malformed=False, baseline=False,
             cleanup_mutant=False):
    before_fds = descriptors()
    b, ino = setup(cls)
    server, client = socket.socketpair(socket.AF_UNIX, socket.SOCK_SEQPACKET)
    client.settimeout(2)
    b.fd = server.detach()
    before = snapshot(b)
    errors = []
    record = {'name': name, 'beforeFDs': before_fds, 'beforeState': before}
    with tempfile.TemporaryDirectory(prefix='w-', dir=HERE) as work:
        status = Path(os.path.relpath(work, Path.cwd())) / 's'
        encoded = os.fsencode(status)
        assert b'\0' not in encoded and len(encoded) < 108
        record['statusPath'] = str(status)
        record['statusPathBytes'] = len(encoded)

        def serve():
            try:
                b.serve(status)
            except BaseException as exc:
                errors.append(exc)  # Retain tracebacks to test deterministic cleanup.

        t = threading.Thread(target=serve, daemon=True)
        t.start()
        try:
            deadline = time.monotonic() + 2
            while not status.exists():
                assert t.is_alive(), repr(errors)
                assert time.monotonic() < deadline, 'status bind timeout'
                time.sleep(.005)
            # Bound status roundtrip ensures selector registration completed.
            with socket.socket(socket.AF_UNIX) as c:
                c.settimeout(2)
                c.connect(str(status))
                chunks = []
                while True:
                    part = c.recv(4096)
                    if not part:
                        break
                    chunks.append(part)
            record['initialStatus'] = json.loads(b''.join(chunks))
            record['ownedFDs'] = serve_owned(t)
            record['clientFD'] = client.fileno()
            record['liveFDs'] = descriptors()
            body = request(flags, 4097)
            unique = 0x1020304050607080
            raw = struct.pack('<IIQQIIII', 40 + len(body), 4, unique, ino, 11, 22, 33, 0) + body
            if malformed:
                raw = struct.pack('<IIQQIIII', 41, 4, unique, ino, 11, 22, 33, 0)
            assert client.send(raw) == len(raw)
            response = client.recv(4096)
            record['responseHex'] = response.hex()
            record['afterState'] = snapshot(b)
            record['operations'] = b.operations
            if malformed:
                t.join(2)
                record['exception'] = [dict(type=type(e).__name__, message=str(e)) for e in errors]
            else:
                length, error, echo = struct.unpack('<IiQ', response[:16])
                payload = response[16:]
                record.update(length=length, error=error, unique=echo,
                              bodyHex=payload.hex(), bodyBytes=len(payload),
                              changedStateFields=sorted(k for k in before if before[k] != record['afterState'][k]),
                              statePreserved=record['afterState'] == before)
                record['unsupportedContractAccepted'] = (error == -95 and length == 16 and payload == b'' and record['statePreserved'])
                assert length == len(response) and echo == unique
        finally:
            # Persist protocol/state before any cleanup assertions.
            persist(name, record)
            client.close()
            t.join(2)
            record['threadJoined'] = not t.is_alive()
            record['exceptions'] = [dict(type=type(e).__name__, message=str(e)) for e in errors]
            record['statusExistedBeforeUnlink'] = status.exists()
            if status.exists():
                status.unlink()
            record['statusRemoved'] = not status.exists()
            record['afterFDs'] = descriptors()
            persist(name, record)
        assert record['threadJoined'] and record['statusRemoved']
    before_ids, after_ids = identities(before_fds), identities(record['afterFDs'])
    record['descriptorOraclePassed'] = before_ids == after_ids
    surviving = {fd: target for fd, target in after_ids.items() if before_ids.get(fd) != target}
    record['survivingFDs'] = surviving
    persist(name, record)
    if baseline or cleanup_mutant:
        selector_fd = str(record['ownedFDs']['selector'])
        assert not record['descriptorOraclePassed']
        assert surviving == {selector_fd: 'anon_inode:[eventpoll]'}, surviving
        assert {fd: target for fd, target in after_ids.items() if fd != selector_fd} == before_ids
        assert record['liveFDs']['live'][selector_fd]['target'] == 'anon_inode:[eventpoll]'
    else:
        assert record['descriptorOraclePassed'], surviving
    if malformed:
        assert response == b'' and b.operations == 0 and snapshot(b) == before
        assert len(errors) == 1 and type(errors[0]) is RuntimeError
        assert str(errors[0]) == 'FUSE request truncated'
    else:
        assert not errors, repr(errors)
        assert b.operations == 1
        if flags == 8:
            expected = copy.deepcopy(before)
            expected['nodes'][ino]['data'] += bytes(4080)
            expected['live'] += 4096
            expected['written'] += 4080
            assert record['afterState'] == expected
            expected_attr = struct.pack('<QQ', 0, 0) + struct.pack(
                '<6Q10I', ino, 4097, 16, 0, 0, 0, 0, 0, 0,
                before['nodes'][ino]['mode'], 1, os.getuid(), os.getgid(), 0, 4096, 0)
            assert error == 0 and payload == expected_attr and len(payload) == 104
    return record


def acquisition_failure(cls, kind):
    before = descriptors()
    b, _ = setup(cls)
    held_error = None
    with tempfile.TemporaryDirectory(prefix='a-', dir=HERE) as work:
        status = Path(os.path.relpath(work, Path.cwd())) / 's'
        assert len(os.fsencode(status)) < 108
        if kind == 'bind':
            status.touch()  # A real bind error, before selector acquisition.
            server, client = socket.socketpair(socket.AF_UNIX, socket.SOCK_SEQPACKET)
            b.fd = server.detach()
            expected = errno.EADDRINUSE
        else:
            # epoll rejects a regular device: after selector/control acquisition.
            client = None
            b.fd = os.open('/dev/null', os.O_RDONLY)
            expected = errno.EPERM
        try:
            b.serve(status)
        except OSError as exc:
            held_error = exc
        finally:
            if client is not None:
                client.close()
            if status.exists():
                status.unlink()
        record = dict(expectedErrno=expected,
                      actualErrno=held_error.errno if held_error else None,
                      afterFDs=descriptors(), beforeFDs=before,
                      statusRemoved=not status.exists(), operations=b.operations)
        frame = held_error.__traceback__ if held_error else None
        while frame and frame.tb_frame.f_code.co_name != 'serve':
            frame = frame.tb_next
        assert frame is not None
        locals_ = frame.tb_frame.f_locals
        record['controlClosed'] = locals_['control'].fileno() == -1
        record['selectorUninitializedOrClosed'] = (locals_['sel'] is None if kind == 'bind'
                                                  else locals_['sel'].get_map() is None)
        try:
            os.fstat(b.fd)
        except OSError as exc:
            record['transportClosed'] = exc.errno == errno.EBADF
        else:
            record['transportClosed'] = False
        persist('acquisition-' + kind, record)
        assert record['actualErrno'] == expected
        assert record['controlClosed'] and record['selectorUninitializedOrClosed']
        assert record['transportClosed'] and record['statusRemoved']
        assert b.operations == 0
        assert identities(before) == identities(record['afterFDs'])
    return record


def lifecycle(cls, kind, serial):
    before = descriptors()
    b, ino = setup(cls)
    server, client = socket.socketpair(socket.AF_UNIX, socket.SOCK_SEQPACKET)
    client.settimeout(2)
    b.fd = server.detach()
    errors = []
    record = dict(kind=kind, serial=serial, beforeFDs=before)
    with tempfile.TemporaryDirectory(prefix='l-', dir=HERE) as work:
        status = Path(os.path.relpath(work, Path.cwd())) / 's'
        assert len(os.fsencode(status)) < 108
        def target():
            try:
                b.serve(status)
            except BaseException as exc:
                errors.append(exc)
        t = threading.Thread(target=target, daemon=True)
        t.start()
        try:
            deadline = time.monotonic()+2
            while not status.exists():
                assert t.is_alive(), repr(errors)
                assert time.monotonic() < deadline
                time.sleep(.002)
            with socket.socket(socket.AF_UNIX) as control:
                control.settimeout(2)
                control.connect(str(status))
                while control.recv(4096):
                    pass
            record['ownedFDs'] = serve_owned(t)
            record['activeFDs'] = descriptors()
            if kind == 'peerclosed':
                # Disable receipt before submitting a valid request: real write EPIPE.
                client.shutdown(socket.SHUT_RD)
                body = request(8,4097)
                client.send(struct.pack('<IIQQIIII',128,4,91,ino,11,22,33,0)+body)
                t.join(2)
            else:
                client.close()
                t.join(2)
        finally:
            client.close()
            t.join(2)
            record['joined'] = not t.is_alive()
            record['exceptions'] = [dict(type=type(e).__name__,errno=getattr(e,'errno',None),message=str(e)) for e in errors]
            record['statusExisted'] = status.exists()
            if status.exists(): status.unlink()
            record['statusRemoved'] = not status.exists()
            record['afterFDs'] = descriptors()
            persist('life-'+str(serial),record)
        assert record['joined'] and record['statusRemoved']
        assert identities(before) == identities(record['afterFDs'])
        if kind == 'eof':
            assert not errors and b.operations == 0
        else:
            assert len(errors) == 1 and isinstance(errors[0],BrokenPipeError)
            assert errors[0].errno == errno.EPIPE and b.operations == 1
    return record

def main():
    gc.disable()
    source=SOURCE.read_bytes()
    assert len(source)==11824
    assert hashlib.sha256(source).hexdigest()=='5d8384416042115189995a0aa80ad9de4d2695112b87da8d3d1124e5736d6bfc'
    cls=load(source.decode(),SOURCE)['Backend']
    if sys.argv[1]=='--first':
        r=exchange(cls,2056,'independent-unsupported')
        assert r['unsupportedContractAccepted']
        persist('checkpoint',dict(first=True,sourceSHA256=hashlib.sha256(source).hexdigest(),remaining=['supported','malformed','acquisition','EOF','peerclosed','sequential','mutants']))
        print('PASS first unchanged poisoned SETATTR wire response and atomic state')
        return
    assert sys.argv[1]=='--remaining'
    assert json.loads((E/'checkpoint.json').read_text())['first']
    exchange(cls,8,'independent-supported')
    exchange(cls,8,'independent-malformed',malformed=True)
    acquisition_failure(cls,'bind')
    acquisition_failure(cls,'register')
    for serial in range(12):
        lifecycle(cls,'eof' if serial%2==0 else 'peerclosed',serial)
    text=source.decode()
    guard="            if valid&~(1|2|4|8|16|32|64|128|256|512|1024):raise OSError(errno.EOPNOTSUPP,'setattr flags')\n"
    assert text.count(guard)==1
    anchor="            return pack('2Q',0,0)+self.attr(ino)\n        if op==9:"
    stripped=text.replace(guard,'')
    assert stripped.count(anchor)==1
    late=stripped.replace(anchor,guard+anchor)
    late_path=E/'late-guard.py.txt'
    late_path.write_text(late)
    r=exchange(load(late,late_path)['Backend'],2056,'reject-late-guard')
    assert not r['unsupportedContractAccepted'] and not r['statePreserved']
    assert r['error']==-95 and r['changedStateFields']==['live','nodes','written']
    close='                    sel.close()\n'
    assert text.count(close)==1
    mutant=text.replace(close,'                    pass # intentional rejecting selector leak\n')
    mutant_path=E/'no-selector-close.py.txt'
    mutant_path.write_text(mutant)
    # Last case: intentional live selector is left untouched until process exit.
    r=exchange(load(mutant,mutant_path)['Backend'],2056,'reject-selector-leak',cleanup_mutant=True)
    assert r['unsupportedContractAccepted']
    assert SOURCE.read_bytes()==source
    persist('checkpoint',dict(PASS=True,first=True,sourceSHA256=hashlib.sha256(source).hexdigest(),sequentialServes=12,remaining=[],scope='11824-byte backend only; no kernel/caller/six-candidate acceptance'))
    print('PASS supported/malformed/acquisition, EOF/EPIPE sequential lifetimes, both rejecting controls')
if __name__=='__main__':
    main()
