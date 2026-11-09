"""Recover exact small Q3 source inputs; never allocate or run a runtime.

Existing historical bytes are immutable: only missing files are generated.
The tracked JSON manifest regenerates the original gzip header and payload.
"""
from pathlib import Path
import gzip
import io
import json
import shutil
import sys


def recover(root):
    sources = root / 'tools/q3-native-inputs'
    mapping = json.loads((sources / 'index.json').read_text())
    for name, destination in mapping.items():
        if name.rsplit('/', 1)[-1] in ('control.py', 'physical_gate.py',
                                       'cancellation_gate.py', 'phase-input.py'):
            continue  # Fresh task-local copies are made by materialize().
        target = root / destination
        if target.exists():
            continue
        data = (root / name).read_bytes()
        if name.endswith('historical-pins.json'):
            output = io.BytesIO()
            with gzip.GzipFile(filename='runtime-pins.json', mode='wb', fileobj=output,
                               mtime=1794229784) as stream:
                stream.write(data)
            data = output.getvalue()
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open('xb') as stream:
            stream.write(data)


def materialize(root, destination):
    recover(root)
    for name in ('control.py', 'physical_gate.py', 'cancellation_gate.py', 'phase-input.py'):
        with (destination / name).open('xb') as stream:
            stream.write((root / 'tools/q3-native-inputs' / name).read_bytes())


if __name__ == '__main__':
    materialize(Path(__file__).resolve().parents[1], Path(sys.argv[1]).resolve())
