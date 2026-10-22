"""Bounded documented snapshot tree read and ONE canonical file recovery.

No layer URLs, new dependencies, guest commands, extraction codecs or compute.
Never retry on denial; never download the installed payload to this host.
"""
import hashlib
import json
import pathlib
import urllib.parse
import urllib.request
from check_metadata import HERE, CONFIG, SNAPSHOTS, NoRedirect, sanitize


def main():
    config = json.loads(CONFIG.read_text())
    assert config['api_url'].rstrip('/') == 'https://boat.dev'
    opener = urllib.request.build_opener(NoRedirect)
    headers = {'Authorization': 'Bearer ' + config['token']}
    if __import__('sys').argv[1:] == ['--canonical-only']:
        return recover_canonical(opener, headers)
    url = 'https://boat.dev/api/v1/snapshots/' + SNAPSHOTS['installed'] + '/tree'
    # JSON metadata, never an archive: at most 4MiB admitted working buffer.
    with opener.open(urllib.request.Request(url, headers=headers), timeout=45) as f:
        assert f.status == 200 and 'json' in f.headers.get('Content-Type', '')
        data = f.read(4194305)
        assert len(data) <= 4194304
        tree = json.loads(data)
    prefixes = ['shadow-man-install-quota-oct22/session',
                'shadow-man-install-continue-oct22/retained-session',
                'shadow-man-install-continue-oct22/retained-game',
                'shadow-man-install-continue-oct22/retained-bounded-game']
    entries = tree['entries']
    selected = [e for e in entries if any(e['path'] == p or
                e['path'].startswith(p + '/') for p in prefixes)]
    receipt = {'snapshot': SNAPSHOTS['installed'], 'httpStatus': 200,
               'metadataBytes': len(data), 'metadataSHA256': hashlib.sha256(data).hexdigest(),
               'entries': selected}
    (HERE / 'raw/installed-selected-tree.json').write_text(json.dumps(receipt, indent=2)+'\n')
    # Release metadata objects before the file stream.
    del entries, selected, receipt, tree, data
    return recover_canonical(opener, headers)


def recover_canonical(opener, headers):
    size = 1879387
    expected = 'ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553'
    path = 'shadow-man-dsetup-canonical-qualification-oct22/build/wine-assembly.wasm'
    url = 'https://boat.dev/api/v1/snapshots/' + SNAPSHOTS['canonical'] + '/files?'
    url += urllib.parse.urlencode({'path': path})
    target = HERE / 'canonical-primary.wasm'
    assert not target.exists(), 'One-shot output already exists; no implicit retry'
    request = urllib.request.Request(url, headers={**headers, 'Range': f'bytes=0-{size-1}'})
    with opener.open(request, timeout=60) as f:
        receipt = {'snapshot': SNAPSHOTS['canonical'], 'path': path,
                   'httpStatus': f.status,
                   'headers': {k: f.headers.get(k) for k in
                       ['Content-Length','Content-Range','Content-Type','X-Snapshot-Entry-Kind']},
                   'bufferBytes': 65536, 'expectedBytes': size, 'expectedSHA256': expected}
        assert f.status == 206
        assert f.headers.get('Content-Range') == f'bytes 0-{size-1}/{size}'
        # A chunked HTTP response may omit Content-Length. Content-Range
        # establishes the exact total; the read loop enforces it independently.
        assert f.headers.get('Content-Length') in (None, str(size))
        assert f.headers.get('X-Snapshot-Entry-Kind') == 'file'
        h = hashlib.sha256()
        count = 0
        with target.open('xb') as out:
            while count < size:
                block = f.read(min(65536, size-count))
                assert block, 'Truncated canonical response'
                out.write(block)
                h.update(block)
                count += len(block)
        assert f.read(1) == b''
        receipt.update(actualBytes=count, actualSHA256=h.hexdigest())
        receipt['hashVerified'] = h.hexdigest() == expected
        (HERE / 'raw/canonical-recovery.json').write_text(json.dumps(receipt, indent=2)+'\n')
        assert receipt['hashVerified']
        print(json.dumps(receipt))


if __name__ == '__main__':
    main()
