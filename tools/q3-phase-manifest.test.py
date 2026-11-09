"""Test actual generated prelaunch staging and refusal before allocation."""
from pathlib import Path
import gzip
import importlib.util
import json
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
out = Path(sys.argv[1]).resolve()
assert out.is_relative_to(root / 'scratch/runs') and not out.exists()
out.mkdir(parents=True)
spec = importlib.util.spec_from_file_location('stage', root / 'tools/q3-phase-manifest.py')
stage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stage)
inputs = __import__('runpy').run_path(str(root / 'tools/q3-native-phase-inputs.py'))


def prepare(name):
    base = out / name
    base.mkdir()
    names = ['control.py', 'physical_gate.py', 'cancellation_gate.py', 'phase-input.py']
    inputs['materialize'](root, base)
    args = ['node', 'tools/q3-current-module.cjs', '--prepare', str(base / 'prepared'),
            '--foreign-closure-version', 'q3-current-foreign-a16fc87d4-44fc9a134-v1',
            '--checkpoint-observer-version', 'q3-checkpoint-b993419a5-v1',
            '--native-lifecycle-version', 'q3-native-lifecycle-foreign-v1',
            '--caller', str((base / 'phase-input.py').relative_to(root))]
    for name in names:
        args += ['--input', str((base / name).relative_to(root))]
    subprocess.run(args, cwd=root, check=True, capture_output=True)
    return base / 'prepared'


p = prepare('positive')
receipt = stage.stage(root, p)
assert receipt['passed'] and len(receipt['checks']) == 5
assert all(json.loads(r['stdout']) == dict(checkOnly=True, importsBound=True, spawn=False)
           for r in receipt['prelaunch'])
assert all(not (p.parent / phase / 'prepared/startup-manifest.json').exists()
           for phase in ('cancellation', 'original'))
(out / 'actual-prelaunch-staging.json').write_text(json.dumps(receipt, indent=2))

for mode in ('missing', 'gzip', 'seal', 'closure', 'collision'):
    p = prepare(mode)
    if mode == 'missing':
        (p / 'runtime-pins.json.gz').unlink()
    elif mode == 'gzip':
        target = p / 'runtime-pins.json.gz'
        target.chmod(0o644)
        target.write_bytes(target.read_bytes()[:-3])
    elif mode == 'seal':
        target = p / 'replacement-pinset-seal.json'
        target.chmod(0o644)
        value = json.loads(target.read_bytes())
        value['manifestSHA256'] = '0' * 64
        target.write_text(json.dumps(value))
    elif mode == 'closure':
        (p.parent / 'original/runtime.py').chmod(0o644)
        (p.parent / 'original/runtime.py').write_text('raise RuntimeError("must never run")')
    else:
        (p.parent / 'original/prepared').mkdir()
    try:
        stage.stage(root, p)
    except (AssertionError, FileNotFoundError, EOFError, gzip.BadGzipFile):
        pass
    else:
        raise AssertionError('accepted ' + mode)
    assert not (p.parent / 'cancellation/prepared').exists(), mode
print(json.dumps(dict(passed=True, actualPrelaunchPhases=2, independentManifests=5,
                      refusalControls=5, runtimeSpawns=0)))
