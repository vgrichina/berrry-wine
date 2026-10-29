#!/usr/bin/python3
"""Rerun the hash-verified predecessor caller oracle with only current source pins."""
import contextlib
import hashlib
import importlib.util
import json
import os
import pathlib
import subprocess
from unittest import mock

HERE = pathlib.Path(__file__).resolve().parent
path = HERE / "accepted-caller-oracle.py"
source = path.read_bytes()
assert len(source) == 8699
assert hashlib.sha256(source).hexdigest() == "c35c4e2d15123149605b5dd4c0b0e0f363ebf54c993154c5f5e9f7a27a2ba3c1"
spec = importlib.util.spec_from_file_location("carried_oracle", path)
m = importlib.util.module_from_spec(spec)
exec(compile(source, str(path), "exec", dont_inherit=True), m.__dict__)
for p in m.PINS:
    data = (m.REPO / p).read_bytes()
    m.PINS[p] = (len(data), hashlib.sha256(data).hexdigest())
with contextlib.ExitStack() as stack:
    for name in ("Popen", "run", "call", "check_call", "check_output"):
        stack.enter_context(mock.patch.object(subprocess, name, side_effect=AssertionError("no children authorized")))
    for name in ("system", "fork", "forkpty", "posix_spawn", "posix_spawnp"):
        if hasattr(os, name):
            stack.enter_context(mock.patch.object(os, name, side_effect=AssertionError("no OS children authorized")))
    m.main()
