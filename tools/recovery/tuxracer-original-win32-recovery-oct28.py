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
import shutil
import sys
import tempfile
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
    if machine != 0x14c or magic != 0x10b or not 0 < sections <= 96 or optsize < 112:
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
    unresolved = {name: row['unresolved'] for name, row in modules.items() if row['unresolved']}
    if unresolved:
        raise Rejected('unresolved non-system DLL imports: ' + json.dumps(unresolved, sort_keys=True))
    if not modules:
        raise Rejected('no validated PE modules')
    data = literal_sources(d, inventory)
    licenses = [x for x in inventory['files'] if re.search(r'(?i)(copying|license|licence|copyright)', x['path'])]
    return {'modules': modules, 'licenseFiles': licenses,
            'literalSources': data,
            'scope': 'validated static direct DLL imports and recognized literal Tcl source references only; computed Tcl, dynamic loads and runtime unknown',
            'dataFiles': [x['path'] for x in inventory['files'] if not Path(x['path']).suffix.casefold() in ('.exe', '.dll')]}


def lexical_commands(text):
    """Yield top-level word spellings, without evaluating Tcl.

    Braces/quotes group words across lines; only ungrouped newline/semicolon
    ends a command. Escapes consume the following character, including newline.
    Simple bracket substitutions containing only plain words are retained as
    computed words; their closing boundary is known without evaluating them.
    Other substitutions or malformed grouping stop the remaining audit as UNKNOWN.
    Control-command bodies are retained as words, never scanned as scripts.
    """
    words, i, start = [], 0, 0
    while i < len(text):
        c = text[i]
        if c in ' \t\r':
            i += 1
            continue
        if text.startswith('\\\n', i):
            words.append(text[i:i + 2])  # source continuations remain UNKNOWN
            i += 2
            continue
        if c in ';\n':
            if words:
                yield words, None
            words = []
            i += 1
            start = i
            continue
        if c == '#' and not words:
            while i < len(text):
                if text.startswith('\\\n', i):
                    i += 2
                elif text[i] == '\n':
                    break
                else:
                    i += 1
            continue
        first, depth, quote = i, 0, False
        if c == '{':
            depth = 1
            i += 1
        elif c == '"':
            quote = True
            i += 1
        while i < len(text):
            c = text[i]
            if c == '\\':
                i += 2
                continue
            if depth:
                if c == '{':
                    depth += 1
                elif c == '}':
                    depth -= 1
                    if depth == 0:
                        i += 1
                        break
            elif c == '[':
                # Only a single command of plain words: no nested script,
                # variables, escapes, quotes, braces or command separators.
                # Preserve the spelling so source operands remain UNKNOWN.
                bracket = re.match(r'\[[A-Za-z_][A-Za-z0-9_:]*(?:[ \t]+[A-Za-z0-9_:.+*/?-]+)*[ \t]*\]', text[i:])
                if bracket is None:
                    yield [], text[start:start + 1024]
                    return
                i += len(bracket.group(0))
                continue
            elif quote:
                if c == '"':
                    quote = False
                    i += 1
                    break
            elif c in ' \t\r;\n':
                break
            elif c in '{}"':
                yield [], text[start:start + 1024]
                return
            i += 1
        if depth or quote or i > len(text):
            yield [], text[start:start + 1024]
            return
        if i < len(text) and text[i] not in ' \t\r;\n' and not text.startswith('\\\n', i):
            yield [], text[start:start + 1024]
            return
        words.append(text[first:i])
    if words:
        yield words, None


def literal_sources(directory, inventory):
    """Conservative lexical audit, never a Tcl interpreter or a runtime proof.

    Recognize literal source commands only at lexical command boundaries. Relative
    literals are checked against root and script directory (CWD is not known).
    Normalize dot components lexically, dropping any candidate that escapes the
    extraction root. If both candidates escape, retain an explicit unknown.
    Candidate presence is not runtime source resolution (including symlink/CWD
    semantics); candidate checking never opens a literal target.
    Substitution, continuations and unrecognized command forms remain unknown.
    """
    paths = {x['path'].casefold() for x in inventory['files']}
    checked, unknown = [], []
    for item in inventory['files']:
        name = item['path']
        if Path(name).suffix.casefold() != '.tcl':
            continue
        text = (directory / name).read_text(encoding='utf8', errors='replace')
        for words, uncertain in lexical_commands(text):
            if uncertain is not None:
                unknown.append({'script': name, 'expression': uncertain,
                                'reason': 'unsupported or incomplete Tcl syntax; remaining commands unknown'})
                continue
            if words[0] != 'source':
                # Even a literal control body is not known to execute. Never
                # promote its contents to checked dependencies.
                unknown.append({'script': name, 'expression': ' '.join(words)[:1024],
                                'reason': 'non-source command/body not evaluated'})
                continue
            word = ' '.join(words[1:])
            if word.startswith('-encoding '):
                option = re.fullmatch(r'-encoding\s+[A-Za-z0-9_-]+\s+(.+)', word)
                if option:
                    word = option.group(1)
            literal = re.fullmatch(r'(?:\{([^{}]*)\}|"([^"$\[\\]*)"|([^\s{}"$\[\\]+))', word)
            if not literal or '\\' in word or '$' in word or '[' in word:
                unknown.append({'script': name, 'expression': word[:1024]})
                continue
            target = next(x for x in literal.groups() if x is not None)
            # Absolute and drive paths are outside the supported candidate subset.
            if not target or target.startswith('/') or ':' in target:
                unknown.append({'script': name, 'expression': word[:1024]})
                continue
            candidates = []
            for base in (PurePosixPath('.'), PurePosixPath(name).parent):
                parts = []
                for part in (base / target).parts:
                    if part == '..':
                        if not parts:
                            break  # Never inspect an out-of-root candidate.
                        parts.pop()
                    else:
                        parts.append(part)
                else:
                    candidates.append(PurePosixPath(*parts).as_posix())
            if not candidates:
                unknown.append({'script': name, 'expression': word[:1024],
                                'reason': 'all lexical candidates escape extraction root; runtime CWD unknown'})
                continue
            found = sorted({p for p in candidates if p.casefold() in paths})
            if not found:
                raise Rejected('missing literal Tcl source: ' + name + ' -> ' + target)
            checked.append({'script': name, 'literal': target, 'candidatesPresent': found})
    return {'checked': checked, 'unknown': unknown,
            'limitations': 'lexical command subset; normalized in-root root/script-directory candidates only; candidate presence is not runtime resolution; all-escaping literals, computed and other Tcl forms/runtime CWD unknown'}


def publish_extract(archive, destination, expanded_limit):
    """Validate in owned staging, then publish; roll back synchronous errors.

    Two sibling reports cannot be replaced atomically for concurrent readers.
    This transaction guarantees rollback on ordinary exceptions, not power-loss
    atomicity. On rollback I/O failure retain the recovery directory and report
    its path; never print a success receipt. Callers must serialize publication.
    """
    destination = Path(destination)
    # Preserve the production pin before creating staging or any output.
    pin(archive)
    metadata(archive, expanded_limit)
    if destination.exists() or destination.is_symlink() or any(p.is_symlink() for p in destination.parents):
        raise Rejected('destination exists or symlink ancestor')
    parent = destination.parent
    if not parent.is_dir():
        raise Rejected('publication parent must already exist')
    reports = [parent / 'inventory.json', parent / 'closure.json']
    for path in reports:
        if path == destination or path.is_symlink() or (path.exists() and (not path.is_file() or path.stat().st_size > MAX_FILE)):
            raise Rejected('unsafe preexisting report: ' + str(path))
    staging = Path(tempfile.mkdtemp(prefix='.tuxracer-stage-', dir=parent))
    replaced, backups, moved = [], {}, False
    recovery_needed = False
    try:
        result = extract(archive, staging / 'payload', expanded_limit)
        report = closure(staging / 'payload', result)
        for path, value in zip(reports, (result, report)):
            (staging / ('new-' + path.name)).write_text(json.dumps(value, indent=2) + '\n')
            if path.exists():
                backup = staging / ('old-' + path.name)
                shutil.copyfile(path, backup)
                backups[path] = backup
        # No complete report is published until all validation and writes pass.
        os.rename(staging / 'payload', destination)
        moved = True
        for path in reports:
            os.replace(staging / ('new-' + path.name), path)
            replaced.append(path)
    except BaseException as cause:
        failures = []
        for path in reversed(replaced):
            try:
                if path in backups:
                    os.replace(backups[path], path)
                else:
                    path.unlink()
            except OSError as error:
                failures.append(str(error))
        if moved:
            try:
                os.rename(destination, staging / 'payload')
            except OSError as error:
                failures.append(str(error))
        if failures:
            recovery_needed = True
            raise Rejected('publication failed; rollback incomplete; recovery retained at ' + str(staging) + ': ' + '; '.join(failures)) from cause
        raise
    finally:
        if not recovery_needed:
            try:
                shutil.rmtree(staging)
            except OSError as error:
                # Commit is the final report replacement. Cleanup cannot turn a
                # committed transaction into a failed stage with success files.
                # Before commit the original exception remains authoritative.
                print('staging cleanup pending at ' + str(staging) + ': ' + str(error), file=sys.stderr)
    return result, report


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
    e = sub.add_parser('literal-sources', help='lexical audit only; no Tcl execution')
    e.add_argument('directory', type=Path)
    e.add_argument('inventory', type=Path)
    args = p.parse_args()
    if args.action == 'guard':
        print(json.dumps(guard_fixture(args.directory), indent=2))
    elif args.action == 'literal-sources':
        print(json.dumps(literal_sources(args.directory, json.loads(args.inventory.read_text())), indent=2))
    elif args.action == 'download':
        print(json.dumps(acquire(args.directory), indent=2))
    elif args.action == 'inspect':
        print(json.dumps(guarded(lambda: pin(args.archive), lambda: metadata(args.archive, args.max_expanded_bytes)), indent=2))
    else:
        result, report = publish_extract(args.archive, args.destination, args.max_expanded_bytes)
        print(json.dumps({'files': len(result['files']), 'metadata': result['metadata'], 'modules': report['modules'], 'licenseFiles': report['licenseFiles']}, indent=2))


if __name__ == '__main__':
    main()
