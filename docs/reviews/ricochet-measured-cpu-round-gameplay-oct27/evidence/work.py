"""Read-only subset of the pinned Ricochet work.py transport interface.

The guest serial.py is retained byte-exact beside this fixture. This module
does not import/start that controller. No runtime is performed on import.
"""
import importlib.util
import math
import pathlib
import shlex
import time

H = pathlib.Path('/tmp/ricochet-measured-cpu-round-gameplay-oct27')
O = H / 'ops'
R = str(H)
BOX = 'bx_e9mecsag'
_path = '/tmp/ricochet-accepted-cleanup-merged-integration-oct26/repo/tools/boat-capture-readback.py'
_spec = importlib.util.spec_from_file_location('boat_capture_readback', _path)
capture = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(capture)


def python_argv(code, remaining):
    # Same boat exec JSON envelope, remote Python -c and 8192B full-response
    # ceiling as parent work.py. Only these stateless file reads may overlap.
    # Both quoting layers are explicit; target strings never become shell text.
    seconds = max(1, min(30, math.ceil(remaining)))
    cmd = ('timeout 120 prlimit --cpu=90 --fsize=25165824 -- sh -c ' +
           shlex.quote('python3 -c ' + shlex.quote(code)))
    return ['boat', '--no-update', '--json', 'exec', '--timeout', str(seconds), BOX, cmd]


def read_executor():
    return capture.SubprocessExecutor(python_argv)
