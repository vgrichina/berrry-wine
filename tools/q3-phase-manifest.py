"""Offline-only Q3 phase staging. No allocation, browser or runtime launch."""
from pathlib import Path
import argparse
import gzip
import hashlib
import json
import subprocess
import sys


def digest(data):
    return hashlib.sha256(data).hexdigest()


def verify(root, prepared):
    packed = (prepared / 'runtime-pins.json.gz').read_bytes()
    raw = gzip.decompress(packed)  # Also validates the complete gzip CRC/footer.
    seal = json.loads((prepared / 'replacement-pinset-seal.json').read_bytes())
    assert digest(raw) == seal['manifestSHA256'], 'sealed manifest mismatch'
    pins = json.loads(raw)
    assert len(pins['files']) == seal['providers']
    paths = set()
    for pin in pins['files']:
        name = pin['path']
        target = (root / name).resolve()
        assert target.is_relative_to(root) and name not in paths, name
        paths.add(name)
        data = target.read_bytes()
        assert len(data) == pin['size'] and digest(data) == pin['sha256'], name
    for phase in ('cancellation', 'original'):
        runtime = prepared.parent / phase / 'runtime.py'
        assert str(runtime.relative_to(root)) in paths, 'unsealed runtime'
    return packed, seal


def stage(root, prepared):
    root, prepared = root.resolve(), prepared.resolve()
    prepared.relative_to(root)
    assert prepared.name == 'prepared'
    packed, seal = verify(root, prepared)
    destinations = [prepared.parent / phase / 'prepared'
                    for phase in ('cancellation', 'original')]
    # Refuse every collision before any staging mutation.
    assert all(not p.exists() for p in destinations), 'phase directory collision'
    receipts = []
    for dest in destinations:
        dest.mkdir()
        for directory in (dest, dest / 'check-only'):
            if directory != dest:
                directory.mkdir()
            with (directory / 'runtime-pins.json.gz').open('xb') as stream:
                stream.write(packed)
            (directory / 'runtime-pins.json.gz').chmod(0o444)
        result = subprocess.run([
            sys.executable, '-B', str(root / 'tools/q3-native-prelaunch.py'),
            str(root), str(dest / 'check-only'), str(dest.parent / 'runtime.py'),
            '--check-only'], capture_output=True)
        receipt = dict(phase=dest.parent.name, status=result.returncode,
                       actualWait=True, stdoutEOF=True, stderrEOF=True,
                       stdout=result.stdout.decode(), stderr=result.stderr.decode())
        receipts.append(receipt)
        assert result.returncode == 0, receipt
    # Separate opens/decompression after both checks: actual launch paths AND
    # check-only directories must each independently match the sealed bytes.
    checks = []
    for directory in [prepared] + [d for p in destinations for d in (p, p / 'check-only')]:
        data = (directory / 'runtime-pins.json.gz').read_bytes()
        raw = gzip.decompress(data)
        assert digest(data) == digest(packed) and len(data) == len(packed)
        assert digest(raw) == seal['manifestSHA256']
        checks.append(dict(path=str(directory / 'runtime-pins.json.gz'),
                           size=len(data), sha256=digest(data),
                           manifestSHA256=digest(raw), gzipCRC=True))
    verify(root, prepared)
    return dict(passed=True, offlineOnly=True, spawnRuntime=False,
                checks=checks, prelaunch=receipts)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('root', type=Path)
    parser.add_argument('prepared', type=Path)
    args = parser.parse_args()
    print(json.dumps(stage(args.root, args.prepared), indent=2))
