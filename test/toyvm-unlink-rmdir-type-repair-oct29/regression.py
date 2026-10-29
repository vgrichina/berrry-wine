#!/usr/bin/env python3
"""Direct production Backend.handle contracts; default exits 1 on violations.

No mount, subprocess, syscall surrogate, or expectedFailure decorator. The
diagnostic command reads retained evidence only; it does not accept the contract.
"""
import argparse
import copy
import errno
import hashlib
import importlib.util
import json
import pathlib
import stat
import struct

HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parent.parent
BACKEND = 'test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py'
PIN_FILE = HERE / 'source-pins.json'


def snapshot(b):
    # Include every node field (names, mode, payload, links and opens), all
    # accounting and allocation cursors. Only operations may change on error.
    nodes = {str(i): dict(mode=n['mode'], data=n['data'].hex(),
                         names={k.hex(): v for k, v in sorted(n['names'].items())},
                         links=n['links'], opens=n['opens'])
             for i, n in sorted(b.nodes.items())}
    return dict(nodes=nodes, next=b.next, live=b.live, peak=b.peak,
                written=b.written, handles=b.handles, failure=b.failure,
                live_limit=b.live_limit, write_limit=b.write_limit,
                file_limit=b.file_limit)


def problems(row):
    errors = []
    if row['errno'] != row['expectedErrno']:
        errors.append('errno: expected %s, observed %s' %
                      (row['expectedErrno'], row['errno']))
    if row['after'] != row['expectedAfter']:
        errors.append('namespace/node/accounting state differs')
    if row['errno'] == 0 and row['answerHex'] != '':
        errors.append('successful removal must return empty bytes')
    if row['operationsDelta'] != 1:
        errors.append('handle must count exactly one operation')
    return errors


def oracle_selftest():
    # Synthetic *result* mutations exercise the oracle, never replace Backend.
    state = dict(nodes={'1': dict(names={'61': 2}, links=1, opens=0)},
                 live=8192, peak=8192, written=7, handles=0)
    good = dict(expectedErrno=21, errno=21, before=copy.deepcopy(state),
                after=copy.deepcopy(state), expectedAfter=copy.deepcopy(state),
                answerHex=None, operationsDelta=1)
    assert not problems(good)
    count = 0
    def rejected(row):
        nonlocal count
        assert problems(row), row
        count += 1
    row = copy.deepcopy(good); row['errno'] = 20; rejected(row)
    for key in ('live', 'peak', 'written', 'handles'):
        row = copy.deepcopy(good); row['after'][key] += 1; rejected(row)
    for key in ('links', 'opens'):
        row = copy.deepcopy(good); row['after']['nodes']['1'][key] += 1; rejected(row)
    row = copy.deepcopy(good); row['after']['nodes']['1']['names'].clear(); rejected(row)
    row = copy.deepcopy(good); row['after']['nodes'].clear(); rejected(row)
    row = copy.deepcopy(good); row['operationsDelta'] = 2; rejected(row)
    success = copy.deepcopy(good)
    success.update(expectedErrno=0, errno=0, answerHex='')
    assert not problems(success)
    row = copy.deepcopy(success); row['errno'] = errno.EISDIR; rejected(row)
    row = copy.deepcopy(success); row['answerHex'] = '00'; rejected(row)
    return dict(status='PASS', rejectedMutations=count,
                scope='result oracle only; no production replacement')


def load_backend(allow_change):
    pins = json.loads(PIN_FILE.read_text())
    actual = {}
    for name, expected in pins['sourcePins'].items():
        data = (REPO / name).read_bytes()
        actual[name] = dict(bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
        if actual[name] != expected and not (allow_change and name == BACKEND):
            raise AssertionError('source pin mismatch: ' + name)
    spec = importlib.util.spec_from_file_location('production_backend', REPO / BACKEND)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.Backend, actual


# name, opcode, kind, nonempty, open, expected errno
CASES = [
    ('unlink-empty-directory', 10, 'dir', False, False, errno.EISDIR),
    ('unlink-nonempty-directory', 10, 'dir', True, False, errno.EISDIR),
    ('unlink-open-empty-directory', 10, 'dir', False, True, errno.EISDIR),
    ('unlink-open-nonempty-directory', 10, 'dir', True, True, errno.EISDIR),
    ('rmdir-regular-file', 11, 'file', False, False, errno.ENOTDIR),
    ('rmdir-open-regular-file', 11, 'file', False, True, errno.ENOTDIR),
    ('unlink-regular-file', 10, 'file', False, False, 0),
    ('unlink-open-regular-file', 10, 'file', False, True, 0),
    ('rmdir-empty-directory', 11, 'dir', False, False, 0),
    ('rmdir-open-empty-directory', 11, 'dir', False, True, 0),
    ('unlink-missing', 10, 'missing', False, False, errno.ENOENT),
    ('rmdir-missing', 11, 'missing', False, False, errno.ENOENT),
    ('rmdir-nonempty-directory', 11, 'dir', True, False, errno.ENOTEMPTY),
    ('rmdir-open-nonempty-directory', 11, 'dir', True, True, errno.ENOTEMPTY),
]


def exercise(Backend, case):
    name, op, kind, nonempty, opened, expected_errno = case
    b = Backend(HERE / 'never-mounted', live_limit=12288,
                write_limit=65536, file_limit=8192)
    child = None
    if kind != 'missing':
        mode = (stat.S_IFDIR if kind == 'dir' else stat.S_IFREG) | 0o700
        child = b.create(1, b'victim', mode)
        if nonempty:
            b.create(child, b'leaf', stat.S_IFREG | 0o600)
        if kind == 'file':
            # Production WRITE: fuse_write_in = 40 bytes, then exact payload.
            # Gives preservation checks nonzero written and dense payload charge.
            payload = b'contract-data'
            request = struct.pack('<QQIIQII', child, 0, len(payload), 0, 0, 0, 0) + payload
            assert b.handle(16, child, request) == struct.pack('<II', len(payload), 0)
        if opened:
            b.handle(27 if kind == 'dir' else 14, child, b'')
    request = b'victim\0'  # handle receives the body after the 40-byte FUSE header.
    before = snapshot(b)
    expected = copy.deepcopy(before)
    if expected_errno == 0:
        del expected['nodes']['1']['names'][b'victim'.hex()]
        target = expected['nodes'][str(child)]
        target['links'] -= 1
        if not opened:
            expected['live'] -= 4096 + ((len(bytes.fromhex(target['data'])) + 4095) // 4096) * 4096
            del expected['nodes'][str(child)]
    operations = b.operations
    answer, observed = None, 0
    try:
        answer = b.handle(op, 1, request)
    except OSError as exc:
        observed = exc.errno
    row = dict(name=name, opcode=op, parent=1, requestHex=request.hex(),
               expectedErrno=expected_errno, errno=observed,
               answerHex=answer.hex() if isinstance(answer, bytes) else None,
               before=before, after=snapshot(b), expectedAfter=expected,
               operationsDelta=b.operations - operations)
    row['problems'] = problems(row)
    row['contract'] = 'FAIL' if row['problems'] else 'PASS'
    return row


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=pathlib.Path, default=HERE / 'canonical.json')
    parser.add_argument('--allow-backend-change', action='store_true',
                        help='explicit repair retest; still records actual backend hash')
    parser.add_argument('--diagnose', type=pathlib.Path,
                        help='read original evidence and positively verify the six known counterexamples')
    args = parser.parse_args()
    oracle = oracle_selftest()
    if args.diagnose:
        evidence = json.loads(args.diagnose.read_text())
        expected_names = {c[0] for c in CASES if c[5] in (errno.EISDIR, errno.ENOTDIR)}
        failed = {r['name'] for r in evidence['cases'] if problems(r)}
        assert failed == expected_names
        assert len(evidence['cases']) == len(CASES)
        for row in evidence['cases']:
            assert row['problems'] == problems(row)
            if row['name'] in failed:
                assert row['errno'] == 0 and row['before'] != row['after']
        print('DEFECT REPRODUCED: six retained counterexamples; eight controls PASS; contract NOT accepted')
        return 0
    Backend, actual = load_backend(args.allow_backend_change)
    rows = [exercise(Backend, case) for case in CASES]
    failed = sum(bool(r['problems']) for r in rows)
    result = dict(schema=1, boundary='actual production Backend.handle, no mount',
                  baseline=json.loads(PIN_FILE.read_text())['candidate'],
                  sourcePins=actual, oracle=oracle, cases=rows,
                  passed=len(rows)-failed, failed=failed,
                  contract='FAIL' if failed else 'PASS',
                  callback='UNPROVEN', mountedOrGameplayClaim=False)
    args.output.write_text(json.dumps(result, indent=2, sort_keys=True) + '\n')
    for row in rows:
        print('%s %s: expected errno=%s observed=%s %s' %
              (row['contract'], row['name'], row['expectedErrno'], row['errno'], '; '.join(row['problems'])))
    print('contract %s: %s passed, %s failed; oracle mutations %s rejected' %
          (result['contract'], result['passed'], failed, oracle['rejectedMutations']))
    return bool(failed)


if __name__ == '__main__':
    raise SystemExit(main())
