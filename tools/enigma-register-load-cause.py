#!/usr/bin/env python3
"""Bounded immutable Enigma native loader proof; no guest execution or writes."""
import hashlib
import json
from pathlib import Path
import struct
import sys

PARSER_SHA = 'f949185c282300ac3463b5524420464f87883b5ab5cb6e833fdf564cf6d83bbf'
EXE_SHA = '5885e29ac9c1bdfe7f36e0d7fba76a56b74bc99558e1e6debf8425febe35fa45'
PACKED_SHA = 'ce4ff5d66de3af85d3e0b1aef88995a54be7f44e78de81793169eb65e71e046e'


def require(ok, reason):
    if not ok:
        raise ValueError(reason)


def parser():
    source = Path(__file__).with_name('enigma-unpacked-closure.py').read_bytes()
    require(hashlib.sha256(source).hexdigest() == PARSER_SHA, 'parser seal')
    ns = {'__name__': 'sealed_parser'}
    exec(compile(source, 'sealed_parser', 'exec'), ns)
    return ns


class Image:
    def __init__(self, data, metadata):
        self.data, self.metadata = data, metadata

    def offset(self, va, size=1):
        for s in self.metadata['sections']:
            d = va - self.metadata['image_base'] - s['rva']
            if 0 <= d and d + size <= s['raw_size']:
                return s['raw'] + d
        raise ValueError('unbacked VA ' + hex(va))

    def read(self, va, size):
        p = self.offset(va, size)
        return self.data[p:p + size]


def semantic(image):
    """Checks selected decoded instructions before the separate full-file seal.

    Internal mutation tests call this entry with owned bytearrays; the CLI never
    accepts a different image or bypasses its full immutable seal.
    """
    checks = []

    def expect(va, value, label):
        require(image.read(va, len(value)) == value, label)
        checks.append({'va': hex(va), 'bytes': value.hex(), 'meaning': label})

    def hx(va, value, label):
        expect(va, bytes.fromhex(value), label)

    def call(va, target, label):
        expect(va, b'\xe8' + struct.pack('<i', target - va - 5), label)

    def text(va, value):
        expect(va, value.encode('ascii') + b'\0', 'literal ' + repr(value))

    hx(0x5ab8f0, '5589e5575689c6', 'entry: state EAX saved in ESI')
    hx(0x5ab900, '894df089d3', 'symbol ECX saved at EBP-16; module EDX saved in EBX')
    hx(0x5ab957, '8b0785c07522', 'cached handle nonzero skips load to 5ab97f')
    hx(0x5ab95d, '891c24', 'LoadLibraryA first argument is saved module EBX')
    call(0x5ab960, 0x7c96f0, 'LoadLibraryA call')
    hx(0x7c96f0, 'ff2584f89e00', 'LoadLibraryA IAT thunk')
    hx(0x5ab968, '85c089c30f84f5000000', 'null load branches to 5aba67; handle saved EBX')
    hx(0x5ab972, '891f85db89d8ba01000000742e', 'cache store; null handle returns status 1')
    hx(0x5ab97f, '8b55f089042489542404', 'GetProcAddress(handle, original ECX)')
    call(0x5ab989, 0x7c9700, 'GetProcAddress call')
    hx(0x7c9700, 'ff2550f89e00', 'GetProcAddress IAT thunk')
    hx(0x5ab991, '85c00f84b8000000', 'null symbol branches to 5aba51')
    hx(0x5aba58, '8d65f4ba02000000', 'missing symbol status 2')
    hx(0x5ab999, '8944240431d289542408893424', 'symbol result becomes zero-upvalue closure argument')
    call(0x5ab9a6, 0x596dd0, 'push C closure')
    hx(0x5ab9ab, '31d2', 'success status 0')
    for va, symbol in [(0x9ef884, 'LoadLibraryA'), (0x9ef850, 'GetProcAddress')]:
        require(any(x['rva'] + image.metadata['image_base'] == va and
                    x['dll'] == 'kernel32.dll' and x['symbol'] == symbol
                    for x in image.metadata['iat']), 'IAT identity ' + symbol)

    # Public direct interface: checked Lua argument 1, checked argument 2.
    hx(0x5aba81, 'b901000000', 'loadlib argument index 1')
    hx(0x5abaad, 'b802000000', 'loadlib argument index 2')
    call(0x5aba9d, 0x598190, 'check argument 1 string')
    call(0x5abab6, 0x598190, 'check argument 2 string')
    hx(0x5ababb, '89c189da89f0', 'checked symbol ECX, checked module EDX, state EAX')
    call(0x5abac1, 0x5ab8f0, 'direct loadlib caller')
    hx(0x5981b3, 'e818e8ffff85c089c3740f', 'checked-string wrapper delegates conversion, tests null')
    hx(0x5969f1, '83780804', 'Lua string tag 4')
    hx(0x596a2a, '8b0283c010', 'conversion returns string object payload +16')
    hx(0x5961fa, '8b580cc1e20401da8d42f0', 'positive Lua argument index maps base+(index-1)*16')

    # C search and root search enter at real prologues, not interior counters.
    for entry, search, transform, flow, site in [
        (0x5abe40, 0x5abe74, 0x5abe83, 0x5abe88, 0x5abe8e),
        (0x5abed0, 0x5abf48, 0x5abf5c, 0x5abf61, 0x5abf67),
    ]:
        hx(entry, '5531c089e5', 'C searcher entry')
        call(search, 0x5abb20, 'search path templates')
        call(transform, 0x5abdc0, 'construct Lua initializer name')
        hx(flow, '89c189da', 'initializer ECX, found path EBX to EDX')
        call(site, 0x5ab8f0, 'C searcher caller')
    hx(0x5abe6d, 'b9f4909500', 'C search selects cpath field')
    hx(0x5abf41, 'b9f4909500', 'C root search selects cpath field')
    hx(0x5abf03, '895c2404', 'C root strchr delimiter argument')
    hx(0x5abee9, 'bb2e000000', 'C root takes prefix before first dot')
    hx(0x5abdc6, 'b82d000000', 'initializer ignores prefix through first hyphen')
    hx(0x5abde1, '8d5801', 'initializer starts after found hyphen')
    call(0x5abdfd, 0x598b60, 'replace all module-name dots with underscores')
    call(0x5abe12, 0x596d70, 'format luaopen initializer')
    call(0x5abb46, 0x598b60, 'search path replaces module dots by backslashes')
    hx(0x5abb4e, 'b8efd8ffff', 'path field read in Lua environment pseudo-index')
    call(0x5abb5e, 0x596f40, 'get environment path field')
    call(0x5abb75, 0x5969d0, 'convert path field to string')
    hx(0x5abb7a, '85c089c60f8431010000', 'null path string enters package field error')
    call(0x5abc12, 0x598b60, 'replace template question marks with transformed module')
    hx(0x5abc19, 'b88290950089442404891c24', 'probe candidate path with mode r')
    hx(0x7c9220, 'ff25f4f99e00', 'fopen IAT thunk')
    hx(0x7c9210, 'ff25d8f99e00', 'fclose IAT thunk')
    for va, symbol in [(0x9ef9f4, 'fopen'), (0x9ef9d8, 'fclose')]:
        require(any(x['rva'] + image.metadata['image_base'] == va and
                    x['dll'] == 'msvcrt.dll' and x['symbol'] == symbol
                    for x in image.metadata['iat']), 'IAT identity ' + symbol)
    call(0x5abc25, 0x7c9220, 'file open probe')
    hx(0x5abc2a, '85c07575', 'successful open branches to found path return')
    hx(0x5abca3, '890424', 'close successful file probe')
    call(0x5abca6, 0x7c9210, 'file close probe')
    hx(0x5abcab, '89d8', 'return found candidate EBX in EAX')
    hx(0x5ac84d, 'bb2c909500', 'package initializer selects loadlib registration table')
    call(0x5ac8a4, 0x598920, 'register package library')
    hx(0x5ac8e2, 'a108909500', 'package initializer reads ordered searcher table')
    hx(0x5ac8f9, '8b049d08909500', 'package initializer iterates native searcher functions')
    for va, value in [(0x95901c, 'loadlib'), (0x959059, '_LOADLIB'),
                      (0x959062, 'LOADLIB: '), (0x95906c, '%s%s'),
                      (0x95907b, '.'), (0x95907d, '\\'), (0x959080, '?'),
                      (0x959082, 'r'), (0x9590e7, '_'),
                      (0x9590e9, 'luaopen_%s'), (0x9590f4, 'cpath'),
                      (0x959246, 'package'),
                      (0x959293, '.\\?.dll;!\\?.dll;!\\loadall.dll'),
                      (0x9592b1, 'LUA_CPATH')]:
        text(va, value)
    hx(0x95902c, '1c90950080ba5a00', 'loadlib registration pair')
    hx(0x959008, 'c0bf5a0040bd5a0040be5a00d0be5a0000000000', 'ordered package searcher table')
    return checks


def verify(path):
    p = Path(path)
    require(p.stat().st_size <= 25165824, 'input size bound')
    m = parser()['pe'](p)
    data = p.read_bytes()
    checks = semantic(Image(data, m))
    require(hashlib.sha256(data).hexdigest() == EXE_SHA, 'immutable Enigma seal')
    return {'verdict': 'PASS_BOUNDED_NATIVE_CAUSE', 'exe_sha256': EXE_SHA,
            'parser_sha256': PARSER_SHA, 'checks': checks,
            'callers': ['0x5abac1', '0x5abe8e', '0x5abf67'],
            'callee': 'kernel32.dll!LoadLibraryA via 0x7c96f0 / IAT 0x9ef884',
            'arguments': 'module=entry EDX; symbol=entry ECX; state=entry EAX',
            'unresolved': 'Lua direct arguments or searched package.cpath/module name and cache state',
            'scope': 'selected native paths only; no whole-program dynamic closure or runtime claim'}


if __name__ == '__main__':
    try:
        require(len(sys.argv) == 2, 'usage: enigma-register-load-cause.py UNPACKED_EXE')
        print(json.dumps(verify(sys.argv[1]), indent=2))
    except (ValueError, AssertionError, OSError) as error:
        print('REJECT: ' + str(error), file=sys.stderr)
        sys.exit(2)
