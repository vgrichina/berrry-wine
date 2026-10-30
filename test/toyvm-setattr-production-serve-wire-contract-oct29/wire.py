#!/usr/bin/env python3
"""Exact production serve loop, local packet transport; no kernel acceptance."""
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


def exchange(cls, flags, *, malformed=False):
    before_fds = len(os.listdir('/proc/self/fd'))
    b, ino = setup(cls)
    server, client = socket.socketpair(socket.AF_UNIX, socket.SOCK_SEQPACKET)
    client.settimeout(2)
    b.fd = server.detach()
    before = snapshot(b)
    errors = []
    with tempfile.TemporaryDirectory(prefix='tvw-', dir='/tmp') as work:
        status = Path(work) / 's'
        encoded = os.fsencode(status)
        assert b'\0' not in encoded and len(encoded) < 108

        def serve():
            try:
                b.serve(status)
            except BaseException as exc:
                errors.append(exc)

        t = threading.Thread(target=serve, daemon=True)
        t.start()
        try:
            deadline = time.monotonic() + 2
            while not status.exists():
                assert t.is_alive(), repr(errors)
                assert time.monotonic() < deadline, 'status bind timeout'
                time.sleep(.005)
            body = request(flags, 4097)
            unique = 0x1020304050607080
            raw = struct.pack('<IIQQIIII', 40 + len(body), 4, unique, ino, 11, 22, 33, 0) + body
            if malformed:
                # Explicit source contract: declared length differs from os.read.
                raw = struct.pack('<IIQQIIII', 41, 4, unique, ino, 11, 22, 33, 0)
            assert client.send(raw) == len(raw)
            response = client.recv(4096)
            if malformed:
                assert response == b''
                t.join(2)
                assert len(errors) == 1 and type(errors[0]) is RuntimeError
                assert str(errors[0]) == 'FUSE request truncated'
                assert snapshot(b) == before and b.operations == 0
                record = {'case': 'declared-length-mismatch', 'exception': str(errors[0]), 'noResponse': True}
            else:
                assert len(response) >= 16
                length, error, echo = struct.unpack('<IiQ', response[:16])
                assert length == len(response) and echo == unique
                payload = response[16:]
                after = snapshot(b)
                with socket.socket(socket.AF_UNIX) as c:
                    c.settimeout(2)
                    c.connect(str(status))
                    chunks = []
                    while True:
                        part = c.recv(4096)
                        if not part:
                            break
                        chunks.append(part)
                reported = json.loads(b''.join(chunks))
                assert reported == b.state(), 'status is not authoritative'
                assert b.operations == 1
                changed = sorted(k for k in before if before[k] != after[k])
                if flags == 8:
                    expected = copy.deepcopy(before)
                    expected['nodes'][ino]['data'] += bytes(4080)
                    expected['live'] += 4096
                    expected['written'] += 4080
                    assert after == expected
                    assert error == 0 and len(payload) == 104
                    expected_attr = struct.pack('<QQ', 0, 0) + struct.pack(
                        '<6Q10I', ino, 4097, 16, 0, 0, 0, 0, 0, 0,
                        before['nodes'][ino]['mode'], 1, os.getuid(), os.getgid(), 0, 4096, 0)
                    assert payload == expected_attr
                record = {'case': 'setattr', 'flags': flags, 'size': 4097,
                          'length': length, 'error': error, 'unique': echo,
                          'bodyBytes': len(payload), 'changedStateFields': changed,
                          'statePreserved': after == before, 'status': reported,
                          'unsupportedContractAccepted': error == -95 and length == 16 and payload == b'' and after == before}
        finally:
            client.close()  # Owned EOF terminates the real loop.
            t.join(2)
            assert not t.is_alive(), 'serve thread leaked'
            if status.exists():
                status.unlink()
            assert not status.exists()
        if not malformed:
            assert not errors, repr(errors)
        record['statusPathBytes'] = len(encoded)
    assert len(os.listdir('/proc/self/fd')) == before_fds, 'descriptor leak'
    record['cleanup'] = 'thread joined, descriptors closed, status path removed'
    return record


def main():
    source = SOURCE.read_bytes()
    assert len(source) == 11583 and hashlib.sha256(source).hexdigest() == PIN
    cls = load(source.decode(), SOURCE)['Backend']
    # Earliest behavioral check is the exact unmodified production serve loop.
    rejected = exchange(cls, 2056)
    assert rejected['unsupportedContractAccepted'], rejected
    supported = exchange(cls, 8)
    malformed = exchange(cls, 8, malformed=True)
    guard = "            if valid&~(1|2|4|8|16|32|64|128|256|512|1024):raise OSError(errno.EOPNOTSUPP,'setattr flags')\n"
    text = source.decode()
    assert text.count(guard) == 1
    removed = text.replace(guard, '')
    anchor = "            return pack('2Q',0,0)+self.attr(ino)\n        if op==9:"
    assert removed.count(anchor) == 1
    late = removed.replace(anchor, guard + anchor)
    mutants = {}
    for name, mutated in [('removed-guard', removed), ('late-guard', late)]:
        path = HERE / (name + '.py.txt')
        path.write_text(mutated)
        record = exchange(load(mutated, path)['Backend'], 2056)
        assert not record['unsupportedContractAccepted'] and not record['statePreserved'], record
        assert record['changedStateFields'] == ['live', 'nodes', 'written']
        assert record['error'] == (0 if name == 'removed-guard' else -95)
        record['sha256'] = hashlib.sha256(path.read_bytes()).hexdigest()
        mutants[name] = record
    assert SOURCE.read_bytes() == source
    result = {'PASS': True, 'sourceSHA256': PIN,
              'scope': 'wire-loop source acceptance only; local AF_UNIX SOCK_SEQPACKET replacing kernel transport; no FUSE mount',
              'production': [rejected, supported, malformed], 'mutantsRejected': mutants}
    (HERE / 'results.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({'PASS': True, 'productionCases': 3, 'mutantsRejected': 2, 'cleanup': 'all five loops clean'}))


if __name__ == '__main__':
    main()
