"""Bind relocated physical runtime helpers to exact provision targets before create.

No upload, allocation, launch or queue side effects. All paths are repository
relative after resolving the supplied root; hashes describe the actual bytes
that provision.py will read. Existing source/media pins retain their authority.
"""
from pathlib import Path, PurePosixPath
import copy, hashlib, re, subprocess

def relative(root, path):
    root = Path(root).resolve()
    p = Path(path)
    resolved = (p if p.is_absolute() else root / p).resolve()
    return resolved.relative_to(root).as_posix()

def relocate(pins, root, source, destination):
    source, destination = relative(root, source), relative(root, destination)
    assert source != destination, 'distinct helper directories required'
    result = copy.deepcopy(pins)
    matched = 0
    for pin in result['files']:
        name = relative(root, pin['path'])
        assert name == pin['path'], 'canonical relative target required'
        if name.startswith(source + '/'):
            name = destination + name[len(source):]
            data = (Path(root) / name).read_bytes()
            pin.update(path=name, size=len(data), sha256=hashlib.sha256(data).hexdigest(),
                       source=dict(kind='existing-path', path=name))
            matched += 1
    assert matched, 'no predecessor helpers relocated'
    result['physicalHelperClosure'] = dict(directory=destination, required=[Path(p['path']).name for p in result['files'] if p['path'].startswith(destination + '/')])
    return result

def validate(pins, root, destination, required, forbidden=(), runtime_environment=None):
    root = Path(root).resolve()
    destination = relative(root, destination)
    targets = {}
    for pin in pins['files']:
        name = relative(root, pin['path'])
        assert name == pin['path'], 'canonical relative target required'
        assert name not in targets, 'duplicate provision target: ' + name
        assert not any(name.startswith(relative(root, f) + '/') for f in forbidden), 'stale helper target: ' + name
        targets[name] = pin
    for name in required:
        assert destination + '/' + name in targets, 'missing physical upload target: ' + name
    checked = []
    for name, pin in targets.items():
        if not name.startswith(destination + '/'):
            continue
        assert pin['source']['kind'] == 'existing-path', 'physical helper required'
        assert relative(root, pin['source']['path']) == name, 'helper read/upload path differs'
        data = (root / name).read_bytes()
        assert len(data) == pin['size'] and hashlib.sha256(data).hexdigest() == pin['sha256'], 'physical hash mismatch: ' + name
        if name.endswith('.cjs'):
            subprocess.run(['node', '--check'], input=data, capture_output=True, check=True)
            source = data.decode()
            for call in re.finditer(r"require\(['\"]([^'\"]+)['\"]\)", source):
                dep = call[1]
                if not dep.startswith('.'):
                    continue
                target = relative(root, (root / name).parent / dep)
                if target not in targets:
                    # Exempt only this call, in a standalone simple ternary.
                    # Searching the whole file lets an inactive fixture import
                    # hide a second, unconditional import of the same target.
                    # Keep unsupported JS shapes closed rather than guessing
                    # their control flow (including multiline OR conditions).
                    guarded = re.search(
                        r"(?:\A|;)[ \t\r\n]*(?:(?:const|let|var)[ \t]+[A-Za-z_$][\w$]*[ \t]*=[ \t]*)?"
                        r"process\.env\.([A-Z_]+)[ \t]*\?[ \t]*\Z",
                        source[:call.start()])
                    assert guarded and runtime_environment is not None and guarded[1] in runtime_environment and not runtime_environment[guarded[1]], 'unprovisioned helper dependency: ' + target
        elif name.endswith('.py'):
            compile(data, name, 'exec')
        elif name.endswith('.js'):
            subprocess.run(['node', '--input-type=module', '--check'], input=data, capture_output=True, check=True)
        checked.append(name)
    return dict(passed=True, helperTargets=len(checked), required=len(required),
                sharedKeyDependency='tools/native-key-controls.cjs' in targets,
                provisionTargets=len(targets), sideEffects=False)
