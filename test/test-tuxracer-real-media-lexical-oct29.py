#!/usr/bin/env python3
"""Static retained-media API qualification; run under the owned supervisor.

No ZIP extraction, archive census, Tcl evaluation or guest execution.
Usage: python3 test/test-tuxracer-real-media-lexical-oct29.py OUTPUT
"""
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

DISPATCH = Path('/home/user/wine-assembly/scratch/usage-watch/tuxracer-admitted-workdir-real-media-oct29-dispatch.json')
SOURCE_SHA = '69257615178adda7568036fc49e2f20b4ca602c6d3b734f1238caf6143021b17'

def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda: f.read(65536), b''): h.update(b)
    return h.hexdigest()

def main():
    output = Path(sys.argv[1]).resolve()
    own = Path('/tmp/tuxracer-admitted-workdir-real-media-oct29')
    assert own in output.parents
    output.mkdir(exist_ok=False)
    def save(name, value):
        b = json.dumps(value, indent=2).encode()
        assert len(b) <= 1048576
        (output / name).write_bytes(b)
    assert DISPATCH.stat().st_size == 1455
    assert sha(DISPATCH) == '00f067d7bb01d67022392c7f97550ce22b7d6d2c10a70b453bcc21c9af02998a'
    dispatch = json.loads(DISPATCH.read_bytes())
    source = Path(__file__).resolve().parents[1] / dispatch['source']['path']
    assert source.stat().st_size == 25097 and sha(source) == SOURCE_SHA
    spec = importlib.util.spec_from_file_location('production', source)
    tool = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(tool)
    for key in ('archive', 'inventory'):
        p = Path(dispatch[key]['path'])
        assert p.is_file() and not p.is_symlink()
        assert p.stat().st_size == dispatch[key]['bytes'] and sha(p) == dispatch[key]['sha256']
    inventory = json.loads(Path(dispatch['inventory']['path']).read_bytes())
    directory = Path(dispatch['extracted'])
    assert directory.is_dir() and not directory.is_symlink()
    # Reuse the pinned prior archive census; establish retained-input freshness.
    # Do not rebuild inventory or decompress/read archive members again.
    rows = inventory['files']
    expected = {r['path'] for r in rows}
    assert len(expected) == len(rows) == 158
    actual = set()
    for p in directory.rglob('*'):
        assert not p.is_symlink() and (p.is_file() or p.is_dir())
        if p.is_file(): actual.add(p.relative_to(directory).as_posix())
    assert actual == expected
    for row in rows:
        p = directory / row['path']
        assert p.stat().st_size == row['bytes'] and sha(p) == row['sha256'], row['path']
    save('inputs.json', dict(main=dispatch['main'], source=dispatch['source'], archive=dispatch['archive'], inventory=dispatch['inventory'], extracted=str(directory), filesFresh=len(rows), bytesFresh=sum(r['bytes'] for r in rows), priorValidationCommit=dispatch['priorValidationCommit'], archiveCensusReused=True, mediaCopied=False))
    # First behavioral boundary: exact pinned production static-closure API.
    try:
        report = tool.closure(directory, inventory)
    except tool.Rejected as e:
        save('first-rejection.json', dict(error=str(e), sourceSHA256=SOURCE_SHA, staticQualified=False, runtimeQualified=False))
        print('REJECT: ' + str(e))
        return 2
    save('closure.json', report)
    print(json.dumps(dict(modules=len(report['modules']), dataFiles=len(report['dataFiles']), checked=len(report['literalSources']['checked']), unknown=len(report['literalSources']['unknown']), runtimeQualified=False)))
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
