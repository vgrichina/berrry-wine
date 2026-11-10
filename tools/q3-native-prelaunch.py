"""Q3 prelaunch wrapper. Run --check-only before allocating a fresh runtime.

Use a fresh run directory containing runtime-pins.json.gz. Pin this wrapper,
the runtime script and both Python providers in that manifest. Historical run
scripts and evidence are inputs only; no allocation is performed here.
"""
import argparse
import ast
import gzip
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import runpy
import subprocess
import sys
import time

CHECKPOINT_VERSION = 'q3-checkpoint-b993419a5-v1'
CHECKPOINT_PROVIDERS = {
    'tools/q3-checkpoint-observer.py': 'c4e9a8fb96359877416be3268786199606270104efc8aacf00df305d8f8c2957',
    'tools/q3-cancellation-stream-eof.py': '416dc166d4c92fb59ddb254bd4ffd312f02aea8a6ba244e8a5cd67aadf049f47',
    'tools/q3-native-launch-client.py': 'd3b9927b17372e74ef0abc8f43b59e709b1822d4927d7793c0153b07cda6509d',
}


def require_checkpoint(root, pins):
    """Explicit version only; verify and import the complete Python closure.

    Imported providers define functions only. No child, custody supervisor or
    browser is executed. Ordinary pinsets keep the existing separate EOF path.
    """
    version = pins.get('checkpointObserverVersion')
    if version is None:
        return
    if version != CHECKPOINT_VERSION:
        raise ValueError('unsupported Q3 checkpoint observer version')
    by_path = {p['path']: p for p in pins['files']}
    for name, expected in CHECKPOINT_PROVIDERS.items():
        if name not in by_path or by_path[name]['sha256'] != expected:
            raise ValueError('missing/stale Q3 checkpoint provider: ' + name)
        data = (root/name).read_bytes()
        if len(data) != by_path[name]['size'] or hashlib.sha256(data).hexdigest() != expected:
            raise ValueError('changed Q3 checkpoint provider: ' + name)
        namespace = runpy.run_path(str(root/name), run_name='q3_prelaunch_checkpoint_import')
        # A runpy parse alone would miss the stream helper's deferred client.
        if name.endswith('q3-cancellation-stream-eof.py'):
            namespace['client'](root)
    caller = pins.get('checkpointCaller')
    if not isinstance(caller, str) or caller not in by_path:
        raise ValueError('missing generated Q3 checkpoint caller')
    for name in ('control.py', 'physical_gate.py', 'cancellation_gate.py'):
        if str(Path(caller).with_name(name)) not in by_path:
            raise ValueError('missing Q3 checkpoint caller transitive input: ' + name)
    compile((root/caller).read_bytes(), caller, 'exec')


def identity(pid):
    stat = Path('/proc', str(pid), 'stat').read_text()
    return dict(pid=pid, start=stat[stat.rfind(')')+2:].split()[19])


def composition_providers(root):
    """Read the owning composition's literal pins without executing a runtime."""
    source = (root / 'tools/q3-native-driver-composition.cjs').read_text()
    declarations = dict(re.findall(r"const (consumerPath|adapterPath|fixturePath) = '([^']+)';", source))
    blocks = re.findall(r'const providers = Object\.freeze\(\{\n(.*?)\n\}\);', source, re.S)
    if len(blocks) != 1:
        raise ValueError('unsupported Q3 composition provider declaration')
    providers = {}
    for line in blocks[0].splitlines():
        match = re.fullmatch(r"\s*(?:'([^']+)'|\[(consumerPath|adapterPath|fixturePath)\]): '([0-9a-f]{64})',?", line)
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
    providers = composition_providers(root)
    foreign = pins.get('foreignClosureVersion')
    if foreign is not None:
        if foreign != 'q3-current-foreign-a16fc87d4-44fc9a134-v1' or pins.get('moduleVersion') != foreign:
            raise ValueError('unsupported Q3 foreign closure version')
        # The explicit published route selects foreign policy and the published
        # 4a814ed4f custody entry gate. No generic provider-drift exception.
        # The full byte barrier below still verifies every staged provider.
        providers.update({
            'tools/native_kernel_custody.py': 'e32418fcab89681c799c627353303a73e062e542c5391d978900c32385146b2e',
            'lib/redline-startup-admission.js': 'bd39c71fb2a331554d74568cca1916fb0750fa19a11bef1614d66456735a875f',
            'lib/redline-current-startup-v1.js': '3b32d2e7c24fb0718f05022d47a8884bbe7e93ea0568c6868829563463cadd50',
            'lib/quake2-browser-load-observer.js': '45cd7e009fa5718fff4ad6c8a7080f439eae993292fab63b920c2eb49a2f4fb6',
            'lib/quake2-current-browser-policy-v1.js': '3a5498e183a04444c5a55888a7cbfac482ef93dc209b7781c5f16633263ffbe2',
        })
    for name, expected in providers.items():
        if name not in by_path:
            raise ValueError('missing Q3 composition provider: ' + name)
        if by_path[name]['sha256'] != expected:
            raise ValueError('Q3 composition provider pin mismatch: ' + name)
    # The retained caller resolves httpPins through its actual fixture server
    # before spawning Chrome. A staged PE alone does not prove that URL works.
    pe = by_path['test/binaries/calc.exe']
    fixture_http = [pin for pin in pins.get('httpPins', [])
                    if pin.get('url') == '/test/binaries/calc.exe']
    if fixture_http != [dict(url='/test/binaries/calc.exe',
                             size=pe['size'], sha256=pe['sha256'])]:
        raise ValueError('missing/changed Q3 fixture PE HTTP pin')


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
                root / 'tools/native_kernel_custody.py',
                root / 'tools/q3-current-module.cjs',
                root / 'tools/q3-native-launch-client.py',
                root / 'tools/q3-cancellation-stream-eof.py']
    paths = {p['path'] for p in pins['files']}
    for provider in required:
        if str(provider.relative_to(root)) not in paths:
            raise ValueError('missing prelaunch provider: ' + str(provider))
    require_composition(root, pins)
    require_checkpoint(root, pins)
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
    pump = runpy.run_path(str(root / 'tools/q3-cancellation-stream-eof.py'))
    if args.check_only:
        print(json.dumps(dict(checkOnly=True, importsBound=True, spawn=False)))
        return
    with gzip.open(run / 'one-original-claim.json.gz', 'xb') as stream:
        stream.write(json.dumps(dict(at=time.time(), **identity(os.getpid()))).encode())
    with gzip.open(run / 'runtime-parent.log.gz', 'xb') as log:
        process = subprocess.Popen(['python3', str(runtime)], cwd=root,
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                   env={**os.environ, 'PYTHONDONTWRITEBYTECODE': '1'})
        target = identity(process.pid)
        with gzip.open(run / 'runtime-target.json.gz', 'xb') as stream:
            stream.write(json.dumps(target).encode())
        waited = pump['drain_streams'](process, log)
        status = waited['status']
    with gzip.open(run / 'runtime-parent-actual-wait.json.gz', 'xb') as stream:
        stream.write(json.dumps(dict(**target, **waited)).encode())
    raise SystemExit(status)


if __name__ == '__main__':
    main()
