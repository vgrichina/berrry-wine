#!/usr/bin/env python3
"""Bounded offline source acceptance; never builds the emulator or runs a PE."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time

EVIDENCE = Path(__file__).resolve().parent
ROOT = EVIDENCE.parents[2]
NATIVE = Path('/home/user/wine-assembly/scratch/usage-watch/shadow-man-dsetup-native-input-oct22')
LAUNCHER = Path('/home/user/wine-assembly/scratch/usage-watch/shadow-man-dsetup-native-version-repair-oct22')
SHARED = Path('/home/user/wine-assembly')
ENV = dict(os.environ, GIT_NO_LAZY_FETCH='1')
CHANGED = ['lib/dll-registry.js', 'lib/process-boot.js', 'lib/storage.js',
           'src/01-header.wat', 'src/09a1-comctl-handlers.wat',
           'test/test-directx-system-files.js', 'test/test-file-version-info.js',
           'test/test-static-dx-version.js', 'test/test-directx-registry-metadata.js',
           'test/test-dsetup-loading.js', 'test/dsetup-binding-fixture.js',
           'test/version-source-fixture.js', 'test/wat-source-function.js']

def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def allocated(path):
    if not path.exists():
        return 0
    total = path.lstat().st_blocks * 512
    if path.is_dir():
        for child in path.iterdir():
            total += allocated(child)
    return total

def resource_guard():
    own = allocated(ROOT)
    shared = allocated(NATIVE)
    launch = allocated(LAUNCHER) + allocated(Path(str(LAUNCHER) + '.task.txt'))
    reserve = 8388608
    growth = 4194304
    total = own + shared + launch + reserve + growth
    free = os.statvfs(ROOT).f_bavail * os.statvfs(ROOT).f_frsize
    assert total < 67108864, total
    assert free >= 2982150144, free
    return dict(ownAllocated=own, sharedNativeAllocated=shared, launcherAllocated=launch,
                reserve=reserve, publicationGrowthAllowance=growth, total=total,
                cap=67108864, hostFree=free, hostFloor=2982150144)

def main():
    resources = resource_guard()
    pins = json.loads((EVIDENCE / 'source-pins.json').read_text())
    for row in pins['files']:
        assert sha(row['source']) == row['sha256'], row['source']
        if row['path'] not in CHANGED:
            assert sha(ROOT / row['path']) == row['sha256'], row['path']
    receipt = json.loads((NATIVE / 'receipt.json').read_text())
    for row in receipt['originalInstalledFiles']:
        assert (NATIVE / row['name']).stat().st_size == row['size']
        assert sha(NATIVE / row['name']) == row['sha256']
    # Accepted donor's earlier seals independently protect shared Git state.
    donor = Path('/home/user/wine-assembly-shadow-man-dsetup-ordinal-support-oct22')
    old = json.loads((donor / 'scratch/runs/20261022-shadow-man-dsetup-ordinal-support/resources.json').read_text())
    seals = old['protectedGitMetadataUnchanged']
    for directory, files in seals.items():
        for file, digest in files.items():
            p = Path(directory) / '.git' / file
            assert (sha(p) if p.exists() else None) == digest, str(p)
    native_arg = '--native-dir=' + str(NATIVE)
    commands = [
        ['node', 'test/test-storage-registry.js'],
        ['node', 'test/test-directx-registry-metadata.js'],
        ['node', 'test/test-dsetup-loading.js'],
        ['node', 'test/test-dsetup-loading.js', native_arg],
        ['node', 'test/test-file-version-info.js', '--source-fixture', native_arg],
        ['node', 'test/test-directx-system-files.js', '--source-fixture'],
        ['node', str(EVIDENCE / 'mutations.js')],
        ['node', 'tools/check-parens.js', 'src/09a1-comctl-handlers.wat', '--no-diff', '--quiet'],
        ['node', 'tools/check-parens.js', 'src/01-header.wat', '--no-diff', '--quiet'],
        ['node', 'tools/check-wat-logical-and.js'],
        ['node', 'ops/check-run-evidence.js', str(ROOT)],
    ]
    commands += [['node', '--check', f] for f in CHANGED if f.endswith('.js')]
    commands += [['git', 'diff', '--check', '--'] + CHANGED]
    checks = []
    for args in commands:
        started = time.monotonic()
        result = subprocess.run(args, cwd=ROOT, env=ENV, capture_output=True, text=True, timeout=30)
        assert len(result.stdout) + len(result.stderr) < 100000
        checks.append(dict(command=args, exit=result.returncode, elapsed=time.monotonic()-started,
                           stdout=result.stdout, stderr=result.stderr))
        assert result.returncode == 0, checks[-1]
    (EVIDENCE / 'checks.json').write_text(json.dumps(checks, indent=2) + '\n')
    resources.update(resource_guard())
    resources['protectedMetadataMatchesAcceptedDonorSeals'] = True
    (EVIDENCE / 'resources.json').write_text(json.dumps(resources, indent=2) + '\n')
    print('PASS', len(checks), 'commands; 4 rejecting mutations; original seals; protected Git seals; allocation/floor')

if __name__ == '__main__':
    main()
