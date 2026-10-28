#!/usr/bin/env python3
"""Bounded original GLTron 0.70 Win32 recovery; never execute the installer.

Run each CLI operation under a descendant-aware physical-resource supervisor.
No alternate distribution URL or caller-supplied hash is accepted.
"""
import argparse
import hashlib
import json
import os
import re
import selectors
import subprocess
import zlib
from pathlib import Path, PurePosixPath
import stat
import struct
import sys
import time
import urllib.error
import urllib.request

URL = 'https://sourceforge.net/projects/gltron/files/gltron-win32/0.70/gltron-0.70-win32.exe/download'
DOCUMENTATION = 'https://gltron.sourceforge.net/download.php'
SHA256 = '8956abae4e4fe6ebc45b97d58c9254789e0a1457d11c58e4dbb90aead45a3eb3'
MAX_ARCHIVE = 12 * 1024**2
MAX_METADATA = 2 * 1024**2
MAX_EXPANDED = 24 * 1024**2
MAX_FILES = 2048


def verify(path):
    """Reject oversized/nonregular inputs before reading, then immutable oracle."""
    path = Path(path)
    s = path.lstat()
    if not stat.S_ISREG(s.st_mode) or not 0 < s.st_size <= MAX_ARCHIVE:
        raise ValueError('archive size/type rejected')
    h = hashlib.sha256()
    with path.open('rb') as f:
        while chunk := f.read(65536):
            h.update(chunk)
    digest = h.hexdigest()
    if digest != SHA256:
        raise ValueError(f'archive SHA256 rejected: {digest}')
    return {'sha256': digest, 'bytes': s.st_size}


def sequence(guard, dependent):
    """One sequencing boundary used by acquisition and extraction."""
    accepted = guard()
    return dependent(accepted)


def metadata_guard(size, expected_sha):
    if not 0 < size <= MAX_ARCHIVE or expected_sha != SHA256:
        raise ValueError('download size/hash metadata rejected')
    return {'maxBytes': size, 'sha256': expected_sha}


def safe_name(name):
    p = PurePosixPath(name.replace('\\', '/'))
    if (not name or len(name) > 512 or p.is_absolute() or
            any(x in ('', '.', '..') for x in name.replace('\\', '/').split('/')) or
            any(':' in x for x in p.parts) or any(ord(c) < 32 for c in name)):
        raise ValueError('unsafe archive path')
    return str(p)


def inno_plan(metadata):
    """Only the observed Inno 2.0.18 regular-file listing is supported.

    Display sizes are rounded: charge one full display unit above each value.
    Inno 2.0.18 has no link-member type. Reject every unknown listing line.
    """
    if len(metadata.encode()) > MAX_METADATA:
        raise ValueError('metadata bound')
    lines = metadata.splitlines()
    if not lines or lines[0] != 'Listing "GLtron version 0.70" - setup data version 2.0.18' or lines[-1] != 'Done.':
        raise ValueError('unsupported Inno executable/version or incomplete listing')
    rows, seen, total = [], set(), 0
    for line in lines[1:-1]:
        match = re.fullmatch(r' - "([^"\r\n]+)" \((\d+(?:\.\d+)?) (B|KiB|MiB)\) Adler32 0x([ 0-9a-f]{8})', line)
        if not match:
            raise ValueError('unsupported/link/ambiguous Inno member')
        name, number, unit, checksum = match.groups()
        name = safe_name(name)
        if not name.startswith('app/') or name.casefold() in seen:
            raise ValueError('Inno member location/collision')
        seen.add(name.casefold())
        scale = {'B': 1, 'KiB': 1024, 'MiB': 1024**2}[unit]
        upper = int(float(number)*scale)+ (scale if unit != 'B' else 0)
        if upper > MAX_ARCHIVE:
            raise ValueError('member size rejected')
        total += upper
        if total > MAX_EXPANDED or len(seen) > MAX_FILES:
            raise ValueError('aggregate expansion rejected before writes')
        rows.append({'path':name, 'upperBytes':upper, 'adler32':int(checksum.strip(),16)})
    if not rows:
        raise ValueError('empty payload')
    return {'files':rows, 'expandedUpperBytes':total, 'format':'Inno Setup 2.0.18'}


def tool(argv, log_path):
    """Installed static tool, under the caller's descendant/RSS supervisor."""
    if not os.environ.get('PALETTE_BROWSER_SUPERVISED'):
        raise ValueError('descendant-aware resource supervisor required')
    start = time.monotonic()
    p = subprocess.Popen(argv, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    output = bytearray()
    try:
        os.set_blocking(p.stdout.fileno(), False)
        sel = selectors.DefaultSelector()
        sel.register(p.stdout, selectors.EVENT_READ)
        while True:
            if time.monotonic()-start > 90:
                raise ValueError('static tool wall bound')
            if sel.select(.1):
                chunk = os.read(p.stdout.fileno(), 65536)
                if not chunk:
                    break
                output.extend(chunk)
                if len(output) > MAX_METADATA:
                    raise ValueError('static tool output bound')
        if p.wait(timeout=5) != 0:
            raise ValueError('static tool rejected: '+output.decode(errors='replace')[:1024])
        return output.decode('utf-8', errors='strict')
    finally:
        Path(log_path).write_bytes(output[:MAX_METADATA])
        if p.poll() is None:
            p.kill()
        p.wait(timeout=5)
        p.stdout.close()


def extract(archive):
    archive = Path(archive).resolve()
    verify(archive)
    root = archive.parent
    destination = root/'extracted'
    if destination.exists() or destination.is_symlink():
        raise ValueError('extraction destination exists')
    text = tool(['/usr/bin/innoextract','--list','--list-sizes','--list-checksums',
                 '--color=0','--progress=0','--no-extract-unknown',str(archive)], root/'inno-list.txt')
    def accepted():
        listing = inno_plan(text)
        # Host/task admission is separately enforced by the enclosing supervisor.
        if listing['expandedUpperBytes'] > 16*1024**2:
            raise ValueError('task incremental extraction allowance')
        return listing
    def unpack(listing):
        (root/'extraction-plan.json').write_text(json.dumps(listing,indent=2))
        destination.mkdir()
        log = tool(['/usr/bin/innoextract','--extract','--dump','--collisions=error',
                    '--color=0','--progress=0','--no-extract-unknown','--output-dir',
                    str(destination),str(archive)], root/'extraction-output.txt')
        normalize_dump(destination, listing)
        return inspect_payload(destination, listing, root)
    return sequence(accepted, unpack)


def normalize_dump(folder, listing):
    """Validate the entire literal Inno dump namespace, then move in place.

    --dump avoids implicit filename conversion: Inno's {app} and backslashes
    become literal Linux filenames. Retain original case and restore directories
    only after checking the manifest. Supports interruption without duplication.
    """
    expected = {row['path'] for row in listing['files']}
    parents = {str(p) for name in expected for p in PurePosixPath(name).parents}
    moves, emptydirs = [], []
    existing = set()
    for source in folder.iterdir():
        if source.name == 'app' and source.is_dir() and not source.is_symlink():
            for child in source.rglob('*'):
                if child.is_symlink():
                    raise ValueError('existing extracted symlink')
                if child.is_file():
                    existing.add(child.relative_to(folder).as_posix())
            continue
        if source.is_symlink() or not source.name.startswith('{app}\\'):
            raise ValueError('unexpected dump filename/type')
        name = safe_name('app/'+source.name[6:].replace('\\','/'))
        if source.is_dir() and not list(source.iterdir()) and name in parents:
            emptydirs.append(source)
        elif source.is_file() and name in expected:
            moves.append((source, folder/name))
        else:
            raise ValueError('unknown dump file/directory')
    pending = {str(b.relative_to(folder)) for a,b in moves}
    if pending & existing or pending | existing != expected:
        raise ValueError('incomplete/colliding dump manifest')
    for source, destination in moves:
        destination.parent.mkdir(parents=True, exist_ok=True)
        if destination.exists() or destination.is_symlink():
            raise ValueError('dump normalization collision')
        source.rename(destination)
    for directory in emptydirs:
        directory.rmdir()


def inspect_payload(destination, listing, root):
    actual, inventory = set(), []
    expected = {row['path']:row for row in listing['files']}
    for path in sorted(destination.rglob('*')):
        s = path.lstat()
        if stat.S_ISLNK(s.st_mode):
            raise ValueError('extracted link rejected')
        if stat.S_ISDIR(s.st_mode):
            continue
        name = path.relative_to(destination).as_posix()
        if not stat.S_ISREG(s.st_mode) or name not in expected:
            raise ValueError('unexpected extracted file/type')
        row = expected[name]
        if s.st_size > row['upperBytes']:
            raise ValueError('expanded file size exceeds preflight')
        data = path.read_bytes()
        if zlib.adler32(data) != row['adler32']:
            raise ValueError('extracted Adler32 mismatch')
        actual.add(name)
        inventory.append({'path':name, 'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),
                          'adler32':f'{zlib.adler32(data):08x}'})
    if actual != set(expected):
        raise ValueError('incomplete extracted payload')
    result = {'files':inventory,'count':len(inventory),'bytes':sum(r['bytes'] for r in inventory)}
    (root/'inventory.json').write_text(json.dumps(result,indent=2))
    return result


WINDOWS_DLLS = frozenset('kernel32.dll user32.dll gdi32.dll advapi32.dll shell32.dll winmm.dll opengl32.dll glu32.dll wsock32.dll ws2_32.dll ddraw.dll dsound.dll version.dll ole32.dll oleaut32.dll comdlg32.dll comctl32.dll imm32.dll ntdll.dll msvcrt.dll wininet.dll rpcrt4.dll secur32.dll setupapi.dll winspool.drv'.split())


def pe_machine(data):
    if len(data) < 64 or data[:2] != b'MZ':
        raise ValueError('invalid DOS header')
    offset = struct.unpack_from('<I',data,60)[0]
    if offset > len(data)-26 or data[offset:offset+4] != b'PE\0\0':
        raise ValueError('invalid PE header bound/signature')
    machine = struct.unpack_from('<H',data,offset+4)[0]
    magic = struct.unpack_from('<H',data,offset+24)[0]
    if machine != 0x14c or magic != 0x10b:
        raise ValueError('not original x86 PE32')
    return {'machine': '0x014c (Intel 80386)', 'optionalMagic':'0x010b (PE32)'}


def analyze(archive):
    archive = Path(archive).resolve()
    verify(archive)
    root = archive.parent
    listing = inno_plan((root/'inno-list.txt').read_text())
    inventory = inspect_payload(root/'extracted', listing, root)
    bundled = {Path(row['path']).name.casefold() for row in inventory['files']}
    result = {'modules':[], 'unresolved':[], 'scope':'static PE imports, not runtime LoadLibrary or gameplay',
              'license':'extracted/app/docs/README.html', 'fullGPLTextBundled':False,
              'gameExecutable':'extracted/app/gltron.exe'}
    static = root/'static'
    static.mkdir(exist_ok=True)
    for row in inventory['files']:
        if Path(row['path']).suffix.casefold() not in ('.exe','.dll'):
            continue
        path = root/'extracted'/row['path']
        machine = pe_machine(path.read_bytes())
        text = tool(['/usr/bin/objdump','-p',str(path)], static/(path.name+'.objdump.txt'))
        imports = re.findall(r'^\s*DLL Name: ([^\r\n]+)$',text,re.MULTILINE)
        if not imports:
            raise ValueError('expected PE import table absent/unparsed')
        closure = []
        for name in imports:
            folded = name.strip().casefold()
            kind = 'bundled' if folded in bundled else 'Windows system' if folded in WINDOWS_DLLS else 'unresolved'
            closure.append({'dll':name,'resolution':kind})
            if kind == 'unresolved':
                result['unresolved'].append({'module':row['path'],'dll':name})
        result['modules'].append({'path':row['path'],**machine,'imports':closure})
    (root/'closure.json').write_text(json.dumps(result,indent=2))
    if result['unresolved']:
        raise ValueError('unresolved non-system static imports; inspect closure.json')
    return result


class Redirects(urllib.request.HTTPRedirectHandler):
    def __init__(self):
        self.urls = []
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if len(self.urls) >= 8 or not newurl.startswith('https://'):
            raise ValueError('redirect bound/scheme rejected')
        self.urls.append(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def download(destination):
    destination = Path(destination)
    if destination.exists() or destination.is_symlink():
        raise ValueError('destination exists; no implicit download retry')
    redirects = Redirects()
    receipt = {'url': URL, 'documentation': DOCUMENTATION, 'expectedSHA256': SHA256,
               'redirects': redirects.urls, 'complete': False}
    destination.mkdir(parents=True)
    receipt_path = destination / 'acquisition.json'
    start = time.monotonic()
    try:
        request = urllib.request.Request(URL, headers={'User-Agent': 'GLTron-original-recovery/1.0'})
        with urllib.request.build_opener(redirects).open(request, timeout=25) as response:
            receipt.update(status=response.status, finalURL=response.url,
                           headers=dict(response.headers))
            if sum(len(str(k))+len(str(v)) for k,v in response.headers.items()) > 65536:
                raise ValueError('header bound')
            length = response.headers.get('Content-Length')
            if length is not None and not 0 < int(length) <= MAX_ARCHIVE:
                raise ValueError('download Content-Length rejected')
            target = destination / 'gltron-0.70-win32.exe'
            with target.open('xb') as out:
                count = 0
                while chunk := response.read(65536):
                    count += len(chunk)
                    if count > MAX_ARCHIVE or time.monotonic()-start > 60:
                        raise ValueError('download byte/time bound')
                    out.write(chunk)
            receipt.update(verify(target), complete=True)
    except urllib.error.HTTPError as error:
        # Preserve bounded raw denial once; never try a different route.
        receipt.update(status=error.code, error=str(error), finalURL=error.url)
        (destination / 'http-error-body.bin').write_bytes(error.read(65536))
        raise
    except Exception as error:
        receipt['error'] = str(error)
        raise
    finally:
        receipt['wallSeconds'] = time.monotonic()-start
        receipt_path.write_text(json.dumps(receipt, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation', choices=['download', 'verify', 'extract', 'analyze'])
    parser.add_argument('path', type=Path)
    args = parser.parse_args()
    if args.operation == 'download':
        # Local fixture gate is a separate mandatory precondition; see tests.
        sequence(lambda: metadata_guard(MAX_ARCHIVE, SHA256), lambda _: download(args.path))
    elif args.operation == 'verify':
        print(json.dumps(verify(args.path)))
    elif args.operation == 'extract':
        result = extract(args.path)
        print(json.dumps({'count':result['count'],'bytes':result['bytes']}))
    elif args.operation == 'analyze':
        result = analyze(args.path)
        print(json.dumps({'modules':len(result['modules']),'unresolved':result['unresolved']}))


if __name__ == '__main__':
    main()
