#!/usr/bin/env python3
"""Independent bounded acceptance. Run under the task descendant supervisor.

The candidate is imported unchanged for isolated stage controls; production CLI
checks are actual subprocesses. Fixture listings never establish acceptance of
the original distribution. No installer, PE, or archive extraction is executed.
"""
import hashlib
import importlib.util
import json
import shutil
import subprocess
import sys
import zlib
from pathlib import Path

candidate, retained, out = map(Path, sys.argv[1:])
out.mkdir(parents=True, exist_ok=True)
spec = importlib.util.spec_from_file_location('candidate', candidate)
r = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r)
results = []
header = 'Listing "GLtron version 0.70" - setup data version 2.0.18\n'


def record(name, passed, **details):
    results.append(dict(name=name, passed=passed, **details))
    (out/'checkpoint.json').write_text(json.dumps(results, indent=2))


def cli(name, op, path):
    with (out/(name+'.stdout')).open('wb') as stdout, (out/(name+'.stderr')).open('wb') as stderr:
        p = subprocess.run([sys.executable, str(candidate), op, str(path)],
                           stdout=stdout, stderr=stderr, timeout=20)
    return p.returncode


def row(name='app/x', size='4 B', checksum='040c01aa'):
    return f' - "{name}" ({size}) Adler32 0x{checksum}\n'


# Exact CLI hash/type boundary: no extraction output or dependent tool log.
for name, content in [('wrong-hash', b'wrong'), ('empty', b'')]:
    root = out/name
    root.mkdir()
    archive = root/'bad.exe'
    archive.write_bytes(content)
    status = cli(name, 'extract', archive)
    record(name, status != 0 and not (root/'extracted').exists()
           and not (root/'inno-list.txt').exists(), exit=status)
root = out/'oversize'
root.mkdir()
archive = root/'bad.exe'
# One byte over MAX_ARCHIVE would violate the task file-size cap. The unchanged
# metadata guard exercises oversize instead; a sparse file is still file-sized.
sentinel = root/'dependent'
try:
    r.sequence(lambda: r.metadata_guard(r.MAX_ARCHIVE+1, r.SHA256), lambda _: sentinel.touch())
except ValueError:
    record('oversize-metadata', not sentinel.exists())
else:
    record('oversize-metadata', False)

# Independent listing controls, kept distinct from production CLI acceptance.
good = header+row()+'Done.\n'
malformed = {
    'wrong-version': good.replace('2.0.18','6.0.5'),
    'missing-terminator': good.replace('Done.',''),
    'malformed-size': good.replace('4 B','nan B'),
    'link-record': header+'Symlink = /tmp/escape\nDone.\n',
    'member-bound': header+row(size='13 MiB')+'Done.\n',
    'prewrite-bound': header+''.join(row(f'app/x{i}', '8 MiB') for i in range(3))+'Done.\n',
    'case-collision': header+row()+row('app/X')+'Done.\n',
}
for index, path in enumerate(('../escape','app/../escape','/app/x','C:/app/x','app/C:x',
                              'app//x','app/./x','app\\..\\escape')):
    malformed[f'unsafe-path-{index}'] = header+row(path)+'Done.\n'
for name, text in malformed.items():
    sentinel = out/(name+'.dependent')
    try:
        r.sequence(lambda: r.inno_plan(text), lambda _: sentinel.touch())
    except (ValueError, OverflowError):
        record(name, not sentinel.exists(), boundary='isolated exact stage')
    else:
        record(name, False)

# Dump normalization and verify flow, including checksum and member rejection.
for name in ('valid-normalization','extra','missing','size','checksum','symlink'):
    root = out/name
    dest = root/'extracted'
    dest.mkdir(parents=True)
    data = b'good'
    plan = r.inno_plan(header+row(checksum=f'{zlib.adler32(data):08x}')+'Done.\n')
    raw = dest/'{app}\\x'
    if name != 'missing':
        raw.write_bytes(b'evil' if name=='checksum' else b'longer' if name=='size' else data)
    if name == 'extra':
        (dest/'{app}\\extra').write_bytes(b'x')
    if name == 'symlink':
        raw.unlink()
        raw.symlink_to(root/'absent')
    try:
        r.normalize_dump(dest, plan)
        r.inspect_payload(dest, plan, root)
    except ValueError as error:
        record(name, name!='valid-normalization' and not (root/'inventory.json').exists(), error=str(error))
    else:
        record(name, name=='valid-normalization' and (dest/'app/x').read_bytes()==data)

# Actual production analyze CLI with the immutable original's bytes, but a tiny
# owned extracted fixture and its own exact checksum listing. Never mutate donor.
root = out/'closure-failure'
(root/'extracted/app').mkdir(parents=True)
archive = root/'original.exe'
shutil.copyfile(retained/'gltron-0.70-win32.exe', archive)
assert hashlib.sha256(archive.read_bytes()).hexdigest() == r.SHA256
pe = retained/'extracted/app/gltron.exe'
shutil.copyfile(pe, root/'extracted/app/gltron.exe')
actual_listing = (retained/'inno-list.txt').read_text()
line = next(line for line in actual_listing.splitlines() if '"app/gltron.exe"' in line)
(root/'inno-list.txt').write_text(header+line+'\nDone.\n')
status = cli('closure-failure', 'analyze', archive)
closure = json.loads((root/'closure.json').read_text()) if (root/'closure.json').exists() else None
record('closure-failure-propagates', status!=0 and bool(closure and closure['unresolved']),
       exit=status, unresolved=closure['unresolved'] if closure else None)
record('no-inventory-on-failed-closure', not (root/'inventory.json').exists(),
       inventoryPublished=(root/'inventory.json').exists(), exit=status)

decision = 'ACCEPT' if all(x['passed'] for x in results) else 'REJECT'
(out/'decision.json').write_text(json.dumps({'decision':decision, 'results':results}, indent=2))
print(json.dumps({'decision':decision, 'checks':len(results), 'failures':[x['name'] for x in results if not x['passed']]}))
# A completed rejection is a successful acceptance experiment, not a test pass.
