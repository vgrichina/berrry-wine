#!/usr/bin/env python3
"""Verify saved range seals and closure; optionally verify a remote extracted tree."""
import hashlib
import json
import pathlib
import sys
import importlib.util

ROOT = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('probe', ROOT / 'probe.py')
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)
probe.OFFLINE = True
closure = json.loads((ROOT / 'closure.json').read_text())
listing = json.loads((ROOT / 'listing-Demos-Shadowman.json').read_text())
raw = probe.directory(listing['chain'][-1], True)
assert raw == listing['members']
assert len(raw) == closure['count'] == 23
assert sum(x['bytes'] for x in raw) == closure['bytes'] == 73339636
assert not any(x['directory'] or x['flags'] for x in raw)
seals = list((ROOT / 'ranges').glob('*.json'))
for seal in seals:
    record = json.loads(seal.read_text())
    data = seal.with_suffix('.bin').read_bytes()
    offset, length = map(int, seal.stem.split('-'))
    assert len(data) == length
    assert record['status'] == 206
    assert record['contentRange'] == f'bytes {offset}-{offset+length-1}/{probe.SIZE}'
    assert hashlib.sha256(data).hexdigest() == record['sha256']
for member, actual in zip(closure['members'], raw):
    assert all(member[k] == actual[k] for k in actual)
    if member['sha256']:
        data = probe.fetch(member['offset'], member['bytes'])
        assert hashlib.sha256(data).hexdigest() == member['sha256']
        assert hashlib.sha1(data).hexdigest() == member['sha1']
if len(sys.argv) > 1:
    tree = pathlib.Path(sys.argv[1])
    actual = {x.relative_to(tree).as_posix(): x for x in tree.rglob('*') if x.is_file()}
    assert set(actual) == {x['name'] for x in raw}, 'Extraction has missing/extra files'
    hashes = []
    for member in closure['members']:
        path = actual[member['name']]
        assert path.stat().st_size == member['bytes'], path
        with path.open('rb') as stream:
            digest = hashlib.file_digest(stream, 'sha256').hexdigest()
        assert not member['sha256'] or digest == member['sha256'], path
        hashes.append({'name': member['name'], 'bytes': member['bytes'], 'sha256': digest})
    print(json.dumps({'extractedMembers': hashes}, indent=2))
else:
    print(json.dumps({'rangeSeals': len(seals), 'closureFiles': len(raw),
                      'closureBytes': closure['bytes'],
                      'wholeMembersHashed': sum(bool(x['sha256']) for x in closure['members']),
                      'isoRehashed': False, 'gameCabRecovered': False}, indent=2))
