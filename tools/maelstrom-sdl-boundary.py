#!/usr/bin/env python3
"""Offline original-byte and historical-source proof. Never runs a guest or WASM.

The small counterexample models a decoded block, not a full emulator. It proves
why an interior-PC zero counter cannot establish a nonreturning API.
"""
import argparse
import hashlib
import json
import pathlib
import re
import resource
import struct
import subprocess

REV = 'b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a'
HASHES = {
    'SDL.dll': '02433232425e68009843bd3ecec20ad67453a48487f7b5828c595b76e2f9d373',
    'SDL_net.dll': '46ccbb7e5982e2c15421af7dd4fa29b26841d9731c31a86cf9554c90be53af95',
    'Maelstrom.exe': '0eca5703e512d33c5e5a0bc1a27f14bd3aa4ecddded6e09b4d4019c2f27a15e5',
}


def sha(b):
    return hashlib.sha256(b).hexdigest()


class PE:
    def __init__(self, b):
        self.b = b
        pe = struct.unpack_from('<I', b, 0x3c)[0]
        assert b[pe:pe+4] == b'PE\0\0'
        self.op = pe + 24
        assert self.u16(self.op) == 0x10b
        self.base = self.u32(self.op + 28)
        self.sections = []
        for i in range(self.u16(pe + 6)):
            at = self.op + self.u16(pe + 20) + i * 40
            self.sections.append(struct.unpack_from('<IIII', b, at + 8))

    def u16(self, at):
        return struct.unpack_from('<H', self.b, at)[0]

    def u32(self, at):
        return struct.unpack_from('<I', self.b, at)[0]

    def offset(self, va, n=1):
        rva = va - self.base
        for _, start, size, offset in self.sections:
            if start <= rva and rva + n <= start + size:
                return offset + rva - start
        raise ValueError('unbacked VA')

    def read(self, va, n):
        at = self.offset(va, n)
        return self.b[at:at+n]

    def string(self, rva):
        return self.b[self.offset(self.base+rva):].split(b'\0', 1)[0].decode()

    def imports(self):
        at = self.offset(self.base + self.u32(self.op + 104))
        rows = []
        while self.u32(at + 12):
            orig, _, _, name, iat = struct.unpack_from('<5I', self.b, at)
            dll = self.string(name)
            j = 0
            while True:
                item = self.u32(self.offset(self.base + (orig or iat)) + j*4)
                if not item:
                    break
                symbol = item & 65535 if item >> 31 else self.string(item+2)
                rows.append((self.base+iat+j*4, dll, symbol))
                j += 1
            at += 20
        return rows


def check_bytes(pe, at, expected):
    assert pe.read(at, len(bytes.fromhex(expected))).hex() == expected


def call_target(pe, at):
    b = pe.read(at, 5)
    assert b[0] == 0xe8
    return at + 5 + struct.unpack_from('<i', b, 1)[0]


def thunk_binding(rows, initial, thunk):
    # Historical process_dll_imports reserves once per system import, in ILT
    # order. SDL and CRT descriptors resolve to loaded modules, reserving none.
    system = [r for r in rows if r[1].lower() not in ('sdl.dll', 'msvcrt.dll')]
    index = (thunk - 0x07500000) // 8 - initial
    assert (thunk - 0x07500000) % 8 == 0
    return system[index]


def counterexample(exe):
    check_bytes(exe, 0x4019a8, '83c404e850c60000')
    assert call_target(exe, 0x4019ab) == 0x40e000
    # Execute the authentic two-instruction block's control effect. Counts
    # compare PC at entry, exactly as the retained run-loop source does.
    pc, esp = 0x4019a8, 0x074ffe9c
    counts = {0x4019a8: 0, 0x4019ab: 0, 0x40e000: 0}
    counts[pc] += 1
    esp += 4                         # original ADD ESP,4
    ret = pc + 8                     # original CALL's return PC
    esp -= 4
    pc = call_target(exe, pc + 3)
    counts[pc] += 1
    assert ret == 0x4019b0 and esp == 0x074ffe9c
    assert counts[0x4019ab] == 0 and counts[0x40e000] == 1
    return {hex(k): v for k, v in counts.items()}


def reject(fn):
    try:
        fn()
    except (AssertionError, ValueError, IndexError):
        return True
    raise AssertionError('negative control unexpectedly passed')


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--game', type=pathlib.Path, required=True)
    ap.add_argument('--source-repo', type=pathlib.Path, required=True)
    ap.add_argument('--harness', type=pathlib.Path, required=True)
    ap.add_argument('--wasm', type=pathlib.Path, required=True)
    ap.add_argument('--out', type=pathlib.Path, required=True)
    a = ap.parse_args()
    resource.setrlimit(resource.RLIMIT_CPU, (60, 60))
    mem = next(int(s.split()[1])*1024 for s in pathlib.Path('/proc/meminfo').read_text().splitlines() if s.startswith('MemAvailable:'))
    assert mem >= 805306368
    repo = pathlib.Path(__file__).resolve().parents[1]
    evidence = repo / 'docs/re-notes/maelstrom-sdl-event-drain-cause-20261024'
    capture = repo / 'docs/re-notes/maelstrom-poststart-phase-capture-20261024'
    # Every executable/source import is identity checked; no dynamic imports.
    pes = {}
    for name, digest in HASHES.items():
        b = (a.game/name).read_bytes()
        assert sha(b) == digest
        pes[name] = PE(b)
    assert sha(a.harness.read_bytes()) == '4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809'
    assert sha(a.wasm.read_bytes()) == '8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686'
    sources = {}
    for row in json.loads((evidence/'historical-slices.json').read_text()):
        p = row['path']
        if p not in sources:
            b = subprocess.run(['git', '-C', str(a.source_repo), 'show', REV+':'+p], capture_output=True, check=True, timeout=10).stdout
            assert sha(b) == row['full_sha256'] and len(b) == row['full_bytes']
            sources[p] = b
        lo, hi = row['lines']
        excerpt = b''.join(sources[p].splitlines(keepends=True)[lo-1:hi])
        assert sha(excerpt) == row['sha256'] and len(excerpt) == row['bytes']
        assert excerpt == (evidence/row['excerpt']).read_bytes()
    run = sources['src/13-exports.wat'].decode()
    assert '(if (i32.eq (i32.load (local.get $hc_slot)) (global.get $eip))' in run
    assert '(global.set $dbg_chain_guard (global.get $dbg_any))' in run
    loader = sources['src/08b-dll-loader.wat'].decode()
    assert '(i32.const 18))  (then (return (call $lookup_api_id "select")))' in loader
    assert '(global.set $num_thunks (call $thunk_reserve))' in loader
    log = (capture/'output.log').read_text()
    assert sha(log.encode()) == '7d655ca400e9d879267d7f383dc7faaa23c143896c484b6e20117ec99781dd6e'
    final = re.search(r'--- Final state ---\nEIP=0x([0-9a-f]+).*?ESP=0x([0-9a-f]+)', log)
    eip, esp = (int(v, 16) for v in final.groups())
    initial = int(re.search(r'DLL: SDL.dll .*?thunks=(\d+)', log)[1])
    rows = pes['SDL_net.dll'].imports()
    binding = thunk_binding(rows, initial, eip)
    assert binding == (0x10002050, 'WSOCK32.dll', 18)
    assert initial == 2069 and eip == 0x075040f8 and esp == 0x074ffb18
    assert len([r for r in rows if r[1].lower() not in ('sdl.dll', 'msvcrt.dll')]) == 22
    assert 'DLL: SDL_net.dll at 0x7a2000, DllMain=0x7a3e4f, thunks=2091' in log
    assert 'Calling DllMain at 0x525428...' in log[log.index('After patching: 2094 thunks'):]
    net, sdl, exe = (pes[n] for n in ('SDL_net.dll', 'SDL.dll', 'Maelstrom.exe'))
    check_bytes(net, 0x1000135d, 'e8ee090000')
    assert call_target(net, 0x1000135d) == 0x10001d50
    check_bytes(net, 0x10001d50, 'ff2550200010')
    assert 0x10001362 - net.base + 0x7a2000 == 0x7a3362
    check_bytes(exe, 0x40287d, '83c40885c075e5')
    check_bytes(exe, 0x40e000, '81ec2c020000')
    check_bytes(sdl, 0x10022a8c, 'ff157ca00210')
    assert dict((a, (d, n)) for a, d, n in sdl.imports())[0x1002a07c] == ('KERNEL32.dll', 'ReleaseMutex')
    # Both scheduled samples contain the same candidate select frame; they
    # are not simultaneous with the final register print and are not unwound.
    frame_lines = re.findall(r'0x074ffb10  ((?:[0-9a-f]{2} ){15}[0-9a-f]{2})', log)
    frames = [bytes.fromhex(s) for s in frame_lines]
    assert sum(struct.unpack_from('<I', b, 8)[0] == 0x7a3362 for b in frames) == 2
    counts = counterexample(exe)
    # Reject a changed authentic call, wrong relocation, wrong allocation
    # cursor, wrong API claim, and the old zero-counter causal inference.
    mutated = bytearray(exe.b)
    mutated[exe.offset(0x4019ab)] = 0x90
    controls = {
        'changed_call_bytes': reject(lambda: counterexample(PE(bytes(mutated)))),
        'wrong_loader_cursor': reject(lambda: assert_select(rows, initial+1, eip)),
        'mutex_thunk_claim': reject(lambda: equal(binding[2], 550)),
        'wrong_SDLnet_relocation': reject(lambda: equal(0x10001362-0x10000000+0x666000, 0x7a3362)),
        'zero_counter_means_no_Sync': reject(lambda: equal(counts['0x40e000'], 0)),
        'wrong_ordinal_binding': reject(lambda: assert_select([(at, dll, 19 if at == 0x10002050 else n) for at, dll, n in rows], initial, eip)),
    }
    result = {'pass': True, 'memory_available': mem, 'module_source': REV,
              'binding': {'iat': hex(binding[0]), 'dll': binding[1], 'ordinal': binding[2], 'api': 'select', 'thunk': hex(eip), 'slot': (eip-0x7500000)//8},
              'counterexample': counts, 'controls': controls,
              'conclusion': 'Final thunk is select. Zero interior-PC counts do not establish pending SDL drain. No permanent hang or production defect proven.',
              'scope': 'Static proof and source-anchored block model only; no guest/WASM execution, full unwinder or socket-readiness model.'}
    a.out.write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps(result))


def equal(a, b):
    assert a == b


def assert_select(rows, initial, eip):
    assert thunk_binding(rows, initial, eip) == (0x10002050, 'WSOCK32.dll', 18)


if __name__ == '__main__':
    main()
