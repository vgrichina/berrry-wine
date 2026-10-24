#!/usr/bin/env python3
"""Verify the pinned original Win32 distribution; static checks only."""
import argparse, hashlib, importlib.util, json, pathlib, stat, sys, zipfile

HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('maelstrom_pe', HERE / 'maelstrom-pe.py')
pe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pe)
rspec = importlib.util.spec_from_file_location('maelstrom_resources', HERE / 'maelstrom-resources.py')
resources = importlib.util.module_from_spec(rspec)
rspec.loader.exec_module(resources)
DEFAULT = HERE.parent / 'docs/re-notes/maelstrom-original-win32-20261024/manifest.json'

def digest(data): return hashlib.sha256(data).hexdigest()

def archive_check(path, manifest):
    assert path.stat().st_size == manifest['archive']['bytes'], 'archive size mismatch'
    assert digest(path.read_bytes()) == manifest['archive']['sha256'], 'archive SHA256 mismatch'
    with zipfile.ZipFile(path) as z:
        seen = set()
        total = 0
        for info in z.infolist():
            p = pathlib.PurePosixPath(info.filename)
            assert not p.is_absolute() and '..' not in p.parts and '\\' not in info.filename, 'unsafe archive path'
            assert not stat.S_ISLNK(info.external_attr >> 16), 'archive symlink'
            key = info.filename.lower()
            assert key not in seen, 'duplicate archive path'
            seen.add(key)
            assert info.file_size <= 25165824, 'archive per-file cap'
            total += info.file_size
        assert total == manifest['archive']['expanded_bytes'] <= 12582912, 'expanded byte guard'
        assert [i.filename for i in z.infolist()] == manifest['archive']['entries'], 'archive inventory mismatch'
        assert z.testzip() is None, 'archive CRC mismatch'

def bind(modules, system):
    boundaries = {}
    edges = []
    visited = set()

    def symbol(dll, name, chain=()):
        assert (dll, name) not in chain, 'export forwarder cycle'
        if dll in system:
            boundaries.setdefault(dll, set()).add(name)
            return
        assert dll in modules, 'missing non-system DLL: ' + dll
        exports = modules[dll]['exports']
        assert name in exports, 'unsatisfied export: ' + dll + '!' + name
        forward = exports[name]
        if forward:
            target, sep, target_name = forward.rpartition('.')
            assert sep, 'malformed forwarder'
            if not target.lower().endswith('.dll'): target += '.dll'
            symbol(target.lower(), target_name, chain + ((dll, name),))
        visit(dll)

    def visit(dll):
        if dll in visited: return
        visited.add(dll)
        for dependency, names in modules[dll]['imports'].items():
            for name in names: symbol(dependency, name)
            edges.append({'from': dll, 'to': dependency, 'symbols': len(names), 'packaged': dependency in modules})

    visit('maelstrom.exe')
    assert visited == set(modules), 'unreachable packaged PE module'
    return {'edges': edges, 'system_boundary': {k: sorted(v) for k, v in sorted(boundaries.items())}}

def verify(root, manifest):
    expected = manifest['files']
    actual = set()
    for p in root.rglob('*'):
        assert not p.is_symlink(), 'symlink in extraction'
        if p.is_file(): actual.add(p.relative_to(root).as_posix())
    assert actual == set(expected), 'missing/extra files: ' + repr(sorted(actual ^ set(expected)))
    modules = {}
    for name, record in expected.items():
        b = (root / name).read_bytes()
        assert len(b) == record['bytes'], 'file size mismatch: ' + name
        assert digest(b) == record['sha256'], 'file SHA256 mismatch: ' + name
        if name.lower().endswith(('.exe', '.dll')):
            modules[name.lower()] = pe.PE(b).record()
    assert modules == manifest['pe'], 'PE structure differs from pinned observations'
    closure = bind(modules, set(manifest['system_dlls']))
    assert closure == manifest['closure'], 'dependency closure differs'
    assert resources.inventory(root) == manifest['resources'], 'resource inventory differs'
    return {'status': 'PASS static packaged closure', 'files': len(expected),
            'modules': len(modules), 'packaged_symbol_bindings': sum(e['symbols'] for e in closure['edges'] if e['packaged']),
            'system_dlls': sorted(closure['system_boundary']), 'gameplay': 'NOT RUN'}

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--manifest', type=pathlib.Path, default=DEFAULT)
    p.add_argument('--archive', type=pathlib.Path, required=True)
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument('--root', type=pathlib.Path)
    g.add_argument('--extract-to', type=pathlib.Path, help='new destination, with archive + expanded overlap admitted first')
    a = p.parse_args()
    m = json.loads(a.manifest.read_text())
    archive_check(a.archive, m)
    if a.extract_to:
        assert not a.extract_to.exists(), 'extraction destination already exists'
        with zipfile.ZipFile(a.archive) as z: z.extractall(a.extract_to)
        a.root = a.extract_to / 'Maelstrom-3.0.6'
    print(json.dumps(verify(a.root, m), sort_keys=True))

if __name__ == '__main__':
    try: main()
    except (AssertionError, OSError, ValueError, KeyError, zipfile.BadZipFile) as e:
        print('REJECT: ' + str(e), file=sys.stderr)
        sys.exit(1)
