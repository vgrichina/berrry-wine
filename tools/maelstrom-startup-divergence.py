#!/usr/bin/env python3
"""Offline source/PE/retained-evidence checks. Never instantiates WASM or runs a guest."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import resource
import struct
import subprocess

OLD = Path('/tmp/maelstrom-select-return-capture-oct24')
NEW = Path('/tmp/maelstrom-sync-packet-return-capture-oct24')
EXE = Path('/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6/Maelstrom.exe')
RUN = Path('/tmp/maelstrom-poststart-state-cause-oct24/canonical-run.js')
WASM = Path('/home/user/wine-assembly-shadow-man-span-static-canonical-oct23/build/wine-assembly.wasm')
RUN_SHA = '4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809'
EXE_SHA = '0eca5703e512d33c5e5a0bc1a27f14bd3aa4ecddded6e09b4d4019c2f27a15e5'
WASM_SHA = '8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686'


def digest(b):
    return hashlib.sha256(b).hexdigest()


def load(p):
    return json.loads(p.read_text())


def pe_info(b):
    p = struct.unpack_from('<I', b, 60)[0]
    assert b[p:p+4] == b'PE\0\0'
    o = p + 24
    assert struct.unpack_from('<H', b, o)[0] == 0x10b
    base = struct.unpack_from('<I', b, o+28)[0]
    sh = o + struct.unpack_from('<H', b, p+20)[0]
    sections = [struct.unpack_from('<8sIIII', b, sh+40*i)
                for i in range(struct.unpack_from('<H', b, p+6)[0])]

    def offset(va):
        rva = va - base
        for name, vs, rv, rs, raw in sections:
            if rv <= rva < rv+rs:
                return raw+rva-rv
        raise ValueError(hex(va))

    def string(at):
        return b[at:b.index(b'\0', at)].decode('ascii')

    d = offset(base+struct.unpack_from('<I', b, o+104)[0])
    imports = {}
    while any(b[d:d+20]):
        original, _, _, name, iat = struct.unpack_from('<IIIII', b, d)
        dll = string(offset(base+name))
        i = 0
        while True:
            v = struct.unpack_from('<I', b, offset(base+(original or iat))+4*i)[0]
            if not v:
                break
            imports[base+iat+4*i] = [dll, string(offset(base+v)+2) if v < 0x80000000 else v]
            i += 1
        d += 20
    assert base == 0x400000
    assert base+struct.unpack_from('<I', b, o+16)[0] == 0x417474
    assert b[offset(0x417430):offset(0x417430)+6] == bytes.fromhex('ff25d4904100')
    assert imports[0x4190d4] == ['MSVCRT.dll', '_ftol']
    assert imports[0x419028] == ['MSVCRT.dll', '__getmainargs']
    assert imports[0x4190a4] == ['MSVCRT.dll', 'exit']
    assert b[offset(0x4175a3):offset(0x4175a3)+5] == bytes.fromhex('e8b8020000')
    assert b[offset(0x4175ac):offset(0x4175ac)+6] == bytes.fromhex('ff15a4904100')
    calls = []
    for name, vs, rv, rs, raw in sections:
        if name.rstrip(b'\0') != b'.text':
            continue
        for i in range(raw, raw+min(vs, rs)-4):
            va = base+rv+i-raw
            if b[i] == 0xe8 and va+5+struct.unpack_from('<i', b, i+1)[0] == 0x417430:
                calls.append(va)
    # Byte candidates corroborated by the retained narrow native windows.
    assert calls == [0x403877, 0x403881, 0x40388b, 0x403895, 0x41578b, 0x4157ee, 0x416386, 0x41640f]
    return dict(entry='00417474', finalPC='00417430', instruction='ff25d4904100',
                iat='004190d4', imported=imports[0x4190d4], callReturnPCs=[hex(x+5) for x in calls])


def excerpts(s):
    # Execute only exact source fragments; no require/import or guest code.
    parser = s[s.index('const getArg ='):s.index('// Was `--name=...`')]
    batch = re.search(r"^let BATCH_SIZE = .*;$", s, re.M).group()
    trace = re.search(r"^const TRACE_AT = [^\n]+$", s, re.M).group()+'\n'
    watch = ''.join(re.search(r'^const '+name+r' = [^\n]+$', s, re.M).group()+'\n'
                    for name in ['WATCH_SPEC', 'WATCH_BYTE', 'WATCH_WORD'])
    fanout = watch+s[s.index('const breakAddrs ='):s.index('function deferredResolveAddrs()')]
    return parser, batch, trace, fanout


def effective_sizes(s, cases):
    parser, batch, trace, fanout = excerpts(s)
    js = ('const cases=JSON.parse(process.argv[1]);const out=cases.map(args=>{'+parser+
          'const BREAKPOINT=getArg("break",null);'+batch+trace+fanout+
          ';return {size:BATCH_SIZE,trace:traceAtAddrs,breaks:breakAddrs};});'+
          'console.log(JSON.stringify(out));')
    assert len(js.encode()) <= 8192

    def limits():
        resource.setrlimit(resource.RLIMIT_CPU, (60, 60))
    r = subprocess.run(['node', '--max-old-space-size=256', '-e', js,
                        json.dumps([x[4:] for x in cases])], capture_output=True,
                       text=True, timeout=60, preexec_fn=limits)
    assert r.returncode == 0, r.stderr
    return json.loads(r.stdout)


def check_pacing(s, previous, latest):
    cases = [previous, latest,
             latest+['--batch-size=1000'],
             [x for x in latest if not x.startswith('--trace-at-start-batch=')]+['--trace-at-start-batch=999999'],
             [x for x in latest if not x.startswith('--trace-at=')]+['--trace-at=0x40e12a'],
             previous+['--break=0x417430,0x417474']]
    out = effective_sizes(s, cases)
    assert [v['size'] for v in out] == [1000, 1, 1, 1, 1000, 1]
    # Existing proposed recipe must FAIL the unchanged pacing prerequisite.
    rejected = []
    for index, name in [(1, 'actual five-PC recipe'), (2, 'explicit 1000 override'),
                        (3, 'deferred arming'), (5, 'multi-break alternative')]:
        try:
            assert out[index]['size'] == out[0]['size'], 'changed startup block budget'
        except AssertionError:
            rejected.append(name)
        else:
            raise AssertionError('rejecting control accepted '+name)
    return dict(cases=out, rejected=rejected, sourceFragments=[dict(bytes=len(x.encode()),
                sha256=digest(x.encode()), source=x) for x in excerpts(s)],
                requestedMaxBlocks=dict(previous=42000*1000, latest=42000),
                qualification='Upper budgets, not measured retired blocks; yields/cache work can shorten slices.')


def main():
    ap = argparse.ArgumentParser()
    mode = ap.add_mutually_exclusive_group(required=True)
    mode.add_argument('--output', type=Path)
    mode.add_argument('--check-argv', type=Path,
                      help='Reject argv whose effective startup BATCH_SIZE differs from historical 1000')
    a = ap.parse_args()
    mem = int(re.search(r'MemAvailable:\s+(\d+)', Path('/proc/meminfo').read_text())[1])*1024
    assert mem >= 805306368
    resource.setrlimit(resource.RLIMIT_CPU, (60, 60))
    b, s = EXE.read_bytes(), RUN.read_text()
    assert digest(b) == EXE_SHA
    assert digest(s.encode()) == RUN_SHA
    assert digest(WASM.read_bytes()) == WASM_SHA
    if a.check_argv:
        args = load(a.check_argv)
        args = args['argv'] if isinstance(args, dict) else args
        assert not any('set-batch-size' in x for x in args), 'scheduled size changes require separate review'
        size = effective_sizes(s, [args])[0]['size']
        print(json.dumps(dict(passStartupPacing=size == 1000, actual=size, expected=1000)))
        raise SystemExit(0 if size == 1000 else 1)
    native = pe_info(b)
    mutations = []
    for label, index in [('IAT operand', 0x17432), ('import name', b.index(b'_ftol\0'))]:
        mutant = bytearray(b)
        mutant[index] ^= 1
        try:
            pe_info(mutant)
        except (AssertionError, ValueError):
            mutations.append(label)
        else:
            raise AssertionError('native mutant accepted '+label)
    # A full identity seal also rejects unrelated changes outside native anchors.
    mutant = bytearray(b)
    mutant[-1] ^= 1
    assert digest(mutant) != EXE_SHA
    mutations.append('unrelated full-file change')
    old = load(OLD/'collected/guest/command.json')
    new = load(NEW/'collected/guest/command.json')
    normalize = lambda x: x.replace(str(OLD), '<TASK>').replace(str(NEW), '<TASK>')
    oa, na = [normalize(x) for x in old['argv']], [normalize(x) for x in new['argv']]
    deltas = [dict(index=i, previous=x, latest=y) for i, (x, y) in enumerate(zip(oa, na)) if x != y]
    assert len(oa) == len(na) and len(deltas) == 4
    assert all(v['previous'].startswith(('--trace-at=', '--trace-at-start-batch=',
                '--trace-at-limit=', '--trace-at-mem=')) for v in deltas)
    assert old['environment'] == new['environment']
    assert old['limits'] == new['limits']
    pacing = check_pacing(s, old['argv'], new['argv'])
    helpers = []
    for n in ['preload.cjs', 'observer.cjs', 'capture.cjs', 'stage.py', 'supervise.py']:
        x, y = (OLD/n).read_bytes(), (NEW/n).read_bytes()
        helpers.append(dict(name=n, previousSHA256=digest(x), latestSHA256=digest(y),
                            byteEqual=x == y, relocationEqual=normalize(x.decode()) == normalize(y.decode())))
    assert all(x['byteEqual'] for x in helpers[:3])
    assert helpers[3]['relocationEqual']
    # Supervisor's only remaining differences are allocation/lifecycle metadata.
    sx, sy = (OLD/'supervise.py').read_text(), (NEW/'supervise.py').read_text()
    sx = sx.replace(str(OLD), str(NEW)).replace('bx_ktknkc9m', 'bx_bewteqdp')
    for x, y in [('1792831320', '1792833840'), ('latest start08:42UTC', 'latest start09:24UTC'),
                 ('shutdown08:47UTC', 'shutdown09:29UTC'),
                 ('2026-10-24T08:53:24.080Z', '2026-10-24T09:34:43.880Z')]:
        sx = sx.replace(x, y)
    assert sx == sy
    m1, m2 = (OLD/'manifest.json').read_bytes(), (NEW/'manifest.json').read_bytes()
    assert m1 == m2
    manifest = json.loads(m1)
    assert len(manifest) == 247 and sum(x['bytes'] for x in manifest) == 17027463
    originals = [x for x in manifest if x['target'].startswith('vfs/')]
    assert len(originals) == 48 and sum(x['bytes'] for x in originals) == 2794170
    for item in originals:
        data = Path(item['path']).read_bytes()
        assert len(data) == item['bytes'] and digest(data) == item['sha256']
    assert any(',' in x['target'] for x in originals)
    seals = load(NEW/'repo/docs/re-notes/maelstrom-sync-packet-return-capture-20261024/evidence-seals.json')
    for x in seals:
        data = (NEW/'collected'/x['path']).read_bytes()
        assert len(data) == x['bytes'] and digest(data) == x['sha256']
    oldlog = (OLD/'collected/guest/output.log').read_text()
    newlog = (NEW/'collected/guest/output.log').read_text()
    historical_bindings = []
    for name in ['output.log', 'command.json', 'terminal.json']:
        historical = subprocess.check_output(['git', '-C',
            '/tmp/maelstrom-sync-loop-cause-oct24/repo', 'show',
            '6c265033d01e547a3d9320316cc17027bbb7cb0b:docs/re-notes/'
            'maelstrom-select-return-capture-20261024/'+name], timeout=30)
        assert historical == (OLD/'collected/guest'/name).read_bytes()
        historical_bindings.append(dict(path=name, bytes=len(historical), sha256=digest(historical)))
    marker = '[trace-window] tracing batches 30000..end\n'
    prefix = oldlog.split(marker)[0]+marker
    assert newlog.startswith(prefix)
    assert 'CreateThread handle=' in oldlog and 'CreateThread handle=' not in newlog
    assert '[TRACE-AT #1] batch=36163 EIP=0x00406378' in oldlog
    assert '"counts":[3,972,1,1,1,23338]' in oldlog
    assert 'EIP=0x00417430 EAX=0x00000001' in newlog
    assert 'Stats: 4702 API calls, 42000 batches' in newlog
    counts = re.findall(r'^  (0x[0-9a-f]+) = (\d+)$', newlog, re.M)
    assert len(counts) == 6 and all(x[1] == '0' for x in counts)
    # Retain exact bounded provenance for the call and batch-clock coupling.
    source_ranges = [(285, 289), (887, 892), (1522, 1531), (7527, 7531),
                     (10241, 10258), (10360, 10365)]
    lines = s.splitlines(keepends=True)
    slices = [dict(first=lo, last=hi, text=''.join(lines[lo-1:hi])) for lo, hi in source_ranges]
    assert all(len(x['text'].encode()) <= 8192 for x in slices)
    report = dict(passChecks=True, memAvailable=mem, native=native, nativeRejected=mutations,
                  identities=dict(exe=EXE_SHA, harness=RUN_SHA, module=WASM_SHA,
                      manifest=digest(m1), files=247, bytes=17027463, originalsRehashed=48),
                  argvDeltas=deltas, recordedEnvironmentEqual=True,
                  inheritedEnvironment='Not captured in full; equality not claimed.',
                  limitsEqual=True, helpers=helpers, supervisorChangesOnlyLifecycle=True,
                  rawLatestBindingsRehashed=seals, commonLogPrefixBytes=len(prefix.encode()),
                  historicalBindings=historical_bindings,
                  pacing=pacing, sourceSlices=slices,
                  checks='Offline exact-source evaluation and PE parsing only; no original instructions executed.')
    a.output.write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(dict(passChecks=True, startupBudgets=[1000, 1],
                         rejectingControls=len(mutations)+len(pacing['rejected']),
                         output=str(a.output))))


if __name__ == '__main__':
    main()
