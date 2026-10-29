"""Offline evidence acceptance; never invokes the production runner."""
import base64
import copy
import hashlib
import json
import pathlib

HERE = pathlib.Path(__file__).resolve().parent


def validate(result, lifecycle, fixture):
    assert result['productionInvocations'] == 1
    assert result['gatePASS'] is True and result['safetyCleanup'] is None
    assert result['cliExit'] == 1 and result['report']['accepted'] is False
    backend = result['report']['backendReceipt']
    fs = backend['filesystem']
    assert backend['stopReason'] == fs['failure'] == 'filesystem cumulative write limit'
    assert (fs['written'], fs['live'], fs['peak']) == (16384, 16384, 16384)
    assert (fs['inodes'], fs['openHandles']) == (2, 0)
    assert (fs['liveLimit'], fs['writeLimit'], fs['fileLimit']) == (32768, 16384, 16384)
    checkpoint = json.loads(base64.b64decode(backend['output']['data']))
    assert checkpoint == dict(checkpoint='before-third-write', successfulWriteBytes=16384, fileSize=8192)
    assert result['fixtureSHA256'] == hashlib.sha256(fixture).hexdigest()
    assert backend['cleanupComplete'] is True and result['report']['cleanupComplete'] is True
    assert result['remainingMounts'] == [] and result['productionOwnedIdentityCheck'] is True
    assert result['observedIdentities'] and all(x['absentOrReused'] for x in result['observedIdentities'])
    assert all(result['sourceAfter'][p] == pin['sha256'] for p, pin in result['pins'].items())
    sandbox = lifecycle['sandbox']
    assert sandbox['id'] == 'bx_dngjt3zd' and sandbox['state'] == 'stopped'
    assert sandbox['stop']['status'] == 'completed'
    assert sandbox['snapshotCompletedAt'] and sandbox['snapshotVerifiedAt'] and sandbox['stoppedAt']


def main():
    result = json.loads((HERE/'evidence/runtime-result.json').read_text())
    lifecycle = json.loads((HERE/'evidence/lifecycle.json').read_text())
    fixture = (HERE/'fixture.py').read_bytes()
    validate(result, lifecycle, fixture)
    controls = []
    mutations = {
        'third write accepted': lambda r: r['report'].__setitem__('accepted', True),
        'different failure': lambda r: r['report']['backendReceipt'].__setitem__('stopReason', 'filesystem allocation limit'),
        'overwrite not charged': lambda r: r['report']['backendReceipt']['filesystem'].__setitem__('written', 8192),
        'live growth': lambda r: r['report']['backendReceipt']['filesystem'].__setitem__('peak', 20480),
        'checkpoint missing': lambda r: r['report']['backendReceipt']['output'].__setitem__('data', base64.b64encode(b'{}').decode()),
        'source changed': lambda r: r['sourceAfter'].__setitem__(next(iter(r['pins'])), 'changed'),
        'external cleanup': lambda r: r.__setitem__('safetyCleanup', 'external 8-second guard'),
        'owned identity remains': lambda r: r['observedIdentities'][0].__setitem__('absentOrReused', False),
    }
    for name, mutate in mutations.items():
        changed = copy.deepcopy(result)
        mutate(changed)
        try:
            validate(changed, lifecycle, fixture)
        except AssertionError:
            controls.append(name)
        else:
            raise AssertionError('negative control accepted: '+name)
    print(json.dumps(dict(PASS=True, offlineOnly=True, productionInvocationsAdded=0, rejectingControls=controls)))


if __name__ == '__main__':
    main()
