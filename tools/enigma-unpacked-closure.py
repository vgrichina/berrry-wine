#!/usr/bin/env python3
"""Diagnostic static UPX closure; never executes Windows input programs."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import resource
import signal
import struct
import subprocess
import sys

RELEASE = 'v5.0.2'
ASSET = 'upx-5.0.2-amd64_linux.tar.xz'
API = 'https://api.github.com/repos/upx/upx/releases/tags/' + RELEASE
ARCHIVE_SHA256 = 'ddc2654063fe4dc80d95b420788494e4db078ebb01a650692d623b5a9906e61e'
TOOL_SHA256 = '992aa498ea367409359e424da5afdca8b2818eb55486ffcf7d4a63576cde4501'
SEALS = {"zlib1.dll":["5ce32c8afd7660fe8fedd424bdf851103356c108d45e6aa654dbfdacb43a0a8f","49244b51914d0a6e62bfd1465d11f7fdfc9f090981c590f736bc5efa6fd7e626"],"enigma.exe":["ce4ff5d66de3af85d3e0b1aef88995a54be7f44e78de81793169eb65e71e046e","5885e29ac9c1bdfe7f36e0d7fba76a56b74bc99558e1e6debf8425febe35fa45"],"jpeg.dll":["b278e21030069a7ffd53ef5a14680ff30d0bc6625b5909e612ac1119787138c3","a8ce1785929b093225d41e79e493412e995ea5e7695719ee35b0d3fcca167fea"],"sdl.dll":["17f42459a4aa9b73d9115e1c09cd4fb4e9fd4ca08e4137b46e8a6a9b56c9043f","66136f9cc7091b7fa59514afe88792e45476926f8415f0080a6401f5f1b6366b"],"mikmod.dll":["96ea656667a758a87aad9aec785b472fea4f4a57568b72b6326f2fe185e6d087","29b8030a02e0e039f0f6a57329e4b4bff0774a771c9164627dd69c4a2efea71f"],"sdl_ttf.dll":["8e8e543e0ce882b9ba82cf40c78df4b03e82096b849b24cfe7fae620f9d29b26","905c0c3782bb669083e78dcfb3d0fa491fe02ff1b1138b79a7a32818470e9f05"],"libfreetype-6.dll":["6cd4e0860fb26625346dea2af9a9c0a2896a123f3b8bff9d36411ebf42192bdc","ec840982058e08e40fd70646a19bca418d648629cb8c82b8716e619b9f2f1fd3"],"sdl_image.dll":["2129acb54f56dc5f670aebe3e2320583fe0e00e5622e0c38cc9b15f614f65770","96e28e9f1ba5ebb564cacc96469c50b5431a0c18f677a6028b7f69e95c3bf321"],"sdl_mixer.dll":["06fde1067326daae3cdb50c9ae84962e41184b95e3e827734eaa8ec99c8f1dd3","5d0c0e380a39465b8b7f90cdb954b81f179e73e59261f9e9b32dcaec16c21162"],"libpng12-0.dll":["3258c9ad45d669313073c60874e068e81be35415ae897c0c6ce646ffbfa0a974","6e1a15ecd3c451ad5e4082ffc2ca6cf91780869de6c49ecf7eba4b7a70332031"]}


def pe(path):
    """Bound every read to file/section; merge legitimate repeated DLL descriptors."""
    b = Path(path).read_bytes()
    def need(pos, size):
        assert 0 <= pos <= len(b) and 0 <= size <= len(b)-pos, 'PE file bounds'
        return pos
    def u16(pos): return struct.unpack_from('<H', b, need(pos, 2))[0]
    def u32(pos): return struct.unpack_from('<I', b, need(pos, 4))[0]
    assert b[:2] == b'MZ', 'DOS signature'
    h = u32(60)
    assert b[need(h, 24):h+4] == b'PE\0\0', 'PE signature'
    n, osize = u16(h+6), u16(h+20)
    assert u16(h+4) == 0x14c and 0 < n <= 96, 'x86 section count'
    o = h+24
    need(o, osize)
    assert osize >= 224 and u16(o) == 0x10b, 'PE32 optional header'
    entry, imagebase, image, headers = u32(o+16), u32(o+28), u32(o+56), u32(o+60)
    assert 0 < headers <= len(b) and headers <= image <= 25165824, 'image bounds'
    assert u32(o+92) >= 14, 'missing directories'
    sections = []
    for i in range(n):
        s = need(o+osize+40*i, 40)
        name = b[s:s+8].rstrip(b'\0').decode('ascii')
        vs, va, rs, raw, flags = u32(s+8), u32(s+12), u32(s+16), u32(s+20), u32(s+36)
        assert va >= headers and va+max(vs, rs) <= image, 'section image bounds'
        if rs: need(raw, rs)
        for prev in sections:
            assert va >= prev['rva']+max(prev['virtual_size'], prev['raw_size']) or prev['rva'] >= va+max(vs, rs), 'overlapping sections'
            if rs and prev['raw_size']:
                assert raw >= prev['raw']+prev['raw_size'] or prev['raw'] >= raw+rs, 'overlapping raw sections'
        sections.append(dict(name=name,rva=va,virtual_size=vs,raw_size=rs,raw=raw,flags=flags))
    def offset(rva, size=1):
        if 0 <= rva < headers and rva+size <= headers: return need(rva, size)
        for s in sections:
            delta = rva-s['rva']
            if 0 <= delta < s['raw_size'] and delta+size <= s['raw_size']:
                return need(s['raw']+delta, size)
        raise AssertionError('unbacked RVA '+hex(rva))
    def mapped(rva):
        return any(s['rva'] <= rva < s['rva']+max(s['virtual_size'],s['raw_size']) for s in sections)
    def string(rva):
        result = bytearray()
        for i in range(4096):
            v = b[offset(rva+i)]
            if not v: return result.decode('ascii')
            result.append(v)
        raise AssertionError('unterminated PE string')
    assert any(s['flags'] & 0x20000000 and s['rva'] <= entry < s['rva']+s['raw_size'] for s in sections), 'unbacked/nonexecutable entrypoint'
    offset(entry)
    assert not any(s['name'].startswith('UPX') for s in sections), 'still packed'
    assert not (u32(o+200) or u32(o+204)), 'delay imports require explicit handling'
    imports, iat, descriptors = {}, [], []
    ir, size = u32(o+104), u32(o+108)
    if ir:
        assert size >= 20, 'import directory size'
        for j in range(min(size//20, 4096)):
            pos = offset(ir+j*20, 20)
            fields = [u32(pos+k) for k in range(0,20,4)]
            if not any(fields): break
            thunk, _, _, name, first = fields
            dll = string(name).lower()
            assert dll.endswith('.dll') and '/' not in dll and '\\' not in dll, 'import DLL name'
            symbols = []
            for k in range(65536):
                v = u32(offset((thunk or first)+4*k, 4))
                if not v: break
                sym = '#'+str(v & 65535) if v & 0x80000000 else string(v+2)
                offset(first+4*k,4)
                symbols.append(sym)
                iat.append(dict(dll=dll,symbol=sym,rva=first+4*k))
            else: raise AssertionError('unterminated thunk table')
            imports.setdefault(dll, []).extend(symbols)
            descriptors.append(dict(dll=dll, symbols=len(symbols)))
        else: raise AssertionError('unterminated import descriptors')
    exports, export_rvas = {}, {}
    er, es = u32(o+96), u32(o+100)
    if er:
        e = offset(er,40)
        base, nf, nn = u32(e+16), u32(e+20), u32(e+24)
        assert nf <= 65536 and nn <= nf, 'export count'
        funcs = offset(u32(e+28),nf*4)
        names = offset(u32(e+32),nn*4) if nn else 0
        ords = offset(u32(e+36),nn*2) if nn else 0
        for i in range(nf):
            v = u32(funcs+4*i)
            if not v: continue
            key = '#'+str(base+i)
            assert er <= v < er+es or mapped(v), 'unmapped export'
            exports[key] = string(v) if er <= v < er+es else None
            export_rvas[key] = v
        for i in range(nn):
            key = '#'+str(base+u16(ords+2*i))
            name = string(u32(names+4*i))
            assert key in exports and name not in exports, 'export ordinal/name'
            exports[name], export_rvas[name] = exports[key], export_rvas[key]
    return dict(machine=0x14c,entry_rva=entry,image_base=imagebase,image_size=image,sections=sections,
                imports=imports,import_descriptors=descriptors,iat=iat,exports=exports,export_rvas=export_rvas,sha256=sha(path))


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def original_helper():
    spec = importlib.util.spec_from_file_location('original', Path(__file__).with_name('enigma-original-closure.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def guard(receipt):
    assert receipt['projected'] <= 67108864, 'task allocation'
    assert receipt['host_after'] >= 2982150144, 'host floor'
    assert receipt['mem_available'] >= 805306368, 'memory admission'
    assert receipt['pass'] is True, 'admission verdict'


def asset_metadata(data):
    assert data['tag_name'] == RELEASE and not data['draft'] and not data['prerelease'], 'release identity'
    assert data['html_url'] == 'https://github.com/upx/upx/releases/tag/' + RELEASE, 'release origin'
    assets = [a for a in data['assets'] if a['name'] == ASSET]
    assert len(assets) == 1, 'asset identity'
    a = assets[0]
    assert a['browser_download_url'] == 'https://github.com/upx/upx/releases/download/' + RELEASE + '/' + ASSET, 'asset origin'
    assert 0 < a['size'] <= 2097152, 'asset byte guard'
    digest = a['digest']
    assert len(digest) == 71 and digest.startswith('sha256:'), 'missing official SHA256'
    int(digest[7:], 16)
    return a


def run(argv, log):
    """One bounded process group; reap descendants even on failure/timeout."""
    assert int(next(s.split()[1] for s in open('/proc/meminfo') if s.startswith('MemAvailable:'))) * 1024 >= 805306368, 'fresh memory gate'
    def limits():
        resource.setrlimit(resource.RLIMIT_CPU, (60, 60))
        resource.setrlimit(resource.RLIMIT_FSIZE, (25165824, 25165824))
    with Path(log).open('xb') as stream:
        env = dict(os.environ)
        env.pop('UPX', None)
        p = subprocess.Popen(argv, stdout=stream, stderr=subprocess.STDOUT, start_new_session=True, preexec_fn=limits, env=env)
        try:
            status = p.wait(timeout=60)
        finally:
            try:
                os.killpg(p.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            p.wait()
    assert Path(log).stat().st_size <= 65536, 'bounded log'
    return {'argv': list(map(str, argv)), 'status': status, 'log': str(log), 'log_sha256': sha(log)}


def fixed_dynamic(outputs, modules):
    """Decode six sealed codec initializer paths, not a whole-program CFG proof."""
    anchors = [
        ('sdl_image.dll',0x62e436d7,0x62e43802,'jpeg.dll',9),
        ('sdl_image.dll',0x62e45357,0x62e45577,'libpng12-0.dll',16),
        ('sdl_image.dll',0x62e46747,0x62e467e6,'libtiff-3.dll',5),
        ('sdl_mixer.dll',0x61709f08,0x6170a265,'mikmod.dll',25),
        ('sdl_mixer.dll',0x617157a7,0x61715869,'libvorbisfile-3.dll',6),
        ('sdl_mixer.dll',0x617161d7,0x6171638e,'smpeg.dll',13),
    ]
    paths = {p.name.lower(): p for p in Path(outputs).iterdir()}
    def reader(name):
        m, b = modules[name], paths[name].read_bytes()
        def read(va, size):
            rva = va-m['image_base']
            for s in m['sections']:
                d = rva-s['rva']
                if 0 <= d and d+size <= s['raw_size']:
                    return b[s['raw']+d:s['raw']+d+size]
            raise AssertionError('dynamic VA bounds')
        return read
    def word(b): return struct.unpack('<I', b)[0]
    def text(read, va):
        data = bytearray()
        for k in range(256):
            v = read(va+k,1)[0]
            if not v: return data.decode('ascii')
            data.append(v)
        raise AssertionError('dynamic name length')
    def thunk(m, read, va, dll, symbol):
        b = read(va,6)
        assert b[:2] == b'\xff\x25', 'dynamic import thunk'
        iat = word(b[2:])-m['image_base']
        assert any(i['rva']==iat and i['dll']==dll and i['symbol']==symbol for i in m['iat']), 'dynamic IAT binding'
    def target(read, va):
        b = read(va,5)
        assert b[0] == 0xe8, 'dynamic direct call'
        return va+5+struct.unpack('<i',b[1:])[0]
    # Exported SDL bridges forward their actual parameters to Windows loaders.
    m, read = modules['sdl.dll'], reader('sdl.dll')
    bridges = []
    for symbol, call, prefix, kernel_symbol in [
        ('SDL_LoadObject',0x6813e8d8,'5589e581ec38020000897dfc8b7d088975f8895df4893c24','LoadLibraryA'),
        ('SDL_LoadFunction',0x6813e96f,'5589e581ec38020000897dfc8b45088b7d0c8975f8895df4897c2404890424','GetProcAddress'),
    ]:
        start = m['image_base']+m['export_rvas'][symbol]
        assert read(start,call-start).hex() == prefix, 'SDL bridge parameter flow'
        dest = target(read,call)
        thunk(m,read,dest,'kernel32.dll',kernel_symbol)
        bridges.append(dict(export=symbol,start=hex(start),call=hex(call),target=kernel_symbol,bytes=read(start,call+5-start).hex()))
    result = []
    for name, site, last, dll, count in anchors:
        m, read = modules[name], reader(name)
        prefix = read(site-7,7)
        assert prefix[:3] == b'\xc7\x04\x24', 'codec literal argument'
        string_va = word(prefix[3:])
        assert text(read,string_va)==dll, 'codec name binding'
        thunk(m,read,target(read,site),'sdl.dll','SDL_LoadObject')
        assert read(site+5,1)==b'\xa3', 'codec handle store'
        handle = word(read(site+6,4))
        symbols, calls = [], []
        for va in range(site+10,last+1):
            if read(va,1) != b'\xe8': continue
            dest = target(read,va)
            # Only calls to the SDL_LoadFunction IAT thunk are selected.
            try: thunk(m,read,dest,'sdl.dll','SDL_LoadFunction')
            except AssertionError: continue
            prev = read(va-17,17)
            reg = prev[0]-0xb8
            if 0 <= reg <= 7 and prev[5:10]==bytes([0x89,0x44+8*reg,0x24,0x04,0xa1]) and prev[14:]==b'\x89\x04\x24':
                name_va = word(prev[1:5])
                assert word(prev[10:14])==handle, 'codec lookup handle'
                code = prev
            else:
                prev = read(va-12,12)
                assert prev[:4]==b'\x89\x04\x24\xba' and prev[8:]==b'\x89\x54\x24\x04', 'codec first symbol argument '+name+' '+hex(va)+' '+prev.hex()
                name_va = word(prev[4:8])
                code = prev
            symbol = text(read,name_va)
            if dll in modules:
                assert symbol in modules[dll]['exports'], 'unresolved dynamic export '+dll+'!'+symbol
            symbols.append(symbol)
            calls.append(dict(site=hex(va),name_va=hex(name_va),bytes=(code+read(va,5)).hex()))
        assert len(symbols)==count, 'codec lookup count'
        result.append(dict(module=name,load_call=hex(site),name_va=hex(string_va),dll=dll,
                           bytes=read(site-7,17).hex(),symbols=symbols,calls=calls,
                           status='PACKAGED_EXPORTS_BIND' if dll in modules else 'MISSING_CODEC_UNPROVEN_REQUIRED'))
    return dict(bridges=bridges,codec_initializers=result,scope='six decoded fixed-name initializers only; invocation/asset necessity and generic loaders unproven')


def closure(modules):
    """All packaged modules, named/ordinal imports and recursive forwarders."""
    system, edges, visited, bound = {}, [], set(), []
    boundary = original_helper().SYSTEM
    def bind(dll, symbol, chain=()):
        if dll in boundary:
            system.setdefault(dll, set()).add(symbol)
            return
        assert dll in modules, 'unresolved DLL '+dll
        assert symbol in modules[dll]['exports'], 'unresolved export '+dll+'!'+symbol
        assert (dll, symbol) not in chain, 'forward cycle'
        forward = modules[dll]['exports'][symbol]
        bound.append([dll, symbol])
        if forward:
            target, sym = forward.rsplit('.', 1)
            target = target.lower()
            if not target.endswith('.dll'): target += '.dll'
            bind(target, sym, chain+((dll, symbol),))
        visit(dll)
    def visit(name):
        if name in visited: return
        visited.add(name)
        for dll, symbols in modules[name]['imports'].items():
            for symbol in symbols: bind(dll, symbol)
            edges.append(dict(source=name,target=dll,symbols=len(symbols),system=dll in boundary))
    assert 'enigma.exe' in modules, 'missing EXE'
    for name in modules: visit(name)
    return dict(edges=edges,packaged_bindings=bound,system_requirements={k:sorted(v) for k,v in sorted(system.items())},
                normal_imports='PASS',dynamic_closure='UNPROVEN',emulator_implementation='UNPROVEN',runtime='NOT RUN')


def verify(outputs, inputs, bindings, tool):
    assert tool['release'] == RELEASE and tool['executable_sha256'] == TOOL_SHA256 and tool['archive_sha256'] == ARCHIVE_SHA256, 'wrong tool identity'
    assert tool['status'] == 0, 'version command failed'
    outputs, inputs = Path(outputs), Path(inputs)
    assert not outputs.is_symlink() and not inputs.is_symlink(), 'linked module directory'
    def files(root):
        result = {}
        for p in root.iterdir():
            assert p.is_file() and not p.is_symlink(), 'nonregular module'
            assert p.name.lower() not in result, 'duplicate module'
            result[p.name.lower()] = p
        assert set(result) == set(SEALS), 'missing/extra DLL or EXE'
        return result
    out, packed = files(outputs), files(inputs)
    assert len(bindings) == 10, 'ten bindings required'
    seen, modules = set(), {}
    for b in bindings:
        name = Path(b['original']['path']).name.lower()
        assert name in SEALS and name not in seen, 'duplicate/unknown binding'
        seen.add(name)
        assert b['original']['sha256'] == SEALS[name][0] == sha(packed[name]), 'wrong original binding'
        assert b['output_sha256'] == SEALS[name][1] == sha(out[name]), 'changed unpacked module'
        assert b['output_bytes'] == out[name].stat().st_size, 'output length'
        assert b['tool_release'] == RELEASE and b['tool_sha256'] == TOOL_SHA256, 'wrong module tool identity'
        assert b['test']['status'] == b['unpack']['status'] == 0, 'UPX command failed'
        test, unpack = b['test']['argv'], b['unpack']['argv']
        assert len(test) == 3 and test[1:] == ['-t',str(packed[name])], 'wrong test command'
        assert len(unpack) == 5 and unpack[1:] == ['-d','-o',str(out[name]),str(packed[name])], 'wrong unpack command'
        assert test[0] == unpack[0] == tool['argv'][0], 'tool command identity'
        assert sha(test[0]) == TOOL_SHA256, 'changed tool executable'
        for cmd in [b['test'],b['unpack']]:
            assert sha(cmd['log']) == cmd['log_sha256'], 'changed command log'
        modules[name] = pe(out[name])
    result = closure(modules)
    result['modules'] = modules
    result['fixed_dynamic'] = fixed_dynamic(outputs, modules)
    return result


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('command', choices=['guard', 'metadata', 'verify'])
    p.add_argument('input', type=Path)
    p.add_argument('extra', nargs='*')
    args = p.parse_args()
    data = json.loads(args.input.read_text())
    if args.command == 'guard':
        guard(data)
    elif args.command == 'metadata':
        print(json.dumps(asset_metadata(data), sort_keys=True))
    else:
        outputs, inputs, tool = args.extra
        result = verify(outputs, inputs, data, json.loads(Path(tool).read_text()))
        result['modules'] = {name: {k:m[k] for k in ['sha256','entry_rva','image_base','image_size']}
                             | dict(sections=[s['name'] for s in m['sections']],imports=sum(map(len,m['imports'].values())),
                                    export_names=sum(not s.startswith('#') for s in m['exports']),
                                    export_ordinals=sum(s.startswith('#') for s in m['exports']))
                             for name,m in result['modules'].items()}
        print(json.dumps(result, sort_keys=True, indent=2))


if __name__ == '__main__':
    main()
