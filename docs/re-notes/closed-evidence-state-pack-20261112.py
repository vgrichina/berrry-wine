"""Losslessly pack an explicitly reviewed [size, path] list of closed state gzip files.

Run from the repository root. Only the fixed historical allowlist is accepted.
Replacements and their index are fsynced and read back before any unlink.
"""
from pathlib import Path
import argparse, collections, gzip, hashlib, json, lzma, os, sys, tempfile, zlib

sha = lambda data: hashlib.sha256(data).hexdigest()
ALLOWED = {
    '20261107-lords2-' + suffix for suffix in (
        'pit-calibration', 'map-interaction', 'after-progman-gameplay',
        'season-progress', 'army-controls', 'winexec-search', 'combat-conquest')
} | {'20261109-supertux-prompt-image-jump-0525'}
JOURNALS = {
    'scratch/runs/20261108-browser-journal-remote-service/retrieved/software/observer-journal.jsonl.gz',
    'scratch/runs/20261107-graphics-threaded-followthrough/retrieved/actual/threads/raw/gl-state.jsonl.gz',
    'scratch/runs/20261108-darkstone-chamber-explore-1740/recovered/custody-history.jsonl.gz',
    'scratch/runs/20261108-darkstone-cape-1650/recovered/custody-history.jsonl.gz',
    'scratch/runs/20261108-darkstone-level-one/recovered/custody-history.jsonl.gz',
}


def syncdir(path):
    fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def write_new(path, data):
    with path.open('xb') as target:
        target.write(data)
        target.flush()
        os.fsync(target.fileno())


def stream_row(path, wire, stat, offset, compressor, stage, header_size):
    """Keep even multi-GB closed journals bounded to one 1-MiB raw chunk."""
    level = (3 if '/20261108-darkstone-' in str(path) and wire[8] == 0
             else 9 if wire[8] == 2 else 1 if wire[8] == 4 else 6)
    codec = zlib.compressobj(level, zlib.DEFLATED, -15)
    digest = hashlib.sha256(wire[:header_size])
    raw_digest = hashlib.sha256()
    size = 0
    with gzip.open(path, 'rb') as source:
        while chunk := source.read(1048576):
            raw_digest.update(chunk)
            size += len(chunk)
            digest.update(codec.compress(chunk))
            stage.write(compressor.compress(chunk))
    digest.update(codec.flush())
    digest.update(wire[-8:])
    assert digest.hexdigest() == sha(wire), 'Stream codec mismatch; retain original'
    return dict(original=dict(path=str(path), size=len(wire), sha256=sha(wire),
                mode=stat.st_mode & 0o7777, mtimeNs=stat.st_mtime_ns, atimeNs=stat.st_atime_ns,
                uid=stat.st_uid, gid=stat.st_gid, ino=stat.st_ino, ctimeNs=stat.st_ctime_ns),
                rawOffset=offset, rawSize=size, rawSHA256=raw_digest.hexdigest(),
                gzipLevel=level, gzipHeaderHex=wire[:header_size].hex(),
                gzipTrailerHex=wire[-8:].hex())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('plan')
    parser.add_argument('evidence')
    args = parser.parse_args()
    evidence = Path(args.evidence)
    groups = collections.defaultdict(list)
    for size, name in json.loads(Path(args.plan).read_text()):
        path = Path(name)
        assert ((path.parent.parent == Path('scratch/runs') and path.parent.name in ALLOWED
                 and path.name.endswith('-state.json.gz')) or str(path) in JOURNALS)
        assert not path.is_symlink()
        groups[path.parent].append((size, path))
    for run, files in groups.items():
        for start in range(0, len(files), 12):
            batch = files[start:start + 12]
            stem = 'state-1415-' + sha(str(batch).encode())[:12]
            pack = evidence / (run.name + '-' + stem + '.raw.xz')
            index = pack.with_suffix('.json')
            rows = []
            offset = 0
            # Only compressed output occupies tmpfs; raw observations stream one at a time.
            with tempfile.TemporaryFile(dir='/dev/shm') as stage:
                compressor = lzma.LZMACompressor(filters=[dict(
                    id=lzma.FILTER_LZMA2, preset=3, dict_size=67108864)])
                for expected_size, path in batch:
                    stat = path.stat()
                    wire = path.read_bytes()
                    assert len(wire) == expected_size
                    assert wire[:3] == b'\x1f\x8b\x08' and wire[3] in (0, 8)
                    header_size = wire.index(b'\0', 10) + 1 if wire[3] == 8 else 10
                    if str(path) in JOURNALS:
                        row = stream_row(path, wire, stat, offset, compressor, stage, header_size)
                        rows.append(row)
                        offset += row['rawSize']
                        continue
                    raw = gzip.decompress(wire)
                    level = next((level for level in (1, 9, 6, 3)
                                  if gzip.compress(raw, compresslevel=level, mtime=0)[10:] == wire[header_size:]), None)
                    assert level is not None, 'No exact gzip reproduction; retain original'
                    row = dict(original=dict(path=str(path), size=len(wire), sha256=sha(wire),
                               mode=stat.st_mode & 0o7777, mtimeNs=stat.st_mtime_ns,
                               atimeNs=stat.st_atime_ns, uid=stat.st_uid, gid=stat.st_gid,
                               ino=stat.st_ino, ctimeNs=stat.st_ctime_ns),
                               rawOffset=offset, rawSize=len(raw), rawSHA256=sha(raw),
                               gzipLevel=level, gzipHeaderHex=wire[:header_size].hex())
                    rows.append(row)
                    offset += len(raw)
                    stage.write(compressor.compress(raw))
                stage.write(compressor.flush())
                stage.seek(0)
                payload = stage.read()
            meta = dict(rawPack=pack.name, rawPackSHA256=sha(payload), packedBytes=len(payload),
                        rawBytes=offset, rows=rows, gzipMtime=0, gzipLevel=9,
                        python=sys.version, zlib=zlib.ZLIB_VERSION, zlibRuntime=zlib.ZLIB_RUNTIME_VERSION,
                        xzFilters='LZMA2 preset=3 dict_size=67108864',
                        originalGzipReconstructionVerified=True)
            if len(payload) + len(json.dumps(meta, indent=2)) >= sum(r['original']['size'] for r in rows):
                print(json.dumps(dict(skipped='No net space saving', paths=[str(p) for _, p in batch])), flush=True)
                continue
            write_new(pack, payload)
            write_new(index, (json.dumps(meta, indent=2) + '\n').encode())
            syncdir(evidence)
            assert sha(pack.read_bytes()) == meta['rawPackSHA256']
            assert json.loads(index.read_text()) == meta
            with lzma.open(pack, 'rb') as source:
                for row in rows:
                    assert source.tell() == row['rawOffset']
                    if 'gzipTrailerHex' in row:
                        codec = zlib.compressobj(row['gzipLevel'], zlib.DEFLATED, -15)
                        digest = hashlib.sha256(bytes.fromhex(row['gzipHeaderHex']))
                        raw_digest = hashlib.sha256()
                        remaining = row['rawSize']
                        while remaining:
                            chunk = source.read(min(1048576, remaining))
                            assert chunk
                            remaining -= len(chunk)
                            raw_digest.update(chunk)
                            digest.update(codec.compress(chunk))
                        digest.update(codec.flush())
                        digest.update(bytes.fromhex(row['gzipTrailerHex']))
                        assert raw_digest.hexdigest() == row['rawSHA256']
                        assert digest.hexdigest() == row['original']['sha256']
                        assert sha(Path(row['original']['path']).read_bytes()) == digest.hexdigest()
                        continue
                    raw = source.read(row['rawSize'])
                    assert sha(raw) == row['rawSHA256']
                    rebuilt = bytes.fromhex(row['gzipHeaderHex']) + gzip.compress(
                        raw, compresslevel=row['gzipLevel'], mtime=0)[10:]
                    original = row['original']
                    assert (len(rebuilt), sha(rebuilt)) == (original['size'], original['sha256'])
                    assert Path(original['path']).read_bytes() == rebuilt
                assert not source.read(1)
            for row in rows:
                path = Path(row['original']['path'])
                assert sha(path.read_bytes()) == row['original']['sha256']
                path.unlink()
            syncdir(run)
            print(json.dumps(dict(index=str(index), rows=len(rows),
                                  originalBytes=sum(r['original']['size'] for r in rows),
                                  packedBytes=len(payload), freeBytes=os.statvfs('/home').f_bavail *
                                  os.statvfs('/home').f_frsize)), flush=True)


if __name__ == '__main__':
    main()
