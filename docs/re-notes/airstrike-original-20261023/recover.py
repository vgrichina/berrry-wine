#!/usr/bin/env python3
"""Bounded official acquisition; never executes the recovered program."""
import hashlib, json, pathlib, subprocess, sys, time, zipfile

HERE = pathlib.Path(__file__).resolve().parent
EXPECTED = {
    'airstrike-pre6a-win32.zip': 'c611d1f269d2794920be7e715c40f251f93484b4ad00c399b4a9b8379aa2f662',
    'airstrike-pre6a-src.tar.gz': '11232b4bbc760b261a3ae87441783ba5f327f15d37ec095a659ea0cbbed8d9c0',
}

def acquire(name, url, cap):
    dest = HERE / name
    if dest.exists():
        raise SystemExit('Refusing to overwrite retained bytes: ' + str(dest))
    started = time.monotonic()
    proc = subprocess.Popen(['curl', '--fail', '--silent', '--show-error',
        '--proto', '=https', '--tlsv1.2', '--connect-timeout', '10',
        '--max-time', '45', '--max-filesize', str(cap), '--dump-header',
        str(HERE / (name + '.headers')), url], stdout=subprocess.PIPE,
        stderr=subprocess.PIPE)
    count = 0
    try:
        with dest.open('xb') as out:
            while chunk := proc.stdout.read(65536):
                count += len(chunk)
                if count > cap or time.monotonic() - started > 50:
                    raise RuntimeError('Acquisition byte/time guard rejected')
                out.write(chunk)
        err = proc.communicate(timeout=5)[1]
        if proc.returncode:
            raise RuntimeError('Acquisition denial: ' + err[:2000].decode(errors='replace'))
    except BaseException:
        proc.kill()
        proc.wait()
        raise
    result = dict(url=url, bytes=count, sha256=hashlib.sha256(dest.read_bytes()).hexdigest(),
                  elapsed_seconds=time.monotonic()-started)
    (HERE / (name + '.receipt.json')).write_text(json.dumps(result, indent=2)+'\n')
    if name in EXPECTED and result['sha256'] != EXPECTED[name]:
        raise SystemExit('Identity mismatch: retained bytes require review; do not extract')
    print(json.dumps(result))

def inspect_extract():
    archive = HERE / 'airstrike-pre6a-win32.zip'
    assert hashlib.sha256(archive.read_bytes()).hexdigest() == EXPECTED[archive.name], 'Archive identity mismatch'
    with zipfile.ZipFile(archive) as z:
        infos = z.infolist()
        size = sum(i.file_size for i in infos)
        assert size <= 16777216, 'Uncompressed allocation rejection'
        assert len(infos) < 2000, 'Entry count rejection'
        names = set()
        for i in infos:
            p = pathlib.PurePosixPath(i.filename)
            assert not p.is_absolute() and '..' not in p.parts and '\\' not in i.filename
            assert i.filename not in names and i.file_size <= 25165824
            assert (i.external_attr >> 16) & 0o170000 != 0o120000, 'Symlink rejection'
            names.add(i.filename)
        manifest = []
        target = HERE / 'release'
        target.mkdir(exist_ok=False)
        for i in infos:
            if i.is_dir():
                continue
            data = z.read(i)  # zipfile verifies CRC before materializing this entry
            p = target / i.filename
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(data)
            manifest.append(dict(path=i.filename, bytes=len(data), compressed_bytes=i.compress_size,
                                 crc32=f'{i.CRC:08x}', sha256=hashlib.sha256(data).hexdigest()))
        (HERE / 'files.json').write_text(json.dumps(dict(archive_sha256=hashlib.sha256(archive.read_bytes()).hexdigest(),
            uncompressed_bytes=size, entries=len(infos), files=manifest), indent=2)+'\n')
        print(json.dumps(dict(uncompressed_bytes=size, entries=len(infos), files=len(manifest))))

if __name__ == '__main__':
    if sys.argv[1:] == ['extract']:
        inspect_extract()
    elif sys.argv[1:] == ['page']:
        acquire('official-page.html', 'https://icculus.org/airstrike/', 65536)
    elif sys.argv[1:] == ['win32']:
        acquire('airstrike-pre6a-win32.zip', 'https://icculus.org/airstrike/airstrike-pre6a-win32.zip', 8388608)
    elif sys.argv[1:] == ['source']:
        acquire('airstrike-pre6a-src.tar.gz', 'https://icculus.org/airstrike/airstrike-pre6a-src.tar.gz', 4194304)
    else:
        raise SystemExit('usage: recover.py page|win32|source|extract (wrap in timeout 60s)')
