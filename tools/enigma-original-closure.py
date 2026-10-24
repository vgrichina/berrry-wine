#!/usr/bin/env python3
"""Bounded Enigma historical acquisition; never executes a downloaded program."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import struct
import sys
import urllib.request

ARCHIVE_SHA = 'a738a8b1508675bfaf12db07b7bdb42356f013f4c2d5c2a494516d78d25070a1'
SYSTEM = {'kernel32.dll', 'user32.dll', 'gdi32.dll', 'advapi32.dll',
          'winmm.dll', 'msvcrt.dll', 'ole32.dll', 'shell32.dll',
          'wsock32.dll', 'ws2_32.dll', 'imm32.dll', 'version.dll',
          'ddraw.dll', 'dsound.dll', 'opengl32.dll'}


def pe(path):
    b = path.read_bytes()
    def u16(o): return struct.unpack_from('<H', b, o)[0]
    def u32(o): return struct.unpack_from('<I', b, o)[0]
    assert b[:2] == b'MZ', str(path)
    h = u32(60)
    assert b[h:h+4] == b'PE\0\0'
    machine, count, optional_size = u16(h+4), u16(h+6), u16(h+20)
    o = h+24
    assert machine == 0x14c and u16(o) == 0x10b, 'requires original x86 PE32'
    sections = []
    section_names = []
    for i in range(count):
        s = o+optional_size+40*i
        section_names.append(b[s:s+8].rstrip(b'\0').decode('ascii'))
        sections.append((u32(s+12), u32(s+16), u32(s+20)))
    def offset(rva):
        if rva < u32(o+60): return rva
        for va, size, raw in sections:
            if va <= rva < va+size: return raw+rva-va
        raise ValueError('unbacked RVA '+hex(rva))
    def string(rva):
        pos = offset(rva)
        end = b.index(b'\0', pos, min(len(b), pos+4096))
        return b[pos:end].decode('ascii')
    imports = {}
    irva = u32(o+104)
    if irva:
        pos = offset(irva)
        while any(b[pos:pos+20]):
            thunk, name, first = u32(pos), u32(pos+12), u32(pos+16)
            dll = string(name).lower()
            table = offset(thunk or first)
            symbols = []
            while u32(table):
                v = u32(table)
                symbols.append('#'+str(v & 0xffff) if v & 0x80000000 else string(v+2))
                table += 4
            assert dll not in imports
            imports[dll] = symbols
            pos += 20
    exports = {}
    er, es = u32(o+96), u32(o+100)
    if er:
        e = offset(er)
        base, nf, nn = u32(e+16), u32(e+20), u32(e+24)
        funcs, names, ords = offset(u32(e+28)), offset(u32(e+32)), offset(u32(e+36))
        for i in range(nf):
            value = u32(funcs+i*4)
            if value: exports['#'+str(base+i)] = string(value) if er <= value < er+es else None
        for i in range(nn):
            ordinal = u16(ords+i*2)
            key = '#'+str(base+ordinal)
            assert key in exports
            exports[string(u32(names+i*4))] = exports[key]
    assert u32(o+200) == 0, 'delay imports require explicit closure handling'
    return {'machine': machine, 'entry_rva': u32(o+16), 'image_base': u32(o+28),
            'sections': section_names, 'packed': any(n.startswith('UPX') for n in section_names),
            'imports': imports, 'exports': exports, 'sha256': hashlib.sha256(b).hexdigest()}


def verify(archive, root, seal):
    import zipfile
    assert hashlib.sha256(Path(archive).read_bytes()).hexdigest() == ARCHIVE_SHA, 'archive changed'
    expected = json.loads(Path(seal).read_text())
    assert not Path(root).is_symlink(), 'linked original root'
    assert not any(p.is_symlink() for p in Path(root).rglob('*')), 'linked original input'
    actual = {p.relative_to(root).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
              for p in Path(root).rglob('*') if p.is_file()}
    assert actual == expected, 'missing, changed or extra original file'
    with zipfile.ZipFile(archive) as z:
        members = {x.filename for x in z.infolist() if not x.is_dir()}
        assert members == set(expected), 'archive inventory mismatch'
        for n in members:
            assert hashlib.sha256(z.read(n)).hexdigest() == expected[n], 'archive member mismatch'
    game = Path(root)/'Enigma-1.01'
    modules = {p.name.lower(): pe(p) for p in game.iterdir() if p.suffix.lower() in {'.exe', '.dll'}}
    edges, system, visited = [], {}, set()
    def bind(dll, symbol, chain=()):
        if dll in SYSTEM:
            system.setdefault(dll, set()).add(symbol)
            return
        assert dll in modules, 'unresolved DLL '+dll
        exports = modules[dll]['exports']
        assert symbol in exports, 'unresolved export '+dll+'!'+symbol
        forward = exports[symbol]
        if forward:
            assert (dll, symbol) not in chain, 'forward cycle'
            target, target_symbol = forward.rsplit('.', 1)
            bind(target.lower()+'.dll', target_symbol, chain+((dll, symbol),))
        visit(dll)
    def visit(name):
        if name in visited: return
        visited.add(name)
        for dll, symbols in modules[name]['imports'].items():
            for symbol in symbols: bind(dll, symbol)
            edges.append({'from': name, 'to': dll, 'symbols': len(symbols), 'system': dll in SYSTEM})
    visit('enigma.exe')
    # Also bind all packaged DLLs, including optional dynamically loaded codecs.
    for name in modules: visit(name)
    packed = [n for n, m in modules.items() if m['packed']]
    return {'files': len(actual), 'modules': modules, 'edges': edges,
            'system_requirements': {k: sorted(v) for k, v in sorted(system.items())},
            'visible_table_closure': 'PASS', 'packed_modules': packed,
            'static_closure': 'BLOCKED_PACKED_IMPORTS' if packed else 'PASS', 'runtime': 'NOT RUN'}


def sequence(guard, dependent):
    """The exact production sequencer: a rejecting guard prevents its dependent."""
    result = subprocess.run(guard, check=False)
    if result.returncode:
        return result.returncode
    return subprocess.run(dependent, check=False).returncode


def fetch(url, destination, limit):
    path = Path(destination)
    if path.exists():
        raise ValueError('destination already exists')
    request = urllib.request.Request(url, headers={'User-Agent': 'Enigma-original-closure/1.0'})
    with urllib.request.urlopen(request, timeout=30) as response:
        length = response.headers.get('Content-Length')
        if length and int(length) > limit:
            raise ValueError('Content-Length exceeds admission')
        count = 0
        with path.open('xb') as output:
            while True:
                block = response.read(min(65536, limit - count + 1))
                if not block:
                    break
                count += len(block)
                if count > limit:
                    raise ValueError('response exceeds admission')
                output.write(block)
    print(json.dumps({'url': url, 'final_url': response.url, 'bytes': count,
                      'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}))


def inventory(archive, destination):
    import zipfile
    assert hashlib.sha256(Path(archive).read_bytes()).hexdigest() == ARCHIVE_SHA, 'archive changed'
    with zipfile.ZipFile(archive) as z:
        files = [x for x in z.infolist() if not x.is_dir()]
        assert len({x.filename for x in files}) == len(files), 'duplicate member'
        seal = {x.filename: hashlib.sha256(z.read(x)).hexdigest() for x in files}
    Path(destination).write_text(json.dumps(seal, sort_keys=True, indent=2)+'\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    seq = sub.add_parser('sequence')
    seq.add_argument('guard_json')
    seq.add_argument('dependent_json')
    download = sub.add_parser('fetch')
    download.add_argument('url')
    download.add_argument('destination')
    download.add_argument('limit', type=int)
    closure = sub.add_parser('verify')
    closure.add_argument('archive')
    closure.add_argument('root', type=Path)
    closure.add_argument('seal')
    listing = sub.add_parser('inventory')
    listing.add_argument('archive')
    listing.add_argument('destination')
    args = parser.parse_args()
    if args.command == 'sequence':
        return sequence(json.loads(args.guard_json), json.loads(args.dependent_json))
    if args.command == 'verify':
        result = verify(args.archive, args.root, args.seal)
        print(json.dumps(result, indent=2))
        return 2 if result['packed_modules'] else 0
    if args.command == 'inventory':
        inventory(args.archive, args.destination)
        return 0
    fetch(args.url, args.destination, args.limit)
    return 0


if __name__ == '__main__':
    sys.exit(main())
