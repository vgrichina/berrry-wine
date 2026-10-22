#!/usr/bin/env python3
"""Offline evidence checks only. No guest execution or implementation claims."""
import copy
import hashlib
import json
import os
from pathlib import Path
import struct
import subprocess

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
INPUT = Path('/home/user/wine-assembly/scratch/usage-watch/shadow-man-dsetup-native-input-oct22')
ENV = {**os.environ, 'GIT_NO_LAZY_FETCH': '1'}


class PE:
    def __init__(self, data):
        self.data = data
        self.pe = self.u32(0x3c)
        assert data[self.pe:self.pe+4] == b'PE\0\0'
        self.base = self.u32(self.pe+52)
        start = self.pe+24+self.u16(self.pe+20)
        self.sections = [tuple(self.u32(start+i*40+j) for j in (12, 16, 20))
                         for i in range(self.u16(self.pe+6))]

    def u16(self, p): return struct.unpack_from('<H', self.data, p)[0]
    def u32(self, p): return struct.unpack_from('<I', self.data, p)[0]

    def off(self, rva):
        for va, size, raw in self.sections:
            if va <= rva < va+size: return raw+rva-va
        raise AssertionError(f'RVA {rva:x} outside retained raw data')

    def string(self, rva):
        p = self.off(rva)
        return self.data[p:self.data.index(0, p)].decode('ascii')

    def code(self, rva, n):
        p = self.off(rva)
        return self.data[p:p+n]

    def exports(self):
        p = self.off(self.u32(self.pe+120))
        base, count, names, funcs, ptrs, ords = [self.u32(p+j) for j in (16,20,24,28,32,36)]
        out = {base+i: {'ordinal': base+i, 'rva': self.u32(self.off(funcs)+4*i), 'name': None}
               for i in range(count)}
        for i in range(names):
            ordinal = base+self.u16(self.off(ords)+2*i)
            out[ordinal]['name'] = self.string(self.u32(self.off(ptrs)+4*i))
        return out

    def imports(self):
        p = self.off(self.u32(self.pe+128))
        out = []
        while self.u32(p+16):
            ilt, name, iat = self.u32(p), self.u32(p+12), self.u32(p+16)
            t = self.off(ilt or iat)
            entries = []
            i = 0
            while self.u32(t+4*i):
                n = self.u32(t+4*i)
                entries.append({'iat': self.base+iat+4*i, 'ordinal': n & 0xffff}
                               if n & 0x80000000 else
                               {'iat': self.base+iat+4*i, 'name': self.string(n+2)})
                i += 1
            out.append({'dll': self.string(name), 'entries': entries})
            p += 20
        return out


def contract(exports, exe, dll):
    assert exports[11] == {'ordinal': 11, 'rva': 0x18b0, 'name': 'DirectXSetupGetVersion'}
    assert exports[5]['name'] == 'DirectXSetupA'
    assert dll.code(0x18f4, 3) == bytes.fromhex('c20800'), 'stdcall two args, not three'
    assert dll.code(0x18ec, 5) == bytes.fromhex('b801000000'), 'native BOOL is 1 even for zero version'
    assert dll.code(0x18d4, 10) == bytes.fromhex('85c074068b4c24008908'), 'optional first output'
    assert dll.code(0x18e2, 10) == bytes.fromhex('85c074068b4c24048908'), 'optional second output'
    assert dll.code(0x18c8, 5) == bytes.fromhex('e8a3fcffff'), 'helper target 0x1570'
    assert exe.code(0x2970, 15) == bytes.fromhex('68ecde400068f0de4000e81d070000')
    assert exe.code(0x309c, 6) == bytes.fromhex('ff2524904000'), 'observed IAT jump'
    imp = next(x for x in exe.imports() if x['dll'].lower() == 'dsetup.dll')
    assert {'iat': 0x409024, 'ordinal': 11} in imp['entries']


def rejects(fn):
    try: fn()
    except AssertionError: return True
    raise AssertionError('negative control incorrectly accepted')


def main():
    receipt = json.loads((INPUT/'receipt.json').read_text())
    for f in receipt['originalInstalledFiles']:
        data = (INPUT/f['name']).read_bytes()
        assert len(data) == f['size']
        assert hashlib.sha256(data).hexdigest() == f['sha256']
    assert sum(f['size'] for f in receipt['originalInstalledFiles']) == receipt['totalBytes'] == 830976
    pins = json.loads((HERE/'source-pins.json').read_text())
    for pin in pins['files']:
        data = (REPO/pin['path']).read_bytes()
        assert hashlib.sha256(data).hexdigest() == pin['sha256']
        oid = subprocess.check_output(['git', '-C', str(REPO), 'hash-object', '--stdin'], input=data, env=ENV).decode().strip()
        assert oid == pin['gitBlob']
    dll = PE((INPUT/'dsetup.dll').read_bytes())
    exe = PE((INPUT/'d3dconfigutility.exe').read_bytes())
    setup32 = PE((INPUT/'dsetup32.dll').read_bytes())
    setup16 = (INPUT/'dsetup16.dll').read_bytes()
    ne = struct.unpack_from('<I', setup16, 0x3c)[0]
    assert setup16[ne:ne+2] == b'NE'
    nmods, modtab, nametab = [struct.unpack_from('<H', setup16, ne+o)[0] for o in (0x1e, 0x28, 0x2a)]
    ne_imports = []
    for i in range(nmods):
        pos = ne+nametab+struct.unpack_from('<H', setup16, ne+modtab+2*i)[0]
        ne_imports.append(setup16[pos+1:pos+1+setup16[pos]].decode('ascii'))
    exports = dll.exports()
    contract(exports, exe, dll)
    controls = {}
    wrong = copy.deepcopy(exports); wrong[11]['name'] = 'DirectXSetup'
    controls['guessed_DirectXSetup_identity'] = rejects(lambda: contract(wrong, exe, dll))
    wrong = copy.deepcopy(exports); wrong[11] = wrong[10]
    controls['wrong_ordinal'] = rejects(lambda: contract(wrong, exe, dll))
    wrong = PE(dll.data[:]); data = bytearray(wrong.data); data[wrong.off(0x18f5)] = 12; wrong.data = bytes(data)
    controls['wrong_stdcall_three_arguments'] = rejects(lambda: contract(exports, exe, wrong))
    wrong = PE(exe.data[:]); data = bytearray(wrong.data); data[wrong.off(0x309e)] = 0x28; wrong.data = bytes(data)
    controls['wrong_IAT'] = rejects(lambda: contract(exports, wrong, dll))
    # Data read by native helper; names are original binary strings, not SDK guesses.
    strings = {hex(rva): dll.string(rva) for rva in (0x6108,0x6054,0x6094,0x6090,0x6150)}
    assert strings['0x6108'].lower() == 'software\\microsoft\\directx'
    assert strings['0x6054'] == 'Version'
    assert strings['0x6094'].lower() == '\\ddraw.dll'
    assert strings['0x6090'] == '\\'
    # Exact original instructions: output pair initially zero; file-info fields copied.
    assert dll.code(0x1599, 13) == bytes.fromhex('c7470400000000c70700000000')
    assert dll.code(0x1881, 8) == bytes.fromhex('8b4c24388b44243c')
    assert dll.code(0x188f, 5) == bytes.fromhex('890f894704')
    src = (REPO/'src/09a1-comctl-handlers.wat').read_text()
    assert '(global.get $DX_VERSION_INFO) (local.get $len)' in src
    assert '(if (call $name_is_static_dx_dll (local.get $arg0))' in src
    api = json.loads((REPO/'src/api_table.json').read_text())
    setup = next(a for a in api if a['name'] == 'DirectXSetup')
    assert setup['nargs'] == 3
    assert not any(a['name'] == 'DirectXSetupGetVersion' for a in api)
    out = {'verdict': 'BLOCKED_UNQUALIFIED_VERSION_SOURCE', 'sourceBase': pins['base'],
           'nativeReceipt': receipt, 'exports': list(exports.values()), 'imports': dll.imports(),
           'configImports': exe.imports(), 'nativeHelperStrings': strings,
           'setup32': {'format': 'PE32', 'exports': list(setup32.exports().values()), 'imports': setup32.imports()},
           'setup16': {'format': 'NE', 'importedModules': ne_imports},
           'abi': {'name': 'DirectXSetupGetVersion', 'ordinal': 11, 'rva': '0x18b0',
                   'parameters': ['DWORD *pdwVersion (optional)', 'DWORD *pdwRevision (optional)'],
                   'callingConvention': 'stdcall', 'calleeRetImmediate': 8, 'callerEspAdvanceIncludingReturn': 12,
                   'nativeBoolReturn': 1, 'outputsWhenNoVersionFound': [0, 0],
                   'lastError': 'No SetLastError in wrapper; helper/API effects not normalized',
                   'partialParse': 'helper can leave partially parsed fields; not generalized as zero on all errors'},
           'negativeControlsRejected': controls, 'guestExecution': False, 'canonicalBuild': False}
    if '--write' in os.sys.argv:
        (HERE/'native-analysis.json').write_text(json.dumps(out, indent=2)+'\n')
    else:
        assert json.loads((HERE/'native-analysis.json').read_text()) == out
    print('PASS native seals, canonical source pins, export/import/callsite/output/ret evidence; 4 rejecting controls; no guest execution')


if __name__ == '__main__': main()
