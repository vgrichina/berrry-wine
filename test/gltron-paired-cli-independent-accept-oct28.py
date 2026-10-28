#!/usr/bin/env python3
"""Independent bounded production CLI acceptance; synthetic bytes only.

Usage: THIS.py CANDIDATE OUTPUT. Exit 1 is a contract REJECT, not a harness
failure. Only archive authentication and objdump output are substituted. The
production main/analyze/inspection/publication path and filesystem are real.
No download, extraction, game execution, concurrent reader or crash claim.
"""
import contextlib
import errno
import hashlib
import importlib.util
import io
import json
import struct
import sys
import zlib
from pathlib import Path
from types import ModuleType
from unittest.mock import patch

candidate, out = map(Path, sys.argv[1:])
out.mkdir(parents=True, exist_ok=False)
spec = importlib.util.spec_from_file_location('production', candidate)
r = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r)
results = []
names = ('inventory.json', 'closure.json')


def record(name, passed, **details):
    results.append(dict(name=name, passed=passed, **details))
    checkpoint = out/'checkpoint.json'
    temporary = checkpoint.with_suffix('.new')
    temporary.write_text(json.dumps(results, indent=2))
    temporary.replace(checkpoint)
    if not passed:
        finish('REJECT')


def finish(decision):
    result = dict(decision=decision, candidateSHA256=hashlib.sha256(candidate.read_bytes()).hexdigest(),
                  results=results, scope='single writer, ordinary exceptions, synthetic static CLI')
    (out/'decision.json').write_text(json.dumps(result, indent=2))
    print(json.dumps(dict(decision=decision, checks=len(results), firstFailure=next(
        (x['name'] for x in results if not x['passed']), None))))
    raise SystemExit(0 if decision == 'ACCEPT' else 1)


def fixture(name):
    root = out/name
    (root/'extracted/app').mkdir(parents=True)
    update(root, 1)
    return root


def update(root, marker):
    data = bytearray(128)
    data[:2] = b'MZ'
    struct.pack_into('<I', data, 60, 64)
    data[64:68] = b'PE\0\0'
    struct.pack_into('<H', data, 68, 0x14c)
    struct.pack_into('<H', data, 88, 0x10b)
    data[-1] = marker
    (root/'extracted/app/gltron.exe').write_bytes(data)
    (root/'inno-list.txt').write_text(
        'Listing "GLtron version 0.70" - setup data version 2.0.18\n'
        f' - "app/gltron.exe" (128 B) Adler32 0x{zlib.adler32(data):08x}\nDone.\n')


def pair(root):
    return {n: (root/n).read_bytes() if (root/n).exists() else None for n in names}


def cli(root, imports='KERNEL32.dll', module=r):
    # main's argparse dispatch is executed unchanged; no helper stand-in.
    output = io.StringIO()
    with patch.object(sys, 'argv', [str(candidate), 'analyze', str(root/'original.exe')]), \
            patch.object(module, 'verify', return_value={'fixtureOnly': True}), \
            patch.object(module, 'tool', return_value=f' DLL Name: {imports}\n'), \
            contextlib.redirect_stdout(output):
        module.main()
    return json.loads(output.getvalue())


# Missing, stale and mismatched publications must be rebuilt from current input.
# Failed validation must preserve the exact pre-attempt state, even if incomplete.
for state in ('none', 'inventory-only', 'closure-only', 'stale', 'mismatched', 'malformed'):
    root = fixture(state)
    if state != 'none':
        cli(root)
        if state == 'inventory-only':
            (root/'closure.json').unlink()
        elif state == 'closure-only':
            (root/'inventory.json').unlink()
        elif state == 'mismatched':
            (root/'closure.json').write_text('{"modules":[],"old":"unrelated"}')
        elif state == 'malformed':
            (root/'inventory.json').write_bytes(b'not JSON')
    before = pair(root)
    update(root, 2)
    try:
        cli(root, 'missing-independent.dll')
    except ValueError as error:
        record(state+'-validation-preserves', pair(root) == before, error=str(error))
    else:
        record(state+'-validation-preserves', False)
    result = cli(root, 'USER32.dll')
    after = pair(root)
    inv, closure = [json.loads(after[n]) for n in names]
    record(state+'-successful-rebuild', result == {'modules': 1, 'unresolved': []}
           and inv['files'][0]['sha256'] == hashlib.sha256(
               (root/'extracted/app/gltron.exe').read_bytes()).hexdigest()
           and closure['modules'][0]['imports'][0]['dll'] == 'USER32.dll'
           and not list(root.glob('.analysis-pair-*')))
    if state in ('inventory-only', 'closure-only'):
        # Also exercise rollback from an incomplete old pair through the CLI.
        missing = 'closure.json' if state == 'inventory-only' else 'inventory.json'
        (root/missing).unlink()
        before = pair(root)
        update(root, 3)
        replace = r.os.replace
        def fail_second(src, dst):
            if Path(src).name == 'closure.json':
                raise OSError(errno.EIO, 'independent second replace failure')
            return replace(src, dst)
        with patch.object(r.os, 'replace', fail_second):
            try:
                cli(root)
            except OSError as error:
                record(state+'-replace-rollback', pair(root) == before
                       and not list(root.glob('.analysis-pair-*')), error=str(error))
            else:
                record(state+'-replace-rollback', False)

# Kill the original mixed-generation bug through the same production main.
text = candidate.read_text()
needle = "    if result['unresolved']:\n"
assert text.count(needle) == 1
mutated = text.replace(needle,
    "    (root/'closure.json').write_text(json.dumps(result,indent=2))\n"+needle)
mutant = ModuleType('premature_closure')
exec(compile(mutated, str(candidate)+'[premature-closure]', 'exec'), mutant.__dict__)
root = fixture('premature-closure-mutation')
cli(root, module=mutant)
before = pair(root)
update(root, 2)
try:
    cli(root, 'missing-independent.dll', mutant)
except ValueError:
    record('premature-closure-mutation-rejected', before != pair(root),
           mutantSHA256=hashlib.sha256(mutated.encode()).hexdigest())
else:
    record('premature-closure-mutation-rejected', False)

# A single ordinary cleanup error after replacement is still an observable
# failed generation. The published pair must remain A under the failed-run
# preservation contract. This gap is not covered by stage/rename tests.
root = fixture('cleanup-after-replacement')
cli(root)
before = pair(root)
for name in names:
    (root/('before-'+name)).write_bytes(before[name])
update(root, 2)
cleanup = r.shutil.rmtree
def fail_cleanup(path, *args, **kwargs):
    if Path(path).name.startswith('.analysis-pair-'):
        raise PermissionError(errno.EACCES, 'independent staging cleanup denial', str(path))
    return cleanup(path, *args, **kwargs)
try:
    with patch.object(r.shutil, 'rmtree', fail_cleanup):
        cli(root, 'USER32.dll')
except PermissionError as error:
    after = pair(root)
    for name in names:
        (root/('after-'+name)).write_bytes(after[name])
    record('cleanup-failed-generation-preserves-prior-pair', before == after,
           error=str(error), exceptionType=type(error).__name__,
           inventoryPreserved=before['inventory.json'] == after['inventory.json'],
           closurePreserved=before['closure.json'] == after['closure.json'],
           retainedStages=[str(p) for p in root.glob('.analysis-pair-*')])
else:
    record('cleanup-failed-generation-preserves-prior-pair', False,
           error='cleanup fault was not observed')
finish('ACCEPT')
