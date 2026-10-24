#!/usr/bin/env python3
"""Offline independent receipt/PNG check; never launches a browser or imports production JS."""
import hashlib
import json
from pathlib import Path
import struct
import sys
import zlib


def require(ok, why):
    if not ok:
        raise ValueError(why)


def png(data):
    require(data[:8] == b'\x89PNG\r\n\x1a\n', 'PNG signature')
    offset, compressed, ended = 8, bytearray(), False
    while offset < len(data):
        length = struct.unpack('>I', data[offset:offset+4])[0]
        kind = data[offset+4:offset+8]
        body = data[offset+8:offset+8+length]
        crc = struct.unpack('>I', data[offset+8+length:offset+12+length])[0]
        require(zlib.crc32(kind+body) == crc, 'PNG CRC')
        if kind == b'IHDR':
            require(struct.unpack('>IIBBBBB', body) == (8, 8, 8, 6, 0, 0, 0), 'PNG dimensions/format')
        if kind == b'IDAT':
            compressed.extend(body)
        offset += length+12
        if kind == b'IEND':
            ended = True
            break
    require(ended and offset == len(data), 'PNG end')
    raw = zlib.decompress(compressed)
    require(len(raw) == 8*33, 'PNG decompressed size')
    rows, prev = [], [0]*32
    for y in range(8):
        filt, row = raw[y*33], list(raw[y*33+1:(y+1)*33])
        require(filt in range(5), 'PNG filter')
        for i in range(32):
            a, b, c = (row[i-4] if i >= 4 else 0), prev[i], (prev[i-4] if i >= 4 else 0)
            p = a+b-c
            distances = [abs(p-a), abs(p-b), abs(p-c)]
            paeth = [a, b, c][distances.index(min(distances))]
            row[i] = (row[i]+[0, a, b, (a+b)//2, paeth][filt]) % 256
        rows.append([row[i:i+4] for i in range(0, 32, 4)])
        prev = row
    return rows


def expected(name, x, y):
    blue, green = [0, 0, 255, 255], [0, 255, 0, 255]
    if name == 'wrapper-default-one-after-quarter' or name.endswith('fresh-stencil-52'):
        return green
    if name.endswith('fresh-quarter-rejects-half'):
        return blue
    if name == 'clipped-top-left-red-channel':
        return [255, 0, 255, 255] if 1 <= x < 3 and 1 <= y < 4 else blue
    if name == 'depth-rectangle-and-stencil-retention':
        return green if 1 <= x < 4 and 1 <= y < 3 else blue
    if name == 'stencil-rectangle-origin':
        return green if 4 <= x < 7 and 3 <= y < 6 else blue
    raise ValueError('Unknown PNG '+name)


def verify(root):
    load = lambda n: json.loads((root/n).read_text())
    manifest = load('manifest.json')
    require(len(manifest) == 52, '52 seals')
    for name, seal in manifest.items():
        require(Path(name).name == name, 'flat seal path')
        data = (root/name).read_bytes()
        require(len(data) == seal['bytes'] and hashlib.sha256(data).hexdigest() == seal['sha256'], 'seal '+name)
    numeric, summary = load('numeric-outcomes.json'), load('summary.json')
    outcomes, names = [], None
    for i, (variant, passes, mismatches) in enumerate([
            ('candidate', 56, 0), ('producer', 55, 64),
            ('intermediate', 50, 384), ('reject-rectangles', 49, 363)]):
        d = load(variant+'.json')
        checks = d['checks']
        require(not d['errors'] and len(d['identities']) == 1, variant+' errors/identity')
        keys = [(c['name'], c['kind']) for c in checks]
        require(len(keys) == 56 and len(set(keys)) == 56 and (names is None or keys == names), 'same 56 checks')
        names = keys
        pixels = [c for c in checks if c['kind'] == 'pixels']
        require(len(pixels) == 50, '50 pixel checks')
        for c in checks:
            if c['kind'] == 'pixels':
                require(c['pixels'] == 64 and type(c['mismatch']) is int and 0 <= c['mismatch'] <= 64, 'pixel count')
                require(c['pass'] == (c['mismatch'] == 0) and (c['first'] is None) == c['pass'], 'pixel classification')
            else:
                require(c['kind'] in ('capability', 'validation') and c['pass'] is True, 'nonpixel failure')
        failed = [c for c in checks if not c['pass']]
        require(sum(c['mismatch'] for c in pixels) == mismatches, variant+' mismatch total')
        require(d['passed'] == passes and d['failed'] == len(failed) == 56-passes, variant+' totals')
        n = numeric[i]
        require(n == dict(variant=variant, passed=passes, failed=56-passes, pixelChecks=50,
                          pixels=3200, mismatches=mismatches, failedChecks=failed, sources=d['sources']), 'numeric aggregation')
        require(summary['results'][i] == dict(variant=variant, passed=passes, failed=56-passes,
                                              errors=[], failedNames=[c['name'] for c in failed]), 'summary aggregation')
        images = list(root.glob(variant+'-*.png'))
        require(len(images) == 10, '10 images per variant')
        for image in images:
            name = image.stem[len(variant)+1:]
            check = next(c for c in pixels if c['name'] == name)
            decoded = png(image.read_bytes())
            bad = [dict(x=x, y=y, got=decoded[y][x], want=expected(name, x, y))
                   for y in range(8) for x in range(8) if decoded[y][x] != expected(name, x, y)]
            require(len(bad) == check['mismatch'] and (bad[0] if bad else None) == check['first'], image.name+' RGBA')
        outcomes.append(dict(variant=variant, passed=passes, failed=56-passes, pixels=3200,
                             mismatches=mismatches, independentlyDecodedPixels=640))
    cleanup = load('cleanup-resource.json')
    require(summary['accepted'] is True and cleanup['exit'] == 0 and cleanup['descendantsRemaining'] == [], 'completion')
    require(cleanup['sandboxDisabled'] is False and '--no-sandbox' not in summary['chromeArgs'], 'sandbox flags')
    return dict(verdict='accepted', seals=52, PNGs=40, outcomes=outcomes,
                limitation='640 saved pixels per variant independently decoded; all 3200 numeric observations aggregated, no browser rerun')


if __name__ == '__main__':
    try:
        print(json.dumps(verify(Path(sys.argv[1])), indent=2))
    except (ValueError, KeyError, StopIteration, OSError, struct.error, zlib.error) as error:
        print('REJECT: '+str(error), file=sys.stderr)
        sys.exit(1)
