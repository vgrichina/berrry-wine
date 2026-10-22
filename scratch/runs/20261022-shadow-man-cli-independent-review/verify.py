#!/usr/bin/env python3
"""Bounded offline review replay. No guest, build, runtime or network calls."""
from pathlib import Path
import hashlib
import json
import os
import subprocess

E = Path(__file__).resolve().parent
R = E.parents[2]
ENV = {**os.environ, 'GIT_NO_LAZY_FETCH': '1'}
CANDIDATE = '30bdd15fb0c824701716ab04335a4688a7c36a96'
MAIN = '324cc4f9580755a4fcc97eea0a5e4070ea7a0df9'
H = Path('/home/user/wine-assembly-shadow-man-child-installer-handoff-oct22/scratch/runs/20261022-shadow-man-child-installer-handoff')
S = Path('/home/user/wine-assembly-shadow-man-child-transport-sized-oct22/scratch/runs/20261022-shadow-man-child-transport-sized')
checks = []

def git(*args):
    return subprocess.check_output(['git', *args], cwd=R, env=ENV)

def run(name, command, expected=0, env=None):
    p = subprocess.run(command, cwd=R, env={**ENV, **(env or {})}, capture_output=True, text=True)
    (E / (name + '.log')).write_text(p.stdout + p.stderr)
    assert p.returncode == expected, (name, p.returncode, p.stderr[:400])
    checks.append(dict(name=name, command=command, env=env, exit=p.returncode, expected=expected))

def changed_file(p, value, action):
    original = p.read_bytes()
    try:
        p.write_bytes(value)
        action()
    finally:
        p.write_bytes(original)

def sha(b):
    return hashlib.sha256(b).hexdigest()

# Every production file in the focused checkout is the exact candidate blob.
production = ['test/run.js', 'host.js', 'lib/host-imports.js', 'lib/vfs-export.js',
              'lib/filesystem.js', 'lib/process-boot.js', 'lib/region-map.generated.js',
              'lib/storage.js', 'lib/browser-shell.js', 'lib/dll-registry.js']
identity = {f: sha((R/f).read_bytes()) for f in production}
for f in production:
    oid = git('ls-tree', CANDIDATE, '--', f).decode().split()[2]
    data = (R/f).read_bytes()
    assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest() == oid, f
baseline = git('show', MAIN+':test/run.js')
(E/'baseline-run.js').write_bytes(baseline)
assert baseline != (R/'test/run.js').read_bytes()
assert git('show', MAIN+':host.js') == (R/'host.js').read_bytes()
original_browser = git('show', MAIN+':test/test-shell-execute-launch.js')
assert original_browser == git('show', CANDIDATE+':test/test-shell-execute-launch.js')

fixture = ['node', 'test/test-shell-cli-routing.js']
base_env = {'CLI_SOURCE': str(E/'baseline-run.js')}
run('baseline-zero-forks', fixture+['--baseline'], env=base_env)
run('candidate-routing', fixture)
run('reject-baseline', fixture, 1, base_env)
s = (R/'test/run.js').read_text()
mutations = {
    'false-success': s.replace('return spawnVfsChild(command, directory, false, nShow) ? 33 : 2;', 'return 33;'),
    'bypassed-transport': s.replace('    const vfs = ctx.vfs;\n    if (!vfs || !(forceSpawn', '    return 0x4004;\n    const vfs = ctx.vfs;\n    if (!vfs || !(forceSpawn'),
    'missing-cleanup': s.replace('fs.rmSync(tmp, { recursive: true, force: true });', 'void tmp;'),
}
for name, value in mutations.items():
    assert value != s
    p = E/'mutation.js'
    try:
        p.write_text(value)
        run('reject-'+name, fixture, 1, {'CLI_SOURCE': str(p)})
    finally:
        p.unlink(missing_ok=True)

browser = ['node', 'test/test-shell-execute-launch.js']
changed_file(R/'test/test-shell-execute-launch.js', original_browser,
             lambda: run('original-browser-candidate-fails', browser, 1))
def original_on_main():
    changed_file(R/'test/test-shell-execute-launch.js', original_browser,
                 lambda: run('original-browser-main-fails', browser, 1))
changed_file(R/'test/run.js', baseline, original_on_main)
run('corrected-browser-candidate', browser)
changed_file(R/'test/run.js', baseline, lambda: run('corrected-browser-main', browser))
host = (R/'host.js').read_text()
for name, before, after in [
    ('absolute-call', 'if (absolute && shell.launchVfsExe', 'if (false && shell.launchVfsExe'),
    ('relative-call', 'if (!absolute && shell.launchVfsExe', 'if (false && shell.launchVfsExe'),
]:
    assert before in host
    changed_file(R/'host.js', host.replace(before, after).encode(),
                 lambda name=name: run('reject-browser-'+name, browser, 1))
shell = (R/'lib/browser-shell.js').read_text()
changed_file(R/'lib/browser-shell.js', shell.replace('queuePendingLaunch(key, SINGLE_APP(), launchOpts);',
             'queuePendingLaunch(key, SINGLE_APP());').encode(),
             lambda: run('reject-browser-lost-queue-options', browser, 1))
run('coupled-lazy-routing', ['node', str(E/'coupled-routing.cjs')])
exporter = (R/'lib/vfs-export.js').read_text()
changed_file(R/'lib/vfs-export.js', exporter.replace('value && value._provider',
             'value && (value._provider || value._size !== undefined)').encode(),
             lambda: run('reject-lazy-source-omission', ['node', str(E/'coupled-routing.cjs')], 1))
run('existing-exporter', ['node', 'test/test-vfs-export.js'])
for f in ['test/run.js', 'test/test-shell-cli-routing.js', 'test/test-shell-execute-launch.js']:
    run('syntax-'+Path(f).stem, ['node', '--check', f])
expected_rejections = {
    'reject-baseline': 'shell callback must reach authentic transport exactly once',
    'reject-false-success': 'shell callback must reach authentic transport exactly once',
    'reject-bypassed-transport': 'shell callback must reach authentic transport exactly once',
    'reject-missing-cleanup': 'snapshot cleaned on child exit',
    'original-browser-main-fails': 'browser host offers relative and absolute executable names',
    'original-browser-candidate-fails': 'browser host offers relative and absolute executable names',
    'reject-browser-absolute-call': 'browser host offers relative and absolute executable names',
    'reject-browser-relative-call': 'a bare name in the caller current directory',
    'reject-browser-lost-queue-options': 'registered and inherited-VFS handoffs use the dormant process queue',
    'reject-lazy-source-omission': 'ENOENT: no such file or directory',
}
for name, reason in expected_rejections.items():
    assert reason in (E/(name+'.log')).read_text(), (name, 'wrong rejecting reason')

# Reuse accepted sealed text and size metadata, never media or archives.
reused = []
for root, names in [
    (H, ['analysis.json', 'source-host.js', 'source-lib_filesystem.js', 'source-lib_vfs-export.js']),
    (S, ['preflight.json']),
]:
    manifest = {x['path']:x for x in json.loads((root/'raw/manifest.json').read_text())}
    for name in names:
        data = (root/'raw'/name).read_bytes()
        assert len(data) == manifest[name]['size'] and sha(data) == manifest[name]['sha256']
        reused.append(dict(absolutePath=str(root/'raw'/name), **manifest[name]))
(E/'reused-seals.json').write_text(json.dumps(reused, indent=2)+'\n')
old_host = (H/'raw/source-host.js').read_text()
def function(s, name):
    start = s.index('function '+name+'(')
    return s[start:s.index('\n}\n', start)+3]
for name in ['parseShellLaunchCommand', 'resolveShellLaunchPath']:
    assert function(host, name) == function(old_host, name)
assert exporter.encode() == (H/'raw/source-lib_vfs-export.js').read_bytes()
def lazy(s):
    start = s.index('  setLazyFile(')
    return s[start:s.index('\n  // Mount a file', start)]
assert lazy((R/'lib/filesystem.js').read_text()) == lazy((H/'raw/source-lib_filesystem.js').read_text())
analysis = json.loads((H/'raw/analysis.json').read_text())
pre = json.loads((S/'raw/preflight.json').read_text())
assert analysis['mediaBytes'] == 73339636 and analysis['extractedPayloadBytes'] == 656970
minimum = 2*(analysis['mediaBytes']+analysis['extractedPayloadBytes'])
assert minimum == analysis['defaultTwoSnapshotLowerBound'] == pre['projectedSnapshots'] == 147993212
assert minimum > 128*1024**2
assert minimum + 16*1024**2 < 256*1024**2
assert pre['cap'] == 256*1024**2 and pre['reserve'] == 16*1024**2
assert pre['transport'] == 'unchanged spawnVfsChild, full source input and output authorized'
seals = {Path(x['path']).name:x for x in pre['seals']}
module = seals['wine-assembly.wasm']
assert module['size'] == 1878971 and module['sha256'] == 'f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7'
setup = [x for x in pre['seals'] if x['sha256']=='5656e87da0641c9dcfcd0ee8949ce72b3fa6a7d0e8b1fd985a16f6bd6c34ce52']
assert setup
historical_region = [x for x in pre['seals'] if x['path'].endswith('/lib/region-map.generated.js')][0]
transport = dict(verdict='PASS_OFFLINE_COUPLED_SOURCE_AND_SIZING', sourceFiles=23,
    sourceBytes=analysis['mediaBytes'], payloadBytes=analysis['extractedPayloadBytes'],
    minimumSnapshotsBytes=minimum, remoteCap=pre['cap'], reserve=pre['reserve'],
    remainingAfterMinimumAndReserve=pre['cap']-minimum-pre['reserve'],
    localCap=64*1024**2, module=module, setup=setup,
    historicalSource='c26252c4a95babe583ade1d1c6e2da0c050be45c',
    parserUnchanged=True, exporterUnchanged=True, ordinaryLazyUnchanged=True,
    historicalRegion=historical_region,
    candidateRegionSha256=identity['lib/region-map.generated.js'],
    wholeHostIdentical=False, newHostHistoricalModuleFullyQualified=False,
    guestAttempts=0, fullMediaCopiedLocally=False)
(E/'coupled-preflight.json').write_text(json.dumps(transport, indent=2)+'\n')
(E/'source-identities.json').write_text(json.dumps(identity, indent=2)+'\n')
(E/'checks.json').write_text(json.dumps(checks, indent=2)+'\n')
print('PASS independent exact-candidate routing, 4 routing rejects, browser baseline/fix/3 rejects, coupled authentic lazy export/omission reject, sizing and source-identity reuse; guest/build/runtime 0')
