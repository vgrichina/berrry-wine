#!/usr/bin/env python3
"""Recover the pinned original Windows archive and verify/extract it, without execution."""
import argparse, importlib.util, json, pathlib, shutil, subprocess, sys

HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('maelstrom_batch', HERE/'maelstrom-batch.py')
batch = importlib.util.module_from_spec(spec); spec.loader.exec_module(batch)
p = argparse.ArgumentParser(description=__doc__); p.add_argument('destination', type=pathlib.Path)
p.add_argument('--guard-only', action='store_true'); a = p.parse_args()
assert not a.destination.exists(), 'destination already exists'
mem = int(next(s.split()[1] for s in open('/proc/meminfo') if s.startswith('MemAvailable:'))) * 1024
assert mem >= 805306368, 'memory admission rejected'
projected = 2097152 + 2794170 + 8388608 + 8388608
assert shutil.disk_usage(a.destination.parent).free - projected >= 2982150144, 'disk admission rejected'
a.destination.mkdir()
sentinel = a.destination/'SENTINEL-DOWNLOAD'
probe = [[sys.executable, str(HERE/'maelstrom-byte-guard.py'), '99', '1'],
         [sys.executable, '-c', 'from pathlib import Path; Path(%r).write_text("download")' % str(sentinel)]]
result = batch.batch(probe)
receipt = {'guard_exit': 42, 'wrapper_exit': result, 'sentinel_exists': sentinel.exists(),
           'mem_available': mem, 'projected_new_bytes_including_reserve_future': projected}
(a.destination/'guard-receipt.json').write_text(json.dumps(receipt, indent=2)+'\n')
assert result == 42 and not sentinel.exists(), 'sequencing self-test failed'
if a.guard_only:
    print('PASS local rejecting shared byte guard propagated; sentinel absent')
    sys.exit(0)
manifest = json.loads((HERE.parent/'docs/re-notes/maelstrom-original-win32-20261024/manifest.json').read_text())
archive = a.destination/'Maelstrom-3.0.6-Windows.zip'
steps = [[sys.executable, str(HERE/'maelstrom-fetch.py'), manifest['archive']['url'], str(archive), '--limit', '2097152'],
         [sys.executable, str(HERE/'maelstrom-closure.py'), '--archive', str(archive), '--extract-to', str(a.destination/'extracted')]]
(a.destination/'batch.json').write_text(json.dumps(steps, indent=2)+'\n')
sys.exit(batch.batch(steps))
