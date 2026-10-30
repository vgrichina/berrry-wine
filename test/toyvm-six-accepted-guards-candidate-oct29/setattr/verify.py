#!/usr/bin/env python3
"""Direct production Backend.handle tests; no mount or guest execution."""
import copy
import errno
import hashlib
import json
from pathlib import Path
import stat
import struct
import sys

HERE = Path(__file__).resolve().parent
SOURCE = Path('/tmp/toyvm-six-accepted-guards-candidate-oct29/repo/test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py')
MASK = 2047


def load(source):
    scope = {'__name__': 'setattr_test_backend', '__file__': str(SOURCE)}
    exec(compile(source, str(SOURCE), 'exec'), scope)
    return scope['Backend']


def request(valid, size):
    # fuse_setattr_in: valid uint32 at 0; size uint64 at 16.
    data = bytearray(88)
    struct.pack_into('<I', data, 0, valid)
    struct.pack_into('<Q', data, 16, size)
    return bytes(data)


def fixture(cls, old=3, live=32768, write=65536, file=16384):
    b = cls(str(HERE / 'unused-mount'), live, write, file)
    ino = b.create(1, b'file', stat.S_IFREG | 0o600)
    payload = bytes((i % 251) + 1 for i in range(old))
    # Independent initial state: inode metadata plus rounded dense payload.
    b.nodes[ino]['data'] = bytearray(payload)
    b.live = b.peak = 8192 + ((old + 4095) // 4096) * 4096
    b.written = old
    b.nodes[ino]['opens'] = 1
    b.handles = 1
    return b, ino


def snapshot(b):
    return copy.deepcopy({k: v for k, v in vars(b).items() if k != 'operations'})


def call(b, ino, valid, size):
    try:
        return None, b.handle(4, ino, request(valid, size))
    except OSError as e:
        return e.errno, None


def rejected(cls):
    count = 0
    # Every uint32 bit outside the supported mask, across size relationships.
    for bit in range(11, 32):
        for old, size in ((3, 4097), (4097, 1), (3, 3)):
            for supported in (8, MASK):
                b, ino = fixture(cls, old)
                before = snapshot(b)
                assert call(b, ino, (1 << bit) | supported, size)[0] == errno.EOPNOTSUPP, 'unsupported flags accepted'
                assert snapshot(b) == before, ('invalid flags mutated state', bit, old, size)
                assert b.operations == 1
                count += 1
        b, ino = fixture(cls)
        before = snapshot(b)
        assert call(b, ino, 1 << bit, 16385)[0] == errno.EOPNOTSUPP
        assert snapshot(b) == before
        count += 1
    # Unsupported flags take precedence even when the size would exhaust quotas.
    for kwargs, size in (({'live': 12288}, 4097), ({'write': 4}, 5), ({'file': 4}, 5)):
        b, ino = fixture(cls, **kwargs)
        before = snapshot(b)
        assert call(b, ino, 8 | 2048, size)[0] == errno.EOPNOTSUPP
        assert snapshot(b) == before
        count += 1
    # Existing sticky quota markers must also survive invalid flags unchanged.
    b, ino = fixture(cls)
    b.failure = 'previous quota marker'
    before = snapshot(b)
    assert call(b, ino, 8 | (1 << 31), 4097)[0] == errno.EOPNOTSUPP
    assert snapshot(b) == before
    return count + 1


def valid_controls(cls):
    count = 0
    for old, size in ((0, 0), (0, 1), (3, 4095), (4095, 4096),
                      (4096, 4097), (4097, 4096), (4096, 0), (3, 3)):
        for flags in (8, MASK):
            b, ino = fixture(cls, old)
            before = snapshot(b)
            expected = copy.deepcopy(before)
            original = bytes(before['nodes'][ino]['data'])
            expected['nodes'][ino]['data'] = bytearray(original[:size] + b'\0' * max(0, size-old))
            expected['live'] = 8192 + ((size + 4095) // 4096) * 4096
            expected['peak'] = max(before['peak'], expected['live'])
            expected['written'] = old + max(0, size-old)
            err, response = call(b, ino, flags, size)
            assert err is None and len(response) == 104
            assert struct.unpack_from('<Q', response, 24)[0] == size
            assert snapshot(b) == expected, ('valid state', old, size, flags)
            count += 1
    for flags in (0, MASK & ~8):
        b, ino = fixture(cls)
        before = snapshot(b)
        assert call(b, ino, flags, 999999)[0] is None
        assert snapshot(b) == before
        count += 1
    for kwargs, size, reason in (({'live': 12288}, 4097, 'filesystem allocation limit'),
                                  ({'write': 4}, 5, 'filesystem cumulative write limit'),
                                  ({'file': 4}, 5, 'filesystem per-file limit')):
        b, ino = fixture(cls, **kwargs)
        expected = snapshot(b)
        expected['failure'] = reason
        assert call(b, ino, 8, size)[0] == errno.ENOSPC
        assert snapshot(b) == expected, 'quota rejection only sets sticky failure'
        # A later quota rejection must retain the first marker.
        assert call(b, ino, 8, size)[0] == errno.ENOSPC
        assert snapshot(b) == expected
        count += 1
    for kwargs, size in (({'live': 12288}, 4096), ({'write': 4}, 4), ({'file': 4}, 4)):
        b, ino = fixture(cls, **kwargs)
        assert call(b, ino, 8, size)[0] is None
        assert len(b.nodes[ino]['data']) == size and b.failure is None
        count += 1
    return count


def focused_regressions(cls):
    b, ino = fixture(cls)
    child = b.create(1, b'dir', stat.S_IFDIR | 0o700)
    data = b.handle(28, child, struct.pack('<2QI', child, 0, 4096))
    entries = []
    while data:
        node, off, length, kind = struct.unpack_from('<2Q2I', data)
        entries.append((node, off, data[24:24+length], kind))
        data = data[(24+length+7)//8*8:]
    assert entries == [(child, 1, b'.', 4), (1, 2, b'..', 4)]
    for old, new, expected in ((b'file', b'dir', errno.EISDIR), (b'dir', b'file', errno.ENOTDIR)):
        for op in (12, 45):
            before = snapshot(b)
            req = struct.pack('<Q', 1) + (b'\0'*8 if op == 45 else b'') + old+b'\0'+new+b'\0'
            try:
                b.handle(op, 1, req)
            except OSError as e:
                assert e.errno == expected
            else:
                raise AssertionError('rename type guard missing')
            assert snapshot(b) == before
    return 5


def main():
    mode = sys.argv[1]
    source = SOURCE.read_text()
    cls = load(source)
    pin = {'bytes': len(source.encode()), 'sha256': hashlib.sha256(source.encode()).hexdigest()}
    if mode == 'baseline':
        assert pin == {'bytes': 11583, 'sha256': 'fae7307dd993cf56e2f05faffd2a12255c2c874a1b5d028ef0533caf0491a83c'}
        b, ino = fixture(cls)
        before = snapshot(b)
        wire = request(8 | 2048, 4097)
        err, _ = call(b, ino, 8 | 2048, 4097)
        after = snapshot(b)
        assert err == errno.EOPNOTSUPP and after != before
        assert (b.live, b.peak, b.written, len(b.nodes[ino]['data'])) == (16384, 16384, 4097, 4097)
        record = dict(mode=mode, sourcePin=pin, requestHex=wire.hex(), errno=err,
                      before=repr(before), after=repr(after), proven=True)
        (HERE / 'baseline-source.py.txt').write_text(source)
    else:
        # Replay the preserved binary counterexample before broader cases.
        baseline = json.loads((HERE / 'baseline.json').read_text())
        wire = bytes.fromhex(baseline['requestHex'])
        assert wire == request(8 | 2048, 4097)
        b, ino = fixture(cls)
        before = snapshot(b)
        try:
            b.handle(4, ino, wire)
        except OSError as e:
            assert e.errno == baseline['errno'] == errno.EOPNOTSUPP
        else:
            raise AssertionError('preserved reproducer accepted')
        assert snapshot(b) == before
        record = dict(mode=mode, sourcePin=pin, invalidCases=rejected(cls),
                      validControls=valid_controls(cls), focusedRegressions=focused_regressions(cls),
                      unchangedBinaryReproducer=True)
        guard = "            if valid&~(1|2|4|8|16|32|64|128|256|512|1024):raise OSError(errno.EOPNOTSUPP,'setattr flags')\n"
        assert source.count(guard) == 1
        removed = source.replace(guard, '')
        late = removed.replace("            return pack('2Q',0,0)+self.attr(ino)\n        if op==9:", guard + "            return pack('2Q',0,0)+self.attr(ino)\n        if op==9:")
        assert late != removed
        record['mutants'] = {}
        for name, mutant in (('guard-removed', removed), ('late-check', late)):
            try:
                rejected(load(mutant))
            except AssertionError as e:
                record['mutants'][name] = {'rejected': True, 'assertion': str(e)}
            else:
                raise AssertionError('mutant survived: ' + name)
        record['PASS'] = True
    (HERE / (mode + '.json')).write_text(json.dumps(record, indent=2) + '\n')
    print(json.dumps({k:v for k,v in record.items() if k not in ('before', 'after', 'requestHex')}))


if __name__ == '__main__':
    main()
