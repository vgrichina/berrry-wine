"""Read-only Q3 capture polling within the owner's existing startup budget.

A pending poll is transport progress, not a runtime fault. The caller must keep
polling until ready or a terminal result, then personally review the full image.
Input admission retains its separate, unchanged 120-second freshness bound.
"""
from pathlib import Path
import gzip
import hashlib
import inspect
import json
import re
import time
import zlib


def poll(plan, label, deadline, wait_seconds=20, *, clock=time.time,
         monotonic=time.monotonic, sleep=time.sleep):
    assert re.fullmatch(r'[a-z0-9-]+', label), 'capture label'
    assert 0 < wait_seconds <= 30, 'bounded observation transport poll'
    prepared, output = Path(plan['prepared']), Path(plan['output'])
    poll_end = monotonic() + wait_seconds
    while True:
        for base, names in [(prepared, ['caller-cancelled.json']),
                            (output, ['first-browser-failure.json',
                                      'first-transport-failure.json', 'first-failure.json'])]:
            for name in names:
                assert not (base / name).exists(), 'native terminal ' + str(base / name)
        identity = prepared / 'runtime-identity.json.gz'
        if identity.exists():
            deadline = min(deadline, json.loads(gzip.decompress(identity.read_bytes()))['deadline'])
        window = output / 'execution-window.json'
        if window.exists():
            from datetime import datetime
            stop = json.loads(window.read_bytes())['browserStop']
            deadline = min(deadline, datetime.fromisoformat(stop.replace('Z', '+00:00')).timestamp())
        # This is a live gzip stream: its footer need not have been written yet.
        budget = output / 'startup-browser.jsonl.gz'
        if label == 'startup' and budget.exists():
            raw = zlib.decompressobj(31).decompress(budget.read_bytes())
            for line in raw.splitlines(keepends=True):
                if not line.endswith(b'\n'):
                    continue
                row = json.loads(line)
                if 'startupDeadline' in row:
                    deadline = min(deadline, row['startupDeadline'] / 1000)
        assert clock() < deadline, 'owning capture/startup deadline expired'
        capture = output / (label + '-capture.json')
        if capture.exists():
            cap = json.loads(capture.read_bytes())
            data = (output / (label + '.png')).read_bytes()
            assert cap['label'] == label and isinstance(cap['identity'], dict), 'capture identity'
            assert hashlib.sha256(data).hexdigest() == cap['sha256'], 'capture SHA'
            state = json.loads((output / (label + '-state.json')).read_bytes())
            return dict(status='ready', capture=cap, size=len(data), state=state,
                        owningDeadline=deadline)
        if monotonic() >= poll_end:
            return dict(status='pending', owningDeadline=deadline, noRuntimeFault=True)
        sleep(.02)


def remote_code(root, prepared, label, wait_seconds=20):
    """Self-contained payload: no additional provider upload or runtime hook."""
    assert re.fullmatch(r'[a-z0-9-]+', label)
    assert 0 < wait_seconds <= 30
    imports = 'from pathlib import Path\nimport gzip,hashlib,json,re,time,zlib\n'
    code = imports + inspect.getsource(poll)
    code += '\nimport runpy\nowner=None\ntry:\n'
    code += ' root=Path(' + repr(str(root)) + ');prepared=Path(' + repr(str(prepared)) + ')\n'
    code += " plan=dict(prepared=prepared.parent/'original/prepared',output=prepared.parent/'original/prepared/runtime')\n"
    code += " owner=runpy.run_path(str(root/'tools/q3-native-launch-client.py'))\n"
    code += " plan=runpy.run_path(str(root/'tools/q3-phase-observer.py'))['layout'](root,prepared,'original')\n"
    code += " life=json.loads(gzip.decompress((prepared/'lifecycle.json.gz').read_bytes()))\n"
    code += ' result=poll(plan,' + repr(label) + ",life['overallDeadline']-180," + repr(wait_seconds) + ')\n'
    code += ' print(json.dumps(result),flush=True)\nexcept BaseException:\n'
    code += " if owner is not None:owner['cancel_remote'](str(plan['prepared']),str(plan['output']))\n raise\n"
    return code
