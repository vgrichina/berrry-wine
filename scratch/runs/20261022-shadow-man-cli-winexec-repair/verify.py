#!/usr/bin/env python3
"""Offline replay; no guest execution, network, builds or original media."""
import json
import os
from pathlib import Path
import subprocess

E = Path(__file__).resolve().parent
ROOT = E.parents[2]
BASE = os.environ.get('BASELINE_CLI', '/home/user/wine-assembly/scratch/usage-watch/shadow-man-shell-route-input-oct22/test/run.js')
results = []

def run(name, args, env=None, expected=0):
    r = subprocess.run(args, cwd=ROOT, env={**os.environ, **(env or {})}, capture_output=True, text=True)
    (E / (name + '.log')).write_text(r.stdout + r.stderr)
    assert r.returncode == expected, (name, r.returncode, r.stderr[:300])
    results.append(dict(name=name, command=args, env=env, exit=r.returncode, expected=expected))

run('baseline', ['node', 'test/test-shell-cli-routing.js', '--baseline'], {'CLI_SOURCE': BASE})
run('repaired', ['node', 'test/test-shell-cli-routing.js'])
run('baseline-rejected', ['node', 'test/test-shell-cli-routing.js'], {'CLI_SOURCE': BASE}, 1)
s = (ROOT / 'test/run.js').read_text()
mutations = {
    'fabricated-success': s.replace('return spawnVfsChild(command, directory, false, nShow) ? 33 : 2;', 'return 33;'),
    'transport-bypass': s.replace('    const vfs = ctx.vfs;\n    if (!vfs || !(forceSpawn', '    return 0x4004;\n    const vfs = ctx.vfs;\n    if (!vfs || !(forceSpawn'),
    'cleanup-removed': s.replace('fs.rmSync(tmp, { recursive: true, force: true });', 'void tmp;'),
}
for name, text in mutations.items():
    assert text != s
    p = E / (name + '.js')
    try:
        p.write_text(text)
        run(name + '-rejected', ['node', 'test/test-shell-cli-routing.js'], {'CLI_SOURCE': str(p)}, 1)
    finally:
        p.unlink(missing_ok=True)
run('syntax', ['node', '--check', 'test/run.js'])
run('fixture-syntax', ['node', '--check', 'test/test-shell-cli-routing.js'])
run('existing-vfs-export', ['node', 'test/test-vfs-export.js'])
# Exact-main browser test has a stale regex expecting four launchVfsExe args;
# exact-main host has five. Both files are unchanged; retain this known failure.
run('existing-browser-shell-known-failure', ['node', 'test/test-shell-execute-launch.js'], expected=1)
(E / 'checks.json').write_text(json.dumps(results, indent=2) + '\n')
print('PASS offline baseline/repaired oracle, four rejection controls, syntax and existing VFS exporter; known exact-main browser assertion failure retained')
