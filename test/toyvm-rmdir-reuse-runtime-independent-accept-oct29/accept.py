"""Offline independent acceptance. Never imports or executes a runtime backend."""
import ast
import base64
import copy
import hashlib
import json
import pathlib

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
TASK = HERE.name
HOST = pathlib.Path('/home/user/wine-assembly/scratch/usage-watch')
DISPATCH = HOST / (TASK + '-dispatch.json')
D = json.loads(DISPATCH.read_text())
RAW = pathlib.Path(D['retainedSourceEvidence'])


def pin(data):
    return dict(bytes=len(data), sha256=hashlib.sha256(data).hexdigest())


def checked(path, expected):
    data = pathlib.Path(path).read_bytes()
    assert pin(data) == expected, ('pin', str(path))
    return data


def source_contract(source):
    tree = ast.parse(source)
    cls = next(n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == 'Backend')
    methods = {n.name: n for n in cls.body if isinstance(n, ast.FunctionDef)}
    create = ast.unparse(methods['create'])
    charge = create.index('self.charge(4096)')
    assert charge < create.index('ino = self.next') < create.index('self.next += 1')
    assert charge < create.index('self.nodes[ino] =') < create.index("n['names'][name] = ino")
    chargecode = ast.unparse(methods['charge'])
    assert chargecode.index('self.live + delta > self.live_limit') < chargecode.index("self.reject('filesystem allocation limit')") < chargecode.index('self.live += delta')
    collect = methods['collect']
    guard = next(n for n in collect.body if isinstance(n, ast.If))
    assert ast.unparse(guard.test) == "not n['links'] and (not n['opens'])"
    assert [ast.unparse(n) for n in guard.body] == ["self.live -= 4096 + (len(n['data']) + 4095) // 4096 * 4096", 'del self.nodes[ino]']
    handle = methods['handle']
    removal = next(n for n in handle.body if isinstance(n, ast.If) and ast.unparse(n.test) == 'op in (10, 11)')
    body = [ast.unparse(n) for n in removal.body]
    assert body[-4:] == ["del n['names'][name]", "self.nodes[child]['links'] -= 1", 'self.collect(child)', "return b''"]
    assert any('op == 11' in s and 'ENOTEMPTY' in s for s in body)
    mkdir = next(n for n in handle.body if isinstance(n, ast.If) and ast.unparse(n.test) == 'op == 9')
    assert 'stat.S_IFDIR' in ast.unparse(mkdir) and 'self.create(' in ast.unparse(mkdir)
    init = ast.unparse(methods['__init__'])
    assert 'self.peak = 4096' in init and 'self.live = 4096' in init
    assert 'links=1, opens=0' in init


def evidence_contract(raw, canonical, fixture, pins):
    # Expected argv is independently constructed, rather than trusted from gatePASS.
    argv = ['/usr/bin/python3', '-B', '/tmp/tvdr/repo/test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py', '--domain', 'tiny-fixture', '--receipt', '/tmp/tvdr/cancellation.json', '--work', '/tmp/tvdr/w', '--live-limit', '12288', '--write-limit', '65536', '--file-limit', '8192', '--rss-limit', '134217728', '--cpu-limit', '2', '--wall-limit', '5', '--output-limit', '4096', '--', '/usr/bin/python3', '-B', '-c', fixture]
    assert raw['argv'] == canonical['argv'] == argv
    assert raw['candidate'] == canonical['candidate'] == D['candidate']
    assert raw['pins'] == canonical['sourcePins'] == pins
    expected_after = {k: v['sha256'] for k, v in pins.items()}
    assert raw['sourceAfter'] == canonical['sourceAfter'] == expected_after
    assert raw['fixtureSHA256'] == D['runtimeFixturePin']['sha256']
    assert raw['productionInvocations'] == canonical['productionInvocations'] == 1
    assert raw['cliExit'] == canonical['cliExit'] == 0
    assert raw['safetyCleanup'] is None and canonical['externalSafetyCleanup'] is None
    assert raw['cliStderr'] == ''
    report = raw['report']
    assert json.loads(raw['cliStdout']) == report
    assert report['accepted'] is True and report['childSucceeded'] is True
    assert report['accountingAccepted'] is True and report['cleanupComplete'] is True
    assert report['failures'] == [] and report['browserAllowed'] is False
    assert report['browserAllowanceRemaining'] == canonical['browserAllowanceRemaining']
    backend = report['backendReceipt']
    assert backend['exit'] == 0 and backend['stopReason'] is None and backend['cleanupComplete'] is True
    fs = backend['filesystem']
    expected = dict(live=12288, peak=12288, written=0, inodes=3, openHandles=0)
    assert {k: fs[k] for k in expected} == canonical['postReap'] == expected
    assert all(type(fs[k]) is int for k in expected)
    assert fs['failure'] is None and fs['liveLimit'] == 12288 and fs['fileLimit'] == 8192 and fs['writeLimit'] == 65536
    assert backend['output']['encoding'] == 'base64'
    payload = base64.b64decode(backend['output']['data'], validate=True).decode()
    assert payload == raw['fixtureOutput']
    assert json.loads(payload) == canonical['fixtureMarker'] == dict(checkpoint='rmdir-reuse-complete', removedE=True, recreatedF=True)
    cleanup = backend['filesystemCleanup']
    assert cleanup['unmountExit'] == 0 and cleanup['serverExit'] == -15
    assert cleanup['remainingMounts'] == raw['remainingMounts'] == canonical['remainingMounts'] == []
    identities = raw['observedIdentities']
    assert identities == canonical['observedIdentities'] and identities
    observed = {(r['pid'], r['start']) for s in raw['samples'] for r in s['rows']}
    assert len({(r['pid'], r['start']) for r in identities}) == len(identities)
    for r in identities:
        assert type(r['pid']) is int and r['pid'] > 0 and r['start'].isdigit()
        assert (r['pid'], r['start']) in observed
        assert r['absentOrReused'] is True and r['finalState'] is None
    assert backend['owned'] and {tuple(x) for x in backend['owned']} <= observed
    assert raw['productionOwnedIdentityCheck'] is True
    assert any('fuse_backend.py /tmp/tvdr/w/domain /tmp/tvdr/w/status.sock 12288 65536 8192 ' in r['cmd'] for r in identities)
    assert raw['executablePins'] == canonical['executablePins']
    assert raw['socketBytes'] == canonical['socketBytes'] == len(b'/tmp/tvdr/w/status.sock') == 23


def main():
    canonical = json.loads(checked(D['retainedRuntimeCanonical'], D['retainedRuntimeCanonicalPin']))
    checked(D['previousVerifiedReceipt'], D['previousVerifiedReceiptPin'])
    fixture = checked(D['runtimeFixture'], D['runtimeFixturePin']).decode()
    checked(D['runtimeObserver'], D['runtimeObserverPin'])
    checked(D['originalCancellationReceipt'], D['originalCancellationReceiptPin'])
    checked(ROOT / 'limit_contract.py', D['limitModulePin'])
    manifest = json.loads((RAW / 'raw-manifest.json').read_text())
    for name, expected in manifest['files'].items():
        checked(RAW / name, expected)
    sources = {}
    for name, tag in [('qualify_accounted.py', 'caller'), ('confine.py', 'confine'), ('fuse_backend.py', 'backend'), ('supervise_accounted.py', 'adapter'), ('pinned-supervisor.py', 'supervisor')]:
        rel = next(p for p in D['sourcePins'] if p.endswith('/' + name))
        sources[tag] = checked(ROOT / 'e' / (tag + '.stdout'), D['sourcePins'][rel]).decode()
    raw = json.loads((RAW / 'raw/runtime-observer.json').read_text())
    api = json.loads((RAW / 'raw/runtime-api.json').read_text())
    assert api['exitCode'] == 0 and api['launcherFailed'] is False and api['oomKilled'] is False
    assert api['stdoutTruncated'] is False and api['stderrTruncated'] is False
    assert json.loads(api['stdout']) == raw
    assert (RAW / 'raw/cli.stdout').read_text() == raw['cliStdout']
    assert (RAW / 'raw/cli.stderr').read_text() == raw['cliStderr']
    evidence_contract(raw, canonical, fixture, D['sourcePins'])
    # This is the first behavioral checkpoint: exact retained production boundary.
    controls = []
    def reject(name, action):
        try:
            action()
        except (AssertionError, KeyError, ValueError, StopIteration):
            controls.append(name)
        else:
            raise AssertionError('negative control accepted: ' + name)
    mutations = [
        ('wrong-quota-gate', lambda r: r['argv'].__setitem__(10, '65536')),
        ('missing-marker', lambda r: r['report']['backendReceipt']['output'].__setitem__('data', '')),
        ('stale-owned-start', lambda r: r['report']['backendReceipt'].__setitem__('owned', [[5846, '1'] ])),
        ('identity-not-reaped', lambda r: r['observedIdentities'][0].__setitem__('absentOrReused', False)),
        ('mounted-after-reap', lambda r: r['remainingMounts'].append('still mounted')),
        ('wrong-counter', lambda r: r['report']['backendReceipt']['filesystem'].__setitem__('live', 8192)),
        ('wrong-source', lambda r: r['sourceAfter'].__setitem__(next(iter(r['sourceAfter'])), '0'*64)),
        ('wrong-candidate', lambda r: r.__setitem__('candidate', '0'*40)),
        ('external-cleanup', lambda r: r.__setitem__('safetyCleanup', 'guard')),
        ('failed-unmount', lambda r: r['report']['backendReceipt']['filesystemCleanup'].__setitem__('unmountExit', 1)),
    ]
    for name, mutation in mutations:
        r = copy.deepcopy(raw)
        mutation(r)
        # Update redundant stdout so controls exercise semantic checks too.
        r['cliStdout'] = json.dumps(r['report'])
        reject(name, lambda: evidence_contract(r, canonical, fixture, D['sourcePins']))
    source_contract(sources['backend'])
    for name, old, new in [
        ('charge-after-next-mutation', 'self.charge(4096);ino=self.next;self.next+=1', 'ino=self.next;self.next+=1;self.charge(4096)'),
        ('missing-collect', "del n['names'][name];self.nodes[child]['links']-=1;self.collect(child)", "del n['names'][name];self.nodes[child]['links']-=1"),
        ('collect-before-link-decrement', "self.nodes[child]['links']-=1;self.collect(child)", "self.collect(child);self.nodes[child]['links']-=1"),
        ('missing-refund', 'self.live-=4096+', 'self.live-=0+'),
        ('collect-open-inode', "not n['links'] and not n['opens']", "not n['links']"),
        ('wrong-mkdir-type', 'stat.S_IFDIR|(mode&0o777)', 'stat.S_IFREG|(mode&0o777)'),
    ]:
        assert old in sources['backend'], name
        reject(name, lambda old=old, new=new: source_contract(sources['backend'].replace(old, new)))
    caller = sources['caller']; adapter = sources['adapter']
    assert "backend(list(command), work, backend='synchronous-fuse', **limits)" in caller
    assert "return 0 if report['accepted'] else 1" in caller
    assert "result=m.supervise(" in adapter and "result['filesystem']=final" in adapter
    assert adapter.index('result=m.supervise(') < adapter.index('final=snapshot()') < adapter.index("result['filesystem']=final") < adapter.index("'/usr/bin/fusermount3','-u'")
    stopped = json.loads((HOST / 'toyvm-directory-remove-metadata-reuse-oct29/retained-evidence/coordinator-stopped-info.json').read_text())['sandbox']
    assert stopped['id'] == 'bx_47z2wx6m' and stopped['state'] == 'stopped' and stopped['snapshotAvailable'] is True
    result = dict(task=TASK, outcome='SCOPED_RETAINED_RUNTIME_ACCEPTED', candidate=D['candidate'], sourcePins=D['sourcePins'], fixturePin=D['runtimeFixturePin'], originalRuntimeCanonical=D['retainedRuntimeCanonical'], originalRuntimeCanonicalPin=D['retainedRuntimeCanonicalPin'], originalCommit='dab3060be066a7f62b57e1f73d1b7ddd6daddc4c', rawManifestPin=pin((RAW/'raw-manifest.json').read_bytes()), postReap=canonical['postReap'], sourceInferredLivePhases=[4096,8192,12288,8192,12288], rejectedControls=controls, newRuntimeInvocations=0, lifecycle=canonical['lifecycle'], proceduralDeviations=canonical['proceduralDeviations'] + ['Independent worker initial policy reads used inherited root cwd; subsequent commands used explicit owned cwd.'], limitations=['No instantaneous intermediate measurements or direct errno proof.', 'No new runtime, gameplay, browser or general resource acceptance.', 'Git reads succeeded with retained alternate-store nesting warnings; no retry or source substitution.'])
    (HERE / 'canonical.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(dict(outcome=result['outcome'], controls=len(controls), postReap=result['postReap'])))


if __name__ == '__main__':
    main()
