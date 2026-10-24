#!/usr/bin/env python3
"""Reject real instruction mutations before full seals; keep originals readonly."""
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import tempfile

sys.dont_write_bytecode = True
tool = Path(__file__).resolve().parents[1] / 'tools/enigma-register-load-cause.py'
spec = importlib.util.spec_from_file_location('cause', tool)
cause = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cause)
path = Path(sys.argv[1])
original = path.read_bytes()
positive = cause.verify(path)
metadata = cause.parser()['pe'](path)
image = cause.Image(original, metadata)
controls = []
for va, replacement, reason in [
    (0x5ab903, b'\x89\xcb', 'symbol ECX saved'),
    (0x5ab95b, b'\x74', 'cached handle nonzero'),
    (0x5ab960, b'\xe8\x9b\xdd\x21\x00', 'LoadLibraryA call'),
    (0x5ab985, b'\x89\x5c\x24\x04', 'GetProcAddress(handle'),
    (0x5abaad, b'\xb8\x01\x00\x00\x00', 'loadlib argument index 2'),
    (0x5abe88, b'\x89\xd1', 'initializer ECX'),
    (0x5abc2c, b'\x74', 'successful open branches'),
    (0x5abdc6, b'\xb8\x2e\x00\x00\x00', 'first hyphen'),
    (0x9590f4, b'xpath', "literal 'cpath'"),
    (0x959030, b'\x40\xbe\x5a\x00', 'loadlib registration pair'),
]:
    mutant = bytearray(original)
    offset = image.offset(va, len(replacement))
    mutant[offset:offset + len(replacement)] = replacement
    try:
        cause.semantic(cause.Image(mutant, metadata))
    except ValueError as error:
        cause.require(reason in str(error), 'wrong rejection: ' + str(error))
        controls.append({'va': hex(va), 'replacement': replacement.hex(),
                         'sha256': hashlib.sha256(mutant).hexdigest(),
                         'rejected_before_seal': str(error)})
    else:
        raise AssertionError('semantic mutation accepted: ' + hex(va))

# A changed byte outside the selected proof remains forbidden by full-file seal.
mutant = bytearray(original)
mutant[0x40] ^= 1
cause.semantic(cause.Image(mutant, metadata))
with tempfile.TemporaryDirectory(prefix='seal-control-', dir=sys.argv[2]) as folder:
    changed = Path(folder) / 'enigma.exe'
    changed.write_bytes(mutant)
    try:
        cause.verify(changed)
    except ValueError as error:
        cause.require(str(error) == 'immutable Enigma seal', str(error))
    else:
        raise AssertionError('full seal accepted unrelated mutation')
cause.require(path.read_bytes() == original, 'standing original changed')
print(json.dumps({'verdict': 'PASS', 'positive_checks': len(positive['checks']),
                  'semantic_rejections': controls, 'full_seal_rejection': True,
                  'tool_sha256': hashlib.sha256(tool.read_bytes()).hexdigest(),
                  'test_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                  'exe_sha256': cause.EXE_SHA}, indent=2))
