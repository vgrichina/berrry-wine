#!/usr/bin/env python3
"""Local negative controls for the actual acquisition sequencing wrapper."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import importlib.util

tool = Path(__file__).resolve().parents[1] / 'tools/enigma-original-closure.py'
with tempfile.TemporaryDirectory(prefix='enigma-guard-', dir=tool.parents[2]) as directory:
    sentinel = Path(directory) / 'sentinel-download'
    dependent = [sys.executable, '-c', 'from pathlib import Path; import sys; Path(sys.argv[1]).write_text("download")', str(sentinel)]
    controls = []
    for reason in ['metadata rejection', 'byte-budget rejection']:
        guard = [sys.executable, '-c', 'import sys; sys.exit(37)']
        result = subprocess.run([sys.executable, str(tool), 'sequence', json.dumps(guard), json.dumps(dependent)], check=False)
        assert result.returncode == 37 and not sentinel.exists()
        controls.append({'guard': reason, 'exit': result.returncode, 'sentinel_absent': True})
    print(json.dumps({'sequencer': str(tool), 'controls': controls, 'pass': True}))

if len(sys.argv) == 4:
    archive, root, seal = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
    spec = importlib.util.spec_from_file_location('enigma_closure', tool)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    result = module.verify(archive, root, seal)
    assert result['visible_table_closure'] == 'PASS'
    assert len(result['packed_modules']) == 10
    assert result['static_closure'] == 'BLOCKED_PACKED_IMPORTS'
    controls = []
    def rejects(label, operation):
        try:
            operation()
        except (AssertionError, ValueError) as error:
            controls.append({'control': label, 'rejected': str(error)})
        else:
            raise AssertionError('accepted '+label)
    asset = root/'Enigma-1.01/data/startup.lua'
    held = root.parent/'enigma-held-startup.lua'
    assert not held.exists()
    asset.rename(held)
    try:
        rejects('missing asset', lambda: module.verify(archive, root, seal))
    finally:
        held.rename(asset)
    for label, path in [('changed asset', asset), ('changed DLL', root/'Enigma-1.01/SDL.dll'), ('changed archive', archive)]:
        with path.open('r+b') as f:
            byte = f.read(1)
            f.seek(0)
            f.write(bytes([byte[0] ^ 1]))
        try:
            rejects(label, lambda: module.verify(archive, root, seal))
        finally:
            with path.open('r+b') as f:
                f.write(byte)
    real_pe = module.pe
    for label, target, symbol in [('unresolved DLL', 'enigma-missing.dll', 'missing'), ('unsatisfied export', 'sdl.dll', 'enigma_missing_export')]:
        def altered(path):
            parsed = real_pe(path)
            if path.name == 'enigma.exe':
                parsed['imports'][target] = [symbol]
            return parsed
        module.pe = altered
        rejects(label, lambda: module.verify(archive, root, seal))
        module.pe = real_pe
    assert module.verify(archive, root, seal)['visible_table_closure'] == 'PASS'
    print(json.dumps({'integrity_and_binding_controls': controls, 'originals_restored': True, 'pass': True}))
