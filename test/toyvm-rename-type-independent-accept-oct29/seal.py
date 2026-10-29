"""Seal already completed evidence; no subprocess, runtime replay or production write."""
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
ROOT = REPO.parent
DISPATCH = Path('/home/user/wine-assembly/scratch/usage-watch/toyvm-rename-type-independent-accept-oct29-dispatch.json')


def pin(path):
    data = path.read_bytes()
    return {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}


if __name__ == '__main__':
    d = json.loads(DISPATCH.read_text())
    actual = {p: pin(REPO / p) for p in d['sourcePins']}
    assert actual == d['sourcePins']
    retained = {}
    for name in ('originalCancellationReceipt', 'previousVerifiedReceipt'):
        retained[name] = pin(Path(d[name]))
        assert retained[name] == d[name + 'Pin']
    for name, pin_name in [('taskSupervisor', 'taskSupervisorPin'), ('limitModule', 'limitModulePin')]:
        assert pin(Path(d[name])) == d[pin_name]
    reproduced = json.loads((HERE / 'original-reproducer.json').read_text())
    assert [r['errno'] for r in reproduced] == [21, 20]
    for r in reproduced:
        assert r['names'] == {'S': 2, 'T': 3} and r['destinationExists']
        assert r['before']['live'] == r['after']['live'] == 12288
        assert {k: v for k, v in r['before'].items() if k != 'operations'} == {
            k: v for k, v in r['after'].items() if k != 'operations'}
    original = Path(d['previousVerifiedReceipt']).parent / 'test/reproduce.py'
    assert pin(HERE / 'reproduce.py') == pin(original)
    identity = (ROOT / 'e/identity.stdout').read_text().splitlines()
    assert identity == [str(REPO), str(REPO / '.git'), d['candidate'],
                        'task/' + d['task']]
    accepted = json.loads((HERE / 'acceptance.json').read_text())
    assert accepted['PASS'] and accepted['cases'] == 156
    assert all(v['rejected'] for v in accepted['sensitivity'].values())
    receipts = {}
    for name in ('identity', 'original-reproducer', 'independent-acceptance',
                 'tracked-production-integrity', 'preserve-evidence'):
        rec = json.loads((ROOT / 'e' / (name + '.json')).read_text())
        assert rec['exit'] == 0
        receipts[name] = rec
    assert not (ROOT / 'e/tracked-production-integrity.stdout').read_bytes()
    result = dict(PASS=True, candidate=d['candidate'], branch='task/' + d['task'],
                  sourcePins=actual, preservedRuntimeReceiptPins=retained,
                  originalReproducerPin=pin(original), originalReproducerGate='PASS',
                  acceptance=accepted, supervisorReceipts=receipts,
                  controls=json.loads((ROOT / 'prelaunch-controls.json').read_text()),
                  rootRefReceipt=str(DISPATCH.parent / d['task'] / 'root-ref-digest.json'),
                  mountConfiguration='not applicable: no mount execution',
                  nodeStartup='not applicable: no Node execution', box=None,
                  remainingGate='qualify_accounted.py still pins old e281eb058cee5e65797566c738d0330d2449ec6fe84572d572cfbf181c32ec41 backend; separately reviewed pin update and integration required before full CLI qualification',
                  filePins={p.name: pin(p) for p in HERE.iterdir() if p.is_file() and p.name != 'canonical.json'})
    (HERE / 'canonical.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({'PASS': True, 'canonical': str(HERE / 'canonical.json'),
                      'sourcePins': len(actual), 'cases': accepted['cases']}))
