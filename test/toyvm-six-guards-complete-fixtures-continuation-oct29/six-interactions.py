#!/usr/bin/env python3
"""Combined six-guard interactions at exact pinned Backend.handle; never mounts."""
import copy
import errno
import hashlib
import importlib.util
import json
from pathlib import Path
import stat
import struct

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
DISPATCH = json.loads((HERE / "current-dispatch.json").read_text())

def pins():
    for name, pin in DISPATCH["sourcePins"].items():
        raw = (ROOT / name).read_bytes()
        assert dict(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest()) == pin, name

def main():
    pins()
    path = ROOT / "test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py"
    spec = importlib.util.spec_from_file_location("six_guard_production", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    rows = []
    for rename_op in (12, 45):
        b = module.Backend(HERE / "never-mounted-six", live_limit=131072)
        def state():
            return copy.deepcopy({k: v for k, v in vars(b).items() if k != "operations"})
        def identities():
            return {i: (id(n), id(n["data"]), id(n["names"])) for i, n in b.nodes.items()}
        def create(op, parent, name):
            ino, live, count, handles = b.next, b.live, b.operations, b.handles
            data = (struct.pack("<II", 0o700, 0) if op == 9 else
                    struct.pack("<IIII", 0, 0o600, 0, 0)) + name + b"\0"
            reply = b.handle(op, parent, data)
            assert int.from_bytes(reply[:8], "little") == ino
            assert len(reply) == (128 if op == 9 else 144)
            assert b.nodes[parent]["names"][name] == ino
            assert b.live == live + 4096 and b.operations == count + 1
            assert b.handles == handles + int(op == 35)
            rows.append(dict(renameOp=rename_op, case="valid-create", op=op, parent=parent, inode=ino))
            return ino
        def rename(parent, old, new):
            return (struct.pack("<Q", parent) +
                    (bytes(8) if rename_op == 45 else b"") + old + b"\0" + new + b"\0")
        def reject(label, op, inode, data, error):
            before, refs, count = state(), identities(), b.operations
            try:
                b.handle(op, inode, data)
            except OSError as exc:
                assert exc.errno == error, (label, exc.errno, error)
            else:
                raise AssertionError(label + " accepted")
            assert state() == before and identities() == refs, label
            assert b.operations == count + 1
            rows.append(dict(renameOp=rename_op, case=label, errno=error))
        def readdir(inode, expected):
            encoded = []
            for index, (child, name, kind) in enumerate(expected):
                record = struct.pack("<QQII", child, index + 1, len(name), kind) + name
                encoded.append(record + bytes((-len(record)) % 8))
            for offset in range(len(expected) + 2):
                for size in (0, 31, 32, 33, 63, 64, 128, 4096):
                    want = b""
                    for record in encoded[offset:]:
                        if len(want) + len(record) > size:
                            break
                        want += record
                    before, count = state(), b.operations
                    actual = b.handle(28, inode, struct.pack("<QQI", inode, offset, size))
                    assert actual == want, (inode, offset, size, actual.hex(), want.hex())
                    assert state() == before and b.operations == count + 1
                    rows.append(dict(renameOp=rename_op, case="readdir", inode=inode, offset=offset, size=size))
        a = create(9, 1, b"a")
        moved = create(9, a, b"child")
        q = create(9, 1, b"q")
        payload = create(35, moved, b"payload")
        data = b"payload"
        assert b.handle(16, payload, struct.pack("<QQIIQII", payload, 0, len(data), 0, 0, 0, 0) + data) == struct.pack("<II", len(data), 0)
        assert b.handle(rename_op, a, rename(q, b"child", b"moved")) == b""
        lower = create(9, moved, b"lower")
        added = create(35, moved, b"added,comma")
        assert b.live == b.peak == 32768 and b.written == 7 and b.handles == 2
        expected = [(moved, b".", 4), (q, b"..", 4),
                    (payload, b"payload", 8), (lower, b"lower", 4), (added, b"added,comma", 8)]
        readdir(moved, expected)
        # Full allocation makes any late parent/SETATTR check observable.
        b.live_limit = b.live
        for op in (35, 9):
            header = struct.pack("<IIII", 0, 0o600, 0, 0) if op == 35 else struct.pack("<II", 0o700, 0)
            reject("file-parent-create", op, payload, header + b"child\0", errno.ENOTDIR)
            reject("missing-parent-create", op, 999999, header + b"child\0", errno.ENOENT)
        for size in (0, 7, 4097):
            request = bytearray(88)
            struct.pack_into("<I", request, 0, 0x808)
            struct.pack_into("<Q", request, 16, size)
            reject("invalid-setattr-unchanged", 4, payload, bytes(request), errno.EOPNOTSUPP)
        reject("cycle-after-move-and-create", rename_op, 1, rename(lower, b"q", b"cycle"), errno.EINVAL)
        reject("file-over-directory", rename_op, moved, rename(moved, b"payload", b"lower"), errno.EISDIR)
        reject("directory-over-file", rename_op, moved, rename(moved, b"lower", b"payload"), errno.ENOTDIR)
        reject("unlink-directory", 10, q, b"moved\0", errno.EISDIR)
        reject("rmdir-file", 11, moved, b"payload\0", errno.ENOTDIR)
        reject("rmdir-nonempty-moved", 11, q, b"moved\0", errno.ENOTEMPTY)
        readdir(moved, expected)
        readdir(lower, [(lower, b".", 4), (moved, b"..", 4)])
        for inode, name, charge in ((payload, b"payload", 8192), (added, b"added,comma", 4096)):
            live = b.live
            assert b.handle(10, moved, name + b"\0") == b""
            assert inode in b.nodes and b.nodes[inode]["links"] == 0 and b.live == live
            assert b.handle(18, inode, struct.pack("<Q", inode)) == b""
            assert inode not in b.nodes and b.live == live - charge
        for parent, name, inode in ((moved, b"lower", lower), (q, b"moved", moved), (1, b"a", a), (1, b"q", q)):
            assert b.handle(11, parent, name + b"\0") == b""
            assert inode not in b.nodes
        assert b.live == 4096 and b.peak == 32768 and b.written == 7
        assert b.handles == 0 and b.failure is None and b.nodes[1]["names"] == {}
        rows.append(dict(renameOp=rename_op, case="complete-cleanup", live=b.live, peak=b.peak, written=b.written))
    pins()
    result = dict(status="PASS", candidate=DISPATCH["candidate"], sourcePins=DISPATCH["sourcePins"],
                  checks=len(rows), rows=rows,
                  scope="implementation continuation: exact production direct callbacks; fresh independent six-candidate acceptance remains required")
    (HERE / "six-interactions.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(dict(status="PASS", checks=len(rows), renameOpcodes=[12, 45])))

if __name__ == "__main__":
    main()
