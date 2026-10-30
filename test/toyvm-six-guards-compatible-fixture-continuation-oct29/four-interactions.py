"""Four-repair interactions through the exact production Backend.handle."""
import copy
import errno
import hashlib
import importlib.util
import json
from pathlib import Path
import stat
import struct

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent / 'toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py'
PIN = 'cc2dc7ab2f9b5d1b84b755c61e7a6ffc3e226d52ffe008edf7ace5310cbdc105'
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == PIN
spec = importlib.util.spec_from_file_location('production_interactions', SOURCE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
rows = []
for op in (12, 45):
    b = module.Backend(HERE / 'never-mounted-four', live_limit=131072)
    a = b.create(1, b'a', stat.S_IFDIR | 0o700)
    child = b.create(a, b'child', stat.S_IFDIR | 0o700)
    q = b.create(1, b'q', stat.S_IFDIR | 0o700)
    f = b.create(a, b'f', stat.S_IFREG | 0o600)
    b.resize(f, 7)
    b.nodes[f]['data'][:] = b'payload'

    def wire(parent, old, new):
        return struct.pack('<Q', parent) + (struct.pack('<II', 0, 0) if op == 45 else b'') + old + b'\0' + new + b'\0'

    def parent_of(inode, expected):
        before = copy.deepcopy({k: v for k, v in vars(b).items() if k != 'operations'})
        count = b.operations
        raw = b.handle(28, inode, struct.pack('<QQI', 0, 1, 32))
        expected_wire = struct.pack('<QQII', expected, 2, 2, 4) + b'..' + bytes(6)
        assert raw == expected_wire
        assert {k: v for k, v in vars(b).items() if k != 'operations'} == before
        assert b.operations == count + 1
        rows.append(dict(op=op, case='actual-parent', inode=inode, parent=expected))

    def denied(label, opcode, inode, payload, expected):
        before = copy.deepcopy({k: v for k, v in vars(b).items() if k != 'operations'})
        identities = {i: (id(n), id(n['data']), id(n['names'])) for i, n in b.nodes.items()}
        count = b.operations
        try:
            b.handle(opcode, inode, payload)
        except OSError as exc:
            assert exc.errno == expected, (label, exc.errno, expected)
        else:
            raise AssertionError(label)
        assert {k: v for k, v in vars(b).items() if k != 'operations'} == before
        assert identities == {i: (id(n), id(n['data']), id(n['names'])) for i, n in b.nodes.items()}
        assert b.operations == count + 1
        rows.append(dict(op=op, case=label, errno=expected))

    parent_of(child, a)
    denied('cycle-preserves-parent', op, 1, wire(child, b'a', b'bad'), errno.EINVAL)
    parent_of(child, a)
    denied('file-over-directory', op, a, wire(a, b'f', b'child'), errno.EISDIR)
    denied('directory-over-file', op, a, wire(a, b'child', b'f'), errno.ENOTDIR)
    denied('unlink-directory', 10, a, b'child\0', errno.EISDIR)
    denied('rmdir-file', 11, a, b'f\0', errno.ENOTDIR)
    parent_of(child, a)
    assert b.handle(op, a, wire(q, b'child', b'moved')) == b''
    parent_of(child, q)
    assert b.handle(op, a, wire(child, b'f', b'payload')) == b''
    assert bytes(b.nodes[f]['data']) == b'payload'
    denied('nonempty-moved-directory', 11, q, b'moved\0', errno.ENOTEMPTY)
    parent_of(child, q)
    assert b.handle(10, child, b'payload\0') == b''
    assert f not in b.nodes
    assert b.handle(11, q, b'moved\0') == b''
    assert child not in b.nodes
    assert b.handle(11, 1, b'a\0') == b''
    assert a not in b.nodes and b.live == 8192 and b.failure is None
    assert b.nodes[1]['names'] == {b'q': q}
    rows.append(dict(op=op, case='rename-removal-accounting', live=b.live))
report = dict(status='PASS', sourceSha256=PIN, checks=len(rows), rows=rows,
              scope='direct Backend.handle only')
(HERE / 'four-interactions.json').write_text(json.dumps(report, indent=2) + '\n')
print('PASS %d four-repair interaction checks' % len(rows))
