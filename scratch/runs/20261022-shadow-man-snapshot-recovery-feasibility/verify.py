"""Offline recovery-feasibility evidence check; no network, runtime or compile."""
import collections
import hashlib
import json
import os
import pathlib
import shutil
import subprocess

R = pathlib.Path(__file__).resolve().parent
BASE = R.parents[2]


def load(name):
    return json.loads((R / name).read_text())


def main():
    totals = {}
    for role, generation, total in [('canonical',31,89803816),
                                    ('installed',17,1187196839)]:
        d = load('raw/' + role + '-download-metadata.json')
        assert d['httpStatus'] == 200
        d = d['response']
        latest = load('raw/' + role + '-latest.json')['snapshot']
        assert d['snapshotId'] == latest['id'] and latest['generation'] == generation
        assert latest['sizeBytes'] == 355 and latest['contentSizeBytes'] == 62
        assert latest['kind'] == 'incremental'
        grouped = collections.defaultdict(list)
        for c in d['chunks']:
            assert c['signedUrl'] == '[REDACTED]'
            assert c['sizeBytes'] > 0 and len(c['sha256']) == 64
            grouped[c['generation']].append(c)
        assert sorted(grouped) == list(range(generation+1))
        layers = {}
        for g, cs in grouped.items():
            assert [c['chunkIndex'] for c in cs] == list(range(len(cs)))
            assert len({c['snapshotId'] for c in cs}) == 1
            layers[str(g)] = sum(c['sizeBytes'] for c in cs)
        summary = load(role + '-chain-sizes.json')
        assert summary['layers'] == layers
        assert sum(layers.values()) == summary['total'] == total
        totals[role] = total
    canonical = load('raw/canonical-recovery.json')
    assert canonical['hashVerified'] and canonical['httpStatus'] == 206
    assert canonical['actualBytes'] == canonical['expectedBytes'] == 1879387
    assert canonical['actualSHA256'] == canonical['expectedSHA256'] == (
        'ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553')
    artifact = R / 'canonical-primary.wasm'
    if artifact.exists():
        assert artifact.stat().st_size == 1879387
        assert hashlib.sha256(artifact.read_bytes()).hexdigest() == canonical['actualSHA256']
    es = load('raw/installed-selected-tree.json')['entries']
    prefix = 'shadow-man-install-continue-oct22/retained-session'
    files = [e for e in es if e['kind']=='file' and e['path'].startswith(prefix+'/')]
    assert len(files) == 2083 and sum(e['size'] for e in files) == 186399681
    registry = [e for e in files if e['path'] == prefix+'/parent-registry.json']
    assert len(registry) == 1 and registry[0]['size'] == 17088
    f = load('installed-feasibility.json')['futurePeakProof']
    assert f['hardTmpfsPlannedBytes'] == (2*f['parentCompleteRetainedSession']+
        f['originalPayloadAdditionalConservative']+f['streamBuffer']+f['filesystemMetadataAllowance'])
    assert f['hardTmpfsPlannedBytes'] < f['hardTmpfsCap']
    assert f['mutablePeakIncludingFixedReserve'] == (f['fixed']+f['hardTmpfsPlannedBytes']+f['reserve'])
    assert f['mutablePeakIncludingFixedReserve'] < f['mutableTotalCap']
    assert f['immutableConservativeAllThreeBackupsBytes'] < f['immutableCap']
    for name, expected in load('protected-git.json').items():
        p = pathlib.Path(name)
        assert (hashlib.sha256(p.read_bytes()).hexdigest() if p.exists() else None) == expected, name
    a = load('admission.json')
    own = int(subprocess.check_output(['du','-s','-B1',str(BASE)]).split()[0])
    # Count the entire focused repo/module/selected metadata. The 8MiB focused
    # allowance also covers transient JSON buffers/objects before module output.
    assert own <= a['focusedGitEvidenceMetadataAndOutputAllowance']
    accounted = (sum(a['usedAllocated'].values())+a['importedModuleAllocated']+
        a['sharedLibrariesAndLauncherAllowance']+a['focusedGitEvidenceMetadataAndOutputAllowance']+
        a['reserve'])
    assert accounted == a['total'] <= a['cap']
    assert shutil.disk_usage(BASE).free >= a['hostFloor']
    result = {'verdict':'PASS_RECOVERY_FEASIBILITY_ONLY','compressedChainBytes':totals,
        'canonicalRecoveredLocally':artifact.exists(),'canonicalSHA256':canonical['actualSHA256'],
        'installedBytesRecovered':False,'registryIdentityNewlyVerified':False,
        'ownAllocated':own,'admittedTotalIncludingReserve':accounted,
        'hostFree':shutil.disk_usage(BASE).free,'protectedGitMetadata':'MATCH',
        'guestBuildCompileExecComputeLifecycleWorkerCounts':0}
    (R/'verification.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result))


if __name__ == '__main__':
    main()
