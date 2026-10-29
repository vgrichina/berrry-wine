"""Offline independent acceptance; never imports or executes the retained runner."""
import ast
import base64
import copy
import hashlib
import json
import pathlib

HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parent.parent
CANDIDATE = '5a88ca099b962e946160afd2d4d71a950bf46db3'
PREDECESSOR = '6cf18d270c053bf65af79dd5b02aeafd1891b163'
ANCHORS = {
    'dispatch.json': '2b36c60b10a2aa320462273a7197c7f20bd2bafcc1b00a5eb7658fde382147f2',
    'retained/manifest.json': '9ee01de50d98f2d24919cd1f50ead3d9497a15a919018b176b741aa517d5ed56',
    'retained/test/raw-manifest.json': '8d40fedca971ee99e5c2428b9f492da022e666069ff15dd279fbc38ca22ad3f6',
    'prelaunch-controls.json': 'e7899166477ada0da71bf6976f3d33389906c17c29e28f5999662a2d72a74cf5',
}

def load(p):
    return json.loads(p.read_text())

def pin(p):
    b = p.read_bytes()
    return dict(bytes=len(b), sha256=hashlib.sha256(b).hexdigest())

def source_guard(text):
    tree = ast.parse(text)
    backend = next(x for x in tree.body if isinstance(x, ast.ClassDef) and x.name == 'Backend')
    handle = next(x for x in backend.body if isinstance(x, ast.FunctionDef) and x.name == 'handle')
    branch = next(x for x in handle.body if isinstance(x, ast.If) and ast.unparse(x.test) == 'op in (12, 45)')
    body = branch.body
    guard = next(i for i, x in enumerate(body) if isinstance(x, ast.If) and ast.unparse(x.test) == 'ino == newdir and old == new')
    assert len(body[guard].body) == 1 and isinstance(body[guard].body[0], ast.Return)
    assert isinstance(body[guard].body[0].value, ast.Constant) and body[guard].body[0].value.value == b''
    replacement = next(i for i, x in enumerate(body) if isinstance(x, ast.If) and ast.unparse(x.test) == 'new in dest')
    assert guard + 1 == replacement
    prior = ast.unparse(ast.Module(body=body[:guard], type_ignores=[]))
    assert 'self.collect(' not in prior and '.pop(' not in prior and "['links']" not in prior
    replacement_text = ast.unparse(body[replacement])
    assert replacement_text.index("['links'] -= 1") < replacement_text.index('self.collect(previous)')
    assert replacement < next(i for i, x in enumerate(body) if ast.unparse(x) == 'dest[new] = source.pop(old)')
    assert 'self.charge(4096)' in text and 'self.peak=4096;self.live=4096' in text
    return True

def runtime(c, pre, fixture, pins):
    expected = ['/usr/bin/python3', '-B', '/tmp/tvrs/repo/test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py',
                '--domain', 'tiny-fixture', '--receipt', '/tmp/tvrs/cancellation.json', '--work', '/tmp/tvrs/w',
                '--live-limit', '12288', '--write-limit', '65536', '--file-limit', '8192', '--rss-limit', '134217728',
                '--cpu-limit', '2', '--wall-limit', '5', '--output-limit', '4096', '--', '/usr/bin/python3', '-B', '-c', fixture]
    assert c['candidate'] == CANDIDATE and c['productionInvocations'] == 1
    assert c['argv'] == pre['argv'] == expected
    assert c['pins'] == pre['pins'] == pins
    assert c['sourceAfter'] == {k: v['sha256'] for k, v in pins.items()}
    assert c['fixtureSHA256'] == hashlib.sha256(fixture.encode()).hexdigest()
    assert c['executablePins'] == pre['executablePins'] == {
        '/usr/bin/python3': dict(bytes=8020928, realpath='/usr/bin/python3.12', sha256='1643dacd9feaedc58f3cc581e4d22577dfe25c09b10282936186ccf0f2e61118'),
        '/usr/bin/fusermount3': dict(bytes=39296, realpath='/usr/bin/fusermount3', sha256='d278775c1528dd32efc85c2cb322423ee93aa8dcf76aaa595f7022d427910704')}
    assert c['socketBytes'] == pre['socketBytes'] == 23 and pre['socketNoNUL'] is True
    assert c['cliExit'] == 0 and c['cliStderr'] == '' and c['safetyCleanup'] is None
    report = c['report']
    assert json.loads(c['cliStdout']) == report
    for k in ['accepted', 'accountingAccepted', 'childSucceeded', 'cleanupComplete']:
        assert report[k] is True
    assert report['failures'] == [] and report['browserAllowed'] is False
    br = report['backendReceipt']
    assert br['exit'] == 0 and br['stopReason'] is None and br['cleanupComplete'] is True
    fs = br['filesystem']
    for k, v in dict(live=12288, peak=12288, written=0, inodes=3, openHandles=0, liveLimit=12288, writeLimit=65536, fileLimit=8192, failure=None).items():
        assert fs[k] == v, k
    output = base64.b64decode(br['output']['data'], validate=True).decode()
    assert br['output']['encoding'] == 'base64' and output == c['fixtureOutput']
    marker = json.loads(output)
    assert marker == dict(checkpoint='rename-samepath-preserved', nodesPreserved=True,
                          directoryInodes={'/tmp/tvrs/w/domain/D': 2, '/tmp/tvrs/w/domain/D/E': 3})
    cleanup = br['filesystemCleanup']
    assert cleanup['remainingMounts'] == c['remainingMounts'] == []
    assert cleanup['unmountExit'] == 0 and cleanup['serverExit'] == -15
    assert cleanup['unmountStderr'] == cleanup['serverStderr'] == ''
    identities = c['observedIdentities']
    assert len(identities) == 3 and c['productionOwnedIdentityCheck'] is True
    sampled = {(r['pid'], r['start']) for s in c['samples'] for r in s['rows']}
    observed = {(r['pid'], r['start']) for r in identities}
    assert sampled == observed and len(observed) == 3
    assert br['owned'] and {tuple(x) for x in br['owned']} <= observed
    assert all(r['absentOrReused'] is True and r['finalState'] is None for r in identities)
    assert any('/fuse_backend.py ' in r['cmd'] for r in identities)
    assert any(' -c import os,stat,json' in r['cmd'] for r in identities)
    return True

def main():
    for rel, digest in ANCHORS.items():
        assert pin(HERE / rel)['sha256'] == digest, rel
    retained = HERE / 'retained'
    for base, manifest in [(retained, retained/'manifest.json'), (retained/'test', retained/'test/raw-manifest.json')]:
        for rel, want in load(manifest).items():
            p = (base/rel).resolve()
            assert p.is_relative_to(base.resolve()) and pin(p) == want, rel
    d = load(HERE/'dispatch.json')
    assert d['candidate'] == CANDIDATE and len(d['sourcePins']) == 5
    for rel, want in d['sourcePins'].items():
        assert pin(REPO/rel) == want, rel
    for key, rel in [('retainedRuntimeCanonical', 'test/runtime-canonical.json'), ('previousVerifiedReceipt', 'completion-receipt.json'),
                     ('runtimeFixture', 'test/fixture.py'), ('runtimeObserver', 'test/runtime-observer.py'), ('sourcePhaseOracle', 'test/source-phase-oracle.json')]:
        assert pin(retained/rel) == d[key+'Pin']
    receipt = load(retained/'completion-receipt.json')
    assert receipt['commit'] == PREDECESSOR and receipt['remoteVerified'] is True
    assert (retained/'remote-verified.stdout').read_text().split() == [PREDECESSOR, receipt['remoteRef']]
    assert receipt['boat'] == 'bx_h4faubeu' and receipt['actualStoppedVerified'] is True
    assert receipt['stoppedAt'] == '2026-10-29T05:34:09.218Z'
    b = retained/'test'
    c, pre = load(b/'runtime-canonical.json'), load(b/'raw/guest-prelaunch.json')
    # Start with retained actual production boundary, never the predecessor's gate boolean.
    fixture = (b/'fixture.py').read_text()
    assert fixture.index('os.mkdir(D);os.mkdir(E)') < fixture.index('before=') < fixture.index('os.rename(E,E)') < fixture.index('current.st_ino==before[x]')
    assert runtime(c, pre, fixture, d['sourcePins'])
    assert c == load(b/'raw/guest-result.json')
    assert c['cliStdout'] == (b/'raw/guest-cli.stdout').read_text()
    assert c['cliStderr'] == (b/'raw/guest-cli.stderr').read_text()
    api = load(b/'raw/boat-real-cli.stdout')
    assert api['exitCode'] == 0 and api['launcherFailed'] is False and api['oomKilled'] is False
    assert not api['stdoutTruncated'] and not api['stderrTruncated'] and api['stderr'] == ''
    assert json.loads(api['stdout']) == c
    launch = load(b/'raw/launch-configuration.json')
    assert launch['mountArgv'] == launch['intendedGuestMountFiles'] == []
    assert launch['trustedGitSSH'] == 'ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
    # Separate --file arguments, split only once on '='; commas remain in filenames.
    args = launch['fileArgv']
    parsed = dict(args[i+1].split('=', 1) for i, v in enumerate(args) if v == '--file')
    assert parsed == {k: v['local'] for k, v in launch['files'].items()}
    for rel, want in d['sourcePins'].items():
        got = launch['files']['/tmp/tvrs/repo/'+rel]
        assert {k: got[k] for k in ['bytes', 'sha256']} == want
    source = (REPO/'test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py').read_text()
    assert source_guard(source)
    controls = {}
    def reject(name, fn):
        try:
            fn()
        except (AssertionError, KeyError, StopIteration, ValueError, SyntaxError):
            controls[name] = 'REJECTED'
        else:
            raise AssertionError('adversarial control accepted: '+name)
    mutations = {
        'stale-identity': lambda x: x['observedIdentities'][0].update(absentOrReused=False),
        'changed-start-identity': lambda x: x['observedIdentities'][0].update(start='stale'),
        'missing-marker': lambda x: x.update(fixtureOutput='{}'),
        'wrong-counter': lambda x: x['report']['backendReceipt']['filesystem'].update(live=8192),
        'changed-argv': lambda x: x['argv'].__setitem__(10, '8192'),
        'changed-source-after': lambda x: x['sourceAfter'].update({next(iter(d['sourcePins'])): '0'*64}),
        'changed-source-before': lambda x: x['pins'].pop(next(iter(d['sourcePins']))),
        'changed-executable': lambda x: x['executablePins']['/usr/bin/python3'].update(sha256='0'*64),
        'cleanup-incomplete': lambda x: x['report']['backendReceipt'].update(cleanupComplete=False),
        'mount-remains': lambda x: x.update(remainingMounts=['fuse']),
        'external-safety-cleanup': lambda x: x.update(safetyCleanup='kill'),
    }
    for name, mutate in mutations.items():
        x = copy.deepcopy(c)
        mutate(x)
        # Keep redundant output copies consistent to exercise the semantic checks.
        x['cliStdout'] = json.dumps(x['report'])
        if name == 'missing-marker':
            x['report']['backendReceipt']['output']['data'] = base64.b64encode(b'{}').decode()
            x['cliStdout'] = json.dumps(x['report'])
        reject(name, lambda: runtime(x, pre, fixture, d['sourcePins']))
    guard = "            if ino==newdir and old==new:return b''\n"
    assert source.count(guard) == 1
    reject('missing-source-guard', lambda: source_guard(source.replace(guard, '')))
    late = source.replace(guard, '').replace('            dest[new]=source.pop(old)', guard+'            dest[new]=source.pop(old)')
    reject('late-source-guard', lambda: source_guard(late))
    parent_controls = load(HERE/'prelaunch-controls.json')
    assert parent_controls['PASS'] is True and parent_controls['pythonChild'] == [134217728, 134217728]
    result = dict(outcome='INDEPENDENT_SCOPED_ACCEPTANCE_PASS', candidate=CANDIDATE, predecessor=PREDECESSOR,
                  sourcePins=d['sourcePins'], canonicalPin=pin(b/'runtime-canonical.json'), anchors=ANCHORS,
                  retainedProductionBoundary=True, controls=controls, controlsPassed=len(controls),
                  measuredPostReap=dict(live=12288, peak=12288, written=0, inodes=3, openHandles=0),
                  sourceInference='root+D+E: 3*4096=12288; same-path return precedes replacement, link decrement, collection and source pop',
                  backendCallbackExecution='UNPROVEN: kernel may short-circuit same-path rename',
                  newRuntimeInvocations=0, boat='bx_h4faubeu', boatState='snapshot-stopped',
                  stoppedAt=receipt['stoppedAt'], originalExpiry='2026-10-29T06:03:31.190Z',
                  lifecycleOperations=0, alternateStoreWarning=receipt['incident'],
                  limitations=['Retained evidence acceptance only', 'No browser/gameplay/general resource acceptance',
                               'No direct backend callback coverage', 'Coordinator integration review remains'])
    (HERE/'canonical.json').write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps(dict(outcome=result['outcome'], controlsPassed=len(controls), newRuntimeInvocations=0)))

if __name__ == '__main__':
    main()
