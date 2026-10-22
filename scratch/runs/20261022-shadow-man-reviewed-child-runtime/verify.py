import hashlib, json
from pathlib import Path
E = Path(__file__).resolve().parent
R = E.parents[2]
spec = json.loads((E/'source-manifest.json').read_text())
assert len(spec['files']) == 158 and sum(x['size'] for x in spec['files']) == 7213816
for x in spec['files']:
    b = (R/x['path']).read_bytes()
    assert len(b) == x['size'] and hashlib.sha256(b).hexdigest() == x['sha256']
    assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest() == x['blob']
b = (R/'build/wine-assembly.wasm').read_bytes()
assert len(b) == 1878971 and hashlib.sha256(b).hexdigest() == 'f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7'
p = json.loads((E/'recipe-tools.json').read_text())
assert p['exitCode'] == 1 and p['stdout'].endswith('checking 7z\n')
inventory = json.loads(json.loads((E/'remote-preflight.json').read_text())['stdout'])
assert inventory['tools']['7z'] is None and inventory['tools']['unshield'] is None
assert inventory['guestAttempts'] == inventory['downloadAttempts'] == 0
assert not inventory['recoveryRootExists']
assert inventory['freeBytes'] > inventory['remotePhaseCap'] + inventory['hostReserve']
box = json.loads((E/'box-info.json').read_text())['sandbox']
assert box['id'] == 'bx_495585da' and box['state'] == 'idle' and box['stop'] is None
for p, expected in json.loads((E/'protected-seals.json').read_text()).items():
    assert hashlib.sha256(Path(p).read_bytes()).hexdigest() == expected, p
for x in json.loads((E/'evidence-seals.json').read_text()):
    b = (E/x['path']).read_bytes()
    assert len(b) == x['size'] and hashlib.sha256(b).hexdigest() == x['sha256'], x['path']
print('PASS: exact local closure, actual missing recipe dependency, zero attempts, same running box, seals')
