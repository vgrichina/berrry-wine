#!/usr/bin/env python3
"""Independent focused source checks; readonly donor and sealed original inputs."""
import hashlib, json, os, subprocess
from pathlib import Path
E = Path(__file__).resolve().parent
R = E.parents[2]
D = Path('/home/user/wine-assembly-shadow-man-dsetup-native-version-repair-oct22')
DE = D / 'scratch/runs/20261022-shadow-man-dsetup-native-version-repair'
N = Path('/home/user/wine-assembly/scratch/usage-watch/shadow-man-dsetup-native-input-oct22')
ENV = dict(os.environ, GIT_NO_LAZY_FETCH='1', PYTHONDONTWRITEBYTECODE='1')
C = '7a21579f9adb208164312961c249a0aa9080a8b7'
B = '89f1e9d2c67aa94d56d2319115589d07204d42e0'
def git(*args):
    return subprocess.check_output(['git', '-C', str(R), *args], env=ENV)
def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()
def allocated(p):
    if not p.exists(): return 0
    return p.lstat().st_blocks * 512 + (sum(allocated(x) for x in p.iterdir()) if p.is_dir() and not p.is_symlink() else 0)
def main():
    from_pins = json.loads((DE / 'source-pins.json').read_text())
    for row in from_pins['files']:
        assert sha(Path(row['source'])) == row['sha256'], row['path']
    for row in json.loads((E / 'checkout-pins.json').read_text()):
        assert sha(R / row['path']) == row['sha256']
        assert git('rev-parse', C + ':' + row['path']).decode().strip() == row['blob']
    for row in json.loads((N / 'receipt.json').read_text())['originalInstalledFiles']:
        assert (N / row['name']).stat().st_size == row['size']
        assert sha(N / row['name']) == row['sha256']
    # Compare inherited parser/copy/error behavior verbatim against actual base blobs.
    helper_comparison = """
const assert = require('assert'), cp = require('child_process'), fs = require('fs');
const {sourceFunction} = require('./test/wat-source-function');
const file = 'src/09a1-comctl-handlers.wat';
const before = cp.execFileSync('git', ['show', process.argv[1] + ':' + file], {encoding:'utf8'});
const after = fs.readFileSync(file, 'utf8');
for (const name of ['file_version_resource','file_version_info_size_named','file_version_info_named',
    'handle_GetFileVersionInfoSizeW','handle_GetFileVersionInfoW'])
  assert.strictEqual(sourceFunction(after,name), sourceFunction(before,name), name);
console.log('PASS parser, bounded copy, inherited error behavior and W handlers byte-identical to base');
"""
    commands = [
        ['node', str(E / 'focused.js')],
        ['node', 'test/test-dsetup-loading.js', '--native-dir=' + str(N)],
        ['node', 'test/test-directx-registry-metadata.js'],
        ['node', '-e', helper_comparison, B],
        ['node', 'ops/check-run-evidence.js', str(R)],
    ]
    results = []
    for cmd in commands:
        p = subprocess.run(cmd, cwd=R, env=ENV, text=True, capture_output=True, timeout=30)
        results.append(dict(command=cmd, exit=p.returncode, stdout=p.stdout, stderr=p.stderr))
        assert p.returncode == 0, results[-1]
    (E / 'checks.json').write_text(json.dumps(results, indent=2) + '\n')
    receipts = {}
    for name in ['REPORT.md', 'RECOVERY.md', 'final.diff', 'source-pins.json', 'verify.py', 'checks.json', 'mutation-results.json', 'publication.json']:
        receipts[name] = sha(DE / name)
    accepted = json.loads((DE / 'checks.json').read_text())
    assert len(accepted) == 23 and all(x['exit'] == 0 for x in accepted)
    mutants = json.loads((DE / 'mutation-results.json').read_text())
    assert len(mutants) == 4 and all(x['exit'] != 0 and 'AssertionError' in x['stderr'] for x in mutants)
    protected = json.loads((E / 'protected-before.json').read_text())
    for root, files in protected.items():
        for rel, digest in files.items():
            p = Path(root) / rel
            assert (sha(p) if p.exists() else None) == digest, str(p)
    # Charge entire read-only donor, including its shared object database/evidence,
    # conservatively in addition to own materialized files and shared originals.
    launcher = Path('/home/user/wine-assembly/scratch/usage-watch/shadow-man-dsetup-independent-accept-oct22')
    amounts = dict(own=allocated(R), readonlyDonor=allocated(D), native=allocated(N),
        launcher=allocated(launcher) + allocated(Path(str(launcher) + '.task.txt')),
        reserve=8388608, publicationAllowance=2097152)
    total = sum(amounts.values()); free = os.statvfs(R).f_bavail * os.statvfs(R).f_frsize
    assert total < 67108864 and free > 2982150144, (total, free)
    (E / 'resources.json').write_text(json.dumps(dict(amounts=amounts, total=total,
        cap=67108864, hostFree=free, hostFloor=2982150144,
        prewriteProjection=20201472, protectedMetadataUnchanged=True), indent=2) + '\n')
    (E / 'reused-receipts.json').write_text(json.dumps(dict(candidate=C, base=B,
        donor=str(D), hashes=receipts, acceptedCommands=23, acceptedRejectingControls=4,
        originalInputsSealed=True), indent=2) + '\n')
    print('PASS 5 focused commands; original/source seals; accepted 23+4 receipts; protected metadata; whole allocation', total)
if __name__ == '__main__': main()
