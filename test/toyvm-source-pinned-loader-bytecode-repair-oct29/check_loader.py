"""Production load_backend identity tests only; never call the returned adapter."""
import argparse
import hashlib
import importlib.util
import inspect
import json
import marshal
from pathlib import Path
import struct
import sys
import types
from unittest.mock import patch

CALLER = "test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py"
ADAPTER = "test/toyvm-kernel-profile-accounting-backend-oct28/supervise_accounted.py"


def fresh(path):
    # Load caller source directly so this test never substitutes its own cache.
    spec = importlib.util.spec_from_file_location("identity_test_caller", path)
    module = importlib.util.module_from_spec(spec)
    exec(compile(path.read_bytes(), str(path), "exec", dont_inherit=True), module.__dict__)
    return module


def identity(function, source, path):
    """One oracle for normal and adversarial loads: exact accepted code/metadata."""
    code = compile(source, str(path), "exec", dont_inherit=True)
    expected = next(c for c in code.co_consts
                    if isinstance(c, types.CodeType) and c.co_name == "supervise_accounted")
    return (inspect.isfunction(function) and function.__code__ == expected
            and function.__module__ == "accepted_accounted_adapter"
            and function.__globals__["__name__"] == "accepted_accounted_adapter"
            and function.__globals__["__file__"] == str(path)
            and function.__globals__["HERE"] == path.resolve().parent
            and function.__globals__["__spec__"].name == "accepted_accounted_adapter"
            and function.__globals__["__loader__"] is not None)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", type=Path, required=True)
    ap.add_argument("--fixtures", type=Path, required=True)
    ap.add_argument("--output", type=Path, required=True)
    ap.add_argument("--expect-vulnerable", action="store_true")
    ap.add_argument("--remove-guard", action="store_true")
    args = ap.parse_args()
    repo = args.repo.resolve()
    original = fresh(repo / CALLER)
    pins = {("test/" + k): v for k, v in original.BACKEND_PINS.items()}
    sources = {p: (repo / p).read_bytes() for p in pins}
    assert all(hashlib.sha256(sources[p]).hexdigest() == pins[p] for p in pins)
    caller = (repo / CALLER).read_bytes()
    if args.remove_guard:
        before = b"if hashlib.sha256(source).hexdigest() != expected:"
        assert caller.count(before) == 1
        caller = caller.replace(before, b"if False:  # deliberate fail-open mutant")
    rows = []
    args.fixtures.mkdir(parents=True, exist_ok=True)

    def fixture(name):
        root = args.fixtures / name
        assert not root.exists(), "fresh fixture required"
        for rel, data in dict(sources, **{CALLER: caller}).items():
            dest = root / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
        return root, fresh(root / CALLER)

    def record(name, passed, **evidence):
        rows.append(dict(name=name, passed=bool(passed), **evidence))

    for mode in ("normal", "timestamp", "unchecked-hash", "sys-modules", "read-race"):
        root, module = fixture(mode)
        path = root / ADAPTER
        source = sources[ADAPTER]
        cache = Path(importlib.util.cache_from_source(str(path)))
        cache_bytes = None
        if mode in ("timestamp", "unchecked-hash"):
            poison = b"def supervise_accounted(*args, **kwargs):\n    return 'UNPINNED_BYTECODE'\n"
            poison += b"#" * (len(source) - len(poison))
            assert len(poison) == len(source)
            payload = marshal.dumps(compile(poison, str(path), "exec"))
            header = (struct.pack("<III", 0, int(path.stat().st_mtime), len(source))
                      if mode == "timestamp" else struct.pack("<I", 1) + b"UNPINNED")
            cache_bytes = importlib.util.MAGIC_NUMBER + header + payload
            cache.parent.mkdir()
            cache.write_bytes(cache_bytes)
        poison_module = types.ModuleType("accepted_accounted_adapter")
        poison_module.supervise_accounted = lambda: "SYS_MODULES_POISON"
        previous = sys.modules.get("accepted_accounted_adapter")
        reads = []
        real_read = Path.read_bytes

        def read_once(p):
            data = real_read(p)
            if p == path:
                reads.append(str(p))
                if mode == "read-race":
                    p.write_bytes(b"def supervise_accounted(): return 'CHANGED_AFTER_CHECK'\n")
            return data

        try:
            if mode == "sys-modules":
                sys.modules["accepted_accounted_adapter"] = poison_module
            with patch.object(Path, "read_bytes", read_once):
                function = module.load_backend()
            matched = identity(function, source, path)
            if mode == "sys-modules":
                matched = matched and sys.modules["accepted_accounted_adapter"] is poison_module
            if cache_bytes is not None:
                assert cache.read_bytes() == cache_bytes, "test must not erase or repair cache"
            record(mode, matched and len(reads) == 1, identity=matched,
                   sourceReads=len(reads), cacheRetained=cache_bytes is not None,
                   cacheSHA256=hashlib.sha256(cache_bytes).hexdigest() if cache_bytes else None)
        finally:
            if previous is None:
                sys.modules.pop("accepted_accounted_adapter", None)
            else:
                sys.modules["accepted_accounted_adapter"] = previous

    for relative in pins:
        root, module = fixture("guard-" + Path(relative).name)
        (root / relative).write_bytes(sources[relative] + b"\n# unaccepted source\n")
        imports = []
        real_spec = module.importlib.util.spec_from_file_location

        def observe(*a, **kw):
            imports.append(str(a[1]))
            return real_spec(*a, **kw)

        rejected = False
        with patch.object(module.importlib.util, "spec_from_file_location", observe):
            try:
                module.load_backend()
            except RuntimeError as error:
                rejected = str(error) == "accepted backend identity mismatch: " + relative[5:]
        record("guard-" + Path(relative).name, rejected and not imports,
               rejected=rejected, importAttempts=imports)

    result = dict(checks=rows, sourcePins=pins, callerSHA256=hashlib.sha256(caller).hexdigest(),
                  scope="load_backend code identity only; adapter never invoked",
                  python=sys.executable, removeGuard=args.remove_guard)
    args.output.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))
    if args.expect_vulnerable:
        assert all(r["passed"] == (r["name"] not in ("timestamp", "unchecked-hash", "read-race"))
                   for r in rows), "counterexample differs from expected production cache/read defect"
    else:
        assert all(r["passed"] for r in rows), "production loader identity oracle failed"


if __name__ == "__main__":
    main()
