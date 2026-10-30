#!/usr/bin/env python3
"""Independent direct-handler acceptance; no predecessor oracle imports."""
import copy
import errno
import hashlib
import importlib.util
import json
from pathlib import Path
import stat
import struct
import types

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
SOURCE = ROOT / 'test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py'
PIN = 'cc2dc7ab2f9b5d1b84b755c61e7a6ffc3e226d52ffe008edf7ace5310cbdc105'
CANDIDATE = 'combined namespace source cc2dc7ab2f9b5d1b84b755c61e7a6ffc3e226d52ffe008edf7ace5310cbdc105'


def encode(x):
    if isinstance(x, (bytes, bytearray)):
        return {'hex': bytes(x).hex()}
    if isinstance(x, dict):
        return {str(k): encode(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [encode(v) for v in x]
    return x


def fixture(backend):
    b = backend(str(HERE / 'never-mounted'), live_limit=262144)
    # Distinct long branch, sibling branch and payload: IDs come from production.
    chain = []
    parent = 1
    for i in range(9):
        parent = b.create(parent, ('d%d' % i).encode(), stat.S_IFDIR | 0o750)
        chain.append(parent)
    sibling = b.create(1, b'sibling', stat.S_IFDIR | 0o700)
    payload = b.create(chain[4], b'payload', stat.S_IFREG | 0o600)
    b.resize(payload, 7)
    b.nodes[payload]['data'][:] = b'payload'
    b.nodes[payload]['opens'] = 1
    b.handles = 1
    b.written = 7
    return b, chain, sibling, payload


def observe(b):
    # Compare every instance field, including accounting limits, rather than
    # deriving a subset from the predecessor observation validator.
    state = copy.deepcopy(vars(b))
    state.pop('operations')
    state['root'] = str(state['root'])
    return state


CASES = ('self', 'descendant-1', 'descendant-4', 'descendant-8',
         'cycle-reachable', 'cycle-unrelated', 'cycle-back-to-source',
         'upward', 'ancestor', 'unrelated', 'same-path', 'file-into-deep')


def exercise(backend, op, case):
    b, c, sibling, payload = fixture(backend)
    src, old, dst, new = 1, b'd0', c[0], b'moved'
    rejected = case in CASES[:5] or case == 'cycle-back-to-source'
    if case.startswith('descendant-'):
        dst = c[int(case.split('-')[1])]
    elif case == 'cycle-reachable':
        b.nodes[c[7]]['names'][b'loop'] = c[3]
        dst = c[8]
    elif case == 'cycle-unrelated':
        b.nodes[c[7]]['names'][b'loop'] = c[3]
        dst = sibling
    elif case == 'cycle-back-to-source':
        b.nodes[c[8]]['names'][b'loop'] = c[0]
        dst = c[6]
    elif case == 'upward':
        src, old, dst = c[5], b'd6', c[1]
    elif case == 'ancestor':
        src, old, dst = c[1], b'd2', 1
    elif case == 'unrelated':
        dst = sibling
    elif case == 'same-path':
        dst, new = src, old
    elif case == 'file-into-deep':
        src, old, dst = c[4], b'payload', c[8]
    before = observe(b)
    count = b.operations
    expected = copy.deepcopy(before)
    if not rejected and (src, old) != (dst, new):
        moved = expected['nodes'][src]['names'].pop(old)
        expected['nodes'][dst]['names'][new] = moved
    wire = (struct.pack('<Q', dst) if op == 12 else struct.pack('<QII', dst, 0, 0))
    wire += old + b'\0' + new + b'\0'
    result, actual_errno = None, None
    try:
        result = b.handle(op, src, wire)
    except OSError as ex:
        actual_errno = ex.errno
    after = observe(b)
    errors = []
    if actual_errno != (errno.EINVAL if rejected else None):
        errors.append('errno')
    if result != (None if rejected else b''):
        errors.append('result')
    if after != expected:
        errors.append('complete-instance-state')
    if b.operations != count + 1:
        errors.append('operations')
    row = dict(op=op, case=case, passed=not errors, failures=errors)
    if errors:
        row.update(request=dict(src=src, dst=dst, old=old, new=new, wire=wire),
                   errno=actual_errno, result=result, before=before,
                   expected=expected, after=after)
    return row


def suite(backend):
    return [exercise(backend, op, case) for op in (12, 45) for case in CASES]


def main():
    raw = SOURCE.read_bytes()
    assert len(raw) == 12482 and hashlib.sha256(raw).hexdigest() == PIN
    spec = importlib.util.spec_from_file_location('pinned_production_cycle', SOURCE)
    actual = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(actual)
    rows = suite(actual.Backend)
    report = dict(candidate=CANDIDATE, sourceSha256=PIN,
                  scope='direct Backend.handle op12/op45 only; no mount/kernel/CLI/gameplay',
                  rows=rows, mutations=[])
    if any(not row['passed'] for row in rows):
        (HERE / 'independent-report.json').write_text(json.dumps(encode(report), indent=2) + '\n')
        raise SystemExit('COUNTEREXAMPLE preserved; production not modified')
    text = raw.decode()
    start = text.index("            if stat.S_ISDIR(self.nodes[moved]['mode']):")
    end = text.index('            if new in dest:', start)
    guard = text[start:end]
    late = text[:start] + text[end:]
    insertion = "            dest[new]=source.pop(old)\n"
    assert late.count(insertion) == 1
    variants = {
        'guard-removed': text[:start] + text[end:],
        'wrong-errno': text[:start] + guard.replace('errno.EINVAL', 'errno.EIO') + text[end:],
        'late-guard': late.replace(insertion, insertion + guard),
        'overbroad': text[:start] + "            raise OSError(errno.EINVAL,'overbroad mutant')\n" + text[end:],
    }
    for label, mutant in variants.items():
        path = HERE / ('mutant-' + label + '.py')
        path.write_text(mutant)
        module = types.ModuleType('mutant_' + label.replace('-', '_'))
        exec(compile(path.read_bytes(), str(path), 'exec'), module.__dict__)
        checked = suite(module.Backend)
        failures = [row for row in checked if not row['passed']]
        assert failures, label + ' escaped independent oracle'
        report['mutations'].append(dict(name=label, sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                                        caught=len(failures), counterexample=failures[0]))
    assert SOURCE.read_bytes() == raw
    report.update(passed=len(rows), failed=0, mutantsCaught=len(variants))
    (HERE / 'independent-report.json').write_text(json.dumps(encode(report), indent=2) + '\n')
    print('PASS %d independent direct-handler cases; %d/4 source mutants caught' %
          (len(rows), len(variants)))


if __name__ == '__main__':
    main()
