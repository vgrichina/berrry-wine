"""Bounded selected-file recovery; never enumerate or pack unrelated captures.

The caller supplies a retained manifest, explicit (name, bytes, SHA256) pins,
and an exact-file fetch callback. Selection and unique-content accounting finish
before any fetch. Verified local content is reused without fetching it again.
"""
import hashlib
import pathlib
import re

LIMIT = 512 * 1024
CHUNK = 11264  # raw bytes; base64 response remains below 16 KiB


def select(manifest, wanted, limit=LIMIT):
    if not isinstance(limit, int) or not 0 <= limit <= LIMIT:
        raise ValueError('invalid selected-file limit')
    by_name = {}
    for row in manifest:
        name = row['path']
        if not isinstance(name, str) or not name or name in ('.', '..') or '/' in name or '\\' in name:
            raise ValueError('unsafe capture name')
        if type(row['bytes']) is not int or row['bytes'] < 0 or not re.fullmatch('[0-9a-f]{64}', row['sha256']):
            raise ValueError('invalid capture pin')
        if name in by_name and by_name[name] != row:
            raise ValueError('conflicting manifest name')
        by_name[name] = row
    unique, seen = [], set()
    for pin in wanted:
        row = by_name.get(pin['path'])
        if row is None or any(row[k] != pin[k] for k in ('bytes', 'sha256')):
            raise ValueError('selected pin mismatch')
        identity = (row['bytes'], row['sha256'])
        if identity not in seen:
            unique.append(dict(row))
            seen.add(identity)
    if sum(row['bytes'] for row in unique) > limit:
        raise ValueError('selected unique files exceed capture limit')
    return unique


def recover(manifest, wanted, local, destination, fetch):
    """fetch(name, offset, count) returns only the requested raw byte chunk.

    `local` maps selected representative names to existing files. No existing
    file is overwritten. Partial new files remain as evidence on failure.
    """
    rows = select(manifest, wanted)
    result = []
    for row in rows:
        path = pathlib.Path(local[row['path']]) if row['path'] in local else pathlib.Path(destination) / row['path']
        reused = row['path'] in local
        h = hashlib.sha256()
        count = 0
        if reused:
            if path.stat().st_size != row['bytes']:
                raise ValueError('local length mismatch')
            with path.open('rb') as f:
                while chunk := f.read(CHUNK):
                    h.update(chunk)
                    count += len(chunk)
        else:
            with path.open('xb') as f:
                while count < row['bytes']:
                    n = min(CHUNK, row['bytes'] - count)
                    chunk = fetch(row['path'], count, n)
                    if not isinstance(chunk, bytes) or len(chunk) != n:
                        raise ValueError('incomplete or oversized exact-file chunk')
                    f.write(chunk)
                    h.update(chunk)
                    count += n
        if count != row['bytes'] or h.hexdigest() != row['sha256']:
            raise ValueError('selected content mismatch')
        result.append(dict(row, local=str(path), reused=reused))
    return result
