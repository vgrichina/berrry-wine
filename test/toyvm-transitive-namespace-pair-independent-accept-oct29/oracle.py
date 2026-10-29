#!/usr/bin/python3
"""Independent source-only interaction acceptance. Never calls returned adapter.
Run in the assigned receiver via its ops.py; inputs are immutable dispatch copies.
"""
import ast
import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import py_compile
import shutil
import stat
import subprocess
import sys
import tempfile
import types
from unittest.mock import patch

TASK = "toyvm-transitive-namespace-pair-independent-accept-oct29"
OWN = Path("/tmp") / TASK
REPO = OWN / "repo"
OUT = REPO / "test" / TASK
DISPATCH = Path("/home/user/wine-assembly/scratch/usage-watch") / (TASK + "-dispatch.json")
D = json.loads(DISPATCH.read_text())
PINS = D["sourcePins"]
CALLER, ADAPTER, CONFINE, BACKEND, TRANSITIVE = list(PINS)
RAW = {p: (REPO / p).read_bytes() for p in PINS}
RESULTS = []
CHILDREN = []

def digest(data):
    return dict(bytes=len(data), sha256=hashlib.sha256(data).hexdigest())

def verify():
    assert Path.cwd() == REPO and sys.executable == "/usr/bin/python3"
    assert all(digest((REPO / p).read_bytes()) == pin for p, pin in PINS.items())
    receipt = Path(D["canonicalReceipt"])
    assert digest(receipt.read_bytes()) == D["canonicalReceiptPin"]
    for name, pin in json.loads(receipt.read_text())["artifacts"].items():
        assert digest((OWN / "inputs/candidate-tests" / Path(name).name).read_bytes()) == pin
    assert digest(Path(sys.executable).read_bytes()) == D["pythonExecutablePin"]

def deny(*args, **kw):
    CHILDREN.append(repr(args)[:200])
    raise AssertionError("child invocation forbidden")

def module(source, filename, name):
    m = types.ModuleType(name)
    m.__file__ = str(filename)
    exec(compile(source, str(filename), "exec", dont_inherit=True), m.__dict__)
    return m

def prefix(adapter_source, returned):
    # Exact AST statements before the FIRST child launch, never the adapter call.
    # Unmodified production nodes, bounded by a verified Popen assignment.
    tree = ast.parse(adapter_source)
    fn = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "supervise_accounted")
    stop = next(i for i, n in enumerate(fn.body) if isinstance(n, ast.Assign)
                and any(isinstance(t, ast.Name) and t.id == "server" for t in n.targets))
    launch = fn.body[stop].value
    assert isinstance(launch, ast.Call) and isinstance(launch.func, ast.Attribute)
    assert isinstance(launch.func.value, ast.Name) and launch.func.value.id == "subprocess"
    assert launch.func.attr == "Popen"
    ns = dict(returned.__globals__, backend="synchronous-fuse", work=OWN / "unused-work")
    exec(compile(ast.Module(body=fn.body[:stop], type_ignores=[]), returned.__code__.co_filename,
                 "exec", dont_inherit=True), ns)
    return ns["m"]

def pyc_poison(path, mode):
    good = path.read_bytes()
    old = path.stat()
    evil = b"raise AssertionError('hostile bytecode executed')\n"
    evil += b"#" * (len(good) - len(evil))
    path.write_bytes(evil)
    os.utime(path, ns=(old.st_atime_ns, old.st_mtime_ns))
    py_compile.compile(str(path), doraise=True,
        invalidation_mode=(py_compile.PycInvalidationMode.TIMESTAMP if mode == "timestamp"
                           else py_compile.PycInvalidationMode.UNCHECKED_HASH))
    path.write_bytes(good)
    os.utime(path, ns=(old.st_atime_ns, old.st_mtime_ns))

def exact_function(actual, source, path, name):
    expected = module(source, path, "reference_only")
    assert isinstance(actual, types.FunctionType)
    assert actual.__code__ == getattr(expected, name).__code__, "loaded function differs from checked source"

MODES = ["normal", "timestamp", "unchecked", "modules", "replace"]

def interaction(variant, boundary, mode):
    with tempfile.TemporaryDirectory(prefix="oracle-", dir=OWN) as td:
        root = Path(td)
        data = dict(RAW)
        if variant == "legacy-caller":
            data[CALLER] = (OWN / "inputs/candidate-tests/base-caller.txt").read_bytes()
        elif variant == "legacy-adapter":
            data[ADAPTER] = (OWN / "inputs/candidate-tests/base-adapter.txt").read_bytes()
        for p, s in data.items():
            path = root / p
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(s)
        caller = module(data[CALLER], root / CALLER, "independent_caller")
        # Private loader controls need internally consistent caller adapter pins.
        if variant in ("legacy-caller", "legacy-adapter"):
            caller.BACKEND_PINS[ADAPTER.removeprefix("test/")] = hashlib.sha256(data[ADAPTER]).hexdigest()
        if variant == "stale-pin":
            caller.BACKEND_PINS[ADAPTER.removeprefix("test/")] = hashlib.sha256(
                (OWN / "inputs/candidate-tests/base-adapter.txt").read_bytes()).hexdigest()
        target = root / (ADAPTER if boundary == "caller" else TRANSITIVE)
        if mode in ("timestamp", "unchecked"):
            pyc_poison(target, mode)
        poison = types.ModuleType("poison")
        poison.supervise_accounted = deny
        poison.supervise = deny
        real_read = Path.read_bytes
        swaps = []
        armed = boundary == "caller"
        def checked_read(path):
            source = real_read(path)
            if armed and mode == "replace" and path == target:
                swaps.append(str(path))
                path.write_bytes(b"raise AssertionError('replacement source executed')\n")
            return source
        saved = {n: sys.modules.get(n) for n in ("accepted_accounted_adapter", "immutable_supervisor")}
        try:
            if mode == "modules":
                for n in saved:
                    sys.modules[n] = poison
            with patch.object(Path, "read_bytes", checked_read):
                returned = caller.load_backend()
                exact_function(returned, data[ADAPTER], root / ADAPTER, "supervise_accounted")
                if boundary == "adapter":
                    armed = True
                    loaded = prefix(data[ADAPTER], returned)
                    exact_function(loaded.supervise, data[TRANSITIVE], root / TRANSITIVE, "supervise")
            if mode == "replace":
                assert swaps == [str(target)], "replacement hook did not reach checked read"
        finally:
            for n, value in saved.items():
                if value is None:
                    sys.modules.pop(n, None)
                else:
                    sys.modules[n] = value


def rejects_before_child():
    # Exact mismatch strings plus no adapter/transitive import on corrupt bytes.
    for changed in (ADAPTER, CONFINE, BACKEND, TRANSITIVE):
        with tempfile.TemporaryDirectory(prefix="mismatch-", dir=OWN) as td:
            root = Path(td)
            for p, source in RAW.items():
                path = root / p
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(source + (b"#tampered\n" if p == changed else b""))
            c = module(RAW[CALLER], root / CALLER, "mismatch_caller")
            with patch.object(importlib.util, "module_from_spec", side_effect=deny):
                try:
                    c.load_backend()
                except RuntimeError as e:
                    assert str(e) == "accepted backend identity mismatch: " + changed.removeprefix("test/")
                else:
                    raise AssertionError("caller accepted bad backend pin")
    # Adapter itself rejects transitive tampering before module construction/Popen.
    a = module(RAW[ADAPTER], REPO / ADAPTER, "direct_prefix_only")
    with patch.object(Path, "read_bytes", return_value=RAW[TRANSITIVE] + b"#tampered\n"), patch.object(
            importlib.util, "module_from_spec", side_effect=deny):
        try:
            prefix(RAW[ADAPTER], a.supervise_accounted)
        except RuntimeError as e:
            assert str(e) == "supervisor identity mismatch"
        else:
            raise AssertionError("adapter prefix accepted transitive tampering")


def namespace_sanity():
    b = module(RAW[BACKEND], REPO / BACKEND, "namespace_sanity")
    fs = b.Backend(OWN / "never-mounted")
    reply = fs.handle(26, 1, b.pack("2I", 7, 31))
    assert b.unpack("2I", reply) == (7, 31)
    def mkdir(parent, name):
        return b.unpack("Q", fs.handle(9, parent, b.pack("2I", 0o700, 0) + name + b"\0"))[0]
    for name in (b"..", b"bad/name"):
        nodes = copy.deepcopy(fs.nodes)
        state = fs.state()
        try:
            mkdir(1, name)
        except OSError as e:
            assert e.errno == b.errno.EINVAL
        else:
            raise AssertionError("namespace invalid name accepted")
        assert fs.nodes == nodes
        assert {k:v for k,v in fs.state().items() if k != "operations"} == {k:v for k,v in state.items() if k != "operations"}
    parent = mkdir(1, b"parent")
    child = mkdir(parent, b"child")
    nodes = copy.deepcopy(fs.nodes)
    try:
        fs.handle(12, 1, b.pack("Q", child) + b"parent\0loop\0")
    except OSError as e:
        assert e.errno == b.errno.EINVAL
    else:
        raise AssertionError("namespace cycle accepted")
    assert fs.nodes == nodes
    fs.handle(12, parent, b.pack("Q", parent) + b"child\0renamed\0")
    assert fs.nodes[parent]["names"] == {b"renamed": child}
    assert mkdir(parent, b"positive-after-rejection") in fs.nodes


def main():
    verify()
    # Earliest production caller-load boundary is the first behavioral execution.
    for boundary in ("caller", "adapter"):
        for mode in MODES:
            interaction("candidate", boundary, mode)
            RESULTS.append(dict(boundary=boundary, mode=mode, pass_=True))
    rejects_before_child()
    namespace_sanity()
    controls = {}
    for variant in ("legacy-caller", "legacy-adapter", "stale-pin"):
        failed = None
        for boundary in ("caller", "adapter"):
            for mode in MODES:
                try:
                    interaction(variant, boundary, mode)
                except (AssertionError, RuntimeError) as e:
                    failed = dict(boundary=boundary, mode=mode, error=str(e))
                    break
            if failed:
                break
        assert failed, "independent oracle did not reject " + variant
        controls[variant] = failed
    assert not CHILDREN, CHILDREN
    verify()
    result = dict(candidate=D["candidate"], status="ACCEPT_SOURCE_ONLY", interactions=RESULTS,
                  controls=controls, namespace="INIT first; invalid dotdot/slash and cycle rejected; rename/create positive after rejection",
                  backendPinMismatches=4, transitiveTamperRejected=True, actualChildInvocations=0,
                  returnedAdapterInvoked=False, sourcePinsBefore=PINS, sourcePinsAfter=PINS)
    (OUT / "results.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result))

if __name__ == "__main__":
    with patch.object(subprocess, "Popen", deny), patch.object(subprocess, "run", deny), patch.object(
            os, "posix_spawn", deny), patch.object(os, "posix_spawnp", deny), patch.object(os, "fork", deny), patch.object(os, "system", deny), patch.object(os, "spawnv", deny), patch.object(os, "spawnve", deny), patch.object(os, "spawnvp", deny), patch.object(os, "spawnvpe", deny):
        main()
