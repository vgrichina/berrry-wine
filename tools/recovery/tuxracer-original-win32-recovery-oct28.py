#!/usr/bin/env python3
"""Bounded, hash-pinned ORIGINAL Tux Racer 0.61a Win32 ZIP recovery.

Never executes a guest or installer. Run under the task's external RSS/CPU/wall/
disk supervisor; Python DATA=128MiB, file=12MiB. No third-party dependencies.
"""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import struct
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile

URL = 'https://sourceforge.net/projects/tuxracer/files/tuxracer/0.61/tuxracer-win32-0.61a.zip/download'
SHA256 = '1497e326af9aa591243f4ff1083d4d99de7dc5f0396e37f45ca7bf4f98823c34'
ARCHIVE = 'tuxracer-win32-0.61a.zip'
MAX_FILE = 12 * 1024**2
MAX_METADATA = 1024**2
MAX_ENTRIES = 4096
SYSTEM = set('kernel32 user32 gdi32 advapi32 shell32 comdlg32 comctl32 winmm wsock32 ws2_32 msvcrt msvcrt20 msvcrt40 crtdll ole32 oleaut32 rpcrt4 imm32 version winspool ddraw dsound dinput dinput8 opengl32 glu32 secur32 netapi32 shlwapi setupapi ntdll wininet urlmon'.split())


class Rejected(ValueError):
    pass


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for block in iter(lambda: f.read(65536), b''):
            h.update(block)
    return h.hexdigest()


def pin(path, expected=SHA256, maximum=MAX_FILE):
    p = Path(path)
    if p.is_symlink() or not p.is_file() or not 0 < p.stat().st_size <= maximum:
        raise Rejected('archive size/type guard')
    actual = digest(p)
    if actual != expected:
        raise Rejected('archive SHA256 mismatch: expected ' + expected + ', actual ' + actual)
    return {'sha256': actual, 'bytes': p.stat().st_size}


def guarded(predecessor, dependent):
    """A rejected predecessor must propagate; no dependent side effects."""
    predecessor()
    return dependent()


def guard_fixture(directory):
    d = Path(directory)
    d.mkdir(parents=True, exist_ok=True)
    source, sentinel = d / 'bad-pin.bin', d / 'download-sentinel'
    if sentinel.exists():
        raise Rejected('fixture sentinel already present')
    source.write_bytes(b'bad')
    results = []
    for maximum, expected in ((2, digest(source)), (3, '0' * 64)):
        try:
            guarded(lambda: pin(source, expected, maximum), lambda: sentinel.write_text('BAD'))
        except Rejected as e:
            results.append(str(e))
        else:
            raise Rejected('fixture failed to reject')
        if sentinel.exists():
            raise Rejected('dependent sentinel ran')
    return {'rejections': results, 'sentinel': str(sentinel), 'sentinelAbsent': True}


class OfficialRedirects(urllib.request.HTTPRedirectHandler):
    def __init__(self):
        self.hops = []

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        u = urllib.parse.urlsplit(newurl)
        if u.scheme != 'https' or not (u.hostname == 'sourceforge.net' or (u.hostname or '').endswith('.sourceforge.net')):
            raise Rejected('redirect outside official HTTPS SourceForge route: ' + newurl[:1024])
        if len(self.hops) >= 5:
            raise Rejected('redirect bound')
        self.hops.append({'status': code, 'url': newurl[:4096]})
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def acquire(payload):
    """Exactly one request chain; no retry, mirror selection, or oracle change."""
    payload = Path(payload)
    payload.mkdir(parents=True, exist_ok=True)
    target = payload / ARCHIVE
    attempt = payload / 'download-attempt.json'
    if target.exists() or attempt.exists():
        raise Rejected('existing attempt/archive: no acquisition retry')
    guard = guard_fixture(payload / 'guard-control')
    redirects = OfficialRedirects()
    receipt = {'url': URL, 'expectedSHA256': SHA256, 'maximumBytes': MAX_FILE,
               'guard': guard, 'started': time.time(), 'redirects': redirects.hops,
               'recipeSHA256': digest(__file__)}
    attempt.write_text(json.dumps(receipt, indent=2) + '\n')
    start = time.monotonic()
    try:
        request = urllib.request.Request(URL, headers={'User-Agent': 'TuxRacer-original-recovery/1.0'})
        with urllib.request.build_opener(redirects).open(request, timeout=25) as response:
            receipt.update(status=response.status, finalURL=response.url[:4096],
                           headers={k[:128]: v[:1024] for k, v in list(response.headers.items())[:32]})
            length = response.headers.get('Content-Length')
            if length and (not length.isdigit() or int(length) > MAX_FILE):
                raise Rejected('Content-Length exceeds archive allowance')
            with target.open('xb') as f:
                count = 0
                while True:
                    if time.monotonic() - start > 70:
                        raise Rejected('download elapsed bound')
                    block = response.read(min(65536, MAX_FILE - count + 1))
                    if not block:
                        break
                    count += len(block)
                    if count > MAX_FILE:
                        raise Rejected('download byte bound')
                    f.write(block)
        receipt['original'] = pin(target)
        receipt['pass'] = True
    except Exception as e:
        receipt.update(pass_=False, errorType=type(e).__name__, error=str(e)[:4096])
        if isinstance(e, urllib.error.HTTPError):
            receipt.update(status=e.code, finalURL=e.url[:4096], headers={k[:128]: v[:1024] for k, v in list(e.headers.items())[:32]})
            (payload / 'download-failure-body.bin').write_bytes(e.read(65536))
        if target.exists():
            receipt['retainedOriginal'] = {'bytes': target.stat().st_size, 'sha256': digest(target)}
        raise
    finally:
        receipt['elapsedSeconds'] = time.monotonic() - start
        attempt.write_text(json.dumps(receipt, indent=2) + '\n')
    return receipt


def safe_name(info):
    name = info.filename
    if len(name.encode('utf8')) > 1024 or not name or '\\' in name or ':' in name or '\x00' in name or name.startswith('/'):
        raise Rejected('unsafe ZIP path: ' + repr(name[:100]))
    parts = name.rstrip('/').split('/')
    if any(p in ('', '.', '..') or p.endswith((' ', '.')) or re.match(r'(?i)^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)', p) for p in parts):
        raise Rejected('unsafe Windows path: ' + repr(name[:100]))
    mode = info.external_attr >> 16
    kind = stat.S_IFMT(mode)
    if kind not in (0, stat.S_IFREG, stat.S_IFDIR):
        raise Rejected('symlink/special ZIP entry')
    if info.flag_bits & 1 or info.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED):
        raise Rejected('encrypted/unsupported compression')
    if info.file_size < 0 or info.file_size > MAX_FILE or (info.is_dir() and info.file_size):
        raise Rejected('member size guard')
    return '/'.join(parts)


def metadata(path, expanded_limit):
    """Inspect ALL paths and expanded bytes before creating destination/files."""
    p = Path(path)
    if p.stat().st_size > MAX_FILE:
        raise Rejected('archive size guard')
    with p.open('rb') as f:
        if f.read(4) not in (b'PK\x03\x04', b'PK\x05\x06'):
            raise Rejected('unsupported executable/container prefix; plain ZIP required')
        f.seek(max(0, p.stat().st_size - 65557))
        tail = f.read(65557)
    at = tail.rfind(b'PK\x05\x06')
    if at < 0 or len(tail) - at < 22:
        raise Rejected('unsupported format: ordinary ZIP only; no installer execution')
    sig, disk, cd_disk, n_disk, n, cd_size, cd_at, comment = struct.unpack_from('<4s4H2LH', tail, at)
    if disk or cd_disk or n != n_disk or n > MAX_ENTRIES or n == 65535 or cd_size > MAX_METADATA or at + 22 + comment != len(tail):
        raise Rejected('ZIP directory count/metadata/multidisk/ZIP64 bound')
    with zipfile.ZipFile(p) as z:
        infos = z.infolist()
        if len(infos) != n:
            raise Rejected('directory count mismatch')
        names, files, total = set(), set(), 0
        for info in infos:
            name = safe_name(info).casefold()
            if name in names:
                raise Rejected('case-insensitive duplicate')
            names.add(name)
            if not info.is_dir():
                files.add(name)
            total += info.file_size
            if total > expanded_limit:
                raise Rejected('aggregate expanded bytes exceed admitted allowance')
        for name in names:
            if any(str(p) in files for p in PurePosixPath(name).parents if str(p) != '.'):
                raise Rejected('file/directory collision')
    return {'entries': n, 'expandedBytes': total, 'metadataBytes': cd_size}


def extract(archive, destination, expanded_limit):
    original = pin(archive)
    meta = metadata(archive, expanded_limit)
    d = Path(destination)
    if d.exists() or d.is_symlink() or any(p.is_symlink() for p in d.parents):
        raise Rejected('destination exists or symlink ancestor')
    d.mkdir(parents=True)
    inventory = []
    with zipfile.ZipFile(archive) as z:
        for info in z.infolist():
            p = d / safe_name(info)
            if info.is_dir():
                p.mkdir(parents=True, exist_ok=True)
                continue
            p.parent.mkdir(parents=True, exist_ok=True)
            h, count = hashlib.sha256(), 0
            with z.open(info) as source, p.open('xb') as target:
                for block in iter(lambda: source.read(65536), b''):
                    count += len(block)
                    if count > info.file_size:
                        raise Rejected('expanded stream exceeds directory size')
                    target.write(block)
                    h.update(block)
            if count != info.file_size:
                raise Rejected('expanded size mismatch')
            inventory.append({'path': p.relative_to(d).as_posix(), 'bytes': count, 'sha256': h.hexdigest()})
    return {'original': original, 'metadata': meta, 'files': inventory,
            'complete': True, 'CRC': 'verified by zipfile on each full stream read'}


def pe(path):
    """Bounded static PE32 import parser; rejects truncated/unmapped RVAs."""
    b = Path(path).read_bytes()
    def unpack(fmt, at):
        try:
            return struct.unpack_from(fmt, b, at)
        except struct.error as e:
            raise Rejected('truncated PE') from e
    if len(b) > MAX_FILE or b[:2] != b'MZ':
        raise Rejected('not bounded MZ')
    at, = unpack('<L', 60)
    if b[at:at+4] != b'PE\0\0':
        raise Rejected('not PE')
    machine, sections = unpack('<HH', at+4)
    optsize, = unpack('<H', at+20)
    opt = at+24
    magic, = unpack('<H', opt)
    if magic != 0x10b or not 0 < sections <= 96 or optsize < 112:
        raise Rejected('unsupported PE layout')
    table = opt+optsize
    maps = []
    for i in range(sections):
        vs, va, size, raw = unpack('<LLLL', table+i*40+8)
        maps.append((va, size, raw))
    def offset(rva, need):
        for va, size, raw in maps:
            if va <= rva and rva-va+need <= size and raw+rva-va+need <= len(b):
                return raw+rva-va
        raise Rejected('unmapped PE RVA')
    directory_count, = unpack('<L', opt+92)
    if directory_count > 16 or optsize < 96 + directory_count * 8:
        raise Rejected('PE data directory bounds')
    imports = []
    if directory_count > 1:
        rva, size = unpack('<LL', opt+104)
        if rva:
            if not 20 <= size <= 1024**2:
                raise Rejected('import directory bound')
            for i in range(min(size//20, 4096)):
                row = unpack('<5L', offset(rva+i*20, 20))
                if not any(row):
                    break
                p = offset(row[3], 1)
                end = b.find(b'\0', p, min(len(b), p+256))
                if end < 0:
                    raise Rejected('unbounded DLL name')
                imports.append(b[p:end].decode('ascii').casefold())
            else:
                raise Rejected('unterminated imports')
    return {'machine': hex(machine), 'PE': 'PE32', 'imports': sorted(set(imports)),
            'delayImportsPresent': directory_count > 13 and any(unpack('<LL', opt+96+13*8))}


def closure(directory, inventory):
    d = Path(directory)
    names = {PurePosixPath(x['path']).name.casefold(): x['path'] for x in inventory['files']}
    modules = {}
    for item in inventory['files']:
        if Path(item['path']).suffix.casefold() in ('.exe', '.dll'):
            report = pe(d / item['path'])
            report['bundled'] = [x for x in report['imports'] if x in names]
            report['windows'] = [x for x in report['imports'] if x not in names and x.removesuffix('.dll') in SYSTEM]
            report['unresolved'] = [x for x in report['imports'] if x not in names and x.removesuffix('.dll') not in SYSTEM]
            modules[item['path']] = report
    licenses = [x for x in inventory['files'] if re.search(r'(?i)(copying|license|licence|copyright)', x['path'])]
    return {'modules': modules, 'licenseFiles': licenses,
            'scope': 'static direct imports only; dynamic loads/data references/runtime unverified',
            'dataFiles': [x['path'] for x in inventory['files'] if not Path(x['path']).suffix.casefold() in ('.exe', '.dll')]}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    sub = p.add_subparsers(dest='action', required=True)
    for action in ('guard', 'download'):
        sub.add_parser(action).add_argument('directory', type=Path)
    e = sub.add_parser('inspect')
    e.add_argument('archive', type=Path)
    e.add_argument('--max-expanded-bytes', type=int, required=True)
    e = sub.add_parser('extract')
    e.add_argument('archive', type=Path)
    e.add_argument('destination', type=Path)
    e.add_argument('--max-expanded-bytes', type=int, required=True)
    args = p.parse_args()
    if args.action == 'guard':
        print(json.dumps(guard_fixture(args.directory), indent=2))
    elif args.action == 'download':
        print(json.dumps(acquire(args.directory), indent=2))
    elif args.action == 'inspect':
        print(json.dumps(guarded(lambda: pin(args.archive), lambda: metadata(args.archive, args.max_expanded_bytes)), indent=2))
    else:
        result = extract(args.archive, args.destination, args.max_expanded_bytes)
        (args.destination.parent / 'inventory.json').write_text(json.dumps(result, indent=2)+'\n')
        report = closure(args.destination, result)
        (args.destination.parent / 'closure.json').write_text(json.dumps(report, indent=2)+'\n')
        print(json.dumps({'files': len(result['files']), 'metadata': result['metadata'], 'modules': report['modules'], 'licenseFiles': report['licenseFiles']}, indent=2))


if __name__ == '__main__':
    main()
