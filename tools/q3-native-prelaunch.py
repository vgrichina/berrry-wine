"""Q3 prelaunch wrapper. Run --check-only before allocating a fresh runtime.

Use a fresh run directory containing runtime-pins.json.gz. Pin this wrapper,
the runtime script and both Python providers in that manifest. Historical run
scripts and evidence are inputs only; no allocation is performed here.
"""
import argparse
import ast
import gzip
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time


def identity(pid):
    stat = Path('/proc', str(pid), 'stat').read_text()
    return dict(pid=pid, start=stat[stat.rfind(')')+2:].split()[19])


def composition_providers(root):
    """Read the owning composition's literal pins without executing a runtime."""
    source = (root / 'tools/q3-native-driver-composition.cjs').read_text()
    declarations = dict(re.findall(r"const (consumerPath|adapterPath) = '([^']+)';", source))
    blocks = re.findall(r'const providers = Object\.freeze\(\{\n(.*?)\n\}\);', source, re.S)
    if len(blocks) != 1:
        raise ValueError('unsupported Q3 composition provider declaration')
    providers = {}
    for line in blocks[0].splitlines():
        match = re.fullmatch(r"\s*(?:'([^']+)'|\[(consumerPath|adapterPath)\]): '([0-9a-f]{64})',?", line)
        if not match:
            raise ValueError('unsupported Q3 composition provider entry')
        name = match[1] or declarations[match[2]]
        if name in providers:
            raise ValueError('duplicate Q3 composition provider')
        providers[name] = match[3]
    if not providers:
        raise ValueError('empty Q3 composition provider graph')
    return providers


def require_composition(root, pins):
    by_path = {pin['path']: pin for pin in pins['files']}
    composition = 'tools/q3-native-driver-composition.cjs'
    if composition not in by_path:
        raise ValueError('missing prelaunch provider: ' + composition)
    for name, expected in composition_providers(root).items():
        if name not in by_path:
            raise ValueError('missing Q3 composition provider: ' + name)
        if by_path[name]['sha256'] != expected:
            raise ValueError('Q3 composition provider pin mismatch: ' + name)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('root', type=Path)
    parser.add_argument('run', type=Path)
    parser.add_argument('runtime', type=Path)
    parser.add_argument('--check-only', action='store_true')
    args = parser.parse_args()
    root, run, runtime = (p.resolve() for p in (args.root, args.run, args.runtime))
    runtime.relative_to(root)
    sys.path.insert(0, str(root / 'tools'))
    # The provider is deliberately hyphenated: module-name import is incorrect.
    spec = importlib.util.spec_from_file_location(
        'q3_native_startup_barrier', root / 'tools/native-startup-barrier.py')
    barrier = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(barrier)
    manifest = run / 'startup-manifest.json'
    with manifest.open('xb') as stream:
        stream.write(gzip.decompress((run / 'runtime-pins.json.gz').read_bytes()))
    pins = json.loads(manifest.read_bytes())
    required = [Path(__file__).resolve(), runtime,
                root / 'tools/native-startup-barrier.py',
                root / 'tools/native_kernel_custody.py']
    paths = {p['path'] for p in pins['files']}
    for provider in required:
        if str(provider.relative_to(root)) not in paths:
            raise ValueError('missing prelaunch provider: ' + str(provider))
    require_composition(root, pins)
    receipt = run / 'startup-barrier.json'
    barrier.publish(root, manifest, receipt)
    # Bind the actual runtime's top-level imports, including native custody,
    # without executing its lock, environment, writes or supervisor call.
    source = runtime.read_text()
    tree = ast.parse(source, filename=str(runtime))
    compile(tree, str(runtime), 'exec')
    imports = ast.Module(body=[node for node in tree.body
                              if isinstance(node, (ast.Import, ast.ImportFrom))],
                         type_ignores=[])
    exec(compile(imports, str(runtime), 'exec'), {'__name__': 'q3_prelaunch_imports'})
    barrier.require(root, manifest, receipt)
    if args.check_only:
        print(json.dumps(dict(checkOnly=True, importsBound=True, spawn=False)))
        return
    with gzip.open(run / 'one-original-claim.json.gz', 'xb') as stream:
        stream.write(json.dumps(dict(at=time.time(), **identity(os.getpid()))).encode())
    with gzip.open(run / 'runtime-parent.log.gz', 'xb') as log:
        process = subprocess.Popen(['python3', str(runtime)], cwd=root,
                                   stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                   env={**os.environ, 'PYTHONDONTWRITEBYTECODE': '1'})
        target = identity(process.pid)
        with gzip.open(run / 'runtime-target.json.gz', 'xb') as stream:
            stream.write(json.dumps(target).encode())
        while chunk := process.stdout.read(65536):
            log.write(chunk)
            log.flush()
        status = process.wait()
    with gzip.open(run / 'runtime-parent-actual-wait.json.gz', 'xb') as stream:
        stream.write(json.dumps(dict(**target, status=status,
                                    stdioEOF=True, actualWait=True)).encode())
    raise SystemExit(status)


if __name__ == '__main__':
    main()
