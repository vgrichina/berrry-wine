"""Verify retained failure evidence only; never execute the CLI or a workload."""
import base64
import hashlib
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent


def read(name):
    return json.loads((ROOT / name).read_bytes())


def main():
    r = read('case1-result.json')
    report = r['report']
    backend = report['backendReceipt']
    output = base64.b64decode(backend['output']['data']).decode()
    assert r['count'] == 1024 and r['cliExit'] == 1
    assert report['accepted'] is False and backend['exit'] == 2
    assert "can't open file '/tmp/tvcm/fixture.py'" in output
    assert 'Operation not permitted' in output
    assert 'TINY_FIXTURE_COMPLETED' not in output
    assert report['cleanupComplete'] is True and r['watchdog'] is None
    assert backend['filesystem']['failure'] is None
    assert backend['filesystem']['written'] == 0
    assert backend['filesystem']['openHandles'] == 0
    assert backend['filesystemCleanup']['unmountExit'] == 0
    assert not backend['filesystemCleanup']['remainingMounts']
    assert any(' - fuse.toyvm-accounting ' in m for m in r['mountsObserved'])
    assert not r['remainingMounts'] and not r['remainingObservedProcessIdentities']
    preflight = read('remote-preflight.json')
    assert preflight['PASS'] is True
    assert preflight['pins'] == {p: v['sha256'] for p, v in read('source-pins.json').items()}
    assert r['receiptSHA256'] == preflight['receiptSHA256']
    life = read('lifecycle.json')
    assert life['state'] == 'stopped' and life['snapshotStoppedVerified'] is True
    assert life['boxID'] == 'bx_pfvpxxu2'
    envelope = read('case1-api.json')
    assert not envelope['stdoutTruncated'] and not envelope['stderrTruncated']
    assert json.loads(envelope['stdout']) == r
    for name, pin in read('artifact-hashes.json').items():
        data = (ROOT / name).read_bytes()
        assert len(data) == pin['bytes']
        assert hashlib.sha256(data).hexdigest() == pin['sha256']
    print('PASS: retained mounted-CLI counterexample and cleanup evidence; qualification FAIL, case 2 NOT RUN')


if __name__ == '__main__':
    main()
