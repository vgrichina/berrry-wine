#!/usr/bin/env python3
"""Independent source/static acceptance; tiny fixtures, never execute a PE.

Usage: python3 THIS.py CANDIDATE OUTPUT
Archive identity and objdump are isolated here; the unchanged real analyze CLI
reproducer is a separate mandatory first-boundary receipt. Exit 1 means REJECT.
"""
import hashlib
import importlib.util
import json
import struct
import sys
import zlib
from pathlib import Path
from unittest.mock import patch

candidate, out = map(Path, sys.argv[1:])
out.mkdir(parents=True, exist_ok=True)
spec = importlib.util.spec_from_file_location('candidate', candidate)
r = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r)
results = []


def record(name, passed, **details):
    results.append(dict(name=name, passed=passed, **details))
    (out/'checkpoint.json').write_text(json.dumps(results, indent=2))


def fixture(name, marker=0):
    root = out/name
    (root/'extracted/app').mkdir(parents=True)
    data = bytearray(128)
    data[:2] = b'MZ'
    struct.pack_into('<I', data, 60, 64)
    data[64:68] = b'PE\0\0'
    struct.pack_into('<H', data, 68, 0x14c)
    struct.pack_into('<H', data, 88, 0x10b)
    data[-1] = marker
    update(root, data)
    return root, data


def update(root, data):
    (root/'extracted/app/gltron.exe').write_bytes(data)
    (root/'inno-list.txt').write_text(
        'Listing "GLtron version 0.70" - setup data version 2.0.18\n'
        f' - "app/gltron.exe" (128 B) Adler32 0x{zlib.adler32(data):08x}\nDone.\n')


def analyze(root, imports):
    with patch.object(r, 'verify'), patch.object(r, 'tool', return_value=imports):
        return r.analyze(root/'original.exe')


system = ' DLL Name: KERNEL32.dll\n'
root, data = fixture('valid')
analyze(root, system)
inventory = json.loads((root/'inventory.json').read_text())
closure = json.loads((root/'closure.json').read_text())
record('valid-closure', not closure['unresolved'] and
       inventory['files'][0]['sha256'] == hashlib.sha256(data).hexdigest() and
       inventory['files'][0]['path'] == closure['modules'][0]['path'])

for failure in ('checksum', 'malformed-pe'):
    for preexisting in (False, True):
        root, data = fixture(f'{failure}-{preexisting}')
        if preexisting:
            analyze(root, system)
        before = {p.name: p.read_bytes() for p in root.glob('*.json')}
        if failure == 'checksum':
            (root/'extracted/app/gltron.exe').write_bytes(b'tamper')
        else:
            update(root, b'XX'+data[2:])
        try:
            analyze(root, system)
        except ValueError as error:
            record(f'{failure}-preserves-{preexisting}',
                   before == {p.name: p.read_bytes() for p in root.glob('*.json')},
                   error=str(error))
        else:
            record(f'{failure}-preserves-{preexisting}', False)

root, data = fixture('unresolved-fresh')
try:
    analyze(root, ' DLL Name: missing.dll\n')
except ValueError:
    record('unresolved-no-new-inventory', not (root/'inventory.json').exists())
else:
    record('unresolved-no-new-inventory', False)

# Mutation sensitivity: restore the old eager inspect_payload publication.
original = candidate.read_text()
needle = "inventory = inspect_payload(root/'extracted', listing, root, publish=False)"
assert original.count(needle) == 1
mutant_source = original.replace(needle, "inventory = inspect_payload(root/'extracted', listing, root)")
namespace = {'__name__': 'eager_mutant', '__file__': str(candidate)}
exec(compile(mutant_source, str(candidate)+'[eager-mutation]', 'exec'), namespace)
root, data = fixture('eager-mutation')
with patch.dict(namespace, verify=lambda _: None, tool=lambda *args: ' DLL Name: missing.dll\n'):
    try:
        namespace['analyze'](root/'original.exe')
    except ValueError:
        record('eager-mutation-rejected', (root/'inventory.json').exists(),
               mutantSHA256=hashlib.sha256(mutant_source.encode()).hexdigest(),
               rejectedInvariant='no inventory on failed validation')
    else:
        record('eager-mutation-rejected', False)

# Decisive new concern: existing successful generation A, then changed B whose
# unresolved imports reject. Both published files must preserve A together.
root, data = fixture('mixed-generation')
analyze(root, system)
before = {name: (root/name).read_bytes() for name in ('inventory.json', 'closure.json')}
for name, content in before.items():
    (out/('before-'+name)).write_bytes(content)
data[-1] = 1
update(root, data)
try:
    analyze(root, ' DLL Name: generation-B-missing.dll\n')
except ValueError as error:
    after = {name: (root/name).read_bytes() for name in before}
    record('failed-reanalysis-preserves-published-pair', before == after,
           error=str(error), inventoryPreserved=before['inventory.json'] == after['inventory.json'],
           closurePreserved=before['closure.json'] == after['closure.json'],
           oldPayloadSHA256=json.loads(before['inventory.json'])['files'][0]['sha256'],
           newPayloadSHA256=hashlib.sha256(data).hexdigest(),
           actualClosure=json.loads(after['closure.json']))
else:
    record('failed-reanalysis-preserves-published-pair', False)

decision = 'ACCEPT' if all(row['passed'] for row in results) else 'REJECT'
(out/'decision.json').write_text(json.dumps(dict(decision=decision,
    candidateSHA256=hashlib.sha256(candidate.read_bytes()).hexdigest(), results=results), indent=2))
print(json.dumps(dict(decision=decision, checks=len(results), failures=[x['name'] for x in results if not x['passed']])))
sys.exit(0 if decision == 'ACCEPT' else 1)
