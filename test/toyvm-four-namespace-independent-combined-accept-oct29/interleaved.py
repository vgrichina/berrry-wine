"""Independent declared namespace/accounting model; direct handles, no mounts."""
import copy
import errno
import hashlib
import json
from pathlib import Path
import stat
import struct
import types

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
DISPATCH = json.loads((HERE / 'current-dispatch.json').read_text())
SOURCE = ROOT / 'test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py'


def exercise(Backend):
    checks = 0
    trace = []
    for op in (12, 45):
        for seed in range(8):
            b = Backend(HERE / 'never-mounted-model', live_limit=262144)
            nodes = {1: dict(mode=stat.S_IFDIR | 0o700, data=bytearray(), names={}, links=1, opens=0)}
            live, peak, written, handles, nextino, operations = 4096, 4096, 0, 0, 2, 0

            def inspect(label):
                nonlocal checks
                expected = dict(nodes=nodes, live=live, peak=peak, written=written,
                                handles=handles, next=nextino, failure=None, operations=operations)
                actual = {k: getattr(b, k) for k in expected}
                assert actual == expected, (op, seed, label, actual, expected)
                checks += 1
                trace.append([op, seed, label, live, written, handles])

            def call(code, inode, data, expected_errno=0):
                nonlocal operations
                operations += 1
                before = copy.deepcopy(vars(b))
                try:
                    result = b.handle(code, inode, data)
                except OSError as e:
                    assert e.errno == expected_errno, (code, e.errno, expected_errno)
                    result = None
                else:
                    assert not expected_errno, ('unexpected success', code, expected_errno)
                if expected_errno:
                    after = copy.deepcopy(vars(b))
                    before['operations'] += 1
                    assert after == before, ('rejected operation mutated state', code)
                    inspect('error-' + str(code))
                return result

            def create(parent, name, directory):
                nonlocal nextino, live, peak, handles
                mode = (stat.S_IFDIR if directory else stat.S_IFREG) | 0o700
                data = struct.pack('<II', mode, 0) if directory else struct.pack('<IIII', 0, mode, 0, 0)
                out = call(9 if directory else 35, parent, data + name + b'\0')
                inode = nextino
                assert int.from_bytes(out[:8], 'little') == inode
                nextino += 1
                nodes[inode] = dict(mode=mode, data=bytearray(), names={}, links=1, opens=int(not directory))
                nodes[parent]['names'][name] = inode
                handles += int(not directory)
                live += 4096
                peak = max(peak, live)
                inspect('create')
                return inode

            def wire(parent, old, new):
                return struct.pack('<Q', parent) + (bytes(8) if op == 45 else b'') + old + b'\0' + new + b'\0'

            def move(parent, old, dest, new, error=0):
                call(op, parent, wire(dest, old, new), error)
                if not error:
                    nodes[dest]['names'][new] = nodes[parent]['names'].pop(old)
                    inspect('move')

            def readparent(inode, parent):
                names = [(inode, b'.', 4), (parent, b'..', 4)]
                names += [(i, n, 4 if stat.S_ISDIR(nodes[i]['mode']) else 8)
                          for n, i in nodes[inode]['names'].items()]
                records = []
                for cookie, (child, name, kind) in enumerate(names, 1):
                    raw = child.to_bytes(8, 'little') + cookie.to_bytes(8, 'little')
                    raw += len(name).to_bytes(4, 'little') + kind.to_bytes(4, 'little') + name
                    records.append(raw + bytes(-len(raw) % 8))
                for offset, size in ((0, 4096), (1, 32), (2, 4096), (0, 31)):
                    out = call(28, inode, struct.pack('<QQI', inode, offset, size))
                    expected = b''
                    for row in records[offset:]:
                        if len(expected) + len(row) > size:
                            break
                        expected += row
                    assert out == expected, ('READDIR', op, seed, inode, offset, size, out.hex(), expected.hex())
                    inspect('readparent')

            def remove(parent, name, directory, error=0):
                nonlocal live
                call(11 if directory else 10, parent, name + b'\0', error)
                if not error:
                    child = nodes[parent]['names'].pop(name)
                    nodes[child]['links'] -= 1
                    if not nodes[child]['opens']:
                        live -= 4096 + ((len(nodes[child]['data']) + 4095) // 4096) * 4096
                        del nodes[child]
                    inspect('remove')

            a = create(1, b'a', True)
            z = create(1, b'z', True)
            c = create(a, b'child,' + bytes([65 + seed]), True)
            f = create(a, b'file', False)
            payload = bytes([seed + 1]) * (seed + 1)
            assert call(16, f, struct.pack('<QQI', f, 0, len(payload)) + bytes(20) + payload) == struct.pack('<II', len(payload), 0)
            nodes[f]['data'] = bytearray(payload)
            live += 4096
            peak = max(peak, live)
            written += len(payload)
            inspect('write')
            childname = b'child,' + bytes([65 + seed])
            readparent(c, a)
            move(a, b'file', a, childname, errno.EISDIR)
            move(a, childname, a, b'file', errno.ENOTDIR)
            move(1, b'a', c, b'loop', errno.EINVAL)
            remove(a, childname, False, errno.EISDIR)
            remove(a, b'file', True, errno.ENOTDIR)
            move(a, childname, z, b'moved')
            readparent(c, z)
            move(a, b'file', c, b'payload')
            remove(z, b'moved', True, errno.ENOTEMPTY)
            readparent(c, z)
            remove(c, b'payload', False)
            assert call(15, f, struct.pack('<QQI', f, 0, len(payload))) == payload
            inspect('read-open-unlinked')
            call(18, f, struct.pack('<Q', f))
            handles -= 1
            live -= 8192
            del nodes[f]
            inspect('release-collect')
            remove(z, b'moved', True)
            readparent(a, 1)
            readparent(z, 1)
            remove(1, b'a', True)
            remove(1, b'z', True)
            readparent(1, 1)
    return dict(sequences=16, checks=checks, traceSha256=hashlib.sha256(json.dumps(trace).encode()).hexdigest())


def load(source):
    m = types.ModuleType('isolated_backend')
    exec(compile(source, str(SOURCE), 'exec'), m.__dict__)
    return m.Backend


def main():
    for name, pin in DISPATCH['sourcePins'].items():
        raw = (ROOT / name).read_bytes()
        assert dict(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest()) == pin
    raw = SOURCE.read_bytes()
    try:
        result = exercise(load(raw))
    except BaseException as e:
        (HERE / 'interleaved-first-counterexample.json').write_text(json.dumps(dict(error=repr(e)), indent=2))
        raise
    source = raw.decode()
    changes = {
        'rename-type': ("if not source_is_dir and dest_is_dir:", "if False:"),
        'cycle': ("if child==newdir:", "if False:"),
        'removal': ("if op==10 and stat.S_ISDIR(self.nodes[child]['mode']):", "if False:"),
        'readparent': ("(b'..',parent)", "(b'..',1)"),
    }
    controls = {}
    for label, (old, new) in changes.items():
        assert source.count(old) == 1
        mutant = source.replace(old, new)
        try:
            exercise(load(mutant))
        except (AssertionError, OSError, KeyError) as e:
            controls[label] = dict(rejected=True, firstCounterexample=repr(e), sha256=hashlib.sha256(mutant.encode()).hexdigest())
        else:
            raise AssertionError('surviving mutant: ' + label)
    assert SOURCE.read_bytes() == raw
    result.update(status='PASS', candidate=DISPATCH['candidate'], sourcePins=DISPATCH['sourcePins'], controls=controls,
                  scope='direct Backend.handle namespace and accounting only')
    (HERE / 'interleaved-results.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result))


if __name__ == '__main__':
    main()
