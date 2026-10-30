#!/usr/bin/env python3
"""Focused static scanner acceptance; no Tcl, guest or subprocess execution.

Run production literal-sources CLI under the resource supervisor first, then
pass its stdout here. Media and inventory are read only; fixtures stay in task-dir.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import types


def load(path):
    spec = importlib.util.spec_from_file_location('production', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def check(module, task, text, targets=('child.tcl',)):
    with tempfile.TemporaryDirectory(prefix='syntax-', dir=task) as d:
        root = Path(d)
        (root / 'main.tcl').write_text(text)
        for target in targets:
            (root / target).write_text('# fixture\n')
        inventory = {'files': [{'path': p} for p in ('main.tcl',) + targets]}
        return module.literal_sources(root, inventory)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    for name in ('source', 'media-root', 'inventory', 'prior', 'cli-output', 'task-dir', 'result'):
        p.add_argument('--' + name, type=Path, required=True)
    a = p.parse_args()
    task = a.task_dir.resolve()
    assert task.is_dir() and task != Path('/')
    m = load(a.source)
    inventory = json.loads(a.inventory.read_text())
    assert hashlib.sha256(a.inventory.read_bytes()).hexdigest() == '9ac1ac56933cbeae45b0ada2162af298dbc768a5f82a0e2131faa218b0644dc5'
    # Exact production API and actual CLI must agree on the changed media boundary.
    actual = m.literal_sources(a.media_root, inventory)
    assert actual == json.loads(a.cli_output.read_text())
    old = json.loads(a.prior.read_text())['literalSources']
    old_checked = {(x['script'], x['literal']) for x in old['checked']}
    new_checked = {(x['script'], x['literal']) for x in actual['checked']}
    prefix = 'tuxracer-win32-0.61a/'
    assert new_checked - old_checked == {
        (prefix+'tuxracer_init.tcl', 'courses/course_idx.tcl'),
        (prefix+'courses/common/courseinit.tcl', 'tree_polyhedron.tcl'),
        (prefix+'courses/common/courseinit.tcl', 'tux_walk.tcl')}
    assert old_checked <= new_checked
    six = [x for x in old['unknown'] if 'unsupported or incomplete' in x.get('reason', '')]
    assert len(six) == 6
    remaining = [x for x in actual['unknown'] if 'unsupported or incomplete' in x.get('reason', '')]
    assert len(remaining) == 1 and remaining[0]['script'] == prefix+'courses/course_idx.tcl'
    assert remaining[0]['expression'].startswith('tux_open_courses [concat ')
    spans = []
    for finding in six:
        path = a.media_root / finding['script']
        text = path.read_text()
        first = finding['expression'].splitlines()[0]
        start = text.index(first)
        spans.append({'script': finding['script'], 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                      'firstMissingLine': text.count('\n', 0, start)+1, 'firstMissingText': first,
                      'literalSourceLines': [{'line': i, 'text': line} for i, line in enumerate(text.splitlines(), 1) if 'source ' in line],
                      'remainingSyntaxUnknown': finding['script'] == remaining[0]['script']})
    for spelling in ('[pwd]', '[tux_get_param forward_clip_distance]', '[glob -nocomplain *]'):
        r = check(m, task, 'set result '+spelling+'\nsource child.tcl\n')
        assert len(r['checked']) == 1 and len(r['unknown']) == 1
    # Substitution results are never promoted to source literals.
    for spelling in ('[pwd]', '[pwd]/child.tcl', '"[pwd]/child.tcl"', '$path'):
        r = check(m, task, 'source '+spelling+'\n')
        assert not r['checked'] and r['unknown']
    # Complex or incomplete brackets retain the conservative stop boundary.
    for spelling in ('[list [pwd]]', '[list $value]', '[list "x"]', '[list {x}]', '[pwd; pwd]', '[pwd', '[pwd\\\n]'):
        r = check(m, task, 'set result '+spelling+'\nsource child.tcl\n')
        assert not r['checked'] and any('unsupported' in x.get('reason', '') for x in r['unknown'])
    # A grouped control body is not scanned as an executed script.
    assert not check(m, task, 'if {1} {source child.tcl}\n')['checked']
    for target in ('../../outside.tcl', '/outside.tcl', 'C:/outside.tcl'):
        r = check(m, task, 'set result [pwd]\nsource '+target+'\n')
        assert not r['checked'] and len(r['unknown']) == 2
    try:
        check(m, task, 'set result [pwd]\nsource missing.tcl\n')
    except m.Rejected:
        pass
    else:
        raise AssertionError('missing literal did not reject')
    # Disable only the new recognition: the original-media witness must fail.
    source = a.source.read_text()
    marker = 'if bracket is None:'
    assert source.count(marker) == 1
    mutant = types.ModuleType('rejecting_mutant')
    exec(compile(source.replace(marker, 'if True:  # mutation: reject every bracket'), str(a.source), 'exec'), mutant.__dict__)
    witness = (a.media_root / (prefix+'tuxracer_init.tcl')).read_text()
    def observes_literal(module):
        return any(words == ['source', 'courses/course_idx.tcl'] for words, unknown in module.lexical_commands(witness))
    assert observes_literal(m) and not observes_literal(mutant)
    result = {'PASS': True, 'sourceSHA256': hashlib.sha256(a.source.read_bytes()).hexdigest(),
              'apiEqualsActualCLI': True, 'priorChecked': len(old_checked), 'checked': len(new_checked),
              'unknown': len(actual['unknown']), 'originalSix': spans, 'remainingSyntaxUnknown': remaining,
              'focusedControls': 'simple brackets; computed source UNKNOWN; complex/incomplete stop; bodies; unsafe/missing paths',
              'rejectingMutationKilled': True, 'runtimeExecuted': False}
    a.result.write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps({k: v for k, v in result.items() if k not in ('originalSix','remainingSyntaxUnknown')}))


if __name__ == '__main__':
    main()
