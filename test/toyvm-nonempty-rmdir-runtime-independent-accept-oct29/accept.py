"""Offline review of exact production source and retained actual CLI/FUSE evidence.
No imports of executable predecessor modules, subprocesses, runtime or callbacks.
Run through task-owned ops.py with the supplied unchanged limits.
"""
import ast
import base64
import copy
import hashlib
import json
from pathlib import Path
import resource

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
D = json.loads((HERE / 'dispatch.json').read_text())
T = HERE / 'retained/test'


def load(p):
    return json.loads(p.read_text())


def pin(b):
    return dict(bytes=len(b), sha256=hashlib.sha256(b).hexdigest())


def source_guard(text):
    tree = ast.parse(text)
    cls = next(x for x in tree.body if isinstance(x, ast.ClassDef) and x.name == 'Backend')
    handle = next(x for x in cls.body if isinstance(x, ast.FunctionDef) and x.name == 'handle')
    branch = next(x for x in handle.body if isinstance(x, ast.If) and ast.unparse(x.test) == 'op in (10, 11)')
    body = [ast.unparse(x) for x in branch.body]
    guard = next(i for i, x in enumerate(branch.body) if isinstance(x, ast.If) and
                 ast.unparse(x.test) == "op == 11 and self.nodes[child]['names']")
    node = branch.body[guard]
    assert len(node.body) == 1 and isinstance(node.body[0], ast.Raise)
    assert ast.unparse(node.body[0].exc) == "OSError(errno.ENOTEMPTY, 'directory not empty')"
    delete = body.index("del n['names'][name]")
    decrement = body.index("self.nodes[child]['links'] -= 1")
    collect = body.index('self.collect(child)')
    assert guard < delete < decrement < collect
    # No mutation is allowed earlier within the removal branch.
    assert all(not isinstance(x, (ast.Delete, ast.AugAssign)) for x in branch.body[:guard])
    assert body[0] == "name = data.split(b'\\x00', 1)[0]"
    return dict(guardIndex=guard, deleteIndex=delete, decrementIndex=decrement, collectIndex=collect)


def expected_argv(fixture):
    return ['/usr/bin/python3', '-B', '/tmp/tvne/repo/test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py',
            '--domain', 'tiny-fixture', '--receipt', '/tmp/tvne/cancellation.json', '--work', '/tmp/tvne/w',
            '--live-limit', '12288', '--write-limit', '65536', '--file-limit', '8192',
            '--rss-limit', '134217728', '--cpu-limit', '2', '--wall-limit', '5', '--output-limit', '4096',
            '--', '/usr/bin/python3', '-B', '-c', fixture]


def runtime_gate(r, fixture):
    assert r['candidate'] == D['candidate'] and r['pins'] == D['sourcePins']
    assert r['argv'] == expected_argv(fixture)
    assert r['fixtureSHA256'] == pin(fixture.encode())['sha256']
    assert r['sourceAfter'] == {k: v['sha256'] for k, v in D['sourcePins'].items()}
    assert r['productionInvocations'] == 1 and r['cliExit'] == 0 and r['cliStderr'] == ''
    assert r['safetyCleanup'] is None and r['remainingMounts'] == []
    report = json.loads(r['cliStdout'])
    assert report == r['report'] and report['accepted'] is True
    assert report['cleanupComplete'] is True and report['accountingAccepted'] is True
    assert report['childSucceeded'] is True and report['failures'] == []
    br = report['backendReceipt']
    assert br['exit'] == 0 and br['stopReason'] is None and br['cleanupComplete'] is True
    fs = br['filesystem']
    for key, value in dict(live=12288, peak=12288, written=0, inodes=3, openHandles=0,
                           failure=None, liveLimit=12288, writeLimit=65536, fileLimit=8192).items():
        assert fs[key] == value, key
    payload = base64.b64decode(br['output']['data'], validate=True).decode()
    assert payload == r['fixtureOutput']
    marker = json.loads(payload)
    assert marker['checkpoint'] == 'nonempty-rmdir-preserved'
    assert marker['errno'] == 39 and marker['childPreserved'] is True
    assert marker['directoryInodes'] == {'/tmp/tvne/w/domain/D': 2, '/tmp/tvne/w/domain/D/E': 3}
    cleanup = br['filesystemCleanup']
    assert cleanup['remainingMounts'] == [] and cleanup['unmountExit'] == 0
    assert cleanup['serverExit'] == -15 and cleanup['serverStderr'] == ''
    ids = r['observedIdentities']
    assert ids and all(x['absentOrReused'] is True and x['finalState'] is None for x in ids)
    observed = {(x['pid'], x['start']) for sample in r['samples'] for x in sample['rows']}
    assert {(x['pid'], x['start']) for x in ids} <= observed
    assert set(map(tuple, br['owned'])) <= observed and br['owned']
    assert r['productionOwnedIdentityCheck'] is True
    assert any('fuse_backend.py' in x['cmd'] for sample in r['samples'] for x in sample['rows'])
    return dict(marker=marker, postReapFilesystem=fs, sampledIdentities=len(ids))


def rejected(name, fn, controls):
    try:
        fn()
    except (AssertionError, StopIteration, ValueError, KeyError, SyntaxError):
        controls[name] = 'REJECTED'
    else:
        raise AssertionError('adversarial control accepted: ' + name)


def main():
    assert resource.getrlimit(resource.RLIMIT_DATA) == (134217728, 134217728)
    for rel, want in D['sourcePins'].items():
        assert pin((REPO / rel).read_bytes()) == want, rel
    identity = (HERE/'identity.stdout').read_text().splitlines()
    assert identity == [D['ownedRepo'], D['ownedRepo']+'/.git', D['candidate'], 'task/'+D['task']]
    tree_lines = (HERE/'source-tree.stdout').read_text().splitlines()
    assert len(tree_lines) == len(D['sourcePins'])
    for line in tree_lines:
        info, rel = line.split('\t')
        b = (REPO/rel).read_bytes()
        oid = hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
        assert info == '100644 blob '+oid and rel in D['sourcePins']
    assert (HERE/'origin.stdout').read_text().strip() == 'git@github.com:vgrichina/wine-assembly.git'
    for name, rel in [('runtimeFixture', 'fixture.py'), ('runtimeObserver', 'runtime-observer.py'),
                      ('sourcePhaseOracle', 'source-phase-oracle.json'), ('retainedRuntimeCanonical', 'canonical.json')]:
        assert pin((T / rel).read_bytes()) == D[name + 'Pin']
    assert pin((HERE/'retained/completion-receipt.json').read_bytes()) == D['previousVerifiedReceiptPin']
    for rel, want in load(T/'raw-manifest.json').items():
        assert pin((T/rel).read_bytes()) == want, rel
    for name in ['taskSupervisor', 'limitModule']:
        rel = 'ops.py' if name == 'taskSupervisor' else 'limit_contract.py'
        assert pin((HERE/rel).read_bytes()) == D[name+'Pin']
    pre = load(HERE/'prelaunch-controls.json')
    assert pre['PASS'] and pre['pythonChild'] == [134217728, 134217728]
    assert pre['parentDATA'] == [134217728, -1]
    fixture = (T/'fixture.py').read_text()
    # Earliest relevant boundary: retained API stdout of exact production CLI.
    api = load(T/'evidence/api-runtime.stdout')
    assert api['success'] is True and api['exitCode'] == 0
    assert all(api[k] is False for k in ['timedOut','oomKilled','launcherFailed','stdoutTruncated','stderrTruncated'])
    assert api['stderr'] == '' and api['signal'] is None
    r = json.loads(api['stdout'])
    assert r == load(T/'evidence/runtime-result.json')
    assert r['cliStdout'] == (T/'evidence/cli.stdout').read_text()
    actual = runtime_gate(r, fixture)
    mount = load(T/'evidence/mount-contract.json')
    # Retained launch used --file staging, no filename-bearing mount argv to parse.
    assert mount['mountArgv'] == [] and mount['intendedMountedFiles'] == []
    staged = {x['remote']: {k:x[k] for k in ['bytes','sha256']} for x in mount['stagedFiles']}
    for rel, want in D['sourcePins'].items():
        assert staged['/tmp/tvne/repo/'+rel] == want
    assert staged['/tmp/tvne/fixture.py'] == D['runtimeFixturePin']
    assert staged['/tmp/tvne/runtime-observer.py'] == D['runtimeObserverPin']
    assert staged['/tmp/tvne/cancellation.json'] == D['originalCancellationReceiptPin']
    source = (REPO/'test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py').read_text()
    order = source_guard(source)
    assert 'self.charge(4096);ino=self.next;self.next+=1' in source
    assert 'self.live-=4096+((len(n[\'data\'])+4095)//4096)*4096' in source
    controls = {}
    old = "if op==11 and self.nodes[child]['names']:raise OSError(errno.ENOTEMPTY,'directory not empty')"
    assert old in source
    rejected('missing-nonempty-guard', lambda: source_guard(source.replace(old, 'pass')), controls)
    late = source.replace(old, 'pass').replace("del n['names'][name]", "del n['names'][name];"+old)
    rejected('reordered-nonempty-guard', lambda: source_guard(late), controls)
    rejected('source-wrong-errno', lambda: source_guard(source.replace('errno.ENOTEMPTY', 'errno.ENOENT')), controls)
    for name in ['wrong-errno', 'missing-marker', 'stale-identity', 'wrong-counter', 'source-pin', 'wrong-cli-argv', 'external-cleanup', 'mounted-fuse', 'wrong-start-identity']:
        b = copy.deepcopy(r)
        if name in ['wrong-errno', 'missing-marker']:
            marker = json.loads(b['fixtureOutput'])
            if name == 'wrong-errno': marker['errno'] = 2
            else: del marker['checkpoint']
            payload = json.dumps(marker)
            b['fixtureOutput'] = payload
            b['report']['backendReceipt']['output']['data'] = base64.b64encode(payload.encode()).decode()
        if name == 'stale-identity': b['observedIdentities'][0]['absentOrReused'] = False
        if name == 'wrong-counter': b['report']['backendReceipt']['filesystem']['live'] = 8192
        if name == 'source-pin': b['sourceAfter'][next(iter(D['sourcePins']))] = '0'*64
        if name == 'wrong-cli-argv': b['argv'][12] = '65535'
        if name == 'external-cleanup': b['safetyCleanup'] = 'external guard'
        if name == 'mounted-fuse': b['remainingMounts'] = ['retained mount']
        if name == 'wrong-start-identity': b['observedIdentities'][0]['start'] = 'stale'
        b['cliStdout'] = json.dumps(b['report'])
        rejected(name, lambda: runtime_gate(b, fixture), controls)
    stopped = load(T/'evidence/api-info.stdout')['sandbox']
    assert stopped['id'] == 'bx_27q3w7ee' and stopped['state'] == 'stopped'
    assert stopped['stop']['status'] == 'completed' and stopped['stop']['error'] is None
    assert stopped['snapshotVerifiedAt'] == '2026-10-29T05:31:34.510Z'
    assert stopped['stoppedAt'] == '2026-10-29T05:31:34.547Z'
    completion = load(HERE/'retained/completion-receipt.json')
    assert completion['commit'] == '0d21814df575b5b7f2c299e5e27f012c044adbe6'
    assert completion['remoteVerified'] is True and completion['actualStoppedVerified'] is True
    incident = completion['incident']
    assert incident['actualMemAvailableBytes'] is None and incident['retry'] is False
    assert incident['controlsChanged'] is False
    # Successful allocation response was JSONL; preserve the failed parser and recovery.
    try: json.loads((T/'evidence/api-new.stdout').read_text())
    except json.JSONDecodeError: pass
    else: raise AssertionError('expected retained whole-document parser incident')
    lines = [json.loads(x) for x in (T/'evidence/api-new.stdout').read_text().splitlines() if x.strip()]
    assert lines and 'JSONDecodeError' in (T/'evidence/boat-new.stderr').read_text()
    assert 'alternate' in (T/'evidence/git-status.stderr').read_text().lower()
    result = dict(outcome='SCOPED_INDEPENDENT_RETAINED_RUNTIME_ACCEPTED', candidate=D['candidate'],
                  sourcePins=D['sourcePins'], sourceOrder=order, sourceInference=dict(metadataPerInode=4096,
                  rootPlusDPlusE=12288, callbackExecutionObserved=False), actual=actual, controls=controls,
                  newRuntimeInvocations=0, productionInvocationsRetained=1, box=dict(id=stopped['id'],
                  state=stopped['state'], stoppedAt=stopped['stoppedAt'], originalExpiry='2026-10-29T06:00:38.936Z'),
                  predecessorCommit=completion['commit'], predecessorRemoteRef=completion['remoteRef'],
                  predecessorCloseoutIncident=incident, publicationReceiptExists=False,
                  limitations=['Counters observed post-reap, not instantaneously during failed rmdir',
                  'PID/start cleanup is limited to sampled identities', 'Retained actual runtime only; no replay',
                  'Coordinator remote verification and durable completion receipt supplement missing worker closeout',
                  'No broad resource, browser or gameplay acceptance'], remainingGates=['Coordinator messageboard publication',
                  'Review before integration; no main or public deployment'])
    (HERE/'canonical.json').write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps(dict(outcome=result['outcome'], controls=len(controls), newRuntimeInvocations=0)))


if __name__ == '__main__':
    main()
