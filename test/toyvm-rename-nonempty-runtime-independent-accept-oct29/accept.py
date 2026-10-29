"""Offline independent acceptance of one retained production invocation; never replay."""
import ast
import base64
import copy
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
CANDIDATE = '5a88ca099b962e946160afd2d4d71a950bf46db3'
PREDECESSOR = '250946ccb975bb9ea6a6a16c5093d67598614bb6'


def load(path):
    return json.loads(path.read_text())


def pin(data):
    return dict(bytes=len(data), sha256=hashlib.sha256(data).hexdigest())


def checked(path, expected):
    data = path.read_bytes()
    assert pin(data) == expected, str(path)
    return data


def source_guard(source):
    """Require the actual rename branch guard before each destructive statement."""
    cls = next(n for n in ast.parse(source).body if isinstance(n, ast.ClassDef) and n.name == 'Backend')
    handle = next(n for n in cls.body if isinstance(n, ast.FunctionDef) and n.name == 'handle')
    branch = next(n for n in handle.body if isinstance(n, ast.If) and ast.unparse(n.test) == 'op in (12, 45)')
    destination_index, destination = next((i, n) for i, n in enumerate(branch.body)
        if isinstance(n, ast.If) and ast.unparse(n.test) == 'new in dest')
    body = destination.body
    assert ast.unparse(body[0]) == 'previous = dest[new]'
    guard = body[1]
    assert isinstance(guard, ast.If) and ast.unparse(guard.test) == "self.nodes[previous]['names']"
    assert len(guard.body) == 1 and not guard.orelse
    assert ast.unparse(guard.body[0]) == "raise OSError(errno.ENOTEMPTY, 'replacement directory')"
    assert [ast.unparse(n) for n in body[2:]] == ["self.nodes[previous]['links'] -= 1", 'self.collect(previous)']
    assert ast.unparse(branch.body[destination_index + 1]) == 'dest[new] = source.pop(old)'
    # Also reject an early mutation hidden before the destination branch.
    prefix = ast.Module(body=branch.body[:destination_index], type_ignores=[])
    for n in ast.walk(prefix):
        assert not isinstance(n, (ast.AugAssign, ast.Delete))
        if isinstance(n, ast.Call):
            assert ast.unparse(n.func) not in ('self.collect', 'source.pop')
    return True


def accept_record(r, p, fixture, pins):
    expected_argv = ['/usr/bin/python3', '-B', '/tmp/tvrn/repo/test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py',
        '--domain', 'tiny-fixture', '--receipt', '/tmp/tvrn/cancellation.json', '--work', '/tmp/tvrn/w',
        '--live-limit', '20480', '--write-limit', '65536', '--file-limit', '8192', '--rss-limit', '134217728',
        '--cpu-limit', '2', '--wall-limit', '5', '--output-limit', '4096', '--', '/usr/bin/python3', '-B', '-c', fixture]
    assert r['candidate'] == CANDIDATE and r['task'] == 'toyvm-rename-nonempty-runtime-oct29'
    assert r['argv'] == p['argv'] == expected_argv
    assert r['pins'] == p['pins'] == pins
    assert r['sourceAfter'] == {k: v['sha256'] for k, v in pins.items()}
    assert r['fixtureSHA256'] == pin(fixture.encode())['sha256']
    expected_executables = {
        '/usr/bin/python3': dict(bytes=8020928, realpath='/usr/bin/python3.12', sha256='1643dacd9feaedc58f3cc581e4d22577dfe25c09b10282936186ccf0f2e61118'),
        '/usr/bin/fusermount3': dict(bytes=39296, realpath='/usr/bin/fusermount3', sha256='d278775c1528dd32efc85c2cb322423ee93aa8dcf76aaa595f7022d427910704')}
    assert r['executablePins'] == p['executablePins'] == expected_executables
    assert p['socketBytes'] == r['socketBytes'] == 23 and p['socketNoNUL'] is True
    assert r['productionInvocations'] == 1 and r['cliExit'] == 0 and r['cliStderr'] == ''
    report = r['report']; backend = report['backendReceipt']; fs = backend['filesystem']
    assert json.loads(r['cliStdout']) == report
    assert report['accepted'] is True and report['accountingAccepted'] is True
    assert report['childSucceeded'] is True and report['failures'] == [] and report['browserAllowed'] is False
    assert report['cleanupComplete'] is True and backend['cleanupComplete'] is True
    assert backend['exit'] == 0 and backend['stopReason'] is None and fs['failure'] is None
    assert {k: fs[k] for k in ['live', 'peak', 'written', 'inodes', 'openHandles', 'liveLimit', 'writeLimit', 'fileLimit']} == dict(
        live=20480, peak=20480, written=0, inodes=5, openHandles=0, liveLimit=20480, writeLimit=65536, fileLimit=8192)
    payload = base64.b64decode(backend['output']['data'], validate=True).decode()
    assert backend['output']['encoding'] == 'base64' and payload == r['fixtureOutput']
    f = json.loads(payload)
    assert f == dict(checkpoint='rename-nonempty-preserved', errno=39, nodesPreserved=True,
        directoryInodes={'/tmp/tvrn/w/domain/D': 2, '/tmp/tvrn/w/domain/D/S': 3,
            '/tmp/tvrn/w/domain/D/T': 4, '/tmp/tvrn/w/domain/D/T/E': 5})
    assert r['safetyCleanup'] is None and r['remainingMounts'] == []
    cleanup = backend['filesystemCleanup']
    assert cleanup['remainingMounts'] == [] and cleanup['unmountExit'] == 0 and cleanup['serverExit'] == -15
    assert all(cleanup[k] == '' for k in ['serverStdout', 'serverStderr', 'unmountStdout', 'unmountStderr'])
    identities = r['observedIdentities']; assert identities
    observed = {(x['pid'], x['start']) for x in identities}
    assert len(observed) == len(identities)
    assert all(x['absentOrReused'] is True and x['finalState'] is None for x in identities)
    sampled = {(x['pid'], x['start']) for s in r['samples'] for x in s['rows']}
    assert sampled == observed and backend['owned'] and {tuple(x) for x in backend['owned']} <= observed
    assert r['productionOwnedIdentityCheck'] is True
    return f, fs


def main():
    d = load(HERE/'dispatch.json'); retained = HERE/'retained'; anchors = load(HERE/'input-pins.json')
    assert d['candidate'] == CANDIDATE
    checked(HERE/'dispatch.json', anchors['dispatch'])
    checked(retained/'raw-manifest.json', anchors['rawManifest'])
    manifest = load(retained/'raw-manifest.json')
    for rel, expected in manifest.items():
        assert not Path(rel).is_absolute() and '..' not in Path(rel).parts
        checked(retained/rel, expected)
    receipt = load(HERE/'completion-receipt.json')
    checked(HERE/'completion-receipt.json', d['previousVerifiedReceiptPin'])
    assert receipt['commit'] == PREDECESSOR and receipt['remoteVerified'] is True
    assert receipt['remoteRef'] == 'refs/heads/task/toyvm-rename-nonempty-runtime-oct29'
    checked(retained/'runtime-canonical.json', d['retainedRuntimeCanonicalPin'])
    assert receipt['canonicalPin'] == d['retainedRuntimeCanonicalPin']
    # Earliest permitted behavioral boundary is the retained exact production invocation.
    # Never import or execute the production runner or observer in this task.
    r = load(retained/'evidence/result.json'); p = load(retained/'evidence/prelaunch.json')
    fixture = checked(retained/'fixture.py', d['runtimeFixturePin']).decode()
    f, fs = accept_record(r, p, fixture, d['sourcePins'])
    assert (retained/'evidence/cli.stdout').read_text() == r['cliStdout']
    assert (retained/'evidence/cli.stderr').read_text() == r['cliStderr']
    for rel, expected in d['sourcePins'].items():
        checked(REPO/rel, expected)
    stage = load(retained/'stage-manifest.json'); staged = load(retained/'evidence/boat-stage.stdout')
    assert staged['success'] is True and staged['exitCode'] == 0
    assert not staged['stdoutTruncated'] and not staged['stderrTruncated']
    assert json.loads(staged['stdout']) == stage
    assert {k: stage['repo/'+k] for k in d['sourcePins']} == d['sourcePins']
    for name, key in [('fixture.py', 'runtimeFixture'), ('observer.py', 'runtimeObserver'), ('oracle.json', 'sourcePhaseOracle'), ('cancellation.json', 'originalCancellationReceipt')]:
        assert stage[name] == d[key+'Pin']
    checked(retained/'runtime-observer.py', d['runtimeObserverPin'])
    checked(retained/'source-phase-oracle.json', d['sourcePhaseOraclePin'])
    checked(HERE/'cancellation.json', d['originalCancellationReceiptPin'])
    launch = load(retained/'launch-configuration.json')
    assert launch['mountArgv'] == [] and launch['intendedGuestFiles'] == []
    assert set(launch['stagedFiles']) == set(stage)
    assert launch['trustedGitSSH'] == 'ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
    source = (REPO/'test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py').read_text()
    source_guard(source)
    canonical = load(retained/'runtime-canonical.json')
    assert canonical['fixture'] == f and canonical['filesystem'] == fs
    assert canonical['cliExit'] == 0 and canonical['accepted'] is True and canonical['sourceUnchanged'] is True
    boat = load(retained/'evidence/boat-final-info.stdout')['sandbox']
    assert boat['id'] == 'bx_th7j9v6r' and boat['state'] == 'stopped' and boat['snapshotAvailable'] is True
    assert boat['stoppedAt'] == canonical['boat']['stoppedAt'] == '2026-10-29T05:34:53.158Z'
    assert boat['snapshotVerifiedAt'] == canonical['boat']['snapshotVerifiedAt'] == '2026-10-29T05:34:52.082Z'
    controls = {}

    def reject(name, mutate):
        changed = copy.deepcopy(r); mutate(changed)
        # Keep serialized CLI output consistent so semantic controls reach their own gates.
        changed['cliStdout'] = json.dumps(changed['report'])
        try:
            accept_record(changed, p, fixture, d['sourcePins'])
        except (AssertionError, KeyError, ValueError):
            controls[name] = 'REJECTED'
        else:
            raise AssertionError('accepted adversarial control: '+name)

    def payload_change(record, key, value):
        payload = json.loads(record['fixtureOutput']); payload[key] = value
        record['fixtureOutput'] = json.dumps(payload)
        record['report']['backendReceipt']['output']['data'] = base64.b64encode(record['fixtureOutput'].encode()).decode()

    mutations = {
        'stale-identity': lambda x: x['observedIdentities'][0].update(absentOrReused=False),
        'wrong-start-identity': lambda x: x['observedIdentities'][0].update(start='stale'),
        'missing-marker': lambda x: payload_change(x, 'checkpoint', 'absent'),
        'wrong-errno': lambda x: payload_change(x, 'errno', 2),
        'changed-inode': lambda x: payload_change(x, 'directoryInodes', {'/tmp/tvrn/w/domain/D': 2}),
        'nodes-not-preserved': lambda x: payload_change(x, 'nodesPreserved', False),
        'wrong-counter': lambda x: x['report']['backendReceipt']['filesystem'].update(live=16384),
        'missing-counter': lambda x: x['report']['backendReceipt']['filesystem'].pop('written'),
        'wrong-argv': lambda x: x['argv'].__setitem__(10, '16384'),
        'changed-source-before': lambda x: x['pins'][next(iter(x['pins']))].update(sha256='0'*64),
        'changed-source-after': lambda x: x['sourceAfter'].update({next(iter(x['sourceAfter'])): '0'*64}),
        'changed-executable': lambda x: x['executablePins']['/usr/bin/python3'].update(sha256='0'*64),
        'cleanup-incomplete': lambda x: x['report']['backendReceipt'].update(cleanupComplete=False),
        'failed-unmount': lambda x: x['report']['backendReceipt']['filesystemCleanup'].update(unmountExit=1),
        'remaining-mount': lambda x: x.update(remainingMounts=['retained mount']),
        'external-cleanup': lambda x: x.update(safetyCleanup='external guard'),
        'filesystem-failure': lambda x: x['report']['backendReceipt']['filesystem'].update(failure='failure'),
        'stop-reason': lambda x: x['report']['backendReceipt'].update(stopReason='quota'),
    }
    for name, mutate in mutations.items():
        reject(name, mutate)
    guard = "                if self.nodes[previous]['names']:raise OSError(errno.ENOTEMPTY,'replacement directory')\n"
    assert guard in source
    for name, changed in {
        'missing-source-guard': source.replace(guard, ''),
        'late-source-guard': source.replace(guard, '').replace('                self.nodes[previous][\'links\']-=1;self.collect(previous)\n', '                self.nodes[previous][\'links\']-=1;self.collect(previous)\n'+guard),
    }.items():
        try:
            source_guard(changed)
        except (AssertionError, StopIteration, IndexError):
            controls[name] = 'REJECTED'
        else:
            raise AssertionError('accepted source control: '+name)
    result = dict(task=d['task'], outcome='SCOPED_RETAINED_RUNTIME_ACCEPTED', candidate=CANDIDATE,
        predecessorCommit=PREDECESSOR, replayInvocations=0, retainedProductionInvocations=1,
        sourcePins=d['sourcePins'], rawManifestPin=anchors['rawManifest'],
        cliExit=0, accepted=True, fixture=f, postReapMeasuredCounters=fs, controls=controls,
        sourceGuardBeforeLinkDecrementCollectionDestinationAssignment=True,
        sourceArithmeticInference='root + D + S + T + E = 5 * 4096 = 20480; not phase counters',
        backendCallbackExecution='UNPROVEN; syscall errno39 and preservation do not establish callback entry',
        executablePins=r['executablePins'], exactArgv=r['argv'], boat=canonical['boat'],
        limitations=canonical['limitations'] + ['Retained evidence only; no runtime replay or new Boat.',
            'Git alternate-store nesting warnings retained; no alternate stores repaired.'])
    (HERE/'canonical.json').write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps(dict(outcome=result['outcome'], controls=len(controls), replayInvocations=0)))


if __name__ == '__main__':
    main()
