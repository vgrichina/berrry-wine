"""Independent retained-evidence acceptance. Never launches production or FUSE."""
import ast
import base64
import copy
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
CANDIDATE = '5a88ca099b962e946160afd2d4d71a950bf46db3'
TASK = 'toyvm-sparse-offset-runtime-independent-accept-oct29'
EXPECTED = dict(live=8192, peak=8192, written=0, inodes=2, openHandles=0)


def pin(data):
    return dict(bytes=len(data), sha256=hashlib.sha256(data).hexdigest())


def require(value, message):
    if not value:
        raise ValueError(message)


def source_contract(source):
    """Check actual AST ordering, independently of the whole-file hash gate."""
    tree = ast.parse(source)
    cls = next(n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == 'Backend')
    methods = {n.name: n for n in cls.body if isinstance(n, ast.FunctionDef)}
    text = {k: ast.unparse(v) for k, v in methods.items()}
    charge = text['charge']
    require('if self.live + delta > self.live_limit:' in charge, 'live guard')
    require("self.reject('filesystem allocation limit')" in charge, 'allocation reason')
    require(charge.index('self.reject(') < charge.index('self.live += delta'), 'charge before live mutation')
    resize = text['resize']
    rounding = 'self.charge(((size + 4095) // 4096 - (old + 4095) // 4096) * 4096)'
    require(rounding in resize, 'dense block rounding')
    require(resize.index(rounding) < resize.index("n['data'].extend("), 'charge before payload growth')
    handle = methods['handle']
    write = next(n for n in ast.walk(handle) if isinstance(n, ast.If)
                 and ast.unparse(n.test) == 'op == 16')
    w = ast.unparse(write)
    tokens = ['if self.written + size > self.write_limit:',
              'if off + size > self.file_limit:',
              "self.resize(ino, max(off + size, len(self.nodes[ino]['data'])))",
              "self.nodes[ino]['data'][off:off + size] = payload", 'self.written += size']
    require(all(t in w for t in tokens), 'write offset/guards/mutation')
    require([w.index(t) for t in tokens] == sorted(w.index(t) for t in tokens), 'write guard ordering')
    require('self.charge(4096)' in text['create'], 'inode metadata charge')
    require('self.live = 4096' in text['__init__'], 'root metadata charge')
    # Evaluate only the production arithmetic expression, never the backend.
    charge_call = next(n for n in ast.walk(methods['resize']) if isinstance(n, ast.Call)
                       and ast.unparse(n.func) == 'self.charge')
    delta = eval(compile(ast.Expression(charge_call.args[0]), '<pinned-rounding>', 'eval'),
                 {'__builtins__': {}}, dict(size=8191 + 1, old=0))
    require(delta == 8192 and 4096 + 4096 + delta == 16384 > 12288, 'offset arithmetic')
    require(8191 + 1 <= 8192 and 1 <= 65536, 'nonbinding file/write limits')
    return dict(root=4096, emptyA=4096, before=8192, offset=8191, bytes=1,
                densePayload=delta, attemptedLive=16384, liveLimit=12288,
                fileLimit=8192, writeLimit=65536, inferenceOnly=True)


def accept_raw(raw, fixture, pins):
    """Start at the retained exact CLI invocation, not the observer's gatePASS."""
    argv = ['/usr/bin/python3', '-B', '/tmp/tvsp/repo/test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py',
            '--domain', 'tiny-fixture', '--receipt', '/tmp/tvsp/cancellation.json', '--work', '/tmp/tvsp/w',
            '--live-limit', '12288', '--write-limit', '65536', '--file-limit', '8192',
            '--rss-limit', '134217728', '--cpu-limit', '2', '--wall-limit', '5', '--output-limit', '4096',
            '--', '/usr/bin/python3', '-B', '-c', fixture]
    require(raw['argv'] == argv and raw['candidate'] == CANDIDATE, 'earliest CLI argv/candidate')
    require(raw['productionInvocations'] == 1 and raw['cliExit'] == 1, 'single invocation/CLI exit')
    require(raw['pins'] == pins, 'execution source pins')
    require(raw['sourceAfter'] == {k: v['sha256'] for k, v in pins.items()}, 'source after identity')
    require(raw['fixtureSHA256'] == pin(fixture.encode())['sha256'], 'fixture identity')
    report = json.loads(raw['cliStdout'])
    require(report == raw['report'] and raw['cliStderr'] == '', 'actual CLI output agreement')
    require(report['accepted'] is False and report['browserAllowed'] is False, 'CLI rejection')
    br = report['backendReceipt']
    fs = br['filesystem']
    require(br['stopReason'] == fs['failure'] == 'filesystem allocation limit', 'wrong guard')
    require({k: fs[k] for k in EXPECTED} == EXPECTED, 'post-reap counter mismatch')
    require((fs['liveLimit'], fs['writeLimit'], fs['fileLimit']) == (12288, 65536, 8192), 'quota mismatch')
    require(br['output']['encoding'] == 'base64', 'marker encoding')
    marker = base64.b64decode(br['output']['data'], validate=True).decode()
    require(marker == raw['fixtureOutput'], 'marker output agreement')
    require(json.loads(marker) == dict(checkpoint='before-sparse-offset-write', attemptedOffset=8191,
                                     attemptedBytes=1, initialSize=0), 'missing/stale marker')
    cleanup = br['filesystemCleanup']
    require(report['cleanupComplete'] is True and br['cleanupComplete'] is True, 'reap incomplete')
    require(cleanup['remainingMounts'] == raw['remainingMounts'] == [], 'mount remains')
    require(cleanup['unmountExit'] == 0 and cleanup['serverExit'] in (0, -15), 'disconnect incomplete')
    require(raw['safetyCleanup'] is None, 'external cleanup')
    samples = {(x['pid'], x['start']) for s in raw['samples'] for x in s['rows']}
    identities = raw['observedIdentities']
    require(len(identities) == 3, 'observed identity census')
    final = {(x['pid'], x['start']) for x in identities}
    require(final == samples and all(x['absentOrReused'] is True and x['finalState'] is None
                                   for x in identities), 'PID/start cleanup')
    owned = {tuple(x) for x in br['owned']}
    require(bool(owned) and owned <= final and raw['productionOwnedIdentityCheck'] is True, 'owned identity')
    rows = [x for s in raw['samples'] for x in s['rows']]
    require(any(x['cmd'].startswith('/usr/bin/python3 -B /tmp/tvsp/repo/test/toyvm-kernel-profile-accounting-backend-oct28/confine.py /tmp/tvsp/w/domain ') for x in rows), 'confinement invocation')
    require(any(x['cmd'].startswith('/usr/bin/python3 -B /tmp/tvsp/repo/test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py /tmp/tvsp/w/domain /tmp/tvsp/w/status.sock 12288 65536 8192 ') for x in rows), 'actual backend invocation')
    require(raw['socketBytes'] == len(b'/tmp/tvsp/w/status.sock') == 23, 'socket identity')
    return dict(cliExit=1, accepted=False, reason=fs['failure'], counterPhase='post-reap', observed=EXPECTED,
                marker=json.loads(marker), reapedPIDStartIdentities=sorted(final), remainingMounts=[])


def main():
    d = json.loads((HERE / 'dispatch.json').read_text())
    inputs = HERE / 'inputs'
    manifest = json.loads((inputs / 'retention-manifest.json').read_text())
    # The coordinator verified the complete retained manifest once. Validate the
    # selected payloads consumed here, not unrelated predecessor test groups.
    for path in inputs.iterdir():
        if path.name == 'retention-manifest.json':
            continue
        key = json.loads((HERE / 'input-map.json').read_text())[path.name]
        if key in manifest:
            require(pin(path.read_bytes()) == manifest[key], 'retained input ' + key)
    fixture = (inputs / 'fixture.py').read_text()
    raw = json.loads((inputs / 'runtime-result.json').read_text())
    envelope = json.loads((inputs / 'runtime.stdout').read_text())
    require(envelope['exitCode'] == 0 and not envelope['launcherFailed'] and not envelope['oomKilled']
            and envelope['signal'] is None and not envelope['stdoutTruncated']
            and not envelope['stderrTruncated'] and envelope['stderr'] == '', 'API envelope failure')
    require(json.loads(envelope['stdout']) == raw, 'original envelope/raw mismatch')
    original = Path(d['retainedSourceEvidence']) / 'evidence/runtime-result.json'
    require(original.read_bytes() == (inputs / 'runtime-result.json').read_bytes(), 'original raw mismatch')
    for rel, expected in d['sourcePins'].items():
        require(pin((REPO / rel).read_bytes()) == expected, 'immutable production pin ' + rel)
    # This first acceptance checkpoint reads the exact retained production entry
    # boundary. No source surrogate, mutable supervisor import or replay occurs.
    result = accept_raw(raw, fixture, d['sourcePins'])
    backend = (REPO / 'test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py').read_text()
    arithmetic = source_contract(backend)
    oracle = json.loads((inputs / 'source-phase-oracle.json').read_text())
    require(oracle['postReap'] == EXPECTED and oracle['phases'][2]['live'] == arithmetic['attemptedLive'], 'oracle mismatch')
    controls = {}

    def reject(name, fn):
        try:
            fn()
        except (ValueError, KeyError, StopIteration, SyntaxError):
            controls[name] = 'REJECTED'
        else:
            raise AssertionError('false acceptance: ' + name)

    def altered(name, mutation):
        changed = copy.deepcopy(raw)
        mutation(changed)
        # Keep duplicated serialization consistent so semantic checks, rather
        # than a shallow duplicate-output mismatch, must catch each forgery.
        changed['cliStdout'] = json.dumps(changed['report'])
        reject(name, lambda: accept_raw(changed, fixture, d['sourcePins']))

    altered('wrong-guard', lambda r: r['report']['backendReceipt'].update(stopReason='filesystem per-file limit'))
    altered('counter', lambda r: r['report']['backendReceipt']['filesystem'].update(written=1))
    altered('identity-start', lambda r: r['observedIdentities'][0].update(start='stale'))
    altered('missing-owned', lambda r: r['report']['backendReceipt'].update(owned=[]))
    altered('mount', lambda r: r['report']['backendReceipt']['filesystemCleanup'].update(remainingMounts=['still mounted']))
    altered('source-after', lambda r: r['sourceAfter'].update({next(iter(d['sourcePins'])): '0' * 64}))
    altered('offset-argv', lambda r: r['argv'].__setitem__(-1, fixture.replace('8191', '4095')))
    for name, marker in [('missing-marker', ''), ('stale-marker', json.dumps(dict(checkpoint='before-sparse-offset-write', attemptedOffset=4095, attemptedBytes=1, initialSize=0)))]:
        def change(r, marker=marker):
            r['fixtureOutput'] = marker
            r['report']['backendReceipt']['output']['data'] = base64.b64encode(marker.encode()).decode()
        altered(name, change)
    reject('source-wrong-guard', lambda: source_contract(backend.replace('self.live+delta>self.live_limit', 'self.live+delta>self.file_limit')))
    reject('source-rounding', lambda: source_contract(backend.replace('(size+4095)//4096', 'size//4096')))
    reject('source-offset', lambda: source_contract(backend.replace('max(off+size,len(', 'max(size,len(')))
    reject('source-charge-after-growth', lambda: source_contract(backend.replace(
        "        self.charge(((size+4095)//4096-(old+4095)//4096)*4096)\n        if size>old:n['data'].extend(b'\\0'*(size-old))",
        "        if size>old:n['data'].extend(b'\\0'*(size-old))\n        self.charge(((size+4095)//4096-(old+4095)//4096)*4096)")))
    stopped = json.loads((inputs / 'coordinator-stopped-info.json').read_text())['sandbox']
    require(stopped['id'] == 'bx_nsk7cdtr' and stopped['state'] == 'stopped'
            and stopped['lastSnapshotStatus'] == 'completed' and stopped['snapshotVerifiedAt'], 'retained box state')
    old = json.loads((inputs / 'previous-blocked-incident.json').read_text())
    require(old['outcome'] == 'BLOCKED_BEFORE_RUNTIME' and old['productionInvocations'] == 0, 'earlier incident')
    canonical = dict(task=TASK, candidate=CANDIDATE, outcome='SCOPED_ACCEPT', newRuntimeInvocations=0,
                     retainedProductionInvocations=1, productionBoundary=result, sourceInference=arithmetic,
                     sourcePins=d['sourcePins'], fixturePin=pin(fixture.encode()), controls=controls,
                     retainedManifestPin=pin((inputs / 'retention-manifest.json').read_bytes()),
                     box=dict(id=stopped['id'], state=stopped['state'], originalExpiry='2026-10-29T05:50:03.297Z',
                              lifecycleOwner='coordinator', operation='none; retained stopped receipt only'),
                     limitations=json.loads((inputs / 'runtime-canonical.json').read_text())['limitations'])
    (HERE / 'canonical.json').write_text(json.dumps(canonical, indent=2) + '\n')
    print(json.dumps(dict(outcome=canonical['outcome'], controls=controls, newRuntimeInvocations=0)))


if __name__ == '__main__':
    main()
