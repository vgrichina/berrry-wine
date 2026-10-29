#!/usr/bin/env python3
"""Independent raw-wire oracle for direct READDIR callback behavior only."""
import errno
import hashlib
import importlib.util
import json
import pathlib
import stat
import struct

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
DISPATCH = pathlib.Path("/tmp/toyvm-four-namespace-independent-combined-accept-oct29/repo/test/toyvm-four-namespace-independent-combined-accept-oct29/current-dispatch.json")
BACKEND = "test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py"

class Mismatch(AssertionError):
    def __init__(self, detail):
        self.detail = detail
        super().__init__(str(detail))

def load(path):
    spec = importlib.util.spec_from_file_location("independent_backend", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.Backend

def record(inode, cookie, name, kind):
    # Independent encoding: explicit little-endian fields, no production pack/parser.
    header = b"".join(value.to_bytes(width, "little") for value, width in
                      [(inode, 8), (cookie, 8), (len(name), 4), (kind, 4)])
    encoded = header + name
    return encoded + bytes((-len(encoded)) % 8)

def exercise(Backend):
    backend = Backend(HERE / "never-mounted-independent", live_limit=131072)
    # Ordered expected records and parent edges are declared from operations,
    # never inferred from backend.nodes.
    children = {1: []}
    parents = {1: 1}
    kinds = {1: 4}
    for parent, name, inode, kind in [
        (1, b"west", 2, 4), (2, b"middle", 3, 4),
        (3, b"deep", 4, 4), (1, b"east", 5, 4),
        (3, b"file,comma", 6, 8), (2, b"seven77", 7, 4),
        (2, b"eight888", 8, 4), (2, b"nine99999", 9, 4),
        (4, "caf\u00e9".encode(), 10, 4), (4, b"raw-\xff", 11, 4),
        (5, b"z" * 255, 12, 4),
    ]:
        if kind == 4:
            response = backend.handle(9, parent, struct.pack("<II", stat.S_IFDIR | 0o700, 0) + name + b"\0")
            children[inode] = []
            parents[inode] = parent
        else:
            response = backend.handle(35, parent, struct.pack("<IIII", 0, stat.S_IFREG | 0o600, 0, 0) + name + b"\0")
        assert int.from_bytes(response[:8], "little") == inode
        children[parent].append((inode, name, kind))
        kinds[inode] = kind
    count = 0
    digest = hashlib.sha256()
    def inspect(stage):
        nonlocal count
        for inode, entries in children.items():
            rows = [(inode, b".", 4), (parents[inode], b"..", 4)] + entries
            encoded = [record(child, index + 1, name, kind)
                       for index, (child, name, kind) in enumerate(rows)]
            sizes = {0, 1, 23, 24, 31, 32, 33, 63, 64, 65, 4096, 65536}
            # Every prefix boundary, including the boundary after resuming.
            for start in range(len(rows)):
                used = 0
                for item in encoded[start:]:
                    used += len(item)
                    sizes.update((used - 1, used, used + 1))
            for offset in list(range(len(rows) + 3)) + [2**64 - 1]:
                for size in sorted(sizes):
                    expected = b""
                    for item in encoded[offset:]:
                        if len(expected) + len(item) > size:
                            break
                        expected += item
                    request = struct.pack("<QQI", inode, offset, size)
                    actual = backend.handle(28, inode, request)
                    detail = dict(stage=stage, inode=inode, offset=offset, size=size,
                                  requestHex=request.hex(), expectedHex=expected.hex(),
                                  actualHex=actual.hex())
                    if actual != expected:
                        raise Mismatch(detail)
                    digest.update(request + expected)
                    count += 1
    inspect("initial-root-child-deep-raw-names")
    for oldparent, oldname, newparent, newname in [
        (2, b"middle", 5, b"moved"),
        (5, b"moved", 1, b"raised"),
        (1, b"raised", 2, b"returned"),
        (2, b"seven77", 2, b"same-parent-renamed"),
    ]:
        assert backend.handle(12, oldparent, struct.pack("<Q", newparent) + oldname + b"\0" + newname + b"\0") == b""
        index = next(i for i, entry in enumerate(children[oldparent]) if entry[1] == oldname)
        child, _, kind = children[oldparent].pop(index)
        children[newparent].append((child, newname, kind))
        parents[child] = newparent
        inspect("move-" + newname.decode())
    # Deliberate corrupt-state injection only: no claim these are supported
    # namespace operations. Valid namespace behavior was checked above.
    eio = 0
    def expect_eio(label):
        nonlocal eio
        for offset, size in [(0, 0), (0, 64), (1, 32), (2, 4096), (2**64 - 1, 0)]:
            try:
                backend.handle(28, 3, struct.pack("<QQI", 3, offset, size))
            except OSError as error:
                assert error.errno == errno.EIO, (label, error.errno)
                eio += 1
            else:
                raise AssertionError(label + " accepted")
    backend.nodes[5]["names"][b"fault-alias"] = 3
    expect_eio("ambiguous-parent")
    del backend.nodes[5]["names"][b"fault-alias"]
    del backend.nodes[2]["names"][b"returned"]
    expect_eio("missing-parent")
    return dict(wireCases=count, observationSha256=digest.hexdigest(), corruptStateEIOCases=eio)

def main():
    dispatch = json.loads(DISPATCH.read_text())
    for name, pin in dispatch["sourcePins"].items():
        raw = (ROOT / name).read_bytes()
        assert dict(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest()) == pin, name
    gate = json.loads((HERE / "gate-results.json").read_text())
    assert gate["status"] == "PASS" and gate["sourcePins"] == dispatch["sourcePins"]
    source = (ROOT / BACKEND).read_text()
    try:
        production = exercise(load(ROOT / BACKEND))
    except Exception as error:
        detail = error.detail if isinstance(error, Mismatch) else dict(error=repr(error))
        (HERE / "production-counterexample.json").write_text(json.dumps(detail, indent=2) + "\n")
        raise
    changes = {
        "rootconstant": ("(b'..',parent)", "(b'..',1)"),
        "wrongparent": ("parent=parents[0]", "parent=ino"),
        "wrongdot": ("(b'.',ino)", "(b'.',1)"),
        "offset-skip": ("if i<offset:continue", "if i<=offset:continue"),
        "offset-cookie": ("child,i+1,len(name),kind", "child,i,len(name),kind"),
        "wrong-name-length": ("child,i+1,len(name),kind", "child,i+1,len(name)+1,kind"),
        "wrong-dot-type": ("kind=4 if stat.S_ISDIR", "kind=8 if stat.S_ISDIR"),
    }
    mutants = HERE / "mutants"
    mutants.mkdir(exist_ok=True)
    rejected = {}
    for name, (before, after) in changes.items():
        assert source.count(before) == 1
        path = mutants / (name + ".py")
        path.write_text(source.replace(before, after))
        try:
            exercise(load(path))
        except Mismatch as error:
            rejected[name] = dict(status="REJECTED", firstCounterexample=error.detail,
                                  sourceSha256=hashlib.sha256(path.read_bytes()).hexdigest())
        else:
            raise AssertionError(name + " escaped independent oracle")
    result = dict(status="PASS", candidate=dispatch["candidate"], sourcePins=dispatch["sourcePins"],
                  scope="direct Backend.handle op28 source behavior only", production=production,
                  rejectingSourceCopyControls=rejected,
                  remainingGates=["combined repairs", "caller still pins OLD backend", "full CLI qualification"])
    (HERE / "independent-results.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(dict(status="PASS", production=production, rejected=list(rejected))))
if __name__ == "__main__":
    main()
