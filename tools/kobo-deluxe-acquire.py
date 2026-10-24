#!/usr/bin/env python3
"""Bounded upstream acquisition. Never execute downloaded files."""
import argparse
import hashlib
import json
import pathlib
import subprocess
import sys
import urllib.request


def sequence(stages):
    """Exceptions propagate; no dependent stage executes after rejection."""
    for stage in stages:
        stage()


def guard_size(size, limit):
    if size < 0 or size > limit:
        raise ValueError(f"byte guard rejected {size} > {limit}")


def self_test(directory):
    root = pathlib.Path(directory)
    sentinel = root / 'forbidden-sentinel-download'
    if sentinel.exists():
        raise ValueError('sentinel already exists')
    receipt = {}
    for kind in ['metadata', 'bytes']:
        command = [sys.executable, __file__, '--reject-fixture', kind,
                   '--sentinel', str(sentinel)]
        result = subprocess.run(command, capture_output=True, text=True,
                                timeout=10, check=False)
        receipt[kind] = {'command': command, 'exit_code': result.returncode,
                         'error': result.stderr[-2048:],
                         'sentinel_absent': not sentinel.exists()}
        assert result.returncode != 0, 'rejecting guard did not propagate'
    assert all(r['sentinel_absent'] for r in receipt.values())
    (root / 'sequence-negative.json').write_text(json.dumps(receipt, indent=2)+'\n')


def acquire(url, target, limit, expected=None):
    if not url.startswith('https://olofson.net/kobodl/'):
        raise ValueError('only assigned upstream permitted')
    dest = pathlib.Path(target)
    if dest.exists():
        raise ValueError('refusing to overwrite retained input')
    metadata = {}

    def head():
        req = urllib.request.Request(url, method='HEAD')
        with urllib.request.urlopen(req, timeout=30) as response:
            metadata.update(url=url, final_url=response.url,
                            status=response.status, headers=dict(response.headers))
            if response.status != 200:
                raise ValueError('non-200 metadata')

    def metadata_guard():
        headers = {k.lower(): v for k,v in metadata['headers'].items()}
        if 'content-length' in headers:
            guard_size(int(headers['content-length']), limit)
        if not metadata['final_url'].startswith('https://olofson.net/kobodl/'):
            raise ValueError('unexpected redirect')

    def download():
        total = 0
        digest = hashlib.sha256()
        with urllib.request.urlopen(url, timeout=30) as response, dest.open('xb') as out:
            if response.status != 200 or response.url != metadata['final_url']:
                raise ValueError('GET differs from accepted metadata')
            while True:
                block = response.read(min(65536, limit-total+1))
                if not block:
                    break
                total += len(block)
                guard_size(total, limit)
                out.write(block)
                digest.update(block)
        metadata.update(bytes=total, sha256=digest.hexdigest(), limit=limit)

    def byte_guard():
        guard_size(dest.stat().st_size, limit)
        if expected and metadata['sha256'] != expected:
            raise ValueError('archive SHA256 mismatch')

    try:
        sequence([head, metadata_guard, download, byte_guard])
    except Exception as exc:
        metadata.update(outcome='STOP: no dependent request permitted',
                        error_type=type(exc).__name__, error=str(exc),
                        http_status=getattr(exc, 'code', None),
                        retained_bytes=dest.stat().st_size if dest.exists() else 0)
        dest.with_name(dest.name+'.failure.json').write_text(
            json.dumps(metadata, indent=2)+'\n')
        raise
    dest.with_name(dest.name+'.receipt.json').write_text(json.dumps(metadata, indent=2)+'\n')
    return metadata


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--self-test')
    ap.add_argument('--reject-fixture', choices=['metadata', 'bytes'])
    ap.add_argument('--sentinel')
    ap.add_argument('--url')
    ap.add_argument('--output')
    ap.add_argument('--limit', type=int)
    ap.add_argument('--sha256')
    args = ap.parse_args()
    if args.reject_fixture:
        sequence([lambda: guard_size(65 if args.reject_fixture == 'metadata' else 129, 64),
                  lambda: pathlib.Path(args.sentinel).write_bytes(b'forbidden')])
    elif args.self_test:
        self_test(args.self_test)
    else:
        print(json.dumps(acquire(args.url, args.output, args.limit, args.sha256)))
