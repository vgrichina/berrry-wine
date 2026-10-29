#!/usr/bin/env python3
"""Direct-handler guard sensitivity and malformed-namespace termination checks.

Mutants execute only in memory; production and the retained contract stay intact.
"""
import errno
import hashlib
import json
from pathlib import Path
import types
import contract as c

HERE = Path(__file__).resolve().parent
source = c.SOURCE.read_text()
provenance = json.loads((HERE / 'provenance.json').read_text())
assert hashlib.sha256(source.encode()).hexdigest() == provenance['repairedSource']['sha256']
start = source.index('            moved=source[old]\n')
end = source.index('            if new in dest:\n', start)
guard = source[start:end]


def backend(text, name):
    m = types.ModuleType(name)
    exec(compile(text, str(c.SOURCE), 'exec'), m.__dict__)
    return m.Backend


actual = backend(source, 'production_guard_controls')
mutants = {
    'removed': source[:start] + source[end:],
    'wrong-errno': source.replace("errno.EINVAL,'rename directory cycle'",
                                  "errno.EIO,'rename directory cycle'"),
    'late-validation': (source[:start] + source[end:]).replace(
        '            dest[new]=source.pop(old)\n',
        '            moved=source[old]\n            dest[new]=source.pop(old)\n'
        + guard.replace('            moved=source[old]\n', '')),
    'overblock': source.replace('if child==newdir:raise', 'if True:raise'),
}
results = {}
for name, text in mutants.items():
    assert text != source
    cls = backend(text, 'mutant_' + name.replace('-', '_'))
    rows = [c.run_case(cls, op, case) for op in (12, 45) for case in c.CASES]
    failed = [f"op{r['op']}:{r['case']}" for r in rows if not r['passed']]
    assert failed, name
    for op in (12, 45):
        relevant = [r for r in rows if r['op'] == op and
                    ((r['case'] in c.INVALID) if name != 'overblock' else
                     r['case'] in ('unrelated-sibling', 'to-root', 'child-to-ancestor'))]
        assert all(not r['passed'] for r in relevant), (name, op)
    results[name] = dict(rejected=True, failedCases=failed)

checks = []
for op in (12, 45):
    for reject in (True, False):
        b, a, child, deep, sibling = c.fixture(actual)
        # Existing cycle and duplicate edges: traversal must terminate without
        # assuming a valid tree or recursing through Python's call stack.
        b.nodes[deep]['names'][b'back'] = a
        b.nodes[deep]['names'][b'alias'] = child
        before = c.snapshot(b)
        target = deep if reject else sibling
        expected = c.copy.deepcopy(before)
        if not reject:
            expected['nodes'][sibling]['names'][b'moved'] = expected['nodes'][1]['names'].pop(b'A')
        count = b.operations
        result, error = None, None
        try:
            result = b.handle(op, 1, c.wire(op, target, b'A', b'moved'))
        except OSError as exc:
            error = exc.errno
        assert not c.errors(error, result, c.snapshot(b), errno.EINVAL if reject else None,
                            expected, b.operations-count)
        checks.append(f'op{op}:malformed-cycle:{"reject-descendant" if reject else "allow-sibling"}')

    b, a, child, deep, sibling = c.fixture(actual)
    leaf = b.nodes[a]['names'][b'leaf']
    b.nodes[child]['names'][b'moved'] = leaf
    before = c.snapshot(b)
    count = b.operations
    try:
        b.handle(op, 1, c.wire(op, child, b'A', b'moved'))
    except OSError as exc:
        assert exc.errno == errno.EINVAL
    else:
        raise AssertionError('cycle replacement accepted')
    assert c.snapshot(b) == before and b.operations == count + 1
    checks.append(f'op{op}:reject-before-replacement-link-collection')

    b, a, child, deep, sibling = c.fixture(actual)
    before = c.snapshot(b)
    expected = c.copy.deepcopy(before)
    expected['nodes'][sibling]['names'][b'moved'] = expected['nodes'][a]['names'].pop(b'leaf')
    count = b.operations
    result = b.handle(op, a, c.wire(op, sibling, b'leaf', b'moved'))
    assert not c.errors(None, result, c.snapshot(b), None, expected, b.operations-count)
    checks.append(f'op{op}:regular-file-move')

report = dict(sourceSha256=provenance['repairedSource']['sha256'],
              mutantControls=results, additionalChecks=checks, passed=True,
              scope='Direct Backend.handle only; in-memory mutants; no mounts or kernel acceptance')
(HERE / 'controls-results.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report))
