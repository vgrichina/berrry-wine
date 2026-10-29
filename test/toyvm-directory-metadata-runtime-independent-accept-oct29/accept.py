"""Independent retained-evidence acceptance. Never import/execute the backend."""
import ast
import base64
import copy
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
TASK = HERE.name
HOST = Path('/home/user/wine-assembly/scratch/usage-watch')
OLD = Path('/tmp/toyvm-directory-metadata-limit-oct29/repo/test/toyvm-directory-metadata-limit-oct29')
RETAINED = HOST / 'toyvm-directory-metadata-limit-oct29/retained-evidence'
CANDIDATE = '5a88ca099b962e946160afd2d4d71a950bf46db3'

def load(path):
    return json.loads(path.read_text())

def pin(data):
    return dict(bytes=len(data), sha256=hashlib.sha256(data).hexdigest())

def require(ok, reason):
    if not ok:
        raise ValueError(reason)

def method(tree, name):
    return next(n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef) and n.name == name)

def source_contract(text):
    """AST statements, never a surrogate backend execution."""
    tree = ast.parse(text)
    create = method(tree, 'create')
    statements = [ast.unparse(n) for n in create.body]
    charge = statements.index('self.charge(4096)')
    allocate = next(i for i, s in enumerate(statements) if s.startswith('self.nodes[ino] ='))
    entry = statements.index("n['names'][name] = ino")
    require(charge < statements.index('ino = self.next') < allocate < entry, 'charge before all inode/entry mutations')
    charge_fn = method(tree, 'charge')
    require(isinstance(charge_fn.body[0], ast.If), 'quota check first')
    require(ast.unparse(charge_fn.body[0].test) == 'self.live + delta > self.live_limit', 'live quota gate')
    require(ast.unparse(charge_fn.body[0].body[0]) == "self.reject('filesystem allocation limit')", 'allocation reason')
    init = ast.unparse(method(tree, '__init__'))
    require('self.live = 4096' in init and 'self.peak = 4096' in init and 'self.next = 2' in init, 'root metadata')
    require("self.nodes = {1: dict(mode=stat.S_IFDIR | 448, data=bytearray(), names={}, links=1, opens=0)}" in init, 'one root directory')
    handle = ast.unparse(method(tree, 'handle'))
    require("child = self.create(ino, data[8:].split(b'\\x00', 1)[0], stat.S_IFDIR | mode & 511)" in handle, 'MKDIR calls charged create')
    collect = method(tree, 'collect')
    guard = collect.body[1]
    require(ast.unparse(guard.test) == "not n['links'] and (not n['opens'])", 'collection waits for links and handles')
    require(ast.unparse(guard.body[0]) == "self.live -= 4096 + (len(n['data']) + 4095) // 4096 * 4096", 'metadata reclaimed exactly once')
    require(ast.unparse(guard.body[1]) == 'del self.nodes[ino]', 'collection removes inode')
    return dict(inferredLive=[4096, 8192, 12288], rejectedWouldRequire=16384,
                nextMetadataCharge=4096, rejectionBefore='inode allocation, inode insertion and parent entry mutation')

def evidence_contract(r, expected_pins, fixture, prelaunch):
    require(r['candidate'] == CANDIDATE and r['task'] == 'toyvm-directory-metadata-limit-oct29', 'candidate/task')
    require(r['pins'] == expected_pins, 'source before identities')
    require(r['sourceAfter'] == {k: v['sha256'] for k, v in expected_pins.items()}, 'source after identities')
    require(r['fixtureSHA256'] == pin(fixture.encode())['sha256'], 'fixture identity')
    argv = ['/usr/bin/python3', '-B', '/tmp/tvdm/repo/test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py',
            '--domain', 'tiny-fixture', '--receipt', '/tmp/tvdm/cancellation.json', '--work', '/tmp/tvdm/w',
            '--live-limit', '12288', '--write-limit', '65536', '--file-limit', '8192', '--rss-limit', '134217728',
            '--cpu-limit', '2', '--wall-limit', '5', '--output-limit', '4096', '--', '/usr/bin/python3', '-B', '-c', fixture]
    require(r['argv'] == prelaunch['argv'] == argv, 'actual production argv and unchanged reproducer')
    require(r['executablePins'] == prelaunch['executablePins'], 'recorded executable identities')
    require(r['productionInvocations'] == 1 and r['cliExit'] == 1 and r['safetyCleanup'] is None, 'single invocation without safety cleanup')
    report = r['report']
    require(json.loads(r['cliStdout']) == report, 'raw CLI report agreement')
    require(report['accepted'] is False and report['browserAllowed'] is False and report['cleanupComplete'] is True, 'CLI result')
    br = report['backendReceipt']
    fs = br['filesystem']
    require(br['stopReason'] == fs['failure'] == 'filesystem allocation limit', 'allocation gate, not file/write gate')
    expected = dict(live=12288, peak=12288, written=0, inodes=3, openHandles=0)
    require({k: fs[k] for k in expected} == expected, 'post-reap counters')
    require([fs[k] for k in ['liveLimit', 'writeLimit', 'fileLimit']] == [12288, 65536, 8192], 'quota identities')
    payload = base64.b64decode(br['output']['data'], validate=True).decode()
    require(payload == r['fixtureOutput'], 'raw payload agreement')
    require(json.loads(payload) == dict(checkpoint='before-directory-metadata-over-budget', existingDirectory=True,
                                      existingEmptyFile=True, attemptedNewDirectory='D/E'), 'fixture marker and path/type assertions')
    cleanup = br['filesystemCleanup']
    require(br['cleanupComplete'] is True and r['remainingMounts'] == cleanup['remainingMounts'] == [], 'disconnected FUSE mount')
    require(cleanup['unmountExit'] == 0 and cleanup['serverExit'] in (0, -15), 'unmount and server completion')
    observed = {(x['pid'], x['start']): x for x in r['observedIdentities']}
    sampled = {(x['pid'], x['start']) for s in r['samples'] for x in s['rows']}
    require(observed and set(observed) == sampled, 'every sampled owned PID/start covered at cleanup')
    require(all(x['absentOrReused'] is True and x['finalState'] is None for x in observed.values()), 'PID/start absent after cleanup')
    require(br['owned'] and all(tuple(x) in observed for x in br['owned']), 'owned PID/start identities')
    rows = [x for s in r['samples'] for x in s['rows']]
    require(any('/qualify_accounted.py --domain tiny-fixture' in x['cmd'] for x in rows), 'actual CLI process sample')
    require(any('/fuse_backend.py /tmp/tvdm/w/domain /tmp/tvdm/w/status.sock 12288 65536 8192' in x['cmd'] for x in rows), 'actual FUSE boundary sample')
    require(any(x['cmd'].startswith('/usr/bin/python3 -B -c import os,json,stat') for x in rows), 'actual fixture process sample')
    return expected

def main():
    dispatch = load(HOST / (TASK + '-dispatch.json'))
    require(dispatch['candidate'] == CANDIDATE, 'dispatch candidate')
    sources = dispatch['sourcePins']
    for rel, expected in sources.items():
        require(pin((REPO / rel).read_bytes()) == expected, 'owned source pin ' + rel)
    for key in ['previousVerifiedReceipt', 'runtimeFixture', 'runtimeObserver', 'sourcePhaseOracle', 'retainedRuntimeCanonical', 'limitModule']:
        require(pin(Path(dispatch[key]).read_bytes()) == dispatch[key + 'Pin'], key + ' identity')
    artifacts = load(OLD / 'artifact-pins.json')
    for rel, expected in artifacts.items():
        require(pin((OLD / rel).read_bytes()) == expected, 'committed artifact ' + rel)
    fixture = Path(dispatch['runtimeFixture']).read_text()
    raw = load(OLD / 'runtime-raw.json')
    prelaunch = load(OLD / 'prelaunch.json')
    launch = load(OLD / 'launch-configuration.json')
    trusted_ssh = 'ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
    require(launch['gitSSH'] == trusted_ssh and launch['mountArgv'] == launch['intendedMountFiles'] == [], 'unchanged exact launch configuration')
    require(trusted_ssh in (REPO.parent / 'ops.py').read_text(), 'direct supervisor uses trusted SSH configuration')
    # First behavioral checkpoint is retained exact production CLI/FUSE evidence.
    measured = evidence_contract(raw, sources, fixture, prelaunch)
    backend = (REPO / 'test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py').read_text()
    inference = source_contract(backend)
    caller = (REPO / 'test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py').read_text()
    adapter = (REPO / 'test/toyvm-kernel-profile-accounting-backend-oct28/supervise_accounted.py').read_text()
    require("backend = load_backend()" in caller and "backend='synchronous-fuse'" in caller, 'CLI adapter wiring')
    require("str(HERE/'fuse_backend.py')" in adapter and "result=m.supervise(" in adapter, 'adapter backend wiring')
    require(adapter.index('result=m.supervise(') < adapter.index('final=snapshot()') < adapter.index("result['filesystem']=final"), 'post-supervision snapshot')
    controls = []
    def reject(name, mutate):
        bad = copy.deepcopy(raw)
        mutate(bad)
        try:
            evidence_contract(bad, sources, fixture, prelaunch)
        except (ValueError, KeyError, TypeError):
            controls.append(name)
        else:
            raise AssertionError('accepted adversarial control ' + name)
    def changed_report(r, change):
        change(r['report'])
        r['cliStdout'] = json.dumps(r['report'])
    reject('wrong-perfile-gate', lambda r: changed_report(r, lambda p: p['backendReceipt'].update(stopReason='filesystem per-file limit')))
    reject('wrong-write-gate', lambda r: changed_report(r, lambda p: p['backendReceipt']['filesystem'].update(failure='filesystem cumulative write limit')))
    reject('missing-marker', lambda r: (r.update(fixtureOutput='{}'), changed_report(r, lambda p: p['backendReceipt']['output'].update(data=base64.b64encode(b'{}').decode()))))
    reject('wrong-argv', lambda r: r['argv'].__setitem__(10, '16384'))
    reject('wrong-source-before', lambda r: r['pins'][next(iter(sources))].update(sha256='0'*64))
    reject('wrong-source-after', lambda r: r['sourceAfter'].update({next(iter(sources)): '0'*64}))
    reject('stale-owned-start', lambda r: changed_report(r, lambda p: p['backendReceipt']['owned'][0].__setitem__(1, 'stale')))
    reject('stale-observed-start', lambda r: r['observedIdentities'][0].update(start='stale'))
    reject('missing-backend-identity', lambda r: r['observedIdentities'].__delitem__(1))
    reject('unreaped-identity', lambda r: r['observedIdentities'][0].update(absentOrReused=False))
    reject('still-mounted', lambda r: changed_report(r, lambda p: p['backendReceipt']['filesystemCleanup'].update(remainingMounts=['FUSE'])))
    reject('forged-accepted', lambda r: changed_report(r, lambda p: p.update(accepted=True)))
    reject('external-safety-cleanup', lambda r: r.update(safetyCleanup='external guard'))
    for key, wrong in [('live', 8192), ('peak', 16384), ('written', 1), ('inodes', 4), ('openHandles', 1)]:
        reject('wrong-' + key, lambda r, k=key, w=wrong: changed_report(r, lambda p: p['backendReceipt']['filesystem'].update({k: w})))
    mutations = {
        'late-metadata-charge': backend.replace('self.charge(4096);ino=self.next;self.next+=1', 'ino=self.next;self.next+=1').replace("n['names'][name]=ino", "n['names'][name]=ino;self.charge(4096)"),
        'write-instead-of-live-gate': backend.replace('self.live+delta>self.live_limit', 'self.written+delta>self.write_limit'),
        'unconditional-collection': backend.replace("if not n['links'] and not n['opens']:", 'if True:'),
        'missing-metadata-reclaim': backend.replace("self.live-=4096+((len(n['data'])+4095)//4096)*4096", "self.live-=((len(n['data'])+4095)//4096)*4096"),
    }
    for name, mutation in mutations.items():
        require(mutation != backend, 'nonvacuous mutation ' + name)
        try:
            source_contract(mutation)
        except (ValueError, StopIteration, IndexError):
            controls.append(name)
        else:
            raise AssertionError('source mutation accepted ' + name)
    manifest = load(OLD / 'raw-evidence-manifest.json')
    rawroot = Path(manifest['root'])
    delta = load(RETAINED / 'historical-manifest-delta.json')
    changed = {}
    for rel, expected in manifest['artifacts'].items():
        actual = pin((rawroot / rel).read_bytes())
        if actual != expected:
            changed[rel] = dict(expected=expected, actual=actual)
    require(changed == delta['appendOnlyAdmissionLogAfterHistoricalManifest'], 'only declared historical delta')
    log = (rawroot / 'admissions.jsonl').read_bytes()
    sealed = manifest['artifacts']['admissions.jsonl']
    require(pin(log[:sealed['bytes']]) == sealed, 'sealed admission prefix unchanged')
    appended = [json.loads(x) for x in log[sealed['bytes']:].splitlines()]
    require(appended and all(x['free'] >= x['requiredFloor'] + x['taskAllocation'] and x['MemAvailable'] >= 2147483648 for x in appended), 'append admission floors')
    canonical = load(Path(dispatch['retainedRuntimeCanonical']))
    require(canonical['postReap'] == measured and canonical['cliExit'] == raw['cliExit'], 'canonical agrees with actual')
    lifecycle = load(RETAINED / 'coordinator-stopped-info.json')['sandbox']
    require(lifecycle['id'] == 'bx_489jsaq6' and lifecycle['state'] == 'stopped' and lifecycle['snapshotAvailable'] is True, 'coordinator stopped snapshot')
    result = dict(task=TASK, outcome='PASS_SCOPED_RETAINED_RUNTIME_ACCEPTANCE', candidate=CANDIDATE,
                  sourcePins=sources, fixturePin=pin(fixture.encode()), canonicalPin=pin(Path(dispatch['retainedRuntimeCanonical']).read_bytes()),
                  retainedRawPin=pin((OLD / 'runtime-raw.json').read_bytes()), measuredPostReap=measured,
                  independentlyInferred=inference, controlsRejected=controls, newProductionInvocations=0,
                  historicalManifest=dict(unchangedEntries=len(manifest['artifacts'])-1, changed=changed,
                                          sealedAdmissionPrefixMatches=True, appendedRows=len(appended), scopedAcceptanceAffected=False),
                  lifecycle=dict(box=lifecycle['id'], retainedState=lifecycle['state'], snapshotAvailable=True,
                                 originalExpiry='2026-10-29T05:43:31.559Z', owner='coordinator', newAPICalls=0),
                  limitations=['No new runtime invocation or acceptance claim', 'No direct errno or instantaneous/realtime counters',
                               'No RMDIR reuse runtime tested or claimed in this assigned case', 'No gameplay/browser/general-resource acceptance',
                               'Original helper validation error corrected before passing; historical diagnostics preserved',
                               'Full historical raw manifest does not match: admission log appended after seal'])
    (HERE / 'canonical.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(dict(outcome=result['outcome'], controlsRejected=len(controls), newProductionInvocations=0, canonical=str(HERE/'canonical.json'))))

if __name__ == '__main__':
    main()
