#!/usr/bin/env python3
"""Required direct Backend.handle contract. Unfixed production MUST exit 1.

No mount, subprocess, surrogate backend, or production mutation. Requests follow
the pinned handler's op12 (Q + names) / op45 (QII + names, zero flags) layouts.
"""
import argparse
import copy
import errno
import hashlib
import importlib.util
import json
from pathlib import Path
import stat
import struct

BASE = Path(__file__).resolve().parents[2]
SOURCE = BASE / 'test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py'
PIN = 'cc2dc7ab2f9b5d1b84b755c61e7a6ffc3e226d52ffe008edf7ace5310cbdc105'
CANDIDATE = 'combined namespace source cc2dc7ab2f9b5d1b84b755c61e7a6ffc3e226d52ffe008edf7ace5310cbdc105'
CASES = ('self', 'direct-child', 'deeper-descendant', 'unrelated-sibling',
         'to-root', 'child-to-ancestor', 'same-path')
INVALID = set(CASES[:3])


def snapshot(b):
    state = b.state().copy()
    del state['operations']  # Only this counter may change on rejected rename.
    return dict(nodes=copy.deepcopy(b.nodes), state=state, next=b.next)


def wire(op, newdir, old, new):
    # Production reads newdir at 0, flags at 8 for op45, names at 8/16.
    header = struct.pack('<Q', newdir) if op == 12 else struct.pack('<QII', newdir, 0, 0)
    return header + old + b'\0' + new + b'\0'


def fixture(backend):
    # Constructor only validates this unused absolute pathname; never mounted.
    b = backend(str(Path(__file__).resolve().parent / 'unused-mount'))
    a = b.create(1, b'A', stat.S_IFDIR | 0o700)
    child = b.create(a, b'child', stat.S_IFDIR | 0o700)
    deep = b.create(child, b'deep', stat.S_IFDIR | 0o700)
    sibling = b.create(1, b'B', stat.S_IFDIR | 0o700)
    leaf = b.create(a, b'leaf', stat.S_IFREG | 0o600)
    b.handle(27, a, b'')  # Preserve nonzero directory opens and global handles.
    b.handle(14, leaf, b'')
    payload = b'cycle-contract'
    b.handle(16, leaf, struct.pack('<QQI', leaf, 0, len(payload)).ljust(40, b'\0') + payload)
    return b, a, child, deep, sibling


def arguments(case, a, child, deep, sibling):
    return {
        'self': (1, a, b'A', b'moved'),
        'direct-child': (1, child, b'A', b'moved'),
        'deeper-descendant': (1, deep, b'A', b'moved'),
        'unrelated-sibling': (1, sibling, b'A', b'moved'),
        'to-root': (a, 1, b'child', b'moved'),
        'child-to-ancestor': (child, a, b'deep', b'moved'),
        'same-path': (1, 1, b'A', b'A'),
    }[case]


def errors(actual_errno, result, after, expected_errno, expected, operations_delta):
    failures = []
    if actual_errno != expected_errno:
        failures.append(f'errno {actual_errno!r}; required {expected_errno!r}')
    if expected_errno is None and result != b'':
        failures.append(f'success result {result!r}; required empty bytes')
    if after != expected:
        failures.append('namespace/nodes/links/opens/accounting changed contrary to contract')
    if operations_delta != 1:
        failures.append(f'operations delta {operations_delta}; required 1')
    return failures


def jsonable(value):
    if isinstance(value, (bytes, bytearray)):
        return {'hex': bytes(value).hex()}
    if isinstance(value, dict):
        return {('bytes:' + k.hex() if isinstance(k, bytes) else str(k)): jsonable(v)
                for k, v in value.items()}
    if isinstance(value, (tuple, list)):
        return [jsonable(v) for v in value]
    return value


def reachable(nodes):
    seen, todo = set(), [1]
    while todo:
        ino = todo.pop()
        if ino not in seen:
            seen.add(ino)
            todo.extend(nodes[ino]['names'].values())
    return sorted(seen)


def run_case(backend, op, case):
    b, a, child, deep, sibling = fixture(backend)
    parent, dest, old, new = arguments(case, a, child, deep, sibling)
    before = snapshot(b)
    expected = copy.deepcopy(before)
    expected_errno = errno.EINVAL if case in INVALID else None
    if case not in INVALID and case != 'same-path':
        moved = expected['nodes'][parent]['names'].pop(old)
        expected['nodes'][dest]['names'][new] = moved
    count = b.operations
    request = wire(op, dest, old, new)
    result, actual_errno = None, None
    try:
        result = b.handle(op, parent, request)
    except OSError as exc:
        actual_errno = exc.errno
    after = snapshot(b)
    failures = errors(actual_errno, result, after, expected_errno, expected, b.operations-count)
    return dict(op=op, case=case, parent=parent, requestHex=request.hex(),
                expectedErrno=expected_errno, actualErrno=actual_errno, result=result,
                before=before, after=after, expected=expected,
                reachableBefore=reachable(before['nodes']), reachableAfter=reachable(after['nodes']),
                operationsBefore=count, operationsAfter=b.operations,
                failures=failures, passed=not failures)


def oracle_selftest():
    """Mutate observations only, never substitute or patch production behavior."""
    base = dict(nodes={1: dict(names={}, links=1, opens=2, data=bytearray(b'x'))},
                state=dict(live=8192, peak=8192, written=1, openHandles=2), next=2)
    checks = []
    assert not errors(errno.EINVAL, None, base, errno.EINVAL, base, 1)
    assert not errors(None, b'', base, None, base, 1)
    for field in ('names', 'links', 'opens', 'data'):
        altered = copy.deepcopy(base)
        altered['nodes'][1][field] = {'bad': 1} if field == 'names' else -1
        assert errors(errno.EINVAL, None, altered, errno.EINVAL, base, 1)
        checks.append('corrupt-' + field)
    for field in base['state']:
        altered = copy.deepcopy(base)
        altered['state'][field] += 1
        assert errors(errno.EINVAL, None, altered, errno.EINVAL, base, 1)
        checks.append('corrupt-' + field)
    altered = copy.deepcopy(base)
    del altered['nodes'][1]
    assert errors(errno.EINVAL, None, altered, errno.EINVAL, base, 1)
    for label, actual, required, result in (
            ('permit-cycle', None, errno.EINVAL, b''),
            ('wrong-errno', errno.EIO, errno.EINVAL, None),
            ('overblock-valid', errno.EINVAL, None, None),
            ('wrong-success-result', None, None, None)):
        assert errors(actual, result, base, required, base, 1)
        checks.append(label)
    assert errors(None, b'', base, None, base, 0)
    checks.extend(('lost-node', 'operations'))
    moved = copy.deepcopy(base)
    moved['nodes'][1]['names'] = {b'moved': 2}
    assert errors(None, b'', base, None, moved, 1)
    assert errors(errno.EINVAL, None, moved, None, moved, 1)
    checks.extend(('valid-move-noop', 'valid-move-overblock'))
    print(f'PASS observation-oracle mutations ({len(checks)})')
    return checks


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--report', type=Path)
    parser.add_argument('--expect-sha256', default=PIN,
                        help='Explicit repair source identity; default is unfixed pinned production')
    parser.add_argument('--oracle-only', action='store_true')
    args = parser.parse_args()
    mutations = oracle_selftest()
    if args.oracle_only:
        return 0
    digest = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    if digest != args.expect_sha256:
        raise SystemExit(f'production source identity mismatch: {digest}')
    spec = importlib.util.spec_from_file_location('actual_cycle_contract_backend', SOURCE)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    rows = [run_case(module.Backend, op, case) for op in (12, 45) for case in CASES]
    for row in rows:
        print(f'{"PASS" if row["passed"] else "FAIL"} op{row["op"]} {row["case"]}: '
              + '; '.join(row['failures']))
    failures = sum(not row['passed'] for row in rows)
    report = dict(candidate=CANDIDATE, source=str(SOURCE.relative_to(BASE)),
                  sourceSha256=digest, sourceBytes=SOURCE.stat().st_size,
                  scope='direct production handler only; kernel pre-callback rejection untested',
                  oracleMutations=mutations, passed=len(rows)-failures, failed=failures, rows=rows)
    if args.report:
        args.report.write_text(json.dumps(jsonable(report), indent=2) + '\n')
    print(f'{len(rows)-failures} passed; {failures} REQUIRED CONTRACT FAILURES')
    return int(bool(failures))


if __name__ == '__main__':
    raise SystemExit(main())
