#!/usr/bin/env python3
"""Read-only offline seal verifier. No build, package install, guest or network."""
import hashlib
import json
from pathlib import Path

E = Path(__file__).resolve().parent
R = E.parents[2]

def sha(data):
    return hashlib.sha256(data).hexdigest()

def check(row, data, blob=False):
    assert len(data) == row['size'], row['path']
    assert sha(data) == row['sha256'], row['path']
    if blob:
        assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest() == row['blob'], row['path']

source = json.loads((E/'source-manifest.json').read_text())
assert source['revision'] == '13bb92cd2e1bc060ff908722843d1e97a439b1a4'
for row in source['files']:
    check(row, (R/row['path']).read_bytes(), True)
assert len(source['files']) == 158
assert sum(row['size'] for row in source['files']) == 7213816
module = (R/'build/wine-assembly.wasm').read_bytes()
assert len(module) == 1878971
assert sha(module) == 'f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7'
for row in json.loads((E/'manifest.json').read_text()):
    check(row, (E/row['path']).read_bytes())
abi = json.loads((E/'abi.json').read_text())
assert abi['verdict'] == 'PASS_BINARY_ABI_LINK_ONLY'
assert not abi['hasStart'] and abi['guestExportsCalled'] == abi['PEsLoaded'] == 0
assert len(abi['imports']) == 291 and len(abi['exports']) == 2221
assert abi['regionStamp'] == '9a3bc9149d58209c'
assert abi['guestSemanticsQualified'] is False
flags = json.loads((E/'flags.json').read_text())
assert all(x['pass'] for x in flags['rows'])
assert flags['codec']['available'] is flags['actualPNGEncoded'] is False
assert flags['guestAttempts'] == flags['OSForks'] == 0
checks = json.loads((E/'checks.json').read_text())
assert all(x['exit'] == x['expected'] for x in checks)
assert 'shell callback must reach authentic transport exactly once' in (E/'baseline-reject.log').read_text()
pre = json.loads((E/'recovery-prerequisites.json').read_text())
assert pre['verdict'] == 'BLOCKED_EXACT_SCREEN_CODEC_RECOVERY'
assert len(pre['codecCoreFiles']) == 23 and pre['codecCoreBytes'] == 63864
assert sum(x['size'] for x in pre['codecCoreFiles']) == 63864
deps = json.loads((E/'historical-dependencies.json').read_text())
for row in deps['reusedExact']:
    check(row, (R/row['path']).read_bytes())
for row in deps['assetsVerifiedInPlace']:
    check(row, Path(row['localVerifiedPath']).read_bytes())
for p, expected in json.loads((E/'publication-protected-seals.json').read_text()).items():
    assert sha(Path(p).read_bytes()) == expected, p
# Identity negative controls without mutating any source/artifact.
row = source['files'][0]
bad = (R/row['path']).read_bytes()+b'corruption'
try:
    check(row, bad, True)
except AssertionError:
    pass
else:
    raise AssertionError('corruption control was accepted')
forged = dict(row, blob='0'*40)
try:
    check(forged, (R/row['path']).read_bytes(), True)
except AssertionError:
    pass
else:
    raise AssertionError('forged Git identity control was accepted')
print('PASS 158 exact-source seals, historical module, ABI/flag evidence, callback/coupled gate, assets and two identity rejects; readiness BLOCKED_EXACT_SCREEN_CODEC_RECOVERY')
