#!/usr/bin/env python3
"""Run the retained strict oracle with an explicit repaired identity, then guards."""
import copy
import errno
import hashlib
import importlib.util
import json
import pathlib
import struct
import sys

HERE = pathlib.Path(__file__).resolve().parent
REPO = pathlib.Path('/tmp/toyvm-six-guards-compatible-fixture-continuation-oct29/repo')
BACKEND = 'test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py'
REPAIRED = {'bytes': 12482, 'sha256': 'cc2dc7ab2f9b5d1b84b755c61e7a6ffc3e226d52ffe008edf7ace5310cbdc105'}

def pin(p):
    blob = p.read_bytes()
    return dict(bytes=len(blob), sha256=hashlib.sha256(blob).hexdigest())

def main():
    identity = json.loads((HERE / 'identity-update.json').read_text())
    assert identity['candidate'] == '545a51f4a11ac2e88293ac2c8dcc6be3b9ceb124'
    assert identity['repairedBackend'] == REPAIRED == pin(REPO / BACKEND)
    assert pin(HERE / 'original-contract.py') == identity['originalContract']
    assert pin(HERE / 'baseline-results.json') == identity['baselineResults']
    spec = importlib.util.spec_from_file_location('original_contract', HERE / 'original-contract.py')
    c = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(c)
    assert c.PINS == identity['originalSourcePins']
    c.PINS = copy.deepcopy(identity['originalSourcePins'])
    c.PINS[BACKEND] = REPAIRED
    # main's --strict path and every behavioral assertion remain byte-exact.
    assert '--strict' in sys.argv, 'strict execution required'
    assert c.main() == 0
    results = json.loads((HERE / 'results.json').read_text())
    assert all(r['passed'] for r in results['results'])
    text = c.SOURCE.read_text()
    cls = c.load(text)
    supplementary = []
    for op in (35, 9):
        for name in (b'', b'.', b'..', b'a/b', b'x' * 256):
            f = c.Fixture(cls)
            f.reject(op, 1, name, errno.EINVAL)
            supplementary.append(dict(case='valid-name-preserved', op=op, nameHex=name.hex(), passed=True))
        for kind in ('missing', 'nondirectory'):
            f = c.Fixture(cls)
            parent = 999 if kind == 'missing' else f.create(35, 1, b'file')
            f.b.live_limit = f.b.live
            f.reject(op, parent, b'child', errno.ENOENT if kind == 'missing' else errno.ENOTDIR)
            supplementary.append(dict(case='parent-before-full-budget', op=op, kind=kind, passed=True))

    # A populated namespace, live payload, and open handle must all survive errors.
    b = cls(HERE / 'never-mounted', live_limit=65536)
    file = struct.unpack_from('<Q', b.handle(35, 1, c.request(35, b'file')))[0]
    directory = struct.unpack_from('<Q', b.handle(9, 1, c.request(9, b'dir')))[0]
    b.handle(35, directory, c.request(35, b'leaf'))
    payload = b'preserved payload'
    write = struct.pack('<QQIIQII', file, 0, len(payload), 0, 0, 0, 0) + payload
    b.handle(16, file, write)
    assert b.live == b.peak == 20480 and b.written == len(payload) and b.handles == 2

    def rejected(op, parent, data, expected, label):
        before = c.snapshot(b)
        calls = b.operations
        try:
            b.handle(op, parent, data)
        except OSError as exc:
            assert exc.errno == expected, (label, exc.errno)
        else:
            raise AssertionError('accepted ' + label)
        assert c.snapshot(b) == before and b.operations == calls + 1, label
        supplementary.append(dict(case=label, passed=True))

    for op in (35, 9):
        rejected(op, file, c.request(op, b'child'), errno.ENOTDIR, str(op)+'-populated-file-parent')
        rejected(op, 999, c.request(op, b'child'), errno.ENOENT, str(op)+'-populated-missing-parent')
    rejected(10, 1, b'dir\0', errno.EISDIR, 'unlink-directory-guard')
    rejected(11, 1, b'file\0', errno.ENOTDIR, 'rmdir-file-guard')
    rejected(11, 1, b'dir\0', errno.ENOTEMPTY, 'rmdir-nonempty-guard')
    rejected(10, 1, b'missing\0', errno.ENOENT, 'unlink-missing-guard')
    b.handle(10, 1, b'file\0')
    assert b.live == 20480 and b.nodes[file]['links'] == 0 and b.handles == 2
    b.handle(18, file, struct.pack('<Q', file))
    assert file not in b.nodes and b.live == 12288 and b.peak == 20480 and b.handles == 1
    assert b.written == len(payload) and b.failure is None
    supplementary.append(dict(case='unlinked-open-payload-collection', passed=True))

    missing = "        if n is None:raise OSError(errno.ENOENT,'parent missing')\n"
    directory_guard = "        if not stat.S_ISDIR(n['mode']):raise OSError(errno.ENOTDIR,'parent non-directory')\n"
    assert text.count(missing) == text.count(directory_guard) == 1
    mutants = {
        'missingparent-guard': text.replace('n=self.nodes.get(parent)', 'n=self.nodes[parent]').replace(missing, ''),
        'nondirectory-guard': text.replace(directory_guard, ''),
        'late-directory-check': text.replace(directory_guard, '').replace("        n['names'][name]=ino\n", "        n['names'][name]=ino\n" + directory_guard),
        'late-parent-check': text.replace('        n=self.nodes.get(parent)\n', '        self.charge(4096)\n        n=self.nodes.get(parent)\n').replace('        self.charge(4096);ino=self.next;', '        ino=self.next;'),
    }
    mutations = []
    for name, mutant in mutants.items():
        failures = []
        mcls = c.load(mutant)
        for op in (35, 9):
            for kind in ('missing', 'nondirectory'):
                try:
                    c.invalid_parent(mcls, op, kind)
                except AssertionError:
                    failures.append(str(op)+'-'+kind)
        assert failures, 'surviving mutant ' + name
        mutations.append(dict(name=name, rejected=True, failingCases=failures,
                              sha256=hashlib.sha256(mutant.encode()).hexdigest()))
    results.update(candidate=identity['candidate'], productionUnchanged=False,
                   identityUpdate='identity-update.json', supplementary=supplementary,
                   parentMutations=mutations, strict=True,
                   missingParentErrno='proposed internal direct-handler contract; not proven public kernel requirement')
    (HERE / 'results.json').write_text(json.dumps(results, indent=2)+'\n')
    # Generated collision source copies are reproducible from the retained oracle.
    for p in (HERE / 'mutants').glob('*.py'):
        p.unlink()
    (HERE / 'mutants').rmdir()
    print(json.dumps(dict(PASS=True, parentCases=4, collisions=8, validCreations=8,
                         collisionMutationsRejected=4, parentMutationsRejected=len(mutations),
                         supplementary=len(supplementary))))

if __name__ == '__main__':
    main()
