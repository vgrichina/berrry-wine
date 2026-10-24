#!/usr/bin/env python3
"""Positive extraction/closure and deliberate rejection controls on retained inputs."""
import argparse, copy, importlib.util, json, pathlib, subprocess, sys, tempfile

REPO = pathlib.Path(__file__).resolve().parents[1]
CHECK = REPO / 'tools/maelstrom-closure.py'
spec = importlib.util.spec_from_file_location('closure', CHECK)
closure = importlib.util.module_from_spec(spec); spec.loader.exec_module(closure)
p = argparse.ArgumentParser(); p.add_argument('--root', type=pathlib.Path, required=True)
p.add_argument('--archive', type=pathlib.Path, required=True); p.add_argument('--receipt', type=pathlib.Path, required=True)
a = p.parse_args(); results = []

def run(label, ok, extra=None, diagnostic=None):
    args = extra if extra is not None else ['--root', str(a.root)]
    r = subprocess.run([sys.executable, str(CHECK), '--archive', str(a.archive), *args], capture_output=True, text=True, timeout=20)
    assert (r.returncode == 0) == ok, (label, r.stdout, r.stderr)
    if diagnostic: assert diagnostic in r.stderr, (label, r.stderr)
    results.append({'test': label, 'exit': r.returncode, 'stdout': r.stdout.strip(), 'stderr': r.stderr.strip()})

run('pristine original archive and all files', True)
with tempfile.TemporaryDirectory(prefix='maelstrom-controls-', dir=a.receipt.parent) as t:
    t = pathlib.Path(t)
    run('reproducible guarded extraction', True, ['--extract-to', str(t/'fresh')])
    run('existing extraction refused', False, ['--extract-to', str(t/'fresh')], 'destination already exists')
    for name in ['Maelstrom.exe', 'SDL.dll', 'SDL_net.dll', 'Maelstrom_Sprites', 'Maelstrom_Fonts', 'Maelstrom_Sounds', 'Images/Maelstrom_Titles#130.bmp', 'COPYING.txt']:
        source = a.root/name; held = t/'held'
        source.rename(held)
        try: run('missing ' + name, False, diagnostic='missing/extra files')
        finally: held.rename(source)
    for name in ['Maelstrom.exe', 'SDL.dll', 'SDL_net.dll', 'Maelstrom_Sprites', 'Images/Maelstrom_Icon#100.cicn']:
        source = a.root/name; original = source.read_bytes()
        changed = bytearray(original); changed[len(changed)//2] ^= 1
        try:
            source.write_bytes(changed)
            run('changed byte ' + name, False, diagnostic='SHA256 mismatch')
        finally: source.write_bytes(original)
    original = a.archive.read_bytes()
    changed = bytearray(original); changed[100] ^= 1
    try:
        a.archive.write_bytes(changed)
        run('changed archive byte', False, diagnostic='archive SHA256 mismatch')
    finally: a.archive.write_bytes(original)
    sentinel = t/'sentinel'
    steps = [[sys.executable, str(REPO/'tools/maelstrom-byte-guard.py'), '99', '1'],
             [sys.executable, '-c', 'from pathlib import Path; Path(%r).write_text("download")' % str(sentinel)]]
    batch = t/'batch.json'; batch.write_text(json.dumps(steps))
    r = subprocess.run([sys.executable, str(REPO/'tools/maelstrom-batch.py'), str(batch)], capture_output=True, text=True, timeout=20)
    assert r.returncode == 42 and not sentinel.exists()
    results.append({'test': 'actual batch/shared byte guard propagates rejection, sentinel absent', 'exit': r.returncode})

m = json.loads(closure.DEFAULT.read_text())
for label, change, diagnostic in [
    ('missing recursive SDL dependency', lambda mods: mods.pop('sdl.dll'), 'missing non-system DLL'),
    ('unsatisfied EXE SDL export', lambda mods: mods['sdl.dll']['exports'].pop('SDL_Init'), 'unsatisfied export'),
    ('unsatisfied SDL_net -> SDL export', lambda mods: mods['sdl.dll']['exports'].pop('SDL_SetError'), 'unsatisfied export'),
    ('export forwarder to absent DLL', lambda mods: mods['sdl.dll']['exports'].__setitem__('SDL_Init', 'absent.Init'), 'missing non-system DLL')]:
    mods = copy.deepcopy(m['pe']); change(mods)
    try: closure.bind(mods, set(m['system_dlls']))
    except AssertionError as e: assert diagnostic in str(e); results.append({'test': label, 'rejected': str(e)})
    else: raise AssertionError('false acceptance: ' + label)
try: closure.pe.PE(b'MZ' + bytes(100))
except AssertionError as e: results.append({'test': 'malformed/truncated PE', 'rejected': str(e)})
else: raise AssertionError('malformed PE accepted')
run('restored original bytes', True)
a.receipt.write_text(json.dumps({'status': 'PASS', 'tests': results}, indent=2)+'\n')
print(json.dumps({'status': 'PASS', 'tests': len(results), 'receipt': str(a.receipt)}))
