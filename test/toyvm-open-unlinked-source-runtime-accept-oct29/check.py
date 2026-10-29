"""Offline source/receipt checks only. Never imports or invokes a backend/fixture."""
import ast
import base64
import copy
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]


def require(value, message):
    if not value:
        raise ValueError(message)


def pin(path):
    data = path.read_bytes()
    return dict(bytes=len(data), sha256=hashlib.sha256(data).hexdigest())


def fixture_order(text):
    tree = ast.parse(text)
    # A complete statement sequence, not a textual occurrence or checkpoint alone.
    expected = ast.parse((HERE / 'fixture.py').read_text())
    require(ast.dump(tree) == ast.dump(expected), 'fixture syscall/order contract changed')
    calls = [n for n in ast.walk(tree) if isinstance(n, ast.Call)]
    names = [(n.lineno, ast.unparse(n.func), ast.unparse(n)) for n in calls]
    ordered = sorted(x for x in names if x[1].startswith('os.') or x[1] == 'print')
    require([x[1] for x in ordered] == ['os.open', 'os.write', 'os.unlink',
            'os.open', 'os.fstat', 'os.pread', 'print', 'os.write'], 'unexpected syscall sequence')
    require('os.write(b, b\'b\' * 16384)' == ordered[-1][2], 'B growth identity')


def source_contract(backend, supervisor):
    tree = ast.parse(backend)
    methods = {n.name: n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef)}
    collect = methods['collect']
    guard = next(n for n in ast.walk(collect) if isinstance(n, ast.If))
    require(ast.unparse(guard.test) == "not n['links'] and (not n['opens'])", 'collect must require both lifetimes ended')
    charge = ast.unparse(methods['charge'])
    require("if self.live + delta > self.live_limit:" in charge and
            charge.index("self.reject('filesystem allocation limit')") < charge.index('self.live += delta'), 'reject before charge')
    resize = ast.unparse(methods['resize'])
    require(resize.index('self.charge(') < resize.index("n['data'].extend"), 'charge before resize mutation')
    handle = ast.unparse(methods['handle'])
    for text in ["self.nodes[ino]['opens'] -= 1", "self.handles -= 1", 'self.collect(ino)',
                 "self.nodes[child]['links'] -= 1", 'self.collect(child)',
                 "self.nodes[child]['opens'] += 1", 'self.handles += 1']:
        require(text in handle, 'missing lifetime transition: ' + text)
    write = handle[handle.index('if op == 16:'):handle.index('if op in (18, 29):')]
    require(write.index('self.resize(') < write.index('self.written += size'), 'write accounting after allocation guard')
    st = ast.parse(supervisor)
    text = ast.unparse(st)
    require(text.index('result = m.supervise(') < text.index('final = snapshot()') < text.index("result['filesystem'] = final"), 'post-reap filesystem timing')
    require('filesystemFinal' not in supervisor, 'unexpected historical final schema')


def receipt_contract(raw, historical):
    require(raw['gatePASS'] is False and historical['gatePASS'] is False, 'historical FAIL must remain')
    require(raw['cliExit'] == 1 and raw['safetyCleanup'] is None, 'original CLI outcome')
    report = raw['report']; br = report['backendReceipt']; fs = br['filesystem']
    require(report['accepted'] is False and report['childSucceeded'] is False, 'original rejection')
    require(br['stopReason'] == fs['failure'] == 'filesystem allocation limit', 'allocation guard reason')
    require({k: fs[k] for k in ('live', 'peak', 'written', 'openHandles', 'inodes')} ==
            dict(live=8192, peak=28672, written=16384, openHandles=0, inodes=2), 'B growth must not be accepted')
    require((fs['liveLimit'], fs['fileLimit'], fs['writeLimit']) == (32768, 16384, 65536), 'quota identity')
    require(fs == historical['filesystem'] and 'filesystemFinal' not in br, 'canonical/raw agreement')
    decoded = base64.b64decode(br['output']['data'], validate=True).decode()
    require(decoded == raw['decodedOutput'] == historical['descriptorCheckpoint'], 'checkpoint raw bytes')
    require(json.loads(decoded) == dict(checkpoint='before-B-write', Afd=3, Bfd=4,
            Aopen=True, Alinks=0, Asize=16384, Ainode=2), 'descriptor state')
    fixture_order(raw['argv'][-1])
    require(raw['argv'][-4:-1] == ['/usr/bin/python3', '-B', '-c'], 'actual Python fixture invocation')
    for flag, value in [('--live-limit', '32768'), ('--write-limit', '65536'), ('--file-limit', '16384')]:
        require(raw['argv'][raw['argv'].index(flag)+1] == value, 'actual CLI quotas')
    require(report['cleanupComplete'] is True and br['cleanupComplete'] is True and
            br['filesystemCleanup']['unmountExit'] == 0 and
            br['filesystemCleanup']['remainingMounts'] == raw['remainingMounts'] == [] and
            all(x['absentOrReused'] for x in raw['observedIdentities']), 'cleanup incomplete')
    require(report['browserAllowanceRemaining'] == dict(captures=1, cpuSeconds=35.353183,
            wallSeconds=101.495550694) and report['browserAllowed'] is False, 'browser scope unchanged')


def reject(label, function, *args):
    try:
        function(*args)
    except (ValueError, SyntaxError):
        return label
    raise AssertionError('negative control accepted: ' + label)


def main():
    manifest = json.loads((HERE/'input-pins.json').read_text())
    for relative, expected in manifest['sourcePins'].items():
        require(pin(REPO/relative) == expected, 'source pin: ' + relative)
    for relative, expected in manifest['evidencePins'].items():
        require(pin(HERE/relative) == expected, 'evidence pin: ' + relative)
    hist = json.loads((HERE/'evidence/historical-canonical.json').read_text())
    envelope = json.loads((HERE/'evidence/runtime.stdout').read_text())
    require(envelope['success'] is True and envelope['exitCode'] == 0 and
            not envelope['stdoutTruncated'] and not envelope['stderrTruncated'] and
            not envelope['timedOut'] and not envelope['oomKilled'], 'outer execution envelope')
    raw = json.loads(envelope['stdout'])
    require(raw['candidate'] == hist['candidate'] == manifest['candidate'], 'candidate identity')
    require(raw['pins'] == hist['sourcePins'] == manifest['sourcePins'], 'runtime source identities')
    require(raw['fixtureSHA256'] == hist['runtimeFixturePin']['sha256'] == pin(HERE/'fixture.py')['sha256'], 'fixture identity')
    require(pin(HERE/'evidence/observer.py') == hist['runtimeObserverPin'], 'observer identity')
    backend = (REPO/'test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py').read_text()
    supervisor = (REPO/'test/toyvm-kernel-profile-accounting-backend-oct28/supervise_accounted.py').read_text()
    fixture = (HERE/'fixture.py').read_text()
    fixture_order(fixture)
    source_contract(backend, supervisor)
    receipt_contract(raw, hist)
    stopped = json.loads((HERE/'evidence/actual-stopped.json').read_text())
    require(stopped['state'] == 'stopped' and stopped['box'] == hist['lifecycle']['box'] and
            stopped['snapshotStatus'] == 'completed' and stopped['stop']['status'] == 'completed', 'prior lifecycle')
    controls = []
    controls.append(reject('A closed before B write', fixture_order,
        fixture.replace('os.write(b,b"b"*16384)', 'os.close(fd)\nos.write(b,b"b"*16384)')))
    controls.append(reject('A closed before checkpoint', fixture_order,
        fixture.replace('s=os.fstat(fd)', 'os.close(fd)\ns=os.fstat(fd)')))
    accepted = copy.deepcopy(raw)
    accepted['report']['backendReceipt']['filesystem']['written'] = 32768
    controls.append(reject('accepted B growth with forged failure', receipt_contract, accepted, hist))
    accepted = copy.deepcopy(raw)
    accepted['report']['backendReceipt']['filesystem']['failure'] = None
    accepted['report']['backendReceipt']['stopReason'] = None
    controls.append(reject('accepted B growth without failure', receipt_contract, accepted, hist))
    controls.append(reject('unlink prematurely collects open inode', source_contract,
        backend.replace("not n['links'] and not n['opens']", "not n['links'] or not n['opens']"), supervisor))
    controls.append(reject('guard moved after live mutation', source_contract,
        backend.replace("if self.live+delta>self.live_limit:self.reject('filesystem allocation limit')\n        self.live+=delta", "self.live+=delta\n        if self.live+delta>self.live_limit:self.reject('filesystem allocation limit')"), supervisor))
    forged = copy.deepcopy(raw); forged['report']['backendReceipt']['filesystem']['live'] = 28672
    controls.append(reject('inferred rejection live relabeled measured final', receipt_contract, forged, hist))
    # Arithmetic proof, not backend execution or a synthetic runtime result.
    root, meta, payload = 4096, 4096, 16384
    pre_b = root + meta + payload + meta
    require(pre_b == 28672 and pre_b + payload == 45056 > 32768, 'retained A charge guards B')
    require(root + meta + payload == 24576 <= 32768, 'early A release would allow B growth')
    print(json.dumps(dict(PASS=True, scope='offline source/receipt acceptance',
        historicalGatePASS=False, runtimeInvocations=0, backendInvocations=0,
        negativeControls=controls, inferredPreBCharge=pre_b, observedRejectionLive=None), sort_keys=True))


if __name__ == '__main__':
    main()
