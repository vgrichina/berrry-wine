#!/usr/bin/env python3
"""Bounded, cached ISO9660 directory probe; never downloads the whole image."""
import argparse
import hashlib
import json
import pathlib
import struct
import urllib.request
from datetime import datetime, timezone

URL = 'https://archive.org/download/gsscda1999/1999-11/GS1199.iso'
SIZE = 674328576
ROOT = pathlib.Path(__file__).resolve().parent
LIMIT = 8 * 1024 * 1024
OFFLINE = False


def fetch(start, length):
    assert 0 <= start < SIZE and 0 < length <= 262144 and start + length <= SIZE
    cache = ROOT / 'ranges'
    cache.mkdir(exist_ok=True)
    target = cache / f'{start}-{length}.bin'
    if target.exists():
        data = target.read_bytes()
        assert len(data) == length
        return data
    assert not OFFLINE, f'Uncached range: {start}+{length}'
    assert sum(p.stat().st_size for p in cache.glob('*.bin')) + length <= LIMIT
    req = urllib.request.Request(URL, headers={'Range': f'bytes={start}-{start+length-1}',
                                              'Accept-Encoding': 'identity'})
    with urllib.request.urlopen(req, timeout=45) as response:
        expected = f'bytes {start}-{start+length-1}/{SIZE}'
        assert response.status == 206, f'Range refused: {response.status}'
        assert response.headers.get('Content-Range') == expected, dict(response.headers)
        data = response.read(length + 1)
        assert len(data) == length
        target.write_bytes(data)
        target.with_suffix('.json').write_text(json.dumps({
            'url': URL, 'finalUrl': response.url, 'status': response.status,
            'contentRange': expected, 'headers': dict(response.headers),
            'sha256': hashlib.sha256(data).hexdigest(),
            'observedAt': datetime.now(timezone.utc).isoformat()}, indent=2) + '\n')
    return data


def record(data, joliet=False):
    assert data[0] == len(data) and len(data) >= 34
    name = data[33:33+data[32]]
    if name in (b'\x00', b'\x01'):
        name = '.' if name == b'\x00' else '..'
    else:
        name = name.decode('utf-16-be' if joliet else 'ascii').split(';')[0]
    extent, length = struct.unpack_from('<I', data, 2)[0], struct.unpack_from('<I', data, 10)[0]
    assert extent == struct.unpack_from('>I', data, 6)[0]
    assert length == struct.unpack_from('>I', data, 14)[0]
    return {'name': name, 'extent': extent, 'bytes': length, 'directory': bool(data[25] & 2),
            'flags': data[25], 'offset': extent * 2048}


def directory(entry, joliet=False):
    data = fetch(entry['offset'], entry['bytes'])
    result, pos = [], 0
    while pos < len(data):
        size = data[pos]
        if not size:
            pos = (pos // 2048 + 1) * 2048
            continue
        r = record(data[pos:pos+size], joliet)
        if r['name'] not in ('.', '..'):
            result.append(r)
        pos += size
    return result


def main():
    global OFFLINE
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--walk', default='', help='ISO path; reads directories only')
    parser.add_argument('--offline', action='store_true', help='replay saved range bytes only')
    args = parser.parse_args()
    OFFLINE = args.offline
    desc = fetch(16*2048, 16*2048)
    volumes = []
    for pos in range(0, len(desc), 2048):
        v = desc[pos:pos+2048]
        assert v[1:6] == b'CD001'
        if v[0] in (1, 2):
            volumes.append((v[0], v))
        if v[0] == 255:
            break
    kind, v = next((x for x in volumes if x[0] == 2 and x[1][88:91] in (b'%/@', b'%/C', b'%/E')), volumes[0])
    joliet = kind == 2
    root = record(v[156:156+v[156]], joliet)
    current = root
    chain = []
    for name in filter(None, args.walk.strip('/').split('/')):
        current = next(x for x in directory(current, joliet) if x['name'].casefold() == name.casefold())
        assert current['directory']
        chain.append(current)
    out = {'url': URL, 'isoBytes': SIZE, 'volumeType': kind,
           'volumeId': v[40:72].decode('utf-16-be' if joliet else 'ascii').strip(),
           'root': root, 'path': args.walk, 'chain': chain,
           'members': directory(current, joliet)}
    dest = ROOT / ('listing-' + (args.walk.replace('/', '-') or 'root') + '.json')
    dest.write_text(json.dumps(out, indent=2) + '\n')
    print(json.dumps(out, indent=2))


if __name__ == '__main__':
    main()
