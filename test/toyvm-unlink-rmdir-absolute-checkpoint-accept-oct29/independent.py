#!/usr/bin/env python3
"""Independent exact-source removal acceptance. No predecessor oracle imports."""
import copy
import errno
import hashlib
import json
import pathlib
import stat
import struct
import types

HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parent.parent
DISPATCH = json.loads((HERE / 'current-dispatch.json').read_text())
BACKEND = 'test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py'

def digest(data):
    return hashlib.sha256(data).hexdigest()

def packed(value):
    if isinstance(value, bytes): return {'bytesHex': value.hex()}
    if isinstance(value, bytearray): return {'bytearrayHex': value.hex()}
    if isinstance(value, pathlib.Path): return str(value)
    if isinstance(value, dict): return [[packed(k), packed(v)] for k, v in value.items()]
    if isinstance(value, (list, tuple)): return [packed(v) for v in value]
    return value

def state(b):
    return copy.deepcopy({k: v for k, v in vars(b).items() if k != 'operations'})

def state_hash(s):
    return digest(json.dumps(packed(s), sort_keys=True).encode())

def load(source):
    module = types.ModuleType('independent_pinned_backend')
    module.__file__ = str(REPO / BACKEND)
    exec(compile(source, str(REPO / BACKEND), 'exec'), module.__dict__)
    return module.Backend

def charge(node):
    return 4096 + ((len(node['data']) + 4095) // 4096) * 4096

class Counterexample(Exception):
    def __init__(self, evidence): self.evidence = evidence

def call(b, op, parent, body, expected_errno, expected, label, rows):
    before = state(b); operations = b.operations
    answer = None; observed = 0; unexpected = None
    try: answer = b.handle(op, parent, body)
    except OSError as exc: observed = exc.errno
    except Exception as exc: unexpected = repr(exc)
    after = state(b)
    errors = []
    if unexpected is not None: errors.append("unexpected-exception")
    if observed != expected_errno: errors.append('errno')
    if after != expected: errors.append('full-state')
    if b.operations != operations + 1: errors.append('operations')
    if expected_errno == 0 and answer != b'': errors.append('success-answer')
    row = dict(case=label, opcode=op, parent=parent, bodyHex=body.hex(),
               expectedErrno=expected_errno, observedErrno=observed,
               beforeSHA256=state_hash(before), afterSHA256=state_hash(after),
               expectedSHA256=state_hash(expected), operationsDelta=b.operations-operations,
               errors=errors, unexpectedException=unexpected)
    if errors:
        row.update(before=packed(before), after=packed(after), expected=packed(expected))
        raise Counterexample(row)
    rows.append(row)

def fixture(Backend, context, kind, size, opens, children=False):
    b = Backend(HERE / 'never-mounted', live_limit=1048576, write_limit=1048576, file_limit=65536)
    def directory(parent, name):
        return struct.unpack_from('<Q', b.handle(9, parent, struct.pack('<II', 0o700, 0) + name + b'\0'))[0]
    sibling = directory(1, b'sibling')
    if context == 'root': parent = 1
    elif context == 'cross-parent': parent = directory(1, b'other')
    else: parent = directory(directory(1, b'ancestor'), b'nested')
    # Identical names in a separate parent must survive every removal.
    directory(sibling, b'victim,\xff')
    name = b'victim,\xff'
    if kind == 'missing': return b, parent, name, None
    if kind == 'dir': target = directory(parent, name)
    else:
        answer = b.handle(35, parent, struct.pack('<IIII', 0, stat.S_IFREG | 0o600, 0, 0) + name + b'\0')
        target = struct.unpack_from('<Q', answer)[0]
        # CREATE adds an open handle; close it before selecting the test count.
        assert b.handle(18, target, struct.pack('<Q', target)) == b''
        if size:
            payload = bytes((i * 17 + 31) % 256 for i in range(size))
            assert b.handle(16, target, struct.pack('<QQIIQII', target, 0, size, 0, 0, 0, 0) + payload) == struct.pack('<II', size, 0)
    if children:
        if kind == 'dir': directory(target, b'child')
        else:
            # Backend.create represents this state even though a kernel would not
            # issue child creation under a regular file. This is direct API only.
            b.create(target, b'child', stat.S_IFREG | 0o600)
    for _ in range(opens): b.handle(27 if kind == 'dir' else 14, target, b'')
    return b, parent, name, target

def exercise(Backend):
    rows = []
    for context in ('root', 'cross-parent', 'nested'):
        cases = []
        for opens in (0, 1, 2):
            for nonempty in (False, True): cases.append((10, 'dir', 0, opens, nonempty, errno.EISDIR))
            for size in (0, 1, 4096, 4097): cases.append((11, 'file', size, opens, False, errno.ENOTDIR))
            cases.append((11, 'file', 3, opens, True, errno.ENOTDIR))
            cases.append((11, 'dir', 0, opens, True, errno.ENOTEMPTY))
            for size in (0, 1, 4096, 4097): cases.append((10, 'file', size, opens, False, 0))
            cases.append((11, 'dir', 0, opens, False, 0))
        for op in (10, 11): cases.append((op, 'missing', 0, 0, False, errno.ENOENT))
        for op, kind, size, opens, children, expected_errno in cases:
            b, parent, name, target = fixture(Backend, context, kind, size, opens, children)
            label = f'{context}/op{op}/{kind}/size{size}/opens{opens}/children{children}'
            expected = state(b)
            if not expected_errno:
                del expected['nodes'][parent]['names'][name]
                expected['nodes'][target]['links'] -= 1
                if not opens:
                    expected['live'] -= charge(expected['nodes'][target])
                    del expected['nodes'][target]
            call(b, op, parent, name + b'\0', expected_errno, expected, label, rows)
            if not expected_errno and opens:
                # Verify every outstanding handle retains the unlinked inode and
                # the final release frees metadata plus rounded dense payload.
                for remaining in range(opens - 1, -1, -1):
                    expected = state(b)
                    expected['nodes'][target]['opens'] -= 1
                    expected['handles'] -= 1
                    if remaining == 0:
                        expected['live'] -= charge(expected['nodes'][target])
                        del expected['nodes'][target]
                    call(b, 29 if kind == 'dir' else 18, target, struct.pack('<Q', target), 0,
                         expected, label + f'/release-remaining{remaining}', rows)
    return rows

def main():
    actual = {}
    for name, pin in DISPATCH['sourcePins'].items():
        data = (REPO / name).read_bytes()
        actual[name] = dict(bytes=len(data), sha256=digest(data))
        assert actual[name] == pin, name
    source = (REPO / BACKEND).read_bytes()
    result = dict(candidate=DISPATCH['candidate'], sourcePins=actual,
                  scope='direct actual Backend.handle; no mounted callback claim',
                  fullState='all Backend instance fields except operations; exact bytearray comparison',
                  accounting='4096 metadata per inode plus 4096-rounded dense payload; open unlinked nodes retained to last release',
                  mutations=[])
    try: result['cases'] = exercise(load(source))
    except Counterexample as exc:
        result.update(contract='FAIL', counterexample=exc.evidence)
        (HERE / 'canonical.json').write_text(json.dumps(result, indent=2) + '\n')
        print(json.dumps(result['counterexample']))
        return 1
    text = source.decode()
    guards = [line for line in text.splitlines(True) if "raise OSError(errno.EISDIR,'unlink directory')" in line or "raise OSError(errno.ENOTDIR,'rmdir non-directory')" in line]
    assert len(guards) == 2
    u, r = guards
    mutations = {
        'absent-unlink': text.replace(u, ''),
        'absent-rmdir': text.replace(r, ''),
        'absent-both': text.replace(u, '').replace(r, ''),
        'wrong-unlink-errno': text.replace(u, u.replace('errno.EISDIR', 'errno.ENOTDIR')),
        'wrong-rmdir-errno': text.replace(r, r.replace('errno.ENOTDIR', 'errno.EISDIR')),
        'late-unlink': text.replace(u, '').replace("            return b''\n        if op in (12,45):", u + "            return b''\n        if op in (12,45):"),
        'late-rmdir': text.replace(r, '').replace("            return b''\n        if op in (12,45):", r + "            return b''\n        if op in (12,45):"),
        'overbroad-unlink': text.replace(u, "            if op==10:raise OSError(errno.EISDIR,'unlink directory')\n"),
        'overbroad-rmdir': text.replace(r, "            if op==11:raise OSError(errno.ENOTDIR,'rmdir non-directory')\n"),
    }
    for label, mutant in mutations.items():
        try: exercise(load(mutant))
        except Counterexample as exc:
            result['mutations'].append(dict(name=label, rejected=True, counterexample=exc.evidence))
        else: raise AssertionError('mutation survived: ' + label)
    assert (REPO / BACKEND).read_bytes() == source
    for name, pin in DISPATCH["sourcePins"].items():
        data = (REPO / name).read_bytes()
        assert dict(bytes=len(data), sha256=digest(data)) == pin, name
    result.update(contract='PASS', passed=len(result['cases']), productionSourceUnchanged=True,
                  rejectedMutations=len(result['mutations']))
    (HERE / 'canonical.json').write_text(json.dumps(result, indent=2) + '\n')
    print(f"PASS {result['passed']} independent removal/release checks; {len(result['mutations'])} source mutations rejected; production unchanged")
    return 0

if __name__ == '__main__': raise SystemExit(main())