#!/usr/bin/python3
"""Independent source-boundary oracle. No child, mount, or runtime qualification."""
import ast
import hashlib
import importlib.util
import importlib._bootstrap_external as be
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import types
from unittest.mock import patch

OWN = Path(__file__).resolve().parent
REPO = OWN.parents[1]
INPUTS = Path("/tmp/toyvm-transitive-loader-fresh-independent-accept-oct29/inputs/repair-tests")
DISPATCH = Path("/home/user/wine-assembly/scratch/usage-watch/toyvm-transitive-loader-fresh-independent-accept-oct29-dispatch.json")
ADAPTER = "test/toyvm-kernel-profile-accounting-backend-oct28/supervise_accounted.py"
SUPERVISOR = "test/toyvm-transient-profile-accounting-repair-oct28/pinned-supervisor.py"
CALLER = "test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py"
def pin(p):
    data = p.read_bytes()
    return dict(bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
def digest(code):
    # marshal encodes string interning/reference state, which can change during
    # execution. Canonicalize code fields instead, preserving nested code.
    def stable(value):
        if isinstance(value, types.CodeType):
            return (value.co_argcount, value.co_posonlyargcount,
                    value.co_kwonlyargcount, value.co_nlocals,
                    value.co_stacksize, value.co_flags, value.co_code.hex(),
                    stable(value.co_consts), value.co_names, value.co_varnames,
                    value.co_filename, value.co_name, value.co_qualname,
                    value.co_firstlineno, value.co_linetable.hex(),
                    value.co_exceptiontable.hex(), value.co_freevars,
                    value.co_cellvars)
        if isinstance(value, tuple):
            return tuple(stable(v) for v in value)
        if isinstance(value, frozenset):
            return ("frozenset", tuple(sorted(repr(stable(v)) for v in value)))
        return value
    return hashlib.sha256(repr(stable(code)).encode()).hexdigest()
def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    exec(compile(path.read_bytes(), str(path), "exec", dont_inherit=True), module.__dict__)
    return module
class Boundary(BaseException):
    pass

ACTIVE = None
def audit(event, args):
    if ACTIVE is None:
        return
    if event in ("subprocess.Popen", "os.system", "os.posix_spawn", "os.exec", "os.fork"):
        raise AssertionError("real child operation forbidden: " + event)
    if event == "open" and isinstance(args[0], (str, bytes, os.PathLike)):
        p = os.fsdecode(args[0])
        mode = args[1]
        if mode is None or ("r" in mode and "+" not in mode):
            if p == ACTIVE["source"]:
                ACTIVE["opens"] += 1
            if "__pycache__" in p and str(Path(p).parent.parent) == str(Path(ACTIVE["source"]).parent):
                ACTIVE["cacheReads"].append(p)
sys.addaudithook(audit)
LIVE_MODULES = []

def challenge(adapter_bytes, scenario, base):
    global ACTIVE
    with tempfile.TemporaryDirectory(prefix="boundary-", dir=OWN) as folder:
        root = Path(folder)
        for relative in base:
            target = root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(base[relative])
        adapter_path = root / ADAPTER
        adapter_path.write_bytes(adapter_bytes)
        source = root / SUPERVISOR
        checked = base[SUPERVISOR]
        expected_code = compile(checked, str(source), "exec", dont_inherit=True)
        expected = types.ModuleType("immutable_supervisor")
        exec(expected_code, expected.__dict__)
        functions = {k: v for k, v in vars(expected).items()
                     if isinstance(v, types.FunctionType) and v.__module__ == expected.__name__}
        poison = types.ModuleType("immutable_supervisor")
        poison.INDEPENDENT_STALE = True
        poison.supervise = lambda *a, **kw: None
        stale = checked + b"\nINDEPENDENT_STALE = True\n"
        cache = Path(importlib.util.cache_from_source(str(source)))
        cache_before = None
        if scenario in ("timestamp-pyc", "unchecked-hash-pyc"):
            cache.parent.mkdir()
            stale_code = compile(stale, str(source), "exec", dont_inherit=True)
            if scenario == "timestamp-pyc":
                payload = be._code_to_timestamp_pyc(stale_code, int(source.stat().st_mtime), len(checked))
            else:
                payload = be._code_to_hash_pyc(stale_code, importlib.util.source_hash(stale), checked=False)
            cache.write_bytes(payload)
            cache_before = pin(cache)
        if scenario == "tampered":
            source.write_bytes(stale)
        adapter = load(adapter_path, "independent_actual_adapter")
        observations = dict(checkedReads=0, opens=0, cacheReads=[], popen=0,
                            topCode=[], markers=[], functions=[], rejected=None)
        active = dict(source=str(source), opens=0, cacheReads=[])
        original_read = Path.read_bytes
        def read_once(p):
            value = original_read(p)
            if p == source:
                observations["checkedReads"] += 1
                if scenario == "replace-after-read":
                    source.write_bytes(stale)
            return value
        def trace(frame, event, arg):
            if frame.f_code.co_filename == str(source) and frame.f_code.co_name == "<module>":
                if event == "call":
                    observations["topCode"].append(digest(frame.f_code))
                    observations["topCodeEqual"] = frame.f_code == expected_code
                if event == "return":
                    observations["markers"].append(bool(frame.f_globals.get("INDEPENDENT_STALE")))
            return trace
        def sentinel(*args, **kwargs):
            observations["popen"] += 1
            frame = sys._getframe(1)
            module = frame.f_locals.get("m")
            assert module is not None and module is not poison
            assert all(module is not m for m in LIVE_MODULES), "reused module"
            LIVE_MODULES.append(module)
            observations["freshModule"] = True
            assert module.__name__ == "immutable_supervisor"
            assert module.__file__ == str(source)
            assert module.__package__ == ""
            assert module.__spec__.name == module.__name__
            assert module.__spec__.origin == str(source)
            assert module.__loader__ is module.__spec__.loader
            assert module.__loader__.path == str(source)
            assert module.__cached__ == importlib.util.cache_from_source(str(source))
            assert not getattr(module, "INDEPENDENT_STALE", False), "stale top-level marker"
            actual_functions = {k: v for k, v in vars(module).items()
                                if isinstance(v, types.FunctionType) and v.__module__ == module.__name__}
            assert actual_functions.keys() == functions.keys()
            for name, wanted in functions.items():
                actual = actual_functions[name]
                assert actual.__globals__ is module.__dict__
                assert actual.__module__ == module.__name__
                assert actual.__name__ == wanted.__name__
                assert actual.__qualname__ == wanted.__qualname__
                assert digest(actual.__code__) == digest(wanted.__code__), name
                assert actual.__defaults__ == wanted.__defaults__
                assert actual.__kwdefaults__ == wanted.__kwdefaults__
            observations["functions"] = sorted(actual_functions)
            assert observations["topCodeEqual"] and observations["topCode"] == [digest(expected_code)], "executed unchecked top-level bytes"
            assert observations["markers"] == [False], "top-level marker"
            raise Boundary()
        previous_trace = sys.gettrace()
        try:
            with patch.object(Path, "read_bytes", read_once), patch.object(subprocess, "Popen", sentinel), patch.dict(sys.modules, {"immutable_supervisor": poison}):
                ACTIVE = active
                sys.settrace(trace)
                try:
                    adapter.supervise_accounted(["NEVER-EXECUTE"], root / "work")
                except Boundary:
                    observations["boundary"] = "Popen blocked before child"
                except RuntimeError as error:
                    observations["rejected"] = str(error)
                finally:
                    sys.settrace(previous_trace)
                    ACTIVE = None
                assert sys.modules["immutable_supervisor"] is poison
        finally:
            ACTIVE = None
            sys.settrace(previous_trace)
        observations["opens"] = active["opens"]
        observations["cacheReads"] = active["cacheReads"]
        assert observations["checkedReads"] == 1, observations
        assert observations["opens"] == 1, observations
        assert observations["cacheReads"] == [], observations
        if cache_before is not None:
            assert pin(cache) == cache_before, "cache changed"
            observations["cacheUnchanged"] = True
        if scenario == "tampered":
            assert observations["popen"] == 0, observations
            assert observations["topCode"] == [], observations
            assert observations["rejected"] == "supervisor identity mismatch", observations
        else:
            assert observations["popen"] == 1, observations
            assert observations["rejected"] is None, observations
        return observations

def caller_contract(base, before):
    current = base[CALLER]
    old_pin = hashlib.sha256(before[ADAPTER]).hexdigest().encode()
    new_pin = hashlib.sha256(base[ADAPTER]).hexdigest().encode()
    assert before[CALLER].count(old_pin) == 1
    assert before[CALLER].replace(old_pin, new_pin) == current, "caller changed beyond adapter pin"
    def loader(data):
        tree = ast.parse(data)
        return ast.dump(next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "load_backend"), include_attributes=False)
    assert loader(current) == loader(before[CALLER])
    with tempfile.TemporaryDirectory(prefix="caller-", dir=OWN) as folder:
        root = Path(folder)
        for relative, data in base.items():
            p = root / relative
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(data)
        caller = load(root / CALLER, "independent_caller")
        (root / ADAPTER).write_bytes(base[ADAPTER] + b"\n# pin mismatch\n")
        with patch.object(importlib.util, "module_from_spec", side_effect=AssertionError("module constructed before pin rejection")), patch.object(subprocess, "Popen", side_effect=AssertionError("child attempted")):
            try:
                caller.load_backend()
            except RuntimeError as error:
                assert str(error).startswith("accepted backend identity mismatch:")
            else:
                raise AssertionError("caller accepted source mismatch")
    return dict(onlyAdapterPinChanged=True, loaderASTIdentical=True, callerSourceMismatchRejectedBeforeModule=True)

def main():
    assert sys.executable == "/usr/bin/python3"
    dispatch = json.loads(DISPATCH.read_text())
    receipt_path = Path(dispatch["canonicalReceipt"])
    assert pin(receipt_path) == dispatch["canonicalReceiptPin"]
    receipt = json.loads(receipt_path.read_text())
    supplied = {}
    for relative, expected in receipt["artifactHashes"].items():
        p = INPUTS / Path(relative).name
        assert pin(p) == expected, str(p)
        supplied[p.name] = expected
    pins = dispatch["sourcePins"]
    for relative, expected in pins.items():
        assert pin(REPO / relative) == expected, relative
    base = {relative: (REPO / relative).read_bytes() for relative in pins}
    before = {ADAPTER: (INPUTS / "adapter-before.txt").read_bytes(),
              CALLER: (INPUTS / "caller-before.txt").read_bytes()}
    results = dict(candidate=dispatch["candidate"], sourcePinsBefore=pins,
                   canonicalPredecessorReceipt=dispatch["canonicalReceiptPin"],
                   suppliedArtifacts=supplied, cases={}, controls={})
    # Earliest behavioral boundary first: unchanged pinned production adapter.
    for scenario in ("normal", "timestamp-pyc", "unchecked-hash-pyc", "sys-modules", "replace-after-read", "tampered"):
        results["cases"][scenario] = challenge(base[ADAPTER], scenario, base)
    # Same oracle, private baseline loader; never alter production.
    try:
        challenge(before[ADAPTER], "unchecked-hash-pyc", base)
    except AssertionError as error:
        results["controls"]["old-loader"] = dict(rejected=True, reason=str(error))
    else:
        raise AssertionError("oracle accepted old loader")
    guard = b"    if hashlib.sha256(supervisor_source).hexdigest()!=PIN:raise RuntimeError('supervisor identity mismatch')\n"
    assert base[ADAPTER].count(guard) == 1
    mutant = base[ADAPTER].replace(guard, b"")
    try:
        challenge(mutant, "tampered", base)
    except AssertionError as error:
        results["controls"]["guard-removal"] = dict(rejected=True, reason=str(error))
    else:
        raise AssertionError("oracle accepted guard removal")
    results["caller"] = caller_contract(base, before)
    results["sourcePinsAfter"] = {relative: pin(REPO / relative) for relative in pins}
    assert results["sourcePinsAfter"] == pins
    results["scope"] = "Source import only; all real child launches forbidden. No mounted/kernel/CLI/browser qualification."
    results["PASS"] = True
    (OWN / "results.json").write_text(json.dumps(results, indent=2) + "\n")
    print(json.dumps(dict(PASS=True, cases=list(results["cases"]), controls=results["controls"], caller=results["caller"])))
if __name__ == "__main__":
    main()
