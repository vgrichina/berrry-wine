#!/usr/bin/env python3
"""Direct Backend.handle CREATE/MKDIR contracts; no mount or external processes."""
import copy
import errno
import hashlib
import importlib.util
import json
import pathlib
import stat
import struct
import types

HERE = pathlib.Path(__file__).resolve().parent
REPO = pathlib.Path('/tmp/toyvm-six-guards-compatible-fixture-continuation-oct29/repo')
SOURCE = REPO / "test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py"
PINS = {"test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py":{"bytes":8105,"sha256":"73c5bd33eb8af3887f5c6f21a8c6354aef591baf2d41589eb673c9d275448b60"},"test/toyvm-kernel-profile-accounting-backend-oct28/confine.py":{"bytes":3457,"sha256":"0b10df6497f359f9684f1dbb0752eba3816d0e6568c492c39f62ba3a3f2076d8"},"test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py":{"bytes":11111,"sha256":"b273dceaf1d648415fdc1c2aca54ab3d511c81b94bb911e6588a81e1b63c14dc"},"test/toyvm-kernel-profile-accounting-backend-oct28/supervise_accounted.py":{"bytes":4058,"sha256":"5ac463e9168b1162b47b784e919a6f71830d5581c5fbde14597f8e1e866eb3bf"},"test/toyvm-transient-profile-accounting-repair-oct28/pinned-supervisor.py":{"bytes":23268,"sha256":"9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85"}}
# JSON null/bools do not occur in this literal.
def pinned():
    for name, pin in PINS.items():
        blob = (REPO / name).read_bytes()
        assert len(blob) == pin["bytes"] and hashlib.sha256(blob).hexdigest() == pin["sha256"], name

def load(text):
    module = types.ModuleType("owned_backend")
    exec(compile(text, str(SOURCE), "exec"), module.__dict__)
    return module.Backend

def request(op, name):
    # handle opcode 9 reads mode at 0 and name at 8.
    # opcode 35 reads flags/mode at 0/4 and name at 16.
    return (struct.pack("<II", 0o751, 0) if op == 9 else
            struct.pack("<IIII", 0, 0o640, 0, 0)) + name + b"\0"

def snapshot(b):
    return copy.deepcopy({k: v for k, v in vars(b).items() if k != "operations"})

def node(directory, opens=0):
    return dict(mode=(stat.S_IFDIR | 0o751) if directory else (stat.S_IFREG | 0o640),
                data=bytearray(), names={}, links=1, opens=opens)

class Fixture:
    def __init__(self, cls):
        self.b = cls(HERE / "never-mounted", live_limit=65536)
        self.expected = {1: dict(mode=stat.S_IFDIR | 0o700, data=bytearray(),
                                names={}, links=1, opens=0)}
        self.next = 2
        self.calls = 0
        self.check()

    def check(self):
        b = self.b
        # Independent fixed metadata accounting; no implementation helper oracle.
        assert b.nodes == self.expected, ("namespace", b.nodes, self.expected)
        assert b.next == self.next
        assert b.live == b.peak == 4096 * len(self.expected)
        assert b.written == 0 and b.failure is None
        assert b.handles == sum(n["opens"] for n in self.expected.values())
        assert b.operations == self.calls

    def create(self, op, parent, name):
        ino = self.next
        self.calls += 1
        answer = self.b.handle(op, parent, request(op, name))
        self.expected[ino] = node(op == 9, int(op == 35))
        self.expected[parent]["names"][name] = ino
        self.next += 1
        assert len(answer) == (128 if op == 9 else 144)
        assert struct.unpack_from("<Q", answer)[0] == ino
        assert struct.unpack_from("<Q", answer, 40)[0] == ino
        assert struct.unpack_from("<I", answer, 100)[0] == self.expected[ino]["mode"]
        if op == 35:
            assert struct.unpack_from("<QII", answer, 128) == (ino, 1, 0)
        self.check()
        return ino

    def reject(self, op, parent, name, expected_errno):
        before = snapshot(self.b)
        self.calls += 1
        try:
            result = self.b.handle(op, parent, request(op, name))
        except OSError as exc:
            outcome = dict(type=type(exc).__name__, errno=exc.errno)
        except Exception as exc:
            outcome = dict(type=type(exc).__name__, detail=str(exc))
        else:
            outcome = dict(type="success", responseBytes=len(result))
        unchanged = snapshot(self.b) == before
        assert outcome.get("errno") == expected_errno and unchanged, dict(
            op=op, parent=parent, name=name.decode(), expectedErrno=expected_errno,
            actual=outcome, statePreserved=unchanged,
            before=dict(live=before["live"], next=before["next"],
                        inodes=len(before["nodes"]), handles=before["handles"]),
            after=dict(live=self.b.live, next=self.b.next,
                       inodes=len(self.b.nodes), handles=self.b.handles))
        self.check()

def collisions(cls):
    f = Fixture(cls)
    file = f.create(35, 1, b"file")
    directory = f.create(9, 1, b"dir")
    for parent in (1, directory):
        if parent != 1:
            f.create(35, parent, b"file")
            f.create(9, parent, b"dir")
        for op in (35, 9):
            for name in (b"file", b"dir"):
                f.reject(op, parent, name, errno.EEXIST)
    f.create(35, 1, b"sibling")
    nested = f.create(9, directory, b"nested")
    f.create(35, nested, b"leaf")
    f.create(9, nested, b"subdirectory")
    return dict(rejected=8, successful=8, rootCharge=4096, inodeCharge=4096)

def invalid_parent(cls, op, kind):
    f = Fixture(cls)
    parent = 999 if kind == "missing" else f.create(35, 1, b"file")
    f.reject(op, parent, b"child", errno.ENOENT if kind == "missing" else errno.ENOTDIR)

def main():
    pinned()
    text = SOURCE.read_text()
    cls = load(text)
    results = []
    for label, run in [("collision-and-controls", lambda: collisions(cls))] + [
        (str(op) + "-" + kind + "-parent", lambda op=op, kind=kind: invalid_parent(cls, op, kind))
        for op in (35, 9) for kind in ("missing", "nondirectory")]:
        try:
            details = run()
        except AssertionError as exc:
            results.append(dict(case=label, passed=False, counterexample=exc.args))
        else:
            results.append(dict(case=label, passed=True, details=details))
    original = "if name in n['names']:raise OSError(errno.EEXIST,'exists')"
    assert text.count(original) == 1
    mutants = {
        "omit-collision-check": "if False:raise OSError(errno.EEXIST,'exists')",
        "wrong-collision-errno": "if name in n['names']:raise OSError(errno.ENOENT,'exists')",
        "charge-before-collision": "if name in n['names']:\n            self.charge(4096)\n            raise OSError(errno.EEXIST,'exists')",
        "consume-inode-before-collision": "if name in n['names']:\n            self.next+=1\n            raise OSError(errno.EEXIST,'exists')",
    }
    mutation = []
    for name, replacement in mutants.items():
        owned = HERE / "mutants" / (name + ".py")
        owned.parent.mkdir(exist_ok=True)
        owned.write_text(text.replace(original, replacement))
        try:
            collisions(load(owned.read_text()))
        except AssertionError:
            mutation.append(dict(name=name, rejected=True,
                                 sha256=hashlib.sha256(owned.read_bytes()).hexdigest()))
        else:
            raise AssertionError("surviving mutant " + name)
    report = dict(scope="direct Backend.handle only; no mounted/kernel/browser/gameplay claims",
                  candidate="1fa831cbde34a5943fd7888b30409bd8e918663a",
                  sourcePins=PINS, results=results, mutations=mutation,
                  productionUnchanged=True,
                  remainingGate="combined repairs, caller backend pin, full CLI qualification")
    pinned()
    (HERE / "results.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(dict(passing=sum(r["passed"] for r in results),
                         failing=sum(not r["passed"] for r in results),
                         mutationsRejected=len(mutation), results=results), indent=2))
    # The evidence collector succeeds after recording expected contract failures.
    # --strict is a regression-test interface and fails until production is repaired.
    import sys
    if "--strict" in sys.argv and any(not r["passed"] for r in results):
        return 1
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
