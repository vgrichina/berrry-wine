"""Independent source-only caller/loader adversaries; never invoke adapter."""
import argparse
import hashlib
import importlib.util
import json
import pathlib
import shutil
import struct
import sys
import types
import marshal

CALLER = "test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py"
ADAPTER = "test/toyvm-kernel-profile-accounting-backend-oct28/supervise_accounted.py"
BACKEND = "test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py"
OLD = "e281eb058cee5e65797566c738d0330d2449ec6fe84572d572cfbf181c32ec41"
NEW = "cc2dc7ab2f9b5d1b84b755c61e7a6ffc3e226d52ffe008edf7ace5310cbdc105"


def digest(p):
    b = p.read_bytes()
    return {"bytes": len(b), "sha256": hashlib.sha256(b).hexdigest()}


def fresh(path):
    spec = importlib.util.spec_from_file_location("independent_caller", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", type=pathlib.Path, required=True)
    ap.add_argument("--receipt", type=pathlib.Path, required=True)
    ap.add_argument("--fixtures", type=pathlib.Path, required=True)
    ap.add_argument("--output", type=pathlib.Path, required=True)
    args = ap.parse_args()
    repo = args.repo.resolve(strict=True)
    receipt = json.loads(args.receipt.read_text())
    pins = receipt["sourcePinsAfter"]
    assert all(digest(repo / p) == v for p, v in pins.items())
    assert receipt["commit"] == "7f64decb2bbbfc71cd925e79200dedbeaad6326e"
    rows = []
    args.fixtures.mkdir(parents=True, exist_ok=True)
    def fixture(name):
        root = args.fixtures.resolve() / name
        assert not root.exists(), "fresh fixture required"
        for rel in pins:
            dest = root / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(repo / rel, dest)
        return root
    def record(name, **fields):
        rows.append(dict(name=name, **fields))
        args.output.write_text(json.dumps(dict(checks=rows, sourcePins=pins), indent=2) + "\n")
    def reject(root, rel):
        m = fresh(root / CALLER)
        # Observe the actual import boundary without executing or replacing it.
        events = []
        original = m.importlib.util.spec_from_file_location
        def observe(*a, **kw):
            events.append(str(a[1]))
            return original(*a, **kw)
        m.importlib.util.spec_from_file_location = observe
        try:
            try:
                m.load_backend()
            except (RuntimeError, FileNotFoundError) as exc:
                assert not events, "adapter import preceded rejection"
                if isinstance(exc, RuntimeError):
                    assert str(exc) == "accepted backend identity mismatch: " + rel.removeprefix("test/")
                else:
                    assert pathlib.Path(exc.filename) == root / rel
                return type(exc).__name__
            raise AssertionError("FAIL-OPEN: dependency accepted: " + rel)
        finally:
            m.importlib.util.spec_from_file_location = original
    root = fixture("correct")
    m = fresh(root / CALLER)
    f = m.load_backend()
    assert f.__name__ == "supervise_accounted"
    assert f.__module__ == "accepted_accounted_adapter"
    assert pathlib.Path(f.__code__.co_filename).resolve() == root / ADAPTER
    assert pathlib.Path(f.__globals__["__file__"]).resolve() == root / ADAPTER
    expected = types.ModuleType("reference")
    expected.__file__ = str(root / ADAPTER)
    exec(compile((root / ADAPTER).read_bytes(), str(root / ADAPTER), "exec"), expected.__dict__)
    assert f.__code__ == expected.supervise_accounted.__code__
    record("correct-real-adapter", status="PASS", origin=str(root / ADAPTER))
    deps = [p for p in pins if p != CALLER]
    for rel in deps:
        for mode in ("tampered", "missing", "wrong-file"):
            root = fixture(str(len(rows)))
            if mode == "tampered":
                (root / rel).write_bytes((root / rel).read_bytes() + b"\n# identity adversary\n")
            elif mode == "missing":
                (root / rel).unlink()
            else:
                (root / rel).write_bytes((root / CALLER).read_bytes())
            record(mode + ":" + rel, status="PASS", rejection=reject(root, rel))
    root = fixture("old-pin")
    s = (root / CALLER).read_text()
    assert s.count(NEW) == 1
    (root / CALLER).write_text(s.replace(NEW, OLD))
    assert digest(root / CALLER) == receipt["sourcePinsBefore"][CALLER]
    record("old-pin", status="PASS", rejection=reject(root, BACKEND))
    root = fixture("guard-mutant")
    s = (root / CALLER).read_text()
    guard = "if hashlib.sha256(path.read_bytes()).hexdigest() != expected:"
    assert s.count(guard) == 1
    (root / CALLER).write_text(s.replace(guard, "if False:"))
    dep = next(p for p in deps if p.endswith("confine.py"))
    (root / dep).write_bytes(b"# wrong dependency\n")
    try:
        reject(root, dep)
    except AssertionError as exc:
        assert str(exc).startswith("FAIL-OPEN:")
        record("private-guard-removal-mutant", status="KILLED", oracle=str(exc))
    else:
        raise AssertionError("mutant was not killed")
    root = fixture("module-cache")
    fake = types.ModuleType("accepted_accounted_adapter")
    fake.supervise_accounted = lambda: None
    sentinel = object()
    prior = sys.modules.get(fake.__name__, sentinel)
    sys.modules[fake.__name__] = fake
    try:
        m = fresh(root / CALLER)
        f = m.load_backend()
        assert f is not fake.supervise_accounted
        assert pathlib.Path(f.__code__.co_filename).resolve() == root / ADAPTER
        (root / dep).write_bytes(b"# changed after successful load\n")
        record("cache-does-not-bypass-recheck", status="PASS", rejection=reject(root, dep))
    finally:
        if prior is sentinel:
            del sys.modules[fake.__name__]
        else:
            sys.modules[fake.__name__] = prior
    root = fixture("stale-bytecode")
    adapter = root / ADAPTER
    # Timestamp bytecode is a supported SourceFileLoader path, including under -B.
    # Keep all five accepted sources intact; seed a same-size/same-time cache.
    code = compile("def supervise_accounted(*a, **k):\n    return \"PRIVATE_STALE_CACHE\"\n", str(adapter), "exec")
    st = adapter.stat()
    cache = pathlib.Path(importlib.util.cache_from_source(str(adapter)))
    cache.parent.mkdir(exist_ok=True)
    cache.write_bytes(importlib.util.MAGIC_NUMBER + struct.pack("<III", 0, int(st.st_mtime) & 0xffffffff, st.st_size) + marshal.dumps(code))
    assert all(digest(root / p) == v for p, v in pins.items())
    f = fresh(root / CALLER).load_backend()
    expected = types.ModuleType("reference")
    expected.__file__ = str(adapter)
    exec(compile(adapter.read_bytes(), str(adapter), "exec"), expected.__dict__)
    if f.__code__ != expected.supervise_accounted.__code__:
        record("stale-bytecode", status="DEFECT", sourcePinsUnchanged=True,
               acceptedCodeOrigin=f.__code__.co_filename, cache=str(cache),
               reason="loader accepts unpinned cached adapter code despite accepted source hashes")
        print("DEFECT: stale bytecode accepted; adapter was never invoked")
        return 1
    record("stale-bytecode", status="PASS")
    print("PASS: source loader integration only")
    return 0

if __name__ == "__main__":
    sys.exit(main())
