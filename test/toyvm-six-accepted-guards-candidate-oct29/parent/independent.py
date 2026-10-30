#!/usr/bin/env python3
"""Independent wire-body acceptance of the pinned direct Backend.handle boundary."""
import copy
import errno
import hashlib
import importlib.util
import json
import pathlib
import stat
import struct
import types

HERE = pathlib.Path(__file__).resolve().parent
REPO = pathlib.Path('/tmp/toyvm-six-accepted-guards-candidate-oct29/repo')
SOURCE = REPO / 'test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py'
CANDIDATE = 'a09932adab2510eb1bb1367617708a0b459412b8'

def pin(path):
    b = path.read_bytes()
    return dict(bytes=len(b), sha256=hashlib.sha256(b).hexdigest())

def wire(op, name):
    # Linux fuse_create_in: flags, mode, umask, open_flags; fuse_mkdir_in: mode, umask.
    return (struct.pack('<IIII', 0, 0o652, 0, 0) if op == 35 else
            struct.pack('<II', 0o753, 0)) + name + b'\0'

def state(b):
    # Includes full namespace, bytes, metadata, counters/limits and sticky failure.
    return copy.deepcopy({k: v for k, v in vars(b).items() if k != 'operations'})

class Counterexample(AssertionError):
    pass

def require(ok, detail):
    if not ok:
        raise Counterexample(detail)

def good(b, op, parent, name):
    before = state(b)
    ino = b.next
    response = b.handle(op, parent, wire(op, name))
    expected = copy.deepcopy(before)
    mode = (stat.S_IFREG | 0o652) if op == 35 else (stat.S_IFDIR | 0o753)
    expected['nodes'][ino] = dict(mode=mode, data=bytearray(), names={}, links=1, opens=int(op == 35))
    expected['nodes'][parent]['names'][name] = ino
    expected['next'] += 1
    expected['live'] += 4096
    expected['peak'] = max(expected['peak'], expected['live'])
    expected['handles'] += int(op == 35)
    require(state(b) == expected, dict(case='valid-state', op=op, parent=parent))
    require(len(response) == (144 if op == 35 else 128), dict(case='reply-size', op=op))
    require(struct.unpack_from('<Q', response)[0] == ino and
            struct.unpack_from('<Q', response, 40)[0] == ino and
            struct.unpack_from('<I', response, 100)[0] == mode, dict(case='reply-metadata', op=op))
    if op == 35:
        require(struct.unpack_from('<QII', response, 128) == (ino, 1, 0), dict(case='create-handle'))
    return ino

def bad(b, op, parent, name, expected, label):
    before = state(b)
    calls = b.operations
    try:
        b.handle(op, parent, wire(op, name))
    except Exception as exc:
        actual = dict(type=type(exc).__name__, errno=getattr(exc, 'errno', None))
    else:
        actual = dict(type='success', errno=None)
    require(actual['errno'] == expected and state(b) == before and b.operations == calls + 1,
            dict(case=label, op=op, parent=parent, nameHex=name.hex(), expectedErrno=expected,
                 actual=actual, statePreserved=state(b) == before,
                 liveBefore=before['live'], liveAfter=b.live,
                 nextBefore=before['next'], nextAfter=b.next,
                 failureBefore=before['failure'], failureAfter=b.failure))

def exercise(cls):
    rows = []
    for op in (35, 9):
        b = cls(HERE / 'never-mounted', live_limit=131072)
        directory = good(b, 9, 1, b'directory')
        file = good(b, 35, 1, b'payload')
        payload = b'nonempty\x00payload\xff'
        b.handle(16, file, struct.pack('<QQIIQII', file, 0, len(payload), 0, 0, 0, 0) + payload)
        stale = good(b, 9, 1, b'removed-directory')
        b.handle(11, 1, b'removed-directory\0')
        require(stale not in b.nodes, dict(case='stale-fixture'))
        for parent in (1, directory):
            good(b, op, parent, b'new-' + str(op).encode())
            rows.append(dict(case='valid-directory', op=op, parent=parent))
        # Exercise both unfilled and exactly full domains: parent checks must precede charging.
        for full in (False, True):
            b.live_limit = b.live if full else 131072
            for parent, error, label in ((file, errno.ENOTDIR, 'regular-file-parent'),
                                         (stale, errno.ENOENT, 'collected-directory-parent'),
                                         (999999, errno.ENOENT, 'unknown-parent')):
                bad(b, op, parent, b'child', error, label)
                rows.append(dict(case=label, op=op, full=full))
            for name in (b'payload', b'directory'):
                bad(b, op, 1, name, errno.EEXIST, 'existing-name')
                rows.append(dict(case='existing-name', op=op, nameHex=name.hex(), full=full))
        b.live_limit = 131072
        good(b, op, directory, b'after-errors')
        rows.append(dict(case='valid-after-errors', op=op))
    return rows

def main():
    pins = json.loads((HERE / 'source-pins.json').read_text())
    for name, expected in pins.items():
        assert pin(REPO / name) == expected, name
    identity = json.loads((HERE / 'identity-update.json').read_text())
    assert pin(HERE / 'original-contract.py') == identity['originalContract']
    assert pin(HERE / 'baseline-results.json') == identity['baselineResults']
    spec = importlib.util.spec_from_file_location('pinned_production_backend', SOURCE)
    production = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(production)
    try:
        rows = exercise(production.Backend)
    except Exception as exc:
        (HERE / 'first-counterexample.json').write_text(json.dumps(dict(type=type(exc).__name__, detail=exc.args), indent=2)+'\n')
        raise
    text = SOURCE.read_text()
    missing = "        if n is None:raise OSError(errno.ENOENT,'parent missing')\n"
    nondir = "        if not stat.S_ISDIR(n['mode']):raise OSError(errno.ENOTDIR,'parent non-directory')\n"
    charge = '        self.charge(4096);ino=self.next;self.next+=1\n'
    assert text.count(missing) == text.count(nondir) == text.count(charge) == 1
    mutants = {
        'removed-missing-guard': text.replace(missing, ''),
        'removed-directory-guard': text.replace(nondir, ''),
        'charge-before-missing-guard': text.replace('        n=self.nodes.get(parent)\n',
            '        self.charge(4096)\n        n=self.nodes.get(parent)\n').replace(charge, '        ino=self.next;self.next+=1\n'),
        'directory-guard-after-allocation': text.replace(nondir, '').replace(charge, charge+nondir),
    }
    controls = []
    (HERE / 'independent-mutants').mkdir()
    for name, content in mutants.items():
        path = HERE / 'independent-mutants' / (name+'.py')
        path.write_text(content)
        module = types.ModuleType('owned_mutant')
        exec(compile(content, str(path), 'exec'), module.__dict__)
        try:
            exercise(module.Backend)
        except Counterexample as exc:
            controls.append(dict(name=name, rejected=True, source=pin(path), firstCounterexample=exc.args[0]))
        else:
            raise AssertionError('surviving mutant '+name)
    for name, expected in pins.items():
        assert pin(REPO / name) == expected, name
    result = dict(PASS=True, candidate=CANDIDATE, sourcePins=pins, cases=rows,
                  mutations=controls, scope='direct Backend.handle CREATE35/MKDIR9 wire bodies; no mount or kernel execution',
                  staleParentContract='ENOENT is an internal stale-node expectation; public kernel behavior is unqualified',
                  stateComparison='all Backend instance fields except operations, checked separately for one dispatch',
                  remainingGate='combined repairs, caller backend pin, full CLI qualification')
    (HERE / 'independent-results.json').write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps(dict(PASS=True, independentCases=len(rows), removedOrMisorderedMutantsRejected=len(controls))))

if __name__ == '__main__':
    main()
