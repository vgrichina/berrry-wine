#!/usr/bin/env python3
"""Independent binary op4 acceptance, source callback scope only; no subprocesses."""
import copy
import errno
import hashlib
import json
from pathlib import Path
import stat
import struct

HERE = Path(__file__).resolve().parent
SOURCE = Path('/tmp/toyvm-six-accepted-guards-candidate-oct29/repo/test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py')
PIN = 'cc2dc7ab2f9b5d1b84b755c61e7a6ffc3e226d52ffe008edf7ace5310cbdc105'
COUNTS = {}


def load(text):
    namespace = {'__name__': 'independent_backend', '__file__': str(SOURCE)}
    exec(compile(text, str(SOURCE), 'exec'), namespace)
    return namespace['Backend']


def setup(cls, old=17, limits=(65536, 65536, 32768), sticky=None):
    b = cls(str(HERE / 'never-mounted'), *limits)
    # Add a second inode to detect collateral namespace/accounting changes.
    ino = b.create(1, b'target', stat.S_IFREG | 0o640)
    other = b.create(1, b'witness', stat.S_IFREG | 0o600)
    b.nodes[ino]['data'] = bytearray((n * 73 + 9) % 256 for n in range(old))
    b.nodes[other]['data'] = bytearray(b'witness-data')
    b.nodes[ino]['opens'] = 2
    b.nodes[other]['opens'] = 1
    b.handles = 3
    b.written = old + 12
    b.live = 3 * 4096 + ((old + 4095) // 4096) * 4096 + 4096
    b.peak = b.live + 4096
    b.failure = sticky
    return b, ino


def state(b):
    return copy.deepcopy({k: v for k, v in vars(b).items() if k != 'operations'})


def wire(flags, size, length=88):
    # Independent builder: poison all unused fields and write only valid/size.
    buf = bytearray(b'\xa5' * max(24, length))
    buf[0:4] = int(flags).to_bytes(4, 'little')
    buf[16:24] = int(size).to_bytes(8, 'little')
    return bytes(buf[:length])


def invoke(b, ino, data):
    before_ops = b.operations
    try:
        reply = b.handle(4, ino, data)
        result = ('ok', reply)
    except OSError as exc:
        result = ('errno', exc.errno)
    except (KeyError, struct.error) as exc:
        result = (type(exc).__name__, None)
    assert b.operations == before_ops + 1
    return result


def unchanged(cls, flags, size, expected, *, length=88, missing=False,
              limits=(65536, 65536, 32768), sticky=None, group='invalid'):
    b, ino = setup(cls, limits=limits, sticky=sticky)
    before = state(b)
    answer = invoke(b, 999999 if missing else ino, wire(flags, size, length))
    assert answer == expected, (group, flags, size, length, answer, expected)
    assert state(b) == before, (group, 'state corruption', flags, size, length)
    COUNTS[group] = COUNTS.get(group, 0) + 1


def cases(cls):
    # Every unsupported bit alone and alongside size/all supported flags, with
    # shrinking, same-size, growth, and maximal uint64 quota-overflow requests.
    for bit in range(11, 32):
        for flags in (1 << bit, (1 << bit) | 8, (1 << bit) | 2047):
            for size in (0, 17, 4097, 2**64 - 1):
                unchanged(cls, flags, size, ('errno', errno.EOPNOTSUPP))
    for flags in (0xffffffff, 0xfffff800):
        for missing in (False, True):
            for length in (4, 15, 16, 23, 24, 87, 88, 89, 104):
                unchanged(cls, flags, 2**64-1, ('errno', errno.EOPNOTSUPP),
                          missing=missing, length=length, group='invalid-length-node')
    # A malformed valid field cannot decode; all remaining fields/state survive.
    for length in range(4):
        unchanged(cls, 0xffffffff, 4097, ('error', None), length=length, group='short-valid')
    for length in (4, 15, 16, 23):
        unchanged(cls, 8, 4097, ('error', None), length=length, group='short-size')
    # Missing-node supported requests currently propagate KeyError directly.
    # This characterizes the raw callback only; no wire-level ENOENT claim.
    for flags in (0, 8, 2047):
        unchanged(cls, flags, 4097, ('KeyError', None), missing=True, group='missing-supported')
    for limits in ((20480, 29, 17), (20480, 65536, 17), (20480, 65536, 32768)):
        for sticky in (None, 'earlier-sticky-failure'):
            unchanged(cls, 0x80000008, 4097, ('errno', errno.EOPNOTSUPP),
                      limits=limits, sticky=sticky, group='invalid-quota-precedence')
    # Exhaust supported mask space. Only bit3 changes data/accounting; poison
    # mode/time/owner fields must have no effect on this allocation-domain model.
    for flags in range(2048):
        for length in ((4,) if not flags & 8 else (24,)):
            b, ino = setup(cls)
            before = state(b)
            size = (0, 17, 4097)[flags % 3]
            expected = copy.deepcopy(before)
            if flags & 8:
                old = bytes(before['nodes'][ino]['data'])
                expected['nodes'][ino]['data'] = bytearray(old[:size] + bytes(max(0, size-len(old))))
                expected['live'] += (((size+4095)//4096)-1)*4096
                expected['peak'] = max(before['peak'], expected['live'])
                expected['written'] += max(0, size-len(old))
            answer = invoke(b, ino, wire(flags, size, length))
            assert answer[0] == 'ok' and len(answer[1]) == 104, (flags, answer)
            assert int.from_bytes(answer[1][24:32], 'little') == (size if flags & 8 else 17)
            assert state(b) == expected, ('supported state', flags, size)
            COUNTS['supported-masks'] = COUNTS.get('supported-masks', 0) + 1
    # Supported quota precedence is cumulative-write, then per-file, allocation.
    quota_cases = [((20480, 29, 17), 'filesystem cumulative write limit'),
                   ((20480, 65536, 17), 'filesystem per-file limit'),
                   ((20480, 65536, 32768), 'filesystem allocation limit')]
    for limits, reason in quota_cases:
        for sticky in (None, 'earlier-sticky-failure'):
            b, ino = setup(cls, limits=limits, sticky=sticky)
            expected = state(b)
            expected['failure'] = sticky or reason
            for _ in range(2):
                assert invoke(b, ino, wire(8, 4097)) == ('errno', errno.ENOSPC)
                assert state(b) == expected, ('quota state', limits, sticky)
                COUNTS['supported-quota-sticky'] = COUNTS.get('supported-quota-sticky', 0) + 1
    # Rounding boundaries use an independent accounting oracle and nontrivial peak.
    for old, size in ((0, 1), (1, 0), (4095, 4096), (4096, 4097),
                      (4097, 4096), (8192, 8193), (8193, 0)):
        for length in (24, 87, 88, 89, 104):
            b, ino = setup(cls, old=old)
            before = state(b)
            expected = copy.deepcopy(before)
            original = bytes(before['nodes'][ino]['data'])
            expected['nodes'][ino]['data'] = bytearray(original[:size] + bytes(max(0,size-old)))
            expected['live'] += (((size+4095)//4096)-((old+4095)//4096))*4096
            expected['peak'] = max(before['peak'], expected['live'])
            expected['written'] += max(0, size-old)
            assert invoke(b, ino, wire(8, size, length))[0] == 'ok'
            assert state(b) == expected
            COUNTS['rounding-length-boundaries'] = COUNTS.get('rounding-length-boundaries', 0) + 1


def main():
    source = SOURCE.read_bytes()
    assert len(source) == 12482 and hashlib.sha256(source).hexdigest() == PIN
    cls = load(source.decode())
    try:
        cases(cls)
    except Exception as exc:
        (HERE / 'counterexample.json').write_text(json.dumps({'failure':repr(exc),'completed':COUNTS},indent=2)+'\n')
        raise
    text = source.decode()
    guard = "            if valid&~(1|2|4|8|16|32|64|128|256|512|1024):raise OSError(errno.EOPNOTSUPP,'setattr flags')\n"
    assert text.count(guard) == 1
    removed = text.replace(guard, '')
    anchor = "            return pack('2Q',0,0)+self.attr(ino)\n        if op==9:"
    assert removed.count(anchor) == 1
    late = removed.replace(anchor, guard + anchor)
    mutants = {}
    for name, mutated in (('removed-guard', removed), ('late-guard', late)):
        path = HERE / (name + '.py.txt')
        path.write_text(mutated)
        b, ino = setup(load(path.read_text()))
        before = state(b)
        request = wire(0x808, 4097)
        result = invoke(b, ino, request)
        after = state(b)
        assert after != before, ('mutant failed to expose corruption', name)
        assert len(after['nodes'][ino]['data']) == 4097
        changed = sorted(k for k in before if before[k] != after[k])
        mutants[name] = {'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
                         'rejectedForCorruption':True, 'changedStateFields':changed,
                         'outcome':result[0], 'errno':result[1] if result[0]=='errno' else None,
                         'requestHex':request.hex()}
    assert SOURCE.read_bytes() == source, 'production source changed'
    record = {'PASS':True, 'sourcePin':{'bytes':len(source),'sha256':PIN},
              'groups':COUNTS, 'total':sum(COUNTS.values()), 'mutants':mutants,
              'scope':'direct exact-pinned Backend.handle op4; no mounted/kernel/CLI/runtime claims',
              'oracle':'deepcopy all instance state except operations; each call increments operations exactly once'}
    (HERE / 'independent-results.json').write_text(json.dumps(record,indent=2)+'\n')
    print(json.dumps(record))


if __name__ == '__main__':
    main()
