#!/usr/bin/python3
"""Independent source-identity acceptance. Never calls the returned adapter."""
import hashlib
import importlib.util
import inspect
import json
import marshal
import os
import pathlib
import struct
import sys
import tempfile
import types
from unittest import mock

HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parents[1]
CALLER = "test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py"
PINS = {
    CALLER: (8392, "d52afa6788e1f584aaff8a3c1d076b74e9f9c033cf95bfd0d0b5fcc01a8d4a80"),
    "test/toyvm-kernel-profile-accounting-backend-oct28/supervise_accounted.py": (4058, "5ac463e9168b1162b47b784e919a6f71830d5581c5fbde14597f8e1e866eb3bf"),
    "test/toyvm-kernel-profile-accounting-backend-oct28/confine.py": (3457, "0b10df6497f359f9684f1dbb0752eba3816d0e6568c492c39f62ba3a3f2076d8"),
    "test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py": (12482, "cc2dc7ab2f9b5d1b84b755c61e7a6ffc3e226d52ffe008edf7ace5310cbdc105"),
    "test/toyvm-transient-profile-accounting-repair-oct28/pinned-supervisor.py": (23268, "9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85"),
}
ADAPTER = next(p for p in PINS if p.endswith("/supervise_accounted.py"))
NAME = "accepted_accounted_adapter"

class Rejected(AssertionError):
    pass

def require(ok, why):
    if not ok:
        raise Rejected(why)

def digest(data):
    return dict(bytes=len(data), sha256=hashlib.sha256(data).hexdigest())

def verify_sources():
    data = {p: (REPO / p).read_bytes() for p in PINS}
    for p, (length, sha) in PINS.items():
        require(digest(data[p]) == dict(bytes=length, sha256=sha), "production pin: " + p)
    return data

def reference(path, source):
    spec = importlib.util.spec_from_file_location(NAME, path)
    module = importlib.util.module_from_spec(spec)
    exec(compile(source, str(path), "exec", dont_inherit=True), module.__dict__)
    return module.supervise_accounted

def identity(actual, expected):
    require(isinstance(actual, types.FunctionType), "adapter is not a function")
    require(marshal.dumps(actual.__code__) == marshal.dumps(expected.__code__), "accepted code differs from compiled pinned bytes")
    for field in ("__name__", "__qualname__", "__module__", "__defaults__", "__kwdefaults__", "__annotations__"):
        require(getattr(actual, field) == getattr(expected, field), "function metadata: " + field)
    a, e = actual.__globals__, expected.__globals__
    for field in ("__name__", "__package__", "__file__", "__cached__", "HERE", "PIN"):
        require(a[field] == e[field], "module metadata: " + field)
    for field in ("name", "origin", "cached", "parent", "has_location", "submodule_search_locations"):
        require(getattr(a["__spec__"], field) == getattr(e["__spec__"], field), "module spec: " + field)
    require(type(a["__loader__"]) is type(e["__loader__"]), "loader class")
    require(a["__loader__"].path == e["__loader__"].path, "loader path")
    require(a["__spec__"].loader is a["__loader__"], "loader/spec linkage")
    require(a["supervise_accounted"] is actual, "function/global linkage")
    require("STALE_EXECUTED" not in a, "stale source executed")
    require(inspect.signature(actual) == inspect.signature(expected), "API signature")
    inspect.signature(actual).bind(["unused"], "unused", live_limit=1, write_limit=2, file_limit=3, backend="synchronous-fuse", wall_limit=4)

def suite(data, mutant=False):
    rows = []
    with tempfile.TemporaryDirectory(prefix="identity-", dir=HERE) as td:
        root = pathlib.Path(td)
        for p, b in data.items():
            target = root / p
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(b)
        caller_path = root / CALLER
        if mutant:
            guard = b"        if hashlib.sha256(source).hexdigest() != expected:\n            raise RuntimeError('accepted backend identity mismatch: ' + relative)\n"
            require(data[CALLER].count(guard) == 1, "mutant anchor")
            caller_path.write_bytes(data[CALLER].replace(guard, b""))
        spec = importlib.util.spec_from_file_location("identity_caller", caller_path)
        caller = importlib.util.module_from_spec(spec)
        exec(compile(caller_path.read_bytes(), str(caller_path), "exec", dont_inherit=True), caller.__dict__)
        adapter = root / ADAPTER
        expected = reference(adapter, data[ADAPTER])
        def accepted(label):
            identity(caller.load_backend(), expected)
            rows.append(dict(case=label, outcome="PASS"))
        # Earliest behavioral boundary: unchanged exact production load_backend.
        accepted("normal exact production loader")
        poison = b"STALE_EXECUTED=True\ndef supervise_accounted(*a, **k): return None\n"
        poison += b"#" * (len(data[ADAPTER]) - len(poison))
        code = compile(poison, str(adapter), "exec", dont_inherit=True)
        cache = pathlib.Path(importlib.util.cache_from_source(str(adapter)))
        cache.parent.mkdir(exist_ok=True)
        for kind in ("timestamp", "unchecked-hash"):
            st = adapter.stat()
            if kind == "timestamp":
                header = importlib.util.MAGIC_NUMBER + struct.pack("<III", 0, int(st.st_mtime), st.st_size)
            else:
                header = importlib.util.MAGIC_NUMBER + struct.pack("<I", 1) + importlib.util.source_hash(data[ADAPTER])
            payload = header + marshal.dumps(code)
            cache.write_bytes(payload)
            ordinary = importlib.util.spec_from_file_location(NAME, adapter).loader.get_code(NAME)
            require(marshal.dumps(ordinary) == marshal.dumps(code), "stale pyc control did not select stale code")
            accepted(kind + " stale pyc retained")
            rows[-1].update(cache=digest(payload), ordinaryLoaderSelectsStaleCode=True)
            require(cache.read_bytes() == payload, "cache was deleted or rewritten")
        poisoned = types.ModuleType(NAME)
        poisoned.supervise_accounted = lambda *a, **k: None
        with mock.patch.dict(sys.modules, {NAME: poisoned}):
            accepted("sys.modules poisoning")
            require(sys.modules[NAME] is poisoned, "poison entry unexpectedly replaced")
        reads = []
        original_read = pathlib.Path.read_bytes
        def swap(path):
            value = original_read(path)
            if path == adapter:
                reads.append(path)
                adapter.write_bytes(poison)
            return value
        with mock.patch.object(pathlib.Path, "read_bytes", swap):
            accepted("replacement after checked read")
        require(len(reads) == 1, "mutable second adapter read")
        require(adapter.read_bytes() == poison, "replacement fixture did not fire")
        adapter.write_bytes(data[ADAPTER])
        # Each dependency challenged independently; no adapter import permitted.
        for dependency in (p for p in PINS if p != CALLER):
            target = root / dependency
            target.write_bytes(data[dependency] + b"\n# independent tamper\n")
            with mock.patch.object(importlib.util, "spec_from_file_location", side_effect=Rejected("adapter import before rejection")) as imports:
                try:
                    caller.load_backend()
                except RuntimeError as exc:
                    require(str(exc) == "accepted backend identity mismatch: " + dependency.removeprefix("test/"), "wrong identity rejection")
                else:
                    raise Rejected("accepted altered dependency: " + dependency)
                require(imports.call_count == 0, "adapter import occurred")
            rows.append(dict(case="independent dependency tamper: " + dependency, outcome="PASS"))
            target.write_bytes(data[dependency])
    return rows

def main():
    data = verify_sources()
    result = dict(status="RUNNING", python=sys.executable, before={p:digest(b) for p,b in data.items()}, tests=[])
    try:
        result["tests"] = suite(data)
        try:
            suite(data, mutant=True)
        except Rejected as exc:
            result["mutant"] = dict(outcome="REJECTED", reason=str(exc), change="private copy removes only SHA mismatch guard")
        else:
            raise Rejected("same oracle accepted source-guard-removal mutant")
        result["after"] = {p:digest(b) for p,b in verify_sources().items()}
        result["status"] = "PASS"
    except BaseException as exc:
        result["status"] = "REJECTED"
        result["failure"] = repr(exc)
        raise
    finally:
        (HERE / "results.json").write_text(json.dumps(result, indent=2) + "\n")
        print(json.dumps(result))

if __name__ == "__main__":
    main()
