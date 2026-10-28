#!/usr/bin/env python3
"""Read-only, no-copy retained-media validation; no guest/Tcl execution.

Run with the task CPU/wall/RSS/disk supervisor, Python DATA=128 MiB.
Arguments: canonical dispatch JSON and a NEW owned output directory.
"""
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import zipfile

SOURCE_SHA256 = '567a716c33e97d9c8547a02c77ff10dc1839308afb45c3fe9848effb60a3134d'
DISPATCH_SHA256 = 'b44b041779b4c0bc303edcb23428f2f311937c4a61c850cafbcf397022251c7f'


def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(65536), b''):
            h.update(block)
    return h.hexdigest()


def validate(dispatch_path, output):
    raw = dispatch_path.read_bytes()
    assert len(raw) == 1614 and hashlib.sha256(raw).hexdigest() == DISPATCH_SHA256
    dispatch = json.loads(raw)
    assert dispatch['task'] == 'tuxracer-integrated-original-media-validation-oct28'
    assert dispatch['candidate'] == 'ac4fdeb31c20d5bd869f201c9c051ad5bc663ca6'
    source = Path(__file__).resolve().parents[1] / 'tools/recovery/tuxracer-original-win32-recovery-oct28.py'
    assert source.stat().st_size == 20631 and sha(source) == SOURCE_SHA256
    spec = importlib.util.spec_from_file_location('production_recovery', source)
    tool = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(tool)
    archive = Path(dispatch['archive']['path'])
    inventory_path = Path(dispatch['inventory']['path'])
    directory = Path(dispatch['extracted'])
    for key, path in [('archive', archive), ('inventory', inventory_path)]:
        assert not path.is_symlink() and path.is_file()
        assert path.stat().st_size == dispatch[key]['bytes']
        assert sha(path) == dispatch[key]['sha256']
    output.mkdir(parents=True, exist_ok=False)

    def save(name, value):
        (output / name).write_text(json.dumps(value, indent=2) + '\n')

    inventory = json.loads(inventory_path.read_bytes())
    # Deliberately ignore predecessor complete/CRC flags: establish anew.
    rows = inventory['files']
    indexed = {row['path']: row for row in rows}
    assert len(indexed) == len(rows)
    original = tool.pin(archive)
    metadata = tool.metadata(archive, sum(row['bytes'] for row in rows))
    assert metadata == inventory['metadata']
    assert original == inventory['original']
    assert not directory.is_symlink() and directory.is_dir()
    actual = set()
    for p in directory.rglob('*'):
        assert not p.is_symlink()
        assert p.is_file() or p.is_dir()
        if p.is_file():
            actual.add(p.relative_to(directory).as_posix())
    assert actual == set(indexed), 'extracted/inventory file path mismatch'
    for name, row in indexed.items():
        p = directory / name
        assert p.stat().st_size == row['bytes'] and sha(p) == row['sha256'], name
    archive_paths = set()
    with zipfile.ZipFile(archive) as z:
        for info in z.infolist():
            name = tool.safe_name(info)
            if info.is_dir():
                assert (directory / name).is_dir(), name
                continue
            assert name in indexed and name not in archive_paths, name
            archive_paths.add(name)
            row = indexed[name]
            h, count = hashlib.sha256(), 0
            with z.open(info) as stream:
                for block in iter(lambda: stream.read(65536), b''):
                    h.update(block)
                    count += len(block)
            # A full zipfile stream read checks the original member CRC.
            assert count == info.file_size == row['bytes'] and h.hexdigest() == row['sha256'], name
    assert archive_paths == set(indexed)
    verified = dict(candidate=dispatch['candidate'], sourceSHA256=SOURCE_SHA256,
                    archive=dispatch['archive'], inventory=dispatch['inventory'],
                    extracted=str(directory), metadata=metadata,
                    filesVerified=len(rows), bytesVerified=sum(r['bytes'] for r in rows),
                    allFileSizesAndSHA256=True, allArchiveMemberCRC=True,
                    exactArchiveInventoryExtractedFilePaths=True,
                    inheritedCompleteFlagUsed=False, payloadCopied=False)
    save('input-verification.json', verified)
    # First behavioral acceptance boundary: exact integrated production closure.
    try:
        closure = tool.closure(directory, inventory)
    except tool.Rejected as error:
        save('closure-failure.json', dict(errorType=type(error).__name__, error=str(error),
                                        staticQualified=False, runtimeQualified=False))
        print('REJECT: ' + str(error))
        return 2
    save('closure.json', closure)
    # Tiny altered inventory uses original modules read-only, omits bundled DLLs.
    executable = next(r for r in rows if Path(r['path']).name.casefold() == 'tuxracer.exe')
    try:
        tool.closure(directory, {'files': [executable]})
    except tool.Rejected as error:
        assert 'unresolved non-system DLL imports' in str(error)
        dll_rejection = str(error)
    else:
        raise AssertionError('missing bundled DLL inventory accepted')
    tiny = output / 'literal-control'
    tiny.mkdir()
    (tiny / 'init.tcl').write_text('source missing.tcl\n')
    try:
        tool.literal_sources(tiny, {'files': [{'path': 'init.tcl'}]})
    except tool.Rejected as error:
        assert 'missing literal Tcl source' in str(error)
        tcl_rejection = str(error)
    else:
        raise AssertionError('missing literal Tcl source accepted')
    save('controls.json', dict(missingDLL=dll_rejection, missingLiteralTcl=tcl_rejection,
                               originalsModified=False))
    save('result.json', dict(staticQualified=True, runtimeQualified=False,
                            moduleCount=len(closure['modules']),
                            dataFileCount=len(closure['dataFiles']),
                            literalChecked=len(closure['literalSources']['checked']),
                            computedOrUnknown=len(closure['literalSources']['unknown']),
                            scope=closure['scope'], controlsPassed=2))
    print('PASS: retained original static closure; runtime/gameplay unqualified')
    return 0


if __name__ == '__main__':
    sys.exit(validate(Path(sys.argv[1]), Path(sys.argv[2])))
