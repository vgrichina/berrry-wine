"""Restore closed observation packs into a separate owned directory; refuse overwrite.

--container reconstructs older grouped-gzip XZ containers byte for byte.
--raw-json extracts observation bytes independently of the pinned gzip codec.
"""
from pathlib import Path
import argparse
import hashlib
import json
import lzma
import os
import tempfile
import zlib


def file_sha(path):
    digest = hashlib.sha256()
    with path.open('rb') as source:
        while chunk := source.read(1048576):
            digest.update(chunk)
    return digest.hexdigest()


def restore(index, destination, container=False, raw_json=False):
    assert not (container and raw_json)
    meta = json.loads(index.read_text())
    archive = index.parent / meta['rawPack']
    assert file_sha(archive) == meta['rawPackSHA256']
    destination.mkdir(parents=True, exist_ok=True)
    count = 0
    with tempfile.TemporaryFile(dir='/dev/shm') as parts, lzma.open(archive, 'rb') as source:
        for row in meta['rows']:
            assert source.tell() == row['rawOffset']
            original = row['original']
            name = original['path'].removesuffix('.gz') if raw_json else original['path']
            target = (destination / name).resolve()
            assert target.is_relative_to(destination.resolve())
            raw_digest = hashlib.sha256()
            if container:
                output = parts
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                output = target.open('xb')
            # Matches gzip.compress(...,mtime=0) under pinned Python 3.11/zlib.
            codec = zlib.compressobj(row.get('gzipLevel', meta['gzipLevel']), zlib.DEFLATED, 31)
            wire_digest = hashlib.sha256()
            wire_size = 0
            first = True

            def emit(payload):
                nonlocal first, wire_size
                if not payload:
                    return
                if first and 'gzipHeaderHex' in row:
                    assert len(payload) >= 10
                    payload = bytes.fromhex(row['gzipHeaderHex']) + payload[10:]
                first = False
                wire_digest.update(payload)
                wire_size += len(payload)
                output.write(payload)

            remaining = row['rawSize']
            try:
                while remaining:
                    chunk = source.read(min(1048576, remaining))
                    assert chunk
                    remaining -= len(chunk)
                    raw_digest.update(chunk)
                    if raw_json:
                        output.write(chunk)
                    else:
                        emit(codec.compress(chunk))
                assert raw_digest.hexdigest() == row['rawSHA256']
                if not raw_json:
                    emit(codec.flush())
                    assert (wire_size, wire_digest.hexdigest()) == (original['size'], original['sha256']), (
                        'Use pinned Python/zlib for gzip bytes; --raw-json restores observation bytes independently.')
                output.flush()
                os.fsync(output.fileno())
            finally:
                if not container:
                    output.close()
            if not container:
                os.chmod(target, original['mode'])
                os.utime(target, ns=(original.get('atimeNs', original['mtimeNs']), original['mtimeNs']))
            count += 1
        assert not source.read(1)
        if container:
            parts.seek(0)
            codec = lzma.LZMACompressor(preset=meta['originalContainerXZPreset'])
            target = destination / meta['originalPack']
            assert target.resolve().is_relative_to(destination.resolve())
            with target.open('xb') as output:
                while chunk := parts.read(1048576):
                    output.write(codec.compress(chunk))
                output.write(codec.flush())
                output.flush()
                os.fsync(output.fileno())
            assert file_sha(target) == meta['originalSHA256']
            os.chmod(target, meta['originalMode'])
            os.utime(target, ns=(meta['originalMtimeNs'], meta['originalMtimeNs']))
    return dict(restored=count, mode='container' if container else 'raw-json' if raw_json else 'original-gzip',
                index=str(index), destination=str(destination))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('index', type=Path)
    parser.add_argument('destination', type=Path)
    parser.add_argument('--container', action='store_true')
    parser.add_argument('--raw-json', action='store_true')
    args = parser.parse_args()
    print(json.dumps(restore(args.index.resolve(), args.destination.resolve(), args.container, args.raw_json)))
