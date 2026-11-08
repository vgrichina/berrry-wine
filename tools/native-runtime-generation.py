"""Explicit provider transitions for a selected native-runtime generation.

Historical manifests are immutable recovery evidence. A transition authorizes
exact old and new rows, rather than silently refreshing every historical pin.
The returned manifest is consumed by the ordinary provisioner and barriers.
"""
from pathlib import Path
import copy
import hashlib
import json


def digest(data):
    return hashlib.sha256(data).hexdigest()


def select(root, historical, *, historical_sha256, protected_count, replacements, additions=()):
    root = Path(root).resolve()
    additions = tuple(additions)
    raw = Path(historical).read_bytes()
    if digest(raw) != historical_sha256:
        raise ValueError('historical generation changed')
    old = json.loads(raw)
    result = copy.deepcopy(old)
    rows = result['files']
    if not 0 < protected_count <= len(rows):
        raise ValueError('explicit protected provider prefix required')
    byname = {row['path']: i for i, row in enumerate(rows)}
    if len(byname) != len(rows):
        raise ValueError('duplicate historical provider')
    changes = []
    seen = set()

    def current(row):
        name = row['path']
        target = (root / name).resolve()
        if Path(name).is_absolute() or not target.is_relative_to(root) or target.relative_to(root).as_posix() != name:
            raise ValueError('noncanonical selected provider')
        if row.get('provider'):
            raise ValueError('transition must select current physical bytes')
        data = target.read_bytes()
        if len(data) != row['size'] or digest(data) != row['sha256']:
            raise ValueError('selected current bytes changed: ' + name)
        return copy.deepcopy(row)

    for transition in replacements:
        name = transition['before']['path']
        if name in seen or name not in byname:
            raise ValueError('duplicate or unknown replacement')
        seen.add(name)
        index = byname[name]
        if index < protected_count:
            raise ValueError('protected original provider: ' + name)
        if rows[index] != transition['before'] or transition['after']['path'] != name:
            raise ValueError('replacement does not match historical row')
        rows[index] = current(transition['after'])
        changes.append(copy.deepcopy(transition))
    for row in additions:
        if row['path'] in byname:
            raise ValueError('duplicate selected provider')
        byname[row['path']] = len(rows)
        rows.append(current(row))
    if rows[:protected_count] != old['files'][:protected_count]:
        raise ValueError('original provider prefix changed')
    result['selectedGeneration'] = dict(
        version=1, historicalManifestSha256=historical_sha256,
        historicalProviders=len(old['files']), protectedProviders=protected_count,
        replacements=changes, additions=[row['path'] for row in additions])
    return result
