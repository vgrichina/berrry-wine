"""Executable scoped staging recipe. Never executes API, guest or Git operations.

Apply to a task-owned staging directory already containing the immutable remote
input closure. The production API caller is tools/ricochet/production-commands.py
with this directory's producer-manifest.json and four original command receipts.
No historical evidence file is edited in place.
"""
import argparse
import hashlib
import importlib.util
import json
import pathlib

R = pathlib.Path(__file__).resolve().parents[3]
REPORT = pathlib.Path(__file__).resolve().parent
SERIAL_SHA = '983f8e627f3a5bb6eaf4ffaf664badf693621d5728808f0afb54bddb57ee2496'
ACCOUNTING_SHA256 = '6f260e812cdfa6c1695a73cf11fd7f9516c690e7f4c111737276bd7b6359d732'


def prepare(destination, immutable, secondary_root):
    destination = pathlib.Path(destination).resolve()
    p = R/'docs/reviews/ricochet-consumed-control-accounting-repair-oct27/integrate.py'
    assert hashlib.sha256(p.read_bytes()).hexdigest() == '9e41b139b423154a663e96a3f8e5617b65812c89a0d2e38f97ec7d025d76251b'
    s = importlib.util.spec_from_file_location('original_recipe', p)
    recipe = importlib.util.module_from_spec(s)
    s.loader.exec_module(recipe)
    assert hashlib.sha256((destination/'serial.py').read_bytes()).hexdigest() == SERIAL_SHA
    source = (destination/'remote-supervisor.py').read_bytes()
    assert hashlib.sha256(source).hexdigest() == recipe.SOURCE_SHA256
    pins = dict(immutable)
    for name in ('runtime-accounting.py', 'control-publisher.py'):
        data = (R/'tools/ricochet'/name).read_bytes()
        if name == 'runtime-accounting.py':
            assert hashlib.sha256(data).hexdigest() == ACCOUNTING_SHA256
        (destination/name).write_bytes(data)
        pins[str(destination/name)] = hashlib.sha256(data).hexdigest()
    manifest = json.loads((REPORT/'producer-manifest.json').read_text())
    assert pins[str(destination/'control-publisher.py')] == manifest['helperSHA256']
    # Fail closed on missing/changed staged inputs before generating the runner.
    for path, h in pins.items():
        assert hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest() == h, path
    transformed = recipe.transform(source, pins, str(secondary_root))
    (destination/'remote-supervisor.py').write_bytes(transformed)
    return dict(immutable=pins, runnerSHA256=hashlib.sha256(transformed).hexdigest(),
                producerManifestSHA256=hashlib.sha256((REPORT/'producer-manifest.json').read_bytes()).hexdigest(),
                caller='python3 -B '+str(R/'tools/ricochet/production-commands.py')+' PRODUCER --bundle '+str(REPORT))


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--destination', type=pathlib.Path, required=True)
    p.add_argument('--immutable', type=pathlib.Path, required=True)
    p.add_argument('--secondary-root', required=True)
    a = p.parse_args()
    print(json.dumps(prepare(a.destination, json.loads(a.immutable.read_text()), a.secondary_root), indent=2))
