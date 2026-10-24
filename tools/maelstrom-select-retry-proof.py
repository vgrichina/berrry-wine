#!/usr/bin/env python3
"""Offline byte/source proof; no guest execution, module instantiation or networking."""
import argparse
import hashlib
import json
import struct
import subprocess
from pathlib import Path


def sha(data):
    return hashlib.sha256(data).hexdigest()


class PE:
    def __init__(self, data):
        self.data = data
        pe = struct.unpack_from('<I', data, 0x3c)[0]
        assert data[pe:pe + 4] == b'PE\0\0'
        n, optional = struct.unpack_from('<H', data, pe + 6)[0], pe + 24
        size = struct.unpack_from('<H', data, pe + 20)[0]
        self.base = struct.unpack_from('<I', data, optional + 28)[0]
        self.sections = []
        for i in range(n):
            vsize, va, rawsize, raw = struct.unpack_from('<IIII', data, optional + size + i * 40 + 8)
            self.sections.append((va, max(vsize, rawsize), raw))
        self.import_rva = struct.unpack_from('<I', data, optional + 104)[0]

    def off(self, va):
        rva = va - self.base
        for start, size, raw in self.sections:
            if start <= rva < start + size:
                return raw + rva - start
        raise AssertionError(hex(va))

    def u32(self, rva):
        return struct.unpack_from('<I', self.data, self.off(self.base + rva))[0]

    def string(self, rva):
        p = self.off(self.base + rva)
        return self.data[p:self.data.index(b'\0', p)].decode('ascii')

    def imports(self):
        result = {}
        rva = self.import_rva
        while self.u32(rva + 12):
            lookup, iat = self.u32(rva), self.u32(rva + 16)
            dll = self.string(self.u32(rva + 12))
            i = 0
            while (value := self.u32((lookup or iat) + 4 * i)):
                result[self.base + iat + 4 * i] = [dll, '#' + str(value & 0xffff)
                    if value & 0x80000000 else self.string(value + 2)]
                i += 1
            rva += 20
        return result

    def check(self, va, expected):
        expected = bytes.fromhex(expected)
        p = self.off(va)
        assert self.data[p:p + len(expected)] == expected, f'byte mismatch at {va:08x}'


ANCHORS = {
    0x100012f2: '8b3d10200010',  # EDI = IAT(_errno)
    0x1000130d: 'ffd7c70000000000',  # _errno(); *eax = 0, including retry
    0x1000135d: 'e8ee090000',
    0x10001362: '8be8ffd783380474a2',  # save result; _errno(); compare; retry
    0x1000136b: '85ed5f7e2c',
    0x1000139c: '8bc55e5d5b81c414010000c3',
    0x10001d50: 'ff2550200010',  # WSOCK32 ordinal 18: select
}


def verify_net(pe):
    for va, value in ANCHORS.items():
        pe.check(va, value)
    imports = pe.imports()
    assert imports[0x10002010] == ['MSVCRT.dll', '_errno']
    assert imports[0x10002050] == ['WSOCK32.dll', '#18']


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--original', type=Path, required=True)
    ap.add_argument('--crt', type=Path, required=True)
    ap.add_argument('--evidence', type=Path, required=True)
    ap.add_argument('--source-repo', type=Path, required=True)
    ap.add_argument('--current-repo', type=Path, required=True)
    ap.add_argument('--git-stderr', type=Path, required=True)
    args = ap.parse_args()
    names = {'Maelstrom.exe': '0eca5703e512d33c5e5a0bc1a27f14bd3aa4ecddded6e09b4d4019c2f27a15e5',
             'SDL_net.dll': '46ccbb7e5982e2c15421af7dd4fa29b26841d9731c31a86cf9554c90be53af95'}
    inputs = {}
    for name, expected in names.items():
        b = (args.original / name).read_bytes()
        assert sha(b) == expected, name
        inputs[name] = {'bytes': len(b), 'sha256': sha(b)}
    data = (args.original / 'SDL_net.dll').read_bytes()
    pe = PE(data)
    verify_net(pe)
    exe = PE((args.original / 'Maelstrom.exe').read_bytes())
    exe.check(0x40e125, 'e8c253000083c40885c0756e')
    # Enumerate relative CALL references in .text, then bind all four byte anchors.
    # This is not a claim that indirect callers cannot exist.
    callers = []
    for va, size, raw in exe.sections:
        if va != 0x1000:
            continue
        text = exe.data[raw:raw + size]
        for i in range(len(text) - 4):
            if text[i] == 0xe8:
                dest = exe.base + va + i + 5 + struct.unpack_from('<i', text, i + 1)[0]
                if dest == 0x4134ec:
                    callers.append(exe.base + va + i)
    assert callers == [0x40e125, 0x40e6b6, 0x40ea7a, 0x40ed93]
    crtdata = args.crt.read_bytes()
    assert sha(crtdata) == '887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1'
    crt = PE(crtdata)
    crt.check(0x7800c430, 'e82274ffff83c008c3')  # _getptd()+8, native errno
    crt.check(0x78003857, '5657ff154c100378ff35e0a603788bf8ff1574100378')
    assert crt.imports()[0x7803104c] == ['KERNEL32.dll', 'GetLastError']
    assert crt.imports()[0x78031074] == ['KERNEL32.dll', 'TlsGetValue']
    inputs['msvcrt.dll'] = {'bytes': len(crtdata), 'sha256': sha(crtdata)}
    rejects = []
    for va, value in ANCHORS.items():
        changed = bytearray(data)
        changed[pe.off(va)] ^= 1
        try:
            verify_net(PE(changed))
        except AssertionError:
            rejects.append(f'{va:08x}')
        else:
            raise AssertionError('mutant accepted')
    proof = json.loads((args.evidence / 'source-proof.json').read_text())
    def blob(repo, revision, path):
        with args.git_stderr.open('ab') as log:
            return subprocess.check_output(['git', '-C', str(repo), 'show', revision + ':' + path], stderr=log)
    def function(data, name):
        text = data.decode()
        start = text.index('(func $' + name + ' ')
        depth = 0
        for i in range(start, len(text)):
            depth += (text[i] == '(') - (text[i] == ')')
            if depth == 0:
                return text[start:i + 1]
        raise AssertionError(name)
    cache = {}
    for name, f in proof['functions'].items():
        assert sha(f['excerpt'].encode()) == f['excerpt_sha256']
        assert f['current_main_identical']
        for repo, revision in [(args.source_repo, proof['historical']),
                               (args.current_repo, proof['current'])]:
            key = (str(repo), revision, f['path'])
            if key not in cache:
                cache[key] = blob(repo, revision, f['path'])
            assert function(cache[key], name) == f['excerpt']
            if revision == proof['historical']:
                assert sha(cache[key]) == f['file_sha256']
    runner = blob(args.source_repo, proof['runner_revision'], 'test/run.js')
    assert sha(runner) == proof['runner_sha256']
    select = proof['functions']['handle_select']['excerpt']
    assert '$wsa_last_error' not in select and '$msvcrt_errno_ptr' not in select
    assert '(i32.store offset=0 (global.get $reg_base) (local.get $total))' in select
    assert '(i32.const -1)' not in select
    # Algebraic CFG controls, not emulated instructions or observed guest state.
    controls = [{'select': result, 'errno': error, 'successor':
                 '7a330d retry' if error == 4 else '7a336b classify saved EBP'}
                for result in [-1, 0, 1] for error in [0, 4, 10004]]
    assert all(x['successor'].startswith('7a330d') == (x['errno'] == 4) for x in controls)
    analysis = json.loads((args.evidence / 'prior-analysis.json').read_text())
    assert analysis['observedReturnRecords'] == 0
    assert analysis['counters']['0x007a3362'] == '972'
    assert analysis['firstStoppingBoundary']['timeval'] == [1, 0]
    # Frame: locals 0x114 + EBX/EBP/ESI/EDI saves = 0x124.
    frame_offset = 0x114 + 4 * 4
    assert frame_offset == 0x124
    print(json.dumps({'verdict': 'PASS', 'scope': 'static identities/bytes/source plus algebraic controls only',
        'inputs': inputs, 'native_byte_mutants_rejected': rejects,
        'exe_relative_call_references': [f'{x:08x}' for x in callers],
        'cfg_controls': controls, 'current_functions_identical': list(proof['functions']),
        'distinguishing_observation': {'pc': '007a3366', 'saved_select_result': 'EBP',
            'errno_pointer': 'EAX', 'retry_predicate': 'u32[EAX] == 4',
            'caller': 'u32[ESP+0x124]', 'expected_sync_caller': '0040e12a',
            'unexecuted_flags': ['--trace-at=0x7a3366', '--trace-at-mem=eax:4,esp+0x124:12',
                                 '--trace-at-limit=1', '--trace-at-start-batch=36163']},
        'production_defect_proven': False, 'dynamic_errno': None}, indent=2))


if __name__ == '__main__':
    main()
