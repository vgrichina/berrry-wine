#!/usr/bin/env python3
"""Pinned production serve/socketpair qualification, never a mount test."""
import copy
import errno
import hashlib
import json
import multiprocessing as mp
import os
from pathlib import Path
import socket
import stat
import struct
import threading
import time
import traceback

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
SOURCE = REPO / 'test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py'
PIN = 'e78b4f06715db96c3403aa821dc2008e7986fa9e9ec9fbacbc3744a8bb7eebc8'
CANDIDATE = 'combined-on-dfbe290db97d4a7efb746538805cee94eaa3f9ad'


def serial(v):
    if isinstance(v, (bytes, bytearray)):
        return {'hex': bytes(v).hex()}
    if isinstance(v, Path):
        return str(v)
    if isinstance(v, dict):
        return {('hex:' + k.hex() if isinstance(k, bytes) else str(k)): serial(x)
                for k, x in v.items()}
    return v


def snapshot(b):
    return copy.deepcopy({k: v for k, v in vars(b).items() if k != 'operations'})


def child(conn, text, case, number):
    record = {'case': case, 'pid': os.getpid()}
    try:
        ns = {'__name__': 'wire_backend', '__file__': str(SOURCE)}
        exec(compile(text, str(SOURCE), 'exec'), ns)
        b = ns['Backend'](HERE / 'never-mounted', 65536, 65536, 16384)

        def create(parent, name, directory=False):
            assert stat.S_ISDIR(b.nodes[parent]['mode'])
            body = (struct.pack('<II', 0o751, 0) if directory else
                    struct.pack('<IIII', 0, 0o640, 0, 0)) + name + b'\0'
            return struct.unpack_from('<Q', b.handle(9 if directory else 35, parent, body))[0]

        src = 1 if case['layout'] == 'root' else create(1, b'source', True)
        dst = create(1, b'destination', True)
        moved = create(src, b'file', case['kind'] == 'directory')
        if case['kind'] == 'file':
            payload = b'preserved payload'
            body = struct.pack('<QQIIQII', moved, 0, len(payload), 0, 0, 0, 0) + payload
            assert b.handle(16, moved, body) == struct.pack('<II', len(payload), 0)
        regular = create(1, b'non-directory')
        assert all(not n['names'] for n in b.nodes.values() if not stat.S_ISDIR(n['mode']))
        oldparent = regular if case['bad'] == 'source-regular' else (999 if case['bad'] == 'source-missing' else src)
        newparent = regular if case['bad'] == 'destination-regular' else (999 if case['bad'] == 'destination-missing' else dst)
        server, client = socket.socketpair(socket.AF_UNIX, socket.SOCK_SEQPACKET)
        client.settimeout(2)
        b.fd = server.detach()
        before = snapshot(b)
        initial_operations = b.operations
        status = HERE.parents[2] / ('s' + str(os.getpid()))
        assert len(os.fsencode(status)) < 108
        errors = []

        def serve():
            try:
                b.serve(status)
            except BaseException:
                errors.append(traceback.format_exc())

        t = threading.Thread(target=serve, daemon=True)
        t.start()
        deadline = time.monotonic() + 2
        while not status.exists():
            assert t.is_alive() and time.monotonic() < deadline, errors
            time.sleep(.005)
        exchanges = []

        def exchange(op, ino, body, unique):
            # Exact production unpack('2I2Q4I', raw), retained wire.py header.
            raw = struct.pack('<IIQQIIII', 40 + len(body), op, unique, ino, 11, 22, 33, 0) + body
            assert client.send(raw) == len(raw)
            answer = client.recv(4096)
            assert len(answer) >= 16
            length, error, echoed = struct.unpack('<IiQ', answer[:16])
            exchanges.append(dict(requestHex=raw.hex(), responseHex=answer.hex(),
                                  unique=unique, error=error, length=length))
            assert length == len(answer) and echoed == unique
            return error, answer[16:]

        flags = case.get('flags', 0)
        body = (struct.pack('<Q', newparent) if case['op'] == 12 else
                struct.pack('<QII', newparent, flags, 0)) + b'file\0moved\0'
        error, answer = exchange(case['op'], oldparent, body, number * 100 + 1)
        expected_error = (-errno.EOPNOTSUPP if flags else
                          -errno.ENOTDIR if 'regular' in case['bad'] else
                          -errno.ENOENT if 'missing' in case['bad'] else 0)
        wire_ok = error == expected_error and answer == b'' and exchanges[0]['length'] == 16
        # Read authoritative JSON while serve is active, before any LOOKUPs.
        with socket.socket(socket.AF_UNIX) as c:
            c.settimeout(2)
            c.connect(str(status))
            chunks = []
            while True:
                part = c.recv(4096)
                if not part:
                    break
                chunks.append(part)
        control = json.loads(b''.join(chunks))
        control_ok = control == b.state() and control['operations'] == initial_operations + 1
        lookups = []
        for i, (parent, name, ino) in enumerate([(src, b'file', moved), (1, b'non-directory', regular)]):
            if not expected_error and i == 0:
                parent, name = dst, b'moved'
            e, data = exchange(1, parent, name + b'\0', number * 100 + 2 + i)
            lookups.append(e == 0 and len(data) == 128 and struct.unpack_from('<Q', data)[0] == ino)
        # Responses above are checked before cleanup. Only owned endpoint EOF.
        client.close()
        t.join(2)
        assert not t.is_alive() and not errors, errors
        after = snapshot(b)  # wrapper-owned serialization after actual serve joins
        expected = copy.deepcopy(before)
        if not expected_error:
            expected['nodes'][dst]['names'][b'moved'] = expected['nodes'][src]['names'].pop(b'file')
        state_ok = after == expected
        status.unlink()
        record.update(exchanges=exchanges, expectedError=expected_error, wireOK=wire_ok,
                      control=control, controlOK=control_ok, lookupsOK=all(lookups),
                      before=serial(before), after=serial(after), stateOK=state_ok,
                      operationsDelta=b.operations-initial_operations,
                      serveJoined=True, statusRemoved=not status.exists(),
                      oracleAccepted=wire_ok and control_ok and all(lookups) and state_ok)
        conn.send(record)
    except BaseException:
        record.update(fixtureError=traceback.format_exc(), oracleAccepted=False)
        conn.send(record)
    finally:
        conn.close()


def run(text, case, number):
    ctx = mp.get_context('fork')
    reader, writer = ctx.Pipe(duplex=False)
    p = ctx.Process(target=child, args=(writer, text, case, number))
    p.start()
    writer.close()
    identity = Path('/proc') / str(p.pid) / 'stat'
    start = identity.read_text().rsplit(')', 1)[1].split()[19]
    assert reader.poll(10), 'child result timeout'
    record = reader.recv()
    reader.close()
    p.join(3)
    assert not p.is_alive() and p.exitcode == 0
    record['process'] = dict(pid=p.pid, startTicks=start, exit=p.exitcode,
                             reaped=not identity.exists(), cleanup='normal child process exit')
    assert record['process']['reaped']
    return record


def main():
    source = SOURCE.read_bytes()
    assert len(source) == 12821 and hashlib.sha256(source).hexdigest() == PIN
    pins = json.loads((HERE / 'production-pins.json').read_text())
    def verify():
        measured = {name: dict(bytes=len((REPO/name).read_bytes()), sha256=hashlib.sha256((REPO/name).read_bytes()).hexdigest()) for name in pins}
        assert measured == pins
        return measured
    result = dict(candidate=CANDIDATE, sourcePins=verify(), production=[], mutants=[], PASS=False,
                  limits='production Backend limits 65536 live / 65536 write / 16384 file',
                  scope='unmodified production serve, SOCK_SEQPACKET and AF_UNIX control; no mount/kernel acceptance',
                  cleanupLimit='separate lifetime.py qualifies joined serve descriptor ownership',
                  snapshot='all Backend instance fields except operations; serialized only after serve joins')
    def save():
        path = HERE / 'results.json'
        path.write_text(json.dumps(result, separators=(',', ':')) + '\n')
        assert path.stat().st_size < 900000
    text = source.decode()
    first = dict(op=12, kind='file', layout='cross', bad='destination-regular')
    cases = [first]
    for op in (12, 45):
        for kind in ('file', 'directory'):
            for layout in ('root', 'cross'):
                for bad in ('source-regular', 'source-missing', 'destination-regular', 'destination-missing', ''):
                    case = dict(op=op, kind=kind, layout=layout, bad=bad)
                    if case != first:
                        cases.append(case)
    for bad in ('source-regular', 'source-missing', 'destination-regular', 'destination-missing'):
        cases.append(dict(op=45, kind='file', layout='cross', bad=bad, flags=1))
    for number, case in enumerate(cases, 1):
        record = run(text, case, number)
        result['production'].append(record)
        save()
        assert record['oracleAccepted'], ('first behavioral counterexample', number, record.get('fixtureError'))
    guard = "            for parent in (ino,newdir):\n                if parent not in self.nodes:raise OSError(errno.ENOENT,'rename parent missing')\n                if not stat.S_ISDIR(self.nodes[parent]['mode']):raise OSError(errno.ENOTDIR,'rename parent not directory')\n"
    assert text.count(guard) == 1
    for side, remaining in [('source', 'newdir'), ('destination', 'ino')]:
        mutant = text.replace(guard, guard.replace('(ino,newdir)', '(' + remaining + ',)'))
        path = HERE / ('private-remove-' + side + '-guard.py.txt')
        path.write_text(mutant)
        case = dict(op=12, kind='file', layout='cross', bad=side+'-regular')
        record = run(mutant, case, 80 + len(result['mutants']))
        assert 'fixtureError' not in record, record
        assert not record['oracleAccepted'], ('mutation escaped oracle', side)
        record['sourceSHA256'] = hashlib.sha256(mutant.encode()).hexdigest()
        result['mutants'].append(record)
        save()
    assert SOURCE.read_bytes() == source
    result.update(PASS=True, sourcePinsAfter=verify(), fixtureSHA256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest())
    save()
    print(json.dumps(dict(PASS=True, productionCases=len(cases), mutantsRejected=len(result['mutants']))))


if __name__ == '__main__':
    main()
