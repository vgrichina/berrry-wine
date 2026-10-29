#!/usr/bin/python3
"""Source-only transitive oracle: the first Popen is inspected and always blocked."""
import ast
import contextlib
import hashlib
import importlib.util
import inspect
import json
import marshal
import os
import pathlib
import struct
import subprocess
import sys
import tempfile
import types
from unittest import mock

HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parents[1]
ADAPTER = "test/toyvm-kernel-profile-accounting-backend-oct28/supervise_accounted.py"
CALLER = "test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py"
SUPERVISOR = "test/toyvm-transient-profile-accounting-repair-oct28/pinned-supervisor.py"
PINS = json.loads((HERE / "input-pins.json").read_text())
NAME = "immutable_supervisor"

class Rejected(AssertionError):
    pass

class Boundary(BaseException):
    pass

def require(value, message):
    if not value:
        raise Rejected(message)

def digest(b):
    return dict(bytes=len(b), sha256=hashlib.sha256(b).hexdigest())

def module(path, source, name):
    spec = importlib.util.spec_from_file_location(name, path)
    m = importlib.util.module_from_spec(spec)
    exec(compile(source, str(path), "exec", dont_inherit=True), m.__dict__)
    return m

def identity(actual, expected):
    require("STALE_EXECUTED" not in actual.__dict__, "unpinned top-level code executed")
    require(marshal.dumps(actual.supervise.__code__) == marshal.dumps(expected.supervise.__code__),
            "supervise code differs from checked bytes")
    require(inspect.signature(actual.supervise) == inspect.signature(expected.supervise), "supervise API")
    for field in ("__name__", "__file__", "__package__", "__cached__"):
        require(getattr(actual, field) == getattr(expected, field), "module metadata " + field)
    for field in ("name", "origin", "cached", "parent", "has_location", "submodule_search_locations"):
        require(getattr(actual.__spec__, field) == getattr(expected.__spec__, field), "spec " + field)
    require(type(actual.__loader__) is type(expected.__loader__), "loader type")
    require(actual.__loader__.path == expected.__loader__.path, "loader path")
    require(actual.__spec__.loader is actual.__loader__, "loader linkage")
    for field in ("__name__", "__qualname__", "__module__", "__defaults__", "__kwdefaults__", "__annotations__"):
        require(getattr(actual.supervise, field) == getattr(expected.supervise, field), "function metadata " + field)
    require(actual.supervise.__globals__ is actual.__dict__, "global linkage")

def suite(adapter_bytes, supervisor_bytes, mutant=False):
    rows = []
    for case in ("normal", "timestamp", "unchecked-hash", "replacement", "sys.modules poison", "tampered"):
        with tempfile.TemporaryDirectory(prefix="boundary-", dir=HERE) as td:
            root = pathlib.Path(td)
            ap = root / ADAPTER
            sp = root / SUPERVISOR
            for p, b in ((ap, adapter_bytes), (sp, supervisor_bytes)):
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_bytes(b)
            candidate = adapter_bytes
            if mutant:
                guard = b"    if hashlib.sha256(supervisor_source).hexdigest()!=PIN:raise RuntimeError('supervisor identity mismatch')\n"
                require(candidate.count(guard) == 1, "mutant exact guard anchor")
                candidate = candidate.replace(guard, b"")
            adapter = module(ap, candidate, "accepted_accounted_adapter")
            expected = module(sp, supervisor_bytes, NAME)
            poison = b"STALE_EXECUTED=True\ndef supervise(*args, **kwargs): return 'unpinned'\n"
            poison += b"#" * (len(supervisor_bytes) - len(poison))
            cache = pathlib.Path(importlib.util.cache_from_source(str(sp)))
            payload = None
            if case in ("timestamp", "unchecked-hash"):
                code = compile(poison, str(sp), "exec", dont_inherit=True)
                st = sp.stat()
                header = importlib.util.MAGIC_NUMBER
                header += (struct.pack("<III", 0, int(st.st_mtime), st.st_size) if case == "timestamp"
                           else struct.pack("<I", 1) + importlib.util.source_hash(supervisor_bytes))
                payload = header + marshal.dumps(code)
                cache.parent.mkdir(exist_ok=True)
                cache.write_bytes(payload)
                ordinary = importlib.util.spec_from_file_location(NAME, sp).loader.get_code(NAME)
                require(marshal.dumps(ordinary) == marshal.dumps(code), "invalid stale-cache control")
            if case == "tampered":
                sp.write_bytes(poison)
            reads = []
            real_read = pathlib.Path.read_bytes
            def read(path):
                b = real_read(path)
                if path == sp:
                    reads.append(str(path))
                    if case == "replacement":
                        sp.write_bytes(poison)
                return b
            seen = []
            def sentinel(*args, **kwargs):
                # This is the exact production adapter frame, before any child exists.
                frame = inspect.currentframe().f_back
                require(frame.f_code is adapter.supervise_accounted.__code__, "unexpected child boundary")
                m = frame.f_locals["m"]
                seen.append(dict(argv=args[0], staleTopLevel="STALE_EXECUTED" in m.__dict__))
                try:
                    identity(m, expected)
                except Rejected as exc:
                    seen[-1]["identityError"] = str(exc)
                raise Boundary()
            poison_module = types.ModuleType(NAME)
            poison_module.supervise = lambda *a, **kw: None
            saved_popen = subprocess.Popen
            saved_read = pathlib.Path.read_bytes
            saved_module = sys.modules.get(NAME)
            with contextlib.ExitStack() as stack:
                stack.enter_context(mock.patch.object(pathlib.Path, "read_bytes", read))
                stack.enter_context(mock.patch.object(subprocess, "Popen", sentinel))
                for target in ("run", "call", "check_call", "check_output"):
                    stack.enter_context(mock.patch.object(subprocess, target, side_effect=Rejected("non-Popen child attempt")))
                for target in ("system", "fork", "forkpty", "posix_spawn", "posix_spawnp"):
                    if hasattr(os, target):
                        stack.enter_context(mock.patch.object(os, target, side_effect=Rejected("OS child attempt")))
                if case == "sys.modules poison":
                    stack.enter_context(mock.patch.dict(sys.modules, {NAME: poison_module}))
                rejection = None
                try:
                    adapter.supervise_accounted(["never-executed"], root / "work")
                except Boundary:
                    pass
                except RuntimeError as exc:
                    rejection = str(exc)
            require(subprocess.Popen is saved_popen and pathlib.Path.read_bytes is saved_read, "patch restoration")
            require(sys.modules.get(NAME) is saved_module, "sys.modules restoration")
            require(len(reads) == 1, "supervisor must have exactly one checked read")
            if case == "replacement":
                require(sp.read_bytes() == poison, "replacement did not fire")
            if payload is not None:
                require(cache.read_bytes() == payload, "retained pyc changed")
            row = dict(case=case, boundaryCalls=len(seen), reads=len(reads), observation=seen, rejection=rejection)
            if case == "tampered":
                row["accepted"] = not seen and rejection == "supervisor identity mismatch"
            else:
                row["accepted"] = len(seen) == 1 and "identityError" not in seen[0] and rejection is None
            rows.append(row)
    return rows

def invariants(data):
    before = (HERE / "adapter-before.txt").read_bytes()
    caller_before = (HERE / "caller-before.txt").read_bytes()
    require(digest(before) == PINS[ADAPTER], "original adapter pin")
    require(digest(caller_before) == PINS[CALLER], "original caller pin")
    start = b"    if hashlib.sha256(source.read_bytes()).hexdigest()!=PIN:"
    end = b"    server=subprocess.Popen"
    def stripped(b):
        a = b.index(start) if start in b else b.index(b"    supervisor_source=source.read_bytes()")
        z = b.index(end, a)
        return ast.dump(ast.parse((b[:a] + b[z:]).decode()), include_attributes=False)
    require(stripped(before) == stripped(data[ADAPTER]), "adapter AST outside loader changed")
    old = PINS[ADAPTER]["sha256"].encode()
    new = hashlib.sha256(data[ADAPTER]).hexdigest().encode()
    require(caller_before.count(old) == 1, "caller old pin count")
    require(data[CALLER] == caller_before.replace(old, new), "caller changed beyond single adapter SHA")
    for p, pin in PINS.items():
        if p not in (ADAPTER, CALLER):
            require(digest(data[p]) == pin, "unchanged dependency " + p)
    # Exact caller loader body and receipt pin must be unchanged.
    def loader(b):
        tree = ast.parse(b)
        return ast.dump(next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "load_backend"))
    require(loader(caller_before) == loader(data[CALLER]), "caller source loader AST changed")

def main():
    mode = sys.argv[1]
    data = {p: (REPO / p).read_bytes() for p in PINS}
    before = mode == "before"
    if before:
        require(all(digest(data[p]) == pin for p, pin in PINS.items()), "baseline source pins")
    else:
        invariants(data)
    rows = suite(data[ADAPTER], data[SUPERVISOR])
    if before:
        require([r["case"] for r in rows if not r["accepted"]] == ["timestamp", "unchecked-hash", "replacement"],
                "baseline reproduction differs")
    else:
        require(all(r["accepted"] for r in rows), "repair rejected: " + repr(rows))
    result = dict(status="PASS", mode=mode, python=sys.executable, sourcePins={p:digest(b) for p,b in data.items()}, tests=rows)
    if not before:
        mutants = suite(data[ADAPTER], data[SUPERVISOR], mutant=True)
        require([r["case"] for r in mutants if not r["accepted"]] == ["tampered"], "guard-removal control not rejected by same oracle")
        result["guardRemovalControl"] = dict(status="REJECTED", tests=mutants)
    (HERE / (mode + ".json")).write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(dict(status="PASS", mode=mode, cases=[(r["case"],r["accepted"]) for r in rows])))
if __name__ == "__main__":
    main()
