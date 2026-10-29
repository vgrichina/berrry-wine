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
TASK = 'toyvm-transitive-pair-genuine-control-accept-oct29'
OWN = Path('/tmp') / TASK
REPO = OWN / 'repo'
OUT = REPO / 'test' / TASK
D = json.loads(Path('/home/user/wine-assembly/scratch/usage-watch/' + TASK + '-dispatch.json').read_text())
PINS = D['sourcePins']
CALLER, ADAPTER, CONFINE, BACKEND, TRANSITIVE = list(PINS)
RAW = {p: (REPO / p).read_bytes() for p in PINS}
CHILDREN = []
FIXTURES = []
def digest(data):
    return dict(bytes=len(data), sha256=hashlib.sha256(data).hexdigest())

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

def interaction(variant, boundary, mode):
    with tempfile.TemporaryDirectory(prefix="oracle-", dir=OWN) as td:
        root = Path(td)
        data = dict(RAW)
        if variant == "legacy-caller":
            data[CALLER] = (OWN / "inputs/genuine-legacy-caller.py").read_bytes()
        elif variant == "legacy-adapter":
            data[ADAPTER] = (OWN / "inputs/candidate-tests/base-adapter.txt").read_bytes()
        for p, s in data.items():
            path = root / p
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(s)
        caller = module(data[CALLER], root / CALLER, "independent_caller")
        # Private loader controls need internally consistent caller adapter pins.
        if variant in ("legacy-caller", "legacy-adapter"):
            assert caller.BACKEND_PINS[ADAPTER.removeprefix("test/")] == hashlib.sha256(data[ADAPTER]).hexdigest()
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
                fixture = {p: digest(real_read(root / p)) for p in data}
                assert fixture == {p: digest(s) for p, s in data.items()}
                FIXTURES.append(dict(variant=variant, boundary=boundary, mode=mode, sources=fixture))
                (OUT / "fixture-pins.json").write_text(json.dumps(FIXTURES, indent=2) + "\n")
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
