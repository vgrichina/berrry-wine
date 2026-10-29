#!/usr/bin/env python3
"""Pinned direct-callback diagnostic. Exit 1 on the first contract counterexample.

No FUSE mount or kernel reachability claim. Run once on an unchanged candidate.
"""
import copy
import errno
import hashlib
import importlib.util
import json
import pathlib
import stat
import struct

HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parent.parent
BACKEND = 'test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py'


def identity(path):
    data = path.read_bytes()
    return dict(bytes=len(data), sha256=hashlib.sha256(data).hexdigest())


def verify(pins):
    measured = {name: identity(REPO / name) for name in pins}
    assert measured == pins, ('production identity mismatch', measured)
    return measured


def snapshot(backend):
    # Exact normalization used by the accepted CREATE/MKDIR original-contract.py:
    # every instance variable is copied; only the operations counter is excluded.
    return copy.deepcopy({k: v for k, v in vars(backend).items() if k != 'operations'})


def serial(value):
    if isinstance(value, (bytes, bytearray)):
        return dict(hex=bytes(value).hex())
    if isinstance(value, pathlib.Path):
        return str(value)
    if isinstance(value, dict):
        return {('hex:' + k.hex() if isinstance(k, bytes) else str(k)): serial(v)
                for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [serial(v) for v in value]
    return value


def create(b, parent, name, directory=False):
    # All setup creation is under legitimate directories, never synthetic nodes.
    assert stat.S_ISDIR(b.nodes[parent]['mode'])
    op = 9 if directory else 35
    request = (struct.pack('<II', 0o751, 0) if directory else
               struct.pack('<IIII', 0, 0o640, 0, 0)) + name + b'\0'
    reply = b.handle(op, parent, request)
    ino = struct.unpack_from('<Q', reply)[0]
    assert b.nodes[parent]['names'][name] == ino
    return ino


def payload(b, ino):
    data = b'preserved payload'
    request = struct.pack('<QQIIQII', ino, 0, len(data), 0, 0, 0, 0) + data
    assert b.handle(16, ino, request) == struct.pack('<II', len(data), 0)


def request(op, newdir, old=b'file', new=b'moved'):
    # fuse_rename_in is uint64 newdir (8 bytes); fuse_rename2_in adds
    # uint32 flags and padding (16 bytes). Names follow as two NUL strings.
    assert op in (12, 45)
    header = struct.pack('<Q', newdir) if op == 12 else struct.pack('<QII', newdir, 0, 0)
    data = header + old + b'\0' + new + b'\0'
    offset = 8 if op == 12 else 16
    assert struct.unpack_from('<Q', data)[0] == newdir
    assert data[offset:].split(b'\0') == [old, new, b'']
    if op == 45:
        assert struct.unpack_from('<II', data, 8) == (0, 0)
    return data


def main():
    provenance = json.loads((HERE / 'source-pins.json').read_text())
    pins = provenance['sourcePins']
    before_pins = verify(pins)
    spec = importlib.util.spec_from_file_location('pinned_backend', REPO / BACKEND)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    cls = module.Backend
    results = dict(candidate=provenance['candidate'], productionPinsBefore=before_pins,
                   scope='internal direct Backend.handle validation consistency only',
                   kernelReachability='not established; callbacks can exceed kernel-reachable requests',
                   snapshotNormalization='deepcopy all instance variables except operations',
                   requestLayouts={'12': '<Q newdir; old\\0new\\0',
                                   '45': '<QII newdir, flags=0, padding=0; old\\0new\\0'},
                   executed=[], unexecuted=[])

    # First behavioral RENAME boundary: valid cross-directory move, fresh Backend.
    b = cls(HERE / 'never-mounted-control', live_limit=65536)
    source = create(b, 1, b'source', True)
    destination = create(b, 1, b'destination', True)
    file = create(b, source, b'file')
    payload(b, file)
    before = snapshot(b)
    calls = b.operations
    wire = request(12, destination)
    reply = b.handle(12, source, wire)
    expected = copy.deepcopy(before)
    expected['nodes'][destination]['names'][b'moved'] = expected['nodes'][source]['names'].pop(b'file')
    assert reply == b'' and snapshot(b) == expected and b.operations == calls + 1
    results['executed'].append(dict(case='valid-crossdirectory-file-control', op=12,
                                    requestHex=wire.hex(), passed=True,
                                    before=serial(before), after=serial(snapshot(b))))

    # FIRST invalid-parent case; no remaining matrix is run after a counterexample.
    b = cls(HERE / 'never-mounted-counterexample', live_limit=65536)
    source = create(b, 1, b'source', True)
    file = create(b, source, b'file')
    payload(b, file)
    destination = create(b, 1, b'non-directory')
    assert stat.S_ISREG(b.nodes[destination]['mode'])
    assert all(not n['names'] for n in b.nodes.values() if not stat.S_ISDIR(n['mode']))
    before = snapshot(b)
    calls = b.operations
    wire = request(12, destination)
    # Also inspect RENAME2's zero-flags request layout, without invoking it.
    rename2 = request(45, destination)
    try:
        reply = b.handle(12, source, wire)
    except Exception as exc:
        actual = dict(type=type(exc).__name__, errno=getattr(exc, 'errno', None), raw=str(exc))
    else:
        actual = dict(type='success', errno=None, replyHex=reply.hex())
    after = snapshot(b)
    passed = actual['type'] == 'OSError' and actual['errno'] == errno.ENOTDIR and after == before
    results['executed'].append(dict(case='destination-regular-parent-valid-crossdirectory-source-file',
                                    op=12, sourceParent=source, destinationParent=destination,
                                    sourceInode=file, requestHex=wire.hex(),
                                    unexecutedRename2RequestHex=rename2.hex(),
                                    expectedErrno=errno.ENOTDIR, expectedErrnoName='ENOTDIR',
                                    actual=actual, snapshotPreserved=(after == before),
                                    operationsDelta=b.operations-calls, passed=passed,
                                    before=serial(before), after=serial(after)))
    results['productionPinsAfter'] = verify(pins)
    results['productionUnchanged'] = results['productionPinsAfter'] == before_pins
    results['unexecuted'] = [
        'RENAME2/op45 flags=0 behavioral calls',
        'root-source-file destination-regular-parent',
        'source-directory destination-regular-parent (root and crossdirectory)',
        'destination-missing-parent with valid source-file or source-directory',
        'source-regular-parent with valid destination-parent',
        'source-missing-parent with valid destination-parent',
        'remove-parent-guard source-copy controls (conditional on complete passing contract)',
    ]
    results['status'] = 'COUNTEREXAMPLE' if not passed else 'FIRST_CASE_PASSED_INCOMPLETE'
    results['acceptanceClaim'] = False
    (HERE / 'results.json').write_text(json.dumps(results, indent=2) + '\n')
    print(json.dumps(dict(status=results['status'], validControl=True, actual=actual,
                          expectedErrno=errno.ENOTDIR, snapshotPreserved=after == before,
                          productionUnchanged=results['productionUnchanged'],
                          stoppedAfterFirstInvalidParent=True)))
    return 1 if not passed else 2


if __name__ == '__main__':
    raise SystemExit(main())
