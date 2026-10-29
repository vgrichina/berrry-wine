#!/usr/bin/env python3
"""Focused controls for the unchanged production loader; never invoke the adapter."""
import argparse
import hashlib
import importlib.util
import inspect
import json
import pathlib
import shutil
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
CALLER = 'test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py'
PINS = {
    'toyvm-kernel-profile-accounting-backend-oct28/supervise_accounted.py': '5ac463e9168b1162b47b784e919a6f71830d5581c5fbde14597f8e1e866eb3bf',
    'toyvm-kernel-profile-accounting-backend-oct28/confine.py': '0b10df6497f359f9684f1dbb0752eba3816d0e6568c492c39f62ba3a3f2076d8',
    'toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py': 'cc2dc7ab2f9b5d1b84b755c61e7a6ffc3e226d52ffe008edf7ace5310cbdc105',
    'toyvm-transient-profile-accounting-repair-oct28/pinned-supervisor.py': '9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85',
}
BACKEND = 'toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py'
OLD = 'e281eb058cee5e65797566c738d0330d2449ec6fe84572d572cfbf181c32ec41'
PATHS = [CALLER] + ['test/' + p for p in PINS]


def digest(data):
    return hashlib.sha256(data).hexdigest()


def source_pins(root):
    return {p: dict(bytes=len((root / p).read_bytes()),
                    sha256=digest((root / p).read_bytes())) for p in PATHS}


def caller(root):
    path = root / CALLER
    spec = importlib.util.spec_from_file_location('production_caller_control', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    assert module.ROOT == root
    return module


def rejected(module, relative):
    try:
        module.load_backend()
    except RuntimeError as error:
        assert str(error) == 'accepted backend identity mismatch: ' + relative, str(error)
        return str(error)
    raise AssertionError('production loader accepted mismatched dependency: ' + relative)


def identity(module, root):
    adapter = module.load_backend()
    path = root / 'test/toyvm-kernel-profile-accounting-backend-oct28/supervise_accounted.py'
    assert callable(adapter)
    assert adapter.__name__ == 'supervise_accounted'
    assert adapter.__module__ == 'accepted_accounted_adapter'
    assert pathlib.Path(adapter.__code__.co_filename).resolve() == path
    assert pathlib.Path(inspect.getsourcefile(adapter)).resolve() == path
    assert pathlib.Path(adapter.__globals__['__file__']).resolve() == path
    assert adapter.__globals__['HERE'] == path.parent
    assert digest(path.read_bytes()) == PINS['toyvm-kernel-profile-accounting-backend-oct28/supervise_accounted.py']
    return dict(name=adapter.__name__, module=adapter.__module__, source=str(path),
                sourceSHA256=digest(path.read_bytes()), invoked=False)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--before', action='store_true')
    args = parser.parse_args()
    original = source_pins(ROOT)
    for relative, expected in PINS.items():
        assert original['test/' + relative]['sha256'] == expected, relative
    production = caller(ROOT)
    if args.before:
        expected = dict(PINS, **{BACKEND: OLD})
        assert production.BACKEND_PINS == expected
        mismatches = [p for p, h in production.BACKEND_PINS.items()
                      if digest((ROOT / 'test' / p).read_bytes()) != h]
        assert mismatches == [BACKEND]
        report = dict(status='PASS', sourcePins=original, soleMismatch=mismatches,
                      rejection=rejected(production, BACKEND))
        output = HERE / 'before.json'
    else:
        assert production.BACKEND_PINS == PINS
        actual = identity(production, ROOT)  # Exact production path before fixture controls.
        before = json.loads((HERE / 'before.json').read_text())
        assert before['soleMismatch'] == [BACKEND]
        assert before['sourcePins'][CALLER]['sha256'] == '73c5bd33eb8af3887f5c6f21a8c6354aef591baf2d41589eb673c9d275448b60'
        for p in PATHS[1:]:
            assert before['sourcePins'][p] == original[p]
        failures = {}
        with tempfile.TemporaryDirectory(prefix='private-loader-', dir=HERE) as directory:
            private = pathlib.Path(directory)
            for relative in PATHS:
                target = private / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(ROOT / relative, target)
            copied = caller(private)
            assert copied.BACKEND_PINS == PINS
            private_identity = identity(copied, private)
            for relative in PINS:
                target = private / 'test' / relative
                clean = target.read_bytes()
                try:
                    target.write_bytes(clean + b'\n# private identity-tamper control\n')
                    failures[relative] = rejected(copied, relative)
                finally:
                    target.write_bytes(clean)
            identity(copied, private)
        report = dict(status='PASS', sourcePinsBeforeMigration=before['sourcePins'],
                      sourcePinsAfterMigration=original, actualAdapter=actual,
                      privateAdapterVerified=private_identity['module'],
                      dependencyTamperRejections=failures, productionUnchangedDuringMutations=True,
                      adapterInvoked=False, mountExecuted=False, browserExecuted=False)
        output = HERE / 'loader-results.json'
    assert source_pins(ROOT) == original, 'public source changed during controls'
    output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, sort_keys=True))


if __name__ == '__main__':
    main()
